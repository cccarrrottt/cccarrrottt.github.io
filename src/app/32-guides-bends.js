/* ---------------------------------------------------------------------
   Smart guides.

   The grid keeps a chart tidy against ITSELF; it says nothing about
   whether the entry in your hand lines up with the one beside it. Two
   boxes of different heights have their centres at whatever offset their
   sizes give them, and no amount of snapped dragging will ever bring those
   centres together — the offset is not a whole number of grid steps.

   So while an entry is being carried, its edges and its centre are
   compared against the edges and centres of every other entry on the
   chart. Come within a few pixels of an alignment and the drag settles
   onto it, and a thin line is drawn through everything that shares it, so
   what the entry has lined up WITH is visible rather than inferred.

   Distances are measured in screen pixels and converted, so the pull feels
   the same however far the chart is zoomed. Ctrl — which already means
   "off the grid" — turns them off too: one modifier for "place this
   exactly where I am putting it".
   ------------------------------------------------------------------ */
const GUIDE_SNAP_PX = 6;      // how close counts as aligned, on screen
const GUIDE_OVERHANG = 12;    // how far a guide runs past the boxes it joins
const GUIDE_DOT_R = 3.2;      // the mark on a guide that means a PLACE, not a line
/* The handles that bend a connector by hand. Above the drawing, because
   they are things to take hold of, and below the guides, which are only
   ever drawn over the top of whatever they are lining up. */
const bendLayer = el('g', {id:'bendLayer'}, viewport);

/* ---------------------------------------------------------------------
   Bending a connector by hand.

   The automatic router answers one question very well — how do I get from
   here to there without crossing anything — and cannot answer the other
   one at all: go THIS way, because this way says something. A line taken
   deliberately round the outside of a group, or brought down a corridor
   two other lines already use, is a statement about the chart; the
   shortest clear route is not.

   So a connector may be given points it has to pass through. They appear
   as handles as soon as the pointer is on the line, and stay while its
   panel is open — a filled mark on each bend it
   already has, and a hollow one in the middle of every straight run, which
   becomes a new bend the moment it is dragged. A plain drag steps by the
   ruled grid, Ctrl comes off it, and Shift lines the point up with what
   the OTHER connectors are doing: their runs and their own bends, which is
   the only thing a bend has any business being level with.

   Double-click a bend to take it out; the ✕ in the panel takes them all
   out at once.
   ------------------------------------------------------------------ */
const BEND_R = 4.2;               // the mark you take hold of
function bendListOf(from, to){
  const st = edgeStyleFor(from, to);
  return (st && Array.isArray(st.bends)) ? st.bends.map(b=> [b[0], b[1]]) : [];
}
/* `sides`, when given, is the pair of sides the route leaves and arrives
   by, written down with the points (see resolvePorts). A list emptied
   takes them with it: a connector with no corners of its own goes back to
   choosing its sides from the geometry, like any other. */
function setBendList(from, to, list, sides){
  const kept = edgeStyleFor(from, to);
  const has = !!(list && list.length);
  setEdgeStyleOverride(from, to, Object.assign({}, kept, {
    bends: has ? list : undefined,
    bendSides: !has ? undefined : (sides || kept.bendSides || undefined)
  }));
}
/* Every straight run of a drawn route, as {a, b} pairs — what the ghost
   handles sit in the middle of, and what another connector's bend lines
   itself up against. */
function routeRunsOf(pts){
  const runs = [];
  for(let i = 1; i < (pts || []).length; i++){
    const a = pts[i-1], b = pts[i];
    if(Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
    runs.push({a, b, vertical: Math.abs(b.x - a.x) < 0.5});
  }
  return runs;
}
/* The drawn line of one connector, as a polyline close enough to the
   stroke to stand a mark on.
 *
 * It was sampled with getPointAtLength, and in Chromium that call walks
 * the path from its start every time — so a few hundred samples of a
 * wavy line, which is hundreds of curve pieces, cost half a second, and
 * the handles are drawn again on every hover and every redraw of a drag.
 * Any rippled connector froze the page while the pointer was on it. The
 * path is read here instead, once, from the `d` this program wrote: its
 * own M, L and C, each cubic cut into a few chords. A path with anything
 * else in it is a path this did not expect, and gets nothing — the
 * caller falls back to the geometry the line was drawn over. */
function flattenPathD(d){
  const tok = String(d || '').match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  if(!tok) return null;
  const out = [];
  let i = 0, cmd = '', x = 0, y = 0;
  const num = ()=> +tok[i++];
  while(i < tok.length){
    if(/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if(cmd === 'M' || cmd === 'L'){
      x = num(); y = num();
      out.push({x, y});
      if(cmd === 'M') cmd = 'L';
    } else if(cmd === 'C'){
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num();
      for(let k = 1; k <= 6; k++){
        const t = k / 6, u = 1 - t;
        out.push({x: u*u*u*x + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
                  y: u*u*u*y + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3});
      }
      x = x3; y = y3;
    } else return null;
    if(!Number.isFinite(x) || !Number.isFinite(y)) return null;
  }
  return out.length > 1 ? out : null;
}
function drawnLineOf(from, to){
  const sel = `path.edge.struct[data-from="${CSS.escape(from)}"][data-to="${CSS.escape(to)}"]`;
  let best = null, len = 0;
  edgeLayer.querySelectorAll(sel).forEach(p=>{
    if(p.classList.contains('edge-cap') || p.classList.contains('dbl-inner')) return;
    const line = flattenPathD(p.getAttribute('d'));
    if(!line) return;
    let L = 0;
    for(let i = 1; i < line.length; i++) L += Math.hypot(line[i].x - line[i-1].x, line[i].y - line[i-1].y);
    if(L > len){ len = L; best = line; }
  });
  return best && len >= 1 ? best : null;
}
function drawBendHandles(){
  /* Everything this reaches for is declared further down the file than the
     first draw, so on the very first pass none of it exists yet — and a
     chart with no panel open has no handles to draw in any case. */
  let host = null, target = null, picked = null;
  try{
    host = bendLayer;
    paintEdgePick();
    if(readOnlyView) return;
    picked = edgePopover.classList.contains('open') && currentEdgeStyleTarget;
    target = picked || bendHoverTarget;
  }catch(e){ return; }
  while(host.firstChild) host.removeChild(host.firstChild);
  if(!target) return;
  drawBendMarks(host, target);
  /* The ends last, over the marks, and stepped clear of any that stand
     where they do (see drawEndGrips). */
  if(picked === target) drawEndGrips(host, target);
}
function drawBendMarks(host, target){
  /* A straight connector is the one line between its two ends: a point
     it had to pass through would make it something other than straight,
     and the router throws such points away for it (see handBends). So it
     offers none to take hold of. */
  if(edgeStyleFor(target.from, target.to).routing === 'straight') return;
  /* A lineage feeding a merge is not bent by hand — the merge decides
     where it runs, so a handle here would offer a point that the next
     redraw ignores. See the note in drawAmalgam. The merged arrow is: it
     is the merge's connector into its entry, and is routed as one (see
     drawMergedArrow). */
  if(isAmalgamMember(target.from, target.to)) return;
  const rec = drawnRoutes.get(calloutEdgeKey(target.from, target.to));
  if(!rec || !rec.pts || rec.pts.length < 2) return;
  const bends = bendListOf(target.from, target.to);
  const pts = rec.pts;

  /* A hollow mark in the middle of every ARM — every straight stretch of
     the route, however many points it happens to be drawn through. Drag
     it and the stretch moves sideways, whole, with the two stretches
     either side of it lengthening or shortening to keep up. Drawn first,
     so a corner sitting on one is the one you get. */
  const arms = routeArms(pts);
  /* Where a mark is DRAWN. A curve does not pass through the route it is
     drawn over — the route's corners are what pull it — so a mark put on
     the route stood off the line by as much as the curve cuts the corner,
     twenty units on a wide one. It is drawn on the curve, at the point
     nearest the place it stands for; what it takes hold of is still that
     place (the `at` handed to beginBendDrag), so dragging it moves the
     same stretch it always did. */
  /* And on the line as DRAWN, not on the curve it is drawn over: a wavy
     line swings to either side of that curve, and a rounded corner cuts
     inside the route's turn, so a mark put on either geometry stood a few
     units beside the stroke you can see. The drawn path is sampled for the
     one connector whose marks are up; the curve is the fallback for a line
     not drawn yet. */
  const curve = drawnLineOf(target.from, target.to)
    || (edgeStyleFor(target.from, target.to).routing === 'curve' ? curveThrough(pts, CURVE_STEP) : null);
  const onLine = (q)=>{
    if(!curve) return q;
    let best = q, d = Infinity;
    for(let i = 1; i < curve.length; i++){
      const a = curve[i-1], b = curve[i];
      const dx = b.x - a.x, dy = b.y - a.y, L = dx*dx + dy*dy;
      const t = L ? Math.max(0, Math.min(1, ((q.x - a.x)*dx + (q.y - a.y)*dy) / L)) : 0;
      const c = {x: a.x + dx*t, y: a.y + dy*t}, k = Math.hypot(c.x - q.x, c.y - q.y);
      if(k < d){ d = k; best = c; }
    }
    return best;
  };
  for(let k = 0; k + 1 < arms.length; k++){
    const a = arms[k], b = arms[k + 1];
    const mid = {x:(a.x + b.x)/2, y:(a.y + b.y)/2};
    if(bends.some(q=> Math.hypot(q[0]-mid.x, q[1]-mid.y) < BEND_R*2)) continue;
    const vertical = Math.abs(a.x - b.x) < 0.5;
    const g = el('g', {class:'bend-ghost ' + (vertical ? 'bend-ghost-v' : 'bend-ghost-h'),
                       'data-arm': k}, host);
    const m = onLine(mid);
    el('circle', {cx:m.x.toFixed(2), cy:m.y.toFixed(2), r:BEND_R + 4,
                  class:'bend-hit'}, g);
    el('circle', {cx:m.x.toFixed(2), cy:m.y.toFixed(2), r:BEND_R - 0.6,
                  class:'bend-mark bend-mark-new'}, g);
    el('title', {}, g).textContent = 'Drag to move this stretch of the connector';
    g.addEventListener('mousedown', ev=> beginBendDrag(ev, target, mid, -1, pts));
    g.addEventListener('click', ev=> ev.stopPropagation());
  }
  /* A corner's mark stands where the line turns, not where the corner was
     written down. The two part company by design — the corner nearest a
     port follows the port (levelWithPorts), and one a hair off the run-out
     is squared onto it (absorbBendOffsets) — and a mark left at the
     written place floated a few units off the line, as if the line had
     failed to reach it, and was taken hold of there. */
  const turns = arms.slice(1, -1);
  const drawnAt = (b)=>{
    let best = null, d = GRID + 2;
    turns.forEach(q=>{ const k = Math.hypot(q.x - b[0], q.y - b[1]); if(k <= d){ d = k; best = q; } });
    return best ? [best.x, best.y] : b;
  };
  /* Corners the router could not honour (see pathFromPorts) are taken out
     when the edit that broke them settles — but a chart can arrive with
     some, saved before that was so, and they stay until an edit reaches
     their connector. Their marks are drawn hollow and dashed, as corners set
     aside; a solid mark off the line read as a corner the line had failed
     to reach. */
  const parked = !!(redrawEdges.ignored && redrawEdges.ignored.has(calloutEdgeKey(target.from, target.to)));
  bends.forEach((b0, i)=>{
    const b = parked ? b0 : drawnAt(b0);
    const m = onLine({x:b[0], y:b[1]});
    const g = el('g', {class:'bend-handle' + (parked ? ' bend-parked' : ''), 'data-i':i}, host);
    el('circle', {cx:m.x.toFixed(2), cy:m.y.toFixed(2), r:BEND_R + 4, class:'bend-hit'}, g);
    el('circle', {cx:m.x.toFixed(2), cy:m.y.toFixed(2), r:BEND_R, class:'bend-mark'}, g);
    el('title', {}, g).textContent = parked
      ? 'The line cannot pass through this corner, so it is set aside and goes with the next change to this connector or its entries. Double-click to take it out now'
      : 'Drag to move this corner; Shift lines it up with the other connectors; double-click to take it out';
    g.addEventListener('mousedown', ev=> beginBendDrag(ev, target, {x:b[0], y:b[1]}, i, pts));
    g.addEventListener('click', ev=> ev.stopPropagation());
    g.addEventListener('dblclick', ev=>{
      ev.stopPropagation(); ev.preventDefault();
      if(readOnlyView) return;
      const list = bendListOf(target.from, target.to);
      list.splice(i, 1);
      applyEdit(()=>{ setBendList(target.from, target.to, list); });
    });
  });
}
/* The two ends of the picked connector, to be carried onto another port
   of the same entry (the owner's list of 29.10). Drawn as squares, not
   rounds: a round mark is a corner to bend, and an end is a different
   thing to take hold of. Only on a picked line — a line under the pointer
   on its way somewhere else would put a grip over a small entry's middle
   — and not on a merge's lines, whose ends the merge decides. */
function drawEndGrips(host, target){
  /* A merge's lines have one end each that is their entry's own: a
     lineage's where it leaves its parent, the merged arrow's where it
     comes into the entry. The other end is on the bar, and the merge
     decides it. */
  const member = isAmalgamMember(target.from, target.to);
  const rec = drawnRoutes.get(calloutEdgeKey(target.from, target.to));
  const line = drawnLineOf(target.from, target.to) || (rec && rec.pts);
  if(!line || line.length < 2) return;
  /* A corner set by hand can stand right by a port, and a grip drawn
     over its mark hid it (the owner's list of 30.10). So a grip that
     would cover a mark steps sideways along the entry's border, the way
     across its line, until it clears every one. */
  const marks = Array.from(host.querySelectorAll('.bend-mark')).map(c=> ({x: +c.getAttribute('cx'), y: +c.getAttribute('cy')}));
  const clear = 2 * BEND_R + 4;
  const placed = (q, next)=>{
    // A port's run-out is level or upright, so across it is the other axis.
    const v = Math.abs(next.x - q.x) > Math.abs(next.y - q.y) ? {x: 0, y: 1} : {x: 1, y: 0};
    for(const k of [0, 1, -1, 2, -2, 3, -3]){
      const c = {x: q.x + v.x * clear * k, y: q.y + v.y * clear * k};
      if(marks.every(m=> Math.hypot(m.x - c.x, m.y - c.y) >= clear)) return c;
    }
    return q;
  };
  // The way the line leaves an end, read a few units out where a rounded corner cannot tilt it.
  const outFrom = (i, di)=>{
    let j = i;
    while(j + di >= 0 && j + di < line.length && Math.hypot(line[j].x - line[i].x, line[j].y - line[i].y) < 4) j += di;
    return line[j];
  };
  [['from', line[0], outFrom(0, 1)], ['to', line[line.length - 1], outFrom(line.length - 1, -1)]].forEach(([end, q0, next])=>{
    const id = end === 'from' ? target.from : target.to;
    if(!id || !nodes.has(id) || (member && end === 'to')) return;
    const q = placed(q0, next);
    const g = el('g', {class:'bend-end', 'data-end': end}, host);
    el('circle', {cx:q.x.toFixed(2), cy:q.y.toFixed(2), r:BEND_R + 2, class:'bend-hit'}, g);
    el('rect', {x:(q.x - BEND_R + 0.6).toFixed(2), y:(q.y - BEND_R + 0.6).toFixed(2),
                width:(2 * BEND_R - 1.2).toFixed(2), height:(2 * BEND_R - 1.2).toFixed(2),
                class:'bend-end-mark'}, g);
    el('title', {}, g).textContent = 'Drag onto another port of this entry to move this end there';
    g.addEventListener('mousedown', ev=> beginPortMove(ev, target, end));
    g.addEventListener('click', ev=> ev.stopPropagation());
  });
}
/* Carrying one end of a connector to another port of its entry. The
   port is where the end is let go, read as a connector being drawn reads
   it (connectorDropTarget): a ring's handle if it is on one, else the
   nearest side. Anywhere else, the end stays where it was. */
var portMove = null;
function beginPortMove(ev, target, end){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation();
  ev.preventDefault();
  const id = end === 'from' ? target.from : target.to;
  nodeControlsOn(id);
  portMove = {from: target.from, to: target.to, end, id, hit: null};
  svg.classList.add('port-moving');
}
window.addEventListener('mousemove', ev=>{
  if(!portMove) return;
  const hit = connectorDropTarget(ev.clientX, ev.clientY);
  qNodes('.node.connect-target').forEach(g=> g.classList.remove('connect-target'));
  qNodes('.node-handle.drop-target').forEach(h=> h.classList.remove('drop-target'));
  portMove.hit = hit && hit.node.id === portMove.id ? hit : null;
  if(portMove.hit){
    portMove.hit.g.classList.add('connect-target');
    if(portMove.hit.handle) portMove.hit.handle.classList.add('drop-target');
  }
});
window.addEventListener('mouseup', ()=>{
  const st = portMove;
  if(!st) return;
  portMove = null;
  svg.classList.remove('port-moving');
  qNodes('.node.connect-target').forEach(g=> g.classList.remove('connect-target'));
  qNodes('.node-handle.drop-target').forEach(h=> h.classList.remove('drop-target'));
  if(!st.hit) return;
  movePortTo(st.from, st.to, st.end, st.hit.side, st.hit.ring);
});
function movePortTo(from, to, end, side, ring){
  if(!SIDES.includes(side)) return false;
  const kept = edgeStyleFor(from, to);
  const sideKey = end === 'from' ? 'fromSide' : 'toSide', ringKey = end === 'from' ? 'fromRing' : 'toRing';
  if(kept[sideKey] === side && (kept[ringKey] || 0) === (ring || 0)) return false;
  /* Corners pinned to the faces they were set from (bendSides) are
     pinned to this one now: the face was chosen by hand after them. */
  const pin = Array.isArray(kept.bendSides) && kept.bendSides.length === 2
    ? (end === 'from' ? [side, kept.bendSides[1]] : [kept.bendSides[0], side]) : kept.bendSides;
  applyEdit(()=>{
    setEdgeStyleOverride(from, to, Object.assign({}, kept, {[sideKey]: side, [ringKey]: ring || undefined,
                                                            bendSides: pin}));
  });
  return true;
}
/* The connector the pointer is on, whose handles show without its panel
   being open. They used to wait for a click, which meant finding out that
   a line could be bent only after opening its settings; now they come up
   as the line is reached, and go a moment after the pointer leaves both
   the line and them — long enough to cross the gap onto a handle. */
let bendHoverTarget = null;
let bendHoverTimer = null;
const BEND_HOVER_LINGER = 300;
function showBendsFor(from, to){
  clearTimeout(bendHoverTimer);
  if(bendHoverTarget && bendHoverTarget.from === from && bendHoverTarget.to === to) return;
  bendHoverTarget = {from, to};
  drawBendHandles();
}
function letBendsGo(){
  clearTimeout(bendHoverTimer);
  bendHoverTimer = setTimeout(()=>{
    // A handle in the hand is not let go of because the pointer outran it.
    if(bendDrag) return letBendsGo();
    bendHoverTarget = null;
    drawBendHandles();
  }, BEND_HOVER_LINGER);
}
{
  const leaves = (ev)=>{
    const to = ev.relatedTarget;
    if(to && to.closest && (to.closest('#bendLayer') || to.closest('.edge-hit'))) return;
    letBendsGo();
  };
  svg.addEventListener('mouseover', ev=>{
    if(readOnlyView || !ev.target.closest) return;
    const hit = ev.target.closest('.edge-hit');
    if(hit) showBendsFor(hit.dataset.from, hit.dataset.to);
    else if(ev.target.closest('#bendLayer')) clearTimeout(bendHoverTimer);
  });
  svg.addEventListener('mouseout', ev=>{
    if(ev.target.closest && (ev.target.closest('.edge-hit') || ev.target.closest('#bendLayer'))) leaves(ev);
  });
}
/* A connector whose panel is open is lit the way a selected entry is —
   and only it: nothing else on the chart steps back, because opening a
   line's settings is not a statement that the rest of the chart is beside
   the point, the way picking an entry is. Repainted with the handles,
   which are redrawn whenever the connectors are. */
function edgeIsPicked(from, to){
  const t = edgePopover.classList.contains('open') ? currentEdgeStyleTarget : null;
  return !!t && t.from === from && t.to === to;
}
function paintEdgePick(){
  const t = edgePopover.classList.contains('open') ? currentEdgeStyleTarget : null;
  qEdges('.edge-picked').forEach(p=> p.classList.remove('edge-picked'));
  if(!t) return;
  // Every connector picked with it — see edgeSelection.
  edgeGroupFor(t.from, t.to).forEach(({from, to})=>{
    const sel = `[data-from="${CSS.escape(from)}"][data-to="${CSS.escape(to)}"]`;
    // Its note too: the note is the connector's words.
    qEdges(`.edge${sel}:not(.dbl-inner):not(.amalgam-through), .edge-arrow${sel}, .edge-note${sel}`)
      .forEach(p=> p.classList.add('edge-picked'));
  });
}
/* What a dragged bend may line itself up with: the OTHER connectors.
 *
 * Not the entries — a bend has no edge of its own to match against a box's,
 * and lining one up with a node's left side says nothing. What it can
 * usefully be level with is what the other lines are doing: the corridor a
 * vertical run of somebody else's route already occupies, or the height a
 * neighbouring bend sits at. Two lines that nearly agree read as a
 * mistake; the same two exactly level read as a pair. */
function bendAlignments(skipKey){
  const xs = [], ys = [];
  drawnRoutes.forEach((rec, key)=>{
    if(key === skipKey || !rec || !rec.pts) return;
    routeRunsOf(rec.pts).forEach(run=>{
      if(run.vertical) xs.push(run.a.x);
      else ys.push(run.a.y);
    });
  });
  EDGE_STYLES.forEach(st=>{
    if(!st || !Array.isArray(st.bends)) return;
    if(calloutEdgeKey(st.from, st.to) === skipKey) return;
    st.bends.forEach(b=>{ xs.push(b[0]); ys.push(b[1]); });
  });
  return {xs, ys};
}
/* ---------------------------------------------------------------------
   Moving a route by its stretches and its corners.
 *
 * A bend used to be a POINT the line had to pass through, and the route
 * was built afresh through the points every time one moved: out of the
 * port, an L to the first point, an L to the next, an L into the far
 * port. That reads well for a point placed once, and it is the wrong
 * model for the thing a reader actually takes hold of. Pulling a stretch
 * of the line sideways, they expect THAT stretch to move and the rest to
 * stay; what they got was one new point in the middle of the stretch and
 * a route rebuilt round it — which way round each L went decided again
 * from scratch, the port flipped to another face of the entry the moment
 * the point crossed that entry's diagonal, and the whole line jumped.
 *
 * So the drawn route is the thing that is edited. When a stretch (an ARM)
 * is dragged, it moves sideways, whole, and its two neighbours lengthen or
 * shorten to keep up; a corner dragged is the two arms that meet at it,
 * each moved along its own axis. Every corner of the result is written
 * down, and so are the sides the route leaves and arrives by. The router
 * then draws exactly that, because between consecutive corners that share
 * a line there is nothing for it to decide. Nothing is rebuilt and so
 * nothing can jump — and a shape the router cannot draw as given is not
 * taken: the stretch stops at the last place it could be, rather than the
 * line leaping somewhere else.
   ------------------------------------------------------------------ */
// The drawn route with every straight stretch made one arm: repeats and
// points in the middle of a stretch dropped, the two ends kept.
function routeArms(pts){
  const p = [];
  (pts || []).forEach(q=>{
    const last = p[p.length - 1];
    if(last && Math.abs(last.x - q.x) < 0.5 && Math.abs(last.y - q.y) < 0.5) return;
    p.push({x:q.x, y:q.y});
  });
  for(let i = 1; i < p.length - 1; i++){
    const a = p[i-1], b = p[i], c = p[i+1];
    const vert = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const horz = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if(vert || horz){ p.splice(i, 1); i--; }
  }
  return p;
}
function armIsVertical(a, b){ return Math.abs(a.x - b.x) < 0.5; }
/* The arms with arm k moved sideways to `v`. An end of the arm that is a
   port cannot move: the line comes out of it, runs out square and steps
   across to the moved arm (the step's first point is marked `jog`, and is
   not written down — see bendsFromArms). */
function shiftArm(P, k, v, p1, p2){
  const n = P.length;
  const key = armIsVertical(P[k], P[k + 1]) ? 'x' : 'y';
  const Q = P.map(q=> Object.assign({}, q));
  const atStart = k === 0, atEnd = k + 1 === n - 1;
  /* The merged arrow's start stands on its bar, and the bar is a line, not
     a point: the stretch out of it moved sideways takes its foot along the
     bar with it, as the stretch would be drawn (see drawAmalgam, which
     stands the foot under the first corner). A step out of the foot would
     be a shape the drawing never makes, and the move was refused. */
  const slide = atStart && !!(p1 && p1.slides) && armIsVertical(P[0], P[1]) === sideIsVertical(p1.side);
  if(slide) Q[0][key] = v;
  if(!atStart) Q[k][key] = v;
  if(!atEnd) Q[k + 1][key] = v;
  const jogAt = (port)=>{
    const nrm = SIDE_NORMAL[port.side] || {x:0, y:0};
    const L = runOutFloor(port);
    const j = {x: port.x + nrm.x * L, y: port.y + nrm.y * L, jog: true};
    const w = {x: j.x, y: j.y};
    w[key] = v;
    return [j, w];
  };
  /* An end's own stretch, moved sideways, steps out of its port: straight
     out over the run-out, across to where it was taken, and on. But the
     run-out is usually the WHOLE of that stretch — the next one turns
     away the moment the run-out ends — so the step had nothing to land
     on: it came out collinear with the next stretch, was written down as
     no bend at all, and the stretch near either end could not be moved.
     There the next stretch is pushed out by one more step of the grid, so
     the step has a straight piece of its own to land on. Only where that
     next stretch is free to move: when its far end is the other port,
     there is nothing to push. */
  const roomFor = (port, near, far)=>{
    const nrm = SIDE_NORMAL[port.side];
    if(!nrm || far <= 0 || far >= Q.length - 1) return;
    const along = key === 'x' ? 'y' : 'x';
    const L = runOutFloor(port);
    const depth = (Q[near][along] - port[along]) * nrm[along];
    if(depth >= L + GRID - 0.5) return;
    if(Math.abs(Q[near][along] - Q[far][along]) > 0.5) return;
    const lvl = port[along] + nrm[along] * (L + GRID);
    Q[near][along] = lvl;
    Q[far][along] = lvl;
  };
  if(atStart && !slide && Math.abs(v - P[0][key]) > 0.5) roomFor(p1, 1, 2);
  if(atEnd && Math.abs(v - P[n - 1][key]) > 0.5) roomFor(p2, n - 2, n - 3);
  if(atEnd){ const [j, w] = jogAt(p2); Q.splice(n - 1, 0, w, j); }
  if(atStart && !slide){ const [j, w] = jogAt(p1); Q.splice(1, 0, j, w); }
  return Q;
}
/* A stair a pixel or two high, taken out of a set of arms.
 *
 * The step a stretch makes out of its port stands at the run-out (see
 * shiftArm), and a corner dropped a hair to one side of that level left
 * a stretch the width of the difference between the two: a nick, drawn
 * and written down. Where two stretches running the same way are joined
 * by one shorter than a grid step, the one that is free to move — neither
 * end a port nor the start of a step out of one — is put on the other's
 * line, and the nick is gone. A stretch that turns back (out and back
 * again) is a shape, not a nick, and is left alone. */
function squareNicks(Q){
  let P = Q.map(q=> Object.assign({}, q));
  const fixedPt = (i)=> i === 0 || i === P.length - 1 || !!P[i].jog;
  for(let guard = 0; guard < 8; guard++){
    let done = true;
    for(let i = 1; i + 2 < P.length; i++){
      const a = P[i], b = P[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if(L < 0.01 || L > BEND_ABSORB) continue;
      const before = P[i - 1], after = P[i + 2];
      const vNick = armIsVertical(a, b);
      if(armIsVertical(before, a) === vNick || armIsVertical(b, after) === vNick) continue;
      const key = vNick ? 'x' : 'y';
      if((a[key] - before[key]) * (after[key] - b[key]) <= 0) continue;
      const across = vNick ? 'y' : 'x';
      if(i - 1 >= 1 && !fixedPt(i - 1) && !fixedPt(i)){ P[i - 1][across] = b[across]; a[across] = b[across]; }
      else if(!fixedPt(i + 1) && !fixedPt(i + 2)){ b[across] = a[across]; after[across] = a[across]; }
      else continue;
      P = P.filter((q, k)=> k === 0 || Math.hypot(q.x - P[k - 1].x, q.y - P[k - 1].y) > 0.01 || q.jog);
      done = false;
      break;
    }
    if(done) break;
  }
  return P;
}
function foldsBack(Q){
  for(let i = 1; i + 2 < Q.length; i++){
    const a = Q[i], b = Q[i + 1], before = Q[i - 1], after = Q[i + 2];
    if(Math.hypot(b.x - a.x, b.y - a.y) > BEND_ABSORB) continue;
    const v = armIsVertical(a, b) && Math.abs(b.y - a.y) > 0.01;
    const key = v ? 'x' : 'y';
    const d1 = a[key] - before[key], d2 = after[key] - b[key];
    if(Math.abs(d1) > 0.5 && Math.abs(d2) > 0.5 && d1 * d2 < 0) return true;
  }
  return false;
}
// What is written down for a set of arms: every corner, but the two ends
// and the start of a step out of a port.
function bendsFromArms(Q){
  const out = [];
  for(let i = 1; i < Q.length - 1; i++){
    const a = Q[i-1], b = Q[i], c = Q[i+1];
    if(b.jog) continue;
    const turns = armIsVertical(a, b) !== armIsVertical(b, c);
    if(turns) out.push([+b.x.toFixed(2), +b.y.toFixed(2)]);
  }
  return out;
}
/* How far apart two routes are as SHAPES — the furthest any point of
   either lies from the other. Two drawings of one line through different
   numbers of points come out at nothing; a line that has jumped comes out
   at however far it jumped. */
function routeApart(p, q){
  const dist = (pt, pts)=>{
    let best = Infinity;
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y, L = dx*dx + dy*dy;
      const t = L ? Math.max(0, Math.min(1, ((pt.x - a.x)*dx + (pt.y - a.y)*dy) / L)) : 0;
      best = Math.min(best, Math.hypot(a.x + t*dx - pt.x, a.y + t*dy - pt.y));
    }
    return best;
  };
  const dense = (pts)=>{
    const out = [];
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for(let k = 0; k <= n; k++) out.push({x: a.x + (b.x - a.x)*k/n, y: a.y + (b.y - a.y)*k/n});
    }
    return out;
  };
  if(!p || !q || p.length < 2 || q.length < 2) return Infinity;
  let worst = 0;
  dense(p).forEach(pt=>{ worst = Math.max(worst, dist(pt, q)); });
  dense(q).forEach(pt=>{ worst = Math.max(worst, dist(pt, p)); });
  return worst;
}
/* How far a drawn route may differ from the arms it was asked to follow
   and still be that route: the ends of a line are sunk into a rippled
   border by a pixel or three (see sinkEnds), and nothing else moves. */
const ARM_FOLLOW_TOL = 4;
let bendDrag = null;
function beginBendDrag(ev, target, at, index, pts){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation(); ev.preventDefault();
  const p = clientToWorld(ev.clientX, ev.clientY);
  const e = structEdges.find(x=> x.from === target.from && x.to === target.to);
  const ports = e ? resolvePorts(structEdges).get(e)
    : target.from === '' ? mergedArrowPorts.get(target.to) : null;
  if(!ports || !ports.p1 || !ports.p2) return;
  /* The arms of the line as it is drawn now, with its two ends put back on
     their ports — the drawing sinks them into a rippled border. */
  const P = routeArms(pts);
  if(P.length < 2) return;
  P[0] = {x: ports.p1.x, y: ports.p1.y};
  P[P.length - 1] = {x: ports.p2.x, y: ports.p2.y};
  /* What was taken hold of. A hollow mark is the arm it sits on; a corner
     is the two arms that meet at it — or, for a point that is not at a
     corner of the line any more, the arm it lies on. */
  const near = (q)=> Math.hypot(q.x - at.x, q.y - at.y);
  let corner = -1;
  if(index >= 0){
    for(let i = 1; i < P.length - 1; i++){ if(near(P[i]) < 2.5){ corner = i; break; } }
  }
  let arm = -1;
  if(corner < 0){
    let best = Infinity;
    for(let k = 0; k + 1 < P.length; k++){
      const a = P[k], b = P[k + 1];
      const d = armIsVertical(a, b)
        ? Math.abs(at.x - a.x) + Math.max(0, Math.min(a.y, b.y) - at.y, at.y - Math.max(a.y, b.y))
        : Math.abs(at.y - a.y) + Math.max(0, Math.min(a.x, b.x) - at.x, at.x - Math.max(a.x, b.x));
      if(d < best){ best = d; arm = k; }
    }
  }
  /* What moves is the corner, or the arm, by however far the hand moves —
     not to wherever the hand is. A handle left from an older chart can
     stand off the line it belongs to, and taking hold of it used to throw
     the stretch straight across to it. */
  let anchor;
  if(corner > 0) anchor = {x: P[corner].x, y: P[corner].y};
  else {
    const a = P[arm], b = P[arm + 1];
    anchor = armIsVertical(a, b)
      ? {x: a.x, y: Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), at.y))}
      : {x: Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), at.x)), y: a.y};
  }
  bendDrag = {
    target, moved: false, P, corner, arm,
    p1: ports.p1, p2: ports.p2,
    sides: [ports.p1.side, ports.p2.side],
    startX: ev.clientX, startY: ev.clientY,
    from: {x: p.x, y: p.y}, anchor,
    at: {x: anchor.x, y: anchor.y}
  };
  document.body.classList.add('bending');
}
window.addEventListener('mousemove', ev=>{
  const st = bendDrag;
  if(!st) return;
  if(!st.moved){
    if(Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) < DRAG_THRESHOLD) return;
    st.moved = true;
    // Before the first live change: see applyEdit's `before`.
    st.before = takeSnapshot();
    st.good = bendListOf(st.target.from, st.target.to);
    st.goodSides = edgeStyleFor(st.target.from, st.target.to).bendSides;
  }
  const p = clientToWorld(ev.clientX, ev.clientY);
  let x = st.anchor.x + (p.x - st.from.x), y = st.anchor.y + (p.y - st.from.y);
  const free = ev.ctrlKey || ev.metaKey;
  /* Which coordinates the hand is moving: an arm only sideways, a corner
     both ways. The other is held exactly where it was, so a stretch
     dragged a little crooked does not drift along itself. */
  let movesX = true, movesY = true;
  if(st.corner < 0){
    const vertical = armIsVertical(st.P[st.arm], st.P[st.arm + 1]);
    movesX = vertical; movesY = !vertical;
  }
  clearGuides();
  if(ev.shiftKey && !free){
    const key = calloutEdgeKey(st.target.from, st.target.to);
    const {xs, ys} = bendAlignments(key);
    const tol = GUIDE_SNAP_PX / (vs || 1);
    const near = (v, list)=>{
      let best = null;
      list.forEach(t=>{ const d = t - v;
        if(Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = {d, at:t}; });
      return best;
    };
    const gx = movesX && near(x, xs), gy = movesY && near(y, ys);
    /* An axis that finds no guide keeps the grid, as an entry's does. Left
       free it followed every wobble of the hand, and a corner pulled down
       onto a neighbour's level came a few units sideways with it. */
    if(!gx) x = snapToGrid(x);
    if(!gy) y = snapToGrid(y);
    if(gx){
      x = gx.at;
      el('line', {class:'align-guide align-guide-line', x1:x.toFixed(2), x2:x.toFixed(2),
                  y1:(y - 240).toFixed(2), y2:(y + 240).toFixed(2)}, guideLayer);
    }
    if(gy){
      y = gy.at;
      el('line', {class:'align-guide align-guide-line', y1:y.toFixed(2), y2:y.toFixed(2),
                  x1:(x - 240).toFixed(2), x2:(x + 240).toFixed(2)}, guideLayer);
    }
  } else if(!free){
    x = snapToGrid(x); y = snapToGrid(y);
  } else { x = Math.round(x); y = Math.round(y); }
  /* A stretch out of a port, moved less than a grid step off the port's
     own line, is drawn ON that line — the step would be squared away
     (absorbBendOffsets). So it is asked for there. Asked for where the hand
     was, the drawn line could not follow the shape, the whole move was
     refused as one the router cannot draw, and a corner pulled straight
     down onto a guide with the hand a few units off to one side stayed
     where it was, the guide drawn and the line nowhere near it. */
  const lastArm = st.P.length - 2;
  const hug = (k, port)=>{
    if(armIsVertical(st.P[k], st.P[k + 1])){ if(Math.abs(x - port.x) <= BEND_ABSORB) x = port.x; }
    else if(Math.abs(y - port.y) <= BEND_ABSORB) y = port.y;
  };
  if(st.corner > 0){
    if(st.corner === 1) hug(0, st.p1);
    if(st.corner === lastArm) hug(lastArm, st.p2);
  } else {
    if(st.arm === 0) hug(0, st.p1);
    if(st.arm === lastArm) hug(lastArm, st.p2);
  }
  /* …and the same for a stretch brought within a step of the line of the
     stretch two along from it, which runs the same way: between them is a
     stretch a pixel or two long, a nick in the line, and nobody drags a
     corner that small on purpose. Left as asked, it was written down and
     kept — a connector pulled down onto the level of its port ended with
     a two-pixel stair in front of the arrowhead (the bughunt of 24.10).
     Put ON that line, the two become one and the nick is not made. */
  const level = (k)=>{
    if(k < 0 || k > lastArm) return;
    const vertical = armIsVertical(st.P[k], st.P[k + 1]);
    [k - 2, k + 2].forEach(j=>{
      if(j < 0 || j > lastArm) return;
      const c = vertical ? st.P[j].x : st.P[j].y;
      if(vertical){ if(Math.abs(x - c) <= BEND_ABSORB) x = c; }
      else if(Math.abs(y - c) <= BEND_ABSORB) y = c;
    });
  };
  if(st.corner > 0){ level(st.corner - 1); level(st.corner); }
  else level(st.arm);
  if(!movesX) x = st.at.x;
  if(!movesY) y = st.at.y;
  if(x === st.at.x && y === st.at.y && st.tried) return;
  st.tried = true;
  st.at = {x, y};
  /* The arms as they would be. A corner is its two arms: the one after it
     moved first, so that a step put in at the far end does not shift the
     place of the one before. */
  let Q;
  if(st.corner > 0){
    const k = st.corner;
    const after = armIsVertical(st.P[k], st.P[k + 1]) ? x : y;
    const before = armIsVertical(st.P[k - 1], st.P[k]) ? x : y;
    Q = shiftArm(shiftArm(st.P, k, after, st.p1, st.p2), k - 1, before, st.p1, st.p2);
  } else {
    const v = armIsVertical(st.P[st.arm], st.P[st.arm + 1]) ? x : y;
    Q = shiftArm(st.P, st.arm, v, st.p1, st.p2);
  }
  Q = squareNicks(Q);
  /* A shape that folds back on itself a step away from where it came — out
     along a line and straight back along the next one over, a pixel or
     two from it — is not taken: it draws as a line laid on itself with a
     nick at the end, and the route matched it closely enough to be kept
     (the bughunt of 24.10). The line stays as it last was. */
  if(foldsBack(Q)) return;
  const list = bendsFromArms(Q);
  // Live, without a step of undo per frame: the drawn style is set, and
  // the drop below is what writes it down.
  setBendList(st.target.from, st.target.to, list, st.sides);
  redrawEdges();
  /* …and only if it is what was asked for. A shape the router cannot draw
     as given — a stretch pulled back past the run-out of its port, into
     the entry, or onto the line beside it — is not taken; the line stays
     as it last was, and the next movement of the hand may well be one it
     can follow. */
  const rec = drawnRoutes.get(calloutEdgeKey(st.target.from, st.target.to));
  if(!rec || routeApart(rec.pts, Q) > ARM_FOLLOW_TOL){
    setBendList(st.target.from, st.target.to, st.good, st.goodSides);
    redrawEdges();
  } else {
    st.good = list;
    st.goodSides = st.sides;
  }
  applyVisibility();
  if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
});
window.addEventListener('mouseup', ()=>{
  const st = bendDrag;
  bendDrag = null;
  if(!st) return;
  document.body.classList.remove('bending');
  clearGuides();
  if(!st.moved) return;
  /* The click that ends the drag would otherwise reach the connector under
     it and re-open the panel on top of what was just done. */
  suppressNodeClick = true;
  setTimeout(()=>{ suppressNodeClick = false; }, 0);
  applyEdit(()=>{
    pruneHandBends([st.target]);
  }, st.before);
  refreshSaveUI();
  drawBendHandles();
});
/* Bends that no longer say anything are taken out.
 *
 * A hand-set bend is a statement that the connector should NOT take the
 * route the router would give it. Once the entries have been moved back to
 * where that route and the bent one are the same line, the statement is
 * empty — but the points stayed in the list, and the next time either
 * entry moved the connector was dragged through them into a shape nobody
 * had asked for. So after anything that can make a bend redundant — a bend
 * let go, an entry let go — each affected connector is routed once without
 * its bends, and if that is the line already drawn, the bends go. Then the
 * ones the drawn route simply passes straight through go as well. */
/* "The same line", as a reader judges it rather than to the pixel.
 *
 * A bend dragged back to where the connector used to turn lands on the
 * ruled grid, and the corner it came from did not: the two routes have the
 * same shape and every corner within a step of the other, and that was
 * enough for them to count as different — so the bends stayed, and the
 * next move of either entry dragged the line through them. Same number of
 * corners, turning the same ways, each within BEND_SAME_TOL of its
 * counterpart, is the same line. */
/* …but within HALF a step, not a whole one. A corner put back on the grid
 * lands at most half a step from where it came from, and that is all this
 * has to forgive. A whole step forgave a deliberate one too: a stretch
 * pulled one grid step off the line the router would draw — a small step
 * into the port, a run a notch above the automatic one — counted as that
 * line, every bend was dropped as said already, and the line jumped back
 * the moment the hand let go. */
const BEND_SAME_TOL = GRID / 2 + 0.5;
function samePolyline(a, b, tol){
  const t = (typeof tol === 'number') ? tol : 0.6;
  const norm = (pts)=> tidyPoints((pts || []).map(q=> ({x:q.x, y:q.y})));
  const p = norm(a), q = norm(b);
  if(p.length !== q.length) return false;
  for(let i = 0; i < p.length; i++){
    if(Math.abs(p[i].x - q[i].x) > t || Math.abs(p[i].y - q[i].y) > t) return false;
  }
  return true;
}
/* What this connector would be drawn as with a DIFFERENT set of bends.
 *
 * Asked by putting the trial list in place and routing normally, and put
 * back before it returns. It has to be done that way round because a bend
 * decides more than a corner: where the automatic sides would send the
 * line away from a bend behind them, the sides follow the bend instead
 * (see resolvePorts). A trial that kept the real list and merely left the
 * bends out of the ROUTE would be answering about a connector that does
 * not exist — and its answer was sometimes the bent line itself, which is
 * the one answer that deletes a corner the moment it is placed. */
function routeWithBends(from, to, bends){
  const e = structEdges.find(x=> x.from === from && x.to === to);
  const a = nodes.get(from), b = nodes.get(to);
  if(!e || !a || !b) return null;
  const idx = EDGE_STYLES.findIndex(st=> st.from === from && st.to === to);
  const held = idx >= 0 ? EDGE_STYLES[idx] : null;
  let out = null;
  try{
    setBendList(from, to, bends);
    const ports = resolvePorts(structEdges);
    /* Routed against the OTHER connectors only. The record of what has
       been drawn still holds this connector's own route, and the router
       steers away from overlapping what is already there — so the trial
       dodged its own ghost and came out a different shape from the one it
       would really take. */
    const key = calloutEdgeKey(from, to);
    resetRoutedSegments();
    drawnRoutes.forEach((r, k)=>{ if(k !== key && r && r.pts) registerRoutedSegments(r.pts); });
    out = routeEdge(a, b, edgeStyleFor(from, to), ports.get(e));
  } finally {
    // Exactly as it was, record and all: a round trip through setBendList
    // would leave defaults written down that were implicit before.
    const now = EDGE_STYLES.findIndex(st=> st.from === from && st.to === to);
    if(held){ if(now >= 0) EDGE_STYLES[now] = held; else EDGE_STYLES.push(held); }
    else if(now >= 0) EDGE_STYLES.splice(now, 1);
  }
  return out;
}
/* Bends the line was drawn without are taken out — the owner's call: a
 * corner nobody can see the line take is not a corner worth keeping, and
 * one kept in case a later move made it good again read as a mark the line
 * had simply failed to reach. Done when an edit settles, never in the
 * middle of a drag, where the hand may yet carry the line back through
 * them; and inside that edit's own step of undo.
 *
 * Only on connectors the edit reached. `was` is what ignoredBendRoutes
 * said before it: a connector that was already drawn without its bends,
 * and is drawn along exactly the same line after, was not touched — and an
 * edit to one entry's name must not rewrite a connector across the chart,
 * which a Save would then send as a change nobody made. `only`, instead,
 * names the connectors outright. Answers whether anything was taken out,
 * and redraws if so. */
function ignoredBendRoutes(){
  const out = new Map();
  (redrawEdges.ignored || new Set()).forEach(k=>{
    // The line it is drawn along, and the bends it is given: either changing is the edit reaching it.
    const r = drawnRoutes.get(k);
    out.set(k, (r && r.pts ? JSON.stringify(r.pts.map(q=> [q.x, q.y])) : '') + '|' +
               (r ? JSON.stringify(bendListOf(r.from, r.to)) : ''));
  });
  return out;
}
function dropIgnoredBends(only, was){
  const ignored = redrawEdges.ignored;
  if(!ignored || !ignored.size) return false;
  try{ if(bendDrag) return false; }catch(e){ return false; }
  const now = was ? ignoredBendRoutes() : null;
  let changed = false;
  ignored.forEach(k=>{
    const e = structEdges.find(x=> calloutEdgeKey(x.from, x.to) === k);
    if(!e || (only && !only.has(k)) || !bendListOf(e.from, e.to).length) return;
    if(was && was.has(k) && was.get(k) === now.get(k)) return;
    setBendList(e.from, e.to, []);
    changed = true;
  });
  if(changed) rebuildChart();
  return changed;
}
function pruneHandBends(pairs){
  const seen = new Set();
  const todo = (pairs || []).filter(pr=>{
    const k = calloutEdgeKey(pr.from, pr.to);
    if(seen.has(k)) return false;
    seen.add(k);
    return bendListOf(pr.from, pr.to).length > 0 && !isMergePart(pr.from, pr.to);
  });
  if(!todo.length) return false;
  let changed = false;
  todo.forEach(pr=>{
    const rec = drawnRoutes.get(calloutEdgeKey(pr.from, pr.to));
    if(!rec || !rec.pts) return;
    const auto = routeWithBends(pr.from, pr.to, []);
    if(auto && samePolyline(auto.pts, rec.pts, BEND_SAME_TOL)){
      setBendList(pr.from, pr.to, []);
      changed = true;
      return;
    }
    const list = bendListOf(pr.from, pr.to);
    const kept = dropIdleBends(pr.from, pr.to, list);
    if(kept.length !== list.length){ setBendList(pr.from, pr.to, kept); changed = true; }
  });
  // The trial routes above were recorded as drawn; the next redraw starts
  // that record again from nothing, so nothing is steered by them.
  return changed;
}
/* A bend that bends nothing is taken out when it is let go.
 *
 * Dragging a hollow mark out of a run and dropping it back on that run
 * left a point the route passes STRAIGHT through: nothing drawn changed,
 * but the connector was now pinned there, stopped following its entries
 * the way an unbent one does, and carried a handle to catch on.
 *
 * "Does nothing" used to be read off the drawn line — a point the route
 * turns at is doing something, a point it runs straight through is not —
 * and that reading is wrong wherever a bend is what chose the SIDE the
 * connector leaves by. It is then pinning the route precisely by lying on
 * it: take it out and the line goes somewhere else entirely, while the
 * drawing says it was idle. So the question is asked of the route
 * instead. A bend is idle when the connector drawn WITHOUT it is the line
 * already on the page, and that is true of a mark dropped back on its own
 * run whether it turns anything or not. */
function dropIdleBends(from, to, list){
  if(!list.length) return list;
  const rec = drawnRoutes.get(calloutEdgeKey(from, to));
  const pts = rec && rec.pts;
  if(!pts || pts.length < 2) return list;
  let kept = list.slice();
  for(let i = kept.length - 1; i >= 0; i--){
    const trial = kept.slice();
    trial.splice(i, 1);
    const r = routeWithBends(from, to, trial);
    if(r && samePolyline(r.pts, pts)) kept = trial;
  }
  return kept;
}
const guideLayer = el('g', {id:'guideLayer', style:'pointer-events:none;'}, viewport);
function clearGuides(){
  while(guideLayer.firstChild) guideLayer.removeChild(guideLayer.firstChild);
}
/* The alignment the dragged group is closest to on one axis, if any.
   `mine` are the group's three interesting coordinates on that axis — near
   edge, centre, far edge — and every other entry offers the same three. */
/* Which of the alignments within reach to offer.
 *
 * `mine` and each `others.at` are three positions in the same order —
 * the near edge, the MIDDLE, the far edge — so index 1 on both sides is a
 * middle-to-middle alignment.
 *
 * Nearest alone is the wrong answer here, and two entries of different
 * heights are why. Their edges are close to each other in several places
 * at once, so an edge-to-edge alignment a pixel nearer than the middles
 * wins, and lining the two up by their middles — the alignment that makes
 * the connector between them run dead straight, and the one the reader is
 * almost always reaching for — is unreachable: it is always beaten by a
 * neighbouring edge. So each pairing gets a small handicap and the winner
 * is judged on the distance PLUS it: middle to middle first, then an edge
 * to the matching edge, then anything else. All three still have to be
 * within the snapping distance to be offered at all. */
function nearestAlignment(mine, others, tol){
  const BONUS = [ [0, 2.5, 3.5],
                  [2.5, -3.5, 2.5],
                  [3.5, 2.5, 0] ];
  let best = null, bestScore = Infinity;
  others.forEach(o=>{
    o.at.forEach((target, oi)=>{
      mine.forEach((m, mi)=>{
        const d = target - m;
        if(Math.abs(d) > tol) return;
        const score = Math.abs(d) + ((BONUS[mi] || [])[oi] || 0);
        // Whether this is the one alignment a reader is nearly always
        // after: the two entries' own middles, on top of each other.
        const mid = (mi === 1 && oi === 1);
        if(score < bestScore - 0.001){ bestScore = score; best = {d, at: target, with: [o], mid}; }
        else if(best && Math.abs(target - best.at) < 0.01 && best.with.indexOf(o) < 0){
          best.with.push(o);
        }
      });
    });
  });
  return best;
}
/* Lining up the CONNECTORS, not only the boxes.
 *
 * Two entries joined by a line that has to step sideways by four pixels is
 * the commonest untidy thing on a chart, and lining their BOXES up does
 * not fix it: what has to meet is the two ports, and a port sits at its
 * own share of the side it is on. Nor is one connector the whole of it —
 * a drop that lands a few pixels off the drop beside it reads as a
 * mistake, and there is nothing on the chart to line it up against.
 *
 * So two more offers, both measured off the routes as last drawn:
 *   - level the two ends of a connector one of whose entries is being
 *     carried, which is the offset that makes it straight;
 *   - put one of that connector's straight runs on the same line as some
 *     other connector's run of the same orientation, so the two read as
 *     one line rather than as two that nearly agree.
 */
function routeRuns(pts){
  const out = [];
  for(let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i+1];
    if(Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 4)
      out.push({axis:'x', v:a.x, lo:Math.min(a.y,b.y), hi:Math.max(a.y,b.y)});
    else if(Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 4)
      out.push({axis:'y', v:a.y, lo:Math.min(a.x,b.x), hi:Math.max(a.x,b.x)});
  }
  return out;
}
const RUN_NEIGHBOURHOOD = 120;   // how far apart two runs may be and still read as one line
/* `shift` is how far the carried entries have moved since the routes in
 * drawnRoutes were drawn. Those routes are a frame old — they are redrawn
 * once per frame and the pointer runs ahead of them — so a carried end
 * read straight off them is where the entry WAS. Measured from there, the
 * offer was applied to where the entry is now: the entry landed somewhere
 * else and the guide was drawn at a level nothing was aligned to. The
 * carried ends and runs are moved on by `shift` before anything is
 * compared. */
function connectorAlignments(moving, shift){
  const sx = (shift && shift.x) || 0, sy = (shift && shift.y) || 0;
  const best = {x:null, y:null};
  const take = (axis, d, a, b)=>{
    const cur = best[axis];
    if(!cur || Math.abs(d) < Math.abs(cur.d)) best[axis] = {d, a, b};
  };
  const mine = [], others = [];
  drawnRoutes.forEach(rec=>{
    const pts = rec && rec.pts;
    if(!pts || pts.length < 2) return;
    const aM = moving.has(rec.from), bM = moving.has(rec.to);
    const runs = routeRuns(pts);
    if(!aM && !bM){ runs.forEach(r=> others.push(r)); return; }
    /* A run of a connector with one end in the hand is only roughly where
       the drag has taken it — the far end has not moved — but the run
       nearest the carried end has, and that is the one worth lining up. */
    runs.forEach(r=> mine.push(r.axis === 'x'
      ? {axis:'x', v:r.v + sx, lo:r.lo + sy, hi:r.hi + sy}
      : {axis:'y', v:r.v + sy, lo:r.lo + sx, hi:r.hi + sx}));
    if(aM === bM) return;                    // both ends carried: nothing to meet
    const raw = aM ? pts[0] : pts[pts.length-1];
    const p = {x: raw.x + sx, y: raw.y + sy};
    const q = aM ? pts[pts.length-1] : pts[0];
    const lead = aM ? pts[1] : pts[pts.length-2];
    const sideways = Math.abs(lead.x - p.x) >= Math.abs(lead.y - p.y);
    if(sideways) take('y', q.y - p.y, p, q);
    else take('x', q.x - p.x, p, q);
  });
  mine.forEach(m=> others.forEach(o=>{
    if(m.axis !== o.axis) return;
    // Only where the two would actually lie alongside each other.
    if(Math.max(m.lo, o.lo) > Math.min(m.hi, o.hi) + RUN_NEIGHBOURHOOD) return;
    const a = m.axis === 'x' ? {x:m.v, y:(m.lo+m.hi)/2} : {x:(m.lo+m.hi)/2, y:m.v};
    const b = o.axis === 'x' ? {x:o.v, y:(o.lo+o.hi)/2} : {x:(o.lo+o.hi)/2, y:o.v};
    take(m.axis, o.v - m.v, a, b);
  }));
  return best;
}
/* And the places on a merge's bar — see barTargetsFor.
 *
 * The amalgam used to be offered the middle of its own bar and nothing
 * else, and a parent was offered nothing at all. Now whatever single entry
 * is in the hand and belongs to a bar is offered every place on it, and
 * all of them are marked while Shift is held, so the snap is aimed rather
 * than stumbled on. */
function barAlignment(st, offX, offY){
  let best = null;
  barTargetsFor(st).forEach(t=>{
    const m = st.members[0], n = m.node;
    const c = (t.bar.axis === 'x' ? m.originX + offX + n.w/2 : m.originY + offY + n.h/2) + t.portOff;
    t.places.forEach(pl=>{
      const d = pl.at - c;
      if(!best || Math.abs(d) < Math.abs(best.d)) best = {axis: t.bar.axis, d, at: pl.at, bar: t.bar,
                                                          place: pl, portOff: t.portOff};
    });
  });
  return best;
}
function paintBarPlaces(st){
  barTargetsFor(st).forEach(t=>{
    t.places.forEach(pl=>{
      const x = t.bar.axis === 'x' ? pl.at : t.bar.cross;
      const y = t.bar.axis === 'x' ? t.bar.cross : pl.at;
      el('circle', {class:`align-guide align-guide-dot bar-place bar-place-${pl.kind}`,
                    cx:x.toFixed(2), cy:y.toFixed(2),
                    r: pl.kind === 'mid' ? GUIDE_DOT_R + 1 : GUIDE_DOT_R - 0.6}, guideLayer);
    });
  });
}
/* `only`, when given, is the one axis the thing carried can move along
   (a merge's entry carried by its junction): the other axis offers
   nothing, since nothing could be lined up on it. */
function alignGuides(st, offX, offY, free, only){
  clearGuides();
  if(free || !st || !st.members || !st.members.length) return {x: offX, y: offY, hitX:false, hitY:false};
  const moving = new Set(st.members.map(m=> m.id));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  st.members.forEach(m=>{
    const nx = m.originX + offX, ny = m.originY + offY;
    x0 = Math.min(x0, nx);            y0 = Math.min(y0, ny);
    x1 = Math.max(x1, nx + m.node.w); y1 = Math.max(y1, ny + m.node.h);
  });
  if(!Number.isFinite(x0)) return {x: offX, y: offY, hitX:false, hitY:false};
  const tol = GUIDE_SNAP_PX / (vs || 1);
  const xs = [], ys = [];
  nodes.forEach(o=>{
    if(moving.has(o.id) || nodeHidden(o)) return;
    xs.push({node:o, at:[o.x, o.x + o.w/2, o.x + o.w]});
    ys.push({node:o, at:[o.y, o.y + o.h/2, o.y + o.h]});
  });
  let gx = nearestAlignment([x0, (x0+x1)/2, x1], xs, tol);
  let gy = nearestAlignment([y0, (y0+y1)/2, y1], ys, tol);
  /* The connectors' own offers, and the amalgam's bar, on the same terms
     as the boxes: within the same tolerance, and the nearest one wins. */
  const drawn = st.drawnOff || {x: 0, y: 0};
  const conn = connectorAlignments(moving, {x: offX - drawn.x, y: offY - drawn.y});
  const barA = barAlignment(st, offX, offY);
  paintBarPlaces(st);
  let px = null, py = null;                 // an extra offer, if it beats the box
  const offer = (cand, axis)=>{
    if(!cand || Math.abs(cand.d) > tol) return;
    const box = axis === 'x' ? gx : gy;
    const held = axis === 'x' ? px : py;
    /* Two entries lined up on their MIDDLES is not given up for a
       connector's offer that happens to be a pixel nearer.
     *
       Centring one box on another is the alignment a reader reaches for
       most, and it is the one the eye checks afterwards — so an offer that
       quietly replaces it with "the ports of some connector meet here
       instead" undoes the very thing the hand was doing. The connector
       offers still win over an edge-to-edge match, which is what they were
       added for. */
    if(box && box.mid) return;
    if(box && Math.abs(box.d) <= Math.abs(cand.d)) return;
    if(held && Math.abs(held.d) <= Math.abs(cand.d)) return;
    if(axis === 'x'){ gx = null; px = cand; } else { gy = null; py = cand; }
  };
  if(conn.x) offer({d: conn.x.d, at: conn.x.b.x, span:[conn.x.a, conn.x.b]}, 'x');
  if(conn.y) offer({d: conn.y.d, at: conn.y.b.y, span:[conn.y.a, conn.y.b]}, 'y');
  if(barA) offer({d: barA.d, at: barA.at, bar: barA.bar}, barA.axis);
  if(only === 'x'){ gy = null; py = null; }
  if(only === 'y'){ gx = null; px = null; }
  const outX = offX + (gx ? gx.d : (px ? px.d : 0));
  const outY = offY + (gy ? gy.d : (py ? py.d : 0));
  // Drawn against the boxes as they will be once the snap is applied.
  const bx0 = x0 + (outX - offX), bx1 = x1 + (outX - offX);
  const by0 = y0 + (outY - offY), by1 = y1 + (outY - offY);
  if(gx){
    let lo = by0, hi = by1;
    gx.with.forEach(o=>{ lo = Math.min(lo, o.node.y); hi = Math.max(hi, o.node.y + o.node.h); });
    el('line', {class:'align-guide', x1:gx.at.toFixed(2), x2:gx.at.toFixed(2),
                y1:(lo - GUIDE_OVERHANG).toFixed(2), y2:(hi + GUIDE_OVERHANG).toFixed(2)}, guideLayer);
  }
  if(gy){
    let lo = bx0, hi = bx1;
    gy.with.forEach(o=>{ lo = Math.min(lo, o.node.x); hi = Math.max(hi, o.node.x + o.node.w); });
    el('line', {class:'align-guide', y1:gy.at.toFixed(2), y2:gy.at.toFixed(2),
                x1:(lo - GUIDE_OVERHANG).toFixed(2), x2:(hi + GUIDE_OVERHANG).toFixed(2)}, guideLayer);
  }
  /* The extra offers get the same line, drawn along whatever they joined:
     the two ports for a connector, the bar and the entry for a merge. */
  const paintExtra = (c, vertical)=>{
    if(!c) return;
    let lo, hi;
    if(c.bar){
      lo = Math.min(c.bar.lo, vertical ? by0 : bx0);
      hi = Math.max(c.bar.hi, vertical ? by1 : bx1);
    } else {
      const a = c.span[0], b = c.span[1];
      lo = Math.min(vertical ? a.y : a.x, vertical ? b.y : b.x);
      hi = Math.max(vertical ? a.y : a.x, vertical ? b.y : b.x);
    }
    el('line', {class:'align-guide align-guide-line',
                x1: vertical ? c.at.toFixed(2) : (lo - GUIDE_OVERHANG).toFixed(2),
                x2: vertical ? c.at.toFixed(2) : (hi + GUIDE_OVERHANG).toFixed(2),
                y1: vertical ? (lo - GUIDE_OVERHANG).toFixed(2) : c.at.toFixed(2),
                y2: vertical ? (hi + GUIDE_OVERHANG).toFixed(2) : c.at.toFixed(2)}, guideLayer);
    /* …and, for a merge, a mark on the point of the bar being aimed at.
       The line alone says "this coordinate"; the middle of a bar is a
       PLACE, and the reader is centring the entry on it. */
    if(c.bar && typeof c.bar.cross === 'number'){
      const at = typeof c.mark === 'number' ? c.mark : c.at;
      el('circle', {class:'align-guide align-guide-dot bar-place-taken',
                    cx: (vertical ? at : c.bar.cross).toFixed(2),
                    cy: (vertical ? c.bar.cross : at).toFixed(2),
                    r: GUIDE_DOT_R + 2.5}, guideLayer);
    }
  };
  paintExtra(px, true);
  paintExtra(py, false);
  return {x: outX, y: outY, hitX: !!(gx || px), hitY: !!(gy || py)};
}
const leaderPickLayer = el('g', {id:'leaderPickLayer', style:'pointer-events:none;'}, viewport);

/* Choosing "on a leader line" IS the request to place it.
 *
 * There used to be a second button in a row below, so the placement was a
 * two-step act: pick the mode, then ask for the point. Nothing else in
 * this popover works that way — every other control takes effect as it is
 * set — and the extra row also had to explain itself. Selecting the
 * placement now starts the picking directly. */
function edgePointsFor(from, to){
  // The routed polyline as last drawn — the hit path carries it, and it is
  // the same geometry the note will be drawn against.
  const hit = edgeLayer.querySelector(
    `path.edge-hit[data-from="${cssEscape(from)}"][data-to="${cssEscape(to)}"]`);
  if(!hit) return null;
  const len = hit.getTotalLength();
  if(!len) return null;
  // Sampled rather than parsed: a wavy connector's rendered path is not the
  // skeleton, and sampling gives the same answer for both.
  const out = [];
  const steps = Math.max(8, Math.min(120, Math.round(len / 6)));
  for(let i=0;i<=steps;i++){ const p = hit.getPointAtLength(len*i/steps); out.push({x:p.x, y:p.y}); }
  return out;
}
function cssEscape(v){
  return (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&');
}
function beginCalloutPick(){
  if(!currentEdgeStyleTarget || readOnlyView) return;
  const {from, to} = currentEdgeStyleTarget;
  const pts = edgePointsFor(from, to);
  if(!pts){ setStyleStatus('err', 'This connector is not on screen to point at.'); return; }
  leaderPick = {from, to, pts, phase:'point', at:null, anchor:null, aim:null};
  document.body.classList.add('leader-picking');
  setStyleStatus('ok', 'Click the connector where the callout should attach — Escape cancels.');
  paintLeaderGhost(0.5);
}
function endCalloutPick(){
  if(!leaderPick) return;
  leaderPick = null;
  document.body.classList.remove('leader-picking');
  while(leaderPickLayer.firstChild) leaderPickLayer.removeChild(leaderPickLayer.firstChild);
}
function paintLeaderGhost(f){
  while(leaderPickLayer.firstChild) leaderPickLayer.removeChild(leaderPickLayer.firstChild);
  if(!leaderPick) return;
  const m = pointAtFraction(leaderPick.pts, f);
  el('circle', {class:'leader-ghost', cx:m.x.toFixed(2), cy:m.y.toFixed(2), r:5}, leaderPickLayer);
  if(document.body.classList.contains('leader-snapping')){
    paintConnectorSnaps(leaderPick.pts);
  }
}
function leaderFractionAt(ev){
  const p = clientToWorld(ev.clientX, ev.clientY);
  let f = fractionNearest(leaderPick.pts, p.x, p.y);
  if(ev.shiftKey){
    const sn = nearestSnapRecord(leaderPick.pts, f);
    if(sn) f = sn.f;
    leaderPick.snapName = snapNameFor(leaderPick.pts, sn);
  } else leaderPick.snapName = null;
  return f;
}

