/* ---- The owner's cloud drives (the owner's choice of 20.11) ------------
 *
 * A picture or a clip can stay in the owner's Google Drive or Yandex Disk
 * instead of going into the repository. The write service does the work
 * (CLOUDS, worker/index.js): it connects a drive to the owner's session,
 * looks through a folder, and shares a picked file by link; the chart then
 * names the file by an address on the service, which answers every
 * reader's browser from the drive. To the chart it is a picture at an
 * https address like any other, kept in MEDIA, so everything that shows,
 * lists, exports or inserts a picture does so already. What is new is
 * here: the drives in My files, the window a folder is looked through in,
 * and the drive's mark on what came from one.
 *
 * Only the owner on the site, and only the drives the service is set up
 * for (its /me says which). Anywhere else nothing here shows.
 * --------------------------------------------------------------------- */
/* `var`, all three: the owner's page asks the service who it is as it
   starts (checkSiteOwner, part 36), and the answer is drawn from here. */
var siteClouds = {ready: [], connected: [], picker: []};
var CLOUD_NAMES = {gdrive: 'Google Drive', yadisk: 'Yandex Disk'};
/* Each drive's own mark, drawn small, so what came from one says which. */
var CLOUD_MARKS = {
  gdrive: '<svg viewBox="0 0 24 21" aria-hidden="true">' +
          '<path d="M8 0h8l8 14h-8z" fill="#ffba00"/><path d="M8 0 0 14l4 7 8-14z" fill="#00ac47"/>' +
          '<path d="M4 21h16l4-7H8z" fill="#2684fc"/></svg>',
  yadisk: '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<ellipse cx="12" cy="13.5" rx="11" ry="7.5" fill="#1a8cff"/>' +
          '<ellipse cx="12" cy="10.5" rx="6.6" ry="4.4" fill="#fff"/>' +
          '<ellipse cx="12" cy="10.5" rx="3.4" ry="2.2" fill="#1a8cff"/></svg>'
};
const CLOUD_FOLDER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const CLOUD_CLIP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>';
const CLOUD_PICTURE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 17l4.5-5 3.5 3.5 2-2 3 3.5z" fill="currentColor"/><circle cx="15.5" cy="9.5" r="1.6" fill="currentColor"/></svg>';

/* Which drive a picture's address is on, if any. */
function cloudOfSrc(src){
  if(typeof src !== 'string' || !SITE_API) return null;
  const m = /^\/cloud\/(gdrive|yadisk)\/file\b/.exec(src.slice(SITE_API.replace(/\/+$/, '').length));
  return m && src.indexOf(SITE_API.replace(/\/+$/, '') + '/cloud/') === 0 ? m[1] : null;
}
function cloudMarkEl(name){
  const k = document.createElement('span');
  k.className = 'file-cloud';
  k.dataset.cloud = name;
  k.title = 'From ' + CLOUD_NAMES[name];
  k.innerHTML = CLOUD_MARKS[name];
  return k;
}

/* ---- in My files --------------------------------------------------- */
function cloudsOffered(){
  return ON_SITE && !readOnlyView && !!siteOwner && siteClouds.ready.some(k=> CLOUD_NAMES[k]);
}
function renderCloudRow(){
  const row = document.getElementById('filesClouds');
  if(!row) return;
  row.hidden = !cloudsOffered();
  row.textContent = '';
  if(row.hidden) return;
  siteClouds.ready.filter(k=> CLOUD_NAMES[k]).forEach(name=>{
    const on = siteClouds.connected.indexOf(name) >= 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cloud-btn' + (on ? ' connected' : '');
    b.dataset.cloud = name;
    b.innerHTML = CLOUD_MARKS[name] + `<span>${escapeHtml(CLOUD_NAMES[name])}</span>`;
    b.title = on ? `Pick a picture or a clip from ${CLOUD_NAMES[name]}`
                 : `Connect ${CLOUD_NAMES[name]}, to pick pictures and clips from it. A file picked is shared by link, so that readers can see it.`;
    if(!on){
      const c = document.createElement('span');
      c.className = 'cloud-connect';
      c.textContent = 'Connect';
      b.appendChild(c);
    }
    b.addEventListener('click', ev=>{ ev.stopPropagation(); on ? (cloudHasPicker(name) ? openCloudPicker(name) : openCloudBrowser(name)) : connectCloud(name); });
    row.appendChild(b);
    if(on){
      const off = document.createElement('button');
      off.type = 'button';
      off.className = 'cloud-off';
      off.dataset.cloud = name;
      off.textContent = '✕';
      off.title = `Let go of ${CLOUD_NAMES[name]} — what was picked from it stays on the chart`;
      off.setAttribute('aria-label', off.title);
      off.addEventListener('click', ev=>{ ev.stopPropagation(); forgetCloud(name); });
      row.appendChild(off);
    }
  });
}
function setCloudsFromService(c){
  siteClouds = {ready: Array.isArray(c && c.ready) ? c.ready.slice() : [],
                connected: Array.isArray(c && c.connected) ? c.connected.slice() : [],
                picker: Array.isArray(c && c.picker) ? c.picker.slice() : []};
  renderCloudRow();
}
const cloudPost = (path, body)=> siteRequest(path, {method: 'POST', headers: {'Content-Type': 'application/json'},
                                                   body: JSON.stringify(body || {})});

/* Connecting is a popup, as signing in is, opened at once — a popup opened
   after the ticket comes back would be one no click opened, and refused. */
function connectCloud(name){
  const w = window.open('', 'rhizome-cloud', 'width=520,height=720');
  setStickerStatus('', `Connecting ${CLOUD_NAMES[name]}…`);
  cloudPost(`/cloud/${name}/ticket`).then(({res, body})=>{
    if(!res.ok || !body || !body.ticket){
      if(w) w.close();
      setStickerStatus('err', `${CLOUD_NAMES[name]} could not be connected${body && body.error ? ': ' + body.error : '.'}`);
      return;
    }
    const to = SITE_API + `/cloud/${name}/connect?ticket=` + encodeURIComponent(body.ticket);
    if(w) w.location.href = to;
    else setStickerStatus('err', 'The browser stopped the window that connects the drive; allow pop-ups for this site and press again.');
  }).catch(()=>{
    if(w) w.close();
    setStickerStatus('err', 'The write service could not be reached.');
  });
}
window.addEventListener('message', ev=>{
  if(!ON_SITE || ev.origin !== siteApiOrigin()) return;
  const got = ev.data && ev.data.rhizomeCloud;
  if(!got || !CLOUD_NAMES[got.cloud] || typeof got.grant !== 'string') return;
  cloudPost(`/cloud/${got.cloud}/attach`, {grant: got.grant}).then(({res, body})=>{
    if(!res.ok || !body){
      setStickerStatus('err', `${CLOUD_NAMES[got.cloud]} could not be connected${body && body.error ? ': ' + body.error : '.'}`);
      return;
    }
    siteClouds.connected = (body.connected || []).slice();
    clearStickerStatus();
    renderCloudRow();
    /* Not the Picker here: a window opened now would be one no click
       opened, and the browser would refuse it. The drive's button opens it. */
    if(cloudHasPicker(got.cloud)) setStickerStatus('ok', `${CLOUD_NAMES[got.cloud]} is connected; press it to pick files.`);
    else openCloudBrowser(got.cloud);
  }).catch(()=> setStickerStatus('err', 'The write service could not be reached.'));
});

/* ---- Google's own Picker (when the service is set up for it) ---------
   With the Picker, Google Drive is connected for drive.file: the service
   reaches only the files the owner picks in Google's window, not the whole
   drive — and so cannot list a folder either, which is why the drive's
   button opens the Picker instead of the folders. The window is the
   service's page (/cloud/gdrive/picker), so the site's policy and the
   site's scripts never see the drive's token; what comes back, by
   postMessage, is only what was picked, which then goes through /pick
   exactly as a file chosen in the folders does. */
function cloudHasPicker(name){ return (siteClouds.picker || []).indexOf(name) >= 0; }
function openCloudPicker(name){
  const w = window.open('', 'rhizome-picker', 'width=1050,height=700');
  setStickerStatus('', `Opening ${CLOUD_NAMES[name]}…`);
  cloudPost(`/cloud/${name}/picker-ticket`).then(({res, body})=>{
    if(!res.ok || !body || !body.ticket){
      if(w) w.close();
      /* A drive connected for the whole drive, before the Picker: the
         service has let go of it, and asks for it again. */
      if(res.status === 409 || res.status === 401){
        siteClouds.connected = siteClouds.connected.filter(k=> k !== name);
        renderCloudRow();
      }
      setStickerStatus('err', (body && body.error) || `${CLOUD_NAMES[name]} could not be opened.`);
      return;
    }
    const to = SITE_API + `/cloud/${name}/picker?ticket=` + encodeURIComponent(body.ticket);
    if(w){ w.location.href = to; clearStickerStatus(); }
    else setStickerStatus('err', 'The browser stopped the window with the drive in it; allow pop-ups for this site and press again.');
  }).catch(()=>{
    if(w) w.close();
    setStickerStatus('err', 'The write service could not be reached.');
  });
}
window.addEventListener('message', async ev=>{
  if(!ON_SITE || ev.origin !== siteApiOrigin()) return;
  const got = ev.data && ev.data.rhizomePicked;
  if(!got || !cloudHasPicker(got.cloud) || !Array.isArray(got.files) || readOnlyView) return;
  const files = got.files.filter(f=> f && typeof f.id === 'string' && f.id).slice(0, 50);
  let put = 0, last = '';
  for(const f of files){
    setStickerStatus('', `Sharing ${String(f.name || 'the file')} by link…`);
    const r = await shareCloudFile(got.cloud, {id: f.id, name: String(f.name || '')});
    if(r.kind === 'err'){ setStickerStatus('err', r.msg); return; }
    if(r.kind === 'ok' && r.added) put++;
    last = r.msg;
  }
  if(files.length === 1) setStickerStatus('ok', last);
  else if(files.length) setStickerStatus('ok', `${put} of ${files.length} files are now in My files, on their way to the chart with the next Save.`);
});
function forgetCloud(name){
  cloudPost(`/cloud/${name}/forget`).then(({res, body})=>{
    if(res.ok && body) siteClouds.connected = (body.connected || []).slice();
    renderCloudRow();
  }).catch(()=> setStickerStatus('err', 'The write service could not be reached.'));
}

/* ---- the window a drive is looked through in ------------------------ */
const cloudOverlay = document.getElementById('cloudOverlay');
const cloudGrid = document.getElementById('cloudGrid');
let cloudAt = null;   // {name, trail: [{id, name}]}: the folders walked down
function setCloudStatus(kind, msg){
  const e = document.getElementById('cloudStatus');
  if(!e) return;
  e.className = 'sticker-status editor-status' + (msg ? ' show ' + kind : '');
  e.textContent = msg || '';
}
function openCloudBrowser(name){
  if(!cloudOverlay) return;
  cloudAt = {name, trail: []};
  stickerOverlay.classList.remove('open');
  closeToolbarMenus('cloudOverlay');
  document.getElementById('cloudTitle').innerHTML = CLOUD_MARKS[name] + `<span>${escapeHtml(CLOUD_NAMES[name])}</span>`;
  cloudOverlay.classList.add('open');
  placeUnderButton(cloudOverlay, document.getElementById('filesToggle'));
  listCloudFolder();
}
function closeCloudBrowser(){
  if(cloudOverlay) cloudOverlay.classList.remove('open');
  cloudAt = null;
}
function cloudPathText(){
  return cloudAt.trail.length ? cloudAt.trail.map(f=> f.name).join(' / ') : 'The top of the drive';
}
async function listCloudFolder(){
  if(!cloudAt) return;
  const at = cloudAt;
  const folder = at.trail.length ? at.trail[at.trail.length - 1].id : null;
  document.getElementById('cloudUp').disabled = !at.trail.length;
  document.getElementById('cloudPath').textContent = cloudPathText();
  cloudGrid.textContent = '';
  setCloudStatus('', 'Looking…');
  let answer;
  try{ answer = await cloudPost(`/cloud/${at.name}/list`, {folder}); }
  catch(e){ setCloudStatus('err', 'The write service could not be reached.'); return; }
  if(cloudAt !== at) return;
  const {res, body} = answer;
  if(!res.ok || !body || !Array.isArray(body.items)){
    if(res.status === 409){ siteClouds.connected = siteClouds.connected.filter(k=> k !== at.name); renderCloudRow(); }
    setCloudStatus('err', (body && body.error) || `${CLOUD_NAMES[at.name]} did not answer.`);
    return;
  }
  setCloudStatus('', '');
  if(!body.items.length){
    const p = document.createElement('div');
    p.className = 'sticker-empty';
    p.textContent = 'No folders, pictures or clips here.';
    cloudGrid.appendChild(p);
    return;
  }
  body.items.forEach(item=> cloudGrid.appendChild(cloudItemCell(item)));
}
function cloudItemCell(item){
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'file-cell cloud-item';
  cell.dataset.kind = item.kind;
  cell.dataset.id = item.id;
  const pic = document.createElement('div');
  pic.className = 'cloud-thumb';
  pic.innerHTML = item.kind === 'folder' ? CLOUD_FOLDER_SVG : item.kind === 'video' ? CLOUD_CLIP_SVG : CLOUD_PICTURE_SVG;
  /* Google gives a picture's thumbnail an address of its own; where it
     will not draw, the drawn mark stays. */
  if(item.thumb && /^https:\/\//.test(item.thumb)){
    const img = document.createElement('img');
    img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    img.onload = ()=>{ pic.textContent = ''; pic.appendChild(img); };
    img.src = item.thumb;
  }
  const name = document.createElement('div');
  name.className = 'file-name';
  name.textContent = item.name;
  name.setAttribute('translate', 'no');
  cell.append(pic, name);
  cell.title = item.kind === 'folder' ? `Open ${item.name}` : `Put ${item.name} in My files`;
  cell.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(item.kind === 'folder'){ cloudAt.trail.push({id: item.id, name: item.name}); listCloudFolder(); }
    else pickCloudFile(item, cell);
  });
  return cell;
}
async function pickCloudFile(item, cell){
  if(!cloudAt || readOnlyView) return;
  cell.disabled = true;
  setCloudStatus('', `Sharing ${item.name} by link…`);
  const r = await shareCloudFile(cloudAt.name, item);
  cell.disabled = false;
  if(r.added) cell.classList.add('picked');
  setCloudStatus(r.kind, r.msg);
}
/* Shares one file by link and puts it in My files: the folders' click and
   the Picker's answer both come here. Says how it went rather than saying
   it, as the two show it in different places. */
async function shareCloudFile(name, item){
  if(readOnlyView) return {kind: 'err', msg: ''};
  let answer;
  try{ answer = await cloudPost(`/cloud/${name}/pick`, {id: item.id}); }
  catch(e){ return {kind: 'err', msg: 'The write service could not be reached.'}; }
  const {res, body} = answer;
  if(!res.ok || !body || typeof body.src !== 'string' || cloudOfSrc(body.src) !== name || !mediaSrcOk(body.src))
    return {kind: 'err', msg: (body && body.error) || `${CLOUD_NAMES[name]} did not share the file.`};
  const shown = String(body.name || item.name || 'the file');
  /* Picked twice, it is still one file of the chart. */
  if(MEDIA.some(m=> m.src === body.src)) return {kind: 'ok', msg: `${shown} is in My files already.`};
  const label = String(body.name || item.name || 'figure').replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'figure';
  applyMediaEdit(()=> MEDIA.push({key: uniqueMediaKey(label), name: label, kind: body.kind === 'video' ? 'video' : 'image', src: body.src}));
  renderStickerLibrary();
  return {kind: 'ok', added: true, msg: `${shown} is in My files, and on its way to the chart with the next Save.`};
}
if(cloudOverlay){
  cloudOverlay.addEventListener('click', ev=> ev.stopPropagation());
  document.getElementById('cloudClose').onclick = ()=> closeCloudBrowser();
  document.getElementById('cloudUp').onclick = (ev)=>{
    ev.stopPropagation();
    if(!cloudAt || !cloudAt.trail.length) return;
    cloudAt.trail.pop();
    listCloudFolder();
  };
  document.getElementById('cloudBack').onclick = (ev)=>{
    ev.stopPropagation();
    closeCloudBrowser();
    openStickerLibrary();
  };
}
