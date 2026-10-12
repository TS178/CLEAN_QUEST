/*
 * ひろう：しゃしん → ばしょ → しゅるい → きろく（＋ ちず への きりかえ）
 * ごほうびは ゴミの しゅるいごとに 1かい（そうじミッション。js/game.js の claim）。
 * 2こめ いこうの きろくも マップ・称号・運営集計には 入る。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets, game } = BCT;

  let photoBlob = null;
  let photoJob = null;      // しゃしんを ちいさくしている とちゅうの Promise
  let photoUrl = null;
  let type = null;
  let loc = null;           // { lat, lng, acc }
  let locWait = null;       // 位置を さがしている Promise

  // ---------- 種類ボタン ----------
  function renderTypes() {
    const g = $("typeGrid");
    const s = BCT.store.get();
    g.innerHTML = "";
    BCT.TRASH.forEach((t) => {
      const b = document.createElement("button");
      b.className = "type-btn" + (t.key === type ? " on" : "");
      b.dataset.type = t.key;
      const fresh = t.mission && !game.isClaimed(s, "clean", t.key);
      b.innerHTML = `${fresh ? `<span class="star" title="ごほうび あり">★</span>` : ""}<span class="ico clean-art">${BCT.collectionArt.missionIcon(t.key)}</span>${t.name}`;
      b.addEventListener("click", () => {
        type = t.key;
        g.querySelectorAll(".type-btn").forEach((x) => x.classList.toggle("on", x === b));
        updateBtn();
      });
      g.appendChild(b);
    });
  }
  function updateBtn() {
    const btn = $("recBtn");
    btn.disabled = !type || !!photoJob;
    btn.textContent = photoJob ? "しゃしんを じゅんびちゅう…" : !type ? "② の しゅるいを えらんでね"
      : photoBlob ? "きろく する！" : "しゃしん なしで きろく する";
  }

  // ---------- 位置 ----------
  function setLoc(cls, text) {
    const box = $("locBox");
    box.className = "loc " + (cls || "");
    box.innerHTML = BCT.art.icon("location") + " " + ui.esc(text.replace(/^📍\s*/, ""));
  }
  function locate() {
    loc = null;
    if (!("geolocation" in navigator)) {
      setLoc("ng", "📍 この スマホでは ばしょが わからないよ（このまま きろく できるよ）");
      locWait = Promise.resolve(null);
      return;
    }
    setLoc("", "📍 ばしょを しらべているよ…");
    locWait = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          loc = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) };
          setLoc("ok", `📍 ばしょが わかったよ！（ごさ やく${loc.acc}m）`);
          resolve(loc);
        },
        (err) => {
          const why = err.code === 1 ? "ばしょの きょかが ないよ。おうちの ひとに きいてね" : "ばしょが わからなかったよ";
          setLoc("ng", `📍 ${why}（このまま きろく できるよ）`);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }

  // ---------- 写真 ----------
  async function shrink(file, max) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.75));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onPhoto(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    photoJob = shrink(f, 640);
    updateBtn();
    try {
      photoBlob = await photoJob;
    } catch (err) {
      photoBlob = null;
      ui.toast("しゃしんを よめなかったよ");
      updateBtn();
      return;
    } finally {
      photoJob = null;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(photoBlob);
    $("shotImg").src = photoUrl;
    $("shotBtn").style.display = "none";
    $("shotPreview").style.display = "block";
    updateBtn();
  }

  function resetForm() {
    photoBlob = null;
    type = null;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    $("shotImg").removeAttribute("src");
    $("shotBtn").style.display = "";
    $("shotPreview").style.display = "none";
    document.querySelectorAll(".type-btn").forEach((x) => x.classList.remove("on"));
    updateBtn();
  }

  // ---------- 記録 ----------
  async function record() {
    if (!type) return;
    const btn = $("recBtn");
    btn.disabled = true;
    // しゃしんの じゅんびが まだなら まつ
    if (photoJob) await photoJob.catch(() => {});
    // 位置が まだなら すこしだけ まつ
    if (!loc && locWait) await Promise.race([locWait, new Promise((r) => setTimeout(r, 3000))]);

    const rec = { id: BCT.store.newId(), t: Date.now(), type, lat: null, lng: null, acc: null, photo: false };
    if (loc) Object.assign(rec, loc);
    if (photoBlob) {
      try {
        await BCT.store.putPhoto(rec.id, photoBlob);
        rec.photo = true;
      } catch (e) {
        console.warn("写真を保存できませんでした", e);
      }
    }
    BCT.store.update((st) => { st.records.push(rec); });
    if (BCT.share.enabled) BCT.share.sendRecord(rec).catch(() => {});

    // そうじミッション（しゅるいごとに 1かい。二重には もらえない）
    const t = BCT.trashOf(type);
    const r = t.mission ? game.claim("clean", t.key) : { ok: false, err: "notmission" };
    const after = BCT.store.get();
    const msg = r.ok
      ? `<p class="mission-clear">🎯 ミッション クリア！<br>「${ui.esc(BCT.missionName(t))}」</p>${ui.gainHtml(r)}`
      : t.mission
        ? `<p class="lead">この しゅるいの ミッションは クリアずみ。<br>きろくは ちずに のこるよ！</p>`
        : `<p class="lead">きろく したよ！ ちずに のこるよ。<br><small>びんは われていると あぶないので、ごほうびは ないよ</small></p>`;
    const next = await ui.modal(
      `<div style="width:150px;margin:0 auto">${pets.renderState(after, { lv: Math.min(after.seenLv, game.level(after)), face: "happy" })}</div>
       <p class="lead" style="color:var(--ink);margin-bottom:4px"><span class="clean-art record-art">${BCT.collectionArt.missionIcon(t.key)}</span> ${t.name} を きろくしたよ！</p>
       ${msg}
       <p class="lead" style="color:var(--ink)">「${ui.esc(pets.randomThanks())}」</p>`,
      [{ label: "ホームへ", cls: "ghost", value: "home" }, { label: "もっと きろく", cls: "mint", value: "more" }]
    );
    resetForm();
    renderTypes();
    await BCT.afterGain();
    if (next === "home") ui.show("home");
    else locate();
  }

  $("shotInput").addEventListener("change", onPhoto);
  $("shotRetake").addEventListener("click", () => $("shotInput").click());
  $("recBtn").addEventListener("click", record);
  renderTypes();
  updateBtn();

  // ---------- きろく ／ ちず の きりかえ ----------
  let sub = "rec";
  function setSub(name) {
    sub = name;
    document.querySelectorAll("#scr-capture .seg button").forEach((b) => b.classList.toggle("on", b.dataset.sub === name));
    $("subRec").hidden = name !== "rec";
    $("subMap").hidden = name !== "map";
    if (name === "map") BCT.screens.map.show();
    else locate();
  }
  document.querySelectorAll("#scr-capture .seg button").forEach((b) => b.addEventListener("click", () => setSub(b.dataset.sub)));

  BCT.screens.capture = {
    // ひらくたびに いまの 位置を しらべなおす（うごきまわるので）
    show(arg) {
      renderTypes();
      setSub(arg === "map" ? "map" : sub);
    },
    refresh: renderTypes,
  };
})();
