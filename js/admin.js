/*
 * 管理者モード（確認用のお試し画面）
 * ------------------------------------------------------------
 * - すべての ようせい（イルカ・ウミガメ・ヤドカリ）と しんかの すがた（段階1〜3）を えらべる
 * - あたま・こもの・みため を じゆうに きせかえ、ポーズ・かおも えらべる（もっていない アイテムも 見られる）
 * - 「うごく すがた（パーツ。js/pet-rig.js）」と「正面の絵（js/pet-art.js）」を きりかえて 見る
 * - 試着は保存しない。装備位置は明示的に保存すると、この端末の全画面に反映する。
 * - イベント しゅうりょう QR を イベントの 日 いがいでも 見られる（ミッションでは イベントの 日だけ。中身は いまの データ）
 * 入りかた：設定（右上の はぐるま）の バージョンを 7かい つづけて タップ（js/settings.js）
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets } = BCT;
  const st = { type: "dolphin", stage: 1, equip: {}, pose: "normal", face: "normal", view: "rig", left: false, swim: true };
  let rig = null;
  let editing=false, selected='head', drag=null;
  const placement=BCT.equipmentPlacement;
  const SLOTS = [["head", "あたま"], ["acc", "こもの"], ["look", "みため"]];
  const POSES = [["normal", "ふつう"], ["smile", "えがお"], ["toy_ball", "ボール"], ["toy_bubbles", "あわ"], ["toy_music", "おんがく"]];

  const btn = (on, attrs, label) => `<button class="adm-chip ${on ? "on" : ""}" ${attrs}>${label}</button>`;

  function render() {
    if(!st.equip[selected])selected=st.equip.head?'head':'acc';
    const items = (slot) => BCT.ITEMS.filter((it) => it.slot === slot && (!it.only || it.only === st.type));
    // べつの ようせい せんようの みためは はずす
    if (st.equip.look && !items("look").some((it) => it.id === st.equip.look)) delete st.equip.look;
    $("adminBody").innerHTML = `
      <div class="sub-top"><button class="btn small ghost" id="admBack">← せってい</button><h3>管理者モード</h3></div>
      <p class="note adm-note">試着は保存されません。装備の位置・大きさは「保存」で、この端末のホーム・すみかなどにも反映されます。</p>
      <button class="btn small sea block" id="admQr" style="margin-bottom:10px">イベント しゅうりょう QR を 見る（イベントの 日 いがいでも）</button>
      <div class="adm-stage ${st.left ? "left" : ""} ${editing?'editing':''}" id="admStage"><div class="adm-face" id="admFace"></div></div>
      <button class="btn small sea block" id="admEdit">${editing?'調整を終了':'装備の位置・大きさを調整'}</button>
      ${editing?`<div class="adm-placement">
        <p class="note">装備をドラッグして調整できます。種類・形態・アイテムごとに保存します。保存前に選び直すと変更は戻ります。</p>
        <div class="adm-row">${['head','acc'].filter(slot=>st.equip[slot]).map(slot=>btn(selected===slot,`data-adjust="${slot}"`,slot==='head'?'あたまを調整':'こものを調整')).join('')}</div>
        <div class="adm-row" aria-label="位置の微調整">${[['-1,0','←'],['0,-1','↑'],['0,1','↓'],['1,0','→']].map(([d,l])=>`<button class="adm-chip" data-nudge="${d}" aria-label="${l}に移動">${l}</button>`).join('')}</div>
        <label class="adm-scale-label" for="admScale">大きさ <output id="admScaleValue" for="admScale">100%</output></label>
        <div class="adm-scale"><button class="adm-chip" data-resize="-5" aria-label="5%縮小">−</button><input id="admScale" type="range" min="25" max="250" step="1" value="100" aria-label="装備の大きさ"><button class="adm-chip" data-resize="5" aria-label="5%拡大">＋</button></div>
        <div class="adm-row"><button class="btn small sea" id="admSave">位置・大きさを保存</button><button class="btn small ghost" id="admCancel">変更を戻す</button><button class="btn small ghost" id="admReset">標準に戻して保存</button></div>
        <p class="note" id="admPosition" role="status" aria-live="polite"></p>
      </div>`:''}
      <div class="adm-row">${btn(st.view === "rig", 'data-view="rig"', "うごく すがた")}${btn(st.view === "front", 'data-view="front"', "正面の絵")}
        ${btn(st.left, 'data-left', "← むき")}${st.view === "rig" ? btn(st.swim, 'data-swim', st.swim ? "およぐ" : "とまる") : ""}</div>
      <h4>ようせい</h4>
      <div class="adm-row">${pets.TYPE_KEYS.map((t) => btn(st.type === t, `data-type="${t}"`, `${pets.TYPES[t].motif}`)).join("")}</div>
      <h4>しんかの すがた</h4>
      <div class="adm-row">${[1, 2, 3].map((n) => btn(st.stage === n, `data-stage="${n}"`, `${n}：${pets.STAGE_NAMES[n]}`)).join("")}</div>
      ${st.view === "front" ? `<h4>ポーズ・かお</h4>
      <div class="adm-row">${POSES.map(([k, n]) => btn(st.pose === k, `data-pose="${k}"`, n)).join("")}
        ${btn(st.face === "happy", 'data-face', "にっこり")}</div>` : ""}
      ${SLOTS.map(([slot, name]) => `<h4>${name}</h4>
        <div class="adm-items">${btn(!st.equip[slot], `data-eq="${slot}" data-id=""`, "なし")}${items(slot).map((it) =>
          `<button class="adm-item ${st.equip[slot] === it.id ? "on" : ""}" data-eq="${slot}" data-id="${it.id}" title="${ui.esc(it.name)}">
            <span class="art">${BCT.art.itemIcon(it.id, st.type)}</span><span class="nm">${ui.esc(it.name)}</span></button>`).join("")}</div>`).join("")}`;
    $("admBack").onclick = () => ui.show("settings");
    $("admQr").onclick = () => BCT.profile.showQr();
    const on = (sel, fn, cancel=true) => document.querySelectorAll(`#adminBody ${sel}`).forEach((b) => (b.onclick = () => { if(cancel)placement.cancel(); drag=null; fn(b); render(); }));
    $('admEdit').onclick=()=>{placement.cancel();drag=null;editing=!editing;render();};
    if(editing){
      on('[data-adjust]',b=>selected=b.dataset.adjust);
      document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>{
        const id=st.equip[selected];if(!id)return;
        const a=placement.get(st.type,st.stage,id),[dx,dy]=b.dataset.nudge.split(',').map(Number);
        move(id,a.x+dx*(st.left?-1:1),a.y+dy);
      });
      $('admSave').onclick=()=>savePosition(false);
      $('admScale').oninput=e=>resize(Number(e.target.value));
      document.querySelectorAll('[data-resize]').forEach(b=>b.onclick=()=>resize(Number($('admScale').value)+Number(b.dataset.resize)));
      $('admReset').onclick=()=>savePosition(true);
      $('admCancel').onclick=()=>{placement.cancel();drawPet();positionStatus('保存前の変更を戻しました。');};
    }
    on("[data-view]", (b) => (st.view = b.dataset.view));
    on("[data-left]", () => (st.left = !st.left), false);
    on("[data-swim]", () => (st.swim = !st.swim));
    on("[data-type]", (b) => (st.type = b.dataset.type));
    on("[data-stage]", (b) => (st.stage = Number(b.dataset.stage)));
    on("[data-pose]", (b) => (st.pose = b.dataset.pose));
    on("[data-face]", () => (st.face = st.face === "happy" ? "normal" : "happy"));
    on("[data-eq]", (b) => { if (b.dataset.id) st.equip[b.dataset.eq] = b.dataset.id; else delete st.equip[b.dataset.eq]; });
    drawPet();
    if(editing)bindDrag();
  }

  function positionStatus(message) {
    const id=st.equip[selected],a=id&&placement.get(st.type,st.stage,id);
    if($('admPosition'))$('admPosition').textContent=message||(a?`${BCT.ITEMS.find(it=>it.id===id).name}：横 ${a.x.toFixed(1)}・縦 ${a.y.toFixed(1)}`:'下の「あたま」または「こもの」から装備を選んでください。');
    document.querySelectorAll('[data-adjust]').forEach(b=>b.classList.toggle('on',b.dataset.adjust===selected));
    for(const name of ['admSave','admReset','admCancel'])if($(name))$(name).disabled=!id;
    document.querySelectorAll('[data-nudge]').forEach(b=>b.disabled=!id);
    document.querySelectorAll('[data-resize]').forEach(b=>b.disabled=!id);
    if($('admScale')){
      const percent=a?Math.round(100*a.s/placement.defaultAnchor(st.type,st.stage,id).s):100;
      $('admScale').disabled=!id;$('admScale').value=percent;
      $('admScaleValue').textContent=percent+'%';
    }
  }
  function savePosition(reset) {
    const id=st.equip[selected];if(!id)return;
    const ok=placement.save(st.type,st.stage,id,reset);
    drawPet();positionStatus(ok?(reset?'標準の位置・大きさを保存しました。':'この種類・形態・アイテムの位置・大きさを保存しました。'):'保存できませんでした。ブラウザの保存設定や空き容量を確認してください。');
  }
  function resize(percent) {
    const id=st.equip[selected];if(!id)return;
    const a=placement.get(st.type,st.stage,id),standard=placement.defaultAnchor(st.type,st.stage,id);
    placement.preview(st.type,st.stage,id,{x:a.x,y:a.y,s:standard.s*Math.max(25,Math.min(250,percent))/100});
    drawPet();positionStatus($('admPosition').textContent+'（未保存）');
  }
  function move(id,x,y) {
    placement.preview(st.type,st.stage,id,{x:Math.max(-20,Math.min(220,x)),y:Math.max(-20,Math.min(220,y))});
    drawPet();
    positionStatus($('admPosition').textContent+'（未保存）');
  }
  function bindDrag() {
    const face=$('admFace');
    face.onpointerdown=e=>{
      if(drag||e.button!==0)return;
      const item=e.target.closest('[data-item]'),id=item?.dataset.item;
      if(!item||!id)return;
      const slot=['head','acc'].find(s=>st.equip[s]===id);if(!slot)return;
      e.preventDefault();
      if(selected!==slot)placement.cancel();selected=slot;
      const matrix=item.parentElement.getScreenCTM().inverse();
      const start=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
      drag={id,pointer:e.pointerId,matrix,start,anchor:placement.get(st.type,st.stage,id)};
      face.setPointerCapture(e.pointerId);drawPet();
    };
    face.onpointermove=e=>{
      if(!drag||drag.pointer!==e.pointerId)return;
      const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.matrix);
      move(drag.id,drag.anchor.x+p.x-drag.start.x,drag.anchor.y+p.y-drag.start.y);
    };
    face.onpointerup=e=>{if(drag?.pointer===e.pointerId){drag=null;if(face.hasPointerCapture(e.pointerId))face.releasePointerCapture(e.pointerId);}};
    face.onpointercancel=()=>{drag=null;placement.cancel();drawPet();};
    face.onlostpointercapture=()=>{drag=null;};
  }

  // えらびなおす たびに 作りなおす（パーツの 画像は 保存ずみ なので かるい）
  function drawPet() {
    if (rig) { BCT.petRig.destroy(rig); rig = null; }
    const face = $("admFace"), stage = $("admStage");
    const opts = { type: st.type, stage: st.stage, equip: Object.assign({}, st.equip) };
    // 正面の絵（パーツが 読めない ときも これを 見せる）
    face.innerHTML = `<div class="adm-front rig-front">${BCT.art.render(Object.assign({}, opts, editing?{motion:false,pose:'normal',face:'normal'}:st.view === "front" ? { pose: st.pose, face: st.face } : {}))}</div>`;
    if(editing){positionStatus();return;}
    if (st.view !== "rig" || !BCT.petRig) return;
    rig = BCT.petRig.create(Object.assign({}, opts, { host: face, track: stage, owner: stage }));
    if (!rig) return;
    BCT.petRig.setActive(rig, true);
    BCT.petRig.setManualSpeed(rig, st.swim ? BCT.PET_RIG.common.speedRef : 0);
  }

  BCT.admin = { state: () => JSON.parse(JSON.stringify(st)) };
  BCT.screens.admin = {
    show: render,
    hide() { placement.cancel();drag=null;editing=false;if (rig) { BCT.petRig.destroy(rig); rig = null; } },
  };
})();
