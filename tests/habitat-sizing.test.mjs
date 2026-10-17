import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {importHabitatSizes} from '../tools/import-habitat-sizes.mjs';
const KEY='bct-habitat-sizes-v1',item='dolphin/home_shika_bench';
function browser(revision=0,sizes={},stored){
  const data=new Map(stored?[[KEY,stored]]:[]),ctx=vm.createContext({window:{addEventListener(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});
  for(const f of ['config','items','habitat-size-schema'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
  ctx.window.BCT.HABITAT_SIZE_DEFAULTS={revision,sizes};vm.runInContext(fs.readFileSync('js/habitat-sizing.js','utf8'),ctx);
  return {api:ctx.window.BCT.habitatSizing,schema:ctx.window.BCT.habitatSizeSchema,data};
}
test('配布設定が新しい端末にも届き、古い端末の調整値を残して上書きを防ぐ',()=>{
  const legacy=JSON.stringify({[item]:1.9}),old=browser(0,{},legacy);assert.equal(old.api.get('dolphin','home_shika_bench'),1.9);
  old.api.preview('dolphin','home_shika_bench',1.8);old.api.save('dolphin','home_shika_bench');
  const stored=old.data.get(KEY);assert.equal(JSON.parse(stored).baseRevision,0);
  for(const local of [undefined,legacy,stored]){
    const newer=browser(1,{[item]:1.6},local);assert.equal(newer.api.get('dolphin','home_shika_bench'),1.6);
    if(local)assert.equal(newer.data.get(KEY),local,'raw local adjustments are retained');
  }
});
test('配布用出力は保存済み設定だけを含み、リセットは配布中の標準へ戻る',()=>{
  const b=browser(2,{[item]:1.6});b.api.preview('dolphin','home_shika_bench',2);
  assert.equal(b.api.exportData().sizes[item],1.6,'draft excluded');
  b.api.save('dolphin','home_shika_bench');assert.equal(b.api.exportData().sizes[item],2);
  b.api.save('dolphin','home_shika_bench',true);assert.equal(b.api.get('dolphin','home_shika_bench'),1.6);
  assert.deepEqual(Object.keys(b.api.exportData()).sort(),['baseRevision','format','sizes','version']);
  for(const invalid of [-1,0,3,'1.5',null])assert.throws(()=>b.schema.validate({format:'clean-quest-habitat-sizes',version:1,baseRevision:2,sizes:{[item]:invalid}}));
  assert.throws(()=>b.schema.validate({format:'clean-quest-habitat-sizes',version:1,baseRevision:2,sizes:{'dolphin/head_crown':1}}));
});
test('GitHub用取り込みで設定と版を更新し、古い書き出し・不正データは変更前に拒否する',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bct-size-import-'));fs.mkdirSync(path.join(root,'js'));
  try{
    for(const f of ['config','items','habitat-size-schema','habitat-size-defaults'])fs.copyFileSync('js/'+f+'.js',path.join(root,'js',f+'.js'));
    fs.writeFileSync(path.join(root,'js/habitat-size-defaults.js'),'window.BCT.HABITAT_SIZE_DEFAULTS = {revision:0,sizes:{}};');
    fs.copyFileSync('service-worker.js',path.join(root,'service-worker.js'));
    const source=browser().api.exportData();source.sizes[item]=1.75;
    const file=path.join(root,'export.json');fs.writeFileSync(file,JSON.stringify(source));
    const before=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
    const dry=importHabitatSizes(file,{root,check:true});assert.equal(dry.changed,true);assert.equal(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),before);
    const result=importHabitatSizes(file,{root});assert.equal(result.revision,1);
    const published=fs.readFileSync(path.join(root,'js/habitat-size-defaults.js'),'utf8');assert.ok(published.includes('1.75'));
    const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');assert.ok(worker.includes('"'+result.appVersion+'"'));
    assert.throws(()=>importHabitatSizes(file,{root}),/版が一致/);assert.equal(fs.readFileSync(path.join(root,'js/habitat-size-defaults.js'),'utf8'),published);
    source.baseRevision=1;source.sizes[item]=99;fs.writeFileSync(file,JSON.stringify(source));assert.throws(()=>importHabitatSizes(file,{root}),/不正/);assert.equal(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),worker);
  }finally{
    // Remove only the unique directory created by this test, under the verified temp parent.
    if(path.dirname(path.resolve(root))===path.resolve(os.tmpdir())&&path.basename(root).startsWith('bct-size-import-'))fs.rmSync(root,{recursive:true,force:true});
  }
});
