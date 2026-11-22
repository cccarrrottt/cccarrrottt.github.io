/* ---------------------------------------------------------------------
   The fan-fiction weave.

   An entry tagged "fan-fiction" is not a different KIND of thing — it is
   still a reality, with the same archetype, ports and connectors as any
   other — so it keeps its own shape and gets a texture behind it instead:
   a diagonal lattice, faint, spreading a little way past the box and
   fading out. It reads at a glance across a crowded chart without adding
   another border or another colour to decode.

   One pattern and one fade serve every tagged entry: the mask works in the
   masked element's own bounding box, so the same definition centres itself
   on each entry it is used by.
   ------------------------------------------------------------------ */
/* FANFIC_TAG and UNRELEASED_TAG, and the register of tags that act
   (SPECIAL_TAGS), are declared in 02-model.js: the first chart is built
   while that part runs, and building it asks whether a tag is one of them
   — a chart with a coloured tag on it did not open while they were here. */
/* Every piece of ground an entry can be standing on. Written once, because
   four separate places have to find all of them — the drag that carries
   them, the filter that hides them, the wash that dims them and the
   performance that lights them — and a fifth kind of ground added to three
   of the four is a decoration that behaves differently depending on what
   you do to it. */
const GROUND_PARTS = '.fanfic-weave, .fanfic-glint, .unreleased-rule, .unreleased-glint';
/* The two grounds' colours, which the chart's author may set.
 *
 * Each ground is drawn in two inks: the ruling as it lies, and the ruling
 * as it looks where the light crosses it. Both are the chart's, kept in
 * SETTINGS.groundColors as {fanfic: {base, glow}, unreleased: {…}} and
 * written only where somebody changed one, so a chart that never did
 * writes the line it always wrote. They reach the drawing as custom
 * properties on the page, which the stylesheet's own colours stand behind
 * as fallbacks — the dark page keeps its own darker light unless a light
 * was chosen, and a chosen one is turned over with the rest of the chart. */
const GROUND_COLOR_DEFAULTS = {
  fanfic:     {tag: FANFIC_TAG,     base: '#e8b21f', glow: '#ffcf3d'},
  unreleased: {tag: UNRELEASED_TAG, base: '#525c6b', glow: '#7d92ad'},
};
const GROUND_SLOTS = ['base', 'glow'];
function groundKeyOf(tag){
  return Object.keys(GROUND_COLOR_DEFAULTS).find(k=> GROUND_COLOR_DEFAULTS[k].tag === tag) || null;
}
function cleanGroundColors(v){
  const out = {};
  if(!v || typeof v !== 'object' || Array.isArray(v)) return out;
  Object.keys(GROUND_COLOR_DEFAULTS).forEach(k=>{
    const one = v[k];
    if(!one || typeof one !== 'object') return;
    const kept = {};
    GROUND_SLOTS.forEach(s=>{ if(isHexColor(one[s])) kept[s] = one[s]; });
    if(Object.keys(kept).length) out[k] = kept;
  });
  return out;
}
function groundColorSet(key, slot){
  const own = SETTINGS.groundColors && SETTINGS.groundColors[key];
  return (own && isHexColor(own[slot])) ? own[slot] : null;
}
function groundColorOf(key, slot){
  return groundColorSet(key, slot) || GROUND_COLOR_DEFAULTS[key][slot];
}
function applyGroundColors(){
  const root = document.documentElement.style;
  Object.keys(GROUND_COLOR_DEFAULTS).forEach(k=>{
    GROUND_SLOTS.forEach(s=>{
      const prop = `--${k}-${s}`, v = groundColorSet(k, s);
      if(v) root.setProperty(prop, v); else root.removeProperty(prop);
    });
  });
}
/* Inside an edit, and replacing the map rather than changing it, as the
   tags' own colours are: the undo snapshot still holds the old one. A
   null colour puts that ink back to the program's; no key at all puts
   back both. */
function setGroundColorIn(key, slot, color){
  const next = cleanGroundColors(SETTINGS.groundColors);
  if(!GROUND_COLOR_DEFAULTS[key]) return;
  if(!slot) delete next[key];
  else {
    const one = Object.assign({}, next[key] || {});
    if(color && isHexColor(color)) one[slot] = color; else delete one[slot];
    if(Object.keys(one).length) next[key] = one; else delete next[key];
  }
  if(Object.keys(next).length) SETTINGS.groundColors = next; else delete SETTINGS.groundColors;
}
function nodeHasTag(n, tag){ return !!(n && n.tags && n.tags.indexOf(tag) >= 0); }
function tagIsSpecial(tag){ return Object.prototype.hasOwnProperty.call(SPECIAL_TAGS, tag); }
/* One tag, drawn as a tag. `special` and `reserved` are the two kinds that
   are set in italic: the ones that act on the entries carrying them, and
   the Untagged bucket, which is not a tag anybody wrote. */
function tagShapeHtml(text, opts){
  /* Untagged is not a tag. It is where entries with none of them show up —
     a bucket, not a label anybody wrote — so it is not drawn as a label
     either; a tag shape around it said there was a tag called "Untagged"
     and invited the reader to look for it. */
  if(opts && opts.reserved) return `<span class="tag-bucket">${escapeHtml(text)}</span>`;
  /* A tag that acts says so with the eyelet itself: a hollow star where
     an ordinary tag has a ring. It used to say it with an asterisk after
     the name, which the owner asked to drop (20.11) — the hole a label
     hangs by is the one place on it that is not the words. The reason
     stays the label's tooltip. */
  const special = !!(opts && opts.special);
  const why = special && opts.why ? ` title="${escapeHtml(opts.why)}"` : '';
  /* The words in a span of their own, so a list too narrow for a long
     name can cut it short with an ellipsis rather than push the row's
     count and buttons off the panel. */
  return `<span class="tag-shape${special ? ' tag-shape-special' : ''}"${why}>${tagEyeHtml(special)}` +
         `<span class="tag-text">${escapeHtml(text)}</span></span>`;
}
/* The eyelet of a tag: a ring, or for a tag that acts a five-pointed
   star, hollow, in the same faint ink as the ring. One string
   for every place that draws a tag, so they cannot drift apart. */
function tagEyeHtml(special){
  if(!special) return '<i class="tag-eye"></i>';
  return '<i class="tag-eye tag-eye-star"><svg viewBox="0 0 10 10" aria-hidden="true">' +
         '<polygon points="5,0.8 6.12,3.86 9.37,3.98 6.81,5.99 7.7,9.12 5,7.3 2.3,9.12 3.19,5.99 0.63,3.98 3.88,3.86"/></svg></i>';
}
/* How far past the box the weave reaches. It has to clear the box by a
   good margin: the entry's own fill covers the middle of the patch, so
   everything you actually see of the weave is the band around it. */
const FANFIC_HALO = 38;
(function defineFanficWeave(){
  const p = el('pattern', {id:'fanfic-weave', width:13, height:13,
                           patternUnits:'userSpaceOnUse',
                           patternTransform:'rotate(45)'}, svgDefs);
  el('path', {d:'M0,0 H13 M0,0 V13', class:'fanfic-line'}, p);
  /* The same lattice, on the same grid, drawn as it looks under a light.
     A second pattern rather than a filter, so what sweeps across the weave
     is the weave itself rather than a wash of colour over it. */
  const lit = el('pattern', {id:'fanfic-weave-lit', width:13, height:13,
                             patternUnits:'userSpaceOnUse',
                             patternTransform:'rotate(45)'}, svgDefs);
  el('path', {d:'M0,0 H13 M0,0 V13', class:'fanfic-line fanfic-line-lit'}, lit);
  const grad = el('radialGradient', {id:'fanfic-fade'}, svgDefs);
  el('stop', {offset:'0%',   'stop-color':'#ffffff'}, grad);
  el('stop', {offset:'72%',  'stop-color':'#ffffff'}, grad);
  el('stop', {offset:'100%', 'stop-color':'#000000'}, grad);
  const mask = el('mask', {id:'fanfic-mask', maskContentUnits:'objectBoundingBox'}, svgDefs);
  el('rect', {x:0, y:0, width:1, height:1, fill:'url(#fanfic-fade)'}, mask);
  /* The unreleased ground: the same patch, the same fade, the same
     machinery — a different ruling. A close grid, square to the page,
     where fan-fiction is an open lattice laid over at forty-five degrees;
     and grey rather than gold, because nothing was made here by anybody.

     It began as a comb of verticals on the same thirteen-pixel grid, which
     read as bars with daylight between them rather than as a mesh, and
     was pale enough that the light crossing it had nothing to light: the
     sweep brightens the RULING, so a ruling you can barely see brightens
     into something you still cannot. Both directions and a darker ink gave
     the glint something to happen to.

     Half the weave's step was too fine a mesh: at the chart's usual zoom it
     closed into a grey tint rather than reading as a grid. It is on the
     weave's own thirteen now, so the two rulings are the same size and an
     entry carrying both tags stands on one lattice drawn two ways. */
  const UNRELEASED_STEP = 13;
  const up = el('pattern', {id:'unreleased-rule',
                            width:UNRELEASED_STEP, height:UNRELEASED_STEP,
                            patternUnits:'userSpaceOnUse'}, svgDefs);
  el('path', {d:`M0,0 H${UNRELEASED_STEP} M0,0 V${UNRELEASED_STEP}`,
              class:'unreleased-line'}, up);
  /* The light on it is a GLARE, not a colour. Where fan-fiction's gold
     lights up gold, the unreleased grey is washed out: a pale sheen over
     the cell and the ruling itself gone almost white, so what crosses the
     ground reads as a reflection on something cold and new rather than as
     a second, brighter paint. The motion is the weave's, exactly. */
  const upLit = el('pattern', {id:'unreleased-rule-lit',
                               width:UNRELEASED_STEP, height:UNRELEASED_STEP,
                               patternUnits:'userSpaceOnUse'}, svgDefs);
  el('rect', {x:0, y:0, width:UNRELEASED_STEP, height:UNRELEASED_STEP,
              class:'unreleased-sheen'}, upLit);
  el('path', {d:`M0,0 H${UNRELEASED_STEP} M0,0 V${UNRELEASED_STEP}`,
              class:'unreleased-line unreleased-line-lit'}, upLit);
})();

/* ---------------------------------------------------------------------
   The alignment grid.

   A ruled grid in the chart's own coordinates — the same GRID a drag snaps
   to — so it is a real reference for lining entries up rather than
   decoration. Every fifth line is drawn stronger, which is what makes it
   possible to count squares instead of merely seeing them.

   It lives in the chart's coordinate space, so it pans and zooms with the
   drawing and a line always falls exactly where an entry will snap. The
   line weights are re-divided by the zoom on every view change so they
   stay hairlines on screen at any magnification, and the fine grid steps
   aside for the coarse one once its lines would be too close together to
   tell apart.
   ------------------------------------------------------------------ */
const alignFine = el('path', {d:`M0,0 H${GRID} M0,0 V${GRID}`, class:'align-line'},
  el('pattern', {id:'align-grid', width:GRID, height:GRID, patternUnits:'userSpaceOnUse'}, svgDefs));
const alignMajor = el('path', {d:`M0,0 H${GRID*5} M0,0 V${GRID*5}`, class:'align-line align-line-major'},
  el('pattern', {id:'align-grid-major', width:GRID*5, height:GRID*5, patternUnits:'userSpaceOnUse'}, svgDefs));
/* The field the chart is drawn on, and the grid with it, in a layer of
   their own under everything: not in the drawing's ground, which a
   picture of the chart is measured and cut from. */
const fieldLayer = el('g', {id:'fieldLayer', style:'pointer-events:none;'}, viewport);
viewport.insertBefore(fieldLayer, viewport.firstChild);
const fieldRect = el('rect', {id:'chartField', class:'chart-field'}, fieldLayer);
const alignGrid = el('g', {id:'alignGrid', style:'display:none;pointer-events:none;'}, fieldLayer);
// Ruled on the field and nowhere else: syncField gives both rulings its box.
const alignGridFine = el('rect', {fill:'url(#align-grid)'}, alignGrid);
// Named by nothing on purpose: the call is what matters — it puts the
// coarse ruling into the grid group — and the element is never referred to
// again. A binding kept for symmetry with the fine one above is a binding
// that reads as "someone will need this", which nobody ever did.
el('rect', {fill:'url(#align-grid-major)'}, alignGrid);

const ALIGN_GRID_KEY = carryOverKey('axiomNexus.alignGrid', 'rhizome.alignGrid');
let alignGridOn = false;
try{ alignGridOn = localStorage.getItem(ALIGN_GRID_KEY) === '1'; }catch(e){}
// Deliberately `var`: applyTransform calls syncAlignGrid, and a `let` here
// would be unreachable — not merely false — if anything ever moved the view
// before this block ran.
var alignGridReady = true;
/* A drag used to switch the ruling on for its own duration when the grid
   was off. It is not a drag's to show: the button says the grid is off, and
   a canvas that suddenly fills with lines under the hand reads as the
   button having been pressed. The snap still happens; only the lines stay
   where the reader put them. */

// Called on every view change: keeps the ruling a hairline whatever the
// zoom, and drops the fine lines once they would read as a solid wash.
function syncAlignGrid(){
  if(!alignGridReady) return;
  const showing = alignGridOn;
  alignGrid.style.display = showing ? '' : 'none';
  if(!showing) return;
  const s = (typeof vs === 'number' && vs > 0) ? vs : 1;
  const fineVisible = s * GRID >= 5;
  alignGridFine.style.display = fineVisible ? '' : 'none';
  alignFine.style.strokeWidth = (0.55 / s).toFixed(3);
  alignMajor.style.strokeWidth = (0.95 / s).toFixed(3);
}
/* ---- The field: pages, as many as the chart needs ----------------------
 *
 * The chart is drawn on a field of pages, as a drawing in Visio is, rather
 * than on paper without an edge (the owner's list of 19.11). A page is
 * FIELD_PAGE_W by FIELD_PAGE_H, the first one centred on the origin, and
 * the field is the fewest whole pages, side by side, that hold every entry
 * with FIELD_MARGIN to spare. Carry an entry up to an edge and a page
 * more is laid on that side, the moment it is needed; take everything off
 * a page and it goes again. It is worked out from the entries each time,
 * so it is never kept and can never disagree with the chart.
 *
 * The grid is ruled on the field and nowhere else, and a pan or a zoom
 * keeps the middle of the view on it (keepFieldInView), so the chart
 * cannot be lost in the empty space round it. */
const FIELD_PAGE_W = 2000, FIELD_PAGE_H = 2000, FIELD_MARGIN = 40;
var chartField = null;
var fieldReady = false;
function fieldOf(carried){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  /* What a carry holds is asked where the carry has it: the model can be
     drawn again under a carry, and its entries then stand where the carry
     began until it is put down. */
  const held = new Map();
  ((carried && carried.members) || []).forEach(m=> m.node && held.set(m.id, m.node));
  nodes.forEach((n, id)=>{
    if(held.has(id)) n = held.get(id);
    if(!Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + (n.w || 0)); y1 = Math.max(y1, n.y + (n.h || 0));
  });
  /* A note pencilled in the margin is on the field too (44-ink.js). */
  const ink = Array.isArray(SETTINGS.ink) ? SETTINGS.ink : [];
  ink.forEach(s=>{
    const p = s && Array.isArray(s.pts) ? s.pts : [];
    for(let i = 0; i + 1 < p.length; i += 2){
      if(!Number.isFinite(p[i]) || !Number.isFinite(p[i + 1])) continue;
      x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
    }
  });
  if(!Number.isFinite(x0)){ x0 = x1 = 0; y0 = y1 = 0; }
  const W = FIELD_PAGE_W, H = FIELD_PAGE_H, m = FIELD_MARGIN;
  /* Pages stand edge to edge from the one centred on the origin, so page
     k runs from (k - ½) to (k + ½) of a page's width; the field is every
     page from the one the first entry's margin is on to the last's. */
  const i0 = Math.round((x0 - m) / W), i1 = Math.round((x1 + m) / W);
  const j0 = Math.round((y0 - m) / H), j1 = Math.round((y1 + m) / H);
  return {x0: (i0 - 0.5) * W, x1: (i1 + 0.5) * W, y0: (j0 - 0.5) * H, y1: (j1 + 0.5) * H};
}
function syncField(carried){
  if(!fieldReady) return;
  const f = fieldOf(carried);
  const was = chartField;
  chartField = f;
  syncBackdrop();
  if(was && was.x0 === f.x0 && was.x1 === f.x1 && was.y0 === f.y0 && was.y1 === f.y1) return;
  const box = {x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0};
  [fieldRect].concat([...alignGrid.querySelectorAll('rect')]).forEach(r=>
    Object.keys(box).forEach(k=> r.setAttribute(k, box[k])));
}
/* ---- The field's own ground: a colour, a picture ----------------------
 *
 * SETTINGS.background (the owner's list of 22.11, night): {color} paints
 * the field's pages in place of the paper, {image} lays a picture over
 * them — `fit` 'cover' fills the field with it, cut to its shape, and
 * 'tile' repeats it at its own size — and the grid is still ruled over
 * both. Part of the chart, so every reader sees it; in the chart's own
 * coordinates, so it pans and zooms with the drawing. A double line's
 * gap is the paper (.dbl-inner), so the colour is handed to the canvas
 * as --field too, and the gap takes it; over a picture it stays the
 * colour, as a gap has to be one colour. */
var backdropKey = null, backdropEl = null;
function syncBackdrop(){
  const f = chartField;
  const bg = SETTINGS.background && typeof SETTINGS.background === 'object' ? SETTINGS.background : {};
  const color = isHexColor(bg.color) ? bg.color : '';
  const image = typeof bg.image === 'string' && pictureSrcOk(bg.image) ? bg.image : '';
  const fit = bg.fit === 'tile' ? 'tile' : 'cover';
  const key = [color, image.length, image.slice(-64), fit, f ? [f.x0, f.y0, f.x1, f.y1].join(',') : ''].join('|');
  if(key === backdropKey) return;
  backdropKey = key;
  fieldRect.style.fill = color;
  if(color) svg.style.setProperty('--field', color); else svg.style.removeProperty('--field');
  if(!image || !f){
    if(backdropEl){ backdropEl.remove(); backdropEl = null; }
    const pat = document.getElementById('chart-backdrop-tile');
    if(pat) pat.remove();
    return;
  }
  const box = {x: f.x0, y: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0};
  const want = fit === 'tile' ? 'rect' : 'image';
  if(!backdropEl || backdropEl.tagName !== want){
    if(backdropEl) backdropEl.remove();
    backdropEl = el(want, {id: 'chartBackdrop', class: 'chart-backdrop'}, fieldLayer);
    fieldRect.after(backdropEl);
  }
  Object.keys(box).forEach(k=> backdropEl.setAttribute(k, box[k]));
  if(fit === 'cover'){
    backdropEl.setAttribute('href', image);
    backdropEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const pat = document.getElementById('chart-backdrop-tile');
    if(pat) pat.remove();
    return;
  }
  /* Repeated at the picture's own size, one pixel to a unit, from the
     origin, so it does not slide as pages are laid on or taken off. */
  let pat = document.getElementById('chart-backdrop-tile');
  if(!pat){
    pat = el('pattern', {id: 'chart-backdrop-tile', patternUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1, height: 1}, svgDefs);
    el('image', {x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: 'none'}, pat);
  }
  const img = pat.firstChild;
  img.setAttribute('href', image);
  backdropEl.setAttribute('fill', 'url(#chart-backdrop-tile)');
  const probe = new Image();
  probe.onload = ()=>{
    if(img.getAttribute('href') !== image) return;
    const w = probe.naturalWidth || 1, h = probe.naturalHeight || 1;
    [pat, img].forEach(n=>{ n.setAttribute('width', w); n.setAttribute('height', h); });
  };
  probe.src = image;
}
/* The middle of the view stays on the field. Asked by the hand's moves —
   a pan, the wheel, a pinch — and not by a view set in so many words (a
   link to an entry, the overview), which always lands on the chart. */
function viewOnField(){
  if(!chartField) return false;
  const r = svg.getBoundingClientRect();
  const cx = (r.width / 2 - vx) / vs, cy = (r.height / 2 - vy) / vs;
  return cx >= chartField.x0 - 0.5 && cx <= chartField.x1 + 0.5 && cy >= chartField.y0 - 0.5 && cy <= chartField.y1 + 0.5;
}
/* A view already off the field (one set in so many words) is not pulled
   back with a jump: the hand may bring it nearer, never further. */
function keepFieldInView(wasX, wasY){
  if(!chartField) return;
  const r = svg.getBoundingClientRect();
  const W = r.width || 0, H = r.height || 0;
  const f = chartField;
  const hold = (v, lo, hi, was)=>{
    if(Number.isFinite(was)){ lo = Math.min(lo, was); hi = Math.max(hi, was); }
    return Math.min(hi, Math.max(lo, v));
  };
  vx = hold(vx, W / 2 - f.x1 * vs, W / 2 - f.x0 * vs, wasX);
  vy = hold(vy, H / 2 - f.y1 * vs, H / 2 - f.y0 * vs, wasY);
}
fieldReady = true;
syncField();

function setAlignGrid(on){
  alignGridOn = !!on;
  try{ localStorage.setItem(ALIGN_GRID_KEY, alignGridOn ? '1' : '0'); }catch(e){}
  const btn = document.getElementById('gridToggle');
  if(btn) btn.classList.toggle('active', alignGridOn);
  syncAlignGrid();
}
function hexLuminance(hex){
  const c = String(hex).replace('#','');
  const full = c.length===3 ? c.split('').map(ch=>ch+ch).join('') : c.padEnd(6,'0').slice(0,6);
  const r = parseInt(full.slice(0,2),16)||0, g = parseInt(full.slice(2,4),16)||0, b = parseInt(full.slice(4,6),16)||0;
  return (0.299*r + 0.587*g + 0.114*b)/255;
}
function contrastTextColor(hex){
  return hexLuminance(hex) > 0.55 ? '#141c2b' : '#ffffff';
}
/* The colour asked for, unless it would be lost against the ground it is
   written on — in which case the plain contrasting ink. Only real hex
   values are judged: a gradient reference or a CSS variable is left alone,
   since there is no one colour to compare. */
function readableOn(want, bg){
  if(typeof want !== 'string' || typeof bg !== 'string') return want;
  if(want.charAt(0) !== '#' || bg.charAt(0) !== '#') return want;
  return Math.abs(hexLuminance(want) - hexLuminance(bg)) < 0.3
    ? contrastTextColor(bg) : want;
}
let gradientSeq = 0;
function makeGradient(colors, vertical, target){
  const id = 'grad-' + (gradientSeq++);
  const dir = vertical ? {x1:'0%', y1:'0%', x2:'0%', y2:'100%'} : {x1:'0%', y1:'0%', x2:'100%', y2:'0%'};
  const grad = el('linearGradient', {id, ...dir}, target || svgDefs);
  const n = colors.length;
  colors.forEach((c,i)=>{
    el('stop', {offset: `${n>1 ? (i/(n-1))*100 : 0}%`, 'stop-color': c}, grad);
  });
  return `url(#${id})`;
}
// Arrowheads are drawn as ordinary paths, on the layer their ring calls
// for (see drawArrowHead and arrowLayerFor), not as SVG <marker>s: a marker draws in
// its own tiny coordinate box, which both broke gradient continuity and
// pinned the head to its line's stacking position.
/* ---------------------------------------------------------------------
   A connector painted with a gradient rather than one flat colour.

   The line's gradient runs along the path's own bounding box, so it reads
   as travelling from source to target. It is rebuilt with every redraw
   of the connectors, which is why it lives in edgeDefs.
   ------------------------------------------------------------------ */
let edgeGradSeq = 0;
function makeEdgeGradient(colors, pts){
  const id = 'edgegrad-' + (edgeGradSeq++);
  const list = colors.length >= 2 ? colors : [colors[0], colors[0]];
  // Along the straight line between the connector's two ends, in user
  // space, so the sweep follows the direction of travel rather than the
  // arbitrary orientation of a bounding box.
  const a = pts[0], b = pts[pts.length-1];
  const grad = el('linearGradient', {
    id, gradientUnits:'userSpaceOnUse',
    x1:a.x, y1:a.y, x2:b.x, y2:b.y
  }, edgeDefs);
  list.forEach((c,i)=>{
    el('stop', {offset:`${(i/(list.length-1))*100}%`, 'stop-color':c}, grad);
  });
  return `url(#${id})`;
}
/* A gradient connector cannot use markers for its arrowheads. A marker's
   contents are drawn in the marker's own tiny coordinate system, so a
   gradient inside it is a separate sweep that restarts at the arrow —
   which is exactly the seam that made the head look bolted on rather than
   part of the line. Drawing the heads as ordinary paths in the same user
   space as the connector lets them share the one gradient, so the colour
   runs continuously from the tail through the tip. */
const ARROW_LEN = 9.5, ARROW_HALF = 4.2;
/* The head's three corners are worked out in ABSOLUTE chart coordinates
   rather than drawn in a little rotated coordinate system of their own.
   That matters for a gradient connector: a userSpaceOnUse gradient is
   resolved in the local space of whatever references it, so a translated,
   rotated group dragged the gradient along with it — the tail ran the
   right way and each head sampled the sweep from a different, wrong place.
   With the corners already absolute there is no local space to distort,
   and one gradient covers the line and both heads seamlessly. */
