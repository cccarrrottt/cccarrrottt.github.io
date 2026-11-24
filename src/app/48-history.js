/* =========================================================================
   THE CHART'S HISTORY
   -------------------------------------------------------------------------
   Every Save on the site is a commit of the chart's file (DATA_PLACE:
   src/chart.json, or wherever 00-config.js keeps it), so the history of
   the chart is its repository's history of that one file — the way a
   wiki's page has its own history (the owner's list of 22.11, night: "as
   on TFWiki"). About opens it: each edit by when, by whom and what it was
   called, newest first, with the change itself (what that edit did) and
   everything since (what has changed from it to now) a link away on
   GitHub, which draws the difference of two versions of the file better
   than this page could.

   Read from GitHub's API as anyone reads it, with no session: the chart's
   history is as public as the repository is. Thirty to a page, and the
   next thirty on asking. A copy with no way to GitHub (offline, a file on
   disk with no connection) says it could not read it and still offers
   the link, which is all the history there is to give it.
   ========================================================================= */
const historyOverlay = document.getElementById('historyOverlay');
const historyToggle = document.getElementById('historyToggle');
const historyList = document.getElementById('historyList');
const HISTORY_PER_PAGE = 30;
const historyState = {page: 0, done: false, busy: false};

function historyRepoUrl(){ return 'https://github.com/' + DATA_PLACE.repo; }
/* The edits, as GitHub lists them for the file. */
async function fetchChartHistory(page){
  const url = 'https://api.github.com/repos/' + DATA_PLACE.repo + '/commits?path=' + DATA_PLACE.path +
              '&sha=' + DATA_PLACE.branch + '&per_page=' +
              HISTORY_PER_PAGE + '&page=' + page;
  const res = await fetch(url, {headers: {Accept: 'application/vnd.github+json'}});
  if(!res.ok) throw new Error('GitHub answered ' + res.status);
  const list = await res.json();
  if(!Array.isArray(list)) throw new Error('GitHub answered with something else');
  return list;
}
function historyWhen(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const lang = (typeof pageLang === 'string' && pageLang !== 'en') ? pageLang : 'en-GB';
  try{
    return d.toLocaleString(lang, {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'});
  }catch(e){ return d.toISOString().slice(0, 16).replace('T', ' '); }
}
function historyRow(c){
  const li = document.createElement('li');
  li.className = 'history-item';
  const commit = c.commit || {};
  const who = (c.author && c.author.login) || (commit.author && commit.author.name) || '';
  const when = (commit.committer && commit.committer.date) || (commit.author && commit.author.date) || '';
  const sha = String(c.sha || '');
  const head = document.createElement('div');
  head.className = 'history-head';
  const time = document.createElement('time');
  time.className = 'history-when';
  if(when) time.dateTime = when;
  time.textContent = historyWhen(when);
  head.appendChild(time);
  const by = document.createElement('span');
  by.className = 'history-who';
  by.textContent = who;
  by.setAttribute('translate', 'no');
  head.appendChild(by);
  li.appendChild(head);
  /* What the edit was called: the first line of its message, a person's
     words, so never translated. */
  const what = document.createElement('div');
  what.className = 'history-what';
  what.setAttribute('translate', 'no');
  what.textContent = String(commit.message || '').split('\n')[0];
  li.appendChild(what);
  if(/^[0-9a-f]{7,40}$/.test(sha)){
    const links = document.createElement('div');
    links.className = 'history-links';
    const link = (text, href, title)=>{
      const a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = text; a.title = title;
      links.appendChild(a);
    };
    link('This edit', historyRepoUrl() + '/commit/' + sha, 'What this edit changed, on GitHub');
    link('Since then', historyRepoUrl() + '/compare/' + sha + '...' + DATA_PLACE.branch, 'Everything changed from this version to now, on GitHub');
    link('This version', historyRepoUrl() + '/blob/' + sha + '/' + DATA_PLACE.path, 'The chart as it stood after this edit, on GitHub');
    li.appendChild(links);
  }
  return li;
}
async function loadHistoryPage(){
  if(historyState.busy || historyState.done) return;
  historyState.busy = true;
  const more = document.getElementById('historyMore');
  const note = document.getElementById('historyNote');
  if(more) more.disabled = true;
  note.textContent = 'Reading the history…';
  note.hidden = false;
  try{
    const list = await fetchChartHistory(historyState.page + 1);
    historyState.page++;
    list.forEach(c=> historyList.appendChild(historyRow(c)));
    if(list.length < HISTORY_PER_PAGE) historyState.done = true;
    note.hidden = !!historyList.children.length;
    if(!historyList.children.length) note.textContent = 'No edits yet.';
  }catch(e){
    note.textContent = 'The history could not be read from GitHub just now. It is on GitHub itself, below.';
  }finally{
    historyState.busy = false;
    if(more){ more.disabled = false; more.hidden = historyState.done || !historyList.children.length; }
  }
}
function openHistory(){
  closeToolbarMenus('historyOverlay');
  historyOverlay.classList.add('open');
  historyToggle.setAttribute('aria-expanded', 'true');
  const all = document.getElementById('historyAll');
  if(all) all.href = historyRepoUrl() + '/commits/' + DATA_PLACE.branch + '/' + DATA_PLACE.path;
  /* Read afresh each time it opens, so a Save just made is in it. */
  historyList.textContent = '';
  historyState.page = 0; historyState.done = false;
  loadHistoryPage();
  document.getElementById('historyClose').focus();
}
function closeHistory(){
  if(!historyOverlay.classList.contains('open')) return;
  historyOverlay.classList.remove('open');
  historyToggle.setAttribute('aria-expanded', 'false');
}
historyToggle.onclick = ()=> historyOverlay.classList.contains('open') ? closeHistory() : openHistory();
document.getElementById('historyClose').onclick = ()=>{ closeHistory(); document.getElementById('aboutToggle').focus(); };
document.getElementById('historyMore').onclick = ()=> loadHistoryPage();
historyOverlay.addEventListener('click', e=>{ if(e.target === historyOverlay) closeHistory(); });
new MutationObserver(()=>{
  if(!historyOverlay.classList.contains('open')) historyToggle.setAttribute('aria-expanded', 'false');
}).observe(historyOverlay, {attributes: true, attributeFilter: ['class']});
