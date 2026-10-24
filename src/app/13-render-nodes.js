/* The corner badges — the language chips and the link — are TABS standing
   on the entry's top edge, outside it.
 *
   They used to be drawn on the corner, centred on the border, so half of
   each one lay inside the box: and since the box closed to a pixel off its
   words, that half lay over the first and last letters of the top line.
   Standing on the border they cover nothing, and they read as what they
   are, handles on the entry rather than marks in its text. A size down
   from what they were, too: a tab only has to be found, not read across
   the room. LINK_TAB is the link's square, the height of an active chip.
 *
   …and they are tabs in shape as well as in place: see tabOutline. */
const CHIP_TAB_H = 9;
const LINK_TAB = CHIP_TAB_H;
/* The site a link goes to, shown by its own icon in the link's tab rather
   than by the same arrow on every entry — a reader can tell a wiki from a
   shop before pressing it. The icon is asked of a public icon service by
   the site's NAME only (never the whole address), and until it arrives,
   or if it never does, the arrow stays. What each site answered is
   remembered for the page's life, so a redraw neither asks again nor
   flickers between the two. `var`: renderNodes runs before this part's
   `let`s would exist on some paths. */
var SITE_ICON_HOST = 'https://icons.duckduckgo.com/ip3/';
var siteIconState = new Map();       // host -> 'ok' | 'bad'
function siteHost(link){
  const href = safeUrl(link);
  if(!href) return '';
  try{
    const u = new URL(href);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.hostname : '';
  }catch(e){ return ''; }
}
function siteIconInto(g, link, dy){
  const host = siteHost(link);
  if(!host || siteIconState.get(host) === 'bad') return;
  const S = LINK_TAB - 2.2;
  const img = el('image', {class:'node-link-icon', href: SITE_ICON_HOST + encodeURIComponent(host) + '.ico',
    x: -S/2, y: -S/2 + (dy || 0), width: S, height: S, preserveAspectRatio:'xMidYMid meet'}, g);
  if(siteIconState.get(host) === 'ok'){ g.classList.add('has-icon'); return; }
  img.addEventListener('load', ()=>{ siteIconState.set(host, 'ok'); g.classList.add('has-icon'); });
  img.addEventListener('error', ()=>{ siteIconState.set(host, 'bad'); img.remove(); });
}
/* Where the tabs stand: the outer edge of the outermost border line, so a
   ringed or rippled entry's tabs clear all of it. */
function tabBaseOf(n){
  const own = (ringCountOf(n) - 1) * ringStepFor(n);
  const out = borderHalfOf(n);
  /* On a rippled border there is no straight edge to stand on. Stood on
     the crests, a tab floated over every trough beside it with a gap of
     paper under its foot. So it is carried down past the troughs (`sink`)
     and cut off at the ripple (tabMaskFor): it grows out of the wave the
     way it grows out of a straight border, and its top stays where it was. */
  const sink = isWavyBorder(n) ? 2 * POCKET_AMP + NODE_BORDER_W : 0;
  return {y: n.y - own - out + sink, sink, left: n.x - own, right: n.x + n.w + own};
}
/* How far an entry's outermost border reaches past the line it is drawn
   on: half a stroke, half the band of a double border, or the crest of a
   ripple. What stands off a border (a T, an array's frame) measures from
   here, so the gap a reader sees is the gap that was asked for. */
function borderHalfOf(n){
  return isWavyBorder(n) ? POCKET_AMP + NODE_BORDER_W / 2
       : borderStyleOf(n) === 'double' ? DOUBLE_BAND_W / 2
       : NODE_BORDER_W / 2;
}
/* How far an entry's tabs stand above its border's outer edge, or 0 when
   it has none: the same conditions the drawing below asks (language chips
   on anything but a portrait or a free element, a link's tab on anything
   but a free element), and the active chip's height, which is the link
   tab's too, with half the tabs' outline, which is the border's weight. */
function tabReachOf(n){
  const shape = n.shape || 'rect';
  if(isFreeShape(shape) || shape === 'array') return 0;
  if(shape === 'link' || shape === 'split') return 0;
  const chips = !!n.multiLang && shape !== 'ellipse';
  const link = !!(n.link && safeUrl(n.link));
  return chips || link ? CHIP_TAB_H + NODE_BORDER_W / 2 : 0;
}
/* The cut for those tabs: everything outside the outermost ripple, its
   stroke included, so a tab stops where the drawn border begins. */
function tabMaskFor(n, h){
  if(!isWavyBorder(n)) return null;
  const grow = (ringCountOf(n) - 1) * ringStepFor(n);
  const id = defId('tabmask-', n.id);
  // Asked for by the chips and by the link; one mask, made afresh each time.
  const was = document.getElementById(id);
  if(was) was.remove();
  const m = el('mask', {id, maskUnits:'userSpaceOnUse', x: n.x - grow - 60, y: n.y - grow - 60,
                        width: n.w + grow*2 + 120, height: h + grow*2 + 120}, nodeDefs);
  el('rect', {x: n.x - grow - 60, y: n.y - grow - 60, width: n.w + grow*2 + 120,
              height: h + grow*2 + 120, fill:'#fff'}, m);
  el('path', {d: wavyRectPath(n.x - grow, n.y - grow, n.w + grow*2, h + grow*2, grow),
              fill:'#000', stroke:'#000', 'stroke-width': NODE_BORDER_W}, m);
  return `url(#${id})`;
}
/* A tab's outline: rounded at the top, square and OPEN at the foot, so it
   reads as grown out of the border it stands on — a folder's tab, which
   is what the owner drew — rather than a chip laid down beside it. The
   fill closes the shape by itself; the stroke runs up one side, over the
   top and down the other, and leaves the foot to the border. Centred on
   its own middle, like the rect it replaces. */
function tabOutline(w, h, r){
  const x0 = -w/2, x1 = w/2, y0 = -h/2, y1 = h/2;
  const k = Math.max(0, Math.min(r, w/2, h));
  return `M${x0},${y1} L${x0},${y0 + k} Q${x0},${y0} ${x0 + k},${y0} ` +
         `L${x1 - k},${y0} Q${x1},${y0} ${x1},${y0 + k} L${x1},${y1}`;
}
/* How far a tab's foot is sunk into the border. None: a tab stands ON the
   border's outer edge and its own outline never crosses into the border's
   line — sunk even half a pixel, the two strokes overlapped and the
   border read as thicker under every tab. */
const TAB_SINK = 0;
/* The colour a tab is drawn in: the border it stands on, which is the
   outermost ring. A tab is a part of the entry's edge, and grey or the
   page's accent on a blue entry made it read as something laid on top. */
function tabInkOf(ringColors){
  return (ringColors && ringColors.length) ? ringColors[ringColors.length - 1] : null;
}
/* A resize grip is a dot on the corner: this big to see, and this far out
   to catch the hand — see the grips below for why it is not a square. */
const RESIZE_DOT_R = 1.9, RESIZE_DOT_HIT = 3.6;
/* The card whose PICTURE is being edited, if any.
 *
 * A card is two things in one box — words and a picture — and a double
 * click has to mean one of them. On the words it opens the text where the
 * text is; on the picture it opens the picture, which means showing the
 * picture's own corners and letting them be pulled. Nothing else about the
 * entry changes while this is open, and a click anywhere else closes it. */
let cardImgEditId = null;
function cardImageEditable(n){
  return !!(n && n.card && n.image && !readOnlyView);
}
function repaintAfterCardImageEdit(){
  renderNodes();
  redrawEdges();
  applyVisibility();
  if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
  paintMultiSelection();
}
function openCardImageEdit(id){
  const n = nodes.get(id);
  if(!cardImageEditable(n)) return false;
  if(cardImgEditId === id) return true;
  cardImgEditId = id;
  repaintAfterCardImageEdit();
  return true;
}
function closeCardImageEdit(){
  if(!cardImgEditId) return;
  cardImgEditId = null;
  repaintAfterCardImageEdit();
}
/* Whether a point is over a card's picture band — which is what decides
   what a double click on a card means. */
function overCardPicture(n, px, py){
  if(!cardImageEditable(n)) return false;
  const band = n.cardTop || 0;
  return band > 0.5 && py >= n.y && py <= n.y + band && px >= n.x && px <= n.x + n.w;
}
/* How tall a picture is for its width, remembered per source.
 *
 * A card's picture band is drawn synchronously, and the one thing that
 * decides its depth — the picture's own proportions — is not known until
 * the browser has decoded the picture. So the first draw uses the default
 * band and a probe is sent off; when it answers, the ratio is remembered
 * and the chart is drawn again. One extra draw per NEW picture, never per
 * render: a source that has been asked about is never asked again, and a
 * source that fails to load answers 0 and is left alone thereafter. */
const imgAspects = new Map();
function imageAspect(src){
  if(!src) return 0;
  if(imgAspects.has(src)) return imgAspects.get(src);
  imgAspects.set(src, 0);
  try{
    const probe = new Image();
    probe.onload = ()=>{
      const r = (probe.naturalWidth && probe.naturalHeight)
        ? probe.naturalHeight / probe.naturalWidth : 0;
      if(!r || imgAspects.get(src) === r) return;
      imgAspects.set(src, r);
      requestAnimationFrame(()=>{ try{ rebuildChart(); }catch(e){} });
    };
    probe.onerror = ()=>{};
    probe.src = src;
  }catch(e){}
  return 0;
}
/* Stands an entry's drawing on its side: everything drawn for it so far —
   the entry's own group, its scenery and its ground — turned about the
   middle of the upright box it was drawn in (x, y and w, h on n).
 *
   Inside the entry's group each piece takes the turn on ITSELF and stays
   where it was, a direct child of the group. A wrapper group would have
   been one line, and it broke the stylesheet: the box, the portrait's
   circle and the hover pad are all styled as `.node > rect` and the like,
   so one level deeper they lost their fill and stroke and the turned
   entry came out in other colours, a portrait with a white ring.
 *
   The scenery is carried during a drag by a translate on its group, and
   its pieces animate their own transforms, so there the turn goes on a
   group in between, where neither reaches it. The ground's pieces are
   carried one by one, each by its own transform, so a piece keeps its
   turn in data-rot-transform and the carry writes it back after the
   translate — the way a caption's turn is kept on its group. */
function turnDrawing(n, g, turn, w, h){
  const midX = n.x + w/2, midY = n.y + h/2;
  const spin = `rotate(${turn},${midX.toFixed(2)},${midY.toFixed(2)})`;
  [...g.children].forEach(piece=>{
    if(piece.tagName === 'title') return;
    const own = piece.getAttribute('transform');
    piece.setAttribute('transform', own ? `${spin} ${own}` : spin);
    piece.classList.add('turned-piece');
  });
  auraLayer.querySelectorAll(`.node-aura[data-id="${CSS.escape(n.id)}"]`).forEach(a=>{
    const kids = [...a.childNodes];
    const wrap = el('g', {class:'node-turned', transform:spin}, a);
    kids.forEach(k=> wrap.appendChild(k));
  });
  const ground = fanLayer.querySelector(`[data-ground="${CSS.escape(n.id)}"]`);
  if(ground){
    // The ground is drawn from the box's top-left, so its middle is local.
    const local = `rotate(${turn},${(w/2).toFixed(2)},${(h/2).toFixed(2)})`;
    [...ground.children].forEach(piece=>{
      piece.dataset.rotTransform = local;
      piece.setAttribute('transform', local);
    });
  }
}
/* What builds each entry's controls, waiting for the first thing that can
   reach them — see the long note in renderNodes. Keyed by id; a redraw
   starts the map again, since what it holds draws into the old boxes. */
const nodeControlsWanted = new Map();
function nodeControlsOn(id){
  const build = id != null && nodeControlsWanted.get(id);
  if(!build) return;
  nodeControlsWanted.delete(id);
  build();
}
/* One listener for the whole chart. pointerover rather than mouseenter,
   because a finger and a pen arrive by it too, and it comes ahead of the
   touchstart and mousedown that might need what it builds. */
let nodeUnderPointer = null;
svg.addEventListener('pointerover', ev=>{
  const g = ev.target && ev.target.closest && ev.target.closest('.node');
  nodeUnderPointer = g ? g.dataset.id : null;
  if(g) nodeControlsOn(g.dataset.id);
});
/* The drawing the site was published with (tools/prerender.js), shown
   while the program was still on its way. It goes the moment this draws
   its own — in the same task, so no frame shows neither, and none shows
   both. */
function dropPrerendered(){
  const pre = document.getElementById('prerendered');
  if(pre) pre.remove();
}
/* An entry drawn exactly as it was last time keeps the drawing it had.
 *
 * Every pass draws every entry, and every entry it draws is new to the
 * browser, which has to style it and lay its text out again before the
 * next paint: on a 600-entry chart that was over half of what an edit
 * cost, for an edit that changed one entry. So each entry is still drawn
 * — everything that drawing works out about the entry is worked out as
 * before — but then its drawing is compared, as markup, with the one it
 * had; where nothing differs, the new one is thrown away before the
 * browser has looked at it and the old one, already laid out, stays.
 *
 * Compared as markup rather than by what went into it: what goes into an
 * entry's drawing is spread across the whole program, and the markup is
 * the one thing that cannot leave anything out. The ids a drawing gives
 * its own gradients and clips are counted afresh every pass, so they are
 * compared by where they are used, not by their numbers. */
var drawnEntries = new Map();      // id -> {sig, pieces, attrs, ids}
var wantedBeforePass = new Map();
const ENTRY_LAYERS = ()=> [nodeDefs, nodeLayer, backLayer, frontLayer, fanLayer, auraLayer];
function drawingSig(pieces){
  /* The grips and strips an entry builds when the pointer first reaches it
     (nodeControlsOn) are not part of its drawing: read as the empty group
     they are drawn as. */
  /* …and which layer a piece is in is part of it: an entry sent behind
     the connectors is the same markup in another place. */
  const layers = ENTRY_LAYERS();
  let text = pieces.map(p=>{
    const c = p.querySelector(':scope > .node-controls');
    return layers.indexOf(p.parentNode) + ':' +
      (c && c.firstChild ? p.outerHTML.replace(c.outerHTML, '<g class="node-controls"></g>') : p.outerHTML);
  }).join('\u0002');
  const ids = [];
  pieces.forEach(p=>{
    if(p.id) ids.push(p.id);
    p.querySelectorAll('[id]').forEach(e=> ids.push(e.id));
  });
  ids.sort((a, b)=> b.length - a.length)
     .forEach((id, i)=>{ text = text.split(id).join('\u0001' + i + '\u0001'); });
  return text;
}
function drawOrKeep(n, kept, draw){
  const old = kept.get(n.id);
  const layers = ENTRY_LAYERS();
  const marks = layers.map(L=> L.lastChild);
  /* Only a drawing nothing has touched since. Its own attributes go back
     to how they were drawn — being picked, hovered or carried is put on
     again after every pass — and if anything inside it was changed as
     well, it is drawn afresh like any other. */
  const intact = old && old.pieces.every(p=> p.isConnected) && (()=>{
    old.pieces.forEach((p, i)=> ['class', 'style', 'transform'].forEach((a, k)=>{
      const v = old.attrs[i][k];
      if(v === null){ if(p.hasAttribute(a)) p.removeAttribute(a); }
      else if(p.getAttribute(a) !== v) p.setAttribute(a, v);
    }));
    return drawingSig(old.pieces) === old.sig;
  })();
  /* The old drawing is out of sight of anything that looks an entry up by
     its id while the new one is drawn — renamed, not unnamed, so the
     attribute keeps its place and the markup stays what it was. */
  if(old) old.pieces.forEach((p, i)=>{ if(old.ids[i] !== null) p.setAttribute('data-id', '\u0000'); });
  draw(n);
  if(old) old.pieces.forEach((p, i)=>{ if(old.ids[i] !== null) p.setAttribute('data-id', old.ids[i]); });
  const pieces = [];
  layers.forEach((L, i)=>{
    for(let e = marks[i] ? marks[i].nextSibling : L.firstChild; e; e = e.nextSibling) pieces.push(e);
  });
  const sig = drawingSig(pieces);
  if(intact && old.sig === sig){
    pieces.forEach(p=> p.remove());
    nodeControlsWanted.delete(n.id);
    if(wantedBeforePass.has(n.id)) nodeControlsWanted.set(n.id, wantedBeforePass.get(n.id));
    drawnEntries.set(n.id, old);
    return;
  }
  drawnEntries.set(n.id, {sig, pieces,
    ids: pieces.map(p=> p.getAttribute('data-id')),
    attrs: pieces.map(p=> [p.getAttribute('class'), p.getAttribute('style'), p.getAttribute('transform')])});
}
/* Everything in the entries' layers that no entry now owns goes, and what
   is left is put in the order this pass drew it. The new drawings were
   appended after the kept ones, so it is they that move, before the
   browser has laid them out; a kept one moves only if the order of the
   entries themselves changed. */
function settleEntryLayers(){
  const owned = new Map(ENTRY_LAYERS().map(L=> [L, []]));
  drawnEntries.forEach(rec=> rec.pieces.forEach(p=>{ const list = owned.get(p.parentNode); if(list) list.push(p); }));
  owned.forEach((list, L)=>{
    const keep = new Set(list);
    for(let e = L.firstChild; e;){ const next = e.nextSibling; if(!keep.has(e)) L.removeChild(e); e = next; }
    let cur = L.firstChild;
    list.forEach(p=>{ if(p === cur) cur = cur.nextSibling; else L.insertBefore(p, cur); });
  });
}
function renderNodes(opts){
/* `arraysOnly` draws the arrays again and nothing else: a drag moves the
   entries themselves by a transform, and only the frames round them have
   to be worked out afresh (see refitArraysForDrag). Their own patterns
   and gradients go with them, and nobody else's. */
const arraysOnly = !!(opts && opts.arraysOnly);
if(arraysOnly){
  nodeDefs.querySelectorAll('[data-array-def]').forEach(d=> d.remove());
} else {
  dropPrerendered();
  /* What the last pass drew stays where it is until this one has drawn
     the same entries again and compared (see drawOrKeep). */
  wantedBeforePass = new Map(nodeControlsWanted);
  nodeControlsWanted.clear();
}
while(arrayLayer.firstChild) arrayLayer.removeChild(arrayLayer.firstChild);
/* Drawn in stacking order rather than in the order the entries happen to be
   listed, so "send to back" and "bring to front" mean something. Anything
   sent behind the connectors is drawn into a layer of its own that sits
   under the arrows — that's what makes a backdrop image work as a backdrop
   rather than as a lid over the whole chart. */
const drawOne = (n)=>{
  /* The entry as the chart has it NOW, for whatever answers a press later.
     A drawing may outlive the pass that drew it (drawOrKeep), and the `n`
     it was drawn from with it; the model is rebuilt every pass. */
  const liveN = ()=> nodes.get(n.id) || n;
  const shape = n.shape || 'rect';
  const isBio = shape==='ellipse';
  /* A link node is drawn as a portrait's circle is, and is nothing else a
     portrait is: no picture, no card, no words — see isLinkNode. */
  const isLinkNode = shape==='link';
  /* A split is the same circle again, smaller, and filled with its colour:
     a dot on the line, which is what it is — see isSplitNode. */
  const isSplit = shape==='split';
  const isRound = isBio || isLinkNode || isSplit;
  const isImage = shape==='image';
  const isTextbox = shape==='textbox';
  // A multiversal hub is an ordinary entry that something radiates out of,
  // drawn as the usual box with echo rings spreading from it. A local
  // multiverse is a stack of boxes — several near-identical worlds — with
  // only the front one belonging to the chart's geometry.
  /* Read off the entry's TAGS, not its shape. Free-standing elements — a
     picture, a bare line of text — are not entries and take no scenery. */
  /* A portrait takes none of it either. An echo spreading out of a face
     and a stack of near-identical worlds behind one are both saying
     something about a REALITY; on a character they say nothing, and the
     rectangles they are drawn as do not even follow the circle. */
  const isArray = shape==='array';
  const isHub = !isFreeShape(shape) && !isRound && !isArray && nodeHasTag(n, HUB_TAG);
  const isLocal = !isFreeShape(shape) && !isRound && !isArray && nodeHasTag(n, LOCAL_TAG);
  /* A merge's entry, wearing its lineages' colours (see mergePainted). It
     is an ordinary box in every other way: the amalgam archetype it used
     to be is gone. */
  const isAmalgam = mergePainted(n);
  /* A comment card. Drawn by the default branch — a rounded box, one ring
     per colour — so its ports, its edge handles and everything a connector
     does with it are literally the same code. Only the stylesheet knows it
     is a callout, which is all the difference there should be. */
  const isCallout = shape==='callout';
  // Free-standing elements: they sit on the chart but are not part of its
  // lineage — no connector edges, no ports, no link badge, no language tabs.
  const isFree = isImage || isTextbox;
  // Only a boxed entry can be divided into bands.
  const isCard = !!n.card && !isRound && !isFree;
  /* Which of the six ways this entry's border is drawn, and whether that
     is the rippled one — the old pocket-reality edge, now a style any
     entry may wear. */
  const borderKey = borderStyleOf(n);
  const borderDash = (BORDER_STYLES[borderKey] || BORDER_STYLES.solid).dash;
  const isWavy = isWavyBorder(n);
  /* And whether its corners are rounded or square. Every radius below goes
     through `rad`, so the outline, its rings, a card's clip and the
     scenery copied from the outline all agree on which it is. */
  const square = hasSquareCorners(n);
  const rad = (r)=> square ? 0 : Math.max(0, r);
  const z = n.z || 0;
  const g = el('g',{class:'node', 'data-id':n.id},
                 isArray ? arrayLayer : z < 0 ? backLayer : z > 0 ? frontLayer : nodeLayer);
  /* Behind every array drawn before it: those are the ones inside it. */
  if(isArray){ g.classList.add('node-array'); arrayLayer.insertBefore(g, arrayLayer.firstChild); }
  if(isBio) g.classList.add('node-bio');
  /* Dressed as a portrait's circle is — the stylesheet's circle rules are
     all written for that class — and known apart by its own. */
  if(isLinkNode) g.classList.add('node-bio', 'node-link-node');
  if(isSplit) g.classList.add('node-bio', 'node-split');
  if(isCallout) g.classList.add('node-callout');
  /* A drafting leader: the words stand on a shelf, with no card round
     them — see drawCalloutLeaders, which draws the shelf with the line. */
  if(isCallout && n.leader && n.leader.shelf) g.classList.add('callout-shelf');
  if(isFree) g.classList.add('node-free');
  if(isImage) g.classList.add('node-image');
  if(isTextbox) g.classList.add('node-textbox');
  if(isCard) g.classList.add('node-card');
  /* One image to a screen reader, named in words (spokenNameOf): what is
     drawn inside is text in pieces, stickers and grips. A frame or a bare
     picture says nothing the list of entries does not (41-text-view.js). */
  if(isArray || isImage) g.setAttribute('aria-hidden', 'true');
  else { g.setAttribute('role', 'img'); g.setAttribute('aria-label', spokenNameOf(n)); }
  const fontFamily = fontFamilyFor(n.font);
  /* A callout and a connector's plate are two forms of the same remark, so
     they are set the same: the plate's size, in the plate's face, wrapping
     at the plate's width. Left at an entry's own size a callout came out
     half again as large as the note beside it on the same connector, and
     the pair read as two different kinds of thing. */
  const isCalloutShape = (n.shape || '') === 'callout';
  const fontSize = (n.fontSize && n.fontSize>=6 && n.fontSize<=28) ? n.fontSize
                 : (isCalloutShape ? EDGE_NOTE_FS : NODE_FS);
  const fontScale = fontSize / NODE_FS;
  const lineH = LINE_H * fontScale;
  n.chipLeft = null; n.chipRight = null;
  let chipGroup = null, linkWrap = null;
  /* The chip row belongs to the SETTING, not to the tabs: switching
     multi-language on shows the default text's own chip straight away, so
     the row is visibly there to add tabs to rather than appearing out of
     nowhere with the second language. */
  const langTabList = (n.multiLang && Array.isArray(n.langTabs)) ? n.langTabs : [];
  const hasLangTabs = !!n.multiLang;
  const allTexts = hasLangTabs ? [n.label, ...langTabList.map(t=>t.text)] : [n.label];

  /* Size follows the text. A short label gets a small box and a long one a
     wide box, instead of every entry being stamped out at the same fixed
     width with empty space around most of them — which is both tidier and
     a lot less chart to draw. The width is the narrowest that keeps the
     longest of the node's texts within MAX_LINES lines, found by measuring
     rather than guessing, then clamped between MINW and MAXW; the height
     then follows from how that text actually wraps.

     opts.size overrules all of it: a node dragged by its corner keeps
     exactly the size it was given. */
  /* An entry turned a quarter is laid out and drawn as though it were not,
     and then the whole drawing is stood on its side about its middle. The
     box the chart reasons with is the TURNED one, so its ports, its grips,
     its badges and every connector meet the entry as it is drawn. A size
     set by hand is the size of the turned box, so it is turned back for
     the layout; see turnDrawing below for the rest. */
  const turn = quarterTurnOf(n);
  const turned = turn === 90 || turn === 270;
  const manual = (turned && n.size) ? {w: n.size.h, h: n.size.w} : n.size;
  /* An entry's text is NEVER folded by the measurer.
   *
     Where the author typed a break, the text breaks; nowhere else. The box
     widens to hold the longest line it is given, up to the width a box is
     allowed to reach, and past that the text is clipped at the border —
     the bargain a spreadsheet cell makes.
   *
     This used to hold only for a text with no breaks in it at all: one
     Shift+Enter anywhere turned wrapping back on for every line of that
     entry, so adding a second line silently re-folded the first at
     whatever character the box happened to end on. Wrapping belongs to
     prose, and the one thing on this chart that is prose is a comment
     card, which keeps it. */
  const noWrap = !isCalloutShape;
  /* A portrait is a circle, so its two sides are one number: whichever of
     a hand-set width and height is smaller, which is what a corner drag
     naturally produces. */
  const bioSide = isBio
    ? (manual ? Math.max(BIO_MIN_SIZE, Math.round((manual.w + manual.h) / 2)) : BIO_SIZE)
    : isLinkNode ? LINK_NODE_SIZE
    : isSplit ? SPLIT_SIZE
    : 0;
  let w = isRound ? bioSide
        : isImage ? (manual ? manual.w : IMAGE_DEFAULT_W)
        // A loose text block is a caption, not a boxed entry: it wants to
        // run on one line and can be much wider than a chart node before
        // it wraps. Drag its corner to overrule that.
        : isTextbox ? (manual ? manual.w : autoNodeWidth(allTexts, fontSize, fontFamily, 1, TEXTBOX_MAXW))
        // A card needs room for a picture as well as words, so it starts
        // wider than a plain entry and is allowed to grow further.
        : isCard ? (manual ? manual.w : Math.max(CARD_MINW,
                      autoNodeWidth(allTexts, fontSize, fontFamily, 2, CARD_MAXW)))
        /* A one-line label starts at the widest a box may become and is
           then closed onto its own ink a few lines down, so it comes out
           exactly as wide as the words in it — or, past that width, stays
           at the ceiling with the text clipped at the border. */
        /* …and a callout wraps where the plate wraps, rather than running
           on to an entry's full width. */
        : isCalloutShape ? (manual ? manual.w
            : Math.min(EDGE_NOTE_MAXW, autoNodeWidth(allTexts, fontSize, fontFamily, 4, EDGE_NOTE_MAXW)))
        : (manual ? manual.w : noWrap ? NODE_LINE_MAXW : autoNodeWidth(allTexts, fontSize, fontFamily));
  // Re-centre in the layout slot, unless this node was placed by hand — a
  // hand-placed node's x IS the answer and must not drift.
  if(!n.pos && typeof n.slotX === 'number'){
    n.x = n.slotX + (n.slotW - w)/2;
  }
  n.w = w;
  /* How much of each side the border takes before the words may start —
     the same for every border style.
   *
     A rippled border used to take two and a half pixels more, on the
     grounds that the wave swings inward and the longest line ran into it.
     That was true of an older, deeper ripple; this one reaches 1.5 inside
     the box and its stroke 0.8 further, which leaves the ordinary padding
     nearly five pixels of paper. What the extra did do was make an entry
     WIDER the moment its border was set to wavy, so changing how an edge
     is drawn moved the entry and everything routed round it. A border
     style is a look; it does not get to change the size. */
  /* …and it no longer is the same for every style: see textInsetFor. A
     card keeps the old padding, because its heading shares the box with
     a picture and the bands under it, and a pixel off a rule that divides
     a card is not a margin anyone would want. */
  /* …and a caption closes on its words exactly as an entry does: the
     frame it shows when pointed at stands the same pixel off them. */
  /* A card that is a heading and nothing else (see below) is drawn the
     way an entry is, so it closes on its words the way an entry does. */
  const cardBare = isCard && !n.image && !drawsOnChart(n.note || '') && !drawsOnChart(n.medium || '');
  const closesOnInk = !isRound && !isImage && (!isCard || cardBare);
  const inkPad = closesOnInk ? textInsetFor(n) : NODE_PAD_X;
  /* The corner every radius on the entry is measured from: see
     inkCornerR. A card and a picture keep the old one. */
  const cornerR = closesOnInk ? inkCornerR(n) : 5;
  const maxChars = noWrap ? Infinity : Math.max(8, Math.round((w - inkPad*2) / (fontSize*0.55)));
  // Hard pixel ceiling for a line of this node's text, so no script's
  // glyph widths can push a label past the border (see wrapLabel's `fit`).
  const fit = { maxWidth: w - inkPad*2, fontSize, family: fontFamily, noWrap };
  // Height is sized to fit the TALLEST of every text this node can show
  // (main label + every language tab) so switching tabs never needs a
  // relayout of the rest of the chart — only whichever text is showing
  // is re-centered within that fixed area.
  /* The ink every one of this entry's texts actually makes — the main
     label and every language tab, so switching tabs never resizes the box
     and re-lays the chart around it. Measured, not counted: see
     measureTextBlock. */
  const blocks = allTexts.map(t=>
    measureTextBlock(t, maxChars, lineH, fontScale,
                     {fontSize, family: fontFamily}, fit));
  const maxTotalH = Math.max(...blocks.map(bq=> bq.height));
  const maxInkW = Math.max(...blocks.map(bq=> bq.width));
  /* And the box closes on it.
   *
     The width above is the one the text was WRAPPED at — the narrowest
     that holds it in the allowed number of lines. The widest line it
     actually produced is usually narrower than that, and the difference
     was left as padding nobody chose. Shrinking to the ink cannot change
     the wrap, since every line already fits inside the widest of them. */
  /* A box with nothing written in it — an entry, a remark pinned to a line
     or standing on its own, a caption — is one grid step square: the
     smallest box the chart holds words in (see GRID). It makes no ink, so
     there is nothing to close on; a one-line entry starts out at the widest
     a box may become, which is how an empty box once came out three
     hundred pixels across, and the floor that cured that made an empty
     entry eight times the size of an empty remark. Every empty box is the
     same size now, and sits on the grid exactly. */
  const emptyBox = closesOnInk && !manual && !(maxInkW > 0);
  if(!manual && closesOnInk){
    /* With ink it is exactly the ink and the inset, not rounded up to a
       whole pixel and not held up by a floor: rounding put up to a pixel
       of slack on one side, and the floor turned a short word's pixel of
       margin back into twenty. */
    n.w = w = emptyBox ? GRID : Math.min(w, round2(maxInkW + inkPad*2));
    if(!n.pos && typeof n.slotX === 'number') n.x = n.slotX + (n.slotW - w)/2;
  }
  /* A card closes on its ink too, but by GROWING to it rather than only
     shrinking: its width starts at the card minimum and the heading is
     never folded, so without this a long heading was clipped in a box
     that had room to spare on the chart. Between the card's own two
     bounds, and no further. */
  /* …and the minimum is for a card that has something besides its
     heading to hold. A card that is a heading and nothing else used to be
     widened to the minimum all the same, and deepened to a band of its
     own, so turning an entry into a card made it nearly twice the size
     while showing exactly the same words: the layout is a way of drawing
     what an entry has, and adds no room for what it has not. */
  if(isCard && !manual){
    if(cardBare) n.w = w = maxInkW > 0 ? Math.min(CARD_MAXW, round2(maxInkW + inkPad*2)) : GRID;
    else {
      const want = maxInkW > 0 ? Math.ceil(maxInkW) + inkPad*2 : CARD_MINW;
      n.w = w = Math.max(CARD_MINW, Math.min(CARD_MAXW, want));
    }
  }
  /* Whether what is about to be drawn is wider than what will hold it.
     Only then is the text clipped — a clip path on every entry would cost
     the chart a few hundred of them for nothing, and would quietly shave
     the overhang off any glyph that legitimately leans past its advance. */
  const clipText = maxInkW > (w - inkPad*2) + 0.5;
  // A bio circle is a fixed size that owes nothing to its text — the text
  // isn't drawn in it at all.
  /* A card's height is its bands added up: the picture, the heading as it
     wraps, and the note as it wraps at the smaller body size. With no note
     there is no third band and the card is simply shorter — and with no
     PICTURE there is no first band either. A card is a stack of the parts
     it actually has; an empty frame reserving a third of the box for a
     picture nobody chose is scenery standing in for content. */
  const cardBodyFS = fontSize * CARD_BODY_SCALE;
  const cardBodyScale = cardBodyFS / NODE_FS;
  const cardBodyLineH = LINE_H * cardBodyScale;
  const cardBody = isCard && drawsOnChart(n.note || '') ? String(n.note).trim() : '';
  const cardBodyFit = { maxWidth: w - 14, fontSize: cardBodyFS, family: fontFamily };
  const cardBodyChars = Math.max(8, Math.round((w - 14) / (cardBodyFS*0.55)));
  const cardHeadH = !isCard ? 0
    : cardBare ? (maxInkW > 0 ? round2(maxTotalH + inkPad*2) : GRID)
    : Math.max(22, CARD_PAD_Y + maxTotalH);
  /* The picture band, which a card without a picture does not have — and
     which is as deep as the picture needs rather than a fixed slab. A
     fixed band can only be honoured by cropping, and cropping a picture
     nobody asked to crop is how a wide one arrived with both ends gone.
     The picture's own proportions set the depth; a depth set by hand
     overrides them; and a card asked to CROP keeps the old fixed band,
     because that is what cropping is for. */
  const cardImgH = (isCard && n.image)
    ? (n.cardImgH != null ? n.cardImgH
       : n.cardCrop ? CARD_IMG_H
       : (()=>{ const r = imageAspect(n.image);
                return r ? Math.max(CARD_IMG_MINH, Math.min(CARD_IMG_MAXH, Math.round(w * r)))
                         : CARD_IMG_H; })())
    : 0;
  const cardBodyH = cardBody
    ? CARD_PAD_Y + wrapAndMeasure(cardBody, cardBodyChars, cardBodyLineH, cardBodyScale, cardBodyFit).totalH
    : 0;
  /* The middle band, between the heading and the note. */
  const cardMedFS = fontSize * CARD_MEDIUM_SCALE;
  const cardMedScale = cardMedFS / NODE_FS;
  const cardMedLineH = LINE_H * cardMedScale;
  const cardMedium = isCard && drawsOnChart(n.medium || '') ? String(n.medium).trim() : '';
  const cardMedFit = { maxWidth: w - 14, fontSize: cardMedFS, family: fontFamily };
  const cardMedChars = Math.max(8, Math.round((w - 14) / (cardMedFS*0.55)));
  const cardMedH = cardMedium
    ? CARD_PAD_Y + wrapAndMeasure(cardMedium, cardMedChars, cardMedLineH, cardMedScale, cardMedFit).totalH
    : 0;
  /* The smallest box this entry may be made by hand: the one it closes to
     by itself, its words a pixel inside the border — never past the widest
     box it would allow itself, where it clips instead. A corner dragged
     inward stops here (see beginNodeResize); without it a box could be
     pulled down until its words stood across the border. Worked out for
     the box as laid out, upright, and turned with it below. A wrapping
     callout's floor follows the width it is being given, which is why it
     is read again after every step of a resize. */
  const inkW = maxInkW > 0 ? maxInkW + inkPad*2 : 0;
  const minUpright = (isRound || isImage) ? null
    : isCard ? {w: Math.max(GRID, Math.min(CARD_MAXW, Math.ceil(inkW))),
                h: Math.max(GRID, cardHeadH + cardMedH + cardBodyH)}
    : !(maxInkW > 0) ? {w: GRID, h: GRID}
    : {w: round2(Math.min(inkW, isTextbox ? TEXTBOX_MAXW : noWrap ? NODE_LINE_MAXW : inkW)),
       h: round2(maxTotalH + inkPad*2)};
  n.minSize = !minUpright ? null
    : turned ? {w: minUpright.h, h: minUpright.w} : minUpright;
  /* …and a size set by hand never holds the box below it either: words
     typed into a box sized by hand grow it, rather than run across its
     border. */
  if(manual && minUpright && w < minUpright.w){ n.w = w = minUpright.w; }

  let h = isRound ? bioSide
          : isImage ? (manual ? manual.h : IMAGE_DEFAULT_H)
          : emptyBox ? GRID
          : isCard ? (manual ? manual.h : cardImgH + cardHeadH + cardMedH + cardBodyH)
          : manual ? manual.h
          : closesOnInk ? round2(maxTotalH + inkPad*2)
          : Math.max(NODE_FIT_MINH, Math.ceil(maxTotalH) + NODE_PAD_Y*2);
  if(manual && minUpright && h < minUpright.h) h = minUpright.h;
  /* Placed as the turned box — where it stands is decided by the shape
     the reader sees, which is also how a turned entry has always been
     saved. Drawn upright below, at the same middle. */
  if(turned){ [w, h] = [h, w]; n.w = w; }
  n.h = h;
  /* A hand-placed entry grows about its MIDDLE, not downward from its top.
   *
   * The stored position is the entry's top-left, so a box that got taller —
   * one more line of text — kept its top and pushed its bottom down, moving
   * its centre with it. A connector meeting the middle of its side then
   * shifted too, and a line that had been laid out straight developed a jog
   * for no reason the reader could see.
   *
   * The position is therefore read as the top of a DEFAULT-height box, and
   * the real box is centred on that one. An entry at the default height is
   * unmoved, which is nearly all of them; a taller one spreads evenly
   * either side of where it was placed and its ports stay put. */
  /* The offset is RECORDED, because saving a dropped position has to undo
     it. opts.pos is the top of the default-height box; n.y is the top of
     the real one. A drag reads n.y and wrote it straight back as pos, so
     every drop shifted the entry up by this much again — and a resized
     entry, which takes no offset at all, was the one case that behaved.
     See saveNodePositions, which adds it back. */
  n.growShift = 0;
  n.growShiftX = 0;
  if(n.pos && !manual && !isRound && !isImage){
    /* Quantised to whole grid steps.
     *
     * Half the extra height is almost never a round number — a
     * default-height entry is 41px tall, not 40 — so every entry on the
     * chart was drawn at some fraction of a step above where it was
     * placed, and each at a DIFFERENT fraction, since the offset follows
     * the entry's own height. The ruled grid was drawn at whole steps, as
     * it should be, and nothing on the chart lined up with it.
     *
     * Rounding the offset keeps the entry on the grid its position was
     * snapped to, and keeps growth centred to within half a step, which is
     * what the rule was for: an entry that gains a line spreads either
     * side of where it sits instead of dropping its bottom edge. An entry
     * placed off the grid on purpose (Ctrl) keeps its own offset — the
     * shift is rounded, not the position. */
    /* Only GROWTH is spread either side of the stored position. A box that
       came out shorter than the reference keeps its top-left where it was
       put — a negative offset would have slid every entry on every
       existing chart downward the day the boxes learned to hug their
       text. */
    /* A box closed on its words is centred on the reference box, shorter
       or taller. Once the border stands a pixel off the ink, a one-line
       entry is well under the reference height, and keeping its top where
       it was put would have lifted the middle of every entry on the chart
       by a few pixels and a two-line one by none — so two entries placed
       level, one with a second line, would no longer be. Centring keeps
       every middle where it was, which is where connectors meet a box. */
    n.growShift = closesOnInk ? round2((h - NODE_GROW_REF) / 2)
                              : snapToGrid(Math.max(0, h - NODE_GROW_REF) / 2);
    n.y = n.pos.y - n.growShift;
    /* And sideways, by what the border takes beyond a plain one.
     *
       Height was already spread either side of the stored position, but
       the stored x is the box's left edge, so a border that takes more
       room — a ripple, a double rule — added all of its extra width on
       the right: switching an entry to wavy grew it from its top-left
       corner and moved its middle, and every connector meeting it, by a
       pixel and a half. The position is now the left edge of the box as a
       PLAIN border would draw it, and the border's own extra is taken off
       both sides. Only the border's share: words that get longer still
       grow the box to the right, from where it was put, as they always
       have. Recorded for the same reason growShift is — every save turns
       a drawn x back into a stored one by adding it. */
    if(closesOnInk && !isTextbox){
      n.growShiftX = round2(borderReachIn(n) - NODE_BORDER_W / 2);
      n.x = n.pos.x - n.growShiftX;
    }
  }
  /* The box the chart keeps, and the upright one everything below is
     drawn in: the same middle, the sides the other way round. */
  const turnedBox = turned ? {x: n.x, y: n.y, w, h} : null;
  if(turned){
    const midX = n.x + w/2, midY = n.y + h/2;
    [w, h] = [h, w];
    n.w = w; n.h = h;
    n.x = midX - w/2; n.y = midY - h/2;
  }
  /* Where the rules across the card fall, once its height is settled.
     The picture's rule is only there when there is a picture. */
  /* Where the picture band ends. A card sized by hand gives the room it
     gained to the PICTURE, not to the words.
   *
     It used to keep the picture at whatever depth it already had and hand
     every pixel of the extra height to the heading band — so dragging a
     card's corner produced a small photograph sitting on a vast empty
     panel of text ground, which is nothing anybody was asking for. The
     words take the room they need; the picture takes what is left. */
  const cardTextH = cardHeadH + cardMedH + cardBodyH;
  /* …and never more than is left once the words have theirs. A depth set
     by hand on the picture, kept while the card was made smaller, used to
     be honoured whatever the box: the bands went below the picture and so
     below the card, and the heading was written across its bottom border.
     The words are what the card is FOR; the picture gives way. */
  const cardImgB = isCard
    ? n.y + ((manual && n.image && n.cardImgH == null) ? Math.max(0, h - cardTextH)
             : Math.max(0, Math.min(cardImgH, h - cardTextH)))
    : 0;
  /* Each band below the picture takes the height its own words need, in
     order, and the heading takes whatever is left over — so a card given
     more room by hand grows where the room was given rather than
     redistributing every band. */
  const cardHeadB = isCard
    ? ((cardMedium || cardBody)
        ? Math.min(h + n.y - 14, cardImgB + Math.max(22, h - (cardImgB - n.y) - cardMedH - cardBodyH))
        : n.y + h)
    : 0;
  const cardMedB = isCard ? (cardBody ? cardHeadB + cardMedH : n.y + h) : 0;
  /* How deep the picture band is. Nothing about ROUTING reads it any
     more: a card is one box, and where a connector may meet it is decided
     by that box and nothing inside it — see portOnSide. Kept because the
     drawing measures its own bands from it. */
  n.cardTop = isCard ? cardImgB - n.y : 0;
  /* And where the heading is written, in the upright card: the inline
     editor stands on this band, not on the whole card, so what is typed
     is seen where the card will write it rather than over the picture. */
  n.cardHead = isCard ? {top: cardImgB - n.y, h: cardHeadB - cardImgB} : null;

  /* The grounds are drawn in the ENTRY'S coordinates, not the chart's.
   *
   * Their rulings are userSpaceOnUse patterns, which are laid out from the
   * origin of whatever space the element stands in. In chart space that
   * origin is fixed, so the ruling was a grid painted on the chart that the
   * patch merely showed a window onto: while an entry was carried, the
   * patch travelled by transform and took the ruling with it, and on the
   * drop it was rebuilt at its new place over the chart's own grid — the
   * lines jumped to a different phase the moment the button came up. Drawn
   * inside a group translated to the entry, the ruling belongs to the
   * entry, and a carry and a drop show the same picture. */
  let groundHost = null;
  const groundAnchor = ()=> groundHost ||
    (groundHost = el('g', {class:'ground-anchor', 'data-ground': n.id,
                           transform:`translate(${n.x},${n.y})`}, fanLayer));
  // The weave for a fan-fiction entry, laid on the canvas under everything
  // else so the entry itself and its connectors stay perfectly crisp.
  if(!isFree && n.tags && n.tags.includes(FANFIC_TAG)){
    const box = {
      x: -FANFIC_HALO, y: -FANFIC_HALO,
      width: n.w + FANFIC_HALO*2, height: h + FANFIC_HALO*2,
      rx: FANFIC_HALO
    };
    el('rect', Object.assign({}, box, {
      class: 'fanfic-weave', 'data-id': n.id,
      fill: 'url(#fanfic-weave)', mask: 'url(#fanfic-mask)'
    }), groundAnchor());
    /* And a second copy of the same weave, drawn brighter and shown only
       where a band of light crosses it. It is invisible until the entry is
       under the pointer or open in the panel; then the band sweeps across,
       and the weave is momentarily more legible wherever the light is —
       see the fanfic-sweep animation. Kept as its own element rather than
       done to the weave itself, because the sweep is a MASK and the weave
       already wears one. */
    el('rect', Object.assign({}, box, {
      class: 'fanfic-glint', 'data-id': n.id,
      fill: 'url(#fanfic-weave-lit)'
    }), groundAnchor());
  }
  /* The ruled ground for an unreleased entry. The same patch and the same
     fade as the weave, so an entry carrying both tags stands on one piece
     of ground with two rulings on it rather than on two overlapping
     patches of different sizes. */
  if(!isFree && n.tags && n.tags.includes(UNRELEASED_TAG)){
    const box = {
      x: -FANFIC_HALO, y: -FANFIC_HALO,
      width: n.w + FANFIC_HALO*2, height: h + FANFIC_HALO*2,
      rx: FANFIC_HALO
    };
    el('rect', Object.assign({}, box, {
      class: 'unreleased-rule', 'data-id': n.id,
      fill: 'url(#unreleased-rule)', mask: 'url(#fanfic-mask)'
    }), groundAnchor());
    el('rect', Object.assign({}, box, {
      class: 'unreleased-glint', 'data-id': n.id,
      fill: 'url(#unreleased-rule-lit)'
    }), groundAnchor());
  }

  // Border: one ring per color in n.colors (an entry with more than one
  // manually-assigned color), or a single outline in the node's resolved
  // color — except for 'mirror' (fill = border color) and a merge left to
  // its lineages' colours (gradient border), which always draw as a single
  // outline regardless of shape archetype.
  /* A hub and a local multiverse each have a second visual layer of their
     own — the echo rings, the stack behind — and a second and third border
     colour on top of that would be unreadable, so they take exactly one
     colour however many are set. */
  /* An amalgam joins its lineages into ONE bar meeting one port. A second
     border colour on it is a colour, not a second lineage channel, so it
     must not bring a second ring of ports with it — that offered a place
     to connect that the archetype cannot honour. Same reasoning as a hub's
     echo and a local multiverse's stack. */
  /* Two different questions, which used to share one answer.
   *
   * PAINT is every colour the entry carries: an amalgam's border and text
   * are a gradient across all of them, which is the whole point of the
   * archetype — the lineages that merged are visible in the entry itself.
   * PORTS are the rings you can pull a connector from, and there a hub, a
   * local multiverse and an amalgam take exactly one however many colours
   * they carry: each of those has a second visual layer of its own, and a
   * second ring of ports on top of it offers a place to connect that the
   * archetype cannot honour.
   *
   * Collapsing the two was what quietly took the gradient off every
   * amalgam on the chart. */
  /* An amalgam takes its colours from the LINEAGES that merged into it —
     the very colours its bar is tiled in — rather than from a list set on
     the entry. That is what the archetype means: the entry is what those
     lineages became, and reading its gradient tells you which they were.
     A colour of its own would be a second, contradictory answer to the
     same question, which is why the entry offers no colour field at all. */
  /* A callout with no colour of its own takes the CONNECTOR'S.
   *
   * It is a remark about that connector and it is tied to it by a leader
   * drawn in the connector's own paint — so a card drawn in the chart's
   * default ink, with its leader in the line's colour, was one object
   * painted two ways. Same rule the leader already follows: the border
   * the connector leaves from, or the colour set on the connector, or the
   * source entry's. */
  const paintColors = isAmalgam ? amalgamInheritedColors(n)
    : (n.colors && n.colors.length) ? n.colors
    : (isCallout ? [calloutInheritedColor(n) || n.color] : [n.color]);
  /* What the entry is FILLED with, as opposed to what it is outlined in.
   *
   * This used to be one thing an archetype decided for you: a "mirror
   * reality" was an entry filled with its own border colour, and that was
   * the only way any entry on the chart could be anything but white. Fill
   * is not a claim about what an entry is, though — it is a colour — so it
   * became a property, and a mirror reality is now what it always looked
   * like: an ordinary entry with a background. More than one colour makes
   * a gradient, exactly as an amalgam's border does.
   *
   * Kept in nodeDefs rather than the page's own defs, because a gradient
   * is created per entry per render and the shared defs are never cleared. */
  const bgPaint = (n.bg && n.bg.length)
    ? (n.bg.length > 1 ? makeGradient(n.bg, false, nodeDefs) : n.bg[0])
    : null;
  /* An array has no ground: the paper shows through it, because the
     chart under the frame is still the chart. Its colour is its frame's
     and its hatching's. */
  const bgFillStyle = isArray ? 'fill:none;' : isSplit ? `fill:${(n.colors && n.colors[0]) || 'var(--ink)'};`
                    : bgPaint ? `fill:${bgPaint};` : '';
  /* One ring of the border, drawn in whatever style the entry wears.
     `make(inset)` gives the geometry for an outline that far inside the
     ring's own line. A DOUBLE border is two rails either side of that
     line, the same two a double connector draws (see DOUBLE_BAND_W). */
  const borderRing = (tag, make, colour, fillStyle)=>{
    const split = borderKey === 'double';
    const a = Object.assign({}, make(split ? -DOUBLE_LINE_OFF : 0), {stroke: colour});
    const weight = split ? `stroke-width:${DOUBLE_LINE_W.toFixed(3)};` : '';
    if(fillStyle || weight) a.style = (fillStyle || '') + weight;
    if(borderDash) a['stroke-dasharray'] = borderDash;
    const first = el(tag, a, g);
    if(split){
      const b = Object.assign({}, make(DOUBLE_LINE_OFF),
                              {stroke: colour, class: 'border-inner'});
      b.style = 'fill:none;' + weight;
      el(tag, b, g);
    }
    return first;
  };
  const ringColors = isAmalgam ? [paintColors[0]] : paintColors;
  /* An archetype's scenery — a hub's echo, a local multiverse's stack —
     belongs to the entry, not to the particular outline it wears, so it is
     drawn before the box and survives card layout. The OUTLINE is what card
     layout replaces: a card is a card whatever archetype it started as, and
     the archetype keeps only its colour and whatever it draws around
     itself. */
  if(isHub || isLocal){
    /* The scenery is the border said again further out, so it wears the
       border it stands next to: the OUTERMOST ring, as a tab does. It took
       the innermost, and on an entry with two colours the echo came out
       of a blue edge in red. An amalgam's single border is a gradient of
       its lineages, and the scenery round it is the same gradient. */
    const c = (isAmalgam && paintColors.length > 1)
      ? makeGradient(paintColors, false, nodeDefs)
      : tabInkOf(ringColors);
    const aura = el('g', {class:'node-aura', 'data-id':n.id}, auraLayer);
    /* Something to take hold of.
     *
       The scenery is a few hairlines standing in a band round the entry,
       and the layer it lives in takes no pointer at all — so an echo and
       a stack were the only things drawn on the chart that could not be
       pointed at, hovered or picked. One band per kind of scenery, as
       wide as the scenery it covers and hollow in the middle, so the
       entry underneath still answers to its own clicks. */
    const hitBand = (x, y, w2, h2, r, width)=>
      el('rect', {class:'node-aura-hit', 'data-id':n.id, x, y, width:w2, height:h2,
                  rx: rad(r), 'stroke-width': width}, aura);
    /* The scenery starts OUTSIDE whatever the entry itself is drawn with.
       As an archetype a hub was always a plain single-bordered box, so the
       echo could step straight out of n.x; as a tag it can sit on an entry
       already wearing three borders and a rippled edge, and stepping out
       of the box would have drawn the first echo straight through them. */
    const own = (ringCountOf(n) - 1) * ringStepFor(n)
              + (isWavy ? POCKET_LIFT : 0);
    if(isHub){
      /* Where every echo starts and where every echo ends — the same two
         places for all of them, so what goes out is one wave repeated
         rather than a small one, a bigger one and a bigger one again.
       *
         A ring is drawn at its own distance and has to be SCALED to cover
         that span, and the two axes need different factors: the margin is
         the same all round, but a box that is wider than it is tall is a
         smaller fraction wider for it. Four numbers per ring, written here
         because this is the only place that knows the geometry; the
         stylesheet reads them out of the keyframes. */
      const outer = own + HUB_ECHOES * HUB_ECHO_STEP;
      // The echo is drawn in the scenery's own pattern, as the stack is.
      const echoStyle = decorStyleOf(n);
      const echoDash = (BORDER_STYLES[echoStyle] || BORDER_STYLES.solid).dash;
      // The rails of a double echo, as far apart as a double sheet's.
      const HUB_ECHO_GAP = 2.4;
      {
        const band = HUB_ECHOES * HUB_ECHO_STEP;
        const mid = own + band / 2;
        hitBand(n.x - mid, n.y - mid, n.w + mid*2, h + mid*2, cornerR + mid, band);
      }
      for(let i = HUB_ECHOES; i >= 1; i--){
        const grow = own + i * HUB_ECHO_STEP;
        const rw = n.w + grow*2, rh = h + grow*2;
        const sx0 = rw > 0 ? (n.w + own*2) / rw : 1;
        const sy0 = rh > 0 ? (h + own*2) / rh : 1;
        const sx1 = rw > 0 ? (n.w + outer*2) / rw : 1;
        const sy1 = rh > 0 ? (h + outer*2) / rh : 1;
        /* A double echo and a rippled one are a path: both rails of a
           double ring in ONE element, so they travel out as one ring under
           the one animation rather than as two that would have to be kept
           in step; a ripple is the stack's own wavy outline. Plain and
           dashed stay the rectangle they always were. */
        const x0 = n.x - grow, y0 = n.y - grow, r0 = cornerR + grow;
        const shape = echoStyle === 'wavy'
          ? {tag:'path', a:{d: wavyRectPath(x0, y0, rw, rh, 0)}}
          : echoStyle === 'double'
          ? {tag:'path', a:{d: roundedRectPath(x0, y0, rw, rh, r0) + ' ' +
                              roundedRectPath(x0 + HUB_ECHO_GAP, y0 + HUB_ECHO_GAP,
                                              Math.max(0, rw - HUB_ECHO_GAP*2),
                                              Math.max(0, rh - HUB_ECHO_GAP*2),
                                              Math.max(0, r0 - HUB_ECHO_GAP))}}
          : {tag:'rect', a:{x: x0, y: y0, width: rw, height: rh, rx: rad(r0)}};
        el(shape.tag, {
          ...shape.a, stroke: c, class: 'hub-echo',
          ...(echoDash ? {'stroke-dasharray': echoDash} : {}),
          style: `fill:none;opacity:${(0.42 - (i-1)*0.12).toFixed(2)};` +
                 `stroke-width:${(1.5 - (i-1)*0.32).toFixed(2)};` +
                 `--echo-sx0:${sx0.toFixed(4)};--echo-sy0:${sy0.toFixed(4)};` +
                 `--echo-sx1:${sx1.toFixed(4)};--echo-sy1:${sy1.toFixed(4)};`
        }, aura);
      }
    }
    if(isLocal){
      /* A sheet is a COPY of the entry's own outline standing behind it,
         so on a pocket reality it has to be rippled like the outline it
         copies. Drawn as a plain rounded rectangle it read as a stack of
         ordinary boxes behind a wavy one — two different shapes claiming
         to be the same entry seen twice. Same width, same height, same
         corner radius, shifted; only the path differs. */
      /* Card layout replaces the outline with a card, rippled archetype or
         not, so the sheets go back to plain rectangles with it. */
      /* The sheets were drawn a little less round than the box, and are
         never rounder than it. */
      const sheetR = Math.min(3, cornerR);
      {
        const far = LOCAL_SHEETS * LOCAL_SHEET_STEP;
        const mid = own + far / 2;
        hitBand(n.x + mid, n.y - mid, n.w, h, sheetR, far);
      }
      /* …the ripple with the rest of it: the stack waves when the stack
         is set to wave, not when the box in front of it does. */
      const sheetWavy = decorStyleOf(n) === 'wavy';
      const sheetShape = (x, y)=> sheetWavy
        ? {tag:'path', attrs:{d: wavyRectPath(x, y, n.w, h, 0)}}
        : {tag:'rect', attrs:{x, y, width:n.w, height:h, rx:rad(sheetR)}};
      /* A sheet has a look OF ITS OWN, and solid is what it is unless
         somebody chose otherwise.
       *
         It used to copy the entry's outline — dash pattern, second rail,
         ripple and all — on the reasoning that a sheet is the same world
         seen again. The reasoning is sound and the rule was not: it left
         the scenery with no look to choose, so a dashed entry could not
         have a plain stack behind it and a plain entry could not have a
         dashed one. The stack answers to its own setting (decorStyleOf),
         which is where the reader's choice lands. */
      const sheetStyle = decorStyleOf(n);
      const sheetDash = (BORDER_STYLES[sheetStyle] || BORDER_STYLES.solid).dash;
      const sheetDouble = sheetStyle === 'double';
      for(let i = LOCAL_SHEETS; i >= 1; i--){
        const off = i * LOCAL_SHEET_STEP;
        const shp = sheetShape(n.x + own + off, n.y - own - off);
        if(sheetDouble){
          /* A sheet's stroke is thicker than the entry's, so its second
             line stands a sheet's own stroke in from the first rather than
             within the entry's band. */
          const gap = 2.4;
          const inner = sheetWavy
            ? {tag:'path', attrs:{d: wavyRectPath(n.x + own + off + gap,
                                                  n.y - own - off + gap,
                                                  n.w - gap*2, h - gap*2, -gap)}}
            : {tag:'rect', attrs:{x: n.x + own + off + gap,
                                  y: n.y - own - off + gap,
                                  width: Math.max(0, n.w - gap*2),
                                  height: Math.max(0, h - gap*2),
                                  rx: rad(sheetR - gap)}};
          el(inner.tag, {
            ...inner.attrs,
            stroke: c, class: 'local-sheet', 'data-sheet': LOCAL_SHEETS - i,
            style: `fill:none;opacity:${(0.42 - (i-1)*0.12).toFixed(2)};` +
                   `stroke-width:${(1.5 - (i-1)*0.32).toFixed(2)};` +
                   `--sheet-off:${(own + off).toFixed(2)}px;` +
                   `--sheet-far:${(own + LOCAL_SHEETS * LOCAL_SHEET_STEP).toFixed(2)}px;`
          }, aura);
        }
        el(shp.tag, {
          ...shp.attrs,
          stroke: c, class: 'local-sheet', 'data-sheet': LOCAL_SHEETS - i,
          ...(sheetDash ? {'stroke-dasharray': sheetDash} : {}),
          /* Two numbers for the animation: its own distance from the box,
             which is where it stands and therefore where it must START
             (behind the entry, that far back); and the distance of the
             OUTERMOST sheet, which is where every one of them travels to.
           *
             Each used to travel only as far as its own place, so with the
             same duration the far sheet moved twice as fast as the near
             one and the two arrived unevenly — a sheet, a sheet, then a
             wait. Same span and the same time is the same speed, and a
             stagger of one turn divided by their number then puts an even
             gap between them. The far sheet's place is still the limit, so
             nothing travels past what the decoration is drawn as. */
          style: `fill:none;opacity:${(0.42 - (i-1)*0.12).toFixed(2)};` +
                 `stroke-width:${(1.5 - (i-1)*0.32).toFixed(2)};` +
                 `--sheet-off:${(own + off).toFixed(2)}px;` +
                 `--sheet-far:${(own + LOCAL_SHEETS * LOCAL_SHEET_STEP).toFixed(2)}px;`
        }, aura);
      }
    }
  }

  /* An entry's text is written in its own first border colour. A coloured
     border is how an entry says which line it belongs to, and its label
     saying it too is what makes a chart of a dozen colours readable at a
     glance; ink for everything turned every entry into the same entry.
     An entry with no colour of its own resolves to the default ink here
     anyway, so nothing changes for a plain one. */
  let textFill = paintColors[0] || 'var(--ink)';

  /* An invisible frame around the borders, drawn before everything else so
     nothing it covers is a control.
   *
     Hovering an entry is what wakes its edge handles — `.node-handles` are
     pointer-transparent until `.node:hover` — and until now the only thing
     that could BE hovered was the entry's own fill. The four strips you
     grab an edge by therefore woke up only once the pointer was already
     inside the box, which is fine for the left, right and bottom edges,
     because that is the direction you come from. It is not how anyone
     reaches the TOP edge: you come down from above, where the connector
     is, and cross nothing but empty ground until you are past the border
     and into the box — by which point you have gone straight through the
     strip you were aiming for. On an entry with extra borders it was
     worse, since the outer rings sit entirely outside the fill and the
     only live pixels on them were the hairline of the stroke itself: the
     rings you could see were not the rings you could grab, and the entry
     answered a hover by lighting ALL of its edges faintly and none of
     them firmly — the whole border, and no port.
   *
     So the region around the borders is made part of the entry. It is a
     frame rather than a filled box: the middle is already the fill's, and
     a pad reaching this far into a neighbour would be rude. */
  if(!isFree){
    const rings = Math.max(0, ringColors.length - 1) * ringStepFor(n);
    const outer = rings + BAND_HIT_DEFAULT/2
                + (isWavy ? POCKET_LIFT + 1 : 0);
    const inner = BAND_HIT_DEFAULT/2;
    const T = outer + inner, c = (outer - inner)/2;
    if(isRound){
      /* A portrait's pad is the SQUARE, filled, not a ring around the
         circle. Its ports stand at the sides of that square and its grips
         at the corners, and a pad shaped like the circle meant the pointer
         left the entry the moment it moved off the picture towards either
         of them — so the controls a reader was reaching for went out as
         the hand arrived. What is being resized is the box; the box is
         what answers the pointer. It is drawn first and painted with
         nothing, so it covers no line and hides no connector. */
      el('rect', {x:n.x - c, y:n.y - c, width:n.w + c*2, height:h + c*2, rx:5,
                  class:'node-hover-pad node-hover-solid'}, g);
    } else {
      el('rect', {x:n.x - c, y:n.y - c, width:n.w + c*2, height:h + c*2, rx:5,
                  class:'node-hover-pad', style:`stroke-width:${T.toFixed(2)};`}, g);
    }
  }

  if(isCard){
    /* Three bands inside one border. The picture is clipped to the card's
       own outline, so its top corners round with the box and it never
       overhangs; two hairlines rule off the heading and the body. */
    const c = ringColors[0];
    /* The card's outline is whatever the border style draws, and its
       picture is clipped to that same outline — so a rippled card's
       picture stops at the ripple instead of squaring off inside it. One
       shape, asked for once: see cardShape below, which the ground, the
       clip and the border all take. */
    const cardShape = (i)=> isWavy
      ? {tag:'path', attrs:{d: wavyRectPath(n.x+i, n.y+i, w-i*2, h-i*2, -i)}}
      : {tag:'rect', attrs:{x:n.x+i, y:n.y+i, width:w-i*2, height:h-i*2, rx:rad(5-i)}};
    const clipId = defId('cardclip-', n.id);
    const clip = el('clipPath', {id:clipId}, nodeDefs);
    { const sh = cardShape(0); el(sh.tag, sh.attrs, clip); }
    // The card's own ground, under its bands.
    { const sh = cardShape(0);
      el(sh.tag, Object.assign({}, sh.attrs,
        {style:(bgFillStyle || 'fill:var(--panel);') + 'stroke:none;'}), g); }

    /* The picture, when there is one. There used to be an empty slot here
       — a grey band with a little mountain-and-sun in it — for a card
       without one, which is a third of the entry given over to saying
       that nothing has been put there yet. A card with no picture simply
       has no picture band: its own geometry says it, and the moment one
       is chosen the band appears. */
    /* A rippled border does not follow the box: it swings a wave's depth
       either side of it, so the card's real outline reaches further out
       than the rectangle everything inside it was drawn to. The picture
       stopped at the rectangle and the rules stopped at the rectangle,
       and the ground — which IS the outline — did not: a rippled card
       showed a crescent of its background between the picture and the
       border at every crest, and the same again at both ends of every
       rule. The card was not airtight.
     *
       So the bands are drawn OVER the ripple and cut back to the card's
       own outline by the clip they already had. The clip is the one
       authority on where the card ends, which is what makes the seal
       exact whatever the border does next. */
    const bleed = isWavy ? POCKET_AMP + 1 : 0;
    /* How wide the picture is drawn. A picture pulled in from the sides
       stands in the middle of its band with the card's own ground either
       side of it; one at full width reaches the border, and only that one
       is allowed to bleed past it into the ripple. */
    const imgW = Math.max(0, Math.min(w, n.cardImgW == null ? w : n.cardImgW));
    const imgFull = imgW >= w - 0.5;
    const imgX = n.x + (w - imgW)/2;
    const imgBleed = imgFull ? bleed : 0;
    if(n.image){
      const img = el('image', {
        x:imgX - imgBleed, y:n.y - bleed, width:imgW + imgBleed*2,
        height:(cardImgB - n.y) + bleed,
        'clip-path': `url(#${clipId})`,
        /* Fit the whole picture unless this card has asked for the
           other thing. `slice` fills the band and throws the rest away;
           `meet` keeps the picture entire, and the band above was sized
           from the picture's own proportions so that keeping it entire
           leaves no empty margin to fill. */
        preserveAspectRatio: n.cardCrop ? 'xMidYMid slice' : 'xMidYMid meet'
      }, g);
      wearPicture(img, n.image, n.anim);
    }

    borderRing(isWavy ? 'path' : 'rect', (i)=> cardShape(i).attrs, c, 'fill:none;');
    /* And a ring per further colour, stepping outward exactly as an
       entry's do. A card used to keep its first colour and drop the rest,
       on the grounds that its rules already divide it — but the rings are
       OUTSIDE the box and the rules inside it, so the two never met, and a
       card was the one boxed entry that could not wear two borders. */
    ringColors.slice(1).forEach((rc, k)=>{
      const grow = (k + 1) * ringStepFor(n);
      borderRing(isWavy ? 'path' : 'rect', (ins)=> isWavy
        ? {d: wavyRectPath(n.x-grow+ins, n.y-grow+ins, w+grow*2-ins*2, h+grow*2-ins*2, grow - ins)}
        : {x:n.x-grow+ins, y:n.y-grow+ins, width:w+grow*2-ins*2, height:h+grow*2-ins*2,
           rx:rad(5+grow-ins)}, rc, 'fill:none;');
    });
    const rule = (yy)=> el('line', {x1:n.x - bleed, y1:yy, x2:n.x + w + bleed, y2:yy,
                                    stroke:c, class:'card-rule',
                                    'clip-path': `url(#${clipId})`}, g);
    /* The picture's own corners, while it is the thing being edited: four
       grips on the box the picture is drawn in. Free by default — the
       picture takes the shape you pull it into — and proportional with
       Shift held, which is the one thing a picture usually wants. */
    /* Not on a turned card: the grips would turn with the picture, and a
       corner dragged one way would pull the picture another. */
    if(cardImgEditId === n.id && n.image && cardImgB > n.y + 0.5 && !turn){
      const gy0 = n.y, gy1 = cardImgB;
      [[imgX, gy0, 'nw'], [imgX + imgW, gy0, 'ne'],
       [imgX, gy1, 'sw'], [imgX + imgW, gy1, 'se']].forEach(([gx, gyy, key])=>{
        const grip = el('g', {class:'card-img-grip card-img-grip-' + key,
                              transform:`translate(${gx.toFixed(2)},${gyy.toFixed(2)})`}, g);
        el('rect', {x:-4.5, y:-4.5, width:9, height:9, rx:1.5, class:'card-img-grip-mark'}, grip);
        grip.addEventListener('mousedown', ev=> beginCardImageResize(ev, liveN()));
        grip.addEventListener('click', ev=> ev.stopPropagation());
        el('title', {}, grip).textContent =
          'Drag to resize the picture; hold Shift to keep its proportions';
      });
      el('rect', {x:imgX, y:gy0, width:imgW, height:gy1 - gy0,
                  class:'card-img-frame'}, g);
    }
    if(cardImgB > n.y + 0.5) rule(cardImgB);
    if(cardMedium || cardBody) rule(cardHeadB);
    // …and a rule between the middle band and the note only when there
    // are two bands down there to divide.
    if(cardMedium && cardBody) rule(cardMedB);
  } else if(isImage){
    /* A picture with nothing around it: no box, no border, no words. It is
       a thing you place on the chart, not an entry in the continuity. */
    if(n.image){
      const img = el('image', {
        x:n.x, y:n.y, width:n.w, height:h,
        preserveAspectRatio: 'xMidYMid meet'
      }, g);
      wearPicture(img, n.image, n.anim);
    } else {
      // An empty frame, so a picture you haven't chosen yet is still
      // something you can find, move and click.
      el('rect', {x:n.x, y:n.y, width:n.w, height:h, rx:4, class:'image-empty'}, g);
      el('path', {d:`M${n.x+n.w*0.2},${n.y+h*0.72} L${n.x+n.w*0.42},${n.y+h*0.44} `+
                     `L${n.x+n.w*0.58},${n.y+h*0.62} L${n.x+n.w*0.72},${n.y+h*0.48} `+
                     `L${n.x+n.w*0.86},${n.y+h*0.72} z`, class:'image-empty-mark'}, g);
      el('circle', {cx:n.x+n.w*0.3, cy:n.y+h*0.32, r:h*0.07, class:'image-empty-mark'}, g);
    }
  } else if(isTextbox){
    /* Words on the chart with no box around them — a caption, a heading, a
       margin note. The faint outline only shows on hover, so you can still
       grab it without it drawing a box you didn't ask for. */
    el('rect', {x:n.x, y:n.y, width:n.w, height:h, rx:cornerR, class:'textbox-frame'}, g);
    if(n.colors && n.colors.length) textFill = n.colors[0];
  } else if(isAmalgam){
    const paint = paintColors.length>1 ? makeGradient(paintColors, false, nodeDefs) : paintColors[0];
    // fill is set via inline style, not the plain attribute, because the
    // .node rect{fill:var(--panel)} stylesheet rule otherwise wins over it
    if(isWavy) borderRing('path',
      (i)=>({d: wavyRectPath(n.x+i, n.y+i, n.w-i*2, h-i*2, -i)}),
      paint, bgFillStyle || 'fill:var(--panel);');
    else borderRing('rect', (i)=>({x:n.x+i, y:n.y+i, width:n.w-i*2, height:h-i*2, rx:rad(cornerR-i)}),
               paint, bgFillStyle);
    textFill = paint;
  } else if(isRound){
    // A portrait clipped to the circle, with the ring drawn over its edge
    // so the border stays crisp. Without an image the circle is simply
    // empty — the chart still reads, it just has no face yet.
    const cx = n.x+n.w/2, cy = n.y+h/2, r = n.w/2;
    if(n.image && isBio){
      const clipId = defId('bioclip-', n.id);
      const clip = el('clipPath', {id:clipId}, nodeDefs);
      // A rippled rim clips to its own ripple; the ring is drawn over the cut.
      if(isWavyPortrait(n)) el('path', {d: rippledCirclePath(cx, cy, r, rippleCount(r))}, clip);
      else el('circle', {cx, cy, r:r-1}, clip);
      const img = el('image', {
        x: cx-r, y: cy-r, width: r*2, height: r*2,
        'clip-path': `url(#${clipId})`,
        preserveAspectRatio: 'xMidYMid slice'
      }, g);
      wearPicture(img, n.image, n.anim);
    }
    /* Named. A portrait's border and the invisible pad that catches the
       pointer are both circles inside the same group, and the stylesheet
       could only tell them apart by ORDER — "the first circle is filled,
       the rest are not". The pad is added before the border, so the pad
       took the fill and the border lost it: a portrait with no picture in
       it had nothing under the pointer at all in its middle, and could
       not be picked up except by its two-pixel rim. */
    const rippled = isWavyPortrait(n);
    ringColors.forEach((c,i)=>{
      const grow = i*RING_STEP;
      if(rippled) borderRing('path',
        (ins)=>({d: rippledCirclePath(cx, cy, Math.max(0.5, r + grow - ins), rippleCount(r)), class:'bio-ring'}),
        c, (i>0 || (n.image && isBio)) ? 'fill:none;' : bgFillStyle);
      else borderRing('circle',
        (ins)=>({cx, cy, r: Math.max(0.5, r + grow - ins), class:'bio-ring'}),
        c, (i>0 || (n.image && isBio)) ? 'fill:none;' : bgFillStyle);
    });
    if(isLinkNode){
      /* The arrow of a link's tab, drawn to the circle: the mark that
         already means "go there" on every entry carrying a link. Greyed
         while it goes nowhere. */
      const u = r / 9;
      const goes = !!linkNodeTarget(n);
      el('path', {d:`M${(cx-3.6*u).toFixed(2)},${(cy+3.6*u).toFixed(2)} L${(cx+3.2*u).toFixed(2)},${(cy-3.2*u).toFixed(2)} ` +
                    `M${(cx-1.2*u).toFixed(2)},${(cy-3.2*u).toFixed(2)} L${(cx+3.2*u).toFixed(2)},${(cy-3.2*u).toFixed(2)} ` +
                    `L${(cx+3.2*u).toFixed(2)},${(cy+1.2*u).toFixed(2)}`,
                  class: 'link-node-arrow' + (goes ? '' : ' nowhere'),
                  style:`stroke:${textFill};stroke-width:${(1.6*u).toFixed(2)};`}, g);
      const to = linkNodeTarget(n);
      el('title', {}, g).textContent = to
        ? 'Go to ' + (stripMarkup((nodes.get(to.id) || {}).label || '') || to.id)
        : 'Goes nowhere yet — double-click to say where';
    } else if(isSplit){
      el('title', {}, g).textContent = 'A split: connectors go on from here';
    } else if(!n.image){
      /* A neutral silhouette so an empty portrait still reads as one — and
         drawn TO the circle rather than at a fixed size, so it stays
         inside it at every size the circle is dragged to. It used to be
         set for a fifty-pixel circle: the shoulders' own corners sat
         twenty-seven pixels from the middle of a twenty-five pixel
         radius, so they crossed the rim even before anything was
         resized. */
      const u = r / 25;                       // the size it was drawn for
      el('circle', {cx, cy: cy - 5.5*u, r: 7.6*u, class:'bio-placeholder',
                    style:`stroke-width:${(1.6*u).toFixed(2)};`}, g);
      el('path', {d:`M${(cx-13.2*u).toFixed(2)},${(cy+17.5*u).toFixed(2)} ` +
                    `a${(13.2*u).toFixed(2)},${(11.6*u).toFixed(2)} 0 0 1 ${(26.4*u).toFixed(2)},0`,
                  class:'bio-placeholder',
                  style:`stroke-width:${(1.6*u).toFixed(2)};`}, g);
    }
  } else if(isWavy){
    /* The rippled border — the old pocket-reality edge, now one of the six
       styles any entry may wear. Same box as the plain one, drawn with
       sine-wave sides. */
    ringColors.forEach((c,i)=>{
      const grow = i*POCKET_RING_STEP;
      borderRing('path',
        (ins)=>({d: wavyRectPath(n.x-grow+ins, n.y-grow+ins,
                                 n.w+grow*2-ins*2, h+grow*2-ins*2, grow - ins)}),
        c, i>0 ? 'fill:none;' : (bgFillStyle || 'fill:var(--panel);'));
    });
  } else {
    ringColors.forEach((c,i)=>{
      const grow = i*RING_STEP;
      borderRing('rect',
        (ins)=>({x:n.x-grow+ins, y:n.y-grow+ins,
                 width:n.w+grow*2-ins*2, height:h+grow*2-ins*2,
                 rx:rad(cornerR+grow-ins)}),
        c, i>0 ? 'fill:none;' : bgFillStyle);
    });
  }

  /* And the words stay readable on whatever the entry is filled with.
   *
   * An entry writes its label in its own border colour, which is right on
   * white paper and can be invisible on anything else — most obviously on
   * a background set to that same colour, which is exactly what a "mirror
   * reality" was. Where the two are too close to tell apart the label
   * takes the plain contrasting ink instead, so the old archetype comes
   * out of the new properties looking exactly as it did. */
  if(!isFree) textFill = readableOn(textFill, (n.bg && n.bg.length) ? n.bg[0] : null);

  /* An array is taken hold of anywhere inside it and on a band along its
     frame. It used to be the band alone, so the paper inside belonged to
     the chart; but a band either side of a line that starts connectors
     was a strange thing to aim at, and the owner asked for the whole of
     it (22.10). The entries and connectors inside are drawn over the
     array, so they still answer first; only the open paper between them
     now moves the frame instead of the view. Its ground and rings answer
     nothing — the catcher does. The hatching is laid over the ground,
     inside the border. */
  if(isArray){
    g.querySelectorAll(':scope > rect:not(.node-hover-pad), :scope > path')
      .forEach(e=> e.style.pointerEvents = 'none');
    const hatch = arrayHatchPaint(n, ringColors[0]);
    if(hatch){
      const ins = borderReachIn(n);
      // As a style: the stylesheet's ground for `.node > rect` outranks an attribute.
      const a = {class:'array-hatch', style:`fill:${hatch};stroke:none;pointer-events:none;`};
      if(isWavy) a.d = wavyRectPath(n.x+ins, n.y+ins, n.w-ins*2, h-ins*2, -ins);
      else Object.assign(a, {x:n.x+ins, y:n.y+ins, width:n.w-ins*2, height:h-ins*2, rx:rad(cornerR-ins)});
      el(isWavy ? 'path' : 'rect', a, g);
    }
    /* The band is wider than an entry's ports, which lie along the
       middle of it: a press on the line itself starts a connector, as it
       does on an entry. A tab on the top edge did the holding for a while;
       the owner found it one control too many for a frame already there. */
    const out = (ringCountOf(n) - 1) * ringStepFor(n);
    el('rect', {class:'array-hit', x:n.x-out, y:n.y-out, width:n.w+out*2, height:h+out*2,
                rx: rad(cornerR+out)}, g);
  }

  /* A rotated caption or picture turns about its own centre. Only the
     drawing turns: the box the chart reasons with — for dragging,
     selecting and the marquee — stays upright, which keeps every other
     part of the page simple and is invisible at the angles loose
     furniture actually uses. */
  if(isFree && n.rot){
    g.dataset.rotTransform = `rotate(${n.rot},${(n.x+n.w/2).toFixed(2)},${(n.y+h/2).toFixed(2)})`;
    g.setAttribute('transform', g.dataset.rotTransform);
  }

  const centerX = n.x+n.w/2;
  // On a card the label is a heading in its own band, not a label centred
  // in the whole box.
  const textAreaCenterY = isCard ? (cardImgB + cardHeadB)/2 : n.y + h/2;
  // font-family must be an inline style, not a plain attribute — the
  // .node text{font-family:'IBM Plex Sans',...} stylesheet rule beats a
  // presentation attribute but loses to inline style.
  const txt = el('text',{class:'node-label-text', x:centerX, y:0, 'font-size':fontSize, fill:textFill,
    style:`font-family:${fontFamily};`}, g);
  /* A line too long for its box is cut off at the border rather than run
     out over the chart. The window is the box less its own padding, so the
     text stops exactly where every other entry's text stops — and it is
     only built for the entries that actually overflow (see clipText). */
  if(clipText && !isRound && !isImage){
    const clipId = defId('textclip-', n.id);
    const clip = el('clipPath', {id: clipId}, nodeDefs);
    const reach = closesOnInk ? borderReachIn(n) : NODE_PAD_X/2;
    el('rect', {x: n.x + reach, y: n.y,
                width: Math.max(1, n.w - reach*2), height: h}, clip);
    txt.setAttribute('clip-path', `url(#${clipId})`);
  }
  const fontOpts = {fontSize, family:fontFamily};
  // A bio circle shows a portrait, not words: its text belongs to the card
  // that opens beside it when clicked, so nothing is drawn inside.
  if(isRound || isImage){ txt.remove(); }
  else {
    /* Centred on its INK, not on its line grid.
     *
       A line of type has more above its baseline than below it, and a
       reading over a word or a glyph set larger pulls the ink further off
       centre still. Centring the grid therefore left the words sitting
       high in the box by a couple of pixels — a gap at the bottom and none
       at the top, on every entry, which is exactly the uneven padding the
       borders were supposed to have stopped having. */
    const active = textForActive(n, activeLangTab.get(n.id));
    const mb = measureTextBlock(active, maxChars, lineH, fontScale, fontOpts, fit);
    renderNodeText(txt, active, textAreaCenterY - (mb.mid || 0),
                   centerX - (mb.midX || 0), maxChars, lineH, fontScale, fontOpts, fit);
  }

  // The card's middle band, between the heading and the note.
  if(isCard && cardMedium){
    const medEl = el('text', {x:centerX, y:0, 'font-size':cardMedFS,
      class:'card-medium', style:`font-family:${fontFamily};`}, g);
    renderNodeText(medEl, cardMedium, (cardHeadB + cardMedB)/2, centerX,
                   cardMedChars, cardMedLineH, cardMedScale,
                   {fontSize:cardMedFS, family:fontFamily}, cardMedFit);
  }
  // The card's body: the note, set smaller and quieter than the heading.
  if(isCard && cardBody){
    const bodyEl = el('text', {x:centerX, y:0, 'font-size':cardBodyFS,
      class:'card-body', style:`font-family:${fontFamily};`}, g);
    renderNodeText(bodyEl, cardBody, (cardMedB + n.y + h)/2, centerX,
                   cardBodyChars, cardBodyLineH, cardBodyScale,
                   {fontSize:cardBodyFS, family:fontFamily}, cardBodyFit);
  }

  if(turn){
    turnDrawing(n, g, turn, w, h);
    if(turned){
      ({x: n.x, y: n.y, w, h} = turnedBox);
      n.w = w; n.h = h;
    }
  }

  if(hasLangTabs && !isRound && !isFree){
    // Tiny clickable "symbol" chips — one for the default/main text ("•")
    // plus one per language tab, using that tab's own short tag as its
    // symbol — tucked into the node's top-left corner, the same
    // corner-badge treatment as the n.link icon at top-right. Clicking one
    // is a purely live, in-canvas swap: it updates the ephemeral
    // activeLangTab map and re-renders just this node's <text>, never the
    // saved data and never the surrounding layout.
    /* The active chip is drawn at full size and the rest a little smaller,
       so which one is showing reads from the shape alone — the colour is
       then a reinforcement rather than the only signal. */
    const CHIP_H = CHIP_TAB_H, CHIP_GAP = 1.2, CHIP_FS = 5.2, CHIP_PAD = 3;
    const CHIP_IDLE = 0.82;             // how much smaller an unselected chip is
    const CHIP_R = 2.5;                 // rounded rectangle, not a pill
    const activeIdxNow = activeLangTab.get(n.id) ?? null;
    /* The default text's chip is the US flag rather than a filled dot.
       A dot said nothing about what it switched to, and an orange fill was
       already doing the job of marking which chip is ACTIVE — so the two
       collided, and the default chip looked permanently selected. A flag
       names the language the way every other chip does. */
    const chipLabels = [DEFAULT_LANG_CHIP, ...langTabList.map(t=> flagForCode(t.tag) || t.tag)];
    // A flag is drawn in the emoji face, typed or spelt from a code.
    const isFlag = (lbl)=> lbl === DEFAULT_LANG_CHIP || /^(\uD83C[\uDDE6-\uDDFF]){2}$/.test(lbl);
    /* At the top-left corner, on a card as on anything else. They used to
       sit on the rule above the heading, which put them in a different
       place on two entries standing side by side — and moved them the
       moment a picture was added or taken away. An entry's badges belong
       to the entry, so they are where the entry's corner is. */
    const base = tabBaseOf(n);
    let cursorX = base.left + 2;
    // One group, so the whole row can be raised above the edge handles.
    chipGroup = el('g', {class:'lang-chips'}, g);
    const tabMask = tabMaskFor(n, h);
    if(tabMask) chipGroup.setAttribute('mask', tabMask);
    const tabInk = tabInkOf(ringColors);
    if(tabInk) chipGroup.style.setProperty('--tab-ink', tabInk);
    chipLabels.forEach((lbl, idx)=>{
      const tabIdx = idx===0 ? null : idx-1;
      const isActive = tabIdx === activeIdxNow;
      const k = isActive ? 1 : CHIP_IDLE;
      const fs = CHIP_FS * k, hh = CHIP_H * k;
      const textW = measureText(lbl, {fontSize:fs, family: isFlag(lbl) ? EMOJI_FAMILY : undefined});
      const chipW = Math.max(hh, textW + CHIP_PAD*k*2);
      const cx = cursorX + chipW/2;
      // Standing on the border: every tab's foot on the same line, in it.
      const th = hh + base.sink;
      const cy = base.y + TAB_SINK - th/2;
      const chipG = el('g', {class:'lang-chip' + (isActive ? ' active' : ''),
                             transform:`translate(${cx},${cy})`}, chipGroup);
      el('path', {d: tabOutline(chipW, th, CHIP_R), class:'lang-chip-bg',
                  'data-w': +chipW.toFixed(2), 'data-h': +th.toFixed(2), 'data-r': CHIP_R}, chipG);
      const chipLabelEl = el('text', {x:0, y:2.1*k - base.sink/2, 'text-anchor':'middle', 'font-size':fs,
                                      class:'lang-chip-label' + (isFlag(lbl) ? ' emoji' : '')}, chipG);
      chipLabelEl.textContent = lbl;
      el('title',{},chipG).textContent = idx===0 ? 'Show the default text' : `Show the "${lbl}" text`;
      chipG.addEventListener('click', ev=>{
        /* Another entry's chips are out of play while one is open — see
           the link badge below and liveRefMark. The press is left alone
           rather than swallowed, so it reaches the box underneath and
           does what a press on that box does: opens it. */
        if(selectedId && selectedId !== n.id) return;
        ev.stopPropagation();
        activeLangTab.set(n.id, tabIdx);
        /* The chips change SIZE with the selection, so switching has to
           re-lay them out — toggling a class is no longer enough. */
        renderNodes();
        /* …and a full re-render builds every entry's group from scratch,
           which loses the wash that says which one is being looked at.
           Switching a language tab therefore lit the whole chart back up
           behind the panel that was still open in front of it. */
        if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
        paintMultiSelection();
        applyVisibility();
      });
      cursorX += chipW + CHIP_GAP;
    });
    // How far the chips reach along the top edge — reported for the panel
    // and the tests; the edge itself no longer gives up any of its strip
    // for them, since they are drawn over it (see sideBandRect).
    n.chipLeft = base.left + 2; n.chipRight = cursorX;
  }

  /* Corner grips: drag one to give this box a size of its own, overruling
     the text-fitted one. A portrait has them too — it has no text to fit,
     but it has a picture, and how big that picture stands on the chart is
     as much a decision as how big a box is.

     All four corners, not just the bottom-right. A box is resized from
     whichever corner is nearest the hand, and the OPPOSITE corner is what
     stays still — grabbing the top-left and pulling up should grow the box
     upward, the way it does in every drawing program, rather than moving
     the whole entry and resizing it away from the pointer.

     Every corner, whatever stands on the top edge. A link badge and the
     language chips used to cost an entry the grip under them, on the
     grounds that a grip there stole the click from the tab; the tabs stand
     ON the border now, outside the box (see TAB_SINK), and an entry with
     tabs is exactly the one that most needs to grow upward — losing its
     top grips meant it could only be resized from below. */
  /* The controls an entry is worked by — its corner grips, the handle
     that turns a caption, the strips along its sides a connector is
     drawn out of — are built the first time something can reach them,
     not with the entry. They are forty-odd elements on a box of six, and
     none of them shows or answers until the pointer is on the entry or
     it is open: drawn up front, a 600-entry chart carried twenty-four
     thousand elements for its few hundred of picture, and the style and
     layout that every redraw forces went over all of them. Built late,
     a redraw costs about a third of what it did (tools/bench-edit.js).

     What reaches them: the pointer arriving on the entry (by mouse,
     finger or pen, see nodeControlsOn), the entry being selected, and a
     connector being dragged over it (connectorDropTarget). The wrapper
     holds their place, so they land in the same order among the entry's
     children as when they were drawn eagerly: over the drawing, under
     the chips and the link badge. */
  const controls = el('g', {class:'node-controls'}, g);
  nodeControlsWanted.set(n.id, ()=>{
    const n = liveN();
    /* An array has no size to set: it is as big as what it holds. */
    if(!isArray){
      const CORNERS = [
        {key:'se', sx: 1, sy: 1, x: n.x + w, y: n.y + h},
        {key:'sw', sx:-1, sy: 1, x: n.x,     y: n.y + h},
        {key:'ne', sx: 1, sy:-1, x: n.x + w, y: n.y},
        {key:'nw', sx:-1, sy:-1, x: n.x,     y: n.y}
      ];
      /* A portrait's grips sit on the corners of the SQUARE it is inscribed
         in, like every other entry's.
       *
         0.9.16 moved them onto the rim, at the four diagonals, because the
         grips are only live while the entry is hovered and what answered the
         pointer for a portrait was the circle: reaching out to a corner let
         go of the hover that was showing the grip. That solved the symptom
         and moved the controls somewhere they do not belong — the square is
         what is being resized, its corners are where the ports already are,
         and a grip on the rim is a grip on a curve with no corner to pull.
         The cause is fixed instead: the pad below answers the pointer for
         the whole square, so the ports and the grips stay up as long as the
         pointer is anywhere inside the box, and only go when it leaves it. */
      CORNERS.forEach(c=>{
        const grip = el('g', {class:'node-resize node-resize-' + c.key,
          'data-corner': c.key,
          transform:`translate(${c.x},${c.y}) scale(${c.sx},${c.sy})`}, controls);
        /* A dot ON the corner, not a hatched square tucked inside it.
         *
           The square was ten units a side, and so is the smallest entry: an
           empty box was four grips and nothing else, and wherever the hand
           went on it, it picked up a corner instead of the entry. A dot
           centred on the corner takes a quarter of its reach from the box
           and the rest from the paper outside, so even the smallest entry
           keeps its middle for dragging, clicking and starting a connector. */
        el('circle', {cx:0, cy:0, r:RESIZE_DOT_HIT, class:'node-resize-hit'}, grip);
        el('circle', {cx:0, cy:0, r:RESIZE_DOT_R, class:'node-resize-mark'}, grip);
        el('title',{},grip).textContent = 'Drag to resize; double-click to fit the text again';
        grip.addEventListener('mousedown', ev=> beginNodeResize(ev, liveN(), g, c));
        grip.addEventListener('click', ev=> ev.stopPropagation());
        grip.addEventListener('dblclick', ev=>{
          ev.stopPropagation();
          if(readOnlyView) return;
          applyEdit(()=>{
            const found = workingEntry(n.id);
            if(!found) return;
            const opts = entryOpts(found.entry);
            delete opts.size;
            putEntry(found.index, found.entry, opts);
          });
        });
      });
      /* And loose furniture — a caption, a picture — gets one more handle:
         the curved arrow that turns it, to any angle. Only furniture:
         everything else turns in quarters, by the ⟳ in its style bar,
         because a box on a chart of right angles has to keep sides a
         connector can meet. It stands off the top-left corner, where a
         corner grip would be, so the two read as one family of handles. */
      /* As close in as it can stand without taking the corner grip's reach:
         its own reach ends a hair past the grip's. Further out, it read as a
         handle belonging to nothing in particular. */
      if(isFree){
        const rx = n.x - 1.5, ry = n.y - 1.5;
        const rot = el('g', {class:'node-rotate', transform:`translate(${rx},${ry})`}, controls);
        el('circle', {cx:-5, cy:-5, r:5.5, class:'node-rotate-hit'}, rot);
        /* An arc with a head at BOTH ends. Three quarters of a circle with
           one head on it is the mark for a turn in one direction — a
           quarter clockwise, which is what this handle no longer does. A
           handle that turns either way says so with two heads. */
        /* …and it stands across the corner, not level with the top: the
           hollow of the arc faces the entry, so it reads as the corner's own
           curve drawn again a little way out — this is the corner that
           turns. Drawn level, and centred on the hit circle, then tipped an
           eighth of a turn about that centre. */
        const mark = el('g', {class:'node-rotate-glyph', transform:'rotate(-45,-5,-5) translate(1,-3.25)'}, rot);
        el('path', {d:'M-10.9,-1.6 A5.6,5.6 0 0 1 -1.1,-1.6', class:'node-rotate-mark'}, mark);
        el('path', {d:'M-12.4,1.0 L-9.0,-0.5 L-12.8,-2.7 Z', class:'node-rotate-head'}, mark);
        el('path', {d:'M0.4,1.0 L-3.0,-0.5 L0.8,-2.7 Z', class:'node-rotate-head'}, mark);
        el('title',{},rot).textContent =
          'Drag to turn either way; hold Shift for eighths of a turn; double-click to put it back level';
        rot.addEventListener('mousedown', ev=> beginNodeRotate(ev, liveN(), g));
        rot.addEventListener('click', ev=> ev.stopPropagation());
        rot.addEventListener('dblclick', ev=>{
          ev.stopPropagation(); ev.preventDefault();
          if(readOnlyView) return;
          applyEdit(()=>{
            const found = workingEntry(n.id);
            if(!found) return;
            const opts = entryOpts(found.entry);
            delete opts.rot;
            putEntry(found.index, found.entry, opts);
          });
        });
      }
    }
    // Grab a SIDE, not a point: hovering a node lights up whichever edge the
    // pointer is nearest, and dragging from it draws a connector out of that
    // edge. Ports along the edge are worked out by the router, so there is
    // nothing to aim at — the whole edge is the target.
    //
    // A node with more than one border color has one band per ring, each
    // grabbable in its own right: pull from the black ring and the connector
    // comes out black, from the grey ring and it comes out grey. That's what
    // makes a two-colour node able to carry two differently-coloured
    // lineages without them being confused for one.
    const handles = isFree ? null : el('g', {class:'node-handles'}, controls);
    /* The side a callout's own leader arrives at is not a side you can
       connect to. Something is already attached there — the line back to the
       place on the connector this card is talking about — and a second line
       landing on the same edge reads as one line passing through the card.
       The other three sides behave exactly as any entry's do. */
    const takenSide = isCallout ? calloutLeaderSide(n) : null;
    /* The strip that lights up is the border said again, so on an entry
       whose border is a gradient it is the same gradient — it lit up in the
       first colour alone, and the border under the pointer turned flat as it
       was reached. It is laid in the chart's own units across the entry's
       width, the way the border's own runs across its box: a strip's box is
       a few units wide on the left and right sides, and a gradient over that
       put every colour into the width of a line. */
    const bandPaint = (isAmalgam && paintColors.length > 1) ? (()=>{
      const id = 'grad-' + (gradientSeq++);
      const gr = el('linearGradient', {id, gradientUnits:'userSpaceOnUse',
                                       x1:n.x, y1:0, x2:n.x + n.w, y2:0}, nodeDefs);
      paintColors.forEach((c, i)=> el('stop', {offset:`${i / (paintColors.length - 1) * 100}%`,
                                               'stop-color': c}, gr));
      return `url(#${id})`;
    })() : null;
    if(!isFree) SIDES.forEach(side=>{
      if(side === takenSide) return;
      // Innermost ring first, so where two hit strips still graze each other
      // the inner one is the one on top and stays reachable.
      ringColors.map((c,i)=>[c,i]).reverse().forEach(([ringColor, ring])=>{
        // Rings step outward, so ring 1 sits OUTSIDE the box — a negative
        // inset is what sideBandRect wants for that.
        const inset = -ring*ringStepFor(n);
        /* A rippled border is not a line but a band a whole ripple deep, so
           the strip you grab it by has to be that deep too — a 5px strip on
           the baseline missed every crest, and the border you could see was
           mostly not the border you could grab. */
        const band = sideBandRect(n, h, side, inset,
                                  isWavy
                                    ? Math.max(BAND_HIT_DEFAULT, POCKET_LIFT*2 + 2)
                                    : BAND_HIT_DEFAULT);
        const hg = el('g', {class:'node-handle', 'data-side':side,
                            'data-ring':ring, 'data-id':n.id}, handles);
        // A wide invisible strip catches the pointer; the visible highlight
        // is the thinner one drawn on the border itself.
        el('rect', Object.assign({class:'node-handle-hit'}, band.hit), hg);
        if(isWavy){
          const grow = ring*POCKET_RING_STEP;
          el('path', {class:'node-handle-band wave',
                      d: wavySideOpenPath(n.x-grow, n.y-grow, n.w+grow*2, h+grow*2, side, grow),
                      style:`fill:none;stroke:${bandPaint || ringColor};stroke-width:${BAND_W};`}, hg);
        } else {
          el('rect', Object.assign({class:'node-handle-band', style:`fill:${bandPaint || ringColor};`}, band.show), hg);
        }
        el('title',{},hg).textContent = ringColors.length > 1
          ? `Drag from this ${side} edge (${ringColor}) to connect`
          : `Drag from the ${side} edge to connect`;
        hg.addEventListener('mousedown', ev=> beginConnectorDrag(ev, liveN(), side, ring, ringColor));
        hg.addEventListener('click', ev=> ev.stopPropagation());
      });
    });
  });

  if(n.link && safeUrl(n.link) && !isFree && !isLinkNode && !isSplit){
    // A real SVG <a> (not a JS window.open() call) — the artifact host
    // renders this page inside a sandboxed iframe, which silently blocks
    // script-initiated window.open() but allows a genuine user-clicked
    // hyperlink through, so the link only works reliably as one.
    linkWrap = el('a', {href:safeUrl(n.link), target:'_blank', rel:'noopener'}, g);
    // A plain entry wears the badge at its top-right corner; a card wears
    // it at the top-left of its picture, where it reads as belonging to the
    // picture rather than hovering over the heading.
    // The top-right corner, whatever the entry is — see the chips above.
    /* A tab of its own at the right-hand end of the top edge, the same
       height and shape as the language chips at the other end — see
       tabBaseOf for why it stands on the border rather than over it. */
    const base = tabBaseOf(n);
    const linkInk = tabInkOf(ringColors);
    const lh = LINK_TAB + base.sink;
    const tabMask = tabMaskFor(n, h);
    if(tabMask) linkWrap.setAttribute('mask', tabMask);
    const lg = el('g',{class:'node-link',
      transform: `translate(${base.right - 2 - LINK_TAB/2},${base.y + TAB_SINK - lh/2})`}, linkWrap);
    el('path',{d: tabOutline(LINK_TAB, lh, 2.5), class:'node-link-bg',
               'data-w': LINK_TAB, 'data-h': lh}, lg);
    const arrow = el('path',{d:'M-1.6,1.9 L1.6,-1.3 M-0.5,-1.3 L1.6,-1.3 L1.6,0.8', fill:'none',
               class:'node-link-arrow'}, lg);
    if(base.sink) arrow.setAttribute('transform', `translate(0,${-base.sink/2})`);
    if(linkInk) lg.style.setProperty('--tab-ink', linkInk);
    const inner = entryLinkTarget(n.link);
    /* A link to another entry keeps the arrow: the icon would be this
       chart's own, the same grey square on every one of them, and the
       arrow says "go there" better than a picture of where you already are. */
    if(!inner && !linksIntoChart(n.link)) siteIconInto(lg, n.link, -base.sink/2);
    el('title',{},lg).textContent = inner
      ? 'Go to ' + stripMarkup(nodes.get(inner.id).label || inner.id)
      : 'Open linked page ↗' + (siteHost(n.link) ? ' — ' + siteHost(n.link) : '');
    /* And while another entry is open this one's link does not fire: the
       page it would open belongs to a box the reader has stepped away
       from. The press falls through to the box instead, which opens it —
       and then the link is live, because now it is the entry being looked
       at. */
    linkWrap.addEventListener('click', ev=>{
      if(selectedId && selectedId !== n.id){ ev.preventDefault(); return; }
      ev.stopPropagation();
      /* A link to another entry of this chart goes to it, here: a new tab
         would open the same chart a second time only to fly to a box that
         is already on the screen. */
      if(inner){ ev.preventDefault(); openEntryOn(inner.id, inner.tab); }
    });
  }


  /* The chips are built before the connector handles, so they would sit
     under them. Moving them to the end puts them back on top: the edge's
     highlight sweeps behind the chips, and the chips stay clickable. */
  if(chipGroup && chipGroup.parentNode === g) g.appendChild(chipGroup);
  /* And the link badge, for exactly the same reason. It stands ON the
     corner, so the two edge strips that meet there lay across most of it:
     the circle looked like one button and behaved like a crescent, with
     the half nearest the border quietly starting a connector drag
     instead. Raised to the top it is a button all the way round. */
  if(linkWrap && linkWrap.parentNode === g) g.appendChild(linkWrap);

  /* A tag that DOES something to its entry says so when you look at the
     entry. The decorations are still, and still is right for a chart being
     read — a page of things quietly moving is a page nobody can read — but
     under the pointer, and while the entry is open in the panel, each one
     performs what it means: the hub's echo goes out, the weave catches the
     light, the stack streams away. Hover and open are the same gesture in
     two speeds, so both drive it; see syncTagLiveliness, which is what
     reaches the decorations, since they live in layers of their own and no
     stylesheet can reach a sibling three parents away. */
  g.addEventListener('mouseenter', ()=>{ hoverLivelyId = n.id; syncTagLiveliness(); });
  g.addEventListener('mouseleave', ()=>{
    if(hoverLivelyId === n.id){ hoverLivelyId = null; syncTagLiveliness(); }
  });
  g.addEventListener('mousedown', ev=> beginNodeDrag(ev, liveN(), g));
  g.addEventListener('click',(ev)=>{
    ev.stopPropagation();
    // A drag that actually moved the node ends with a click event too —
    // swallow that one so letting go of a node doesn't also re-select it.
    if(suppressNodeClick){ suppressNodeClick = false; return; }
    // Ctrl/Cmd-click adds to or removes from the selection instead of
    // replacing it.
    if(ev.ctrlKey || ev.metaKey){ toggleInSelection(n.id); return; }
    /* Selecting is immediate — that is what the entry looks like being
       pressed. Opening a PANEL waits to see whether a second click is
       coming: a double click means "edit this", and the panel the first
       click would have opened flashed up and was replaced a moment later,
       which read as the wrong menu opening by mistake. */
    /* A callout is not opened in the entry panel. It has no lineage, no
       archetype, no tags and no note — the whole of it is the words on the
       card — so the panel that would open is a form about a thing that
       does not exist. It gets a card of its own instead, and opens at
       once: there is no second click to wait for, because the only other
       gesture on a callout is carrying it. */
    /* One click picks it up, two open it — the same pair of gestures every
       other entry answers to. Opening the card on the first click meant a
       reader could not simply select a callout to move or delete it
       without a form appearing over the drawing each time. */
    /* A link node goes where it points — once it is plain the press was
       not the first half of a double click, which opens its settings. One
       that goes nowhere is picked up as any entry is, to be told where. */
    if(isLinkNode && linkNodeTarget(liveN())){
      clearTimeout(nodeClickTimer);
      nodeClickTimer = setTimeout(()=>{
        nodeClickTimer = null;
        const to = linkNodeTarget(liveN());
        if(to) openEntryOn(to.id, to.tab);
      }, DOUBLE_CLICK_GRACE);
      return;
    }
    if(isCallout || isArray){
      selectNode(n.id, {quiet:true});
      paintMultiSelection();
      /* No card on a click. All it held was a Delete, which the Delete key
         does to anything selected — so a click that only means "this one"
         put a menu over the drawing every time for a control that was
         already there. */
      return;
    }
    selectNode(n.id);
    paintMultiSelection();
    clearTimeout(nodeClickTimer);
    /* A caption is not given its Text card on a click either. Its face,
       size and colour are on the toolbar of the field its words open in,
       it turns by its own corner grip, and Delete removes it: the card was
       a second place for all of that, opened by a click that only meant
       to pick the caption up. A picture keeps its card — the file it shows
       is set nowhere else. */
    const wantsBio = isBio, wantsFree = isFree && isImage, evForMenu = ev;
    nodeClickTimer = setTimeout(()=>{
      nodeClickTimer = null;
      if(wantsBio) openBioCard(n.id, true); else closeBioCard();
      if(wantsFree) openFreeMenu(n.id, evForMenu); else closeFreeMenu();
    }, DOUBLE_CLICK_GRACE);
  });
  /* Double-click is the shortcut everyone tries first: it skips the
     select-then-find-the-pencil dance and drops the cursor straight into
     this entry's text, with the box itself updating as you type. */
  g.addEventListener('dblclick', (ev)=>{
    ev.stopPropagation(); ev.preventDefault();
    // The pending single-click panel never happens: this was a double.
    clearTimeout(nodeClickTimer); nodeClickTimer = null;
    if(document.body.classList.contains('read-only')) return;
    // An array has no words to write and no settings beyond its bar.
    if(isArray) return;
    /* …and neither does the one the FIRST click already opened.
     *
       A double click is one gesture, and its first half had already run:
       the entry drawer was open behind whatever the double click went on
       to open, so every double click on the chart left a panel of
       settings and comments standing beside the thing being edited. The
       entry stays selected — that half of the click is right — and the
       drawer it would have shown is put away. */
    {
      const drawer = document.getElementById('detail');
      if(drawer && drawer.classList.contains('open')){
        drawer.classList.remove('open');
        updateAddFabPosition();
      }
    }
    /* A card's picture is its own thing to edit. A double click on the
       picture band opens the picture — its corners, to be pulled — rather
       than dropping a text cursor into a band that has no text in it. */
    if(isCard && cardImageEditable(liveN())){
      const at = clientToWorld(ev.clientX, ev.clientY);
      if(overCardPicture(liveN(), at.x, at.y)){
        selectNode(n.id, {quiet:true});
        paintMultiSelection();
        openCardImageEdit(n.id);
        return;
      }
    }
    closeCardImageEdit();
    /* A free-standing element is edited in its OWN card, not in the
       entry drawer.
     *
       Double-clicking a loose caption used to open the drawer's entry
       form and put the cursor in its Label — a form about lineage,
       archetype, colours and tags, none of which a caption has, and which
       still showed the last ENTRY that was open in it. A caption's text
       lives in the free card, so that is what a double click opens, with
       the cursor in the words. A picture has no text at all, so for one
       the card opens on its file picker. */
    if(isFree){
      selectNode(n.id); paintMultiSelection();
      /* A caption's words are written ON the caption now, like every other
         piece of text on the chart. Its card is still one click away and
         still holds everything else a caption has — the face, the size,
         the angle, the colour, the Delete — but the box that held a second
         copy of the words is gone from it. A picture has no words at all,
         so a double click on one opens its card at the file picker. */
      if(!isImage && openNodeEditor(n.id)) return;
      openFreeMenu(n.id, ev);
      return;
    }
    /* A callout is an entry, and its words are on the card it is drawn as
       — so they are written there, not in a panel beside it. */
    if(isCallout && openNodeEditor(n.id)) return;
    /* A portrait holds a PICTURE, not words. Its words are on the card
       beside it, and that is where a double click on the card opens them;
       a double click on the circle is a double click on an image, and what
       a reader wants from an image is the settings — the file, the crop,
       the size, the side its card hangs on. */
    if(isBio){ openEntrySettings(n.id); return; }
    /* A link node has no words either: its settings hold where it goes. */
    if(isLinkNode){ selectNode(n.id); paintMultiSelection(); openEntrySettings(n.id); return; }
    /* A split has nothing to write and nothing to set but its colour,
       which is on its bar; a double click picks it up, as one click does. */
    if(isSplit){ selectNode(n.id); paintMultiSelection(); return; }
    /* Everywhere else: on the entry itself, where the words are. The
       settings are the fallback for the one archetype that has no words to
       write — a picture — and for a reader who cannot write at all. */
    if(openNodeEditor(n.id)) return;
    openEntrySettings(n.id);
  });
  if(isBio){
    // The card is a reading aid, so it appears on hover — clicking is only
    // needed when you want it to stay while you work elsewhere.
    g.addEventListener('mouseenter', ()=>{
      if(bioCardPinned) return;
      if(!bioHoverWanted(n.id)) return;
      openBioCard(n.id);
    });
    g.addEventListener('mouseleave', ()=>{
      if(bioCardPinned || bioCardNodeId !== n.id) return;
      // A short grace period so crossing the gap to the card doesn't
      // flicker it away.
      bioHoverTimer = setTimeout(()=>{ if(!bioCardPinned) closeBioCard(); }, 160);
    });
    g.addEventListener('mouseenter', ()=> clearTimeout(bioHoverTimer));
  }
  g.addEventListener('mouseenter',()=>{ g.classList.add('hover'); nodeControlsOn(n.id); });
  g.addEventListener('mouseleave',()=>g.classList.remove('hover'));
};
if(!arraysOnly){
  const kept = drawnEntries;
  drawnEntries = new Map();
  [...nodes.values()].filter(n=> !isArrayNode(n))
    .sort((a,b)=> (a.z||0) - (b.z||0)).forEach(n=> drawOrKeep(n, kept, drawOne));
  settleEntryLayers();
}
/* The arrays last, once every entry in them has its size, and innermost
   first, so an array round an array fits round a box that is there. */
arraysInFitOrder().forEach(a=>{
  if(!fitArray(a)) return;
  const mark = nodeDefs.lastChild;
  drawOne(a);
  for(let d = mark ? mark.nextSibling : nodeDefs.firstChild; d; d = d.nextSibling){
    d.setAttribute('data-array-def', '');
  }
  if(arraysOnly){
    const g = arrayLayer.querySelector(`.node[data-id="${CSS.escape(a.id)}"]`);
    if(g){
      g.classList.toggle('selected', selectedId === a.id || multiSelection.has(a.id));
      if(selectedId === a.id) nodeControlsOn(a.id);
      if(nodeHidden(a)) g.style.display = 'none';
    }
  }
});
/* A redraw under a pointer that has not moved leaves the entry it is on
   hovered with nothing yet built — the event that would build them comes
   with the next movement. That one is built now, so its grips do not
   blink out on every edit; the selected one is built when the selection
   is painted again, which every redraw is followed by. */
nodeControlsOn(nodeUnderPointer);
}
renderNodes();

// draw edge paths now that node heights are known. Style (routing + line
// pattern) is per-edge via edgeStyleFor(from,to) — see EDGE_STYLES above.
// Each visible path gets an invisible wider "hit" path layered with it so
// clicking anywhere near the line (not just exactly on a thin stroke) opens
// that edge's style popover. redrawEdges() is also called by the popover to
// live-preview a change without touching node layout.
