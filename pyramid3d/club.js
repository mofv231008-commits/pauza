(function () {
  'use strict';

  const P = window.Pauza;
  const physics = window.PyramidPhysics;
  const byId = id => document.getElementById(id);
  const canvas = byId('table');
  const camera = byId('camera'), select = byId('select');
  const rotateLeft = byId('rotate-left'), rotateRight = byId('rotate-right');
  const status = byId('status');
  const shoot = byId('shoot'), power = byId('power');
  const hasTouchEvents = 'ontouchstart' in window;
  const scene = window.PyramidScene.create(canvas);
  const { timeStep, restSpeed } = physics;
  const tapTolerance = 7;
  const units = ['шар', 'шара', 'шаров'];
  let balls = physics.rack(), cue = balls[0], direction = { x: 0, z: -1 };
  let score = 0, fouls = 0, carry = 0, shot = null;
  let selecting = false, overhead = false, gesture = null;

  const shell = P.shell({
    id: 'pyramid3d',
    title: 'Русский бильярд 3D',
    tagline: 'Свободная партия',
    startLabel: 'К столу',
    rulesHtml: '<p>Коснись стола или проведи пальцем по нему, чтобы навести кий. В 3D камеру поворачивают стрелки ↶ и ↷. Выставь силу и нажми «Удар». После соударения засчитывается любой шар, даже биток. Партия закончится, когда на столе останется только биток или не останется шаров.</p>',
    kbdHint: 'На клавиатуре: ← → прицел, Enter удар.',
    unit: n => P.plural(n, units),
    onReset: reset,
    onRun: () => { update(); canvas.focus({ preventScroll: true }); },
    onPause: () => { gesture = null; update(); }
  });

  function reset() {
    balls = physics.rack();
    cue = balls[0];
    direction = { x: 0, z: -1 };
    score = fouls = carry = 0;
    shot = null;
    selecting = false;
    gesture = null;
    power.value = '70';
    updatePower();
    shell.setScore(0);
    status.textContent = '';
    update();
  }

  function update() {
    const playable = shell.running;
    const ready = playable && !shot;
    shoot.disabled = !ready || selecting;
    select.disabled = !ready;
    power.disabled = !ready;
    camera.disabled = !playable;
    rotateLeft.disabled = rotateRight.disabled = !playable || overhead;
    select.setAttribute('aria-pressed', String(selecting));
    scene.invalidate();
  }

  function updatePower() {
    byId('power-value').textContent = power.value + '%';
    scene.invalidate();
  }

  function startShot() {
    if (!shell.running || shot || selecting) return;
    const speed = physics.launchSpeed(Number(power.value));
    cue.vx = direction.x * speed;
    cue.vz = direction.z * speed;
    carry = 0;
    shot = { contact: false, potted: [] };
    gesture = null;
    status.textContent = 'Шары в движении';
    P.haptic('tap');
    update();
  }

  function settleShot() {
    const { contact, potted } = shot;
    shot = null;
    for (const ball of balls) ball.vx = ball.vz = 0;
    if (contact) {
      score += potted.length;
      shell.setScore(score);
      status.textContent = potted.length ? 'В лузе: +' + potted.length : 'Стол готов к следующему удару';
      if (potted.length) P.haptic('win');
    } else {
      fouls++;
      for (const ball of potted) physics.respot(ball, balls);
      status.textContent = 'Фол: биток не коснулся другого шара';
    }

    const remaining = balls.filter(ball => !ball.pocketed);
    if (remaining.length <= 1) {
      update();
      shell.end({
        score,
        eyebrow: 'Партия сыграна',
        stats: 'Фолов: ' + fouls,
        phrase: 'В «Русском бильярде 3D» я забил ' + score + ' ' + P.plural(score, units) + '. Сыграешь?'
      });
      return;
    }

    if (cue.pocketed) cue = remaining[0];
    const toCenter = Math.hypot(cue.x, cue.z);
    if (toCenter > physics.radius) direction = { x: -cue.x / toCenter, z: -cue.z / toCenter };
    update();
  }

  function tablePoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function aimAt(point) {
    const target = scene.unproject(point.x, point.y);
    const x = target.x - cue.x, z = target.z - cue.z;
    const length = Math.hypot(x, z);
    if (!Number.isFinite(length) || length < physics.radius * 1.25) return;
    direction = { x: x / length, z: z / length };
    scene.invalidate();
  }

  function chooseAt(point) {
    let best = null, nearest = 25;
    for (const ball of balls) {
      if (ball.pocketed) continue;
      const p = scene.project(ball.x, physics.radius, ball.z);
      const distance = Math.hypot(point.x - p.x, point.y - p.y);
      if (distance < nearest) {
        nearest = distance;
        best = ball;
      }
    }
    if (!best) return;
    cue = best;
    selecting = false;
    status.textContent = 'Биток выбран';
    update();
  }

  function beginGesture(id, point) {
    gesture = { id, start: point, moved: false };
    if (!shot && !selecting) aimAt(point);
  }

  function moveGesture(point) {
    if (selecting) {
      gesture.moved ||= Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= tapTolerance;
    } else if (!shot) {
      aimAt(point);
    }
  }

  function finishGesture(point) {
    if (!shot) {
      moveGesture(point);
      if (selecting && !gesture.moved) chooseAt(point);
    }
    gesture = null;
  }

  canvas.addEventListener('pointerdown', event => {
    if (!shell.running || shot || gesture || event.button !== 0 ||
      (hasTouchEvents && event.pointerType === 'touch')) return;
    event.preventDefault();
    beginGesture(event.pointerId, tablePoint(event));
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (gesture?.id === event.pointerId) moveGesture(tablePoint(event));
  });
  canvas.addEventListener('pointerup', event => {
    if (gesture?.id === event.pointerId) finishGesture(tablePoint(event));
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (gesture?.id === event.pointerId) gesture = null;
    });
  }

  // Keeping touch gestures on the canvas also prevents the WebView from taking a drag as page scrolling.
  if (hasTouchEvents) {
    canvas.addEventListener('touchstart', event => {
      if (!shell.running || shot) return;
      event.preventDefault();
      if (gesture) return;
      const touch = event.changedTouches[0];
      beginGesture('touch-' + touch.identifier, tablePoint(touch));
    }, { passive: false });
    for (const type of ['touchmove', 'touchend', 'touchcancel']) {
      canvas.addEventListener(type, event => {
        const touch = Array.from(event.changedTouches).find(item => gesture?.id === 'touch-' + item.identifier);
        if (!touch) return;
        event.preventDefault();
        if (type === 'touchmove') moveGesture(tablePoint(touch));
        else if (type === 'touchend') finishGesture(tablePoint(touch));
        else gesture = null;
      }, { passive: false });
    }
  }

  camera.addEventListener('click', () => {
    overhead = !overhead;
    gesture = null;
    camera.textContent = overhead ? 'Вид в 3D' : 'Вид сверху';
    camera.setAttribute('aria-pressed', String(overhead));
    scene.setOverhead(overhead);
    update();
  });
  function rotateCamera(angle) {
    if (!shell.running || overhead) return;
    gesture = null;
    scene.rotate(angle);
  }
  rotateLeft.addEventListener('click', () => rotateCamera(-Math.PI / 6));
  rotateRight.addEventListener('click', () => rotateCamera(Math.PI / 6));
  select.addEventListener('click', () => {
    selecting = !selecting;
    status.textContent = selecting ? 'Коснись шара, который станет битком' : '';
    update();
  });
  power.addEventListener('input', updatePower);
  shoot.addEventListener('click', startShot);
  window.addEventListener('keydown', event => {
    if (!shell.running || selecting || /^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
    if (shot) return;
    if (event.code === 'Enter' && !event.repeat) {
      event.preventDefault();
      startShot();
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      const angle = Math.atan2(direction.x, -direction.z) + (event.code === 'ArrowLeft' ? -.027 : .027);
      direction = { x: Math.sin(angle), z: -Math.cos(angle) };
      scene.invalidate();
    }
  });

  update();
  P.loop(dt => {
    if (shot && shell.running) {
      carry += dt;
      while (carry >= timeStep) {
        carry -= timeStep;
        physics.advance(balls, timeStep, (a, b) => {
          if (a === cue || b === cue) shot.contact = true;
        }, ball => shot.potted.push(ball));
      }
      if (balls.every(ball => Math.hypot(ball.vx, ball.vz) < restSpeed)) settleShot();
    }
    scene.draw(balls, cue, direction, Number(power.value), shell.running && !shot, selecting, dt, Boolean(shot && shell.running));
  });
})();
