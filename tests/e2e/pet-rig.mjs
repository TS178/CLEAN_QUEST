// パーツで うごかす ようせい（js/pet-rig.js）の 通し確認（headless Edge）
//   python -m http.server 8000 → node tests/e2e/pet-rig.mjs   （BCT_URL / CDP_PORT / OUT で変更可）
import { launch, sleep } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const PORT = Number(process.env.CDP_PORT || 9500 + Math.floor(Math.random() * 400));
const OUT = process.env.OUT || path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = "") => {
  const line = `${ok ? "OK " : "NG "} ${name}${info ? "  " + info : ""}`;
  results.push(line);
  console.log(line);
};
const b = await launch({ port: PORT });
const ev = b.ev;
const shot = (n) => b.shot(path.join(OUT, n + ".png"));
async function waitFor(expr, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(expr)) return true;
    await sleep(100);
  }
  return false;
}
const shown = (sel) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});return !!e&&getComputedStyle(e).display!=='none'})()`;

try {
  await b.goto(BASE + "index.html", 300);
  await ev(`localStorage.clear(); BCT.game.choosePet('dolphin','テスト','テスト',1); true`);
  await b.goto(BASE + "index.html", 300);

  // ---------------- ホーム：うごきまわる あいだは パーツ ----------------
  check("ホーム：うごきまわる あいだは パーツで 表示", await waitFor(`document.getElementById('pet').classList.contains('rig-on')`));
  check("パーツ表示の あいだ 正面の絵は かくれる", (await ev(shown("#pet .pet-rig"))) && !(await ev(shown("#petBody"))));
  check("困り顔は 汗マークだけ（色を くすませない）", (await ev(`document.getElementById('pet').classList.contains('worried')`)) &&
    (await ev(`getComputedStyle(document.querySelector('#pet .pet-rig')).filter==='none' && getComputedStyle(document.getElementById('petBody')).filter==='none' && getComputedStyle(document.getElementById('pet'),'::after').content.includes('💦')`)));
  check("イルカの パーツは 正面の絵から 切り出した もの（胴体・背びれ・ヒレ2つ・尾びれ）", (await ev(`document.querySelectorAll('#pet [data-part]').length`)) === (await ev(`Object.keys(BCT.PET_RIG_CUT['dolphin-1'].parts).length`)) &&
    (await ev(`[...document.querySelectorAll('#pet .pr-img')].every(i=>i.src.includes('/assets/pet-cut/dolphin-1-'))`)));
  const tf1 = await ev(`document.querySelector('#pet [data-part="tail-fluke"]').style.transform`);
  await sleep(350);
  const tf2 = await ev(`document.querySelector('#pet [data-part="tail-fluke"]').style.transform`);
  check("尾びれが 回って いる（requestAnimationFrame）", tf1 !== tf2, `${tf1} → ${tf2}`);
  check("付け根に transform-origin", /px \S+px/.test(await ev(`document.querySelector('#pet [data-part="tail-fluke"]').style.transformOrigin`)));
  // 向きを かえた その瞬間に 反転が おわっている（裏返す アニメーションで おくれない）
  const flipNow = (pet, face) => ev(`(()=>{const p=document.getElementById('${pet}');p.classList.toggle('left');
    const t=getComputedStyle(document.getElementById('${face}')).transform;return p.classList.contains('left')?t==='matrix(-1, 0, 0, 1, 0, 0)':(t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)')})()`);
  check("ホーム：向きを かえると すぐ 反転（ラグなし）", await flipNow("pet", "petFacing"));
  await sleep(1200);
  await shot("pet-rig-home");

  // なでる → 正面の絵（pet-motion）。おわったら また パーツ
  await ev(`document.getElementById('pet').click(); true`);
  await sleep(150);
  check("なでると 正面の絵に もどる", !(await ev(`document.getElementById('pet').classList.contains('rig-on')`)) && (await ev(shown("#petBody"))));
  check("なで おわると また パーツ", await waitFor(`document.getElementById('pet').classList.contains('rig-on')`, 5000));

  // 動きを へらす 設定 → 正面の 止まった絵
  await ev(`document.body.classList.add('reduce-motion'); true`);
  await sleep(100);
  check("動きを へらす 設定では 正面の絵だけ", !(await ev(shown("#pet .pet-rig"))) && (await ev(shown("#petBody"))));
  await ev(`document.body.classList.remove('reduce-motion'); true`);

  // 向きを かえるのは 間隔が あいたときだけ（ふだんは 30秒に 1回ほど）。8秒 見て 0回 → 間隔を 5秒に して 20秒 見る
  await ev(`void (async()=>{const pet=document.getElementById('pet');let last=pet.classList.contains('left'),t=performance.now();const flips=[];
    const obs=new MutationObserver(()=>{const l=pet.classList.contains('left');if(l!==last){last=l;flips.push(performance.now()-t);}});
    obs.observe(pet,{attributes:true,attributeFilter:['class']});
    await new Promise(r=>setTimeout(r,8000));const normal=flips.length;
    const keep=BCT.PET_RIG.common.turnEveryMs;BCT.PET_RIG.common.turnEveryMs=5000;flips.length=0;t=performance.now();
    await new Promise(r=>setTimeout(r,20000));obs.disconnect();BCT.PET_RIG.common.turnEveryMs=keep;
    window.__turns={normal,short:flips.map(Math.round)};})(); true`);
  await waitFor(`!!window.__turns`, 32000);
  const turns = await ev(`window.__turns`);
  check("ホーム：ふだんは しばらく 向きを かえない", turns.normal === 0, JSON.stringify(turns));
  check("ホーム：向きを かえるのは 間隔が あいたときだけ", turns.short.length >= 1 && turns.short.every((v, i) => i === 0 || v - turns.short[i - 1] >= 4900), JSON.stringify(turns.short));

  // ---------------- 速さと 動きの 連動・振り向き（テスト用の 入れ物で） ----------------
  await ev(`(()=>{BCT.ui.show('mission');
    const host=document.createElement('div');host.id='rigTest';host.style.cssText='position:fixed;left:0;top:200px;width:150px;height:150px;z-index:99';
    document.body.appendChild(host);
    window.__rig=BCT.petRig.create({type:'dolphin',stage:2,host,track:host,owner:host,equip:{head:'head_straw',acc:'accessory_scarf'}});
    return true})()`);
  check("パーツが 読みこめる", await ev(`window.__rig.ready`));
  await ev(`BCT.petRig.setActive(window.__rig,true); true`);
  // 止まっている 1.2秒 → 動いている 1.2秒 の 尾びれの 振れ幅・速さを はかる（UI を 待つ Promise は 返さない）
  await ev(`void (async()=>{
    const r=window.__rig, el=r.parts.els['tail-fluke'], base=r.parts.lay['tail-fluke'].rot, host=document.getElementById('rigTest');
    const ang=()=>Number(/rotate\\(([-\\d.]+)deg\\)/.exec(el.style.transform)[1])-base;
    const frame=()=>new Promise(res=>requestAnimationFrame(res));
    async function watch(ms, move){const t0=performance.now(),p0=r.phase;let mn=1e9,mx=-1e9,lv=0;
      while(performance.now()-t0<ms){await frame();if(move)host.style.left=((performance.now()-t0)/ms*300)+'px';const a=ang();mn=Math.min(mn,a);mx=Math.max(mx,a);lv=Math.max(lv,r.level);}
      return {range:mx-mn,level:lv,phase:r.phase-p0};}
    await watch(400,false);
    const still=await watch(1200,false); const moving=await watch(1200,true);
    window.__speed={still,moving};
  })(); true`);
  await waitFor(`!!window.__speed`, 6000);
  const sp = await ev(`window.__speed`);
  check("止まっているときは 小さく ゆっくり", sp.still.level < 0.1 && sp.still.range < 10, JSON.stringify(sp.still));
  check("動くと 大きく", sp.moving.level > 0.8 && sp.moving.range > sp.still.range * 2, JSON.stringify(sp.moving));
  check("動くと 速く（周期が みじかい）", sp.moving.phase > sp.still.phase * 1.8);
  // 振り向き：いまは 正面の絵を はさまない（turnMs = 0。ちらつき なし）。turnMs を ふやすと そのあいだ 正面の絵
  await ev(`document.getElementById('rigTest').classList.add('left'); true`);
  await sleep(30);
  check("振り向くときも パーツの まま（正面の絵が ちらつかない）", !(await ev(`document.getElementById('rigTest').classList.contains('rig-turn')`)) && (await ev(shown("#rigTest .pet-rig"))));
  await ev(`window.__turnMs=BCT.PET_RIG.common.turnMs; BCT.PET_RIG.common.turnMs=300; document.getElementById('rigTest').classList.remove('left'); true`);
  await sleep(30);
  check("turnMs を ふやすと 振り向くあいだ 正面の絵（rig-turn）", await ev(`document.getElementById('rigTest').classList.contains('rig-turn')`));
  await sleep(500);
  check("振り向いたら また パーツ", !(await ev(`document.getElementById('rigTest').classList.contains('rig-turn')`)));
  await ev(`BCT.PET_RIG.common.turnMs=window.__turnMs; true`);
  check("帽子・こものは 胴体の パーツに 付く（いっしょに うごく）",
    await ev(`!!document.querySelector('#rigTest [data-part="body"] > .pr-equip[data-item="head_straw"]') && !!document.querySelector('#rigTest [data-part="body"] > .pr-equip[data-item="accessory_scarf"]')`));

  // ---------------- 3種類 × 3段階 ----------------
  const all = await ev(`(async()=>{const out=[];
    for(const type of ['dolphin','turtle','hermit'])for(const stage of [1,2,3]){
      const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:150px;height:150px';document.body.appendChild(host);
      const r=BCT.petRig.create({type,stage,host,track:host,owner:host,equip:{head:'head_crown',acc:'accessory_pendant'}});
      const ok=await r.ready;
      out.push({key:type+'-'+stage,ok,parts:host.querySelectorAll('[data-part]').length,want:Object.keys(BCT.petRigConfig(type,stage).parts).length,
        layer:Object.fromEntries([...host.querySelectorAll('[data-part="body"] [data-part]')].map(e=>[e.dataset.part,Number(e.style.zIndex)])),
        tint:host.querySelector('.pr-stage').style.filter,
        head:!!host.querySelector('.pr-head'),headItem:!!host.querySelector((type==='turtle'?'.pr-head':'[data-part="body"]')+' > .pr-equip[data-item="head_crown"]')});
      if(type==='hermit'&&stage===1){BCT.petRig.poseAt(r,Math.PI/2,1);out[out.length-1].bob=r.parts.els.body.style.transform;}
      BCT.petRig.destroy(r);host.remove();
    }return out})()`);
  check("3種類 × 3段階 すべて 組みたてられる", all.every((r) => r.ok && r.parts === r.want), JSON.stringify(all.filter((r) => !r.ok || r.parts !== r.want)));
  const BCT_CUT = await ev(`BCT.PET_RIG_CUT`);
  // 重ね順は 正面の絵の とおり（絵で 胴体に かぶさって いる 手足は 前、胴体から 生えて いる 手足は うしろ。js/pet-rig-cut.js）
  check("重ね順は 正面の絵の とおり", all.every((r) => Object.entries(r.layer).every(([id, z]) => z === BCT_CUT[r.key].parts[id].z)), JSON.stringify(all.map((r) => r.layer)));
  check("正面の絵から 切り出したので 色の 補正は しない", all.every((r) => !r.tint));
  // 止まっている しゅんかん（ゆれ 0）は 正面の絵と ほぼ おなじ
  const diffs = {};
  for (const type of ["dolphin", "turtle", "hermit"]) for (const stage of [1, 2, 3]) {
    await ev(`(async()=>{const S=200,mk=(x)=>{const d=document.createElement('div');d.className='cmp-box';d.style.cssText='position:fixed;left:'+x+'px;top:0;width:'+S+'px;height:'+S+'px;background:#fff;z-index:99999';document.body.appendChild(d);return d;};
      const a=mk(0);a.innerHTML=BCT.art.render({type:'${type}',stage:${stage},motion:false});a.firstElementChild.style.cssText='width:100%;height:100%';
      const b=mk(S);const cfg=JSON.parse(JSON.stringify(BCT.petRigConfig('${type}',${stage})));for(const p of Object.values(cfg.parts))if(p.swing)p.swing.amp=0;cfg.bob=null;if(cfg.head)cfg.head.amp=0;
      const r=BCT.petRig.create({cfg,type:'${type}',stage:${stage},host:b,track:b,owner:b});await r.ready;BCT.petRig.setActive(r,false);b.classList.add('rig-on');BCT.petRig.poseAt(r,0,0);
      window.__cmpRig=r;await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));return true})()`);
    const img = await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 400, height: 200, scale: 1 } });
    diffs[`${type}-${stage}`] = await ev(`(async()=>{const im=new Image();im.src='data:image/png;base64,${img.data}';await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);
      const W=c.width,H=c.height,h=W/2;const d=g.getImageData(0,0,W,H).data;let s=0,n=0;for(let y=0;y<H;y++)for(let x=0;x<h;x++){const k=(y*W+x)*4,q=(y*W+x+h)*4;const e=Math.abs(d[k]-d[q])+Math.abs(d[k+1]-d[q+1])+Math.abs(d[k+2]-d[q+2]);if(d[k]+d[k+1]+d[k+2]<750||d[q]+d[q+1]+d[q+2]<750){s+=e;n++;}}
      BCT.petRig.destroy(window.__cmpRig);document.querySelectorAll('.cmp-box').forEach(e=>e.remove());return +(s/Math.max(1,n)/3).toFixed(1)})()`);
  }
  check("止まっている ときは 正面の絵と ほぼ おなじ（3種類 × 3段階）", Object.values(diffs).every((v) => v < 12), JSON.stringify(diffs));
  check("ウミガメは 頭の 層が あり、帽子は 頭に 付く", all.filter((r) => r.key.startsWith("turtle")).every((r) => r.head && r.headItem));
  check("イルカ・ヤドカリの 帽子は 胴体に 付く", all.filter((r) => !r.key.startsWith("turtle")).every((r) => !r.head && r.headItem));
  check("ヤドカリは 歩幅に 合わせて 胴体が 上下", /translateY\(-[\d.]+px\)/.test(all.find((r) => r.key === "hermit-1").bob || ""), all.find((r) => r.key === "hermit-1").bob);

  // 画像が 読めないとき → 正面の絵の まま
  const fallback = await ev(`(async()=>{const keep=BCT.petRigFile;BCT.petRigFile=()=>'assets/pet-parts/ないファイル.png';
    const host=document.createElement('div');document.body.appendChild(host);
    const r=BCT.petRig.create({type:'turtle',stage:1,host,track:host,owner:host});BCT.petRig.setActive(r,true);
    const ok=await r.ready;BCT.petRigFile=keep;const on=host.classList.contains('rig-on');BCT.petRig.destroy(r);host.remove();return {ok,on}})()`);
  check("パーツが 読めないときは 正面の絵の まま", fallback.ok === false && fallback.on === false);
  await ev(`BCT.petRig.destroy(window.__rig); document.getElementById('rigTest').remove(); true`);

  // ---------------- すみか：移動している あいだだけ パーツ ----------------
  await ev(`BCT.ui.show('habitat'); true`);
  await sleep(700);
  check("すみか：はじめは 正面の絵", !(await ev(`document.getElementById('hbPet').classList.contains('rig-on')`)) && (await ev(shown("#hbPetBody"))));
  check("すみか：移動を はじめると パーツ", await waitFor(`document.getElementById('hbPet').classList.contains('rig-on')`, 4000));
  check("すみか：向きを かえると すぐ 反転（ラグなし）", await flipNow("hbPet", "hbPetFace"));
  await sleep(500);
  await shot("pet-rig-habitat");
  check("すみか：止まると 正面の絵に もどる", await waitFor(`!document.getElementById('hbPet').classList.contains('rig-on')`, 3000) && (await ev(shown("#hbPetBody"))));

  // 圏外でも 出せるように、自分の 種類の パーツは 保存される（Service Worker）
  check("自分の 種類の パーツ（ほかの 段階も）が 保存される",
    await waitFor(`caches.keys().then(ks=>Promise.all(ks.map(k=>caches.open(k).then(c=>c.match('assets/pet-cut/dolphin-3-tail-fluke.png'))))).then(rs=>rs.some(Boolean))`, 8000));

  // ---------------- 小さい スマホ：ホームは 画面に おさまり、はねても 頭が 池から はみださない ----------------
  // 頭の 位置は 正面の絵の「色の ついた ところ」で はかる（透明な よはくを ふくめた 四角で はかると 大きく 出るため）
  const jumpGap = () => ev(`void (async()=>{const pet=document.getElementById('pet'),pond=document.getElementById('pond');let gap=1e9;const boxes={};
    async function alphaBox(id){if(boxes[id])return boxes[id];const sp=BCT.PET_SPRITES[id];const im=new Image();im.src=sp.src;await im.decode();
      const c=document.createElement('canvas');c.width=sp.width;c.height=sp.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
      let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<c.height;y++)for(let i=0;i<c.width;i++){if(d[(y*c.width+i)*4+3]>40){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;if(y>y1)y1=y;}}
      return boxes[id]={x0,y0,x1,y1,W:sp.width,H:sp.height};}
    async function m(){const p=pond.getBoundingClientRect();
      const im=document.querySelector('#petBody svg image[data-sprite]');
      if(im&&getComputedStyle(document.getElementById('petBody')).display!=='none'){const bx=await alphaBox(im.dataset.sprite);
        const X=+im.getAttribute('x'),Y=+im.getAttribute('y'),W=+im.getAttribute('width'),H=+im.getAttribute('height');const k=Math.min(W/bx.W,H/bx.H),ox=X+(W-bx.W*k)/2,oy=Y+H-bx.H*k,mt=im.getScreenCTM();
        for(const [u,v] of [[bx.x0,bx.y0],[bx.x1,bx.y0],[bx.x0,bx.y1],[bx.x1,bx.y1]]){const q=new DOMPoint(ox+u*k,oy+v*k).matrixTransform(mt);gap=Math.min(gap,q.y-p.top,q.x-p.left,p.right-q.x);}}
      else for(const e of document.querySelectorAll('#pet .pet-rig .pr-img')){if(!e.getClientRects().length)continue;const q=e.getBoundingClientRect();gap=Math.min(gap,q.top-p.top,q.left-p.left,p.right-q.right);}}
    try{let t=performance.now();while(performance.now()-t<3000){await new Promise(r=>requestAnimationFrame(r));await m();}
    pet.click();t=performance.now();while(performance.now()-t<2500){await new Promise(r=>requestAnimationFrame(r));await m();}
    window.__gap=Math.round(gap);}catch(e){window.__gap='エラー '+e.message;}})(); true`);
  for (const [w, h] of [[360, 640], [390, 844]]) {
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await ev(`localStorage.clear(); BCT.game.choosePet('dolphin','テスト','テスト',1); BCT.game.claim('quiz','big',{xp:2000,coins:0});
      (()=>{const s=JSON.parse(localStorage.getItem('bct-state'));s.seenLv=99;localStorage.setItem('bct-state',JSON.stringify(s))})(); true`);
    await b.goto(BASE + "index.html", 1200);
    check(`${w}×${h}：ゴミばこが 出ていても ホームは スクロール なしで おさまる`, await ev(`document.scrollingElement.scrollHeight<=window.innerHeight+1 && !document.getElementById('binsWrap').classList.contains('gone')`));
    await ev(`window.__gap=undefined; true`);
    await jumpGap();
    await waitFor(`window.__gap!==undefined`, 15000);
    const gap = await ev(`window.__gap`);
    const size = await ev(`document.getElementById('pet').offsetWidth`);
    // 回転した 四角の 角で はかるので すこし きびしめ（-2px までは 色の ない 角）
    check(`${w}×${h}：イルカ（最終段階）が はねても 頭が 池から はみださない`, typeof gap === "number" && gap >= -2, `池の 縁との すきま ${gap}px・ようせい ${size}px`);
    if (h >= 800) check(`${w}×${h}：ふつうの スマホでは ようせいは 大きめ（140px 以上）`, size >= 140, `${size}px`);
  }

  const errors = b.consoleLogs.filter((l) => /^(error|EXCEPTION)/.test(l));
  check("エラーが 出ない", errors.length === 0, errors.join(" / "));
} finally {
  b.close();
}
const ng = results.filter((l) => l.startsWith("NG"));
console.log(`\n${results.length - ng.length}/${results.length} OK`);
process.exit(ng.length ? 1 : 0);
