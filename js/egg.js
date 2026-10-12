/* たまご選択 → なまえ → たんじょう */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets } = BCT;
  let chosen = null;

  function renderEggs() {
    const box = $("eggs");
    box.innerHTML = "";
    pets.TYPE_KEYS.forEach((key) => {
      const t = pets.TYPES[key];
      const b = document.createElement("button");
      b.className = "egg";
      b.dataset.type = key;
      b.innerHTML = `${pets.eggSvg(key)}<span class="egg-label">${t.egg}</span><span class="egg-sub"><span>${t.motif}の ようせい？</span><span>${t.personality}</span></span>`;
      b.addEventListener("click", () => pick(key, b));
      box.appendChild(b);
    });
  }

  async function pick(key, btn) {
    document.querySelectorAll(".egg").forEach((e) => e.classList.toggle("picked", e === btn));
    const t = pets.TYPES[key];
    const ok = await ui.modal(
      `<h3>${t.egg}に する？</h3>
       <div style="width:170px;margin:0 auto">${pets.eggSvg(key)}</div>
       <p class="lead">なかには ${t.motif}の すがたを した<br>${t.personality} うみの ようせいが いるよ。</p>`,
      [{ label: "やめる", cls: "ghost", value: false }, { label: "これに する！", cls: "mint", value: true }]
    );
    btn.classList.remove("picked");
    if (!ok) return;
    chosen = key;
    $("namePet").innerHTML = `<div style="width:140px;margin:0 auto">${pets.eggSvg(key)}</div>`;
    const s = BCT.store.get();
    $("inPetName").value = "";
    $("inPetName").placeholder = t.defaultName;
    $("inTeam").value = s.team.name || "";
    $("inMembers").value = String(s.team.members || 0);
    ui.show("name");
  }

  function submitName(e) {
    e.preventDefault();
    const name = $("inPetName").value.trim() || pets.TYPES[chosen].defaultName;
    const team = $("inTeam").value.trim() || "たんけんたい";
    const members = parseInt($("inMembers").value, 10) || 0;
    const r = BCT.game.choosePet(chosen, name, team, members);
    hatch(r.gift);
  }

  function hatch(gift) {
    const s = BCT.store.get();
    ui.show("hatch");
    $("hatchGo").style.display = "none";
    $("hatchMsg").textContent = "あれ？ たまごが うごいてる…！";
    const stage = $("hatchStage");
    stage.classList.remove("cracking");
    stage.innerHTML = `<div style="width:220px" class="egg picked">${pets.eggSvg(s.pet.type)}</div>`;
    setTimeout(() => {
      // 殻が とびちる
      stage.firstElementChild.classList.remove("picked");
      stage.classList.add("cracking");
    }, 1400);
    setTimeout(() => {
      const st = BCT.store.get();
      stage.innerHTML = `<div style="width:230px;animation:pop2 .5s ease-out">${pets.renderState(st, { face: "happy" })}</div>`;
      $("hatchMsg").innerHTML = `うまれたよ！<br>「${ui.esc(st.pet.name)}」です。よろしくね！` +
        (gift ? `<br><span class="note">🎁 うまれた おいわいに「あかい リボン」を プレゼント！</span>` : "");
      $("hatchGo").style.display = "flex";
    }, 2700);
  }

  $("nameForm").addEventListener("submit", submitName);
  $("nameBack").addEventListener("click", () => ui.show("egg"));
  $("hatchGo").addEventListener("click", () => ui.show("home"));

  BCT.screens.egg = { show: renderEggs };
})();
