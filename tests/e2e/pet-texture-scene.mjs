import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';

fs.mkdirSync('tests/e2e/out', { recursive: true });
const browser = await launch({ port: 16500 + Math.floor(Math.random() * 300), width: 1280, height: 1000, mobile: false, args: ['--enable-unsafe-swiftshader'] });
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.goto('http://127.0.0.1:8766/pet-texture-demo.html', 500);
  await browser.ev('petTextureDemo.ready');
  const storage = await browser.ev('JSON.stringify(localStorage)');
  assert.equal(await browser.ev('petTextureDemo.getState().ready'), true);
  await sleep(200);
  await browser.shot('tests/e2e/out/texture-front.png');
  await browser.ev('petTextureDemo.setFloating(false)');
  let verifiedViews = 0;
  for (const type of ['dolphin', 'turtle', 'hermit']) for (const stage of [1, 2, 3]) {
    await browser.ev(`petTextureDemo.setPet('${type}',${stage})`);
    const images = [];
    for (const [angle, view] of [[0, 'front'], [90, 'side'], [180, 'back']]) {
      await browser.ev(`petTextureDemo.setAngle(${angle},{immediate:true})`); await sleep(100);
      const state = await browser.ev('petTextureDemo.getState()');
      assert.equal(state.type, type); assert.equal(state.stage, stage); assert.equal(state.view, view);
      assert.ok(state.scale.every(n => n > 0)); assert.equal(state.blend, 1);
      images.push(await browser.ev('petTextureDemo.canvas.toDataURL()'));
      if (stage === 3) await browser.shot(`tests/e2e/out/texture-${type}-${view}.png`);
      verifiedViews++;
    }
    assert.equal(new Set(images).size, 3, `${type}-${stage}: three distinct views`);
  }
  // Rapid async switching must display the latest choice, not the first response.
  await browser.ev(`Promise.all([petTextureDemo.setPet('dolphin',1),petTextureDemo.setPet('turtle',2),petTextureDemo.setPet('hermit',3)])`);
  assert.equal(await browser.ev('petTextureDemo.getState().type'), 'hermit');
  // No persistent double-exposed face when stopped between captured directions.
  await browser.ev('petTextureDemo.setAngle(46)'); await sleep(550);
  assert.equal(await browser.ev('petTextureDemo.getState().blend'), 1);
  await browser.ev('petTextureDemo.setAngle(0,{immediate:true});petTextureDemo.setSpeed(1.8);petTextureDemo.setAutoRotate(true)');
  await sleep(1700);
  assert.ok(await browser.ev('petTextureDemo.getState().angle > 50'));
  await browser.ev('petTextureDemo.setAutoRotate(false);petTextureDemo.setFloating(false)');
  const resting = await browser.ev('petTextureDemo.getState().height');
  await browser.ev('petTextureDemo.lift()'); await sleep(130);
  assert.ok(await browser.ev('petTextureDemo.getState().height') > resting + .1, 'tap lifts the artwork');
  // UI controls, including pointer drag and keyboard, exercise the public scene.
  await browser.ev(`document.querySelector('[data-angle="180"]').click()`); await sleep(700);
  assert.ok(await browser.ev('petTextureDemo.getState().angle>178'));
  await browser.ev(`petTextureDemo.canvas.focus()`);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home' });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home' });
  await sleep(650); assert.ok(await browser.ev('petTextureDemo.getState().angle<2'));
  const rect = await browser.ev(`(()=>{const r=petTextureDemo.canvas.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  const x = rect.x + rect.w * .3, y = rect.y + rect.h * .45;
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 230, y, button: 'left', buttons: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 230, y, button: 'left', clickCount: 1 });
  await sleep(500); assert.ok(await browser.ev('petTextureDemo.getState().angle>45'));
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(100); assert.equal(await browser.ev('petTextureDemo.getState().floating'), false);
  assert.equal(await browser.ev('petTextureDemo.getState().autoRotate'), false);
  for (const width of [360, 768, 1280]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await sleep(150); assert.ok(await browser.ev('document.documentElement.scrollWidth<=innerWidth'), `${width}px: no overflow`);
    await browser.ev('petTextureDemo.reset()'); await sleep(150);
    if (width === 360) await browser.shot('tests/e2e/out/texture-mobile.png');
  }
  assert.equal(await browser.ev('JSON.stringify(localStorage)'), storage);
  const errors = browser.consoleLogs.filter(s => /^(error|EXCEPTION)/.test(s)); assert.deepEqual(errors, []);
  const textureCount = await browser.ev('petTextureDemo.getState().textureCount');
  assert.equal(textureCount, 27);
  await browser.ev('petTextureDemo.dispose();petTextureDemo.dispose()');
  assert.equal(await browser.ev(`document.querySelectorAll('#pet-scene canvas').length`), 0);
  assert.equal(await browser.ev('petTextureDemo.getState().textureCount'), 0);
  console.log(JSON.stringify({ verifiedViews, interaction: 'passed', rapidSwitch: 'passed', responsiveWidths: [360, 768, 1280], reducedMotion: 'passed', storage: 'unchanged', cleanup: 'passed', errors }));
} finally { browser.close(); }
