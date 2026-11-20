/* What a phone waits for before the chart answers, on a chart of real size.
 *
 * The figures in CLAUDE.md for opening the page were taken on the owner's
 * chart of forty-odd entries, where start-up cost about the same in every
 * part of it and nothing stood out. A chart of the size this one is meant
 * to grow to is another question, so this asks it: a synthetic chart of N
 * entries, laid out as lineages that merge, carry tags, notes and several
 * lines of text — and the page opened as a phone opens it, 390×844 with
 * the processor slowed four times.
 *
 * It reports when the first entry is on screen, when the program has done
 * everything it does at start-up (the first moment the page is idle), and
 * where the time between went, by function, from a CPU profile: the time
 * spent inside each of the functions start-up is made of, counted once
 * however deep it recurses.
 *
 *     node tools/bench-boot.js            # against dist/, so build first
 *     node tools/bench-boot.js 200 600    # other sizes
 */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BENCH_PORT || 8845);
const SIZES = process.argv.slice(2).map(Number).filter(n => n > 0);
const REPEATS = 3;
// The functions start-up is made of, as the profile names them.
const WATCH = ['buildModel', 'rebuildChart', 'renderNodes', 'redrawEdges', 'buildSideTabs', 'applyVisibility',
               'buildTextView', 'renderVersionInfo', 'drawMinimap', 'paintMinimap', 'updateStats', 'measureTextBlock'];

/* A chart of n entries: lineages of ten, side by side, every eighth entry
   a merge of its own lineage and the one beside it, with tags, a second
   line now and then, and a note on some connectors. */
function chartOf(n){
  const nodes = [], styles = [];
  const COLS = Math.ceil(n / 10);
  for(let i = 0; i < n; i++){
    const col = Math.floor(i / 10), row = i % 10;
    const id = 'e' + i;
    const rec = {id, label: `Entry ${i}` + (i % 3 === 0 ? '\nA second line, longer' : ''),
                 pos: [col * 220 - COLS * 110, row * 120 - 600], tags: ['tag ' + (i % 12)]};
    if(row > 0) rec.parent = 'e' + (i - 1);
    if(row > 1 && i % 8 === 0 && col + 1 < COLS){
      rec.parent = ['e' + (i - 1), 'e' + (i + 9)];
      rec.merge = true;
    }
    if(i % 5 === 0) rec.colors = ['#c22'];
    nodes.push(rec);
    if(row > 0 && i % 6 === 0) styles.push({from: 'e' + (i - 1), to: id, routing: 'orthogonal', dash: 'solid', arrow: true, note: 'note ' + i});
  }
  return {format: 4, nodes, edgeStyles: styles, settings: {}};
}

function pageWith(chart){
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'nexus.html'), 'utf8');
  const text = JSON.stringify(chart).replace(/</g, '\\u003c');
  return html.replace(/(<script type="application\/json" id="chart-data">\n)[\s\S]*?(\n<\/script>)/, (_, a, b) => a + text + b);
}

/* Inclusive time per watched function from a CPU profile, counted at the
   outermost call so a function that calls itself is not counted twice. */
function timeIn(profile){
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, k) => self.set(id, (self.get(id) || 0) + (dt[k + 1] || 0)));
  const out = {};
  const walk = (id, inside) => {
    const node = byId.get(id);
    const name = node.callFrame.functionName;
    const watched = WATCH.includes(name) && !inside.has(name);
    const under = watched ? new Set([...inside, name]) : inside;
    let total = self.get(id) || 0;
    for(const c of node.children || []) total += walk(c, under);
    if(watched) out[name] = (out[name] || 0) + total;
    return total;
  };
  walk(profile.nodes[0].id, new Set());
  for(const k of Object.keys(out)) out[k] = Math.round(out[k] / 1000);
  return out;
}

(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    if(rel === '' || rel === 'nexus.html'){ r.setHeader('content-type', 'text/html; charset=utf-8'); return r.end(srv.page); }
    fs.readFile(path.join(ROOT, 'dist', rel), (e, b) => { if(e){ r.statusCode = 404; return r.end(); } r.end(b); });
  });
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch();
  for(const n of SIZES.length ? SIZES : [41, 200, 400]){
    srv.page = pageWith(chartOf(n));
    const runs = [];
    for(let k = 0; k < REPEATS; k++){
      const ctx = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
      await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
      await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', {interval: 200});
      await cdp.send('Profiler.start');
      await page.addInitScript(() => {
        new MutationObserver((_, o) => {
          if(document.querySelector('#nodeLayer .node')){ window.__drawn = performance.now(); o.disconnect(); }
        }).observe(document, {subtree: true, childList: true});
      });
      await page.goto(`http://127.0.0.1:${PORT}/nexus.html`, {waitUntil: 'load'});
      const t = await page.evaluate(() => new Promise(res => {
        // Idle: the first moment nothing of start-up is left to run.
        const done = () => res({drawn: window.__drawn, idle: performance.now()});
        (window.requestIdleCallback || (f => setTimeout(f, 50)))(done, {timeout: 20000});
      }));
      const {profile} = await cdp.send('Profiler.stop');
      runs.push({drawn: t.drawn, idle: t.idle, fns: timeIn(profile)});
      await ctx.close();
    }
    const med = f => { const v = runs.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    console.log(`\n${n} entries — phone, CPU ×4, median of ${REPEATS}`);
    console.log(`  first entry on screen   ${Math.round(med(r => r.drawn))} ms`);
    console.log(`  start-up done (idle)    ${Math.round(med(r => r.idle))} ms`);
    const names = [...new Set(runs.flatMap(r => Object.keys(r.fns)))]
      .map(k => [k, med(r => r.fns[k] || 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    for(const [k, v] of names) console.log(`  ${k.padEnd(22)} ${String(v).padStart(6)} ms`);
  }
  await browser.close();
  srv.close();
})();
