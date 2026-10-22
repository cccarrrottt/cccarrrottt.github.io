/* =========================================================================
   WHERE THE CHART IS KEPT
   -----------------------------------------------------------------------
   This page began life as a claude.ai artifact, and for a while the only
   way it could save was the one that host provides: publish a new version
   of yourself. That made the chart a hostage of a single website. Opened
   from a disk, or served from anywhere else, it drew perfectly and then
   refused to remember anything.

   It now keeps its work through whichever of three backends is actually
   available, decided at load:

     artifact  — running inside claude.ai with write access. Saving
                 publishes a new version of this page, exactly as before,
                 and the host reloads the view afterwards.
     site      — on the published site, for its owner only: Saving commits
                 the chart to the repository through the write service, and
                 the site shows it once CI has rebuilt it. See SITE_ORIGINS
                 below and 36-site-owner.js.
     standalone— everywhere else: a file on a disk, a plain web server, a
                 local dev build. Saving writes the chart to this browser's
                 storage for this document, and takes effect immediately
                 with no reload.

   The standalone backend keeps DATA, not source code: the four editable
   regions are stored as JSON and read back with JSON.parse, so nothing
   stored can ever be executed. Export writes the whole thing back out as a
   fresh self-contained page — that is the copy you keep, move to another
   machine, or publish anywhere at all.

   The restore below runs before anything else, because the model is built
   from these arrays a few hundred lines down and has to see the right
   contents the first time.
   ========================================================================= */
const STORE_PREFIX = 'rhizome.chart:';
/* The project was called Axiom Nexus before it was called Rhizome, and that
   name is stamped on every key this program has ever written into a browser.
   The old prefix is kept, and read from, because renaming it without carrying
   the old values over would not lose a preference — it would lose THE CHART,
   for anybody whose only copy lives in a browser on their own machine or on
   a file they host themselves. See carryOverKey below. */
const OLD_STORE_PREFIX = 'axiomNexus.chart:';
// One chart per document, so two charts served side by side keep their own
// work rather than overwriting each other.
const STORE_KEY = STORE_PREFIX + (location.pathname + location.search || 'default');

// `claude` is a bare global the host injects. Its absence is the signal
// that nothing here can publish, and it is worth knowing synchronously:
// the boot-time restore below cannot wait on a promise.
const HOSTED = typeof claude !== 'undefined' && claude && typeof claude.use === 'function';

/* -------------------------------------------------------------------------
   The published site, and who may write to it.

   There used to be four builds of this page, because whether a copy could
   be edited was decided when it was BUILT: an editable one for the owner,
   a read-only one for everybody else, each as a fragment and as a whole
   document. The page the public saw and the page the owner edited were
   different files, and nothing but discipline kept them in step.

   Now there is one file, and the question is asked when it is OPENED. On
   the site's own address the page starts as a reader, and becomes an
   editor only when the write service below confirms that the person
   holding it signed in as the chart's owner. Hiding the controls is not
   what keeps anybody out — every reader receives the editor's code, and
   is welcome to read it. What keeps them out is that the only place a
   write can go is that service, and it checks the signature itself.

   Anywhere else — a file on a disk, a copy somebody hosts, the test
   server — the page is that person's own copy and edits into their own
   browser, exactly as it always has. SITE_API empty means the service is
   not set up yet: the site is then read-only for everybody, the owner
   included, which is the safe way for that to be wrong.
   ------------------------------------------------------------------------- */
const SITE_ORIGINS = ['https://cccarrrottt.github.io'];
const SITE_API = 'https://cccarrrottt-github-io.wowwodptr2.workers.dev';
/* The repository the site is published from, and where suggestions are
   kept as issues. The same as REPO in worker/wrangler.toml: the page reads
   the open ones from GitHub itself, so a reader who has not signed in sees
   them too. */
const SITE_REPO = 'cccarrrottt/cccarrrottt.github.io';
const ON_SITE = !HOSTED && SITE_ORIGINS.indexOf(location.origin) >= 0;
/* The open suggestions the write service last listed (22-file-comments),
   or null before it has been asked. Declared here, ahead of everything,
   because every rebuild draws their marks, and the first rebuild runs long
   before the part that fetches them. */
let siteSuggestions = null;
/* The git blob id of the src/data.js this page was built from, written in
   by build.py. The write service refuses a save whose base is not the file
   currently in the repository, so a page that is behind — a second tab, or
   this one reloaded before the site caught up with the last save — cannot
   quietly replace newer work with older. null when the parts are run
   straight from src/, which is never the site.

   It is read from the document rather than written into the program, and
   from the wrapper's <head>, outside the page's own markers. In the program
   it made every Save a new program: on the site the program is a file of
   its own, named by its hash so a reader's browser keeps it, and a value
   that changes with the chart would have changed that name with every
   Save. Outside the markers, it is not carried into an exported copy or a
   page published to claude.ai, where it would only ever be stale. */
const DATA_SHA = (()=>{
  const m = document.querySelector('meta[name="rhizome-data-sha"]');
  const v = m && m.getAttribute('content');
  return v && /^[0-9a-f]{40}$/.test(v) ? v : null;
})();

function storageOk(){
  try{
    const k = '__axiomNexusProbe';
    localStorage.setItem(k, '1'); localStorage.removeItem(k);
    return true;
  }catch(e){ return false; }
}
const STORAGE_OK = storageOk();

/* -------------------------------------------------------------------------
   Carrying a value written under the old brand's key over to the new one.

   The rule is deliberately one-directional and non-destructive: the new key
   is written only when it does not exist yet, and the old key is never
   removed. Both halves matter. Writing unconditionally would let a stale
   pre-rename value overwrite work done since the rename, which is the exact
   data loss the migration exists to prevent. Deleting the old key would make
   opening an older copy of this file — and people do keep older copies, that
   being the whole point of a single-file chart — silently start from nothing.
   A few hundred bytes of duplicated preference is the cheaper mistake.

   Returns the new key, so a key can be declared and migrated in one breath:
       const SOME_KEY = carryOverKey('axiomNexus.thing', 'rhizome.thing');
   ------------------------------------------------------------------------- */
function carryOverKey(oldKey, newKey){
  if(!STORAGE_OK || oldKey === newKey) return newKey;
  try{
    if(localStorage.getItem(newKey) === null){
      const had = localStorage.getItem(oldKey);
      if(had !== null) localStorage.setItem(newKey, had);
    }
  }catch(e){}
  return newKey;
}

/* The chart keys cannot be listed in advance: there is one per document that
   has ever been opened, and this copy of the file knows only its own. So the
   whole of local storage is swept once at boot. The keys are collected before
   any of them is written, because localStorage.key(i) is an index into a live
   list and writing to it mid-walk can make the walk skip an entry. */
(function carryOverCharts(){
  if(!STORAGE_OK) return;
  try{
    const stale = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(OLD_STORE_PREFIX) === 0) stale.push(k);
    }
    stale.forEach(k=> carryOverKey(k, STORE_PREFIX + k.slice(OLD_STORE_PREFIX.length)));
  }catch(e){}
})();

/* Replace the contents of an array in place. The rest of the page holds
   references to these arrays — EDGE_STYLES especially is captured by
   closures all over — so they must never be reassigned, only refilled. */
function refill(arr, items){
  arr.length = 0;
  if(Array.isArray(items)) items.forEach(x=> arr.push(x));
}

function readStoredChart(){
  if(!STORAGE_OK) return null;
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    return (data && typeof data === 'object' && Array.isArray(data.nodes)) ? data : null;
  }catch(e){ return null; }
}

/* Work saved in this browser wins over what is baked into the file — that
   is what saving means. It is applied only when this page has no way to
   publish, so on claude.ai the published document always speaks for
   itself and a stale local copy can never shadow it.

   The same goes for the published site, and for a sharper reason: a copy
   kept there was written back when the site still served an editable page,
   by a reader who believed they were changing the chart. Letting it win
   would show that reader their own old edit, forever, as if it were what
   everybody sees. On the site the file speaks for itself. */
if(!HOSTED && !ON_SITE){
  const stored = readStoredChart();
  if(stored){
    /* A region the stored copy does not carry is a region it has nothing
       to say about — not an instruction to empty the one baked into this
       file. `refill` clears before it fills, so an unguarded call against
       a missing key threw away every connector style, sticker and comment
       the document shipped with: a chart written by an older build, or a
       payload edited by hand, opened having quietly "lost its
       formatting", with nothing to explain it. */
    if(Array.isArray(stored.nodes)) refill(NODES, stored.nodes);
    if(Array.isArray(stored.edgeStyles)) refill(EDGE_STYLES, stored.edgeStyles);
    if(Array.isArray(stored.stickers)) refill(STICKERS, stored.stickers);
    if(Array.isArray(stored.media)) refill(MEDIA, stored.media);
    if(Array.isArray(stored.comments)) refill(COMMENTS, stored.comments);
    if(Array.isArray(stored.tagCats)) refill(TAG_CATS, stored.tagCats);
    if(Array.isArray(stored.refs)) refill(REFS, stored.refs);
    if(stored.settings && typeof stored.settings === 'object') Object.assign(SETTINGS, stored.settings);
    /* The kept chart's form is the kept chart's, not the file's: one kept
       by a page from before the form had a number would otherwise be taken
       for one in the file's form, and not brought up to it (migrateChart). */
    if(!(stored.settings && typeof stored.settings.format === 'number')) delete SETTINGS.format;
  }
}

/* The page's own source, captured before a single element has been added
   to it. Export needs the real bytes of this document and cannot always
   fetch them — a page opened from a disk cannot fetch itself at all — but
   at the moment this script starts running the parser has already built
   the whole document, including this script's own text, so the DOM IS the
   source. Read it now, before the chart starts drawing into it. */
const PRISTINE_HTML = (()=>{
  try{ return '<!doctype html>\n' + document.documentElement.outerHTML; }
  catch(e){ return null; }
})();

/* Every colour the chart keeps is a hex value, and is asked to be one
   wherever it is READ, not only where it is typed. The editors have always
   refused anything else, but a chart also arrives from a file, from browser
   storage and from a hand-edited data.js, and a colour goes into inline
   styles (`style="background:…"`) where escaping the quotes is not enough —
   `red;background:url(//elsewhere)` is still one well-formed attribute, and
   it fetches. So a value that is not a hex colour is treated as absent. */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function isHexColor(c){ return typeof c === 'string' && HEX_RE.test(c); }
// The hex colours of a list, or null when none are left.
function hexColors(list){
  if(!Array.isArray(list)) return null;
  const out = list.filter(isHexColor);
  return out.length ? out : null;
}

const DEFAULT_EDGE_STYLE = { routing: 'orthogonal', dash: 'solid', arrow: true, arrowIn: false,
                             teeOut: false, teeIn: false,
                             sinusoid: false, note: '', notePos: 'above', noteAt: 0.5,
                             noteBg: null, bends: null, bendSides: null,
                             noteDir: null, noteLen: null,
                             fromSide: null, toSide: null,
                             fromRing: 0, toRing: 0, gradient: null, square: true,
                             noteFrame: true, noteSquare: false, noteAlong: false };
function edgeStyleFor(from, to){
  const o = EDGE_STYLES.find(s=>s.from===from && s.to===to);
  if(!o) return DEFAULT_EDGE_STYLE;
  return {
    routing: o.routing || DEFAULT_EDGE_STYLE.routing,
    dash: o.dash || DEFAULT_EDGE_STYLE.dash,
    arrow: o.arrow !== undefined ? o.arrow : DEFAULT_EDGE_STYLE.arrow,
    // An arrowhead at the source end too, for a mutual or reversed link.
    arrowIn: !!o.arrowIn,
    /* And whether the mark at that end is a T rather than an arrow: a bar
       across the line, stopped short of the entry. It is how the chart
       says "broad strokes" — the story arrives at its shape without
       reaching every detail of it. Only meaningful where the end has a
       mark at all. */
    teeOut: !!o.teeOut && o.arrow !== false,
    teeIn: !!o.teeIn && !!o.arrowIn,
    sinusoid: !!o.sinusoid,
    note: typeof o.note === 'string' ? o.note : '',
    // 'above' | 'on' | 'below'. 'on' lays the note across the connector,
    // its plate covering the line — the right choice on a crowded chart,
    // where a note floating beside its line can read as belonging to the
    // connector next to it.
    notePos: ['above','on','below'].includes(o.notePos) ? o.notePos
             : (o.noteBelow ? 'below' : 'above'),
    /* Where along the connector a leader note is pinned, 0 at the source
       end and 1 at the target. Kept as a FRACTION rather than a point,
       because the connector is re-routed whenever anything moves — an
       absolute point would be left behind the moment a node was dragged,
       while a fraction stays where the reader put it, relative to the line
       it belongs to. */
    noteAt: (typeof o.noteAt === 'number' && o.noteAt >= 0 && o.noteAt <= 1) ? o.noteAt : 0.5,
    /* And which way, and how far, the leader itself runs — drawn by the
       reader rather than searched for. An angle in degrees measured the
       way SVG measures them (0 to the right, growing clockwise) and a
       distance in chart units from the anchor to the card's centre.
       Absent means the card has never been aimed by hand, and the
       automatic search that has always placed it still does. */
    /* The plate's own ground. Its INK is the connector's and is not the
       reader's to set — a remark on a line belongs to the line — but what
       it is written on is, and on a crowded chart a note usually wants
       something to sit on. */
    noteBg: isHexColor(o.noteBg) ? o.noteBg : null,
    /* Which kind of place the note was put on with Shift, if any — the
       middle of the connector, or the middle of one of its legs. A note
       on such a place keeps to it as the connector changes; see
       settleAnchor. */
    noteSnap: validSnap(o.noteSnap),
    /* Points this connector has to pass through, set by hand — see
       handBends. In chart coordinates, in order from the source end. */
    /* Each a pair of finite numbers, or it is not kept: a point at NaN
       sends the whole route there, and one written as {x, y} by hand was
       read as a point at undefined. */
    bends: cleanBends(o.bends),
    /* Which sides the route left and arrived by when those points were set.
       A route pinned by hand is pinned at its ends too: see resolvePorts. */
    bendSides: (cleanBends(o.bends) && Array.isArray(o.bendSides) &&
                o.bendSides.length === 2 && o.bendSides.every(s=> SIDES.includes(s)))
               ? o.bendSides.slice() : null,
    noteDir: (typeof o.noteDir === 'number' && isFinite(o.noteDir)) ? o.noteDir : null,
    noteLen: (typeof o.noteLen === 'number' && o.noteLen > 0) ? o.noteLen : null,
    color: isHexColor(o.color) ? o.color : null,
    // Whether that colour was CHOSEN here rather than inherited from the
    // border the connector was drawn out of. See currentPaint.
    colorFixed: !!o.colorFixed,
    // Explicit sides, set by dragging a connector between two side
    // handles. Absent means "work it out from the geometry".
    fromSide: SIDES.includes(o.fromSide) ? o.fromSide : null,
    toSide: SIDES.includes(o.toSide) ? o.toSide : null,
    // Which border ring each end attaches to on a multi-coloured node.
    // A ring is a count of borders in from the outside: a whole number.
    // NaN or a fraction would put the end on no border at all.
    fromRing: Number.isInteger(o.fromRing) && o.fromRing >= 0 ? o.fromRing : 0,
    toRing: Number.isInteger(o.toRing) && o.toRing >= 0 ? o.toRing : 0,
    /* Square elbows unless asked for rounded ones: only the rounding is
       stored, as square:false — the owner made square the default
       (2026-10-14), as it already was for an entry's corners. */
    square: o.square !== false,
    /* The note's plate: framed or bare, rounded or square. Its own, not the
       connector's — the line's corners are the line's, and a remark on it
       chooses how it is written down. */
    noteFrame: o.noteFrame !== false,
    noteSquare: !!o.noteSquare,
    // Written along the line, bending with it, rather than level on a plate.
    noteAlong: !!o.noteAlong,
    // Two hex colours to sweep between along the connector, or null.
    gradient: (Array.isArray(o.gradient) && o.gradient.length===2 &&
               o.gradient.every(isHexColor)) ? o.gradient.slice() : null
  };
}


function cleanBends(list){
  if(!Array.isArray(list)) return null;
  const out = list.filter(b=> Array.isArray(b) && b.length === 2 && Number.isFinite(b[0]) && Number.isFinite(b[1]));
  return out.length ? (out.length === list.length ? list : out) : null;
}
/* A snap is written as 'mid' or 'leg:N' — N the leg's order along the
   route. Anything else is no snap at all. */
function validSnap(v){
  return (typeof v === 'string' && /^(mid|leg:\d{1,3})$/.test(v)) ? v : null;
}
