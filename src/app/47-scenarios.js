/* ---- Scenarios: what the chart does as it is read (the owner's list of
 *      22.11, the first step of the studio in To do)
 *
 * A scenario is a trigger and what follows it. The trigger is an entry
 * pressed, or an entry coming into view; what follows is a list of
 * actions, each about one entry: show it, hide it, fly the view to it, or
 * play one of three animations on it. They live in SETTINGS.scenarios,
 * saved with the chart:
 *
 *   {id, when: {type: 'press'|'inView', node}, then: [{do, node, anim?}]}
 *
 * Only a reader sees them happen — on the site, or in the editor's reader
 * mode, which is what the studio's Play is. An entry some scenario shows
 * is held back from a reader until it has been shown: not on the chart,
 * not in the search, not in the text version, because finding it there
 * would give away what pressing is meant to reveal. The editor always
 * sees every entry, so nothing can be lost by a scenario.
 *
 * What has happened is never saved: it is the reader's own reading, and
 * opening the chart again, or Reset in the studio, starts it over. */
var scnShown = null;          // entries a fired 'show' has brought out
var scnHidden = null;         // entries a fired 'hide' has taken away
var scnSeen = null;           // inView scenarios already fired
var scnPick = null;           // the studio waiting for an entry: a callback
var scnPanelKey = '';
/* Vars, as applyVisibility reaches the studio at start-up (tools/tdz.js). */
var SCN_TRIGGERS = ['press', 'inView'];
var SCN_ACTIONS = ['show', 'hide', 'fly', 'anim'];
var SCN_ANIMS = ['pulse', 'glow', 'shake'];

function cleanScenarios(v){
  if(!Array.isArray(v)) return [];
  const out = [];
  v.forEach(s=>{
    if(!s || typeof s !== 'object' || !s.when || typeof s.when !== 'object') return;
    const type = SCN_TRIGGERS.includes(s.when.type) ? s.when.type : 'press';
    const when = {type};
    if(typeof s.when.node === 'string' && s.when.node) when.node = s.when.node;
    const then = (Array.isArray(s.then) ? s.then : []).map(a=>{
      if(!a || typeof a !== 'object' || !SCN_ACTIONS.includes(a.do)) return null;
      const b = {do: a.do};
      if(typeof a.node === 'string' && a.node) b.node = a.node;
      if(a.do === 'anim') b.anim = SCN_ANIMS.includes(a.anim) ? a.anim : 'pulse';
      return b;
    }).filter(Boolean);
    const id = typeof s.id === 'string' && s.id ? s.id : 's' + Math.random().toString(36).slice(2, 9);
    out.push({id, when, then});
  });
  return out;
}
function scenarioList(){
  return (typeof SETTINGS !== 'undefined' && SETTINGS && Array.isArray(SETTINGS.scenarios)) ? SETTINGS.scenarios : [];
}
/* Held back from this reader: shown by some scenario that has not fired,
   or hidden by one that has. Asked by nodeHidden, the search and the text
   version; early in start-up, before this part has run, nothing is. */
function scenarioHeld(n){
  if(!n || !readOnlyView || !scnShown) return false;
  if(scnHidden.has(n.id)) return true;
  if(scnShown.has(n.id)) return false;
  return scenarioList().some(s=> s.then.some(a=> a.do === 'show' && a.node === n.id));
}
/* What the hold looks like: not the faint ghost a hidden tag leaves, but
   nothing, since a ghost is exactly what would give it away. Run at the
   end of every applyVisibility. */
function scenarioHoldSync(){
  if(!scnShown) return;
  const held = id=>{ const n = nodes.get(id); return !!n && scenarioHeld(n); };
  qNodes('.node').forEach(g=> g.classList.toggle('scn-held', held(g.dataset.id)));
  [...fanLayer.querySelectorAll(GROUND_PARTS), ...auraLayer.querySelectorAll('.node-aura')]
    .forEach(r=> r.classList.toggle('scn-held', held(r.dataset.id)));
  qEdges('.edge, .edge-hit, .edge-arrow, .edge-note').forEach(p=>
    p.classList.toggle('scn-held', held(p.dataset.from) || held(p.dataset.to)));
  if(studioOpen()) buildStudioIfChanged();
}
function scenariosReset(){
  scnShown = new Set(); scnHidden = new Set(); scnSeen = new Set();
}

/* ---- Playing them ---- */
function runScenario(s){
  let changed = false;
  s.then.forEach(a=>{
    const n = a.node && nodes.get(a.node);
    if(!n) return;
    if(a.do === 'show'){ scnShown.add(n.id); scnHidden.delete(n.id); changed = true; }
    else if(a.do === 'hide'){ scnHidden.add(n.id); changed = true; }
    else if(a.do === 'fly') flyToNode(n.id);
    else if(a.do === 'anim') playEntryAnim(n.id, a.anim);
  });
  if(changed){
    applyVisibility();
    if(typeof textViewChanged === 'function') textViewChanged();
  }
}
function playEntryAnim(id, anim){
  qNodes('.node').filter(g=> g.dataset.id === id).forEach(g=>{
    const cls = 'scn-' + (SCN_ANIMS.includes(anim) ? anim : 'pulse');
    SCN_ANIMS.forEach(a=> g.classList.remove('scn-' + a));
    void g.getBoundingClientRect();     // so the same one twice plays twice
    g.classList.add(cls);
    g.addEventListener('animationend', ()=> g.classList.remove(cls), {once: true});
  });
}
function scenariosPressed(id){
  if(!readOnlyView || !scnShown) return;
  scenarioList().forEach(s=>{ if(s.when.type === 'press' && s.when.node === id) runScenario(s); });
}
/* In view: some part of the entry inside the window. Asked once a frame at
   most, and only while a scenario is still waiting to fire. */
var scnViewAsked = false;
function scenariosInView(){
  if(!readOnlyView || !scnShown || scnViewAsked) return;
  if(!scenarioList().some(s=> s.when.type === 'inView' && !scnSeen.has(s.id))) return;
  scnViewAsked = true;
  requestAnimationFrame(()=>{
    scnViewAsked = false;
    const W = svg.clientWidth, H = svg.clientHeight;
    if(!W || !H) return;
    const x0 = -vx/vs, y0 = -vy/vs, x1 = x0 + W/vs, y1 = y0 + H/vs;
    scenarioList().forEach(s=>{
      if(s.when.type !== 'inView' || scnSeen.has(s.id)) return;
      const n = nodes.get(s.when.node);
      if(!n || scenarioHeld(n)) return;
      if(n.x < x1 && n.x + n.w > x0 && n.y < y1 && n.y + n.h > y0){ scnSeen.add(s.id); runScenario(s); }
    });
  });
}
svg.addEventListener('click', ev=>{
  const g = ev.target && ev.target.closest && ev.target.closest('.node');
  if(g && g.dataset.id) scenariosPressed(g.dataset.id);
}, true);
/* The studio picking an entry: the next press on the chart is that, and
   nothing else. */
svg.addEventListener('pointerdown', ev=>{
  if(!scnPick) return;
  ev.preventDefault(); ev.stopPropagation();
  const t = document.elementFromPoint(ev.clientX, ev.clientY);
  const g = t && t.closest && t.closest('.node');
  const cb = scnPick;
  scnPick = null;
  document.body.classList.remove('scn-picking');
  if(g && g.dataset.id) cb(g.dataset.id);
  else buildStudio();
}, true);

/* ---- The studio ---- */
function studioPanelEl(){ return document.getElementById('studioPanel'); }
function studioOpen(){ const p = studioPanelEl(); return !!p && !p.hidden; }
function setStudio(open){
  const p = studioPanelEl(), b = document.getElementById('studioToggle');
  if(!p) return;
  p.hidden = !open;
  if(b){ b.classList.toggle('active', open); b.setAttribute('aria-pressed', open ? 'true' : 'false'); }
  if(!open){ scnPick = null; document.body.classList.remove('scn-picking'); }
  if(open) buildStudio();
}
function editScenarios(fn){
  applyEdit(()=>{
    const list = cleanScenarios(scenarioList());
    fn(list);
    const next = cleanScenarios(list);
    if(next.length) SETTINGS.scenarios = next; else delete SETTINGS.scenarios;
  });
  buildStudio();
}
function scnEl(tag, cls, text){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text !== undefined) e.textContent = text;
  return e;
}
function scnSelect(values, labels, value, onChange){
  const s = scnEl('select', 'scn-select');
  values.forEach((v, i)=>{ const o = scnEl('option', '', labels[i]); o.value = v; s.appendChild(o); });
  s.value = value;
  s.addEventListener('change', ()=> onChange(s.value));
  return s;
}
/* An entry named by its words, pressed to choose another on the chart. */
function scnChip(id, onPick){
  const n = id && nodes.get(id);
  const b = scnEl('button', 'scn-chip' + (n ? '' : ' empty'));
  b.type = 'button';
  b.textContent = n ? (textViewName(n) || n.id) : 'Pick an entry';
  b.title = 'Press, then press an entry on the chart';
  b.addEventListener('click', ()=>{
    scnPick = onPick;
    document.body.classList.add('scn-picking');
    b.classList.add('picking');
    b.textContent = 'Press an entry…';
  });
  return b;
}
function buildStudioIfChanged(){
  const key = JSON.stringify(scenarioList());
  if(key !== scnPanelKey) buildStudio();
}
function buildStudio(){
  const body = document.getElementById('studioList');
  if(!body) return;
  scnPanelKey = JSON.stringify(scenarioList());
  body.innerHTML = '';
  const list = scenarioList();
  if(!list.length) body.appendChild(scnEl('div', 'scn-empty', 'No scenarios yet. Add one, then Play to see it as a reader does.'));
  list.forEach((s, si)=>{
    const card = scnEl('div', 'scn-card');
    const head = scnEl('div', 'scn-row');
    head.appendChild(scnEl('span', 'scn-word', 'When'));
    head.appendChild(scnChip(s.when.node, id=> editScenarios(l=>{ l[si].when.node = id; })));
    head.appendChild(scnSelect(SCN_TRIGGERS, ['is pressed', 'comes into view'], s.when.type,
      v=> editScenarios(l=>{ l[si].when.type = v; })));
    const del = scnEl('button', 'scn-x', '✕');
    del.type = 'button'; del.title = 'Remove this scenario';
    del.addEventListener('click', ()=> editScenarios(l=>{ l.splice(si, 1); }));
    head.appendChild(del);
    card.appendChild(head);
    s.then.forEach((a, ai)=>{
      const row = scnEl('div', 'scn-row scn-action');
      row.appendChild(scnSelect(SCN_ACTIONS, ['show', 'hide', 'fly to', 'animate'], a.do,
        v=> editScenarios(l=>{ l[si].then[ai].do = v; })));
      row.appendChild(scnChip(a.node, id=> editScenarios(l=>{ l[si].then[ai].node = id; })));
      if(a.do === 'anim') row.appendChild(scnSelect(SCN_ANIMS, ['pulse', 'glow', 'shake'], a.anim,
        v=> editScenarios(l=>{ l[si].then[ai].anim = v; })));
      const x = scnEl('button', 'scn-x', '✕');
      x.type = 'button'; x.title = 'Remove this action';
      x.addEventListener('click', ()=> editScenarios(l=>{ l[si].then.splice(ai, 1); }));
      row.appendChild(x);
      card.appendChild(row);
    });
    const add = scnEl('button', 'scn-add', '+ Action');
    add.type = 'button';
    add.addEventListener('click', ()=> editScenarios(l=>{ l[si].then.push({do: 'show'}); }));
    card.appendChild(add);
    body.appendChild(card);
  });
}
(function wireStudio(){
  const b = document.getElementById('studioToggle');
  if(b){
    b.addEventListener('mousedown', ev=> ev.stopPropagation());
    b.addEventListener('click', ev=>{ ev.stopPropagation(); setStudio(!studioOpen()); });
  }
  const p = studioPanelEl();
  if(p) p.addEventListener('mousedown', ev=> ev.stopPropagation());
  const on = (id, fn)=>{ const e = document.getElementById(id); if(e) e.addEventListener('click', fn); };
  on('studioAdd', ()=> editScenarios(l=>{ l.push({when: {type: 'press', node: selectedId || undefined}, then: [{do: 'show'}]}); }));
  on('studioClose', ()=> setStudio(false));
  /* Play is the reader's view, from the beginning; the studio stays open
     over it, and Play again goes back to editing. */
  on('studioPlay', ()=>{ scenariosReset(); setReaderPreview(!readerPreview); applyVisibility(); scenariosInView(); });
  on('studioReset', ()=>{ scenariosReset(); applyVisibility(); scenariosInView(); });
})();
scenariosReset();
if(readOnlyView){ applyVisibility(); scenariosInView(); }
