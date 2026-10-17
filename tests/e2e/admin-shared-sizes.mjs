import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launch,sleep} from './cdp.mjs';
const b=await launch({port:19100+Math.floor(Math.random()*300),width:900,height:1020,mobile:false});
const base=process.env.BCT_URL||'http://127.0.0.1:8766/',out=path.resolve('tests/e2e/out');
fs.mkdirSync(out,{recursive:true});
try{
  await b.goto(base);await b.ev(`BCT.game.choosePet('dolphin','非公開名','非公開隊',1);BCT.ui.show('admin')`);
  const game=await b.ev(`localStorage.getItem('bct-state')`);
  await b.ev(`document.getElementById('admHomeItem').value='home_shika_bench';document.getElementById('admHomeItem').dispatchEvent(new Event('change'));document.getElementById('admHomeScale').value=165;document.getElementById('admHomeScale').dispatchEvent(new Event('input'))`);
  assert.equal(await b.ev(`BCT.habitatSizing.download()`),false,'unsaved changes block export');
  await b.ev(`document.getElementById('admHomeSave').click()`);
  assert.equal(await b.ev(`BCT.habitatSizing.exportData().sizes['dolphin/home_shika_bench']`),1.65);
  const dir=fs.mkdtempSync(path.join(out,'size-export-'));
  await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
  await b.ev(`document.getElementById('admHomeExport').click()`);
  const file=path.join(dir,'clean-quest-habitat-sizes.json');
  for(let i=0;i<40&&!fs.existsSync(file);i++)await sleep(100);
  const text=fs.readFileSync(file,'utf8'),data=JSON.parse(text);
  assert.equal(data.sizes['dolphin/home_shika_bench'],1.65);assert.equal(data.baseRevision,await b.ev(`BCT.HABITAT_SIZE_DEFAULTS.revision`));
  assert.ok(!text.includes('非公開'));assert.equal(await b.ev(`localStorage.getItem('bct-state')`),game);
  assert.match(await b.ev(`document.getElementById('admHomeExportStatus').textContent`),/GitHub/);
  await b.ev(`document.getElementById('admHomeExport').scrollIntoView({block:'center'})`);await b.shot(path.join(out,'admin-size-export.png'));
  // All nine forms, still and moving, use the same occlusion for both new accessories.
  for(const acc of ['accessory_scarf','reward_guardian_medal']){
    await b.goto(base);await b.ev(`BCT.ui.show('settings');document.body.innerHTML='<main id="gallery" style="padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#edf8f3"></main>';window.testRigs=[];`);
    const results=await b.ev(`(async()=>{const result=[];for(const type of BCT.pets.TYPE_KEYS)for(const stage of [1,2,3]){
      const host=document.createElement('section');host.style.cssText='height:260px;position:relative';host.innerHTML='<div class="rig-front">'+BCT.art.render({type,stage,equip:{acc:'${acc}'},motion:false})+'</div>';document.getElementById('gallery').append(host);
      const masked=!!host.querySelector('[mask] [data-item="${acc}"]');const rig=BCT.petRig.create({type,stage,equip:{acc:'${acc}'},host});await rig.ready;BCT.petRig.setActive(rig,true);testRigs.push(rig);result.push(masked&&!!rig.parts.root.querySelector('[data-item="${acc}"] img')?.src.startsWith('data:image/svg+xml'));}return result;})()`);
    assert.ok(results.length===9&&results.every(Boolean));await sleep(500);
    assert.equal(await b.ev(`[...document.querySelectorAll('.pr-equip img')].every(i=>i.complete&&i.naturalWidth>0)`),true);
    await b.shot(path.join(out,acc+'-layering.png'));
    await b.ev(`testRigs.forEach(r=>BCT.petRig.destroy(r))`);
  }
  assert.deepEqual(b.consoleLogs.filter(s=>/^(EXCEPTION|error:)/.test(s)),[]);
  console.log('PASS: administrator export/download, saved-only data, privacy, unchanged game state; scarf/medal layering in all nine forms.');
}finally{b.close();}
