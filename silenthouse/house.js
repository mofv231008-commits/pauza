(function () {
  'use strict';

  const P = window.Pauza;
  const H = window.SilentHouse;
  const art = window.SilentHouseArt;
  const byId = id => document.getElementById(id);
  const floor = byId('floor'), sneak = byId('sneak');
  const warning = byId('warning'), objective = byId('objective');
  const meter = document.querySelector('.noise');
  const bars = meter.querySelectorAll('i');
  const moveKeys = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowRight: [1, 0], KeyD: [1, 0],
    ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0]
  };
  let game = H.create(), quiet = false, touch = null;
  const keys = new Set();
  let redraw = true, previousFrame = '', lastWarning = '', lastObjective = '', lastNoise = -1;

  const formatTime = n => (n / 10).toFixed(1).replace('.', ',') + ' с';
  const shell = P.shell({
    id: 'silenthouse',
    title: 'Дом тишины',
    tagline: 'Одна минута, чтобы выбраться.',
    rulesHtml: '<p>Найди жёлтый ключ и зелёный предохранитель, потом иди к двери вверху справа. Хозяйка замечает тебя в коридоре и идёт на звук шагов. Нажми «Красться», чтобы идти тише, и заходи в шкафы, чтобы спрятаться. Треснувшие половицы скрипят.</p>',
    kbdHint: 'Стрелки или WASD — ходьба, Shift — красться.',
    startLabel: 'Войти',
    lowerIsBetter: true,
    formatScore: formatTime,
    onReset: reset,
    onPause: clearInput
  });
  const view = P.canvas(floor, floor.parentElement, () => { redraw = true; });

  function clearInput() {
    keys.clear();
    touch = null;
  }

  function setQuiet(on) {
    quiet = on;
    sneak.setAttribute('aria-pressed', String(on));
  }

  function reset() {
    game = H.create();
    clearInput();
    setQuiet(false);
    redraw = true;
    refresh();
  }

  function refresh() {
    const { left, found, player, enemy, noise } = game.state;
    shell.setScore(found + '/2');
    shell.setSide(Math.ceil(left) + ' с', left <= 10);
    const hidden = H.cell(player.x, player.y) === 'H';
    const danger = enemy.mode === 'chase';
    const message = hidden ? 'Ты в шкафу' : enemy.visible ? 'Она тебя видит' :
      danger ? 'Она ищет тебя' : enemy.mode === 'search' ? 'Она услышала шум' : 'Тихо';
    if (message !== lastWarning) {
      lastWarning = warning.textContent = message;
      warning.dataset.danger = String(!hidden && danger);
    }
    const task = found === 2 ? 'Выход открыт ↑' : (found === 0 ? 'Найди ключ и предохранитель' :
      game.state.items.find(item => !item.taken).type === 'key' ? 'Найди ключ' : 'Найди предохранитель');
    if (task !== lastObjective) lastObjective = objective.textContent = task;
    if (noise !== lastNoise) {
      lastNoise = noise;
      meter.setAttribute('aria-label', 'Шум: ' + noise + ' из 3');
      bars.forEach((bar, index) => bar.classList.toggle('active', index < noise));
    }
  }

  function finish() {
    const { left, found, result } = game.state;
    const escaped = result === 'escaped';
    const score = Math.max(1, Math.round((60 - left) * 10));
    clearInput();
    shell.end({
      score, record: escaped, tone: escaped ? 'good' : null, haptic: escaped ? 'win' : 'crash',
      eyebrow: escaped ? 'Ты выбрался' : result === 'caught' ? 'Она тебя поймала' : 'Время вышло',
      stats: 'Предметы: ' + found + '/2',
      phrase: escaped ? 'Я выбрался из «Дома тишины» за ' + formatTime(score) + '. Сможешь быстрее?' :
        'Попробуешь выбраться из «Дома тишины»?'
    });
  }

  document.querySelectorAll('.dpad button').forEach(button => {
    const direction = [Number(button.dataset.dx), Number(button.dataset.dy)];
    button.addEventListener('pointerdown', event => {
      if (!shell.running || event.button !== 0 || touch) return;
      event.preventDefault();
      touch = { id: event.pointerId, direction };
      button.setPointerCapture(event.pointerId);
      game.move(...direction, quiet);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => {
        if (touch?.id === event.pointerId) touch = null;
      });
    }
    button.addEventListener('click', event => {
      if (shell.running && event.detail === 0) game.move(...direction, quiet);
    });
  });

  sneak.addEventListener('click', () => { if (shell.running) setQuiet(!quiet); });
  window.addEventListener('keydown', event => {
    if (!shell.running) return;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (!event.repeat) setQuiet(!quiet);
      return;
    }
    if (!moveKeys[event.code]) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));

  P.loop(dt => {
    if (shell.running) {
      const key = [...keys].pop();
      const direction = touch?.direction || moveKeys[key];
      if (direction) game.move(...direction, quiet);
      game.step(dt);
      refresh();
      if (game.state.result) finish();
    }
    const { player, enemy, found } = game.state;
    const signature = [player.x, player.y, enemy.x, enemy.y, enemy.mode, found].join();
    if (!redraw && signature === previousFrame) return;
    previousFrame = signature;
    redraw = false;
    art.render(view.ctx, view.W, view.H, game.state);
  });
})();
