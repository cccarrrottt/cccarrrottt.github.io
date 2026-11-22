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
  const cr = row('Colour');
  const wrap = document.createElement('div');
  wrap.className = 'hex-field';
  const box = document.createElement('input');
  box.type = 'text'; box.className = 'tb-hex'; box.maxLength = 9; box.spellcheck = false;
  box.value = bg.color || '';
  wrap.appendChild(box);
  cr.appendChild(wrap);
  squareForHexInput(box, {title: 'the colour of the field', fallback: ()=> '#ffffff'});
  box.addEventListener('input', ()=>{
    const v = hexFieldValue(box.value);
    if(HEX_RE.test(v)) setBackground({color: v.toLowerCase()});
  });
  reset(cr, !!bg.color, ()=> setBackground({color: undefined}), 'Back to the paper');
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
