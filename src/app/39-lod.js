/* =========================================================================
   SEEN FROM FAR AWAY
   -----------------------------------------------------------------------
   A map that is zoomed out far enough that its entries are a few pixels
   tall shows nothing a reader can use: the words are specks, the lines a
   mesh, and the page is still laying out and painting every one of them.
   So past a point the chart stops drawing its entries and draws what they
   ADD UP to, the way a game's map does when you pull back from it (the
   owner's reference is Hollow Knight's): first a patch of colour for each
   cluster of entries that share a tag, then — further out still — one for
   each category those tags are filed under. A tag is meant to become a
   work within a franchise, and a category the franchise itself, so the
   further out you are, the bigger the thing each patch stands for.

   The level is decided by how tall an ordinary entry is ON THE SCREEN, not
   by the zoom factor, so a chart of large boxes and one of small ones
   change over at the same apparent size. A click on a patch zooms in to
   it, to where its entries can be read again.

   The patches are worked out only when the level changes or the chart
   does, and the entries' layers are simply not displayed while they show
   — which is where the saving is: nothing hidden is laid out or painted.

   The state is `var`, not `let`: applyTransform asks for the level on the
   very first fit, before this part has run.
   ========================================================================= */
/* Below these heights, in screen pixels, an ordinary entry is drawn as
   part of a patch: by tag, then by category. */
var LOD_TAG_PX = 5, LOD_CAT_PX = 2.4;
/* How near two entries of one tag must stand, in chart units, to be one
   cluster rather than two — a few entries' widths. A category stands for
   a whole franchise, so its works are gathered from much further apart. */
var LOD_REACH = 150, LOD_CAT_REACH = 1000;
// How far a patch stands out round the entries it covers.
var LOD_PAD = 26;
var LOD_INK = '#8a8f98';
var lodLevel = 0, lodStale = true, lodLayerEl = null, lodHeightMemo = null;
/* The patches can be turned off from the bar, for whoever wants the
   entries themselves at every distance; kept between visits. */
var LOD_KEY = 'rhizome.lod';
var lodOn = true;
try{ lodOn = localStorage.getItem(LOD_KEY) !== '0'; }catch(e){}
function setLod(on){
  lodOn = !!on;
  try{ localStorage.setItem(LOD_KEY, lodOn ? '1' : '0'); }catch(e){}
  const btn = document.getElementById('lodToggle');
  if(btn) btn.classList.toggle('active', lodOn);
  markLodStale();
}

function lodLayer(){
  if(!lodLayerEl){
    lodLayerEl = el('g', {id:'lodLayer'}, viewport);
    lodLayerEl.addEventListener('click', ev=>{
      const g = ev.target.closest && ev.target.closest('.lod-patch');
      if(!g) return;
      ev.stopPropagation();
      zoomToPatch(+g.dataset.x0, +g.dataset.y0, +g.dataset.x1, +g.dataset.y1);
    });
  }
  return lodLayerEl;
}
// The height an ordinary entry is drawn at: the median, so a few tall
// cards or captions do not decide it.
function lodEntryHeight(){
  /* Asked on every frame of a zoom, so remembered until the chart changes
     (markLodStale), rather than sorting every entry's height each time. */
  if(lodHeightMemo) return lodHeightMemo;
  const hs = [];
  nodes.forEach(n=>{ if(!isFreeShape(n.shape || '') && !isCalloutNode(n) && !isArrayNode(n)) hs.push(n.h); });
  if(!hs.length) return 40;
  hs.sort((a, b)=> a - b);
  return (lodHeightMemo = hs[hs.length >> 1] || 40);
}
function lodLevelNow(){
  if(!lodOn || typeof nodes === 'undefined' || !nodes.size) return 0;
  const px = vs * lodEntryHeight();
  return px < LOD_CAT_PX ? 2 : px < LOD_TAG_PX ? 1 : 0;
}
function markLodStale(){ lodStale = true; lodHeightMemo = null; syncLod(); }
/* Asked on every change of view: cheap unless the level has changed, when
   the patches are drawn afresh; otherwise only their labels are resized,
   since they are kept a readable size on the screen. */
function syncLod(){
  if(typeof viewport === 'undefined') return;
  const level = lodLevelNow();
  if(level !== lodLevel || (level && lodStale)){
    lodLevel = level;
    document.body.classList.toggle('lod', level > 0);
    drawLod(level);
  } else if(level) sizeLodLabels();
  if(!level) lodStale = true;
}
// Which tag an entry is gathered under: the first that is not a scenery tag.
function lodTagOf(n){
  const t = (n.tags || []).find(t=> !tagIsSpecial(t));
  return t || UNTAGGED;
}
function lodCategoryOf(tag){
  if(tag === UNTAGGED) return UNTAGGED;
  const c = TAG_CATS.find(c=> c.name !== UNGROUPED && (c.tags || []).includes(tag));
  return c ? 'cat:' + c.name : tag;
}
function lodColorOf(key){
  if(key === UNTAGGED) return LOD_INK;
  if(key.startsWith('cat:')){
    const c = TAG_CATS.find(c=> 'cat:' + c.name === key);
    const t = c && (c.tags || []).find(t=> tagColorOf(t));
    return (t && tagColorOf(t)) || LOD_INK;
  }
  return tagColorOf(key) || LOD_INK;
}
function lodNameOf(key){
  if(key === UNTAGGED) return '';
  return key.startsWith('cat:') ? key.slice(4) : key;
}
/* Entries that share a key and stand within `reach` of one another, as
   clusters — joined through any chain of such neighbours. A grid of
   reach-sized cells keeps it to the neighbours that could be near. */
function lodClusters(keyOf, reach){
  const groups = new Map();
  nodes.forEach(n=>{
    if(isFreeShape(n.shape || '') || isCalloutNode(n) || isArrayNode(n) || nodeHidden(n)) return;
    const k = keyOf(n);
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  });
  const out = [];
  groups.forEach((list, key)=>{
    const parent = list.map((_, i)=> i);
    const find = i=>{ while(parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    const cells = new Map();
    const cellOf = (x, y)=> Math.floor(x / reach) + ',' + Math.floor(y / reach);
    list.forEach((n, i)=>{
      const k = cellOf(n.x + n.w/2, n.y + n.h/2);
      if(!cells.has(k)) cells.set(k, []);
      cells.get(k).push(i);
    });
    const gap = (a, b)=> Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w),
                                     Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    list.forEach((n, i)=>{
      const cx = Math.floor((n.x + n.w/2) / reach), cy = Math.floor((n.y + n.h/2) / reach);
      for(let dx = -2; dx <= 2; dx++) for(let dy = -2; dy <= 2; dy++){
        (cells.get((cx + dx) + ',' + (cy + dy)) || []).forEach(j=>{
          if(j <= i || gap(n, list[j]) > reach) return;
          parent[find(j)] = find(i);
        });
      }
    });
    const byRoot = new Map();
    list.forEach((n, i)=>{
      const r = find(i);
      if(!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(n);
    });
    byRoot.forEach(members=> out.push({key, members}));
  });
  return out;
}
// The convex hull of a set of points (monotone chain).
function lodHull(pts){
  const p = pts.slice().sort((a, b)=> a.x - b.x || a.y - b.y);
  if(p.length < 3) return p;
  const cross = (o, a, b)=> (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  p.forEach(q=>{ while(lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], q) <= 0) lower.pop(); lower.push(q); });
  for(let i = p.length - 1; i >= 0; i--){
    const q = p[i];
    while(upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/* A hull's own sides are RULED, and corner-cutting leaves them so: a
   cluster four entries wide came out as a lozenge, round at the ends and
   flat along the top. Nothing about a cluster's edge is straight, so
   every side is given a midpoint pushed out along its own outward
   normal, a tenth of its length, before the corners are cut. A short
   side moves almost not at all and a long one bows, which is what makes
   a blob out of a figure. The hull is convex, so "outward" is simply
   away from its middle. */
function lodBow(pts, share){
  const n = pts.length;
  if(n < 3) return pts;
  let mx = 0, my = 0;
  pts.forEach(q=>{ mx += q.x; my += q.y; });
  mx /= n; my /= n;
  const out = [];
  for(let i = 0; i < n; i++){
    const a = pts[i], b = pts[(i + 1) % n];
    out.push(a);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if(L < 1) continue;
    // The normal of the side, turned to face away from the middle.
    let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    if(nx * (cx - mx) + ny * (cy - my) < 0){ nx = -nx; ny = -ny; }
    const push = L * (share || 0.1);
    out.push({x: cx + nx * push, y: cy + ny * push});
  }
  return out;
}
/* A hull is a POLYGON, and a patch of a dozen entries came out as an
   unmistakable many-sided figure — a shape with corners, standing for a
   cluster that has none. Corner-cutting (Chaikin) replaces every corner
   with the two points a quarter in along its sides, a few times over:
   the straight runs stay where they were, the corners round off, and
   what is left is a blob. The hull is closed, so the cutting wraps round
   it; three passes is where it stops changing to the eye. */
function lodBlob(pts, passes){
  let p = pts;
  for(let k = 0; k < (passes || 3) && p.length > 2; k++){
    const out = [];
    for(let i = 0; i < p.length; i++){
      const a = p[i], b = p[(i + 1) % p.length];
      out.push({x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25},
               {x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75});
    }
    p = out;
  }
  return p;
}
/* …and the long straight runs between them bowed outward, because a
   cluster's edge is not a ruled line either. Corner-cutting leaves a
   straight run exactly where it was, so a patch over a row of entries
   came out as a lozenge: round at the ends, flat along the top. A closed
   Catmull-Rom through the rounded outline bulges each span by a fraction
   of its own length, which is what makes the difference between a figure
   and a blob. */
function lodBlobPath(pts){
  const n = pts.length;
  if(n < 3) return '';
  const at = i=> pts[(i % n + n) % n];
  let d = `M${at(0).x.toFixed(1)},${at(0).y.toFixed(1)}`;
  for(let i = 0; i < n; i++){
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = {x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6};
    const c2 = {x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6};
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)}` +
         ` ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d + 'Z';
}
/* One patch per cluster: the hull round its entries, drawn with a stroke
   as wide as the padding and round joins, so its corners come out as
   arcs round the outermost boxes — a blob, not a polygon. Fill and stroke
   are one colour and the group is made translucent as a whole, so the
   overlap of the two does not show as a darker rim. */
function drawLod(level){
  const layer = lodLayer();
  while(layer.firstChild) layer.removeChild(layer.firstChild);
  lodStale = false;
  if(!level) return;
  const clusters = level === 2 ? lodClusters(n=> lodCategoryOf(lodTagOf(n)), LOD_CAT_REACH)
                                : lodClusters(lodTagOf, LOD_REACH);
  clusters.sort((a, b)=> b.members.length - a.members.length);
  clusters.forEach(c=>{
    const corners = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    c.members.forEach(n=>{
      corners.push({x:n.x, y:n.y}, {x:n.x + n.w, y:n.y}, {x:n.x, y:n.y + n.h}, {x:n.x + n.w, y:n.y + n.h});
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h);
    });
    const outline = lodBlob(lodBow(lodHull(corners), 0.1), 1);
    const color = lodColorOf(c.key);
    const g = el('g', {class:'lod-patch', 'data-key': c.key,
                       'data-x0': x0, 'data-y0': y0, 'data-x1': x1, 'data-y1': y1}, layer);
    el('path', {d: lodBlobPath(outline), fill: color, stroke: color,
                'stroke-width': LOD_PAD * 2, 'stroke-linejoin': 'round'}, g);
    const name = lodNameOf(c.key);
    if(name){
      const t = el('text', {class:'lod-label', x: ((x0 + x1)/2).toFixed(1), y: ((y0 + y1)/2).toFixed(1)}, g);
      t.textContent = name + (c.members.length > 1 ? ` · ${c.members.length}` : '');
    }
  });
  sizeLodLabels();
}
// Labels a readable size on the screen, whatever the zoom.
function sizeLodLabels(){
  if(!lodLayerEl) return;
  const px = (12 / vs).toFixed(2), halo = (3 / vs).toFixed(2);
  lodLayerEl.querySelectorAll('.lod-label').forEach(t=>{
    t.setAttribute('font-size', px);
    t.setAttribute('stroke-width', halo);
  });
}
/* Into a patch: centred on it, at the zoom where an ordinary entry is a
   dozen pixels tall and can be read again. */
function zoomToPatch(x0, y0, x1, y1){
  const rect = svg.getBoundingClientRect();
  vs = Math.min(3, Math.max(0.08, 12 / lodEntryHeight()));
  vx = rect.width / 2 - (x0 + x1) / 2 * vs;
  vy = rect.height / 2 - (y0 + y1) / 2 * vs;
  applyTransform();
}
syncLod();
{
  const btn = document.getElementById('lodToggle');
  if(btn){
    btn.classList.toggle('active', lodOn);
    btn.addEventListener('click', ()=> setLod(!lodOn));
  }
}

/* =========================================================================
   THE OVERVIEW
   -----------------------------------------------------------------------
   The whole chart drawn small in the lowest drawer on the left, with a
   frame for the part of it the view is showing. Pressing or dragging on it
   moves the view there, at the zoom it already had.

   It is a canvas and draws boxes only — no text, no lines — because it is
   read for where things ARE, and because it is drawn again on every
   movement of the view: six hundred filled rectangles are nothing to a
   canvas, where a second copy of the SVG would be the whole chart again.
   It is drawn only while its drawer is open, and at most once a frame.

   `var` and function declarations, like the rest of this part: the view
   asks for a redraw on its very first move, before this part has run.
   ========================================================================= */
var MINIMAP_KEY = 'rhizome.minimap';
var MINIMAP_PAD = 30;                 // chart units round the outermost entries
var minimapFrame = 0, minimapFit = null;
function minimapOpen(){
  const p = document.getElementById('minimapPanel');
  return !!(p && p.classList.contains('open'));
}
function syncMinimap(){
  if(minimapFrame || !minimapOpen()) return;
  minimapFrame = requestAnimationFrame(()=>{ minimapFrame = 0; drawMinimap(); });
}
/* The chart's extent, and with it how chart units map onto the canvas. The
   view's own frame is taken in too, so the frame never falls off the edge
   when the view wanders beyond the last entry. */
function minimapLayout(cw, ch){
  const b = computeBounds();
  const r = svgSize();
  const v = {x0: -vx / vs, y0: -vy / vs, x1: (r.width - vx) / vs, y1: (r.height - vy) / vs};
  let x0 = Math.min(Number.isFinite(b.minX) ? b.minX - MINIMAP_PAD : v.x0, v.x0);
  let y0 = Math.min(Number.isFinite(b.minY) ? b.minY - MINIMAP_PAD : v.y0, v.y0);
  let x1 = Math.max(Number.isFinite(b.maxX) ? b.maxX + MINIMAP_PAD : v.x1, v.x1);
  let y1 = Math.max(Number.isFinite(b.maxY) ? b.maxY + MINIMAP_PAD : v.y1, v.y1);
  const k = Math.min(cw / Math.max(1, x1 - x0), ch / Math.max(1, y1 - y0));
  // Centred in the canvas along whichever axis has room to spare.
  const ox = (cw - (x1 - x0) * k) / 2 - x0 * k, oy = (ch - (y1 - y0) * k) / 2 - y0 * k;
  return {k, ox, oy, view: v};
}
function drawMinimap(){
  const cv = document.getElementById('minimapCanvas');
  if(!cv || !minimapOpen()) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = cv.clientWidth, ch = cv.clientHeight;
  if(!cw || !ch) return;
  if(cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)){
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cw, ch);
  const css = getComputedStyle(document.documentElement);
  const ink = (css.getPropertyValue('--ink-faint') || '').trim() || LOD_INK;
  const accent = (css.getPropertyValue('--accent') || '').trim() || '#c23b22';
  const fit = minimapFit = minimapLayout(cw, ch);
  nodes.forEach(n=>{
    // A frame drawn as a block would paint over everything it holds.
    if(nodeHidden(n) || isArrayNode(n)) return;
    const free = isFreeShape(n.shape || '');
    c.globalAlpha = free ? 0.3 : 0.75;
    c.fillStyle = (typeof n.color === 'string' && n.color) || ink;
    // Never thinner than a pixel, or a far-out chart's entries vanish.
    c.fillRect(n.x * fit.k + fit.ox, n.y * fit.k + fit.oy,
               Math.max(1, n.w * fit.k), Math.max(1, n.h * fit.k));
  });
  c.globalAlpha = 1;
  const v = fit.view;
  c.strokeStyle = accent;
  c.lineWidth = 1.5;
  c.strokeRect(v.x0 * fit.k + fit.ox + 0.75, v.y0 * fit.k + fit.oy + 0.75,
               Math.max(2, (v.x1 - v.x0) * fit.k - 1.5), Math.max(2, (v.y1 - v.y0) * fit.k - 1.5));
}
/* The drawer itself opens and shuts like the others (setSideTab); this is
   what the overview adds to that: drawn as it opens, and remembered. */
function minimapOpened(open){
  try{ localStorage.setItem(MINIMAP_KEY, open ? '1' : '0'); }catch(e){}
  if(open) drawMinimap();
}
function setMinimap(open){
  setSideTab(document.getElementById('minimapPanel'), open);
}
{
  const p = document.getElementById('minimapPanel');
  const cv = document.getElementById('minimapCanvas');
  if(p && cv){
    /* The point pressed becomes the middle of the view. The layout is the
       one the canvas was last drawn with, so where the press lands is
       where the reader saw the chart — not where a redraw since might
       have moved it to. */
    const goTo = ev=>{
      const fit = minimapFit;
      if(!fit) return;
      const r = cv.getBoundingClientRect();
      centreViewOn((ev.clientX - r.left - fit.ox) / fit.k, (ev.clientY - r.top - fit.oy) / fit.k, vs);
    };
    let held = false;
    cv.addEventListener('pointerdown', ev=>{
      ev.stopPropagation(); ev.preventDefault();
      held = true;
      try{ cv.setPointerCapture(ev.pointerId); }catch(e){}
      goTo(ev);
    });
    cv.addEventListener('pointermove', ev=>{ if(held) goTo(ev); });
    const letGo = ()=>{ held = false; drawMinimap(); };
    cv.addEventListener('pointerup', letGo);
    cv.addEventListener('pointercancel', letGo);
    window.addEventListener('resize', ()=> syncMinimap());
    let was = false;
    try{ was = localStorage.getItem(MINIMAP_KEY) === '1'; }catch(e){}
    if(was) setMinimap(true);
  }
}
