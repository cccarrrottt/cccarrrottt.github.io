/* ---------------------------------------------------------------------
   Adding an entry: the round button's styles, the figure menu with its
   pages and templates, the presets. Taken out of 34-add-node.js (0.27.2),
   which keeps how a figure is DRAWN, since every reader draws them; on the
   site this is in the editor's file (LAZY_PARTS).
   ------------------------------------------------------------------ */
function openAddFab(){
  if(readOnlyView) return;
  addFab.classList.add('open');
  addFabBtn.setAttribute('aria-expanded', 'true');
}
/* One new entry of the given style, empty, on the clear ground nearest the
   middle of what is on show. An entry with nothing in it is a perfectly
   good entry — a placeholder, a spacer, a box that will hold a picture —
   and it is one grid step square until something is written in it. */
function addEntryOfStyle(style, at){
  if(readOnlyView) return null;
  const shapeVal = style === 'rect' ? undefined : style;
  const id = uniqueId(slugify(''), new Set(workingNodes.map(it=> it[0])));
  const spot = at || emptySpotNearCentre(shapeVal);
  /* What the gear beside the kind says it starts as (presets). */
  const preset = (style === 'rect' || style === 'ellipse' || style === 'link') ? presetOptsFor(style) : {};
  applyEdit(()=> workingNodes.push([id, '', undefined, undefined, undefined, shapeVal,
                                    Object.assign(preset, {pos: [spot.x, spot.y]})]));
  selectNode(id);
  /* Words go in where they will stand. A portrait and a picture have a
     picture to choose before anything else, which their settings ask for;
     a link has where it goes, which its bar asks for. */
  if(style === 'link') askWhereLinkGoes(id);
  else if(style !== 'ellipse' && style !== 'image') openNodeEditor(id);
  return id;
}
/* Where a new, empty entry of this style goes: of the grid points round
   the middle of what is on show, the nearest one where its box touches
   nothing already drawn. Nearest by straight distance, so it is the free
   ground closest to the middle in every direction rather than the first
   gap down one diagonal.
 *
   Answered for the box as it will be DRAWN and handed back as the
   position that draws it there: a box that closes on its words stores
   the middle of a one-line entry, and an empty one is shorter than that,
   so the two differ by half the difference. */
/* Carrying a new entry to where it goes (the owner's list of 24.11).
 *
   Picked from the + menu with a mouse, an entry is not dropped in the
   middle of the screen: an outline of it rides under the pointer, and a
   press on the chart puts it down there, on the grid; Escape, the right
   button or a press anywhere but the chart lets it go. Picked with a
   finger, which has no pointer to ride under, it goes where it always
   went. The + menu shuts as the outline is taken up, unless pinned. */
var placing = null;
const placeGhost = document.createElement('div');
placeGhost.className = 'place-ghost';
placeGhost.hidden = true;
document.body.appendChild(placeGhost);
function placeSize(shapeVal){
  return {
    w: shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_W : GRID,
    h: shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_H : GRID
  };
}
function putDown(ev, make){
  if(ev && ev.pointerType === 'mouse'){ beginPlacing(undefined, make); return; }
  closeAddFab();
  make(null);
}
function beginPlacing(style, make){
  const shapeVal = style === 'rect' ? undefined : style;
  placing = {shapeVal, make, size: placeSize(shapeVal)};
  if(!addFab.classList.contains('pinned')) closeAddFab();
  placeGhost.classList.toggle('round', shapeVal === 'ellipse');
  document.body.classList.add('placing');
  placeGhost.hidden = true;
}
function endPlacing(){
  placing = null;
  placeGhost.hidden = true;
  document.body.classList.remove('placing');
}
/* The spot an entry of this kind stands at when its middle is put at
   this point of the screen — snapped as every entry is, and with the
   same allowance emptySpotNearCentre makes for an empty box. */
function spotAtClient(shapeVal, cx, cy){
  const {w, h} = placeSize(shapeVal);
  const dy = (shapeVal==='ellipse' || shapeVal==='link' || shapeVal==='image') ? 0 : round2((h - NODE_GROW_REF) / 2);
  const c = clientToWorld(cx, cy);
  return {x: snapToGrid(c.x - w/2), y: round2(snapToGrid(c.y - h/2) + dy)};
}
document.addEventListener('pointermove', ev=>{
  if(!placing) return;
  const over = ev.target && svg.contains(ev.target);
  placeGhost.hidden = !over;
  if(!over) return;
  const {w, h} = placing.size;
  placeGhost.style.width = (w * vs) + 'px';
  placeGhost.style.height = (h * vs) + 'px';
  placeGhost.style.left = (ev.clientX - w * vs / 2) + 'px';
  placeGhost.style.top = (ev.clientY - h * vs / 2) + 'px';
}, true);
document.addEventListener('pointerdown', ev=>{
  if(!placing) return;
  if(addFab.contains(ev.target)) return;           // another pick takes its place
  const onChart = svg.contains(ev.target) && ev.button === 0;
  if(!onChart){ endPlacing(); return; }
  ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
  const make = placing.make, spot = spotAtClient(placing.shapeVal, ev.clientX, ev.clientY);
  endPlacing();
  /* The press that put it down is not also a click on the ground. */
  const eat = e=>{ e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', eat, {capture: true, once: true});
  setTimeout(()=> window.removeEventListener('click', eat, true), 400);
  make(spot);
}, true);
document.addEventListener('keydown', ev=>{
  if(placing && ev.key === 'Escape'){ ev.stopPropagation(); endPlacing(); }
}, true);
function emptySpotNearCentre(shapeVal){
  const w = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_W : GRID;
  const h = shapeVal==='ellipse' ? BIO_SIZE : shapeVal==='link' ? LINK_NODE_SIZE : shapeVal==='image' ? IMAGE_DEFAULT_H : GRID;
  const dy = (shapeVal==='ellipse' || shapeVal==='link' || shapeVal==='image') ? 0 : round2((h - NODE_GROW_REF) / 2);
  const rect = visibleCanvasRect();
  const c = clientToWorld(rect.left + rect.width/2, rect.top + rect.height/2);
  const ox = snapToGrid(c.x - w/2), oy = snapToGrid(c.y - h/2);
  const pad = GRID / 2;
  // Inside an array is open ground: the frame is round the entries, not one.
  const taken = [...nodes.values()].filter(n=> !isArrayNode(n))
    .map(n=>({x:n.x - pad, y:n.y - pad, r:n.x + n.w + pad, b:n.y + n.h + pad}));
  const free = (x, y)=> !taken.some(t=> x < t.r && x + w > t.x && y < t.b && y + h > t.y);
  /* Ring by ring outwards, and on past the first ring with room only as
     far as a point could still be nearer — a square ring's corners lie
     further out than the middle of the next ring's sides. Ties go to the
     point higher up, then further left: a fixed order, so the same chart
     always answers the same. */
  let best = null;
  for(let ring = 0; ring <= 80; ring++){
    if(best && ring * ring > best.d) break;
    for(let j = -ring; j <= ring; j++){
      for(let i = -ring; i <= ring; i++){
        if(Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const d = i*i + j*j;
        if(best && (d > best.d || (d === best.d && (j > best.j || (j === best.j && i > best.i))))) continue;
        const x = snapToGrid(ox + i*GRID), y = snapToGrid(oy + j*GRID);
        if(free(x, y)) best = {x, y, d, i, j};
      }
    }
  }
  if(best) return {x: best.x, y: round2(best.y + dy)};
  return {x: ox, y: round2(oy + dy)};
}
/* What an entry's `figure` says it is: a figure's name, or a template
   ({name, d}) with its outline read once here. Only an ordinary box takes
   one — a portrait, a picture, a caption, a callout or an array has a shape
   of its own. */
/* The templates the menu offers (the owner's list of 19.11): the ones the
   chart keeps, and every one an entry is drawn with, whether it was kept
   or not — an entry's own copy is a template as good as the file it came
   from, and a chart brought in, or one whose template was taken out of
   the menu, used to have entries in shapes nobody could put down again.
   Told apart by their outlines. `worn` counts the entries drawn with one:
   while any is, it cannot be taken out. */
function figureTemplatesOffered(){
  const out = cleanFigureTemplates(SETTINGS.figures);
  const byD = new Map(out.map(t=> [t.d, t]));
  (typeof workingNodes !== 'undefined' ? workingNodes : []).forEach(entry=>{
    const f = entry && entry[6] && entry[6].figure;
    if(!f || typeof f !== 'object' || Array.isArray(f) || !parseFigurePath(f.d)) return;
    let t = byD.get(f.d);
    if(!t){
      t = cleanFigureTemplates([f])[0];
      out.push(t); byD.set(t.d, t);
    }
    t.worn = (t.worn || 0) + 1;
  });
  return out;
}
/* The menu of figures: the flowchart's own, then the chart's templates,
   then a way to bring one in. Opened from the button beside Default and
   standing beside the column it came from, inside the same widget, so
   the pointer travelling to it does not shut the menu. */
function figureIcon(fig){
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 40 30');
  svg.setAttribute('class', 'node-style-icon');
  const W = (fig === 'connector') ? 18 : (fig === 'decision' || fig === 'extract' || fig === 'merge') ? 26 : 28;
  const H = (fig === 'connector') ? 18 : (fig === 'decision' || fig === 'extract' || fig === 'merge') ? 20 : 15;
  const f = isBuiltinFigure(fig) ? fig : figureOf(fig);
  let iw = W, ih = H;
  if(f && f.ar){ if(f.ar > 28 / 22){ iw = 28; ih = 28 / f.ar; } else { ih = 22; iw = 22 * f.ar; } }
  const x = (40 - iw) / 2, y = (30 - ih) / 2;
  const L = figureLayout(f, iw, ih);
  const add = (d, cls)=>{
    const e = document.createElementNS(SVG, 'path');
    e.setAttribute('d', d); e.setAttribute('class', cls);
    svg.appendChild(e);
  };
  add(figurePolyD(L.outline, x, y, true), 'nsi-box');
  L.marks.forEach(m=> add(figurePolyD(m, x, y, false), 'nsi-line'));
  return svg;
}
function figureButton(label, icon, onPick){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'node-style-btn';
  b.setAttribute('role', 'menuitem');
  b.title = label;
  b.appendChild(icon);
  const cap = document.createElement('span');
  cap.className = 'node-style-cap';
  cap.textContent = label;
  b.appendChild(cap);
  b.addEventListener('click', ev=>{ ev.stopPropagation(); onPick(ev); });
  return b;
}
function buildFigureMenu(){
  addFabFigures.textContent = '';
  /* A card inside a clear band: the band is the pointer's way across from
     the column to the card, and is still the widget, so crossing it does
     not shut the menu. */
  const card = document.createElement('div');
  card.className = 'add-fab-figures-card';
  addFabFigures.appendChild(card);
  const head = (t)=>{ const h = document.createElement('div'); h.className = 'add-fab-figures-head'; h.textContent = t; card.appendChild(h); };
  const grid = ()=>{ const g = document.createElement('div'); g.className = 'add-fab-figures-grid'; card.appendChild(g); return g; };
  head('Flowchart');
  const g1 = grid();
  figurePicks().forEach(p=>{
    const b = figureButton(p.label, figureIcon(p.value), (ev)=> putDown(ev, at=> addEntryOfFigure(p.value, at)));
    b.dataset.value = p.value;
    g1.appendChild(b);
  });
  /* The author's own templates go in pages of FIGURE_PAGE, turned by the
     arrows over them (the owner's list of 22.11, evening): a chart with
     forty templates made the card taller than the screen. The pages stand
     side by side on one track and the track slides, so turning one is a
     movement and not a cut. */
  const tiles = figureTemplatesOffered().map((t, i)=>{
    const b = figureButton(t.name, figureIcon(t), (ev)=> putDown(ev, at=> addEntryOfFigure(Object.assign({name: t.name, d: t.d}, t.ar ? {ar: t.ar} : {}), at)));
    b.classList.add('figure-template');
    b.dataset.template = String(i);
    const x = document.createElement('span');
    x.className = 'figure-template-drop' + (t.worn ? ' worn' : '');
    x.textContent = '×';
    x.title = t.worn
      ? `${t.worn} ${t.worn === 1 ? 'entry is' : 'entries are'} drawn with it — it stays while any is`
      : 'Take this template out of the menu';
    x.addEventListener('click', ev=>{
      ev.stopPropagation();
      /* Worn, it still answers (the owner's list of 20.11): it says why it
         cannot go, and takes the author to the nearest entry drawn with
         it, lit for a moment, so what is holding it is in plain sight. */
      if(t.worn){ showTemplateWearer(t); return; }
      applyEdit(()=>{
        const next = cleanFigureTemplates(SETTINGS.figures).filter(k=> k.d !== t.d);
        if(next.length) SETTINGS.figures = next; else delete SETTINGS.figures;
      });
      buildFigureMenu();
    });
    b.appendChild(x);
    return b;
  });
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'node-style-btn figure-upload';
  up.title = 'Bring in a template from an SVG file: its outline becomes a figure';
  up.innerHTML = '<span class="figure-upload-plus">' + PLUS_SVG + '</span><span class="node-style-cap">Upload SVG</span>';
  up.addEventListener('click', ev=>{ ev.stopPropagation(); figureFileInput.click(); });
  tiles.push(up);
  const count = Math.max(1, Math.ceil(tiles.length / FIGURE_PAGE));
  figurePage = Math.min(Math.max(0, figurePage), count - 1);
  /* The arrows on a row of their own over the heading, in the middle
     (the owner's word of 22.11, evening). */
  const top = document.createElement('div');
  top.className = 'add-fab-figures-head figure-pager';
  head('Templates');
  const name = card.lastElementChild;
  const view = document.createElement('div');
  view.className = 'figure-pages';
  const track = document.createElement('div');
  track.className = 'figure-track';
  view.appendChild(track);
  for(let i = 0; i < count; i++){
    const g = document.createElement('div');
    g.className = 'add-fab-figures-grid figure-page';
    tiles.slice(i * FIGURE_PAGE, (i + 1) * FIGURE_PAGE).forEach(b=> g.appendChild(b));
    track.appendChild(g);
  }
  if(count > 1){
    const turn = (step, label, d)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'figure-turn';
      b.dataset.step = String(step);
      b.title = label;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" fill="currentColor"/></svg>';
      b.addEventListener('click', ev=>{ ev.stopPropagation(); turnFigurePage(step); });
      return b;
    };
    const at = document.createElement('span');
    at.className = 'figure-page-at';
    top.appendChild(turn(-1, 'The page before', 'M15 6.5v11L8.5 12z'));
    top.appendChild(at);
    top.appendChild(turn(1, 'The next page', 'M9 6.5v11l6.5-5.5z'));
  }
  if(count > 1) card.insertBefore(top, name);
  card.appendChild(view);
  if(count > 1) swipeFigurePages(view, track);
  showFigurePage(false);
}
/* The pages follow a finger or a pressed mouse sideways and settle on
   the nearest when let go, and a sideways wheel turns them too — the
   arrows are not the only way across, and every way slides (the owner's
   list of 24.11). A drag that moved is not also a press on a figure. */
function swipeFigurePages(view, track){
  let from = null, moved = false;
  view.addEventListener('pointerdown', ev=>{
    if(ev.button !== 0) return;
    from = {x: ev.clientX, y: ev.clientY, id: ev.pointerId};
    moved = false;
  });
  view.addEventListener('pointermove', ev=>{
    if(!from || ev.pointerId !== from.id) return;
    const dx = ev.clientX - from.x;
    if(!moved){
      if(Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(ev.clientY - from.y)) return;
      moved = true;
      view.classList.add('swiping');
      try{ view.setPointerCapture(ev.pointerId); }catch(e){}
    }
    const pages = track.children.length;
    // Past the first or the last page it gives, but only a little.
    const edge = (figurePage === 0 && dx > 0) || (figurePage === pages - 1 && dx < 0);
    track.style.transform = `translateX(calc(${-100 * figurePage}% + ${edge ? dx / 3 : dx}px))`;
  });
  const letGo = ev=>{
    if(!from) return;
    const dx = ev.clientX - from.x;
    from = null;
    if(!moved) return;
    view.classList.remove('swiping');
    const step = Math.abs(dx) > Math.min(60, view.clientWidth / 4) ? (dx < 0 ? 1 : -1) : 0;
    const to = Math.min(Math.max(0, figurePage + step), track.children.length - 1);
    figurePage = to;
    showFigurePage(true);
    const eat = e=>{ e.stopPropagation(); e.preventDefault(); };
    view.addEventListener('click', eat, {capture: true, once: true});
    setTimeout(()=> view.removeEventListener('click', eat, true), 300);
  };
  view.addEventListener('pointerup', letGo);
  view.addEventListener('pointercancel', letGo);
  let wheelAt = 0;
  view.addEventListener('wheel', ev=>{
    const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : (ev.shiftKey ? ev.deltaY : 0);
    if(!d) return;
    ev.preventDefault(); ev.stopPropagation();
    const now = performance.now();
    if(now - wheelAt < 350 || Math.abs(d) < 4) return;
    wheelAt = now;
    turnFigurePage(d > 0 ? 1 : -1);
  }, {passive: false});
}
/* Where the track stands, and which of the arrows can still be pressed.
   `moving` false places it at once — a menu that opens on page three
   does not slide there from page one. */
function showFigurePage(moving){
  const track = addFabFigures.querySelector('.figure-track');
  if(!track) return;
  const pages = track.children.length;
  if(!moving){ track.style.transition = 'none'; void track.offsetWidth; }
  track.style.transform = 'translateX(' + (-100 * figurePage) + '%)';
  if(!moving) requestAnimationFrame(()=>{ track.style.transition = ''; });
  [...track.children].forEach((g, i)=>{ g.inert = i !== figurePage; });
  const at = addFabFigures.querySelector('.figure-page-at');
  if(at) at.textContent = (figurePage + 1) + ' / ' + pages;
  addFabFigures.querySelectorAll('.figure-turn').forEach(b=>{
    const to = figurePage + Number(b.dataset.step);
    b.disabled = to < 0 || to >= pages;
  });
}
function turnFigurePage(step){
  const track = addFabFigures.querySelector('.figure-track');
  if(!track) return;
  const to = figurePage + step;
  if(to < 0 || to >= track.children.length) return;
  figurePage = to;
  showFigurePage(true);
}
/* The entry drawn with this template nearest the middle of the view:
   the menu shuts, the view goes to it, and it glows for a moment. */
function showTemplateWearer(t){
  const rect = svg.getBoundingClientRect();
  const mid = clientToWorld(rect.left + rect.width/2, rect.top + rect.height/2);
  let best = null, bestD = Infinity;
  nodes.forEach(n=>{
    const f = n.figure;
    if(!f || typeof f !== 'object' || f.d !== t.d) return;
    const d = Math.hypot(n.x + n.w/2 - mid.x, n.y + n.h/2 - mid.y);
    if(d < bestD){ bestD = d; best = n; }
  });
  setSaveState('err', `“${t.name}” can’t be taken out: ${t.worn} ${t.worn === 1 ? 'entry is' : 'entries are'} drawn with it`);
  setTimeout(refreshSaveUI, 2600);
  if(!best) return;
  closeAddFab();
  flyToNode(best.id);
  const g = qNode(`.node[data-id="${CSS.escape(best.id)}"]`);
  if(!g) return;
  g.classList.remove('beacon');
  void g.getBoundingClientRect();
  g.classList.add('beacon');
  clearTimeout(g.beaconTimer);
  g.beaconTimer = setTimeout(()=> g.classList.remove('beacon'), 1700);
}
function openFigureMenu(on){
  const open = on === undefined ? !addFab.classList.contains('figures') : on;
  if(open) buildFigureMenu();
  addFab.classList.toggle('figures', open);
  const btn = document.getElementById('addFabCustomize');
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function openPresetMenu(kind){
  presetKind = kind;
  addFab.classList.toggle('presets', !!kind);
  addFabStyles.querySelectorAll('.add-fab-preset').forEach(g=> g.classList.toggle('on', g.dataset.kind === kind));
  if(kind) buildPresetMenu();
}
function buildPresetMenu(){
  const kind = presetKind;
  addFabPresets.textContent = '';
  if(!kind) return;
  const p = presetOptsFor(kind);
  const card = document.createElement('div');
  card.className = 'add-fab-figures-card preset-card';
  addFabPresets.appendChild(card);
  const head = document.createElement('div');
  head.className = 'add-fab-figures-head';
  head.textContent = (NODE_STYLE_PICKS.find(x=> x.value === kind) || {label: kind}).label + ' — new entries start as';
  card.appendChild(head);
  const row = (label, key, control)=>{
    const r = document.createElement('div');
    r.className = 'preset-row';
    r.dataset.key = key;
    const l = document.createElement('span');
    l.className = 'preset-label';
    l.textContent = label;
    r.appendChild(l);
    r.appendChild(control);
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'hex-reset preset-reset';
    back.textContent = '\u27f2';
    back.title = 'Back to the default';
    back.disabled = p[key] === undefined;
    back.addEventListener('click', ev=>{ ev.stopPropagation(); setPresetField(kind, key, undefined); buildPresetMenu(); });
    r.appendChild(back);
    card.appendChild(r);
  };
  const keys = PRESET_KINDS[kind];
  const colour = (key, title)=>{
    const wrap = document.createElement('div');
    wrap.className = 'hex-field';
    const box = document.createElement('input');
    box.type = 'text'; box.className = 'tb-hex'; box.maxLength = 9; box.spellcheck = false;
    box.value = p[key] ? p[key][0] : '';
    wrap.appendChild(box);
    squareForHexInput(box, {title, fallback: ()=> key === 'bg' ? null : DEFAULT_NODE_COLOR});
    box.addEventListener('input', ()=>{
      const v = hexFieldValue(box.value);
      if(!HEX_RE.test(v)) return;
      setPresetField(kind, key, [v.toLowerCase()]);
      const back = wrap.parentElement && wrap.parentElement.querySelector('.preset-reset');
      if(back) back.disabled = false;
    });
    return wrap;
  };
  const select = (key, options, cur)=>{
    const sel = document.createElement('select');
    sel.className = 'style-select';
    options.forEach(([v, t])=>{ const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
    sel.value = cur;
    sel.addEventListener('change', ()=>{
      const o = options.find(x=> x[0] === sel.value);
      setPresetField(kind, key, o ? o[2] : undefined);
      buildPresetMenu();
    });
    return sel;
  };
  if(keys.includes('colors')) row('Border colour', 'colors', colour('colors', 'the border a new entry is drawn with'));
  if(keys.includes('bg')) row('Ground', 'bg', colour('bg', 'what a new entry is filled with'));
  if(keys.includes('border')) row('Border', 'border', select('border',
    PRESET_BORDERS.map(b=> [b, b[0].toUpperCase() + b.slice(1), b === 'solid' ? undefined : b]), p.border || 'solid'));
  if(keys.includes('square')) row('Corners', 'square', select('square',
    [['square', 'Square', undefined], ['round', 'Rounded', false]], p.square === false ? 'round' : 'square'));
  if(keys.includes('font')) row('Font', 'font', select('font',
    fontOptions().map(f=> [f.key, f.label, f.key === FONT_OPTIONS[0].key ? undefined : f.key]), p.font || FONT_OPTIONS[0].key));
  if(keys.includes('fontSize')){
    const size = document.createElement('input');
    size.type = 'number'; size.min = '6'; size.max = '96'; size.step = '1';
    size.className = 'preset-size';
    size.placeholder = String(NODE_FS);
    size.value = p.fontSize || '';
    size.addEventListener('change', ()=>{
      const v = Number(size.value);
      setPresetField(kind, 'fontSize', Number.isFinite(v) && v >= 6 && v <= 96 && size.value !== '' ? v : undefined);
      buildPresetMenu();
    });
    row('Size', 'fontSize', size);
  }
  if(keys.includes('align')) row('Words', 'align', select('align',
    [['left', 'Left', 'left'], ['center', 'Centred', undefined], ['right', 'Right', 'right']], p.align || 'center'));
  card.addEventListener('mousedown', ev=> ev.stopPropagation());
  seatPresetCard();
}
/* The card stands level with the button whose gear opened it, its middle
   on that button's middle, and only as far from that as the screen's
   edges make it (the owner's list of 22.11, night). It stood at the foot
   of the column for every kind, so the card for the top button opened a
   whole column away from it. It is to the left of the column, so it
   covers none of the column's buttons whatever its height. */
function seatPresetCard(){
  const gear = presetKind && addFabStyles.querySelector('.add-fab-preset.on');
  if(!gear) return;
  const row = gear.closest('.add-fab-row') || gear;
  const fab = addFab.getBoundingClientRect(), at = row.getBoundingClientRect();
  const h = addFabPresets.offsetHeight, room = window.innerHeight;
  const top = Math.max(8, Math.min(room - h - 8, at.top + at.height / 2 - h / 2));
  addFabPresets.style.bottom = 'auto';
  addFabPresets.style.top = (top - fab.top).toFixed(1) + 'px';
  addFabPresets.style.transformOrigin = 'right center';
}
/* An entry drawn as a figure, put down as Default puts one. */
function addEntryOfFigure(fig, at){
  if(readOnlyView) return null;
  const id = uniqueId(slugify(''), new Set(workingNodes.map(it=> it[0])));
  const spot = at || emptySpotNearCentre(undefined);
  // A figure is a Default entry of another shape, and starts as Default's preset says.
  applyEdit(()=> workingNodes.push([id, '', undefined, undefined, undefined, undefined,
                                    Object.assign(presetOptsFor('rect'), {pos: [spot.x, spot.y], figure: fig})]));
  selectNode(id);
  openNodeEditor(id);
  return id;
}
