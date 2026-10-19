/*
 * Service Worker：アプリ本体を 端末に 保存して、圏外でも 動くようにする
 * ------------------------------------------------------------
 * アプリのファイルを 書きかえたら APP_VERSION を 上げること（上げないと 利用者に 届かない）。
 * 版は「1.○○」の 形（例 1.15 → 1.16）。設定の 画面に そのまま 出る。
 * 新しい 版は すぐには 入れかえず、アプリが「あたらしい バージョンが あります」を 出して、
 * 「こうしん する」が おされたら（SKIP_WAITING）入れかえる（js/update.js。SHIKA COLLECTION と おなじ）。
 *
 * OpenStreetMap のタイル利用規約に 従い、地図タイル（よその サイトへの 通信）には
 * 一切 手を 出さない。fetch の 横取りは 同じ サイトの ファイルだけ。
 *
 * ようせいの パーツ画像（assets/pet-parts、3種類 ぜんぶで 約3.5MB）は ここには 入れない。
 * 自分の 種類の ぶんだけ ホームで 先に 読み（js/pet-rig.js の prefetch）、下の fetch で 保存する。
 *
 * ホームの 波の 動画（assets/ui/beach-waves.mp4、約6MB）にも 手を ださない（ブラウザに まかせる）。
 * 動画は 少しずつ（Range で）読まれるため、ここで まとめて 返すと iPhone で 再生 できない ことが ある。
 * 圏外の ときは 動画が 読めず、いままでの 絵（beach.webp。ここで 保存している）の まま になる。
 */
const APP_VERSION = "1.34";
const CACHE = "bct-" + APP_VERSION;
const FILES = [
  "./",
  "index.html",
  "operator.html",
  "manifest.json",
  "css/app.css",
  "css/truck-shoot.css",
  "assets/truck-shoot/coast-inland-v1.webp",
  "assets/truck-shoot/recycling-truck-v1.webp",
  "css/collection.css",
  "css/ar.css",
  "css/beach.css",
  "css/pet-rig.css",
  "css/collection-painted.css",
  "css/ui-design.css",
  "css/companions.css",
  "js/companions.js",
  "js/habitat-sizing.js",
  "js/habitat-size-defaults.js",
  "js/habitat-size-schema.js",
  "assets/ui/medal.webp",
  "assets/ui/beach.webp",
  "assets/ui/lighthouse-coast.png",
  "assets/beach/sakura-shell.png",
  "assets/beach/sea-glass.png",
  "assets/ui/camera.webp",
  "assets/ui/dress.webp",
  "assets/ui/album.webp",
  "assets/ui/map.webp",
  "assets/items/toy_ball.webp",
  "assets/habitats/habitat_dolphin.webp",
  "assets/habitats/habitat_turtle.webp",
  "assets/habitats/habitat_hermit.webp",
  "js/ui-design.js",
  "icons/seascape.svg",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "icons/favicon-48.png",
  "icons/apple-touch-icon.png",
  "icons/icon-maskable-512.png",
  "js/update.js",
  "js/backup.js",
  "js/pond-video.js",
  "js/event-mode.js",
  "js/config.js",
  "js/items.js",
  "js/trash.js",
  "js/quiz-data.js",
  "js/storage.js",
  "js/game.js",
  "js/pets.js",
  "js/pet-sprites.js",
  "js/pet-art.js",
  "js/pet-art-fix.js",
  "js/equipment-placement.js",
  "js/pet-motion.js",
  "js/pet-rig-config.js",
  "js/pet-rig-cut.js",
  "js/pet-rig.js",
  "js/pet-skin.js",
  "js/home-art.js",
  "js/habitat-sprites.js",
  "js/habitat-painted-art.js",
  "js/collection-sprites.js",
  "js/mission-sprites.js",
  "js/collection-art.js",
  "js/badges.js",
  "js/share.js",
  "js/app.js",
  "js/coin-fly.js",
  "js/camera-permission.js",
  "js/swipe-back.js",
  "js/egg.js",
  "js/home.js",
  "js/beach.js",
  "js/habitat.js",
  "js/mission.js",
  "js/truck-shoot-physics.js",
  "js/truck-shoot-view.js",
  "js/truck-shoot.js",
  "js/capture.js",
  "js/map.js",
  "js/shop.js",
  "js/dressup.js",
  "js/photo.js",
  "js/ar-math.js",
  "js/ar.js",
  "js/profile.js",
  "js/settings.js",
  "js/admin.js",
  "js/operator.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/images/layers.png",
  "vendor/leaflet/images/layers-2x.png",
  "vendor/leaflet/images/marker-icon.png",
  "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-shadow.png",
  "vendor/leaflet/LICENSE.txt",
  "vendor/qrcode/qrcode.js",
  "vendor/qrcode/LICENSE.txt",
  "vendor/jsqr/jsQR.js",
  "vendor/jsqr/LICENSE.txt",
  "vendor/three/three.module.js",
  "vendor/three/three.core.js",
  "vendor/three/LICENSE.txt",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
  );
});

// アプリからの おねがい：「こうしん する」が おされた（SKIP_WAITING）・版を おしえて（VERSION）
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  if (d.type === "VERSION" && e.ports && e.ports[0]) e.ports[0].postMessage(APP_VERSION);
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bct-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 地図タイルなど よその通信は ブラウザに まかせる
  if (url.pathname.endsWith(".mp4")) return;        // 波の 動画も ブラウザに まかせる（上の 説明）

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === "navigate") {
          const page = await cache.match(url.pathname.endsWith("operator.html") ? "operator.html" : "index.html");
          if (page) return page;
        }
        throw err;
      }
    })
  );
});
