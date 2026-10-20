// プラごみバスターズの ルールと けいさん（ブラウザ不要）
//   node --test tests/plabusters.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function load() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const f of ["js/trash.js", "js/plabusters-engine.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
  return ctx.window.BCT;
}
const BCT = load();
const E = BCT.plaBustersEngine, C = E.C;

// あそびを はじめて、かいじゅうが でるまで すすめる
function start(id = "test-1") {
  const r = E.create(id);
  r.phase = "playing";
  until(r, () => r.monster);
  return r;
}
function until(r, cond, max = 3000) {
  const events = [];
  for (let i = 0; i < max && !cond() && r.phase === "playing"; i++) events.push(...E.advance(r, 1 / 30));
  return events;
}
// いまの ふつうの かいじゅうを ただしく じょうかして、つぎが でるまで すすめる
function clearNormal(r) {
  assert.equal(r.monster.type, "normal");
  const ev = E.press(r, r.monster.bin);
  until(r, () => r.monster || r.cutin > 0);
  return ev;
}
// ふつうの かいじゅうが でるまで（おおがた・あぶない を かたづけて）すすめる
function toNormal(r) {
  for (let i = 0; i < 20 && r.monster && r.monster.type !== "normal"; i++) {
    if (r.monster.type === "boss") for (let k = 0; k < C.bossHp; k++) E.tap(r);
    else E.press(r, "adult");
    until(r, () => (r.monster || r.cutin > 0) && !(r.cutin > 0) );
  }
}

test("ゴミの しゅるいと ゴミばこは ホームの ビーチと おなじ（js/trash.js）", () => {
  for (const kind of Object.keys(E.MONSTERS)) {
    const t = BCT.beachTrashOf(kind);
    assert.ok(t, kind);
    assert.ok(BCT.binOf(t.bin), `${kind} の ゴミばこ`);
    assert.equal(E.binOf(kind), t.bin);
  }
  assert.ok(BCT.beachTrashOf(E.DANGER.kind), "あぶない かいじゅう（われた びん）の 絵");
});

test("おなじ runId なら おなじ ながれ（らんすうは runId から）", () => {
  const seq = (id) => { const r = start(id); const kinds = []; for (let i = 0; i < 12; i++) { kinds.push(r.monster.type + ":" + r.monster.kind); toNormal(r); if (r.monster && r.monster.type === "normal") clearNormal(r); } return kinds.join(","); };
  assert.equal(seq("same"), seq("same"));
  assert.notEqual(seq("same"), seq("other"));
});

test("ただしい ゴミばこ：てんすう・コンボ・ゲージが ふえる", () => {
  const r = start();
  const ev = E.press(r, r.monster.bin);
  const hit = ev.find((e) => e.type === "hit");
  assert.ok(hit);
  assert.ok(hit.gain >= C.score.hit && hit.gain <= C.score.hit + C.score.speedMax, `${hit.gain}`);
  assert.equal(r.combo, 1);
  assert.equal(r.gauge, C.gauge.hit);
  assert.equal(r.stats.defeated, 1);
  assert.equal(r.monster, null, "つぎの かいじゅうは すこし まってから");
});

test("はやく おすほど ボーナス、コンボで ふえる", () => {
  const fast = start("speed");
  const g1 = E.press(fast, fast.monster.bin).find((e) => e.type === "hit").gain;
  const slow = start("speed");
  until(slow, () => slow.monster.age >= 2);
  const g2 = E.press(slow, slow.monster.bin).find((e) => e.type === "hit").gain;
  assert.ok(g1 > g2, `${g1} > ${g2}`);
  assert.equal(g2, C.score.hit, "1.5びょう いじょうは スピード ボーナス なし");
});

test("まちがい：コンボが きれて ゲージが はんぶん・すこし うごけない・かいじゅうは のこる", () => {
  const r = start("miss");
  clearNormal(r); toNormal(r); clearNormal(r); toNormal(r);
  assert.equal(r.combo, 2);
  const gauge = r.gauge, id = r.monster.id;
  const wrong = C.bossEvery && BCT.BINS.map((b) => b.key).find((k) => k !== r.monster.bin);
  const ev = E.press(r, wrong);
  assert.ok(ev.find((e) => e.type === "miss" && e.reason === "wrongBin"));
  assert.equal(r.combo, 0);
  assert.equal(r.gauge, Math.floor(gauge / 2));
  assert.equal(r.stats.mistakes, 1);
  assert.equal(r.monster.id, id, "かいじゅうは のこる");
  assert.equal(E.press(r, r.monster.bin).length, 0, "うごけない あいだは おせない");
  until(r, () => r.time >= r.stunUntil);
  assert.ok(E.press(r, r.monster.bin).find((e) => e.type === "hit"));
});

test("「おとなを よぶ」は ふつうの かいじゅうでは まちがい", () => {
  const r = start("adult");
  assert.ok(E.press(r, "adult").find((e) => e.type === "miss" && e.reason === "adult"));
});

test("おおがた かいじゅう：3〜4たい ごとに でて、10かい タップで じょうか", () => {
  const r = start("boss");
  const every = r.bossEvery;
  assert.ok(every >= C.bossEvery[0] && every <= C.bossEvery[1]);
  let seenComing = false;
  for (let i = 0; i < every; i++) {
    toNormal(r);
    const pressed = E.press(r, r.monster.bin);
    seenComing = pressed.concat(until(r, () => r.monster || r.cutin > 0)).some((e) => e.type === "bossComing") || seenComing;
    if (r.cutin > 0) until(r, () => !r.cutin);
  }
  assert.ok(seenComing, "「おおがたが くるぞ」");
  assert.equal(r.monster.type, "boss");
  assert.equal(r.monster.hp, C.bossHp);
  for (let k = 0; k < C.bossHp - 1; k++) assert.ok(E.tap(r).find((e) => e.type === "bossTap"));
  const ev = E.tap(r);
  const down = ev.find((e) => e.type === "bossDown");
  assert.ok(down);
  assert.ok(down.gain >= C.score.boss);
  assert.equal(r.stats.bosses, 1);
  assert.equal(r.sinceBoss, 0);
  // おおがたの ときは ゴミばこの ボタンも タップに なる
  const r2 = start("boss");
  for (let i = 0; i < r2.bossEvery; i++) { toNormal(r2); E.press(r2, r2.monster.bin); until(r2, () => r2.monster || r2.cutin > 0); if (r2.cutin > 0) until(r2, () => !r2.cutin); }
  assert.equal(r2.monster.type, "boss");
  assert.ok(E.press(r2, "plastic").find((e) => e.type === "bossTap"));
});

test("おおがた かいじゅうは じかんぎれで にげる（コンボは きれない）", () => {
  const r = start("escape");
  for (let i = 0; i < r.bossEvery; i++) { toNormal(r); E.press(r, r.monster.bin); until(r, () => r.monster || r.cutin > 0); if (r.cutin > 0) until(r, () => !r.cutin); }
  const combo = r.combo;
  const ev = until(r, () => !r.monster || r.monster.type !== "boss");
  assert.ok(ev.find((e) => e.type === "bossEscape"));
  assert.equal(r.stats.bossEscaped, 1);
  assert.equal(r.combo, combo);
});

// あぶない かいじゅうを つくる（つぎに でる かいじゅうを あぶない ものに する）
function withDanger(id) {
  const r = start(id);
  r.monster = { id: 999, type: "danger", kind: E.DANGER.kind, name: E.DANGER.name, bin: null, age: 0 };
  return r;
}
test("あぶない かいじゅう：おとなを よぶと ボーナス", () => {
  const r = withDanger("d1");
  const ev = E.press(r, "adult");
  const safe = ev.find((e) => e.type === "dangerSafe");
  assert.ok(safe && safe.how === "adult" && safe.gain === C.score.danger);
  assert.equal(r.stats.dangersAvoided, 1);
  assert.equal(r.combo, 1);
});
test("あぶない かいじゅう：さわらずに みおくっても ボーナス", () => {
  const r = withDanger("d2");
  const ev = until(r, () => !r.monster || r.monster.id !== 999);
  assert.ok(ev.find((e) => e.type === "dangerSafe" && e.how === "pass"));
  assert.ok(r.time >= C.dangerTtl - 0.05);
});
test("あぶない かいじゅう：ゴミばこの ボタンで さわると まちがい", () => {
  const r = withDanger("d3");
  const ev = E.press(r, "canbin");
  assert.ok(ev.find((e) => e.type === "miss" && e.reason === "danger"));
  assert.equal(r.stats.mistakes, 1);
  assert.equal(r.monster, null, "あぶない かいじゅうは さる");
});
test("あぶない かいじゅうは さいしょの すこしの あいだ でない・つづけて でない", () => {
  for (let n = 0; n < 30; n++) {
    const r = start("dg-" + n);
    let prev = null;
    for (let i = 0; i < 40 && r.phase === "playing"; i++) {
      const m = r.monster;
      if (!m) { until(r, () => r.monster); continue; }
      if (m.type === "danger") { assert.ok(r.seq > C.dangerFrom, `${r.seq}たいめ`); assert.notEqual(prev, "danger"); }
      prev = m.type;
      if (m.type === "boss") for (let k = 0; k < C.bossHp; k++) E.tap(r);
      else E.press(r, m.type === "danger" ? "adult" : m.bin);
      until(r, () => r.monster || r.cutin > 0);
      if (r.cutin > 0) until(r, () => !r.cutin);
    }
  }
});

test("ゲージが いっぱい → クリーンビーム：カットインの あいだ とけいが とまり、つぎの かいじゅうを じょうか", () => {
  const r = start("beam");
  r.gauge = C.gaugeMax - C.gauge.hit;
  toNormal(r);
  const ev = E.press(r, r.monster.bin);
  assert.ok(ev.find((e) => e.type === "beamStart"), "ビーム はじまり");
  assert.ok(r.monster, "つぎの かいじゅうが すぐ でる");
  assert.equal(r.gauge, 0);
  const t = r.time, target = r.monster;
  const evs = until(r, () => !r.cutin);
  assert.equal(r.time, t, "カットインの あいだ とけいは すすまない");
  const hit = evs.find((e) => e.type === "beamHit");
  assert.ok(hit && hit.monster.id === target.id);
  assert.ok(hit.gain >= C.score.beam);
  assert.ok(evs.find((e) => e.type === "beamEnd"));
  assert.equal(r.stats.beams, 1);
});

test("60びょうで おわり：そのあとは そうさ できない", () => {
  const r = start("end");
  const ev = until(r, () => r.phase !== "playing", 60 * 40);
  assert.ok(ev.find((e) => e.type === "end"));
  assert.equal(r.phase, "result");
  assert.equal(r.time, C.duration);
  assert.equal(E.press(r, "plastic").length, 0);
  assert.equal(E.tap(r).length, 0);
  assert.equal(E.advance(r, 1).length, 0);
});

test("大きな じかんの とび（うらに まわった あと など）は 0.25びょうまでに おさえる", () => {
  const r = start("jump");
  const t = r.time;
  E.advance(r, 30);
  assert.ok(r.time - t <= 0.25 + 1e-9);
});

test("けっか：ほし・メダル・PERFECT・はまべの きれいど", () => {
  const mk = (score, mistakes) => { const r = E.create("res"); r.score = score; r.stats.mistakes = mistakes; return E.result(r); };
  assert.equal(mk(C.stars[0] - 1, 0).stars, 0);
  assert.equal(mk(C.stars[0] - 1, 0).coins, 0);
  assert.equal(mk(C.stars[0] - 1, 0).perfect, false, "★0 は PERFECT に ならない");
  const s1 = mk(C.stars[0], 1);
  assert.deepEqual([s1.stars, s1.perfect, s1.coins], [1, false, C.coins[1]]);
  const s1p = mk(C.stars[0], 0);
  assert.deepEqual([s1p.stars, s1p.perfect, s1p.mult, s1p.coins], [1, true, C.perfect.mult, Math.round(C.coins[1] * C.perfect.mult)]);
  const s2 = mk(C.stars[1], 2);
  assert.deepEqual([s2.stars, s2.coins], [2, C.coins[2]]);
  const s3p = mk(C.stars[2], 0);
  assert.deepEqual([s3p.stars, s3p.mult, s3p.coins], [3, C.perfect.multStar3, C.coins[3] * C.perfect.multStar3]);
  assert.equal(mk(C.stars[2] / 2, 0).clean, 50);
  assert.equal(mk(C.stars[2] * 3, 0).clean, 100, "100% で とまる");
  assert.ok(C.perfect.mult >= 1.5 && C.perfect.multStar3 <= 2, "PERFECT は 1.5〜2ばい");
});
