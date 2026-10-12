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
  let locAsked = false;     // この 1けんで「ばしょも きろく する？」を もう きいた
  let locAnswer = null;     // こたえが でたら おわる Promise（true / false）
  let locAsking = null;     // こたえて、さがし おわったら おわる Promise
  let locSearchAt = 0;      // いま 位置を さがして いる（はじめた 時刻。0 = さがして いない）
  let locToken = 0;         // 1けんごとに かわる（まえの 1けんの おそい 結果を つぎに まぜない）

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

  // ---------- 位置（イベントの 日だけ・1けんごとに きく。js/event-mode.js） ----------
  // ふだん（家で つかう とき）は きかない・きろく しない（家の 位置を のこさない）。
  // イベントの 日は、しゃしんを とった あと（しゃしん なしの ときは「きろく する」を おした とき）に
  // 「ばしょも きろく する？」を 毎回 きく。ブラウザで「きょか しない」に なって いる ときは ゆるし かたを 出す。
  // ばしょ なしでも きろく できる。
  const eventOpen = () => !BCT.eventMode || BCT.eventMode.isOpen();
  function setLoc(cls, text) {
    const box = $("locBox");
    box.className = "loc " + (cls || "");
    box.innerHTML = BCT.art.icon("location") + " " + ui.esc(text.replace(/^📍\s*/, ""));
  }
  // いまの ようすを 出す
  function locIdle() {
    if (!eventOpen()) return setLoc("off", "📍 ばしょは イベントの 日だけ きろく するよ（いまは きろく しない）");
    if (loc) return setLoc("ok", `📍 ばしょが わかったよ！（ごさ やく${loc.acc}m）`);
    if (locAsked) return setLoc("off", "📍 こんかいは ばしょを きろく しないよ");
    setLoc("", "📍 しゃしんを とったら、ばしょも きろく するか きくよ");
  }
  function resetLoc() {
    loc = null;
    locAsked = false;
    locAnswer = locAsking = null;
    locSearchAt = 0;
    locToken++;
    locIdle();
  }
  async function geoDenied() {
    try { return (await navigator.permissions.query({ name: "geolocation" })).state === "denied"; } catch (e) { return false; }
  }
  function geoSteps() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      return `<ol class="perm-steps">
          <li>iPhone の <b>「設定」</b> → <b>「プライバシーとセキュリティ」</b> → <b>「位置情報サービス」</b> を オン</li>
          <li>おなじ 画面の <b>「Safari の Web サイト」</b> を <b>「使用中のみ」</b> に する</li>
          <li>Safari の したの <b>「ぁあ」</b> → <b>「Webサイトの設定」</b> → <b>「位置情報」</b> を <b>「許可」</b></li>
        </ol>`;
    }
    if (/Android/.test(ua)) {
      return `<ol class="perm-steps">
          <li>スマホの <b>位置情報</b>（画面の 上から おろした ところ）を オン</li>
          <li>アドレス バーの ひだりの マーク → <b>「権限」</b>（または「サイトの設定」）→ <b>「位置情報」</b> を <b>「許可」</b></li>
          <li>ホーム画面に ついかした アプリの ときは、アイコンを ながおし → <b>「アプリ情報」</b> → <b>「権限」</b> → <b>「位置情報」</b></li>
        </ol>`;
    }
    return `<ol class="perm-steps"><li>ブラウザの アドレス バーの マーク から、この ページの <b>位置情報</b> を <b>「許可」</b> に する</li></ol>`;
  }
  async function geoGuide() {
    const again = await ui.modal(
      `<h3 class="keep">📍 ばしょの きょかが ありません</h3>
       <p class="lead keep">ばしょを きろく するには、おうちの ひとと いっしょに 位置情報を ゆるしてね。</p>
       ${geoSteps()}
       <p class="note keep">ばしょ なしでも きろく できるよ。</p>`,
      [{ label: "ばしょ なしで つづける", cls: "ghost", value: false }, { label: "もういちど ためす", cls: "mint", value: true }]
    );
    if (again) return locate();
    setLoc("ng", "📍 ばしょの きょかが ないよ（このまま きろく できるよ）");
    return null;
  }
  function getPos() {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ ok: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) } }),
        (err) => resolve({ err }),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }
  async function locate() {
    loc = null;
    if (!("geolocation" in navigator)) {
      setLoc("ng", "📍 この スマホでは ばしょが わからないよ（このまま きろく できるよ）");
      return null;
    }
    if (await geoDenied()) return geoGuide();
    setLoc("", "📍 ばしょを しらべているよ…");
    const token = locToken;
    locSearchAt = Date.now();
    const r = await getPos();
    locSearchAt = 0;
    if (token !== locToken) return null; // もう つぎの 1けん
    if (r.ok) {
      loc = r.ok;
      locIdle();
      return loc;
    }
    if (r.err && r.err.code === 1) return geoGuide();
    setLoc("ng", "📍 ばしょが わからなかったよ（このまま きろく できるよ）");
    return null;
  }
  // 「ばしょも きろく する？」（1けんに 1かい。イベントの 日だけ）
  function askLoc() {
    if (!eventOpen()) return Promise.resolve(null);
    if (locAsked) return locAsking || Promise.resolve(loc);
    locAsked = true;
    let answered;
    locAnswer = new Promise((r) => (answered = r));
    locAsking = (async () => {
      const yes = await ui.modal(
        `<h3 class="keep">📍 ばしょも きろく する？</h3>
         <p class="lead keep" style="text-align:center">ゴミが あった ばしょを、<br>イベントの クリーンマップに のせるよ。<br>きろく しなくても だいじょうぶ。</p>`,
        [{ label: "きろく しない", cls: "ghost", value: false }, { label: "ばしょも きろく する", cls: "mint", value: true }]
      );
      answered(!!yes);
      if (!yes) { locIdle(); return null; }
      return locate();
    })();
    return locAsking;
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
    askLoc(); // イベントの 日は「ばしょも きろく する？」
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
    // ばしょ：まだ きいて いなければ ここで きく（しゃしん なしの とき）。
    // こたえ・ゆるし かたの おしらせは おわるまで まつ。位置を さがす のは 10秒まで（それより かかれば ばしょ なし）
    if (eventOpen()) {
      if (!locAsked) askLoc();
      btn.textContent = "ばしょを たしかめているよ…";
      await locAnswer;
      let finished = false;
      locAsking.then(() => (finished = true));
      while (!finished && !(locSearchAt && Date.now() - locSearchAt > 10000)) await new Promise((r) => setTimeout(r, 200));
    }

    const rec = { id: BCT.store.newId(), t: Date.now(), type, lat: null, lng: null, acc: null, photo: false };
    if (loc && eventOpen()) Object.assign(rec, loc); // ふだんは 位置を のこさない
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
    resetLoc();
    renderTypes();
    await BCT.afterGain();
    if (next === "home") ui.show("home");
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
    $("capTitle").textContent = name === "map" ? "クリーンマップ" : "ゴミを みつけたら きろくしよう";
    if (name === "map") BCT.screens.map.show();
    else locIdle();
  }
  if (BCT.eventMode) BCT.eventMode.onChange(locIdle);
  document.querySelectorAll("#scr-capture .seg button").forEach((b) => b.addEventListener("click", () => setSub(b.dataset.sub)));

  BCT.screens.capture = {
    // 位置は ひらいた ときには しらべない（イベントの 日に、1けんごとに きく）
    show(arg) {
      renderTypes();
      setSub(arg === "map" ? "map" : sub);
    },
    refresh: renderTypes,
  };
})();
