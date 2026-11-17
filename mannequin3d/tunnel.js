(function () {
  'use strict';

  const P = window.Pauza;
  const M = window.Mannequin;
  const byId = id => document.getElementById(id);
  const panel = byId('corridor'), lightButton = byId('flashlight');
  const exitArrow = byId('exit-arrow'), status = byId('tunnel-status');
  const scene = window.MannequinScene.create();
  const heldKeys = new Set(), heldButtons = new Map();
  const moveKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  let game = M.create(), swipe = null, redraw = true;
  let goal = null, goalCell = '', renderDelay = 0, lastWarning = '', animation = 0;

  const formatTime = n => (n / 10).toFixed(1).replace('.', ',') + ' с';
  const shell = P.shell({
    id: 'mannequin3d',
    title: 'Манекен',
    tagline: 'До выхода — одна минута.',
    rulesHtml: '<p>Иди по стрелке к выходу. Манекен идёт за тобой и замирает, если навести на него включённый фонарь. Батарея восстанавливается, когда фонарь выключен. Удерживай стрелки для движения и поворота. Камеру можно поворачивать свайпом по тоннелю.</p>',
    kbdHint: 'WASD — движение, ← → — поворот, F — фонарь.',
    startLabel: 'Спуститься',
    lowerIsBetter: true,
    formatScore: formatTime,
    onReset: reset,
    onPause: clearControls
  });
  const view = P.canvas(panel, panel.parentElement, () => { redraw = true; });

  function clearControls() {
    heldKeys.clear();
    heldButtons.clear();
    swipe = null;
  }

  function reset() {
    game = M.create();
    clearControls();
    goal = null;
    goalCell = '';
    animation = 0;
    redraw = true;
    refresh();
  }

  function refresh() {
    const { player, elapsed, battery, empty, light, near, frozen } = game.state;
    shell.setScore(Math.ceil(battery) + '%');
    shell.setSide(Math.ceil(60 - elapsed) + ' с', elapsed >= 50);
    lightButton.setAttribute('aria-pressed', String(light));
    lightButton.disabled = !light && empty;

    const nextWarning = frozen ? 'Он замер' : near < 2.4 ? 'Он близко' :
      empty ? 'Фонарь заряжается' : light ? 'Фонарь включён' : 'Фонарь выключен';
    if (nextWarning !== lastWarning) {
      lastWarning = status.textContent = nextWarning;
      status.dataset.danger = String(!frozen && near < 2.4);
    }

    const cell = Math.floor(player.x) + ',' + Math.floor(player.y);
    if (cell !== goalCell) {
      goalCell = cell;
      goal = M.route(player, M.exit)[0] || M.exit;
    }
    if (goal) {
      const diff = Math.atan2(goal.y - player.y, goal.x - player.x) - player.angle;
      exitArrow.style.transform = 'rotate(' + diff.toFixed(3) + 'rad)';
    }
  }

  function finish() {
    const { result, elapsed } = game.state;
    const success = result === 'escaped';
    const score = Math.max(1, Math.round(elapsed * 10));
    clearControls();
    shell.end({
      score,
      record: success,
      tone: success ? 'good' : null,
      haptic: success ? 'win' : 'crash',
      delay: result === 'caught' ? 520 : 0,
      eyebrow: success ? 'Ты выбрался' : result === 'caught' ? 'Он оказался рядом' : 'Время вышло',
      phrase: success ? 'Я выбрался из тоннеля в «Манекене» за ' + formatTime(score) + '. Сможешь быстрее?' :
        'Попробуй выбраться из тоннеля в «Манекене».'
    });
  }

  function held(...keys) {
    for (const key of keys) {
      if (heldKeys.has(key)) return 1;
      for (const value of heldButtons.values()) if (value === key) return 1;
    }
    return 0;
  }

  [
    ['forward', 'KeyW'], ['backward', 'KeyS'], ['turn-left', 'ArrowLeft'], ['turn-right', 'ArrowRight']
  ].forEach(([id, key]) => {
    const button = byId(id);
    button.addEventListener('pointerdown', event => {
      if (!shell.running || event.button !== 0) return;
      event.preventDefault();
      heldButtons.set(event.pointerId, key);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => heldButtons.delete(event.pointerId));
    }
    button.addEventListener('click', event => {
      if (!shell.running || event.detail !== 0) return;
      if (key === 'ArrowLeft' || key === 'ArrowRight') game.turn(key === 'ArrowLeft' ? -.16 : .16);
      else game.step(1 / 20, { forward: key === 'KeyW' ? 1 : -1 });
      redraw = true;
    });
  });

  function toggleFlashlight() {
    if (!shell.running) return;
    game.toggleLight();
    redraw = true;
  }
  lightButton.addEventListener('click', toggleFlashlight);

  panel.addEventListener('pointerdown', event => {
    if (!shell.running || swipe || event.button !== 0) return;
    event.preventDefault();
    swipe = { id: event.pointerId, x: event.clientX };
    panel.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointermove', event => {
    if (swipe?.id !== event.pointerId || !shell.running) return;
    game.turn((event.clientX - swipe.x) * .008);
    swipe.x = event.clientX;
    redraw = true;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    panel.addEventListener(type, event => { if (swipe?.id === event.pointerId) swipe = null; });
  }

  window.addEventListener('keydown', event => {
    if (!shell.running) return;
    if (event.code === 'KeyF' && !event.repeat) {
      event.preventDefault();
      toggleFlashlight();
    } else if (moveKeys.has(event.code)) {
      event.preventDefault();
      heldKeys.add(event.code);
    }
  });
  window.addEventListener('keyup', event => heldKeys.delete(event.code));

  P.loop(dt => {
    if (shell.running) {
      game.step(dt, {
        forward: held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'),
        strafe: held('KeyD') - held('KeyA'),
        turn: held('ArrowRight') - held('ArrowLeft')
      });
      if (game.state.moving) animation += dt * 10;
      refresh();
      if (game.state.result) finish();
      renderDelay -= dt;
      if (renderDelay <= 0) redraw = true;
    }
    if (!redraw) return;
    redraw = false;
    renderDelay = 1 / 36;
    const bob = game.state.moving && !P.reduceMotion ? Math.sin(animation) * 2 : 0;
    scene.draw(view.ctx, view.W, view.H, game.state, bob);
  });
})();
