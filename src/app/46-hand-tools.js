/* ---- The eyedropper, the style brush and what a new entry starts as
 *      (the owner's list of 22.11)
 *
 * Two more tools in the hand, on the bar's second row beside the pencil
 * and the eraser, and taken up and put down as they are: with their key
 * again, or with Escape. While one is held the chart takes no other
 * gesture, so a press on an entry is the tool's and does not pick the
 * entry up.
 *
 * The eyedropper takes the colour of whatever is pressed — what is drawn
 * at that point, the fill where there is one and the line where there is
 * not — and hands it to the system clipboard as a code, so it can be
 * pasted into any colour field; the key keeps it in its corner. One press,
 * and it is put down.
 *
 * The style brush takes the look of what is picked when it is taken up —
 * an entry's borders, ground, corners, face, size and alignment, or a
 * connector's line, ends, path and colour — and gives it to every entry
 * or connector pressed after, each press one step of undo, until it is
 * put down. An entry gives its look to entries and a connector to
 * connectors: the two have no look in common.
 *
 * And the presets: what Default, Character and Link put down, set from
 * the gear beside each in the + menu (SETTINGS.presets). Default's preset
 * is what its figures and templates start as too. Each field of a preset
 * has its own way back to the page's default, and a preset with nothing
 * left in it is not kept. */
var handTool = null;              // 'pipette' | 'paint' | null
var paintLook = null;             // {kind:'node'|'edge', look}
const NODE_LOOK_KEYS = ['colors', 'bg', 'border', 'decor', 'square', 'font', 'fontSize', 'align', 'hatch'];
const EDGE_LOOK_KEYS = ['routing', 'dash', 'arrow', 'arrowIn', 'teeOut', 'teeIn', 'openOut', 'openIn', 'sinusoid',
                        'noteBg', 'noteFrame', 'noteSquare', 'color', 'colorFixed', 'gradient', 'square'];

function setHandTool(tool){
  if(readOnlyView) tool = null;
  handTool = tool === handTool ? null : tool;
  if(handTool && inkTool) setInkTool(null);
  if(handTool !== 'paint') paintLook = null;
  if(handTool === 'paint'){
    paintLook = lookOfPicked();
    if(!paintLook){
      handTool = null;
      flashStatus('Pick an entry or a connector first: the brush takes its style');
    }
  }
  document.body.classList.toggle('hand-pipette', handTool === 'pipette');
  document.body.classList.toggle('hand-paint', handTool === 'paint');
  [['pipetteTool', 'pipette'], ['stylePaintTool', 'paint']].forEach(([id, t])=>{
    const b = document.getElementById(id);
    if(b){ b.classList.toggle('active', handTool === t); b.setAttribute('aria-pressed', handTool === t ? 'true' : 'false'); }
  });
}

/* ---- The eyedropper ---- */
function hexOfPaint(v){
  if(!v || v === 'none' || v.startsWith('url(')) return null;
  const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\s*\)$/.exec(v.trim());
  if(m){
    if(m[4] !== undefined && +m[4] === 0) return null;
    return '#' + [m[1], m[2], m[3]].map(x=> (+x).toString(16).padStart(2, '0')).join('');
  }
  return HEX_RE.test(v) ? v.toLowerCase() : null;
}
/* What is drawn at the point pressed: the fill of the element under the
   pointer, or its line where it has no fill; a gradient answers with the
   colour its thing is given in the chart. */
function colourAtTarget(t){
  if(!t || !t.closest) return null;
  const cs = getComputedStyle(t);
  const fill = hexOfPaint(cs.fill), stroke = hexOfPaint(cs.stroke);
  const isText = t.tagName === 'text' || t.tagName === 'tspan';
  let c = isText ? (fill || stroke) : (fill && fill !== '#ffffff' && cs.fillOpacity !== '0' ? fill : (stroke || fill));
  if(c) return c;
  const g = t.closest('.node');
  const n = g && nodes.get(g.dataset.id);
  if(n && typeof n.color === 'string' && HEX_RE.test(n.color)) return n.color.toLowerCase();
  const from = t.getAttribute('data-from'), to = t.getAttribute('data-to');
  if(from && to){ const st = edgeStyleFor(from, to); if(st && HEX_RE.test(st.color || '')) return st.color.toLowerCase(); }
  return null;
}
function takeColour(c){
  const sw = document.getElementById('pipetteSwatch');
  if(sw){ sw.hidden = false; sw.style.background = c; }
  try{ if(navigator.clipboard) navigator.clipboard.writeText(c).catch(()=>{}); }catch(e){}
  flashStatus(`Copied ${c}`);
}

/* ---- The style brush ---- */
function pickLook(src, keys){
  const out = {};
  keys.forEach(k=>{ if(src && src[k] !== undefined) out[k] = JSON.parse(JSON.stringify(src[k])); });
  return out;
}
function lookOfPicked(){
  if(selectedId && nodes.has(selectedId)){
    const found = workingEntry(selectedId);
    if(found) return {kind:'node', look: pickLook(entryOpts(found.entry), NODE_LOOK_KEYS)};
  }
  const e = typeof currentEdgeStyleTarget !== 'undefined' && currentEdgeStyleTarget;
  if(e) return {kind:'edge', look: pickLook(edgeStyleFor(e.from, e.to), EDGE_LOOK_KEYS)};
  return null;
}
function paintNode(id){
  if(!paintLook || paintLook.kind !== 'node') return false;
  const found = workingEntry(id);
  if(!found) return false;
  applyEdit(()=>{
    const f = workingEntry(id);
    const opts = entryOpts(f.entry);
    NODE_LOOK_KEYS.forEach(k=>{ if(paintLook.look[k] === undefined) delete opts[k]; else opts[k] = JSON.parse(JSON.stringify(paintLook.look[k])); });
    putEntry(f.index, f.entry, opts);
  });
  return true;
}
function paintEdge(from, to){
  if(!paintLook || paintLook.kind !== 'edge') return false;
  applyEdit(()=>{
    const kept = Object.assign({}, edgeStyleFor(from, to));
    EDGE_LOOK_KEYS.forEach(k=>{ if(paintLook.look[k] === undefined) delete kept[k]; else kept[k] = JSON.parse(JSON.stringify(paintLook.look[k])); });
    setEdgeStyleOverride(from, to, kept);
  });
  return true;
}

/* A press with a hand tool: the chart never sees it. */
function handDown(ev){
  if(!handTool || readOnlyView) return;
  if(ev.button !== undefined && ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const t = document.elementFromPoint(ev.clientX, ev.clientY);
  if(handTool === 'pipette'){
    const c = colourAtTarget(t);
    if(c){ takeColour(c); setHandTool(null); }
    else flashStatus('No colour there');
    return;
  }
  const g = t && t.closest && t.closest('.node');
  const hit = t && t.closest && t.closest('[data-from][data-to]');
  let done = false;
  if(g && g.dataset.id) done = paintNode(g.dataset.id);
  else if(hit) done = paintEdge(hit.getAttribute('data-from'), hit.getAttribute('data-to'));
  if(!done) flashStatus(paintLook && paintLook.kind === 'edge' ? 'The brush holds a connector’s style: press a connector'
                                                               : 'The brush holds an entry’s style: press an entry');
}
svg.addEventListener('pointerdown', handDown, true);
['mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu'].forEach(type=>
  svg.addEventListener(type, ev=>{ if(handTool){ ev.stopPropagation(); if(type !== 'touchstart') ev.preventDefault(); } }, true));
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && handTool) setHandTool(null); });
[['pipetteTool', 'pipette'], ['stylePaintTool', 'paint']].forEach(([id, t])=>{
  const b = document.getElementById(id);
  if(b){
    b.addEventListener('mousedown', ev=> ev.stopPropagation());
    b.addEventListener('click', ev=>{ ev.stopPropagation(); setHandTool(t); });
  }
});

/* ---- Presets ---- */
const PRESET_KINDS = {
  rect:    ['colors', 'bg', 'border', 'square', 'font', 'fontSize', 'align'],
  ellipse: ['colors', 'border', 'font', 'fontSize'],
  link:    ['colors']
};
const PRESET_BORDERS = ['solid', 'dashed', 'dotted', 'dashdot', 'double', 'wavy'];
function cleanPresets(v){
  const out = {};
  if(!v || typeof v !== 'object') return out;
  Object.keys(PRESET_KINDS).forEach(kind=>{
    const p = v[kind];
    if(!p || typeof p !== 'object') return;
    const q = {};
    PRESET_KINDS[kind].forEach(k=>{
      const x = p[k];
      if((k === 'colors' || k === 'bg') && Array.isArray(x) && x.length && x.every(c=> HEX_RE.test(c))) q[k] = x.slice(0, 4);
      else if(k === 'border' && PRESET_BORDERS.includes(x) && x !== 'solid') q[k] = x;
      else if(k === 'square' && x === false) q[k] = false;
      else if(k === 'font' && typeof x === 'string' && x) q[k] = x;
      else if(k === 'fontSize' && Number.isFinite(x) && x >= 6 && x <= 96) q[k] = x;
      else if(k === 'align' && (x === 'left' || x === 'right')) q[k] = x;
    });
    if(Object.keys(q).length) out[kind] = q;
  });
  return out;
}
/* What an entry of this kind is put down with, a copy each time. */
function presetOptsFor(kind){
  const p = cleanPresets(SETTINGS.presets)[kind];
  return p ? JSON.parse(JSON.stringify(p)) : {};
}
function setPresetField(kind, key, value){
  applyEdit(()=>{
    const all = cleanPresets(SETTINGS.presets);
    const p = Object.assign({}, all[kind] || {});
    if(value === undefined) delete p[key]; else p[key] = value;
    all[kind] = p;
    const next = cleanPresets(all);
    if(Object.keys(next).length) SETTINGS.presets = next; else delete SETTINGS.presets;
  });
}
