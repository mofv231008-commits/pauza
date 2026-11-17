(function () {
  'use strict';

  const P = window.Pauza;
  const physics = window.PyramidPhysics;
  const byId = id => document.getElementById(id);
  const canvas = byId('table');
  const camera = byId('camera'), select = byId('select'), shoot = byId('shoot'), power = byId('power');
  const scene = window.PyramidScene.create(canvas);
  const shotLimit = 12, target = 8, timeStep = 1 / 240;
  const units = ['шар', 'шара', 'шаров'];
  let balls = physics.rack(), cue = balls[0], direction = { x: 0, z: -1 };
  let shots = 0, score = 0, fouls = 0, carry = 0, shot = null;
  let selecting = false, overhead = false, pointer = null;

  const shell = P.shell({
    id: 'pyramid3d',
    title: 'Русский бильярд 3D',
    tagline: 'Забей 8 шаров за 12 ударов.',
    startLabel: 'К столу',
    rulesHtml: '<p>Тренировка по мотивам свободной пирамиды. Коснись стола или веди пальцем для прицела. Выставь силу и нажми «Удар». После соударения засчитывается любой шар в лузе, даже биток. Удар без касания другого шара — фол. Меняй биток и ракурс кнопками под столом.</p>',
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
    score = shots = fouls = carry = 0;
    shot = null;
    selecting = false;
    pointer = null;
    power.value = '70';
    updatePower();
    shell.setScore(0);
    setStatus('Прицелься на столе');
    update();
  }

  function setStatus(message) {
    byId('status').textContent = message;
  }

  function update() {
    const playable = shell.running;
    const ready = playable && !shot;
    shoot.disabled = !ready || selecting;
    select.disabled = !ready;
    power.disabled = !ready;
    camera.disabled = !playable;
    select.setAttribute('aria-pressed', String(selecting));
    const left = shotLimit - shots;
    shell.setSide('Ударов: ' + left, left <= 3);
    scene.invalidate();
  }

  function updatePower() {
    byId('power-value').textContent = power.value + '%';
    scene.invalidate();
  }

  function startShot() {
    if (!shell.running || shot || selecting || shots >= shotLimit) return;
    const speed = .82 + Number(power.value) * .063;
    cue.vx = direction.x * speed;
    cue.vz = direction.z * speed;
    shots++;
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

    if (score >= target || shots === shotLimit) {
      update();
      shell.end({
        score,
        eyebrow: score >= target ? 'Пирамида взята' : 'Удары закончились',
        stats: 'Ударов: ' + shots + ' · Фолов: ' + fouls,
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
    if (!shell.running || shot || pointer !== null) return;
    event.preventDefault();
    const point = tablePoint(event);
    if (selecting) {
      chooseAt(point);
      return;
    }
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    aimAt(point);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer === event.pointerId && shell.running && !shot) aimAt(tablePoint(event));
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (pointer === event.pointerId) pointer = null;
    });
  }

  camera.addEventListener('click', () => {
    overhead = !overhead;
    camera.textContent = overhead ? 'Вид в 3D' : 'Вид сверху';
    camera.setAttribute('aria-pressed', String(overhead));
    scene.setOverhead(overhead);
  });
  select.addEventListener('click', () => {
    selecting = !selecting;
    setStatus(selecting ? 'Коснись шара, который станет битком' : 'Прицелься на столе');
    update();
  });
  power.addEventListener('input', updatePower);
  shoot.addEventListener('click', startShot);
  window.addEventListener('keydown', event => {
    if (!shell.running || shot || selecting || /^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
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
    scene.draw(balls, cue, direction, Number(power.value), shell.running && !shot, selecting, dt, Boolean(shot && shell.running));
  });
})();
