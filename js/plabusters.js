/*
 * プラごみバスターズ：画面・そうさ・演出（ミッションタブから ひらく ミニゲーム）
 * ------------------------------------------------------------
 * ルールと けいさんは js/plabusters-engine.js、絵は js/plabusters-art.js。ここは 画面と 演出だけ。
 * - 1こまごとに engine.advance(round, dt) で じかんを すすめ、かえってきた できごと（events）を 見て 演出する
 * - 演出は DOM ＋ CSS アニメーション ＋ Element.animate（canvas は つかわない。かず が すくなく、タップの あたり判定が かんたん）
 *   パーティクル（きらきら・メダル）は 1かいに 12こ までの 小さな 要素。おわったら すぐ けす
 * - うごきを へらす 設定では、カットイン・とびちり・ゆれを みじかく／なしに する
 * - ほかの 画面へ いく・アプリが うらに まわる・おしらせが でる と ひとやすみ（とけいが とまる）
 * - ごほうびは 1かいの あそびに 1かいだけ（claims の「イベントID:plabusters:runId」。ゴミシュートと おなじ しくみ）
 */
(function () {
  const B = window.BCT, E = B.plaBustersEngine, A = B.plaBustersArt, C = E.C, $ = B.$;
  const SCREEN = "plabusters";
  let round = null, raf = 0, last = 0, abort = null, modalObserver = null, pausedPhase = null, paid = false, saving = false;
  let countdownTimer = 0, shown = {}, petSvg = { normal: "", happy: "" }, fxCount = 0;
  const active = () => B.ui.current() === SCREEN;
  const reduced = () => B.ui.reducedMotion();
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
  const stats = () => (B.store.get().plaBusters || { plays: 0, bestScore: 0, bestCombo: 0 });

  // ---------------- 演出の 道具 ----------------
  const stageRect = () => $("pbStage").getBoundingClientRect();
  function centerOf(el) {
    const r = el.getBoundingClientRect(), s = stageRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }
  function fxEl(cls, html, x, y) {
    const el = document.createElement("div");
    el.className = "pb-fxi " + cls;
    el.innerHTML = html;
    el.style.left = x + "px";
    el.style.top = y + "px";
    $("pbFx").appendChild(el);
    return el;
  }
  // うかぶ もじ（+100 CLEAN! など）
  function pop(text, x, y, cls = "") {
    const el = fxEl("pb-pop " + cls, text, x, y);
    const anim = el.animate([{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-90%) scale(1.1)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-160%) scale(1)", opacity: 0 }], { duration: reduced() ? 500 : 900, easing: "ease-out" });
    anim.onfinish = () => el.remove();
  }
  // きらきらが とびちる
  function burst(x, y, n = 8, big = false) {
    if (reduced()) n = Math.min(n, 3);
    for (let i = 0; i < n && fxCount < 40; i++) {
      fxCount++;
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = (big ? 90 : 55) * (0.6 + Math.random() * 0.6);
      const el = fxEl("pb-spark" + (i % 3 === 0 ? " bubble" : ""), "", x, y);
      const anim = el.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(${big ? 1.4 : 1})`, opacity: 0 }],
        { duration: reduced() ? 300 : 650 + Math.random() * 250, easing: "cubic-bezier(.2,.7,.3,1)" });
      anim.onfinish = () => { el.remove(); fxCount--; };
    }
  }
  // ようせいから かいじゅうへ ひかりの たま
  function shoot(to) {
    const f = centerOf($("pbFairy"));
    if (reduced()) return Promise.resolve();
    const el = fxEl("pb-orb", "", f.x, f.y - 10);
    const dx = to.x - f.x, dy = to.y - (f.y - 10);
    const anim = el.animate([{ transform: "translate(-50%,-50%) scale(.5)" }, { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(1.1)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8)` }], { duration: 220, easing: "ease-in" });
    return anim.finished.then(() => el.remove(), () => el.remove());
  }
  function fairy(mood, ms = 450) {
    const el = $("pbFairy");
    if (!el) return;
    el.dataset.mood = mood;
    el.innerHTML = mood === "oops" ? petSvg.normal : petSvg.happy;
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (el.isConnected) { el.dataset.mood = ""; el.innerHTML = petSvg.normal; } }, ms);
  }
  function banner(text, cls, ms) {
    const el = $("pbBanner");
    el.className = "pb-banner show " + (cls || "");
    el.innerHTML = text;
    clearTimeout(el._t);
    if (ms) el._t = setTimeout(() => { el.className = "pb-banner"; }, ms);
  }
  function hideBanner(cls) {
    const el = $("pbBanner");
    if (!cls || el.classList.contains(cls)) el.className = "pb-banner";
  }
  function say(text) { $("pbLive").textContent = text; }
  function monsterEl(m) { return m && $("pbArena").querySelector(`[data-id="${m.id}"]`); }
  // かいじゅうが いなくなる（じょうか・にげる・さる）
  function retire(m, how) {
    const el = monsterEl(m);
    if (!el) return;
    el.classList.add(how);
    if (how === "defeated") {
      const face = el.querySelector(".pb-mon-face");
      if (face) face.innerHTML = A.faceSvg("hit");
    }
    setTimeout(() => el.remove(), reduced() ? 150 : 520);
  }

  // ---------------- できごと → 演出 ----------------
  function handle(events) {
    for (const ev of events) {
      const m = ev.monster;
      switch (ev.type) {
        case "spawn": {
          $("pbArena").insertAdjacentHTML("beforeend", A.monster(m));
          $("pbStage").classList.toggle("boss-mode", m.type === "boss");
          $("pbStage").classList.toggle("danger-mode", m.type === "danger");
          if (m.type === "danger") { banner("⚠ あぶない！ さわらないで！<small>われた びんは「おとなを よぶ」</small>", "danger"); say("あぶない！ われた びんだよ。さわらずに おとなを よぼう"); }
          else if (m.type === "boss") { banner("TAP! TAP!<small>おおがた かいじゅうを れんだで じょうか！</small>", "tap"); say(`${m.name}が あらわれた！ れんだで じょうかしよう`); }
          else { hideBanner(); say(`${m.name}！ ${B.beachTrashOf(m.kind).name}は どの ゴミばこ？`); }
          break;
        }
        case "bossComing":
          banner("おおがた かいじゅうが くるぞ！", "warn", C.bossIntro * 1000);
          break;
        case "hit": {
          const el = monsterEl(m), at = el ? centerOf(el) : { x: 160, y: 140 };
          fairy("attack");
          shoot(at).then(() => {
            retire(m, "defeated");
            burst(at.x, at.y, 8);
            pop(`+${ev.gain}<br><b>CLEAN!</b>`, at.x, at.y - 20);
            if (ev.combo >= 5 && ev.combo % 5 === 0) pop(`${ev.combo} COMBO!`, at.x, at.y - 70, "combo");
          });
          say(`せいかい！ ${ev.combo} れんぞく`);
          break;
        }
        case "miss": {
          const el = monsterEl(m), at = el ? centerOf(el) : { x: 160, y: 140 };
          fairy("oops", 600);
          if (el) { el.classList.remove("laugh"); void el.offsetWidth; el.classList.add("laugh"); }
          $("pbPad").classList.add("stun");
          setTimeout(() => $("pbPad") && $("pbPad").classList.remove("stun"), C.stun * 1000);
          if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* なし */ }
          if (ev.reason === "danger") {
            retire(m, "leave");
            banner("さわっちゃ だめ！<small>われた びんは おとなに しらせてね</small>", "danger", 1400);
            pop("あぶない！", at.x, at.y - 20, "bad");
            say("われた びんは さわらずに、おとなに しらせてね");
          } else {
            pop(ev.reason === "adult" ? "これは あぶなくないよ" : "ちがう ゴミばこ！", at.x, at.y + 40, "bad");
            say(`ざんねん！ ${B.beachTrashOf(m.kind).name}は ${B.binOf(m.bin).name}だよ`);
          }
          break;
        }
        case "dangerSafe": {
          const el = monsterEl(m), at = el ? centerOf(el) : { x: 160, y: 140 };
          retire(m, "leave");
          hideBanner("danger");
          fairy("cheer");
          pop(`${ev.how === "adult" ? "おとなに しらせた！" : "さわらずに よけた！"}<br>+${ev.gain}`, at.x, at.y - 20, "safe");
          say(ev.how === "adult" ? "おとなに しらせたね。えらい！" : "さわらずに よけたね。えらい！");
          break;
        }
        case "bossTap": {
          const el = monsterEl(m);
          if (el) {
            const pips = el.querySelectorAll(".pb-hp i:not(.off)");
            if (pips.length) pips[pips.length - 1].classList.add("off");
            el.classList.remove("hurt"); void el.offsetWidth; el.classList.add("hurt");
            const at = centerOf(el);
            burst(at.x + (Math.random() - 0.5) * 60, at.y + (Math.random() - 0.5) * 60, 3);
          }
          if (ev.hp % 3 === 0 && ev.hp > 0) fairy("attack", 250);
          break;
        }
        case "bossDown": {
          const el = monsterEl(m), at = el ? centerOf(el) : { x: 160, y: 140 };
          retire(m, "defeated");
          hideBanner("tap");
          $("pbStage").classList.remove("boss-mode");
          flash();
          burst(at.x, at.y, 12, true);
          fairy("cheer", 700);
          pop(`げきは！<br>+${ev.gain}`, at.x, at.y - 30, "big");
          say(`${m.name}を じょうか した！`);
          break;
        }
        case "bossEscape":
          retire(m, "leave");
          hideBanner("tap");
          $("pbStage").classList.remove("boss-mode");
          say("おおがた かいじゅうに にげられた…");
          break;
        case "beamStart":
          cutin(true);
          say("ひっさつ！ クリーンビーム！");
          break;
        case "beamHit": {
          const el = monsterEl(m), at = el ? centerOf(el) : { x: 160, y: 140 };
          beam(at);
          retire(m, "defeated");
          hideBanner();
          $("pbStage").classList.remove("boss-mode", "danger-mode");
          burst(at.x, at.y, 12, true);
          pop(`クリーンビーム！<br>+${ev.gain}`, at.x, at.y - 30, "big");
          break;
        }
        case "beamEnd":
          cutin(false);
          break;
        case "end":
          $("pbArena").innerHTML = "";
          hideBanner();
          $("pbStage").classList.remove("boss-mode", "danger-mode");
          banner("そこまで！", "warn", 900);
          setTimeout(() => { if (active() && round && round.phase === "result") resultPanel(); }, reduced() ? 200 : 900);
          break;
      }
    }
  }
  function flash() {
    if (reduced()) return;
    const el = fxEl("pb-flash", "", 0, 0);
    el.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420 }).onfinish = () => el.remove();
  }
  // ひっさつわざ：カットイン（ようせいの アップ ＋ もじ）
  function cutin(on) {
    const el = $("pbCutin");
    if (!on) { el.hidden = true; el.className = "pb-cutin"; return; }
    el.innerHTML = `<div class="pb-cutin-band"><div class="pb-cutin-pet">${petSvg.happy}</div><div class="pb-cutin-text">ひっさつ！<b>クリーンビーム！</b></div></div>`;
    el.hidden = false;
    el.className = "pb-cutin" + (reduced() ? " still" : " go");
  }
  // ひかりの ビーム（ようせい → かいじゅう）
  function beam(to) {
    const f = centerOf($("pbFairy"));
    const dx = to.x - f.x, dy = to.y - f.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const el = fxEl("pb-beam", "", f.x, f.y);
    el.style.width = len + 40 + "px";
    el.style.transform = `translateY(-50%) rotate(${ang}deg)`;
    el.animate([{ opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)", offset: 0.35 }, { opacity: 0, clipPath: "inset(0 0 0 0)" }],
      { duration: reduced() ? 300 : 700, easing: "ease-out" }).onfinish = () => el.remove();
    flash();
  }

  // ---------------- がめんの 数字・よごれ ----------------
  function paint() {
    if (!round || !active()) return;
    const left = Math.max(0, Math.ceil(C.duration - round.time));
    const set = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
    set("pbTime", left);
    set("pbScore", round.score.toLocaleString("ja-JP"));
    set("pbCombo", round.combo);
    $("pbTime").parentNode.classList.toggle("urgent", left <= 10);
    const g = Math.round((round.gauge / C.gaugeMax) * 100);
    if (shown.g !== g) { shown.g = g; $("pbGauge").style.width = g + "%"; $("pbGaugeBox").classList.toggle("full", g >= 90); }
    $("pbFairy").classList.toggle("aura", round.combo >= 10);
    // はまべの よごれ：てんすうに あわせて すこしずつ きれいに なる
    setClean(Math.min(100, (round.score / C.stars[2]) * 100));
    $("pbPause").disabled = round.phase !== "playing";
  }
  function setClean(pct) {
    const p = Math.round(pct);
    if (shown.clean === p) return;
    shown.clean = p;
    const stage = $("pbStage");
    stage.style.setProperty("--dirt", String(1 - p / 100));
    stage.style.setProperty("--emerald", String(Math.max(0, (p - 60) / 40)));
    stage.querySelectorAll(".pb-litter").forEach((el, i, all) => el.classList.toggle("off", p >= ((i + 1) / (all.length + 1)) * 100));
  }

  // ---------------- すすめる ----------------
  function tick(now) {
    raf = 0;
    if (!active() || !round || round.phase !== "playing") return;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    handle(E.advance(round, dt));
    paint();
    if (round.phase === "playing") raf = requestAnimationFrame(tick);
  }
  function run() {
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function act(choice) {
    if (!round || round.phase !== "playing") return;
    // おした しゅんかんまで じかんを すすめてから はんてい
    const now = performance.now();
    handle(E.advance(round, (now - last) / 1000));
    last = now;
    handle(choice === "tap" ? E.tap(round) : E.press(round, choice));
    paint();
  }

  // ---------------- パネル（はじめ・ひとやすみ・けっか） ----------------
  function panel(html) {
    const o = $("pbOverlay");
    o.hidden = false;
    o.innerHTML = `<div class="pb-panel">${html}</div>`;
  }
  function closePanel() { $("pbOverlay").hidden = true; $("pbOverlay").innerHTML = ""; }
  function readyPanel() {
    const st = stats();
    const bins = B.BINS.map((b) => `<span class="pb-rule-bin"><img src="${B.COLLECTION_SPRITES["bin_" + b.key].src}" alt="">${b.name}</span>`).join("");
    panel(`<div class="pb-eyebrow">MISSION GAME</div><h2>プラごみバスターズ</h2>
      <ol class="pb-rules">
        <li>かいじゅうの ゴミを 見て、<b>ただしい ゴミばこ</b>の ボタンを おそう！<div class="pb-rule-bins">${bins}</div></li>
        <li><b>おおがた かいじゅう</b>は <b>TAP! TAP!</b> で れんだ！</li>
        <li><b>われた びん</b>は さわらない！「おとなを よぶ」か よけてね</li>
        <li>れんぞく せいかいで ゲージが たまると <b>ひっさつ クリーンビーム！</b></li>
      </ol>
      <p class="pb-note">${C.duration}びょうの チャレンジ。★1：${C.coins[1]}枚 ／ ★2：${C.coins[2]}枚 ／ ★3：${C.coins[3]}枚<br>いちども まちがえないと <b>PERFECT</b>（×${C.perfect.mult}、★3は ×${C.perfect.multStar3}）</p>
      ${st.plays ? `<p class="pb-note">さいこう ${st.bestScore.toLocaleString("ja-JP")}てん ／ ${st.bestCombo}コンボ</p>` : ""}
      <button class="btn block lilac" id="pbStart">しゅつどう！</button>
      <button class="btn block ghost" id="pbReadyBack">ミッションへ もどる</button>`);
    $("pbStart").onclick = countdown;
    $("pbReadyBack").onclick = () => B.ui.show("mission");
  }
  function countdown() {
    closePanel();
    round.phase = "countdown";
    const steps = reduced() ? ["スタート！"] : ["3", "2", "1", "スタート！"];
    let i = 0;
    const next = () => {
      if (!active() || !round || round.phase !== "countdown") return;
      if (i < steps.length) { banner(steps[i], "count", 700); i++; countdownTimer = setTimeout(next, i === steps.length ? 450 : 650); return; }
      round.phase = "playing";
      say("かいじゅうが きたら、ゴミばこの ボタンを おそう！");
      run();
    };
    next();
  }
  function pause() {
    if (!round) return;
    if (round.phase === "countdown") { clearTimeout(countdownTimer); round.phase = "ready"; if (active()) readyPanel(); return; }
    if (round.phase !== "playing") return;
    cancelAnimationFrame(raf); raf = 0;
    pausedPhase = round.phase;
    round.phase = "paused";
    if (active()) pausePanel();
  }
  function resume() {
    if (document.hidden || !round) return;
    round.phase = pausedPhase || "playing";
    pausedPhase = null;
    closePanel();
    run();
  }
  function pausePanel() {
    panel(`<div class="pb-eyebrow">TAKE A BREAK</div><h2>ひとやすみ</h2><p>じかんは とまっているよ。</p>
      <button class="btn block lilac" id="pbResume">つづきから あそぶ</button><button class="btn block ghost" id="pbQuit">この ゲームを やめる</button>`);
    $("pbResume").onclick = resume;
    $("pbQuit").onclick = () => { round = null; pausedPhase = null; B.ui.show("mission"); };
  }

  // けっか：ほし・てんすう・はまべの きれいど・リサイクルボックスから メダル
  function resultPanel() {
    const r = E.result(round);
    $("pbFairy").classList.remove("aura");
    document.querySelector(".pb-shell").classList.add("pb-done"); // ステージを ひくくして けっかの カードを 見せる
    // ステージ：リサイクルボックス（PERFECT の ときは おび）
    $("pbArena").innerHTML = `<div class="pb-reward" id="pbReward">${r.perfect ? `<div class="pb-perfect">PERFECT BONUS!<small>×${r.mult}</small></div>` : ""}
      <div class="pb-boxwrap" id="pbBox">${A.recycleBox()}</div></div>`;
    // ボタンの かわりに けっかの カード
    const stars = [1, 2, 3].map((n) => `<span class="pb-star ${n <= r.stars ? "on" : ""}" style="--d:${n * 0.25}s">★</span>`).join("");
    $("pbPad").hidden = true;
    $("pbResult").hidden = false;
    $("pbResult").innerHTML = `<div class="pb-stars" aria-label="ほし ${r.stars}こ">${stars}</div>
      <h2>${r.stars === 3 ? "はまべの ヒーロー！" : r.stars === 2 ? "すごい！ はまべが きれいに！" : r.stars ? "はまべが きれいに なったよ" : "また チャレンジ しよう！"}</h2>
      <div class="pb-score"><b id="pbFinal">0</b><small> てん</small></div>
      <div class="pb-clean"><span>はまべの きれいど</span><div class="pb-clean-bar"><i id="pbCleanBar"></i></div><b id="pbCleanPct">0%</b></div>
      <ul class="pb-stats"><li>じょうか <b>${r.defeated}</b>たい</li><li>おおがた <b>${r.bosses}</b>たい</li><li>あぶない よけた <b>${r.dangersAvoided}</b></li>
        <li>まちがい <b>${r.mistakes}</b></li><li>さいこう <b>${r.maxCombo}</b>コンボ</li><li>ビーム <b>${r.beams}</b>かい</li></ul>
      <p class="pb-coins"><b>${B.medal.amount(r.coins, "+")}枚</b><br><small>★${r.stars} ${r.baseCoins}枚${r.perfect ? ` × PERFECT ${r.mult}` : ""}</small></p>
      <p class="pb-save" id="pbSave" role="status"></p>
      <button class="btn block lilac" id="pbAgain" disabled>もういちど あそぶ</button>
      <button class="btn block ghost" id="pbResultBack">ミッションへ</button>`;
    $("pbAgain").onclick = again;
    $("pbResultBack").onclick = () => B.ui.show("mission");
    animateResult(r);
  }
  function animateResult(r) {
    const dur = reduced() ? 1 : 1300, t0 = performance.now(), start = shown.clean || 0;
    const step = (now) => {
      if (!active() || !$("pbFinal")) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      $("pbFinal").textContent = Math.round(r.score * e).toLocaleString("ja-JP");
      const c = Math.round(r.clean * e);
      $("pbCleanBar").style.width = c + "%";
      $("pbCleanPct").textContent = c + "%";
      shown.clean = null;
      setClean(start + (r.clean - start) * e);
      if (k < 1) requestAnimationFrame(step);
      else {
        $("pbStage").classList.toggle("sparkling", r.clean >= 100);
        openBox(r);
      }
    };
    requestAnimationFrame(step);
  }
  // リサイクルボックスが ひらいて メダルが はじける → ほぞん → 右上の メダルへ とんでいく（js/coin-fly.js）
  function openBox(r) {
    const box = $("pbBox");
    if (!box) return;
    box.classList.add("open");
    const at = centerOf(box);
    const n = r.coins ? Math.min(12, 4 + Math.round(r.coins / 6)) : 0;
    if (!reduced()) {
      for (let i = 0; i < n; i++) {
        const el = fxEl("pb-coin", `<img src="assets/ui/medal.webp" alt="">`, at.x, at.y - 20);
        const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 2.2, d = 70 + Math.random() * 50;
        el.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.1}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(.8)`, opacity: 0 }],
          { duration: 900, delay: i * 40, easing: "cubic-bezier(.2,.8,.4,1)" }).onfinish = () => el.remove();
      }
    }
    setTimeout(saveReward, reduced() ? 0 : 500);
  }
  function finish(target) {
    const r = E.result(target);
    if (target.phase !== "result" || !(target.time >= C.duration) || !/^[a-zA-Z0-9-]{1,60}$/.test(target.runId)) return { ok: false, err: "round" };
    return B.store.transact((s) => {
      const k = `${B.CONFIG.event.id}:plabusters:${target.runId}`;
      if (s.claims[k]) return { ok: false, err: "dup" };
      const t = Date.now();
      s.claims[k] = { xp: 0, coins: r.coins, t };
      const st = s.plaBusters;
      st.plays++;
      st.bestScore = Math.max(st.bestScore, r.score);
      st.bestCombo = Math.max(st.bestCombo, r.maxCombo);
      st.lastResult = { runId: target.runId, score: r.score, stars: r.stars, coins: r.coins, perfect: r.perfect, clean: r.clean, t };
      return { ok: true, ...r };
    });
  }
  async function saveReward() {
    if (saving || paid || !round) return;
    saving = true;
    const target = round;
    if (active() && $("pbSave")) $("pbSave").textContent = "ごほうびを ほぞんちゅう…";
    let res;
    const commit = () => {
      if (active() && $("pbBox")) B.coinFly && B.coinFly.from($("pbBox"));
      return finish(target);
    };
    try { res = navigator.locks ? await navigator.locks.request("bct-plabusters-reward", commit) : commit(); }
    catch (e) { res = { ok: false, err: "save" }; }
    saving = false;
    if (round !== target) return;
    paid = res.ok || res.err === "dup";
    if (!active() || !$("pbSave")) return;
    if (paid) { $("pbSave").textContent = "ごほうびは ほぞんずみ！"; $("pbAgain").disabled = false; }
    else { $("pbSave").innerHTML = 'ほぞん できなかったよ。<button class="btn small ghost" id="pbRetry">もういちど ほぞん</button>'; $("pbRetry").onclick = saveReward; }
  }
  function again() {
    round = E.create(uid());
    paid = false;
    mount();
  }

  // ---------------- くみたて ----------------
  function mount() {
    document.body.classList.add("pb-game");
    if (abort) abort.abort();
    if (modalObserver) modalObserver.disconnect();
    abort = new AbortController();
    const opt = { signal: abort.signal };
    if (!round) { round = E.create(uid()); paid = false; pausedPhase = null; }
    const s = B.store.get();
    const pet = { type: (s.pet && s.pet.type) || "dolphin", stage: B.game.stage(s), equip: s.equip, motion: false };
    petSvg = { normal: B.art.render(pet), happy: B.art.render(Object.assign({}, pet, { pose: "smile" })) };
    shown = {};
    const btn = (b) => `<button class="pb-btn" data-choice="${b.key}" style="--c:${b.color}"><img src="${B.COLLECTION_SPRITES["bin_" + b.key].src}" alt=""><span>${b.name}</span><kbd>${B.BINS.indexOf(b) + 1}</kbd></button>`;
    $("plaBustersBody").innerHTML = `<div class="pb-shell">
      <div class="pb-toolbar"><button class="btn small ghost" id="pbBack">← ミッション</button><b class="pb-title">プラごみバスターズ</b><button class="btn small ghost" id="pbPause">ひとやすみ</button></div>
      <div class="pb-hud"><div><span>のこり</span><b id="pbTime">${C.duration}</b><small>びょう</small></div><div><span>スコア</span><b id="pbScore">0</b></div><div><span>コンボ</span><b id="pbCombo">0</b></div></div>
      <div class="pb-gauge" id="pbGaugeBox" aria-hidden="true"><i id="pbGauge"></i><span>ひっさつ ゲージ</span></div>
      <div class="pb-stage" id="pbStage">
        <div class="pb-bg"></div><div class="pb-dirt">${A.litter()}</div><div class="pb-emerald"></div>
        <div class="pb-arena" id="pbArena"></div>
        <div class="pb-fairy" id="pbFairy">${petSvg.normal}</div>
        <div class="pb-banner" id="pbBanner"></div>
        <div class="pb-fx" id="pbFx"></div>
        <div class="pb-cutin" id="pbCutin" hidden></div>
        <div class="pb-overlay" id="pbOverlay" hidden></div>
      </div>
      <div class="pb-pad" id="pbPad">${B.BINS.map(btn).join("")}
        <button class="pb-btn adult" data-choice="adult"><span class="pb-adult-ico" aria-hidden="true">🙋</span><span>おとなを よぶ</span><kbd>4</kbd></button></div>
      <div class="pb-result" id="pbResult" hidden></div>
      <div class="pb-live" id="pbLive" role="status">かいじゅうの ゴミを 見て、ゴミばこの ボタンを おそう</div>
    </div>`;
    setClean(round.phase === "result" ? E.result(round).clean : Math.min(100, (round.score / C.stars[2]) * 100));
    $("pbBack").onclick = () => B.ui.show("mission");
    $("pbPause").onclick = pause;
    $("pbPad").addEventListener("pointerdown", (e) => {
      const b = e.target.closest("[data-choice]");
      if (!b) return;
      e.preventDefault();
      b.classList.remove("press"); void b.offsetWidth; b.classList.add("press");
      act(round && round.monster && round.monster.type === "boss" ? "tap" : b.dataset.choice);
    }, opt);
    // おおがた かいじゅうは ステージを タップ
    $("pbStage").addEventListener("pointerdown", (e) => {
      if (!round || round.phase !== "playing" || !round.monster || round.monster.type !== "boss") return;
      if (e.target.closest(".pb-overlay")) return;
      e.preventDefault();
      act("tap");
    }, opt);
    document.addEventListener("keydown", (e) => {
      if (!active() || !round) return;
      if (e.key === "Escape") { pause(); return; }
      if (round.phase !== "playing") return;
      const map = { 1: B.BINS[0].key, 2: B.BINS[1].key, 3: B.BINS[2].key, 4: "adult" };
      if (map[e.key]) { e.preventDefault(); act(round.monster && round.monster.type === "boss" ? "tap" : map[e.key]); }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); act("tap"); }
    }, opt);
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); }, opt);
    window.addEventListener("blur", pause, opt);
    modalObserver = new MutationObserver(() => { if ($("modal").classList.contains("show")) pause(); });
    modalObserver.observe($("modal"), { attributes: true, attributeFilter: ["class"] });
    if (round.phase === "result") resultPanel();
    else if (round.phase === "paused") pausePanel();
    else { round.phase = "ready"; readyPanel(); }
    paint();
  }

  B.plaBusters = {
    busy: () => active() && !!round && round.phase !== "ready" && (round.phase !== "result" || !paid),
    // テスト用：いまの round（読みとり）
    debug: () => round,
  };
  B.screens[SCREEN] = {
    show: mount,
    hide() {
      pause();
      clearTimeout(countdownTimer);
      cancelAnimationFrame(raf); raf = 0;
      if (abort) abort.abort();
      if (modalObserver) modalObserver.disconnect();
      document.body.classList.remove("pb-game");
      // 結果を 見おわった あそびは つぎに ひらいた とき あたらしく する
      if (round && round.phase === "result" && paid) round = null;
    },
    refresh() { /* ほかの タブの 変更で ゲームの 画面を 書きかえない */ },
  };
})();
