/*
 * 正面の絵の 帽子・こもの の 付け根の 手直し（js/pet-art.js の ANCHOR を 上書きする。pet-art.js の あとに 読む）
 * ------------------------------------------------------------
 * pet-art.js は 別の 作業者の ファイルなので 直接 かえず、ここで 上から なおす。
 * 正面の絵・きせかえ・さつえい・パーツで うごく ようせい（js/pet-rig.js）は みんな この 付け根を つかう。
 *   x, y … 200×200 の 枠での 位置（胴体を ちぢめる 前）、r … 回転（度）、s … 大きさ
 *   帽子は 付け根の すこし 上に、こもの は 付け根を まんなかに かかれる（pet-art.js の ITEM_ART）
 *
 * ■ アイテムごとの 付け根（ITEM）
 *   ANCHOR は 種類・段階ごとに「あたま」「こもの」の 1つずつ。アイテムで かえたい ときは ITEM に かく。
 *   正面の絵を かく とき（BCT.art.render）に いま つけて いる アイテムを おぼえて、ANCHOR の head / acc を
 *   よむ ときに ITEM の ほうを かえす。パーツで うごく ときは BCT.art.anchorFor で おなじ ものを つかう。
 *
 * 2026-10-13 利用者の 指示：
 *   - こもの（リボン・スカーフ・ペンダント・メダル・バッジ）は どの 段階でも 首に まいて いるように（あごの すぐ した）
 *   - イルカ 段階2・3 の 帽子は もう すこし 左下（ちゃんと かぶって いるように）
 *   - ヤドカリの 帽子（むぎわら・マリンキャップ・おそうじたいの ぼうし・おうかん）は 目の 上。はな・かいがらの かざりは そのまま
 */
(function () {
  const BCT = window.BCT;
  const art = BCT && BCT.art;
  const A = art && art.ANCHOR;
  if (!A) return;
  const anchor = (x, y, r = 0, s = 1) => ({ x, y, r, s });

  // ---------- 種類・段階ごとの 付け根 ----------
  // こもの：あごの すぐ した（首）
  A.dolphin[1].acc = anchor(117, 124, -14, 0.85);
  A.dolphin[2].acc = anchor(133, 108, -18, 0.85);
  A.dolphin[3].acc = anchor(150, 120, -16, 0.85);
  A.turtle[1].acc = anchor(135, 122, -4, 0.85);
  A.turtle[2].acc = anchor(150, 102, -6, 0.82);
  A.turtle[3].acc = anchor(154, 90, -8, 0.78);
  A.hermit[1].acc = anchor(148, 152, -4, 0.8);
  A.hermit[2].acc = anchor(140, 136, -4, 0.8);
  A.hermit[3].acc = anchor(134, 142, -4, 0.78);
  // イルカ 段階2・3 の 帽子：左下へ（頭の てっぺんに かぶせる）
  A.dolphin[2].head = anchor(106, 60, -13, 0.95);
  A.dolphin[3].head = anchor(130, 76, -13, 0.85);

  // ---------- アイテムごとの 付け根 ----------
  const hatsOver = (x, y, r, s) => ({
    head_straw: anchor(x, y, r, s), head_marine: anchor(x, y, r, s),
    reward_clean_hat: anchor(x, y, r, s), head_crown: anchor(x, y, r, s * 0.9),
  });
  const ITEM = {
    // ヤドカリの 帽子は 目の 上（はな・かいがらの かざりは 段階の 付け根の まま＝かいがらの 上）
    hermit: {
      1: hatsOver(146, 96, -4, 0.72),
      2: hatsOver(141, 80, -4, 0.72),
      3: hatsOver(130, 96, -4, 0.7),
    },
  };
  const itemAnchor = (type, stage, id) => (id && ITEM[type] && ITEM[type][stage] && ITEM[type][stage][id]) || null;

  // ANCHOR の head / acc を「いま かいている アイテム」で かえる 読み出しに する
  let current = null;
  for (const type of Object.keys(A)) {
    for (const stage of Object.keys(A[type])) {
      const o = A[type][stage];
      for (const slot of ["head", "acc"]) {
        let base = o[slot];
        Object.defineProperty(o, slot, {
          configurable: true,
          enumerable: true,
          get() { return itemAnchor(type, stage, current && current[slot]) || base; },
          set(v) { base = v; },
        });
      }
    }
  }
  const render = art.render;
  art.render = function (opts) {
    current = (opts && opts.equip) || null;
    try {
      return render.apply(this, arguments);
    } finally {
      current = null;
    }
  };
  // パーツで うごく ようせい（js/pet-rig.js）・確認用
  art.anchorFor = (type, stage, slot, id) => itemAnchor(type, stage, id) || (A[type] && A[type][stage] && A[type][stage][slot]) || null;
  art.ITEM_ANCHOR = ITEM;
})();
