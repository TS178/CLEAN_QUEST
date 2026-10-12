(() => {
 'use strict';
 const descriptions={
  dolphin:'尾の付け根と尾びれを連動させて上下に振り、左右の胸びれで水をかきます。背びれは小さくしならせます。',
  turtle:'大きな左右の前びれで水をかき、短い後ろびれで姿勢と方向を調整します。甲羅と顔は安定させて泳ぐ構成です。',
  hermit:'4本の歩脚を交互に踏み出し、接地と蹴り出しを作ります。ハサミは歩調に合わせて軽く揺らし、貝殻の揺れは小さくします。'
 };
 let type='dolphin',stage=1,manifest;
 const get=id=>document.getElementById(id);
 function render(){
  const spec=manifest.species[type],parts=manifest.assets.filter(p=>p.type===type&&p.stage===stage);
  get('original').src=`assets/pets/${type}-${stage}-normal.webp`;
  get('original').alt=`${spec.name} 第${stage}形態の元絵`;
  get('pet-title').textContent=`${spec.name}・第${stage}形態`;
  get('counter').textContent=`${parts.length} PARTS`;
  get('motion-note').textContent=descriptions[type];
  get('parts').replaceChildren(...parts.map((p,i)=>{
   const f=document.createElement('figure');f.className='part';
   const n=document.createElement('span');n.className='number';n.textContent=String(i+1).padStart(2,'0');
   const im=document.createElement('img');im.src=p.file;im.alt=p.label;im.width=p.width;im.height=p.height;
   const caption=document.createElement('figcaption');caption.textContent=p.label;
   const a=document.createElement('a');a.href=p.file;a.download=p.id+'.png';a.textContent='透過PNG';a.setAttribute('aria-label',p.label+'の透過PNGをダウンロード');
   f.append(n,im,caption,a);return f;
  }));
  get('views').src=`assets/art-source/turnarounds/${type}-side-back-v1.png`;
  get('views').alt=`${spec.name}の既存側面・背面参考図、3段階`;
  get('view-link').href=get('views').src;
  get('atlas-link').href=spec.source;
  document.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===type)));
  document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===stage)));
 }
 fetch('assets/pet-parts/manifest.json').then(r=>{if(!r.ok)throw new Error('素材一覧の読み込みに失敗しました');return r.json();}).then(data=>{
  manifest=data;render();
  document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.type;render();}));
  document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{stage=Number(b.dataset.stage);render();}));
 }).catch(e=>{get('pet-title').textContent=e.message;});
})();
