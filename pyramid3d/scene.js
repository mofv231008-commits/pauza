(function (root) {
  'use strict';

  const { width, length, radius, pockets } = root.PyramidPhysics;

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const backdrop = document.createElement('canvas');
    const bg = backdrop.getContext('2d');
    let w = 1, h = 1, pixelRatio = 1, scale = 1, offsetY = 0;
    let camera = .71, target = camera, dirty = true;
    let sine = 0, cosine = 0;
    const distance = 6.4;

    function project(x, y, z) {
      const depth = distance - y * sine - z * cosine;
      return { x: w / 2 + scale * x / depth, y: offsetY + scale * (z * sine - y * cosine) / depth,
        k: scale / depth };
    }

    function unproject(x, y) {
      const ky = (y - offsetY) / scale;
      const t = (distance * sine - radius) / (sine + ky * cosine);
      return { x: t * (x - w / 2) / scale, z: distance * cosine + t * (-cosine + ky * sine) };
    }

    function polygon(context, corners, color) {
      context.fillStyle = color;
      context.beginPath();
      corners.forEach(([x, y, z], index) => {
        const p = project(x, y, z);
        if (index) context.lineTo(p.x, p.y);
        else context.moveTo(p.x, p.y);
      });
      context.closePath();
      context.fill();
    }

    function board(x0, z0, x1, z1, y) {
      return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
    }

    function stroke(context, a, b, color, size) {
      const from = project(...a), to = project(...b);
      context.strokeStyle = color;
      context.lineWidth = size;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    function disc(context, x, z, size, y, color) {
      const corners = [];
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        corners.push([x + size * Math.cos(angle), y, z + size * Math.sin(angle)]);
      }
      polygon(context, corners, color);
    }

    function rail(x0, z0, x1, z1) {
      const upper = board(x0, z0, x1, z1, .069);
      const lower = board(x0, z0, x1, z1, -.15);
      polygon(bg, [upper[3], upper[2], lower[2], lower[3]], '#483039');
      polygon(bg, [upper[0], upper[3], lower[3], lower[0]], '#624043');
      polygon(bg, [upper[1], upper[2], lower[2], lower[1]], '#392531');
      polygon(bg, upper, '#8f5a48');
      stroke(bg, upper[0], upper[1], '#e1a174', 1);
      stroke(bg, upper[3], upper[2], '#bb805c', 1);
    }

    function drawBackdrop() {
      sine = Math.sin(camera);
      cosine = Math.cos(camera);
      scale = distance;
      offsetY = 0;
      const extents = board(-1.22, -2.18, 1.22, 2.18, .069)
        .concat(board(-1.22, -2.18, 1.22, 2.18, -.26)).map(p => project(...p));
      const top = Math.min(...extents.map(p => p.y)), bottom = Math.max(...extents.map(p => p.y));
      const spanX = Math.max(...extents.map(p => Math.abs(p.x - w / 2))) * 2;
      const fit = Math.max(.5, Math.min((w - 26) / spanX, (h - 28) / (bottom - top)));
      scale *= fit;
      offsetY = (h - (bottom + top) * fit) / 2;

      const light = bg.createRadialGradient(w * .49, h * .38, 8, w * .5, h * .4, Math.max(w, h) * .72);
      light.addColorStop(0, '#50404e');
      light.addColorStop(.55, '#26202e');
      light.addColorStop(1, '#15131e');
      bg.fillStyle = light;
      bg.fillRect(0, 0, w, h);

      polygon(bg, board(-1.48, -2.48, 1.48, 2.52, -.27), '#2e2535');
      for (let x = -10; x <= 10; x += .28) {
        stroke(bg, [x, -.30, -3.8], [x, -.30, 3.8], '#a48c9f17', 1);
      }
      polygon(bg, board(-1.24, -2.25, 1.25, 2.34, -.25), '#120e19aa');
      polygon(bg, board(-1.14, -2.14, 1.14, 2.14, -.10), '#32222b');
      const felt = bg.createLinearGradient(0, project(0, 0, -length).y, 0, project(0, 0, length).y);
      felt.addColorStop(0, '#184943');
      felt.addColorStop(.45, '#327c64');
      felt.addColorStop(1, '#1d5350');
      polygon(bg, board(-width, -length, width, length, 0), felt);
      polygon(bg, board(-1, -2, -.952, 2, .002), '#216652');
      polygon(bg, board(.952, -2, 1, 2, .002), '#174640');
      stroke(bg, [-.87, .004, .99], [.87, .004, .99], '#d1dfac37', 1);
      disc(bg, 0, -1, .017, 0, '#d1dfaca0');
      disc(bg, 0, 1, .017, 0, '#d1dfaca0');

      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -1.17 : 1, x1 = side < 0 ? -1 : 1.17;
        rail(x0, -1.89, x1, -.10);
        rail(x0, .10, x1, 1.89);
        for (const z of [-1.51, -.99, -.5, .5, .99, 1.51]) {
          disc(bg, side * 1.08, z, .019, .070, '#f4c789');
        }
      }
      rail(-.90, -2.17, .90, -2);
      rail(-.90, 2, .90, 2.17);
      for (const { x, z } of pockets) {
        const size = z === 0 ? .091 : .102;
        disc(bg, x, z, size, .011, '#543c3e');
        disc(bg, x, z, size * .82, .013, '#100f19');
        disc(bg, x, z, size * .59, .014, '#08070d');
      }
    }

    function fit() {
      const bounds = canvas.getBoundingClientRect();
      w = Math.max(1, bounds.width);
      h = Math.max(1, bounds.height);
      pixelRatio = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = backdrop.width = Math.round(w * pixelRatio);
      canvas.height = backdrop.height = Math.round(h * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      bg.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawBackdrop();
      dirty = true;
    }

    function drawBall(ball, cue, selecting) {
      const point = project(ball.x, radius, ball.z);
      const shadow = project(ball.x + .015, 0, ball.z + .012);
      const size = radius * point.k;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, size * 1.12, size * Math.max(.42, sine), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0b2524a8';
      ctx.fill();
      const gold = ball.id === 0;
      const gradient = ctx.createRadialGradient(point.x - size * .32, point.y - size * .45, 0,
        point.x, point.y, size * 1.1);
      gradient.addColorStop(0, '#fffaf0');
      gradient.addColorStop(.37, gold ? '#f0cb8d' : '#f4e7d4');
      gradient.addColorStop(.78, gold ? '#bc7950' : '#bcb8b3');
      gradient.addColorStop(1, gold ? '#774346' : '#737281');
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      if (size > 4.5 && !gold) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 ' + Math.max(5, size * .85) + 'px system-ui';
        ctx.fillStyle = '#493940';
        ctx.fillText(ball.id, point.x, point.y + .5);
      }
      if (ball === cue || selecting) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, size + 2.3, 0, Math.PI * 2);
        ctx.strokeStyle = ball === cue ? '#ffd48e' : '#c7eada89';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }

    function drawAim(cue, direction, balls, power) {
      const end = root.PyramidPhysics.aimLine(cue, direction, balls);
      ctx.setLineDash([4, 5]);
      stroke(ctx, [cue.x, radius, cue.z], [end.x, radius, end.z], '#fff0c4b8', 1.4);
      ctx.setLineDash([]);
      const point = project(end.x, radius, end.z);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#f6d193';
      ctx.stroke();
      const onCue = offset => [cue.x - direction.x * offset, radius, cue.z - direction.z * offset];
      const gap = .1 + power * .0016;
      ctx.lineCap = 'round';
      stroke(ctx, onCue(gap), onCue(gap + .8), '#251c26', 5);
      stroke(ctx, onCue(gap + .04), onCue(gap + .79), '#c89768', 3);
      stroke(ctx, onCue(gap + .03), onCue(gap), '#a2dedd', 2);
      ctx.lineCap = 'butt';
    }

    function draw(balls, cue, direction, power, canAim, selecting, dt, moving) {
      if (Math.abs(camera - target) > .001) {
        camera += (target - camera) * Math.min(1, dt * 14);
        drawBackdrop();
        dirty = true;
      }
      if (!dirty && !moving) return;
      dirty = false;
      ctx.drawImage(backdrop, 0, 0, w, h);
      if (canAim && !selecting) drawAim(cue, direction, balls, power);
      const visible = balls.filter(b => !b.pocketed).sort((a, b) => a.z - b.z);
      for (const ball of visible) drawBall(ball, cue, selecting);
    }

    fit();
    if (root.ResizeObserver) new ResizeObserver(fit).observe(canvas.parentElement);
    root.addEventListener('resize', fit);
    return { draw, project, unproject, invalidate() { dirty = true; },
      setOverhead(on) { target = on ? Math.PI / 2 : .71; } };
  }

  root.PyramidScene = { create };
})(globalThis);
