const DASH_PATTERNS = { solid: null, dashed: '7 5', dotted: '1.5 4', dashdot: '9 4 1.5 4', double: null };

/* A "double" connector is one line with a gutter down its middle — the same
   shape `text-decoration-style: double` draws under a word, which is why it
   is offered here: the connector styles and the text underline styles are
   meant to be the same vocabulary.

   SVG has no double stroke, so it is drawn as two: the connector at extra
   width in its own paint, and a narrower stroke of the paper colour laid
   over it, which leaves two rails with a gap between them. The overlay is
   given the SAME classes and the same data-from/data-to as the line it
   splits, so the tag filter, the selection dimming and the highlight treat
   the pair as one connector and never light one rail without the other.
   Its own paint attribute is dropped — .edge.dbl-inner names the paper
   colour in the stylesheet, which is what lets a double line follow the
   page's theme instead of being frozen to whatever white it was born on. */
function isDoubleDash(style){ return !!style && style.dash === 'double'; }
function edgePath(attrs, style, layer){
  const target = layer || edgeLayer;
  if(!isDoubleDash(style)) return el('path', attrs, target);
  const cls = attrs.class || 'edge';
  const outer = el('path', Object.assign({}, attrs, {class: cls + ' dbl-outer'}), target);
  const inner = Object.assign({}, attrs, {class: cls + ' dbl-inner'});
  delete inner.stroke;
  delete inner['stroke-dasharray'];
  delete inner['stroke-dashoffset'];
  el('path', inner, target);
  return outer;
}

/* Which way a curve's heads point: along the curve's last arrowhead's
   length, not along the route under it. A clamped spline is square to its
   entry only AT the entry and leans a little a head's length back, so a
   head set square met the line at a slant and left a notch beside it. The
   head is laid on the chord the line would have drawn there, and the two
   meet without a step. */
function curveHeads(pts, headIn, headOut){
  const c = curveThrough(pts, CURVE_STEP, {start: !!headIn, end: headOut !== false});
  if(c.length < 2) return null;
  const cut = cutAlong(c, ARROW_TRIM, ARROW_TRIM);
  const deg = (a, b)=> Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  return {out: deg(cut[cut.length - 1], c[c.length - 1]), in: deg(cut[0], c[0])};
}
/* How far short of its port a headless end stops: half the border, when
   the border it meets is see-through and is its only ring. */
function bareEndCut(style, port, id){
  if(style.sinusoid || style.routing === 'curve') return 0;
  const n = nodes.get(id);
  if(!n || (port && port.ring) || (n.colors && n.colors.length > 1) || isFreeShape(n.shape || '')) return 0;
  const ink = portRingColor(n, 0);
  if(typeof ink !== 'string' || rgbaOf(ink).a >= 1) return 0;
  return borderStyleOf(n) === 'double' ? DOUBLE_BAND_W / 2 : isWavyBorder(n) ? 0 : NODE_BORDER_W / 2;
}
function edgeHit(d, from, to){
  const hit = el('path', {class:'edge-hit', d, 'data-from':from, 'data-to':to}, edgeLayer);
  hit.addEventListener('click', ev=>{
    ev.stopPropagation();
    /* A connector stepped back behind a selection is not something to
       open. With an entry picked, everything unrelated to it is dimmed,
       and a click on one of those faded lines opened its settings on top
       of the selection — a panel for a thing the chart was saying was not
       the subject. The click means what a click on empty canvas means:
       let go of the selection. The connectors that stay lit belong to
       what is selected, and those still open. */
    if(edgeIsStepBack(from, to)){
      closeFreeMenu();
      closeBioCard();
      deselect();
      return;
    }
    /* Shift or Ctrl picks it beside the connectors already picked — see
       edgeSelection. Let go of, the panel moves to one still picked, or
       closes with the last of them. */
    if((ev.shiftKey || ev.ctrlKey || ev.metaKey) && !readOnlyView &&
       (edgeSelection.size || edgePopover.classList.contains('open'))){
      edgeSelectionToggle(from, to);
      const k = calloutEdgeKey(from, to);
      if(edgeSelection.has(k)) openEdgeStylePopover(from, to, ev);
      else if(edgeSelection.size){
        const next = [...edgeSelection.values()].pop();
        if(edgeSelection.size === 1) edgeSelection.clear();
        openEdgeStylePopover(next.from, next.to, ev);
      } else closeEdgePopover();
      paintEdgePick();
      return;
    }
    edgeSelection.clear();
    openEdgeStylePopover(from, to, ev);
  });
  hit.addEventListener('dblclick', ev=>{
    ev.stopPropagation();
    ev.preventDefault();
    if(edgeIsStepBack(from, to)) return;
    startEdgeNote(from, to, ev);
  });
  return hit;
}
function edgeIsStepBack(from, to){
  if(!selectedId && !multiSelection.size) return false;
  const sel = `[data-from="${CSS.escape(from)}"][data-to="${CSS.escape(to)}"]`;
  const parts = qEdges(`.edge${sel}`);
  if(!parts.length) return false;
  return parts.every(p=> p.classList.contains('dim'));
}

/* A connector is built from nothing on every redraw, so it is born at full
   strength and only learns a moment later — when the selection highlight
   is painted back on — that it is one of the dimmed ones. Opacity carries
   a fade, and that moment is long enough to see: press ⟲, or type a letter
   into a label, and every faded connector on the chart flared up and sank
   back. The fade belongs to a filter being CHANGED, not to a line being
   drawn for the first time, so it is held off for the frame the lines are
   new in. */
let edgeFadeFrame = 0;
function silenceEdgeFade(){
  edgeLayer.classList.add('no-fade');
  arrowLayer.classList.add('no-fade');
  if(edgeFadeFrame) cancelAnimationFrame(edgeFadeFrame);
  edgeFadeFrame = requestAnimationFrame(()=>{
    edgeFadeFrame = requestAnimationFrame(()=>{
      edgeFadeFrame = 0;
      edgeLayer.classList.remove('no-fade');
      arrowLayer.classList.remove('no-fade');
    });
  });
}
/* While an entry is carried, the connectors that have nothing to do with
   it keep the routes they had.
 *
   Routing is order-sensitive: each connector is scored against the ones
   drawn before it, and two of a connector's candidate routes are often
   within a hair of each other. Every frame of a drag re-routes everything,
   and the carried entry's own connectors, drawn earlier in the order,
   shift that hair — so a line on the far side of the chart, joined to
   nothing that moved, flicked between its two routes for as long as the
   hand was moving. A connector is held when neither of its entries is
   being carried, its ports are where they were, its look is unchanged
   and its held route does not now run through a carried entry; anything
   else is routed afresh. The drop redraws everything from nothing. */
let dragRouteHold = null;   // {memo: Map, moving: Set} while a drag draws
function heldRoute(e, a, b, style, rec){
  const hold = dragRouteHold;
  if(!hold || !rec || !rec.p1 || !rec.p2) return null;
  const inFrom = hold.moving.has(e.from), inTo = hold.moving.has(e.to);
  if(inFrom && inTo) return carriedRoute(e, a, b, style, rec, hold);
  if(inFrom || inTo) return null;
  const key = edgePairKey(e.from, e.to);
  const sig = [rec.p1.x, rec.p1.y, rec.p2.x, rec.p2.y, rec.lane || 0]
                .map(v=> (+v).toFixed(2)).join(',') + '|' + JSON.stringify(style);
  const kept = hold.memo.get(key);
  if(kept && kept.sig === sig && !kept.pts.some((q, i)=>{
       const r = kept.pts[i+1];
       return r && [...hold.moving].some(id=>{
         const m = nodes.get(id);
         return m && segHitsBox(q.x, q.y, r.x, r.y, m.x, m.y, m.x + m.w, m.y + m.h);
       });
     })){
    if(kept.registered) registerRoutedSegments(kept.pts);
    return kept.result;
  }
  const before = routedSegments.length;
  const result = routeEdge(a, b, style, rec);
  hold.memo.set(key, {sig, result, pts: result.pts, registered: routedSegments.length > before});
  return result;
}
/* …and a connector with BOTH its entries carried is carried with them.
 *
 * Its two ends move by the same step, so the route it had is still its
 * route, moved by that step — and routing it again, against every other
 * line on the chart, is by far the dearest thing a drag does: with a
 * hundred and fifty entries picked up together the drag was re-routing a
 * hundred and fifty connectors per frame, at a quarter of a second a
 * frame. It is moved instead, as long as both ports moved by one and the
 * same step and nothing about its look but its carried bends has changed;
 * otherwise it is routed afresh. The drop redraws everything from nothing,
 * so whatever a moved route steps over is settled there. */
function carriedRoute(e, a, b, style, rec, hold){
  const key = edgePairKey(e.from, e.to) + '|carried';
  const look = JSON.stringify(Object.assign({}, style, {bends: undefined}));
  const kept = hold.memo.get(key);
  if(kept && kept.look === look && (rec.lane || 0) === kept.lane){
    const dx = rec.p1.x - kept.p1.x, dy = rec.p1.y - kept.p1.y;
    if(Math.abs(rec.p2.x - kept.p2.x - dx) < 0.01 && Math.abs(rec.p2.y - kept.p2.y - dy) < 0.01){
      const pts = kept.pts.map(q=> ({x: q.x + dx, y: q.y + dy}));
      if(kept.registered) registerRoutedSegments(pts);
      const d = style.sinusoid ? wavyPath(pts, 0, 0, false, edgeCornerR(style)) : roundedPath(pts, edgeCornerR(style));
      return {d, angleDeg: kept.result.angleDeg, pts};
    }
  }
  const before = routedSegments.length;
  const result = routeEdge(a, b, style, rec);
  hold.memo.set(key, {look, lane: rec.lane || 0, p1: {x: rec.p1.x, y: rec.p1.y}, p2: {x: rec.p2.x, y: rec.p2.y},
                      result, pts: result.pts.map(q=> ({x: q.x, y: q.y})), registered: routedSegments.length > before});
  return result;
}
/* A connector drawn as it was keeps the drawing it had.
 *
 * Every pass draws every connector, and every one it draws is new to the
 * browser, which has to style it before the next paint — and an entry's
 * drawing was already kept this way (drawOrKeep), so after an edit that
 * changed one entry the connectors were most of what was new. So each
 * connector is still routed and drawn, everything about it worked out as
 * before; at the end of the pass, once the hops are cut into the lines,
 * what it drew is compared, as markup, with what it drew last time, and
 * where nothing differs the new drawing is dropped before the browser has
 * looked at it and the old one stays.
 *
 * A connector's drawing is everything it puts in the three layers while
 * it is drawn — line, heads, caps, note, callout leaders, the path it is
 * clicked by — and an amalgam's is its whole group. Its gradients and
 * clips are in edgeDefs, which is drawn afresh every pass and holds the
 * same ids for the same drawing, so a kept line points at the one this
 * pass made for it. Whatever has touched an old drawing since it was
 * drawn — a class put on it by picking or dimming is put back first —
 * makes it drawn afresh. A listener on a kept drawing was made by the
 * pass before; the markup it is kept by carries the route its listeners
 * hold, so they hold the same one. */
var drawnEdges = new Map();        // key -> {sig, pieces, attrs}
const EDGE_LAYERS = ()=> [edgeLayer, arrowLayer, leaderHitLayer];
function edgeDrawingSig(pieces){
  const layers = EDGE_LAYERS();
  return pieces.map(p=> layers.indexOf(p.parentNode) + ':' + p.outerHTML).join('\u0002');
}
/* Whether anything has touched a drawing since it was drawn is asked of
   the browser, which writes down every change to the three layers: the
   markup of every old drawing read a second time to find out cost as much
   as the layout keeping it saves. Only a class or style on a drawing's own
   outer element is let off, because those are put back before it is
   compared. */
const touchedEdgeDrawings = new Set();
function noteEdgeMutations(records){
  const layers = EDGE_LAYERS();
  records.forEach(r=>{
    let t = r.target;
    if(layers.includes(t)) return;
    while(t && t.parentNode && !layers.includes(t.parentNode)) t = t.parentNode;
    if(!t || !t.parentNode) return;
    if(r.type === 'attributes' && t === r.target && (r.attributeName === 'class' || r.attributeName === 'style')) return;
    touchedEdgeDrawings.add(t);
  });
}
const edgeMutations = new MutationObserver(noteEdgeMutations);
let edgeDrawingsWatched = false;
/* Not while a pass draws: what it appends is new, and what it does to
   the drawings it keeps is put back before they are compared. */
function watchEdgeDrawings(on){
  edgeDrawingsWatched = on;
  if(!on){ noteEdgeMutations(edgeMutations.takeRecords()); edgeMutations.disconnect(); return; }
  EDGE_LAYERS().forEach(L=> edgeMutations.observe(L, {subtree: true, childList: true, attributes: true, characterData: true}));
}
watchEdgeDrawings(true);
function beginEdgeDrawings(){
  /* A mark after what the last pass drew, which nothing this pass can
     take away from under it. */
  /* A pass that never finished left its layers unwatched since: nothing
     it or the one before drew can be vouched for. */
  if(!edgeDrawingsWatched) drawnEdges = new Map();
  watchEdgeDrawings(false);
  return {kept: drawnEdges, owners: [], seen: new Map(),
          start: EDGE_LAYERS().map(L=> L.appendChild(document.createComment('pass')))};
}
function edgeDrawing(pass, key, draw){
  const layers = EDGE_LAYERS();
  const marks = layers.map(L=> L.lastChild);
  draw();
  const pieces = [];
  layers.forEach((L, i)=>{
    for(let e = marks[i] ? marks[i].nextSibling : L.firstChild; e; e = e.nextSibling) pieces.push(e);
  });
  if(!pieces.length) return;
  // Two connectors between the same two entries are told apart by order.
  const n = pass.seen.get(key) || 0;
  pass.seen.set(key, n + 1);
  pass.owners.push({key: n ? key + '\u0001' + n : key, pieces});
}
function keepEdgeDrawings(pass){
  const layers = EDGE_LAYERS();
  const swap = new Map();          // new element -> the old one kept for it
  drawnEdges = new Map();
  pass.owners.forEach(o=>{
    const old = pass.kept.get(o.key);
    const intact = old && old.pieces.length === o.pieces.length &&
      old.pieces.every(p=> p.isConnected && !touchedEdgeDrawings.has(p));
    if(intact) old.pieces.forEach((p, i)=> ['class', 'style'].forEach((a, k)=>{
      const v = old.attrs[i][k];
      if(v === null){ if(p.hasAttribute(a)) p.removeAttribute(a); }
      else if(p.getAttribute(a) !== v) p.setAttribute(a, v);
    }));
    const sig = edgeDrawingSig(o.pieces);
    if(intact && old.sig === sig){
      o.pieces.forEach((p, i)=> swap.set(p, old.pieces[i]));
      drawnEdges.set(o.key, old);
      return;
    }
    drawnEdges.set(o.key, {sig, pieces: o.pieces,
      attrs: o.pieces.map(p=> [p.getAttribute('class'), p.getAttribute('style')])});
  });
  /* The hops hold the lines they were cut into, to take a hop out again
     when what it crosses is hidden (hopsFollowVisibility). */
  hoppedLines.forEach(rec=>{
    if(swap.has(rec.line.el)) rec.line.el = swap.get(rec.line.el);
    if(rec.line.inner && swap.has(rec.line.inner)) rec.line.inner = swap.get(rec.line.inner);
  });
  /* Each layer becomes what this pass drew, in the order it drew it, with
     a kept drawing standing where its new one stood. What the last pass
     drew and nobody keeps goes; the new drawings were appended after the
     old ones, so it is they that move, before the browser has laid them
     out, and a kept one moves only if the order of the connectors did. */
  layers.forEach((L, i)=>{
    const want = [];
    for(let e = pass.start[i].nextSibling; e; e = e.nextSibling) want.push(swap.get(e) || e);
    const keep = new Set(want);
    for(let e = L.firstChild; e;){ const next = e.nextSibling; if(!keep.has(e)) L.removeChild(e); e = next; }
    let cur = L.firstChild;
    want.forEach(p=>{ if(p === cur) cur = cur.nextSibling; else L.insertBefore(p, cur); });
  });
  // What this pass did to its own drawings is what they are now.
  touchedEdgeDrawings.clear();
  watchEdgeDrawings(true);
}
function redrawEdges(){
  /* The connectors this pass draws without the bends they were given;
     read by the bend handles and by dropIgnoredBends. */
  redrawEdges.ignored = new Set();
  silenceEdgeFade();
  /* What the last pass drew stays where it is until this one has drawn
     the same connectors again and compared (see keepEdgeDrawings). */
  const pass = beginEdgeDrawings();
  // Every gradient/marker made below is re-created fresh each call, so the
  // group holding them is cleared first — otherwise every live-preview
  // edit (routing/color/etc. change while the popover is open) would leak
  // another orphaned <linearGradient>/<marker> into the defs forever.
  /* …and they are counted from nought, so a connector drawn as it was
     names the gradient it named before, and can keep its drawing. */
  while(edgeDefs.firstChild) edgeDefs.removeChild(edgeDefs.firstChild);
  edgeGradSeq = 0;
  // The clips live in edgeDefs, so the cache goes with them.
  outsideClips.clear();
  ringCapClips.clear();

  // Routing is order-sensitive: each connector avoids the ones already
  // drawn (see scorePath), so the record of what's been drawn has to start
  // empty on every redraw or a live preview would steer around ghosts.
  resetRoutedSegments();
  // Entries have just been laid out or moved; the obstacle set is stale.
  invalidateObstacles();
  beginRoutePass();
  let ports = resolvePorts(structEdges);
  const hopLines = [];

  /* Amalgamation. An amalgam reality is one made OF other realities, and
     its connectors are drawn to say so: where several lineages arrive at
     the same edge of an amalgam entry, they stop short of it and line up
     into a single bar — one continuous line divided into a stretch of each
     parent's own colour, laid end to end and never overlapping — and a
     single arrow carrying all those colours as a gradient runs from the
     middle of that bar into the entry. Two arrows meeting the same edge of
     an ordinary entry stay two arrows; merging only happens where the
     entry says these lineages combine into one thing (see mergeOf). */
  const amalgamGroups = new Map();   // "to|side|ring" -> [edge, ...]
  const merged = new Set();
  amalgamMemberKeys.clear();
  structEdges.forEach(e=>{
    const b = nodes.get(e.to);
    if(!b || !isMergeNode(b) || !mergeMembersOf(b).includes(e.from)) return;
    const rec = ports.get(e);
    if(!rec || !rec.p2) return;
    /* Grouped by the entry and the border ring, NOT by which side each
       lineage happens to arrive on. Sides are chosen per connector from
       where its source sits, so dragging an amalgam far enough sideways
       used to put one lineage on the top edge and another on the left —
       two different keys, no group, and the merged bar silently came
       apart into ordinary connectors halfway through a drag. An amalgam
       is one bar into one port by definition; the side is settled once
       for the whole group, in drawAmalgam. */
    const key = e.to + '|' + (rec.toRing||0);
    if(!amalgamGroups.has(key)) amalgamGroups.set(key, []);
    amalgamGroups.get(key).push(e);
  });
  amalgamGroups.forEach(list=>{
    if(list.length <= 1) return;
    list.forEach(e=>{ merged.add(e); amalgamMemberKeys.add(edgePairKey(e.from, e.to)); });
  });

  /* Ports, a second time, now that the merges have had their say.
   *
   * Which side of its own entry a lineage leaves by is decided by where
   * the bar hangs, and that answer only exists once the group is known.
   * The first pass could not know it, so a side carrying both a merged
   * lineage and an ordinary connector spaced them as if each were alone —
   * the merged one taking the middle, the other one placed beside a
   * neighbour it could not see. Handing the decision back and resolving
   * again puts every connector on that side into one row. */
  const sideOverrides = new Map();
  amalgamGroups.forEach(list=>{
    if(list.length <= 1) return;
    const geo = amalgamGeometry(list, ports);
    if(!geo) return;
    list.forEach(e=>{
      const a = nodes.get(e.from);
      if(!a) return;
      sideOverrides.set(e, {fromSide: amalgamFromSide(a, geo, edgeStyleFor(e.from, e.to)),
                            toSide: geo.side});
    });
  });
  if(sideOverrides.size) ports = resolvePorts(structEdges, sideOverrides);

  structEdges.forEach(e=> edgeDrawing(pass, 'e\u0001' + e.from + '\u0001' + e.to, ()=>{
    if(merged.has(e)) return;
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if(!a||!b) return;
    const style = edgeStyleFor(e.from, e.to);
    const { d, angleDeg, pts, ignored } = heldRoute(e, a, b, style, ports.get(e)) ||
                                 routeEdge(a,b,style,ports.get(e));
    if(ignored) redrawEdges.ignored.add(calloutEdgeKey(e.from, e.to));
    const dash = DASH_PATTERNS[style.dash];
    const grad = style.gradient;
    /* The colour a connector takes when it was not given one: the border
       ring it LEAVES from. A connector is drawn out of a border, and that
       border is what says which lineage it carries — which is already how
       an amalgam's members are coloured, so an ordinary connector taking
       the colour of the entry it happens to point AT made the two read as
       different kinds of line on the same chart. */
    const edgeColor = style.colorFixed ? style.color
      : (portRingColor(a, style.fromRing) || style.color || e.color);
    // One gradient serves the line and both heads, so the colour runs
    // through the whole connector without a seam at the tips.
    const paint = grad ? makeEdgeGradient(grad, pts) : edgeColor;
    // Arrowheads point in the connector's overall (skeleton-path)
    // direction, never the local tangent of its rendered (possibly wavy)
    // curve.
    const headOut = style.arrow !== false, headIn = !!style.arrowIn;
    /* The drawn line stops where its arrowheads begin — see trimForHeads.
       A wavy line is not shortened but told where its heads are, so its
       ripple is laid out on the full geometry and stays put; see wavyPath. */
    const rec = ports.get(e) || {};
    const teeIn = headIn && style.teeIn, teeOut = headOut && style.teeOut;
    /* An end with no head stops at the border's OUTER edge when the border
       is see-through (the owner's screenshot 7 of 24.11). It used to run on
       to the middle of the border, where the border drawn over it is
       painted on the line instead of on the page: a see-through colour
       laid on its own colour came out as a dark spot across the border's
       outer half. An opaque border hides that stretch, so it is left as it
       was; and a wave or a curve, whose shape is laid out from its ends,
       is left as it was too. */
    const bareIn = !headIn ? bareEndCut(style, rec.p1, e.from) : 0;
    const bareOut = !headOut ? bareEndCut(style, rec.p2, e.to) : 0;
    const cutIn = !headIn ? bareIn : endCutFor(teeIn, style.openIn, rec.p1, e.from);
    const cutOut = !headOut ? bareOut : endCutFor(teeOut, style.openOut, rec.p2, e.to);
    const drawPts = style.sinusoid ? pts
      : trimForHeads(pts, headIn || bareIn > 0, headOut || bareOut > 0, rec.p1, rec.p2, cutIn, cutOut);
    const drawD = style.sinusoid ? wavyPath(pts, cutIn, cutOut, false, edgeCornerR(style))
      : drawPts === pts ? d
      /* A curve is cut where its heads begin by measuring along the CURVE,
         not by shortening the route under it — see curveHeads. */
      : style.routing === 'curve' ? polylinePath(cutAlong(curveThrough(pts, CURVE_STEP, {start: cutIn > 0, end: cutOut > 0}), cutIn, cutOut))
      : style.routing === 'straight'
        ? `M${drawPts[0].x},${drawPts[0].y} L${drawPts[drawPts.length-1].x},${drawPts[drawPts.length-1].y}`
        : roundedPath(drawPts, edgeCornerR(style));
    const bent = style.routing === 'curve' ? curveHeads(pts, headIn, headOut) : null;
    const attrs = {class:'edge struct', d: drawD, stroke: paint, 'data-from':e.from,'data-to':e.to};
    if(dash){
      attrs['stroke-dasharray'] = dash;
      /* A dash pattern is measured from the path's start, so a line that
         gave up its first few pixels to an arrowhead had its whole pattern
         slide along by that much. Offsetting the pattern by the same
         amount puts every dash back where it was: turning a head on now
         changes only where the line begins, never its rhythm. */
      if(cutIn) attrs['stroke-dashoffset'] = cutIn.toFixed(2);
    }
    const drawnLine = edgePath(attrs, style, edgeLayer);
    /* A candidate to hop over the lines it crosses: a line drawn along its
       route, not a curve, whose straight stretches are what a hop is cut
       into. A ripple hops too, and is handed its own points, which are
       laid flat either side of a hop. See drawHops. */
    const wave = style.sinusoid ? wavyPoints(pts, cutIn, cutOut, false, edgeCornerR(style)) : null;
    if(style.routing !== 'curve' && edgeCornerR(style) < CURVE_CORNER_R && drawPts.length > 1 && (wave || !style.sinusoid))
      hopLines.push({from: e.from, to: e.to, style, paint, dash, el: drawnLine, wave,
                     pts: style.routing === 'straight' && !wave ? [drawPts[0], drawPts[drawPts.length - 1]] : drawPts,
                     inner: isDoubleDash(style) ? drawnLine.nextElementSibling : null,
                     cornerR: style.routing === 'straight' ? 0 : edgeCornerR(style)});
    const last = pts[pts.length-1], first = pts[0];
    /* A connector pulled from an inner border ring ends INSIDE the outer
       rings, which are drawn over the connector layer — so its last few
       pixels were hidden and it looked like it stopped at the outer border
       instead of reaching the ring it belongs to. An arrowhead happened to
       cover that gap; a plain line had nothing to cover it with. These
       short caps redraw exactly that buried stretch above the entry, so a
       connector visibly meets its own ring whether or not it has a head. */
    /* Capped from the PORT records, not from the routed points. The router
       returns plain {x,y} for its path, so the side and ring the cap needs
       to know about were lost on the way — which is why a cap only ever
       appeared when the route happened to hand its endpoints back
       untouched. */
    const dbl = isDoubleDash(style);
    /* The PORT records, not the drawn endpoints. The two differ on a
       rippled border — the drawn end is carried under the fill — and it is
       the border the cap has to start from. */
    /* The DRAWN path, not the geometry it was cut from.
     *
       A connector carrying an arrowhead gives up its last few pixels to
       that head — `drawD` is the line as it actually appears, `d` is the
       full route before the head was allowed for. The cap was handed the
       full one, so above the rings it redrew the stretch the head is
       standing on: a headless line poking out from under every arrow on
       every entry with more than one border. It is handed what the reader
       sees, and redraws exactly that. */
    drawRingCap(rec.p1 || {x:first.x, y:first.y}, paint, dash, e.from, e.to, dbl, drawD);
    drawRingCap(rec.p2 || {x:last.x, y:last.y}, paint, dash, e.from, e.to, dbl, drawD);
    const tipOut = rec.p2 ? portTip(Object.assign({}, rec.p2, {x:last.x, y:last.y})) : last;
    const tipIn  = rec.p1 ? portTip(Object.assign({}, rec.p1, {x:first.x, y:first.y})) : first;
    /* A head is cut to the entry's outline only where it is drawn ABOVE
       the entry — an inner ring's. Under the entry the fill and the border
       do that job themselves, which is the whole point of putting it
       there. */
    const clipHead = (port)=> (arrowLayerFor(port && port.ring, port) === arrowLayer
                               && port && port.wavy);
    /* Which layer a head goes to is the PORT's ring, as it is for the cut
       above. The routed point carries the ring too, but not on every
       route: a held or carried one (a group being dragged) has points
       without it, and a head on an outer ring then jumped above the
       entries for as long as the drag lasted. */
    /* A T stands off the border, so it never reaches the entry's fill or
       its ripple: it goes on the layer above the entries, uncut. */
    if(teeOut) drawTeeHead(arrowLayer, tipOut.x, tipOut.y, bent ? bent.out : angleDeg, paint, e.from, e.to,
                           teeBack(rec.p2, e.to));
    else if(headOut) drawArrowHead(arrowLayerFor((rec.p2 || last).ring, rec.p2), tipOut.x, tipOut.y,
                              bent ? bent.out : angleDeg, paint, e.from, e.to,
                              clipHead(rec.p2) ? e.to : null,
                              rec.p2 ? rec.p2.ring : 0, style.openOut);
    if(teeIn) drawTeeHead(arrowLayer, tipIn.x, tipIn.y, bent ? bent.in : startAngleDeg(pts), paint, e.from, e.to,
                          teeBack(rec.p1, e.from));
    else if(headIn) drawArrowHead(arrowLayerFor((rec.p1 || first).ring, rec.p1), tipIn.x, tipIn.y,
                             bent ? bent.in : startAngleDeg(pts), paint, e.from, e.to,
                             clipHead(rec.p1) ? e.from : null,
                             rec.p1 ? rec.p1.ring : 0, style.openIn);
    /* Asked unconditionally: whether there is anything to draw is one
       question with one answer, and drawEdgeNote is where it lives — an
       empty note is still drawn while it is being started. */
    /* A note and a callout's dot sit on the line as it is DRAWN. A curve
       is drawn through its route rather than along it, so placed on the
       route they stood off in the air beside the curve, as far off as the
       curve swung away from the corners (the owner's report, 22.10). The
       curve is the one the line and its hit path are made from, uncut by
       the heads, so a fraction along it means the same thing to the note,
       to a dot being dragged and to a click picking a point. */
    const onLine = style.routing === 'curve' && !style.sinusoid
      ? curveThrough(pts, CURVE_STEP, {start: cutIn > 0, end: cutOut > 0}) : pts;
    drawEdgeNote(style.note, onLine, style.notePos, e.from, e.to, style.noteAt, paint, style.noteBg);
    // Every callout hanging off this connector, now that its route is known.
    drawCalloutLeaders(e.from, e.to, onLine, paint, pts);
    edgeHit(d, e.from, e.to);
  }));

  amalgamGroups.forEach((list, key)=>{
    if(list.length > 1) edgeDrawing(pass, 'a\u0001' + key, ()=> drawAmalgam(list, ports));
  });
  // Every line is down, so every crossing is known.
  /* The chart can do without them: the button beside the guides turns
     them off for everyone who reads it (SETTINGS.hops). */
  drawHops(SETTINGS.hops === false ? [] : hopLines);
  syncHopsToggle();
  endRoutePass();
  keepEdgeDrawings(pass);
  flushPendingCallouts();
  // The bend handles stand on the route that has just been drawn.
  drawBendHandles();
}
/* Any converted callout whose connector was never drawn.
 *
 * A chart can carry a style for a pair of entries that are no longer joined
 * — deleting a connector leaves its settings behind — and a leader note on
 * such a style became a callout pointing at a route that is never computed.
 * Left in the map it would sit at the origin for ever. It is placed beside
 * whichever of its two named entries can be found instead, and stops being
 * pending; the card is then an ordinary loose comment, which is exactly
 * what it now is. */
function flushPendingCallouts(){
  if(!pendingCallouts.size) return;
  let moved = false;
  [...pendingCallouts.entries()].forEach(([id, want])=>{
    pendingCallouts.delete(id);
    const n = nodes.get(id);
    const near = nodes.get(want.from) || nodes.get(want.to);
    const found = workingEntry(id);
    if(!n || !found) return;
    const cx = near ? near.x + near.w/2 : 0;
    const cy = near ? near.y + near.h + 60 : 0;
    const opts = entryOpts(found.entry);
    opts.pos = [Math.round(cx - n.w/2), Math.round(cy)];
    delete opts.leader;
    putEntry(found.index, found.entry, opts);
    moved = true;
  });
  if(moved) requestAnimationFrame(()=> rebuildChart());
}

/* AMALGAM_GAP is the closest the bar is ever allowed to sit to the entry;
   AMALGAM_LEAD is the clearance it keeps below the nearest parent, which is
   what it actually hangs from. Anchoring the bar to the parents rather than
   to the entry is what lets the merged arrow behave like a real connector:
   drag the amalgam away and the arrow lengthens, drag it closer and the
   arrow shortens, while the bar stays put where the lineages meet.

   Both are kept small so that the bar stays anchored to the parents over as
   much of the chart as possible: the clearance floor only takes over when
   the entry has been dragged right up under them, and until then moving the
   entry changes nothing but the length of the merged arrow. */

/* ---------------------------------------------------------------------
   Hops: where two connectors cross, one goes over the other in a little
   arch, as a drawing in Visio does, so it is plain which line goes where.

   Not at every place two strokes meet — only where it says something:

   - Only a real crossing: each line goes on through the other, at a fair
     angle. Lines that touch, run along one another, or meet at a slant
     shallower than HOP_MIN_ANGLE are left alone; an arch over a line it
     barely leaves would only blur the two.
   - Never at a bend, an end or a head: the crossing has to stand clear of
     the corner's rounding and of both lines' ends by the arch's width, so
     an arch never sits on a turn, on a port or under an arrowhead.
   - The level line goes over the upright one (Visio's own rule), so every
     arch on a chart faces the same way and none has to be read twice. A
     line that cannot hop — a curve, a slanted straight line — is
     crossed, never crossing; where neither of the two can, nothing is
     drawn. A ripple hops as a straight line does, laid flat for half a
     wave either side, so the arch rises from the line and not from
     half-way up a crest.
   - Crossings closer together than an arch and a breath share one, wider
     arch rather than a run of bumps.
   - A crossed line that is hidden by its tags takes its arches with it
     (hopsFollowVisibility), so nothing hops over a line that is not
     there.

   The arch is part of the line's own path: the line runs up to the hop,
   over it and on, as one stroke — so it dims, lights and hides with its
   line, and a double line arches as two rails. It was a hole cut in the line by a mask
   and an arch laid over the hole, and the two never quite met — the
   arch's foot ended square across the line's middle, so a notch was left
   beside each foot, a double line's rails stopped short of the arch's,
   and where the two did overlap their soft edges were painted twice. One
   path has none of that, and its dashes run on over the hop unbroken.
   The path without its hops is kept beside it (hoppedLines), so a hop
   over a line its tags hide can be taken back out without a redraw.
   ------------------------------------------------------------------ */
const HOP_R = 4.5, HOP_R_DOUBLE = 6;
const HOP_MIN_ANGLE = 35;          // degrees between the two lines
let hoppedLines = [];
function hopSegments(line){
  const out = [];
  let at = 0;
  for(let i = 1; i < line.pts.length; i++){
    const a = line.pts[i-1], b = line.pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if(len >= 0.5) out.push({a, b, len, at, i, first: i === 1, last: i === line.pts.length - 1});
    at += len;
  }
  return out;
}
function segCross(a, b, c, d){
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if(Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if(t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return {t, u, x: a.x + rx * t, y: a.y + ry * t};
}
function drawHops(lines){
  hoppedLines = [];
  if(!lines.length) return;
  const own = new Set(lines.map(l=> calloutEdgeKey(l.from, l.to)));
  /* What can be crossed: every line on the chart as drawn, the merges'
     lineages and arrows as well as the ordinary ones. */
  const crossed = [];
  drawnRoutes.forEach((r, key)=>{
    const L = r.line || r.pts;
    if(!L || L.length < 2) return;
    let run = 0, total = 0;
    for(let i = 1; i < L.length; i++) total += Math.hypot(L[i].x - L[i-1].x, L[i].y - L[i-1].y);
    for(let i = 1; i < L.length; i++){
      const a = L[i-1], b = L[i], len = Math.hypot(b.x - a.x, b.y - a.y);
      if(len >= 0.5) crossed.push({key, from: r.from, to: r.to, a, b, len, at: run, total});
      run += len;
    }
  });
  // Filed by band, as the router files its segments, so a line asks only what is near it.
  const BAND = 160, bands = new Map();
  const bandsOf = (a, b)=>{
    const out = [];
    for(let x = Math.floor(Math.min(a.x, b.x) / BAND); x <= Math.floor(Math.max(a.x, b.x) / BAND); x++)
      for(let y = Math.floor(Math.min(a.y, b.y) / BAND); y <= Math.floor(Math.max(a.y, b.y) / BAND); y++) out.push(x + ',' + y);
    return out;
  };
  crossed.forEach(c=> bandsOf(c.a, c.b).forEach(k=>{ if(!bands.has(k)) bands.set(k, []); bands.get(k).push(c); }));
  const cosMin = Math.cos((90 - HOP_MIN_ANGLE) * Math.PI / 180);
  lines.forEach(line=>{
    const key = calloutEdgeKey(line.from, line.to);
    const r = isDoubleDash(line.style) ? HOP_R_DOUBLE : HOP_R;
    const hops = [];
    hopSegments(line).forEach(seg=>{
      const level = Math.abs(seg.b.y - seg.a.y) < 0.01, upright = Math.abs(seg.b.x - seg.a.x) < 0.01;
      if(!level && !upright) return;
      // Clear of the turn at either end, and of the line's own ends.
      const clearA = seg.first ? (line.style.arrowIn ? ARROW_LEN : 0) + 1 : line.cornerR;
      const clearB = seg.last ? (line.style.arrow ? ARROW_LEN : 0) + 1 : line.cornerR;
      const keepA = clearA + r + 1, keepB = clearB + r + 1;
      if(seg.len <= keepA + keepB) return;
      const seen = new Set(), here = [];
      bandsOf(seg.a, seg.b).forEach(k=> (bands.get(k) || []).forEach(c=>{
        if(seen.has(c) || c.key === key) return;
        seen.add(c);
        const x = segCross(seg.a, seg.b, c.a, c.b);
        if(!x) return;
        const along = x.t * seg.len;
        if(along < keepA || seg.len - along < keepB) return;
        // At a fair angle: |sin| between the two at least that of HOP_MIN_ANGLE.
        const cos = Math.abs(((seg.b.x - seg.a.x) * (c.b.x - c.a.x) + (seg.b.y - seg.a.y) * (c.b.y - c.a.y)) / (seg.len * c.len));
        if(cos > cosMin) return;
        // Clear of the crossed line's ends and heads too.
        const onC = c.at + x.u * c.len;
        if(onC < ARROW_LEN + r || c.total - onC < ARROW_LEN + r) return;
        /* Who goes over. Two lines that could both hop: the level one.
           An upright line hops only over one that cannot. */
        if(upright){
          const other = own.has(c.key) && lines.find(l=> calloutEdgeKey(l.from, l.to) === c.key);
          const otherLevel = Math.abs(c.b.y - c.a.y) < 0.01;
          if(other && otherLevel) return;
          if(!other && Math.abs(c.b.y - c.a.y) < Math.abs(c.b.x - c.a.x)) return;
        }
        here.push({s: along, x: x.x, y: x.y, over: c});
      }));
      if(!here.length) return;
      // Crossings an arch apart share one.
      here.sort((p, q)=> p.s - q.s);
      let group = [here[0]];
      const flush = ()=> hops.push({seg, level, clearA, clearB, from: group[0], to: group[group.length - 1], over: group.map(g=> g.over)});
      for(let i = 1; i < here.length; i++){
        if(here[i].s - group[group.length - 1].s < 2 * r + 3) group.push(here[i]);
        else { flush(); group = [here[i]]; }
      }
      flush();
    });
    if(hops.length) seatHops(line, hops, r);
  });
}
/* Works out each hop's stretch of path and puts them into the line's own.
   A hop is written in the direction the line runs, and bulges up for a
   level line and right for an upright one whichever way that is. */
function seatHops(line, hops, r){
  const f = (v)=> `${+v.x.toFixed(3)},${+v.y.toFixed(3)}`;
  const K = 0.5523;                  // a quarter of an ellipse, as a cubic
  /* A ripple is laid flat as it comes to a hop, the way it is as it comes
     to an arrowhead: faded over half a wave and held flat a breath before
     the arch, so the arch stands on the line and not half-way up a crest. */
  const FADE = EDGE_WAVE_LEN / 2, HOLD = 2.5;
  const list = [];
  hops.forEach(h=>{
    const seg = h.seg;
    const ux = (seg.b.x - seg.a.x) / seg.len, uy = (seg.b.y - seg.a.y) / seg.len;
    const nx = h.level ? 0 : 1, ny = h.level ? -1 : 0;
    const at = (s, up)=> ({x: seg.a.x + ux * s + nx * (up || 0), y: seg.a.y + uy * s + ny * (up || 0)});
    const a = Math.min(h.from.s, h.to.s) - r, b = Math.max(h.from.s, h.to.s) + r;
    const m = (a + b) / 2, rx = (b - a) / 2;
    const cmds = ` L${f(at(a))} C${f(at(a, r * K))} ${f(at(m - rx * K, r))} ${f(at(m, r))}`
               + ` C${f(at(m + rx * K, r))} ${f(at(b, r * K))} ${f(at(b))}`;
    let onLeg = null;
    if(line.wave){
      // The fade has to fit on the leg, or it would end at a corner.
      if(a - FADE - HOLD < h.clearA || b + FADE + HOLD > seg.len - h.clearB) return;
      onLeg = [];
      line.wave.forEach((p, n)=>{
        const rx2 = p.bx - seg.a.x, ry2 = p.by - seg.a.y;
        const along = rx2 * ux + ry2 * uy;
        if(Math.abs(rx2 * -uy + ry2 * ux) > 0.5 || along < -0.01 || along > seg.len + 0.01) return;
        if(along > a - FADE - HOLD - 0.01 && along < b + FADE + HOLD + 0.01) onLeg.push({n, along});
      });
      if(!onLeg.some(q=> q.along < a) || !onLeg.some(q=> q.along > b)) return;
    }
    const prev = list.length && list[list.length - 1];
    // Two hops whose fades would meet on a ripple: the first keeps its place.
    if(onLeg && prev && prev.onLeg && prev.leg === seg.i && prev.b + FADE + HOLD > a - FADE - HOLD) return;
    list.push({leg: seg.i, s: a, a, b, cmds, onLeg,
               overFrom: h.over.map(o=> o.from).join('\u0001'), overTo: h.over.map(o=> o.to).join('\u0001')});
  });
  if(!list.length) return;
  list.sort((p, q)=> p.leg - q.leg || p.s - q.s);
  const plain = line.el.getAttribute('d');
  const build = (shown)=>{
    if(!shown.length) return plain;
    if(line.wave){
      const pts = line.wave.map(p=> Object.assign({}, p));
      let d = '', from = 0;
      shown.forEach(h=>{
        let last = -1, next = -1;
        h.onLeg.forEach(q=>{
          const dist = q.along < h.a ? h.a - q.along : q.along > h.b ? q.along - h.b : 0;
          const k = Math.max(0, Math.min(1, (dist - HOLD) / FADE)), p = pts[q.n];
          p.x = p.bx + (p.x - p.bx) * k; p.y = p.by + (p.y - p.by) * k;
          if(q.along < h.a) last = Math.max(last, q.n);
          else if(q.along > h.b && next < 0) next = q.n;
        });
        const piece = pts.slice(from, last + 1);
        d += from ? smoothPath(piece).replace(/^M/, ' L') : smoothPath(piece);
        d += h.cmds;
        from = next;
      });
      return d + smoothPath(pts.slice(from)).replace(/^M/, ' L');
    }
    const cut = (i)=> shown.filter(h=> h.leg === i).map(h=> h.cmds).join('');
    if(line.style.routing === 'straight')
      return `M${f(line.pts[0])}${cut(1)} L${f(line.pts[line.pts.length - 1])}`;
    return roundedPath(line.pts, line.cornerR, cut);
  };
  const rec = {line, list, build, shown: null};
  hoppedLines.push(rec);
  showHops(rec, list);
}
function showHops(rec, shown){
  const key = shown.map(h=> rec.list.indexOf(h)).join(',');
  if(rec.shown === key) return;
  rec.shown = key;
  const d = rec.build(shown);
  rec.line.el.setAttribute('d', d);
  if(rec.line.inner) rec.line.inner.setAttribute('d', d);
  /* What the hops are over, for whoever asks the line (the suite does). */
  rec.line.el.dataset.hops = shown.length;
  rec.line.el.dataset.hopsOver = shown.map(h=> h.overTo).join('\u0002');
}
function syncHopsToggle(){
  const b = document.getElementById('hopsToggle');
  const on = SETTINGS.hops === false ? 'false' : 'true';
  if(b && b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
}
/* A hop over a line its tags have hidden is a hop over nothing: it is
   taken out, and the line runs straight through again. */
function hopsFollowVisibility(){
  const hidden = (froms, tos)=>{
    const f = (froms || '').split('\u0001'), t = (tos || '').split('\u0001');
    return f.every((x, i)=>{
      const a = nodes.get(x), b = nodes.get(t[i]);
      return (a && nodeHidden(a)) || (b && nodeHidden(b));
    });
  };
  hoppedLines.forEach(rec=> showHops(rec, rec.list.filter(h=> !hidden(h.overFrom, h.overTo))));
}
