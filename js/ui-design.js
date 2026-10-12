/* Expedition UI: rounded enamel icons, existing painted objects and one shared medal. */
(function () {
  const BCT = window.BCT, previous = BCT.art.icon;
  let serial = 0;
  const medalImage = '<img class="ui-icon expedition-icon medal-icon" data-ui-icon="coin" src="assets/ui/medal.webp" alt="" aria-hidden="true" width="64" height="64">';
  const palettes = { aqua: ['#b9ffff','#21bfd3','#148ab8'], mint: ['#d4ffe5','#69d6b2','#359a82'], gold: ['#fff5b5','#ffc45d','#de933b'], coral: ['#ffd8c0','#fa927f','#d96968'], lilac: ['#eee0ff','#b5a0ed','#7e70bd'], cream: ['#fffef1','#f9edc9','#dfc99b'] };
  const path = (d,fill,stroke='none',width=2) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const star = (x,y,r,fill) => path(`M${x} ${y-r}Q${x+2} ${y-2} ${x+r} ${y}Q${x+2} ${y+2} ${x} ${y+r}Q${x-2} ${y+2} ${x-r} ${y}Q${x-2} ${y-2} ${x} ${y-r}Z`,fill);
  function vector(key) {
    const id=`exp${++serial}`,f=k=>`url(#${id}-${k})`;
    const defs=Object.entries(palettes).map(([k,c])=>`<linearGradient id="${id}-${k}" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${c[0]}"/><stop offset=".52" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>`).join('');
    const wave = path('M8 42q6-8 14-3t15 0q8-5 19 2v10q-11 8-24 2T8 53Z',f('aqua'),'#178daa')+path('M10 44q6-5 13-1t15 0q8-4 15 0','none','#eeffff',2.5);
    let body='';
    switch(key) {
      case 'nav-home': case 'home':
        body='<ellipse cx="32" cy="53" rx="27" ry="7" fill="#86d9d4"/>'+path('M10 52q22-17 44 0-20 9-44 0Z',f('cream'))+path('M17 28h30v23H17Z',f('cream'),'#c9b07c')+path('M10 29 30 10q2-2 4 0l20 19-4 5-18-14-18 14Z',f('coral'),'#c67561')+path('M27 51V38a5 5 0 0 1 10 0v13',f('mint'),'#529a85')+'<circle cx="24" cy="32" r="3" fill="#70cfdf"/>'+star(49,12,6,'#ffe995');break;
      case 'mission':
        body='<circle cx="32" cy="34" r="25" fill="'+f('gold')+'" stroke="#d5a044" stroke-width="2"/><circle cx="32" cy="32" r="20" fill="'+f('cream')+'" stroke="#fffdf0" stroke-width="2"/>'+path('M32 12v5m0 30v5M12 32h5m30 0h5','none','#c59e55',2.5)+path('m22 43 5-17 15-7-5 17Z',f('coral'),'#bd695c')+path('m22 43 10-11 5 4Z',f('aqua'))+'<circle cx="32" cy="32" r="3" fill="#fff6cc"/>'+path('M17 21q5-8 13-8','none','#fff8d8',3);break;
      case 'capture':
        body=path('M9 20h11l5-9h15l5 9h10q5 0 5 6v26q0 6-6 6H10q-6 0-6-6V26q0-6 3-6Z',f('mint'),'#429c90')+path('M11 23h10l5-8h12','none','#edfff1',3)+'<circle cx="33" cy="38" r="16" fill="'+f('gold')+'" stroke="#d6ab55" stroke-width="2"/><circle cx="33" cy="38" r="11" fill="'+f('aqua')+'" stroke="#208ca7" stroke-width="2"/><ellipse cx="29" cy="34" rx="4" ry="3" fill="#edffff" opacity=".9"/><rect x="47" y="25" width="8" height="5" rx="2" fill="#fff9df"/>';break;
      case 'shop':
        body=path('M10 28h44v28H10Z',f('cream'),'#cbaf87')+'<rect x="17" y="36" width="13" height="13" rx="2" fill="'+f('aqua')+'" stroke="#65b6bd"/><rect x="37" y="36" width="10" height="20" rx="3" fill="'+f('mint')+'"/>'+path('M7 15h50l5 14H2Z',f('coral'),'#cf7868')+path('m16 15-2 14h9l1-14m16 0 1 14h9l-3-14',f('cream'))+path('M2 29q5 10 10 0 5 10 10 0 5 10 10 0 5 10 10 0 5 10 10 0 5 10 10 0','none','#b86458',2)+path('M11 11h42','none','#fff0d0',3);break;
      case 'me':
        body='<rect x="11" y="7" width="43" height="52" rx="9" fill="'+f('mint')+'" stroke="#4f9a83" stroke-width="2"/>'+path('M16 12v40','none','#eaffdc',3)+'<rect x="23" y="15" width="23" height="28" rx="6" fill="'+f('cream')+'"/><circle cx="34.5" cy="26" r="6" fill="'+f('gold')+'"/>'+path('M25 39q2-9 9-9t10 9Z',f('aqua'))+path('M25 49h9','none','#eaffef',3)+star(47,49,8,f('gold'));break;
      case 'quiz':
        body=path('M5 16q12-5 27 1 15-6 27-1v38q-13-4-27 1-14-5-27-1Z',f('aqua'),'#358fa9')+path('M8 12q11-3 24 2 13-5 24-2v36q-11-3-24 2-13-5-24-2Z',f('cream'),'#c9c5a5')+path('M32 15v34','none','#d6cba7')+path('M13 22h10m-10 7h8m-8 7h9','none','#79bfc3',2.5)+path('M38 23c0-7 13-7 13 0 0 4-6 4-6 9','none','#3fa7b7',4)+'<circle cx="45" cy="39" r="2.5" fill="#3fa7b7"/>'+star(54,8,5,'#ffd56b');break;
      case 'clean':
        body=path('M9 36 22 22l18 16-14 17Z',f('aqua'),'#2699be')+path('m11 34 9 8m-5-12 9 8','none','#e2ffff',3)+path('m22 21 5-6 8 7-5 6Z',f('coral'),'#c77464')+path('M51 9q-8-5-12 3L27 44m24-35 1 34-9 10m-16-9-8 6','none','#7896a1',7)+path('M49 9q-7-3-9 5L28 43m21-32 1 30-8 10','none','#edf6f7',3)+star(12,15,7,f('gold'));break;
      case 'gift':
        body='<rect x="10" y="28" width="44" height="30" rx="5" fill="'+f('gold')+'" stroke="#d49f4d" stroke-width="2"/><rect x="6" y="21" width="52" height="13" rx="4" fill="'+f('cream')+'" stroke="#d9ba80" stroke-width="2"/>'+path('M27 22h11v35H27Z',f('coral'))+path('M32 22C-2 25 10-7 32 22c32 3 22-32 0 0Z',f('coral'),'#cc786e')+path('M27 18q-12-2-10-8m20 8q11-2 10-8','none','#ffe7da',2.5);break;
      case 'dress':
        body=path('m21 19-16 9 8 15 8-4v19h25V39l7 4 8-15-16-9q-12 12-24 0Z',f('lilac'),'#8f7bb8')+path('M27 8q1-7 7-5 8 4-2 10v4M19 20l13-7 14 7','none','#d8a354',3)+path('M22 23q10 11 21 0','none','#f9edff',2.5)+star(34,40,8,f('gold'));break;
      case 'look':
        body=path('M9 45q-8-26 12-32 18-7 31 11 12 19-14 28-13 5-17-2l-3-3Z',f('lilac'),'#9981c6')+'<circle cx="22" cy="27" r="5" fill="#7ee4d1"/><circle cx="36" cy="23" r="5" fill="#fff19a"/><circle cx="46" cy="34" r="5" fill="#ffb3a4"/>'+star(44,50,10,f('gold'));break;
      case 'found':
        body=path('m40 39 17 17','none','#c68657',10)+'<circle cx="27" cy="26" r="22" fill="'+f('gold')+'" stroke="#daa657" stroke-width="2"/><circle cx="27" cy="26" r="16" fill="#dbfaff" stroke="#82c7ce" stroke-width="2"/>'+path('m23 16 9 3-2 5 3 4-6 15-13-5 6-15 4-2Z',f('aqua'),'#349bb7')+path('M17 17q5-6 12-5','none','#fff',3);break;
      case 'sparkling':
        body=wave+star(29,23,15,f('gold'))+star(51,12,7,f('mint'))+star(11,15,5,'#ffe99c')+path('m29 14-3 8','none','#fffbe1',3);break;
      case 'dirty':
        body='<ellipse cx="32" cy="49" rx="27" ry="10" fill="'+f('cream')+'"/>'+path('M8 49q11-7 23 0t25 0','none','#c0a67b',2)+path('m13 24 13-6 9 24-14 6Z',f('aqua'),'#5fa6b7')+path('m15 28 15-6m-11 14 12-5','none','#e2ffff',3)+path('m14 19 10-4 2 6-10 4Z',f('coral'))+'<ellipse cx="43" cy="42" rx="9" ry="12" transform="rotate(22 43 42)" fill="'+f('gold')+'" stroke="#c6a46a" stroke-width="2"/>'+path('m40 35 9 3','none','#fff3c1',3);break;
      default:return null;
    }
    return `<svg class="ui-icon expedition-icon" data-ui-icon="${key}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  }
  const objectIcons={head:'head_straw',acc:'accessory_scarf',toy:'toy_ball',frame:'frame_wave'};
  const photoArrows={switch:'M10 19a14 14 0 0 1 24-8l3 4M37 6v9H28M38 29a14 14 0 0 1-24 8l-3-4M11 42v-9h9',retake:'M14 12 5 21l9 9M6 21h20a13 13 0 0 1 0 26',save:'M24 6v25M14 22l10 10 10-10M9 35v7h30v-7',back:'M24 9 9 24l15 15M10 24h30'};
  function photoArrow(key){return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${photoArrows[key]}" fill="none" stroke="#317e72" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${photoArrows[key]}" fill="none" stroke="#a8e4cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
  // 承認済みの撮影アイコン。画面の構成・クリック処理は変えず、絵を共有する。
  function cameraIcon(key){
    const start=`<span class="ui-icon expedition-icon camera-art${key==='sea'?' sea-icon':''}" data-ui-icon="${key}" aria-hidden="true">`;
    if(key==='back')return start+photoArrow('back')+'</span>';
    if(key==='location'){
      const id=`photo-pin-${++serial}`;
      return start+`<svg viewBox="0 0 64 64"><defs><linearGradient id="${id}" x2=".8" y2="1"><stop stop-color="#ffd7bd"/><stop offset=".6" stop-color="#ff9d86"/><stop offset="1" stop-color="#de765d"/></linearGradient></defs><ellipse cx="32" cy="56" rx="17" ry="5" fill="#e8d8a4"/><path d="M32 57S11 34 11 23a21 21 0 0 1 42 0C53 34 32 57 32 57Z" fill="url(#${id})" stroke="#ce8b6e" stroke-width="2"/><circle cx="32" cy="23" r="8" fill="#fff8de"/><path d="M18 18q3-9 12-10" fill="none" stroke="#fff1db" stroke-width="4" stroke-linecap="round"/></svg></span>`;
    }
    const file={play:'assets/items/toy_ball.webp',dress:'assets/ui/dress.webp',capture:'assets/ui/camera.webp',camera:'assets/ui/camera.webp',album:'assets/ui/album.webp',map:'assets/ui/map.webp',sea:'assets/ui/beach.webp',switch:'assets/ui/camera.webp',retake:'assets/ui/camera.webp',save:'assets/ui/album.webp',shutter:'assets/ui/camera.webp',background:'assets/ui/album.webp'}[key];
    if(!file)return null;
    const badge=['switch','retake','save'].includes(key)?`<span class="camera-icon-badge">${photoArrow(key)}</span>`:'';
    return start+`<img src="${file}" alt="" width="64" height="64">${badge}</span>`;
  }
  BCT.art.icon=function(key){
    const camera=cameraIcon(key);
    if(camera)return camera;
    if(key==='home'){
      const type=BCT.store?.get()?.pet?.type;
      if(BCT.pets.TYPE_KEYS.includes(type))return `<img class="ui-icon expedition-icon habitat-icon" data-ui-icon="home" src="assets/habitats/habitat_${type}.webp" alt="" aria-hidden="true" width="64" height="64">`;
    }
    if(key==='coin')return medalImage;
    let picture='';
    if(key==='food')picture=BCT.homeArt.dropSvg('drop_blue');
    if(objectIcons[key])picture=BCT.art.itemIcon(objectIcons[key]);
    if(picture)return `<span class="ui-icon expedition-icon object-icon" data-ui-icon="${key}" aria-hidden="true">${picture}</span>`;
    return vector(key)||previous(key);
  };
  BCT.medal={
    name:'たんけんたいメダル',
    amount(value,sign=''){
      const n=Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
      return `<span class="medal-amount" aria-label="たんけんたいメダル ${sign}${n}枚">${medalImage}<b>${sign}${n.toLocaleString('ja-JP')}</b></span>`;
    },
    wallet(value){return `<div class="medal-wallet">${medalImage}<div class="medal-wallet-copy"><span class="medal-wallet-label">たんけんたいメダル</span><div class="medal-wallet-value${Number(value)>=1000000?' long':''}"><b>${Number(value).toLocaleString('ja-JP')}</b><span>枚</span></div><small>いま もっている メダル</small></div></div>`;}
  };
  // Static buttons and dynamic screens share the same artwork.
  document.querySelectorAll('[data-ui-icon-slot]').forEach(el=>{el.innerHTML=BCT.art.icon(el.dataset.uiIconSlot);});
})();
