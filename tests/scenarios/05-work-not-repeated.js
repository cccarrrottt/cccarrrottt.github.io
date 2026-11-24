/* tests/scenarios/05-work-not-repeated.js — scenarios 104 to 112 of the suite.
 *
 * What the program does not do twice: the router asks only what a line or a
 * leg can meet, an edit that moves nothing re-routes nothing, entries and
 * connectors drawn as they were keep their drawing, controls built when
 * reached. With the site's first drawing and entries written with their fields
 * named, which came in the same days.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */
  await scenario("the router asks only the lines a segment can share", async () => {
  /* scorePath looks the routed segments up by the line they stand on
     and the stretch of it they cover (routedNear) instead of walking all of
     them. Routing is order-sensitive
     and every connector steers round the ones before it, so the only
     acceptable answer is the same picture: every route on a crowded chart
     drawn both ways, compared point for point. */
  const eq = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const linear = function(pts, obstacles){
      let score = pathLength(pts) + countBends(pts)*PENALTY_BEND;
      for(let i = 0; i < pts.length-1; i++){
        const a = pts[i], b = pts[i+1];
        for(const rect of obstacles){ if(segIntersectsRect(a.x, a.y, b.x, b.y, rect)) score += PENALTY_NODE; }
        const seg = {x1:a.x, y1:a.y, x2:b.x, y2:b.y};
        for(const other of routedSegments){ if(segmentsOverlap(seg, other) > 8) score += PENALTY_OVERLAP; }
      }
      return score;
    };
    const snap = ()=>{ const m = {}; drawnRoutes.forEach((r, k)=>{ m[k] = JSON.stringify((r.pts || []).map(q=> [+q.x.toFixed(3), +q.y.toFixed(3)])); }); return m; };
    let seed = 3; const rnd = ()=> (seed = (seed*16807) % 2147483647) / 2147483647;
    const M = 200, cols = Math.ceil(Math.sqrt(M));
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      for(let i = 0; i < M; i++) workingNodes.push(['rq' + i, 'Entry ' + i,
        i > 0 ? 'rq' + Math.max(0, i - 1 - Math.floor(rnd()*cols*1.5)) : null, null, null, null,
        {pos:[(i % cols)*170 + (rnd()-0.5)*40, Math.floor(i / cols)*90 + (rnd()-0.5)*30]}]); });
    redrawEdges();
    const filed = snap();
    const keep = window.scorePath;
    window.scorePath = linear;
    routeLast = null;   // or the second pass would hand back the first one's routes
    try{ redrawEdges(); } finally { window.scorePath = keep; }
    const walked = snap();
    const keys = Object.keys(walked);
    const differ = keys.filter(k=> filed[k] !== walked[k]);
    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    return {routes: keys.length, differ: differ.length, first: differ[0] ? [differ[0], filed[differ[0]], walked[differ[0]]] : null};
  });
  check('every route comes out the same with the segments filed by line', eq.routes >= 199 && eq.differ === 0, JSON.stringify(eq));
  });
  await scenario("the site's first drawing, before the program", async () => {
  if(MODE === 'src'){
    check('the drawing is put in the site\'s page, so there is nothing to check from src', true);
    return;
  }
  /* tools/prerender.js draws the chart once when the site is published and
     writes it into the page, so a reader sees it before the program has
     arrived. What has to hold: the drawing is the chart, it stands where
     the program will put its own, the program takes it away as it draws
     (nothing left behind, no id twice), and nothing made from the page —
     an export — carries it. */
  const {withSnapshot, drawingOf} = require(path.join(ROOT, 'tools', 'prerender.js'));
  const SITE_DIR = path.join(DIR, 'site');
  const built = withFixture(fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf8'));
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  const silence = async p => { await p.route('https://fonts.googleapis.com/**', quiet); await p.route('https://fonts.gstatic.com/**', quiet);
    await p.route(/\/index\.html$/, r => r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: built}));
    await p.route(/\/media\/[0-9a-f]{64}\.[a-z0-9]+$/, r => { const f = mediaFile(new URL(r.request().url()).pathname);
      return f ? r.fulfill({status: 200, body: fs.readFileSync(f)}) : r.continue(); }); };
  const snap = await drawingOf(browser, SITE_DIR, {route: silence});
  const html = withSnapshot(built, snap);
  const TYPES = {'.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png'};
  const srv = http.createServer((q, r) => {
    const rel = q.url.split('?')[0].replace(/^\/+/, '');
    if(!rel || rel === 'index.html'){ r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return r.end(html); }
    const file = rel.startsWith('media/') ? path.join(DIR, rel) : path.join(SITE_DIR, rel);
    fs.readFile(file, (e, b) => { if(e){ r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'}); r.end(b); });
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const at = `http://127.0.0.1:${srv.address().port}/`;
  const look = async (opts) => {
    const c = await browser.newContext({viewport: opts.viewport || {width: 1500, height: 950}, serviceWorkers: 'block'});
    const p = await c.newPage();
    await silence(p);
    const errs = [], violations = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if(/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    if(opts.view) await p.addInitScript(v => { try{ localStorage.setItem('rhizome.view:' + (location.pathname + location.search || 'default'), JSON.stringify(v)); }catch(e){} }, opts.view);
    if(opts.noProgram) await p.route(/app\.[0-9a-f]+\.js$/, r => r.abort());
    await p.goto(at, {waitUntil: 'load'});
    if(!opts.noProgram) await p.waitForFunction(() => typeof rebuildChart === 'function');
    await p.waitForTimeout(300);
    const out = await p.evaluate(() => {
      const pre = document.getElementById('prerendered');
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      return {pre: !!pre,
              preNodes: pre ? pre.querySelectorAll('.node').length : 0,
              preView: pre ? document.getElementById('prerenderedView').getAttribute('transform') : null,
              view: document.getElementById('viewport').getAttribute('transform'),
              liveNodes: document.querySelectorAll('#viewport .node').length,
              stat: document.getElementById('statNodes').textContent,
              twice: ids.filter((id, i) => ids.indexOf(id) !== i).slice(0, 5)};
    });
    out.errs = errs;
    if(!opts.noProgram){
      out.exportClean = await p.evaluate(async () => {
        const src = await readOwnSource();
        return !src.includes('<g id="prerendered"') && !src.includes('rhizome:prerendered--' + '>') &&
               !src.includes('prerenderedView\').setAttribute') && chartSpanIn(src) !== null;
      });
      /* The version log is a file beside the program on the site, fetched
         when the history is unfolded; a copy holds it again, as a program
         that still parses. */
      out.history = await p.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const named = typeof VERSION_LOG === 'string' ? VERSION_LOG : null;
        const d = document.querySelector('#versionLog details');
        const folded = d ? d.querySelectorAll('.version-entry').length : -1;
        if(d) d.open = true;
        for(let i = 0; i < 40 && d && !d.querySelector('.version-entry'); i++) await wait(50);
        const heads = d ? [...d.querySelectorAll('.version-head b')].map(b => b.textContent) : [];
        const src = await readOwnSource();
        const program = [...src.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map(m => m[1]).find(t => t.includes('const APP_VERSION')) || '';
        return {named, folded, heads, copyNames: VERSION_LOG_FILE_RE.test(src),
                copyHolds: src.includes('{"v":"' + APP_VERSION + '"'), program};
      });
      /* Parsed here rather than in the page: the site's policy forbids
         making a function from a string, as it should. */
      try{ new Function(out.history.program); out.history.parses = true; }catch(e){ out.history.parses = false; }
      delete out.history.program;
      out.history.policy = await p.evaluate(() => {
        const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return m ? m.content : '';
      });
      out.history.violations = violations.slice();
    }
    await c.close();
    return out;
  };
  try{
    const before = await look({noProgram: true});
    const after = await look({});
    const viewed = {x: 120, y: -40, s: 0.5};
    const beforeV = await look({noProgram: true, view: viewed, viewport: {width: 390, height: 844}});
    const afterV = await look({view: viewed, viewport: {width: 390, height: 844}});
    check('with no program yet, the page shows the chart',
          before.pre && before.preNodes > 0 && before.preNodes === after.liveNodes && before.stat === after.stat,
          JSON.stringify({drawn: before.preNodes, live: after.liveNodes, stat: [before.stat, after.stat]}));
    check('the drawing stands where the program then draws, on the first visit and on a kept view',
          before.preView === after.view && beforeV.preView === afterV.view && beforeV.preView !== before.preView,
          JSON.stringify({first: [before.preView, after.view], kept: [beforeV.preView, afterV.view]}));
    check('the program takes the drawing away as it draws, with no id left twice and nothing thrown',
          !after.pre && after.liveNodes > 0 && !after.twice.length && !after.errs.length && !before.errs.length,
          JSON.stringify({pre: after.pre, twice: after.twice, errs: after.errs.concat(before.errs).slice(0, 2)}));
    check('a copy exported from the site carries no drawing', after.exportClean === true);
    const logHere = await page.evaluate(() => VERSION_LOG.map(r => r.v));
    const h = after.history || {};
    check('the site\'s program names its version log instead of holding it, and unfolding the history fetches it',
          /^versions\.[0-9a-f]{16}\.js$/.test(h.named || '') && h.folded === 0 &&
          JSON.stringify(h.heads) === JSON.stringify(logHere), JSON.stringify({named: h.named, folded: h.folded, heads: (h.heads || []).slice(0, 3)}));
    check('and a copy exported from the site holds the log again, in a program that parses',
          h.copyHolds && !h.copyNames && h.parses, JSON.stringify({holds: h.copyHolds, names: h.copyNames, parses: h.parses}));
    /* The owner's session is in localStorage; the policy is what keeps a
       script nobody wrote from reading it (site_policy, build.py). It has
       to let everything the page itself does through — the program, the
       drawing's placement, the fonts' onload, the history — or the page
       is broken by its own guard. */
    const policy = h.policy || '';
    check('the site carries a policy that runs no string as code and lets nothing embedded in',
          /script-src 'self'/.test(policy) && !/unsafe-eval/.test(policy) && !/script-src[^;]*'unsafe-inline'/.test(policy)
          && /object-src 'none'/.test(policy) && /base-uri 'none'/.test(policy), policy);
    check('and the page breaks none of it: the drawing is placed, the program runs, the history unfolds',
          !before.history && !(after.history.violations || []).length && JSON.stringify(h.heads) === JSON.stringify(logHere)
          && beforeV.preView === afterV.view, JSON.stringify((after.history.violations || []).slice(0, 3)));
    {
      const c = await browser.newContext({serviceWorkers: 'block'});
      const p = await c.newPage();
      await silence(p);
      const v = [];
      p.on('console', m => { if(/Content Security Policy/i.test(m.text())) v.push(m.text()); });
      await p.goto(at, {waitUntil: 'load'});
      await p.waitForFunction(() => typeof rebuildChart === 'function');
      const ran = await p.evaluate(() => {
        const s = document.createElement('script');
        s.textContent = 'window.__planted = localStorage.length;';
        document.body.appendChild(s);
        /* As a timer's string rather than Function() here: the tool that
           runs this line is let past the policy itself, the timer is not. */
        setTimeout('window.__made = 1', 0);
        return {planted: '__planted' in window};
      });
      await p.waitForTimeout(200);
      ran.made = await p.evaluate(() => '__made' in window);
      await c.close();
      check('a script put into the page from outside is refused, and so is code from a string',
            !ran.planted && !ran.made && v.length >= 2, JSON.stringify(ran) + ' ' + v.length);
    }
    check('the drawing asks for no pictures, which would hold the program up', !/<image[^>]*href=/.test(snap.view + snap.defs));
  } finally {
    srv.close();
  }
  });
  await scenario("the router asks only the boxes a leg can cross", async () => {
  /* scorePath and pathClearParts look the boxes up by the band of x or y a
     leg stands in (obstaclesNear) instead of walking every one. The same
     answer is the only acceptable one, so a crowded chart — boxes of every
     size, a few tall and wide ones among them, some exactly on a band's
     edge — is routed both ways and compared point for point, and a move
     is routed both ways after it. */
  const eq = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const snap = ()=>{ const m = {}; drawnRoutes.forEach((r, k)=>{ m[k] = JSON.stringify((r.pts || []).map(q=> [+q.x.toFixed(3), +q.y.toFixed(3)])); }); return m; };
    const walking = function(rects, x1, y1, x2, y2, visit){ for(const r of rects) if(visit(r) === false) return; };
    const bothWays = ()=>{
      redrawEdges();
      const banded = snap();
      const keep = window.obstaclesNear;
      window.obstaclesNear = walking;
      routeLast = null;
      try{ redrawEdges(); } finally { window.obstaclesNear = keep; }
      const walked = snap();
      routeLast = null;
      const keys = Object.keys(walked);
      return {routes: keys.length, differ: keys.filter(k=> banded[k] !== walked[k])};
    };
    let seed = 11; const rnd = ()=> (seed = (seed*16807) % 2147483647) / 2147483647;
    const M = 220, cols = Math.ceil(Math.sqrt(M));
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      for(let i = 0; i < M; i++){
        const big = i % 37 === 5;
        workingNodes.push(['ob' + i, (big ? 'A wide entry with a long label\n'.repeat(1 + i % 4) : 'Entry ') + i,
          i > 0 ? 'ob' + Math.max(0, i - 1 - Math.floor(rnd()*cols*1.5)) : null, null, null, null,
          {pos:[i % 9 === 0 ? (i % cols)*128 : (i % cols)*170 + (rnd()-0.5)*60,
                i % 11 === 0 ? Math.floor(i / cols)*128 : Math.floor(i / cols)*95 + (rnd()-0.5)*40]}]);
      }
    });
    const out = {first: bothWays()};
    applyEdit(()=>{ workingNodes[40][6] = Object.assign({}, workingNodes[40][6], {pos:[333, 777]}); });
    out.moved = bothWays();
    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    return out;
  });
  check('every route comes out the same with the boxes filed by band',
        eq.first.routes >= 219 && !eq.first.differ.length && eq.moved.routes >= 219 && !eq.moved.differ.length,
        JSON.stringify({first: eq.first.routes, moved: eq.moved.routes, differ: eq.first.differ.slice(0, 3).concat(eq.moved.differ.slice(0, 3))}));
  });
  await scenario("entries written with their fields named", async () => {
  /* The file writes an entry as a record, {id, label, parent, …}, and the
     page still works on the list it always did. What has to hold: every
     entry survives the trip there and back, a file of either form opens,
     and a file from a newer page is refused rather than half-read. */
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const out = {};
    try{
      applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
        workingNodes.push(['fa', 'First\nline', null, null, 'A note', null, {pos:[0, 0], tags:['x'], colors:['#cc2222']}]);
        workingNodes.push(['fb', 'Second', 'fa', 'via', null, 'callout', {pos:[200, 0], leader:{from:'fa', to:'fc', at:0.5}}]);
        workingNodes.push(['fc', 'Third', ['fa', 'fb'], null, null, null, {merge:true}]);
        workingNodes.push(['fd', 'Fourth']);
      });
      const text = serializeNodes(workingNodes);
      out.lines = text.split('\n').slice(1, -1);
      out.records = out.lines.every(l=> /^  \{id:'/.test(l));
      const norm = it=> { const a = Array.from({length: 6}, (_, i)=> it[i] === undefined ? null : it[i]); if(it[6] && Object.keys(it[6]).length) a.push(it[6]); return JSON.stringify(a); };
      out.roundTrip = workingNodes.every(it=> norm(entryOfRecord(recordOfEntry(it))) === norm(it));
      out.trips = workingNodes.filter(it=> norm(entryOfRecord(recordOfEntry(it))) !== norm(it)).map(it=> [norm(it), norm(entryOfRecord(recordOfEntry(it)))]);
      out.named = out.lines[1] === "  {id:'fb', label:'Second', parent:'fa', edgeLabel:'via', shape:'callout', pos:[200, 0], leader:{from:'fa', to:'fc', at:0.5}},";
      const file = chartDataOnly();
      out.settingsSay = /const SETTINGS = \{format: 4,/.test(file);
      // Read back as this file, as the list form older pages wrote, and from a newer page.
      const listForm = file.replace(/(@@EDIT:NODES:START@@ \*\/\n)[\s\S]*?(\n\/\* @@EDIT:NODES:END)/,
        (m0, a, b)=> a + 'const NODES = [\n' + workingNodes.map(it=> '  ' + JSON.stringify(it.slice(0, 7)) + ',').join('\n') + '\n];' + b)
        .replace('{format: 4, ', '{');
      const newer = file.replace('{format: 4,', '{format: 5,');
      const wanted = JSON.stringify(workingNodes.map(norm));
      applyEdit(()=>{ workingNodes.length = 0; workingNodes.push(['zz', 'Empty']); });
      importChartFromText(file);
      out.readsRecords = JSON.stringify(workingNodes.map(norm)) === wanted;
      out.got = [wanted, JSON.stringify(workingNodes.map(norm))];
      applyEdit(()=>{ workingNodes.length = 0; workingNodes.push(['zz', 'Empty']); });
      importChartFromText(listForm);
      out.readsLists = JSON.stringify(workingNodes.map(norm)) === wanted;
      try{ importChartFromText(newer); out.newer = 'taken'; }catch(e){ out.newer = e.message; }
      out.newerLeftAlone = JSON.stringify(workingNodes.map(norm)) === wanted;
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  check('each entry is written as a record with its fields named, one to a line', r.records && r.named, JSON.stringify(r.lines));
  check('and comes back from it exactly as it was', r.roundTrip, JSON.stringify(r.trips));
  check('the settings say which form the entries are written in', r.settingsSay);
  check('a file of records opens', r.readsRecords, JSON.stringify(r.got));
  check('and so does one written as lists, before records', r.readsLists);
  check('a file from a newer page is refused, and the open chart is left as it was',
        /newer version/.test(r.newer) && r.newerLeftAlone, r.newer);
  });
  await scenario("an edit that moves nothing re-routes nothing", async () => {
  /* A redraw hands back last pass's routes while the chart the router sees
     is the same and every call so far has been asked as before. The claim
     is that this is exact, so it is checked as exact: after each kind of
     edit, every route against a pass that routes everything afresh. */
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const snap = ()=>{ const m = {}; drawnRoutes.forEach((q, k)=>{ m[k] = JSON.stringify((q.pts || []).map(p=> [+p.x.toFixed(3), +p.y.toFixed(3)])); });
      m.paths = [...document.querySelectorAll('#edgeLayer path')].map(p=> p.getAttribute('d')).join('|'); return m; };
    const cold = ()=>{ routeLast = null; redrawEdges(); return snap(); };
    let fresh = 0;
    const real = window.pathFromPortsFresh;
    window.pathFromPortsFresh = function(...a){ fresh++; return real.apply(this, a); };
    const out = {};
    try{
      let seed = 11; const rnd = ()=> (seed = (seed*16807) % 2147483647) / 2147483647;
      const M = 60, cols = 8;
      applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
        for(let i = 0; i < M; i++) workingNodes.push(['rm' + i, 'Entry ' + i,
          i > 0 ? 'rm' + Math.max(0, i - 1 - Math.floor(rnd()*cols)) : null, null, null, null,
          {pos:[(i % cols)*170 + (rnd()-0.5)*40, Math.floor(i / cols)*110 + (rnd()-0.5)*30],
           colors: i % 7 === 0 ? ['#cc2222', '#2222cc'] : undefined, border: i % 9 === 0 ? 'wavy' : undefined}]);
        workingNodes.push(['rmA', 'Merge', ['rm3', 'rm12'], null, null, null, {merge:true, pos:[600, 1000]}]);
        EDGE_STYLES.push({from:'rm1', to:'rm2', routing:'curve', dash:'dashed', arrow:true});
        EDGE_STYLES.push({from:'rm4', to:'rm5', routing:'straight', dash:'double', arrow:true});
      });
      const opt = id=> { const it = workingNodes.find(x=> x[0] === id); it[6] = Object.assign({}, it[6]); return it[6]; };
      const EDITS = {
        recolour: ()=> { opt('rm20').colors = ['#22aa22']; },
        tag: ()=> { opt('rm21').tags = ['probe']; },
        note: ()=> { workingNodes.find(x=> x[0] === 'rm22')[4] = 'A note'; },
        rename: ()=> { workingNodes.find(x=> x[0] === 'rm23')[1] = 'Entry 2x'; },
        rings: ()=> { opt('rm24').colors = ['#22aa22', '#aa22aa', '#2222aa']; },
        move: ()=> { opt('rm25').pos = [333, 444]; },
        restyle: ()=> { EDGE_STYLES.push({from: workingNodes.find(x=> x[0] === 'rm30')[2], to:'rm30', routing:'straight', dash:'dotted', arrow:true}); }
      };
      out.calls = {}; out.same = {};
      for(const [k, edit] of Object.entries(EDITS)){
        fresh = 0;
        applyEdit(edit);
        out.calls[k] = fresh;
        const warm = snap();
        const c = cold();
        out.same[k] = Object.keys(c).length > 50 && Object.keys(c).every(x=> c[x] === warm[x]);
      }
    } finally {
      window.pathFromPortsFresh = real;
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  check('after every kind of edit, each route is the one a fresh pass draws', Object.values(r.same).every(Boolean), JSON.stringify(r));
  check('recolouring, tagging or retyping a note routes nothing again',
        ['recolour', 'tag', 'note'].every(k=> r.calls[k] === 0), JSON.stringify(r.calls));
  check('while a new name, more rings, a move and a new style do route again',
        r.calls.rename > 0 && r.calls.rings > 0 && r.calls.move > 0 && r.calls.restyle > 0,
        JSON.stringify(r.calls));
  });
  await scenario("a carry and a pick ask the layout nothing they already know", async () => {
  /* A connector's note asked the browser for its face and for where its
     letters stand as soon as it was drawn, and every such question in the
     middle of a redraw laid the whole page out again; a tap that picked
     an entry set two fields writable to what they already were, which
     restyled the page twice; and a drop drew the connectors twice over
     (the owner's report, 22.11). What is checked: the answers are the
     ones the layout gives, and the questions are not asked again. */
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const out = {};
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    try{
      applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
        for(let i = 0; i < 12; i++) workingNodes.push(['lq' + i, i % 3 ? 'Entry ' + i : '**Bold** and *it* ' + i,
          i ? 'lq' + (i - 1) : null, null, null, null, {pos: [(i % 4) * 220, Math.floor(i / 4) * 160]}]);
        EDGE_STYLES.push({from:'lq0', to:'lq1', note:'along the line', noteAlong:true});
        EDGE_STYLES.push({from:'lq1', to:'lq2', note:'on it', noteAlong:true, notePos:'on'});
        EDGE_STYLES.push({from:'lq2', to:'lq3', note:'a level **note**'});
        EDGE_STYLES.push({from:'lq4', to:'lq5', note:'below *it*', notePos:'below'});
        EDGE_STYLES.push({from:'lq5', to:'lq6', note:'גבע mixed', noteAlong:true});
      });
      await wait(200);
      /* Every run's box, as inkBoxOf gives it and as the layout does. */
      const legacy = (txtEl)=>{
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for(const ts of txtEl.querySelectorAll('tspan')){
          const s = ts.textContent || ''; if(!s.trim()) continue;
          const p = ts.getStartPositionOfChar(0), cs = getComputedStyle(ts);
          inkCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * INK_SCALE}px ${cs.fontFamily}`;
          const m = inkCtx.measureText(s);
          x0 = Math.min(x0, p.x - m.actualBoundingBoxLeft / INK_SCALE); y0 = Math.min(y0, p.y - m.actualBoundingBoxAscent / INK_SCALE);
          x1 = Math.max(x1, p.x + m.actualBoundingBoxRight / INK_SCALE); y1 = Math.max(y1, p.y + m.actualBoundingBoxDescent / INK_SCALE);
        }
        return x1 >= x0 ? {x: x0, y: y0, width: x1 - x0, height: y1 - y0} : null;
      };
      const texts = [...document.querySelectorAll('#viewport text')].filter(t=> t.querySelector('tspan[x][y]'));
      let worst = 0;
      texts.forEach(t=>{
        const a = inkBoxOf(t), b = legacy(t);
        if(!a || !b) return;
        worst = Math.max(worst, ...['x', 'y', 'width', 'height'].map(k=> Math.abs(a[k] - b[k])));
      });
      out.texts = texts.length; out.worst = worst;
      /* The along notes: their length against the layout's, now. */
      out.lengths = [...document.querySelectorAll('text.edge-note-along')].map(t=>
        Math.abs(noteAlongMeasure(t.textContent, t).len - t.getComputedTextLength()) < 1e-9);
      /* A redraw with the measures remembered is the drawing a redraw with
         none remembered makes. */
      /* Written with each element's attributes in order of name: a plate
         kept from the pass before has them in the order they were first
         set, and that is not a difference anyone can see. */
      const markup = e=> e.nodeType !== 1 ? e.textContent :
        '<' + e.tagName + [...e.attributes].map(a=> ' ' + a.name + '="' + a.value + '"').sort().join('') + '>' +
        [...e.childNodes].map(markup).join('') + '</>';
      const notes = ()=> [...arrowLayer.querySelectorAll('.edge-note')].map(g=> markup(g).replace(/note-along-\d+/g, 'n')).join('|');
      redrawEdges(); const warm = notes();
      faceCache.clear(); noteAlongCache.clear(); redrawEdges(); const cold = notes();
      out.sameDrawing = warm === cold && warm.length > 200; out.drawn = warm.length;
      /* And asks the layout nothing about them. */
      const T = SVGTextContentElement.prototype, asked = {style: 0, start: 0, length: 0};
      const was = {gcs: window.getComputedStyle, start: T.getStartPositionOfChar, len: T.getComputedTextLength};
      window.getComputedStyle = function(...a){ if(a[0] && a[0].closest && a[0].closest('.edge-note')) asked.style++; return was.gcs.apply(this, a); };
      T.getStartPositionOfChar = function(...a){ if(this.closest('.edge-note')) asked.start++; return was.start.apply(this, a); };
      T.getComputedTextLength = function(...a){ if(this.closest('.edge-note')) asked.length++; return was.len.apply(this, a); };
      try{ redrawEdges(); } finally { window.getComputedStyle = was.gcs; T.getStartPositionOfChar = was.start; T.getComputedTextLength = was.len; }
      out.asked = asked;
      /* Picking entries one after another leaves the fields that are
         already as they should be alone. */
      const seen = [];
      const mo = new MutationObserver(list=> list.forEach(m=> seen.push(m.target.className)));
      /* The first pick may lock what nothing picked left open; that is a
         change. The ones after it find everything as they want it. */
      deselect(); toggleInSelection('lq0'); await wait(30);
      mo.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['contenteditable']});
      ['lq3', 'lq7', 'lq9', 'lq10'].forEach(id=> toggleInSelection(id));
      await wait(50);
      mo.disconnect();
      out.editableWrites = seen.length;
      /* A drop after a frame still owed draws the connectors once before
         the rebuild, not twice. */
      const g = document.querySelector('.node[data-id="lq9"]');
      const b = g.getBoundingClientRect(), sx = b.x + b.width/2, sy = b.y + b.height/2;
      g.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
      for(let k = 1; k <= 4; k++){ window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:sx + k*12, clientY:sy + k*8})); await wait(20); }
      window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:sx + 64, clientY:sy + 40}));
      out.owed = !!(dragRedrawFrame || dragRedrawTimer);
      let draws = 0; const real = window.redrawEdges;
      window.redrawEdges = function(...a){ draws++; return real.apply(this, a); };
      try{ window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true})); } finally { window.redrawEdges = real; }
      out.dropDraws = draws;
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
      deselect();
    }
    return out;
  });
  check('a note\'s ink is measured where the layout puts its letters, without asking it',
        r.texts >= 10 && r.worst < 1e-6, JSON.stringify({texts: r.texts, worst: r.worst}));
  check('a note along its line has the length the layout gives it',
        r.lengths.length >= 3 && r.lengths.every(Boolean), JSON.stringify(r.lengths));
  check('remembered, the notes are drawn as they are with nothing remembered', r.sameDrawing, JSON.stringify(r.drawn));
  check('and a redraw asks the layout nothing about them', !r.asked.style && !r.asked.start && !r.asked.length, JSON.stringify(r.asked));
  check('picking entry after entry sets no field writable that already was', r.editableWrites === 0, String(r.editableWrites));
  check('a drop with a frame still owed draws the connectors once before the rebuild',
        r.owed && r.dropDraws === 2, JSON.stringify({owed: r.owed, draws: r.dropDraws}));
  });
  await scenario("an edit redraws only the entries it changed", async () => {
  /* Every entry is still drawn each pass, and one whose drawing comes out
     as it was keeps the drawing it had (drawOrKeep). Two claims, checked:
     an edit to one entry leaves every other entry's drawing the very same
     element, and what is kept is, entry by entry, the markup a pass that
     keeps nothing would draw. */
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const out = {kept: {}, same: {}};
    try{
      applyEdit(()=>{ workingNodes.length = 0;
        for(let i = 0; i < 60; i++) workingNodes.push(['dk' + i, 'Entry ' + i, i ? 'dk' + Math.floor((i - 1) / 2) : null, null,
          i % 5 === 0 ? 'A note' : null, i % 11 === 0 ? 'ellipse' : null,
          {pos:[(i % 8)*170, Math.floor(i / 8)*110], colors: i % 7 === 0 ? ['#cc2222', '#2222cc'] : undefined,
           border: i % 9 === 0 ? 'wavy' : undefined, tags: i % 6 === 0 ? ['probe'] : undefined}]);
      });
      const opt = id=> { const it = workingNodes.find(x=> x[0] === id); it[6] = Object.assign({}, it[6]); return it[6]; };
      const EDITS = {
        recolour: ['dk20', ()=> { opt('dk20').colors = ['#22aa22']; }],
        rename: ['dk23', ()=> { workingNodes.find(x=> x[0] === 'dk23')[1] = 'Entry 2x'; }],
        move: ['dk25', ()=> { opt('dk25').pos = [2000, 2000]; }],
        tag: ['dk27', ()=> { opt('dk27').tags = ['other']; }]
      };
      const drawn = ()=> new Map([...document.querySelectorAll('#nodeLayer .node[data-id]')].map(g=> [g.dataset.id, g]));
      for(const [k, [id, edit]] of Object.entries(EDITS)){
        const was = drawn();
        applyEdit(edit);
        await new Promise(res=> setTimeout(res, 50));
        const now = drawn();
        out.kept[k] = {others: [...now].filter(([x, g])=> x !== id && g !== was.get(x)).length,
                       changed: now.get(id) !== was.get(id), total: now.size};
        const warm = new Map([...drawnEntries].map(([x, rec])=> [x, drawingSig(rec.pieces)]));
        drawnEntries = new Map(); renderNodes();
        const cold = new Map([...drawnEntries].map(([x, rec])=> [x, rec.sig]));
        out.same[k] = cold.size === warm.size && cold.size >= 60 && [...cold].every(([x, s])=> warm.get(x) === s);
      }
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x)); });
    }
    return out;
  });
  check('an edit to one entry keeps every other entry\'s drawing, and draws that one anew',
        Object.values(r.kept).every(k=> k.others === 0 && k.changed && k.total >= 60), JSON.stringify(r.kept));
  check('what is kept is, entry by entry, what a pass that keeps nothing draws',
        Object.values(r.same).every(Boolean), JSON.stringify(r.same));
  });
  await scenario("an edit redraws only the connectors it changed", async () => {
  /* The connectors' half of the scenario above (keepEdgeDrawings): every
     connector is still routed and drawn each pass, and one whose drawing
     comes out as it was keeps the element it had. Checked: an edit that
     moves nothing keeps every line but the ones it changed, and what is
     kept is, element for element, the markup a pass that keeps nothing
     draws — with gradients, notes, double lines and hops among them. */
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice()), beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {kept: {}, same: {}};
    const lines = ()=> [...edgeLayer.querySelectorAll(':scope > path.edge.struct:not(.dbl-inner)')];
    const markup = ()=> [edgeLayer, arrowLayer, leaderHitLayer].map(L=> [...L.childNodes]
      .filter(e=> e.nodeType === 1).map(e=> e.outerHTML).join('\n')).join('\n--\n');
    try{
      applyEdit(()=>{
        workingNodes.length = 0;
        for(let i = 0; i < 60; i++) workingNodes.push(['ek' + i, 'Entry ' + i, i ? 'ek' + Math.floor((i - 1) / 2) : null, null, null, null,
          {pos:[(i % 8)*190, Math.floor(i / 8)*130], tags: i % 6 === 0 ? ['probe'] : undefined}]);
        EDGE_STYLES.length = 0;
        EDGE_STYLES.push({from:'ek1', to:'ek3', gradient:['#2f9a4a', '#2b54c8']},
                         {from:'ek2', to:'ek5', note:'a note', notePos:'above'},
                         {from:'ek4', to:'ek9', dash:'double'},
                         {from:'ek6', to:'ek13', routing:'straight'});
      });
      const opt = id=> { const it = workingNodes.find(x=> x[0] === id); it[6] = Object.assign({}, it[6]); return it[6]; };
      // A note's plate is styled once its words have landed; the chart settles first.
      await new Promise(res=> setTimeout(res, 50));
      applyEdit(()=>{});
      const EDITS = {
        recolour: [[], ()=> { opt('ek40').colors = ['#22aa22']; }],
        note: [[], ()=> { workingNodes.find(x=> x[0] === 'ek41')[4] = 'A note of its own'; }],
        line: [['ek4|ek9'], ()=> { EDGE_STYLES.find(s=> s.to === 'ek9').dash = 'dashed'; }],
        // A sweep is in edgeDefs, drawn afresh: the line keeps its element and wears the new one.
        gradient: [[], ()=> { EDGE_STYLES.find(s=> s.to === 'ek3').gradient = ['#cc2222', '#2222cc']; }]
      };
      for(const [k, [changed, edit]] of Object.entries(EDITS)){
        const was = new Map(lines().map(p=> [p.dataset.from + '|' + p.dataset.to, {el: p, html: p.outerHTML}]));
        applyEdit(edit);
        await new Promise(res=> setTimeout(res, 50));
        const now = lines();
        const key = p=> p.dataset.from + '|' + p.dataset.to;
        out.kept[k] = {asWas: now.filter(p=> was.get(key(p)) && was.get(key(p)).html === p.outerHTML).length,
                       /* A line drawn as it was, but whose head or cap at the entry the
           edit touched is not, goes with them: a connector is kept whole. */
                       lost: now.filter(p=> was.get(key(p)) && was.get(key(p)).html === p.outerHTML && was.get(key(p)).el !== p
                                            && !(k === 'recolour' && p.dataset.to === 'ek40')).length,
                       changed: changed.every(c=> { const p = now.find(q=> key(q) === c); return p && p !== was.get(c).el; }),
                       total: now.length};
        if(k === 'gradient'){
          const p = now.find(q=> key(q) === 'ek1|ek3');
          const g = document.getElementById(((p && p.getAttribute('stroke')) || '').replace(/^url\(#|\)$/g, ''));
          out.sweep = g ? [...g.querySelectorAll('stop')].map(st=> st.getAttribute('stop-color')).join(' ') : null;
        }
        const warm = markup();
        drawnEdges = new Map(); redrawEdges();
        out.same[k] = warm === markup() && warm.length > 1000;
      }
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  check('an edit keeps every connector\'s drawing but those it changed, and draws those anew',
        Object.values(r.kept).every(k=> k.lost === 0 && k.asWas >= k.total - 3 && k.changed && k.total >= 59), JSON.stringify(r.kept));
  check('a kept line wears the sweep its connector has now', r.sweep === '#cc2222 #2222cc', r.sweep);
  check('what is kept is what a pass that keeps nothing draws, connector for connector',
        Object.values(r.same).every(Boolean), JSON.stringify(r.same));
  });
  await scenario("an entry's controls are built when something reaches them", async () => {
  /* The grips, the turning handle and the connector strips are built the
     first time the pointer, a selection or a connector drag reaches an
     entry (nodeControlsWanted). What is checked is that nothing a person
     can do finds them missing: under the pointer they are there, selected
     they are there, and a connector dragged onto an entry the pointer had
     never visited still lands on the ring it is over. */
  const setup = await page.evaluate(async ()=>{
    const out = {before: workingNodes.map(x=> x.slice()), beforeStyles: EDGE_STYLES.length};
    applyEdit(()=>{
      workingNodes.length = 0;
      for(let i = 0; i < 40; i++) workingNodes.push(['ncX' + i, 'Filler ' + i, null, null, null, null, {pos:[2000 + (i % 8)*170, 2000 + Math.floor(i / 8)*110]}]);
      workingNodes.push(['ncA', 'From here', null, null, null, null, {pos:[0, 0]}]);
      workingNodes.push(['ncB', 'To there', null, null, null, null, {pos:[400, 0], colors:['#cc2222', '#2222cc']}]);
      workingNodes.push(['ncC', 'Picked', null, null, null, null, {pos:[0, 200]}]);
    });
    deselect();
    vs = 1; vx = 300; vy = 300; applyTransform();
    await new Promise(r=> setTimeout(r, 300));
    const box = id=> { const b = document.querySelector(`.node[data-id="${id}"] rect`).getBoundingClientRect();
                       return {x: b.left, y: b.top, w: b.width, h: b.height}; };
    out.a = box('ncA'); out.b = box('ncB');
    out.builtAtFirst = [...document.querySelectorAll('.node .node-controls')].filter(c=> c.childElementCount).length;
    out.perEntry = document.querySelectorAll('#nodeLayer .node *').length / nodes.size;
    selectNode('ncC');
    out.selectedGrips = document.querySelectorAll('.node[data-id="ncC"] .node-resize').length;
    return out;
  });
  await page.mouse.move(setup.a.x + setup.a.w/2, setup.a.y + setup.a.h/2);
  await wait(80);
  const hovered = await page.evaluate(()=> ({
    grips: document.querySelectorAll('.node[data-id="ncA"] .node-resize').length,
    strips: document.querySelectorAll('.node[data-id="ncA"] .node-handle').length,
    bUnbuilt: !document.querySelector('.node[data-id="ncB"] .node-handle')}));
  /* From A's right strip onto the outer ring of B's left side. */
  const right = await page.evaluate(()=>{
    const h = document.querySelector('.node[data-id="ncA"] .node-handle[data-side="right"] .node-handle-hit').getBoundingClientRect();
    return {x: h.left + h.width/2, y: h.top + h.height/2};
  });
  await page.mouse.move(right.x, right.y);
  await page.mouse.down();
  for(let i = 1; i <= 8; i++){ await page.mouse.move(right.x + i*20, right.y); await wait(16); }
  /* Where B's outer ring will be grabbed, worked out from the box rather
     than read off the strip, which must not exist yet. */
  const outer = await page.evaluate(()=>{
    const n = nodes.get('ncB');
    const hit = sideBandRect(n, n.h, 'left', -ringStepFor(n), BAND_HIT_DEFAULT).hit;
    const p = new DOMPoint(hit.x + hit.width/2, hit.y + hit.height/2).matrixTransform(nodeLayer.getScreenCTM());
    return {x: p.x, y: p.y, unbuilt: nodeControlsWanted.has('ncB')};
  });
  await page.mouse.move(outer.x, outer.y);
  await wait(60);
  const over = await page.evaluate(()=>{
    const t = document.querySelector('.node-handle.drop-target');
    return {target: t ? t.dataset.id + ':' + t.dataset.side + ':' + t.dataset.ring : null};
  });
  await page.mouse.up();
  await wait(200);
  const done = await page.evaluate((setup)=>{
    const made = EDGE_STYLES.find(s=> s.from === 'ncA' && s.to === 'ncB') ||
                 (nodes.get('ncB') && nodes.get('ncB').parent === 'ncA') ||
                 workingNodes.some(x=> x[0] === 'ncB' && JSON.stringify(x[2]).includes('ncA'));
    applyEdit(()=>{ workingNodes.length = 0; setup.before.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = setup.beforeStyles; });
    deselect();
    return {made: !!made};
  }, setup);
  check('a redraw builds no entry\'s controls the pointer has not reached', setup.builtAtFirst === 0,
        setup.builtAtFirst);
  check('so an entry is a handful of elements, not forty', setup.perEntry < 12, setup.perEntry);
  check('an entry under the pointer has its four grips and four strips', hovered.grips === 4 && hovered.strips === 4,
        JSON.stringify(hovered));
  check('…and one the pointer has not been to has none yet', hovered.bUnbuilt);
  check('a selected entry has its grips', setup.selectedGrips === 4, setup.selectedGrips);
  check('a connector dragged onto an entry never visited lights the ring it is over',
        outer.unbuilt && over.target === 'ncB:left:1', JSON.stringify({outer, over}));
  check('and is drawn when let go', done.made, JSON.stringify(done));
  });
