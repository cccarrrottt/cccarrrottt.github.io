/* tests/scenarios/04-later-rounds.js — scenarios 77 to 103 of the suite.
 *
 * The rounds after the site: guides, remarks, merges that cannot kink,
 * pictures, phones, tabs, patches seen from far away, scenery, a page told
 * late that it is read-only, and hand bends kept to a guide.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */

  /* ---- 33. guides, grounds, a swap and a dark page ---- */
  await scenario("guides, grounds, a swap and a dark page", async () => {
  const rG = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const fire = (t, x, y, o, target)=> (target || window).dispatchEvent(new MouseEvent(t,
      Object.assign({bubbles:true, cancelable:true, clientX:x, clientY:y, button:0}, o||{})));
    const centreOf = (elm)=>{ const r = elm.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; };
    const nodeEl = (id)=> document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 300);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- a route out of a half-unit port has no slant in it ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['lgT','Beast Wars: Uprising',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['lgS','Beast Wars: Uprising','lgT',null,null,null,{pos:[X - 300, Y - 120]}]);
      EDGE_STYLES.push({from:'lgT', to:'lgS', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top'});
    });
    await wait(400);
    {
      const pts = drawnRoutes.get(calloutEdgeKey('lgT','lgS')).pts;
      out.noSlant = pts.every((q, i)=> i === 0 ||
        Math.abs(q.x - pts[i-1].x) < 0.05 || Math.abs(q.y - pts[i-1].y) < 0.05);
      out.slantPts = pts.map(q=> q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
      out.levelled = levelSlivers([{x:0,y:0},{x:10,y:0},{x:200,y:0.5},{x:200,y:80}])
        .every((q, i, a)=> i === 0 || Math.abs(q.x - a[i-1].x) < 0.01 || Math.abs(q.y - a[i-1].y) < 0.01);
    }

    /* ---- a bend that the route no longer needs goes with the drop ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['pbA','A',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['pbB','B','pbA',null,null,null,{pos:[X + 300, Y]}]);
      EDGE_STYLES.push({from:'pbA', to:'pbB', routing:'orthogonal', dash:'solid', arrow:true});
    });
    await wait(300);
    {
      const pts = drawnRoutes.get(calloutEdgeKey('pbA','pbB')).pts;
      const midX = (pts[0].x + pts[pts.length-1].x) / 2;
      applyEdit(()=> setBendList('pbA','pbB', [[midX, pts[0].y]]));
      await wait(250);
      const c = centreOf(nodeEl('pbB'));
      fire('mousedown', c.x, c.y, {}, nodeEl('pbB'));
      for(let k = 1; k <= 4; k++){ fire('mousemove', c.x + k*8, c.y); await wait(30); }
      fire('mouseup', c.x + 32, c.y); await wait(300);
      out.pruned = bendListOf('pbA','pbB').length === 0;
    }

    /* ---- centring one entry on another is on offer with Shift ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['gdA','A tall one\nwith two lines',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['gdB','Short',null,null,null,null,{pos:[X + 300, Y + 60]}]);
    });
    await wait(400);
    {
      const a = nodes.get('gdA'), b = nodes.get('gdB');
      const want = (a.y + a.h/2) - (b.y + b.h/2);         // world units to move b by
      const c = centreOf(nodeEl('gdB'));
      fire('mousedown', c.x, c.y, {}, nodeEl('gdB'));
      fire('mousemove', c.x + 4, c.y, {shiftKey:true}); await wait(40);
      fire('mousemove', c.x + 4, c.y + want*vs + 2*vs, {shiftKey:true}); await wait(60);
      const nb = nodes.get('gdB');
      out.midReached = Math.abs((nb.y + nb.h/2) - (a.y + a.h/2)) < 0.01;
      out.midAt = JSON.stringify({a: a.y + a.h/2, b: nb.y + nb.h/2});
      fire('mouseup', c.x + 4, c.y + want*vs); await wait(250);
    }

    /* ---- a parent keeps to its stretch of the bar; two can swap ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['sw1','P1',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['sw2','P2',null,null,null,null,{pos:[X + 200, Y]}]);
      workingNodes.push(['sw3','P3',null,null,null,null,{pos:[X + 400, Y]}]);
      workingNodes.push(['swM','Merge',['sw1','sw2','sw3'],null,null,null,{merge:true, pos:[X + 200, Y + 200]}]);
    });
    await wait(600);
    {
      const bar = amalgamBars.get('swM');
      out.barKnowsLandings = !!bar && Array.isArray(bar.landings) && bar.landings.length === 3;
      const c = centreOf(nodeEl('sw2'));
      fire('mousedown', c.x, c.y, {}, nodeEl('sw2'));
      for(let k = 1; k <= 8; k++){ fire('mousemove', c.x + k*40*vs, c.y); await wait(30); }
      const port = bar.landings.find(l=> l.from === 'sw2');
      const p3 = bar.landings.find(l=> l.from === 'sw3').at;
      const n2 = nodes.get('sw2');
      const portNow = n2.x + n2.w/2 + (port.port - (X + 200 + n2.w/2));
      out.heldShort = portNow <= p3 - AMALGAM_PITCH + 0.5;
      out.leashAt = JSON.stringify({portNow, p3});
      fire('mousemove', c.x + 20*vs, c.y, {shiftKey:true}); await wait(60);
      out.barPlacesShown = document.querySelectorAll('#guideLayer .bar-place').length >= 1 &&
        !!document.querySelector('#guideLayer .bar-place-mid');
      fire('mouseup', c.x, c.y); await wait(250);
      undoLastEdit(); await wait(250);
      out.places = barPlacesFor(amalgamBars.get('swM'), 'sw2', false).map(p=> p.kind).join(',');
      // More lineages, more places: the amalgam itself is offered each one.
      out.morePlaces = barPlacesFor(amalgamBars.get('swM'), null, true).length >=
                       barPlacesFor(amalgamBars.get('swM'), 'sw2', false).length;
      /* Three lineages: three even slots, the middle one of them the
         middle of the bar, and no extra place for the middle. Four: four
         slots and the middle between them. */
      {
        const fake = (xs)=> ({landings: xs.map((at, i)=> ({from: 'f' + i, at, port: at}))});
        const three = barPlacesFor(fake([0, 30, 200]), null, false);
        const four = barPlacesFor(fake([0, 10, 20, 300]), null, false);
        out.evenSlots = three.length === 3 && three[1].kind === 'mid' && three[1].at === 100 &&
          four.length === 5 && four.map(p=> p.at).join() === '0,100,150,200,300';
      }

      setSelection(['sw1','sw3'], 'sw1');
      await wait(80);
      const btn = document.querySelector('.swap-parents-btn');
      out.swapOffered = !!btn && !btn.hidden;
      const x1 = nodes.get('sw1').x, x3 = nodes.get('sw3').x;
      btn.click(); await wait(300);
      out.swapped = Math.abs(nodes.get('sw1').x - x3) < 0.01 && Math.abs(nodes.get('sw3').x - x1) < 0.01;
      setSelection(['sw1','swM'], 'sw1');
      await wait(80);
      out.swapOnlyForParents = btn.hidden;
      deselect();
    }

    /* ---- a note on the middle keeps to the middle ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['nmA','A',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['nmB','B','nmA',null,null,null,{pos:[X + 300, Y]}]);
      EDGE_STYLES.push({from:'nmA', to:'nmB', routing:'orthogonal', dash:'solid', arrow:true, note:'mid', noteAt:0.5});
    });
    await wait(300);
    {
      const plateX = ()=>{ const g = document.querySelector('#arrowLayer .edge-note[data-from="nmA"] .edge-note-plate');
        const b = g.getBBox(); const tr = (g.parentNode.getAttribute('transform') || '').match(/-?[\d.]+/g) || [0,0];
        return b.x + b.width/2 + +tr[0]; };
      const c = centreOf(nodeEl('nmB'));
      fire('mousedown', c.x, c.y, {}, nodeEl('nmB'));
      for(let k = 1; k <= 5; k++){ fire('mousemove', c.x + k*20*vs, c.y); await wait(40); }
      fire('mouseup', c.x + 100*vs, c.y); await wait(300);
      const pts = drawnRoutes.get(calloutEdgeKey('nmA','nmB')).pts;
      out.noteOnMiddle = Math.abs(plateX() - pointAtFraction(pts, 0.5).x) < 1;
      const snaps = connectorSnaps(pts);
      out.snapsNoEnds = snaps.every(sn=> sn.f > 0 && sn.f < 1) && snaps.some(sn=> sn.kind === 'mid');
    }

    /* ---- a running performance is not sought again ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['anF','Fan',null,null,null,null,{pos:[X, Y], tags:['fan-fiction','unreleased']}]);
    });
    await wait(300);
    {
      hoverLivelyId = 'anF'; syncTagLiveliness();
      const g = document.querySelector('.fanfic-glint[data-id="anF"]');
      const d0 = g.style.animationDelay;
      await wait(120);
      syncTagLiveliness();
      out.notReseeked = g.style.animationDelay === d0;
      out.groundAnchored = !!g.parentNode && g.parentNode.classList.contains('ground-anchor') &&
        +g.getAttribute('x') < 0;
      hoverLivelyId = null; syncTagLiveliness();
    }

    /* ---- a picker press does not close the field it is filling ---- */
    {
      openNodeEditor('anF'); await wait(300);
      const pick = document.getElementById('refPicker');
      pick.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
      out.fieldSurvivesPicker = !!nodeEditorTarget;
      closeNodeEditor(false);
    }

    /* ---- the dark page ---- */
    {
      const was = themeIsDark();
      document.getElementById('themeToggle').click();
      const on = themeIsDark();
      const filt = getComputedStyle(document.getElementById('canvas')).filter;
      const bg = getComputedStyle(document.body).backgroundColor;
      document.getElementById('themeToggle').click();
      out.darkToggles = on !== was && themeIsDark() === was;
      out.darkInverts = /invert/.test(filt);
      out.darkPanels = /rgb\((\d+)/.test(bg) && +/rgb\((\d+)/.exec(bg)[1] < 80;
    }

    applyEdit(()=>{ workingNodes = beforeNodes; refill(EDGE_STYLES, beforeStyles); });
    await wait(400);
    return out;
  });
  check('a route out of a port on a half unit has no slant in it', rG.noSlant, rG.slantPts);
  check('and a run a fraction out of true is levelled, not stepped', rG.levelled);
  check('a bend the route no longer needs goes when an entry is dropped', rG.pruned);
  check('Shift offers to centre one entry on another', rG.midReached, rG.midAt);
  check('the bar knows where each lineage lands', rG.barKnowsLandings);
  check('a parent carried along its bar stops short of its neighbour',
        rG.heldShort, rG.leashAt);
  check('and Shift marks the places on the bar', rG.barPlacesShown && rG.morePlaces, rG.places);
  check('the places divide the bar evenly about its middle', rG.evenSlots);
  check('two parents selected together are offered a swap, and it swaps them',
        rG.swapOffered && rG.swapped,
        JSON.stringify({offered: rG.swapOffered, swapped: rG.swapped}));
  check('but a selection that is not two parents is not', rG.swapOnlyForParents);
  check('a note on the middle of its connector stays on the middle', rG.noteOnMiddle);
  check('the places along a connector never include its ends', rG.snapsNoEnds);
  check('a performance already running is not sent back', rG.notReseeked);
  check('a ground is drawn in its entry\'s own coordinates', rG.groundAnchored);
  check('pressing in a picker leaves the field it fills open', rG.fieldSurvivesPicker);
  check('the dark page toggles both ways, turns the drawing over, darkens the panels',
        rG.darkToggles && rG.darkInverts && rG.darkPanels,
        JSON.stringify({t: rG.darkToggles, i: rG.darkInverts, p: rG.darkPanels}));
  });

  /* ---- 34. remarks that ride their legs, heads that rest on ripples ---- */
  await scenario("remarks that ride their legs, heads that rest on ripples", async () => {
  const rR = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const fire = (t, x, y, o, target)=> (target || window).dispatchEvent(new MouseEvent(t,
      Object.assign({bubbles:true, cancelable:true, clientX:x, clientY:y, button:0}, o||{})));
    const centreOf = (elm)=>{ const r = elm.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; };
    const nodeEl = (id)=> document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 300);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- a note's place survives a save ---- */
    out.noteAtSaved = /noteAt:0\.25/.test(serializeEdgeStyles([{from:'a', to:'b', routing:'orthogonal',
      dash:'solid', arrow:true, note:'n', noteAt:0.25, noteSnap:'leg:1'}])) &&
      /noteSnap:'leg:1'/.test(serializeEdgeStyles([{from:'a', to:'b', routing:'orthogonal',
      dash:'solid', arrow:true, note:'n', noteAt:0.25, noteSnap:'leg:1'}]));

    /* ---- a remark on a leg moves with that leg ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['rlA','A',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['rlB','B','rlA',null,null,null,{pos:[X + 300, Y + 200]}]);
      EDGE_STYLES.push({from:'rlA', to:'rlB', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'right', toSide:'top',
                        note:'leg', noteAt:0.5});
    });
    await wait(300);
    {
      const pts = drawnRoutes.get(calloutEdgeKey('rlA','rlB')).pts;
      const {legs} = routeLegs(pts);
      // Put the note on the middle of the first leg, as Shift would.
      const f = fractionForSnap(pts, 'leg:0');
      applyEdit(()=> setEdgeStyleOverride('rlA','rlB',
        Object.assign({}, edgeStyleFor('rlA','rlB'), {noteAt: f, noteSnap: 'leg:0'})));
      await wait(200);
      const c = centreOf(nodeEl('rlB'));
      fire('mousedown', c.x, c.y, {}, nodeEl('rlB'));
      for(let k = 1; k <= 5; k++){ fire('mousemove', c.x + k*20*vs, c.y); await wait(40); }
      fire('mouseup', c.x + 100*vs, c.y); await wait(300);
      const now = drawnRoutes.get(calloutEdgeKey('rlA','rlB')).pts;
      const st = edgeStyleFor('rlA','rlB');
      out.legKept = st.noteSnap === 'leg:0' && Math.abs(st.noteAt - fractionForSnap(now, 'leg:0')) < 1e-3;
      out.legWas = JSON.stringify({legs: legs.length, at: st.noteAt, want: fractionForSnap(now, 'leg:0')});
      out.snapName = snapNameFor(now, {kind:'leg', f: fractionForSnap(now, 'leg:0')}) === 'leg:0';
      /* And an unsnapped place keeps its share of its leg. */
      const pl = legPlace(now, 0.3);
      const back = settleAnchor(now, 0.3, null, heldAnchor(now, 0.3), false);
      out.legShareStable = Math.abs(back - 0.3) < 1e-6 && pl.legs === routeLegs(now).legs.length;
    }

    /* ---- a callout on a stretch of bar shrinks with it ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['cb1','P1',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['cb2','P2',null,null,null,null,{pos:[X + 200, Y]}]);
      workingNodes.push(['cbM','Merge',['cb1','cb2'],null,null,null,{merge:true, pos:[X + 260, Y + 200]}]);
    });
    await wait(500);
    {
      const pts0 = drawnRoutes.get(calloutEdgeKey('cb1','cbM')).pts;
      const {legs, total} = routeLegs(pts0);
      const last = legs[legs.length - 1];
      const f = (last.start + last.len * 0.5) / total;
      applyEdit(()=> workingNodes.push(['cbK','note',null,null,null,'callout',
        {pos:[X + 100, Y + 140], leader:{from:'cb1', to:'cbM', at: +f.toFixed(4)}}]));
      await wait(400);
      const dot = ()=> +document.querySelector('.callout-leader[data-id="cbK"] .leader-dot').getAttribute('cx');
      const x0 = dot();
      const c = centreOf(nodeEl('cb2'));
      fire('mousedown', c.x, c.y, {}, nodeEl('cb2'));
      for(let k = 1; k <= 4; k++){ fire('mousemove', c.x - k*20*vs, c.y); await wait(40); }
      const pts1 = drawnRoutes.get(calloutEdgeKey('cb1','cbM')).pts;
      const L1 = routeLegs(pts1).legs;
      const a = L1[L1.length - 1];
      const startX = pts1[pts1.length - 1].x - (pts1[pts1.length - 1].x - pts1[0].x > 0 ? a.len : -a.len);
      const want = startX + (pts1[pts1.length - 1].x - startX) * 0.5;
      out.rodeTheStretch = Math.abs(dot() - want) < 1 && Math.abs(dot() - x0) > 5;
      out.rode = JSON.stringify({x0, now: dot(), want});
      /* …and an end parent may go outward: it is what the bar's length is. */
      fire('mousemove', c.x + 150*vs, c.y); await wait(60);
      out.endFree = nodes.get('cb2').x > X + 200 + 100;
      fire('mouseup', c.x, c.y); await wait(250);
    }

    /* ---- an arrowhead MEETS a rippled border ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['ahS','Source',null,null,null,null,{pos:[X, Y + 40]}]);
      workingNodes.push(['ahP','Pocket','ahS',null,null,null,
                         {border:'wavy', pos:[X, Y + 200], size:[160, 60]}]);
      refill(EDGE_STYLES, [{from:'ahS', to:'ahP', arrow:true,
                            fromSide:'bottom', toSide:'top'}]);
    });
    await wait(500);
    {
      /* The tip stands on the border at its OWN point — not clear of the
         crests either side of it, which left daylight under the tip — and
         what it puts across the ripple is taken back by the clip. */
      const n = nodes.get('ahP');
      const prof = borderProfileOf(n, 0);
      const head = document.querySelector('.edge-arrow[data-to="ahP"]');
      const tri = head ? head.querySelector('path') : null;
      const nums = ((tri && tri.getAttribute('d')) || '').match(/-?[\d.]+/g);
      let tipY = null, tipX = null;
      // The tip is the first point of the triangle: M is the tip itself.
      if(nums && nums.length >= 2){ tipX = +nums[0]; tipY = +nums[1]; }
      // Outward from a top side is upward, so the drop comes off n.y.
      const want = n.y - (prof ? prof.offsetAt('top', tipX, n.y) : 0);
      out.headOnRipple = tipY !== null && Math.abs(tipY - want) < 0.7;
      out.headRipplePos = JSON.stringify({tip:tipY, want:+want.toFixed(2)});
      // …and it goes under the entry, where the fill and the border take
      // back whatever it puts across the ripple.
      out.headRippleClipped = !!head && head.parentNode.id === 'edgeLayer';
    }

    /* ---- a wavy run is waved to its ends ---- */
    {
      // Nothing is held back from a bend or an end any more: the wave is
      // run along the finished line.
      const o = pocketOutline(0, 0, 160, 90);
      const ends = o && [o.drawn[0], o.drawn[o.drawn.length-1]];
      out.noBareEnds = !!o && Math.hypot(ends[0].x - ends[1].x, ends[0].y - ends[1].y) < 1e-9;
      const p = wavePts(wavyPath([{x:0,y:0},{x:61,y:0}]));
      // The wave starts at the very start: the first step already leaves
      // the baseline.
      out.waveFromStart = p.length > 2 && Math.abs(p[0].y) < 0.01 && Math.abs(p[1].y) > 0.05;
    }

    /* ---- a port stands where the spacing put it ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['lpT','Target',null,null,null,null,{pos:[X + 100, Y + 200]}]);
      workingNodes.push(['lpA','Target',null,null,null,null,{pos:[X + 140, Y]}]);
      workingNodes.push(['lpB','B',null,null,null,null,{pos:[X - 200, Y]}]);
      EDGE_STYLES.push({from:'lpA', to:'lpT', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top'});
      EDGE_STYLES.push({from:'lpB', to:'lpT', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top'});
    });
    await wait(50);
    applyEdit(()=>{ const f = (id)=> workingNodes.find(x=> x[0] === id); f('lpT')[2] = ['lpA','lpB']; });
    await wait(300);
    /* A's middle a few units off the second of T's two top ports. Both
       ports used to spend a little of their side on closing that offset,
       and the price was that the ENDS of a connector moved whenever
       either entry was carried. They do not move any more: the step is
       the route's to deal with, between the two ends. */
    {
      const t = nodes.get('lpT'), a = nodes.get('lpA');
      const want = t.x + t.w * 2/3 + 5 - a.w/2;
      applyEdit(()=>{ workingNodes.find(x=> x[0] === 'lpA')[6].pos = [+want.toFixed(2), Y]; });
      await wait(300);
    }
    {
      const t = nodes.get('lpT'), a = nodes.get('lpA');
      const pts = drawnRoutes.get(calloutEdgeKey('lpA','lpT')).pts;
      const first = pts[0], last = pts[pts.length-1];
      /* A's bottom side carries one connector, so its port is the middle
         of that side; T's top side carries two, so they stand at a third
         and two thirds of it. Every one of those is arithmetic on the
         entry's own box, and nothing else may touch it. */
      const seats = [t.x + t.w/3, t.x + t.w*2/3];
      /* The owner, 31.10, after a try at the opposite: a connector does
         not move along its port, full stop — not even to straighten a
         step shorter than two corners. */
      out.portsUnmoved = Math.abs(first.x - (a.x + a.w/2)) < 0.01 &&
                         seats.some(sx=> Math.abs(last.x - sx) < 0.01);
      out.lonePts = pts.map(q=> q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ') +
                    ' | seats ' + seats.map(v=> v.toFixed(1)).join(',');
    }

    /* ---- a bend returned to within a step of the old corner goes ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['brA','A',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['brB','B','brA',null,null,null,{pos:[X + 260, Y + 180]}]);
      EDGE_STYLES.push({from:'brA', to:'brB', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'right', toSide:'top'});
    });
    await wait(300);
    {
      const pts = tidyPoints(drawnRoutes.get(calloutEdgeKey('brA','brB')).pts);
      const corner = pts.find((q, i)=> i > 0 && i < pts.length - 1 &&
        Math.abs(q.x - pts[i-1].x) > 0.5 !== Math.abs(q.x - pts[i+1].x) > 0.5) || pts[1];
      applyEdit(()=> setBendList('brA','brB', [[corner.x + 7, corner.y - 6]]));
      await wait(250);
      pruneHandBends([{from:'brA', to:'brB'}]);
      out.returnedGoes = bendListOf('brA','brB').length === 0;
    }

    /* ---- no card on a click for a caption ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['tbx','A caption',null,null,null,'textbox',{pos:[X, Y]}]);
    });
    await wait(300);
    {
      const g = nodeEl('tbx');
      g.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      await wait(DOUBLE_CLICK_GRACE + 150);
      out.captionNoCard = !document.getElementById('freeMenu').classList.contains('open') && selectedId === 'tbx';
      deselect();
    }

    /* ---- the lights: set per ground, stronger on the dark page ---- */
    {
      const gl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      gl.setAttribute('class', 'fanfic-glint'); fanLayer.appendChild(gl);
      const light = parseFloat(getComputedStyle(gl).getPropertyValue('--glint-peak'));
      setTheme(true);
      const dark = parseFloat(getComputedStyle(gl).getPropertyValue('--glint-peak'));
      setTheme(false);
      gl.remove();
      out.glintStronger = dark > light;
    }

    applyEdit(()=>{ workingNodes = beforeNodes; refill(EDGE_STYLES, beforeStyles); });
    await wait(400);
    return out;
  });
  check('a note\'s place and the kind of place it is are saved', rR.noteAtSaved);
  check('a note on the middle of a leg stays on the middle of that leg', rR.legKept, rR.legWas);
  check('the leg is named the way it is stored', rR.snapName);
  check('an unsnapped remark keeps its share of its leg', rR.legShareStable);
  check('a callout on a stretch of bar rides it as it shrinks', rR.rodeTheStretch, rR.rode);
  check('a parent at the end of its bar may go outward', rR.endFree);
  check('an arrowhead meets a rippled border at its own point',
        rR.headOnRipple, rR.headRipplePos);
  check('and the entry is drawn over it, as it is over every other head',
        rR.headRippleClipped);
  check('a wavy line is waved to its ends and round its corners', rR.noBareEnds && rR.waveFromStart);
  check('a port stands where the spacing put it, whatever the route does',
        rR.portsUnmoved, rR.lonePts);
  check('a bend put back within a step of the corner it came from goes', rR.returnedGoes);
  check('a click on a caption picks it up without a card', rR.captionNoCard);
  check('the light on a ground is stronger on the dark page', rR.glintStronger);
  });

  /* ---- 35. a merge nothing can kink, a route that keeps its word ---- */
  await scenario("a merge nothing can kink, a route that keeps its word", async () => {
  const rK = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const fire = (t, x, y, o, target)=> (target || window).dispatchEvent(new MouseEvent(t,
      Object.assign({bubbles:true, cancelable:true, clientX:x, clientY:y, button:0}, o||{})));
    const centreOf = (elm)=>{ const r = elm.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; };
    const nodeEl = (id)=> document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
    const ptsOf = (f, t)=> (drawnRoutes.get(calloutEdgeKey(f, t)) || {}).pts || [];
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(430, 260);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- a merge: three lineages into one entry ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['kmP','P one',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['kmQ','P two',null,null,null,null,{pos:[X + 220, Y]}]);
      workingNodes.push(['kmR','P three',null,null,null,null,{pos:[X + 440, Y]}]);
      workingNodes.push(['kmM','Merge',['kmP','kmQ','kmR'],null,null,null,{merge:true, pos:[X + 220, Y + 300]}]);
    });
    await wait(500);

    /* Every lineage leaves by the MIDDLE of its side, and comes down onto
       the bar in one straight run. */
    {
      const mids = ['kmP','kmQ','kmR'].map(id=>{
        const n = nodes.get(id), pts = ptsOf(id, 'kmM');
        if(!n || !pts.length) return null;
        return {off: +(((pts[0].x - n.x) / n.w) - 0.5).toFixed(3),
                straight: Math.abs(pts[0].x - pts[1].x) < 0.6};
      });
      out.memberMiddles = JSON.stringify(mids);
      out.membersCentred = mids.every(m=> m && Math.abs(m.off) < 0.01 && m.straight);
    }

    /* A hand-set bend is no part of a merged lineage: the route ignores
       it, and the panel offers no handle to place another. */
    {
      const before = ptsOf('kmP','kmM').map(p=> [Math.round(p.x), Math.round(p.y)]);
      applyEdit(()=> setBendList('kmP','kmM', [[X - 120, Y + 160]]));
      redrawEdges(); await wait(250);
      const after = ptsOf('kmP','kmM').map(p=> [Math.round(p.x), Math.round(p.y)]);
      out.mergedIgnoresBends = JSON.stringify(before) === JSON.stringify(after);
      openEdgeStylePopover('kmP','kmM',{clientX:500, clientY:260});
      drawBendHandles(); await wait(200);
      // Its end at its parent's port is still offered, to be carried to another (the owner's list of 30.10).
      out.mergedOffersNoHandles = document.querySelectorAll('#bendLayer > :not(.bend-end)').length === 0;
      out.mergedStraightenOff = !!document.getElementById('styleBendsClear').disabled;
      closeEdgePopover();
      applyEdit(()=> setBendList('kmP','kmM', []));
      await wait(200);
    }

    /* A lineage may be brought down towards the bar, and is never thrown
       back up the moment it is picked up. */
    {
      const p = nodes.get('kmP');
      const startY = p.y;
      const c = centreOf(nodeEl('kmP'));
      fire('mousedown', c.x, c.y, {}, nodeEl('kmP'));
      let firstFrameY = null;
      for(let k = 1; k <= 8; k++){
        fire('mousemove', c.x, c.y + k * 22 * vs);
        await wait(40);
        if(k === 1) firstFrameY = nodes.get('kmP').y;
      }
      fire('mouseup', c.x, c.y + 8 * 22 * vs); await wait(300);
      const endY = nodes.get('kmP').y;
      out.cameDown = endY > startY + 40;
      out.noUpwardJump = firstFrameY >= startY - 0.6;
      out.cameDownBy = JSON.stringify({startY, firstFrameY, endY});
      /* …and it stopped before the bar rather than walking through it. */
      const bar = amalgamBars.get('kmM');
      const m = nodes.get('kmM');
      out.stoppedShortOfTheBar = !!bar && (nodes.get('kmP').y + nodes.get('kmP').h) < m.y;
    }

    /* ---- a route bent by hand keeps out of its own two entries ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['kbA','Bent from',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['kbB','Bent to','kbA',null,null,null,{pos:[X + 260, Y + 260]}]);
    });
    await wait(400);
    {
      const a = nodes.get('kbA'), b = nodes.get('kbB');
      const boxes = [a, b].map(n=> ({x0:n.x + 2, y0:n.y + 2, x1:n.x + n.w - 2, y1:n.y + n.h - 2}));
      const crosses = (pts)=> pts.some((p, i)=> i && boxes.some(r=>
        segIntersectsRect(pts[i-1].x, pts[i-1].y, p.x, p.y, r)));
      let bad = 0, tried = 0;
      out.bentBad = [];
      for(let dx = -160; dx <= 460; dx += 60){
        for(let dy = -160; dy <= 460; dy += 60){
          applyEdit(()=> setBendList('kbA','kbB', [[X + dx, Y + dy]]));
          redrawEdges();
          tried++;
          if(crosses(ptsOf('kbA','kbB'))){
            bad++;
            if(out.bentBad.length < 4) out.bentBad.push({bend:[dx,dy],
              pts: ptsOf('kbA','kbB').map(p=> [Math.round(p.x - X), Math.round(p.y - Y)]),
              boxes: [nodes.get('kbA'), nodes.get('kbB')].map(n=> [Math.round(n.x-X), Math.round(n.y-Y), n.w, n.h])});
          }
        }
      }
      out.bentCrossings = bad;
      out.bentTried = tried;
      /* A bend dropped ON one of the two entries asks for a route that
         cannot exist, so it is left out of the one that is drawn. */
      applyEdit(()=> setBendList('kbA','kbB', []));
      redrawEdges(); await wait(150);
      const plain = ptsOf('kbA','kbB').map(p=> [Math.round(p.x), Math.round(p.y)]);
      applyEdit(()=> setBendList('kbA','kbB',
        [[Math.round(b.x + b.w/2), Math.round(b.y + b.h/2)]]));
      redrawEdges(); await wait(150);
      out.bendInsideIgnored =
        JSON.stringify(ptsOf('kbA','kbB').map(p=> [Math.round(p.x), Math.round(p.y)])) ===
        JSON.stringify(plain);
      applyEdit(()=> setBendList('kbA','kbB', []));
    }

    /* And the knee does not jump to the far side of its own entry when the
       two are pulled apart: the bend it is pinned to is in front of the
       side it leaves by at every distance. */
    {
      applyEdit(()=> setBendList('kbA','kbB', [[X + 120, Y + 150]]));
      let doubledBack = 0;
      for(let d = 0; d <= 900; d += 150){
        applyEdit(()=>{
          const found = workingEntry('kbB');
          putEntry(found.index, found.entry, Object.assign(entryOpts(found.entry), {pos:[X + d, Y + 300]}));
        });
        await wait(140);
        const pts = ptsOf('kbA','kbB');
        const a = nodes.get('kbA'), b = nodes.get('kbB');
        const rects = [a, b].map(n=> ({x0:n.x + 2, y0:n.y + 2, x1:n.x + n.w - 2, y1:n.y + n.h - 2}));
        const through = pts.some((p, i)=> i && rects.some(r=>
          segIntersectsRect(pts[i-1].x, pts[i-1].y, p.x, p.y, r)));
        // The bend it is pinned to never moves, so however far the two are
        // pulled apart the line reaches it without crossing either box.
        const reaches = pts.length >= 2;
        if(through || !reaches){
          doubledBack++;
          if(!out.backAt) out.backAt = JSON.stringify({d,
            pts: pts.map(p=> [Math.round(p.x-X), Math.round(p.y-Y)]),
            a:[Math.round(a.x-X), Math.round(a.y-Y), a.w, a.h]});
        }
      }
      out.noDoublingBack = doubledBack === 0;
    }

    /* ---- a portrait is never a rippled border ---- */
    {
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['kfA','From',null,null,null,null,{pos:[X, Y]}]);
        workingNodes.push(['kfP','','kfA',null,null,'ellipse',{pos:[X + 60, Y + 260], border:'wavy'}]);
      });
      await wait(450);
      const p = nodes.get('kfP');
      out.bioNotWavy = !isWavyBorder(p) && ringStepFor(p) === RING_STEP;
      const port = portOnSide(p, 'top', 0, 3, 0);
      const r = p.w/2, cx = p.x + p.w/2, cy = p.y + p.h/2;
      out.bioPortOnRim = Math.abs(Math.hypot(port.x - cx, port.y - cy) - r) < 0.6 &&
                         port.drop === 0 && port.sunk > 0;
      out.bioPortAt = JSON.stringify({d: Math.hypot(port.x - cx, port.y - cy), r, sunk: port.sunk});
    }

    /* ---- what belongs to another entry is out of play ---- */
    refill(TAG_CATS, [{name:'Kinds', tags:[FANFIC_TAG]}]);
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      refill(REFS, [{key:'kref', title:'A source', url:''}]);
      workingNodes.push(['kcA','one {{r:kref}}',null,null,null,null,
                         {pos:[X, Y], link:'https://example.com', tags:[FANFIC_TAG]}]);
      workingNodes.push(['kcB','two {{r:kref}}','kcA',null,null,null,
                         {pos:[X + 300, Y + 220], link:'https://example.com',
                          multiLang:true, langTabs:[{tag:'FR', text:'deux'}]}]);
      /* A third entry, related to neither, so what happens to it is what
         happens to the rest of the chart rather than to a neighbour. */
      workingNodes.push(['kcZ','three',null,null,null,null,
                         {pos:[X + 640, Y - 60], tags:[FANFIC_TAG]}]);
    });
    rebuildChart(); buildSideTabs();
    await wait(700);
    {
      const weave = ()=> fanLayer.querySelector('.fanfic-weave[data-id="kcZ"]');
      out.groundDrawn = !!weave();
      /* A citation pressed with nothing open shows the reference and does
         NOT open the entry it sits in. */
      deselect(); await wait(150);
      const mark = document.querySelector('.node[data-id="kcA"] .ref-mark');
      const c = mark ? centreOf(mark) : {x:0, y:0};
      fire('mousedown', c.x, c.y, {}, mark);
      fire('click', c.x, c.y, {}, mark);
      await wait(250);
      out.refOpensNothing = !selectedId && refsPanel.classList.contains('open');
      setSideTab(refsPanel, false);

      /* With one entry open, another's citation, link and chips are inert. */
      selectNode('kcA'); await wait(250);
      const other = document.querySelector('.node[data-id="kcB"] .ref-mark');
      const oc = centreOf(other);
      fire('mousedown', oc.x, oc.y, {}, other);
      await wait(200);
      out.otherRefInert = !refsPanel.classList.contains('open');

      const chip = document.querySelector('.node[data-id="kcB"] .lang-chip:last-of-type');
      const was = activeLangTab.get('kcB') ?? null;
      if(chip) chip.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      await wait(200);
      out.otherChipInert = (activeLangTab.get('kcB') ?? null) === was;
      /* The press is not swallowed, so it reaches the box and opens it —
         which is what makes the chip live the next time it is pressed. */
      out.chipFellThrough = selectedId === 'kcB';

      selectNode('kcA'); await wait(200);
      const linkEv = new MouseEvent('click', {bubbles:true, cancelable:true});
      const link = document.querySelector('.node[data-id="kcB"] .node-link');
      out.linkFound = !!link;
      if(link) link.dispatchEvent(linkEv);
      out.otherLinkInert = !!link && linkEv.defaultPrevented;

      /* Another entry's ground steps back with it, and performs for
         nobody while something else is open. */
      selectNode('kcB'); await wait(250);
      out.groundDims = !!weave() && weave().classList.contains('dim');
      hoverLivelyId = 'kcZ'; syncTagLiveliness();
      out.otherStillWhileOpen = !!weave() && !weave().classList.contains('tag-lively');
      hoverLivelyId = null; syncTagLiveliness();

      /* Its own chips switch, and the chart stays stepped back. */
      selectNode('kcB'); await wait(200);
      const own = document.querySelector('.node[data-id="kcB"] .lang-chip:last-of-type');
      if(own) own.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      await wait(250);
      out.ownChipSwitches = (activeLangTab.get('kcB') ?? null) === 0;
      const zEl = document.querySelector('.node[data-id="kcZ"]');
      out.dimSurvivesTabs = !!zEl && zEl.classList.contains('dim');
      deselect(); await wait(150);
    }

    /* ---- the panel and the badges ---- */
    {
      out.noLangToolbar = !document.querySelector('#editLangTabsField .mini-toolbar');
      out.noLineageHeadings = !document.querySelector('#detailParents h3') &&
                              !document.querySelector('#detailChildren h3');
      const badge = document.querySelector('.node[data-id="kcA"] .node-link .node-link-bg');
      const g = document.querySelector('.node[data-id="kcA"]');
      out.badgeIsChipSized = !!badge && Math.abs(+badge.getAttribute('data-h') - CHIP_TAB_H) < 0.01;
      out.badgeOnTop = !!g && g.lastElementChild && g.lastElementChild.tagName.toLowerCase() === 'a';
    }

    applyEdit(()=>{ workingNodes = beforeNodes; refill(EDGE_STYLES, beforeStyles); });
    await wait(400);
    return out;
  });
  check('every lineage of a merge leaves by the middle of its side and drops straight',
        rK.membersCentred, rK.memberMiddles);
  check('a merged lineage takes no hand-set bends, and is offered none',
        rK.mergedIgnoresBends && rK.mergedOffersNoHandles && rK.mergedStraightenOff,
        JSON.stringify({ignored:rK.mergedIgnoresBends, handles:rK.mergedOffersNoHandles,
                        straighten:rK.mergedStraightenOff}));
  check('a lineage may be brought down to its bar without being thrown back up',
        rK.cameDown && rK.noUpwardJump && rK.stoppedShortOfTheBar, rK.cameDownBy);
  check('a route bent by hand never runs through either of its own entries',
        rK.bentCrossings === 0, `${rK.bentCrossings} of ${rK.bentTried} ${JSON.stringify(rK.bentBad)}`);
  check('a bend dropped on an entry is left out of the route', rK.bendInsideIgnored);
  check('a bent knee does not double back past its own entry as the two part',
        rK.noDoublingBack, rK.backAt);
  check('a portrait is drawn as a circle, so it is never a rippled border',
        rK.bioNotWavy && rK.bioPortOnRim, rK.bioPortAt);
  check('a citation opens the reference and nothing else', rK.refOpensNothing);
  check('another entry’s citation, link and chips are out of play',
        rK.otherRefInert && rK.otherChipInert && rK.otherLinkInert && rK.chipFellThrough,
        JSON.stringify({ref:rK.otherRefInert, chip:rK.otherChipInert,
                        link:rK.otherLinkInert, opened:rK.chipFellThrough}));
  check('another entry’s ground steps back and performs for nobody',
        rK.groundDrawn && rK.groundDims && rK.otherStillWhileOpen,
        JSON.stringify({drawn:rK.groundDrawn, dim:rK.groundDims, still:rK.otherStillWhileOpen}));
  check('switching a tab leaves the rest of the chart stepped back',
        rK.ownChipSwitches && rK.dimSurvivesTabs,
        JSON.stringify({switched:rK.ownChipSwitches, dim:rK.dimSurvivesTabs}));
  check('the language rows carry no editor, and the lineage lists no headings',
        rK.noLangToolbar && rK.noLineageHeadings);
  check('the link badge is a tab the height of a chip, and clickable all the way round',
        rK.badgeIsChipSized && rK.badgeOnTop,
        JSON.stringify({sized:rK.badgeIsChipSized, top:rK.badgeOnTop}));

  });

  /* ---- 36. one border, asked once; one route, with no kink in it ---- */
  await scenario("one border asked once, and a route with no kink in it", async () => {
  const rB = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 280);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- the border is one answer, and everything reads the same one ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['bdA','Rippled',null,null,null,null,
                         {pos:[X, Y], border:'wavy', colors:['#20242b','#35c43a']}]);
      workingNodes.push(['bdB','Plain','bdA',null,null,null,{pos:[X + 300, Y + 220]}]);
      refill(EDGE_STYLES, [{from:'bdA', to:'bdB', arrow:true, arrowIn:true}]);
    });
    await wait(700);
    {
      /* What the program says the border is, against what it DREW. This is
         the invariant three rounds of "the drawing moved and the
         connectors did not" were missing: the query is derived from the
         drawn points, so it cannot be out of phase with them. */
      const n = nodes.get('bdA');
      const path = document.querySelector('.node[data-id="bdA"] path');
      const prof = borderProfileOf(n, 0);
      const L = path.getTotalLength();
      const drawn = [];
      for(let s = 0; s <= L; s += 0.4) drawn.push(path.getPointAtLength(s));
      let worst = 0, tried = 0;
      const probe = (side, px, py, pick)=>{
        let best = null;
        drawn.forEach(q=>{ if(pick(q)) best = best === null ? q : (Math.abs(q[side] - py) < 0 ? best : best); });
        return best;
      };
      void probe;
      for(let u = 6; u < n.w - 6; u += 3){
        const px = n.x + u;
        let top = null;
        drawn.forEach(q=>{ if(Math.abs(q.x - px) < 0.3 && q.y < n.y + n.h/2){
          if(top === null || q.y < top) top = q.y; } });
        if(top === null) continue;
        const want = n.y - top;                    // how far out the drawing is
        const got = prof.offsetAt('top', px, n.y);
        tried++;
        worst = Math.max(worst, Math.abs(want - got));
      }
      out.borderTried = tried;
      out.borderWorst = +worst.toFixed(2);
      /* And the arrowhead rests on THAT border: its tip stands a border's
         half-stroke outside the wave at the point it meets, never in the
         open air beside it. */
      /* Both heads of this connector carry the edge's own names, so the
         one AT the rippled entry is found by where its tip is. */
      let near = Infinity;
      [...document.querySelectorAll('.edge-arrow')].forEach(h=>{
        const hd = h.querySelector('path').getAttribute('d');
        const tip = hd.match(/-?[\d.]+/g).slice(0, 2).map(Number);
        if(Math.hypot(tip[0] - (n.x + n.w/2), tip[1] - (n.y + n.h/2)) > n.w) return;
        drawn.forEach(q=>{ near = Math.min(near, Math.hypot(q.x - tip[0], q.y - tip[1])); });
      });
      out.headOnBorder = Number.isFinite(near) ? +near.toFixed(2) : null;
    }

    /* ---- a wave is a wave, not a zigzag ---- */
    {
      const d = wavyPath([{x:0, y:0}, {x:240, y:0}]);
      const p = wavePts(d, 0.5);
      let worst = 180;
      for(let i = 1; i < p.length - 1; i++){
        const ax = p[i].x - p[i-1].x, ay = p[i].y - p[i-1].y;
        const bx = p[i+1].x - p[i].x, by = p[i+1].y - p[i].y;
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if(la < 1e-6 || lb < 1e-6) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (ax*bx + ay*by)/(la*lb)))) * 180/Math.PI;
        worst = Math.min(worst, 180 - ang);
      }
      out.waveWorstTurn = +worst.toFixed(1);
      const crests = waveCrests(d, 'y');
      const gaps = [];
      for(let i = 1; i < crests.length; i++) gaps.push(crests[i] - crests[i-1]);
      out.waveHalfWave = gaps.length
        ? +(gaps.reduce((a, b)=> a + b, 0) / gaps.length).toFixed(2) : null;
    }

    /* ---- a connector with room to line itself up has no step in it ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      /* Wide enough that each port has real room along its side, and out
         of line by less than the two of them can close between them. */
      workingNodes.push(['stA','An entry wide enough to have room',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['stB','And another one below it','stA',null,null,null,{pos:[X + 30, Y + 220]}]);
    });
    await wait(600);
    /* Out of line by a hair, measured rather than assumed: where the two
       middles fall depends on how wide the words come out, and the offset
       this used to rely on was whatever the widths of the day made it. */
    {
      const a = nodes.get('stA'), b = nodes.get('stB');
      const dx = (a.x + a.w/2) - (b.x + b.w/2) - 0.15;
      applyEdit(()=>{ workingNodes.find(x=> x[0] === 'stB')[6].pos = [X + 30 + dx, Y + 220]; });
      await wait(400);
    }
    {
      const pts = (drawnRoutes.get(calloutEdgeKey('stA','stB')) || {}).pts || [];
      let knees = 0;
      for(let i = 1; i < pts.length - 1; i++){
        const v1 = Math.abs(pts[i].x - pts[i-1].x) < 0.5;
        const v2 = Math.abs(pts[i+1].x - pts[i].x) < 0.5;
        if(v1 !== v2) knees++;
      }
      out.offsetKnees = knees;
      out.offsetPts = JSON.stringify(pts.map(p=> [Math.round(p.x), Math.round(p.y)]));
    }

    /* ---- and no route anywhere crosses an entry ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      for(let i = 0; i < 9; i++){
        workingNodes.push(['gr' + i, 'Grid ' + i, i > 0 ? 'gr' + (i - 1) : null, null, null, null,
                           {pos:[X + (i % 3) * 210, Y + Math.floor(i / 3) * 150]}]);
      }
    });
    await wait(900);
    {
      let crossings = 0, routes = 0;
      structEdges.forEach(e=>{
        const rec = drawnRoutes.get(calloutEdgeKey(e.from, e.to));
        if(!rec || !rec.pts) return;
        routes++;
        nodes.forEach(n=>{
          if(n.id === e.from || n.id === e.to) return;
          const r = {x0:n.x + 1, y0:n.y + 1, x1:n.x + n.w - 1, y1:n.y + n.h - 1};
          for(let i = 1; i < rec.pts.length; i++){
            if(segIntersectsRect(rec.pts[i-1].x, rec.pts[i-1].y,
                                 rec.pts[i].x, rec.pts[i].y, r)) crossings++;
          }
        });
      });
      out.gridRoutes = routes;
      out.gridCrossings = crossings;
    }

    /* ---- a card is one box, and its badges are where every entry's are ---- */
    const pic = 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"></svg>');
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['cdA','Card', null, null, 'a body', null,
                         {pos:[X, Y], card:true, image:pic, link:'https://example.com',
                          multiLang:true, langTabs:[{tag:'FR', text:'carte'}]}]);
      workingNodes.push(['cdB','One', 'cdA', null, null, null, {pos:[X - 260, Y + 40]}]);
      workingNodes.push(['cdC','Two', 'cdA', null, null, null, {pos:[X - 260, Y + 120]}]);
      workingNodes.push(['cdW','Rippled card', null, null, 'ripple', null,
                         {pos:[X + 260, Y], card:true, border:'wavy'}]);
    });
    await wait(900);
    {
      const n = nodes.get('cdA');
      const badge = document.querySelector('.node[data-id="cdA"] .node-link');
      const tr = badge ? badge.getAttribute('transform') : '';
      const at = (tr.match(/-?[\d.]+/g) || []).map(Number);
      /* A tab standing on the top border at its right end, its foot sunk
         just into the border's outer edge and no further, so it meets the
         border and can never sit on the words. */
      const base = tabBaseOf(n);
      out.cardBadgeTopRight = at.length === 2 &&
        at[0] + LINK_TAB/2 <= base.right + 0.01 && at[0] > n.x + n.w * 0.5 &&
        Math.abs(at[1] + LINK_TAB/2 - (base.y + TAB_SINK)) < 0.01;
      const chip = document.querySelector('.node[data-id="cdA"] .lang-chips .lang-chip');
      const cb = chip ? chip.getBoundingClientRect() : null;
      const box = document.querySelector('.node[data-id="cdA"] > rect');
      const bb = box ? box.getBoundingClientRect() : null;
      out.cardChipsTopLeft = !!(cb && bb) && cb.bottom <= bb.top + 0.5 &&
                             cb.left < bb.left + bb.width * 0.5;
      /* Its ports are spread over the WHOLE side, picture band and all —
         a card is one box, not a box with a lid on it. */
      const ys = ['cdB','cdC'].map(id=>{
        const rec = drawnRoutes.get(calloutEdgeKey('cdA', id));
        return rec && rec.pts.length ? rec.pts[0].y : null;
      }).filter(v=> v !== null);
      out.cardPortsSpread = ys.length === 2 &&
        Math.min(...ys) < n.y + n.cardTop + 1;
      out.cardPortYs = JSON.stringify({ys, top:n.y, band:n.cardTop});
      out.wavyCardDrawn = !!document.querySelector('.node[data-id="cdW"] path');
    }

    /* ---- what another entry wears is out of play ---- */
    {
      selectNode('cdW');
      await wait(250);
      const link = document.querySelector('.node[data-id="cdA"] .node-link');
      const chips = document.querySelector('.node[data-id="cdA"] .lang-chips');
      out.otherLinkInert = !!link && getComputedStyle(link).pointerEvents === 'none';
      out.otherChipsInert = !!chips && getComputedStyle(chips).pointerEvents === 'none';
      deselect();
      await wait(150);
      out.ownLinkLive = getComputedStyle(
        document.querySelector('.node[data-id="cdA"] .node-link')).pointerEvents !== 'none';
    }

    /* ---- the panel says nothing about lineage any more ---- */
    out.noLineageLists = !document.getElementById('detailParents') &&
                         !document.getElementById('detailChildren') &&
                         !document.querySelector('.conn-row');

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(500);
    return out;
  });
  check('the border a connector aims at is the border that was drawn',
        rB.borderTried >= 10 && rB.borderWorst < 0.7,
        JSON.stringify({tried:rB.borderTried, worst:rB.borderWorst}));
  check('and an arrowhead comes to rest on it',
        rB.headOnBorder !== null && rB.headOnBorder < 1.2, String(rB.headOnBorder));
  check('a wave turns no corner sharper than a curve does',
        rB.waveWorstTurn > 150 && rB.waveHalfWave > 5,
        JSON.stringify({turn:rB.waveWorstTurn, half:rB.waveHalfWave}));
  check('two entries a little out of line are joined by one straight run',
        rB.offsetKnees === 0, rB.offsetPts);
  check('and no route on a crowded chart crosses an entry',
        rB.gridRoutes >= 8 && rB.gridCrossings === 0,
        JSON.stringify({routes:rB.gridRoutes, crossings:rB.gridCrossings}));
  check('a card wears its badges where every other entry wears them',
        rB.cardBadgeTopRight && rB.cardChipsTopLeft,
        JSON.stringify({link:rB.cardBadgeTopRight, chips:rB.cardChipsTopLeft}));
  check('a card is one box: its ports use the whole of a side',
        rB.cardPortsSpread, rB.cardPortYs);
  check('and a card can wear a rippled border', rB.wavyCardDrawn);
  check('another entry’s badges do not answer the pointer',
        rB.otherLinkInert && rB.otherChipsInert && rB.ownLinkLive,
        JSON.stringify({link:rB.otherLinkInert, chips:rB.otherChipsInert, own:rB.ownLinkLive}));
  check('the entry panel no longer lists what an entry is joined to',
        rB.noLineageLists);

  });

  await scenario("handles that step back, a picture kept whole, and room to be a line", async () => {
  const rP = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 280);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- a connector meeting an inner ring is still the connector ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['rcA','Three rings',null,null,null,null,
                         {pos:[X, Y], colors:['#20242b','#35c43a','#c23b22']}]);
      workingNodes.push(['rcB','Plain','rcA',null,null,null,{pos:[X + 320, Y + 40]}]);
      /* Meeting the INNERMOST ring at both ends: the case where the line
         has to pass under the two rings outside it, and the one the cap
         exists for. */
      refill(EDGE_STYLES, [{from:'rcA', to:'rcB', arrow:true, arrowIn:true,
                            fromSide:'right', fromRing:0, toSide:'left', toRing:0}]);
    });
    await wait(700);
    {
      const caps = [...document.querySelectorAll('.edge-cap')];
      const line = document.querySelector(
        '#edgeLayer .edge.struct[data-from="rcA"][data-to="rcB"]:not(.edge-cap)');
      out.capCount = caps.length;
      /* The cap is the line drawn again and cut to the ring it crosses —
         not a stub of its own invention, which is what left a pile of
         lines at one end and a stray line under the arrowhead at the
         other. Same path, and a clip. */
      /* The whole route, redrawn and cut to the ring — the SAME path,
         character for character. It used to be handed the route before
         the arrowheads were allowed for, so above the rings it redrew the
         stretch the head is standing on: a headless line poking out from
         under every arrow on an entry with more than one border. */
      out.capIsTheLine = caps.length > 0 && !!line &&
        caps.every(c=> c.getAttribute('d') === line.getAttribute('d') &&
                       /^url\(#/.test(c.getAttribute('mask') || ''));
      out.capD = caps.length ? caps[0].getAttribute('d').slice(0, 30) : '';
    }

    /* ---- the grips and the arm belong to the entry being read ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['hgA','One',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['hgB','Two','hgA',null,null,null,{pos:[X + 300, Y]}]);
      workingNodes.push(['hgC','Elsewhere',null,null,null,null,{pos:[X + 120, Y + 240]}]);
    });
    await wait(600);
    {
      /* An entry with nothing to do with that connector, so the connector
         is one of the faded ones for as long as it is open. */
      selectNode('hgC');
      await wait(250);
      nodeControlsOn('hgA');
      const grip = document.querySelector('.node[data-id="hgA"] .node-resize');
      out.otherGripInert = !!grip && getComputedStyle(grip).pointerEvents === 'none';
      /* …and a panel opened on one connector does not hand every other
         connector on the chart the same panel: closing it used to wash
         the selection off, and the click that closed it then opened the
         line it landed on. */
      openEdgeStylePopover('hgA', 'hgB', {clientX: 500, clientY: 300});
      await wait(200);
      closeEdgePopover();
      await wait(250);
      const parts = [...document.querySelectorAll(
        '#edgeLayer .edge[data-from="hgA"][data-to="hgB"]')];
      out.dimHeldAfterClose = parts.length > 0 &&
        parts.every(p=> p.classList.contains('dim'));
      deselect();
      await wait(150);
    }

    /* ---- and nothing else can be carried while it is open ---- */
    {
      selectNode('hgB');
      await wait(250);
      const g = document.querySelector('.node[data-id="hgA"]');
      const r = g.getBoundingClientRect();
      const sx = r.x + r.width/2, sy = r.y + r.height/2;
      const was = nodes.get('hgA').x;
      g.dispatchEvent(new MouseEvent('mousedown',
        {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
      for(let k = 1; k <= 8; k++){
        window.dispatchEvent(new MouseEvent('mousemove',
          {bubbles:true, clientX: sx + k * 14, clientY: sy}));
        await wait(16);
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(300);
      out.otherEntryHeldStill = Math.abs(nodes.get('hgA').x - was) < 0.01;
      /* …and the one being read still moves, so this is a rule about
         which entry, not a chart that has stopped answering. */
      const sel = document.querySelector('.node[data-id="hgB"]');
      const rb = sel.getBoundingClientRect();
      const bx = rb.x + rb.width/2, by = rb.y + rb.height/2;
      const wasB = nodes.get('hgB').x;
      sel.dispatchEvent(new MouseEvent('mousedown',
        {bubbles:true, cancelable:true, button:0, clientX:bx, clientY:by}));
      for(let k = 1; k <= 8; k++){
        window.dispatchEvent(new MouseEvent('mousemove',
          {bubbles:true, clientX: bx + k * 14, clientY: by}));
        await wait(16);
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(300);
      out.openEntryStillMoves = nodes.get('hgB').x > wasB + 20;
      deselect();
      await wait(150);
    }

    /* ---- a card's picture is kept whole unless cropping is asked for ---- */
    {
      const wide = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">' +
        '<rect width="400" height="80" fill="#69c"/></svg>');
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['ciA','Fitted',null,null,'A note',null,
                           {pos:[X, Y], card:true, image:wide}]);
        workingNodes.push(['ciB','Cropped',null,null,'A note',null,
                           {pos:[X + 260, Y], card:true, image:wide, cardCrop:true}]);
        workingNodes.push(['ciW','Rippled',null,null,'A note',null,
                           {pos:[X + 520, Y], card:true, image:wide, border:'wavy'}]);
      });
      await wait(900);
      const img = (id)=> document.querySelector('.node[data-id="' + id + '"] > image');
      out.fitWhole = (img('ciA') || {}).getAttribute &&
        img('ciA').getAttribute('preserveAspectRatio').indexOf('meet') > 0;
      out.cropWhenAsked = !!img('ciB') &&
        img('ciB').getAttribute('preserveAspectRatio').indexOf('slice') > 0;
      /* The band is as deep as the picture needs: a picture five times as
         wide as it is tall gets a shallow band, not the fixed slab a
         cropped one gets. */
      const a = nodes.get('ciA'), b = nodes.get('ciB');
      out.bandFollowsPicture = a.cardTop > 0 && a.cardTop < b.cardTop - 4;
      out.bands = JSON.stringify({fitted:Math.round(a.cardTop), cropped:Math.round(b.cardTop)});
      /* A rippled card is airtight: everything inside it is cut to the
         card's own outline, so no band and no rule reaches past the
         ripple. */
      const wg = document.querySelector('.node[data-id="ciW"]');
      /* The picture, and what fills round it, which is cut by a group. */
      const wImg = wg.querySelector(':scope > image');
      const wBack = wg.querySelector('.card-img-backdrop');
      const rules = [...wg.querySelectorAll('.card-rule')];
      out.wavyCardSealed = !!wImg && /^url\(#/.test(wImg.getAttribute('clip-path') || '') &&
        !!wBack && /^url\(#/.test(wBack.parentNode.getAttribute('clip-path') || '') &&
        rules.length > 0 && rules.every(r=> /^url\(#/.test(r.getAttribute('clip-path') || ''));

      /* A picture given a depth by hand, on a card then made smaller, gives
         way to the words: every band's text stays inside the card. */
      applyEdit(()=>{
        if(!mediaTypeById('line')) (SETTINGS.mediaTypes = SETTINGS.mediaTypes || []).push({id:'line', name:'Line', fields:[{id:'f1', label:'Line'}]});
        workingNodes.push(['ciH','Heading',null,null,'A note',null,
                           {pos:[X, Y + 300], card:true, image:wide, mediaType:'line', mediaData:{f1:'Medium'},
                            size:[150, 90], cardImgH:80}]);
        workingNodes.push(['ciR','Two rings',null,null,null,null,
                           {pos:[X + 260, Y + 300], card:true, image:wide,
                            colors:['#20242b', '#c03a2b']}]);
      });
      await wait(500);
      {
        const g = document.querySelector('.node[data-id="ciH"]');
        const h = nodes.get('ciH');
        const box = g.querySelector(':scope > rect').getBoundingClientRect();
        const texts = [...g.querySelectorAll('text')].filter(t=> t.textContent.trim());
        out.cardWordsInside = texts.length >= 3 && texts.every(t=>{
          const b = t.getBoundingClientRect();
          return b.top >= box.top - 1 && b.bottom <= box.bottom + 1;
        });
        out.cardWordsAt = JSON.stringify({top: h.cardTop, texts: texts.length});
      }
      /* A card wears a ring per colour, as any boxed entry does. */
      {
        const g = document.querySelector('.node[data-id="ciR"]');
        const second = [...g.querySelectorAll('rect, path')].filter(r=>
          (r.getAttribute('stroke') || '').toLowerCase() === '#c03a2b');
        const n = nodes.get('ciR');
        out.cardRings = ringCountOf(n) === 2 && second.length > 0 &&
          second.some(r=> r.getBBox().width > n.w + 1);
      }
      /* The inline editor stands on the heading, not on the picture. */
      {
        openNodeEditor('ciA');
        await wait(80);
        const surf = richFields.get('nodeEditorText').surface.getBoundingClientRect();
        const head = document.querySelector('.node[data-id="ciA"] > text').getBoundingClientRect();
        out.cardEditorOnHeading = Math.abs((surf.top + surf.height/2) - (head.top + head.height/2)) < 3 * vs;
        closeNodeEditor(true);
      }
    }

    /* ---- carried too close, the other entry moves ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['psA','Alpha',null,null,null,null,{pos:[X - 300, Y]}]);
      workingNodes.push(['psB','Beta','psA',null,null,null,{pos:[X + 100, Y]}]);
      workingNodes.push(['psC','Gamma',null,null,null,null,{pos:[X + 100, Y + 220]}]);
    });
    await wait(700);
    {
      const beforeB = nodes.get('psB').x, beforeC = nodes.get('psC').x;
      const g = document.querySelector('.node[data-id="psA"]');
      const r = g.getBoundingClientRect();
      const sx = r.x + r.width / 2, sy = r.y + r.height / 2;
      g.dispatchEvent(new MouseEvent('mousedown',
        {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
      /* Up to a little short of B, with room left for a straight line. */
      const A0 = nodes.get('psA'), B0 = nodes.get('psB');
      const reach = (B0.x - 40 - (A0.x + A0.w)) * vs;
      for(let k = 1; k <= 24; k++){
        window.dispatchEvent(new MouseEvent('mousemove',
          {bubbles:true, clientX: sx + reach * k / 24, clientY: sy}));
        await wait(16);
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(700);
      const A = nodes.get('psA'), B = nodes.get('psB');
      out.pushedGap = Math.round(B.x - (A.x + A.w));
      out.pushedMoved = B.x > beforeB + 20;
      out.unlinkedStill = Math.abs(nodes.get('psC').x - beforeC) < 0.5;
      /* And what it is joined by is a line: one straight run, no knee. */
      /* Tidied first: a route squeezed into a short gap hands back a stub
         point sitting exactly on its neighbour, and a zero-length segment
         has no direction to compare — counted raw it reads as a corner
         that is not on the paper. */
      const pts = tidyPoints((drawnRoutes.get(calloutEdgeKey('psA', 'psB')) || {}).pts || []);
      let knees = 0;
      for(let i = 1; i < pts.length - 1; i++){
        const v1 = Math.abs(pts[i].x - pts[i-1].x) < 0.5;
        const v2 = Math.abs(pts[i+1].x - pts[i].x) < 0.5;
        if(v1 !== v2) knees++;
      }
      out.pushedKnees = knees;
      out.pushedPts = JSON.stringify(pts.map(p=> [Math.round(p.x), Math.round(p.y)]));
      /* And after all that carrying and shoving, both ends are exactly
         where their sides put them: the middle of A's right side and the
         middle of B's left one. An end that drifts along its side while
         an entry is dragged is the one thing a connector's anchorage may
         never do. */
      const e0 = pts[0], e1 = pts[pts.length-1];
      out.endsSeated = Math.abs(e0.x - (A.x + A.w)) < 0.01 &&
                       Math.abs(e0.y - (A.y + A.h/2)) < 0.01 &&
                       Math.abs(e1.x - B.x) < 0.01 &&
                       Math.abs(e1.y - (B.y + B.h/2)) < 0.01;
      out.endsAt = JSON.stringify({from:[+e0.x.toFixed(1), +e0.y.toFixed(1)],
                                   want:[+(A.x + A.w).toFixed(1), +(A.y + A.h/2).toFixed(1)],
                                   to:[+e1.x.toFixed(1), +e1.y.toFixed(1)],
                                   wantTo:[+B.x.toFixed(1), +(B.y + B.h/2).toFixed(1)]});
      /* One gesture, one step back. */
      undoLastEdit();
      await wait(600);
      out.undoneTogether = Math.abs(nodes.get('psB').x - beforeB) < 0.5 &&
                           Math.abs(nodes.get('psA').x - (X - 300)) < 40;
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(500);
    return out;
  });
  check('a connector crossing an inner ring is drawn as itself, cut to the ring',
        rP.capCount > 0 && rP.capIsTheLine,
        JSON.stringify({caps:rP.capCount, d:rP.capD}));
  check('another entry’s grips do not answer the pointer', rP.otherGripInert);
  check('and closing a connector’s panel leaves the selection where it was',
        rP.dimHeldAfterClose);
  check('another entry cannot be carried while one is open',
        rP.otherEntryHeldStill && rP.openEntryStillMoves,
        JSON.stringify({other:rP.otherEntryHeldStill, own:rP.openEntryStillMoves}));
  check('a card keeps its picture whole, and crops it only when asked',
        rP.fitWhole && rP.cropWhenAsked,
        JSON.stringify({fit:rP.fitWhole, crop:rP.cropWhenAsked}));
  check('and the band is as deep as the picture needs', rP.bandFollowsPicture, rP.bands);
  check('a rippled card is airtight', rP.wavyCardSealed);
  check('a card\'s picture gives way to its words, which stay inside the card',
        rP.cardWordsInside, rP.cardWordsAt);
  check('a card wears a ring per colour', rP.cardRings);
  check('a card\'s heading is written in the field where the card writes it',
        rP.cardEditorOnHeading);
  check('an entry carried up to one it is joined to leaves it where it stands',
        !rP.pushedMoved && rP.unlinkedStill,
        JSON.stringify({gap:rP.pushedGap, moved:rP.pushedMoved, other:rP.unlinkedStill}));
  check('both ends sit exactly on their ports when the drag is over',
        rP.endsSeated, rP.endsAt);
  check('the move undoes in one step', rP.undoneTogether);

  });

  await scenario("a picture with corners of its own, and words that keep their line", async () => {
  const rC = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 280);
    /* On the grid, so where the entries land does not depend on wherever
       the chart's own contents have left the view: a box at an odd
       fraction of a unit lays its words out by a different rounding. */
    const X = snapToGrid(w0.x), Y = snapToGrid(w0.y);
    deselect();
    const pic = 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">' +
      '<rect width="300" height="200" fill="#69c"/></svg>');

    /* ---- a line is never folded by the measurer ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['wrA', 'A heading long enough to have been folded\nand a second line the author typed',
                         null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['wrB', 'Rippled words here', null, null, null, null,
                         {pos:[X + 360, Y], border:'wavy'}]);
    });
    await wait(700);
    {
      /* Counted as LINES, not as tspans: a line is drawn as however many
         runs its words and marks need, and they share one baseline. */
      const ys = new Set([...document.querySelectorAll('.node[data-id="wrA"] text tspan')]
        .map(t=> t.getAttribute('y')).filter(v=> v != null));
      // Exactly the two the author typed — no more, however long they are.
      out.linesKept = ys.size === 2;
      out.lineCount = ys.size;
      /* …and the words of a rippled entry stop short of its border, which
         swings a whole amplitude into the box and is stroked on top of
         that. Measured against the box, not against the drawn wave: the
         box is where the ripple's baseline is. */
      const n = nodes.get('wrB');
      const t = document.querySelector('.node[data-id="wrB"] text');
      /* The INK, which is what the box is laid out from. The text's own
         box runs to the advance of the last glyph, which overhangs or
         falls short of its ink by a fraction of a unit depending on
         where the word happens to start, so the same entry passed or
         failed by where the chart's contents had left the view. */
      const b = t ? inkBoxOf(t) : null;
      const need = POCKET_AMP + NODE_BORDER_W / 2;
      out.clearOfRipple = !!b && (b.x - n.x) >= need && ((n.x + n.w) - (b.x + b.width)) >= need;
      out.rippleGaps = b ? JSON.stringify([+(b.x - n.x).toFixed(2),
                                           +((n.x + n.w) - (b.x + b.width)).toFixed(2)]) : '';
    }

    /* ---- writing in a box sized by hand keeps its size (the owner's
            list of 7.11: an Enter in the field threw it away) ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['szA', 'Short', null, null, null, null,
                         {pos:[X, Y], size:[300, 120]}]);
    });
    await wait(500);
    {
      out.handSize = [nodes.get('szA').w | 0, nodes.get('szA').h | 0];
      openNodeEditor('szA');
      await wait(200);
      nodeEditorText.value = 'Short, but written again';
      commitNodeEditorText();
      closeNodeEditor(true);
      await wait(600);
      const n = nodes.get('szA');
      out.refitAfterEdit = Math.abs(n.w - 300) < 1 && Math.abs(n.h - 120) < 1 &&
        !!(workingEntry('szA').entry[6] || {}).size;
      out.refitSize = [n.w | 0, n.h | 0];
      /* …and more words than it holds grow it, rather than run out. */
      openNodeEditor('szA');
      await wait(200);
      nodeEditorText.value = Array.from({length: 12}, (_, i)=> 'Line number ' + i).join('\n');
      commitNodeEditorText();
      closeNodeEditor(true);
      await wait(600);
      const m = nodes.get('szA');
      out.grewForWords = m.h > 120 + 20 && Math.abs(m.w - 300) < 1;
    }

    /* ---- a card: its middle band, its picture's corners, its bands ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      if(!mediaTypeById('line')) (SETTINGS.mediaTypes = SETTINGS.mediaTypes || []).push({id:'line', name:'Line', fields:[{id:'f1', label:'Line'}]});
      workingNodes.push(['cdM', 'A heading', null, null, 'The note under it', null,
                         {pos:[X, Y], card:true, image:pic, mediaType:'line', mediaData:{f1:'Collectible card [back]'}}]);
      workingNodes.push(['cdH', 'Hand-sized', null, null, 'Note', null,
                         {pos:[X + 300, Y], card:true, image:pic, size:[180, 260]}]);
    });
    await wait(900);
    {
      out.mediumDrawn = !!document.querySelector('.node[data-id="cdM"] text.card-medium');
      // Picture, heading, medium, note: three rules divide four bands.
      out.cardRules = document.querySelectorAll('.node[data-id="cdM"] .card-rule').length;
      /* A card given more room by hand gives it to the PICTURE. Its text
         bands take what their words need and no more — which they do not
         when the picture is held at a fixed depth and the heading swells
         to fill the rest. */
      const hn = nodes.get('cdH');
      out.handCardBand = Math.round(hn.cardTop);
      out.bandTookTheRoom = hn.cardTop > 120;
    }

    /* ---- a double click on the picture no longer resizes it ---- */
    {
      const g = document.querySelector('.node[data-id="cdM"]');
      const r = g.getBoundingClientRect();
      g.dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true,
        clientX: r.x + r.width/2, clientY: r.y + 14}));
      await wait(350);
      out.picGrips = document.querySelectorAll('.card-img-grip, .card-img-frame').length;
      out.picNoResizer = typeof beginCardImageResize === 'undefined' && typeof openCardImageEdit === 'undefined';
      closeNodeEditor();
      deselect();
      await wait(150);
    }

    /* ---- nothing is pushed: neither a merge's parents nor the merge ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      for(let i = 0; i < 3; i++)
        workingNodes.push(['mp' + i, 'Parent ' + i, null, null, null, null,
                           {pos:[X - 200 + i * 200, Y]}]);
      workingNodes.push(['mam', 'Merge', ['mp0','mp1','mp2'], null, null, null,
                         {merge:true, pos:[X, Y + 420]}]);
    });
    await wait(900);
    {
      const carry = async (id, dy)=>{
        const g = document.querySelector('.node[data-id="' + id + '"]');
        const r = g.getBoundingClientRect();
        const sx = r.x + r.width/2, sy = r.y + r.height/2;
        g.dispatchEvent(new MouseEvent('mousedown',
          {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
        for(let k = 1; k <= 18; k++){
          window.dispatchEvent(new MouseEvent('mousemove',
            {bubbles:true, clientX:sx, clientY: sy + (dy/18) * k}));
          await wait(14);
        }
        window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        await wait(500);
      };
      const wasParent = nodes.get('mp1').y;
      await carry('mam', -390);                    // the merge, up into its parents
      out.mergePushedParent = nodes.get('mp1').y < wasParent - 5;
      out.mergePushAt = JSON.stringify({was:Math.round(wasParent), now:Math.round(nodes.get('mp1').y)});
      const wasMerge = nodes.get('mam').y;
      await carry('mp1', 260);                     // a parent, down into the merge
      out.parentHeldMerge = Math.abs(nodes.get('mam').y - wasMerge) < 0.5;
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(500);
    return out;
  });
  check('a text is folded only where the author folded it',
        rC.linesKept, String(rC.lineCount));
  check('and the words of a rippled entry keep clear of its border',
        rC.clearOfRipple, rC.rippleGaps);
  check('writing in a box sized by hand keeps the size it was given',
        rC.refitAfterEdit, JSON.stringify({hand:rC.handSize, after:rC.refitSize}));
  check('and words that need more room than it gives grow it',
        rC.grewForWords);
  check('a card has a middle band between its heading and its note',
        rC.mediumDrawn && rC.cardRules === 3,
        JSON.stringify({medium:rC.mediumDrawn, rules:rC.cardRules}));
  check('and a card sized by hand gives the room to its picture',
        rC.bandTookTheRoom, String(rC.handCardBand));
  check('a double click on a card’s picture shows no corners of its own, and nothing resizes it by them (15.11)',
        rC.picGrips === 0 && rC.picNoResizer, JSON.stringify({grips:rC.picGrips, gone:rC.picNoResizer}));
  check('a merge carried into its parents leaves them where they stand',
        !rC.mergePushedParent, rC.mergePushAt);
  check('and a parent carried into the merge leaves the merge where it stands',
        rC.parentHeldMerge);

  });

  await scenario("a ripple that keeps its size, corners by choice, a merge that moves whole", async () => {
  const rW = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(420, 280);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- a border style changes the size only by how far it reaches in.
       The words stand a pixel off the INSIDE of whatever border is drawn,
       and a ripple swings in by its amplitude, so a rippled box is exactly
       that much bigger on every side and not a hair more. ---- */
    {
      const sizes = {};
      for(const B of ['solid', 'wavy']){
        applyEdit(()=>{
          workingNodes.length = 0; refill(EDGE_STYLES, []);
          workingNodes.push(['wz', 'asdasdи and more', null, null, null, null,
                             {pos:[X, Y], colors:['#222', '#c3c'], border:B}]);
        });
        const n = nodes.get('wz');
        sizes[B] = [n.w, n.h];
      }
      out.wavySize = JSON.stringify(sizes);
      /* Since the owner's list of 31.10 the words stand a pixel off the
         ripple's CRESTS, not its troughs: a node no longer grows by the
         ripple's whole depth, only by the half pixel a side the border's
         own stroke reaches in past a plain one's. */
      const more = 2 * (textReachIn(nodes.get('wz')) - NODE_BORDER_W/2);
      out.wavySame = Math.abs(sizes.wavy[0] - sizes.solid[0] - more) < 0.03 &&
                     Math.abs(sizes.wavy[1] - sizes.solid[1] - more) < 0.03;
    }

    /* ---- a cap stops where the inner ring's STROKE begins ---- */
    {
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['wa', 'A', null, null, null, null, {pos:[X, Y], colors:['#222', '#c3c']}]);
        workingNodes.push(['wb', 'asdasdи', 'wa', null, null, null,
                           {pos:[X, Y + 160], colors:['#222', '#c3c'], border:'wavy'}]);
        refill(EDGE_STYLES, [{from:'wa', to:'wb', fromSide:'bottom', toSide:'top',
                              fromRing:1, toRing:0, arrow:false}]);
      });
      await wait(150);
      const cap = document.querySelector('.edge-cap[data-to="wb"]');
      const ref = cap && (cap.getAttribute('mask') || '').match(/#([^)]+)/);
      const mask = ref && document.getElementById(ref[1]);
      const cut = mask && mask.querySelector('path');
      out.capMasked = !!cut && cut.getAttribute('fill') === '#000' &&
        Math.abs(+cut.getAttribute('stroke-width') - 1.6) < 1e-6;
    }

    /* ---- square corners ---- */
    {
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['sqA', 'Square', null, null, null, null,
                           {pos:[X, Y], colors:['#222', '#c3c']}]);
        workingNodes.push(['sqB', 'Round', 'sqA', null, null, null,
                           {pos:[X + 260, Y + 160], square:false}]);
        workingNodes.push(['sqW', 'Wavy', 'sqA', null, null, null,
                           {pos:[X - 260, Y + 160], border:'wavy', square:true}]);
        workingNodes.push(['sqK', 'A remark', null, null, null, 'callout',
                           {pos:[X + 160, Y + 40], leader:{from:'sqA', to:'sqB', at:0.5}, square:false}]);
        refill(EDGE_STYLES, [{from:'sqA', to:'sqB', square:true, note:'hi'}]);
      });
      await wait(200);
      const rx = (id)=> [...document.querySelectorAll(`.node[data-id="${id}"] > rect[stroke]`)]
        .map(r=> +r.getAttribute('rx'));
      out.squareRx = JSON.stringify({A: rx('sqA'), B: rx('sqB'), K: rx('sqK')});
      out.squareBox = rx('sqA').length === 2 && rx('sqA').every(v=> v === 0) &&
                      rx('sqB').every(v=> v > 0);
      // A ripple keeps its own corners whatever the setting says.
      const wavyD = document.querySelector('.node[data-id="sqW"] > path').getAttribute('d');
      const nW = nodes.get('sqW');
      out.wavyIgnores = !hasSquareCorners(nW) && wavyD === wavyRectPath(nW.x, nW.y, nW.w, nW.h, 0);
      // The connector's corners square its elbows — and only its elbows.
      const line = document.querySelector('#edgeLayer path.edge.struct[data-from="sqA"][data-to="sqB"]');
      out.edgeSquare = !!line && !/Q/.test(line.getAttribute('d'));
      const plate = ()=> document.querySelector('.edge-note[data-from="sqA"] .edge-note-plate');
      /* A note's plate is square by default too (since 22.10), so the
         connector is rounded for a moment: what is checked is that the
         connector's own corners do not decide the plate's. */
      applyEdit(()=>{ EDGE_STYLES.find(x=> x.from === 'sqA' && x.to === 'sqB').square = false; });
      await wait(150);
      out.plateOwn = !!plate() && +plate().getAttribute('rx') === 0;
      applyEdit(()=>{ EDGE_STYLES.find(x=> x.from === 'sqA' && x.to === 'sqB').square = true; });
      await wait(150);
      out.calloutOwn = rx('sqK').length > 0 && rx('sqK').every(v=> v > 0);
      /* Square is the default since 0.12.0, so what the file carries is
         the exception: a rounded connector writes square:false, one that
         never said writes nothing about its corners at all (and an old
         square:true is written back as it was, so an untouched region is
         untouched). */
      const one = (sq)=> serializeEdgeStyles([{from:'a', to:'b', routing:'orthogonal', dash:'solid',
                                               arrow:true, square:sq}]);
      out.serialized = /square:false/.test(one(false)) && !/square:/.test(one(undefined));
      /* …and the bar over a hovered entry sets them. */
      const bar = document.getElementById('styleBar');
      const press = (group, value)=> bar.querySelector(
        `.style-bar-group[data-group="${group}"] button[data-value="${value}"]`).click();
      openStyleBar({kind:'node', id:'sqB'});
      out.barShown = !bar.hidden &&
        !bar.querySelector('[data-group="border"]').hidden && bar.querySelector('[data-group="frame"]').hidden;
      press('corners', 'round');
      await wait(150);
      /* One button: lit is rounded, and pressing it lit makes it square —
         which is the default, so the flag goes away. */
      out.panelWrites = !('square' in entryOpts(workingEntry('sqB').entry)) && rx('sqB').every(v=> v === 0);
      press('border', 'wavy');
      await wait(150);
      out.panelGreys = borderStyleOf(nodes.get('sqB')) === 'wavy' &&
        [...bar.querySelectorAll('[data-group="corners"] button')].every(b=> b.disabled);
      // A callout chooses its own, pinned or not.
      openStyleBar({kind:'node', id:'sqK'});
      press('corners', 'round');
      await wait(150);
      out.calloutSquares = rx('sqK').length > 0 && rx('sqK').every(v=> v === 0) &&
        !('noteSquare' in (EDGE_STYLES.find(x=> x.from === 'sqA' && x.to === 'sqB') || {}));
      // A note's plate is square until it is rounded (the owner's ask, 22.10).
      out.noteSquareByDefault = !!plate() && +plate().getAttribute('rx') === 0;
      // And a note chooses its frame and its corners.
      openStyleBar({kind:'note', from:'sqA', to:'sqB'});
      out.noteBar = bar.querySelector('[data-group="border"]').hidden &&
        !bar.querySelector('[data-group="frame"]').hidden;
      /* Corners first: with the frame off there are none to choose, and
         the buttons are greyed (the owner's rule) — the rounded ones are
         kept for when the frame comes back. Square is the default, so the
         press rounds it, and only that is written down. */
      press('corners', 'round');
      // The frame is one button, lit while there is one: pressed, it goes.
      out.frameOneButton = bar.querySelectorAll('[data-group="frame"] button').length === 1 &&
        bar.querySelector('[data-group="frame"] button').classList.contains('on');
      press('frame', 'frame');
      await wait(150);
      out.noteBare = out.frameOneButton && !!plate() && plate().classList.contains('bare') && !plate().style.stroke &&
        +plate().getAttribute('rx') > 0 &&
        /noteFrame:false/.test(serializeEdgeStyles(EDGE_STYLES)) &&
        /noteSquare:false/.test(serializeEdgeStyles(EDGE_STYLES));
      // A portrait's corners are its card's.
      applyEdit(()=> workingNodes.push(['sqP', 'Portrait', null, null, null, 'ellipse',
                                        {pos:[X + 500, Y], square:true}]));
      await wait(150);
      openBioCard('sqP');
      const cardRect = document.querySelector('.bio-card-g[data-id="sqP"] rect');
      out.bioSquare = !!cardRect && +cardRect.getAttribute('rx') === 0;
      openStyleBar({kind:'node', id:'sqP'});
      out.bioOffered = [...bar.querySelectorAll('[data-group="corners"] button')].every(b=> !b.disabled) &&
        !bar.querySelector('[data-group="border"] button[data-value="wavy"]').disabled;
      closeStyleBar();
      closeBioCard();
      deselect();
      await wait(100);
    }

    /* ---- the bar gives way in whole steps, and only when it must ---- */
    {
      const bars = [];
      for(let k = 0; k <= 9; k++){
        applyEdit(()=>{
          workingNodes.length = 0; refill(EDGE_STYLES, []);
          for(let i = 0; i < 4; i++)
            workingNodes.push(['bp' + i, 'Beast Wars: Uprising', null, null, null, null,
                               {pos:[X + i * 150, Y]}]);
          workingNodes.push(['bm', 'Beast Wars: Uprising', ['bp0','bp1','bp2','bp3'],
                             null, null, null, {merge:true, pos:[X + 220, Y + 150 - k * 10]}]);
        });
        const n = nodes.get('bm'), bar = amalgamBars.get('bm');
        bars.push({entry: n.y, bar: bar.cross, gap: n.y - bar.cross});
      }
      const steps = bars.slice(1).map((b, i)=> +(bars[i].bar - b.bar).toFixed(3));
      out.barSteps = JSON.stringify(bars.map(b=> [b.entry, b.bar]));
      /* Every move is nothing or a whole grid step, and the bar does not
         move while the arrow still has its room. */
      out.barWhole = steps.every(d=> d === 0 || Math.abs(d - GRID) < 1e-6);
      out.barWaits = bars.every((b, i)=> i === 0 || steps[i-1] === 0 ||
                                bars[i-1].entry - 10 - bars[i-1].bar < AMALGAM_GAP);
    }

    /* ---- an entry carried up to a merge's lineage moves nothing else ---- */
    {
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['mx', 'Outsider', null, null, null, null, {pos:[X, Y - 160]}]);
        for(let i = 0; i < 4; i++)
          workingNodes.push(['mw' + i, 'Parent ' + i, i === 0 ? 'mx' : i === 2 ? 'mw1' : null,
                             null, null, null, {pos:[X + i * 150, Y]}]);
        workingNodes.push(['mm', 'Merge of every one', ['mw0','mw1','mw2','mw3'], null, null,
                           null, {merge:true, pos:[X + 200, Y + 160]}]);
        // A bend set by hand on a connector the merge carries whole.
        refill(EDGE_STYLES, [{from:'mw1', to:'mw2', bends:[[X + 285, Y + 110]]}]);
      });
      await wait(400);
      const at = ()=> Object.fromEntries(['mx','mw0','mw1','mw2','mw3','mm']
        .map(id=> [id, [nodes.get(id).x, nodes.get(id).y]]));
      const carry = async (id, dy)=>{
        const g = document.querySelector('.node[data-id="' + id + '"]');
        const r = g.getBoundingClientRect();
        const sx = r.x + r.width/2, sy = r.y + r.height/2;
        g.dispatchEvent(new MouseEvent('mousedown',
          {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
        for(let k = 1; k <= 12; k++){
          window.dispatchEvent(new MouseEvent('mousemove',
            {bubbles:true, clientX:sx, clientY: sy + (dy/12) * k}));
          await wait(14);
        }
        window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        await wait(400);
      };
      const was = at();
      await carry('mx', 150 * vs);
      const now = at();
      const dys = ['mw0','mw1','mw2','mw3','mm'].map(id=> now[id][1] - was[id][1]);
      out.wholeMerge = JSON.stringify(dys);
      out.wholeMoved = dys.every(d=> Math.abs(d) < 1e-6);
      const bend = (EDGE_STYLES.find(o=> o.from === 'mw1' && o.to === 'mw2') || {}).bends;
      out.bendAt = JSON.stringify(bend);
      out.bendCarried = !!bend && bend.length === 1 &&
        Math.abs(bend[0][0] - (X + 285)) < 1e-6 && Math.abs(bend[0][1] - (Y + 110)) < 1e-6;
      // Carried from the inside, the row stays where it is.
      const was2 = at();
      await carry('mm', -200 * vs);
      const now2 = at();
      const ups = ['mw0','mw1','mw2','mw3'].map(id=> now2[id][1] - was2[id][1]);
      out.rowUp = JSON.stringify(ups);
      out.rowMoved = ups.every(d=> Math.abs(d) < 1e-6);
    }

    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    refill(EDGE_STYLES, beforeStyles); });
    await wait(300);
    return out;
  });
  check('a wavy border makes the entry bigger only by the depth of its ripple', rW.wavySame, rW.wavySize);
  check('a cap over an inner ring stops where that ring’s stroke begins', rW.capMasked);
  check('square corners, the default, square the box and every ring of it', rW.squareBox, rW.squareRx);
  check('a wavy border keeps its rounded corners whatever the setting says', rW.wavyIgnores);
  check('a square connector has no rounded elbows', rW.edgeSquare);
  check('but its note and its callout keep their own', rW.plateOwn && rW.calloutOwn, rW.squareRx);
  check('the corners are written into the saved chart', rW.serialized);
  check('the bar over an entry offers its border and its corners', rW.barShown);
  check('and sets square corners', rW.panelWrites);
  check('and greys the choice while the border is wavy', rW.panelGreys);
  check('a callout squares its own corners, whatever its connector has', rW.calloutSquares);
  check('a note’s bar offers a frame and corners instead', rW.noteBar);
  check('a note\'s plate is square until it is rounded', rW.noteSquareByDefault);
  check('and a note can go bare and rounded, and is saved so', rW.noteBare);
  check('a portrait’s corners square its card', rW.bioSquare);
  check('and the bar offers them there, and the ripple', rW.bioOffered);
  check('the merge’s bar moves in whole grid steps or not at all', rW.barWhole, rW.barSteps);
  check('and stays put while the merged arrow still has its room', rW.barWaits, rW.barSteps);
  check('an outsider carried up to a lineage leaves the whole merge where it stands',
        rW.wholeMoved, rW.wholeMerge);
  check('a merge carried into its lineages leaves them where they stand', rW.rowMoved, rW.rowUp);
  check('and the bends set by hand between its members stay where they were set',
        rW.bendCarried, rW.bendAt + ' after ' + rW.wholeMerge);
  });

  await scenario("colours that are colours, and a form that offers corners", async () => {
  const rC = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const beforeRef = SETTINGS.refColor;
    const w0 = clientToWorld(420, 280);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();
    /* A colour is a hex value wherever it is READ. A chart arrives from a
       file, from storage and from a hand-edited data.js, and escaping kept
       a colour inside its attribute but not inside its declaration. */
    const bad = 'red;background:url(https://example.org/x.png)';
    applyEdit(()=>{
      workingNodes.length = 0;
      workingNodes.push(['hx', 'Hex', null, null, null, null,
                         {pos:[X, Y], colors:[bad, '#123456'], bg:[bad]}]);
      workingNodes.push(['hy', 'Other', 'hx', null, null, null, {pos:[X, Y + 160]}]);
      refill(EDGE_STYLES, [{from:'hx', to:'hy', color:bad, noteBg:bad, gradient:[bad, '#fff']}]);
      SETTINGS.refColor = bad;
    });
    await wait(150);
    const n = nodes.get('hx'), st = edgeStyleFor('hx', 'hy');
    out.nodeColors = JSON.stringify([n.colors, n.color, n.bg]);
    out.nodeClean = JSON.stringify(n.colors) === '["#123456"]' && n.color === '#123456' && n.bg === null;
    out.edgeClean = st.color === null && st.noteBg === null && st.gradient === null;
    out.refClean = refColor() === DEFAULT_REF_COLOR;
    out.noUrl = !/example\.org/.test(document.body.innerHTML);

    /* Square is the default: an entry made with the + has square corners
       and records nothing to say so. */
    const ids = new Set(workingNodes.map(it=> it[0]));
    document.querySelector('#addFabStyles .node-style-btn[data-value="rect"]').click();
    await wait(150);
    closeNodeEditor();
    const made = workingNodes.find(it=> !ids.has(it[0]));
    out.formWrites = !!made && !(made[6] && 'square' in made[6]) && hasSquareCorners(nodes.get(made[0]));

    /* A callout carried along its connector round a bend keeps to the same
       hand of the line: on the left of a line going down is below it once
       the line has turned to go left — and as far clear of it as it was. */
    applyEdit(()=>{
      workingNodes.length = 0;
      workingNodes.push(['ca', 'Alpha', null, null, null, null, {pos:[X + 400, Y]}]);
      workingNodes.push(['cb', 'Beta', 'ca', null, null, null, {pos:[X, Y + 300]}]);
      refill(EDGE_STYLES, [{from:'ca', to:'cb', fromSide:'bottom', toSide:'right'}]);
      workingNodes.push(['ck', 'remark', null, null, null, 'callout',
                         {pos:[X + 520, Y + 120], leader:{from:'ca', to:'cb', at:0.1}}]);
    });
    await wait(200);
    const route = drawnRoutes.get(calloutEdgeKey('ca', 'cb')).pts;
    const toClient = (p)=>{
      const sr = svg.getBoundingClientRect();
      return {x: sr.left + p.x * vs + vx, y: sr.top + p.y * vs + vy};
    };
    const k0 = nodes.get('ck'), a0 = pointAtFraction(route, 0.1);
    // Clearance from the line to the card's near edge, before.
    const gap0 = (k0.x) - a0.x;
    const hit = document.querySelector('.leader-dot-hit[data-id="ck"]');
    const s0 = toClient(a0);
    hit.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0,
                                                    clientX:s0.x, clientY:s0.y}));
    for(let k = 1; k <= 20; k++){
      const c = toClient(pointAtFraction(route, 0.1 + 0.7 * k / 20));
      window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:c.x, clientY:c.y}));
      await wait(10);
    }
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    await wait(200);
    const k1 = nodes.get('ck'), a1 = pointAtFraction(route, k1.leader.at);
    out.turned = JSON.stringify({gap0, at: k1.leader.at, dir:[a1.dx, a1.dy],
                                 top: k1.y - a1.y, dot: a1.y});
    out.keptHand = a0.dy > 0.9 && gap0 > 0 && a1.dx < -0.9 &&
                   Math.abs((k1.y - a1.y) - gap0) < 1e-6;

    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    refill(EDGE_STYLES, beforeStyles); SETTINGS.refColor = beforeRef; });
    await wait(300);
    return out;
  });
  check('a colour that is not hex is dropped from an entry', rC.nodeClean, rC.nodeColors);
  check('and from a connector, its note ground and its gradient', rC.edgeClean);
  check('and from the citation colour', rC.refClean);
  check('and never reaches the drawing', rC.noUrl);
  check('an entry made with the + is square without saying so', rC.formWrites);
  check('a callout carried round a bend keeps to the same hand of its line, as far clear',
        rC.keptHand, rC.turned);
  });

  await scenario("the tags and the references say why", async () => {
  const rM = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeRefs = REFS.map(r=> Object.assign({}, r));
    const beforeCats = JSON.stringify(TAG_CATS);
    /* A refusal is said in the top bar. Both of the panel's messages went
       into a status line the page no longer has, so it was dropped. */
    const st = document.getElementById('saveState');
    out.statusExists = !!st;
    createTag('A tag nobody has');
    createTag('A tag nobody has');
    out.dupShown = !!st && st.classList.contains('err') && /already exists/.test(st.textContent);
    /* A bad link typed over a good one keeps the good one. */
    const realAsk = askFields;
    try{
      applyEdit(()=> REFS.push({key:'rqTest', title:'', detail:'A source', url:'https://example.org/'}));
      window.askFields = async ()=> ({detail:'A source', url:'javascript:alert(1)'});
      await editRef('rqTest');
      const r = REFS.find(x=> x.key === 'rqTest');
      out.keptLink = !!r && r.url === 'https://example.org/' && !('refused' in r);
      out.refusalShown = /not saved/.test(st ? st.textContent : '');
    } finally { window.askFields = realAsk; }
    applyEdit(()=>{
      REFS.length = 0; beforeRefs.forEach(r=> REFS.push(r));
      const cats = JSON.parse(beforeCats);
      TAG_CATS.length = 0; cats.forEach(c=> TAG_CATS.push(c));
    });
    refreshSaveUI();
    await wait(100);
    return out;
  });
  check('a name that is taken is refused out loud', rM.statusExists && rM.dupShown);
  check('a bad link typed over a good one keeps the good one', rM.keptLink);
  check('and says the link was not saved', rM.refusalShown);
  });

  /* ---- a phone ---- */
  /* Its own browser context, because a phone is a different device and not
     a different size of this one: touch events exist, the page is laid out
     for 390 pixels, and the first touch is what puts the page into its
     finger mode. Every gesture is sent as raw touch points through the
     protocol rather than through Playwright's tap(), which can only tap —
     and a phone that could only tap is what this scenario is about. */
  await scenario("a phone: a bar that fits, and a finger that carries", async () => {
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    const cdp = await phone.newCDPSession(pp);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent',
      {type, touchPoints: pts.map(([x, y], i)=> ({x, y, id: i, radiusX: 2, radiusY: 2}))});
    /* A finger put down, walked in steps, and lifted — optionally held
       still for a while first, which is what a hold is. */
    async function swipe(from, to, opts){
      opts = opts || {};
      await touch('touchStart', from);
      if(opts.hold) await wait(opts.hold);
      const steps = opts.steps || 8;
      for(let s = 1; s <= steps; s++){
        await touch('touchMove', from.map(([x, y], i)=> [x + (to[i][0] - x) * s / steps,
                                                         y + (to[i][1] - y) * s / steps]));
        await wait(16);
      }
      await touch('touchEnd', []);
      await wait(120);
    }
    async function tap(x, y, hold){
      await touch('touchStart', [[x, y]]);
      await wait(hold || 40);
      await touch('touchEnd', []);
      await wait(60);
    }

    const bar = await pp.evaluate(()=>{
      const kids = [...document.querySelectorAll('.topbar > *')]
        .filter(e=> getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
      const off = kids.filter(e=>{ const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 0.5; })
        .map(e=> e.id || e.className);
      const btns = [...document.querySelectorAll('.topbar > .icon-btn')].filter(e=> getComputedStyle(e).display !== 'none');
      return {off, scroll: document.documentElement.scrollWidth, width: innerWidth,
              rows: new Set(btns.map(b=> Math.round(b.getBoundingClientRect().top))).size,
              /* The working keys on the left, the account, Save and the
                 language on the right (the owner's list of 22.11, evening). */
              left: Math.max(...btns.map(b=> b.getBoundingClientRect().right)) <=
                    Math.min(...['.tb-account', '.save-btn'].map(q=> document.querySelector(q))
                      .filter(e=> e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0)
                      .map(e=> e.getBoundingClientRect().left)) + 0.5,
              search: document.getElementById('searchInput').getBoundingClientRect().width};
    });
    check('every control in the bar is on the screen', bar.off.length === 0, bar.off.join(', '));
    check('the page is no wider than the phone', bar.scroll <= bar.width, `${bar.scroll} > ${bar.width}`);
    check('the working keys stand in two rows at most, left of the account and Save', bar.rows <= 2 && bar.left, JSON.stringify(bar));
    check('the search has room to be typed in', bar.search >= 120, `${bar.search}px`);
    // The view's place is shown on a phone too, on the screen and clear of the add button.
    const coord = await pp.evaluate(()=>{
      const c = document.querySelector('.coord'), r = c.getBoundingClientRect();
      const fab = document.querySelector('.add-fab'), f = fab ? fab.getBoundingClientRect() : null;
      const hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return {shown: getComputedStyle(c).display !== 'none' && r.width > 0,
              inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
              clear: !f || r.right <= f.left || r.bottom <= f.top,
              onTop: !!(hit && hit.closest('.coord'))};
    });
    check('the coordinates are on a phone\'s screen, clear of the add button',
          coord.shown && coord.inside && coord.clear && coord.onTop, JSON.stringify(coord));

    const tabAt = (id)=> pp.evaluate((id)=>{ const r = document.getElementById(id).getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; }, id);
    await tap(...await tabAt('tagsTab'));
    await wait(300);
    const panel = await pp.evaluate(()=>{
      const body = document.querySelector('#tagsPanel .side-tab-body').getBoundingClientRect();
      const other = document.getElementById('refsTab').getBoundingClientRect();
      const at = document.elementFromPoint(other.x + other.width/2, other.y + other.height/2);
      return {open: document.getElementById('tagsPanel').classList.contains('open'),
              left: body.left, right: body.right,
              otherTabFree: !!(at && at.closest('#refsTab'))};
    });
    /* As wide as on a wide screen: across the whole phone was the bug the
       owner named on 26.11. */
    check('a tab opens on a phone as wide as on a wide screen, and the other tab is still there to press',
          panel.open && panel.left >= 0 && panel.right <= 390 && panel.right - panel.left <= 253 && panel.right - panel.left > 200 && panel.otherTabFree,
          JSON.stringify(panel));
    await tap(...await tabAt('tagsTab'));
    await wait(250);

    /* Two entries at a known place, the view at a known zoom. */
    const at = await pp.evaluate(async ()=>{
      applyEdit(()=>{
        /* On a chart of their own: the shipped chart has entries round this
           place, and a gesture meant for open paper landed on one of
           them as soon as the boxes closed onto their words and moved. */
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        /* Both above the entry drawer, which opens over the lower half. */
        workingNodes.push(['tpA', 'Touch A', null, null, null, 'rect', {pos:[100, 60]}]);
        workingNodes.push(['tpB', 'Touch B', null, null, null, 'rect', {pos:[100, 220]}]);
      });
      await new Promise(r=> setTimeout(r, 120));
      deselect();
      vs = 1; vx = 20; vy = 20; applyTransform();
      /* The entry's own box, not its group's: the group also holds the
         hit strips along its borders, which reach out past the box on
         some sides and not others, so the group's middle is not the box's
         — and on a box closed a pixel off one line of words, the
         difference was enough to land the finger on a border strip. */
      const box = id=>{ const n = nodes.get(id), m = viewport.getScreenCTM();
                        return [m.a*(n.x + n.w/2) + m.e, m.d*(n.y + n.h/2) + m.f, n.w*m.a, n.h*m.d]; };
      return {a: box('tpA'), b: box('tpB'), touchClass: document.body.classList.contains('touch-input')};
    });
    check('a touch puts the page in its finger mode', at.touchClass);

    await tap(at.a[0], at.a[1]);
    await wait(300);
    eq('a tap selects the entry under it', await pp.evaluate(()=> selectedId), 'tpA');

    /* The style bar is offered on hover, and a finger does not hover: a
       tap has to leave it standing, on the screen, and its buttons have to
       answer a tap. */
    const sb = await pp.evaluate(()=>{
      const b = document.getElementById('styleBar');
      const r = b.getBoundingClientRect();
      const face = b.querySelector('[data-group="border"] .style-bar-drop-face').getBoundingClientRect();
      return {shown: !b.hidden, left: r.left, right: r.right, at: [face.x + face.width/2, face.y + face.height/2]};
    });
    check('a tap on an entry leaves its style bar open, on the screen',
          sb.shown && sb.left >= 0 && sb.right <= 390, JSON.stringify(sb));
    // The border is a menu: a tap unfolds it, and a tap on a choice sets it.
    await pp.touchscreen.tap(sb.at[0], sb.at[1]);
    await wait(150);
    const pick = await pp.evaluate(()=>{
      const r = document.querySelector('#styleBar [data-group="border"] button[data-value="dashed"]').getBoundingClientRect();
      return [r.x + r.width/2, r.y + r.height/2, r.height];
    });
    check('…a tap on the border unfolds its choices', pick[2] > 0, JSON.stringify(pick));
    await pp.touchscreen.tap(pick[0], pick[1]);
    await wait(250);
    eq('…and a tap on the bar restyles the entry',
       await pp.evaluate(()=> (entryOpts(workingEntry('tpA').entry) || {}).border), 'dashed');

    const ax0 = await pp.evaluate(()=> nodes.get('tpA').x);
    await swipe([[at.a[0], at.a[1]]], [[at.a[0] + 80, at.a[1]]]);
    const carried = await pp.evaluate(()=> ({x: nodes.get('tpA').x, vx}));
    check('one finger on an entry carries the entry', carried.x - ax0 > 50, `moved ${carried.x - ax0}`);
    eq('…and leaves the view where it was', carried.vx, 20);

    /* With nothing selected, so the entry's drawer is not over the canvas,
       and the chart moved well out of the way, so the finger lands on paper. */
    /* Asked as what is under the finger, before and after: the top bar may
       step aside as the chart is carried up, and the view takes up the
       height it gives so that this stays true (followWithPhoneBar). */
    const panFrom = await pp.evaluate(()=>{ deselect(); vx = 20000; vy = 20000; applyTransform(); return clientToWorld(300, 640); });
    await wait(300);
    await swipe([[300, 640]], [[240, 600]]);
    const panned = await pp.evaluate(()=> clientToWorld(240, 600));
    check('one finger on open canvas pans', Math.abs(panned.x - panFrom.x) < 2 && Math.abs(panned.y - panFrom.y) < 2,
          JSON.stringify({panFrom, panned}));

    /* Spread about a point; the world under it must stay under it. */
    const mid = [200, 500];
    const before = await pp.evaluate(([x, y])=> clientToWorld(x, y), mid);
    await swipe([[mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]]], [[mid[0] - 60, mid[1]], [mid[0] + 60, mid[1]]]);
    const pinched = await pp.evaluate(([x, y])=> ({vs, w: clientToWorld(x, y)}), mid);
    check('two fingers spread zoom in', Math.abs(pinched.vs - 2) < 0.05, `z${pinched.vs}`);
    check('…about the point between them', Math.abs(pinched.w.x - before.x) < 1 && Math.abs(pinched.w.y - before.y) < 1,
          JSON.stringify({before, after: pinched.w}));

    /* Two taps on open paper zoom in by two about the place tapped, and
       from as far in as the chart goes they go back out to all of it. */
    {
      await pp.evaluate(()=>{ vs = 1; vx = 20000; vy = 20000; applyTransform(); });
      const spot = [220, 560];
      const w0 = await pp.evaluate(([x, y])=> clientToWorld(x, y), spot);
      await tap(...spot); await tap(...spot);
      await wait(400);
      const inz = await pp.evaluate(([x, y])=> ({vs, w: clientToWorld(x, y)}), spot);
      check('two taps on open paper zoom in by two, about the place tapped',
            Math.abs(inz.vs - 2) < 0.01 && Math.abs(inz.w.x - w0.x) < 1 && Math.abs(inz.w.y - w0.y) < 1,
            JSON.stringify({w0, inz}));
      await pp.evaluate(()=>{ vs = 3; applyTransform(); });
      await wait(400);
      await tap(...spot); await tap(...spot);
      await wait(400);
      const outz = await pp.evaluate(()=>{ const v = {vs, vx, vy}; fitToView(); return {v, fit: {vs, vx, vy}}; });
      check('…and from all the way in, back out to the whole chart',
            Math.abs(outz.v.vs - outz.fit.vs) < 0.01 && Math.abs(outz.v.vx - outz.fit.vx) < 1,
            JSON.stringify(outz));
    }

    /* Back to the known view for the rest. */
    const pos = await pp.evaluate(async ()=>{
      vs = 1; vx = 20; vy = 20; applyTransform();
      selectNode('tpA'); paintMultiSelection();
      await new Promise(r=> setTimeout(r, 60));
      const box = id=>{ const r = document.querySelector(`#nodeLayer [data-id="${id}"]`).getBoundingClientRect();
                        return [r.x + r.width/2, r.y + r.height/2]; };
      return {a: box('tpA'), b: box('tpB')};
    });
    await tap(pos.b[0], pos.b[1], 650);
    await wait(300);
    const multi = await pp.evaluate(()=> [...multiSelection].sort());
    eq('a held tap adds to the selection, as Ctrl-click does', JSON.stringify(multi), JSON.stringify(['tpA', 'tpB']));

    /* A connector, drawn from the bottom band of a selected entry. */
    await pp.evaluate(()=>{ deselect(); selectNode('tpA'); paintMultiSelection(); });
    const band = await pp.evaluate(()=>{
      const h = document.querySelector('#nodeLayer [data-id="tpA"] .node-handle[data-side="bottom"] .node-handle-hit');
      if(!h) return null;
      const r = h.getBoundingClientRect();
      return {at: [r.x + r.width/2, r.y + r.height/2], live: getComputedStyle(h.closest('.node-handles') || h).pointerEvents};
    });
    check('a selected entry offers its connector bands to a finger', !!band && band.live !== 'none', JSON.stringify(band));
    if(band){
      await swipe([band.at], [[pos.b[0], pos.b[1]]], {steps: 12});
      const linked = await pp.evaluate(()=> {
        const b = workingNodes.find(n=> n[0] === 'tpB');
        return JSON.stringify(b).includes('tpA');
      });
      check('dragging from the band to another entry connects them', linked);
    }

    /* A hold on open paper is Shift: the drag that follows draws the
       selection box instead of panning. */
    await pp.evaluate(()=>{ deselect(); });
    await wait(300);
    const vxHeld = await pp.evaluate(()=> vx);
    await swipe([[pos.a[0] - 90, pos.a[1] - 30]], [[pos.b[0] + 90, pos.b[1] + 30]], {hold: 650, steps: 10});
    const boxed = await pp.evaluate(()=> ({sel: [...multiSelection].sort(), vx}));
    check('a hold on open paper, then a drag, selects what the box covers',
          boxed.sel.includes('tpA') && boxed.sel.includes('tpB'), JSON.stringify(boxed.sel));
    eq('…without panning', boxed.vx, vxHeld);

    /* A pinch whose first finger lands on an entry is still a pinch: the
       entry is not picked up by the finger that arrived first. */
    const onEntry = await pp.evaluate(()=> ({x: nodes.get('tpB').x, vs}));
    await swipe([[pos.b[0], pos.b[1]], [pos.b[0] + 60, pos.b[1] + 60]],
                [[pos.b[0] - 30, pos.b[1] - 30], [pos.b[0] + 90, pos.b[1] + 90]]);
    const afterPinch = await pp.evaluate(()=> ({x: nodes.get('tpB').x, vs}));
    check('a pinch that starts on an entry zooms', afterPinch.vs > onEntry.vs * 1.5, JSON.stringify(afterPinch));
    eq('…and leaves the entry where it was', afterPinch.x, onEntry.x);
    await pp.evaluate(()=>{ vs = 1; vx = 20; vy = 20; applyTransform(); deselect(); });
    await wait(300);

    /* One tap is one click: the browser's own late mouse events for the
       same touch would make it two, and two clicks are a double. */
    await tap(pos.a[0], pos.a[1]);
    await wait(450);
    eq('a single tap does not open the entry for writing', await pp.evaluate(()=> (nodeEditorTarget && nodeEditorTarget.id) || null), null);
    await pp.evaluate(()=> deselect());
    await wait(400);

    /* Two taps in quick succession write on the entry. */
    /* Sent back to back: the window for a double is a third of a second,
       and a loaded machine spends a good part of that on the round trips. */
    for(let k = 0; k < 2; k++){
      await touch('touchStart', [[pos.a[0], pos.a[1]]]);
      await touch('touchEnd', []);
    }
    await wait(350);
    const editing = await pp.evaluate(()=> nodeEditorTarget && nodeEditorTarget.id);
    eq('a double tap opens the entry for writing', editing, 'tpA');
    /* …with its toolbar under the field, clear of the menu the phone
       puts above words picked out with a finger, and of its handles. */
    const under = await pp.evaluate(()=>{
      const bar = document.getElementById('nodeEditorBar').getBoundingClientRect();
      const field = richFields.get('nodeEditorText').surface.getBoundingClientRect();
      return {gap: Math.round(bar.top - field.bottom), cls: nodeEditor.classList.contains('bar-under')};
    });
    check('on a phone the text toolbar stands under the field, past the selection handles',
          under.cls && under.gap >= 24, JSON.stringify(under));

    /* A picked set glows, but not while a finger moves the view: every
       shadow is repainted on every frame of a pan. */
    {
      await pp.evaluate(async ()=>{ closeNodeEditor(true); setSelection(['tpA', 'tpB']);
        await new Promise(r=> setTimeout(r, 250)); });
      const glow = ()=> pp.evaluate(()=>{
        const r = document.querySelector('#nodeLayer [data-id="tpA"] > rect:not(.node-hover-pad)');
        return getComputedStyle(r).filter;
      });
      const still = await glow();
      await touch('touchStart', [[200, 760]]);
      for(let s = 1; s <= 4; s++){ await touch('touchMove', [[200 + s * 10, 760]]); await wait(16); }
      const moving = await glow();
      await touch('touchEnd', []);
      await wait(400);
      const after = await glow();
      check('a picked set\u2019s glow is put aside while a finger moves the view, and comes back',
            /drop-shadow/.test(still) && moving === 'none' && after === still,
            JSON.stringify({still, moving, after}));
      await pp.evaluate(()=> deselect());
    }

    /* A reader cannot carry an entry, so under a finger a drag that starts
       on one pans instead of doing nothing. */
    const reader = await pp.evaluate(async ()=>{
      if(typeof closeNodeEditor === 'function') closeNodeEditor(true);
      deselect(); markReadOnly();
      vs = 1; vx = 20; vy = 20; applyTransform();
      await new Promise(r=> setTimeout(r, 300));
      const r = document.querySelector('#nodeLayer [data-id="tpA"]').getBoundingClientRect();
      const at = [r.x + r.width/2, r.y + r.height/2];
      return {at, x: nodes.get('tpA').x, w: clientToWorld(at[0], at[1])};
    });
    await swipe([reader.at], [[reader.at[0] + 50, reader.at[1] + 30]]);
    const read = await pp.evaluate((to)=>{ const out = {w: clientToWorld(to[0], to[1]), x: nodes.get('tpA').x}; markEditable(); return out; },
                                   [reader.at[0] + 50, reader.at[1] + 30]);
    check('a reader dragging on an entry pans the chart',
          Math.abs(read.w.x - reader.w.x) < 2 && Math.abs(read.w.y - reader.w.y) < 2, JSON.stringify({was: reader.w, read}));
    eq('…and the entry stays put', read.x, reader.x);
    await wait(300);

    await pp.evaluate(async ()=>{
      if(typeof closeNodeEditor === 'function') closeNodeEditor(true);
      applyEdit(()=>{
        for(const id of ['tpA', 'tpB']){
          const i = workingNodes.findIndex(n=> n[0] === id);
          if(i >= 0) workingNodes.splice(i, 1);
        }
        for(let i = EDGE_STYLES.length - 1; i >= 0; i--)
          if(EDGE_STYLES[i].from === 'tpA' || EDGE_STYLES[i].to === 'tpB') EDGE_STYLES.splice(i, 1);
      });
    });
  } finally {
    await phone.close();
  }
  });

  await scenario("a bend that does not hook, and a pixel round the words", async () => {
  const rP = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();

    /* ---- a hand bend beside the box it leads into ----
       A bend a few pixels above the target's top, off to one side of it,
       used to be reached level and then climbed up to the stub, so the
       line arrived travelling AWAY from the box and turned straight back
       down the run-out into the port: a hook at the corner. Same at the
       source, and for a bend level with the box's middle, which went
       round on a lane a pixel short of the stub. No route may double back
       on itself, at a stub or anywhere. */
    const doubles = (pts)=>{
      for(let i = 1; i < pts.length - 1; i++){
        const a = pts[i-1], b = pts[i], c = pts[i+1];
        const ux = b.x - a.x, uy = b.y - a.y, vx2 = c.x - b.x, vy2 = c.y - b.y;
        const cross = Math.abs(ux * vy2 - uy * vx2), dot = ux * vx2 + uy * vy2;
        if(cross < 0.5 && dot < -0.25) return true;
      }
      return false;
    };
    /* The boxes' tops come out near y 203 and their stubs near 188, so
       199 is between a stub and its border — and more than a grid step
       off the stub, which would otherwise square it away. */
    const cases = {
      beside: [[30, 199]],
      lowAndLeft: [[-40, 150], [150, 199]],
      levelWithIt: [[-40, 150], [150, 210]],
      pastIt: [[-40, 150], [320, 199]]
    };
    out.hooks = {};
    for(const [name, bends] of Object.entries(cases)){
      applyEdit(()=>{
        workingNodes.length = 0; refill(EDGE_STYLES, []);
        workingNodes.push(['hkA', 'dasdи', null, null, null, null, {pos:[0, 200], border:'wavy'}]);
        workingNodes.push(['hkB', 'asdasd[1]', 'hkA', null, null, null, {pos:[200, 200], border:'wavy'}]);
        EDGE_STYLES.push({from:'hkA', to:'hkB', routing:'orthogonal',
                          fromSide:'top', toSide:'top', bends});
      });
      await wait(120);
      const rec = drawnRoutes.get(calloutEdgeKey('hkA', 'hkB'));
      const pts = rec ? rec.pts : [];
      const b = nodes.get('hkB');
      const last = pts[pts.length - 2];
      out.hooks[name] = {doubles: doubles(pts),
                         // the last run comes DOWN into the top port
                         intoTop: !!last && Math.abs(last.x - pts[pts.length-1].x) < 0.5 && last.y < b.y};
    }
    out.noHooks = Object.values(out.hooks).every(h=> !h.doubles && h.intoTop);

    /* ---- a pixel round the words, on everything that holds words ---- */
    const gaps = (box, ink)=> ({
      left: +(ink.x - box.x).toFixed(2), right: +(box.x + box.w - ink.x - ink.width).toFixed(2),
      top: +(ink.y - box.y).toFixed(2), bottom: +(box.y + box.h - ink.y - ink.height).toFixed(2)});
    const even = (g, want)=> ['left','right','top','bottom'].every(k=> Math.abs(g[k] - want) < 0.05);
    const rules = (t)=> [...t.parentNode.querySelectorAll(':scope > .text-underline')];
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      /* A rule under letters with no descenders is the lowest ink there is.
         Rounded on purpose, all of these: square is the default, and a
         round corner is the case that can come near the words. */
      workingNodes.push(['pxU', '{{u:double|ace}} mum', null, null, null, null, {pos:[0, 0], square:false}]);
      workingNodes.push(['pxD', 'double [[rim|reading]]', null, null, null, null, {pos:[0, 80], border:'double', square:false}]);
      // Ink right out in every corner of its box: the case a round corner meets first.
      workingNodes.push(['pxR', '[PH]', null, null, null, null, {pos:[0, 160], square:false}]);
      workingNodes.push(['pxA', 'from', null, null, null, null, {pos:[300, 0]}]);
      workingNodes.push(['pxB', 'to', 'pxA', null, null, null, {pos:[700, 0]}]);
      workingNodes.push(['pxC', 'a remark {{u:wavy|on}} it', null, null, null, 'callout',
                         {pos:[450, 120], leader:{from:'pxA', to:'pxB', at:0.5}, square:false}]);
      workingNodes.push(['pxP', 'A face', null, null, null, 'ellipse', {pos:[0, 300], bioCard:true}]);
      EDGE_STYLES.push({from:'pxA', to:'pxB', note:'a note {{u:solid|gy}} [[x|rb]]'});
    });
    await wait(200);
    const entry = (id)=>{
      const n = nodes.get(id), t = document.querySelector(`.node[data-id="${id}"] text`);
      return {g: gaps(n, inkBoxOf(t, rules(t))), want: textInsetFor(n)};
    };
    out.entries = {underlined: entry('pxU'), double: entry('pxD'), callout: entry('pxC')};
    /* …and across the corners. Measured against the innermost line the
       entry actually DRAWS — its rect, its radius, its stroke as the page
       computed them — so a radius changed anywhere, or a rail added, is
       caught by what it does rather than by what it was meant to be. */
    const cornerGap = (rect, ink)=>{
      const x = +rect.getAttribute('x'), y = +rect.getAttribute('y');
      const w = +rect.getAttribute('width'), h = +rect.getAttribute('height');
      const r = +(rect.getAttribute('rx') || 0);
      const half = parseFloat(getComputedStyle(rect).strokeWidth) / 2;
      let worst = Infinity;
      [[ink.x, ink.y, x + r, y + r, -1, -1], [ink.x + ink.width, ink.y, x + w - r, y + r, 1, -1],
       [ink.x, ink.y + ink.height, x + r, y + h - r, -1, 1],
       [ink.x + ink.width, ink.y + ink.height, x + w - r, y + h - r, 1, 1]]
        .forEach(([px, py, cx, cy, ox, oy])=>{
          // Only a corner of the ink out in the arc's own quarter is the
          // arc's business; anywhere else the straight side is nearer.
          if(r <= 0 || (px - cx) * ox < -0.01 || (py - cy) * oy < -0.01) return;
          worst = Math.min(worst, (r - half) - Math.hypot(px - cx, py - cy));
        });
      return +worst.toFixed(3);
    };
    out.corners = {};
    for(const id of ['pxU', 'pxD', 'pxC', 'pxR']){
      const g = document.querySelector(`.node[data-id="${id}"]`);
      const t = g.querySelector('text');
      const rail = g.querySelector(':scope > rect.border-inner') ||
                   [...g.querySelectorAll(':scope > rect')].find(r=> !r.classList.contains('node-hover-pad'));
      out.corners[id] = cornerGap(rail, inkBoxOf(t, rules(t)));
    }
    {
      const n = nodes.get('pxR');
      const ink = inkBoxOf(document.querySelector('.node[data-id="pxR"] text'), []);
      out.cornerSameSize = Math.abs(n.h - (ink.height + 2*textInsetFor(n))) < 0.05 &&
                           Math.abs(n.w - (ink.width + 2*textInsetFor(n))) < 0.05;
    }
    out.cornersClear = Object.values(out.corners).every(v=> Number.isFinite(v) && v >= TEXT_GAP - 0.05);
    out.entriesEven = Object.values(out.entries).every(e=> even(e.g, e.want));
    out.ruleCounted = (()=>{
      const t = document.querySelector('.node[data-id="pxU"] text');
      return inkBoxOf(t, rules(t)).height > inkBoxOf(t, []).height;
    })();
    {
      const g = document.querySelector('.edge-note[data-from="pxA"][data-to="pxB"]');
      const t = g.querySelector('text'), plate = g.querySelector('.edge-note-plate');
      const box = {x: +plate.getAttribute('x'), y: +plate.getAttribute('y'),
                   w: +plate.getAttribute('width'), h: +plate.getAttribute('height')};
      out.note = gaps(box, inkBoxOf(t, rules(t)));
      out.noteEven = even(out.note, TEXT_GAP + EDGE_NOTE_FRAME_W / 2);
    }
    {
      openBioCard('pxP', true);
      await wait(200);
      const g = document.querySelector('.bio-card-g[data-id="pxP"]');
      const [x, y, w, h] = g.dataset.box.split(' ').map(Number);
      out.bio = gaps({x, y, w, h}, inkBoxOf(g.querySelector('text'), []));
      out.bioEven = even(out.bio, BIO_CARD_INSET);
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(400);
    return out;
  });
  check('a hand bend beside the box a connector enters makes no hook at its port',
        rP.noHooks, JSON.stringify(rP.hooks));
  check('an entry’s border stands a pixel off its ink — rules, readings and a double rail included',
        rP.entriesEven && rP.ruleCounted, JSON.stringify(rP.entries));
  check('and across its rounded corners, which give way rather than the box growing',
        rP.cornersClear && rP.cornerSameSize, JSON.stringify(rP.corners));
  check('so does a connector note’s plate, from its frame', rP.noteEven, JSON.stringify(rP.note));
  check('and a portrait’s card', rP.bioEven, JSON.stringify(rP.bio));
  });

  /* ---- two tabs, a grid of one letter, growth from the middle ---- */
  await scenario("two tabs, a grid of one letter, and growth from the middle", async () => {
  const rT = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const beforeRefs = REFS.map(r=> Object.assign({}, r));
    const gapsOf = (n, ink)=> ({
      left: +(ink.x - n.x).toFixed(2), right: +(n.x + n.w - ink.x - ink.width).toFixed(2),
      top: +(ink.y - n.y).toFixed(2), bottom: +(n.y + n.h - ink.y - ink.height).toFixed(2)});
    const inkOf = (id)=>{
      const t = document.querySelector(`.node[data-id="${id}"] text`);
      const sib = [...t.parentNode.children].filter(c=> c.classList.contains('text-underline') ||
                                                         c.classList.contains('sticker-glyph'));
      return inkBoxOf(t, sib);
    };

    /* ---- a caption closes on its words like an entry does ---- */
    applyEdit(()=>{
      workingNodes = [
        ['tbA', 'Caption gy', null, null, null, 'textbox', {pos:[0, 0]}],
        ['tbB', 'Two lines\nof caption', null, null, null, 'textbox', {pos:[0, 200]}],
      ];
      refill(EDGE_STYLES, []);
    });
    await wait(250);
    out.caption = ['tbA', 'tbB'].map(id=> gapsOf(nodes.get(id), inkOf(id)));
    out.captionInset = textInsetFor(nodes.get('tbA'));
    out.captionEven = out.caption.every(g=> Object.values(g).every(v=> Math.abs(v - out.captionInset) < 0.06));
    out.captionCorner = +document.querySelector('.node[data-id="tbA"] .textbox-frame').getAttribute('rx');

    /* ---- a border that takes more room grows the box about its middle ---- */
    const centres = {};
    for(const border of [undefined, 'wavy', 'double']){
      applyEdit(()=>{
        workingNodes = [
          ['gmA', 'Word', null, null, null, null, {pos:[0, 0], border}],
          ['gmB', 'Two\nlines here', null, null, null, null, {pos:[0, 200], border}],
          ['gmC', 'Remark', null, null, null, 'callout', {pos:[0, 400], border}],
        ];
      });
      await wait(150);
      ['gmA', 'gmB', 'gmC'].forEach(id=>{
        const n = nodes.get(id);
        (centres[id] = centres[id] || []).push([+(n.x + n.w/2).toFixed(3), +(n.y + n.h/2).toFixed(3), n.w]);
      });
    }
    out.centres = centres;
    out.grewAboutMiddle = Object.values(centres).every(c=>
      c[1][2] > c[0][2] && c.every(p=> Math.abs(p[0] - c[0][0]) < 0.011 && Math.abs(p[1] - c[0][1]) < 0.011));
    /* …and a wavy entry dropped where it is drawn stays there: the shift
       that centres it is added back when the drop is written down. */
    {
      const n = nodes.get('gmA');
      const x0 = n.x, y0 = n.y;
      saveNodePositions([{id:'gmA', x: n.x, y: n.y}]);
      await wait(150);
      const m = nodes.get('gmA');
      out.dropHeld = Math.abs(m.x - x0) < 0.01 && Math.abs(m.y - y0) < 0.01;
    }

    /* ---- the grid is the smallest box that holds a letter ---- */
    applyEdit(()=>{
      workingNodes = [
        ['grA', 'a', null, null, null, null, {pos:[0, 0], square:true}],
        ['grD', 'dr', null, null, null, null, {pos:[0, 300]}],
        ['grT', 'dt', 'grD', null, null, null, {pos:[400, 300]}],
        ['grE', '', null, null, null, 'callout', {pos:[0, 600]}],
        ['grL', '', null, null, null, 'callout', {pos:[200, 600], leader:{from:'grD', to:'grT', at:0.5}}],
      ];
    });
    await wait(250);
    const a = nodes.get('grA');
    out.letter = [a.w, a.h, GRID];
    out.gridIsLetter = Math.abs(Math.max(a.w, a.h) - GRID) < 0.01 && a.w <= GRID + 0.01;
    out.empty = ['grE', 'grL'].map(id=> [nodes.get(id).w, nodes.get(id).h]);
    out.emptyIsStep = out.empty.every(([w, h])=> Math.abs(w - GRID) < 0.01 && Math.abs(h - GRID) < 0.01);
    out.snapClean = [3, 17, 35, 46.5, 1000, -23].every(v=> snapToGrid(v) === +snapToGrid(v).toFixed(2));

    /* ---- tags and references are two tabs, each on its own ---- */
    applyEdit(()=>{
      REFS.length = 0;
      REFS.push({key:'tA', title:'', detail:'A first book', url:'https://example.org/'},
                {key:'tB', title:'', detail:'A second comic', url:''});
    });
    rebuildChart(); buildSideTabs();
    const tags = document.getElementById('tagsPanel'), refs = document.getElementById('refsPanel');
    const rect = (e)=> e.getBoundingClientRect();
    const tabFree = (id)=>{
      const r = rect(document.getElementById(id));
      const at = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return !!(at && at.closest('#' + id));
    };
    out.noToolbarButton = !document.getElementById('legendToggle') && !document.getElementById('legend');
    /* Four drawers down the left edge, Media the lowest (the overview is a
       button on the toolbar since the owner's list of 22.11): the tabs
       stand still whatever is open, every drawer is the same size, any of
       them can be open at once, and no two ever overlap. */
    const tabIds = ['tagsTab', 'refsTab', 'keyTab', 'mediaTab'];
    const panels = ['tagsPanel', 'refsPanel', 'keyPanel', 'mediaPanel'].map(id=> document.getElementById(id));
    const tabRects = ()=> tabIds.map(id=>{ const r = rect(document.getElementById(id)); return [r.top, r.height].map(v=> Math.round(v)); });
    const shutRects = JSON.stringify(tabRects());
    const overlap = (a, b)=> a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const states = [];
    for(const mask of [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[1,1,0,0],[0,1,1,1],[1,1,1,1]]){
      panels.forEach((p, i)=> setSideTab(p, !!mask[i]));
      // Past the rise a drawer opens with (side-tab-rise).
      await wait(300);
      const bodies = panels.map(p=> p.querySelector('.side-tab-body'));
      const open = bodies.filter((b, i)=> mask[i]);
      states.push({mask: mask.join(''),
        tabsStill: JSON.stringify(tabRects()) === shutRects,
        tabsFree: tabIds.every(tabFree),
        shown: panels.every((p, i)=> getComputedStyle(bodies[i]).visibility === (mask[i] ? 'visible' : 'hidden')),
        apart: open.every((b, i)=> open.every((c, j)=> i === j || !overlap(rect(b), rect(c)))),
        sizes: bodies.map(b=> { const r = rect(b); return [r.width, r.height].map(v=> Math.round(v)).join('x'); })});
    }
    panels.forEach(p=> setSideTab(p, false));
    out.tabStates = states;
    out.tabsApart = states.every(s=> s.tabsStill && s.tabsFree && s.shown && s.apart &&
      new Set(s.sizes).size === 1);
    out.tabLengths = tabRects().map(r=> r[1]);
    /* Each tab marked by a sign, not a word: a tag, a citation, a map —
       named for anything that reads the page aloud. The citation is the
       mark on every cite button too, and the + for a reference is made
       the way the tag's and the category's are. */
    {
      const signs = tabIds.map(id=>{ const b = document.getElementById(id);
        return {svg: !!b.querySelector('svg'), text: b.textContent.trim(), label: b.getAttribute('aria-label')}; });
      out.tabSigns = JSON.stringify(signs);
      out.tabsBySign = signs.every(t=> t.svg && !t.text && t.label) &&
        signs.map(t=> t.label).join() === 'Tags,References,Legend,Media';
      const cite = document.querySelector('.mini-toolbar .tb-ref-btn');
      out.citeIsSign = !!cite && !!cite.querySelector('svg') && !cite.textContent.trim();
      buildSideTabs();
      const addRef = document.querySelector('#refsList .plus-mini.add-ref');
      const addTag = document.querySelector('#tagsList .plus-mini.add-tag');
      const box = b=> { const r = b.getBoundingClientRect(), q = b.querySelector('svg').getBoundingClientRect();
                        return [r.width, r.height, q.width, q.height].map(v=> Math.round(v)).join(); };
      setSideTab(refs, true); setSideTab(tags, true); await wait(60);
      out.refAddLike = !!addRef && !!addTag && box(addRef) === box(addTag);
      out.refAddBoxes = addRef && addTag ? box(addRef) + ' / ' + box(addTag) : 'missing';
      setSideTab(refs, false); setSideTab(tags, false);
    }
    /* A press on one tab leaves the others as they were. */
    setSideTab(refs, true);
    document.getElementById('tagsTab').click();
    out.pressTurns = tags.classList.contains('open') && refs.classList.contains('open');
    document.getElementById('tagsTab').click();
    out.pressShuts = !tags.classList.contains('open') && refs.classList.contains('open');
    setSideTab(refs, false);
    /* A list longer than the window scrolls inside it, with a bar. */
    applyEdit(()=>{ for(let i = 0; i < 40; i++) REFS.push({key:'tz' + i, title:'', detail:'Filler ' + i}); });
    buildSideTabs();
    setSideTab(refs, true);
    await wait(60);
    {
      const list = document.getElementById('refsList');
      const body = refs.querySelector('.side-tab-body');
      out.scrolls = list.scrollHeight > list.clientHeight + 20 &&
        rect(body).height <= 400 &&
        ['auto', 'scroll'].includes(getComputedStyle(list).overflowY);
    }
    setSideTab(refs, false);
    applyEdit(()=>{ for(let i = REFS.length - 1; i >= 0; i--) if(/^tz/.test(REFS[i].key)) REFS.splice(i, 1); });
    buildSideTabs();
    /* Each tab has its own search and its own +. */
    out.ownTools = ['tagsList', 'refsList'].every(id=>{
      const list = document.getElementById(id);
      return !!list.querySelector('.legend-filter input') && !!list.querySelector('.legend-section-head .plus-mini');
    });
    {
      const box = document.getElementById('refsFilter');
      box.value = 'comic'; box.dispatchEvent(new Event('input'));
      out.refFound = [...document.querySelectorAll('#refsList .ref-item')].map(r=> r.dataset.key).join();
      const box2 = document.getElementById('refsFilter');
      box2.value = '[1]'; box2.dispatchEvent(new Event('input'));
      out.refByNumber = [...document.querySelectorAll('#refsList .ref-item')].map(r=> r.dataset.key).join();
      const box3 = document.getElementById('refsFilter');
      box3.value = ''; box3.dispatchEvent(new Event('input'));
      out.refAll = document.querySelectorAll('#refsList .ref-item').length;
    }
    /* The one menu they used to share is not named anywhere a reader looks. */
    const helpText = [...document.querySelectorAll('#aboutOverlay p')]
      .filter(p=> !p.closest('#versionLog')).map(p=> p.textContent).join(' ');
    out.noManagement = !/management/i.test(document.querySelector('.topbar').textContent + ' ' +
      [...document.querySelectorAll('.topbar [title], #sideTabs [title]')].map(e=> e.title).join(' ') + ' ' +
      document.getElementById('sideTabs').textContent + ' ' + helpText);

    applyEdit(()=>{ REFS.length = 0; beforeRefs.forEach(r=> REFS.push(r)); });
    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(400);
    return out;
  });
  check('a caption closes on its words a pixel off, as an entry does',
        rT.captionEven && rT.captionCorner <= rT.captionInset + 0.01, JSON.stringify({g:rT.caption, rx:rT.captionCorner}));
  check('a border that takes more room grows the box about its middle',
        rT.grewAboutMiddle, JSON.stringify(rT.centres));
  check('and a box grown that way stays where it is dropped', rT.dropHeld);
  check('a grid step is the smallest box that holds an "a"', rT.gridIsLetter, JSON.stringify(rT.letter));
  check('an empty remark, pinned or not, is one grid step square', rT.emptyIsStep, JSON.stringify(rT.empty));
  check('and a step snapped to comes out clean', rT.snapClean);
  check('the top bar has no menu for tags and references', rT.noToolbarButton);
  check('tags, references, the legend and the overview are four drawers that open together and never move or overlap',
        rT.tabsApart, JSON.stringify(rT.tabStates));
  check('and the four tabs are the same length', new Set(rT.tabLengths).size === 1, JSON.stringify(rT.tabLengths));
  check('each tab is marked by a sign, not a word', rT.tabsBySign, rT.tabSigns);
  check('the cite button on a text toolbar is the [1] sign', rT.citeIsSign);
  check('the + for a reference is made as the tag\'s and the category\'s are', rT.refAddLike, rT.refAddBoxes);
  check('pressing one tab leaves the others as they were', rT.pressTurns && rT.pressShuts);
  check('a list longer than the window scrolls inside it', rT.scrolls);
  check('each tab has its own search and its own +', rT.ownTools);
  check('the references can be searched, by words or by number',
        rT.refFound === 'tB' && rT.refByNumber === 'tA' && rT.refAll === 2,
        JSON.stringify({w:rT.refFound, n:rT.refByNumber, all:rT.refAll}));
  check('the shared menu is not named anywhere a reader looks', rT.noManagement);
  });

  /* ---- a reference made like a tag, a + in the corner, square by default ---- */
  await scenario("a reference made like a tag, and a + in the corner", async () => {
  const rF = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const beforeRefs = REFS.slice();

    /* A reference is made where it will stand, as a tag is: the + puts an
       empty row at the foot of the list with the caret in it, Enter keeps
       what was typed, and Escape keeps nothing. No dialog either way. */
    {
      const plus = ()=> document.querySelector('#refsList button[title="Add a reference"]');
      const n0 = REFS.length;
      plus().click();
      await wait(120);
      const box = document.querySelector('#refsList .ref-item-new .ref-naming-text');
      out.refRowFocused = !!box && document.activeElement === box &&
        !document.getElementById('askOverlay').classList.contains('open');
      out.refRowLast = !!box && box.closest('.ref-item') === [...document.querySelectorAll('#refsList .ref-item')].pop();
      box.textContent = 'Marvel UK #1, 1984';
      box.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await wait(150);
      out.refMade = REFS.length === n0 + 1 && REFS[REFS.length-1].detail === 'Marvel UK #1, 1984' &&
        !document.querySelector('#refsList .ref-item-new');
      plus().click();
      await wait(120);
      const box2 = document.querySelector('#refsList .ref-item-new .ref-naming-text');
      box2.textContent = 'never kept';
      box2.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      await wait(150);
      out.refEscaped = REFS.length === n0 + 1 && !document.querySelector('#refsList .ref-item-new');
      // A click anywhere else keeps it, as Enter does.
      plus().click();
      await wait(120);
      const box3 = document.querySelector('#refsList .ref-item-new .ref-naming-text');
      box3.textContent = 'Kept by a click, 1914';
      box3.blur();
      await wait(150);
      out.refBlurKeeps = REFS.length === n0 + 2 && REFS[REFS.length-1].detail === 'Kept by a click, 1914';
      /* And a search finds a reference by its words, numbers included —
         not only by the number it is listed under. */
      refFilterText = '1914'; buildSideTabs(); await wait(120);
      out.refFoundByText = [...document.querySelectorAll('#refsList .ref-item .ref-detail')]
        .some(d=> /1914/.test(d.textContent));
      refFilterText = String(n0 + 1); buildSideTabs(); await wait(120);
      out.refFoundByNumber = [...document.querySelectorAll('#refsList .ref-item .ref-detail')]
        .some(d=> d.textContent === 'Marvel UK #1, 1984');
      refFilterText = ''; buildSideTabs();
      setSideTab(refsPanel, false);
    }

    /* An empty entry is the size of an empty callout: one grid step. */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['feE', '', null, null, null, null, {pos:[0, 0]}]);
      workingNodes.push(['feA', 'a', null, null, null, null, {pos:[200, 0]}]);
      workingNodes.push(['feB', 'b', 'feA', null, null, null, {pos:[600, 0]}]);
      workingNodes.push(['feK', '', null, null, null, 'callout',
                         {pos:[380, 100], leader:{from:'feA', to:'feB', at:0.5}}]);
      workingNodes.push(['feS', 'Words', null, null, null, null, {pos:[0, 200]}]);
      workingNodes.push(['feD', 'Words', null, null, null, null, {pos:[0, 300], border:'double'}]);
      EDGE_STYLES.push({from:'feA', to:'feB', dash:'double'});
    });
    await wait(300);
    {
      const e = nodes.get('feE'), k = nodes.get('feK');
      out.emptySizes = [e.w, e.h, k.w, k.h];
      out.emptyLikeCallout = e.w === k.w && e.h === k.h && Math.abs(e.w - GRID) < 0.01;
    }

    /* A double border is a double connector's line laid round the box:
       the same two rails and the same gutter, centred on the box's edge,
       and the box grown by the difference about its middle. */
    {
      const s = nodes.get('feS'), d = nodes.get('feD');
      const sw = (r)=> parseFloat(getComputedStyle(r).strokeWidth);
      const outer = document.querySelector('#edgeLayer path.edge.struct.dbl-outer[data-from="feA"][data-to="feB"]');
      const inner = document.querySelector('#edgeLayer path.edge.struct.dbl-inner[data-from="feA"][data-to="feB"]');
      const band = outer ? sw(outer) : NaN, gutter = inner ? sw(inner) : NaN;
      const lines = [...document.querySelectorAll('.node[data-id="feD"] > rect[stroke]')];
      const edges = (r)=> {
        const x = +r.getAttribute('x'), half = sw(r) / 2;
        return [x - half, x + half];
      };
      const [a, b] = lines.map(edges);
      out.doubleWeights = {node: lines.map(sw), line: [band, gutter]};
      out.doubleEqual = lines.length === 2 &&
        lines.every(r=> Math.abs(sw(r) - (band - gutter) / 2) < 1e-3) &&
        Math.abs((b[0] - a[1]) - gutter) < 0.01 &&
        Math.abs((b[1] - a[0]) - band) < 0.01;
      out.doubleEdges = [a[0] - d.x, a[1] - d.x, b[0] - d.x, b[1] - d.x].map(v=> +v.toFixed(3));
      out.doubleSplit = Math.abs((a[0] + b[1]) / 2 - d.x) < 0.01 &&
        Math.abs((d.x + d.w / 2) - (s.x + s.w / 2)) < 0.011 &&
        Math.abs((d.w - s.w) - (band - NODE_BORDER_W)) < 0.02;
    }

    /* Square is the default; rounding is what gets written down. */
    {
      out.squareByDefault = hasSquareCorners(nodes.get('feS')) &&
        [...document.querySelectorAll('.node[data-id="feS"] > rect[stroke]')].every(r=> +r.getAttribute('rx') === 0);
      openStyleBar({kind:'node', id:'feS'});
      document.querySelector('#styleBar [data-group="corners"] button[data-value="round"]').click();
      await wait(150);
      out.roundWritten = entryOpts(workingEntry('feS').entry).square === false &&
        /square:false/.test(serializeNodes([workingEntry('feS').entry])) &&
        !hasSquareCorners(nodes.get('feS'));
      closeStyleBar();
    }

    /* The zoom buttons are gone, and the + stands in their corner. */
    {
      out.noZoomButtons = !document.getElementById('zoomIn') && !document.getElementById('zoomOut') &&
        !document.getElementById('zoomReset') && !document.getElementById('addNodeToggle');
      const btn = document.getElementById('addFabBtn');
      const r = btn.getBoundingClientRect(), c = svg.getBoundingClientRect();
      out.fabRound = getComputedStyle(btn).borderRadius === '50%' && Math.abs(r.width - r.height) < 0.5;
      out.fabCorner = c.right - r.right < 40 && c.bottom - r.bottom < 40;
      const styles = document.getElementById('addFabStyles');
      const shown = ()=> getComputedStyle(styles).visibility === 'visible';
      const turned = ()=> getComputedStyle(btn.querySelector('svg')).transform;
      out.fabShutAtRest = !shown() && turned() === 'none';
      document.getElementById('addFab').dispatchEvent(new PointerEvent('pointerenter', {pointerType:'mouse'}));
      await wait(600);
      out.fabOpens = shown() && styles.querySelectorAll('.node-style-btn').length === 5 &&
        styles.getBoundingClientRect().bottom <= r.top + 0.5;
      out.fabTurns = /transform/.test(getComputedStyle(btn.querySelector('svg')).transitionProperty) &&
        turned() !== 'none';
      document.getElementById('addFab').dispatchEvent(new PointerEvent('pointerleave', {pointerType:'mouse'}));
      await wait(600);
      out.fabUnturns = !shown() && turned() === 'none';
    }

    /* A style picked puts that entry on the nearest clear ground to the
       middle of the view — never on top of one already there. */
    {
      applyEdit(()=>{ workingNodes.length = 0; refill(EDGE_STYLES, []); });
      await wait(150);
      const view = visibleCanvasRect();
      const mid = clientToWorld(view.left + view.width/2, view.top + view.height/2);
      const pick = (v)=> document.querySelector(`#addFabStyles .node-style-btn[data-value="${v}"]`).click();
      const made = [];
      for(const v of ['rect', 'rect', 'textbox', 'rect']){
        pick(v); await wait(200);
        closeNodeEditor(); deselect(); await wait(60);
        made.push(workingNodes[workingNodes.length-1][0]);
      }
      const boxes = made.map(id=> nodes.get(id));
      const first = boxes[0];
      out.firstAtMiddle = Math.abs(first.x + first.w/2 - mid.x) <= GRID &&
                          Math.abs(first.y + first.h/2 - mid.y) <= GRID;
      out.noOverlap = boxes.every((a, i)=> boxes.every((b, j)=> i === j ||
        a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y));
      // Nearest: every one of them within two steps of the first.
      out.allNear = boxes.every(b=> Math.hypot(b.x - first.x, b.y - first.y) <= 3 * GRID);
      out.madeShapes = made.map(id=> workingEntry(id).entry[5] || 'rect').join();
      out.placed = boxes.map(b=> [b.x, b.y].map(v=> +v.toFixed(2)).join(',')).join(' ');
    }

    refill(REFS, beforeRefs);
    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart(); buildSideTabs();
    await wait(400);
    return out;
  });
  check('the + on References opens an empty row with the caret in it, and no dialog',
        rF.refRowFocused && rF.refRowLast);
  check('Enter makes the reference, Escape makes none', rF.refMade && rF.refEscaped);
  check('and a click elsewhere keeps it, as Enter does', rF.refBlurKeeps);
  check('a reference is found by its words as well as by its number',
        rF.refFoundByText && rF.refFoundByNumber,
        JSON.stringify({text:rF.refFoundByText, number:rF.refFoundByNumber}));
  check('an empty entry is the size of an empty callout', rF.emptyLikeCallout, JSON.stringify(rF.emptySizes));
  check('a double border is drawn as a double connector is, and grows about its middle',
        rF.doubleEqual && rF.doubleSplit, JSON.stringify({w:rF.doubleWeights, e:rF.doubleEdges}));
  check('an entry is square unless rounded, and rounding is what is saved',
        rF.squareByDefault && rF.roundWritten);
  check('no zoom buttons; a round + in their corner', rF.noZoomButtons && rF.fabRound && rF.fabCorner);
  check('pointing at the + stands the styles up above it, and turns the plus once',
        rF.fabShutAtRest && rF.fabOpens && rF.fabTurns);
  check('and leaving it puts them away and turns the plus back', rF.fabUnturns);
  check('a picked style lands on the clear ground nearest the middle of the view',
        rF.firstAtMiddle && rF.noOverlap && rF.allNear && rF.madeShapes === 'rect,rect,textbox,rect',
        rF.placed + ' ' + rF.madeShapes);

  /* On a phone the About card fits under the two-row bar, and the + is
     reached by a tap. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    await pp.tap('#aboutToggle');
    await wait(400);
    const about = await pp.evaluate(()=>{
      const ov = document.getElementById('aboutOverlay').getBoundingClientRect();
      const card = document.querySelector('#aboutOverlay .about-card').getBoundingClientRect();
      const x = document.getElementById('aboutClose').getBoundingClientRect();
      const hit = document.elementFromPoint(x.left + x.width/2, x.top + x.height/2);
      const help = [...document.querySelectorAll('#aboutOverlay .about-body > p')]
        .filter(p=> !p.classList.contains('about-version') && !p.classList.contains('about-actions')).map(p=> p.textContent).join(' ');
      return {inside: card.top >= ov.top - 0.5 && card.bottom <= ov.bottom + 0.5 &&
                      card.left >= 0 && card.right <= innerWidth,
              closable: !!hit && !!hit.closest('#aboutClose') && x.width >= 36,
              chars: help.length};
    });
    check('on a phone the About card fits on the screen and its ✕ can be tapped',
          about.inside && about.closable, JSON.stringify(about));
    check('and what it says is short', about.chars < 1400, `${about.chars} characters`);
    await pp.tap('#aboutClose');
    await wait(300);
    await pp.tap('#addFabBtn');
    await wait(400);
    const fab = await pp.evaluate(()=> ({
      open: document.getElementById('addFab').classList.contains('open'),
      onScreen: [...document.querySelectorAll('#addFabStyles .node-style-btn')].every(b=>{
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      }),
      aboutShut: !document.getElementById('aboutOverlay').classList.contains('open')
    }));
    check('on a phone a tap on the + offers the styles, all on the screen',
          fab.open && fab.onScreen && fab.aboutShut, JSON.stringify(fab));
  } finally {
    await phone.close();
  }
  });

  /* ---- bends that cannot mean anything, dots on corners, a legend, quarter turns, a kept draft ---- */
  await scenario("a bend too close to its entry, dots on the corners, a legend and a quarter turn", async () => {
  const rQ = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const beforeSettings = JSON.parse(JSON.stringify(SETTINGS));
    /* The three connectors the owner circled, as they were saved: a bend
       on the border of the entry it arrives at, a bend inside one, and a
       bend just below a stacked entry whose rings reach past it. Moved
       well clear of the rest of the chart, together. */
    const DX = 4000, DY = 4000;
    const at = (x, y)=> [+(x + DX).toFixed(2), +(y + DY).toFixed(2)];
    applyEdit(()=>{
      workingNodes.push(['bq3', 'Прчоао', null, null, null, null, {pos: at(-110.77, 123.95)}]);
      workingNodes.push(['bq4', 'Човьлы', 'bq3', null, null, null, {pos: at(-171.24, 194.44)}]);
      workingNodes.push(['bq5', 'Пролл', null, null, null, null, {pos: at(-112.5, 244.79)}]);
      workingNodes.push(['bq6', 'Гаягкягкч', 'bq5', null, null, null, {pos: at(-40.28, 234.72)}]);
      workingNodes.push(['bqA', 'asdasdи', null, null, null, null,
        {pos: at(-38.15, 133.33), colors:['#20242b', '#c2c'], tags:['local multiverse']}]);
      workingNodes.push(['bqB', 'asdasd', 'bqA', null, null, null, {pos: at(24.68, 109.51), border:'dashdot'}]);
      EDGE_STYLES.push(
        {from:'bq3', to:'bq4', routing:'orthogonal', dash:'solid', arrow:true, bends:[at(-140.98, 201.4)], fromSide:'bottom', toSide:'bottom'},
        {from:'bq5', to:'bq6', routing:'orthogonal', dash:'solid', arrow:true, bends:[at(-40.28, 211.47), at(-20.14, 251.75)], fromSide:'top', toSide:'top'},
        {from:'bqA', to:'bqB', routing:'orthogonal', dash:'solid', arrow:true, arrowIn:true, bends:[at(-20.14, 161.12)], fromSide:'top', toSide:'top', fromRing:1, square:true});
    });
    await wait(300);
    /* A route is a polyline through every point its path names — a
       rounded corner's control point IS the corner. */
    const routeOf = (f, t)=>{
      const p = document.querySelector(`#edgeLayer path.edge.struct[data-from="${f}"][data-to="${t}"]`);
      if(!p) return null;
      const nums = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const pts = [];
      for(let i = 0; i + 1 < nums.length; i += 2) pts.push({x: nums[i], y: nums[i+1]});
      return pts;
    };
    /* Through an own entry: any run but the two run-outs crossing the box
       a little inside its border. Back on itself: a run followed straight
       away by one the opposite way. */
    const faults = (f, t)=>{
      const pts = routeOf(f, t);
      if(!pts) return ['no route'];
      const bad = [];
      const boxes = [nodes.get(f), nodes.get(t)].map(n=> ({x0:n.x + 1.5, y0:n.y + 1.5, x1:n.x + n.w - 1.5, y1:n.y + n.h - 1.5}));
      for(let i = 1; i < pts.length - 2; i++){
        const a = pts[i], b = pts[i+1];
        if(boxes.some(r=> segIntersectsRect(a.x, a.y, b.x, b.y, r))) bad.push('through ' + i);
      }
      for(let i = 0; i + 2 < pts.length; i++){
        const a = pts[i], b = pts[i+1], c = pts[i+2];
        const u = {x: Math.sign(Math.round(b.x - a.x)), y: Math.sign(Math.round(b.y - a.y))};
        const v = {x: Math.sign(Math.round(c.x - b.x)), y: Math.sign(Math.round(c.y - b.y))};
        if((u.x || u.y) && u.x === -v.x && u.y === -v.y) bad.push('back ' + i);
      }
      return bad;
    };
    out.circled = {'bq3>bq4': faults('bq3', 'bq4'), 'bq5>bq6': faults('bq5', 'bq6'), 'bqA>bqB': faults('bqA', 'bqB')};
    /* …and the same of every connector on the chart that carries bends. */
    out.chartWide = [];
    EDGE_STYLES.forEach(st=>{
      if(!st.bends || !st.bends.length || !nodes.has(st.from) || !nodes.has(st.to)) return;
      const f = faults(st.from, st.to);
      if(f.length && f[0] !== 'no route') out.chartWide.push(`${st.from}>${st.to}: ${f.join(',')}`);
    });

    /* ---- the corner dots leave the smallest entry its middle ---- */
    applyEdit(()=>{ workingNodes.push(['bqE', '', null, null, null, null, {pos: at(200, 300)}]); });
    await wait(200);
    {
      const n = nodes.get('bqE');
      vs = 4; vx = 700 - (n.x + n.w/2) * vs; vy = 450 - (n.y + n.h/2) * vs; applyTransform();
      await wait(100);
      const g = document.querySelector('.node[data-id="bqE"]');
      g.classList.add('hover');
      const box = g.querySelector('rect').getBoundingClientRect();
      const mid = document.elementFromPoint(box.left + box.width/2, box.top + box.height/2);
      nodeControlsOn('bqE');
      out.middleIsEntry = !!mid && !!mid.closest('.node[data-id="bqE"]') && !mid.closest('.node-resize');
      out.dots = [...g.querySelectorAll('.node-resize')].length;
    }

    /* ---- the legend lists what is on the chart, and keeps what it means ---- */
    setSideTab(document.getElementById('keyPanel'), true);
    await wait(60);
    const keys = ()=> [...document.querySelectorAll('#keyList .key-item')].map(r=> r.dataset.key);
    out.keyHas = ['shape:entry', 'border:dashdot', 'tag:local multiverse', 'line:solid', 'line:both'].every(k=> keys().includes(k));
    out.keyLacksUnused = !keys().includes('border:wavy') || [...nodes.values()].some(n=> borderStyleOf(n) === 'wavy');
    {
      const box = document.querySelector('#keyList .key-item[data-key="border:dashdot"] .key-meaning-input');
      box.value = 'Not yet confirmed';
      box.dispatchEvent(new Event('change'));
      await wait(60);
      out.keySaved = SETTINGS.legend && SETTINGS.legend['border:dashdot'] === 'Not yet confirmed';
      out.keyWritten = /legend: \{'border:dashdot': 'Not yet confirmed'\}/.test(serializeSettings(SETTINGS));
      out.keyRead = cleanLegend(readRegionObject('/* @@EDIT:SETTINGS:START@@ */\n' + serializeSettings(SETTINGS) +
        '\n/* @@EDIT:SETTINGS:END@@ */', 'SETTINGS').legend)['border:dashdot'] === 'Not yet confirmed';
      /* Saying what the program already says is no setting at all. */
      const am = KEY_MARKS.find(m=> m.key === 'shape:amalgam');
      setKeyMeaning('shape:amalgam', am.meaning);
      out.keyDefaultNotStored = !('shape:amalgam' in (SETTINGS.legend || {}));
    }
    setSideTab(document.getElementById('keyPanel'), false);

    /* ---- an entry turns a quarter about its own middle ---- */
    {
      const n = nodes.get('bq3');
      const before = {cx: n.x + n.w/2, cy: n.y + n.h/2, w: n.w, h: n.h};
      const paintOf = ()=>{
        const g = document.querySelector('.node[data-id="bq3"]');
        const r = g && g.querySelector(':scope > rect:not(.node-hover-pad)'), x = g && g.querySelector(':scope > text');
        return r && x ? [getComputedStyle(r).fill, getComputedStyle(r).stroke, getComputedStyle(x).fill].join('|') : null;
      };
      const paintBefore = paintOf();
      turnEntryTo('bq3', 90);
      await wait(150);
      const m = nodes.get('bq3');
      out.turnSwapped = Math.abs(m.w - before.h) < 0.6 && Math.abs(m.h - before.w) < 0.6;
      out.turnCentre = Math.abs(m.x + m.w/2 - before.cx) < 0.02 && Math.abs(m.y + m.h/2 - before.cy) < 0.02;
      /* The whole drawing turns, piece by piece, each still a child of
         the entry's own group — a wrapper group took every piece out of
         reach of the stylesheet's `.node > rect` and `.node > text`. */
      const t = document.querySelector('.node[data-id="bq3"]');
      const tText = t && t.querySelector(':scope > text.turned-piece');
      const tRect = t && t.querySelector(':scope > rect.turned-piece:not(.node-hover-pad)');
      out.turnText = !!tText && !!tRect && !t.querySelector('.node-turned') &&
        /^rotate\(90,/.test(tText.getAttribute('transform') || '') &&
        /^rotate\(90,/.test(tRect.getAttribute('transform') || '');
      /* …and so it keeps its colours: ground, border and words alike. */
      out.turnKeepsPaint = !!paintBefore && paintOf() === paintBefore;
      /* The words stand inside the turned box. */
      const tb = tText.getBoundingClientRect(), bb = tRect.getBoundingClientRect();
      out.turnTextInside = tb.height > tb.width && tb.top >= bb.top - 1 && tb.bottom <= bb.bottom + 1;
      out.turnStored = /rot:90/.test(serializeNodes(workingNodes.filter(it=> it[0] === 'bq3')));
      /* A connector meets the turned box, not the one it used to be. */
      const r = routeOf('bq3', 'bq4');
      const last = r && r[0];
      out.turnPort = !!last && Math.abs(last.y - (m.y + m.h)) < 3;
      /* Four quarters are a whole turn, and back where it started. */
      for(const d of [180, 270, 0]){ turnEntryTo('bq3', d); await wait(80); }
      const z = nodes.get('bq3');
      out.turnHome = Math.abs(z.x + z.w/2 - before.cx) < 0.02 && Math.abs(z.y + z.h/2 - before.cy) < 0.02 &&
        Math.abs(z.w - before.w) < 0.6 && !z.rot;
      /* Everything turns in quarters but the loose furniture — a caption
         and a picture — which turns freely, by a handle of its own. */
      out.turnOnlyEntries = !quarterTurnable({shape:'textbox'}) && !quarterTurnable({shape:'image'}) &&
        quarterTurnable({shape:'ellipse'}) && quarterTurnable({card:true}) && quarterTurnable({shape:null}) &&
        quarterTurnable({shape:'callout'});
      /* …by a button in the style bar, not by a handle on the entry. */
      out.turnHandle = !document.querySelector('.node .node-turn') &&
        !document.querySelector('.node[data-id="bq5"] .node-rotate');
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{
      workingNodes = beforeNodes;
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
      Object.assign(SETTINGS, beforeSettings);
    });
    rebuildChart(); buildSideTabs();
    await wait(300);
    return out;
  });
  check('a bend on or inside the entry it meets no longer drags the line through it',
        Object.values(rQ.circled).every(f=> !f.length), JSON.stringify(rQ.circled));
  check('no connector on the chart with bends runs through its own entries or back on itself',
        !rQ.chartWide.length, rQ.chartWide.slice(0, 4).join(' | '));
  check('the corner dots leave even the smallest entry its middle', rQ.middleIsEntry && rQ.dots === 4);
  check('the legend lists the marks that are on the chart', rQ.keyHas && rQ.keyLacksUnused);
  check('what a mark means is kept with the chart, written and read back',
        rQ.keySaved && rQ.keyWritten && rQ.keyRead && rQ.keyDefaultNotStored,
        JSON.stringify({s:rQ.keySaved, w:rQ.keyWritten, r:rQ.keyRead, d:rQ.keyDefaultNotStored}));
  check('a quarter turn stands the box on its side about its own middle',
        rQ.turnSwapped && rQ.turnCentre && rQ.turnStored,
        JSON.stringify({w:rQ.turnSwapped, c:rQ.turnCentre, s:rQ.turnStored}));
  check('and its words turn with it, inside it', rQ.turnText && rQ.turnTextInside);
  check('and it keeps its colours when it turns', rQ.turnKeepsPaint);
  check('a connector meets the turned box', rQ.turnPort);
  check('four quarters bring it home', rQ.turnHome);
  check('everything but the loose furniture turns in quarters, and no entry wears a turning handle',
        rQ.turnOnlyEntries && rQ.turnHandle);

  /* ---- unsaved work outlives a page that closes without asking ---- */
  {
    const c3 = await browser.newContext();
    await c3.addInitScript(() => { try { delete window.claude; } catch(e){} });
    const p3 = await c3.newPage();
    const e3 = []; p3.on('pageerror', e => e3.push(e.message));
    p3.on('dialog', d => d.accept());
    try {
      await p3.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
      await wait(900);
      const label0 = await p3.evaluate(() => workingNodes[0][1]);
      await p3.evaluate(() => applyEdit(() => { workingNodes[0][1] = '__KEPT__'; }));
      await wait(1300);
      const kept = await p3.evaluate(async () => { const d = await readDraft(); return !!d && d.data.nodes[0][1]; });
      /* A crash: the page goes with nothing asked and nothing saved. */
      await p3.reload({waitUntil:'networkidle'});
      await wait(1200);
      const offered = await p3.evaluate(() => ({bar: !!document.getElementById('draftBar'),
        label: workingNodes[0][1], dirty: isDirty()}));
      await p3.click('#draftBar .draft-restore');
      await wait(400);
      const back = await p3.evaluate(() => ({label: workingNodes[0][1], dirty: isDirty(),
        bar: !!document.getElementById('draftBar')}));
      /* Saved, there is nothing left to keep — and nothing is offered. */
      await p3.evaluate(() => saveNow());
      await wait(1200);
      const afterSave = await p3.evaluate(async () => !!(await readDraft()));
      await p3.reload({waitUntil:'networkidle'});
      await wait(1000);
      const quiet = await p3.evaluate(() => !document.getElementById('draftBar'));
      /* …and Discard throws a kept copy away. */
      await p3.evaluate(() => applyEdit(() => { workingNodes[0][1] = '__THROWN__'; }));
      await wait(1300);
      await p3.reload({waitUntil:'networkidle'});
      await wait(1200);
      await p3.click('#draftBar .draft-discard');
      await wait(300);
      const discarded = await p3.evaluate(async () => ({draft: !!(await readDraft()), label: workingNodes[0][1]}));
      check('unsaved work is kept in the browser a moment after an edit', kept === '__KEPT__', String(kept));
      check('and offered back, not put back, when the page opens again',
            offered.bar && offered.label === label0 && !offered.dirty, JSON.stringify(offered));
      check('restoring it puts the work back as unsaved', back.label === '__KEPT__' && back.dirty && !back.bar, JSON.stringify(back));
      check('a save removes the kept copy, and nothing is offered after it', !afterSave && quiet);
      check('discarding throws the kept copy away', !discarded.draft && discarded.label === '__KEPT__', JSON.stringify(discarded));
      check('no page errors around the kept copy', e3.length === 0, e3.join('; '));
      await p3.evaluate(() => { try { localStorage.clear(); } catch(e){} });
    } finally {
      await c3.close();
    }
  }
  });

  /* ---- a hand route that cannot be drawn, a lineage without an S, a turn from the bar, an editor the size of its entry ---- */
  await scenario("a hand route that cannot be drawn, a straight lineage, a turn button and a field the size of its entry", async () => {
  const rW = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const DX = 8000, DY = 8000;
    const at = (x, y)=> [+(x + DX).toFixed(2), +(y + DY).toFixed(2)];
    const broken = (pts, a, b)=>{
      if(!pts || pts.length < 2) return 'no route';
      const boxes = [a, b].map(n=> ({x0:n.x + 1.5, y0:n.y + 1.5, x1:n.x + n.w - 1.5, y1:n.y + n.h - 1.5}));
      for(let i = 1; i < pts.length - 2; i++){
        if(boxes.some(r=> segIntersectsRect(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, r))) return 'through ' + i;
      }
      for(let i = 0; i + 2 < pts.length; i++){
        const u = segDir(pts[i], pts[i+1]), v = segDir(pts[i+1], pts[i+2]);
        if(u && v && u.x === -v.x && u.y === -v.y) return 'back ' + i;
      }
      return null;
    };
    const drawn = (f, t)=>{
      const p = document.querySelector(`#edgeLayer path.edge.struct[data-from="${f}"][data-to="${t}"]`);
      if(!p) return null;
      const nums = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
      const pts = [];
      for(let i = 0; i + 1 < nums.length; i += 2) pts.push({x: nums[i], y: nums[i+1]});
      return pts;
    };

    /* A hand-bent route holds still while the entries move.
     *
       The port used to be put on whichever side of the entry FACED the
       other entry — an answer about the pair, which flips as they are
       pulled apart on the other axis, while the bends have not moved.
       Every flip redrew the whole route at once: the line left one face
       at one step of the carry and another face at the next, with the
       reader's own points unchanged. The bends decide the sides now, so
       carrying either entry about moves the route by what the entry
       moved and no more. */
    applyEdit(()=>{
      workingNodes.push(['hh1', 'Hold A', null, null, null, null, {pos: at(0, 0)}]);
      workingNodes.push(['hh2', 'Hold B', 'hh1', null, null, null, {pos: at(400, 300)}]);
      EDGE_STYLES.push({from:'hh1', to:'hh2', routing:'orthogonal', dash:'solid', arrow:true,
                        square:false, bends:[at(60, 200), at(300, 200)]});
    });
    await wait(300);
    {
      /* How far one route strays from the other, as a shape: index by
         index says nothing once a route gains or loses a vertex. */
      const near = (p, poly)=>{
        let m = Infinity;
        for(let i = 1; i < poly.length; i++){
          const a = poly[i-1], b = poly[i];
          const vx = b.x - a.x, vy = b.y - a.y, L = vx*vx + vy*vy;
          let t = L ? ((p.x-a.x)*vx + (p.y-a.y)*vy) / L : 0;
          t = Math.max(0, Math.min(1, t));
          m = Math.min(m, Math.hypot(p.x - (a.x + t*vx), p.y - (a.y + t*vy)));
        }
        return m;
      };
      const apart = (A, B)=>{
        let m = 0;
        A.forEach(p=> m = Math.max(m, near(p, B)));
        B.forEach(p=> m = Math.max(m, near(p, A)));
        return m;
      };
      const steps = [];
      let worst = 0;
      let prev = drawn('hh1', 'hh2');
      /* Carried well clear of the bends, on both entries and both ways,
         so nothing here is the reader moving an entry over its own
         point — which is the one case where a side SHOULD change. */
      for(const [id, dx, dy] of [['hh2', 0, 40], ['hh2', 40, 0], ['hh1', 0, -40], ['hh1', -40, 0]]){
        for(let k = 0; k < 5; k++){
          applyEdit(()=>{
            const f = workingEntry(id);
            const o = entryOpts(f.entry);
            const n = nodes.get(id);
            o.pos = [+(n.x + dx).toFixed(2), +(n.y + dy).toFixed(2)];
            putEntry(f.index, f.entry, o);
          });
          await wait(90);
          const now = drawn('hh1', 'hh2');
          if(prev && now){
            const d = apart(prev, now);
            worst = Math.max(worst, d);
            steps.push(+d.toFixed(1));
          }
          prev = now;
        }
      }
      /* The entry moved 40 a step, so a route that follows it moves about
         that much. Twice it is a route that has been redrawn somewhere
         else — which is the jump. */
      out.bendHold = +worst.toFixed(1);
      out.bendHoldSteps = JSON.stringify(steps);
      out.bendHeld = worst < 80;
    }

    /* A stretch of a line is moved by its mark, and a corner by its own,
       and neither ever throws the line somewhere else.
     *
       The marks used to make a POINT the route was rebuilt round: which
       way round each elbow went was decided afresh at every step, and the
       port flipped to another face of the entry whenever the point
       crossed the entry's diagonal — the line jumping as a stretch was
       dragged along x. Now the drawn route is what is edited, and every
       frame of a drag is measured against the one before. */
    {
      const rt = ()=> drawnRoutes.get(calloutEdgeKey('hm1', 'hm2')).pts.map(q=> ({x:q.x, y:q.y}));
      const W = (x, y)=>{ const sr = svg.getBoundingClientRect(); return {x: sr.left + vx + x*vs, y: sr.top + vy + y*vs}; };
      const keepView = {vs, vx, vy};
      const setUp = (gone)=> applyEdit(()=>{
        const i1 = workingNodes.findIndex(x=> x[0] === 'hm1');
        if(i1 >= 0) workingNodes.splice(i1, 1);
        const i2 = workingNodes.findIndex(x=> x[0] === 'hm2');
        if(i2 >= 0) workingNodes.splice(i2, 1);
        const k = EDGE_STYLES.findIndex(s=> s.from === 'hm1');
        if(k >= 0) EDGE_STYLES.splice(k, 1);
        if(gone) return;
        workingNodes.push(['hm1', 'Arm start', null, null, null, null, {pos: at(1200, 600)}]);
        workingNodes.push(['hm2', 'Arm end', 'hm1', null, null, null, {pos: at(1560, 840)}]);
      });
      const drag = async (g, dx, dy, steps)=>{
        const m = g.querySelector('.bend-mark');
        const cx = +m.getAttribute('cx'), cy = +m.getAttribute('cy');
        const p0 = W(cx, cy);
        g.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p0.x, clientY:p0.y}));
        let prev = rt(), worst = 0;
        for(let s = 1; s <= steps; s++){
          const p = W(cx + dx*s, cy + dy*s);
          window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:p.x, clientY:p.y}));
          const now = rt();
          worst = Math.max(worst, routeApart(prev, now));
          prev = now;
        }
        window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        await wait(120);
        return worst;
      };
      out.armJumps = {};
      for(const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]){
        setUp();
        await wait(250);
        vs = 1; vx = 400 - 9200; vy = 200 - 8600; applyTransform();
        bendHoverTarget = null; showBendsFor('hm1', 'hm2');
        for(const g of [...document.querySelectorAll('#bendLayer .bend-ghost')]){
          const k = g.dataset.arm;
          const fresh = document.querySelector(`#bendLayer .bend-ghost[data-arm="${k}"]`);
          if(!fresh) continue;
          const w = await drag(fresh, dx, dy, 30);
          out.armJumps[`${k}:${dx},${dy}`] = +w.toFixed(1);
          setUp();
          await wait(200);
          bendHoverTarget = null; showBendsFor('hm1', 'hm2');
        }
      }
      // A stretch dragged moves sideways to where it was dragged, whole.
      setUp();
      await wait(250);
      bendHoverTarget = null; showBendsFor('hm1', 'hm2');
      {
        const g = document.querySelector('#bendLayer .bend-ghost-v');
        const x0 = +g.querySelector('.bend-mark').getAttribute('cx');
        await drag(g, 4, 1, 15);
        const ups = rt().filter((q, i, a)=> i && Math.abs(a[i-1].x - q.x) < 0.5 && Math.abs(a[i-1].y - q.y) > 1).map(q=> q.x);
        out.armMoved = ups.some(x=> Math.abs(x - snapToGrid(x0 + 60)) < 1) ? true : JSON.stringify({x0, ups});
        /* …and the route is pinned at its ends as well as its corners:
           the sides are written down with the points, and go with them. */
        const st = EDGE_STYLES.find(s=> s.from === 'hm1' && s.to === 'hm2');
        out.sidesKept = !!st && Array.isArray(st.bendSides) && st.bendSides.length === 2 &&
          /bendSides:\s*\[/.test(serializeEdgeStyles(EDGE_STYLES));
        applyEdit(()=>{ setBendList('hm1', 'hm2', []); });
        const st2 = EDGE_STYLES.find(s=> s.from === 'hm1' && s.to === 'hm2');
        out.sidesCleared = !st2 || !st2.bendSides;
      }
      // A corner dragged both ways moves its two stretches, without a jump.
      setUp();
      await wait(250);
      bendHoverTarget = null; showBendsFor('hm1', 'hm2');
      await drag(document.querySelector('#bendLayer .bend-ghost-v'), 4, 0, 10);
      bendHoverTarget = null; showBendsFor('hm1', 'hm2');
      out.cornerJumps = [];
      for(const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3]]){
        const h = document.querySelector('#bendLayer .bend-handle');
        if(!h){ out.cornerJumps.push('no handle'); break; }
        out.cornerJumps.push(+(await drag(h, dx, dy, 12)).toFixed(1));
        bendHoverTarget = null; showBendsFor('hm1', 'hm2');
      }
      /* And with the line pinned, its entry carried right up to its own
         corner and past: the corner is pushed ahead of the entry rather
         than set aside, which redrew the whole line some other way. */
      setUp();
      await wait(250);
      bendHoverTarget = null; showBendsFor('hm1', 'hm2');
      await drag(document.querySelector('#bendLayer .bend-ghost-v'), 4, 0, 10);
      out.pushJumps = [];
      for(const [id, dx, dy] of [['hm1', 12, 0], ['hm2', -12, 0], ['hm1', 0, 12], ['hm2', 0, -12]]){
        let prev = rt(), worst = 0;
        /* From where it was saved, not from where it is drawn: the two
           differ by a few units, and adding the step to the drawn place
           carried the entry sideways as well, a little more each time. */
        const pos0 = entryOpts(workingEntry(id).entry).pos.slice();
        for(let k = 0; k < 20; k++){
          applyEdit(()=>{
            const f = workingEntry(id);
            const o = entryOpts(f.entry);
            o.pos = [pos0[0] + dx*(k + 1), pos0[1] + dy*(k + 1)];
            putEntry(f.index, f.entry, o);
          });
          const now = rt();
          worst = Math.max(worst, routeApart(prev, now));
          prev = now;
        }
        out.pushJumps.push(+worst.toFixed(1));
        setUp();
        await wait(150);
        bendHoverTarget = null; showBendsFor('hm1', 'hm2');
        await drag(document.querySelector('#bendLayer .bend-ghost-v'), 4, 0, 10);
      }
      /* An entry carried across its own line's stretch — or a port slid
         along its face by any other means — takes that stretch with it,
         rather than stepping up to where the port used to be. */
      {
        const pos0 = entryOpts(workingEntry('hm1').entry).pos.slice();
        const before = rt().length;
        applyEdit(()=>{
          const f = workingEntry('hm1');
          const o = entryOpts(f.entry);
          o.pos = [pos0[0], pos0[1] + 36];
          putEntry(f.index, f.entry, o);
        });
        const now = rt();
        out.levelKept = now.length <= before ? true : JSON.stringify(now.map(q=> [Math.round(q.x), Math.round(q.y)]));
      }
      bendHoverTarget = null; drawBendHandles();
      setUp(true);
      out.grid = GRID;
      vs = keepView.vs; vx = keepView.vx; vy = keepView.vy; applyTransform();
    }

    /* The two the owner drew in ordinary work and saved: a bend between two
       entries that only a route through one of them could reach, and the
       same under an entry turned upside down. */
    applyEdit(()=>{
      workingNodes.push(['hw3', 'Прчоао', null, null, null, null, {pos: at(-171.19, 113.88)}]);
      workingNodes.push(['hw4', 'Човьлы', 'hw3', null, null, null, {pos: at(-221.59, 134.02)}]);
      workingNodes.push(['hw5', 'Пролл', null, null, null, null, {pos: at(-142.71, 253.7)}]);
      workingNodes.push(['hw6', 'Гаягкягкч', 'hw5', null, null, null, {pos: at(-70.49, 234.72), rot:180}]);
      EDGE_STYLES.push({from:'hw3', to:'hw4', routing:'orthogonal', dash:'solid', arrow:true,
                        bends:[at(-201.4, 191.33)], fromSide:'bottom', toSide:'bottom'});
      EDGE_STYLES.push({from:'hw5', to:'hw6', routing:'orthogonal', dash:'solid', arrow:true,
                        bends:[at(-40.28, 211.47)], fromSide:'top', toSide:'top', square:true});
    });
    await wait(300);
    out.saved = [['hw3','hw4'], ['hw5','hw6']].map(([f, t])=> broken(drawn(f, t), nodes.get(f), nodes.get(t)));

    /* And every bend on a coarse grid round two entries, from every side to
       every side: none may come out through an end or doubled back. */
    const bad = [];
    for(const [bx, by] of [[120, 60], [-30, 25]]){
      applyEdit(()=>{
        workingNodes = workingNodes.filter(it=> !/^hz/.test(it[0]));
        workingNodes.push(['hzA', 'Alpha one', null, null, null, null, {pos: at(0, 600)}]);
        workingNodes.push(['hzB', 'Beta', 'hzA', null, null, null, {pos: at(bx, 600 + by)}]);
      });
      const a = nodes.get('hzA'), b = nodes.get('hzB');
      for(const fs of ['top','bottom','left','right']) for(const ts of ['top','bottom','left','right']){
        const p1 = Object.assign(portOnSide(a, fs, 0, 1), {owner:'hzA'});
        const p2 = Object.assign(portOnSide(b, ts, 0, 1), {owner:'hzB'});
        for(let gx = -60; gx <= 180; gx += 40) for(let gy = -60; gy <= 120; gy += 40){
          const st = Object.assign({}, DEFAULT_EDGE_STYLE, {bends:[[a.x + gx, a.y + gy]]});
          resetRoutedSegments();
          const why = broken(pathFromPorts(p1, p2, st, new Set(['hzA','hzB']), 0).pts, a, b);
          if(why) bad.push([bx, fs, ts, gx, gy, why].join(' '));
        }
      }
    }
    out.fuzz = bad;

    /* Two lineages leaving along the bar's own direction: each turns once
       towards the bar and once onto it, and never makes an S. */
    const G = GRID;
    applyEdit(()=>{
      workingNodes.push(['hmA', 'фыфывфывфыв', null, null, null, null, {pos: at(0, 1200)}]);
      workingNodes.push(['hmB', 'фячсячс', null, null, null, null, {pos: at(G, 1200 + G*18)}]);
      workingNodes.push(['hmT', 'фывфыв', ['hmA','hmB'], null, null, null, {merge:true, pos: at(G*34, 1200 + G*9)}]);
      EDGE_STYLES.push({from:'hmA', to:'hmT', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom'});
      EDGE_STYLES.push({from:'hmB', to:'hmT', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'top'});
    });
    await wait(300);
    out.lineages = ['hmA', 'hmB'].map(f=>{
      const p = [...document.querySelectorAll('#edgeLayer path.edge')].find(e=> e.dataset.from === f && e.dataset.to === 'hmT');
      return p ? (p.getAttribute('d').match(/Q/g) || []).length : -1;
    });

    /* The turn is a button in the style bar, on every kind of entry. */
    applyEdit(()=>{
      workingNodes.push(['htR', 'A long entry name', null, null, null, null, {pos: at(0, 1700), tags:['fan-fiction']}]);
      workingNodes.push(['htC', 'Card entry', null, null, 'Note body', null, {pos: at(300, 1700), card:true}]);
      workingNodes.push(['htP', 'Portrait', null, null, null, 'ellipse', {pos: at(0, 1900)}]);
      workingNodes.push(['htT', 'Caption', null, null, null, 'textbox', {pos: at(300, 1900)}]);
    });
    await wait(300);
    const turnBtn = ()=> document.querySelector('#styleBar [data-group="turn"] button');
    out.turned = {};
    for(const id of ['htR', 'htC', 'htP']){
      const n = nodes.get(id);
      const was = {cx: n.x + n.w/2, cy: n.y + n.h/2, w: n.w, h: n.h};
      openStyleBar({kind:'node', id});
      const btn = turnBtn();
      if(!btn || btn.parentNode.hidden || styleBar.hidden){ out.turned[id] = 'no button'; continue; }
      const barAt = styleBar.style.left + ',' + styleBar.style.top;
      btn.click();
      await wait(120);
      const m = nodes.get(id);
      const wrap = document.querySelector(`.node[data-id="${id}"] > .turned-piece`);
      /* The bar stays where it was, so the button can be pressed again
         without chasing it across the chart. */
      out.barStill = (out.barStill !== false) && styleBar.style.left + ',' + styleBar.style.top === barAt;
      out.turned[id] = quarterTurnOf(m) === 90 && !!wrap &&
        Math.abs(m.w - was.h) < 0.6 && Math.abs(m.h - was.w) < 0.6 &&
        Math.abs(m.x + m.w/2 - was.cx) < 0.02 && Math.abs(m.y + m.h/2 - was.cy) < 0.02 &&
        styleBarTarget && styleBarTarget.id === id && !styleBar.hidden;
    }
    /* A portrait's card goes round the portrait with it. */
    {
      openBioCard('htP', true);
      await wait(150);
      const holder = bioCardLayer.querySelector('.bio-card-turn');
      const card = bioCardLayer.querySelector('.bio-card-g[data-id="htP"]');
      out.bioCardTurns = !!holder && !!card && holder.contains(card) &&
        /^rotate\(90,/.test(holder.getAttribute('transform') || '');
      out.bioCardAt = holder ? holder.getAttribute('transform') : 'no turned card';
      closeBioCard();
    }
    /* Its ground turns with it, and keeps the turn while it is carried. */
    const piece = fanLayer.querySelector('[data-ground="htR"] > *');
    out.groundTurned = !!piece && /^rotate\(90,/.test(piece.dataset.rotTransform || '');
    /* Furniture wears a bar of ONE row — where it stands in the stack —
       and no quarter turn: it turns freely, by the handle at its corner. */
    applyEdit(()=>{ workingNodes.push(['htI', '', null, null, null, 'image', {pos: at(600, 1900), size:[120, 60]}]); });
    await wait(250);
    out.freeBar = {};
    for(const id of ['htT', 'htI']){
      openStyleBar({kind:'node', id});
      nodeControlsOn(id);
      const shown = [...styleBar.querySelectorAll('.style-bar-group')]
        .filter(r=> !r.hidden).map(r=> r.dataset.group);
      /* A caption has words, so it wears their side as well (the owner's
         list of 11.11); a picture has the stack alone. */
      const want = id === 'htT' ? 'align,stack' : 'stack';
      out.freeBar[id] = (!styleBar.hidden && shown.join() === want &&
                         !!document.querySelector(`.node[data-id="${id}"] .node-rotate`)) ||
                        JSON.stringify({open: !styleBar.hidden, shown});
    }
    /* …and the bar clears that handle rather than standing over it.
       Measured with the picture actually on the screen: off it, the bar
       is clamped to the window's edge and would clear anything. */
    {
      const keep = {vs, vx, vy};
      const pic0 = nodes.get('htI');
      vs = 1; vx = 400 - pic0.x; vy = 300 - pic0.y; applyTransform();
      openStyleBar({kind:'node', id:'htI'});
      nodeControlsOn('htI');
      const handle = document.querySelector('.node[data-id="htI"] .node-rotate');
      const a = styleBar.getBoundingClientRect(), b = handle.getBoundingClientRect();
      out.barClearsHandle = a.right <= b.left + 0.5 || a.left >= b.right - 0.5 ||
                            a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5;
      out.barAtHandle = JSON.stringify({bar:[a.left, a.top, a.right, a.bottom].map(Math.round),
                                        handle:[b.left, b.top, b.right, b.bottom].map(Math.round)});
      out.barOnScreen = a.width > 0 && a.left > 4 && b.width > 0;
      vs = keep.vs; vx = keep.vx; vy = keep.vy; applyTransform();
    }
    /* That one button is a toggle, lit while the thing is behind the
       chart — the two buttons it replaced were one yes-or-no asked twice. */
    {
      const stackBtn = ()=> document.querySelector('#styleBar [data-group="stack"] button');
      openStyleBar({kind:'node', id:'htI'});
      stackBtn().click();
      await wait(180);
      out.picBehind = (nodes.get('htI').z || 0) < 0 &&
        !!backLayer.querySelector('.node[data-id="htI"]') && stackBtn().classList.contains('on');
      stackBtn().click();
      await wait(180);
      out.picFront = (nodes.get('htI').z || 0) > 0 &&
        !!frontLayer.querySelector('.node[data-id="htI"]') && !stackBtn().classList.contains('on');
      closeStyleBar();
    }
    /* And the handle turns a picture to any angle, as it turns a caption.
       Only the drawing turns: the box the chart reasons with stays
       upright, so a picture no longer swaps its sides. */
    {
      const n = nodes.get('htI');
      const was = {w: n.w, h: n.h};
      nodeControlsOn('htI');
      const g0 = document.querySelector('.node[data-id="htI"]');
      const handle = g0 && g0.querySelector('.node-rotate');
      const cx = n.x + n.w/2, cy = n.y + n.h/2;
      const sr = svg.getBoundingClientRect();
      const toClient = (wx, wy)=> ({x: sr.left + vx + wx*vs, y: sr.top + vy + wy*vs});
      const reach = Math.max(n.w, n.h);
      const a0 = Math.atan2(n.y - cy, n.x - cx);
      const a1 = a0 + 32*Math.PI/180;
      const p0 = toClient(cx + Math.cos(a0)*reach, cy + Math.sin(a0)*reach);
      const p1 = toClient(cx + Math.cos(a1)*reach, cy + Math.sin(a1)*reach);
      handle.dispatchEvent(new MouseEvent('mousedown',
        {bubbles:true, cancelable:true, button:0, clientX:p0.x, clientY:p0.y}));
      window.dispatchEvent(new MouseEvent('mousemove',
        {bubbles:true, cancelable:true, clientX:p1.x, clientY:p1.y}));
      window.dispatchEvent(new MouseEvent('mouseup',
        {bubbles:true, cancelable:true, clientX:p1.x, clientY:p1.y}));
      await wait(300);
      const m = nodes.get('htI');
      const g = document.querySelector('.node[data-id="htI"]');
      out.pictureAngle = m.rot || 0;
      out.pictureTurned = Math.abs((m.rot || 0) - 32) < 1.5 && quarterTurnOf(m) === 0 &&
        Math.abs(m.w - was.w) < 0.6 && Math.abs(m.h - was.h) < 0.6 &&
        /^rotate\(3[12],/.test((g && g.getAttribute('transform')) || '');
    }

    /* The field opens exactly over the entry, at whatever zoom — never
       bigger — and is turned with a turned one. */
    applyEdit(()=>{
      workingNodes.push(['heA', 'Ab', null, null, null, null, {pos: at(0, 2300)}]);
      workingNodes.push(['heB', 'Two\nlines', null, null, null, null, {pos: at(100, 2300)}]);
      workingNodes.push(['heC', '', null, null, null, 'callout', {pos: at(200, 2300)}]);
    });
    await wait(300);
    const sizes = [];
    const vs0 = vs, vx0 = vx, vy0 = vy;
    for(const z of [0.5, 1, 2.5]){
      const n0 = nodes.get('heA');
      vs = z; vx = 300 - n0.x*vs; vy = 300 - n0.y*vs; applyTransform();
      for(const id of ['heA', 'heB', 'heC', 'htR']){
        openNodeEditor(id);
        await wait(60);
        /* No frame: what is seen of the field is its words, and the
           words drawn under it are out of sight while it is open and
           back once it is let go of (the owner's word of 20.11). */
        const drawn = ()=> [...document.querySelectorAll(`.node[data-id="${id}"] .node-label-text`)];
        const surf = richFields.get('nodeEditorText').surface;
        const frame = getComputedStyle(surf, '::before').content;
        /* One copy of the words is seen, never two: the drawn ones veiled
           under the field's, or — over an entry, since 24.11 — the drawn
           ones seen through a field whose own ink is clear. */
        const through = document.getElementById('nodeEditor').classList.contains('ink-from-drawing');
        const veiled = through
          ? drawn().every(e=> getComputedStyle(e).opacity !== '0') && getComputedStyle(surf).color === 'rgba(0, 0, 0, 0)'
          : drawn().every(e=> getComputedStyle(e).opacity === '0');
        closeNodeEditor(true);
        await wait(30);
        const back = drawn().every(e=> getComputedStyle(e).opacity !== '0');
        if((frame !== 'none' && frame !== 'normal') || !veiled || !back) sizes.push([z, id, frame, veiled, back].join(' '));
        continue;
        closeNodeEditor(true);
      }
    }
    vs = vs0; vx = vx0; vy = vy0; applyTransform();
    out.editorTooBig = sizes;

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(300);
    return out;
  });
  check('the bends the owner saved no longer send a line through an entry or back on itself',
        rW.saved.every(f=> !f), JSON.stringify(rW.saved));
  check('no hand bend anywhere round two entries breaks the route', !rW.fuzz.length, rW.fuzz.slice(0, 4).join(' | '));
  check('a hand-bent route holds still while its entries are carried about',
        rW.bendHeld, JSON.stringify({worst: rW.bendHold, steps: rW.bendHoldSteps}));
  /* Two grid steps are the most a frame can move a line by. The hand
     moves less than one between frames and the line steps on the grid —
     except where a stretch leaves the line of a port or comes back onto
     it: a step shorter than a grid line is squared away into the corner
     (absorbBendOffsets), so the first place it can stand off that line is
     the second grid line, and it gets there in one frame. */
  check('a stretch dragged along either axis never throws the line elsewhere',
        Object.values(rW.armJumps).length > 4 && Object.values(rW.armJumps).every(w=> w <= 2*rW.grid),
        JSON.stringify(rW.armJumps));
  check('and moves sideways, whole, to where it was dragged', rW.armMoved === true, String(rW.armMoved));
  check('a route pinned by hand keeps its sides with its corners, and loses them with them',
        rW.sidesKept && rW.sidesCleared, JSON.stringify({kept: rW.sidesKept, cleared: rW.sidesCleared}));
  check('a corner dragged either way moves its two stretches without a jump',
        rW.cornerJumps.length === 5 && rW.cornerJumps.every(w=> typeof w === 'number' && w <= 2*rW.grid),
        JSON.stringify(rW.cornerJumps));
  check('an entry carried into its own pinned corner pushes it ahead rather than throwing the line',
        rW.pushJumps.length === 4 && rW.pushJumps.every(w=> w <= 12 + 2), JSON.stringify(rW.pushJumps));
  check('a pinned stretch out of a port stays level with the port when the entry is carried across it',
        rW.levelKept === true, String(rW.levelKept));
  check('a lineage leaving along the bar turns only towards it and onto it',
        rW.lineages.every(k=> k >= 0 && k <= 2), JSON.stringify(rW.lineages));
  check('the style bar turns an entry, a card and a portrait a quarter clockwise, in place',
        Object.values(rW.turned).every(v=> v === true), JSON.stringify(rW.turned));
  check('the style bar stays where it was when its turn button is pressed', rW.barStill === true);
  check('a turned portrait takes its card round with it', rW.bioCardTurns, rW.bioCardAt);
  check('a turned entry\'s ground turns with it', rW.groundTurned);
  check('furniture wears the stack button alone (a caption its words\' side too), and keeps its own handle',
        rW.freeBar.htT === true && rW.freeBar.htI === true,
        JSON.stringify(rW.freeBar));
  check('and the bar stands clear of that handle',
        rW.barClearsHandle && rW.barOnScreen, rW.barAtHandle);
  check('one button puts a picture behind the chart and back in front',
        rW.picBehind && rW.picFront,
        JSON.stringify({behind: rW.picBehind, front: rW.picFront}));
  check('a picture turns to any angle by its handle, and keeps its sides',
        rW.pictureTurned, 'turned to ' + rW.pictureAngle);
  check('the inline field has no frame, and only one copy of its words is seen until it closes, at any zoom and turned or not',
        !rW.editorTooBig.length, rW.editorTooBig.slice(0, 4).join(' | '));
  });

  /* ---- 29. nothing threw along the way ---- */
  await scenario("words spaced as drawn, a field that does not squeeze, a wavy merge and routes that hold still", async () => {
  const rS = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(430, 260);
    const X = Math.round(w0.x / 10) * 10, Y = Math.round(w0.y / 10) * 10;
    deselect();

    /* ---- the gap between two words is a space, not a guess ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['wsA','Beast Wars: Uprising',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['wsB','Two\nlines',null,null,null,null,{pos:[X + 300, Y]}]);
    });
    await wait(400);
    {
      const spans = [...document.querySelectorAll('.node[data-id="wsA"] text tspan')];
      /* In the face the entry is drawn in, not in measureText's default. */
      const face = {family: fontFamilyFor(null)};
      const space = measureText('a a', face) - measureText('aa', face);
      /* What the layout decided: each word starts one measured word and one
         space after the last. That is exact, and it is the claim — a gap
         that is a space, not the old 6.5-per-character guess at one. */
      const advances = spans.slice(1).map((t, i)=>
        parseFloat(t.getAttribute('x')) - parseFloat(spans[i].getAttribute('x')) - measureText(spans[i].textContent, face));
      /* What the browser drew. A word drawn under the chart's zoom is shaped
         at that scale and can come out a twentieth of a pixel off the same
         word measured unscaled — Chromium 156 does, where earlier ones did
         not — so the drawn gap is held to a tenth of a pixel. The guess this
         check was written against was off by three. */
      const gaps = spans.slice(1).map((t, i)=>
        parseFloat(t.getAttribute('x')) - parseFloat(spans[i].getAttribute('x')) - spans[i].getComputedTextLength());
      out.gaps = JSON.stringify({space: +space.toFixed(2), advances: advances.map(g=> +g.toFixed(3)), gaps: gaps.map(g=> +g.toFixed(2))});
      out.wordGapIsASpace = spans.length === 3 && space > 0 &&
        advances.every(g=> Math.abs(g - space) < 0.01) &&
        gaps.every(g=> Math.abs(g - space) < 0.1) && Math.abs(measureSpace(face) - space) < 0.01;
    }
    /* ---- the field keeps the drawing's line, however short the box ---- */
    {
      openNodeEditor('wsB');
      await wait(80);
      const surf = richFields.get('nodeEditorText').surface;
      const want = parseFloat(surf.dataset.lineH);
      out.fieldLine = JSON.stringify({want, got: getComputedStyle(surf).lineHeight});
      out.fieldKeepsLine = want > 0 && Math.abs(parseFloat(getComputedStyle(surf).lineHeight) - want) < 0.05;
      closeNodeEditor(true);
    }

    /* ---- a wavy lineage waves along its stretch of the bar ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      ['A','B','C','D'].forEach((k, i)=>
        workingNodes.push(['wm' + k, 'P ' + k, null, null, null, null, {pos:[X + i*230, Y]}]));
      workingNodes.push(['wmM','Merge',['wmA','wmB','wmC','wmD'],null,null,null,{merge:true, pos:[X + 260, Y + 320]}]);
    });
    await wait(500);
    const memberD = (f)=>{
      const p = document.querySelector(`#edgeLayer path.amalgam-member:not(.amalgam-reach)[data-from="${f}"][data-to="wmM"]`);
      return p ? p.getAttribute('d') : '';
    };
    /* A middle lineage owns a stretch of bar after its turn: the last run
       of its path. Plain, that run is one straight L; wavy, it is curves. */
    const tail = (d)=> d.slice(d.lastIndexOf('M'));
    const middle = ['wmB','wmC'].filter(f=> / L[\d.-]+,[\d.-]+$/.test(memberD(f)));
    out.plainBar = middle.length > 0;
    applyEdit(()=>{
      ['wmA','wmB','wmC','wmD'].forEach(f=> setEdgeStyleOverride(f, 'wmM',
        Object.assign({}, edgeStyleFor(f, 'wmM'), {sinusoid:true})));
    });
    await wait(400);
    out.wavyBar = out.plainBar && middle.every(f=>{
      const d = memberD(f);
      return (d.match(/M/g) || []).length >= 2 && /C/.test(tail(d));
    });
    out.wavyBarAt = JSON.stringify(middle.map(f=> tail(memberD(f)).slice(0, 60)));
    /* The reach into the junction lies on the line beneath it, wavy or not. */
    {
      const reach = document.querySelector('#edgeLayer path.amalgam-reach');
      out.reachOnWave = !reach || /C/.test(reach.getAttribute('d') || '');
      /* …and lights with its own lineage. */
      if(reach){
        selectNode(reach.dataset.from);
        await wait(240);
        out.reachLit = reach.isConnected ? reach.classList.contains('lit')
          : !!document.querySelector('#edgeLayer path.amalgam-reach.lit');
        deselect();
        await wait(150);
      } else out.reachLit = true;
    }

    /* A bead stands on a disc of paper, so a bead stepped back with the
       rest of the merge does not show the bar through it. */
    {
      const beads = [...document.querySelectorAll('#edgeLayer .amalgam-bead')];
      const grounds = [...document.querySelectorAll('#edgeLayer .amalgam-bead-ground')];
      out.beadsGrounded = beads.length > 0 && beads.every(b=> grounds.some(g=>
        g.getAttribute('cx') === b.getAttribute('cx') && g.getAttribute('cy') === b.getAttribute('cy') &&
        +g.getAttribute('r') >= +b.getAttribute('r') &&
        g.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      selectNode('wmA');
      await wait(240);
      out.groundsOpaque = grounds.every(g=> getComputedStyle(g).opacity === '1' &&
        getComputedStyle(g).fill !== 'none');
      deselect();
      await wait(150);
    }

    /* ---- a corner pulled inward stops where the words are a pixel inside ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['mzA','A label with some width',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['mzB','A remark that wraps when it is narrow',null,null,null,'callout',{pos:[X + 400, Y]}]);
    });
    await wait(400);
    out.floors = {};
    for(const id of ['mzA', 'mzB']){
      const n = nodes.get(id), g = document.querySelector(`.node[data-id="${id}"]`);
      const natural = {w: n.w, h: n.h};
      beginNodeResize(new MouseEvent('mousedown', {button:0, clientX:400, clientY:300}), n, g,
                      {key:'se', sx:1, sy:1});
      for(let k = 1; k <= 6; k++){
        window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX: 400 - k*80, clientY: 300 - k*40}));
        await wait(16);
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(300);
      const m = nodes.get(id);
      const box = document.querySelector(`.node[data-id="${id}"] > rect`).getBoundingClientRect();
      const ink = document.querySelector(`.node[data-id="${id}"] > text`).getBoundingClientRect();
      out.floors[id] = {natural, now: {w: m.w, h: m.h}, min: m.minSize,
        inside: ink.left >= box.left - 0.5 && ink.right <= box.right + 0.5 &&
                ink.top >= box.top - 0.5 && ink.bottom <= box.bottom + 0.5};
    }
    out.resizeFloored = Object.values(out.floors).every(f=> f.min &&
      f.now.w >= f.min.w - 0.01 && f.now.h >= f.min.h - 0.01 && f.inside &&
      f.now.w < f.natural.w + 0.01);

    /* ---- carrying one entry leaves every unrelated route where it was ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['rhU','Upper',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['rhV','Lower','rhU',null,null,null,{pos:[X + 260, Y + 260]}]);
      workingNodes.push(['rhW','Carried',null,null,null,null,{pos:[X + 600, Y]}]);
      workingNodes.push(['rhZ','Its child','rhW',null,null,null,{pos:[X + 600, Y + 260]}]);
    });
    await wait(500);
    {
      const dOf = (f, t)=>{ const p = document.querySelector(`#edgeLayer path.edge[data-from="${f}"][data-to="${t}"]`); return p ? p.getAttribute('d') : null; };
      const still = dOf('rhU', 'rhV'), own0 = dOf('rhW', 'rhZ');
      const g = document.querySelector('.node[data-id="rhW"]');
      const r = g.getBoundingClientRect();
      const sx = r.x + r.width/2, sy = r.y + r.height/2;
      g.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:sx, clientY:sy}));
      let moved = 0, ownChanged = false;
      for(let k = 1; k <= 16; k++){
        window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX: sx - k*9, clientY: sy + k*3}));
        await wait(20);
        if(dOf('rhU', 'rhV') !== still) moved++;
        if(dOf('rhW', 'rhZ') !== own0) ownChanged = true;
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(300);
      out.routeHeld = !!still && moved === 0 && ownChanged;
      out.routeHeldAt = JSON.stringify({moved, ownChanged});
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(300);
    return out;
  });
  check('the gap between two words is the width of a space', rS.wordGapIsASpace, rS.gaps);
  check('the inline editor keeps the line the entry draws its words on', rS.fieldKeepsLine, rS.fieldLine);
  check('a wavy lineage waves along its stretch of the bar too', rS.wavyBar, rS.wavyBarAt);
  check('the reach into the junction lies on the line beneath it, and lights with its lineage',
        rS.reachOnWave && rS.reachLit);
  check('an amalgam\'s dots stand on paper, so nothing shows through them',
        rS.beadsGrounded && rS.groundsOpaque);
  check('a corner pulled inward stops where the words are a pixel inside the border',
        rS.resizeFloored, JSON.stringify(rS.floors));
  check('carrying an entry leaves the routes it has nothing to do with where they were',
        rS.routeHeld, rS.routeHeldAt);

  });

  await scenario("a merge that keeps its middle, a leader with a line of its own, a curve and a field the size of a remark", async () => {
  const rR = await page.evaluate(async () => {
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const w0 = clientToWorld(430, 260);
    const X = snapToGrid(w0.x), Y = snapToGrid(w0.y);
    deselect();

    /* ---- a merge is put back on the middle of its bar with every parent ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['rmA','One',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['rmB','Two',null,null,null,null,{pos:[snapToGrid(X + 200), Y]}]);
      workingNodes.push(['rmC','Three',null,null,null,null,{pos:[snapToGrid(X + 600), Y]}]);
      workingNodes.push(['rmM','Merge',['rmA','rmB'],null,null,null,
                         {merge:true, pos:[snapToGrid(X + 100), snapToGrid(Y + 150)]}]);
    });
    await wait(400);
    connectNodes('rmC', 'rmM');
    await wait(400);
    {
      const n = nodes.get('rmM'), bar = amalgamBars.get('rmM');
      const mid = bar ? (bar.lo + bar.hi) / 2 : NaN;
      const lowest = nodes.get('rmC').y + nodes.get('rmC').h;
      out.recentredAt = JSON.stringify({centre: +(n.x + n.w/2).toFixed(2), mid: +mid.toFixed(2),
                                        top: n.y, parents: lowest});
      /* On the middle, and near its parents — not thrown far below them. */
      out.recentred = Math.abs(n.x + n.w/2 - mid) < 0.5 && n.y > lowest && n.y - lowest < 200;
    }

    /* ---- a column of parents: an upright bar, and no hooks ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      ['A','B','C','D'].forEach((k, i)=>
        workingNodes.push(['ccP' + k, 'P ' + k, null, null, null, null,
                           {pos:[X, snapToGrid(Y + i*120)]}]));
      workingNodes.push(['ccM','Merge',['ccPA','ccPB','ccPC','ccPD'],null,null,null,
                         {merge:true, pos:[snapToGrid(X + 100), snapToGrid(Y + 170)]}]);
    });
    await wait(500);
    {
      const bar = amalgamBars.get('ccM');
      /* A hook is a lineage that runs past the bar and turns back to it.
         Each member leaves its parent rightwards and meets an upright bar,
         so no x along its path may lie beyond where the bar stands. */
      const xs = [...document.querySelectorAll('#edgeLayer path.amalgam-member:not(.amalgam-reach)[data-to="ccM"]')]
        .map(p=> Math.max(...(p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number)
                             .filter((v, i)=> i % 2 === 0)));
      const n = nodes.get('ccM');
      out.columnAt = JSON.stringify({axis: bar && bar.axis, xs: xs.map(v=> +v.toFixed(1)), entry: n.x});
      out.columnUpright = !!bar && bar.axis === 'y' && xs.length === 4 && xs.every(v=> v < n.x);
      /* A bead where two lineages join belongs to those two, and steps back
         with the rest when an entry that is neither is picked. */
      selectNode('ccPA'); await wait(300);
      const joints = [...document.querySelectorAll('.amalgam-joint')];
      const own = joints.filter(c=> (c.dataset.pair || '').split('\u0000').includes('ccPA'));
      const other = joints.filter(c=> !(c.dataset.pair || '').split('\u0000').includes('ccPA'));
      out.jointsAt = JSON.stringify({own: own.length, other: other.length});
      out.jointsDim = own.length > 0 && other.length > 0 &&
        own.every(c=> !c.classList.contains('dim')) && other.every(c=> c.classList.contains('dim'));
      deselect(); await wait(200);
    }

    /* ---- a callout's leader wears a line of its own ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['llA','Up',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['llB','Down','llA',null,null,null,{pos:[X, snapToGrid(Y + 220)]}]);
      workingNodes.push(['llK','A remark',null,null,null,'callout',
                         {pos:[snapToGrid(X + 140), snapToGrid(Y + 100)],
                          leader:{from:'llA', to:'llB', at:0.5, line:'dashed'}}]);
    });
    await wait(500);
    {
      const line = ()=> document.querySelector('.callout-leader[data-id="llK"] .leader-line');
      const l = line();
      out.leaderDashed = !!l && l.getAttribute('stroke-dasharray') === DASH_PATTERNS.dashed;
      const conn = document.querySelector('#edgeLayer path.edge[data-from="llA"][data-to="llB"]');
      out.connectorUntouched = !!conn && !conn.getAttribute('stroke-dasharray');
      /* Pointing at the LINE opens the bar on it — the callout's one bar,
         the line's looks and the card's together (the owner's ask, 22.10). */
      const hitLine = document.querySelector('#leaderHitLayer .leader-line-hit[data-id="llK"]');
      if(hitLine) hitLine.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
      await wait(50);
      const row = document.querySelector('#styleBar .style-bar-group[data-group="leader"]');
      const border = document.querySelector('#styleBar .style-bar-group[data-group="border"]');
      out.leaderRowShown = !!hitLine && !!row && !row.hidden && !border.hidden &&
        !!styleBarTarget && styleBarTarget.kind === 'leader';
      row.querySelector('[data-value="sinusoid"]').click();
      await wait(400);
      const kept = entryOpts(workingEntry('llK').entry).leader;
      out.leaderWavy = kept.line === 'sinusoid' && !!document.querySelector('.callout-leader[data-id="llK"] .leader-wavy');
      openStyleBar({kind:'node', id:'llK'});
      // …and the card's bar is that same bar.
      out.leaderRowOnlyOnCallouts = !document.querySelector('#styleBar .style-bar-group[data-group="leader"]').hidden &&
        !document.querySelector('#styleBar .style-bar-group[data-group="border"]').hidden;
      openStyleBar({kind:'leader', id:'llK'});
      document.querySelector('#styleBar .style-bar-group[data-group="leader"] [data-value="solid"]').click();
      await wait(400);
      out.leaderSolidIsAbsence = !('line' in entryOpts(workingEntry('llK').entry).leader) &&
        !line().getAttribute('stroke-dasharray');
      closeStyleBar();

      /* ---- and its words, and a note's, are edited in a field their own size ---- */
      const fits = async (open)=>{
        open(); await wait(250);
        const rec = richFields.get('nodeEditorText');
        const box = nodeEditorBoxFor(nodeEditorTarget);
        const f = rec.surface.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(rec.surface).fontSize);
        const r = {fw: +f.width.toFixed(1), bw: +(box.w*vs).toFixed(1), fs: +(fs/vs).toFixed(2)};
        closeNodeEditor(true); await wait(150);
        return r;
      };
      const k = await fits(()=> openNodeEditor('llK'));
      applyEdit(()=>{ EDGE_STYLES.push({from:'llA', to:'llB', note:'a note here'}); });
      await wait(400);
      const nt = await fits(()=> openEdgeNoteEditor('llA', 'llB'));
      out.remarkFieldAt = JSON.stringify({callout: k, note: nt});
      out.remarkFieldFits = Math.abs(k.fw - k.bw) < 2 && Math.abs(k.fs - EDGE_NOTE_FS) < 0.05 &&
                            Math.abs(nt.fw - nt.bw) < 2 && Math.abs(nt.fs - EDGE_NOTE_FS) < 0.05;
    }

    /* ---- a curve: the elbowed route, drawn as one sweep through it ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['cvA','From',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['cvB','To','cvA',null,null,null,{pos:[snapToGrid(X + 260), snapToGrid(Y + 180)]}]);
      workingNodes.push(['cvC','Plain','cvA',null,null,null,{pos:[snapToGrid(X - 260), snapToGrid(Y + 180)]}]);
      EDGE_STYLES.push({from:'cvA', to:'cvB', routing:'curve', dash:'solid', arrow:true});
      /* The owner's sketch: one entry over another, joined right side to
         right side. Elbowed, that is a bracket; as a curve it is one bow. */
      workingNodes.push(['cvU','Upper one',null,null,null,null,{pos:[snapToGrid(X + 700), Y]}]);
      workingNodes.push(['cvL','Lower one','cvU',null,null,null,{pos:[snapToGrid(X + 700), snapToGrid(Y + 140)]}]);
      EDGE_STYLES.push({from:'cvU', to:'cvL', routing:'curve', dash:'solid', arrow:true,
                        fromSide:'right', toSide:'right'});
    });
    await wait(500);
    {
      const rec = drawnRoutes.get(calloutEdgeKey('cvA', 'cvB'));
      const pts = rec ? rec.pts : [];
      const plain = drawnRoutes.get(calloutEdgeKey('cvA', 'cvC'));
      const axisAligned = pts.every((p, i)=> !i ||
        Math.abs(p.x - pts[i-1].x) < 0.01 || Math.abs(p.y - pts[i-1].y) < 0.01);
      const pathOf = (f, t)=> (document.querySelector(
        `#edgeLayer path.edge[data-from="${f}"][data-to="${t}"]`) || {}).getAttribute?.('d') || '';
      const drawn = (d)=>{
        const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number), out = [];
        for(let i = 0; i + 1 < nums.length; i += 2) out.push({x: nums[i], y: nums[i+1]});
        return out;
      };
      const d = pathOf('cvA', 'cvB');
      const line = drawn(d);
      /* No turn is drawn as an elbow: the drawing passes every corner of
         the route at a distance an elbow's six-unit round never reaches.
         A point the route merely passes through on a straight run is not a
         corner, and the curve runs along it. */
      let nearest = Infinity;
      const turns = (i)=> Math.abs((pts[i].x - pts[i-1].x) * (pts[i+1].y - pts[i].y) -
                                   (pts[i].y - pts[i-1].y) * (pts[i+1].x - pts[i].x)) > 0.01;
      for(let i = 1; i < pts.length - 1; i++) if(turns(i))
        line.forEach(q=>{ nearest = Math.min(nearest, Math.hypot(q.x - pts[i].x, q.y - pts[i].y)); });
      /* The sketch: one bow, and it arrives at its head at a slant, as
         drawn. It used to stay inside the bracket the elbowed route would
         draw — which, with stubs a dozen units long, meant turning a right
         angle in two units at each end, the hook the owner circled on
         1.11. It swings out past the stubs now, as a hand's bow does, by
         less than half the height it spans. */
      const recS = drawnRoutes.get(calloutEdgeKey('cvU', 'cvL'));
      const ptsS = recS ? recS.pts : [];
      const lineS = drawn(pathOf('cvU', 'cvL'));
      const routeOut = Math.max(...ptsS.map(p=> p.x)), bowOut = Math.max(...lineS.map(p=> p.x));
      const heads = ptsS.length ? curveHeads(ptsS) : null;
      const slant = heads ? Math.abs(((heads.out % 90) + 90) % 90) : 0;
      out.curvePts = JSON.stringify(pts.map(p=>[+p.x.toFixed(1),+p.y.toFixed(1)]));
      out.curveAt = JSON.stringify({n: pts.length, plain: plain ? plain.pts.length : null, axisAligned,
                                    q: d.indexOf('Q'), lines: line.length, nearest: +nearest.toFixed(1),
                                    routeOut: +routeOut.toFixed(1), bowOut: +bowOut.toFixed(1),
                                    head: heads && +heads.out.toFixed(1)});
      /* The same points as an elbowed connector — so the same handles —
         and drawn through them as one sweep. */
      out.curveSmooth = pts.length >= 3 && pts.length < 12 && axisAligned && d.indexOf('Q') < 0 &&
                        line.length > 20 && nearest > 4 * EDGE_CORNER_R;
      const spanS = ptsS.length ? Math.max(...ptsS.map(p=> p.y)) - Math.min(...ptsS.map(p=> p.y)) : 0;
      out.curveSketch = ptsS.length >= 4 && bowOut > routeOut && bowOut < routeOut + spanS / 2 && slant > 5 && slant < 85;
      /* The stretch the head stands on, and the few units the line runs
         before it, lie on the head's own axis — plain and wavy alike — and
         the line's last step points the way the head does, so it meets the
         head's base square, with no notch beside it. */
      {
        const tip = ptsS[ptsS.length - 1] || {x:0, y:0}, a = (heads ? heads.out : 0) * Math.PI / 180;
        const off = (q)=> Math.abs((q.x - tip.x) * Math.sin(a) - (q.y - tip.y) * Math.cos(a));
        const near = (list)=> list.filter(q=> Math.hypot(q.x - tip.x, q.y - tip.y) < ARROW_TRIM + 3);
        const plainOff = Math.max(0, ...near(lineS).map(off));
        const wavyOff = Math.max(0, ...near(drawn(wavyPath(ptsS, 0, ARROW_TRIM, false, CURVE_CORNER_R))).map(off));
        const e1 = lineS[lineS.length - 1] || tip;
        const e0 = lineS.slice().reverse().find(q=> Math.hypot(q.x - e1.x, q.y - e1.y) > 1) || tip;
        const lastDeg = Math.atan2(e1.y - e0.y, e1.x - e0.x) * 180 / Math.PI;
        const turn = Math.abs(((lastDeg - (heads ? heads.out : 0)) % 360 + 540) % 360 - 180);
        out.curveTailAt = JSON.stringify({plain: +plainOff.toFixed(2), wavy: +wavyOff.toFixed(2),
                                          n: near(lineS).length, turn: +turn.toFixed(2)});
        out.curveTailOnHead = !!heads && near(lineS).length > 1 && plainOff < 0.3 && wavyOff < 0.3 && turn < 1;
      }
      const option = document.querySelector('#styleRouting option[value="curve"]');
      out.curveOffered = !!option;
    }

    /* ---- and a merge that loses a lineage goes back to its middle ---- */
    applyEdit(()=>{
      workingNodes.length = 0; refill(EDGE_STYLES, []);
      workingNodes.push(['rdA','One',null,null,null,null,{pos:[X, Y]}]);
      workingNodes.push(['rdB','Two',null,null,null,null,{pos:[snapToGrid(X + 200), Y]}]);
      workingNodes.push(['rdC','Three',null,null,null,null,{pos:[snapToGrid(X + 600), Y]}]);
      workingNodes.push(['rdM','Merge',['rdA','rdB','rdC'],null,null,null,
                         {merge:true, pos:[snapToGrid(X + 300), snapToGrid(Y + 150)]}]);
    });
    await wait(400);
    {
      const centred = ()=>{
        const n = nodes.get('rdM'), bar = amalgamBars.get('rdM');
        return bar ? +(n.x + n.w/2 - (bar.lo + bar.hi)/2).toFixed(2) : null;
      };
      deleteEdges([{from:'rdC', to:'rdM'}]);
      await wait(400);
      const afterEdge = centred();
      applyEdit(()=>{
        const f = workingEntry('rdM');
        f.entry[2] = ['rdA','rdB','rdC'];
        putEntry(f.index, f.entry, entryOpts(f.entry));
        workingNodes.push(['rdD','Four',null,null,null,null,{pos:[snapToGrid(X + 900), Y]}]);
      });
      await wait(300);
      connectNodes('rdD', 'rdM');
      await wait(300);
      deleteNode('rdD');
      await wait(400);
      const afterEntry = centred();
      out.lossAt = JSON.stringify({afterEdge, afterEntry});
      out.lossRecentres = afterEdge !== null && Math.abs(afterEdge) < 0.5 &&
                          afterEntry !== null && Math.abs(afterEntry) < 0.5;
      /* The strips that light up on a merge's border are its gradient, laid
         across the entry as the border's own is, not its first colour. */
      nodeControlsOn('rdM');
      const bands = [...document.querySelectorAll('.node[data-id="rdM"] .node-handle-band')];
      const grads = bands.map(b=> (b.getAttribute('style') || '').match(/url\(#([^)]+)\)/))
        .map(m=> m && document.getElementById(m[1]));
      out.bandGradAt = JSON.stringify({bands: bands.length,
        grads: grads.map(g=> g ? g.getAttribute('gradientUnits') + ':' + g.querySelectorAll('stop').length : null)});
      out.bandGrad = bands.length > 0 && grads.every(g=> g && g.getAttribute('gradientUnits') === 'userSpaceOnUse' &&
                                                        g.querySelectorAll('stop').length >= 2);

      /* The bar, carried, shows a guide as it comes level with an entry's
         edge, and settles on that level rather than on the grid next to it. */
      const bar0 = amalgamBars.get('rdM');
      const level = bar0 ? bar0.cross + 13.3 : 0;
      applyEdit(()=>{
        workingNodes.push(['rdG','Level',null,null,null,null,{pos:[snapToGrid(X + 1100), level]}]);
      });
      await wait(300);
      const g0 = nodes.get('rdG');
      const top = g0 ? g0.y : null;
      const fake = {button:0, clientX:400, clientY:300, stopPropagation(){}, preventDefault(){}};
      const bar1 = amalgamBars.get('rdM');
      const spec = barSpecFor('rdM');
      const sgn = spec && spec.after ? 1 : -1;
      beginBarDrag(fake, 'rdM');
      const dy = ((top - bar1.cross) + 1.2) * vs;
      // Not without Shift: a guide is asked for, as it is for an entry.
      window.dispatchEvent(new MouseEvent('mousemove', {clientX:400, clientY:300 + dy * sgn * (spec.k === 'y' ? 1 : 0),
                                                        bubbles:true}));
      await wait(100);
      const guideUnasked = document.querySelectorAll('#guideLayer .align-guide-line').length;
      window.dispatchEvent(new MouseEvent('mousemove', {clientX:400, clientY:300 + dy * sgn * (spec.k === 'y' ? 1 : 0),
                                                        shiftKey:true, bubbles:true}));
      await wait(100);
      const guideShown = document.querySelectorAll('#guideLayer .align-guide-line').length;
      window.dispatchEvent(new MouseEvent('mouseup', {clientX:400, clientY:300 + dy, bubbles:true}));
      await wait(300);
      const bar2 = amalgamBars.get('rdM');
      out.barGuideAt = JSON.stringify({k: spec && spec.k, top, before: bar1 && +bar1.cross.toFixed(2),
                                       after: bar2 && +bar2.cross.toFixed(2), guideUnasked, guideShown,
                                       left: document.querySelectorAll('#guideLayer .align-guide-line').length});
      out.barGuide = !!spec && spec.k === 'y' && guideUnasked === 0 && guideShown === 1 && !!bar2 && Math.abs(bar2.cross - top) < 0.01 &&
                     document.querySelectorAll('#guideLayer .align-guide-line').length === 0;
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(300);
    return out;
  });
  check('a merge given another parent is put back on the middle of its bar, beside its parents',
        rR.recentred, rR.recentredAt);
  check('a bead where two lineages join steps back unless one of the two is picked',
        rR.jointsDim, rR.jointsAt);
  check('parents in a column merge across an upright bar, with no lineage hooking past it',
        rR.columnUpright, rR.columnAt);
  check('a callout\'s leader wears its own line, chosen on the callout\'s one bar, from the line or the card',
        rR.leaderDashed && rR.connectorUntouched && rR.leaderRowShown && rR.leaderWavy &&
        rR.leaderRowOnlyOnCallouts && rR.leaderSolidIsAbsence,
        JSON.stringify({dashed:rR.leaderDashed, conn:rR.connectorUntouched, row:rR.leaderRowShown,
                        wavy:rR.leaderWavy, only:rR.leaderRowOnlyOnCallouts, solid:rR.leaderSolidIsAbsence}));
  check('a callout and a note are edited in a field their own size, in their own type',
        rR.remarkFieldFits, rR.remarkFieldAt);
  check('a curve is one sweep through the elbowed route, and bends at the same handles',
        rR.curveSmooth && rR.curveOffered, rR.curveAt + rR.curvePts);
  check('a curve from one entry\'s side to the one under it is one bow, met at a slant',
        rR.curveSketch, rR.curveAt);
  check('a curve arrives along its head\'s axis, so the head meets the line without a notch',
        rR.curveTailOnHead, rR.curveTailAt);
  check('a merge that loses a lineage, by its connector or its entry, goes back to the middle',
        rR.lossRecentres, rR.lossAt);
  check('the strips a merge is connected from light up in its border\'s gradient',
        rR.bandGrad, rR.bandGradAt);
  check('a merge\'s bar, carried with Shift and only then, shows a guide where it comes level with an entry, and lands on that level',
        rR.barGuide, rR.barGuideAt);

  });

  /* ---- tabs in the border's ink, a portrait's line in its border's style,
          and a phone's field on its entry ---- */
  await scenario("tabs in the border's ink, a portrait's line in its border's style and a phone's field on its entry", async () => {
  const rT = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const out = {};
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> Object.assign({}, x));
    const X = snapToGrid(52000), Y = snapToGrid(-3000);
    applyEdit(()=>{
      workingNodes.push(['tiA', 'Tabbed', null, null, null, null,
        {pos:[X, Y], colors:['#20242b', '#2a9d8f'], multiLang:true, link:'https://example.com/',
         langTabs:[{tag:'JP', text:'ja'}, {tag:'RU', text:'ru'}]}]);
      workingNodes.push(['tiD', '', null, null, null, 'ellipse', {pos:[X, Y + 300], border:'dashed', bioCard:true}]);
      workingNodes.push(['tiW', '', null, null, null, 'ellipse', {pos:[X + 400, Y + 300], border:'double', bioCard:true}]);
    });
    await wait(400);
    vs = 2; vx = 400 - X*vs; vy = 300 - Y*vs; applyTransform();
    await wait(200);
    /* A tab is in the colour of the border it stands on — the outermost
       ring — and stands ON it: its foot is no lower than the border's
       outer edge, so it never crosses into the line. */
    const n = nodes.get('tiA');
    const g = document.querySelector('.node[data-id="tiA"]');
    const R = svg.getBoundingClientRect();
    const baseY = R.top + vy + tabBaseOf(n).y * vs;
    const chips = g.querySelector('.lang-chips');
    const link = g.querySelector('.node-link-bg');
    const ink = (el)=> el ? (el.closest('[style*="--tab-ink"]') || {style:{getPropertyValue:()=>''}})
                              .style.getPropertyValue('--tab-ink').trim() : '';
    const feet = [...g.querySelectorAll('.lang-chip-bg, .node-link-bg')].map(p=> p.getBoundingClientRect().bottom);
    out.tabAt = JSON.stringify({chipInk: ink(chips), linkInk: ink(link), feet: feet.map(v=> +(v - baseY).toFixed(2))});
    out.tabInk = ink(chips) === '#2a9d8f' && ink(link) === '#2a9d8f';
    out.tabOnBorder = feet.length >= 3 && feet.every(b=> b <= baseY + 0.5);

    /* A dashed portrait's stub and card are dashed; a double one's are
       double, and its stub starts on the outer rail's outer edge rather
       than between the rails. */
    const stubOf = (id)=> [...document.querySelectorAll(`.bio-card-g[data-id="${id}"] line.bio-stub`)];
    const ringsOf = (id)=> [...document.querySelectorAll(`.bio-card-g[data-id="${id}"] rect[stroke]`)];
    const sD = stubOf('tiD'), cD = ringsOf('tiD');
    out.bioDashed = sD.length === 1 && !!sD[0].getAttribute('stroke-dasharray') &&
                    cD.length >= 1 && cD.every(r=> !!r.getAttribute('stroke-dasharray'));
    const sW = stubOf('tiW'), cW = ringsOf('tiW'), w = nodes.get('tiW');
    const x1 = sW.length ? +sW[0].getAttribute('x1') : NaN;
    const outerEdge = w.x + w.w / 2 + w.w / 2 + DOUBLE_LINE_OFF + DOUBLE_LINE_W / 2;
    const innerEdge = w.x - DOUBLE_LINE_OFF - DOUBLE_LINE_W / 2;
    out.bioAt = JSON.stringify({dashed: [sD.length, cD.length], double: [sW.length, cW.length],
                                x1, outerEdge: +outerEdge.toFixed(2), innerEdge: +innerEdge.toFixed(2)});
    out.bioDouble = sW.length === 2 && sW.some(l=> l.classList.contains('bio-stub-gap')) &&
                    cW.length === 2 && (Math.abs(x1 - outerEdge) < 0.6 || Math.abs(x1 - innerEdge) < 0.6);

    /* The tab being shown keeps its outline: it is washed, not filled. */
    const strokes = [...g.querySelectorAll('.lang-chip .lang-chip-bg')].map(p=> getComputedStyle(p).stroke);
    const active = g.querySelector('.lang-chip.active .lang-chip-bg');
    out.activeAt = JSON.stringify({strokes, fill: active && getComputedStyle(active).fill});
    out.activeKeepsOutline = strokes.length >= 2 && strokes.every(v=> v === strokes[0]) &&
                             !!active && getComputedStyle(active).fill !== strokes[0];

    /* On a rippled entry the tabs grow out of the wave: carried down past
       its troughs and cut off at it. */
    applyEdit(()=>{
      workingNodes.push(['tiR', 'Rippled', null, null, null, null,
        {pos:[X + 400, Y], border:'wavy', multiLang:true, link:'https://example.com/',
         langTabs:[{tag:'JP', text:'ja'}]}]);
    });
    await wait(300);
    {
      const r = nodes.get('tiR'), gr = document.querySelector('.node[data-id="tiR"]');
      const chipsR = gr.querySelector('.lang-chips'), linkR = gr.querySelector('a');
      const m = chipsR && chipsR.getAttribute('mask');
      const base = tabBaseOf(r);
      out.wavyTabAt = JSON.stringify({mask: m, link: linkR && linkR.getAttribute('mask'), sink: base.sink,
                                      foot: +(base.y - r.y).toFixed(2)});
      out.wavyTabs = !!m && !!document.querySelector(m.slice(4, -1)) && linkR.getAttribute('mask') === m &&
                     base.sink > 0 && base.y > r.y - 0.01;
    }

    /* A rippled portrait: the circle, its line and its card all ripple,
       and the style bar offers the ripple on a portrait. */
    applyEdit(()=>{
      workingNodes.push(['tiP', 'Rippled portrait', null, null, null, 'ellipse',
        {pos:[X + 800, Y + 300], border:'wavy', bioCard:true}]);
    });
    await wait(300);
    {
      const ring = document.querySelector('.node[data-id="tiP"] .bio-ring');
      const card = document.querySelector('.bio-card-g[data-id="tiP"]');
      const stub = card && card.querySelector('.bio-stub');
      const frame = card && card.querySelector('.bio-card-ring');
      openStyleBar({kind:'node', id:'tiP'});
      const wavyBtn = styleBar.querySelector('.style-bar-group[data-group="border"] button[data-value="wavy"]');
      out.wavyPortraitAt = JSON.stringify({ring: ring && ring.tagName, stub: stub && stub.tagName,
                                           frame: !!frame, offered: wavyBtn && !wavyBtn.disabled});
      out.wavyPortrait = !!ring && ring.tagName === 'path' && !!stub && stub.tagName === 'path' &&
                         !!frame && !!wavyBtn && !wavyBtn.disabled;
      closeStyleBar();
    }

    /* A note with its frame off has no corners to choose. */
    applyEdit(()=>{
      workingNodes.push(['tiN1', 'From', null, null, null, null, {pos:[X, Y + 700]}]);
      workingNodes.push(['tiN2', 'To', 'tiN1', null, null, null, {pos:[X + 300, Y + 700]}]);
      EDGE_STYLES.push({from:'tiN1', to:'tiN2', routing:'orthogonal', dash:'solid', arrow:true,
                        note:'a remark', noteFrame:false});
    });
    await wait(300);
    {
      const corners = ()=> [...styleBar.querySelectorAll('.style-bar-group[data-group="corners"] button')]
                             .map(b=> b.disabled);
      openStyleBar({kind:'note', from:'tiN1', to:'tiN2'});
      const bare = corners();
      applyEdit(()=>{ delete EDGE_STYLES.find(e=> e.from === 'tiN1' && e.to === 'tiN2').noteFrame; });
      await wait(200);
      openStyleBar({kind:'note', from:'tiN1', to:'tiN2'});
      const framed = corners();
      closeStyleBar();
      out.noteCornersAt = JSON.stringify({bare, framed});
      // One button now: lit rounded, dark square.
      out.noteCorners = bare.length === 1 && bare.every(Boolean) && framed.every(v=> !v);
    }

    /* A drafting leader: the words on a shelf, the leader to its near end. */
    applyEdit(()=>{
      workingNodes.push(['tiS', 'On a shelf', null, null, null, 'callout',
        {pos:[X + 500, Y + 600], leader:{from:'tiN1', to:'tiN2', at:0.5}}]);
    });
    await wait(300);
    {
      openStyleBar({kind:'leader', id:'tiS'});
      styleBar.querySelector('.style-bar-group[data-group="leaderForm"] button[data-value="shelf"]').click();
      await wait(300);
      const k = nodes.get('tiS');
      const shelf = document.querySelector('.callout-leader[data-id="tiS"] .leader-shelf');
      const line = document.querySelector('.callout-leader[data-id="tiS"] .leader-line');
      const lit = styleBar.querySelector('.style-bar-group[data-group="leaderForm"] button.on');
      const sy = k.y + k.h;
      const x2 = line ? +line.getAttribute('x2') : NaN, y2 = line ? +line.getAttribute('y2') : NaN;
      const box = document.querySelector('.node[data-id="tiS"] > rect');
      out.shelfAt = JSON.stringify({saved: workingEntry('tiS') && entryOpts(workingEntry('tiS').entry).leader,
                                    shelf: !!shelf, end: [x2, y2], box: [k.x, k.x + k.w, sy],
                                    lit: lit && lit.dataset.value, stroke: box && getComputedStyle(box).stroke});
      const sb = shelf && shelf.getBBox();
      out.shelf = !!shelf && Math.abs(sb.y + sb.height/2 - sy) < 0.05 &&
                  Math.abs(y2 - sy) < 0.05 && x2 > k.x - 0.05 && x2 < k.x + k.w + 0.05 &&
                  !!lit && lit.dataset.value === 'shelf' && entryOpts(workingEntry('tiS').entry).leader.shelf === true &&
                  styleBar.querySelectorAll('.style-bar-group[data-group="leaderForm"] button').length === 1;
      closeStyleBar();
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(300);
    return out;
  });
  check('the tab being shown keeps its outline, washed rather than filled', rT.activeKeepsOutline, rT.activeAt);
  check('on a rippled entry the tabs grow out of the wave, cut off at it', rT.wavyTabs, rT.wavyTabAt);
  check('a rippled portrait ripples its circle, its line and its card', rT.wavyPortrait, rT.wavyPortraitAt);
  check('a note with no frame has its corner buttons greyed', rT.noteCorners, rT.noteCornersAt);
  check('a drafting leader stands the words on a shelf and meets its near end', rT.shelf, rT.shelfAt);
  check('a language tab and the link tab are drawn in the colour of the border they stand on',
        rT.tabInk, rT.tabAt);
  check('and stand on the border\'s outer edge, never across its line', rT.tabOnBorder, rT.tabAt);
  check('a dashed portrait\'s line and card are dashed', rT.bioDashed, rT.bioAt);
  check('a double portrait\'s line and card are double, the line starting on the outer rail',
        rT.bioDouble, rT.bioAt);

  /* On a phone the field opens ON its entry, whatever the width of its
     toolbar, and a finger can ask for the guides. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    const ed = await pp.evaluate(async ()=>{
      const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
      const X = snapToGrid(52000), Y = snapToGrid(-3000);
      applyEdit(()=>{
        workingNodes.push(['phA', 'Wide anchor entry', null, null, null, null, {pos:[X, Y]}]);
        workingNodes.push(['phB', 'B', null, null, null, null, {pos:[X + 37, Y + 150]}]);
        workingNodes.push(['phT', 'Right of the middle', null, null, null, null, {pos:[X + 120, Y + 300]}]);
      });
      await wait(400);
      vs = 1; vx = 150 - X; vy = 200 - Y; applyTransform();
      await wait(200);
      const meta = document.querySelector('meta[name="viewport"]');
      const before = meta.getAttribute('content');
      openNodeEditor('phT');
      await wait(150);
      const f = richFields.get('nodeEditorText').surface.getBoundingClientRect();
      const b = document.querySelector('.node[data-id="phT"] rect').getBoundingClientRect();
      const bar = document.getElementById('nodeEditorBar').getBoundingClientRect();
      const held = meta.getAttribute('content');
      closeNodeEditor(true);
      const after = meta.getAttribute('content');
      return {fieldLeft: +(f.left - b.left).toFixed(1), fieldRight: +(f.right - b.right).toFixed(1),
              bar: [+bar.left.toFixed(1), +bar.right.toFixed(1)], held, before, after};
    });
    check('on a phone the in-entry field opens on its entry, its toolbar on the screen',
          Math.abs(ed.fieldLeft) < 1.5 && ed.fieldRight > -1.5 &&
          ed.bar[0] >= 5 && ed.bar[1] <= 390 - 5, JSON.stringify(ed));
    check('and the page is not zoomed onto it while it is open, and may be again once shut',
          /maximum-scale=1/.test(ed.held) && ed.after === ed.before && !/maximum-scale/.test(ed.before),
          JSON.stringify(ed));
    /* The guides button: carried with it lit, an entry is lined up on its
       neighbour as it is under a held Shift; carried with it dark, not. */
    const at = await pp.evaluate(()=>{
      const r = document.querySelector('.node[data-id="phB"] rect').getBoundingClientRect();
      return [r.left + r.width/2, r.top + r.height/2];
    });
    const cdp = await phone.newCDPSession(pp);
    const carry = async (x0, y0)=>{
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:x0, y:y0}]});
      for(let i = 1; i <= 10; i++){
        await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:x0 + i*1.4, y:y0}]});
        await wait(20);
      }
      const shown = await pp.evaluate(()=> document.querySelectorAll('#guideLayer .align-guide').length);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await wait(250);
      return shown;
    };
    const dark = await carry(at[0], at[1]);
    // Shown once the page has been touched, which it now has.
    const visible = await pp.evaluate(()=>{
      const b = document.getElementById('guideToggle'), r = b.getBoundingClientRect();
      return getComputedStyle(b).display !== 'none' && r.width >= 30 && r.right <= innerWidth &&
             !!b.closest('.topbar');
    });
    await pp.tap('#guideToggle');
    await wait(150);
    const at2 = await pp.evaluate(()=>{
      const r = document.querySelector('.node[data-id="phB"] rect').getBoundingClientRect();
      return [r.left + r.width/2, r.top + r.height/2];
    });
    const lit = await carry(at2[0], at2[1]);
    const pressed = await pp.evaluate(()=> document.getElementById('guideToggle').getAttribute('aria-pressed'));
    check('on a phone a button stands in for Shift: lit, a carried entry is offered the guides',
          visible && dark === 0 && lit > 0 && pressed === 'true', JSON.stringify({visible, dark, lit, pressed}));
  } finally {
    await phone.close();
  }
  });

  /* ---- the owner's fifth round: a connector styled where it is, a card no
       bigger than its words, a field on its words and a phone's keys ---- */
  await scenario("a connector styled where it is, a card no bigger than its words, and a phone's keys", async () => {
  const rF = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const out = {};
    const X = snapToGrid(70000), Y = snapToGrid(-9000);
    applyEdit(()=>{
      workingNodes.push(['fvA', 'Source', null, null, null, null, {pos:[X, Y]}]);
      workingNodes.push(['fvB', 'Target', 'fvA', null, null, null, {pos:[X + 400, Y]}]);
      workingNodes.push(['fvS', 'On a shelf', null, null, null, 'callout',
        {pos:[X + 190, Y - 80], leader:{from:'fvA', to:'fvB', at:0.5, shelf:true, line:'dashed'}}]);
      workingNodes.push(['fvC', 'Straight', null, null, null, null, {pos:[X, Y + 300]}]);
      workingNodes.push(['fvD', 'Line', 'fvC', null, null, null, {pos:[X + 300, Y + 460]}]);
      workingNodes.push(['fvI', '', null, null, null, 'image', {pos:[X + 600, Y]}]);
      workingNodes.push(['fvP', 'Plain words', null, null, null, null, {pos:[X, Y + 700]}]);
      workingNodes.push(['fvK', 'Plain words', null, null, null, null, {pos:[X + 300, Y + 700], card:true}]);
    });
    refill(EDGE_STYLES, beforeStyles.concat([
      {from:'fvC', to:'fvD', routing:'straight', bends:[[X + 40, Y + 420]]}]));
    rebuildChart();
    await wait(350);
    vs = 1.5; vx = 300 - X*vs; vy = 400 - Y*vs; applyTransform();
    await wait(200);

    /* The shelf: drawn in the leader's own line, and the leader dropped
       square onto it from a horizontal connector. */
    {
      const k = nodes.get('fvS');
      const line = document.querySelector('.callout-leader[data-id="fvS"] .leader-line');
      const shelf = document.querySelector('.callout-leader[data-id="fvS"] .leader-shelf .leader-line, .callout-leader[data-id="fvS"] .leader-shelf line, .callout-leader[data-id="fvS"] .leader-shelf path');
      const x1 = +line.getAttribute('x1'), x2 = +line.getAttribute('x2'), y2 = +line.getAttribute('y2');
      out.shelfAt = JSON.stringify({x1, x2, y2, box:[k.x, k.x + k.w, k.y + k.h],
        dash: [line.getAttribute('stroke-dasharray'), shelf && shelf.getAttribute('stroke-dasharray')]});
      out.shelfDrop = Math.abs(x1 - x2) < 0.05 && Math.abs(y2 - (k.y + k.h)) < 0.05 && x2 > k.x && x2 < k.x + k.w;
      out.shelfInk = !!shelf && !!line.getAttribute('stroke-dasharray') &&
        shelf.getAttribute('stroke-dasharray') === line.getAttribute('stroke-dasharray');
      // Its border and corners are not offered: it has none.
      openStyleBar({kind:'node', id:'fvS'});
      out.shelfBar = styleBar.querySelector('[data-group="border"]').hidden &&
        styleBar.querySelector('[data-group="corners"]').hidden;
      closeStyleBar();
    }

    /* …and the words stay where they were put. They used to be pulled
       over the place they mark whenever the leader stood within 15° of
       upright, which made a shelf jump to square on every drop near it;
       the owner found that it took the placing out of their hands
       (22.10). Shift, which snaps a callout's angle to eighths of a turn,
       is how a T is asked for now. */
    {
      const k = nodes.get('fvS');
      const x2 = +document.querySelector('.callout-leader[data-id="fvS"] .leader-line').getAttribute('x2');
      out.shelfT = Math.abs(k.x - (X + 190)) < 0.01 && Math.abs(k.x + k.w/2 - x2) > 1;
      applyEdit(()=>{
        // The anchor is near X+216: fvN's span stops some pixels
        // just short of it, fvL's well short.
        workingNodes.push(['fvN', 'Nearly', null, null, null, 'callout',
          {pos:[X + 180, Y + 140], leader:{from:'fvA', to:'fvB', at:0.5, shelf:true}}]);
        workingNodes.push(['fvL', 'Leaning', null, null, null, 'callout',
          {pos:[X + 20, Y - 60], leader:{from:'fvA', to:'fvB', at:0.5, shelf:true}}]);
      });
      await wait(300);
      const geo = id=>{ const l = document.querySelector(`.callout-leader[data-id="${id}"] .leader-line`);
        const n = nodes.get(id); return {x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), box:[n.x, n.x + n.w]}; };
      const nN = geo('fvN'), nL = geo('fvL');
      const kept = entryOpts(workingNodes.find(e=> e[0] === 'fvN')).pos;
      out.shelfTnear = JSON.stringify({nN, nL, kept});
      out.shelfTnearOk = Math.abs(nodes.get('fvN').x - (X + 180)) < 0.01 && Math.abs(nN.x2 - nN.box[1]) < 0.05 &&
        Math.abs(kept[0] - (X + 180)) < 0.01 &&
        Math.abs(nL.x1 - nL.x2) > 20 && Math.abs(nL.x2 - nL.box[1]) < 0.05;
      applyEdit(()=>{ workingNodes = workingNodes.filter(e=> e[0] !== 'fvN' && e[0] !== 'fvL'); });
      await wait(200);
    }

    /* …and never crosses its own words: with the place it marks above
       them, the words hang under the shelf and the leader meets it from
       above. */
    {
      applyEdit(()=> workingNodes.push(['fvU', 'Under the line, long words', null, null, null, 'callout',
        {pos:[X + 150, Y + 80], leader:{from:'fvA', to:'fvB', at:0.5, shelf:true}}]));
      await wait(250);
      const k = nodes.get('fvU');
      const line = document.querySelector('.callout-leader[data-id="fvU"] .leader-line');
      const y1 = +line.getAttribute('y1'), y2 = +line.getAttribute('y2');
      const sb = document.querySelector('.callout-leader[data-id="fvU"] .leader-shelf').getBBox();
      out.clearAt = JSON.stringify({y1, y2, box:[k.x, k.y, k.x + k.w, k.y + k.h], shelf:[sb.x, sb.x + sb.width, sb.y]});
      out.clear = y1 < k.y && Math.abs(y2 - k.y) < 0.05 && Math.abs(sb.y + sb.height/2 - k.y) < 0.05 &&
        Math.abs(sb.x - k.x) < 0.5 && Math.abs(sb.x + sb.width - k.x - k.w) < 0.5;
    }

    /* The style bar over an entry with tabs stands over the tabs. */
    {
      applyEdit(()=> workingNodes.push(['fvT', 'With tabs', null, null, null, null,
        {pos:[X + 700, Y + 300], multiLang:true, langTabs:[{tag:'EN', text:'With tabs'}, {tag:'RU', text:'С вкладками'}],
         link:'https://example.com/'}]));
      await wait(250);
      openStyleBar({kind:'node', id:'fvT'});
      const bar = styleBar.getBoundingClientRect();
      nodeControlsOn('fvT');
      const tabs = [...document.querySelectorAll('.node[data-id="fvT"] .lang-chips, .node[data-id="fvT"] .node-link')]
        .map(t=> t.getBoundingClientRect().top);
      out.barTabsAt = JSON.stringify({bar: bar.bottom, tabs,
        grips: document.querySelectorAll('.node[data-id="fvT"] .node-resize').length});
      out.barOverTabs = tabs.length === 2 && tabs.every(t=> bar.bottom <= t + 0.5) &&
        document.querySelectorAll('.node[data-id="fvT"] .node-resize').length === 4;
      closeStyleBar();
    }

    /* A straight connector keeps no bend and offers none. */
    {
      const rec = drawnRoutes.get(calloutEdgeKey('fvC', 'fvD'));
      openEdgeStylePopover('fvC', 'fvD', {clientX:500, clientY:400, stopPropagation(){}});
      await wait(150);
      /* Its two ends are offered, to be carried to another port; a
         corner, nothing. */
      const bends = bendLayer.querySelectorAll(':scope > :not(.bend-end)').length;
      const ends = bendLayer.querySelectorAll(':scope > .bend-end').length;
      out.straightAt = JSON.stringify({pts: rec && rec.pts.length, handles: bends, ends});
      out.straight = !!rec && rec.pts.length === 2 && bends === 0 && ends === 2;
      closeEdgePopover();
    }

    /* A picture starts at a portrait's size; a card of words alone is the
       size of the same words in a plain box. */
    {
      const i = nodes.get('fvI'), p = nodes.get('fvP'), c = nodes.get('fvK');
      out.sizesAt = JSON.stringify({image:[i.w, i.h], plain:[p.w, p.h], card:[c.w, c.h], bio: BIO_SIZE});
      out.imageSize = i.w === BIO_SIZE && i.h === BIO_SIZE;
      out.cardSize = Math.abs(c.w - p.w) < 0.05 && Math.abs(c.h - p.h) < 0.05;
    }

    /* The connector's panel holds the route and the paint; the line, its
       corners and its ends are on the bar that comes up on the line. */
    {
      const pop = document.getElementById('edgePopover');
      out.panelLean = !document.getElementById('styleDash') && !document.getElementById('styleCorners') &&
        !document.getElementById('styleArrowEnds') && !document.getElementById('styleNoteSide') &&
        !document.getElementById('styleAddNote') &&
        document.getElementById('styleBendsClear').closest('.style-row') ===
          document.getElementById('styleRouting').closest('.style-row') && !!pop;
      const hit = document.querySelector('.edge-hit[data-from="fvA"][data-to="fvB"]');
      const r = hit.getBoundingClientRect();
      hit.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, clientX:r.left + 30, clientY:r.top + r.height/2}));
      await wait(100);
      const groups = [...styleBar.querySelectorAll('.style-bar-group:not([hidden])')].map(g=> g.dataset.group);
      out.handlesOnHover = bendLayer.childNodes.length > 0;
      const press = (group, value)=> styleBar.querySelector(
        `.style-bar-group[data-group="${group}"] button[data-value="${value}"]`).click();
      press('edgeLine', 'dotted');
      press('endIn', 'in');
      press('corners', 'round');
      await wait(150);
      const st = edgeStyleFor('fvA', 'fvB');
      out.edgeBarAt = JSON.stringify({groups, dash: st.dash, arrowIn: st.arrowIn, square: st.square});
      out.edgeBar = groups.join() === 'edgeLine,corners,endIn,endOut' && st.dash === 'dotted' &&
        // Square to start with since 0.12.0, so the press rounds them.
        st.arrowIn === true && st.square === false && !styleBar.hidden;
      closeStyleBar();
      // The line was drawn again by the presses; it is the new one the pointer leaves.
      document.querySelector('.edge-hit[data-from="fvA"][data-to="fvB"]')
        .dispatchEvent(new MouseEvent('mouseout', {bubbles:true, relatedTarget: document.body}));
      await wait(450);
      out.handlesGo = bendLayer.childNodes.length === 0;
      // A curve has no elbows to square.
      applyEdit(()=> setEdgeStyleOverride('fvA', 'fvB', Object.assign({}, edgeStyleFor('fvA', 'fvB'), {routing:'curve'})));
      openStyleBar({kind:'edge', from:'fvA', to:'fvB', x:300, y:300});
      out.curveGreys = !!styleBar.querySelector('[data-group="corners"] button').disabled;
      /* …and still lit: the elbows were rounded before the curve, and are
         rounded again the moment it is a square route once more. */
      out.curveKeepsLit = styleBar.querySelector('[data-group="corners"] button').classList.contains('on');
      closeStyleBar();
      applyEdit(()=> setEdgeStyleOverride('fvA', 'fvB', Object.assign({}, edgeStyleFor('fvA', 'fvB'), {routing:'orthogonal'})));
      openStyleBar({kind:'edge', from:'fvA', to:'fvB', x:300, y:300});
      const back = styleBar.querySelector('[data-group="corners"] button');
      out.curveComesBack = !back.disabled && back.classList.contains('on') && edgeStyleFor('fvA', 'fvB').square === false;
      closeStyleBar();
    }

    /* Clicked, it is lit like a selected entry and nothing steps back. */
    {
      const hit = document.querySelector('.edge-hit[data-from="fvA"][data-to="fvB"]');
      const r = hit.getBoundingClientRect();
      hit.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:r.left + 30, clientY:r.top + r.height/2}));
      await wait(150);
      const picked = [...document.querySelectorAll('.edge-picked')];
      out.pickAt = JSON.stringify({picked: picked.length, dim: document.querySelectorAll('.dim').length,
        filter: picked[0] && getComputedStyle(picked[0]).filter});
      out.picked = picked.length > 0 && picked.every(p=> p.dataset.from === 'fvA' && p.dataset.to === 'fvB') &&
        document.querySelectorAll('.dim').length === 0 && /drop-shadow/.test(getComputedStyle(picked[0]).filter);
      closeEdgePopover();
      await wait(100);
      out.unpicked = document.querySelectorAll('.edge-picked').length === 0;
    }

    /* A note: double-click the line. One already there is opened instead,
       and its side is chosen on its own bar. */
    {
      const hit = document.querySelector('.edge-hit[data-from="fvA"][data-to="fvB"]');
      const len = hit.getTotalLength(), pt = hit.getPointAtLength(len * 0.25), m = hit.getScreenCTM();
      hit.dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true,
        clientX: pt.x*m.a + m.e, clientY: pt.y*m.d + m.f}));
      await wait(200);
      const opened = !!(nodeEditorTarget && nodeEditorTarget.kind === 'note' && nodeEditorTarget.from === 'fvA');
      const rec = richFields.get('nodeEditorText');
      rec.surface.textContent = 'first words';
      rec.surface.dispatchEvent(new Event('input', {bubbles:true}));
      await wait(150);
      closeNodeEditor(); await wait(250);
      const st = edgeStyleFor('fvA', 'fvB');
      const again = document.querySelector('.edge-hit[data-from="fvA"][data-to="fvB"]');
      again.dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true, clientX:10, clientY:10}));
      await wait(200);
      const reopened = !!(nodeEditorTarget && nodeEditorTarget.kind === 'note') &&
        richFields.get('nodeEditorText').surface.textContent === 'first words';
      closeNodeEditor(true); await wait(150);
      openStyleBar({kind:'note', from:'fvA', to:'fvB'});
      styleBar.querySelector('[data-group="noteSide"] button[data-value="below"]').click();
      await wait(150);
      out.noteAt = JSON.stringify({opened, text: st.note, at: st.noteAt, reopened, pos: edgeStyleFor('fvA', 'fvB').notePos});
      out.noteByDbl = opened && st.note === 'first words' && Math.abs(st.noteAt - 0.25) < 0.08 && reopened &&
        edgeStyleFor('fvA', 'fvB').notePos === 'below';
      closeStyleBar();
    }

    /* The field stands on the words, close up as well as far off. */
    {
      const at = (sel)=>{
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        document.querySelectorAll(sel).forEach(e=>{ const q = e.getBoundingClientRect();
          l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
        return {cx:(l + r)/2, cy:(t + b)/2, h: b - t};
      };
      const fieldAt = ()=>{
        const rg = document.createRange(); rg.selectNodeContents(richFields.get('nodeEditorText').surface);
        const q = rg.getBoundingClientRect(); return {cx: q.left + q.width/2, cy: q.top + q.height/2, h: q.height};
      };
      applyEdit(()=> workingNodes.push(['fvW', 'Callout words here', null, null, null, 'callout',
        {pos:[X + 120, Y + 100], leader:{from:'fvA', to:'fvB', at:0.7}}]));
      await wait(250);
      const res = [];
      for(const z of [1, 2.5]){
        vs = z; vx = 300 - X*vs; vy = 400 - Y*vs; applyTransform(); await wait(150);
        for(const id of ['fvA', 'fvW']){
          const d = at(`.node[data-id="${id}"] .node-label-text`);
          /* Across, by the first letter's pen on both sides: the middles
             of the two blocks count a callout's ink differently, and the
             letters are what the field is laid on. */
          const pen = (()=>{ const t = [...document.querySelectorAll(`.node[data-id="${id}"] .node-label-text tspan`)].find(e=> !e.querySelector('tspan') && /\S/.test(e.textContent));
            const i = t.textContent.search(/\S/), q = t.getStartPositionOfChar(i);
            return new DOMPoint(q.x, q.y).matrixTransform(t.getScreenCTM()).x; })();
          openNodeEditor(id); await wait(150);
          const f = fieldAt();
          const typedPen = (()=>{ const w = document.createTreeWalker(richFields.get('nodeEditorText').surface, NodeFilter.SHOW_TEXT); let n;
            while((n = w.nextNode())){ const j = n.textContent.search(/\S/); if(j >= 0){ const rg = document.createRange(); rg.setStart(n, j); rg.setEnd(n, j + 1); return rg.getBoundingClientRect().left; } } })();
          res.push({z, id, dx: +(typedPen - pen).toFixed(2), dy: +(f.cy - d.cy).toFixed(2), dh: +(f.h - d.h).toFixed(2)});
          closeNodeEditor(true); await wait(80);
        }
      }
      out.fieldAt = JSON.stringify(res);
      out.fieldOnWords = res.every(v=> Math.abs(v.dx) < 1.5 && Math.abs(v.dy) < 1.5) &&
        res.filter(v=> v.id === 'fvW').every(v=> Math.abs(v.dh) < 4 * v.z);
    }

    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(300);
    return out;
  });
  check('a drafting leader drops square onto a shelf drawn in its own line', rF.shelfDrop && rF.shelfInk, rF.shelfAt);
  check('a drafting leader\'s words stay where they were put, not pulled square over the place they mark', rF.shelfT, rF.shelfAt);
  check('one a hair off upright keeps its place and its end, as one plainly leaning does', rF.shelfTnearOk, rF.shelfTnear);
  check('and a shelf is not offered a border or corners', rF.shelfBar);
  check('a drafting leader never crosses its own words: below their connector they hang under the shelf', rF.clear, rF.clearAt);
  check('the style bar over an entry stands clear of its tabs', rF.barOverTabs, rF.barTabsAt);
  check('a straight connector keeps no bend and offers none', rF.straight, rF.straightAt);
  check('a picture starts at a portrait\'s size', rF.imageSize, rF.sizesAt);
  check('a card of words alone is no bigger than the same words in a plain box', rF.cardSize, rF.sizesAt);
  check('a connector\'s panel holds its route and paint, with ⟳ beside the route', rF.panelLean);
  check('the bar on a connector sets its line, its corners and its ends', rF.edgeBar, rF.edgeBarAt);
  check('and a curve\'s corners are greyed there', rF.curveGreys);
  check('greyed, a button still shows whether it is pressed', rF.curveKeepsLit);
  check('and comes back pressed when what greyed it is gone', rF.curveComesBack);
  check('a connector\'s bends show as the pointer reaches it, and go after it leaves',
        rF.handlesOnHover && rF.handlesGo, JSON.stringify({on: rF.handlesOnHover, go: rF.handlesGo}));
  check('a clicked connector is lit like a selected entry, and nothing else steps back',
        rF.picked && rF.unpicked, rF.pickAt);
  check('double-clicking a connector writes a note where it was clicked, or opens the one it has',
        rF.noteByDbl, rF.noteAt);
  check('the in-entry field stands on the words it covers, at any zoom, a callout folded as it is',
        rF.fieldOnWords, rF.fieldAt);

  /* A phone: undo and redo as one button, cut, copy, paste and delete on
     the menu a long press on the selection brings up, and a connector's
     bar where the finger tapped it. */
  const phone = await browser.newContext({viewport:{width:390, height:844},
    deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await phone.route('https://fonts.googleapis.com/**', noFonts);
  await phone.route('https://fonts.gstatic.com/**', noFonts);
  const pp = await phone.newPage();
  pp.on('pageerror', e => errors.push('phone: ' + e.message));
  try{
    await pp.goto(`http://127.0.0.1:${PORT}/${PAGE}`, {waitUntil:'networkidle'});
    await wait(900);
    const at = await pp.evaluate(async ()=>{
      const X = snapToGrid(52000), Y = snapToGrid(-3000);
      applyEdit(()=>{
        workingNodes.push(['tkA', 'Keys', null, null, null, null, {pos:[X, Y]}]);
        workingNodes.push(['tkB', 'Lock', 'tkA', null, null, null, {pos:[X + 60, Y + 120]}]);
      });
      await new Promise(r=> setTimeout(r, 300));
      vs = 1.5; vx = 120 - X*vs; vy = 300 - Y*vs; applyTransform();
      await new Promise(r=> setTimeout(r, 200));
      const r = document.querySelector('.node[data-id="tkA"] rect').getBoundingClientRect();
      const e = document.querySelector('.edge-hit[data-from="tkA"][data-to="tkB"]');
      const pt = e.getPointAtLength(e.getTotalLength() * 0.5), m = e.getScreenCTM();
      return {a: [r.left + r.width/2, r.top + r.height/2], e: [pt.x*m.a + m.e, pt.y*m.d + m.f]};
    });
    const cdp = await phone.newCDPSession(pp);
    const hold = async (x, y)=>{
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y}]});
      await wait(650);
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await wait(300);
    };
    const state = ()=> pp.evaluate(()=> ({sel: selectedId, n: nodes.size,
      menu: !document.getElementById('touchMenu').hidden,
      items: [...document.querySelectorAll('#touchMenu button')].filter(b=> !b.hidden).map(b=> b.dataset.act).join(),
      tools: [...document.querySelectorAll('#touchTools button')].map(b=> b.dataset.act).join()}));
    const tapIn = async (sel)=>{
      const b = await pp.evaluate((q)=>{ const r = document.querySelector(q).getBoundingClientRect();
        return [r.left + r.width/2, r.top + r.height/2]; }, sel);
      await pp.touchscreen.tap(b[0], b[1]);
      await wait(350);
      return state();
    };
    await pp.touchscreen.tap(at.a[0], at.a[1]);
    await wait(400);
    const s0 = await state();
    await hold(at.a[0], at.a[1]);
    const sMenu = await state();
    await tapIn('#touchMenu [data-act="copy"]');
    // Somewhere on the chart with nothing on it, clear of the open drawer.
    const empty = await pp.evaluate(()=>{
      for(let y = 140; y < 600; y += 20) for(let x = 60; x < 330; x += 20){
        const e = document.elementFromPoint(x, y);
        if(e && svg.contains(e) && !e.closest('.node, .edge-hit, .edge-note, .node-aura, #bendLayer')) return [x, y];
      }
      return null;
    });
    await hold(empty[0], empty[1]);
    const sCanvas = await state();
    const sPaste = await tapIn('#touchMenu [data-act="paste"]');
    await pp.touchscreen.tap(at.a[0], at.a[1]);
    await wait(400);
    await hold(at.a[0], at.a[1]);
    const sDel = await tapIn('#touchMenu [data-act="delete"]');
    const sUndo = await tapIn('#touchTools [data-act="undo"]');
    const sRedo = await tapIn('#touchTools [data-act="redo"]');
    const flow = [s0, sMenu, sCanvas, sPaste, sDel, sUndo, sRedo];
    check('on a phone undo and redo are one button in two halves', s0.tools === 'undo,redo', s0.tools);
    check('a long press on the selection brings up cut, copy, paste and delete; on canvas, paste and the ground',
          s0.sel === 'tkA' && sMenu.menu && sMenu.items === 'cut,copy,paste,ports,delete' && sMenu.sel === 'tkA' &&
          sCanvas.menu && sCanvas.items === 'paste,background' &&
          sPaste.n === s0.n + 1 && !sPaste.menu && sDel.n === sPaste.n - 1 && sDel.sel !== 'tkA',
          JSON.stringify(flow));
    check('and the undo button takes the delete back, the redo button does it again',
          sUndo.n === sDel.n + 1 && sRedo.n === sDel.n, JSON.stringify([sDel, sUndo, sRedo]));
    /* A connector's bar comes up where it was tapped, not in the corner
       of the page. */
    // The redo took the entry away again; one more undo brings its connector back.
    await pp.evaluate(()=>{ undoLastEdit(); deselect(); closeEdgePopover(); });
    await wait(200);
    const ep = await pp.evaluate(()=>{
      const e = document.querySelector('.edge-hit[data-from="tkA"][data-to="tkB"]');
      const pt = e.getPointAtLength(e.getTotalLength() * 0.5), m = e.getScreenCTM();
      return [pt.x*m.a + m.e, pt.y*m.d + m.f];
    });
    await pp.touchscreen.tap(ep[0], ep[1]);
    await wait(400);
    const bar = await pp.evaluate(()=>{
      const b = document.getElementById('styleBar'), r = b.getBoundingClientRect();
      return {shown: !b.hidden, kind: styleBarTarget && styleBarTarget.kind, top: r.top, bottom: r.bottom, left: r.left, right: r.right};
    });
    check('on a phone a tapped connector gets its bar, next to where it was tapped',
          bar.shown && bar.kind === 'edge' && Math.abs(bar.bottom - ep[1]) < 60 && bar.top > 0,
          JSON.stringify({bar, at: ep}));
    /* A long press on an entry nobody has picked opens the menu at once,
       with the entry picked; on a connector it offers Delete, and Delete
       takes the connector away and nothing else. */
    await pp.evaluate(()=>{ deselect(); closeEdgePopover(); });
    await wait(200);
    const a2 = await pp.evaluate(()=>{ const r = document.querySelector('.node[data-id="tkA"] rect').getBoundingClientRect();
      return [r.left + r.width/2, r.top + r.height/2]; });
    await hold(a2[0], a2[1]);
    const sFresh = await state();
    await pp.evaluate(()=>{ document.getElementById('touchMenu').hidden = true; deselect(); closeEdgePopover(); closeStyleBar(); });
    await wait(200);
    // Where the line is now, and nothing else is: a bar left up may stand over the first place.
    const ep2 = await pp.evaluate(()=>{
      const e = document.querySelector('.edge-hit[data-from="tkA"][data-to="tkB"]');
      for(const f of [0.5, 0.35, 0.65, 0.2, 0.8]){
        const pt = e.getPointAtLength(e.getTotalLength() * f), m = e.getScreenCTM();
        const x = pt.x*m.a + m.e, y = pt.y*m.d + m.f;
        if(document.elementFromPoint(x, y) === e) return [x, y];
      }
      return null;
    });
    await hold(ep2[0], ep2[1]);
    const sEdge = await state();
    const edgesBefore = await pp.evaluate(()=> structEdges.filter(e=> e.from === 'tkA' && e.to === 'tkB').length);
    const sEdgeDel = await tapIn('#touchMenu [data-act="delete"]');
    const after = await pp.evaluate(()=> ({edge: structEdges.filter(e=> e.from === 'tkA' && e.to === 'tkB').length,
                                           a: nodes.has('tkA'), b: nodes.has('tkB')}));
    check('a long press on an entry not yet picked picks it and brings up the menu',
          sFresh.menu && sFresh.items === 'cut,copy,paste,ports,delete' && sFresh.sel === 'tkA', JSON.stringify(sFresh));
    check('a long press on a connector offers Split and Delete, and Delete takes the connector and nothing else',
          sEdge.menu && sEdge.items === 'split,delete' && edgesBefore === 1 && after.edge === 0 && after.a && after.b && !sEdgeDel.menu,
          JSON.stringify({sEdge, edgesBefore, after}));
  } finally {
    await phone.close();
  }
  });

  await scenario("a merge that never makes its lineages queue or go round its entry, nor its arrow slant", async () => {
  /* Every placement of a merge's entry against its lineages was swept
     (the owner asked for all of them); these are the ones that drew
     wrong. Lined up towards the bar, the lineages had to reach it
     through one another and knotted; an entry standing in among them on
     both axes left the vote to lay the bar across them; an entry just
     short of its resting bar, straight under a lineage, had that lineage
     run through it. What is checked is what a reader sees as wrong:
     a lineage through an entry or going round one, two lineages crossing,
     the merged arrow crossing a lineage. */
  const rMs = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const beforeNodes = workingNodes.slice();
    const beforeStyles = EDGE_STYLES.slice();
    const X = snapToGrid(90000), Y = snapToGrid(-9000);
    const cases = {
      rowLevel:   {parents: [[0, 0], [260, 0]],           am: [560, 0]},
      rowLevel3:  {parents: [[0, 0], [240, 0], [480, 0]], am: [760, 0]},
      columnBelow:{parents: [[0, 0], [0, 180]],           am: [0, 400]},
      columnAbove:{parents: [[0, 0], [0, 180]],           am: [0, -220]},
      inRow:      {parents: [[0, 0], [260, 0]],           am: [120, 0]},
      inRow3:     {parents: [[0, 0], [240, 0], [480, 0]], am: [120, 0]},
      inColumn:   {parents: [[0, 0], [0, 180]],           am: [10, 90]},
      corner:     {parents: [[0, 0], [260, 180]],         am: [0, 200]},
      offRight:   {parents: [[0, 0], [260, 0]],           am: [560, 220]},
      offLeft:    {parents: [[0, 0], [260, 0]],           am: [-220, 200]},
      offUp:      {parents: [[0, 0], [260, 0]],           am: [560, -240]},
      columnOff:  {parents: [[0, 0], [0, 180]],           am: [300, 320]}
    };
    const slanted = {};
    const res = {};
    const segs = pts=> pts.slice(1).map((q, i)=> [pts[i], q]);
    const cross = (p1, p2, p3, p4)=>{
      const d = (p2.x-p1.x)*(p4.y-p3.y) - (p2.y-p1.y)*(p4.x-p3.x); if(Math.abs(d) < 1e-9) return false;
      const u = ((p3.x-p1.x)*(p4.y-p3.y) - (p3.y-p1.y)*(p4.x-p3.x)) / d, v = ((p3.x-p1.x)*(p2.y-p1.y) - (p3.y-p1.y)*(p2.x-p1.x)) / d;
      return u > 0 && u < 1 && v > 0 && v < 1; };
    const sample = p=>{ const L = p.getTotalLength(), out = [];
      for(let d = 0; d <= L; d += 2){ const q = p.getPointAtLength(d); out.push({x:q.x, y:q.y}); }
      const q = p.getPointAtLength(L); out.push({x:q.x, y:q.y}); return out; };
    for(const [name, c] of Object.entries(cases)){
      const ids = c.parents.map((_, i)=> 'mq' + i);
      applyEdit(()=>{
        workingNodes = beforeNodes.slice(); refill(EDGE_STYLES, beforeStyles);
        c.parents.forEach(([dx, dy], i)=> workingNodes.push([ids[i], 'Parent ' + i, null, null, null, null, {pos:[X + dx, Y + dy]}]));
        workingNodes.push(['mqA', 'Amalgam', ids, null, null, null, {merge:true, pos:[X + c.am[0], Y + c.am[1]]}]);
      });
      await wait(250);
      const boxes = [...ids, 'mqA'].map(id=> nodes.get(id));
      const mem = [...document.querySelectorAll('.amalgam-member[data-to="mqA"]')].map(p=> ({from: p.getAttribute('data-from'), pts: sample(p)}));
      const out = document.querySelector('.amalgam-out[data-to="mqA"]');
      const arrow = out ? sample(out) : [];
      const inside = (q, n)=> q.x > n.x + 2 && q.x < n.x + n.w - 2 && q.y > n.y + 2 && q.y < n.y + n.h - 2;
      const bad = [];
      if(mem.length !== ids.length || !out) bad.push('not merged');
      mem.forEach(m=> boxes.forEach(n=>{
        if(m.pts.filter((q, i)=> i > 2 && i < m.pts.length - 3 && inside(q, n)).length > 1) bad.push(m.from + ' through ' + n.id);
      }));
      // Going round something: a line longer than the walk between its ends.
      mem.forEach(m=>{
        const L = segs(m.pts).reduce((t, [a, b])=> t + Math.hypot(b.x - a.x, b.y - a.y), 0);
        const a = m.pts[0], z = m.pts[m.pts.length - 1];
        if(L > Math.abs(a.x - z.x) + Math.abs(a.y - z.y) + 40) bad.push(m.from + ' goes round');
      });
      for(let i = 0; i < mem.length; i++) for(let j = i + 1; j < mem.length; j++)
        if(segs(mem[i].pts).some(a=> segs(mem[j].pts).some(b=> cross(a[0], a[1], b[0], b[1])))) bad.push(mem[i].from + ' crosses ' + mem[j].from);
      mem.forEach(m=>{ if(segs(m.pts).some(a=> segs(arrow).some(b=> cross(a[0], a[1], b[0], b[1])))) bad.push('arrow crosses ' + m.from); });
      // The merged arrow is square: no stretch of it runs at a slant,
      // beyond the few points its rounded corners take.
      slanted[name] = segs(arrow).filter(([a, b])=> Math.abs(b.x - a.x) > 0.2 && Math.abs(b.y - a.y) > 0.2).length;
      res[name] = bad;
    }
    refill(EDGE_STYLES, beforeStyles);
    applyEdit(()=>{ workingNodes = beforeNodes; });
    rebuildChart();
    await wait(250);
    return {res, slanted};
  });
  const rM = rMs.res, slanted = rMs.slanted;
  check('lineages lined up towards their merge drop onto a bar laid along them, not through one another',
        ['rowLevel', 'rowLevel3', 'columnBelow', 'columnAbove'].every(k=> !rM[k].length), JSON.stringify(rM));
  check('an entry standing in among its lineages gets a bar they can each reach straight',
        ['inRow', 'inRow3', 'inColumn'].every(k=> !rM[k].length), JSON.stringify(rM));
  check('a bar is not laid beyond an entry that a lineage stands straight behind', !rM.corner.length, JSON.stringify(rM.corner));
  check('a merged arrow has no slant: wherever its entry stands, it runs square and turns',
        Object.values(slanted).every(v=> v <= 14) && ['offRight', 'offLeft', 'offUp', 'columnOff'].every(k=> !rM[k].length),
        JSON.stringify({slanted, off: ['offRight', 'offLeft', 'offUp', 'columnOff'].map(k=> rM[k])}));
  });

  await scenario("a picked set lit evenly with what runs between it, and an open entry that stays lit", async () => {
  /* The owner picked a row of entries and saw one of them glow louder than
     the rest, with the lines between them and the remarks on those lines
     looking exactly as they do unpicked. And on a phone an open entry did
     not glow at all until the map was moved — the finger's hover put the
     glow out — and then let go of the entry when the finger came up. */
  const rSel = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    const X = snapToGrid(30000), Y = snapToGrid(30000);
    applyEdit(()=>{
      workingNodes.push(['hsA','Alpha',null,null,null,null,{pos:[X,Y]}]);
      workingNodes.push(['hsB','Beta','hsA',null,null,null,{pos:[X+260,Y]}]);
      workingNodes.push(['hsC','Gamma','hsB',null,null,null,{pos:[X+520,Y]}]);
      workingNodes.push(['hsD','Delta','hsC',null,null,null,{pos:[X+520,Y+200]}]);
      workingNodes.push(['hsP','Parent',null,null,null,null,{pos:[X,Y-200]}]);
      workingNodes.push(['hsK','Remark',null,null,null,'callout',{pos:[X+100,Y-90], leader:{from:'hsA',to:'hsB',at:0.5}}]);
      const a = workingNodes.find(t=> t[0]==='hsA'); a[2] = 'hsP';
    });
    refill(EDGE_STYLES, EDGE_STYLES.concat([{from:'hsB', to:'hsC', note:'on the line', noteAt:0.5}]));
    rebuildChart();
    await wait(350);
    vs = 1; vx = 400 - X; vy = 450 - Y; applyTransform();
    setSelection(['hsA','hsB','hsC'], 'hsA');
    await wait(250);
    const border = id=> qNode(`.node[data-id="${id}"] > rect:not(.node-hover-pad):not(.node-hover-solid)`);
    const look = id=>{ const s = getComputedStyle(border(id)); return s.filter + '|' + s.stroke + '|' + s.strokeWidth; };
    const glows = e=> getComputedStyle(e).filter.includes('drop-shadow');
    const out = {};
    out.looks = ['hsA','hsB','hsC'].map(look);
    out.lines = ['hsA','hsB'].map(to=> [...document.querySelectorAll(`#edgeLayer path.edge.struct[data-to="${to === 'hsA' ? 'hsB' : 'hsC'}"]`)].every(glows));
    out.note = [...document.querySelectorAll('.edge-note[data-from="hsB"][data-to="hsC"]')].map(glows);
    out.leader = [...document.querySelectorAll('.callout-leader[data-id="hsK"]')].map(glows);
    out.callout = glows(border('hsK'));
    /* The primary's own lineage is not brought along: its parent is not
       in the set, and lit it would make the primary the odd one out. */
    out.parentDim = qNode('.node[data-id="hsP"]').classList.contains('dim');
    out.parentLineDim = [...document.querySelectorAll('#edgeLayer path.edge.struct[data-from="hsP"]')].every(p=> p.classList.contains('dim'));
    out.outsideLineDim = [...document.querySelectorAll('#edgeLayer path.edge.struct[data-from="hsC"][data-to="hsD"]')].every(p=> p.classList.contains('dim'));
    /* Let one go and it goes out with its lines. */
    toggleInSelection('hsC');
    await wait(120);
    out.droppedLine = [...document.querySelectorAll('#edgeLayer path.edge.struct[data-from="hsB"][data-to="hsC"]')].every(p=> p.classList.contains('dim'));
    out.droppedNode = qNode('.node[data-id="hsC"]').classList.contains('dim');
    selectNode('hsB');
    await wait(200);
    const r = qNode('.node[data-id="hsB"]').getBoundingClientRect();
    out.at = {x: r.x + r.width/2, y: r.y + r.height/2};
    return out;
  });
  check('every entry of a picked set wears the same mark, the primary no louder', new Set(rSel.looks).size === 1 && rSel.looks[0].includes('drop-shadow'), JSON.stringify(rSel.looks));
  check('the connectors between picked entries glow with them', rSel.lines.every(Boolean), JSON.stringify(rSel.lines));
  check('so does a note on one of those connectors, and a callout and its leader', rSel.note.length && rSel.note.every(Boolean) && rSel.leader.length && rSel.leader.every(Boolean) && rSel.callout, JSON.stringify(rSel));
  check('and the primary brings no lineage of its own into the set', rSel.parentDim && rSel.parentLineDim && rSel.outsideLineDim, JSON.stringify(rSel));
  check('an entry let go of the set goes out with its connectors', rSel.droppedLine && rSel.droppedNode, JSON.stringify(rSel));
  await page.mouse.move(rSel.at.x, rSel.at.y);
  await wait(150);
  const hovered = await page.evaluate(()=> getComputedStyle(qNode('.node[data-id="hsB"] > rect:not(.node-hover-pad):not(.node-hover-solid)')).filter);
  check('the open entry keeps its glow under the pointer — on a phone, the finger that opened it', hovered.includes('drop-shadow'), hovered);
  await page.mouse.move(250, 820);
  await page.mouse.down();
  for(let i = 1; i <= 6; i++){ await page.mouse.move(250 + i * 12, 820 + i * 6); await wait(16); }
  await page.mouse.up();
  await wait(200);
  const afterPan = await page.evaluate(()=> selectedId);
  eq('moving the map leaves the open entry open', afterPan, 'hsB');
  await page.mouse.click(250, 820);
  await wait(200);
  eq('and a click on empty paper still lets it go', await page.evaluate(()=> selectedId), null);
  await page.evaluate(async ()=>{
    deselect();
    EDGE_STYLES.splice(0, EDGE_STYLES.length, ...EDGE_STYLES.filter(s=> s.from !== 'hsB'));
    applyEdit(()=>{ workingNodes = workingNodes.filter(t=> !String(t[0]).startsWith('hs')); });
    rebuildChart();
    await new Promise(r=> setTimeout(r, 250));
  });
  });
  await scenario("square elbows, colours from tags, a legend of one's own and a bar that stays put", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.slice(), beforeStyles = EDGE_STYLES.slice();
    const beforeSettings = JSON.parse(JSON.stringify(SETTINGS));
    const out = {};
    const X = snapToGrid(120000), Y = snapToGrid(-3000);
    applyEdit(()=>{
      workingNodes.push(['tgA','Alpha',null,null,null,null,{pos:[X, Y], tags:['work-a']}]);
      workingNodes.push(['tgB','Beta','tgA',null,null,null,{pos:[X + 260, Y], tags:['work-a','fan-fiction']}]);
      workingNodes.push(['tgC','Gamma','tgB',null,null,null,{pos:[X + 520, Y], tags:['work-a'], colors:['#22cc22']}]);
    });
    await wait(300);

    /* 1. A connector nobody has styled has square elbows. */
    {
      const line = document.querySelector('#edgeLayer path.edge.struct[data-from="tgA"][data-to="tgB"]');
      out.squareDefault = edgeStyleFor('tgA', 'tgB').square === true && edgeStyleFor('x', 'y').routing === 'orthogonal' &&
                          !!line && !/Q/.test(line.getAttribute('d'));
    }

    /* 5. An entry takes its tag's colour; its own colour wins; a special
          tag has no colour to give and no square to set one with. */
    applyEdit(()=> setTagColorIn('work-a', '#3a6fd8'));
    await wait(250);
    out.tagColour = JSON.stringify(['tgA','tgB','tgC'].map(id=> nodes.get(id).colors));
    out.tagColourTaken = nodes.get('tgA').colors[0] === '#3a6fd8' && nodes.get('tgB').colors[0] === '#3a6fd8' &&
                         nodes.get('tgC').colors[0] === '#22cc22';
    out.tagColourSaved = /tagColors: \{'work-a': '#3a6fd8'\}/.test(serializeSettings(SETTINGS));
    SETTINGS.tagColors = Object.assign({}, SETTINGS.tagColors, {'fan-fiction': '#ff0000'});
    out.specialRefused = !/fan-fiction/.test(serializeSettings(SETTINGS)) && tagColorOf('fan-fiction') === null;
    setSideTab(document.getElementById('tagsPanel'), true);
    await wait(250);
    const ffRow = document.querySelector('#tagsList .legend-item[data-tag="fan-fiction"] .swatch:not(.ground-swatch)');
    out.specialNoSwatch = !ffRow || ffRow.classList.contains('swatch-none');
    /* …but a ground has two inks of its own, the author's to set: two
       squares and a button that puts both back. */
    {
      const row = ()=> document.querySelector('#tagsList .legend-item[data-tag="fan-fiction"]');
      const squares = ()=> [...row().querySelectorAll('.ground-swatch')];
      const ink = ()=> getComputedStyle(document.querySelector('#fanfic-weave path')).stroke;
      const g = {before: squares().length, ink0: ink(),
                 resetGreyed: row().querySelector('.ground-reset').disabled};
      /* The squares stand in front of the name, as every tag's square
         does, and the two grounds' reset buttons stand in one column. */
      {
        applyEdit(()=> workingNodes.push(['tgU','Shelved',null,null,null,null,{pos:[X, Y + 400], tags:['unreleased', 'work-b']}]));
        await wait(250);
        const left = (r, sel)=> r.querySelector(sel).getBoundingClientRect().left;
        const rows = ['fan-fiction', 'unreleased'].map(t=> document.querySelector(`#tagsList .legend-item[data-tag="${t}"]`));
        g.squaresFirst = rows.every(r=> left(r, '.ground-swatch') < left(r, '.name'));
        g.resetColumn = rows.map(r=> Math.round(left(r, '.ground-reset')));
        /* …after the name and before the count; and every row, ground or
           not, keeps its name, its count (by its right edge — it is
           right-aligned) and its ✕ in the same columns. */
        g.resetByDel = rows.every(r=>{
          const a = r.querySelector('.ground-reset').getBoundingClientRect();
          const c = r.querySelector('.count').getBoundingClientRect();
          return a.right <= c.left + 0.5 && a.left > r.querySelector('.name').getBoundingClientRect().right - 0.5;
        });
        const all = [...document.querySelectorAll('#tagsList .legend-item')].filter(r=> r.querySelector('.legend-tag-del'));
        const cols = sel=> new Set(all.map(r=> Math.round(left(r, sel)))).size;
        const rights = sel=> new Set(all.map(r=> Math.round(r.querySelector(sel).getBoundingClientRect().right))).size;
        g.columns = {rows: all.length, name: cols('.name'), del: cols('.legend-tag-del'), count: rights('.count')};
        undoLastEdit(); await wait(250);
      }
      squares()[0].click();
      const box = row().querySelector('.hex-box');
      box.value = '#2e86de';
      box.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await wait(250);
      g.inkSet = ink();
      g.saved = /groundColors: \{fanfic:\{base:'#2e86de'\}\}/.test(serializeSettings(SETTINGS));
      g.squareShows = squares()[0].style.background;
      g.glowKept = squares()[1].classList.contains('ground-default');
      row().querySelector('.ground-reset').click();
      await wait(250);
      g.inkBack = ink();
      g.cleared = !SETTINGS.groundColors && !/groundColors/.test(serializeSettings(SETTINGS));
      undoLastEdit(); await wait(250);
      g.undone = ink();
      redoLastEdit(); await wait(250);
      out.ground = g;
      out.groundOk = g.before === 2 && g.resetGreyed && g.squaresFirst && g.resetByDel &&
        g.columns.rows >= 4 && g.columns.name === 1 && g.columns.del === 1 && g.columns.count === 1 &&
        g.resetColumn[0] === g.resetColumn[1] && g.inkSet === 'rgb(46, 134, 222)' && g.saved &&
        g.squareShows === 'rgb(46, 134, 222)' && g.glowKept && g.inkBack === g.ink0 && g.cleared &&
        g.undone === 'rgb(46, 134, 222)';
    }
    setSideTab(document.getElementById('tagsPanel'), false);
    // The form shows the colour drawn, and committing it stores nothing.
    selectNode('tgA'); document.getElementById('detailEditToggle').click(); await wait(300);
    out.formShowsTagColour = document.getElementById('editColorsInput').value === '#3a6fd8';
    commitNodeEdit(); await wait(300);
    const optsA = workingNodes.find(t=> t[0] === 'tgA')[6];
    out.formStoresNothing = !optsA.colors;
    /* A colour is a square, everywhere: the list field is a row of them,
       one pressed opens its code where it stood, and the dashed one adds. */
    {
      selectNode('tgC'); document.getElementById('detailEditToggle').click(); await wait(300);
      const field = document.getElementById('editColorsInput');
      const strip = document.getElementById('editColorsSwatches');
      const sq = {fieldShut: getComputedStyle(field).display === 'none',
                  chips: strip.querySelectorAll('.swatch-chip:not(.swatch-blank)').length};
      const enter = (box, v, key)=>{ box.value = v; box.dispatchEvent(new Event('input'));
        box.dispatchEvent(new KeyboardEvent('keydown', {key: key || 'Enter', bubbles:true})); };
      strip.querySelector('.swatch-blank').click();
      const addBox = strip.querySelector('.hex-box');
      sq.addOpens = !!addBox;
      if(addBox) enter(addBox, '#123456');
      await wait(300);
      sq.added = field.value;
      strip.querySelector('.swatch-chip').click();
      const first = strip.querySelector('.hex-box');
      if(first) enter(first, '#abcdef', 'Escape');
      await wait(200);
      sq.escapeKeeps = field.value;
      commitNodeEdit(); await wait(300);
      sq.stored = JSON.stringify(entryOpts(workingEntry('tgC').entry).colors);
      // …and the text toolbar's colour, the same square.
      openNodeEditor('tgA'); await wait(400);
      const tsq = document.querySelector('#nodeEditorBar .hex-square');
      const hex = document.querySelector('#nodeEditorBar .tb-hex');
      sq.barShut = !!tsq && getComputedStyle(hex).display === 'none' && getComputedStyle(tsq).display !== 'none';
      // A square, not the bar `.mini-toolbar button` used to make of it.
      { const b = tsq.getBoundingClientRect(); sq.barSquare = Math.round(b.width) === Math.round(b.height); }
      /* A click puts the square's colour on the chosen words, as the old
         swatch did; the code is a double click away. */
      const surface = richFields.get('nodeEditorText').surface;
      hex.value = '#cc2200'; hex.dispatchEvent(new Event('input'));
      surface.focus();
      { const r = document.createRange(); r.selectNodeContents(surface);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      tsq.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
      tsq.click();
      sq.clickApplies = /#cc2200|rgb\(204, 34, 0\)/i.test(surface.innerHTML) &&
                        getComputedStyle(hex).display === 'none';
      tsq.dispatchEvent(new MouseEvent('dblclick', {bubbles:true}));
      sq.barOpens = getComputedStyle(hex).display !== 'none' && document.activeElement === hex;
      hex.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      sq.barShuts = getComputedStyle(hex).display === 'none' && getComputedStyle(tsq).display !== 'none';
      closeNodeEditor(true); await wait(200);
      out.squares = sq;
      out.squaresOk = sq.fieldShut && sq.chips === 1 && sq.addOpens && sq.added === '#22cc22, #123456' &&
        sq.escapeKeeps === '#22cc22, #123456' && sq.stored === '["#22cc22","#123456"]' &&
        sq.barShut && sq.barSquare && sq.clickApplies && sq.barOpens && sq.barShuts;
    }
    deselect();

    /* 7. Colours are typed into boxes the size of a colour, side by side. */
    {
      const pair = document.querySelector('.editor-field-pair');
      out.hexPair = !!pair && pair.contains(document.getElementById('editColorsField')) &&
                    pair.contains(document.getElementById('editBgField'));
    }
    /* 8. The callout is added from a mark, not a row. */
    {
      const b = document.getElementById('styleAddCallout');
      out.calloutMark = !!b && !!b.querySelector('svg') && b.textContent.trim() === '' &&
                        b.closest('.style-row') === document.getElementById('styleRouting').closest('.style-row');
    }

    /* 4. The legend is the editor's, and says what its author wants. */
    setSideTab(document.getElementById('keyPanel'), true);
    await wait(250);
    keyList.querySelector('.plus-mini').click(); await wait(100);
    keyList.querySelector('.key-add-own').click(); await wait(200);
    const own = [...keyList.querySelectorAll('.key-item')].find(x=> x.querySelector('.key-own-hex'))
                  .querySelector('.key-name-input');
    own.value = 'Entity'; own.dispatchEvent(new Event('change')); await wait(200);
    out.legendOwnRow = (SETTINGS.legendOwn || []).some(r=> r.name === 'Entity') &&
                       /legendOwn:/.test(serializeSettings(SETTINGS));
    setSideTab(document.getElementById('keyPanel'), false);
    markReadOnly(); await wait(200);
    // Since 20.11 the reader reads the legend too, and only reads it.
    setSideTab(document.getElementById('keyPanel'), true); await wait(150);
    out.legendHiddenForReader = getComputedStyle(document.getElementById('keyPanel')).display !== 'none' &&
      !keyList.querySelector('input, textarea, .plus-mini, .key-sample-btn') &&
      [...keyList.querySelectorAll('.key-name')].some(x=> x.textContent === 'Entity');
    setSideTab(document.getElementById('keyPanel'), false);
    markEditable(); await wait(200);

    /* 2 and 3. A merge: the arrow out of it is a connector with a look of
       its own, the amalgam may ripple, straight segments keep the bar, and
       the bar is the lineages' — the entry carried about does not move it,
       and it is carried itself along the arrow's axis. */
    applyEdit(()=>{
      workingNodes.push(['mbA','One',null,null,null,null,{pos:[X, Y + 400]}]);
      workingNodes.push(['mbB','Two',null,null,null,null,{pos:[X + 260, Y + 400]}]);
      workingNodes.push(['mbC','Three',null,null,null,null,{pos:[X + 520, Y + 400]}]);
      workingNodes.push(['mbM','Merge',['mbA','mbB','mbC'],null,null,null,{merge:true, pos:[X + 260, Y + 600], border:'wavy'}]);
    });
    await wait(400);
    vs = 1.2; vx = 600 - (X + 300) * vs; vy = 300 - (Y + 450) * vs; applyTransform();
    await wait(150);
    out.amalgamRipples = isWavyBorder(nodes.get('mbM')) &&
      !!document.querySelector('.node[data-id="mbM"] > path');
    out.outHit = !!document.querySelector('.edge-hit[data-from=""][data-to="mbM"]');
    applyEdit(()=> setEdgeStyleOverride('', 'mbM', Object.assign({}, edgeStyleFor('', 'mbM'), {dash:'dashed'})));
    await wait(250);
    out.outDashed = document.querySelector('.amalgam-out[data-to="mbM"]').getAttribute('stroke-dasharray') === DASH_PATTERNS.dashed;
    openEdgeStylePopover('', 'mbM', {clientX:500, clientY:400, stopPropagation(){}});
    await wait(200);
    out.outGlows = !!document.querySelector('.amalgam-out.edge-picked[data-to="mbM"]') &&
                   !document.getElementById('styleFillRow').hidden &&
                   deleteOpenConnector() === false;
    closeEdgePopover(); await wait(150);

    const rec0 = amalgamBars.get('mbM');
    const barAt = ()=> +amalgamBars.get('mbM').cross.toFixed(2);
    const toClient = (x, y)=>{ const r0 = svg.getBoundingClientRect(); return {x: r0.left + vx + x*vs, y: r0.top + vy + y*vs}; };
    const hit = ()=> document.querySelector('.amalgam-bar-hit[data-amalgam="mbM"]');
    // A click picks the bar out.
    let p = toClient(rec0.lo * 0.8 + rec0.hi * 0.2, rec0.cross);
    hit().dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y}));
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    hit().dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y, detail:1}));
    await wait(100);
    out.barFocused = amalgamBarFocus === 'mbM' && !!document.querySelector('.amalgam-bar-focus[data-amalgam="mbM"]');
    /* …lit as a picked connector is lit, and along the bar only: the same
       glow, laid on tracings of the stretches, none of them reaching up a
       lineage. */
    {
      const glows = [...document.querySelectorAll('.amalgam-bar-focus[data-amalgam="mbM"]')];
      const line = document.querySelector('.edge.amalgam-member[data-to="mbM"]');
      line.classList.add('edge-picked');
      const picked = getComputedStyle(line).filter;
      line.classList.remove('edge-picked');
      out.barGlow = JSON.stringify({n: glows.length, picked, bar: glows.map(g=> getComputedStyle(g).filter),
                                    h: glows.map(g=> +g.getBBox().height.toFixed(2))});
      out.barLitAsPicked = glows.length >= 1 && picked !== 'none' &&
        glows.every(g=> getComputedStyle(g).filter === picked && g.getBBox().height < 1);
    }
    // A carry moves it down, along the arrow, and is written down.
    const before = barAt();
    hit().dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y}));
    for(let k = 1; k <= 8; k++){
      window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:p.x + k, clientY:p.y + k*8}));
      await wait(20);
    }
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    await wait(350);
    const moved = barAt();
    const stored = workingNodes.find(t=> t[0] === 'mbM')[6].bar;
    out.barCarried = moved > before + GRID && !!stored && stored.k === 'y' && stored.after === true;
    out.barAt = JSON.stringify({before, moved, stored});
    // Undo puts it back where it was.
    undoLastEdit(); await wait(300);
    out.barUndone = Math.abs(barAt() - before) < 0.05;
    redoLastEdit(); await wait(300);
    // The entry carried up beside the bar and past it: the bar does not move.
    const m = nodes.get('mbM');
    const start = toClient(m.x + m.w/2, m.y + m.h/2);
    const g = document.querySelector('.node[data-id="mbM"]');
    g.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:start.x, clientY:start.y}));
    const seen = new Set();
    for(let k = 1; k <= 20; k++){
      window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:start.x + k*12, clientY:start.y - k*14}));
      await wait(30);
      seen.add(barAt());
    }
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    await wait(400);
    out.barHeldUnderEntry = seen.size === 1 && [...seen][0] === moved && barAt() === moved;
    out.barSeen = JSON.stringify([...seen]);
    // A double click on a stretch opens that lineage's panel.
    const rec1 = amalgamBars.get('mbM');
    const s3 = rec1.stretches.find(s=> s.from === 'mbC');
    p = toClient((s3.lo + s3.hi) / 2, rec1.cross);
    hit().dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true, clientX:p.x, clientY:p.y}));
    await wait(200);
    out.stretchOpens = edgePopover.classList.contains('open') && currentEdgeStyleTarget &&
                       currentEdgeStyleTarget.from === 'mbC' && currentEdgeStyleTarget.to === 'mbM';
    /* With that lineage picked, a double click on its stretch is what it
       is on the rest of the line: its note. The click before it lets the
       panel go, as any click does, so this is the whole gesture. */
    hit().dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y}));
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    hit().dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y, detail:1}));
    hit().dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y}));
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    hit().dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, button:0, clientX:p.x, clientY:p.y, detail:2}));
    hit().dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true, clientX:p.x, clientY:p.y}));
    await wait(250);
    out.pickedStretchNote = JSON.stringify(nodeEditorTarget);
    out.pickedStretchWrites = !!nodeEditorTarget && nodeEditorTarget.kind === 'note' &&
      nodeEditorTarget.from === 'mbC' && nodeEditorTarget.to === 'mbM' && !nodeEditor.hidden;
    closeNodeEditor(true);
    closeEdgePopover();
    await wait(150);
    /* The field opened on a note stands on its plate: the words on the
       words, and the frame on the plate, not a few pixels under it. */
    applyEdit(()=> setEdgeStyleOverride('mbC', 'mbM', Object.assign({}, edgeStyleFor('mbC', 'mbM'),
      {note: 'A note on the line', notePos: 'above', noteAt: 0.3})));
    await wait(250);
    openEdgeNoteEditor('mbC', 'mbM', {focus: false});
    await wait(150);
    {
      const g = document.querySelector('.edge-note[data-from="mbC"][data-to="mbM"]');
      const words = [...g.querySelectorAll('.edge-note-text')].map(e=> getComputedStyle(e).opacity);
      const plate = getComputedStyle(g.querySelector('.edge-note-plate')).opacity;
      out.noteFrame = JSON.stringify({words, plate});
      out.noteFrameOnPlate = words.length > 0 && words.every(o=> o === '0') && plate !== '0';
    }
    closeNodeEditor(true);
    /* A side set by hand on one lineage does not take the bar away from
       the reader: the carry still has somewhere to move it from. */
    applyEdit(()=> setEdgeStyleOverride('mbA', 'mbM', Object.assign({}, edgeStyleFor('mbA', 'mbM'), {toSide:'top'})));
    await wait(300);
    {
      const rec2 = amalgamBars.get('mbM');
      out.handRest = JSON.stringify(rec2 && rec2.rest);
      const at0 = barAt();
      const q = toClient(rec2.axis === 'x' ? (rec2.lo + rec2.hi)/2 : rec2.cross,
                         rec2.axis === 'x' ? rec2.cross : (rec2.lo + rec2.hi)/2);
      hit().dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:q.x, clientY:q.y}));
      for(let k = 1; k <= 8; k++){
        window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:q.x + k*8, clientY:q.y + k*8}));
        await wait(20);
      }
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(350);
      out.handCarried = Math.abs(barAt() - at0) > GRID &&
                        !!(workingNodes.find(t=> t[0] === 'mbM')[6].bar);
      out.handBarAt = JSON.stringify({at0, now: barAt()});
    }
    /* Every lineage straight: the two at the ends run to the middle one,
       which keeps the bar, and the merge still has its junction. */
    /* Set on the style each lineage already has, where it has one:
       edgeStyleFor reads the first, so a second pushed after it is never
       seen — which is how this once made only the middle one straight. */
    ['mbA','mbB','mbC'].forEach(f=>{
      const had = EDGE_STYLES.find(x=> x.from === f && x.to === 'mbM');
      if(had) had.routing = 'straight';
      else EDGE_STYLES.push({from:f, to:'mbM', routing:'straight', dash:'solid', arrow:true});
    });
    redrawEdges(); await wait(200);
    out.straightJoints = document.querySelectorAll('.amalgam-joint[data-to="mbM"]').length;
    out.straightJoints = JSON.stringify({j: !!document.querySelector('.amalgam-junction[data-to="mbM"]'),
      d: [...document.querySelectorAll('.amalgam-direct[data-to="mbM"]')].map(p=> p.dataset.from),
      m: document.querySelectorAll('.amalgam-member[data-to="mbM"]').length});
    out.straightKeepsBar = !!document.querySelector('.amalgam-junction[data-to="mbM"]') &&
      document.querySelectorAll('.amalgam-direct[data-to="mbM"]').length === 2 &&
      document.querySelectorAll('.amalgam-member[data-to="mbM"]').length === 3;

    applyEdit(()=>{
      workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
      refill(EDGE_STYLES, beforeStyles);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
      Object.assign(SETTINGS, beforeSettings);
    });
    setBarFocus(null);
    await wait(300);
    return out;
  });
  check('a connector nobody styled turns square elbows', r.squareDefault);
  check('an entry takes the colour of its tag, its own colour wins', r.tagColourTaken && r.tagColourSaved, r.tagColour);
  check('a special tag has no colour and no square to set one', r.specialRefused && r.specialNoSwatch);
  check('a ground takes two colours of its own from its row, and a button puts both back',
        r.groundOk, JSON.stringify(r.ground));
  check('a colour is a square that opens its code where it stands, in a list and on a toolbar, where a click spends it',
        r.squaresOk, JSON.stringify(r.squares));
  check('the form shows the tag colour and stores none of it', r.formShowsTagColour && r.formStoresNothing);
  check('border and background colours sit side by side', r.hexPair);
  check('a callout is added from a mark beside the path', r.calloutMark);
  check('the legend takes rows of the author\'s own, and readers read it with nothing to edit (20.11)',
        r.legendOwnRow && r.legendHiddenForReader, JSON.stringify({own:r.legendOwnRow, hidden:r.legendHiddenForReader}));
  check('an amalgam may ripple', r.amalgamRipples);
  check('the merged arrow can be pointed at, styled, repainted and lit, but not deleted',
        r.outHit && r.outDashed && r.outGlows, JSON.stringify({hit:r.outHit, dash:r.outDashed, glow:r.outGlows}));
  check('a click picks out the bar', r.barFocused);
  check('a picked bar glows as a picked connector does, along the bar only', r.barLitAsPicked, r.barGlow);
  check('a carried bar moves along the arrow and is written down, and undo takes it back',
        r.barCarried && r.barUndone, r.barAt);
  check('the entry carried beside and past its bar never moves it', r.barHeldUnderEntry, r.barSeen);
  check('a double click on a stretch of the bar opens that lineage', r.stretchOpens);
  check('a double click on the stretch of a lineage already picked opens its note', r.pickedStretchWrites, r.pickedStretchNote);
  check('the field on a connector\'s note stands on the plate itself: the plate is seen, its drawn words are not', r.noteFrameOnPlate, r.noteFrame);
  check('a lineage given its side by hand still leaves the bar something to be carried from',
        r.handCarried, JSON.stringify({rest:r.handRest, at:r.handBarAt}));
  check('every lineage straight still makes a merge with a junction', r.straightKeepsBar, String(r.straightJoints));
  });
  await scenario("seen from far away: patches by tag, then by category", async () => {
  const r = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.slice(), beforeCats = JSON.parse(JSON.stringify(TAG_CATS));
    const beforeSettings = JSON.parse(JSON.stringify(SETTINGS));
    const keep = {vs, vx, vy};
    const out = {};
    applyEdit(()=>{
      workingNodes.length = 0;
      [['Work A', 0, 0], ['Work B', 900, 0], ['Work C', 0, 1600]].forEach(([t, ox, oy], w)=>{
        for(let k = 0; k < 6; k++) workingNodes.push(['ld' + w + k, t + ' ' + k, null, null, null, null,
          {pos:[ox + (k % 3) * 170, oy + Math.floor(k / 3) * 90], tags:[t]}]);
      });
      SETTINGS.tagColors = {'Work A': '#3a6fd8', 'Work B': '#2f6fb5', 'Work C': '#d84a3a'};
      refill(TAG_CATS, [{name:'Franchise', tags:['Work A', 'Work B']}]);
    });
    await wait(300);
    const h = lodEntryHeight();
    vs = 12 / h; applyTransform(); await wait(100);
    out.near = lodLevel === 0 && !document.body.classList.contains('lod');
    vs = (LOD_TAG_PX - 1) / h; applyTransform(); await wait(100);
    const patches = ()=> [...document.querySelectorAll('#lodLayer .lod-patch')].map(g=> g.dataset.key).sort();
    out.tagPatches = JSON.stringify(patches());
    out.byTag = lodLevel === 1 && out.tagPatches === JSON.stringify(['Work A', 'Work B', 'Work C']) &&
                getComputedStyle(nodeLayer).display === 'none';
    out.tagColour = document.querySelector('.lod-patch[data-key="Work A"] path').getAttribute('fill') === '#3a6fd8';
    /* A patch is a blob, not a figure: its outline is curved all the way
       round, with no straight run and no corner left in it. */
    {
      const d = document.querySelector('.lod-patch[data-key="Work A"] path').getAttribute('d');
      out.patchPath = d.slice(0, 60);
      out.patchIsBlob = /^M[-\d.,]+( C[-\d., ]+)+Z$/.test(d) && !/ L/.test(d) && (d.match(/C/g) || []).length >= 6;
    }
    /* …and the bow is what makes it one. Corner-cutting alone leaves a
       ruled side of the hull exactly where it was, so each side is given
       a midpoint pushed out along its own normal first. */
    {
      const bowed = lodBow([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], 0.1);
      out.bowed = bowed.length === 8 && bowed[1].y === -10 && bowed[3].x === 110 &&
                  bowed[5].y === 110 && bowed[7].x === -10;
      out.bowPts = JSON.stringify(bowed.map(q=> [q.x, q.y]));
    }
    vs = (LOD_CAT_PX - 0.5) / h; applyTransform(); await wait(100);
    out.catPatches = JSON.stringify(patches());
    out.byCat = lodLevel === 2 && out.catPatches === JSON.stringify(['Work C', 'cat:Franchise']);
    // A click on a patch goes in to where its entries can be read.
    document.querySelector('.lod-patch[data-key="cat:Franchise"] path')
      .dispatchEvent(new MouseEvent('click', {bubbles:true}));
    await wait(100);
    out.zoomedIn = lodLevel === 0 && getComputedStyle(nodeLayer).display !== 'none';
    applyEdit(()=>{
      workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
      refill(TAG_CATS, beforeCats);
      Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
      Object.assign(SETTINGS, beforeSettings);
    });
    vs = keep.vs; vx = keep.vx; vy = keep.vy; applyTransform();
    await wait(200);
    return out;
  });
  check('close in, the entries are drawn as themselves', r.near);
  check('far out, a patch for each cluster of a tag, in the tag\'s colour', r.byTag && r.tagColour, r.tagPatches);
  check('further out, one patch for each category', r.byCat, r.catPatches);
  check('a patch is a blob, curved all the way round', r.patchIsBlob, r.patchPath);
  check('every side of its hull bows outward before the corners are cut',
        r.bowed, r.bowPts);
  check('a click on a patch zooms in until its entries can be read', r.zoomedIn);
  });
  await scenario("scenery with a look of its own, a glow and a menu", async () => {
  const rS = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const keep = {vs, vx, vy};
    const out = {};
    const X = snapToGrid(9000), Y = snapToGrid(9000);
    applyEdit(()=>{
      workingNodes.length = 0;
      workingNodes.push(['scH', 'Hub', null, null, null, null, {pos:[X, Y], tags:[HUB_TAG], border:'dashed'}]);
      workingNodes.push(['scL', 'Local', null, null, null, null, {pos:[X + 330, Y], tags:[LOCAL_TAG], border:'wavy'}]);
    });
    await wait(500);
    const r = svg.getBoundingClientRect();
    vs = 1.5; vx = r.width/2 - (X + 200)*vs; vy = r.height/2 - (Y + 40)*vs; applyTransform();
    await wait(250);

    /* The scenery no longer copies the box it stands behind: a dashed
       entry gets a plain echo and a rippled one a plain stack, until
       somebody asks for otherwise. */
    const echoes = ()=> [...document.querySelectorAll('.hub-echo')];
    const sheets = ()=> [...document.querySelectorAll('.local-sheet')];
    out.plainEcho = echoes().length >= 1 && echoes().every(p=> !p.getAttribute('stroke-dasharray'));
    out.plainSheet = sheets().length >= 1 &&
      sheets().every(p=> p.tagName.toLowerCase() === 'rect' && !p.getAttribute('stroke-dasharray'));
    out.sceneryWas = JSON.stringify({echo: echoes().map(p=> p.getAttribute('stroke-dasharray') || '-'),
                                     sheet: sheets().map(p=> p.tagName)});

    // There is something to point at, and pointing at it offers its look.
    out.bands = document.querySelectorAll('.node-aura-hit').length;
    const band = document.querySelector('.node-aura-hit[data-id="scH"]');
    openStyleBar({kind:'decor', id:'scH'});
    await wait(150);
    out.menuGroups = [...styleBar.querySelectorAll('.style-bar-group:not([hidden])')]
      .map(g=> g.dataset.group).join(',');
    out.menuIsDecor = !styleBar.hidden && out.menuGroups === 'decor';

    // …and choosing one changes the scenery and nothing else.
    applyStyleBar('decor', 'dashed');
    await wait(350);
    out.decorStored = (workingNodes.find(t=> t[0] === 'scH') || [])[6].decor;
    out.borderKept = (workingNodes.find(t=> t[0] === 'scH') || [])[6].border;
    out.echoTookIt = echoes().length >= 1 && echoes().every(p=> !!p.getAttribute('stroke-dasharray'));
    closeStyleBar();

    /* Picked on its own, the scenery is lit the way everything else on
       the chart is lit when it is picked. */
    const lit = ()=> [...document.querySelectorAll('.node-aura.picked')].map(g=> g.dataset.id).sort();
    deselect();
    setDecorPick('scH');
    await wait(100);
    out.sceneryPicked = JSON.stringify(lit());
    const glow = band ? getComputedStyle(document.querySelector('.node-aura.picked .hub-echo')).filter : '';
    out.sceneryGlows = glow !== 'none' && glow.includes('drop-shadow');
    out.glow = glow;

    // And picking the ENTRY lights its scenery with it.
    setDecorPick(null);
    setSelection(['scL'], 'scL');
    await wait(150);
    out.entryLightsScenery = JSON.stringify(lit()) === JSON.stringify(['scL']);
    out.entryLit = JSON.stringify(lit());
    deselect();
    setDecorPick(null);

    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x)); });
    vs = keep.vs; vx = keep.vx; vy = keep.vy; applyTransform();
    await wait(300);
    return out;
  });
  check('an entry\'s scenery does not copy the entry\'s own outline',
        rS.plainEcho && rS.plainSheet, rS.sceneryWas);
  check('the scenery can be pointed at, and pointing at it offers its look',
        rS.bands === 2 && rS.menuIsDecor, JSON.stringify({bands:rS.bands, groups:rS.menuGroups}));
  check('a look chosen there is the scenery\'s, not the box\'s',
        rS.decorStored === 'dashed' && rS.borderKept === 'dashed' && rS.echoTookIt,
        JSON.stringify({decor:rS.decorStored, border:rS.borderKept}));
  check('scenery picked on its own glows as anything picked does',
        rS.sceneryPicked === '["scH"]' && rS.sceneryGlows, rS.glow);
  check('picking the entry lights its scenery too', rS.entryLightsScenery, rS.entryLit);
  });
  await scenario("a page told late that it is read-only", async () => {
  /* An answer to "may this viewer write?" that arrives after the first
     draw (on claude.ai it always did) finds everything left out by asking
     readOnlyView already built for an editor. The owner found the side
     tabs' + buttons that way: a tag, a category, a reference. */
  const late = await page.evaluate(async ()=>{
    const wait = (ms)=> new Promise(r=> setTimeout(r, ms));
    document.querySelectorAll('.side-tab').forEach(p=> setSideTab(p, true));
    const shown = sel=> [...document.querySelectorAll(sel)].filter(e=>{
      const s = getComputedStyle(e); return s.display !== 'none' && e.getBoundingClientRect().width > 0; }).length;
    const ask = ()=> ({plus: shown('#sideTabs .plus-mini'), refTools: shown('#sideTabs .ref-tools button'),
                       refColour: shown('#refColorRow'), tagDel: shown('.legend-tag-del')});
    const before = ask();
    markReadOnly();
    await wait(250);
    const after = ask();
    /* And refused, not only hidden: a stale button or a key path still
       reaches the functions. */
    const refsBefore = REFS.length;
    startNewTagEntry(); startNewCategoryEntry(); startNewRefEntry();
    const pending = pendingNewTag || pendingNewCat || pendingNewRef;
    if(REFS.length) await deleteRef(REFS[0].key);
    const refsAfter = REFS.length;
    markEditable();
    await wait(250);
    const back = ask();
    document.querySelectorAll('.side-tab').forEach(p=> setSideTab(p, false));
    return {before, after, back, pending, refsBefore, refsAfter};
  });
  // Four since 0.12.0: the legend has a + of its own for the rows it shows;
  // five since 0.25.0, with the Media drawer's.
  check('an editor has the + buttons to begin with', late.before.plus === 5 && late.before.refColour === 1, JSON.stringify(late.before));
  check('a page told late that it is read-only offers no + for a tag, a category or a reference, nor a reference\'s ✎ ✕ or the citation colour',
        late.after.plus === 0 && late.after.refTools === 0 && late.after.refColour === 0 && late.after.tagDel === 0, JSON.stringify(late.after));
  check('and the functions behind them refuse a reader', !late.pending && late.refsBefore === late.refsAfter, JSON.stringify(late));
  check('the way back gives them back', late.back.plus === 5 && late.back.refColour === 1, JSON.stringify(late.back));
  });
  await scenario("squares, scenery, clusters and the view as of 2026-10-17", async () => {
  const r17 = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const keepColors = SETTINGS.tagColors ? Object.assign({}, SETTINGS.tagColors) : null;
    const keep = {vs, vx, vy};
    const out = {};
    applyEdit(()=>{
      workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['q1','One',null,null,null,null,{pos:[0,0], tags:['zq-a']}]);
      workingNodes.push(['q2','Two',null,null,null,null,{pos:[0,120], tags:['zq-b']}]);
      workingNodes.push(['qH','Hub',null,null,null,null,{pos:[400,0], tags:[HUB_TAG], decor:'double'}]);
      workingNodes.push(['qW','Hub',null,null,null,null,{pos:[400,200], tags:[HUB_TAG], decor:'wavy'}]);
    });
    await wait(500);
    document.querySelectorAll('.side-tab').forEach(p=> setSideTab(p, true));
    await wait(200);

    /* Pressing another square while a code is open keeps the open one —
       when it is a colour — and opens the one pressed. */
    const pick = t=> document.querySelector(`#tagsList .legend-item[data-tag="${t}"] .swatch-pick`);
    const press = el=> el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true}));
    pick('zq-a').click();
    await wait(50);
    let box = document.querySelector('#tagsList .legend-item[data-tag="zq-a"] .hex-box');
    out.firstOpen = !!box;
    if(box){ box.value = '#123456'; box.dispatchEvent(new Event('input', {bubbles:true})); }
    press(pick('zq-b'));
    await wait(150);
    out.firstKept = tagColorOf('zq-a');
    out.secondOpen = !!document.querySelector('#tagsList .legend-item[data-tag="zq-b"] .hex-box') &&
                     !document.querySelector('#tagsList .legend-item[data-tag="zq-a"] .hex-box');
    // …and one that is not a colour is not kept.
    box = document.querySelector('#tagsList .legend-item[data-tag="zq-b"] .hex-box');
    if(box){ box.value = '#12'; box.dispatchEvent(new Event('input', {bubbles:true})); }
    press(pick('zq-a'));
    await wait(150);
    out.badDropped = tagColorOf('zq-b') || null;
    const still = document.activeElement && document.activeElement.classList.contains('hex-box') ? document.activeElement : null;
    if(still) still.blur();
    /* A press that brings no click of its own — as a synthetic one does —
       must not leave the swallow waiting for somebody else's. */
    { const b = document.createElement('button'); let got = 0;
      b.addEventListener('click', ()=> got++); document.body.appendChild(b);
      b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); b.click(); b.remove();
      out.nextClickHeard = got === 1; }
    await wait(100);

    /* One square for the citation colour, and every square one size. */
    out.refSquares = document.querySelectorAll('#refColorRow .hex-square').length;
    const size = el=>{ const b = el && el.getBoundingClientRect(); return b ? Math.round(b.width) + 'x' + Math.round(b.height) : null; };
    out.sizes = {ref: size(document.querySelector('#refColorRow .hex-square')),
                 tag: size(pick('zq-a'))};
    document.querySelectorAll('.side-tab').forEach(p=> setSideTab(p, false));

    // A hub's echo takes a double line and a ripple too.
    const echo = id=> [...document.querySelectorAll(`.node-aura[data-id="${id}"] .hub-echo`)];
    out.doubleEcho = echo('qH').length > 0 &&
      echo('qH').every(p=> p.tagName === 'path' && (p.getAttribute('d').match(/M/g) || []).length === 2);
    out.wavyEcho = echo('qW').length > 0 &&
      echo('qW').every(p=> p.tagName === 'path' && /[CQ]/.test(p.getAttribute('d')));

    // The clusters can be turned off from the bar, and stay off.
    const lodBtn = document.getElementById('lodToggle');
    vs = 0.05; applyTransform();
    out.lodOnFar = lodLevelNow();
    lodBtn.click();
    out.lodOffFar = lodLevelNow();
    out.lodStored = localStorage.getItem('rhizome.lod');
    out.lodBtnOff = !lodBtn.classList.contains('active');
    lodBtn.click();
    out.lodBack = lodLevelNow() > 0 && lodBtn.classList.contains('active');

    // The view: no zoom shown, kept between visits, and a way home.
    centreViewOn(1234, -567, 1.25);
    await wait(400);
    out.coord = document.getElementById('coord').textContent;
    /* The box round the coordinates is sized from its text and contained,
       so that new numbers on every frame of a pan do not lay out the page
       and the drawing with it (showCoord). Whatever the numbers, the text
       fits it — and only a change in their count resizes it. */
    {
      const box = document.querySelector('.coord'), t = document.getElementById('coord');
      const fits = [];
      for(const [x, y] of [[0, 0], [-321, 309], [-123456, -654321], [7, 8]]){
        centreViewOn(x, y, 1);
        const b = box.getBoundingClientRect(), r = t.getBoundingClientRect(), h = document.getElementById('coordHome').getBoundingClientRect();
        fits.push(r.left >= b.left && h.right <= b.right + 0.5 && h.left >= r.right && Math.abs((b.right - h.right) - (r.left - b.left)) < 6);
      }
      out.coordFits = fits;
      out.coordContained = /size/.test(getComputedStyle(box).contain) && /layout/.test(getComputedStyle(box).contain);
      centreViewOn(1234, -567, 1.25);
    }
    let saved = null; try{ saved = JSON.parse(localStorage.getItem(VIEW_KEY)); }catch(e){}
    out.saved = saved;
    out.viewKeyIsTheChart = VIEW_KEY === 'rhizome.view:' + STORE_KEY.slice(STORE_PREFIX.length) && localStorage.getItem('rhizome.view') === null;
    vs = 0.3; vx = 0; vy = 0; applyTransform();
    await wait(50);
    localStorage.setItem(VIEW_KEY, JSON.stringify({x:1234, y:-567, s:1.25}));
    openingView();
    const c1 = viewCentre();
    out.restored = Math.abs(c1.x - 1234) < 1 && Math.abs(c1.y + 567) < 1 && Math.abs(vs - 1.25) < 1e-6;
    document.getElementById('coordHome').click();
    const c2 = viewCentre();
    out.home = Math.abs(c2.x) < 1 && Math.abs(c2.y) < 1 && Math.abs(vs - 1.25) < 1e-6;
    // Another chart's view is not this one's; the old shared key is read
    // only while this chart has none of its own.
    localStorage.removeItem(VIEW_KEY);
    localStorage.setItem('rhizome.view:/another/chart.html', JSON.stringify({x:999, y:999, s:2}));
    localStorage.setItem('rhizome.view', JSON.stringify({x:-50, y:60, s:0.5}));
    openingView();
    const c4 = viewCentre();
    out.legacy = Math.abs(c4.x + 50) < 1 && Math.abs(c4.y - 60) < 1 && Math.abs(vs - 0.5) < 1e-6;
    localStorage.removeItem('rhizome.view');
    localStorage.removeItem('rhizome.view:/another/chart.html');
    openingView();
    const c3 = viewCentre();
    out.fresh = Math.abs(c3.x) < 1 && Math.abs(c3.y) < 1 && vs === 1;

    /* An amalgam whose middle parent is level with it gets a straight
       stem, not a step the size of the corner it could not fit. */
    const orig = window.amalgamStem; const stems = [];
    window.amalgamStem = function(geo, from, pn){ const s = orig(geo, from, pn); stems.push(s.pts); return s; };
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['p1','One',null,null,null,null,{pos:[0,0], colors:['#4444dd']}]);
      workingNodes.push(['p2','Two',null,null,null,null,{pos:[0,120], colors:['#cccc33']}]);
      workingNodes.push(['p3','Three',null,null,null,null,{pos:[0,240], colors:['#dd33cc']}]);
      workingNodes.push(['m','Merged',['p1','p2','p3'],null,null,null,{merge:true, pos:[300,153]}]);
    });
    await wait(400);
    window.amalgamStem = orig;
    const last = stems[stems.length - 1] || [];
    out.stem = last.map(p=> [Math.round(p.x), Math.round(p.y)]);
    out.stemStraight = last.length === 2 && Math.abs(last[0].y - last[1].y) < 0.01;

    /* A wave is held flat for a quarter wave before a trimmed end, so the
       line runs into the arrowhead along its axis. */
    const line = []; for(let s = 0; s <= 200; s++) line.push({x:s, y:0, s});
    const wp = waveOffsetPoints(line, 3, 20, 0, 180);
    out.heldFlat = wp.filter(p=> p.s >= 175).every(p=> Math.abs(p.y) < 1e-9) &&
                   wp.some(p=> Math.abs(p.y) > 1);

    /* A connector with both its entries carried is moved with them, not
       routed again; one with a single end carried is routed. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['c1','One',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['c2','Two','c1',null,null,null,{pos:[200,80]}]);
      workingNodes.push(['c3','Three','c2',null,null,null,{pos:[420,0]}]);
    });
    await wait(200);
    {
      const routeOf = (f, t)=> drawnRoutes.get(calloutEdgeKey(f, t)).pts.map(q=> [q.x, q.y]);
      const memo = new Map(), moving = new Set(['c1','c2']);
      const shift = (d)=>{ ['c1','c2'].forEach(id=>{ const n = nodes.get(id); n.x += d; n.y += d; }); };
      dragRouteHold = {memo, moving}; redrawEdges(); dragRouteHold = null;
      const was = routeOf('c1','c2');
      shift(10);
      const orig = window.routeEdge; const asked = [];
      window.routeEdge = function(a, b){ asked.push(a.id + '>' + b.id); return orig.apply(this, arguments); };
      try{ dragRouteHold = {memo, moving}; redrawEdges(); }
      finally{ dragRouteHold = null; window.routeEdge = orig; }
      const now = routeOf('c1','c2');
      out.carried = now.length === was.length && now.every((q, i)=> Math.abs(q[0] - was[i][0] - 10) < 1e-6 && Math.abs(q[1] - was[i][1] - 10) < 1e-6);
      out.asked = asked;
      shift(-10); redrawEdges();
    }

    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x));
                    if(keepColors) SETTINGS.tagColors = keepColors; else delete SETTINGS.tagColors; });
    vs = keep.vs; vx = keep.vx; vy = keep.vy; applyTransform();
    await wait(300);
    return out;
  });
  check('pressing another square keeps the open colour and opens the one pressed',
        r17.firstOpen && r17.firstKept === '#123456' && r17.secondOpen, JSON.stringify(r17));
  check('…and a code that is not a colour is not kept', r17.badDropped === null, r17.badDropped);
  check('the next press\'s click is its own', r17.nextClickHeard);
  check('the citation colour has one square', r17.refSquares === 1, r17.refSquares);
  check('a square in a menu is the size of a tag\'s', r17.sizes.ref === '11x11' && r17.sizes.tag === '11x11',
        JSON.stringify(r17.sizes));
  check('a hub\'s echo can be double', r17.doubleEcho);
  check('a hub\'s echo can ripple', r17.wavyEcho);
  check('the clusters can be turned off from the bar, and it is remembered',
        r17.lodOnFar > 0 && r17.lodOffFar === 0 && r17.lodStored === '0' && r17.lodBtnOff && r17.lodBack,
        JSON.stringify({on:r17.lodOnFar, off:r17.lodOffFar, stored:r17.lodStored}));
  check('the coordinates say where the middle of the view is, with no zoom',
        r17.coord === 'x1234 · y-567', r17.coord);
  check('the coordinates box fits its numbers, short or long, and keeps them from laying out the page',
        r17.coordFits.every(Boolean) && r17.coordContained, JSON.stringify([r17.coordFits, r17.coordContained]));
  check('the view is kept for the next visit, and put back',
        r17.saved && r17.saved.x === 1234 && r17.saved.y === -567 && r17.saved.s === 1.25 && r17.restored,
        JSON.stringify(r17.saved));
  check('⌖ goes to x 0, y 0 at the same zoom', r17.home);
  check('the view is kept under this chart\'s own address, so two charts in one browser do not share one',
        r17.viewKeyIsTheChart);
  check('and the view everyone kept before, under one key, opens a chart that has none of its own yet', r17.legacy);
  check('a first visit opens on the origin, in the middle', r17.fresh);
  check('an amalgam level with its middle parent has a straight stem', r17.stemStraight, JSON.stringify(r17.stem));
  check('a wave runs flat into a trimmed end', r17.heldFlat);
  check('a connector carried at both ends is moved, not routed again; one carried at one end is routed',
        r17.carried && !r17.asked.includes('c1>c2') && r17.asked.includes('c2>c3'), JSON.stringify(r17.asked));
  });
  await scenario("hand bends that keep to a guide and to their place", async () => {
  const hb = await page.evaluate(async ()=>{
    const wait = ms=> new Promise(res=> setTimeout(res, ms));
    const beforeNodes = workingNodes.map(x=> x.slice());
    const beforeStyles = EDGE_STYLES.map(x=> JSON.parse(JSON.stringify(x)));
    const keep = {vs, vx, vy};
    const out = {};
    const W = (x,y)=>{ const sr = svg.getBoundingClientRect(); return {x: sr.left + vx + x*vs, y: sr.top + vy + y*vs}; };
    const rt = (f,t)=> drawnRoutes.get(calloutEdgeKey(f,t)).pts;
    const mark = e=>{ const m = e.querySelector('.bend-mark'); return {x:+m.getAttribute('cx'), y:+m.getAttribute('cy')}; };

    /* A corner pulled down onto another connector's level with Shift, the
       hand a few units off to one side, lands on that level. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['hbB','Beast Wars: Uprising',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['hbA','Wars: Uprising','hbB',null,null,null,{pos:[-300,0]}]);
      workingNodes.push(['hbC','sdafs','hbB',null,null,null,{pos:[260,160]}]);
    });
    await wait(300);
    const b = nodes.get('hbB'), a = nodes.get('hbA'), c = nodes.get('hbC');
    const low = b.y + b.h, level = low + 60;
    applyEdit(()=>{
      setBendList('hbB','hbA', [[b.x + b.w/2 - 20, low + 40], [a.x + a.w/2, low + 40]]);
      setBendList('hbB','hbC', [[b.x + b.w/2 + 20, level], [c.x + c.w/2, level]]);
    });
    await wait(200);
    vs = 1.5; vx = 600; vy = 300; applyTransform();
    bendHoverTarget = null; showBendsFor('hbB','hbA');
    await wait(50);
    const hs = [...document.querySelectorAll('#bendLayer .bend-handle')];
    const h = hs.sort((p, q)=> mark(q).x - mark(p).x)[0];
    const m0 = mark(h);
    // The mark is on the line it moves.
    out.markOnLine = rt('hbB','hbA').some(q=> Math.abs(q.x - m0.x) < 0.6 && Math.abs(q.y - m0.y) < 0.6);
    const p0 = W(m0.x, m0.y);
    h.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p0.x, clientY:p0.y}));
    for(let s = 1; s <= 10; s++){
      const p = W(m0.x + 5, m0.y + (level - m0.y) * s / 10);
      window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:p.x, clientY:p.y, shiftKey:true}));
    }
    out.guided = document.querySelectorAll('#guideLayer .align-guide-line').length > 0;
    window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    await wait(100);
    const ys = rt('hbB','hbA').map(q=> q.y);
    out.landed = ys.some(y=> Math.abs(y - level) < 0.01);
    out.ys = ys.map(y=> +y.toFixed(2)); out.level = +level.toFixed(2);
    bendHoverTarget = null; drawBendHandles();

    /* A stretch pinned above an entry stays where it was put while the
       entry is carried up towards it, until the run-out reaches it. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['hbP','Пролл',null,null,null,null,{pos:[0,0]}]);
      workingNodes.push(['hbT','Гаягкягкч','hbP',null,null,null,{pos:[120,-20]}]);
    });
    const p = nodes.get('hbP');
    applyEdit(()=> setBendList('hbP','hbT', [[p.x + p.w/2, -12], [-15, -60]], ['top','top']));
    const tops = [];
    for(let y = -20; y >= -60; y -= 2){
      applyEdit(()=>{ const f = workingEntry('hbT'); const o = entryOpts(f.entry); o.pos = [120, y]; putEntry(f.index, f.entry, o); });
      tops.push(Math.min(...rt('hbP','hbT').map(q=> q.y)));
    }
    // Never further down than it was, and only ever pushed up.
    out.tops = tops.map(t=> +t.toFixed(1));
    out.neverDown = tops.every((t, i)=> t <= -60 + 0.01 && (!i || t <= tops[i-1] + 0.01));

    /* A stretch pulled a grid step off the automatic line is what the
       hand asked for: let go, the bends stay and the line stays where it
       was let go — the chart's own Пролл → Гаягкягкч, as the owner had it. */
    applyEdit(()=>{ workingNodes.length = 0; EDGE_STYLES.length = 0;
      workingNodes.push(['hb5','Пролл',null,null,null,null,{pos:[-142.71, 243.63]}]);
      workingNodes.push(['hb6','Гаягкягкч','hb5',null,null,null,{pos:[-72.14, 220.79], size:[54.13, 12.05]}]);
      EDGE_STYLES.push({from:'hb5', to:'hb6', routing:'orthogonal', dash:'solid', arrow:true,
                        bends:[[-100.7, 201.4]], fromSide:'top', toSide:'top', square:true});
    });
    await wait(200);
    {
      const ptsOf = ()=> rt('hb5','hb6').map(q=> ({x:q.x, y:q.y}));
      const xs = ptsOf().map(q=> q.x), ys = ptsOf().map(q=> q.y);
      const r = svg.getBoundingClientRect();
      vs = 2.5; vx = r.width/2 - (Math.min(...xs) + Math.max(...xs))/2*vs; vy = r.height/2 - (Math.min(...ys) + Math.max(...ys))/2*vs;
      applyTransform();
      bendHoverTarget = null; showBendsFor('hb5','hb6');
      const h = document.querySelector('#bendLayer .bend-handle');
      const m = mark(h), p0 = W(m.x, m.y);
      h.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, button:0, clientX:p0.x, clientY:p0.y}));
      for(let s = 1; s <= 6; s++){
        window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:p0.x - 77*s/6, clientY:p0.y - 50*s/6}));
      }
      const held = ptsOf();
      window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      await wait(50);
      out.letGoApart = +routeApart(held, ptsOf()).toFixed(2);
      out.bendsKept = bendListOf('hb5','hb6').length > 0;
      out.held = JSON.stringify(held.map(q=> [Math.round(q.x), Math.round(q.y)]));
      bendHoverTarget = null; drawBendHandles();
    }

    applyEdit(()=>{ workingNodes.length = 0; beforeNodes.forEach(x=> workingNodes.push(x));
                    EDGE_STYLES.length = 0; beforeStyles.forEach(x=> EDGE_STYLES.push(x)); });
    vs = keep.vs; vx = keep.vx; vy = keep.vy; applyTransform();
    await wait(300);
    return out;
  });
  check('a corner\'s mark is on the line it moves', hb.markOnLine);
  check('a stretch let go a step off the automatic line stays where it was let go',
        hb.bendsKept && hb.letGoApart < 0.6, JSON.stringify({apart: hb.letGoApart, kept: hb.bendsKept, held: hb.held}));
  check('a corner pulled onto a guide with the hand a little off to one side lands on it',
        hb.guided && hb.landed, JSON.stringify({ys: hb.ys, level: hb.level}));
  check('a pinned stretch does not drop towards an entry carried up to it', hb.neverDown, JSON.stringify(hb.tops));
  });
