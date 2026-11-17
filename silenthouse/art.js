(function (root) {
  'use strict';
  const { map, width, height, cell } = root.SilentHouse;

  function disc(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function halo(ctx, x, y, radius, color) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, '#0000');
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function render(ctx, w, h, state) {
    const t = Math.max(.05, Math.min((w - 12) / width, (h - 12) / height));
    ctx.fillStyle = '#151017';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate((w - t * width) / 2, (h - t * height) / 2);
    ctx.scale(t, t);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        if (tile === '#') {
          ctx.fillStyle = '#342b36';
          ctx.fillRect(x, y, 1, 1);
          ctx.fillStyle = '#433846';
          ctx.fillRect(x, y, .98, .14);
          ctx.fillStyle = '#231b27';
          ctx.fillRect(x + .85, y + .14, .14, .86);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 ? '#584036' : '#513a35';
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = '#261d2280';
        ctx.fillRect(x, y + .93, 1, .06);
        ctx.fillRect(x + .31 + (x % 3) * .08, y, .03, 1);
        if (tile === '~') {
          ctx.strokeStyle = '#b99078';
          ctx.lineWidth = .055;
          ctx.beginPath();
          ctx.moveTo(x + .33, y + .14);
          ctx.lineTo(x + .64, y + .41);
          ctx.lineTo(x + .43, y + .54);
          ctx.lineTo(x + .68, y + .89);
          ctx.stroke();
        } else if (tile === 'H') {
          ctx.fillStyle = '#282f35';
          ctx.fillRect(x + .13, y + .13, .74, .74);
          ctx.strokeStyle = '#87999a';
          ctx.lineWidth = .055;
          ctx.strokeRect(x + .13, y + .13, .74, .74);
          disc(ctx, x + .61, y + .53, .07, '#9eaeab');
        } else if (tile === 'E') {
          ctx.fillStyle = state.found === 2 ? '#88c7a1' : '#a17b60';
          ctx.fillRect(x + .14, y + .06, .72, .9);
          ctx.fillStyle = state.found === 2 ? '#244638' : '#3b2a33';
          ctx.fillRect(x + .24, y + .17, .52, .79);
          disc(ctx, x + .63, y + .55, .08, '#ffd592');
        }
      }
    }

    const { player, enemy } = state;
    const light = ctx.createRadialGradient(player.x + .5, player.y + .5, .7, player.x + .5, player.y + .5, 6.5);
    light.addColorStop(0, '#ffb8703b');
    light.addColorStop(.35, '#2011191c');
    light.addColorStop(1, '#100c17b0');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);

    for (const item of state.items) {
      if (item.taken) continue;
      const x = item.x + .5, y = item.y + .5;
      const color = item.type === 'key' ? '#ffd592' : '#97e9c4';
      halo(ctx, x, y, .83, color + '5b');
      ctx.strokeStyle = color;
      ctx.lineWidth = .12;
      if (item.type === 'key') {
        ctx.beginPath();
        ctx.arc(x - .12, y - .12, .16, 0, Math.PI * 2);
        ctx.moveTo(x, y);
        ctx.lineTo(x + .24, y + .24);
        ctx.lineTo(x + .34, y + .15);
        ctx.stroke();
      } else {
        ctx.strokeRect(x - .17, y - .26, .34, .52);
        ctx.fillStyle = color;
        ctx.fillRect(x - .18, y + .13, .36, .12);
      }
    }

    const px = player.x + .5, py = player.y + .5;
    const ex = enemy.x + .5, ey = enemy.y + .5;
    const alert = enemy.mode !== 'patrol';
    halo(ctx, ex, ey, alert ? 1.9 : 1.15, '#f64b497d');
    disc(ctx, ex, ey + .09, .43, '#451c27');
    disc(ctx, ex, ey, .35, '#c35656');
    disc(ctx, ex + .09, ey - .04, .065, '#ffe3d3');
    disc(ctx, ex - .09, ey - .04, .065, '#ffe3d3');
    if (alert) {
      ctx.fillStyle = '#ffd8bb';
      ctx.fillRect(ex - .048, ey - .83, .096, .21);
      ctx.fillRect(ex - .048, ey - .57, .096, .09);
    }

    const hidden = cell(player.x, player.y) === 'H';
    halo(ctx, px, py, 1.35, hidden ? '#8ed8d163' : '#ffbd6c83');
    disc(ctx, px, py + .10, .38, '#382333');
    disc(ctx, px, py, .33, hidden ? '#8ed8d1' : '#ffd592');
    disc(ctx, px, py, .11, '#684b45');
    ctx.restore();
  }

  root.SilentHouseArt = { render };
})(globalThis);
