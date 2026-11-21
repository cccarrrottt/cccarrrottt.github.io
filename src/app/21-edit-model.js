/* ---------------------------------------------------------------------
   Editing model: local edits, one explicit Save.

   Why this shape rather than continuous autosave: saving here means
   publishing a new version of this very page, and the host then reloads
   the view. That reload is inherent to publishing — it is not something a
   nicer implementation could hide. So Google-Docs-style "save silently as
   you type" would mean reloading the page every few seconds, which is
   strictly worse than saving by hand. Batching instead gives the best of
   both: every edit is instant and local with no reload at all, and the
   single unavoidable reload happens once, when you ask for it.

   Everything on screen is therefore built from workingNodes + EDGE_STYLES
   in memory. An edit mutates those, rebuilds the view, and marks the page
   dirty. Save is the only thing that touches the published document.
   ------------------------------------------------------------------ */
const saveBtn = document.getElementById('saveBtn');

// Undo is now a plain in-memory stack of snapshots — there is no reload to
// survive any more, so it needs no persistence and can be far deeper.
const LOCAL_UNDO_LIMIT = 60;
const undoStack = [];
/* Redo holds the changes undo has walked back past. It is filled only by
   undo and emptied by any fresh edit, which is the rule people already
   expect: step back, step forward again, but the moment you change
   something new the forward branch is gone. */
const redoStack = [];
let savedParts = null;

/* The saved state, kept as one entry per region rather than one blob.
 *
 * "Is this chart dirty?" is asked after every single edit — every keystroke
 * in a text field included — and it used to be answered by serializing the
 * whole chart into one string and comparing it. That is exact, and it stays
 * exact through an undo back to the saved state, which a mutation flag never
 * would; the derived answer is the right design and is kept.
 *
 * What it cost was hidden in the stickers. A sticker is a base64 data URI, so
 * a modest library of forty small images serializes to about a megabyte —
 * measured at 1.24 ms of the 1.39 ms each check took, and a megabyte of
 * garbage per keystroke — to re-confirm bytes that had not changed since the
 * page loaded.
 *
 * Two changes, each exact, neither a heuristic. Comparison goes region by
 * region and stops at the first difference, so an edit to an entry settles
 * the question in 0.02 ms without looking further. And the two regions that
 * hold the bytes are snapshotted by structure instead of by text, so they
 * are compared by reference and stored once rather than once per undo step;
 * that part is explained where it is implemented, below the list.
 *
 * The alternative to both — an epoch counter bumped wherever STICKERS is
 * written — would be faster still and would quietly start lying the day
 * someone adds a write site and forgets to bump it. Nothing here has an
 * invariant a future edit can break. */
/* EVERY region the save writes, and nothing else.
 *
 * This list and writeChart's must agree, and for three regions they did
 * not: references, tag categories and the chart's own settings were saved
 * but never snapshotted. Nothing that touched them counted as a change, so
 * the Save button stayed greyed out reading "Saved", Ctrl+S returned
 * without doing anything, the beforeunload guard stayed quiet, and the
 * work was gone on the next reload. Undo had the mirror of the same hole:
 * deleting a cited reference strips its marks from the labels, and undoing
 * put the marks back while leaving the reference deleted.
 *
 * One list, used by the snapshot, the comparison and the restore, so the
 * three cannot drift apart again. */
const SAVED_REGIONS = [
  {k:'n', get: ()=> workingNodes,  set: v=>{ workingNodes = v; }},
  {k:'e', get: ()=> EDGE_STYLES,   set: v=> refill(EDGE_STYLES, v)},
  {k:'c', get: ()=> COMMENTS,      set: v=> refill(COMMENTS, v)},
  {k:'t', get: ()=> TAG_CATS,      set: v=> refill(TAG_CATS, v)},
  {k:'r', get: ()=> REFS,          set: v=> refill(REFS, v)},
  {k:'g', get: ()=> SETTINGS,      set: v=>{ Object.keys(SETTINGS).forEach(x=> delete SETTINGS[x]);
                                             Object.assign(SETTINGS, v); }},
  {k:'s', get: ()=> STICKERS, set: v=>{ refill(STICKERS, v); rebuildStickerMap(); }},
  {k:'m', get: ()=> MEDIA,    set: v=>{ refill(MEDIA, v); rebuildMediaMap(); }}
];

/* -------------------------------------------------------------------------
   Snapshotting, when some of what is in there is base64.

   takeSnapshot runs on EVERY edit and isDirty on every keystroke, and both
   used to serialize whatever they were given. That is exact and, for text,
   free. For the things this chart embeds it was neither: a sticker library
   is about a megabyte of base64, an embedded clip is larger still, and a
   portrait hangs off an entry.

   Two of those three were dealt with by snapshotting stickers and media as
   flat records, so the base64 was held by REFERENCE and compared with ===.
   It worked, and it left the third alone. Entries kept going through
   JSON.stringify whole, portraits and all — measured on a synthetic chart:

       60 entries, no portraits    isDirty 0.01 ms    undo stack  0.2 MB
       60 entries with portraits   isDirty 2.05 ms    undo stack 62.1 MB

   a megabyte of garbage per keystroke, and sixty copies of the same
   pictures, which is precisely the fault the flat-record snapshot was
   written to cure. It was cured for two REGIONS when what it is about is
   the CONTENT: bytes are heavy wherever they sit, and an entry is not a
   flat record, so the old mechanism could not have been pointed at it.

   So there is one mechanism now and it asks about content. A region is
   serialized with every long string lifted out and replaced by its index,
   and the strings are kept beside the text. What that buys is what the flat
   record bought, for anything of any shape: the base64 is stored once and
   compared by identity, and the text that remains is small enough that
   comparing it is free.

   Nothing here assumes a shape, so nothing falls back to a slower form it
   might have got wrong, and there is no counter for a future write site to
   forget. A restore parses fresh objects every time, so the history cannot
   be rewritten by a later edit reaching into it — the reason the flat form
   copied its records on the way out.
   ------------------------------------------------------------------------- */
/* Long enough that it is a payload rather than prose. An entry's label, a
   note, a reference title are all far below it; a 240px portrait is about
   eighteen thousand characters. */
const HEAVY_STRING = 512;
/* A marker no text can be. It opens with a NUL, which cannot be typed, and
   the value it stands in for is looked up by index — so a string that
   somehow read like one would still have to name a slot that exists. */
const BLOB_MARK = '\u0000blob:';
function snapRegion(value){
  const blobs = [];
  const json = JSON.stringify(value, (k, v)=>{
    if(typeof v === 'string' && v.length >= HEAVY_STRING){
      blobs.push(v);
      return BLOB_MARK + (blobs.length - 1);
    }
    return v;
  });
  return {json, blobs};
}
function regionDiffers(value, snap){
  if(!snap) return true;
  const now = snapRegion(value);
  if(now.json !== snap.json) return true;
  if(now.blobs.length !== snap.blobs.length) return true;
  // By identity: an unchanged portrait is the very same string object in
  // the live chart and in the snapshot, so this reads no bytes at all.
  for(let i = 0; i < now.blobs.length; i++){
    if(now.blobs[i] !== snap.blobs[i]) return true;
  }
  return false;
}
function regionValue(snap){
  if(!snap) return [];
  return JSON.parse(snap.json, (k, v)=>{
    if(typeof v === 'string' && v.indexOf(BLOB_MARK) === 0){
      const i = +v.slice(BLOB_MARK.length);
      if(Number.isInteger(i) && i >= 0 && i < snap.blobs.length) return snap.blobs[i];
    }
    return v;
  });
}

function snapshotParts(){
  const out = {};
  SAVED_REGIONS.forEach(r=>{ out[r.k] = snapRegion(r.get()); });
  return out;
}
function partsDiffer(saved){
  if(!saved) return false;
  for(const r of SAVED_REGIONS){
    if(regionDiffers(r.get(), saved[r.k])) return true;
  }
  return false;
}
function takeSnapshot(){ return snapshotParts(); }
function restoreSnapshot(s){
  SAVED_REGIONS.forEach(r=>{
    if(s[r.k] === undefined) return;
    r.set(regionValue(s[r.k]));
  });
}
// Dirty is derived, never a flag that can drift: undoing back to exactly
// what was last published correctly leaves nothing to save.
function isDirty(){ return savedParts !== null && partsDiffer(savedParts); }
/* The draft's state — see the draft, at the foot of 22-file-comments.
   Declared here because refreshSaveUI asks after it, and the first
   refresh happens before that part has finished running.
 *
   Until the page has looked for a draft and the reader has answered, no
   copy is written or removed: the first refresh after loading is always
   clean, and would otherwise delete the very draft about to be offered. */
let draftLooked = false, draftTimer = 0;
/* What the saved chart was the last time the page was clean. */
let draftBase = null;
/* A Save made on the site with no connection, kept on this device until it
   can be sent — see the outbox in 36-site-owner. Declared here for the same
   reason as the draft's state: the first refresh comes before that part. */
let sitePending = false;
function refreshSaveUI(){
  const d = isDirty();
  saveBtn.disabled = !d;
  saveBtn.textContent = d ? 'Save' : 'Saved';
  if(d) setSaveState('dirty', 'Unsaved changes');
  /* Clean, but not yet on the site: said for as long as it is true, since
     a closed laptop or a phone put away is exactly when it matters. */
  else if(sitePending) setSaveState('ok', 'Saved on this device \u2014 it goes to the site when there is a connection');
  else setSaveState(null);
  /* …and keeps the copy that outlives a power cut in step. */
  scheduleDraft();
  syncUndoButtons();
}
/* Undo and redo on the toolbar, greyed when there is nothing to step to.
   Asked after every edit, undo and save, by whatever made it — the keys
   included, now that the buttons stand where a mouse sees them too. Found
   by id each time: this runs from the first edit of start-up, before the
   part that wires the buttons has. */
function syncUndoButtons(){
  const tools = document.getElementById('touchTools');
  if(!tools) return;
  const set = (act, on)=>{
    const b = tools.querySelector(`[data-act="${act}"]`);
    if(b) b.disabled = !on;
  };
  set('undo', undoStack.length > 0);
  set('redo', redoStack.length > 0);
}

// The single wrapper every edit goes through: snapshot for undo, mutate,
// redraw, update the Save button.
/* `before`, when given, is the state the edit started from, taken by the
   caller. A drag that shows itself live — a bend, a note sliding along its
   line, the bends a group carries — has already changed the data by the
   time it is dropped, so a snapshot taken at the drop is a snapshot of the
   result, and undoing to it undid nothing. Those gestures take their
   snapshot on the first frame that moves and hand it in here. */
function applyEdit(mutate, before){
  if(readOnlyView) return;
  pushUndo(before);
  const was = ignoredBendRoutes();
  mutate();
  rebuildChart();
  dropIgnoredBends(null, was);
  refreshSaveUI();
}
// Every edit records where it started, and abandons any forward history.
/* A step that would put back exactly what is already there is not a step.
 *
 * Several edits say "one undo for this session" with a pushUndo of their
 * own and then go through applyEdit, which pushes again — two identical
 * snapshots, so the first Ctrl+Z restored the state the chart was already
 * in and looked like it had done nothing. Rather than chase every caller,
 * the stack refuses a duplicate of its own top. */
function pushUndo(before){
  const snap = before || takeSnapshot();
  const top = undoStack[undoStack.length - 1];
  redoStack.length = 0;
  if(top && snapshotsEqual(top, snap)) return;
  undoStack.push(snap);
  while(undoStack.length > LOCAL_UNDO_LIMIT) undoStack.shift();
}
// Compared as snapshots, without reading either back: the text, and the
// lifted strings by identity, exactly as regionDiffers does.
function snapshotsEqual(a, b){
  for(const r of SAVED_REGIONS){
    const x = a[r.k], y = b[r.k];
    if(!x || !y) return false;
    if(x.json !== y.json || x.blobs.length !== y.blobs.length) return false;
    for(let i = 0; i < x.blobs.length; i++) if(x.blobs[i] !== y.blobs[i]) return false;
  }
  return true;
}
// A short message in the top bar, then back to whatever the save state is.
function flashStatus(msg){
  setSaveState('ok', msg);
  setTimeout(refreshSaveUI, 1600);
}
function undoLastEdit(){
  if(!undoStack.length){ setSaveState('ok', 'Nothing to undo'); setTimeout(refreshSaveUI, 1200); return; }
  redoStack.push(takeSnapshot());
  while(redoStack.length > LOCAL_UNDO_LIMIT) redoStack.shift();
  restoreSnapshot(undoStack.pop());
  rebuildChart();
  repaintOpenPanels();
  refreshSaveUI();
}
function redoLastEdit(){
  if(!redoStack.length){ setSaveState('ok', 'Nothing to redo'); setTimeout(refreshSaveUI, 1200); return; }
  undoStack.push(takeSnapshot());
  while(undoStack.length > LOCAL_UNDO_LIMIT) undoStack.shift();
  restoreSnapshot(redoStack.pop());
  rebuildChart();
  repaintOpenPanels();
  refreshSaveUI();
}
/* An undo restores the DATA; anything showing that data has to be told.
   rebuildChart redraws the chart and the side tabs, but the sticker
   library is its own overlay — so undoing a sticker's deletion put the
   sticker back in the chart while the library it was deleted from went on
   showing an empty grid until it was closed and opened again. */
function repaintOpenPanels(){
  if(stickerOverlay && stickerOverlay.classList.contains('open')){
    renderStickerLibrary();
  }
}

function workingIndex(id){ return workingNodes.findIndex(it=>it[0]===id); }
// Node entries are fixed-length tuples; this hands back a padded, mutable
// copy so callers can assign to any slot without worrying about length.
function workingEntry(id){
  const i = workingIndex(id);
  if(i === -1) return null;
  const it = workingNodes[i];
  const out = [];
  for(let k=0;k<7;k++) out[k] = (k < it.length ? it[k] : undefined);
  return {index:i, entry:out};
}
function entryOpts(entry){
  return (entry[6] && typeof entry[6]==='object') ? Object.assign({}, entry[6]) : {};
}
function putEntry(index, entry, opts){
  entry[6] = (opts && Object.keys(opts).length) ? opts : undefined;
  workingNodes[index] = entry;
}

/* What is making this chart big, in one sentence.
 *
 * Almost always the answer is one embedded picture or clip: everything
 * else on this chart is text, and text does not reach a megabyte. Naming
 * the heaviest thing turns "too large" from a dead end into an
 * instruction. */
function heaviestPartOfChart(){
  const items = [];
  (typeof MEDIA !== 'undefined' ? MEDIA : []).forEach(m=>{
    if(m && typeof m.src === 'string') items.push({what:`the figure “${m.name || m.key}”`, n:m.src.length});
  });
  (typeof STICKERS !== 'undefined' ? STICKERS : []).forEach(x=>{
    if(x && typeof x.src === 'string') items.push({what:`the sticker “${x.name || x.key}”`, n:x.src.length});
  });
  workingNodes.forEach(it=>{
    const img = it && it[6] && it[6].image;
    if(typeof img === 'string') items.push({what:`the picture on “${stripMarkup(it[1] || it[0])}”`, n:img.length});
  });
  if(!items.length) return 'the chart itself has grown past what can be saved.';
  items.sort((a,b)=> b.n - a.n);
  const mb = (items[0].n / 1048576).toFixed(1);
  return `${items[0].what} alone is about ${mb} MB. Remove or shrink it, then save again;`;
}

/* Saving off the site: the chart goes into this browser's storage
   for this document. No reload, because nothing about the page changed —
   only what it will find next time it opens.

   Browser storage is a convenience, not an archive: it belongs to one
   browser on one machine and a cleared cache takes it with it. Export is
   the real save, and the failure message says so rather than pretending
   the work is safe. */
function saveToBrowser(){
  if(!STORAGE_OK) throw new Error('this browser will not let the page store anything. Use Export to keep your work.');
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify(chartData()));
  }catch(e){
    const full = e && (e.name === 'QuotaExceededError' || e.code === 22);
    throw new Error(full
      ? 'the chart is larger than this browser will store (embedded pictures are the usual reason). Use Export to keep it as a file.'
      : 'could not write to this browser\u2019s storage.');
  }
  savedParts = snapshotParts();
  saveBtn.textContent = 'Saved';
  setSaveState('ok', 'Saved in this browser');
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(refreshSaveUI, 2600);
}

async function saveNow(){
  if(!isDirty()) return;
  setSaveState('busy', 'Saving...');
  saveBtn.disabled = true;
  try{
    if(ON_SITE) await saveToSite();
    else saveToBrowser();
  }catch(e){
    const code = e && e.code;
    /* Nothing in this page reloads, so saying it is about to was a
       message describing something that would never happen — and it wore
       the BUSY style, which reads as "in progress" rather than "your work
       is still unsaved". The reader is told what actually happened and
       what to do about it, and the Save button comes back enabled. */
    if(code==='conflict'){
      /* On the site the service merges what it can (worker/index.js); a
         refusal there means both saves changed the same thing, and says
         which. */
      const what = siteConflictWords(e.conflicts);
      setSaveState('err', what
        ? `A newer save changed ${what} too \u2014 export your copy, then reload and make your change again`
        : 'The repository has a newer chart than this page — export your copy, then reload once the site has caught up');
    }
    /* The one refusal that is fixed without losing anything: signing in
       again happens in a popup, so the edit is still here to save. */
    else if(code === 'signed_out'){
      siteOwner = null;
      siteEditor = false;
      updateOwnerBtn();
      setSaveState('err', 'Your sign-in has expired — press Sign in, then Save again');
    }
    else if(isReadOnlyError(e)){
      markReadOnly();
      setSaveState('err', 'This chart is read-only for you');
    }
    /* Say what actually went wrong. "Save failed: request failed" told the
       reader nothing they could act on, and a chart too big to send needs
       something taken out of it, which only naming it says. The code is
       named either way, so a report of one is diagnosable. */
    else if(code === 'too_large'){
      setSaveState('err', 'Too large to save — ' + heaviestPartOfChart() +
                          ' Export keeps the whole thing as a file.');
    }
    else {
      setSaveState('err', 'Save failed' + (code ? ` (${code})` : '') + ': ' +
                          (e && e.message ? e.message : 'unknown error'));
    }
    saveBtn.disabled = false;
  }
}
saveBtn.onclick = saveNow;


/* ---------------------------------------------------------------------
   Clipboard (Ctrl+C / Ctrl+X / Ctrl+V).

   Also localStorage-backed, for the same reason as the undo stack: a cut
   publishes (and so reloads) before the paste ever happens, so an
   in-memory clipboard would always be empty by the time it was needed.

   A copied node carries its own look and content but not its connections —
   the same as duplicating a shape in any drawing tool. It's pasted as a
   free-standing entry with a fresh id, hand-placed a step down-right of
   the original so it lands visibly beside what it was copied from rather
   than wherever the auto-layout would have put a new orphan.
   ------------------------------------------------------------------ */
const CLIP_KEY = carryOverKey('axiomNexus.clipboard', 'rhizome.clipboard');
function writeClipboard(payload){
  try{ localStorage.setItem(CLIP_KEY, JSON.stringify(payload)); }catch(e){}
}
function readClipboard(){
  try{ const raw = localStorage.getItem(CLIP_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function validateNodes(val){
  if(!Array.isArray(val) || val.length===0) throw new Error('must be a non-empty array of node entries.');
  const ids = new Set();
  val.forEach((it,j)=>{
    if(!Array.isArray(it) || it.length<2 || typeof it[0]!=='string' || typeof it[1]!=='string'){
      throw new Error(`node #${j+1} needs at least [id, label] (both strings).`);
    }
    if(ids.has(it[0])) throw new Error(`duplicate node id "${it[0]}".`);
    /* An id may be written in any script anybody writes in. What it may not
       contain is a control character or a line break: those survive neither
       an attribute nor the serialized form the chart is saved as, and they
       are invisible in every place a reader would look for the mistake.
       Refusing anything more than that — insisting on ASCII, say — would
       turn a chart whose entries are named in Russian into a file this
       program cannot open, which is a worse failure than the one it would
       be guarding against. Everything that makes an id awkward to put in a
       selector or an SVG id is handled where it is put there: see cssEscape
       and defId. */
    if(/[\u0000-\u001f\u007f]/.test(it[0])){
      throw new Error(`node #${j+1}: the id contains a control character.`);
    }
    if(!it[0].trim()) throw new Error(`node #${j+1}: the id is blank.`);
    ids.add(it[0]);
    const parent = it[2];
    if(parent!==undefined && parent!==null && typeof parent!=='string' &&
       !(Array.isArray(parent) && parent.every(p=>typeof p==='string'))){
      throw new Error(`node "${it[0]}": parent must be a string, an array of strings, or omitted.`);
    }
    const opts = it[6];
    if(opts!==undefined && opts!==null){
      if(typeof opts!=='object') throw new Error(`node "${it[0]}": opts must be an object.`);
      if(opts.link!==undefined && typeof opts.link!=='string') throw new Error(`node "${it[0]}": opts.link must be a string.`);
      if(opts.colors!==undefined && !(Array.isArray(opts.colors) && opts.colors.every(c=>typeof c==='string'))) throw new Error(`node "${it[0]}": opts.colors must be an array of strings.`);
      if(opts.bg!==undefined && !(Array.isArray(opts.bg) && opts.bg.every(c=>typeof c==='string'))) throw new Error(`node "${it[0]}": opts.bg must be an array of strings.`);
      if(opts.border!==undefined && !(typeof opts.border==='string' && BORDER_STYLES[opts.border])) throw new Error(`node "${it[0]}": opts.border must be one of ${Object.keys(BORDER_STYLES).join(', ')}.`);
      if(opts.tags!==undefined && !(Array.isArray(opts.tags) && opts.tags.every(t=>typeof t==='string'))) throw new Error(`node "${it[0]}": opts.tags must be an array of strings.`);
      if(opts.font!==undefined && typeof opts.font!=='string') throw new Error(`node "${it[0]}": opts.font must be a string.`);
      if(opts.fontSize!==undefined && typeof opts.fontSize!=='number') throw new Error(`node "${it[0]}": opts.fontSize must be a number.`);
      if(opts.image!==undefined && typeof opts.image!=='string') throw new Error(`node "${it[0]}": opts.image must be a string.`);
      if(opts.size!==undefined && !(Array.isArray(opts.size) && opts.size.length===2 && opts.size.every(v=>typeof v==='number' && Number.isFinite(v)))){
        throw new Error(`node "${it[0]}": opts.size must be a [w, h] pair of numbers.`);
      }
      if(opts.multiLang!==undefined && typeof opts.multiLang!=='boolean') throw new Error(`node "${it[0]}": opts.multiLang must be a boolean.`);
      if(opts.pos!==undefined && !(Array.isArray(opts.pos) && opts.pos.length===2 && opts.pos.every(v=>typeof v==='number' && Number.isFinite(v)))){
        throw new Error(`node "${it[0]}": opts.pos must be a [x, y] pair of numbers.`);
      }
      if(opts.langTabs!==undefined){
        if(!Array.isArray(opts.langTabs) || !opts.langTabs.every(t=>t && typeof t==='object' && typeof t.tag==='string' && typeof t.text==='string')){
          throw new Error(`node "${it[0]}": opts.langTabs must be an array of {tag, text} string pairs.`);
        }
      }
    }
  });
}
/* A file's connector styles, before any of them replaces the open chart's.
   Every field a style can hold is read through edgeStyleFor, which drops
   what it cannot use, so what is refused here is only what would make a
   style nobody's: a style that is not a record, or whose ends are not
   named. Left in, such a style is written back out with every save, and
   matches no connector, ever. A merge's merged arrow is the one connector
   with no entry at its start — it leaves the bar — and its style is
   written with an empty source (see isMergedArrow); refusing that refused
   every chart whose merged arrow had been given a look or a bend, the
   owner's own among them, at Import and wherever a chart is read in. */
function validateEdgeStyles(val){
  if(!Array.isArray(val)) throw new Error('the connector styles must be a list.');
  val.forEach((st, j)=>{
    if(!st || typeof st !== 'object' || Array.isArray(st)){
      throw new Error(`connector style #${j+1} is not a record.`);
    }
    if(typeof st.from !== 'string' || typeof st.to !== 'string' || !st.to){
      throw new Error(`connector style #${j+1} needs the ids of both its ends (from, to).`);
    }
  });
}
/* ---------------------------------------------------------------------
   Pretty-printer for NODES — turns the working entries back into the JS
   source the region is written in.
   ------------------------------------------------------------------ */
/* What an entry's border is drawn in, as the colours field writes it:
   its own colours, its tags', or the default ink. */
function drawnColorText(n){
  /* A merge's entry with no colours of its own wears its lineages' — and
     shows them here, as any entry shows the colour it is drawn in (the
     owner's list of 24.10). The box said the default ink, which is the one
     colour the entry is not drawn in. */
  if(mergePainted(n)){
    const cs = amalgamInheritedColors(n);
    if(cs && cs.length) return cs.join(', ');
  }
  return (n.colors && n.colors.length) ? n.colors.join(', ') : (n.color || DEFAULT_NODE_COLOR);
}
// Newlines have to be escaped, not emitted raw: a JavaScript string
// literal cannot span lines, and both labels and suggestions can contain
// them. U+2028/2029 are line terminators to a JS parser too.
/* A string, as JavaScript source, safe to sit inside this page's own
   script element.
 *
 * The chart is saved by rewriting regions of the document it is running
 * in, and those regions live inside a script element. An HTML parser ends
 * that element at the first closing script tag it sees, wherever it
 * appears — including in the middle of a string literal. So an entry
 * whose label happened to contain one published a page whose script
 * stopped halfway through the data: not a corrupted chart but an
 * unopenable one, with no way back in to fix it.
 *
 * Escaping "<" as \x3c costs nothing — the parsed string is identical —
 * and no sequence of characters a reader can type can close the element
 * any more. (This comment cannot contain the tag it is about, for exactly
 * the reason it describes.) */
function jsStr(s){
  return "'" + String(s)
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/</g,'\\x3c')
    /* Two at-signs side by side are where a region's markers begin. A note
       that quotes one — "@@EDIT:NODES:END@@" — would otherwise end the
       region in the middle of itself on the next read, and the write
       service refuses such a save outright. Escaped, it reads back the same. */
    .replace(/@@/g,'@\\x40')
    .replace(/\n/g,'\\n')
    .replace(/\r/g,'\\r')
    .replace(/\u2028/g,'\\u2028')
    .replace(/\u2029/g,'\\u2029') + "'";
}
function jsVal(v){
  if(v===null || v===undefined) return 'null';
  if(typeof v==='string') return jsStr(v);
  if(typeof v==='number' || typeof v==='boolean') return String(v);
  if(Array.isArray(v)) return '[' + v.map(jsVal).join(', ') + ']';
  if(typeof v==='object'){
    const keys = Object.keys(v).filter(k=>v[k]!==undefined);
    return '{' + keys.map(k=>`${k}:${jsVal(v[k])}`).join(', ') + '}';
  }
  return JSON.stringify(v);
}
/* The region, one entry to a line, each as a record with its fields named
   — see entryOfRecord for why the file and the page differ in form. */
function serializeNodes(nodesVal){
  let out = 'const NODES = [\n';
  nodesVal.forEach(it=>{ out += '  ' + jsVal(recordOfEntry(it)) + ',\n'; });
  out += '];';
  return out;
}

/* A record that never had its line, its routing or its arrow set — a note
   started on a plain connector is one (startEdgeNote) — has the defaults,
   and is written with them: jsStr(undefined) is the string 'undefined',
   and an arrow left out came back as null, which draws none. A note added
   to a connector used to take its arrow away at the next opening. */
function serializeEdgeStyles(list){
  if(!list.length) return 'const EDGE_STYLES = [];';
  return 'const EDGE_STYLES = [\n' + list.map(s=>
    `  {from:${jsStr(s.from)}, to:${jsStr(s.to)}, routing:${jsStr(s.routing || DEFAULT_EDGE_STYLE.routing)}, dash:${jsStr(s.dash || DEFAULT_EDGE_STYLE.dash)}, arrow:${jsVal(s.arrow === undefined ? DEFAULT_EDGE_STYLE.arrow : s.arrow)}${s.arrowIn ? `, arrowIn:true` : ''}${s.teeOut ? `, teeOut:true` : ''}${s.teeIn ? `, teeIn:true` : ''}${s.openOut ? `, openOut:true` : ''}${s.openIn ? `, openIn:true` : ''}${s.barEnd ? `, barEnd:${jsStr(s.barEnd)}` : ''}${s.sinusoid ? `, sinusoid:true` : ''}${s.note ? `, note:${jsStr(s.note)}` : ''}${s.note && s.notePos && s.notePos !== 'above' ? `, notePos:${jsStr(s.notePos)}` : ''}${s.note && typeof s.noteAt === 'number' && s.noteAt !== 0.5 ? `, noteAt:${+s.noteAt.toFixed(4)}` : ''}${s.note && validSnap(s.noteSnap) ? `, noteSnap:${jsStr(s.noteSnap)}` : ''}${s.noteBg ? `, noteBg:${jsStr(s.noteBg)}` : ''}${(s.bends && s.bends.length) ? `, bends:${jsVal(s.bends)}` : ''}${(s.bends && s.bends.length && s.bendSides) ? `, bendSides:${jsVal(s.bendSides)}` : ''}${s.color ? `, color:${jsStr(s.color)}` : ''}${s.color && s.colorFixed ? `, colorFixed:true` : ''}${s.gradient ? `, gradient:${jsVal(s.gradient)}` : ''}${s.fromSide ? `, fromSide:${jsStr(s.fromSide)}` : ''}${s.toSide ? `, toSide:${jsStr(s.toSide)}` : ''}${s.fromRing ? `, fromRing:${s.fromRing}` : ''}${s.toRing ? `, toRing:${s.toRing}` : ''}${s.square === false ? `, square:false` : s.square === true ? `, square:true` : ''}${s.note && s.noteFrame === false ? `, noteFrame:false` : ''}${s.note && s.noteSquare === false ? `, noteSquare:false` : s.note && s.noteSquare === true ? `, noteSquare:true` : ''}${s.note && s.noteAlong ? `, noteAlong:true` : ''}${s.note && s.noteAlongFrame ? `, noteAlongFrame:true` : ''}},`
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
  // The figure templates the + menu offers (see figureTemplateOfSvg).
  const figures = cleanFigureTemplates(o.figures);
  if(figures.length) extra.figures = figures;
  // The kinds of medium a card can be of (42-media-types.js).
  const mediaTypes = cleanMediaTypes(o.mediaTypes);
  if(mediaTypes.length) extra.mediaTypes = mediaTypes;
  // Notes pencilled in the margin (44-ink.js).
  const ink = cleanInk(o.ink);
  if(ink.length) extra.ink = ink;
  // The chart's own faces (fontOptions, 05-render-text.js).
  const fonts = cleanFonts(o.fonts);
  if(fonts.length) extra.fonts = fonts;
  /* The names are keyed by a mark's key, which has a colon in it, so the
     keys are written quoted, as the meanings' are. */
  const quoted = obj=> `{${Object.keys(obj).map(k=> `${jsStr(k)}: ${jsStr(obj[k])}`).join(', ')}}`;
  const extraPart = Object.keys(extra).map(k=> `, ${k}: ${k === 'legendNames' || k === 'tagColors' || k === 'legendIcons' ? quoted(extra[k]) : jsVal(extra[k])}`).join('');
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
  /* A row's own picture, by the mark's key or the own row's id. */
  if(o.legendIcons && typeof o.legendIcons === 'object' && !Array.isArray(o.legendIcons)){
    const icons = {};
    Object.keys(o.legendIcons).sort().forEach(k=>{
      const v = o.legendIcons[k];
      if((LEGEND_KEY_RE.test(k) || /^own\d+$/.test(k)) && typeof v === 'string' && pictureSrcOk(v)) icons[k] = v;
    });
    if(Object.keys(icons).length) out.legendIcons = icons;
  }
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
    `  {key:${jsStr(s.key)}, name:${jsStr(s.name || s.key)}, ` +
    (pictureAnimOf(s.anim) ? `anim:${jsStr(s.anim)}, ` : '') + `src:${jsStr(s.src)}},`
  ).join('\n') + '\n];';
}
