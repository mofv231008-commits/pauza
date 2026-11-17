(function (root) {
  'use strict';

  const map = [
    '###############',
    '#.....#......E#',
    '#.##..#..###..#',
    '#..H..#....#..#',
    '#.....~....#..#',
    '###.#####.##..#',
    '#...#.....~...#',
    '#...#..####...#',
    '#...~..#..#H..#',
    '#...#..#..#...#',
    '#...#....~.##.#',
    '#H..####......#',
    '#.....##.##...#',
    '#..#...~..#...#',
    '#P....#..S....#',
    '###############'
  ];
  const width = map[0].length, height = map.length;
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const keySpots = [[2, 3], [2, 8], [5, 12]];
  const fuseSpots = [[12, 7], [8, 9], [10, 3]];
  const route = [[9, 14], [13, 11], [12, 6], [9, 4], [9, 6], [5, 10]];
  const cell = (x, y) => map[y]?.[x] ?? '#';
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const place = ([x, y]) => ({ x, y });

  function path(from, to, max = width * height, avoidClosets = false) {
    const seen = new Set([from.y * width + from.x]);
    const queue = [{ x: from.x, y: from.y, n: 0, next: null }];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (same(item, to)) return item;
      if (item.n >= max) continue;
      for (const [dx, dy] of directions) {
        const x = item.x + dx, y = item.y + dy, id = y * width + x;
        const tile = cell(x, y);
        if (seen.has(id) || tile === '#' ||
            (avoidClosets && tile === 'H' && !same({ x, y }, to))) continue;
        seen.add(id);
        queue.push({ x, y, n: item.n + 1, next: item.next || { x, y } });
      }
    }
    return null;
  }

  function canSee(enemy, player) {
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const length = Math.abs(dx) + Math.abs(dy);
    if ((dx && dy) || length > 5) return false;
    for (let n = 1; n < length; n++) {
      if (cell(enemy.x + Math.sign(dx) * n, enemy.y + Math.sign(dy) * n) === '#') return false;
    }
    return true;
  }

  function create(random = Math.random) {
    const choose = locations => place(locations[Math.floor(random() * locations.length)]);
    const player = { x: 1, y: 14, walk: 0 };
    const enemy = { x: 9, y: 14, wait: .9, patrol: 1, mode: 'patrol', visible: false, target: null, memory: 0 };
    const items = [{ ...choose(keySpots), type: 'key' }, { ...choose(fuseSpots), type: 'fuse' }];
    const state = { player, enemy, items, left: 60, noise: 0, found: 0, result: '' };
    const exit = { x: 13, y: 1 };

    function move(dx, dy, quiet) {
      if (state.result || player.walk > 0 || !directions.some(d => d[0] === dx && d[1] === dy)) return;
      const x = player.x + dx, y = player.y + dy, tile = cell(x, y);
      if (tile === '#') return;
      player.x = x;
      player.y = y;
      player.walk = quiet ? .34 : .19;
      state.noise = quiet ? (tile === '~' ? 1 : 0) : (tile === '~' ? 3 : 2);
      if (state.noise) {
        const range = [0, 2, 4, 8][state.noise];
        if (path(enemy, player, range) && enemy.mode !== 'chase') {
          enemy.mode = 'search';
          enemy.target = { x, y };
          enemy.memory = 3.5;
        }
      }
      if (same(enemy, player)) {
        state.result = 'caught';
        return;
      }
      const item = items.find(item => !item.taken && same(item, player));
      if (item) {
        item.taken = true;
        state.found++;
      } else if (same(player, exit) && state.found === 2) {
        state.result = 'escaped';
      }
    }

    function step(dt) {
      if (state.result) return;
      state.left = Math.max(0, state.left - dt);
      if (state.left === 0) {
        state.result = 'timeout';
        return;
      }
      player.walk = Math.max(0, player.walk - dt);
      if (player.walk === 0) state.noise = 0;
      enemy.memory = Math.max(0, enemy.memory - dt);
      const hidden = cell(player.x, player.y) === 'H';
      enemy.visible = !hidden && canSee(enemy, player);
      if (enemy.visible) {
        enemy.mode = 'chase';
        enemy.target = { x: player.x, y: player.y };
        enemy.memory = 2.6;
      } else if (enemy.target && enemy.memory === 0) {
        enemy.mode = 'patrol';
        enemy.target = null;
      }
      enemy.wait -= dt;
      if (enemy.wait > 0) return;
      enemy.wait = enemy.mode === 'chase' ? .25 : enemy.mode === 'search' ? .34 : .47;
      const target = enemy.target || place(route[enemy.patrol]);
      if (same(enemy, target)) {
        if (!enemy.target) enemy.patrol = (enemy.patrol + 1) % route.length;
        else if (enemy.mode === 'search') enemy.wait += .4;
        return;
      }
      const next = path(enemy, target, width * height, true)?.next;
      if (!next) return;
      enemy.x = next.x;
      enemy.y = next.y;
      if (same(enemy, player)) state.result = 'caught';
    }

    return { state, move, step };
  }

  root.SilentHouse = { map, width, height, cell, create };
})(globalThis);
