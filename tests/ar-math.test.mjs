// AR の計算の自動テスト（ブラウザ不要）  node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/ar-math.js"), "utf8"), vm.createContext({ window, Math }));
const M = window.BCT.arMath;
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("たて持ちで まっすぐ → 水平に前（-Z）を見る", () => {
  assert.ok(near(M.forward(M.deviceQuaternion(0, 90, 0, 0)), [0, 0, -1]));
});

test("平らに置く → 真下を見る", () => {
  assert.ok(near(M.forward(M.deviceQuaternion(0, 0, 0, 0)), [0, -1, 0]));
});

test("左に90°まわる（alpha=90）→ 左（-X）を見る", () => {
  assert.ok(near(M.forward(M.deviceQuaternion(90, 90, 0, 0)), [-1, 0, 0]));
});

test("下に30°かたむける → 前下を見る", () => {
  const f = M.forward(M.deviceQuaternion(0, 60, 0, 0));
  assert.ok(near(f, [0, -0.5, -Math.sqrt(3) / 2]));
});

test("よこ持ち（画面の向き90°）でも 前を見る", () => {
  // よこ持ちで 画面を こちらに向けた姿勢：gamma=-90
  const f = M.forward(M.deviceQuaternion(0, 0, -90, 90));
  assert.ok(Math.abs(f[1]) < 1e-6 && Math.abs(Math.hypot(f[0], f[2]) - 1) < 1e-6, String(f));
});

test("ようせいは カメラの前方の ゆかに 置く（真下を見ていても 前に置く）", () => {
  assert.ok(near(M.placeInFront(M.deviceQuaternion(0, 70, 0, 0), 1.5, -1.1), [0, -1.1, -1.5]));
  assert.ok(near(M.placeInFront(M.deviceQuaternion(0, 0, 0, 0), 1.5, -1.1), [0, -1.1, -1.5]));
  const p = M.placeInFront(M.deviceQuaternion(90, 80, 0, 0), 2, -1);
  assert.ok(near(p, [-2, -1, 0]));
});

test("ボールは ねらった所に ちょうど とどく", () => {
  const start = [0.1, -0.2, -0.3], target = [0.4, -0.9, -1.5];
  for (const T of [0.35, 0.75, 1.2]) {
    const v = M.throwVelocity(start, target, T, 9.8);
    assert.ok(near(M.positionAt(start, v, 9.8, T), target, 1e-9));
    assert.ok(near(M.positionAt(start, v, 9.8, 0), start));
  }
});

test("フリックの ずれ：小さい ずれは まっすぐ（キャッチできる）、大きい ずれは はずれる", () => {
  assert.equal(M.aimOffset(0, 0.9), 0);
  assert.equal(M.aimOffset(0.05, 0.9), 0);
  assert.ok(Math.abs(M.aimOffset(0.3, 0.9)) < M.CATCH_RADIUS, "少しの ずれは キャッチ");
  assert.ok(Math.abs(M.aimOffset(1, 0.9)) > M.CATCH_RADIUS, "大きく ずれると おいかける");
  assert.equal(M.aimOffset(5, 0.9), 0.9, "はみだしても 上限まで");
});
