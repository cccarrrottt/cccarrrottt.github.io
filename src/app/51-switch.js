/* =========================================================================
   A SWITCH, SET UP
   -------------------------------------------------------------------------
   An entry that is 0 or 1 (the owner's list of 25.11): its pill is drawn
   and pressed in 13-render-nodes.js (drawSwitchPill, flipSwitch), which a
   reader needs; what is here is the owner's. Switch in the menu a right
   click or a held finger opens on one entry makes it a switch, and on a
   switch opens this: the words each state shows on the pill, the colour
   the entry wears at 1, and what it starts at. It is opts.switch,
   {on?, offLabel?, onLabel?, onColor?}, and every change is an edit.
   On the site it is part of the editor's file (LAZY_PARTS).
   ========================================================================= */
const switchMenu = document.createElement('div');
switchMenu.className = 'bg-menu switch-menu';
switchMenu.id = 'switchMenu';
switchMenu.hidden = true;
switchMenu.setAttribute('role', 'dialog');
switchMenu.setAttribute('aria-label', 'Switch');
function setSwitch(id, change){
  applyEdit(()=>{
    const w = workingEntry(id);
    if(!w) return;
    const opts = entryOpts(w.entry);
    if(change === null) delete opts.switch;
    else {
      const sw = Object.assign({}, opts.switch || {}, change);
      Object.keys(sw).forEach(k=>{ if(sw[k] === undefined || sw[k] === '' || sw[k] === false) delete sw[k]; });
      opts.switch = sw;
    }
    putEntry(w.index, w.entry, opts);
  });
}
function buildSwitchMenu(id){
  const w = workingEntry(id);
  const sw = (w && w.entry[6] && w.entry[6].switch) || {};
  switchMenu.textContent = '';
  const head = document.createElement('div');
  head.className = 'bg-menu-head';
  head.textContent = 'Switch';
  switchMenu.appendChild(head);
  const row = (label)=>{
    const r = document.createElement('div');
    r.className = 'bg-menu-row';
    const l = document.createElement('span');
    l.className = 'bg-menu-label';
    l.textContent = label;
    r.appendChild(l);
    switchMenu.appendChild(r);
    return r;
  };
  const sr = row('Starts at');
  const start = document.createElement('select');
  start.className = 'style-select switch-start';
  [['0', '0'], ['1', '1']].forEach(([v, t])=>{
    const o = document.createElement('option'); o.value = v; o.textContent = t; start.appendChild(o);
  });
  start.value = sw.on ? '1' : '0';
  start.addEventListener('change', ()=> setSwitch(id, {on: start.value === '1'}));
  sr.appendChild(start);
  /* The words on the pill for each state: typed and kept when the field
     is left, as every other name on the page is. */
  [['offLabel', 'At 0', '0'], ['onLabel', 'At 1', '1']].forEach(([k, label, ph])=>{
    const r = row(label);
    const box = document.createElement('input');
    box.type = 'text'; box.className = 'switch-words-field'; box.maxLength = 40;
    box.placeholder = ph; box.value = sw[k] || ''; box.dataset.field = k;
    box.setAttribute('translate', 'no');
    box.addEventListener('change', ()=> setSwitch(id, {[k]: box.value.trim() || undefined}));
    box.addEventListener('keydown', ev=>{ if(ev.key === 'Enter') box.blur(); ev.stopPropagation(); });
    r.appendChild(box);
  });
  const cr = row('Colour at 1');
  const wrap = document.createElement('div');
  wrap.className = 'hex-field';
  const box = document.createElement('input');
  box.type = 'text'; box.className = 'tb-hex'; box.maxLength = 9; box.spellcheck = false;
  box.value = sw.onColor || '';
  wrap.appendChild(box);
  cr.appendChild(wrap);
  squareForHexInput(box, {title: 'The colour it wears at 1', fallback: ()=> (nodes.get(id) || {}).color || '#1a1a1a'});
  box.addEventListener('input', ()=>{
    const v = hexFieldValue(box.value);
    if(HEX_RE.test(v)) setSwitch(id, {onColor: v.toLowerCase()});
  });
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'hex-reset'; reset.textContent = '⟲';
  reset.title = 'Its own colour at 1 too'; reset.disabled = !sw.onColor;
  reset.addEventListener('click', ev=>{ ev.stopPropagation(); setSwitch(id, {onColor: undefined}); buildSwitchMenu(id); });
  cr.appendChild(reset);
  const off = document.createElement('button');
  off.type = 'button'; off.className = 'switch-off';
  off.textContent = 'Not a switch';
  off.addEventListener('click', ev=>{ ev.stopPropagation(); setSwitch(id, null); closeSwitchMenu(); });
  switchMenu.appendChild(off);
}
/* Asked of an entry that is not a switch yet, it makes it one first. */
function openSwitchMenu(x, y, id){
  if(readOnlyView) return;
  const n = nodes.get(id);
  if(!switchable(n)) return;
  if(!n.switch) setSwitch(id, {});
  buildSwitchMenu(id);
  switchMenu.hidden = false;
  switchMenu.dataset.id = id;
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const w = switchMenu.offsetWidth, h = switchMenu.offsetHeight;
  let left = x - host.left + 2, top = y - host.top + 2;
  if(left + w > host.width - 4) left = x - host.left - w - 2;
  if(top + h > host.height - 4) top = y - host.top - h - 2;
  switchMenu.style.left = Math.max(4, left) + 'px';
  switchMenu.style.top = Math.max(4, top) + 'px';
}
function closeSwitchMenu(){ switchMenu.hidden = true; }
switchMenu.addEventListener('mousedown', ev=> ev.stopPropagation());
switchMenu.addEventListener('click', ev=> ev.stopPropagation());
document.addEventListener('pointerdown', ev=>{
  if(switchMenu.hidden || switchMenu.contains(ev.target)) return;
  if(ev.target.closest && ev.target.closest('.hex-pop, .color-pop, input[type="color"]')) return;
  closeSwitchMenu();
}, true);
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && !switchMenu.hidden) closeSwitchMenu(); });
(document.querySelector('.app > .main') || document.body).appendChild(switchMenu);
