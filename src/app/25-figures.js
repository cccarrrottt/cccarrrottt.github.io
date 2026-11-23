/* ---------------------------------------------------------------------
   Placing and sizing a figure.

   A figure in a comment is a piece of the document, and a piece of a
   document is something you arrange. Both gestures are the ones this chart
   already uses everywhere else: pick the thing up and put it down, or pull
   its corner.

   Neither goes through the browser's own drag-and-drop. HTML5 dragging
   inside a contenteditable is a negotiation with the editor over what a
   drop means — it will happily leave the figure behind, duplicate it, or
   drop the alt text as a word — and none of that is visible until it has
   happened. Moving the element by hand is both predictable and short: a
   figure stands on its own line, so where it can go is a position between
   the lines, and that position is drawn as a rule while it is being
   carried rather than guessed at from a caret nobody can see.
   ------------------------------------------------------------------ */
const FIGURE_DRAG_SLOP = 4;      // px before a press becomes a carry
let figureDrag = null;
let figureSize = null;

/* The width of the column a figure stands in, in pixels: the surface's
   content box, since a percentage is measured against that and not against
   the border box the element reports. */
function surfaceColumnWidth(surface){
  const cs = getComputedStyle(surface);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return Math.max(20, surface.clientWidth - pad);
}
/* Where a carried figure would land: between two of the surface's own
   lines, chosen by which half of which line the pointer is in. */
function figureDropSpot(surface, y){
  const kids = [...surface.children].filter(k=> k !== figureDrag.mark);
  for(const k of kids){
    const r = k.getBoundingClientRect();
    if(y < r.top + r.height/2) return {node:k, before:true};
    if(y <= r.bottom) return {node:k, before:false};
  }
  const last = kids[kids.length - 1];
  return last ? {node:last, before:false} : null;
}
function wireFigureHandles(surface, textarea){
  surface.addEventListener('mousedown', ev=>{
    if(ev.button !== 0 || surface.classList.contains('locked')) return;
    const grip = ev.target.closest && ev.target.closest('.fig-grip');
    const fig = ev.target.closest && ev.target.closest('.rich-figure');
    if(!fig || !surface.contains(fig)) return;
    if(grip){
      ev.preventDefault(); ev.stopPropagation();
      figureSize = {surface, textarea, fig,
                    column: surfaceColumnWidth(surface),
                    startX: ev.clientX,
                    startW: fig.getBoundingClientRect().width};
      fig.classList.add('sizing');
      return;
    }
    /* A video's own controls are inside the figure and are the reason the
       clip is there at all — pressing play must not pick the figure up. */
    if(ev.target.tagName === 'VIDEO') return;
    ev.preventDefault();
    figureDrag = {surface, textarea, fig, startX: ev.clientX, startY: ev.clientY,
                  moved: false, mark: null, spot: null};
  });
}
window.addEventListener('mousemove', ev=>{
  if(figureSize){
    const w = clampFigureWidth(
      (figureSize.startW + (ev.clientX - figureSize.startX)) / figureSize.column * 100);
    if(w){ figureSize.fig.dataset.w = w; figureSize.fig.style.width = w + '%'; }
    return;
  }
  if(!figureDrag) return;
  const st = figureDrag;
  if(!st.moved){
    if(Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) < FIGURE_DRAG_SLOP) return;
    st.moved = true;
    st.fig.classList.add('dragging');
    document.body.classList.add('figure-dragging');
    st.mark = document.createElement('div');
    st.mark.className = 'rich-drop-mark';
    st.mark.contentEditable = 'false';
  }
  const spot = figureDropSpot(st.surface, ev.clientY);
  st.spot = spot;
  if(spot){
    if(spot.before) st.surface.insertBefore(st.mark, spot.node);
    else st.surface.insertBefore(st.mark, spot.node.nextSibling);
  }
}, true);
window.addEventListener('mouseup', ()=>{
  if(figureSize){
    const st = figureSize; figureSize = null;
    st.fig.classList.remove('sizing');
    st.textarea.value = richHtmlToMarkup(st.surface);
    st.surface.dispatchEvent(new Event('input', {bubbles:true}));
    return;
  }
  const st = figureDrag; figureDrag = null;
  if(!st) return;
  document.body.classList.remove('figure-dragging');
  st.fig.classList.remove('dragging');
  if(!st.moved || !st.mark || !st.mark.parentNode){
    if(st.mark && st.mark.parentNode) st.mark.remove();
    return;
  }
  /* The figure moves as its own line. It was inserted as one and it is put
     down as one, so carrying a picture out of the middle of a paragraph
     cannot leave half a sentence wrapped around where it used to be. */
  const line = document.createElement('div');
  const oldLine = st.fig.parentNode;
  line.appendChild(st.fig);
  st.mark.parentNode.insertBefore(line, st.mark);
  st.mark.remove();
  /* And the line it came out of goes if there is nothing left in it. */
  if(oldLine && oldLine !== st.surface && oldLine.parentNode === st.surface &&
     !oldLine.textContent.trim() && !oldLine.querySelector('img,video,.rich-figure')){
    oldLine.remove();
  }
  st.textarea.value = richHtmlToMarkup(st.surface);
  st.surface.dispatchEvent(new Event('input', {bubbles:true}));
}, true);


/* There used to be a toolbar here that addressed a LIST rather than one
   field — the language rows — and worked on whichever row had last been
   touched. It is gone with the rows' toolbar itself: every toolbar on the
   page now names the one surface it acts on, which is the only arrangement
   in which a reader can tell what a button is about to change. */
// The A button takes its colour from the hex box beside it in the same
// toolbar, so each toolbar carries its own current colour.
function toolbarHex(btn){
  const bar = btn.closest('.mini-toolbar');
  const box = bar && bar.querySelector('.tb-hex');
  return box ? hexFieldValue(box.value) : null;
}
document.querySelectorAll('.mini-toolbar button').forEach(btn=>{
  btn.addEventListener('mousedown', ev=> ev.preventDefault());  // keep the selection alive
  btn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    /* Named, always. The fallback was the drawer's Label box — the only
       other field an entry's words could be typed into — and with that box
       gone a toolbar button with no target is a bug, not a default. */
    const targetId = btn.dataset.wrapTarget;
    if(!targetId) return;
    const kind = btn.dataset.wrap;
    const arg = kind === 'color' ? toolbarHex(btn) : undefined;
    const rec = richFields.get(targetId);
    if(!rec) return;
    applyRichCommand(rec.surface, kind, arg);
    rec.textarea.value = richHtmlToMarkup(rec.surface);
    // Bold, colour and the rest show up on the entry as you apply them,
    // the same as typing does.
    if(targetId === 'nodeEditorText') queueLabelPreview();
  });
});
/* ---- a colour is a square --------------------------------------------
 *
 * Every colour on the page is shown the way a tag's is: a square of the
 * colour, and pressing it turns the square into the box its code is typed
 * in, right where the square was. Enter or leaving keeps what was typed,
 * Escape puts back what was there, and an emptied box takes the colour
 * off where off is a colour (the paper, the program's own). It used to be
 * a square AND a box side by side, everywhere, and every one of them a
 * slightly different pair — the square on the left inside the box, or
 * beside it, or under it in a row of its own. A code is something typed
 * now and then; the colour is what is read all the time.
 *
 * Two shapes of the same thing. openHexBox is the box that stands in for
 * an element for as long as it is open and gives it back; squareForHexInput
 * is a square in front of a field that stays in the page, because the
 * field is what the rest of the program reads and writes — and keeps
 * doing so, untouched, with the square only deciding when it is seen. */
/* The # of a colour code stays put (the owner's ask, 22.10).
 *
   A code pasted over a selection that took the # with it — or typed after
   a Backspace one too many — was "c23b22", which is not a colour, and the
   change was quietly not taken. So every colour field keeps its # at the
   front: it cannot be deleted, a pasted code with or without one comes
   out with exactly one, and a field holding nothing but the # means what
   an empty one always meant. Done on the way in, before the field's own
   listeners read the value, for every field the page has or will have. */
const HEX_FIELD = '.hex-box, .tb-hex';
function hexFieldValue(v){ return v.trim() === '#' ? '' : v.trim(); }
// What each field held when it was entered: one left as empty as it came
// changed nothing, and must not say it did.
const hexFieldEnteredEmpty = new WeakSet();
document.addEventListener('focusin', ev=>{
  const f = ev.target;
  if(!f || !f.matches || !f.matches(HEX_FIELD)) return;
  if(hexFieldValue(f.value)) hexFieldEnteredEmpty.delete(f);
  else { hexFieldEnteredEmpty.add(f); f.value = '#'; }
}, true);
document.addEventListener('input', ev=>{
  const f = ev.target;
  if(!f || !f.matches || !f.matches(HEX_FIELD)) return;
  // Only while somebody is typing in it: a field emptied as it is left
  // (below), or written by the program, is taken as it is.
  if(document.activeElement !== f) return;
  hexFieldEnteredEmpty.delete(f);
  const v = f.value, at = f.selectionStart == null ? v.length : f.selectionStart;
  const want = '#' + v.replace(/[#\s]/g, '');
  if(v === want) return;
  // The caret stays after the same characters it was after.
  const kept = v.slice(0, at).replace(/[#\s]/g, '').length;
  f.value = want;
  try{ f.setSelectionRange(kept + 1, kept + 1); }catch(e){}
}, true);
document.addEventListener('keydown', ev=>{
  const f = ev.target;
  if(!f || !f.matches || !f.matches(HEX_FIELD)) return;
  const a = f.selectionStart, b = f.selectionEnd;
  if(a !== b) return;
  if((ev.key === 'Backspace' && a <= 1) || (ev.key === 'Delete' && a === 0)) ev.preventDefault();
}, true);
/* A paste goes in without its # and its spaces. The fields stop at nine
   characters, and the browser cuts a paste down to the room that is left
   BEFORE anything above sees it: "#c23b22ff" pasted after the kept # was
   one character too long and lost its last digit. */
document.addEventListener('paste', ev=>{
  const f = ev.target;
  if(!f || !f.matches || !f.matches(HEX_FIELD) || !ev.clipboardData) return;
  const text = ev.clipboardData.getData('text').replace(/[#\s]/g, '');
  ev.preventDefault();
  f.setRangeText(text, f.selectionStart, f.selectionEnd, 'end');
  f.dispatchEvent(new Event('input', {bubbles: true}));
}, true);
document.addEventListener('focusout', ev=>{
  const f = ev.target;
  if(f && f.matches && f.matches(HEX_FIELD) && f.value.trim() === '#'){
    f.value = '';
    if(!hexFieldEnteredEmpty.has(f)) f.dispatchEvent(new Event('input', {bubbles: true}));
  }
}, true);
function openHexBox(anchor, o){
  if(!anchor || !anchor.isConnected) return null;
  const box = document.createElement('input');
  box.type = 'text';
  box.className = 'hex-box';
  box.maxLength = 9;
  box.spellcheck = false;
  box.value = o.value || '';
  box.placeholder = o.placeholder || '';
  if(o.title) box.title = o.title;
  const show = ()=>{
    const v = box.value.trim();
    box.classList.toggle('bad', !!v && !HEX_RE.test(v));
    box.style.setProperty('--swatch', HEX_RE.test(v) ? v : (o.swatch || 'transparent'));
  };
  show();
  anchor.replaceWith(box);
  let done = false;
  const finish = keep=>{
    if(done) return;
    done = true;
    if(openHexBox.current && openHexBox.current.box === box) openHexBox.current = null;
    const v = hexFieldValue(box.value);
    if(box.isConnected) box.replaceWith(anchor);
    if(keep && (v === '' || HEX_RE.test(v))) o.onCommit(v || null);
    else if(o.onCancel) o.onCancel();
  };
  box.addEventListener('mousedown', ev=> ev.stopPropagation());
  box.addEventListener('click', ev=> ev.stopPropagation());
  box.addEventListener('input', show);
  box.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); }
    if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); }
  });
  box.addEventListener('blur', ()=> finish(true));
  openHexBox.current = {box, close: keep=> finish(keep)};
  box.focus();
  box.select();
  return box;
}
/* The square in front of a field that stays. `fallback` is what the square
   shows while the field is empty — a colour that is inherited, say; with
   none it is the dashed square of "no colour". `onEnter` is for a field
   whose Enter also DOES something with the colour, and `onClick` for a
   square whose press does: there a click spends the colour, as the swatch
   on a word processor's toolbar does, and the code is opened by a double
   click, or by holding the square on a phone. */
function squareForHexInput(input, o){
  if(!input) return null;
  o = o || {};
  const sq = document.createElement('button');
  sq.type = 'button';
  sq.className = 'hex-square' + (o.cls ? ' ' + o.cls : '');
  // A toolbar's field is found by what it colours; so is its square.
  if(input.dataset.hexFor) sq.dataset.hexSquareFor = input.dataset.hexFor;
  input.before(sq);
  input.classList.add('hex-box', 'hex-shut');
  const paint = ()=>{
    const v = hexFieldValue(input.value), ok = HEX_RE.test(v);
    const fb = o.fallback ? o.fallback() : null;
    sq.style.background = ok ? v : (fb || '');
    // Dashed only when there is no colour at all: an inherited one is shown,
    // with the dashed edge a default colour wears (.inherited).
    sq.classList.toggle('unset', !ok && !fb);
    sq.classList.toggle('inherited', (!ok && !!fb) || (ok && !!o.isDefault && !!o.isDefault()));
    sq.title = (ok ? v : fb ? `${fb} — inherited` : 'No colour set') +
               (o.title ? ` — ${o.title}` : '') +
               (o.onClick ? '; click to use it, double-click to change it' : '; press to change');
    input.style.setProperty('--swatch', ok ? v : (fb || 'transparent'));
  };
  let was = null, prefilled = null;
  const isOpen = ()=> !input.classList.contains('hex-shut');
  const open = ()=>{
    if(isOpen()) return;
    const cur = openHexBox.current;
    if(cur && cur.box !== input) cur.close(true);
    openHexBox.current = {box: input, close: keep=> close(keep)};
    was = input.value;
    /* An empty field opened as "#" — the square went blank under the
       hand where it had shown the colour in use (the owner's list of
       30.10). It opens on that colour instead, to be typed over; left as
       it was, it is still the colour handed down, not one chosen. */
    prefilled = null;
    if(!HEX_RE.test(hexFieldValue(input.value)) && o.fallback){
      const fb = o.fallback();
      if(fb && HEX_RE.test(fb)){ prefilled = fb.toLowerCase(); input.value = fb; }
    }
    sq.classList.add('hex-shut');
    input.classList.remove('hex-shut');
    input.focus();
    input.select();
  };
  const close = keep=>{
    if(!isOpen()) return;
    if(openHexBox.current && openHexBox.current.box === input) openHexBox.current = null;
    // Kept only when it is a colour, or empty; anything else is put back.
    const v = hexFieldValue(input.value);
    if(prefilled && v.toLowerCase() === prefilled) input.value = was;
    prefilled = null;
    if(keep && v !== '' && !HEX_RE.test(v)) keep = false;
    if(!keep && was !== null && input.value !== was){
      input.value = was;
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
    input.classList.add('hex-shut');
    sq.classList.remove('hex-shut');
    paint();
  };
  sq.addEventListener('mousedown', ev=>{
    ev.stopPropagation();
    /* A toolbar's square must not take the selection away from the words
       it is about to colour — see rememberSurfaceSelection. */
    if(o.keepSelection) ev.preventDefault();
    if(o.onPress) o.onPress();
  });
  sq.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(o.onClick) o.onClick(input.value.trim());
    else open();
  });
  if(o.onClick){
    sq.addEventListener('dblclick', ev=>{ ev.stopPropagation(); open(); });
    // A long press on a phone ends in contextmenu; so does a right click.
    sq.addEventListener('contextmenu', ev=>{ ev.preventDefault(); ev.stopPropagation(); open(); });
  }
  input.addEventListener('input', paint);
  input.addEventListener('keydown', ev=>{
    if(ev.key !== 'Enter' && ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.key === 'Enter'){
      if(o.onEnter) o.onEnter(input.value.trim());
      close(true);
    } else close(false);
  });
  input.addEventListener('blur', ()=> close(true));
  const rec = {square: sq, paint, open, close};
  input._hexSquare = rec;
  paint();
  return rec;
}
/* One code open at a time. Pressing another square while a code is being
 * typed keeps that code — when it is a colour — and opens the square that
 * was pressed.
 *
 * Left to the browser, the press took focus from the open box, the box
 * committed on its blur, and the commit redrew the list the pressed square
 * stood in — so by the time the click came the square it was meant for was
 * gone, and the press only closed the box. Here the press is taken before
 * it can move focus: the open code is kept, the square is found again in
 * whatever was drawn in its place (by its path from the nearest element
 * with an id, which a redraw keeps), and opened. The click that follows is
 * swallowed — it has already been answered. */
function pathToSquare(el){
  const steps = [];
  let at = el;
  while(at && at.parentElement && !at.id){
    steps.unshift(Array.prototype.indexOf.call(at.parentElement.children, at));
    at = at.parentElement;
  }
  const root = at && at.id ? at.id : null;
  return ()=>{
    let n = root ? document.getElementById(root) : null;
    for(const i of steps){ if(!n) return null; n = n.children[i]; }
    return n;
  };
}
const HEX_SQUARE_SEL = '.hex-square, .swatch-pick';
document.addEventListener('pointerdown', ev=>{
  const cur = openHexBox.current;
  const sq = cur && ev.target.closest && ev.target.closest(HEX_SQUARE_SEL);
  if(!sq || sq.disabled) return;
  ev.preventDefault();
  ev.stopPropagation();
  const find = pathToSquare(sq);
  cur.close(true);
  const again = find();
  if(again && again.matches(HEX_SQUARE_SEL)){
    const field = again.classList.contains('hex-square') ? again.nextElementSibling : null;
    if(field && field._hexSquare) field._hexSquare.open();
    else again.click();
  }
  /* Only after the square was opened, or this would swallow that click;
     and only the click of THIS press — a press that ended somewhere else
     brings no click, and the next press's click is its own. */
  const swallow = e=>{ e.stopPropagation(); e.preventDefault(); drop(); };
  const drop = ()=>{
    document.removeEventListener('click', swallow, {capture: true});
    document.removeEventListener('pointerdown', drop, {capture: true});
  };
  document.addEventListener('click', swallow, {capture: true});
  setTimeout(()=> document.addEventListener('pointerdown', drop, {capture: true}), 0);
  setTimeout(drop, 600);
}, true);
/* The square follows its field: repainted after the field was written to
   by the program, and shown or hidden with it. */
function paintHexSquare(input){
  if(input && input._hexSquare) input._hexSquare.paint();
}
function showHexSquare(input, on){
  if(!input || !input._hexSquare) return;
  if(!on) input._hexSquare.close(true);
  input._hexSquare.square.style.display = on ? '' : 'none';
}
/* Seen but not yet in use — the second colour of a gradient that is off:
   it stands where it will be, greyed, so turning the gradient on does not
   move anything. */
function enableHexSquare(input, on){
  if(!input || !input._hexSquare) return;
  if(!on) input._hexSquare.close(true);
  input._hexSquare.square.disabled = !on;
}
/* A list of colours — rings round a border, a gradient across a ground —
   is a row of squares, one per colour, and a dashed one after them that
   adds another. Pressing a square opens its code; emptied, the colour
   leaves the list. The comma-separated field is still the value the form
   reads and writes, so it stays, hidden, and every change goes through it
   exactly as typing in it did. */
/* `inherited` says whether what the list shows is a colour handed down
   rather than one chosen here: the border field shows the colour an entry
   is drawn in even when that comes from its tags, and those squares wear
   the dashed edge every inherited square does (.inherited). */
/* `fallback` is the colour an empty list stands for, which its one
   square then shows, dashed, rather than a blank to press. */
function wireSwatchStrip(inputId, stripId, inherited, fallback){
  const input = document.getElementById(inputId);
  const strip = document.getElementById(stripId);
  if(!input || !strip) return;
  input.classList.add('hex-shut');
  const write = (parts)=>{
    input.value = parts.join(', ');
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('blur'));
    if(typeof flushNodeEditCommit === 'function') flushNodeEditCommit();
  };
  const paint = ()=>{
    strip.innerHTML = '';
    const parts = input.value.split(',').map(s=>s.trim()).filter(Boolean);
    parts.forEach((c, i)=>{
      const chip = document.createElement('span');
      chip.className = 'swatch-chip swatch-pick';
      const ok = HEX_RE.test(c);
      if(ok && inherited && inherited()) chip.classList.add('inherited');
      chip.style.background = ok ? c : 'transparent';
      chip.title = (ok ? c : c + ' — not a valid hex color') + '; press to change, empty to remove';
      if(!ok) chip.style.boxShadow = '0 0 0 1px var(--accent) inset';
      chip.addEventListener('mousedown', ev=> ev.stopPropagation());
      chip.addEventListener('click', ev=>{
        ev.stopPropagation();
        if(readOnlyView) return;
        openHexBox(chip, {value: c, placeholder: c, swatch: ok ? c : null,
          onCommit: v=>{
            const next = parts.slice();
            if(v) next[i] = v; else next.splice(i, 1);
            if(next.join(', ') !== parts.join(', ')) write(next);
          }});
      });
      strip.appendChild(chip);
    });
    /* An empty list draws an empty square rather than the word "default":
       a word in a row of colour squares reads as a different kind of
       thing. It is the same dashed square that adds a colour to a list
       that has some, so there is always one place to press. */
    const add = document.createElement('span');
    const fb = !parts.length && fallback ? fallback() : null;
    add.className = 'swatch-chip swatch-pick ' + (fb ? 'inherited' : 'swatch-blank');
    if(fb) add.style.background = fb;
    add.title = parts.length ? 'Add another colour'
      : fb ? `${fb} — the default; press to set one` : 'No colour set — the default is used; press to set one';
    add.addEventListener('mousedown', ev=> ev.stopPropagation());
    add.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(readOnlyView) return;
      openHexBox(add, {value: '', placeholder: fb || input.placeholder || '#20242b', swatch: fb,
        onCommit: v=>{ if(v) write(parts.concat([v])); }});
    });
    strip.appendChild(add);
  };
  input.addEventListener('input', paint);
  paint();
  return paint;
}
const paintEditSwatches = wireSwatchStrip('editColorsInput', 'editColorsSwatches', ()=>{
  const n = selectedId && nodes.get(selectedId);
  const v = hexFieldValue(document.getElementById('editColorsInput').value).toLowerCase();
  return !!n && !(n.ownColors && n.ownColors.length) && v === drawnColorText(n).toLowerCase();
});
const paintEditBgSwatches = wireSwatchStrip('editBgInput', 'editBgSwatches', null,
  ()=> selectedId ? entryGroundShown(selectedId) : null);
/* The background field, which behaves the OTHER way round from the border
   one: an entry with no background is a perfectly ordinary entry — it is
   drawn on the paper — so an empty box means exactly that and stays empty.
   The reset button empties it. */
{
  const field = document.getElementById('editBgInput');
  const reset = document.getElementById('editBgReset');
  if(field && reset){
    const sync = ()=>{
      reset.disabled = !hexFieldValue(field.value);
      reset.title = reset.disabled ? 'This entry is already on the paper'
                                   : 'Back to the paper';
    };
    reset.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(!hexFieldValue(field.value)) return;
      field.value = '';
      if(paintEditBgSwatches) paintEditBgSwatches();
      field.dispatchEvent(new Event('input', {bubbles:true}));
      flushNodeEditCommit();
      sync();
    });
    field.addEventListener('input', sync);
    window.syncBgResetState = sync;
  }
}
/* Emptying the field puts the default straight back.
 *
 * Now that the box always shows a real colour, an empty box is not a
 * state the entry can be in — there is no such thing as an entry with no
 * border colour. Clearing it therefore means "give me the default back",
 * and the quickest way to say that is to show it immediately rather than
 * leave an empty box that silently resolves to something on commit.
 *
 * It waits for the field to lose focus or for a moment's pause, so that
 * selecting-all and typing a replacement is not fought halfway through:
 * the box is briefly empty during that gesture, and refilling it on the
 * keystroke would eat what the user was typing. */
{
  const field = document.getElementById('editColorsInput');
  let restoreTimer = null;
  const restoreIfEmpty = ()=>{
    if(hexFieldValue(field.value) !== '') return;
    const n = selectedId && nodes.get(selectedId);
    field.value = n ? drawnColorText(n) : DEFAULT_NODE_COLOR;
    if(paintEditSwatches) paintEditSwatches();
    field.dispatchEvent(new Event('input', {bubbles:true}));
  };
  field.addEventListener('input', ()=>{
    clearTimeout(restoreTimer);
    if(hexFieldValue(field.value) === '') restoreTimer = setTimeout(restoreIfEmpty, 700);
  });
  field.addEventListener('blur', ()=>{ clearTimeout(restoreTimer); restoreIfEmpty(); });
}

// The hex boxes keep a live swatch of what the A button will apply, and
// must not steal focus from the text being coloured.
/* Black, like every other "no colour set yet" field on the chart. The old
   default was the accent, which meant the box always suggested a change. */
const DEFAULT_TEXT_COLOR = '#20242b';
document.querySelectorAll('.tb-hex[data-hex-for]').forEach(box=>{
  const paint = ()=>{
    const v = hexFieldValue(box.value);
    const ok = HEX_RE.test(v);
    box.classList.toggle('bad', !ok);
    // Empty draws an empty swatch, the same as an unset border colour does,
    // rather than a stale colour that no longer describes the field.
    box.style.setProperty('--swatch', ok ? v : 'transparent');
  };
  /* Same rules as the border-colour field: the box always shows a real
     colour, and emptying it means "give me the default back" rather than
     leaving a blank that silently resolves to something on use. The pause
     is so that select-all-then-retype is not fought halfway through — the
     box is briefly empty during that gesture. */
  let restoreTimer = null;
  const restoreIfEmpty = ()=>{
    if(hexFieldValue(box.value) !== '') return;
    box.value = DEFAULT_TEXT_COLOR;
    paint();
  };
  box.addEventListener('input', ()=>{
    paint();
    clearTimeout(restoreTimer);
    if(hexFieldValue(box.value) === '') restoreTimer = setTimeout(restoreIfEmpty, 700);
  });
  box.addEventListener('blur', ()=>{ clearTimeout(restoreTimer); restoreIfEmpty();
    /* The wash goes with the trip. Leaving it painted after the caret has
       gone somewhere else entirely would be a highlight over words nothing
       is about to happen to. */
    paintHeldSelection(null); });
  box.addEventListener('click', ev=> ev.stopPropagation());

  /* Focusing the hex box must not throw away the selection either: a value
     is often typed AFTER choosing the words it is for. The surface's own
     selection is remembered on the way in and restored on the way out. */
  box.addEventListener('focus', ()=> rememberSurfaceSelection(box));
  if(!hexFieldValue(box.value)) box.value = DEFAULT_TEXT_COLOR;
  paint();
  /* Shut behind its square like every colour on the page. A click puts
     the square's colour on the chosen words; a double click opens its code
     with those words held, and Enter puts the new colour on them. */
  squareForHexInput(box, {
    keepSelection: true,
    title: 'the colour of the chosen words',
    /* The ink the words have when nobody coloured them is a default like
       any other, and wears the same dashed edge. */
    isDefault: ()=> hexFieldValue(box.value).toLowerCase() === String(DEFAULT_TEXT_COLOR).toLowerCase(),
    onPress: ()=> rememberSurfaceSelection(box),
    onClick: v=>{ if(HEX_RE.test(v)) applyHexFromBox(box, v); },
    onEnter: v=>{ if(HEX_RE.test(v)) applyHexFromBox(box, v); }
  });
});

/* The words a toolbar was last pointed at, so a trip to the hex box and
   back does not lose them. */
const heldSelection = new Map();
function surfaceForHexBox(box){
  const bar = box.closest('.mini-toolbar');
  return bar ? surfaceForToolbar(bar) : null;
}
/* The remembered words go on LOOKING chosen.
 *
 * A document has one selection, so moving the caret into the hex box takes
 * it away from the text being coloured: the range was remembered and put
 * back on use, and it worked — but the highlight vanished the instant the
 * box was clicked, so the reader was typing a colour with no sign of what
 * it was for, and the natural response was to go back and select the words
 * again, which is the round trip the memory exists to avoid. A custom
 * highlight paints the same range in the same wash without owning the
 * selection, so the words stay visibly chosen while the value is typed. */
const heldHighlight = (()=>{
  try{
    if(typeof Highlight !== 'function' || !window.CSS || !CSS.highlights) return null;
    const h = new Highlight();
    CSS.highlights.set('held-selection', h);
    return h;
  }catch(e){ return null; }
})();
function paintHeldSelection(range){
  if(!heldHighlight) return;
  try{
    heldHighlight.clear();
    if(range) heldHighlight.add(range);
  }catch(e){}
}
/* The last run of words picked out in ANY editing surface.
 *
 * Reading the live selection when the hex box takes focus is not reliable:
 * a real click leaves it in place long enough to be read, and moving focus
 * by script clears it first — so the same gesture worked or did not
 * depending on how focus arrived. The selection is watched instead and the
 * last non-empty one kept, which is true whichever way the caret leaves. */
let lastSurfaceRange = null;   // {surface, range}
document.addEventListener('selectionchange', ()=>{
  const sel = window.getSelection && window.getSelection();
  if(!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  if(r.collapsed) return;
  const c = r.commonAncestorContainer;
  const host = c && c.nodeType === 1 ? c : (c && c.parentNode);
  const surface = host && host.closest ? host.closest('.rich-surface') : null;
  if(surface) lastSurfaceRange = {surface, range: r.cloneRange()};
});
/* The reset control, which clears the WHOLE text rather than a selection.
 *
 * An entry paints its label in its own border colour, and a run given a
 * colour of its own overrides that. Getting back is the point of this
 * button — and getting back part-way is not a state anyone asked for: if
 * you want the entry's colour again you want it everywhere, and hunting
 * down three separately coloured runs to select each of them in turn was
 * the only way to do it. It selects everything itself and strips the lot,
 * so one press returns the text to inheriting the border. */
document.querySelectorAll('[data-hex-reset]').forEach(btn=>{
  btn.addEventListener('mousedown', ev=> ev.preventDefault());
  btn.addEventListener('click', ev=>{
    ev.stopPropagation();
    /* Two kinds of toolbar carry this button now.
     *
     * On a field that offers a colour it sits beside the hex box and
     * strips the colour along with everything else. On a connector's note
     * and on a callout there IS no colour control — those are written in
     * the connector's own ink, decided by the line and not by the reader —
     * and the button was taken away with the box it stood next to, which
     * removed the only way to undo a face, a size or a bold as well. It
     * stands on its own there and clears everything the reader CAN set,
     * leaving the inherited colour exactly where it is. */
    const box = btn.parentNode.querySelector('.tb-hex');
    const surface = box ? surfaceForHexBox(box)
                        : surfaceForToolbar(btn.closest('.mini-toolbar'));
    if(!surface) return;
    if(box) heldSelection.delete(box);
    paintHeldSelection(null);
    surface.focus({preventScroll:true});
    const all = document.createRange();
    all.selectNodeContents(surface);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(all);
    /* Everything, not only the colour. The button reads as "put this text
       back the way it was", and leaving a face, a size, a bold and a
       reading behind while removing the colour is not that — it is one
       quarter of it, and the reader is left hunting the other three. */
    if(box) applyRichCommand(surface, 'uncolor');
    applyRichCommand(surface, 'unfont');
    applyRichCommand(surface, 'unsize');
    applyRichCommand(surface, 'unstyle');
    if(box){
      box.value = DEFAULT_TEXT_COLOR;
      box.dispatchEvent(new Event('input', {bubbles:true}));
    } else {
      // No box to fire the commit for us, so the field says so itself.
      surface.dispatchEvent(new Event('input', {bubbles:true}));
    }
  });
});

['detailNoteInput','nodeEditorText']
  .forEach(id=> makeRichField(document.getElementById(id)));
/* The note is a document (the owner's list of 19.11): Enter starts the
   next line, as in any editor, and the note is settled as it is written. */
makeRichDocument(document.getElementById('detailNoteInput'));
/* Typing in either of these redraws the element itself, on the next frame
   so a fast typist doesn't trigger a re-layout per keystroke. A caption, a
   callout and a connector's note all used to have a field of their own in
   a panel; all three are written on the drawing now, by the one field. */
['nodeEditorText'].forEach(id=>{
  const rec = richFields.get(id);
  if(!rec) return;
  rec.surface.addEventListener('input', ()=> queueLabelPreview());
});


/* ---------------------------------------------------------------------
   The note editor in the detail drawer.

   It sits in the drawer rather than inside the entry form because a note
   is the thing you read when you click a node, and wanting to fix a word
   in it shouldn't mean opening a separate editing mode for the whole
   entry. The pencil opens it where it stands, looking just as it did, with
   the formatting buttons under "Note" (the owner's list of 19.11); the
   words settle as they are written, and the pencil again closes it.
   ------------------------------------------------------------------ */
const detailNoteInput = document.getElementById('detailNoteInput');
const detailNoteEditBtn = document.getElementById('detailNoteEdit');
const detailNoteToolbar = document.getElementById('detailNoteToolbar');
const detailNoteSurface = richFields.get('detailNoteInput').surface;
let detailNoteEditing = false;

function setDetailNoteEditing(on){
  detailNoteEditing = on;
  setEditable(detailNoteSurface, on ? 'true' : 'false');
  detailNoteSurface.classList.toggle('locked', !on);
  detailNoteSurface.classList.toggle('doc-open', on);
  // makeRichField sets a min-height inline to match the textarea it stood
  // in for; inline styles outrank the .locked rule, so it has to be
  // cleared by hand or a one-line note would still reserve three rows.
  detailNoteSurface.style.minHeight = '';
  detailNoteToolbar.style.display = on ? '' : 'none';
  detailNoteEditBtn.classList.toggle('active', on);
  if(!on) closeRulePanel();
  if(on){
    detailNoteSurface.focus();
    /* At the end of what is written: inside the last line, or the last
       item of a list that ends it — never between a list's items. */
    let last = detailNoteSurface.lastElementChild;
    while(last && /^(UL|OL)$/.test(last.tagName) && last.lastElementChild) last = last.lastElementChild;
    placeCaret(last || detailNoteSurface, true);
  }
}
function showDetailNote(markup){
  setRichValue(detailNoteInput, markup);
  setDetailNoteEditing(false);
  syncNoteExpandBtn();
}
/* Nothing to open at full size when there is nothing written.
 *
 * The button is the drawer's answer to a note too long for a column three
 * hundred pixels wide; on an entry with no note it offered to show an
 * empty card, which is a control that cannot do anything. */
function syncNoteExpandBtn(){
  const btn = document.getElementById('detailNoteExpand');
  if(!btn) return;
  const text = (detailNoteInput && detailNoteInput.value || '').trim();
  btn.style.display = text ? '' : 'none';
}
/* The note settles as it is written, like every other field.
 *
 * It was the one place in the entry editor that waited for a button.
 * Everything else — the label, the colours, the archetype — takes effect
 * as you make the change, so nobody expected this one to be different:
 * type a note, click the next entry, and the words were gone. Nothing was
 * stored, the Save button still said "Saved", and there was nothing to
 * undo, because as far as the chart was concerned nothing had happened.
 *
 * So it commits on a pause, exactly as the label does, and the whole time
 * the field is open is one step of undo. There is no Apply and no Cancel
 * any more (19.11): what was written is kept, and Ctrl+Z is the way back. */
let detailNoteUndoPushed = false;
let detailNoteTimer = 0;
let detailNoteOwner = null;      // the entry the open editor belongs to
function flushDetailNoteCommit(){
  if(detailNoteTimer){ clearTimeout(detailNoteTimer); detailNoteTimer = 0; }
  commitDetailNote();
}
detailNoteSurface.addEventListener('input', ()=>{
  syncNoteExpandBtn();
  if(detailNoteEditing) queueDetailNoteCommit();
});
detailNoteSurface.addEventListener('blur', ()=>{ if(detailNoteEditing) flushDetailNoteCommit(); });
detailNoteEditBtn.onclick = (ev)=>{
  ev.stopPropagation();
  if(!selectedId || readOnlyView) return;
  if(detailNoteEditing){ flushDetailNoteCommit(); setDetailNoteEditing(false); return; }
  detailNoteOwner = selectedId;
  detailNoteUndoPushed = false;
  setDetailNoteEditing(true);
};

// Colours are typed as hex rather than picked from a swatch, so an exact
// value can be pasted in and read back out. HEX_RE is in 01-store.js.
function readHex(input){
  // A field holding only its # is an empty one (see HEX_FIELD).
  const v = hexFieldValue(input.value);
  const ok = HEX_RE.test(v);
  input.classList.toggle('bad', v !== '' && !ok);
  return ok ? v : null;
}
