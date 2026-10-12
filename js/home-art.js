/*
 * ホームの ビーチ・エサ・すみか の 絵（すべて 仮の SVG。本番の絵に 差し替えるときは ここだけ）
 * ------------------------------------------------------------
 *   dropSvg(id)        … エサ（アクアドロップ）
 *   trashSvg(kind)     … ビーチに 流れつく ゴミ（入れる ゴミばこの 色の まるを うしろに しく）
 *   binSvg(key)        … 分別ゴミばこ（色 と マーク）
 *   habitatBg(type)    … すみかの けしき（3しゅるい）
 *   HOME_ART[id]()     … すみかの アイテム（9しゅるい）
 * pet-art.js の itemIcon / icon には さわらず、すみかの アイテムと 新しい アイコンだけ 上から たす。
 */
(function () {
  const BCT = window.BCT;
  let uid = 0;
  const nid = (p) => `${p}h${++uid}`;
  const RAINBOW = ["#ff6b6b", "#ffa94d", "#ffe066", "#69db7c", "#4dabf7", "#b197fc"];

  // ---------------- エサ ----------------
  function dropSvg(id) {
    const f = BCT.foodOf(id);
    const g = nid("d");
    const fill = f && f.color === "rainbow"
      ? `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">${RAINBOW.map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join("")}</linearGradient>`
      : `<radialGradient id="${g}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${f ? f.color : "#4aa8e0"}"/><stop offset="1" stop-color="${f ? f.color : "#4aa8e0"}" stop-opacity=".85"/></radialGradient>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${fill}</defs>
      <path d="M50 8C50 8 20 46 20 64a30 30 0 0 0 60 0C80 46 50 8 50 8Z" fill="url(#${g})" stroke="#ffffff" stroke-width="4"/>
      <ellipse cx="38" cy="58" rx="7" ry="12" fill="#ffffff" opacity=".7" transform="rotate(20 38 58)"/>
      <path d="M72 20 l3 7 7 3 -7 3 -3 7 -3-7 -7-3 7-3Z" fill="#fff6a8" stroke="#f2c230" stroke-width="1"/>
    </svg>`;
  }

  // ---------------- ビーチの ゴミ ----------------
  const TRASH_SHAPE = {
    b_bottle: `<rect x="25" y="20" width="14" height="30" rx="5" fill="#d8eefb" stroke="#5a8fb8" stroke-width="2"/>
      <rect x="28" y="12" width="8" height="9" rx="2" fill="#4aa8e0"/><rect x="25" y="30" width="14" height="7" fill="#7cc8ef"/>`,
    b_bag: `<path d="M18 26 Q32 16 46 26 L44 50 Q32 54 20 50Z" fill="#f2f6fa" stroke="#6f8aa3" stroke-width="2"/>
      <path d="M24 26 Q24 16 28 18 M40 26 Q40 16 36 18" fill="none" stroke="#6f8aa3" stroke-width="2"/>`,
    b_rope: `<circle cx="32" cy="34" r="14" fill="none" stroke="#f08a4b" stroke-width="5"/>
      <circle cx="32" cy="34" r="7" fill="none" stroke="#f08a4b" stroke-width="4"/><path d="M44 40 L52 48" stroke="#f08a4b" stroke-width="4" stroke-linecap="round"/>`,
    b_can: `<rect x="20" y="18" width="24" height="32" rx="4" fill="#d9dde3" stroke="#7d8794" stroke-width="2"/>
      <rect x="20" y="26" width="24" height="12" fill="#f2b531"/><ellipse cx="32" cy="18" rx="12" ry="3" fill="#b8bfc8"/>`,
    b_glass: `<path d="M27 12 h10 v10 q8 4 8 12 v16 q0 4 -4 4 h-18 q-4 0 -4 -4 v-16 q0 -8 8 -12Z" fill="#c9ecd6" fill-opacity=".9" stroke="#3f9a63" stroke-width="2"/>
      <rect x="26" y="34" width="12" height="8" fill="#ffffff" opacity=".6"/>`,
    b_wood: `<path d="M14 40 L48 24" stroke="#9c6b3f" stroke-width="8" stroke-linecap="round"/>
      <path d="M30 32 L34 20" stroke="#9c6b3f" stroke-width="4" stroke-linecap="round"/>`,
    b_paper: `<path d="M18 22 L40 16 L48 38 L26 48 Z" fill="#fbf6ea" stroke="#a0907a" stroke-width="2"/>
      <path d="M24 28 L40 24 M26 34 L42 30 M28 40 L40 36" stroke="#c2b39d" stroke-width="2"/>`,
  };
  function trashSvg(kind) {
    const t = BCT.beachTrashOf(kind);
    const bin = t && BCT.binOf(t.bin);
    const c = bin ? bin.color : "#999";
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="34" r="27" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="3"/>
      ${TRASH_SHAPE[kind] || ""}
    </svg>`;
  }

  // ---------------- ゴミばこ ----------------
  function binSvg(key) {
    const b = BCT.binOf(key);
    const c = b ? b.color : "#999";
    const mark = {
      plastic: `<path d="M40 44 l-6 10 h12Z M30 62 l-5 -9 M50 62 l5 -9" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`,
      canbin: `<rect x="33" y="44" width="14" height="20" rx="3" fill="#fff"/><rect x="33" y="50" width="14" height="5" fill="${c}"/>`,
      burn: `<path d="M40 42 q10 10 6 18 q-2 6 -6 6 q-4 0 -6 -6 q-2 -8 6 -18Z" fill="#fff"/>`,
    }[key] || "";
    return `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 26 h52 l-6 58 q-1 4 -5 4 h-30 q-4 0 -5 -4Z" fill="${c}" stroke="#ffffff" stroke-width="3"/>
      <rect x="8" y="16" width="64" height="12" rx="6" fill="${c}" stroke="#ffffff" stroke-width="3"/>
      <rect x="32" y="8" width="16" height="9" rx="4" fill="${c}" stroke="#ffffff" stroke-width="2"/>
      ${mark}
      <text x="40" y="80" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff" font-family="sans-serif">${b ? b.mark : ""}</text>
    </svg>`;
  }

  // ---------------- すみかの けしき ----------------
  function habitatBg(type) {
    const g = nid("bg");
    if (type === "turtle") {
      // アクア・ガーデン（海の中の アマモの 庭）
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe3e0"/><stop offset="1" stop-color="#3e9fb3"/></linearGradient></defs>
        <rect width="400" height="300" fill="url(#${g})"/>
        <path d="M0 240 Q100 220 200 240 T400 236 V300 H0Z" fill="#e8d9a8"/>
        ${[30, 70, 330, 370, 110, 290].map((x, i) => `<path d="M${x} 250 q${i % 2 ? 10 : -10} -40 0 -80 q${i % 2 ? -8 : 8} -30 0 -50" fill="none" stroke="#4f9f6a" stroke-width="7" stroke-linecap="round" opacity=".85"/>`).join("")}
        ${[60, 180, 250, 340].map((x, i) => `<circle cx="${x}" cy="${60 + i * 30}" r="${6 + i * 2}" fill="#ffffff" opacity=".35"/>`).join("")}
      </svg>`;
    }
    if (type === "hermit") {
      // ビーチ・ヴィレッジ（すなはまの ちいさな 村）
      return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdeefd"/><stop offset="1" stop-color="#f4f9fb"/></linearGradient></defs>
        <rect width="400" height="300" fill="url(#${g})"/>
        <rect y="70" width="400" height="40" fill="#7cc8ef"/>
        <path d="M0 110 Q100 96 200 110 T400 106 V300 H0Z" fill="#f2deb0"/>
        ${[[50, 270], [150, 250], [300, 280], [360, 240]].map(([x, y]) => `<path d="M${x} ${y} l-8 -10 q8 -8 16 0Z" fill="#f6c9b5" stroke="#d99a7c"/>`).join("")}
        <circle cx="340" cy="38" r="20" fill="#ffe28a"/>
      </svg>`;
    }
    // ラグーン・オーシャン（イルカの ラグーン）
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd8f0"/><stop offset="1" stop-color="#2f9fd0"/></linearGradient></defs>
      <rect width="400" height="300" fill="#d6f2fb"/>
      <rect y="60" width="400" height="240" fill="url(#${g})"/>
      <path d="M0 60 Q60 40 120 58 Q160 66 200 58 Q260 44 320 58 Q360 66 400 56 V64 H0Z" fill="#f2deb0"/>
      ${[[40, 120], [140, 180], [260, 130], [340, 210], [90, 250], [220, 240]].map(([x, y]) => `<path d="M${x} ${y} q20 -8 40 0" fill="none" stroke="#ffffff" stroke-width="4" opacity=".6" stroke-linecap="round"/>`).join("")}
    </svg>`;
  }

  // ---------------- すみかの アイテム ----------------
  const HOME_ART = {
    home_dolphin_ring: () => `<ellipse cx="50" cy="52" rx="34" ry="34" fill="none" stroke="#bfe9e2" stroke-width="14"/>
      ${[0, 60, 120, 180, 240, 300].map((a, i) => { const r = (a * Math.PI) / 180; return `<circle cx="${(50 + 34 * Math.cos(r)).toFixed(1)}" cy="${(52 + 34 * Math.sin(r)).toFixed(1)}" r="6" fill="${["#8fd3c7", "#a9d8f5", "#c8e8b5"][i % 3]}" stroke="#ffffff" stroke-width="2"/>`; }).join("")}`,
    home_dolphin_boat: () => `<path d="M14 62 h72 l-10 16 h-52Z" fill="#f2a65a" stroke="#ffffff" stroke-width="3"/>
      <path d="M30 50 h40 l6 12 h-52Z" fill="#7cc8ef" stroke="#ffffff" stroke-width="2"/>
      <path d="M42 50 l-24 -10 h12 l24 10Z M58 50 l24 -10 h-12 l-24 10Z" fill="#69db7c"/>
      ${[20, 34, 48, 62, 76].map((x, i) => `<circle cx="${x}" cy="70" r="3" fill="${RAINBOW[i]}"/>`).join("")}`,
    home_dolphin_tower: () => [0, 1, 2, 3, 4].map((i) => `<path d="M${50 - 22 + i * 3} ${86 - i * 15} q${22 - i * 3} -14 ${44 - i * 6} 0 q-${22 - i * 3} 8 -${44 - i * 6} 0Z" fill="${RAINBOW[i]}" stroke="#ffffff" stroke-width="2"/>`).join("")
      + `<path d="M50 20 l0 -10 M44 14 l6 -6 6 6" stroke="#ff8fa8" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    home_turtle_cushion: () => `<ellipse cx="50" cy="74" rx="40" ry="12" fill="#d8c3a5"/>
      <path d="M14 72 Q50 10 86 72Z" fill="#f4ead6" stroke="#b9a283" stroke-width="3"/>
      ${[[34, 54, "#7cc8ef"], [50, 44, "#f2a65a"], [64, 56, "#69db7c"], [46, 62, "#e2674c"]].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="9" height="9" rx="2" fill="${c}" transform="rotate(20 ${x} ${y})"/>`).join("")}
      <path d="M40 72 a10 10 0 0 1 20 0Z" fill="#7a6650"/>`,
    home_turtle_lantern: () => `<rect x="38" y="18" width="24" height="8" rx="3" fill="#4f9f6a"/>
      <path d="M36 26 h28 q6 10 6 24 v22 q0 8 -8 8 h-24 q-8 0 -8 -8 v-22 q0 -14 6 -24Z" fill="#bfe9d0" fill-opacity=".9" stroke="#4f9f6a" stroke-width="3"/>
      <circle cx="50" cy="56" r="12" fill="#fff3a6"/><circle cx="50" cy="56" r="20" fill="#fff3a6" opacity=".35"/>
      ${[[40, 38], [60, 44], [44, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#ffffff" opacity=".8"/>`).join("")}`,
    home_turtle_bed: () => `<ellipse cx="50" cy="70" rx="42" ry="16" fill="#8fcf8a"/>
      ${Array.from({ length: 11 }, (_, i) => `<path d="M${14 + i * 7} 72 q${i % 2 ? 6 : -6} -16 ${i % 2 ? 2 : -2} -30" fill="none" stroke="${i % 2 ? "#4f9f6a" : "#69b77a"}" stroke-width="5" stroke-linecap="round"/>`).join("")}
      <ellipse cx="50" cy="66" rx="30" ry="9" fill="#bfe6b0"/>`,
    home_hermit_parasol: () => `<path d="M50 20 v52" stroke="#9c6b3f" stroke-width="4"/>
      <path d="M14 36 Q50 0 86 36Z" fill="#ff8fa8" stroke="#ffffff" stroke-width="3"/>
      ${[22, 36, 50, 64, 78].map((x, i) => `<circle cx="${x}" cy="33" r="4" fill="${RAINBOW[i]}"/>`).join("")}
      <rect x="22" y="70" width="56" height="8" rx="3" fill="#4dabf7"/>
      ${[26, 38, 50, 62, 74].map((x, i) => `<circle cx="${x}" cy="74" r="3.5" fill="${RAINBOW[(i + 2) % 6]}"/>`).join("")}
      <path d="M26 78 v12 M74 78 v12" stroke="#4dabf7" stroke-width="4"/>`,
    home_hermit_house: () => `<path d="M18 80 Q14 40 50 22 Q86 40 82 80Z" fill="#f6c9b5" stroke="#d99a7c" stroke-width="3"/>
      <path d="M50 30 q-14 16 -10 34 q14 6 22 -6 q-2 -18 -12 -28" fill="none" stroke="#ffffff" stroke-width="4" opacity=".8"/>
      <path d="M40 80 a10 12 0 0 1 20 0Z" fill="#8a5a44"/>
      ${[[30, 50], [70, 54], [50, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="${RAINBOW[i * 2]}"/>`).join("")}`,
    home_hermit_gym: () => `<path d="M16 84 L36 30 M84 84 L64 30" stroke="#9c6b3f" stroke-width="8" stroke-linecap="round"/>
      <path d="M30 36 h40" stroke="#b07a4a" stroke-width="7" stroke-linecap="round"/>
      ${[48, 60, 72].map((y) => `<path d="M${22 + (84 - y) * 0.2} ${y} h${56 - (84 - y) * 0.4}" stroke="#c99a6a" stroke-width="4"/>`).join("")}
      <path d="M50 36 v20" stroke="#f08a4b" stroke-width="3"/><circle cx="50" cy="60" r="5" fill="#f08a4b"/>`,
  };
  function homeItemSvg(id) {
    const a = HOME_ART[id];
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${a ? a() : ""}</svg>`;
  }

  // ---------------- pet-art.js への 上のせ ----------------
  const baseItemIcon = BCT.art.itemIcon;
  BCT.art.itemIcon = (id, petType) => (HOME_ART[id] ? homeItemSvg(id) : baseItemIcon(id, petType));
  const baseIcon = BCT.art.icon;
  const EXTRA_ICON = {
    food: '<path d="M16 3C16 3 6 16 6 21a10 10 0 0 0 20 0C26 16 16 3 16 3Z" fill="#7cc8ef"/><ellipse cx="12" cy="20" rx="2" ry="4" fill="#ffffff" stroke="none"/>',
    home: '<path d="M4 26 Q16 18 28 26Z" fill="#e8d6a3"/><path d="M8 22 V14 L16 8 L24 14 V22" fill="#f4ead6"/><path d="M6 15 L16 7 L26 15" fill="none"/><path d="M14 22 v-5 h4 v5" fill="#88ad91"/>',
  };
  BCT.art.icon = (key) => EXTRA_ICON[key]
    ? `<svg class="ui-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#354942" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${EXTRA_ICON[key]}</g></svg>`
    : baseIcon(key);

  BCT.homeArt = { dropSvg, trashSvg, binSvg, habitatBg, homeItemSvg, HOME_ART };
})();
