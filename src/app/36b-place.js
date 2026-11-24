/* =========================================================================
   WHERE THE CHART IS KEPT
   -----------------------------------------------------------------------
   The platform is meant to be forked, and a fork starts with no chart at
   all: its first Save makes one. Where that one lives is the owner's to
   say — the fork itself, or any repository the GitHub App has been let
   into — and the owner may move it later. The answer is the site
   repository's variable RHIZOME_DATA (tools/where.py reads it to publish,
   and the write service reads it to save: livePlace, worker/index.js), so
   no file of the platform changes, and a fork's "Sync fork" never meets
   it.

   Shown in About, to the owner on the site and nobody else (an editor
   saves where the owner keeps it), and asked once at the first Save of a
   chart with no home yet (saveToSite, 36-site-owner.js). Two ways to
   change it: MOVE takes this chart, with its pictures, to a place that
   holds none yet; OPEN switches to whatever is kept there, which is how a
   second site shows a chart already kept somewhere. The service refuses
   a move onto a chart, because two charts are not merged by moving one
   onto the other.

   An editing part (LAZY_PARTS, build.py): only the owner's page has it.
   ========================================================================= */
const aboutPlace = document.getElementById('aboutPlace');
/* What /places last said: where the chart is, and where it could be. */
let placeAnswer = null;
/* Opened by a first Save, which this then sends once a place is chosen. */
let placeForFirstSave = false;

function placeHref(d){
  return `https://github.com/${d.repo}/blob/${encodeURIComponent(d.branch)}/${d.path.split('/').map(encodeURIComponent).join('/')}`;
}

async function loadPlaces(){
  if(!aboutPlace) return;
  if(!ON_SITE || !SITE_API || !siteOwner || siteEditor || siteOffline()){ aboutPlace.hidden = true; return; }
  paintPlace();
  let answer = null;
  try{ answer = await siteRequest('/places'); }catch(e){}
  if(answer && answer.res.ok && answer.body){
    placeAnswer = answer.body;
    if(answer.body.data) setDataPlace(answer.body.data);
    paintPlace();
  } else {
    placeSay(answer && answer.body && answer.body.error
      ? answer.body.error : 'The write service could not say where else the chart could be kept.');
  }
}

/* The owner asked to save a chart that has no home yet. */
function openPlaceChooser(first){
  placeForFirstSave = !!first;
  document.getElementById('aboutToggle').click();
  loadPlaces().then(()=>{ if(aboutPlace && !aboutPlace.hidden) aboutPlace.scrollIntoView({block: 'start', behavior: 'smooth'}); });
}

function placeSay(msg){
  const out = aboutPlace && aboutPlace.querySelector('.place-said');
  if(out) out.textContent = msg || '';
}

function paintPlace(){
  aboutPlace.hidden = false;
  aboutPlace.textContent = '';
  const here = Object.assign({}, DATA_PLACE);
  const empty = siteBase === NO_CHART;
  const head = document.createElement('h3');
  head.textContent = 'Where the chart is kept';
  const now = document.createElement('p');
  const link = document.createElement('a');
  link.href = empty ? `https://github.com/${here.repo}` : placeHref(here);
  link.target = '_blank'; link.rel = 'noopener';
  link.textContent = here.repo;
  const file = document.createElement('code');
  file.textContent = here.path;
  if(empty) now.append('Nothing is kept yet. Save makes ', file, ' in ', link, '.');
  else now.append(file, ' in ', link, ', on ' + here.branch + '.');
  aboutPlace.append(head, now);

  /* Where else: the repositories the app may write to, and a file in one. */
  const form = document.createElement('div');
  form.className = 'place-form';
  const repoLabel = document.createElement('label');
  repoLabel.textContent = 'Repository';
  const repo = document.createElement('select');
  const places = (placeAnswer && Array.isArray(placeAnswer.places)) ? placeAnswer.places.slice() : [];
  if(!places.some(p => p.repo.toLowerCase() === here.repo.toLowerCase())) places.unshift({repo: here.repo, branch: here.branch});
  for(const p of places){
    const o = document.createElement('option');
    o.value = p.repo;
    o.textContent = p.repo + (p.private ? ' (private)' : '');
    o.dataset.branch = p.repo.toLowerCase() === here.repo.toLowerCase() ? here.branch : (p.branch || 'main');
    if(p.repo.toLowerCase() === here.repo.toLowerCase()) o.selected = true;
    repo.appendChild(o);
  }
  repoLabel.appendChild(repo);
  const pathLabel = document.createElement('label');
  pathLabel.textContent = 'File';
  const path = document.createElement('input');
  path.type = 'text'; path.value = here.path; path.autocomplete = 'off'; path.spellcheck = false;
  path.setAttribute('translate', 'no');
  pathLabel.appendChild(path);
  form.append(repoLabel, pathLabel);
  aboutPlace.appendChild(form);

  const chosen = ()=>{
    const o = repo.selectedOptions[0];
    const d = dataPlaceOf(`${repo.value}/${path.value.trim().replace(/^\/+/, '')}@${(o && o.dataset.branch) || 'main'}`);
    return d && /\.json$/i.test(d.path) ? d : null;
  };
  const same = d => d.repo.toLowerCase() === here.repo.toLowerCase() && d.path === here.path && d.branch === here.branch;
  const buttons = document.createElement('p');
  buttons.className = 'place-buttons';
  const button = (text, title, fn, primary)=>{
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'editor-btn' + (primary ? ' primary' : '');
    b.textContent = text; b.title = title; b.onclick = fn;
    buttons.appendChild(b);
    return b;
  };
  if(empty){
    button('Keep it there and save', 'Save the chart to the file chosen above', ()=>{
      const d = chosen();
      if(!d) return placeSay('A file is a path that ends in .json, such as data/chart.json.');
      if(same(d)) return firstSaveHere();
      choosePlace(d, 'move');
    }, true);
  } else {
    button('Move the chart there', 'Take this chart, with its pictures, to the file chosen above, and keep it there from now on', ()=>{
      const d = chosen();
      if(!d) return placeSay('A file is a path that ends in .json, such as data/chart.json.');
      if(same(d)) return placeSay('The chart is kept there already.');
      choosePlace(d, 'move');
    });
    button('Open the chart kept there', 'Show and edit the chart kept in the file chosen above instead of this one; this one stays where it is', ()=>{
      const d = chosen();
      if(!d) return placeSay('A file is a path that ends in .json, such as data/chart.json.');
      if(same(d)) return placeSay('That is the chart open now.');
      if(isDirty()) return placeSay('Save or undo the changes first: opening another chart puts this one away.');
      choosePlace(d, 'use');
    });
  }
  if(placeAnswer && typeof placeAnswer.manage === 'string' && /^https:\/\/github\.com\//.test(placeAnswer.manage)){
    const more = document.createElement('a');
    more.href = placeAnswer.manage; more.target = '_blank'; more.rel = 'noopener';
    more.textContent = 'Let the app into another repository';
    buttons.appendChild(more);
  }
  aboutPlace.appendChild(buttons);
  const said = document.createElement('p');
  said.className = 'place-said';
  said.setAttribute('role', 'status');
  if(empty && placeForFirstSave) said.textContent = 'This chart has no home yet. Keep it in this repository, or choose another.';
  aboutPlace.appendChild(said);
}

function firstSaveHere(){
  placeForFirstSave = false;
  sitePlaceChosen = true;
  aboutOverlay.classList.remove('open');
  saveNow();
}

async function choosePlace(d, mode){
  const data = `${d.repo}/${d.path}@${d.branch}`;
  placeSay(mode === 'move' && siteBase !== NO_CHART ? 'Moving the chart…' : 'One moment…');
  let answer = null;
  try{
    answer = await siteRequest('/place', {method: 'POST', headers: {'Content-Type': 'application/json'},
                                           body: JSON.stringify({data, mode})});
  }catch(e){}
  if(!answer) return placeSay('The write service could not be reached. The chart stays where it is.');
  const {res, body} = answer;
  if(res.status === 401){ forgetSiteSession(); return placeSay('Your sign-in has expired. Sign in, then try again.'); }
  if(!res.ok || !body) return placeSay((body && body.error) || `The write service answered ${res.status}. The chart stays where it is.`);
  setDataPlace(body.data);
  if(typeof body.sha === 'string') siteBase = body.sha;
  if(mode === 'use' && typeof body.chart === 'string') openKeptChart(body.chart);
  if(placeForFirstSave) return firstSaveHere();
  paintPlace();
  placeSay(body.unchanged ? 'The chart is kept there already.'
    : body.published === false ? 'Done. The site shows the chart from there the next time it is published.'
    : 'Done. The site shows the chart from there in a few minutes.');
}

/* The chart kept at the place just chosen, put in place of this one as the
   file it is: nothing to save, since it is what is kept. */
function openKeptChart(text){
  const c = chartOfText(text);
  const lists = ['edgeStyles', 'stickers', 'media', 'comments', 'tagCats', 'refs'];
  const data = {nodes: (c.nodes || []).map(entryOfRecord), settings: c.settings || {format: DATA_FORMAT}};
  lists.forEach(k => { data[k] = Array.isArray(c[k]) ? c[k] : []; });
  restoreChartData(data);
  savedParts = snapshotParts();
  refreshSaveUI();
}

document.getElementById('aboutToggle').addEventListener('click', ()=>{ if(!placeForFirstSave) loadPlaces(); });
