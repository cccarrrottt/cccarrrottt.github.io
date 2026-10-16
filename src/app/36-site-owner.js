/* =========================================================================
   THE OWNER, ON THE PUBLISHED SITE
   -----------------------------------------------------------------------
   The site is a static page, and a static page cannot be written to. So
   the writing goes somewhere else: a small service (worker/ in the
   repository) that signs the owner in through GitHub, and on Save commits
   the chart's regions into src/data.js. The commit is the publish — CI
   builds the page from it and puts it on the site, exactly as it does for
   any other change.

   Two consequences are worth keeping in view.

   Nothing here decides who may write. The page asks the service "who is
   this?", and shows the editor only when the answer is the owner; a page
   that lied to itself about that would get an editor whose every Save is
   refused, because the service checks the session on each write and
   GitHub checks it again. What this code controls is only what a reader
   is SHOWN.

   And a save is not on the site the moment it is made: the site has to be
   rebuilt first, which takes minutes. Until then the page on the site is
   older than the repository, and a page that is behind must not be edited
   and saved — that would write the older chart over the newer one. The
   service refuses it (the base has to be the file currently there), and
   the page says why before anybody starts editing, rather than after.

   And the owner may have no connection at all — a phone on a train, the
   page opened from the home screen with the site cached on it. The page
   then trusts the last answer it had: an owner it confirmed before stays
   the owner, and a Save is kept on this device (the OUTBOX, beside the
   draft in IndexedDB) and sent when the connection comes back. Trusting
   it costs nothing, for the reason above — the service still checks the
   session when the save arrives.
   ========================================================================= */
const SITE_SESSION_KEY = 'rhizome.site.session';
/* Who the service last said this session was, for opening with no
   connection to ask. Forgotten with the session. */
const SITE_OWNER_KEY = 'rhizome.site.owner';
/* The key of the kept Save in the draft store (22-file-comments). */
const SITE_OUTBOX_KEY = 'rhizome.site.outbox';
const ownerBtn = document.getElementById('ownerBtn');
/* The data.js this page's next save replaces. It starts as the one the page
   was built from and moves with every save, so a second save before the
   site has caught up is still a save on top of the first. */
let siteBase = DATA_SHA;
let siteOwner = null;

function siteSession(){
  try{ return localStorage.getItem(SITE_SESSION_KEY) || null; }catch(e){ return null; }
}
function setSiteSession(token){
  try{
    if(token) localStorage.setItem(SITE_SESSION_KEY, token);
    else localStorage.removeItem(SITE_SESSION_KEY);
  }catch(e){}
}
function rememberedOwner(){
  try{ return localStorage.getItem(SITE_OWNER_KEY) || null; }catch(e){ return null; }
}
function rememberOwner(login){
  try{
    if(login) localStorage.setItem(SITE_OWNER_KEY, login);
    else localStorage.removeItem(SITE_OWNER_KEY);
  }catch(e){}
}
function forgetSiteSession(){
  setSiteSession(null);
  rememberOwner(null);
  siteOwner = null;
  updateOwnerBtn();
}
function siteApiOrigin(){
  try{ return new URL(SITE_API).origin; }catch(e){ return null; }
}

/* A session travels in a header, not a cookie. The service lives on a
   different site from the page, and browsers now refuse third-party cookies
   by default — a cookie session would work on one browser and silently not
   on the next.
 *
   Any answer may carry a renewed session (worker/index.js, renew), and the
   one it replaces can no longer be renewed: GitHub takes each refresh token
   once. So requests go one at a time, each reading the session the last
   one left — two at once, both renewing the same session, would have the
   second refused and sign the owner out. Resolves to {res, body}; rejects
   only when the service could not be reached. */
let siteChain = Promise.resolve();
function siteRequest(path, init){
  const run = siteChain.then(async ()=>{
    const token = siteSession();
    const headers = Object.assign({}, (init && init.headers) || {});
    if(token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(SITE_API + path, Object.assign({}, init || {}, {headers, cache:'no-store'}));
    let body = null;
    try{ body = await res.json(); }catch(e){}
    if(body && typeof body.session === 'string' && body.session) setSiteSession(body.session);
    return {res, body};
  });
  siteChain = run.catch(()=>{});
  return run;
}
/* No connection is not worth a request that can only fail — and on a
   phone that has lost its signal, can take a long time to. */
function siteOffline(){
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
function siteError(code, message){
  const e = new Error(message);
  e.code = code;
  return e;
}

function updateOwnerBtn(){
  if(!ownerBtn) return;
  ownerBtn.hidden = !(ON_SITE && SITE_API);
  ownerBtn.textContent = siteOwner ? 'Sign out' : 'Owner sign-in';
  ownerBtn.title = siteOwner
    ? `Signed in as ${siteOwner}. Sign out to see the chart as readers do.`
    : 'Sign in with GitHub to edit this chart. Only its owner can.';
}

/* Asked once at load, and again whenever a sign-in completes. Anything
   short of a clear "yes, the owner, and your page is current" leaves the
   page a reader — an unreachable service included, since the only thing
   an editor could do without it is lose work at Save. */
async function checkSiteOwner(){
  if(!ON_SITE || !SITE_API || !siteSession()) return false;
  const kept = await readOutbox();
  if(kept && kept.data && kept.parts) takeOutbox(kept);
  let answer = null;
  if(!siteOffline()){ try{ answer = await siteRequest('/me'); }catch(e){} }
  if(!answer) return workOffline();
  const {res, body: me} = answer;
  if(res.status === 401){
    forgetSiteSession();
    if(sitePending) setSaveState('err', SITE_SIGN_IN_TO_SEND);
    return false;
  }
  if(!res.ok || !me || !me.owner) return false;
  siteOwner = me.login || 'owner';
  rememberOwner(siteOwner);
  updateOwnerBtn();
  /* A kept Save made on an older chart is sent before anything is decided
     about it: if it is what the repository already holds — sent before,
     with the answer lost on the way back — the service says so rather than
     calling it a conflict, and this page is current after all. */
  if(sitePending && me.sha && me.sha !== siteBase) await flushOutbox();
  if(me.sha && siteBase && me.sha !== siteBase){
    if(!sitePending) setSaveState('err', 'The repository has a newer chart than this page. It is still being published — reload in a few minutes to edit.');
    return false;
  }
  markEditable();
  if(sitePending) flushOutbox();
  return true;
}

/* With no answer to be had, the last one stands. Only an owner this
   browser has already seen confirmed is let in, and only while it still
   holds the session the service will check. */
function workOffline(){
  const who = rememberedOwner();
  if(!who || !siteSession()) return false;
  siteOwner = who;
  updateOwnerBtn();
  markEditable();
  if(!sitePending && !isDirty()) setSaveState('ok', 'No connection \u2014 Save keeps changes on this device until there is one');
  return true;
}

/* A popup rather than a redirect, so that unsaved work in this tab is still
   here when the sign-in comes back — a session that expired mid-edit is
   renewed without losing the edit. A browser that refuses the popup gets
   the redirect, which returns to this address. */
function siteSignIn(){
  const base = SITE_API + '/login?origin=' + encodeURIComponent(location.origin);
  const w = window.open(base, 'rhizome-sign-in', 'width=520,height=720');
  if(w) return;
  location.href = base + '&return=' + encodeURIComponent(location.origin + location.pathname);
}
function siteSignOut(){
  forgetSiteSession();
  markReadOnly(false);
  updateOwnerBtn();
  describeWhereItSaves();
}

window.addEventListener('message', ev=>{
  if(!ON_SITE || ev.origin !== siteApiOrigin()) return;
  const token = ev.data && ev.data.rhizomeSession;
  if(typeof token !== 'string' || !token) return;
  setSiteSession(token);
  checkSiteOwner();
});

/* Save, when the page is on the site. The regions go as the same text the
   page writes into itself and Export data writes into a file, so the
   service needs to know nothing about the chart beyond where its markers
   are. */
async function saveToSite(){
  if(!siteSession()) throw siteError('signed_out', 'you are not signed in.');
  const parts = writeChartParts();
  if(siteOffline()) return keepForLater(parts);
  let answer;
  try{
    answer = await siteRequest('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({base: siteBase, parts})
    });
  }catch(e){
    return keepForLater(parts);
  }
  const {res, body} = answer;
  if(res.status === 401){ forgetSiteSession(); throw siteError('signed_out', 'your sign-in has expired.'); }
  if(res.status === 403) throw siteError('not_writer', 'this account may not edit the chart.');
  if(res.status === 409) throw siteError('conflict', 'the repository has a newer chart.');
  if(res.status === 413) throw siteError('too_large', 'the chart is too large to send.');
  if(!res.ok) throw siteError('site_' + res.status, (body && body.error) || 'the save service refused the save.');
  if(body && body.sha) siteBase = body.sha;
  /* This save carried everything a kept one did, and more. */
  if(sitePending){ await dropOutbox(); sitePending = false; }
  savedParts = snapshotParts();
  saveBtn.textContent = 'Saved';
  setSaveState('ok', 'Saved — the site shows it in a few minutes');
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(refreshSaveUI, 4000);
}

/* ---- the outbox: a Save that could not be sent yet ---- */
const SITE_SIGN_IN_TO_SEND = 'Changes saved on this device are waiting \u2014 press Owner sign-in to send them';
function readOutbox(){ return draftDo('readonly', st=> st.get(SITE_OUTBOX_KEY)); }
function dropOutbox(){ return draftDo('readwrite', st=> st.delete(SITE_OUTBOX_KEY)); }
function putOutbox(entry){ return draftDo('readwrite', st=> st.put(entry, SITE_OUTBOX_KEY)); }

/* The whole chart is kept, not what changed: a save is the chart's regions
   whole, so a second Save with no connection simply replaces the first,
   and the base stays the chart both were made on top of. The chart itself
   is kept beside the regions so that the page can show it when it is
   opened again before the Save has gone — otherwise it would open on the
   chart it was built with and look as if the work had been lost. */
async function keepForLater(parts){
  const kept = await putOutbox({at: Date.now(), base: siteBase, parts, data: chartData()});
  if(!kept) throw siteError('offline', 'could not reach the save service, and this browser would not keep the chart either. Export it to keep it.');
  sitePending = true;
  savedParts = snapshotParts();
  refreshSaveUI();
}

/* Opening with a Save still kept: that IS the chart on this device. Taken
   once — a later sign-in asks again, and by then the chart may have been
   edited on top of it. */
let outboxTaken = false;
function takeOutbox(kept){
  sitePending = true;
  if(kept.base) siteBase = kept.base;
  if(outboxTaken) return;
  outboxTaken = true;
  try{
    putChartData(kept.data);
    savedParts = snapshotParts();
    rebuildChart();
    buildSideTabs();
  }catch(e){}
  refreshSaveUI();
}

/* Sent one at a time; a second call while one is on its way waits for it. */
let siteFlushing = null;
function flushOutbox(){
  if(!siteFlushing) siteFlushing = sendOutbox().finally(()=>{ siteFlushing = null; });
  return siteFlushing;
}
async function sendOutbox(){
  const kept = await readOutbox();
  if(!kept || !kept.parts){ sitePending = false; refreshSaveUI(); return true; }
  if(!siteSession()){ setSaveState('err', SITE_SIGN_IN_TO_SEND); return false; }
  if(siteOffline()) return false;
  let answer;
  try{
    answer = await siteRequest('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({base: kept.base, parts: kept.parts})
    });
  }catch(e){ return false; }
  const {res, body} = answer;
  if(res.status === 401){ forgetSiteSession(); setSaveState('err', SITE_SIGN_IN_TO_SEND); return false; }
  /* Kept, not thrown away: the work is still the owner's, and Export takes
     it as a file. Putting the two charts together is not this code's to
     guess at. */
  if(res.status === 409){
    setSaveState('err', 'The repository has a newer chart than the one the changes on this device were made on. They are kept here \u2014 Export takes them as a file.');
    return false;
  }
  if(!res.ok) return false;
  if(body && body.sha) siteBase = body.sha;
  /* A Save made while this one was on its way is a later chart, made on
     top of this one — it stays, on the new base. */
  const now = await readOutbox();
  if(now && now.at !== kept.at) await putOutbox(Object.assign({}, now, {base: siteBase}));
  else { await dropOutbox(); sitePending = false; }
  if(!isDirty() && !sitePending){
    setSaveState('ok', 'Sent to the site \u2014 it shows there in a few minutes');
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(refreshSaveUI, 4000);
  } else refreshSaveUI();
  return true;
}

/* The connection coming back. A phone does not always say so with an
   'online' event — a page brought back to the front is asked too. */
function siteReconnected(){
  if(!ON_SITE || !SITE_API || !siteSession() || siteOffline()) return;
  if(readOnlyView || !siteOwner) checkSiteOwner();
  else if(sitePending) flushOutbox();
}
window.addEventListener('online', siteReconnected);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible' && sitePending) siteReconnected();
});

if(ownerBtn) ownerBtn.onclick = ()=>{ if(siteOwner) siteSignOut(); else siteSignIn(); };

/* The redirect path hands the session back in the fragment, which never
   reaches any server. It is taken out of the address at once, so it is not
   left in the history or in a link somebody copies. */
if(ON_SITE){
  const m = /(?:^#|&)rhizome-session=([^&]+)/.exec(location.hash || '');
  if(m){
    setSiteSession(decodeURIComponent(m[1]));
    try{ window.history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  }
  updateOwnerBtn();
  checkSiteOwner();
}

/* The site as something a phone can keep: a manifest, so it can be put on
   the home screen and opened without the browser around it, and a worker
   that keeps the page for when there is no signal (src/site/, published
   beside the page). Only on the site — a copy on a disk has nowhere to
   fetch them from, and another host has not published them.
 *
   Added from here rather than written into the page's head, for the same
   reason: in the head they would be asked for everywhere the page is
   opened, and fail loudly everywhere but here. */
if(ON_SITE){
  const head = document.head;
  const link = (rel, href, extra)=>{
    const el = document.createElement('link');
    el.rel = rel; el.href = href;
    Object.assign(el, extra || {});
    head.appendChild(el);
  };
  const meta = (name, content)=>{
    const el = document.createElement('meta');
    el.name = name; el.content = content;
    head.appendChild(el);
  };
  link('manifest', 'manifest.webmanifest');
  link('icon', 'icon.svg', {type: 'image/svg+xml'});
  link('apple-touch-icon', 'apple-touch-icon.png');
  meta('theme-color', '#141c2b');
  meta('apple-mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-title', 'Rhizome');
  if(navigator.serviceWorker){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
