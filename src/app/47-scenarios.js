/* ---- Scenarios: what the chart does as it is read (the owner's list of
 *      22.11, the first step of the studio in To do)
 *
 * A scenario is a trigger and what follows it. The trigger is an entry
 * pressed, coming into sight, finishing an animation, appearing or going
 * (so scenarios set each other off, in chains), or the chart opening; what
 * follows is a list of actions, each about one entry: show it, hide it,
 * fly the view to it, or play one of three animations on it, each after so
 * many seconds if it says so. They live in SETTINGS.scenarios, saved with
 * the chart:
 *
 *   {id, when: {type, node?}, once?, then: [{do, node, anim?, wait?}]}
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
var scnSeen = null;           // scenarios that have fired (for those that fire once)
var scnInside = null;         // inView scenarios whose entry is in sight now
var scnTimers = [];           // steps waiting on their seconds
var scnPick = null;           // the studio waiting for an entry: a callback
var scnPanelKey = '';
/* Vars, as applyVisibility reaches the studio at start-up (tools/tdz.js). */
/* What sets a scenario off (the owner's list of 23.11 added the last four):
   an entry pressed, coming into sight, finishing an animation, being
   shown or hidden by another scenario — so one leads to the next — or the
   chart being opened. */
var SCN_TRIGGERS = ['press', 'inView', 'animEnd', 'shown', 'hidden', 'start', 'switchOn', 'switchOff'];
var SCN_TRIGGER_WORDS = ['is pressed', 'comes into view', 'finishes an animation', 'appears', 'disappears', 'the chart opens', 'is switched to 1', 'is switched to 0'];
var SCN_ACTIONS = ['show', 'hide', 'fly', 'anim'];
var SCN_ANIMS = ['pulse', 'glow', 'shake'];
/* How long each animation runs (style.css, .node.scn-*), so what follows
   it can start when it ends even on an entry that is not drawn. */
var SCN_ANIM_MS = {pulse: 1800, glow: 1400, shake: 500};
/* A chain of scenarios that set each other off at once — A shows B, B's
   appearing hides A, A's going shows B… — is cut here rather than left to
   run the page out of stack. One with seconds in it is a loop meant to
   run, and runs. */
var SCN_DEPTH = 24;
var SCN_WAIT_MAX = 3600;

function cleanScenarios(v){
  if(!Array.isArray(v)) return [];
  const out = [];
  v.forEach(s=>{
    if(!s || typeof s !== 'object' || !s.when || typeof s.when !== 'object') return;
    const type = SCN_TRIGGERS.includes(s.when.type) ? s.when.type : 'press';
    const when = {type};
    if(type !== 'start' && typeof s.when.node === 'string' && s.when.node) when.node = s.when.node;
    const then = (Array.isArray(s.then) ? s.then : []).map(a=>{
      if(!a || typeof a !== 'object' || !SCN_ACTIONS.includes(a.do)) return null;
      const b = {do: a.do};
      if(typeof a.node === 'string' && a.node) b.node = a.node;
      if(a.do === 'anim') b.anim = SCN_ANIMS.includes(a.anim) ? a.anim : 'pulse';
      const w = Number(a.wait);
      if(Number.isFinite(w) && w > 0) b.wait = Math.min(SCN_WAIT_MAX, Math.round(w * 10) / 10);
      return b;
    }).filter(Boolean);
    const id = typeof s.id === 'string' && s.id ? s.id : 's' + Math.random().toString(36).slice(2, 9);
    const one = {id, when, then};
    if(s.once === true && type !== 'start') one.once = true;
    out.push(one);
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
  scnTimers.forEach(t=> clearTimeout(t));
  scnTimers = [];
  scnShown = new Set(); scnHidden = new Set(); scnSeen = new Set(); scnInside = new Map();
}

/* ---- Playing them ---- */
/* Everything a trigger of this kind on this entry sets off. */
function scenariosFire(type, node, depth){
  if(!readOnlyView || !scnShown || (depth || 0) > SCN_DEPTH) return;
  scenarioList().forEach(s=>{
    if(s.when.type !== type || (type !== 'start' && s.when.node !== node)) return;
    if(s.once && scnSeen.has(s.id)) return;
    scnSeen.add(s.id);
    runScenario(s, (depth || 0) + 1);
  });
}
/* The steps in order; a step with seconds waits them after the step above
   it (or after the trigger), and the steps under it wait with it. */
function runScenario(s, depth){
  let at = 0;
  const now = [];
  s.then.forEach(a=>{
    at += (a.wait || 0) * 1000;
    if(!at){ now.push(a); return; }
    const t = setTimeout(()=>{
      scnTimers = scnTimers.filter(x=> x !== t);
      if(readOnlyView && scnShown) scenarioSteps([a], 0);
    }, at);
    scnTimers.push(t);
  });
  if(now.length) scenarioSteps(now, depth || 0);
}
function scenarioSteps(steps, depth){
  const appeared = [], went = [], anims = [];
  steps.forEach(a=>{
    const n = a.node && nodes.get(a.node);
    if(!n) return;
    if(a.do === 'show'){
      const was = scenarioHeld(n);
      scnShown.add(n.id); scnHidden.delete(n.id);
      if(was) appeared.push(n.id);
    } else if(a.do === 'hide'){
      const was = scenarioHeld(n);
      scnHidden.add(n.id);
      if(!was) went.push(n.id);
    } else if(a.do === 'fly') flyToNode(n.id);
    else if(a.do === 'anim') anims.push(a);
  });
  if(appeared.length || went.length){
    applyVisibility();
    if(typeof textViewChanged === 'function') textViewChanged();
  }
  anims.forEach(a=> playEntryAnim(a.node, a.anim, depth));
  appeared.forEach(id=> scenariosFire('shown', id, depth));
  went.forEach(id=> scenariosFire('hidden', id, depth));
}
function playEntryAnim(id, anim, depth){
  const kind = SCN_ANIMS.includes(anim) ? anim : 'pulse';
  qNodes('.node').filter(g=> g.dataset.id === id).forEach(g=>{
    const cls = 'scn-' + kind;
    SCN_ANIMS.forEach(a=> g.classList.remove('scn-' + a));
    void g.getBoundingClientRect();     // so the same one twice plays twice
    g.classList.add(cls);
    g.addEventListener('animationend', ()=> g.classList.remove(cls), {once: true});
  });
  /* What follows the animation starts when it ends — timed rather than
     heard, since an entry held back or hidden by its tags has nothing on
     screen to end, and the chain must not stop there. */
  if(!scenarioList().some(s=> s.when.type === 'animEnd' && s.when.node === id)) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t = setTimeout(()=>{
    scnTimers = scnTimers.filter(x=> x !== t);
    scenariosFire('animEnd', id, depth);
  }, reduced ? 0 : SCN_ANIM_MS[kind]);
  scnTimers.push(t);
}
function scenariosPressed(id){
  if(!readOnlyView || !scnShown) return;
  scenariosFire('press', id, 0);
}
/* In sight: as much as half of the entry on the screen and not under
 * anything — not off the edge, and not under the bar, a drawer, the entry
 * sheet or another entry, which a reader cannot see through either (the
 * owner's list of 23.11). Asked of the page itself, at a grid of points
 * over the entry: what is there is the chart, or this entry, or it is
 * not seen. An entry larger than the screen is in sight once it fills
 * two fifths of the chart's part of it.
 *
 * A scenario on it fires each time it COMES into sight, so it plays
 * again when the entry has been away and comes back — unless it is one
 * that fires once. */
function entryInSight(n){
  if(!n || scenarioHeld(n) || nodeHidden(n)) return false;
  const r = svg.getBoundingClientRect();
  if(!r.width || !r.height) return false;
  const W = window.innerWidth || document.documentElement.clientWidth;
  const H = window.innerHeight || document.documentElement.clientHeight;
  const x0 = r.left + vx + n.x*vs, y0 = r.top + vy + n.y*vs, w = n.w*vs, h = n.h*vs;
  if(!(w > 0 && h > 0)) return false;
  const K = 5;
  let seen = 0, there = 0;
  for(let i = 0; i < K; i++) for(let j = 0; j < K; j++){
    const x = x0 + (i + 0.5) * w / K, y = y0 + (j + 0.5) * h / K;
    if(x < 0 || y < 0 || x >= W || y >= H) continue;
    if(x < r.left || y < r.top || x >= r.right || y >= r.bottom) continue;
    there++;
    const e = document.elementFromPoint(x, y);
    if(!e || !(e === svg || svg.contains(e))) continue;
    const g = e.closest && e.closest('.node');
    if(g && g.dataset.id !== n.id) continue;
    seen++;
  }
  const enough = (k)=>{ const part = k / (K*K); return part >= 0.5 || part * w * h >= 0.4 * r.width * r.height; };
  /* On the screen but under something: neither in sight nor out of it.
     An entry a menu passed over and left was never away, and coming out
     from under it is not coming into view (the owner's list of 24.11). */
  return enough(seen) ? true : enough(there) ? 'covered' : false;
}
var scnViewAsked = false;
function scenariosInView(){
  if(!readOnlyView || !scnShown || scnViewAsked) return;
  if(!scenarioList().some(s=> s.when.type === 'inView' && !(s.once && scnSeen.has(s.id)))) return;
  scnViewAsked = true;
  requestAnimationFrame(()=>{
    scnViewAsked = false;
    if(!readOnlyView || !scnShown) return;
    const sight = new Map();
    scenarioList().forEach(s=>{
      if(s.when.type !== 'inView') return;
      const id = s.when.node;
      if(!sight.has(id)) sight.set(id, entryInSight(nodes.get(id)));
      const was = !!scnInside.get(s.id);
      const now = sight.get(id) === 'covered' ? was : sight.get(id);
      scnInside.set(s.id, now);
      if(now && !was && !(s.once && scnSeen.has(s.id))){ scnSeen.add(s.id); runScenario(s, 1); }
    });
  });
}
/* Asked on every move of the view (applyTransform), and every little
   while besides: a drawer opening, the bar coming back or a sheet rising
   can cover an entry, or uncover it, with the view standing still. */
setInterval(scenariosInView, 300);
/* The chart opened, or Play pressed: what is set off by opening it. */
function scenariosStart(){
  if(!readOnlyView || !scnShown) return;
  scenariosFire('start', null, 0);
  scenariosInView();
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
  /* The press is the pick and nothing else (the owner's list of 24.11):
     the click and the double click that follow it would select the
     entry, fly to it or open its words for writing. */
  scnPickedAt = performance.now();
  if(g && g.dataset.id) cb(g.dataset.id);
  else buildStudio();
}, true);
var scnPickedAt = -1e9;
function scnPickSwallows(){ return !!scnPick || performance.now() - scnPickedAt < 600; }
['click', 'dblclick', 'mousedown', 'mouseup'].forEach(type=> svg.addEventListener(type, ev=>{
  if(!scnPickSwallows()) return;
  ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
}, true));

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
    if(s.when.type !== 'start') head.appendChild(scnChip(s.when.node, id=> editScenarios(l=>{ l[si].when.node = id; })));
    head.appendChild(scnSelect(SCN_TRIGGERS, SCN_TRIGGER_WORDS, s.when.type,
      v=> editScenarios(l=>{ l[si].when.type = v; })));
    if(s.when.type !== 'start'){
      const rep = scnSelect(['every', 'once'], ['every time', 'once'], s.once ? 'once' : 'every',
        v=> editScenarios(l=>{ if(v === 'once') l[si].once = true; else delete l[si].once; }));
      rep.title = 'Every time it happens, or only the first time';
      head.appendChild(rep);
    }
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
      /* A timer: the seconds this step waits after the one above it. */
      const wait = scnEl('label', 'scn-wait');
      wait.title = ai ? 'Seconds to wait after the step above' : 'Seconds to wait after it happens';
      wait.appendChild(scnEl('span', 'scn-word', 'after'));
      const sec = scnEl('input', 'scn-secs');
      sec.type = 'number'; sec.min = '0'; sec.max = String(SCN_WAIT_MAX); sec.step = '0.1';
      sec.inputMode = 'decimal'; sec.placeholder = '0';
      sec.value = a.wait ? String(a.wait) : '';
      sec.addEventListener('change', ()=> editScenarios(l=>{
        const v = parseFloat(sec.value);
        if(v > 0) l[si].then[ai].wait = v; else delete l[si].then[ai].wait;
      }));
      wait.appendChild(sec);
      wait.appendChild(scnEl('span', 'scn-word', 's'));
      row.appendChild(wait);
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
  on('studioPlay', ()=>{ scenariosReset(); setReaderPreview(!readerPreview); applyVisibility(); scenariosStart(); });
  on('studioReset', ()=>{ scenariosReset(); applyVisibility(); scenariosStart(); });
})();
scenariosReset();
if(readOnlyView){ applyVisibility(); scenariosStart(); }
