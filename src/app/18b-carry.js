/* ---------------------------------------------------------------------
   Carrying an entry by hand — the bends that ride with it, the redraw
   each frame asks for, the positions kept at the end — and its grips for
   size, turn and a new connector. Taken out of 18-canvas-gestures.js
   (0.27.2) because a reader runs none of it: every way in is a carry
   beginNodeDrag refuses to readOnlyView, or a grip only the editor builds.
   What the carry's own listeners ask an answer of stays in part 18, where
   tools/lazy.js wants it. On the site
   it is part of the editor's file (LAZY_PARTS), so readers do not
   download it; everywhere else it is a part like any other.
   ------------------------------------------------------------------ */
/* An entry carried up to another used to PUSH it out of the way once the
   gap between two joined entries fell below the router's own threshold
   (0.9.x to 0.10.x). The owner found it more in the way than helpful: the
   reader moves what they take hold of, and nothing else moves. A
   connector squeezed too short is the router's to draw as best it can. */
function carryBends(st, offX, offY){
  if(!st.bendCarry || !st.bendCarry.length) return;
  st.bendCarry.forEach(c=>{
    const moved = c.from ? slideBends(c, offX, offY)
      : c.bends.map(b=> [b[0] + offX, b[1] + offY]);
    c.style.bends = moved.map(b=> [+b[0].toFixed(2), +b[1].toFixed(2)]);
  });
}
/* A connector with ONE end carried keeps its bends — but not all of them
   where they were (the owner's lists of 25.11 and 26.11). Pinned to the
   paper, the corners made the stretch out of the carried entry step
   sideways as soon as the entry left its line. The stretch that grows or
   shrinks is the LAST one running the way the entry is going — the one
   nearest the other end — and every corner between the carried entry and
   it goes along: carried down, an entry whose line drops, turns and drops
   again into the other keeps its first drop as it was, the level stretch
   rides down with it, and the drop into the other entry is the one that
   gets shorter. It was the FIRST such stretch in 0.28.0, and that one is
   usually the short stub at the entry, which the owner wants left alone
   unless the stretch across it is the one taken hold of. Each axis on its
   own, so a carry on the slant does both. A stretch at a slant, which the
   router turns, ends the search: it takes up what is left. Worked out
   from the bends as the carry found them, every frame, so carrying back
   puts every corner back. */
function slideBends(c, offX, offY){
  const list = c.bends.map(b=> [b[0], b[1]]);
  const chain = c.reversed ? list.slice().reverse() : list;
  const orig = chain.map(b=> [b[0], b[1]]);
  const pts = [[c.from.x, c.from.y]].concat(orig);
  if(c.to) pts.push([c.to.x, c.to.y]);
  const slide = (axis, off)=>{
    if(!off) return;
    const other = 1 - axis;
    /* Which stretch grows: the last along the carry, up to the first at a
       slant. With none, nothing is said about this axis and the corners
       stay; with the far end unknown, they all go, as they used to. */
    let grows = -1;
    for(let i = 0; i + 1 < pts.length; i++){
      const along = Math.abs(pts[i + 1][axis] - pts[i][axis]) > BEND_ABSORB;
      const across = Math.abs(pts[i + 1][other] - pts[i][other]) > BEND_ABSORB;
      if(along) grows = i;
      if(along && across) break;
    }
    if(grows < 0 && !c.to) grows = orig.length;
    for(let k = 0; k < grows; k++) chain[k][axis] = orig[k][axis] + off;
  };
  slide(0, offX);
  slide(1, offY);
  return c.reversed ? chain.reverse() : chain;
}
function queueDragRedraw(st){
  // A page more as the carry reaches the field's edge, at once (see syncField).
  syncField(st);
  if(dragRedrawFrame || dragRedrawTimer) return;
  const owed = st && st.redrawCost > DRAG_REDRAW_BUDGET
    ? Math.min(250, st.redrawCost) - (performance.now() - st.redrawEnd) : 0;
  if(owed > 0){
    dragRedrawTimer = setTimeout(()=>{ dragRedrawTimer = 0; queueDragRedraw(st); }, owed);
    return;
  }
  dragRedrawFrame = requestAnimationFrame(()=>{
    dragRedrawFrame = 0;
    const began = performance.now();
    // Where the carried entries stood when these routes were drawn; see
    // connectorAlignments, which has to allow for the pointer being ahead.
    if(st && st.node) st.drawnOff = {x: st.node.x - st.originX, y: st.node.y - st.originY};
    // The connectors joined to nothing carried keep their routes; see heldRoute.
    if(st && !st.routeMemo) st.routeMemo = new Map();
    const moving = new Set(st ? st.members.map(m=> m.id) : []);
    // The frames round what is carried, which move with it.
    refitArraysForDrag([...moving]).forEach(id=> moving.add(id));
    dragRouteHold = st ? {memo: st.routeMemo, moving} : null;
    try{ redrawEdges(); }
    finally{ dragRouteHold = null; }
    applyVisibility({edgesOnly: true});
    /* Every connector has just been rebuilt from nothing, so none of them
       remembers being faded — and the highlight is what says which of them
       belong to the entry being looked at. Without putting it back, picking
       an entry up lit the whole chart for as long as the mouse was down and
       let it settle again the moment it was released. */
    if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId, {edgesOnly: true});
    // A portrait's card is anchored beside its circle, so it has to travel
    // with it. Without this it sat where the circle used to be until the
    // mouse came up, and then jumped. Any card at all, since a portrait
    // asked to keep one open has it whether or not it is the one hovered.
    if(st.members.some(m=>{
         const n = m.node;
         return n && ((m.id === bioCardNodeId) || ((n.shape || '') === 'ellipse' && n.bioCard));
       })) drawBioCard();
    followStyleBar();
    if(st){ st.redrawEnd = performance.now(); st.redrawCost = st.redrawEnd - began; }
  });
}
// Writes the dropped position into the node's saved entry. Deliberately
// quiet on success — the page reloads itself after a publish, and a node
// snapping into place is its own confirmation; only failures speak up.
// One undo step for the whole move, however many nodes it covered.
function saveNodePositions(list, before){
  applyEdit(()=>{
    list.forEach(({id, x, y})=>{
      const found = workingEntry(id);
      if(!found) return;
      const opts = entryOpts(found.entry);
      // Back into the co-ordinate opts.pos is written in: the top of a
      // default-height box, not the top of this one. Without this the
      // entry climbed by half its extra height on every single drop.
      const n = nodes.get(id);
      /* Two decimals. Every ordinary drag hands whole numbers in and gets
         them back unchanged; a callout swung about its anchor does not,
         and rounding its corner here would put back exactly the half-pixel
         tilt the drag was careful not to introduce. */
      opts.pos = [+(+x + ((n && n.growShiftX) || 0)).toFixed(2), +(y + ((n && n.growShift) || 0)).toFixed(2)];
      putEntry(found.index, found.entry, opts);
    });
  }, before);
}
function beginNodeResize(ev, n, g, corner){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation();
  ev.preventDefault();
  nodeResizeState = {
    node: n, g,
    // Which corner is being pulled, as a pair of signs: which way this
    // corner has to move for the box to get bigger. The corner diagonally
    // opposite is the one that stays where it is.
    corner: corner || {key:'se', sx:1, sy:1},
    startClientX: ev.clientX, startClientY: ev.clientY,
    // The shift the entry is currently drawn with. Giving it a fixed size
    // takes that shift away, so the stored position has to lose it too or
    // the box drops by exactly that much the moment you resize it.
    growShift: n.growShift || 0,
    growShiftX: n.growShiftX || 0,
    originX: n.x, originY: n.y,
    originW: n.w, originH: n.h, moved: false,
    // On the chart, as an entry's carry is — see the wheel.
    grab: clientToWorld(ev.clientX, ev.clientY),
    picture: cardPictureAsDrawn(n)
  };
}
/* The size a card's picture is seen at, when nothing has set it: the
 * part of its band the picture covers, kept entire.
 *
   Resizing a card is resizing the CARD (the owner's list of 1.11). A
   picture with no size of its own is drawn as large as its band allows,
   and the band takes whatever the words leave — so a corner pulled out
   made the picture bigger and the card around it barely changed, and a
   corner pulled in shrank the picture. Its size is written down where
   the resize starts, as it is seen, and from then on the card grows and
   shrinks round it; the band it no longer covers is the blurred picture.
   There is no other way to size it (the owner's list of 15.11). */
function cardPictureAsDrawn(n){
  if(!n || !n.card || !n.image || (n.cardImgW != null && n.cardImgH != null)) return null;
  const band = n.cardImgBand;
  if(!band || !(band.h > 0.5)) return null;
  const bw = n.cardImgW != null ? n.cardImgW : n.w, bh = n.cardImgH != null ? n.cardImgH : band.h;
  const r = imageAspect(n.image);
  if(!r || n.cardCrop) return {w: round2(bw), h: round2(bh)};
  const w = Math.min(bw, bh / r);
  return {w: round2(w), h: round2(w * r)};
}
function beginNodeRotate(ev, n, g){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation();
  ev.preventDefault();
  nodeRotateState = {
    node: n, g,
    cx: n.x + n.w/2, cy: n.y + n.h/2,
    start: n.rot || 0, moved: false,
    startClientX: ev.clientX, startClientY: ev.clientY
  };
  // Where the hand took hold, as an angle about the centre — so the
  // caption turns BY what the hand turns rather than jumping to it.
  const p = clientToWorld(ev.clientX, ev.clientY);
  nodeRotateState.grab = Math.atan2(p.y - nodeRotateState.cy, p.x - nodeRotateState.cx) * 180/Math.PI;
  document.body.classList.add('rotating');
}
/* Standing an entry on another side, about its own middle.
 *
 * The position an entry keeps is the top-left of its box, and turning a
 * box that is not square moves its top-left — so a turn that only wrote
 * the angle down would swing the entry off to one side every time, and
 * four quarter turns would walk it across the chart. The turn is made,
 * the new box measured, and the position moved by however far the middle
 * went, so the entry turns where it stands. One undo step for both. */
function turnEntryTo(id, deg){
  if(readOnlyView) return;
  const n = nodes.get(id);
  if(!n || !quarterTurnable(n)) return;
  const to = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  if(to === quarterTurnOf(n)) { rebuildChart(); return; }
  const cx = n.x + n.w/2, cy = n.y + n.h/2;
  const pinned = !!n.pos;
  applyEdit(()=>{
    const found = workingEntry(id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    if(to) opts.rot = to; else delete opts.rot;
    /* A size set by hand is the size of the box as drawn, so it turns
       with it. */
    if(Array.isArray(opts.size) && opts.size.length === 2) opts.size = [opts.size[1], opts.size[0]];
    putEntry(found.index, found.entry, opts);
  });
  const m = nodes.get(id);
  if(!pinned || !m) return;
  /* Not rounded to the grid: rounding moved the middle by up to half a
     step, so a box turned in place visibly hopped, and four turns did not
     bring it back to where it started. */
  const dx = round2(cx - (m.x + m.w/2)), dy = round2(cy - (m.y + m.h/2));
  if(!dx && !dy) return;
  const found = workingEntry(id);
  if(!found) return;
  const opts = entryOpts(found.entry);
  if(!Array.isArray(opts.pos)) return;
  opts.pos = [+(opts.pos[0] + dx).toFixed(2), +(opts.pos[1] + dy).toFixed(2)];
  putEntry(found.index, found.entry, opts);
  rebuildChart();
  refreshSaveUI();
}
function beginConnectorDrag(ev, n, side, ring, ringColor){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation();
  ev.preventDefault();
  connectorDragState = {
    from: n, fromSide: side, fromRing: ring || 0, color: ringColor || null,
    start: portOnSide(n, side, 0, 1, ring || 0)
  };
  svg.classList.add('connector-dragging');
  // The rubber band wears the colour the finished connector will have.
  rubberBand.setAttribute('stroke', ringColor || 'var(--accent)');
  rubberBand.style.display = '';
}
