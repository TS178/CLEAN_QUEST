/* Roster navigation, circular portraits and independent home swimmers. */
(function(){
  const B=window.BCT,{$,ui,game}=B;
  const swimmers=new Map();let timer=null,key='',iconKey='',uid=0;
  const FACE={dolphin:[[119,97,86],[133,90,77],[147,95,68]],turtle:[[141,100,65],[152,84,58],[159,71,52]],hermit:[[145,123,68],[142,111,58],[131,117,56]]};
  function faceSvg(s){
    const stage=game.stage(s),[x,y,d]=FACE[s.pet.type][stage-1],scale=[0,.82,.93,1][stage];
    const cx=100+(x-100)*scale,cy=174+(y-174)*scale,side=d*scale*1.4;
    return B.art.render({type:s.pet.type,stage,equip:s.equip,motion:false}).replace('viewBox="0 0 200 200"',`viewBox="${cx-side/2} ${cy-side/2} ${side} ${side}"`);
  }
  function circle(list,habitat){
    const n=list.length,id='roster'+(++uid);
    const sectors=list.map((s,i)=>{
      const a=-Math.PI/2+i*2*Math.PI/n,b=a+2*Math.PI/n,m=(a+b)/2;
      const point=t=>`${50+50*Math.cos(t)} ${50+50*Math.sin(t)}`;
      const path=n===1?'M50 0A50 50 0 1 1 49.99 0Z':`M50 50L${point(a)}A50 50 0 ${n===1?1:0} 1 ${point(b)}Z`;
      const r=n===1?46:n===2?23:21,dist=n===1?0:n===2?24:27;
      const cx=50+dist*Math.cos(m),cy=50+dist*Math.sin(m),clip=id+i;
      const content=habitat?`<image href="${B.HABITAT_SPRITES['habitat_'+s.pet.type].src}" x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" preserveAspectRatio="xMidYMid slice"/>`:faceSvg(s).replace('<svg ',`<svg x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" `);
      return `<defs><clipPath id="${clip}"><path d="${path}"/></clipPath></defs><g data-companion="${s.pet.type}" clip-path="url(#${clip})"><path d="${path}" fill="${['#e2f8f0','#e9f5ff','#fff0d8'][i]}"/>${content}<path d="${path}" fill="transparent" stroke="white" stroke-width="2"/></g>`;
    }).join('');
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${sectors}</svg>`;
  }
  function choose(type,screen){
    if(B.home?.isBusy()||B.beach?.isFeeding()){ui.toast('おわるまで まってね');return false;}
    const r=game.selectCompanion(type);if(!r.ok){ui.toast('保存できませんでした。もう一度ためしてください。');return false;}
    // Hide first to cancel old pet timers even when staying on the same screen.
    B.screens[ui.current()]?.hide?.();ui.show(screen||ui.current());ui.refreshHeader();return true;
  }
  function picker(host,screen){
    const s=B.store.get(),list=game.companionStates(s);
    host.innerHTML=`<div class="companion-picker" aria-label="おせわする相棒">${list.map(p=>`<button class="companion-choice ${p.pet.type===s.pet.type?'on':''}" data-select-companion="${p.pet.type}" aria-pressed="${p.pet.type===s.pet.type}"><span>${faceSvg(p)}</span>${ui.esc(p.pet.name)}<small>第${game.stage(p)}形態</small></button>`).join('')}</div>
      ${game.canAdopt(s)?'<button class="btn mint block" data-adopt-companion>あたらしい 相棒を むかえる</button>':list.length<3?'<p class="note">第3形態まで そだてると、つぎの相棒を むかえられるよ。</p>':''}`;
    host.querySelectorAll('[data-select-companion]').forEach(el=>el.onclick=()=>choose(el.dataset.selectCompanion,screen));
    host.querySelector('[data-adopt-companion]')?.addEventListener('click',adopt);
  }
  function icons(s){
    const list=game.companionStates(s),k=JSON.stringify(list.map(p=>[p.pet,game.stage(p),p.equip,B.equipmentPlacement.revision]));
    if(k!==iconKey){iconKey=k;$('fairyPortrait').innerHTML=circle(list,false);$('habitatPortrait').innerHTML=circle(list,true);}
    $('actFairy').setAttribute('aria-label','相棒のようせいを えらぶ');$('actHabitat').setAttribute('aria-label','相棒のすみかを えらぶ');
    let button=$('homeAdopt');if(!button){button=document.createElement('button');button.id='homeAdopt';button.className='btn small mint';button.textContent='＋ 相棒を むかえる';button.onclick=adopt;$('pond').append(button);}button.hidden=!game.canAdopt(s);
  }
  function adopt(){if(B.home?.isBusy()||B.beach?.isFeeding())return ui.toast('おわるまで まってね');ui.show('egg');}
  for(const [id,screen] of [['actFairy','me'],['actHabitat','habitat']]){
    $(id).addEventListener('click',async e=>{
      e.stopImmediatePropagation();
      const type=e.target.closest('[data-companion]')?.dataset.companion,list=game.companionStates(B.store.get());
      if(type||list.length===1){choose(type||list[0].pet.type,screen);return;}
      const t=await ui.modal('<h3>どの相棒にする？</h3>',list.map(p=>({label:p.pet.name,cls:'sea',value:p.pet.type})));if(t)choose(t,screen);
    },true);
  }
  function bounds(type){
    const list=game.companionStates(B.store.get()),i=list.findIndex(p=>p.pet.type===type),area=$('petPlayArea');
    if(list.length<2)return null;
    const lane=area.clientWidth/list.length,size=Math.min(140,lane*.68,area.clientHeight*.65);
    return {minX:lane*i+size/2+3,maxX:lane*(i+1)-size/2-3,y:Math.max(size/2+16,Math.min(area.clientHeight-size/2-12,area.clientHeight*(type==='hermit'?.72:.52))),size};
  }
  // Small shared lanes need a full stride and an immediate turn at the edge.
  // The single-pet wanderer's 30-second turn delay leaves these lanes almost stationary.
  function nextPosition(x,b,left){
    const span=Math.max(0,b.maxX-b.minX),now=Math.max(b.minX,Math.min(b.maxX,x));
    const ahead=left?now-b.minX:b.maxX-now;
    if(ahead<.5)left=!left;
    return {x:Math.max(b.minX,Math.min(b.maxX,now+(left?-1:1)*span*.5)),left};
  }
  function step(){
    if(document.hidden||ui.current()!=='home')return;
    for(const [type,o] of swimmers){const b=bounds(type);if(!b)continue;
      o.el.style.setProperty('--pet-size',b.size+'px');
      const now=Math.max(b.minX,Math.min(b.maxX,parseFloat(o.el.style.left)||b.minX));
      const next=nextPosition(now,b,o.el.classList.contains('left'));
      o.el.classList.toggle('left',next.left);
      o.el.style.left=next.x+'px';o.el.style.top=b.y+Math.sin(Date.now()/6000+o.index)*5+'px';
      B.petRig.setActive(o.rig,true);
    }
  }
  function stop(){clearInterval(timer);timer=null;for(const o of swimmers.values()){B.petRig.destroy(o.rig);o.el.remove();}swimmers.clear();key='';}
  function render(s){
    icons(s);const list=game.companionStates(s),k=JSON.stringify([s.pet.type,list.map(p=>[p.pet,game.stage(p),p.equip]),B.equipmentPlacement.revision]);
    $('scr-home').classList.toggle('has-companions',list.length>1);
    if(k!==key){stop();key=k;
      list.forEach((p,index)=>{if(p.pet.type===s.pet.type)return;
        const el=document.createElement('div');el.className='pet companion-swimmer';el.dataset.type=p.pet.type;el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',p.pet.name+'を おせわする');
        el.innerHTML=`<div class="float"><div class="facing"><div class="body rig-front">${B.pets.renderState(p)}</div></div></div><span class="companion-name">${ui.esc(p.pet.name)}</span>`;
        el.style.transition='none';$('petPlayArea').append(el);const b=bounds(p.pet.type);el.style.left=(b.minX+b.maxX)/2+'px';el.style.top=b.y+'px';el.style.setProperty('--pet-size',b.size+'px');void el.offsetWidth;el.style.removeProperty('transition');
        const rig=B.petRig.create({type:p.pet.type,stage:game.stage(p),equip:p.equip,host:el.querySelector('.facing'),track:el,owner:el});
        el.onclick=()=>choose(p.pet.type,'home');el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(p.pet.type,'home');}};
        swimmers.set(p.pet.type,{el,rig,index});if(rig)B.petRig.setManualSpeed(rig,B.PET_RIG.common.speedRef*.45);B.petRig.prefetch(p.pet.type);
      });step();if(swimmers.size)timer=setInterval(step,3600);
    }
  }
  document.addEventListener('visibilitychange',()=>{for(const o of swimmers.values())B.petRig.setActive(o.rig,!document.hidden&&ui.current()==='home');if(!document.hidden)step();});
  window.addEventListener('resize',step);
  if(window.ResizeObserver)new ResizeObserver(step).observe($('petPlayArea'));
  B.companionUI={render,stop,bounds,nextPosition,picker,choose,faceSvg,targets:()=>[...document.querySelectorAll('#petPlayArea > .pet')].map(el=>({type:el.dataset.type,el,r:el.getBoundingClientRect(),pet:true}))};
})();
