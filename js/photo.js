/*
 * いっしょに さつえい（AR風の 記念撮影。カメラ映像に 2Dの ようせいを 重ねる）
 * ------------------------------------------------------------
 * - 床への固定・遮蔽・距離の測定は しない。ようせいは 画面の上に 重ねるだけ。
 * - カメラは「カメラで とる」を おしたときに はじめて つかう。画面を はなれたら すぐ止める。
 * - カメラが つかえないときは「しゃしんを えらぶ」か「うみの はいけい」で 同じように つくれる。
 * - 映像・写真は どこにも 送らない。できた画像も 利用者が ほぞん するまで メモリの中だけ。
 *
 * プレビューと 保存画像を 一致させるしくみ:
 *   画面（ステージ）と 保存画像は おなじ 3:4。ようせいの 位置・大きさは ステージに対する割合で もつ。
 *   はいけいは どちらも「まんなかを 基準に はみ出しを 切る（cover）」。
 *   フレームと文字は 保存画像と おなじ大きさの canvas に 描いて、それを 縮めて 見せている。
 *   前面カメラは 見た目も 保存画像も 左右反転（鏡のように）。ようせいと 文字は 反転しない。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  const W = BCT.CONFIG.photo.width, H = BCT.CONFIG.photo.height;

  let stream = null;
  let facing = "environment";
  let source = null;        // "camera" | "image" | "sea"
  let bgImage = null;       // しゃしん／うみ の Image
  let bgUrl = null;         // えらんだ しゃしんの objectURL
  let resultUrl = null;
  let resultBlob = null;
  let petImg = null;        // ようせいの Image（書き出し用）
  let place = { x: 0.5, y: 0.66, size: 0.55 }; // ステージに対する割合
  let pose = "normal";
  let frame = null;
  let showText = true;
  let frameImg = null;
  let camToken = 0;

  const stage = $("phStage"), video = $("phVideo"), petEl = $("phPet"), overlay = $("phOverlay");

  // ---------------- 表示の切りかえ ----------------
  function setMode(mode) {
    // mode: "start"（はいけいを えらぶ） / "shoot"（うつす） / "result"（できあがり）
    $("phSource").hidden = mode !== "start";
    $("phControls").hidden = mode !== "shoot";
    $("phResult").hidden = mode !== "result";
    stage.hidden = mode === "result";
    petEl.hidden = mode === "start" && !source;
  }
  function message(html) {
    const m = $("phMsg");
    m.innerHTML = html || "";
    m.hidden = !html;
  }

  // ---------------- ようせい ----------------
  async function drawPet() {
    const s = BCT.store.get();
    const svg = pets.renderState(s, { pose, px: 600 });
    petEl.src = BCT.art.toDataUrl(svg);
    try { petImg = await BCT.art.toImage(svg); } catch (e) { petImg = null; }
  }
  function placePet() {
    petEl.style.left = place.x * 100 + "%";
    petEl.style.top = place.y * 100 + "%";
    petEl.style.width = place.size * 100 + "%";
    $("phSize").value = Math.round(place.size * 100);
  }

  // ドラッグで うごかす・ピンチで 大きさ
  const pointers = new Map();
  let gesture = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!source || e.target !== petEl && pointers.size === 0) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = { place: Object.assign({}, place), pts: new Map(pointers) };
    e.preventDefault();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stage.getBoundingClientRect();
    const ids = [...pointers.keys()];
    if (ids.length === 1) {
      const p0 = gesture.pts.get(ids[0]), p1 = pointers.get(ids[0]);
      if (!p0) return;
      place.x = clamp(gesture.place.x + (p1.x - p0.x) / r.width, 0.05, 0.95);
      place.y = clamp(gesture.place.y + (p1.y - p0.y) / r.height, 0.05, 0.95);
    } else if (ids.length >= 2) {
      const d = (m) => Math.hypot(m.get(ids[0]).x - m.get(ids[1]).x, m.get(ids[0]).y - m.get(ids[1]).y);
      if (!gesture.pts.get(ids[1])) { gesture = { place: Object.assign({}, place), pts: new Map(pointers) }; return; }
      place.size = clamp(gesture.place.size * (d(pointers) / Math.max(1, d(gesture.pts))), 0.2, 0.95);
    }
    placePet();
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    gesture = pointers.size ? { place: Object.assign({}, place), pts: new Map(pointers) } : null;
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  $("phSize").addEventListener("input", (e) => { place.size = clamp(e.target.value / 100, 0.2, 0.95); placePet(); });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- はいけい ----------------
  function cameraUnavailableReason() {
    if (!window.isSecureContext) return "カメラは https の ページでしか つかえません（いまの ページは https では ありません）。";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "この ブラウザでは カメラが つかえません。";
    return null;
  }
  const CAM_ERR = {
    NotAllowedError: "カメラの きょかが ありません。ブラウザの せっていで カメラを ゆるすと つかえます。",
    SecurityError: "カメラの きょかが ありません。",
    NotFoundError: "カメラが みつかりませんでした。",
    OverconstrainedError: "この カメラは つかえませんでした。",
    NotReadableError: "ほかの アプリが カメラを つかっているかも しれません。",
  };

  async function startCamera() {
    const why = cameraUnavailableReason();
    if (why) return fallback(why);
    stopCamera();
    const token = ++camToken;
    message(BCT.art.icon("camera") + " カメラを じゅんび しているよ…");
    let st;
    try {
      st = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
    } catch (e) {
      return fallback(CAM_ERR[e.name] || "カメラを うごかせませんでした（" + e.name + "）。");
    }
    // とちゅうで 画面を はなれていたら すぐ止める
    if (token !== camToken || ui.current() !== "photo") {
      st.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = st;
    const settings = st.getVideoTracks()[0].getSettings ? st.getVideoTracks()[0].getSettings() : {};
    if (settings.facingMode) facing = settings.facingMode;
    video.srcObject = st;
    video.hidden = false;
    $("phBg").hidden = true;
    stage.classList.toggle("mirror", facing === "user");
    try { await video.play(); } catch (e) { /* 自動再生できなくても 映像は出る */ }
    source = "camera";
    message("");
    setMode("shoot");
    // カメラが2つ以上 あれば きりかえを 出す
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      $("phSwitch").hidden = devs.filter((d) => d.kind === "videoinput").length < 2;
    } catch (e) {
      $("phSwitch").hidden = true;
    }
  }
  function stopCamera() {
    camToken++;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.pause && video.pause();
    video.srcObject = null;
    video.hidden = true;
    stage.classList.remove("mirror");
  }

  async function useImage(img, kind) {
    stopCamera();
    bgImage = img;
    source = kind;
    const bg = $("phBg");
    bg.src = img.src;
    bg.hidden = false;
    message("");
    setMode("shoot");
    $("phSwitch").hidden = true;
  }
  async function useSea() {
    const img = await BCT.art.toImage(BCT.art.seaSvg(W, H));
    useImage(img, "sea");
  }
  function pickPhoto() {
    $("phFile").value = "";
    $("phFile").click();
  }
  $("phFile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = URL.createObjectURL(f);
    const img = new Image();
    try {
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = bgUrl; });
    } catch (err) {
      return fallback("しゃしんを よめませんでした。べつの しゃしんを えらぶか、うみの はいけいを つかってね。");
    }
    useImage(img, "image");
  });

  function fallback(why) {
    stopCamera();
    source = null;
    setMode("start");
    message(`<b>${ui.esc(why)}</b><br>かわりに「しゃしんを えらぶ」か「うみの はいけい」で つくれるよ。`);
  }

  // ---------------- フレーム・文字（保存画像と おなじ大きさで 描く） ----------------
  async function drawOverlay() {
    const g = overlay.getContext("2d");
    g.clearRect(0, 0, W, H);
    frameImg = null;
    if (frame) {
      try { frameImg = await BCT.art.toImage(BCT.art.frameSvg(frame, W, H)); } catch (e) { frameImg = null; }
      if (frameImg) g.drawImage(frameImg, 0, 0, W, H);
    }
    if (showText) drawText(g);
  }
  function drawText(g) {
    const s = BCT.store.get();
    const d = new Date();
    const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    const ev = BCT.CONFIG.event.name;
    const font = '"Hiragino Maru Gothic ProN","BIZ UDPGothic","Meiryo",sans-serif';
    const banner = frame && BCT.art.FRAME_BANNER[frame];
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (banner) {
      // イベント記念フレームの 帯に イベント名
      g.font = `800 ${Math.round(W * banner.size)}px ${font}`;
      g.fillStyle = banner.color;
      g.fillText(ev, W * banner.x, H * banner.y);
    }
    // したの 帯：ようせいの なまえ ・ イベント名 ・ ひづけ
    const y = H * 0.885, h = H * 0.075;
    g.fillStyle = "rgba(255,255,255,0.82)";
    roundRect(g, W * 0.08, y - h / 2, W * 0.84, h, h / 2);
    g.fill();
    g.fillStyle = "#294753";
    g.font = `800 ${Math.round(W * 0.042)}px ${font}`;
    g.fillText(fit(g, `${s.pet ? s.pet.name : ""} と いっしょに`, W * 0.8), W / 2, y - h * 0.18);
    g.font = `700 ${Math.round(W * 0.028)}px ${font}`;
    g.fillText(fit(g, `${banner ? "" : ev + "　"}${date}`, W * 0.8), W / 2, y + h * 0.27);
    g.restore();
  }
  function fit(g, text, max) {
    let t = text;
    while (t.length > 1 && g.measureText(t).width > max) t = t.slice(0, -1);
    return t === text ? t : t.slice(0, -1) + "…";
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------------- ポーズ・フレームの えらぶ ボタン ----------------
  function renderChips() {
    const s = BCT.store.get();
    const unlocked = game.poses(s);
    const all = BCT.BASE_POSES.map((p) => p.id).concat(Object.keys(BCT.TOY_POSES));
    $("phPoses").innerHTML = all.map((id) => {
      const ok = unlocked.includes(id);
      const name = BCT.poseName(id, s.pet.type);
      return `<button class="chip ${id === pose ? "on" : ""} ${ok ? "" : "locked"}" data-pose="${id}" ${ok ? "" : "disabled"}
        title="${ok ? "" : "おもちゃで 3かい あそぶと つかえるよ"}">${ok ? "" : "🔒 "}${ui.esc(name)}</button>`;
    }).join("");
    const frames = game.ownedItems(s, "frame");
    $("phFrames").innerHTML = `<button class="chip ${!frame ? "on" : ""}" data-frame="">なし</button>` +
      frames.map((f) => `<button class="chip ${frame === f.id ? "on" : ""}" data-frame="${f.id}">${ui.esc(f.name)}</button>`).join("") +
      (frames.length ? "" : `<span class="note">ショップで フレームが かえるよ</span>`);
    document.querySelectorAll("#phPoses [data-pose]").forEach((b) => (b.onclick = () => {
      if (!game.poses(BCT.store.get()).includes(b.dataset.pose)) return; // まだの ポーズは つかえない
      pose = b.dataset.pose;
      renderChips();
      drawPet();
    }));
    document.querySelectorAll("#phFrames [data-frame]").forEach((b) => (b.onclick = () => {
      frame = b.dataset.frame || null;
      renderChips();
      drawOverlay();
    }));
  }
  $("phText").addEventListener("change", (e) => { showText = e.target.checked; drawOverlay(); });

  // ---------------- シャッター（その瞬間を 1まいに） ----------------
  // cover：まんなか基準で はみ出しを 切る（CSS の object-fit: cover と おなじ）
  function drawCover(g, src, sw, sh, mirror) {
    const k = Math.max(W / sw, H / sh);
    const dw = sw * k, dh = sh * k;
    g.save();
    if (mirror) {
      g.translate(W, 0);
      g.scale(-1, 1);
    }
    g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    g.restore();
  }
  async function compose() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#dfede4";
    g.fillRect(0, 0, W, H);
    if (source === "camera" && video.videoWidth) drawCover(g, video, video.videoWidth, video.videoHeight, facing === "user");
    else if (bgImage) drawCover(g, bgImage, bgImage.naturalWidth || W, bgImage.naturalHeight || H, false);
    if (!petImg) await drawPet();
    if (petImg) {
      const size = place.size * W;
      g.drawImage(petImg, place.x * W - size / 2, place.y * H - size / 2, size, size);
    }
    g.drawImage(overlay, 0, 0, W, H);
    return c;
  }
  async function shoot() {
    const btn = $("phShutter");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const c = await compose();
      resultBlob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
      if (!resultBlob) throw new Error("toBlob");
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(resultBlob);
      $("phResultImg").src = resultUrl;
      $("phSaveNote").textContent = "";
      flash();
      setMode("result");
      if (stream) video.pause(); // できあがりを 見ているあいだ 映像を 止める
    } catch (e) {
      console.error(e);
      ui.toast("うまく とれなかったよ。もういちど！");
    } finally {
      btn.disabled = false;
    }
  }
  function flash() {
    const f = document.createElement("div");
    f.className = "ph-flash";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 400);
  }

  // ---------------- ほぞん（端末に あわせて：共有シート か ダウンロード） ----------------
  function fileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `beachclean-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.jpg`;
  }
  async function save() {
    if (!resultBlob) return;
    const note = $("phSaveNote");
    const file = typeof File === "function" ? new File([resultBlob], fileName(), { type: "image/jpeg" }) : null;
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: BCT.CONFIG.event.name });
        note.textContent = "「画像を保存」などを えらぶと スマホに のこるよ。";
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return; // やめた だけ
      console.warn(e);
    }
    try {
      const a = document.createElement("a");
      a.href = resultUrl;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      note.textContent = "ダウンロード しました。うまく いかないときは、上の しゃしんを ながおし して ほぞんしてね。";
    } catch (e) {
      note.textContent = "ほぞん できませんでした。上の しゃしんを ながおし して「画像を保存」を えらんでね。";
    }
  }

  // ---------------- ボタン ----------------
  $("phCam").addEventListener("click", startCamera);
  $("phPick").addEventListener("click", pickPhoto);
  $("phSea").addEventListener("click", useSea);
  $("phShutter").addEventListener("click", shoot);
  $("phSave").addEventListener("click", save);
  $("phRetake").addEventListener("click", () => {
    setMode("shoot");
    if (stream) video.play().catch(() => {});
  });
  $("phChange").addEventListener("click", () => {
    stopCamera();
    source = null;
    $("phBg").hidden = true;
    setMode("start");
    message("はいけいを えらんでね");
  });
  $("phSwitch").addEventListener("click", () => {
    facing = facing === "user" ? "environment" : "user";
    startCamera();
  });
  $("phBack").addEventListener("click", () => ui.show("home"));

  // 画面が かくれたら カメラを 止める（もどったら もういちど 押してもらう）
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && stream) {
      stopCamera();
      source = null;
      setMode("start");
      message("カメラを とめたよ。もういちど「カメラで とる」を おしてね");
    }
  });
  window.addEventListener("pagehide", stopCamera);

  BCT.photo = { compose, place, get state() { return { source, pose, frame, place, facing, showText }; } };
  BCT.screens.photo = {
    show() {
      const s = BCT.store.get();
      if (!s.pet) return ui.show("egg");
      frame = s.equip.frame || null;
      pose = game.poses(s).includes(pose) ? pose : "normal";
      source = null;
      $("phBg").hidden = true;
      video.hidden = true;
      placePet();
      renderChips();
      drawPet();
      drawOverlay();
      setMode("start");
      const why = cameraUnavailableReason();
      message(why
        ? `<b>${ui.esc(why)}</b><br>「しゃしんを えらぶ」か「うみの はいけい」で つくれるよ。`
        : "はいけいを えらんでね。<br>ようせいは ゆびで うごかせるよ");
      $("phCam").disabled = !!why;
    },
    hide() {
      stopCamera();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (bgUrl) URL.revokeObjectURL(bgUrl);
      resultUrl = bgUrl = null;
      resultBlob = null;
      bgImage = null;
      $("phResultImg").removeAttribute("src");
      $("phBg").removeAttribute("src");
    },
  };
})();
