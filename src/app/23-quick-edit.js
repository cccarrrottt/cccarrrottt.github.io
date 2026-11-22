
/* ---------------------------------------------------------------------
   Per-node quick edit — click the ✎ in the detail drawer to edit that
   entry's label/note/link/border colors/tags/font in place, without
   opening the full raw-text editor. Saves straight to the live page by
   re-parsing the live NODES region, patching just this one item, and
   publishing.
   ------------------------------------------------------------------ */
const detailEditToggle = document.getElementById('detailEditToggle');
/* The note belongs to the entry's own panel, not to its settings.
 *
 * It used to sit below the settings form and stay on screen while that form
 * was open, which put a second, differently-shaped editor — its own toolbar,
 * its own Apply button — inside a form where every other control commits by
 * itself. Two editing idioms in one panel, and the note visually captured by
 * a form it was never part of. It is hidden while settings are open and
 * comes back when they close; nothing about the note itself changed. */
const detailNoteBlock = document.getElementById('detailNoteBlock');
function showNoteBlock(on){ if(detailNoteBlock) detailNoteBlock.style.display = on ? '' : 'none'; }
const editLinkInput = document.getElementById('editLinkInput');
const editColorsInput = document.getElementById('editColorsInput');
/* Back to the default outline. Emptying the field by hand did this
   already, but only if you knew that an empty field meant "the default"
   rather than "no border at all" — and the field refills itself with the
   resolved hex the moment it commits, so the emptying looked as though it
   had not taken. One button that says what it does. */
{
  const reset = document.getElementById('editColorsReset');
  /* An entry with no colours of its own has nothing to put back, so the
     button is a control that cannot act rather than one that pretends to.
     Pressed anyway it wrote the same absence again — an edit that changed
     nothing, marked the chart unsaved and cost a step of undo to discover
     that it had done so. */
  function syncColorsResetState(){
    if(!reset) return;
    /* …and that includes an entry whose box is only showing the colour
       it is drawn in: the field refills itself with that a moment after
       it is emptied, and the button lit up again as though the reset had
       not happened. */
    const v = editColorsInput.value.trim().toLowerCase();
    const n = selectedId && nodes.get(selectedId);
    const inherited = n && !(n.ownColors && n.ownColors.length) &&
                      v === drawnColorText(n).toLowerCase();
    reset.disabled = !v || !!inherited;
    reset.title = reset.disabled
      ? 'These borders are already the default'
      : 'Back to the default outline';
  }
  if(reset){
    reset.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(reset.disabled || !editColorsInput.value.trim()) return;
      editColorsInput.value = '';
      editColorsInput.dispatchEvent(new Event('input', {bubbles:true}));
      if(typeof paintEditSwatches === 'function') paintEditSwatches();
      flushNodeEditCommit();
      syncColorsResetState();
    });
    editColorsInput.addEventListener('input', syncColorsResetState);
    window.syncColorsResetState = syncColorsResetState;
  }
}
const editShapeInput = document.getElementById('editShapeInput');
const editBgInput = document.getElementById('editBgInput');
// Which side a portrait's card hangs on — see bioSideOf.
const editBioSide = makeChoiceGroup('editBioSide', ()=>{ queueNodeEditCommit(0); });
/* The border style and the corners are not here: they are on the bar that
   appears over an entry as the pointer reaches it — see 37-style-bar.js. */
const editTagsInput = document.getElementById('editTagsInput');
/* An entry's own face and size were four hidden controls: a pair in the
   Label box's toolbar and a pair mirroring them in the language rows'. None
   of the four was ever shown, so none was ever reachable — the drawer read
   its own unreachable values back on every commit, which is how `n.font`
   survived at all. The values still survive, and now by saying so: see
   commitNodeEdit, which carries the entry's face and size through
   untouched instead of asking a control that cannot be used. */
const editCardCheck = document.getElementById('editCardCheck');
const editCardField = document.getElementById('editCardField');
/* What a card's picture may be told from this panel: whether to fill its
   band or be fitted whole into it. Its SIZE is not asked here any more —
   a slider for a height is a poor way to say something the picture itself
   can be shown saying: double-click it and drag its corners. */
const editCardCropCheck = document.getElementById('editCardCropCheck');
/* …and whether the band round a picture smaller than it is filled, or
   cut away with the frame going round the picture (the owner's list of
   2.11, with a sketch: a tall picture standing on a wider card). */
const editCardCutCheck = document.getElementById('editCardCutCheck');
const editMediumField = document.getElementById('editMediumField');
function fillCardImageOpts(n){
  if(editCardCropCheck) editCardCropCheck.checked = !!(n && n.cardCrop);
  if(editCardCutCheck) editCardCutCheck.checked = !!(n && n.cardCut);
}
function cardImageOptsFromForm(){
  return { crop: !!(editCardCropCheck && editCardCropCheck.checked),
           cut: !!(editCardCutCheck && editCardCutCheck.checked) };
}
function syncMediumFieldVisibility(){
  if(!editMediumField) return;
  const isCardNow = typeof editCardCheck !== 'undefined' && editCardCheck.checked
    && CARD_CAPABLE.has((editShapeInput && editShapeInput.value) || 'rect');
  editMediumField.style.display = isCardNow ? '' : 'none';
}
/* The two answer one question — what becomes of the band a picture does
   not fill — and only one answer can stand: cropping makes the picture
   fill its band, so there is nothing left round it for the frame to be
   cut back from (the owner's list of 2.11, evening). Turning one on turns
   the other off; the model refuses both at once as well (cardCut). */
function exclusiveCardToggle(on, off){
  on.addEventListener('change', ()=>{
    if(on.checked && off && off.checked) off.checked = false;
    queueNodeEditCommit(0);
  });
}
if(editCardCropCheck) exclusiveCardToggle(editCardCropCheck, editCardCutCheck);
if(editCardCutCheck) exclusiveCardToggle(editCardCutCheck, editCardCropCheck);
/* Card layout only means something for an entry that IS a box. A character
   bio is a portrait circle and the free-standing elements are a bare
   picture and a bare line of text — none of them has anything to divide
   into bands, so the switch is taken away rather than left there to do
   nothing. */
const CARD_CAPABLE = new Set(['rect']);
/* Whether the entry was on card layout when the form was opened, kept
   apart from the checkbox.
 *
 * Some archetypes cannot carry a card, so the field is taken away for
 * them — and clearing the checkbox while it was hidden turned a passing
 * look at another archetype into a decision: choose ellipse, change your
 * mind, choose rect again, and the card layout was gone with nothing on
 * screen to say so. The choice is only lost when the entry is actually
 * left on an archetype that cannot hold it. */
let cardWanted = false;
function syncCardFieldVisibility(){
  const shape = editShapeInput.value || 'rect';
  const ok = CARD_CAPABLE.has(shape);
  editCardField.style.display = ok ? '' : 'none';
  editCardCheck.checked = ok && cardWanted;
}
function setTextColorControls(target, on){
  document.querySelectorAll(`[data-hex-for="${target}"], [data-hex-square-for="${target}"], [data-hex-reset="${target}"]`)
    .forEach(elm=>{ elm.hidden = !on; });
}
function syncTextColorVisibility(){
  /* A merge's entry, in its lineages' colours, paints its own text and
     offers no say in it: it wears the gradient of the lineages that merged
     into it, and a hand-set colour there is a second, contradictory answer
     to a question the merge has already settled. Given a border colour of
     its own it is an ordinary entry again, words and all.
   *
     A mirror reality used to be the other case, since its fill was its
     border and its ink was picked for contrast against that. It is not an
     archetype any more, and a background is now something any entry may
     have — so the colour control stays and readableOn steps in only where
     the ink would actually be lost. */
  const shape = editShapeInput.value || 'rect';
  const n = selectedId ? nodes.get(selectedId) : null;
  const on = !(n && mergePainted(n) && mergeShapeOk(shape));
  /* The in-node field is on this list now that it is the only place an
     entry's words are typed — a merge offers no say in its ink there
     either. The language rows' own toolbar used to be on it as well, and
     went with the toolbar. */
  ['nodeEditorText', 'detailNoteInput'].forEach(t=> setTextColorControls(t, on));
}
/* Every entry has a border colour to set. An amalgam had none — it wore
   its lineages' colours — and a merge's entry still does until it is given
   one, which is the one thing the owner asked to change when the merge
   stopped being a kind of entry (23.10). */
function syncColorFieldVisibility(){
  const field = document.getElementById('editColorsField');
  if(field) field.hidden = false;
  /* A link node's link is where it goes, and says so — an entry of this
     chart, by a copied link or its id, rather than a page elsewhere. Asked
     here because this is what every change of the entry's kind asks. */
  const link = document.getElementById('editLinkInput');
  const shape = document.getElementById('editShapeInput');
  if(link && shape){
    const goes = shape.value === 'link';
    const label = document.querySelector('label[for="editLinkInput"]');
    if(label) label.textContent = goes ? 'Goes to' : 'Link URL';
    link.placeholder = goes ? 'A link to an entry, or its id' : 'https://…';
  }
}
const editMultiLangCheck = document.getElementById('editMultiLangCheck');
const editLangTabsField = document.getElementById('editLangTabsField');
const editLangTabList = document.getElementById('editLangTabList');
document.getElementById('editLangTabAdd').onclick = (ev)=>{
  ev.stopPropagation();
  const chip = makeLangTabRow(editLangTabList, null);
  const field = chip.querySelector('.lang-tab-name');
  if(field) field.focus();
};
const detailEditStatusEl = document.getElementById('detailEditStatus');
editMultiLangCheck.addEventListener('change', ()=>{
  editLangTabsField.style.display = editMultiLangCheck.checked ? '' : 'none';
});

// Shared by the detail-edit form and the Add Node form — both offer the
// same curated font list.
function populateFontOptions(selectEl){
  selectEl.innerHTML = '';
  fontOptions().forEach(f=>{
    const opt = document.createElement('option');
    opt.value = f.key; opt.textContent = f.label;
    selectEl.appendChild(opt);
  });
}

function parseTagsField(raw){
  return raw.trim() ? raw.split(',').map(s=>s.trim()).filter(Boolean) : [];
}
/* ---------------------------------------------------------------------
   Language-tab chips.

   The same field as Tags, drawn the same way: one chip per tab, an × on
   each to take it out, and a + to add one. A chip carries the tab's NAME,
   which is short and is the only thing about a tab that has to be typed
   in a form; the tab's words are written on the entry itself, with that
   tab chosen, where they can be seen in the face and size they will be
   read in.

   The words are not lost while the chip is being renamed: each chip
   carries the text it belongs to, so rewriting "EN" to "ENG" renames the
   tab and nothing else. A tab with no words yet is still a tab — that is
   how one is started.
   ------------------------------------------------------------------ */
function langTabChipsHost(){ return editLangTabList; }
function makeLangTabRow(list, tab){
  const chip = document.createElement('span');
  chip.className = 'tag-chip lang-tab-chip';
  chip.dataset.text = (tab && tab.text) || '';

  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'lang-tab-name';
  name.placeholder = 'EN';
  name.maxLength = 8;
  name.value = (tab && tab.tag) || '';
  name.size = 3;

  /* Typing a tab shows on the entry as it is typed, exactly as typing the
     label does. The debounced commit still does the real write (and owns
     the undo step); this only paints the live entry so the chips on the
     box and the switched text keep up with the form. */
  const preview = ()=>{
    const n = selectedId && nodes.get(selectedId);
    if(!n) return;
    const tabs = collectLangTabs(list);
    n.langTabs = tabs.length ? tabs : null;
    n.multiLang = true;
    // A tab that has just lost its name stops existing, so an index
    // pointing past the end has to come back to the default.
    const active = activeLangTab.get(n.id);
    if(active != null && (!n.langTabs || active >= n.langTabs.length)) activeLangTab.set(n.id, null);
    /* renderNodes builds every entry afresh, and what is hidden or stepped
       back is a class put on afterwards — so a redraw with nothing following
       it brings the whole chart back. */
    renderNodes();
    applyVisibility();
    if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
    paintMultiSelection();
  };
  name.addEventListener('input', ()=>{
    preview();
    queueNodeEditCommit();
  });
  /* A country's code becomes its flag once the name is finished — on
     leaving the field, not on every key, so that "DE" can still go on to
     be "DEU", or "EN" to be "ENG", without turning into a flag half-way. */
  name.addEventListener('change', ()=>{
    const flag = flagForCode(name.value);
    if(!flag || flag === name.value) return;
    name.value = flag;
    name.dispatchEvent(new Event('input'));
  });
  // A chip is as wide as the name in it, like every other chip in this row.
  name.addEventListener('input', ()=>{ name.size = Math.max(2, name.value.length + 1); });
  name.size = Math.max(2, name.value.length + 1);

  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = '\u00d7';
  del.title = 'Remove this tab';
  del.addEventListener('click', ev=>{
    ev.stopPropagation();
    chip.remove();
    preview();
    queueNodeEditCommit(0);
  });

  chip.appendChild(name);
  chip.appendChild(del);
  list.appendChild(chip);
  return chip;
}
function fillLangTabs(list, tabs){
  list.innerHTML = '';
  (tabs || []).forEach(t=> makeLangTabRow(list, t));
}
/* A chip with no name is not a tab yet, so it is passed over rather than
   reported as an error — an empty chip is how a new one starts, and it
   stays on the form until it is named or taken out. A tab with a name and
   no words IS a tab: that is exactly the state a new one is in, and
   dropping it would mean there was no tab to switch to on the entry and
   therefore nowhere to write the words. */
function collectLangTabs(list){
  const out = [];
  list.querySelectorAll('.lang-tab-chip').forEach(chip=>{
    const tag = chip.querySelector('.lang-tab-name').value.trim();
    if(tag) out.push({tag, text: chip.dataset.text || ''});
  });
  return out;
}
/* The entry is what the words are typed into, so what it holds is what the
   chips have to carry back. Called before the form is read, so a rename
   made after a word was typed on the box does not put the old words back. */
function syncLangTabTexts(n){
  const host = langTabChipsHost();
  if(!host || !n || !Array.isArray(n.langTabs)) return;
  const chips = [...host.querySelectorAll('.lang-tab-chip')];
  let i = 0;
  chips.forEach(chip=>{
    if(!chip.querySelector('.lang-tab-name').value.trim()) return;
    const tab = n.langTabs[i++];
    if(tab && typeof tab.text === 'string') chip.dataset.text = tab.text;
  });
}

/* Languages switched on with every tab taken away is the switch saying
   something the entry no longer has. Left on, the settings opened again on
   an empty list under a switch that claimed otherwise, and the entry kept
   a flag nothing drew. So the switch goes off as the settings are left —
   not while they are open, where taking the last tab away on the way to
   adding another is an ordinary step. Asked of the entry the form was
   opened on, by its id: the selection may already have moved on by the
   time the form closes. */
function offWhenNoTabsLeft(){
  const id = detailEditForm.dataset.entry;
  delete detailEditForm.dataset.entry;
  if(detailEditForm.style.display !== 'block' || readOnlyView) return null;
  if(!editMultiLangCheck.checked || collectLangTabs(editLangTabList).length) return null;
  /* Off on the form first, so a commit still waiting writes it in the same
     step as the tab that was taken away; and written here if none was. */
  editMultiLangCheck.checked = false;
  editLangTabsField.style.display = 'none';
  return id || null;
}
function writeLanguagesOff(id){
  const found = workingEntry(id);
  if(!found) return;
  const opts = entryOpts(found.entry);
  if(!opts.multiLang && !opts.langTabs) return;
  applyEdit(()=>{
    delete opts.multiLang;
    delete opts.langTabs;
    putEntry(found.index, found.entry, opts);
  });
}
function setEditStatus(kind, msg){ detailEditStatusEl.className = 'editor-status show ' + kind; detailEditStatusEl.textContent = msg; }
function clearEditStatus(){ detailEditStatusEl.className = 'editor-status'; detailEditStatusEl.textContent = ''; }
function closeEditForm(){
  // A change still sitting in the typing pause is a change the user made;
  // closing settles it rather than throwing it away.
  const emptied = offWhenNoTabsLeft();
  flushNodeEditCommit();
  if(emptied) writeLanguagesOff(emptied);
  endLabelPreview(false);
  detailEditForm.style.display = 'none';
  detailEditToggle.classList.remove('active');
  showNoteBlock(true);
  clearEditStatus();
  syncTagLiveliness();
}

detailEditToggle.onclick = (ev)=>{
  ev.stopPropagation();
  if(!selectedId) return;
  const n = nodes.get(selectedId);
  if(!n) return;
  const opening = detailEditForm.style.display === 'none' || !detailEditForm.style.display;
  if(opening){
    editLinkInput.value = n.link || '';
    /* The field shows the colour the entry actually HAS. It used to be
       left blank to mean "the default", which asked the reader to know
       what the default was and gave them nothing to edit — the commonest
       thing you want to do here is nudge the current colour, and you
       cannot nudge a blank. */
    editColorsInput.value = drawnColorText(n);
    if(paintEditSwatches) paintEditSwatches();
    /* Empty means "on the paper", which is a real answer rather than a
       missing one — so unlike the border field this one is left blank when
       the entry has no background of its own. */
    editBgInput.value = (n.bg && n.bg.length) ? n.bg.join(', ') : '';
    if(paintEditBgSwatches) paintEditBgSwatches();
    if(typeof window.syncBgResetState === 'function') window.syncBgResetState();
    editShapeInput.value = n.shape || 'rect';
    editImageInput.value = n.image || '';
    if(editBioCardCheck) editBioCardCheck.checked = !!n.bioCard;
    editBioSide.value = bioSideOf(n);
    syncBioCardField(editShapeInput);
    syncLabelFieldForShape(editShapeInput);
    editTagsInput.value = (n.tags && n.tags.length) ? n.tags.join(', ') : '';
    if(repaintEditTags) repaintEditTags();
    editCardCheck.checked = !!n.card;
    cardWanted = !!n.card;
    /* AFTER the card switch has been set from the entry, not before. The
       picture field is offered to a portrait, to a picture element and to
       a card — and asking which of those this is, while the card switch
       still held the last entry's answer, meant opening a card's settings
       showed no picture field at all. */
    fillCardImageOpts(n);
    fillMediaTypeForm(n);
    syncMediumFieldVisibility();
    syncImageFieldVisibility(editShapeInput, editImageField);
    if(typeof window.syncColorsResetState === 'function') window.syncColorsResetState();
    syncCardFieldVisibility();
    syncTextColorVisibility();
    syncColorFieldVisibility();
    editMultiLangCheck.checked = !!n.multiLang;
    fillLangTabs(editLangTabList, n.langTabs);
    editLangTabsField.style.display = n.multiLang ? '' : 'none';
    detailEditForm.style.display = 'block';
    detailEditForm.dataset.entry = n.id;
    detailEditToggle.classList.add('active');
    showNoteBlock(false);
    clearEditStatus();
    beginNodeEditSession();
  } else {
    closeEditForm();
  }
  // Opening an entry's settings is looking at that entry — see
  // syncTagLiveliness — so its decorations perform for as long as they stay
  // open, without the reader having to keep the pointer on the box.
  syncTagLiveliness();
};

/* Every control in the entry editor commits by itself. Typed fields wait
   out a short pause so a word is one edit; the ones you pick rather than
   type settle immediately, because there is no half-finished state to wait
   for. */
// Reached by id rather than through the module consts: several of those
// are declared further down the file than this block runs.
['editLinkInput','editColorsInput','editBgInput','editTagsInput',
 'editImageInput'].forEach(id=>{
  const field = document.getElementById(id);
  if(!field) return;
  field.addEventListener('input', ()=> queueNodeEditCommit());
  field.addEventListener('blur', ()=> flushNodeEditCommit());
});
['editShapeInput','editMultiLangCheck','editCardCheck','editBioCardCheck'].forEach(id=>{
  const field = document.getElementById(id);
  if(!field) return;
  field.addEventListener('change', ()=>{
    // Turning card layout on reveals the picture field it needs — and is
    // the only thing that changes what the reader asked for.
    if(id === 'editCardCheck'){
      cardWanted = editCardCheck.checked;
      syncImageFieldVisibility(editShapeInput, editImageField);
      syncMediumFieldVisibility();
    }
    queueNodeEditCommit(0);
  });
});


/* ---------------------------------------------------------------------
   Live label preview.

   While the label field is open, what you type is drawn straight onto the
   entry itself — including the way the box grows and re-wraps around a
   longer name — so you are editing the chart rather than editing a form
   about the chart. It touches only the rendered model, never the saved
   data; the commit that follows a moment later is what makes it real, and
   the whole session is a single step of undo.
   ------------------------------------------------------------------ */
let labelPreview = null;      // {id, original} while a preview is running
let labelPreviewFrame = 0;

/* Which text the live preview is painting.
 *
 * An entry showing a language tab is showing that tab's words, not its
 * label, so a field opened on it is editing the tab — and the preview has
 * to put the typing back into the same place the field took it from, or
 * what appears under the caret is the label with somebody else's words in
 * it. `tab` is the index into langTabs, or null for the entry's own label. */
function beginLabelPreview(id, input, tab){
  const n = nodes.get(id);
  if(!n) return;
  /* The field is always named now. It used to default to the drawer's
     Label box, which was the only other place an entry's words could be
     typed; there is one place, and the caller knows which field it is. */
  const field = input;
  if(!field) return;
  const k = (tab === undefined || tab === null) ? null : tab;
  if(labelPreview && labelPreview.id === id && labelPreview.input === field &&
     labelPreview.tab === k) return;
  endLabelPreview(false);
  const original = (k !== null && n.langTabs && n.langTabs[k])
    ? (n.langTabs[k].text || '') : n.label;
  labelPreview = { id, original, input: field, tab: k };
}
function renderLabelPreview(){
  if(!labelPreview) return;
  const n = nodes.get(labelPreview.id);
  if(!n) return;
  const k = labelPreview.tab;
  /* A line just opened at the end, with nothing on it yet, is not in the
     field's value — a text does not end in a break — so the entry did not
     grow for it, and the field that sits over the entry did not either:
     the caret went down into nothing until a letter was typed (the
     owner's list of 2.11). The preview holds the line open. */
  const open = typeof openLinesAtEnd === 'function' ? openLinesAtEnd(labelPreview.input) : 0;
  const shown = labelPreview.input.value + (open ? '\n'.repeat(open) + '\u200b' : '');
  if(k !== null && k !== undefined && n.langTabs && n.langTabs[k]){
    n.langTabs[k].text = shown;
  } else {
    n.label = shown;
  }
  renderNodes();
  redrawEdges();
  applyVisibility();
  // Every entry has just been drawn afresh, so the highlight has to be put
  // back — otherwise the chart lights up whole on every keystroke.
  if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
  paintMultiSelection();
  drawBioCard();
  const g = qNode(`.node[data-id="${cssEscape(labelPreview.id)}"]`);
  if(g){ g.classList.add('selected'); nodeControlsOn(labelPreview.id); }
  // The entry has just changed shape under the field, so the field follows.
  if(typeof nodeEditorTarget !== 'undefined' && nodeEditorTarget) positionNodeEditor();
}
function queueLabelPreview(){
  if(!labelPreview) return;
  if(labelPreviewFrame) cancelAnimationFrame(labelPreviewFrame);
  labelPreviewFrame = requestAnimationFrame(()=>{ labelPreviewFrame = 0; renderLabelPreview(); });
}
// commit=false rolls the drawing back to the text the entry had before the
// form was opened; commit=true just drops the preview, because the real
// edit is about to redraw everything anyway.
function endLabelPreview(commit){
  if(!labelPreview) return;
  const prev = labelPreview;
  labelPreview = null;
  if(labelPreviewFrame){ cancelAnimationFrame(labelPreviewFrame); labelPreviewFrame = 0; }
  if(commit) return;
  const n = nodes.get(prev.id);
  // Put back into the text the preview was painting: a tab's, or the label.
  const tab = prev.tab !== null && prev.tab !== undefined && n && n.langTabs ? n.langTabs[prev.tab] : null;
  if(tab && tab.text !== prev.original){
    tab.text = prev.original;
    renderNodes(); redrawEdges(); applyVisibility(); paintMultiSelection();
    drawBioCard();
  } else if(!tab && n && n.label !== prev.original){
    n.label = prev.original;
    renderNodes(); redrawEdges(); applyVisibility(); paintMultiSelection();
    drawBioCard();
  }
}

/* Select the entry and open its settings — the whole path a double click
   on something whose words are NOT on it is asking for, in one call.
 *
 * It used to put the cursor in the drawer's Label box as well, and was
 * named for that. The box is gone and the words are typed on the entry
 * itself, so what is left is the half that was always the point: pick the
 * entry out and show everything about it that is not its text. */
function openEntrySettings(id){
  /* A link node has no drawer: everything it is is on its bar (the
     owner's list of 28.10), wherever it is asked to be opened from. */
  if(isLinkNode(nodes.get(id))){
    if(selectedId !== id){ selectNode(id); paintMultiSelection(); }
    askWhereLinkGoes(id);
    return;
  }
  if(selectedId !== id){ selectNode(id); paintMultiSelection(); }
  if(detailEditForm.style.display === 'none' || !detailEditForm.style.display){
    detailEditToggle.onclick({stopPropagation(){}});
  }
}

