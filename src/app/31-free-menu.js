/* ---------------------------------------------------------------------
   The free-element menu.

   A picture and a text block are not entries in the continuity — they have
   no lineage, no ports and nothing to say in the entry panel — so clicking
   one opens this small card beside it instead. A picture gets a file and a
   URL; a text block gets its own face and size. What is about the thing on
   the drawing — where it stands in the stack, which way round it is — is
   set on the drawing, from the hover bar and the corner handle.
   ------------------------------------------------------------------ */
const freeMenu = document.getElementById('freeMenu');
const freeMenuImagePart = document.getElementById('freeMenuImagePart');
const freeMenuTextPart = document.getElementById('freeMenuTextPart');
const freeMenuImageUrl = document.getElementById('freeMenuImageUrl');
const freeMenuFont = document.getElementById('freeMenuFont');
const freeMenuFontSize = document.getElementById('freeMenuFontSize');
let freeMenuId = null;

function positionFreeMenu(evt, n){
  const host = document.querySelector('.main').getBoundingClientRect();
  const rect = freeMenu.getBoundingClientRect();
  const margin = 10;
  let x = 16, y = 16;
  if(evt && typeof evt.clientX === 'number'){
    x = evt.clientX - host.left + 14;
    y = evt.clientY - host.top + 14;
  } else if(n){
    // Opened without a pointer (a double-click, say): anchor to the
    // element's own top-right corner in screen space.
    const svgRect = svg.getBoundingClientRect();
    x = svgRect.left - host.left + vx + (n.x + n.w) * vs + 14;
    y = svgRect.top  - host.top  + vy + n.y * vs;
  }
  x = Math.max(margin, Math.min(x, host.width - rect.width - margin));
  y = Math.max(margin, Math.min(y, host.height - rect.height - margin));
  freeMenu.style.left = x + 'px';
  freeMenu.style.top = y + 'px';
}

function closeFreeMenu(){
  if(!freeMenuId) return;
  flushFreeMenuCommit();
  endLabelPreview(false);
  freeMenuId = null;
  freeMenuUndoPushed = false;
  freeMenu.classList.remove('open');
}

function openFreeMenu(id, evt){
  const n = nodes.get(id);
  if(!n || document.body.classList.contains('read-only')) return;
  if(freeMenuId && freeMenuId !== id) closeFreeMenu();
  freeMenuId = id;
  const isImage = (n.shape||'') === 'image';
  document.getElementById('freeMenuTitle').textContent = isImage ? 'Image' : 'Text';
  freeMenuImagePart.style.display = isImage ? '' : 'none';
  freeMenuTextPart.style.display  = isImage ? 'none' : '';
  /* A picture is deleted as an entry is — selected, and the Delete key or
     the chart's menu — and the owner found a Delete button in its menu one
     too many, beside the one that takes off only its picture. */
  document.getElementById('freeMenuActions').hidden = isImage;
  if(isImage){
    freeMenuImageUrl.value = n.image || '';
  } else {
    populateFontOptions(freeMenuFont);
    freeMenuFont.value = n.font || FONT_OPTIONS[0].key;
    freeMenuFontSize.value = n.fontSize || '';
  }
  freeMenuUndoPushed = false;
  freeMenu.classList.add('open');
  positionFreeMenu(evt, n);
}

document.getElementById('freeMenuClose').onclick = (ev)=>{ ev.stopPropagation(); closeFreeMenu(); };
freeMenu.addEventListener('click', ev=> ev.stopPropagation());
wireImagePicker('freeMenuImagePick', 'freeMenuImageClear', 'freeMenuImageUrl');

/* The free-element menu commits as you use it too — one undo step for the
   whole time the menu is open, the same as the entry editor. */
let freeMenuUndoPushed = false;
let freeMenuTimer = 0;
function queueFreeMenuCommit(delay){
  if(freeMenuTimer) clearTimeout(freeMenuTimer);
  freeMenuTimer = setTimeout(()=>{ freeMenuTimer = 0; commitFreeMenu(); }, delay === undefined ? 480 : delay);
}
function flushFreeMenuCommit(){
  if(!freeMenuTimer) return;
  clearTimeout(freeMenuTimer); freeMenuTimer = 0;
  commitFreeMenu();
}
function commitFreeMenu(){
  const id = freeMenuId;
  if(!id || readOnlyView) return;
  const n = nodes.get(id);
  if(!n) return;
  const isImage = (n.shape||'') === 'image';
  const url = freeMenuImageUrl.value.trim();
  const font = freeMenuFont.value === FONT_OPTIONS[0].key ? null : freeMenuFont.value;
  const sizeRaw = freeMenuFontSize.value.trim();
  const fontSize = sizeRaw ? Number(sizeRaw) : null;
  endLabelPreview(true);
  if(!freeMenuUndoPushed){
    pushUndo();
    freeMenuUndoPushed = true;
  }
  commitEntry(()=>{
    const found = workingEntry(id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    if(isImage){
      if(url) opts.image = url; else delete opts.image;
      /* Where it stands in the stack is not this form's to write any
         more: it is set from the hover bar on the picture. A commit from
         here that touched it would put back whatever the (now absent)
         row last said — the same fault the angle had below. */
    } else {
      /* The WORDS are not this form's to write any more: they are typed on
         the caption itself. What is set here is the caption's own face and
         size, which belong to the whole of it. */
      if(font) opts.font = font; else delete opts.font;
      if(fontSize && Number.isFinite(fontSize)) opts.fontSize = fontSize; else delete opts.fontSize;
      /* The angle is not this form's to write. It is set on the caption
         itself, by the curved arrow at its corner, and a commit from here
         that touched it would put back whatever the (now absent) slider
         last said. */
    }
    putEntry(found.index, found.entry, opts);
  });
}

document.getElementById('freeMenuDelete').onclick = (ev)=>{
  ev.stopPropagation();
  const id = freeMenuId;
  if(!id) return;
  endLabelPreview(true);
  freeMenuTimer && clearTimeout(freeMenuTimer);
  freeMenuTimer = 0;
  closeFreeMenu();
  deleteNode(id);
};

['freeMenuImageUrl','freeMenuFontSize'].forEach(id=>{
  const f = document.getElementById(id);
  if(!f) return;
  f.addEventListener('input', ()=> queueFreeMenuCommit());
  f.addEventListener('blur', ()=> flushFreeMenuCommit());
});
document.getElementById('freeMenuFont').addEventListener('change', ()=> queueFreeMenuCommit(0));

/* Eighths of a turn, when Shift is held on the rotate handle.
 *
 * The angles a caption actually wants are level, on its side, and the four
 * diagonals — the same set a callout's leader snaps to. Anything between
 * them is dialled in by eye with the key up. */
const ROT_SNAP = 45;

let currentEdgeNaturalColor = '#20242b'; // this edge's color with no override — what "Default" resets to

function openEdgeStylePopover(from, to, evt){
  /* A reader gets no settings for a line, as they get no style bar over
     one: the panel is nothing but controls for changing it. The click
     still did open it — the only control on the chart a reader could
     reach that offered an edit. */
  if(readOnlyView) return;
  // Moving to a different connector starts a fresh editing session, so the
  // next change to it is its own step of undo rather than joining the
  // previous connector's.
  if(currentEdgeStyleTarget && (currentEdgeStyleTarget.from!==from || currentEdgeStyleTarget.to!==to)){
    edgeEditUndoPushed = false;
  }
  currentEdgeStyleTarget = {from, to};
  let style = edgeStyleFor(from, to);
  const structEdge = structEdges.find(e=>e.from===from && e.to===to);
  currentEdgeNaturalColor = (structEdge && structEdge.color) || '#20242b';
  const a = nodes.get(from), b = nodes.get(to);
  /* The merged arrow has no source entry; what it comes from is the
     merge, and that is what the panel calls it. */
  edgeStyleLabelEl.textContent = (a ? stripMarkup(a.label) : from === '' ? 'Merge' : from) + ' → ' + (b ? stripMarkup(b.label) : to);
  edgeStyleLabelEl.title = edgeStyleLabelEl.textContent;
  styleRoutingSel.value = style.routing;
  /* A lineage feeding an amalgam runs into the shared bar: its colour
     names which lineage it is, and the bar decides where it runs. */
  const mergedEdge = isMergePart(from, to);
  const mergedOut = isMergedArrow(from, to);
  /* And it cannot be painted with a gradient. Its colour is what says
     WHICH lineage this stretch of the bar belongs to — a sweep between two
     colours says it belongs to two, which is the one thing the bar exists
     to tell apart. The button is greyed rather than hidden, like the
     route button beside the path, so the row still explains itself. */
  const gradBtn = styleGradientBtn;
  if(gradBtn){
    gradBtn.disabled = mergedEdge;
    gradBtn.title = mergedOut
      ? 'Set by the amalgam: the merged arrow carries every lineage\u2019s colour'
      : mergedEdge
      ? 'Not on a merged lineage: its colour names which lineage it is'
      : 'Gradient along the connector';
  }
  /* And it is not bent by hand either, so ⟳ beside the path is greyed —
     the handles on the line are already gone (see drawBendHandles). Only
     the button: the path beside it still applies. */
  {
    const clearBtn = document.getElementById('styleBendsClear');
    if(clearBtn){
      clearBtn.disabled = mergedEdge;
      clearBtn.classList.toggle('disabled', mergedEdge);
      clearBtn.title = mergedEdge
        ? 'Set by the amalgam: the merge decides where this runs'
        : 'Route it again — take every bend set by hand out';
    }
  }
  /* The merged arrow's paint is every lineage's colour, and it is not a
     connector anybody drew, so it cannot be deleted on its own either
     (see deleteOpenConnector): it goes when the merge does. The row is
     taken away rather than greyed — there is nothing in it it could ever
     offer. */
  document.getElementById('styleFillRow').hidden = mergedOut;
  if(mergedEdge && style.gradient){
    // Data can carry one even though the control cannot set it.
    style = Object.assign({}, style, {gradient: null, color: style.color || style.gradient[0]});
  }
  stylePaintMode.value = style.gradient ? 'gradient' : (style.color ? 'solid' : 'default');
  styleColorInput.value = (style.gradient ? style.gradient[0] : style.color) || currentEdgeNaturalColor;
  styleColor2Input.value = style.gradient ? style.gradient[1] : '';
  syncColorRow();
  clearStyleStatus();
  edgePopover.classList.add('open');
  positionEdgePopover(evt);
  /* The marks on the line belong to the panel, so they go up WITH it.
   *
   * They were drawn only at the end of redrawEdges, and opening a panel
   * does not redraw anything — nothing about the chart has changed. So the
   * marks appeared the first time something else happened to redraw the
   * connectors, which is to say on the first edit, and were gone again the
   * next time the panel was opened without one. */
  drawBendHandles();
}
// The paint the popover's controls currently describe: nothing (inherit),
// one colour, or a gradient between two.
function currentPaint(){
  const mode = stylePaintMode.value;
  if(mode === 'default') return {};
  const c1 = readHex(styleColorInput);
  if(!c1) return {};
  if(mode === 'gradient'){
    const c2 = readHex(styleColor2Input);
    if(c2) return {gradient: [c1, c2]};
  }
  /* `colorFixed` marks a colour somebody CHOSE, as opposed to one a
     connector was born with. Connectors drawn out of a border used to
     record the border's colour as though it had been chosen, which is why
     recolouring an entry left its own connectors behind; now they record
     the ring instead and read the colour from it every time. This flag is
     what keeps a deliberate choice from being read the same way. */
  return {color: c1, colorFixed: true};
}
/* One undo step per popover session, same idea as the entry editor: a run
   of tweaks to one connector collapses into a single Ctrl+Z. */
let edgeEditUndoPushed = false;
/* The note this popover is currently describing: what has been typed, or,
   for a note pinned to a point on the line, the placeholder that placing
   the point put there. */
function noteFromForm(){
  /* Whatever the connector already says. The words are written on the
     drawing now, so this panel neither offers them nor takes them away:
     it carries them through untouched, exactly as it does the bends. */
  if(!currentEdgeStyleTarget) return undefined;
  const kept = edgeStyleFor(currentEdgeStyleTarget.from, currentEdgeStyleTarget.to);
  return (kept && kept.note) || undefined;
}
function applyLiveEdgeStyle(){
  if(!currentEdgeStyleTarget || readOnlyView) return;
  if(!edgeEditUndoPushed){
    pushUndo();
    edgeEditUndoPushed = true;
  }
  const paint = currentPaint();
  // Sides and rings are set by dragging between border bands, not here —
  // carried through untouched so styling an edge never moves its ends.
  const kept = edgeStyleFor(currentEdgeStyleTarget.from, currentEdgeStyleTarget.to);
  setEdgeStyleOverride(currentEdgeStyleTarget.from, currentEdgeStyleTarget.to, {
    routing: styleRoutingSel.value,
    /* The line, its corners and its ends are set from the hover bar on the
       connector itself (see the style bar), the note's side and backing
       from the note's own bar — all carried through untouched here. */
    dash: kept.dash, sinusoid: kept.sinusoid || undefined,
    arrow: kept.arrow, arrowIn: kept.arrowIn || undefined,
    teeOut: kept.teeOut || undefined, teeIn: kept.teeIn || undefined,
    square: kept.square ? undefined : false,
    note: noteFromForm(),
    notePos: noteFromForm() ? (kept.notePos || 'above') : undefined,
    /* Where along the line the note rides. Placed on the DRAWING by
       dragging the plate, exactly as the bends are, so it is carried
       through untouched here — rebuilding the style from the form used to
       drop it, and a note somebody had slid to one end jumped back to the
       middle the moment its connector's colour was changed. */
    noteAt: (typeof kept.noteAt === 'number' && kept.noteAt !== 0.5) ? kept.noteAt : undefined,
    noteSnap: kept.noteSnap || undefined,
    noteBg: kept.noteBg || undefined,
    // Set on the note itself, from its hover bar — carried through here.
    noteFrame: kept.noteFrame === false ? false : undefined,
    noteSquare: kept.noteSquare || undefined,
    color: paint.color,
    /* And the fact that it was CHOSEN, which is what makes it win over the
       colour of the border the connector was drawn from. It was computed
       in currentPaint and then dropped on the floor here, so a colour set
       by hand was overruled the moment the chart redrew: the popover
       previewed the change and the line stayed the colour it was. */
    colorFixed: paint.colorFixed || undefined,
    gradient: paint.gradient,
    fromSide: kept.fromSide || undefined,
    toSide: kept.toSide || undefined,
    fromRing: kept.fromRing || undefined,
    toRing: kept.toRing || undefined,
    // Placed on the drawing, not in this form — carried through untouched
    // so restyling a connector never straightens a route somebody bent.
    bends: (kept.bends && kept.bends.length) ? kept.bends : undefined,
    bendSides: (kept.bends && kept.bends.length && kept.bendSides) ? kept.bendSides : undefined
  });
  /* A callout on this connector is drawn in the connector's ink, and a
     callout is an ENTRY — it lives in the node layer, which redrawEdges
     does not touch. So recolouring a connector repainted its line, its
     arrowheads and its note plate at once and left the card hanging off it
     in the old colour until something else happened to redraw the entries:
     moving the leader's dot, which is the only reason it ever appeared to
     work. The entries are redrawn too when there is a card that cares. */
  if(connectorHasCallout(currentEdgeStyleTarget.from, currentEdgeStyleTarget.to)){
    renderNodes();
    if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
    paintMultiSelection();
  }
  redrawEdges();
  applyVisibility();
  refreshSaveUI();
}
/* A note is written by double-clicking the connector: the words of one it
   already has, or a first one, put where the line was double-clicked.
 *
 * It used to take a button in the connector's panel, and the panel is not
 * where a line is looked at. The empty note is written straight into the
 * overrides rather than through setEdgeStyleOverride, which would see a
 * style with no words and nothing else and drop it as a default — taking
 * the place it was asked for with it. An empty note that is never written
 * is taken out again on commit, like any emptied note. */
function startEdgeNote(from, to, ev){
  if(readOnlyView) return;
  const kept = edgeStyleFor(from, to);
  if(kept.note){
    openEdgeNoteEditor(from, to);
    return;
  }
  let at = 0.5;
  const rec = drawnRoutes.get(calloutEdgeKey(from, to));
  if(ev && rec && rec.pts && rec.pts.length > 1){
    const p = clientToWorld(ev.clientX, ev.clientY);
    at = Math.max(0, Math.min(1, fractionNearest(rec.pts, p.x, p.y)));
  }
  applyEdit(()=>{
    const i = EDGE_STYLES.findIndex(s=> s.from === from && s.to === to);
    const raw = i >= 0 ? EDGE_STYLES[i] : {from, to};
    const next = Object.assign({}, raw, {note: '', notePos: raw.notePos || 'above', noteAt: at});
    if(i >= 0) EDGE_STYLES[i] = next; else EDGE_STYLES.push(next);
  });
  /* The plate has to be on the screen before the field can stand on it,
     and an empty note draws no plate — so it is marked as being started,
     redrawn, and only then written on. */
  noteStarting = {from, to};
  redrawEdges();
  openEdgeNoteEditor(from, to);
}
// Whether any callout card hangs off this connector — see applyLiveEdgeStyle.
function connectorHasCallout(from, to){
  let found = false;
  nodes.forEach(n=>{
    if(found || !isCalloutNode(n) || !n.leader) return;
    if(n.leader.from === from && n.leader.to === to) found = true;
  });
  return found;
}
/* Each colour a square (see squareForHexInput). Empty, the first shows the
   colour the line would take anyway, and the second the first. */
squareForHexInput(styleColorInput, {title: 'the line’s colour',
  fallback: ()=> currentEdgeNaturalColor || null});
squareForHexInput(styleColor2Input, {title: 'where the gradient ends',
  fallback: ()=> readHex(styleColorInput) || currentEdgeNaturalColor || null});
[styleColorInput, styleColor2Input].forEach(input=>{
  input.addEventListener('input', ()=>{ syncColorRow(); applyLiveEdgeStyle(); });
  input.addEventListener('click', ev=> ev.stopPropagation());
});
{
  const clear = document.getElementById('styleBendsClear');
  if(clear) clear.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(!currentEdgeStyleTarget || readOnlyView) return;
    const {from, to} = currentEdgeStyleTarget;
    if(!bendListOf(from, to).length) return;
    applyEdit(()=>{ setBendList(from, to, []); });
  });
}
/* ---- picking where a leader note is pinned ---------------------------
 *
 * The fraction could have been a number field, and that would have been
 * both easier and worse: 0.62 means nothing when you are looking at an
 * elbowed line, and finding the right value would be guess-and-check.
 * Instead the connector itself is the control — move along it and a ghost
 * card follows, click to keep it.
 *
 * Holding Shift restricts the offer to the ends, the quarters and the
 * middle. Those are the places a leader note usually wants to be, and they
 * are exactly the places freehand pointing is worst at hitting: a value
 * that is nearly 0.5 looks like a mistake, where 0.5 looks deliberate.
 */
/* Where Shift offers to put a callout's anchor.
 *
 * Five — the ends, the quarters and the middle — were the places a note
 * usually wants when a connector could carry only one. A connector can
 * carry any number of them now, and a row of remarks along one line needs
 * somewhere to sit that is neither on top of its neighbour nor at a
 * fraction nobody chose. Twentieths are fine enough to place a dozen
 * along a line and coarse enough that two readers pointing at the same
 * place land on the same value. */
const LEADER_SNAP_STEPS = 20;
/* …without the two ends. A remark at the very end of a connector sits on
   the port, under the arrowhead or inside the entry's border — nobody aims
   there, and two beads standing on the boxes only got in the way of the
   ones that mattered. */
const LEADER_SNAPS = Array.from({length: LEADER_SNAP_STEPS - 1},
                                (_, i)=> +((i + 1) / LEADER_SNAP_STEPS).toFixed(4));
/* Every place Shift offers on one connector, each with the kind of place
 * it is.
 *
 *   step — the twentieths, the fine rhythm along the whole line;
 *   mid  — the middle of the connector, the place a remark most often
 *          belongs, drawn so it cannot be mistaken for a step;
 *   leg  — the middle of each straight run of an orthogonal route. The
 *          twentieths are measured along the whole line and so land on a
 *          leg wherever they happen to; the middle of a leg is where the
 *          eye puts a label on it, and it was not on offer at all.
 *
 * A leg too short to carry a remark offers nothing, and a leg whose middle
 * IS the connector's middle is the connector's middle. A step within a
 * unit of a leg's middle gives way to it. */
const SNAP_LEG_MIN = GRID * 4;   // a run-out from a port is not a leg worth labelling
function connectorSnaps(pts){
  const out = LEADER_SNAPS.map(f=> ({f, kind: Math.abs(f - 0.5) < 1e-9 ? 'mid' : 'step'}));
  if(!pts || pts.length < 2) return out;
  const legs = [];
  let total = 0;
  for(let i = 1; i < pts.length; i++){
    const L = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    const horiz = Math.abs(pts[i].y - pts[i-1].y) < 0.5;
    const last = legs[legs.length - 1];
    if(last && L > 0 && last.horiz === horiz) last.len += L;
    else if(L > 0) legs.push({start: total, len: L, horiz});
    total += L;
  }
  if(!total) return out;
  legs.forEach(leg=>{
    if(leg.len < SNAP_LEG_MIN) return;
    const f = (leg.start + leg.len / 2) / total;
    if(Math.abs(f - 0.5) * total < 1) return;
    for(let i = out.length - 1; i >= 0; i--){
      if(out[i].kind === 'step' && Math.abs(out[i].f - f) * total < 1) out.splice(i, 1);
    }
    out.push({f: +f.toFixed(4), kind: 'leg'});
  });
  return out.sort((a, b)=> a.f - b.f);
}
function nearestSnapRecord(pts, f){
  let best = null;
  connectorSnaps(pts).forEach(sn=>{
    if(!best || Math.abs(sn.f - f) < Math.abs(best.f - f)) best = sn;
  });
  return best;
}
/* The straight legs of a route, every one of them, in order. The snaps
   above only OFFER the long ones, but a leg's number has to mean the same
   leg whatever its length, so the numbering counts them all. */
function routeLegs(pts){
  const legs = [];
  let total = 0;
  for(let i = 1; i < (pts || []).length; i++){
    const L = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    if(L <= 0) continue;
    const horiz = Math.abs(pts[i].y - pts[i-1].y) < 0.5;
    const last = legs[legs.length - 1];
    if(last && last.horiz === horiz) last.len += L;
    else legs.push({start: total, len: L, horiz});
    total += L;
  }
  return {legs, total};
}
/* The name a snap is written under — see validSnap. A step has none: it
   is a fraction like any other, and is kept like one. */
function snapNameFor(pts, sn){
  if(!sn) return null;
  if(sn.kind === 'mid') return 'mid';
  if(sn.kind !== 'leg') return null;
  const {legs, total} = routeLegs(pts);
  if(!total) return null;
  const i = legs.findIndex(l=> Math.abs((l.start + l.len/2) / total - sn.f) < 1e-3);
  return i >= 0 ? 'leg:' + i : null;
}
function fractionForSnap(pts, snap){
  if(snap === 'mid') return 0.5;
  const m = /^leg:(\d+)$/.exec(snap || '');
  if(!m) return null;
  const {legs, total} = routeLegs(pts);
  const leg = legs[+m[1]];
  if(!leg || !total) return null;
  return (leg.start + leg.len/2) / total;
}
/* Where an anchor sits, as a leg and a share of that leg.
 *
 * A remark belongs to a PART of its connector. Kept as a fraction of the
 * whole route it slid round corners whenever anything re-routed the line;
 * kept as a point it stayed behind while the part it was on shrank under
 * it, and got shoved along by whatever was shrinking it — a merge's
 * lineage being slid along its bar pushed the callout on its neighbour's
 * stretch ahead of it. Kept as "this far along this leg", it moves with
 * the leg: a stretch that shrinks carries its remark with it, in
 * proportion, and a leg that does not change keeps it exactly. When the
 * route has a different number of legs there is no "this leg" any more,
 * and the nearest point of the new route is used instead. */
function legPlace(pts, f){
  const {legs, total} = routeLegs(pts);
  const d = f * total;
  let i = legs.findIndex(l=> d <= l.start + l.len + 1e-6);
  if(i < 0) i = legs.length - 1;
  const leg = legs[i];
  return {leg: i, t: leg && leg.len ? (d - leg.start) / leg.len : 0, legs: legs.length};
}
function settleAnchor(pts, stored, snap, held, busy){
  if(!pts || pts.length < 2) return stored;
  if(snap){
    const f = fractionForSnap(pts, snap);
    if(f !== null) return f;
  }
  if(!held || busy || Math.abs(held.at - stored) > 1e-6) return stored;
  const {legs, total} = routeLegs(pts);
  if(total && held.legs === legs.length && legs[held.leg]){
    const leg = legs[held.leg];
    return Math.max(0, Math.min(1, (leg.start + leg.len * held.t) / total));
  }
  const shift = routeShift(held.pts, pts);
  return fractionNearest(pts, held.x + (shift ? shift.dx : 0), held.y + (shift ? shift.dy : 0));
}
function heldAnchor(pts, f){
  const m = pointAtFraction(pts, f);
  return Object.assign({x: m.x, y: m.y, at: f, pts: pts.map(q=> ({x:q.x, y:q.y}))},
                       legPlace(pts, f));
}
/* The beads, drawn into the picking layer. `current`, when given, is the
   fraction the thing being placed is attached to right now; the bead it
   sits on is ringed, so the reader can see which place it has taken. */
const SNAP_BEAD_R = {step: 2.2, leg: 3.2, mid: 4.2};
function paintConnectorSnaps(pts, current){
  connectorSnaps(pts).forEach(sn=>{
    const q = pointAtFraction(pts, sn.f);
    el('circle', {class:`leader-snap leader-snap-${sn.kind}`,
                  cx:q.x.toFixed(2), cy:q.y.toFixed(2), r:SNAP_BEAD_R[sn.kind]}, leaderPickLayer);
    if(typeof current === 'number' && Math.abs(current - sn.f) < 1e-4){
      el('circle', {class:'leader-snap-current', cx:q.x.toFixed(2), cy:q.y.toFixed(2),
                    r:SNAP_BEAD_R[sn.kind] + 3}, leaderPickLayer);
    }
  });
}
let leaderPick = null;   // {from, to, pts} while picking
