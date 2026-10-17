// Approved Shika art: real purchase controls, habitat persistence, wearables and offline export.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch, sleep} from './cdp.mjs';
const base = process.env.BCT_URL || 'http://127.0.0.1:8766/';
const out = 'tests/e2e/out';
fs.mkdirSync(out, {recursive:true});
const b = await launch({port:14000 + Math.floor(Math.random()*800),width:390,height:900});
const ids = ['accessory_pendant','head_flower','accessory_korogaki','home_shika_lighthouse','home_shika_bench','home_shika_ganmon'];
const modal = async text => {
  assert.equal(await b.ev(`(() => { const el=[...document.querySelectorAll('#modalBox button')].find(e=>e.textContent.includes(${JSON.stringify(text)})); if(!el || el.disabled) return false; el.click(); return true; })()`),true,text);
  await sleep(180);
};
try {
  await b.goto(base);
  await b.ev(`BCT.game.choosePet('dolphin','テスト','たい',0); BCT.game.claim('quiz','shika-test',{xp:0,coins:1000});`);
  await b.goto(base);
  for(const id of ids) {
    await b.ev(`BCT.ui.show('shop',BCT.itemOf('${id}').slot); document.querySelector('#shopBody [data-item="${id}"]').click();`);
    const before=await b.ev('BCT.game.coins(BCT.store.get())');
    await modal('かう');
    assert.equal(await b.ev(`BCT.game.coins(BCT.store.get())`),before-await b.ev(`BCT.itemOf('${id}').price`));
    await modal(id.startsWith('home_')?'すみかに おく':'いま つける');
    if(id.startsWith('home_')) {
      assert.equal(await b.ev(`!!document.querySelector('#hbItems [data-art-id="${id}"]')`),true,id);
    } else assert.equal(await b.ev(`BCT.store.get().equip[BCT.itemOf('${id}').slot]`),id);
  }
  console.log('OK six shop purchases, equip and place controls');
  await b.ev(`BCT.ui.show('shop','home')`);
  assert.equal(await b.ev(`document.querySelectorAll('#shopBody .shop-item').length`),6);
  await b.shot(out+'/shika-shop.png');
  await b.ev(`['home_shika_lighthouse','home_shika_bench','home_shika_ganmon'].forEach((id,i)=>BCT.game.placeHome(id,[.2,.5,.8][i],[.63,.8,.6][i])); BCT.ui.show('habitat');`);
  const saved=await b.ev(`JSON.stringify(BCT.store.get().habitat)`);
  await b.shot(out+'/shika-habitat.png');
  await b.goto(base);
  assert.equal(await b.ev(`JSON.stringify(BCT.store.get().habitat)`),saved);
  for(const type of ['turtle','hermit','dolphin']) {
    await b.ev(`BCT.game.choosePet('${type}','テスト','たい',0); BCT.ui.show('habitat');`);
    assert.equal(await b.ev(`document.querySelectorAll('#hbItems [data-art-id^="home_shika_"]').length`),3);
    assert.equal(await b.ev(`JSON.stringify(BCT.store.get().habitat)`),saved);
  }
  await b.ev(`document.querySelector('#hbTray [data-hb-toggle="home_shika_bench"]').click()`);
  assert.equal(await b.ev(`!!BCT.store.get().habitat.home_shika_bench`),false);
  await b.ev(`document.querySelector('#hbTray [data-hb-toggle="home_shika_bench"]').click()`);
  assert.equal(await b.ev(`!!BCT.store.get().habitat.home_shika_bench`),true);
  console.log('OK shared decorations persist and work in all three habitats');

  // Dedicated contact sheet: 3 accessories × 3 species × 3 stages, using actual app rendering.
  await b.send('Emulation.setDeviceMetricsOverride',{width:1080,height:900,deviceScaleFactor:1,mobile:false});
  await b.ev(`BCT.ui.show('mission'); window.sheet=document.createElement('div'); sheet.id='shika-test-sheet'; sheet.style.cssText='position:fixed;inset:0;background:#fff8ed;z-index:9999;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(9,1fr);gap:4px'; document.body.append(sheet);`);
  const exports=await b.ev(`(async()=>{
    let count=0;
    for(const id of ['accessory_pendant','head_flower','accessory_korogaki']) for(const type of ['dolphin','turtle','hermit']) for(const stage of [1,2,3]) {
      const equip={[BCT.itemOf(id).slot]:id};
      const svg=BCT.art.render({type,stage,equip,motion:false});
      if(!svg.includes('data-sprite="'+id+'"')) throw Error('Missing equipped sprite '+id);
      const im=await BCT.art.toImage(svg), c=document.createElement('canvas'); c.width=c.height=200;
      const g=c.getContext('2d');g.drawImage(im,0,0,200,200); if(c.toDataURL().length<1000) throw Error('Empty export');
      const tile=document.createElement('div');tile.innerHTML='<small>'+type+' '+stage+'</small>'+svg;
      tile.querySelector('svg').style.cssText='width:100%;height:180px'; sheet.append(tile);count++;
    }
    return count;
  })()`);
  assert.equal(exports,27);
  await b.shot(out+'/shika-wearables.png');
  await b.ev(`sheet.remove(); window.rigSheet=document.createElement('div'); rigSheet.style.cssText='position:fixed;inset:0;background:#fff8ed;z-index:9999;display:grid;grid-template-columns:repeat(3,1fr)'; document.body.append(rigSheet); window.testRigs=[];`);
  for(const type of ['dolphin','turtle','hermit']) for(const stage of [1,2,3]) {
    assert.equal(await b.ev(`(async()=>{const host=document.createElement('div');host.style.cssText='position:relative;width:220px;height:220px';rigSheet.append(host);const rig=BCT.petRig.create({type:'${type}',stage:${stage},equip:{acc:'accessory_korogaki',head:'head_flower'},host,track:host,owner:host});testRigs.push(rig);await rig.ready;BCT.petRig.setActive(rig,true);return [...host.querySelectorAll('img')].some(im=>im.src===BCT.PET_SPRITES.accessory_korogaki.src)&&[...host.querySelectorAll('img')].every(im=>im.complete&&im.naturalWidth>0);})()`),true,`${type}-${stage} rig`);
  }
  await sleep(250);
  await b.shot(out+'/shika-moving-wearables.png');
  console.log('OK 27 static wearable exports and 9 moving forms');
  await b.goto(base);
  await b.ev(`navigator.serviceWorker.ready`);
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base);
  assert.equal(await b.ev(`BCT.ITEMS.length`),40);
  for(const id of ids) assert.equal(await b.ev(`(async()=>{const svg=BCT.art.itemIcon('${id}');const im=await BCT.art.toImage(svg);return im.naturalWidth>0;})()`),true,'offline '+id);
  await b.ev(`BCT.ui.show('habitat')`);
  assert.equal(await b.ev(`document.querySelectorAll('#hbItems [data-art-id^="home_shika_"]').length`),3);
  const errors=b.consoleLogs.filter(x=>/^(error|EXCEPTION)/.test(x));
  assert.deepEqual(errors,[]);
  console.log('OK offline reload / all six exports / no console errors');
} finally { b.close(); }
