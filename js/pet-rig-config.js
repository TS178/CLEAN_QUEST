/*
 * パーツで うごかす ようせい の 設定（付け根・振れ幅・周期・重ね順）
 * ------------------------------------------------------------
 * 画像：assets/pet-parts/<種類>-<段階>-<パーツ>.png（右向き。左向きは 入れ物ごと 左右反転）
 * ※ 2026-10-13 から、置き場所・付け根・重ね順・画像は js/pet-rig-cut.js（正面の絵から 切り出した パーツ）が 上書きする。
 *   ここで つかうのは うごき（振れ幅・周期・ウミガメの 頭・ヤドカリの 上下）だけ。
 * うごかす本体：js/pet-rig.js   確認用ページ：preview-pet-rig.html（元の絵と 重ねて 位置を 合わせる）
 *
 * ■ 種類ごとの 共通設定（parts）
 *   parent … どの パーツに 付くか（親が 回ると いっしょに うごく）。body だけは 親なし
 *   pivot  … この パーツの 付け根（回転の 中心）[横, たて]（この パーツの 画像に 対する 割合 0〜1。反転したあとの 絵で）
 *   z      … 重ね順（2026-10-13 利用者の 指示）。絵は 右向きで、右向きの とき：
 *              尾ビレ・足（後ろ足）、画面の 左がわの ヒレ・ハサミ → 胴体の うしろ（マイナス）
 *              画面の 右がわ（すすむ ほう）の ヒレ・ハサミ → 胴体の 上（プラス）
 *            左向きは 入れ物ごと 左右反転するので、自動で 逆（右がわが うしろ・左がわが 上）に なる。
 *            うしろの パーツは 手前ほど 0 に 近く（-1）、奥ほど 小さく（-3）。帽子・こもの（z 5）は いつも いちばん 上
 *   swing  … サイン波の 回転 { amp: 振れ幅（度）, freq: 周期の 倍率（1 = 基本の 周期）, phase: 位相（ラジアン） }
 *
 * ■ 段階ごとの 置き場所（stages[段階].place）
 *   胴体 body … { x, y, rot, scale }
 *     x, y  … 胴体の 画像の まんなかが 元の絵（BCT.PET_SPRITES の <種類>-<段階>-normal）の どこに くるか（元の絵の px）
 *     scale … 元の絵に 対する 大きさ。preview-pet-rig.html の「胴体を 自動で あわせる」で 下書きできる
 *   ほかの パーツ … { at, rot, scale, flip, flipY }
 *     at    … 付け根を 親パーツの どこに 付けるか [横, たて]（親の 画像に 対する 割合）
 *     rot   … ふだんの 角度（度。親に 対して）   scale … 大きさ（親に 対して）   flip / flipY … 左右 / 上下 反転
 *   段階ごとに 付け根を かえたいときは stages[段階].pivot に 上の pivot と 同じ形で 書く
 *   tint … パーツの 色を 正面の絵に 近づける 補正（CSS の filter。preview-pet-rig.html で BCT.petRigFit.fitTint を つかって 下書き）
 *
 * 周期（cycle）は 1秒あたりの 回数。移動の 速さに 合わせて idleHz（止まっているとき）〜 moveHz（ふつうに 動いているとき）。
 * 振れ幅も 速さに 合わせて idleAmp（止まっているときの 割合）〜 1 まで 大きくなる。
 * 帽子・こもの は 正面の絵と 同じ 付け根（js/pet-art.js の ANCHOR）を つかい、頭・胴体の パーツに 付ける。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const PI = Math.PI;

  BCT.PET_RIG = {
    common: {
      // からだの 幅に 対して 1秒に 何個分 すすむと「ふつうに 動いている」とするか
      speedRef: 0.35,
      // 向きを かえるとき 正面（背面）の 静止画を 見せる 時間（ミリ秒）。0 なら はさまずに パーツの まま 反転
      //   いまは 0（正面の絵が 一瞬 ちらつくため）。背面の 絵が できたら ここを ふやして 使う
      turnMs: 0,
      // 向きを かえるのは この 間隔に 1回ほど（ミリ秒）。それまでは 向いている ほうへ すすむ（ホームの池・すみか）
      turnEveryMs: 30000,
      // 速さの なめらかさ（大きいほど すぐ 追いつく）
      speedSmoothing: 6,
    },

    // ---------------- イルカ：尾ビレを 上下に 振る。胴体は 逆位相で わずかに 傾ける ----------------
    dolphin: {
      motion: "swim",
      cycle: { idleHz: 0.45, moveHz: 1.5 },
      idleAmp: 0.3,
      parts: {
        body: { pivot: [0.5, 0.55], z: 0, swing: { amp: 3, freq: 1, phase: PI } },
        dorsal: { parent: "body", pivot: [0.5, 0.72], z: -2, swing: { amp: 3, freq: 1, phase: PI } },
        // 画面 右（顔の よこ）の ヒレ＝fin-far は 胴体の 上、画面 左の ヒレ＝fin-near は 胴体の うしろ
        "fin-far": { parent: "body", pivot: [0.12, 0.38], z: 1, swing: { amp: 10, freq: 1, phase: 1.6 } },
        "fin-near": { parent: "body", pivot: [0.85, 0.28], z: -1, swing: { amp: 14, freq: 1, phase: 1.6 } },
        // 尾は 胴体の うしろで お尻の ほうへ のばし、尾びれだけ 胴体の 下から のぞかせる（胴体が 上に 重なる）
        "tail-base": { parent: "body", pivot: [0.15, 0.35], z: -2, swing: { amp: 8, freq: 1, phase: 0 } },
        "tail-fluke": { parent: "tail-base", pivot: [0.12, 0.25], z: -1, swing: { amp: 14, freq: 1, phase: -0.7 } },
      },
      stages: {
        1: {
          place: {
            body: { x: 176, y: 135, rot: 1, scale: 1.11 },
            dorsal: { at: [0.22, 0.2], rot: -15, scale: 0.8, flipY: true },
            "fin-far": { at: [0.86, 0.68], rot: -40, scale: 0.7 },
            "fin-near": { at: [0.3, 0.76], rot: 0, scale: 0.75 },
            "tail-base": { at: [0.32, 0.52], rot: 100, scale: 0.4 },
            "tail-fluke": { at: [0.88, 0.72], rot: 20, scale: 1.875 },
          },
        },
        2: {
          pivot: { dorsal: [0.85, 0.45] },
          place: {
            body: { x: 202, y: 144, rot: 3, scale: 1 },
            // 背びれ：裏返さず、右の はし（付け根）を 背中の 左上に。先は うしろ（左）へ（2026-10-13 なおし）
            dorsal: { at: [0.3, 0.12], rot: 15, scale: 0.9 },
            "fin-far": { at: [0.85, 0.62], rot: -35, scale: 0.8 },
            "fin-near": { at: [0.3, 0.68], rot: 0, scale: 0.85 },
            "tail-base": { at: [0.32, 0.52], rot: 100, scale: 0.4 },
            "tail-fluke": { at: [0.88, 0.72], rot: 20, scale: 1.875 },
          },
        },
        3: {
          pivot: { "dorsal": [0.85, 0.7], "fin-far": [0.1, 0.25], "tail-fluke": [0.1, 0.42] },
          place: {
            body: { x: 370, y: 213, rot: 0, scale: 0.83 },
            // 背びれ（波の 形）：裏返さず、右の はしを 頭の うしろに。左へ ながれて 先が くるりと まく（正面の絵と おなじ）
            dorsal: { at: [0.4, 0.1], rot: 0, scale: 1 },
            "fin-far": { at: [0.85, 0.62], rot: -30, scale: 0.65 },
            "fin-near": { at: [0.32, 0.7], rot: 0, scale: 0.85 },
            "tail-base": { at: [0.32, 0.52], rot: 100, scale: 0.4 },
            "tail-fluke": { at: [0.88, 0.72], rot: 20, scale: 1.875 },
          },
        },
      },
      // 帽子・こもの を パーツ表示の ときだけ ずらす [横, たて]（胴体の 画像に 対する 割合。マイナスは 左・上）
      //   2026-10-13：こもの の 付け根を 正面の絵でも 首（あごの した）に したので、ずらしは なし（js/pet-art-fix.js）
      equipShift: {},
      // 振り向くとき：正面は いまの 正面の絵。背面の 絵は まだ ない（用意できたら ファイル名を 書く）
      back: null,
    },

    // ---------------- ウミガメ：前ヒレは 大きく ゆっくり、後ろヒレは 小さく、頭は 軽く 上下 ----------------
    turtle: {
      motion: "swim",
      cycle: { idleHz: 0.3, moveHz: 0.9 },
      idleAmp: 0.3,
      parts: {
        body: { pivot: [0.5, 0.6], z: 0 },
        tail: { parent: "body", pivot: [0.75, 0.22], z: -2, swing: { amp: 8, freq: 1, phase: 0.5 } },
        // 後ろ足・尾 → うしろ。前ヒレは 画面 右の front-far が 胴体の 上、左の front-near は うしろ（頭の 層は さらに 上）
        "rear-far": { parent: "body", pivot: [0.2, 0.18], z: -3, swing: { amp: 8, freq: 1, phase: PI } },
        "front-far": { parent: "body", pivot: [0.15, 0.18], z: 1, swing: { amp: 18, freq: 1, phase: PI } },
        "rear-near": { parent: "body", pivot: [0.8, 0.18], z: -2, swing: { amp: 8, freq: 1, phase: 0 } },
        "front-near": { parent: "body", pivot: [0.82, 0.17], z: -1, swing: { amp: 22, freq: 1, phase: 0 } },
      },
      // 頭：胴体の 絵の 頭の 部分だけを ぼかして 切り出し、軽く 上下させる（頭の パーツは 分かれていない）
      //   at … 頭の まんなか（胴体の 画像に 対する 割合）  r … 半径（胴体の 画像の 幅に 対する 割合）  feather … ぼかし
      //   amp … 上下の 大きさ（胴体の 画像の 高さに 対する 割合）
      head: { at: [0.75, 0.4], r: 0.22, feather: 0.05, amp: 0.012, freq: 1, phase: 0.8 },
      stages: {
        1: {
          head: { at: [0.74, 0.42], r: 0.23 },
          place: {
            body: { x: 166, y: 107, rot: -1, scale: 0.975 },
            tail: { at: [0.08, 0.72], rot: 0, scale: 0.9 },
            "rear-far": { at: [0.3, 0.8], rot: 0, scale: 0.8 },
            "front-far": { at: [0.72, 0.72], rot: 0, scale: 0.8 },
            "rear-near": { at: [0.2, 0.82], rot: 0, scale: 0.8 },
            "front-near": { at: [0.55, 0.8], rot: 0, scale: 0.8 },
          },
        },
        2: {
          head: { at: [0.75, 0.4], r: 0.22 },
          place: {
            body: { x: 231, y: 112, rot: -2, scale: 0.965 },
            tail: { at: [0.05, 0.7], rot: 0, scale: 0.9 },
            "rear-far": { at: [0.28, 0.8], rot: 0, scale: 0.8 },
            "front-far": { at: [0.72, 0.72], rot: 0, scale: 0.8 },
            "rear-near": { at: [0.18, 0.82], rot: 0, scale: 0.8 },
            "front-near": { at: [0.55, 0.8], rot: 0, scale: 0.8 },
          },
        },
        3: {
          head: { at: [0.8, 0.32], r: 0.18 },
          place: {
            body: { x: 268, y: 179, rot: -3, scale: 1.045 },
            tail: { at: [0.04, 0.75], rot: 0, scale: 0.9 },
            "rear-far": { at: [0.3, 0.85], rot: 0, scale: 0.8 },
            "front-far": { at: [0.75, 0.68], rot: 0, scale: 0.8 },
            "rear-near": { at: [0.2, 0.88], rot: 0, scale: 0.8 },
            "front-near": { at: [0.62, 0.75], rot: 0, scale: 0.8 },
          },
        },
      },
      back: null,
    },

    // ---------------- ヤドカリ：足を 位相を ずらして 交互に。歩幅に 合わせて 胴体を 上下 ----------------
    hermit: {
      motion: "walk",
      cycle: { idleHz: 0.35, moveHz: 1.8 },
      idleAmp: 0.15,
      parts: {
        body: { pivot: [0.5, 0.8], z: 0 },
        // 対角の 脚を 組に（手前の前脚＋奥の後脚／手前の後脚＋奥の前脚）
        "leg-far-rear": { parent: "body", pivot: [0.7, 0.15], z: -3, swing: { amp: 16, freq: 1, phase: 0 } },
        "leg-far-front": { parent: "body", pivot: [0.7, 0.15], z: -3, swing: { amp: 16, freq: 1, phase: PI } },
        "leg-near-rear": { parent: "body", pivot: [0.7, 0.15], z: -2, swing: { amp: 18, freq: 1, phase: PI } },
        "leg-near-front": { parent: "body", pivot: [0.7, 0.15], z: -2, swing: { amp: 18, freq: 1, phase: 0 } },
        // ハサミは 小さく ゆらす（画面左＝claw-right、画面右＝claw-left）
        //   足は ぜんぶ うしろ。画面 左の claw-right は 胴体の うしろ、画面 右の claw-left は 胴体の 上
        "claw-right": { parent: "body", pivot: [0.2, 0.18], z: -1, swing: { amp: 5, freq: 1, phase: 0.6 } },
        "claw-left": { parent: "body", pivot: [0.2, 0.18], z: 1, swing: { amp: 6, freq: 1, phase: 2.2 } },
      },
      // 歩幅に あわせて 胴体を 上下（1歩ごと＝周期の 2倍）。amp は 胴体の 画像の 高さに 対する 割合
      bob: { amp: 0.02, freq: 2, phase: 0 },
      stages: {
        1: {
          tint: "saturate(0.86) brightness(1.03)",
          place: {
            body: { x: 177, y: 136, rot: 1, scale: 1.07 },
            "leg-far-rear": { at: [0.45, 0.82], rot: 0, scale: 0.6 },
            "leg-far-front": { at: [0.68, 0.82], rot: 0, scale: 0.6 },
            "leg-near-rear": { at: [0.5, 0.86], rot: 0, scale: 0.6 },
            "leg-near-front": { at: [0.75, 0.86], rot: 0, scale: 0.6 },
            "claw-right": { at: [0.55, 0.78], rot: 0, scale: 0.55 },
            "claw-left": { at: [0.82, 0.76], rot: 0, scale: 0.55 },
          },
        },
        2: {
          tint: "saturate(0.9) brightness(1.02)",
          place: {
            body: { x: 189, y: 154, rot: -1, scale: 1.08 },
            "leg-far-rear": { at: [0.5, 0.82], rot: 0, scale: 0.55 },
            "leg-far-front": { at: [0.7, 0.82], rot: 0, scale: 0.55 },
            "leg-near-rear": { at: [0.55, 0.86], rot: 0, scale: 0.55 },
            "leg-near-front": { at: [0.78, 0.86], rot: 0, scale: 0.55 },
            "claw-right": { at: [0.6, 0.8], rot: 0, scale: 0.5 },
            "claw-left": { at: [0.85, 0.78], rot: 0, scale: 0.5 },
          },
        },
        3: {
          tint: "saturate(0.88) brightness(1.03)",
          place: {
            body: { x: 202, y: 168, rot: -2, scale: 1.055 },
            "leg-far-rear": { at: [0.48, 0.84], rot: 0, scale: 0.5 },
            "leg-far-front": { at: [0.7, 0.84], rot: 0, scale: 0.5 },
            "leg-near-rear": { at: [0.53, 0.88], rot: 0, scale: 0.5 },
            "leg-near-front": { at: [0.76, 0.88], rot: 0, scale: 0.5 },
            "claw-right": { at: [0.58, 0.8], rot: 0, scale: 0.5 },
            "claw-left": { at: [0.82, 0.78], rot: 0, scale: 0.5 },
          },
        },
      },
      back: null,
    },
  };

  // 段階ごとの 置き場所・付け根を 合わせた 設定を かえす
  //   over … 確認用ページから 置き場所・付け根を ためしに 差しかえるとき { place, pivot, head }
  BCT.petRigConfig = function (type, stage, over) {
    const base = BCT.PET_RIG[type];
    const st = base && Object.assign({}, base.stages && base.stages[stage], over || {});
    if (!st || !st.place || !st.place.body) return null;
    const parts = {};
    for (const [id, p] of Object.entries(base.parts)) {
      if (!st.place[id]) continue; // 置き場所が きまっていない パーツは つかわない
      // 段階ごとに 親・重ね順を かえられる（正面の絵から 切り出した パーツ：js/pet-rig-cut.js）
      parts[id] = Object.assign({}, p, { pivot: (st.pivot && st.pivot[id]) || p.pivot, place: st.place[id] },
        st.parent && st.parent[id] ? { parent: st.parent[id] } : {}, st.z && st.z[id] != null ? { z: st.z[id] } : {});
    }
    return Object.assign({}, base, { parts, type, stage, cut: !!st.cut, common: BCT.PET_RIG.common, tint: st.tint || "",
      head: base.head ? Object.assign({}, base.head, st.head || {}) : null });
  };
  BCT.petRigFile = (type, stage, part) => `assets/pet-parts/${type}-${stage}-${part}.png`;
})();
