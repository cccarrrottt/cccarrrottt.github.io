/* ---------------------------------------------------------------------
   Arrays — a border drawn round several entries at once.
 *
 * An array is an entry of its own (shape 'array') whose box is not placed
 * but worked out: the smallest one that holds every entry it lists in
 * opts.members, their outer borders and the tabs on their top edges
 * included, with two pixels to spare. It is outlined as any entry is —
 * its rings and its border style go through the same drawing as an
 * entry's — but it has no ground: its colour is its frame's and its
 * hatching's. It has ports, so connectors meet it as they meet an entry.
 * What it does not have is words or a position: move its members and it
 * follows them; carry it and its members go along.
 *
 * Its border is its own. An entry inside an array keeps whatever it was
 * wearing, so the array is a frame laid round the drawing rather than a
 * change made to anything in it. An array may hold another array, which
 * is drawn behind it and fitted first.
 *
 * Function declarations only: this part runs last, and the model asks
 * these questions while part 02 is still being run. A constant declared
 * here would not exist yet.
   ------------------------------------------------------------------ */
function isArrayNode(n){ return !!n && (n.shape || '') === 'array'; }
/* What an array leaves between its members and the inner edge of its own
   frame: two pixels (the owner's measure). It used to be two steps of the
   grid, which read as a second, empty frame round the first. */
function arrayPad(a){ return 2 + borderHalfOf(a); }
/* The four ways an array's ground may be hatched, as well as coloured. An
   entry has none of them: a hatch is for a region, which is what an array
   is, and inside one entry it would run through the words. */
function arrayHatches(){ return ['diag-r', 'diag-l', 'vert', 'horiz']; }
function arrayMembersOf(opts){
  const list = opts && Array.isArray(opts.members) ? opts.members : [];
  return [...new Set(list.filter(id=> typeof id === 'string' && id))];
}
/* The members as the model holds them, with anything that cannot be one
   taken out: an id that names nothing, the array itself, and an array that
   would end up holding itself through another. Asked once, when the model
   is built, so everything later may follow members without a guard. */
function settleArrayMembers(){
  nodes.forEach(n=>{
    if(!isArrayNode(n)) return;
    n.members = (n.members || []).filter(id=> id !== n.id && nodes.has(id));
  });
  const holds = (a, target, seen)=>{
    if(seen.has(a.id)) return false;
    seen.add(a.id);
    return a.members.some(id=>{
      if(id === target) return true;
      const m = nodes.get(id);
      return isArrayNode(m) && holds(m, target, seen);
    });
  };
  nodes.forEach(n=>{
    if(!isArrayNode(n)) return;
    n.members = n.members.filter(id=>{
      const m = nodes.get(id);
      return !(isArrayNode(m) && holds(m, n.id, new Set()));
    });
  });
}
// How many arrays deep this one goes: 0 holds only entries.
function arrayDepth(a, seen){
  seen = seen || new Set();
  if(seen.has(a.id)) return 0;
  seen.add(a.id);
  let d = 0;
  (a.members || []).forEach(id=>{
    const m = nodes.get(id);
    if(isArrayNode(m)) d = Math.max(d, 1 + arrayDepth(m, seen));
  });
  return d;
}
// Every array, innermost first — the order they have to be fitted in.
function arraysInFitOrder(){
  return [...nodes.values()].filter(isArrayNode)
    .map(a=> ({a, d: arrayDepth(a)}))
    .sort((p, q)=> p.d - q.d)
    .map(p=> p.a);
}
/* Every entry an array holds, through the arrays inside it too. */
function arrayMembersDeep(a, out){
  out = out || new Set();
  (a.members || []).forEach(id=>{
    if(out.has(id)) return;
    out.add(id);
    const m = nodes.get(id);
    if(isArrayNode(m)) arrayMembersDeep(m, out);
  });
  return out;
}
/* The arrays that hold any of these entries, however far out. */
function arraysHolding(ids){
  const want = new Set(ids);
  const out = new Set();
  let grew = true;
  while(grew){
    grew = false;
    nodes.forEach(a=>{
      if(!isArrayNode(a) || out.has(a.id)) return;
      if(a.members.some(id=> want.has(id) || out.has(id))){ out.add(a.id); grew = true; }
    });
  }
  return out;
}
/* A selection with its arrays opened up: carrying, copying or cutting an
   array means its members too, or the frame would leave without what it
   frames. */
function withArrayMembers(ids){
  const out = new Set(ids);
  ids.forEach(id=>{
    const n = nodes.get(id);
    if(isArrayNode(n)) arrayMembersDeep(n).forEach(m=> out.add(m));
  });
  return [...out];
}
/* How far past its box an entry's drawing reaches: its outer rings and
   the ripple or second rail of its border, and above that its tabs. An
   array fits round THAT, so a member with three borders is not cut
   through by the frame, nor a language chip stood on by it. */
function outerReachOf(m){
  const side = (ringCountOf(m) - 1) * ringStepFor(m) + borderHalfOf(m);
  return {side, top: side + tabReachOf(m)};
}
/* Where the array stands, from where its members stand now. Members must
   have been drawn (an entry's size is decided as it is drawn), and the
   arrays among them fitted. An array with no member left has no box and
   is not drawn. */
function fitArray(a){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  (a.members || []).forEach(id=>{
    const m = nodes.get(id);
    if(!m || (isArrayNode(m) && !m.fitted)) return;
    const r = outerReachOf(m);
    x0 = Math.min(x0, m.x - r.side); y0 = Math.min(y0, m.y - r.top);
    x1 = Math.max(x1, m.x + m.w + r.side); y1 = Math.max(y1, m.y + m.h + r.side);
  });
  a.fitted = Number.isFinite(x0);
  if(!a.fitted) return false;
  const pad = arrayPad(a);
  a.x = round2(x0 - pad); a.y = round2(y0 - pad);
  a.w = round2(x1 - x0 + pad * 2); a.h = round2(y1 - y0 + pad * 2);
  a.size = {w: a.w, h: a.h};
  return true;
}
/* An array is hidden when everything in it is: a frame round nothing
   that is shown says nothing. */
function arrayHidden(a){
  const ms = a.members || [];
  return !ms.length || ms.every(id=>{ const m = nodes.get(id); return !m || nodeHidden(m); });
}
/* The hatching, as a pattern over the array's middle, in the array's own
   colour and half see-through, as its frame is. There is no ground under
   it: the chart shows between the lines. */
function arrayHatchPaint(a, colour){
  if(!a.hatch) return null;
  const id = defId('hatch-', a.id);
  const S = 7;
  const turn = a.hatch === 'diag-r' ? 45 : a.hatch === 'diag-l' ? -45 : 0;
  const p = el('pattern', {id, patternUnits:'userSpaceOnUse', width:S, height:S,
                           patternTransform: turn ? `rotate(${turn})` : ''}, nodeDefs);
  el('path', {d: a.hatch === 'horiz' ? `M0,${S/2} H${S}` : `M${S/2},0 V${S}`,
              stroke: colour, 'stroke-width': 1, 'stroke-opacity': 0.5, fill:'none'}, p);
  return `url(#${id})`;
}
/* The arrays again, from where their members are now — for a drag, which
   moves entries without drawing the chart again. Returns the arrays that
   moved, so their connectors are routed afresh with the rest. */
function refitArraysForDrag(moving){
  if(![...nodes.values()].some(isArrayNode)) return new Set();
  const touched = arraysHolding(moving);
  if(!touched.size) return touched;
  renderNodes({arraysOnly: true});
  return touched;
}

/* Making one: round whatever is picked, two entries or more. The new
   array is selected, so the bar for its look is a pointer away. */
function makeArrayOfSelection(){
  if(readOnlyView) return null;
  const ids = (multiSelection.size > 1 ? [...multiSelection] : [])
    .filter(id=> nodes.has(id));
  if(ids.length < 2){
    setSaveState('ok', 'Pick two entries or more to put them in an array');
    setTimeout(refreshSaveUI, 1600);
    return null;
  }
  const id = uniqueId('array', new Set(workingNodes.map(it=> it[0])));
  applyEdit(()=> workingNodes.push([id, '', null, null, null, 'array', {members: ids}]));
  selectNode(id);
  paintMultiSelection();
  return id;
}
/* Taking an array apart: the frame goes, everything in it stays. Every
   array picked, or failing that the arrays round the picked entries. */
function ungroupSelection(){
  if(readOnlyView) return false;
  const picked = (multiSelection.size ? [...multiSelection] : selectedId ? [selectedId] : [])
    .filter(id=> nodes.has(id));
  let doomed = picked.filter(id=> isArrayNode(nodes.get(id)));
  if(!doomed.length){
    doomed = [...nodes.values()].filter(a=> isArrayNode(a) && a.members.some(id=> picked.includes(id)))
      .map(a=> a.id);
  }
  if(!doomed.length) return false;
  return deleteNodes(doomed);
}
/* After entries are deleted: they leave every array that held them, and
   an array left holding nothing goes as well — and so, then, may the one
   round it. Run inside the deletion's own step of undo. */
function pruneArrayMembers(doomed){
  const gone = new Set(doomed);
  let changed = true;
  while(changed){
    changed = false;
    for(let i = workingNodes.length - 1; i >= 0; i--){
      const it = workingNodes[i];
      if(!it || it[5] !== 'array' || gone.has(it[0])) continue;
      const opts = it[6] && typeof it[6] === 'object' ? it[6] : {};
      const before = arrayMembersOf(opts);
      const kept = before.filter(id=> !gone.has(id));
      if(kept.length === before.length) continue;
      if(!kept.length){
        gone.add(it[0]);
        workingNodes.splice(i, 1);
        for(let k = EDGE_STYLES.length - 1; k >= 0; k--){
          if(EDGE_STYLES[k].from === it[0] || EDGE_STYLES[k].to === it[0]) EDGE_STYLES.splice(k, 1);
        }
        workingNodes.forEach(o=>{
          const ps = resolveExplicitParents(o);
          if(!ps.includes(it[0])) return;
          const rest = ps.filter(p=> p !== it[0]);
          o[2] = rest.length === 0 ? undefined : rest.length === 1 ? rest[0] : rest;
        });
      } else {
        it[6] = Object.assign({}, opts, {members: kept});
      }
      changed = true;
    }
  }
}
