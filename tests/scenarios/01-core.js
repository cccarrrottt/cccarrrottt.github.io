/* tests/scenarios/01-core.js — scenarios 0 to 25 of the suite.
 *
 * What the chart does at all: booting, undo, entries of every kind, cards,
 * routing, panels, tags, search, export and import, links, storage, callouts
 * and references. The oldest checks, from before the rounds were dated.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */

  /* ---- 1. boot ---- */
  await scenario("boot", async () => {
  const boot = await page.evaluate(() => ({
    nodes: nodes.size,
    rendered: document.querySelectorAll('#nodeLayer .node').length,
    edges: document.querySelectorAll('#edgeLayer path').length,
    layers: ['bgLayer','backLayer','edgeLayer','nodeLayer','arrowLayer','frontLayer','bioCardLayer']
              .filter(id => document.getElementById(id)).length,
    dirty: isDirty(),
    measuredWidth: measureText('Measured', {})
  }));
  check('boots with nodes rendered', boot.rendered > 0, `${boot.rendered} nodes`);
  eq('all seven layers present', boot.layers, 7);
  eq('clean on load', boot.dirty, false);
  /* The suite answers both font hosts with an empty stylesheet, so this whole
     run IS the case README promises works: the page asks for its webfonts,
     is given nothing, falls back to system faces and is otherwise unchanged.
     Worth a check of its own, because otherwise it is a condition the suite
     quietly imposes on itself and nobody would know it was being tested. */
  check('asks for its webfonts, is given none, and draws anyway',
        fontsAsked > 0 && boot.rendered > 0 && boot.measuredWidth > 0,
        JSON.stringify({asked: fontsAsked, drew: boot.rendered,
                        measured: boot.measuredWidth}));

  });
  /* ---- 2. undo / redo ---- */
  await scenario("undo / redo", async () => {
  const undo = await page.evaluate(async () => {
    const was = workingNodes[0][1];
    applyEdit(() => { workingNodes[0][1] = '__UNDO_PROBE__'; });
    const after = workingNodes[0][1];
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'z', ctrlKey:true, bubbles:true}));
    await new Promise(r => setTimeout(r, 250));
    const undone = workingNodes[0][1];
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'y', ctrlKey:true, bubbles:true}));
    await new Promise(r => setTimeout(r, 250));
    const redone = workingNodes[0][1];
    applyEdit(() => { workingNodes[0][1] = was; });
    return {after, undone, redone, was};
  });
  eq('edit applies', undo.after, '__UNDO_PROBE__');
  eq('ctrl+z undoes', undo.undone, undo.was);
  eq('ctrl+y redoes', undo.redone, '__UNDO_PROBE__');

  /* A connector's note previews by writing into EDGE_STYLES, which is a
     saved region. The snapshot used to be taken at commit, after the
     preview had already written the typed text in, so undo went back past
     the edit to whatever came before it. */
  const noteEdge = await page.evaluate(() => {
    const e = structEdges.find(x => !isMergePart(x.from, x.to));
    applyEdit(() => setEdgeStyleOverride(e.from, e.to,
      Object.assign({}, edgeStyleFor(e.from, e.to), {note: 'old'})));
    openEdgeNoteEditor(e.from, e.to);
    return {from: e.from, to: e.to};
  });
  await page.waitForTimeout(200);
  await page.keyboard.press('End');
  await page.keyboard.type('XY');
  await page.waitForTimeout(700);
  const noteUndo = await page.evaluate(async e => {
    closeNodeEditor(true);
    const typed = edgeStyleFor(e.from, e.to).note;
    undoLastEdit();
    await new Promise(r => setTimeout(r, 60));
    const undone = edgeStyleFor(e.from, e.to).note;
    undoLastEdit();
    return {typed, undone};
  }, noteEdge);
  eq('a note typed into is kept', noteUndo.typed, 'oldXY');
  eq('undo after typing into a note goes back to the note as it was', noteUndo.undone, 'old');

  // The plate's gestures are wired in one place; a double click opened the field twice.
  const opens = await page.evaluate(async e => {
    applyEdit(() => setEdgeStyleOverride(e.from, e.to,
      Object.assign({}, edgeStyleFor(e.from, e.to), {note: 'twice?'})));
    await new Promise(r => setTimeout(r, 60));
    const plate = document.querySelector(`.edge-note[data-from="${e.from}"][data-to="${e.to}"]`);
    const real = openEdgeNoteEditor;
    let n = 0;
    openEdgeNoteEditor = function(){ n++; };
    try{ plate.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); }
    finally{ openEdgeNoteEditor = real; }
    undoLastEdit();
    return n;
  }, noteEdge);
  eq('a double click on a note opens its field once', opens, 1);

  });
  await scenario("a font that arrives late", async () => {
  /* fonts.ready settles once; a face fetched later — the Cyrillic part of
     a font, the first time a Cyrillic letter is drawn — used to leave
     every width measured while it was on its way as the fallback's. */
  const late = await page.evaluate(async () => {
    /* A width the faces now on the page would not give: as if it were
       measured in the fallback before the real face came. */
    measureText('Late probe', {});
    const probeKey = [...measureCache.keys()].find(k => k.startsWith('Late probe\u0000'));
    measureCache.set(probeKey, measureCache.get(probeKey) + 7);
    blockCache.set('__LATE_PROBE__', {width:1, height:1});
    document.fonts.dispatchEvent(new Event('loadingdone'));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {measure: measureCache.has(probeKey), block: blockCache.has('__LATE_PROBE__'),
            drawn: !!document.querySelector('#nodeLayer .node, .node')};
  });
  check('a late font empties the width cache', !late.measure);
  check('…and the block cache with it', !late.block);
  check('…and the chart is drawn again, not left empty', late.drawn);

  /* But a face arriving that changes no width the chart has measured —
     the interface's own, every load — is not a reason to draw it all
     again: on a phone that second drawing was two of the five and a half
     seconds a 400-entry chart took to start (tools/bench-boot.js). */
  const idle = await page.evaluate(async () => {
    measureText('Steady probe', {});
    const keep = document.querySelector('#nodeLayer .node');
    blockCache.set('__STEADY_PROBE__', {width:1, height:1});
    document.fonts.dispatchEvent(new Event('loadingdone'));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const kept = blockCache.has('__STEADY_PROBE__');
    blockCache.delete('__STEADY_PROBE__');
    return {kept, same: document.querySelector('#nodeLayer .node') === keep};
  });
  check('a face that changes no measured width redraws nothing', idle.kept && idle.same, JSON.stringify(idle));

  /* Nothing waits for the faces. The interface's arrive as a print-only
     stylesheet switched on when it lands, so the first draw does not wait
     for a font host; and the faces an entry can be set in are asked for
     only when an entry is. */
  const faces = await page.evaluate(() => {
    const ui = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')].filter(l => !l.dataset.face);
    const before = document.querySelectorAll('link[data-face="orbitron"]').length;
    const was = workingNodes.map(x => x.slice());
    let after, twice;
    try{
      applyEdit(() => {
        workingNodes.push(['face_a', 'Fancy', null, null, null, null, {pos:[5000, 5000], font:'orbitron'}]);
      });
      after = document.querySelectorAll('link[data-face="orbitron"]').length;
      applyEdit(() => {
        workingNodes.push(['face_b', 'Fancier', null, null, null, null, {pos:[5300, 5000], font:'orbitron'}]);
      });
      twice = document.querySelectorAll('link[data-face="orbitron"]').length;
    } finally {
      applyEdit(() => { workingNodes.length = 0; was.forEach(x => workingNodes.push(x)); });
    }
    return {ui: ui.map(l => ({media: l.getAttribute('media'), onload: l.getAttribute('onload'), href: l.href})),
            usedBefore: workingNodes.some(x => x[6] && x[6].font === 'orbitron'), before, after, twice};
  });
  check('the interface\'s faces do not hold up the first draw',
        faces.ui.length === 1 && /this\.media='all'/.test(faces.ui[0].onload || '') && faces.ui[0].media === 'all',
        JSON.stringify(faces.ui));
  check('and they are only the interface\'s: no face an entry may choose',
        faces.ui.every(l => !/Merriweather|Orbitron|Caveat|Space\+Grotesk/.test(l.href)), JSON.stringify(faces.ui));
  check('an entry\'s face is asked for when an entry is set in it, once',
        (faces.usedBefore || faces.before === 0) && faces.after === 1 && faces.twice === 1, JSON.stringify(faces));

  });
  await scenario("carried connector heads", async () => {
  /* A head on an entry's outermost border is drawn under the entry. While a
     group is dragged, a connector between two carried entries is moved
     rather than routed again, and its moved points had lost the ring they
     stood on — the head went above the entries until the drop. */
  const heads = await page.evaluate(() => {
    const beforeNodes = workingNodes.slice(), beforeStyles = EDGE_STYLES.slice();
    applyEdit(() => {
      workingNodes.push(['k7a','A',null,null,null,null,{pos:[52000,-900]}]);
      workingNodes.push(['k7b','B','k7a',null,null,null,
                         {pos:[52000,-500], colors:['#111111','#2f6fb5','#c23b22']}]);
      EDGE_STYLES.push({from:'k7a', to:'k7b', toRing:2});
    });
    const where = () => {
      const h = document.querySelector('.edge-arrow[data-from="k7a"][data-to="k7b"]');
      return !h ? 'none' : h.closest('#arrowLayer') ? 'above' : h.closest('#edgeLayer') ? 'under' : 'other';
    };
    const still = where();
    dragRouteHold = {memo: new Map(), moving: new Set(['k7a','k7b'])};
    try{ redrawEdges(); redrawEdges(); } finally { dragRouteHold = null; }
    const carried = where();
    refill(EDGE_STYLES, beforeStyles);
    applyEdit(() => { workingNodes = beforeNodes; });
    return {still, carried};
  });
  eq('a head on the outermost border is drawn under the entry', heads.still, 'under');
  eq('…and stays under it while both its entries are carried', heads.carried, 'under');

  });
  /* ---- 3. node creation, every archetype ---- */
  await scenario("node creation, every archetype", async () => {
  const shapes = await page.evaluate(async () => {
    const out = {};
    for(const shape of ['rect','ellipse','image','textbox']){
      const id = 'probe_' + shape;
      applyEdit(() => { workingNodes.push([id, 'Probe ' + shape, null, null, null, shape, {pos:[900, 200]}]); });
      await new Promise(r => setTimeout(r, 60));
      out[shape] = !!document.querySelector(`[data-id="${id}"]`);
      applyEdit(() => { const i = workingNodes.findIndex(n => n[0] === id); if(i >= 0) workingNodes.splice(i, 1); });
    }
    return out;
  });
  for(const [shape, ok] of Object.entries(shapes)) check(`archetype renders: ${shape}`, ok);

  });
  /* ---- 4. card layout ---- */
  await scenario("card layout", async () => {
  const card = await page.evaluate(async () => {
    const id = 'probe_card';
    const pic = 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"></svg>');
    applyEdit(() => { workingNodes.push([id, 'Card Probe', null, null, 'body text', 'rect',
      {pos:[900, 420], card:true}]); });
    await new Promise(r => setTimeout(r, 160));
    const read = ()=>{
      const g = document.querySelector(`[data-id="${id}"]`);
      const n = nodes.get(id) || {};
      return {exists: !!g,
              rule: g ? g.querySelectorAll('.card-rule').length : 0,
              slot: g ? g.querySelectorAll('.card-slot').length : 0,
              img: g ? g.querySelectorAll('image').length : 0,
              body: g ? g.querySelectorAll('.card-body').length : 0,
              h: n.h, band: n.cardTop};
    };
    const bare = read();
    /* …and with a picture the band appears, the card grows by it, and the
       rule under it appears with it. */
    applyEdit(() => {
      const f = workingEntry(id);
      putEntry(f.index, f.entry, Object.assign(entryOpts(f.entry), {image: pic}));
    });
    await new Promise(r => setTimeout(r, 200));
    const withPic = read();
    applyEdit(() => { const i = workingNodes.findIndex(n => n[0] === id); if(i >= 0) workingNodes.splice(i, 1); });
    return {bare, withPic};
  });
  check('card layout draws its divisions',
        card.bare.exists && card.bare.rule === 1 && card.bare.body >= 1,
        JSON.stringify(card.bare));
  /* A card with no picture has no picture band: an empty frame standing in
     for one is a third of the entry given over to saying that nothing is
     there yet. */
  check('a card with no picture has no picture band',
        card.bare.slot === 0 && card.bare.img === 0 && card.bare.band === 0,
        JSON.stringify(card.bare));
  check('and choosing one gives it a band, a rule and the height for both',
        card.withPic.img === 1 && card.withPic.rule === 2 &&
        card.withPic.band > 0 && card.withPic.h > card.bare.h,
        JSON.stringify(card.withPic));

  });
  /* ---- 5. edge routing clears every obstacle ---- */
  await scenario("edge routing clears every obstacle", async () => {
  const clearance = await page.evaluate(async () => {
    const ids = [];
    applyEdit(() => {
      for(let i = 0; i < 40; i++){
        const id = 'grid_' + i; ids.push(id);
        workingNodes.push([id, 'N' + i, i > 0 && i % 4 ? 'grid_' + (i - 1) : null, null, null, null,
          {pos:[(i % 8) * 190 - 400, Math.floor(i / 8) * 150 - 300]}]);
      }
    });
    await new Promise(r => setTimeout(r, 900));
    let checked = 0, hits = 0;
    const rects = obstacleAll();
    for(const p of document.querySelectorAll('#edgeLayer path.edge-hit')){
      const len = p.getTotalLength(); if(!len) continue;
      const from = p.dataset.from, to = p.dataset.to;
      for(let t = 0.12; t <= 0.88; t += 0.04){
        const pt = p.getPointAtLength(len * t); checked++;
        for(const r of rects){
          if(r.id === from || r.id === to) continue;
          if(pt.x > r.x + 1 && pt.x < r.x + r.w - 1 && pt.y > r.y + 1 && pt.y < r.y + r.h - 1){ hits++; break; }
        }
      }
    }
    applyEdit(() => { for(const id of ids){ const i = workingNodes.findIndex(n => n[0] === id); if(i >= 0) workingNodes.splice(i, 1); } });
    await new Promise(r => setTimeout(r, 400));
    return {checked, hits};
  });
  check('connectors clear unrelated boxes on a dense chart',
        clearance.hits === 0 && clearance.checked > 100,
        `${clearance.checked - clearance.hits}/${clearance.checked} sample points clear`);

  });
  /* ---- 6. panels open ---- */
  await scenario("panels open", async () => {
  for(const [btn, panel] of [['#tagsTab','#tagsPanel .side-tab-body'], ['#refsTab','#refsPanel .side-tab-body'],
                             ['#fileToggle','#filePopover'],
                             ['#aboutToggle','#aboutOverlay'], ['#filesToggle','#stickerOverlay'],
                             ['#addFabBtn','#addFabStyles']]){
    const ok = await page.evaluate(async ([b, p]) => {
      const el = document.querySelector(b); if(!el) return 'no button';
      el.click(); await new Promise(r => setTimeout(r, 220));
      const t = document.querySelector(p); if(!t) return 'no panel';
      const shown = !t.hidden && getComputedStyle(t).display !== 'none' &&
                    getComputedStyle(t).visibility !== 'hidden';
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      // And Escape puts it away again, as its own ✕ would. Asked until it
      // has, for up to two seconds: a panel that fades goes hidden at the
      // end of its transition, which a fixed 220 ms outlasted on a quiet
      // machine and not under four shards at once.
      const isGone = () => t.hidden || getComputedStyle(t).display === 'none' ||
                           getComputedStyle(t).visibility === 'hidden';
      for(let i = 0; i < 40 && !isGone(); i++) await new Promise(r => setTimeout(r, 50));
      const gone = isGone();
      if(shown && !gone) return 'Escape left it open';
      return shown;
    }, [btn, panel]);
    check(`panel opens, and Escape shuts it: ${panel}`, ok === true, ok === true ? '' : String(ok));
  }

  /* Suggestions live on the published site, where the write service can
     carry them to the repository. Anywhere else there is nobody to carry
     one, so neither way in is shown, and the bar's button stays inert. */
  check('off the site there are no suggestions to make', await page.evaluate(async () => {
    const t = document.getElementById('commentsToggle'), d = document.getElementById('detailSuggest');
    if(getComputedStyle(t).display !== 'none' || !d.hidden) return false;
    t.click();
    await new Promise(r => setTimeout(r, 200));
    return !document.getElementById('commentsOverlay').classList.contains('open');
  }));

  });
  /* ---- 7. tag filtering hides nodes AND their connectors ---- */
  await scenario("tag filtering hides nodes AND their connectors", async () => {
  const tagFilter = await page.evaluate(async () => {
    const id = 'probe_tagged';
    applyEdit(() => {
      workingNodes.push([id, 'Tagged Probe', workingNodes[0][0], null, null, null,
        {pos:[700, 700], tags:['fan-fiction']}]);
    });
    await new Promise(r => setTimeout(r, 400));
    const row = document.querySelector('#tagsList .legend-item[data-tag="fan-fiction"]');
    // Hiding is the row's eye button now, not the row itself — the row had
    // to give the gesture up so it could also carry a delete cross.
    const box = row && row.querySelector('.eye-mini');
    let r = {found: !!box};
    if(box){
      box.click();
      await new Promise(res => setTimeout(res, 400));
      /* Hidden is faded and out of the pointer's way since the owner's
         list of 2.11 (evening), not taken off the chart. */
      const gone = e => !e || getComputedStyle(e).display === 'none' || e.classList.contains('tag-hidden');
      r.nodeHidden = gone(document.querySelector(`.node[data-id="${id}"]`));
      r.faintNotGone = (()=>{ const e = document.querySelector(`.node[data-id="${id}"]`);
        return !!e && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity < 0.3 &&
               getComputedStyle(e).pointerEvents === 'none'; })();
      const live = e => !gone(e);
      const touching = [...document.querySelectorAll('#edgeLayer path.edge-hit')]
        .filter(e => e.dataset.from === id || e.dataset.to === id);
      r.touching = touching.length;
      r.stillVisible = touching.filter(live).length;
      r.othersVisible = [...document.querySelectorAll('#edgeLayer path.edge-hit')]
        .filter(e => e.dataset.from !== id && e.dataset.to !== id).filter(live).length;
      document.querySelector('#tagsList .legend-item[data-tag="fan-fiction"] .eye-mini').click();
      await new Promise(res => setTimeout(res, 400));
    }
    applyEdit(() => { const i = workingNodes.findIndex(n => n[0] === id); if(i >= 0) workingNodes.splice(i, 1); });
    return r;
  });
  check('hiding a tag fades its node and its connector, barely there and not to be pressed',
        tagFilter.found && tagFilter.nodeHidden && tagFilter.faintNotGone &&
        tagFilter.touching > 0 && tagFilter.stillVisible === 0 && tagFilter.othersVisible > 0,
        JSON.stringify(tagFilter));

  });
  /* ---- 8. search ---- */
  await scenario("search", async () => {
  const search = await page.evaluate(async () => {
    const i = document.getElementById('searchInput');
    /* Searched for by the WORDS of a label, not by its source. A label on
       this chart may open with a colour, an underline or a reading, and
       the first five characters of the stored form are then punctuation
       that appears nowhere on the drawing. */
    const plain = (stripMarkup(workingNodes[0][1]) || '').trim();
    i.value = plain.slice(0, 5);
    i.dispatchEvent(new Event('input', {bubbles:true}));
    await new Promise(r => setTimeout(r, 300));
    const n = document.querySelectorAll('#searchResults *').length;
    i.value = ''; i.dispatchEvent(new Event('input', {bubbles:true}));
    return n;
  });
  check('search returns results', search > 0, `${search} elements`);

  });
  /* ---- 9. grid toggle ---- */
  await scenario("grid toggle", async () => {
  const grid = await page.evaluate(async () => {
    const g = document.getElementById('alignGrid');
    const b = document.getElementById('gridToggle');
    const shown = () => getComputedStyle(g).display !== 'none';
    const start = shown();
    b.click(); await new Promise(r => setTimeout(r, 250));
    const flipped = shown();
    b.click(); await new Promise(r => setTimeout(r, 250));
    return {start, flipped, back: shown()};
  });
  check('fixed grid toggles both ways', grid.flipped !== grid.start && grid.back === grid.start,
        JSON.stringify(grid));

  });
  /* ---- 10. export / import round-trip ----
     Only meaningful against the built file. In src/ the markup and the data
     are separate files, so the page reading "its own source" gets index.html,
     which by design holds no chart. writeChart() says so plainly rather than
     writing a broken export, and that refusal is what's checked here. */
  await scenario("export / import round-trip", async () => {
  if(MODE === 'src'){
    const refused = await page.evaluate(async () => {
      try { writeChart(await readOwnSource(true)); return null; }
      catch(e){ return e.message; }
    });
    check('split sources refuse to self-export, with a reason',
          typeof refused === 'string' && refused.length > 0, refused || 'it did not refuse');
  } else {
  const io = await page.evaluate(async () => {
    applyEdit(() => { workingNodes[0][1] = '__IO_PROBE__'; });
    const src = writeChart(await readOwnSource(true));
    const full = ensureFullDocument(src);
    applyEdit(() => { workingNodes[0][1] = '__CLOBBERED__'; });
    await importChartFromText(full);
    const restored = workingNodes[0][1];
    let rejected = false;
    const before = workingNodes[0][1];
    try { await importChartFromText('not a chart'); } catch(e){ rejected = true; }
    /* A file whose settings name no citation colour brings the default
       one, not the colour the replaced chart had been given. */
    const noRef = full.replace(/"refColor":"[^"]*",?/, '');
    applyEdit(() => { SETTINGS.refColor = '#123456'; });
    await importChartFromText(noRef);
    const refAfter = refColor();
    return {restored, rejected, intact: workingNodes[0][1] === before,
            stripped: noRef !== full, refAfter, refDefault: DEFAULT_REF_COLOR,
            isDoc: /^<!doctype html>/i.test(full), fragment: !/^<!doctype/i.test(src)};
  });
  check('the test file really names no citation colour', io.stripped);
  eq('an import with no citation colour has the default one', io.refAfter, io.refDefault);
  eq('export/import round-trips', io.restored, '__IO_PROBE__');
  check('export is a real document', io.isDoc);
  check('what we publish stays a fragment', io.fragment);
  check('a junk import is refused without damage', io.rejected && io.intact);
  }

  });
  /* ---- 10b. a chart is brought to this page's form where it comes in ----
   *
   * The steps that carry an old chart forward (MIGRATIONS, 02-model.js) run
   * where a chart enters — opening, an import, a kept draft put back — and
   * only for a chart whose form number says it needs them. They used to run
   * at the top of every build, on every chart. */
  await scenario("a chart is brought to this page's form where it comes in", async () => {
  const r = await page.evaluate(async () => {
    const kept = JSON.parse(JSON.stringify(chartData()));
    const out = {};
    const file = (settings, shape, styles) => [
      '/* @@EDIT:NODES:START@@ */',
      'const NODES = [',
      `  ['mg1', 'Old pocket', null, null, null, ${shape}, {pos:[0, 0], tags:['local-multiverse']}],`,
      "  ['mg2', 'Its child', 'mg1', null, null, null, {pos:[320, 0]}],",
      '];',
      '/* @@EDIT:NODES:END@@ */',
      '/* @@EDIT:EDGESTYLES:START@@ */',
      'const EDGE_STYLES = ' + styles + ';',
      '/* @@EDIT:EDGESTYLES:END@@ */',
      '/* @@EDIT:SETTINGS:START@@ */',
      'const SETTINGS = ' + settings + ';',
      '/* @@EDIT:SETTINGS:END@@ */'].join('\n');
    const leader = "[{from:'mg1', to:'mg2', note:'a remark', notePos:'leader', noteAt:0.5}]";

    // A file from before the form had a number.
    importChartFromText(file("{refColor:'#c23b22'}", "'pocket'", leader));
    const a = workingNodes.find(n => n[0] === 'mg1');
    const st = EDGE_STYLES.find(x => x.from === 'mg1' && x.to === 'mg2');
    out.old = {shape: a[5], border: a[6].border, tags: a[6].tags,
               callout: workingNodes.some(n => n[5] === 'callout' && n[1] === 'a remark'),
               styleNote: st ? st.notePos || null : 'gone', format: SETTINGS.format, want: DATA_FORMAT};

    // A file in this page's form is taken as written — an old spelling in
    // it is what it says, not something to be corrected.
    importChartFromText(file('{format: ' + DATA_FORMAT + ", refColor:'#c23b22'}", 'null', '[]'));
    out.current = {tags: workingNodes.find(n => n[0] === 'mg1')[6].tags};

    // And drawing never rewrites the chart: an old shape written into the
    // working copy now stays what it was written as.
    applyEdit(() => { workingNodes.find(n => n[0] === 'mg1')[5] = 'pocket'; });
    rebuildChart();
    out.drawnKeeps = workingNodes.find(n => n[0] === 'mg1')[5];

    // A draft kept by an older page is put back in its own form, then
    // brought forward.
    const draft = JSON.parse(JSON.stringify(chartData()));
    delete draft.settings.format;
    draft.nodes.find(n => n[0] === 'mg1')[5] = 'mirror';
    draft.nodes.find(n => n[0] === 'mg1')[6].colors = ['#2f6fb5'];
    applyEdit(() => putChartData(draft));
    const m = workingNodes.find(n => n[0] === 'mg1');
    out.draft = {shape: m[5], bg: m[6].bg, format: SETTINGS.format};

    // Connector styles with no ends are refused, and the open chart kept.
    const before = workingNodes.length;
    try{ importChartFromText(file("{refColor:'#c23b22'}", 'null', "[{to:'mg2'}]")); out.noEnds = 'taken'; }
    catch(e){ out.noEnds = e.message; }
    out.keptAfterRefusal = workingNodes.length === before;
    // A ring that is not a whole number puts the end on the outer border.
    out.ring = [edgeStyleFor('x', 'y'), (EDGE_STYLES.push({from:'rg1', to:'rg2', fromRing: NaN, toRing: 1.5}), edgeStyleFor('rg1', 'rg2'))]
      .map(o => [o.fromRing, o.toRing]);
    EDGE_STYLES.pop();

    applyEdit(() => putChartData(kept));
    rebuildChart();
    return out;
  });
  check('a file from before the form had a number is brought forward as it is imported',
        r.old.shape === null && r.old.border === 'wavy' && r.old.tags.join() === 'local multiverse' &&
        r.old.callout && r.old.styleNote === null && r.old.format === r.old.want, JSON.stringify(r.old));
  check('a file in this page\'s form is taken as written', r.current.tags.join() === 'local-multiverse', JSON.stringify(r.current));
  check('and drawing the chart no longer rewrites it', r.drawnKeeps === 'pocket', r.drawnKeeps);
  check('a draft kept by an older page is brought forward as it is put back',
        r.draft.shape === null && JSON.stringify(r.draft.bg) === '["#2f6fb5"]' && r.draft.format === r.old.want, JSON.stringify(r.draft));
  check('a connector style that names no ends is refused, and the open chart kept',
        /both its ends/.test(r.noEnds) && r.keptAfterRefusal, r.noEnds);
  check('a ring that is not a whole number is the outer one', JSON.stringify(r.ring) === '[[0,0],[0,0]]', JSON.stringify(r.ring));

  /* Kept in this browser by a page from before the form had a number: the
     kept chart's form is its own, not the file's. */
  const c2 = await browser.newContext();
  try{
    await c2.addInitScript(() => { try { delete window.claude; } catch(e){} });
    const p2 = await c2.newPage();
    const e2 = []; p2.on('pageerror', e => e2.push(e.message));
    await p2.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil: 'load'});
    await p2.waitForFunction(() => typeof rebuildChart === 'function');
    await p2.evaluate(() => {
      const d = JSON.parse(JSON.stringify(chartData()));
      delete d.settings.format;
      d.nodes.push(['kp1', 'Kept pocket', null, null, null, 'pocket', {pos:[0, 900]}]);
      localStorage.setItem(eval('STORE_KEY'), JSON.stringify(d));
    });
    await p2.reload({waitUntil: 'load'});
    await p2.waitForFunction(() => typeof rebuildChart === 'function');
    const k = await p2.evaluate(() => { const n = workingNodes.find(x => x[0] === 'kp1');
      return n ? {shape: n[5], border: n[6].border, format: SETTINGS.format} : null; });
    check('a chart kept in this browser by an older page is brought forward as the page opens',
          !!k && k.shape === null && k.border === 'wavy' && k.format === r.old.want && e2.length === 0,
          JSON.stringify({k, e2}));
    await p2.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  } finally { await c2.close(); }
  });

  /* ---- 10c. a link to an array ----
   * An array has no drawer, so its link is on its bar; the link opens it
   * as an entry's opens the entry, and an entry may point at it. */
  await scenario("a link to an array", async () => {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(ok => setTimeout(ok, ms));
    const out = {};
    const keepHash = location.hash, keepView = {vx, vy, vs};
    applyEdit(() => {
      workingNodes.push(['lka_a', 'Linked one', null, null, null, null, {pos:[-3000, 4000]}]);
      workingNodes.push(['lka_b', 'Linked two', null, null, null, null, {pos:[-1400, 4900]}]);
      workingNodes.push(['lka_arr', '', null, null, null, 'array', {members:['lka_a', 'lka_b']}]);
      workingNodes.push(['lka_src', 'Points at the array', null, null, null, null, {pos:[-3000, 3600], link:'#entry=lka_arr'}]);
    });
    await wait(200);
    openStyleBar({kind:'node', id:'lka_arr'});
    const row = document.querySelector('#styleBar .style-bar-group[data-group="link"]');
    out.offered = !!row && !row.hidden;
    openStyleBar({kind:'node', id:'lka_a'});
    out.notForEntries = row.hidden;
    openStyleBar({kind:'node', id:'lka_arr'});
    let given = null;
    const realWrite = navigator.clipboard && navigator.clipboard.writeText;
    try{ navigator.clipboard.writeText = async t => { given = t; }; }catch(e){}
    row.querySelector('button').click();
    await wait(50);
    try{ if(realWrite) navigator.clipboard.writeText = realWrite; else delete navigator.clipboard.writeText; }catch(e){}
    out.link = given || location.href;
    out.names = /#entry=lka_arr$/.test(out.link);
    closeStyleBar();
    // Opened by its link: picked, and the whole of it in view.
    selectNode('lka_src');
    centreViewOn(9000, -9000, 1);
    location.hash = '#entry=lka_arr';
    await wait(150);
    const a = nodes.get('lka_arr'), sz = svgSize();
    out.opened = selectedId === 'lka_arr';
    out.inView = a.x * vs + vx >= 0 && a.y * vs + vy >= 0 && (a.x + a.w) * vs + vx <= sz.width && (a.y + a.h) * vs + vy <= sz.height;
    out.target = entryLinkTarget('#entry=lka_arr');
    history.replaceState(null, '', location.href.split('#')[0] + keepHash);
    applyEdit(() => {
      for(let k = workingNodes.length - 1; k >= 0; k--) if(/^lka_/.test(workingNodes[k][0])) workingNodes.splice(k, 1);
    });
    // The view as it was: later scenarios point at the chart by where it stood.
    vx = keepView.vx; vy = keepView.vy; vs = keepView.vs; applyTransform();
    return out;
  });
  check('an array\'s bar offers a link to it, and an entry\'s does not', r.offered && r.notForEntries, JSON.stringify(r));
  check('the link names the array', r.names, r.link);
  check('opened by it, the array is picked with the whole of it in view', r.opened && r.inView, JSON.stringify(r));
  check('and an entry may point at it', !!r.target && r.target.id === 'lka_arr', JSON.stringify(r.target));
  });

  /* ---- 11. no host: browser storage is the fallback ---- */
  await scenario("no host: browser storage is the fallback", async () => {
  {
    const c2 = await browser.newContext();
    await c2.addInitScript(() => { try { delete window.claude; } catch(e){} });
    const p2 = await c2.newPage();
    const e2 = []; p2.on('pageerror', e => e2.push(e.message));
    await p2.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(1200);
    await p2.evaluate(() => applyEdit(() => { workingNodes[0][1] = '__PERSIST__'; }));
    await p2.evaluate(() => saveNow());
    await wait(400);
    await p2.reload({waitUntil:'networkidle'});
    await wait(1200);
    const after = await p2.evaluate(() => ({label: workingNodes[0][1], dirty: isDirty()}));
    eq('save survives a reload with no host', after.label, '__PERSIST__');
    eq('and comes back clean', after.dirty, false);
    check('no page errors while unhosted', e2.length === 0, e2.join('; '));
    await p2.evaluate(() => { try { localStorage.clear(); } catch(e){} });
    await c2.close();
  }
  /* The page is not published to claude.ai any more, and does not ask a
     host anything: a page that finds an artifact host's global saves into
     the browser like any other copy, and never hands the host a version
     of itself. */
  {
    const c3 = await browser.newContext();
    await c3.addInitScript(() => {
      window.__asked = [];
      window.claude = {use: async (what) => { window.__asked.push(what);
        return {publish: async () => { window.__asked.push('publish'); }, save: async () => { window.__asked.push('save'); }}; }};
    });
    const p3 = await c3.newPage();
    const e3 = []; p3.on('pageerror', e => e3.push(e.message));
    await p3.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(1200);
    await p3.evaluate(() => applyEdit(() => { workingNodes[0][1] = '__NOT_PUBLISHED__'; }));
    await p3.evaluate(() => saveNow());
    await wait(400);
    const got = await p3.evaluate(() => ({asked: window.__asked.slice(), stored: !!readStoredChart(),
                                          readOnly: readOnlyView}));
    check('a host\'s global is not asked for anything, and Save goes to this browser',
          got.asked.length === 0 && got.stored && !got.readOnly, JSON.stringify(got));
    check('and no page errors beside one', e3.length === 0, e3.join('; '));
    await p3.evaluate(() => { try { localStorage.clear(); } catch(e){} });
    await c3.close();
  }

  });
  /* ---- 12. a wave is a line with a wave run along it ---- */
  await scenario("waves are one-sided semicircles", async () => {
  const waves = await page.evaluate(()=>{
    /* A straight run of 120, walked and pushed out along its own normal.
       What is checked is the arithmetic every wavy thing on the chart is
       drawn from: whole waves over the length, the amplitude asked for,
       both ends on the baseline. */
    const samples = sampleRounded([{x:0,y:0},{x:120,y:0}], EDGE_CORNER_R, EDGE_WAVE_LEN / WAVE_STEP_DIV);
    const total = samples[samples.length-1].s;
    const lam = waveLambda(total, EDGE_WAVE_LEN);
    const d = smoothPath(waveOffsetPoints(samples, EDGE_WAVE_PEAK, lam, 0, total, false), false);
    const nums = d.replace(/[ML]/g, ' ').trim().split(/[\s,]+/).map(Number);
    const ys = [];
    for(let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
    const peak = Math.max(...ys.map(Math.abs));
    const crossings = ys.filter((y, i)=> i > 0 && Math.sign(y) !== Math.sign(ys[i-1]) && Math.abs(y) > 1e-9).length;
    return {
      wholeWaves: Math.abs(total / lam - Math.round(total / lam)) < 1e-9,
      lam: +lam.toFixed(3), waves: Math.round(total / lam),
      peak: +peak.toFixed(3), wanted: EDGE_WAVE_PEAK,
      endsOnLine: Math.abs(ys[0]) < 0.02 && Math.abs(ys[ys.length-1]) < 0.02,
      bothSides: ys.some(y=> y > 0.5) && ys.some(y=> y < -0.5),
      crossings
    };
  });
  check('a line carries a whole number of waves', waves.wholeWaves, JSON.stringify(waves));
  check('and the wave swings exactly as far as it is meant to',
        Math.abs(waves.peak - waves.wanted) < 0.12, JSON.stringify(waves));
  check('it visits both sides of the line', waves.bothSides);
  check('and begins and ends on it', waves.endsOnLine);
  check('it crosses the line twice per wave',
        waves.crossings >= waves.waves * 2 - 1 && waves.crossings <= waves.waves * 2,
        JSON.stringify(waves));

  });
  /* ---- 13. tag categories ---- */
  await scenario("tag categories", async () => {
  const cats = await page.evaluate(async ()=>{
    applyEdit(()=>{
      workingNodes.push(['cat_a', 'Cat A', null, null, null, null, {pos:[600,600], tags:['probe-tag']}]);
      refill(TAG_CATS, []);
    });
    buildLegend();
    createCategory('Probe Cat');
    assignTagCategory('probe-tag', 'Probe Cat');
    buildLegend();
    const grouped = !!document.querySelector('.legend-group[data-cat="Probe Cat"] .legend-item[data-tag="probe-tag"]');
    // A tag a category declares must survive even with no entry carrying it.
    createTag('orphan-tag');
    buildLegend();
    const orphanListed = allTags.indexOf('orphan-tag') >= 0 &&
                         !!document.querySelector('.legend-item[data-tag="orphan-tag"]');
    // Removing a category must not remove its tags.
    removeCategory('Probe Cat');
    buildLegend();
    const tagSurvived = tagCounts.has('probe-tag');
    const catGone = !TAG_CATS.some(c=> c.name === 'Probe Cat');
    applyEdit(()=>{
      const i = workingNodes.findIndex(n=> n[0]==='cat_a');
      if(i>=0) workingNodes.splice(i,1);
      refill(TAG_CATS, []);
    });
    buildLegend();
    return {grouped, orphanListed, tagSurvived, catGone};
  });
  check('a tag can be filed into a category', cats.grouped);
  check('a category can declare a tag no entry carries yet', cats.orphanListed);
  check('deleting a category keeps its tags', cats.tagSurvived && cats.catGone, JSON.stringify(cats));

  });
  /* ---- 14. the note lives in the entry panel, not its settings ---- */
  await scenario("the note lives in the entry panel, not its settings", async () => {
  const notePlacement = await page.evaluate(async ()=>{
    const id = workingNodes[0][0];
    selectedId = id;
    const block = document.getElementById('detailNoteBlock');
    document.getElementById('detailEditToggle').click();
    await new Promise(r=> setTimeout(r, 250));
    const whileOpen = getComputedStyle(block).display;
    document.getElementById('detailEditToggle').click();
    await new Promise(r=> setTimeout(r, 250));
    return {whileOpen, afterClose: getComputedStyle(block).display};
  });
  eq('note is hidden while settings are open', notePlacement.whileOpen, 'none');
  check('note comes back when settings close', notePlacement.afterClose !== 'none');

  });
  /* ---- 15. connector notes take formatting ---- */
  await scenario("connector notes take formatting", async () => {
  const noteFmt = await page.evaluate(async ()=>{
    const a = workingNodes[0][0], b = workingNodes[1] ? workingNodes[1][0] : null;
    if(!b) return {skip:true};
    refill(EDGE_STYLES, [{from:a, to:b, note:'**B** *i* {{#c23b22|red}}', notePos:'above'}]);
    rebuildChart();
    await new Promise(r=> setTimeout(r, 400));
    const g = document.querySelector('.edge-note');
    if(!g) return {found:false};
    const sp = [...g.querySelectorAll('tspan')];
    const r = {
      found: true,
      bold: sp.some(t=> t.getAttribute('font-weight') === '700'),
      italic: sp.some(t=> t.getAttribute('font-style') === 'italic'),
      coloured: sp.some(t=> (t.getAttribute('style')||'').indexOf('#c23b22') >= 0),
      isRich: !!richFields.get('nodeEditorText')
    };
    refill(EDGE_STYLES, []);
    rebuildChart();
    await new Promise(r=> setTimeout(r, 300));
    return r;
  });
  if(noteFmt.skip){ check('connector note formatting (needs two entries)', true, 'skipped'); }
  else {
    check('a connector note renders bold, italic and colour',
          noteFmt.found && noteFmt.bold && noteFmt.italic && noteFmt.coloured, JSON.stringify(noteFmt));
    check('the connector note field is a rich field', noteFmt.isRich);
  }

  });
  /* ---- 16. the crop chooser ---- */
  await scenario("the crop chooser", async () => {
  const crop = await page.evaluate(()=>{
    cropNat = {w:400, h:200};
    resetCropSel();
    const start = Object.assign({}, cropSel);
    cropSel = {x:9999, y:9999, s:9999}; clampCropSel();
    const clamped = Object.assign({}, cropSel);
    cropSel = {x:-50, y:-50, s:10}; clampCropSel();
    const clampedLow = Object.assign({}, cropSel);
    return {start, clamped, clampedLow,
            aboveEverything: parseInt(getComputedStyle(document.getElementById('cropOverlay')).zIndex, 10)};
  });
  check('crop starts as the largest centred square',
        crop.start.s === 200 && crop.start.x === 100 && crop.start.y === 0, JSON.stringify(crop.start));
  check('crop cannot leave the picture',
        crop.clamped.x + crop.clamped.s <= 400 && crop.clamped.y + crop.clamped.s <= 200 &&
        crop.clampedLow.x >= 0 && crop.clampedLow.y >= 0, JSON.stringify(crop));
  check('the crop dialog sits above every panel that can open it',
        crop.aboveEverything >= 150, 'z-index ' + crop.aboveEverything);

  });
  /* ---- 17. links can only navigate ---- */
  await scenario("links can only navigate", async () => {
  const urls = await page.evaluate(()=>({
    js: safeUrl('javascript:alert(1)'),
    jsMixedCase: safeUrl('JaVaScRiPt:alert(1)'),
    data: safeUrl(' data:text/html,<script>x</script>'),
    https: safeUrl('https://example.com/a'),
    mailto: safeUrl('mailto:a@b.c')
  }));
  check('executable URL schemes are refused',
        urls.js === null && urls.jsMixedCase === null && urls.data === null, JSON.stringify(urls));
  check('navigational URL schemes are kept',
        urls.https === 'https://example.com/a' && urls.mailto === 'mailto:a@b.c');

  });
  /* ---- 18. wave arcs bulge away from the elbow ---- */
  await scenario("wave arcs bulge away from the elbow", async () => {
  const waveDir = await page.evaluate(()=>{
    // Down, then right. The inside of that elbow is up-and-right of the
    // turn, so "outward" means left of the vertical run and below the
    // horizontal one.
    const d = wavyPath([{x:0,y:0},{x:0,y:200},{x:200,y:200}]);
    const svgEl = document.getElementById('canvas');
    const el = document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d', d); el.setAttribute('fill','none'); svgEl.appendChild(el);
    const L = el.getTotalLength();
    let vOut=0, vIn=0, hOut=0, hIn=0;
    for(let t=0;t<=1;t+=0.004){
      const q = el.getPointAtLength(L*t);
      if(q.y>25 && q.y<185){ if(q.x<-0.4) vOut++; else if(q.x>0.4) vIn++; }
      if(q.x>25 && q.x<185){ if(q.y>200.4) hOut++; else if(q.y<199.6) hIn++; }
    }
    el.remove();
    /* Which side the FIRST arc of the run goes to still matters — it is
       what sets the phase, and it is still the outward side of the bend.
       The arcs after it alternate, so both sides are visited by design;
       what the elbow rule buys now is that the arc nearest the corner is
       the outward one. */
    const p0 = wavePts(d);
    return {vOut, vIn, hOut, hIn,
            firstCx: p0.length > Math.round(WAVE_STEP_DIV/4) ? p0[Math.round(WAVE_STEP_DIV/4)].x : null,
            balancedV: vOut > 0 && vIn > 0, balancedH: hOut > 0 && hIn > 0};
  });
  check('a wave visits both sides of the line it follows',
        waveDir.balancedV && waveDir.balancedH, JSON.stringify(waveDir));
  check('and its first arc still leans away from the bend',
        waveDir.firstCx !== null && waveDir.firstCx < 0, JSON.stringify(waveDir.firstCx));

  });
  /* ---- 19. the amalgam junction bead ---- */
  await scenario("the amalgam junction bead", async () => {
  const bead = await page.evaluate(async ()=>{
    const before = workingNodes.slice();
    applyEdit(()=>{
      workingNodes.push(['bd_a','A',null,null,null,null,{pos:[-300,-200],colors:['#c23b22']}]);
      workingNodes.push(['bd_b','B',null,null,null,null,{pos:[-60,-200],colors:['#2f6fb5']}]);
      workingNodes.push(['bd_c','C',null,null,null,null,{pos:[180,-200],colors:['#3fae4a']}]);
      workingNodes.push(['bd_am','Amalgam',['bd_a','bd_b','bd_c'],null,null,null,{merge:true, pos:[-60,60]}]);
    });
    await new Promise(r=> setTimeout(r, 700));
    // The JUNCTION's bead — the joints between neighbouring stretches now
    // carry beads of their own, and one of those comes first in the layer.
    const b = document.querySelector('.amalgam-junction[data-to="bd_am"]');
    const r = b ? {
      found: true,
      gradient: /^url\(#/.test(b.getAttribute('fill') || ''),
      // Painted last in its layer, so it covers the seams it exists to hide.
      last: b.parentNode.lastElementChild === b,
      // Sits on the junction the merged arrow starts from.
      onArrow: (()=>{
        const out = document.querySelector('.amalgam-out[data-to="bd_am"]');
        if(!out) return false;
        const d = out.getAttribute('d') || '';
        const m = /M([-\d.]+),([-\d.]+)/.exec(d);
        if(!m) return false;
        return Math.abs(+m[1] - +b.getAttribute('cx')) < 0.5 &&
               Math.abs(+m[2] - +b.getAttribute('cy')) < 0.5;
      })()
    } : {found:false};
    applyEdit(()=>{ workingNodes = before; });
    await new Promise(r=> setTimeout(r, 400));
    return r;
  });
  check('an amalgam junction gets a gradient bead, painted over the seam',
        bead.found && bead.gradient && bead.last && bead.onArrow, JSON.stringify(bead));

  });
  /* ---- 20. the crop chooser is round only for a portrait ---- */
  await scenario("the crop chooser is round only for a portrait", async () => {
  const cropShape = await page.evaluate(()=>{
    const frame = document.getElementById('cropFrame');
    const before = frame.className;
    frame.classList.add('circle');
    const round = getComputedStyle(frame).borderRadius;
    frame.classList.remove('circle');
    const square = getComputedStyle(frame).borderRadius;
    frame.className = before;
    return {round, square};
  });
  check('a circular crop frame is actually drawn round',
        /50%|9999/.test(cropShape.round) && /^0/.test(cropShape.square), JSON.stringify(cropShape));

  });
  /* ---- 21. callouts ---- */
  await scenario("callouts", async () => {
  const leader = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    applyEdit(()=>{
      workingNodes.push(['ld_a','A',null,null,null,null,{pos:[700,-300]}]);
      workingNodes.push(['ld_b','B','ld_a',null,null,null,{pos:[700,120]}]);
    });
    refill(EDGE_STYLES, []);
    rebuildChart();
    await new Promise(r=> setTimeout(r, 400));
    // Three of them on ONE connector, which the old one-per-edge note could
    // never do, plus an ordinary plate note that must be unaffected.
    applyEdit(()=>{
      for(let i=0;i<3;i++){
        workingNodes.push(['ld_c'+i, 'Remark ' + i, null, null, null, 'callout',
          {pos:[900 + i*40, -200 + i*140], leader:{from:'ld_a', to:'ld_b', at:0.25*(i+1)}}]);
      }
      EDGE_STYLES.push({from:'ld_a', to:'ld_b', note:'plate', notePos:'above'});
    });
    await new Promise(r=> setTimeout(r, 500));
    const gs = [...document.querySelectorAll('#edgeLayer .callout-leader[data-from="ld_a"][data-to="ld_b"]')];
    const out = {found: gs.length, plate: document.querySelectorAll('.edge-note').length};
    if(gs.length){
      const g = gs[0];
      out.parts = !!g.querySelector('.leader-dot') && !!g.querySelector('.leader-line');
      // The card is an ENTRY, with an entry's ports and edge handles.
      const card = document.querySelector('.node[data-id="ld_c0"]');
      out.isEntry = !!card && card.classList.contains('node-callout');
      nodeControlsOn('ld_c0');
      out.handles = card ? card.querySelectorAll('.node-handle').length : 0;
      out.leaderUnderCard = !!document.querySelector('#edgeLayer .callout-leader[data-id="ld_c0"]');
      // The anchor tracks the fraction it was given.
      const ys = gs.map(x=> +x.querySelector('.leader-dot').getAttribute('cy'))
                   .sort((a,b)=> a-b);
      out.tracks = ys[0] < ys[1] && ys[1] < ys[2];
      // A connector can be drawn to one, exactly as to any entry.
      applyEdit(()=>{ workingNodes.find(n=> n[0]==='ld_c0')[2] = 'ld_a'; });
      await new Promise(r=> setTimeout(r, 500));
      out.connected = !!document.querySelector('#edgeLayer path.edge.struct[data-to="ld_c0"]');
    }
    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    await new Promise(r=> setTimeout(r, 400));
    return out;
  });
  check('a connector carries as many callouts as you like', leader.found === 3, JSON.stringify(leader));
  check('each draws a dot and a line', leader.parts === true);
  check('and the plate note beside them is untouched', leader.plate === 1, 'plates ' + leader.plate);
  /* Three, not four: the side its own leader arrives at is already spoken
     for and offers no port. */
  check('a callout is an entry, with a handle on every free edge',
        leader.isEntry === true && leader.handles === 3,
        JSON.stringify({e:leader.isEntry, h:leader.handles}));
  check('each anchor follows the fraction it was given', leader.tracks === true);
  check('a connector can be drawn to a callout', leader.connected === true);
  check('the snap points run the line in twentieths, and not onto its ends',
        await page.evaluate(()=> LEADER_SNAPS.length === 19 &&
          LEADER_SNAPS[0] === 0.05 && LEADER_SNAPS[18] === 0.95 &&
          Math.abs(LEADER_SNAPS[4] - 0.25) < 1e-6));

  });
  /* ---- 22. references ---- */
  await scenario("references", async () => {
  const refs = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.slice();
    const beforeRefs = REFS.slice();
    refill(REFS, [{key:'r_one', title:'First', detail:'', url:''},
                  {key:'r_two', title:'Second', detail:'', url:''}]);
    applyEdit(()=>{
      workingNodes.push(['rf_a','Cites{{r:r_one}} and{{r:r_two}}',null,null,null,null,{pos:[900,-300]}]);
      workingNodes.push(['rf_b','Literal [3] brackets',null,null,null,null,{pos:[900,-140]}]);
    });
    rebuildChart();
    await new Promise(r=> setTimeout(r, 450));
    const marks = [...document.querySelectorAll('[data-id="rf_a"] .ref-mark')]
      .map(m=> ({t:m.textContent, k:m.dataset.ref}));
    const typedIsPlain = !document.querySelector('[data-id="rf_b"] .ref-mark');
    const mark = document.querySelector('[data-id="rf_a"] .ref-mark');
    deselect();
    await new Promise(r=> setTimeout(r, 150));
    const clickable = getComputedStyle(mark).pointerEvents === 'auto' &&
                      getComputedStyle(mark.closest('text')).pointerEvents === 'none';
    /* …and only while its own entry is the one being looked at. With a
       different entry open, everything this one wears is out of play —
       see the rule on body.entry-open. */
    selectNode('rf_b');
    await new Promise(r=> setTimeout(r, 200));
    const inertElsewhere = getComputedStyle(mark).pointerEvents === 'none';
    deselect();
    await new Promise(r=> setTimeout(r, 150));
    const translucent = +getComputedStyle(mark).opacity < 1;
    // Reordering renumbers every mark, because a mark stores a key.
    reorderRef('r_one', 'r_two', 'after');
    await new Promise(r=> setTimeout(r, 350));
    const after = [...document.querySelectorAll('[data-id="rf_a"] .ref-mark')]
      .map(m=> ({t:m.textContent, k:m.dataset.ref}));
    // The editor round-trip keeps the key, not the number.
    const div = document.createElement('div');
    div.innerHTML = inlineToHtml('x {{r:r_two}} y');
    const roundTrip = richHtmlToMarkup(div).indexOf('{{r:r_two}}') >= 0;
    /* Deleting a cited reference takes its marks with it. The confirmation
       is the page's own dialog now — window.confirm is unusable in a
       sandboxed frame — so the test accepts it the way a person would. */
    const pending = deleteRef('r_one');
    await new Promise(r=> setTimeout(r, 150));
    document.getElementById('askOk').click();
    await pending;
    await new Promise(r=> setTimeout(r, 350));
    const stripped = workingNodes.find(n=> n[0]==='rf_a')[1].indexOf('{{r:r_one}}') < 0;
    refill(REFS, beforeRefs);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    await new Promise(r=> setTimeout(r, 350));
    return {marks, typedIsPlain, clickable, inertElsewhere, translucent, after, roundTrip, stripped};
  });
  check('a citation renders as a numbered mark',
        refs.marks.length === 2 && refs.marks[0].t === '[1]' && refs.marks[1].t === '[2]',
        JSON.stringify(refs.marks));
  check('a bracketed number typed by hand is NOT a citation', refs.typedIsPlain);
  check('only the mark is clickable, not the text around it', refs.clickable);
  check('and only while its own entry is the one open', refs.inertElsewhere);
  check('the mark is translucent so the text still reads', refs.translucent);
  check('reordering the list renumbers every mark',
        (refs.after.find(m=> m.k==='r_one')||{}).t === '[2]' &&
        (refs.after.find(m=> m.k==='r_two')||{}).t === '[1]', JSON.stringify(refs.after));
  check('a citation survives the editor round-trip as its key', refs.roundTrip);
  check('deleting a reference removes its marks from the text', refs.stripped);

  });
