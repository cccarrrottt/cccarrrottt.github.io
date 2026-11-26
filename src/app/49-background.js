/* =========================================================================
   THE FIELD'S GROUND, CHOSEN
   -------------------------------------------------------------------------
   A colour for the field, or a picture laid on it (the owner's list of
   22.11, night). Asked for where the field is: a right click or a held
   finger on open paper offers Background beside Paste, and this small
   menu opens there. What it sets is SETTINGS.background, drawn by
   syncBackdrop (10-decor.js); each change is an edit, undone like one.
   ========================================================================= */
const bgMenu = document.createElement('div');
bgMenu.className = 'bg-menu';
bgMenu.id = 'bgMenu';
bgMenu.hidden = true;
bgMenu.setAttribute('role', 'dialog');
bgMenu.setAttribute('aria-label', 'Background');
const bgFile = document.createElement('input');
bgFile.type = 'file';
bgFile.accept = 'image/png,image/jpeg,image/gif,image/webp';
bgFile.hidden = true;
document.body.appendChild(bgFile);
/* A picture is kept as big as a field needs and no bigger: past
   BG_IMAGE_MAX on its long side it is drawn down before it is kept, so a
   photograph from a phone does not become ten megabytes of chart. */
const BG_IMAGE_MAX = 2400;

function backgroundNow(){
  return cleanBackground(SETTINGS.background) || {};
}
function setBackground(change){
  if(readOnlyView) return;
  const next = Object.assign({}, backgroundNow(), change);
  Object.keys(next).forEach(k=>{ if(next[k] === undefined) delete next[k]; });
  const clean = cleanBackground(next);
  if(JSON.stringify(clean) === JSON.stringify(cleanBackground(SETTINGS.background))) return;
  applyEdit(()=>{ if(clean) SETTINGS.background = clean; else delete SETTINGS.background; });
  buildBackgroundMenu();
}
function backgroundFromFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('could not read "' + file.name + '".'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('"' + file.name + '" is not an image this browser can read.'));
      img.onload = ()=>{
        const k = Math.min(1, BG_IMAGE_MAX / Math.max(img.width, img.height));
        /* A GIF keeps its frames, and a picture already small enough is
           kept byte for byte. */
        if(k >= 1 || /gif/i.test(file.type)){ resolve(reader.result); return; }
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(/png/i.test(file.type) ? 'image/png' : 'image/jpeg', 0.88));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
bgFile.addEventListener('change', ()=>{
  const f = bgFile.files && bgFile.files[0];
  bgFile.value = '';
  if(!f) return;
  backgroundFromFile(f).then(src=> setBackground({image: src}))
    .catch(err=> flashStatus(String(err && err.message || err)));
});
function buildBackgroundMenu(){
  const bg = backgroundNow();
  bgMenu.textContent = '';
  const head = document.createElement('div');
  head.className = 'bg-menu-head';
  head.textContent = 'Background';
  bgMenu.appendChild(head);
  const row = (label)=>{
    const r = document.createElement('div');
    r.className = 'bg-menu-row';
    const l = document.createElement('span');
    l.className = 'bg-menu-label';
    l.textContent = label;
    r.appendChild(l);
    bgMenu.appendChild(r);
    return r;
  };
  const reset = (r, live, fn, title)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hex-reset';
    b.textContent = '⟲';
    b.title = title;
    b.disabled = !live;
    b.addEventListener('click', ev=>{ ev.stopPropagation(); fn(); });
    r.appendChild(b);
  };
  // The colour: a square, as every colour on the page is (squareForHexInput).
  /* One colour, or a gradient down the field from it through more (the
     owner's list of 25.11): Gradient brings a second square, and a + for
     each one after that; a colour past the second has a × of its own. */
  const cr = row('Colour');
  const kind = document.createElement('select');
  kind.className = 'style-select bg-kind';
  kind.title = 'One colour, or a gradient of several';
  [['solid', 'Solid'], ['gradient', 'Gradient']].forEach(([v, t])=>{
    const o = document.createElement('option'); o.value = v; o.textContent = t; kind.appendChild(o);
  });
  const more = bg.gradient || [];
  kind.value = more.length ? 'gradient' : 'solid';
  kind.addEventListener('change', ()=>{
    if(kind.value === 'gradient') setBackground({color: bg.color || '#ffffff', gradient: [bg.color && bg.color !== '#dde3ee' ? '#dde3ee' : '#c9d3e3']});
    else setBackground({gradient: undefined});
  });
  cr.appendChild(kind);
  reset(cr, !!bg.color, ()=> setBackground({color: undefined, gradient: undefined}), 'Back to the paper');
  const colours = document.createElement('div');
  colours.className = 'bg-menu-colours';
  bgMenu.appendChild(colours);
  const square = (value, title, put, drop)=>{
    const wrap = document.createElement('div');
    wrap.className = 'hex-field';
    const box = document.createElement('input');
    box.type = 'text'; box.className = 'tb-hex'; box.maxLength = 9; box.spellcheck = false;
    box.value = value || '';
    wrap.appendChild(box);
    colours.appendChild(wrap);
    squareForHexInput(box, {title, fallback: ()=> '#ffffff'});
    box.addEventListener('input', ()=>{
      const v = hexFieldValue(box.value);
      if(HEX_RE.test(v)) put(v.toLowerCase());
    });
    if(drop){
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'bg-colour-drop'; x.textContent = '×';
      x.title = 'Take this colour out of the gradient';
      x.addEventListener('click', ev=>{ ev.stopPropagation(); drop(); });
      wrap.appendChild(x);
    }
  };
  square(bg.color, 'the colour of the field', v=> setBackground({color: v}));
  more.forEach((c, i)=> square(c, 'a colour of the gradient',
    v=>{ const g = more.slice(); g[i] = v; setBackground({gradient: g}); },
    more.length > 1 ? ()=>{ const g = more.slice(); g.splice(i, 1); setBackground({gradient: g}); } : null));
  if(more.length && more.length < BG_GRADIENT_MAX - 1){
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'editor-btn bg-colour-add'; add.textContent = '+';
    add.title = 'Another colour at the foot of the gradient';
    add.addEventListener('click', ev=>{ ev.stopPropagation(); setBackground({gradient: more.concat([more[more.length - 1]])}); });
    colours.appendChild(add);
  }
  // The picture: chosen from a file, laid to fill or repeated, taken off.
  const pr = row('Picture');
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'editor-btn bg-pick';
  pick.textContent = bg.image ? 'Replace…' : 'Choose…';
  pick.title = 'A picture to lay on the field';
  pick.addEventListener('click', ev=>{ ev.stopPropagation(); bgFile.click(); });
  pr.appendChild(pick);
  if(bg.image){
    const fit = document.createElement('select');
    fit.className = 'style-select bg-fit';
    fit.title = 'How the picture is laid on the field';
    [['cover', 'Fill'], ['tile', 'Repeat']].forEach(([v, t])=>{
      const o = document.createElement('option'); o.value = v; o.textContent = t; fit.appendChild(o);
    });
    fit.value = bg.fit === 'tile' ? 'tile' : 'cover';
    fit.addEventListener('change', ()=> setBackground({fit: fit.value === 'tile' ? 'tile' : undefined}));
    pr.appendChild(fit);
  }
  reset(pr, !!bg.image, ()=> setBackground({image: undefined, fit: undefined}), 'Take the picture off');
}
function openBackgroundMenu(x, y){
  if(readOnlyView) return;
  buildBackgroundMenu();
  bgMenu.hidden = false;
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const w = bgMenu.offsetWidth, h = bgMenu.offsetHeight;
  let left = x - host.left + 2, top = y - host.top + 2;
  if(left + w > host.width - 4) left = x - host.left - w - 2;
  if(top + h > host.height - 4) top = y - host.top - h - 2;
  bgMenu.style.left = Math.max(4, left) + 'px';
  bgMenu.style.top = Math.max(4, top) + 'px';
}
function closeBackgroundMenu(){ bgMenu.hidden = true; }
bgMenu.addEventListener('mousedown', ev=> ev.stopPropagation());
bgMenu.addEventListener('click', ev=> ev.stopPropagation());
/* Any press elsewhere puts it away, as the other menus over the chart go;
   a colour's own code box, which opens over the page, is not elsewhere. */
document.addEventListener('pointerdown', ev=>{
  if(bgMenu.hidden || bgMenu.contains(ev.target)) return;
  if(ev.target.closest && ev.target.closest('.hex-pop, .color-pop, input[type="color"]')) return;
  closeBackgroundMenu();
}, true);
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape' && !bgMenu.hidden) closeBackgroundMenu(); });
(document.querySelector('.app > .main') || document.body).appendChild(bgMenu);
