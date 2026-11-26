/* tests/scenarios/06-october-lists.js — scenarios 113 to 138 of the suite.
 *
 * The owner's dated lists of October: ends and marks, search in every
 * language, arrays, menus, curves, code 1 of 22.10, the chart as text and as
 * JSON, merges made of connectors, and the lists of 23.10 to 31.10.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */
  await scenario("ends, marks, squares and tabs as of 2026-10-20", async () => {
  const r20 = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const beforeRef = SETTINGS.refColor;
    const out = {};
    const line = (f, t)=> [...document.querySelectorAll('#edgeLayer path.edge.struct')]
      .find(p=> p.dataset.from === f && p.dataset.to === t);
    const distTo = (path, x, y)=>{ const L = path.getTotalLength(); let best = 1e9;
      for(let s = 0; s <= L; s += 0.5){ const q = path.getPointAtLength(s); best = Math.min(best, Math.hypot(q.x - x, q.y - y)); }
      return best; };

    /* A rippled curve ends under its arrowhead wherever its entries
       stand: the end used to fall on the last sample short of the head,
       up to a sixth of a wave before it, so a gap came and went as the
       route changed length. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['wvA','Source',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['wvB','Beast Wars: Uprising','wvA',null,null,null,{pos:[300,200]}]);
      EDGE_STYLES.push({from:'wvA', to:'wvB', routing:'curve', dash:'solid', arrow:true, sinusoid:true,
                        fromSide:'left', toSide:'top'});
    });
    await wait(200);
    const ends = [];
    for(let k = 0; k < 14; k++){
      applyEdit(()=>{ const it = workingNodes.find(x=> x[0] === 'wvB'); it[6] = Object.assign({}, it[6], {pos:[300 + k*7.3, 200 + k*3.1]}); });
      await wait(30);
      const pts = drawnRoutes.get(calloutEdgeKey('wvA','wvB')).pts, tip = pts[pts.length - 1];
      const p = line('wvA','wvB'), e = p.getPointAtLength(p.getTotalLength());
      ends.push(+Math.hypot(e.x - tip.x, e.y - tip.y).toFixed(2));
    }
    out.ends = ends;
    out.endsUnder = ends.every(d=> d >= ARROW_TRIM - 0.6 && d <= ARROW_LEN - 0.6);

    /* A curve's marks stand on the curve, not on the route it is drawn
       over; and a corner the line cannot pass through is drawn set aside
       rather than as a corner the line has failed to reach. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['cvA','Curve from',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['cvB','Curve to','cvA',null,null,null,{pos:[260,220]}]);
      EDGE_STYLES.push({from:'cvA', to:'cvB', routing:'curve', dash:'solid', arrow:true, bends:[[60, 140]]});
    });
    await wait(200);
    bendHoverTarget = null; showBendsFor('cvA','cvB');
    const cl = line('cvA','cvB');
    const marks = [...document.querySelectorAll('#bendLayer .bend-mark')].map(m=> distTo(cl, +m.getAttribute('cx'), +m.getAttribute('cy')));
    out.curveMarks = marks.map(d=> +d.toFixed(2));
    out.curveOnLine = marks.length >= 3 && marks.every(d=> d < 0.6);
    /* …and a WAVY curve's on its wave, read from the path rather than
       sampled with getPointAtLength: that call walks the path from its
       start each time, and on a rippled line the marks cost half a second
       on every hover and every redraw of a drag. */
    setEdgeStyleOverride('cvA','cvB', Object.assign({}, edgeStyleFor('cvA','cvB'), {sinusoid:true}));
    rebuildChart();
    await wait(200);
    const realAt = SVGGeometryElement.prototype.getPointAtLength;
    let walked = 0;
    SVGGeometryElement.prototype.getPointAtLength = function(){ walked++; return realAt.apply(this, arguments); };
    try{ bendHoverTarget = null; showBendsFor('cvA','cvB'); }
    finally{ SVGGeometryElement.prototype.getPointAtLength = realAt; }
    const wl = line('cvA','cvB');
    const wMarks = [...document.querySelectorAll('#bendLayer .bend-mark')].map(m=> distTo(wl, +m.getAttribute('cx'), +m.getAttribute('cy')));
    out.waveMarks = wMarks.map(d=> +d.toFixed(2));
    out.waveOnLine = wMarks.length >= 3 && wMarks.every(d=> d < 0.6);
    out.waveWalked = walked;
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['pkA','asdasd',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['pkB','other','pkA',null,null,null,{pos:[80,-5]}]);
    });
    await wait(200);
    const pa = nodes.get('pkA');
    const unreachable = Object.assign({}, edgeStyleFor('pkA','pkB'),
      {routing:'orthogonal', fromSide:'top', toSide:'top', bends:[[pa.x + pa.w/2 - 5, pa.y + pa.h + 45]]});
    // As a chart saved before such corners were dropped arrives with one.
    setEdgeStyleOverride('pkA','pkB', unreachable);
    rebuildChart();
    await wait(200);
    bendHoverTarget = null; showBendsFor('pkA','pkB');
    const pl = line('pkA','pkB');
    const solid = [...document.querySelectorAll('#bendLayer g:not(.bend-parked) > .bend-mark')]
      .map(m=> distTo(pl, +m.getAttribute('cx'), +m.getAttribute('cy')));
    out.parked = document.querySelectorAll('#bendLayer .bend-handle.bend-parked').length;
    out.solidOnLine = solid.every(d=> d < 0.6);
    bendHoverTarget = null; drawBendHandles();
    /* The next edit takes it out, in that edit's own step of undo; and an
       edit that puts one there itself keeps nothing of it. */
    // (The stack's length says nothing here: a long run fills it to its cap.)
    applyEdit(()=>{ const it = workingNodes.find(x=> x[0] === 'pkB'); it[1] = 'other one'; });
    await wait(100);
    out.droppedOnEdit = bendListOf('pkA','pkB').length === 0;
    undoLastEdit();
    await wait(100);
    // One undo puts back the name and the corner together: they were one step.
    out.undoBrings = bendListOf('pkA','pkB').length === 1 && nodes.get('pkB').label === 'other';
    applyEdit(()=> setEdgeStyleOverride('pkA','pkB', Object.assign({}, unreachable, {bends:[[pa.x + pa.w/2 + 3, pa.y + pa.h + 45]]})));
    await wait(100);
    out.neverKept = bendListOf('pkA','pkB').length === 0;

    /* The connector's panel carries no guide and no Delete; the Delete
       key still deletes the connector it is open on. */
    openEdgeStylePopover('pkA','pkB', {clientX:500, clientY:400, stopPropagation(){}});
    await wait(150);
    const pop = document.getElementById('edgePopover');
    out.panelLean = !document.getElementById('styleDelete') && !/Drag the marks/.test(pop.textContent);
    /* An empty colour shows the colour the line takes anyway, with the
       dashed edge a default colour wears in the Tags drawer. */
    const mode = document.getElementById('styleFill');
    mode.value = 'custom'; mode.dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('styleColor').value = '';
    document.getElementById('styleColor').dispatchEvent(new Event('input', {bubbles:true}));
    await wait(50);
    const sq = document.getElementById('styleColor').previousElementSibling;
    out.inheritedDashed = sq.classList.contains('hex-square') && sq.classList.contains('inherited') &&
                          getComputedStyle(sq).outlineStyle === 'dashed';
    deletePicked();
    await wait(150);
    out.keyDeletes = !structEdges.some(e=> e.from === 'pkA' && e.to === 'pkB') && nodes.has('pkA') && nodes.has('pkB');
    closeEdgePopover();

    // The references' colour, at the program's own, is dashed too.
    applyEdit(()=>{ delete SETTINGS.refColor; });
    buildSideTabs();
    await wait(50);
    const rb = document.getElementById('refColorInput');
    paintHexSquare(rb);
    out.refDashed = rb.previousElementSibling.classList.contains('inherited');

    /* A reset stands against the square it resets: in a text toolbar,
       and after the squares of an entry's colour list rather than at the
       far end of the field. */
    openEntrySettings('pkA');
    await wait(300);
    const strip = document.getElementById('editColorsSwatches'), rs = document.getElementById('editColorsReset');
    const lastSq = [...strip.children].pop();
    out.listGap = lastSq && rs ? +(rs.getBoundingClientRect().left - lastSq.getBoundingClientRect().right).toFixed(1) : null;
    const tb = document.querySelector('.mini-toolbar [data-hex-reset="nodeEditorText"]');
    const tsq = document.querySelector('.mini-toolbar [data-hex-square-for="nodeEditorText"]');
    tb.closest('.mini-toolbar').style.display = 'flex';
    out.tbGap = +(tb.getBoundingClientRect().left - tsq.getBoundingClientRect().right).toFixed(1);
    /* Every square showing a colour nobody chose here wears the dashed
       edge: the border list of an entry coloured by its tags, and the ink
       of words nobody coloured. */
    const chips = [...strip.querySelectorAll('.swatch-chip:not(.swatch-blank)')];
    /* At the default ink — whatever an earlier scenario left the toolbar
       holding — and away from it again. */
    const tbox = document.querySelector('.mini-toolbar [data-hex-for="nodeEditorText"]');
    let customDashed = null;
    if(tbox){
      tbox.value = '#ff8800'; tbox.dispatchEvent(new Event('input', {bubbles:true}));
      customDashed = tsq.classList.contains('inherited');
      tbox.value = DEFAULT_TEXT_COLOR; tbox.dispatchEvent(new Event('input', {bubbles:true}));
    }
    const tboxV = tbox && tbox.value;
    out.allDashedAt = JSON.stringify({chips: chips.map(c=> c.className), tbox: tboxV, tsq: tsq.className,
                                      outline: chips[0] && getComputedStyle(chips[0]).outlineStyle});
    out.allDashed = chips.length > 0 && chips.every(c=> c.classList.contains('inherited')) &&
                    getComputedStyle(chips[0]).outlineStyle === 'dashed' &&
                    (tboxV || '').toLowerCase() === DEFAULT_TEXT_COLOR.toLowerCase() && tsq.classList.contains('inherited') &&
                    customDashed === false;
    tb.closest('.mini-toolbar').style.display = '';

    /* A card whose note is only a figure has no band for it: a figure is
       not drawn on the chart, and the band stood empty. With words, it has. */
    applyEdit(()=>{
      workingNodes.push(['cdFig','Figure only',null,null,'{{m:nothing_here}}',null,{pos:[1400, 0], card:true}]);
      workingNodes.push(['cdTxt','With words',null,null,'some words',null,{pos:[1600, 0], card:true}]);
    });
    await wait(150);
    const bandsOf = (id)=> document.querySelectorAll(`.node[data-id="${id}"] .card-body, .node[data-id="${id}"] .card-rule`).length;
    out.figCardAt = JSON.stringify({fig: bandsOf('cdFig'), txt: bandsOf('cdTxt')});
    out.figCard = bandsOf('cdFig') === 0 && bandsOf('cdTxt') > 0;

    /* The turning handle stands close to the corner it turns, and its
       reach stops where the corner grip's begins. */
    applyEdit(()=> workingNodes.push(['rtCap','A caption',null,null,null,'textbox',{pos:[1800, 0]}]));
    await wait(150);
    {
      const cap = nodes.get('rtCap');
      nodeControlsOn('rtCap');
      const g = document.querySelector('.node[data-id="rtCap"]');
      const hit = g && g.querySelector('.node-rotate .node-rotate-hit');
      const grip = g && g.querySelector('.node-resize-hit');
      const m = hit && hit.getCTM(), gm = g && g.getCTM();
      const toChart = (pt)=>{ const p = svg.createSVGPoint(); p.x = pt.x; p.y = pt.y;
        return p.matrixTransform(gm.inverse().multiply(m)); };
      const c = hit ? toChart({x: +hit.getAttribute('cx'), y: +hit.getAttribute('cy')}) : null;
      const off = c ? Math.hypot(c.x - cap.x, c.y - cap.y) : null;
      const gap = c && grip ? off - +hit.getAttribute('r') - +grip.getAttribute('r') : null;
      out.rotCloseAt = JSON.stringify({off: off && +off.toFixed(2), gap: gap && +gap.toFixed(2)});
      out.rotClose = off !== null && off < 10 && gap !== null && gap >= -0.01;
    }

    /* A link to an entry of this chart goes to it on this page, from its
       own address, a bare fragment or the published site's; a link to
       anywhere else is still a link. */
    deselect();
    applyEdit(()=>{
      workingNodes.push(['lkFrom','Points at the other',null,null,null,null,{pos:[2000, 0], link:'#entry=lkTo'}]);
      workingNodes.push(['lkTo','The other',null,null,null,null,{pos:[2400, 300]}]);
    });
    await wait(150);
    {
      const badge = document.querySelector('.node[data-id="lkFrom"] .node-link');
      let opened = false;
      const a = badge && badge.closest('a');
      const stop = ev=>{ opened = !ev.defaultPrevented; ev.preventDefault(); };
      // Listened for on the link itself, after its own handler: that one stops the click going further.
      if(a){ a.addEventListener('click', stop); a.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); a.removeEventListener('click', stop); }
      await wait(100);
      out.linkGoAt = JSON.stringify({badge: !!badge, selected: selectedId, opened,
        site: !!entryLinkTarget(SITE_BASE + '/#entry=lkTo&tab=2'),
        elsewhere: !!entryLinkTarget('https://example.com/#entry=lkTo'),
        missing: !!entryLinkTarget('#entry=no-such-entry')});
      out.linkGo = !!badge && selectedId === 'lkTo' && !opened &&
                   !!entryLinkTarget(SITE_BASE + '/#entry=lkTo&tab=2') &&
                   !entryLinkTarget('https://example.com/#entry=lkTo') && !entryLinkTarget('#entry=no-such-entry');
      deselect();
    }

    /* Languages switched on with every tab taken away go off as the
       settings are left. */
    applyEdit(()=> workingNodes.push(['mlA','Tabs',null,null,null,null,{pos:[2800, 0], multiLang:true,
                                                                       langTabs:[{tag:'EN', text:'Tabs'}]}]));
    await wait(150);
    openEntrySettings('mlA');
    await wait(200);
    {
      const chip = document.querySelector('#editLangTabList .lang-tab-chip');
      if(chip) chip.querySelector('button').click();
      await wait(50);
      const stillOn = document.getElementById('editMultiLangCheck').checked;
      closeEditForm();
      await wait(150);
      const f = workingEntry('mlA');
      const o = f ? entryOpts(f.entry) : {};
      out.langsOffAt = JSON.stringify({chip: !!chip, stillOn, multiLang: o.multiLang, tabs: o.langTabs,
                                       live: nodes.get('mlA') && nodes.get('mlA').multiLang,
                                       check: document.getElementById('editMultiLangCheck').checked});
      out.langsOff = !!chip && stillOn && !o.multiLang && !o.langTabs && !nodes.get('mlA').multiLang &&
                     !document.getElementById('editMultiLangCheck').checked;
      deselect();
    }

    /* Where words are typed, the text cursor is the page's own drawn one,
       not the system's inverting beam that Chromium on Windows can draw
       white. */
    {
      const surf = document.querySelector('.node-editor .rich-surface');
      const cs = (q)=> q ? getComputedStyle(q).cursor : '';
      const inner = surf && document.createElement('span');
      if(inner) surf.appendChild(inner);
      out.ibeamAt = JSON.stringify({surface: cs(surf).slice(0, 40), inner: cs(inner).slice(0, 40),
                                    search: cs(searchInput).slice(0, 40)});
      const words = document.querySelector('.legend-item .name') || document.querySelector('h1, h2, .detail-title');
      out.ibeam = [surf, inner, searchInput].every(q=> /url\(.*svg/.test(cs(q)) && /text$/.test(cs(q))) &&
                  getComputedStyle(document.body).cursor === 'default' && (!words || cs(words) !== 'auto');
      if(inner) inner.remove();
    }

    /* A tab named by a country's code wears its flag: two letters or
       three, any case; a language's code that is no country stays words. */
    out.codes = [flagForCode('de'), flagForCode('DEU'), flagForCode('UK'), flagForCode('EN'), flagForCode('ENG'), flagForCode('Rus')];
    out.codesOk = out.codes[0] === '🇩🇪' && out.codes[1] === out.codes[0] &&
                  out.codes[2] === '🇬🇧' && out.codes[3] === null && out.codes[4] === null &&
                  out.codes[5] === '🇷🇺';
    applyEdit(()=>{ const it = workingNodes.find(x=> x[0] === 'pkB');
      it[6] = Object.assign({}, it[6], {multiLang:true, langTabs:[{tag:'RUS', text:'Другой'}, {tag:'EN', text:'Other'}]}); });
    await wait(150);
    out.chips = [...document.querySelectorAll('.node[data-id="pkB"] .lang-chip-label')].map(t=> t.textContent);
    out.chipFlag = out.chips[1] === '🇷🇺' && out.chips[2] === 'EN';
    const host = document.createElement('div');
    makeLangTabRow(host, {tag:'', text:''});
    const nm = host.querySelector('.lang-tab-name');
    nm.value = 'jpn'; nm.dispatchEvent(new Event('change'));
    out.formFlag = nm.value === '🇯🇵';

    deselect();
    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x));
                    if(beforeRef === undefined) delete SETTINGS.refColor; else SETTINGS.refColor = beforeRef; });
    await wait(200);
    return out;
  });
  check('a rippled curve ends under its arrowhead wherever its entries stand', r20.endsUnder, JSON.stringify(r20.ends));
  check('a curve\'s marks stand on the curve', r20.curveOnLine, JSON.stringify(r20.curveMarks));
  check('a wavy curve\'s marks stand on its wave', r20.waveOnLine, JSON.stringify(r20.waveMarks));
  eq('…found without walking the path point by point', r20.waveWalked, 0);
  check('a corner the line cannot pass through is drawn set aside, and every other mark is on the line',
        r20.parked === 1 && r20.solidOnLine, JSON.stringify({parked: r20.parked, on: r20.solidOnLine}));
  check('and is taken out by the next edit, in its step of undo, or never kept at all',
        r20.droppedOnEdit && r20.undoBrings && r20.neverKept,
        JSON.stringify({drop: r20.droppedOnEdit, undo: r20.undoBrings, never: r20.neverKept}));
  check('a connector\'s panel has no guide and no Delete, and the Delete key still deletes it',
        r20.panelLean && r20.keyDeletes, JSON.stringify({lean: r20.panelLean, del: r20.keyDeletes}));
  check('a square showing a default colour wears the dashed edge, as in the Tags drawer',
        r20.inheritedDashed && r20.refDashed, JSON.stringify({edge: r20.inheritedDashed, ref: r20.refDashed}));
  check('a reset stands against its square, not across the field from it',
        r20.listGap !== null && r20.listGap <= 8 && r20.tbGap <= 5, JSON.stringify({list: r20.listGap, tb: r20.tbGap}));
  check('a colour handed down wears the dashed edge in an entry\'s border list and on the words\' ink too',
        r20.allDashed, r20.allDashedAt);
  check('a card whose note is only a figure draws no empty band for it',
        r20.figCard, r20.figCardAt);
  check('a caption\'s turning handle stands close to its corner without taking the corner grip\'s reach',
        r20.rotClose, r20.rotCloseAt);
  check('a link to an entry of this chart goes to it instead of opening a page',
        r20.linkGo, r20.linkGoAt);
  check('languages with every tab taken away are switched off when the settings are left',
        r20.langsOff, r20.langsOffAt);
  check('the text cursor is the page\'s own, black with a white edge, and only where words are typed',
        r20.ibeam, r20.ibeamAt);
  check('a language tab named by a country\'s code wears its flag, and a language\'s stays words',
        r20.codesOk && r20.chipFlag && r20.formFlag, JSON.stringify({codes: r20.codes, chips: r20.chips, form: r20.formFlag}));
  });
  await scenario("search in every language, a link to an entry, a picture and an overview", async () => {
  /* An entry whose second text only exists on a language tab, and whose
     link names a site: everything below is asked of it. */
  const r = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    applyEdit(()=>{
      workingNodes.push(['lq_one', 'Langprobe main', null, null, null, null,
        {pos:[400, -600], tags:['probe-tag'], multiLang:true, langTabs:[{tag:'JP', text:'Zzkanaprobe title'}], link:'https://example.org/page'}]);
      workingNodes.push(['lq two', 'Langprobe other', null, null, null, null, {pos:[700, -600], link:'#entry=lq_one'}]);
      workingNodes.push(['lq three', 'Langprobe gone', null, null, null, null,
        {pos:[1000, -600], link: SITE_BASE + '/#entry=nobody-by-that-name'}]);
    });
    await pause(400);
    // Search finds the tab's text, says which tab and carries the tags.
    const box = document.getElementById('searchInput');
    box.value = 'zzkanaprobe';
    box.dispatchEvent(new Event('input'));
    const row = document.querySelector('#searchResults .row');
    out.rows = document.querySelectorAll('#searchResults .row').length;
    out.chip = row && row.querySelector('.sr-tab') && row.querySelector('.sr-tab').textContent;
    out.tags = row && row.querySelector('.cl').textContent;
    // …drawn as tag labels, as the entry's card and the tags drawer draw them.
    out.tagShapes = row ? [...row.querySelectorAll('.cl .tag-shape .tag-text')].map(x=> x.textContent) : [];
    if(row) row.click();
    await pause(100);
    out.opened = selectedId;
    out.tab = activeLangTab.get('lq_one');
    out.drawn = (document.querySelector('[data-id="lq_one"] text') || {}).textContent || '';
    // The main text is found too, as the main one.
    box.value = 'langprobe main';
    box.dispatchEvent(new Event('input'));
    const main = document.querySelector('#searchResults .row .sr-tab');
    out.mainChip = main && main.classList.contains('sr-main');
    document.getElementById('searchResults').classList.remove('show');
    // A link carries the entry and the tab it shows, and opens on both.
    out.link = entryLink('lq_one');
    activeLangTab.set('lq_one', null);
    deselect();
    location.hash = out.link.split('#')[1];
    await pause(150);
    out.fromLink = selectedId;
    out.fromLinkTab = activeLangTab.get('lq_one');
    location.hash = 'entry=' + encodeURIComponent('lq two');
    await pause(150);
    out.spaced = selectedId;
    location.hash = 'entry=nobody-by-that-name';
    await pause(150);
    out.unknownKeeps = selectedId;
    window.history.replaceState(null, '', location.href.split('#')[0]);
    deselect();
    // The link's tab wears the site's icon instead of the arrow.
    await pause(300);
    out.icon = !!document.querySelector('[data-id="lq_one"] .node-link.has-icon image.node-link-icon');
    // A link to another entry of the chart keeps the arrow, and asks for no icon.
    out.innerArrow = ['lq two', 'lq three'].map(id=>{
      const g = document.querySelector(`[data-id="${CSS.escape(id)}"] .node-link`);
      return !!g && !g.querySelector('image') && !g.classList.contains('has-icon') && !!g.querySelector('.node-link-arrow');
    });
    // The picture: well-formed, framed on the drawing, nothing to press.
    const pic = await chartPictureText();
    const doc = new DOMParser().parseFromString(pic.text, 'image/svg+xml');
    out.wellFormed = !doc.querySelector('parsererror');
    out.hasProbe = pic.text.includes('Zzkanaprobe') || pic.text.includes('Langprobe main');
    out.noHandles = !doc.querySelector('.node-handles, #bendLayer, #lodLayer');
    out.noViewMove = !(doc.querySelector('#viewport') || {getAttribute(){return null;}}).getAttribute('transform') &&
      !/translate|matrix/.test(((doc.querySelector('#viewport') || {}).getAttribute || (()=>''))
        .call(doc.querySelector('#viewport') || {getAttribute(){return '';}}, 'style') || '');
    out.noRemote = !Array.from(doc.querySelectorAll('image')).some(im=> !/^data:/.test(
      im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''));
    const b = pic.bounds;
    const lq = nodes.get('lq_one');
    out.framed = b.x <= lq.x && b.y <= lq.y && b.x + b.w >= lq.x + lq.w && b.y + b.h >= lq.y + lq.h;
    out.liveIconKept = !!document.querySelector('[data-id="lq_one"] .node-link.has-icon');
    const png = await chartPicturePng();
    out.png = png.type + ':' + (png.size > 1000);
    // The overview: shut until asked, drawn when open, and a press moves the view.
    setMinimap(false);
    out.shut = !minimapOpen();
    setMinimap(true);
    await pause(100);
    const cv = document.getElementById('minimapCanvas');
    const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0; for(let i = 3; i < px.length; i += 4) if(px[i]) ink++;
    out.inked = ink > 50;
    const before = viewCentre();
    const rc = cv.getBoundingClientRect();
    const fit = minimapFit;
    const tx = lq.x + lq.w/2, ty = lq.y + lq.h/2;
    const cx = rc.left + tx*fit.k + fit.ox, cy = rc.top + ty*fit.k + fit.oy;
    cv.dispatchEvent(new PointerEvent('pointerdown', {clientX: cx, clientY: cy, pointerId: 1, bubbles: true}));
    cv.dispatchEvent(new PointerEvent('pointerup', {clientX: cx, clientY: cy, pointerId: 1, bubbles: true}));
    const after = viewCentre();
    out.moved = Math.hypot(after.x - tx, after.y - ty) < 3 / fit.k + 2 && Math.hypot(before.x - tx, before.y - ty) > 5;
    out.remembered = localStorage.getItem('rhizome.minimap');
    setMinimap(false);
    applyEdit(()=>{
      for(let i = workingNodes.length - 1; i >= 0; i--) if(/^lq/.test(workingNodes[i][0])) workingNodes.splice(i, 1);
    });
    centreViewOn(before.x, before.y, vs);
    return out;
  });
  check('search finds a text that is only on a language tab', r.rows === 1, JSON.stringify(r));
  // By the mark the tab wears on the entry: JP is Japan's code, so its flag.
  eq('a hit names the tab it was found on', r.chip, '\uD83C\uDDEF\uD83C\uDDF5');
  check('a hit carries the entry’s tags', /probe-tag/.test(r.tags || ''), r.tags);
  eq('…drawn as tag labels', JSON.stringify(r.tagShapes), JSON.stringify(['probe-tag']));
  check('picking it opens the entry on that tab', r.opened === 'lq_one' && r.tab === 0 && /Zzkanaprobe/.test(r.drawn), JSON.stringify(r));
  check('the main text is found as the main one', r.mainChip === true);
  check('a link names the entry and its tab', /#entry=lq_one&tab=1$/.test(r.link), r.link);
  check('a link opens the entry on its tab', r.fromLink === 'lq_one' && r.fromLinkTab === 0, JSON.stringify(r));
  check('an id with a space survives the link', r.spaced === 'lq two', r.spaced);
  check('a link to nothing changes nothing', r.unknownKeeps === 'lq two', r.unknownKeeps);
  check('a link wears its site’s icon once it has come', r.icon);
  check('a link to another entry of the chart keeps the arrow, even when its entry is gone',
        r.innerArrow.every(Boolean), JSON.stringify(r.innerArrow));
  check('the picture is well-formed XML', r.wellFormed);
  check('the picture holds the chart and nothing to press', r.hasProbe && r.noHandles && r.noRemote, JSON.stringify(r));
  check('the picture is framed on the drawing, not the window', r.framed && r.noViewMove, JSON.stringify(r));
  check('making the picture leaves the live icon alone', r.liveIconKept);
  eq('a PNG comes out', r.png, 'image/png:true');
  check('the overview opens, draws the chart and moves the view', r.shut && r.inked && r.moved, JSON.stringify(r));
  eq('the overview remembers being open', r.remembered, '1');
  });
  await scenario("arrays and a T at a connector's end", async () => {
  /* A T at the end of a connector: a bar across the line, standing off
     the entry rather than touching it, set and taken off from the bar. */
  const t = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    applyEdit(()=>{
      workingNodes.push(['tz_a', 'Tee source', null, null, null, null, {pos:[400, -900]}]);
      workingNodes.push(['tz_b', 'Tee target', 'tz_a', null, null, null, {pos:[400, -760]}]);
      EDGE_STYLES.push({from:'tz_a', to:'tz_b', routing:'orthogonal', dash:'solid', arrow:true, teeOut:true});
    });
    await pause(200);
    const tee = document.querySelector('.edge-tee[data-from="tz_a"][data-to="tz_b"]');
    out.tee = !!tee;
    out.arrowheads = document.querySelectorAll('.edge-arrow[data-from="tz_a"][data-to="tz_b"]:not(.edge-tee)').length;
    const b = nodes.get('tz_b');
    if(tee){
      const bb = tee.getBBox();
      // The edge comes down into the top of the target.
      out.gap = round2(b.y - borderHalfOf(b) - (bb.y + bb.height));
      out.across = round2(bb.width);
      const line = document.querySelector('.edge[data-from="tz_a"][data-to="tz_b"]');
      const len = line.getTotalLength(), end = line.getPointAtLength(len);
      out.lineToBar = round2(Math.abs(end.y - bb.y));
    }
    out.legend = keyMarksInUse().some(m=> m.key === 'line:tee');
    // From the bar: nothing at the end, an arrow, the T again, and a T at the start.
    styleBarTarget = {kind:'edge', from:'tz_a', to:'tz_b', x:10, y:10};
    applyStyleBar('endOut', 'none');
    out.offAll = edgeStyleFor('tz_a', 'tz_b');
    applyStyleBar('endOut', 'out');
    out.arrow = edgeStyleFor('tz_a', 'tz_b');
    applyStyleBar('endOut', 'tout');
    out.back = edgeStyleFor('tz_a', 'tz_b');
    applyStyleBar('endIn', 'tin');
    out.both = edgeStyleFor('tz_a', 'tz_b');
    closeStyleBar();
    await pause(100);
    out.teeIn = !!document.querySelectorAll('.edge-tee[data-from="tz_a"][data-to="tz_b"]').length;
    applyEdit(()=>{
      for(let i = workingNodes.length - 1; i >= 0; i--) if(/^tz_/.test(workingNodes[i][0])) workingNodes.splice(i, 1);
      for(let k = EDGE_STYLES.length - 1; k >= 0; k--) if(/^tz_/.test(EDGE_STYLES[k].from)) EDGE_STYLES.splice(k, 1);
    });
    return out;
  });
  check('a connector can end in a T instead of an arrow', t.tee && t.arrowheads === 0, JSON.stringify(t));
  check('the T stands TEE_GAP (2.5 px) off the outer edge of the entry’s border', Math.abs(t.gap - 2.5) < 0.1, JSON.stringify(t));
  check('the T lies across the line', t.across >= 8, JSON.stringify(t));
  check('the line stops at the T', t.lineToBar <= 1.5, JSON.stringify(t));
  check('the legend names the T', t.legend);
  check('choosing nothing for the end takes the T off', t.offAll.arrow === false && !t.offAll.teeOut, JSON.stringify(t.offAll));
  check('the arrow and the T take each other’s place', t.arrow.arrow !== false && !t.arrow.teeOut &&
        t.back.arrow !== false && t.back.teeOut, JSON.stringify([t.arrow, t.back]));
  check('the start can take a T as well', t.both.arrowIn && t.both.teeIn && t.teeIn, JSON.stringify(t.both));

  /* Arrays: a frame round several entries, worked out from where they
     stand, carried with them and carrying them, with its own look. */
  const pause = ms => wait(ms);
  await page.evaluate(()=>{
    /* The chart may hold arrays of its own (the owner's does); these
       checks are about the ones made here. */
    window.suiteArraysBefore = new Set(workingNodes.filter(e=> e[5] === 'array').map(e=> e[0]));
    applyEdit(()=>{
      workingNodes.push(['az_a', 'Array one', null, null, null, null, {pos:[400, -1400]}]);
      workingNodes.push(['az_b', 'Array two', 'az_a', null, null, null, {pos:[400, -1280], colors:['#2f6fb5', '#c23b22']}]);
      workingNodes.push(['az_c', 'Array three', null, null, null, null, {pos:[640, -1340]}]);
    });
    setSelection(['az_a'], 'az_a');
    makeArrayOfSelection();
  });
  const one = await page.evaluate(()=> workingNodes.filter(e=> e[5] === 'array' && !suiteArraysBefore.has(e[0])).length);
  eq('one entry picked makes no array', one, 0);
  const a = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    setSelection(['az_a', 'az_b'], 'az_a');
    out.id = makeArrayOfSelection();
    await pause(100);
    const e = workingNodes.find(x=> x[0] === out.id);
    out.saved = e && JSON.stringify(e[6]);
    out.selected = selectedId === out.id;
    out.drawer = document.getElementById('detail').classList.contains('open');
    const arr = nodes.get(out.id), m1 = nodes.get('az_a'), m2 = nodes.get('az_b');
    /* Two pixels from the outer edge of the members' outermost borders
       to the inner edge of the array's own, on every side. */
    const inner = borderHalfOf(arr), r1 = outerReachOf(m1), r2 = outerReachOf(m2);
    out.margins = [
      Math.min(m1.x - r1.side, m2.x - r2.side) - (arr.x + inner),
      Math.min(m1.y - r1.top, m2.y - r2.top) - (arr.y + inner),
      (arr.x + arr.w - inner) - Math.max(m1.x + m1.w + r1.side, m2.x + m2.w + r2.side),
      (arr.y + arr.h - inner) - Math.max(m1.y + m1.h + r1.side, m2.y + m2.h + r2.side),
    ].map(v=> round2(v));
    out.holds = out.margins.every(v=> Math.abs(v - TEE_GAP) < 0.05);
    // A member's tab stands inside the frame too, two pixels short of it.
    applyEdit(()=>{ const it = workingNodes.find(x=> x[0] === 'az_a'); it[6] = Object.assign({}, it[6], {link:'https://example.com/'}); });
    await pause(100);
    const tab = document.querySelector('.node[data-id="az_a"] .node-link-bg');
    const fr = nodes.get(out.id);
    out.tabGap = tab ? round2(tab.getBBox().y + tab.parentNode.transform.baseVal.consolidate().matrix.f - (fr.y + borderHalfOf(fr)) - parseFloat(getComputedStyle(tab).strokeWidth) / 2) : null;
    applyEdit(()=>{ const it = workingNodes.find(x=> x[0] === 'az_a'); const o = Object.assign({}, it[6]); delete o.link; it[6] = o; });
    await pause(100);
    const kids = [...viewport.children];
    out.behind = kids.indexOf(arrayLayer) < kids.indexOf(edgeLayer) && kids.indexOf(arrayLayer) > kids.indexOf(backLayer);
    out.inLayer = !!arrayLayer.querySelector(`.node[data-id="${out.id}"]`);
    out.obstacle = buildObstacleRects().some(r=> r.id === out.id);
    /* Its middle is the array's: a press on the paper inside it takes
       hold of the frame (the owner's ask, 22.10), and a press on a member
       still reaches the member. On screen first: elementFromPoint finds
       nothing off it. */
    flyToNode(out.id); await pause(100);
    const sr = svg.getBoundingClientRect();
    const at = (wx, wy)=> document.elementFromPoint(sr.left + wx * vs + vx, sr.top + wy * vs + vy);
    // Open paper inside it: between the two members, clear of their line.
    const hit = at(Math.min(m1.x, m2.x) + 6, (m1.y + m1.h + m2.y) / 2);
    out.middleHeld = !!(hit && hit.classList.contains('array-hit') && hit.closest(`.node[data-id="${out.id}"]`));
    const onMember = at(m1.x + m1.w / 2, m1.y + m1.h / 2);
    out.memberFirst = !!(onMember && onMember.closest && onMember.closest('.node[data-id="az_a"], .node[data-id="az_b"]'));
    out.tab = !!arrayLayer.querySelector(`.node[data-id="${out.id}"] .array-tab`);
    /* Its look: black, half see-through, and nothing behind it — a ground
       written into the entry by hand included. */
    {
      const ring = arrayLayer.querySelector(`.node[data-id="${out.id}"] > rect:not(.array-hit):not(.node-hover-pad)`);
      const cs = ring && getComputedStyle(ring);
      out.look = cs ? {stroke: ring.getAttribute('stroke'), fill: cs.fill, opacity: cs.strokeOpacity} : null;
    }
    out.handles = arrayLayer.querySelectorAll(`.node[data-id="${out.id}"] .node-handle`).length;
    out.grips = arrayLayer.querySelectorAll(`.node[data-id="${out.id}"] .node-resize`).length;
    // Its look, from the bar.
    styleBarTarget = {kind:'node', id: out.id};
    syncStyleBar();
    out.rows = [...styleBar.querySelectorAll('.style-bar-group')].filter(r=> !r.hidden).map(r=> r.dataset.group);
    /* The border and the hatching are menus: one face each, showing the
       choice, and the list unfolding under it on a press. */
    { const row = styleBar.querySelector('[data-group="hatch"]');
      const face = row.querySelector('.style-bar-drop-face');
      const list = row.querySelector('.style-bar-drop-list');
      const shut = !list.getBoundingClientRect().height;
      face.click();
      const fr = face.getBoundingClientRect(), lr = list.getBoundingClientRect();
      const opened = lr.height > 0 && lr.top >= fr.bottom;
      list.querySelector('[data-value="vert"]').click();
      await pause(100);
      out.menu = {shut, opened, closed: !styleBar.querySelector('.style-bar-drop.open'),
                  hatch: nodes.get(out.id).hatch, face: styleBar.querySelector('[data-group="hatch"] .style-bar-drop-face').textContent,
                  faces: styleBar.querySelectorAll('.style-bar-group:not([hidden]) > .style-bar-drop-face').length}; }
    applyStyleBar('hatch', 'diag-l');
    applyStyleBar('border', 'dashed');
    await pause(100);
    const g = arrayLayer.querySelector(`.node[data-id="${out.id}"]`);
    const hatch = g && g.querySelector('.array-hatch');
    const pat = hatch && document.getElementById((hatch.style.fill.match(/#([^"')]+)/) || [])[1]);
    out.hatch = !!pat && /rotate\(-45\)/.test(pat.getAttribute('patternTransform') || '');
    // The hatching is in the frame's colour, half see-through as the frame is.
    const line = pat && pat.querySelector('path');
    out.hatchInk = line ? [line.getAttribute('stroke'), line.getAttribute('stroke-opacity')].join(' ') : '';
    out.dashed = !!(g && g.querySelector('rect[stroke-dasharray]'));
    out.savedLook = JSON.stringify(workingNodes.find(x=> x[0] === out.id)[6]);
    closeStyleBar();
    out.legend = keyMarksInUse().some(m=> m.key === 'shape:array');
    deselect();
    return out;
  });
  check('two entries picked make an array of them', !!a.id && /"members":\["az_a","az_b"\]/.test(a.saved || ''), JSON.stringify(a));
  check('the new array is picked, with no drawer', a.selected && !a.drawer, JSON.stringify(a));
  check('the array holds its members as far off their outer borders as a T-end stands (23.10)', a.holds, JSON.stringify(a.margins));
  check('…and their tabs as far off its frame', a.tabGap !== null && Math.abs(a.tabGap - 2.5) < 0.3, String(a.tabGap));
  check('arrays are drawn over a backdrop and under the connectors', a.behind && a.inLayer, JSON.stringify(a));
  check('the router does not go round an array', !a.obstacle);
  check('an array is taken hold of anywhere inside it, and a member inside still answers for itself',
        a.middleHeld && a.memberFirst, JSON.stringify({middleHeld: a.middleHeld, memberFirst: a.memberFirst}));
  check('an array has ports, no size grips and no tab', !a.tab && a.handles === 4 && a.grips === 0, JSON.stringify(a));
  check('an array is black, half see-through and hollow', !!a.look && a.look.stroke === '#000000' &&
        a.look.fill === 'none' && +a.look.opacity === 0.5, JSON.stringify(a.look));
  check('the bar offers an array its border, hatching and colour, and no ground',
        ['border', 'hatch', 'arrayInk'].every(r=> a.rows.includes(r)) && !a.rows.includes('turn') && !a.rows.includes('cardBg'), a.rows.join(','));
  check('on its bar the border and the hatching are menus that unfold, set and fold again',
        a.menu.shut && a.menu.opened && a.menu.closed && a.menu.hatch === 'vert' && a.menu.face === '▥' && a.menu.faces === 2,
        JSON.stringify(a.menu));
  eq('the hatching is the frame’s colour, half see-through', a.hatchInk, '#000000 0.5');
  check('a hatching and a border style are drawn and written down',
        a.hatch && a.dashed && /"hatch":"diag-l"/.test(a.savedLook) && /"border":"dashed"/.test(a.savedLook), JSON.stringify(a));
  check('the legend names an array', a.legend);
  // An array saved while its colour was its ground's keeps that colour, now on its frame.
  const old = await page.evaluate(async ()=>{
    applyEdit(()=> workingNodes.push(['az_old', '', null, null, null, 'array', {members:['az_a', 'az_c'], bg:['#cc22cc']}]));
    await new Promise(ok => setTimeout(ok, 100));
    const ring = arrayLayer.querySelector('.node[data-id="az_old"] > rect:not(.array-hit):not(.node-hover-pad)');
    const got = ring ? [ring.getAttribute('stroke') || ring.style.stroke, getComputedStyle(ring).fill].join(' ') : '';
    applyEdit(()=>{ const k = workingNodes.findIndex(x=> x[0] === 'az_old'); if(k >= 0) workingNodes.splice(k, 1); });
    return got;
  });
  check('an array that kept its colour as a ground wears it as its frame', /^(#cc22cc|rgb\(204, 34, 204\)) none$/.test(old), old);

  // Carrying one member stretches the frame; carrying the tab carries all.
  const before = await page.evaluate(id=>{ const n = nodes.get(id); return {x:n.x, y:n.y, w:n.w, h:n.h}; }, a.id);
  const toScreen = (x, y)=> page.evaluate(([x, y])=>{ const r = svg.getBoundingClientRect(); return {x: r.left + x*vs + vx, y: r.top + y*vs + vy}; }, [x, y]);
  const scale = await page.evaluate(()=> vs);
  const m = await page.evaluate(()=>{ const n = nodes.get('az_b'); return {x: n.x + n.w/2, y: n.y + n.h/2}; });
  await page.evaluate(()=> centreViewOn(nodes.get('az_a').x, nodes.get('az_a').y + 60, vs));
  await pause(200);
  let p = await toScreen(m.x, m.y);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for(let i = 1; i <= 6; i++){ await page.mouse.move(p.x, p.y + i * 10 * scale); await pause(30); }
  await pause(120);
  const during = await page.evaluate(id=> nodes.get(id).h, a.id);
  await page.mouse.up(); await pause(250);
  const stretched = await page.evaluate(id=> nodes.get(id).h, a.id);
  check('the frame follows a member while it is carried', during > before.h + 40, `${before.h} → ${during}`);
  check('…and after it is put down', stretched > before.h + 40, `${before.h} → ${stretched}`);
  await page.evaluate(()=> deselect());
  // Just outside the frame's left side: the line itself is a port.
  const tab = await page.evaluate(id=>{ const n = nodes.get(id), r = svg.getBoundingClientRect();
    return {x: r.left + (n.x - 5) * vs + vx, y: r.top + (n.y + n.h/2) * vs + vy}; }, a.id);
  const grabs = await page.evaluate(([x, y])=>{ const e = document.elementFromPoint(x, y); return e && e.getAttribute('class'); }, [tab.x, tab.y]);
  eq('beside its frame an array is taken hold of', grabs, 'array-hit');
  const was = await page.evaluate(()=> [nodes.get('az_a').x, nodes.get('az_b').x]);
  await page.mouse.move(tab.x, tab.y); await page.mouse.down();
  for(let i = 1; i <= 6; i++){ await page.mouse.move(tab.x + i * 10 * scale, tab.y); await pause(30); }
  await page.mouse.up(); await pause(250);
  const moved = await page.evaluate(id=> ({a: nodes.get('az_a').x, b: nodes.get('az_b').x,
    pos: workingNodes.find(x=> x[0] === id)[6].pos}), a.id);
  check('carrying an array by its frame carries its members', moved.a > was[0] + 40 && Math.abs((moved.a - was[0]) - (moved.b - was[1])) < 0.01, JSON.stringify([was, moved]));
  check('an array keeps no place of its own', moved.pos === undefined, JSON.stringify(moved));

  const n = await page.evaluate(async id=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    // An array round an array: fitted round it and drawn behind it.
    setSelection([id, 'az_c'], id);
    out.outer = makeArrayOfSelection();
    await pause(100);
    const o = nodes.get(out.outer), i = nodes.get(id);
    out.round = o.x < i.x && o.y < i.y && o.x + o.w > i.x + i.w && o.y + o.h > i.y + i.h;
    const order = [...arrayLayer.children].map(g=> g.dataset.id);
    out.behind = order.indexOf(out.outer) < order.indexOf(id);
    // Hiding everything in an array hides it.
    // Copying an array copies what it holds, pointed at the copies.
    selectNode(id);
    copySelectedNode();
    pasteClipboardNode();
    await pause(100);
    const copy = workingNodes.find(x=> x[5] === 'array' && x[0] !== id && x[0] !== out.outer && !suiteArraysBefore.has(x[0]));
    out.copy = copy && copy[6].members;
    out.copyOk = !!copy && copy[6].members.length === 2 && copy[6].members.every(m=> !/^az_/.test(m) && nodes.has(m));
    // Deleting a member takes it out; deleting the last takes the array.
    deleteNodes(['az_a']);
    out.after = (workingNodes.find(x=> x[0] === id) || [])[6];
    deleteNodes(['az_b']);
    out.gone = !workingNodes.some(x=> x[0] === id);
    out.outerKeeps = (workingNodes.find(x=> x[0] === out.outer) || [])[6];
    deleteNodes(['az_c']);
    out.outerGone = !workingNodes.some(x=> x[0] === out.outer);
    // Ctrl+G and Ctrl+Shift+G.
    const made = copy ? copy[6].members : [];
    setSelection(made, made[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'g', code:'KeyG', ctrlKey:true, bubbles:true}));
    out.keyed = workingNodes.filter(x=> x[5] === 'array' && !suiteArraysBefore.has(x[0])).length;
    setSelection(made, made[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'G', code:'KeyG', ctrlKey:true, shiftKey:true, bubbles:true}));
    out.unkeyed = workingNodes.filter(x=> x[5] === 'array' && x[6].members.includes(made[0])).length;
    out.membersStay = made.every(m=> workingNodes.some(x=> x[0] === m));
    applyEdit(()=>{
      const doomed = new Set([...made, copy && copy[0]]);
      for(let k = workingNodes.length - 1; k >= 0; k--) if(doomed.has(workingNodes[k][0]) || (workingNodes[k][5] === 'array' && !suiteArraysBefore.has(workingNodes[k][0]))) workingNodes.splice(k, 1);
    });
    return out;
  }, a.id);
  check('an array may hold an array, fitted round it', n.round, JSON.stringify(n));
  check('…and drawn behind it', n.behind, JSON.stringify(n));
  check('copying an array copies its members and points at the copies', n.copyOk, JSON.stringify(n));
  check('deleting a member takes it out of the array', !!n.after && JSON.stringify(n.after.members) === '["az_b"]', JSON.stringify(n));
  check('an array left with nothing goes, and one round it keeps the rest', n.gone && !!n.outerKeeps &&
        JSON.stringify(n.outerKeeps.members) === '["az_c"]', JSON.stringify(n));
  check('…until that is gone too', n.outerGone, JSON.stringify(n));
  check('Ctrl+G makes an array and Ctrl+Shift+G takes it apart', n.keyed >= 2 && n.unkeyed === 0 && n.membersStay, JSON.stringify(n));
  });
  await scenario("a curve's bare end bends as the curve does", async () => {
  /* An end with no head is the spline as it is: nothing held straight and
     then made to turn in what is left, which the hand saw as a kink. An
     end with a head is straight under it and joins the curve without a
     corner. */
  const r = await page.evaluate(async ()=>{
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    applyEdit(()=>{
      workingNodes.push(['ck_a', 'Curve from', null, null, null, null, {pos:[2000, -900]}]);
      workingNodes.push(['ck_b', 'Curve to', 'ck_a', null, null, null, {pos:[2260, -720]}]);
      EDGE_STYLES.push({from:'ck_a', to:'ck_b', routing:'curve', dash:'solid', arrow:true});
    });
    await pause(200);
    const out = {};
    const route = drawnRoutes.get(calloutEdgeKey('ck_a', 'ck_b'));
    const line = document.querySelector('.edge[data-from="ck_a"][data-to="ck_b"]');
    const pts = (line.getAttribute('d').match(/-?[\d.]+,-?[\d.]+/g) || []).map(t=>{ const [x, y] = t.split(',').map(Number); return {x, y}; });
    const plain = curveThrough(route.pts, CURVE_STEP);
    // The first dozen units, point for point.
    let gap = 0;
    for(let i = 0; i < 8 && i < pts.length; i++) gap = Math.max(gap, Math.hypot(pts[i].x - plain[i].x, pts[i].y - plain[i].y));
    out.startGap = +gap.toFixed(3);
    // No step turns sharply anywhere along the drawn line.
    let worst = 0;
    for(let i = 2; i < pts.length; i++){
      const a1 = Math.atan2(pts[i-1].y - pts[i-2].y, pts[i-1].x - pts[i-2].x);
      const a2 = Math.atan2(pts[i].y - pts[i-1].y, pts[i].x - pts[i-1].x);
      const d = Math.abs(((a2 - a1) * 180 / Math.PI + 540) % 360 - 180);
      const len = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
      if(len > 0.5) worst = Math.max(worst, d);
    }
    out.worstTurn = +worst.toFixed(2);
    out.n = pts.length;
    applyEdit(()=>{
      for(let i = workingNodes.length - 1; i >= 0; i--) if(/^ck_/.test(workingNodes[i][0])) workingNodes.splice(i, 1);
      for(let k = EDGE_STYLES.length - 1; k >= 0; k--) if(/^ck_/.test(EDGE_STYLES[k].from)) EDGE_STYLES.splice(k, 1);
    });
    return out;
  });
  check('a curve leaves a bare end along the spline itself', r.startGap < 0.05, JSON.stringify(r));
  check('a curve turns no step sharply, at either end', r.worstTurn < 4.5, JSON.stringify(r));
  });
  await scenario("ends without a rule, a picture's cross, and defaults that say so", async () => {
  const r = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    applyEdit(()=>{
      workingNodes.push(['ff_a', 'Five A', null, null, null, null, {pos:[3200, -900]}]);
      workingNodes.push(['ff_b', 'Five B', 'ff_a', null, null, null, {pos:[3200, -760]}]);
      workingNodes.push(['ff_i', '', null, null, null, 'image', {pos:[3400, -900], size:[60, 40]}]);
    });
    await pause(200);
    // A connector's two ends: no rule between them, and "No" for nothing.
    openStyleBar({kind:'edge', from:'ff_a', to:'ff_b', x:300, y:300});
    applyStyleBar('endIn', 'none');
    const endOut = styleBar.querySelector('[data-group="endOut"]');
    const cs = getComputedStyle(endOut);
    out.ends = {rule: cs.borderLeftWidth, pad: cs.paddingLeft,
                face: styleBar.querySelector('[data-group="endIn"] .style-bar-drop-face').textContent,
                none: endOut.querySelector('[data-value="none"]').textContent};
    const line = styleBar.querySelector('[data-group="corners"]');
    out.otherRule = getComputedStyle(line).borderLeftWidth;
    closeStyleBar();
    // A picture's menu: a cross takes the picture off, and no Delete.
    openFreeMenu('ff_i', {clientX:200, clientY:200});
    await pause(50);
    const clear = document.getElementById('freeMenuImageClear');
    out.cross = clear.textContent.trim();
    out.crossBeside = clear.parentNode.contains(document.getElementById('freeMenuImageUrl'));
    out.noDelete = getComputedStyle(document.getElementById('freeMenuDelete')).display === 'none' ||
                   !document.getElementById('freeMenuDelete').getClientRects().length;
    closeFreeMenu();
    out.editCross = document.getElementById('editImageClear').textContent.trim();
    // Untagged's count stands in the column the others' do.
    buildSideTabs();
    setSideTab(document.getElementById('tagsPanel'), true);
    await pause(400);
    const rows = [...document.querySelectorAll('#tagsList .legend-item')].filter(r=> r.querySelector('.count'));
    const rights = rows.map(r=> Math.round(r.querySelector('.count').getBoundingClientRect().right * 10) / 10);
    out.counts = {rows: rows.length, right: [...new Set(rights)], untagged: !!document.querySelector('#tagsList .legend-tag-del-room')};
    setSideTab(document.getElementById('tagsPanel'), false);
    // The citation colour, at the program's own, wears the dashed edge.
    const held = SETTINGS.refColor;
    SETTINGS.refColor = DEFAULT_REF_COLOR;
    const box = document.getElementById('refColorInput');
    box.value = refColor(); paintHexSquare(box);
    const sq = box.previousElementSibling;
    out.refDefault = sq.classList.contains('inherited');
    SETTINGS.refColor = '#123456';
    box.value = refColor(); paintHexSquare(box);
    out.refOwn = sq.classList.contains('inherited');
    if(held === undefined) delete SETTINGS.refColor; else SETTINGS.refColor = held;
    box.value = refColor(); paintHexSquare(box);
    applyEdit(()=>{
      for(let i = workingNodes.length - 1; i >= 0; i--) if(/^ff_/.test(workingNodes[i][0])) workingNodes.splice(i, 1);
      for(let k = EDGE_STYLES.length - 1; k >= 0; k--) if(/^ff_/.test(EDGE_STYLES[k].from)) EDGE_STYLES.splice(k, 1);
    });
    return out;
  });
  check('a connector\'s two ends stand together, with no rule between',
        r.ends.rule === '0px' && r.ends.pad === '0px' && r.otherRule !== '0px', JSON.stringify(r.ends));
  check('…and "No" is how an end says it has nothing', r.ends.face === 'No' && r.ends.none === 'No', JSON.stringify(r.ends));
  check('a picture is taken off by a cross beside its address', r.cross === '✕' && r.crossBeside && r.editCross === '✕',
        JSON.stringify(r));
  check('an image\'s menu has no Delete', r.noDelete);
  check('every tag\'s count, Untagged\'s too, stands in one column',
        r.counts.rows >= 2 && r.counts.right.length === 1 && r.counts.right[0] > 0 && r.counts.untagged, JSON.stringify(r.counts));
  check('the citation colour at the program\'s own wears the dashed edge, and a chosen one does not',
        r.refDefault && !r.refOwn, JSON.stringify(r));
  });
  await scenario("menus without their notes, one sign-in, a moving sticker", async () => {
  const r = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    // The file menu: titled Export/Import, four file icons in a row, no prose.
    const pop = document.getElementById('filePopover');
    pop.classList.add('open');
    out.file = {
      head: pop.querySelector('.edge-popover-head span').textContent.trim(),
      cols: new Set([...pop.querySelectorAll('.file-tile')].map(b=> b.getBoundingClientRect().top)).size === 1 &&
            pop.querySelectorAll('.file-tile').length === 4 ? 4 : -1,
      where: !!document.getElementById('fileWhere'),
      note: !!pop.querySelector('.file-note, p'),
      pics: [...pop.querySelectorAll('.file-tile .fmt-label')].map(t=> t.textContent.trim()),
      wide: [...pop.querySelectorAll('.file-wide')].map(b=> b.id)
    };
    pop.classList.remove('open');
    // One Sign in, and it asks for a reader's session: the owner is told
    // apart by the service, not by which button they pressed.
    const btn = document.getElementById('ownerBtn');
    const opened = [];
    const held = window.open;
    window.open = (url)=>{ opened.push(String(url)); return {}; };
    try{ btn.onclick(); } finally { window.open = held; }
    out.sign = {label: btn.getAttribute('aria-label'), mark: !!btn.querySelector('svg') && !btn.textContent.trim(), url: opened[0] || ''};
    out.suggestNote = !!document.getElementById('suggestNote');
    out.stickerProse = !!document.querySelector('#stickerOverlay p, .sticker-hint');
    // A GIF is kept byte for byte, so it still moves.
    const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c=> c.charCodeAt(0));
    const src = await stickerDataFromFile(new File([gif], 'a.gif', {type:'image/gif'}));
    out.gif = src === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    // Tags with no category: a dashed field, and a mark in its middle.
    buildSideTabs();
    setSideTab(document.getElementById('tagsPanel'), true);
    await pause(300);
    const loose = document.querySelector('#tagsList .legend-loose');
    const hint = loose && loose.querySelector('.legend-loose-hint');
    if(loose && hint){
      const a = loose.getBoundingClientRect(), b = hint.querySelector('svg').getBoundingClientRect();
      out.loose = {border: getComputedStyle(loose).outlineStyle, text: hint.textContent.trim(),
                   off: Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2)};
    } else out.loose = {missing: true, hasItems: !!loose};
    setSideTab(document.getElementById('tagsPanel'), false);
    return out;
  });
  check('the file menu is called Export/Import and says nothing else',
        r.file.head === 'Export/Import' && !r.file.where && !r.file.note, JSON.stringify(r.file));
  /* Five until 0.23: the contents went out as data.js too, which the chart
     is not any more, and the JSON is the file it is. */
  check('…its exports are a row of four file icons, HTML, JSON, PNG and SVG, Import across the bottom',
        r.file.cols === 4 && r.file.pics.join() === 'HTML,JSON,PNG,SVG' && r.file.wide.includes('fileImport'), JSON.stringify(r.file));
  check('there is one Sign in, and it asks for a reader\'s session',
        r.sign.label === 'Sign in' && r.sign.mark && /\/login\?/.test(r.sign.url) && /as=reader/.test(r.sign.url), JSON.stringify(r.sign));
  check('Suggestions and Stickers carry no notes', !r.suggestNote && !r.stickerProse, JSON.stringify(r));
  check('a GIF sticker is kept byte for byte, so it moves', r.gif);
  check('tags with no category sit in a dashed field with a mark in its middle and no words',
        r.loose.missing ? r.loose.hasItems : (r.loose.border === 'dashed' && r.loose.text === '' && r.loose.off < 2),
        JSON.stringify(r.loose));
  });
  await scenario("menus under their buttons, a right click, the drawers above the corner", async () => {
  const r = await page.evaluate(async ()=>{
    const out = {};
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    const rect = id=> document.getElementById(id).getBoundingClientRect();
    /* Export/Import and Stickers drop from their own buttons. */
    document.getElementById('fileToggle').click(); await pause(100);
    out.file = {pop: rect('filePopover'), btn: rect('fileToggle')};
    document.getElementById('fileToggle').click();
    document.getElementById('filesToggle').click(); await pause(100);
    out.stick = {pop: rect('stickerOverlay'), btn: rect('filesToggle'),
                 plus: document.querySelector('#stickerUpload svg line') ? '+' : document.getElementById('stickerUpload').textContent.trim(),
                 overlay: document.getElementById('stickerOverlay').classList.contains('about-overlay')};
    document.getElementById('filesToggle').click(); await pause(50);
    out.stickShut = !document.getElementById('stickerOverlay').classList.contains('open');
    /* The chart as text is offered in About, not in the bar. */
    out.textIn = !!document.querySelector('#aboutOverlay #textViewToggle') && !document.querySelector('.topbar #textViewToggle');
    /* The add button makes entries; an array is not one of them. */
    out.fabArray = !!document.querySelector('#addFabStyles [data-value="array"]');
    /* A new category is named at the top, and stays there. */
    startNewCategoryEntry(); await pause(50);
    const groups = ()=> [...document.querySelectorAll('#tagsList .legend-group')];
    out.namingAt = groups().findIndex(g=> g.classList.contains('legend-group-new'));
    const box = document.querySelector('.legend-group-new .legend-group-name');
    box.textContent = 'Zz newest';
    box.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    await pause(100);
    out.madeAt = groups().findIndex(g=> g.querySelector('.legend-group-name') && g.querySelector('.legend-group-name').textContent === 'Zz newest');
    out.firstCat = TAG_CATS[0] && TAG_CATS[0].name;
    undoLastEdit(); await pause(100);
    /* The drawers end above the coordinates box, which stays put. */
    const coordBox = ()=> document.querySelector('.coord').getBoundingClientRect();
    const coordAt = coordBox().left;
    const panels = ['tagsPanel', 'refsPanel', 'keyPanel', 'mediaPanel'];
    panels.forEach(id=> setSideTab(document.getElementById(id), true));
    await pause(250);
    const lowest = Math.max(...panels.map(id=> document.querySelector('#' + id + ' .side-tab-body').getBoundingClientRect().bottom));
    out.coord = {before: coordAt, after: coordBox().left, top: coordBox().top, lowest};
    panels.forEach(id=> setSideTab(document.getElementById(id), false));
    /* A GIF chosen for a portrait or a picture is kept whole. */
    const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c=> c.charCodeAt(0));
    const target = document.createElement('input');
    bioImageTargetInput = target;
    const dt = new DataTransfer(); dt.items.add(new File([gif], 'a.gif', {type:'image/gif'}));
    const fileIn = document.getElementById('bioImageFile');
    fileIn.files = dt.files;
    fileIn.dispatchEvent(new Event('change'));
    for(let i = 0; i < 40 && !target.value; i++) await pause(25);
    out.portraitGif = target.value === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    out.cropperShut = !document.getElementById('cropOverlay').classList.contains('open');
    /* A tab is outlined at the border's weight. */
    applyEdit(()=> workingNodes.push(['rc_a', 'Right A', null, null, null, null,
      {pos:[24000, 24000], multiLang:true, langTabs:[{tag:'JP', text:'x'}], link:'https://example.com/'}]));
    applyEdit(()=> workingNodes.push(['rc_b', 'Right B', null, null, null, null, {pos:[24300, 24000]}]));
    await pause(150);
    const sw = sel=> parseFloat(getComputedStyle(document.querySelector(`.node[data-id="rc_a"] ${sel}`)).strokeWidth);
    out.tabs = {chip: sw('.lang-chip-bg'), link: sw('.node-link-bg'), border: NODE_BORDER_W};
    /* The tab's icon is the R·P drawing as an SVG (the owner's list of
       19.11: the PNG was blurred where an app is opened), written into the
       page, with a PNG drawn from it after it for a browser that takes no
       SVG icon. */
    const icon = document.querySelector('link[rel="icon"]');
    const png = document.querySelector('link[rel="alternate icon"]');
    // Inline in the built page; beside it, as files, in the sources.
    const text = !icon ? '' : await fetch(icon.href).then(r=> r.ok ? r.text() : '').catch(()=> '');
    out.favicon = (icon && icon.getAttribute('type')) === 'image/svg+xml' && /^<svg[^>]*viewBox="0 0 87 87"/.test(text) &&
                  (text.match(/<path /g) || []).length === 2 && /#c23b22/.test(text);
    const bytes = !png ? new Uint8Array(0) : new Uint8Array(await fetch(png.href)
      .then(r=> r.ok ? r.arrayBuffer() : new ArrayBuffer(0)).catch(()=> new ArrayBuffer(0)));
    out.faviconPng = bytes.length > 24 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    out.faviconInline = /^data:image\/svg\+xml;base64,/.test(icon ? icon.getAttribute('href') : '') &&
                        /^data:image\/png;base64,/.test(png ? png.getAttribute('href') : '');
    flyToNode('rc_a'); await pause(150);
    const at = id=>{ const b = document.querySelector(`.node[data-id="${id}"]`).getBoundingClientRect(); return {x: b.left + b.width/2, y: b.top + b.height/2}; };
    out.a = at('rc_a'); out.b = at('rc_b');
    return out;
  });
  const near = (a, b)=> Math.abs(a - b) < 1.5;
  check('Export/Import opens under its own button', near(r.file.pop.left, r.file.btn.left) && r.file.pop.top >= r.file.btn.bottom - 1,
        JSON.stringify(r.file));
  check('Stickers is a menu under its own button, with a + to add, and its button shuts it',
        near(r.stick.pop.left, r.stick.btn.left) && r.stick.pop.top >= r.stick.btn.bottom - 1 && r.stick.plus === '+' &&
        !r.stick.overlay && r.stickShut, JSON.stringify(r.stick));
  check('the chart as text is offered in About, not in the bar', r.textIn);
  check('the add button offers no array', !r.fabArray);
  check('a new category is named at the top and made there', r.namingAt === 1 && r.madeAt === 1 && r.firstCat === 'Zz newest',
        JSON.stringify({namingAt: r.namingAt, madeAt: r.madeAt, firstCat: r.firstCat}));
  check('the drawers end above the coordinates, which do not move when one opens',
        r.coord.before === r.coord.after && r.coord.lowest <= r.coord.top, JSON.stringify(r.coord));
  check('a GIF for a portrait or a picture is kept whole, with no cropper', r.portraitGif && r.cropperShut);
  check('language tabs and a link\'s tab are outlined at the border\'s weight',
        r.tabs.chip === r.tabs.border && r.tabs.link === r.tabs.border, JSON.stringify(r.tabs));
  check('the tab\'s icon is the R·P drawing as an SVG, with a PNG of it to fall back on (19.11)', r.favicon && r.faviconPng);
  if(MODE !== 'src') check('and the built page carries it inside', r.faviconInline);
  /* A right click: the menu at the pointer over what was clicked. */
  await page.mouse.click(r.a.x, r.a.y, {button: 'right'});
  await wait(150);
  const m1 = await page.evaluate(()=>{ const m = document.getElementById('touchMenu');
    return {shown: !m.hidden, acts: [...m.querySelectorAll('button')].filter(b=> !b.hidden).map(b=> b.dataset.act),
            sel: selectedId, box: m.getBoundingClientRect().toJSON()}; });
  check('a right click on an entry picks it and offers Cut, Copy, Paste and Delete at the pointer',
        m1.shown && m1.sel === 'rc_a' && m1.acts.join() === 'cut,copy,paste,ports,delete' &&
        Math.abs(m1.box.left - r.a.x) < 8 && Math.abs(m1.box.top - r.a.y) < 8, JSON.stringify(m1));
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{ selectNode('rc_a'); multiSelection.add('rc_a'); multiSelection.add('rc_b'); });
  await page.mouse.click(r.b.x, r.b.y, {button: 'right'});
  await wait(150);
  const m2 = await page.evaluate(()=>{ const m = document.getElementById('touchMenu');
    return {shown: !m.hidden, acts: [...m.querySelectorAll('button')].filter(b=> !b.hidden).map(b=> b.dataset.act), many: multiSelection.size}; });
  check('…and inside a selection of two it keeps them both and offers Array', m2.shown && m2.many === 2 && m2.acts.includes('array'),
        JSON.stringify(m2));
  await page.mouse.click(300, 700, {button: 'right'});
  await wait(150);
  const m3 = await page.evaluate(()=>{ const m = document.getElementById('touchMenu');
    return {shown: !m.hidden, acts: [...m.querySelectorAll('button')].filter(b=> !b.hidden).map(b=> b.dataset.act)}; });
    check('on open paper a right click offers Paste, and the field\'s ground', m3.shown && m3.acts.join() === 'paste,background', JSON.stringify(m3));
  await page.mouse.click(320, 720);
  await wait(100);
  check('a press elsewhere puts it away', await page.evaluate(()=> document.getElementById('touchMenu').hidden));
  await page.evaluate(()=>{ deselect(); applyEdit(()=>{ workingNodes = workingNodes.filter(e=> !/^rc_/.test(e[0])); }); });
  });
  await scenario("notes and callouts stand on a curve as it is drawn", async () => {
  /* A curve is drawn through its route rather than along it, and a note
     placed on the route stood beside the curve in the air. Measured
     against the drawn line itself. */
  const r = await page.evaluate(async ()=>{
    const X = 31000, Y = 31000;
    const beforeStyles = EDGE_STYLES.slice();
    applyEdit(()=>{
      workingNodes.push(['cn_a', 'Start', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['cn_b', 'Finish', 'cn_a', null, null, null, {pos:[X + 360, Y + 220]}]);
      workingNodes.push(['cn_c', 'A callout', null, null, null, 'callout', {pos:[X + 60, Y + 200], leader:{from:'cn_a', to:'cn_b', at:0.3}}]);
      EDGE_STYLES.push({from:'cn_a', to:'cn_b', routing:'curve', note:'on the line', noteAt:0.5, notePos:'on'});
    });
    await new Promise(ok=> setTimeout(ok, 250));
    const line = drawnLineOf('cn_a', 'cn_b');
    const off = (x, y)=>{
      let best = Infinity;
      for(let i = 1; i < line.length; i++){
        const a = line[i-1], b = line[i], dx = b.x - a.x, dy = b.y - a.y, L = dx*dx + dy*dy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x)*dx + (y - a.y)*dy) / L));
        best = Math.min(best, Math.hypot(a.x + dx*t - x, a.y + dy*t - y));
      }
      return Math.round(best * 100) / 100;
    };
    const plate = document.querySelector('.edge-note[data-from="cn_a"][data-to="cn_b"] .edge-note-plate');
    const pb = plate.getBBox();
    const dot = document.querySelector('.callout-leader[data-id="cn_c"] .leader-dot');
    const out = {note: off(pb.x + pb.width/2, pb.y + pb.height/2), dot: off(+dot.getAttribute('cx'), +dot.getAttribute('cy'))};
    /* Written along the line (the owner's toggle, 22.10): one button on the
       note's bar, the words on a path that keeps the side asked for at the
       same distance all the way along, and no plate. */
    applyEdit(()=> Object.assign(EDGE_STYLES.find(x=> x.from === 'cn_a' && x.to === 'cn_b'), {notePos:'above'}));
    openStyleBar({kind:'note', from:'cn_a', to:'cn_b'});
    const btn = document.querySelector('#styleBar [data-group="noteAlong"] button');
    out.button = !!btn && !btn.closest('[data-group]').hidden;
    if(btn) btn.click();
    await new Promise(ok=> setTimeout(ok, 200));
    out.stored = !!edgeStyleFor('cn_a', 'cn_b').noteAlong &&
                 /noteAlong:true/.test(serializeEdgeStyles(EDGE_STYLES));
    // Its frame is offered there too, now that a band can frame it (0.16.0).
    out.framesGreyed = !document.querySelector('#styleBar [data-group="frame"] button:disabled');
    closeStyleBar();
    const g = document.querySelector('.edge-note[data-from="cn_a"][data-to="cn_b"]');
    const tp = g && g.querySelector('textPath');
    const along = g && g.querySelector('.edge-note-along-path');
    out.alongDrawn = !!tp && tp.textContent === 'on the line' && !g.querySelector('.edge-note-plate');
    if(along){
      const L = along.getTotalLength(), ds = [];
      for(let k = 1; k < 10; k++){ const q = along.getPointAtLength(L * k / 10); ds.push(off(q.x, q.y)); }
      // A copy of the line as far off it as a level note's middle (the owner's list of 30.10).
      const want = EDGE_NOTE_OFFSET;
      out.alongOffset = ds;
      out.alongEven = ds.every(d=> Math.abs(d - want) < 1.2);
    }
    /* And a line running right to left is written left to right. */
    applyEdit(()=>{
      workingNodes.push(['cn_d', 'Back', null, null, null, null, {pos:[X + 400, Y + 400]}]);
      workingNodes.push(['cn_e', 'Here', 'cn_d', null, null, null, {pos:[X, Y + 600]}]);
      EDGE_STYLES.push({from:'cn_d', to:'cn_e', routing:'curve', note:'backwards', noteAlong:true});
    });
    await new Promise(ok=> setTimeout(ok, 250));
    const back = document.querySelector('.edge-note[data-from="cn_d"] .edge-note-along-path');
    if(back){
      const L = back.getTotalLength();
      out.upright = back.getPointAtLength(0).x < back.getPointAtLength(L).x;
    }
    applyEdit(()=>{ workingNodes = workingNodes.filter(e=> !/^cn_/.test(e[0])); refill(EDGE_STYLES, beforeStyles); });
    return out;
  });
  check('a note on a curve stands on the curve', r.note < 1.5, JSON.stringify(r));
  check('and so does a callout\'s dot', r.dot < 1.5, JSON.stringify(r));
  check('a note can be written along its line, from its bar, and may still be framed',
        r.button && r.stored && r.alongDrawn && r.framesGreyed, JSON.stringify(r));
  check('and keeps its side at one distance all along the curve', r.alongEven, JSON.stringify(r.alongOffset));
  check('and a line running leftwards is still written upright', r.upright, String(r.upright));
  });
  await scenario("a straight lineage leaves the bar where it crosses nothing", async () => {
  /* The owner's rule for a merge whose lineage is routed straight (22.10):
     at an end of the bar it runs to the end of the bar the others make; in
     the middle it runs into the junction bead unless that line would cross
     another lineage, when it stays on the bar; standing over the junction
     it already drops into it. Five lineages, one straight at a time. */
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const G = GRID, X = snapToGrid(33000), Y = snapToGrid(33000);
    const ids = ['A','B','C','D','E'].map(c=> 'sl' + c);
    const lift = [4, 1, 3, 0, 5];
    const make = (straight, under)=>{
      applyEdit(()=>{
        workingNodes = workingNodes.filter(e=> !/^sl/.test(e[0]));
        refill(EDGE_STYLES, EDGE_STYLES.filter(x=> !/^sl/.test(x.to)));
        ids.forEach((id, i)=> workingNodes.push([id, 'Lineage ' + 'ABCDE'[i], null, null, null, null,
          {pos:[X + G*14*i, Y + G*lift[i]]}]));
        workingNodes.push(['slM', 'Amalgam', ids, null, null, null, {merge:true, pos:[X + G*under, Y + G*30]}]);
        straight.forEach(i=> EDGE_STYLES.push({from: ids[i], to: 'slM', routing: 'straight'}));
      });
    };
    const look = (id)=>{
      const p = document.querySelector(`.amalgam-member[data-from="${id}"][data-to="slM"]`);
      const nums = p ? (p.getAttribute('d').match(/-?[\d.]+/g) || []).map(Number) : [];
      const j = document.querySelector('.amalgam-junction[data-to="slM"]');
      const bar = amalgamBars.get('slM');
      return {direct: !!(p && p.classList.contains('amalgam-direct')),
              end: {x: nums[nums.length - 2], y: nums[nums.length - 1]},
              junction: j ? {x: +j.getAttribute('cx'), y: +j.getAttribute('cy')} : null,
              land: bar ? Object.fromEntries(bar.landings.map(l=> [l.from, l.at])) : {},
              joints: [...document.querySelectorAll('.amalgam-joint[data-to="slM"]')]
                        .map(c=> +(+c.getAttribute('cx')).toFixed(1))};
    };
    const out = {};
    try{
      // The amalgam under the middle lineage: the junction stands over C.
      make([0], 26); await wait(250); out.edge = look('slA');
      make([1], 26); await wait(250); out.middle = look('slB');
      // The amalgam under D: B's line into the junction would cross C.
      make([1], 40); await wait(250); out.crossing = look('slB');
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x)); refill(EDGE_STYLES, beforeStyles); });
    }
    return out;
  });
  const near = (a, b)=> a && b && Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6;
  check('a straight lineage at an end of the bar runs to the end of the others\' bar',
        r.edge.direct && Math.abs(r.edge.end.x - r.edge.land.slB) < 0.6 &&
        r.edge.joints.some(x=> Math.abs(x - r.edge.land.slB) < 0.6), JSON.stringify(r.edge));
  check('one in the middle that crosses nothing runs into the junction',
        r.middle.direct && near(r.middle.end, r.middle.junction), JSON.stringify(r.middle));
  check('and one whose line would cross another lineage stays on the bar',
        !r.crossing.direct && !near(r.crossing.end, r.crossing.junction), JSON.stringify(r.crossing));
  });
  await scenario("the evening of 22.10: a zoom mid-carry, bars that follow, a field that settles", async () => {
  const at = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const X = snapToGrid(37000), Y = snapToGrid(37000);
    applyEdit(()=>{
      workingNodes.push(['ev_a', 'Carried', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['ev_b', 'Joined', 'ev_a', null, null, null, {pos:[X + 400, Y]}]);
    });
    await wait(200);
    flyToNode('ev_a'); await wait(300);
    const r = document.querySelector('.node[data-id="ev_a"]').getBoundingClientRect();
    return {x: r.left + r.width/2, y: r.top + r.height/2};
  });
  /* Carried, then the wheel turned mid-carry: the entry stays under the
     hand at the new scale, and the next movement does not jump it. */
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 40, at.y + 20, {steps: 4});
  await page.waitForTimeout(120);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
  await page.mouse.move(at.x + 44, at.y + 22, {steps: 2});
  await page.waitForTimeout(150);
  const zoomed = await page.evaluate(()=>{
    const n = nodes.get('ev_a');
    const r = document.querySelector('.node[data-id="ev_a"]').getBoundingClientRect();
    return {vs, grid: GRID, centre: {x: r.left + r.width/2, y: r.top + r.height/2}, w: n.w};
  });
  await page.mouse.up();
  // Out of the way, so the real pointer leaving an entry closes no bar below.
  await page.mouse.move(5, 940);
  await page.waitForTimeout(400);
  // Within a grid step of the hand, at the new scale.
  const off = Math.hypot(zoomed.centre.x - (at.x + 44), zoomed.centre.y - (at.y + 22));
  check('an entry carried while the wheel turns stays under the hand', zoomed.vs > 1.05 && off <= zoomed.grid * zoomed.vs + 2,
        JSON.stringify({off, zoomed}));
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const out = {};
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    try{
      /* The bar on an entry follows it when it is carried. */
      /* Straight to the middle, with no flight: a bar against the edge of
         the window is held there and could not show it moving. */
      { const n = nodes.get('ev_a'); centreViewOn(n.x + n.w/2, n.y + n.h/2, 1); }
      await wait(100);
      openStyleBar({kind:'node', id:'ev_a'});
      const b0 = styleBar.getBoundingClientRect();
      const g = document.querySelector('.node[data-id="ev_a"]');
      const nr = g.getBoundingClientRect();
      g.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:nr.left + 5, clientY:nr.top + 5}));
      for(let k = 1; k <= 6; k++){
        window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:nr.left + 5 + k*12, clientY:nr.top + 5 + k*6}));
        await wait(30);
      }
      await wait(120);
      const b1 = styleBar.getBoundingClientRect();
      const moved = document.querySelector('.node[data-id="ev_a"]').getBoundingClientRect().left - nr.left;
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(200);
      out.barFollows = !styleBar.hidden && moved > 40 && Math.abs((b1.left - b0.left) - moved) < 2;
      out.barAt = [b0.left, b1.left, moved];
      closeStyleBar();
      /* A press on a connector keeps its bar up beside its panel. */
      const hit = document.querySelector('.edge-hit[data-from="ev_a"][data-to="ev_b"]');
      const hr = hit.getBoundingClientRect();
      const px = hr.left + hr.width/2, py = hr.top + hr.height/2;
      hit.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, clientX:px, clientY:py}));
      await wait(50);
      hit.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:px, clientY:py}));
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, clientX:px, clientY:py}));
      hit.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:px, clientY:py}));
      await wait(300);
      out.edgeBarStays = !styleBar.hidden && styleBarTarget && styleBarTarget.kind === 'edge' &&
                         edgePopover.classList.contains('open');
      closeEdgePopover(); closeStyleBar();
      /* A press on the paper settles a field being typed in. */
      const search = document.getElementById('searchInput');
      search.focus();
      svg.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true, clientX:400, clientY:700}));
      out.paperSettles = document.activeElement !== search;
      /* A colour code keeps its #. */
      const box = document.createElement('input');
      box.className = 'hex-box';
      document.body.appendChild(box);
      box.focus();
      out.hashOnFocus = box.value === '#';
      box.value = 'c23b22'; box.setSelectionRange(6, 6);
      box.dispatchEvent(new InputEvent('input', {bubbles:true}));
      out.hashPasted = box.value === '#c23b22';
      box.setSelectionRange(1, 1);
      const bs = new KeyboardEvent('keydown', {key:'Backspace', bubbles:true, cancelable:true});
      box.dispatchEvent(bs);
      out.hashKept = bs.defaultPrevented;
      box.value = '#'; box.blur();
      out.hashAloneIsEmpty = box.value === '';
      box.remove();
      /* The file tiles are smaller, and their sheets carry no ground. */
      const tile = document.querySelector('#fileExport');
      document.getElementById('filePopover').classList.add('open');
      out.tileW = Math.round(tile.getBoundingClientRect().width);
      out.sheetBare = getComputedStyle(tile.querySelector('.fmt-sheet')).fill === 'none';
      document.getElementById('filePopover').classList.remove('open');
    } finally {
      applyEdit(()=>{ workingNodes = workingNodes.filter(e=> !/^ev_/.test(e[0])); refill(EDGE_STYLES, beforeStyles); });
    }
    return out;
  });
  check('a bar on an entry follows it while it is carried', r.barFollows, JSON.stringify(r.barAt));
  check('a press on a connector keeps its bar up beside its panel', r.edgeBarStays);
  check('a press on the paper settles a field being typed in', r.paperSettles);
  check('a colour code keeps its #: put in on focus, kept on paste and Backspace, empty alone',
        r.hashOnFocus && r.hashPasted && r.hashKept && r.hashAloneIsEmpty, JSON.stringify(r));
  check('the file tiles are 40 px and their sheets are bare', r.tileW === 40 && r.sheetBare, JSON.stringify(r));
  const q = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const out = {};
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const X = 38000, Y = 38000;
    try{
      applyEdit(()=>{
        workingNodes.push(['ev_c', 'Green', null, null, null, null, {pos:[X, Y], colors:['#2f9a4a']}]);
        workingNodes.push(['ev_d', 'Blue', 'ev_c', null, null, null, {pos:[X + 400, Y + 300], colors:['#2b54c8']}]);
        workingNodes.push(['ev_k', 'a remark', null, null, null, 'callout', {pos:[X + 120, Y + 360], leader:{from:'ev_c', to:'ev_d', at:0.7}}]);
        EDGE_STYLES.push({from:'ev_c', to:'ev_d', routing:'orthogonal', gradient:['#2f9a4a', '#2b54c8'],
                          note:'a long note that goes round the corner', noteAlong:true, noteAt:0.98});
      });
      await wait(300);
      /* A callout on a connector that runs through two colours is drawn
         in the one its leader has — the colour at its anchor. */
      const lead = document.querySelector('.callout-leader[data-id="ev_k"] .leader-line');
      const frame = document.querySelector('.node[data-id="ev_k"] rect[stroke]');
      out.leader = lead && lead.getAttribute('stroke');
      out.frame = frame && frame.getAttribute('stroke');
      out.cardMatches = !!out.leader && /^#/.test(out.leader) && out.leader === out.frame &&
                        out.leader !== '#2f9a4a' && out.leader !== '#2b54c8';
      /* Words along a square-elbowed line turn its corners round, and a
         note slid to an end keeps all its words on the line. */
      const tp = document.querySelector('.edge-note[data-from="ev_c"] textPath');
      const path = document.querySelector('.edge-note[data-from="ev_c"] .edge-note-along-path');
      const t = tp && tp.closest('text');
      if(path && t){
        const total = path.getTotalLength(), half = t.getComputedTextLength() / 2;
        const so = +tp.getAttribute('startOffset');
        out.alongHeld = so >= half - 0.5 && so <= total - half + 0.5;
        // Rounded: no two neighbouring steps of the path turn by 90°.
        const d = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
        let sharp = 0;
        for(let i = 2; i + 3 < d.length; i += 2){
          const ax = d[i] - d[i-2], ay = d[i+1] - d[i-1], bx = d[i+2] - d[i], by = d[i+3] - d[i+1];
          const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
          if(la > 0.01 && lb > 0.01 && Math.abs((ax*bx + ay*by) / (la*lb)) < 0.5) sharp++;
        }
        out.alongRound = sharp === 0;
        out.sharp = sharp;
      }
      /* A press on the words being written in stays in the field. */
      openNodeEditor('ev_c'); await wait(200);
      const g = document.querySelector('.node[data-id="ev_c"]');
      const gr = g.getBoundingClientRect();
      const press = new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:gr.left + 2, clientY:gr.bottom - 2});
      g.dispatchEvent(press);
      g.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:gr.left + 2, clientY:gr.bottom - 2}));
      await wait(250);
      out.editorKept = !!nodeEditorTarget && nodeEditorTarget.id === 'ev_c';
      /* …but its grips are not its words: a corner still resizes it. */
      nodeControlsOn('ev_c');
      const grip = document.querySelector('.node[data-id="ev_c"] .node-resize-se .node-resize-hit');
      const w0 = nodes.get('ev_c').w;
      if(grip){
        const b = grip.getBoundingClientRect();
        const sx = b.x + b.width/2, sy = b.y + b.height/2;
        grip.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
        for(let k = 1; k <= 4; k++){
          window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:sx + k*15, clientY:sy + k*10}));
          await wait(30);
        }
        window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        await wait(250);
      }
      out.gripWorks = !!grip && nodes.get('ev_c').w > w0 + 20;
      closeNodeEditor(true);
    } finally {
      applyEdit(()=>{ workingNodes = workingNodes.filter(e=> !/^ev_/.test(e[0])); refill(EDGE_STYLES, beforeStyles); });
    }
    return out;
  });
  check('a callout on a two-colour connector is drawn in its leader\'s colour', q.cardMatches, JSON.stringify(q));
  check('words along a square-elbowed line turn its corners round', q.alongRound, JSON.stringify(q));
  check('and a note slid to an end keeps all its words on the line', q.alongHeld, JSON.stringify(q));
  check('a press on the words being written in stays in the field', q.editorKept, JSON.stringify(q));
  check('and a corner of the entry being written in still resizes it', q.gripWorks, JSON.stringify(q));
  });
  await scenario("code 1 of 22.10: a wheel mid-pan, a pasted code, a copy that keeps its look", async () => {
  /* A wheel turned while the paper is being dragged: the point under the
     hand stays under it, rather than the view jumping back to where the
     drag began at the old scale. */
  const startAt = await page.evaluate(async ()=>{
    flyToNode(nodes.keys().next().value);
    await new Promise(ok=> setTimeout(ok, 300));
    return {vx, vy, vs};
  });
  // A spot on the paper with nothing on it.
  const spot = await page.evaluate(()=>{
    for(let y = 820; y > 200; y -= 40) for(let x = 1200; x > 300; x -= 40){
      const t = document.elementFromPoint(x, y);
      if(t === svg || (t && t.id === 'bgLayer') || (t && t.closest && t.closest('#gridLayer, .grid-bg'))) return {x, y};
    }
    return {x: 700, y: 500};
  });
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 30, spot.y + 15, {steps: 3});
  await page.waitForTimeout(80);
  const worldBefore = await page.evaluate(([x, y])=>({x: (x - svg.getBoundingClientRect().left - vx) / vs, y: (y - svg.getBoundingClientRect().top - vy) / vs}), [spot.x + 30, spot.y + 15]);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
  await page.mouse.move(spot.x + 34, spot.y + 17, {steps: 2});
  await page.waitForTimeout(100);
  const pan = await page.evaluate(([x, y])=>({vs, x: (x - svg.getBoundingClientRect().left - vx) / vs, y: (y - svg.getBoundingClientRect().top - vy) / vs}), [spot.x + 34, spot.y + 17]);
  await page.mouse.up();
  await page.mouse.move(5, 940);
  const drift = Math.hypot(pan.x - worldBefore.x, pan.y - worldBefore.y) * pan.vs;
  check('a wheel turned mid-pan keeps the paper under the hand', pan.vs > startAt.vs * 1.05 && drift < 12,
        JSON.stringify({drift, pan, worldBefore, startAt}));
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const out = {};
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const X = snapToGrid(39000), Y = snapToGrid(39000);
    const beforeTagColors = SETTINGS.tagColors;
    try{
      applyEdit(()=>{
        workingNodes.push(['k1_a', 'Kept look', null, null, null, null,
                           {pos:[X, Y], bg:'#fff3c4', border:'dashed', tags:['k1tag']}]);
        workingNodes.push(['k1_b', 'Tabbed', 'k1_a', null, null, null,
                           {pos:[X + 400, Y], multiLang:true, langTabs:[{tag:'JP', text:'元'}]}]);
        workingNodes.push(['k1_c', 'Doomed', null, null, null, null, {pos:[X, Y + 300]}]);
        SETTINGS.tagColors = Object.assign({}, SETTINGS.tagColors, {k1tag:'#2b54c8'});
      });
      await wait(200);
      /* A search's chip for an entry's own text is not taken for the
         chart's frame, which every bar and panel is placed from. */
      const search0 = document.getElementById('searchInput');
      search0.value = 'tabbed';
      search0.dispatchEvent(new Event('input', {bubbles:true}));
      out.chipShown = !!document.querySelector('#searchResults .sr-tab');
      out.oneFrame = document.querySelectorAll('.main').length === 1;
      search0.value = '';
      search0.dispatchEvent(new Event('input', {bubbles:true}));
      /* A press on an entry leaves a field being typed in alone: the
         blur would commit and redraw, and the press would land on paper. */
      const search = document.getElementById('searchInput');
      search.focus();
      const g = document.querySelector('.node[data-id="k1_a"]');
      g.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true, clientX:10, clientY:10}));
      out.entryKeepsField = document.activeElement === search;
      search.blur();
      /* A pasted code with its # and an alpha keeps every digit. */
      const box = document.createElement('input');
      box.className = 'hex-box'; box.maxLength = 9;
      document.body.appendChild(box);
      let edits = 0;
      box.addEventListener('input', ()=> edits++);
      box.focus();
      box.setSelectionRange(1, 1);
      const dt = new DataTransfer();
      dt.setData('text/plain', '#c23b22ff');
      box.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles:true, cancelable:true}));
      out.pasted = box.value;
      box.value = ''; box.blur();
      /* A field entered empty and left empty has changed nothing. */
      edits = 0;
      box.focus(); box.blur();
      out.emptyEdits = edits;
      box.remove();
      /* A copy keeps the look that was chosen, and not its tags' colour. */
      const clip = clipOfNode(nodes.get('k1_a'));
      out.clipBg = clip.opts.bg; out.clipBorder = clip.opts.border;
      out.clipColours = clip.opts.colors || null;
      out.clipPos = clip.opts.pos || null;
      /* Rolling back a preview of a tab puts the tab's words back. */
      const input = document.createElement('input');
      beginLabelPreview('k1_b', input, 0);
      input.value = 'typed';
      renderLabelPreview();
      out.previewed = nodes.get('k1_b').langTabs[0].text;
      endLabelPreview(false);
      out.rolledBack = nodes.get('k1_b').langTabs[0].text;
      out.labelKept = nodes.get('k1_b').label;
      /* With nothing chosen, a face is for the whole text. */
      const ed = document.createElement('div');
      ed.contentEditable = 'true'; ed.textContent = 'all of it';
      document.body.appendChild(ed);
      ed.focus();
      const sel = getSelection(), caret = document.createRange();
      caret.setStart(ed.firstChild, 3); caret.collapse(true);
      sel.removeAllRanges(); sel.addRange(caret);
      selectAllUnlessChosen(ed);
      out.wholeChosen = sel.toString() === 'all of it';
      ed.remove();
      /* One entry deleted is one step of undo. */
      out.deleted = deleteNode('k1_c') !== false && !nodes.has('k1_c');
      // The stack is capped, so its length says nothing once it is full:
      // one undo bringing the entry back is what one step means.
      undoLastEdit();
      out.oneStep = nodes.has('k1_c');
      out.missing = deleteNode('k1_nothing') === false;
      /* A press on a connector's bar keeps the connector's panel open,
         and the bar stays while the hand goes over to that panel. */
      flyToNode('k1_a'); await wait(250);
      const hit = document.querySelector('.edge-hit[data-from="k1_a"][data-to="k1_b"]');
      const hr = hit.getBoundingClientRect();
      const px = hr.left + hr.width/2, py = hr.top + hr.height/2;
      hit.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, clientX:px, clientY:py}));
      await wait(50);
      hit.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:px, clientY:py}));
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, clientX:px, clientY:py}));
      hit.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:px, clientY:py}));
      await wait(250);
      hit.dispatchEvent(new MouseEvent('mouseout', {bubbles:true, relatedTarget: edgePopover, clientX:px, clientY:py}));
      await wait(500);
      out.barWhileToPanel = !styleBar.hidden && styleBarTarget && styleBarTarget.kind === 'edge';
      const sb = styleBar.getBoundingClientRect();
      out.panelWasOpen = edgePopover.classList.contains('open');
      const press = {bubbles:true, cancelable:true, button:0, clientX:sb.left + 4, clientY:sb.top + 4};
      styleBar.dispatchEvent(new MouseEvent('mousedown', press));
      styleBar.dispatchEvent(new MouseEvent('click', press));
      await wait(100);
      out.panelKept = edgePopover.classList.contains('open');
      closeEdgePopover(); closeStyleBar();
    } finally {
      SETTINGS.tagColors = beforeTagColors;
      applyEdit(()=>{ workingNodes = workingNodes.filter(e=> !/^k1_/.test(e[0])); refill(EDGE_STYLES, beforeStyles); });
    }
    return out;
  });
  check('a search\'s chip is not taken for the chart\'s frame', r.chipShown && r.oneFrame, JSON.stringify(r));
  check('a press on an entry leaves a field being typed in alone', r.entryKeepsField, JSON.stringify(r));
  eq('a pasted colour code with its # keeps every digit', r.pasted, '#c23b22ff');
  eq('a colour field entered empty and left empty changes nothing', r.emptyEdits, 0);
  check('a copy keeps its ground and border, and not its tags\' colour or its place',
        r.clipBg === '#fff3c4' && r.clipBorder === 'dashed' && !r.clipColours && !r.clipPos, JSON.stringify(r));
  check('rolling back a tab\'s preview puts the tab\'s words back', r.previewed === 'typed' && r.rolledBack === '元' && r.labelKept === 'Tabbed', JSON.stringify(r));
  check('with nothing chosen, a face or a size is for the whole text', r.wholeChosen);
  check('one entry deleted is one step of undo, and a missing one is refused', r.deleted && r.oneStep && r.missing, JSON.stringify(r));
  check('a connector\'s bar stays while the hand goes to its panel', r.barWhileToPanel, JSON.stringify(r));
  check('a press on a connector\'s bar keeps its panel open', r.panelWasOpen && r.panelKept, JSON.stringify(r));
  });
  await scenario("the chart as text", async () => {
  /* The same chart written out as a document (41-text-view.js), for a
     screen reader and for whatever reads the page without running it.
     It is in the page from start-up, before anyone opens it; every entry
     is in it once; and a name in it opens that entry on the chart. */
  const boot = await page.evaluate(()=>({
    built: document.querySelectorAll('#textViewBody .tv-name').length > 0,
    open: document.getElementById('textViewOverlay').classList.contains('open')
  }));
  check('the text is in the page before anyone opens it', boot.built && !boot.open, JSON.stringify(boot));
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const out = {};
    try{
      applyEdit(()=>{
        workingNodes.push(['tv_a', 'Alpha {{u:solid|one}}', null, null, 'A note\non two lines', null, {pos:[4000, 3000], tags:['tvtag'], link:'https://example.com/a'}]);
        workingNodes.push(['tv_b', 'Beta', 'tv_a', 'adapted', null, null, {pos:[4300, 3000], multiLang:true, langTabs:[{tag:'JP', text:'ベータ'}]}]);
        workingNodes.push(['tv_c', 'Gamma', ['tv_b', 'tv_a'], 'merged', null, null, {pos:[4600, 3000]}]);
        workingNodes.push(['tv_d', 'A remark', 'tv_a', null, null, 'callout', {pos:[4000, 3300]}]);
        workingNodes.push(['tv_e', 'Frame', null, null, null, 'array', {members:['tv_a', 'tv_b']}]);
        workingNodes.push(['tv_f', 'Caption', null, null, null, 'textbox', {pos:[4000, 3500]}]);
        workingNodes.push(['tv_g', 'Delta', ['tv_a', 'tv_a'], null, null, null, {pos:[4900, 3000], link:'#entry=tv_c'}]);
        EDGE_STYLES.push({from:'tv_a', to:'tv_c', note:'and also'});
      });
      document.getElementById('textViewToggle').click();
      const box = document.getElementById('textViewOverlay');
      out.opened = box.classList.contains('open') && document.getElementById('textViewToggle').getAttribute('aria-expanded') === 'true';
      out.focusInside = box.contains(document.activeElement);
      const heads = Array.from(box.querySelectorAll('.tv-head .tv-name')).map(a=> a.dataset.id);
      const listed = Array.from(nodes.values()).filter(n=> !isArrayNode(n) && !isFreeShape(n.shape) && n.shape !== 'callout' && !isSplitNode(n)).map(n=> n.id);
      out.eachOnce = heads.length === listed.length && new Set(heads).size === heads.length && listed.every(id=> heads.includes(id));
      out.leftOut = ['tv_d', 'tv_e', 'tv_f'].filter(id=> heads.includes(id));
      const item = id=> box.querySelector(`.tv-head .tv-name[data-id="${id}"]`).closest('.tv-entry');
      const a = item('tv_a'), b = item('tv_b'), c = item('tv_c');
      out.aText = a.querySelector('.tv-head').textContent;
      out.aNote = a.querySelector(':scope > .tv-note').textContent;
      out.aLink = a.querySelector(':scope > .tv-link a').href;
      out.bUnderA = b.parentElement.closest('.tv-entry') === a;
      out.bFrom = b.querySelector(':scope > .tv-from').textContent;
      out.bAlso = b.querySelector(':scope > .tv-also').textContent;
      out.cUnderB = c.parentElement.closest('.tv-entry') === b;
      out.cFrom = Array.from(c.querySelectorAll(':scope > .tv-from')).map(p=> p.textContent);
      const d = item('tv_g');
      out.dFrom = d.querySelectorAll(':scope > .tv-from').length;
      out.dSee = d.querySelector(':scope > .tv-link').textContent;
      out.dSeeId = d.querySelector(':scope > .tv-link a').dataset.id;
      /* An edit while it is open is in it at once. */
      applyEdit(()=>{ workingNodes[workingIndex('tv_b')][1] = 'Beta renamed'; });
      out.renamed = box.querySelector('.tv-head .tv-name[data-id="tv_b"]').textContent;
      /* A name opens its entry, and the reader is taken to its panel. */
      box.querySelector('.tv-head .tv-name[data-id="tv_c"]').click();
      out.picked = selectedId;
      out.closed = !box.classList.contains('open') && document.getElementById('textViewToggle').getAttribute('aria-expanded') === 'false';
      out.focusTitle = document.activeElement && document.activeElement.id;
      deselect();
      /* On the drawing: one image per entry, named in words; the frame and
         the connectors are not read at all. */
      const g = id=> document.querySelector(`.node[data-id="${id}"]`);
      out.role = g('tv_a').getAttribute('role');
      out.label = g('tv_a').getAttribute('aria-label');
      out.arrayHidden = g('tv_e').getAttribute('aria-hidden');
      out.edgesHidden = document.getElementById('edgeLayer').getAttribute('aria-hidden');
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  check('it opens from the bar, says so, and takes the focus', r.opened && r.focusInside, JSON.stringify(r));
  check('every entry is in it once', r.eachOnce, JSON.stringify(r));
  eq('callouts, frames and captions are not entries in it', r.leftOut.join(','), '');
  check('a name is said in words, with its tags', r.aText.includes('Alpha one') && r.aText.includes('tvtag'), r.aText);
  check('with its note and its link', r.aNote === 'A note\non two lines' && r.aLink === 'https://example.com/a', JSON.stringify([r.aNote, r.aLink]));
  check('an entry stands under the one it comes from, with what its line says', r.bUnderA && r.bFrom === 'adapted', JSON.stringify(r));
  eq('and the names it goes by on its tabs', r.bAlso, 'Also: ベータ');
  check('two parents: under the first, and the second named with its line', r.cUnderB &&
        r.cFrom.length === 2 && r.cFrom[0] === 'merged' && r.cFrom[1] === 'Also from Alpha one — merged — and also',
        JSON.stringify(r.cFrom));
  check('a parent named twice is one parent', r.dFrom === 0, JSON.stringify(r.dFrom));
  check('and a link into the chart is a name that opens that entry', r.dSee === 'See Gamma' && r.dSeeId === 'tv_c', JSON.stringify([r.dSee, r.dSeeId]));
  eq('an edit while it is open is in it at once', r.renamed, 'Beta renamed');
  check('a name opens its entry and takes the reader to its panel', r.picked === 'tv_c' && r.closed && r.focusTitle === 'detailTitle',
        JSON.stringify([r.picked, r.closed, r.focusTitle]));
  check('on the drawing an entry is one image named in words', r.role === 'img' && r.label === 'Alpha one (tvtag)', JSON.stringify([r.role, r.label]));
  check('and frames and connectors are not read off it', r.arrayHidden === 'true' && r.edgesHidden === 'true', JSON.stringify([r.arrayHidden, r.edgesHidden]));
  /* The first key press reaches the way to the text, and Escape shuts it. */
  /* From the top of the page, as a reader arriving: focusing the body
     moves where the next Tab starts from. */
  await page.evaluate(()=>{ document.body.tabIndex = -1; document.body.focus(); });
  await page.keyboard.press('Tab');
  await page.evaluate(()=> document.body.removeAttribute('tabindex'));
  const first = await page.evaluate(()=> document.activeElement && document.activeElement.id);
  await page.keyboard.press('Enter');
  const viaSkip = await page.evaluate(()=> document.getElementById('textViewOverlay').classList.contains('open'));
  await page.keyboard.press('Escape');
  const shut = await page.evaluate(()=> !document.getElementById('textViewOverlay').classList.contains('open') &&
                                       document.getElementById('textViewToggle').getAttribute('aria-expanded') === 'false');
  check('the first Tab reaches the way to the text, and Enter takes it', first === 'skipToText' && viaSkip, JSON.stringify([first, viaSkip]));
  check('Escape shuts it like the other panels', shut);
  });
  await scenario("the contents as JSON, as the schema says", async () => {
  /* The open form of the chart: what Export as JSON writes is what
     src/site/chart.schema.json describes, and Import reads it back to the
     same chart. Checked on the chart the page opened with — the owner's —
     and on one that uses every kind of thing a chart can hold. */
  const Ajv = require('ajv');
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'site', 'chart.schema.json'), 'utf8'));
  const ajv = new Ajv({allErrors: true});
  const validate = ajv.compile(schema);
  const r = await page.evaluate(async ()=>{
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const out = {};
    try{
      out.owners = chartJsonText(chartJsonOf(chartDataOnly()));
      applyEdit(()=>{
        workingNodes.push(['js_a', 'A {{u:solid|thing}}', null, 'from', 'A note', null,
          {pos:[4000, 3000], tags:['x'], colors:['#cc2222'], bg:['#ffffff'], border:'dashed', square:true,
           langTabs:[{tag:'JP', text:'あ'}], multiLang:true, link:'https://example.com'}]);
        workingNodes.push(['js_b', 'B', 'js_a', null, null, 'callout', {pos:[4300, 3000], leader:{from:'js_a', to:'js_c', at:0.25, line:'dashed'}}]);
        workingNodes.push(['js_c', 'C', ['js_a', 'js_b'], null, null, null, {merge:true, bar:{k:'x', lead:40}}]);
        workingNodes.push(['js_d', 'Frame', null, null, null, 'array', {members:['js_a', 'js_b'], hatch:'vert'}]);
        workingNodes.push(['js_e', '', null, null, null, 'link', {pos:[4600, 3000], link:'#entry=js_a'}]);
        workingNodes.push(['js_f', '', 'js_a', null, null, 'split', {pos:[4700, 3000], colors:['#123456']}]);
        EDGE_STYLES.push({from:'js_a', to:'js_c', barEnd:'oout', openIn:true, arrowIn:true});
        // The merged arrow's own look: a style with no entry at its start.
        EDGE_STYLES.push({from:'', to:'js_c', color:'#7a3fb0', colorFixed:true, arrowIn:true});
        EDGE_STYLES.push({from:'js_a', to:'js_b', routing:'curve', dash:'dotted', arrow:true, arrowIn:true, openOut:true,
                          note:'on it', notePos:'on', noteAt:0.3, bends:[[4100, 2950]], bendSides:['right', 'left'],
                          color:'#123456', fromSide:'right', toSide:'left', fromRing:1, square:false});
      });
      const text = chartJsonText(chartJsonOf(chartDataOnly()));
      out.full = text;
      out.oneToALine = text.split('\n').filter(l=> /^    \{"id":/.test(l)).length === workingNodes.length;
      // As the page would write it: the same chart is the same file.
      const norm = ()=> chartDataOnly();
      const wanted = norm();
      applyEdit(()=>{ workingNodes.length = 0; workingNodes.push(['zz', 'Empty']); EDGE_STYLES.length = 0; });
      importChartFromText(text);
      out.back = norm() === wanted;
      if(!out.back){ const got = norm(); let i = 0; while(i < got.length && got[i] === wanted[i]) i++;
                     out.diff = [wanted.slice(Math.max(0, i - 120), i + 120), got.slice(Math.max(0, i - 120), i + 120)]; }
      const newer = JSON.parse(text); newer.format = DATA_FORMAT + 1;
      try{ importChartFromText(JSON.stringify(newer)); out.newer = 'taken'; }catch(e){ out.newer = e.message; }
      try{ importChartFromText('{"nodes": 3}'); out.notChart = 'taken'; }catch(e){ out.notChart = e.message; }
      const noEnd = JSON.parse(text); noEnd.edgeStyles.push({from: 'js_a', to: ''});
      try{ importChartFromText(JSON.stringify(noEnd)); out.noEnd = 'taken'; }catch(e){ out.noEnd = e.message; }
      try{ importChartFromText('{"nodes": ['); out.broken = 'taken'; }catch(e){ out.broken = e.message; }
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  const owners = JSON.parse(r.owners), full = JSON.parse(r.full);
  const okOwners = validate(owners), errsOwners = validate.errors;
  const okFull = validate(full), errsFull = validate.errors;
  check('the chart as JSON is what the schema describes', okOwners,
        JSON.stringify(errsOwners && errsOwners.slice(0, 3).map(e => [e.dataPath, e.message, JSON.stringify(e.dataPath.split(/[.[\]]+/).filter(Boolean).reduce((o, k) => o && o[k], owners))])));
  check('and so is one with every kind of thing a chart holds', okFull, JSON.stringify(errsFull && errsFull.slice(0, 3)));
  check('it names its schema and its form, at the top', full.$schema === 'https://cccarrrottt.github.io/chart.schema.json' &&
        full.format === 4 && !('format' in full.settings), JSON.stringify({s: full.$schema, f: full.format}));
  check('one entry to a line, so two exports compare line by line', r.oneToALine);
  check('Import reads it back to the same chart', r.back, JSON.stringify(r.diff));
  check('a JSON chart from a newer page is refused', /newer version/.test(r.newer), r.newer);
  check('and JSON that is not a chart, or does not parse, says so', /no Rhizome Project chart/.test(r.notChart) && /not a chart/.test(r.broken),
        JSON.stringify([r.notChart, r.broken]));
  check('a merged arrow\'s style, with no entry at its start, is read back, and a style with no end is not',
        r.back && JSON.parse(r.full).edgeStyles.some(st=> st.from === '' && st.to === 'js_c') && /needs the ids/.test(r.noEnd),
        r.noEnd);
  check('and the schema refuses what the page would refuse',
        !validate({format: 2, nodes: []}) && !validate({format: 2, nodes: [{id: 'a'}]}) &&
        !validate({format: 2, nodes: [{id: 'a', label: 'A', pos: [1]}]}) &&
        !validate({format: 2, nodes: [{id: 'a', label: 'A'}], edgeStyles: [{from: 'a', to: 'b', bends: [[1, 'x']]}]}) &&
        !validate({format: 2, nodes: [{id: 'a', label: 'A'}], edgeStyles: [{from: 'a', to: ''}]}));
  });
  await scenario("a chart that opens with a coloured tag and a picture from the web", async () => {
  /* Both are asked about while the first chart is built, in part 02 — and
     both used to be answered by a const of a later part, so the page threw
     before it drew anything. tools/tdz.js found them; this opens them. */
  const c = await browser.newContext({viewport:{width:1200, height:800}});
  await c.route('https://fonts.googleapis.com/**', r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await c.route('https://fonts.gstatic.com/**', r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await c.route('https://pictures.example/**', r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  await c.addInitScript(key => {
    try{ localStorage.setItem(key, JSON.stringify({v: 1, settings: {format: 2, tagColors: {coloured: '#cc2222'}},
      nodes: [['oa', 'Tagged', null, null, null, null, {tags: ['coloured'], pos: [0, 0]}],
              ['ob', 'Pictured', 'oa', null, null, 'ellipse', {image: 'https://pictures.example/p.png', pos: [300, 0]}]]})); }catch(e){}
  }, 'rhizome.chart:/' + PAGE);
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil: 'load'});
  const opened = await p.waitForFunction(() => typeof rebuildChart === 'function' && document.querySelectorAll('#nodeLayer .node').length === 2,
                                         null, {timeout: 8000}).then(() => true, () => false);
  const got = opened ? await p.evaluate(() => ({colour: nodes.get('oa').color, image: nodes.get('ob').image})) : null;
  check('a chart with a coloured tag and a picture from a web address opens, and draws both',
        opened && errs.length === 0 && got.colour === '#cc2222' && got.image === 'https://pictures.example/p.png',
        JSON.stringify({opened, errs, got}));
  await c.close();
  });
  await scenario("a chart edited by hand, and words that look like its markers", async () => {
  /* What a hand-edited file can hold that the editor never writes, and
     what a reader can type that looks like the file's own seams. */
  const r = await page.evaluate(async ()=>{
    const pause = ms => new Promise(ok => setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const out = {};
    const warned = [];
    const warn = console.warn;
    console.warn = (...a)=> { warned.push(a.join(' ')); };
    try{
      // Two entries under one name: the first is the entry.
      applyEdit(()=>{
        workingNodes.push(['hx_a', 'The first', null, null, null, null, {pos:[3000, 2000]}]);
        workingNodes.push(['hx_a', 'The second', null, null, null, null, {pos:[3400, 2400]}]);
      });
      await pause(50);
      const drawn = [...document.querySelectorAll('#nodeLayer .node')].filter(n=> n.dataset.id === 'hx_a');
      out.dupDrawn = drawn.length;
      out.dupFirst = nodes.get('hx_a').label === 'The first' && nodes.get('hx_a').pos.x === 3000;
      out.dupWarned = warned.some(w=> /"hx_a"/.test(w));
      const warnedOnce = warned.length;
      rebuildChart();
      out.dupWarnedOnce = warned.length === warnedOnce;
      applyEdit(()=>{ workingNodes.splice(workingNodes.length - 1, 1); });

      // Bends that are not points, and a position that is not a number.
      applyEdit(()=>{
        workingNodes.push(['hx_b', 'To', 'hx_a', null, null, null, {pos:[3300, 2000]}]);
        workingNodes.push(['hx_c', 'Nowhere', null, null, null, null, {pos:[NaN, 5]}]);
        EDGE_STYLES.push({from:'hx_a', to:'hx_b', routing:'orthogonal', dash:'solid', arrow:true,
                          bends:[[3150, 1950], [NaN, 4], {x: 1, y: 2}, [3200, 'x']]});
      });
      await pause(50);
      const route = drawnRoutes.get(calloutEdgeKey('hx_a', 'hx_b'));
      out.bendsKept = JSON.stringify(edgeStyleFor('hx_a', 'hx_b').bends);
      out.routeFinite = !!route && route.pts.every(p=> Number.isFinite(p.x) && Number.isFinite(p.y));
      out.posDropped = nodes.get('hx_c').pos === null;
      // Out again before the file is written: import refuses them, rightly.
      applyEdit(()=>{
        const hc = workingNodes.find(it=> it[0] === 'hx_c');
        hc[2] = 'hx_a'; hc[6] = {pos:[3300, 2300]};
        EDGE_STYLES.splice(EDGE_STYLES.findIndex(st=> st.from === 'hx_a' && st.to === 'hx_b'), 1);
      });

      // A note that quotes a region's marker is written so it cannot end the region.
      const quote = 'see /* @@EDIT:NODES:END@@ */ and @@@ too';
      applyEdit(()=>{ workingNodes.push(['hx_d', quote]); });
      const file = chartDataOnly();
      out.markers = (file.match(/@@EDIT:NODES:END@@/g) || []).length;
      const parts = writeChartParts();
      out.partsClean = Object.keys(parts).every(k=> parts[k].indexOf('@@EDIT:') < 0);
      applyEdit(()=>{ workingNodes.length = 0; workingNodes.push(['zz', 'Empty']); });
      importChartFromText(file);
      const back = workingNodes.find(it=> it[0] === 'hx_d');
      out.quoteBack = !!back && back[1] === quote;

      // The note's ground: switching notes with the field still focused is a second step.
      applyEdit(()=>{
        EDGE_STYLES.push({from:'hx_a', to:'hx_b', routing:'orthogonal', dash:'solid', arrow:true, note:'One'});
        EDGE_STYLES.push({from:'hx_a', to:'hx_c', routing:'orthogonal', dash:'solid', arrow:true, note:'Two'});
      });
      await pause(50);
      const field = document.querySelector('#styleBar [data-group="noteBg"] input');
      openStyleBar({kind:'note', from:'hx_a', to:'hx_b'});
      field.focus();
      field.value = '#ffeeaa'; field.dispatchEvent(new Event('input'));
      field.value = '#ffeebb'; field.dispatchEvent(new Event('input'));
      openStyleBar({kind:'note', from:'hx_a', to:'hx_c'});
      field.value = '#aaeeff'; field.dispatchEvent(new Event('input'));
      // One undo takes back the second note's ground and leaves the first's.
      undoLastEdit();
      const bgOf = (f, t)=> (EDGE_STYLES.find(st=> st.from === f && st.to === t) || {}).noteBg || null;
      out.afterUndo = [bgOf('hx_a', 'hx_b'), bgOf('hx_a', 'hx_c')];
      field.blur();
      closeStyleBar && closeStyleBar();
      // A note started on a plain connector is written with the connector's defaults.
      applyEdit(()=>{ for(let k = EDGE_STYLES.length - 1; k >= 0; k--) if(EDGE_STYLES[k].from === 'hx_a' && EDGE_STYLES[k].to === 'hx_b') EDGE_STYLES.splice(k, 1); });
      startEdgeNote('hx_a', 'hx_b');
      const raw = EDGE_STYLES.find(st=> st.from === 'hx_a' && st.to === 'hx_b');
      raw.note = 'A remark';
      out.plainNote = serializeEdgeStyles(EDGE_STYLES).split('\n').find(l=> l.includes("from:'hx_a', to:'hx_b'"));
      try{ closeNodeEditor(true); }catch(e){}
    } finally {
      console.warn = warn;
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    }
    return out;
  });
  check('of two entries under one name only the first is drawn, and it is the first one\'s',
        r.dupDrawn === 1 && r.dupFirst, JSON.stringify(r));
  check('and the console says so, once, not on every redraw', r.dupWarned && r.dupWarnedOnce);
  check('a bend that is not a pair of numbers is left out, and the route stays on the chart',
        r.bendsKept === '[[3150,1950]]' && r.routeFinite, r.bendsKept);
  check('a position that is not a number is no position', r.posDropped);
  check('a note quoting a region\'s marker is written without one, and reads back as typed',
        r.markers === 1 && r.partsClean && r.quoteBack, JSON.stringify({markers: r.markers, clean: r.partsClean, back: r.quoteBack}));
  check('a note started on a plain connector keeps the connector\'s line and arrow when written',
        !!r.plainNote && /routing:'orthogonal', dash:'solid', arrow:true/.test(r.plainNote) && !/undefined|arrow:null/.test(r.plainNote), r.plainNote);
  check('a note\'s ground typed into, then another note\'s, is two steps of undo, not one',
        r.afterUndo[0] === '#ffeebb' && r.afterUndo[1] === null, JSON.stringify(r.afterUndo));
  });
  await scenario("the owner's list of 23.10: words along a line, glow, moving pictures", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const beforeStickers = STICKERS.map(x=> Object.assign({}, x));
    /* Two frames each, four pixels square: a GIF, an animated WebP and an
       animated PNG, and a WebP and a PNG that hold still. */
    const GIF = 'data:image/gif;base64,R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBFAABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7';
    const WEBP = 'data:image/webp;base64,UklGRsQAAABXRUJQVlA4WAoAAAACAAAAAwAAAwAAQU5JTQYAAAAAAAAAAABBTk1GSgAAAAAAAAAAAAMAAAMAAMgAAAJWUDggMgAAADABAJ0BKgQABAABQCYloAADcAD+8ut///mwP/bz/wR6Af//0uD//pcH//S4P/SkAAAAQU5NRkYAAAAAAAAAAAADAAADAADIAAAAVlA4IC4AAAA0AQCdASoEAAQAAAAmJaAAA3AA/vtV4///S4P/+lwf/9Lg/9Lg//rV5Vesq6AA';
    const APNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAEAAAABAAAAAAAAAAAAAEABQAAXC5E3AAAABBJREFUeJxj/M+AAEwMRHEAM9EBBzqEPrgAAAAaZmNUTAAAAAEAAAAEAAAABAAAAAAAAAAAAAEABQAAx12uCAAAABhmZEFUAAAAAnicY2Rg+M8AA0wMSAA3BwAx0wEHhrHizAAAAABJRU5ErkJggg==';
    const STILL_WEBP = 'data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoEAAQAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=';
    const STILL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP8z4AATAxEcQAz0QEHOoQ+uAAAAABJRU5ErkJggg==';
    const out = {};
    const X = 31000, Y = 31000;
    applyEdit(()=>{
      workingNodes.push(['tw_a', 'Start', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['tw_b', 'Finish', 'tw_a', null, null, null, {pos:[X + 320, Y + 260]}]);
      workingNodes.push(['tw_c', 'A callout', null, null, null, 'callout', {pos:[X - 260, Y + 120], leader:{from:'tw_a', to:'tw_b', at:0.3}}]);
      workingNodes.push(['tw_i', '', null, null, null, 'image', {pos:[X + 600, Y], image: GIF}]);
      workingNodes.push(['tw_s', '', null, null, null, 'image', {pos:[X + 800, Y], image: STILL_PNG}]);
      workingNodes.push(['tw_p', 'Someone', null, null, 'A short life.', 'ellipse', {pos:[X + 600, Y + 300], image: APNG, bioCard:true}]);
      EDGE_STYLES.push({from:'tw_a', to:'tw_b', routing:'orthogonal', note:'фывфы along', noteAlong:true});
    });
    await wait(250);
    flyToNode('tw_a'); await wait(200);

    /* Along an elbowed line (the owner's screenshot, 23.10): every point of
       the words' path stands off the line, the words are whole letters
       over a ring drawn under them all, and the bar opens over the words. */
    const line = drawnLineOf('tw_a', 'tw_b');
    const off = (x, y)=>{
      let best = Infinity;
      for(let i = 1; i < line.length; i++){
        const a = line[i-1], b = line[i], dx = b.x - a.x, dy = b.y - a.y, L = dx*dx + dy*dy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x)*dx + (y - a.y)*dy) / L));
        best = Math.min(best, Math.hypot(a.x + dx*t - x, a.y + dy*t - y));
      }
      return best;
    };
    const g = document.querySelector('.edge-note[data-from="tw_a"][data-to="tw_b"]');
    const along = g && g.querySelector('.edge-note-along-path');
    if(along){
      const L = along.getTotalLength(), ds = [];
      for(let k = 0; k <= 40; k++){ const q = along.getPointAtLength(L * k / 40); ds.push(off(q.x, q.y)); }
      out.minOff = Math.round(Math.min(...ds) * 100) / 100;
    }
    const ring = g && g.querySelector('text.edge-note-along-ring');
    const word = g && g.querySelector('text.edge-note-along');
    out.ring = {ring: !!ring, word: !!word,
                under: !!(ring && word && (ring.compareDocumentPosition(word) & Node.DOCUMENT_POSITION_FOLLOWING)),
                same: !!(ring && word) && ring.textContent === word.textContent,
                offset: !!(ring && word) && ring.querySelector('textPath').getAttribute('startOffset') ===
                                            word.querySelector('textPath').getAttribute('startOffset'),
                wordStroke: word && getComputedStyle(word).stroke, ringFill: ring && getComputedStyle(ring).fill};
    openStyleBar({kind:'note', from:'tw_a', to:'tw_b'});
    await wait(50);
    if(word){
      const b = styleBar.getBoundingClientRect(), w = word.getBoundingClientRect();
      out.bar = {gap: Math.round(w.top - b.bottom), dx: Math.round(Math.abs(b.left - w.left)), shown: !styleBar.hidden};
    }
    closeStyleBar();

    /* Picked, a note glows with its connector; a callout's leader glows
       with the callout; a picture, and a portrait's card, glow with their
       entry. */
    const glows = (el)=> !!el && /drop-shadow/.test(getComputedStyle(el).filter);
    const hit = document.querySelector('.edge-hit[data-from="tw_a"][data-to="tw_b"]');
    if(hit){
      const hr = hit.getBoundingClientRect();
      hit.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:hr.left + 4, clientY:hr.top + 4}));
      await wait(150);
      const ng = document.querySelector('.edge-note[data-from="tw_a"][data-to="tw_b"]');
      out.noteGlows = glows(ng && ng.querySelector('text.edge-note-along'));
      closeEdgePopover(); await wait(80);
      out.noteLetGo = !document.querySelector('.edge-note.edge-picked');
    }
    selectNode('tw_c'); await wait(120);
    out.leaderGlows = glows(document.querySelector('.callout-leader[data-id="tw_c"] .leader-line'));
    selectNode('tw_i'); await wait(120);
    out.imageGlows = glows(document.querySelector('.node[data-id="tw_i"] > image'));
    out.leaderLetGo = !glows(document.querySelector('.callout-leader[data-id="tw_c"] .leader-line'));
    selectNode('tw_p'); await wait(120);
    out.cardGlows = glows(document.querySelector('.bio-card-g[data-id="tw_p"] > rect'));
    deselect(); await wait(80);
    out.cardLetGo = !glows(document.querySelector('.bio-card-g[data-id="tw_p"] > rect'));

    /* Which pictures move, from their own bytes. */
    out.moves = [GIF, WEBP, APNG, STILL_WEBP, STILL_PNG].map(pictureMoves).join();
    const bytes = (u)=> Uint8Array.from(atob(u.split(',')[1]), c=> c.charCodeAt(0));
    out.fileMoves = (await Promise.all([
      fileMoves(new File([bytes(WEBP)], 'a.webp', {type:'image/webp'})),
      fileMoves(new File([bytes(APNG)], 'a.png', {type:'image/png'})),
      fileMoves(new File([bytes(STILL_PNG)], 'b.png', {type:'image/png'}))])).join();
    out.keptWhole = (await stickerDataFromFile(new File([bytes(WEBP)], 'a.webp', {type:'image/webp'}), null, true)) === WEBP;

    /* The three ways are a player's buttons, over the picture while the
       pointer is on it — not a row of the style bar — and only on a
       picture that moves. */
    const anim = ()=> document.getElementById('picturePlayer');
    const pointAt = (id)=>{
      const im = document.querySelector('.node[data-id="' + id + '"] > image');
      const rr = im.getBoundingClientRect();
      const x = rr.left + rr.width / 2, y = rr.top + rr.height / 2;
      const target = document.elementFromPoint(x, y) || im;
      target.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, clientX:x, clientY:y}));
      return rr;
    };
    pointAt('tw_s'); await wait(50);
    out.stillOffered = !anim().hidden;
    out.notInBar = !styleBar.querySelector('[data-group="anim"]');
    const box = pointAt('tw_i'); await wait(50);
    out.offered = !anim().hidden;
    const pr = anim().getBoundingClientRect();
    // Centred on the picture's foot, inside it.
    out.overPicture = Math.abs((pr.left + pr.right) / 2 - (box.left + box.right) / 2) < 1.5 &&
                      pr.bottom <= box.bottom + 0.5 && pr.bottom > box.top;
    out.playLit = !!anim().querySelector('button.on[data-value="play"]');
    out.values = [...anim().querySelectorAll('button[data-value]')].map(b=> b.dataset.value).join();
    const href = ()=> document.querySelector('.node[data-id="tw_i"] > image').getAttribute('href');
    out.playing = href() === GIF;
    anim().querySelector('button[data-value="still"]').click();
    await wait(300);
    const rec = workingEntry('tw_i');
    out.stored = rec && entryOpts(rec.entry).anim === 'still' && nodes.get('tw_i').anim === 'still';
    out.stillDrawn = /^data:image\/png/.test(href() || '');
    out.stillLit = !!anim().querySelector('button.on[data-value="still"]');
    anim().querySelector('button[data-value="hover"]').click();
    await wait(300);
    out.hoverStill = /^data:image\/png/.test(href() || '');
    const img = document.querySelector('.node[data-id="tw_i"] > image');
    img.dispatchEvent(new PointerEvent('pointerover', {bubbles:true}));
    out.hoverPlays = href() === GIF;
    document.body.dispatchEvent(new PointerEvent('pointerover', {bubbles:true}));
    out.hoverStops = /^data:image\/png/.test(href() || '');
    anim().querySelector('button[data-value="play"]').click();
    await wait(200);
    out.backToPlay = href() === GIF && !('anim' in entryOpts(workingEntry('tw_i').entry));
    document.body.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, clientX:2, clientY:2}));
    await wait(400);
    out.playerGoes = anim().hidden;
    markReadOnly(); await wait(150);
    pointAt('tw_i'); await wait(50);
    out.readerNoPlayer = anim().hidden || getComputedStyle(anim()).display === 'none';
    markEditable(); await wait(200);
    closeStyleBar();

    /* A sticker moves, stands still or moves on hover too — chosen in its
       cell, written on its record, and kept through a file. */
    applyStickerEdit(()=> STICKERS.push({key:'tw-moving', name:'moving', src: WEBP}));
    applyEdit(()=> workingNodes.push(['tw_t', 'Look {{s:tw-moving}} here', null, null, null, null, {pos:[X, Y + 600]}]));
    await wait(200);
    renderStickerLibrary();
    const cellBtn = ()=> [...document.querySelectorAll('#stickerOverlay .sticker-cell')]
      .find(c=> c.querySelector('img') && c.querySelector('img').getAttribute('src') === WEBP);
    const cell = cellBtn();
    const ab = cell && cell.querySelector('.sticker-anim');
    out.cellOffers = !!ab && ab.dataset.value === 'play';
    if(ab) ab.click();
    await wait(300);
    const srec = STICKERS.find(x=> x.key === 'tw-moving');
    out.stickerStored = srec && srec.anim === 'still' && /anim:'still'/.test(serializeStickers(STICKERS));
    const glyph = document.querySelector('.node[data-id="tw_t"] image.sticker-glyph');
    out.stickerStill = !!glyph && glyph.dataset.anim === 'still' && /^data:image\/png/.test(glyph.getAttribute('href') || '');
    out.sanitized = JSON.stringify(sanitizeStickers([{key:'a', src: WEBP, anim:'hover'}, {key:'b', src: WEBP, anim:'sometimes'}]).map(x=> x.anim || null));

    /* Nothing between an array's border and the entries it holds is
       narrower than what a T-end leaves before an entry. */
    out.pad = Math.abs(arrayPad(nodes.get('tw_a')) - borderHalfOf(nodes.get('tw_a')) - TEE_GAP) < 1e-9;
    /* A portrait is called a Character wherever an entry's kind is named. */
    out.named = [document.querySelector('#editShapeInput option[value="ellipse"]').textContent,
                 NODE_STYLE_PICKS.find(x=> x.value === 'ellipse').label,
                 (KEY_MARKS.find(x=> x.key === 'shape:bio') || {}).name].join(' | ');
    /* The app's icons are the owner's R·P, a picture: the old drawn icon
       is gone from the manifest and from what the worker keeps. */
    const man = await fetch('site/manifest.webmanifest').then(x=> x.ok ? x.json() : null).catch(()=> null);
    const sw = await fetch('site/sw.js').then(x=> x.ok ? x.text() : '').catch(()=> '');
    out.icons = man ? man.icons.map(i=> i.src).join() : null;
    out.swSvg = /icon\.svg/.test(sw);

    /* An entry deleted while its bar stands over it takes the bar with it
       (the owner's report, 23.10), and undoing a picture's arrival with
       its menu open takes the menu. */
    applyEdit(()=> workingNodes.push(['tw_d', 'Doomed', null, null, null, null, {pos:[X + 300, Y - 200]}]));
    await wait(150);
    selectNode('tw_d'); openStyleBar({kind:'node', id:'tw_d'}); await wait(50);
    const barWas = !styleBar.hidden;
    deleteNode('tw_d'); await wait(150);
    out.barGoes = barWas && styleBar.hidden;
    applyEdit(()=> workingNodes.push(['tw_e', '', null, null, null, 'image', {pos:[X + 300, Y - 200]}]));
    await wait(150);
    openFreeMenu('tw_e'); await wait(50);
    const menuWas = freeMenu.classList.contains('open');
    undoLastEdit(); await wait(150);
    out.menuGoes = menuWas && !freeMenu.classList.contains('open') && !nodes.has('tw_e');

    applyStickerEdit(()=> refill(STICKERS, beforeStickers));
    applyEdit(()=>{ workingNodes = beforeNodes; refill(EDGE_STYLES, beforeStyles); });
    await wait(150);
    return out;
  });
  check('words along an elbowed line stand off it at every point', r.minOff >= 3, JSON.stringify(r.minOff));
  check('…written as whole letters over one ring drawn under them all',
        r.ring.ring && r.ring.word && r.ring.under && r.ring.same && r.ring.offset && r.ring.wordStroke === 'none' && r.ring.ringFill === 'none',
        JSON.stringify(r.ring));
  check('…and their bar opens just over the words, not far off where the line\'s box is',
        r.bar && r.bar.shown && r.bar.gap >= 0 && r.bar.gap < 40 && r.bar.dx < 80, JSON.stringify(r.bar));
  check('a picked connector\'s note glows with it, and lets go with it', r.noteGlows && r.noteLetGo, JSON.stringify([r.noteGlows, r.noteLetGo]));
  check('a picked callout\'s leader glows, and lets go when something else is picked', r.leaderGlows && r.leaderLetGo, JSON.stringify([r.leaderGlows, r.leaderLetGo]));
  check('a picked picture glows', r.imageGlows, String(r.imageGlows));
  check('a picked portrait\'s card glows, and lets go when nothing is picked', r.cardGlows && r.cardLetGo, JSON.stringify([r.cardGlows, r.cardLetGo]));
  check('a GIF, an animated WebP and an animated PNG are known to move, still ones are not',
        r.moves === 'true,true,true,false,false', r.moves);
  check('…a chosen file is asked the same, and one that moves is kept byte for byte',
        r.fileMoves === 'true,true,false' && r.keptWhole, r.fileMoves + ' ' + r.keptWhole);
  check('a picture that moves shows a player over itself under the pointer — moving, still, on hover — and one that cannot shows none',
        r.offered && r.overPicture && !r.stillOffered && r.values === 'play,still,hover' && r.playLit && r.playing,
        JSON.stringify([r.offered, r.overPicture, r.stillOffered, r.values, r.playLit, r.playing]));
  check('…and the style bar has no row for it any more', r.notInBar);
  check('…still is written on the entry, draws the first frame and lights its button',
        r.stored && r.stillDrawn && r.stillLit, JSON.stringify([r.stored, r.stillDrawn, r.stillLit]));
  check('…on hover it stands still until the pointer is on it, and stops when it leaves',
        r.hoverStill && r.hoverPlays && r.hoverStops, JSON.stringify([r.hoverStill, r.hoverPlays, r.hoverStops]));
  check('…and moving again is the absence of the field', r.backToPlay, String(r.backToPlay));
  check('…the player goes when the pointer leaves the picture, and a reader is never shown it',
        r.playerGoes && r.readerNoPlayer, JSON.stringify([r.playerGoes, r.readerNoPlayer]));
  check('a sticker that moves is offered the same in its cell, written on its record and drawn still',
        r.cellOffers && r.stickerStored && r.stickerStill, JSON.stringify([r.cellOffers, r.stickerStored, r.stickerStill]));
  check('…a sticker from a file keeps a way of moving it knows, and drops one it does not',
        r.sanitized === '["hover",null]', r.sanitized);
  check('an entry deleted under its style bar takes the bar with it', r.barGoes, String(r.barGoes));
  check('…and one undone with its menu open takes the menu', r.menuGoes, String(r.menuGoes));
  check('an array stands as far off its entries as a T-end does', r.pad, String(r.pad));
  check('a portrait is called a Character', r.named.split(' | ').every(x=> /^Character\b/.test(x)) && !/bio/i.test(r.named), r.named);
  check('the app\'s icons are pictures of the R·P, and the old drawn one is gone',
        r.icons && !/svg/.test(r.icons) && /icon-192\.png/.test(r.icons) && !r.swSvg, JSON.stringify({icons: r.icons, sw: r.swSvg}));
  });
  await scenario("a merge is made of connectors, not of an entry of its own", async () => {
  /* There is no amalgam entry any more: two connectors into one entry are
     merged from the connector's own menu, the entry they meet in becomes
     the merge, and every stretch of it is a connector with ends and paint
     of its own. A chart that still has the old kind opens as the new. */
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 52000, Y = 52000;
    try{
      /* The old kind: an 'amalgam' entry, with the colours the old editor
         used to store for it, opens as a box that merges. */
      const old = [['ol_a','A',null,null,null,null,{}], ['ol_b','B',null,null,null,null,{}],
                   ['ol_m','M',['ol_a','ol_b'],null,null,'amalgam',{colors:['#111111','#222222']}],
                   ['ol_s','Solo','ol_a',null,null,'amalgam',{colors:['#333333']}]];
      migrateAmalgams(old);
      out.migrated = old[2][5] === null && old[2][6].merge === true && !('colors' in old[2][6]) &&
                     old[3][5] === null && old[3][6].merge === true && old[3][6].colors[0] === '#333333';
      out.shapeGone = ![...document.querySelectorAll('#editShapeInput option')].some(o=> o.value === 'amalgam');

      applyEdit(()=>{
        workingNodes.push(['mg_a','A',null,null,null,null,{pos:[X, Y], colors:['#c23b22']}]);
        workingNodes.push(['mg_b','B',null,null,null,null,{pos:[X + 300, Y], colors:['#2f6fb5']}]);
        workingNodes.push(['mg_c','C',null,null,null,null,{pos:[X + 600, Y], colors:['#1d7a5f']}]);
        workingNodes.push(['mg_m','M',['mg_a','mg_b','mg_c'],null,null,null,{pos:[X + 300, Y + 300]}]);
        /* All three into the top: only lines into one port merge (the
           owner's list of 29.10), and A and C would come in by the sides. */
        ['mg_a', 'mg_b', 'mg_c'].forEach(f=> EDGE_STYLES.push({from: f, to: 'mg_m', routing:'orthogonal', dash:'solid', arrow:true, toSide:'top'}));
      });
      await wait(300);
      out.notYet = !isMergeNode(nodes.get('mg_m')) && mergeOffersFor('mg_a','mg_m').merge;
      /* Merged from the connector's menu, as a press-and-hold or a right
         click on it opens it. */
      openEdgeStylePopover('mg_a', 'mg_m', {clientX:400, clientY:300, stopPropagation(){}});
      openTouchMenu(400, 300, 'edge', true);
      const btn = [...touchMenu.querySelectorAll('button')].find(b=> b.dataset.act === 'merge' || /Merge/.test(b.textContent));
      out.menuOffers = !!btn && !btn.hidden;
      if(btn) btn.click();
      await wait(300);
      out.merged = isMergeNode(nodes.get('mg_m')) && document.querySelectorAll('.amalgam-out[data-to="mg_m"]').length === 1;
      out.allJoin = mergeMembersOf(nodes.get('mg_m')).length === 3;
      out.gradientBorder = /^url\(#/.test(document.querySelector('[data-id="mg_m"] > rect[stroke]').getAttribute('stroke') || '');

      /* Each stretch has ends of its own: one at its start, and one where
         it joins the bar; the merged arrow has both of its own too. */
      applyEdit(()=>{
        setEdgeStyleOverride('mg_a','mg_m', Object.assign({}, edgeStyleFor('mg_a','mg_m'), {arrowIn:true, barEnd:'out'}));
        setEdgeStyleOverride('mg_c','mg_m', Object.assign({}, edgeStyleFor('mg_c','mg_m'), {gradient:['#eeaa00','#1d7a5f']}));
        setEdgeStyleOverride('','mg_m', Object.assign({}, edgeStyleFor('','mg_m'), {arrowIn:true, teeIn:true, teeOut:true, color:'#7a3fb0', colorFixed:true}));
      });
      await wait(300);
      out.memberHeads = document.querySelectorAll('[data-from="mg_a"][data-to="mg_m"].edge-arrow, .edge-arrow[data-from="mg_a"][data-to="mg_m"]').length;
      const memberC = document.querySelector('.amalgam-member[data-from="mg_c"]');
      out.memberGradient = !!memberC && /^url\(#/.test(memberC.getAttribute('stroke') || '');
      const outPath = document.querySelector('.amalgam-out[data-to="mg_m"]');
      out.outColour = outPath && outPath.getAttribute('stroke');
      out.outHeads = document.querySelectorAll('.edge-arrow[data-from=""][data-to="mg_m"]').length;
      out.noBeadUnderHead = !document.querySelector('.amalgam-junction[data-to="mg_m"]') ||
                            !!edgeStyleFor('', 'mg_m').arrowIn;
      /* The style bar's end on a merged stretch is the head at the bar. */
      openStyleBar({kind:'edge', from:'mg_b', to:'mg_m'});
      await wait(100);
      const endOut = styleBar.querySelector('[data-group="endOut"] button[data-value="tout"]');
      out.barEndOffered = !!endOut && !endOut.disabled;
      if(endOut) endOut.click();
      await wait(250);
      out.barEndWritten = edgeStyleFor('mg_b','mg_m').barEnd === 'tout' && edgeStyleFor('mg_b','mg_m').arrow !== false;
      closeStyleBar();

      /* Unmerged the same way: one lineage leaves, the rest still merge;
         on the merged arrow, the whole merge goes. */
      unmergeEdge('mg_c','mg_m'); await wait(250);
      out.oneLeft = isMergeNode(nodes.get('mg_m')) && mergeMembersOf(nodes.get('mg_m')).length === 2 &&
                    Array.isArray(entryOpts(workingEntry('mg_m').entry).merge);
      unmergeEdge('','mg_m'); await wait(250);
      out.allGone = !isMergeNode(nodes.get('mg_m')) && !('merge' in entryOpts(workingEntry('mg_m').entry)) &&
                    !document.querySelector('.amalgam-out[data-to="mg_m"]');
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      refill(EDGE_STYLES, beforeStyles); });
      if(typeof closeTouchMenu === 'function') closeTouchMenu();
      closeEdgePopover();
      await wait(200);
    }
    return out;
  });
  check('an amalgam saved before opens as an entry that merges, keeping a colour only where it had one lineage',
        r.migrated && r.shapeGone, JSON.stringify({m:r.migrated, s:r.shapeGone}));
  check('two connectors into one entry are merged from the connector’s menu',
        r.notYet && r.menuOffers && r.merged && r.allJoin, JSON.stringify({n:r.notYet, o:r.menuOffers, m:r.merged, a:r.allJoin}));
  check('the entry they meet in wears their colours as a gradient', r.gradientBorder);
  check('a merged stretch has ends, and a gradient, of its own',
        r.memberHeads >= 2 && r.memberGradient, JSON.stringify({heads:r.memberHeads, grad:r.memberGradient}));
  check('the merged arrow takes a colour and both ends of its own',
        r.outColour === '#7a3fb0' && r.outHeads >= 2 && r.noBeadUnderHead,
        JSON.stringify({c:r.outColour, h:r.outHeads}));
  check('the style bar’s end on a merged stretch is the head at the bar',
        r.barEndOffered && r.barEndWritten);
  check('unmerging one lineage keeps the others merged, and on the merged arrow ends the merge',
        r.oneLeft && r.allGone, JSON.stringify({one:r.oneLeft, all:r.allGone}));
  });
  await scenario("the owner's list of 23.10, evening: the toolbar, words along a line, arrays", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 74000, Y = 74000;
    try{
      /* Undo, redo, the guides and the hops (22.11, night): small, on the
         toolbar's second row under the first (the owner's sketch of 22.11), for whoever edits —
         a mouse included — and for nobody else. */
      const first = document.getElementById('themeToggle').getBoundingClientRect();
      const tools = [...document.querySelectorAll('.topbar-tools button')].map(b=> b.getBoundingClientRect());
      out.toolsUnderCounts = tools.length === 4 && tools.every(t=> t.top >= first.bottom - 0.5 && t.height > 0 && t.height <= 28) &&
                             !!document.querySelector('.topbar-tools').closest('#toolRow');
      out.inTopbar = !!document.getElementById('guideToggle').closest('.topbar') &&
                     !!document.getElementById('touchTools').closest('.topbar');
      markReadOnly(); await wait(150);
      out.readerNoTools = getComputedStyle(document.querySelector('.topbar-tools')).display === 'none';
      markEditable(); await wait(200);

      /* Words along a line stay level with the point they ride on when
         the side is changed: the copy of the line above an elbow is not
         as long as the one below it. */
      applyEdit(()=>{
        workingNodes.push(['ev_a','From',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['ev_b','To','ev_a',null,null,null,{pos:[X + 420, Y + 120]}]);
        EDGE_STYLES.push({from:'ev_a', to:'ev_b', routing:'orthogonal', dash:'solid', arrow:true,
                          note:'along here', noteAt:0.75, noteAlong:true});
      });
      await wait(300);
      // An edit made with a mouse lights undo, with no touch in between.
      out.undoLit = !document.querySelector('#touchTools [data-act="undo"]').disabled;
      const centreAt = async (pos)=>{
        applyEdit(()=>{ EDGE_STYLES.find(s=> s.from === 'ev_a' && s.to === 'ev_b').notePos = pos; });
        await wait(250);
        const t = document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along');
        const b = t.getBoundingClientRect();
        return (b.left + b.right) / 2;
      };
      const xs = [await centreAt('above'), await centreAt('on'), await centreAt('below')];
      out.sideXs = xs.map(v=> +v.toFixed(1));
      out.levelAcrossSides = Math.max(...xs) - Math.min(...xs) < 1.5;
      /* Framed as a level note is, by the one flag both read (the owner's
         list of 3.11: the frame button answered to the mode, and turning
         the words level took a frame set along the line away). */
      out.unframedByDefault = !!document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along-frame');

      /* …and the style bar's frame button takes it off and puts it back,
         a band that bends with the words. */
      openStyleBar({kind:'note', from:'ev_a', to:'ev_b'}); await wait(80);
      const frameBtn = styleBar.querySelector('[data-group="frame"] button[data-value="frame"]');
      out.frameOffered = !!frameBtn && !frameBtn.disabled;
      if(frameBtn) frameBtn.click();
      await wait(250);
      const bare = edgeStyleFor('ev_a','ev_b').noteFrame === false &&
                   !document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along-frame');
      out.savedBare = /noteFrame:false/.test(serializeEdgeStyles ? serializeEdgeStyles(EDGE_STYLES) : chartDataOnly());
      if(frameBtn) frameBtn.click();
      await wait(250);
      out.frameStored = bare && edgeStyleFor('ev_a','ev_b').noteFrame !== false;
      const frame = document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along-frame');
      const ground = document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along-ground');
      out.frameDrawn = !!frame && !!ground && +frame.getAttribute('stroke-width') > +ground.getAttribute('stroke-width');
      if(frame){
        const t = document.querySelector('.edge-note[data-from="ev_a"] .edge-note-along').getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        out.frameRoundWords = f.left <= t.left + 0.5 && f.right >= t.right - 0.5;
      }
      const cornersBtn = styleBar.querySelector('[data-group="corners"] button');
      out.cornersOffered = !!cornersBtn && !cornersBtn.disabled;
      out.savedAsSuch = out.savedBare;
      closeStyleBar();
      // The face of the button is drawn as the font draws its arrows.
      const glyph = styleBar.querySelector('[data-group="noteAlong"] svg');
      out.glyphThin = !!glyph && +glyph.getAttribute('stroke-width') <= 1.4 && glyph.getAttribute('stroke-linecap') === 'round';

      /* An entry in an array is not connected to the array, nor the array
         to it; a cross at the pointer says so while the connector is
         aimed, and letting go there connects nothing. */
      applyEdit(()=>{
        workingNodes.push(['ev_m','Member',null,null,null,null,{pos:[X, Y + 500]}]);
        workingNodes.push(['ev_o','Outsider',null,null,null,null,{pos:[X + 600, Y + 500]}]);
        workingNodes.push(['ev_r','Frame',null,null,null,'array',{members:['ev_m']}]);
      });
      await wait(350);
      out.refusals = [connectRefusal('ev_m','ev_r'), connectRefusal('ev_r','ev_m'), connectRefusal('ev_o','ev_r'),
                      connectRefusal('ev_a','ev_b')].map(x=> x ? 'no' : 'yes').join();
      const rv = svg.getBoundingClientRect();
      vs = 1; vx = rv.width / 2 - (X + 300); vy = rv.height / 2 - (Y + 500); applyTransform();
      await wait(200);
      const m = nodes.get('ev_m');
      beginConnectorDrag({button:0, stopPropagation(){}, preventDefault(){}}, m, 'right', 0);
      // Onto the array's frame, clear of the member inside it.
      const ra = nodes.get('ev_r');
      const toClient = (x, y)=> ({x: rv.left + vx + x * vs, y: rv.top + vy + y * vs});
      const onFrame = toClient(ra.x + 1.5, ra.y + ra.h / 2);
      const hitEl = document.elementFromPoint(onFrame.x, onFrame.y);
      out.aimedAtArray = !!(hitEl && hitEl.closest && hitEl.closest('.node[data-id="ev_r"]'));
      window.dispatchEvent(new MouseEvent('mousemove', {clientX:onFrame.x, clientY:onFrame.y, bubbles:true}));
      await wait(60);
      const mark = document.querySelector('.connector-refused');
      out.crossShown = !!mark && mark.style.display !== 'none';
      out.notLit = !document.querySelector('.node[data-id="ev_r"].connect-target');
      window.dispatchEvent(new MouseEvent('mouseup', {clientX:onFrame.x, clientY:onFrame.y, bubbles:true}));
      await wait(250);
      out.notConnected = !(nodes.get('ev_r').parents || []).includes('ev_m');
      out.crossGone = mark.style.display === 'none';
      // An entry it may join takes no cross.
      beginConnectorDrag({button:0, stopPropagation(){}, preventDefault(){}}, m, 'right', 0);
      const o = nodes.get('ev_o');
      const onOut = toClient(o.x + o.w / 2, o.y + o.h / 2);
      window.dispatchEvent(new MouseEvent('mousemove', {clientX:onOut.x, clientY:onOut.y, bubbles:true}));
      await wait(60);
      out.noCrossOnAllowed = mark.style.display === 'none';
      window.dispatchEvent(new MouseEvent('mouseup', {clientX:onOut.x, clientY:onOut.y, bubbles:true}));
      await wait(250);
      out.allowedConnects = (nodes.get('ev_o').parents || []).includes('ev_m');
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      refill(EDGE_STYLES, beforeStyles); });
      closeStyleBar();
      await wait(200);
    }
    return out;
  });
  check('undo, redo and the guides are small buttons on the toolbar\'s second row',
        r.toolsUnderCounts && r.inTopbar, JSON.stringify({under:r.toolsUnderCounts, bar:r.inTopbar}));
  check('…and a reader has none of them', r.readerNoTools);
  check('…and undo lights after an edit made with a mouse', r.undoLit);
  check('words along a line stay level with their point when moved above, onto or below it',
        r.levelAcrossSides, JSON.stringify(r.sideXs));
  check('words along a line are framed as level ones are, and the frame button takes off and puts back a band that bends with them',
        r.unframedByDefault && r.frameOffered && r.frameStored && r.frameDrawn && r.frameRoundWords && r.cornersOffered && r.savedAsSuch,
        JSON.stringify({bare:r.unframedByDefault, offered:r.frameOffered, stored:r.frameStored, drawn:r.frameDrawn,
                        round:r.frameRoundWords, corners:r.cornersOffered, saved:r.savedAsSuch}));
  check('the along-the-line button is drawn as the bar’s other arrows are', r.glyphThin);
  check('an entry in an array cannot be connected to the array, nor the array to it',
        r.refusals === 'no,no,yes,no', r.refusals);
  check('a connector aimed where it cannot end shows a cross, and letting go there connects nothing',
        r.aimedAtArray && r.crossShown && r.notLit && r.notConnected && r.crossGone,
        JSON.stringify({aimed:r.aimedAtArray, cross:r.crossShown, unlit:r.notLit, none:r.notConnected, gone:r.crossGone}));
  check('…and aimed where it can, no cross, and it connects', r.noCrossOnAllowed && r.allowedConnects);

  /* The guides button means Shift to a mouse too: a carry made with it lit
     is offered the guides. Real mouse events, since the stand-in is only
     made for those. */
  const g = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    window.__evBefore = workingNodes.map(x=> x.slice());
    applyEdit(()=>{
      workingNodes.push(['ev_g1','Anchor',null,null,null,null,{pos:[76000, 76000]}]);
      workingNodes.push(['ev_g2','Mover',null,null,null,null,{pos:[76300, 76200]}]);
    });
    await wait(300);
    const rv = svg.getBoundingClientRect();
    vs = 1; vx = rv.width / 2 - 76150; vy = rv.height / 2 - 76100; applyTransform();
    await wait(200);
    document.getElementById('guideToggle').click();
    const n = nodes.get('ev_g2'), a = nodes.get('ev_g1');
    return {from: {x: rv.left + vx + n.x + n.w / 2, y: rv.top + vy + n.y + n.h / 2},
            to: {x: rv.left + vx + a.x + a.w / 2 + 2, y: rv.top + vy + n.y + n.h / 2 + 60}};
  });
  await page.mouse.move(g.from.x, g.from.y);
  await page.mouse.down();
  for(let i = 1; i <= 10; i++){
    await page.mouse.move(g.from.x + (g.to.x - g.from.x) * i / 10, g.from.y + (g.to.y - g.from.y) * i / 10);
    await new Promise(ok=> setTimeout(ok, 20));
  }
  const guided = await page.evaluate(()=> document.querySelectorAll('#guideLayer .align-guide, .align-guide').length);
  await page.mouse.up();
  await page.evaluate(async ()=>{
    document.getElementById('guideToggle').click();
    applyEdit(()=>{ workingNodes.length = 0; window.__evBefore.forEach(x=> workingNodes.push(x)); });
    await new Promise(ok=> setTimeout(ok, 200));
  });
  check('the guides button stands in for Shift under a mouse too', guided > 0, String(guided));
  });
  await scenario("the owner's list of 24.10: connector ends, merges, picks and a link node", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 78000, Y = 78000;
    const overlap = (a, b)=> a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    try{
      applyEdit(()=>{
        workingNodes.push(['tf_a','A',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['tf_b','B','tf_a',null,null,null,{pos:[X + 400, Y + 160]}]);
        workingNodes.push(['tf_c','C','tf_a',null,null,null,{pos:[X + 400, Y + 360]}]);
        workingNodes.push(['tf_p','P',null,null,null,null,{pos:[X, Y + 700], colors:['#c23b22']}]);
        workingNodes.push(['tf_q','Q',null,null,null,null,{pos:[X + 300, Y + 700], colors:['#2f6fb5']}]);
        workingNodes.push(['tf_r','R',null,null,null,null,{pos:[X + 600, Y + 700], colors:['#1d7a5f']}]);
        workingNodes.push(['tf_m','M',['tf_p','tf_q','tf_r'],null,null,null,{pos:[X + 300, Y + 1000], merge:true}]);
        workingNodes.push(['tf_l','',null,null,null,'link',{pos:[X - 300, Y], link:'#entry=tf_r'}]);
        workingNodes.push(['tf_n','',null,null,null,'link',{pos:[X - 300, Y + 100]}]);
      });
      await wait(350);
      flyToNode('tf_b'); await wait(250);

      /* 1. A menu of the bar opened over a connector's panel is above
         the panel, so what it lists can be pressed. */
      const hitB = document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_b"]');
      const hb = hitB.getBoundingClientRect();
      hitB.dispatchEvent(new MouseEvent('click', {clientX: hb.left + hb.width / 2, clientY: hb.top + hb.height / 2, bubbles:true}));
      await wait(150);
      openStyleBar({kind:'edge', from:'tf_a', to:'tf_b', x: hb.left + hb.width / 2, y: hb.top + hb.height / 2}); await wait(100);
      const face = styleBar.querySelector('[data-group="endOut"] .style-bar-drop-face');
      if(face) face.click();
      await wait(80);
      out.dropping = styleBar.classList.contains('dropping') &&
                     +getComputedStyle(styleBar).zIndex > +getComputedStyle(edgePopover).zIndex;
      const oout = styleBar.querySelector('[data-group="endOut"] button[data-value="oout"]');
      out.openOffered = !!oout && !!styleBar.querySelector('[data-group="endIn"] button[data-value="oin"]');
      if(oout){
        const b = oout.getBoundingClientRect();
        const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        out.pressable = !!at && (at === oout || oout.contains(at));
        if(!out.pressable) out.atInstead = [at && (at.id || at.className.baseVal || at.className), b.left, b.top, styleBar.getBoundingClientRect().top];
        oout.click();
      }
      await wait(250);
      /* An open head: drawn as a stroke, saved as such, and the line
         reaches into it rather than stopping at a filled head's base. */
      out.openStored = edgeStyleFor('tf_a','tf_b').openOut === true && /openOut:true/.test(chartDataOnly());
      const head = document.querySelector('.edge-arrow.edge-open[data-from="tf_a"][data-to="tf_b"]');
      out.openDrawn = !!head && head.querySelector('path') && head.querySelector('path').getAttribute('fill') === 'none';
      closeStyleBar();
      closeEdgePopover();

      /* 3. Shift picks a second connector beside the first: a change and
         Delete do both, in one step of undo. */
      const hitC = document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_c"]');
      const hc = hitC.getBoundingClientRect();
      const hitB2 = document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_b"]');
      const hb2 = hitB2.getBoundingClientRect();
      hitB2.dispatchEvent(new MouseEvent('click', {clientX: hb2.left + hb2.width / 2, clientY: hb2.top + hb2.height / 2, bubbles:true}));
      await wait(100);
      hitC.dispatchEvent(new MouseEvent('click', {clientX: hc.left + hc.width / 2, clientY: hc.top + hc.height / 2, shiftKey:true, bubbles:true}));
      await wait(150);
      out.picked = edgeSelection.size === 2 && edgePopover.classList.contains('open');
      openStyleBar({kind:'edge', from:'tf_a', to:'tf_c'}); await wait(100);
      const dashed = styleBar.querySelector('[data-group="edgeLine"] button[data-value="dashed"]');
      if(dashed) dashed.click();
      await wait(250);
      out.bothDashed = edgeStyleFor('tf_a','tf_b').dash === 'dashed' && edgeStyleFor('tf_a','tf_c').dash === 'dashed';
      closeStyleBar();
      const hitC2 = document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_c"]');
      const hc2 = hitC2.getBoundingClientRect();
      if(!edgeSelection.size){
        hitC2.dispatchEvent(new MouseEvent('click', {clientX: hc2.left + hc2.width / 2, clientY: hc2.top + hc2.height / 2, bubbles:true}));
        const hb3 = document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_b"]').getBoundingClientRect();
        document.querySelector('.edge-hit[data-from="tf_a"][data-to="tf_b"]').dispatchEvent(new MouseEvent('click',
          {clientX: hb3.left + hb3.width / 2, clientY: hb3.top + hb3.height / 2, shiftKey:true, bubbles:true}));
        await wait(150);
      }
      out.stillPicked = edgeSelection.size === 2;
      deleteOpenConnector();
      await wait(250);
      out.bothGone = !(nodes.get('tf_b').parents || []).includes('tf_a') && !(nodes.get('tf_c').parents || []).includes('tf_a');
      out.letGo = edgeSelection.size === 0;
      // One undo brings both back: they went as one step.
      undoLastEdit(); await wait(250);
      out.oneStep = (nodes.get('tf_b').parents || []).includes('tf_a') && (nodes.get('tf_c').parents || []).includes('tf_a');

      /* 2. On a merged stretch, the head at the bar stands at the end of
         the stretch, clear of every bead, and the line stops under it
         rather than showing through it. */
      applyEdit(()=>{
        setEdgeStyleOverride('tf_p','tf_m', Object.assign({}, edgeStyleFor('tf_p','tf_m'), {barEnd:'out', color:'#22cc2288', colorFixed:true}));
      });
      await wait(300);
      flyToNode('tf_m'); await wait(250);
      const barHead = [...document.querySelectorAll('.edge-arrow[data-from="tf_p"][data-to="tf_m"]')].pop();
      const beads = [...document.querySelectorAll('.amalgam-bead')].map(b=> b.getBoundingClientRect());
      out.barHead = !!barHead;
      if(barHead){
        const hr = barHead.getBoundingClientRect();
        out.clearOfBeads = beads.every(b=> !overlap(b, hr));
        const member = document.querySelector('.amalgam-member[data-from="tf_p"]');
        if(member){
          const L = member.getTotalLength();
          const ends = [member.getPointAtLength(0), member.getPointAtLength(L)];
          const m = member.getScreenCTM();
          const inHead = ends.map(p=> new DOMPoint(p.x, p.y).matrixTransform(m))
                             .filter(p=> p.x > hr.left + 1 && p.x < hr.right - 1 && p.y > hr.top + 1 && p.y < hr.bottom - 1);
          const c = {x:(hr.left + hr.right) / 2, y:(hr.top + hr.bottom) / 2};
          // An end that does fall in the head is at its base, not past its middle to the tip.
          out.lineUnderHead = inHead.every(p=> Math.hypot(p.x - c.x, p.y - c.y) >= Math.min(hr.width, hr.height) * 0.2);
        }
      }

      /* 7. Selecting an outer parent lights the whole way to the merged
         arrow, through the seams, beads included. */
      selectNode('tf_p'); await wait(200);
      const through = [...document.querySelectorAll('.amalgam-through[data-from="tf_p"]')];
      out.throughLit = through.length > 0 && through.every(p=> p.classList.contains('lit'));
      const out_ = document.querySelector('.amalgam-out[data-to="tf_m"]');
      out.outLit = !!out_ && out_.classList.contains('lit');
      out.viaLit = [...document.querySelectorAll('.amalgam-joint[data-via~="tf_p"]')].every(b=> !b.classList.contains('dim'));
      // Hidden again once let go, when the fade a selection change takes is over.
      deselect(); await wait(700);
      out.throughHidden = through.every(p=> !document.contains(p) || getComputedStyle(p).opacity === '0');

      /* …the merged arrow has a style bar and bends of its own, and the
         merge's colour field shows the colours it inherits. */
      openStyleBar({kind:'edge', from:'', to:'tf_m'}); await wait(100);
      out.mergedBar = !styleBar.hidden && !!styleBar.querySelector('[data-group="edgeLine"]') &&
                      !!styleBar.querySelector('[data-group="corners"]');
      closeStyleBar();
      out.mergedPort = mergedArrowPorts.has('tf_m');
      out.inherited = drawnColorText(nodes.get('tf_m'));
      out.inheritedWant = amalgamInheritedColors(nodes.get('tf_m')).join(', ');

      /* 8. A link node: half a portrait, round, an arrow, and it goes
         where it points once a double click is plainly not coming. */
      const ln = nodes.get('tf_l');
      out.linkSize = [ln.w, ln.h];
      out.linkArrow = !!document.querySelector('.node[data-id="tf_l"] .link-node-arrow:not(.nowhere)') &&
                      !!document.querySelector('.node[data-id="tf_n"] .link-node-arrow.nowhere');
      out.linkTarget = (linkNodeTarget(ln) || {}).id;
      out.bareId = (linkNodeTarget(Object.assign({}, ln, {link:'tf_q'})) || {}).id;
      out.notItself = linkNodeTarget(Object.assign({}, ln, {link:'tf_l'})) == null;
      out.names = [textViewName(ln), textViewName(nodes.get('tf_n'))];
      flyToNode('tf_l'); await wait(250);
      const lg = document.querySelector('.node[data-id="tf_l"]');
      const lr = lg.getBoundingClientRect();
      lg.dispatchEvent(new MouseEvent('click', {clientX: lr.left + lr.width / 2, clientY: lr.top + lr.height / 2, bubbles:true}));
      /* (the owner's list of 2.11) one click picks it, two go. */
      await wait(DOUBLE_CLICK_GRACE + 150);
      out.notAtOnce = selectedId === 'tf_l';
      lg.dispatchEvent(new MouseEvent('dblclick', {clientX: lr.left + lr.width / 2, clientY: lr.top + lr.height / 2, bubbles:true}));
      await wait(150);
      out.went = selectedId === 'tf_r';
      deselect();
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      refill(EDGE_STYLES, beforeStyles); });
      closeStyleBar();
      closeEdgePopover();
      await wait(200);
    }
    return out;
  });
  check('a style bar menu opened over a connector’s panel stands above it, and what it lists can be pressed',
        r.dropping && r.pressable, JSON.stringify({d:r.dropping, p:r.pressable, at:r.atInstead}));
  check('either end of a connector may be an open arrowhead, drawn as a stroke and saved as such',
        r.openOffered && r.openStored && r.openDrawn, JSON.stringify({o:r.openOffered, s:r.openStored, d:r.openDrawn}));
  check('Shift picks a second connector, and a change from the bar is made to both',
        r.picked && r.bothDashed, JSON.stringify({p:r.picked, d:r.bothDashed}));
  check('…and Delete removes every picked connector in one step of undo, letting the picks go',
        r.stillPicked && r.bothGone && r.oneStep && r.letGo,
        JSON.stringify({s:r.stillPicked, g:r.bothGone, o:r.oneStep, l:r.letGo}));
  check('a head at the bar stands clear of every bead, with the line stopped under it',
        r.barHead && r.clearOfBeads && r.lineUnderHead, JSON.stringify({h:r.barHead, c:r.clearOfBeads, u:r.lineUnderHead}));
  check('a selected parent of a merge lights the whole way to the merged arrow',
        r.throughLit && r.outLit && r.viaLit && r.throughHidden,
        JSON.stringify({t:r.throughLit, o:r.outLit, v:r.viaLit, h:r.throughHidden}));
  check('the merged arrow has a style bar and a route of its own', r.mergedBar && r.mergedPort,
        JSON.stringify({b:r.mergedBar, p:r.mergedPort}));
  check('a merge’s colour field shows the colours it inherits',
        !!r.inheritedWant && r.inherited === r.inheritedWant, JSON.stringify([r.inherited, r.inheritedWant]));
  check('a link node is half a portrait across, with an arrow, faint while it goes nowhere',
        r.linkSize[0] === 18 && r.linkSize[1] === 18 && r.linkArrow, JSON.stringify(r.linkSize));
  check('…it points by a link or a bare id, never at itself, and the text view says where',
        r.linkTarget === 'tf_r' && r.bareId === 'tf_q' && r.notItself &&
        r.names[0] === 'Link to R' && r.names[1] === 'Link to nowhere', JSON.stringify(r.names));
  check('…and a click on it picks it up, and a double click goes there', r.notAtOnce && r.went);

  /* 5, 6 and 9: the picture player, a picture in the dark while the view
     moves, and a sticker in the in-entry field. */
  const p = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const GIF = 'data:image/gif;base64,R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBFAABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7';
    const out = {};
    const X = 80000, Y = 80000;
    const theme = document.documentElement.dataset.theme;
    try{
      applyEdit(()=>{
        workingNodes.push(['tg_i','',null,null,null,'image',{pos:[X, Y], image: GIF, size:[200, 200]}]);
        workingNodes.push(['tg_t','Some words',null,null,null,null,{pos:[X + 400, Y]}]);
      });
      await wait(300);
      const rv = svg.getBoundingClientRect();
      vs = 1; vx = rv.width / 2 - (X + 100); vy = rv.height / 2 - (Y + 100); applyTransform();
      await wait(150);
      openPicturePlayer('tg_i'); await wait(60);
      const before = picturePlayer.getBoundingClientRect();
      vx += 40; applyTransform(); await wait(60);
      const after = picturePlayer.getBoundingClientRect();
      out.follows = !picturePlayer.hidden && Math.abs(after.left - before.left - 40) < 1;
      vs = 0.7; applyTransform(); await wait(60);
      const small = picturePlayer.getBoundingClientRect();
      out.shrinks = !picturePlayer.hidden && Math.abs(small.width - after.width * 0.7) < 1;
      vs = 0.1; applyTransform(); await wait(60);
      out.closedSmall = picturePlayer.hidden;
      vs = 1; vx = rv.width / 2 - (X + 100); vy = rv.height / 2 - (Y + 100); applyTransform();
      await wait(100);

      document.documentElement.dataset.theme = 'dark';
      document.body.classList.add('touch-input', 'view-moving');
      await wait(50);
      const img = document.querySelector('.node[data-id="tg_i"] > image');
      out.darkMoving = img ? getComputedStyle(img).filter : 'none';
      document.body.classList.remove('view-moving');
      out.darkStill = img ? getComputedStyle(img).filter : 'none';
      document.body.classList.remove('touch-input');

      openNodeEditor('tg_t'); await wait(150);
      const surface = richFields.get('nodeEditorText').surface;
      const s = document.createElement('img');
      s.className = 'sticker-inline';
      s.src = GIF;
      surface.appendChild(s);
      await wait(50);
      const fs = parseFloat(getComputedStyle(surface).fontSize);
      out.stickerEm = +(s.getBoundingClientRect().height / fs).toFixed(2);
      s.remove();
      closeNodeEditor && closeNodeEditor(false);
    } finally {
      if(theme == null) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
      document.body.classList.remove('touch-input', 'view-moving');
      closePicturePlayer();
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x)); });
      await wait(200);
    }
    return out;
  });
  check('a moving picture’s player follows the view, shrinks with the chart, and goes when too small to press',
        p.follows && p.shrinks && p.closedSmall, JSON.stringify(p));
  check('in the dark a picture keeps its colours while the view moves under a finger',
        /invert/.test(p.darkMoving) && p.darkMoving === p.darkStill, JSON.stringify([p.darkMoving, p.darkStill]));
  check('a sticker in the in-entry field is the height it is in the entry', p.stickerEm > 0.6 && p.stickerEm < 0.9,
        String(p.stickerEm));

  /* 4. On a phone, undo, redo and the guides start the second toolbar,
     the bar's last row and its whole width, and the sign-in button,
     which the site always shows, is on the row above it (the owner's
     word of 22.11). */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    const ph = await pp.evaluate(()=>{
      document.getElementById('ownerBtn').hidden = false;
      const sb = document.getElementById('ownerBtn').getBoundingClientRect();
      const tools = document.querySelector('.topbar-tools').getBoundingClientRect();
      const bar = document.querySelector('.topbar').getBoundingClientRect();
      const row = document.getElementById('toolRow').getBoundingClientRect();
      const out = {sameRow: tools.height > 0 && tools.top >= row.top - 0.5 && tools.bottom <= row.bottom + 0.5 && sb.bottom <= row.top + 0.5 &&
                            Math.abs(row.bottom - bar.bottom) < 2 && row.width >= bar.width - 1 && getComputedStyle(document.getElementById('toolRow')).borderTopStyle === 'solid',
                   leftOfIt: tools.left - row.left < 14 && tools.left >= row.left, fits: bar.right <= innerWidth + 0.5 && row.right <= innerWidth + 0.5,
                   tools:[tools.left, tools.top, tools.right, tools.bottom].map(Math.round),
                   sign:[sb.left, sb.top, sb.right, sb.bottom].map(Math.round)};
      document.getElementById('ownerBtn').hidden = true;
      return out;
    });
    check('on a phone the tools are a second toolbar, the bar\'s last row, undo first, the sign-in button above it', ph.sameRow && ph.leftOfIt && ph.fits,
          JSON.stringify(ph));
  } finally {
    await phone.close();
  }
  });
  await scenario("the owner's list of 24.10, evening: drawers that rise, a bar that steps aside, splits", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 82000, Y = 82000;
    try{
      /* A drawer rises out of its tab as it opens. */
      const tags = document.getElementById('tagsPanel');
      setSideTab(tags, true);
      out.rises = getComputedStyle(tags.querySelector('.side-tab-body')).animationName === 'side-tab-rise';
      // …and goes back into it as it shuts, and is gone once it has.
      setSideTab(tags, false);
      const body = tags.querySelector('.side-tab-body');
      out.falls = getComputedStyle(body).animationName === 'side-tab-fall' && getComputedStyle(body).visibility === 'visible';
      await wait(260);
      out.fallen = getComputedStyle(body).visibility === 'hidden';
      setSideTab(tags, false);

      applyEdit(()=>{
        workingNodes.push(['sp_a','Source',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['sp_b','Target','sp_a','its word',null,null,{pos:[X + 300, Y + 200]}]);
        workingNodes.push(['sp_c','Other',null,null,null,null,{pos:[X + 520, Y + 40]}]);
        workingNodes.push(['sp_k','',null,null,null,'callout',{pos:[X + 380, Y + 300], leader:{from:'sp_a', to:'sp_b', at:0.9}}]);
        EDGE_STYLES.push({from:'sp_a', to:'sp_b', arrowIn:true, dash:'dashed', note:'near the end', noteAt:0.8});
      });
      await wait(300);
      flyToNode('sp_a'); await wait(300);

      /* Split from the connector's menu, at the place on offer when the
         pointer is near one: the middle, here. */
      const pts = drawnLineOf('sp_a', 'sp_b');
      const mid = pointAtFraction(pts, 0.5);
      const rv = svg.getBoundingClientRect();
      const cx = rv.left + vx + mid.x * vs + 4, cy = rv.top + vy + mid.y * vs + 3;
      out.snapped = splitFractionAt('sp_a', 'sp_b', cx, cy) === 0.5;
      openEdgeStylePopover('sp_a', 'sp_b', {clientX:cx, clientY:cy, stopPropagation(){}});
      openTouchMenu(cx, cy, 'edge', true);
      const btn = touchMenu.querySelector('[data-act="split"]');
      out.offered = !!btn && !btn.hidden;
      if(btn) btn.click();
      await wait(300);
      const dotId = (workingNodes.find(e=> e[5] === 'split' && e[2] === 'sp_a') || [])[0];
      const dot = nodes.get(dotId);
      out.dot = !!dot && dot.w === SPLIT_SIZE && !!document.querySelector(`.node.node-split[data-id="${dotId}"]`);
      out.onTheLine = !!dot && Math.hypot(dot.x + dot.w / 2 - mid.x, dot.y + dot.h / 2 - mid.y) < 0.5;
      out.rewired = (nodes.get('sp_b').parents || []).join() === dotId;
      const into = edgeStyleFor('sp_a', dotId), on = edgeStyleFor(dotId, 'sp_b');
      out.halves = into.arrowIn === true && into.arrow === false && into.dash === 'dashed' &&
                   on.arrow !== false && !on.arrowIn && on.dash === 'dashed' &&
                   on.note === 'near the end' && !into.note && Math.abs(on.noteAt - 0.6) < 0.01;
      const k = workingEntry('sp_k').entry[6].leader;
      out.calloutKept = k.from === dotId && k.to === 'sp_b' && Math.abs(k.at - 0.8) < 0.01;
      out.wordKept = nodes.get('sp_b').edgeLabel === 'its word';
      /* …and the next entry picked is where the new line goes. */
      out.aiming = document.body.classList.contains('split-aiming');
      const og = document.querySelector('.node[data-id="sp_c"]');
      og.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      await wait(300);
      out.branched = (nodes.get('sp_c').parents || []).join() === dotId && !document.body.classList.contains('split-aiming');
      /* The lines out of it leave from one point, as one line forking. */
      const l1 = drawnLineOf(dotId, 'sp_b'), l2 = drawnLineOf(dotId, 'sp_c');
      out.onePoint = !!l1 && !!l2 && Math.hypot(l1[0].x - l2[0].x, l1[0].y - l2[0].y) < 0.5;
      /* Held on its own, a split offers another line out of it. */
      selectNode(dotId);
      openTouchMenu(cx, cy, 'selection', true);
      out.branchOffered = !touchMenu.querySelector('[data-act="branch"]').hidden;
      closeTouchMenu();
      /* Read as a lineage, the split is looked through. */
      out.lineage = lineageParentsOf(nodes.get('sp_c')).join() + '|' + lineageChildrenOf(nodes.get('sp_a')).sort().join();
      buildTextView();
      const srcItem = [...textViewBody.querySelectorAll('li.tv-entry')].find(li=> li.querySelector('.tv-name').dataset.id === 'sp_a');
      out.textView = !!srcItem && !!srcItem.querySelector('.tv-name[data-id="sp_c"]') &&
                     !textViewBody.querySelector(`.tv-name[data-id="${dotId}"]`);
      /* Taken away, its lines are given back to the line it stood on. */
      deleteNodes([dotId]); await wait(300);
      out.handedBack = (nodes.get('sp_b').parents || []).join() === 'sp_a' && (nodes.get('sp_c').parents || []).join() === 'sp_a';
      undoLastEdit(); await wait(300);
      out.undone = (nodes.get('sp_b').parents || []).join() === dotId;
    } finally {
      if(typeof endSplitBranch === 'function') endSplitBranch();
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      refill(EDGE_STYLES, beforeStyles); });
      closeEdgePopover(); closeTouchMenu(); deselect();
      await wait(200);
    }
    return out;
  });
  check('a drawer rises out of its tab as it opens', r.rises);
  check('…and goes back into it as it shuts', r.falls && r.fallen, JSON.stringify([r.falls, r.fallen]));
  check('a connector’s menu offers Split, at the place on offer when the pointer is near one',
        r.offered && r.snapped, JSON.stringify({o:r.offered, s:r.snapped}));
  check('a split is a dot on the line, and the line goes on out of it to where it went',
        r.dot && r.onTheLine && r.rewired, JSON.stringify({d:r.dot, l:r.onTheLine, w:r.rewired}));
  check('…each half keeps the look and the ends it had, and the note and remarks the half they stood on',
        r.halves && r.calloutKept && r.wordKept, JSON.stringify({h:r.halves, k:r.calloutKept, w:r.wordKept}));
  check('…the next entry picked takes a new line out of the split, from the same point',
        r.aiming && r.branched && r.onePoint, JSON.stringify({a:r.aiming, b:r.branched, p:r.onePoint}));
  check('…and a split held on its own offers another', r.branchOffered);
  check('a split is looked through wherever the chart is read as a lineage',
        r.lineage === 'sp_a|sp_b,sp_c' && r.textView, JSON.stringify({l:r.lineage, t:r.textView}));
  check('a split taken away gives its lines back to the line it stood on, and undo brings it back',
        r.handedBack && r.undone, JSON.stringify({h:r.handedBack, u:r.undone}));

  /* On a phone the top bar slides away while the chart is carried up and
     comes back as it is carried down, and what is under the finger stays. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    /* An empty chart, so the finger carries the chart and never lands on
       an entry or an array as the carries add up. */
    await pp.evaluate(()=>{ applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0; }); deselect(); });
    await wait(200);
    const cdp = await phone.newCDPSession(pp);
    const under = (y, x)=> pp.evaluate(([y, x])=>{ const r = svg.getBoundingClientRect();
      return [+((x - r.left - vx) / vs).toFixed(1), +((y - r.top - vy) / vs).toFixed(1)]; }, [y, x == null ? 200 : x]);
    const carry = async (dy, dx)=>{
      dx = dx || 0;
      const was = await under(500);
      await pp.evaluate(()=>{ const b = document.querySelector('.topbar'); window.__barHeights = [];
        const look = ()=>{ window.__barHeights.push(b.getBoundingClientRect().height);
                           if(window.__barHeights.length < 60) requestAnimationFrame(look); };
        requestAnimationFrame(look); });
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:200, y:500}]});
      for(let i = 1; i <= 12; i++){
        await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:200 + dx * i / 12, y:500 + dy * i / 12}]});
        await wait(40);
      }
      await wait(320);
      const now = await under(500 + dy, 200 + dx);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await wait(250);
      const bar = await pp.evaluate(()=>{ const b = document.querySelector('.topbar');
        const shown = (sel)=>{ const e = b.querySelector(sel), r = e && e.getBoundingClientRect();
                               return !!r && r.height > 0 && getComputedStyle(e).opacity === '1'; };
        const hs = window.__barHeights, lo = Math.min(...hs), hi = Math.max(...hs);
        return {gone: b.classList.contains('gone'), top: Math.round(svg.getBoundingClientRect().top),
                gone2: b.classList.contains('gone2'), tools: shown('#toolRow'),
                kept: shown('.brand') && shown('.search-wrap'), buttons: shown('#aboutToggle'),
                folded: hs.some(h=> h > lo + 2 && h < hi - 2)}; });
      return {kept: Math.abs(was[0] - now[0]) < 0.6 && Math.abs(was[1] - now[1]) < 0.6, bar, was, now};
    };
    const up = await carry(-150);
    const further = await carry(-150);
    const down = await carry(150);
    // Along a diagonal it stays as it is, whichever way.
    const slantUp = await carry(-150, 150);
    const slantDown = await carry(150, -150);
    await carry(-150);
    const slantDownHidden = await carry(150, 150);
    await carry(150);
    check('on a phone the top bar\'s buttons go as the chart is carried up, and come back as it is carried down',
          up.bar.gone && !up.bar.buttons && !down.bar.gone && down.bar.buttons && down.bar.top - up.bar.top > 25,
          JSON.stringify({up:up.bar, down:down.bar}));
    check('…and the wordmark and the search stay', up.bar.kept && down.bar.kept, JSON.stringify({up:up.bar, down:down.bar}));
    check('…the toolbar under them stays at first, and goes too as the chart is carried on up; both come back carried down',
          up.bar.tools && !up.bar.gone2 && further.bar.gone2 && !further.bar.tools && further.bar.kept &&
          !down.bar.gone2 && down.bar.tools && further.bar.top < up.bar.top,
          JSON.stringify({up:up.bar, further:further.bar, down:down.bar}));
    check('…and what is under the finger stays under it', up.kept && down.kept, JSON.stringify({up, down}));
    check('…folding away and back over several frames rather than at once', up.bar.folded && down.bar.folded,
          JSON.stringify({up:up.bar.folded, down:down.bar.folded}));
    check('…and a carry along a diagonal neither puts it away nor brings it back',
          !slantUp.bar.gone && !slantDown.bar.gone && slantDownHidden.bar.gone,
          JSON.stringify([slantUp.bar.gone, slantDown.bar.gone, slantDownHidden.bar.gone]));
  } finally {
    await phone.close();
  }
  });
  await scenario("the owner's list of 24.10, afternoon: solid ends, a merged arrow that keeps its corners, no nicks", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 90000, Y = 90000;
    const pts = (from, to)=> drawnRoutes.get(calloutEdgeKey(from, to)).pts;
    const move = (id, x, y)=>{ applyEdit(()=>{ const f = workingEntry(id), o = entryOpts(f.entry);
                                              o.pos = [x, y]; putEntry(f.index, f.entry, o); }); rebuildChart(); };
    /* A bend dragged as a hand drags it: taken hold of at `at` (a corner
       when `index` is not -1), carried by dx, dy in chart units. */
    const dragBend = (from, to, at, index, dx, dy)=>{
      const c0 = clientToWorld(0, 0), c1 = clientToWorld(100, 100), k = (c1.x - c0.x) / 100;
      const cx = (at.x - c0.x) / k, cy = (at.y - c0.y) / k;
      beginBendDrag({button:0, clientX:cx, clientY:cy, stopPropagation(){}, preventDefault(){}},
                    {from, to}, at, index, pts(from, to));
      for(let s = 1; s <= 6; s++)
        window.dispatchEvent(new MouseEvent('mousemove', {clientX: cx + dx / k * s / 6, clientY: cy + dy / k * s / 6}));
      window.dispatchEvent(new MouseEvent('mouseup', {}));
    };
    // The shortest stretch between two turns, the two ends' own run-outs aside.
    const nick = (P)=>{
      const A = routeArms(P);
      let least = Infinity;
      for(let i = 2; i < A.length - 1; i++) least = Math.min(least, Math.hypot(A[i].x - A[i-1].x, A[i].y - A[i-1].y));
      return +least.toFixed(2);
    };
    try{
      vs = 1; vx = -X + 400; vy = -Y + 300; applyTransform();
      /* 1. An end is solid in a see-through colour: its paint is what the
            line looks on the paper, with nothing of the paper in it. */
      applyEdit(()=>{
        workingNodes.push(['sl_p','Pale',null,null,null,null,{pos:[X - 2000, Y], colors:['#22cc']}]);
        workingNodes.push(['sl_q','Below','sl_p',null,null,null,{pos:[X - 2000, Y + 200]}]);
        EDGE_STYLES.push({from:'sl_p', to:'sl_q', arrowIn:true, teeIn:true});
      });
      rebuildChart();
      const fills = [...document.querySelectorAll('.edge-arrow[data-from="sl_p"][data-to="sl_q"] path')].map(p=> p.getAttribute('fill'));
      out.solid = fills.length === 2 && fills.every(f=> rgbaOf(f).a === 1) && fills[0] === solidInk('#22cc');

      /* 2–4. A merge whose bar has been put somewhere. */
      applyEdit(()=>{
        workingNodes.push(['sl_a','Amalgam 1',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['sl_b','Amalgam 2',null,null,null,null,{pos:[X + 250, Y]}]);
        workingNodes.push(['sl_m','Amalgam 3',['sl_a','sl_b'],null,null,null,{merge:true, pos:[X + 120, Y + 160]}]);
      });
      rebuildChart(); fixAmalgamBars(['sl_m']); rebuildChart();
      const bar = amalgamBars.get('sl_m');
      /* Carried towards its bar and across it, the entry is fed at the
         middle of the face it had, and never through the box (the owner's
         list of 24.10, evening). It used to be the face towards the bar —
         the top below it, the bottom above it, a side while the bar ran
         through — and the owner's list of 3.11 took that away: the face
         changes by hand and only by hand. */
      out.crowded = [Y + 62, Y + 56, Y + 50, Y + 46, Y + 40, Y + 34, Y + 30, Y + 26, Y + 20, Y - 40].map(y=>{
        move('sl_m', X + 120, y);
        const P = pts('', 'sl_m'), n = nodes.get('sl_m'), m = P.length - 1;
        const inside = P.slice(0, -1).some(p=> p.x > n.x + 0.5 && p.x < n.x + n.w - 0.5 && p.y > n.y + 0.5 && p.y < n.y + n.h - 0.5);
        const mid = n.x + n.w / 2;
        const face = Math.abs(P[m].y - n.y) < 0.01 && Math.abs(P[m].x - mid) < 0.01;
        return face && !inside && Math.abs(amalgamBars.get('sl_m').cross - bar.cross) < 0.01;
      });
      /* …and carried along past the end of its bar, it keeps the face it
         had, at its middle, with a knee from the first step off it,
         however short the step (the owner, 31.10: no end moves along its
         port). */
      out.pastEnd = [140, 150, 160, 170, 200, 260].map(dx=>{
        move('sl_m', X + 120 + dx, Y + 160);
        const P = pts('', 'sl_m'), n = nodes.get('sl_m'), m = P.length - 1;
        return Math.abs(P[m].y - n.y) < 0.01 && Math.abs(P[m].x - (n.x + n.w / 2)) < 0.01 &&
               P.slice(1).every((p, i)=> Math.abs(p.x - P[i].x) < 0.01 || Math.abs(p.y - P[i].y) < 0.01);
      });
      move('sl_m', X + 120, Y + 160);
      out.barBack = Math.abs(amalgamBars.get('sl_m').cross - bar.cross) < 0.01;

      /* The stretch out of the bar, dragged sideways, takes its foot along
         the bar with it — no step off the bar. */
      const P0 = pts('', 'sl_m');
      dragBend('', 'sl_m', {x: P0[0].x, y: (P0[0].y + P0[P0.length-1].y) / 2}, -1, -60, 0);
      const P1 = pts('', 'sl_m');
      out.bent = bendListOf('', 'sl_m').length > 0;
      out.footMoved = Math.abs(P1[0].x - (P0[0].x - 60)) < GRID && Math.abs(P1[0].y - P0[0].y) < 0.01;
      out.footSquare = Math.abs(P1[1].x - P1[0].x) < 0.01;
      /* Bent, the merged arrow keeps its foot where it was when the entry
         is carried along the bar… */
      move('sl_m', X + 200, Y + 160);
      const P2 = pts('', 'sl_m');
      out.footKept = Math.abs(P2[0].x - P1[0].x) < 0.01;
      out.reachesEntry = Math.abs(P2[P2.length-1].y - nodes.get('sl_m').y) < 1;
      /* …and carried across the bar, its corners are kept for when it comes
         back, and it arrives at the face it had. */
      const kept = JSON.stringify(bendListOf('', 'sl_m'));
      move('sl_m', X + 120, Y - 120);
      out.bendsKept = JSON.stringify(bendListOf('', 'sl_m')) === kept;
      move('sl_m', X + 200, Y + 160);
      out.cameBack = JSON.stringify(pts('', 'sl_m')) === JSON.stringify(P2);

      /* 5. A stretch dragged to within a step of the port's level is put
            on it: no stair a pixel or two high in front of the head. */
      applyEdit(()=>{
        workingNodes.push(['sl_c','Alpha entry',null,null,null,null,{pos:[X + 2000, Y]}]);
        workingNodes.push(['sl_d','Beta','sl_c',null,null,null,{pos:[X + 2300, Y]}]);
      });
      rebuildChart();
      // A route over the top of both, its last corners a step off the line.
      const ox = X + 2000, oy = Y;
      setBendList('sl_c', 'sl_d', [[ox + 77.29, oy + 70.49], [ox + 129.93, oy + 70.49], [ox + 274.43, oy + 30.21],
                                   [ox + 284.5, oy - 50.35]], ['right', 'left']);
      rebuildChart();
      // The short stretch over the top, pulled down to a little short of the port's level.
      dragBend('sl_c', 'sl_d', {x: ox + 279.465, y: oy - 50.35}, -1, 43, 64);
      out.stairBends = bendListOf('sl_c', 'sl_d').length;
      out.noStair = nick(pts('sl_c', 'sl_d'));

      /* 6. A corner let go a hair off the run-out its end steps out at. */
      applyEdit(()=>{
        workingNodes.push(['sl_e','Alpha entry',null,null,null,null,{pos:[X + 4000, Y]}]);
        workingNodes.push(['sl_f','Beta','sl_e',null,null,null,{pos:[X + 4200, Y + 200]}]);
      });
      rebuildChart();
      const pe = pts('sl_e', 'sl_f');
      setBendList('sl_e', 'sl_f', [[pe[0].x, pe[0].y + 15.5], [X + 4140, Y + 151.05]], ['bottom', 'top']);
      rebuildChart();
      const ae = routeArms(pts('sl_e', 'sl_f'));
      const corner = ae.length - 2;
      dragBend('sl_e', 'sl_f', ae[corner], corner, -30, 44);
      out.noNick = nick(pts('sl_e', 'sl_f'));

      /* 7. A corner levelled with its port when the entry is carried does
            not leave a nick against the corner before it. */
      const lv = levelWithPorts([{x: 100, y: 200}, {x: 100, y: 70.5}, {x: 20, y: 70.5}, {x: 20, y: 112}],
                                {x: 10, y: 40, side: 'bottom'}, {x: 0, y: 72, side: 'right'});
      out.levelled = JSON.stringify(lv);
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
      rebuildChart();
      await wait(100);
    }
    return out;
  });
  check('an end in a see-through colour is painted solid, in the shade its line has on the paper', r.solid);
  check('an entry carried towards its merge\'s bar and across it, which stays put, is fed by the face it had, never through the box', r.crowded.every(Boolean) && r.barBack,
        JSON.stringify([r.crowded, r.barBack]));
  check('…and carried past the bar\'s end, by the face it had, at its middle', r.pastEnd.every(Boolean), JSON.stringify(r.pastEnd));
  check('the merged arrow\'s stretch out of the bar, dragged, takes its foot along the bar', r.bent && r.footMoved && r.footSquare,
        JSON.stringify([r.bent, r.footMoved, r.footSquare]));
  check('…and bent, its foot stays where it was when the entry is carried', r.footKept && r.reachesEntry, JSON.stringify([r.footKept, r.reachesEntry]));
  check('…and carried across the bar and back, its corners are kept', r.bendsKept && r.cameBack, JSON.stringify([r.bendsKept, r.cameBack]));
  check('a stretch dragged to within a step of its port\'s level leaves no stair', r.noStair >= 3, String(r.noStair));
  check('a corner let go a hair off the run-out leaves no nick', r.noNick >= 3, String(r.noNick));
  check('a corner levelled with its port takes the nick before it away', r.levelled === JSON.stringify([{x:100, y:200}, {x:100, y:72}, {x:20, y:72}]),
        r.levelled);
  });
  await scenario("the owner's list of 24.10, late: a junction carried, the face towards the bar, a lighter split", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 95000, Y = 95000;
    try{
      vs = 1; vx = -X + 400; vy = -Y + 300; applyTransform();
      /* 1. The junction is taken hold of and carried: the entry and its
            arrow go along the bar, and nowhere else. */
      applyEdit(()=>{
        workingNodes.push(['lt_a','Amalgam 1',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['lt_b','Amalgam 2',null,null,null,null,{pos:[X + 250, Y]}]);
        workingNodes.push(['lt_m','Amalgam 3',['lt_a','lt_b'],null,null,null,{merge:true, pos:[X + 120, Y + 160]}]);
      });
      rebuildChart();
      const n0 = Object.assign({}, nodes.get('lt_m'));
      const grip = document.querySelector('.amalgam-junction-hit[data-amalgam="lt_m"]');
      const gr = grip.getBoundingClientRect(), gx = gr.x + gr.width / 2, gy = gr.y + gr.height / 2;
      grip.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:gx, clientY:gy}));
      for(let s = 1; s <= 6; s++)
        window.dispatchEvent(new MouseEvent('mousemove', {clientX: gx + 60 * s / 6, clientY: gy + 40 * s / 6}));
      window.dispatchEvent(new MouseEvent('mouseup', {clientX: gx + 60, clientY: gy + 40}));
      await wait(50);
      const n1 = nodes.get('lt_m');
      const bead = document.querySelector('.amalgam-junction[data-to="lt_m"]');
      out.carried = Math.abs(n1.x - n0.x - 60) < GRID && Math.abs(n1.y - n0.y) < 0.01 &&
                    Math.abs(+bead.getAttribute('cx') - (n1.x + n1.w / 2)) < 0.01;
      // …and no further than the bar reaches.
      const g2 = document.querySelector('.amalgam-junction-hit[data-amalgam="lt_m"]').getBoundingClientRect();
      const hx = g2.x + g2.width / 2, hy = g2.y + g2.height / 2;
      document.querySelector('.amalgam-junction-hit[data-amalgam="lt_m"]')
        .dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:hx, clientY:hy}));
      for(let s = 1; s <= 6; s++) window.dispatchEvent(new MouseEvent('mousemove', {clientX: hx + 600 * s / 6, clientY: hy}));
      window.dispatchEvent(new MouseEvent('mouseup', {clientX: hx + 600, clientY: hy}));
      await wait(50);
      const n2 = nodes.get('lt_m'), bar = amalgamBars.get('lt_m');
      out.heldToBar = n2.x + n2.w / 2 <= bar.hi + 0.01 && n2.x + n2.w / 2 > bar.hi - GRID;

      /* 2. A merge whose lineages are all deleted is no merge: connectors
            drawn into the entry afterwards are connectors. */
      deleteEdges([{from:'lt_a', to:'lt_m'}, {from:'lt_b', to:'lt_m'}]);
      connectNodes('lt_a', 'lt_m'); connectNodes('lt_b', 'lt_m');
      rebuildChart();
      out.forgotten = !entryOpts(workingEntry('lt_m').entry).merge && !isMergeNode(nodes.get('lt_m'));
      // …and so is one a chart was saved with, left on an entry with one lineage.
      applyEdit(()=>{ workingNodes.push(['lt_s','Stale','lt_a',null,null,null,{merge:true, pos:[X, Y + 400]}]); });
      connectNodes('lt_b', 'lt_s');
      rebuildChart();
      out.staleForgotten = !isMergeNode(nodes.get('lt_s'));

      /* 4. A split is as big as a callout's point, and one drawn at the
            old size keeps its middle where it was. */
      const old = [['lt_d', '', null, null, null, 'split', {pos:[100, 200]}]];
      migrateSplitDots(old);
      out.splitSize = SPLIT_SIZE === 2 * LEADER_DOT_R &&
                      Math.abs(old[0][6].pos[0] + SPLIT_SIZE / 2 - (100 + SPLIT_SIZE_WAS / 2)) < 0.01 &&
                      Math.abs(old[0][6].pos[1] + SPLIT_SIZE / 2 - (200 + SPLIT_SIZE_WAS / 2)) < 0.01;

      /* 5. A merge comes as close to its lineages as the same lines did
            unmerged: the bar stays between them, the arrow points on. */
      out.squeezed = [];
      [16, 24, 32].forEach((gap, i)=>{
        const y0 = Y + 3000 + i * 400;
        applyEdit(()=>{
          workingNodes.push(['lt_g' + i + 'a','Alpha',null,null,null,null,{pos:[X, y0]}]);
          workingNodes.push(['lt_g' + i + 'b','Beta',null,null,null,null,{pos:[X + 250, y0]}]);
        });
        rebuildChart();
        const h = nodes.get('lt_g' + i + 'a').h;
        /* Merged as a chart holds it, not through the menu: this close the
           two lines come into the entry by its two sides, and the menu only
           merges lines into one port (the owner's list of 29.10). */
        applyEdit(()=>{
          workingNodes.push(['lt_g' + i + 'm','Child',['lt_g' + i + 'a','lt_g' + i + 'b'],null,null,null,{pos:[X + 120, y0 + h + gap]}]);
        });
        rebuildChart();
        applyEdit(()=>{
          const f = workingEntry('lt_g' + i + 'm'), o = entryOpts(f.entry);
          o.merge = true;
          putEntry(f.index, f.entry, o);
          bringAmalgamToItsLineages(f, ['lt_g' + i + 'a', 'lt_g' + i + 'b']);
        });
        rebuildChart();
        const pa = nodes.get('lt_g' + i + 'a'), m = nodes.get('lt_g' + i + 'm'), bar = amalgamBars.get('lt_g' + i + 'm');
        out.squeezed.push(!!bar && bar.cross > pa.y + pa.h + 0.5 && bar.cross < m.y - 0.5);
      });
      out.leadMin = AMALGAM_LEAD_MIN <= AMALGAM_SQUEEZE &&
                    amalgamBarOf({bar:{k:'y', after:true, lead:AMALGAM_SQUEEZE}}).lead === AMALGAM_SQUEEZE;

      /* 6. A split keeps the corners the line was bent through by hand,
            each on its own half, and a new line out of it looks like the
            line it was set on. */
      applyEdit(()=>{
        workingNodes.push(['lt_s1','Source',null,null,null,null,{pos:[X + 5000, Y]}]);
        workingNodes.push(['lt_s2','Target','lt_s1',null,null,null,{pos:[X + 5300, Y + 200]}]);
        workingNodes.push(['lt_s3','Other',null,null,null,null,{pos:[X + 5000, Y + 260]}]);
        EDGE_STYLES.push({from:'lt_s1', to:'lt_s2', routing:'orthogonal', dash:'dashed', arrow:true, openOut:true,
                          bends:[[X + 5040, Y + 120], [X + 5200, Y + 120], [X + 5200, Y + 60], [X + 5340, Y + 60]],
                          bendSides:['bottom', 'top']});
      });
      rebuildChart();
      const whole = drawnRoutes.get(calloutEdgeKey('lt_s1', 'lt_s2')).pts.map(p=> ({x: p.x, y: p.y}));
      const dot = splitEdgeAt('lt_s1', 'lt_s2', 0.5);
      rebuildChart();
      const into = EDGE_STYLES.find(t=> t.from === 'lt_s1' && t.to === dot);
      const on = EDGE_STYLES.find(t=> t.from === dot && t.to === 'lt_s2');
      const kept = [].concat(into.bends || [], on.bends || []);
      const halves = [drawnRoutes.get(calloutEdgeKey('lt_s1', dot)), drawnRoutes.get(calloutEdgeKey(dot, 'lt_s2'))];
      // Every corner the whole line turned at, the halves still turn at.
      const corners = whole.slice(2, -2);
      const turned = corners.every(c=> halves.some(h=> h.pts.some(p=> Math.hypot(p.x - c.x, p.y - c.y) < 1)));
      out.splitBends = kept.length >= 3 && turned;
      out.splitBendsAt = [whole.length, kept.length];
      connectNodes(dot, 'lt_s3');
      rebuildChart();
      const branch = edgeStyleFor(dot, 'lt_s3');
      out.branchLook = branch.dash === 'dashed' && branch.openOut === true && !branch.bends;
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
      rebuildChart();
      await wait(100);
    }
    return out;
  });
  check('a merge\'s junction, carried, takes the entry and its arrow along the bar and nowhere else', r.carried);
  check('…and no further than the bar reaches', r.heldToBar);
  check('a merge whose lineages are all deleted merges nothing drawn in afterwards', r.forgotten && r.staleForgotten,
        JSON.stringify([r.forgotten, r.staleForgotten]));
  check('a split is as big as a callout\'s point, and one drawn before keeps its middle', r.splitSize);
  check('a merge comes as close to its lineages as the lines did unmerged, its bar still between them',
        r.squeezed.every(Boolean), JSON.stringify(r.squeezed));
  check('…and a bar can be put as close to them as one corner', r.leadMin);
  check('a split keeps the corners its line was bent through, each on the half it stood on',
        r.splitBends, JSON.stringify(r.splitBendsAt));
  check('a new line out of a split looks like the line the split was set on', r.branchLook);
  });
  await scenario("the owner's list of 28.10: one size of point, the face towards a held bar, the field's ink and reading, a link that shows where it goes", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(ok=> setTimeout(ok, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const out = {};
    const X = 99000, Y = 99000;
    try{
      vs = 1; vx = -X + 400; vy = -Y + 300; applyTransform();
      /* 1. Every point on a merge's bar is a callout's point. */
      applyEdit(()=>{
        workingNodes.push(['ol_a','Alpha',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['ol_b','Beta',null,null,null,null,{pos:[X + 200, Y]}]);
        workingNodes.push(['ol_c','Gamma',null,null,null,null,{pos:[X + 400, Y]}]);
        workingNodes.push(['ol_m','Merged',['ol_a','ol_b','ol_c'],null,null,null,{merge:true, pos:[X + 200, Y + 320],
                           bar:{k:'y', after:true, lead:200}}]);
      });
      rebuildChart();
      const beads = [...document.querySelectorAll('.amalgam-bead[data-to="ol_m"]')];
      out.beads = beads.length >= 1 && AMALGAM_JOINT_R === LEADER_DOT_R &&
                  beads.every(c=> Math.abs(+c.getAttribute('r') - LEADER_DOT_R) < 1e-6);
      out.beadsAt = beads.map(c=> c.getAttribute('r'));

      /* 2. Carried across a held bar, the merged arrow — bent by hand or
            not — keeps its face, beside a lineage too (3.11; it turned to
            the face towards the bar from 28.10). */
      const sideAt = (x, y)=>{
        applyEdit(()=>{ const f = workingEntry('ol_m'); const o = entryOpts(f.entry); o.pos = [x, y]; putEntry(f.index, f.entry, o); });
        rebuildChart();
        return mergedArrowPorts.get('ol_m') ? mergedArrowPorts.get('ol_m').p2.side : drawnRoutes.get(calloutEdgeKey('', 'ol_m'));
      };
      const portSide = (x, y)=>{
        sideAt(x, y);
        const m = nodes.get('ol_m'), d = document.querySelector('path.amalgam-out[data-to="ol_m"]').getAttribute('d');
        const nums = d.match(/-?[0-9.]+/g).map(Number), ex = nums[nums.length - 2], ey = nums[nums.length - 1];
        return Math.abs(ey - (m.y + m.h)) < 14 ? 'bottom' : Math.abs(ey - m.y) < 14 ? 'top'
             : Math.abs(ex - m.x) < 14 ? 'left' : 'right';
      };
      out.plain = [portSide(X + 200, Y + 320), portSide(X + 200, Y + 120), portSide(X + 330, Y + 120), portSide(X + 395, Y + 120)];
      applyEdit(()=>{ EDGE_STYLES.push({from:'', to:'ol_m', routing:'orthogonal', dash:'solid', arrow:true,
                                        bends:[[X + 227, Y + 260], [X + 300, Y + 260], [X + 300, Y + 300], [X + 227, Y + 300]],
                                        bendSides:['bottom', 'top']}); });
      out.bent = [portSide(X + 200, Y + 120), portSide(X + 330, Y + 120)];
      sideAt(X + 200, Y + 320);
      out.bentBack = document.querySelectorAll('path.amalgam-out[data-to="ol_m"]').length === 1 &&
                     drawnRoutes.size >= 0 && (mergedArrowPorts.get('ol_m').p2.side === 'top');

      /* 3. A connector squeezed as short as it goes comes out of its port
            as far as a squeezed lineage comes down to its bar. */
      out.stub = STUB_MIN === AMALGAM_LEAD_MIN;

      /* 4. The field typed into is in the entry's ink — its own or the one
            it inherits — when it has no words yet, and a reading in it sits
            where the drawing puts it. */
      applyEdit(()=>{
        workingNodes.push(['ol_e','',null,null,null,null,{pos:[X, Y + 900], colors:['#2233cc']}]);
        workingNodes.push(['ol_k','','',null,null,'callout',{pos:[X + 120, Y + 1000], leader:{from:'ol_a', to:'ol_b', at:0.5}}]);
        EDGE_STYLES.push({from:'ol_a', to:'ol_b', routing:'orthogonal', dash:'solid', arrow:true, color:'#11aa44', colorFixed:true});
        workingNodes.push(['ol_r','A [[漢字|かんじ]] b',null,null,null,null,{pos:[X + 600, Y + 900]}]);
      });
      applyEdit(()=>{ const f = workingEntry('ol_b'); f.entry[2] = 'ol_a'; putEntry(f.index, f.entry, entryOpts(f.entry)); });
      rebuildChart();
      const inkOf = (id)=>{ openNodeEditor(id, {focus:false}); const cs = getComputedStyle(richFields.get('nodeEditorText').surface);
        /* Seen through to the drawing (24.11), the field's ink is its caret's. */
        const c = document.getElementById('nodeEditor').classList.contains('ink-from-drawing') ? cs.caretColor : cs.color; closeNodeEditor(false); return c; };
      out.inks = [inkOf('ol_e'), inkOf('ol_k')];
      vs = 3; applyTransform(); rebuildChart();
      openNodeEditor('ol_r', {focus:false});
      await wait(50);
      const surf = richFields.get('nodeEditorText').surface;
      const rt = surf.querySelector('rt').getBoundingClientRect();
      /* The word's own letters: the ruby's box now reaches up over its
         reading by the line's lift (an empty mark, see seatFieldReadings). */
      const wordRange = document.createRange();
      wordRange.selectNodeContents(surf.querySelector('ruby').firstChild);
      const rb = wordRange.getBoundingClientRect();
      const g = document.querySelector('.node[data-id="ol_r"]');
      const anno = g.querySelector('.ruby-anno').getBoundingClientRect();
      const base = [...g.querySelectorAll('tspan')].find(t=> t.textContent === '漢字').getBoundingClientRect();
      /* By the feet of the two rows: a CJK face falls back to another,
         and the field's box for the letters and the drawing's are of
         different heights, so their tops part though the letters stand
         on the same line. */
      out.ruby = [+(rb.bottom - rt.bottom).toFixed(1), +(base.bottom - anno.bottom).toFixed(1), +rt.height.toFixed(1), +anno.height.toFixed(1)];
      closeNodeEditor(false);
      vs = 1; applyTransform();

      /* 5. A link node: its colour and where it goes on its bar, no drawer;
            its arrow turned to where it goes; and, pointed at, a faint copy
            of the entry it stands for — through a link joined to one. */
      applyEdit(()=>{
        workingNodes.push(['ol_far','Far away',null,null,null,null,{pos:[X + 1500, Y + 1600]}]);
        workingNodes.push(['ol_l2','',null,null,null,'link',{pos:[X + 1400, Y + 1500], link:'ol_l1'}]);
        workingNodes.push(['ol_j','Joined',['ol_l2'],null,null,null,{pos:[X + 1500, Y + 1400]}]);
        workingNodes.push(['ol_l1','',null,null,null,'link',{pos:[X, Y + 1400], link:'ol_l2'}]);
        workingNodes.push(['ol_l3','',null,null,null,'link',{pos:[X, Y + 1500]}]);
      });
      rebuildChart();
      openEntrySettings('ol_l3');
      const goes = document.querySelector('.link-goes-input');
      out.bar = !styleBar.hidden && document.activeElement === goes &&
                !document.getElementById('detail').classList.contains('open');
      goes.value = 'ol_far'; goes.blur();
      await wait(50);
      out.written = entryOpts(workingEntry('ol_l3').entry).link === 'ol_far';
      closeStyleBar();
      const turnOf = (id)=>{ const t = document.querySelector(`.node[data-id="${id}"] .link-node-arrow`).getAttribute('transform') || '';
                             const m = t.match(/rotate\(([-0-9.]+)/); return m ? +m[1] : 0; };
      const l3 = nodes.get('ol_l3'), far = nodes.get('ol_far');
      const want = Math.atan2(far.y + far.h/2 - l3.y - l3.h/2, far.x + far.w/2 - l3.x - l3.w/2) * 180 / Math.PI + 45;
      out.turned = Math.abs(turnOf('ol_l3') - want) < 0.2;
      showLinkPreview('ol_l3');
      const p1 = document.querySelector('#linkPreviewLayer .link-preview-copy');
      out.preview = !!p1 && p1.textContent.includes('Far');
      showLinkPreview('ol_l1');
      const p2 = document.querySelector('#linkPreviewLayer .link-preview-copy');
      out.through = !!p2 && p2.textContent.includes('Joined') && !p2.querySelector('[id]') && !p2.hasAttribute('data-id');
      showLinkPreview(null);
      out.gone = !document.querySelector('#linkPreviewLayer *');
    } finally {
      closeNodeEditor(false); closeStyleBar(); showLinkPreview(null);
      applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
      deselect();
      rebuildChart();
      await wait(100);
    }
    return out;
  });
  check('every point on a merge\'s bar is the size of a callout\'s point', r.beads, JSON.stringify(r.beadsAt));
  /* The owner's list of 3.11 took back the turn to the face towards the
     bar (28.10): a held bar's arrow keeps the face it had, wherever the
     entry is carried, and goes round to it. */
  check('carried across a held bar, the merged arrow keeps the face it had, beside a lineage too',
        r.plain.join() === 'top,top,top,top', JSON.stringify(r.plain));
  check('…bent by hand as well, keeping its corners for when they fit',
        r.bent.join() === 'top,top' && r.bentBack, JSON.stringify([r.bent, r.bentBack]));
  check('a connector squeezed short comes out of its port as far as a squeezed lineage comes to its bar', r.stub);
  check('the field typed into an entry with no words yet is in the ink it will be drawn in',
        r.inks[0] === 'rgb(34, 51, 204)' && r.inks[1] === 'rgb(17, 170, 68)', JSON.stringify(r.inks));
  check('a reading in the field sits where the drawing puts it, at its size',
        Math.abs(r.ruby[0] - r.ruby[1]) < 1.5 && Math.abs(r.ruby[2] - r.ruby[3]) < 3, JSON.stringify(r.ruby));
  check('a link node is set on its bar — colour and where it goes — with no drawer', r.bar && r.written,
        JSON.stringify([r.bar, r.written]));
  check('…its arrow points at where it goes', r.turned);
  check('…and pointed at, it shows a faint copy of the entry it stands for, through a link joined to one',
        r.preview && r.through && r.gone, JSON.stringify([r.preview, r.through, r.gone]));
  });

  await scenario("the owner's list of 29.10: a right click's menu everywhere, a merge carried whole, one port to a merge, a field on its stickers, the wheel over menus", async () => {
  await page.evaluate(()=>{
    window.__keep29 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    return true;
  });
  const X = 99000, Y = 99000;
  const out = {};
  const centreOf = (sel)=> page.evaluate((sel)=>{
    const e = document.querySelector(sel); if(!e) return null;
    const b = e.getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height/2, w: b.width, h: b.height};
  }, sel);
  try{
    await page.mouse.move(5, 940);
    /* 1. A right click on a merge's bar and on its junction is the chart's
          own menu, never the browser's. */
    await page.evaluate(([X, Y])=>{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      applyEdit(()=>{
        workingNodes.push(['tn_a','Amalgam 1',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['tn_b','Amalgam 2',null,null,null,null,{pos:[X + 200, Y]}]);
        workingNodes.push(['tn_c','Amalgam 3',null,null,null,null,{pos:[X + 400, Y]}]);
        workingNodes.push(['tn_m','Merged',['tn_a','tn_b','tn_c'],null,null,null,{merge:true, pos:[X + 380, Y + 200]}]);
        workingNodes.push(['tn_z','Zed',null,null,null,null,{pos:[X + 163, Y + 450]}]);
        EDGE_STYLES.push({from:'', to:'tn_m', routing:'orthogonal', dash:'solid', arrow:true,
                          bends:[[X + 260, Y + 120], [X + 420, Y + 120]], bendSides:['bottom','top']});
      });
      rebuildChart();
      window.__menu29 = [];
      document.addEventListener('contextmenu', ev=> setTimeout(()=> window.__menu29.push(ev.defaultPrevented && !touchMenu.hidden), 0));
    }, [X, Y]);
    const menus = [];
    for(const sel of ['.amalgam-bar-hit[data-amalgam="tn_m"]', '.amalgam-junction-hit[data-amalgam="tn_m"]']){
      const c = await centreOf(sel);
      if(!c){ menus.push('missing ' + sel); continue; }
      await page.mouse.click(c.x, c.y, {button: 'right'});
      await new Promise(ok=> setTimeout(ok, 80));
      menus.push(await page.evaluate(()=> window.__menu29.slice(-1)[0]));
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{ closeTouchMenu(); closeEdgePopover(); deselect(); });
    }
    out.menus = menus;

    /* 2. Carried as a group with its lineages, a merge's arrow keeps the
          corners it was bent through, relative to it. */
    const shapeOf = ()=> page.evaluate(()=>{
      const m = nodes.get('tn_m'), d = document.querySelector('path.amalgam-out[data-to="tn_m"]').getAttribute('d');
      return d.match(/-?[0-9.]+/g).map(Number).map((v, i)=> Math.round(i % 2 ? v - m.y : v - m.x)).join(',');
    });
    const shape0 = await shapeOf();
    await page.evaluate(()=> setSelection(['tn_a','tn_b','tn_c','tn_m'], 'tn_a'));
    const a = await centreOf('.node[data-id="tn_a"]');
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    const during = [];
    /* Each shape is read a frame after the move: a carry moves the entries
       at once and redraws their lines in the next frame (queueDragRedraw),
       before anything is painted. Read in between, the arrow looked a step
       behind its merge — on a slow load, about every other run. */
    const nextFrame = ()=> page.evaluate(()=> new Promise(ok=> requestAnimationFrame(()=> requestAnimationFrame(ok))));
    for(let i = 1; i <= 6; i++){ await page.mouse.move(a.x + i * 31, a.y + i * 13); await nextFrame(); during.push(await shapeOf()); }
    await page.mouse.up();
    await new Promise(ok=> setTimeout(ok, 150));
    out.carried = [shape0, ...during, await shapeOf()];
    await page.evaluate(()=>{ deselect(); setSelection([], null); });

    /* 3. The junction carried with Shift lines its entry up on another's
          middle, and the guide says so. */
    // Zed is put where the junction can reach it: beside the bar's middle.
    await page.evaluate(()=>{
      const bar = amalgamBars.get('tn_m'), z = nodes.get('tn_z');
      applyEdit(()=>{ const f = workingEntry('tn_z'), o = entryOpts(f.entry);
                      o.pos = [+((bar.lo + bar.hi)/2 - 37.3 - z.w/2).toFixed(2), z.y]; putEntry(f.index, f.entry, o); });
      rebuildChart();
    });
    const j = await centreOf('.amalgam-junction-hit[data-amalgam="tn_m"]');
    const zmid = await page.evaluate(()=>{ const z = nodes.get('tn_z'); return z.x + z.w/2; });
    const mid0 = await page.evaluate(()=>{ const m = nodes.get('tn_m'); return m.x + m.w/2; });
    await page.mouse.move(j.x, j.y); await page.mouse.down(); await page.keyboard.down('Shift');
    let lined = null;
    for(let i = 1; i <= 40 && !lined; i++){
      await page.mouse.move(j.x + (zmid - mid0) * i / 32, j.y);
      lined = await page.evaluate((zmid)=>{
        const m = nodes.get('tn_m');
        return Math.abs(m.x + m.w/2 - zmid) < 0.01 && guideLayer.querySelectorAll('.align-guide').length > 0 ? true : null;
      }, zmid);
    }
    await page.keyboard.up('Shift'); await page.mouse.up();
    out.junctionGuide = !!lined;
    await new Promise(ok=> setTimeout(ok, 100));

    /* 4. Lines into different ports of an entry do not merge; an end is
          carried to another port. */
    out.ports = await page.evaluate(([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['tp_a','Alpha',null,null,null,null,{pos:[X + 1200, Y]}]);
        workingNodes.push(['tp_b','Beta',null,null,null,null,{pos:[X + 800, Y + 300]}]);
        workingNodes.push(['tp_d','Delta',null,null,null,null,{pos:[X + 1300, Y]}]);
        workingNodes.push(['tp_c','Gamma',['tp_a','tp_b','tp_d'],null,null,null,{pos:[X + 1200, Y + 300]}]);
      });
      rebuildChart();
      const r = {sides: ['tp_a','tp_b','tp_d'].map(p=> edgeEntrySide(p, 'tp_c')),
                 a: mergeOffersFor('tp_a', 'tp_c').merge, b: mergeOffersFor('tp_b', 'tp_c').merge};
      mergeEdge('tp_a', 'tp_c');
      rebuildChart();
      r.merged = entryOpts(workingEntry('tp_c').entry).merge;
      vs = 1; vx = -(X + 1200) + 300; vy = -Y + 200; applyTransform();
      // Picked, as the ends are offered only on a picked line.
      openEdgeStylePopover('tp_b', 'tp_c', {clientX: 600, clientY: 700, stopPropagation(){}});
      drawBendHandles();
      return r;
    }, [X, Y]);
    const grip = await centreOf('#bendLayer .bend-end[data-end="to"] .bend-hit');
    const under = await page.evaluate(()=>{ const b = document.querySelector('.node[data-id="tp_c"]').getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height - 2}; });
    if(grip){
      await page.mouse.move(grip.x, grip.y); await page.mouse.down();
      await page.mouse.move((grip.x + under.x)/2, (grip.y + under.y)/2 + 20);
      await page.mouse.move(under.x, under.y);
      await page.mouse.up();
      await new Promise(ok=> setTimeout(ok, 150));
    }
    out.ports.grip = !!grip;
    await page.evaluate(()=> closeEdgePopover());
    out.ports.moved = await page.evaluate(()=> [edgeStyleFor('tp_b', 'tp_c').toSide, edgeEntrySide('tp_b', 'tp_c')]);

    /* 5. The field over words with stickers in them stands on the words
          and the stickers together, not on the words alone. */
    out.field = await page.evaluate(async ([X, Y])=>{
      const keys = [...stickerMap.keys()].slice(0, 2);
      if(keys.length < 2) return {skipped: true};
      applyEdit(()=>{ workingNodes.push(['tf_s', 'Dghdhx' + keys.map(k=> '{{s:' + k + '}}').join(''), null, null, null, null, {pos:[X + 2000, Y]}]); });
      rebuildChart();
      const n = nodes.get('tf_s');
      vs = 2.5; vx = -n.x * vs + 500; vy = -n.y * vs + 400; applyTransform();
      const g = qNode('.node[data-id="tf_s"]');
      const parts = [...g.querySelectorAll('.node-label-text, .sticker-glyph')].map(e=> e.getBoundingClientRect()).filter(q=> q.width);
      const l = Math.min(...parts.map(q=> q.left)), r = Math.max(...parts.map(q=> q.right));
      selectNode('tf_s'); openNodeEditor('tf_s');
      await new Promise(ok=> setTimeout(ok, 300));
      const range = document.createRange(); range.selectNodeContents(richFields.get('nodeEditorText').surface);
      const f = range.getBoundingClientRect();
      closeNodeEditor(true);
      return {dx: +(((f.left + f.right) - (l + r)) / 2).toFixed(2), dw: +((f.right - f.left) - (r - l)).toFixed(2)};
    }, [X, Y]);

    /* 6. The wheel turned over a menu zooms the chart under it. */
    await page.evaluate(([X, Y])=>{ vs = 1; vx = -(X + 1200) + 300; vy = -Y + 200; applyTransform(); deselect(); }, [X, Y]);
    const tp = await centreOf('.node[data-id="tp_a"]');
    await page.mouse.move(tp.x, tp.y + 40); await page.mouse.move(tp.x, tp.y);
    await new Promise(ok=> setTimeout(ok, 150));
    const barAt = await centreOf('#styleBar:not([hidden])');
    if(barAt){
      await page.mouse.move(tp.x, (tp.y + barAt.y)/2); await page.mouse.move(barAt.x, barAt.y);
      const vs0 = await page.evaluate(()=> vs);
      await page.mouse.wheel(0, -200);
      await new Promise(ok=> setTimeout(ok, 100));
      out.wheel = [vs0, await page.evaluate(()=> vs)];
    } else out.wheel = ['no bar'];
    await page.mouse.move(5, 940);
    await page.evaluate(()=> closeStyleBar());

    /* 7. A note written along a bend keeps its bar while the hand crosses
          the note's own line to reach it. */
    await page.evaluate(([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['tl_a','Alpha',null,null,null,null,{pos:[X + 3000, Y]}]);
        workingNodes.push(['tl_b','Beta','tl_a',null,null,null,{pos:[X + 3300, Y + 200]}]);
        EDGE_STYLES.push({from:'tl_a', to:'tl_b', routing:'orthogonal', dash:'solid', arrow:true,
                          note:'Along the bend here', noteAlong:true, noteAt:0.45});
        workingNodes.push(['tl_k','A remark here','',null,null,'callout',{pos:[X + 3450, Y + 380], leader:{from:'tl_a', to:'tl_b', at:0.95}}]);
      });
      vs = 1.5; vx = -(X + 3000) * vs + 300; vy = -Y * vs + 250; applyTransform();
      rebuildChart();
    }, [X, Y]);
    const glyph = await page.evaluate(()=>{
      const e = document.querySelector('.edge-note[data-from="tl_a"] text.edge-note-along');
      if(!e) return null;
      const p = e.getStartPositionOfChar(Math.floor(e.getNumberOfChars() / 2)), m = e.getScreenCTM();
      return {x: p.x * m.a + m.e, y: p.y * m.d + m.f - 3};
    });
    const kinds = [];
    if(glyph){
      await page.mouse.move(glyph.x + 30, glyph.y); await page.mouse.move(glyph.x, glyph.y);
      await new Promise(ok=> setTimeout(ok, 120));
      const bar = await centreOf('#styleBar:not([hidden])');
      if(bar) for(let i = 1; i <= 10; i++){
        await page.mouse.move(glyph.x + (bar.x - glyph.x) * i / 10, glyph.y + (bar.y - glyph.y) * i / 10);
        await new Promise(ok=> setTimeout(ok, 30));
        kinds.push(await page.evaluate(()=> styleBar.hidden ? 'hidden' : styleBarTarget.kind));
      }
      await new Promise(ok=> setTimeout(ok, 400));
      kinds.push(await page.evaluate(()=> styleBar.hidden ? 'hidden' : styleBarTarget.kind));
    }
    out.along = kinds;

    /* 8. A note's ground square shows the ground it is drawn on, and the
          ⟲ beside it gives the default back. */
    const bgRow = '#styleBar [data-group="noteBg"]';
    await page.evaluate(()=>{
      const o = EDGE_STYLES.find(s=> s.from === 'tl_a' && s.to === 'tl_b');
      applyEdit(()=>{ o.noteBg = '#ffee88'; });
    });
    const reset = await centreOf(bgRow + ' .hex-reset');
    out.ground = {before: await page.evaluate((sel)=> document.querySelector(sel + ' .hex-square').style.background, bgRow)};
    if(reset){
      await page.mouse.move(reset.x, reset.y); await page.mouse.click(reset.x, reset.y);
      await new Promise(ok=> setTimeout(ok, 120));
    }
    Object.assign(out.ground, await page.evaluate((sel)=>{
      const sq = document.querySelector(sel + ' .hex-square');
      const o = EDGE_STYLES.find(s=> s.from === 'tl_a' && s.to === 'tl_b');
      return {after: sq.style.background, inherited: sq.classList.contains('inherited'), kept: !!(o && o.noteBg)};
    }, bgRow));
    await page.mouse.move(5, 940);
    await page.evaluate(()=> closeStyleBar());

    /* 9. A callout's card turned to a shelf from its bar leaves the bar,
          and the button pressed, under the hand. */
    const card = await centreOf('.node[data-id="tl_k"]');
    await page.mouse.move(card.x - 30, card.y + 60); await page.mouse.move(card.x, card.y);
    await new Promise(ok=> setTimeout(ok, 150));
    const shelf = await centreOf('#styleBar [data-group="leaderForm"] button[data-value="shelf"]');
    const shelfOut = [];
    if(shelf && shelf.w){
      await page.mouse.move(card.x, (card.y + shelf.y)/2); await page.mouse.move(shelf.x, shelf.y);
      await page.mouse.click(shelf.x, shelf.y);
      await new Promise(ok=> setTimeout(ok, 500));
      shelfOut.push(await page.evaluate(()=> !styleBar.hidden && !!(nodes.get('tl_k').leader || {}).shelf));
      await page.mouse.click(shelf.x, shelf.y);
      await new Promise(ok=> setTimeout(ok, 500));
      shelfOut.push(await page.evaluate(()=> !styleBar.hidden && !(nodes.get('tl_k').leader || {}).shelf));
    }
    out.shelf = shelfOut;
  } finally {
    await page.mouse.move(5, 940);
    await page.evaluate(()=>{
      closeStyleBar(); closeTouchMenu(); closeNodeEditor(false);
      const k = window.__keep29;
      applyEdit(()=>{ workingNodes.length = 0; k.nodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; k.styles.forEach(x=> EDGE_STYLES.push(x)); });
      deselect(); rebuildChart();
    });
  }
  check('a right click on a merge\'s bar or junction opens the chart\'s menu, not the browser\'s',
        out.menus.length === 2 && out.menus.every(m=> m === true), JSON.stringify(out.menus));
  check('a merge carried with its lineages keeps its arrow\'s corners where they were on it',
        new Set(out.carried).size === 1, JSON.stringify(out.carried));
  check('a merge carried by its junction with Shift lines up on another entry\'s middle, with a guide', out.junctionGuide);
  check('only lines into one port of an entry merge, and only those',
        out.ports.sides.join() === 'top,left,top' && out.ports.a && !out.ports.b &&
        JSON.stringify(out.ports.merged) === '["tp_a","tp_d"]', JSON.stringify(out.ports));
  check('a connector\'s end is carried onto another port of its entry',
        out.ports.grip && out.ports.moved.join() === 'bottom,bottom', JSON.stringify(out.ports));
  check('the field over words with stickers stands on the words and the stickers together',
        out.field.skipped || (Math.abs(out.field.dx) < 1 && Math.abs(out.field.dw) < 2), JSON.stringify(out.field));
  check('the wheel over a menu zooms the chart', out.wheel.length === 2 && out.wheel[1] > out.wheel[0] * 1.1,
        JSON.stringify(out.wheel));
  check('a note along a bend keeps its bar while the hand crosses its line to it',
        out.along.length > 5 && out.along.every(k=> k === 'note'), JSON.stringify(out.along));
  check('a note\'s ground square shows the ground drawn, and its ⟲ gives the default back',
        /255, 238, 136/.test(out.ground.before) && out.ground.inherited && !out.ground.kept, JSON.stringify(out.ground));
  check('a callout turned to a shelf from its bar, and back, keeps the bar under the hand',
        out.shelf.length === 2 && out.shelf.every(Boolean), JSON.stringify(out.shelf));
  });

  await scenario("the owner's list of 30.10: grips clear of corners, squares that show the default, a note along its line rewritten, cards and chips, a bar that stays", async () => {
  await page.evaluate(()=>{
    window.__keep30 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    return true;
  });
  const X = 99000, Y = 99000;
  const out = {};
  const centreOf = (sel)=> page.evaluate((sel)=>{
    const e = document.querySelector(sel); if(!e) return null;
    const b = e.getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height/2, w: b.width, h: b.height};
  }, sel);
  try{
    await page.mouse.move(5, 940);
    /* 1. A connector's end grip steps clear of a corner set beside its
          port; a merge's lineage and its merged arrow have one each, and
          the arrow's is carried onto another port. */
    Object.assign(out, await page.evaluate(async ([X, Y])=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const r = {};
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      applyEdit(()=>{
        workingNodes.push(['to_x','Ex',null,null,null,null,{pos:[X + 600, Y]}]);
        workingNodes.push(['to_y','Why','to_x',null,null,null,{pos:[X + 800, Y + 300]}]);
        workingNodes.push(['to_a','Alpha',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['to_b','Beta',null,null,null,null,{pos:[X + 200, Y]}]);
        workingNodes.push(['to_m','Gamma',['to_a','to_b'],null,null,null,{pos:[X + 100, Y + 300], merge:true}]);
      });
      rebuildChart();
      const p0 = drawnRoutes.get(calloutEdgeKey('to_x', 'to_y')).pts[0];
      setBendList('to_x', 'to_y', [[p0.x, p0.y + 6]]);
      rebuildChart();
      openEdgeStylePopover('to_x', 'to_y', {clientX:500, clientY:400, stopPropagation(){}});
      await wait(120);
      const marks = [...bendLayer.querySelectorAll('.bend-mark')].map(c=> [+c.getAttribute('cx'), +c.getAttribute('cy')]);
      const grips = [...bendLayer.querySelectorAll('.bend-end .bend-hit')].map(c=> [+c.getAttribute('cx'), +c.getAttribute('cy')]);
      r.gripGap = Math.min(...grips.flatMap(g=> marks.map(m=> Math.hypot(g[0] - m[0], g[1] - m[1]))));
      r.gripCount = grips.length;
      closeEdgePopover();
      openEdgeStylePopover('to_a', 'to_m', {clientX:500, clientY:400, stopPropagation(){}});
      await wait(120);
      r.memberEnds = [...bendLayer.querySelectorAll('.bend-end')].map(g=> g.dataset.end).join();
      closeEdgePopover();
      openEdgeStylePopover('', 'to_m', {clientX:500, clientY:400, stopPropagation(){}});
      await wait(120);
      r.arrowEnds = [...bendLayer.querySelectorAll('.bend-end')].map(g=> g.dataset.end).join();
      closeEdgePopover();
      const side0 = mergedArrowPorts.get('to_m').p2.side;
      const next = side0 === 'left' ? 'right' : 'left';
      movePortTo('', 'to_m', 'to', next, 0);
      rebuildChart();
      r.arrowMoved = [side0, mergedArrowPorts.get('to_m').p2.side, next];
      return r;
    }, [X, Y]));

    /* 3. Squares with no colour of their own show the one in use, and
          open on it without making it a choice. */
    Object.assign(out, await page.evaluate(async ([X, Y])=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const r = {};
      openEdgeStylePopover('to_x', 'to_y', {clientX:500, clientY:400, stopPropagation(){}});
      styleFillSel.value = 'custom'; styleFillSel.dispatchEvent(new Event('change'));
      styleGradientBtn.click();
      await wait(60);
      const sq = styleColor2Input._hexSquare;
      r.second = {cls: sq.square.className, bg: sq.square.style.background};
      sq.open();
      r.second.opened = styleColor2Input.value;
      sq.close(true);
      r.second.after = styleColor2Input.value;
      r.second.kept = JSON.stringify(EDGE_STYLES.find(e=> e.from === 'to_x' && e.to === 'to_y').gradient || null);
      closeEdgePopover();
      return r;
    }, [X, Y]));
    out.legend = await page.evaluate(()=>{
      const row = buildTagRow('to-no-colour', null);
      document.body.appendChild(row);
      const sw = row.querySelector('.swatch-unset');
      const r = sw ? {bg: getComputedStyle(sw).backgroundColor, outline: getComputedStyle(sw).outlineStyle} : null;
      row.remove();
      return r;
    });

    /* 4. A note written along its line opens its field and is rewritten;
          it stands where a level note stands, and its frame is closed. */
    out.along = await page.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      applyEdit(()=>{
        EDGE_STYLES.push({from:'to_a', to:'to_b', routing:'orthogonal', dash:'solid', arrow:true,
                          note:'hello', noteAlong:true, noteAlongFrame:true});
      });
      applyEdit(()=>{ const f = workingEntry('to_b'); const o = entryOpts(f.entry); f.entry[2] = 'to_a'; putEntry(f.index, f.entry, o); });
      rebuildChart();
      const r = {};
      const g = ()=> document.querySelector('.edge-note[data-from="to_a"][data-to="to_b"]');
      const frame = g().querySelector('.edge-note-along-frame'), ground = g().querySelector('.edge-note-along-ground');
      r.frameLonger = !!(frame && ground) && frame.getTotalLength() > ground.getTotalLength() + 1;
      const path = g().querySelector('.edge-note-along-path');
      const route = drawnRoutes.get(calloutEdgeKey('to_a', 'to_b')).pts;
      const q = path.getPointAtLength(path.getTotalLength() / 2);
      r.offset = +(Math.abs(q.y - route[0].y)).toFixed(2);
      r.opened = openEdgeNoteEditor('to_a', 'to_b');
      await wait(60);
      setRichValue(nodeEditorText, 'hello there');
      richFields.get('nodeEditorText').surface.dispatchEvent(new Event('input', {bubbles:true}));
      closeNodeEditor(true);
      await wait(60);
      r.note = edgeStyleFor('to_a', 'to_b').note;
      r.alongAgain = !!g().querySelector('.edge-note-along');
      return r;
    });

    /* 5. A long press on a merge's bar is that lineage's menu. */
    out.barMenu = await page.evaluate(()=>{
      const hit = document.querySelector('.amalgam-bar-hit[data-amalgam="to_m"]');
      return hit ? touchMenuFor({held: true, target: hit}) : null;
    });

    /* 6. A split's dot is carried along its line. */
    const split = await page.evaluate(([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['to_p','Pe',null,null,null,null,{pos:[X, Y + 700]}]);
        workingNodes.push(['to_q','Qu','to_p',null,null,null,{pos:[X + 400, Y + 700]}]);
      });
      rebuildChart();
      const id = splitEdgeAt('to_p', 'to_q', 0.5);
      rebuildChart();
      vs = 1; vx = -X + 300; vy = -Y - 400; applyTransform();
      const n = nodes.get(id), b = document.querySelector(`.node[data-id="${id}"]`).getBoundingClientRect();
      return {id, y: n.y, x: n.x, sx: b.x + b.width/2, sy: b.y + b.height/2};
    }, [X, Y]);
    await page.mouse.move(split.sx, split.sy); await page.mouse.down();
    for(let i = 1; i <= 8; i++){ await page.mouse.move(split.sx + i * 7, split.sy + i * 4); }
    await page.mouse.up();
    await new Promise(ok=> setTimeout(ok, 120));
    out.split = await page.evaluate(([id, x, y])=>{ const n = nodes.get(id); return {dx: +(n.x - x).toFixed(2), dy: +(n.y - y).toFixed(2)}; }, [split.id, split.x, split.y]);
    /* …and back again, the way it came, by the dot and nothing else: no
       grips or connector strips stand over it to take the hand instead,
       and the pointer over it is the two-headed arrow of its line (the
       owner's list of 19.11). */
    const back = await page.evaluate(id=>{
      nodeControlsOn(id);
      const g = document.querySelector(`.node[data-id="${id}"]`), b = g.getBoundingClientRect();
      return {x: nodes.get(id).x, sx: b.x + b.width/2, sy: b.y + b.height/2,
              bare: !g.querySelector('.node-resize, .node-handle')};
    }, split.id);
    await page.mouse.move(back.sx + 30, back.sy + 30); await page.mouse.move(back.sx, back.sy);
    out.splitCursor = await page.evaluate(([x, y])=> getComputedStyle(document.elementFromPoint(x, y)).cursor, [back.sx, back.sy]);
    await page.mouse.down();
    for(let i = 1; i <= 8; i++){ await page.mouse.move(back.sx - i * 7, back.sy - i * 4); }
    await page.mouse.up();
    await new Promise(ok=> setTimeout(ok, 120));
    out.splitBack = {bare: back.bare, dx: +(await page.evaluate(id=> nodes.get(id).x, split.id) - back.x).toFixed(2)};

    /* 7. Cards: a picture as wide as the heading, stopping at its rule; a
          wavy card no bigger than a plain one; chips inside the box; no
          hints after the field names. */
    out.card = await page.evaluate(async ([X, Y])=>{
      const c = document.createElement('canvas'); c.width = 300; c.height = 600;
      const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 300, 600);
      const url = c.toDataURL('image/png');
      await new Promise(ok=>{ const im = new Image(); im.onload = ok; im.src = url; });
      applyEdit(()=>{
        if(!mediaTypeById('line')) (SETTINGS.mediaTypes = SETTINGS.mediaTypes || []).push({id:'line', name:'Line', fields:[{id:'f1', label:'Line'}]});
        workingNodes.push(['to_c1','Card',null,null,'n',null,{pos:[X, Y + 1000], card:true, image:url, mediaType:'line', mediaData:{f1:'M'}}]);
        workingNodes.push(['to_c2','Card',null,null,'n',null,{pos:[X + 300, Y + 1000], card:true, image:url, mediaType:'line', mediaData:{f1:'M'}, border:'wavy'}]);
        workingNodes.push(['to_c3','Hi',null,null,null,null,{pos:[X + 600, Y + 1000], card:true, multiLang:true,
                           langTabs:[{tag:'JP',text:'a'},{tag:'RU',text:'b'},{tag:'DE',text:'c'}]}]);
      });
      rebuildChart();
      await new Promise(ok=> setTimeout(ok, 200));
      rebuildChart();
      const r = {};
      const c1 = nodes.get('to_c1'), c2 = nodes.get('to_c2'), c3 = nodes.get('to_c3');
      r.band = [c1.cardTop, +(c1.w * 2).toFixed(2)];
      const img = document.querySelector('.node[data-id="to_c1"] > image');
      r.imgBottom = img ? +(+img.getAttribute('y') + +img.getAttribute('height') - c1.y).toFixed(2) : null;
      r.ruleHalf = NODE_BORDER_W / 2;
      /* Since the owner's list of 2.11 a band's words stand off a rule as
         they would off the border of an entry of their own, and only the
         words that meet the border itself stand off it by the entry's
         inset — here the note, under the picture, heading and middle. So
         a ripple makes the card taller by what it adds to that inset
         once, and no wider, nor its picture smaller. */
      r.wavy = [+(c2.w - c1.w).toFixed(2), +(c2.h - c1.h).toFixed(2), +(textInsetFor(c2) - textInsetFor(c1)).toFixed(2)];
      r.chips = [c3.w, c3.chipRight - c3.x];
      r.labels = ['editMediaTypeSelect', 'editImageInput', 'freeMenuImageUrl']
        .map(id=> document.querySelector(`label[for="${id}"]`).textContent).join('|');
      return r;
    }, [X, Y]);

    /* 8. A style bar choice leaves the bar where it was. */
    const node = await page.evaluate(([X, Y])=>{
      applyEdit(()=>{ workingNodes.push(['to_w','Wave me',null,null,null,null,{pos:[X + 900, Y + 1000],
                       multiLang:true, langTabs:[{tag:'JP',text:'a'}]}]); });
      rebuildChart();
      vs = 2; vx = -(X + 900) * 2 + 500; vy = -(Y + 1000) * 2 + 400; applyTransform();
      const b = document.querySelector('.node[data-id="to_w"]').getBoundingClientRect();
      return {x: b.x + b.width/2, y: b.y + b.height/2};
    }, [X, Y]);
    await page.mouse.move(node.x, node.y);
    await new Promise(ok=> setTimeout(ok, 450));
    const face = await centreOf('#styleBar .style-bar-group[data-group="border"] .style-bar-drop-face');
    const bar = [];
    if(face){
      await page.mouse.move(face.x, face.y);
      bar.push(await page.evaluate(()=> styleBar.style.top));
      await page.mouse.click(face.x, face.y);
      const wavy = await centreOf('#styleBar .style-bar-group[data-group="border"] button[data-value="wavy"]');
      await page.mouse.move(wavy.x, wavy.y);
      await page.mouse.click(wavy.x, wavy.y);
      await new Promise(ok=> setTimeout(ok, 60));
      bar.push(await page.evaluate(()=> styleBar.style.top), await page.evaluate(()=> borderStyleOf(nodes.get('to_w'))));
    }
    out.bar = bar;

    /* 9. A drawer shutting goes under its tab. */
    out.tab = await page.evaluate(()=>{
      const t = document.getElementById('tagsPanel');
      t.classList.remove('open'); t.classList.add('shutting');
      const z = getComputedStyle(t.querySelector('.side-tab-handle')).zIndex;
      t.classList.remove('shutting');
      return z;
    });
  } finally {
    await page.mouse.move(5, 940);
    await page.evaluate(()=>{
      closeStyleBar(); closeTouchMenu(); closeNodeEditor(false); closeEdgePopover();
      const k = window.__keep30;
      applyEdit(()=>{ workingNodes.length = 0; k.nodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; k.styles.forEach(x=> EDGE_STYLES.push(x)); });
      deselect(); rebuildChart();
    });
  }
  check('a connector\'s end grip stands clear of a corner set beside its port',
        out.gripCount === 2 && out.gripGap >= 2 * 4.2 + 4 - 0.01, JSON.stringify({gap: out.gripGap, n: out.gripCount}));
  check('a merge\'s lineage and its arrow have a grip at their entry\'s end, and the arrow\'s end is carried to another port',
        out.memberEnds === 'from' && out.arrowEnds === 'to' && out.arrowMoved[1] === out.arrowMoved[2],
        JSON.stringify({m: out.memberEnds, a: out.arrowEnds, moved: out.arrowMoved}));
  check('a gradient\'s second square shows the colour in use and opens on it without choosing it',
        /inherited/.test(out.second.cls) && !!out.second.bg && /^#[0-9a-f]{6}$/i.test(out.second.opened) &&
        out.second.after === '' && out.second.kept === 'null', JSON.stringify(out.second));
  check('a tag with no colour shows the default ink, dashed', !!out.legend &&
        (out.legend.bg !== 'rgba(0, 0, 0, 0)' && out.legend.outline === 'dashed'), JSON.stringify(out.legend));
  check('a note along its line is rewritten in its field, stands where a level note stands, and its frame is closed',
        out.along.opened && out.along.note === 'hello there' && out.along.alongAgain && out.along.frameLonger &&
        Math.abs(out.along.offset - 11) < 0.6, JSON.stringify(out.along));
  check('a long press on a merge\'s bar is its lineage\'s menu', out.barMenu === 'bar', String(out.barMenu));
  check('a split\'s dot is carried along its line', out.split.dx > 20 && Math.abs(out.split.dy) < 0.01, JSON.stringify(out.split));
  check('…and back the way it came, taken by the dot alone, under a two-headed arrow of its line (19.11)',
        out.splitBack.bare && out.splitBack.dx < -20 && out.splitCursor === 'ew-resize', JSON.stringify([out.splitBack, out.splitCursor]));
  check('a card\'s picture is as wide as its heading and stops at its rule',
        Math.abs(out.card.band[0] - out.card.band[1]) < 0.6 && Math.abs(out.card.imgBottom - (out.card.band[0] - out.card.ruleHalf)) < 0.05,
        JSON.stringify(out.card));
  check('a wavy card is no wider than a plain one and taller only by its ripple\'s inset, and an entry is as wide as its chips',
        Math.abs(out.card.wavy[0]) < 0.01 && Math.abs(out.card.wavy[1] - out.card.wavy[2]) < 0.05 && out.card.chips[0] >= out.card.chips[1],
        JSON.stringify(out.card));
  check('the fields say what they are and nothing after it', out.card.labels === 'Medium|Portrait|Image', out.card.labels);
  check('a style bar choice leaves the bar where it was', out.bar.length === 3 && out.bar[0] === out.bar[1] && out.bar[2] === 'wavy',
        JSON.stringify(out.bar));
  check('a drawer shutting goes under its tab', out.tab === '1', out.tab);
  });

  await scenario("the owner's list of 31.10: a ripple that keeps the size, an arrow carried off its corners, a picture at its heading's width, rules across spaces, ends that stay put", async () => {
  await page.evaluate(()=>{
    window.__keep31 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    return true;
  });
  const X = 131000, Y = 131000;
  let out = {};
  try{
    out = await page.evaluate(async ([X, Y])=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const r = {};
      /* Whether a route turns twice within two corners' width, comes
         back on itself, or carries a head on its last corner. */
      const kinks = (pts, head)=>{
        const P = pts.filter((q, i)=> !i || Math.hypot(q.x - pts[i-1].x, q.y - pts[i-1].y) > 0.05);
        const seg = P.slice(1).map((b, i)=> ({dx: b.x - P[i].x, dy: b.y - P[i].y, len: Math.hypot(b.x - P[i].x, b.y - P[i].y)}));
        const turn = (u, v)=>{ const c = (u.dx*v.dy - u.dy*v.dx) / (u.len*v.len || 1); return Math.abs(c) < 0.3 ? 0 : Math.sign(c); };
        const bad = [];
        for(let i = 1; i < seg.length - 1; i++)
          if(seg[i].len < 2 * EDGE_CORNER_R && turn(seg[i-1], seg[i]) && turn(seg[i], seg[i+1])) bad.push('step');
        for(let i = 0; i < seg.length - 1; i++)
          if(seg[i].dx*seg[i+1].dx + seg[i].dy*seg[i+1].dy < -0.01*seg[i].len*seg[i+1].len) bad.push('back');
        if(head && seg.length > 1 && turn(seg[seg.length-2], seg[seg.length-1]) && seg[seg.length-1].len < ARROW_LEN + 2) bad.push('head');
        return bad;
      };
      const route = (f, t)=> drawnRoutes.get(calloutEdgeKey(f, t)).pts;

      /* 1. A ripple keeps the entry's size, give or take its troughs. */
      applyEdit(()=>{
        workingNodes.push(['o31_p','Beast Wars',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['o31_w','Beast Wars',null,null,null,null,{pos:[X, Y + 100], border:'wavy'}]);
      });
      rebuildChart();
      const P = nodes.get('o31_p'), W = nodes.get('o31_w');
      r.wavy = [round2(W.w - P.w), round2(W.h - P.h), round2((W.x + W.w/2) - (P.x + P.w/2))];

      /* 2. A bent merged arrow is carried onto another port, and its
            corners go with the new face. */
      applyEdit(()=>{
        workingNodes.push(['o31_a','Alpha',null,null,null,null,{pos:[X + 600, Y]}]);
        workingNodes.push(['o31_b','Beta',null,null,null,null,{pos:[X + 800, Y]}]);
        workingNodes.push(['o31_m','Merged',['o31_a','o31_b'],null,null,null,{pos:[X + 700, Y + 300], merge:true}]);
      });
      rebuildChart();
      const m = nodes.get('o31_m');
      setEdgeStyleOverride('', 'o31_m', Object.assign({}, edgeStyleFor('', 'o31_m'),
        {gradient:['#cc22cc', '#22cc22'], bends:[[m.x + m.w/2 - 60, m.y - 30]], bendSides:['bottom', 'top']}));
      rebuildChart();
      const side0 = mergedArrowPorts.get('o31_m').p2.side;
      movePortTo('', 'o31_m', 'to', 'left', 0);
      rebuildChart();
      r.arrow = {side0, side: mergedArrowPorts.get('o31_m').p2.side, pin: (edgeStyleFor('', 'o31_m').bendSides || []).join()};

      /* 3. A picture comes in at its heading's width. */
      const c = document.createElement('canvas'); c.width = 400; c.height = 200;
      c.getContext('2d').fillRect(0, 0, 400, 200);
      const pic = c.toDataURL('image/png');
      applyEdit(()=>{ workingNodes.push(['o31_c','Optimus Prime',null,null,null,null,{pos:[X, Y + 600], card:true}]); });
      rebuildChart();
      const w0 = nodes.get('o31_c').w;
      applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'o31_c'); e[6] = Object.assign({}, e[6], {image: pic}); });
      rebuildChart(); await wait(300); rebuildChart();
      const img = document.querySelector('.node[data-id="o31_c"] image');
      r.card = [w0, nodes.get('o31_c').w, img ? +img.getAttribute('width') : null];

      /* 4. A picked entry's chips glow with its border. */
      applyEdit(()=>{ workingNodes.push(['o31_l','Beast Wars',null,null,null,null,{pos:[X, Y + 900],
                        multiLang:true, langTabs:[{tag:'JP',text:'a'}]}]); });
      rebuildChart();
      selectNode('o31_l');
      /* Since 25.11 the glow is one halo round the outline and its tabs
         together, traced at the back of the entry (drawSelectionHalo). */
      const haloOf = (id)=>{
        const h = document.querySelector(`.node[data-id="${id}"] > .node-halo`);
        return h && h.querySelector('g') ? getComputedStyle(h).filter : 'none';
      };
      r.chipGlow = haloOf('o31_l');
      deselect();
      applyEdit(()=>{ workingNodes.push(['o31_k','Beast Wars',null,null,null,null,{pos:[X + 300, Y + 900],
                        link:'https://example.com/'}]); });
      rebuildChart();
      selectNode('o31_k');
      r.linkGlow = haloOf('o31_k');
      deselect();

      /* 5. A rule runs across the spaces it was put on. */
      applyEdit(()=>{
        workingNodes.push(['o31_u1','A{{u:solid| }}B',null,null,null,null,{pos:[X, Y + 1200]}]);
        workingNodes.push(['o31_u2','{{u:dashed|Beast Wars: }}Uprising',null,null,null,null,{pos:[X, Y + 1300]}]);
      });
      rebuildChart();
      const rules = id=> [...document.querySelectorAll(`.node[data-id="${id}"] .text-underline`)];
      const u2 = rules('o31_u2'), up = [...document.querySelectorAll('.node[data-id="o31_u2"] tspan')]
        .find(t=> t.textContent === 'Uprising');
      r.rules = [rules('o31_u1').length, u2.length,
                 u2.length && up ? round2(up.getStartPositionOfChar(0).x - +u2[0].getAttribute('x2')) : null];

      /* 6. Lines with no kinks: two entries one over the other with words
            of different lengths; the same joined top to top; two facing
            across a narrow gap; a merged arrow into a near entry; and the
            whole of the owner's chart. */
      applyEdit(()=>{
        workingNodes.push(['o31_s1','Alpha',null,null,null,null,{pos:[X + 1600, Y]}]);
        workingNodes.push(['o31_s2','Beta','o31_s1',null,null,null,{pos:[X + 1600, Y + 160]}]);
        workingNodes.push(['o31_t1','Alpha',null,null,null,null,{pos:[X + 2000, Y + 200]}]);
        workingNodes.push(['o31_t2','Beta','o31_t1',null,null,null,{pos:[X + 2000, Y]}]);
        workingNodes.push(['o31_f1','Alpha',null,null,null,null,{pos:[X + 2400, Y]}]);
        workingNodes.push(['o31_f2','Beta','o31_f1',null,null,null,{pos:[X + 2360, Y + 120]}]);
        workingNodes.push(['o31_n1','Alpha',null,null,null,null,{pos:[X + 2800, Y]}]);
        workingNodes.push(['o31_n2','Beta Longer',null,null,null,null,{pos:[X + 2920, Y]}]);
        workingNodes.push(['o31_nm','Merged',['o31_n1','o31_n2'],null,null,null,{pos:[X + 2780, Y + 60], merge:true}]);
      });
      setEdgeStyleOverride('o31_t1', 'o31_t2', Object.assign({}, edgeStyleFor('o31_t1', 'o31_t2'), {fromSide:'top', toSide:'top'}));
      setEdgeStyleOverride('o31_f1', 'o31_f2', Object.assign({}, edgeStyleFor('o31_f1', 'o31_f2'), {fromSide:'left', toSide:'right'}));
      rebuildChart();
      const T2 = nodes.get('o31_t2');
      /* Their middles a few pixels apart, both ends stay on them: a
         connector does not move along its port (the owner, 31.10). */
      {
        const S = route('o31_s1', 'o31_s2'), A = nodes.get('o31_s1'), B = nodes.get('o31_s2');
        r.stack = [round2(S[0].x - (A.x + A.w/2)), round2(S[S.length-1].x - (B.x + B.w/2))];
      }
      r.topTop = route('o31_t1', 'o31_t2').every((q, i, a)=> !i || !segIntersectsRect(a[i-1].x, a[i-1].y, q.x, q.y,
        {x0: T2.x + 1, y0: T2.y + 1, x1: T2.x + T2.w - 1, y1: T2.y + T2.h - 1}));
      r.facing = kinks(route('o31_f1', 'o31_f2'), false);
      r.merged = kinks(route('', 'o31_nm'), true);
      return r;
    }, [X, Y]);
  } finally {
    await page.evaluate(()=>{
      closeStyleBar(); closeEdgePopover(); deselect();
      const k = window.__keep31;
      applyEdit(()=>{ workingNodes.length = 0; k.nodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; k.styles.forEach(x=> EDGE_STYLES.push(x)); });
      rebuildChart();
    });
  }
  /* A step a few pixels wide stays where the ports put it (the owner,
     31.10: an end does not move along its port), but no line on the
     owner's chart may run back on itself. */
  out.owner = await page.evaluate(()=>{
    const bad = [];
    drawnRoutes.forEach(rt=>{
      const st = edgeStyleFor(rt.from, rt.to);
      if(st.routing !== 'orthogonal' && st.routing !== 'curve') return;
      const P = rt.pts.filter((q, i, a)=> !i || Math.hypot(q.x - a[i-1].x, q.y - a[i-1].y) > 0.05);
      for(let i = 1; i < P.length - 1; i++){
        const u = {x: P[i].x - P[i-1].x, y: P[i].y - P[i-1].y}, v = {x: P[i+1].x - P[i].x, y: P[i+1].y - P[i].y};
        if(u.x*v.x + u.y*v.y < -0.01 * Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) bad.push(rt.from + '>' + rt.to);
      }
    });
    return bad;
  });
  check('a ripple keeps an entry\'s size, half a pixel a side aside, about the same middle',
        out.wavy[0] <= 1.01 && out.wavy[1] <= 1.01 && Math.abs(out.wavy[2]) < 0.01, JSON.stringify(out.wavy));
  check('a bent merged arrow is carried onto another port, its corners pinned to the new face',
        out.arrow.side0 === 'top' && out.arrow.side === 'left' && out.arrow.pin === 'bottom,left', JSON.stringify(out.arrow));
  check('a card\'s picture comes in at its heading\'s width',
        Math.abs(out.card[0] - out.card[1]) < 0.01 && Math.abs(out.card[2] - out.card[1]) < 0.01, JSON.stringify(out.card));
  check('a picked entry\'s chips glow with its border, as one shape', /sel-halo/.test(out.chipGlow), out.chipGlow);
  check('…and so does its link\'s tab', /sel-halo/.test(out.linkGlow), out.linkGlow);
  check('a rule runs across the spaces it was put on, as one line',
        out.rules[0] === 1 && out.rules[1] === 1 && out.rules[2] !== null && out.rules[2] < 1, JSON.stringify(out.rules));
  check('two entries one over the other keep their ends at their middles, whatever their words',
        out.stack[0] === 0 && out.stack[1] === 0, JSON.stringify(out.stack));
  check('joined top to top, the lower does not run through the upper', out.topTop === true, String(out.topTop));
  check('facing across a narrow gap, neither end runs back on itself', out.facing.length === 0, out.facing.join());
  check('a merged arrow into a near entry keeps its head off the corner', out.merged.length === 0, out.merged.join());
  check('no line on the owner\'s chart runs back on itself', out.owner.length === 0, out.owner.join(' '));
  });
