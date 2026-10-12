/*
 * AR の計算（画面・three.js に たよらない。自動テストは tests/logic.test.mjs）
 * ------------------------------------------------------------
 * 座標は three.js と同じ「右=+X・上=+Y・手前=+Z（カメラは -Z を見る）」、長さの単位は メートル。
 *
 * deviceQuaternion() の式は three.js の公開例 DeviceOrientationControls
 * （https://github.com/mrdoob/three.js, MIT License, Copyright 2010-2026 three.js authors）と同じ考え方で、
 * 依存を なくすため ふつうの計算で書きなおしたもの。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const D2R = Math.PI / 180;

  // クォータニオン [x, y, z, w] のかけ算 a×b
  function qmul(a, b) {
    return [
      a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
      a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
      a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  // オイラー角（YXZ の順）→ クォータニオン
  function eulerYXZ(x, y, z) {
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    return [
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 - s1 * s2 * c3,
      c1 * c2 * c3 + s1 * s2 * s3,
    ];
  }
  // ベクトルを クォータニオンで まわす
  function rotate(q, v) {
    const [x, y, z, w] = q;
    const ix = w * v[0] + y * v[2] - z * v[1];
    const iy = w * v[1] + z * v[0] - x * v[2];
    const iz = w * v[2] + x * v[1] - y * v[0];
    const iw = -x * v[0] - y * v[1] - z * v[2];
    return [
      ix * w + iw * -x + iy * -z - iz * -y,
      iy * w + iw * -y + iz * -x - ix * -z,
      iz * w + iw * -z + ix * -y - iy * -x,
    ];
  }

  /*
   * スマホの傾き（deviceorientation の alpha・beta・gamma, 度）と 画面の向き（度）から、
   * カメラの向きを表す クォータニオンを出す。
   *   たて持ちで まっすぐ前を向く（beta=90）→ 水平に前（-Z）を見る
   *   画面を上にして 平らに置く（beta=0） → 真下（-Y）を見る
   */
  function deviceQuaternion(alpha, beta, gamma, screenAngle) {
    const q = eulerYXZ((beta || 0) * D2R, (alpha || 0) * D2R, -(gamma || 0) * D2R);
    const q1 = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // カメラは 画面の うら側を 見る（X軸まわりに -90°）
    const o = -(screenAngle || 0) * D2R / 2;
    const q0 = [0, 0, Math.sin(o), Math.cos(o)]; // 画面の向き（たて・よこ）
    return qmul(qmul(q, q1), q0);
  }
  const forward = (q) => rotate(q, [0, 0, -1]);

  // カメラの前方（水平）に、dist メートル はなれた ゆかの 位置
  function placeInFront(q, dist, floorY) {
    const f = forward(q);
    let h = Math.hypot(f[0], f[2]);
    // ほぼ真下・真上を見ているときは 画面の上の向きを 前とする
    let dx = f[0], dz = f[2];
    if (h < 0.15) {
      const up = rotate(q, [0, 1, 0]);
      dx = up[0];
      dz = up[2];
      h = Math.hypot(dx, dz) || 1;
      if (!Math.hypot(dx, dz)) { dx = 0; dz = -1; h = 1; }
    }
    return [(dx / h) * dist, floorY, (dz / h) * dist];
  }

  /*
   * ボールを投げる：start から target へ、time 秒で とどく初速（重力 g は下向き、m/s²）
   *   位置(t) = start + v*t + ½ * (0, -g, 0) * t²
   */
  function throwVelocity(start, target, time, g) {
    return [
      (target[0] - start[0]) / time,
      (target[1] - start[1] + 0.5 * g * time * time) / time,
      (target[2] - start[2]) / time,
    ];
  }
  function positionAt(start, v, g, t) {
    return [start[0] + v[0] * t, start[1] + v[1] * t - 0.5 * g * t * t, start[2] + v[2] * t];
  }

  /*
   * フリック（指で はじく）→ ねらいの ずれ（メートル）。
   *   dx … 横の移動（画面の幅に対する割合 -1〜1）。まっすぐ なら 0。
   *   小さなずれは ようせいが キャッチ してくれる（子どもでも 遊べるよう ゆるめ）
   */
  function aimOffset(dxRatio, maxMeters) {
    const v = Math.max(-1, Math.min(1, dxRatio || 0));
    return Math.abs(v) < 0.08 ? 0 : v * (maxMeters || 0.9);
  }
  const CATCH_RADIUS = 0.35; // これより近くに とどけば キャッチ

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  BCT.arMath = { qmul, eulerYXZ, rotate, deviceQuaternion, forward, placeInFront, throwVelocity, positionAt, aimOffset, CATCH_RADIUS, dist };
})();
