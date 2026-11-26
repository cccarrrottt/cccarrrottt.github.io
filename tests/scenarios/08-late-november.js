/* tests/scenarios/08-late-november.js — scenarios 152 to 170 of the suite.
 *
 * From 20.11 on: the page in another language, the field, the chart's own
 * fonts, the cloud drives, the field on an entry as the drawing, NSFW, the
 * arrow keys, hops, the lists of 22.11 and 23.11, the chart's own name.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */
  await scenario("the page in another language: a menu on the top bar, the page's own words translated, a person's left alone", async () => {
    const r = await page.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const out = {};
      const btn = document.getElementById('langToggle');
      /* A language is offered once most of the page is written in it
         (0.27.1: Russian was offered with nothing translated, and choosing
         it changed nothing). With English alone there is no button. */
      const kept = LANG_TABLES.ru;
      LANG_TABLES.ru = {name: 'Русский', strings: {'Save': 'Сохранить'}, total: 10};
      syncLangOffer();
      out.notReady = btn.hidden && !langReady('ru');
      setPageLang('ru');
      out.notChosen = pageLang === 'en';
      LANG_TABLES.ru = {name: 'Русский', total: 5, strings: {
        'Save': 'Сохранить', 'Undo (Ctrl+Z)': 'Отменить (Ctrl+Z)', 'About this project': 'О проекте',
        'Imported {0} {1}. Press Save to keep it.': 'Импортировано: {1} — {0}. Нажмите Сохранить.'}};
      syncLangOffer();
      out.ready = !btn.hidden && langReady('ru');
      /* Flags (the owner's list of 21.11): the button wears the flag of
         the language spoken, English the American one — the emoji an
         entry's language tab wears, in the emoji face (22.11, evening). */
      const flagOf = el=> { const f = el.querySelector('.lang-flag'); return f && f.textContent === flagForCode({en:'US', ru:'RU'}[f.dataset.flag]) &&
                                                                       /Noto Color Emoji/.test(getComputedStyle(f).fontFamily) ? f.dataset.flag : ''; };
      out.button = !!btn && flagOf(btn) === 'en' && btn.getAttribute('aria-label') === 'English';
      btn.click(); await wait(50);
      const menu = document.getElementById('langMenu');
      /* A menu, each language by its flag and its own name, one under the
         other, the one spoken ticked (22.11, night: not a row of flags). */
      const opts = [...menu.querySelectorAll('[data-lang]')];
      out.menu = menu.classList.contains('open') && opts.map(b=> flagOf(b) + ':' + b.querySelector('.lang-name').textContent).join('|') === 'en:English|ru:Русский' &&
                 opts[1].getBoundingClientRect().top >= opts[0].getBoundingClientRect().bottom - 1 &&
                 opts[0].getAttribute('aria-checked') === 'true' && getComputedStyle(opts[0], '::after').content !== 'none' &&
                 getComputedStyle(opts[1], '::after').content === 'none';
      menu.classList.remove('open');
      applyEdit(()=> workingNodes.push(['l19_a', 'Save', null, null, null, null, {pos:[191000, 191000]}]));
      await wait(100);
      menu.querySelector('[data-lang="ru"]').click(); await wait(50);
      out.ru = document.documentElement.lang === 'ru' && flagOf(btn) === 'ru' &&
               document.getElementById('saveBtn').textContent === 'Сохранить' &&
               document.querySelector('#touchTools [data-act="undo"]').getAttribute('title') === 'Отменить (Ctrl+Z)';
      out.stored = localStorage.getItem('rhizome.lang') === 'ru';
      // What the program writes later is caught as it lands, its pieces in the translation's order.
      const said = document.createElement('div');
      said.textContent = 'Imported 3 entries. Press Save to keep it.';
      document.body.appendChild(said); await wait(50);
      out.later = said.textContent === 'Импортировано: entries — 3. Нажмите Сохранить.';
      document.getElementById('aboutToggle').setAttribute('title', 'About this project'); await wait(50);
      out.rewritten = document.getElementById('aboutToggle').getAttribute('title') === 'О проекте';
      // The chart's own words are a person's.
      const label = [...document.querySelectorAll('.node[data-id="l19_a"] text tspan, .node[data-id="l19_a"] text')].map(t=> t.textContent).join('');
      out.chartKept = /Save/.test(label) && !/Сохранить/.test(label);
      menu.querySelector('[data-lang="en"]').click(); await wait(50);
      out.back = document.documentElement.lang === 'en' && document.getElementById('saveBtn').textContent === 'Save' &&
                 document.querySelector('#touchTools [data-act="undo"]').getAttribute('title') === 'Undo (Ctrl+Z)' &&
                 said.textContent === 'Imported 3 entries. Press Save to keep it.' && localStorage.getItem('rhizome.lang') === null;
      said.remove(); LANG_TABLES.ru = kept; syncLangOffer();
      undoLastEdit(); await wait(100);
      return out;
    });
    check('a language nearly all untranslated is not offered, and with English alone there is no button', r.notReady && r.notChosen && r.ready, JSON.stringify(r));
    check('a language button on the top bar opens a menu of the languages, each in its own words', r.button && r.menu, JSON.stringify(r));
    check('…chosen, the page says its own words in it, and is remembered', r.ru && r.stored, JSON.stringify(r));
    check('…including what it writes later, its pieces where the translation puts them, and a title written again', r.later && r.rewritten, JSON.stringify(r));
    check('…never the chart\'s own words, and back in English everything is as the program wrote it', r.chartKept && r.back, JSON.stringify(r));
  });
  await scenario("the field: whole pages round the entries, a page more where an entry is carried to the edge, a pan that stays on it", async () => {
    const r = await page.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const out = {};
      const f = chartField, W = FIELD_PAGE_W, H = FIELD_PAGE_H;
      const whole = v=> Math.abs(((v / W) % 1 + 1) % 1 - 0.5) < 1e-9;
      out.pages = whole(f.x0) && whole(f.x1) && Math.abs((((f.y0 / H) % 1) + 1) % 1 - 0.5) < 1e-9;
      out.holds = [...nodes.values()].every(n=> n.x >= f.x0 && n.y >= f.y0 && n.x + n.w <= f.x1 && n.y + n.h <= f.y1);
      const rect = document.getElementById('chartField');
      out.drawn = +rect.getAttribute('width') === f.x1 - f.x0 && +rect.getAttribute('x') === f.x0 &&
                  document.querySelector('#alignGrid rect').getAttribute('width') === rect.getAttribute('width');
      // An entry put just inside the right edge, then carried past it: a page more, on that side only.
      applyEdit(()=> workingNodes.push(['fld_a', 'Edge', null, null, null, null, {pos:[f.x1 - 200, (f.y0 + f.y1) / 2]}]));
      await wait(100);
      const before = Object.assign({}, chartField);
      out.sameBefore = before.x1 === f.x1;
      vs = 1; const n = nodes.get('fld_a');
      const sr = svg.getBoundingClientRect();
      vx = sr.width / 2 - (n.x + n.w / 2); vy = sr.height / 2 - (n.y + n.h / 2); applyTransform();
      const g = document.querySelector('.node[data-id="fld_a"]').getBoundingClientRect();
      const sx = g.x + g.width / 2, sy = g.y + g.height / 2;
      return {out, sx, sy, before, f: Object.assign({}, f)};
    });
    await page.mouse.move(r.sx, r.sy); await page.mouse.down();
    for(let i = 1; i <= 10; i++) await page.mouse.move(r.sx + i * 20, r.sy);
    const mid = await page.evaluate(()=> Object.assign({}, chartField));
    await page.mouse.up();
    await new Promise(ok=> setTimeout(ok, 150));
    const after = await page.evaluate(async ()=>{
      const f = chartField;
      const grown = Object.assign({}, f);
      // A pan far past the field stops with the middle of the view on its edge.
      const sr = svg.getBoundingClientRect();
      return {grown, W: sr.width, H: sr.height, vs, vx};
    });
    // Pan by the hand, far to the left (the chart to the right).
    await page.mouse.move(700, 500); await page.mouse.down();
    for(let i = 1; i <= 10; i++) await page.mouse.move(700 + i * 400, 500);
    await page.mouse.up();
    const pan = await page.evaluate(()=>{
      const sr = svg.getBoundingClientRect();
      const mid = (sr.width / 2 - vx) / vs;
      return {mid, x0: chartField.x0};
    });
    await page.evaluate(async ()=>{ undoLastEdit(); await new Promise(ok=> setTimeout(ok, 150)); });
    const back = await page.evaluate(()=> chartField.x1);
    const W = await page.evaluate(()=> FIELD_PAGE_W);
    check('the field is whole pages, holds every entry, and the grid is ruled on it', r.out.pages && r.out.holds && r.out.drawn, JSON.stringify(r.out));
    check('…an entry carried past its edge lays a page more on that side as it goes, and only there',
          r.out.sameBefore && mid.x1 === r.f.x1 + W && after.grown.x1 === r.f.x1 + W && after.grown.x0 === r.f.x0 && after.grown.y0 === r.f.y0,
          JSON.stringify([r.f, mid, after.grown]));
    check('…a pan stops with the middle of the view on the field', Math.abs(pan.mid - pan.x0) < 0.5, JSON.stringify(pan));
    check('…and the page goes again with the entry', back === r.f.x1, JSON.stringify([back, r.f.x1]));
  });
  await scenario("the owner's list of 20.11: a divider on the first line, a worn template that shows who wears it, a field of 2000 square, a parent's bead in the hand, a pencil and an eraser", async () => {
  const X = 230000, Y = 230000;
  await page.evaluate(([X, Y])=>{
    window.__k2011 = {nodes: workingNodes.map(x=> x.slice()), settings: JSON.parse(JSON.stringify(SETTINGS))};
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    applyEdit(()=>{
      workingNodes.push(['q20_n', 'Noted', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['q20_a', 'One', null, null, null, null, {pos:[X, Y + 300]}]);
      workingNodes.push(['q20_b', 'Two', null, null, null, null, {pos:[X + 260, Y + 300]}]);
      workingNodes.push(['q20_c', 'Three', null, null, null, null, {pos:[X + 520, Y + 300]}]);
      workingNodes.push(['q20_m', 'Merge', ['q20_a', 'q20_b', 'q20_c'], null, null, null, {merge:true, pos:[X + 160, Y + 500]}]);
      workingNodes.push(['q20_f', 'Shaped', null, null, null, null, {pos:[X + 900, Y], figure:{name:'Q20 blob', d:'M0,0 L10,0 L10,10 Z'}}]);
      workingNodes.push(['q20_g', 'Shaped far', null, null, null, null, {pos:[X + 9000, Y], figure:{name:'Q20 blob', d:'M0,0 L10,0 L10,10 Z'}}]);
    });
    rebuildChart();
    selectNode('q20_n');
    return true;
  }, [X, Y]);
  await page.waitForTimeout(300);
  try{
  /* 1. Three dashes and Enter on the first line of a field emptied by
     hand make a divider, as on any other line. */
  await page.click('#detailNoteEdit'); await page.waitForTimeout(150);
  await page.keyboard.type('x');
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
  await page.keyboard.type('---'); await page.keyboard.press('Enter');
  await page.keyboard.type('below');
  await page.waitForTimeout(650);
  const firstRule = await page.evaluate(()=> (nodes.get('q20_n') || {}).note);
  await page.evaluate(()=>{ deselect(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await page.waitForTimeout(150);

  /* 2. The × of a template worn by an entry answers: it says why, and
     the view goes to the nearest entry drawn with it, lit a moment. */
  const worn = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    openFigureMenu(true); await wait(100);
    const b = [...document.querySelectorAll('.figure-template')].find(x=> /Q20 blob/.test(x.textContent));
    const x = b && b.querySelector('.figure-template-drop');
    const clickable = !!x && x.getAttribute('aria-disabled') !== 'true' && getComputedStyle(x).cursor !== 'default';
    if(x) x.click();
    await wait(80);
    const msg = document.getElementById('saveState') ? document.getElementById('saveState').textContent : '';
    const lit = !!document.querySelector('.node.beacon[data-id="q20_f"]') && !document.querySelector('.node.beacon[data-id="q20_g"]');
    const sr = svg.getBoundingClientRect(), n = nodes.get('q20_f');
    const mid = {x: (sr.width / 2 - vx) / vs, y: (sr.height / 2 - vy) / vs};
    const centred = Math.abs(mid.x - (n.x + n.w / 2)) < 1 && Math.abs(mid.y - (n.y + n.h / 2)) < 1;
    const kept = cleanFigureTemplates(SETTINGS.figures).some(t=> t.d === 'M0,0 L10,0 L10,10 Z') ||
                 workingNodes.some(e=> e[6] && e[6].figure && e[6].figure.name === 'Q20 blob');
    await wait(1900);
    const goes = !document.querySelector('.node.beacon');
    return {clickable, msg, lit, centred, kept, goes};
  });

  /* 3. The field is pages of 2000 by 2000. */
  const page2000 = await page.evaluate(()=> FIELD_PAGE_W === 2000 && FIELD_PAGE_H === 2000 &&
    (chartField.x1 - chartField.x0) % 2000 === 0 && (chartField.y1 - chartField.y0) % 2000 === 0);

  /* 4. A parent carried: the bead where its line meets the bar swells,
     and only while it is in the hand. */
  await page.evaluate(([X, Y])=>{ vs = 1; vx = -X + 200; vy = -Y + 100; applyTransform(); }, [X, Y]);
  await page.waitForTimeout(150);
  const pb = await page.evaluate(()=>{ const r = document.querySelector('.node[data-id="q20_b"] rect').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const beadBefore = await page.evaluate(()=> document.querySelectorAll('.amalgam-joint.bead-carried').length);
  await page.mouse.move(pb[0], pb[1]); await page.mouse.down();
  await page.mouse.move(pb[0] + 10, pb[1], {steps:3}); await page.mouse.move(pb[0] + 24, pb[1], {steps:3});
  await page.waitForTimeout(80);
  const beadIn = await page.evaluate(()=>{
    const c = document.querySelector('.amalgam-joint.bead-carried');
    return c ? {lands: c.dataset.lands, scale: getComputedStyle(c).transform} : null;
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const beadAfter = await page.evaluate(()=> document.querySelectorAll('.bead-carried').length);
  await page.evaluate(()=> undoLastEdit());
  await page.waitForTimeout(150);

  /* 5. The pencil writes over everything, the entry under it untouched;
     the eraser takes the stroke it passes; each is one edit; the strokes
     are saved with the chart, and a reader sees them and holds neither. */
  await page.click('#inkPen');
  const nb = await page.evaluate(()=>{ const r = document.querySelector('.node[data-id="q20_n"] rect').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await page.mouse.move(nb[0] - 20, nb[1] + nb[3] / 2); await page.mouse.down();
  for(let i = 1; i <= 12; i++) await page.mouse.move(nb[0] - 20 + i * 12, nb[1] + nb[3] / 2 + (i % 2 ? 6 : -6));
  await page.mouse.up();
  await page.waitForTimeout(100);
  const pen = await page.evaluate(()=>({
    n: (SETTINGS.ink || []).length, drawn: document.querySelectorAll('#inkLayer .ink-stroke').length,
    entryStays: !selectedId && Math.abs(nodes.get('q20_n').x - 230000) < 1,
    onTop: [nodeLayer, frontLayer, edgeLayer].every(l=> [...viewport.children].indexOf(document.getElementById('inkLayer')) > [...viewport.children].indexOf(l)),
    saved: /"ink":\[\{"pts":\[/.test(chartFileText()),
    onField: (SETTINGS.ink || []).every(s=> s.pts.every((v, i)=> i % 2 ? v >= chartField.y0 && v <= chartField.y1 : v >= chartField.x0 && v <= chartField.x1))
  }));
  await page.click('#inkEraser');
  await page.mouse.move(nb[0] + 40, nb[1] - 30); await page.mouse.down();
  await page.mouse.move(nb[0] + 40, nb[1] + nb[3] + 30, {steps:12}); await page.mouse.up();
  await page.waitForTimeout(100);
  const erased = await page.evaluate(()=> (SETTINGS.ink || []).length);
  await page.evaluate(()=> undoLastEdit()); await page.waitForTimeout(100);
  const undone = await page.evaluate(()=>({n: (SETTINGS.ink || []).length, drawn: document.querySelectorAll('#inkLayer .ink-stroke').length}));
  await page.keyboard.press('Escape');
  const reader = await page.evaluate(async ()=>{
    setReaderPreview(true); await new Promise(ok=> setTimeout(ok, 150));
    const r = {sees: document.querySelectorAll('#inkLayer .ink-stroke').length,
               noTools: getComputedStyle(document.getElementById('inkPen')).display === 'none' &&
                        getComputedStyle(document.getElementById('inkEraser')).display === 'none',
               down: !inkTool};
    setReaderPreview(false); await new Promise(ok=> setTimeout(ok, 150));
    return r;
  });

  check('three dashes and Enter make a divider on the very first line too, a field emptied by hand included (20.11)',
        firstRule === '{{hr:solid}}\nbelow', JSON.stringify(firstRule));
  check('a worn template\'s × still answers: it says why it stays, and shows the nearest entry drawn with it, lit a moment (20.11)',
        worn.clickable && /can.t be taken out/.test(worn.msg) && worn.lit && worn.centred && worn.kept && worn.goes, JSON.stringify(worn));
  check('the field is laid in pages of 2000 by 2000 (20.11)', page2000);
  check('a parent carried swells the bead where its line meets the bar, and only while it is in the hand (20.11)',
        beadBefore === 0 && !!beadIn && beadIn.lands === 'q20_b' && /matrix\(1\.6/.test(beadIn.scale) && beadAfter === 0,
        JSON.stringify({beadBefore, beadIn, beadAfter}));
  check('the pencil writes over the chart, leaving the entry under it be, and the stroke is saved with the chart (20.11)',
        pen.n === 1 && pen.drawn === 1 && pen.entryStays && pen.onTop && pen.saved && pen.onField, JSON.stringify(pen));
  check('…the eraser takes the stroke it passes over, and either is undone as one edit',
        erased === 0 && undone.n === 1 && undone.drawn === 1, JSON.stringify({erased, undone}));
  check('…and a reader sees the strokes, holding neither tool', reader.sees === 1 && reader.noTools && reader.down, JSON.stringify(reader));
  } finally {
    await page.evaluate(()=>{
      if(inkTool) setInkTool(null);
      const k = window.__k2011;
      workingNodes = k.nodes;
      Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]); Object.assign(SETTINGS, k.settings);
      rebuildChart();
      delete window.__k2011;
      return true;
    });
  }
  });

  await scenario("the chart's own fonts: in My files under a heading of their own, brought in by its +, offered wherever a face is chosen, kept while worn", async () => {
  const f = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const keep = {nodes: workingNodes.map(e=> e.slice()), settings: JSON.parse(JSON.stringify(SETTINGS))};
    const r = {};
    try{
      /* Autobot Characters is the owner's chart's own face now, a file in
         media/ rather than a data: URI in the stylesheet. */
      const auto = fontOptions().find(x=> x.key === 'autobot');
      r.autobot = !!auto && auto.own && /^media\/[0-9a-f]{64}\.ttf$/.test(auto.src);
      r.cssClean = ![...document.styleSheets].some(sh=>{ try{ return [...sh.cssRules].some(x=> /Autobot/.test(x.cssText)); }catch(e){ return false; } });
      const bytes = await (await fetch(auto.src)).arrayBuffer();
      applyEdit(()=>{ delete SETTINGS.fonts; });
      r.gone = !fontOptions().some(x=> x.own);
      applyEdit(()=>{ workingNodes.push(['q20f_n', 'Faced', null, null, null, null, {pos: {x: 240000, y: 240000}}]); });
      document.getElementById('filesToggle').click(); await wait(200);
      r.heading = [...document.querySelectorAll('#stickerOverlay .files-section .files-head > span:first-child')].map(e=> e.textContent).join();
      r.accept = document.getElementById('stickerFile').accept;
      await addOwnFonts([new File([bytes], 'My Face.ttf'), new File([new Uint8Array([1, 2, 3, 4])], 'Broken.otf')]);
      await wait(200);
      const mine = fontOptions().find(x=> x.key === 'my-face');
      r.added = !!mine && mine.label === 'My Face' && /^data:font\/ttf;base64,/.test(mine.src);
      r.refusedBad = /Broken\.otf/.test(document.getElementById('fontStatus').textContent) && fontOptions().filter(x=> x.own).length === 1;
      r.cell = !!document.querySelector('#fontGrid .font-cell[data-font="my-face"] .font-sample') &&
               getComputedStyle(document.querySelector('#fontGrid .font-cell[data-font="my-face"] .font-sample')).fontFamily.includes('My Face');
      /* Offered by a toolbar's face list, and drawn when chosen. */
      const sel = document.querySelector('#nodeEditorBar .tb-font:not(.tb-size)');
      fillFaceSelect(sel);
      r.offered = [...sel.options].some(o=> o.value === 'my-face' && o.textContent === 'My Face');
      applyEdit(()=>{ workingNodes.find(e=> e[0] === 'q20f_n')[1] = '{{f:my-face|Faced}}'; });
      await document.fonts.ready; await wait(300);
      r.drawn = [...document.querySelectorAll('.node[data-id="q20f_n"] .node-label-text tspan')]
        .some(t=> /My Face/.test(t.getAttribute('style') || ''));
      r.loaded = [...document.fonts].some(x=> x.family.replace(/["']/g, '') === 'My Face' && x.status === 'loaded');
      /* Kept while anything is set in it; taken out once nothing is. */
      renderStickerLibrary(); await wait(50);
      document.querySelector('#fontGrid .font-cell[data-font="my-face"] .sticker-del').click();
      r.kept = /can.t be taken out/.test(document.getElementById('fontStatus').textContent) && fontOptions().some(x=> x.key === 'my-face');
      r.picture = /@font-face\{font-family:'My Face';src:url\(data:font\/ttf/.test(await pictureFontCss(chartPictureSvg().copy));
      r.saved = /"fonts":\[\{"key":"my-face","name":"My Face","src":"data:font\/ttf;base64,/.test(chartFileText());
      applyEdit(()=>{ workingNodes.find(e=> e[0] === 'q20f_n')[1] = 'Faced'; });
      renderStickerLibrary(); await wait(50);
      document.querySelector('#fontGrid .font-cell[data-font="my-face"] .sticker-del').click();
      await wait(50);
      r.removed = !fontOptions().some(x=> x.own) && !('fonts' in SETTINGS);
      undoLastEdit(); await wait(50);
      r.undone = fontOptions().some(x=> x.key === 'my-face');
      /* A file of the chart's that is a font is no picture. */
      r.notPicture = !mediaSrcOk(auto.src) && fontSrcOk(auto.src) && mediaRefKind(auto.src) === 'font';
      r.reader = await (async ()=>{
        setReaderPreview(true); await wait(150);
        renderStickerLibrary();
        const x = {cells: document.querySelectorAll('#fontGrid .font-cell').length,
                   del: document.querySelectorAll('#fontGrid .sticker-del').length};
        setReaderPreview(false); await wait(150);
        return x;
      })();
    } finally {
      document.getElementById('stickerOverlay').classList.remove('open');
      workingNodes = keep.nodes;
      Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]); Object.assign(SETTINGS, keep.settings);
      rebuildChart();
    }
    return r;
  });
  check('Autobot Characters is the chart\'s own face, a file in media/, and the stylesheet no longer carries it',
        f.autobot && f.cssClean, JSON.stringify([f.autobot, f.cssClean]));
  check('My files has a Fonts heading, and its + takes font files beside pictures',
        /Fonts/.test(f.heading) && /\.ttf/.test(f.accept) && /\.woff2/.test(f.accept), JSON.stringify([f.heading, f.accept]));
  check('a font brought in is listed set in itself, and a file that is no font is refused with its name',
        f.gone && f.added && f.cell && f.refusedBad, JSON.stringify(f));
  check('…it is offered in a field\'s face list, and words set in it are drawn in it',
        f.offered && f.drawn && f.loaded, JSON.stringify([f.offered, f.drawn, f.loaded]));
  check('…it stays while anything is set in it, and goes once nothing is, undone as one edit',
        f.kept && f.removed && f.undone, JSON.stringify([f.kept, f.removed, f.undone]));
  check('…it is saved with the chart and carried into a picture of it, and a font file is never taken for a picture',
        f.saved && f.picture && f.notPicture, JSON.stringify([f.saved, f.picture, f.notPicture]));
  check('…and a reader sees the fonts but cannot take one out',
        f.reader.cells >= 1 && f.reader.del === 0, JSON.stringify(f.reader));
  });

  /* The owner's cloud drives on the site (0.26.2): connected from My files,
     looked through in a window of their own, a picture picked from one
     kept in My files with the drive's mark, at the write service's
     address. The service is answered from here; its own half is in
     tests/worker.js. */
  await scenario("the owner's cloud drives on the published site", async () => {
  if(MODE === 'src'){
    check('the site serves the built file, so there is nothing to check from src', true);
    return;
  }
  const config = fs.readFileSync(path.join(ROOT, 'src', 'app', '00-config.js'), 'utf8');
  const SITE_ORIGIN = /^\s*site: '([^']+)'/m.exec(config)[1];
  const SITE_API = /^\s*api: '([^']*)'/m.exec(config)[1].replace(/\/+$/, '');
  const html = withFixture(fs.readFileSync(path.join(DIR, PAGE), 'utf8'));
  const dataRaw = FIXTURE_RAW;
  const dataSha = require('crypto').createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${dataRaw.length}\0`), dataRaw])).digest('hex');
  const api = {connected: [], asked: [], fileAsked: 0};
  const c = await browser.newContext({viewport:{width:1500, height:950}, serviceWorkers: 'block'});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await c.route('https://fonts.googleapis.com/**', quiet);
  await c.route('https://fonts.gstatic.com/**', quiet);
  await c.route(/^https:\/\/github\.com\/[^/]+\.png/, r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  await c.route('https://api.github.com/**', r => r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'}, contentType: 'application/json', body: '[]'}));
  await c.route(SITE_ORIGIN + '/**', r => {
    const u = new URL(r.request().url());
    const m = /^\/(media\/[0-9a-f]{64}\.[a-z0-9]+)$/.exec(u.pathname);
    if(m && mediaFile(m[1])) return r.fulfill({status: 200, body: fs.readFileSync(mediaFile(m[1]))});
    return r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
  });
  await c.route(SITE_API + '/**', async r => {
    const q = r.request(), u = new URL(q.url());
    const cors = {'Access-Control-Allow-Origin': SITE_ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'};
    const reply = (status, body) => r.fulfill({status, headers: cors, contentType: 'application/json', body: JSON.stringify(body)});
    if(q.method() === 'OPTIONS') return r.fulfill({status: 204, headers: cors});
    if(/^\/cloud\/gdrive\/file\/pic[12]$/.test(u.pathname)){ api.fileAsked++; return r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'}, contentType: 'image/png', body: TINY_PNG}); }
    if(u.pathname === '/cloud/gdrive/connect'){
      api.asked.push('connect ' + u.searchParams.get('ticket'));
      return r.fulfill({status: 200, contentType: 'text/html', body:
        `<script>opener.postMessage({rhizomeCloud:{cloud:'gdrive', grant:'the-grant'}}, ${JSON.stringify(SITE_ORIGIN)}); close();</script>`});
    }
    if(u.pathname === '/cloud/gdrive/picker'){
      api.asked.push('picker ' + u.searchParams.get('ticket'));
      return r.fulfill({status: 200, contentType: 'text/html', body:
        `<script>opener.postMessage({rhizomePicked:{cloud:'gdrive', files:[{id:'pic2', name:'Bumblebee.png'}]}}, ${JSON.stringify(SITE_ORIGIN)}); close();</script>`});
    }
    if(q.headers()['authorization'] !== 'Bearer good-session') return reply(401, {error: 'not signed in.'});
    api.asked.push(u.pathname + ' ' + (q.postData() || ''));
    if(u.pathname === '/cloud/gdrive/picker-ticket') return reply(200, {ticket: 'ptk'});
    if(u.pathname === '/me') return reply(200, {owner: true, login: 'the-owner', sha: dataSha, media: true,
                                                clouds: {ready: ['gdrive', 'yadisk'], connected: api.connected}});
    if(u.pathname === '/cloud/gdrive/ticket') return reply(200, {ticket: 'tkt'});
    if(u.pathname === '/cloud/gdrive/attach'){
      if(JSON.parse(q.postData()).grant !== 'the-grant') return reply(400, {error: 'no'});
      api.connected = ['gdrive'];
      return reply(200, {connected: api.connected});
    }
    if(u.pathname === '/cloud/gdrive/list'){
      const folder = JSON.parse(q.postData()).folder;
      return reply(200, {items: folder === 'fold1'
        ? [{id: 'pic1', name: 'Optimus.png', kind: 'image', mime: 'image/png', thumb: null}]
        : [{id: 'fold1', name: 'Pictures', kind: 'folder'}, {id: 'vid1', name: 'Clip.mp4', kind: 'video', mime: 'video/mp4'}]});
    }
    if(u.pathname === '/cloud/gdrive/pick'){
      const id = JSON.parse(q.postData()).id;
      return reply(200, {src: SITE_API + '/cloud/gdrive/file/' + id, name: id === 'pic2' ? 'Bumblebee.png' : 'Optimus.png', kind: 'image'});
    }
    if(u.pathname === '/cloud/gdrive/forget'){ api.connected = []; return reply(200, {connected: []}); }
    return reply(404, {error: 'not found'});
  });
  await c.addInitScript(([origin]) => {
    if(location.origin === origin) try{ localStorage.setItem('rhizome.site.session', 'good-session'); }catch(e){}
  }, [SITE_ORIGIN]);
  const errs = [];
  const site = await c.newPage();
  site.on('pageerror', e => errs.push(e.message));
  site.on('console', m => { if(/Content Security Policy/i.test(m.text())) errs.push(m.text()); });
  try{
    await site.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
    await site.waitForFunction(() => typeof rebuildChart === 'function' && !readOnlyView, null, {timeout: 8000});
    await site.click('#filesToggle');
    await wait(200);
    const before = await site.evaluate(() => ({
      buttons: [...document.querySelectorAll('#filesClouds .cloud-btn')].map(b => b.dataset.cloud + (b.classList.contains('connected') ? '+' : '-')).join(),
      marks: document.querySelectorAll('#filesClouds .cloud-btn svg').length
    }));
    await site.click('#filesClouds .cloud-btn[data-cloud="gdrive"]');
    await site.waitForFunction(() => document.getElementById('cloudOverlay').classList.contains('open') &&
                                      document.querySelectorAll('#cloudGrid .cloud-item').length === 2, null, {timeout: 8000});
    const browsing = await site.evaluate(() => ({
      items: [...document.querySelectorAll('#cloudGrid .cloud-item')].map(c => c.dataset.kind + ':' + c.textContent.trim()).join(),
      title: document.getElementById('cloudTitle').textContent, up: document.getElementById('cloudUp').disabled,
      row: [...document.querySelectorAll('#filesClouds .cloud-btn')].map(b => b.dataset.cloud + (b.classList.contains('connected') ? '+' : '-')).join()
    }));
    await site.click('#cloudGrid .cloud-item[data-kind="folder"]');
    await site.waitForFunction(() => document.querySelector('#cloudGrid .cloud-item[data-id="pic1"]'), null, {timeout: 8000});
    const inFolder = await site.evaluate(() => ({path: document.getElementById('cloudPath').textContent, up: document.getElementById('cloudUp').disabled}));
    await site.click('#cloudGrid .cloud-item[data-id="pic1"]');
    await site.waitForFunction(() => MEDIA.some(m => /\/cloud\/gdrive\/file\/pic1$/.test(m.src)), null, {timeout: 8000});
    await site.click('#cloudGrid .cloud-item[data-id="pic1"]');
    await wait(300);
    const picked = await site.evaluate(api => {
      const m = MEDIA.filter(x => /\/cloud\/gdrive\/file\/pic1$/.test(x.src));
      document.getElementById('cloudBack').click();
      const cell = [...document.querySelectorAll('#filesGrid .file-cell')].find(x => x.querySelector('img') && /pic1$/.test(x.querySelector('img').src));
      return {n: m.length, src: m[0] && m[0].src, kind: m[0] && m[0].kind, name: m[0] && m[0].name,
              status: document.getElementById('cloudStatus').textContent,
              mark: !!cell && !!cell.querySelector('.file-cloud[data-cloud="gdrive"] svg'),
              open: document.getElementById('stickerOverlay').classList.contains('open'),
              dirty: isDirty()};
    });
    await site.click('#filesClouds .cloud-off[data-cloud="gdrive"]');
    await wait(300);
    const after = await site.evaluate(() => ({
      row: [...document.querySelectorAll('#filesClouds .cloud-btn')].map(b => b.dataset.cloud + (b.classList.contains('connected') ? '+' : '-')).join(),
      kept: MEDIA.some(m => /\/cloud\/gdrive\/file\/pic1$/.test(m.src))
    }));
    /* With Google's Picker set up (/me's `picker`), the connected drive's
       button opens Google's window on the service instead of the folders,
       and what was picked there comes back to be shared like a file from them. */
    await site.evaluate(() => setCloudsFromService({ready: ['gdrive', 'yadisk'], connected: ['gdrive'], picker: ['gdrive']}));
    await site.click('#filesClouds .cloud-btn[data-cloud="gdrive"]');
    await site.waitForFunction(() => MEDIA.some(m => /\/cloud\/gdrive\/file\/pic2$/.test(m.src)), null, {timeout: 8000});
    const viaPicker = await site.evaluate(() => ({
      name: (MEDIA.find(m => /pic2$/.test(m.src)) || {}).name,
      folders: document.getElementById('cloudOverlay').classList.contains('open')
    }));
    await site.evaluate(() => setCloudsFromService({ready: ['gdrive', 'yadisk'], connected: [], picker: []}));
    const reader = await site.evaluate(async () => {
      setReaderPreview(true); await new Promise(ok => setTimeout(ok, 150));
      openStickerLibrary();
      const r = {hidden: document.getElementById('filesClouds').hidden};
      setReaderPreview(false); await new Promise(ok => setTimeout(ok, 150));
      return r;
    });
    check('on the site, the owner\'s My files offers each drive the service is set up for, with its mark, to connect',
          before.buttons === 'gdrive-,yadisk-' && before.marks === 2, JSON.stringify(before));
    check('…connecting one is a popup on a ticket, its grant attached to the session, and the drive opens to its top',
          api.asked.includes('connect tkt') && api.asked.some(a => /^\/cloud\/gdrive\/attach \{"grant":"the-grant"\}/.test(a)) &&
          browsing.items === 'folder:Pictures,video:Clip.mp4' && /Google Drive/.test(browsing.title) && browsing.up && browsing.row === 'gdrive+,yadisk-',
          JSON.stringify({asked: api.asked, browsing}));
    check('…a folder opens in the same window, and the way back up with it', inFolder.path === 'Pictures' && !inFolder.up, JSON.stringify(inFolder));
    check('…a picture picked is in My files once, at the service\'s address, with the drive\'s mark, waiting for Save',
          picked.n === 1 && picked.src === SITE_API + '/cloud/gdrive/file/pic1' && picked.kind === 'image' && picked.name === 'Optimus' &&
          picked.mark && picked.open && picked.dirty && /already/.test(picked.status), JSON.stringify(picked));
    check('…a drive let go is offered to connect again, and what came from it stays',
          after.row === 'gdrive-,yadisk-' && after.kept, JSON.stringify(after));
    check('…with Google\'s Picker, the drive opens Google\'s window on a ticket, and what is picked there is shared into My files',
          api.asked.some(a => /^\/cloud\/gdrive\/picker-ticket /.test(a)) && api.asked.includes('picker ptk') &&
          api.asked.some(a => /^\/cloud\/gdrive\/pick \{"id":"pic2"\}/.test(a)) && viaPicker.name === 'Bumblebee' && !viaPicker.folders,
          JSON.stringify({asked: api.asked, viaPicker}));
    check('…and a reader is offered no drive', reader.hidden, JSON.stringify(reader));
    check('nothing the cloud drives do is refused by the site\'s own policy, or throws', errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await c.close();
  }
  });

  /* The owner's video of 21.11: what is typed into the field on an entry
     looked unlike what the entry draws — a reading wider than its word
     pushed the word's letters apart, its rule was missing, a larger run
     opened a gap under its line. The field is meant to BE the drawing
     with a caret in it, so it is held to the drawing letter by letter:
     every letter the drawing sets, at its size, where the field sets it. */
  await scenario("the field on an entry is the drawing, letter for letter", async () => {
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.slice(), beforeStyles = EDGE_STYLES.slice();
    const was = {vx, vy, vs};
    const letters = {
      drawn(sel){
        const out = [];
        document.querySelectorAll(sel).forEach(t=>{
          if(t.querySelector('tspan')) return;
          const s = t.textContent, m = t.getScreenCTM();
          for(let i = 0; i < s.length; i++){
            if(/\s/.test(s[i])) continue;
            let e; try{ e = t.getExtentOfChar(i); }catch(err){ continue; }
            const p = new DOMPoint(e.x + e.width/2, e.y + e.height).matrixTransform(m);
            out.push([s[i], p.x, p.y]);
          }
        });
        return out;
      },
      typed(){
        /* Where the field LAYS its letters: each line's lift to the
           drawing's pixels (seatLinesOnPixels) is painting, and the
           pixels have a check of their own (the owner's list of 22.11,
           evening). */
        const seat = document.getElementById('nodeEditorSeat'), kept = seat ? seat.textContent : '';
        if(seat) seat.textContent = '';
        try{ return this.laid(); } finally { if(seat) seat.textContent = kept; }
      },
      laid(){
        const surf = richFields.get('nodeEditorText').surface, out = [];
        const w = document.createTreeWalker(surf, NodeFilter.SHOW_TEXT);
        let t;
        while((t = w.nextNode())){
          const s = t.textContent;
          for(let i = 0; i < s.length; i++){
            if(/\s/.test(s[i])) continue;
            const rg = document.createRange(); rg.setStart(t, i); rg.setEnd(t, i + 1);
            const q = rg.getBoundingClientRect();
            out.push([s[i], q.x + q.width/2, q.bottom]);
          }
        }
        return out;
      }
    };
    const apart = (a, b)=>{
      if(a.length !== b.length || !a.length) return 'letters ' + a.length + ' / ' + b.length;
      let worst = 0;
      for(let i = 0; i < a.length; i++){
        if(a[i][0] !== b[i][0]) return 'order at ' + i + ': ' + a[i][0] + b[i][0];
        worst = Math.max(worst, Math.abs(a[i][1] - b[i][1]), Math.abs(a[i][2] - b[i][2]));
      }
      return +worst.toFixed(2);
    };
    const out = {};
    const cases = {
      wide: '{{u:solid|{{#c020c0|Beast Wars:}} [[Up|a much longer reading]]rising фыву}}',
      lines: 'one\n[[two|r]] three\n{{z:16|bigger}} four\nfive',
      larger: 'a {{z:18|[[big|reading]]}} b\nc',
      dressed: '**bold** *it* {{z:8|tiny}} x'
    };
    try{
      for(const [k, label] of Object.entries(cases)){
        applyEdit(()=>{ workingNodes.push(['fd_' + k, label, null, null, null, null, {pos:[9000, 9000]}]); });
        rebuildChart();
        const n = nodes.get('fd_' + k), rect = svg.getBoundingClientRect();
        vs = 3; vx = -(n.x + n.w/2)*vs + rect.width/2; vy = -(n.y + n.h/2)*vs + rect.height/2; applyTransform();
        const drawn = letters.drawn(`.node[data-id="fd_${k}"] text tspan`);
        selectedId = 'fd_' + k; openNodeEditor(selectedId);
        await new Promise(res=> setTimeout(res, 150));
        out[k] = apart(drawn, letters.typed());
        if(k === 'wide'){
          const rt = richFields.get('nodeEditorText').surface.querySelector('rt');
          out.ruled = getComputedStyle(rt).textDecorationLine;
        }
        closeNodeEditor(false);
        applyEdit(()=>{ workingNodes = workingNodes.filter(x=> x[0] !== 'fd_' + k); });
      }
      applyEdit(()=>{
        workingNodes.push(['fd_a', 'A', null, null, null, null, {pos:[9000, 8700]}]);
        workingNodes.push(['fd_b', 'B', 'fd_a', null, null, null, {pos:[9000, 9000]}]);
        EDGE_STYLES.push({from:'fd_a', to:'fd_b', note:'a {{u:solid|[[note|longer reading]]}}\n{{z:12|two}} lines'});
      });
      rebuildChart();
      const b = nodes.get('fd_b'), rect = svg.getBoundingClientRect();
      vs = 3; vx = -(b.x + b.w/2)*vs + rect.width/2; vy = -(b.y - 150)*vs + rect.height/2; applyTransform();
      const drawnNote = letters.drawn('.edge-note[data-from="fd_a"][data-to="fd_b"] .edge-note-text tspan');
      openEdgeNoteEditor('fd_a', 'fd_b');
      await new Promise(res=> setTimeout(res, 150));
      out.note = apart(drawnNote, letters.typed());
      closeNodeEditor(false);
    } finally {
      closeNodeEditor(false);
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
      vx = was.vx; vy = was.vy; vs = was.vs; applyTransform();
      deselect(); rebuildChart();
    }
    return out;
  });
  const near = v=> typeof v === 'number' && v < 0.6;
  check('a reading wider than its word: the word keeps its letters together, as drawn', near(r.wide), JSON.stringify(r.wide));
  check('…and a reading in an underlined run is not underlined in the field either (25.11)', !/underline/.test(r.ruled || ''), r.ruled);
  check('lines with a reading or a larger run stand as far apart as drawn', near(r.lines), JSON.stringify(r.lines));
  check('a reading over a larger word stands where the drawing puts it', near(r.larger), JSON.stringify(r.larger));
  check('bold, italic and a smaller run set where drawn', near(r.dressed), JSON.stringify(r.dressed));
  check('a connector\'s note, with a reading, in the field as drawn', near(r.note), JSON.stringify(r.note));
  });

  /* The owner's list of 21.11: a kind's line is shown as it will be
     written, its facts as chips carried along it and its fields' rows
     carried up and down, and the words between the facts typed where they
     stand. */
  await scenario("a kind's line, written where it is read, its fields carried by hand", async () => {
  const before = await page.evaluate(()=>{
    window.__mtKept = {kinds: SETTINGS.mediaTypes, nodes: workingNodes.slice()};
    applyEdit(()=>{
      SETTINGS.mediaTypes = [{id:'mtfilm', name:'Film', fields:[{id:'f1',label:'Studio'},{id:'f2',label:'Director'},{id:'f3',label:'Year'}]}];
      workingNodes.push(['mt_c','Beast Wars',null,null,null,null,{pos:[96000,96000], bioCard:true, mediaType:'mtfilm',
                         mediaData:{f1:'Mainframe', f2:'Ian Pearson', f3:'1996'}}]);
    });
    rebuildChart(); mediaKindsOpen().add('mtfilm'); buildMediaTab();
    setSideTab(document.getElementById('mediaPanel'), true);
    return mediaLineOf(nodes.get('mt_c'));
  });
  const at = (sel)=> page.evaluate(s=>{ const e = document.querySelector(s); e.scrollIntoView({block:'center'});
                                         const r = e.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; }, sel);
  const still = (sel)=> page.evaluate(s=>{ const r = document.querySelector(s).getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; }, sel);
  // A row carried above another.
  const a = await at('.media-field[data-field="f3"] .media-field-label'), b = await still('.media-field[data-field="f1"]');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x, a.y - 6, {steps:2}); await page.mouse.move(b.x, b.y - 4, {steps:5}); await page.mouse.up();
  await wait(150);
  const rows = await page.evaluate(()=> ({order: mediaTypesOf()[0].fields.map(f=> f.id).join(),
    chips: [...document.querySelectorAll('.media-line .media-chip')].map(c=> c.dataset.field).join(),
    line: mediaLineOf(nodes.get('mt_c'))}));
  // The words between the first two facts typed over.
  const j = await at('.media-join[data-at="1"]');
  await page.mouse.click(j.x, j.y); await page.keyboard.press('End');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await page.keyboard.type(' ('); await page.keyboard.press('Enter');
  await wait(100);
  const j3 = await at('.media-join[data-at="3"]');
  await page.mouse.click(j3.x, j3.y); await page.keyboard.type(')'); await page.keyboard.press('Enter');
  await wait(100);
  // A chip carried to the front of the line.
  const c = await at('.media-chip[data-field="f2"]'), c0 = await still('.media-line .media-chip');
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x - 6, c.y, {steps:2}); await page.mouse.move(c0.x - c0.x % 1 - 4, c0.y, {steps:5}); await page.mouse.up();
  await wait(150);
  const r = await page.evaluate(()=>{
    const out = {};
    const k = mediaTypesOf()[0];
    out.order = k.fields.map(f=> f.id).join();
    out.joins = k.joins;
    out.line = mediaLineOf(nodes.get('mt_c'));
    out.preview = [...document.querySelectorAll('.media-line > *')].map(e=> e.textContent).join('|');
    // A fact not given goes with the words before it, the first one's with those after.
    out.gaps = [mediaLineFor(k, {f1:'Mainframe', f3:'1996'}), mediaLineFor(k, {f3:'1996'}), mediaLineFor(k, {})];
    // A field added and one taken out keep the words round the line.
    const t = JSON.parse(JSON.stringify(k));
    addMediaField(t, 'f4'); out.added = t.joins.slice();
    dropMediaField(t, 'f4'); out.dropped = t.joins.slice();
    dropMediaField(t, t.fields[0].id); out.dropFirst = t.joins.slice();
    out.schema = cleanMediaTypes([{id:'x', fields:[{id:'f1',label:'A'}], joins:['', '']}])[0].joins === undefined;
    applyEdit(()=>{ SETTINGS.mediaTypes = window.__mtKept.kinds; if(SETTINGS.mediaTypes === undefined) delete SETTINGS.mediaTypes;
                    workingNodes.length = 0; window.__mtKept.nodes.forEach(x=> workingNodes.push(x)); });
    setSideTab(document.getElementById('mediaPanel'), false);
    rebuildChart(); buildMediaTab();
    return out;
  });
  eq('a kind writes its facts in order, a comma between', before, 'Mainframe, Ian Pearson, 1996');
  check('a field\'s row carried above another changes the order, and the line\'s chips with it',
        rows.order === 'f3,f1,f2' && rows.chips === 'f3,f1,f2' && rows.line === '1996, Mainframe, Ian Pearson', JSON.stringify(rows));
  check('a chip carried along the line moves its field; the words between stay where they were typed',
        r.order === 'f2,f3,f1' && JSON.stringify(r.joins) === JSON.stringify(['', ' (', ', ', ')']) &&
        r.line === 'Ian Pearson (1996, Mainframe)', JSON.stringify([r.order, r.joins, r.line]));
  eq('…and the preview reads as the line does', r.preview, '|Director| (|Year|, |Studio|)');
  check('a fact not given takes the words before it with it, or the first one those after it',
        JSON.stringify(r.gaps) === JSON.stringify(['1996, Mainframe)', '1996)', '']), JSON.stringify(r.gaps));
  check('a field added goes in after a comma, before the words that end the line; one taken out takes its words',
        JSON.stringify(r.added) === JSON.stringify(['', ' (', ', ', ', ', ')']) &&
        JSON.stringify(r.dropped) === JSON.stringify(['', ' (', ', ', ')']) &&
        JSON.stringify(r.dropFirst) === JSON.stringify(['', ', ', ')']), JSON.stringify([r.added, r.dropped, r.dropFirst]));
  check('words that only say what the commas say are not kept in the file', r.schema);
  });

  /* The owner's list of 21.11: every + that adds something is the same
     drawn cross in the middle of its square, never a typed "+". */
  await scenario("one drawn + for every add button", async () => {
  const r = await page.evaluate(async ()=>{
    setSideTab(document.getElementById('tagsPanel'), true);
    await new Promise(ok=> setTimeout(ok, 200));
    const typed = [...document.querySelectorAll('button')].filter(b=> b.textContent.trim() === '+' || b.textContent.trim() === '＋')
      .map(b=> b.id || b.className);
    const all = [...document.querySelectorAll('.add-plus')];
    const off = all.filter(b=>{
      const svg = b.querySelector('svg');
      if(!svg) return true;
      const q = b.getBoundingClientRect(), v = svg.getBoundingClientRect();
      if(!q.width) return false;
      return Math.abs((q.left + q.right)/2 - (v.left + v.right)/2) > 0.5 || Math.abs((q.top + q.bottom)/2 - (v.top + v.bottom)/2) > 0.5;
    }).map(b=> b.id || b.title);
    setSideTab(document.getElementById('tagsPanel'), false);
    return {typed, n: all.length, off};
  });
  check('no add button is a typed "+"', r.typed.length === 0, JSON.stringify(r.typed));
  check('…each wears the drawn cross, in the middle of its square', r.n >= 3 && r.off.length === 0, JSON.stringify(r));
  });

  await scenario("an entry tagged NSFW: veiled for a reader, a ghost for the author", async () => {
  /* The owner's word of 21.11. A reader sees the entry blurred under a
     round 18+ badge as tall as the entry; one press lifts it, and only
     lifts it; out of sight it is veiled again. To the author the badge
     is as faint as a hidden entry and stops nothing. */
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice());
    const view = [vx, vy, vs];
    const X = 9600, Y = 9600, out = {};
    try {
      applyEdit(()=>{
        workingNodes.push(['nsA', 'Veiled', null, null, null, null, {pos:[X, Y], tags:['NSFW', HUB_TAG, FANFIC_TAG], size:[200, 80]}]);
        workingNodes.push(['nsB', 'Plain', null, null, null, null, {pos:[X + 320, Y]}]);
      });
      vs = 1; vx = -(X - 200); vy = -(Y - 200); applyTransform(); deselect();
      await wait(100);
      const g = ()=> document.querySelector('.node[data-id="nsA"]');
      // The echo and the weave stand in layers of their own (the owner, 22.11).
      const sceneryBlur = ()=>{
        const p = [document.querySelector('#auraLayer .node-aura[data-id="nsA"]'),
                   document.querySelector('[data-ground="nsA"]')];
        return p.every(Boolean) ? p.map(e=> getComputedStyle(e).filter.includes('nsfw-blur')) : 'missing';
      };
      const look = ()=>{
        const veil = g().querySelector('.nsfw-veil'), disc = g().querySelector('.nsfw-disc');
        const d = disc.getBoundingClientRect(), b = g().querySelector('rect').getBoundingClientRect();
        // The ring's outer edge: the circle drawn at 75.5 of 84, its stroke half of 17 past it.
        const sw = d.height * 8.5 / 75.5;
        return {op: +getComputedStyle(veil).opacity, shown: getComputedStyle(veil).display !== 'none',
                hits: getComputedStyle(veil).pointerEvents !== 'none',
                blur: getComputedStyle(g().querySelector('rect')).filter.includes('nsfw-blur'),
                scenery: sceneryBlur(),
                tall: +(d.height + sw).toFixed(1), boxH: +nodes.get('nsA').h.toFixed(1),
                mid: Math.abs((d.left + d.right)/2 - (b.left + b.right)/2) < 1 && Math.abs((d.top + d.bottom)/2 - (b.top + b.bottom)/2) < 1,
                plain: !document.querySelector('.node[data-id="nsB"] .nsfw-veil')};
      };
      out.edit = look();
      setReaderPreview(true);
      await wait(150);
      out.read = look();
      const d = g().querySelector('.nsfw-disc').getBoundingClientRect();
      const at = {clientX: d.left + d.width/2, clientY: d.top + d.height/2, bubbles: true};
      g().querySelector('.nsfw-disc').dispatchEvent(new MouseEvent('click', at));
      await wait(80);
      out.lifted = {open: g().classList.contains('nsfw-open'), selected: selectedId,
                    blur: getComputedStyle(g().querySelector('rect')).filter.includes('nsfw-blur'),
                    scenery: sceneryBlur(),
                    shown: getComputedStyle(g().querySelector('.nsfw-veil')).display !== 'none'};
      g().dispatchEvent(new MouseEvent('click', at));
      await wait(450);
      out.second = selectedId;
      vx -= 4000; applyTransform(); vx += 4000; applyTransform();
      await wait(50);
      out.back = {open: g().classList.contains('nsfw-open'), selected: selectedId, blur: look().blur, scenery: sceneryBlur()};
      setReaderPreview(false);
      await wait(150);
    } finally {
      workingNodes = was; rebuildChart();
      [vx, vy, vs] = view; applyTransform();
    }
    return out;
  });
  check('to the author the 18+ badge is as faint as a hidden entry, and in nobody\'s way',
        r.edit.op === 0.1 && !r.edit.hits && !r.edit.blur && r.edit.plain && String(r.edit.scenery) === 'false,false', JSON.stringify(r.edit));
  check('to a reader the badge is whole, as tall as the entry, over its middle, and the entry and its scenery are blurred',
        r.read.op === 1 && r.read.hits && r.read.blur && String(r.read.scenery) === 'true,true' && Math.abs(r.read.tall - r.read.boxH) < 1 && r.read.mid, JSON.stringify(r.read));
  check('one press lifts the veil and does nothing else', r.lifted.open && !r.lifted.blur && String(r.lifted.scenery) === 'false,false' && !r.lifted.shown && r.lifted.selected == null,
        JSON.stringify(r.lifted));
  check('…and the entry is then picked as any other', r.second === 'nsA', String(r.second));
  check('out of sight and back, it is veiled again and let go', !r.back.open && r.back.blur && String(r.back.scenery) === 'true,true' && r.back.selected == null, JSON.stringify(r.back));
  });

  await scenario("the arrow keys: a step of the grid, and a walk along the lines", async () => {
  /* Code 2 of 21.11, item 3. An arrow carries what is picked one step of
     the grid and Shift+arrow five, as a carry by hand does — one step of
     undo, nothing else moved; Alt+arrow walks from the open entry along
     its lines, through a split, for a reader too. */
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice());
    const X = 9000, Y = 9000;
    applyEdit(()=>{
      workingNodes.push(['akP', 'Parent', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['akS', '', 'akP', null, null, 'split', {pos:[X + 40, Y + 120]}]);
      workingNodes.push(['akA', 'Left child', 'akS', null, null, null, {pos:[X - 200, Y + 260]}]);
      workingNodes.push(['akB', 'Middle child', 'akS', null, null, null, {pos:[X, Y + 260]}]);
      workingNodes.push(['akC', 'Right child', 'akP', null, null, null, {pos:[X + 220, Y + 260]}]);
      workingNodes.push(['akD', 'Grandchild', 'akB', null, null, null, {pos:[X, Y + 420]}]);
    });
    await wait(100);
    const at = id=> { const n = nodes.get(id); return [n.x, n.y]; };
    const key = (k, o={})=> document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, bubbles: true, cancelable: true}, o)));
    const out = {};
    if(document.activeElement) document.activeElement.blur();
    keyboardOnChart = true;
    selectNode('akB'); await wait(50);
    const b0 = at('akB'), d0 = at('akD'), top0 = undoStack[undoStack.length - 1];
    key('ArrowRight'); await wait(80);
    const b1 = at('akB');
    out.step = +(b1[0] - b0[0]).toFixed(2); out.stepY = +(b1[1] - b0[1]).toFixed(2);
    // One step on top of what was there: counted by what is under it, as a full stack drops its oldest.
    out.oneUndo = undoStack[undoStack.length - 1] !== top0 && undoStack[undoStack.length - 2] === top0;
    out.othersStill = at('akD')[0] === d0[0] && at('akD')[1] === d0[1];
    key('ArrowDown', {shiftKey: true}); await wait(80);
    out.shiftStep = +(at('akB')[1] - b1[1]).toFixed(2);
    undoLastEdit(); undoLastEdit(); await wait(80);
    out.undone = at('akB')[0] === b0[0] && at('akB')[1] === b0[1];
    out.stillPicked = selectedId === 'akB';
    // The walk.
    const walk = (k)=>{ key(k, {altKey: true}); return selectedId; };
    out.up = walk('ArrowUp');          // through the split to the parent
    out.down = walk('ArrowDown');      // the nearest of what came of it
    selectNode('akB'); await wait(30);
    out.right = walk('ArrowRight');    // beside it, of the same parent through the split
    selectNode('akB'); await wait(30);
    out.left = walk('ArrowLeft');
    selectNode('akB'); await wait(30);
    out.downB = walk('ArrowDown');
    out.walkMovedNothing = at('akB')[0] === b0[0];
    // In a field the arrows are the field's.
    selectNode('akB'); await wait(30);
    const box = document.createElement('textarea'); document.body.appendChild(box); box.focus();
    keyboardOnChart = false;
    box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}));
    await wait(50);
    out.fieldKept = at('akB')[0] === b0[0];
    box.remove(); keyboardOnChart = true;
    // A reader walks, but carries nothing.
    markReadOnly(); await wait(150);
    selectNode('akB'); await wait(30);
    key('ArrowRight'); await wait(80);
    out.readerStill = at('akB')[0] === b0[0];
    out.readerWalks = walk('ArrowUp') === 'akP';
    markEditable(); await wait(150);
    deselect();
    applyEdit(()=>{ workingNodes.length = 0; was.forEach(x=> workingNodes.push(x)); });
    return Object.assign(out, {grid: GRID});
  });
  check('an arrow carries the picked entry one step of the grid', r.step === r.grid && r.stepY === 0, JSON.stringify(r));
  check('…as one step of undo, and nothing else moves', r.oneUndo && r.othersStill, JSON.stringify(r));
  check('Shift+arrow carries it five steps', r.shiftStep === +(5 * r.grid).toFixed(2), JSON.stringify(r));
  check('undo puts it back, and it is still the one picked', r.undone && r.stillPicked, JSON.stringify(r));
  check('Alt+up walks to where it came from, through a split', r.up === 'akP', JSON.stringify(r));
  check('Alt+down walks to the nearest of what came of it', r.down === 'akB' && r.downB === 'akD', JSON.stringify(r));
  check('Alt+left and right walk to the entries beside it, of the same parent', r.left === 'akA' && r.right === 'akC', JSON.stringify(r));
  check('…and the walk moves nothing', r.walkMovedNothing, JSON.stringify(r));
  check('in a field the arrows are the field\'s', r.fieldKept, JSON.stringify(r));
  check('a reader walks the lines but carries nothing', r.readerStill && r.readerWalks, JSON.stringify(r));
  });

  await scenario("hops: where two lines cross, the level one arches over", async () => {
  /* Code 2 of 21.11, item 6, and the owner's word that the hops be
     rational: only a straight leg of a line hops, at a fair angle, clear
     of corners and ends; the level line goes over the upright; a double
     line arches as two rails; and a line hidden by its tags takes its
     arches with it. */
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const X = 9000, Y = 9000;
    applyEdit(()=>{
      workingNodes.push(['hpL', 'Level from', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['hpR', 'Level to', 'hpL', null, null, null, {pos:[X + 800, Y + 300]}]);
      workingNodes.push(['hpT', 'Upright from', null, null, null, null, {pos:[X + 400, Y - 120], tags:['hop-probe']}]);
      workingNodes.push(['hpB', 'Upright to', 'hpT', null, null, null, {pos:[X + 400, Y + 420]}]);
    });
    await wait(120);
    /* The hop is in the line's own path (the owner's list of 22.11,
       night): no arch beside it, no hole cut in it. */
    const lineTo = to=> edgeLayer.querySelector('path.edge.struct:not(.dbl-inner)[data-from][data-to="' + to + '"]');
    const out = {};
    const L = lineTo('hpR'), U = lineTo('hpB');
    out.count = Number(L.dataset.hops || 0);
    out.levelHops = out.count === 1 && L.dataset.hopsOver === 'hpB' && !U.dataset.hops;
    out.onePath = !edgeLayer.querySelector('.hop') && !edgeDefs.querySelector('mask[id^="hop-mask"]') &&
                  !L.getAttribute('mask') && !U.getAttribute('mask');
    out.uprightPlain = !U.dataset.hops && !/C/.test(U.getAttribute('d'));
    /* Over the top: the path rises the hop's height above the level leg. */
    const route = [...drawnRoutes.values()].find(x=> x.to === 'hpR').pts;
    const levelY = route.filter((p, i)=> i && Math.abs(p.y - route[i-1].y) < 0.01).map(p=> p.y);
    {
      const m = L.getAttribute('d').match(/ L([-\d.]+),([-\d.]+) C/);
      const x0 = +m[1], y0 = +m[2];
      const top = Math.min(...flattenPathD(L.getAttribute('d')).filter(p=> p.x >= x0 - 0.1 && p.x <= x0 + 4 * HOP_R).map(p=> p.y));
      out.above = Math.abs(y0 - top - HOP_R) < 0.3;
    }
    /* The rule itself, on lines laid by hand: a crossing a little way
       past a turn is hopped, one on the turn is not. */
    const keep = new Map(drawnRoutes), probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    edgeLayer.appendChild(probe);
    const hopsFor = (turnX)=>{
      drawnRoutes.clear();
      drawnRoutes.set('crossed', {from: 'cA', to: 'cB', pts: [{x: 200, y: -200}, {x: 200, y: 200}]});
      delete probe.dataset.hops;
      probe.setAttribute('d', 'M0,-100 L' + turnX + ',-100 L' + turnX + ',0 L400,0');
      drawHops([{from: 'jA', to: 'jB', style: Object.assign({}, DEFAULT_EDGE_STYLE, {arrow: false}), el: probe, inner: null, cornerR: 6, paint: '#000',
                 pts: [{x: 0, y: -100}, {x: turnX, y: -100}, {x: turnX, y: 0}, {x: 400, y: 0}]}]);
      return Number(probe.dataset.hops || 0);
    };
    out.farFromTurn = hopsFor(150);
    out.onTurn = hopsFor(196);
    drawnRoutes.clear(); keep.forEach((v, k)=> drawnRoutes.set(k, v)); probe.remove();
    rebuildChart(); await wait(60);
    // A double line: both rails take the hop, as one path each.
    applyEdit(()=>{ EDGE_STYLES.push({from: 'hpL', to: 'hpR', dash: 'double'}); });
    await wait(120);
    const D = lineTo('hpR'), inner = D.nextElementSibling;
    out.doubleBoth = D.dataset.hops === '1' && inner.classList.contains('dbl-inner') && inner.getAttribute('d') === D.getAttribute('d');
    // The upright hidden by its tag: the hop is taken out, and comes back.
    const plainD = ()=> !/C/.test(lineTo('hpR').getAttribute('d'));
    hiddenTags.add('hop-probe'); applyVisibility(); await wait(60);
    out.hiddenGone = lineTo('hpR').dataset.hops === '0' && plainD();
    hiddenTags.delete('hop-probe'); applyVisibility(); await wait(60);
    out.back = lineTo('hpR').dataset.hops === '1' && !plainD();
    /* A wavy line hops too (22.11, night), laid flat either side, and
       its ripple runs on past the hop. */
    applyEdit(()=>{ const st = EDGE_STYLES.find(s=> s.from === 'hpL' && s.to === 'hpR'); st.sinusoid = true; delete st.dash; });
    await wait(120);
    const W = lineTo('hpR');
    out.wavyHops = W.dataset.hops === '1';
    {
      const pts = flattenPathD(W.getAttribute('d'));
      const x0 = Number(W.getAttribute('d').match(/ L([-\d.]+),[-\d.]+ C/)[1]);
      const y0 = levelY[levelY.length - 1];
      const near = pts.filter(p=> p.x > x0 - 2.4 && p.x < x0 - 0.1);
      const far = pts.filter(p=> p.x < x0 - 12 && p.x > x0 - 40);
      out.wavyFlat = near.every(p=> Math.abs(p.y - y0) < 0.05) && far.some(p=> Math.abs(p.y - y0) > 1);
    }
    /* And the button beside the guides turns them off for the chart, as
       an edit, and is kept with it. */
    document.getElementById('hopsToggle').click(); await wait(120);
    out.offButton = SETTINGS.hops === false && document.getElementById('hopsToggle').getAttribute('aria-pressed') === 'false' &&
                    !lineTo('hpR').dataset.hops && /hops: false/.test(serializeSettings(SETTINGS));
    undoLastEdit(); await wait(120);
    out.undone = SETTINGS.hops === undefined && document.getElementById('hopsToggle').getAttribute('aria-pressed') === 'true' &&
                 lineTo('hpR').dataset.hops === '1';
    applyEdit(()=>{
      workingNodes.length = 0; was.forEach(x=> workingNodes.push(x));
      EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s));
    });
    return out;
  });
  check('the level line arches over the upright where they cross', r.count === 1 && r.levelHops && r.above, JSON.stringify(r));
  check('…the hop is the line\'s own path, with no hole cut and no arch laid beside it, and the upright runs on whole', r.onePath && r.uprightPlain, JSON.stringify(r));
  check('a crossing on a line\'s turn is not hopped, one clear of it is', r.onTurn === 0 && r.farFromTurn === 1, JSON.stringify(r));
  check('a double line hops with both its rails, as one path each', r.doubleBoth, JSON.stringify(r));
  check('a line hidden by its tags takes its hops with it, and gives them back', r.hiddenGone && r.back, JSON.stringify(r));
  check('a wavy line hops too, laid flat as it comes to the hop and rippling past it', r.wavyHops && r.wavyFlat, JSON.stringify(r));
  check('the button beside the guides turns the hops off for the chart, kept with it and undone as an edit', r.offButton && r.undone, JSON.stringify(r));
  });

  await scenario("the owner's list of 22.11: the toolbar in two rows, the hand tools, presets and scenarios", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS));
    const out = {};
    const X = 61000, Y = 61000;
    const centreOf = id=>{ const g = document.querySelector('.node[data-id="' + id + '"]'); const b = g.getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; };
    const pressAt = (pt)=> svg.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, button: 0, pointerType: 'mouse'}));
    try{
      /* References written three ways, chosen beside their colour. */
      const sel = document.getElementById('refStyleSelect');
      out.refSelect = !!sel && [...sel.options].map(o=> o.value).join() === 'square,round,bare';
      SETTINGS.refStyle = 'round'; const round = refNumberText(3);
      SETTINGS.refStyle = 'bare'; const bare = refNumberText(3);
      delete SETTINGS.refStyle; const square = refNumberText(3);
      out.refTexts = [square, round, bare].join(' ');

      /* NSFW is in Special before any entry wears it; every tag that can
         be carried has the six dots, and Untagged keeps their room. */
      buildSideTabs();
      setSideTab(document.getElementById('tagsPanel'), true); await wait(250);
      out.nsfwListed = [...document.querySelectorAll('#tagsList .legend-item')].some(row=> row.textContent.includes(NSFW_TAG));
      const rows = [...document.querySelectorAll('#tagsList .legend-item.draggable-row')];
      out.gripsOnRows = rows.length > 0 && rows.every(row=> row.querySelector(':scope > .tag-grip:not(.tag-grip-room)'));
      setSideTab(document.getElementById('tagsPanel'), false);

      applyEdit(()=>{
        workingNodes.push(['h22a', 'Painter', null, null, null, null, {pos: [X, Y], colors: ['#1e7d4f'], fontSize: 22, border: 'dashed'}]);
        workingNodes.push(['h22b', 'Painted', null, null, null, null, {pos: [X + 400, Y]}]);
        workingNodes.push(['h22c', 'Held back', null, null, null, null, {pos: [X + 800, Y]}]);
      });
      await wait(150);

      /* The counts leave out what is not an entry of the chart's story. */
      const count = ()=> +document.getElementById('statNodes').textContent;
      const c0 = count();
      applyEdit(()=>{
        workingNodes.push(['h22t', 'Words', null, null, null, 'textbox', {pos: [X, Y + 400]}]);
        workingNodes.push(['h22l', '', null, null, null, 'link', {pos: [X + 300, Y + 400]}]);
      });
      await wait(100);
      out.countsSkip = count() === c0;
      applyEdit(()=>{ workingNodes.splice(workingNodes.findIndex(x=> x[0] === 'h22t'), 1); workingNodes.splice(workingNodes.findIndex(x=> x[0] === 'h22l'), 1); });

      /* The tools are a second row under the first. */
      const first = document.getElementById('themeToggle').getBoundingClientRect();
      const rowBox = document.getElementById('toolRow').getBoundingClientRect();
      out.secondRow = rowBox.top >= first.bottom - 0.5 &&
        ['touchTools', 'guideToggle', 'inkPen', 'inkEraser', 'pipetteTool', 'stylePaintTool'].every(id=> document.getElementById(id).closest('#toolRow'));

      /* The overview: a button; shown, it stands over the coordinates at
         the bottom left, is carried by its dots, and comes back to its
         corner when shown again. */
      const mm = document.getElementById('minimapPanel'), coord = document.querySelector('.coord');
      document.getElementById('minimapToggle').click(); await wait(100);
      const a = mm.getBoundingClientRect(), cb = coord.getBoundingClientRect();
      out.mmShown = !mm.hidden && a.bottom <= cb.top + 0.5 && Math.abs(a.left - cb.left) < 40;
      const grip = document.getElementById('minimapGrip').getBoundingClientRect();
      const gx = grip.x + grip.width / 2, gy = grip.y + grip.height / 2;
      const grab = document.getElementById('minimapGrip');
      grab.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: gx, clientY: gy, button: 0, pointerId: 3, pointerType: 'mouse'}));
      window.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: gx + 200, clientY: gy - 150, pointerId: 3, pointerType: 'mouse'}));
      grab.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: gx + 200, clientY: gy - 150, pointerId: 3, pointerType: 'mouse'}));
      window.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: gx + 200, clientY: gy - 150, pointerId: 3, pointerType: 'mouse'}));
      grab.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: gx + 200, clientY: gy - 150, pointerId: 3, pointerType: 'mouse'}));
      await wait(50);
      const moved = mm.getBoundingClientRect();
      out.mmMoved = Math.round(moved.left - a.left) + ',' + Math.round(moved.top - a.top);
      document.getElementById('minimapToggle').click(); await wait(50);
      out.mmHides = mm.hidden;
      document.getElementById('minimapToggle').click(); await wait(50);
      const back = mm.getBoundingClientRect();
      out.mmBack = Math.abs(back.left - a.left) < 1 && Math.abs(back.top - a.top) < 1;
      document.getElementById('minimapToggle').click();

      /* The eyedropper copies what is drawn where it is pressed, and is put
         down by the press. */
      vs = 1; const rv = svg.getBoundingClientRect(); vx = rv.width / 2 - (X + 400); vy = rv.height / 2 - (Y + 20); applyTransform();
      await wait(150);
      setHandTool('pipette');
      out.pipetteHeld = handTool === 'pipette' && document.getElementById('pipetteTool').classList.contains('active');
      const g = document.querySelector('.node[data-id="h22a"]');
      const ring = [...g.querySelectorAll('rect, path')].find(e=> hexOfPaint(getComputedStyle(e).stroke) === '#1e7d4f');
      out.pipetteColour = ring ? colourAtTarget(ring) : 'no ring';
      pressAt(centreOf('h22a'));
      await wait(50);
      const sw = document.getElementById('pipetteSwatch');
      out.pipetteDown = handTool === null && !sw.hidden;

      /* The brush takes the picked entry's look and gives it to the next
         entry pressed, one step of undo for each. */
      selectNode('h22a');
      setHandTool('paint');
      out.brushHeld = handTool === 'paint' && paintLook && paintLook.kind === 'node';
      const top = undoStack[undoStack.length - 1];
      pressAt(centreOf('h22b'));
      await wait(100);
      const ob = entryOpts(workingEntry('h22b').entry);
      out.painted = JSON.stringify(ob.colors) === '["#1e7d4f"]' && ob.fontSize === 22 && ob.border === 'dashed' && undoStack[undoStack.length - 1] !== top;
      out.selectionKept = selectedId === 'h22a';
      // One press, and the brush is put down (the owner's list of 22.11, evening).
      out.brushDown = handTool === null;
      undoLastEdit(); await wait(80);
      out.paintUndone = entryOpts(workingEntry('h22b').entry).colors === undefined;
      selectNode('h22a'); setHandTool('paint');
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      out.brushDown = out.brushDown && handTool === null;
      deselect();
      // Without anything picked the brush cannot be taken up.
      setHandTool('paint');
      out.brushNeedsPick = handTool === null;

      /* Presets: what Default puts down, and its figures with it; each
         field has its way back, and an empty preset is not kept. */
      setPresetField('rect', 'colors', ['#aa3300']);
      setPresetField('rect', 'align', 'left');
      const made = addEntryOfStyle('rect'); closeNodeEditor(false);
      const mo = entryOpts(workingEntry(made).entry);
      out.presetUsed = JSON.stringify(mo.colors) === '["#aa3300"]' && mo.align === 'left';
      const fig = addEntryOfFigure('diamond'); closeNodeEditor(false);
      out.figureUsed = !!fig && JSON.stringify(entryOpts(workingEntry(fig).entry).colors) === '["#aa3300"]';
      openAddFab();
      openPresetMenu('rect');
      const resetAlign = document.querySelector('.preset-row[data-key="align"] .preset-reset');
      const resetBorder = document.querySelector('.preset-row[data-key="border"] .preset-reset');
      out.resetLive = !!resetAlign && !resetAlign.disabled && !!resetBorder && resetBorder.disabled;
      resetAlign.click();
      document.querySelector('.preset-row[data-key="colors"] .preset-reset').click();
      out.presetGone = SETTINGS.presets === undefined;
      openPresetMenu(null);
      closeAddFab();
      { const more = document.querySelector('.add-fab-customize svg path'); out.figuresTriangle = !!more && /z$/i.test(more.getAttribute('d')) && more.getAttribute('d').split(/[hHzZ]/).length <= 4; }

      /* Scenarios: pressing one entry shows another, which a reader does
         not see, find or have in the text version until then; the editor
         sees it all along. */
      applyEdit(()=>{ SETTINGS.scenarios = [{id: 'h22s', when: {type: 'press', node: 'h22a'}, then: [{do: 'show', node: 'h22c'}, {do: 'anim', node: 'h22c', anim: 'pulse'}]}]; });
      await wait(80);
      out.editorSees = !scenarioHeld(nodes.get('h22c')) && !document.querySelector('.node[data-id="h22c"]').classList.contains('scn-held');
      document.getElementById('studioToggle').click(); await wait(80);
      out.studioRows = document.querySelectorAll('#studioList .scn-card').length === 1 &&
                       document.querySelectorAll('#studioList .scn-action').length === 2;
      document.getElementById('studioPlay').click(); await wait(200);
      const held = ()=> document.querySelector('.node[data-id="h22c"]').classList.contains('scn-held');
      out.readerHeld = readOnlyView && held() && !searchHits('held back').some(h=> h.n.id === 'h22c') && !textViewListed(nodes.get('h22c'));
      out.studioOverPreview = !document.getElementById('studioPanel').hidden && getComputedStyle(document.getElementById('studioPanel')).display !== 'none';
      scenariosPressed('h22a'); await wait(60);
      out.shown = !held() && searchHits('held back').some(h=> h.n.id === 'h22c') &&
                  document.querySelector('.node[data-id="h22c"]').classList.contains('scn-pulse');
      document.getElementById('studioReset').click(); await wait(60);
      out.resetHolds = held();
      document.getElementById('studioPlay').click(); await wait(200);
      out.backToEditing = !readOnlyView && !held();
      document.getElementById('studioClose').click();
      // Kept with the chart, and read back by Import.
      SETTINGS.refStyle = 'round'; setPresetField('link', 'colors', ['#3355aa']);
      { const kept = JSON.parse(chartFileText()).settings;
        out.scenarioSaved = Array.isArray(kept.scenarios) && kept.scenarios.length === 1 && kept.refStyle === 'round' &&
                            JSON.stringify(kept.presets) === '{"link":{"colors":["#3355aa"]}}'; }
    } finally {
      if(typeof readerPreview !== 'undefined' && readerPreview) setReaderPreview(false);
      setHandTool(null);
      applyEdit(()=>{
        workingNodes.length = 0; was.forEach(x=> workingNodes.push(x));
        EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s));
        Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, wasSettings);
      });
    }
    return out;
  });
  check('references are written [1], (1) or 1, picked beside their colour', r.refSelect && r.refTexts === '[3] (3) 3', JSON.stringify(r));
  check('NSFW stands in Special before anything wears it', r.nsfwListed);
  check('every tag that can be carried has the six dots', r.gripsOnRows);
  check('the counts leave out words, links and pictures', r.countsSkip);
  check('the tools are a row of their own under the first', r.secondRow);
  check('the overview is a button: shown over the coordinates, carried by its dots, back in its corner when shown again',
        r.mmShown && r.mmMoved === '200,-150' && r.mmHides && r.mmBack, JSON.stringify([r.mmShown, r.mmMoved, r.mmHides, r.mmBack]));
  check('the eyedropper takes the colour pressed, keeps it in its corner and is put down',
        r.pipetteHeld && r.pipetteColour === '#1e7d4f' && r.pipetteDown, JSON.stringify([r.pipetteHeld, r.pipetteColour, r.pipetteDown]));
  check('the style brush gives the picked entry\'s look to the one pressed in a step of undo, and is put down by it or by Escape',
        r.brushHeld && r.painted && r.selectionKept && r.paintUndone && r.brushDown && r.brushNeedsPick,
        JSON.stringify([r.brushHeld, r.painted, r.selectionKept, r.paintUndone, r.brushDown, r.brushNeedsPick]));
  check('the figures open from a triangle, the gear being the preset\'s', r.figuresTriangle);
  check('a preset is what Default puts down, figures included, and each field has its way back',
        r.presetUsed && r.figureUsed && r.resetLive && r.presetGone, JSON.stringify([r.presetUsed, r.figureUsed, r.resetLive, r.presetGone]));
  check('a scenario: the editor sees everything, the studio lists it', r.editorSees && r.studioRows, JSON.stringify([r.editorSees, r.studioRows]));
  check('…a reader does not see, find or read what it shows until it is pressed, and Reset holds it back again',
        r.readerHeld && r.studioOverPreview && r.shown && r.resetHolds && r.backToEditing,
        JSON.stringify([r.readerHeld, r.studioOverPreview, r.shown, r.resetHolds, r.backToEditing]));
  check('…and it is kept with the chart, as are the presets and how references are written', r.scenarioSaved);
  });

  await scenario("the owner's list of 22.11, evening: fifths of the edge, figures in pages, two fingers over the pencil, a brush and a tag over an area, a field to the pixel", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS));
    const out = {};
    const X = 71000, Y = 71000;
    const toClient = (x, y)=>{ const b = svg.getBoundingClientRect(); return {x: b.left + x * vs + vx, y: b.top + y * vs + vy}; };
    try{
      /* Four drawers, each the fifth of the edge it had when there were five. */
      const column = document.getElementById('tagsPanel').parentElement.getBoundingClientRect().height;
      const gap = parseFloat(getComputedStyle(document.getElementById('tagsPanel')).getPropertyValue('--side-tab-gap')) || 0;
      const hs = ['tagsPanel', 'refsPanel', 'keyPanel', 'mediaPanel'].map(id=> document.getElementById(id).getBoundingClientRect().height);
      out.fifths = hs.every(h=> Math.abs(h - (column - gap * 4) / 5) < 1) ? 'ok' : JSON.stringify([column, gap, hs]);

      /* The figures: a smaller card, the author's own in pages turned by
         arrows, and the page sliding rather than cut to. */
      SETTINGS.figures = Array.from({length: 13}, (_, i)=> ({name: 'P' + i, d: 'M0 0L100 0L100 100L0 100Z'}));
      openAddFab(); openFigureMenu(true); await wait(260);
      const card = document.querySelector('#addFabFigures .add-fab-figures-card').getBoundingClientRect();
      out.cardWidth = Math.round(card.width);
      const pages = document.querySelectorAll('#addFabFigures .figure-page');
      const tiles = figureTemplatesOffered().length + 1;
      out.pages = pages.length === Math.ceil(tiles / 8) && [...pages].every((p, i)=> p.querySelectorAll('.node-style-btn').length === Math.min(8, tiles - i * 8)) &&
                  pages[pages.length - 1].lastElementChild.classList.contains('figure-upload')
        ? 'ok' : pages.length + ':' + [...pages].map(p=> p.querySelectorAll('.node-style-btn').length).join(',');
      const track = document.querySelector('#addFabFigures .figure-track');
      const prev = document.querySelector('#addFabFigures .figure-turn[data-step="-1"]');
      const next = document.querySelector('#addFabFigures .figure-turn[data-step="1"]');
      out.firstPage = prev.disabled && !next.disabled && pages[1].inert && !pages[0].inert;
      next.click();
      await wait(60);
      const mid = new DOMMatrix(getComputedStyle(track).transform).m41;
      await wait(500);
      const end = new DOMMatrix(getComputedStyle(track).transform).m41;
      const pageW = pages[0].getBoundingClientRect().width;
      out.slides = mid < -1 && mid > -pageW + 1 && Math.abs(end + pageW) < 1 && !prev.disabled && !pages[1].inert && pages[0].inert;
      { const at = document.querySelector('#addFabFigures .figure-page-at').textContent; out.pageAt = at === '2 / ' + pages.length ? 'ok' : at; }
      // The triangle turns towards the card, and both cards rise rather than appear.
      const tri = getComputedStyle(document.querySelector('.add-fab-customize svg'));
      out.triangleTurns = new DOMMatrix(tri.transform).b > 0.99 && /transform/.test(tri.transitionProperty);
      const figs = getComputedStyle(document.getElementById('addFabFigures'));
      const pres = getComputedStyle(document.getElementById('addFabPresets'));
      out.rises = /opacity/.test(figs.transitionProperty) && /transform/.test(figs.transitionProperty) &&
                  /opacity/.test(pres.transitionProperty) && pres.visibility === 'hidden';
      openFigureMenu(false); closeAddFab();
      delete SETTINGS.figures;

      applyEdit(()=>{
        workingNodes.push(['e22a', 'Model', null, null, null, null, {pos: [X, Y], colors: ['#7a1fa2'], border: 'dotted'}]);
        workingNodes.push(['e22b', 'One', null, null, null, null, {pos: [X + 300, Y]}]);
        workingNodes.push(['e22c', 'Two', null, null, null, null, {pos: [X + 600, Y]}]);
        workingNodes.push(['e22d', 'Outside', null, null, null, null, {pos: [X + 300, Y + 600]}]);
      });
      vs = 1; { const rv = svg.getBoundingClientRect(); vx = rv.width / 2 - (X + 450); vy = rv.height / 2 - (Y + 100); applyTransform(); }
      await wait(150);

      /* The brush drawn round two entries gives the look to both, in one
         step of undo, and is put down. */
      selectNode('e22a'); setHandTool('paint');
      const depth = undoStack.length, top = undoStack[undoStack.length - 1];
      const from = toClient(X + 250, Y - 80), to = toClient(X + 900, Y + 200);
      svg.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, clientX: from.x, clientY: from.y, button: 0, pointerType: 'mouse'}));
      window.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: (from.x + to.x) / 2, clientY: (from.y + to.y) / 2, pointerType: 'mouse'}));
      out.areaShown = marqueeRect.style.display !== 'none';
      window.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: to.x, clientY: to.y, pointerType: 'mouse'}));
      await wait(100);
      const look = id=> { const o = entryOpts(workingEntry(id).entry); return (o.colors || []).join() + '/' + (o.border || ''); };
      out.areaPainted = look('e22b') === '#7a1fa2/dotted' && look('e22c') === '#7a1fa2/dotted' && look('e22d') === '/';
      out.oneStep = undoStack[undoStack.length - 1] !== top && (undoStack.length === depth + 1 || undoStack.length === depth);
      out.areaDown = handTool === null && marqueeRect.style.display === 'none';
      undoLastEdit(); await wait(80);
      out.areaUndone = look('e22b') === '/' && look('e22c') === '/';

      /* A tag carried out of the drawer onto the chart goes on every entry
         picked. */
      setSelection(['e22b', 'e22c'], 'e22b');
      const over = toClient(X + 450, Y + 300);
      beginListDrag({button: 0, target: document.body, preventDefault(){}, clientX: 30, clientY: 300}, 'tag', 'e22 tag', 'e22 tag');
      window.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: over.x - 40, clientY: over.y, pointerType: 'mouse'}));
      window.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: over.x, clientY: over.y, pointerType: 'mouse'}));
      const ghost = document.querySelector('.list-drag-ghost');
      out.ghost = ghost ? ghost.textContent : 'none';
      out.chartTakes = svg.classList.contains('drop-onto');
      const tagDepth = undoStack.length;
      window.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: over.x, clientY: over.y, pointerType: 'mouse'}));
      await wait(100);
      const tags = id=> (entryOpts(workingEntry(id).entry).tags || []).join();
      out.tagged = tags('e22b') === 'e22 tag' && tags('e22c') === 'e22 tag' && tags('e22d') === '' && undoStack.length === tagDepth + 1
        ? true : [tags('e22b'), tags('e22c'), tags('e22d'), undoStack.length - tagDepth].join('|');
      out.markGone = !svg.classList.contains('drop-onto') && !document.querySelector('.list-drag-ghost');
      deselect();

      /* Two fingers on the chart with the pencil in hand: no line, and
         the chart is free to be moved. */
      setInkTool('pen');
      const inkBefore = inkStrokes().length;
      const p1 = toClient(X + 100, Y + 300), p2 = toClient(X + 200, Y + 350);
      const touch = (type, id, pt)=> svg.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, button: 0, pointerId: id, pointerType: 'touch', isPrimary: id === 41}));
      touch('pointerdown', 41, p1);
      touch('pointermove', 41, {x: p1.x + 6, y: p1.y + 4});
      out.wetFirst = !!document.querySelector('.ink-wet');
      touch('pointerdown', 42, p2);
      out.wetGone = !document.querySelector('.ink-wet');
      touch('pointermove', 41, {x: p1.x + 40, y: p1.y + 30});
      touch('pointerup', 42, p2);
      touch('pointermove', 41, {x: p1.x + 60, y: p1.y + 50});
      touch('pointerup', 41, {x: p1.x + 60, y: p1.y + 50});
      out.noLine = inkStrokes().length === inkBefore && !document.querySelector('.ink-wet');
      touch('pointerdown', 43, p1);
      touch('pointermove', 43, {x: p1.x + 30, y: p1.y + 10});
      touch('pointerup', 43, {x: p1.x + 30, y: p1.y + 10});
      out.oneFingerDraws = inkStrokes().length === inkBefore + 1;
      setInkTool(null);
    } finally {
      setHandTool(null);
      if(typeof setInkTool === 'function') setInkTool(null);
      applyEdit(()=>{
        workingNodes.length = 0; was.forEach(x=> workingNodes.push(x));
        EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s));
        Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, wasSettings);
      });
    }
    return out;
  });
  check('the drawers still take a fifth of the edge each, though there are four', r.fifths === 'ok', r.fifths);
  /* Made smaller on 22.11, and larger again on a computer on 24.11: tiles
     a pointer can aim at, still eight to a page. */
  check('the figures\' card is a size a pointer aims at, its templates in pages of eight with the upload last',
        r.cardWidth > 240 && r.cardWidth <= 320 && r.pages === 'ok' && r.firstPage, JSON.stringify([r.cardWidth, r.pages, r.firstPage]));
  check('…turned by an arrow, the page sliding across rather than cut to', r.slides && r.pageAt === 'ok', JSON.stringify([r.slides, r.pageAt]));
  check('…the triangle turns towards the card, and the figures and the preset rise into place', r.triangleTurns && r.rises,
        JSON.stringify([r.triangleTurns, r.rises]));
  check('the style brush drawn round entries gives the look to every one wholly inside, in one step of undo, and is put down',
        r.areaShown && r.areaPainted && r.oneStep && r.areaDown && r.areaUndone,
        JSON.stringify([r.areaShown, r.areaPainted, r.oneStep, r.areaDown, r.areaUndone]));
  check('a tag carried onto the chart goes on every entry picked, in one step, the ghost counting them',
        r.chartTakes && r.ghost === 'e22 tag \u2192 2' && r.tagged === true && r.markGone, JSON.stringify([r.chartTakes, r.ghost, r.tagged, r.markGone]));
  check('a second finger on the chart puts the pencil\'s line away and draws nothing; one finger still draws',
        r.wetFirst && r.wetGone && r.noLine && r.oneFingerDraws, JSON.stringify([r.wetFirst, r.wetGone, r.noLine, r.oneFingerDraws]));

  /* The field over an entry paints its words on the very pixels the entry
     paints them on, line by line, at the densities where that is settled. */
  for(const dpr of [1, 2]){
    const ctx = await browser.newContext({viewport: {width: 1100, height: 760}, deviceScaleFactor: dpr});
    await ctx.route('https://fonts.googleapis.com/**', noFonts);
    await ctx.route('https://fonts.gstatic.com/**', noFonts);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push('field pixels: ' + e.message));
    try{
      await pg.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil: 'networkidle'});
      await wait(700);
      await pg.addStyleTag({content: '.node[data-id^="pz"] > :not(text){opacity:0 !important} .node[data-id^="pz"]{filter:none !important} #nodeEditorBar{visibility:hidden !important}'});
      const apart = [];
      for(const [k, label] of [['a', 'Alpha Prime'], ['b', 'one\ntwo lines']]){
        for(const zoom of [1, 2]){
          const clip = await pg.evaluate(async ([k, label, zoom])=>{
            closeNodeEditor(false);
            applyEdit(()=>{ workingNodes = workingNodes.filter(x=> !/^pz/.test(x[0])); workingNodes.push(['pz' + k, label, null, null, null, null, {pos: [9000, 9000]}]); });
            rebuildChart();
            const n = nodes.get('pz' + k), rect = svg.getBoundingClientRect();
            vs = zoom; vx = Math.round(-(n.x + n.w/2) * vs + rect.width/2) + 0.3; vy = Math.round(-(n.y + n.h/2) * vs + rect.height/2) + 0.37; applyTransform();
            setSelection(['pz' + k], 'pz' + k);
            await new Promise(ok=> setTimeout(ok, 200));
            return {x: Math.round(rect.left + n.x * vs + vx - 8), y: Math.round(rect.top + n.y * vs + vy - 8), width: Math.round(n.w * vs + 16), height: Math.round(n.h * vs + 16)};
          }, [k, label, zoom]);
          await pg.mouse.move(2, 750);
          const drawn = await pg.screenshot({clip});
          await pg.evaluate(async (k)=>{ openNodeEditor('pz' + k); await new Promise(ok=> setTimeout(ok, 250));
            richFields.get('nodeEditorText').surface.style.caretColor = 'transparent'; window.getSelection().removeAllRanges(); }, k);
          await wait(80);
          const typed = await pg.screenshot({clip});
          const same = await pg.evaluate(async ([a, b])=>{
            const pix = async (b64)=>{ const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
              const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
              const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
            /* Where the ink stands, by its weight: the same glyphs on the
               same rows agree to a hundredth; a line a pixel off moves it
               by a pixel times its share of the ink. Across, both are set
               to a fraction of a pixel and shaded a little apart there, so
               the place is compared rather than each shade. */
            const cen = (D, W)=>{ let sx = 0, sy = 0, sw = 0;
              for(let i = 0; i < D.length; i += 4){ const v = 255 - D[i + 1]; if(v > 10){ const p = i / 4; sx += (p % W) * v; sy += Math.floor(p / W) * v; sw += v; } }
              return [sx / sw, sy / sw]; };
            const A = await pix(a), B = await pix(b);
            const im = new Image(); im.src = 'data:image/png;base64,' + a; await im.decode();
            const ca = cen(A, im.width), cb = cen(B, im.width);
            return Math.max(Math.abs(ca[0] - cb[0]), Math.abs(ca[1] - cb[1])).toFixed(2);
          }, [drawn.toString('base64'), typed.toString('base64')]);
          apart.push(k + zoom + ':' + same);
          await pg.evaluate(()=> closeNodeEditor(false));
        }
      }
      check(`the field paints an entry's words on the pixels the entry does, every line, at a density of ${dpr}`,
            apart.every(x=> +x.split(':')[1] <= 0.15), apart.join(' '));
    } finally {
      await ctx.close();
    }
  }
  });

  await scenario("the owner's list of 22.11, night: a note on a curve, a veil that holds, a narrow list, a preset by its button, the history, the field's ground", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS));
    const X = 9200, Y = 9200, out = {};
    try {
      /* 1. A note on a curve keeps its share of the way when an end moves:
         it is placed along the curve as drawn, so it stays on the line. */
      applyEdit(()=>{
        workingNodes.push(['cvA', 'Curve from', null, null, null, null, {pos:[X, Y]}]);
        workingNodes.push(['cvB', 'Curve to', 'cvA', null, null, null, {pos:[X + 400, Y + 300]}]);
        EDGE_STYLES.push({from: 'cvA', to: 'cvB', routing: 'curve', note: 'on the curve', noteAt: 0.3});
      });
      await wait(80);
      applyEdit(()=>{ workingNodes.find(x=> x[0] === 'cvB')[6].pos = [X + 420, Y + 320]; });
      await wait(80);
      const st = edgeStyleFor('cvA', 'cvB');
      const note = document.querySelector('.edge-note[data-from="cvA"][data-to="cvB"]');
      const line = flattenPathD(document.querySelector('path.edge.struct[data-from="cvA"][data-to="cvB"]').getAttribute('d'));
      let near = Infinity;
      if(note){
        const b = note.getBBox(), c = {x: b.x + b.width / 2, y: b.y + b.height / 2};
        line.forEach(p=> near = Math.min(near, Math.hypot(p.x - c.x, p.y - c.y)));
      }
      out.curveNote = {at: st.noteAt, near: Math.round(near)};
      /* 3. The veil over an entry marked 18+ stays while a finger moves the
         chart, when the shadows come off. */
      applyEdit(()=> workingNodes.push(['nvA', 'Veiled', null, null, null, null, {pos:[X, Y + 600], tags:['NSFW', HUB_TAG, FANFIC_TAG], size:[200, 80]}]));
      await wait(80);
      const b = document.body, had = ['read-only', 'touch-input', 'view-moving'].filter(c=> !b.classList.contains(c));
      had.forEach(c=> b.classList.add(c));
      const g = document.querySelector('.node[data-id="nvA"]');
      out.veilMoving = !!g && getComputedStyle(g.querySelector('rect')).filter.includes('nsfw-blur') &&
                       [...document.querySelectorAll('.nsfw-scenery')].every(e=> e.classList.contains('nsfw-open') || getComputedStyle(e).filter.includes('nsfw-blur'));
      had.forEach(c=> b.classList.remove(c));
      /* 4. The citation style list is as wide as its widest choice, which
         is three characters now: the footnote is ¹. */
      setSideTab(refsPanel, true); await wait(60);
      const sel = document.getElementById('refStyleSelect');
      out.refSelect = {w: Math.round(sel.getBoundingClientRect().width), longest: Math.max(...[...sel.options].map(o=> o.textContent.length))};
      setSideTab(refsPanel, false);
      /* 6. A kind's preset opens level with its own button. */
      addFab.classList.add('open');
      await wait(300);                   // the column rises into place first
      out.preset = [];
      for(const gear of document.querySelectorAll('.add-fab-preset')){
        openPresetMenu(gear.dataset.kind);
        await wait(300);
        const c = addFabPresets.getBoundingClientRect(), row = gear.closest('.add-fab-row').getBoundingClientRect();
        const room = c.top >= 7 && c.bottom <= innerHeight - 7;
        out.preset.push(Math.abs((c.top + c.bottom) / 2 - (row.top + row.bottom) / 2) < 1.5 || (room && (c.top <= 8.5 || c.bottom >= innerHeight - 8.5)));
      }
      openPresetMenu(null); addFab.classList.remove('open');
      /* 7. The chart's history, from GitHub's list of the file's commits. */
      const realFetch = window.fetch, asked = [];
      window.fetch = async (url, o)=>{
        if(!/api\.github\.com/.test(String(url))) return realFetch(url, o);
        asked.push(String(url));
        return new Response(JSON.stringify([
          {sha: 'a'.repeat(40), commit: {message: 'Save from the site\n\nwith more', committer: {date: '2026-11-22T18:07:06Z'}}, author: {login: 'someone'}},
          {sha: 'b'.repeat(40), commit: {message: 'An older save', committer: {date: '2026-11-21T10:00:00Z'}}, author: {login: 'someone'}}]),
          {status: 200, headers: {'Content-Type': 'application/json'}});
      };
      try {
        document.getElementById('historyToggle').click();
        await wait(120);
        const items = [...document.querySelectorAll('#historyList .history-item')];
        const links = items[0] ? [...items[0].querySelectorAll('.history-links a')].map(a=> a.getAttribute('href')) : [];
        out.history = {open: historyOverlay.classList.contains('open'), n: items.length,
                       asks: asked.length === 1 && asked[0].includes('/repos/' + SITE_REPO + '/commits?path=src/chart.json'),
                       first: items[0] && items[0].querySelector('.history-what').textContent,
                       who: items[0] && items[0].querySelector('.history-who').textContent,
                       links: links.join(' '), more: document.getElementById('historyMore').hidden};
        window.fetch = async ()=>{ throw new Error('offline'); };
        closeHistory();
        document.getElementById('historyToggle').click();
        await wait(80);
        out.offline = document.getElementById('historyNote').hidden === false && !document.querySelectorAll('#historyList li').length &&
                      document.getElementById('historyAll').getAttribute('href') === 'https://github.com/' + SITE_REPO + '/commits/main/src/chart.json';
        closeHistory();
      } finally { window.fetch = realFetch; }
      /* 8. The field's ground: a colour and a picture, offered over open
         paper, kept with the chart and undone as edits. */
      const paper = svg.getBoundingClientRect();
      svg.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: paper.right - 30, clientY: paper.bottom - 30}));
      const offered = [...document.querySelectorAll('#touchMenu button')].filter(x=> !x.hidden).map(x=> x.dataset.act);
      document.querySelector('#touchMenu [data-act="background"]').click();
      out.bgOffered = offered.includes('background') && !bgMenu.hidden;
      setBackground({color: '#fdf3d7'}); await wait(60);
      out.bgColor = getComputedStyle(fieldRect).fill === 'rgb(253, 243, 215)' &&
                    getComputedStyle(svg).getPropertyValue('--field').trim() === '#fdf3d7' &&
                    /background: \{color:'#fdf3d7'\}/.test(serializeSettings(SETTINGS));
      const c = document.createElement('canvas'); c.width = c.height = 8;
      c.getContext('2d').fillRect(0, 0, 4, 4);
      const pic = c.toDataURL('image/png');
      setBackground({image: pic}); await wait(60);
      const im = document.getElementById('chartBackdrop');
      const f = chartField;
      out.bgPicture = !!im && im.tagName === 'image' && im.getAttribute('href') === pic && im.getAttribute('preserveAspectRatio') === 'xMidYMid slice' &&
                      +im.getAttribute('width') === f.x1 - f.x0 && im.previousElementSibling === fieldRect;
      setBackground({fit: 'tile'}); await wait(120);
      const tiled = document.getElementById('chartBackdrop');
      out.bgTile = tiled.tagName === 'rect' && tiled.getAttribute('fill') === 'url(#chart-backdrop-tile)' &&
                   document.querySelector('#chart-backdrop-tile image').getAttribute('href') === pic;
      undoLastEdit(); undoLastEdit(); await wait(60);
      out.bgUndone = SETTINGS.background && SETTINGS.background.color === '#fdf3d7' && !SETTINGS.background.image && !document.getElementById('chartBackdrop');
      closeBackgroundMenu();
    } finally {
      applyEdit(()=>{
        workingNodes.length = 0; was.forEach(x=> workingNodes.push(x));
        EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s));
        Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, wasSettings);
      });
    }
    out.bgGone = !document.getElementById('chartBackdrop') && getComputedStyle(fieldRect).fill !== 'rgb(253, 243, 215)';
    return out;
  });
  check('a note on a curve keeps its share of the way when an end moves, and stays on the line', r.curveNote.at === 0.3 && r.curveNote.near < 30, JSON.stringify(r.curveNote));
  check('the veil over an entry marked 18+ stays on while a finger moves the chart', r.veilMoving, JSON.stringify(r));
  check('the citation style list is only as wide as its widest choice', r.refSelect.longest <= 3 && r.refSelect.w <= 60, JSON.stringify(r.refSelect));
  check('a kind\'s preset opens level with its own button', r.preset.length >= 2 && r.preset.every(Boolean), JSON.stringify(r.preset));
  check('About opens the chart\'s history: each edit by when, by whom and what it was called, with its change, what came since, and the version itself',
        r.history.open && r.history.n === 2 && r.history.asks && r.history.first === 'Save from the site' && r.history.who === 'someone' &&
        /\/commit\/a{40} .*\/compare\/a{40}\.\.\.main .*\/blob\/a{40}\/src\/chart\.json/.test(r.history.links) && r.history.more, JSON.stringify(r.history));
  check('…and with no way to GitHub it says so and still offers the history there', r.offline, JSON.stringify(r));
  check('open paper offers the field\'s ground, a colour on the pages and in a double line\'s gap, kept with the chart', r.bgOffered && r.bgColor, JSON.stringify(r));
  check('…a picture laid to fill the field, or repeated, and both undone as edits', r.bgPicture && r.bgTile && r.bgUndone && r.bgGone, JSON.stringify(r));
  });

  /* What the chart is called and what it is about are the chart's
     (settings.title, settings.description, settings.about), written in
     About and carried with it — not the platform's words in index.html and
     build.py, which every copy of the platform published as its own. */
  /* The owner's list of 23.11: scenarios that come back into view, see
     what covers them, set each other off and wait; bold and italic
     citations; a field spaced to the drawing's letters; the phone's
     status beside Save, and a toolbar that does not blank while the bar
     folds; the reader's book and the layers. */
  await scenario("the owner's list of 23.11: scenarios in sight, in chains and on timers, citations' face, the field's spacing, the phone's bar", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS)), wasRefs = REFS.slice();
    const wasView = {vx, vy, vs};
    const X = 9600, Y = 9600, out = {};
    const realRun = runScenario;
    const fired = {};
    try {
      applyEdit(()=>{
        ['ivA', 'ivC', 'ivD', 'ivE', 'ivF'].forEach((id, i)=>
          workingNodes.push([id, 'Entry ' + id, null, null, null, null, {pos:[X + i * 300, Y]}]));
        SETTINGS.scenarios = [
          {id: 'iv', when: {type: 'inView', node: 'ivA'}, then: [{do: 'anim', node: 'ivA', anim: 'glow'}]},
          {id: 'iv1', when: {type: 'inView', node: 'ivA'}, once: true, then: [{do: 'anim', node: 'ivA', anim: 'glow'}]},
          {id: 'c1', when: {type: 'press', node: 'ivC'}, then: [{do: 'anim', node: 'ivD', anim: 'shake'}]},
          {id: 'c2', when: {type: 'animEnd', node: 'ivD'}, then: [{do: 'hide', node: 'ivE', wait: 0.3}]},
          {id: 'c3', when: {type: 'hidden', node: 'ivE'}, then: [{do: 'show', node: 'ivF'}]},
          {id: 'st', when: {type: 'start'}, then: [{do: 'anim', node: 'ivC', anim: 'pulse'}]}
        ];
      });
      await wait(80);
      out.cleaned = JSON.stringify(cleanScenarios(SETTINGS.scenarios).map(s=> [s.when.type, !!s.once, s.then.map(a=> a.wait || 0).join()]));
      runScenario = function(s, d){ fired[s.id] = (fired[s.id] || 0) + 1; return realRun(s, d); };
      setReaderPreview(true); await wait(150);
      scenariosReset(); applyVisibility(); scenariosStart(); await wait(60);
      out.started = fired.st === 1 && document.querySelector('.node[data-id="ivC"]').classList.contains('scn-pulse');
      const n = nodes.get('ivA'), rect = svg.getBoundingClientRect();
      const look = async (sx, sy)=>{ vs = 1; vx = sx - n.x; vy = sy - n.y; applyTransform(); scenariosInView(); await wait(80); };
      await look(-4000, -4000);
      const away = fired.iv || 0;
      await look(rect.width / 2, rect.height / 2);
      const first = fired.iv || 0;
      await look(-4000, -4000);
      await look(rect.width / 2, rect.height / 2);
      out.inView = [away, first, fired.iv || 0, fired.iv1 || 0].join();
      /* Under the bar: on the screen, but not in sight. */
      await look(-4000, -4000);
      const bar = document.querySelector('.topbar').getBoundingClientRect();
      await look(rect.width / 2, bar.top + 2 - rect.top);
      out.underBar = (fired.iv || 0) === 2 && !entryInSight(n);
      await look(rect.width / 2, rect.height / 2);
      out.outFromUnder = fired.iv === 3;
      /* A chain: pressed → shakes → after it, and 0.3 s more, another
         goes → its going shows a third. */
      const heldF = ()=> scenarioHeld(nodes.get('ivF'));
      out.chainBefore = heldF() && !scenarioHeld(nodes.get('ivE'));
      scenariosPressed('ivC'); await wait(40);
      out.shook = document.querySelector('.node[data-id="ivD"]').classList.contains('scn-shake');
      await wait(650);
      out.waited = !scenarioHeld(nodes.get('ivE'));
      await wait(450);
      out.chained = scenarioHeld(nodes.get('ivE')) && !heldF();
      /* Reset stops what is still waiting. */
      scenariosReset(); applyVisibility();
      scenariosPressed('ivC'); scenariosReset(); applyVisibility(); await wait(1200);
      out.resetStops = !scenarioHeld(nodes.get('ivE'));
      setReaderPreview(false); await wait(150);
      runScenario = realRun;
      /* The studio offers the new triggers, the once and the seconds. */
      document.getElementById('studioToggle').click(); await wait(80);
      const trig = document.querySelector('#studioList .scn-card .scn-select');
      const cards = [...document.querySelectorAll('#studioList .scn-card')];
      out.studio = !!trig && trig.options.length === 8 && document.querySelectorAll('#studioList .scn-secs').length === 6 &&
                   cards.length === 6 && !cards[5].firstElementChild.querySelector('.scn-chip');
      const secs = document.querySelectorAll('#studioList .scn-secs')[3];
      out.secsShown = secs && secs.value === '0.3';
      secs.value = '2.5'; secs.dispatchEvent(new Event('change'));
      out.secsSet = SETTINGS.scenarios[3].then[0].wait === 2.5;
      document.getElementById('studioClose').click();
      { const kept = JSON.parse(chartFileText()).settings.scenarios;
        out.saved = kept[1].once === true && kept[3].then[0].wait === 2.5 && kept[5].when.type === 'start' && !('node' in kept[5].when); }

      /* Citations in bold and italic: drawn so, measured so, kept. */
      refill(REFS, [{key: 'bi_r', title: 'One', detail: '', url: ''}]);
      applyEdit(()=> workingNodes.push(['biA', 'Cites{{r:bi_r}} here', null, null, null, null, {pos:[X, Y + 400]}]));
      await wait(60);
      const w0 = document.querySelector('.node[data-id="biA"] .ref-mark').getComputedTextLength();
      document.getElementById('refBoldToggle').click();
      document.getElementById('refItalicToggle').click();
      await wait(60);
      const m = document.querySelector('.node[data-id="biA"] .ref-mark');
      out.refFace = SETTINGS.refBold === true && SETTINGS.refItalic === true &&
                    getComputedStyle(m).fontWeight === '700' && getComputedStyle(m).fontStyle === 'italic' &&
                    document.getElementById('refBoldToggle').getAttribute('aria-pressed') === 'true' &&
                    m.getComputedTextLength() !== w0;
      const kept = JSON.parse(chartFileText()).settings;
      out.refKept = kept.refBold === true && kept.refItalic === true;
      document.getElementById('refBoldToggle').click();
      out.refOff = SETTINGS.refBold === undefined && SETTINGS.refItalic === true;

      /* The field spaced onto the drawing: where the widths the drawing
         measured run a little wider than the browser's own letters, as a
         phone's can, the field still lies on the drawing's letters. */
      const realMeasure = measureText;
      measureText = function(t, o){ return realMeasure(t, o) * 1.012; };
      measureCache.clear(); blockCache.clear(); routeLast = null;
      applyEdit(()=> workingNodes.push(['skA', '{{u:solid|Beast Wars: [[Up|a reading]]rising фыву and more}}', null, null, null, null, {pos:[X, Y + 800]}]));
      rebuildChart();
      const k = nodes.get('skA'), r2 = svg.getBoundingClientRect();
      vs = 2.4; vx = -(k.x + k.w/2)*vs + r2.width/2; vy = -(k.y + k.h/2)*vs + r2.height/2; applyTransform();
      const drawnAt = ()=>{
        const xs = [];
        document.querySelectorAll('.node[data-id="skA"] text tspan').forEach(t=>{
          if(t.querySelector('tspan') || t.classList.contains('ruby-anno') || t.classList.contains('text-gap')) return;
          const s = t.textContent, mm = t.getScreenCTM();
          for(let i = 0; i < s.length; i++){ if(/\s/.test(s[i])) continue; xs.push(new DOMPoint(t.getExtentOfChar(i).x, 0).matrixTransform(mm).x); }
        });
        return xs;
      };
      let drawn = drawnAt();
      selectedId = 'skA'; openNodeEditor('skA'); await wait(200);
      const typedAt = ()=>{
        const surf = richFields.get('nodeEditorText').surface, xs = [];
        const tw = document.createTreeWalker(surf, NodeFilter.SHOW_TEXT); let tn;
        while((tn = tw.nextNode())){
          if(tn.parentElement.closest('rt')) continue;
          for(let i = 0; i < tn.textContent.length; i++){
            if(/\s/.test(tn.textContent[i])) continue;
            const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 1); xs.push(rg.getBoundingClientRect().left);
          }
        }
        return xs;
      };
      const worst = xs=> xs.length === drawn.length ? Math.max(...xs.map((x, i)=> Math.abs(x - drawn[i]))) : -1;
      out.stretched = +worst(typedAt()).toFixed(2);
      const stretch = document.getElementById('nodeEditorStretch'), seat = document.getElementById('nodeEditorSeat');
      const keptStretch = stretch.textContent, keptSeat = seat.textContent;
      stretch.textContent = ''; seat.textContent = '';
      out.unstretched = +worst(typedAt()).toFixed(2);
      stretch.textContent = keptStretch; seat.textContent = keptSeat;
      closeNodeEditor(false);
      measureText = realMeasure; measureCache.clear(); blockCache.clear(); routeLast = null;
      /* …and where the two agree, it stays where it was. */
      rebuildChart(); drawn = drawnAt(); openNodeEditor('skA'); await wait(200);
      out.agreeWorst = +worst(typedAt()).toFixed(2);
      closeNodeEditor(false);

      /* The icons: an eye over a book for the reader's view, layers for
         the patches. */
      out.icons = document.querySelectorAll('#lodToggle svg path').length === 3 &&
                  !!document.querySelector('#readerToggle svg circle') && document.querySelectorAll('#readerToggle svg path').length === 3;
    } finally {
      runScenario = realRun;
      if(readerPreview) setReaderPreview(false);
      closeNodeEditor(false);
      refill(REFS, wasRefs);
      applyEdit(()=>{
        workingNodes.length = 0; was.forEach(x=> workingNodes.push(x));
        EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s));
        Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, wasSettings);
      });
      vx = wasView.vx; vy = wasView.vy; vs = wasView.vs; applyTransform();
      deselect(); rebuildChart();
    }
    return out;
  });
  check('a scenario is kept with its trigger, its once and its steps\' seconds',
        r.cleaned === '[["inView",false,"0"],["inView",true,"0"],["press",false,"0"],["animEnd",false,"0.3"],["hidden",false,"0"],["start",false,"0"]]', r.cleaned);
  check('a scenario set off by the chart opening plays when it opens', r.started);
  check('coming into view plays every time the entry comes back into view, and once if told so', r.inView === '0,1,2,1', r.inView);
  check('…an entry under the bar is not in view, and plays when it comes out from under it', r.underBar && r.outFromUnder, JSON.stringify([r.underBar, r.outFromUnder]));
  check('a chain: an animation\'s end sets off the next, which waits its seconds, and an entry going shows another',
        r.chainBefore && r.shook && r.waited && r.chained, JSON.stringify([r.chainBefore, r.shook, r.waited, r.chained]));
  check('…and Reset stops what was still waiting', r.resetStops);
  check('the studio offers its eight triggers and a step\'s seconds, and keeps them with the chart',
        r.studio && r.secsShown && r.secsSet && r.saved, JSON.stringify([r.studio, r.secsShown, r.secsSet, r.saved]));
  check('citations are set in bold and italic from References, measured so, and kept', r.refFace && r.refKept && r.refOff,
        JSON.stringify([r.refFace, r.refKept, r.refOff]));
  check('where the drawing measured its words wider than the browser sets them, the field is spaced onto the drawing\'s letters',
        r.stretched >= 0 && r.stretched < 0.6 && r.unstretched > 1.5, JSON.stringify([r.stretched, r.unstretched]));
  check('…and where they agree, it stays on them', r.agreeWorst >= 0 && r.agreeWorst < 0.6, JSON.stringify(r.agreeWorst));
  check('the reader\'s view is a book with an eye, the patches are layers', r.icons);

  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    const ph = await pp.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const o = {};
      applyEdit(()=>{ SETTINGS.refItalic = true; });
      await wait(100);
      const q = sel=> document.querySelector(sel).getBoundingClientRect();
      const st = q('#saveState'), sv = q('#saveBtn');
      o.status = document.getElementById('saveState').classList.contains('dirty') &&
                 st.left >= sv.right - 0.5 && Math.abs((st.top + st.bottom)/2 - (sv.top + sv.bottom)/2) < 6 &&
                 st.right <= window.innerWidth;
      /* The toolbar through the fold: at every frame it is there, at the
         bar's lower edge. */
      document.body.classList.add('touch-input');
      const bar = document.querySelector('.topbar'), row = document.getElementById('toolRow');
      let seen = 0, lost = 0;
      const t0 = performance.now();
      setPhoneBarHidden(1);
      await new Promise(done=>{
        const look = ()=>{
          if(bar.classList.contains('folding')){
            seen++;
            const b = bar.getBoundingClientRect(), t = row.getBoundingClientRect();
            if(Math.abs(t.bottom - b.bottom) > 1.5 || getComputedStyle(row).opacity !== '1') lost++;
          }
          if(performance.now() - t0 < 700) requestAnimationFrame(look); else done();
        };
        requestAnimationFrame(look);
      });
      o.fold = {seen, lost};
      setPhoneBarHidden(0); await wait(600);
      return o;
    });
    check('on a phone the chart\'s status stands to the right of Save', ph.status, JSON.stringify(ph));
    check('…and while the bar folds, its toolbar stays at its lower edge rather than blanking',
          ph.fold.seen > 2 && ph.fold.lost === 0, JSON.stringify(ph.fold));
  } finally {
    await phone.close();
  }
  });

  await scenario("the chart's own name and description", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS));
    const out = {};
    const type = (id, v)=>{ const f = document.getElementById(id); f.focus(); f.value = v; f.dispatchEvent(new Event('change')); f.blur(); };
    try{
      ['title', 'description', 'about'].forEach(k=> delete SETTINGS[k]);
      rebuildChart();
      out.platformName = document.title === APP_NAME;
      document.getElementById('aboutToggle').click(); await wait(150);
      out.formShown = getComputedStyle(document.getElementById('aboutChartEdit')).display !== 'none';
      out.emptyHidden = getComputedStyle(document.getElementById('aboutChart')).display === 'none';
      type('chartTitleField', '  Rivers of the North  ');
      type('chartAboutField', 'Where the *water* goes.\n\nSecond paragraph.');
      type('chartDescField', 'One sentence.');
      await wait(50);
      out.saved = SETTINGS.title === 'Rivers of the North' && SETTINGS.description === 'One sentence.'
        && SETTINGS.about === 'Where the *water* goes.\n\nSecond paragraph.';
      out.tab = document.title === 'Rivers of the North';
      const box = document.getElementById('aboutChart');
      out.shown = box.querySelector('.about-chart-title').textContent === 'Rivers of the North'
        && !!box.querySelector('.about-chart-text em, .about-chart-text i') && box.textContent.includes('Second paragraph.');
      out.notTranslated = box.getAttribute('translate') === 'no';
      out.dirty = isDirty();
      /* One undo step a field, and the field follows it back. */
      undoLastEdit(); await wait(50);
      out.undone = SETTINGS.description === undefined && document.getElementById('chartDescField').value === '';
      /* An empty field is no setting: the platform's name comes back. */
      type('chartTitleField', '   ');
      out.cleared = SETTINGS.title === undefined && document.title === APP_NAME;
      /* A chart brought in from a file brings its words, and one that has
         none does not keep the words of the chart it replaced. */
      const file = chartJsonText({format: DATA_FORMAT, nodes: [{id: 'w1', label: 'One'}],
        settings: {title: 'Imported', about: 'From a file.'}});
      const keep = workingNodes.map(x=> x.slice());
      importChartFromText(file); await wait(50);
      out.imported = SETTINGS.title === 'Imported' && SETTINGS.about === 'From a file.' && SETTINGS.description === undefined
        && document.title === 'Imported' && document.getElementById('chartTitleField').value === 'Imported';
      importChartFromText(chartJsonText({format: DATA_FORMAT, nodes: [{id: 'w2', label: 'Two'}], settings: {}})); await wait(50);
      out.importedNone = SETTINGS.title === undefined && SETTINGS.about === undefined && document.title === APP_NAME;
      applyEdit(()=>{ workingNodes = keep; });
      /* A reader reads the words and has no fields to change them. */
      SETTINGS.title = 'Read only'; SETTINGS.about = 'Words.';
      document.body.classList.add('read-only');
      rebuildChart();
      out.readerNoForm = getComputedStyle(document.getElementById('aboutChartEdit')).display === 'none'
        && document.getElementById('aboutChart').textContent.includes('Words.');
      document.body.classList.remove('read-only');
      /* Where the page is the site: at the site's address or below it,
         and a site under a path is not its neighbours on the same origin. */
      out.atSite = [
        atSite('https://a.github.io/', 'https://a.github.io'),
        atSite('https://a.github.io/#entry=x', 'https://a.github.io/'),
        atSite('https://a.github.io/charts/', 'https://a.github.io/charts'),
        atSite('https://a.github.io/charts', 'https://a.github.io/charts'),
        atSite('https://a.github.io/charts/index.html?x', 'https://a.github.io/charts'),
        !atSite('https://a.github.io/chartsandmore/', 'https://a.github.io/charts'),
        !atSite('https://a.github.io/', 'https://a.github.io/charts'),
        !atSite('https://b.github.io/charts/', 'https://a.github.io/charts'),
        !atSite('http://a.github.io/', 'https://a.github.io')
      ].every(Boolean);
    } finally {
      document.getElementById('aboutClose').click();
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
      Object.assign(SETTINGS, wasSettings);
      rebuildChart();
    }
    return out;
  });
  check('a chart that names nothing is called by the platform\'s name, and About shows no words for it',
        r.platformName && r.emptyHidden, JSON.stringify([r.platformName, r.emptyHidden]));
  check('the owner writes its name, its sentence and its About in About, kept in the chart\'s settings',
        r.formShown && r.saved && r.dirty, JSON.stringify([r.formShown, r.saved, r.dirty]));
  check('the name is the tab\'s title, and About shows it and the text, in the markup a note is, untranslated',
        r.tab && r.shown && r.notTranslated, JSON.stringify([r.tab, r.shown, r.notTranslated]));
  check('each field is a step of undo, and an empty one is no setting', r.undone && r.cleared, JSON.stringify([r.undone, r.cleared]));
  check('an imported chart brings its own words, and one with none keeps none', r.imported && r.importedNone,
        JSON.stringify([r.imported, r.importedNone]));
  check('a reader reads them and has nothing to fill in', r.readerNoForm);
  check('the page is on the site at the site\'s address or below it, and only there', r.atSite);
  });

  await scenario("the owner's list of 24.11: the text bar's own controls, folds that move, a closer overview, carried in, a scenario's own gestures, a GIF's motion, a see-through border", async () => {
  const GIF = 'data:image/gif;base64,' + fs.readFileSync(path.join(FIXTURE_DIR, 'media',
    '6e0523cdee2b91dd3614a252a3b474e4473e1359acafa5b6de3daa574299b9ec.gif')).toString('base64');
  const r = await page.evaluate(async (GIF)=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const was = workingNodes.map(x=> x.slice()), wasStyles = EDGE_STYLES.map(s=> Object.assign({}, s));
    const wasSettings = JSON.parse(JSON.stringify(SETTINGS));
    const out = {};
    const X = 9600, Y = 9600;
    try {
      applyEdit(()=>{
        workingNodes.push(['lt1', 'Words', null, null, null, null, {pos: [X, Y]}]);
        workingNodes.push(['lt2', 'Gif', null, null, null, null, {pos: [X + 400, Y], image: GIF}]);
        workingNodes.push(['lt3', 'See-through', null, null, null, null, {pos: [X, Y + 400], colors: ['#1e5ac866']}]);
        workingNodes.push(['lt4', 'Below', 'lt3', null, null, null, {pos: [X, Y + 700]}]);
      });
      rebuildChart(); await wait(120);

      /* 3, 4: the face, the size and the rules of the text bar. */
      selectedId = 'lt1';
      openNodeEditor('lt1'); await wait(250);
      const bar = document.getElementById('nodeEditorBar');
      const face = bar.querySelector('.tb-face-btn'), size = bar.querySelector('.tb-size-field');
      out.controls = !!face && !!size && !!bar.querySelector('.tb-size-reset')
        && !!bar.querySelector('.tb-split-under .tb-split-caret') && !!bar.querySelector('.tb-split-strike .tb-split-caret')
        && getComputedStyle(bar.querySelector('.tb-font.tb-native')).display === 'none';
      out.sizeNumber = /^\d+(\.\d+)?$/.test(size.value) && size.readOnly;
      face.click(); await wait(60);
      const items = [...document.querySelectorAll('.tb-drop:not([hidden]) .tb-drop-item')];
      out.faceList = items.length > 3 && items.every(b=> !/…|clear|\(/i.test(b.textContent))
        && items.some(b=> b.firstElementChild && b.firstElementChild.style.fontFamily);
      out.faceOn = items.filter(b=> b.classList.contains('on')).length === 1;
      closeTbDrop();
      size.click(); await wait(60);
      const sizes = [...document.querySelectorAll('.tb-drop:not([hidden]) .tb-drop-item')].map(b=> b.textContent.trim());
      out.sizeList = sizes.length > 4 && sizes.every(t=> /^\d+(\.\d+)?$/.test(t));
      closeTbDrop();
      size.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})); await wait(30);
      out.typeable = !size.readOnly;
      closeNodeEditor(); await wait(150);

      /* 8: a category folds by its height, not at once. */
      const sec = document.createElement('div');
      sec.innerHTML = '<div style="height:20px">head</div><div style="height:200px">body</div>';
      document.body.appendChild(sec);
      let changed = false;
      foldWithMotion(sec, true, ()=>{ changed = true; });
      await wait(FOLD_MS / 2);
      const midway = sec.offsetHeight;
      out.folds = !changed && midway > 20 && midway < 220;
      await wait(FOLD_MS + 80);
      out.foldDone = changed;
      sec.remove();

      /* 9: the wheel over the overview brings it closer and leaves the view. */
      setMinimap(true); await wait(60);
      const cv = document.getElementById('minimapCanvas'), cr = cv.getBoundingClientRect();
      const view = [vx, vy, vs].join();
      cv.dispatchEvent(new WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -300,
        clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2}));
      await wait(60);
      out.closer = minimapZoom.k > 1 && [vx, vy, vs].join() === view;
      setMinimap(false);
      out.zoomReset = minimapZoom.k === 1;

      /* 11: a menu over an entry and away again is not its coming into view. */
      centreViewOn(X + 60, Y + 30, 1); await wait(60);
      const n1 = nodes.get('lt1');
      out.inSight = entryInSight(n1) === true;
      const cover = document.createElement('div');
      cover.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff';
      document.body.appendChild(cover);
      out.covered = entryInSight(n1) === 'covered';
      cover.remove();
      scnPickedAt = performance.now();
      out.pickSwallows = scnPickSwallows() && openNodeEditor('lt1') === false && document.getElementById('nodeEditor').hidden;
      scnPickedAt = -1e9;
      out.pickLetGo = !scnPickSwallows();

      /* 12: the words being typed are the drawing's own, seen through the field. */
      openNodeEditor('lt1'); await wait(250);
      out.inkFromDrawing = document.getElementById('nodeEditor').classList.contains('ink-from-drawing');
      closeNodeEditor(); await wait(150);

      /* 14: a moving picture's motion is pressed round in My files. */
      document.getElementById('filesToggle').click(); await wait(150);
      const cellOf = ()=> [...document.querySelectorAll('#filesGrid .file-cell')].find(c=> (c.querySelector('img') || {}).src === GIF);
      const anim = cellOf() && cellOf().querySelector('.file-anim');
      out.animShown = !!anim && anim.dataset.value === 'play';
      if(anim){ anim.click(); await wait(60); }
      const lt2 = workingEntry('lt2');
      out.animTurned = !!lt2 && entryOpts(lt2.entry).anim === 'still'
        && (cellOf().querySelector('.file-anim') || {dataset: {}}).dataset.value === 'still';
      stickerOverlay.classList.remove('open');

      /* 17: a bare end stops at the middle of a see-through border. */
      const st = edgeStyleFor('lt3', 'lt4');
      out.bareCut = bareEndCut(st || {}, null, 'lt3') > 0 && bareEndCut(st || {}, null, 'lt1') === 0;
    } finally {
      closeTbDrop(); closeNodeEditor(); endPlacing(); closeAddFab();
      applyEdit(()=>{ workingNodes = was; EDGE_STYLES.length = 0; wasStyles.forEach(s=> EDGE_STYLES.push(s)); });
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
      Object.assign(SETTINGS, wasSettings);
      rebuildChart();
    }
    return out;
  }, GIF);
  check('the text bar has a face button, a size field with its reset, and underline and strike with a caret each',
        r.controls && r.sizeNumber, JSON.stringify([r.controls, r.sizeNumber]));
  check('the face list writes each face in itself, without "Face…", "clear" or a (kind), and marks the one in use',
        r.faceList && r.faceOn, JSON.stringify([r.faceList, r.faceOn]));
  check('the size list is numbers, and a double click lets a size of one\'s own be typed', r.sizeList && r.typeable,
        JSON.stringify([r.sizeList, r.typeable]));
  check('a fold goes by its height and changes the list when it is shut', r.folds && r.foldDone, JSON.stringify([r.folds, r.foldDone]));
  check('the wheel over the overview brings it closer without moving the chart, and closing it lets go',
        r.closer && r.zoomReset, JSON.stringify([r.closer, r.zoomReset]));
  check('an entry under a menu is covered, neither in sight nor out of it', r.inSight && r.covered, JSON.stringify([r.inSight, r.covered]));
  check('picking an entry for a scenario opens no text, and lets go afterwards', r.pickSwallows && r.pickLetGo,
        JSON.stringify([r.pickSwallows, r.pickLetGo]));
  check('an entry\'s words are typed over its own drawing', r.inkFromDrawing);
  check('a GIF an entry wears is set moving, still or on hover from My files', r.animShown && r.animTurned,
        JSON.stringify([r.animShown, r.animTurned]));
  check('a headless end stops at the middle of a see-through border, and only there', r.bareCut);

  /* 10, 15: pinned by a click, and carried to where the pointer puts it. */
  /* Pointed at first, and pressed once the menu the pointer opened has
     settled and the button is what a press there reaches: on a slower
     runner a press made at once could land while the menu was still
     coming out (CI, 24.11). */
  const fabAt = ()=> page.evaluate(()=>{ const b = document.getElementById('addFabBtn').getBoundingClientRect();
    return {x: b.left + b.width / 2, y: b.top + b.height / 2}; });
  let fab = await fabAt();
  await page.mouse.move(fab.x, fab.y); await page.waitForTimeout(300);
  fab = await fabAt();
  await page.waitForFunction(({x, y})=>{ const e = document.elementFromPoint(x, y);
    return !!e && document.getElementById('addFabBtn').contains(e); }, fab, {timeout: 3000}).catch(()=>{});
  const fabSeen = await page.evaluate(({x, y})=>{ const e = document.elementFromPoint(x, y);
    return [e ? e.tagName + '.' + e.className : null, document.getElementById('addFab').className].join(' | '); }, fab);
  await page.mouse.click(fab.x, fab.y); await page.waitForTimeout(150);
  const pinned = await page.evaluate(()=> document.getElementById('addFab').classList.contains('pinned'));
  await page.mouse.move(fab.x - 300, fab.y - 300); await page.waitForTimeout(150);
  const held = await page.evaluate(()=> document.getElementById('addFab').classList.contains('open'));
  const rect = await page.evaluate(()=>{ const b = document.querySelector('#addFabStyles .node-style-btn[data-value="rect"]').getBoundingClientRect();
    return {x: b.left + b.width / 2, y: b.top + b.height / 2}; });
  await page.mouse.move(rect.x, rect.y); await page.mouse.click(rect.x, rect.y); await page.waitForTimeout(100);
  const at = {x: 420, y: 360};
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(60);
  const ghost = await page.evaluate(()=> document.body.classList.contains('placing') && !placeGhost.hidden);
  const before = await page.evaluate(()=> workingNodes.length);
  await page.mouse.click(at.x, at.y); await page.waitForTimeout(300);
  const put = await page.evaluate(({x, y, before})=>{
    const added = workingNodes.length === before + 1 ? workingNodes[workingNodes.length - 1] : null;
    const n = added && nodes.get(added[0]);
    const w = clientToWorld(x, y);
    const res = {added: !!n, near: !!n && Math.abs(n.x + n.w / 2 - w.x) <= GRID && Math.abs(n.y + n.h / 2 - w.y) <= GRID,
                 done: !document.body.classList.contains('placing')};
    closeNodeEditor();
    if(added) applyEdit(()=>{ workingNodes = workingNodes.filter(e=> e[0] !== added[0]); });
    closeAddFab(); rebuildChart();
    return res;
  }, {x: at.x, y: at.y, before});
  check('a click on + pins its menu open until the next one', pinned && held, JSON.stringify([pinned, held, fabSeen]));
  check('an entry picked with a mouse rides under the pointer and is put down where it is pressed',
        ghost && put.added && put.near && put.done, JSON.stringify([ghost, put]));
  });

  await scenario("the owner's list of 25.11: one glow round an entry and its tabs, rules of two kinds, readings, the card's body, the field's gradient, dashes side by side, legs that grow, the selection's frame, switches, templates and fixed ports", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const out = {};
    const X = 70000, Y = 70000;
    applyEdit(()=>{
      workingNodes.push(['h1', 'Linked', null, null, null, null, {pos: [X, Y], link: 'https://example.com', multiLang: true, langTabs: [{tag: 'JP', text: 'a'}, {tag: 'RU', text: 'b'}]}]);
      workingNodes.push(['d1', 'Dashed', null, null, null, null, {pos: [X + 300, Y], border: 'dashed', size: [120, 60]}]);
      workingNodes.push(['d2', 'Below', 'd1', null, null, null, {pos: [X + 500, Y + 300]}]);
      workingNodes.push(['sw', 'Power', null, null, null, null, {pos: [X, Y + 400], switch: {onLabel: 'on', onColor: '#2e7d32'}}]);
      workingNodes.push(['sp', 'Splitter', ['h1'], null, null, null, {pos: [X + 900, Y], size: [100, 80], ports: {left: 1, right: 4}}]);
      for(let i = 0; i < 4; i++) workingNodes.push(['so' + i, 'Out ' + i, 'sp', null, null, null, {pos: [X + 1200, Y - 120 + i * 80]}]);
    });
    const ds = EDGE_STYLES.find(o=> o.from === 'd1' && o.to === 'd2') || (EDGE_STYLES.push({from: 'd1', to: 'd2'}), EDGE_STYLES[EDGE_STYLES.length - 1]);
    ds.dash = 'dashed'; ds.routing = 'orthogonal';
    routeLast = null; rebuildChart(); await wait(200);

    // 1: one halo, traced round the outline and its tabs.
    selectNode('h1'); await wait(80);
    const g = document.querySelector('.node[data-id="h1"]');
    const halo = g && g.querySelector(':scope > .node-halo');
    out.halo = !!halo && g.firstElementChild === halo && halo.children.length >= 2 &&
               getComputedStyle(halo).display !== 'none';
    deselect();

    // 2: an underline and a strike of two kinds are two boxes.
    const two = runToHtml({type: 'text', text: 'x', under: 'wavy', strike: 'solid'});
    out.twoRules = /line-through;text-decoration-style:solid/.test(two) && /underline;text-decoration-style:wavy/.test(two);
    out.ruleSample = !!ruleSampleSvg && !/>\s*ab|>\s*U</.test(ruleSampleSvg('dashed'));

    // 7: a reading takes only its word's size.
    const t7 = tokenizeLabel('{{s:20|**[[w|a]]**}}')[0];
    out.rubyBare = !!t7 && !(t7.annoRuns || []).some(x=> x.bold);

    // 5: the field's gradient.
    applyEdit(()=>{ SETTINGS.background = {color: '#ffffff', gradient: ['#c9d3e3', '#334455']}; });
    await wait(60);
    const grad = document.getElementById('chart-field-grad');
    out.gradient = !!grad && grad.querySelectorAll('stop').length === 3;
    out.gradientKept = JSON.stringify(cleanBackground({color: '#fff000', gradient: ['#000000', 'bad']}).gradient) === '["#000000"]';
    applyEdit(()=>{ delete SETTINGS.background; });

    // 10: each side and each leg starts and ends on a whole dash.
    const border = document.querySelector('.node[data-id="d1"] [stroke-dasharray]');
    const arr = border ? border.getAttribute('stroke-dasharray').split(/\s+/).map(Number) : [];
    out.borderFitted = arr.length > 4 && border.getAttribute('stroke-dasharray') !== '7 5';
    const line = document.querySelector('.edge.struct[data-from="d1"][data-to="d2"]');
    const f = line && fittedDash(line.getAttribute('d'), '7 5');
    const sum = f ? f.array.split(' ').map(Number).reduce((a, b)=> a + b, 0) : 0;
    out.legsFitted = !!line && !!line.dataset.fitDash && Math.abs(sum - line.getTotalLength()) < 1.5;

    // 3: a stretch out of a carried entry goes with it, and the one along the carry grows.
    const slid = slideBends({bends: [[X + 360, Y + 150], [X + 560, Y + 150]], from: {x: X + 360, y: Y + 60}, reversed: false}, 40, 0);
    out.slides = slid[0][0] === X + 400 && slid[1][0] === X + 560;
    const down = slideBends({bends: [[X + 360, Y + 150], [X + 560, Y + 150]], from: {x: X + 360, y: Y + 60}, reversed: false}, 0, 30);
    out.slidesDown = down[0][1] === Y + 150;

    // 8: a cut card's connectors meet its body.
    applyEdit(()=>{
      workingNodes.push(['cc', 'Card', null, null, 'Body', null, {pos: [X, Y + 700], card: true, cardCut: true, image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}]);
    });
    await wait(80);
    const cn = nodes.get('cc');
    out.cardBody = !!cn && (!cn.cardCutRun || (Array.isArray(cn.cardBodyRun) && cn.cardBodyRun[0].y > 0));

    // 11: a switch flips: saved by the editor, the reader's own in reading.
    let pill = document.querySelector('[data-switch="sw"]');
    out.switchDrawn = !!pill && pill.getAttribute('aria-checked') === 'false';
    pill.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await wait(80);
    out.switchSaved = workingEntry('sw').entry[6].switch.on === true && nodes.get('sw').color === '#2e7d32' &&
                      document.querySelector('[data-switch="sw"]').getAttribute('aria-checked') === 'true';
    readOnlyView = true;
    flipSwitch('sw');
    out.switchReader = nodes.get('sw').switch.on === false && workingEntry('sw').entry[6].switch.on === true;
    readOnlyView = false; switchFlips.clear(); rebuildChart();
    out.switchTriggers = SCN_TRIGGERS.includes('switchOn') && SCN_TRIGGERS.includes('switchOff');

    // 6: fixed ports, kept by a template.
    const ports = [];
    drawnRoutes.forEach((rt, k)=>{ if(k.startsWith('sp::')) ports.push(Math.round(rt.pts[0].x) + ',' + Math.round(rt.pts[0].y)); });
    const spn = nodes.get('sp');
    out.fixedRight = ports.length === 4 && new Set(ports).size === 4 && ports.every(p=> +p.split(',')[0] === Math.round(spn.x + spn.w));
    const into = drawnRoutes.get('h1::sp');
    out.fixedLeft = !!into && Math.round(into.pts[into.pts.length - 1].x) === Math.round(spn.x);
    out.portMarks = document.querySelectorAll('.node[data-id="sp"] .fixed-port').length === 5;
    saveAsTemplate('sp');
    const tpl = (SETTINGS.nodeTemplates || []).find(t=> t.name === 'Splitter');
    out.template = !!tpl && tpl.opts.ports.left === 1 && tpl.opts.ports.right === 4 && !tpl.opts.pos;
    openAddFab(); await wait(40);
    /* Templates are set aside (26.11): kept and still made from, but + no
       longer offers them, nor + a new switch. */
    out.templateOffered = !document.querySelector('#addFabStyles .node-style-btn.tpl') &&
                          !document.querySelector('#addFabStyles .node-style-btn[data-value="switch"]');
    closeAddFab();
    const made = addFromTemplate(tpl, {x: X + 900, y: Y + 400});
    closeNodeEditor();
    out.templateMade = !!made && !!nodes.get(made).ports && nodes.get(made).ports.right === 4;
    return out;
  });
  check('a picked entry and its tabs glow as one shape', r.halo);
  check('an underline and a strike of different kinds are drawn each in its own kind, and the list shows only lines',
        r.twoRules && r.ruleSample, JSON.stringify([r.twoRules, r.ruleSample]));
  check('a reading keeps the size of its word and nothing else', r.rubyBare);
  check('the field takes a gradient of several colours, kept with the colour it starts from',
        r.gradient && r.gradientKept, JSON.stringify([r.gradient, r.gradientKept]));
  check('a dashed border and a dashed connector are dashed side by side, leg by leg',
        r.borderFitted && r.legsFitted, JSON.stringify([r.borderFitted, r.legsFitted]));
  check('carried along a stretch, the corners before it go with the entry and that stretch grows',
        r.slides && r.slidesDown, JSON.stringify([r.slides, r.slidesDown]));
  check('a card cut to its picture is met at its body', r.cardBody);
  check('a switch flips: the editor\'s press is saved, a reader\'s is their own',
        r.switchDrawn && r.switchSaved && r.switchReader && r.switchTriggers,
        JSON.stringify([r.switchDrawn, r.switchSaved, r.switchReader, r.switchTriggers]));
  check('ports fixed by hand are where connectors meet, and a side with none gives way',
        r.fixedRight && r.fixedLeft && r.portMarks, JSON.stringify([r.fixedRight, r.fixedLeft, r.portMarks]));
  check('an entry saved as a template comes out with its ports, and + offers neither templates nor switches while they are set aside',
        r.template && r.templateOffered && r.templateMade, JSON.stringify([r.template, r.templateOffered, r.templateMade]));

  /* 4: the selection's frame, by the hand. */
  await page.evaluate(()=>{
    applyEdit(()=>{
      for(let i = 0; i < 3; i++) for(let j = 0; j < 2; j++)
        workingNodes.push(['fa' + i + j, 'F' + i + j, null, null, null, null, {pos: [80000 + i * 140, 80000 + j * 100]}]);
    });
    rebuildChart(); centreViewOn(80140, 80050, 1.3); deselect();
  });
  await page.waitForTimeout(150);
  const toS = (x, y)=> page.evaluate(([x, y])=>{ const b = svg.getBoundingClientRect(); return {x: b.left + x * vs + vx, y: b.top + y * vs + vy}; }, [x, y]);
  await page.click('#areaTool');
  let a = await toS(79980, 79980), b = await toS(80040, 80040);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, {steps: 4}); await page.mouse.up();
  const first = await page.evaluate(()=> [...multiSelection].sort().join(',') || selectedId);
  const e = await page.evaluate(()=>{ const g = document.querySelector('.sel-area-grip[data-area="e"]').getBoundingClientRect(); return {x: g.x + g.width / 2, y: g.y + g.height / 2}; });
  await page.mouse.move(e.x, e.y); await page.mouse.down(); await page.mouse.move(e.x + 300 * 1.3, e.y, {steps: 4}); await page.mouse.up();
  const wider = await page.evaluate(()=> [...multiSelection].sort().join(','));
  a = await toS(80150, 80200); b = await toS(80130, 79960);
  await page.keyboard.down('Alt');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, {steps: 4}); await page.mouse.up();
  await page.keyboard.up('Alt');
  const cut = await page.evaluate(()=> [...multiSelection].sort().join(','));
  await page.keyboard.press('Escape');
  const down = await page.evaluate(()=> !areaToolOn && !document.querySelector('.sel-area-frame'));
  check('the selection\'s frame stays, grows by its grips, and Alt takes away what it catches',
        first === 'fa00' && wider === 'fa00,fa10,fa20' && cut === 'fa00,fa20' && down,
        JSON.stringify([first, wider, cut, down]));
  });
  await scenario("the owner's list of 26.11: the last stretch along a carry grows, readings without a placeholder, a cut card's body, a card without its picture, a drawer of its own width, the frame's grips by a finger and its modes", async () => {
    const r = await page.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const out = {};
      const X = snapToGrid(64000), Y = snapToGrid(64000);
      /* 1: down, across, down into the other entry, carried down and to the
         left: the first drop stays as it is, the stretch across rides down
         and grows to the left, the drop into the other gets shorter. */
      const c = {bends: [[X, Y + 40], [X + 200, Y + 40]], from: {x: X, y: Y}, to: {x: X + 200, y: Y + 300}, reversed: false};
      const s1 = slideBends(c, -30, 50);
      out.lastGrows = s1[0][0] === X - 30 && s1[0][1] === Y + 90 && s1[1][0] === X + 200 && s1[1][1] === Y + 90;
      /* …and from the other end, the same chain read backwards. */
      const back = slideBends({bends: [[X + 200, Y + 40], [X, Y + 40]], from: {x: X + 200, y: Y + 300}, to: {x: X, y: Y}, reversed: true}, 0, 20);
      out.lastGrowsBack = back[0][1] === Y + 40 && back[1][1] === Y + 40;
      /* A carry along nothing that runs its way moves no corner. */
      const none = slideBends({bends: [[X, Y + 40]], from: {x: X, y: Y}, to: {x: X + 200, y: Y + 40}, reversed: false}, 0, 0);
      out.stillWhenStill = none[0][0] === X && none[0][1] === Y + 40;

      /* 4, 6: a cut card is met at its body on its upright sides, its tabs
         stand on the body, and taking its picture off leaves the body. */
      const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      applyEdit(()=>{
        workingNodes.push(['ck', 'Card', null, null, 'Body', null, {pos: [X, Y + 600], card: true, cardCut: true, image: IMG, size: [220, 260]}]);
        workingNodes.push(['cr', 'Right', 'ck', null, null, null, {pos: [X + 500, Y + 640]}]);
      });
      await wait(120);
      const ck = nodes.get('ck');
      const bodyTop = ck.y + ck.cardBodyRun[0].y * ck.h;
      const route = drawnRoutes.get('ck::cr');
      out.cutMeetsBody = !!route && route.pts[0].y > bodyTop && route.pts[0].y < ck.y + ck.h;
      out.tabsOnBody = Math.abs(tabBaseOf(ck).y + borderHalfOf(ck) - bodyTop) < 0.5;
      selectNode('ck');
      detailEditToggle.click();
      await wait(150);
      document.getElementById('editImageClear').click();
      await wait(500);
      closeEditForm();
      const bare = nodes.get('ck');
      out.picOffShrinks = !bare.image && bare.h < 80 && workingEntry('ck').entry[6].size[0] === 220;
      deselect();

      /* 3: a reading made over nothing is made over the word the caret is
         in, never over "word", and a second press inside or just after a
         reading puts the caret in it rather than making another. */
      selectNode(nodes.get('cr').id);
      document.getElementById('detailNoteEdit').click();
      await wait(120);
      const surf = richFields.get('detailNoteInput').surface;
      surf.focus();
      surf.innerHTML = '<div>hello world</div>';
      surf.dispatchEvent(new Event('input', {bubbles: true}));
      const put = (node, at)=>{ const q = document.createRange(); q.setStart(node, at); q.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(q); };
      put(surf.firstChild.firstChild, 3);
      applyRichCommand(surf, 'ruby');
      const ruby = surf.querySelector('ruby');
      const inRt = ()=>{ const a = getSelection().getRangeAt(0).startContainer; return !!(a.nodeType === 3 ? a.parentNode : a).closest('rt'); };
      out.rubyOverWord = !!ruby && ruby.firstChild.data === 'hello' && inRt() && !/word/.test(surf.textContent);
      document.execCommand('insertText', false, 'ab');
      const after = document.createRange(); after.setStartAfter(ruby); after.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(after);
      applyRichCommand(surf, 'ruby');
      out.rubyAgain = surf.querySelectorAll('ruby').length === 1 && inRt() && !/word/.test(surf.textContent) &&
                      ruby.querySelector('rt').textContent === 'ab';
      /* Where a browser will not keep the caret in a reading, a box does. */
      readingBoxWanted = true;
      const t2 = surf.firstChild.lastChild;
      const pick = document.createRange(); pick.setStart(t2, 1); pick.setEnd(t2, 6);
      getSelection().removeAllRanges(); getSelection().addRange(pick);
      applyRichCommand(surf, 'ruby');
      const box = document.querySelector('.reading-box');
      if(box){ box.value = 'mir'; box.dispatchEvent(new Event('input')); box.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'})); }
      readingBoxWanted = false;
      const rts = [...surf.querySelectorAll('rt')].map(t=> t.textContent);
      out.rubyBox = !!box && !document.querySelector('.reading-box') && rts.join() === 'ab,mir';
      document.getElementById('detailNoteEdit').click();
      deselect();
      return out;
    });
    check('carried, the last stretch running the way of the carry grows and the stub at the entry stays',
          r.lastGrows && r.lastGrowsBack && r.stillWhenStill, JSON.stringify([r.lastGrows, r.lastGrowsBack, r.stillWhenStill]));
    check('a cut card is met on its sides at its body, and its tabs stand on the body',
          r.cutMeetsBody && r.tabsOnBody, JSON.stringify([r.cutMeetsBody, r.tabsOnBody]));
    check('a card whose picture is taken off is its body, its width kept', r.picOffShrinks);
    check('a reading is put over the word at the caret, never over "word", and a second press goes into the reading',
          r.rubyOverWord && r.rubyAgain, JSON.stringify([r.rubyOverWord, r.rubyAgain]));
    check('where the caret cannot stay in a reading, the reading is typed in a box of its own', r.rubyBox);

    /* 2 and 5, on a phone: a drawer is not the whole width, a side of the
       frame is pulled by a finger, and the modes stand in for Shift. */
    const phone = await browser.newContext({viewport: {width: 390, height: 844},
      deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await phone.route('https://fonts.googleapis.com/**', noFonts);
    await phone.route('https://fonts.gstatic.com/**', noFonts);
    const pp = await phone.newPage();
    pp.on('pageerror', e => errors.push('phone: ' + e.message));
    try{
      await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil: 'networkidle'});
      await wait(900);
      const drawer = await pp.evaluate(async ()=>{
        const tab = document.querySelector('#tagsPanel .side-tab-handle');
        tab.click();
        await new Promise(ok=> setTimeout(ok, 400));
        const b = document.querySelector('#tagsPanel .side-tab-body').getBoundingClientRect();
        const h = document.querySelector('#tagsPanel').getBoundingClientRect();
        tab.click();
        return {w: b.width, narrow: b.width <= 253 && b.right < innerWidth - 20, ownHeight: Math.abs(b.height - h.height) < 2};
      });
      check('on a phone a drawer is as wide as on a wide screen, not the whole screen, and as tall as its tab',
            drawer.narrow && drawer.ownHeight, JSON.stringify(drawer));
      await pp.evaluate(()=>{
        applyEdit(()=>{ for(let i = 0; i < 3; i++) workingNodes.push(['pf' + i, 'P' + i, null, null, null, null, {pos: [70000 + i * 140, 70000]}]); });
        rebuildChart(); centreViewOn(70140, 70000, 0.6); deselect();
      });
      await wait(200);
      const cdp = await phone.newCDPSession(pp);
      const toS = (x, y)=> pp.evaluate(([x, y])=>{ const b = svg.getBoundingClientRect(); return {x: b.left + x * vs + vx, y: b.top + y * vs + vy}; }, [x, y]);
      const drag = async (a, b)=>{
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a.x, y: a.y}]});
        for(let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: a.x + (b.x - a.x) * k / 6, y: a.y + (b.y - a.y) * k / 6}]});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await wait(150);
      };
      const tool = await pp.evaluate(()=>{ const b = document.getElementById('areaTool').getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; });
      await pp.touchscreen.tap(tool.x, tool.y);
      await wait(150);
      const modes = await pp.evaluate(()=> !document.getElementById('areaModes').hidden);
      await drag(await toS(69980, 69980), await toS(70040, 70040));
      const first = await pp.evaluate(()=> [...multiSelection].sort().join(',') || selectedId);
      // The east side, a few pixels off its grip, as a finger lands.
      const e = await pp.evaluate(()=>{ const g = document.querySelector('.sel-area-grip[data-area="e"]').getBoundingClientRect(); return {x: g.x + g.width / 2 + 6, y: g.y + g.height / 2 + 5}; });
      await drag(e, {x: e.x + 110, y: e.y});
      const wider = await pp.evaluate(()=> [...multiSelection].sort().join(','));
      const addBtn = await pp.evaluate(()=>{ const b = document.querySelector('#areaModes [data-mode="add"]').getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; });
      await pp.touchscreen.tap(addBtn.x, addBtn.y);
      await wait(100);
      await drag(await toS(70260, 69980), await toS(70320, 70040));
      const added = await pp.evaluate(()=> [...multiSelection].sort().join(','));
      check('on a phone the frame\'s side is pulled by a finger, and Add stands in for Shift',
            modes && first === 'pf0' && wider === 'pf0,pf1' && added === 'pf0,pf1,pf2',
            JSON.stringify([modes, first, wider, added]));
    } finally {
      await phone.close();
    }
  });
