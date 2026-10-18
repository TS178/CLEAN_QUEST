import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const b=await launch({port:18800+Math.floor(Math.random()*100),width:390,height:844});
fs.mkdirSync('tests/e2e/out',{recursive:true});
const ev=b.ev;
async function tap(sel){
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
try{
  await b.goto(base);
  await ev(`BCT.game.choosePet('dolphin','いるか','確認隊',1);BCT.ui.show('home')`);
  assert.equal(await ev(`document.querySelectorAll('[data-treasure]').length`),0);
  // Real pointer events sort the initial trash into its matching bin.
  for(let i=0;i<3;i++){
    const bin=await ev(`BCT.beachTrashOf(BCT.store.get().beach.dirt[0].kind).bin`);
    await tap('[data-trash]');await tap(`[data-bin="${bin}"]`);await sleep(450);
  }
  await sleep(1400);
  await ev(`BCT.ui.closeModal();window.scrollTo(0,0)`);
  assert.equal(await ev(`document.querySelectorAll('[data-treasure]').length`),3);
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),15);
  assert.equal(await ev(`document.querySelector('.home-coast img').naturalWidth>0`),true);
  await b.shot('tests/e2e/out/beach-treasures-clean.png');
  for(const width of [320,390,768]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});await sleep(250);
    assert.equal(await ev(`(()=>{const p=document.getElementById('pond').getBoundingClientRect();return [...document.querySelectorAll('[data-treasure]')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=p.left&&r.right<=p.right&&r.top>p.top+p.height*.66&&r.bottom<=p.bottom})})()`),true,`${width}px: collectible targets stay on sand`);
  }
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await sleep(250);
  const id=await ev(`BCT.store.get().beach.treasures[0].id`);
  await tap('[data-treasure]');
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),20);
  assert.equal(await ev(`BCT.game.collectTreasure(${JSON.stringify(id)}).err`),'gone');
  await b.goto(base);assert.equal(await ev(`document.querySelectorAll('[data-treasure]').length`),2);
  // Keyboard activation follows the same saved transaction as touch/mouse.
  await ev(`BCT.ui.closeModal();document.querySelector('[data-treasure]').focus()`);
  assert.equal(await ev(`document.activeElement.matches('[data-treasure]')`),true,'collectible receives keyboard focus');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await sleep(100);assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),25);
  await tap('[data-treasure]');assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),30);
  await b.goto(base);assert.equal(await ev(`document.querySelectorAll('[data-treasure]').length`),0);
  assert.equal(await ev(`(async()=>{const p=await BCT.backup.build();return !BCT.backup.validate(p)&&p.state.beach.treasures.length===0&&p.state.beach.treasureCycle===1})()`),true);
  await ev(`BCT.store.transact(s=>{s.beach.last=Date.now()-BCT.CONFIG.beach.dirtEveryMin*60000-100;return {ok:true}});BCT.beach.show()`);
  assert.equal(await ev(`document.querySelectorAll('[data-trash]').length`),3);
  await ev(`for(const d of [...BCT.store.get().beach.dirt])BCT.game.sortTrash(d.id,BCT.beachTrashOf(d.kind).bin);BCT.beach.render()`);
  assert.equal(await ev(`document.querySelectorAll('[data-treasure]').length`),3);
  // Make the adoption action visible to check the revised placement beside scenery.
  await ev(`BCT.game.claim('test','unlock',{xp:1000,coins:0});BCT.game.markSeen(BCT.game.level(BCT.store.get()));BCT.home.render();window.scrollTo(0,0)`);await sleep(1200);
  await b.shot('tests/e2e/out/beach-treasures-adoption.png');
  await ev(`navigator.serviceWorker.register('service-worker.js');navigator.serviceWorker.ready`);await b.goto(base);
  await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base);
  assert.equal(await ev(`[...document.querySelectorAll('.home-coast img,.beach-treasure img')].every(i=>i.complete&&i.naturalWidth>0)`),true,'scenery and collectibles offline');
  await tap('[data-treasure]');assert.equal(await ev(`BCT.store.get().beach.treasures.length`),2,'offline collection persists');
  assert.deepEqual(b.consoleLogs.filter(x=>/EXCEPTION|error:/.test(x)),[]);
  console.log('PASS: cleanup, +5 medals, pointer and keyboard collection, reload, backup, next cleanup, mobile layout, offline assets');
}finally{b.close();}
