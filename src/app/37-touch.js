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
   element whose box the pointer crossed into or out of — because the
   entries listen for mouseenter on themselves, not for anything that
   bubbles. */
function touchHoverAt(el){
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
  touchHoverAt(st.target);
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
  const target = ev.target && ev.target.nodeType === 1 ? ev.target : null;

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
  touchHoverAt(under);
  touchMouse('mousemove', under, st.x, st.y, st.mods);
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
    touchMouse('mouseup', under, st.x, st.y, st.mods);
    /* A carry ends in a click, as it does under a mouse; the places that
       carry already swallow that one. A row has no click to give. */
    if(!cancelled && st.kind === 'now') touchMouse('click', touchClickTarget(st.target, under), st.x, st.y, st.mods, 1);
    touchLastTap = null;
    return;
  }
  if(cancelled) return;
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
    touchMouse('dblclick', at, st.x0, st.y0, mods, 2);
    touchLastTap = null;
  } else touchLastTap = mods ? null : {t: ev.timeStamp, x: st.x0, y: st.y0};
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
