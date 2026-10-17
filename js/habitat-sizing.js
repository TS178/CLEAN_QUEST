/* Published defaults + local administrator adjustments. Player positions stay in the game save. */
(function(){
  const B=window.BCT,KEY='bct-habitat-sizes-v1';let saved={},draft=null;
  const schema=B.habitatSizeSchema,published=B.HABITAT_SIZE_DEFAULTS||{revision:0,sizes:{}},defaults=schema.clean(published.sizes);
  const valid=(t,id,n)=>schema.validKey(`${t}/${id}`,n);
  function read(){try{
    const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(raw&&Object.hasOwn(raw,'baseRevision'))return raw.baseRevision===published.revision?schema.clean(raw.sizes):{};
    // 1.26 had an unversioned map. Keep it until the first shared settings release.
    return published.revision===0?schema.clean(raw):{};
  }catch{return {};}}
  saved=read();
  B.habitatSizing={
    get(t,id){return draft?.key===`${t}/${id}`?draft.scale:saved[`${t}/${id}`]??defaults[`${t}/${id}`]??1;},
    preview(t,id,n){if(valid(t,id,n))draft={key:`${t}/${id}`,scale:n};},cancel(){draft=null;},
    save(t,id,reset=false){const key=`${t}/${id}`,n=reset?(defaults[key]??1):this.get(t,id);if(!valid(t,id,n))return false;const next={...read(),[key]:n};try{localStorage.setItem(KEY,JSON.stringify({baseRevision:published.revision,sizes:next}));saved=next;draft=null;return true;}catch{return false;}},
    exportData(){
      const sizes={...defaults,...read()};
      return schema.validate({format:'clean-quest-habitat-sizes',version:1,baseRevision:published.revision,sizes});
    },
    download(){
      if(draft){B.ui.toast('先に大きさを保存するか、変更を戻してください。');return false;}
      const data=this.exportData(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='clean-quest-habitat-sizes.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
      return true;
    },
    editor(host,type){
      this.cancel();const items=B.ITEMS.filter(it=>it.slot==='home'&&(!it.only||it.only===type));
      host.innerHTML=`<h4>すみかのアイテムの大きさ</h4><p class="note">${B.ui.esc(B.HABITATS[type])}用。まずこの端末で調整・保存します。全端末への反映は、下の「配布用設定を書き出す」から行います。</p><select id="admHomeItem" aria-label="すみかのアイテム">${items.map(it=>`<option value="${it.id}">${B.ui.esc(it.name)}</option>`).join('')}</select>
        <div class="adm-home-scene"><div class="adm-home-bg">${B.homeArt.habitatBg(type)}</div><div id="admHomeArt"></div></div>
        <label for="admHomeScale">大きさ <output id="admHomeValue">100%</output></label><input id="admHomeScale" type="range" min="25" max="250" value="100" aria-label="すみかアイテムの大きさ">
        <div class="adm-row"><button class="btn small sea" id="admHomeSave">大きさを保存</button><button class="btn small ghost" id="admHomeCancel">変更を戻す</button><button class="btn small ghost" id="admHomeReset">配布中の標準に戻す</button></div><p class="note" id="admHomeStatus" role="status"></p>
        <hr><button class="btn sea block" id="admHomeExport">配布用設定を書き出す</button><p class="note">3種類すべての保存済みサイズをまとめます。書き出したファイルを開発担当へ渡し、GitHubに反映したアプリへ更新すると、ほかの端末にも同じサイズが届きます。育成データや名前は含みません。</p><p class="note" id="admHomeExportStatus" role="status"></p>`;
      const $=id=>host.querySelector('#'+id),id=()=>$('admHomeItem').value;
      const draw=()=>{const n=this.get(type,id());$('admHomeScale').value=Math.round(n*100);$('admHomeValue').textContent=Math.round(n*100)+'%';$('admHomeArt').style.width=24*n+'%';$('admHomeArt').innerHTML=B.homeArt.homeItemSvg(id());};
      $('admHomeItem').onchange=()=>{this.cancel();draw();$('admHomeStatus').textContent='';};
      $('admHomeScale').oninput=e=>{this.preview(type,id(),Number(e.target.value)/100);draw();$('admHomeStatus').textContent='未保存';};
      const save=reset=>{const ok=this.save(type,id(),reset);draw();$('admHomeStatus').textContent=ok?'大きさを保存しました。':'保存できませんでした。もう一度ためしてください。';};
      $('admHomeSave').onclick=()=>save(false);$('admHomeReset').onclick=()=>save(true);$('admHomeCancel').onclick=()=>{this.cancel();draw();$('admHomeStatus').textContent='変更を戻しました。';};draw();
      $('admHomeExport').onclick=()=>{if(this.download())$('admHomeExportStatus').textContent='配布用ファイルを書き出しました。全端末への反映にはGitHubへの取り込みとアプリの更新が必要です。';};
    }
  };
  window.addEventListener('storage',e=>{if(e.key===KEY){saved=read();draft=null;}});
})();
