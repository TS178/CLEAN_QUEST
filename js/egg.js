/* ようせい選択 → なまえ → なかまに。画面IDは既存の遷移との互換性のため保持。 */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets } = BCT;
  let chosen = null;
  let picking = false;
  const descriptions = {
    dolphin: 'げんきで かっぱつ！ なみに のったり、ジャンプしたりするのが だいすき。いっしょに うみを たんけんしよう！',
    turtle: 'おっとり やさしい！ のんびり およぎながら、はまべの なかまを みまもるよ。いっしょに うみを まもろう！',
    hermit: 'こうきしん いっぱい！ かいがらの おうちから かおを だして、あたらしい はっけんを さがすよ。いっしょに たんけんしよう！',
  };
  const portrait = key => `<img src="assets/opening/${key}.webp" alt="${pets.TYPES[key].motif}のようせい" draggable="false">`;

  function renderEggs() {
    const box = $("eggs");
    document.body.classList.add('fairy-selection');
    picking = false;
    box.innerHTML = "";
    const s=BCT.store.get(),have=BCT.game.companionStates(s).map(p=>p.pet.type);
    if(s.pet){
      $('fairyBack').hidden=false;
      if(!BCT.game.canAdopt(s))return;
    } else $('fairyBack').hidden=true;
    pets.TYPE_KEYS.filter(key=>!have.includes(key)).forEach((key) => {
      const t = pets.TYPES[key];
      const b = document.createElement("button");
      b.className = "fairy-choice";
      b.type = 'button';
      b.setAttribute('aria-label', `${t.motif}のようせいを えらぶ`);
      b.dataset.type = key;
      b.innerHTML = `<span class="fairy-spotlight" aria-hidden="true"></span><span class="fairy-portrait">${portrait(key)}</span><span class="fairy-label">${t.motif}<small>の ようせい</small></span>`;
      b.addEventListener("click", () => pick(key, b));
      box.appendChild(b);
    });
  }

  async function pick(key, btn) {
    if (picking) return;
    picking = true;
    btn.classList.add('picked');
    if (!ui.reducedMotion()) await new Promise(resolve => setTimeout(resolve, 460));
    if (ui.current() !== 'egg' || !btn.isConnected) { picking = false; return; }
    const t = pets.TYPES[key];
    const ok = await ui.modal(
      `<h3>このようせいにしますか？</h3>
       <div class="fairy-confirm-portrait">${portrait(key)}</div>
       <p class="fairy-confirm-name">${t.motif}の ようせい</p>
       <p class="lead">${descriptions[key]}</p>`,
      [{ label: "いいえ", cls: "ghost", value: false }, { label: "はい", cls: "mint", value: true }]
    );
    btn.classList.remove("picked");
    picking = false;
    if (!ok) { btn.focus({ preventScroll: true }); return; }
    chosen = key;
    $("namePet").innerHTML = `<div class="fairy-confirm-portrait">${portrait(key)}</div>`;
    const s = BCT.store.get();
    $("inPetName").value = "";
    $("inPetName").placeholder = t.defaultName;
    $("inTeam").value = s.team.name || "";
    $("inMembers").value = String(s.team.members || 0);
    $('inTeam').disabled=!!s.pet;$('inMembers').disabled=!!s.pet;
    $('nameTeamField').hidden=!!s.pet;$('nameMembersField').hidden=!!s.pet;
    $('existingTeamNote').hidden=!s.pet;
    $('existingTeamNote').textContent=s.pet?`「${s.team.name || 'たんけんたい'}」の あたらしい相棒だよ。たんけんたいの なまえは そのまま！`:'';
    ui.show("name");
  }

  function submitName(e) {
    e.preventDefault();
    const name = $("inPetName").value.trim() || pets.TYPES[chosen].defaultName;
    const team = $("inTeam").value.trim() || "たんけんたい";
    const members = parseInt($("inMembers").value, 10) || 0;
    const r = BCT.store.get().pet ? BCT.game.adoptPet(chosen,name) : BCT.game.choosePet(chosen, name, team, members);
    if(!r.ok){ui.toast('むかえられませんでした。保存状態と しんかを たしかめてね。');return;}
    hatch(r.gift);
  }

  function hatch(gift) {
    const s = BCT.store.get();
    ui.show("hatch");
    const stage = $("hatchStage");
    stage.innerHTML = `<div class="fairy-welcome">${pets.renderState(s, { face: "happy" })}</div>`;
    $("hatchMsg").innerHTML = `「${ui.esc(s.pet.name)}」が なかまに なったよ！<br>いっしょに ぼうけんしよう！` +
      (gift ? `<br><span class="note">🎁 なかまに なった おいわいに「あかい リボン」を プレゼント！</span>` : "");
    $("hatchGo").style.display = "flex";
  }

  $("nameForm").addEventListener("submit", submitName);
  $("nameBack").addEventListener("click", () => ui.show("egg"));
  $("hatchGo").addEventListener("click", () => ui.show("home"));

  $('fairyBack').onclick = () => ui.show('home');
  BCT.screens.egg = { show: renderEggs, hide() { document.body.classList.remove('fairy-selection'); } };
})();
