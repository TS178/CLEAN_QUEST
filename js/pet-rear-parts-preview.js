(() => {
 'use strict';
 const names={dolphin:'イルカ',turtle:'カメ',hermit:'ヤドカリ'};
 const labels={body:'背面の胴体', 'fin-left':'左の胸びれ','fin-right':'右の胸びれ',dorsal:'背面から見た背びれ','tail-base':'尾の付け根','tail-fluke':'尾びれ','front-left':'左の前びれ','front-right':'右の前びれ','rear-left':'左の後ろびれ','rear-right':'右の後ろびれ',tail:'しっぽ','claw-left':'左のハサミ','claw-right':'右のハサミ','leg-left-front':'左の前脚','leg-left-rear':'左の後脚','leg-right-front':'右の前脚','leg-right-rear':'右の後脚'};
 const notes={dolphin:'背面の青い胴体、左右の胸びれ、細く見える背びれ、尾の付け根、尾びれに分けました。',turtle:'甲羅と後頭部を本体にし、左右の前後びれとしっぽを別々に描きました。',hermit:'貝殻と胴体、左右のハサミ、4本の歩脚に分けました。第3形態の大きなハサミは背面では左側です。'};
 let type='dolphin',stage=1,manifest;
 const get=id=>document.getElementById(id);
 function render(){
  const prefix=type+'-'+stage+'-',parts=Object.entries(manifest).filter(([id])=>id.startsWith(prefix));
  get('original').src=manifest[prefix+'body'].file;get('original').alt=names[type]+'の背面本体';
  get('pet-title').textContent=names[type]+'・第'+stage+'形態';get('counter').textContent=parts.length+' REAR PARTS';get('motion-note').textContent=notes[type];
  get('parts').replaceChildren(...parts.map(([id,p],i)=>{
   const key=id.slice(prefix.length),label=key==='body'?(type==='turtle'?'甲羅・後頭部':type==='hermit'?'貝殻・胴体':labels.body):labels[key];
   const f=document.createElement('figure');f.className='part';const n=document.createElement('span');n.className='number';n.textContent=String(i+1).padStart(2,'0');const im=document.createElement('img');im.src=p.file;im.alt=label;const caption=document.createElement('figcaption');caption.textContent=label;const a=document.createElement('a');a.href=p.file;a.download=id+'-rear.png';a.textContent='透過PNG';a.setAttribute('aria-label',label+'をダウンロード');f.append(n,im,caption,a);return f;
  }));
  get('views').src='assets/art-source/turnarounds/'+type+'-side-back-v1.png';get('views').alt=names[type]+'の側面と背面の参考図';get('view-link').href=get('views').src;get('atlas-link').href='assets/art-source/rear-parts/'+type+'.png';
  document.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===type)));document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===stage)));
 }
 fetch('assets/pet-parts-rear/manifest.json').then(r=>{if(!r.ok)throw new Error('素材一覧を読み込めませんでした');return r.json();}).then(data=>{manifest=data;render();document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;render();});document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{stage=Number(b.dataset.stage);render();});}).catch(e=>get('pet-title').textContent=e.message);
})();
