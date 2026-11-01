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
/* One button for the frame, as for the corners: lit, the note has one. */
const STYLE_BAR_FRAMES = [['frame', '▭', 'A frame round the note — press again to take it off']];
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
  ['shelf', '⎽', 'Drafting leader: the words on a shelf, the leader to its end — press again for a card round them']
];
/* A connector's own line, and its two ends. */
const STYLE_BAR_EDGE_LINE = [
  ['solid', '──', 'Solid line'], ['dashed', '╌╌', 'Dashed line'],
  ['dotted', '┈┈', 'Dotted line'], ['dashdot', '─·', 'Dash-dotted line'],
  ['double', '═', 'Double line'], ['sinusoid', '∿', 'Wavy line']
];
/* An end carries an arrow, an open arrow, a T or nothing: answers to one
   question, so each end is one menu of them, the start's on the left and
   the end's on the right. The open arrow is drawn, as the line draws it
   (see drawArrowHead): a font's ">" is a letter, thinner and shorter than
   the ◄ beside it. */
const styleBarOpenGlyph = (d)=> '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
const STYLE_BAR_END_IN = [['none', 'No', 'Nothing at the start'],
                          ['in', '◄', 'Arrowhead at the start'],
                          ['oin', styleBarOpenGlyph('M11.5 3L3.5 8L11.5 13'), 'Open arrowhead at the start'],
                          ['tin', '⊢', 'T at the start, stopped short of the entry']];
const STYLE_BAR_END_OUT = [['none', 'No', 'Nothing at the end'],
                           ['out', '►', 'Arrowhead at the end'],
                           ['oout', styleBarOpenGlyph('M4.5 3L12.5 8L4.5 13'), 'Open arrowhead at the end'],
                           ['tout', '⊣', 'T at the end, stopped short of the entry — broad strokes']];
// What the same say on a merged lineage, whose end is at the bar.
const STYLE_BAR_END_BAR = {none: 'Nothing where it joins the bar',
                           out: 'Arrowhead where it joins the bar',
                           oout: 'Open arrowhead where it joins the bar',
                           tout: 'T where it joins the bar'};
/* The rows that are one choice out of several looks — a border, a
   hatching, a line, an end — are menus: one button showing what is
   chosen, the rest unfolding under it when pressed (the owner's ask: the
   bar was a row of every look at once, wider than most entries it stood
   over). A toggle stays a button, since it has nothing to unfold. */
const STYLE_BAR_MENUS = {
  border: 'Border', hatch: 'Hatching', decor: 'Scenery', edgeLine: 'Line',
  leader: 'Leader line', endIn: 'The start', endOut: 'The end'
};
/* Which side of its line a note rides. */
/* An array's ground may be hatched as well as coloured — see
   arrayHatchPaint. The glyphs are the hatched squares the font already
   has, one per direction. */
const STYLE_BAR_HATCH = [['none', '▢', 'No hatching'],
                         ['diag-r', '▨', 'Diagonal hatching, leaning right'],
                         ['diag-l', '▧', 'Diagonal hatching, leaning left'],
                         ['vert', '▥', 'Vertical hatching'],
                         ['horiz', '▤', 'Horizontal hatching']];
const STYLE_BAR_NOTE_SIDE = [
  ['above', '↑', 'Above the line'], ['on', '≡', 'On the line, covering it'], ['below', '↓', 'Below the line']
];
/* Level on a plate, or written along the line and bending with it. */
/* Its face is the owner's sketch: a line arching over and ending in an
   arrow — drawn, since no character in the bar's font is that shape, and
   drawn as the font draws its own arrows beside it: a hairline with
   round ends and an open head, not a heavy stroke with a filled one (the
   owner's list of 23.10). */
const STYLE_BAR_NOTE_ALONG = [['along',
  '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" ' +
  'stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 11.6C4.8 6.6 9.6 5.6 13.4 8.8"/>' +
  '<path d="M10.2 8.6L13.4 8.8L12.6 5.7"/></svg>', 'Written along the line, bending with it']];
/* How a moving picture moves (see wearPicture): one menu of the three,
   drawn, since a font's ▶ and ⏸ come out as coloured emoji on a phone. */
const STYLE_BAR_ANIM = [
  ['play', '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">' +
   '<path d="M4.5 2.8v10.4L13 8z"/></svg>', 'Moving'],
  ['still', '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">' +
   '<rect x="3.6" y="3" width="3" height="10"/><rect x="9.4" y="3" width="3" height="10"/></svg>', 'Still: its first frame'],
  ['hover', '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">' +
   '<path d="M3 1.6v11.2l2.9-2.7 1.9 4.3 1.9-.8-1.9-4.2h4z"/></svg>', 'Moving only while the pointer is on it']];
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
    /* A menu keeps its choices in a list of their own, under a face that
       has no value: everything that lights, greys or presses a choice
       asks for buttons with one, and finds the same buttons it always did. */
    let into = row;
    if(STYLE_BAR_MENUS[name]){
      row.classList.add('style-bar-drop');
      const face = document.createElement('button');
      face.type = 'button';
      face.className = 'style-bar-drop-face';
      face.title = STYLE_BAR_MENUS[name];
      row.appendChild(face);
      into = document.createElement('div');
      into.className = 'style-bar-drop-list';
      row.appendChild(into);
    }
    list.forEach(([value, glyph, title])=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.value = value;
      if(glyph.startsWith('<svg')) b.innerHTML = glyph;
      else b.textContent = glyph;
      b.title = title;
      into.appendChild(b);
    });
    bar.appendChild(row);
    return row;
  };
  group('border', STYLE_BAR_BORDERS);
  group('hatch', STYLE_BAR_HATCH);
  group('decor', STYLE_BAR_DECOR);
  group('frame', STYLE_BAR_FRAMES);
  group('edgeLine', STYLE_BAR_EDGE_LINE);
  group('corners', STYLE_BAR_CORNERS);
  group('endIn', STYLE_BAR_END_IN);
  group('endOut', STYLE_BAR_END_OUT);
  group('turn', STYLE_BAR_TURN);
  group('stack', STYLE_BAR_STACK);
  group('leader', STYLE_BAR_LEADER);
  group('leaderForm', STYLE_BAR_LEADER_FORM);
  group('noteSide', STYLE_BAR_NOTE_SIDE);
  group('noteAlong', STYLE_BAR_NOTE_ALONG);
  /* A colour on the bar is a square, as every colour on the page is (see
     squareForHexInput); pressed, it opens the code to type. Blank is the
     paper. Typing is one step of undo however long it runs. */
  const hexGroup = (name, title, apply, ink, ground)=>{
    const row = group(name, []);
    row.classList.add('style-bar-hex');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'hex-input';
    input.placeholder = ink ? 'default' : 'white';
    input.maxLength = 9;
    input.spellcheck = false;
    input.title = title;
    row.appendChild(input);
    /* Blank is the paper, so the square shows the paper — as a colour
       handed down, with the dashed edge — rather than the empty square of
       "no colour", which is not what a blank ground means here. */
    /* …except where blank is the default INK, which is what the square
       then shows. */
    /* …or, where the bar can find it, the ground actually drawn under
       the words (`ground`): the owner's list of 29.10 found a comment's
       square showing a white it was not drawn on. */
    const paper = ()=> getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#ffffff';
    squareForHexInput(input, {title, fallback: ink ? ()=> ARRAY_INK
                                             : ()=> (ground && styleBarTarget && ground(styleBarTarget)) || paper()});
    /* And a way back to it. Clearing the code did the same, but only once
       the square had been opened and its field emptied by hand — nothing
       on the bar said that was how. */
    if(!ink){
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'hex-reset';
      back.textContent = '\u27f2';
      back.title = 'Back to the default ground';
      row.appendChild(back);
      back.addEventListener('click', ev=>{
        ev.stopPropagation();
        if(!styleBarTarget || readOnlyView || !input.value) return;
        pushUndo();
        input.value = '';
        apply(styleBarTarget, '');
        refreshSaveUI();
        syncStyleBar();
      });
    }
    input.addEventListener('mousedown', ev=> ev.stopPropagation());
    input.addEventListener('keydown', ev=> ev.stopPropagation());
    input.addEventListener('input', ()=>{
      if(!styleBarTarget || readOnlyView) return;
      const v = hexFieldValue(input.value);
      if(v && !readHex(input)) return;
      input.classList.remove('bad');
      /* One step per thing typed into, not per spell of focus: the bar
         can move to another note while the field keeps the caret, and the
         second note's colour used to land in the first one's step. */
      const who = [styleBarTarget.kind, styleBarTarget.id, styleBarTarget.from, styleBarTarget.to].join('\u0001');
      if(input.dataset.pushed !== who){ pushUndo(); input.dataset.pushed = who; }
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
  }, false, t=> drawnGroundOf(t.kind === 'note' && document.querySelector(
    `.edge-note[data-from="${CSS.escape(t.from)}"][data-to="${CSS.escape(t.to)}"] .edge-note-plate`)));
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
  }, false, t=> t.kind === 'node' ? entryGroundShown(t.id) : null);
  /* An array's frame. An entry is coloured in its settings, which an
     array has none of, so its colour is set here, beside its ground. */
  hexGroup('arrayInk', 'The colour of the array’s frame and hatching — blank is black', (t, v)=>{
    if(t.kind !== 'node') return;
    const found = workingEntry(t.id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    if(v) opts.colors = [v]; else delete opts.colors;
    putEntry(found.index, found.entry, opts);
    rebuildChart();
  }, true);
  /* A link node's whole make-up, on its bar as an array's is (the owner's
     list of 28.10): it has no words, no notes and no drawer of its own —
     a colour, and where it goes. The place is a copied link to an entry or
     the entry's id, written down when the field is left or Enter pressed. */
  hexGroup('linkInk', 'The colour of the link — blank is the default ink', (t, v)=>{
    if(t.kind !== 'node') return;
    const found = workingEntry(t.id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    if(v) opts.colors = [v]; else delete opts.colors;
    putEntry(found.index, found.entry, opts);
    rebuildChart();
  }, true);
  const goesRow = group('linkGoes', []);
  goesRow.classList.add('style-bar-goes');
  const goes = document.createElement('input');
  goes.type = 'text';
  goes.className = 'link-goes-input';
  goes.placeholder = 'Goes to: a copied link or an id';
  goes.title = 'Where the link goes: a link copied from an entry, or the entry’s id';
  goes.spellcheck = false;
  goesRow.appendChild(goes);
  goes.addEventListener('mousedown', ev=> ev.stopPropagation());
  goes.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Enter'){ ev.preventDefault(); goes.blur(); }
    if(ev.key === 'Escape'){ ev.preventDefault(); goes.dataset.cancel = '1'; goes.blur(); }
  });
  /* Written to the link the caret went into, whatever the bar is on by
     the time it leaves: a press elsewhere may have moved or shut the bar
     before the field hears it has lost the caret. */
  goes.addEventListener('focus', ()=>{
    goes.dataset.for = styleBarTarget && styleBarTarget.kind === 'node' ? styleBarTarget.id : '';
  });
  goes.addEventListener('blur', ()=>{
    const id = goes.dataset.for, cancel = goes.dataset.cancel;
    delete goes.dataset.cancel; delete goes.dataset.for;
    if(cancel || !id || readOnlyView) return;
    const found = workingEntry(id);
    if(!found || !isLinkNode(nodes.get(id))) return;
    const v = goes.value.trim();
    const opts = entryOpts(found.entry);
    if((opts.link || '') === v) return;
    applyEdit(()=>{
      const o = entryOpts(found.entry);
      if(v) o.link = v; else delete o.link;
      putEntry(found.index, found.entry, o);
    });
  });
  /* A link to an array, as an entry has one in its drawer: an array has no
     drawer, and its bar is where everything else about it is. */
  const linkRow = document.createElement('div');
  linkRow.className = 'style-bar-group';
  linkRow.dataset.group = 'link';
  const linkBtn = document.createElement('button');
  linkBtn.type = 'button';
  linkBtn.className = 'style-bar-link';
  linkBtn.title = 'Copy a link to this array';
  linkBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>';
  linkRow.appendChild(linkBtn);
  bar.appendChild(linkRow);
  bar.addEventListener('mousedown', ev=> ev.stopPropagation());
  bar.addEventListener('dblclick', ev=> ev.stopPropagation());
  bar.addEventListener('mouseenter', ()=> clearTimeout(styleBarTimer));
  bar.addEventListener('mouseleave', ()=> letStyleBarGo());
  // …and once a field typed into is left, with the pointer already gone.
  bar.addEventListener('focusout', ()=>{ if(!bar.matches(':hover')) letStyleBarGo(); });
  bar.addEventListener('click', ev=>{
    ev.stopPropagation();
    const b = ev.target.closest('button');
    if(!b || b.disabled || !styleBarTarget) return;
    const row = b.closest('.style-bar-group');
    if(b.classList.contains('style-bar-drop-face')){
      const open = !row.classList.contains('open');
      shutStyleBarMenus();
      row.classList.toggle('open', open);
      /* An open menu stands over everything the page floats, the
         connector's own panel included: its choices unfold downward, and
         that is where the panel usually is (the owner's list of 24.10). */
      bar.classList.toggle('dropping', open);
      return;
    }
    shutStyleBarMenus();
    if(row.dataset.group === 'link'){
      if(styleBarTarget.kind === 'node') copyEntryLink(styleBarTarget.id, b, 'Copy a link to this array');
      return;
    }
    /* The button pressed stays under the hand. A choice can take rows
       off the bar or put them back — a callout's card taken down to a
       shelf has no border to choose — and the button slid out from under
       the pointer, which then left the bar and let it go. */
    /* A choice out of a menu is held by the menu's face, which is where
       the hand goes back to: the choice itself was in the list, put away
       by now, and the bar was moved by the distance from where it had
       been in the open list to where it stood in the shut one — down by
       the list's length on every pick (the owner's list of 30.10: the
       screen jumped on turning anything wavy, and back again). */
    const drop = row.classList.contains('style-bar-drop');
    const was = (drop ? row.querySelector('.style-bar-drop-face') : b).getBoundingClientRect();
    const group = row.dataset.group, value = b.dataset.value;
    /* And the bar stays where it was while the hand is on it. Placed
       afresh over the entry, it stood a ripple's depth higher over a
       wavy one, and higher again by its tabs, which a ripple lifts — so
       it hopped up under the hand on every turn to wavy and down on every
       turn back. */
    const kept = {left: bar.style.left, top: bar.style.top};
    applyStyleBar(group, value);
    if(!bar.hidden){ bar.style.left = kept.left; bar.style.top = kept.top; }
    const now = !bar.hidden && bar.querySelector(drop
      ? `.style-bar-group[data-group="${group}"] .style-bar-drop-face`
      : `.style-bar-group[data-group="${group}"] button[data-value="${CSS.escape(value)}"]`);
    const at = now && now.getBoundingClientRect();
    if(at && at.width && (Math.abs(at.left - was.left) > 0.5 || Math.abs(at.top - was.top) > 0.5)){
      bar.style.left = (parseFloat(bar.style.left) + was.left - at.left).toFixed(2) + 'px';
      bar.style.top = (parseFloat(bar.style.top) + was.top - at.top).toFixed(2) + 'px';
    }
  });
  const host = document.querySelector('.app > .main');
  if(host) host.appendChild(bar);
  return bar;
})();
/* A link node is told where to go on its bar: the bar is opened on it
   and the field given the caret. */
function askWhereLinkGoes(id){
  if(readOnlyView || !isLinkNode(nodes.get(id))) return false;
  openStyleBar({kind:'node', id});
  const input = styleBar.querySelector('.link-goes-input');
  if(input && !styleBar.hidden) input.focus();
  return true;
}
/* What the bar is open on: {kind:'node', id}, {kind:'note', from, to},
   {kind:'leader', id} — a callout's leader line, by the callout's id — or
   {kind:'edge', from, to, x, y}, a connector, with where on the screen the
   pointer met it, since a line has no corner to stand the bar over. */
// `var`: the bar's colour squares ask what it stands on as they are
// first painted, which is while the bar is being built, above this line.
var styleBarTarget = null;
let styleBarTimer = null;

/* A callout's leader is part of the callout: the bar on its line is the
   same bar as on its card, with the card's looks and the line's together
   (the owner's ask, 22.10). It is only placed over the line instead. */
function styleBarNode(){
  const t = styleBarTarget;
  return t && (t.kind === 'node' || t.kind === 'leader') ? nodes.get(t.id) : null;
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
  if((target.kind === 'edge' || target.kind === 'note') && t && t.kind === target.kind &&
     t.from === target.from && t.to === target.to && !styleBar.hidden) return;
  /* A line's bar is placed where the pointer met the line — kept as a
     point on the chart, so it can follow the line when what it joins is
     carried (see followStyleBar). */
  if((target.kind === 'edge' || target.kind === 'note') && typeof target.x === 'number')
    target.at = clientToWorld(target.x, target.y);
  styleBarTarget = target;
  syncStyleBar();
}
/* The bar follows what it stands on while that is carried, resized or
   turned (the owner's report, 22.10): it stayed where it had come up, over
   empty chart, while its entry went elsewhere. Called from the gestures,
   never while the page is starting. */
function followStyleBar(){
  if(styleBarTarget && !styleBar.hidden) positionStyleBar();
}
function letStyleBarGo(){
  clearTimeout(styleBarTimer);
  /* Not while something is being typed into it: the pointer goes off to
     rest while the hand types, and the field went with the bar. */
  styleBarTimer = setTimeout(()=>{
    const a = document.activeElement;
    if(a && a.tagName === 'INPUT' && styleBar.contains(a)) return;
    closeStyleBar();
  }, STYLE_BAR_LINGER);
}
function closeStyleBar(){
  clearTimeout(styleBarTimer);
  styleBarTarget = null;
  shutStyleBarMenus();
  styleBar.hidden = true;
}
function shutStyleBarMenus(){
  styleBar.querySelectorAll('.style-bar-drop.open').forEach(r=> r.classList.remove('open'));
  styleBar.classList.remove('dropping');
}
/* Each menu's face wears the choice that is lit, and is greyed when every
   choice under it is. Asked after every sync, whatever it lit. */
function paintStyleBarMenus(){
  styleBar.querySelectorAll('.style-bar-drop').forEach(row=>{
    const face = row.querySelector('.style-bar-drop-face');
    const opts = [...row.querySelectorAll('.style-bar-drop-list button')];
    const lit = opts.find(b=> b.classList.contains('on')) || opts[0];
    face.innerHTML = lit ? lit.innerHTML : '';
    face.title = STYLE_BAR_MENUS[row.dataset.group] + (lit ? ': ' + lit.title : '');
    face.disabled = opts.every(b=> b.disabled);
  });
}
function syncStyleBar(){
  syncStyleBarRows();
  paintStyleBarMenus();
}
/* The buttons, lit and greyed for the thing the bar is on, and the bar put
   over it. */
function syncStyleBarRows(){
  const t = styleBarTarget;
  const n = styleBarNode();
  const style = t && (t.kind === 'note' || t.kind === 'edge') ? edgeStyleFor(t.from, t.to) : null;
  const callout = n && isCalloutNode(n) && n.leader ? n : null;
  if(!t || (t.kind === 'node' && !styleBarWants(n)) ||
     /* A connector with both its entries — or a merge's own arrow, whose
        source is the merge and is written as none (see isMergedArrow): it
        used to be the one line on the chart the bar never came up on. */
     ((t.kind === 'note' || t.kind === 'edge') &&
      !((nodes.has(t.from) || (t.from === '' && isMergeNode(nodes.get(t.to)))) && nodes.has(t.to))) ||
     (t.kind === 'note' && !style.note) ||
     (t.kind === 'decor' && !nodes.get(t.id)) ||
     (t.kind === 'leader' && !(callout && callout.leader))){
    closeStyleBar();
    return;
  }
  const decorOn = styleBarDecorNode();
  const rows = {};
  styleBar.querySelectorAll('.style-bar-group').forEach(r=> rows[r.dataset.group] = r);
  rows.decor.hidden = !decorOn;
  const isLink = t.kind === 'node' && isLinkNode(n);
  rows.linkInk.hidden = rows.linkGoes.hidden = !isLink;
  if(isLink){
    const input = rows.linkGoes.querySelector('input');
    if(document.activeElement !== input) input.value = n.link || '';
  }
  const light = (row, value, off)=>{
    /* A greyed button still shows whether it is pressed. Greying says
       the choice does nothing just now — the wave is drawn through the
       elbows, the frame is off — and the choice itself is still written
       down and comes back with whatever greyed it: rounded elbows stay
       rounded under a wave, and are rounded again when the wave is taken
       off. Unlit while greyed, the bar claimed the opposite of what the
       entry would do the moment the button came back. */
    row.querySelectorAll('button[data-value]').forEach(b=>{
      b.disabled = !!(off && off(b.dataset.value));
      b.classList.toggle('on', b.dataset.value === value);
    });
  };
  const isArr = isArrayNode(n);
  rows.hatch.hidden = rows.arrayInk.hidden = !isArr;
  rows.link.hidden = !isArr;
  // An array is as big as what it holds and stands the way that does.
  rows.turn.hidden = !n || styleBarFree(n) || isArr;
  /* Furniture's bar is the stack and nothing else. A caption and a
     picture have no border of their own to outline, no corners, and
     nothing a connector could meet. */
  rows.stack.hidden = !styleBarFree(n);
  if(!rows.stack.hidden){
    rows.border.hidden = rows.frame.hidden = rows.corners.hidden = true;
    rows.leader.hidden = rows.leaderForm.hidden = true;
    rows.edgeLine.hidden = rows.endIn.hidden = rows.endOut.hidden = true;
    rows.noteSide.hidden = rows.noteAlong.hidden = rows.noteBg.hidden = rows.cardBg.hidden = true;
    light(rows.stack, (n.z || 0) < 0 ? 'behind' : '');
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  if(decorOn){
    rows.border.hidden = rows.frame.hidden = rows.corners.hidden = true;
    rows.leader.hidden = rows.leaderForm.hidden = true;
    rows.edgeLine.hidden = rows.endIn.hidden = rows.endOut.hidden = true;
    rows.noteSide.hidden = rows.noteAlong.hidden = rows.noteBg.hidden = rows.cardBg.hidden = true;
    light(rows.decor, decorStyleOf(decorOn));
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  rows.leader.hidden = rows.leaderForm.hidden = !callout;
  rows.edgeLine.hidden = rows.endIn.hidden = rows.endOut.hidden = t.kind !== 'edge';
  rows.noteSide.hidden = rows.noteAlong.hidden = rows.noteBg.hidden = t.kind !== 'note';
  rows.cardBg.hidden = !(n && isCalloutNode(n) && !(n.leader && n.leader.shelf));
  const showHex = (row, v)=>{
    const input = row.querySelector('input');
    if(document.activeElement !== input){ input.value = v || ''; input.classList.remove('bad'); }
    paintHexSquare(input);
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
    /* A lineage feeding a merge ends at the shared bar, not at the entry,
       so its end is the head it wears THERE — `barEnd`, kept apart from
       `arrow` because `arrow` is on unless said otherwise and every merge
       saved before had it. Its start, and both ends of the merged arrow,
       are ends like any connector's. */
    const member = isAmalgamMember(t.from, t.to);
    const endOut = member ? (style.barEnd || 'none')
                 : style.arrow !== false ? (style.teeOut ? 'tout' : style.openOut ? 'oout' : 'out') : 'none';
    light(rows.endIn, style.arrowIn ? (style.teeIn ? 'tin' : style.openIn ? 'oin' : 'in') : 'none');
    light(rows.endOut, endOut);
    [[rows.endIn, STYLE_BAR_END_IN], [rows.endOut, STYLE_BAR_END_OUT]].forEach(([row, list])=>{
      row.querySelectorAll('button[data-value]').forEach(b=>{
        const own = list.find(e=> e[0] === b.dataset.value)[2];
        b.title = member && row === rows.endOut ? STYLE_BAR_END_BAR[b.dataset.value] : own;
      });
    });
    styleBar.hidden = false;
    positionStyleBar();
    return;
  }
  if(callout){
    light(rows.leader, callout.leader.line || 'solid');
    light(rows.leaderForm, callout.leader.shelf ? 'shelf' : '');
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
    if(isLink) showHex(rows.linkInk, n.ownColors && n.ownColors.length ? n.ownColors[0] : '');
    if(isArr){
      light(rows.hatch, n.hatch || 'none');
      showHex(rows.arrayInk, n.ownColors && n.ownColors.length ? n.ownColors[0] : '');
    }
    rows.corners.querySelectorAll('button').forEach(b=>{
      const own = STYLE_BAR_CORNERS.find(c=> c[0] === b.dataset.value)[2];
      b.title = portrait ? own + ' on the portrait’s card' : own;
    });
  } else {
    rows.border.hidden = true;
    rows.frame.hidden = false;
    /* Words written along the line are framed by a band that bends with
       them, and bare unless asked (see drawNoteAlong) — so the button
       there reads noteAlongFrame, not the plate's own noteFrame. */
    const framed = style.noteAlong ? style.noteAlongFrame : style.noteFrame !== false;
    light(rows.frame, framed ? 'frame' : '');
    /* A note with its frame taken off has no corners left to choose: the
       button is greyed rather than left to look as if it did nothing. */
    light(rows.corners, style.noteSquare ? '' : 'round', ()=> !framed);
    light(rows.noteSide, style.notePos || 'above');
    light(rows.noteAlong, style.noteAlong ? 'along' : '');
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
/* While the hand is on the bar, the bar stays where it is (the owner's
   list of 29.10). A choice made on it can change the size of what it
   stands on — a callout's card taken down to a shelf — and the bar, put
   again over the new box, moved out from under the pointer, which it
   then took for the hand leaving, and went. */
let styleBarPlacedFor = '';
function positionStyleBar(){
  const t = styleBarTarget;
  if(!t || styleBar.hidden) return;
  const key = [t.kind, t.id, t.from, t.to].join('\u0001');
  if(key === styleBarPlacedFor && styleBar.matches(':hover')) return;
  styleBarPlacedFor = key;
  const host = document.querySelector('.app > .main').getBoundingClientRect();
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
    const sr = svg.getBoundingClientRect();
    const cx = t.at ? sr.left + t.at.x * vs + vx : t.x, cy = t.at ? sr.top + t.at.y * vs + vy : t.y;
    left = cx - host.left - 18;
    top = cy - host.top - 14;
    bottom = cy - host.top + 14;
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
    /* Over the WORDS. A note written along its line holds, beside them, an
       unseen copy of the whole line for them to run on, and the group's
       box is that line's: the bar stood off at its far corner, nowhere
       near the note (the owner's report, 23.10). */
    const along = g.querySelector('text.edge-note-along');
    const r = (along || g).getBoundingClientRect();
    left = r.left - host.left;
    top = r.top - host.top;
    bottom = r.bottom - host.top;
    /* Words run round a bend stand over a box as tall or as wide as the
       bend, and a bar over that box was most of it away from the words the
       hand was on: it went before the hand got there (the owner's list of
       29.10). Such a note has its bar where the pointer met it, as a line
       has. */
    if(along && t.at){
      const sr = svg.getBoundingClientRect();
      const cx = sr.left + t.at.x * vs + vx, cy = sr.top + t.at.y * vs + vy;
      left = cx - host.left - 18;
      top = cy - host.top - 14;
      bottom = cy - host.top + 14;
    }
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
      } else if(group === 'hatch'){
        if(value === 'none') delete opts.hatch; else opts.hatch = value;
      } else if(group === 'leader'){
        if(!opts.leader) return;
        // Solid is the absence of the field, as everywhere else.
        opts.leader = Object.assign({}, opts.leader);
        if(LEADER_LINES.includes(value)) opts.leader.line = value; else delete opts.leader.line;
      } else if(group === 'leaderForm'){
        if(!opts.leader) return;
        opts.leader = Object.assign({}, opts.leader);
        // A toggle: a card is the absence of the flag.
        if(opts.leader.shelf) delete opts.leader.shelf; else opts.leader.shelf = true;
      }
      putEntry(found.index, found.entry, opts);
    });
  } else if(t.kind === 'edge'){
    /* On every connector picked with this one (see edgeSelection), each
       keeping the rest of its own look. A toggle goes the way it goes on
       the one the bar is over, so a mixed set ends up all one way. */
    const here = edgeStyleFor(t.from, t.to);
    applyEdit(()=> edgeGroupFor(t.from, t.to).forEach(({from, to})=>{
      const kept = edgeStyleFor(from, to);
      const change = {};
      if(group === 'edgeLine'){
        change.sinusoid = value === 'sinusoid' || undefined;
        change.dash = value === 'sinusoid' ? 'solid' : value;
      } else if(group === 'corners'){
        change.square = here.square ? false : undefined;
      } else if(group === 'endIn'){
        change.arrowIn = value !== 'none' || undefined;
        change.teeIn = value === 'tin' || undefined;
        change.openIn = value === 'oin' || undefined;
      } else if(group === 'endOut' && isAmalgamMember(from, to)){
        change.barEnd = value === 'none' ? undefined : value;
      } else if(group === 'endOut'){
        change.arrow = value !== 'none';
        change.teeOut = value === 'tout' || undefined;
        change.openOut = value === 'oout' || undefined;
      }
      setEdgeStyleOverride(from, to, Object.assign({}, kept, change));
    }));
  } else {
    applyEdit(()=>{
      const o = EDGE_STYLES.find(s=> s.from === t.from && s.to === t.to);
      if(!o) return;
      if(group === 'noteSide'){
        o.notePos = value;
      } else if(group === 'frame' && o.noteAlong){
        // Along the line, bare is the absence of the flag.
        if(o.noteAlongFrame) delete o.noteAlongFrame; else o.noteAlongFrame = true;
      } else if(group === 'frame'){
        // A toggle: framed is the absence of the flag.
        if(o.noteFrame === false) delete o.noteFrame; else o.noteFrame = false;
      } else if(group === 'corners'){
        // Square is the default, so only the rounding is written down.
        if(o.noteSquare === false) delete o.noteSquare; else o.noteSquare = false;
      } else if(group === 'noteAlong'){
        if(o.noteAlong) delete o.noteAlong; else o.noteAlong = true;
      }
    });
  }
  syncStyleBar();
}
/* The colour a drawn ground is filled with, as a code — or null where
   there is none to read (a gradient, nothing drawn yet). */
// The ground an entry's box is drawn on, read off the drawing.
function entryGroundShown(id){
  const g = qNode(`.node[data-id="${CSS.escape(id)}"]`);
  return drawnGroundOf(g && [...g.querySelectorAll('rect, path, ellipse, polygon')]
    .find(e=> !/handle|hit|band/.test(e.getAttribute('class') || '') && (e.style.fill || '') !== 'none' &&
              getComputedStyle(e).fill !== 'none'))
    || getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#ffffff';
}
function drawnGroundOf(e){
  if(!e) return null;
  const f = getComputedStyle(e).fill || '';
  // Nothing painted is not black: a see-through fill says no ground at all.
  if(/^rgba\(.*,\s*0(\.0+)?\)$/.test(f) || f === 'transparent') return null;
  return /^#/.test(f) ? f : rgbToHex(f);
}
// Whether `line` is the connector of the note the bar is up for.
function notesOwnLine(line){
  const t = styleBarTarget;
  return !!(line && t && t.kind === 'note' && !styleBar.hidden &&
            line.dataset.from === t.from && line.dataset.to === t.to);
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
      openStyleBar({kind:'note', from: note.dataset.from, to: note.dataset.to, x: ev.clientX, y: ev.clientY});
      return;
    }
    const line = ev.target.closest && ev.target.closest('.edge-hit');
    /* The note's bar stays the note's while the hand crosses the note's
       own line on the way to it (the owner's list of 29.10): a note
       written along a bend has its line beside it on every side, and the
       bar was taken by the line before the hand could reach it. */
    if(line && notesOwnLine(line)){ clearTimeout(styleBarTimer); return; }
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
    if(to && to.closest && notesOwnLine(to.closest('.edge-hit'))) return;
    /* From a line onto one of its own bend handles, or back, is still the
       line. */
    if(to && to.closest && styleBarTarget && styleBarTarget.kind === 'edge' &&
       (to.closest('#bendLayer') || to.closest('.edge-hit'))) return;
    /* …and a line whose panel is open keeps its bar while the hand goes
       to the panel: the two are used together (see the mousedown below). */
    if(styleBarTarget && styleBarTarget.kind === 'edge' && edgeIsPicked(styleBarTarget.from, styleBarTarget.to)) return;
    letStyleBarGo();
  };
  svg.addEventListener('mouseover', over);
  svg.addEventListener('mouseout', out);
  /* Anything that moves the chart under the bar takes it away, rather
     than leaving it standing over a place the thing has left. */
  /* …except a press on the very thing the bar stands on. A click on a
     connector opens its panel, and the bar went away to make room for it
     (the owner's report, 22.10): the two are for different things — the
     panel for the route and paint, the bar for the line's looks — and
     both are wanted while the connector is being worked on. */
  svg.addEventListener('mousedown', (ev)=>{
    const t = styleBarTarget;
    const on = ev.target && ev.target.closest && t && !styleBar.hidden && (
      (t.kind === 'edge' && ev.target.closest(`.edge-hit[data-from="${CSS.escape(t.from)}"][data-to="${CSS.escape(t.to)}"]`)) ||
      (t.kind === 'note' && ev.target.closest(`.edge-note[data-from="${CSS.escape(t.from)}"][data-to="${CSS.escape(t.to)}"]`)) ||
      (t.kind === 'leader' && ev.target.closest(`.leader-line-hit[data-id="${CSS.escape(t.id)}"]`)) ||
      ((t.kind === 'node' || t.kind === 'decor') && ev.target.closest(`[data-id="${CSS.escape(t.id)}"]`)));
    if(!on) closeStyleBar();
  });
  svg.addEventListener('wheel', ()=> closeStyleBar(), {passive: true});
}


/* =========================================================================
   THE PICTURE'S PLAYER
   -----------------------------------------------------------------------
   How a moving picture moves — always, never, or while the pointer is on
   it — is chosen on the picture itself, by three buttons laid over its
   foot when the pointer is on it, as a player's are (the owner's list of
   23.10). They were a row of the style bar, among the borders and the
   corners, which made a picture's playing look like one more thing about
   the entry's frame.

   Only for whoever may edit: the choice is written into the chart. A
   reader's picture still plays on hover where that was chosen.
   ========================================================================= */
const picturePlayer = (()=>{
  const bar = document.createElement('div');
  bar.className = 'picture-player';
  bar.id = 'picturePlayer';
  bar.hidden = true;
  STYLE_BAR_ANIM.forEach(([value, glyph, title])=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = value;
    b.innerHTML = glyph;
    b.title = title;
    b.setAttribute('aria-label', title);
    bar.appendChild(b);
  });
  // A press on a button is not a press on the chart beneath it.
  bar.addEventListener('mousedown', ev=> ev.stopPropagation());
  bar.addEventListener('dblclick', ev=> ev.stopPropagation());
  document.querySelector('.app > .main').appendChild(bar);
  return bar;
})();
/* A var, since the view's every move asks it (see applyTransform) and the
   first moves come before this part has run. */
var picturePlayerFor = null;
// The smallest the player is drawn at before it goes instead.
const PICTURE_PLAYER_LEAST = 0.5;
let picturePlayerTimer = null;
/* The picture an entry wears, as drawn: its card's band, its portrait's
   disc or the picture standing on its own. */
function pictureElementOf(id){
  return qNode(`.node[data-id="${CSS.escape(id)}"] > image`);
}
function pictureWantsPlayer(n){
  return !!(n && n.image && !readOnlyView && pictureMoves(n.image));
}
function openPicturePlayer(id){
  clearTimeout(picturePlayerTimer);
  const n = nodes.get(id);
  const img = pictureElementOf(id);
  if(!pictureWantsPlayer(n) || !img){ closePicturePlayer(); return; }
  picturePlayerFor = id;
  const mode = n.anim || 'play';
  picturePlayer.querySelectorAll('button').forEach(b=> b.classList.toggle('on', b.dataset.value === mode));
  picturePlayer.hidden = false;
  placePicturePlayer();
}
/* Over the foot of the picture, in its middle: where a player keeps its
   buttons, and clear of the words a card writes under its picture. */
function placePicturePlayer(){
  if(!picturePlayerFor || picturePlayer.hidden) return;
  const img = pictureElementOf(picturePlayerFor);
  if(!img){ closePicturePlayer(); return; }
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const r = img.getBoundingClientRect();
  /* Zoomed out, the player kept its size while the picture under it
     shrank, and stood out past both sides of the entry (the owner's list
     of 24.10). It shrinks with the chart instead, never growing past its
     own size; once it would be too small to press it goes, and the
     pointer brings it back over the picture when the chart is nearer. */
  const k = Math.min(1, vs);
  if(k < PICTURE_PLAYER_LEAST){ closePicturePlayer(); return; }
  picturePlayer.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : '';
  const w = picturePlayer.offsetWidth * k, h = picturePlayer.offsetHeight * k;
  picturePlayer.style.left = (r.left - host.left + r.width / 2 - w / 2).toFixed(1) + 'px';
  picturePlayer.style.top = (r.bottom - host.top - h - Math.min(8, r.height * 0.06)).toFixed(1) + 'px';
}
function closePicturePlayer(){
  clearTimeout(picturePlayerTimer);
  picturePlayerFor = null;
  picturePlayer.hidden = true;
}
function setPictureAnim(id, value){
  applyEdit(()=>{
    const found = workingEntry(id);
    if(!found) return;
    const opts = entryOpts(found.entry);
    // Moving is the absence of the field, as a picture arrives.
    if(pictureAnimOf(value)) opts.anim = value; else delete opts.anim;
    putEntry(found.index, found.entry, opts);
  });
}
picturePlayer.addEventListener('click', (ev)=>{
  const b = ev.target.closest('button[data-value]');
  if(!b || !picturePlayerFor) return;
  ev.stopPropagation();
  const id = picturePlayerFor;
  setPictureAnim(id, b.dataset.value);
  openPicturePlayer(id);
});
/* Followed by where the pointer is, not by entering and leaving the
   picture: a portrait's picture lies under the pad that catches the
   pointer, so it is the point that is asked, against the picture's box.
   Leaving waits a moment, as the style bar does, so the buttons can be
   reached across the edge of the picture. */
document.addEventListener('pointermove', (ev)=>{
  if(ev.target && ev.target.closest && ev.target.closest('#picturePlayer')){
    clearTimeout(picturePlayerTimer);
    return;
  }
  const g = ev.target && ev.target.closest ? ev.target.closest('g.node') : null;
  const id = g && g.dataset.id;
  const img = id && pictureWantsPlayer(nodes.get(id)) ? pictureElementOf(id) : null;
  if(img){
    const r = img.getBoundingClientRect();
    if(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom){
      if(picturePlayerFor !== id || picturePlayer.hidden) openPicturePlayer(id);
      else { clearTimeout(picturePlayerTimer); placePicturePlayer(); }
      return;
    }
  }
  if(picturePlayerFor && !picturePlayer.hidden){
    clearTimeout(picturePlayerTimer);
    picturePlayerTimer = setTimeout(closePicturePlayer, STYLE_BAR_LINGER);
  }
}, {passive: true});
