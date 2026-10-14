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
var lodLevel = 0, lodStale = true, lodLayerEl = null;

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
  const hs = [];
  nodes.forEach(n=>{ if(!isFreeShape(n.shape || '') && !isCalloutNode(n)) hs.push(n.h); });
  if(!hs.length) return 40;
  hs.sort((a, b)=> a - b);
  return hs[hs.length >> 1] || 40;
}
function lodLevelNow(){
  if(typeof nodes === 'undefined' || !nodes.size) return 0;
  const px = vs * lodEntryHeight();
  return px < LOD_CAT_PX ? 2 : px < LOD_TAG_PX ? 1 : 0;
}
function markLodStale(){ lodStale = true; syncLod(); }
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
    if(isFreeShape(n.shape || '') || isCalloutNode(n) || nodeHidden(n)) return;
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
    const hull = lodHull(corners);
    const color = lodColorOf(c.key);
    const g = el('g', {class:'lod-patch', 'data-key': c.key,
                       'data-x0': x0, 'data-y0': y0, 'data-x1': x1, 'data-y1': y1}, layer);
    el('polygon', {points: hull.map(q=> `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '),
                   fill: color, stroke: color, 'stroke-width': LOD_PAD * 2,
                   'stroke-linejoin': 'round'}, g);
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
