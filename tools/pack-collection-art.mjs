// Extract generated transparent atlases. Shared with rear static-parts delivery.
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const uiRoot='assets/art-source/ui-collection/',rearRoot='assets/art-source/rear-parts/';
const definitions=[
 {key:'badges',source:uiRoot+'badges.png',rows:[['badge_first','badge_plahunter','badge_hakase','badge_perfect'],['badge_tantei','badge_meijin','badge_sodate']],folder:'assets/collection'},
 {key:'sorting',source:uiRoot+'sorting.png',rows:[['bin_plastic','bin_canbin','bin_burn'],['b_bottle','b_bag','b_can'],['b_glass','b_wood','b_rope']],folder:'assets/collection'},
 ...['plastic','canbin','burn'].map(key=>({key:'bin_'+key,source:uiRoot+'tall-bins/'+key+'.png',rows:[['bin_'+key]],folder:'assets/collection'})),
 ...['dolphin','turtle','hermit'].map(type=>({key:type,source:rearRoot+type+'.png',folder:'assets/pet-parts-rear',rows:[1,2,3].map(stage=>(type==='dolphin'?['body','fin-left','fin-right','dorsal','tail-base','tail-fluke']:type==='turtle'?['body','front-left','front-right','rear-left','rear-right','tail']:['body','claw-left','claw-right','leg-left-front','leg-left-rear','leg-right-front','leg-right-rear']).map(part=>type+'-'+stage+'-'+part))}))
];
const args=process.argv.slice(2),inspect=args.includes('--inspect');
const selected=definitions.filter(d=>args.includes('--bins')?d.key.startsWith('bin_'):args.includes('--ui')?d.folder==='assets/collection':args.includes('--rear')?d.folder==='assets/pet-parts-rear':true);
const b=await launch({port:11931,width:1200,height:900,mobile:false});
try{
 await b.goto('http://127.0.0.1:8766/preview-pet-parts.html');
 const result=args.includes('--bins')?Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(uiRoot+'manifest.json','utf8'))).map(([id,s])=>[id,{...s,src:'data:image/webp;base64,'+fs.readFileSync(s.file).toString('base64')}])):{},summary={};
 for(const def of selected){
  const scan=await b.ev(`(async()=>{
   const im=new Image();im.src=${JSON.stringify(def.source)};await im.decode();
   const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
   const w=c.width,h=c.height,data=g.getImageData(0,0,w,h),d=data.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),regions=[];let transparent=0;
   for(let k=0;k<w*h;k++)if(d[k*4+3]===0)transparent++;
   for(let k=0;k<w*h;k++){
    if(seen[k]||d[k*4+3]<128)continue;
    let start=0,end=1,l=w,t=h,r=0,bot=0;queue[0]=k;seen[k]=1;
    while(start<end){const q=queue[start++],x=q%w,y=Math.floor(q/w);l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);bot=Math.max(bot,y);
     for(const a of [x?q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1])if(a>=0&&!seen[a]&&d[a*4+3]>=128){seen[a]=1;queue[end++]=a;}
    }
    if(end>700)regions.push({area:end,rect:[l,t,r-l+1,bot-t+1]});
   }
   window.atlas={im,w,h};return {width:w,height:h,transparent:transparent/(w*h),regions};
  })()`);
  summary[def.key]=scan;
  if(inspect)continue;
  if(scan.transparent<.05)throw new Error('Non-transparent atlas: '+def.key);
  if(scan.regions.length!==def.rows.flat().length)throw new Error('Part count mismatch '+def.key+': '+scan.regions.length);
  const regions=scan.regions.sort((a,b)=>(a.rect[1]+a.rect[3]/2)-(b.rect[1]+b.rect[3]/2));let offset=0;
  fs.mkdirSync(def.folder,{recursive:true});
  for(const row of def.rows){
   const group=regions.slice(offset,offset+row.length).sort((a,b)=>a.rect[0]-b.rect[0]);offset+=row.length;
   for(let i=0;i<row.length;i++){
    const id=row[i],r=group[i].rect,pad=3,x=Math.max(0,r[0]-pad),y=Math.max(0,r[1]-pad),rect=[x,y,Math.min(scan.width,r[0]+r[2]+pad)-x,Math.min(scan.height,r[1]+r[3]+pad)-y];
    const data=await b.ev(`(()=>{
     const rect=${JSON.stringify(rect)},c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const g=c.getContext('2d');g.drawImage(atlas.im,rect[0],rect[1],rect[2],rect[3],0,0,rect[2],rect[3]);
     const pixels=g.getImageData(0,0,c.width,c.height),d=pixels.data,w=c.width,h=c.height,seen=new Uint8Array(w*h),q=new Int32Array(w*h);let largest=[];
     for(let k=0;k<w*h;k++){if(seen[k]||d[k*4+3]<128)continue;let start=0,end=1;q[0]=k;seen[k]=1;while(start<end){const n=q[start++],x=n%w,y=Math.floor(n/w);for(const a of [x?n-1:-1,x<w-1?n+1:-1,y?n-w:-1,y<h-1?n+w:-1])if(a>=0&&!seen[a]&&d[a*4+3]>=128){seen[a]=1;q[end++]=a;}}if(end>largest.length)largest=Array.from(q.subarray(0,end));}
     const keep=new Uint8Array(w*h);for(const k of largest){const x=k%w,y=Math.floor(k/w);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)keep[yy*w+xx]=1;}}
     for(let k=0;k<w*h;k++)if(!keep[k])d[k*4+3]=0;g.putImageData(pixels,0,0);
     const out=document.createElement('canvas'),max=${def.folder==='assets/collection'?420:900};const scale=Math.min(1,max/Math.max(w,h));out.width=Math.round(w*scale);out.height=Math.round(h*scale);out.getContext('2d').drawImage(c,0,0,out.width,out.height);
     return {width:out.width,height:out.height,src:out.toDataURL(${def.folder==='assets/collection'?'"image/webp",.94':'"image/png"'})};
    })()`);
    const file=def.folder+'/'+id+(def.folder==='assets/collection'?'.webp':'.png');fs.writeFileSync(file,Buffer.from(data.src.split(',')[1],'base64'));
    result[id]={...data,file,source:def.source,rect};
   }
  }
 }
 console.log(JSON.stringify(summary));
 if(!inspect){
  if(args.includes('--ui')||args.includes('--bins')){fs.writeFileSync('js/collection-sprites.js','/* Generated by tools/pack-collection-art.mjs --ui */\nwindow.BCT=window.BCT||{};\nwindow.BCT.COLLECTION_SPRITES='+JSON.stringify(result)+';\n');fs.writeFileSync(uiRoot+'manifest.json',JSON.stringify(Object.fromEntries(Object.entries(result).map(([id,{src,...rest}])=>[id,rest])),null,2));}
  if(args.includes('--rear'))fs.writeFileSync('assets/pet-parts-rear/manifest.json',JSON.stringify(Object.fromEntries(Object.entries(result).map(([id,{src,...rest}])=>[id,rest])),null,2));
  console.log('Packaged '+Object.keys(result).length+' assets.');
 }
}finally{b.close();}
