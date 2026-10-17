/* Device-local furniture sizes; player positions stay in the game save. */
(function(){
  const B=window.BCT,KEY='bct-habitat-sizes-v1';let saved={},draft=null;
  const valid=(t,id,n)=>['dolphin','turtle','hermit'].includes(t)&&B.itemOf(id)?.slot==='home'&&(!B.itemOf(id).only||B.itemOf(id).only===t)&&Number.isFinite(n)&&n>=.25&&n<=2.5;
  function read(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}'),out={};for(const [k,n] of Object.entries(raw||{})){const [t,id]=k.split('/');if(valid(t,id,n))out[k]=n;}return out;}catch{return {};}}
  saved=read();
  B.habitatSizing={
    get(t,id){return draft?.key===`${t}/${id}`?draft.scale:saved[`${t}/${id}`]||1;},
    preview(t,id,n){if(valid(t,id,n))draft={key:`${t}/${id}`,scale:n};},cancel(){draft=null;},
    save(t,id,reset=false){const key=`${t}/${id}`,n=reset?1:this.get(t,id);if(!valid(t,id,n))return false;const next={...read(),[key]:n};try{localStorage.setItem(KEY,JSON.stringify(next));saved=next;draft=null;return true;}catch{return false;}},
    editor(host,type){
      this.cancel();const items=B.ITEMS.filter(it=>it.slot==='home'&&(!it.only||it.only===type));
      host.innerHTML=`<h4>すみかのアイテムの大きさ</h4><p class="note">${B.ui.esc(B.HABITATS[type])}用。アイテムごとに、この端末へ保存します。</p><select id="admHomeItem" aria-label="すみかのアイテム">${items.map(it=>`<option value="${it.id}">${B.ui.esc(it.name)}</option>`).join('')}</select>
        <div class="adm-home-scene"><div class="adm-home-bg">${B.homeArt.habitatBg(type)}</div><div id="admHomeArt"></div></div>
        <label for="admHomeScale">大きさ <output id="admHomeValue">100%</output></label><input id="admHomeScale" type="range" min="25" max="250" value="100" aria-label="すみかアイテムの大きさ">
        <div class="adm-row"><button class="btn small sea" id="admHomeSave">大きさを保存</button><button class="btn small ghost" id="admHomeCancel">変更を戻す</button><button class="btn small ghost" id="admHomeReset">標準に戻して保存</button></div><p class="note" id="admHomeStatus" role="status"></p>`;
      const $=id=>host.querySelector('#'+id),id=()=>$('admHomeItem').value;
      const draw=()=>{const n=this.get(type,id());$('admHomeScale').value=Math.round(n*100);$('admHomeValue').textContent=Math.round(n*100)+'%';$('admHomeArt').style.width=24*n+'%';$('admHomeArt').innerHTML=B.homeArt.homeItemSvg(id());};
      $('admHomeItem').onchange=()=>{this.cancel();draw();$('admHomeStatus').textContent='';};
      $('admHomeScale').oninput=e=>{this.preview(type,id(),Number(e.target.value)/100);draw();$('admHomeStatus').textContent='未保存';};
      const save=reset=>{const ok=this.save(type,id(),reset);draw();$('admHomeStatus').textContent=ok?'大きさを保存しました。':'保存できませんでした。もう一度ためしてください。';};
      $('admHomeSave').onclick=()=>save(false);$('admHomeReset').onclick=()=>save(true);$('admHomeCancel').onclick=()=>{this.cancel();draw();$('admHomeStatus').textContent='変更を戻しました。';};draw();
    }
  };
  window.addEventListener('storage',e=>{if(e.key===KEY){saved=read();draft=null;}});
})();
