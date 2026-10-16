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
 *   a note      framed or bare, its corners, which side of the line it
 *               rides and what it is written on — a remark on a line
 *               chooses how it is written down, and the line's own
 *               corners are the line's.
 *   a connector its pattern, its elbows and its arrowheads, offered where
 *               the pointer reached the line. They were rows of the
 *               connector's panel; what is left there is the route and
 *               the paint.
 *
 * And an entry has one more button, at the end: a quarter turn clockwise.
 * It used to be a round arrow standing off the entry's corner, a handle
 * among four grips, a link badge and a row of language chips — one more
 * thing to miss on a small box, and on a phone one more thing in the way
 * of the finger. A turn is a look too, and a button is a press with no
 * aim in it.
 *
 * Loose furniture — a caption, a picture — wears a bar of ONE button:
 * where it stands in the stack. It turns by the handle at its corner
 * instead, freely, so it is offered no quarter turn; and its file, its
 * URL and its type are a form's work and stay in its own menu. The stack
 * was two buttons in that form, "Behind" and "In front", which is one
 * yes-or-no asked twice — and asked in a panel, about a thing on the
 * drawing, which is the fault the whole bar exists to fix.
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
/* One button, not two: lit, the corners are rounded; dark, they are
   square. Two buttons for one yes-or-no was one more thing on the bar. */
const STYLE_BAR_CORNERS = [['round', '╭', 'Rounded corners — press again for square ones']];
const STYLE_BAR_FRAMES = [['frame', '▭', 'A frame round the note'], ['bare', '⌧', 'No frame']];
const STYLE_BAR_TURN = [['quarter', '⟳', 'Turn a quarter clockwise']];
/* One button for the stack, the same bargain the corners make: lit, the
   thing is behind the chart; dark, it is over it. Furniture has never had
   a third place to be — "normal", in the middle of the entry layer,
   looked identical to "in front" in every arrangement that mattered. */
const STYLE_BAR_STACK = [['behind', '⧉', 'Behind the entries and the arrows — press again to put it in front']];
/* An entry's SCENERY — a hub's echo, a local multiverse's stack — which
   is drawn in a look of its own rather than in the box's (see
   decorStyleOf), and so needs somewhere to choose it. The same six, since
   the scenery is outlines like any other. */
const STYLE_BAR_DECOR = [
  ['solid', '──', 'Solid scenery'], ['dashed', '╌╌', 'Dashed scenery'],
  ['dotted', '┈┈', 'Dotted scenery'], ['dashdot', '─·', 'Dash-dotted scenery'],
  ['double', '═', 'Double scenery'], ['wavy', '∿', 'Wavy scenery']
];
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
/* A connector's own line, and its two ends. */
const STYLE_BAR_EDGE_LINE = [
  ['solid', '──', 'Solid line'], ['dashed', '╌╌', 'Dashed line'],
  ['dotted', '┈┈', 'Dotted line'], ['dashdot', '─·', 'Dash-dotted line'],
  ['double', '═', 'Double line'], ['sinusoid', '∿', 'Wavy line']
];
const STYLE_BAR_ENDS = [['in', '◄', 'Arrowhead at the start'], ['out', '►', 'Arrowhead at the end']];
/* Which side of its line a note rides. */
const STYLE_BAR_NOTE_SIDE = [
  ['above', '↑', 'Above the line'], ['on', '≡', 'On the line, covering it'], ['below', '↓', 'Below the line']
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
  group('decor', STYLE_BAR_DECOR);
  group('frame', STYLE_BAR_FRAMES);
  group('edgeLine', STYLE_BAR_EDGE_LINE);
  group('corners', STYLE_BAR_CORNERS);
  group('ends', STYLE_BAR_ENDS);
  group('turn', STYLE_BAR_TURN);
  group('stack', STYLE_BAR_STACK);
  group('leader', STYLE_BAR_LEADER);
  group('leaderForm', STYLE_BAR_LEADER_FORM);
  group('noteSide', STYLE_BAR_NOTE_SIDE);
  /* A colour typed on the bar, with the square that shows it beside the
     box — the same pair every hex field on the page is: a box no wider
     than the longest code it can hold, and the colour it names. Blank is
     the paper. Typing is one step of undo however long it runs. */
  const hexGroup = (name, title, apply)=>{
    const row = group(name, []);
    row.classList.add('style-bar-hex');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'hex-input';
    input.placeholder = 'white';
    input.maxLength = 9;
    input.spellcheck = false;
    input.title = title;
    const chip = document.createElement('span');
    chip.className = 'hex-preview';
    row.appendChild(input);
    row.appendChild(chip);
    input.addEventListener('mousedown', ev=> ev.stopPropagation());
    input.addEventListener('keydown', ev=> ev.stopPropagation());
    input.addEventListener('input', ()=>{
      if(!styleBarTarget || readOnlyView) return;
      const v = input.value.trim();
      if(v && !readHex(input)) return;
      input.classList.remove('bad');
      paintHexChip(chip, v);
      if(input.dataset.pushed !== '1'){ pushUndo(); input.dataset.pushed = '1'; }
      apply(styleBarTarget, v);
      refreshSaveUI();
    });
    input.addEventListener('blur', ()=>{ delete input.dataset.pushed; });
    return row;
  };
  /* The plate's ground. Its INK is the connector's and is not the
     reader's to set; what it is written on is. */
  hexGroup('noteBg', 'What the note is written on — blank is the paper', (t, v)=>{
    if(t.kind !== 'note') return;
    const o = EDGE_STYLES.find(s=> s.from === t.from && s.to === t.to);
    if(!o) return;
    if(v) o.noteBg = v; else delete o.noteBg;
    redrawEdges();
  });
  /* And a callout's card, which is an entry's box and fills as one does —
     from opts.bg. A shelf has no card to fill, and is not offered it. */
  hexGroup('cardBg', 'What the callout is written on — blank is the paper', (t, v)=>{
    if(t.kind !== 'node') return;
    const found = workingEntry(t.id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    if(v) opts.bg = [v]; else delete opts.bg;
    putEntry(found.index, found.entry, opts);
    rebuildChart();
  });
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
/* What the bar is open on: {kind:'node', id}, {kind:'note', from, to},
   {kind:'leader', id} — a callout's leader line, by the callout's id — or
   {kind:'edge', from, to, x, y}, a connector, with where on the screen the
   pointer met it, since a line has no corner to stand the bar over. */
let styleBarTarget = null;
/* The square beside a typed colour: the colour when the text is one, the
   paper's dashed outline when it is blank or not a colour yet. */
function paintHexChip(chip, v){
  if(!chip) return;
  const ok = !!v && HEX_RE.test(v);
  chip.style.background = ok ? v : '';
  chip.classList.toggle('empty', !ok);
}
let styleBarTimer = null;

function styleBarNode(){
  return styleBarTarget && styleBarTarget.kind === 'node' ? nodes.get(styleBarTarget.id) : null;
}
function styleBarDecorNode(){
  return styleBarTarget && styleBarTarget.kind === 'decor' ? nodes.get(styleBarTarget.id) : null;
}
/* Whether an entry wears the bar at all. Everything on the chart does: a
   box wears the outlines and the turn, furniture the one stack button.
   Furniture has a menu of its own as well (see openFreeMenu), for the
   things a form is the right place for. */
function styleBarWants(n){
  return !!n;
}
// …and whether what it wears is the furniture bar rather than the box one.
function styleBarFree(n){
  return !!n && isFreeShape(n.shape || '');
}
function openStyleBar(target){
  if(readOnlyView) return;
  if(typeof nodeDragState !== 'undefined' && nodeDragState && nodeDragState.moved) return;
  clearTimeout(styleBarTimer);
  /* On a line the bar stays where it first came up while the pointer runs
     along the same line: following it would move the buttons out from
     under the hand that is going for them. */
  const t = styleBarTarget;
  if(target.kind === 'edge' && t && t.kind === 'edge' && t.from === target.from && t.to === target.to &&
     !styleBar.hidden) return;
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
  const style = t && (t.kind === 'note' || t.kind === 'edge') ? edgeStyleFor(t.from, t.to) : null;
  const callout = t && t.kind === 'leader' ? nodes.get(t.id) : null;
  if(!t || (t.kind === 'node' && !styleBarWants(n)) || (t.kind === 'note' && !style.note) ||
     (t.kind === 'decor' && !nodes.get(t.id)) ||
     (t.kind === 'leader' && !(callout && callout.leader))){
    closeStyleBar();
    return;
  }
  const decorOn = styleBarDecorNode();
  const rows = {};
  styleBar.querySelectorAll('.style-bar-group').forEach(r=> rows[r.dataset.group] = r);
  rows.decor.hidden = !decorOn;
  const light = (row, value, off)=>{
    /* A greyed button still shows whether it is pressed. Greying says
       the choice does nothing just now — the wave is drawn through the
       elbows, the frame is off — and the choice itself is still written
       down and comes back with whatever greyed it: rounded elbows stay
       rounded under a wave, and are rounded again when the wave is taken
       off. Unlit while greyed, the bar claimed the opposite of what the
       entry would do the moment the button came back. */
    row.querySelectorAll('button').forEach(b=>{
      b.disabled = !!(off && off(b.dataset.value));
      b.classList.toggle('on', b.dataset.value === value);
    });
  };
  rows.turn.hidden = !n || styleBarFree(n);
  /* Furniture's bar is the stack and nothing else. A caption and a
     picture have no border of their own to outline, no corners, and
     nothing a connector could meet. */
  rows.stack.hidden = !styleBarFree(n);
  if(!rows.stack.hidden){
    rows.border.hidden = rows.frame.hidden = rows.corners.hidden = true;
    rows.leader.hidden = rows.leaderForm.hidden = true;
    rows.edgeLine.hidden = rows.ends.hidden = true;
    rows.noteSide.hidden = rows.noteBg.hidden = rows.cardBg.hidden = true;
    light(rows.stack, (n.z || 0) < 0 ? 'behind' : '');
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  if(decorOn){
    rows.border.hidden = rows.frame.hidden = rows.corners.hidden = true;
    rows.leader.hidden = rows.leaderForm.hidden = true;
    rows.edgeLine.hidden = rows.ends.hidden = true;
    rows.noteSide.hidden = rows.noteBg.hidden = rows.cardBg.hidden = true;
    light(rows.decor, decorStyleOf(decorOn));
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  rows.leader.hidden = rows.leaderForm.hidden = !callout;
  rows.edgeLine.hidden = rows.ends.hidden = t.kind !== 'edge';
  rows.noteSide.hidden = rows.noteBg.hidden = t.kind !== 'note';
  rows.cardBg.hidden = !(n && isCalloutNode(n) && !(n.leader && n.leader.shelf));
  const showHex = (row, v)=>{
    const input = row.querySelector('input');
    if(document.activeElement !== input){ input.value = v || ''; input.classList.remove('bad'); }
    paintHexChip(row.querySelector('.hex-preview'), input.value.trim());
  };
  if(!rows.cardBg.hidden) showHex(rows.cardBg, n.bg && n.bg.length === 1 ? n.bg[0] : (n.bg ? n.bg.join(', ') : ''));
  if(t.kind === 'edge'){
    rows.border.hidden = rows.frame.hidden = true;
    rows.corners.hidden = false;
    light(rows.edgeLine, style.sinusoid ? 'sinusoid' : style.dash);
    /* A curve and a straight line have no elbows, and a wave is drawn
       through them; the corners are greyed where they would change
       nothing. */
    light(rows.corners, style.square ? '' : 'round',
          ()=> style.sinusoid || style.routing === 'curve' || style.routing === 'straight');
    rows.corners.querySelector('button').title = 'Rounded elbows — press again for square ones';
    /* A lineage feeding an amalgam has no arrowhead of its own: it runs
       into the shared bar, and the single arrow into the entry belongs to
       the merge as a whole. Greyed rather than hidden, so the row still
       explains itself. */
    const merged = isMergePart(t.from, t.to);
    const out = isMergedArrow(t.from, t.to);
    rows.ends.querySelectorAll('button').forEach(b=>{
      b.disabled = merged;
      b.classList.toggle('on', b.dataset.value === 'in' ? !!style.arrowIn : style.arrow !== false);
      b.title = out ? 'Set by the amalgam: this is the one arrow its lineages share'
              : merged ? 'Set by the amalgam: merged lineages share one arrow into the entry'
                       : STYLE_BAR_ENDS.find(e=> e[0] === b.dataset.value)[2];
    });
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
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
    const portrait = shape === 'ellipse';
    /* A callout on a shelf has no card: its words and its line are all
       there is, and the line's look is chosen on the line. */
    if(isCalloutNode(n) && n.leader && n.leader.shelf) rows.border.hidden = rows.corners.hidden = true;
    /* The ripple is drawn only where WAVY_BORDER_SHAPES does not refuse it
       — a portrait ripples by a way of its own (isWavyPortrait) — and a
       rippled box keeps its rounded corners whatever is chosen, so the
       buttons are greyed where they would change nothing, rather than left
       to look as if they had been ignored. */
    light(rows.border, borderStyleOf(n), (v)=> v === 'wavy' && !portrait && WAVY_BORDER_SHAPES.includes(shape));
    light(rows.corners, n.square ? '' : 'round',
          ()=> portrait ? isWavyPortrait(n) : (isWavyBorder(n) || SQUARE_CORNER_SHAPES.includes(shape)));
    rows.corners.querySelectorAll('button').forEach(b=>{
      const own = STYLE_BAR_CORNERS.find(c=> c[0] === b.dataset.value)[2];
      b.title = portrait ? own + ' on the portrait’s card' : own;
    });
  } else {
    rows.border.hidden = true;
    rows.frame.hidden = false;
    light(rows.frame, style.noteFrame === false ? 'bare' : 'frame');
    /* A note with its frame taken off has no corners left to choose: the
       button is greyed rather than left to look as if it did nothing. */
    light(rows.corners, style.noteSquare ? '' : 'round', ()=> style.noteFrame === false);
    light(rows.noteSide, style.notePos || 'above');
    showHex(rows.noteBg, style.noteBg);
  }
  if(n || t.kind === 'note'){
    rows.corners.querySelectorAll('button').forEach(b=>{
      if(!n) b.title = STYLE_BAR_CORNERS[0][2];
    });
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
  if(t.kind === 'node' || t.kind === 'decor'){
    const n = nodes.get(t.id);
    if(!n){ closeStyleBar(); return; }
    const sr = svg.getBoundingClientRect();
    const out = (ringCountOf(n) - 1) * ringStepFor(n) + (isWavyBorder(n) ? POCKET_AMP : 0);
    left = sr.left - host.left + (n.x - out) * vs + vx;
    top = sr.top - host.top + (n.y - out) * vs + vy;
    /* Clear of the tabs standing on its top edge as well: over them, the
       bar hid the very language tabs and link a reader had come to press. */
    const g = qNode(`.node[data-id="${CSS.escape(n.id)}"]`);
    if(g) g.querySelectorAll('.lang-chips, .node-link').forEach(t=>{
      const r = t.getBoundingClientRect();
      if(r.height) top = Math.min(top, r.top - host.top);
    });
    bottom = sr.top - host.top + (n.y + n.h + out) * vs + vy;
    /* Furniture's own handle stands off that same top-left corner, and
       the bar went up over it: the curved arrow was there, under a button
       that put the picture behind the chart. The furniture bar starts
       just inside the corner instead, so the two never share a place. */
    if(styleBarFree(n)) left += (out + 3) * vs;
  } else if(t.kind === 'edge'){
    left = t.x - host.left - 18;
    top = t.y - host.top - 14;
    bottom = t.y - host.top + 14;
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
  if(t.kind === 'decor'){
    applyEdit(()=>{
      const found = workingEntry(t.id);
      if(!found) return;
      const opts = entryOpts(found.entry);
      // Solid is the absence of the field, as a border's is.
      if(value === 'solid') delete opts.decor; else opts.decor = value;
      putEntry(found.index, found.entry, opts);
    });
    syncStyleBar();
    return;
  }
  if(t.kind === 'node' && group === 'stack'){
    /* A toggle, and the two states it has are both written down: the
       entry layer, which is what a picture is born into, draws over the
       chart exactly as "in front" does, so there is nothing for the
       absence of the field to mean. */
    applyEdit(()=>{
      const found = workingEntry(t.id);
      if(!found) return;
      const n = nodes.get(t.id);
      const opts = entryOpts(found.entry);
      if((n && n.z || 0) < 0) opts.z = 1; else opts.z = -1;
      putEntry(found.index, found.entry, opts);
    });
    syncStyleBar();
    return;
  }
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
        // A toggle. Square is the default, so it is the absence of the flag.
        if(opts.square === false) delete opts.square; else opts.square = false;
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
  } else if(t.kind === 'edge'){
    const kept = edgeStyleFor(t.from, t.to);
    const change = {};
    if(group === 'edgeLine'){
      change.sinusoid = value === 'sinusoid' || undefined;
      change.dash = value === 'sinusoid' ? 'solid' : value;
    } else if(group === 'corners'){
      change.square = kept.square ? false : undefined;
    } else if(group === 'ends'){
      if(value === 'in') change.arrowIn = !kept.arrowIn || undefined;
      else change.arrow = kept.arrow === false;
    }
    applyEdit(()=> setEdgeStyleOverride(t.from, t.to, Object.assign({}, kept, change)));
  } else {
    applyEdit(()=>{
      const o = EDGE_STYLES.find(s=> s.from === t.from && s.to === t.to);
      if(!o) return;
      if(group === 'noteSide'){
        o.notePos = value;
      } else if(group === 'frame'){
        if(value === 'bare') o.noteFrame = false; else delete o.noteFrame;
      } else if(group === 'corners'){
        if(o.noteSquare) delete o.noteSquare; else o.noteSquare = true;
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
    const band = ev.target.closest && ev.target.closest('.node-aura-hit');
    if(band){
      openStyleBar({kind:'decor', id: band.dataset.id});
      return;
    }
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
    const line = ev.target.closest && ev.target.closest('.edge-hit');
    if(line){
      /* Not on a line stepped back behind a selection: it is not the
         subject, and a click on it lets the selection go (see edgeHit). */
      if(edgeIsStepBack(line.dataset.from, line.dataset.to)) return;
      openStyleBar({kind:'edge', from: line.dataset.from, to: line.dataset.to,
                    x: ev.clientX, y: ev.clientY});
      return;
    }
    const g = ev.target.closest && ev.target.closest('.node');
    if(g && g.dataset.id && styleBarWants(nodes.get(g.dataset.id))){
      openStyleBar({kind:'node', id: g.dataset.id});
    }
  };
  const out = (ev)=>{
    const from = ev.target.closest && ev.target.closest('.node, .node-aura-hit, .edge-note, .leader-line-hit, .edge-hit, #bendLayer');
    if(!from) return;
    const to = ev.relatedTarget;
    if(to && (from.contains(to) || styleBar.contains(to))) return;
    /* From a line onto one of its own bend handles, or back, is still the
       line. */
    if(to && to.closest && styleBarTarget && styleBarTarget.kind === 'edge' &&
       (to.closest('#bendLayer') || to.closest('.edge-hit'))) return;
    letStyleBarGo();
  };
  svg.addEventListener('mouseover', over);
  svg.addEventListener('mouseout', out);
  /* Anything that moves the chart under the bar takes it away, rather
     than leaving it standing over a place the thing has left. */
  svg.addEventListener('mousedown', ()=> closeStyleBar());
  svg.addEventListener('wheel', ()=> closeStyleBar(), {passive: true});
}
