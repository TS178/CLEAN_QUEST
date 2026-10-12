// Package generated sprites into individual PNGs without repainting or resizing.
// Connected silhouette masks prevent neighboring sprites leaking into crops.
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const root='assets/art-source/motion-parts/';
const inspection=JSON.parse(fs.readFileSync(root+'inspection.json','utf8'));
const species={
 dolphin:{name:'イルカ',source:'dolphin-parts-v1.png',parts:[['body','顔・胴体'],['fin-near','手前の胸びれ'],['fin-far','奥の胸びれ'],['dorsal','背びれ'],['tail-base','尾の付け根'],['tail-fluke','尾びれ']]},
 turtle:{name:'カメ',source:'turtle-parts-v1.png',parts:[['body','顔・胴体・甲羅'],['front-near','手前の前びれ'],['front-far','奥の前びれ'],['rear-near','手前の後ろびれ'],['rear-far','奥の後ろびれ'],['tail','しっぽ']]},
 hermit:{name:'ヤドカリ',source:'hermit-parts-v2.png',parts:[['body','顔・胴体・貝殻'],['claw-right','画面左のハサミ'],['claw-left','画面右のハサミ'],['leg-near-front','手前の前脚'],['leg-near-rear','手前の後脚'],['leg-far-front','奥の前脚'],['leg-far-rear','奥の後脚']]}
};
const b=await launch({port:11874,width:1200,height:900,mobile:false});
try{
 await b.goto('http://127.0.0.1:8766/preview-pet-motion.html');
 fs.mkdirSync('assets/pet-parts',{recursive:true});
 const manifest={version:1,status:'review',note:'Generated drawings. Assembly transforms and joint pivots must be calibrated before runtime integration.',species:{},assets:[]};
 for(const [type,spec] of Object.entries(species)){
  const info=inspection[type],count=spec.parts.length;
  if(info.regions.length!==count*3)throw new Error('Unexpected part count: '+type);
  manifest.species[type]={...spec,source:root+spec.source};
  const regions=info.regions.slice().sort((a,b)=>(a.rect[1]+a.rect[3]/2)-(b.rect[1]+b.rect[3]/2));
  for(let row=0;row<3;row++){
   const parts=regions.slice(row*count,(row+1)*count).sort((a,b)=>a.rect[0]-b.rect[0]);
   for(let col=0;col<count;col++){
    const [part,label]=spec.parts[col],id=type+'-'+(row+1)+'-'+part;
    const r=parts[col].rect,pad=3;
    const rect=[Math.max(0,r[0]-pad),Math.max(0,r[1]-pad),Math.min(info.width,r[0]+r[2]+pad),Math.min(info.height,r[1]+r[3]+pad)];
    rect[2]-=rect[0];rect[3]-=rect[1];
    const result=await b.ev(`(async()=>{
     const im=new Image();im.src=${JSON.stringify(root+spec.source)};await im.decode();
     const rect=${JSON.stringify(rect)},c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];
     const g=c.getContext('2d');g.drawImage(im,rect[0],rect[1],rect[2],rect[3],0,0,rect[2],rect[3]);
     const pixels=g.getImageData(0,0,c.width,c.height),d=pixels.data,w=c.width,h=c.height;
     const seen=new Uint8Array(w*h),q=new Int32Array(w*h);let largest=[];
     for(let k=0;k<w*h;k++){
      if(seen[k]||d[k*4+3]<128)continue;
      let start=0,end=1;q[0]=k;seen[k]=1;
      while(start<end){const n=q[start++],x=n%w,y=Math.floor(n/w);
       for(const a of [x?n-1:-1,x<w-1?n+1:-1,y?n-w:-1,y<h-1?n+w:-1])if(a>=0&&!seen[a]&&d[a*4+3]>=128){seen[a]=1;q[end++]=a;}
      }
      if(end>largest.length)largest=Array.from(q.subarray(0,end));
     }
     const mask=new Uint8Array(w*h);for(const k of largest)mask[k]=1;
     // Keep the source antialias fringe within 2 pixels of this silhouette.
     const keep=mask.slice();for(const k of largest){const x=k%w,y=Math.floor(k/w);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)keep[yy*w+xx]=1;}}
     for(let k=0;k<w*h;k++)if(!keep[k])d[k*4+3]=0;
     g.putImageData(pixels,0,0);
     return c.toDataURL('image/png');
    })()`);
    const file='assets/pet-parts/'+id+'.png';fs.writeFileSync(file,Buffer.from(result.split(',')[1],'base64'));
    manifest.assets.push({id,type,stage:row+1,part,label,file,width:rect[2],height:rect[3],source:root+spec.source,rect});
   }
  }
 }
 fs.writeFileSync('assets/pet-parts/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('Packaged '+manifest.assets.length+' transparent PNG parts.');
}finally{b.close();}
