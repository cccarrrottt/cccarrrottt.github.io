/* ---------------------------------------------------------------------
   Legend — tag-based filtering. Every user-assigned tag (opts.tags) gets
   a row; nodes with no tags at all fall into an implicit "Untagged"
   bucket so they're still filterable. A node is visible as long as at
   least one of its effective tags (its own tags, or the Untagged
   pseudo-tag if it has none) isn't hidden.
   ------------------------------------------------------------------ */
const UNTAGGED = '__untagged__';
function effectiveTags(n){
  return (n.tags && n.tags.length) ? n.tags : [UNTAGGED];
}
const tagCounts = new Map(); // tag -> count
// Which tags the user has switched off. Survives a rebuild — a filter is a
// view preference, not part of the data, so adding a node shouldn't quietly
// un-hide everything.
const hiddenTags = new Set();
let allTags = [];
const legendList = document.getElementById('tagsList');
const refsList = document.getElementById('refsList');
const keyList = document.getElementById('keyList');

/* ---- tags and their categories -------------------------------------
 *
 * Two things had to change here. A tag used to exist only because some
 * entry carried it: the list was derived from the chart every rebuild, so
 * there was no way to make a tag before the entry that would wear it, and
 * no place to record how tags relate to each other.
 *
 * TAG_CATS is that place. A category names a set of tags, and a tag it
 * names counts as existing whether or not any entry carries it yet — which
 * is what lets you set up a vocabulary first and apply it afterwards. A tag
 * belongs to at most one category; the rest gather under "Ungrouped".
 *
 * Categories are chart data, not a view setting, so they live in their own
 * @@EDIT@@ region and travel with an export. What stays a view setting is
 * which tags are hidden — that is still `hiddenTags`, still per-browser,
 * and still nothing to do with this. */
const UNGROUPED = '__ungrouped__';
function sanitizeTagCats(list){
  /* Imported data decides the shape of the tag panel, so it is normalized
     once here rather than guarded at each of the places that read it: a
     category needs a name, its tags must be strings, and a tag may not sit
     in two categories at once (the first claim wins, so the result can
     never render one tag twice). */
  /* The one entry allowed to bear the reserved name is the loose bin —
     see looseBin below. It is not a category and is never shown as one,
     but it is a real entry of this list because it is the only thing that
     persists a tag no entry carries and no category claims. */
  const seenCat = new Set(), claimed = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(c=>{
    if(!c || typeof c !== 'object') return;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if(!name || seenCat.has(name)) return;
    seenCat.add(name);
    const tags = [];
    (Array.isArray(c.tags) ? c.tags : []).forEach(t=>{
      if(typeof t !== 'string') return;
      const tag = t.trim();
      if(!tag || tag === UNTAGGED || claimed.has(tag)) return;
      claimed.add(tag); tags.push(tag);
    });
    out.push({name, tags});
  });
  return out;
}
/* The loose bin, and the real categories.
 *
 * A tag that belongs to no category still has to be kept somewhere, or it
 * would not survive the next rebuild: TAG_CATS is the only thing that
 * remembers a tag nobody carries. So the uncategorised ones are kept in an
 * entry of TAG_CATS under the reserved name, and everything that asks
 * "what categories are there" asks realCategories instead. The bin is
 * never listed, renamed, removed or offered as a place to file into. */
function looseBin(make){
  let bin = TAG_CATS.find(c=> c.name === UNGROUPED);
  if(!bin && make){ bin = {name: UNGROUPED, tags: []}; TAG_CATS.push(bin); }
  return bin;
}
function realCategories(){ return TAG_CATS.filter(c=> c.name !== UNGROUPED); }
/* Also the suite's, for the same reason: it is the plain statement of which
   category owns a tag, which the legend's own grouping is checked against. */
// eslint-disable-next-line no-unused-vars
function categoryOf(tag){
  for(const c of realCategories()) if(c.tags.indexOf(tag) >= 0) return c.name;
  return UNGROUPED;
}
// Every tag that exists: the ones entries carry, plus the ones a category
// declares but nothing wears yet.
function knownTags(){
  const set = new Set(tagCounts.keys());
  set.delete(UNTAGGED);
  TAG_CATS.forEach(c=> c.tags.forEach(t=> set.add(t)));
  return Array.from(set).sort((a,b)=> a.localeCompare(b));
}
function tagExists(tag){ return tagCounts.has(tag) || TAG_CATS.some(c=> c.tags.indexOf(tag) >= 0); }
// Puts a tag in a category, taking it out of whichever one held it before.
// '' or UNGROUPED means "no category".
function assignTagCategory(tag, catName){
  TAG_CATS.forEach(c=>{ const i = c.tags.indexOf(tag); if(i >= 0) c.tags.splice(i, 1); });
  if(!catName || catName === UNGROUPED){ looseBin(true).tags.push(tag); return; }
  const cat = TAG_CATS.find(c=> c.name === catName);
  if(cat) cat.tags.push(tag);
  else looseBin(true).tags.push(tag);
}
/* There is no longer a mode. "Organize" existed to fold the editing
   controls away and leave a panel that only filtered — but every row now
   carries its own eye and its own cross, so the panel is an editor either
   way and a switch that revealed two more controls was one more thing to
   find. What it used to hide is simply always there. */

/* ---- references -----------------------------------------------------
 *
 * A reference is {key, title, detail, url}. The key is what a text stores;
 * the number the reader sees is the position in this list, computed at
 * draw time by refIndex(). Nothing anywhere stores a number, which is what
 * makes reordering safe.
 *
 * The panel sits beside the tag panel and shares its shape deliberately:
 * both are lists of things the chart refers to, and both are opened from
 * the same corner of the toolbar. */
function sanitizeRefs(list){
  const seen = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(r=>{
    if(!r || typeof r !== 'object') return;
    const key = typeof r.key === 'string' ? r.key.trim() : '';
    if(!key || !/^[A-Za-z0-9_-]+$/.test(key) || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      title: typeof r.title === 'string' ? r.title : '',
      detail: typeof r.detail === 'string' ? r.detail : '',
      // Run through the same gate as an entry's link: a reference is a
      // place a reader is invited to click, so it may only navigate.
      url: (typeof r.url === 'string' && safeUrl(r.url)) ? r.url : ''
    });
  });
  return out;
}
function uniqueRefKey(base){
  let k = String(base || 'ref').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'ref';
  if(refIndex(k) < 0) return k;
  let i = 2;
  while(refIndex(k + '-' + i) >= 0) i++;
  return k + '-' + i;
}
// Every text on the chart that could carry a citation, so a reference can
// report how many places use it — and warn before deleting a used one.
function refUsageCount(key){
  const token = '{{r:' + key + '}}';
  let n = 0;
  const scan = t=>{ if(typeof t === 'string' && t.indexOf(token) >= 0) n++; };
  workingNodes.forEach(t=>{
    scan(t[1]); scan(t[4]);
    const opts = t[6];
    if(opts && Array.isArray(opts.langTabs)) opts.langTabs.forEach(x=> scan(x && x.text));
  });
  EDGE_STYLES.forEach(e=> scan(e && e.note));
  COMMENTS.forEach(c=> scan(c && c.text));
  REFS.forEach(r=>{ scan(r.detail); });
  return n;
}
function stripRefToken(text, key){
  return typeof text === 'string' ? text.split('{{r:' + key + '}}').join('') : text;
}

/* One panel, two lists. Rebuilt together because they share a container
   and because a change to either can affect what the other shows — a tag
   deleted here, a reference renumbered there. */
/* A section heading, and the controls that belong to that section.
   Both lists used to be worked from one row of buttons at the top of the
   panel, which meant a single + that had to ask which of three things you
   meant and one eye that could only ever mean "tags". Each heading now
   carries what acts on the list under it, so the button says what it does
   by where it is. */
function sectionHead(title, count){
  const head = document.createElement('div');
  head.className = 'legend-group-head legend-section-head';
  head.innerHTML = `<span class="legend-group-name">${escapeHtml(title)}</span>` +
                   `<span class="legend-group-count">${count}</span>`;
  return head;
}
const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                 '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
/* A tag with a + on it, and a folder with a + on it: the two things the
   Tags heading makes, told apart by what they make. */
const TAG_ADD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">' +
  '<path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.3 8.3-9.2 9.2z"/><circle cx="7.6" cy="7.6" r="1.3"/>' +
  '<line x1="19" y1="16" x2="19" y2="23" stroke-width="2.2"/><line x1="15.5" y1="19.5" x2="22.5" y2="19.5" stroke-width="2.2"/></svg>';
const CAT_ADD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">' +
  '<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2.2h9A1.5 1.5 0 0 1 21.5 8.7V13M2.5 6.5V18a1.5 1.5 0 0 0 1.5 1.5h9"/>' +
  '<line x1="19" y1="16" x2="19" y2="23" stroke-width="2.2"/><line x1="15.5" y1="19.5" x2="22.5" y2="19.5" stroke-width="2.2"/></svg>';
/* A citation as it is drawn — a number in brackets — as the mark of
   everything to do with references: the button that cites one from a
   text, the References tab, and (with the same + as a tag and a category)
   the button that adds one. */
const REF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M8 3.5H4.5v17H8M16 3.5h3.5v17H16"/><path d="M9.6 8.2 12.6 6v12"/></svg>';
const REF_ADD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6.4 2.8H3v17.4h3.4M16.8 2.8h3.4v10"/><path d="M9.2 7.4 12.4 5v15.2"/>' +
  '<line x1="19" y1="16" x2="19" y2="23" stroke-width="2.2" stroke-linecap="butt"/><line x1="15.5" y1="19.5" x2="22.5" y2="19.5" stroke-width="2.2" stroke-linecap="butt"/></svg>';
function makePlusButton(title, svg){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'icon-action plus-mini'; b.title = title;
  b.innerHTML = svg || PLUS_SVG;
  return b;
}
/* The two tabs, rebuilt together because a rebuild of the chart can change
   both — but each into its own list, under its own heading, with its own
   search and its own +. They used to be two halves of one panel, and two
   lists in one panel read as one list with a subtitle in the middle of it
   however they were ruled apart. */
function buildSideTabs(){
  buildLegend();
  const scroll = refsList.scrollTop;
  /* Rescued before the list is emptied, as the tags rescue theirs. */
  const colorRow = document.getElementById('refColorRow');
  if(colorRow) document.getElementById('sideTabs').appendChild(colorRow);
  refsList.innerHTML = '';
  const head = sectionHead('References', REFS.length);
  if(!readOnlyView){
    const add = makePlusButton('Add a reference', REF_ADD_SVG);
    add.classList.add('add-ref');
    add.addEventListener('click', ev=>{ ev.stopPropagation(); startNewRefEntry(); });
    head.appendChild(add);
  }
  refsList.appendChild(head);
  refsList.appendChild(buildRefFilterRow());
  /* The citation colour is a setting OF the references, so it sits with
     them — and above the list rather than below it, where a long list of
     references would otherwise push it out of sight. */
  if(colorRow && !readOnlyView){ colorRow.hidden = false; refsList.appendChild(colorRow); }
  else if(colorRow) colorRow.hidden = true;
  buildRefsInto(refsList);
  refsList.scrollTop = scroll;
  if(document.getElementById('keyPanel').classList.contains('open')) buildKeyTab();
}
/* ---------------------------------------------------------------------
   The legend: what the marks on this chart mean.

   Built from the chart rather than written out once, so it lists the marks
   that are actually ON it — a reader looking up what a dotted border means
   is not helped by a catalogue of eleven things, nine of which this chart
   never uses. Each row is a small drawing of the mark, its name, and what
   it means HERE. The program knows what some marks mean because it gives
   them that meaning (a remark, a merge, a citation, the four tags that
   change how an entry is drawn); what a dashed connector or a double
   border means is the chart author's decision, so the row says it only
   once the author has, and in their words. Those words are kept with the
   chart, in SETTINGS.legend, keyed by the mark.
   ------------------------------------------------------------------ */
const KEY_SVG_W = 40, KEY_SVG_H = 20;
function keySvg(inner){
  return `<svg class="key-sample" viewBox="0 0 ${KEY_SVG_W} ${KEY_SVG_H}" width="${KEY_SVG_W}" height="${KEY_SVG_H}" aria-hidden="true">${inner}</svg>`;
}
const KEY_BOX = 'x="7" y="4.5" width="26" height="11"';
function keyBoxSample(extra){
  return keySvg(`<rect ${KEY_BOX} class="key-box" ${extra || ''}/>`);
}
function keyLineSample(dash, opts){
  const o = opts || {};
  const head = (x, dir)=> `<path class="key-head" d="M${x},10 l${-5*dir},-3 l0,6 z"/>`;
  let line;
  if(dash === 'double'){
    line = `<line class="key-line" x1="4" y1="8.4" x2="31" y2="8.4"/><line class="key-line" x1="4" y1="11.6" x2="31" y2="11.6"/>`;
  } else if(o.wavy){
    line = `<path class="key-line" d="M4,10 q3.4,-4 6.8,0 t6.8,0 t6.8,0 t6.8,0"/>`;
  } else {
    const da = DASH_PATTERNS[dash] ? ` stroke-dasharray="${DASH_PATTERNS[dash]}"` : '';
    line = `<line class="key-line" x1="${o.headIn ? 9 : 4}" y1="10" x2="${o.noHead ? 36 : o.tee ? 32 : 31}" y2="10"${da}/>`;
  }
  // A T stands short of where an arrow's tip would be, as it does on the chart.
  if(o.tee) return keySvg(line + `<path class="key-head" d="M31,6 h1.6 v8 h-1.6 z"/>`);
  return keySvg(line + (o.noHead ? '' : head(36, 1)) + (o.headIn ? head(4, -1) : ''));
}
/* Every mark the chart is using, in reading order: the entries, what is
   drawn round and under them, then the lines between them. */
function keyMarksInUse(){
  const has = new Set();
  let anyEdge = false;
  nodes.forEach(n=>{
    const shape = n.shape || 'rect';
    if(shape === 'ellipse') has.add('shape:bio');
    else if(shape === 'amalgam') has.add('shape:amalgam');
    else if(shape === 'callout') has.add('shape:callout');
    else if(shape === 'image') has.add('shape:image');
    else if(shape === 'textbox') has.add('shape:textbox');
    else if(shape === 'array') has.add('shape:array');
    else if(n.card) has.add('shape:card');
    else has.add('shape:entry');
    if(!isFreeShape(shape)){
      const b = borderStyleOf(n);
      if(b !== 'solid') has.add('border:' + b);
    }
    Object.keys(SPECIAL_TAGS).forEach(t=>{ if(nodeHasTag(n, t)) has.add('tag:' + t); });
    (n.parents || []).forEach(pid=>{
      if(!nodes.has(pid)) return;
      anyEdge = true;
      const st = edgeStyleFor(pid, n.id);
      if(st.sinusoid) has.add('line:wavy');
      else has.add('line:' + (DASH_PATTERNS.hasOwnProperty(st.dash) ? st.dash : 'solid'));
      if(st.arrowIn && st.arrow !== false) has.add('line:both');
      if(st.arrow === false && !st.arrowIn) has.add('line:none');
      if(st.teeOut || st.teeIn) has.add('line:tee');
    });
  });
  if(!anyEdge) ['solid','dashed','dotted','dashdot','double'].forEach(d=> has.delete('line:' + d));
  if(REFS.length) has.add('mark:cite');
  return KEY_MARKS.filter(m=> has.has(m.key));
}
/* What each mark looks like, what it is called, and — where the program
   itself gives it a meaning — what that meaning is. */
const KEY_MARKS = [
  {key:'shape:entry',   group:'Entries', name:'Entry',     sample:()=> keyBoxSample()},
  {key:'shape:card',    group:'Entries', name:'Card',      sample:()=> keySvg(`<rect ${KEY_BOX} class="key-box"/><line class="key-rule" x1="7" y1="10" x2="33" y2="10"/>`)},
  {key:'shape:bio',     group:'Entries', name:'Portrait',  sample:()=> keySvg('<circle cx="20" cy="10" r="6.5" class="key-box"/>')},
  {key:'shape:amalgam', group:'Entries', name:'Amalgam',   meaning:'Several lineages merging into one.',
   sample:()=> keySvg(`<rect ${KEY_BOX} class="key-box key-amalgam"/>`)},
  {key:'shape:callout', group:'Entries', name:'Remark',    meaning:'A note about the chart rather than a part of it.',
   sample:()=> keySvg('<path class="key-box" d="M7,4.5 h26 v9 h-17 l-4,3.5 v-3.5 h-5 z"/>')},
  {key:'shape:image',   group:'Entries', name:'Picture',   sample:()=> keySvg(`<rect ${KEY_BOX} class="key-pic"/><path class="key-pic-ink" d="M9,14 l7,-6 l5,4 l3,-2 l7,4 z"/>`)},
  {key:'shape:textbox', group:'Entries', name:'Caption',   sample:()=> keySvg('<text class="key-text" x="20" y="14" text-anchor="middle">Aa</text>')},
  {key:'shape:array',   group:'Entries', name:'Array',     meaning:'Entries framed together.',
   sample:()=> keySvg(`<rect x="3" y="2.5" width="34" height="15" class="key-box"/>` +
                      `<rect x="6.5" y="6" width="11" height="8" class="key-box"/><rect x="22.5" y="6" width="11" height="8" class="key-box"/>`)},
  {key:'border:dashed',  group:'Borders', name:'Dashed border',      sample:()=> keyBoxSample(`stroke-dasharray="${BORDER_STYLES.dashed.dash}"`)},
  {key:'border:dotted',  group:'Borders', name:'Dotted border',      sample:()=> keyBoxSample(`stroke-dasharray="${BORDER_STYLES.dotted.dash}"`)},
  {key:'border:dashdot', group:'Borders', name:'Dash-dotted border', sample:()=> keyBoxSample(`stroke-dasharray="${BORDER_STYLES.dashdot.dash}"`)},
  {key:'border:double',  group:'Borders', name:'Double border',
   sample:()=> keySvg(`<rect x="6" y="3.5" width="28" height="13" class="key-box key-thin"/><rect x="8.2" y="5.7" width="23.6" height="8.6" class="key-box key-thin"/>`)},
  {key:'border:wavy',    group:'Borders', name:'Wavy border',
   sample:()=> keySvg('<path class="key-box" d="M7,4.5 q3.25,-2 6.5,0 t6.5,0 t6.5,0 t6.5,0 v11 q-3.25,2 -6.5,0 t-6.5,0 t-6.5,0 t-6.5,0 z"/>')},
  {key:'tag:' + FANFIC_TAG,     group:'Grounds', name:'Woven ground',  meaning:'Fan fiction.',
   sample:()=> keySvg(`<path class="key-weave" d="M2,18 L18,2 M10,18 L26,2 M18,18 L34,2 M26,18 L40,4 M2,2 L18,18 M10,2 L26,18 M18,2 L34,18 M26,2 L40,16"/><rect ${KEY_BOX} class="key-box"/>`)},
  {key:'tag:' + UNRELEASED_TAG, group:'Grounds', name:'Ruled ground',  meaning:'Not released.',
   sample:()=> keySvg(`<path class="key-ruled" d="M1,3 H39 M1,7 H39 M1,11 H39 M1,15 H39 M1,19 H39"/><rect ${KEY_BOX} class="key-box"/>`)},
  {key:'tag:' + HUB_TAG,        group:'Grounds', name:'Echo',          meaning:'A multiversal hub.',
   sample:()=> keySvg(`<rect x="2" y="1" width="36" height="18" class="key-box key-faint"/><rect x="4.5" y="2.75" width="31" height="14.5" class="key-box key-faint"/><rect ${KEY_BOX} class="key-box"/>`)},
  {key:'tag:' + LOCAL_TAG,      group:'Grounds', name:'Stacked worlds', meaning:'A local multiverse.',
   sample:()=> keySvg(`<rect x="13" y="1" width="26" height="11" class="key-box key-faint"/><rect x="10" y="2.75" width="26" height="11" class="key-box key-faint"/><rect x="7" y="4.5" width="26" height="11" class="key-box"/>`)},
  {key:'line:solid',   group:'Connectors', name:'Connector',            sample:()=> keyLineSample('solid')},
  {key:'line:dashed',  group:'Connectors', name:'Dashed connector',     sample:()=> keyLineSample('dashed')},
  {key:'line:dotted',  group:'Connectors', name:'Dotted connector',     sample:()=> keyLineSample('dotted')},
  {key:'line:dashdot', group:'Connectors', name:'Dash-dotted connector', sample:()=> keyLineSample('dashdot')},
  {key:'line:double',  group:'Connectors', name:'Double connector',     sample:()=> keyLineSample('double')},
  {key:'line:wavy',    group:'Connectors', name:'Wavy connector',       sample:()=> keyLineSample('solid', {wavy:true})},
  {key:'line:both',    group:'Connectors', name:'Arrow at both ends',   sample:()=> keyLineSample('solid', {headIn:true})},
  {key:'line:none',    group:'Connectors', name:'Line with no arrow',   sample:()=> keyLineSample('solid', {noHead:true})},
  {key:'line:tee',     group:'Connectors', name:'Ends in a T, short of the entry', sample:()=> keyLineSample('solid', {tee:true})},
  {key:'mark:cite',    group:'Marks', name:'Citation', meaning:'The number of a source in References.',
   sample:()=> keySvg(`<text class="key-text" x="9" y="14">a</text><text class="key-cite" x="16" y="9" fill="${escapeHtml(refColor())}">[1]</text>`)}
];
function keyMeaningOf(mark){
  const own = SETTINGS.legend && typeof SETTINGS.legend[mark.key] === 'string' ? SETTINGS.legend[mark.key] : null;
  return own !== null ? own : (mark.meaning || '');
}
function setKeyMeaning(key, text){
  const mark = KEY_MARKS.find(m=> m.key === key);
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const now = SETTINGS.legend && typeof SETTINGS.legend[key] === 'string' ? SETTINGS.legend[key] : null;
  /* Saying what the program already says is not a setting; it is stored
     only where it differs, so the chart's settings carry what its author
     actually wrote and nothing else. */
  const want = (mark && t === (mark.meaning || '')) ? null : t;
  if(want === now) return;
  applyEdit(()=>{
    const next = Object.assign({}, SETTINGS.legend || {});
    if(want === null) delete next[key]; else next[key] = want;
    if(Object.keys(next).length) SETTINGS.legend = next; else delete SETTINGS.legend;
  });
}
/* The legend is the author's, whole: every row's name and meaning, which
   rows stand in it, and rows of their own that are no mark the program
   draws. What the program supplies is a starting point — the marks the
   chart is using — and everything the author changes is kept with the
   chart, in SETTINGS:
     legend        {key: meaning}  what a mark means here
     legendNames   {key: name}     what the row is called
     legendHidden  [key]           marks in use that the author took out
     legendAdded   [key]           marks NOT in use that the author put in
     legendOwn     [{id, name, meaning, color}]  rows of the author's own
   It is a tool for the author while the chart is being built, so a reader
   is not shown it (the owner's call, 2026-10-14); see body.read-only. */
function legendSetting(name, fallback){
  const v = SETTINGS[name];
  return v === undefined ? fallback : v;
}
function keyNameOf(mark){
  const names = legendSetting('legendNames', {});
  return typeof names[mark.key] === 'string' && names[mark.key] ? names[mark.key] : mark.name;
}
/* The rows in the order they stand: the program's marks in its own order,
   less those taken out and with those put in, then the author's own. */
function keyRows(){
  const hidden = new Set(legendSetting('legendHidden', []));
  const added = new Set(legendSetting('legendAdded', []));
  const used = new Set(keyMarksInUse().map(m=> m.key));
  const marks = KEY_MARKS.filter(m=> (used.has(m.key) || added.has(m.key)) && !hidden.has(m.key));
  return {marks, own: legendSetting('legendOwn', []).slice()};
}
/* Every legend change is one step of undo, and empties are not stored:
   a chart whose author never touched the legend writes what it always did. */
function editLegend(change){
  if(readOnlyView) return;
  applyEdit(()=>{
    const next = {
      legendNames: Object.assign({}, legendSetting('legendNames', {})),
      legendHidden: legendSetting('legendHidden', []).slice(),
      legendAdded: legendSetting('legendAdded', []).slice(),
      legendOwn: legendSetting('legendOwn', []).map(o=> Object.assign({}, o)),
    };
    change(next);
    const empty = v=> Array.isArray(v) ? !v.length : !Object.keys(v).length;
    Object.keys(next).forEach(k=>{ if(empty(next[k])) delete SETTINGS[k]; else SETTINGS[k] = next[k]; });
  });
}
function setKeyName(key, text){
  const mark = KEY_MARKS.find(m=> m.key === key);
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const want = (!t || (mark && t === mark.name)) ? null : t;
  const now = legendSetting('legendNames', {})[key] || null;
  if(want === now) return;
  editLegend(o=>{ if(want === null) delete o.legendNames[key]; else o.legendNames[key] = want; });
}
function hideKeyMark(key){
  editLegend(o=>{
    o.legendAdded = o.legendAdded.filter(k=> k !== key);
    if(keyMarksInUse().some(m=> m.key === key) && !o.legendHidden.includes(key)) o.legendHidden.push(key);
  });
}
function showKeyMark(key){
  editLegend(o=>{
    o.legendHidden = o.legendHidden.filter(k=> k !== key);
    if(!keyMarksInUse().some(m=> m.key === key) && !o.legendAdded.includes(key)) o.legendAdded.push(key);
  });
}
function addOwnKeyRow(){
  let id;
  const taken = new Set(legendSetting('legendOwn', []).map(r=> r.id));
  for(let i = 1; taken.has(id = 'own' + i); i++);
  editLegend(o=> o.legendOwn.push({id, name: 'New mark', meaning: '', color: '#20242b'}));
  return id;
}
function editOwnKeyRow(id, field, value){
  const row = legendSetting('legendOwn', []).find(r=> r.id === id);
  if(!row) return;
  let v = String(value || '');
  if(field !== 'color') v = v.replace(/\s+/g, ' ').trim();
  if(field === 'color' && !HEX_RE.test(v)) return;
  if((row[field] || '') === v) return;
  editLegend(o=>{ const r = o.legendOwn.find(x=> x.id === id); if(r) r[field] = v; });
}
function deleteOwnKeyRow(id){
  editLegend(o=>{ o.legendOwn = o.legendOwn.filter(r=> r.id !== id); });
}
/* A field that settles on Enter or leaving it, and puts back what it had
   on Escape — the legend's words, its names and its colours alike. */
function keyField(tag, cls, value, placeholder, label, commit){
  const box = document.createElement(tag);
  if(tag === 'textarea') box.rows = 1; else box.type = 'text';
  box.className = cls;
  box.value = value;
  box.placeholder = placeholder;
  box.setAttribute('aria-label', label);
  box.spellcheck = false;
  box.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Enter'){ ev.preventDefault(); box.blur(); }
    if(ev.key === 'Escape'){ ev.preventDefault(); box.value = value; box.blur(); }
  });
  box.addEventListener('change', ()=> commit(box.value));
  return box;
}
function keyRemoveButton(title, fn){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key-remove';
  b.title = title;
  b.textContent = '✕';
  b.addEventListener('click', ev=>{ ev.stopPropagation(); fn(); });
  return b;
}
/* The menu under the legend's +: the program's marks not in the legend,
   and a row of the author's own. */
let keyAddMenuOpen = false;
function buildKeyAddMenu(){
  const menu = document.createElement('div');
  menu.className = 'key-add-menu';
  const shown = new Set(keyRows().marks.map(m=> m.key));
  const own = document.createElement('button');
  own.type = 'button';
  own.className = 'key-add-own';
  own.textContent = '+ A row of your own';
  own.addEventListener('click', ev=>{
    ev.stopPropagation();
    keyAddMenuOpen = false;
    const id = addOwnKeyRow();
    const box = keyList.querySelector(`.key-item[data-own="${id}"] .key-name-input`);
    if(box){ box.focus(); box.select(); }
  });
  menu.appendChild(own);
  let group = null;
  KEY_MARKS.filter(m=> !shown.has(m.key)).forEach(m=>{
    if(m.group !== group){
      group = m.group;
      const gh = document.createElement('div');
      gh.className = 'key-group';
      gh.textContent = group;
      menu.appendChild(gh);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key-add-mark';
    b.innerHTML = m.sample() + `<span>${escapeHtml(keyNameOf(m))}</span>`;
    b.addEventListener('click', ev=>{ ev.stopPropagation(); keyAddMenuOpen = false; showKeyMark(m.key); });
    menu.appendChild(b);
  });
  return menu;
}
function buildKeyTab(){
  if(!keyList) return;
  const scroll = keyList.scrollTop;
  keyList.innerHTML = '';
  const {marks, own} = keyRows();
  const head = sectionHead('Legend', marks.length + own.length);
  if(!readOnlyView){
    const add = makePlusButton('Add a row to the legend');
    add.addEventListener('click', ev=>{ ev.stopPropagation(); keyAddMenuOpen = !keyAddMenuOpen; buildKeyTab(); });
    head.appendChild(add);
  }
  keyList.appendChild(head);
  if(keyAddMenuOpen && !readOnlyView) keyList.appendChild(buildKeyAddMenu());
  if(!marks.length && !own.length){
    const empty = document.createElement('div');
    empty.className = 'key-empty';
    empty.textContent = 'Nothing on the chart yet.';
    keyList.appendChild(empty);
  }
  let group = null;
  const heading = g=>{
    if(g === group) return;
    group = g;
    const gh = document.createElement('div');
    gh.className = 'key-group';
    gh.textContent = g;
    keyList.appendChild(gh);
  };
  const row = (sampleHtml, words)=>{
    const r = document.createElement('div');
    r.className = 'key-item';
    r.innerHTML = sampleHtml;
    const w = document.createElement('div');
    w.className = 'key-words';
    words.forEach(x=> w.appendChild(x));
    r.appendChild(w);
    keyList.appendChild(r);
    return r;
  };
  const text = (cls, t)=>{ const d = document.createElement('div'); d.className = cls; d.textContent = t; return d; };
  marks.forEach(m=>{
    heading(m.group);
    const name = keyNameOf(m), meaning = keyMeaningOf(m);
    let r;
    if(readOnlyView){
      r = row(m.sample(), [text('key-name', name)].concat(meaning ? [text('key-meaning', meaning)] : []));
    } else {
      r = row(m.sample(), [
        keyField('input', 'key-name-input', name, m.name, `The name of “${m.name}” in the legend`, v=> setKeyName(m.key, v)),
        keyField('textarea', 'key-meaning-input', meaning, 'What it means on this chart',
                 `What “${name}” means on this chart`, v=> setKeyMeaning(m.key, v))
      ]);
      r.appendChild(keyRemoveButton('Take this row out of the legend — the + puts it back', ()=> hideKeyMark(m.key)));
    }
    r.dataset.key = m.key;
  });
  own.forEach(o=>{
    heading('Your own');
    const swatch = keySvg(`<rect ${KEY_BOX} class="key-own" style="fill:${escapeHtml(o.color || '#20242b')}"/>`);
    let r;
    if(readOnlyView){
      r = row(swatch, [text('key-name', o.name)].concat(o.meaning ? [text('key-meaning', o.meaning)] : []));
    } else {
      const hex = keyField('input', 'key-own-hex hex-input', o.color || '', '#20242b', 'The colour of this row', v=> editOwnKeyRow(o.id, 'color', v.trim()));
      hex.maxLength = 9;
      const hexWrap = document.createElement('div');
      hexWrap.className = 'key-own-colour';
      hexWrap.appendChild(hex);
      squareForHexInput(hex, {title: 'the colour of this row', fallback: ()=> '#20242b'});
      r = row(swatch, [
        keyField('input', 'key-name-input', o.name, 'Name', 'The name of this row', v=> editOwnKeyRow(o.id, 'name', v)),
        keyField('textarea', 'key-meaning-input', o.meaning || '', 'What it means on this chart', 'What this row means', v=> editOwnKeyRow(o.id, 'meaning', v)),
        hexWrap
      ]);
      r.appendChild(keyRemoveButton('Delete this row', ()=> deleteOwnKeyRow(o.id)));
    }
    r.dataset.own = o.id;
  });
  keyList.scrollTop = scroll;
}
function buildLegend(){
  tagCounts.clear();
  nodes.forEach(n=>{
    effectiveTags(n).forEach(t=> tagCounts.set(t, (tagCounts.get(t)||0)+1));
  });
  allTags = knownTags();
  if(tagCounts.has(UNTAGGED)) allTags.push(UNTAGGED);
  /* A tag can now outlive the last entry carrying it, so long as a category
     still declares it — dropping it from hiddenTags on that basis would
     silently un-hide it. Only a tag that has stopped existing altogether is
     forgotten. */
  Array.from(hiddenTags).forEach(t=>{
    if(t !== UNTAGGED && !tagExists(t)) hiddenTags.delete(t);
    if(t === UNTAGGED && !tagCounts.has(UNTAGGED)) hiddenTags.delete(t);
  });

  // Group the tags for display: declared categories in their own order,
  // then whatever is left.
  /* The last bucket is SPECIAL, and it is not merely "whatever is left".
     The tags that DO something — the ones that put a weave under an entry
     or an echo around it — belong together and belong nowhere else: filing
     one under "Eras" would say it is a kind of era, which it is not. They
     are collected here whatever else claims them, along with the Untagged
     bucket and any tag nobody has filed yet. */
  const reserved = new Set(allTags.filter(t=> t === UNTAGGED || tagIsSpecial(t)));
  const groups = realCategories().map(c=> ({
    name: c.name,
    tags: c.tags.filter(t=> allTags.indexOf(t) >= 0 && !reserved.has(t))
                .sort((a,b)=> a.localeCompare(b))
  }));
  const grouped = new Set();
  groups.forEach(g=> g.tags.forEach(t=> grouped.add(t)));
  /* Two different kinds of "not in a category", which used to share one
     bucket at the foot of the panel. SPECIAL is a real group — the tags
     that DO something, collected together whatever else claims them, and
     the Untagged bin. UNCATEGORISED is not a group at all: it is where a
     tag sits before anybody has decided where it goes, which is where
     every tag starts and where a tag dragged out of a category lands. It
     belongs at the TOP, under the search box, because it is a staging area
     and not an archive. */
  const uncategorised = allTags.filter(t=> !grouped.has(t) && !reserved.has(t));
  const special = allTags.filter(t=> reserved.has(t));
  if(special.length) groups.push({name: UNGROUPED, tags: special});

  legendList.innerHTML = '';
  const tagHead = sectionHead('Tags', allTags.length);
  /* Two buttons, one for each thing that can be made here. The single +
     opened a two-item menu, which is a click spent asking which of two
     things was meant when there could have been one button for each. And
     there is no eye on the heading: hiding every tag at once hid the whole
     chart, which is one click from an empty page and never what anybody
     reaching for that corner wanted. */
  if(!readOnlyView){
    const addTag = makePlusButton('Add a tag', TAG_ADD_SVG);
    addTag.classList.add('add-tag');
    addTag.addEventListener('click', ev=>{ ev.stopPropagation(); startNewTagEntry(); });
    const addCat = makePlusButton('Add a category', CAT_ADD_SVG);
    addCat.classList.add('add-cat');
    addCat.addEventListener('click', ev=>{ ev.stopPropagation(); startNewCategoryEntry(); });
    tagHead.appendChild(addTag);
    tagHead.appendChild(addCat);
  }
  legendList.appendChild(tagHead);
  legendList.appendChild(buildTagFilterRow());
  legendList.appendChild(buildLooseBlock(uncategorised.filter(tagMatchesFilter)));
  const shown = groups.map(g=> ({name:g.name, tags:g.tags.filter(tagMatchesFilter)}));
  let any = false;
  shown.forEach(group=>{
    if(!group.tags.length && group.name === UNGROUPED && TAG_CATS.length) return;
    /* While a search is running, a category with nothing matching in it is
       not an empty category — it is one the reader is not looking at. */
    if(tagFilterText && !group.tags.length) return;
    any = true;
    legendList.appendChild(buildCategoryBlock(group));
  });
  if(pendingNewCat) legendList.appendChild(buildNewCategoryBlock());
  if(tagFilterText && !any && !uncategorised.length){
    const none = document.createElement('div');
    none.className = 'legend-empty';
    none.textContent = `No tag matches \u201c${tagFilterText}\u201d.`;
    legendList.appendChild(none);
  }
}

/* ---- where a tag lives before it is filed ---------------------------
 *
 * A headless block, directly under the search box, holding every tag no
 * category claims — and the place a brand-new tag is made and named. It is
 * also a drop target, which is the gesture for taking a tag back OUT of a
 * category: there was none before, and a filing decision you cannot undo
 * by hand is not a filing decision. */
function buildLooseBlock(tags){
  const wrap = document.createElement('div');
  wrap.id = 'legendLoose';
  wrap.className = 'legend-group legend-loose' + (readOnlyView ? '' : ' drop-zone');
  wrap.dataset.cat = UNGROUPED;
  tags.forEach(tag=> wrap.appendChild(buildTagRow(tag, UNGROUPED)));
  if(pendingNewTag) wrap.appendChild(buildNewTagRow());
  else if(!tags.length){
    const hint = document.createElement('div');
    hint.className = 'legend-loose-hint';
    hint.textContent = readOnlyView
      ? 'Every tag is filed under a category.'
      : 'Tags with no category appear here. Drag one out of a category to bring it back.';
    wrap.appendChild(hint);
  }
  return wrap;
}
/* Naming a thing where it stands: the same gesture the category headings
   already use, shared so the two cannot drift apart. */
function focusNaming(box){
  if(!box) return;
  box.focus({preventScroll:true});
  try{
    const sel = window.getSelection(), r = document.createRange();
    r.selectNodeContents(box);
    sel.removeAllRanges(); sel.addRange(r);
  }catch(e){}
}
/* Making a tag where it will live.
 *
 * A tag used to be made in a dialog — a window, a field, an OK button —
 * and then appeared somewhere else on the panel, under whichever category
 * happened to be first. It is written into an empty tag shape in the
 * uncategorised block instead, exactly as a category is renamed on its own
 * heading, and carried into a category afterwards if it wants one. Enter or
 * a click anywhere else keeps it; nothing typed, or Escape, and no tag was
 * ever made. */
let pendingNewTag = false, pendingNewCat = false;
function startNewTagEntry(){
  if(readOnlyView) return;
  pendingNewCat = false;
  pendingNewTag = true;
  /* Named on the Tags tab, so the tab is open: a box in a shut drawer
     cannot take the caret. */
  setSideTab(document.getElementById('tagsPanel'), true);
  buildSideTabs();
  focusNaming(document.querySelector('#legendLoose .tag-naming-text'));
}
function startNewCategoryEntry(){
  if(readOnlyView) return;
  pendingNewTag = false;
  pendingNewCat = true;
  /* Named on the Tags tab, so the tab is open: a box in a shut drawer
     cannot take the caret. */
  setSideTab(document.getElementById('tagsPanel'), true);
  buildSideTabs();
  focusNaming(document.querySelector('.legend-group-new .legend-group-name'));
}
function buildNewTagRow(){
  const row = document.createElement('div');
  row.className = 'legend-item legend-item-new';
  row.innerHTML =
    `<div class="swatch" style="background:var(--accent)"></div>` +
    `<div class="name"><span class="tag-shape"><i class="tag-eye"></i>` +
    `<span class="tag-naming-text" contenteditable="plaintext-only" spellcheck="false"></span>` +
    `</span></div><div class="count">0</div>`;
  row.insertBefore(makeEyeButton(false, 'A new tag'), row.firstChild);
  const box = row.querySelector('.tag-naming-text');
  let done = false;
  const finish = (keep)=>{
    if(done) return;
    done = true;
    const typed = (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    pendingNewTag = false;
    if(keep && typed) createTag(typed);
    else buildSideTabs();
  };
  box.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); }
    else if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); }
  });
  /* A click anywhere else keeps what was typed, as Enter does: the name is
     written, and reaching for something else is how a reader says they
     are done with it. Only Escape is "never mind". */
  box.addEventListener('blur', ()=> finish(true));
  box.addEventListener('click', ev=> ev.stopPropagation());
  box.addEventListener('mousedown', ev=> ev.stopPropagation());
  return row;
}
function buildNewCategoryBlock(){
  const wrap = document.createElement('div');
  wrap.className = 'legend-group legend-group-new';
  const head = document.createElement('div');
  head.className = 'legend-group-head';
  head.innerHTML =
    `<span class="legend-group-name renaming" contenteditable="plaintext-only" spellcheck="false"></span>` +
    `<span class="legend-group-fold">\u2304</span><span class="legend-group-count">0</span>`;
  head.insertBefore(makeEyeButton(false, 'A new category'), head.firstChild);
  const box = head.querySelector('.legend-group-name');
  let done = false;
  const finish = (keep)=>{
    if(done) return;
    done = true;
    const typed = (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    pendingNewCat = false;
    if(keep && typed) createCategory(typed);
    else buildSideTabs();
  };
  box.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); }
    else if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); }
  });
  box.addEventListener('blur', ()=> finish(true));
  box.addEventListener('click', ev=> ev.stopPropagation());
  box.addEventListener('mousedown', ev=> ev.stopPropagation());
  wrap.appendChild(head);
  return wrap;
}
/* The references' search, the same box over the other list. A reference
   is found by what it says, by its link, or by its number — "[3]" or a
   bare 3 — since the number is what the mark in the text shows; a number
   is looked for in the words as well. */
let refFilterText = '';
function refMatchesFilter(r, i){
  if(!refFilterText) return true;
  const q = refFilterText.replace(/^\[|\]$/g, '');
  /* A number finds the reference with that number AND any whose words
     have it in them: "1914" is far more often a year somebody is looking
     for than the thousand-and-fourteenth reference, and a search that
     answered only the second question found nothing at all. */
  if(/^\d+$/.test(q) && String(i + 1) === q) return true;
  return (refBodyText(r) + ' ' + (r.url || '')).toLowerCase().indexOf(refFilterText) >= 0;
}
function buildRefFilterRow(){
  const row = document.createElement('div');
  row.className = 'legend-filter';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'refsFilter';
  input.placeholder = 'Find a reference\u2026';
  input.spellcheck = false;
  input.value = refFilterText;
  input.addEventListener('input', ()=>{
    refFilterText = input.value.trim().toLowerCase();
    buildSideTabs();
    const again = document.getElementById('refsFilter');
    if(again){ again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
  input.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Escape'){ input.value = ''; refFilterText = ''; buildSideTabs(); }
  });
  input.addEventListener('click', ev=> ev.stopPropagation());
  row.appendChild(input);
  return row;
}
/* The search. A chart of any age has more tags than fit on the panel, and
   scrolling a list to find a name you already know is the one thing a list
   is worst at. Typing narrows it; clearing it puts everything back, folded
   categories and all — and while anything is typed the categories are held
   open, since a match hidden inside a folded category is a search that
   answers "nothing found" while holding the answer. */
function buildTagFilterRow(){
  const row = document.createElement('div');
  row.className = 'legend-filter';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'legendFilter';
  input.placeholder = 'Find a tag\u2026';
  input.spellcheck = false;
  input.value = tagFilterText;
  input.addEventListener('input', ()=>{
    tagFilterText = input.value.trim().toLowerCase();
    buildSideTabs();
    const again = document.getElementById('legendFilter');
    if(again){ again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
  input.addEventListener('keydown', ev=>{
    ev.stopPropagation();
    if(ev.key === 'Escape'){ input.value = ''; tagFilterText = ''; buildSideTabs(); }
  });
  input.addEventListener('click', ev=> ev.stopPropagation());
  row.appendChild(input);
  return row;
}

/* The eye, at every scale. One shape for "this is showing / this is
   hidden" — the whole panel's eye, a category's, a single tag's — so the
   control reads the same wherever it appears instead of the top button
   being an eye and the rows being dots. */
const EYE_OPEN_SVG = '<svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const EYE_SHUT_SVG = '<svg class="eye-shut" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 12s3.8-6.5 10-6.5c2 0 3.7.7 5.1 1.5M22 12s-3.8 6.5-10 6.5c-2 0-3.7-.7-5.1-1.5"/><circle cx="12" cy="12" r="2.8"/><line x1="3.5" y1="20.5" x2="20.5" y2="3.5"/></svg>';
function makeEyeButton(shut, title){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-action eye-mini' + (shut ? ' shut' : '');
  b.title = title;
  b.innerHTML = EYE_OPEN_SVG + EYE_SHUT_SVG;
  return b;
}

/* Which categories are folded shut, and what the reader is looking for.
 *
 * Both belong to the session rather than to the chart: they are how
 * somebody is reading the list right now, not something about the list. A
 * chart opened tomorrow shows every category, which is the right default
 * for a panel whose job is to say what tags exist. */
const collapsedCats = new Set();
let tagFilterText = '';
function tagMatchesFilter(tag){
  if(!tagFilterText) return true;
  const name = tag === UNTAGGED ? 'untagged' : tag;
  return name.toLowerCase().indexOf(tagFilterText) >= 0;
}
let headDblTimer = 0;
function buildCategoryBlock(group){
  const isLoose = group.name === UNGROUPED;
  const wrap = document.createElement('div');
  // Ungrouped is where a tag with no category shows up, not a category to
  // file one into — so it is marked, and never accepts a drop.
  wrap.className = 'legend-group' + (isLoose || readOnlyView ? '' : ' drop-zone');
  wrap.dataset.cat = group.name;

  const head = document.createElement('div');
  head.className = 'legend-group-head';
  /* What the eye acts on is every tag the category DECLARES, not only the
     ones some entry happens to carry. A category whose tags are all unused
     shows as empty, and judging the eye by what is on the panel left it
     pointing at nothing: it drew as open, and clicking it did nothing at
     all. A category is a filing decision, and it keeps that decision
     whether or not anything is filed under it today. */
  const owned = isLoose ? group.tags
    : (TAG_CATS.find(c=> c.name === group.name) || {tags: group.tags}).tags;
  const allOff = owned.length > 0 && owned.every(t=> hiddenTags.has(t));
  if(isLoose) head.classList.add('legend-group-special');
  /* Folded shut, a category is one line instead of twenty. A chart can
     carry more tags than a panel has room for, and the reader is almost
     always working inside one of them at a time. The chevron says which
     way it will go; the whole heading is the target, because a heading is
     what anybody would click. */
  const shut = collapsedCats.has(group.name) && !tagFilterText;
  wrap.classList.toggle('collapsed', shut);
  head.innerHTML =
    `<span class="legend-group-name">${escapeHtml(isLoose ? 'Special' : group.name)}</span>` +
    `<span class="legend-group-fold">${shut ? '\u2039' : '\u2304'}</span>` +
    `<span class="legend-group-count">${group.tags.length}</span>`;
  head.classList.add('foldable');
  head.title = (shut ? 'Show this category' : 'Fold this category away') +
               (isLoose || readOnlyView ? '' : ' — double-click the name to rename it');
  head.addEventListener('click', ev=>{
    if(ev.target.closest('button')) return;
    if(headDblTimer){ clearTimeout(headDblTimer); headDblTimer = 0; return; }
    /* A moment's wait, because the second click of a double means
       "rename", and folding the category away underneath the cursor
       first is the wrong answer to it. */
    headDblTimer = setTimeout(()=>{
      headDblTimer = 0;
      if(collapsedCats.has(group.name)) collapsedCats.delete(group.name);
      else collapsedCats.add(group.name);
      buildSideTabs();
    }, DOUBLE_CLICK_GRACE);
  });
  /* Renaming is a double click on the name, like every other name on this
     page. It used to have a pencil of its own in the heading, next to the
     ✕ that removes the category — two buttons a few pixels apart, one of
     which edits and one of which deletes. */
  if(!isLoose && !readOnlyView){
    head.addEventListener('dblclick', ev=>{
      if(ev.target.closest('button')) return;
      ev.preventDefault(); ev.stopPropagation();
      if(headDblTimer){ clearTimeout(headDblTimer); headDblTimer = 0; }
      startCategoryRename(head, group.name);
    });
  }
  const groupEye = makeEyeButton(!!allOff, owned.length
    ? (allOff ? 'Show' : 'Hide') + ' this whole category'
    : 'This category is empty — drag a tag onto it');
  // Nothing to show or hide: the eye stays, so the heading still reads
  // like every other heading, but it cannot be pressed.
  if(!owned.length) groupEye.disabled = true;
  groupEye.addEventListener('click', ev=>{
    ev.stopPropagation();
    // One gesture for the group: if any of it is showing, hide it all;
    // otherwise bring it all back.
    if(allOff) owned.forEach(t=> hiddenTags.delete(t));
    else owned.forEach(t=> hiddenTags.add(t));
    applyVisibility(); buildSideTabs();
  });
  head.insertBefore(groupEye, head.firstChild);
  if(!isLoose && !readOnlyView){
    const tools = document.createElement('span');
    tools.className = 'legend-group-tools';
    const del = document.createElement('button');
    del.type = 'button'; del.textContent = '✕'; del.title = 'Remove this category (its tags stay)';
    del.addEventListener('click', ev=>{ ev.stopPropagation(); removeCategory(group.name); });
    tools.appendChild(del);
    head.appendChild(tools);
  }
  wrap.appendChild(head);

  if(!shut) group.tags.forEach(tag=> wrap.appendChild(buildTagRow(tag, group.name)));
  return wrap;
}

/* A tag's colour, typed where its square was (see openHexBox). Enter or
   leaving keeps it, Escape keeps what was there, and an emptied box takes
   the colour off. */
function openTagColorBox(row, tag){
  const sw = row.querySelector('.swatch');
  if(!sw || row.querySelector('.hex-box')) return;
  openHexBox(sw, {value: tagColorOf(tag) || '', placeholder: '#3a6fd8',
    onCommit: v=>{ if(v !== tagColorOf(tag)) applyEdit(()=> setTagColorIn(tag, v)); }});
}
/* One of a ground's two colours, the same way; emptied, it gives that ink
   back to the program. */
function openGroundColorBox(sq, key, slot){
  const row = sq.closest('.legend-item');
  if(!row || row.querySelector('.hex-box')) return;
  openHexBox(sq, {value: groundColorSet(key, slot) || '', placeholder: GROUND_COLOR_DEFAULTS[key][slot],
    swatch: GROUND_COLOR_DEFAULTS[key][slot],
    onCommit: v=>{ if(v !== groundColorSet(key, slot)) applyEdit(()=> setGroundColorIn(key, slot, v)); }});
}
/* Inside an edit: the map is replaced rather than changed in place, so the
   undo snapshot taken before still holds the old one. */
function setTagColorIn(tag, color){
  const next = Object.assign({}, SETTINGS.tagColors || {});
  if(color && !tagIsSpecial(tag)) next[tag] = color; else delete next[tag];
  if(Object.keys(next).length) SETTINGS.tagColors = next; else delete SETTINGS.tagColors;
}
function buildTagRow(tag, catName){
  const row = document.createElement('div');
  row.className = 'legend-item' + (hiddenTags.has(tag) ? ' off' : '');
  row.dataset.tag = tag;
  const count = tagCounts.get(tag) || 0;
  const displayName = tag === UNTAGGED ? 'Untagged' : tag;
  const hidden = hiddenTags.has(tag);
  /* A star on the ones that act. It is a mark on the NAME, not a column of
     its own, so the rows still line up and a chart with no special tags in
     it looks exactly as it did. */
  /* The square is the tag's colour — the one its entries are drawn in when
     they have none of their own. A tag that acts, and the Untagged bucket,
     give no colour, so they have no square: a square there promised a
     colour that could never be set. Pressed, it opens the colour to type
     in; a tag with no colour yet shows an empty one to press. */
  const colorable = tag !== UNTAGGED && !tagIsSpecial(tag);
  const own = colorable ? tagColorOf(tag) : null;
  row.innerHTML =
    (colorable && (own || !readOnlyView)
      ? `<div class="swatch${own ? '' : ' swatch-unset'}"${own ? ` style="background:${escapeHtml(own)}"` : ''}></div>`
      : `<div class="swatch swatch-none"></div>`) +
    `<div class="name">${tagShapeHtml(displayName, {special: tagIsSpecial(tag),
                                                    reserved: tag === UNTAGGED,
                                                    why: SPECIAL_TAGS[tag]})}</div>` +
    `<div class="count">${count}</div>`;
  /* Showing and hiding is the eye, here as everywhere else. It used to be
     the whole row, which meant the row could not also carry a delete
     button without every attempt to remove a tag hiding it first. */
  const eye = makeEyeButton(hidden, (hidden ? 'Show' : 'Hide') + ' this tag');
  eye.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(hiddenTags.has(tag)) hiddenTags.delete(tag);
    else hiddenTags.add(tag);
    applyVisibility();
    // The category's own eye reflects its tags, so it has to be repainted.
    buildSideTabs();
  });
  row.insertBefore(eye, row.firstChild);
  const sw = row.querySelector('.swatch');
  if(colorable && !readOnlyView && sw){
    sw.classList.add('swatch-pick');
    sw.title = own ? `${own} — the colour of entries with this tag; press to change` : 'Give this tag a colour';
    sw.addEventListener('mousedown', ev=> ev.stopPropagation());
    sw.addEventListener('click', ev=>{ ev.stopPropagation(); openTagColorBox(row, tag); });
  }
  /* A ground has no colour to give its entries, but it is drawn in two of
     its own — the ruling and the light that crosses it — and those are the
     author's to choose. Two squares where the tag's one would be, in front
     of the name as every tag's square is, and after the name, before the
     count, a button that puts both back. Every row keeps room for both
     — two squares' width in front, a button's width at the end — so the
     names, the counts and the ✕ each stand in one column whether a row
     has a ground's controls or not. The button stays when there is
     nothing to put back, greyed, so the row does not change shape under
     the pointer. */
  const groundKey = groundKeyOf(tag);
  if(groundKey && !readOnlyView){
    const box = document.createElement('span');
    box.className = 'ground-colors';
    GROUND_SLOTS.forEach(slot=>{
      const sq = document.createElement('div');
      const set = groundColorSet(groundKey, slot);
      sq.className = 'swatch swatch-pick ground-swatch' + (set ? '' : ' ground-default');
      sq.dataset.slot = slot;
      sq.style.background = groundColorOf(groundKey, slot);
      const what = slot === 'base' ? 'the ground’s ruling' : 'the light crossing it';
      sq.title = `${groundColorOf(groundKey, slot)} — ${what}${set ? '' : ' (the program’s)'}; press to change`;
      sq.addEventListener('mousedown', ev=> ev.stopPropagation());
      sq.addEventListener('click', ev=>{ ev.stopPropagation(); openGroundColorBox(sq, groundKey, slot); });
      box.appendChild(sq);
    });
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'ground-reset';
    reset.textContent = '\u21BA';
    reset.title = 'Put both colours back to the program’s';
    reset.disabled = !(SETTINGS.groundColors && SETTINGS.groundColors[groundKey]);
    reset.addEventListener('mousedown', ev=> ev.stopPropagation());
    reset.addEventListener('click', ev=>{
      ev.stopPropagation();
      applyEdit(()=> setGroundColorIn(groundKey, null));
    });
    const slot = row.querySelector('.swatch-none');
    if(slot) slot.replaceWith(box); else row.insertBefore(box, row.querySelector('.name'));
    row.insertBefore(reset, row.querySelector('.count'));
  } else if(!readOnlyView){
    const room = document.createElement('span');
    room.className = 'ground-reset-room';
    row.insertBefore(room, row.querySelector('.count'));
  }
  /* The Untagged bucket is not a tag anyone wrote — it is where entries
     with no tags at all show up — so it cannot be filed or deleted. Nor
     can anything by a reader: the ✕ on a category was already kept from
     them, and the one on a tag was left offering to delete a tag from
     every entry on a chart they cannot change. */
  if(tag !== UNTAGGED && !readOnlyView){
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'legend-tag-del';
    del.textContent = '\u2715';
    del.title = count ? `Remove this tag from all ${count} entries carrying it` : 'Delete this unused tag';
    del.addEventListener('click', ev=>{ ev.stopPropagation(); deleteTagEverywhere(tag, count); });
    row.appendChild(del);
  }
  if(tag !== UNTAGGED && !readOnlyView){
    /* Filing a tag is carrying it: pick the row up and drop it on the
       category it belongs to. The dropdown that used to sit here said the
       same thing in the abstract — a list of names, none of which was the
       category you were looking at — and every tag on the panel carried a
       copy of the whole list. */
    row.classList.add('draggable-row');
    row.title = `${displayName} — drag onto a category to file this tag there`;
    row.addEventListener('mousedown', ev=> beginListDrag(ev, 'tag', tag, displayName));
  }
  return row;
}

/* ---- dragging a row out of one list and into another ----------------
 *
 * Two lists on the side tabs are arrangements rather than
 * collections: which category a tag belongs to, and what order the
 * references are in. Both were operated by proxy — a dropdown beside the
 * tag, a pair of arrows beside the reference — and in both cases the thing
 * being changed is a POSITION, which a control that is not the row itself
 * can only describe. So the row is the control: pick it up and put it
 * where it goes.
 *
 * Pointer events rather than the HTML drag-and-drop API. This page is
 * rendered inside a sandboxed frame, and the drag API's behaviour there
 * depends on the host: the drag image, the cursor and whether a drop fires
 * at all vary in ways the rest of the chart's dragging — nodes, connector
 * ends, leader points — does not. One mechanism for every drag on the
 * page is worth more than the API's free drag image.
 */
let listDrag = null;
const LIST_DRAG_THRESHOLD = 4;

function beginListDrag(ev, kind, key, label){
  if(ev.button !== 0 || readOnlyView) return;
  /* Not on a control. A row carries an eye, a delete button, a select —
     pressing one of those is pressing it, not picking the row up. */
  if(ev.target.closest('button, select, input, a')) return;
  ev.preventDefault();
  listDrag = {kind, key, label, startX:ev.clientX, startY:ev.clientY,
              moved:false, ghost:null, target:null, where:null};
}
function listDragGhost(){
  if(listDrag.ghost) return listDrag.ghost;
  const g = document.createElement('div');
  g.className = 'list-drag-ghost';
  g.textContent = listDrag.label;
  document.body.appendChild(g);
  listDrag.ghost = g;
  document.body.classList.add('list-dragging');
  return g;
}
function clearListDragMarks(){
  document.querySelectorAll('.drop-into, .drop-before, .drop-after')
    .forEach(e=> e.classList.remove('drop-into','drop-before','drop-after'));
}
function listDropUnder(x, y){
  const under = document.elementFromPoint(x, y);
  if(!under || !under.closest) return null;
  if(listDrag.kind === 'tag'){
    const grp = under.closest('.legend-group');
    if(!grp) return null;
    /* The uncategorised block IS a place to drop: dropping there is how a
       tag comes back OUT of a category, which nothing offered before. The
       Special group is not — what is in it is there because of what it is,
       not because anybody filed it. */
    if(grp.dataset.cat === UNGROUPED && !grp.classList.contains('legend-loose')) return null;
    return {el: grp, where: 'into'};
  }
  const row = under.closest('.ref-item');
  if(!row || row.dataset.key === listDrag.key) return null;
  const r = row.getBoundingClientRect();
  return {el: row, where: y < r.top + r.height/2 ? 'before' : 'after'};
}
window.addEventListener('mousemove', ev=>{
  if(!listDrag) return;
  if(!listDrag.moved){
    if(Math.hypot(ev.clientX - listDrag.startX, ev.clientY - listDrag.startY) < LIST_DRAG_THRESHOLD) return;
    listDrag.moved = true;
  }
  const g = listDragGhost();
  g.style.left = (ev.clientX + 12) + 'px';
  g.style.top  = (ev.clientY + 12) + 'px';
  clearListDragMarks();
  const hit = listDropUnder(ev.clientX, ev.clientY);
  listDrag.target = hit ? hit.el : null;
  listDrag.where = hit ? hit.where : null;
  if(hit) hit.el.classList.add('drop-' + hit.where);
});
window.addEventListener('mouseup', ()=>{
  const st = listDrag;
  listDrag = null;
  if(!st) return;
  if(st.ghost) st.ghost.remove();
  document.body.classList.remove('list-dragging');
  clearListDragMarks();
  if(!st.moved || !st.target) return;
  if(st.kind === 'tag'){
    const cat = st.target.dataset.cat;
    if(!cat) return;
    if(cat === UNGROUPED){
      if(!st.target.classList.contains('legend-loose')) return;
      applyEdit(()=> assignTagCategory(st.key, ''));
      buildSideTabs();
      setLegendStatus('ok', `“${st.key}” is out of its category.`);
      return;
    }
    applyEdit(()=> assignTagCategory(st.key, cat));
    buildSideTabs();
    setLegendStatus('ok', `“${st.key}” is now under ${cat}.`);
  } else if(st.kind === 'ref'){
    reorderRef(st.key, st.target.dataset.key, st.where);
  }
});

