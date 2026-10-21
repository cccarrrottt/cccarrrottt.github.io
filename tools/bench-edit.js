/* What one small edit costs, and where it goes.
 *
 * tools/bench.js times rebuildChart on its own. An edit is more than that:
 * applyEdit takes a snapshot for undo, rebuilds, settles the bends and asks
 * whether the chart is dirty. This drives the edits a person actually makes
 * all day — recolour an entry, tag it, retype its note, rename it — on a
 * synthetic chain of N entries, and splits each one by the functions it
 * spends its time in. Medians of five.
 *
 * Every function wrapped here is a top-level declaration in a classic
 * script, so it is a property of the global object and its callers reach it
 * through that property: wrapping it from outside times every call without
 * touching the page's source. Nested calls are counted inside their parent
 * as well as on their own line (routeEdge is part of redrawEdges).
 *
 *     node tools/bench-edit.js        # against dist/, so build first
 */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BENCH_PORT || 8841);
const SIZES = (process.env.BENCH_SIZES || '200,600').split(',').map(Number);
const REPEATS = 5;
const PARTS = (process.env.BENCH_PARTS ? process.env.BENCH_PARTS.split(',') : []).concat(['takeSnapshot', 'buildModel', 'renderNodes', 'redrawEdges', 'routeEdge',
               'buildSideTabs', 'updateStats', 'applyVisibility', 'selectNode', 'refreshSaveUI',
               'dropIgnoredBends', 'ignoredBendRoutes', 'paintSuggestionMarks', 'drawBioCard']);

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url).split('?')[0].replace(/^\/+/, '') || 'nexus.html';
  fs.readFile(path.join(ROOT, 'dist', rel), (e, b) => {
    if (e) { res.statusCode = 404; return res.end('no'); }
    res.setHeader('content-type', rel.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(b);
  });
});

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const PINNED = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(PINNED) ? {executablePath: PINNED} : {});
  const ctx = await browser.newContext({viewport: {width: 1500, height: 950}});
  const page = await ctx.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(`http://127.0.0.1:${PORT}/nexus.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => typeof rebuildChart === 'function');

  const rows = await page.evaluate(({sizes, repeats, parts}) => {
    const spent = {}, calls = {};
    for (const name of parts) {
      const orig = window[name];
      if (typeof orig !== 'function') continue;
      window[name] = function (...a) {
        const t0 = performance.now();
        try { return orig.apply(this, a); }
        finally { spent[name] = (spent[name] || 0) + performance.now() - t0; calls[name] = (calls[name] || 0) + 1; }
      };
    }
    const chartOf = (n) => {
      const list = [];
      for (let i = 0; i < n; i++) {
        list.push(['b' + i, 'Entry number ' + i + (i % 3 === 0 ? '\nwith a second line' : ''),
                   i > 0 ? 'b' + (i - 1) : null, null, null, null, {tags: ['t' + (i % 5)]}]);
      }
      return list;
    };
    const opts = it => { if (!it[6]) it[6] = {}; return it[6]; };
    const EDITS = {
      'recolour an entry': (k) => { opts(workingNodes[7])['colors'] = [k % 2 ? '#cc2222' : '#2222cc']; },
      'tag an entry': (k) => { opts(workingNodes[7]).tags = ['t' + (k % 4), 'extra']; },
      'retype a note': (k) => { workingNodes[7][4] = 'A note, version ' + k; },
      'rename, same width': (k) => { workingNodes[7][1] = 'Entry number ' + (k % 2 ? 'x' : 'y'); },
      'move an entry': (k) => { opts(workingNodes[7]).pos = [100 + (k % 2) * 40, 300]; }
    };
    const out = [];
    for (const n of sizes) {
      workingNodes = chartOf(n);
      rebuildChart();
      for (const [label, edit] of Object.entries(EDITS)) {
        applyEdit(() => edit(99));                      // settle; not measured
        const times = [], per = {};
        for (let k = 0; k < repeats; k++) {
          for (const p of parts) { spent[p] = 0; calls[p] = 0; }
          const t0 = performance.now();
          applyEdit(() => edit(k));
          times.push(performance.now() - t0);
          for (const p of parts) (per[p] = per[p] || []).push(spent[p]);
        }
        const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
        const row = {n, label, total: +med(times).toFixed(1)};
        for (const p of parts) row[p] = +med(per[p]).toFixed(1);
        out.push(row);
      }
      undoStack.length = 0;
    }
    return out;
  }, {sizes: SIZES, repeats: REPEATS, parts: PARTS});

  for (const r of rows) {
    const big = PARTS.filter(p => r[p] >= 0.5 && p !== 'routeEdge').map(p => `${p} ${r[p]}`).join(', ');
    console.log(`${String(r.n).padStart(4)}  ${r.label.padEnd(20)} ${String(r.total + ' ms').padStart(10)}` +
                `   routeEdge ${r.routeEdge} ms   [${big}]`);
  }
  await browser.close();
  srv.close();
})();
