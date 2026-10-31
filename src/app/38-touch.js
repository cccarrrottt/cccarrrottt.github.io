/* =========================================================================
   A FINGER, READ AS A MOUSE
   -----------------------------------------------------------------------
   Every gesture on this chart was written for a mouse: some forty places
   listen for mousedown, follow mousemove on the window and finish on
   mouseup, and they read Shift and Ctrl off the event to decide what kind
   of drag it is. A phone sends none of that. It sends touches, and of the
   mouse events it then makes up for compatibility it sends only the three
   a tap needs — down, up and click, all at once, after the finger has
   gone. So on a phone nothing could be carried, no connector drawn, no
   corner pulled; one finger panned the canvas wherever it landed, an
   entry included, and a pinch zoomed about the top-left corner of the
   chart rather than about the fingers.

   Teaching each of those forty places about touches would be forty
   chances to get it subtly different. This part does the opposite: it
   turns the finger into the mouse those places already understand, so
   there is one mechanism for both and every drag behaves on glass the way
   it behaves under a mouse, including the parts of it that were hard to
   get right.

   What a finger cannot say is which keys are held, and on this chart the
   keys matter. So a HOLD stands in for them: a finger that stays still for
   a moment before it moves is a finger with the modifier down. Off the
   entries that is Shift — the selection box instead of a pan, a bend or a
   connector end kept to its steps — and on an entry it is Ctrl: a held tap adds an entry to the selection or
   takes it out, and a held drag carries an entry without snapping, exactly
   what Ctrl does under a mouse.

   Two fingers are the canvas's own: they pan and zoom about the point
   between them, and they are never anything else, because there is no
   mouse gesture they could be standing in for.

   Outside the canvas the page is ordinary HTML and a finger already works
   there: buttons click, fields focus, panels scroll. Only two kinds of
   thing in the panels are carried rather than pressed — a tag or reference
   row being refiled, a picture in a note being moved — and a finger on
   those is far more often scrolling the panel than picking anything up. So
   there they wait for a hold, and a finger that simply moves scrolls.
   ========================================================================= */
const TOUCH_SLOP = 8;          // px a finger may wander and still be a tap
const TOUCH_HOLD = 420;        // ms of stillness that turns a press into a hold
const TOUCH_DOUBLE = 330;      // ms between two taps that make a double
const TOUCH_DOUBLE_REACH = 26; // px apart two taps may land and still be a double
/* Carried as soon as the finger moves: the canvas, and the grip that sizes
   a picture in a note (small, and pressed for no other reason). */
const TOUCH_NOW = '#canvas, .fig-grip';
/* Carried only after a hold, so that a finger moving on them still
   scrolls the panel they are in. */
const TOUCH_HELD = '.draggable-row, .rich-surface:not(.locked) .rich-figure';
/* Never translated. A field takes the finger the way it takes the mouse,
   and its caret, selection handles and keyboard are the browser's. Asked
   only of what is NOT one of the above: a picture in a note stands inside
   an editable surface, and is still carried. */
const TOUCH_NATIVE = 'input, textarea, select, [contenteditable="true"]';

/* Guides, for a finger. Under a mouse the guides are asked for by holding
   Shift while carrying — an entry lines up on its neighbours, a bend on
   its route's corners, a callout swings to eighths, a connector's end
   comes to its marks. A finger has no Shift, and the hold that stands in
   for keys is already spoken for on an entry (it means Ctrl, a carry free
   of the grid). So the button on the toolbar holds Shift down for
   it: while it is lit, every finger that MOVES something moves it with
   Shift held. Only the moves and the release — never the press, because
   a press with Shift on open canvas is the selection box, and a finger
   panning the chart must go on panning. A held finger keeps its own
   meaning: a free carry asked for on purpose outranks a standing offer. */
let touchGuides = false;
const guideToggle = document.getElementById('guideToggle');
if(guideToggle) guideToggle.addEventListener('click', ()=>{
  touchGuides = !touchGuides;
  guideToggle.setAttribute('aria-pressed', touchGuides ? 'true' : 'false');
});
/* The button stands on the toolbar now, where a mouse reaches it too, and
   it means the same under a mouse: a carry made while it is lit is made
   with Shift held. Again the moves and the release only, and only with
   the button down — never the press, never the pointer merely passing. */
['mousemove', 'mouseup'].forEach(type=> window.addEventListener(type, (ev)=>{
  if(!touchGuides || ev.shiftKey || !ev.isTrusted) return;
  if(type === 'mousemove' && !(ev.buttons & 1)) return;
  Object.defineProperty(ev, 'shiftKey', {value: true});
}, true));
/* Undo and redo, which a phone has not got as keys: one button in two
   halves. Greyed when there is nothing to step to, asked again after
   every touch. */
const touchTools = document.getElementById('touchTools');
function syncTouchTools(){ syncUndoButtons(); }
if(touchTools){
  touchTools.addEventListener('mousedown', ev=> ev.stopPropagation());
  touchTools.addEventListener('click', ev=>{
    ev.stopPropagation();
    const b = ev.target.closest('button');
    if(!b || b.disabled || readOnlyView) return;
    if(b.dataset.act === 'undo') undoLastEdit(); else redoLastEdit();
    syncTouchTools();
  });
  document.addEventListener('touchend', ()=> setTimeout(syncTouchTools, 0), {passive: true});
  syncTouchTools();
}
/* Cut, copy, paste and delete, as a phone offers them over selected text:
 * a long press on an entry brings up a row of them above the finger. An
 * entry that is NOT selected yet is added to the selection first, as a
 * held tap always has (it stands for Ctrl), and the row comes up over the
 * whole selection — so picking several is holding them one after another.
 * It used to add the entry and stop there, and the menu came only on a
 * second hold: a long press on a thing that answered with nothing. A long
 * press on a connector opens its panel and offers Delete; on empty canvas
 * the row offers only Paste. Any other touch puts it away. */
const touchMenu = (()=>{
  const m = document.createElement('div');
  m.className = 'touch-menu';
  m.id = 'touchMenu';
  m.hidden = true;
  m.setAttribute('role', 'menu');
  [['cut', 'Cut'], ['copy', 'Copy'], ['paste', 'Paste'], ['array', 'Array'],
   ['merge', 'Merge'], ['unmerge', 'Unmerge'], ['split', 'Split'], ['branch', 'New line'], ['delete', 'Delete']].forEach(([act, label])=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.act = act;
    b.textContent = label;
    if(act === 'delete') b.className = 'danger';
    m.appendChild(b);
  });
  m.addEventListener('mousedown', ev=> ev.stopPropagation());
  m.addEventListener('click', ev=>{
    ev.stopPropagation();
    const b = ev.target.closest('button');
    if(!b) return;
    closeTouchMenu();
    if(readOnlyView) return;
    const act = b.dataset.act;
    if(act === 'cut') cutSelectedNode();
    else if(act === 'copy') copySelectedNode();
    else if(act === 'paste') pasteClipboardNode();
    else if(act === 'array') makeArrayOfSelection();
    else if((act === 'merge' || act === 'unmerge') && currentEdgeStyleTarget){
      const {from, to} = currentEdgeStyleTarget;
      closeEdgePopover();
      if(act === 'merge') mergeEdge(from, to); else unmergeEdge(from, to);
    }
    /* Split where the menu was asked for, then the next entry picked is
       where the new line goes; New line on a split asks for another. */
    else if(act === 'split' && currentEdgeStyleTarget){
      const {from, to} = currentEdgeStyleTarget;
      const f = splitFractionAt(from, to, touchMenu.at.x, touchMenu.at.y);
      closeEdgePopover();
      const id = f == null ? null : splitEdgeAt(from, to, f);
      if(id){ selectNode(id); beginSplitBranch(id); }
    }
    else if(act === 'branch' && selectedId) beginSplitBranch(selectedId);
    else if(act === 'delete') deletePicked();
    syncTouchTools();
  });
  const host = document.querySelector('.app > .main');
  if(host) host.appendChild(m);
  return m;
})();
/* `kind` is what was held: 'selection' (or true) offers everything, a
   connector ('edge') Delete and whichever of Merge and Unmerge it can take,
   and anything else only Paste. The merged arrow is not deleted on its
   own; Unmerge is how it goes. */
function openTouchMenu(x, y, kind, byMouse){
  let offers = (kind === true || kind === 'selection') ? ['cut', 'copy', 'paste', 'array', 'delete']
    : kind === 'edge' ? [] : ['paste'];
  if(kind === 'edge'){
    const t = currentEdgeStyleTarget;
    const can = t ? mergeOffersFor(t.from, t.to) : {};
    if(t && t.from !== '') offers.push('delete');
    if(can.merge) offers.push('merge');
    if(can.unmerge) offers.push('unmerge');
    if(t && splitOffered(t.from, t.to)) offers.push('split');
  }
  /* A split, held on its own, offers a new line out of it. */
  if((kind === true || kind === 'selection') && multiSelection.size <= 1 && isSplitNode(nodes.get(selectedId))) offers.push('branch');
  touchMenu.at = {x, y};
  touchMenu.querySelectorAll('button').forEach(b=>{
    b.hidden = !offers.includes(b.dataset.act);
  });
  /* An array is made round two entries or more (see makeArrayOfSelection);
     with fewer picked there is nothing for it to hold. */
  const arr = touchMenu.querySelector('[data-act="array"]');
  if(arr && !arr.hidden) arr.hidden = multiSelection.size < 2;
  touchMenu.hidden = false;
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const w = touchMenu.offsetWidth, h = touchMenu.offsetHeight;
  if(byMouse){
    /* From a right click it opens where menus open under a mouse: its
       corner at the pointer, turned back from an edge it would run over. */
    let left = x - host.left + 2, top = y - host.top + 2;
    if(left + w > host.width - 4) left = x - host.left - w - 2;
    if(top + h > host.height - 4) top = y - host.top - h - 2;
    touchMenu.style.left = Math.max(4, left) + 'px';
    touchMenu.style.top = Math.max(4, top) + 'px';
    return;
  }
  // Above the finger, clear of it; under it where there is no room above.
  let top = y - host.top - h - 28;
  if(top < 4) top = y - host.top + 28;
  touchMenu.style.left = Math.max(4, Math.min(x - host.left - w/2, host.width - w - 4)) + 'px';
  touchMenu.style.top = top + 'px';
}
function closeTouchMenu(){ touchMenu.hidden = true; }
document.addEventListener('touchstart', ev=>{
  if(!touchMenu.hidden && !touchMenu.contains(ev.target)) closeTouchMenu();
}, {passive: true, capture: true});
/* Whether a held tap here asks for the menu, and which one: on an entry
   that is part of the selection, the whole menu; on one that is not,
   the same once it has been added ('add'); on a connector, Delete; on
   empty canvas, Paste. */
function touchMenuFor(st){
  if(readOnlyView || !st.held) return null;
  const g = st.target.closest && st.target.closest('.node');
  if(g){
    const id = g.dataset.id;
    if(!id) return null;
    return (selectedId === id || multiSelection.has(id)) ? 'selection' : 'add';
  }
  const line = st.target.closest && st.target.closest('.edge-hit');
  if(line && line.dataset.to) return 'edge';
  /* A stretch of a merge's bar is its lineage, and offers what that
     lineage's connector does — Unmerge and Delete (the owner's list of
     30.10); a right click already did. */
  if(st.target.closest && st.target.closest('.amalgam-bar-hit')) return 'bar';
  const thing = '.edge-hit, .amalgam-bar-hit, .amalgam-junction-hit, .edge-note, .leader-line-hit, .leader-dot-hit, #bendLayer, .bio-card-g, .node-aura';
  return (svg.contains(st.target) && !st.target.closest(thing)) ? 'canvas' : null;
}
/* Open paper: on the chart, and on nothing that answers to a tap of its
   own — the things a held tap there would not offer Paste over either. */
const TOUCH_THINGS = '.node, .edge-hit, .amalgam-bar-hit, .edge-note, .leader-line-hit, .leader-dot-hit, #bendLayer, .bio-card-g, .node-aura, .lod-patch';
function touchOnOpenCanvas(target){
  return !!target && svg.contains(target) && !target.closest(TOUCH_THINGS);
}
/* A double tap on open paper zooms, as it does on every map a phone has.
 *
 * In, by two, about the place tapped — and from as far in as the chart
 * goes, back out to the whole of it, so the same gesture that went in is
 * the way out again and nobody has to find a pinch for it. A mouse has the
 * wheel for this and its double click on paper does nothing, so this is
 * the finger's alone. Eased rather than jumped: a view that changes in one
 * frame leaves the reader looking for where they were. */
const TOUCH_ZOOM_MAX = 3, TOUCH_ZOOM_MS = 220;
let touchZoomAnim = 0;
function touchZoomAt(x, y){
  const rect = svg.getBoundingClientRect();
  const from = {vs, vx, vy};
  let to;
  if(vs >= TOUCH_ZOOM_MAX - 1e-3){
    fitToView();
    to = {vs, vx, vy};
  } else {
    const mx = x - rect.left, my = y - rect.top;
    const s = Math.min(TOUCH_ZOOM_MAX, vs * 2);
    const wx = (mx - vx) / vs, wy = (my - vy) / vs;
    to = {vs: s, vx: mx - wx * s, vy: my - wy * s};
  }
  vs = from.vs; vx = from.vx; vy = from.vy;
  const t0 = performance.now(), id = ++touchZoomAnim;
  /* Eased in the scale's logarithm, so going in by two and coming back
     out look like the same motion run the two ways round; the corner of
     the view is placed from the world point under the finger, so that
     point stays under it all the way. */
  const step = (now)=>{
    if(id !== touchZoomAnim) return;
    const k = Math.min(1, (now - t0) / TOUCH_ZOOM_MS);
    const e = 1 - Math.pow(1 - k, 3);
    const s = Math.exp(Math.log(from.vs) + (Math.log(to.vs) - Math.log(from.vs)) * e);
    /* Where the two views agree on a fixed screen point, the zoom pivots
       on it; going in, that is the tap. Solved from the two ends rather
       than assumed, so the way out to the whole chart pivots too. */
    const d = to.vs - from.vs;
    if(Math.abs(d) > 1e-9){
      const px = (from.vx * to.vs - to.vx * from.vs) / d;
      const py = (from.vy * to.vs - to.vy * from.vs) / d;
      vx = px + (from.vx - px) * s / from.vs;
      vy = py + (from.vy - py) * s / from.vs;
    } else {
      vx = from.vx + (to.vx - from.vx) * e;
      vy = from.vy + (to.vy - from.vy) * e;
    }
    vs = s;
    if(k >= 1){ vs = to.vs; vx = to.vx; vy = to.vy; }
    applyTransform();
    if(k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function touchCarryMods(st){
  return st.mods || (touchGuides ? {shift: true} : null);
}

let touchGesture = null;
let touchLastTap = null;
let touchHoverChain = [];

/* The page learns it is being touched the first time it is. It is a class
   rather than a media query because a laptop with a touch screen is both,
   and what matters is how THIS reader is reaching the chart. */
function noteTouchInput(){
  if(!document.body.classList.contains('touch-input')) document.body.classList.add('touch-input');
}

function touchMouse(type, target, x, y, mods, detail){
  if(!target) return true;
  const up = type === 'mouseup' || type === 'click' || type === 'dblclick';
  const ev = new MouseEvent(type, {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: x, clientY: y, screenX: x, screenY: y,
    button: 0, buttons: up ? 0 : 1, detail: detail || 0,
    shiftKey: !!(mods && mods.shift), ctrlKey: !!(mods && mods.ctrl),
  });
  return target.dispatchEvent(ev);
}

/* Hover, as a finger has it: what was last touched is what the pointer is
   on. Entering and leaving are sent the way a mouse sends them — to every
   element whose box the pointer crossed into or out of, because the
   entries listen for mouseenter on themselves — and over and out are sent
   too, to the innermost element, because the style bar listens on the
   layer for those, which bubble. */
function touchHoverAt(el, x, y){
  const prev = touchHoverChain[0] || null;
  if(prev !== el){
    if(prev && prev.isConnected) prev.dispatchEvent(new MouseEvent('mouseout', {bubbles:true, view:window, relatedTarget: el}));
    if(el) el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, view:window, relatedTarget: prev,
                                                         clientX: x || 0, clientY: y || 0}));
  }
  const chain = [];
  for(let n = el; n && n.nodeType === 1; n = n.parentNode) chain.push(n);
  const keep = new Set(chain);
  const was = new Set(touchHoverChain);
  touchHoverChain.forEach(n=>{
    if(!keep.has(n) && n.isConnected) n.dispatchEvent(new MouseEvent('mouseleave', {bubbles:false, view:window}));
  });
  for(let i = chain.length - 1; i >= 0; i--){
    if(!was.has(chain[i])) chain[i].dispatchEvent(new MouseEvent('mouseenter', {bubbles:false, view:window}));
  }
  touchHoverChain = chain;
}

function touchTargetAt(x, y){
  return document.elementFromPoint(x, y) || document.documentElement;
}

/* Where a click lands after a press and a release on two different
   things: the nearest element holding both, as a browser does it. */
function touchClickTarget(a, b){
  if(!a || !a.isConnected) return b;
  if(!b) return a;
  for(let n = a; n; n = n.parentNode) if(n.contains && n.contains(b)) return n;
  return b;
}

/* The press itself, sent late. A finger that comes down might be the first
   of two, and a pinch must not begin by picking up whatever the first
   finger landed on — so nothing is said to the chart until the finger has
   either moved or let go. */
function touchPress(st, mods){
  st.mods = mods || null;
  st.pressed = true;
  touchHoverAt(st.target, st.x0, st.y0);
  const free = touchMouse('mousedown', st.target, st.x0, st.y0, st.mods, 1);
  /* A real press moves the focus to what was pressed — off a field in a
     panel, which is how a field learns it is done with. The touch that
     carried this one was cancelled, so its press has no default to do
     that; done here instead, unless the chart cancelled the press. */
  const active = document.activeElement;
  if(free && active && active !== document.body && !st.target.contains(active)) active.blur();
}

function touchHeld(st){
  st.held = true;
  if(navigator.vibrate){ try { navigator.vibrate(12); } catch(e){ /* not offered */ } }
}

function touchModsFor(st){
  if(!st.held) return null;
  /* Shift on open canvas draws the selection box; on anything else the
     hold means Ctrl, which is what carries an entry free of the grid and
     what adds a click to the selection instead of replacing it. The line
     is drawn where the canvas draws it: its own press asks only whether
     it landed inside an entry. */
  return st.target.closest('.node') ? {ctrl: true} : {shift: true};
}

/* ---- two fingers ---------------------------------------------------- */
/* Whatever is under the fingers stays under them: the world point at their
   midpoint is pinned there while they spread, close and travel. The basis
   is taken again whenever a finger joins or leaves, so lifting one of two
   carries straight on as a one-finger pan. */
function pinchBasis(st, touches){
  const rect = svg.getBoundingClientRect();
  let cx = 0, cy = 0;
  for(const t of touches){ cx += t.clientX; cy += t.clientY; }
  cx = cx / touches.length - rect.left; cy = cy / touches.length - rect.top;
  st.pinch = {
    n: touches.length,
    d: touches.length > 1 ? Math.hypot(touches[0].clientX - touches[1].clientX,
                                       touches[0].clientY - touches[1].clientY) : 0,
    vs, wx: (cx - vx) / vs, wy: (cy - vy) / vs,
  };
}
function pinchMove(st, touches){
  if(!st.pinch || st.pinch.n !== touches.length) pinchBasis(st, touches);
  const p = st.pinch, rect = svg.getBoundingClientRect();
  let cx = 0, cy = 0;
  for(const t of touches){ cx += t.clientX; cy += t.clientY; }
  cx = cx / touches.length - rect.left; cy = cy / touches.length - rect.top;
  if(touches.length > 1 && p.d > 0){
    const d = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    vs = Math.min(3, Math.max(0.08, p.vs * d / p.d));
  }
  vx = cx - p.wx * vs;
  vy = cy - p.wy * vs;
  applyTransform();
}

/* ---- the listeners -------------------------------------------------- */
document.addEventListener('touchstart', ev=>{
  noteTouchInput();
  const t0 = ev.changedTouches[0];
  let target = ev.target && ev.target.nodeType === 1 ? ev.target : null;
  /* A finger is a blob, and the browser hands its touch to whatever near
     it listens — on an entry that is often a border's connector strip
     rather than the box the finger is plainly on. With a box closed to a
     pixel off one line of words the strips are a few pixels from its
     middle, so a finger meant to carry the entry drew a connector out of
     it instead. Where the exact point under the finger is the same entry
     and not a strip, the entry is what was touched. */
  if(target && target.closest('.node-handle')){
    const exact = document.elementFromPoint(t0.clientX, t0.clientY);
    if(exact && !exact.closest('.node-handle') &&
       exact.closest('.node') === target.closest('.node')) target = exact;
  }

  /* A gesture still on the books while this is the only finger down is one
     whose end never reached us. It is closed rather than joined — joined,
     every touch after it would be read as a second finger, for good. */
  if(touchGesture && ev.touches.length === 1){
    const old = touchGesture;
    touchGesture = null;
    clearTimeout(old.holdTimer);
    if(old.pressed && !old.pinch) touchMouse('mouseup', touchTargetAt(old.x, old.y), old.x, old.y, old.mods);
  }
  /* A finger joining one already down. On the canvas that is a pinch —
     unless the first finger is already carrying something, which a second
     finger brushing the glass must not drop. */
  if(touchGesture){
    const st = touchGesture;
    if(st.kind !== 'now' || !svg.contains(st.target)) return;
    ev.preventDefault();
    if(st.pressed && !st.pinch){
      if(!dragging) return;              // carrying an entry, a connector, a corner
      touchMouse('mouseup', touchTargetAt(st.x, st.y), st.x, st.y, st.mods);
    }
    clearTimeout(st.holdTimer);
    st.pressed = true;                   // nothing more is said to the chart
    st.cancelled = true;
    pinchBasis(st, ev.touches);
    return;
  }
  if(!target || ev.touches.length !== 1) return;
  /* A row's own eye and ✕ are buttons, and a button is pressed, not
     carried — the row's press says the same. A video's controls are the
     reason it is in the note at all. */
  if(target.closest('button, a, video')) return;
  const now = target.closest(TOUCH_NOW);
  const held = !now && target.closest(TOUCH_HELD);
  if(!now && !held) return;
  if(!target.closest('.fig-grip, .rich-figure') && target.closest(TOUCH_NATIVE)) return;

  const st = {
    kind: now ? 'now' : 'held', target, id: t0.identifier,
    x0: t0.clientX, y0: t0.clientY, x: t0.clientX, y: t0.clientY,
    pressed: false, held: false, cancelled: false, mods: null, pinch: null,
  };
  touchGesture = st;
  touchFollow(target);
  st.holdTimer = setTimeout(()=>{
    if(touchGesture !== st || st.pressed || st.cancelled) return;
    touchHeld(st);
    /* A held row or picture is picked up at once — the hold is how it was
       asked for, and the finger is still on it. */
    if(st.kind === 'held') touchPress(st, null);
  }, TOUCH_HOLD);
  /* On the canvas the finger is ours from the start: no scrolling, no
     page zoom, and none of the browser's late compatibility events, which
     would arrive after ours and do every tap twice. */
  if(st.kind === 'now') ev.preventDefault();
}, {passive: false, capture: true});

function touchMoved(ev){
  if(ev.rhizomeSeen) return;
  ev.rhizomeSeen = true;
  const st = touchGesture;
  if(!st) return;
  if(st.pinch){ ev.preventDefault(); pinchMove(st, ev.touches); return; }
  const t = Array.from(ev.touches).find(t=> t.identifier === st.id);
  if(!t) return;
  st.x = t.clientX; st.y = t.clientY;
  const far = Math.hypot(st.x - st.x0, st.y - st.y0) > TOUCH_SLOP;
  if(st.kind === 'held'){
    /* Moved before the hold came: it is a scroll, and the panel has it. */
    if(!st.pressed){ if(far){ clearTimeout(st.holdTimer); touchGesture = null; touchFollow(null); } return; }
  } else if(!st.pressed){
    if(!far) return;
    clearTimeout(st.holdTimer);
    /* A reader cannot carry anything, and under a mouse a drag that starts
       on an entry simply does nothing for them. Under a finger that is
       most of the screen once the chart is zoomed in to be read, so for a
       reader every drag on the chart is a pan. A tap is still a tap. */
    if(readOnlyView && svg.contains(st.target)) st.target = svg;
    touchPress(st, touchModsFor(st));
  }
  ev.preventDefault();
  const under = touchTargetAt(st.x, st.y);
  touchHoverAt(under, st.x, st.y);
  touchMouse('mousemove', under, st.x, st.y, touchCarryMods(st));
}

function touchFinish(ev, cancelled){
  if(ev.rhizomeSeen) return;
  ev.rhizomeSeen = true;
  const st = touchGesture;
  if(!st) return;
  if(st.pinch){
    ev.preventDefault();
    if(ev.touches.length) pinchBasis(st, ev.touches);
    else { touchGesture = null; touchFollow(null); }
    return;
  }
  if(!Array.from(ev.changedTouches).some(t=> t.identifier === st.id)) return;
  touchGesture = null;
  touchFollow(null);
  clearTimeout(st.holdTimer);
  if(st.kind === 'held' && !st.pressed) return;    // a tap or a scroll: the browser's
  ev.preventDefault();
  const under = touchTargetAt(st.x, st.y);
  if(st.pressed){
    touchMouse('mouseup', under, st.x, st.y, touchCarryMods(st));
    /* A carry ends in a click, as it does under a mouse; the places that
       carry already swallow that one. A row has no click to give. */
    if(!cancelled && st.kind === 'now') touchMouse('click', touchClickTarget(st.target, under), st.x, st.y, st.mods, 1);
    touchLastTap = null;
    return;
  }
  if(cancelled) return;
  /* A held tap on an entry, a connector or empty canvas: the menu. What
     was held is first taken hold of the way a tap would — an entry added
     to the selection (a held tap is Ctrl), a connector's panel opened —
     so the menu's Delete has something to act on. */
  const menu = touchMenuFor(st);
  if(menu === 'bar'){
    touchLastTap = null;
    const bar = st.target.closest('.amalgam-bar-hit');
    openBarStretch(bar.dataset.amalgam, {clientX: st.x0, clientY: st.y0, stopPropagation(){}});
    if(edgePopover.classList.contains('open') && currentEdgeStyleTarget) openTouchMenu(st.x0, st.y0, 'edge');
    return;
  }
  if(menu){
    touchLastTap = null;
    if(menu === 'add' || menu === 'edge'){
      /* A connector held while another one's panel is open is picked
         beside it, as an entry held beside the selection is. */
      const line = menu === 'edge' && st.target.closest('.edge-hit');
      const t = currentEdgeStyleTarget;
      const beside = !!(line && t && edgePopover.classList.contains('open') &&
        (t.from !== line.dataset.from || t.to !== line.dataset.to));
      const mods = (menu === 'add' || beside) ? {ctrl: true} : null;
      touchPress(st, mods);
      touchMouse('mouseup', under, st.x0, st.y0, mods, 1);
      touchMouse('click', touchClickTarget(st.target, under), st.x0, st.y0, mods, 1);
      /* Only over what the tap really took hold of. A dimmed connector
         behind a selection answers a tap by letting the selection go,
         and a Delete offered then would have nothing to delete — or,
         worse, the wrong thing. */
      const id = st.target.closest('.node') && st.target.closest('.node').dataset.id;
      const got = menu === 'add' ? (selectedId === id || multiSelection.has(id))
        : edgePopover.classList.contains('open') && !!currentEdgeStyleTarget;
      if(!got) return;
    }
    openTouchMenu(st.x0, st.y0, menu === 'edge' ? 'edge' : menu === 'canvas' ? 'canvas' : 'selection');
    return;
  }
  /* A tap — or a held tap, which is a Ctrl-click. The whole press is sent
     now, and a second tap close behind the first is a double click. */
  const mods = touchModsFor(st);
  const prev = touchLastTap;
  const isDouble = !mods && prev && ev.timeStamp - prev.t < TOUCH_DOUBLE &&
    Math.hypot(st.x0 - prev.x, st.y0 - prev.y) < TOUCH_DOUBLE_REACH;
  const detail = isDouble ? 2 : 1;
  touchPress(st, mods);
  touchMouse('mouseup', under, st.x0, st.y0, mods, detail);
  const at = touchClickTarget(st.target, under);
  touchMouse('click', at, st.x0, st.y0, mods, detail);
  if(isDouble){
    if(touchOnOpenCanvas(st.target)) touchZoomAt(st.x0, st.y0);
    else touchMouse('dblclick', at, st.x0, st.y0, mods, 2);
    touchLastTap = null;
    return;
  }
  touchLastTap = mods ? null : {t: ev.timeStamp, x: st.x0, y: st.y0};
  /* The finger is still "on" what it tapped, and a mouse resting there
     would be offered whatever hovering offers — the style bar above all,
     which a press puts away and nothing but arriving again brings back.
     Under a mouse arriving again is free; a finger can only tap again,
     which would put it away again. So a tap ends by arriving once more. */
  /* Arriving AT the place it was tapped. It was sent with no place at
     all, which is (0, 0): harmless for an entry, whose bar stands over
     the entry, but a connector's bar stands where the pointer met the
     line — so on a phone it went up in the top corner of the page, under
     the header, and the connector looked as if it had no bar at all. */
  const rest = touchHoverChain[0];
  if(rest && rest.isConnected) rest.dispatchEvent(new MouseEvent('mouseover',
    {bubbles:true, view:window, relatedTarget: null, clientX: st.x0, clientY: st.y0}));
}
const touchEnded = ev=> touchFinish(ev, false);
const touchCancelled = ev=> touchFinish(ev, true);
document.addEventListener('touchmove', touchMoved, {passive: false, capture: true});
document.addEventListener('touchend', touchEnded, {passive: false, capture: true});
document.addEventListener('touchcancel', touchCancelled, {passive: false, capture: true});

/* A touch belongs to the element it began on for its whole life, and its
   events are sent there even after that element has left the page — where
   they no longer reach the document. On this chart that happens: carrying
   an entry redraws it, and the finger is still on the old one. So the
   element is listened to directly as well, for as long as the touch lasts;
   whichever hears an event first handles it, and the other sees it was
   handled. */
let touchFollowed = null;
function touchFollow(el){
  if(touchFollowed){
    touchFollowed.removeEventListener('touchmove', touchMoved);
    touchFollowed.removeEventListener('touchend', touchEnded);
    touchFollowed.removeEventListener('touchcancel', touchCancelled);
  }
  touchFollowed = el;
  if(!el) return;
  el.addEventListener('touchmove', touchMoved, {passive: false});
  el.addEventListener('touchend', touchEnded, {passive: false});
  el.addEventListener('touchcancel', touchCancelled, {passive: false});
}

/* A held finger is a modifier here, not a request for the browser's own
   menu — which on a phone would otherwise open over whatever the hold was
   for. */
document.addEventListener('contextmenu', ev=>{
  if(touchGesture) ev.preventDefault();
}, true);

/* The same menu from a right click (the owner's ask, 22.10): Cut, Copy,
 * Paste, Array and Delete over what was clicked, as a long press gives
 * them on a phone. What was clicked is taken hold of as a left click
 * would — an entry outside the selection becomes the selection, as it
 * does in every file manager, and a connector's panel opens — so the menu
 * acts on what the pointer was on. A right click inside the selection
 * keeps the selection whole. Text being written keeps the browser's own
 * menu, which is where spelling and the clipboard live there. */
svg.addEventListener('contextmenu', ev=>{
  if(touchGesture || readOnlyView) return;
  const t = ev.target;
  if(t.closest && t.closest('[contenteditable="true"], [contenteditable="plaintext-only"], input, textarea')) return;
  /* Nothing on the chart gets the browser's menu (the owner's list of
     29.10): a right click on a merge's bar, a corner or a callout's point
     used to fall through to Back, Reload and Print, because the menu
     below only knew entries, connectors and paper. Each of those things
     stands for an entry or a connector, and the menu is that one's. */
  ev.preventDefault();
  const st = {held: true, target: t};
  let kind = touchMenuFor(st), id = null;
  if(kind === 'add') id = t.closest('.node').dataset.id;
  if(!kind || kind === 'bar'){
    const held = rightClickHolds(t, ev);
    if(!held) return;
    kind = held.kind; id = held.id;
  }
  closeTouchMenu();
  const click = ()=> t.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true,
                                                              clientX: ev.clientX, clientY: ev.clientY, button: 0}));
  if(kind === 'add' && id && (selectedId === id || multiSelection.has(id))) kind = 'selection';
  if(kind === 'add'){
    /* Picked quietly: the menu is what was asked for, not the entry's
       panel, which a left click would open. */
    selectNode(id, {quiet: true});
    paintMultiSelection();
    openTouchMenu(ev.clientX, ev.clientY, 'selection', true);
  } else if(kind === 'edge'){
    click();
    if(!edgePopover.classList.contains('open')) return;
    openTouchMenu(ev.clientX, ev.clientY, 'edge', true);
  } else if(kind === 'held-edge'){
    // Already taken hold of by rightClickHolds.
    if(!edgePopover.classList.contains('open')) return;
    openTouchMenu(ev.clientX, ev.clientY, 'edge', true);
  } else {
    openTouchMenu(ev.clientX, ev.clientY, kind, true);
  }
});
/* What a right click on a thing that is not an entry, a connector or
   paper stands for, taken hold of as the menu needs it: a stretch of a
   merge's bar is its lineage, a note on a line and the corners of the
   picked line are that line, a callout's point and leader are the
   callout, a merge's junction is the merged entry, and an entry's glow
   or picture card is the entry. */
function rightClickHolds(t, ev){
  if(!t.closest) return null;
  const note = t.closest('.edge-note');
  if(note){
    openEdgeStylePopover(note.dataset.from, note.dataset.to, ev);
    return {kind: 'held-edge'};
  }
  const bar = t.closest('.amalgam-bar-hit');
  if(bar){
    openBarStretch(bar.dataset.amalgam, ev);
    return {kind: 'held-edge'};
  }
  if(t.closest('#bendLayer')) return currentEdgeStyleTarget ? {kind: 'held-edge'} : {kind: 'canvas'};
  const one = t.closest('.amalgam-junction-hit, .leader-line-hit, .leader-dot-hit, .node-aura, .node-aura-hit, .bio-card-g');
  const id = one && (one.dataset.amalgam || one.dataset.id);
  if(id && nodes.has(id)) return {kind: 'add', id};
  return svg.contains(t) ? {kind: 'canvas'} : null;
}
/* A mouse puts the menu away the way a finger does: by pressing anywhere
   else, or with Escape. */
document.addEventListener('mousedown', ev=>{
  if(!touchMenu.hidden && !touchMenu.contains(ev.target)) closeTouchMenu();
}, true);
document.addEventListener('keydown', ev=>{
  if(ev.key === 'Escape' && !touchMenu.hidden){ closeTouchMenu(); ev.stopPropagation(); }
}, true);
