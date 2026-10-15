/* ホーム：ようせいが うごきまわる・なでる・おもちゃで あそぶ・レベルアップの おいわい */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets, game } = BCT;
  const pet = $("pet");
  const pond = $("pond");
  const playArea = $("petPlayArea");
  let wanderTimer = null;
  let bubbleTimer = null;
  let shownKey = "";
  let portraitKey = "";
  let busy = false;       // なでる・あそぶ の演出中（このあいだの連打は かぞえない）
  let playToken = 0;      // あそびの とちゅうで 画面を はなれたら 1かいに かぞえない
  let pose = "normal";
  let fit = 1;            // ようせいの 大きさ ÷ 190px（池が ひくい 画面で ちいさく。はねる 高さも これに 比例）
  let baseAmp = 1;
  // パーツで うごかす ようせい（うごきまわる あいだだけ。なでる・あそぶ・よろこぶ ときは 正面の絵。js/pet-rig.js）
  let rig = null;
  let prefetched = "";
  let lastTurn = 0;        // 最後に 向きを かえた 時刻（向きを かえるのは 30秒に 1回ほど。js/pet-rig-config.js の turnEveryMs）

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 段階が 上がるほど 動きが大きく 堂々とする
  const AMP = { 1: 0.75, 2: 1, 3: 1.3 };

  // 見せる レベル（レベルアップ演出の前は 前の すがたの まま）
  const shownLv = (s) => Math.min(s.seenLv, game.level(s));

  // ビーチが よごれていると こまりがお（なにも へらない。おそうじすれば すぐ えがおに もどる）
  const WORRIED_LINES = ["ゴミが いっぱいで こまったな…", "ビーチを きれいに してくれる？", "したの ゴミばこに いれてね"];
  const isWorried = (s) => game.dirtLevel(s) > 0;
  function drawPet(force) {
    const s = BCT.store.get();
    if (!s.pet) return;
    const lv = shownLv(s);
    const worried = isWorried(s);
    pet.classList.toggle("worried", worried);
    const face = !worried && game.affection(s).stage >= 1 ? "happy" : undefined; // なつきど1：えがお
    const k = JSON.stringify([s.pet.type, lv, s.equip, face, pose]);
    if (k === shownKey && !force) return;
    shownKey = k;
    $("petBody").innerHTML = pets.renderState(s, { lv, face, pose });
    baseAmp = AMP[game.stageOf(lv)];
    pet.style.setProperty("--amp", baseAmp * fit); // 小さい ようせいは 小さく はねる（fitPet）
    pet.dataset.type = s.pet.type;
    syncRig(s, lv);
  }
  function syncRig(s, lv) {
    if (!BCT.petRig) return;
    rig = BCT.petRig.sync(rig, { type: s.pet.type, stage: game.stageOf(lv), equip: s.equip, host: $("petFacing"), track: pet, owner: pet });
    // 進化したあと 圏外でも 出せるように、同じ 種類の パーツを 先に 読んでおく（Service Worker が 保存）
    if (prefetched !== s.pet.type) {
      prefetched = s.pet.type;
      BCT.petRig.prefetch(s.pet.type);
    }
  }
  const rigOn = (on) => BCT.petRig && BCT.petRig.setActive(rig, on);

  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    drawPet();
    const pk = JSON.stringify([s.pet.type, shownLv(s), s.equip]);
    if (pk !== portraitKey) {
      portraitKey = pk;
      $("fairyPortrait").innerHTML = BCT.art.render({ type: s.pet.type, stage: game.stageOf(shownLv(s)), equip: s.equip, face: "happy", motion: false });
      // 種類・進化・装備ごとの絵全体を、丸枠の内側へ余白をつけて収める。
      const portrait = $("fairyPortrait").querySelector("svg");
      const bounds = portrait.getBBox();
      if (bounds.width && bounds.height) {
        const side = Math.hypot(bounds.width, bounds.height) * 1.06;
        portrait.setAttribute("viewBox", `${bounds.x + bounds.width / 2 - side / 2} ${bounds.y + bounds.height / 2 - side / 2} ${side} ${side}`);
      }
      $("habitatPortrait").innerHTML = BCT.art.icon("home");
      $("actHabitat").setAttribute("aria-label", `${BCT.HABITATS[s.pet.type]}へ いく`);
    }
    // けいけんち・なつきど・クイズ／そうじ の すすみぐあいは じぶん・ミッション画面で 見る（ホームには 出さない）
    renderBadges(s);
  }

  // とくべつ しょうごう：ホームの いちばん したに 小さく 1行（もらった ものは 色、まだの ものは うすく）。ミッションの ものは そのまま
  let badgeKey = "";
  function renderBadges(s) {
    const have = new Set(s.badges.map((b) => b.id));
    const key = [...have].sort().join(",");
    if (key === badgeKey && $("homeBadges").childElementCount) return;
    badgeKey = key;
    $("homeBadges").innerHTML = `<span class="hbg-lbl">とくべつ しょうごう</span>
      <span class="hbg-medals">${BCT.BADGES.map((b) => `<span class="hbg-medal ${have.has(b.id) ? "" : "locked"}" title="${ui.esc(b.name)}">${BCT.collectionArt.badge(b.id)}</span>`).join("")}</span>
      <span class="hbg-count">${have.size}/${BCT.BADGES.length}</span>`;
    $("homeBadges").setAttribute("aria-label", `とくべつ しょうごう ${have.size} / ${BCT.BADGES.length}。ミッションで 見る`);
  }
  $("homeBadges").addEventListener("click", () => {
    ui.show("mission");
    requestAnimationFrame(() => {
      const c = document.querySelector("#missionBody .badges-card");
      if (c) c.scrollIntoView({ block: "start", behavior: ui.reducedMotion() ? "auto" : "smooth" });
    });
  });

  // ---------------- うごきまわる ----------------
  function wander() {
    if (ui.current() !== "home" || busy) return stopWander();
    const w = playArea.clientWidth, h = playArea.clientHeight;
    if (!w) return;
    const half = pet.offsetWidth / 2 || 75;
    // よろこんで はねる 演出（イルカは 190px の とき 60〜80px。ようせいの 大きさに 比例）で 頭が 池の 上で きれないよう、上に すきまを あける。
    // 左右も 回転で はみださないよう すこし あける（小さい スマホで 池が ひくい ときに たいせつ）
    const headroom = Math.round(95 * fit) + 12, edge = Math.round(38 * fit) + 12;
    const maxY = h - half - 10;
    const minY = Math.min(maxY, half + headroom);
    const y = minY + Math.random() * Math.max(0, maxY - minY);
    const nowX = pet.offsetLeft + half;
    let x;
    if (BCT.petRig) {
      // 向いている ほうへ すすむ。向きを かえるのは 間隔が あいたときだけ（何度も 反転すると 目に つくため）
      const n = BCT.petRig.nextX(nowX, half + edge, Math.max(half + edge, w - half - edge), pet.classList.contains("left"),
        Date.now() - lastTurn >= BCT.petRig.turnEvery(), Math.random());
      x = n.x;
      if (n.turned) {
        pet.classList.toggle("left", n.left);
        lastTurn = Date.now();
      }
    } else {
      x = half + edge + Math.random() * Math.max(0, w - (half + edge) * 2);
      pet.classList.toggle("left", x < nowX - 10);
    }
    pet.style.left = x + "px";
    pet.style.top = y + "px";
  }
  function startWander() {
    stopWander();
    if (busy) return;
    pet.classList.remove("close");
    rigOn(true); // 先に パーツ表示に する（パーツ表示の あいだは 向きを 一瞬で かえる）
    wander();
    wanderTimer = setInterval(wander, 3600);
  }
  function stopWander() {
    clearInterval(wanderTimer);
    clearTimeout(wanderTimer);
    wanderTimer = null;
    rigOn(false);
  }
  // いまの位置で 止める
  function freeze() {
    stopWander();
    const cs = getComputedStyle(pet);
    pet.style.left = cs.left;
    pet.style.top = cs.top;
  }
  // まえ（手前の まんなか）に 来る
  function comeClose() {
    stopWander();
    if (pet.classList.contains("left")) lastTurn = Date.now(); // 正面を むくので 向きが かわる
    pet.classList.remove("left");
    pet.style.left = "50%";
    const half = pet.offsetHeight / 2;
    pet.style.top = Math.max(half, playArea.clientHeight - half * 1.18 - 12) + "px";
    pet.classList.add("close");
  }

  function petCenter() {
    const pr = pond.getBoundingClientRect();
    const r = pet.getBoundingClientRect();
    return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2, h: r.height };
  }

  function say(text, ms) {
    pond.querySelectorAll(".bubble").forEach((b) => b.remove());
    const c = petCenter();
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = text;
    b.style.left = "0px";
    pond.appendChild(b);
    // 吹き出しの 大きさを はかってから 置く（ながい セリフでも 池から はみださない）：
    // ようせいの うえに 入らなければ したへ。どちらも 入らなければ 池の いちばん うえ。左右も 池の 中へ
    const W = pond.clientWidth, H = pond.clientHeight;
    const bw = Math.min(b.offsetWidth, W - 12);
    b.style.width = bw + "px";
    const bh = b.offsetHeight;
    let y = c.y - c.h / 2 + 6; // 吹き出しの した（とがった さき）
    if (y - bh < 6) {
      const below = c.y + c.h / 2 - 6;
      if (below + bh + 6 <= H) { b.classList.add("below"); y = below; }
      else y = bh + 6;
    }
    b.style.left = Math.max(bw / 2 + 6, Math.min(W - bw / 2 - 6, c.x)) + "px";
    b.style.top = y + "px";
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.remove(), ms || 2400);
  }

  function hearts(n) {
    const c = petCenter();
    for (let i = 0; i < (n || 3); i++) {
      const h = document.createElement("div");
      h.className = "heart";
      h.textContent = ["💗", "💖", "💕", "💞", "✨"][i % 5];
      h.style.left = c.x - 13 + (i - 1) * 22 + "px";
      h.style.top = c.y - 40 + "px";
      h.style.setProperty("--dx", (i - (n || 3) / 2) * 14 + "px");
      h.style.animationDelay = i * 0.12 + "s";
      pond.appendChild(h);
      setTimeout(() => h.remove(), 1700);
    }
  }

  function playClass(cls, ms) {
    pet.classList.remove(cls);
    void pet.offsetWidth; // アニメを もう一度 うごかす
    pet.classList.add(cls);
    setTimeout(() => pet.classList.remove(cls), ms);
  }

  // ---------------- なでる ----------------
  async function doPet() {
    const s0 = BCT.store.get();
    if (busy || !s0.pet) return;
    busy = true;
    const r = game.pet();
    const s = BCT.store.get();
    const a = game.affection(s);
    const special = a.stage >= 3;
    if (a.stage >= 2) comeClose(); // なつきど2：こちらに 近づく
    else freeze();
    drawPet();
    const ms = special ? 2200 : 1300;
    playClass(special ? "special" : "joy", ms);
    hearts(special ? 5 : 3);
    if (r.stageUp) {
      say(pets.AFFECTION_LINES[a.stage], 3000);
      ui.toast(`なつきど が あがった！ ${"♥".repeat(a.stage)}`);
    } else if (isWorried(s)) {
      say(WORRIED_LINES[Math.floor(Math.random() * WORRIED_LINES.length)]);
    } else {
      say(pets.randomLine(s.pet.type, s.team.name));
    }
    render();
    await sleep(ms);
    busy = false;
    if (ui.current() === "home") wanderTimer = setTimeout(startWander, a.stage >= 2 ? 2200 : 1200);
  }

  // ---------------- おもちゃで あそぶ ----------------
  async function play() {
    const s = BCT.store.get();
    if (busy || !s.pet) return;
    const toys = game.ownedItems(s, "toy");
    if (!toys.length) {
      const go = await ui.modal(
        `<h3>🏐 おもちゃが ないよ</h3><p class="lead">ようせいは タップで なでなで できるよ。<br>
          ショップで おもちゃを かうと、いっしょに あそべるよ。3かい あそぶと、しゃしんで つかえる ポーズを おぼえるよ！</p>`,
        [{ label: "とじる", cls: "ghost", value: false }, { label: "ショップへ", cls: "mint", value: true }]
      );
      if (go) ui.show("shop", "toy");
      return;
    }
    const need = BCT.CONFIG.toyUnlockPlays;
    const pick = await new Promise((resolve) => {
      ui.modal(
        `<h3>なにで あそぶ？</h3><div class="toy-pick">${toys.map((t) => {
          const n = game.toyPlays(s, t.id);
          return `<button class="toy-btn" data-toy="${t.id}">${BCT.art.itemIcon(t.id)}<b>${ui.esc(t.name)}</b>
            <small>${n >= need ? "ポーズ おぼえた！" : `ポーズまで ${n}/${need}`}</small></button>`;
        }).join("")}</div><button class="btn block ghost" data-close style="margin-top:12px">やめる</button>`
      ).then(() => resolve(null));
      document.querySelectorAll("#modalBox [data-toy]").forEach((b) =>
        b.addEventListener("click", () => { ui.closeModal(); resolve(b.dataset.toy); }));
    });
    if (!pick) return;

    busy = true;
    const token = ++playToken;
    comeClose();
    pose = pick;
    drawPet();
    playClass("playing", 2600);
    hearts(2);
    say(`${BCT.itemOf(pick).name}で あそぼう！`, 2200);
    await sleep(ui.reducedMotion() ? 900 : 2600);
    pose = "normal";
    if (token !== playToken || ui.current() !== "home") return; // とちゅうで やめた
    const r = game.playToy(pick);
    busy = false;
    drawPet();
    render();
    if (!r.ok) return;
    if (r.unlocked) {
      const st = BCT.store.get();
      await ui.modal(
        `<h3>✨ あたらしい ポーズを おぼえた！</h3>
         <div class="reward-preview">${pets.renderState(st, { pose: r.unlocked })}</div>
         <p style="text-align:center;font-size:19px;font-weight:800;margin:6px 0">「${ui.esc(BCT.poseName(r.unlocked, st.pet.type))}」</p>
         <p class="lead">「いっしょに さつえい」で つかえるよ</p>`,
        [{ label: "やったね！", cls: "mint", value: true }]
      );
    } else {
      say(`たのしかった！（ポーズまで ${Math.min(r.plays, need)}/${need}）`);
    }
    if (ui.current() === "home") wanderTimer = setTimeout(startWander, 1500);
  }

  // ようせいを タップ → その場で なでる（いつもの あそびかた）
  pet.addEventListener("click", doPet);
  // ボタン → AR で なでる・あそぶ（js/ar.js）。AR が 読みこめないときは いつもの あそびかた
  // 「あそぶ」→ AR で なでる・おもちゃ（js/ar.js）。AR が 読みこめないときは いつもの あそびかた
  $("actPlay").addEventListener("click", () => (BCT.ar ? BCT.ar.open("play") : play()));

  // ---------------- レベルアップ・しんか ----------------
  // rAF が止まる環境（バックグラウンド・一部のブラウザ）でも進むよう、タイマーでも呼ぶ
  function nextFrame(fn) {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(tm);
      fn(performance.now());
    };
    const raf = requestAnimationFrame(go);
    const tm = setTimeout(go, 50);
  }

  /*
   * from → to に レベルアップ。
   * 見た目の段階が かわるときは しんかアニメ（①うかんで ゆっくり回る ②だんだん速く ③ピカッ）。
   * かわらないときは みじかい おいわい。どちらも 着せ替えは そのまま。
   */
  function celebrate(from, to) {
    return new Promise((resolve) => {
      const s = BCT.store.get();
      const evo = $("evo"), box = $("evoPet"), msg = $("evoMsg"), flash = $("evoFlash"), rays = $("evoRays");
      const grow = game.stageOf(to) > game.stageOf(from);
      const drawAt = (lv) => pets.renderState(s, { lv, face: "happy" });
      const finalMsg = () => `${grow ? "ようせいが せいちょうした！" : "レベルアップ！"}<br>Lv${to}「${ui.esc(pets.levelName(to))}」`;
      evo.classList.remove("done", "quick");
      rays.classList.remove("on");
      flash.classList.remove("on");
      box.style.transform = "";
      evo.classList.add("show");
      $("evoOk").onclick = () => {
        evo.classList.remove("show", "done", "quick");
        rays.classList.remove("on");
        shownKey = "";
        render();
        resolve();
      };

      const finish = () => {
        box.innerHTML = drawAt(to);
        box.style.transform = "scale(1.12)";
        rays.classList.add("on");
        msg.innerHTML = finalMsg();
        evo.classList.add("done");
        evo.dataset.phase = "done";
      };

      // みじかい おいわい（見た目は かわらない）／うごきを へらす 設定
      if (!grow || ui.reducedMotion()) {
        box.innerHTML = drawAt(grow ? to : from);
        evo.classList.add("quick");
        evo.dataset.phase = "quick";
        msg.innerHTML = "";
        setTimeout(finish, ui.reducedMotion() ? 0 : 500);
        return;
      }

      box.innerHTML = drawAt(from);
      msg.innerHTML = "あれ…？<br>ようせいの ようすが…！";
      evo.dataset.phase = "1";
      const T1 = 1300; // ① ふわっと うかんで ゆっくり 回る
      const T2 = 3200; // ② だんだん 速く 回る
      const start = performance.now();
      let last = start, angle = 0;
      const step = (now) => {
        const t = now - start;
        const dt = Math.min(100, now - last);
        last = now;
        let speed, y;
        if (t < T1) {
          const k = t / T1;
          y = -46 * (1 - Math.pow(1 - k, 2));
          speed = 70 + 50 * k; // 度/秒
        } else {
          const k = Math.min(1, (t - T1) / (T2 - T1));
          y = -46;
          speed = 120 + 2300 * k * k;
          if (evo.dataset.phase === "1") {
            evo.dataset.phase = "2";
            msg.innerHTML = "ぐるぐる ぐるぐる…！";
          }
        }
        angle += (speed * dt) / 1000;
        box.style.transform = `translateY(${y}px) rotate(${angle}deg)`;
        if (t < T2) return nextFrame(step);
        // ③ ピカッ！
        evo.dataset.phase = "3";
        flash.classList.add("on");
        setTimeout(() => {
          finish();
          flash.classList.remove("on");
        }, 450);
      };
      nextFrame(step);
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopWander();
    else if (ui.current() === "home" && !busy) startWander();
  });

  // ゴミを すてた・エサを たべた ときの よろこび（なつきどは かぞえない）
  let reactTimer = null;
  function react(kind, line) {
    if (busy) return;
    freeze();
    drawPet();
    pet.style.setProperty("--drop", (kind && kind.color) || "#7cc8ef");
    playClass(kind && kind.eat ? "eat" : "joy", 1300);
    hearts(kind && kind.eat ? 5 : 3);
    if (line) say(line, 2600);
    clearTimeout(reactTimer);
    reactTimer = setTimeout(() => { if (ui.current() === "home" && !busy) startWander(); }, 1600);
  }
  const petRect = () => pet.getBoundingClientRect();

  // ---------------- 画面の 高さに おさめる（スクロール なし。css/beach.css の #scr-home） ----------------
  // 池が のこりの 高さを うめる。ようせいの 大きさは「ゴミばこが 出ている ときの 池の 高さ」で きめる（出し入れで 大きさが かわらない）
  const scr = $("scr-home");
  function fitHome() {
    const top = document.querySelector(".topbar"), app = document.querySelector(".app");
    if (!top || !app || !scr.classList.contains("active")) return;
    const avail = window.innerHeight - top.offsetHeight - (parseFloat(getComputedStyle(app).paddingBottom) || 0);
    scr.style.setProperty("--home-h", Math.max(0, Math.floor(avail)) + "px");
    fitPet();
  }
  function fitPet() {
    const ph = playArea.clientHeight;
    if (!ph || !scr.classList.contains("active")) return;
    const wrap = $("binsWrap"), bins = $("bins");
    const hidden = wrap && wrap.classList.contains("gone") && bins ? bins.getBoundingClientRect().height : 0;
    // アイコンの帯を除いた高さに、ようせいとはねる余白を収める。
    const available = Math.max(320, pond.clientHeight - hidden) - playArea.offsetTop;
    const size = Math.round(Math.max(72, Math.min(190, (available - 34) / 1.5)));
    fit = size / 190;
    pet.style.setProperty("--pet-size", size + "px");
    pet.style.setProperty("--fit", fit.toFixed(3));
    pet.style.setProperty("--amp", baseAmp * fit);
    // 池が ひくく なったら ようせいを 池の 中へ もどす
    const maxTop = ph - size / 2 - 10, minTop = Math.min(maxTop, size / 2 + 95 * fit + 12);
    const cur = pet.offsetTop, edge = size * .7 + 12;
    const x = Math.max(edge, Math.min(playArea.clientWidth - edge, pet.offsetLeft));
    if (cur < minTop || cur > maxTop || x !== pet.offsetLeft) {
      // 画面回転・ごみ箱の伸縮では、古い座標から入口を横切るアニメをしない。
      pet.style.transition = "none";
      pet.style.top = Math.max(minTop, Math.min(maxTop, cur)) + "px";
      pet.style.left = x + "px";
      void pet.offsetWidth;
      pet.style.removeProperty("transition");
    }
  }
  window.addEventListener("resize", fitHome);
  if (window.ResizeObserver) new ResizeObserver(fitPet).observe(pond);

  BCT.home = { celebrate, say, render, petLegacy: doPet, playLegacy: play, react, petRect, drawPet };
  BCT.screens.home = {
    show() {
      shownKey = "";
      lastTurn = Date.now();
      requestAnimationFrame(fitHome);
      if (BCT.beach) BCT.beach.show(); // 時間が たった分 よごしてから 描く
      render();
      setTimeout(startWander, 60);
      if (BCT.pondVideo) BCT.pondVideo.play(); // 波の 動画（js/pond-video.js）
    },
    hide() {
      // あそびの とちゅうで はなれたら かぞえない
      playToken++;
      busy = false;
      pose = "normal";
      pet.classList.remove("joy", "special", "playing", "close", "eat");
      stopWander();
      if (BCT.beach) BCT.beach.hide();
      if (BCT.pondVideo) BCT.pondVideo.stop();
    },
    refresh() {
      render();
      if (BCT.beach) BCT.beach.render();
    },
  };
})();
