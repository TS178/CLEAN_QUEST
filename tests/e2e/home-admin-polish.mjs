import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launch,sleep} from './cdp.mjs';
fs.mkdirSync('tests/e2e/out',{recursive:true});
const b=await launch({port:12317,width:390,height:844,mobile:true});
try{
 await b.goto('http://127.0.0.1:8766/index.html');
 await b.ev(`localStorage.clear();BCT.game.choosePet('dolphin','確認','確認',1);BCT.ui.show('home');true`);
 const portraits=[];
 for(const type of ['dolphin','turtle','hermit'])for(const [stage,level] of [[1,1],[2,3],[3,5]])for(const head of ['', 'head_straw','head_crown']){
  await b.ev(`BCT.store.transact(s=>{s.pet.type='${type}';s.food={drop_blue:{bought:100,fed:100,spent:0,xp:BCT.CONFIG.levels[${level-1}]}};s.seenLv=${level};s.equip={head:'${head}',acc:'accessory_scarf'};});BCT.ui.show('home');true`);
  await sleep(50);
  const result=await b.ev(`(()=>{const svg=document.querySelector('#fairyPortrait svg[data-pet]'),v=svg.viewBox.baseVal,cx=v.x+v.width/2,cy=v.y+v.height/2,t=svg.dataset.pet,st=Number(svg.dataset.stage),scale=[0,.82,.93,1][st];const doc=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+BCT.art.neckMask(t,st)+'</svg>','image/svg+xml'),el=doc.querySelector('ellipse'),a=k=>Number(el.getAttribute(k));return {type:t,stage:String(st),fit:Array.from({length:36},(_,i)=>{const angle=i*Math.PI/18,x=100+(a('cx')+a('rx')*Math.cos(angle)-100)*scale,y=174+(a('cy')+a('ry')*Math.sin(angle)-174)*scale;return Math.hypot(x-cx,y-cy)<v.width/2}).every(Boolean),transform:getComputedStyle(svg).transform,html:document.querySelector('#actFairy').outerHTML};})()`);
  assert.equal(result.type,type);assert.equal(result.stage,String(stage));assert.ok(result.fit,`${type}-${stage}-${head} inside circle`);assert.equal(result.transform,'none');
  if(!head)portraits.push(result.html);
 }
 for(const width of [390,320]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  const layout=await b.ev(`(()=>{const a=document.querySelector('.hbg-lbl').getBoundingClientRect(),p=document.querySelector('.hbg-count').getBoundingClientRect(),m=document.querySelector('.hbg-medals').getBoundingClientRect();return {below:m.top>a.bottom&&m.top>p.bottom,top:Math.abs(a.top-p.top)<1,count:document.querySelector('.hbg-count').textContent,fit:document.documentElement.scrollWidth<=innerWidth};})()`);
  assert.ok(layout.below&&layout.top&&layout.fit,JSON.stringify(layout));
  await b.shot(`tests/e2e/out/home-polish-${width}.png`);
 }
 await b.ev(`document.querySelector('#homeBadges').click();true`);assert.equal(await b.ev('BCT.ui.current()'),'mission');
 await b.ev(`BCT.ui.show('admin');true`);assert.equal(await b.ev(`document.querySelector('#admQr').textContent.includes('🎉')`),false);
 await b.ev(`document.querySelector('#admQr').click();true`);assert.ok(await b.ev(`document.querySelector('#modalBox').textContent.includes('おつかれさま')`));
 assert.ok(await b.ev(`!document.querySelector('#modalBox').textContent.includes('🎉')`));
 await b.ev(`BCT.ui.closeModal();BCT.ui.show('settings');true`);
 await b.send('Emulation.setDeviceMetricsOverride',{width:700,height:650,deviceScaleFactor:1,mobile:false});
 await b.ev(`(()=>{const wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;background:#f2f7f2;z-index:99999;padding:30px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';wrap.innerHTML=${JSON.stringify(portraits.map((p,i)=>`<div style="display:grid;place-items:center"><span>${['イルカ','カメ','ヤドカリ'][Math.floor(i/3)]}・${i%3+1}段階</span>${p}</div>`).join(''))};document.body.append(wrap);})();true`);
 await b.shot('tests/e2e/out/home-portraits-all.png');
 assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
 for(const f of ['js/admin.js','js/mission.js','js/profile.js'])assert.ok(!fs.readFileSync(f,'utf8').includes('🎉'),f);
 console.log('PASS: faces of 27 species/stage/equipment combinations fit the circle; 320/390px badge layout; mission navigation; admin QR still opens; no JS errors.');
}finally{b.close();}
