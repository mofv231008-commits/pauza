(function (root) {
  'use strict';

  const { width, length, radius, faceX, faceZ, pockets } = root.PyramidPhysics;

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const backdrop = document.createElement('canvas');
    const bg = backdrop.getContext('2d');
    const foreground = document.createElement('canvas');
    const fg = foreground.getContext('2d');
    let w = 1, h = 1, pixelRatio = 1, scale = 1, offsetY = 0;
    const perspectivePitch = .71;
    let yaw = 0;
    const camera = { yaw, pitch: perspectivePitch };
    let overhead = false, dirty = true;
    let sine = 0, cosine = 0, side = 0, front = 1;
    let eyeX = 0, eyeZ = 0;
    const distance = 6.4;

    function project(x, y, z) {
      const along = x * side + z * front;
      const across = x * front - z * side;
      const depth = distance - y * sine - along * cosine;
      return { x: w / 2 + scale * across / depth, y: offsetY + scale * (along * sine - y * cosine) / depth,
        k: scale / depth };
    }

    function unproject(x, y) {
      const ky = (y - offsetY) / scale;
      const t = (distance * sine - radius) / (sine + ky * cosine);
      const across = t * (x - w / 2) / scale;
      const along = distance * cosine + t * (-cosine + ky * sine);
      return { x: across * front + along * side, z: along * front - across * side };
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

    function rail(x0, z0, x1, z1, near) {
      const upper = board(x0, z0, x1, z1, .069);
      const lower = board(x0, z0, x1, z1, -.15);
      const faces = [
        { side: [0, 1], visible: eyeZ < z0, color: '#543038' },
        { side: [1, 2], visible: eyeX > x1, color: '#392531' },
        { side: [2, 3], visible: eyeZ > z1, color: '#483039' },
        { side: [3, 0], visible: eyeX < x0, color: '#624043' }
      ];
      for (const { side: [a, b], visible, color } of faces) {
        if (!visible) continue;
        const face = [upper[a], upper[b], lower[b], lower[a]];
        polygon(bg, face, color);
        if (near) polygon(fg, face, color);
      }
      for (const layer of [bg, fg]) {
        polygon(layer, upper, '#8f5a48');
        stroke(layer, upper[0], upper[1], '#e1a174', 1);
        stroke(layer, upper[3], upper[2], '#bb805c', 1);
      }
    }

    function rubber(x1, z1, x2, z2, dx, dz, near) {
      const outside = [[x1, .069, z1], [x2, .069, z2]];
      const inside = [[x1 + dx, .041, z1 + dz], [x2 + dx, .041, z2 + dz]];
      const lip = [outside[0], outside[1], inside[1], inside[0]];
      const face = [inside[0], inside[1], [x2 + dx, 0, z2 + dz], [x1 + dx, 0, z1 + dz]];
      if (!near) polygon(bg, face, '#123e34');
      for (const layer of [bg, fg]) {
        polygon(layer, lip, near ? '#294f43' : '#427365');
        stroke(layer, inside[0], inside[1], '#6b9e79', 1);
      }
    }

    function drawBackdrop() {
      sine = Math.sin(camera.pitch);
      cosine = Math.cos(camera.pitch);
      side = Math.sin(camera.yaw);
      front = Math.cos(camera.yaw);
      eyeX = distance * cosine * side;
      eyeZ = distance * cosine * front;
      fg.clearRect(0, 0, w, h);
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
      const far = project(0, 0, -length), near = project(0, 0, length);
      const felt = bg.createLinearGradient(far.x, far.y, near.x, near.y);
      felt.addColorStop(0, '#184943');
      felt.addColorStop(.45, '#327c64');
      felt.addColorStop(1, '#1d5350');
      polygon(bg, board(-width, -length, width, length, 0), felt);
      stroke(bg, [-.87, .004, .99], [.87, .004, .99], '#d1dfac37', 1);
      disc(bg, 0, -1, .017, 0, '#d1dfaca0');
      disc(bg, 0, 1, .017, 0, '#d1dfaca0');

      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -1.17 : 1, x1 = side < 0 ? -1 : 1.17;
        const near = side * eyeX > faceX;
        rail(x0, -1.89, x1, -.10, near);
        rail(x0, .10, x1, 1.89, near);
        rubber(side * width, -1.89, side * width, -.10, side * (faceX - width), 0, near);
        rubber(side * width, .10, side * width, 1.89, side * (faceX - width), 0, near);
        for (const z of [-1.51, -.99, -.5, .5, .99, 1.51]) {
          disc(bg, side * 1.08, z, .019, .070, '#f4c789');
          disc(fg, side * 1.08, z, .019, .070, '#f4c789');
        }
      }
      rail(-.90, -2.17, .90, -2, eyeZ < -length);
      rail(-.90, 2, .90, 2.17, eyeZ > length);
      rubber(-.90, -length, .90, -length, 0, length - faceZ, eyeZ < -faceZ);
      rubber(-.90, length, .90, length, 0, faceZ - length, eyeZ > faceZ);
      for (const { x, z, mouth } of pockets) {
        for (const layer of [bg, fg]) {
          disc(layer, x, z, mouth * 1.17, .011, '#543c3e');
          disc(layer, x, z, mouth, .013, '#100f19');
          disc(layer, x, z, mouth * .72, .014, '#08070d');
        }
      }
    }

    function fit() {
      const bounds = canvas.getBoundingClientRect();
      w = Math.max(1, bounds.width);
      h = Math.max(1, bounds.height);
      pixelRatio = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = backdrop.width = foreground.width = Math.round(w * pixelRatio);
      canvas.height = backdrop.height = foreground.height = Math.round(h * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      bg.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      fg.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawBackdrop();
      dirty = true;
    }

    function drawBall(ball, cue, selecting) {
      const point = project(ball.x, radius, ball.z);
      const shadow = project(ball.x, 0, ball.z);
      const size = radius * point.k;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, size * .94, size * Math.max(.30, sine * .86), 0, 0, Math.PI * 2);
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
        ctx.arc(point.x, point.y, Math.max(.5, size - .75), 0, Math.PI * 2);
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
      const pitchTarget = overhead ? Math.PI / 2 : perspectivePitch;
      const yawTarget = overhead ? Math.PI / 2 : yaw;
      const yawDelta = Math.atan2(Math.sin(yawTarget - camera.yaw), Math.cos(yawTarget - camera.yaw));
      const pitchDelta = pitchTarget - camera.pitch;
      if (Math.abs(yawDelta) > .001 || Math.abs(pitchDelta) > .001) {
        const easing = Math.min(1, dt * 17);
        camera.yaw += Math.abs(yawDelta) < .004 ? yawDelta : yawDelta * easing;
        camera.pitch += Math.abs(pitchDelta) < .004 ? pitchDelta : pitchDelta * easing;
        drawBackdrop();
        dirty = true;
      }
      if (!dirty && !moving) return;
      dirty = false;
      ctx.drawImage(backdrop, 0, 0, w, h);
      if (canAim && !selecting) drawAim(cue, direction, balls, power);
      const visible = balls.filter(b => !b.pocketed)
        .sort((a, b) => (a.x - b.x) * side + (a.z - b.z) * front);
      for (const ball of visible) drawBall(ball, cue, selecting);
      ctx.drawImage(foreground, 0, 0, w, h);
    }

    fit();
    if (root.ResizeObserver) new ResizeObserver(fit).observe(canvas.parentElement);
    root.addEventListener('resize', fit);
    return { draw, project, unproject, invalidate() { dirty = true; },
      setOverhead(on) { overhead = on; },
      rotate(angle) { yaw = (yaw + angle) % (2 * Math.PI); } };
  }

  root.PyramidScene = { create };
})(globalThis);
