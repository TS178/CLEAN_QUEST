/* Pure, deterministic 2.5D ballistics. x = left/right, d = inland, h = height. */
(function () {
  const B = window.BCT;
  const C = Object.freeze({ duration: 60, width: 360, height: 520, launchX: 180, launchY: 385,
    gravity: 480, lift: 275, openingHeight: 58, roadDepth: 273, halfWidth: 29, halfDepth: 23, rimAllowance: 3,
    maxPull: 116, velocityScale: 3.2, star2: 600, star3: 1200 });
  const truckX = t => 180 + 101 * Math.sin(t * .65 + .004 * t * t);
  const trashKinds = Object.freeze(B.BEACH_TRASH.map(t => t.key));
  const flightTime = 2 * C.lift / C.gravity;
  const point = (shot, age) => ({ x: C.launchX + shot.vx * age, d: shot.vd * age,
    h: C.lift * age - C.gravity * age * age / 2 });
  const crossing = (C.lift + Math.sqrt(C.lift ** 2 - 2 * C.gravity * C.openingHeight)) / C.gravity;
  function aim(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || dy < 14) return null;
    const scale = Math.min(1, C.maxPull / Math.hypot(dx, dy));
    return { vx: -dx * scale * C.velocityScale, vd: dy * scale * C.velocityScale,
      dx: dx * scale, dy: dy * scale };
  }
  function result(outcomes) {
    let score = 0, hits = 0, combo = 0, maxCombo = 0;
    for (const ok of outcomes) {
      if (ok) { hits++; combo++; maxCombo = Math.max(maxCombo, combo); score += 100 + Math.min(100, (combo - 1) * 20); }
      else combo = 0;
    }
    const misses = outcomes.length - hits;
    const stars = !hits ? 0 : score >= C.star3 && misses === 0 ? 3 : score >= C.star2 ? 2 : 1;
    const bonus = Math.min(10, Math.floor(maxCombo / 3));
    return { score, hits, misses, shots: outcomes.length, combo, maxCombo, stars,
      baseCoins: [0, 10, 25, 50][stars], bonus, coins: [0, 10, 25, 50][stars] + bonus };
  }
  function create(runId) {
    return { runId, phase: 'ready', time: 0, shots: [], fired: 0, outcomes: [], feedback: null, aim: null };
  }
  function fire(s, direction) {
    if (s.phase !== 'playing' || s.time >= C.duration || !direction) return false;
    s.shots.push({ ...direction, start: s.time, checked: false, id: s.fired,
      kind: s.fired++ % trashKinds.length });
    s.aim = null;
    return true;
  }
  function advance(s, dt) {
    if (!['playing', 'settling'].includes(s.phase)) return [];
    s.time += Math.max(0, dt);
    const events = [];
    if (s.time >= C.duration) { s.phase = 'settling'; s.aim = null; }
    const resolved = [];
    s.shots = s.shots.filter(shot => {
      const age = s.time - shot.start;
      if (!shot.checked && age >= crossing) {
        shot.checked = true;
        const p = point(shot, crossing);
        // Evaluate both moving bodies at the exact crossing, even after a slow frame.
        // Count rim grazes too; the trash does not need to fit entirely inside the opening.
        if (Math.abs(p.x - truckX(shot.start + crossing)) <= C.halfWidth + C.rimAllowance && Math.abs(p.d - C.roadDepth) <= C.halfDepth + C.rimAllowance) {
          resolved.push({ ok: true, at: shot.start + crossing, id: shot.id, kind: shot.kind,
            x: p.x, y: C.launchY - p.d - p.h });
          return false;
        }
      }
      if (age >= flightTime) {
        resolved.push({ ok: false, at: shot.start + flightTime, id: shot.id, kind: shot.kind,
          x: Math.max(25, Math.min(335, point(shot, flightTime).x)), y: 240 });
        return false;
      }
      return true;
    });
    // Resolve by arrival time, even when one slow frame contains several landings.
    resolved.sort((a,b) => a.at - b.at || a.id - b.id);
    for (const feedback of resolved) {
      s.outcomes.push(feedback.ok); s.feedback = feedback;
      events.push(feedback.ok ? 'hit' : 'miss');
    }
    if (s.phase === 'settling' && !s.shots.length) { s.phase = 'result'; events.push('end'); }
    return events;
  }
  B.truckPhysics = { C, truckX, point, crossing, flightTime, trashKinds, aim, result, create, fire, advance };
})();
