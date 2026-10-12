import {launch,sleep} from '../tests/e2e/cdp.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const b=await launch({port:12129,width:1160,height:720,mobile:false});
try{
  await b.goto('http://127.0.0.1:8766/preview-home-shortcuts.html');
  await b.ev(`Promise.all([...document.images].map(im=>im.decode()))`);
  await b.ev(`document.querySelectorAll('.hero').forEach(el=>el.style.animationPlayState='paused');true`);
  fs.mkdirSync('assets/design-previews',{recursive:true});
  await b.shot('assets/design-previews/home-shortcuts-top-left.png');
  for(const width of [1160,320]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===320});
    for(const stage of [1,2,3]){
      await b.ev(`document.getElementById('stage').value='${stage}';render();true`);await sleep(100);
      assert.ok(await b.ev(`[...document.querySelectorAll('article')].every(a=>{const d=a.querySelector('.dock').getBoundingClientRect(),p=a.querySelector('.pet-zone').getBoundingClientRect(),h=a.querySelector('.hero').getBoundingClientRect();return d.bottom+12<p.top&&h.top>=p.top&&h.bottom<=p.bottom&&h.left>=p.left&&h.right<=p.right;})`));
      assert.ok(await b.ev(`document.documentElement.scrollWidth<=innerWidth`));
    }
  }
  assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
  console.log('Preview checked: 3 characters, 3 stages, desktop and 320px; no icon/character overlap.');
}finally{b.close();}
