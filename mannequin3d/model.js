(function (root) {
  'use strict';

  const map = [
    '#############',
    '#S....#.....#',
    '#..##.#.###.#',
    '#.###...#...#',
    '#.....###.#.#',
    '###.#.....#.#',
    '#...#.###.#.#',
    '#.###.#...#.#',
    '#.....#.###.#',
    '#.#..##.#...#',
    '#.#.....#.#E#',
    '#...#.....#.#',
    '#############'
  ];
  const width = map[0].length;
  const length = map.length;
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const tile = (x, y) => map[Math.floor(y)]?.[Math.floor(x)] ?? '#';
  const exit = { x: 11.5, y: 10.5 };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function move(actor, dx, dy, radius) {
    function open(x, y) {
      return [-radius, radius].every(a =>
        [-radius, radius].every(b => tile(x + a, y + b) !== '#'));
    }
    if (open(actor.x + dx, actor.y)) actor.x += dx;
    if (open(actor.x, actor.y + dy)) actor.y += dy;
  }

  function lineOfSight(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const count = Math.ceil(Math.hypot(dx, dy) / .10);
    for (let i = 1; i < count; i++) {
      if (tile(a.x + dx * i / count, a.y + dy * i / count) === '#') return false;
    }
    return true;
  }

  function route(from, to) {
    const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
    const gx = Math.floor(to.x), gy = Math.floor(to.y);
    if (start.x === gx && start.y === gy) return [];
    const previous = new Map([[start.y * width + start.x, null]]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i];
      for (const [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy, key = ny * width + nx;
        if (previous.has(key) || tile(nx, ny) === '#') continue;
        previous.set(key, y * width + x);
        if (nx === gx && ny === gy) {
          const points = [];
          for (let k = key; previous.get(k) !== null; k = previous.get(k)) {
            points.push({ x: k % width + .5, y: Math.floor(k / width) + .5 });
          }
          return points.reverse();
        }
        queue.push({ x: nx, y: ny });
      }
    }
    return [];
  }

  function create() {
    const player = { x: 1.5, y: 1.5, angle: 0 };
    const enemy = { x: 1.5, y: 4.5, path: [], refresh: 0 };
    const state = { player, enemy, elapsed: 0, battery: 100, light: true,
      empty: false, frozen: false, near: 3, visible: false, moving: false, result: '' };

    function toggleLight() {
      if (state.light) state.light = false;
      else if (!state.empty) state.light = true;
    }

    function turn(angle) {
      player.angle = (player.angle + angle) % (2 * Math.PI);
    }

    function step(dt, controls = {}) {
      if (state.result) return;
      state.elapsed += dt;
      if (state.elapsed >= 60) {
        state.elapsed = 60;
        state.result = 'timeout';
        return;
      }

      turn((controls.turn || 0) * dt * 2.5);
      const forward = controls.forward || 0, strafe = controls.strafe || 0;
      const speed = 2.2 * dt / Math.max(1, Math.hypot(forward, strafe));
      const cos = Math.cos(player.angle), sin = Math.sin(player.angle);
      const lastX = player.x, lastY = player.y;
      move(player, (forward * cos - strafe * sin) * speed, (forward * sin + strafe * cos) * speed, .18);
      state.moving = player.x !== lastX || player.y !== lastY;

      if (tile(player.x, player.y) === 'E' && Math.hypot(player.x - exit.x, player.y - exit.y) < .69) {
        state.result = 'escaped';
        return;
      }

      state.battery = clamp(state.battery + dt * (state.light ? -8 : 14), 0, 100);
      if (state.battery === 0) { state.light = false; state.empty = true; }
      if (state.battery >= 20) state.empty = false;

      const dx = enemy.x - player.x, dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      const sight = distance < 10 && lineOfSight(player, enemy);
      const dot = (dx * cos + dy * sin) / Math.max(.001, distance);
      state.near = distance;
      state.visible = sight && dot > .64;
      state.frozen = state.light && sight && distance <= 6 && dot >= .77;

      if (state.elapsed < 2.5 || state.frozen) return;
      if (distance < .52 && sight) {
        state.result = 'caught';
        return;
      }

      enemy.refresh -= dt;
      if (enemy.refresh <= 0) {
        enemy.path = route(enemy, player);
        enemy.refresh = .22;
      }
      const target = sight ? player : enemy.path[0];
      if (!target) return;
      const ex = target.x - enemy.x, ey = target.y - enemy.y;
      const gap = Math.hypot(ex, ey);
      if (gap < .08) {
        enemy.path.shift();
        return;
      }
      const pursuit = (state.light ? 1.54 : 1.91) * dt;
      const stride = Math.min(gap, pursuit);
      move(enemy, ex * stride / gap, ey * stride / gap, .17);
    }

    return { state, step, turn, toggleLight };
  }

  root.Mannequin = { create, route, tile, map, exit };
})(globalThis);
