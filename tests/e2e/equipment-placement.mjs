import assert from 'node:assert/strict';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const b=await launch({port:17300+Math.floor(Math.random()*200),width:390,height:844});
const ev=b.ev,KEY='bct-equipment-placements-v1';
const click=sel=>ev(`document.querySelector(${JSON.stringify(sel.startsWith('#')?sel:'#adminBody button'+sel)}).click()`);
const anchor=()=>ev(`(()=>{const s=BCT.admin.state();return BCT.equipmentPlacement.get(s.type,s.stage,'head_flower')})()`);
try{
  await b.goto(base);
  await ev(`BCT.game.choosePet('dolphin','確認','確認',1);BCT.ui.show('admin');`);
  const state=await ev(`localStorage.getItem('bct-state')`);
  await click('[data-id="head_flower"]');await click('#admEdit');
  await ev(`document.getElementById('admFace').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}))`);
  const originals={},saved={};
  for(const type of ['dolphin','turtle','hermit'])for(const stage of [1,2,3]){
    await click(`[data-type="${type}"]`);await click(`[data-stage="${stage}"]`);
    const before=await anchor();originals[`${type}/${stage}`]=before;
    // Test real touch input, stage scaling, and reversed CSS transform.
    if(stage===2)await click('[data-left]');
    const pos=await ev(`(()=>{document.getElementById('admStage').scrollIntoView({block:'center'});
      const item=document.querySelector('#admFace [data-item="head_flower"]'),r=item.getBoundingClientRect();
      const m=item.parentElement.getScreenCTM();return {x:r.x+r.width/2,y:r.y+r.height/2,a:m.a,d:m.d};})()`);
    await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y,id:1}]});
    await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pos.x+12,y:pos.y+10,id:1}]});
    await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await anchor();
    assert.ok(Math.abs(after.x-before.x-12/pos.a)<.05,`${type}/${stage}: touch X ${JSON.stringify({before,after,pos})}`);
    assert.ok(Math.abs(after.y-before.y-10/pos.d)<.05,`${type}/${stage}: touch Y`);
    assert.equal(after.r,before.r);assert.equal(after.s,before.s);
    assert.match(await ev(`document.getElementById('admPosition').textContent`),/未保存/);
    await click('#admSave');saved[`${type}/${stage}`]=after;
    assert.match(await ev(`document.getElementById('admPosition').textContent`),/保存しました/);
    if(stage===2)await click('[data-left]');
  }
  assert.equal(Object.keys(JSON.parse(await ev(`localStorage.getItem('${KEY}')`))).length,9);
  // A second item is independent; cancel and reset affect only the selected item.
  await click('[data-id="head_straw"]');await click('[data-nudge="1,0"]');await click('#admSave');
  const straw=await ev(`BCT.equipmentPlacement.get('hermit',3,'head_straw')`);
  await click('[data-id="head_flower"]');await click('[data-nudge="1,0"]');await click('#admCancel');
  assert.deepEqual(await anchor(),saved['hermit/3']);
  await click('[data-nudge="1,0"]');await ev(`BCT.ui.show('settings');BCT.ui.show('admin')`);
  assert.deepEqual(await anchor(),saved['hermit/3'],'leaving cancels draft');
  await click('#admEdit');await click('#admReset');
  assert.deepEqual(await anchor(),originals['hermit/3']);delete saved['hermit/3'];
  assert.deepEqual(await ev(`BCT.equipmentPlacement.get('hermit',3,'head_straw')`),straw);
  // Storage quota failure keeps saved data intact and reports the failure.
  await click('[data-nudge="1,0"]');
  await ev(`window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota')}`);
  await click('#admSave');assert.match(await ev(`document.getElementById('admPosition').textContent`),/保存できません/);
  await ev(`Storage.prototype.setItem=realSetItem`);await click('#admCancel');
  assert.deepEqual(await anchor(),originals['hermit/3']);
  await b.shot('tests/e2e/out/equipment-placement.png');
  assert.equal(await ev(`localStorage.getItem('bct-state')`),state,'trial editing must not alter game data');
  await b.goto(base);
  for(const [k,a]of Object.entries(saved)){
    const [type,stage]=k.split('/');
    assert.deepEqual(await ev(`BCT.equipmentPlacement.get('${type}',${stage},'head_flower')`),a,'reload '+k);
    assert.ok(await ev(`BCT.art.render({type:'${type}',stage:${stage},equip:{head:'head_flower'},motion:false}).includes('translate(${a.x} ${a.y})')`));
  }
  // The moving renderer uses the same saved anchor; revision invalidates an existing rig.
  assert.equal(await ev(`(async()=>{const host=document.createElement('div');document.body.append(host);
    const opts={host,type:'turtle',stage:2,equip:{head:'head_flower'}},r=BCT.petRig.sync(null,opts);await r.ready;
    const a=BCT.equipmentPlacement.get('turtle',2,'head_flower'),parts=r.parts,L=parts.lay.body,F=parts.front;
    const expected=(a.x-F.ox)/F.k0;
    const actual=parseFloat(parts.root.querySelector('[data-item="head_flower"]').style.left);
    BCT.equipmentPlacement.preview('turtle',2,'head_flower',{x:a.x+2,y:a.y});BCT.equipmentPlacement.save('turtle',2,'head_flower');
    const next=BCT.petRig.sync(r,opts);await next.ready;
    const changed=r.destroyed&&next!==r;BCT.petRig.destroy(next);host.remove();
    return changed&&Math.abs(actual-expected)<.02;
  })()`),true);
  await ev(`BCT.ui.show('admin')`);await sleep(300);
  assert.equal(await ev(`document.documentElement.scrollWidth<=innerWidth`),true);
  assert.deepEqual(b.consoleLogs.filter(x=>/^(error|EXCEPTION)/.test(x)),[]);
  console.log('PASS: 9 forms touch drag, reverse, scale, per-item save/reload, reset, cancel, quota failure, static/moving anchors, game data intact.');
}finally{b.close();}
