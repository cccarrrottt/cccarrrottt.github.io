/* =====================================================================
   The chart as text

   Everything the chart says is drawn into an SVG, and a drawing has no
   reading order: a screen reader met a few hundred scraps of text in the
   order they happened to be appended, and a search engine that does not
   run the page met nothing at all. This is the same chart written out as
   a document — every entry once, under the entry it descends from, with
   its tags, its note, what its line from each parent says and where its
   link goes. It is built from the model, so it is never a second copy to
   keep in step, and every name in it opens the entry on the chart.

   An entry with several parents is listed under the first and names the
   others, rather than repeated under each: the list is for reading
   through, and a reader who met the same entry three times would not
   know whether it was three entries. Arrays, pictures, captions and
   callouts are left out — they are things drawn on the chart, not
   entries in its lineage, which is the same line the search draws.
   ===================================================================== */
const textViewOverlay = document.getElementById('textViewOverlay');
const textViewBody = document.getElementById('textViewBody');
const textViewToggle = document.getElementById('textViewToggle');
/* Built when it is opened, and once after start-up so the page carries
   its text for anything that reads the document without opening it. An
   edit while it is shut only marks it out of date. A var, because
   rebuildChart marks it and may run before this part has. */
var textViewStale = true;

function textViewListed(n){
  return !!n && !isArrayNode(n) && !isFreeShape(n.shape) && (n.shape || '') !== 'callout';
}
function textViewName(n){
  return stripMarkup(n.label || '').replace(/\s+/g, ' ').trim() || n.id;
}
/* What a screen reader says for an entry drawn on the chart: its name and
   its tags. The drawing inside it — the text in pieces, the stickers, the
   grips — says nothing on its own, so the entry is one image with this as
   its name (renderNodes). */
function spokenNameOf(n){
  const name = textViewName(n);
  return n.tags && n.tags.length ? name + ' (' + n.tags.join(', ') + ')' : name;
}

function textViewEntryLink(n){
  const a = document.createElement('a');
  a.className = 'tv-name';
  a.href = '#entry=' + encodeURIComponent(n.id);
  a.dataset.id = n.id;
  a.textContent = textViewName(n);
  return a;
}
function textViewItem(n, under, drawn){
  const li = document.createElement('li');
  li.className = 'tv-entry';
  const head = document.createElement('div');
  head.className = 'tv-head';
  head.appendChild(textViewEntryLink(n));
  if(n.tags && n.tags.length){
    const tags = document.createElement('span');
    tags.className = 'tv-tags';
    tags.textContent = n.tags.join(', ');
    head.appendChild(tags);
  }
  li.appendChild(head);
  /* The other names it goes by: the texts on its language tabs. */
  const tabs = (n.multiLang && Array.isArray(n.langTabs)) ? n.langTabs : [];
  const also = tabs.map(t=> stripMarkup((t && t.text) || '').replace(/\s+/g, ' ').trim())
                   .filter(t=> t && t !== textViewName(n));
  if(also.length){
    const p = document.createElement('p');
    p.className = 'tv-also';
    p.textContent = 'Also: ' + also.join(' · ');
    li.appendChild(p);
  }
  /* Each line in, with what it says: the entry's own word for its line and
     the note written on the connector, which are the two places the chart
     says how one work came from another. The parent it is listed under
     comes first and is not linked again; it is the list item it sits in. */
  const parents = Array.from(new Set(n.parents)).filter(p=> nodes.has(p));
  parents.forEach(p=>{
    const words = [n.edgeLabel, edgeStyleFor(p, n.id).note]
      .map(t=> stripMarkup(t || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if(p === under && !words.length) return;
    const line = document.createElement('p');
    line.className = 'tv-from';
    if(p === under){
      line.textContent = words.join(' — ');
    } else {
      line.appendChild(document.createTextNode('Also from '));
      line.appendChild(textViewEntryLink(nodes.get(p)));
      if(words.length) line.appendChild(document.createTextNode(' — ' + words.join(' — ')));
    }
    li.appendChild(line);
  });
  const note = stripMarkup(n.note || '').trim();
  if(note){
    const p = document.createElement('p');
    p.className = 'tv-note';
    p.textContent = note;
    li.appendChild(p);
  }
  /* A link to another entry of this chart is a name like the others, and
     opens that entry here rather than the page again in a new tab. */
  const inside = n.link ? entryLinkTarget(n.link) : null;
  const href = n.link && !inside ? safeUrl(n.link) : null;
  if(inside){
    const p = document.createElement('p');
    p.className = 'tv-link';
    p.appendChild(document.createTextNode('See '));
    p.appendChild(textViewEntryLink(nodes.get(inside.id)));
    li.appendChild(p);
  } else if(href){
    const p = document.createElement('p');
    p.className = 'tv-link';
    const a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = n.link;
    p.appendChild(a);
    li.appendChild(p);
  }
  drawn.add(n.id);
  const kids = Array.from(new Set(n.children)).map(id=> nodes.get(id))
    .filter(c=> textViewListed(c) && !drawn.has(c.id) && c.parents.find(p=> nodes.has(p)) === n.id);
  if(kids.length){
    const ul = document.createElement('ul');
    ul.className = 'tv-list';
    kids.forEach(c=> ul.appendChild(textViewItem(c, n.id, drawn)));
    li.appendChild(ul);
  }
  return li;
}
function buildTextView(){
  textViewStale = false;
  const listed = Array.from(nodes.values()).filter(textViewListed);
  const drawn = new Set();
  const ul = document.createElement('ul');
  ul.className = 'tv-list tv-root';
  /* The roots are the entries with no parent on the chart; whatever a
     loop of parents leaves unreached goes after them, so nothing is left
     out of the text that is on the drawing. */
  listed.filter(n=> !n.parents.some(p=> nodes.has(p)))
        .forEach(n=> ul.appendChild(textViewItem(n, null, drawn)));
  listed.filter(n=> !drawn.has(n.id))
        .forEach(n=>{ if(!drawn.has(n.id)) ul.appendChild(textViewItem(n, null, drawn)); });
  const count = document.createElement('p');
  count.className = 'tv-count';
  count.textContent = listed.length === 1 ? 'One entry.' : listed.length + ' entries.';
  textViewBody.replaceChildren(count, ul);
}
/* Called by rebuildChart on every edit — which can be before this part
   has run, so it asks the document rather than the consts above. */
function textViewChanged(){
  textViewStale = true;
  const box = document.getElementById('textViewOverlay');
  if(box && box.classList.contains('open')) buildTextView();
}

function openTextView(){
  closeToolbarMenus('textViewOverlay');
  if(textViewStale) buildTextView();
  textViewOverlay.classList.add('open');
  textViewToggle.setAttribute('aria-expanded', 'true');
  document.getElementById('textViewClose').focus();
}
function closeTextView(){
  if(!textViewOverlay.classList.contains('open')) return;
  textViewOverlay.classList.remove('open');
  textViewToggle.setAttribute('aria-expanded', 'false');
}
textViewToggle.onclick = ()=> textViewOverlay.classList.contains('open') ? closeTextView() : openTextView();
/* Its button is inside About, which shut as the text opened, so the focus
   goes back to About's own button in the bar: the way the reader came. */
document.getElementById('textViewClose').onclick = ()=>{ closeTextView(); document.getElementById('aboutToggle').focus(); };
textViewOverlay.addEventListener('click', e=>{
  if(e.target === textViewOverlay){ closeTextView(); return; }
  /* A name opens its entry on the chart, and the reader is taken to the
     entry's panel, which is where its words now are. The href is there
     for what reads the page without running it, and for a new tab. */
  const a = e.target.closest && e.target.closest('a.tv-name');
  if(!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  e.preventDefault();
  if(!nodes.has(a.dataset.id)) return;
  closeTextView();
  openEntryOn(a.dataset.id, null);
  const title = document.getElementById('detailTitle');
  if(title) title.focus({preventScroll:true});
});
/* Escape closes it like the other panels the top bar opens (see
   TOOLBAR_SURFACES); that path does not know about the button, so the
   button is told here when the panel goes. */
new MutationObserver(()=>{
  if(!textViewOverlay.classList.contains('open')) textViewToggle.setAttribute('aria-expanded', 'false');
}).observe(textViewOverlay, {attributes:true, attributeFilter:['class']});
document.getElementById('skipToText').addEventListener('click', e=>{
  e.preventDefault();
  openTextView();
});

/* The drawing's connectors, their notes and its scenery are all said in
   the text above, in order; read off the drawing they are noise between
   the entries. */
['bgLayer', 'edgeLayer', 'leaderHitLayer', 'arrowLayer', 'bendLayer', 'guideLayer', 'leaderPickLayer']
  .forEach(id=>{ const g = document.getElementById(id); if(g) g.setAttribute('aria-hidden', 'true'); });
setTimeout(()=>{ if(textViewStale) buildTextView(); }, 0);
