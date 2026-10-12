// パーツで うごかす ようせい の 設定と 計算の 自動テスト（ブラウザ不要）  node --test tests/pet-rig.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
const document = { addEventListener() {}, body: { classList: { contains: () => false } } };
const ctx = vm.createContext({ window, document, Math, JSON, Object, Promise, console });
for (const f of ["js/pet-rig-config.js", "js/pet-rig.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
const BCT = window.BCT;
const M = BCT.petRig.math;
const TYPES = ["dolphin", "turtle", "hermit"];
// 画面 右がわ（絵は 右向き）の 前の ヒレ・ハサミ。これだけ 胴体の 上に 重ねる
const FRONT = { dolphin: "fin-far", turtle: "front-far", hermit: "claw-left" };
const OTHER_SIDE = { dolphin: "fin-near", turtle: "front-near", hermit: "claw-right" };

// PNG の 大きさ（IHDR）
function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.equal(b.toString("ascii", 1, 4), "PNG", file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const rot = (x, y, deg) => { const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180); return [x * c - y * s, x * s + y * c]; };

test("3種類 × 3段階 すべてで、パーツの 画像・親・付け根・置き場所が そろっている", () => {
  for (const type of TYPES) for (const stage of [1, 2, 3]) {
    const cfg = BCT.petRigConfig(type, stage);
    assert.ok(cfg, `${type}-${stage} の 設定`);
    const ids = Object.keys(BCT.PET_RIG[type].parts);
    assert.deepEqual(Object.keys(cfg.parts).sort(), ids.slice().sort(), `${type}-${stage}：置き場所の ない パーツが ある`);
    for (const [id, p] of Object.entries(cfg.parts)) {
      const where = `${type}-${stage}-${id}`;
      const [w, h] = pngSize(BCT.petRigFile(type, stage, id));
      assert.ok(w > 10 && h > 10, where);
      assert.ok(p.pivot.every((v) => v >= 0 && v <= 1), `${where} の 付け根は 画像の 中`);
      if (id === "body") {
        assert.ok(!p.parent && Number.isFinite(p.place.x) && Number.isFinite(p.place.y) && p.place.scale > 0, where);
      } else {
        assert.ok(cfg.parts[p.parent], `${where} の 親が ある`);
        // 親を たどると 胴体に つく（輪に ならない）
        let q = p, n = 0;
        while (q.parent && n++ < 10) q = cfg.parts[q.parent];
        assert.ok(!q.parent, `${where} は 胴体に つながる`);
        assert.ok(p.place.at.every((v) => v >= -0.1 && v <= 1.1), `${where} の 付け根は 親の 画像の 近く`);
        assert.ok(p.place.scale > 0.2 && p.place.scale < 2, where);
        // 重ね順（2026-10-13）：画面 右がわ（すすむ ほう）の ヒレ・ハサミ だけ 胴体の 上、ほかは ぜんぶ 胴体の うしろ
        if (id === FRONT[type]) assert.ok(p.z > 0, `${where} は 胴体の 上`);
        else assert.ok(p.z < 0, `${where} は 胴体の うしろ`);
      }
      if (p.swing) assert.ok(p.swing.amp >= 0 && p.swing.amp <= 40, `${where} の 振れ幅`);
    }
  }
});

test("動きの 強さ：止まっていると 小さく ゆっくり、動くと 大きく 速い", () => {
  const cfg = BCT.petRigConfig("dolphin", 1);
  const ref = cfg.common.speedRef;
  assert.equal(M.motionLevel(0, ref), 0);
  assert.equal(M.motionLevel(ref, ref), 1);
  assert.equal(M.motionLevel(ref * 10, ref), 1.3); // 上限
  assert.equal(M.ampScale(0, cfg.idleAmp), cfg.idleAmp);
  assert.equal(M.ampScale(1, cfg.idleAmp), 1);
  assert.equal(M.frequency(0, cfg.cycle), cfg.cycle.idleHz);
  assert.equal(M.frequency(1, cfg.cycle), cfg.cycle.moveHz);
  let last = -1;
  for (const v of [0, 0.1, 0.2, 0.3, 0.5]) {
    const a = M.ampScale(M.motionLevel(v, ref), cfg.idleAmp) * M.frequency(M.motionLevel(v, ref), cfg.cycle);
    assert.ok(a > last, "速いほど 大きく 速い");
    last = a;
  }
  for (const type of TYPES) {
    const c = BCT.PET_RIG[type];
    assert.ok(c.idleAmp > 0 && c.idleAmp < 0.5, `${type}：止まっていても すこし うごく`);
    assert.ok(c.cycle.idleHz < c.cycle.moveHz, type);
  }
});

test("サイン波の 回転：振れ幅の 範囲で 行き来する", () => {
  const sw = { amp: 16, freq: 1, phase: -0.7 };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 360; i++) {
    const a = M.swingAngle(sw, (i / 360) * Math.PI * 2, 1);
    min = Math.min(min, a);
    max = Math.max(max, a);
  }
  assert.ok(Math.abs(max - 16) < 0.01 && Math.abs(min + 16) < 0.01);
  assert.ok(Math.abs(M.swingAngle(sw, 1, 0.3)) <= 16 * 0.3 + 1e-9, "止まっているときは 小さい");
  assert.equal(M.swingAngle(undefined, 1, 1), 0);
});

test("イルカ：尾びれを 振り、胴体は 逆の 位相で 少し 傾く", () => {
  const p = BCT.PET_RIG.dolphin.parts;
  const diff = Math.abs(p.body.swing.phase - p["tail-base"].swing.phase) % (Math.PI * 2);
  assert.ok(Math.abs(diff - Math.PI) < 0.01, "胴体と 尾の 付け根は 逆の 位相");
  assert.ok(p.body.swing.amp <= 5 && p["tail-fluke"].swing.amp > p.body.swing.amp * 3, "胴体は わずか、尾びれは 大きく");
  assert.equal(p["tail-fluke"].parent, "tail-base", "尾びれは 尾の 付け根に ついて いく");
});

test("ウミガメ：前ヒレは 大きく ゆっくり、後ろヒレは 小さく、頭は 軽く 上下", () => {
  const t = BCT.PET_RIG.turtle, p = t.parts;
  assert.ok(p["front-near"].swing.amp > p["rear-near"].swing.amp * 2);
  assert.ok(p["front-far"].swing.amp > p["rear-far"].swing.amp * 2);
  assert.ok(t.cycle.moveHz < BCT.PET_RIG.dolphin.cycle.moveHz, "イルカより ゆっくり");
  assert.ok(t.head && t.head.amp > 0 && t.head.amp < 0.05);
  for (const stage of [1, 2, 3]) {
    const h = BCT.petRigConfig("turtle", stage).head;
    assert.ok(h.at.every((v) => v > 0 && v < 1) && h.r > 0.05 && h.r < 0.4, `turtle-${stage} の 頭`);
  }
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 100; i++) { const v = M.headOffset(t.head, (i / 100) * Math.PI * 2, 1); min = Math.min(min, v); max = Math.max(max, v); }
  assert.ok(max > 0 && min < 0, "上にも 下にも うごく");
});

test("ヤドカリ：対角の 脚が 組で 交互に うごき、歩幅に 合わせて 胴体が 上下する", () => {
  const h = BCT.PET_RIG.hermit, p = h.parts;
  const ph = (id) => p[id].swing.phase;
  assert.equal(ph("leg-near-front"), ph("leg-far-rear"));
  assert.equal(ph("leg-near-rear"), ph("leg-far-front"));
  assert.ok(Math.abs(Math.abs(ph("leg-near-front") - ph("leg-near-rear")) - Math.PI) < 0.01, "2組は 逆の 位相");
  // 1周期で 2回 もちあがる（1歩ごと）。下には さがらない
  let lifts = 0, prev = 0, minV = 0;
  for (let i = 0; i <= 400; i++) {
    const v = M.bobOffset(h.bob, (i / 400) * Math.PI * 2, 1);
    minV = Math.min(minV, v);
    if (v < -h.bob.amp * 0.95 && prev >= -h.bob.amp * 0.95) lifts++;
    prev = v;
    assert.ok(v <= 0);
  }
  assert.equal(lifts, 2);
  assert.ok(Math.abs(minV + h.bob.amp) < 1e-3);
});

test("置き場所の 計算：胴体の 画像の まんなかは x, y に、子の 付け根は 親の at に くる", () => {
  for (const type of TYPES) for (const stage of [1, 2, 3]) {
    const cfg = BCT.petRigConfig(type, stage);
    const sizes = Object.fromEntries(Object.keys(cfg.parts).map((id) => [id, pngSize(BCT.petRigFile(type, stage, id))]));
    const lay = M.localLayout(cfg.parts, sizes);
    const b = lay.body, bp = cfg.parts.body.place;
    // CSS：要素の 点 q → left/top + 付け根 + 回転·大きさ·(q − 付け根)
    const [ox, oy] = rot((b.w / 2 - b.piv[0]) * b.scale, (b.h / 2 - b.piv[1]) * b.scale, b.rot);
    assert.ok(Math.abs(b.left + b.piv[0] + ox - bp.x) < 1e-6 && Math.abs(b.top + b.piv[1] + oy - bp.y) < 1e-6, `${type}-${stage} の 胴体`);
    for (const [id, p] of Object.entries(cfg.parts)) {
      if (!p.parent) continue;
      const [pw, ph] = sizes[p.parent];
      const L = lay[id];
      assert.ok(Math.abs(L.left + L.piv[0] - p.place.at[0] * pw) < 1e-6 && Math.abs(L.top + L.piv[1] - p.place.at[1] * ph) < 1e-6, `${type}-${stage}-${id}`);
    }
  }
});

test("向きを かえるのは 間隔が あいたときだけ（ふだんは 向いている ほうへ すすむ）", () => {
  const nextX = M.nextX;
  // 向きを かえては いけない ときは、どこに いても 向きは そのまま、はんいの 中で 前へ
  for (const left of [false, true]) for (let x = 75; x <= 300; x += 15) for (const r of [0, 0.5, 0.999]) {
    const n = nextX(x, 75, 300, left, false, r);
    assert.equal(n.left, left);
    assert.equal(n.turned, false);
    assert.ok(n.x >= 75 - 1e-9 && n.x <= 300 + 1e-9);
    assert.ok(left ? n.x <= x : n.x >= x, "前へ すすむ");
  }
  // 向いている ほうの はしに 近ければ ふりむく。反対側の ほうが せまければ ふりむかない
  assert.equal(nextX(290, 75, 300, false, true, 0.5).turned, true);
  assert.equal(nextX(85, 75, 300, false, true, 0.5).turned, false);
  // 3.6秒ごとに うごく ホームで 10分：ふりむくのは 30秒に 1回まで、でも ちゃんと ふりむく
  const every = BCT.PET_RIG.common.turnEveryMs;
  assert.equal(every, 30000);
  let x = 187, left = false, last = 0, turns = 0, seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t <= 600000; t += 3600) {
    const n = nextX(x, 75, 300, left, t - last >= every, rand());
    if (n.turned) {
      assert.ok(t - last >= every, `${t}ms：前回から ${t - last}ms`);
      last = t;
      turns++;
    }
    x = n.x;
    left = n.left;
  }
  assert.ok(turns >= 10 && turns <= 20, `10分で ${turns}回`);
});

test("胴体の 上に 重ねる ヒレ・ハサミ は 画面の 右がわ（すすむ ほう）の もの", () => {
  for (const type of TYPES) for (const stage of [1, 2, 3]) {
    const cfg = BCT.petRigConfig(type, stage);
    assert.ok(cfg.parts[FRONT[type]].place.at[0] > cfg.parts[OTHER_SIDE[type]].place.at[0], `${type}-${stage}：${FRONT[type]} が 右がわ`);
  }
});

test("色の 補正・帽子と こものの ずらし は 正しい 形", () => {
  for (const type of TYPES) for (const stage of [1, 2, 3]) {
    const cfg = BCT.petRigConfig(type, stage);
    assert.ok(cfg.tint === "" || /^(saturate|brightness)\([\d.]+\)( (saturate|brightness)\([\d.]+\))*$/.test(cfg.tint), `${type}-${stage}：${cfg.tint}`);
    for (const m of cfg.tint.matchAll(/\(([\d.]+)\)/g)) assert.ok(+m[1] > 0.7 && +m[1] < 1.4, `${type}-${stage}：補正は 小さく`);
    for (const v of Object.values(cfg.equipShift || {})) assert.ok(v.length === 2 && v.every((x) => Math.abs(x) < 0.2), `${type} の ずらし`);
  }
  assert.ok(BCT.petRigConfig("hermit", 1).tint, "ヤドカリは 色を 正面の絵に 近づける");
  // こもの は 正面の絵でも 首（あごの した）に したので、パーツ表示だけの ずらしは しない（js/pet-art-fix.js）
  assert.ok(!BCT.PET_RIG.dolphin.equipShift.acc, "イルカの こもの は ずらさない");
});
