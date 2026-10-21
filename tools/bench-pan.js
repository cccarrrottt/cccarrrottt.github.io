/* What a frame of panning costs, and what it is spent on.
 *
 * Drives dist/nexus.html in a real browser, replaces the chart with a
 * synthetic chain of N entries, and pans across it one animation frame at
 * a time — the way a drag does — timing the frames. Chromium is started
 * without its frame-rate cap, so a frame takes as long as its work and not
 * a sixtieth of a second.
 *
 * Three rows per size, the same chart in the same window:
 *
 *   as built      the page as it is.
 *   coord free    the coordinates box laid out by its text, as it was
 *                 before showCoord (18-canvas-gestures.js): every frame
 *                 then laid out the page, and the whole drawing with it.
 *   + culled      as built, and everything more than 300px off screen
 *                 also taken out of the drawing (display:none), in the
 *                 bench — the page does not do it. This is the row that
 *                 says whether culling is worth building.
 *
 *     node tools/bench-pan.js           # against dist/, so build first
 *     BENCH_SIZES=200,600 node tools/bench-pan.js
 *
 * Headless and with no GPU: the comparison between rows is what counts.
 */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SIZES = (process.env.BENCH_SIZES || '200,600').split(',').map(Number);
const FRAMES = 120, RUNS = 3;
const MODES = ['as built', 'coord free', '+ culled'];

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url).split('?')[0].replace(/^\/+/, '') || 'nexus.html';
  fs.readFile(path.join(ROOT, 'dist', rel), (e, b) => {
    if(e){ res.statusCode = 404; return res.end('no'); }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(b);
  });
});

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const PINNED = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(Object.assign(fs.existsSync(PINNED) ? {executablePath: PINNED} : {},
    {args: ['--disable-gpu-vsync', '--disable-frame-rate-limit']}));
  const page = await (await browser.newContext({viewport: {width: 1500, height: 950}})).newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${srv.address().port}/nexus.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => typeof rebuildChart === 'function');

  console.log('entries  ' + 'row'.padEnd(12) + 'frame (median)   frame (p90)');
  for(const n of SIZES){
    await page.evaluate(n => {
      const list = [];
      for(let i = 0; i < n; i++){
        list.push(['b' + i, 'Entry number ' + i + (i % 3 === 0 ? '\nwith a second line' : ''),
                   i > 0 ? 'b' + (i - 1 - (i % 7 === 0 ? Math.min(i - 1, 3) : 0)) : null,
                   null, null, null, {tags: ['t' + (i % 5)], colors: i % 4 ? null : ['#2f6fb5', '#c23b22']}]);
      }
      workingNodes = list;
      rebuildChart();
    }, n);
    const rows = {};
    for(let run = 0; run < RUNS; run++){
      for(const mode of MODES){
        const gaps = await page.evaluate(async ({frames, mode}) => {
          let st = document.getElementById('benchStyle');
          if(!st){ st = document.createElement('style'); st.id = 'benchStyle'; document.head.appendChild(st); }
          st.textContent = mode === 'coord free' ? '.coord{contain:none !important;width:auto !important;height:auto !important}'
                         : mode === '+ culled' ? '.bench-culled{display:none !important}' : '';
          // Every drawn thing, with where it stands on the chart.
          const boxes = new Map();
          if(mode === '+ culled'){
            ['nodeLayer', 'edgeLayer', 'arrowLayer', 'auraLayer', 'backLayer', 'frontLayer', 'arrayLayer']
              .forEach(id => [...document.getElementById(id).children].forEach(e => { try{ boxes.set(e, e.getBBox()); }catch(x){} }));
          }
          const cull = () => {
            const r = svgSize(), pad = 300;
            const x0 = (-vx - pad) / vs, y0 = (-vy - pad) / vs, x1 = (r.width - vx + pad) / vs, y1 = (r.height - vy + pad) / vs;
            boxes.forEach((b, e) => e.classList.toggle('bench-culled', b.x > x1 || b.y > y1 || b.x + b.width < x0 || b.y + b.height < y0));
          };
          // Near enough to read, a third of the way down the chain.
          const b = computeBounds();
          centreViewOn((b.minX + b.maxX) / 2, b.minY + (b.maxY - b.minY) / 3, 1);
          await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
          const out = [];
          let last = performance.now();
          for(let f = 0; f < frames; f++){
            vy -= 9;
            applyTransform();
            if(boxes.size) cull();
            await new Promise(res => requestAnimationFrame(res));
            const now = performance.now();
            out.push(now - last);
            last = now;
          }
          document.querySelectorAll('.bench-culled').forEach(e => e.classList.remove('bench-culled'));
          st.textContent = '';
          return out.slice(10);
        }, {frames: FRAMES, mode});
        (rows[mode] = rows[mode] || []).push(...gaps);
      }
    }
    for(const mode of MODES){
      const t = rows[mode].sort((a, b) => a - b);
      const at = q => t[Math.min(t.length - 1, Math.floor(t.length * q))].toFixed(1);
      console.log(String(n).padStart(7) + '  ' + mode.padEnd(12) + String(at(0.5) + ' ms').padStart(14) + String(at(0.9) + ' ms').padStart(14));
    }
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
