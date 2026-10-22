/* ---------------------------------------------------------------------
   The note editor in the detail drawer.

   It sits in the drawer rather than inside the entry form because a note
   is the thing you read when you click a node, and wanting to fix a word
   in it shouldn't mean opening a separate editing mode for the whole
   entry. It shows as plain italic text until you press the pencil, and
   Apply commits it and locks the field again.
   ------------------------------------------------------------------ */
const detailNoteInput = document.getElementById('detailNoteInput');
const detailNoteEditBtn = document.getElementById('detailNoteEdit');
const detailNoteToolbar = document.getElementById('detailNoteToolbar');
const detailNoteActions = document.getElementById('detailNoteActions');
const detailNoteSurface = richFields.get('detailNoteInput').surface;
let detailNoteEditing = false;

function setDetailNoteEditing(on){
  detailNoteEditing = on;
  detailNoteSurface.contentEditable = on ? 'true' : 'false';
  detailNoteSurface.classList.toggle('locked', !on);
  // makeRichField sets a min-height inline to match the textarea it stood
  // in for; inline styles outrank the .locked rule, so it has to be
  // cleared by hand or a one-line note would still reserve three rows.
  detailNoteSurface.style.minHeight = on ? '74px' : '';
  detailNoteToolbar.style.display = on ? '' : 'none';
  detailNoteActions.style.display = on ? '' : 'none';
  detailNoteEditBtn.classList.toggle('active', on);
  if(on) detailNoteSurface.focus();
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
 * the field is open is one step of undo. Apply now means "I have
 * finished"; Cancel means "put it back the way it was when I started",
 * which is a promise the field can only keep by remembering that. */
let detailNoteUndoPushed = false;
let detailNoteOriginal = '';
let detailNoteTimer = 0;
let detailNoteOwner = null;      // the entry the open editor belongs to
function commitDetailNote(){
  const id = detailNoteOwner;
  if(!id || readOnlyView) return;
  const n = nodes.get(id);
  if(!n) return;
  const text = detailNoteInput.value.trim();
  if((n.note || '') === text) return;
  if(!detailNoteUndoPushed){ pushUndo(); detailNoteUndoPushed = true; }
  commitEntry(()=>{
    const found = workingEntry(id);
    if(!found) return;
    found.entry[4] = text || undefined;
    putEntry(found.index, found.entry, entryOpts(found.entry));
  });
}
function queueDetailNoteCommit(){
  if(detailNoteTimer) clearTimeout(detailNoteTimer);
  detailNoteTimer = setTimeout(()=>{ detailNoteTimer = 0; commitDetailNote(); }, 480);
}
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
  const n = nodes.get(selectedId);
  detailNoteOwner = selectedId;
  detailNoteOriginal = n ? (n.note || '') : '';
  detailNoteUndoPushed = false;
  setDetailNoteEditing(true);
};
document.getElementById('detailNoteCancel').onclick = (ev)=>{
  ev.stopPropagation();
  const id = detailNoteOwner;
  if(detailNoteTimer){ clearTimeout(detailNoteTimer); detailNoteTimer = 0; }
  if(id){
    // Back to the words that were there when the pencil was pressed —
    // undoing whatever settled itself along the way.
    setRichValue(detailNoteInput, detailNoteOriginal);
    commitDetailNote();
  }
  const n = nodes.get(selectedId);
  showDetailNote(n ? (n.note || '') : '');
  detailNoteOwner = null;
};
document.getElementById('detailNoteApply').onclick = (ev)=>{
  ev.stopPropagation();
  flushDetailNoteCommit();
  setDetailNoteEditing(false);
  detailNoteOwner = null;
};

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
  const newImage = (newShape==='ellipse' || newShape==='image' || cardNow)
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
    /* …and if the words changed, the box goes back to the size they ask
       for — see commitNodeEditorText, which says why. Asked BEFORE the
       new label is written, or the answer is always no. */
    const labelChanged = (entry[1] !== newLabel);
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
    if(newImage) opts.image = newImage; else delete opts.image;
    if(newCard) opts.card = true; else delete opts.card;
    if(labelChanged) delete opts.size;
    /* Both belong to a card that HAS a picture: they are answers about
       one, and an entry that is no longer a card should not carry the
       answer back if it becomes one again with something else in it. */
    const cardImg = cardImageOptsFromForm();
    if(newCard && newImage && cardImg.crop) opts.cardCrop = true; else delete opts.cardCrop;
    /* The picture's own size is set on the picture, by dragging its
       corners, so this form carries whatever it already had rather than
       asking a control about it — and lets it go with the card or the
       picture it belonged to. */
    if(!newCard || !newImage) delete opts.cardImgH;
    /* The card's middle line. */
    {
      const med = (typeof editMediumInput !== 'undefined' && editMediumInput)
        ? editMediumInput.value.trim() : '';
      if(newCard && med) opts.medium = med; else delete opts.medium;
    }
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
  // The commit consumed the preview; arm a fresh one so the next keystroke
  // still draws itself on the entry.
  if(detailEditForm.style.display === 'block' && nodes.has(id)) beginLabelPreview(id);
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
/* A record that never had its line, its routing or its arrow set — a note
   started on a plain connector is one (startEdgeNote) — has the defaults,
   and is written with them: jsStr(undefined) is the string 'undefined',
   and an arrow left out came back as null, which draws none. A note added
   to a connector used to take its arrow away at the next opening. */
function serializeEdgeStyles(list){
  if(!list.length) return 'const EDGE_STYLES = [];';
  return 'const EDGE_STYLES = [\n' + list.map(s=>
    `  {from:${jsStr(s.from)}, to:${jsStr(s.to)}, routing:${jsStr(s.routing || DEFAULT_EDGE_STYLE.routing)}, dash:${jsStr(s.dash || DEFAULT_EDGE_STYLE.dash)}, arrow:${jsVal(s.arrow === undefined ? DEFAULT_EDGE_STYLE.arrow : s.arrow)}${s.arrowIn ? `, arrowIn:true` : ''}${s.teeOut ? `, teeOut:true` : ''}${s.teeIn ? `, teeIn:true` : ''}${s.sinusoid ? `, sinusoid:true` : ''}${s.note ? `, note:${jsStr(s.note)}` : ''}${s.note && s.notePos && s.notePos !== 'above' ? `, notePos:${jsStr(s.notePos)}` : ''}${s.note && typeof s.noteAt === 'number' && s.noteAt !== 0.5 ? `, noteAt:${+s.noteAt.toFixed(4)}` : ''}${s.note && validSnap(s.noteSnap) ? `, noteSnap:${jsStr(s.noteSnap)}` : ''}${s.noteBg ? `, noteBg:${jsStr(s.noteBg)}` : ''}${(s.bends && s.bends.length) ? `, bends:${jsVal(s.bends)}` : ''}${(s.bends && s.bends.length && s.bendSides) ? `, bendSides:${jsVal(s.bendSides)}` : ''}${s.color ? `, color:${jsStr(s.color)}` : ''}${s.color && s.colorFixed ? `, colorFixed:true` : ''}${s.gradient ? `, gradient:${jsVal(s.gradient)}` : ''}${s.fromSide ? `, fromSide:${jsStr(s.fromSide)}` : ''}${s.toSide ? `, toSide:${jsStr(s.toSide)}` : ''}${s.fromRing ? `, fromRing:${s.fromRing}` : ''}${s.toRing ? `, toRing:${s.toRing}` : ''}${s.square === false ? `, square:false` : s.square === true ? `, square:true` : ''}${s.note && s.noteFrame === false ? `, noteFrame:false` : ''}${s.note && s.noteSquare ? `, noteSquare:true` : ''}},`
  ).join('\n') + '\n];';
}

function serializeComments(list){
  if(!list.length) return 'const COMMENTS = [\n];';
  return 'const COMMENTS = [\n' + list.map(c=>
    `  {id:${jsStr(c.id)}, nick:${jsStr(c.nick)}, kind:${jsStr(c.kind)}, at:${jsStr(c.at)}, text:${jsStr(c.text)}${c.done ? ', done:true' : ''}},`
  ).join('\n') + '\n];';
}
function serializeSettings(o){
  /* What the legend's marks mean, where the chart's author has said. Left
     out entirely when nothing has been said, so a chart that never opened
     the legend writes exactly the line it always wrote. */
  const legend = cleanLegend(o.legend);
  const keys = Object.keys(legend);
  const legendPart = keys.length
    ? `, legend: {${keys.map(k=> `${jsStr(k)}: ${jsStr(legend[k])}`).join(', ')}}` : '';
  /* The rest of the legend's making: names, rows taken out and put in,
     and rows of the author's own — each written only when there is one. */
  const extra = cleanLegendRows(o);
  const tagColors = cleanTagColors(o.tagColors);
  if(Object.keys(tagColors).length) extra.tagColors = tagColors;
  const groundColors = cleanGroundColors(o.groundColors);
  if(Object.keys(groundColors).length) extra.groundColors = groundColors;
  /* The names are keyed by a mark's key, which has a colon in it, so the
     keys are written quoted, as the meanings' are. */
  const quoted = obj=> `{${Object.keys(obj).map(k=> `${jsStr(k)}: ${jsStr(obj[k])}`).join(', ')}}`;
  const extraPart = Object.keys(extra).map(k=> `, ${k}: ${k === 'legendNames' || k === 'tagColors' ? quoted(extra[k]) : jsVal(extra[k])}`).join('');
  // Which form the file's entries are written in: see DATA_FORMAT.
  return `const SETTINGS = {format: ${DATA_FORMAT}, refColor: ${jsStr(o.refColor || DEFAULT_REF_COLOR)}${legendPart}${extraPart}};`;
}
const LEGEND_KEY_RE = /^(shape|border|tag|line|mark):/;
function cleanTagColors(v){
  const out = {};
  if(!v || typeof v !== 'object' || Array.isArray(v)) return out;
  Object.keys(v).sort().forEach(k=>{ if(isHexColor(v[k]) && !tagIsSpecial(k) && k !== UNTAGGED) out[k] = v[k]; });
  return out;
}
function cleanLegendRows(o){
  const out = {};
  if(!o || typeof o !== 'object') return out;
  const names = {};
  if(o.legendNames && typeof o.legendNames === 'object' && !Array.isArray(o.legendNames)){
    Object.keys(o.legendNames).sort().forEach(k=>{
      if(LEGEND_KEY_RE.test(k) && typeof o.legendNames[k] === 'string' && o.legendNames[k]) names[k] = o.legendNames[k];
    });
  }
  if(Object.keys(names).length) out.legendNames = names;
  ['legendHidden', 'legendAdded'].forEach(k=>{
    const list = Array.isArray(o[k]) ? Array.from(new Set(o[k].filter(x=> typeof x === 'string' && LEGEND_KEY_RE.test(x)))) : [];
    if(list.length) out[k] = list;
  });
  const own = Array.isArray(o.legendOwn) ? o.legendOwn.filter(r=> r && typeof r.id === 'string' && /^own\d+$/.test(r.id))
    .map(r=> ({id: r.id, name: typeof r.name === 'string' ? r.name : '',
               meaning: typeof r.meaning === 'string' && r.meaning ? r.meaning : undefined,
               color: isHexColor(r.color) ? r.color : '#20242b'})) : [];
  if(own.length) out.legendOwn = own;
  return out;
}
/* Only strings, under names a legend row can have. Anything else in there
   came from a file edited by hand and would be written back verbatim. */
function cleanLegend(v){
  const out = {};
  if(!v || typeof v !== 'object' || Array.isArray(v)) return out;
  Object.keys(v).sort().forEach(k=>{
    if(typeof v[k] === 'string' && /^(shape|border|tag|line|mark):/.test(k)) out[k] = v[k];
  });
  return out;
}
function serializeRefs(list){
  if(!list.length) return 'const REFS = [\n];';
  return 'const REFS = [\n' + list.map(r=>
    `  {key:${jsStr(r.key)}, title:${jsStr(r.title||'')}${r.detail ? `, detail:${jsStr(r.detail)}` : ''}${r.url ? `, url:${jsStr(r.url)}` : ''}},`
  ).join('\n') + '\n];';
}
function serializeTagCats(list){
  if(!list.length) return 'const TAG_CATS = [\n];';
  return 'const TAG_CATS = [\n' + list.map(c=>
    `  {name:${jsStr(c.name)}, tags:[${(c.tags||[]).map(jsStr).join(', ')}]},`
  ).join('\n') + '\n];';
}
/* An embedded figure, written the way a sticker is: one line per item,
   the source last because it is the long part. */
function serializeMedia(list){
  if(!list.length) return 'const MEDIA = [\n];';
  return 'const MEDIA = [\n' + list.map(m=>
    `  {key:${jsStr(m.key)}, name:${jsStr(m.name || m.key)}, kind:${jsStr(m.kind || 'image')}, src:${jsStr(m.src)}},`
  ).join('\n') + '\n];';
}
function serializeStickers(list){
  if(!list.length) return 'const STICKERS = [\n];';
  return 'const STICKERS = [\n' + list.map(s=>
    `  {key:${jsStr(s.key)}, name:${jsStr(s.name || s.key)}, src:${jsStr(s.src)}},`
  ).join('\n') + '\n];';
}

const edgePopover = document.getElementById('edgePopover');

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

// Colours are typed as hex rather than picked from a swatch, so an exact
// value can be pasted in and read back out. HEX_RE is in 01-store.js.
function readHex(input){
  const v = input.value.trim();
  const ok = HEX_RE.test(v);
  input.classList.toggle('bad', v !== '' && !ok);
  return ok ? v : null;
}
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

let currentEdgeStyleTarget = null;   // {from,to} of the edge the popover is open for

function isDefaultEdgeStyle(style){
  return style.routing===DEFAULT_EDGE_STYLE.routing && style.dash===DEFAULT_EDGE_STYLE.dash &&
    style.arrow===DEFAULT_EDGE_STYLE.arrow && !style.arrowIn && !style.teeOut && !style.teeIn && !style.sinusoid &&
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
  const host = document.querySelector('.main').getBoundingClientRect();
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
}


