/*
 * ミッション：うみクイズ ・ そうじミッション ・ とくべつな ごほうび
 * ------------------------------------------------------------
 * - クイズは「もんだいに ちょうせん する！」で まだ クリアしていない もんだいを 1もんずつ。
 *   はじめて せいかいしたときだけ ごほうび（たんけんたいメダル）。まちがえても へらない。かいせつを 見て もういちど ちょうせん できる。
 *   クリアした もんだいは「ふくしゅう する」で ◀ ▶ を おして めくりながら 見かえせる（こたえと かいせつ）。
 * - いちばん したに とくべつ しょうごう（3れつ。タップで 大きく 見る）。
 * - そうじミッションは ゴミの しゅるいごとに 1かい（「ひろう」で はじめて きろくしたとき）。
 * - ごほうびの 受け取りは js/game.js の claim()（イベントID と ミッションID で 二重に もらえない）。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game } = BCT;
  let view = null; // null = いちらん / { id } = クイズ
  let reviewAt = 0; // クリアした もんだいの 見かえし（何ばんめ）

  const missionName = (t) => (t.key === "other" ? "そのほかの ゴミを みつけた" : `${t.name}を みつけた`);
  BCT.missionName = missionName;

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const nextQuiz = (s, afterId) => {
    const list = BCT.QUIZ;
    const start = afterId ? list.findIndex((q) => q.id === afterId) + 1 : 0;
    for (let i = 0; i < list.length; i++) {
      const q = list[(start + i) % list.length];
      if (!game.isClaimed(s, "quiz", q.id)) return q;
    }
    return null;
  };

  function renderList() {
    view = null;
    const s = BCT.store.get();
    const R = BCT.CONFIG.reward;
    const qDone = game.quizCleared(s), cDone = game.cleanCleared(s);
    const nq = nextQuiz(s);
    const ach = [
      { id: "reward_clean_hat", prog: `${Math.min(1, cDone)}/1` },
      { id: "reward_guardian_medal", prog: `Lv${game.level(s)}/${game.maxLevel()}` },
      { id: "reward_event_frame", prog: [`クイズ ${Math.min(qDone, BCT.CONFIG.eventFrameQuiz)}/${BCT.CONFIG.eventFrameQuiz}`, `そうじ ${Math.min(1, cDone)}/1`] },
    ];
    // イベント しゅうりょう QR は イベントの 日だけ（js/event-mode.js）。イベントの 日 いがいは 管理者モードで 確認できる
    const eventOpen = !BCT.eventMode || BCT.eventMode.isOpen();
    $("missionBody").innerHTML = `
      ${eventOpen ? `<button class="btn block sea" id="msQr" style="margin-bottom:12px">イベント しゅうりょう QRコード</button>` : ""}

      <div class="card">
        <h3>${BCT.art.icon("quiz")} うみクイズ <span class="count">${qDone} / ${BCT.QUIZ.length}</span></h3>
        <p class="note one-line">1もんクリアごとに${BCT.medal.amount(R.quiz.coins, '+')}枚。まちがえてもへらないよ。</p>
        ${nq ? `<button class="btn block peach" id="msNext">もんだいに ちょうせん する！</button>`
          : `<p class="quiz-alldone">ぜんぶ クリア！</p>`}
        <button class="btn block ghost" id="msReview" ${qDone ? "" : "disabled"} style="margin-top:8px">📖 ふくしゅう する${qDone ? `（${qDone}もん）` : ""}</button>
      </div>

      <div class="card">
        <h3>${BCT.art.icon("clean")} そうじミッション <span class="count">${cDone} / ${BCT.CLEAN_MISSIONS.length}</span></h3>
        <p class="note one-line">ゴミのしゅるいごとに、はじめてきろくすると${BCT.medal.amount(R.clean.coins, '+')}枚。</p>
        <ul class="mlist">${BCT.CLEAN_MISSIONS.map((t) => {
          const done = game.isClaimed(s, "clean", t.key);
          return `<li class="${done ? "done" : ""}"><span class="ico clean-art">${BCT.collectionArt.missionIcon(t.key)}</span><span class="nm">${ui.esc(missionName(t))}</span>
            <span class="st">${done ? "✓ クリア" : BCT.medal.amount(R.clean.coins)}</span></li>`;
        }).join("")}</ul>
        <button class="btn block mint" data-go-cap>${BCT.art.icon("capture")} ゴミを きろく しにいく</button>
        <p class="note" style="margin-bottom:0">⚠ ガラス・はりが ついている もの・おもいもの・いきものは さわらずに、おとなに しらせてね。
          かいがらや いきものは もちかえらないでね。</p>
      </div>

      <div class="card">
        <h3>${BCT.art.icon("gift")} とくべつな ごほうび（うっていない もの）</h3>
        <ul class="mlist">${ach.map((a) => {
          const it = BCT.itemOf(a.id);
          const have = game.owns(s, a.id);
          return `<li class="${have ? "done" : ""}"><span class="ico mini">${BCT.art.itemIcon(a.id)}</span>
            <span class="nm">${ui.esc(it.name)}<br><small>${ui.esc(it.how)}</small></span>
            <span class="st">${have ? "✓ もらった" : [].concat(a.prog).map(ui.esc).join("<br>")}</span></li>`;
        }).join("")}</ul>
      </div>

      ${badgesHtml(s)}`;
    if (nq) $("msNext").onclick = () => openQuiz(nq.id);
    $("msReview").onclick = openReview;
    if ($("msQr")) $("msQr").onclick = () => BCT.profile.showQr();
    $("missionBody").querySelector("[data-go-cap]").onclick = () => ui.show("capture");
    document.querySelectorAll("#missionBody [data-badge]").forEach((b) => (b.onclick = () => showBadge(b.dataset.badge)));
  }

  // ---------------- ふくしゅう：クリアした もんだいを ◀ ▶ で めくって 見かえす（もんだい・こたえ・かいせつ） ----------------
  function openReview() {
    const s = BCT.store.get();
    const done = BCT.QUIZ.filter((q) => game.isClaimed(s, "quiz", q.id));
    if (!done.length) return;
    reviewAt = Math.max(0, Math.min(done.length - 1, reviewAt));
    ui.modal(`<h3>📖 ふくしゅう</h3><div class="qreview" id="qReview"></div>`, [{ label: "とじる", cls: "ghost", value: null }]);
    const draw = () => {
      const q = done[reviewAt];
      $("qReview").innerHTML = `
        <div class="qr-head">
          <button class="qr-nav" data-qr="-1" aria-label="まえの もんだい" ${reviewAt === 0 ? "disabled" : ""}>◀</button>
          <span class="qr-pos">クリアした もんだい <b>${reviewAt + 1}</b> / ${done.length}</span>
          <button class="qr-nav" data-qr="1" aria-label="つぎの もんだい" ${reviewAt === done.length - 1 ? "disabled" : ""}>▶</button>
        </div>
        <p class="qr-q">だい ${BCT.QUIZ.indexOf(q) + 1}もん　${ui.esc(q.q)}</p>
        <div class="qr-a">⭕ ${ui.esc(q.c[q.a])}</div>
        <p class="note qr-e">💡 ${ui.esc(q.e)}</p>`;
      $("qReview").querySelectorAll("[data-qr]").forEach((b) => (b.onclick = () => { reviewAt += Number(b.dataset.qr); draw(); }));
    };
    draw();
  }

  // ---------------- とくべつ しょうごう（3れつ。もらった ものは タップで 大きく） ----------------
  function badgesHtml(s) {
    const have = new Set(s.badges.map((b) => b.id));
    return `<div class="card badges-card">
        <h3>${BCT.art.icon("me")} とくべつ しょうごう <span class="count">${have.size} / ${BCT.BADGES.length}</span></h3>
        <div class="badges badges3">${BCT.BADGES.map((b) => `
          <button class="badge ${have.has(b.id) ? "" : "locked"}" data-badge="${b.id}" aria-label="${ui.esc(b.name)} ${have.has(b.id) ? "ゲット" : "これから"}">
            <div class="medal painted-medal">${BCT.collectionArt.badge(b.id)}</div><span class="badge-name">${ui.esc(b.name)}</span>
            <span class="badge-state">${have.has(b.id) ? "ゲット！" : b.prog ? `いま ${ui.esc(b.prog(s))}` : "これから"}</span>
          </button>`).join("")}</div>
      </div>`;
  }
  // もらった しょうごうは 大きな 絵、まだの ものは もらいかた
  function showBadge(id) {
    const s = BCT.store.get();
    const b = BCT.badgeOf(id);
    const got = s.badges.find((x) => x.id === id);
    const day = got ? new Date(got.t) : null;
    ui.modal(`<div class="badge-big ${got ? "" : "locked"}">
        <div class="medal painted-medal">${BCT.collectionArt.badge(id)}</div>
        <h3>${ui.esc(b.name)}</h3>
        <p class="lead">${ui.esc(b.cond)}</p>
        <p class="note">${got ? `${day.getMonth() + 1}がつ ${day.getDate()}にち に ゲット！` : `まだ だよ${b.prog ? `（いま ${ui.esc(b.prog(s))}）` : ""}`}</p>
      </div>`, [{ label: "とじる", cls: "ghost", value: null }]);
  }

  function openQuiz(id) {
    view = { id };
    const s = BCT.store.get();
    const q = BCT.QUIZ.find((x) => x.id === id);
    const n = BCT.QUIZ.indexOf(q) + 1;
    const done = game.isClaimed(s, "quiz", q.id);
    const R = BCT.CONFIG.reward.quiz;
    const order = shuffle(q.c.map((text, idx) => ({ text, idx })));
    $("missionBody").innerHTML = `
      <button class="btn small ghost" data-back>← ミッション</button>
      <div class="card" style="margin-top:10px">
        <div class="quiz-count">だい ${n}もん ／ ${BCT.QUIZ.length}もん　${done ? "（ふくしゅう・ごほうび なし）" : `クリアで ${BCT.medal.amount(R.coins, "+")}`}</div>
        <p class="quiz-q">${ui.esc(q.q)}</p>
        <div class="choices" id="choices"></div>
        <div id="answer"></div>
      </div>`;
    $("missionBody").querySelector("[data-back]").onclick = renderList;
    let answered = false;
    order.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.dataset.idx = o.idx;
      b.textContent = `${"ABC"[i]}．${o.text}`;
      b.onclick = () => {
        if (answered) return; // 連打しても 1かい
        answered = true;
        answer(q, o.idx, done);
      };
      $("choices").appendChild(b);
    });
    window.scrollTo(0, 0);
  }

  async function answer(q, idx, wasDone) {
    const ok = idx === q.a;
    document.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      const i = +b.dataset.idx;
      if (ok && i === q.a) b.classList.add("right");
      if (!ok && i === idx) b.classList.add("wrong");
    });
    game.quizAnswered(ok);
    const picked = document.querySelector(`.choice[data-idx="${idx}"]`);
    if (ok && picked && BCT.coinFly) BCT.coinFly.from(picked); // こたえの ボタンから メダルが とぶ
    let gain = "";
    let claimed = null;
    if (ok && !wasDone) {
      claimed = game.claim("quiz", q.id);
      if (claimed.ok) gain = ui.gainHtml(claimed);
    }
    const s = BCT.store.get();
    const nq = nextQuiz(s, q.id);
    $("answer").innerHTML = ok
      ? `<div class="answer right"><div class="big">⭕ せいかい！</div>${gain}
           ${wasDone ? `<div class="note">ふくしゅう だったので ごほうびは ないよ</div>` : ""}
           <div style="margin-top:6px">💡 ${ui.esc(q.e)}</div></div>
         <div class="btn-row" style="margin-top:12px">
           <button class="btn ghost" data-back>ミッションへ</button>
           ${nq ? `<button class="btn" data-next="${nq.id}">つぎの もんだい</button>` : ""}
         </div>`
      : `<div class="answer wrong"><div class="big">🤔 ざんねん！</div>
           <div class="note">たんけんたいメダルは へらないよ。ヒントを よんで もういちど！</div>
           <div style="margin-top:6px">💡 ${ui.esc(q.e)}</div></div>
         <div class="btn-row" style="margin-top:12px">
           <button class="btn ghost" data-back>ミッションへ</button>
           <button class="btn peach" data-retry>もういちど</button>
         </div>`;
    const box = $("answer");
    box.querySelector("[data-back]").onclick = renderList;
    const nx = box.querySelector("[data-next]");
    if (nx) nx.onclick = () => openQuiz(nx.dataset.next);
    const rt = box.querySelector("[data-retry]");
    if (rt) rt.onclick = () => openQuiz(q.id);
    if (claimed && claimed.ok) await BCT.afterGain();
  }

  BCT.mission = { openQuiz, renderList };
  BCT.screens.mission = {
    show(arg) {
      if (arg && arg.quiz) openQuiz(arg.quiz);
      else if (!view) renderList();
      else renderList();
    },
    refresh() { if (!view) renderList(); },
  };
})();
