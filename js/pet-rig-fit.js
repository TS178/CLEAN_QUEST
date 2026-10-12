/*
 * 胴体の 置き場所を 元の絵から さがす（確認用ページ preview-pet-rig.html だけで つかう。アプリ本体では 読まない）
 * ------------------------------------------------------------
 * 胴体の パーツ画像を すこし 回したり 大きさを かえたりして、元の絵（正面の絵）に いちばん よく 重なる ところを さがす。
 *   - 色の ちがいが 小さいほど よい。元の絵の 外（すきま）に はみ出すと わるい。
 *   - 粗く（1/4）→ こまかく（1/2）→ 本来の 大きさ（1/1）の 順に しぼる。
 * ヒレ・脚・尾は 元の絵と 形が ちがう（描きおこし）ので 自動では 合わない。親の どこに 付けるかを 目で 見て きめる。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const RAD = Math.PI / 180;
  const CAP = 300;

  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const ctx2d = (c) => c.getContext("2d", { willReadFrequently: true });
  async function load(src) { const i = new Image(); i.src = src; await i.decode(); return i; }

  // 縮小した 元の絵
  function level(img, f) {
    const w = Math.max(1, Math.round(img.naturalWidth / f)), h = Math.max(1, Math.round(img.naturalHeight / f));
    const c = canvas(w, h), x = ctx2d(c);
    x.drawImage(img, 0, 0, w, h);
    return { w, h, f, d: x.getImageData(0, 0, w, h).data };
  }
  // パーツを 回して 大きさを かえた ときの 見本点 [中心からの ずれx, y, 赤, 緑, 青] × n
  function samples(img, f, rot, scale, flip, n) {
    const w = (img.naturalWidth * scale) / f, h = (img.naturalHeight * scale) / f;
    const D = Math.ceil(Math.hypot(w, h)) + 2;
    const c = canvas(D, D), x = ctx2d(c);
    x.translate(D / 2, D / 2);
    x.rotate(rot * RAD);
    x.scale(flip ? -1 : 1, 1);
    x.drawImage(img, -w / 2, -h / 2, w, h);
    const d = x.getImageData(0, 0, D, D).data;
    const all = [];
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const k = (j * D + i) * 4;
      if (d[k + 3] > 200) all.push(i + 0.5 - D / 2, j + 0.5 - D / 2, d[k], d[k + 1], d[k + 2]);
    }
    const cnt = all.length / 5, stride = Math.max(1, Math.floor(cnt / n));
    const out = [];
    for (let i = 0; i < cnt; i += stride) out.push(all[i * 5], all[i * 5 + 1], all[i * 5 + 2], all[i * 5 + 3], all[i * 5 + 4]);
    return new Float32Array(out);
  }
  // 重なりの わるさ（小さいほど よい）
  function cost(ref, S, cx, cy) {
    let sum = 0;
    const { w, h, d } = ref;
    for (let i = 0; i < S.length; i += 5) {
      const x = Math.floor(cx + S[i]), y = Math.floor(cy + S[i + 1]);
      if (x < 0 || y < 0 || x >= w || y >= h) { sum += CAP; continue; }
      const p = y * w + x, k = p * 4;
      if (d[k + 3] < 128) { sum += CAP; continue; }
      const c = Math.abs(d[k] - S[i + 2]) + Math.abs(d[k + 1] - S[i + 3]) + Math.abs(d[k + 2] - S[i + 4]);
      sum += c > CAP ? CAP : c;
    }
    return sum / (S.length / 5);
  }
  const range = (a, b, step) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(4)); return out; };

  /*
   * 1つの パーツを さがす
   *   opt.rots / opt.scales / opt.flips … 粗く さがす ときの 候補
   */
  function search(refs, img, opt) {
    const [L4, L2, L1] = refs;
    // ① 粗く（1/4）：向き・大きさ・反転 ごとに いちばん よい 位置
    let cands = [];
    for (const flip of opt.flips) for (const rot of opt.rots) for (const scale of opt.scales) {
      const S = samples(img, L4.f, rot, scale, flip, 140);
      if (!S.length) continue;
      let best = Infinity, bx = 0, by = 0;
      for (let cy = 0; cy < L4.h; cy++) for (let cx = 0; cx < L4.w; cx++) {
        const v = cost(L4, S, cx, cy);
        if (v < best) { best = v; bx = cx; by = cy; }
      }
      cands.push({ rot, scale, flip, x: bx * L4.f, y: by * L4.f, v: best });
    }
    cands.sort((a, b) => a.v - b.v);
    // 似た 候補は まとめる
    const picked = [];
    for (const c of cands) {
      if (picked.length >= 8) break;
      if (picked.some((p) => p.flip === c.flip && Math.abs(((p.rot - c.rot + 540) % 360) - 180) < 15 && Math.hypot(p.x - c.x, p.y - c.y) < 12)) continue;
      picked.push(c);
    }
    // ② ③ こまかく
    const refine = (c, L, dRot, sRot, dSc, sSc, dPos, n) => {
      let best = { ...c, v: Infinity };
      for (const rot of range(c.rot - dRot, c.rot + dRot, sRot)) for (const scale of range(c.scale - dSc, c.scale + dSc, sSc)) {
        const S = samples(img, L.f, rot, scale, c.flip, n);
        const x0 = Math.round(c.x / L.f), y0 = Math.round(c.y / L.f);
        for (let cy = y0 - dPos; cy <= y0 + dPos; cy++) for (let cx = x0 - dPos; cx <= x0 + dPos; cx++) {
          const v = cost(L, S, cx, cy);
          if (v < best.v) best = { rot, scale, flip: c.flip, x: cx * L.f, y: cy * L.f, v };
        }
      }
      return best;
    };
    let best = null;
    for (const c of picked) {
      const r2 = refine(c, L2, 6, 3, 0.04, 0.02, 3, 450);
      const r1 = refine(r2, L1, 2, 1, 0.015, 0.015, 2, 1400);
      if (!best || r1.v < best.v) best = r1;
    }
    return best;
  }

  // 種類・段階の 胴体を さがす → { place: {x, y, rot, scale}, score: わるさ }
  async function fitBody(type, stage) {
    const sp = BCT.PET_SPRITES[`${type}-${stage}-normal`];
    const refImg = await load(sp.src);
    const refs = [level(refImg, 4), level(refImg, 2), level(refImg, 1)];
    const img = await load(BCT.petRigFile(type, stage, "body"));
    const r = search(refs, img, { rots: range(-15, 15, 5), scales: range(0.8, 1.45, 0.05), flips: [false] });
    return { place: { x: Math.round(r.x), y: Math.round(r.y), rot: Math.round(r.rot), scale: +r.scale.toFixed(3) }, score: +r.v.toFixed(1) };
  }

  /*
   * パーツの 色を 正面の絵に 近づける 補正（CSS の filter）を さがす
   *   胴体を 置いた ところで、正面の絵と 胴体の パーツが 重なる 画素の 平均の 色・鮮やかさを くらべ、
   *   鮮やかさ（saturate）・明るさ（brightness）の 組み合わせから いちばん 近い ものを えらぶ
   *   （色合いを 回すと 目や ほおの 色まで かわるので 回さない）。
   *   → { tint: "saturate(..) brightness(..)", before, after }（設定の stages[段階].tint に 書く）
   */
  async function fitTint(type, stage) {
    const sp = BCT.PET_SPRITES[`${type}-${stage}-normal`];
    const ref = await load(sp.src);
    const body = await load(BCT.petRigFile(type, stage, "body"));
    const pl = BCT.PET_RIG[type].stages[stage].place.body;
    const f = 3, w = Math.round(sp.width / f), h = Math.round(sp.height / f);
    const c1 = canvas(w, h), x1 = ctx2d(c1);
    x1.drawImage(ref, 0, 0, w, h);
    const c2 = canvas(w, h), x2 = ctx2d(c2);
    x2.translate(pl.x / f, pl.y / f);
    x2.rotate((pl.rot || 0) * RAD);
    x2.scale(pl.scale / f, pl.scale / f);
    x2.drawImage(body, -body.naturalWidth / 2, -body.naturalHeight / 2);
    const a = x1.getImageData(0, 0, w, h).data, bd = x2.getImageData(0, 0, w, h).data;
    const idx = [];
    for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 245 && bd[i + 3] > 245) idx.push(i);
    const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255)); };
    const stats = (d) => {
      let r = 0, g = 0, b = 0, s = 0;
      for (const i of idx) { r += d[i]; g += d[i + 1]; b += d[i + 2]; s += sat(d[i], d[i + 1], d[i + 2]); }
      const n = idx.length;
      return [r / n, g / n, b / n, s / n];
    };
    const target = stats(a);
    const diff = (m) => Math.abs(m[0] - target[0]) + Math.abs(m[1] - target[1]) + Math.abs(m[2] - target[2]) + 150 * Math.abs(m[3] - target[3]);
    const c3 = canvas(w, h), x3 = ctx2d(c3);
    const tryTint = (t) => { x3.clearRect(0, 0, w, h); x3.filter = t; x3.drawImage(c2, 0, 0); x3.filter = "none"; return stats(x3.getImageData(0, 0, w, h).data); };
    const before = stats(bd);
    let best = { v: diff(before), tint: "" };
    for (const s of range(0.8, 1.5, 0.02)) for (const br of range(0.88, 1.12, 0.01)) {
      const tint = `saturate(${s.toFixed(2)}) brightness(${br.toFixed(2)})`;
      const v = diff(tryTint(tint));
      if (v < best.v) best = { v, tint };
    }
    const round = (m) => m.map((v, i) => (i < 3 ? Math.round(v) : +v.toFixed(3)));
    return { tint: best.tint, target: round(target), before: round(before), after: round(best.tint ? tryTint(best.tint) : before), score: +best.v.toFixed(1) };
  }

  BCT.petRigFit = { fitBody, fitTint };
})();
