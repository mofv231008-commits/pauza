(function () {
  'use strict';

  const P = window.Pauza;
  const M = window.Mannequin;
  const byId = id => document.getElementById(id);
  const panel = byId('corridor'), lightButton = byId('flashlight');
  const exitArrow = byId('exit-arrow'), status = byId('tunnel-status');
  const joystick = byId('joystick'), thumb = byId('joystick-thumb');
  const scene = window.MannequinScene.create();
  const heldKeys = new Set();
  const moveKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  let game = M.create(), redraw = true;
  const movement = { forward: 0, strafe: 0 };
  let goal = null, goalCell = '', renderDelay = 0, lastWarning = '', animation = 0;

  const formatTime = n => (n / 10).toFixed(1).replace('.', ',') + ' с';
  const shell = P.shell({
    id: 'mannequin3d',
    title: 'Манекен',
    tagline: 'До выхода — одна минута.',
    rulesHtml: '<p>Иди по стрелке к выходу. Манекен идёт за тобой и замирает, если навести на него включённый фонарь. Батарея восстанавливается, когда фонарь выключен. Веди джойстик, чтобы идти. Камеру поворачивай свайпом по тоннелю.</p>',
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
    cancelJoystick();
    cancelLook();
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
    return keys.some(key => heldKeys.has(key)) ? 1 : 0;
  }

  // Each surface owns its own finger, so walking and looking can happen together.
  function bindDrag(element, start, move, stop = () => {}) {
    const touchEvents = 'ontouchstart' in window;
    let active = null;
    function release() {
      if (active === null) return;
      active = null;
      stop();
    }

    element.addEventListener('pointerdown', event => {
      if (!shell.running || active !== null || event.button !== 0 ||
          (touchEvents && event.pointerType === 'touch')) return;
      event.preventDefault();
      active = event.pointerId;
      element.setPointerCapture(event.pointerId);
      start(event);
    });
    element.addEventListener('pointermove', event => {
      if (shell.running && event.pointerId === active) move(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, event => { if (event.pointerId === active) release(); });
    }

    if (touchEvents) {
      element.addEventListener('touchstart', event => {
        if (!shell.running) return;
        event.preventDefault();
        if (active !== null) return;
        const touch = event.changedTouches[0];
        active = 'touch-' + touch.identifier;
        start(touch);
      }, { passive: false });
      for (const type of ['touchmove', 'touchend', 'touchcancel']) {
        element.addEventListener(type, event => {
          const touch = Array.from(event.changedTouches).find(touch => active === 'touch-' + touch.identifier);
          if (!touch) return;
          event.preventDefault();
          if (type === 'touchmove' && shell.running) move(touch);
          else release();
        }, { passive: false });
      }
    }
    return release;
  }

  let stickBox;
  function steer(point) {
    const dx = point.clientX - stickBox.x, dy = point.clientY - stickBox.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(stickBox.range, distance);
    const power = Math.max(0, (travel / stickBox.range - .10) / .90);
    const x = distance ? dx / distance : 0, y = distance ? dy / distance : 0;
    movement.strafe = x * power;
    movement.forward = -y * power;
    thumb.style.transform = 'translate(-50%,-50%) translate(' + (x * travel) + 'px,' + (y * travel) + 'px)';
  }
  const cancelJoystick = bindDrag(joystick, point => {
    const rect = joystick.getBoundingClientRect();
    stickBox = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, range: Math.max(1, rect.width * .30) };
    joystick.dataset.active = 'true';
    steer(point);
  }, steer, () => {
    movement.forward = movement.strafe = 0;
    joystick.dataset.active = 'false';
    thumb.style.transform = '';
  });

  let lookX = 0;
  const cancelLook = bindDrag(panel, point => { lookX = point.clientX; }, point => {
    game.turn((point.clientX - lookX) * .008);
    lookX = point.clientX;
    redraw = true;
  });

  function toggleFlashlight() {
    if (!shell.running) return;
    game.toggleLight();
    redraw = true;
  }
  lightButton.addEventListener('click', toggleFlashlight);

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
        forward: movement.forward + held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'),
        strafe: movement.strafe + held('KeyD') - held('KeyA'),
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
