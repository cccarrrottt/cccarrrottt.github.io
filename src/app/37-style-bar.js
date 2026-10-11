/* ---------------------------------------------------------------------
   The style bar: how a thing is outlined, offered where the thing is.
 *
 * The border style and the corners lived in the entry's settings panel,
 * three clicks away from the box they changed and at the far side of the
 * screen from it — so changing a look meant opening a form, finding the
 * row, and looking back at the chart to see what had happened. They are a
 * look, and a look is picked best while looking at it: the bar appears
 * over an entry, a callout or a connector's note as the pointer reaches
 * it, and goes when the pointer leaves both.
 *
 * Two kinds of thing wear it:
 *
 *   an entry    the six border styles and the two corners. A portrait's
 *               circle has no corners of its own; on a portrait the
 *               corners are its card's (see bioCardSquare).
 *   a note      framed or bare, and its corners — a remark on a line
 *               chooses how it is written down, and the line's own
 *               corners are the line's.
 *
 * And an entry has one more button, at the end: a quarter turn clockwise.
 * It used to be a round arrow standing off the entry's corner, a handle
 * among four grips, a link badge and a row of language chips — one more
 * thing to miss on a small box, and on a phone one more thing in the way
 * of the finger. A turn is a look too, and a button is a press with no
 * aim in it. A picture, which has no bar, keeps the same button in its
 * own menu (see freeMenuTurn).
 *
 * Every click is one step of undo, and the bar stays where it is through
 * the redraw, on the thing it was opened for, so several looks can be
 * tried in a row.
   ------------------------------------------------------------------ */
const STYLE_BAR_BORDERS = [
  ['solid', '──', 'Solid border'], ['dashed', '╌╌', 'Dashed border'],
  ['dotted', '┈┈', 'Dotted border'], ['dashdot', '─·', 'Dash-dotted border'],
  ['double', '═', 'Double border'], ['wavy', '∿', 'Wavy border — the old pocket-reality edge']
];
const STYLE_BAR_CORNERS = [['square', '┌', 'Square corners'], ['round', '╭', 'Rounded corners']];
const STYLE_BAR_FRAMES = [['frame', '▭', 'A frame round the note'], ['bare', '⌧', 'No frame']];
const STYLE_BAR_TURN = [['quarter', '⟳', 'Turn a quarter clockwise']];
/* A callout's leader, in the connector's own vocabulary — see
   drawLeaderLine. The bar opens on the LINE for these, as it opens on a
   note for a note's: the line is what they change, and asked for on the
   card at the far end of it they read as a change to the card. */
const STYLE_BAR_LEADER = [
  ['solid', '──', 'Solid leader line'], ['dashed', '╌╌', 'Dashed leader line'],
  ['dotted', '┈┈', 'Dotted leader line'], ['dashdot', '─·', 'Dash-dotted leader line'],
  ['double', '═', 'Double leader line'], ['sinusoid', '∿', 'Wavy leader line']
];
/* And what the leader leads to: a card, or — as on an engineering
   drawing — a shelf the words stand on, the leader meeting its near end. */
const STYLE_BAR_LEADER_FORM = [
  ['card', '▭', 'Leader to a card round the words'],
  ['shelf', '⎽', 'Drafting leader: the words on a shelf, the leader to its end']
];
/* How long the bar waits, once the pointer has left, before it goes —
   long enough to cross the gap between the thing and the bar. */
const STYLE_BAR_LINGER = 260;

const styleBar = (()=>{
  const bar = document.createElement('div');
  bar.className = 'style-bar';
  bar.id = 'styleBar';
  bar.hidden = true;
  const group = (name, list)=>{
    const row = document.createElement('div');
    row.className = 'style-bar-group';
    row.dataset.group = name;
    list.forEach(([value, glyph, title])=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.value = value;
      b.textContent = glyph;
      b.title = title;
      row.appendChild(b);
    });
    bar.appendChild(row);
    return row;
  };
  group('border', STYLE_BAR_BORDERS);
  group('frame', STYLE_BAR_FRAMES);
  group('corners', STYLE_BAR_CORNERS);
  group('turn', STYLE_BAR_TURN);
  group('leader', STYLE_BAR_LEADER);
  group('leaderForm', STYLE_BAR_LEADER_FORM);
  bar.addEventListener('mousedown', ev=> ev.stopPropagation());
  bar.addEventListener('dblclick', ev=> ev.stopPropagation());
  bar.addEventListener('mouseenter', ()=> clearTimeout(styleBarTimer));
  bar.addEventListener('mouseleave', ()=> letStyleBarGo());
  bar.addEventListener('click', ev=>{
    ev.stopPropagation();
    const b = ev.target.closest('button');
    if(!b || b.disabled || !styleBarTarget) return;
    applyStyleBar(b.parentNode.dataset.group, b.dataset.value);
  });
  const host = document.querySelector('.main');
  if(host) host.appendChild(bar);
  return bar;
})();
/* What the bar is open on: {kind:'node', id}, {kind:'note', from, to} or
   {kind:'leader', id} — a callout's leader line, by the callout's id. */
let styleBarTarget = null;
let styleBarTimer = null;

function styleBarNode(){
  return styleBarTarget && styleBarTarget.kind === 'node' ? nodes.get(styleBarTarget.id) : null;
}
/* Whether an entry wears the bar at all. A picture and a caption are
   furniture with a menu of their own (see openFreeMenu), not boxes. */
function styleBarWants(n){
  return !!n && !isFreeShape(n.shape || '');
}
function openStyleBar(target){
  if(readOnlyView) return;
  if(typeof nodeDragState !== 'undefined' && nodeDragState && nodeDragState.moved) return;
  clearTimeout(styleBarTimer);
  styleBarTarget = target;
  syncStyleBar();
}
function letStyleBarGo(){
  clearTimeout(styleBarTimer);
  styleBarTimer = setTimeout(closeStyleBar, STYLE_BAR_LINGER);
}
function closeStyleBar(){
  clearTimeout(styleBarTimer);
  styleBarTarget = null;
  styleBar.hidden = true;
}
/* The buttons, lit and greyed for the thing the bar is on, and the bar put
   over it. */
function syncStyleBar(){
  const t = styleBarTarget;
  const n = styleBarNode();
  const style = t && t.kind === 'note' ? edgeStyleFor(t.from, t.to) : null;
  const callout = t && t.kind === 'leader' ? nodes.get(t.id) : null;
  if(!t || (t.kind === 'node' && !styleBarWants(n)) || (t.kind === 'note' && !style.note) ||
     (t.kind === 'leader' && !(callout && callout.leader))){
    closeStyleBar();
    return;
  }
  const rows = {};
  styleBar.querySelectorAll('.style-bar-group').forEach(r=> rows[r.dataset.group] = r);
  const light = (row, value, off)=>{
    row.querySelectorAll('button').forEach(b=>{
      b.classList.toggle('on', b.dataset.value === value);
      b.disabled = !!(off && off(b.dataset.value));
    });
  };
  rows.turn.hidden = !n;
  rows.leader.hidden = rows.leaderForm.hidden = !callout;
  if(callout){
    rows.border.hidden = rows.frame.hidden = rows.corners.hidden = true;
    light(rows.leader, callout.leader.line || 'solid');
    light(rows.leaderForm, callout.leader.shelf ? 'shelf' : 'card');
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  rows.corners.hidden = false;
  if(n){
    rows.border.hidden = false;
    rows.frame.hidden = true;
    const shape = n.shape || '';
    /* The ripple is drawn only where WAVY_BORDER_SHAPES does not refuse it,
       and a rippled box keeps its rounded corners whatever is chosen — so
       both buttons are greyed where they would change nothing, rather than
       left to look as if they had been ignored. */
    const portrait = shape === 'ellipse';
    /* A portrait ripples too, by a way of its own (isWavyPortrait); its
       card then ripples with it, and a rippled card has no corners to
       square, as a rippled box has none. */
    /* A callout on a shelf has no card, and so no corners; its border
       style is the shelf's, which is one line — a pattern, not a second
       rail or a ripple. */
    const shelf = !!(isCalloutNode(n) && n.leader && n.leader.shelf);
    light(rows.border, borderStyleOf(n), (v)=> (v === 'wavy' && !portrait && WAVY_BORDER_SHAPES.includes(shape)) ||
                                               (shelf && (v === 'wavy' || v === 'double')));
    light(rows.corners, n.square ? 'square' : 'round',
          ()=> shelf || (portrait ? isWavyPortrait(n) : (isWavyBorder(n) || SQUARE_CORNER_SHAPES.includes(shape))));
    rows.corners.querySelectorAll('button').forEach(b=>{
      const own = STYLE_BAR_CORNERS.find(c=> c[0] === b.dataset.value)[2];
      b.title = portrait ? own + ' on the portrait’s card' : own;
    });
  } else {
    rows.border.hidden = true;
    rows.frame.hidden = false;
    light(rows.frame, style.noteFrame === false ? 'bare' : 'frame');
    /* A note with its frame taken off has no corners left to choose: the
       buttons are greyed rather than left to look as if they did nothing. */
    light(rows.corners, style.noteSquare ? 'square' : 'round', ()=> style.noteFrame === false);
  }
  styleBar.hidden = false;
  positionStyleBar();
}
/* Over the thing, on its left edge, clear of its outermost border; under
   it instead where there is no room above. */
function positionStyleBar(){
  const t = styleBarTarget;
  if(!t || styleBar.hidden) return;
  const host = document.querySelector('.main').getBoundingClientRect();
  let left, top, bottom;
  if(t.kind === 'node'){
    const n = nodes.get(t.id);
    if(!n){ closeStyleBar(); return; }
    const sr = svg.getBoundingClientRect();
    const out = (ringCountOf(n) - 1) * ringStepFor(n) + (isWavyBorder(n) ? POCKET_AMP : 0);
    left = sr.left - host.left + (n.x - out) * vs + vx;
    top = sr.top - host.top + (n.y - out) * vs + vy;
    bottom = sr.top - host.top + (n.y + n.h + out) * vs + vy;
  } else if(t.kind === 'leader'){
    const line = document.querySelector(`.callout-leader[data-id="${CSS.escape(t.id)}"] .leader-line`);
    if(!line){ closeStyleBar(); return; }
    const r = line.getBoundingClientRect();
    left = r.left + r.width/2 - host.left - (styleBar.offsetWidth || 0)/2;
    // Over the whole of a slanting line, so the bar covers none of it.
    top = r.top - host.top;
    bottom = r.bottom - host.top;
  } else {
    const g = document.querySelector(`.edge-note[data-from="${CSS.escape(t.from)}"]` +
                                     `[data-to="${CSS.escape(t.to)}"]`);
    if(!g){ closeStyleBar(); return; }
    const r = g.getBoundingClientRect();
    left = r.left - host.left;
    top = r.top - host.top;
    bottom = r.bottom - host.top;
  }
  const h = styleBar.offsetHeight || 30;
  const above = top - h - 6;
  /* Kept inside the right edge as well as the left: on a phone the bar is
     most of the screen wide, and an entry near the right edge would have
     pushed half its buttons out of reach. */
  const room = host.width - styleBar.offsetWidth - 4;
  styleBar.style.left = Math.max(4, Math.min(left, room)) + 'px';
  styleBar.style.top = (above >= 4 ? above : bottom + 6) + 'px';
}
function applyStyleBar(group, value){
  const t = styleBarTarget;
  if(!t) return;
  if(t.kind === 'node' && group === 'turn'){
    const n = nodes.get(t.id);
    if(!n) return;
    /* The bar stays exactly where it is. Put back over the turned box it
       would jump to a new place after every press, and the button would
       no longer be under the hand that wants to press it again. */
    const left = styleBar.style.left, top = styleBar.style.top;
    turnEntryTo(t.id, quarterTurnOf(n) + 90);
    syncStyleBar();
    if(!styleBar.hidden){ styleBar.style.left = left; styleBar.style.top = top; }
    return;
  } else if(t.kind === 'node' || t.kind === 'leader'){
    applyEdit(()=>{
      const found = workingEntry(t.id);
      if(!found) return;
      const opts = entryOpts(found.entry);
      if(group === 'border'){
        if(value === 'solid') delete opts.border; else opts.border = value;
      } else if(group === 'corners'){
        // Square is the default, so it is the absence of the flag.
        if(value === 'square') delete opts.square; else opts.square = false;
      } else if(group === 'leader'){
        if(!opts.leader) return;
        // Solid is the absence of the field, as everywhere else.
        opts.leader = Object.assign({}, opts.leader);
        if(LEADER_LINES.includes(value)) opts.leader.line = value; else delete opts.leader.line;
      } else if(group === 'leaderForm'){
        if(!opts.leader) return;
        opts.leader = Object.assign({}, opts.leader);
        if(value === 'shelf') opts.leader.shelf = true; else delete opts.leader.shelf;
      }
      putEntry(found.index, found.entry, opts);
    });
  } else {
    applyEdit(()=>{
      const o = EDGE_STYLES.find(s=> s.from === t.from && s.to === t.to);
      if(!o) return;
      if(group === 'frame'){
        if(value === 'bare') o.noteFrame = false; else delete o.noteFrame;
      } else if(group === 'corners'){
        if(value === 'square') o.noteSquare = true; else delete o.noteSquare;
      }
    });
  }
  syncStyleBar();
}
/* Reached by hovering, so it is wired to the layers rather than to each
   entry: every redraw replaces the entries, and a listener on the layer is
   still there afterwards. */
{
  const over = (ev)=>{
    if(readOnlyView) return;
    const lead = ev.target.closest && ev.target.closest('.leader-line-hit');
    if(lead){
      openStyleBar({kind:'leader', id: lead.dataset.id});
      return;
    }
    const note = ev.target.closest && ev.target.closest('.edge-note');
    if(note){
      openStyleBar({kind:'note', from: note.dataset.from, to: note.dataset.to});
      return;
    }
    const g = ev.target.closest && ev.target.closest('.node');
    if(g && g.dataset.id && styleBarWants(nodes.get(g.dataset.id))){
      openStyleBar({kind:'node', id: g.dataset.id});
    }
  };
  const out = (ev)=>{
    const from = ev.target.closest && ev.target.closest('.node, .edge-note, .leader-line-hit');
    if(!from) return;
    const to = ev.relatedTarget;
    if(to && (from.contains(to) || styleBar.contains(to))) return;
    letStyleBarGo();
  };
  svg.addEventListener('mouseover', over);
  svg.addEventListener('mouseout', out);
  /* Anything that moves the chart under the bar takes it away, rather
     than leaving it standing over a place the thing has left. */
  svg.addEventListener('mousedown', ()=> closeStyleBar());
  svg.addEventListener('wheel', ()=> closeStyleBar(), {passive: true});
}
