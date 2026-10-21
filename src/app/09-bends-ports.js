/* ---------------------------------------------------------------------
   Bends set by hand.

   A connector may carry a list of points it has to pass through. They are
   stored in chart coordinates, in order from the source end, and the route
   is built from them directly: out of the first port along its own normal,
   through every bend at right angles, and into the last port along its
   normal. Nothing is searched and nothing is avoided — a route somebody
   placed by hand is the answer, not a suggestion.
   ------------------------------------------------------------------ */
function handBends(style){
  /* A straight connector is one line from port to port; a hand bend would
     turn it into an elbowed one by the back door, so it has none — and a
     list kept from when it was elbowed waits, unused, for it to be again. */
  if(style && style.routing === 'straight') return [];
  const list = (style && Array.isArray(style.bends)) ? style.bends : null;
  if(!list || !list.length) return [];
  return list
    .filter(b=> Array.isArray(b) && b.length === 2 &&
                Number.isFinite(b[0]) && Number.isFinite(b[1]))
    .map(b=> ({x: b[0], y: b[1]}));
}
/* How far off a neighbour's line a bend may be and still be put ON it.
 *
 * A bend is stored where it was dropped, on the ruled grid; the port it
 * leads to is not on that grid, and moves whenever its side gains or loses
 * a connector or its entry is resized. So a bend that was dead in line with
 * the run out of its port when it was placed is, a little later, three
 * units to one side of it — and the route goes out, steps three units
 * across, and goes on: a knee that does not meet. Less than one grid step
 * is never a statement anybody made with a bend, so the route squares it
 * away when it is drawn, every time, rather than once when it is dropped. */
const BEND_ABSORB = GRID - 0.5;
/* …and only ACROSS the target's run-out. A last corner standing a little
 * further out than the target's stub, along the line the stub runs on, is
 * no step at all: the last leg crosses over to the stub's line and comes
 * straight down it into the port, the run-out simply longer. Squared away
 * all the same, it was pulled down onto the stub — so a stretch pinned
 * above an entry dropped a few units TOWARDS the entry as the entry was
 * carried up to it, before clearOfPort began pushing it away. */
function absorbBendOffsets(s1, bends, s2, n1, n2){
  const out = bends.map(b=> ({x:b.x, y:b.y}));
  const near = (u, v)=> Math.abs(u - v) > 0.01 && Math.abs(u - v) <= BEND_ABSORB;
  // Forward from the source's run-out, each point against the one before…
  let prev = s1;
  out.forEach((b, i)=>{
    /* The same holds at the source for a first corner standing straight
       out past the stub, on the stub's own line: the run-out goes on out
       to it, and there is no step to square away. */
    const along = i === 0 && n1 ? (n1.x ? 'x' : 'y') : null;
    if(!along){
      if(near(b.x, prev.x)) b.x = prev.x;
      if(near(b.y, prev.y)) b.y = prev.y;
    } else {
      const across = along === 'x' ? 'y' : 'x';
      if(near(b[across], prev[across])) b[across] = prev[across];
      const straightOut = ((b.x - s1.x) * n1.x + (b.y - s1.y) * n1.y) > 0 &&
                          Math.abs(b[across] - s1[across]) < 0.01;
      if(near(b[along], prev[along]) && !straightOut) b[along] = prev[along];
    }
    prev = b;
  });
  // …and the last against the target's, which it has to arrive in line with.
  const last = out[out.length - 1];
  if(last){
    const beyond = !!n2 && ((last.x - s2.x) * n2.x + (last.y - s2.y) * n2.y) > 0;
    if(near(last.x, s2.x) && !(beyond && n2.x)) last.x = s2.x;
    if(near(last.y, s2.y) && !(beyond && n2.y)) last.y = s2.y;
  }
  return out;
}
/* The polyline through those points, turned into right angles.
 *
 * Each leg between two consecutive points becomes an L, and which way
 * round the L goes is decided by continuity: the first leg has to leave
 * along the source port's own normal, the last has to arrive along the
 * target's, and every leg in between starts on whichever axis the leg
 * before it finished on — so the run reads as one line turning corners
 * rather than as a chain of separate elbows. */
/* A bend INSIDE one of the two entries is not a route at all.
 *
 * It can be dropped there — the handles are dragged over the chart and
 * nothing stops one being let go on a box — and once there it asks for
 * something impossible: the route ENDS at that entry's border, so a point
 * in its middle can only be reached by driving through the box and coming
 * back out. Every shape that satisfies it is worse than the shape that
 * ignores it, so it is ignored. The handle stays where it was dropped and
 * can be pulled back out into the open, where it means something again. */
/* …and nor is a bend standing so close to one that a corner cannot fit
 * between the two.
 *
 * Dropped on an entry's border, or a few units off it, a bend asks for the
 * same impossible thing as one inside: the route either touches the box at
 * the bend or has to wrap round the entry to arrive from the far side — the
 * line diving through the box and the hook back up into the port, which is
 * what such a bend drew. A corner needs EDGE_CORNER_R of room and a little
 * more to read as a turn rather than as a nick in the border, so that much
 * clear paper round the entry's OUTERMOST ring is where a bend starts to
 * mean anything. Closer than that it is set aside like one inside, and the
 * route is worked out as though it were not there. */
const BEND_DODGE = EDGE_CORNER_R + 4;
function outerRingOf(n){
  return Math.max(0, ringCountOf(n) - 1) * ringStepFor(n);
}
function usableHandBends(style, a, b){
  const list = handBends(style);
  if(!list.length) return list;
  const boxes = [a, b].filter(Boolean).map(n=>{
    const m = outerRingOf(n) + BEND_DODGE;
    return {x0:n.x - m, y0:n.y - m, x1:n.x + n.w + m, y1:n.y + n.h + m};
  });
  if(!boxes.length) return list;
  return list.filter(p=> !boxes.some(r=> p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1));
}
/* The shortest run-out a port allows — stubLength asked about a far end
   standing on the port itself, which has no room in front of it.
 *
 * Where a stretch that leaves a port is moved sideways, the line still has
 * to come out of the port square; it does so for this far and then steps
 * across. At exactly this distance the router's own run-out and the step
 * coincide, so writing down only where the step ENDS is enough to have it
 * drawn where it was asked for — and the entry, carried later, takes its
 * run-out with it rather than leaving it pinned on the paper. */
function runOutFloor(port){
  const q = Object.assign({}, port, {head: true});
  return stubLength(q, {x: q.x, y: q.y});
}
/* A route pinned by hand, with its entry carried up to it.
 *
 * The corners stay where they were put — that is what pinning means — and
 * the entry can be carried right up to them and past. Then the first
 * corner is BEHIND the port's run-out, and nothing honest can be drawn
 * through it: the line would have to leave the entry and turn straight
 * back. Setting such a corner aside, as an unpinned bend is set aside,
 * redraws the whole connector some other way all at once — the jump —
 * so a pinned route is PUSHED instead, like snow in front of a plough:
 * the first corner is moved out along the port's normal to where the
 * run-out ends, and so is whatever stretch it starts (the corner across
 * from it on the same stretch, or the next one along a stretch that was
 * heading outwards). A stretch that was heading back towards the entry —
 * a route that goes out, over and back — is left where it is: that turn
 * is the reader's, not the entry's. Measured from each end, so carrying
 * either entry pushes its own end of the line and nothing else. */
function clearOfPort(bends, port){
  const n = SIDE_NORMAL[port && port.side];
  if(!n || !bends.length) return bends;
  const floor = runOutFloor(port);
  const along = (b)=> (b.x - port.x) * n.x + (b.y - port.y) * n.y;
  const key = n.x ? 'x' : 'y';
  const out = bends.map(b=> ({x: b.x, y: b.y}));
  let need = floor;
  for(let i = 0; i < out.length; i++){
    const b = out[i], was = bends[i];
    const d = need - along(b);
    if(d <= 1e-6) break;
    b.x += n.x * d; b.y += n.y * d;
    const next = bends[i + 1];
    if(!next) break;
    const across = Math.abs(next[key] - was[key]) < 0.5;
    if(across){ need = along(b); continue; }
    /* A stretch heading outwards is pushed ahead of the corner as well,
       and kept at least a grid step long: any shorter and it would be
       squared away into the corner (see absorbBendOffsets), the line out
       and the line back would lie on top of each other, and the route
       would be set aside after all. */
    const run = along(next) - along(was);
    if(run < -0.5) break;
    need = along(b) + Math.min(GRID, Math.max(0, run));
  }
  return out;
}
/* …and its first and last corners kept level with the ports they turn
 * away from.
 *
 * A corner is written down where it stood, and the stretch it ends that
 * comes straight out of a port was standing at that port's level. The
 * port does not stay there: the entry is carried, or another connector
 * arrives on the same face and the ports spread out along it. The corner
 * kept the old level, so the line left the port, stepped up to where the
 * port used to be, went across and came back down — a hook nobody drew —
 * and when the step grew short enough to be squared away the whole hook
 * vanished in one frame, which was the jump. The stretch out of the port
 * is the port's, not the reader's: a stretch the reader moved off the
 * port's level is written down with a step at the run-out (see shiftArm),
 * and that corner turns ALONG the run-out rather than across it, so it is
 * never touched here. Only a corner the line turns across at — the end
 * of the port's own straight stretch — follows the port. */
function levelWithPorts(bends, p1, p2){
  const n1 = SIDE_NORMAL[p1 && p1.side], n2 = SIDE_NORMAL[p2 && p2.side];
  if(!n1 || !n2 || !bends.length) return bends;
  const out = bends.map(b=> ({x: b.x, y: b.y}));
  const k1 = n1.x ? 'x' : 'y', c1 = n1.x ? 'y' : 'x';
  const k2 = n2.x ? 'x' : 'y', c2 = n2.x ? 'y' : 'x';
  const last = out.length - 1;
  /* Which way the line leaves the first corner, and arrives at the last,
     follows bentRoute's own rule: a leg starts across the axis the one
     before it finished on, and the final leg starts across the target's
     normal. With one corner, the other end of its leg is the far stub. */
  let leaves;
  if(last > 0) leaves = Math.abs(out[1][c1] - out[0][c1]) > 0.5 ? c1 : k1;
  else {
    const first = c2;
    leaves = Math.abs(p2[first] - out[0][first]) > 0.5 ? first : (first === 'x' ? 'y' : 'x');
  }
  let arrives;
  if(last > 0) arrives = Math.abs(out[last - 1][k2] - out[last][k2]) < 0.5 ? c2 : k2;
  else arrives = Math.abs(p1[k1] - out[0][k1]) > 0.5 ? k1 : c1;
  if(leaves === c1) out[0][c1] = p1[c1];
  if(arrives === c2) out[last][c2] = p2[c2];
  return out;
}
function pinnedHandBends(style, p1, p2){
  let list = handBends(style);
  if(!list.length) return list;
  list = levelWithPorts(list, p1, p2);
  list = clearOfPort(list, p1);
  list = clearOfPort(list.slice().reverse(), p2).reverse();
  // Anything still inside either entry after that is set aside as before.
  const boxes = [p1, p2].map(p=> nodes.get(p && p.owner)).filter(Boolean).map(n=>{
    const m = outerRingOf(n) + BEND_DODGE;
    return {x0:n.x - m, y0:n.y - m, x1:n.x + n.w + m, y1:n.y + n.h + m};
  });
  return list.filter(p=> !boxes.some(r=> p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1));
}
/* The two boxes a hand-bent route may not run THROUGH: its own.
 *
 * Everything else on the chart it is allowed to cross — a route placed by
 * hand is a statement, and dodging things is exactly what it was placed
 * instead of. Its own two entries are the exception, because it does not
 * cross them either: it ENDS on them. A line that dives through the box it
 * is arriving at and comes back up into the port from underneath is not a
 * deliberate route, it is the only shape the L happened to have. The box
 * is the one the reader sees, outer rings and all. */
/* …and a little more than the box. Measured to the box itself, a run that
 * passed a unit inside the border or a unit outside it counted as clear,
 * and was drawn ON the border — a connector laid along its own entry's
 * edge, then hooking into the port from the far side. Nothing reaches
 * these boxes but the legs between the two run-outs, and every run-out
 * stands further out than this, so the margin costs no route that was
 * ever right. */
const OWN_BOX_CLEAR = 3;
function ownEndBoxes(p1, p2){
  return [p1, p2].map(p=> nodes.get(p && p.owner)).filter(Boolean).map(n=>{
    const m = OWN_BOX_CLEAR + outerRingOf(n);
    return {x0:n.x - m, y0:n.y - m, x1:n.x + n.w + m, y1:n.y + n.h + m};
  });
}
/* Whether a route built through hand bends came out as one nobody would
 * draw: a leg between the two run-outs through either of its own entries,
 * or a run that turns straight back on the one before it. Either is the
 * mark of bends that cannot all be honoured from these two ports — and a
 * connector that ignores them reads correctly, where one that obeys them
 * does not. */
function handRouteBroken(pts, p1, p2){
  if(!pts || pts.length < 2) return true;
  const boxes = ownEndBoxes(p1, p2);
  for(let i = 1; i < pts.length - 2; i++){
    const a = pts[i], b = pts[i+1];
    if(boxes.some(r=> segIntersectsRect(a.x, a.y, b.x, b.y, r))) return true;
  }
  for(let i = 0; i + 2 < pts.length; i++){
    const u = segDir(pts[i], pts[i+1]), v = segDir(pts[i+1], pts[i+2]);
    if(u && v && u.x === -v.x && u.y === -v.y) return true;
  }
  return false;
}
function bentRoute(p1, p2, handBendsList){
  const s1 = stubPoint(p1, handBendsList[0]);
  const s2 = stubPoint(p2, handBendsList[handBendsList.length - 1]);
  const n1 = SIDE_NORMAL[p1.side] || {x:0, y:-1};
  const n2 = SIDE_NORMAL[p2.side] || {x:0, y:-1};
  const bends = absorbBendOffsets(s1, handBendsList, s2, n1, n2);
  /* A bend standing ON a run-out, between the border and the stub, is
     the stub. The run-out is the straight piece every connector leaves
     and arrives by; a point in the middle of it can only be reached by
     going out to the stub and coming back along the same line, which is
     drawn as a spike. Nobody asked for that by dropping a bend a few
     pixels off a box, so the point is taken to be the end of the run-out
     it is lying on. */
  const onRunOut = (b, p, s, n)=>{
    if(!b) return;
    const across = n.x ? Math.abs(b.y - s.y) : Math.abs(b.x - s.x);
    const out = (b.x - p.x) * n.x + (b.y - p.y) * n.y;
    const len = (s.x - p.x) * n.x + (s.y - p.y) * n.y;
    if(across < 0.5 && out > -0.5 && out < len){ b.x = s.x; b.y = s.y; }
  };
  onRunOut(bends[0], p1, s1, n1);
  onRunOut(bends[bends.length - 1], p2, s2, n2);
  const chain = [s1, ...bends, s2];
  const out = [p1, s1];
  const boxes = ownEndBoxes(p1, p2);
  const cuts = (u, v)=> boxes.some(r=> segIntersectsRect(u.x, u.y, v.x, v.y, r));
  const clearRun = (pts)=> pts.every((q, k)=> !k || !cuts(pts[k-1], q));
  /* Whether a run from u to v lies along n, heading the way `sign` says.
     Used at the two stubs: a line that reaches the stub travelling AWAY
     from its entry and then turns straight back down the run-out into the
     port has doubled back on itself — the tight hook a bend placed level
     with an entry's top, a little off to one side, used to draw. The same
     is true of a line that leaves the source's stub straight back towards
     the box it has just come out of. */
  const along = (u, v, n, sign)=>{
    const dx = v.x - u.x, dy = v.y - u.y;
    const across = Math.abs(dx * n.y - dy * n.x);
    return across < 0.5 && sign * (dx * n.x + dy * n.y) > 0.5;
  };
  const turnsBack = (pts, first, last)=>
    (first && pts.length > 1 && along(pts[0], pts[1], n1, -1)) ||
    (last && pts.length > 1 && along(pts[pts.length - 2], pts[pts.length - 1], n2, 1));
  /* A detour stands BEND_DODGE outside a box: a corner's radius and a
     little, so the turn has room to round without touching the border. */
  /* One leg of the chain, as the points BETWEEN its two ends.
   *
   * An L where an L is clear, which is almost always; where it is not, a
   * Z round the outside of whichever entry was in the way. The Z keeps
   * the axis the leg has to finish on, so a last leg still arrives along
   * its port's normal — it simply gets clear of the box first, on a line
   * chosen from the box's own edges. Without it a bend placed level with
   * its own entry, on the far side from where the connector is going,
   * drew a line straight across the box: the route reversed at the bend,
   * and a reversal is drawn as one straight run through everything
   * between its two ends. */
  const legVia = (a, b, firstAxis, first, last)=>{
    const fine = (pts)=> clearRun(pts) && !turnsBack(pts, first, last);
    const corner = firstAxis === 'x' ? {x:b.x, y:a.y} : {x:a.x, y:b.y};
    if(fine([a, corner, b])) return [corner];
    /* The last leg is asked to finish across its port's normal, so that it
       meets the run-out at a right angle. Where that L would come at the
       stub from the wrong side — the bend lies between the stub and the
       border — the other L reaches the same stub from the side, at the
       stub's own level: up past the box, across, and down into the port,
       which is the shape anyone drawing it by hand would give it. */
    if(last){
      const other = firstAxis === 'x' ? {x:a.x, y:b.y} : {x:b.x, y:a.y};
      if(fine([a, other, b])) return [other];
    }
    const lanes = [];
    boxes.forEach(r=>{
      if(firstAxis === 'x'){ lanes.push(r.y0 - BEND_DODGE, r.y1 + BEND_DODGE); }
      else { lanes.push(r.x0 - BEND_DODGE, r.x1 + BEND_DODGE); }
    });
    const from = firstAxis === 'x' ? a.y : a.x;
    lanes.sort((u, v)=> Math.abs(u - from) - Math.abs(v - from));
    for(const lane of lanes){
      const via = firstAxis === 'x'
        ? [{x:a.x, y:lane}, {x:b.x, y:lane}]
        : [{x:lane, y:a.y}, {x:lane, y:b.y}];
      if(fine([a, via[0], via[1], b])) return via;
    }
    return [corner];
  };
  // Which axis the previous leg arrived on: 'x' means it was horizontal.
  let arrived = n1.x ? 'x' : 'y';
  for(let i = 1; i < chain.length; i++){
    const a = chain[i-1], b = chain[i];
    const last = (i === chain.length - 1);
    let firstAxis;
    if(last){
      // The final leg must ARRIVE along the target port's normal, so it
      // leaves this corner on the other axis.
      firstAxis = n2.x ? 'y' : 'x';
    } else {
      // Carry on across the axis the last leg ended on…
      firstAxis = arrived === 'x' ? 'y' : 'x';
      /* …unless carrying on takes the leg through one of the two entries
         and turning first does not. Continuity is a preference — it is
         what makes a chain of bends read as one line rather than as a row
         of elbows — and an L has two ways round, both of which pass
         through the same two points. Preferring the one that stays
         outside the boxes costs nothing when both are clear, which is
         nearly always, and is the difference between a bend placed below
         an entry being reached round it or straight through it. */
      const alt = firstAxis === 'x' ? 'y' : 'x';
      const bad = (axis)=>{
        const c = axis === 'x' ? {x:b.x, y:a.y} : {x:a.x, y:b.y};
        return cuts(a, c) || cuts(c, b) || turnsBack([a, c, b], i === 1, false);
      };
      if(bad(firstAxis) && !bad(alt)) firstAxis = alt;
    }
    out.push(...legVia(a, b, firstAxis, i === 1, last), b);
    arrived = firstAxis === 'x' ? 'y' : 'x';
  }
  out.push(p2);
  return tidyPoints(out);
}
/* A redraw that changes nothing the router can see re-routes nothing.
 *
 * Every edit redraws the whole chart, and routing was the larger half of
 * every redraw — for an edit that cannot have moved a single line:
 * recolouring an entry's text, tagging it, retyping its note. A route is a
 * function of what is asked (the ports, the look, the entries it may
 * cross) and of what the chart around it is: the boxes in the way, and the
 * connectors already drawn this pass, which it is scored against. So a
 * pass remembers its calls in order, and the next pass, while the chart
 * around is the same and every call so far has been asked exactly as last
 * time, hands back last time's answers. The first call asked differently
 * — or a different chart around — ends the reuse for the rest of the
 * pass, because from there on the connectors already drawn are not the
 * ones the old answers were scored against. Which makes it exact rather
 * than close: the routes are the ones a fresh pass would draw, and the
 * suite compares the two.
 *
 * "The chart around" is every entry as the router could see it: its box,
 * its shape and border, how many rings it wears — everything but what is
 * only words or paint (routeWorldKey). Dragging keeps its own memo
 * (heldRoute), so a pass made while something is carried does not take
 * part. */
const ROUTE_BLIND = new Set(['label', 'note', 'tags', 'link', 'langTabs', 'multiLang', 'medium', 'image',
                             'font', 'fontSize', 'color', 'colors', 'ownColors', 'bg']);
let routePass = null, routeLast = null;
function routeWorldKey(){
  const parts = [];
  nodes.forEach(n=>{
    const o = {};
    for(const k in n) if(!ROUTE_BLIND.has(k)) o[k] = n[k];
    o.rings = ringCountOf(n);
    parts.push(o);
  });
  return JSON.stringify([parts, SETTINGS]);
}
function beginRoutePass(){
  if(dragRouteHold){ routePass = null; routeLast = null; return; }
  const world = routeWorldKey();
  routePass = {world, calls: [], reuse: !!routeLast && routeLast.world === world, prev: routeLast};
}
function endRoutePass(){
  if(routePass) routeLast = {world: routePass.world, calls: routePass.calls};
  routePass = null;
}
function pathFromPorts(p1,p2,style,excludeIds,lane){
  const pass = routePass;
  if(!pass) return pathFromPortsFresh(p1,p2,style,excludeIds,lane);
  const key = JSON.stringify([p1, p2, style || null, excludeIds ? [...excludeIds] : null, lane || 0]);
  const was = pass.reuse && pass.prev.calls[pass.calls.length];
  let got;
  if(was && was.key === key){
    if(was.registered) registerRoutedSegments(was.pts);
    got = was;
  } else {
    pass.reuse = false;
    const before = routedSegments.length;
    const r = pathFromPortsFresh(p1,p2,style,excludeIds,lane);
    got = {key, d: r.d, angleDeg: r.angleDeg, ignored: r.ignored,
           pts: r.pts.map(q=> Object.assign({}, q)), registered: routedSegments.length > before};
  }
  pass.calls.push(got);
  // A copy each time: what is handed out is drawn from, and may be added to.
  return {d: got.d, angleDeg: got.angleDeg, pts: got.pts.map(q=> Object.assign({}, q)), ignored: got.ignored};
}
function pathFromPortsFresh(p1,p2,style,excludeIds,lane){
  style = style || DEFAULT_EDGE_STYLE;
  /* The router is told which ends carry an arrowhead, because a head needs
     a straight run to sit in — see stubLength. The port records themselves
     are left alone; only the copies the routing sees learn about it. */
  /* …and how wide the line is, which an open ring needs to know: see
     sinkEnds, where a headless end is stopped so that neither edge of
     the line comes out under a rippled ring into the gap within it. */
  const lineHalf = isDoubleDash(style) ? EDGE_DBL_HALF : EDGE_HALF;
  const r1 = Object.assign({}, p1, {head: !!style.arrowIn, lineHalf});
  const r2 = Object.assign({}, p2, {head: style.arrow !== false, lineHalf});
  /* …but where a pocket reality is at either end, the ROUTE is worked out
     as though both ends carried one.
   *
     A head needs a straight run to sit in, so an end that has one is given
     a longer run-out — and on a rippled border that difference is enough
     to change which crossbar the router picks. The consequence was that
     the same two entries were joined by three different shapes depending
     on which arrowheads happened to be switched on, and only the shape
     with both of them was right. An arrowhead is a decoration on a
     relationship, not part of it: the route it is drawn along should be
     the same either way. So the routing is done at the longer clearance
     always, and the arrows go on affecting only what is DRAWN — where the
     line stops at the border, and whether there is a head there at all. */
  /* …and that is true of every connector, not only the ones at a pocket.
   *
     An arrowhead is a decoration on a relationship. Whether one is drawn
     changes what is at the END of the line; it has no business changing
     where the line GOES. It did: a head asks for a straight run to sit in,
     so an end that had one was given a longer run-out, and a longer
     run-out can change which crossbar the router picks — the same two
     entries joined by a different shape depending on which arrowheads
     happened to be switched on, and a wavy line re-fitted to a different
     length underneath it. Routing at the longer clearance always makes
     the route one answer, and the arrows go on affecting only what is
     drawn: where the line stops at the border, and whether there is a
     head there at all. */
  const q1 = Object.assign({}, r1, {head: true});
  const q2 = Object.assign({}, r2, {head: true});
  /* Bends set BY HAND take the route over.
   *
   * The automatic router is very good at "get from here to there without
   * crossing anything", and no good at all at the other thing a reader
   * wants from a connector: to make it go a particular way, because that
   * way says something. A line taken deliberately round the outside of a
   * group, or brought down a corridor two other lines already use, is a
   * statement about the chart; the shortest clear route is not. So a
   * connector may be given points it must pass through, and where it has
   * them they ARE the route — no search, no avoidance, no second-guessing
   * a placement somebody made on purpose. */
  let hand = style.bendSides ? pinnedHandBends(style, q1, q2)
    : usableHandBends(style, nodes.get(p1 && p1.owner), nodes.get(p2 && p2.owner));
  let bent = hand.length ? bentRoute(q1, q2, hand) : null;
  /* Bends that cannot be honoured cleanly are not honoured at all: the
     line is drawn as though they were not there. They are taken out when
     the edit that broke them is settled (dropIgnoredBends) — until then,
     in the middle of a drag, a hand that carries on may make them good
     again. */
  let ignored = false;
  if(bent && handRouteBroken(bent, q1, q2)){ hand = []; bent = null; ignored = true; }
  const pts = sinkEnds(
    bent ? bent
      : style.routing === 'straight' ? [p1,p2]
      : squareUp(levelSlivers(orthPointsAvoiding(q1,q2,excludeIds,lane)), q1, q2),
    r1, r2);
  if(style.routing !== 'straight' || hand.length) registerRoutedSegments(pts);
  const d = style.sinusoid ? wavyPath(pts, 0, 0, false, edgeCornerR(style)) : roundedPath(pts, edgeCornerR(style));
  /* `ignored` says the route was drawn without bends it was given — see
     dropIgnoredBends, which takes such bends out when an edit settles. */
  return { d, angleDeg: endAngleDeg(pts), pts, ignored };
}
// ports is {p1, p2, lane} from resolvePorts(); when absent, fall back to
// the automatic sides at each side's midpoint.
function routeEdge(a,b,style,ports){
  let p1, p2, lane = 0;
  if(ports){ p1 = ports.p1; p2 = ports.p2; lane = ports.lane || 0; }
  else {
    const sides = autoSides(a,b);
    p1 = portOnSide(a, sides.from, 0, 1);
    p2 = portOnSide(b, sides.to, 0, 1);
  }
  return pathFromPorts(p1,p2,style,new Set([a.id,b.id]),lane);
}

/* ---------------------------------------------------------------------
   Port assignment.

   Resolves, for every lineage edge in one pass: which side of each node it
   uses (its own saved fromSide/toSide if it has them, otherwise the
   geometric guess), and then where along that side it sits. Ports sharing
   a side are ordered by where the far end of each connector actually lies
   along that side's axis, so a fan of connectors reads left-to-right (or
   top-to-bottom) in the same order as the nodes they run to — which is
   what keeps them from crossing each other on the way out.

   Spacing is purely (i+1)/(count+1) of the side, so a side holds any
   number of connectors; they just sit closer together as more arrive.
   ------------------------------------------------------------------ */
/* `sideOverrides`, when given, is edge -> {fromSide, toSide}: sides
   decided somewhere else that this assignment has to know about.
 *
 * A lineage feeding a merge is the case. Which side of its own entry it
 * leaves by is chosen by the merge, from where the bar hangs — and until
 * that answer reached here, the assignment spaced the ports of that side
 * without counting it. The merged connector then took the middle of the
 * edge for itself while an ordinary connector on the same edge was placed
 * as though it were alone: two lines a few pixels apart, one centred and
 * one not, on a side they were supposed to be sharing. */
/* A connector sent to the side a callout's leader arrives at is moved to
   the next best one. Chosen rather than refused: the reader asked for a
   connection, and a connection that arrives one edge round is a far better
   answer than one that does not arrive at all — or one that lands on top
   of the leader and reads as a single line running through the card. */
const SIDE_FALLBACK = {top:['bottom','right','left'], bottom:['top','right','left'],
                       left:['right','top','bottom'], right:['left','top','bottom']};
function avoidLeaderSide(n, side){
  if(!isCalloutNode(n)) return side;
  const taken = calloutLeaderSide(n);
  if(!taken || taken !== side) return side;
  return (SIDE_FALLBACK[side] || [])[0] || side;
}
function resolvePorts(edgesList, sideOverrides){
  const ends = [];   // one entry per edge end
  edgesList.forEach(e=>{
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if(!a || !b) return;
    const style = edgeStyleFor(e.from, e.to);
    const auto = autoSides(a,b);
    const over = sideOverrides && sideOverrides.get(e);
    /* A connector bent BY HAND takes its sides from the bends.
     *
     * The automatic guess is about where the two entries lie — which side
     * of one faces the other — and it is the right question right up until
     * somebody pins the route to points of their own. After that the two
     * answers can disagree, and the disagreement is not a small one: the
     * guess flips to another pair of sides the moment the entries are far
     * enough apart on the other axis, and the route has to get from a port
     * on a new side to a bend that has not moved. What it drew was a line
     * that left the entry going one way, doubled back past it to reach the
     * bend, and set off again — the knee JUMPING to the far side of its
     * own entry as two boxes were pulled apart, on a connector whose route
     * was supposed to be the one thing on the chart nothing could move.
     *
     * So the first port faces the first bend and the last port faces the
     * last one. Both are then stable under any movement of the entries
     * that leaves the bends where they are, which is what a route placed
     * by hand promises. A side set by hand on the connector still wins
     * over both. */
    const bendChain = usableHandBends(style, a, b);
    const firstBend = bendChain[0], lastBend = bendChain[bendChain.length - 1];
    /* …and the bend decides outright, not only when the guess would send
     * the line backwards past its own entry.
     *
     * Keeping the guess wherever it pointed roughly the right way left it
     * free to FLIP — it answers "which side of one entry faces the
     * other", so pulling the two apart along the other axis changes its
     * answer — and a flip takes the port to a different face while the
     * bend has not moved at all. The whole route is then drawn again
     * between a new port and the same fixed points: at one step of a
     * carry the line left its entry rightwards and came into the other
     * from the left; at the next it left downwards and came in from
     * above. That is the connector jumping. Nothing about it was
     * gradual, and nothing the reader did asked for it.
     *
     * A bend is a statement about ONE point and one entry, so it answers
     * a question the pair cannot: which face of this box the line is
     * pinned towards. That answer changes only when the bend itself
     * crosses the box's diagonal — which is the reader moving the entry
     * past their own bend, and is the one case where the side SHOULD
     * change. Everywhere else the route now holds still under any
     * movement that leaves the bends alone, which is what a route placed
     * by hand promises. A side set by hand still wins over it. */
    /* …and better still, the sides are WRITTEN DOWN with the bends.
     *
     * "The side the first bend is seen through" is still a reading of the
     * geometry, and it still flips: the diagonal it is measured against
     * belongs to the box, and a wide flat entry has a very shallow one —
     * a corner a hundred units to the right and thirty down was "below"
     * it, and the line left from underneath. Dragging a stretch of the
     * route, or carrying the entry a little way, crossed that diagonal
     * and threw the whole connector to another face. A route pinned by
     * hand is pinned at both ends as well: the sides it had when its
     * corners were set are kept with them (bendSides), and only a chart
     * that predates that falls back on the reading. */
    const pinned = style.bendSides && handBends(style).length;
    const autoFrom = pinned ? style.bendSides[0]
      : firstBend ? sideFacing(a, firstBend.x, firstBend.y) : auto.from;
    const autoTo = pinned ? style.bendSides[1]
      : lastBend ? sideFacing(b, lastBend.x, lastBend.y) : auto.to;
    let fromSide = (over && over.fromSide) || style.fromSide || autoFrom;
    let toSide = (over && over.toSide) || style.toSide || autoTo;
    /* …but never the side a callout's own leader already occupies. */
    fromSide = avoidLeaderSide(a, fromSide);
    toSide = avoidLeaderSide(b, toSide);
    ends.push({edge:e, end:'from', nodeId:e.from, node:a, side:fromSide, ring:style.fromRing,
               other:b, merged: !!over});
    ends.push({edge:e, end:'to',   nodeId:e.to,   node:b, side:toSide,   ring:style.toRing,   other:a});
  });

  /* One family per SIDE, whatever ring each connector attaches to. The
     rings are only a few pixels apart, so treating them as separate
     families meant two connectors on the same edge of an entry could be
     spaced as if the other did not exist and end up all but on top of each
     other. Sharing the spacing keeps them apart across the whole edge;
     each port still sits on its own ring's line, so a connector still
     visibly belongs to the border it was drawn from. */
  const groups = new Map();  // "nodeId|side" -> [end, ...]
  ends.forEach(en=>{
    const key = en.nodeId + '|' + en.side;
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(en);
  });

  const result = new Map();  // edge -> {p1, p2, lane}
  groups.forEach(list=>{
    // Along a top/bottom side the ports run left-to-right, so order them by
    // the other node's x; along a left/right side they run top-to-bottom,
    // so order by its y.
    const byX = sideIsVertical(list[0].side);
    list.sort((m1,m2)=> byX
      ? (m1.other.x+m1.other.w/2) - (m2.other.x+m2.other.w/2)
      : (m1.other.y+m1.other.h/2) - (m2.other.y+m2.other.h/2));
    const seat = (en, i, count)=>{
      const p = portOnSide(en.node, en.side, i, count, en.ring||0);
      if(!result.has(en.edge)) result.set(en.edge, {lane:0});
      const rec = result.get(en.edge);
      if(en.end==='from'){ rec.p1 = p; }
      else { rec.p2 = p; rec.toSide = en.side; rec.toRing = en.ring||0; }
      // Index within the busiest of its two sides becomes the edge's lane
      // offset, so connectors leaving a crowded side each bend through
      // their own mid-line rather than all sharing one.
      rec.lane = Math.max(rec.lane, i*12);
    };
    /* A lineage feeding a MERGE leaves by the MIDDLE of its side.
     *
     * Everything else about a merge is symmetric — the bar hangs level,
     * the landings are spread about their own middle, the arrow leaves
     * from the centre of the entry's edge — and the one place it was not
     * was where the lineage left its own parent: the even share along
     * that side put it a third or a fifth of the way along, so the line
     * came out of the box beside the middle and the bar had to be built
     * around where it happened to land. Off-centre by a few pixels reads
     * as a mistake on a construction that is otherwise plumb.
     *
     * So the merged lineages take the middle of the side and share it
     * between themselves when a parent feeds more than one merge from the
     * same edge — which is the same even share, about the same centre.
     * The ordinary connectors on that side then take the slots FURTHEST
     * from the middle out of the fan they would all have shared, so they
     * neither land on a lineage nor bunch up on one side of it. */
    const mergedEnds = list.filter(en=> en.merged);
    const plainEnds = list.filter(en=> !en.merged);
    if(mergedEnds.length && plainEnds.length){
      const total = list.length;
      const outward = [...Array(total).keys()]
        .sort((p,q)=> Math.abs((q+1)/(total+1) - 0.5) - Math.abs((p+1)/(total+1) - 0.5));
      const slots = outward.slice(0, plainEnds.length).sort((p,q)=> p - q);
      plainEnds.forEach((en, k)=> seat(en, slots[k], total));
      mergedEnds.forEach((en, k)=> seat(en, k, mergedEnds.length));
    } else {
      list.forEach((en, i)=> seat(en, i, list.length));
    }
  });
  /* Nothing is straightened by moving the ports. A pair of facing ports a
     few pixels out of line used to be brought into line by sliding both
     along their sides — and the price was that the ends of a connector
     moved whenever either entry was carried, which is the one thing an
     end must never do. The step is the route's problem now, and the route
     is where it can be seen. */
  return result;
}

/* Facing ports used to be brought into line here, by spending each
   port's slack (see portSlack, which now gives none). The whole block —
   PORT_ALIGN_CEILING, portAlignMax, alignFacingPorts — is gone rather
   than left switched off: a connector's ends are fastened to their ports,
   and nothing on the chart may slide them along a side. */

// Reality-archetype rendering helpers. 'mirror' fills the box with its own
// border color, so the label needs a contrast-checked text color instead of
// the fixed ink color; 'amalgam' paints the border/text with a gradient
// built from the node's colors (falls back to a flat color with <2 colors).
const svgDefs = document.getElementById('svgDefs');
// svgDefs itself holds only what is made once. What the connectors make
// each time they are drawn — their gradients, the clips that cut a head
// to its entry's outline — goes into this group, which redrawEdges()
// empties on every pass; what the entries make goes into nodeDefs below,
// emptied by every render. Neither pass can then delete what the other
// still points at.
const edgeDefs = el('g', {id:'edgeDefs'}, svgDefs);
/* And the clips the ENTRIES make — one per picture, one per overlong
   label — in a group of their own, cleared with every render.
 *
 * They used to go straight into svgDefs, which is never cleared, so every
 * pass left another clipPath carrying the same id behind it. A fragment
 * reference resolves to the FIRST element with that id, which after the
 * first render is always the stalest one: move an entry with a portrait in
 * it and the picture was still being clipped to the circle it used to
 * stand in, so it vanished. */
const nodeDefs = el('g', {id:'nodeDefs'}, svgDefs);

