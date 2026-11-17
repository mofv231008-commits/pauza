(function (root) {
  'use strict';

  const width = 1;
  const length = 2;
  const radius = .049;
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
    if (Math.abs(ball[axis]) < limit) return;
    const sign = Math.sign(ball[axis]);
    ball[axis] = sign * limit;
    if (sign * ball[velocity] > 0) ball[velocity] *= -.78;
  }

  function advance(balls, dt, onContact, onPocket) {
    const live = balls.filter(ball => !ball.pocketed);
    for (const ball of live) {
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      const speed = Math.hypot(ball.vx, ball.vz);
      if (speed) {
        const friction = Math.max(0, 1 - (.32 / speed + .18) * dt);
        ball.vx *= friction;
        ball.vz *= friction;
      }
    }

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
      const inPocket = pockets.some(({ x, z, mouth }) =>
        (ball.x - x) ** 2 + (ball.z - z) ** 2 < mouth ** 2);
      if (inPocket) {
        ball.pocketed = true;
        ball.vx = ball.vz = 0;
        onPocket(ball);
        continue;
      }
      rail(ball, 'x', cushionX, 'vx');
      rail(ball, 'z', cushionZ, 'vz');
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

  function aimLine(cue, direction, balls) {
    const rayX = direction.x > 0 ? cushionX : -cushionX;
    const rayZ = direction.z > 0 ? cushionZ : -cushionZ;
    const toX = direction.x ? (rayX - cue.x) / direction.x : Infinity;
    const toZ = direction.z ? (rayZ - cue.z) / direction.z : Infinity;
    let distance = Math.min(toX, toZ);
    for (const ball of balls) {
      if (ball === cue || ball.pocketed) continue;
      const x = ball.x - cue.x;
      const z = ball.z - cue.z;
      const forward = x * direction.x + z * direction.z;
      const cross = x * direction.z - z * direction.x;
      if (forward > 0 && Math.abs(cross) < radius * 2) {
        distance = Math.min(distance, Math.max(0, forward - Math.sqrt((radius * 2) ** 2 - cross ** 2)));
      }
    }
    return { x: cue.x + direction.x * distance, z: cue.z + direction.z * distance };
  }

  root.PyramidPhysics = { width, length, radius, faceX, faceZ, pockets, rack, advance, respot, aimLine };
})(globalThis);
