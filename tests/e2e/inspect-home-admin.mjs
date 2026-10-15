import fs from 'node:fs';
import {launch} from './cdp.mjs';
fs.mkdirSync('tests/e2e/out',{recursive:true});
const b=await launch({port:12316,width:1200,height:1300,mobile:false});
try{
 await b.goto('http://127.0.0.1:8766/index.html');
 await b.ev(`localStorage.clear();BCT.game.choosePet('dolphin','確認','確認',1);BCT.ui.show('admin');true`);
 await b.ev(`(async()=>{BCT.ui.show('settings');const grid=document.createElement('div');grid.style.cssText='position:fixed;inset:0;z-index:99999;background:#eaf2f1;display:grid;grid-template-columns:repeat(3,1fr);overflow:auto;gap:6px';document.body.append(grid);window.auditRigs=[];for(const type of ['dolphin','turtle','hermit'])for(const stage of [1,2,3]){const cell=document.createElement('div');cell.style.cssText='height:380px;position:relative;background:#fff';cell.innerHTML='<b>'+type+' '+stage+'</b><div style="position:absolute;inset:30px 40px"></div>';grid.append(cell);const host=cell.lastElementChild;const r=BCT.petRig.create({host,type,stage,equip:{}});await r.ready;r.parts.root.style.display='block';BCT.petRig.poseAt(r,Math.PI/2,1);auditRigs.push(r);}return true})()`);
 await b.shot('tests/e2e/out/admin-parts-before.png');
 await b.ev(`auditRigs.forEach(r=>BCT.petRig.poseAt(r,3*Math.PI/2,1));true`);
 await b.shot('tests/e2e/out/admin-parts-before-opposite.png');
 console.log('Part audit screenshots captured');
}finally{b.close();}
