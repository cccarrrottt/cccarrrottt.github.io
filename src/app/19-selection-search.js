/* ---------------------------------------------------------------------
   Selection / highlighting / detail panel
   ------------------------------------------------------------------ */
let selectedId = null;
/* Multi-selection. selectedId stays the "primary" one — the entry the
   detail drawer describes and the single-node commands act on — while
   multiSelection holds every id currently picked, including that one. A
   selection of one behaves exactly as it always did. */
/* Everything that fades when one entry is being looked at. The lines
   themselves, an amalgam's bar and its merged arrow all carry `.edge` and
   were always covered; the arrowheads and the beads are their own shapes
   in their own layer and were not, so selecting an entry faded the chart
   around it and left every arrowhead on top at full strength. An amalgam's
   pieces name the entry they merge into but no single source, so a bar is
   lit whenever the entry it feeds is — which is what it means. */
const DIMMABLE_EDGE_PARTS = '.edge, .edge-note, .edge-arrow, .amalgam-bead, .callout-leader';
const multiSelection = new Set();
/* Which entries and connectors are lit, and which step back.
 *
 * Pulled out of selectNode because the LIVE PREVIEW needs it too. Typing
 * in a label redraws every entry from scratch to show the words as they
 * are typed, and a freshly drawn entry carries no highlight — so the whole
 * chart came back to full strength on every keystroke and dimmed again a
 * moment later when the edit settled. From the outside: the chart flashing
 * at you while you type. */
/* Whether ANY entry is open, written on the page itself.
 *
 * The stylesheet needs it: what an entry wears — its link badge, its
 * language chips, its citations — stops answering the pointer while a
 * different entry is being looked at, and a rule can only say that if it
 * can tell the difference between "nothing is open" and "something else
 * is". A class on the body is the one place both states are visible to
 * every rule at once. */
function markEntryOpen(on){
  try{ document.body.classList.toggle('entry-open', !!on); }catch(e){}
}
/* `opts.edgesOnly` is the frame of a drag, as it is for applyVisibility.
 *
   Carrying an entry about changes no part of WHAT is picked: the same
   entries are lit, the same scenery is stepped back, the same tags are
   alive. The connectors are the one thing the frame rebuilds, so they
   are the one thing that has to be told again. Everything else — a class
   written onto every entry, every aura, every patch of ground, the
   portraits' cards and the tag list — was being written again, to the
   same value, on every frame of every carry, and the cost of it grew
   with the number of entries picked: carrying a lassoed dozen was slower
   than carrying one for no reason a reader could see. */
function paintSelectionHighlight(id, opts){
  const n = nodes.get(id);
  if(!n) return;
  const edgesOnly = !!(opts && opts.edgesOnly);
  if(!edgesOnly) markEntryOpen(id);
  /* A picture or a loose caption belongs to no lineage, so there is
     nothing for it to light and nothing that should step back for it.
   *
     It used to fall through to the arithmetic below, which found it
     related to exactly itself and faded the ENTIRE chart out behind it.
     Nobody saw that from a click, because selectNode returns early for a
     free element and never reaches here — but the live text preview calls
     this directly on every keystroke, so colouring a word in a caption, or
     bolding it, or pressing the reset button, dimmed the whole drawing to
     a ghost until the commit a half-second later redrew it. A flash of
     transparency across the chart, on every press of every formatting
     button. It clears the wash instead, which is also the right answer
     when a free element is selected after an entry that had dimmed
     things. */
  if(isFreeShape(n.shape || '')){
    if(edgesOnly){
      qEdges(DIMMABLE_EDGE_PARTS).forEach(p=>{ p.classList.remove('lit'); p.classList.remove('dim'); });
      return;
    }
    qNodes('.node').forEach(g=>{
      g.classList.toggle('selected', g.dataset.id === id);
      g.classList.remove('dim');
      g.classList.remove('lit');
    });
    document.body.classList.remove('multi-picked');
    auraLayer.querySelectorAll('.node-aura').forEach(g=> g.classList.remove('dim'));
    fanLayer.querySelectorAll(GROUND_PARTS).forEach(g=> g.classList.remove('dim'));
    qEdges(DIMMABLE_EDGE_PARTS).forEach(p=>{ p.classList.remove('lit'); p.classList.remove('dim'); });
    paintBioCardDim();
    syncTagLiveliness();
    return;
  }
  /* A multi-selection is a set of equals.
   *
     It used to be the primary's lineage with the rest of the set added on
     top: the one entry the drawer describes kept its parents and children
     lit and every connector it had, wherever they went, while the eleven
     others beside it lit only what ran between picked entries. So one
     member of the set looked more picked than the rest, by its glow and by
     the half of the chart it brought along. With more than one entry
     picked, what is lit is the set, and what runs between its members. */
  const multi = multiSelection.size > 1;
  try{ document.body.classList.toggle('multi-picked', multi); }catch(e){}
  const related = new Set([id]);
  if(!multi){
    n.parents.forEach(p=>related.add(p));
    n.children.forEach(c=>related.add(c));
  }
  /* A callout is part of the connector it points at.
   *
     Selecting an entry lights the lines that reach it and steps everything
     else back — and a remark ABOUT one of those lines was being stepped
     back with the rest of the chart, so picking an entry faded out the
     very note explaining how it is joined to its neighbour. Whatever is
     lit takes its callouts with it. */
  nodes.forEach(c=>{
    if(!isCalloutNode(c) || !c.leader) return;
    if(multi ? multiSelection.has(c.leader.from) && multiSelection.has(c.leader.to)
             : c.leader.from === id || c.leader.to === id){
      related.add(c.id);
    }
  });
  /* And it works the other way too: a callout selected lights the
     connector it is a remark about, since that is the only thing on the
     chart it is related to. Without this, clicking a callout faded out
     everything the reader had clicked it to look at. */
  if(!multi && isCalloutNode(n) && n.leader){
    related.add(n.leader.from);
    related.add(n.leader.to);
  }
  /* In a set, a picked callout lights the connector it is about, as one
     picked on its own does — every picked callout, not only the primary. */
  const pickedAbout = new Set();
  multiSelection.forEach(x=>{
    const c = nodes.get(x);
    if(c && isCalloutNode(c) && c.leader) pickedAbout.add(c.leader.from + '\u0000' + c.leader.to);
  });
  /* Everything in a multi-selection counts as related. Dimming is about
     the ONE entry being looked at; when a dozen have been picked out with
     a lasso, dimming eleven of them and lighting the twelfth's neighbours
     put the selection highlight underneath the dim wash, and only a few of
     the picked entries looked picked at all. */
  if(multi) multiSelection.forEach(x=> related.add(x));

  /* A callout on a connector the set lights is lit with it — a remark
     about the very line between two picked entries is part of what was
     picked out, and stepping it back with the rest of the chart left the
     line glowing and its explanation grey. */
  if(!edgesOnly){
    qNodes('.node').forEach(g=>{
      const gid = g.dataset.id;
      g.classList.toggle('selected', gid===id);
      g.classList.toggle('dim', !related.has(gid));
      g.classList.toggle('lit', multi && related.has(gid) && !multiSelection.has(gid) &&
        g.classList.contains('node-callout'));
    });
    /* An entry's scenery is part of the entry, so picking the entry
       picks it out too: the echo and the stack glow with the box they
       belong to rather than staying grey beside it. */
    auraLayer.querySelectorAll('.node-aura').forEach(g=>{
      const gid = g.dataset.id;
      g.classList.toggle('dim', !related.has(gid));
      g.classList.toggle('picked', gid === id || multiSelection.has(gid) || gid === decorPick);
    });
  }
  /* The GROUND steps back with everything else.
   *
     A tag's scenery comes in two halves that live in two different layers
     — the echo and the stack in the aura layer above the entries, the
     weave and the comb in the ground layer under them — and only the
     first half was being faded. So picking out an entry stepped the whole
     chart back except for the gold lattice and the grey comb under other
     people's entries, which stayed exactly as bright as they had been and
     became the loudest thing on a page that was supposed to be quiet. */
  if(!edgesOnly) fanLayer.querySelectorAll(GROUND_PARTS).forEach(g=>{
    g.classList.toggle('dim', !related.has(g.dataset.id));
  });
  /* EVERY piece of a connector, not only its line. The arrowheads, the
     ring caps, an amalgam's members, its merged arrow and its beads all
     live in their own layers under their own classes — so selecting an
     entry faded the lines of the chart around it and left every arrowhead
     and every merged bar at full strength on top. */
  /* The leaders live in the connector layer and are found by qEdges, but
     they answer to the callout they belong to as well as to the connector
     they hang off — a leader with its card faded away is a line pointing
     out of nothing. */
  edgeLayer.querySelectorAll('.callout-leader').forEach(g=>{
    const lit = related.has(g.dataset.id);
    g.classList.toggle('lit', lit);
    g.classList.toggle('dim', !lit);
  });
  qEdges(DIMMABLE_EDGE_PARTS).forEach(p=>{
    if(p.classList.contains('callout-leader')) return;
    const src = p.dataset.from, dst = p.dataset.to;
    /* An amalgam's beads and its merged arrow name the entry they feed but
       no single source — the whole point is that they belong to the merge
       rather than to any one lineage. Judged by their source they matched
       nothing and were dimmed away to invisibility while the coloured bar
       around them stayed lit, so selecting a merged construction appeared
       to delete its junctions. They follow the entry they feed instead. */
    /* A callout selected lights the one connector it is about — the two
       entries it joins are in `related` for exactly this. */
    const aboutMe = isCalloutNode(n) && n.leader &&
      src === n.leader.from && dst === n.leader.to;
    /* …except a joint bead, which belongs to the two lineages it joins.
       Following the merge, every dot on the bar stayed lit when ONE parent
       was picked out — dots between two other lineages, on stretches of
       bar that had themselves stepped back, still at full strength. A
       joint answers to its own pair; the bead at the junction, which every
       lineage feeds, still answers to the merge. */
    const pair = p.dataset.pair ? p.dataset.pair.split('\u0000') : null;
    const pairLit = pair && (multi
      ? multiSelection.has(dst) || pair.some(x=> multiSelection.has(x))
      : dst===id || pair.includes(id));
    const lit = pair ? pairLit
      : multi ? (src ? related.has(src) && related.has(dst) : related.has(dst)) ||
                pickedAbout.has(src + '\u0000' + dst)
      : src===id || dst===id || aboutMe || (!src && related.has(dst));
    p.classList.toggle('lit', lit);
    p.classList.toggle('dim', !lit);
  });
  if(edgesOnly) return;
  paintBioCardDim();
  syncTagLiveliness();
}
/* The scenery picked on its own: an echo or a stack clicked where it
   stands, lit as everything else on the chart is lit when it is picked,
   and let go by the next click anywhere else. Nothing else answers to
   it — the entry is not selected by it, because the reader pointed at
   the scenery and not at the box. */
var decorPick = null;
function setDecorPick(id){
  const next = (id && nodes.has(id)) ? id : null;
  if(next === decorPick) return;
  decorPick = next;
  auraLayer.querySelectorAll('.node-aura').forEach(g=>{
    g.classList.toggle('picked', g.dataset.id === decorPick ||
      g.dataset.id === selectedId || multiSelection.has(g.dataset.id));
  });
}
function paintMultiSelection(){
  qNodes('.node').forEach(g=>{
    g.classList.toggle('multi', multiSelection.size > 1 && multiSelection.has(g.dataset.id));
  });
  positionSwapButton();
}
function setSelection(ids, primary){
  multiSelection.clear();
  ids.forEach(id=>{ if(nodes.has(id)) multiSelection.add(id); });
  const first = primary && multiSelection.has(primary) ? primary : multiSelection.values().next().value;
  if(first) selectNode(first);
  else deselect();
  paintMultiSelection();
}
function toggleInSelection(id){
  if(multiSelection.has(id)){
    multiSelection.delete(id);
    if(selectedId === id){
      const next = multiSelection.values().next().value;
      if(next) selectNode(next); else deselect();
    } else if(selectedId){
      /* What is lit is the set, so the set shrinking is a repaint — the
         one let go of kept its connectors lit, and a set down to one
         stayed a set until something else was clicked. */
      paintSelectionHighlight(selectedId);
    }
  } else {
    multiSelection.add(id);
    selectNode(id);
  }
  paintMultiSelection();
}

// opts.keepEditForm is used by rebuildChart(): re-selecting after an edit
// must not slam the edit form shut, which is what a normal click does.
function selectNode(id, opts){
  selectedId = id;
  const n = nodes.get(id);
  if(!n) return;
  // A picture or a loose block of text has no lineage, no tags and no note
  // — the entry panel would be almost entirely empty for it — so it is
  // selected (draggable, resizable, deletable) without opening one.
  const free = n.shape === 'image' || n.shape === 'textbox';
  if(free){
    /* The entry form belongs to the entry it was opened for, and this is
       no longer that entry — so it closes, exactly as it does when any
       other selection is made.
     *
       It used to return before reaching that, leaving the form open on
       screen showing one entry's fields while `selectedId` had already
       moved to the picture. The next keystroke in the label box committed
       the whole form onto the picture: its archetype and its image URL
       replaced by another entry's label and colours, with the free
       element's own menu open on top at the same time. Two editors, one
       target, and a picture destroyed by typing. */
    if(!(opts && opts.keepEditForm)) closeEditForm();
    if(!(opts && opts.keepSelection)){
      if(!multiSelection.has(id)){ multiSelection.clear(); multiSelection.add(id); }
    }
    /* Through the shared painter, which for a free element marks it
       selected and clears the dim wash — so picking a caption after an
       entry does not leave the rest of the chart faded out behind it. */
    paintSelectionHighlight(id);
    return;
  }
  /* …and so does moving to a different entry. */
  if(typeof cardImgEditId !== 'undefined' && cardImgEditId && cardImgEditId !== id) closeCardImageEdit();
  // A plain selection replaces the set; the multi-select paths add to it
  // themselves before calling in here.
  if(!(opts && opts.keepSelection)){
    if(!multiSelection.has(id)){ multiSelection.clear(); multiSelection.add(id); }
  }
  if(!(opts && opts.keepEditForm)) closeEditForm();
  paintSelectionHighlight(id);
  /* A callout says everything it has to say on the card. Opening the entry
     drawer beside it would fill the right-hand third of the screen with a
     title, an empty tag line, an empty note and two empty lineage lists —
     so it is selected, highlighted and carryable, with no drawer. */
  if(opts && opts.quiet){
    document.getElementById('detail').classList.remove('open');
    updateAddFabPosition();
    return;
  }

  document.getElementById('detailSwatch').style.background = n.color;
  document.getElementById('detailTitle').innerHTML = inlineToHtml(n.label);
  /* The form is only refilled as it OPENS, so a field shut for one
     archetype has to be reconsidered whenever the selection moves —
     otherwise a picture's shut Label row stayed shut on the next entry. */
  syncLabelFieldForShape(null);
  if(typeof editShapeInput !== 'undefined'){
    /* The same reconsideration the Label row gets: a field offered for one
       archetype has to be taken away again on the next entry. */
    syncBioCardField({value: n.shape || 'rect'});
  }
  /* A portrait's panel is about the words on its card, so the card is up
     for as long as the panel is. It used to depend on how the entry had
     been reached: clicking the circle opened it, arriving by the search
     box, an undo or the keyboard did not, and the panel then discussed a
     card nobody could see. */
  if((n.shape || '') === 'ellipse') openBioCard(n.id, true);
  else if(bioCardPinned) closeBioCard();
  {
    /* No tags, no line. "Untagged" said nothing an empty row does not say
       already, and it took a strip of the drawer to say it — on a chart
       where most entries carry no tags, every panel opened with a label
       announcing an absence. */
    const line = document.getElementById('detailTags');
    const has = !!(n.tags && n.tags.length);
    line.style.display = has ? '' : 'none';
    line.innerHTML = has
      ? n.tags.map(t=> tagShapeHtml(t, {special: tagIsSpecial(t), why: SPECIAL_TAGS[t]})).join('')
      : '';
  }

  /* Anything still sitting in the typing pause belongs to the entry it was
     written for, not to this one. It is settled before the field is handed
     over — and the field is not reset out from under someone who is still
     writing in it. */
  if(detailNoteEditing && detailNoteOwner && detailNoteOwner !== id) flushDetailNoteCommit();
  if(!(detailNoteEditing && detailNoteOwner === id)) showDetailNote(n.note || '');

  /* The two lineage lists are gone.
   *
     They repeated, as a list of names, exactly what the reader is looking
     at: the lines on the chart already say what this entry came out of and
     what came out of it, and they say it in the place where it means
     something — beside the entries themselves, in the colours of the
     lineages. The panel's copy could only ever be a worse version of that,
     and it took the bottom third of a narrow panel to be worse in.
     Jumping to a neighbour is what the chart, the search box and the
     side tabs are for. */

  /* The entry panel describes ONE entry. With several selected there is no
     single subject for it to describe, and it would only be in the way of
     the thing you are actually doing — moving them as a group — so it
     stays shut until the selection narrows back to one. */
  const many = multiSelection.size > 1;
  document.getElementById('detail').classList.toggle('open', !many);
  if(many) closeEditForm();
  updateAddFabPosition();
}

svg.addEventListener('click', (ev)=>{
  /* A click on an entry's scenery picks the SCENERY. It is drawn under
     the entries, in a layer that answers to nothing else, so a click
     that lands on it is a click on empty canvas as far as everything
     below is concerned — which let go of whatever was selected. */
  const band = ev.target.closest && ev.target.closest('.node-aura-hit');
  if(band && !readOnlyView){
    ev.stopPropagation();
    setDecorPick(band.dataset.id === decorPick ? null : band.dataset.id);
    return;
  }
  closeFreeMenu();
  // A finished marquee ends with a click on the canvas, which would
  // otherwise immediately clear the selection it just made.
  if(suppressCanvasClick){ suppressCanvasClick = false; return; }
  closeBioCard();
  setDecorPick(null);
  deselect();
});
function deselect(){
  selectedId=null;
  markEntryOpen(false);
  /* A picture being resized belongs to the entry that was open; letting
     go of the entry lets go of the picture. */
  closeCardImageEdit();
  multiSelection.clear();
  qNodes('.node.multi').forEach(g=>g.classList.remove('multi'));
  qNodes('.node').forEach(g=>{ g.classList.remove('selected'); g.classList.remove('dim'); g.classList.remove('lit'); });
  document.body.classList.remove('multi-picked');
  auraLayer.querySelectorAll('.node-aura').forEach(g=>{
    g.classList.remove('dim');
    g.classList.toggle('picked', g.dataset.id === decorPick);
  });
  fanLayer.querySelectorAll(GROUND_PARTS).forEach(g=> g.classList.remove('dim'));
  qEdges(DIMMABLE_EDGE_PARTS).forEach(p=>{ p.classList.remove('lit'); p.classList.remove('dim'); });
  paintBioCardDim();
  syncTagLiveliness();
  document.getElementById('detail').classList.remove('open');
  closeEditForm();
  /* A picture's or a caption's menu belongs to the element it was opened
     for. With nothing selected there is no such element, and leaving the
     menu up left a live Delete button — and a text field that still
     committed — pointing at something the reader had just let go of. */
  closeFreeMenu();
  positionSwapButton();
  updateAddFabPosition();
}
document.getElementById('detailClose').onclick = (e)=>{ e.stopPropagation(); deselect(); };

function updateAddFabPosition(){
  const open = document.getElementById('detail').classList.contains('open');
  document.getElementById('addFab').classList.toggle('shifted', open);
}

/* ---------------------------------------------------------------------
   The side tabs
   ------------------------------------------------------------------ */
/* One surface at a time from the top bar. Each of these opens from a
   button standing next to the others, so two of them open at once is two
   panels covering each other rather than two things you asked for: opening
   any one of them closes whichever was already up. Looked up by id at call
   time because they are created all over this file. The tabs at the left
   edge are not among them: they cover none of these, and each keeps its
   own state until it is pressed again. */
const TOOLBAR_SURFACES = ['filePopover', 'stickerOverlay', 'aboutOverlay'];
function closeToolbarMenus(keep){
  TOOLBAR_SURFACES.forEach(id=>{
    if(id === keep) return;
    const elm = document.getElementById(id);
    if(elm) elm.classList.remove('open');
  });
}
const SIDE_TABS = ['tagsPanel', 'refsPanel', 'keyPanel', 'minimapPanel'];
function sideTabsOpen(){
  return SIDE_TABS.map(id=> document.getElementById(id)).filter(p=> p && p.classList.contains('open'));
}
/* Opening or shutting one drawer. The others are left exactly as they
   were — each has its own third of the edge, so none has to make way by
   closing. The coordinates readout stands clear of whatever is open. */
function setSideTab(panel, open){
  if(!panel) return;
  panel.classList.toggle('open', !!open);
  const handle = panel.querySelector('.side-tab-handle');
  if(handle) handle.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('side-tab-open', sideTabsOpen().length > 0);
  if(open && panel.id === 'keyPanel') buildKeyTab();
  if(panel.id === 'minimapPanel') minimapOpened(open);
}
SIDE_TABS.forEach(id=>{
  const panel = document.getElementById(id);
  panel.querySelector('.side-tab-handle').addEventListener('click', ev=>{
    ev.stopPropagation();
    setSideTab(panel, !panel.classList.contains('open'));
  });
});

/* ---------------------------------------------------------------------
   Search
   ------------------------------------------------------------------ */
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
/* Every text an entry can show is searched, not only its main one: a
   title kept on a language tab is as much the entry's name as the one it
   opens with, and a reader looking for it by that name used to find
   nothing. A hit says which text it was found in — the tab's own chip, as
   it stands on the entry — and picking it opens the entry ON that text,
   so what the reader typed is what they then see. */
function searchHits(q){
  const hits = [];
  nodes.forEach(n=>{
    const tabs = (n.multiLang && Array.isArray(n.langTabs)) ? n.langTabs : [];
    const texts = [{tab:null, text:n.label}].concat(tabs.map((t, i)=>({tab:i, text:t && t.text})));
    texts.forEach(({tab, text})=>{
      const plain = stripMarkup(text || '');
      if(plain.toLowerCase().includes(q))
        hits.push({n, tab, text: text || '', plain, chip: tabs.length ? (tab === null ? DEFAULT_LANG_CHIP : (flagForCode(tabs[tab].tag) || tabs[tab].tag)) : null});
    });
  });
  hits.sort((a,b)=> a.plain.length - b.plain.length);
  return hits;
}
/* Opening an entry on one of its texts: the tab is switched first, so the
   box is drawn with that text in it before the view flies there. */
function openEntryOn(id, tab){
  const n = nodes.get(id);
  if(!n) return;
  const tabs = (n.multiLang && Array.isArray(n.langTabs)) ? n.langTabs : [];
  const want = (tab != null && tab >= 0 && tab < tabs.length) ? tab : null;
  if(tabs.length && (activeLangTab.get(id) ?? null) !== want){
    activeLangTab.set(id, want);
    renderNodes();
    applyVisibility();
  }
  selectNode(id); flyToNode(id);
}
searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.trim().toLowerCase();
  if(q.length<2){ searchResults.classList.remove('show'); return; }
  const matches = searchHits(q);
  searchResults.innerHTML='';
  matches.slice(0,30).forEach(hit=>{
    const n = hit.n;
    const tagsLabel = (n.tags && n.tags.length) ? n.tags.join(', ') : '';
    const row = document.createElement('div');
    row.className='row';
    /* The colour goes in escaped, like everything else here. It comes from
       the chart's data rather than from anything typed in this box, and a
       file brought in from elsewhere is not obliged to have put a real
       colour there at all. */
    const chip = hit.chip == null ? '' :
      `<span class="sr-tab${hit.tab === null ? ' main' : ''}" title="${hit.tab === null ? 'The main text' : escapeHtml('The \u201c' + hit.chip + '\u201d text')}">${escapeHtml(hit.chip)}</span>`;
    row.innerHTML = `<div class="dot" style="background:${escapeHtml(n.color || '')}"></div>${chip}<div>${inlineToHtml(hit.text)}</div><div class="cl">${escapeHtml(tagsLabel)}</div>`;
    row.addEventListener('click', ()=>{
      openEntryOn(n.id, hit.tab);
      searchResults.classList.remove('show'); searchInput.value = hit.plain;
    });
    searchResults.appendChild(row);
  });
  searchResults.classList.toggle('show', matches.length>0);
});
/* ---------------------------------------------------------------------
   A link to one entry
   ------------------------------------------------------------------ */
/* The page's own address with the entry after the #, and the tab it is
   showing if it is not the main one — so a link sent to somebody opens
   the entry the way the sender was looking at it. The fragment never
   reaches a server, and the page reads it on the way in (below), so the
   same link works on the site, from a disk and from a copy elsewhere.
   Inside claude.ai the address is the viewer's sandbox, which is nobody's
   link, so the button is not offered there. */
function entryLink(id){
  const n = nodes.get(id);
  if(!n) return '';
  const tab = activeLangTab.get(id);
  return location.href.split('#')[0] + '#entry=' + encodeURIComponent(id) +
    (tab != null && n.multiLang && Array.isArray(n.langTabs) && n.langTabs[tab] ? '&tab=' + (tab + 1) : '');
}
function entryFromHash(hash){
  const h = String(hash || '').replace(/^#/, '');
  const out = {};
  h.split('&').forEach(part=>{
    const at = part.indexOf('=');
    if(at < 0) return;
    let v = part.slice(at + 1);
    try{ v = decodeURIComponent(v); }catch(e){ return; }
    out[part.slice(0, at)] = v;
  });
  if(!out.entry) return null;
  const tab = /^[1-9][0-9]*$/.test(out.tab || '') ? +out.tab - 1 : null;
  return {id: out.entry, tab};
}
/* The entry of THIS chart a link names, if it names one: a bare
   `#entry=…`, this page's own address, or the published site's — the same
   chart wherever it is opened, which is how a link copied on the site
   still means this chart inside an artifact or a copy on disk. Anything
   else, or an entry this chart does not have, is an ordinary link. */
function entryLinkTarget(raw){
  if(typeof raw !== 'string' || !raw.trim()) return null;
  let u;
  try{ u = new URL(raw.trim(), location.href); }catch(e){ return null; }
  const want = entryFromHash(u.hash);
  if(!want || !nodes.has(want.id)) return null;
  const here = u.origin + u.pathname === location.origin + location.pathname;
  return (here || raw.trim().startsWith('#') || SITE_ORIGINS.includes(u.origin)) ? want : null;
}
/* Whether a link points into this chart at all, whatever entry it names —
   one whose entry has since been deleted is still not a link to elsewhere. */
function linksIntoChart(raw){
  if(typeof raw !== 'string' || !raw.trim()) return false;
  if(raw.trim().startsWith('#')) return true;
  let u;
  try{ u = new URL(raw.trim(), location.href); }catch(e){ return false; }
  return SITE_ORIGINS.includes(u.origin) || u.origin + u.pathname === location.origin + location.pathname;
}
function openEntryFromHash(){
  const want = entryFromHash(location.hash);
  if(want && nodes.has(want.id)) openEntryOn(want.id, want.tab);
}
window.addEventListener('hashchange', openEntryFromHash);
const detailLink = document.getElementById('detailLink');
if(detailLink){
  detailLink.hidden = HOSTED;
  detailLink.addEventListener('click', async ev=>{
    ev.stopPropagation();
    if(!selectedId) return;
    const url = entryLink(selectedId);
    let copied = false;
    try{ await navigator.clipboard.writeText(url); copied = true; }catch(e){}
    /* Where the clipboard is refused (an insecure origin, an old browser),
       the address bar is the next best place to hand it over from. */
    if(!copied){ try{ window.history.replaceState(null, '', url); }catch(e){} }
    detailLink.classList.add('done');
    detailLink.title = copied ? 'Link copied' : 'The link is in the address bar';
    clearTimeout(detailLink.timer);
    detailLink.timer = setTimeout(()=>{
      detailLink.classList.remove('done');
      detailLink.title = 'Copy a link to this entry';
    }, 1600);
  });
}
searchInput.addEventListener('blur', ()=> setTimeout(()=>searchResults.classList.remove('show'),150));
/* A press anywhere else puts the search away — the query with it. The
   blur above only ever ran when the press took the focus, and on the
   chart it does not (the canvas keeps the press for itself), so the list
   stayed open over the drawing unless the press landed somewhere near
   the toolbar. Asked in the capture phase, before anything on the chart
   can swallow the press. */
document.addEventListener('pointerdown', ev=>{
  const t = ev.target;
  if(t && t.closest && (t.closest('#searchInput') || t.closest('.search-results'))) return;
  if(!searchResults.classList.contains('show') && !searchInput.value) return;
  searchResults.classList.remove('show');
  searchInput.value = '';
  if(document.activeElement === searchInput) searchInput.blur();
}, true);
/* Whether the keyboard currently belongs to something being typed in. The
   shortcuts below all defer to it: a key that means "delete the entry" or
   "jump to search" on the chart means the character itself in a field. */
let keyboardOnChart = false;
/* Which kinds of INPUT actually swallow a keystroke. A colour well, a
   checkbox, a radio, a range or a file button hold focus without taking
   any text, and Delete means the chart's Delete while one of them is
   focused, not "erase a character" in a field that has none. */
const TEXT_INPUT_TYPES = new Set(
  ['text','search','url','tel','password','email','number','date','time','month','week']);
function typingInField(){
  const ae = document.activeElement;
  if(!ae) return false;
  // The last press was on the drawing, so the drawing is what the keys mean.
  if(keyboardOnChart) return false;
  if(ae.isContentEditable) return true;
  if(ae.tagName === 'TEXTAREA') return true;
  /* A drop-down is NOT typing.
   *
     A native select keeps focus after a choice is made, and it used to
     count here — so picking Orthogonal from a connector's Path menu and
     then pressing Delete did nothing at all, on a connector whose panel
     was open with its own Delete button sitting in it. Nothing is being
     typed into a list of five words. */
  if(ae.tagName === 'SELECT') return false;
  if(ae.tagName === 'INPUT') return TEXT_INPUT_TYPES.has((ae.type || 'text').toLowerCase());
  return false;
}
/* Who the keyboard belongs to: the drawing, or a field.
 *
 * Picking an entry up calls preventDefault on its mousedown — so the
 * browser never starts selecting text as the entry is carried — and
 * preventDefault on a mousedown also cancels the focus change that press
 * would otherwise have made. So whatever field was last typed in KEPT the
 * keyboard: click into a label, click back onto the chart, press Delete,
 * and nothing happens, because as far as the shortcut could tell you were
 * still typing. That is the Delete key "sometimes stopping".
 *
 * Blurring the field on that press is the obvious answer and the wrong
 * one: a blur commits what was typed, a commit redraws the chart, and the
 * entry under the pointer is replaced between the press and the release —
 * so no click ever completes on it and the press selects nothing. What is
 * actually wanted is not to move the focus but to know where the LAST
 * press was, which is what a reader means by which of the two they are
 * working in. */
document.addEventListener('focusin', ev=>{
  const t = ev.target;
  if(t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')){
    keyboardOnChart = false;
  }
});
/* What Delete takes away: the connector whose panel is open, or the
   entries picked. One function, because a phone's delete button means the
   same as the key (see touchTools); answers whether there was anything. */
function deletePicked(){
  if(readOnlyView) return false;
  if(edgePopover.classList.contains('open') && currentEdgeStyleTarget){
    deleteOpenConnector();
    return true;
  }
  if(multiSelection.size > 1){
    deleteNodes(Array.from(multiSelection));
    return true;
  }
  if(selectedId){
    deleteNode(selectedId);
    return true;
  }
  return false;
}
document.addEventListener('keydown', e=>{
  // A modal question owns the keyboard while it is up. Without this,
  // Escape closed the panel behind it and Delete deleted the entry behind
  // it, both while the question was still on screen waiting for an answer.
  if(askOverlay.classList.contains('open')) return;
  /* The search shortcut goes by key position too, for the same reason as
     the Ctrl combinations below — and, like them, not while something is
     being typed. It used to check only that the search box itself did not
     have focus, so the first `/` of any URL, path or date typed anywhere
     in the application was swallowed and the rest of the line went into
     the search box. */
  if((e.code==='Slash' || e.key==='/') && !e.ctrlKey && !e.metaKey &&
     document.activeElement!==searchInput && !typingInField()){
    e.preventDefault(); searchInput.focus();
  }
  if(e.key==='Escape'){
    // Same effect as that panel's own close (✕) button — whichever panel
    // is topmost/open gets closed first, most-specific first, so Escape
    // never skips past an open popover straight to deselecting the chart.
    if(nodeEditorTarget){ closeNodeEditor(true); return; }
    if(closeAddFab()) return;
    if(commentsOverlay.classList.contains('open')){ commentsOverlay.classList.remove('open'); return; }
    if(bioCardNodeId){ closeBioCard(); return; }
    if(noteOverlay && noteOverlay.classList.contains('open')){ noteOverlay.classList.remove('open'); return; }
    /* About, the sticker library and the File menu: the three the top bar
       opens. Only About was listed, so Escape walked straight past an
       open sticker library or File menu to deselecting the chart, and
       they stayed up — which went unseen while opening the Add form
       happened to shut them. */
    if(TOOLBAR_SURFACES.some(id=> document.getElementById(id).classList.contains('open'))){
      closeToolbarMenus(); return;
    }
    if(edgePopover.classList.contains('open')){ closeEdgePopover(); return; }
    // A picture's or a caption's own menu is a panel like any other, and
    // was the one Escape never reached — so it stayed open, still holding
    // a Delete button, over an element that was no longer selected.
    if(freeMenu.classList.contains('open')){ closeFreeMenu(); return; }
    if(detailEditForm.style.display==='block'){ closeEditForm(); return; }
    /* Last of all, since they are what stays open while the chart is
       worked on: every open drawer at once. */
    const tabs = sideTabsOpen();
    if(tabs.length){ tabs.forEach(p=> setSideTab(p, false)); return; }
    deselect(); searchResults.classList.remove('show'); searchInput.blur();
  }
  if(readOnlyView && (e.key==='Delete' || e.key==='Backspace')) return;
  if(e.key==='Delete' || e.key==='Backspace'){
    // Same effect as clicking that context's own "Delete" button — never
    // hijacked while the user is actually typing (Backspace has to keep
    // erasing text in every field, including these two keys' own textareas).
    if(typingInField()) return;
    if(deletePicked()) e.preventDefault();
    return;
  }
  // ---- clipboard + undo ------------------------------------------------
  // Same guard as Delete/Backspace above: inside any text field these keys
  // belong to the field, where the browser's own copy/paste/undo is what
  // the user means.
  if(e.ctrlKey || e.metaKey){
    const ae = document.activeElement;
    const typing = ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA' || ae.isContentEditable);
    if(typing) return;
    /* Read the PHYSICAL key, not the character it produces. On a Cyrillic
       layout Ctrl+C is Ctrl+С — a different character entirely — and every
       shortcut on this page silently stopped working the moment the layout
       changed. `e.code` names the key by its position ("KeyC"), which is
       the same key on every layout, so the shortcuts belong to the keyboard
       rather than to the alphabet. e.key is kept as the fallback for the
       rare input device that reports no code. */
    const key = (/^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : (e.key || '')).toLowerCase();
    // Copy stays available to readers — it only fills the clipboard.
    if(readOnlyView && key !== 'c') return;
    if(key==='c'){
      if(!selectedId) return;
      e.preventDefault();
      if(copySelectedNode() && detailEditForm.style.display==='block') setEditStatus('ok', 'Copied.');
      return;
    }
    if(key==='x'){
      if(!selectedId) return;
      e.preventDefault();
      cutSelectedNode();
      return;
    }
    if(key==='v'){
      e.preventDefault();
      pasteClipboardNode();
      return;
    }
    // Ctrl+Z steps back, Ctrl+Y steps forward again — and Ctrl+Shift+Z as
    // well, because that is the other habit people have for redo.
    if(key==='z'){
      e.preventDefault();
      if(e.shiftKey) redoLastEdit(); else undoLastEdit();
      return;
    }
    if(key==='y'){
      e.preventDefault();
      redoLastEdit();
      return;
    }
    if(key==='s'){
      // The browser's own Ctrl+S would offer to download this page, which
      // is never what's meant on a document that has its own Save.
      e.preventDefault();
      saveNow();
      return;
    }
  }
});

/* ---------------------------------------------------------------------
   Stats + init
   ------------------------------------------------------------------ */
function updateStats(){
  document.getElementById('statNodes').textContent = nodes.size;
  document.getElementById('statEdges').textContent = structEdges.length;
  document.getElementById('statClusters').textContent = allTags.filter(t=>t!==UNTAGGED).length;
}
updateStats();

/* ---------------------------------------------------------------------
   Redraw everything from the working data.

   Called after every edit. Deliberately does NOT touch the viewport — an
   edit shouldn't yank the chart out from under you — and re-selects the
   node you had selected if it still exists, so the drawer doesn't shut
   itself every time you change something in it.
   ------------------------------------------------------------------ */
function rebuildChart(){
  const keepSelected = selectedId;
  applyGroundColors();
  buildModel();
  renderNodes();
  redrawEdges();
  buildSideTabs();
  updateStats();
  applyVisibility();
  // The selection survives a rebuild, minus anything that no longer exists.
  Array.from(multiSelection).forEach(id=>{ if(!nodes.has(id)) multiSelection.delete(id); });
  if(keepSelected && nodes.has(keepSelected)) selectNode(keepSelected, {keepEditForm:true, keepSelection:true});
  else if(keepSelected) deselect();
  paintMultiSelection();
  if(bioCardNodeId && !nodes.has(bioCardNodeId)) closeBioCard();
  else drawBioCard();
  paintSuggestionMarks();
}

/* The add button is positioned against whatever part of the canvas the
   panels have left showing, so a window that changes size has to have it
   placed again. This listener was here with an empty body — registered, so
   it read as handled, and doing nothing: resize a window with the drawer
   open and the control sat where the old edge used to be, under it. */
window.addEventListener('resize', ()=> updateAddFabPosition());
openingView();
applyVisibility();
/* After the whole program has run, not here: opening an entry reaches into
   parts that come later and whose state does not exist yet at this line. */
setTimeout(openEntryFromHash, 0);

