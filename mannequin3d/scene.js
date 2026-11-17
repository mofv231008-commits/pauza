(function (root) {
  'use strict';

  const { tile, exit } = root.Mannequin;
  const plane = .68;
  const columns = 132;
  const panelSize = 64;

  function surface(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function texture(type) {
    const canvas = surface(panelSize, panelSize);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = type ? '#55544d' : '#4b4b4c';
    ctx.fillRect(0, 0, 64, 64);
    let noise = 185;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        noise = (noise * 16807) % 2147483647;
        ctx.fillStyle = noise % 2 ? '#e2d6b31d' : '#17161528';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#252630';
    ctx.fillRect(0, 0, 64, 3);
    ctx.fillRect(0, 45, 64, 3);
    ctx.fillStyle = '#262832';
    ctx.fillRect(0, 59, 64, 5);
    if (type) {
      ctx.fillStyle = '#976331';
      ctx.fillRect(0, 29, 64, 8);
      ctx.fillStyle = '#b6894b';
      ctx.fillRect(0, 30, 64, 1);
    } else {
      ctx.fillStyle = '#343741';
      ctx.fillRect(0, 12, 64, 2);
      ctx.fillRect(12, 3, 2, 9);
    }
    ctx.fillStyle = '#727077';
    ctx.fillRect(0, 47, 64, 1);
    return canvas;
  }

  function figure() {
    const picture = surface(96, 190);
    const ctx = picture.getContext('2d');
    const finish = ctx.createLinearGradient(25, 0, 73, 0);
    finish.addColorStop(0, '#4A4743');
    finish.addColorStop(.48, '#b8ac9d');
    finish.addColorStop(.68, '#8c817e');
    finish.addColorStop(1, '#393733');
    const oval = (x, y, a, b, rotation) => {
      ctx.beginPath();
      ctx.ellipse(x, y, a, b, rotation, 0, Math.PI * 2);
      ctx.fill();
    };
    function silhouette(points) {
      ctx.beginPath();
      for (const [i, [x, y]] of points.entries()) {
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = finish;
    silhouette([[33,107],[44,105],[46,146],[36,184],[29,186],[34,153]]);
    silhouette([[53,106],[63,108],[62,150],[71,181],[67,187],[58,175],[53,150]]);
    silhouette([[27,70],[30,73],[26,103],[18,131],[14,128],[19,101],[20,80]]);
    silhouette([[66,69],[74,78],[76,103],[82,133],[76,137],[67,105],[62,82]]);
    silhouette([[27,70],[38,65],[58,64],[70,72],[63,93],[62,113],[53,121],[38,117],[34,97]]);
    oval(47, 62, 5, 12, -.13);
    oval(48, 45, 15, 21, -.21);
    ctx.fillStyle = '#35272c';
    oval(43, 45, 3.2, 1.8, -.21);
    oval(53, 43, 3.1, 1.85, -.32);
    ctx.fillStyle = '#d68c6a';
    oval(43, 45, .85, .6, 0);
    oval(53, 43, .86, .65, 0);
    ctx.strokeStyle = '#42343b';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(54, 26); ctx.lineTo(49, 34); ctx.lineTo(53, 38); ctx.lineTo(51, 42);
    ctx.moveTo(29, 78); ctx.lineTo(40, 90); ctx.lineTo(37, 98);
    ctx.moveTo(36, 58); ctx.lineTo(44, 57); ctx.lineTo(52, 55);
    ctx.stroke();
    return picture;
  }

  function gate() {
    const picture = surface(96, 190);
    const ctx = picture.getContext('2d');
    ctx.fillStyle = '#2f4542';
    ctx.fillRect(2, 17, 92, 173);
    ctx.fillStyle = '#445d55';
    ctx.fillRect(7, 22, 82, 168);
    ctx.fillStyle = '#20332e';
    ctx.fillRect(12, 28, 72, 154);
    ctx.fillStyle = '#87d4aa';
    ctx.fillRect(20, 32, 56, 18);
    ctx.fillStyle = '#122d28';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ВЫХОД', 48, 45);
    ctx.fillStyle = '#818d7f';
    ctx.fillRect(65, 95, 12, 4);
    return picture;
  }

  function cast(player, rx, ry) {
    const dx = Math.abs(1 / rx), dy = Math.abs(1 / ry);
    const stepX = rx < 0 ? -1 : 1, stepY = ry < 0 ? -1 : 1;
    let x = Math.floor(player.x), y = Math.floor(player.y);
    let sideX = rx < 0 ? (player.x - x) * dx : (x + 1 - player.x) * dx;
    let sideY = ry < 0 ? (player.y - y) * dy : (y + 1 - player.y) * dy;
    for (let step = 0; step < 30; step++) {
      const side = sideX < sideY ? 0 : 1;
      const depth = side === 0 ? sideX : sideY;
      if (side === 0) { x += stepX; sideX += dx; }
      else { y += stepY; sideY += dy; }
      if (tile(x, y) !== '#') continue;
      const sample = side === 0 ? player.y + depth * ry : player.x + depth * rx;
      return { depth: Math.max(.075, depth), u: sample - Math.floor(sample), side, x, y };
    }
    return { depth: 20, u: 0, side: 0, x: 0, y: 0 };
  }

  function create() {
    const materials = [texture(0), texture(1)];
    const mannequin = figure(), doorway = gate();
    const depth = new Float32Array(columns);

    function billboard(ctx, image, object, player, cos, sin, w, h, horizon, scale, alpha) {
      const dx = object.x - player.x, dy = object.y - player.y;
      const z = dx * cos + dy * sin;
      if (z < .14 || z > 12) return;
      const center = w / 2 * (1 + (-dx * sin + dy * cos) / (z * plane));
      const height = h * scale / z;
      const width = height * image.width / image.height;
      const start = center - width / 2;
      const end = center + width / 2;
      const bottom = horizon + h / (2 * z);
      ctx.globalAlpha = alpha;
      const strip = w / columns;
      for (let number = Math.max(0, Math.floor(start / strip)); number < columns && number * strip < end; number++) {
        if (depth[number] < z) continue;
        const left = Math.max(start, number * strip), right = Math.min(end, (number + 1) * strip);
        const sourceX = (left - start) / width * image.width;
        const sample = (right - left) / width * image.width;
        if (sample > 0) ctx.drawImage(image, sourceX, 0, sample, image.height, left, bottom - height, right - left + .15, height);
      }
      ctx.globalAlpha = 1;
    }

    function draw(ctx, w, h, state, bob = 0) {
      if (w < 2 || h < 2) return;
      const { player, enemy, light, frozen } = state;
      const cos = Math.cos(player.angle), sin = Math.sin(player.angle);
      const horizon = h * .49 + bob;
      const ceiling = ctx.createLinearGradient(0, 0, 0, h);
      ceiling.addColorStop(0, '#292725');
      ceiling.addColorStop(.48, '#0c111b');
      ceiling.addColorStop(1, '#252631');
      ctx.fillStyle = ceiling;
      ctx.fillRect(0, 0, w, h);
      for (let n = 1; n <= 12; n++) {
        const y = horizon + h / (n * 2);
        ctx.fillStyle = n % 2 ? '#c7b99c16' : '#1C1B1955';
        ctx.fillRect(0, y, w, Math.max(.6, 3 / n));
      }

      const strip = w / columns;
      for (let i = 0; i < columns; i++) {
        const center = (2 * (i + .5) / columns - 1);
        const hit = cast(player, cos - sin * plane * center, sin + cos * plane * center);
        depth[i] = hit.depth;
        const raw = h / hit.depth;
        const bottom = Math.min(h, horizon + raw / 2), top = Math.max(0, horizon - raw / 2);
        if (bottom <= top) continue;
        const start = (top - horizon + raw / 2) / raw * panelSize;
        const size = (bottom - top) / raw * panelSize;
        const material = materials[(hit.x + hit.y) % 3 === 0 ? 1 : 0];
        const x = i * strip;
        ctx.drawImage(material, Math.min(63, Math.floor(hit.u * panelSize)), start, 1, size, x, top, strip + .45, bottom - top);
        const beam = light ? Math.max(0, 1 - Math.abs(center) ** 1.6) * Math.exp(-hit.depth * .16) : 0;
        const dark = Math.min(.94, .57 + hit.depth * .035 + hit.side * .09 - beam * .60);
        ctx.fillStyle = 'rgba(9,12,20,' + Math.max(0, dark).toFixed(2) + ')';
        ctx.fillRect(x, top, strip + .45, bottom - top);
      }

      const drawDoor = () => billboard(ctx, doorway, exit, player, cos, sin, w, h, horizon, .79, .9);
      const drawEnemy = () => billboard(ctx, mannequin, enemy, player, cos, sin, w, h, horizon, 1.08,
        frozen ? .97 : Math.max(.36, .83 - state.near * .065));
      // The wall depth buffer clips both sprites. Draw the farther sprite first.
      if (Math.hypot(exit.x - player.x, exit.y - player.y) > state.near) {
        drawDoor(); drawEnemy();
      } else {
        drawEnemy(); drawDoor();
      }

      const glow = ctx.createRadialGradient(w / 2, horizon, w * .07, w / 2, horizon, Math.max(w, h) * .61);
      glow.addColorStop(0, light ? '#ffdb8918' : '#0c122326');
      glow.addColorStop(.42, '#18171608');
      glow.addColorStop(1, '#0C0C0Be6');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      if (state.near < 2.4 && !frozen) {
        const pulse = ctx.createRadialGradient(w / 2, horizon, w * .2, w / 2, horizon, Math.max(w, h) * .62);
        pulse.addColorStop(0, '#0000');
        pulse.addColorStop(1, 'rgba(119,20,24,' + Math.min(.62, (2.4 - state.near) * .31).toFixed(2) + ')');
        ctx.fillStyle = pulse;
        ctx.fillRect(0, 0, w, h);
      }
      if (state.result === 'caught') {
        const size = Math.min(w * .77, h * .48);
        ctx.fillStyle = '#1e111bd9';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(mannequin, 25, 21, 47, 49, (w - size) / 2, (h - size) / 2, size, size);
        return;
      }
      ctx.fillStyle = '#dfd5b1ad';
      ctx.fillRect(w / 2 - 1.4, horizon - 1.4, 2.8, 2.8);
    }

    return { draw };
  }

  root.MannequinScene = { create, cast };
})(globalThis);
