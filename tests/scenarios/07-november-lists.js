/* tests/scenarios/07-november-lists.js — scenarios 139 to 150 of the suite.
 *
 * The owner's lists of 1.11 to 19.11: merged arrows, notes, figures and
 * gears, media and its kinds, links, ruby, templates, My files.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */

  await scenario("the owner's list of 1.11: a merged arrow keeps its face", async () => {
  await page.evaluate(()=>{
    window.__keep111 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    return true;
  });
  const X = 141000, Y = 141000;
  const out = {};
  try{
    await page.mouse.move(5, 940);
    /* 1. An entry carried past its bar keeps the face its merged arrow
          came in by, and a carry that comes back writes nothing. */
    await page.evaluate(([X, Y])=>{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      applyEdit(()=>{
        workingNodes.push(['o111_a','Alpha',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['o111_b','Beta',null,null,null,null,{pos:[X + 200, Y]}]);
        workingNodes.push(['o111_m','Gamma',['o111_a','o111_b'],null,null,null,{pos:[X + 100, Y + 300], merge:true}]);
      });
      rebuildChart();
    }, [X, Y]);
    const carry = async (dy)=>{
      const c = await page.evaluate(()=>{
        const b = document.querySelector('.node[data-id="o111_m"]').getBoundingClientRect();
        return {x: b.x + b.width/2, y: b.y + b.height/2};
      });
      await page.mouse.move(c.x, c.y); await page.mouse.down();
      for(let i = 1; i <= 12; i++){ await page.mouse.move(c.x, c.y + dy * i / 12); await wait(16); }
      await page.mouse.up(); await wait(120);
      return page.evaluate(()=> [mergedArrowPorts.get('o111_m').p2.side, edgeStyleFor('', 'o111_m').toSide]);
    };
    out.back = await carry(0);
    out.side0 = await page.evaluate(()=> mergedArrowPorts.get('o111_m').p2.side);
    out.across = await carry(-480);
    out.undone = await page.evaluate(()=>{ undoLastEdit(); return [mergedArrowPorts.get('o111_m').p2.side, edgeStyleFor('', 'o111_m').toSide]; });
    /* …and (the owner's list of 2.11) a face chosen by hand is the one a
       carry keeps, as on every connector: unset, the face is autoSides'. */
    await page.evaluate(()=>{
      applyEdit(()=> setEdgeStyleOverride('', 'o111_m', Object.assign({}, edgeStyleFor('', 'o111_m'), {toSide: 'top'})));
      rebuildChart();
    });
    out.handAcross = await carry(-480);
    await page.evaluate(()=>{ undoLastEdit(); undoLastEdit(); rebuildChart(); });
    out.beside = await page.evaluate(([X, Y])=>{
      applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'o111_m'); e[6].pos = [X + 700, Y + 40]; });
      rebuildChart();
      const side = mergedArrowPorts.get('o111_m').p2.side;
      applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'o111_m'); e[6].pos = [X + 100, Y + 300]; });
      rebuildChart();
      return side;
    }, [X, Y]);
    /* 3. A card's picture: the same size rippled or not, the band it
          leaves filled with itself blurred, unlit when the card is picked,
          and kept at its size when the card is resized. */
    out.card = await page.evaluate(async ([X, Y])=>{
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200;
      const cx = cv.getContext('2d'); cx.fillStyle = '#3a7'; cx.fillRect(0, 0, 300, 200);
      const pic = cv.toDataURL();
      applyEdit(()=>{
        workingNodes.push(['o111_c1','Plain',null,null,'A note',null,{pos:[X - 250, Y + 380], card:true, image:pic}]);
        workingNodes.push(['o111_c2','Plain',null,null,'A note',null,{pos:[X + 300, Y + 380], card:true, image:pic, border:'wavy'}]);
      });
      rebuildChart();
      await new Promise(ok=> setTimeout(ok, 250));
      const pics = id=> [...document.querySelectorAll(`.node[data-id="${id}"] > image`)]
        .map(i=> [+i.getAttribute('width'), +i.getAttribute('height')]);
      const backs = id=> document.querySelectorAll(`.node[data-id="${id}"] .card-img-backdrop image`).length;
      const r = {plain: pics('o111_c1'), wavy: pics('o111_c2'), backPlain: backs('o111_c1'), backWavy: backs('o111_c2')};
      selectNode('o111_c1', {quiet: true});
      r.lit = getComputedStyle(document.querySelector('.node[data-id="o111_c1"] > image')).filter;
      deselect();
      return r;
    }, [X, Y]);
    {
      const se = await page.evaluate(()=>{
        nodeControlsOn('o111_c1');
        const b = document.querySelector('.node[data-id="o111_c1"] .node-resize-se').getBoundingClientRect();
        const c = document.querySelector('.node[data-id="o111_c1"]').getBoundingClientRect();
        return {x: b.x + b.width/2 + 2, y: b.y + b.height/2 + 2, cx: c.x + c.width/2, cy: c.y + c.height/2};
      });
      await page.mouse.move(se.cx, se.cy); await page.mouse.move(se.x, se.y); await wait(60);
      await page.mouse.down();
      for(let i = 1; i <= 8; i++){ await page.mouse.move(se.x + i * 8, se.y + i * 10); await wait(16); }
      await page.mouse.up(); await wait(120);
      out.card.resized = await page.evaluate(()=>{
        const n = nodes.get('o111_c1');
        return {size: [n.w, n.h], pic: [...document.querySelectorAll('.node[data-id="o111_c1"] > image')]
                  .map(i=> [+i.getAttribute('width'), +i.getAttribute('height')]),
                back: document.querySelectorAll('.node[data-id="o111_c1"] .card-img-backdrop image').length,
                kept: [n.cardImgW, n.cardImgH]};
      });
    }
    /* 5. A curve out of a port's short stub into a long run swings out
          of its entry rather than turning in a couple of units, with a
          head at that end or without one. */
    out.curve = await page.evaluate(async ([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['o111_s','From',null,null,null,null,{pos:[X - 600, Y]}]);
        workingNodes.push(['o111_t','To','o111_s',null,null,null,{pos:[X - 340, Y - 150]}]);
        EDGE_STYLES.push({from:'o111_s', to:'o111_t', routing:'curve', dash:'solid', arrow:true,
                          arrowIn:true, fromSide:'bottom', toSide:'bottom'});
      });
      rebuildChart();
      const d = document.querySelector('.edge[data-from="o111_s"][data-to="o111_t"]').getAttribute('d');
      const P = (d.match(/-?[\d.]+,-?[\d.]+/g) || []).map(t=>{ const [x, y] = t.split(',').map(Number); return {x, y}; });
      /* The hook the owner circled ran back under the entry before it
         set off: leaving by the bottom for an entry off to the right, the
         line went left first. Along the whole line it only goes right. */
      let back = 0;
      for(let i = 1; i < P.length; i++) back = Math.max(back, P[i-1].x - P[i].x);
      /* …and its head comes into the entry along the port, not on the
         slant of a line already turning away under it. */
      const heads = curveHeads(drawnRoutes.get(calloutEdgeKey('o111_s', 'o111_t')).pts, true, true);
      const tilt = Math.abs(((heads.in + 90) % 360 + 540) % 360 - 180);
      return {back: +back.toFixed(2), tilt: +tilt.toFixed(1), n: P.length};
    }, [X, Y]);
    /* 6. A note along its line is framed as a level one is — the frame as
          far from the words, the words in its middle — and sits on the
          same kind of ground, framed or not. */
    out.noteFrames = await page.evaluate(async ([X, Y])=>{
      applyEdit(()=>{
        const base = {routing:'orthogonal', dash:'solid', arrow:true, note:'Note gyp', notePos:'above'};
        [['lv', {noteFrame:true}], ['al', {noteAlong:true}], ['ab', {noteAlong:true, noteFrame:false}]].forEach(([k, o], i)=>{
          workingNodes.push(['o111_' + k + 'a','A',null,null,null,null,{pos:[X - 600, Y + 300 + i * 60]}]);
          workingNodes.push(['o111_' + k + 'b','B','o111_' + k + 'a',null,null,null,{pos:[X - 420, Y + 300 + i * 60]}]);
          EDGE_STYLES.push(Object.assign({from:'o111_' + k + 'a', to:'o111_' + k + 'b'}, base, o));
        });
      });
      rebuildChart();
      const g = k=> document.querySelector(`.edge-note[data-from="o111_${k}a"]`);
      const plate = g('lv').querySelector('.edge-note-plate');
      const frame = g('al').querySelector('.edge-note-along-frame');
      /* Where the words' ink stands across the band: the canvas measures
         the letters, the path says where the band's middle is. */
      const word = g('al').querySelector('text.edge-note-along');
      const span = word.querySelector('tspan');
      const ink = noteAlongInk(span.textContent, word);
      const mid = +span.getAttribute('dy') - (ink.up - ink.down) / 2;
      return {plateH: +plate.getAttribute('height') + EDGE_NOTE_FRAME_W, frameW: frame && +frame.getAttribute('stroke-width'),
              off: +mid.toFixed(3), bareGround: !!g('ab').querySelector('.edge-note-along-ground'),
              bareFrame: !!g('ab').querySelector('.edge-note-along-frame')};
    }, [X, Y]);
    /* 7. A hub's echo and a local multiverse's stack, moving, stand again
          and again exactly as they stand still: every quarter (a third)
          of a turn the rings that show are the still ones, at their
          places and strengths. */
    out.scenery = await page.evaluate(async ([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['o111_h','Hub',null,null,null,null,{pos:[X - 600, Y + 600], tags:['multiversal hub']}]);
        workingNodes.push(['o111_m2','Local',null,null,null,null,{pos:[X - 400, Y + 600], tags:['local multiverse']}]);
      });
      rebuildChart();
      const aura = id=> document.querySelector(`.node-aura[data-id="${id}"]`);
      const look = (id)=> [...aura(id).querySelectorAll('.hub-echo, .local-sheet, .hub-echo-more, .local-sheet-more')]
        .map(e=> ({b: e.getBoundingClientRect(), o: +getComputedStyle(e).opacity,
                   w: +getComputedStyle(e).strokeWidth.replace('px', ''), shown: getComputedStyle(e).display !== 'none'}))
        .filter(r=> r.shown && r.o > 0.01)
        .map(r=> [r.b.x, r.b.y, r.b.width, r.b.height, r.o].map(v=> +v.toFixed(1)).join(','))
        .sort();
      const still = {h: look('o111_h'), m: look('o111_m2')};
      /* Set going the way the page sets it going — by picking the entry,
         which writes each piece's delay (applyVisibility) — and then
         stopped at moments of the turn. Adding the class by hand skipped
         that, and passed while the page ran something else. */
      const anims = (name, id)=> document.getAnimations().filter(a=> a.animationName === name && aura(id).contains(a.effect.target));
      const at = (name, id, ms)=>{ anims(name, id).forEach(a=>{ a.pause(); a.currentTime = ms; }); };
      const settle = ()=> new Promise(ok=> requestAnimationFrame(()=> requestAnimationFrame(ok)));
      const moving = [];
      const run = async (id, name, times)=>{
        deselect(); await settle();
        selectNode(id, {quiet: true}); await settle();
        const got = [];
        for(const ms of times){ at(name, id, ms); await settle(); got.push(look(id)); }
        return got;
      };
      const hs = await run('o111_h', 'hub-echo-out', [0, 600, 1800, 2400 * 7 + 1200]);
      const counts = [anims('hub-echo-out', 'o111_h').length];
      at('hub-echo-out', 'o111_h', 300); await settle();
      const between = look('o111_h');
      const ms = await run('o111_m2', 'local-sheet-away', [0, 600, 1200, 1800 * 5 + 600]);
      counts.push(anims('local-sheet-away', 'o111_m2').length);
      hs.forEach((h, i)=> moving.push({h, m: ms[i]}));
      deselect();
      return {still, moving, between, counts};
    }, [X, Y]);
    /* 2. Beside every entry, a link node too, a faint button copies a
          link to it, standing clear of the box and of its right port. */
    const lk = await page.evaluate(([X, Y])=>{
      applyEdit(()=> workingNodes.push(['o111_l','',null,null,null,'link',{pos:[X + 500, Y]}]));
      rebuildChart();
      const g = document.querySelector('.node[data-id="o111_l"]');
      const b = g.getBoundingClientRect();
      return {x: b.x + b.width/2, y: b.y + b.height/2};
    }, [X, Y]);
    await page.mouse.move(lk.x, lk.y); await wait(200);
    out.copy = await page.evaluate(async ()=>{
      const n = nodes.get('o111_l');
      const btn = document.querySelector('.node[data-id="o111_l"] .node-copy-link');
      if(!btn) return null;
      const op = +getComputedStyle(btn).opacity;
      const box = btn.querySelector('.node-copy-link-bg').getBBox();
      const right = n.x + n.w;
      let wrote = null;
      try{
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async t=>{ wrote = t; }}});
        btn.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await new Promise(ok=> setTimeout(ok, 30));
      } finally { delete navigator.clipboard; }
      const local = btn.transform.baseVal.consolidate().matrix;
      return {op, wrote, left: local.e - box.width/2, right, sel: selectedId,
              target: wrote ? entryLinkTarget(wrote) : null};
    });
  } finally {
    await page.evaluate(()=>{
      closeStyleBar(); closeEdgePopover(); deselect();
      const k = window.__keep111;
      applyEdit(()=>{ workingNodes.length = 0; k.nodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; k.styles.forEach(x=> EDGE_STYLES.push(x)); });
      rebuildChart();
    });
  }
  check('a merged arrow, carried past the bar or beside it, keeps its face, and one set by hand (the owner, 3.11)',
        out.side0 === 'top' && out.across[0] === 'top' && !out.across[1] && out.undone[0] === 'top' &&
        out.handAcross[0] === 'top' && out.beside === 'top', JSON.stringify(out));
  check('a curve out of a short stub into a long run swings out of its entry, with no hook under its head',
        out.curve && out.curve.back < 0.05 && out.curve.tilt < 20, JSON.stringify(out.curve));
  {
    const n = out.noteFrames || {};
    check('a note along its line is framed as far from its words as a level one, its words in the middle',
          n.frameW && Math.abs(n.frameW - n.plateH) < 0.6 && Math.abs(n.off) < 0.01, JSON.stringify(n));
    check('…and unframed it sits on a band of ground, as a level one sits on its plate', n.bareGround && !n.bareFrame, JSON.stringify(n));
  }
  {
    const sc = out.scenery || {};
    const near = (a, b)=> a && b && a.length === b.length && a.every((r, i)=>
      r.split(',').every((v, k)=> Math.abs(+v - +b[i].split(',')[k]) <= (k === 4 ? 0.02 : 0.6)));
    check('a hub\'s echo and a local multiverse\'s stack, moving, stand again and again as they stand still',
          sc.still && sc.still.h.length === 3 && sc.still.m.length === 2 &&
          sc.moving.every(f=> near(f.h, sc.still.h) && near(f.m, sc.still.m)) && !near(sc.between, sc.still.h)
          && sc.counts[0] === 4 && sc.counts[1] === 3,
          JSON.stringify(sc));
  }
  check('a faint button beside an entry copies a link to it, outside its box',
        out.copy && out.copy.op > 0.2 && out.copy.op < 0.7 && out.copy.target && out.copy.target.id === 'o111_l'
        && out.copy.left > out.copy.right + 2 && out.copy.sel !== 'o111_l', JSON.stringify(out.copy));
  {
    const c = out.card || {};
    const same = (a, b)=> a && b && a.length === 1 && b.length === 1 && Math.abs(a[0][0] - b[0][0]) < 0.01 && Math.abs(a[0][1] - b[0][1]) < 0.01;
    check('a card\'s picture is drawn the same size when its border is turned wavy', same(c.plain, c.wavy), JSON.stringify(c));
    check('…a picture that fits its band has nothing behind it, and the ripple\'s crests are filled with it blurred',
          c.backPlain === 0 && c.backWavy === 1, JSON.stringify(c));
    check('…a picked card does not light its picture across the rule', c.lit === 'none', c.lit);
    const z = c.resized || {};
    check('…resizing the card keeps its picture\'s size, and fills the band round it',
          z.size && z.size[0] > c.plain[0][0] + 20 && z.pic && z.pic.length === 1
          && Math.abs(z.pic[0][0] - c.plain[0][0]) < 1.5 && Math.abs(z.pic[0][1] - c.plain[0][1]) < 1.5 && z.back === 1
          /* Kept at the picture's own proportion, which is what is seen
             of it inside its slot: a little narrower than the slot when
             the band is shallower than the picture is wide. */
          && Math.abs(z.kept[0] - c.plain[0][0]) < 1.5, JSON.stringify(z));
  }
  check('…a carry back to where it started writes no face, and undo takes it out',
        out.back[1] === null && out.undone[0] === 'top' && out.undone[1] === null, JSON.stringify(out));

  /* 4. On a phone the entry's sheet comes up folded to its heading, opens
        and folds by a swipe on it, and is put away by one more; its field's
        Enter is a new line, and the ✓ settles it. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  const sheet = {};
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(700);
    const id = await pp.evaluate(()=>{
      applyEdit(()=> workingNodes.push(['o111_p','Phone entry',null,null,null,null,{pos:[141000, 141000]}]));
      rebuildChart();
      const n = nodes.get('o111_p'); vs = 1.2; vx = -(n.x - 100) * 1.2; vy = -(n.y - 150) * 1.2; applyTransform();
      return n.id;
    });
    await wait(200);
    const c = await pp.evaluate((id)=>{ const b = document.querySelector(`.node[data-id="${id}"]`).getBoundingClientRect();
      return {x: b.x + b.width/2, y: b.y + b.height/2}; }, id);
    await pp.touchscreen.tap(c.x, c.y); await wait(500);
    const state = ()=> pp.evaluate(()=>{ const d = document.getElementById('detail');
      return {open: d.classList.contains('open'), peek: d.classList.contains('peek'), full: d.classList.contains('full'),
              h: Math.round(d.getBoundingClientRect().height), sel: selectedId}; });
    const cdp = await phone.newCDPSession(pp);
    const swipe = async (dy)=>{
      const h = await pp.evaluate(()=>{ const b = document.querySelector('#detail .detail-head').getBoundingClientRect();
        return {x: b.x + 40, y: b.y + 10}; });
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:h.x, y:h.y}]});
      for(let i = 1; i <= 5; i++){
        await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:h.x, y:h.y + dy * i / 5}]});
        await wait(16);
      }
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await wait(300);
      return state();
    };
    sheet.tapped = await state();
    sheet.up = await swipe(-80);
    sheet.down = await swipe(80);
    sheet.away = await swipe(80);
    /* The field: Enter breaks the line, the ✓ keeps it. */
    await pp.evaluate((id)=> openNodeEditor(id), id); await wait(150);
    await pp.keyboard.press('End'); await pp.keyboard.press('Enter'); await pp.keyboard.type('two');
    await wait(100);
    sheet.typing = await pp.evaluate(()=> ({open: !!nodeEditorTarget, value: document.getElementById('nodeEditorText').value}));
    const d = await pp.evaluate(()=>{ const b = document.getElementById('nodeEditorDone').getBoundingClientRect();
      return {x: b.x + b.width/2, y: b.y + b.height/2, w: b.width}; });
    await pp.touchscreen.tap(d.x, d.y); await wait(300);
    sheet.done = await pp.evaluate((id)=> ({open: !!nodeEditorTarget, label: nodes.get(id).label}), id);
  } finally {
    await phone.close();
  }
  check('on a phone a picked entry\'s sheet comes up folded to its heading',
        sheet.tapped && sheet.tapped.open && sheet.tapped.peek && sheet.tapped.h < 120, JSON.stringify(sheet.tapped));
  check('…a swipe up on its heading opens it, a swipe down folds it, and one more puts it away',
        sheet.up && sheet.up.full && sheet.down.peek && !sheet.away.open && sheet.away.sel === null, JSON.stringify(sheet));
  check('…a phone\'s Enter in a field is a new line, and the field\'s ✓ settles it',
        sheet.typing && sheet.typing.open && /\ntwo$/.test(sheet.typing.value) && sheet.done && !sheet.done.open
        && /\ntwo$/.test(sheet.done.label), JSON.stringify(sheet.typing) + JSON.stringify(sheet.done));
  });

  await scenario("the owner's list of 2.11: a card's blur, a note's width, a line held open, a sheet that follows", async () => {
  const X = 143000, Y = 143000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      /* 1. A card's blurred band keeps its blur while a finger moves the
            view, and at night. */
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
      const cx = cv.getContext('2d'); cx.fillStyle = '#3a7'; cx.fillRect(0, 0, 300, 100);
      applyEdit(()=>{
        workingNodes.push(['o211_c','Card',null,null,'A note',null,{pos:[X, Y], card:true, image:cv.toDataURL(), border:'wavy'}]);
        const base = {routing:'orthogonal', dash:'solid', arrow:true, note:'Note gyp', notePos:'above', noteSquare:false};
        [['lv', {noteFrame:true}], ['al', {noteAlong:true}]].forEach(([k, o], i)=>{
          workingNodes.push(['o211_' + k + 'a','A',null,null,null,null,{pos:[X + 400, Y + i * 80]}]);
          workingNodes.push(['o211_' + k + 'b','B','o211_' + k + 'a',null,null,null,{pos:[X + 600, Y + i * 80]}]);
          EDGE_STYLES.push(Object.assign({from:'o211_' + k + 'a', to:'o211_' + k + 'b'}, base, o));
        });
        workingNodes.push(['o211_t','Typed',null,null,null,null,{pos:[X, Y + 300]}]);
      });
      rebuildChart();
      await new Promise(ok=> setTimeout(ok, 250));
      const back = document.querySelector('.node[data-id="o211_c"] .card-img-backdrop image');
      const blurred = ()=> /url\(/.test(getComputedStyle(back).filter);
      const theme = document.documentElement.getAttribute('data-theme');
      const touch = document.body.classList.contains('touch-input');
      document.body.classList.add('touch-input', 'view-moving');
      r.blurMoving = blurred();
      document.documentElement.setAttribute('data-theme', 'dark');
      r.blurDark = blurred();
      document.body.classList.remove('view-moving');
      if(!touch) document.body.classList.remove('touch-input');
      if(theme) document.documentElement.setAttribute('data-theme', theme);
      else document.documentElement.removeAttribute('data-theme');
      /* 5. Round and framed, a note along its line reaches as far as a
            level one, both ways. */
      const plate = document.querySelector('.edge-note[data-from="o211_lva"] .edge-note-plate');
      const frame = document.querySelector('.edge-note[data-from="o211_ala"] .edge-note-along-frame');
      const pb = plate.getBBox(), fb = frame.getBBox();
      r.note = {plate: [pb.width + EDGE_NOTE_FRAME_W, pb.height + EDGE_NOTE_FRAME_W].map(v=> +v.toFixed(2)),
                along: [fb.width, fb.height].map(v=> +v.toFixed(2))};
      /* 6. A line opened at the end of an entry's field grows the entry
            before anything is typed on it. */
      openNodeEditor('o211_t');
      await new Promise(ok=> setTimeout(ok, 100));
      const h0 = nodes.get('o211_t').h;
      const surface = richFields.get('nodeEditorText').surface;
      const sel = getSelection(); sel.selectAllChildren(surface); sel.collapseToEnd();
      document.execCommand('insertLineBreak');
      surface.dispatchEvent(new Event('input', {bubbles: true}));
      await new Promise(ok=> setTimeout(ok, 120));
      r.grew = [h0, nodes.get('o211_t').h, nodeEditorText.value];
      closeNodeEditor(false);
    } finally {
      applyEdit(()=>{ workingNodes.length = 0; keep.nodes.forEach(x=> workingNodes.push(x));
                      EDGE_STYLES.length = 0; keep.styles.forEach(x=> EDGE_STYLES.push(x)); });
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  check('a card\'s blurred band stays blurred while a finger moves the view, and at night',
        out.blurMoving && out.blurDark, JSON.stringify(out));
  check('a round, framed note along its line reaches exactly as far as a level one',
        out.note && Math.abs(out.note.plate[0] - out.note.along[0]) < 0.3 && Math.abs(out.note.plate[1] - out.note.along[1]) < 0.3,
        JSON.stringify(out.note));
  check('a line opened at the end of a field grows its entry at once, and is not written into the text',
        out.grew && out.grew[1] > out.grew[0] + 4 && !/\n$/.test(out.grew[2]), JSON.stringify(out.grew));

  /* 2. On a phone the sheet comes up without changing its height, follows
        a finger on its heading, and open all the way stays under the top
        bar, however long its form. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  const sheet = {};
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(700);
    await pp.evaluate(()=>{
      applyEdit(()=> workingNodes.push(['o211_p','Phone entry',null,null,'A note\n'.repeat(80),null,{pos:[143000, 143000]}]));
      rebuildChart();
      const n = nodes.get('o211_p'); vs = 1.2; vx = -(n.x - 100) * 1.2; vy = -(n.y - 150) * 1.2; applyTransform();
      window.__sheetH = [];
      const d = document.getElementById('detail');
      let frames = 0;
      const f = ()=>{
        if(d.classList.contains('open')) __sheetH.push(Math.round(d.getBoundingClientRect().height));
        if(++frames < 90) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const c = await pp.evaluate(()=>{ const b = document.querySelector('.node[data-id="o211_p"]').getBoundingClientRect();
      return {x: b.x + b.width/2, y: b.y + b.height/2}; });
    await pp.touchscreen.tap(c.x, c.y); await wait(700);
    sheet.rising = await pp.evaluate(()=> [...new Set(__sheetH.filter(h=> h > 0))]);
    const cdp = await phone.newCDPSession(pp);
    const h = await pp.evaluate(()=>{ const b = document.querySelector('#detail .detail-head').getBoundingClientRect();
      return {x: b.x + 40, y: b.y + 10}; });
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:h.x, y:h.y}]});
    sheet.held = [];
    for(let i = 1; i <= 6; i++){
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:h.x, y:h.y - i * 30}]});
      await wait(60);
      sheet.held.push(await pp.evaluate(()=> Math.round(document.getElementById('detail').getBoundingClientRect().height)));
    }
    for(let i = 7; i <= 30; i++){
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:h.x, y:Math.max(2, h.y - i * 30)}]});
      await wait(16);
    }
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await wait(400);
    sheet.open = await pp.evaluate(()=>{ const d = document.getElementById('detail');
      return {full: d.classList.contains('full'), top: d.getBoundingClientRect().top,
              bar: document.querySelector('.topbar').getBoundingClientRect().bottom}; });
  } finally {
    await phone.close();
  }
  check('on a phone a picked entry\'s sheet rises at the one height, without a jump',
        sheet.rising && sheet.rising.length === 1, JSON.stringify(sheet.rising));
  check('…follows a finger on its heading as it goes',
        sheet.held && sheet.held.length === 6 && sheet.held.every((v, i)=> !i || v > sheet.held[i-1]), JSON.stringify(sheet.held));
  check('…and open all the way, however long its form, stops under the top bar',
        sheet.open && sheet.open.full && sheet.open.top >= sheet.open.bar, JSON.stringify(sheet.open));
  });

  await scenario("the owner's list of 3.11: menus clear of the panel, a note's ink and frame, a card's insets, flowchart figures", async () => {
  const X = 151000, Y = 151000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 100;
      const cx = cv.getContext('2d'); cx.fillStyle = '#37a'; cx.fillRect(0, 0, 200, 100);
      applyEdit(()=>{
        workingNodes.push(['o311_a','A',null,null,null,null,{pos:[X, Y], colors:['#c03030']}]);
        workingNodes.push(['o311_b','B','o311_a',null,null,null,{pos:[X + 260, Y]}]);
        EDGE_STYLES.push({from:'o311_a', to:'o311_b', routing:'orthogonal', dash:'solid', arrow:true,
                          note:'Red words', noteAlong:true});
        if(!mediaTypeById('line')) (SETTINGS.mediaTypes = SETTINGS.mediaTypes || []).push({id:'line', name:'Line', fields:[{id:'f1', label:'Line'}]});
        workingNodes.push(['o311_c','Card heading',null,null,'A body under it',null,
                           {pos:[X, Y + 200], card:true, image:cv.toDataURL(), mediaType:'line', mediaData:{f1:'middle'}}]);
        workingNodes.push(['o311_d','Ready?',null,null,null,null,{pos:[X + 400, Y + 200], figure:'decision'}]);
        workingNodes.push(['o311_e','Next','o311_d',null,null,null,{pos:[X + 400, Y + 420]}]);
        EDGE_STYLES.push({from:'o311_d', to:'o311_e', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom'});
      });
      rebuildChart();
      await wait(250);

      /* 3. A note's field wears its line's ink, and its frame does not go
            with the words' direction. */
      openEdgeNoteEditor('o311_a', 'o311_b');
      await wait(80);
      const rec = richFields.get('nodeEditorText');
      r.ink = rec ? getComputedStyle(rec.surface).color : null;
      closeNodeEditor(true);
      await wait(80);
      r.alongFramed = !!document.querySelector('.edge-note[data-from="o311_a"] .edge-note-along-frame');
      applyEdit(()=>{ const st = EDGE_STYLES.find(x=> x.from === 'o311_a'); delete st.noteAlong; });
      rebuildChart();
      await wait(120);
      const plate = document.querySelector('.edge-note[data-from="o311_a"] .edge-note-plate');
      r.levelFramed = !!plate && !plate.classList.contains('bare');

      /* 4. A card's words stand off its border and its rules by the inset
            every entry's do. */
      {
        const n = nodes.get('o311_c'), g = document.querySelector('.node[data-id="o311_c"]');
        const inset = textInsetFor(n);
        const rules = [...g.querySelectorAll('.card-rule')].map(l=> +l.getAttribute('y1')).sort((a, b)=> a - b);
        const bands = [['node-label-text', rules[0], rules[1]], ['card-medium', rules[1], rules[2]], ['card-body', rules[2], n.y + n.h]];
        r.card = bands.map(([cls, top, bottom])=>{
          const t = g.querySelector('text.' + cls);
          const b = t && inkBoxOf(t, []);
          return b ? [+(b.y - top - inset).toFixed(2), +(bottom - (b.y + b.height) - inset).toFixed(2)] : null;
        });
        const head = g.querySelector('text.node-label-text');
        const hb = inkBoxOf(head, []);
        r.cardSides = hb ? [+(hb.x - n.x).toFixed(2), +(n.x + n.w - hb.x - hb.width).toFixed(2), +inset.toFixed(2)] : null;
      }

      /* 5. Figures: the button beside Default opens them, and a figure is
            drawn as its outline with its words inside and a connector met
            at its point. */
      const def = document.querySelector('#addFabStyles .node-style-btn[data-value="rect"]');
      const more = document.getElementById('addFabCustomize');
      r.besideDefault = !!def && !!more && more.parentElement === def.parentElement;
      openAddFab(); more.click();
      await wait(50);
      r.figureButtons = [...document.querySelectorAll('#addFabFigures .add-fab-figures-grid')[0].querySelectorAll('.node-style-btn')]
        .map(b=> b.dataset.value).join();
      closeAddFab();
      {
        const n = nodes.get('o311_d'), g = document.querySelector('.node[data-id="o311_d"]');
        const outline = g.querySelector(':scope > path');
        r.diamond = outline ? (outline.getAttribute('d').match(/[ML]/g) || []).length : 0;
        const b = inkBoxOf(g.querySelector('text.node-label-text'), []);
        /* Inside the diamond: |dx|/(w/2) + |dy|/(h/2) <= 1 at every corner of the ink. */
        const cxm = n.x + n.w/2, cym = n.y + n.h/2;
        r.wordsInside = !!b && [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
          .every(([px, py])=> Math.abs(px - cxm) / (n.w/2) + Math.abs(py - cym) / (n.h/2) <= 1.0001);
        const line = document.querySelector('.edge[data-from="o311_d"] path.edge-line, .edge[data-from="o311_d"] path, path[data-from="o311_d"]');
        const d = line ? line.getAttribute('d') : '';
        const m = /M\s*([-\d.]+)[ ,]([-\d.]+)/.exec(d);
        r.metAtPoint = m ? [+(+m[1] - cxm).toFixed(2), +(+m[2] - (n.y + n.h)).toFixed(2)] : d;
        r.saved = /"figure":"decision"/.test(chartFileText());
      }
      /* …and a template comes in from an SVG as numbers only: nothing in
         the file runs, its outline is kept for the menu, and an entry
         drawn with it carries its own copy. */
      window.__o311 = 0;
      const t = figureTemplateOfSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onload="window.__o311=1">' +
        '<script>window.__o311=2</' + 'script><g transform="translate(10,10)"><rect width="120" height="60" onclick="window.__o311=3"/>' +
        '<line x1="20" y1="0" x2="20" y2="60"/></g></svg>', 'Box.svg');
      await wait(50);
      r.template = t ? {name: t.name, d: t.d} : null;
      r.ranNothing = window.__o311 === 0;
      if(t){
        applyEdit(()=>{ SETTINGS.figures = cleanFigureTemplates(SETTINGS.figures).concat([t]); });
        const id = addEntryOfFigure({name: t.name, d: t.d});
        closeNodeEditor(true);
        await wait(80);
        r.templateDrawn = !!document.querySelector(`.node[data-id="${id}"] > path`) &&
                          !!document.querySelector(`.node[data-id="${id}"] > path.figure-mark`);
        const file = chartFileText();
        /* Among the chart's own: the owner's chart keeps templates of its
           own, and the one read here goes after them. */
        r.templateKept = /"figures":\[[^\]]*\{"name":"Box"/.test(file) && file.includes('"figure":{"name":"Box"');
        applyEdit(()=>{ delete SETTINGS.figures; });
        rebuildChart();
        r.entryKeepsIt = !!document.querySelector(`.node[data-id="${id}"] > path.figure-mark`);
      }
    } finally {
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  check('a note\'s field is written in its line\'s ink, not the default black', out.ink === 'rgb(192, 48, 48)', String(out.ink));
  check('a note framed along its line is still framed once it is level again',
        out.alongFramed && out.levelFramed, JSON.stringify([out.alongFramed, out.levelFramed]));
  check('a card\'s heading, middle and body each stand the entry\'s inset off the rules and the border',
        Array.isArray(out.card) && out.card.every(v=> v && Math.abs(v[0]) < 0.6 && Math.abs(v[1]) < 0.6) &&
        out.cardSides && out.cardSides[0] >= out.cardSides[2] - 0.6 && out.cardSides[1] >= out.cardSides[2] - 0.6,
        JSON.stringify({bands: out.card, sides: out.cardSides}));
  check('beside Default stands the button that opens the flowchart figures, all of them',
        out.besideDefault && out.figureButtons === 'decision,terminator,data,predefined,document,database,manualInput,manualOp,preparation,delay,display,storedData,connector,offPage,extract,merge',
        JSON.stringify([out.besideDefault, out.figureButtons]));
  check('a decision is a diamond with its words inside it, met by a connector at its point, and saved as one',
        out.diamond === 4 && out.wordsInside && Array.isArray(out.metAtPoint) &&
        Math.abs(out.metAtPoint[0]) < 0.6 && Math.abs(out.metAtPoint[1]) < 1 && out.saved,
        JSON.stringify({d: out.diamond, inside: out.wordsInside, at: out.metAtPoint, saved: out.saved}));
  check('a template read from an SVG is its outline as numbers, and nothing in the file runs',
        out.ranNothing && out.template && out.template.name === 'Box' &&
        out.template.d === 'M0 0 L100 0 L100 100 L0 100 L0 0 Z M16.7 0 L16.7 100',
        JSON.stringify([out.ranNothing, out.template]));
  check('…kept for the menu, drawn on an entry, and the entry keeps it when the menu lets it go',
        out.templateDrawn && out.templateKept && out.entryKeepsIt,
        JSON.stringify([out.templateDrawn, out.templateKept, out.entryKeepsIt]));

  /* 1. On a phone, the bar over a picked entry stands above its sheet,
        and on a desk to the left of its panel. */
  const deskBar = await page.evaluate(async ([X, Y])=>{
    const keep = workingNodes.map(x=> x.slice());
    try{
      applyEdit(()=> workingNodes.push(['o311_p','Right edge',null,null,null,null,{pos:[X, Y]}]));
      rebuildChart();
      const rv = svg.getBoundingClientRect();
      vs = 1; vx = rv.width - 60 - X; vy = rv.height / 2 - Y; applyTransform();
      selectNode('o311_p');
      openStyleBar({kind:'node', id:'o311_p'});
      await new Promise(ok=> setTimeout(ok, 300));
      const d = document.getElementById('detail');
      const p = d.getBoundingClientRect(), b = styleBar.getBoundingClientRect();
      return {open: d.classList.contains('open'), bar: !styleBar.hidden,
              clear: !(b.right > p.left && b.left < p.right && b.bottom > p.top && b.top < p.bottom)};
    } finally {
      if(typeof closeStyleBar === 'function') closeStyleBar();
      workingNodes = keep; rebuildChart();
    }
  }, [X, Y]);
  check('a picked entry\'s bar stands clear of its panel', deskBar.open && deskBar.bar && deskBar.clear, JSON.stringify(deskBar));
  });

  await scenario("the owner's second list of 2.11: figures drawn in every border, a gear, a cut card, a note's ink, a reader's look, kinds of media", async () => {
  const X = 153000, Y = 153000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const tall = document.createElement('canvas'); tall.width = 100; tall.height = 200;
      const tx = tall.getContext('2d'); tx.fillStyle = '#37a'; tx.fillRect(0, 0, 100, 200);
      const pic = tall.toDataURL();
      applyEdit(()=>{
        workingNodes.push(['o2b_plain','Plain',null,null,null,null,{pos:[X, Y], figure:'data', square:true}]);
        workingNodes.push(['o2b_round','Round',null,null,null,null,{pos:[X + 200, Y], figure:'data', square:false}]);
        workingNodes.push(['o2b_wavy','Wavy',null,null,null,null,{pos:[X + 400, Y], figure:'data', border:'wavy'}]);
        workingNodes.push(['o2b_dbl','Double',null,null,null,null,{pos:[X + 600, Y], figure:'decision', border:'double'}]);
        workingNodes.push(['o2b_wide','Wide',null,null,null,null,
                           {pos:[X, Y + 160], figure:{name:'Wide', d:'M0 0 L100 0 L100 100 L0 100 L0 0 Z', ar:3}}]);
        if(!mediaTypeById('line')) (SETTINGS.mediaTypes = SETTINGS.mediaTypes || []).push({id:'line', name:'Line', fields:[{id:'f1', label:'Line'}]});
        workingNodes.push(['o2b_cut','A card cut to its picture',null,null,'Its note',null,
                           {pos:[X + 300, Y + 160], card:true, image:pic, mediaType:'line', mediaData:{f1:'Its medium'}, cardImgW:40, cardImgH:80, cardCut:true}]);
        workingNodes.push(['o2b_blur','A card set on a blur',null,null,'Its note',null,
                           {pos:[X + 600, Y + 160], card:true, image:pic, mediaType:'line', mediaData:{f1:'Its medium'}, cardImgW:40, cardImgH:80}]);
        workingNodes.push(['o2b_g1','From',null,null,null,null,{pos:[X, Y + 500]}]);
        workingNodes.push(['o2b_g2','To','o2b_g1',null,null,null,{pos:[X + 600, Y + 500]}]);
        EDGE_STYLES.push({from:'o2b_g1', to:'o2b_g2', routing:'straight', dash:'solid', arrow:true,
                          gradient:['#ff0000', '#0000ff'], note:'Halfway'});
      });
      rebuildChart();
      await wait(250);

      /* 1. A figure is drawn in every border a box is: rounded unless
            square, waved, and as two outlines when double. */
      const outlineOf = id=>{
        const g = document.querySelector(`.node[data-id="${id}"]`);
        return g ? [...g.querySelectorAll(':scope > path:not(.figure-mark)')].map(p=> p.getAttribute('d') || '') : [];
      };
      r.plainSharp = outlineOf('o2b_plain').length >= 1 && !/[QC]/.test(outlineOf('o2b_plain')[0]);
      r.roundCurved = /Q/.test(outlineOf('o2b_round')[0] || '');
      r.wavyCurves = ((outlineOf('o2b_wavy')[0] || '').match(/[QC]/g) || []).length;
      r.doubleRings = outlineOf('o2b_dbl').length;
      /* …and every corner of a rounded figure is visibly rounded, the
         blunt ones too: the top and bottom of a wide diamond were cut by
         under a pixel. Each corner is cut at least the radius back. */
      {
        const d = figureOutlineD(nodeFigure({figure:'decision'}), 0, 0, 150, 40, {r: 2.5});
        const cuts = [...d.matchAll(/L([-\d.]+),([-\d.]+) Q([-\d.]+),([-\d.]+)/g)]
          .map(m=> Math.hypot(+m[1] - +m[3], +m[2] - +m[4]));
        r.diamondCuts = cuts.map(c=> +c.toFixed(2));
        r.picks = figurePicks().map(p=> p.value);
        applyEdit(()=> workingNodes.push(['o2b_sd','Stored',null,null,null,null,{pos:[X + 1100, Y], figure:'storedData', square:false}]));
        rebuildChart();
        r.storedSharp = !/Q/.test(outlineOf('o2b_sd')[0] || 'Q');
        /* A subroutine's bars, in a double border, run on to its outer line. */
        applyEdit(()=> workingNodes.push(['o2b_sub','Sub',null,null,null,null,{pos:[X + 900, Y], figure:'predefined', border:'double'}]));
        rebuildChart();
        const sub = nodes.get('o2b_sub');
        const bar = document.querySelector('.node[data-id="o2b_sub"] path.figure-mark');
        const ys = bar ? (bar.getAttribute('d').match(/[-\d.]+/g) || []).map(Number).filter((v, i)=> i % 2 === 1) : [];
        r.barReach = ys.length ? [+(sub.y - Math.min(...ys)).toFixed(2), +(Math.max(...ys) - (sub.y + sub.h)).toFixed(2), +DOUBLE_LINE_OFF.toFixed(2)] : null;
        r.processKept = isBuiltinFigure('process') && !!nodeFigure({figure:'process'});
      }
      /* …and a template keeps the proportion of the drawing it was read from. */
      {
        const n = nodes.get('o2b_wide');
        r.wideAspect = +(n.w / n.h).toFixed(2);
        const t = figureTemplateOfSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100"/></svg>', 'Flat.svg');
        r.readAspect = t && t.ar;
      }
      /* …and the field the words are typed into is the figure's own shape. */
      openNodeEditor('o2b_dbl');
      await wait(120);
      {
        const rec = richFields.get('nodeEditorText');
        const c = rec && getComputedStyle(rec.surface, '::before').content;
        const fig = document.querySelector('.node[data-id="o2b_dbl"] .figure-shape, .node[data-id="o2b_dbl"] path');
        r.editorOnFigure = !!rec && (c === 'none' || c === 'normal') && !!fig && getComputedStyle(fig).opacity !== '0';
      }
      closeNodeEditor(true);
      await wait(60);
      /* …and the button that opens the figures is a gear on Default's corner. */
      openAddFab();
      await wait(60);
      {
        const def = document.querySelector('#addFabStyles .node-style-btn[data-value="rect"]');
        const more = document.getElementById('addFabCustomize');
        const a = def.getBoundingClientRect(), b = more.getBoundingClientRect();
        r.gear = !!more.querySelector('svg path') && b.left < a.left + 4 && b.right > a.left && b.top < a.top + 4 && b.bottom > a.top;
      }
      closeAddFab();

      /* 2. A card cut to its picture is framed round the picture, steps
            out to its bands, and is not set on a blurred copy. */
      {
        const cut = nodes.get('o2b_cut');
        const gc = document.querySelector('.node[data-id="o2b_cut"]');
        const gb = document.querySelector('.node[data-id="o2b_blur"]');
        r.cutRun = Array.isArray(cut.cardCutRun) ? cut.cardCutRun.length : 0;
        r.cutBlur = !!gc.querySelector('image[filter]');
        r.otherBlur = !!gb.querySelector('image[filter]');
        r.cutSaved = /"cardCut":true/.test(chartFileText());
      }

      /* 4. A note's field is the colour its line has where the note stands. */
      {
        const ink = noteInkOf('o2b_g1', 'o2b_g2');
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(ink);
        r.noteInk = ink;
        r.inkMixed = !!m && +m[1] > 40 && +m[3] > 40;
      }

      /* 6. Kinds of medium: a kind's line, an empty fact taking its comma
            with it, written in italics on the card and kept in the file. */
      applyEdit(()=>{
        SETTINGS.mediaTypes = [{id:'film', name:'Film', fields:[{id:'f1', label:'Studio'}, {id:'f2', label:'Director'}, {id:'f3', label:'Year'}]}];
        workingNodes.push(['o2b_film','A film',null,null,null,null,
                           {pos:[X + 900, Y + 160], card:true, mediaType:'film', mediaData:{f1:'Toei', f3:'1986'}}]);
      });
      rebuildChart();
      await wait(120);
      const kind = mediaTypeById('film');
      r.lineFull = mediaLineFor(kind, {f1:'Toei', f2:'Nelson Shin', f3:'1986'});
      r.lineGap = mediaLineFor(kind, {f1:'Toei', f3:'1986'});
      r.lineFirstGone = mediaLineFor(kind, {f2:'Nelson Shin', f3:'1986'});
      {
        const t = document.querySelector('.node[data-id="o2b_film"] text.card-medium');
        r.drawn = t ? t.textContent.replace(/\s+/g, '') : null;
        r.drawnItalic = !!t && [...t.querySelectorAll('tspan')].some(s=> /italic/.test(s.getAttribute('font-style') || s.style.fontStyle || ''));
        const file = chartFileText();
        r.kindSaved = /"mediaTypes":\[\{"id":"film"/.test(file) && /"mediaType":"film"/.test(file) && /"mediaData":\{"f1":"Toei","f3":"1986"\}/.test(file);
      }
      /* …picked in the card's panel as a tag is, and built in the drawer. */
      selectNode('o2b_film');
      await wait(120);
      document.getElementById('detailEditToggle').click();
      await wait(300);
      { const sel = document.getElementById('editMediaTypeSelect'); r.panelKind = sel.tagName + ':' + sel.selectedOptions[0].textContent; }
      r.panelFacts = [...document.querySelectorAll('#editMediaFields input')].map(i=> i.value).join('|');
      r.typedHidden = !document.getElementById('editMediumInput');
      document.getElementById('detailEditToggle').click();
      await wait(200);
      deselect();
      setSideTab(document.getElementById('mediaPanel'), true);
      await wait(60);
      r.drawer = [...document.querySelectorAll('#mediaList .media-kind-name')].map(i=> i.textContent).join() + ':' +
                 [...document.querySelectorAll('#mediaList .media-field-label')].map(i=> i.textContent).join();

      /* 5. The owner looks as a reader does, and comes back to the same
            unsaved chart; the media drawer is the author's, as the legend is. */
      const toggle = document.getElementById('readerToggle');
      r.toggleShown = getComputedStyle(toggle).display !== 'none';
      toggle.click();
      await wait(200);
      r.asReader = readOnlyView && document.body.classList.contains('reader-preview') &&
                   getComputedStyle(toggle).display !== 'none' &&
                   getComputedStyle(document.getElementById('mediaPanel')).display !== 'none' &&
                   getComputedStyle(document.getElementById('keyPanel')).display !== 'none';
      toggle.click();
      await wait(200);
      r.back = !readOnlyView && !document.body.classList.contains('reader-preview') &&
               workingNodes.some(x=> x[0] === 'o2b_film') &&
               getComputedStyle(document.getElementById('mediaPanel')).display !== 'none';
      setSideTab(document.getElementById('mediaPanel'), false);
    } finally {
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  check('a figure is square or rounded as a box is, waved when wavy, and two outlines when double',
        out.plainSharp && out.roundCurved && out.wavyCurves >= 8 && out.doubleRings >= 2,
        JSON.stringify([out.plainSharp, out.roundCurved, out.wavyCurves, out.doubleRings]));
  check('every corner of a rounded diamond is rounded, the blunt top and bottom too, and stored data is never rounded',
        out.diamondCuts.length === 4 && out.diamondCuts.every(c=> c >= 2.49) && out.storedSharp, JSON.stringify(out.diamondCuts));
  check('a subroutine\'s bars run on to the outer line of a double border',
        !!out.barReach && Math.abs(out.barReach[0] - out.barReach[2]) < 0.05 && Math.abs(out.barReach[1] - out.barReach[2]) < 0.05,
        JSON.stringify(out.barReach));
  check('Process is not offered among the figures, Default being a rectangle already, and one drawn before still is',
        !out.picks.includes('process') && out.processKept, JSON.stringify([out.picks, out.processKept]));
  check('a figure read from an SVG keeps its drawing\'s proportion, and an entry wearing it does too',
        out.readAspect === 3 && Math.abs(out.wideAspect - 3) < 0.05, JSON.stringify([out.readAspect, out.wideAspect]));
  check('the field a figure\'s words are typed into draws no outline of its own: the figure under it is seen', out.editorOnFigure, String(out.editorOnFigure));
  check('the figures open from a gear on Default\'s corner', out.gear, String(out.gear));
  check('a card cut to its picture is framed round it and set on no blurred copy; one not cut still is',
        out.cutRun >= 6 && !out.cutBlur && out.otherBlur && out.cutSaved,
        JSON.stringify([out.cutRun, out.cutBlur, out.otherBlur, out.cutSaved]));
  check('a note on a gradient line is edited in the colour the line has where it stands',
        out.inkMixed, String(out.noteInk));
  check('a kind of medium writes its facts in its order, an empty one taking its comma with it',
        out.lineFull === 'Toei, Nelson Shin, 1986' && out.lineGap === 'Toei, 1986' && out.lineFirstGone === 'Nelson Shin, 1986',
        JSON.stringify([out.lineFull, out.lineGap, out.lineFirstGone]));
  check('…in italics on the card, in place of what was typed, and kept in the file',
        out.drawn === 'Toei,1986' && out.drawnItalic && out.kindSaved, JSON.stringify([out.drawn, out.drawnItalic, out.kindSaved]));
  check('…picked in the card\'s panel, with a field for each fact, and built in the Media drawer',
        out.panelKind === 'SELECT:Film' && out.panelFacts === 'Toei||1986' && out.typedHidden && out.drawer === 'Film:Studio,Director,Year',
        JSON.stringify([out.panelKind, out.panelFacts, out.typedHidden, out.drawer]));
  check('the owner looks at the chart as a reader, with the Media drawer since 15.11 but no legend, and comes back to the same chart',
        out.toggleShown && out.asReader && out.back, JSON.stringify([out.toggleShown, out.asReader, out.back]));
  });

  await scenario("the owner's list of 2.11, evening: a gear within reach, folded kinds, a player that goes, a preview in the clear, a card's even bands, a reader's drawers, faded tags", async () => {
  const X = 157000, Y = 157000;
  /* 1. The figures open from the gear and stay open on the way to them:
        the pointer crossing from the column to the card left the menu
        and closed it, as there was a gap between the two. */
  await page.evaluate(()=>{ deselect(); });
  const fab = await page.evaluate(()=>{ const b = document.getElementById('addFab').getBoundingClientRect();
                                       return {x: b.right - 20, y: b.bottom - 20}; });
  await page.mouse.move(fab.x, fab.y);
  await wait(150);
  const gear = await page.evaluate(()=>{ const b = document.getElementById('addFabCustomize').getBoundingClientRect();
                                        return {x: b.left + b.width / 2, y: b.top + b.height / 2}; });
  await page.mouse.move(gear.x, gear.y, {steps: 5});
  await page.mouse.click(gear.x, gear.y);
  await wait(120);
  const far = await page.evaluate(()=>{ const bs = [...document.querySelectorAll('#addFabFigures .node-style-btn')];
                                       const b = bs[bs.length - 1].getBoundingClientRect();
                                       return {x: b.left + b.width / 2, y: b.top + b.height / 2}; });
  await page.mouse.move(far.x, far.y, {steps: 25});
  await wait(80);
  const reached = await page.evaluate(()=>{ const f = document.getElementById('addFab');
                                           return f.classList.contains('open') && f.classList.contains('figures'); });
  await page.mouse.move(400, 400, {steps: 4});
  await wait(80);
  await page.evaluate(()=>{ openFigureMenu(false); closeAddFab(); });

  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const c = document.createElement('canvas'); c.width = 100; c.height = 150;
      const cx = c.getContext('2d'); cx.fillStyle = '#37a'; cx.fillRect(0, 0, 100, 150);
      const pic = c.toDataURL();
      applyEdit(()=>{
        SETTINGS.mediaTypes = [{id:'film', name:'Film', fields:[{id:'f1', label:'Studio'}, {id:'f2', label:'Year'}]},
                               {id:'book', name:'Book', fields:[{id:'f1', label:'Author'}]}];
        workingNodes.push(['oe_card','The Transformers: The Movie',null,null,null,null,
                           {pos:[X, Y], card:true, image:pic, mediaType:'film', mediaData:{f1:'Aoa'}, border:'double'}]);
        workingNodes.push(['oe_cut','Cut to it',null,null,null,null,
                           {pos:[X + 300, Y], card:true, image:pic, mediaType:'film', mediaData:{f1:'Aoa'}, size:[260, 330], cardCut:true}]);
        workingNodes.push(['oe_both','Both asked',null,null,null,null,
                           {pos:[X + 700, Y], card:true, image:pic, cardCut:true, cardCrop:true}]);
        workingNodes.push(['oe_far','Where it goes',null,null,null,null,{pos:[X + 2000, Y + 2000]}]);
        workingNodes.push(['oe_link','',null,null,null,'link',{pos:[X, Y + 600], link:'oe_far'}]);
        workingNodes.push(['oe_right','In the way',null,null,null,null,{pos:[X + 40, Y + 570], size:[260, 90]}]);
      });
      rebuildChart();
      await wait(250);

      /* 2. Kinds fold; a new one comes unfolded; the medium line is two
            thirds of the heading. */
      setSideTab(document.getElementById('mediaPanel'), true);
      await wait(60);
      const kinds = ()=> [...document.querySelectorAll('#mediaList .media-kind')];
      r.folded = kinds().map(k=> k.classList.contains('shut') && !k.querySelector('.media-field-label').offsetParent);
      kinds()[0].querySelector('.media-fold').click();
      await wait(30);
      r.unfolded = !kinds()[0].classList.contains('shut') && !!kinds()[0].querySelector('.media-field-label').offsetParent &&
                   kinds()[1].classList.contains('shut');
      document.querySelector('#mediaPanel button[title="Add a kind of medium"]').click();
      await wait(30);
      { const ks = kinds(); r.newOpen = ks.length === 3 && !ks[2].classList.contains('shut'); }
      /* A field renamed by a double click on its name, where it stands
         (the owner's list of 11.11: a name, not a field). A kind's own
         line is gone: the fields are the line, in their order. */
      applyEdit(()=>{ SETTINGS.mediaTypes[0].format = '%Studio% (%Year%)'; });
      buildMediaTab();
      {
        const label = document.querySelector('#mediaList .media-kind[data-kind="film"] .media-field-label');
        label.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        const lab = document.querySelector('#mediaList .media-kind[data-kind="film"] .media-field-label');
        lab.textContent = 'Company';
        lab.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await wait(30);
        const k = mediaTypeById('film');
        r.renamed = k.fields[0].label + '|' + ('format' in k) + '|' + !('format' in SETTINGS.mediaTypes[0]);
      }
      setSideTab(document.getElementById('mediaPanel'), false);
      {
        const k = {fields:[{id:'f1', label:'Year'}, {id:'f2', label:'Country'}, {id:'f3', label:'Studio'}], format:'%Studio%, %Year% (%Country%)'};
        r.brackets = [mediaLineFor(k, {f1:'1986', f3:'Toei'}), mediaLineFor(k, {f2:'JP'}), mediaLineFor(k, {f1:'1986', f2:'JP', f3:'Toei'})];
      }
      {
        const g = document.querySelector('.node[data-id="oe_card"]');
        r.medScale = +(+g.querySelector('text.card-medium').getAttribute('font-size') /
                       +g.querySelector('text.node-label-text').getAttribute('font-size')).toFixed(3);
      }

      /* 3. The picture player goes on a press elsewhere, the window's blur and the wheel. */
      {
        picturePlayerFor = 'oe_card'; picturePlayer.hidden = false;
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        r.pressGone = picturePlayer.hidden && !picturePlayerFor;
        picturePlayerFor = 'oe_card'; picturePlayer.hidden = false;
        window.dispatchEvent(new Event('blur'));
        r.blurGone = picturePlayer.hidden;
        picturePlayerFor = 'oe_card'; picturePlayer.hidden = false;
        svg.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: 1}));
        r.wheelGone = picturePlayer.hidden;
      }

      /* 4. A link's preview stands where it covers nothing. */
      showLinkPreview('oe_link');
      {
        const p = document.querySelector('#linkPreviewLayer .link-preview-copy');
        const b = p && p.getBoundingClientRect();
        const w = document.querySelector('.node[data-id="oe_right"]').getBoundingClientRect();
        r.previewClear = !!b && (b.right <= w.left + 0.5 || b.left >= w.right - 0.5 || b.bottom <= w.top + 0.5 || b.top >= w.bottom - 0.5);
      }
      showLinkPreview(null);

      /* 5. A card's heading stands the same inset off its band above and
            below, a medium line under it or not, a picture over it or not. */
      {
        const g = document.querySelector('.node[data-id="oe_card"]');
        /* The card's border is double, so each rule is two lines, as the
           border is: a rule stands where the pair's middle is, and is as
           wide as the double band. */
        const rules = [...g.querySelectorAll('.card-rule:not(.border-inner)')].map(l=> +l.getAttribute('y1') + DOUBLE_LINE_OFF).sort((a, b)=> a - b);
        const hb = inkBoxOf(g.querySelector('text.node-label-text'), []);
        const inset = TEXT_GAP + DOUBLE_BAND_W / 2;
        r.headInsets = [+(hb.y - rules[0]).toFixed(2), +(rules[1] - hb.y - hb.height).toFixed(2), +inset.toFixed(2)];
      }
      /* …a frame cut to its picture goes round the picture, not round the
         slot it is fitted into; and a card asked for both is cropped. */
      {
        const n = nodes.get('oe_cut');
        const img = document.querySelector('.node[data-id="oe_cut"] > image:not([filter])');
        const iw = +img.getAttribute('width'), ih = +img.getAttribute('height');
        const run = n.cardCutRun || [];
        const xs = run.map(p=> p.x * n.w);
        r.cut = [+(iw / ih).toFixed(2), +(Math.max(...xs.filter(x=> x < n.w - 0.5)) - Math.min(...xs.filter(x=> x > 0.5))).toFixed(1), +iw.toFixed(1)];
        r.bothIsCrop = nodes.get('oe_both').cardCrop && !nodes.get('oe_both').cardCut;
      }
      /* …the two toggles turn each other off, and the panel is unburdened. */
      selectNode('oe_cut');
      await wait(100);
      document.getElementById('detailEditToggle').click();
      await wait(300);
      {
        const crop = document.getElementById('editCardCropCheck'), cut = document.getElementById('editCardCutCheck');
        r.cutBefore = cut.checked && !crop.checked;
        crop.click();
        r.cropTurnsCutOff = crop.checked && !cut.checked;
        cut.click();
        r.cutTurnsCropOff = cut.checked && !crop.checked;
        const form = document.getElementById('editImageField').closest('form') || document.getElementById('detail');
        const help = [...form.querySelectorAll('.editor-help')].map(p=> p.textContent).join(' | ');
        r.helpGone = !/embedded in the chart|frame goes round|Double-click the picture|Press a square/.test(help) &&
                     !document.querySelector('.editor-pair-help');
        const sel = document.getElementById('editMediaTypeSelect');
        sel.value = 'film'; sel.dispatchEvent(new Event('change'));
        await wait(50);
        const fact = document.querySelector('#editMediaFields .media-fact');
        const field = document.querySelector('#editMediaFields');
        r.noPreview = !document.querySelector('.media-preview');
        r.factIn = !!fact && fact.getBoundingClientRect().left - field.getBoundingClientRect().left >= 10 &&
                   parseFloat(getComputedStyle(fact.querySelector('input')).fontSize) < 12;
        /* Code 1: a fact is the kind's own — a film's studio is not a
           book's author when the card is switched — and comes back with
           its kind. */
        const first = ()=> document.querySelector('#editMediaFields input');
        first().value = 'Toei'; first().dispatchEvent(new Event('input'));
        sel.value = 'book'; sel.dispatchEvent(new Event('change'));
        await wait(30);
        const asBook = first().value;
        sel.value = 'film'; sel.dispatchEvent(new Event('change'));
        await wait(30);
        r.factsPerKind = [asBook, first().value];
      }
      document.getElementById('detailEditToggle').click();
      await wait(200);
      deselect();

      /* Code 1: an underlined entry and a callout keep their drawings
         through an edit elsewhere, and the callout still takes a new
         colour from its connector. */
      applyEdit(()=>{
        workingNodes.push(['oe_ul','{{u:solid|Underlined}} words',null,null,null,null,{pos:[X, Y + 900]}]);
        workingNodes.push(['oe_ca','From',null,null,null,null,{pos:[X + 300, Y + 900]}]);
        workingNodes.push(['oe_cb','To','oe_ca',null,null,null,{pos:[X + 700, Y + 900]}]);
        workingNodes.push(['oe_co','Said',null,null,null,'callout',{pos:[X + 450, Y + 800], leader:{from:'oe_ca', to:'oe_cb', at:0.5}}]);
        EDGE_STYLES.push({from:'oe_ca', to:'oe_cb', routing:'straight', dash:'solid', arrow:true, color:'#22b836', colorFixed:true});
      });
      rebuildChart();
      await wait(80);
      {
        const ul = drawnEntries.get('oe_ul').pieces[0], co = drawnEntries.get('oe_co').pieces[0];
        applyEdit(()=>{ entryOpts(workingEntry('oe_ca').entry).colors = ['#c23b22']; });
        await wait(80);
        r.keptUl = drawnEntries.get('oe_ul').pieces[0] === ul;
        r.keptCo = drawnEntries.get('oe_co').pieces[0] === co;
        applyEdit(()=>{ EDGE_STYLES.find(x=> x.from === 'oe_ca').color = '#2266cc'; });
        await wait(80);
        const g = document.querySelector('.node[data-id="oe_co"]');
        r.coInk = [...g.querySelectorAll('[stroke]')].map(e=> e.getAttribute('stroke')).filter(v=> v !== 'none' && !/var|url/.test(v));
      }

      /* 6. A reader's edge is the drawers they have, with no gaps: three
            then, four since the Media drawer is theirs (15.11), all five
            since the legend is too (20.11), and four again since the
            overview went up to the toolbar (22.11). */
      setReaderPreview(true);
      await wait(150);
      {
        const box = id=> document.getElementById(id).getBoundingClientRect();
        const t = box('tagsPanel'), f = box('refsPanel'), k = box('keyPanel'), d = box('mediaPanel');
        r.reader = [t.height, f.height, k.height, d.height].map(v=> +v.toFixed(1))
          .concat([+(f.top - t.bottom).toFixed(1), +(k.top - f.bottom).toFixed(1), +(d.top - k.bottom).toFixed(1)]);
      }
      setReaderPreview(false);
      await wait(150);
    } finally {
      showLinkPreview(null);
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  check('the figures stay open while the pointer goes from the gear to the furthest of them', reached, String(reached));
  check('kinds of media are folded to a line, a fold opens one, and a kind just added comes open',
        out.folded.length === 2 && out.folded.every(Boolean) && out.unfolded && out.newOpen,
        JSON.stringify([out.folded, out.unfolded, out.newOpen]));
  check('a fact in the card\'s panel belongs to its kind, and comes back with it', JSON.stringify(out.factsPerKind) === '["","Toei"]',
        JSON.stringify(out.factsPerKind));
  check('an underlined entry and a callout keep their drawings through an edit elsewhere',
        out.keptUl && out.keptCo, JSON.stringify([out.keptUl, out.keptCo]));
  check('…and a kept callout still takes its connector\'s new colour',
        out.coInk.length > 0 && out.coInk.includes('#2266cc') && !out.coInk.includes('#22b836'), JSON.stringify(out.coInk));
  check('a field renamed in the drawer by a double click on its name, and a kind\'s own line dropped', out.renamed === 'Company|false|true', String(out.renamed));
  check('a kind\'s line is its facts in the order its fields stand, a missing one with its comma',
        JSON.stringify(out.brackets) === '["1986, Toei","JP","1986, JP, Toei"]', JSON.stringify(out.brackets));
  check('a card\'s medium line is written two thirds the size of its heading', Math.abs(out.medScale - 0.667) < 0.01, String(out.medScale));
  check('the picture player goes on a press elsewhere, when the window loses the focus, and on the wheel',
        out.pressGone && out.blurGone && out.wheelGone, JSON.stringify([out.pressGone, out.blurGone, out.wheelGone]));
  check('a link\'s preview stands clear of the entry beside it', out.previewClear, String(out.previewClear));
  check('a card\'s heading stands a pixel off the rule above it and the rule below, whatever its medium line needs',
        Math.abs(out.headInsets[0] - out.headInsets[2]) < 0.6 && Math.abs(out.headInsets[1] - out.headInsets[2]) < 0.6,
        JSON.stringify(out.headInsets));
  check('a card cut to its picture is framed round the picture in its own proportions, not round its slot',
        Math.abs(out.cut[0] - 100 / 150) < 0.02 && Math.abs(out.cut[1] - out.cut[2]) < 0.6, JSON.stringify(out.cut));
  check('cropping and cutting turn each other off, and a card that asked for both is cropped',
        out.cutBefore && out.cropTurnsCutOff && out.cutTurnsCropOff && out.bothIsCrop,
        JSON.stringify([out.cutBefore, out.cropTurnsCutOff, out.cutTurnsCropOff, out.bothIsCrop]));
  check('the entry\'s panel carries no help under the picture or the colours, no medium preview, and its facts stepped in and smaller',
        out.helpGone && out.noPreview && out.factIn, JSON.stringify([out.helpGone, out.noPreview, out.factIn]));
  check('a reader\'s edge is shared by the four drawers they have',
        out.reader[0] > 100 && [1, 2, 3].every(i=> Math.abs(out.reader[i] - out.reader[0]) < 1) &&
        out.reader[4] < 20 && out.reader[4] >= 0 && [5, 6].every(i=> Math.abs(out.reader[i] - out.reader[4]) < 1), JSON.stringify(out.reader));
  });

  await scenario("the owner's list of 7.11: a figure on card layout, a card's things kept, faded lines, a ruled space, one tick, a lit reader's eye, a link that darkens, a line round a box", async () => {
  const X = 161000, Y = 161000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const c = document.createElement('canvas'); c.width = 200; c.height = 100;
      const cx = c.getContext('2d'); cx.fillStyle = '#37a'; cx.fillRect(0, 0, 200, 100);
      const pic = c.toDataURL();
      applyEdit(()=>{
        SETTINGS.mediaTypes = [{id:'film', name:'Film', fields:[{id:'f1', label:'Studio'}]}];
        workingNodes.push(['o711_d','Ready?',null,null,'A body',null,
                           {pos:[X, Y], figure:'decision', card:true, image:pic, mediaType:'film', mediaData:{f1:'middle'}}]);
        workingNodes.push(['o711_dh','Sized',null,null,null,null,
                           {pos:[X + 400, Y], figure:'terminator', card:true, size:[300, 160]}]);
        workingNodes.push(['o711_c','Card',null,null,'Body',null,
                           {pos:[X, Y + 400], card:true, image:pic, mediaType:'film',
                            mediaData:{f1:'Toei'}, size:[260, 300]}]);
        workingNodes.push(['o711_n','Next','o711_c',null,null,null,{pos:[X + 400, Y + 420]}]);
        EDGE_STYLES.push({from:'o711_c', to:'o711_n', routing:'orthogonal', dash:'solid', arrow:true});
        /* The owner's screenshot: two ports facing down, and a third box
           under the shallower one's run-out. */
        workingNodes.push(['o711_r3','Beast Wars: Uprising\nasdsasad',null,null,null,null,{pos:[X + 1000 - 242, Y + 1000 + 297.28], square:true}]);
        workingNodes.push(['o711_r1','Beast Wars: Uprising',null,null,null,null,{pos:[X + 1000 - 67.24, Y + 1000 + 277.14], square:true}]);
        workingNodes.push(['o711_r2','Гаягкягкч','o711_r1',null,null,null,{pos:[X + 1000 - 179.81, Y + 1000 + 198.94], size:[54.13, 12.05]}]);
        EDGE_STYLES.push({from:'o711_r1', to:'o711_r2', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'bottom'});
        workingNodes.push(['o711_h','Hidden',null,null,null,null,{pos:[X + 400, Y + 700], tags:['o711-tag']}]);
        workingNodes.push(['o711_hk','Kept','o711_h',null,null,null,{pos:[X + 700, Y + 700]}]);
        EDGE_STYLES.push({from:'o711_h', to:'o711_hk', routing:'orthogonal', dash:'solid', arrow:true});
        workingNodes.push(['o711_sp','ab cd',null,null,null,null,{pos:[X, Y + 1400]}]);
      });
      rebuildChart();
      await wait(250);

      /* 1. A figure on card layout keeps its figure: the outline is the
            diamond, its words in the middle of it, and a size set by
            hand is the outline's. */
      {
        const n = nodes.get('o711_d');
        const g = document.querySelector('.node[data-id="o711_d"]');
        const clip = document.querySelector(`clipPath[id^="cardclip-o711_d"] > *`);
        const t = g.querySelector('text.node-label-text').getBBox();
        r.figCard = {fig: nodeFigure(n), clip: clip && clip.tagName, pts: clip && (clip.getAttribute('d') || '').split(/[LC]/).length,
                     mid: +(t.x + t.width / 2 - (n.x + n.w / 2)).toFixed(1),
                     inside: t.y > n.y && t.y + t.height < n.y + n.h};
        const m = nodes.get('o711_dh');
        r.figHand = [Math.round(m.w), Math.round(m.h)];
        const pt = portOnSide(n, 'top', 0, 1);
        r.figPort = pt ? +(pt.y - n.y).toFixed(1) : null;
      }

      /* 1b. "None", not "None — typed by hand". */
      openEntrySettings('o711_c');
      await wait(120);
      r.noneLabel = document.querySelector('#editMediaTypeSelect option[value=""]').textContent;
      deselect();
      await wait(80);
      /* …and under "None" no line to type, unless the card carries one. */
      applyEdit(()=>{
        workingNodes.push(['o711_none','Plain card',null,null,null,null,{pos:[X + 800, Y + 400], card:true}]);
        workingNodes.push(['o711_typed','Typed card',null,null,null,null,{pos:[X + 1100, Y + 400], card:true, medium:'old line'}]);
      });
      openEntrySettings('o711_none');
      await wait(120);
      r.typedGone = !document.getElementById('editMediumInput');
      deselect();
      await wait(80);
      openEntrySettings('o711_typed');
      await wait(120);
      /* …and a line typed by hand before is not drawn, and goes with the card's next edit. */
      r.typedKept = !document.querySelector('.node[data-id="o711_typed"] text.card-medium');
      document.getElementById('editCardCropCheck').dispatchEvent(new Event('change'));
      await wait(300);
      r.typedKept = r.typedKept && !(workingEntry('o711_typed').entry[6] || {}).medium;
      deselect();
      await wait(80);
      openEntrySettings('o711_c');
      await wait(120);

      /* 1c, 1d. Card layout off and on again: its picture, its middle line
            and its facts come back; the size it was dragged to does not
            stay on the plain entry, and its connector goes with the box. */
      {
        const path = ()=> { const p = document.querySelector('path.edge[data-from="o711_c"][data-to="o711_n"]'); return p && p.getAttribute('d'); };
        const before = path();
        editCardCheck.click();
        await wait(400);
        const n = nodes.get('o711_c');
        r.offBox = [Math.round(n.w), Math.round(n.h)];
        r.offRouted = path() !== before;
        deselect();
        await wait(120);
        openEntrySettings('o711_c');
        await wait(120);
        editCardCheck.click();
        await wait(400);
        const o = workingEntry('o711_c').entry[6] || {};
        r.cameBack = {image: o.image === pic, kind: o.mediaType, facts: o.mediaData && o.mediaData.f1, size: o.size || null};
        deselect();
        await wait(80);
      }

      /* 2. A hidden tag fades the whole connector, line and all. */
      hiddenTags.add('o711-tag');
      applyVisibility();
      await wait(200);
      {
        const line = document.querySelector('path.edge[data-from="o711_h"][data-to="o711_hk"]');
        r.lineFade = line ? +getComputedStyle(line).opacity : null;
        /* …and a lasso takes the faded entry with the rest. */
        const a = nodes.get('o711_h'), b = nodes.get('o711_hk');
        marqueeState = {box: {x: a.x - 10, y: a.y - 10, width: b.x + b.w - a.x + 20, height: a.h + 20}, additive: false};
        window.dispatchEvent(new MouseEvent('mouseup'));
        r.lassoed = multiSelection.has('o711_h') && multiSelection.has('o711_hk');
        deselect();
      }
      hiddenTags.delete('o711-tag');
      applyVisibility();

      /* 3. A rule on a space comes off again; so does one on a word picked
            out of a ruled run. */
      openNodeEditor('o711_sp');
      await wait(150);
      {
        const surf = richFields.get('nodeEditorText').surface;
        const pick = (node, a, b)=>{ const rg = document.createRange(); rg.setStart(node, a); rg.setEnd(node, b);
                                     const s = getSelection(); s.removeAllRanges(); s.addRange(rg); };
        const texts = ()=>{ const w = document.createTreeWalker(surf, NodeFilter.SHOW_TEXT); const o = []; let t; while((t = w.nextNode())) o.push(t); return o; };
        r.space = [];
        for(const kind of ['under', 'strike']){
          surf.innerHTML = 'ab cd';
          pick(texts()[0], 2, 3); applyRichCommand(surf, kind, 'solid');
          const on = richHtmlToMarkup(surf);
          const sp = texts().find(t=> t.textContent === ' ');
          pick(sp, 0, 1); applyRichCommand(surf, kind, 'solid');
          r.space.push([on, richHtmlToMarkup(surf)]);
        }
        surf.innerHTML = 'abcd';
        pick(texts()[0], 0, 4); applyRichCommand(surf, 'under', 'solid');
        pick(texts().find(t=> t.textContent === 'abcd'), 1, 2); applyRichCommand(surf, 'under', 'solid');
        r.subWord = richHtmlToMarkup(surf);
      }
      closeNodeEditor(false);
      await wait(80);

      /* 5. One tick on a phone: the field's Done is the suggestion's Done. */
      {
        document.body.classList.add('touch-input');
        const done = document.getElementById('nodeEditorDone');
        const a = getComputedStyle(done);
        const lit = document.createElement('button'); lit.className = 'icon-btn active';
        document.body.appendChild(lit);
        const mark = done.querySelector('svg path');
        r.tick = [a.backgroundColor, getComputedStyle(lit).backgroundColor, mark ? mark.getAttribute('d') : null,
                  done.textContent.trim()];
        lit.remove();
        document.body.classList.remove('touch-input');
      }

      /* 7. The reader's eye is lit while it is on, as every toggle is. */
      setReaderPreview(true);
      await wait(150);
      {
        const t = document.getElementById('readerToggle');
        const lit = document.createElement('button'); lit.className = 'icon-btn active';
        document.querySelector('.topbar').appendChild(lit);
        r.readerLit = [t.classList.contains('active'), getComputedStyle(t).backgroundColor, getComputedStyle(lit).backgroundColor];
        lit.remove();
      }
      setReaderPreview(false);
      await wait(150);
      r.readerOff = document.getElementById('readerToggle').classList.contains('active');

      /* 6. The line goes round the box under the shallower port. */
      {
        const p = document.querySelector('path.edge[data-from="o711_r1"][data-to="o711_r2"]');
        const d = p ? p.getAttribute('d') : '';
        const pts = (d.match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g) || []).map(s=> s.split(',').map(Number));
        const c3 = nodes.get('o711_r3');
        const box = {x0: c3.x, y0: c3.y, x1: c3.x + c3.w, y1: c3.y + c3.h};
        r.route = {d, through: pts.some((q, i)=> i > 0 && segIntersectsRect(pts[i-1][0], pts[i-1][1], q[0], q[1], box))};
      }
    } finally {
      deselect();
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  /* 8. A link node darkens under the pointer as a link's tab does. */
  const linkHover = await (async ()=>{
    const at = await page.evaluate(([X, Y])=>{
      applyEdit(()=>{
        workingNodes.push(['o711_far','There',null,null,null,null,{pos:[X + 600, Y]}]);
        workingNodes.push(['o711_ln','',null,null,null,'link',{pos:[X, Y], link:'o711_far'}]);
      });
      rebuildChart();
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const g = document.querySelector('.node[data-id="o711_ln"]');
      const b = g.getBoundingClientRect();
      return {x: b.left + b.width / 2, y: b.top + b.height / 2,
              fill: getComputedStyle(g.querySelector('.bio-ring')).fill};
    }, [X, Y]);
    await page.mouse.move(at.x, at.y, {steps: 3});
    await wait(120);
    const over = await page.evaluate(()=> getComputedStyle(document.querySelector('.node[data-id="o711_ln"] .bio-ring')).fill);
    await page.mouse.move(5, 500);
    await page.evaluate(()=>{
      applyEdit(()=>{ workingNodes = workingNodes.filter(e=> e[0] !== 'o711_ln' && e[0] !== 'o711_far'); });
      rebuildChart();
    });
    return [at.fill, over];
  })();
  check('a figure on card layout keeps its figure, with its words in the middle of it',
        out.figCard.fig === 'decision' && out.figCard.clip === 'path' && Math.abs(out.figCard.mid) < 1 && out.figCard.inside,
        JSON.stringify(out.figCard));
  check('…a connector meets it at the figure\'s point', out.figPort !== null && Math.abs(out.figPort) < 1.5, String(out.figPort));
  check('…and a size set by hand on it is the figure\'s', Math.abs(out.figHand[0] - 300) <= 1 && Math.abs(out.figHand[1] - 160) <= 1,
        JSON.stringify(out.figHand));
  check('the media list offers "None", not "None — typed by hand"', out.noneLabel === 'None', String(out.noneLabel));
  check('…and under "None" there is no line to type, and a line typed before is not drawn and goes with the next edit',
        out.typedGone && out.typedKept, JSON.stringify([out.typedGone, out.typedKept]));
  check('card layout off lets go of the size the card was dragged to, and the connector follows the box',
        out.offBox[0] < 200 && out.offBox[1] < 100 && out.offRouted, JSON.stringify([out.offBox, out.offRouted]));
  check('…and on again brings back its picture, its kind of medium, its facts and the size it was dragged to',
        out.cameBack.image && out.cameBack.kind === 'film' && out.cameBack.facts === 'Toei'
        && JSON.stringify(out.cameBack.size) === '[260,300]',
        JSON.stringify(Object.assign({}, out.cameBack, {image: out.cameBack.image})));
  check('a hidden tag fades the whole line of a connector, not only its arrowhead', out.lineFade !== null && out.lineFade < 0.2, String(out.lineFade));
  check('a lasso takes a faded entry with the rest, so a carry moves it too', out.lassoed, String(out.lassoed));
  check('a rule put on a space comes off on the second press',
        out.space.every(([on, off])=> /\{\{[ut]:solid\| \}\}/.test(on) && off === 'ab cd'), JSON.stringify(out.space));
  check('…and a letter picked out of a ruled word is unruled alone',
        out.subWord === '{{u:solid|a}}b{{u:solid|cd}}', String(out.subWord));
  check('a phone\'s Done in the field is in the accent, and its tick is drawn as a suggestion\'s Done is',
        out.tick[0] === out.tick[1] && out.tick[2] === 'M3.4 8.4l3 3 6.2-6.6' && out.tick[3] === '', JSON.stringify(out.tick));
  check('the reader\'s eye is lit while it is on, as the other toggles are, and not after',
        out.readerLit[0] && out.readerLit[1] === out.readerLit[2] && !out.readerOff, JSON.stringify([out.readerLit, out.readerOff]));
  check('a link node darkens under the pointer', linkHover[0] !== linkHover[1], JSON.stringify(linkHover));
  check('a line between two ports facing down goes round the box under the shallower one',
        out.route.d && !out.route.through, out.route.d);
  });
  await scenario("the owner's list of 8.11: a figure's card no smaller than the figure, each layout keeps its own size, a callout fades with its line, a detour that hugs the box", async () => {
  const X = 171000, Y = 171000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const size = id=> { const n = nodes.get(id); return [Math.round(n.w), Math.round(n.h)]; };
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      /* A figure of the owner's own, a word in it, never sized by hand. */
      const fig = {name:'o811', d:'M50 0 L100 30 L85 100 L15 100 L0 30 Z'};
      applyEdit(()=>{
        workingNodes.push(['o811_f','Hk',null,null,null,null,{pos:[X, Y], figure: fig}]);
        workingNodes.push(['o811_t','Toggled',null,null,null,null,{pos:[X + 400, Y], size:[120, 60]}]);
        workingNodes.push(['o811_a','From',null,null,null,null,{pos:[X, Y + 400], tags:['o811-tag']}]);
        workingNodes.push(['o811_b','To','o811_a',null,null,null,{pos:[X + 400, Y + 400]}]);
        EDGE_STYLES.push({from:'o811_a', to:'o811_b', routing:'orthogonal', dash:'solid', arrow:true});
        workingNodes.push(['o811_k','Said',null,null,null,'callout',{pos:[X + 200, Y + 250], leader:{from:'o811_a', to:'o811_b', at:0.5}}]);
        /* The owner's screenshot of 7.11 again: the line from the lower
           box to the box above goes round the one standing between. */
        workingNodes.push(['o811_r3','Beast Wars: Uprising\nasdsasad',null,null,null,null,{pos:[X + 1000 - 242, Y + 1000 + 297.28], square:true}]);
        workingNodes.push(['o811_r1','Beast Wars: Uprising',null,null,null,null,{pos:[X + 1000 - 67.24, Y + 1000 + 277.14], square:true}]);
        workingNodes.push(['o811_r2','Гаягкягкч','o811_r1',null,null,null,{pos:[X + 1000 - 179.81, Y + 1000 + 198.94], size:[54.13, 12.05]}]);
        EDGE_STYLES.push({from:'o811_r1', to:'o811_r2', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'bottom'});
      });
      rebuildChart();
      await wait(250);

      /* 1. The figure on card layout is no smaller than the figure. */
      r.plainFig = size('o811_f');
      applyEdit(()=>{ workingEntry('o811_f').entry[6].card = true; });
      rebuildChart();
      await wait(150);
      r.cardFig = size('o811_f');

      /* 1b. Each layout keeps the size it was given. */
      openEntrySettings('o811_t'); await wait(120);
      editCardCheck.click(); await wait(400);
      r.firstCard = size('o811_t');
      deselect(); await wait(80);
      applyEdit(()=>{ workingEntry('o811_t').entry[6].size = [260, 200]; });
      rebuildChart(); await wait(120);
      openEntrySettings('o811_t'); await wait(120);
      editCardCheck.click(); await wait(400);
      r.backPlain = size('o811_t');
      deselect(); await wait(80);
      openEntrySettings('o811_t'); await wait(120);
      editCardCheck.click(); await wait(400);
      r.backCard = size('o811_t');
      deselect(); await wait(80);

      /* 2. A callout on a line that a hidden tag fades fades with it. */
      hiddenTags.add('o811-tag');
      applyVisibility();
      await wait(150);
      {
        const g = document.querySelector('.node[data-id="o811_k"]');
        const l = document.querySelector('.callout-leader[data-id="o811_k"]');
        r.calloutFade = [g ? +getComputedStyle(g).opacity : null, l ? +getComputedStyle(l).opacity : null];
      }
      hiddenTags.delete('o811-tag');
      applyVisibility();
      await wait(80);
      r.calloutBack = +getComputedStyle(document.querySelector('.node[data-id="o811_k"]')).opacity;

      /* 3. The detour turns just above the box it goes round. */
      {
        const p = document.querySelector('path.edge[data-from="o811_r1"][data-to="o811_r2"]');
        const d = p ? p.getAttribute('d') : '';
        const pts = (d.match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g) || []).map(s=> s.split(',').map(Number));
        const c3 = nodes.get('o811_r3');
        const box = {x0: c3.x, y0: c3.y, x1: c3.x + c3.w, y1: c3.y + c3.h};
        /* The level legs that pass over the box, x-wise. */
        const over = pts.slice(1).map((q, i)=> [pts[i], q])
          .filter(([a, b])=> Math.abs(a[1] - b[1]) < 0.01 && Math.max(a[0], b[0]) > box.x0 && Math.min(a[0], b[0]) < box.x1);
        r.route = {d, through: pts.some((q, i)=> i > 0 && segIntersectsRect(pts[i-1][0], pts[i-1][1], q[0], q[1], box)),
                   gap: over.length ? Math.min(...over.map(([a])=> box.y0 - a[1])) : null};
      }
    } finally {
      deselect();
      hiddenTags.delete('o811-tag');
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      rebuildChart();
    }
    return r;
  }, [X, Y]);
  check('a figure of one\'s own on card layout is no smaller than the figure',
        out.cardFig[0] >= out.plainFig[0] && out.cardFig[1] >= out.plainFig[1], JSON.stringify([out.plainFig, out.cardFig]));
  check('card layout on starts at the size the entry was given', JSON.stringify(out.firstCard) === '[120,60]', JSON.stringify(out.firstCard));
  check('…off again goes back to the plain entry\'s size, and on again to the card\'s',
        JSON.stringify(out.backPlain) === '[120,60]' && JSON.stringify(out.backCard) === '[260,200]',
        JSON.stringify([out.backPlain, out.backCard]));
  check('a callout on a connector a hidden tag fades fades with it, leader and all, and comes back',
        out.calloutFade.every(v=> v !== null && v < 0.2) && out.calloutBack === 1, JSON.stringify([out.calloutFade, out.calloutBack]));
  check('a detour round a box turns just above it, not far over it',
        out.route.d && !out.route.through && out.route.gap !== null && out.route.gap > 0 && out.route.gap < 16,
        JSON.stringify(out.route));
  });
  await scenario("the owner's list of 9.11: no bar under a racing pan, a glow only outward, a figure card's field, a reader's link node and tags, folds and kinds, a crisp cross, citations as drawn, a copied entry as a link, About this project", async () => {
  const X = 181000, Y = 181000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    const realWrite = navigator.clipboard && navigator.clipboard.writeText;
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      applyEdit(()=>{
        SETTINGS.mediaTypes = [{id:'o911k', name:'Film', fields:[{id:'f1', label:'Studio'}]}];
        workingNodes.push(['o911_a','Plain',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['o911_c','Card',null,null,'Body',null,{pos:[X + 300, Y], card:true, mediaType:'o911k', mediaData:{f1:'Toei'}}]);
        workingNodes.push(['o911_off','Was a card',null,null,null,null,{pos:[X + 600, Y], mediaType:'o911k', mediaData:{f1:'Sunbow'}}]);
        workingNodes.push(['o911_f','Fbbf',null,null,null,null,{pos:[X, Y + 300], figure:'extract', card:true}]);
        workingNodes.push(['o911_l','',null,null,null,'link',{pos:[X + 300, Y + 300], link:'#entry=o911_a'}]);
        workingNodes.push(['o911_r','Prime{{r:o911ref}} too',null,null,null,null,{pos:[X + 600, Y + 300]}]);
        REFS.push({key:'o911ref', title:'', detail:'A source'});
      });
      rebuildChart();
      await wait(200);

      /* 1. A hover that comes while the chart is carried opens no bar. */
      {
        const g = document.querySelector('.node[data-id="o911_a"] rect');
        closeStyleBar();
        dragging = true;
        g.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        r.barInPan = !styleBar.hidden;
        dragging = false;
        svg.dispatchEvent(new WheelEvent('wheel', {deltaY: 1, clientX: 400, clientY: 300, bubbles: true, cancelable: true}));
        g.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        r.barAfterWheel = !styleBar.hidden;
        await wait(260);
        g.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        r.barLater = !styleBar.hidden;
        closeStyleBar();
        vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      }

      /* 2. Selected, a card and a link node glow outward only. */
      {
        const f = el=> el ? getComputedStyle(el).filter : null;
        selectNode('o911_c'); paintMultiSelection(); await wait(60);
        const g = document.querySelector('.node[data-id="o911_c"]');
        r.cardGlow = [f(g.querySelector('.card-outline')), f(g.querySelector(':scope > rect:not(.node-hover-pad):not(.card-outline)'))];
        selectNode('o911_l'); paintMultiSelection(); await wait(60);
        const l = document.querySelector('.node[data-id="o911_l"]');
        r.linkGlow = [f(l.querySelector('.link-node-arrow')), f(l.querySelector('.bio-ring'))];
        deselect(); await wait(40);
      }

      /* 2b. A figure card's field is the band of the figure. */
      selectNode('o911_f');
      openNodeEditor('o911_f');
      await wait(200);
      {
        const surf = richFields.get('nodeEditorText').surface;
        const c = getComputedStyle(surf, '::before').content;
        const drawn = [...document.querySelectorAll('.node[data-id="o911_f"] .node-label-text')];
        /* One copy of the heading is seen: veiled under the field's, or —
           since 24.11 — seen through a field whose own ink is clear. */
        const through = document.getElementById('nodeEditor').classList.contains('ink-from-drawing');
        r.figField = [c === 'none' || c === 'normal', drawn.length > 0 && (through
          ? drawn.every(e=> getComputedStyle(e).opacity !== '0') && getComputedStyle(surf).color === 'rgba(0, 0, 0, 0)'
          : drawn.every(e=> getComputedStyle(e).opacity === '0'))];
      }
      closeNodeEditor(false);
      deselect();
      await wait(60);

      /* 6. A citation in the field is drawn as the chart draws it. */
      selectNode('o911_r');
      openNodeEditor('o911_r');
      await wait(200);
      {
        const surf = richFields.get('nodeEditorText').surface;
        const chip = surf.querySelector('.ref-chip');
        const cs = chip && getComputedStyle(chip);
        r.chip = chip ? [+(parseFloat(cs.fontSize) / parseFloat(getComputedStyle(surf).fontSize)).toFixed(2),
                         cs.backgroundColor, cs.fontFamily === getComputedStyle(surf).fontFamily, cs.opacity] : null;
      }
      closeNodeEditor(false);
      deselect();
      await wait(60);

      /* 4. The tags' fold wears the page's ▸; a kind of medium counts
            its entries, card or not, has an eye, and no grey box. */
      buildSideTabs();
      setSideTab(document.getElementById('mediaPanel'), true);
      await wait(120);
      {
        const fold = document.querySelector('#tagsPanel .legend-group-fold');
        r.fold = fold ? fold.textContent : null;
        const box = document.querySelector('.media-kind[data-kind="o911k"]');
        r.kindCount = box && box.querySelector('.media-kind-count').textContent;
        r.kindGround = box && getComputedStyle(box).backgroundColor;
        const eye = box && box.querySelector('.eye-mini');
        if(eye) eye.click();
        await wait(120);
        const a = document.querySelector('.node[data-id="o911_c"]'), b = document.querySelector('.node[data-id="o911_off"]');
        r.kindHidden = [nodeHidden(nodes.get('o911_c')), nodeHidden(nodes.get('o911_off')), +getComputedStyle(a).opacity, +getComputedStyle(b).opacity];
        const eye2 = document.querySelector('.media-kind[data-kind="o911k"] .eye-mini');
        if(eye2) eye2.click();
        await wait(80);
        r.kindBack = nodeHidden(nodes.get('o911_c'));
      }
      setSideTab(document.getElementById('mediaPanel'), false);

      /* 7. A copied entry is a link to it, on the system clipboard and in
            a link field. */
      {
        let wrote = null;
        navigator.clipboard.writeText = (t)=>{ wrote = t; return Promise.resolve(); };
        selectNode('o911_a');
        copySelectedNode();
        r.copied = [wrote, (readClipboard() || {}).entryLink];
        wrote = null;
        copySelectedNode(true);
        r.cutCopied = [wrote, (readClipboard() || {}).entryLink || null];
        copySelectedNode();
        const input = document.getElementById('editLinkInput');
        input.value = ''; input.focus();
        input.dispatchEvent(new ClipboardEvent('paste', {clipboardData: new DataTransfer(), bubbles: true, cancelable: true}));
        r.pasted = input.value;
        input.value = ''; input.blur();
        deselect();
      }

      /* 5. The Decline's cross is the tick's size. */
      r.cross = /width="13" height="13"[^>]*><path d="M4\.6 4\.6l6\.8 6\.8M11\.4 4\.6l-6\.8 6\.8"[^>]*stroke-width="2\.4"/.test(String(renderSuggestions));

      /* 8. About this project, and where its owner is. */
      {
        r.aboutHead = document.querySelector('#aboutOverlay h2').textContent;
        r.contacts = [...document.querySelectorAll('#aboutContacts .about-contact')].map(a=> a.getAttribute('href') || a.dataset.copy);
        const v = document.getElementById('aboutVersion');
        r.contactsUnder = v.nextElementSibling && v.nextElementSibling.id === 'aboutContacts';
      }

      /* 3. A reader: no focus on a link node, no field of unfiled tags,
            and the copy button waits for the hand. */
      setReaderPreview(true);
      await wait(150);
      {
        const g = document.querySelector('.node[data-id="o911_l"]');
        g.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wait(40);
        r.readerLink = selectedId;
        buildSideTabs();
        r.readerLoose = !!document.querySelector('#tagsPanel .legend-loose');
        const p = document.querySelector('.node[data-id="o911_a"]');
        p.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        p.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
        await wait(60);
        const btn = document.querySelector('.node[data-id="o911_a"] .node-copy-link');
        r.copyWaits = btn ? [getComputedStyle(btn).transitionDelay, getComputedStyle(btn).pointerEvents] : null;
      }
      setReaderPreview(false);
      await wait(120);
    } finally {
      if(realWrite) navigator.clipboard.writeText = realWrite;
      deselect();
      hiddenMediaKinds.clear();
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      const i = REFS.findIndex(x=> x.key === 'o911ref'); if(i >= 0) REFS.splice(i, 1);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart(); buildSideTabs();
    }
    return r;
  }, [X, Y]);
  check('a hover that comes while the chart is carried, or just after the wheel, opens no bar, and one after it does',
        !out.barInPan && !out.barAfterWheel && out.barLater, JSON.stringify([out.barInPan, out.barAfterWheel, out.barLater]));
  check('a selected card glows outward only: its outline over the bands carries no glow, its ground does',
        out.cardGlow[0] === 'none' && out.cardGlow[1] && out.cardGlow[1] !== 'none', JSON.stringify(out.cardGlow));
  check('…and a link node\'s arrow carries none inside its ring', out.linkGlow[0] === 'none' && out.linkGlow[1] !== 'none', JSON.stringify(out.linkGlow));
  check('the field on a figure\'s card has no frame, and one copy of its heading is seen', out.figField[0] && out.figField[1], JSON.stringify(out.figField));
  check('a citation in the field is set as the chart sets it: the run\'s face, a little over half its size, no box',
        out.chip && Math.abs(out.chip[0] - 0.56) < 0.03 && /rgba\(0, 0, 0, 0\)|transparent/.test(out.chip[1]) && out.chip[2] && Math.abs(+out.chip[3] - 0.55) < 0.01,
        JSON.stringify(out.chip));
  check('a category of tags folds with the page\'s ▸', out.fold === '▸', String(out.fold));
  check('a kind of medium counts its entries, card or not, and stands on no grey box',
        out.kindCount === '2' && /rgba\(0, 0, 0, 0\)|transparent/.test(out.kindGround), JSON.stringify([out.kindCount, out.kindGround]));
  check('…and its eye fades every entry of the kind, card or not, and brings them back',
        out.kindHidden[0] && out.kindHidden[1] && out.kindHidden[2] < 0.2 && out.kindHidden[3] < 0.2 && !out.kindBack,
        JSON.stringify([out.kindHidden, out.kindBack]));
  check('a copied entry puts its link on the system clipboard and keeps it, a cut does not',
        /#entry=o911_a$/.test(out.copied[0] || '') && out.copied[1] === out.copied[0] && out.cutCopied[0] === null && out.cutCopied[1] === null,
        JSON.stringify([out.copied, out.cutCopied]));
  check('…and pasted into a link field with nothing else to paste, it is the link', /#entry=o911_a$/.test(out.pasted), String(out.pasted));
  check('a suggestion\'s Decline draws its cross at the tick\'s size and nearly its weight', out.cross, String(out.cross));
  check('About is About this project, with the owner\'s four addresses under the version line',
        out.aboutHead === 'About this project' && out.contactsUnder &&
        JSON.stringify(out.contacts) === JSON.stringify(['mailto:wowwodptr2@gmail.com', 'https://x.com/Mk2stomperX', 'comablackwhite_79884', 'https://boosty.to/lil_cccarrrottt']),
        JSON.stringify([out.aboutHead, out.contacts]));
  check('a reader cannot light a link node with a click', out.readerLink !== 'o911_l', String(out.readerLink));
  check('a reader has no field of tags waiting to be filed', !out.readerLoose, String(out.readerLoose));
  check('a reader\'s copy-link button stays a moment after the entry is left, pressable',
        out.copyWaits && /0\.45s/.test(out.copyWaits[0]) && out.copyWaits[1] === 'auto', JSON.stringify(out.copyWaits));
  });
  await scenario("the owner's list of 11.11: a kind of medium's names as text, its fold before its count, no line of its own; a tag renamed by its name; words set left, centred or right", async () => {
  const X = 183000, Y = 183000;
  const out = await page.evaluate(async ([X, Y])=>{
    const keep = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
                  settings: JSON.parse(JSON.stringify(SETTINGS)), cats: JSON.parse(JSON.stringify(TAG_CATS))};
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    try{
      vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
      const long = 'Short\nA much longer second line\nMid line';
      applyEdit(()=>{
        SETTINGS.mediaTypes = [{id:'o1111k', name:'Film', fields:[{id:'f1', label:'Studio'}, {id:'f2', label:'Year'}], format:'%Year% %Studio%'}];
        TAG_CATS.push({name:'O1111 cat', tags:['o1111-tag']});
        SETTINGS.tagColors = Object.assign({}, SETTINGS.tagColors || {}, {'o1111-tag': '#aa3300'});
        workingNodes.push(['o1111_a', long, null, null, null, null, {pos:[X, Y], tags:['o1111-tag', 'o1111-other']}]);
        workingNodes.push(['o1111_c', long, null, null, 'A body of words that wraps over two lines at least', null,
                           {pos:[X + 400, Y], card:true, mediaType:'o1111k', mediaData:{f1:'Toei', f2:'1986'}}]);
      });
      rebuildChart();
      await wait(200);

      /* 1. The media drawer. */
      setSideTab(document.getElementById('mediaPanel'), true);
      await wait(60);
      mediaKindsOpen().add('o1111k');
      buildMediaTab();
      {
        const box = document.querySelector('#mediaList .media-kind[data-kind="o1111k"]');
        const top = box.querySelector('.media-kind-top');
        r.order = [...top.children].map(c=> c.classList.contains('eye-mini') ? 'eye'
          : c.classList.contains('media-kind-name') ? 'name' : c.classList.contains('media-fold') ? 'fold'
          : c.classList.contains('media-kind-count') ? 'count' : c.classList.contains('media-x') ? 'x' : (c.className || c.tagName));
        r.inputs = document.querySelectorAll('#mediaList input').length;
        r.writtenAs = !!document.querySelector('.media-written .media-line') && !document.querySelector('.media-format');
        const name = box.querySelector('.media-kind-name'), label = box.querySelector('.media-field-label');
        r.nameTag = name.tagName + ':' + label.tagName;
        const head = document.querySelector('#tagsList .legend-group[data-cat] .legend-group-head .legend-group-name'), row = document.querySelector('#tagsList .legend-item');
        const cs = e=> getComputedStyle(e);
        r.nameFont = [cs(name).fontFamily === cs(head).fontFamily, cs(name).fontSize === cs(head).fontSize,
                      cs(name).borderTopStyle === 'none' || cs(name).borderTopWidth === '0px'];
        r.labelFont = [cs(label).fontFamily === cs(row).fontFamily, cs(label).fontSize === cs(row).fontSize];
        name.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        name.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        name.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        const live = document.querySelector('#mediaList .media-kind[data-kind="o1111k"] .media-kind-name');
        r.renaming = live.isContentEditable;
        live.textContent = 'Picture';
        live.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await wait(DOUBLE_CLICK_GRACE + 60);
        const b2 = document.querySelector('#mediaList .media-kind[data-kind="o1111k"]');
        r.renamedKind = mediaTypeById('o1111k').name + '|' + !b2.classList.contains('shut');
        b2.querySelector('.media-kind-name').dispatchEvent(new MouseEvent('click', {bubbles: true}));
        /* The fold moves now (24.11): the list changes once it has shut. */
        await wait(DOUBLE_CLICK_GRACE + FOLD_MS + 80);
        r.headFolds = document.querySelector('#mediaList .media-kind[data-kind="o1111k"]').classList.contains('shut');
        r.line = document.querySelector('.node[data-id="o1111_c"] text.card-medium').textContent.replace(/\s+/g, ' ').trim();
        r.formatGone = !('format' in SETTINGS.mediaTypes[0]);
      }
      setSideTab(document.getElementById('mediaPanel'), false);

      /* 2. A tag renamed by pressing its name. */
      setSideTab(document.getElementById('tagsPanel'), true);
      collapsedCats.delete('O1111 cat');
      buildSideTabs();
      await wait(60);
      {
        const row = document.querySelector('#tagsList .legend-item[data-tag="o1111-tag"]');
        const words = row.querySelector('.tag-text');
        words.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        r.tagRenaming = words.isContentEditable;
        words.textContent = 'o1111-renamed';
        words.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await wait(60);
        const e = workingNodes.find(x=> x[0] === 'o1111_a');
        r.tagRenamed = [e[6].tags.join(), (TAG_CATS.find(c=> c.name === 'O1111 cat') || {tags: []}).tags.join(),
                        (SETTINGS.tagColors || {})['o1111-renamed'] || null, 'o1111-tag' in (SETTINGS.tagColors || {}),
                        !!document.querySelector('#tagsList .legend-item[data-tag="o1111-renamed"]')];
        /* Taken already: refused, and nothing changes. */
        const w2 = document.querySelector('#tagsList .legend-item[data-tag="o1111-renamed"] .tag-text');
        w2.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        w2.textContent = 'o1111-other';
        w2.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        await wait(60);
        r.tagTaken = workingNodes.find(x=> x[0] === 'o1111_a')[6].tags.join();
        const special = Object.keys(SPECIAL_TAGS)[0];
        const srow = document.querySelector(`#tagsList .legend-item[data-tag="${CSS.escape(special)}"] .tag-text`);
        r.specialFixed = !srow || !srow.classList.contains('tag-renamable');
      }
      setSideTab(document.getElementById('tagsPanel'), false);

      /* 3. Words to a side. */
      const lines = (id, cls)=>{
        const t = document.querySelector(`.node[data-id="${id}"] text.${cls || 'node-label-text'}`);
        const by = new Map();
        [...t.querySelectorAll('tspan')].forEach(sp=>{
          if(!sp.textContent.trim()) return;
          const y = sp.getAttribute('y'), x = +sp.getAttribute('x'), x2 = x + sp.getComputedTextLength();
          const o = by.get(y) || {l: Infinity, r: -Infinity};
          o.l = Math.min(o.l, x); o.r = Math.max(o.r, x2); by.set(y, o);
        });
        return [...by.values()];
      };
      const box = id=> { const n = nodes.get(id); return {x: n.x, w: n.w, h: n.h}; };
      const spread = (a, k)=> Math.max(...a.map(o=> o[k])) - Math.min(...a.map(o=> o[k]));
      const before = box('o1111_a');
      const mid = lines('o1111_a');
      openStyleBar({kind: 'node', id: 'o1111_a'});
      await wait(30);
      r.barRow = !!styleBar.querySelector('.style-bar-group[data-group="align"]') &&
                 !styleBar.querySelector('.style-bar-group[data-group="align"]').hidden &&
                 styleBar.querySelectorAll('.style-bar-group[data-group="align"] button[data-value]').length;
      styleBar.querySelector('.style-bar-group[data-group="align"] button[data-value="left"]').click();
      await wait(60);
      const left = lines('o1111_a'), atLeft = box('o1111_a');
      r.leftSaved = workingNodes.find(x=> x[0] === 'o1111_a')[6].align;
      styleBar.querySelector('.style-bar-group[data-group="align"] button[data-value="right"]').click();
      await wait(60);
      const right = lines('o1111_a'), atRight = box('o1111_a');
      r.lit = (styleBar.querySelector('.style-bar-group[data-group="align"] button.on') || {}).dataset;
      r.lit = r.lit ? r.lit.value : null;
      styleBar.querySelector('.style-bar-group[data-group="align"] button[data-value="center"]').click();
      await wait(60);
      r.centreGone = !('align' in workingNodes.find(x=> x[0] === 'o1111_a')[6]);
      const again = lines('o1111_a');
      const ins = textInsetFor(nodes.get('o1111_a'));
      r.align = {
        lines: mid.length,
        leftFlush: spread(left, 'l') < 0.6 && spread(left, 'r') > 5,
        leftEdge: +(left[0].l - (atLeft.x + ins)).toFixed(2),
        rightFlush: spread(right, 'r') < 0.6 && spread(right, 'l') > 5,
        rightEdge: +((atRight.x + atRight.w - ins) - right[0].r).toFixed(2),
        sameBox: [atLeft, atRight].every(b=> b.w === before.w && b.h === before.h),
        centreBack: JSON.stringify(again) === JSON.stringify(mid)
      };
      closeStyleBar();
      /* A card's bands go the same way as its heading. */
      applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'o1111_c'); e[6].align = 'left'; });
      await wait(60);
      {
        const n = nodes.get('o1111_c'), inn = textInsetFor(n);
        const lefts = ['node-label-text', 'card-medium', 'card-body'].map(c=> Math.min(...lines('o1111_c', c).map(o=> o.l)));
        r.cardLeft = lefts.map(l=> +(l - (n.x + inn)).toFixed(1));
      }
      /* The field typed in sets its words the same way. */
      applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'o1111_a'); e[6].align = 'right'; });
      await wait(60);
      openNodeEditor('o1111_a');
      await wait(120);
      const surf = document.querySelector('#nodeEditor .rich-surface');
      r.fieldAlign = surf ? surf.style.textAlign : null;
      closeNodeEditor(false);
      await wait(60);
      r.inFile = /"align":"right"/.test(chartFileText());
    } finally {
      setSideTab(document.getElementById('mediaPanel'), false);
      setSideTab(document.getElementById('tagsPanel'), false);
      workingNodes = keep.nodes; refill(EDGE_STYLES, keep.styles);
      TAG_CATS.splice(0, TAG_CATS.length, ...keep.cats);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]); Object.assign(SETTINGS, keep.settings);
      rebuildChart(); buildSideTabs();
    }
    return r;
  }, [X, Y]);
  check('a kind of medium\'s heading reads eye, name, ▸, count, ✕ — the fold before the count, as a category\'s',
        JSON.stringify(out.order) === '["eye","name","fold","count","x"]', JSON.stringify(out.order));
  /* "Written as" came back on the owner's list of 21.11 — as the line
     itself, its facts as chips and the words between typed in place, not
     as a field of %Name% markup. */
  check('the media drawer holds no fields: its names are text, in the type of a category\'s heading and a tag row, and "Written as" is the line, not a field',
        out.inputs === 0 && out.writtenAs && out.nameTag === 'SPAN:SPAN' && out.nameFont.every(Boolean) && out.labelFont.every(Boolean),
        JSON.stringify([out.inputs, out.writtenAs, out.nameTag, out.nameFont, out.labelFont]));
  check('…a double click types over a kind\'s name where it stands and does not fold it; a single click on the heading folds',
        out.renaming && out.renamedKind === 'Picture|true' && out.headFolds, JSON.stringify([out.renaming, out.renamedKind, out.headFolds]));
  check('a kind\'s line is its fields top to bottom, whatever line it once had of its own, and that line is dropped on the next edit',
        /^Toei,\s*1986$/.test(out.line) && out.formatGone, JSON.stringify([out.line, out.formatGone]));
  check('a tag is renamed by pressing its name: on its entries, in its category, with its colour',
        out.tagRenaming && JSON.stringify(out.tagRenamed) === JSON.stringify(['o1111-renamed,o1111-other', 'o1111-renamed', '#aa3300', false, true]),
        JSON.stringify([out.tagRenaming, out.tagRenamed]));
  check('…not into a name already taken, and not a tag that acts', out.tagTaken === 'o1111-renamed,o1111-other' && out.specialFixed,
        JSON.stringify([out.tagTaken, out.specialFixed]));
  check('the style bar sets an entry\'s words left, centred or right, and lights the one chosen', out.barRow === 3 && out.lit === 'right' && out.leftSaved === 'left' && out.centreGone,
        JSON.stringify([out.barRow, out.lit, out.leftSaved, out.centreGone]));
  check('…to the left every line starts at the inset, to the right every line ends there, and the box keeps its size',
        out.align.lines >= 2 && out.align.leftFlush && out.align.rightFlush && Math.abs(out.align.leftEdge) < 1.5 &&
        Math.abs(out.align.rightEdge) < 1.5 && out.align.sameBox && out.align.centreBack, JSON.stringify(out.align));
  check('…a card\'s heading, medium line and body go to the side together', out.cardLeft.every(d=> Math.abs(d) < 1.5), JSON.stringify(out.cardLeft));
  check('…the field the words are typed in sets them the same way, and the file keeps the side', out.fieldAlign === 'right' && out.inFile,
        JSON.stringify([out.fieldAlign, out.inFile]));
  });
  await scenario("the owner's list of 11.11, afternoon: a plus for a field, the side before the turn, rules as the border, ruby picked and sized as drawn, the phone's Save at its corner, a note off a short leg, the whole picture to crop, a player that keeps working, menus moved by hand, an editor on its box", async () => {
  const X = 187000, Y = 187000;
  const GIF = 'data:image/gif;base64,R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBFAABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7';
  await page.evaluate(()=>{ window.__k1111 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
    settings: JSON.parse(JSON.stringify(SETTINGS))}; return true; });
  try{
  const out = await page.evaluate(async ([X, Y, GIF])=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    applyEdit(()=>{
      SETTINGS.mediaTypes = [{id:'p1111k', name:'Film', fields:[{id:'f1', label:'Studio'}]}];
      workingNodes.push(['p1111_a', 'Alpha', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['p1111_l', '', null, null, null, 'link', {pos:[X + 200, Y]}]);
      workingNodes.push(['p1111_c', 'A card', null, null, 'Its words', null, {pos:[X + 400, Y], card:true, mediaType:'p1111k', mediaData:{f1:'Toei'}, border:'dashed'}]);
      workingNodes.push(['p1111_d', 'Double', null, null, 'Its words', null, {pos:[X + 600, Y], card:true, border:'double'}]);
      workingNodes.push(['p1111_t', 'Top', null, null, null, null, {pos:[X, Y + 200]}]);
      workingNodes.push(['p1111_b', 'Bottom', 'p1111_t', null, null, null, {pos:[X, Y + 420]}]);
      workingNodes.push(['p1111_i', '', null, null, null, 'image', {pos:[X + 400, Y + 300], image: GIF, size:[160, 160]}]);
      EDGE_STYLES.push({from:'p1111_t', to:'p1111_b', routing:'straight', note:'Аита'});
    });
    rebuildChart();
    await wait(200);

    /* 1. A kind's "+ field" is a plus, as everywhere else. */
    setSideTab(document.getElementById('mediaPanel'), true);
    await wait(60);
    mediaKindsOpen().add('p1111k');
    buildMediaTab();
    const add = document.querySelector('#mediaList .media-kind[data-kind="p1111k"] .media-add-field');
    r.plus = !!add && !/field/i.test(add.textContent) && !!add.querySelector('svg, *') === !!add.children.length && add.title === 'Add a field to this kind';
    setSideTab(document.getElementById('mediaPanel'), false);

    /* 2. The side the words go to, just before the turn; no turn on a link. */
    const groups = ()=> [...styleBar.querySelectorAll('.style-bar-group')].filter(g=> !g.hidden).map(g=> g.dataset.group);
    openStyleBar({kind:'node', id:'p1111_a'}); await wait(40);
    const ga = groups();
    r.beforeTurn = ga.indexOf('align') >= 0 && ga.indexOf('align') === ga.indexOf('turn') - 1;
    r.groupsA = ga.join();
    openStyleBar({kind:'node', id:'p1111_l'}); await wait(40);
    r.linkGroups = groups().join();
    closeStyleBar();
    r.textLabel = [NODE_STYLE_PICKS.find(p=> p.value === 'textbox').label,
                   document.querySelector('option[value="textbox"]').textContent].join();

    /* 3. A card's rules are its border: as wide, as dashed, as doubled. */
    {
      const g = qNode('.node[data-id="p1111_c"]');
      const border = [...g.querySelectorAll(':scope > rect:not(.node-hover-pad)')].find(e=> getComputedStyle(e).strokeDasharray !== 'none');
      const rules = [...g.querySelectorAll(':scope > line.card-rule')];
      const cs = e=> getComputedStyle(e);
      r.ruleW = rules.map(l=> parseFloat(cs(l).strokeWidth));
      r.ruleDash = rules.map(l=> cs(l).strokeDasharray);
      r.borderDash = border ? cs(border).strokeDasharray : 'none';
      r.ruleOpacity = rules.map(l=> cs(l).opacity);
      const d = qNode('.node[data-id="p1111_d"]');
      r.doubleRules = d.querySelectorAll(':scope > line.card-rule').length;
      r.doubleInner = d.querySelectorAll(':scope > line.card-rule.border-inner').length;
    }

    /* 4. Ruby: the reading sits as far over its line as the rules of
       ordinary text say, and a size chosen in the field shows at the size
       it will be drawn, at any zoom and inside the reading. */
    r.rubyExtra = RUBY_EXTRA; r.nodeBorderW = NODE_BORDER_W;
    vs = 2; vx = -X * 2 + 300; vy = -Y * 2 + 200; applyTransform();
    applyEdit(()=>{ workingNodes.find(x=> x[0] === 'p1111_a')[1] = 'Some[[Optimus|Оптимус]]Prime'; });
    await wait(60);
    openNodeEditor('p1111_a'); await wait(150);
    {
      const surf = document.querySelector('#nodeEditor .rich-surface');
      const sp = document.createElement('span'); sp.dataset.size = '20'; sp.style.fontSize = '20px'; sp.textContent = 'big';
      surf.appendChild(sp);
      const rt = surf.querySelector('rt');
      const sp2 = document.createElement('span'); sp2.dataset.size = '20'; sp2.style.fontSize = '20px'; sp2.textContent = 'x';
      if(rt) rt.appendChild(sp2);
      await wait(40);
      r.sizeShown = [parseFloat(getComputedStyle(sp).fontSize), rt ? parseFloat(getComputedStyle(sp2).fontSize) : null];
      sp.remove(); sp2.remove();
      await wait(40);
    }
    closeNodeEditor(false);
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    await wait(60);

    /* 5. A note beside a line that runs up and down stands clear of it,
       whatever its width. */
    {
      const line = drawnLineOf('p1111_t', 'p1111_b');
      const g = document.querySelector('.edge-note[data-from="p1111_t"][data-to="p1111_b"]');
      const b = g.getBBox(), t = g.transform.baseVal.consolidate();
      const dx = t ? t.matrix.e : 0, dy = t ? t.matrix.f : 0;
      // The line's x where the note's middle is: it leans by a few pixels.
      const cy = b.y + dy + b.height / 2, a = line[0], z = line[line.length - 1];
      const lx = a.x + (z.x - a.x) * (cy - a.y) / ((z.y - a.y) || 1);
      r.noteGap = Math.min(Math.abs(b.x + dx - lx), Math.abs(b.x + b.width + dx - lx));
      r.noteStraddles = b.x + dx < lx && b.x + b.width + dx > lx;
    }

    /* 6. The cropper starts on the whole picture, frees both sides, and
       answers with a cross and a tick. */
    {
      const c = document.createElement('canvas'); c.width = 80; c.height = 40;
      c.getContext('2d').fillRect(0, 0, 80, 40);
      const blob = await new Promise(ok=> c.toBlob(ok, 'image/png'));
      const p = openCropper(new File([blob], 'w.png', {type:'image/png'}), 'T', 'rect');
      await wait(250);
      r.cropSel = [cropSel.x, cropSel.y, cropSel.s, cropSel.t].join();
      r.cropButtons = [!document.getElementById('cropWhole'),
                       document.getElementById('cropCancel').classList.contains('suggest-decline') && !!document.querySelector('#cropCancel svg'),
                       document.getElementById('cropUse').classList.contains('suggest-done') && !!document.querySelector('#cropUse svg'),
                       !/[a-z]/i.test(document.getElementById('cropCancel').textContent + document.getElementById('cropUse').textContent)];
      document.getElementById('cropCancel').click();
      r.cropAnswer = await p;
    }
    return r;
  }, [X, Y, GIF]);
  check('a kind of medium adds a field by a plus button, not by the words "+ field"', out.plus, JSON.stringify(out.plus));
  check('the style bar\'s side for the words stands just before the turn', out.beforeTurn, out.groupsA);
  check('…and a link node has no turn', !/turn/.test(out.linkGroups), out.linkGroups);
  check('the text entry is called Text, in the add menu and the shape list', out.textLabel === 'Text,Text', out.textLabel);
  check('a card\'s rules are as wide and as dashed as its border, at full strength',
        out.ruleW.length >= 1 && out.ruleW.every(w=> Math.abs(w - out.nodeBorderW) < 0.01) &&
        /* Dashed in the border's pattern; each line is fitted to its own
           length since 25.11, so it is the dash that is compared. */
        out.ruleDash.every(d=> d !== 'none' && Math.abs(parseFloat(d) - parseFloat(out.borderDash)) / parseFloat(out.borderDash) < 0.25) &&
        out.borderDash !== 'none' && out.ruleOpacity.every(o=> o === '1'),
        JSON.stringify([out.ruleW, out.ruleDash, out.borderDash, out.ruleOpacity]));
  check('…and a double border\'s rules are doubled', out.doubleRules >= 2 && out.doubleInner * 2 === out.doubleRules,
        JSON.stringify([out.doubleRules, out.doubleInner]));
  check('a reading over a line adds only the room its own type needs over the line\'s, not a fixed 9 — kept for the tallest letter since 15.11',
        out.rubyExtra < 9 && Math.abs(out.rubyExtra - (11.5 * 0.75 + 1.5 + 7.5 * 0.21 + 7.5 * 0.72 - 11.5 * 0.72)) < 0.01, String(out.rubyExtra));
  check('a size chosen in the field shows as it is drawn: scaled with the chart, and smaller again in a reading',
        out.sizeShown[0] === 40 && out.sizeShown[1] !== null && Math.abs(out.sizeShown[1] - 40 * 7.5 / 11.5) < 0.1,
        JSON.stringify(out.sizeShown));
  check('a note beside an upright line stands clear of it rather than across it', !out.noteStraddles && out.noteGap >= 3.5,
        JSON.stringify([out.noteGap, out.noteStraddles]));
  check('the cropper for a card\'s picture starts on the whole picture, has no "whole image" button, and answers with ✕ and ✓',
        out.cropSel === '0,0,80,40' && out.cropButtons.every(Boolean) && out.cropAnswer === 'cancel',
        JSON.stringify([out.cropSel, out.cropButtons, out.cropAnswer]));

  /* Selecting a word of a reading by a double click picks that word, not
     everything from the word it reads to the end. */
  await page.evaluate(async ([X, Y])=>{ vs = 2; vx = -X * 2 + 300; vy = -Y * 2 + 200; applyTransform(); openNodeEditor('p1111_a'); await new Promise(ok=> setTimeout(ok, 150)); }, [X, Y]);
  const rtAt = await page.evaluate(()=>{
    const rt = document.querySelector('#nodeEditor .rich-surface rt');
    if(!rt) return null;
    const range = document.createRange(); range.selectNodeContents(rt);
    const b = range.getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  });
  if(rtAt) await page.mouse.dblclick(rtAt[0], rtAt[1]);
  await page.waitForTimeout(80);
  const picked = await page.evaluate(()=>{ const s = String(window.getSelection()); closeNodeEditor(false); vs = 1; applyTransform(); return s; });
  check('a double click on a reading picks that reading\'s word alone', picked === 'Оптимус', JSON.stringify([rtAt, picked]));

  /* The field is written in as a note is (the owner's word of 20.11):
     Enter is a new line, Ctrl+Enter and Escape keep what is written and
     let it go, and the ✓ is on its toolbar on a desk as on a phone. */
  await page.evaluate(async ([X, Y])=>{
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    applyEdit(()=>{ workingNodes.find(x=> x[0] === 'p1111_a')[1] = 'Alpha'; });
    openNodeEditor('p1111_a'); await new Promise(ok=> setTimeout(ok, 150));
  }, [X, Y]);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Beta');
  await page.waitForTimeout(80);
  const seam = await page.evaluate(()=>{
    const done = document.getElementById('nodeEditorDone');
    return {open: !!nodeEditorTarget, value: document.getElementById('nodeEditorText').value,
            tick: !!done && getComputedStyle(done).display !== 'none' && done.getBoundingClientRect().width > 0};
  });
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(150);
  seam.ctrl = await page.evaluate(()=> ({open: !!nodeEditorTarget, label: nodes.get('p1111_a').label}));
  await page.evaluate(async ()=>{ openNodeEditor('p1111_a'); await new Promise(ok=> setTimeout(ok, 150)); });
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  seam.esc = await page.evaluate(()=> ({open: !!nodeEditorTarget, label: nodes.get('p1111_a').label,
    veil: (document.getElementById('nodeEditorVeil') || {}).textContent || ''}));
  await page.evaluate(()=>{ applyEdit(()=>{ workingNodes.find(x=> x[0] === 'p1111_a')[1] = 'Alpha'; }); });
  check('in the in-node field Enter starts a new line, as in a note, and its ✓ is on the toolbar on a desk too',
        seam.open && /Alpha\nBeta$/.test(seam.value) && seam.tick, JSON.stringify(seam));
  check('…Ctrl+Enter keeps what is written and lets the field go, and so does Escape, and the drawn words come back',
        !seam.ctrl.open && /Alpha\nBeta$/.test(seam.ctrl.label) && !seam.esc.open && /Beta!$/.test(seam.esc.label) && seam.esc.veil === '',
        JSON.stringify([seam.ctrl, seam.esc]));

  /* The picture's player keeps working: carried, it goes rather than
     standing over where the picture was; redrawn, it follows; a finger
     lifting does not shut it, a tap brings it, a picture that plays on
     hover keeps playing while the hand is on the buttons, and it stands
     over the picture's own menu. */
  const player = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    flyToNode('p1111_i'); await wait(200);
    const img = ()=> pictureElementOf('p1111_i');
    const centre = ()=>{ const b = img().getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const at = (type, [x, y], extra)=>{
      const t = document.elementFromPoint(x, y) || img();
      t.dispatchEvent(new PointerEvent(type, Object.assign({bubbles:true, clientX:x, clientY:y, pointerType:'mouse'}, extra || {})));
    };
    at('pointermove', centre()); await wait(30);
    r.opened = !picturePlayer.hidden && picturePlayerFor === 'p1111_i';
    // Redrawn somewhere else, it follows.
    applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === 'p1111_i'); e[6].pos = [e[6].pos[0] + 60, e[6].pos[1]]; });
    await wait(60);
    const pr = picturePlayer.getBoundingClientRect(), ir = img().getBoundingClientRect();
    r.follows = !picturePlayer.hidden && Math.abs((pr.left + pr.right) / 2 - (ir.left + ir.right) / 2) < 1.5;
    // Carried, it goes at once.
    chartCarriedAt = performance.now();
    at('pointermove', centre());
    r.goneWhileCarried = picturePlayer.hidden;
    chartCarriedAt = 0;
    // A finger lifting is not leaving the page.
    at('pointermove', centre()); await wait(30);
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave', {pointerType:'touch'}));
    r.touchLeaveKeeps = !picturePlayer.hidden;
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave', {pointerType:'mouse'}));
    r.mouseLeaveShuts = picturePlayer.hidden;
    // A tap brings it.
    at('pointerdown', centre(), {pointerType:'touch'});
    at('pointerup', centre(), {pointerType:'touch'});
    await wait(30);
    r.tapOpens = !picturePlayer.hidden && picturePlayerFor === 'p1111_i';
    // A press on its own picture leaves it be.
    at('pointerdown', centre()); at('pointerup', centre()); await wait(30);
    r.pressKeeps = !picturePlayer.hidden;
    // Playing on hover goes on while the pointer is on the buttons.
    setPictureAnim('p1111_i', 'hover'); await wait(150);
    at('pointermove', centre()); at('pointerover', centre()); await wait(30);
    const b = picturePlayer.querySelector('button').getBoundingClientRect();
    picturePlayer.querySelector('button').dispatchEvent(new PointerEvent('pointerover', {bubbles:true, clientX:b.left + 2, clientY:b.top + 2}));
    r.keepsPlaying = img().dataset.playing === '1';
    document.body.dispatchEvent(new PointerEvent('pointerover', {bubbles:true}));
    setPictureAnim('p1111_i', 'play');
    r.overMenus = +getComputedStyle(picturePlayer).zIndex > +getComputedStyle(freeMenu).zIndex;
    closePicturePlayer();
    return r;
  });
  check('the picture\'s player follows its picture when the chart is redrawn', player.opened && player.follows, JSON.stringify(player));
  check('…goes at once while the chart is carried, instead of standing where the picture was', player.goneWhileCarried, JSON.stringify(player));
  check('…stays when a finger lifts (only a mouse leaving the window shuts it), and a tap on the picture brings it',
        player.touchLeaveKeeps && player.mouseLeaveShuts && player.tapOpens && player.pressKeeps, JSON.stringify(player));
  check('…a picture that plays on hover keeps playing while the hand is on the buttons, and the player stands over the picture\'s menu',
        player.keepsPlaying && player.overMenus, JSON.stringify(player));

  /* Menus moved by hand: the style bar by its dots, a panel by its head;
     the shift goes when the menu closes or turns to something else. */
  await page.evaluate(async ()=>{ flyToNode('p1111_a'); await new Promise(ok=> setTimeout(ok, 150)); openStyleBar({kind:'node', id:'p1111_a'}); await new Promise(ok=> setTimeout(ok, 50)); });
  const grip = await page.evaluate(()=>{ const g = styleBar.querySelector('.menu-grip'); if(!g) return null; const b = g.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  let moved = {grip: !!grip};
  if(grip){
    await page.mouse.move(grip[0], grip[1]);
    await page.mouse.down();
    await page.mouse.move(grip[0] + 90, grip[1] - 50, {steps: 6});
    await page.mouse.up();
    moved = Object.assign(moved, await page.evaluate(async ()=>{
      const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
      const m = {shift: styleBar.style.translate, open: !styleBar.hidden};
      positionStyleBar(); await wait(20);
      m.keptOnPlace = styleBar.style.translate === m.shift;
      openStyleBar({kind:'node', id:'p1111_c'}); await wait(30);
      m.otherClears = !styleBar.style.translate;
      closeStyleBar(); await wait(20);
      // A panel by its head, with a finger.
      openFreeMenu('p1111_i'); await wait(60);
      const head = freeMenu.querySelector('.edge-popover-head');
      const hb = head.getBoundingClientRect(), x = hb.left + 30, y = hb.top + hb.height / 2;
      head.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:x, clientY:y, pointerType:'touch', pointerId: 7, button: 0}));
      head.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, clientX:x - 40, clientY:y + 70, pointerType:'touch', pointerId: 7}));
      head.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:x - 40, clientY:y + 70, pointerType:'touch', pointerId: 7}));
      m.panelShift = freeMenu.style.translate;
      closeFreeMenu(); await wait(30);
      m.closeClears = !freeMenu.style.translate;
      m.editorGrip = !!document.querySelector('#nodeEditorBar > .menu-grip') && !!edgePopover.querySelector('.edge-popover-head .menu-grip');
      return m;
    }));
  }
  check('the style bar is carried by its dots and keeps the shift while it stands for the same thing',
        moved.grip && moved.shift === '90px -50px' && moved.open && moved.keptOnPlace, JSON.stringify(moved));
  check('…and the shift goes when it turns to another thing or a menu closes; a panel is carried by its head, a finger too',
        moved.otherClears && moved.panelShift === '-40px 70px' && moved.closeClears && moved.editorGrip, JSON.stringify(moved));

  /* On a phone the second row of the bar starts at the left like the
     first, and Save keeps the bottom right corner. */
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(200);
  const bar = await page.evaluate(()=>{
    const top = document.querySelector('.topbar');
    // The tool row is a band the bar's width; its tools start at the left like the rest.
    const kids = [...top.querySelectorAll(':scope > *:not(.brand):not(.search-wrap):not(#toolRow), #toolRow > .topbar-tools')].filter(e=> e.offsetParent !== null && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
    const rows = new Map();
    // A row by the middle of what stands in it: Save is taller than the account beside it.
    kids.forEach(e=>{ const b = e.getBoundingClientRect(); const k = Math.round((b.top + b.height / 2) / 8); if(!rows.has(k)) rows.set(k, []); rows.get(k).push(b); });
    const saveBox = document.getElementById('saveBtn').getBoundingClientRect();
    // Save on a row of its own keeps to the right end, as it is meant to.
    const lefts = [...rows.values()].filter(rs=> !(rs.length === 1 && rs[0].left === saveBox.left && rs[0].top === saveBox.top))
      .map(rs=> Math.min(...rs.map(b=> b.left)));
    const save = document.getElementById('saveBtn').getBoundingClientRect();
    // The second toolbar is the bar's last row, under Save (22.11).
    const others = kids.filter(e=> !e.matches('#saveBtn, .owner-avatar, .owner-btn, .save-state, .topbar-tools')).map(e=> e.getBoundingClientRect());
    return {lefts: lefts.map(v=> Math.round(v)), rows: rows.size,
            saveRight: save.right >= Math.max(...others.filter(b=> Math.abs(b.top - save.top) < 12).map(b=> b.right), 0),
            saveLow: others.every(b=> b.top < save.bottom - 1),
            /* …or, while the chart's status is shown, the status stands
               there, right of Save (the owner's list of 23.11). */
            saveNearEnd: (()=>{
              const st = document.getElementById('saveState'), end = top.getBoundingClientRect().right;
              if(st.classList.contains('show') && !st.classList.contains('err')){
                const b = st.getBoundingClientRect();
                return b.left >= save.right - 0.5 && b.left - save.right < 16 && end - b.right < 70;
              }
              return end - save.right < 70;
            })()};
  });
  await page.setViewportSize({width: 1500, height: 950});
  await page.waitForTimeout(200);
  check('on a phone every row of the top bar starts at the left, and Save keeps the right end of the last row above the tools',
        bar.lefts.every(l=> Math.abs(l - bar.lefts[0]) < 3) && bar.saveRight && bar.saveLow && bar.saveNearEnd, JSON.stringify(bar));
  } finally {
    await page.evaluate(()=>{
      const k = window.__k1111;
      closeStyleBar(); closeNodeEditor(false); closePicturePlayer();
      workingNodes = k.nodes; refill(EDGE_STYLES, k.styles);
      Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]); Object.assign(SETTINGS, k.settings);
      vs = 1; applyTransform(); rebuildChart(); buildSideTabs();
    });
  }
  });
  await scenario("the owner's list of 15.11: a reading clear of a capital and gone with its text, lines that come back together in the editor, a reader's media tab, a merge's glow past a T, no picture corners, dots that swell, a split that does not jump", async () => {
  const X = 191000, Y = 191000;
  await page.evaluate(()=>{ window.__k1511 = {nodes: workingNodes.map(x=> x.slice()), styles: EDGE_STYLES.map(x=> Object.assign({}, x)),
    settings: JSON.parse(JSON.stringify(SETTINGS))}; return true; });
  try{
  const out = await page.evaluate(async ([X, Y])=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    SETTINGS.mediaTypes = [{id:'k1511', name:'Film', fields:[{id:'f1', label:'Studio'}]}];
    applyEdit(()=>{
      workingNodes.push(['q15_r', 'Some [[Optimus|оптимус]] [[mus|му]]', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['q15_e', 'First line\nSecond line\nThird line', null, null, null, null, {pos:[X, Y + 200]}]);
    });
    await wait(300);

    /* 1. A reading stands clear of the tallest letter under it, so higher
       over a capital than over small letters; and one emptied in the
       editor goes, slot and all. */
    {
      const ts = [...document.querySelectorAll('.node[data-id="q15_r"] tspan')];
      const y = t=> t ? +t.getAttribute('y') : NaN;
      const base = ts.find(t=> t.textContent === 'Optimus'), read = ts.find(t=> t.textContent === 'оптимус');
      const read2 = ts.find(t=> t.textContent === 'му');
      r.rise = y(base) - y(read);
      r.riseSmall = y(base) - y(read2);
      openNodeEditor('q15_r'); await wait(250);
      const surf = document.querySelector('#nodeEditor .rich-surface');
      const rt = surf.querySelector('rt');
      const sel = getSelection(), rg = document.createRange();
      rg.selectNodeContents(rt); sel.removeAllRanges(); sel.addRange(rg);
      document.execCommand('delete');
      surf.dispatchEvent(new InputEvent('input', {bubbles:true}));
      await wait(50);
      r.rubies = surf.querySelectorAll('ruby').length;
      r.text = surf.textContent;
      closeNodeEditor(false); await wait(150);
    }

    /* 2. Underlined and struck across three lines and taken off again:
       the lines stand where they stood, and the markup is what it was. */
    {
      openNodeEditor('q15_e'); await wait(250);
      const surf = document.querySelector('#nodeEditor .rich-surface');
      const lines = ()=> [...surf.querySelectorAll(':scope > div')].map(d=>{ const b = d.getBoundingClientRect(); return b.top.toFixed(1) + '/' + b.height.toFixed(1); }).join(' ');
      r.html0 = surf.innerHTML; r.lines0 = lines();
      const sel = getSelection();
      r.edits = [];
      for(const kind of ['under', 'strike']){
        const ds = surf.querySelectorAll(':scope > div');
        const rg = document.createRange(); rg.setStart(ds[0].firstChild, 6); rg.setEnd(ds[2].firstChild, 5);
        sel.removeAllRanges(); sel.addRange(rg);
        applyRichCommand(surf, kind); await wait(100);
        const rg2 = document.createRange(); rg2.selectNodeContents(surf); sel.removeAllRanges(); sel.addRange(rg2);
        applyRichCommand(surf, kind); await wait(100);
        r.edits.push({kind, lines: lines(), html: surf.innerHTML});
      }
      closeNodeEditor(false); await wait(150);
    }

    /* 3. A reader has the Media tab, with nothing in it to add or unfold;
       the author's + is the tab's own frame with a plus. */
    {
      setReaderPreview(true); await wait(150);
      const panel = document.getElementById('mediaPanel');
      buildMediaTab();
      const list = document.getElementById('mediaList');
      r.readerTab = getComputedStyle(panel).display !== 'none' && !!list.querySelector('.media-kind');
      r.readerBare = !list.querySelector('.plus-mini, .media-fold, .media-x, .media-field, .media-add-field');
      const tabs = ['tagsPanel', 'refsPanel', 'keyPanel', 'mediaPanel'].map(id=> document.getElementById(id).getBoundingClientRect());
      r.readerStacked = tabs.every((b, i)=> i === 0 || b.top >= tabs[i - 1].bottom - 1);
      setReaderPreview(false); await wait(150);
      buildMediaTab();
      const add = document.querySelector('#mediaList .plus-mini:not(.media-add-field)');
      r.addGlyph = !!add && add.querySelectorAll('line').length === 2 && add.querySelectorAll('path').length === 2 &&
                   add.title === 'Add a kind of medium';
    }

    /* 4 and 6. A merge whose lineage ends in a T at the bar: picked, the
       bar is lit only as far as that lineage's line goes, and its T is
       lit with it; a picked lineage swells the dot it joins at. */
    applyEdit(()=>{
      workingNodes.push(['q15_a', 'A', null, null, null, null, {pos:[X + 600, Y]}]);
      workingNodes.push(['q15_b', 'B', null, null, null, null, {pos:[X + 900, Y]}]);
      workingNodes.push(['q15_c', 'C', null, null, null, null, {pos:[X + 1200, Y]}]);
      workingNodes.push(['q15_m', 'M', ['q15_a', 'q15_b', 'q15_c'], null, null, null, {pos:[X + 900, Y + 300], merge:true}]);
      ['q15_a', 'q15_b', 'q15_c'].forEach(f=> EDGE_STYLES.push({from:f, to:'q15_m', routing:'orthogonal', dash:'solid', arrow:true, toSide:'top'}));
    });
    await wait(300);
    applyEdit(()=> setEdgeStyleOverride('q15_a', 'q15_m', Object.assign({}, edgeStyleFor('q15_a', 'q15_m'), {barEnd:'tout'})));
    await wait(300);
    {
      setBarFocus('q15_m'); await wait(50);
      const nums = d=> (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const line = document.querySelector('.edge.amalgam-member[data-from="q15_a"][data-to="q15_m"]');
      const lineEnd = nums(line.getAttribute('d')).slice(-2);
      const focus = [...document.querySelectorAll('.amalgam-bar-focus[data-amalgam="q15_m"]')].map(p=> nums(p.getAttribute('d')));
      r.focusStops = focus.some(f=> Math.hypot(f[f.length - 2] - lineEnd[0], f[f.length - 1] - lineEnd[1]) < 0.05);
      r.focusPastLine = focus.some(f=> f.length >= 4 && [0, f.length - 2].some(k=> {
        const dLine = Math.hypot(f[k] - lineEnd[0], f[k + 1] - lineEnd[1]);
        return dLine > 0.05 && dLine < TEE_CUT + AMALGAM_BEAD_R + 0.5 && Math.abs(f[1] - lineEnd[1]) < 0.05 && Math.abs(f[0] - f[2]) > 0 &&
               Math.min(f[0], f[2]) < lineEnd[0] && Math.max(f[0], f[2]) > lineEnd[0] + 0.05;
      }));
      r.teeLit = !!document.querySelector('.edge-tee.bar-end.bar-picked[data-from="q15_a"]');
      setBarFocus(null); await wait(50);
      r.teeUnlit = !document.querySelector('.bar-picked');
      /* Picked, the merged arrow leaves its junction's bead as it is; the
         bead swells only while the junction is carried (the owner's list
         of 19.11 put right what 15.11 had it do on a pick). */
      openEdgeStylePopover('', 'q15_m', {clientX: 1300, clientY: 800, stopPropagation(){}});
      await wait(200);
      const junction = ()=> document.querySelector('.amalgam-bead.amalgam-junction[data-to="q15_m"]');
      const swollen = c=> !!c && /matrix\(1\.[5-6]/.test(getComputedStyle(c).transform);
      r.beadStill = !!junction() && !swollen(junction());
      closeEdgePopover(); await wait(100);
      const hit = document.querySelector('.amalgam-junction-hit[data-amalgam="q15_m"]');
      const hb = hit.getBoundingClientRect(), hx = hb.left + hb.width/2, hy = hb.top + hb.height/2;
      hit.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, clientX:hx, clientY:hy, button:0}));
      for(let i = 1; i <= 6; i++){ window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:hx + 6*i, clientY:hy})); await wait(20); }
      await wait(120);
      r.beadSwells = swollen(junction());
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, clientX:hx + 36, clientY:hy}));
      await wait(200);
      r.beadBack = !document.querySelector('.bead-carried') && !swollen(junction());
      undoLastEdit(); await wait(200);
    }

    /* 5. No corners of its own on a card's picture. */
    r.noPictureCorners = typeof beginCardImageResize === 'undefined' && typeof openCardImageEdit === 'undefined' &&
                         typeof cardImgEditId === 'undefined';

    /* 6 and 7. A split carried along a line that turns swells, and goes
       round the corner after the hand rather than jumping it. */
    applyEdit(()=>{
      workingNodes.push(['q15_s', 'Source', null, null, null, null, {pos:[X, Y + 500]}]);
      workingNodes.push(['q15_t', 'Target', 'q15_s', null, null, null, {pos:[X + 300, Y + 760]}]);
      EDGE_STYLES.push({from:'q15_s', to:'q15_t', routing:'orthogonal'});
    });
    await wait(300);
    {
      const rv = svg.getBoundingClientRect();
      const toClient = p=> ({x: rv.left + vx + p.x * vs, y: rv.top + vy + p.y * vs});
      const mid = pointAtFraction(drawnLineOf('q15_s', 'q15_t'), 0.5);
      const c = toClient(mid);
      openEdgeStylePopover('q15_s', 'q15_t', {clientX: c.x, clientY: c.y, stopPropagation(){}});
      openTouchMenu(c.x, c.y, 'edge', true);
      touchMenu.querySelector('[data-act="split"]').click();
      await wait(300);
      if(typeof endSplitBranch === 'function') endSplitBranch();
      closeEdgePopover(); closeTouchMenu();
      const dotId = (workingNodes.find(e=> e[5] === 'split' && e[2] === 'q15_s') || [])[0];
      const dot = nodes.get(dotId);
      const track = splitTrackOf(dot);
      /* The corner nearest the dot, and the hand carried straight across
         the inside of it from one leg to the other. */
      const L = track.line;
      let corner = null, ci = -1;
      for(let i = 1; i < L.length - 1; i++){
        const a = L[i-1], b = L[i], cc = L[i+1];
        const turn = Math.abs((b.x - a.x) * (cc.y - b.y) - (b.y - a.y) * (cc.x - b.x));
        if(turn > 1 && Math.hypot(b.x - a.x, b.y - a.y) > 30 && Math.hypot(cc.x - b.x, cc.y - b.y) > 30){ corner = b; ci = i; break; }
      }
      r.corner = !!corner;
      if(corner){
        const a = L[ci-1], cc = L[ci+1];
        const la = Math.hypot(corner.x - a.x, corner.y - a.y), lc = Math.hypot(cc.x - corner.x, cc.y - corner.y);
        const p0 = {x: corner.x + (a.x - corner.x) / la * 28, y: corner.y + (a.y - corner.y) / la * 28};
        const p1 = {x: corner.x + (cc.x - corner.x) / lc * 28, y: corner.y + (cc.y - corner.y) / lc * 28};
        const hit = document.querySelector(`.node[data-id="${dotId}"] .split-hit`);
        const s0 = toClient({x: dot.x + dot.w/2, y: dot.y + dot.h/2});
        hit.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX: s0.x, clientY: s0.y}));
        const along = ()=>{ const n = nodes.get(dotId); return nearestOnTrack(track, n.x + n.w/2, n.y + n.h/2).s; };
        /* To the first leg, near the corner… */
        const steps = 30, seen = [];
        let last = {x: dot.x + dot.w/2, y: dot.y + dot.h/2};
        const go = async p=>{
          const q = toClient(p);
          window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX: q.x, clientY: q.y}));
          await wait(4);
        };
        for(let k = 1; k <= steps; k++){
          await go({x: last.x + (p0.x - last.x) * k / steps, y: last.y + (p0.y - last.y) * k / steps});
        }
        /* Past the swell's own 90 ms: a carry may draw the dot afresh,
           and its swell then starts over (a CI run read it half grown). */
        await wait(150);
        const dg = document.querySelector(`.node[data-id="${dotId}"] > circle:not(.split-hit):not(.node-hover-pad)`);
        r.splitSwells = /matrix\(1\.[5-6]/.test(getComputedStyle(dg).transform);
        /* …then across the inside of the corner, small steps, to the other. */
        const inside = {x: (p0.x + p1.x) / 2 + (p0.x + p1.x - 2 * corner.x) * 0.3, y: (p0.y + p1.y) / 2 + (p0.y + p1.y - 2 * corner.y) * 0.3};
        let prev = along();
        r.maxStep = 0;
        for(const [from, to] of [[p0, inside], [inside, p1]]){
          for(let k = 1; k <= 12; k++){
            await go({x: from.x + (to.x - from.x) * k / 12, y: from.y + (to.y - from.y) * k / 12});
            const now = along();
            r.maxStep = Math.max(r.maxStep, Math.abs(now - prev));
            seen.push(Math.round(now));
            prev = now;
          }
        }
        r.handStep = Math.max(Math.hypot(inside.x - p0.x, inside.y - p0.y), Math.hypot(p1.x - inside.x, p1.y - inside.y)) / 12;
        r.seen = seen.join(',');
        window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        await wait(200);
        r.splitShrinks = getComputedStyle(document.querySelector(`.node[data-id="${dotId}"] > circle:not(.split-hit):not(.node-hover-pad)`)).transform === 'none';
      }
    }
    return r;
  }, [X, Y]);
  check('a reading stands clear of a capital under it, and lower over small letters, as measured (15.11)',
        out.rise > 11.5 * 0.72 + 1.5 + 7.5 * 0.21 - 0.3 && out.riseSmall < out.rise - 1, JSON.stringify([out.rise, out.riseSmall]));
  check('…and one emptied in the editor goes, slot and all, leaving its word',
        out.rubies === 1 && /Optimus/.test(out.text) && !/оптимус/.test(out.text), JSON.stringify([out.rubies, out.text]));
  check('underline and strike-through across three lines, taken off again, leave the lines where they stood and the markup as it was',
        out.edits.every(e=> e.lines === out.lines0 && e.html === out.html0), JSON.stringify({was: [out.lines0, out.html0], edits: out.edits}));
  check('a reader has the Media tab, in its place down the edge, with nothing to add, unfold or take out',
        out.readerTab && out.readerBare && out.readerStacked, JSON.stringify([out.readerTab, out.readerBare, out.readerStacked]));
  check('…and the author adds a kind with the tab’s own frame and a plus', out.addGlyph);
  check('a picked merge is lit only as far as a lineage ending in a T goes, and the T is lit with it',
        out.focusStops && !out.focusPastLine && out.teeLit && out.teeUnlit,
        JSON.stringify([out.focusStops, out.focusPastLine, out.teeLit, out.teeUnlit]));
  check('a merge\'s junction swells while it is carried, not when its arrow is picked, and lets go when put down', out.beadStill && out.beadSwells && out.beadBack,
        JSON.stringify([out.beadStill, out.beadSwells, out.beadBack]));
  check('a card’s picture has no corners of its own to resize it by', out.noPictureCorners);
  check('a split swells while it is carried, and not after', out.splitSwells && out.splitShrinks, JSON.stringify([out.splitSwells, out.splitShrinks]));
  check('a split carried across the inside of a corner goes round it after the hand, never jumping a stretch of the line',
        out.corner && out.maxStep <= out.handStep + 1.5, JSON.stringify({corner: out.corner, max: out.maxStep, hand: out.handStep, seen: out.seen}));
  } finally {
    await page.evaluate(()=>{
      const k = window.__k1511;
      setBarFocus(null); closeEdgePopover(); closeNodeEditor(false); setReaderPreview(false);
      workingNodes = k.nodes; refill(EDGE_STYLES, k.styles);
      Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]); Object.assign(SETTINGS, k.settings);
      vs = 1; applyTransform(); rebuildChart(); buildSideTabs();
    });
  }
  });
  await scenario("the owner's list of 19.11: a note written as it is read, with lists and dividers; a reader's tags and squares; templates kept while worn; My files; a legend's own marks, level with their words", async () => {
  const X = 197000, Y = 197000;
  await page.evaluate(()=>{ window.__k1911 = {nodes: workingNodes.map(x=> x.slice()), stickers: STICKERS.map(x=> Object.assign({}, x)),
    cats: JSON.parse(JSON.stringify(TAG_CATS)), settings: JSON.parse(JSON.stringify(SETTINGS))}; return true; });
  try{
  await page.evaluate(([X, Y])=>{
    vs = 1; vx = -X + 300; vy = -Y + 200; applyTransform();
    applyEdit(()=>{
      workingNodes.push(['q19_n', 'Noted', null, null, null, null, {pos:[X, Y], tags:['q19filed', 'q19loose']}]);
      workingNodes.push(['q19_c', 'Card', null, null, '{{ul}}apple\n{{ol}}one\n{{ol}}two\n{{hr:dashed|Mid}}\nend', null, {pos:[X + 260, Y], card:true}]);
    });
    TAG_CATS.push({name:'Q19 cat', tags:['q19filed']});
    assignTagCategory('q19loose', '');
    rebuildChart(); buildSideTabs();
    selectNode('q19_n');
    return true;
  }, [X, Y]);
  await page.waitForTimeout(300);
  /* 1. The note: the pencil opens it as it reads, Enter is a new line,
     the list buttons make lists, three dashes and Enter a divider. */
  await page.click('#detailNoteEdit');
  await page.waitForTimeout(200);
  await page.keyboard.type('Top line');
  await page.keyboard.press('Enter');
  await page.click('#detailNoteToolbar [data-wrap="ul"]');
  await page.keyboard.type('apple'); await page.keyboard.press('Enter');
  await page.keyboard.type('pear'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('---'); await page.keyboard.press('Enter');
  await page.click('#detailNoteToolbar [data-wrap="ol"]');
  await page.keyboard.type('one'); await page.keyboard.press('Enter');
  await page.keyboard.type('two'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('end');
  await page.waitForTimeout(650);
  const n1 = await page.evaluate(()=>{
    const blk = document.getElementById('detailNoteBlock');
    const surf = richFields.get('detailNoteInput').surface;
    return {note: (nodes.get('q19_n') || {}).note, noButtons: !document.getElementById('detailNoteApply') && !document.getElementById('detailNoteCancel'),
            noRule: getComputedStyle(blk).borderBottomStyle === 'none' || parseFloat(getComputedStyle(blk).borderBottomWidth) === 0,
            open: surf.isContentEditable, flat: getComputedStyle(surf).backgroundColor, toolbar: document.getElementById('detailNoteToolbar').style.display !== 'none'};
  });
  /* The divider, pressed: its kind of line; pressed twice, its title,
     typed over it at the left. */
  await page.click('#detailNoteBlock .note-rule');
  await page.click('.rule-panel [data-line="dotted"]');
  await page.dblclick('#detailNoteBlock .note-rule');
  await page.keyboard.type('Fruit');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(650);
  const n2 = await page.evaluate(()=> (nodes.get('q19_n') || {}).note);
  /* …and it runs almost to the edges of the drawer, its title over it at
     the left. */
  const n2look = await page.evaluate(()=>{
    const rule = document.querySelector('#detailNoteBlock .note-rule'), d = document.getElementById('detail').getBoundingClientRect();
    const rb = rule.getBoundingClientRect(), tb = rule.querySelector('.note-rule-title').getBoundingClientRect();
    const line = parseFloat(getComputedStyle(rule, '::after').borderTopWidth);
    const words = rule.parentElement.getBoundingClientRect().left + rule.parentElement.clientLeft + parseFloat(getComputedStyle(rule.parentElement).paddingLeft);
    return {left: +(rb.left - words).toFixed(1), titleStart: +(tb.left - rb.left).toFixed(1), right: d.right - rb.right, titleAbove: tb.bottom <= rb.bottom - line + 0.5,
            titleLeft: tb.left - rb.left < 14 && tb.width < rb.width / 2, noPanelInput: !document.querySelector('.rule-panel input')};
  });
  /* Backspace at the start of the line after it makes it the three dashes
     again; Enter makes it a divider once more; pressed and Delete, gone. */
  await page.evaluate(()=>{
    const surf = richFields.get('detailNoteInput').surface;
    const after = surf.querySelector('.note-rule').nextElementSibling;
    const li = after.querySelector('li') || after;
    placeCaret(li, false);
  });
  await page.keyboard.press('Backspace');
  const n3 = await page.evaluate(()=> detailNoteInput.value);
  await page.evaluate(()=>{
    const surf = richFields.get('detailNoteInput').surface;
    const back = [...surf.children].find(c=> c.textContent === '---');
    placeCaret(back, true);
  });
  await page.keyboard.press('Enter');
  const n4 = await page.evaluate(()=> detailNoteInput.value);
  await page.click('#detailNoteBlock .note-rule');
  await page.keyboard.press('Delete');
  const n5 = await page.evaluate(()=> detailNoteInput.value);
  await page.click('#detailNoteEdit');
  await page.waitForTimeout(300);
  const out = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    const r = {};
    const surf = richFields.get('detailNoteInput').surface;
    r.locked = !surf.isContentEditable && !!surf.querySelector('ul > li') && !!surf.querySelector('ol > li');
    r.lockedNote = nodes.get('q19_n').note;
    /* The same note round the editor and back is the same note. */
    const m = '{{ul}}a **b**\n{{ul}}c\nplain\n{{hr:wavy|T\\}it\\{le}}\n{{ol}}x\n{{ol}}y';
    setRichValue(detailNoteInput, m);
    r.round = richHtmlToMarkup(surf) === m;
    r.ruleTitle = (surf.querySelector('.note-rule') || {}).dataset.title;
    showDetailNote(nodes.get('q19_n').note);
    /* Everything else that reads a note reads words: bullets, numbers in
       order, a rule of the divider's line. */
    r.strip = stripMarkup('{{ul}}apple\n{{ol}}one\n{{ol}}two\nx\n{{ol}}again\n{{hr:dashed|Mid}}');
    r.card = [...document.querySelectorAll('.node[data-id="q19_c"] text')].map(t=> t.textContent).join('|');
    openNoteOverlay('q19_c');
    { const b = document.getElementById('noteOverlayBody');
      r.overlay = {ul: !!b.querySelector('ul li'), ol: b.querySelectorAll('ol li').length, rule: !!b.querySelector('.note-rule[data-line="dashed"]')};
      noteOverlay.classList.remove('open'); }

    /* 2. A reader is not shown a tag waiting to be filed, anywhere; the
       squares are there, and nothing about them can be pressed. */
    setReaderPreview(true); await wait(250);
    selectNode('q19_n'); await wait(150);
    setSideTab(document.getElementById('tagsPanel'), true); await wait(250);
    buildSideTabs();
    const rows = [...document.querySelectorAll('#tagsList .legend-item')].map(x=> x.dataset.tag);
    r.readerLoose = rows.includes('q19loose');
    r.readerFiled = rows.includes('q19filed');
    r.readerChips = document.getElementById('detailTags').textContent;
    const sq = document.querySelector('#tagsList .legend-item[data-tag="q19filed"] .swatch');
    r.readerSquareSeen = sq ? [sq.className, getComputedStyle(sq).visibility, getComputedStyle(sq).cursor] : null;
    r.readerSquare = !!sq && !sq.classList.contains('swatch-none') && !sq.classList.contains('swatch-pick') &&
      getComputedStyle(sq).visibility !== 'hidden' && getComputedStyle(sq).cursor !== 'pointer';
    searchInput.value = 'Noted'; searchInput.dispatchEvent(new Event('input', {bubbles:true})); await wait(80);
    const hit = [...document.querySelectorAll('#searchResults .row')].find(x=> /Noted/.test(x.textContent));
    r.readerSearch = hit ? hit.querySelector('.cl').textContent : null;
    searchInput.value = ''; searchInput.dispatchEvent(new Event('input', {bubbles:true}));
    r.spoken = spokenNameOf(nodes.get('q19_n'));
    setSideTab(document.getElementById('tagsPanel'), false);
    setReaderPreview(false); await wait(250);
    buildSideTabs();
    r.authorLoose = [...document.querySelectorAll('#tagsList .legend-item')].some(x=> x.dataset.tag === 'q19loose');

    /* 3. A template an entry wears is in the menu, whether or not the chart
       kept it, and cannot be taken out while it is worn. */
    const tri = {name:'Q19 tri', d:'M0 100L50 0L100 100Z'};
    const box = {name:'Q19 box', d:'M0 0L100 0L100 100L0 100Z'};
    SETTINGS.figures = [box];
    applyEdit(()=> workingNodes.push(['q19_f', 'Tri', null, null, null, null, {pos:[X0(), Y0()], figure: tri}]));
    function X0(){ return 197000; } function Y0(){ return 197400; }
    buildFigureMenu();
    const tpl = name=> [...document.querySelectorAll('#addFabFigures .figure-template')].find(b=> b.title === name);
    const capOf = name=> tpl(name) && tpl(name).querySelector('.node-style-cap');
    r.oneLine = !!capOf('Q19 box') && getComputedStyle(capOf('Q19 box')).textOverflow === 'ellipsis' && getComputedStyle(capOf('Q19 box')).whiteSpace === 'nowrap';
    r.worn = !!tpl('Q19 tri') && tpl('Q19 tri').querySelector('.figure-template-drop').classList.contains('worn');
    tpl('Q19 tri').querySelector('.figure-template-drop').click();
    buildFigureMenu();
    r.wornStays = !!tpl('Q19 tri');
    tpl('Q19 box').querySelector('.figure-template-drop').click();
    r.unwornGoes = !tpl('Q19 box') && !(SETTINGS.figures || []).some(t=> t.name === 'Q19 box');

    /* 4. My files: the stickers and the pictures, under one button. */
    refill(STICKERS, [{key:'q19st', name:'q', src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}]);
    rebuildStickerMap();
    const pic = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    applyEdit(()=> workingNodes.push(['q19_p', 'Pictured', null, null, null, null, {pos:[X0() + 300, Y0()], image: pic}]));
    r.noStickerButton = !document.getElementById('stickersToggle') && !!document.getElementById('filesToggle');
    document.getElementById('filesToggle').click(); await wait(150);
    r.filesOpen = document.getElementById('stickerOverlay').classList.contains('open');
    r.filesSticker = document.querySelectorAll('#stickerGrid .sticker-cell').length === 1;
    const cell = [...document.querySelectorAll('#filesGrid .file-cell')].find(c=> c.querySelector('img') && c.querySelector('img').getAttribute('src') === pic);
    r.filesPicture = !!cell;
    if(cell){ cell.click(); await wait(150); }
    r.filesGoes = selectedId === 'q19_p';
    r.faceKept = !!document.querySelector('#detailNoteToolbar .tb-sticker-btn svg');
    /* The owner's note on My files: images are called that, video has a
       section of its own, and each kind folds away under its heading. */
    MEDIA.push({key:'q19vid', name:'Clip', kind:'video', src:'data:video/mp4;base64,AAAA'});
    document.getElementById('filesToggle').click(); await wait(100);
    document.getElementById('filesToggle').click(); await wait(150);
    r.heads = [...document.querySelectorAll('#stickerOverlay .files-head > span:first-child')].map(e=> e.textContent).join('|');
    r.videoOwn = !!document.querySelector('#videoGrid .file-cell video') && !document.querySelector('#filesGrid .file-cell video');
    const imgSec = document.querySelector('#stickerOverlay .files-section[data-kind="image"]');
    imgSec.querySelector('.files-head').click(); await wait(50);
    r.folds = imgSec.classList.contains('collapsed') && getComputedStyle(imgSec.querySelector('.files-fold')).display === 'none';
    document.getElementById('stickerClose').click();
    document.getElementById('filesToggle').click(); await wait(150);
    r.foldStays = imgSec.classList.contains('collapsed');
    imgSec.querySelector('.files-head').click(); await wait(50);
    r.unfolds = !imgSec.classList.contains('collapsed');
    const plusBefore = document.querySelector('#stickerOverlay .files-section[data-kind="stickers"]').classList.contains('collapsed');
    r.plusNoFold = plusBefore === false;
    /* 20.11: the + is the window's, beside its ✕, on no kind's heading. */
    const plus = document.getElementById('stickerUpload');
    r.plusByClose = plus.parentElement.classList.contains('edge-popover-head') &&
                    plus.nextElementSibling === document.getElementById('stickerClose') &&
                    !plus.closest('.files-head');
    MEDIA.splice(MEDIA.findIndex(m=> m.key === 'q19vid'), 1);
    document.getElementById('stickerClose').click();

    /* 5. The legend: a row's mark may be a picture of the author's own,
       and stands level with the middle of its words. */
    setSideTab(document.getElementById('keyPanel'), true); await wait(100);
    setKeyIcon('shape:entry', STICKERS[0].src); await wait(100);
    buildKeyTab();
    const row = document.querySelector('#keyList .key-item[data-key="shape:entry"]');
    r.icon = !!(row && row.querySelector('.key-sample-btn img.key-icon'));
    const mid = e=>{ const b = e.getBoundingClientRect(); return b.top + b.height / 2; };
    r.level = [...document.querySelectorAll('#keyList .key-item')].map(it=>{
      const s = it.querySelector('.key-sample'), w = it.querySelector('.key-words');
      return s && w ? Math.abs(mid(s) - mid(w)) : 0;
    });
    r.iconKept = !!(cleanLegendRows(SETTINGS).legendIcons || {})['shape:entry'];
    setReaderPreview(true); await wait(200);
    buildKeyTab();
    const rrow = document.querySelector('#keyList .key-item[data-key="shape:entry"]');
    r.readerIcon = !rrow || (!!rrow.querySelector('img.key-icon') && !rrow.querySelector('.key-sample-btn'));
    setReaderPreview(false); await wait(200);
    setKeyIcon('shape:entry', null);
    r.iconOff = !SETTINGS.legendIcons;
    setSideTab(document.getElementById('keyPanel'), false);
    return r;
  });
  check('the note opens where it stands, flat, with its buttons under "Note", no Apply or Cancel, and no rule under the block (19.11)',
        n1.noButtons && n1.noRule && n1.open && n1.toolbar && /rgba\(0, 0, 0, 0\)|transparent/.test(n1.flat), JSON.stringify(n1));
  check('…Enter is a new line, the buttons make a bulleted and a numbered list, and three dashes and Enter a divider — written as it settles',
        n1.note === 'Top line\n{{ul}}apple\n{{ul}}pear\n{{hr:solid}}\n{{ol}}one\n{{ol}}two\nend', JSON.stringify(n1.note));
  check('…a divider starts with the words and its title, and runs to a few pixels from the drawer’s right side, its title over it (19.11, the owner’s notes)',
        Math.abs(n2look.left) < 0.6 && Math.abs(n2look.titleStart) < 0.6 && n2look.right > 1 && n2look.right <= 8 && n2look.titleAbove && n2look.titleLeft && n2look.noPanelInput,
        JSON.stringify(n2look));
  check('…a divider pressed takes its kind of line, and pressed twice a title', n2 === 'Top line\n{{ul}}apple\n{{ul}}pear\n{{hr:dotted|Fruit}}\n{{ol}}one\n{{ol}}two\nend', JSON.stringify(n2));
  check('…Backspace after a divider makes it the three dashes again, and Enter a divider once more', /\n---\n/.test(n3) && /\{\{hr:solid\}\}/.test(n4) && !/---/.test(n4),
        JSON.stringify([n3, n4]));
  check('…a divider pressed and Delete is gone', !/\{\{hr/.test(n5) && /pear\n\{\{ol\}\}one|pear\n\n?\{\{ol\}\}one/.test(n5), JSON.stringify(n5));
  check('…shut, the note shows its lists, and a note goes round the editor unchanged — a divider’s title with braces in it too',
        out.locked && out.round && out.ruleTitle === 'T}it{le', JSON.stringify([out.locked, out.round, out.ruleTitle]));
  check('everything else that reads a note reads its lists as bullets and numbers, and a divider as a rule of its line',
        out.strip === '• apple\n1. one\n2. two\nx\n1. again\n╌╌ Mid ╌╌' && /•\s*apple/.test(out.card) && /1\.\s*one/.test(out.card) && /2\.\s*two/.test(out.card),
        JSON.stringify([out.strip, out.card]));
  check('…and the note read full size draws them as the drawer does', out.overlay.ul && out.overlay.ol === 2 && out.overlay.rule, JSON.stringify(out.overlay));
  check('a reader is not shown a tag waiting to be filed — not in the Tags tab, on the entry, in a search or in its spoken name — and its author is',
        !out.readerLoose && out.readerFiled && !/q19loose/.test(out.readerChips) && /q19filed/.test(out.readerChips) &&
        out.readerSearch !== null && !/q19loose/.test(out.readerSearch) && !/q19loose/.test(out.spoken) && out.authorLoose,
        JSON.stringify([out.readerLoose, out.readerFiled, out.readerChips, out.readerSearch, out.spoken, out.authorLoose]));
  check('…a reader sees a tag’s colour square, and nothing about it can be pressed', out.readerSquare, JSON.stringify(out.readerSquareSeen));
  check('a template an entry wears is in the add menu even when the chart did not keep it, and cannot be taken out while worn; one nobody wears can; a long name is cut with an ellipsis',
        out.worn && out.oneLine && out.wornStays && out.unwornGoes, JSON.stringify([out.worn, out.oneLine, out.wornStays, out.unwornGoes]));
  check('My files replaces the Stickers button: the stickers, and every picture in the chart, which takes you to its entry',
        out.noStickerButton && out.filesOpen && out.filesSticker && out.filesPicture && out.filesGoes && out.faceKept,
        JSON.stringify([out.noStickerButton, out.filesOpen, out.filesSticker, out.filesPicture, out.filesGoes, out.faceKept]));
  /* The owner's list of 19.11, evening: an array's hatching does not show
     through the border of an entry in it — a border in a colour the paper
     shows through, dotted, with a link tab — and a faded entry gives it
     back. */
  const hatchHoles = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(ok=> setTimeout(ok, ms));
    applyEdit(()=>{
      workingNodes.push(['h19_a', 'Through', null, null, null, null, {pos:[188000, 188000], colors:['#22cc'], border:'dotted', square:true, link:'https://example.com/', tags:['h19-tag']}]);
      workingNodes.push(['h19_b', 'Beside', null, null, null, null, {pos:[188200, 188000]}]);
    });
    setSelection(['h19_a', 'h19_b'], 'h19_a');
    const id = makeArrayOfSelection();
    applyEdit(()=>{ const e = workingNodes.find(x=> x[0] === id); e[6] = Object.assign({}, e[6], {hatch:'diag-r'}); });
    await wait(150);
    const hatch = document.querySelector(`.node[data-id="${id}"] .array-hatch`);
    const mask = hatch && hatch.getAttribute('mask') && document.querySelector(hatch.getAttribute('mask').replace(/^url\((.*)\)$/, '$1'));
    const holes = mask ? [...mask.querySelectorAll('.hatch-hole[data-hole="h19_a"]')] : [];
    const a = nodes.get('h19_a');
    const box = holes.find(h=> h.tagName === 'rect' && +h.getAttribute('x') <= a.x - 1 && +h.getAttribute('x') + +h.getAttribute('width') >= a.x + a.w + 1);
    const tab = holes.find(h=> +h.getAttribute('y') + +h.getAttribute('height') <= a.y + 0.5);
    hiddenTags.add('h19-tag'); applyVisibility(); await wait(50);
    const gives = holes.length > 0 && holes.every(h=> h.isConnected && h.style.display === 'none');
    hiddenTags.delete('h19-tag'); applyVisibility();
    return {box: !!box, tab: !!tab, gives, n: holes.length};
  });
  check('an array\'s hatching stops under the border and tabs of an entry in it, and comes back under one faded (19.11, evening)',
        hatchHoles.box && hatchHoles.tab && hatchHoles.gives, JSON.stringify(hatchHoles));
  check('…My files names images Images, keeps video in a section of its own, and folds each kind away under its heading (19.11, the owner\'s note), with its + beside the ✕ (20.11)',
        out.heads === 'Stickers|Images|Video|Fonts' && out.videoOwn && out.folds && out.foldStays && out.unfolds && out.plusNoFold && out.plusByClose,
        JSON.stringify([out.heads, out.videoOwn, out.folds, out.foldStays, out.unfolds, out.plusByClose]));
  check('a legend row’s mark can be a picture of the author’s own, kept with the chart, shown to a reader as a picture, and taken off again',
        out.icon && out.iconKept && out.readerIcon && out.iconOff, JSON.stringify([out.icon, out.iconKept, out.readerIcon, out.iconOff]));
  check('…and every mark stands level with the middle of its words', out.level.length > 0 && out.level.every(d=> d <= 1.5), JSON.stringify(out.level));
  } finally {
    await page.evaluate(()=>{
      const k = window.__k1911;
      if(typeof closeRulePanel === 'function') closeRulePanel();
      setReaderPreview(false);
      document.getElementById('stickerOverlay').classList.remove('open');
      if(typeof openFigureMenu === 'function') openFigureMenu(false);
      if(detailNoteEditing) setDetailNoteEditing(false);
      workingNodes = k.nodes; refill(STICKERS, k.stickers); rebuildStickerMap();
      refill(TAG_CATS, k.cats);
      Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]); Object.assign(SETTINGS, k.settings);
      selectedId = null;
      vs = 1; applyTransform(); rebuildChart(); buildSideTabs();
    });
  }
  });
