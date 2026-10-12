/*
 * クリーンマップ（Leaflet ＋ OpenStreetMap 標準タイル）
 * OpenStreetMap のタイル利用規約 https://operations.osmfoundation.org/policies/tiles/ を守るため：
 *   - 出典「© OpenStreetMap contributors」を 常に表示する（たたまない）
 *   - タイルの 事前ダウンロード・オフライン保存は しない（Service Worker は タイルを 扱わない）
 *   - リファラーを 消す設定を しない／no-cache を 付けない／ズームは 18 まで
 */
(function () {
  const BCT = window.BCT;
  const { $, ui } = BCT;
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  // ひらいた ときは いつも 志賀町の あたり（北は 穴水町・南は 羽咋市・東は 七尾市 まで 入る 縮尺）
  const DEFAULT_VIEW = { center: [37.01, 136.77], zoom: 10 };

  let map = null, tiles = null, layer = null;
  let tileOk = 0, tileNg = 0;
  let shared = [];
  const photoUrls = [];

  // ちずは「ひろう」画面の中の きりかえ
  const mapVisible = () => ui.current() === "capture" && !$("subMap").hidden;

  function online() {
    return navigator.onLine !== false && typeof L !== "undefined";
  }

  function setOffline(off) {
    $("map").style.display = off ? "none" : "";
    $("mapOff").style.display = off ? "block" : "none";
    $("areaTip").style.display = off ? "none" : $("areaTip").style.display;
  }

  function ensureMap() {
    if (map || typeof L === "undefined") return;
    map = L.map("map", { zoomControl: true, maxZoom: 18, minZoom: 3 });
    tiles = L.tileLayer(TILE_URL, { maxZoom: 18, attribution: ATTRIBUTION });
    tiles.on("tileload", () => { tileOk++; });
    tiles.on("tileerror", () => {
      tileNg++;
      // 1枚も よめずに 失敗が つづいたら 圏外とみなす
      if (tileOk === 0 && tileNg >= 4) setOffline(true);
    });
    tiles.addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on("moveend", areaTip);
    map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  }

  function pinIcon(t) {
    return L.divIcon({
      className: "",
      html: `<div class="pin" style="background:${t.color}"><span>${t.ico}</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 40],
      popupAnchor: [0, -38],
    });
  }

  function fmtTime(t) {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function photoUrl(id) {
    const blob = await BCT.store.getPhoto(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    photoUrls.push(u);
    return u;
  }
  function freePhotos() {
    while (photoUrls.length) URL.revokeObjectURL(photoUrls.pop());
  }

  function allPoints() {
    const mine = BCT.store.get().records.filter((r) => r.lat != null && r.lng != null);
    return mine.map((r) => Object.assign({ mine: true }, r)).concat(shared);
  }

  function drawPins() {
    if (!map) return;
    layer.clearLayers();
    const pts = allPoints();
    pts.forEach((r) => {
      const t = BCT.trashOf(r.type);
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(t), opacity: r.mine ? 1 : 0.7 });
      m.trashType = r.type;
      m.bindPopup(() => {
        const div = document.createElement("div");
        const b = document.createElement("b");
        b.textContent = `${t.ico} ${t.name}`;
        div.appendChild(b);
        div.appendChild(document.createElement("br"));
        div.appendChild(document.createTextNode(fmtTime(r.t)));
        if (r.mine && r.photo) {
          photoUrl(r.id).then((u) => {
            if (!u) return;
            const img = document.createElement("img");
            img.className = "pop-photo";
            img.alt = t.name;
            img.src = u;
            div.appendChild(img);
            m.getPopup() && m.getPopup().update();
          });
        }
        return div;
      });
      m.addTo(layer);
    });
    // 記録が あっても さいしょの 位置は かえない（志賀町の あたり）
    areaTip();
  }

  // いま 見えている はんいの 傾向
  function areaTip() {
    const tip = $("areaTip");
    if (!map) return (tip.style.display = "none");
    const bounds = map.getBounds();
    const cnt = {};
    let n = 0;
    layer.eachLayer((m) => {
      if (bounds.contains(m.getLatLng())) {
        cnt[m.trashType] = (cnt[m.trashType] || 0) + 1;
        n++;
      }
    });
    if (!n) {
      tip.style.display = "block";
      tip.textContent = allPoints().length
        ? "🔎 この はんいには きろくが ないよ。ちずを うごかしてみてね"
        : "🔎 ゴミを きろくすると、ちずに ピンが たつよ";
      return;
    }
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const t = BCT.trashOf(best);
    const pct = Math.round((cnt[best] / n) * 100);
    tip.style.display = "block";
    tip.textContent = `🔎 この はんいでは「${t.ico} ${t.name}」が いちばん おおいよ（${n}こ ちゅう ${cnt[best]}こ・${pct}%）`;
  }

  function renderLegend() {
    $("mapLegend").innerHTML = BCT.TRASH.map(
      (t) => `<span style="border-color:${t.color}">${t.ico} ${t.name}</span>`
    ).join("");
  }

  function renderBars() {
    const recs = BCT.store.get().records;
    const cnt = {};
    recs.forEach((r) => { cnt[r.type] = (cnt[r.type] || 0) + 1; });
    const max = Math.max(1, ...Object.values(cnt));
    $("mapBars").innerHTML = BCT.TRASH.map((t) => {
      const n = cnt[t.key] || 0;
      return `<div class="row"><span class="name">${t.ico} ${t.name}</span>
        <span class="bar"><div style="width:${(n / max) * 100}%;background:${t.color}"></div></span>
        <span class="n">${n}</span></div>`;
    }).join("");
  }

  async function renderList() {
    freePhotos();
    const ul = $("recList");
    const recs = BCT.store.get().records.slice().reverse();
    if (!recs.length) {
      ul.innerHTML = `<li>まだ きろくが ないよ。「ひろう」から きろく してみよう！</li>`;
      return;
    }
    ul.innerHTML = "";
    for (const r of recs) {
      const t = BCT.trashOf(r.type);
      const li = document.createElement("li");
      const thumb = document.createElement("div");
      thumb.className = "noimg";
      thumb.textContent = t.ico;
      li.appendChild(thumb);
      const txt = document.createElement("div");
      txt.innerHTML = `<b>${t.name}</b><br><span class="note">${fmtTime(r.t)}　${r.lat != null ? "📍 ばしょ あり" : "ばしょ なし"}</span>`;
      li.appendChild(txt);
      ul.appendChild(li);
      if (r.photo) {
        photoUrl(r.id).then((u) => {
          if (!u) return;
          const img = document.createElement("img");
          img.src = u;
          img.alt = t.name;
          thumb.replaceWith(img);
        });
      }
    }
  }

  async function show() {
    renderBars();
    renderList();
    // ちずは イベントの 日だけ（js/event-mode.js）。ふだんは かぎの おしらせ と 受付の QR を よむ ボタン
    const open = !BCT.eventMode || BCT.eventMode.isOpen();
    $("mapLock").hidden = open;
    $("mapArea").hidden = !open;
    if (!open) return;
    renderLegend();
    if (!online()) {
      setOffline(true);
      return;
    }
    setOffline(tileOk === 0 && tileNg >= 4);
    ensureMap();
    try { shared = (await BCT.share.fetchSharedRecords()) || []; } catch (e) { shared = []; }
    setTimeout(() => {
      map.invalidateSize();
      drawPins();
    }, 60);
  }

  window.addEventListener("online", () => {
    tileOk = 0;
    tileNg = 0;
    if (mapVisible()) show();
    if (tiles) tiles.redraw();
  });
  window.addEventListener("offline", () => {
    if (mapVisible()) setOffline(true);
  });

  $("mapScan").addEventListener("click", async () => {
    if (await BCT.eventMode.scan()) show();
  });
  if (BCT.eventMode) BCT.eventMode.onChange(() => { if (mapVisible()) show(); });

  BCT.screens.map = { show };
  BCT.mapDebug = () => ({ map, tileOk, tileNg, pins: layer ? layer.getLayers().length : 0 });
})();
