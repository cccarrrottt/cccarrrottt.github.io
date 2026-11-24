/* ---------------------------------------------------------------------
   The style bar's own workings: which rows it shows for what is picked,
   where it stands, and what its controls do. Taken out of 37-style-bar.js
   (0.27.2), which keeps closing it and the picture player a reader uses;
   on the site this is in the editor's file (LAZY_PARTS).
   ------------------------------------------------------------------ */
/* Whether a thing on the chart has lines of words to set to a side: every
   box that holds words — an entry, a card, a caption, a callout, a
   figure. Not a portrait, a link, a split or an array, which show none,
   nor a picture. */
function textAlignable(n){
  if(!n || isArrayNode(n)) return false;
  return !['ellipse', 'link', 'split', 'image'].includes(n.shape || '');
}
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
  /* …and a link is a circle with an arrow through it, which a quarter
     turn only points somewhere it does not go (the owner's list of 11.11). */
  rows.turn.hidden = !n || styleBarFree(n) || isArr || isLinkNode(n);
  /* Furniture's bar is the stack and nothing else. A caption and a
     picture have no border of their own to outline, no corners, and
     nothing a connector could meet. */
  rows.stack.hidden = !styleBarFree(n);
  rows.align.hidden = !(t.kind === 'node' && textAlignable(n));
  if(!rows.align.hidden) light(rows.align, n.align || 'center');
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
    rows.align.hidden = true;
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
    /* One frame flag, whichever way the words run (see noteFramed). */
    const framed = noteFramed(style);
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
/* …and an open list in the bar unfolds upward where downward would put
   it over the panel or off the screen. */
function unfoldStyleBarList(row){
  const list = row && row.querySelector('.style-bar-drop-list');
  if(!list) return;
  row.classList.remove('drop-up');
  const r = list.getBoundingClientRect();
  const d = document.getElementById('detail');
  const p = d && d.classList.contains('open') ? d.getBoundingClientRect() : null;
  const under = p && r.right > p.left && r.left < p.right && r.bottom > p.top;
  if(under || r.bottom > window.innerHeight - 4) row.classList.add('drop-up');
}
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
  keepClearOfEntryPanel(styleBar);
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
      if(group === 'align'){
        // Centred is the default, so it is the absence of the field.
        if(value === 'left' || value === 'right') opts.align = value; else delete opts.align;
      } else if(group === 'border'){
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
      } else if(group === 'frame'){
        /* A toggle: framed is the absence of the flag, along the line or
           level — one flag for both (the owner's list of 3.11). The older
           along-the-line flag goes as soon as the button is used. */
        const was = noteFramed(o);
        delete o.noteAlongFrame;
        if(was) o.noteFrame = false; else delete o.noteFrame;
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
