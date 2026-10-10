/* ---------------------------------------------------------------------
   The in-node editor.

   An entry's words used to be written in the settings drawer: click the
   entry, find the pencil, and type into a form at the other side of the
   screen while the thing being changed sat where it always was. The two
   were connected only by a live preview — which is to say, by the reader
   watching two places at once.

   They are one place now. A double click puts a field on the entry
   ITSELF, at the entry's own width, in the entry's own face and size and
   ink, with the toolbar floating just above it. Enter settles it; so does
   a click anywhere else, which is what a reader does next anyway. The
   drawer still holds everything an entry has that is not its words, and
   its Label field still works exactly as it did — this is a second way in,
   not a replacement for the form.

   The entry underneath keeps redrawing as you type, so it grows and wraps
   under the field, and the field is put back over it after every redraw.
   --------------------------------------------------------------------- */
const nodeEditor = document.getElementById('nodeEditor');
const nodeEditorText = document.getElementById('nodeEditorText');
/* `var`, deliberately: applyTransform runs while the page is still being
   built, long before this line is reached, and it asks whether the in-node
   field is open. A `let` is in its temporal dead zone until then — and a
   dead-zone read throws even from inside a typeof — so the first transform
   of the session took the whole boot down with it. */
var nodeEditorTarget = null, nodeEditorUndoPushed = false, nodeEditorCommitTimer = 0;
var noteEditorPaintFrame = 0;
/* WHAT the field is open on.
 *
 * Four things on this chart are a piece of text drawn on the drawing: an
 * entry's label, a portrait's card, a connector's note, and a callout. All
 * four used to be typed into a form somewhere else — three different forms
 * — and all four are now written where they are drawn, by one field. What
 * differs between them is only three questions: where is the box, what
 * does it currently say, and what does saying something else mean. So the
 * target is an object that answers those three, and everything else about
 * the field is the same code. */
function sameEditorTarget(a, b){
  if(!a || !b || a.kind !== b.kind) return false;
  // Two tabs of one entry are two different pieces of text, so moving
  // between them is opening the field somewhere else, not staying put.
  return a.kind === 'entry'
    ? (a.id === b.id && (a.tab ?? null) === (b.tab ?? null))
    : (a.from === b.from && a.to === b.to);
}
/* Which of an entry's texts is on the screen right now — its label, or the
   language tab it has been switched to. An entry with tabs shows one text
   at a time, and the one it is showing is the one a reader who double-clicks
   it means. */
function shownTabOf(id){
  const n = nodes.get(id);
  if(!n || !n.langTabs || !n.langTabs.length) return null;
  const k = activeLangTab.get(id);
  return (k == null || k < 0 || k >= n.langTabs.length) ? null : k;
}
/* Where the field goes: over the entry's own box — or, for a portrait,
   over the CARD, because a portrait's words are on the card and the circle
   holds a picture; or, for a connector's note, over the plate. */
function nodeEditorBoxFor(t){
  if(!t) return null;
  if(t.kind === 'note'){
    const plate = arrowLayer && arrowLayer.querySelector(
      `.edge-note[data-from="${cssEscape(t.from)}"][data-to="${cssEscape(t.to)}"] .edge-note-plate`);
    if(!plate) return null;
    const num = (k)=> parseFloat(plate.getAttribute(k) || '0');
    return {x:num('x'), y:num('y'), w:num('width'), h:num('height')};
  }
  const n = nodes.get(t.id);
  if(!n) return null;
  if((n.shape || '') === 'ellipse'){
    const g = bioCardLayer && bioCardLayer.querySelector(
      `.bio-card-g[data-id="${cssEscape(n.id)}"]`);
    /* The card's own rectangle, which the card wrote down for us — not the
       group's bounding box, which also contains the stub joining it to the
       portrait and so begins at the circle's rim. */
    const box = g && g.dataset.box && g.dataset.box.split(' ').map(Number);
    if(box && box.length === 4 && box.every(v=> Number.isFinite(v))){
      const [bx, by, bw, bh] = box;
      const turn = quarterTurnOf(n);
      if(!turn) return {x:bx, y:by, w:bw, h:bh};
      /* A turned portrait's card has gone round its portrait (see
         drawOneBioCard): the field stands at the card's turned middle and
         is turned itself; `outer` is the card as drawn. */
      const px = n.x + n.w/2, py = n.y + n.h/2;
      const a = turn * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      const dx = bx + bw/2 - px, dy = by + bh/2 - py;
      const mx = px + dx*c - dy*s, my = py + dx*s + dy*c;
      const side = turn % 180 ? {w: bh, h: bw} : {w: bw, h: bh};
      return {x: mx - bw/2, y: my - bh/2, w: bw, h: bh, turn,
              outer: {x: mx - side.w/2, y: my - side.h/2, w: side.w, h: side.h}};
    }
  }
  /* A turned entry writes its words along its own length, so the field is
     the UPRIGHT box — the same middle, the sides the other way round — and
     is turned to match; `outer` is the box as drawn, which the toolbar has
     to clear. */
  const turn = quarterTurnOf(n);
  const outer = {x:n.x, y:n.y, w:n.w, h:(n.h || 0)};
  /* A card writes its heading in a band of its own, below the picture.
     The field covers that band — found in the upright card and turned
     about the card's middle with the rest of it. */
  if(n.card && n.cardHead && n.cardHead.h > 0){
    const sideways = turn === 90 || turn === 270;
    const uw = sideways ? outer.h : outer.w, uh = sideways ? outer.w : outer.h;
    const cx = n.x + outer.w/2, cy = n.y + outer.h/2;
    const dy = n.cardHead.top + n.cardHead.h/2 - uh/2;
    const a = turn * Math.PI / 180;
    const mx = cx - dy*Math.round(Math.sin(a)), my = cy + dy*Math.round(Math.cos(a));
    const band = {x: mx - uw/2, y: my - n.cardHead.h/2, w: uw, h: n.cardHead.h};
    return Object.assign(band, turn ? {turn, outer} : {outer});
  }
  if(turn === 90 || turn === 270){
    return {x: n.x + (outer.w - outer.h)/2, y: n.y + (outer.h - outer.w)/2,
            w: outer.h, h: outer.w, turn, outer};
  }
  return turn ? Object.assign({turn, outer}, outer) : outer;
}
function positionNodeEditor(){
  const box = nodeEditorBoxFor(nodeEditorTarget);
  if(!box){ closeNodeEditor(true); return; }
  const rec = richFields.get('nodeEditorText');
  if(!rec) return;
  const host = document.querySelector('.main').getBoundingClientRect();
  const r = svg.getBoundingClientRect();
  const left = (r.left - host.left) + box.x*vs + vx;
  const top  = (r.top  - host.top ) + box.y*vs + vy;
  /* The field is the entry's own width, so a label wraps in the field
     exactly where it will wrap on the entry. The toolbar is NOT: it is a
     row of buttons whose size is its own business, and squeezing it to the
     width of a narrow entry turned five controls into five rows.
   *
     The floor is in CHART units, not screen ones. Written as a flat 120
     screen pixels it stopped shrinking as the drawing was zoomed out while
     the type inside it went on shrinking — so at a distance the field was
     a wide box with a line of ants in it, several times the size of the
     entry it was standing on. Multiplied by the zoom, the field and its
     words shrink together and the two always read as one thing. */
  /* Whether the thing under the field wraps its own text. A portrait's card
     and a connector's plate are laid out to a fixed width and run to as many
     lines as they need; an entry's label is put on one line and allowed to
     run past the box. The field does the same as whatever it is covering —
     see the stylesheet, where the two cases are spelled out. */
  const tn = nodeEditorTarget.kind === 'entry' ? nodes.get(nodeEditorTarget.id) : null;
  const wraps = nodeEditorTarget.kind === 'note' || (tn && (tn.shape || '') === 'ellipse');
  nodeEditor.dataset.wrap = wraps ? 'on' : 'off';
  /* The field starts as exactly the box it stands on — never bigger.
   *
   * It used to have a floor of its own, 120 units wide, and the height of
   * the textarea it replaced, so on a small entry the field opened as a
   * slab several times the size of the thing being edited and hid the
   * entries round it. Now the box sets the size and the field fits its
   * words into it: measured bare, then padded out to the box; where the
   * type's line is taller than a box closed on its ink, the field hangs
   * over the box rather than squeeze the line. As the words grow the entry grows under them, and the
   * field — put back over it after every redraw — grows with it.
   *
   * Where the field wraps, the width is the box's and is not negotiable;
   * where it does not, the box's width is a floor (`width:max-content`), so
   * the field is the entry's width until the words need more, which is
   * what the entry itself does. */
  const w = box.w*vs, hBox = box.h*vs;
  const surf = rec.surface.style;
  const lineH = parseFloat(rec.surface.dataset.lineH) || 0;
  // Measured upright; turned to match a turned entry only at the end.
  surf.transform = '';
  surf.minHeight = '0px';
  surf.height = '';
  surf.padding = '0px';
  if(lineH) surf.lineHeight = lineH.toFixed(2) + 'px';
  if(wraps){
    surf.minWidth = '';
    surf.width = w + 'px';
  } else {
    surf.width = '';
    surf.minWidth = '0px';
  }
  /* Never drawn in to fit. A box closed on its ink is shorter than the
     line its words stand on, and pressing the line to the box's height
     set the words on top of one another — the field showed the text
     squeezed where the entry shows it as it is. The field keeps the
     drawing's own line and hangs over the box, above and below alike. */
  const fitted = rec.surface.getBoundingClientRect();
  const padY = Math.max(0, (hBox - fitted.height) / 2);
  const padX = wraps ? 0 : Math.max(0, (w - fitted.width) / 2);
  surf.padding = padY.toFixed(2) + 'px ' + padX.toFixed(2) + 'px';
  /* The browser sets a line a hair wider than the drawing measured it.
     That hair is let hang over the field's edge rather than make the field
     bigger than the box; so is a line taller than a box closed on its ink,
     which the frame (see the stylesheet) is drawn inside of. */
  const hang = Math.max(0, (fitted.height - hBox) / 2);
  surf.setProperty('--hang', hang.toFixed(2) + 'px');
  if(!wraps){
    surf.minWidth = w + 'px';
    if(fitted.width > w && fitted.width - w < 4*vs) surf.width = w + 'px';
  }
  const bar = document.getElementById('nodeEditorBar');
  const barH = bar ? bar.getBoundingClientRect().height : 0;
  const gap = 4;
  /* Vertically CENTRED on the entry, because that is where the entry
     writes its words. A field pinned to the top of the box would put what
     is being typed a line above where it will end up. */
  const fieldH = rec.surface.getBoundingClientRect().height || NODE_EDITOR_MINH * vs;
  const fieldTop = top + (box.h*vs - fieldH)/2;
  const outerTop = box.outer ? (r.top - host.top) + box.outer.y*vs + vy : fieldTop;
  const barW = bar ? bar.getBoundingClientRect().width : w;
  /* Grown past the entry, the field grows BOTH WAYS. An entry writes its
     words centred on itself and lets a long one hang off either end; a
     field pinned to the entry's left edge and growing rightwards would put
     the same words somewhere else entirely. */
  const fieldW = rec.surface.getBoundingClientRect().width || w;
  /* Only where it is allowed to grow. A field that wraps is the width of the
     thing it covers and starts where that thing starts; one that grows past
     the box is showing words that hang off both ends, and centring is the
     only placement that puts them where the drawing puts them. */
  const fieldLeft = wraps ? left : left - Math.max(0, (fieldW - box.w*vs) / 2);
  /* Kept on the page: an entry at the very top or edge of the view would
     put its toolbar where it cannot be reached. */
  /* A field turned on its side is laid out upright and only drawn turned,
     so its laid-out ends stick out past what is seen by half the
     difference between its length and its depth. Kept on the page by what
     is SEEN: clamping the laid-out box pushed the field of a turned entry
     near the edge of the view sideways, off the words it stands on. */
  const sideways = box.turn === 90 || box.turn === 270;
  const overhang = sideways ? Math.max(0, (fieldW - fieldH) / 2) : 0;
  const x = Math.max(6 - overhang, Math.min(fieldLeft, host.width - Math.max(fieldW - overhang, barW) - 6));
  /* Over a turned entry the field is drawn taller than it is laid out, so
     the toolbar is held off by the difference to stay clear of it. */
  const lift = Math.max(0, fieldTop - outerTop);
  if(bar) bar.style.marginBottom = lift ? (gap + lift) + 'px' : '';
  // …and the toolbar, which is not turned, is held on the page by itself.
  if(bar) bar.style.marginLeft = x < 6 ? (6 - x) + 'px' : '';
  const y = Math.max(6, fieldTop + hang - barH - gap - lift);
  surf.transform = box.turn ? `rotate(${box.turn}deg)` : '';
  surf.transformOrigin = box.turn ? 'center' : '';
  nodeEditor.style.left = x + 'px';
  nodeEditor.style.top  = y + 'px';
}
const NODE_EDITOR_MINH = 22;
/* Whether this entry writes its words on itself. A picture has no words at
   all; everything else that carries text does. */
function nodeTakesInlineEditor(n){
  if(!n || readOnlyView) return false;
  return (n.shape || '') !== 'image';
}
function openNodeEditor(id, opts){
  const n = nodes.get(id);
  if(!n || !nodeTakesInlineEditor(n)) return false;
  /* A portrait's words live on its card, so the card has to be up before
     there is anywhere to put the field. */
  if((n.shape || '') === 'ellipse' && !bioCardLayer.querySelector(
       `.bio-card-g[data-id="${cssEscape(id)}"]`)){
    openBioCard(id);
  }
  return openTextEditorOn({kind:'entry', id, tab: shownTabOf(id)}, opts);
}
/* And the same field on a connector's note. */
function openEdgeNoteEditor(from, to, opts){
  if(readOnlyView) return false;
  const st = edgeStyleFor(from, to);
  /* Words, or a note that has just been asked for and has none yet — which
     is the only way a first note is ever written, since the field is where
     the words come from. Every edge carries an empty `note` by default, so
     emptiness alone cannot mean "there is a note here". */
  const starting = noteStarting && noteStarting.from === from && noteStarting.to === to;
  if(!st || (!st.note && !starting)) return false;
  return openTextEditorOn({kind:'note', from, to}, opts);
}
function openTextEditorOn(target, opts){
  if(readOnlyView) return false;
  if(nodeEditorTarget && !sameEditorTarget(nodeEditorTarget, target)) closeNodeEditor(true);
  if(!nodeEditorBoxFor(target)) return false;
  nodeEditorTarget = target;
  nodeEditorUndoPushed = false;
  if(target.kind === 'entry'){
    selectNode(target.id, {quiet:true, keepEditForm:true, keepSelection:true});
    paintMultiSelection();
    const nn = nodes.get(target.id);
    const tab = (target.tab != null && nn.langTabs) ? nn.langTabs[target.tab] : null;
    setRichValue(nodeEditorText, (tab ? tab.text : nn.label) || '');
  } else {
    setRichValue(nodeEditorText, edgeStyleFor(target.from, target.to).note || '');
  }
  nodeEditor.hidden = false;
  syncNodeEditorLook();
  /* An entry's box grows under the field as the words are typed; a note's
     plate is redrawn by the connector instead, so only the entry needs the
     live preview the drawer's Label field uses. */
  if(target.kind === 'entry') beginLabelPreview(target.id, nodeEditorText, target.tab);
  positionNodeEditor();
  const rec = richFields.get('nodeEditorText');
  if(rec && !(opts && opts.focus === false)){
    rec.surface.focus({preventScroll:true});
    try{
      const sel = window.getSelection(), r = document.createRange();
      r.selectNodeContents(rec.surface); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }catch(e){}
  }
  return true;
}
/* The field is set in the face, size, alignment and ink of whatever it is
   open on, so what is being typed looks like what it will be. */
function syncNodeEditorLook(){
  const rec = richFields.get('nodeEditorText');
  if(!rec || !nodeEditorTarget) return;
  if(nodeEditorTarget.kind === 'note'){
    rec.surface.style.fontFamily = EDGE_NOTE_FAMILY;
    rec.surface.style.fontSize = (EDGE_NOTE_FS * vs).toFixed(2) + 'px';
    rec.surface.dataset.lineH = (EDGE_NOTE_LINE_H * vs).toFixed(2);
    rec.surface.style.lineHeight = rec.surface.dataset.lineH + 'px';
    return finishNodeEditorLook(rec);
  }
  const n = nodes.get(nodeEditorTarget.id);
  if(!n) return;
  const size = (n.fontSize && n.fontSize >= 6 && n.fontSize <= 28) ? n.fontSize : NODE_FS;
  rec.surface.style.fontFamily = fontFamilyFor(n.font);
  rec.surface.style.fontSize = (size * vs).toFixed(2) + 'px';
  rec.surface.dataset.lineH = (LINE_H * (size / NODE_FS) * vs).toFixed(2);
  rec.surface.style.lineHeight = rec.surface.dataset.lineH + 'px';
  return finishNodeEditorLook(rec);
}
function finishNodeEditorLook(rec){
  /* A remark on a connector is written in the CONNECTOR'S ink — a note and
     a callout both follow the line they belong to — so the field offers no
     colour box while it is open on one of them. The ⟲ stays: it clears a
     face, a size, a bold or a rule, none of which is the line's to decide. */
  const hex = nodeEditor.querySelector('.tb-hex');
  const inherits = nodeEditorTarget &&
    (nodeEditorTarget.kind === 'note' ||
     (nodeEditorTarget.kind === 'entry' &&
      (nodes.get(nodeEditorTarget.id) || {}).shape === 'callout'));
  if(hex) hex.style.display = inherits ? 'none' : '';
  rec.surface.style.textAlign = nodeEditorAlign();
  /* The border scales with the drawing, as the type does; the padding is
     whatever is left of the box round the words (see positionNodeEditor). */
  rec.surface.style.borderWidth = Math.max(0.6, 1.6*vs).toFixed(2) + 'px';
  rec.surface.style.borderRadius = (5*vs).toFixed(2) + 'px';
}
/* How the words are set in the field: the way the thing being edited sets
   them. Everything the field opens on — an entry's label, a caption, a
   connector's note, a callout — is centred on the drawing. */
function nodeEditorAlign(){ return 'center'; }
function commitNodeEditorText(){
  const t = nodeEditorTarget;
  if(!t || readOnlyView) return;
  const text = nodeEditorText.value;
  if(t.kind === 'note'){
    const kept = edgeStyleFor(t.from, t.to);
    if((kept.note || '') === text) return;
    if(!nodeEditorUndoPushed){ pushUndo(); nodeEditorUndoPushed = true; }
    applyEdit(()=>{
      /* A note written down to nothing is not a note: it goes the way an
         emptied note goes anywhere else, taking its placement with it. */
      const bare = Object.assign({}, edgeStyleFor(t.from, t.to));
      if(text.trim()) bare.note = text;
      else { delete bare.note; delete bare.notePos; delete bare.noteAt;
             delete bare.noteDir; delete bare.noteLen; delete bare.noteBg; }
      setEdgeStyleOverride(t.from, t.to, bare);
    });
    refreshSaveUI();
    return;
  }
  const id = t.id;
  const n = nodes.get(id);
  if(!n) return;
  const k = (t.tab != null && n.langTabs && n.langTabs[t.tab]) ? t.tab : null;
  const current = k !== null ? (n.langTabs[k].text || '') : (n.label || '');
  const was = labelPreview && labelPreview.id === id ? labelPreview.original : current;
  if(was === text) return;
  if(!nodeEditorUndoPushed){ pushUndo(); nodeEditorUndoPushed = true; }
  commitEntry(()=>{
    const found = workingEntry(id);
    if(!found) return;
    if(k !== null){
      /* A tab's words go back into the tab they came from, and nothing else
         about the entry is touched — the label, the other tabs and every
         option keep exactly what they had. */
      const opts = entryOpts(found.entry);
      const tabs = Array.isArray(opts.langTabs) ? opts.langTabs.map(x=> Object.assign({}, x)) : [];
      if(!tabs[k]) return;
      tabs[k].text = text;
      opts.langTabs = tabs;
      putEntry(found.index, found.entry, opts);
      return;
    }
    found.entry[1] = text;
    /* Writing in an entry gives it back its own size.
     *
       A box dragged by its corner keeps exactly the size it was given —
       which is right while the words stay put, and wrong the moment they
       change: an entry shrunk by hand stayed shrunk however much was
       typed into it, so the text simply disappeared past the border with
       nothing on the chart to say why. Editing the words returns the box
       to the size those words ask for, up to the width a box may reach;
       past that the text is clipped, as it is anywhere else. The hand-set
       size is a statement about a text, and this is a different text. */
    const opts = entryOpts(found.entry);
    delete opts.size;
    putEntry(found.index, found.entry, opts);
  });
  if(labelPreview && labelPreview.id === id) labelPreview.original = text;
}
function queueNodeEditorCommit(){
  if(nodeEditorCommitTimer) clearTimeout(nodeEditorCommitTimer);
  nodeEditorCommitTimer = setTimeout(()=>{ nodeEditorCommitTimer = 0; commitNodeEditorText(); }, 420);
}
function closeNodeEditor(keep){
  if(!nodeEditorTarget) return;
  if(nodeEditorCommitTimer){ clearTimeout(nodeEditorCommitTimer); nodeEditorCommitTimer = 0; }
  if(noteEditorPaintFrame){ cancelAnimationFrame(noteEditorPaintFrame); noteEditorPaintFrame = 0; }
  const wasNote = nodeEditorTarget.kind === 'note';
  if(keep !== false) commitNodeEditorText();
  endLabelPreview(keep !== false);
  nodeEditor.hidden = true;
  nodeEditorTarget = null;
  nodeEditorUndoPushed = false;
  /* A note that was asked for and never written stops being drawn here.
     Whatever the field decided — words, or nothing — the note is now an
     ordinary one, and an ordinary one with no words is not drawn at all. */
  noteStarting = null;
  // A note left as a single space while it was being typed is not a note.
  if(wasNote){ redrawEdges(); applyVisibility(); }
}
setRichEnter('nodeEditorText', ()=> closeNodeEditor(true));
/* The surface writes through to this textarea, which fires no input event
   of its own, so both the preview and the commit are driven from the
   surface — the same wiring the drawer's Label and a callout's card use. */
(()=>{
  const rec = richFields.get('nodeEditorText');
  if(!rec) return;
  rec.surface.addEventListener('input', ()=>{
    queueNodeEditorCommit();
    // The entry is growing under the field, so the field follows it.
    requestAnimationFrame(positionNodeEditor);
  });
  /* A note has no live preview of its own — the connector redraws it — so
     the plate follows what is typed by being redrawn, on the same frame
     budget the entries use. */
  rec.surface.addEventListener('input', ()=>{
    if(!nodeEditorTarget || nodeEditorTarget.kind !== 'note') return;
    if(noteEditorPaintFrame) cancelAnimationFrame(noteEditorPaintFrame);
    noteEditorPaintFrame = requestAnimationFrame(()=>{
      noteEditorPaintFrame = 0;
      if(!nodeEditorTarget || nodeEditorTarget.kind !== 'note') return;
      const t = nodeEditorTarget;
      const kept = edgeStyleFor(t.from, t.to);
      setEdgeStyleOverride(t.from, t.to,
        Object.assign({}, kept, {note: nodeEditorText.value || ' '}));
      redrawEdges();
      applyVisibility();
      positionNodeEditor();
    });
  });
})();
/* Anywhere else settles it — the toolbar and its pickers excepted, since
   pressing a button on the field's own toolbar is working IN the field.
 *
 * The pickers are not inside the field: they are placed against the
 * viewport and live at the end of the page. They were excused here by
 * class names nothing on the page carries, so the press that chose a
 * sticker or a citation closed the field first — and the insert then
 * landed in a field that was no longer open. The names are the ones the
 * pickers actually wear. */
const NODE_EDITOR_SATELLITES = '#nodeEditor, .sticker-picker, #stickerPicker, #refPicker, #mediaPicker, .mini-toolbar';
document.addEventListener('mousedown', ev=>{
  if(!nodeEditorTarget) return;
  const t = ev.target;
  if(t && t.closest && t.closest(NODE_EDITOR_SATELLITES)) return;
  closeNodeEditor(true);
}, true);

