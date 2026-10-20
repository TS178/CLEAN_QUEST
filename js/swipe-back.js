/*
 * 画面の 左右の はしから スワイプして ひとつ まえの 画面へ もどる
 * ------------------------------------------------------------
 * - Android：ブラウザ・OS の「もどる」（はしからの スワイプ・もどるボタン）が そのまま つかえる（js/app.js が 記録を つむ）。
 *   ここで さらに かさねると 2回 もどって しまうので、Android では なにも しない。
 * - iPhone の Safari：左はしからの スワイプは Safari が もどる（js/app.js が うける）。右はしは ここで もどる。
 * - iPhone の ホーム画面に ついかした アプリ：はしからの スワイプが ないので、左右とも ここで もどる。
 * - ゴミや ドロップの ドラッグ・すみかの アイテム・ちず・AR・さつえいの ようせい など、ゆびを よこに うごかす ところでは もどらない。
 */
(function () {
  const BCT = window.BCT;
  const ua = navigator.userAgent || "";
  if (/Android/.test(ua)) return;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  const EDGE = 24;      // はしから この はばの 中で さわりはじめたら
  const DIST = 70;      // まんなかへ これだけ うごかしたら もどる
  const SKIP = "#tsCanvas,.pb-stage,.pb-pad,[data-trash],[data-food],.hb-item,.hb-scene,#phPet,#phStage,#arTouch,.ar-screen,.leaflet-container,input[type=range]";
  let t = null;

  function useEdge(edge) {
    if (edge === "left" && isIOS && !standalone) return false; // Safari の もどるに まかせる
    return true;
  }

  document.addEventListener("touchstart", (e) => {
    t = null;
    if (e.touches.length !== 1) return;
    const p = e.touches[0];
    const edge = p.clientX <= EDGE ? "left" : p.clientX >= window.innerWidth - EDGE ? "right" : null;
    if (!edge || !useEdge(edge)) return;
    if (e.target.closest && e.target.closest(SKIP)) return;
    t = { x: p.clientX, y: p.clientY, at: Date.now(), edge };
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!t) return;
    const p = e.touches[0];
    if (Math.abs(p.clientY - t.y) > 50) t = null; // たてに うごいたら スクロール
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!t) return;
    const p = e.changedTouches[0];
    const dx = t.edge === "left" ? p.clientX - t.x : t.x - p.clientX;
    const ok = dx >= DIST && Math.abs(p.clientY - t.y) < 60 && Date.now() - t.at < 800;
    t = null;
    if (ok && BCT.ui && BCT.ui.swipeBack) BCT.ui.swipeBack();
  }, { passive: true });

  document.addEventListener("touchcancel", () => { t = null; }, { passive: true });

  BCT.swipeBack = { edge: EDGE, distance: DIST };
})();
