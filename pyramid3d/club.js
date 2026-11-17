(function () {
  'use strict';

  const P = window.Pauza;
  const physics = window.PyramidPhysics;
  const byId = id => document.getElementById(id);
  const canvas = byId('table');
  const camera = byId('camera'), orbit = byId('orbit'), select = byId('select');
  const shoot = byId('shoot'), power = byId('power');
  const aimHint = 'Прицелься на столе';
  const cameraHint = 'Веди по столу, чтобы повернуть камеру';
  const scene = window.PyramidScene.create(canvas);
  const target = 8, timeStep = 1 / 240;
  const units = ['шар', 'шара', 'шаров'];
  let balls = physics.rack(), cue = balls[0], direction = { x: 0, z: -1 };
  let score = 0, fouls = 0, carry = 0, shot = null;
  let selecting = false, overhead = false, orbiting = false, pointer = null;
  let status = aimHint;

  const shell = P.shell({
    id: 'pyramid3d',
    title: 'Русский бильярд 3D',
    tagline: 'Забей 8 шаров в своём темпе.',
    startLabel: 'К столу',
    rulesHtml: '<p>Тренировка по мотивам свободной пирамиды. Коснись стола или веди пальцем для прицела. Выставь силу и нажми «Удар». После соударения засчитывается любой шар в лузе, даже биток. Удар без касания другого шара — фол. Кнопка «Камера» позволяет поворачивать стол пальцем. Для точного прицела включи вид сверху.</p>',
    kbdHint: 'На клавиатуре: ← → прицел, Enter удар.',
    unit: n => P.plural(n, units),
    onReset: reset,
    onRun: () => { update(); canvas.focus({ preventScroll: true }); },
    onPause: () => { pointer = null; update(); }
  });

  function reset() {
    balls = physics.rack();
    cue = balls[0];
    direction = { x: 0, z: -1 };
    score = fouls = carry = 0;
    shot = null;
    selecting = orbiting = false;
    pointer = null;
    power.value = '70';
    updatePower();
    shell.setScore(0);
    setStatus(aimHint);
    update();
  }

  function setStatus(message) {
    status = message;
    refreshStatus();
  }

  function refreshStatus() {
    byId('status').textContent = orbiting ? cameraHint : status;
  }

  function update() {
    const playable = shell.running;
    const ready = playable && !shot;
    shoot.disabled = !ready || selecting || orbiting;
    select.disabled = !ready || orbiting;
    power.disabled = !ready || orbiting;
    camera.disabled = !playable;
    orbit.disabled = !playable || overhead;
    orbit.setAttribute('aria-pressed', String(orbiting));
    select.setAttribute('aria-pressed', String(selecting));
    canvas.dataset.orbit = String(orbiting);
    shell.setSide('Цель: ' + target);
    scene.invalidate();
  }

  function updatePower() {
    byId('power-value').textContent = power.value + '%';
    scene.invalidate();
  }

  function startShot() {
    if (!shell.running || shot || selecting || orbiting) return;
    const speed = .82 + Number(power.value) * .063;
    cue.vx = direction.x * speed;
    cue.vz = direction.z * speed;
    carry = 0;
    shot = { contact: false, potted: [] };
    pointer = null;
    setStatus('Шары в движении');
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
      setStatus(potted.length ? 'В лузе: +' + potted.length : 'Стол готов к следующему удару');
      if (potted.length) P.haptic('win');
    } else {
      fouls++;
      for (const ball of potted) physics.respot(ball, balls);
      setStatus('Фол: биток не коснулся другого шара');
    }

    if (score >= target) {
      update();
      shell.end({
        score,
        eyebrow: 'Пирамида взята',
        stats: 'Фолов: ' + fouls,
        phrase: 'В «Русском бильярде 3D» я забил ' + score + ' ' + P.plural(score, units) + '. Сыграешь?'
      });
      return;
    }

    if (cue.pocketed) cue = balls.find(ball => !ball.pocketed);
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
    setStatus('Биток выбран. Прицелься.');
    update();
  }

  canvas.addEventListener('pointerdown', event => {
    if (!shell.running || (shot && !orbiting) || pointer || event.button !== 0) return;
    event.preventDefault();
    const point = tablePoint(event);
    if (selecting) {
      chooseAt(point);
      return;
    }
    pointer = { id: event.pointerId, point };
    canvas.setPointerCapture(pointer.id);
    if (!orbiting) aimAt(point);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId || !shell.running) return;
    const point = tablePoint(event);
    if (orbiting) scene.orbit(point.x - pointer.point.x, point.y - pointer.point.y);
    else if (!shot) aimAt(point);
    pointer.point = point;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (pointer?.id === event.pointerId) pointer = null;
    });
  }

  camera.addEventListener('click', () => {
    overhead = !overhead;
    orbiting = false;
    pointer = null;
    camera.textContent = overhead ? 'Вид в 3D' : 'Вид сверху';
    camera.setAttribute('aria-pressed', String(overhead));
    scene.setOverhead(overhead);
    refreshStatus();
    update();
  });
  orbit.addEventListener('click', () => {
    orbiting = !orbiting;
    pointer = null;
    if (selecting) {
      selecting = false;
      setStatus(aimHint);
    } else {
      refreshStatus();
    }
    if (orbiting) canvas.focus({ preventScroll: true });
    update();
  });
  select.addEventListener('click', () => {
    selecting = !selecting;
    setStatus(selecting ? 'Коснись шара, который станет битком' : aimHint);
    update();
  });
  power.addEventListener('input', updatePower);
  shoot.addEventListener('click', startShot);
  window.addEventListener('keydown', event => {
    if (!shell.running || selecting || /^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
    if (orbiting) {
      const arrows = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
      if (arrows[event.code]) {
        event.preventDefault();
        scene.orbit(...arrows[event.code]);
      }
      return;
    }
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
      if (balls.every(ball => Math.hypot(ball.vx, ball.vz) < .023)) settleShot();
    }
    scene.draw(balls, cue, direction, Number(power.value), shell.running && !shot && !orbiting, selecting, dt, Boolean(shot && shell.running));
  });
})();
