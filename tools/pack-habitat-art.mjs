// Preserve generated pixels/alpha; trim transparent margins, resize and encode for offline use.
// Run with the app served locally: node tools/pack-habitat-art.mjs
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const base = process.env.BCT_URL || 'http://127.0.0.1:8766/';
const {assets: entries} = JSON.parse(fs.readFileSync('assets/art-source/habitats/generation-record.json', 'utf8'));
const browser = await launch({port: 11000 + Math.floor(Math.random() * 1000)});
try {
  await browser.goto(base);
  const assets = {};
  fs.mkdirSync('assets/habitats', {recursive: true});
  for (const entry of entries) {
    const result = await browser.ev(`(async () => {
      const entry = ${JSON.stringify(entry)};
      const img = new Image(); img.src = entry.file; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      let left = 0, top = 0, width = c.width, height = c.height;
      if (!entry.background) {
        const data = g.getImageData(0, 0, c.width, c.height).data;
        let l = c.width, t = c.height, r = -1, b = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] > 8) { l = Math.min(l,x); t = Math.min(t,y); r = Math.max(r,x); b = Math.max(b,y); }
        }
        if (r < l || b < t) throw new Error('Empty sprite: ' + entry.id);
        left = Math.max(0, l - 3); top = Math.max(0, t - 3);
        width = Math.min(c.width, r + 4) - left; height = Math.min(c.height, b + 4) - top;
      }
      const out = document.createElement('canvas');
      out.width = entry.background ? 1200 : 512; out.height = entry.background ? 900 : 512;
      const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
      const scale = Math.min((out.width - (entry.background ? 0 : 24)) / width, (out.height - (entry.background ? 0 : 24)) / height);
      const dw = width * scale, dh = height * scale;
      og.drawImage(c, left, top, width, height, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh);
      return {width: out.width, height: out.height, src: out.toDataURL('image/webp', entry.background ? .9 : .94)};
    })()`);
    const file = `assets/habitats/${entry.id}.webp`;
    fs.writeFileSync(file, Buffer.from(result.src.split(',')[1], 'base64'));
    assets[entry.id] = {...result, file};
    console.log(`${entry.id}: ${result.width}x${result.height}, ${fs.statSync(file).size} bytes`);
  }
  fs.writeFileSync('js/habitat-sprites.js', '/* Generated art bundle. Rebuild: node tools/pack-habitat-art.mjs */\nwindow.BCT = window.BCT || {};\nwindow.BCT.HABITAT_SPRITES = ' + JSON.stringify(assets) + ';\n');
  console.log(`Packed ${entries.length} assets, ${fs.statSync('js/habitat-sprites.js').size} bytes`);
} finally { browser.close(); }
