/*
 * バックアップ・ふくげん（SHIKA COLLECTION と おなじ しくみ。設定の「おうちの かたへ」から つかう）
 * ------------------------------------------------------------
 * そだてた ようせい・記録（bct-state）、この 端末の 設定（bct-prefs）、ゴミの 写真（IndexedDB）を
 * 1つの ファイル（.json）に まとめて、利用者の 端末に 保存する。アカウントも サーバーも つかわない。
 * もどす ときは、ファイルの 形・こわれていないか（チェックサム）・中身の 形を たしかめてから、いまの データと おきかえる。
 * 1つでも おかしければ、いまの データは そのまま。チェックサムは とりちがえ・こわれの 検知用で、暗号ではない。
 * 運営画面の データ（bct-operator-v1）は 運営の 端末の ものなので ふくめない。
 */
(function () {
  const BCT = window.BCT;
  const { ui } = BCT;
  const FORMAT = "bct-backup";
  const FORMAT_VERSION = 1;
  const SCHEMA = 2;                       // js/storage.js の SCHEMA と おなじ
  const MAX_PHOTO = 3 * 1024 * 1024;      // 写真 1まいの 上限（data URL の 文字数）

  // FNV-1a（かるい とりちがえ・こわれの 検知用）
  function checksum(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  const sumOf = (p) => checksum(JSON.stringify({ state: p.state, prefs: p.prefs, photos: p.photos }));

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  function dataUrlToBlob(u) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(u);
    if (!m) return null;
    const bin = atob(m[2]);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: m[1] });
  }

  async function build() {
    const state = BCT.store.get();
    const photos = {};
    for (const r of state.records) {
      if (!r.photo) continue;
      const b = await BCT.store.getPhoto(r.id);
      if (b) photos[r.id] = await blobToDataUrl(b);
    }
    const p = {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      app: "ビーチクリーン探検隊",
      appVersion: BCT.update ? await BCT.update.version() : "",
      exportedAt: new Date().toISOString(),
      state,
      prefs: BCT.prefs.get(),
      photos,
    };
    p.checksum = sumOf(p);
    return p;
  }

  async function save() {
    let p;
    try {
      p = await build();
    } catch (e) {
      console.warn(e);
      ui.toast("バックアップを つくれませんでした");
      return false;
    }
    const blob = new Blob([JSON.stringify(p)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `clean-quest-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    ui.toast("バックアップファイルを ほぞん しました");
    return true;
  }

  // ファイルの 中身を たしかめる（もんだいが あれば 理由の 文、なければ null）
  function validate(o) {
    const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    if (!isObj(o)) return "ファイルの 形が ちがいます。";
    if (o.format !== FORMAT) return "この アプリの バックアップファイルでは ありません。";
    if (typeof o.formatVersion !== "number" || o.formatVersion > FORMAT_VERSION) {
      return "あたらしい 形の ファイルです。アプリを こうしん してから ためしてください。";
    }
    if (!isObj(o.state)) return "データが 入っていません。";
    if (o.state.v !== SCHEMA) return "この バージョンの アプリでは よめない データです。";
    if (o.checksum && o.checksum !== sumOf(o)) return "ファイルが こわれている かもしれません。";
    const s = o.state;
    if (s.records != null && !Array.isArray(s.records)) return "ゴミの きろくが こわれています。";
    if (s.claims != null && !isObj(s.claims)) return "ごほうびの きろくが こわれています。";
    if (s.owned != null && !isObj(s.owned)) return "アイテムの きろくが こわれています。";
    if (s.pet != null && !isObj(s.pet)) return "ようせいの きろくが こわれています。";
    if (o.prefs != null && !isObj(o.prefs)) return "設定の きろくが こわれています。";
    if (o.photos != null) {
      if (!isObj(o.photos)) return "写真の きろくが こわれています。";
      for (const v of Object.values(o.photos)) {
        if (typeof v !== "string" || v.length > MAX_PHOTO || !dataUrlToBlob(v)) return "写真の きろくが こわれています。";
      }
    }
    return null;
  }

  function pickFile() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.style.display = "none";
      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        input.remove();
        resolve(f || null);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  const fail = (msg) => ui.modal(`<h3>もどせませんでした</h3><p class="lead" style="text-align:center">${msg}</p>`,
    [{ label: "とじる", cls: "mint", value: null }]);

  async function restoreFile(file) {
    if (!file) return false;
    let o = null;
    try {
      o = JSON.parse(await file.text());
    } catch (e) {
      await fail("ファイルを よみとれませんでした。");
      return false;
    }
    const err = validate(o);
    if (err) { await fail(err); return false; }
    const s = BCT.store.sanitize(o.state);
    const g = BCT.game;
    const when = typeof o.exportedAt === "string" ? o.exportedAt.slice(0, 10) : "ふめい";
    const who = s.pet ? `${ui.esc(s.pet.name)}（Lv${g.level(s)}）` : "まだ たまご";
    const ok1 = await ui.modal(
      `<h3 class="keep">バックアップから もどしますか？</h3>
       <p class="lead keep" style="text-align:center">ほぞんした日：${ui.esc(when)}<br>ようせい：${who}<br>
         たんけんたいメダル ${g.coins(s).toLocaleString("ja-JP")}枚 ／ ゴミの きろく ${s.records.length}こ</p>
       <p class="note" style="text-align:center">いまの データは ぜんぶ おきかわります。</p>`,
      [{ label: "やめる", cls: "ghost", value: false }, { label: "もどす", cls: "mint", value: true }]
    );
    if (!ok1) return false;
    const ok2 = await ui.modal(
      `<h3 class="keep">ほんとうに もどしますか？</h3><p class="lead keep" style="text-align:center">いまの ようせい・きろく・写真は きえて、<br>バックアップの ないように なります。</p>`,
      [{ label: "やめる", cls: "ghost", value: false }, { label: "もどす", cls: "peach", value: true }]
    );
    if (!ok2) return false;
    // 1. 育成・記録（保存できなければ いまの まま）
    if (!BCT.store.replace(s)) {
      await fail("この 端末に ほぞん できませんでした。いまの データは そのままです。");
      return false;
    }
    // 2. 写真（きろくに ある ものだけ）
    try {
      await BCT.store.clearPhotos();
      const ids = new Set(s.records.filter((r) => r.photo).map((r) => r.id));
      for (const [id, u] of Object.entries(o.photos || {})) {
        if (!ids.has(id)) continue;
        const b = dataUrlToBlob(u);
        if (b) await BCT.store.putPhoto(id, b);
      }
    } catch (e) {
      console.warn("写真を もどせませんでした", e);
    }
    // 3. 端末の 設定（うごきを へらす など）
    if (o.prefs) for (const [k, v] of Object.entries(o.prefs)) if (typeof v === "boolean") BCT.prefs.set(k, v);
    // 4. ひらきなおして ぜんぶの 画面に 反映
    try { sessionStorage.setItem("bct-restored", "1"); } catch (e) { /* なし */ }
    location.reload();
    return true;
  }

  async function restore() {
    return restoreFile(await pickFile());
  }

  // ひらきなおした あとに「もどしました」
  try {
    if (sessionStorage.getItem("bct-restored")) {
      sessionStorage.removeItem("bct-restored");
      window.addEventListener("load", () => setTimeout(() => ui.toast("バックアップから もどしました"), 600));
    }
  } catch (e) { /* なし */ }

  BCT.backup = { build, save, validate, restore, restoreFile, checksum };
})();
