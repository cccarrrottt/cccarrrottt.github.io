/* ---- Notes in the margin: a pencil and an eraser (the owner's list of 20.11)
 *
 * Drawn by hand over everything on the field, as one would pencil a note
 * in the margin of a printed chart. A stroke is the chart's, kept in
 * SETTINGS.ink and saved with it, and every reader sees it; only the
 * author holds the pencil.
 *
 * A stroke is {pts:[x0,y0,x1,y1,…], w}: world points, so it zooms and pans
 * with the chart it is written on, and its width in world units. The
 * points are those the hand passed through, thinned to a pixel and a half
 * apart on screen and rounded to a tenth, and drawn as a smooth line
 * through their midpoints.
 *
 * While a tool is in the hand nothing on the chart answers the pointer:
 * the pencil writes over an entry rather than picking it up. The eraser
 * takes whole strokes — whatever it passes over goes — and either tool is
 * put down with its button again or with Escape. A stroke made or a run
 * of the eraser is one edit, undone as one. */
const INK_WIDTH = 2;
const INK_ERASE_PX = 9;           // how near, on screen, the eraser takes a stroke
var inkLayer = null;
var inkTool = null;               // 'pen' | 'eraser' | null
var inkHand = null;               // the stroke or the erasing under way

function cleanInk(v){
  if(!Array.isArray(v)) return [];
  return v.filter(s=> s && Array.isArray(s.pts) && s.pts.length >= 4 && s.pts.length % 2 === 0 &&
                      s.pts.every(Number.isFinite))
          .map(s=>{
            const w = Number.isFinite(s.w) && s.w > 0 && s.w <= 40 ? s.w : INK_WIDTH;
            return w === INK_WIDTH ? {pts: s.pts.slice()} : {pts: s.pts.slice(), w};
          });
}
function inkStrokes(){ return cleanInk(SETTINGS.ink); }
/* A smooth line through the points: straight to the first midpoint, a
   curve about each point to the next midpoint, straight to the last. */
function inkPathOf(pts){
  const f = v=> (Math.round(v * 10) / 10).toString();
  if(pts.length === 2 || pts.length === 4 && pts[0] === pts[2] && pts[1] === pts[3]){
    // A dot: a stroke the hand did not move is still a mark.
    return `M${f(pts[0])},${f(pts[1])} l0.01,0`;
  }
  let d = `M${f(pts[0])},${f(pts[1])}`;
  if(pts.length === 4) return d + ` L${f(pts[2])},${f(pts[3])}`;
  for(let i = 2; i < pts.length - 2; i += 2){
    const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
    d += ` Q${f(pts[i])},${f(pts[i + 1])} ${f(mx)},${f(my)}`;
  }
  return d + ` L${f(pts[pts.length - 2])},${f(pts[pts.length - 1])}`;
}
function drawInk(list){
  if(!inkLayer) return;
  const strokes = list || inkStrokes();
  inkLayer.textContent = '';
  strokes.forEach((s, i)=>{
    el('path', {class:'ink-stroke', d: inkPathOf(s.pts), 'stroke-width': s.w || INK_WIDTH,
                'data-ink': String(i)}, inkLayer);
  });
}
/* How far a world point is from a stroke. */
function inkDistance(s, x, y){
  const p = s.pts;
  let best = Math.hypot(x - p[0], y - p[1]);
  for(let i = 0; i + 3 < p.length; i += 2){
    const ax = p[i], ay = p[i + 1], dx = p[i + 2] - ax, dy = p[i + 3] - ay;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
function setInkTool(tool){
  if(readOnlyView) tool = null;
  inkTool = tool === inkTool ? null : tool;
  inkHand = null;
  // One tool in the hand: the eyedropper or the brush is put down (46-hand-tools.js).
  if(inkTool && handTool) setHandTool(null);
  document.body.classList.toggle('ink-pen', inkTool === 'pen');
  document.body.classList.toggle('ink-eraser', inkTool === 'eraser');
  const pen = document.getElementById('inkPen'), er = document.getElementById('inkEraser');
  if(pen){ pen.classList.toggle('active', inkTool === 'pen'); pen.setAttribute('aria-pressed', inkTool === 'pen' ? 'true' : 'false'); }
  if(er){ er.classList.toggle('active', inkTool === 'eraser'); er.setAttribute('aria-pressed', inkTool === 'eraser' ? 'true' : 'false'); }
}
function inkErase(hand, w){
  const reach = INK_ERASE_PX / vs;
  const before = hand.list.length;
  hand.list = hand.list.filter(s=> inkDistance(s, w.x, w.y) > reach + (s.w || INK_WIDTH) / 2);
  if(hand.list.length !== before){ hand.changed = true; drawInk(hand.list); }
}
/* Fingers on the glass while a tool is held. A second one means the
   hand wants to move the map, not to write (the owner's list of 22.11,
   evening): the stroke under way is let go of as if it had never been
   started, and nothing is written until every finger has left. The
   pinch itself is 38-touch.js's, which sees both fingers first. */
var inkFingers = new Set(), inkPinched = false;
function inkAbandon(){
  const hand = inkHand;
  inkHand = null;
  if(!hand) return;
  try{ svg.releasePointerCapture(hand.id); }catch(e){}
  if(hand.path) hand.path.remove();
  drawInk();
}
function inkFingerGone(ev){
  if(ev.pointerType !== 'touch') return;
  inkFingers.delete(ev.pointerId);
  if(!inkFingers.size) inkPinched = false;
}
function inkDown(ev){
  if(!inkTool || readOnlyView) return;
  if(ev.button !== undefined && ev.button !== 0) return;
  if(ev.pointerType === 'touch'){
    inkFingers.add(ev.pointerId);
    if(inkFingers.size > 1 || inkPinched){ inkPinched = true; inkAbandon(); return; }
  }
  /* The chart does not see this press at all: not the entry under it,
     not the pan, not the marquee. */
  ev.preventDefault();
  ev.stopPropagation();
  const w = clientToWorld(ev.clientX, ev.clientY);
  if(inkTool === 'pen'){
    const path = el('path', {class:'ink-stroke ink-wet', 'stroke-width': INK_WIDTH}, inkLayer);
    inkHand = {tool:'pen', id: ev.pointerId, pts:[w.x, w.y], last:{x: ev.clientX, y: ev.clientY}, path};
    path.setAttribute('d', inkPathOf(inkHand.pts));
  } else {
    inkHand = {tool:'eraser', id: ev.pointerId, list: inkStrokes(), changed:false};
    inkErase(inkHand, w);
  }
  try{ svg.setPointerCapture(ev.pointerId); }catch(e){}
}
function inkMove(ev){
  if(!inkHand || ev.pointerId !== inkHand.id) return;
  ev.preventDefault();
  const w = clientToWorld(ev.clientX, ev.clientY);
  if(inkHand.tool === 'pen'){
    if(Math.hypot(ev.clientX - inkHand.last.x, ev.clientY - inkHand.last.y) < 1.5) return;
    inkHand.last = {x: ev.clientX, y: ev.clientY};
    inkHand.pts.push(Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10);
    inkHand.path.setAttribute('d', inkPathOf(inkHand.pts));
  } else inkErase(inkHand, w);
}
function inkUp(ev){
  inkFingerGone(ev);
  if(!inkHand || ev.pointerId !== inkHand.id) return;
  ev.preventDefault();
  const hand = inkHand;
  inkHand = null;
  try{ svg.releasePointerCapture(ev.pointerId); }catch(e){}
  if(hand.tool === 'pen'){
    hand.path.remove();
    const p = hand.pts.map(v=> Math.round(v * 10) / 10);
    if(p.length === 2) p.push(p[0], p[1]);
    applyEdit(()=>{ SETTINGS.ink = inkStrokes().concat([{pts: p}]); });
  } else if(hand.changed){
    applyEdit(()=>{ if(hand.list.length) SETTINGS.ink = hand.list; else delete SETTINGS.ink; });
  }
  drawInk();
  syncField();
}

inkLayer = el('g', {class:'ink-layer', id:'inkLayer'}, viewport);
drawInk();
syncField();
svg.addEventListener('pointerdown', inkDown, true);
svg.addEventListener('pointermove', inkMove, true);
svg.addEventListener('pointerup', inkUp, true);
svg.addEventListener('pointercancel', inkUp, true);
/* A tool in the hand keeps every other gesture off the chart: the mouse
   and touch events a press would have sent go nowhere. */
['mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu'].forEach(type=>
  svg.addEventListener(type, ev=>{ if(inkTool){ ev.stopPropagation(); if(type !== 'touchstart') ev.preventDefault(); } }, true));
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && inkTool) setInkTool(null); });
['inkPen', 'inkEraser'].forEach((id, i)=>{
  const b = document.getElementById(id);
  if(b) b.addEventListener('click', ev=>{ ev.stopPropagation(); setInkTool(i ? 'eraser' : 'pen'); });
});
