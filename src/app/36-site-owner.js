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
   ========================================================================= */
const SITE_SESSION_KEY = 'rhizome.site.session';
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
function siteApiOrigin(){
  try{ return new URL(SITE_API).origin; }catch(e){ return null; }
}

/* A session travels in a header, not a cookie. The service lives on a
   different site from the page, and browsers now refuse third-party cookies
   by default — a cookie session would work on one browser and silently not
   on the next. */
function siteCall(path, init){
  const token = siteSession();
  const headers = Object.assign({}, (init && init.headers) || {});
  if(token) headers.Authorization = 'Bearer ' + token;
  return fetch(SITE_API + path, Object.assign({}, init || {}, {headers, cache:'no-store'}));
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
  let res;
  try{ res = await siteCall('/me'); }catch(e){ return false; }
  if(res.status === 401){
    setSiteSession(null);
    updateOwnerBtn();
    return false;
  }
  if(!res.ok) return false;
  let me = null;
  try{ me = await res.json(); }catch(e){ return false; }
  if(!me || !me.owner) return false;
  siteOwner = me.login || 'owner';
  updateOwnerBtn();
  if(me.sha && siteBase && me.sha !== siteBase){
    setSaveState('err', 'The repository has a newer chart than this page. It is still being published — reload in a few minutes to edit.');
    return false;
  }
  markEditable();
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
  setSiteSession(null);
  siteOwner = null;
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
  let res;
  try{
    res = await siteCall('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({base: siteBase, parts: writeChartParts()})
    });
  }catch(e){
    throw siteError('offline', 'could not reach the save service. Check the connection and press Save again.');
  }
  let body = null;
  try{ body = await res.json(); }catch(e){}
  if(res.status === 401){ setSiteSession(null); throw siteError('signed_out', 'your sign-in has expired.'); }
  if(res.status === 403) throw siteError('not_writer', 'this account may not edit the chart.');
  if(res.status === 409) throw siteError('conflict', 'the repository has a newer chart.');
  if(res.status === 413) throw siteError('too_large', 'the chart is too large to send.');
  if(!res.ok) throw siteError('site_' + res.status, (body && body.error) || 'the save service refused the save.');
  if(body && body.sha) siteBase = body.sha;
  savedParts = snapshotParts();
  saveBtn.textContent = 'Saved';
  setSaveState('ok', 'Saved — the site shows it in a few minutes');
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(refreshSaveUI, 4000);
}

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
