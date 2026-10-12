// Slice approved image-generation atlases into transparent WebP assets, then
// embed them in one offline bundle. No redrawing or palette transformation.
// Run against a local server from the repository root: node tools/pack-pet-art.mjs
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const base=process.env.BCT_URL || 'http://127.0.0.1:8766/';
const entries=[];
const add=(id,source,rect,folder,polygon)=>entries.push({id,source,rect,folder,polygon});
// Final forms have broader silhouettes; boundaries follow the transparent gutters.
const cols={dolphin:[[0,470],[470,462],[932,604]],turtle:[[0,470],[470,500],[970,566]],hermit:[[0,470],[470,500],[970,566]]};
for(const type of Object.keys(cols))for(let row=0;row<2;row++)for(let col=0;col<3;col++){
 const [x,w]=cols[type][col],split=512;
 add(`${type}-${col+1}-${row?'happy':'normal'}`,'evolution-'+type,[x,row?split:0,w,512],'pets');
}
[
 ['head_straw',[0,35,350,300]],['head_marine',[350,45,306,280]],
 ['head_flower',[658,45,325,285]],['head_shell',[985,40,310,290]],['head_crown',[1296,35,324,290]],
 ['reward_clean_hat',[0,335,358,290]],['accessory_ribbon',[358,341,309,284]],
 ['accessory_scarf',[673,340,365,286],[[673,340],[985,340],[985,477],[1038,551],[1038,626],[673,626]]],
 ['accessory_pendant',[999,335,312,290],[[999,335],[1311,335],[1311,625],[1081,625],[1081,487],[999,487]]],
 ['accessory_badge',[1311,335,309,290]],
 ['reward_guardian_medal',[35,630,275,330]],['toy_ball',[340,635,316,321]],
 ['toy_bubbles',[670,635,316,321]],['toy_music',[994,632,330,328]],
].forEach(([id,rect,poly])=>add(id,'items',rect,'items',poly));
['frame_wave','frame_shell','frame_rainbow','reward_event_frame'].forEach((id,i)=>
 add(id,'frames',[(i%2)*627,i<2?0:621,627,i<2?621:633],'frames'));
['dolphin_wave','dolphin_star','dolphin_sparkle','turtle_wave','turtle_flower','turtle_star','hermit_stripe','hermit_dot','hermit_rainbow'].forEach((id,i)=>
 add(id,'patterns',[(i%3)*418,Math.floor(i/3)*418,418,418],'patterns'));

const b=await launch({port:11000+Math.floor(Math.random()*1000),width:1100,height:900});
try{
 await b.goto(base);
 const assets={};
 for(const e of entries){
  const result=await b.ev(`(async()=>{
   const e=${JSON.stringify(e)};
   const img=new Image();img.src='assets/art-source/'+e.source+'.png';await img.decode();
   const [x,y,w,h]=e.rect;const c=document.createElement('canvas');c.width=w;c.height=h;
   const g=c.getContext('2d');
   if(e.polygon){g.beginPath();e.polygon.forEach(([px,py],i)=>i?g.lineTo(px-x,py-y):g.moveTo(px-x,py-y));g.closePath();g.clip();}
   g.drawImage(img,-x,-y);
   const data=g.getImageData(0,0,w,h).data;let l=w,t=h,r=0,b=0;
   for(let py=0;py<h;py++)for(let px=0;px<w;px++)if(data[(py*w+px)*4+3]>32){l=Math.min(l,px);t=Math.min(t,py);r=Math.max(r,px);b=Math.max(b,py);}
   if(r<=l||b<=t)throw new Error('Empty sprite: '+e.id);
   l=Math.max(0,l-2);t=Math.max(0,t-2);r=Math.min(w-1,r+2);b=Math.min(h-1,b+2);
   const out=document.createElement('canvas');out.width=r-l+1;out.height=b-t+1;
   out.getContext('2d').drawImage(c,l,t,out.width,out.height,0,0,out.width,out.height);
   return {width:out.width,height:out.height,src:out.toDataURL('image/webp',.94)};
  })()`);
  const file=`assets/${e.folder}/${e.id}.webp`;
  fs.writeFileSync(file,Buffer.from(result.src.split(',')[1],'base64'));
  assets[e.id]={...result,file};
  console.log(`${e.id}: ${result.width}x${result.height}`);
 }
 fs.writeFileSync('js/pet-sprites.js','/* Generated from approved art. Rebuild: node tools/pack-pet-art.mjs */\nwindow.BCT = window.BCT || {};\nwindow.BCT.PET_SPRITES = '+JSON.stringify(assets)+';\n');
 fs.writeFileSync('assets/art-source/manifest.json',JSON.stringify(entries,null,2)+'\n');
 console.log('Embedded sprites:',Object.keys(assets).length,'bytes:',fs.statSync('js/pet-sprites.js').size);
}finally{b.close();}
