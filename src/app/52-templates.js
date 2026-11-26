/* =========================================================================
   ENTRIES OF THE OWNER'S OWN MAKING, AND PORTS FIXED BY HAND
   -------------------------------------------------------------------------
   The owner's list of 25.11. Save as template, in the menu a right click
   or a held finger opens on one entry, keeps that entry's look and size
   under a name (SETTINGS.nodeTemplates; templateLookOf, 21-edit-model.js),
   and the + menu offers it beside the kinds it always had. Ports, in the
   same menu, fixes how many ports each side has (opts.ports) — a fibre
   splitter's one in on the left and four out on the right — and the
   router seats connectors only there (resolvePorts, 09-bends-ports.js).
   A template keeps its ports, so a splitter is made once and put down
   as often as wanted. On the site it is part of the editor's file
   (LAZY_PARTS).
   ========================================================================= */
const portsMenu = document.createElement('div');
portsMenu.className = 'bg-menu ports-menu';
portsMenu.id = 'portsMenu';
portsMenu.hidden = true;
portsMenu.setAttribute('role', 'dialog');
portsMenu.setAttribute('aria-label', 'Ports');
function setPorts(id, ports){
  applyEdit(()=>{
    const w = workingEntry(id);
    if(!w) return;
    const opts = entryOpts(w.entry);
    const clean = cleanPorts(ports);
    if(clean) opts.ports = clean; else delete opts.ports;
    putEntry(w.index, w.entry, opts);
  });
}
function buildPortsMenu(id){
  const w = workingEntry(id);
  const now = (w && cleanPorts(w.entry[6] && w.entry[6].ports)) || null;
  portsMenu.textContent = '';
  const head = document.createElement('div');
  head.className = 'bg-menu-head';
  head.textContent = 'Ports';
  portsMenu.appendChild(head);
  const fields = {};
  [['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left']].forEach(([k, label])=>{
    const r = document.createElement('div');
    r.className = 'bg-menu-row';
    const l = document.createElement('span');
    l.className = 'bg-menu-label';
    l.textContent = label;
    r.appendChild(l);
    const box = document.createElement('input');
    box.type = 'number'; box.min = '0'; box.max = String(PORTS_MAX); box.step = '1';
    box.className = 'ports-count'; box.dataset.side = k;
    box.value = now ? String(now[k] || 0) : '';
    box.placeholder = 'any';
    fields[k] = box;
    box.addEventListener('change', ()=>{
      /* The first count given fixes the rest at none: a side left empty
         has no ports once any side has some. */
      const next = {};
      PORT_SIDES.forEach(s=>{ next[s] = +fields[s].value || 0; });
      setPorts(id, next);
      buildPortsMenu(id);
    });
    box.addEventListener('keydown', ev=>{ if(ev.key === 'Enter') box.blur(); ev.stopPropagation(); });
    r.appendChild(box);
    portsMenu.appendChild(r);
  });
  const any = document.createElement('button');
  any.type = 'button'; any.className = 'ports-any';
  any.textContent = 'Anywhere';
  any.title = 'Connectors meet it anywhere along its sides again';
  any.disabled = !now;
  any.addEventListener('click', ev=>{ ev.stopPropagation(); setPorts(id, null); buildPortsMenu(id); });
  portsMenu.appendChild(any);
}
function openPortsMenu(x, y, id){
  if(readOnlyView || !switchable(nodes.get(id))) return;
  buildPortsMenu(id);
  portsMenu.hidden = false;
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const w = portsMenu.offsetWidth, h = portsMenu.offsetHeight;
  let left = x - host.left + 2, top = y - host.top + 2;
  if(left + w > host.width - 4) left = x - host.left - w - 2;
  if(top + h > host.height - 4) top = y - host.top - h - 2;
  portsMenu.style.left = Math.max(4, left) + 'px';
  portsMenu.style.top = Math.max(4, top) + 'px';
}
function closePortsMenu(){ portsMenu.hidden = true; }
portsMenu.addEventListener('mousedown', ev=> ev.stopPropagation());
portsMenu.addEventListener('click', ev=> ev.stopPropagation());
document.addEventListener('pointerdown', ev=>{
  if(portsMenu.hidden || portsMenu.contains(ev.target)) return;
  closePortsMenu();
}, true);
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && !portsMenu.hidden) closePortsMenu(); });
(document.querySelector('.app > .main') || document.body).appendChild(portsMenu);

/* ---- Templates ---- */
function nodeTemplates(){ return cleanNodeTemplates(SETTINGS.nodeTemplates); }
function saveAsTemplate(id){
  const w = workingEntry(id);
  const n = nodes.get(id);
  if(!w || !n || readOnlyView) return;
  const look = templateLookOf(entryOpts(w.entry));
  /* The size it is drawn at, so the copies come out as big as this one. */
  if(!look.size) look.size = [Math.round(n.w), Math.round(n.h)];
  const list = nodeTemplates();
  const taken = new Set(list.map(t=> t.id));
  let k = list.length + 1;
  while(taken.has('tpl' + k)) k++;
  const name = (stripMarkup(w.entry[1] || "").trim() || 'Template ' + k).slice(0, 80);
  applyEdit(()=>{ SETTINGS.nodeTemplates = list.concat([{id: 'tpl' + k, name, opts: look}]); });
  flashStatus(`Saved as a template: “${name}” — it is in the + menu`);
}
function dropTemplate(tid){
  const list = nodeTemplates().filter(t=> t.id !== tid);
  applyEdit(()=>{ if(list.length) SETTINGS.nodeTemplates = list; else delete SETTINGS.nodeTemplates; });
  syncTemplatePicks();
}
function addFromTemplate(t, at){
  if(readOnlyView) return null;
  const id = uniqueId(slugify(''), new Set(workingNodes.map(it=> it[0])));
  const spot = at || emptySpotNearCentre(undefined);
  applyEdit(()=> workingNodes.push([id, '', undefined, undefined, undefined, undefined,
                                    Object.assign(JSON.parse(JSON.stringify(t.opts || {})), {pos: [spot.x, spot.y]})]));
  selectNode(id);
  openNodeEditor(id);
  return id;
}
/* The templates' own buttons, after the kinds, each with a × to let it go. */
function syncTemplatePicks(){
  const host = document.getElementById('addFabStyles');
  if(!host) return;
  host.querySelectorAll('.node-style-btn.tpl').forEach(b=> b.remove());
  nodeTemplates().forEach(t=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'node-style-btn tpl';
    b.dataset.template = t.id;
    b.setAttribute('role', 'menuitem');
    b.title = t.name;
    b.appendChild(nodeStyleIcon(t.opts && t.opts.ports ? 'ports' : 'rect'));
    const cap = document.createElement('span');
    cap.className = 'node-style-cap';
    cap.textContent = t.name;
    cap.setAttribute('translate', 'no');
    b.appendChild(cap);
    const x = document.createElement('span');
    x.className = 'tpl-drop';
    x.textContent = '×';
    x.title = 'Forget this template';
    x.addEventListener('click', ev=>{ ev.stopPropagation(); dropTemplate(t.id); });
    b.appendChild(x);
    b.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(ev.pointerType === 'mouse'){ beginPlacing('rect', at=> addFromTemplate(t, at)); return; }
      closeAddFab();
      addFromTemplate(t);
    });
    host.appendChild(b);
  });
}
