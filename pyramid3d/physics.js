(function (root) {
  'use strict';

  const width = 1;
  const length = 2;
  const radius = .049;
  const timeStep = 1 / 240;
  const restSpeed = .023;
  const cushionInset = .051;
  const faceX = width - cushionInset;
  const faceZ = length - cushionInset;
  const cushionX = faceX - radius - .006;
  const cushionZ = faceZ - radius - .006;
  const pockets = [-1, 1].flatMap(side => [
    { x: side * faceX, z: -faceZ, mouth: .094 },
    { x: side * faceX, z: 0, mouth: .076 },
    { x: side * faceX, z: faceZ, mouth: .094 }
  ]);

  function ball(id, x, z) {
    return { id, x, z, vx: 0, vz: 0, pocketed: false };
  }

  function rack() {
    const balls = [ball(0, 0, 1)];
    const spacing = radius * 2.06;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        balls.push(ball(balls.length, (col - row / 2) * spacing, -1 + row * -spacing * Math.sqrt(3) / 2));
      }
    }
    return balls;
  }

  function rail(ball, axis, limit, velocity) {
    if (Math.abs(ball[axis]) < limit) return false;
    const sign = Math.sign(ball[axis]);
    ball[axis] = sign * limit;
    if (sign * ball[velocity] <= 0) return false;
    ball[velocity] *= -.78;
    return true;
  }

  function roll(ball, dt) {
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    const speed = Math.hypot(ball.vx, ball.vz);
    if (speed) {
      const friction = Math.max(0, 1 - (.32 / speed + .18) * dt);
      ball.vx *= friction;
      ball.vz *= friction;
    }
  }

  function resolveTable(ball) {
    const inPocket = pockets.some(({ x, z, mouth }) =>
      (ball.x - x) ** 2 + (ball.z - z) ** 2 < mouth ** 2);
    if (inPocket) {
      ball.pocketed = true;
      ball.vx = ball.vz = 0;
      return null;
    }
    const hitSide = rail(ball, 'x', cushionX, 'vx');
    const hitEnd = rail(ball, 'z', cushionZ, 'vz');
    if (hitSide || hitEnd) {
      return {
        x: hitSide ? Math.sign(ball.x) * faceX : ball.x,
        z: hitEnd ? Math.sign(ball.z) * faceZ : ball.z
      };
    }
    return null;
  }

  function launchSpeed(power) {
    return .82 + power * .063;
  }

  function advance(balls, dt, onContact, onPocket) {
    const live = balls.filter(ball => !ball.pocketed);
    for (const ball of live) roll(ball, dt);

    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= radius * 2) continue;
        const nx = distance ? dx / distance : 1;
        const nz = distance ? dz / distance : 0;
        const overlap = (radius * 2 - distance) / 2;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;
        const approach = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (approach <= 0) continue;
        const impulse = approach * .97;
        a.vx -= impulse * nx;
        a.vz -= impulse * nz;
        b.vx += impulse * nx;
        b.vz += impulse * nz;
        onContact(a, b);
      }
    }

    for (const ball of live) {
      resolveTable(ball);
      if (ball.pocketed) onPocket(ball);
    }
  }

  function respot(ball, balls) {
    // The grid has more spaced positions than a rack can block.
    for (let row = 0; row < 15; row++) {
      const z = .98 - row * .18;
      for (const x of [0, -.22, .22, -.44, .44]) {
        if (balls.some(other => other !== ball && !other.pocketed &&
          Math.hypot(other.x - x, other.z - z) < radius * 2.1)) continue;
        Object.assign(ball, { x, z, vx: 0, vz: 0, pocketed: false });
        return;
      }
    }
  }

  // Follow the same friction, pocket and bounce rules as a shot until the first ball or second cushion.
  function aimPath(cue, direction, balls, power) {
    const probe = ball(cue.id, cue.x, cue.z);
    const speed = launchSpeed(power);
    probe.vx = direction.x * speed;
    probe.vz = direction.z * speed;
    const targets = balls.filter(ball => ball !== cue && !ball.pocketed);
    const contactDistance = (2 * radius) ** 2;
    const path = [];
    while (Math.hypot(probe.vx, probe.vz) >= restSpeed) {
      roll(probe, timeStep);
      if (targets.some(ball => (ball.x - probe.x) ** 2 + (ball.z - probe.z) ** 2 < contactDistance)) break;
      const edge = resolveTable(probe);
      if (edge) {
        path.push({ x: probe.x, z: probe.z, edge });
        if (path.length === 2) return path;
      }
      if (probe.pocketed) break;
    }
    path.push({ x: probe.x, z: probe.z });
    return path;
  }

  root.PyramidPhysics = {
    width, length, radius, faceX, faceZ, pockets, timeStep, restSpeed,
    rack, launchSpeed, advance, respot, aimPath
  };
})(globalThis);
