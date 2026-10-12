import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const b=await launch({port:12071,width:360,height:950});
const out='tests/e2e/out';fs.mkdirSync(out,{recursive:true});
const noOverflow=async()=>assert.ok(await b.ev(`document.documentElement.scrollWidth<=innerWidth`),'horizontal overflow');
try{
 await b.goto(base);
 await b.ev(`BCT.game.choosePet('dolphin','テスト','たんけんたい',1);BCT.ui.show('home');true`);
 assert.equal(await b.ev(`document.querySelectorAll('.tabs [data-ui-icon]').length`),4);
 assert.ok(await b.ev(`getComputedStyle(document.querySelector('#pond')).backgroundImage.includes('assets/ui/beach.webp')`));
 assert.equal(await b.ev(`getComputedStyle(document.querySelector('#pond'),'::before').content`),'none');
 assert.equal(await b.ev(`getComputedStyle(document.querySelector('#pond'),'::after').content`),'none');
 await b.ev(`BCT.store.transact(s=>{s.beach.dirt=[];s.beach.last=Date.now();});BCT.beach.render();true`);
 assert.ok(await b.ev(`!!document.querySelector('#beachStatus [data-ui-icon="sparkling"]')`));
 await noOverflow();await b.shot(out+'/ui-home-clean.png');
 await b.ev(`BCT.store.transact(s=>{s.beach.dirt=[{id:'test',kind:'b_bottle',x:.2,y:.7}];});BCT.beach.render();true`);
 assert.ok(await b.ev(`!!document.querySelector('#beachStatus [data-ui-icon="dirty"]')`));
 for(const screen of ['mission','shop','dress','me']){
   await b.ev(`BCT.ui.show('${screen}');true`);await noOverflow();
   await sleep(150);
   assert.ok(await b.ev(`(()=>{const r=document.querySelector('.tabs').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;})()`),'tabs visible');
   assert.ok(await b.ev(`[...document.querySelectorAll('.screen.active button')].every(el=>el.getBoundingClientRect().right<=innerWidth+1)`),'buttons fit');
   assert.equal(await b.ev(`document.querySelector('.screen.active').innerText.includes('ポイント')`),false);
   assert.equal(await b.ev(`document.querySelector('.screen.active').innerText.includes('🪙')`),false);
   await b.shot(out+'/ui-'+screen+'.png');
 }
 assert.equal(await b.ev(`document.querySelectorAll('#meBody .painted-found .clean-art image').length`),8);
 await b.ev(`BCT.ui.show('shop');true`);
 assert.equal(await b.ev(`document.querySelectorAll('#shopBody [data-cat] [data-ui-icon]').length`),7);
 assert.ok(await b.ev(`document.querySelector('#shopBody .medal-wallet .medal-icon').getBoundingClientRect().width>=85`));
 const before=await b.ev(`BCT.game.coins(BCT.store.get())`);
 await b.ev(`BCT.game.claim('quiz',BCT.QUIZ[0].id,BCT.CONFIG.reward.quiz);BCT.ui.refreshHeader();BCT.ui.show('shop','food');true`);
 const awarded=await b.ev(`BCT.game.coins(BCT.store.get())`);assert.equal(awarded-before,20);
 await b.ev(`document.querySelector('[data-buy-food="drop_blue"]').click();true`);
 assert.equal(await b.ev(`BCT.game.coins(BCT.store.get())`),awarded-10);
 assert.equal(await b.ev(`document.querySelector('.medal-wallet-value b').textContent`),String(awarded-10));
 assert.equal(await b.ev(`document.querySelector('#tbCoin b').textContent`),String(awarded-10));
 await b.ev(`BCT.ui.show('shop','head');document.querySelector('[data-item="head_straw"]').click();true`);
 await sleep(150);
 assert.equal(await b.ev(`document.querySelectorAll('#modalBox .btn [data-ui-icon="coin"]').length`),1);
 await b.ev(`BCT.ui.closeModal();true`);
 // A long saved balance still fits both the header and prominent wallet.
 await b.ev(`document.querySelector('#tbCoin').innerHTML=BCT.medal.amount(1234567);BCT.ui.show('shop');document.querySelector('.medal-wallet').outerHTML=BCT.medal.wallet(1234567);true`);
 await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:950,deviceScaleFactor:1,mobile:true});await noOverflow();await b.shot(out+'/ui-small-balance.png');
 await b.ev(`BCT.ui.refreshHeader();true`);
 for(let i=0;i<80&&!await b.ev(`!!navigator.serviceWorker.controller`);i++)await sleep(150);
 assert.ok(await b.ev(`(async()=>{const c=await caches.open((await caches.keys()).find(n=>n.startsWith('bct-')));return !!await c.match('assets/ui/medal.webp')&&!!await c.match('assets/ui/beach.webp')&&!!await c.match('js/ui-design.js');})()`));
 await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await b.goto(base);await b.ev(`BCT.ui.show('shop');true`);
 assert.ok(await b.ev(`(async()=>{await Promise.all([...document.querySelectorAll('img.medal-icon')].map(im=>im.decode()));const im=new Image();im.src='assets/ui/beach.webp';await im.decode();return im.naturalWidth>0;})()`));
 await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await b.goto(base+'preview-ui-design.html');await b.send('Emulation.setDeviceMetricsOverride',{width:900,height:1350,deviceScaleFactor:1,mobile:false});await sleep(150);await b.shot(out+'/ui-design-gallery.png');
 assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION:')||x.startsWith('error:')),[]);
 console.log('PASS: icons, clean/dirty, text-free home, medal earnings/purchase/header, 320px layout, offline assets.');
}finally{b.close();}
