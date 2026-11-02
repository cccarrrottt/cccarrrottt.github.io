/* ---------------------------------------------------------------------
   Making an entry — the round + in the corner of the chart.
 *
 * It used to be a form: a toolbar button opened a popover with a label,
 * a style, a background, a border, corners, a portrait, tags and border
 * colours, and an Add at the bottom. Every one of those is set on the
 * entry itself once it exists, on the style bar and in its settings, so
 * the form asked for each thing twice and the chart waited behind it.
 *
 * Now pointing at the + stands the styles up above it, and picking one
 * puts that entry on the chart at once, on the clear ground nearest the
 * middle of the view, selected, and — if it holds words — with the caret
 * already in it. On a touch screen, where nothing is pointed at, a tap
 * on the + does what pointing would.
   ------------------------------------------------------------------ */
const NODE_STYLE_PICKS = [
  {value:'rect',    label:'Default',       hint:'An ordinary entry: a box with its name in it.'},
  {value:'ellipse', label:'Character',     hint:'A portrait circle, with its words on a card beside it.'},
  {value:'link',    label:'Link',          hint:'A small circle that goes to another entry on a double press — to join two entries far apart.'},
  {value:'textbox', label:'Text field',    hint:'A loose line of text on the chart — no connections.'},
  {value:'image',   label:'Image',         hint:'A picture placed on the chart — no connections.'}
  /* Array stood here too, greyed until two entries were picked. It is not
     a new entry but a frame round picked ones, so it lives where the
     picked ones are acted on: the menu a right click or a long press opens
     over them, beside Cut and Copy, and Ctrl+G (the owner's ask, 22.10). */
];
function nodeStyleIcon(kind){
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 40 30');
  svg.setAttribute('class', 'node-style-icon');
  const add = (tag, attrs)=>{
    const e = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k,v])=> e.setAttribute(k, v));
    svg.appendChild(e);
    return e;
  };
  const box = (y, h)=> add('rect', {x:6, y, width:28, height:h, class:'nsi-box'});
  if(kind === 'rect'){
    box(8, 14);
  } else if(kind === 'ellipse'){
    add('circle', {cx:20, cy:15, r:10, class:'nsi-box'});
    add('circle', {cx:20, cy:12, r:3.1, class:'nsi-mark'});
    add('path', {d:'M14.4,22.6 a5.6,5 0 0 1 11.2,0', class:'nsi-mark'});
  } else if(kind === 'link'){
    add('circle', {cx:20, cy:15, r:6.5, class:'nsi-box'});
    add('path', {d:'M17.4,17.6 L22.4,12.6 M18.8,12.6 H22.4 V16.2', class:'nsi-mark'});
  } else if(kind === 'textbox'){
    box(8, 14);
    add('path', {d:'M15,12 H25 M20,12 V19', class:'nsi-mark'});
  } else {
    box(8, 14);
    add('path', {d:'M9,20 L15,14 L19,17.5 L23,13.5 L31,20 Z', class:'nsi-fill-soft'});
    add('circle', {cx:14, cy:12, r:1.9, class:'nsi-fill-soft'});
  }
  return svg;
}
const addFab = document.getElementById('addFab');
const addFabBtn = document.getElementById('addFabBtn');
const addFabStyles = document.getElementById('addFabStyles');
NODE_STYLE_PICKS.forEach(p=>{
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'node-style-btn';
  b.dataset.value = p.value;
  b.setAttribute('role', 'menuitem');
  b.title = p.label + ' — ' + p.hint;
  b.appendChild(nodeStyleIcon(p.value));
  const cap = document.createElement('span');
  cap.className = 'node-style-cap';
  cap.textContent = p.label;
  b.appendChild(cap);
  b.addEventListener('click', ev=>{
    ev.stopPropagation();
    closeAddFab();
    addEntryOfStyle(p.value);
  });
  addFabStyles.appendChild(b);
});
function openAddFab(){
  if(readOnlyView) return;
  addFab.classList.add('open');
  addFabBtn.setAttribute('aria-expanded', 'true');
}
/* Whether it was open, so Escape knows it had something to put away. */
function closeAddFab(){
  const was = addFab.classList.contains('open');
  addFab.classList.remove('open', 'figures');
  addFabBtn.setAttribute('aria-expanded', 'false');
  return was;
}
/* Pointing opens it and leaving the button AND the styles above it shuts
   it, so the pointer can travel up from one to the other. Asked of the
   POINTER, not of the page's finger mode: a tap also sends the mouse
   events a mouse would, entering included, and read as a mouse that
   opened the menu just before the tap's own click shut it again. A tap
   toggles; a click with a mouse only ever opens, the pointing having
   already done so. */
let addFabTouched = false;
addFab.addEventListener('pointerenter', ev=>{ if(ev.pointerType === 'mouse') openAddFab(); });
addFab.addEventListener('pointerleave', ev=>{ if(ev.pointerType === 'mouse') closeAddFab(); });
addFabBtn.addEventListener('pointerdown', ev=>{ addFabTouched = ev.pointerType !== 'mouse'; });
addFabBtn.addEventListener('click', ev=>{
  ev.stopPropagation();
  if(addFabTouched && addFab.classList.contains('open')) closeAddFab();
  else openAddFab();
});
addFab.addEventListener('mousedown', ev=> ev.stopPropagation());
document.addEventListener('mousedown', ev=>{
  if(!addFab.contains(ev.target)) closeAddFab();
});
/* One new entry of the given style, empty, on the clear ground nearest the
   middle of what is on show. An entry with nothing in it is a perfectly
   good entry — a placeholder, a spacer, a box that will hold a picture —
   and it is one grid step square until something is written in it. */
function addEntryOfStyle(style){
  if(readOnlyView) return null;
  const shapeVal = style === 'rect' ? undefined : style;
  const id = uniqueId(slugify(''), new Set(workingNodes.map(it=> it[0])));
  const spot = emptySpotNearCentre(shapeVal);
  applyEdit(()=> workingNodes.push([id, '', undefined, undefined, undefined, shapeVal,
                                    {pos: [spot.x, spot.y]}]));
  selectNode(id);
  /* Words go in where they will stand. A portrait and a picture have a
     picture to choose before anything else, which their settings ask for;
     a link has where it goes, which its bar asks for. */
  if(style === 'link') askWhereLinkGoes(id);
  else if(style !== 'ellipse' && style !== 'image') openNodeEditor(id);
  return id;
}

function slugify(label){
  let base = stripMarkup(label).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if(!base) base = 'node';
  return base;
}
function uniqueId(base, existingIds){
  let id = base, n = 2;
  while(existingIds.has(id)){ id = base + '-' + n; n++; }
  return id;
}

// ---- copy / cut / paste ------------------------------------------------
// Snapshots the selected node's own content and styling — everything except
// its identity and its connections — into the cross-reload clipboard.
// Everything worth carrying about one entry, without its position.
/* Everything the entry HAS — its stored options, read from the chart's own
 * record, not from the drawn entry.
 *
   It used to be a list of fields picked off the drawn entry, and a list is
   what goes stale: a background, a border style, a portrait's card, a
   card's middle line, a callout's shelf and its snap were none of them on
   it, so a copy came back plainer than what was copied. And the drawn
   entry carries colours it only wears — its tags' — which the list copied
   as colours of its own, so the copy stopped following its tags. The
   record says exactly what was chosen, and only that. */
function clipOfNode(n){
  const found = workingEntry(n.id);
  let opts = {};
  try{ opts = found ? JSON.parse(JSON.stringify(entryOpts(found.entry))) : {}; }catch(e){ opts = {}; }
  // Where it stood is carried beside it (x, y), not as its own place.
  delete opts.pos;
  // An array is as big as what it holds.
  if(isArrayNode(n)) delete opts.size;
  return {
    id: n.id,
    label: found ? (found.entry[1] || '') : n.label,
    note: (found ? found.entry[4] : n.note) || null,
    shape: (found ? found.entry[5] : n.shape) || null,
    opts,
    // Where it sat, so a group of entries keeps its own arrangement when
    // it is put down somewhere else.
    x: n.x, y: n.y
  };
}
/* Copy takes the WHOLE selection.
 *
 * It used to take the primary entry and nothing else, so lassoing a dozen
 * entries and pressing copy quietly copied one of them — the gesture said
 * "these" and the clipboard heard "that one". A group is stored as a list
 * plus the connections BETWEEN its members, so what comes back is the
 * arrangement, not a heap of unrelated boxes. */
function copySelectedNode(){
  /* An array is copied with what it holds; without them it would come
     back as a frame round nothing. */
  const ids = withArrayMembers((multiSelection.size > 1)
    ? Array.from(multiSelection).filter(id=> nodes.has(id))
    : (selectedId && nodes.has(selectedId) ? [selectedId] : []));
  if(!ids.length) return false;
  const inSet = new Set(ids);
  const items = ids.map(id=> clipOfNode(nodes.get(id)));
  // Only the links whose BOTH ends are being copied travel with them.
  const links = [];
  ids.forEach(id=>{
    (nodes.get(id).parents || []).forEach(pid=>{
      if(inSet.has(pid)) links.push([pid, id]);
    });
  });
  const head = items[0];
  writeClipboard(Object.assign({}, head, {items, links}));
  return true;
}

function cutSelectedNode(){
  /* Copy takes the whole selection, so cut has to remove the whole
     selection. It removed the primary entry only, which meant a lasso of
     twelve followed by Ctrl+X put twelve on the clipboard, took one off the
     chart, and left the reader believing eleven had been cut. */
  const ids = withArrayMembers((multiSelection.size > 1)
    ? Array.from(multiSelection).filter(id=> nodes.has(id))
    : (selectedId && nodes.has(selectedId) ? [selectedId] : []));
  if(!ids.length) return;
  if(!copySelectedNode()) return;
  if(ids.length > 1) deleteNodes(ids);
  else deleteNode(ids[0]);
}

function pasteClipboardNode(){
  const clip = readClipboard();
  /* A picture element legitimately has no label, so testing for one
     refused a perfectly good clipboard: copy an image, paste, and the page
     said there was nothing to paste while holding it. */
  const hasSomething = clip && (clip.label || clip.id ||
    (Array.isArray(clip.items) && clip.items.length));
  if(!hasSomething){ setSaveState('ok', 'Nothing on the clipboard'); setTimeout(refreshSaveUI, 1400); return; }
  const items = (Array.isArray(clip.items) && clip.items.length) ? clip.items : [clip];
  const links = Array.isArray(clip.links) ? clip.links : [];
  const existingIds = new Set(workingNodes.map(it=>it[0]));
  /* A copy lands in the middle of what is on screen — always, wherever the
     entries it was copied from happen to be. Pasting beside the originals
     is only ever right while you are still looking at them, and the reader
     who pans across the chart and pastes is not: they are looking at where
     they want the copy. A group keeps its own arrangement: the spot places
     the group's top-left corner, and everything else keeps its offset from
     it. viewCentreSpot steps aside from anything already sitting there, so
     a run of pastes cascades rather than stacking. */
  const home = viewCentreSpot(items[0].shape || 'rect');
  const originX = Math.min(...items.map(it=> typeof it.x === 'number' ? it.x : 0));
  const originY = Math.min(...items.map(it=> typeof it.y === 'number' ? it.y : 0));
  const idMap = new Map();
  const made = [];
  applyEdit(()=>{
    items.forEach(it=>{
      const opts = Object.assign({}, it.opts || {});
      opts.pos = [ snapToGrid(home.x + ((it.x || 0) - originX)),
                   snapToGrid(home.y + ((it.y || 0) - originY)) ];
      const newId = uniqueId((it.shape === 'array' ? 'array' : slugify(it.label)) + '-copy', existingIds);
      existingIds.add(newId);
      idMap.set(it.id || it.label, newId);
      made.push(newId);
      if(it.shape === 'array') delete opts.pos;
      workingNodes.push([newId, it.label, undefined, undefined, it.note || undefined,
                         it.shape || undefined, Object.keys(opts).length ? opts : undefined]);
    });
    /* An array's members are pointed at the copies made with it; one whose
       members did not come along goes back off the chart. */
    for(let i = workingNodes.length - 1; i >= 0; i--){
      const entry = workingNodes[i];
      if(!made.includes(entry[0]) || entry[5] !== 'array') continue;
      const ms = arrayMembersOf(entry[6]).map(id=> idMap.get(id)).filter(Boolean);
      if(ms.length) entry[6].members = ms;
      else { workingNodes.splice(i, 1); made.splice(made.indexOf(entry[0]), 1); }
    }
    // The connections INSIDE the group come with it, pointing at the copies.
    links.forEach(([from, to])=>{
      const f = idMap.get(from), t = idMap.get(to);
      if(!f || !t) return;
      const entry = workingNodes.find(x=> x[0] === t);
      if(!entry) return;
      const parents = resolveExplicitParents(entry);
      if(parents.includes(f)) return;
      parents.push(f);
      entry[2] = parents.length === 1 ? parents[0] : parents;
    });
    /* And a merge that names its lineages names the copies, as an array
       does its members; one left naming fewer than two is no merge. */
    workingNodes.forEach(entry=>{
      if(!made.includes(entry[0]) || !entry[6] || !Array.isArray(entry[6].merge)) return;
      const ms = entry[6].merge.map(id=> idMap.get(id)).filter(Boolean);
      if(ms.length >= 2) entry[6].merge = ms; else delete entry[6].merge;
    });
  });
  // Each paste starts from where the group was PUT, so a run of them walks
  // across the chart instead of landing on top of itself.
  writeClipboard(Object.assign({}, clip, {
    x: home.x, y: home.y,
    items: items.map(it=> Object.assign({}, it, {
      x: home.x + ((it.x || 0) - originX),
      y: home.y + ((it.y || 0) - originY)
    }))
  }));
  if(made.length > 1) setSelection(made, made[0]);
  else if(made.length) selectNode(made[0]);
}
/* Where a brand-new entry should land: the middle of whatever the reader is
   currently looking at. The chart's origin is often far off screen after any
   amount of panning, so dropping a new box there means it appears to have
   gone nowhere. This reads the visible rectangle of the canvas, converts its
   centre back into chart coordinates, offsets by half the box so the box —
   not its corner — is centred, and snaps to the grid like a drag would. If
   something is already sitting there, it steps down and right until it finds
   clear ground, so two entries made in a row don't stack. */
/* The part of the canvas a reader can actually see. The panels are drawn
   OVER the canvas rather than beside it, so the canvas's own rectangle
   runs on underneath them — and an entry placed at the middle of that
   rectangle lands half-hidden behind whichever panel is open. */
function visibleCanvasRect(){
  const rect = svg.getBoundingClientRect();
  let left = rect.left, right = rect.right;
  /* A panel counts as covering its side of the canvas if it sits anywhere
     in the outer part of it — not only when it is flush against the edge.
     Both of these are inset by a margin, so testing for flushness found
     neither of them and the entry went on landing underneath them. */
  const edgeBand = rect.width * 0.4;
  const panel = document.getElementById('detail');
  if(panel && getComputedStyle(panel).display !== 'none'){
    const p = panel.getBoundingClientRect();
    if(p.width && p.right > right - edgeBand) right = Math.min(right, p.left);
  }
  /* The tabs at the left edge, open or shut: a shut one is a strip, and
     an open one is a panel — either way the chart under it is not on show. */
  /* Asked of the tabs and the open page, not of the sections that hold
     them: those are only a grouping now, and draw no box of their own. */
  document.querySelectorAll('.side-tab-handle, .side-tab.open .side-tab-body').forEach(tab=>{
    const p = tab.getBoundingClientRect();
    if(p.width && p.left < left + edgeBand) left = Math.max(left, p.right);
  });
  if(right - left < 120){ left = rect.left; right = rect.right; }
  return {left, right, top: rect.top, bottom: rect.bottom,
          width: right - left, height: rect.height};
}
/* Where a new, empty entry of this style goes: of the grid points round
   the middle of what is on show, the nearest one where its box touches
   nothing already drawn. Nearest by straight distance, so it is the free
   ground closest to the middle in every direction rather than the first
   gap down one diagonal.
 *
   Answered for the box as it will be DRAWN and handed back as the
   position that draws it there: a box that closes on its words stores
   the middle of a one-line entry, and an empty one is shorter than that,
   so the two differ by half the difference. */
function emptySpotNearCentre(shapeVal){
  const w = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_W : GRID;
  const h = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_H : GRID;
  const dy = (shapeVal==='ellipse' || shapeVal==='link' || shapeVal==='image') ? 0 : round2((h - NODE_GROW_REF) / 2);
  const rect = visibleCanvasRect();
  const c = clientToWorld(rect.left + rect.width/2, rect.top + rect.height/2);
  const ox = snapToGrid(c.x - w/2), oy = snapToGrid(c.y - h/2);
  const pad = GRID / 2;
  // Inside an array is open ground: the frame is round the entries, not one.
  const taken = [...nodes.values()].filter(n=> !isArrayNode(n))
    .map(n=>({x:n.x - pad, y:n.y - pad, r:n.x + n.w + pad, b:n.y + n.h + pad}));
  const free = (x, y)=> !taken.some(t=> x < t.r && x + w > t.x && y < t.b && y + h > t.y);
  /* Ring by ring outwards, and on past the first ring with room only as
     far as a point could still be nearer — a square ring's corners lie
     further out than the middle of the next ring's sides. Ties go to the
     point higher up, then further left: a fixed order, so the same chart
     always answers the same. */
  let best = null;
  for(let ring = 0; ring <= 80; ring++){
    if(best && ring * ring > best.d) break;
    for(let j = -ring; j <= ring; j++){
      for(let i = -ring; i <= ring; i++){
        if(Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const d = i*i + j*j;
        if(best && (d > best.d || (d === best.d && (j > best.j || (j === best.j && i > best.i))))) continue;
        const x = snapToGrid(ox + i*GRID), y = snapToGrid(oy + j*GRID);
        if(free(x, y)) best = {x, y, d, i, j};
      }
    }
  }
  if(best) return {x: best.x, y: round2(best.y + dy)};
  return {x: ox, y: round2(oy + dy)};
}
// Where a paste lands: the middle of what is on show, clear of what is there.
function viewCentreSpot(shapeVal){
  const rect = visibleCanvasRect();
  const w = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_W : 120;
  const h = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_H : NODE_MINH;
  const c = clientToWorld(rect.left + rect.width/2, rect.top + rect.height/2);
  let x = snapToGrid(c.x - w/2), y = snapToGrid(c.y - h/2);
  const taken = [...nodes.values()].filter(n=> !isArrayNode(n)).map(n=>({x:n.x, y:n.y, w:n.w, h:n.h}));
  const clash = (px,py)=> taken.some(t=> px < t.x + t.w + 6 && px + w + 6 > t.x &&
                                         py < t.y + t.h + 6 && py + h + 6 > t.y);
  for(let i=0; i<40 && clash(x,y); i++){ x += GRID; y += GRID; }
  return {x, y};
}


/* ---------------------------------------------------------------------
   Flowchart figures (the owner's list of 3.11).

   Beside Default in the + menu stands a button that opens the figures a
   flowchart is drawn with — a decision's diamond, a terminator's pill,
   data's parallelogram and the rest — and the chart's own templates, read
   from an SVG file. A figure is a LOOK of an ordinary entry, the way a
   border style is: the entry keeps everything an entry has, its words,
   its connectors, its tags, and is drawn as that outline instead of a box.

   One description per figure serves everything that asks: the outline the
   drawing strokes (figureLayout), how big the box must be for the words
   to stand inside the outline (figureFit), and where the outline stands
   for a connector's port (figureProfile, through borderProfileOf). The
   words close on their ink as an entry's do; the figure is what is round
   that, so a diamond is twice its words each way, which is what makes a
   rectangle of words fit inside one.

   A template is kept as the outline's points, scaled into a hundred-unit
   square — numbers and nothing else, so nothing a file brought in can run
   when the page draws it. The chart keeps the ones it was given in
   SETTINGS.figures, so the menu offers them again; an entry that wears one
   carries its own copy, so taking a template out of the menu, or copying
   the entry into another chart, leaves the entry looking as it did.
   ------------------------------------------------------------------ */
function figurePicks(){
  return [
    {value:'process',     label:'Process'},
    {value:'decision',    label:'Decision'},
    {value:'terminator',  label:'Start / end'},
    {value:'data',        label:'Data'},
    {value:'predefined',  label:'Subroutine'},
    {value:'document',    label:'Document'},
    {value:'database',    label:'Database'},
    {value:'manualInput', label:'Manual input'},
    {value:'manualOp',    label:'Manual step'},
    {value:'preparation', label:'Preparation'},
    {value:'delay',       label:'Delay'},
    {value:'display',     label:'Display'},
    {value:'storedData',  label:'Stored data'},
    {value:'connector',   label:'Connector'},
    {value:'offPage',     label:'Off-page'},
    {value:'extract',     label:'Extract'},
    {value:'merge',       label:'Merge'}
  ];
}
function isBuiltinFigure(v){ return typeof v === 'string' && figurePicks().some(p=> p.value === v); }
/* A template's outline as the file stores it: one or more closed runs of
   points, "M x y L x y … Z", every number between 0 and 100. The first run
   is the outline; any after it are lines drawn inside (a subroutine's
   bars, a cylinder's lip). Anything else is not a template. */
function parseFigurePath(d){
  if(typeof d !== 'string' || d.length > 20000) return null;
  const runs = [];
  const re = /([MLZ])([^MLZ]*)/g;
  let m, cur = null;
  while((m = re.exec(d))){
    const nums = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if(nums.some(v=> !Number.isFinite(v) || v < -0.001 || v > 100.001)) return null;
    if(m[1] === 'M'){ cur = []; runs.push(cur); }
    else if(m[1] === 'Z'){ cur = null; continue; }
    if(!cur || nums.length % 2) return null;
    for(let i = 0; i < nums.length; i += 2) cur.push({x: nums[i] / 100, y: nums[i+1] / 100});
  }
  if(!runs.length || runs[0].length < 3) return null;
  return runs.filter(r=> r.length >= 2);
}
/* A template's proportion, width over height, as the drawing it was read
   from had it. The outline is kept in a hundred-unit SQUARE, so without
   it a tall bottle drawn into a wide entry came out a squashed one (the
   owner's list of 2.11). Templates brought in before it was kept have
   none, and are drawn as they always were. */
function figureAspectOf(v){
  const a = +v;
  return Number.isFinite(a) && a >= 0.05 && a <= 20 ? Math.round(a * 1000) / 1000 : 0;
}
/* What an entry's `figure` says it is: a figure's name, or a template
   ({name, d}) with its outline read once here. Only an ordinary box takes
   one — a portrait, a picture, a caption, a callout or an array has a shape
   of its own. */
function figureOf(v, shape){
  if(shape && shape !== 'rect') return null;
  if(isBuiltinFigure(v)) return v;
  if(v && typeof v === 'object' && !Array.isArray(v)){
    const runs = parseFigurePath(v.d);
    if(runs) return {name: typeof v.name === 'string' ? v.name : 'Template', d: v.d, runs, ar: figureAspectOf(v.ar)};
  }
  return null;
}
/* The figure this entry is drawn as, if any. A card has bands to divide
   and a merge wears its lineages round a box, so both stay boxes. */
function nodeFigure(n){
  if(!n || !n.figure || n.card) return null;
  if(mergePainted(n)) return null;
  return n.figure;
}
function figureArc(cx, cy, rx, ry, a0, a1, steps){
  const out = [];
  const k = steps || 16;
  for(let i = 0; i <= k; i++){
    const a = a0 + (a1 - a0) * i / k;
    out.push({x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a)});
  }
  return out;
}
/* How far in from the side a curved end has to stand the words, for words
   `ih` tall in a figure `H` tall whose end is a half-ellipse `rx` across. */
function curvedEndInset(rx, H, ih){
  const t = Math.min(1, ih / H);
  return rx * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
}
/* How deep the words of a figure with curved ends are, against its height:
   the curve needs room above and below the words to come round. A
   function, not a constant: the first drawing asks it before this part
   has run. */
function figureCurveH(){ return 1.3; }
/* The outline, any lines inside it, and where the words are centred, for a
   figure W by H standing at the origin. */
function figureLayout(fig, W, H){
  const P = (x, y)=> ({x, y});
  const PI = Math.PI;
  let outline, marks = [], cx = W/2, cy = H/2;
  switch(fig){
    case 'decision':
      outline = [P(W/2,0), P(W,H/2), P(W/2,H), P(0,H/2)]; break;
    case 'terminator': {
      const r = Math.min(H/2, W/2);
      outline = [...figureArc(W - r, H/2, r, H/2, -PI/2, PI/2), ...figureArc(r, H/2, r, H/2, PI/2, 3*PI/2)];
      break;
    }
    case 'data': {
      const s = Math.min(H * 0.35, W / 3);
      outline = [P(s,0), P(W,0), P(W - s,H), P(0,H)]; break;
    }
    case 'predefined': {
      const d = Math.min(Math.max(4, H * 0.35), W / 5);
      outline = [P(0,0), P(W,0), P(W,H), P(0,H)];
      marks = [[P(d,0), P(d,H)], [P(W - d,0), P(W - d,H)]];
      break;
    }
    case 'document': {
      const a = H * 0.07;
      const wave = [];
      for(let i = 24; i >= 0; i--){ const x = W * i / 24; wave.push(P(x, H - a + a * Math.sin(2 * PI * i / 24))); }
      outline = [P(0,0), P(W,0), ...wave];
      cy = (H - 2*a) / 2;
      break;
    }
    case 'database': {
      const ry = Math.min(Math.max(3, H * 0.12), H / 4);
      outline = [...figureArc(W/2, H - ry, W/2, ry, PI, 0), ...figureArc(W/2, ry, W/2, ry, 0, -PI)];
      marks = [figureArc(W/2, ry, W/2, ry, PI, 0)];
      cy = (2*ry + H - ry) / 2;
      break;
    }
    case 'manualInput': {
      const t = H * 0.28;
      outline = [P(0,t), P(W,0), P(W,H), P(0,H)];
      cy = (t + H) / 2;
      break;
    }
    case 'manualOp': {
      const d = Math.min(H * 0.3, W / 3);
      outline = [P(0,0), P(W,0), P(W - d,H), P(d,H)]; break;
    }
    case 'preparation': {
      const d = Math.min(H * 0.3, W / 3);
      outline = [P(d,0), P(W - d,0), P(W,H/2), P(W - d,H), P(d,H), P(0,H/2)]; break;
    }
    case 'delay': {
      const r = Math.min(H/2, W);
      outline = [P(0,0), ...figureArc(W - r, H/2, r, H/2, -PI/2, PI/2), P(0,H)];
      cx = (W - curvedEndInset(r, H, H / figureCurveH())) / 2;
      break;
    }
    case 'display': {
      const d = Math.min(H * 0.3, W / 3), rx = Math.min(H * 0.3, W / 3);
      outline = [P(0,H/2), P(d,0), ...figureArc(W - rx, H/2, rx, H/2, -PI/2, PI/2), P(d,H)];
      const ih = H / figureCurveH();
      cx = (d * ih / H + W - curvedEndInset(rx, H, ih)) / 2;
      break;
    }
    case 'storedData': {
      const d = Math.min(H * 0.25, W / 3);
      /* The right side cut in, the left bowed out: a drum seen side on. */
      const cut = [];
      for(let i = 0; i <= 16; i++){
        const a = -PI/2 + PI * i / 16;
        cut.push(P(W - d * Math.cos(a), H/2 + H/2 * Math.sin(a)));
      }
      outline = [P(d,0), ...cut, P(d,H), ...figureArc(d, H/2, d, H/2, PI/2, 3*PI/2)];
      const ih = H / 1.2;
      cx = (curvedEndInset(d, H, ih) + W - d - 2) / 2;
      break;
    }
    case 'connector':
      outline = figureArc(W/2, H/2, W/2, H/2, 0, 2*PI, 40).slice(0, -1); break;
    case 'offPage': {
      const p = H * 0.3;
      outline = [P(0,0), P(W,0), P(W,H - p), P(W/2,H), P(0,H - p)];
      cy = (H - p) / 2;
      break;
    }
    case 'extract':
      outline = [P(W/2,0), P(W,H), P(0,H)]; cy = H * 0.72; break;
    case 'merge':
      outline = [P(0,0), P(W,0), P(W/2,H)]; cy = H * 0.28; break;
    case 'process':
      outline = [P(0,0), P(W,0), P(W,H), P(0,H)]; break;
    default: {
      if(fig && fig.runs){
        const sc = (r)=> r.map(p=> P(p.x * W, p.y * H));
        outline = sc(fig.runs[0]);
        marks = fig.runs.slice(1).map(sc);
      } else outline = [P(0,0), P(W,0), P(W,H), P(0,H)];
    }
  }
  return {outline, marks, cx, cy};
}
/* The box a figure needs round words whose ink, with the entry's inset
   round it, is iw by ih. */
function figureFit(fig, iw, ih){
  switch(fig){
    case 'decision':    return {w: iw * 2, h: ih * 2};
    case 'terminator': {
      const H = ih * figureCurveH();
      return {w: Math.max(H, iw + 2 * curvedEndInset(H/2, H, ih)), h: H};
    }
    case 'data': case 'manualOp': case 'preparation': {
      const k = fig === 'data' ? 0.35 : 0.3;
      return {w: iw + 2 * k * ih, h: ih};
    }
    /* The words stand clear of a bar as they do of a border: the bar is
       a line of the figure, and the inset is measured from its middle. */
    case 'predefined':  return {w: iw + 2 * (Math.max(4, ih * 0.35) + 2), h: ih};
    case 'document':    return {w: iw, h: ih / 0.86};
    case 'database': {
      const H = ih / 0.64 >= 25 ? ih / 0.64 : ih + 9;
      return {w: iw, h: H};
    }
    case 'manualInput': return {w: iw, h: ih / 0.72};
    case 'delay': {
      const H = ih * figureCurveH();
      return {w: Math.max(H * 0.75, iw + curvedEndInset(H/2, H, ih)), h: H};
    }
    case 'display': {
      const H = ih * figureCurveH(), d = H * 0.3;
      return {w: iw + d * ih / H + curvedEndInset(d, H, ih) + d * 0.2, h: H};
    }
    case 'storedData': {
      const H = ih * 1.2, d = H * 0.25;
      return {w: iw + curvedEndInset(d, H, ih) + d + 2, h: H};
    }
    case 'connector': { const D = Math.hypot(iw, ih); return {w: D, h: D}; }
    case 'offPage':     return {w: Math.max(iw, ih * 0.9), h: ih / 0.7};
    case 'extract': case 'merge': return {w: iw * 2, h: ih * 2};
    case 'process':     return {w: iw, h: ih};
    default: {
      let w = iw / 0.6, h = ih / 0.6;
      const ar = fig && fig.ar;
      if(ar){ if(w / h < ar) w = h * ar; else h = w / ar; }
      return {w, h};
    }
  }
}
/* A figure's outline as it is DRAWN, which is more than its points.
 *
 * The outline used to be stroked as the bare polygon, and every ring and
 * both lines of a double border were the same polygon drawn into a
 * smaller or larger box — so on anything but a rectangle the two lines of
 * a double border ran together on the slanted sides and apart on the
 * level ones, and a figure ignored the entry's rounded corners and its
 * wavy border altogether (the owner's list of 2.11). Here the points are
 * moved IN by `off` along each side's own normal (out where it is
 * negative), which keeps every line of the border the same distance from
 * the next all the way round; then the corners are rounded, or the sides
 * rippled as a box's are.
 *
 * A corner is any point where the outline turns by more than cornerTurn();
 * the points along a figure's curves turn by less, and are not corners. */
function figureOutlineD(fig, x, y, W, H, o){
  o = o || {};
  let pts = cleanRun(figureLayout(fig, W, H).outline.map(p=> ({x: x + p.x, y: y + p.y})));
  if(pts.length < 3) return figurePolyD(pts, 0, 0, true);
  if(o.off) pts = offsetRun(pts, o.off);
  if(o.wavy){
    const w = waveRun(pts);
    if(w) return smoothPath(w, true);
  }
  if(o.r > 0) return roundedRunD(pts, o.r);
  return figurePolyD(pts, 0, 0, true);
}
function cleanRun(pts){
  const out = [];
  pts.forEach(p=>{
    const q = out[out.length - 1];
    if(!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.01) out.push(p);
  });
  while(out.length > 2 && Math.hypot(out[0].x - out[out.length-1].x, out[0].y - out[out.length-1].y) <= 0.01) out.pop();
  return out;
}
function runSignedArea(pts){
  let a = 0;
  pts.forEach((p, i)=>{ const q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; });
  return a / 2;
}
/* Each side's normal into the figure: the outline may be walked either
   way round, and the sign of its area says which. */
function runNormals(pts){
  const s = runSignedArea(pts) >= 0 ? 1 : -1;
  return pts.map((p, i)=>{
    const q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return {x: s * -(q.y - p.y) / len, y: s * (q.x - p.x) / len, len};
  });
}
/* Every side moved in by d, each corner where the two moved sides meet —
   held to four times d at a needle-sharp point, as a stroke's miter is. */
function offsetRun(pts, d){
  const N = runNormals(pts);
  const out = [];
  pts.forEach((p, i)=>{
    const a = N[(i - 1 + pts.length) % pts.length], b = N[i];
    let mx = a.x + b.x, my = a.y + b.y;
    const ml = Math.hypot(mx, my);
    const cos = ml < 1e-6 ? 0 : (mx * a.x + my * a.y) / ml;
    /* A point where the outline nearly doubles back — the cusp of a
       drum's cut-in side — has no meeting point worth the name: the
       mitre would run off as a spike. It is bevelled instead, one point
       off each side. */
    if(cos < 0.15){
      out.push({x: p.x + a.x * d, y: p.y + a.y * d}, {x: p.x + b.x * d, y: p.y + b.y * d});
      return;
    }
    const k = d / cos;
    out.push({x: p.x + mx / ml * k, y: p.y + my / ml * k});
  });
  return cleanRun(out);
}
/* Inside a function: a card cut to its picture is drawn at start-up,
   before this part has run. */
function cornerTurn(){ return 20 * Math.PI / 180; }
/* How far a corner turns, and the length cut off each side to round it
   with radius r: the arc meets the sides r·tan(turn/2) back from the
   corner, and never past the middle of either side. */
function runCorners(pts, r){
  const n = pts.length;
  return pts.map((p, i)=>{
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const ux = p.x - a.x, uy = p.y - a.y, vx = b.x - p.x, vy = b.y - p.y;
    const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
    const turn = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))));
    if(!(turn > cornerTurn()) || !(r > 0)) return {p, turn, cut: 0};
    const cut = Math.min(r * Math.tan(Math.min(turn, 2.8) / 2), lu / 2, lv / 2);
    return {p, turn, cut,
            a: {x: p.x - ux / lu * cut, y: p.y - uy / lu * cut},
            b: {x: p.x + vx / lv * cut, y: p.y + vy / lv * cut}};
  });
}
function roundedRunD(pts, r){
  const C = runCorners(pts, r);
  const f = q=> q.x.toFixed(2) + ',' + q.y.toFixed(2);
  const start = C[0].cut ? C[0].b : C[0].p;
  let d = 'M' + f(start);
  for(let k = 1; k <= C.length; k++){
    const c = C[k % C.length];
    if(c.cut) d += ' L' + f(c.a) + ' Q' + f(c.p) + ' ' + f(c.b);
    else if(k < C.length) d += ' L' + f(c.p);
  }
  return d + ' Z';
}
/* The outline rippled as a box's border is: each run between two corners
   carries an even number of half-waves fitted to its length and eases to
   nothing over the last of them, so a corner is a clean turn and two runs
   never have to agree on a phase; a figure with no corner at all (a
   circle) is one closed run, waved all the way round. The corners are
   rounded first, at the radius a rippled box's are. Too small an outline
   to carry three waves is left plain. */
function waveRun(pts){
  const C = runCorners(pts, POCKET_CORNER_R);
  const N = runNormals(pts);
  const per = pts.reduce((s, p, i)=> s + N[i].len, 0);
  if(per < POCKET_WAVELEN * 3) return null;
  const step = POCKET_WAVELEN / WAVE_STEP_DIV;
  const corners = C.map((c, i)=> c.cut ? i : -1).filter(i=> i >= 0);
  const closedLoop = !corners.some(i=> C[i].turn > cornerTurn());
  const n = pts.length;
  const out = [];
  /* A run from corner i to corner j: from the end of i's rounding to the
     start of j's, through every point between, with each sample pushed
     out along its side's normal. */
  const waveAlong = (seq, closed)=>{
    const segs = [];
    for(let k = 0; k + 1 < seq.length; k++){
      const a = seq[k].q, b = seq[k + 1].q;
      segs.push({a, b, nrm: seq[k].nrm, len: Math.hypot(b.x - a.x, b.y - a.y)});
    }
    const L = segs.reduce((s, g)=> s + g.len, 0);
    if(!(L > 0)) return;
    const halves = Math.max(2, 2 * Math.round(L / POCKET_WAVELEN));
    const hw = L / halves;
    let u = 0;
    segs.forEach(g=>{
      const k = Math.max(1, Math.ceil(g.len / step));
      for(let t = 0; t < k; t++){
        const s = u + g.len * t / k;
        const ease = closed ? 1 : (()=>{ const e = Math.max(0, Math.min(1, Math.min(s, L - s) / hw)); return e*e*(3 - 2*e); })();
        const rise = POCKET_AMP * Math.sin(Math.PI * s / hw) * ease;
        out.push({x: g.a.x + (g.b.x - g.a.x) * t / k - g.nrm.x * rise,
                  y: g.a.y + (g.b.y - g.a.y) * t / k - g.nrm.y * rise});
      }
      u += g.len;
    });
  };
  if(closedLoop){
    const seq = pts.map((p, i)=> ({q: p, nrm: N[i]}));
    seq.push({q: pts[0], nrm: N[0]});
    waveAlong(seq, true);
    return out;
  }
  const bend = (c)=>{
    for(let t = 0; t <= 4; t++){
      const v = t / 4, w = 1 - v;
      out.push({x: w*w*c.a.x + 2*w*v*c.p.x + v*v*c.b.x, y: w*w*c.a.y + 2*w*v*c.p.y + v*v*c.b.y});
    }
  };
  corners.forEach((i, k)=>{
    const j = corners[(k + 1) % corners.length];
    bend(C[i]);
    const seq = [{q: C[i].b, nrm: N[i]}];
    for(let m = (i + 1) % n; m !== j; m = (m + 1) % n) seq.push({q: pts[m], nrm: N[m]});
    seq.push({q: C[j].a, nrm: N[(j - 1 + n) % n]});
    waveAlong(seq, false);
  });
  return out;
}
function figurePolyD(pts, x, y, close){
  return pts.map((p, i)=> (i ? 'L' : 'M') + (x + p.x).toFixed(2) + ',' + (y + p.y).toFixed(2)).join(' ') + (close ? ' Z' : '');
}
/* Where the outline stands for a port on `side` at (px, py): how far OUT
   of the box, negative for inside — the question borderProfileOf answers
   for every border. A line across the box at that point meets the outline;
   the meeting furthest towards the side is the one a connector reaches. */
function figureProfile(fig, box){
  const L = figureLayout(fig, box.w, box.h);
  const pts = L.outline.map(p=> ({x: box.x + p.x, y: box.y + p.y}));
  return {kind:'figure', amp: 0, structural: true,
    offsetAt: (side, px, py)=>{
      const vert = side === 'top' || side === 'bottom';
      const hits = [];
      for(let i = 0; i < pts.length; i++){
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if(vert){
          if((a.x - px) * (b.x - px) > 0 || a.x === b.x) continue;
          hits.push(a.y + (b.y - a.y) * (px - a.x) / (b.x - a.x));
        } else {
          if((a.y - py) * (b.y - py) > 0 || a.y === b.y) continue;
          hits.push(a.x + (b.x - a.x) * (py - a.y) / (b.y - a.y));
        }
      }
      if(!hits.length) return 0;
      if(side === 'top')    return box.y - Math.min(...hits);
      if(side === 'bottom') return Math.max(...hits) - (box.y + box.h);
      if(side === 'left')   return box.x - Math.min(...hits);
      return Math.max(...hits) - (box.x + box.w);
    }};
}

/* The templates the chart keeps for its menu: a name and an outline each,
   and nothing that does not read as one. */
function cleanFigureTemplates(v){
  if(!Array.isArray(v)) return [];
  return v.filter(t=> t && typeof t === 'object' && parseFigurePath(t.d))
          .map(t=>{
            const out = {name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 60) : 'Template', d: t.d};
            const ar = figureAspectOf(t.ar);
            if(ar) out.ar = ar;
            return out;
          });
}
/* An SVG file read as a template: the shapes in it, walked with their
   transforms, sampled into points and scaled into the hundred-unit square.
   The file is never put into the page as it is. Its shapes are rebuilt
   from their geometry alone — path data, points, sizes and transforms,
   no scripts, handlers, links or styles — inside a hidden drawing that is
   only measured, and then thrown away. Each closed run becomes one run of
   points; the largest is the outline. */
const FIGURE_SVG_TAGS = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'];
const FIGURE_SVG_ATTRS = ['d', 'points', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry',
                          'x1', 'y1', 'x2', 'y2', 'transform'];
function figureTemplateOfSvg(text, name){
  const SVG = 'http://www.w3.org/2000/svg';
  let doc;
  try{ doc = new DOMParser().parseFromString(text, 'image/svg+xml'); }catch(e){ return null; }
  const root = doc && doc.documentElement;
  if(!root || root.localName !== 'svg' || doc.querySelector('parsererror')) return null;
  const host = document.createElementNS(SVG, 'svg');
  host.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;');
  const copy = (from, to)=>{
    Array.from(from.children).forEach(c=>{
      const tag = c.localName;
      let made = null;
      if(tag === 'g' || tag === 'svg') made = document.createElementNS(SVG, 'g');
      else if(FIGURE_SVG_TAGS.includes(tag)) made = document.createElementNS(SVG, tag);
      if(!made) return;
      FIGURE_SVG_ATTRS.forEach(a=>{
        const v = c.getAttribute(a);
        if(v != null && v.length < 20000) made.setAttribute(a, v);
      });
      if(tag === 'svg'){
        const x = parseFloat(c.getAttribute('x')) || 0, y = parseFloat(c.getAttribute('y')) || 0;
        made.removeAttribute('x'); made.removeAttribute('y');
        if(x || y) made.setAttribute('transform', `translate(${x},${y})`);
      }
      to.appendChild(made);
      if(tag === 'g' || tag === 'svg') copy(c, made);
    });
  };
  copy(root, host);
  document.body.appendChild(host);
  const runs = [];
  try{
    const hostM = host.getScreenCTM();
    const inv = hostM ? hostM.inverse() : null;
    host.querySelectorAll(FIGURE_SVG_TAGS.join(',')).forEach(el=>{
      let len = 0;
      try{ len = el.getTotalLength(); }catch(e){ return; }
      if(!(len > 0)) return;
      const elM = el.getScreenCTM();
      const m = (elM && inv) ? inv.multiply(elM) : null;
      const steps = Math.min(600, Math.max(24, Math.round(len / 2)));
      const step = len / steps;
      let run = [], prev = null;
      for(let i = 0; i <= steps; i++){
        let p = el.getPointAtLength(Math.min(len, i * step));
        if(m) p = p.matrixTransform(m);
        /* A jump much longer than a step is the pen lifted: a new run. */
        if(prev && Math.hypot(p.x - prev.x, p.y - prev.y) > step * 4){
          if(run.length >= 2) runs.push(run);
          run = [];
        }
        run.push({x: p.x, y: p.y});
        prev = p;
      }
      if(run.length >= 2) runs.push(run);
    });
  } finally {
    host.remove();
  }
  if(!runs.length) return null;
  const all = runs.flat();
  const x0 = Math.min(...all.map(p=> p.x)), x1 = Math.max(...all.map(p=> p.x));
  const y0 = Math.min(...all.map(p=> p.y)), y1 = Math.max(...all.map(p=> p.y));
  if(!(x1 - x0 > 0) || !(y1 - y0 > 0)) return null;
  const area = r=> Math.abs(r.reduce((s, p, i)=>{ const q = r[(i + 1) % r.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
  runs.sort((a, b)=> area(b) - area(a));
  if(area(runs[0]) <= 0) return null;
  const num = v=> String(Math.round(v * 10) / 10);
  /* Points closer together than a tenth of a unit say nothing more, and
     nor does a point on the straight line between its neighbours: a
     rectangle sampled every two pixels is four corners. */
  const d = runs.map((r, k)=>{
    const out = [];
    simplifyRun(r.map(p=> ({x: (p.x - x0) / (x1 - x0) * 100, y: (p.y - y0) / (y1 - y0) * 100})), 0.15).forEach(p=>{
      const q = {x: num(p.x), y: num(p.y)};
      const last = out[out.length - 1];
      if(!last || last.x !== q.x || last.y !== q.y) out.push(q);
    });
    return 'M' + out.map(q=> q.x + ' ' + q.y).join(' L') + (k === 0 ? ' Z' : '');
  }).join(' ');
  if(!parseFigurePath(d)) return null;
  return {name: String(name || 'Template').replace(/\.svg$/i, '').trim().slice(0, 60) || 'Template', d,
          ar: figureAspectOf((x1 - x0) / (y1 - y0))};
}

/* Ramer–Douglas–Peucker: the fewest of a run's points that keep it within
   `tol` of where it was. */
function simplifyRun(pts, tol){
  if(pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while(stack.length){
    const [i, j] = stack.pop();
    const a = pts[i], b = pts[j];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let far = -1, at = -1;
    for(let k = i + 1; k < j; k++){
      const p = pts[k];
      const dist = len ? Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len
                       : Math.hypot(p.x - a.x, p.y - a.y);
      if(dist > far){ far = dist; at = k; }
    }
    if(far > tol){ keep[at] = true; stack.push([i, at], [at, j]); }
  }
  return pts.filter((p, k)=> keep[k]);
}
/* The menu of figures: the flowchart's own, then the chart's templates,
   then a way to bring one in. Opened from the button beside Default and
   standing beside the column it came from, inside the same widget, so
   the pointer travelling to it does not shut the menu. */
function figureIcon(fig){
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 40 30');
  svg.setAttribute('class', 'node-style-icon');
  const W = (fig === 'connector') ? 18 : (fig === 'decision' || fig === 'extract' || fig === 'merge') ? 26 : 28;
  const H = (fig === 'connector') ? 18 : (fig === 'decision' || fig === 'extract' || fig === 'merge') ? 20 : 15;
  const f = isBuiltinFigure(fig) ? fig : figureOf(fig);
  let iw = W, ih = H;
  if(f && f.ar){ if(f.ar > 28 / 22){ iw = 28; ih = 28 / f.ar; } else { ih = 22; iw = 22 * f.ar; } }
  const x = (40 - iw) / 2, y = (30 - ih) / 2;
  const L = figureLayout(f, iw, ih);
  const add = (d, cls)=>{
    const e = document.createElementNS(SVG, 'path');
    e.setAttribute('d', d); e.setAttribute('class', cls);
    svg.appendChild(e);
  };
  add(figurePolyD(L.outline, x, y, true), 'nsi-box');
  L.marks.forEach(m=> add(figurePolyD(m, x, y, false), 'nsi-line'));
  return svg;
}
const addFabFigures = document.createElement('div');
addFabFigures.className = 'add-fab-figures';
addFabFigures.id = 'addFabFigures';
addFabFigures.setAttribute('role', 'menu');
addFab.appendChild(addFabFigures);
const figureFileInput = document.createElement('input');
figureFileInput.type = 'file';
figureFileInput.accept = '.svg,image/svg+xml';
figureFileInput.hidden = true;
addFab.appendChild(figureFileInput);
function figureButton(label, icon, onPick){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'node-style-btn';
  b.setAttribute('role', 'menuitem');
  b.title = label;
  b.appendChild(icon);
  const cap = document.createElement('span');
  cap.className = 'node-style-cap';
  cap.textContent = label;
  b.appendChild(cap);
  b.addEventListener('click', ev=>{ ev.stopPropagation(); onPick(ev); });
  return b;
}
function buildFigureMenu(){
  addFabFigures.textContent = '';
  /* A card inside a clear band: the band is the pointer's way across from
     the column to the card, and is still the widget, so crossing it does
     not shut the menu. */
  const card = document.createElement('div');
  card.className = 'add-fab-figures-card';
  addFabFigures.appendChild(card);
  const head = (t)=>{ const h = document.createElement('div'); h.className = 'add-fab-figures-head'; h.textContent = t; card.appendChild(h); };
  const grid = ()=>{ const g = document.createElement('div'); g.className = 'add-fab-figures-grid'; card.appendChild(g); return g; };
  head('Flowchart');
  const g1 = grid();
  figurePicks().forEach(p=>{
    const b = figureButton(p.label, figureIcon(p.value), ()=>{ closeAddFab(); addEntryOfFigure(p.value); });
    b.dataset.value = p.value;
    g1.appendChild(b);
  });
  head('Templates');
  const g2 = grid();
  cleanFigureTemplates(SETTINGS.figures).forEach((t, i)=>{
    const b = figureButton(t.name, figureIcon(t), ()=>{ closeAddFab(); addEntryOfFigure(Object.assign({name: t.name, d: t.d}, t.ar ? {ar: t.ar} : {})); });
    b.classList.add('figure-template');
    b.dataset.template = String(i);
    const x = document.createElement('span');
    x.className = 'figure-template-drop';
    x.textContent = '×';
    x.title = 'Take this template out of the menu (entries drawn with it keep it)';
    x.addEventListener('click', ev=>{
      ev.stopPropagation();
      applyEdit(()=>{
        const next = cleanFigureTemplates(SETTINGS.figures);
        next.splice(i, 1);
        if(next.length) SETTINGS.figures = next; else delete SETTINGS.figures;
      });
      buildFigureMenu();
    });
    b.appendChild(x);
    g2.appendChild(b);
  });
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'node-style-btn figure-upload';
  up.title = 'Bring in a template from an SVG file: its outline becomes a figure';
  up.innerHTML = '<span class="figure-upload-plus">+</span><span class="node-style-cap">Upload SVG</span>';
  up.addEventListener('click', ev=>{ ev.stopPropagation(); figureFileInput.click(); });
  g2.appendChild(up);
}
function openFigureMenu(on){
  const open = on === undefined ? !addFab.classList.contains('figures') : on;
  if(open) buildFigureMenu();
  addFab.classList.toggle('figures', open);
  const btn = document.getElementById('addFabCustomize');
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
figureFileInput.addEventListener('change', ()=>{
  const f = figureFileInput.files && figureFileInput.files[0];
  figureFileInput.value = '';
  if(!f) return;
  if(f.size > 2e6){ flashStatus('That file is too big to be a template.'); return; }
  f.text().then(text=>{
    const t = figureTemplateOfSvg(text, f.name);
    if(!t){ flashStatus('No outline could be read from that SVG.'); return; }
    applyEdit(()=>{ SETTINGS.figures = cleanFigureTemplates(SETTINGS.figures).concat([t]); });
    openAddFab();
    openFigureMenu(true);
  });
});
/* The button itself, beside Default: a small one, so Default is still the
   one thing a quick press finds. */
(()=>{
  const def = addFabStyles.querySelector('.node-style-btn[data-value="rect"]');
  if(!def) return;
  const row = document.createElement('div');
  row.className = 'add-fab-row';
  def.replaceWith(row);
  const more = document.createElement('button');
  more.type = 'button';
  more.id = 'addFabCustomize';
  more.className = 'add-fab-customize';
  more.title = 'More shapes — the flowchart figures, and templates of your own';
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('aria-expanded', 'false');
  /* A gear (the owner's list of 2.11): what it opens is the settings of
     what Default puts down. Its teeth are worked out rather than copied
     from an icon set, eight of them round a hub. */
  more.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">' +
                   '<path d="' + gearPathD(12, 12, 9.2, 6.6, 8) + '"/><circle cx="12" cy="12" r="2.6"/></svg>';
  more.addEventListener('click', ev=>{ ev.stopPropagation(); openFigureMenu(); });
  row.appendChild(more);
  row.appendChild(def);
})();
/* A gear's outline: `teeth` flat-topped teeth between radii r0 and r1. */
function gearPathD(cx, cy, r1, r0, teeth){
  const pts = [];
  const step = 2 * Math.PI / teeth;
  for(let i = 0; i < teeth; i++){
    const a = i * step - Math.PI / 2;
    [[-0.28, r0], [-0.15, r1], [0.15, r1], [0.28, r0]].forEach(([k, r])=>{
      const t = a + k * step;
      pts.push((cx + r * Math.cos(t)).toFixed(2) + ',' + (cy + r * Math.sin(t)).toFixed(2));
    });
  }
  return 'M' + pts.join(' L') + ' Z';
}
/* An entry drawn as a figure, put down as Default puts one. */
function addEntryOfFigure(fig){
  if(readOnlyView) return null;
  const id = uniqueId(slugify(''), new Set(workingNodes.map(it=> it[0])));
  const spot = emptySpotNearCentre(undefined);
  applyEdit(()=> workingNodes.push([id, '', undefined, undefined, undefined, undefined,
                                    {pos: [spot.x, spot.y], figure: fig}]));
  selectNode(id);
  openNodeEditor(id);
  return id;
}
