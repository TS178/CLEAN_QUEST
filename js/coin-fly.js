/*
 * たんけんたいメダルを もらった ときの 演出（SHIKA COLLECTION の coin-fly.js と おなじ うごき）
 * ------------------------------------------------------------
 * もらった ところ（ゴミばこ・こたえの ボタン など。わからなければ 画面の まんなか）から、
 * メダルが すこしずつ 間を あけて 右上の 枚数の メダルへ とんでいく。おなじ 道すじを とぶので 一れつに ならぶ。
 * 1枚 とどく たびに、右上の 数が メーターのように ふえて、ぽんと はずむ。
 * たくさん もらっても とぶのは 20枚まで。うごきを へらす 設定では とばさずに 数だけ てばやく ふやす。
 * へった とき（かいもの）は すぐ 表示を かえる。
 *
 * つかいかた：BCT.coinFly.from(とびはじめる 要素か DOMRect) → そのあとの ui.refreshHeader() で とぶ
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const SRC = "assets/ui/medal.webp";
  const MAX_COINS = 20;
  const SIZE = 26;       // とぶ メダルの 大きさ（px）
  const ORIGIN_MS = 3000; // from() で きめた 場所を つかう 時間

  let shown = null;      // 右上に 見えている 数
  let goal = null;       // さいごに たのまれた 数
  let origin = null, originAt = 0;
  let queue = Promise.resolve();
  let running = 0;

  const chip = () => document.getElementById("tbCoin");
  const reduced = () => (BCT.ui && BCT.ui.reducedMotion ? BCT.ui.reducedMotion() : false);

  function render(v) {
    const c = chip();
    if (!c) return;
    const b = c.querySelector(".medal-amount b");
    if (b) b.textContent = Number(v).toLocaleString("ja-JP");
    else c.innerHTML = BCT.medal.amount(v);
    c.title = BCT.medal.name;
    shown = v;
  }
  function bump() {
    const c = chip();
    if (!c) return;
    c.classList.remove("is-bump");
    void c.offsetWidth;
    c.classList.add("is-bump");
  }

  // とびはじめる ところを きめる（つぎの ふえる 表示で つかう）
  function from(target) {
    origin = target && target.getBoundingClientRect ? target.getBoundingClientRect() : target || null;
    originAt = Date.now();
  }

  // 右上の 数を value に する。ふえた ときは とばす
  function update(value) {
    const c = chip();
    if (!c) return;
    if (shown == null || !c.querySelector(".medal-amount b")) {
      c.innerHTML = BCT.medal.amount(value);
      c.title = BCT.medal.name;
      shown = goal = value;
      return;
    }
    if (goal == null) goal = shown;
    const amount = value - goal;
    goal = value;
    if (amount <= 0) {
      if (!running) render(value); // へった（かいもの）・かわらない
      return;
    }
    // ヘッダーが かくれている 画面（さつえい・AR など）では とばさない
    const app = document.getElementById("app");
    if (app && app.classList.contains("no-tabs")) { if (!running) render(value); return; }
    const rect = origin && Date.now() - originAt < ORIGIN_MS ? origin : null;
    origin = null;
    running += 1;
    const run = () => fly(rect, amount).finally(() => {
      running -= 1;
      if (!running && goal != null) render(goal);
    });
    queue = queue.then(run, run);
  }

  async function fly(rect, amount) {
    const c = chip();
    if (!c) return;
    const base = shown;
    const n = Math.max(1, Math.min(MAX_COINS, Math.round(amount)));
    const step = Math.floor(amount / n); // 端数は さいごの 1枚で あわせる
    const value = (k) => (k === n ? base + amount : base + step * k);
    if (reduced()) {
      for (let k = 1; k <= n; k++) {
        render(value(k));
        await new Promise((r) => setTimeout(r, 30));
      }
      bump();
      return;
    }
    const icon = c.querySelector(".medal-icon") || c;
    const to = icon.getBoundingClientRect();
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
    const fr = rect || { left: innerWidth / 2 - 20, top: innerHeight / 2 - 20, width: 40, height: 40 };
    const sx = fr.left + fr.width / 2, sy = fr.top + fr.height / 2;

    const layer = document.createElement("div");
    layer.className = "coinfly";
    document.body.appendChild(layer);
    const GAP = n > 10 ? 55 : 75; // 1枚ずつ とびたつ 間隔（ms）
    const FORMED = 170;           // あらわれてから とびたつまで
    const TRAVEL = 480;           // 右上までの 時間
    const jobs = [];
    for (let k = 0; k < n; k++) {
      const x0 = sx - SIZE / 2, y0 = sy - SIZE / 2, x1 = tx - SIZE / 2, y1 = ty - SIZE / 2;
      const appear = k * GAP, depart = appear + FORMED, dur = depart + TRAVEL - appear;
      const img = document.createElement("img");
      img.className = "coinfly__coin";
      img.src = SRC;
      img.alt = "";
      layer.appendChild(img);
      const at = (x, y, sc, op) => ({ transform: `translate(${x}px,${y}px) scale(${sc})`, opacity: op });
      const anim = img.animate([
        { ...at(x0, y0, 0, 0), offset: 0 },
        { ...at(x0, y0 - 6, 1.15, 1), offset: Math.min(0.99, 110 / dur), easing: "ease-out" },
        { ...at(x0, y0, 1, 1), offset: Math.min(0.995, 170 / dur) },
        { ...at(x0, y0, 1, 1), offset: (depart - appear) / dur, easing: "cubic-bezier(.5,0,.85,.45)" },
        { ...at(x1, y1, 0.55, 1), offset: 1 },
      ], { duration: dur, delay: appear, fill: "forwards" });
      jobs.push(anim.finished.then(() => {
        img.remove();
        render(value(k + 1)); // とどく たびに メーターのように ふやす
        bump();
      }).catch(() => img.remove()));
    }
    await Promise.all(jobs);
    layer.remove();
  }

  BCT.coinFly = { from, update, busy: () => running > 0 };
})();
