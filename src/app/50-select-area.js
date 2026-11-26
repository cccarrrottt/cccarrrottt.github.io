/* ---------------------------------------------------------------------
   The selection's frame, kept and edited by hand (the owner's list of
   25.11, after Paint.NET's own tool).

   A lasso is gone the moment it is let go of, and what it caught can then
   only be changed an entry at a time. With this tool in the hand the frame
   stays: its sides and corners are grips that make it bigger or smaller,
   a press inside it carries the frame (not the entries), and the selection
   is worked out again as it goes — what the frame touches is picked, by
   the same rule a lasso has. A press outside it draws a new frame; with
   Shift what that frame catches is added to what was picked, with Alt it
   is taken away, and the frame goes on adding or taking away while it is
   edited.

   Presses on an entry are left to the entry, so the picked entries can
   still be carried. On the site it is part of the editor's file
   (LAZY_PARTS): a reader has nothing to select for.
   ------------------------------------------------------------------ */
var areaToolOn = false;
var selArea = null;        // {x, y, w, h, base: Set, mode: 'set'|'add'|'cut'}
var areaHand = null;       // the gesture under way
var areaLayer = null;
var areaDrawnAt = 0;       // the zoom the grips were sized for
var areaMode = 'set';      // what a new frame does with no key held
const AREA_GRIP_PX = 5;
const AREA_GRIPS = [['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5], ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5]];

/* What the frame catches: anything it touches, as a lasso does. */
function areaHits(a){
  const out = [];
  nodes.forEach(n=>{
    if(n.x < a.x + a.w && n.x + n.w > a.x && n.y < a.y + a.h && n.y + n.h > a.y) out.push(n.id);
  });
  return out;
}
function areaSelect(){
  const a = selArea;
  if(!a) return;
  const hits = areaHits(a);
  const ids = new Set(a.mode === 'set' ? [] : a.base);
  hits.forEach(id=>{ if(a.mode === 'cut') ids.delete(id); else ids.add(id); });
  const key = [...ids].sort().join('\u0001');
  if(key === a.picked) return;
  a.picked = key;
  if(!ids.size) deselect();
  else setSelection([...ids], selectedId && ids.has(selectedId) ? selectedId : (hits.find(id=> ids.has(id)) || [...ids][0]));
}
function drawArea(){
  if(!areaLayer) areaLayer = el('g', {class:'sel-area', id:'selArea'}, viewport);
  if(areaLayer.parentNode === viewport && areaLayer !== viewport.lastChild) viewport.appendChild(areaLayer);
  while(areaLayer.firstChild) areaLayer.removeChild(areaLayer.firstChild);
  const a = selArea;
  if(!a || !areaToolOn) return;
  areaDrawnAt = vs;
  el('rect', {class:'sel-area-frame', x: a.x, y: a.y, width: Math.max(0, a.w), height: Math.max(0, a.h),
              'stroke-width': 1.2 / vs, 'data-area': 'move'}, areaLayer);
  const r = AREA_GRIP_PX / vs;
  AREA_GRIPS.forEach(([k, fx, fy])=> el('rect', {class:'sel-area-grip', 'data-area': k, x: a.x + a.w * fx - r, y: a.y + a.h * fy - r,
                                         width: r * 2, height: r * 2, 'stroke-width': 1 / vs}, areaLayer));
  areaLayer.dataset.mode = a.mode;
}
function setAreaTool(on){
  if(readOnlyView) on = false;
  areaToolOn = on === undefined ? !areaToolOn : !!on;
  areaHand = null;
  if(areaToolOn){
    if(typeof inkTool !== 'undefined' && inkTool) setInkTool(null);
    if(typeof handTool !== 'undefined' && handTool) setHandTool(null);
    /* Picked up with entries already picked, the frame starts round them. */
    const ids = [...multiSelection].concat(selectedId && !multiSelection.size ? [selectedId] : [])
      .map(id=> nodes.get(id)).filter(Boolean);
    if(ids.length){
      const x0 = Math.min(...ids.map(n=> n.x)), y0 = Math.min(...ids.map(n=> n.y));
      const x1 = Math.max(...ids.map(n=> n.x + n.w)), y1 = Math.max(...ids.map(n=> n.y + n.h));
      selArea = {x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16, base: new Set(), mode: 'set'};
    } else selArea = null;
  } else selArea = null;
  document.body.classList.toggle('area-tool', areaToolOn);
  areaModes.hidden = !areaToolOn;
  if(!areaToolOn) setAreaMode('set');
  const b = document.getElementById('areaTool');
  if(b){ b.classList.toggle('active', areaToolOn); b.setAttribute('aria-pressed', areaToolOn ? 'true' : 'false'); }
  drawArea();
}
/* A press the tool takes: anything on the chart but an entry — and a
   grip or a side of the frame even where an entry is under it. */
function areaTakes(ev){
  if(!areaToolOn || readOnlyView) return false;
  const t = ev.target;
  if(t && t.closest && t.closest('.sel-area')) return true;
  if(selArea){
    const pt = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    if(pt && pt.clientX != null){
      const touch = ev.pointerType ? ev.pointerType !== 'mouse' : !!ev.touches;
      const part = areaPartAt(clientToWorld(pt.clientX, pt.clientY), touch ? 'touch' : 'mouse');
      if(part && part !== 'move') return true;
    }
  }
  return !(t && t.closest && t.closest('.node, [data-id]'));
}
/* Which part of the frame a press is on, worked out from where it is
   rather than from what it landed on: a finger is wider than a grip, and
   a phone gave the press to the frame under it, so a side pulled by hand
   carried the whole frame instead (the owner's list of 26.11). A grip is
   met anywhere within a finger's reach of it, the nearest one winning. */
function areaPartAt(w, pointerType){
  const a = selArea;
  if(!a) return null;
  const reach = (pointerType === 'touch' || pointerType === 'pen' ? 16 : AREA_GRIP_PX + 3) / (vs || 1);
  let best = null, bestD = Infinity;
  AREA_GRIPS.forEach(([k, fx, fy])=>{
    const d = Math.hypot(w.x - (a.x + a.w * fx), w.y - (a.y + a.h * fy));
    if(d <= reach && d < bestD){ best = k; bestD = d; }
  });
  if(best) return best;
  /* …and a side anywhere along it, not only at its middle. */
  const inX = w.x >= a.x - reach && w.x <= a.x + a.w + reach, inY = w.y >= a.y - reach && w.y <= a.y + a.h + reach;
  if(inY && Math.abs(w.x - a.x) <= reach) return 'w';
  if(inY && Math.abs(w.x - (a.x + a.w)) <= reach) return 'e';
  if(inX && Math.abs(w.y - a.y) <= reach) return 'n';
  if(inX && Math.abs(w.y - (a.y + a.h)) <= reach) return 's';
  if(w.x > a.x && w.x < a.x + a.w && w.y > a.y && w.y < a.y + a.h) return 'move';
  return null;
}
function areaDown(ev){
  if(!areaTakes(ev)) return;
  if(ev.button !== undefined && ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const w = clientToWorld(ev.clientX, ev.clientY);
  const part = areaPartAt(w, ev.pointerType);
  if(part){
    areaHand = {id: ev.pointerId, part, from: w, was: Object.assign({}, selArea)};
  } else {
    const mode = ev.shiftKey ? 'add' : ev.altKey ? 'cut' : areaMode;
    const base = new Set(multiSelection.size ? multiSelection : (selectedId ? [selectedId] : []));
    selArea = {x: w.x, y: w.y, w: 0, h: 0, base, mode};
    areaHand = {id: ev.pointerId, part: 'new', from: w};
  }
  try{ svg.setPointerCapture(ev.pointerId); }catch(e){}
  drawArea();
}
function areaMove(ev){
  const h = areaHand;
  if(!h || ev.pointerId !== h.id || !selArea) return;
  ev.preventDefault();
  const w = clientToWorld(ev.clientX, ev.clientY);
  const a = selArea, dx = w.x - h.from.x, dy = w.y - h.from.y;
  if(h.part === 'new'){
    a.x = Math.min(h.from.x, w.x); a.y = Math.min(h.from.y, w.y);
    a.w = Math.abs(dx); a.h = Math.abs(dy);
  } else if(h.part === 'move'){
    a.x = h.was.x + dx; a.y = h.was.y + dy;
  } else {
    /* A side or a corner: the sides it names follow the hand, and a frame
       pulled through itself turns inside out rather than vanishing. */
    let x0 = h.was.x, y0 = h.was.y, x1 = h.was.x + h.was.w, y1 = h.was.y + h.was.h;
    if(h.part.includes('w')) x0 += dx;
    if(h.part.includes('e')) x1 += dx;
    if(h.part.includes('n')) y0 += dy;
    if(h.part.includes('s')) y1 += dy;
    a.x = Math.min(x0, x1); a.y = Math.min(y0, y1); a.w = Math.abs(x1 - x0); a.h = Math.abs(y1 - y0);
  }
  drawArea();
  areaSelect();
}
function areaUp(ev){
  const h = areaHand;
  if(!h || ev.pointerId !== h.id) return;
  ev.preventDefault();
  areaHand = null;
  try{ svg.releasePointerCapture(ev.pointerId); }catch(e){}
  /* A press that drew nothing lets go of the frame, and of what it picked
     when it was a plain one. */
  if(h.part === 'new' && selArea && selArea.w < 3 && selArea.h < 3){
    if(selArea.mode === 'set') deselect();
    selArea = null;
  } else areaSelect();
  drawArea();
}
svg.addEventListener('pointerdown', areaDown, true);
svg.addEventListener('pointermove', areaMove, true);
svg.addEventListener('pointerup', areaUp, true);
svg.addEventListener('pointercancel', areaUp, true);
/* The mouse and touch events the press would have sent go nowhere: no
   pan, no lasso, no click on the paper letting go of what was picked. */
['mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu'].forEach(type=>
  svg.addEventListener(type, ev=>{
    if(!areaTakes(ev)) return;
    ev.stopPropagation();
    if(type !== 'touchstart') ev.preventDefault();
  }, true));
/* The grips stay the same size on screen whatever the zoom. */
svg.addEventListener('wheel', ()=>{ if(selArea && areaToolOn) requestAnimationFrame(()=>{ if(areaDrawnAt !== vs) drawArea(); }); }, {passive: true});
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && areaToolOn) setAreaTool(false); });
/* One tool in the hand: picking up the pencil, the eraser, the eyedropper
   or the brush puts this one down. */
['inkPen', 'inkEraser', 'pipetteTool', 'stylePaintTool'].forEach(id=>{
  const b = document.getElementById(id);
  if(b) b.addEventListener('click', ()=>{ if(areaToolOn) setAreaTool(false); }, true);
});
{
  const b = document.getElementById('areaTool');
  if(b) b.addEventListener('click', ev=>{ ev.stopPropagation(); setAreaTool(); });
}
/* Shift and Alt without a keyboard (the owner's list of 26.11): while the
   tool is in the hand, three buttons say what the next frame does — picks
   what it catches, adds it to what is picked, or takes it away. A key
   held still has its way for that one frame; the buttons are what a
   phone has instead, and stay as set until the tool is put down. */
const areaModes = document.createElement('div');
areaModes.className = 'area-modes';
areaModes.id = 'areaModes';
areaModes.hidden = true;
areaModes.setAttribute('role', 'radiogroup');
areaModes.setAttribute('aria-label', 'What the frame does');
[['set', 'Pick', 'Pick what the frame catches'],
 ['add', 'Add', 'Add what the frame catches to what is picked (Shift)'],
 ['cut', 'Take away', 'Take what the frame catches away from what is picked (Alt)']].forEach(([mode, label, title])=>{
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.mode = mode;
  b.textContent = label;
  b.title = title;
  b.setAttribute('role', 'radio');
  b.addEventListener('click', ev=>{ ev.stopPropagation(); setAreaMode(mode); });
  areaModes.appendChild(b);
});
function setAreaMode(mode){
  areaMode = mode;
  areaModes.querySelectorAll('button').forEach(b=>{
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
setAreaMode('set');
areaModes.addEventListener('pointerdown', ev=> ev.stopPropagation());
(document.querySelector('.app > .main') || document.body).appendChild(areaModes);
