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
    /* A kind's own line, `format` ("%Studio%, %Year%"), is not kept: the
       owner had it taken out (the owner's list of 11.11) — the fields are
       written in the order they stand, top to bottom, and that order is
       the line. A chart that still has one loses it the next time its
       kinds are edited, and is drawn without it until then.
     *
       What came back (the owner's list of 21.11) is the words BETWEEN the
       facts, `joins`: one before the first, one after each — so a film
       can read "Mainframe (1996)" — kept by place, not by field, so a
       field carried to another place takes its fact there and leaves the
       punctuation where it stood. Only kept where it says something the
       commas do not. */
    const joins = Array.isArray(t.joins) && t.joins.length === kind.fields.length + 1 &&
                  t.joins.every(j=> typeof j === 'string')
      ? t.joins.map(j=> j.replace(/[\r\n]+/g, ' ').slice(0, 24)) : null;
    if(joins && joins.join('\u0000') !== defaultJoins(kind.fields.length).join('\u0000')) kind.joins = joins;
    out.push(kind);
  });
  return out.slice(0, 100);
}
/* The words a kind writes between its facts when nobody has said
   otherwise: nothing before or after, a comma between. */
function defaultJoins(n){
  return n ? ['', ...Array(Math.max(0, n - 1)).fill(', '), ''] : [''];
}
function joinsOf(kind){
  return kind && Array.isArray(kind.joins) && kind.joins.length === kind.fields.length + 1
    ? kind.joins.slice() : defaultJoins(kind ? kind.fields.length : 0);
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
/* The line a kind writes for these facts: its fields' facts in the order
   the fields stand, with the kind's words between them (a comma, unless
   it was given others). A fact not given is left out with the words
   before it — or, first in the line, the words after it — so a film with
   no director reads "Mainframe, 1996", not "Mainframe, , 1996". A field
   with no name is not written either — it is one nobody has said what
   goes in yet. The words before the first fact and after the last are
   written only round a line that has a fact in it. */
function mediaLineFor(kind, data){
  if(!kind) return '';
  const facts = data || {};
  const joins = joinsOf(kind);
  const vals = kind.fields.map(f=> f.label ? String(facts[f.id] || '').replace(/\s+/g, ' ').trim() : '');
  let out = '', any = false;
  vals.forEach((v, i)=>{
    if(!v) return;
    out += any ? joins[i] : '';
    out += v;
    any = true;
  });
  return any ? (joins[0] + out + joins[joins.length - 1]).trim() : '';
}
function mediaLineOf(n){
  if(!n || !n.mediaType) return '';
  return mediaLineFor(mediaTypeById(n.mediaType), n.mediaData);
}
/* What a card's middle band says: its kind's line, in italics.
 *
   It could also be a line typed by hand, under "None" in the kind list.
   The owner had that taken out (the owner's list of 7.11, the morning
   after): a card's middle line is what its kind makes of its facts, and
   a chart's old typed line (`medium`) is read, kept until the card is
   next edited, and not drawn. */
function cardMediumOf(n){
  const line = mediaLineOf(n);
  return line ? '*' + line.replace(/\*/g, '') + '*' : '';
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
/* Which kinds are unfolded in the drawer. Folded, a kind is one line —
   its name, its count and its ✕ — since the drawer is a fifth of the
   edge and three unfolded kinds filled it (the owner's list of 2.11,
   evening). Kept on the function rather than in a const, which the
   drawer could be built before. */
function mediaKindsOpen(){ return mediaKindsOpen.set || (mediaKindsOpen.set = new Set()); }
/* A kind's heading folds it, as a category's does, a moment after the
   click — the second click of a double is "rename", and folding the kind
   away under the pointer first is the wrong answer to it. */
let mediaHeadTimer = 0;
function buildMediaTab(){
  /* Looked up here, not once at the top: a drawer opened while the chart
     is first drawn asks for this before this part has run. */
  const mediaList = document.getElementById('mediaList');
  if(!mediaList) return;
  const scroll = mediaList.scrollTop;
  mediaList.innerHTML = '';
  const kinds = mediaTypesOf();
  const head = sectionHead('Media', kinds.length);
  if(!readOnlyView){
    const add = makePlusButton('Add a kind of medium', MEDIA_ADD_SVG);
    add.addEventListener('click', ev=>{
      ev.stopPropagation();
      const id = newMediaTypeId('kind');
      mediaKindsOpen().add(id);
      editMediaTypes(list=> list.push({id, name: 'New kind', fields: [{id: 'f1', label: 'Year'}]}));
      startMediaRename(mediaList.querySelector(`.media-kind[data-kind="${cssEscape(id)}"] .media-kind-name`));
    });
    head.appendChild(add);
  }
  mediaList.appendChild(head);
  if(!kinds.length){
    const empty = document.createElement('div');
    empty.className = 'key-empty';
    empty.textContent = 'No kinds yet. A kind is a template for a card’s middle line: a film with its studio, director and year, written in the order its fields stand.';
    mediaList.appendChild(empty);
  }
  /* A name is text, not a field (the owner's list of 11.11): it reads as
     the other panels' names do, and a double click types over it where
     it stands. */
  const nameText = (cls, value, placeholder, title, onDone)=>{
    const t = document.createElement('span');
    t.className = cls;
    t.textContent = value || '';
    t.dataset.placeholder = placeholder;
    t._rename = ()=> renameInPlace(t, value, v=>{ if(v === null) buildMediaTab(); else onDone(v); }, cls === 'media-kind-name' ? 60 : 40);
    if(!readOnlyView){
      t.title = title + ' — double-click to rename';
      t.addEventListener('dblclick', ev=>{
        if(t.isContentEditable) return;
        ev.preventDefault(); ev.stopPropagation();
        if(mediaHeadTimer){ clearTimeout(mediaHeadTimer); mediaHeadTimer = 0; }
        t._rename();
      });
    }
    return t;
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
    /* A reader is shown the kinds and their eyes, not their insides: no
       ▸ and no fold on the heading (the owner's list of 15.11). */
    const open = !readOnlyView && mediaKindsOpen().has(kind.id);
    box.classList.toggle('shut', !open);
    const top = document.createElement('div');
    top.className = 'media-kind-top';
    if(!readOnlyView) top.title = open ? 'Fold this kind away' : 'Unfold this kind: its fields';
    const toggle = ()=>{
      const set = mediaKindsOpen();
      const shutting = set.has(kind.id);
      /* Folding moves, as a tag category's does (the owner's list of 24.11). */
      foldWithMotion(box, shutting, ()=>{
        if(shutting) set.delete(kind.id); else set.add(kind.id);
        buildMediaTab();
      }, ()=> [...document.querySelectorAll('#mediaList .media-kind')].find(b=> b.dataset.kind === kind.id));
    };
    /* The heading folds, as a category's does; the ▸ stands between the
       name and the count, where the tags panel has it. */
    if(!readOnlyView) top.addEventListener('click', ev=>{
      if(ev.target.closest('button') || ev.target.isContentEditable) return;
      if(mediaHeadTimer){ clearTimeout(mediaHeadTimer); mediaHeadTimer = 0; return; }
      mediaHeadTimer = setTimeout(()=>{ mediaHeadTimer = 0; toggle(); }, DOUBLE_CLICK_GRACE);
    });
    /* Its eye, as a tag's: every entry of this kind faded off the chart
       and back, whether or not it is drawn as a card just now. */
    {
      const off = hiddenMediaKinds.has(kind.id);
      const eye = makeEyeButton(off, (off ? 'Show' : 'Hide') + ' the entries of this kind');
      eye.addEventListener('click', ev=>{
        ev.stopPropagation();
        if(hiddenMediaKinds.has(kind.id)) hiddenMediaKinds.delete(kind.id); else hiddenMediaKinds.add(kind.id);
        applyVisibility(); buildMediaTab();
      });
      top.appendChild(eye);
      box.classList.toggle('off', off);
    }
    top.appendChild(nameText('media-kind-name', kind.name, 'Name of the kind', kind.name, v=>
      editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t) t.name = v || t.name; })));
    if(!readOnlyView){
      const fold = document.createElement('button');
      fold.type = 'button';
      fold.className = 'media-fold';
      fold.textContent = '▸';
      fold.title = top.title;
      fold.setAttribute('aria-expanded', open ? 'true' : 'false');
      fold.addEventListener('click', ev=>{ ev.stopPropagation(); toggle(); });
      top.appendChild(fold);
    }
    const uses = mediaUses(kind.id);
    const count = document.createElement('span');
    count.className = 'media-kind-count';
    count.textContent = String(uses);
    /* Every entry that holds this kind's facts, drawn as a card or not:
       card layout turned off keeps them for when it is turned on. */
    count.title = uses === 1 ? 'One entry is of this kind' : uses + ' entries are of this kind';
    top.appendChild(count);
    if(!readOnlyView) top.appendChild(cross('Take this kind out of the chart (its cards keep their facts)', ()=>
      editMediaTypes(list=>{ const i = list.findIndex(x=> x.id === kind.id); if(i >= 0) list.splice(i, 1); })));
    box.appendChild(top);
    if(!readOnlyView) kind.fields.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'media-field';
      row.dataset.field = f.id;
      row.appendChild(nameText('media-field-label', f.label, 'Field', 'A field of this kind; the line writes them in this order', v=>
        editMediaTypes(list=>{
          const t = list.find(x=> x.id === kind.id);
          const ff = t && t.fields.find(x=> x.id === f.id);
          if(ff) ff.label = v;
        })));
      if(!readOnlyView) row.appendChild(cross('Take this field out of the kind', ()=>
        editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t) dropMediaField(t, f.id); })));
      /* Picked up by the row, as a reference is, and put where it goes:
         the line below writes the fields in this order (the owner's list
         of 21.11). The grip is there for a finger, which cannot pick up
         a row it would otherwise scroll. */
      const grip = document.createElement('span');
      grip.className = 'media-grip';
      grip.title = 'Drag to another place in the line';
      grip.innerHTML = '<svg viewBox="0 0 8 12" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/></g></svg>';
      row.insertBefore(grip, row.firstChild);
      const pick = ev=>{
        if(ev.target.isContentEditable) return;
        beginListDrag(ev, 'mediaField', kind.id + '\u0000' + f.id, f.label || 'Field');
      };
      row.addEventListener('mousedown', pick);
      grip.addEventListener('pointerdown', ev=>{ if(ev.pointerType !== 'mouse') pick(ev); });
      box.appendChild(row);
    });
    if(!readOnlyView){
      /* The + every other list on the page adds with (the owner's list of
         11.11, afternoon), not a dashed "+ field" of its own. */
      const addField = makePlusButton('Add a field to this kind');
      addField.classList.add('media-add-field');
      addField.addEventListener('click', ev=>{
        ev.stopPropagation();
        let fid = null;
        editMediaTypes(list=>{ const t = list.find(x=> x.id === kind.id); if(t){ fid = nextFieldId(t); addMediaField(t, fid); } });
        if(fid) startMediaRename(mediaList.querySelector(
          `.media-kind[data-kind="${cssEscape(kind.id)}"] .media-field[data-field="${fid}"] .media-field-label`));
      });
      box.appendChild(addField);
      box.appendChild(mediaLinePreview(kind));
    }
    mediaList.appendChild(box);
  });
  mediaList.scrollTop = scroll;
}
/* A field added goes at the end of the line, after a comma; the words
   after the last fact stay after the last fact. */
function addMediaField(t, fid){
  const joins = joinsOf(t);
  t.fields.push({id: fid, label: ''});
  if(t.fields.length === 1) t.joins = [joins[0], ''];
  else { joins.splice(joins.length - 1, 0, ', '); t.joins = joins; }
}
/* A field taken out takes the words after it, or — the last one — the
   words before it, so the words round the whole line stay round it. */
function dropMediaField(t, fid){
  const i = t.fields.findIndex(x=> x.id === fid);
  if(i < 0) return;
  const joins = joinsOf(t);
  t.fields.splice(i, 1);
  if(!t.fields.length){ t.joins = [joins[0] + joins[joins.length - 1]]; return; }
  joins.splice(i < t.fields.length ? i + 1 : i, 1);
  t.joins = joins;
}
/* A field carried to another place: the facts move, the words between
   them stay where they stand. */
function moveMediaField(kindId, fid, overFid, where){
  editMediaTypes(list=>{
    const t = list.find(x=> x.id === kindId);
    if(!t) return;
    const joins = joinsOf(t);
    const i = t.fields.findIndex(x=> x.id === fid);
    if(i < 0) return;
    const [it] = t.fields.splice(i, 1);
    const j = t.fields.findIndex(x=> x.id === overFid);
    if(j < 0){ t.fields.splice(i, 0, it); return; }
    t.fields.splice(where === 'after' ? j + 1 : j, 0, it);
    t.joins = joins;
  });
}
/* The line a kind writes, as it will be drawn, with the words between
 * the facts there to be typed over (the owner's list of 21.11).
 *
   Each fact is shown by its field's name, in a chip that can be carried
   along the line as the rows above can; the words between them are the
   kind's own and are typed where they stand — a comma, " (" and ")", a
   " — ". A sample of the line, a card's facts, would read better and
   say less: what is being written here is where each fact goes. */
function mediaLinePreview(kind){
  const wrap = document.createElement('div');
  wrap.className = 'media-written';
  const cap = document.createElement('div');
  cap.className = 'media-written-label';
  cap.textContent = 'Written as';
  wrap.appendChild(cap);
  const line = document.createElement('div');
  line.className = 'media-line';
  const joins = joinsOf(kind);
  const join = (i)=>{
    const j = document.createElement('span');
    j.className = 'media-join';
    j.dataset.at = String(i);
    j.textContent = joins[i];
    j.title = i === 0 ? 'Words before the first fact'
            : i === joins.length - 1 ? 'Words after the last fact'
            : 'Words between these two facts';
    if(!readOnlyView){
      j.contentEditable = 'plaintext-only';
      j.spellcheck = false;
      j.addEventListener('keydown', ev=>{
        if(ev.key === 'Enter'){ ev.preventDefault(); j.blur(); }
        else if(ev.key === 'Escape'){ ev.preventDefault(); j.textContent = joins[i]; j.blur(); }
        ev.stopPropagation();
      });
      j.addEventListener('blur', ()=>{
        const v = j.textContent.replace(/[\r\n]+/g, ' ').slice(0, 24);
        if(v === joins[i]) return;
        editMediaTypes(list=>{
          const t = list.find(x=> x.id === kind.id);
          if(!t) return;
          const js = joinsOf(t);
          js[i] = v;
          t.joins = js;
        });
      });
    }
    return j;
  };
  line.appendChild(join(0));
  kind.fields.forEach((f, k)=>{
    const chip = document.createElement('span');
    chip.className = 'media-chip' + (f.label ? '' : ' unnamed');
    chip.dataset.field = f.id;
    chip.dataset.kind = kind.id;
    chip.textContent = f.label || 'Field';
    if(!readOnlyView){
      chip.title = 'Drag to another place in the line';
      chip.addEventListener('mousedown', ev=> beginListDrag(ev, 'mediaField', kind.id + '\u0000' + f.id, f.label || 'Field'));
      chip.addEventListener('pointerdown', ev=>{ if(ev.pointerType !== 'mouse') beginListDrag(ev, 'mediaField', kind.id + '\u0000' + f.id, f.label || 'Field'); });
    }
    line.appendChild(chip);
    line.appendChild(join(k + 1));
  });
  wrap.appendChild(line);
  return wrap;
}
/* A name in the drawer, typed over at once: what a kind just made or a
   field just added wants first. */
function startMediaRename(t){ if(t && t._rename) t._rename(); }

/* ---- the card's panel ---------------------------------------------- */
const editMediaTypeSelect = document.getElementById('editMediaTypeSelect');
const editMediaFields = document.getElementById('editMediaFields');
/* What the panel holds for the card being edited: its kind and its facts
   — the facts of every kind it has been, so switching kinds and back
   loses nothing typed. Kept kind by kind: a fact is filed under its
   field's id, and every kind numbers its fields from f1, so one shared
   set handed a film's studio to a book as its author the moment the
   card was switched (code 1, 2.11). */
let editMediaState = {type: '', data: {}, byKind: {}};
function fillMediaTypeForm(n){
  const type = (n && n.mediaType) || '';
  const data = Object.assign({}, (n && n.mediaData) || {});
  editMediaState = {type, data, byKind: type ? {[type]: data} : {}};
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
  /* "None", not "None — typed by hand": the line under the list is
     there to be typed in, and an option naming it read as a mode of its
     own (the owner's list of 7.11). */
  option('', kinds.length ? 'None' : 'None — add kinds in the Media drawer');
  kinds.forEach(k=> option(k.id, k.name));
  if(editMediaState.type && !kind) option(editMediaState.type, 'Kind taken out');
  editMediaTypeSelect.value = editMediaState.type || '';
  editMediaTypeSelect.classList.toggle('none', !kind);
  editMediaFields.innerHTML = '';
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
}
if(editMediaTypeSelect){
  editMediaTypeSelect.addEventListener('change', ()=>{
    const st = editMediaState;
    if(st.type) st.byKind[st.type] = st.data;
    st.type = editMediaTypeSelect.value;
    st.data = (st.type && st.byKind[st.type]) || {};
    if(st.type) st.byKind[st.type] = st.data;
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
}
