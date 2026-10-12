/*
 * ホームの 池の 背景：波が うごく 動画（assets/ui/beach-waves.mp4。8秒で くりかえし・音なし）
 * ------------------------------------------------------------
 * 動画は 別エージェント（Codex）が もとの 砂浜の 絵（assets/ui/beach.webp）から つくった もの。
 * 絵と おなじ 1200×800 なので、絵と おなじ「まんなか あわせ・池いっぱい（cover）」で かさねれば ずれない。
 * - 絵の 上に かさね、再生が はじまってから ふわっと 見せる（それまで・つかえない ときは いままでの 絵）
 * - 動画は 約6MB。アプリの 読みこみが おわってから 読みはじめる
 * - 「うごきを へらす」・データセーバー・遅い 回線・再生 できない（iPhone の 低電力モード など）ときは 絵の まま
 * - ホームから はなれた とき・アプリが うらに まわった ときは 止める
 * - Service Worker は 動画に 手を ださない（圏外では 絵の まま。service-worker.js）
 * - ようせい・ゴミ・ボタンは 動画の 上の べつの 層の まま（動画は タップを うけない）
 */
(function () {
  const BCT = window.BCT;
  const SRC = "assets/ui/beach-waves.mp4";
  const video = document.getElementById("pondVideo");
  if (!video) return;
  let wanted = false;     // ホームが 見えている
  let pageReady = document.readyState === "complete";

  video.muted = true;     // 自動再生には 音なしが ひつよう
  video.addEventListener("playing", () => video.classList.add("on"));
  video.addEventListener("error", () => video.classList.remove("on"));

  const reduced = () => !!(BCT.ui && BCT.ui.reducedMotion && BCT.ui.reducedMotion());
  function lowData() {
    const c = navigator.connection;
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
  }
  const usable = () => !reduced() && !lowData();

  function tryPlay() {
    if (!wanted || !pageReady || document.hidden) return;
    if (!usable()) { quiet(); return; }
    if (!video.getAttribute("src")) video.setAttribute("src", SRC);
    const p = video.play();
    if (p && p.catch) p.catch(() => video.classList.remove("on")); // 再生 できない ときは 絵の まま
  }
  // 止めて 絵に もどす（うごきを へらす とき）
  function quiet() {
    video.pause();
    video.classList.remove("on");
  }

  function play() {
    wanted = true;
    tryPlay();
  }
  function stop() {
    wanted = false;
    video.pause();
  }

  if (!pageReady) {
    window.addEventListener("load", () => setTimeout(() => { pageReady = true; tryPlay(); }, 800));
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else tryPlay();
  });

  BCT.pondVideo = { play, stop, playing: () => !video.paused && video.classList.contains("on") };
})();
