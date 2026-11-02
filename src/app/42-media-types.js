/* ---------------------------------------------------------------------
   Kinds of media (the owner's list of 2.11).

   A card's middle band says what the thing IS — "TV series, 1996" — and
   was typed out by hand on every card, the same few facts in a different
   order each time. A kind of medium is a template for that line: a name
   ("Film"), the facts a film has (studio, director, year…), built by hand
   in the fourth management drawer, and the order they are written in,
   "%Studio%, %Director%, %Year%". A card picks its kind from a list in its
   panel, the way it picks a tag, is given the facts one by one, and its
   middle band writes them out in that order, in italics.

   The kinds are kept in SETTINGS.mediaTypes; a card keeps the kind's id
   and its facts by each field's id, so renaming a field or the kind
   changes how the line reads and not what the card knows. A card whose
   kind is taken out of the chart keeps its facts, and shows the medium it
   was typed with until it is given another kind.

   The drawer is the author's, as the legend is: a reader is not shown it.
   ------------------------------------------------------------------ */

/* Only what reads as a kind: an id the file can name, a name, fields with
   ids and labels, and a line to write them in. */
function cleanMediaTypes(v){
  if(!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  v.forEach(t=>{
    if(!t || typeof t !== 'object') return;
    const id = typeof t.id === 'string' && /^[A-Za-z][\w-]{0,40}$/.test(t.id) ? t.id : null;
    if(!id || seen.has(id)) return;
    seen.add(id);
    const fields = [];
    const fseen = new Set();
    (Array.isArray(t.fields) ? t.fields : []).forEach(f=>{
      if(!f || typeof f !== 'object' || typeof f.id !== 'string' || !/^f\d{1,6}$/.test(f.id) || fseen.has(f.id)) return;
      fseen.add(f.id);
      fields.push({id: f.id, label: typeof f.label === 'string' ? f.label.trim().slice(0, 40) : ''});
    });
    const kind = {id, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 60) : id, fields: fields.slice(0, 30)};
    if(typeof t.format === 'string' && t.format.trim()) kind.format = t.format.slice(0, 200);
    out.push(kind);
  });
  return out.slice(0, 100);
}
function mediaTypesOf(){ return cleanMediaTypes(SETTINGS.mediaTypes); }
function mediaTypeById(id){ return id ? mediaTypesOf().find(t=> t.id === id) || null : null; }
/* A card's facts, as the file may keep them: strings by field id. */
function cleanMediaData(v){
  if(!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  Object.keys(v).forEach(k=>{
    if(/^f\d{1,6}$/.test(k) && typeof v[k] === 'string' && v[k].trim()) out[k] = v[k].slice(0, 200);
  });
  return Object.keys(out).length ? out : null;
}
/* The line a kind writes for these facts. Each %Label% (any case) is the
   fact of the field with that label; with no line of its own the kind
   writes its fields in their order, a comma between. A fact not given
   takes the words that join it to its neighbour with it, so a film with
   no director reads "Mainframe, 1996", not "Mainframe, , 1996". */
function mediaLineFor(kind, data){
  if(!kind) return '';
  const facts = data || {};
  const byLabel = new Map(kind.fields.map(f=> [f.label.toLowerCase(), f.id]));
  const format = kind.format || kind.fields.filter(f=> f.label).map(f=> '%' + f.label + '%').join(', ');
  const parts = [];
  const re = /%([^%]+)%/g;
  let m, last = 0;
  while((m = re.exec(format))){
    parts.push({lit: format.slice(last, m.index)});
    const key = m[1].trim();
    const fid = byLabel.get(key.toLowerCase()) || (kind.fields.some(f=> f.id === key) ? key : null);
    parts.push({val: fid ? String(facts[fid] || '').trim() : ''});
    last = re.lastIndex;
  }
  parts.push({lit: format.slice(last)});
  /* An empty fact goes with the words before it, or — first in the line —
     with the words after it. */
  for(let i = 0; i < parts.length; i++){
    if(!('val' in parts[i]) || parts[i].val) continue;
    const before = parts.slice(0, i).some(p=> p.val);
    if(before && i > 0) parts[i - 1].lit = '';
    else if(i + 1 < parts.length) parts[i + 1].lit = '';
  }
  return parts.map(p=> 'val' in p ? p.val : p.lit).join('').trim();
}
function mediaLineOf(n){
  if(!n || !n.mediaType) return '';
  return mediaLineFor(mediaTypeById(n.mediaType), n.mediaData);
}
/* What a card's middle band says: its kind's line, in italics, or the
   medium typed by hand. */
function cardMediumOf(n){
  const line = mediaLineOf(n);
  if(line) return '*' + line.replace(/\*/g, '') + '*';
  return n && drawsOnChart(n.medium || '') ? String(n.medium).trim() : '';
}

/* ---- the drawer ---------------------------------------------------- */
/* A kind's id, from its name where the name will make one. */
function newMediaTypeId(name){
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stem = /^[a-z]/.test(base) ? base.slice(0, 30) : 'kind' + (base ? '-' + base.slice(0, 24) : '');
  const taken = new Set(mediaTypesOf().map(t=> t.id));
  let id = stem, k = 2;
  while(taken.has(id)) id = stem + '-' + (k++);
  return id;
}
function nextFieldId(kind){
  let k = 1;
  const taken = new Set(kind.fields.map(f=> f.id));
  while(taken.has('f' + k)) k++;
  return 'f' + k;
}
/* Every change is one edit of SETTINGS, undone as one. */
function editMediaTypes(fn){
  if(readOnlyView) return;
  applyEdit(()=>{
    const list = mediaTypesOf();
    fn(list);
    const clean = cleanMediaTypes(list);
    if(clean.length) SETTINGS.mediaTypes = clean; else delete SETTINGS.mediaTypes;
  });
  buildMediaTab();
}
function mediaUses(id){
  let k = 0;
  nodes.forEach(n=>{ if(n.mediaType === id) k++; });
  return k;
}
function buildMediaTab(){
  /* Looked up here, not once at the top: a drawer opened while the chart
     is first drawn asks for this before this part has run. */
  const mediaList = document.getElementById('mediaList');
  if(!mediaList) return;
  const scroll = mediaList.scrollTop;
  /* A change is committed when its field is left — by Tab as often as by
     a click — and the drawer is then built afresh; the field Tab went to
     is found again by its place, so typing carries on there. */
  const was = document.activeElement;
  const fields = ()=> Array.from(mediaList.querySelectorAll('input'));
  const at = was && mediaList.contains(was) ? fields().indexOf(was) : -1;
  mediaList.innerHTML = '';
  const kinds = mediaTypesOf();
  const head = sectionHead('Media', kinds.length);
  if(!readOnlyView){
    const add = makePlusButton('Add a kind of medium');
    add.addEventListener('click', ev=>{
      ev.stopPropagation();
      editMediaTypes(list=> list.push({id: newMediaTypeId('kind'), name: 'New kind', fields: [{id: 'f1', label: 'Year'}]}));
      const inputs = mediaList.querySelectorAll('.media-kind-name');
      const last = inputs[inputs.length - 1];
      if(last){ last.focus(); last.select(); }
    });
    head.appendChild(add);
  }
  mediaList.appendChild(head);
  if(!kinds.length){
    const empty = document.createElement('div');
    empty.className = 'key-empty';
    empty.textContent = 'No kinds yet. A kind is a template for a card’s middle line: a film with its studio, director and year, written in the order you set.';
    mediaList.appendChild(empty);
  }
  const input = (cls, value, placeholder, onDone)=>{
    const i = document.createElement('input');
    i.type = 'text';
    i.className = cls;
    i.value = value || '';
    i.placeholder = placeholder || '';
    i.spellcheck = false;
    i.addEventListener('change', ()=> onDone(i.value));
    i.addEventListener('keydown', ev=>{ if(ev.key === 'Enter'){ ev.preventDefault(); i.blur(); } ev.stopPropagation(); });
    return i;
  };
  const cross = (title, onClick)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'media-x';
    b.textContent = '✕';
    b.title = title;
    b.addEventListener('click', ev=>{ ev.stopPropagation(); onClick(); });
    return b;
  };
  kinds.forEach(kind=>{
    const box = document.createElement('div');
    box.className = 'media-kind';
    box.dataset.kind = kind.id;
    const top = document.createElement('div');
    top.className = 'media-kind-top';
    top.appendChild(input('media-kind-name', kind.name, 'Name of the kind', v=>
      editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t) t.name = v.trim() || t.name; })));
    const uses = mediaUses(kind.id);
    const count = document.createElement('span');
    count.className = 'media-kind-count';
    count.textContent = String(uses);
    count.title = uses === 1 ? 'One card is of this kind' : uses + ' cards are of this kind';
    top.appendChild(count);
    top.appendChild(cross('Take this kind out of the chart (its cards keep their facts)', ()=>
      editMediaTypes(list=>{ const i = list.findIndex(x=> x.id === kind.id); if(i >= 0) list.splice(i, 1); })));
    box.appendChild(top);
    kind.fields.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'media-field';
      row.appendChild(input('media-field-label', f.label, 'Field', v=>
        editMediaTypes(list=>{
          const t = list.find(x=> x.id === kind.id);
          const ff = t && t.fields.find(x=> x.id === f.id);
          if(ff) ff.label = v.trim();
        })));
      row.appendChild(cross('Take this field out of the kind', ()=>
        editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t) t.fields = t.fields.filter(x=> x.id !== f.id); })));
      box.appendChild(row);
    });
    const addField = document.createElement('button');
    addField.type = 'button';
    addField.className = 'media-add-field';
    addField.textContent = '+ field';
    addField.addEventListener('click', ev=>{
      ev.stopPropagation();
      editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t) t.fields.push({id: nextFieldId(t), label: ''}); });
      const rows = mediaList.querySelectorAll(`.media-kind[data-kind="${cssEscape(kind.id)}"] .media-field-label`);
      const last = rows[rows.length - 1];
      if(last) last.focus();
    });
    box.appendChild(addField);
    const fmtLabel = document.createElement('div');
    fmtLabel.className = 'media-format-label';
    fmtLabel.textContent = 'Written as';
    box.appendChild(fmtLabel);
    const auto = kind.fields.filter(f=> f.label).map(f=> '%' + f.label + '%').join(', ');
    const fmt = input('media-format', kind.format || '', auto || '%Field%, %Field%', v=>
      editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t){ if(v.trim()) t.format = v; else delete t.format; } }));
    fmt.title = 'Each %Field% is that field’s fact; empty, it takes its comma with it. Left blank, the fields are written in order with commas.';
    box.appendChild(fmt);
    mediaList.appendChild(box);
  });
  mediaList.scrollTop = scroll;
  if(at >= 0){ const f = fields()[at]; if(f) f.focus(); }
}

/* ---- the card's panel ---------------------------------------------- */
const editMediaTypeSelect = document.getElementById('editMediaTypeSelect');
const editMediaFields = document.getElementById('editMediaFields');
/* What the panel holds for the card being edited: its kind and its facts
   — the facts of every kind it has been, so switching kinds and back
   loses nothing typed. */
let editMediaState = {type: '', data: {}};
function fillMediaTypeForm(n){
  editMediaState = {type: (n && n.mediaType) || '', data: Object.assign({}, (n && n.mediaData) || {})};
  paintMediaTypeForm();
}
/* The list is made afresh each time: the kinds are the chart's, and the
   drawer may have changed them since the panel was last filled. A kind
   the chart no longer has stays in the list, named so, while the card
   still holds it. */
function paintMediaTypeForm(){
  if(!editMediaTypeSelect || !editMediaFields) return;
  const kinds = mediaTypesOf();
  const kind = mediaTypeById(editMediaState.type);
  editMediaTypeSelect.innerHTML = '';
  const option = (value, label)=>{
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    editMediaTypeSelect.appendChild(o);
  };
  option('', kinds.length ? 'None — typed by hand' : 'None — add kinds in the Media drawer');
  kinds.forEach(k=> option(k.id, k.name));
  if(editMediaState.type && !kind) option(editMediaState.type, 'Kind taken out');
  editMediaTypeSelect.value = editMediaState.type || '';
  editMediaTypeSelect.classList.toggle('none', !kind);
  editMediaFields.innerHTML = '';
  const typed = document.getElementById('editMediumInput');
  if(typed) typed.style.display = kind ? 'none' : '';
  if(!kind) return;
  kind.fields.forEach(f=>{
    const row = document.createElement('label');
    row.className = 'media-fact';
    const cap = document.createElement('span');
    cap.textContent = f.label || 'Field';
    const i = document.createElement('input');
    i.type = 'text';
    i.dataset.field = f.id;
    i.value = editMediaState.data[f.id] || '';
    i.addEventListener('input', ()=>{
      if(i.value.trim()) editMediaState.data[f.id] = i.value; else delete editMediaState.data[f.id];
      queueNodeEditCommit();
    });
    i.addEventListener('blur', ()=> flushNodeEditCommit());
    row.appendChild(cap);
    row.appendChild(i);
    editMediaFields.appendChild(row);
  });
  const line = mediaLineFor(kind, editMediaState.data);
  const prev = document.createElement('div');
  prev.className = 'media-preview';
  prev.textContent = line || '—';
  editMediaFields.appendChild(prev);
}
if(editMediaTypeSelect){
  editMediaTypeSelect.addEventListener('change', ()=>{
    editMediaState.type = editMediaTypeSelect.value;
    paintMediaTypeForm();
    queueNodeEditCommit(0);
  });
}
/* Into the entry's options, by commitNodeEdit: the kind and the facts of
   the fields it has; the facts of other kinds are not kept on the card. */
function mediaTypeOptsFromForm(opts, isCardNow){
  const kind = isCardNow ? mediaTypeById(editMediaState.type) : null;
  if(kind){
    opts.mediaType = kind.id;
    const data = {};
    kind.fields.forEach(f=>{ if(editMediaState.data[f.id]) data[f.id] = editMediaState.data[f.id]; });
    const clean = cleanMediaData(data);
    if(clean) opts.mediaData = clean; else delete opts.mediaData;
  } else if(isCardNow && editMediaState.type){
    /* A kind taken out of the chart: the card keeps what it had. */
  } else {
    delete opts.mediaType;
    delete opts.mediaData;
  }
  if(editMediaFields){
    const prev = editMediaFields.querySelector('.media-preview');
    if(prev && kind) prev.textContent = mediaLineFor(kind, editMediaState.data) || '—';
  }
}
