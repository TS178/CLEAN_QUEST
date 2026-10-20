/*
 * プラごみバスターズ：ルールと けいさん（画面に たよらない。tests/plabusters.test.mjs で たしかめる）
 * ------------------------------------------------------------
 * 60びょうの あいだ、はまべに あらわれる「プラごみかいじゅう」を、ただしい ゴミばこの ボタンで じょうかする。
 *   - ふつうの かいじゅう … 入れる ゴミばこ（js/trash.js の BINS と おなじ 3つ）を おす。まちがえると コンボが きれて すこし うごけない
 *   - おおがた かいじゅう … ふつうの かいじゅうを bossEvery たい（3〜4たい）じょうかする ごとに あらわれる。bossTime びょうの あいだに 10かい タップ
 *   - あぶない かいじゅう（われた びん）… ゴミばこの ボタンを おさない。「おとなを よぶ」か、さわらずに みおくると ボーナス
 *   - コンボゲージが いっぱいに なると「ひっさつ クリーンビーム」。カットインの あいだは とけいが とまり、つぎの かいじゅうを いっきに じょうか
 * 1かいの あそびは round（ただの オブジェクト）。advance(round, びょう) で じかんを すすめ、press / tap で そうさする。
 * どれも できごと（events）の はいれつを かえすので、画面（js/plabusters.js）は それを 見て 演出する。
 * らんすうは runId から つくるので、おなじ runId なら おなじ ながれに なる（テストで つかう）。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});

  // ---- かずの 設定（ここを かえれば 調整 できる） ----
  const C = Object.freeze({
    duration: 60,          // せいげん じかん（びょう）
    spawnGap: 0.35,        // じょうかして から つぎが でるまで
    bossIntro: 0.9,        // 「おおがた かいじゅうが きた！」の あいだ
    bossEvery: [3, 4],     // なんたい ごとに おおがた（この あいだで らんすう）
    bossHp: 10,            // おおがたの タップ かいすう
    bossTime: 5,           // おおがたを たおす せいげん じかん
    dangerFrom: 4,         // なんたいめ から あぶない かいじゅうが でるか
    dangerRate: 0.14,      // あぶない かいじゅうが でる わりあい
    dangerTtl: 2.4,        // さわらずに みおくる じかん
    stun: 0.6,             // まちがえた ときに うごけない じかん
    cutin: 1.6,            // ひっさつわざの カットイン（この あいだ とけいは とまる）
    gaugeMax: 100,
    gauge: { hit: 10, danger: 15, boss: 25 },
    // てんすう
    score: { hit: 100, comboStep: 10, comboCap: 20, speedMax: 90, bossTap: 20, boss: 600, bossTimeBonus: 50, danger: 250, beam: 500 },
    // ほし（てんすう）と メダル。★3 の てんすうが「はまべの きれいど 100%」
    stars: [3000, 10000, 18000],   // 試算（2026-10-20）：はじめての こども ★1、ふつう ★2、なれた こども ★3 が おおい
    coins: [0, 10, 20, 35],
    perfect: { mult: 1.5, multStar3: 2 }, // いちども まちがえずに ★1いじょう
  });

  // ふつうの かいじゅう（ゴミの しゅるいは js/trash.js の BEACH_TRASH）
  const MONSTERS = {
    b_bottle: "ペットボトル かいじゅう",
    b_bag: "ビニールぶくろ おばけ",
    b_can: "カンカン モンスター",
    b_glass: "ビンビン くん",
    b_wood: "えだえだ マン",
    b_rope: "ロープ へびー",
  };
  const BOSSES = [
    { kind: "b_bag", name: "キング ビニールおばけ" },
    { kind: "b_bottle", name: "メガ ペットボトルかいじゅう" },
  ];
  const DANGER = { kind: "b_glass", name: "われびん かいじゅう" };

  // ---- らんすう（runId から きまる） ----
  function seedOf(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rand(round) {
    let t = (round.rng = (round.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const binOf = (kind) => { const t = BCT.beachTrashOf && BCT.beachTrashOf(kind); return t ? t.bin : null; };

  function create(runId) {
    const r = {
      runId: String(runId), phase: "ready", time: 0, cutin: 0, rng: seedOf(String(runId)),
      monster: null, spawnIn: 0.4, stunUntil: 0, seq: 0, sinceBoss: 0, bossEvery: 4, lastKinds: [],
      score: 0, combo: 0, maxCombo: 0, gauge: 0, nextId: 1,
      stats: { defeated: 0, bosses: 0, bossEscaped: 0, dangers: 0, dangersAvoided: 0, mistakes: 0, beams: 0, taps: 0 },
    };
    r.bossEvery = pickBossEvery(r);
    return r;
  }
  function pickBossEvery(r) { const [a, b] = C.bossEvery; return a + Math.floor(rand(r) * (b - a + 1)); }

  function spawn(r) {
    r.seq++;
    const id = r.nextId++;
    const force = r.forceNext; // 確認用（tests）：つぎの かいじゅうの しゅるいを きめる
    r.forceNext = null;
    if (force === "danger") {
      r.monster = { id, type: "danger", kind: DANGER.kind, name: DANGER.name, bin: null, age: 0 };
      r.stats.dangers++;
    } else if (r.sinceBoss >= r.bossEvery) {
      const b = BOSSES[r.stats.bosses % BOSSES.length];
      r.monster = { id, type: "boss", kind: b.kind, name: b.name, bin: null, hp: C.bossHp, age: 0 };
    } else if (r.seq > C.dangerFrom && (!r.lastType || r.lastType === "normal") && rand(r) < C.dangerRate) {
      r.monster = { id, type: "danger", kind: DANGER.kind, name: DANGER.name, bin: null, age: 0 };
      r.stats.dangers++;
    } else {
      const kinds = Object.keys(MONSTERS).filter((k) => !(r.lastKinds.length >= 2 && r.lastKinds.every((x) => x === k)));
      const kind = kinds[Math.floor(rand(r) * kinds.length)];
      r.lastKinds = [kind].concat(r.lastKinds).slice(0, 2);
      r.monster = { id, type: "normal", kind, name: MONSTERS[kind], bin: binOf(kind), age: 0 };
    }
    r.lastType = r.monster.type;
    return { type: "spawn", monster: r.monster };
  }

  // つぎの かいじゅうまでの まち
  function cleared(r, events) {
    r.monster = null;
    r.spawnIn = r.sinceBoss >= r.bossEvery ? C.bossIntro : C.spawnGap;
    if (r.sinceBoss >= r.bossEvery) events.push({ type: "bossComing" });
  }
  function addCombo(r) { r.combo++; r.maxCombo = Math.max(r.maxCombo, r.combo); }
  function addGauge(r, n, events) {
    r.gauge = Math.min(C.gaugeMax, r.gauge + n);
    if (r.gauge >= C.gaugeMax && !r.cutin) {
      // ひっさつわざ：つぎの かいじゅうを すぐ だして、カットインの あとに じょうか
      r.gauge = 0;
      r.stats.beams++;
      if (!r.monster) events.push(spawn(r));
      r.cutin = C.cutin;
      events.push({ type: "beamStart", monster: r.monster });
    }
  }
  function miss(r, events, reason) {
    r.combo = 0;
    r.stats.mistakes++;
    r.gauge = Math.floor(r.gauge / 2);
    r.stunUntil = r.time + C.stun;
    events.push({ type: "miss", reason, monster: r.monster });
  }

  // ふつうの かいじゅうを じょうか
  function defeatNormal(r, events, by) {
    const m = r.monster;
    const S = C.score;
    const speed = Math.round(Math.max(0, 1.5 - m.age) / 1.5 * S.speedMax);
    const gain = S.hit + Math.min(r.combo, S.comboCap) * S.comboStep + speed + (by === "beam" ? S.beam : 0);
    r.score += gain;
    addCombo(r);
    r.stats.defeated++;
    r.sinceBoss++;
    events.push({ type: by === "beam" ? "beamHit" : "hit", monster: m, gain, combo: r.combo });
    cleared(r, events);
    if (by !== "beam") addGauge(r, C.gauge.hit, events);
  }
  function defeatBoss(r, events, by) {
    const m = r.monster;
    const S = C.score;
    const gain = S.boss + Math.round(Math.max(0, C.bossTime - m.age) * S.bossTimeBonus) + (by === "beam" ? S.beam : 0);
    r.score += gain;
    addCombo(r);
    r.stats.bosses++;
    r.sinceBoss = 0;
    r.bossEvery = pickBossEvery(r);
    events.push({ type: by === "beam" ? "beamHit" : "bossDown", monster: m, gain, combo: r.combo });
    cleared(r, events);
    if (by !== "beam") addGauge(r, C.gauge.boss, events);
  }
  function avoidDanger(r, events, how) {
    const m = r.monster;
    const gain = C.score.danger + (how === "beam" ? C.score.beam : 0);
    r.score += gain;
    addCombo(r);
    r.stats.dangersAvoided++;
    events.push({ type: how === "beam" ? "beamHit" : "dangerSafe", how, monster: m, gain, combo: r.combo });
    cleared(r, events);
    if (how !== "beam") addGauge(r, C.gauge.danger, events);
  }

  // じかんを すすめる（dt びょう）
  function advance(r, dt) {
    const events = [];
    if (r.phase !== "playing") return events;
    dt = Math.max(0, Math.min(0.25, Number(dt) || 0)); // うらに まわった あと などの 大きな とびを ふせぐ
    if (r.cutin > 0) {
      r.cutin -= dt;
      if (r.cutin <= 0) {
        r.cutin = 0;
        const m = r.monster;
        if (m && m.type === "boss") defeatBoss(r, events, "beam");
        else if (m && m.type === "danger") avoidDanger(r, events, "beam");
        else if (m) defeatNormal(r, events, "beam");
        events.push({ type: "beamEnd" });
      }
      return events; // カットインの あいだ とけいは とまる
    }
    r.time += dt;
    if (r.time >= C.duration) {
      r.time = C.duration;
      r.phase = "result";
      if (r.monster && r.monster.type === "boss") r.stats.bossEscaped++;
      r.monster = null;
      events.push({ type: "end" });
      return events;
    }
    const m = r.monster;
    if (!m) {
      r.spawnIn -= dt;
      if (r.spawnIn <= 0) events.push(spawn(r));
      return events;
    }
    m.age += dt;
    if (m.type === "danger" && m.age >= C.dangerTtl) avoidDanger(r, events, "pass");
    else if (m.type === "boss" && m.age >= C.bossTime) {
      r.stats.bossEscaped++;
      r.sinceBoss = 0;
      r.bossEvery = pickBossEvery(r);
      events.push({ type: "bossEscape", monster: m });
      cleared(r, events);
    }
    return events;
  }

  // ボタンを おす（choice … ゴミばこの key か "adult"＝おとなを よぶ）。おおがたの ときは どの ボタンも タップに なる
  function press(r, choice) {
    const events = [];
    const m = r.monster;
    if (r.phase !== "playing" || r.cutin > 0 || !m) return events;
    if (m.type === "boss") return tap(r);
    if (r.time < r.stunUntil) return events;
    if (m.type === "danger") {
      if (choice === "adult") avoidDanger(r, events, "adult");
      else {
        // あぶない ものに さわった：まちがい。かいじゅうは さる
        miss(r, events, "danger");
        r.stats.dangersTouched = (r.stats.dangersTouched || 0) + 1;
        cleared(r, events);
      }
      return events;
    }
    if (choice === m.bin) defeatNormal(r, events, "press");
    else miss(r, events, choice === "adult" ? "adult" : "wrongBin");
    return events;
  }

  // おおがた かいじゅうを タップ
  function tap(r) {
    const events = [];
    const m = r.monster;
    if (r.phase !== "playing" || r.cutin > 0 || !m || m.type !== "boss") return events;
    m.hp--;
    r.stats.taps++;
    r.score += C.score.bossTap;
    events.push({ type: "bossTap", monster: m, hp: m.hp });
    if (m.hp <= 0) defeatBoss(r, events, "tap");
    return events;
  }

  // けっか（ほし・メダル・はまべの きれいど）
  function result(r) {
    const st = r.stats;
    const score = Math.max(0, Math.floor(r.score));
    const stars = score >= C.stars[2] ? 3 : score >= C.stars[1] ? 2 : score >= C.stars[0] ? 1 : 0;
    const perfect = stars >= 1 && st.mistakes === 0;
    const base = C.coins[stars];
    const mult = perfect ? (stars === 3 ? C.perfect.multStar3 : C.perfect.mult) : 1;
    return {
      score, stars, perfect, baseCoins: base, mult, coins: Math.round(base * mult),
      defeated: st.defeated, bosses: st.bosses, dangersAvoided: st.dangersAvoided, mistakes: st.mistakes,
      beams: st.beams, maxCombo: r.maxCombo, clean: Math.min(100, Math.round((score / C.stars[2]) * 100)),
    };
  }

  BCT.plaBustersEngine = { C, MONSTERS, BOSSES, DANGER, create, advance, press, tap, result, binOf };
})();
