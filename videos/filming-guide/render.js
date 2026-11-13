// Usage: node render.js <outDir> [fps] [duration] [t1,t2,...]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [out, fps = 30, dur = 10, only] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, process.env.SCENE || 'guide.html'));
  await p.evaluate(() => document.fonts.ready);
  const times = only ? only.split(',').map(Number) : [...Array(Math.round(dur * fps)).keys()].map(i => i / fps);
  for (let i = 0; i < times.length; i++) {
    await p.evaluate(t => render(t), times[i]);
    await p.screenshot({ path: `${out}/f${String(i + (+process.env.OFFSET || 0)).padStart(4, '0')}.png` });
  }
  await b.close();
})();
