// Render, export and offline coverage for the 18 painted assets; isolated Edge profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch, sleep} from './cdp.mjs';
const base = process.env.BCT_URL || 'http://127.0.0.1:8766/';
const out = 'tests/e2e/out';
fs.mkdirSync(out, {recursive: true});
const b = await launch({port: 12000 + Math.floor(Math.random() * 1000), width: 390, height: 900});
try {
  await b.goto(base);
  for (let i=0; i<100 && !await b.ev(`!!window.BCT?.homeArt && !!window.BCT?.ui`); i++) await sleep(100);
  const art = await b.ev(`(async () => {
    const before = localStorage.getItem('bct-state');
    const ids = [...BCT.ITEMS.filter(it => it.slot === 'home').map(it => it.id), ...BCT.CONFIG.foods.map(it => it.id), ...Object.keys(BCT.HABITATS).map(type => 'habitat_' + type)];
    const results = [];
    for (const id of ids) {
      const bg = id.startsWith('habitat_');
      const markup = bg ? BCT.homeArt.habitatBg(id.slice(8)) : id.startsWith('home_') ? BCT.art.itemIcon(id) : BCT.homeArt.dropSvg(id);
      if (!markup.includes('data-art-id="' + id + '"')) throw new Error('Missing painted art: ' + id);
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup); await img.decode();
      const c = document.createElement('canvas'); c.width = 100; c.height = bg ? 75 : 100;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let filled = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 32) filled++;
      if (filled < 500) throw new Error('Blank art: ' + id);
      if (!bg && data[3] !== 0) throw new Error('Sprite background is not transparent: ' + id);
      results.push({id, filled});
    }
    if (before !== localStorage.getItem('bct-state')) throw new Error('Drawing mutated saved state');
    return results;
  })()`);
  assert.equal(art.length, 18);

  for (const type of ['dolphin', 'turtle', 'hermit']) {
    await b.ev(`BCT.game.choosePet('${type}', 'ようせい', 'テスト', 1); BCT.game.claim('quiz', 'art-test-${type}', {xp:0, coins:1000});`);
    await b.goto(base);
    await b.ev(`BCT.ui.show('shop', 'home')`);
    await sleep(150);
    assert.equal(await b.ev(`document.querySelectorAll('#shopBody image[data-art-id^="home_${type}_"]').length`), 3);
    await b.shot(out + '/painted-shop-' + type + '.png');
    await b.ev(`(() => {
      const items = BCT.ITEMS.filter(it => it.slot === 'home' && it.only === '${type}');
      items.forEach((it,i) => { BCT.game.buy(it.id); BCT.game.placeHome(it.id, [.24,.71,.78][i], [.66,.85,.51][i]); });
      BCT.ui.show('habitat');
    })()`);
    await sleep(200);
    assert.equal(await b.ev(`document.querySelectorAll('#hbItems image[data-art-id]').length`), 3);
    assert.equal(await b.ev(`document.querySelector('#hbBg image').dataset.artId`), 'habitat_' + type);
    await b.shot(out + '/painted-habitat-' + type + '.png');
  }
  await b.ev(`BCT.ui.show('shop','food')`);
  await sleep(200);
  await b.shot(out + '/painted-food.png');
  await b.ev(`navigator.serviceWorker.ready`);
  assert.equal(await b.ev(`(async () => { for (const key of await caches.keys()) { if (!key.startsWith('bct-')) continue; const cache = await caches.open(key); if ((await cache.match('js/habitat-sprites.js')) && (await cache.match('js/habitat-painted-art.js'))) return true; } return false; })()`), true);
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:0, uploadThroughput:0});
  await b.goto(base);
  assert.equal(await b.ev(`Object.keys(BCT.HABITAT_SPRITES).length`), 18);
  await b.ev(`BCT.ui.show('habitat')`);
  assert.equal(await b.ev(`document.querySelector('#hbBg image').dataset.artId`), 'habitat_hermit');
  await b.send('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1});

  const beforeGallery = await b.ev(`localStorage.getItem('bct-state')`);
  await b.goto(base + 'preview-habitats.html');
  assert.equal(await b.ev(`localStorage.getItem('bct-state')`), beforeGallery);
  assert.equal(await b.ev(`[...document.images].every(i => i.complete && i.naturalWidth > 0)`), true);
  for (const width of [360, 768, 1440]) {
    await b.send('Emulation.setDeviceMetricsOverride', {width, height:1200, deviceScaleFactor:1, mobile:width<900});
    await sleep(150);
    assert.equal(await b.ev(`document.documentElement.scrollWidth <= innerWidth`), true);
    await b.shot(out + '/habitat-gallery-' + width + '.png');
  }
  await b.ev(`document.getElementById('furniture').click()`);
  assert.equal(await b.ev(`[...document.querySelectorAll('.furniture')].every(e => getComputedStyle(e).display === 'none')`), true);
  const errors = b.consoleLogs.filter(l => /^(error|EXCEPTION)/.test(l));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({paintedAssets:art.length, species:3, svgExport:'passed', transparency:'passed', offline:'passed', galleryWidths:[360,768,1440], galleryStorage:'unchanged', errors}));
} finally { b.close(); }
