
/* ---------------------------------------------------------------------
   The entry editor commits as you work.

   There is no Apply to press: a change to the text, the colours, the
   archetype or the font takes effect the moment you make it, exactly like
   dragging an entry does. Typing is settled after a short pause so a
   sentence is one edit rather than one per keystroke, and the whole
   editing session collapses into a single step of undo — pressing Ctrl+Z
   once puts the entry back the way it was before you opened the form,
   instead of walking backwards letter by letter.

   Nothing is published until Save; this is the same local-edit model the
   rest of the chart uses.
   ------------------------------------------------------------------ */
let nodeEditUndoPushed = false;   // one undo step per editing session
let nodeEditTimer = 0;

function beginNodeEditSession(){ nodeEditUndoPushed = false; }
function pushNodeEditUndoOnce(){
  if(nodeEditUndoPushed) return;
  pushUndo();
  nodeEditUndoPushed = true;
}
function queueNodeEditCommit(delay){
  if(nodeEditTimer) clearTimeout(nodeEditTimer);
  nodeEditTimer = setTimeout(()=>{ nodeEditTimer = 0; commitNodeEdit(); }, delay === undefined ? 480 : delay);
}
function flushNodeEditCommit(){
  if(!nodeEditTimer) return;
  clearTimeout(nodeEditTimer); nodeEditTimer = 0;
  commitNodeEdit();
}

function commitNodeEdit(){
  if(!selectedId || readOnlyView) return;
  if(detailEditForm.style.display !== 'block') return;
  const id = selectedId;
  clearEditStatus();
  /* The words are not this form's any more — they are typed on the entry
     itself — so what the entry already says is what it goes on saying. It
     is still written back, because putEntry rewrites the whole record and
     a field left out of it is a field deleted. */
  const kept0 = nodes.get(id);
  const newLabel = (kept0 && kept0.label) || '';
  /* An empty label is an edit like any other.
   *
     This used to refuse to commit one, on the reasoning that an empty field
     is a sentence half deleted rather than a decision. In practice it meant
     the one edit you could not make was "take these words away": you
     selected the label, pressed Delete, watched the box empty out, clicked
     away — and the old text came straight back, because nothing had been
     written down. Entries are allowed to hold no text now (see the add
     form), so an empty field simply means an empty entry. */
  endLabelPreview(true);
  const newLink = editLinkInput.value.trim();
  const colorsRaw = editColorsInput.value.trim();
  let newColors = [];
  if(colorsRaw){
    newColors = colorsRaw.split(',').map(s=>s.trim()).filter(Boolean);
    for(const c of newColors){
      if(!HEX_RE.test(c)){
        setEditStatus('err', `"${c}" isn't a valid hex color yet (e.g. #c23b22) — the borders keep their current colours.`);
        return;
      }
    }
  }
  /* The field shows the colour an entry with none of its own is DRAWN in,
     because a blank box gave nothing to nudge — so reading it back is not
     the same as the entry asking for that colour. Written back as it
     stands, the default became a colour of the entry's own on the next
     commit of anything else on the form, and on the reset button's own:
     the box refills itself a moment after being emptied, and that refill
     is an input like any other. The entry ended up wearing the default
     by name, and the reset had undone itself. Unchanged is unchanged. */
  /* …and the same for colours an entry wears from its tags: shown in the
     box, they are not the entry's to keep. */
  if(kept0 && !(kept0.ownColors && kept0.ownColors.length) &&
     newColors.join(', ').toLowerCase() === drawnColorText(kept0).toLowerCase()){
    newColors = [];
  }
  const bgRaw = editBgInput.value.trim();
  let newBg = [];
  if(bgRaw){
    newBg = bgRaw.split(',').map(s=>s.trim()).filter(Boolean);
    for(const c of newBg){
      if(!HEX_RE.test(c)){
        setEditStatus('err', `"${c}" isn't a valid hex color yet (e.g. #f4e9c9) — the background keeps what it has.`);
        return;
      }
    }
  }
  const newShape = editShapeInput.value==='rect' ? undefined : editShapeInput.value;
  /* A CARD keeps a picture too — that is the whole of its first band.
     It was left off this list, so the field offered a picture, embedded
     the file, showed it on the entry while the form was open, and then
     dropped it on the first commit: choosing a picture for a card did
     nothing at all, twice over (see the form-open order below, which had
     the field hidden as well). */
  const cardNow = editCardCheck.checked && CARD_CAPABLE.has(editShapeInput.value || 'rect');
  /* What a card holds — its picture, its middle line, its kind of medium
     and the facts of it — stays with an entry that could wear the card
     again, so turning card layout off and back on is not a way to lose
     them (the owner's list of 7.11). Nothing draws them while the card is
     off; only an archetype that cannot hold a card lets them go. */
  const cardKept = cardNow || CARD_CAPABLE.has(editShapeInput.value || 'rect');
  const newImage = (newShape==='ellipse' || newShape==='image' || cardKept)
    ? editImageInput.value.trim() : '';
  /* …less whatever this archetype cannot wear. Changing an entry INTO a
     portrait is the other way the two scenery tags can arrive on one. */
  const newTags = keepAllowedTags(parseTagsField(editTagsInput.value), newShape);
  /* Carried through, not read back out of a control nobody could reach.
     The entry's own face and size were set by four hidden inputs that were
     never shown; the values are real and are kept, the controls are not. */
  const newFont = (kept0 && kept0.font) || undefined;
  const newFontSizeRaw = (kept0 && kept0.fontSize != null) ? String(kept0.fontSize) : '';
  let newFontSize;
  if(newFontSizeRaw){
    newFontSize = Number(newFontSizeRaw);
    if(!Number.isFinite(newFontSize) || newFontSize<6 || newFontSize>28){
      setEditStatus('err', 'Font size has to be between 6 and 28.');
      return;
    }
  }
  const newCard = cardNow;
  const newMultiLang = editMultiLangCheck.checked;
  /* The chips carry each tab's WORDS as well as its name, and the words
     are typed somewhere else — on the entry, with that tab chosen. So what
     the entry holds is read back into the chips before the form is
     collected; without it, saving anything at all in this form would put
     back whatever the tab said when the form was opened. */
  syncLangTabTexts(nodes.get(id));
  const newLangTabs = newMultiLang ? collectLangTabs(editLangTabList) : [];
  // Turning multi-language on before naming a tab is a normal
  // half-finished state, not an error to shout about — an unnamed chip is
  // not a tab yet.
  pushNodeEditUndoOnce();
  let dropped = 0;
  commitEntry(()=>{
    const found = workingEntry(id);
    if(!found) return;
    const entry = found.entry;
    /* A size set by hand stays when the words change — see
       commitNodeEditorText, which says why. */
    entry[1] = newLabel;
    entry[5] = newShape;   // the note has its own editor in the drawer
    const opts = entryOpts(entry);
    if(newLink) opts.link = newLink; else delete opts.link;
    if(newColors.length) opts.colors = capColors(newColors, newShape); else delete opts.colors;
    if(newBg.length) opts.bg = newBg; else delete opts.bg;
    /* opts.border and opts.square are carried through untouched: they are
       set from the entry's hover bar, not from this form. */
    if(newTags.length) opts.tags = newTags; else delete opts.tags;
    if(newFont) opts.font = newFont; else delete opts.font;
    if(newFontSize) opts.fontSize = newFontSize; else delete opts.fontSize;
    const hadImage = opts.image;
    if(newImage) opts.image = newImage; else delete opts.image;
    /* A size set by hand is a size for the layout it was set on: a card
       dragged out round its picture kept that box as a plain entry, and
       the connectors with it (the owner's list of 7.11). So each layout
       keeps its own: the size of the one being left is put by
       (otherSize), and the one being taken up gets back whatever it was
       given last time — where dropping the size altogether made a card
       turned off and on again come back a different card (the owner's
       list of 8.11). A card that has never been sized starts at the size
       the entry was given, so a figure sized by hand does not shrink onto
       its words as it becomes a card (the same list); the words still
       grow it where they need more (minSize). An entry that has never
       been sized starts at the size its words ask for. */
    if(!!opts.card !== newCard){
      const leaving = opts.size;
      const coming = opts.otherSize || (newCard ? leaving : null);
      if(coming) opts.size = coming; else delete opts.size;
      if(leaving) opts.otherSize = leaving; else delete opts.otherSize;
    }
    if(newCard) opts.card = true; else delete opts.card;
    /* Both belong to a card that HAS a picture: they are answers about
       one, and kept with it while the card is off. */
    const cardImg = cardImageOptsFromForm();
    if(cardKept && newImage && cardImg.crop) opts.cardCrop = true; else delete opts.cardCrop;
    if(cardKept && newImage && cardImg.cut && !cardImg.crop) opts.cardCut = true; else delete opts.cardCut;
    /* The picture's own size is set on the picture, by dragging its
       corners, so this form carries whatever it already had rather than
       asking a control about it — and lets it go with the card or the
       picture it belonged to. */
    /* …and a NEW picture starts as a picture does, at the card's width:
       a size dragged out for the one before was kept, and the new one
       came in at the old one's size (the owner's list of 31.10). */
    if(!cardKept || !newImage || newImage !== hadImage){ delete opts.cardImgH; delete opts.cardImgW; }
    /* A card that lets its picture go is its words: the band the picture
       stood in goes with it, and a height set by hand loses that much,
       rather than keeping the picture's room as empty paper over the text
       (the owner's sketches of 26.11). Its width is still what was set. */
    const was = nodes.get(id);
    if(hadImage && !newImage && newCard && was && was.card && Array.isArray(opts.size) && opts.size.length === 2 &&
       was.cardTop > 0.5)
      opts.size = [opts.size[0], Math.max(NODE_MINH, Math.round(opts.size[1] - was.cardTop))];
    /* The card's middle line: its kind of medium and the facts of it.
       A line typed by hand is let go of the first time the card is
       edited — it is not drawn and has nowhere to be edited (the owner's
       list of 7.11, the morning after: "убирай"). */
    delete opts.medium;
    mediaTypeOptsFromForm(opts, cardKept);
    /* Only a portrait keeps a card, so the choice goes with the archetype
       rather than lingering on an entry that has no card at all. */
    if(newShape === 'ellipse' && editBioCardCheck && editBioCardCheck.checked)
      opts.bioCard = true;
    else delete opts.bioCard;
    const side = editBioSide.value;
    if(newShape === 'ellipse' && (side === 'left' || side === 'right')) opts.bioSide = side;
    else delete opts.bioSide;
    if(newMultiLang) opts.multiLang = true; else delete opts.multiLang;
    if(newMultiLang && newLangTabs.length) opts.langTabs = newLangTabs; else delete opts.langTabs;
    putEntry(found.index, entry, opts);
    /* Borders that have gone take their connectors with them — AFTER the
       entry itself has been written back, not before.
     *
     * `found.entry` is a copy taken at the top of this function. When one
     * of the doomed connectors POINTS AT the entry being edited, dropping
     * it rewrites that same entry's parents and writes it back — and the
     * line above then wrote this older copy over the top, restoring the
     * parent. The connector lost its style record and kept its
     * connection: it carried on being drawn, silently reattached to the
     * outermost border, which is exactly the confusion this exists to
     * prevent. */
    dropped = dropEdgesOnMissingRings(id, opts.colors ? opts.colors.length : 1);
  });
  if(dropped) setEditStatus('ok', dropped === 1
    ? 'One connector belonged to a border that is gone, and went with it.'
    : `${dropped} connectors belonged to borders that are gone, and went with them.`);
}

// Like applyEdit, but without its own undo push — the session already
// pushed one, so a run of small changes stays one step.
function commitEntry(mutate){
  mutate();
  rebuildChart();
  refreshSaveUI();
}

/* ---------------------------------------------------------------------
   Edge style popover — click any arrow on the chart to style just that
   one edge (routing + line pattern + arrowhead), live-previewed as you
   adjust it. Not a modal: a small card positioned near the click, no
   backdrop, closed by its ✕ or a click anywhere outside it. Overrides are
   stored in EDGE_STYLES, one entry per customized edge; picking the
   defaults back removes the entry instead of storing a redundant one.
   ------------------------------------------------------------------ */


/* Each setting is a strip of small buttons rather than a dropdown, so the
   whole popover fits in a column you can read at a glance. A group behaves
   exactly like a <select>: one value at a time, read with .value. */
function makeChoiceGroup(id, onChange){
  const root = document.getElementById(id);
  const buttons = Array.from(root.querySelectorAll('button'));
  const group = {
    root,
    get value(){
      const on = buttons.find(b=>b.classList.contains('on'));
      return on ? on.dataset.value : buttons[0].dataset.value;
    },
    set value(v){
      buttons.forEach(b=> b.classList.toggle('on', b.dataset.value === v));
      if(!buttons.some(b=>b.classList.contains('on'))) buttons[0].classList.add('on');
    }
  };
  buttons.forEach(b=> b.addEventListener('click', ev=>{
    ev.stopPropagation();
    group.value = b.dataset.value;
    if(onChange) onChange();
  }));
  return group;
}
// Path stays a real dropdown: its two options need words to tell apart,
// where the others read fine as symbols.
const styleRoutingSel = document.getElementById('styleRouting');
styleRoutingSel.addEventListener('change', ()=> applyLiveEdgeStyle());
styleRoutingSel.addEventListener('click', ev=> ev.stopPropagation());
/* The paint a connector's panel describes — 'default' (inherited),
   'solid' or 'gradient' — read and set as one value, as the strip of three
   buttons it used to be was. On the panel it is two controls: Fill says
   inherited or custom, and the switch beside the squares says whether the
   custom colour runs into a second. */
const styleFillSel = document.getElementById('styleFill');
const styleGradientBtn = document.getElementById('styleGradient');
const stylePaintMode = {
  get value(){
    if(styleFillSel.value !== 'custom') return 'default';
    return styleGradientBtn.classList.contains('on') ? 'gradient' : 'solid';
  },
  set value(v){
    styleFillSel.value = v === 'default' ? 'default' : 'custom';
    styleGradientBtn.classList.toggle('on', v === 'gradient');
  }
};
styleFillSel.addEventListener('change', ()=>{ syncColorRow(); applyLiveEdgeStyle(); });
styleFillSel.addEventListener('click', ev=> ev.stopPropagation());
styleGradientBtn.addEventListener('click', ev=>{
  ev.stopPropagation();
  if(styleGradientBtn.disabled) return;
  styleGradientBtn.classList.toggle('on');
  syncColorRow(); applyLiveEdgeStyle();
});
{
  const btn = document.getElementById('styleAddCallout');
  if(btn) btn.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(leaderPick){ endCalloutPick(); clearStyleStatus(); return; }
    beginCalloutPick();
  });
}
const styleColorInput = document.getElementById('styleColor');
const styleColor2Input = document.getElementById('styleColor2');
const styleColorRow = document.getElementById('styleColorRow');

// Shows only the fields the chosen paint mode actually uses.
function syncColorRow(){
  const mode = stylePaintMode.value;
  styleColorRow.hidden = mode === 'default';
  enableHexSquare(styleColor2Input, mode === 'gradient');
  readHex(styleColorInput); readHex(styleColor2Input);
  paintHexSquare(styleColorInput);
  paintHexSquare(styleColor2Input);
}

const edgeStyleLabelEl = document.getElementById('edgeStyleLabel');
const styleStatusEl = document.getElementById('styleStatus');
function setStyleStatus(kind, msg){ styleStatusEl.className = 'editor-status show ' + kind; styleStatusEl.textContent = msg; }
function clearStyleStatus(){ styleStatusEl.className = 'editor-status'; styleStatusEl.textContent = ''; }


function isDefaultEdgeStyle(style){
  return style.routing===DEFAULT_EDGE_STYLE.routing && style.dash===DEFAULT_EDGE_STYLE.dash &&
    style.arrow===DEFAULT_EDGE_STYLE.arrow && !style.arrowIn && !style.teeOut && !style.teeIn && !style.openOut && !style.openIn && !style.barEnd && !style.sinusoid &&
    !style.note && !style.color &&
    !style.gradient && !style.fromSide && !style.toSide && !style.fromRing && !style.toRing &&
    style.square !== false && !(style.bends && style.bends.length);
}
function setEdgeStyleOverride(from, to, style){
  const idx = EDGE_STYLES.findIndex(s=>s.from===from && s.to===to);
  if(isDefaultEdgeStyle(style)){
    if(idx>=0) EDGE_STYLES.splice(idx,1);
  } else if(idx>=0){
    EDGE_STYLES[idx] = {from,to,...style};
  } else {
    EDGE_STYLES.push({from,to,...style});
  }
}
// Positions the (already-visible) popover near the click that opened it,
// clamped so it never runs off the edge of the chart area.
function positionEdgePopover(evt){
  // edgePopover's nearest positioned ancestor is .main (not .app — .main is
  // itself position:relative), so its left/top are relative to .main.
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const rect = edgePopover.getBoundingClientRect();
  const margin = 10;
  let x = 16, y = 16;
  if(evt && typeof evt.clientX === 'number'){
    x = evt.clientX - host.left + 14;
    y = evt.clientY - host.top + 14;
  }
  x = Math.max(margin, Math.min(x, host.width - rect.width - margin));
  y = Math.max(margin, Math.min(y, host.height - rect.height - margin));
  edgePopover.style.left = x + 'px';
  edgePopover.style.top = y + 'px';
  keepClearOfEntryPanel(edgePopover);
}


