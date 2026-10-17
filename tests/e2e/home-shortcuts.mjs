import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const b=await launch({port:12119,width:390,height:844});
const out='tests/e2e/out';fs.mkdirSync(out,{recursive:true});
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
async function tap(selector){
  await b.ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});true`);
  const p=await b.ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
  await sleep(150);
}
try{
  await b.goto(base);
  await b.ev(`BCT.game.choosePet('dolphin','テスト','たんけんたい',1);BCT.ui.show('home');true`);
  for(const [width,height] of [[390,844],[320,568]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
    await b.ev(`BCT.store.transact(s=>{s.beach.dirt=[{id:'dock-test',kind:'b_bottle',x:.1,y:.95}];s.beach.last=Date.now();});BCT.beach.render();true`);
    await sleep(900);
    assert.ok(await b.ev(`(()=>{const p=document.querySelector('#pond').getBoundingClientRect(),d=document.querySelector('#pondShortcuts').getBoundingClientRect(),f=document.querySelector('#actFairy').getBoundingClientRect(),h=document.querySelector('#actHabitat').getBoundingClientRect(),t=document.querySelector('[data-trash]').getBoundingClientRect(),area=document.querySelector('#petPlayArea').getBoundingClientRect();return d.left>=p.left&&d.top>=p.top&&d.top<p.top+20&&f.right<h.left&&f.width>h.width&&t.top>d.bottom&&area.top>d.bottom+10&&document.documentElement.scrollWidth<=innerWidth;})()`),'top-left placement and separate pet/litter area');
    await b.shot(`${out}/home-shortcuts-${width}-dirty.png`);
    await tap('#actFairy');
    assert.equal(await b.ev(`BCT.ui.current()`),'me');
    await tap('.tabs [data-go="home"]');await sleep(100);
    await tap('#actHabitat');
    assert.equal(await b.ev(`BCT.ui.current()`),'habitat');
    await tap('.tabs [data-go="home"]');await sleep(900);
    await tap('[data-trash="dock-test"]');
    await tap('[data-bin="plastic"]');await sleep(1800);
    await b.ev(`BCT.ui.closeModal();true`);
    assert.equal(await b.ev(`BCT.store.get().beach.dirt.length`),0,'litter can still be sorted');
    await b.ev(`scrollTo(0,0);true`);await b.shot(`${out}/home-shortcuts-${width}-clean.png`);
  }
  assert.equal(await b.ev(`document.querySelectorAll('.tabs button').length`),4);
  assert.equal(await b.ev(`document.querySelectorAll('#scr-home .actions [data-go="habitat"]').length`),0);
  for(const type of ['dolphin','turtle','hermit']){
    for(const [stage,level] of [[1,1],[2,3],[3,5]]){
      await b.ev(`BCT.store.transact(s=>{s.pet.type='${type}';s.food={drop_blue:{bought:100,fed:100,spent:0,xp:BCT.CONFIG.levels[${level-1}]}};s.seenLv=${level};});BCT.ui.show('home');true`);
      await sleep(100);
      assert.equal(await b.ev(`document.querySelector('#fairyPortrait svg[data-pet]').dataset.pet`),type);
      assert.equal(await b.ev(`document.querySelector('#fairyPortrait svg[data-pet]').dataset.stage`),String(stage));
      assert.ok(await b.ev(`document.querySelector('#habitatPortrait image').getAttribute('href')===BCT.HABITAT_SPRITES.habitat_${type}.src`));
      // Both translation and all reaction layers are inside the area below the shortcuts.
      for(const effect of ['joy','eat','special','playing']){
        await b.ev(`document.querySelector('#pet').classList.add('${effect}','close');true`);
        await sleep(70);
        assert.ok(await b.ev(`(()=>{const a=document.querySelector('#petPlayArea'),r=a.getBoundingClientRect(),d=document.querySelector('#pondShortcuts').getBoundingClientRect();return r.top>d.bottom+10&&getComputedStyle(a).overflow==='hidden'&&a.contains(document.querySelector('#pet .float'));})()`));
        await b.ev(`document.querySelector('#pet').classList.remove('${effect}','close');true`);
      }
    }
  }
  for(let i=0;i<80&&!await b.ev(`!!navigator.serviceWorker.controller`);i++)await sleep(150);
  await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert.ok(await b.ev(`(async()=>{for(const type of ['dolphin','turtle','hermit']){const im=new Image();im.src='assets/habitats/habitat_'+type+'.webp';await im.decode();if(!im.naturalWidth)return false;}return true;})()`),'all three habitats work offline');
  const errors=b.consoleLogs.filter(x=>x.startsWith('EXCEPTION'));
  assert.deepEqual(errors,[]);
  console.log('Home shortcuts: responsive placement, both destinations, sorting, three species/stages, animation containment and offline habitats passed.');
}finally{b.close();}
