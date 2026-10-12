/* preview-pet-rig.html：パーツ アニメの 確認と 置き場所の 下書き（アプリ本体では 読まない） */
(function () {
  const BCT = window.BCT;
  const $ = (id) => document.getElementById(id);
  const grid = $("grid");
  const cards = {};
  const fitted = {}; // "種類-段階" → 自動で あわせた 置き場所
  const scores = {};

  const equip = () => {
    const v = $("equip").value;
    if (!v) return {};
    const [head, acc] = v.split(",");
    return { head, acc };
  };
  const level = () => Number($("speed").value);

  function draw(c) {
    const eq = equip();
    c.face.innerHTML = BCT.art.render({ type: c.type, stage: c.stage, motion: false, equip: eq }).replace("<svg ", '<svg class="ref" ');
    c.face.querySelector("svg.ref").style.opacity = $("onion").value;
    const over = fitted[c.key];
    const cfg = BCT.petRigConfig(c.type, c.stage, over ? { place: over } : null);
    if (c.rig) BCT.petRig.destroy(c.rig);
    c.rig = null;
    const status = c.el.querySelector(".status");
    const pre = c.el.querySelector("pre");
    if (!cfg) {
      status.textContent = "置き場所が まだ ありません（「自動で あわせる」を おしてください）";
      pre.textContent = "";
      return Promise.resolve(false);
    }
    pre.textContent = Object.entries(cfg.parts).map(([id, p]) =>
      `${id}: ${JSON.stringify(p.place)}${scores[c.key] ? `  わるさ ${scores[c.key][id]}` : ""}`).join("\n");
    c.rig = BCT.petRig.create({ cfg, host: c.face, track: c.el, owner: c.el, equip: eq });
    return c.rig.ready.then((ok) => {
      status.textContent = ok ? (over ? "自動で あわせた 下書きを 表示中" : "設定ファイルの 置き場所") : "パーツを 読めませんでした";
      if (!ok) return false;
      for (const [id, el] of Object.entries(c.rig.parts.els)) {
        const L = c.rig.parts.lay[id];
        el.style.setProperty("--px", L.piv[0] + "px");
        el.style.setProperty("--py", L.piv[1] + "px");
      }
      BCT.petRig.setActive(c.rig, true);
      BCT.petRig.setManualSpeed(c.rig, level() * BCT.PET_RIG.common.speedRef);
      return true;
    });
  }

  // 胴体だけ 自動で あわせる（ほかの パーツは 設定ファイルの まま）
  async function fit(c) {
    const status = c.el.querySelector(".status");
    status.textContent = "さがしています…";
    const t0 = performance.now();
    const res = await BCT.petRigFit.fitBody(c.type, c.stage);
    const st = BCT.PET_RIG[c.type].stages[c.stage] || {};
    fitted[c.key] = Object.assign({}, st.place, { body: res.place });
    scores[c.key] = { body: res.score };
    await draw(c);
    status.textContent += `（胴体 わるさ ${res.score}・${((performance.now() - t0) / 1000).toFixed(1)}秒）`;
    writeAll();
    return res;
  }

  // 設定ファイルに 写せる 形で まとめる
  function writeAll() {
    let out = "";
    for (const [key, place] of Object.entries(fitted)) out += `// ${key}
          body: ${fmt(place.body)},
`;
    $("allOut").value = out;
  }
  const fmt = (p) => `{ x: ${p.x}, y: ${p.y}, rot: ${p.rot}, scale: ${p.scale} }`;

  for (const type of BCT.pets.TYPE_KEYS) for (const stage of [1, 2, 3]) {
    const key = `${type}-${stage}`;
    const el = document.createElement("section");
    el.className = "card";
    el.innerHTML = `<h2><span>${BCT.pets.TYPES[type].motif} ${stage}</span><button data-fit>胴体を 自動で あわせる</button></h2>
      <div class="host"><div class="face"></div></div><div class="status"></div><pre></pre>`;
    grid.appendChild(el);
    const c = { key, el, type, stage, face: el.querySelector(".face"), rig: null };
    el.querySelector("[data-fit]").addEventListener("click", () => fit(c));
    cards[key] = c;
    draw(c);
  }

  $("onion").addEventListener("input", () => document.querySelectorAll("svg.ref").forEach((s) => (s.style.opacity = $("onion").value)));
  $("speed").addEventListener("input", () => {
    $("speedV").textContent = level();
    Object.values(cards).forEach((c) => c.rig && BCT.petRig.setManualSpeed(c.rig, level() * BCT.PET_RIG.common.speedRef));
  });
  $("pivots").addEventListener("change", () => document.body.classList.toggle("show-pivot", $("pivots").checked));
  $("left").addEventListener("change", () => Object.values(cards).forEach((c) => c.el.classList.toggle("left", $("left").checked)));
  $("hideRig").addEventListener("change", () => Object.values(cards).forEach((c) => c.el.classList.toggle("hide-rig", $("hideRig").checked)));
  $("equip").addEventListener("change", () => Object.values(cards).forEach(draw));
  $("fitAll").addEventListener("click", async () => { for (const c of Object.values(cards)) await fit(c); });

  window.previewRig = { cards, fitted, scores, fit, draw, writeAll };
})();
