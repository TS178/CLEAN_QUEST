/*
 * プラごみバスターズの 絵（既存のゴミ素材・自作SVG・生成したごほうびボックス）
 * ------------------------------------------------------------
 * かいじゅうの からだは、アプリに ある ゴミの 絵（BCT.COLLECTION_SPRITES の b_bottle など。ホームの ビーチと おなじ）。
 * その 上に、自作の SVG で かお（おおきな め・ほっぺ・くち）と ちいさな うでを かさねて、こわくない コミカルな かいじゅうに する。
 * svg の 中に HTML を いれない（foreignObject は iPhone で ずれる ため。js/pet-art-fix.js）。かさねるのは HTML の 要素どうし。
 *   monster(m)      … かいじゅう 1たい（ふつう・おおがた・あぶない）の HTML
 *   recycleBox()    … リザルトの リサイクルボックス（ふたが ひらく）
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const sprite = (kind) => (BCT.COLLECTION_SPRITES && BCT.COLLECTION_SPRITES[kind]) || null;

  // かおの 位置（ゴミの 絵に 対する 割合）と かたむき、おおきさ（絵の はばに 対する 割合）
  const FACE = {
    b_bottle: { x: 0.47, y: 0.57, rot: 18, w: 0.6 },
    b_bag: { x: 0.45, y: 0.6, rot: -4, w: 0.56 },
    b_can: { x: 0.5, y: 0.6, rot: 14, w: 0.56 },
    b_glass: { x: 0.45, y: 0.62, rot: 38, w: 0.5 },
    b_wood: { x: 0.45, y: 0.62, rot: -8, w: 0.52 },
    b_rope: { x: 0.44, y: 0.47, rot: 0, w: 0.56 },
  };

  // かお（viewBox -40 0 180 84。うでは かおの そとがわ）
  //   mood: "grr"（ふつう：がおー）／ "hit"（めが ×）／ "fear"（あぶない：あせ）／ "boss"（まゆが ふとい）
  function faceSvg(mood) {
    const eye = (cx) => mood === "hit"
      ? `<path d="M${cx - 9} 18 l18 18 M${cx + 9} 18 l-18 18" stroke="#2c3a4a" stroke-width="6" stroke-linecap="round"/>`
      : `<circle cx="${cx}" cy="27" r="15" fill="#fff" stroke="#2c3a4a" stroke-width="3.5"/>
         <circle cx="${cx + 3}" cy="29" r="8" fill="#2c3a4a"/><circle cx="${cx + 6}" cy="25" r="3" fill="#fff"/>`;
    const brows = mood === "boss"
      ? `<path d="M14 6 L42 14 M86 6 L58 14" stroke="#2c3a4a" stroke-width="7" stroke-linecap="round"/>`
      : mood === "grr" ? `<path d="M16 9 L38 14 M84 9 L62 14" stroke="#2c3a4a" stroke-width="4.5" stroke-linecap="round"/>` : "";
    const mouth = mood === "hit"
      ? `<ellipse cx="50" cy="60" rx="9" ry="7" fill="#2c3a4a"/>`
      : mood === "fear"
        ? `<path d="M34 62 q8 -8 16 0 q8 8 16 0" fill="none" stroke="#2c3a4a" stroke-width="4" stroke-linecap="round"/>`
        : `<path d="M30 52 q20 22 40 0 z" fill="#c4434f" stroke="#2c3a4a" stroke-width="3.5" stroke-linejoin="round"/>
           <path d="M37 53 l4 7 l4 -7 M55 53 l4 7 l4 -7" fill="#fff" stroke="#2c3a4a" stroke-width="1.5" stroke-linejoin="round"/>`;
    const sweat = mood === "fear" ? `<path d="M96 6 q8 12 0 16 q-8 -4 0 -16z" fill="#7fd0ff" stroke="#3a7ab0" stroke-width="2"/>` : "";
    const arm = (side) => {
      const s = side < 0 ? -1 : 1, x0 = side < 0 ? 4 : 96;
      return `<g class="pb-arm ${side < 0 ? "l" : "r"}"><path d="M${x0} 52 q${s * 22} 0 ${s * 30} -18" fill="none" stroke="#2c3a4a" stroke-width="6" stroke-linecap="round"/>
        <circle cx="${x0 + s * 31}" cy="31" r="8" fill="#fff" stroke="#2c3a4a" stroke-width="3.5"/></g>`;
    };
    return `<svg class="pb-face" viewBox="-40 0 180 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${arm(-1)}${arm(1)}
      <ellipse cx="16" cy="48" rx="9" ry="5.5" fill="#ff8fa3" opacity=".75"/><ellipse cx="84" cy="48" rx="9" ry="5.5" fill="#ff8fa3" opacity=".75"/>
      ${brows}${eye(28)}${eye(72)}${mouth}${sweat}
    </svg>`;
  }

  // われた びんの ひび（あぶない かいじゅうだけ）
  const CRACK = `<svg class="pb-crack" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M58 6 L50 26 L62 34 L46 52 L58 60 L44 84" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M58 6 L50 26 L62 34 L46 52 L58 60 L44 84" fill="none" stroke="#5a2a0a" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M50 26 L38 22 M46 52 L32 56" fill="none" stroke="#fff" stroke-width="2.4"/>
  </svg>`;

  // かいじゅう 1たい。m … js/plabusters-engine.js の monster
  function monster(m, mood) {
    if (m.type === 'boss') {
      const bag = m.kind === 'b_bag';
      const ratio = bag ? '348 / 462' : '288 / 481';
      return `<div class="pb-monster type-boss" data-id="${m.id}" data-kind="${m.kind}" style="--boss-width-limit:${bag ? 51 : 40}cqh">
        <span class="pb-tag boss">${m.name}</span>
        <div class="pb-mon-body" style="aspect-ratio:${ratio}"><img class="pb-mon-img pb-boss-art" src="assets/plabusters/boss-${bag ? 'bag' : 'bottle'}-king.svg" alt="" draggable="false"></div>
        <div class="pb-hp" aria-hidden="true">${"<i></i>".repeat(m.hp)}</div></div>`;
    }
    const sp = sprite(m.kind);
    const f = FACE[m.kind] || FACE.b_bag;
    const face = mood || (m.type === "danger" ? "fear" : m.type === "boss" ? "boss" : "grr");
    const ratio = sp ? `${sp.width} / ${sp.height}` : "1 / 1";
    const t = BCT.beachTrashOf && BCT.beachTrashOf(m.kind);
    const tag = m.type === "danger" ? `<span class="pb-tag danger">⚠ われた びん</span>`
      : m.type === "boss" ? `<span class="pb-tag boss">${m.name}</span>`
      : `<span class="pb-tag"><img src="${sp ? sp.src : ""}" alt="">${t ? t.name : ""}</span>`;
    return `<div class="pb-monster type-${m.type}" data-id="${m.id}" data-kind="${m.kind}">
      ${tag}
      <div class="pb-mon-body" style="aspect-ratio:${ratio}">
        <img class="pb-mon-img" src="${sp ? sp.src : ""}" alt="" draggable="false">
        ${m.type === "danger" ? CRACK : ""}
        <div class="pb-mon-face" style="left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 180 / 100 * 100}%;transform:translate(-50%,-50%) rotate(${f.rot}deg)">${faceSvg(face)}</div>
      </div>
      ${m.type === "boss" ? `<div class="pb-hp" aria-hidden="true">${"<i></i>".repeat(m.hp)}</div>` : ""}
    </div>`;
  }

  // ホームの分別ボックス・収集車と同じ画風。左が閉じた状態、右が開いた状態。
  function recycleBox() {
    return `<span class="pb-box" role="img" aria-label="リサイクルボックス">
      <span class="pb-box-state pb-box-closed"><img src="assets/plabusters/reward-box-v1.webp" width="1024" height="512" alt="" draggable="false"></span>
      <span class="pb-box-state pb-box-open"><img src="assets/plabusters/reward-box-v1.webp" width="1024" height="512" alt="" draggable="false"></span>
    </span>`;
  }

  // ビーチの ゴミ（よごれた はまべの かざり。きれいに なると きえる）
  function litter() {
    // ようせい（ひだり した）に かさならない ところ
    const spots = [[38, 92, "b_can", 15], [62, 90, "b_wood", 25], [88, 76, "b_rope", -10], [76, 95, "b_bag", 8], [48, 74, "b_glass", -35], [93, 92, "b_bottle", -20]];
    return spots.map(([x, y, k, r]) => {
      const sp = sprite(k);
      return sp ? `<img class="pb-litter" src="${sp.src}" alt="" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${r}deg)">` : "";
    }).join("");
  }

  BCT.plaBustersArt = { monster, faceSvg, recycleBox, litter, FACE };
})();
