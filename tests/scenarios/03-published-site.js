/* tests/scenarios/03-published-site.js — scenarios 73 to 76 of the suite.
 *
 * The page on the published site: who it is for, the suggestions readers
 * leave, the faults it reports, and the owner on a phone with no signal.
 *
 * Run by tests/regression.js, inside its main(), which is why the names
 * here are free: see SCENARIO_FILES there. */

  /* ---- 32. the page on the published site ----
   *
   * There used to be four builds, because whether a copy could be edited
   * was decided when it was built — and for a while the one the site needed
   * did not exist, so Pages served the editor to everybody. Now there is one
   * file and the question is asked when it opens: on the site's own address
   * it is a reader until the write service says the owner is signed in, and
   * anywhere else it is whoever holds it's own copy.
   *
   * Driven at the real address. The browser is given the built file when it
   * asks for the site, and the write service is answered from here, so what
   * is exercised is the page deciding from location.origin and SITE_API, as
   * it will on the day — not a flag the suite set for it. */
  await scenario("the page on the published site", async () => {
  if(MODE === 'src'){
    check('the site serves the built file, so there is nothing to check from src', true);
    return;
  }
  const config = fs.readFileSync(path.join(ROOT, 'src', 'app', '00-config.js'), 'utf8');
  const SITE_ORIGIN = /^\s*site: '([^']+)'/m.exec(config)[1];
  const SITE_API = /^\s*api: '([^']*)'/m.exec(config)[1];
  /* The site as CI stages it: dist/site/, whose page keeps its program and
     stylesheet beside it (build_site in build.py). */
  const SITE_BUILT = path.join(DIR, 'site');
  const html = withFixture(fs.readFileSync(path.join(SITE_BUILT, 'index.html'), 'utf8'));
  const siteFile = name => /^[\w.-]+$/.test(name) && fs.existsSync(path.join(SITE_BUILT, name)) ? fs.readFileSync(path.join(SITE_BUILT, name)) : null;
  const dataRaw = FIXTURE_RAW;
  const dataSha = require('crypto').createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${dataRaw.length}\0`), dataRaw])).digest('hex');
  /* The service's own writer, so what the page sends can be held to what
     the service would commit (chartText, worker/index.js). */
  const {chartText} = await import(require('url').pathToFileURL(path.join(ROOT, 'worker', 'index.js')).href);
  const chartEdited = (text, fn) => { const ch = JSON.parse(text); fn(ch); return chartText(ch); };

  /* The write service, as the page sees it. */
  const api = {sha: dataSha, saves: [], asked: 0, offline: false, renewNext: false, files: {}};
  const SESSIONS = ['Bearer good-session', 'Bearer renewed-session'];
  /* The site's worker would take the page's requests past these routes to
     the real site; the next scenario tests it against a server of its own. */
  const c = await browser.newContext({viewport:{width:1500, height:950}, serviceWorkers: 'block'});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await c.route('https://fonts.googleapis.com/**', quiet);
  await c.route('https://fonts.gstatic.com/**', quiet);
  await c.route(/^https:\/\/github\.com\/[^/]+\.png/, r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  /* The site serves the page, and the pictures the write service has been
     sent (api.files) beside it, as Pages serves src/media. */
  await c.route(SITE_ORIGIN + '/**', r => {
    const u = new URL(r.request().url());
    const m = /^\/(media\/[0-9a-f]{64}\.([a-z0-9]+))$/.exec(u.pathname);
    if(m){
      api.mediaAsked = (api.mediaAsked || 0) + 1;
      return api.files[m[1]] ? r.fulfill({status: 200, contentType: m[2] === 'png' ? 'image/png' : 'application/octet-stream', body: api.files[m[1]]})
                             : r.fulfill({status: 404, body: ''});
    }
    const beside = /\.(js|css)$/.exec(u.pathname) && siteFile(u.pathname.slice(1));
    if(beside && /^\/editor\.[0-9a-f]{16}\.js$/.test(u.pathname)) api.editorAsked = (api.editorAsked || 0) + 1;
    if(beside){
      api.programAsked = (api.programAsked || 0) + 1;
      return r.fulfill({status: 200, contentType: u.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: beside});
    }
    return r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
  });
  /* Signed out, the page reads the open suggestions from GitHub itself;
     here there are none. */
  await c.route('https://api.github.com/**', r => r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'},
    contentType: 'application/json', body: '[]'}));
  await c.route(SITE_API + '/**', async r => {
    const q = r.request(), u = new URL(q.url());
    const cors = {'Access-Control-Allow-Origin': SITE_ORIGIN,
                  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'};
    const reply = (status, body) => r.fulfill({status, headers: cors, contentType: 'application/json', body: JSON.stringify(body)});
    // No connection: the request never gets anywhere.
    if(api.offline) return r.abort('internetdisconnected');
    if(q.method() === 'OPTIONS') return r.fulfill({status: 204, headers: cors});
    if(u.pathname === '/login'){
      // What the real service does at the end of a sign-in, minus GitHub.
      return r.fulfill({status: 200, contentType: 'text/html', body:
        `<script>opener.postMessage({rhizomeSession:'good-session'}, ${JSON.stringify(SITE_ORIGIN)}); close();</script>`});
    }
    api.asked++;
    if(SESSIONS.indexOf(q.headers()['authorization']) < 0) return reply(401, {error: 'not signed in.'});
    if(u.pathname === '/me' && api.meFails) return reply(500, {error: 'src/data.js was not found'});
    if(u.pathname === '/me'){
      // The service renewing a session whose GitHub token ran out.
      const renewed = api.renewNext ? {session: 'renewed-session'} : {};
      api.renewNext = false;
      return reply(200, api.editor ? {owner: false, editor: true, login: 'an-editor', sha: api.sha, media: true}
                                   : {owner: true, login: 'the-owner', sha: api.sha, media: !api.noMedia, ...renewed});
    }
    /* The faults the service has counted, and taking them off. */
    if(u.pathname === '/faults') return api.editor ? reply(403, {error: 'this account may not edit the chart.'})
                                                   : reply(200, {kept: true, faults: api.faults || []});
    if(u.pathname === '/faults/clear'){
      const b = JSON.parse(q.postData());
      (api.cleared = api.cleared || []).push(b);
      api.faults = b.all ? [] : (api.faults || []).filter(f => f.key !== b.key);
      return reply(200, {cleared: 1});
    }
    if(u.pathname === '/save'){
      const b = JSON.parse(q.postData());
      api.saves.push(b);
      /* An editor's save: the service keeps the repository's settings and
         answers with the chart as it saved it. */
      if(api.editor && b.base === api.sha){
        const chart = chartEdited(b.chart, ch => { ch.settings = JSON.parse(dataRaw.toString('utf8')).settings; });
        api.sha = 'sha-after-editor-save';
        return reply(200, {sha: api.sha, merged: true, settingsKept: true, chart});
      }
      if(b.base !== api.sha){
        // What the service answers when both saves changed one thing…
        if(api.conflicts) return reply(409, {error: 'the repository has a newer chart, and it changed something this save changed too.', conflicts: api.conflicts});
        // …and when they did not: the save merged with the desk's, which added a reference.
        if(api.mergeNext){
          api.mergeNext = false;
          const over = api.sha;
          api.sha = 'merged-sha';
          api.saves[api.saves.length - 1].merged = true;
          const chart = chartEdited(b.chart, ch => ch.refs.push({key: 'desk-ref', title: 'From the desk'}));
          return reply(200, {sha: api.sha, over, merged: true, chart});
        }
        return reply(409, {error: 'the repository has a newer chart.'});
      }
      Object.keys(b.media || {}).forEach(k => { api.files[k] = Buffer.from(b.media[k], 'base64'); });
      api.sha = 'sha-after-save-' + api.saves.length;
      return reply(200, {sha: api.sha});
    }
    return reply(404, {error: 'not found'});
  });
  /* A chart left in this browser from the days when the site served an
     editor, by a reader who thought they had changed it. */
  await c.addInitScript(([origin]) => {
    if(location.origin !== origin) return;
    try{
      if(!sessionStorage.getItem('suite.seeded')){
        localStorage.setItem('rhizome.chart:/', JSON.stringify({v:1, nodes:[['old','A READER’S OLD EDIT']]}));
        sessionStorage.setItem('suite.seeded', '1');
      }
    }catch(e){}
  }, [SITE_ORIGIN]);
  const errs = [];

  /* ---- a reader ---- */
  const site = await c.newPage();
  site.on('pageerror', e => errs.push(e.message));
  // Anything the site's policy refuses is the page broken by its own guard.
  site.on('console', m => { if(/Content Security Policy/i.test(m.text())) errs.push(m.text()); });
  await site.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await site.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(300);
  const r = await site.evaluate(async () => {
    const shown = id => { const b = document.getElementById(id); return !!b && getComputedStyle(b).display !== 'none'; };
    const out = {
      wholeDocument: document.doctype !== null && document.documentElement.tagName === 'HTML',
      onSite: ON_SITE,
      readOnly: readOnlyView,
      bodySaysSo: document.body.classList.contains('read-only'),
      drew: document.querySelectorAll('#nodeLayer .node').length,
      oldEditShown: workingNodes.some(n => n[1] === 'A READER’S OLD EDIT'),
      saveHidden: !shown('saveBtn'),
      signIn: shown('ownerBtn') ? document.getElementById('ownerBtn').getAttribute('aria-label') : null,
      exportOffered: ['fileToggle', 'fileExport', 'fileExportJson'].every(shown),
      importRefused: !shown('fileImport') || readOnlyView
    };
    /* Nothing that offers to change the chart: no ✕ on a tag, and a click
       on a connector opens no settings for it. */
    document.getElementById('tagsTab').click();
    await new Promise(res => setTimeout(res, 200));
    out.tagRows = document.querySelectorAll('#tagsList .legend-item, .legend-item').length;
    out.tagDeletes = [...document.querySelectorAll('.legend-tag-del')].filter(b => getComputedStyle(b).display !== 'none').length;
    const hit = document.querySelector('.edge-hit');
    if(hit) hit.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    out.edgeClicked = !!hit;
    out.edgePanel = document.getElementById('edgePopover').classList.contains('open');
    const was = workingNodes[0][1];
    applyEdit(() => { workingNodes[0][1] = 'A VISITOR WROTE THIS'; });
    out.editRefused = workingNodes[0][1] === was;
    out.stillClean = !isDirty();
    return out;
  });
  check('the site is served the one built file, a whole document', r.wholeDocument && r.onSite,
        JSON.stringify({doc: r.wholeDocument, onSite: r.onSite}));
  check('and on the site it is a reader on the first frame',
        r.readOnly && r.bodySaysSo, JSON.stringify({flag: r.readOnly, body: r.bodySaysSo}));
  check('it draws the chart', r.drew > 0, `${r.drew} nodes`);
  check('a reader is offered no ✕ on a tag and no settings for a clicked connector',
        r.tagRows > 0 && r.tagDeletes === 0 && r.edgeClicked && !r.edgePanel,
        JSON.stringify({rows: r.tagRows, dels: r.tagDeletes, clicked: r.edgeClicked, panel: r.edgePanel}));
  check('a chart left in this browser by the old editable site is not shown', !r.oldEditShown);
  check('it offers no Save', r.saveHidden);
  check('but it does offer a way in, to everybody', r.signIn === 'Sign in', r.signIn);
  check('an edit made in it does nothing', r.editRefused && r.stillClean,
        JSON.stringify({refused: r.editRefused, clean: r.stillClean}));
  check('a reader may still take a copy away', r.exportOffered);
  check('and may not write one back in', r.importRefused);
  check('a reader with no session never asks the write service anything', api.asked === 0, `${api.asked} requests`);
  const forged = await site.evaluate(async () => {
    window.postMessage({rhizomeSession: 'good-session'}, '*');
    await new Promise(res => setTimeout(res, 400));
    return {readOnly: readOnlyView, stored: localStorage.getItem('rhizome.site.session')};
  });
  check('a session offered by anyone but the write service is ignored',
        forged.readOnly && forged.stored === null, JSON.stringify(forged));
  /* The editing parts are a file of their own on the site (LAZY_PARTS,
     build.py), and a reader reading has no use for them. */
  const readerStubs = await site.evaluate(() => ({named: !!window.RHIZOME_EDITOR,
    stub: typeof openNodeEditor === 'function' && /^function openNodeEditor\(\)\s*\{\s*\}$/.test(String(openNodeEditor)),
    editorHere: typeof NODE_EDITOR_MINH !== 'undefined'}));
  check('a reader\'s page never asks for the editing parts, and runs without them',
        !api.editorAsked && readerStubs.named && readerStubs.stub && !readerStubs.editorHere,
        JSON.stringify({asked: api.editorAsked, readerStubs}));

  /* What the reader carries away is a copy of their own. Driven through the
     button, with the download plumbing stubbed, and opened the way a reader
     opens it: off a disk, with no server at all. */
  const taken = await site.evaluate(async () => {
    const realCreate = URL.createObjectURL;
    const realClick = HTMLAnchorElement.prototype.click;
    let grabbed = null;
    URL.createObjectURL = (blob)=>{ grabbed = blob; return 'blob:taken-by-the-suite'; };
    HTMLAnchorElement.prototype.click = function(){};
    try{
      document.getElementById('fileExport').click();
      for(let i = 0; i < 200 && !grabbed; i++) await new Promise(res => setTimeout(res, 25));
    }finally{
      URL.createObjectURL = realCreate;
      HTMLAnchorElement.prototype.click = realClick;
    }
    return grabbed ? await grabbed.text() : null;
  });
  const kept = path.join(os.tmpdir(), `rhizome-taken-copy-${process.pid}.html`);
  let r2 = null;
  if(taken){
    fs.writeFileSync(kept, taken, 'utf8');
    try{
      const opened = await c.newPage();
      await opened.goto('file://' + kept, {waitUntil:'load'});
      await opened.waitForFunction(() => typeof rebuildChart === 'function');
      r2 = await opened.evaluate(() => {
        const out = {
          readOnly: readOnlyView,
          drew: document.querySelectorAll('#nodeLayer .node').length,
          saveOffered: getComputedStyle(document.getElementById('saveBtn')).display !== 'none',
          signIn: !document.getElementById('ownerBtn').hidden
        };
        applyEdit(() => { workingNodes[0][1] = 'ITS OWN READER WROTE THIS'; });
        out.editTook = workingNodes[0][1] === 'ITS OWN READER WROTE THIS';
        return out;
      });
      await opened.close();
    }finally{ try{ fs.unlinkSync(kept); }catch(e){} }
  }
  check('off a disk the copy a reader took opens as an editor',
        !!r2 && !r2.readOnly && r2.saveOffered && r2.editTook, JSON.stringify(r2));
  check('it draws the same chart there', !!r2 && r2.drew === r.drew,
        JSON.stringify({site: r.drew, taken: r2 && r2.drew}));
  check('and offers no sign-in, having no site to sign in to', !!r2 && !r2.signIn);

  /* ---- the owner signs in ---- */
  const popup = c.waitForEvent('page');
  await site.click('#ownerBtn');
  await popup;
  await site.waitForFunction(() => !readOnlyView, null, {timeout: 5000}).catch(() => {});
  const inn = await site.evaluate(() => ({
    readOnly: readOnlyView,
    button: document.getElementById('ownerBtn').getAttribute('aria-label'),
    stored: localStorage.getItem('rhizome.site.session'),
    saveShown: getComputedStyle(document.getElementById('saveBtn')).display !== 'none'
  }));
  check('signing in in a popup makes the same tab an editor',
        !inn.readOnly && inn.saveShown && inn.stored === 'good-session', JSON.stringify(inn));
  check('and the button offers to sign out', inn.button === 'Sign out', inn.button);
  const ownerParts = await site.evaluate(() => ({named: window.RHIZOME_EDITOR,
    real: typeof NODE_EDITOR_MINH !== 'undefined' && !/^function openNodeEditor\(\)\s*\{\s*\}$/.test(String(openNodeEditor))}));
  check('the owner\'s page has fetched the editing parts, and edits with them',
        api.editorAsked >= 1 && ownerParts.real && !ownerParts.named, JSON.stringify({asked: api.editorAsked, ownerParts}));

  const saved = await site.evaluate(async () => {
    const out = {sha: DATA_SHA};
    applyEdit(() => { workingNodes[0][1] = 'THE OWNER WROTE THIS'; });
    await saveNow();
    out.dirty = isDirty();
    out.state = document.getElementById('saveStateText').textContent;
    applyEdit(() => { workingNodes[0][1] = 'AND THEN THIS'; });
    await saveNow();
    out.state2 = document.getElementById('saveStateText').textContent;
    return out;
  });
  const first = api.saves[0], second = api.saves[1];
  check('the page knows which chart.json it was built from', saved.sha === dataSha, `${saved.sha} vs ${dataSha}`);
  check('Save sends the chart to the write service, on top of that chart.json',
        !!first && first.base === dataSha && first.chart.includes('THE OWNER WROTE THIS'),
        first ? first.base : 'nothing was sent');
  check('and says the site will catch up, leaving nothing unsaved',
        !saved.dirty && /Saved/.test(saved.state) && /few minutes/.test(saved.state), saved.state);
  check('a second save stacks on the first rather than on the file the page was built from',
        !!second && second.base === 'sha-after-save-1' && /Saved/.test(saved.state2), second ? second.base : 'nothing sent');
  /* What the page sends is the file it will be written into, as the
     service writes it. If it were not — a different indent, a field in
     another order — every save would rewrite the whole of chart.json, and
     the history of the chart would be a list of commits that each changed
     everything. */
  /* …but for the pictures embedded in it, which go to the site as files of
     their own, named by the SHA-256 of their bytes (MEDIA_REF): the chart
     goes with each one's path where its bytes stood. A tiny one stays. */
  const sha256 = b => require('crypto').createHash('sha256').update(b).digest('hex');
  const EXT = {'image/png':'png', 'image/jpeg':'jpg', 'image/gif':'gif', 'image/webp':'webp', 'image/avif':'avif',
               'image/bmp':'bmp', 'image/x-icon':'ico', 'image/vnd.microsoft.icon':'ico',
               'video/webm':'webm', 'video/mp4':'mp4', 'video/ogg':'ogv', 'video/quicktime':'mov'};
  const lifted = text => text.replace(/data:((?:image|video)\/[A-Za-z0-9.+-]+)([^'"\\\s]*?);base64,([A-Za-z0-9+/]+=*)/g,
    (u, mime, _, b64) => u.length < 2048 || !EXT[mime.toLowerCase()] ? u
      : 'media/' + sha256(Buffer.from(b64, 'base64')) + '.' + EXT[mime.toLowerCase()]);
  const want = chartEdited(lifted(dataRaw.toString('utf8')), ch => { ch.nodes[0].label = 'THE OWNER WROTE THIS'; });
  check('what it sends is the repository\'s chart.json, byte for byte as the service writes it, but for the edit and its pictures',
        !!first && first.chart === want, first ? `${first.chart.length} chars against ${want.length}` : 'nothing sent');
  const named = first ? Object.keys(first.media || {}) : [];
  check('and each picture it lifted out goes with it, named for what its bytes are',
        !!first && named.every(k => sha256(Buffer.from(first.media[k], 'base64')) === /[0-9a-f]{64}/.exec(k)[0])
        && named.every(k => first.chart.includes(k)), named.join(', '));
  check('a second save sends none of them again', !!second && Object.keys(second.media || {}).length === 0,
        second ? Object.keys(second.media || {}).join(', ') : 'nothing sent');

  /* A picture added in the browser goes the same way, and the page can then
     draw it, export it and take a picture of it from its path. */
  const pic = await site.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 32;
    const g = cv.getContext('2d'), px = g.createImageData(48, 32);
    // Noise, so the picture is past the size a picture stays embedded at.
    for(let i = 0; i < px.data.length; i++) px.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    g.putImageData(px, 0, 0);
    const uri = cv.toDataURL('image/png');
    applyEdit(() => { workingNodes.push(['pic-probe', 'Picture probe', null, null, null, null, {pos:[900, 900], card:true, image: uri}]); });
    await saveNow();
    applyEdit(() => { workingNodes.find(n => n[0] === 'pic-probe')[1] = 'Picture probe again'; });
    await saveNow();
    return {len: uri.length, b64: uri.slice(uri.indexOf(',') + 1)};
  });
  const s3 = api.saves[api.saves.length - 2], s4 = api.saves[api.saves.length - 1];
  const probeRef = 'media/' + sha256(Buffer.from(pic.b64, 'base64')) + '.png';
  check('a picture added in the browser is sent as a file, and the chart names its path',
        pic.len > 2048 && !!s3 && !!(s3.media || {})[probeRef] && s3.chart.includes(probeRef) && !s3.chart.includes(pic.b64.slice(0, 200)),
        JSON.stringify({len: pic.len, saves: api.saves.length, keys: s3 && Object.keys(s3.media || {}), probe: s3 && s3.chart.includes('pic-probe'), ref: s3 && s3.chart.includes(probeRef)}));
  check('and once only', !!s4 && !Object.keys(s4.media || {}).length && s4.chart.includes(probeRef));
  /* An SVG is the exception: a file of one would have an address on the
     site, and opened there its scripts run beside the owner's session. */
  const svgSent = await site.evaluate(async () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!--' + 'x'.repeat(3000) + '--><rect width="10" height="10"/></svg>';
    const uri = 'data:image/svg+xml;base64,' + btoa(body);
    applyEdit(() => { workingNodes.push(['svg-probe', 'SVG probe', null, null, null, null, {pos:[1100, 900], card:true, image: uri}]); });
    await saveNow();
    return uri;
  });
  const s5 = api.saves[api.saves.length - 1];
  check('an SVG past that size stays embedded, and is never sent as a file',
        !!s5 && s5.chart.includes(svgSent) && !Object.keys(s5.media || {}).some(k => /\.svg$/.test(k)),
        s5 ? Object.keys(s5.media || {}).join(', ') : 'nothing sent');
  await site.evaluate(() => { applyEdit(() => { workingNodes.splice(workingNodes.findIndex(n => n[0] === 'svg-probe'), 1); }); });
  const fromPath = await site.evaluate(async ref => {
    const out = {};
    applyEdit(() => { workingNodes.find(n => n[0] === 'pic-probe')[6].image = ref; });
    for(let i = 0; i < 40 && !(imgAspects.get(ref) > 0); i++){ imageAspect(ref); await new Promise(res => setTimeout(res, 50)); }
    out.drawn = imgAspects.get(ref) > 0;
    out.onChart = [...document.querySelectorAll('[data-id="pic-probe"] image')].some(im => im.getAttribute('href') === ref);
    const copy = await inlineMediaRefs(chartFileText());
    out.exportInlined = !copy.includes(ref) && copy.includes('data:image/png;base64,');
    const picture = (await chartPictureText()).text;
    out.pictureInlined = !picture.includes(ref) && /<image[^>]+data:image\/png;base64,/.test(picture);
    applyEdit(() => { const i = workingNodes.findIndex(n => n[0] === 'pic-probe'); workingNodes.splice(i, 1); });
    return out;
  }, probeRef);
  check('a picture named by its path is fetched from beside the page and drawn', fromPath.drawn && fromPath.onChart && api.mediaAsked > 0,
        JSON.stringify(fromPath));
  check('an exported chart carries the picture inside it, not its path', fromPath.exportInlined);

  /* The site's page keeps its program and stylesheet beside it; a copy of
     it is one file, opened where they are not. */
  const copied = await site.evaluate(async () => {
    const src = ensureFullDocument(writeChart(await readOwnSource()));
    return {src, beside: /(?:src|href)="(?:app|style)\.[0-9a-f]{16}\.(?:js|css)" data-inline/.test(src),
            program: src.includes('function inlineSiteFiles('), style: /<style>[^<]*\.brand/.test(src)};
  });
  check('the site\'s page is its chart, with the program and the stylesheet beside it',
        !/<style>/.test(html) && /<script src="app\.[0-9a-f]{16}\.js" data-inline><\/script>/.test(html) && api.programAsked >= 2,
        JSON.stringify({asked: api.programAsked}));
  check('a copy made from it carries both inside it, where their tags stood',
        !copied.beside && copied.program && copied.style, JSON.stringify({beside: copied.beside, program: copied.program, style: copied.style}));
  check('and the editing parts each where it stood in the program, with no stand-in left for them',
        !/\/\*! @(?:editor|lazy|part)|RHIZOME_EDITOR = "editor\./.test(copied.src) && /function openNodeEditor\([^)]/.test(copied.src)
        && copied.src.indexOf('function openNodeEditor(') > copied.src.indexOf('function inlineSiteFiles(')
        && copied.src.indexOf('function openNodeEditor(') < copied.src.indexOf('function checkSiteOwner('),
        JSON.stringify({marks: (copied.src.match(/\/\*! @(?:editor|lazy|part)/g) || []).length,
          at: ['function inlineSiteFiles(', 'function openNodeEditor(', 'function checkSiteOwner('].map(k=> copied.src.indexOf(k)),
          named: /RHIZOME_EDITOR = "editor\./.test(copied.src)}));
  {
    const elsewhere = await browser.newContext({viewport: {width: 1200, height: 800}});
    await elsewhere.route('https://fonts.googleapis.com/**', quiet);
    await elsewhere.route('https://fonts.gstatic.com/**', quiet);
    await elsewhere.route('http://a-copy.test/**', r => r.request().url().endsWith('/copy.html')
      ? r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: copied.src})
      : r.fulfill({status: 404, body: ''}));
    const cp = await elsewhere.newPage();
    const cpErrs = [];
    cp.on('pageerror', e => cpErrs.push(e.message));
    await cp.goto('http://a-copy.test/copy.html', {waitUntil: 'load'});
    const opened = await cp.waitForFunction(() => typeof rebuildChart === 'function', null, {timeout: 8000}).then(() => true, () => false);
    const drawn = opened ? await cp.evaluate(() => ({nodes: document.querySelectorAll('#nodeLayer .node').length,
                                                     styled: getComputedStyle(document.querySelector('.topbar')).display !== 'inline',
                                                     sha: DATA_SHA})) : null;
    check('and opened somewhere else, that copy draws the chart, styled, with no base of the site\'s to save on',
          opened && drawn.nodes > 0 && drawn.styled && drawn.sha === null && cpErrs.length === 0,
          JSON.stringify({opened, drawn, cpErrs}));
    await elsewhere.close();
  }
  check('and so does a picture of the chart', fromPath.pictureInlined);

  /* ---- the owner, when the site is behind the repository ---- */
  api.sha = 'a-newer-data-js';
  const behind = await c.newPage();
  await behind.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await behind.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(600);
  const rb = await behind.evaluate(() => ({readOnly: readOnlyView,
                                           said: document.getElementById('saveStateText').textContent,
                                           shown: getComputedStyle(document.getElementById('saveState')).display !== 'none'}));
  check('an owner whose page is older than the repository is not handed an editor, and is told so where it shows',
        rb.readOnly && /newer chart/.test(rb.said) && rb.shown, JSON.stringify(rb));
  await behind.close();

  /* ---- and when the service cannot answer who it is ----
     What 0.23.0 met on the site: a service still reading data.js, a sign-in
     that went through, and a page that silently stayed a reader. */
  api.sha = dataSha;
  api.meFails = true;
  const failing = await c.newPage();
  await failing.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await failing.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(600);
  const rf = await failing.evaluate(() => ({readOnly: readOnlyView,
                                            said: document.getElementById('saveStateText').textContent,
                                            shown: getComputedStyle(document.getElementById('saveState')).display !== 'none'}));
  api.meFails = false;
  check('a service that fails after sign-in leaves a reader, and says so where it shows',
        rf.readOnly && rf.shown && /write service failed \(500: src\/data\.js/.test(rf.said), JSON.stringify(rf));
  await failing.close();

  /* ---- and when the session has run out ---- */
  api.sha = dataSha;
  const stale = await c.newPage();
  await stale.addInitScript(() => { try{ localStorage.setItem('rhizome.site.session', 'expired-session'); }catch(e){} });
  await stale.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await stale.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(600);
  const rs = await stale.evaluate(() => ({readOnly: readOnlyView, stored: localStorage.getItem('rhizome.site.session')}));
  check('an expired session leaves a reader, and is forgotten', rs.readOnly && rs.stored === null, JSON.stringify(rs));
  await stale.close();

  /* ---- the owner with no signal: a phone with the site on its home screen ---- */
  api.sha = dataSha;
  api.renewNext = true;
  // A service from before pictures went beside the chart: it is not sent paths.
  api.noMedia = true;
  const savesBefore = api.saves.length;
  const phone = await c.newPage();
  phone.on('pageerror', e => errs.push(e.message));
  await phone.addInitScript(() => { try{
    if(!sessionStorage.getItem('suite.phone')){
      localStorage.setItem('rhizome.site.session', 'good-session');
      sessionStorage.setItem('suite.phone', '1');
    }
  }catch(e){} });
  await phone.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await phone.waitForFunction(() => typeof rebuildChart === 'function');
  await phone.waitForFunction(() => !readOnlyView, null, {timeout: 5000}).catch(() => {});
  const p0 = await phone.evaluate(() => ({readOnly: readOnlyView, stored: localStorage.getItem('rhizome.site.session'),
                                          owner: localStorage.getItem('rhizome.site.owner')}));
  check('a session the service renewed replaces the one the page held',
        !p0.readOnly && p0.stored === 'renewed-session', JSON.stringify(p0));
  check('and the owner it confirmed is remembered for opening with no connection', p0.owner === 'the-owner', p0.owner);

  api.offline = true;
  const p1 = await phone.evaluate(async () => {
    applyEdit(() => { workingNodes[0][1] = 'WRITTEN WITH NO SIGNAL'; });
    await saveNow();
    const kept = await readOutbox();
    return {dirty: isDirty(), said: document.getElementById('saveStateText').textContent,
            kept: !!kept && kept.chart.includes('WRITTEN WITH NO SIGNAL'), base: kept && kept.base};
  });
  check('Save with no connection keeps the chart on this device instead of failing',
        !p1.dirty && p1.kept && /on this device/.test(p1.said) && api.saves.length === savesBefore, JSON.stringify(p1));
  check('kept on top of the chart the page was editing', p1.base === dataSha, p1.base);

  await phone.reload({waitUntil: 'load'});
  await phone.waitForFunction(() => typeof rebuildChart === 'function');
  await phone.waitForFunction(() => !readOnlyView, null, {timeout: 5000}).catch(() => {});
  await wait(300);
  const p2 = await phone.evaluate(() => ({readOnly: readOnlyView, first: workingNodes[0][1], dirty: isDirty(),
                                          said: document.getElementById('saveStateText').textContent,
                                          drawn: [...document.querySelectorAll('#nodeLayer .node')].some(n => n.textContent.replace(/\s+/g, '').includes('WRITTENWITHNOSIGNAL'))}));
  check('opened again with no connection, the owner is still an editor', !p2.readOnly, JSON.stringify(p2));
  check('and the chart is the one kept on the device, not the one the page was built with',
        p2.first === 'WRITTEN WITH NO SIGNAL' && p2.drawn && !p2.dirty, JSON.stringify(p2));
  check('and the page says it has not reached the site yet', /on this device/.test(p2.said), p2.said);

  api.offline = false;
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await phone.waitForFunction(() => !sitePending, null, {timeout: 5000}).catch(() => {});
  const sent = api.saves[api.saves.length - 1];
  const p3 = await phone.evaluate(async () => ({pending: sitePending, kept: !!(await readOutbox()),
                                                said: document.getElementById('saveStateText').textContent}));
  check('when the connection comes back the kept Save is sent by itself',
        api.saves.length === savesBefore + 1 && !!sent && sent.base === dataSha && sent.chart.includes('WRITTEN WITH NO SIGNAL'),
        sent ? sent.base : 'nothing sent');
  check('and nothing is left waiting', !p3.pending && !p3.kept && /Sent to the site/.test(p3.said), JSON.stringify(p3));
  check('a service that does not say it takes pictures as files is sent them embedded, as before',
        !!sent && !Object.keys(sent.media || {}).length &&
        JSON.stringify(JSON.parse(sent.chart).media) === JSON.stringify(JSON.parse(dataRaw.toString('utf8')).media));
  api.noMedia = false;

  /* A Save kept on the device by a page from before 0.23 holds the chart
     as data.js's regions, which the service no longer takes. The page that
     finds it sends it as the file it now is. */
  const oldKept = await phone.evaluate(async () => {
    applyEdit(() => { workingNodes[0][1] = 'KEPT BY AN OLDER PAGE'; });
    await putOutbox({at: Date.now(), base: siteBase, parts: writeChartParts(), data: JSON.parse(JSON.stringify(chartData()))});
    sitePending = true;
    savedParts = snapshotParts();
    return {sent: await flushOutbox(), left: !!(await readOutbox())};
  });
  const sentOld = api.saves[api.saves.length - 1];
  let oldChart = null;
  try{ oldChart = JSON.parse(sentOld.chart); }catch(e){}
  check('a Save kept by a page from before the chart was JSON is sent as the chart, not as regions',
        oldKept.sent === true && !oldKept.left && !!oldChart && !('parts' in sentOld) && oldChart.nodes[0].label === 'KEPT BY AN OLDER PAGE',
        JSON.stringify({oldKept, keys: sentOld && Object.keys(sentOld)}));

  /* Somebody saved from another device in between. */
  api.offline = true;
  await phone.evaluate(async () => {
    applyEdit(() => { workingNodes[0][1] = 'AND THIS ON THE TRAIN'; });
    await saveNow();
  });
  api.offline = false;
  api.sha = 'saved-from-the-desk';
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await wait(600);
  const p4 = await phone.evaluate(async () => {
    const kept = await readOutbox();
    return {pending: sitePending, kept: !!kept && kept.chart.includes('AND THIS ON THE TRAIN'),
            said: document.getElementById('saveStateText').textContent};
  });
  check('a kept Save the repository has moved past is refused, and stays kept rather than lost',
        p4.pending && p4.kept && /newer chart/.test(p4.said) && /Export/.test(p4.said), JSON.stringify(p4));
  /* The service puts the two together, and refuses only where both
     changed the same thing — naming it, by the name it has on the chart. */
  api.conflicts = [{region: 'nodes', item: await phone.evaluate(() => workingNodes[0][0])}];
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await wait(600);
  const p5 = await phone.evaluate(async () => ({pending: sitePending, kept: !!(await readOutbox()),
                                                said: document.getElementById('saveStateText').textContent}));
  check('a kept Save that collides with a newer one says what both changed, and stays kept',
        p5.pending && p5.kept && /\u201cAND THIS ON THE TRAIN\u201d/.test(p5.said) && /Export/.test(p5.said), JSON.stringify(p5));
  api.conflicts = null;
  api.mergeNext = true;
  await phone.evaluate(() => window.dispatchEvent(new Event('online')));
  await phone.waitForFunction(() => !sitePending, null, {timeout: 5000}).catch(() => {});
  await wait(300);
  const p6 = await phone.evaluate(async () => ({pending: sitePending, kept: !!(await readOutbox()), base: siteBase,
                                                first: workingNodes[0][1], desk: REFS.some(r => r.key === 'desk-ref'),
                                                dirty: isDirty(), readOnly: readOnlyView}));
  check('one that does not collide is merged, and the page takes the other device\'s half as well',
        !p6.pending && !p6.kept && p6.base === 'merged-sha' && p6.first === 'AND THIS ON THE TRAIN' && p6.desk && !p6.dirty && !p6.readOnly,
        JSON.stringify(p6));
  await phone.evaluate(() => dropOutbox());
  await phone.close();
  api.sha = dataSha;

  /* What broke in readers' browsers, counted by the service: the owner
     reads it in About, as text, and takes off what is dealt with. */
  api.faults = [
    {key: 'fault:aaaaaaaaaaaaaaaaaaaa', kind: 'error', message: '<img src=x onerror=alert(1)> is not a function', count: 14,
     last: '2026-11-19T10:00:00Z', version: '0.26.0', file: SITE_ORIGIN + '/app.0123.js', line: 3, col: 9,
     ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
     stack: 'at drawThing (app.0123.js:3:9)'},
    {key: 'fault:bbbbbbbbbbbbbbbbbbbb', kind: 'rejection', message: 'a second fault', count: 1, last: '2026-11-18T10:00:00Z', ua: 'Firefox/140.0 (X11; Linux)'}
  ];
  await site.evaluate(() => document.getElementById('aboutToggle').click());
  await site.waitForFunction(() => !document.getElementById('aboutFaults').hidden, null, {timeout: 3000}).catch(() => {});
  const fl = await site.evaluate(() => {
    const box = document.getElementById('aboutFaults');
    return {shown: !box.hidden, items: box.querySelectorAll('.fault-item').length, html: box.innerHTML,
            meta: [...box.querySelectorAll('.fault-meta')].map(m => m.textContent),
            msg: box.querySelector('.fault-msg') && box.querySelector('.fault-msg').textContent};
  });
  check('the owner sees in About what broke in readers\' browsers, newest first, and how often',
        fl.shown && fl.items === 2 && /^14 times · last 2026-11-19 · Safari on iOS · version 0\.26\.0 · app\.0123\.js:3:9$/.test(fl.meta[0]) && /^once/.test(fl.meta[1]),
        JSON.stringify(fl.meta));
  check('and what a reader\'s browser sent is shown as text, never as markup',
        fl.msg && fl.msg.startsWith('<img') && !/<img/.test(fl.html), fl.html.slice(0, 200));
  await site.evaluate(() => document.querySelector('#aboutFaults .fault-drop').click());
  await site.waitForFunction(() => document.querySelectorAll('#aboutFaults .fault-item').length === 1, null, {timeout: 3000}).catch(() => {});
  const fl2 = await site.evaluate(() => document.querySelectorAll('#aboutFaults .fault-item').length);
  check('one dealt with is taken off the list, by its name',
        fl2 === 1 && !!api.cleared && api.cleared.length === 1 && api.cleared[0].key === 'fault:aaaaaaaaaaaaaaaaaaaa', JSON.stringify(api.cleared));
  await site.evaluate(() => document.getElementById('aboutClose').click());

  /* An editor: the chart is theirs to write, its settings and the readers'
     faults are not. */
  api.editor = true;
  api.sha = await site.evaluate(() => siteBase);
  const ed = await site.evaluate(async () => {
    const ok = await checkSiteOwner();
    document.getElementById('aboutToggle').click();
    await new Promise(res => setTimeout(res, 300));
    const out = {ok, editor: siteEditor, readOnly: readOnlyView, title: document.getElementById('ownerBtn').title,
                 faults: !document.getElementById('aboutFaults').hidden};
    document.getElementById('aboutClose').click();
    const was = SETTINGS.refColor;
    applyEdit(() => { SETTINGS.refColor = '#000000'; workingNodes[0][1] = 'AN EDITOR WROTE THIS'; });
    await saveNow();
    out.said = document.getElementById('saveStateText').textContent;
    out.refColor = SETTINGS.refColor; out.was = was; out.first = workingNodes[0][1]; out.dirty = isDirty();
    return out;
  });
  check('an editor gets the editor, and is told who they are',
        ed.ok && ed.editor && !ed.readOnly && /edits the chart with its owner/.test(ed.title), JSON.stringify(ed));
  check('but not the readers\' faults', !ed.faults, JSON.stringify(ed));
  check('an editor\'s save keeps the owner\'s settings, says so, and shows them again',
        /settings are the owner\u2019s/.test(ed.said) && ed.refColor === ed.was && ed.first === 'AN EDITOR WROTE THIS' && !ed.dirty,
        JSON.stringify(ed));
  api.editor = false;
  api.sha = dataSha;
  await site.evaluate(() => checkSiteOwner());

  await site.evaluate(() => document.getElementById('ownerBtn').click());
  const out = await site.evaluate(() => ({readOnly: readOnlyView, stored: localStorage.getItem('rhizome.site.session')}));
  check('signing out makes the tab a reader again', out.readOnly && out.stored === null, JSON.stringify(out));
  check('and none of it raised an error', errs.length === 0, errs.join(' | '));
  await c.close();
  });

  /* ---- 32b. suggestions on the published site ----
   *
   * A reader's suggestion is an issue in the repository, carried there by
   * the write service under the reader's own GitHub sign-in. What is driven
   * here is the page's half: a reader signs in AS a reader and stays one,
   * the suggestion names the entry it is about, everything GitHub hands
   * back is shown as text, and only the owner is offered a way to close
   * one. The service is answered from here, as in the scenario above. */
  await scenario("suggestions on the published site", async () => {
  if(MODE === 'src'){
    check('the site serves the built file, so there is nothing to check from src', true);
    return;
  }
  const config = fs.readFileSync(path.join(ROOT, 'src', 'app', '00-config.js'), 'utf8');
  const SITE_ORIGIN = /^\s*site: '([^']+)'/m.exec(config)[1];
  const SITE_API = /^\s*api: '([^']*)'/m.exec(config)[1];
  const html = withFixture(fs.readFileSync(path.join(DIR, PAGE), 'utf8'));
  const dataRaw = FIXTURE_RAW;
  const dataSha = require('crypto').createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${dataRaw.length}\0`), dataRaw])).digest('hex');
  const api = {asked: 0, loginAs: [], account: 'reader', posted: [], resolved: [], list: [], ghAsked: 0};
  const c = await browser.newContext({viewport:{width:1500, height:950}, serviceWorkers: 'block'});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await c.route('https://fonts.googleapis.com/**', quiet);
  await c.route('https://fonts.gstatic.com/**', quiet);
  await c.route(/^https:\/\/github\.com\/[^/]+\.png/, r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  await c.route(SITE_ORIGIN + '/**', r => r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html}));
  /* GitHub's own API, which a signed-out page reads the open issues from:
     the same suggestions the service lists, as GitHub holds them — the
     marker at the end of the text — beside an ordinary issue and a pull
     request, neither of which is a suggestion. */
  await c.route('https://api.github.com/**', r => {
    api.ghAsked++;
    const raw = api.list.map(x => ({number: x.number, html_url: x.url, user: {login: x.login}, created_at: x.at + 'T10:00:00Z',
      title: x.title ? x.kind[0].toUpperCase() + x.kind.slice(1) + ': ' + x.title : 'Untitled',
      body: x.text + '\n\n<!-- rhizome-suggestion:' + encodeURIComponent(JSON.stringify(
        Object.assign({entry: x.entry, kind: x.kind}, x.title ? {titled: true} : {}))) + ' -->'}))
      .concat([{number: 1, body: 'The build is slow.', user: {login: 'dev'}},
               {number: 2, body: '<!-- rhizome-suggestion:%7B%22kind%22%3A%22deletion%22%7D -->', pull_request: {}, user: {login: 'dev'}}]);
    return r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'}, contentType: 'application/json', body: JSON.stringify(raw)});
  });
  await c.route(SITE_API + '/**', async r => {
    const q = r.request(), u = new URL(q.url());
    const cors = {'Access-Control-Allow-Origin': SITE_ORIGIN,
                  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'};
    const reply = (status, body) => r.fulfill({status, headers: cors, contentType: 'application/json', body: JSON.stringify(body)});
    if(q.method() === 'OPTIONS') return r.fulfill({status: 204, headers: cors});
    if(u.pathname === '/login'){
      const as = u.searchParams.get('as');
      api.loginAs.push(as || 'owner');
      /* As the service does: which session comes back is decided by the
         account GitHub signed in, not by the button. The owner signing in
         through the one Sign in a reader uses still gets the owner's. */
      const token = api.account === 'owner' ? 'good-session' : 'reader-session';
      return r.fulfill({status: 200, contentType: 'text/html', body:
        `<script>opener.postMessage({rhizomeSession:${JSON.stringify(token)}}, ${JSON.stringify(SITE_ORIGIN)}); close();</script>`});
    }
    api.asked++;
    const who = {'Bearer reader-session': 'reader', 'Bearer good-session': 'owner'}[q.headers()['authorization']];
    if(!who) return reply(401, {error: 'not signed in.'});
    if(u.pathname === '/me') return reply(200, who === 'owner' ? {owner: true, login: 'the-owner', sha: dataSha}
                                                                : {owner: false, login: 'a-reader'});
    if(u.pathname === '/suggestions') return reply(200, {owner: who === 'owner', suggestions: api.list});
    if(u.pathname === '/suggest'){
      const b = JSON.parse(q.postData());
      api.posted.push(b);
      const made = {number: 100 + api.posted.length, kind: b.kind, entry: b.entry, text: b.text, login: 'a-reader',
                    title: b.title || null,
                    at: '2026-10-17', url: 'https://github.com/x/y/issues/' + (100 + api.posted.length), mine: true};
      api.list = [made].concat(api.list);
      return reply(200, {suggestion: made});
    }
    if(u.pathname === '/resolve'){
      if(who !== 'owner') return reply(403, {error: 'this account may not edit the chart.'});
      const b = JSON.parse(q.postData());
      api.resolved.push(b);
      api.list = api.list.filter(x => x.number !== b.number);
      return reply(200, {closed: b.number, reason: b.reason});
    }
    return reply(404, {error: 'not found'});
  });
  const errs = [];
  const site = await c.newPage();
  site.on('pageerror', e => errs.push(e.message));
  // Anything the site's policy refuses is the page broken by its own guard.
  site.on('console', m => { if(/Content Security Policy/i.test(m.text())) errs.push(m.text()); });
  await site.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await site.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(300);
  /* Two entries: one already has a suggestion open about it, and the other
     is the one the reader suggests something about. The waiting one's
     words are the kind of thing GitHub will hand back from a stranger. */
  const ids = await site.evaluate(() => [...nodes.keys()].filter(id => !nodeHidden(nodes.get(id))).slice(0, 2));
  api.list = [{number: 7, kind: 'deletion', entry: ids[0], login: 'someone-else', at: '2026-10-16',
               text: 'Not canon. <img src=x onerror="window.__owned=1">', url: 'https://github.com/x/y/issues/7', mine: false}];

  /* ---- signed out ---- */
  const r0 = await site.evaluate(async (id) => {
    const shown = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    const out = {toolbar: shown(document.getElementById('commentsToggle'))};
    selectNode(id);
    await new Promise(res => setTimeout(res, 100));
    out.detailBtn = shown(document.getElementById('detailSuggest'));
    document.getElementById('detailSuggest').click();
    await new Promise(res => setTimeout(res, 200));
    out.open = document.getElementById('commentsOverlay').classList.contains('open');
    out.about = document.getElementById('suggestAbout').textContent;
    out.signIn = shown(document.getElementById('suggestSignIn'));
    out.switchShown = shown(document.getElementById('suggestSwitch'));
    for(let i = 0; i < 40 && !document.querySelector('#commentList .comment-item'); i++) await new Promise(res => setTimeout(res, 50));
    out.items = [...document.querySelectorAll('#commentList .comment-item')].map(x => x.querySelector('.comment-who').textContent);
    out.imgs = document.querySelectorAll('#commentList img').length;
    out.closers = document.querySelectorAll('#commentList .comment-actions button').length;
    out.github = !!document.querySelector('#commentList .comment-actions a[href^="https://github.com/"]');
    out.marks = [...document.querySelectorAll('#suggestionLayer .suggestion-mark')].map(g => g.dataset.id);
    out.post = shown(document.getElementById('commentSubmit'));
    out.readOnly = readOnlyView;
    return out;
  }, ids[1]);
  const name1 = await site.evaluate(id => stripMarkup(nodes.get(id).label).replace(/\s+/g, ' ').trim(), ids[1]);
  check('on the site a reader is offered Suggestions, in the bar and on an entry', r0.toolbar && r0.detailBtn, JSON.stringify(r0));
  check('opened from an entry, the form says which entry it is about', r0.open && r0.about.includes(name1), r0.about);
  check('signed out, it offers a GitHub sign-in instead of Post', r0.signIn && !r0.post && !r0.switchShown);
  check('and the page has asked the service nothing yet', api.asked === 0, `${api.asked} requests`);
  check('signed out, the open suggestions are listed all the same, read from GitHub',
        api.ghAsked > 0 && r0.items.join() === 'someone-else' && r0.github && r0.closers === 0, JSON.stringify(r0));
  check('only issues carrying the marker are listed, never an ordinary issue or a pull request', r0.items.length === 1);
  check('and what GitHub hands back is still shown as text', r0.imgs === 0, JSON.stringify(r0));
  check('signed out, the entry a suggestion is about wears its mark', r0.marks.join() === ids[0], JSON.stringify(r0.marks));

  /* ---- a reader signs in ---- */
  const popup = c.waitForEvent('page');
  await site.click('#suggestSignIn');
  await popup;
  await site.waitForFunction(() => !document.getElementById('commentSubmit').hidden, null, {timeout: 5000}).catch(() => {});
  await wait(300);
  const r1 = await site.evaluate(() => ({
    readOnly: readOnlyView,
    saveShown: getComputedStyle(document.getElementById('saveBtn')).display !== 'none',
    button: document.getElementById('ownerBtn').getAttribute('aria-label'),
    post: !document.getElementById('commentSubmit').hidden,
    items: document.querySelectorAll('#commentList .comment-item').length,
    imgs: document.querySelectorAll('#commentList img').length,
    text: (document.querySelector('#commentList .comment-body') || {}).textContent || '',
    closers: [...document.querySelectorAll('#commentList .comment-actions button')].length,
    github: !!document.querySelector('#commentList .comment-actions a[href^="https://github.com/"]'),
    marks: [...document.querySelectorAll('#suggestionLayer .suggestion-mark')].map(g => g.dataset.id),
    owned: !!window.__owned,
    avatar: (a => a && !a.hidden ? a.getAttribute('src') : null)(document.getElementById('ownerAvatar')),
    door: !!document.querySelector('#ownerBtn.signed-in svg') && !document.getElementById('ownerBtn').textContent.trim(),
    field: (t => t && {min: parseFloat(getComputedStyle(t).minHeight), line: parseFloat(getComputedStyle(t).lineHeight) ||
                       parseFloat(getComputedStyle(t).fontSize) * 1.2})(document.getElementById('commentText'))
  }));
  check('the reader signs in as a reader', api.loginAs.join() === 'reader', api.loginAs.join());
  check('signed in, the bar shows the account\'s GitHub picture and a door to sign out by',
        r1.avatar === 'https://github.com/a-reader.png?size=64' && r1.door, JSON.stringify({avatar: r1.avatar, door: r1.door}));
  check('the suggestion field is never shorter than four lines, however small the card',
        r1.field && r1.field.min >= r1.field.line * 4, JSON.stringify(r1.field));
  check('and stays a reader: no Save, still read-only, and a way to sign out',
        r1.readOnly && !r1.saveShown && r1.button === 'Sign out', JSON.stringify(r1));
  check('signed in, the form offers Post and lists what is open', r1.post && r1.items === 1, JSON.stringify(r1));
  check('what GitHub hands back is shown as text, never run as markup',
        r1.imgs === 0 && !r1.owned && r1.text.includes('<img src=x'), JSON.stringify({imgs: r1.imgs, text: r1.text}));
  check('a reader is offered the issue on GitHub, and nothing that closes it', r1.github && r1.closers === 0);
  check('the entry a suggestion is about wears a mark', r1.marks.join() === ids[0], JSON.stringify(r1.marks));

  const r2 = await site.evaluate(async () => {
    document.getElementById('commentStatus').value = 'addition';
    document.getElementById('commentText').value = '  It had a sequel in 1987.  ';
    document.getElementById('commentTitle').value = ' A sequel ';
    document.getElementById('commentSubmit').click();
    await new Promise(res => setTimeout(res, 500));
    const list = document.getElementById('commentList');
    return {msg: document.getElementById('commentStatusMsg').textContent,
            left: document.getElementById('commentText').value,
            titleLeft: document.getElementById('commentTitle').value,
            titles: [...list.querySelectorAll('.comment-title')].filter(t=> !t.hidden).map(t=> t.textContent),
            scroll: getComputedStyle(list).overflowY,
            items: document.querySelectorAll('#commentList .comment-item').length,
            marks: document.querySelectorAll('#suggestionLayer .suggestion-mark').length};
  });
  const sent = api.posted[0];
  check('Post sends the suggestion with the entry it is about, its name and its kind',
        !!sent && sent.entry === ids[1] && sent.label === name1 && sent.kind === 'addition' && sent.text === 'It had a sequel in 1987.',
        JSON.stringify(sent));
  check('and the list and the marks take it in at once', /Posted/.test(r2.msg) && r2.left === '' && r2.items === 2 && r2.marks === 2,
        JSON.stringify(r2));
  check('a suggestion may carry a title of its own, which is sent and heads it in the list',
        !!sent && sent.title === 'A sequel' && r2.titleLeft === '' && r2.titles.join() === 'A sequel', JSON.stringify(r2));
  check('the list scrolls on its own, with a bar, under the form', r2.scroll === 'scroll', r2.scroll);

  /* ---- the reader leaves ---- */
  const ghBefore = api.ghAsked;
  const r3 = await site.evaluate(async () => {
    document.getElementById('commentsClose').click();
    document.getElementById('ownerBtn').click();
    const marksAt = () => document.querySelectorAll('#suggestionLayer .suggestion-mark').length;
    const right = marksAt();
    for(let i = 0; i < 40 && !marksAt(); i++) await new Promise(res => setTimeout(res, 50));
    const fromGitHub = await fetch('https://api.github.com/repos/' + SITE_REPO + '/issues?state=open')
      .then(r=> r.json()).then(list=> list.map(readSuggestionIssue).filter(Boolean)).catch(e=> 'failed: ' + e.message);
    return {stored: localStorage.getItem('rhizome.site.session'), button: document.getElementById('ownerBtn').getAttribute('aria-label'),
            right, marks: marksAt(),
            ghTitles: Array.isArray(fromGitHub) ? fromGitHub.map(x=> x.title) : String(fromGitHub)};
  });
  check('signing out forgets the reader, and what the session listed goes with it',
        r3.stored === null && r3.button === 'Sign in' && r3.right === 0, JSON.stringify(r3));
  check('and the marks come back as any reader sees them, read from GitHub again',
        r3.marks === 2 && api.ghAsked > ghBefore, JSON.stringify(r3));
  check('read from GitHub, a suggestion\'s own title comes back without its kind, and an untitled one has none',
        Array.isArray(r3.ghTitles) && r3.ghTitles.join('|') === 'A sequel|', JSON.stringify(r3.ghTitles));

  /* ---- the owner closes one ---- */
  api.account = 'owner';
  const popup2 = c.waitForEvent('page');
  await site.click('#ownerBtn');
  await popup2;
  await site.waitForFunction(() => !readOnlyView, null, {timeout: 5000}).catch(() => {});
  const r4 = await site.evaluate(async () => {
    document.getElementById('commentsToggle').click();
    for(let i = 0; i < 40 && !document.querySelector('#commentList .comment-actions button'); i++) await new Promise(res => setTimeout(res, 50));
    const out = {readOnly: readOnlyView, about: document.getElementById('suggestAbout').textContent,
                 marks: document.querySelectorAll('#suggestionLayer .suggestion-mark').length};
    const item = [...document.querySelectorAll('#commentList .comment-item')].find(x => x.textContent.includes('Not canon'));
    const done = item && [...item.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Done');
    /* Done a green circle with a tick, Decline a red square with a cross,
       the issue a GitHub mark with an arrow (the owner's ask, 23.10). */
    const decline = item && item.querySelector('button.suggest-decline');
    const gh = item && item.querySelector('a.suggest-gh');
    const look = b => b && {radius: getComputedStyle(b).borderRadius, w: b.getBoundingClientRect().width,
                            bg: getComputedStyle(b).backgroundColor, svg: !!b.querySelector('svg'), text: b.textContent.trim()};
    out.looks = {done: look(done), decline: look(decline), gh: gh && {svgs: gh.querySelectorAll('svg').length, text: gh.textContent.trim()}};
    out.offered = !!done;
    if(done) done.click();
    await new Promise(res => setTimeout(res, 400));
    out.items = document.querySelectorAll('#commentList .comment-item').length;
    out.marksAfter = [...document.querySelectorAll('#suggestionLayer .suggestion-mark')].map(g => g.dataset.id);
    return out;
  });
  check('the owner signs in as the owner, through the same Sign in as everybody', api.loginAs.join() === 'reader,reader' && !r4.readOnly,
        api.loginAs.join() + ' ' + JSON.stringify(r4));
  check('opened from the bar, the form is about the chart as a whole', /chart as a whole/.test(r4.about), r4.about);
  check('the owner is offered Done on a suggestion, and it closes it as done',
        r4.offered && api.resolved.length === 1 && api.resolved[0].number === 7 && api.resolved[0].reason === 'completed',
        JSON.stringify({r4, resolved: api.resolved}));
  check('it leaves the list, and its entry\'s mark goes with it', r4.items === 1 && r4.marksAfter.join() === ids[1],
        JSON.stringify(r4));
  check('Done is a green circle with a tick, Decline a red square with a cross, both without words',
        r4.looks.done && r4.looks.done.svg && !r4.looks.done.text && parseFloat(r4.looks.done.radius) >= r4.looks.done.w / 2 - 0.5 &&
        /rgb\(47, 154, 74\)/.test(r4.looks.done.bg) && r4.looks.decline && r4.looks.decline.svg && !r4.looks.decline.text &&
        parseFloat(r4.looks.decline.radius) <= 4 && /rgb\(194, 59, 34\)/.test(r4.looks.decline.bg), JSON.stringify(r4.looks));
  check('the issue on GitHub is the GitHub mark with an arrow, not the words', r4.looks.gh && r4.looks.gh.svgs === 2 && !r4.looks.gh.text,
        JSON.stringify(r4.looks.gh));
  /* ---- one way to sign in ----
     The form used to offer another GitHub account as well, which let go
     of this one and asked again. The owner found it redundant beside the
     bar's own button, which signs out (23.10). */
  const r5a = await site.evaluate(() => ({gone: !document.getElementById('suggestSwitch') &&
    ![...document.querySelectorAll('.comments-card button')].some(b => /another GitHub account/i.test(b.textContent)),
    bar: document.getElementById('ownerBtn').getAttribute('aria-label')}));
  check('the form offers no second account: the bar\'s button is the one way in and out',
        r5a.gone && r5a.bar === 'Sign out', JSON.stringify(r5a));
  check('and none of it raised an error', errs.length === 0, errs.join(' | '));
  await c.close();
  });

  /* ---- faults on the published site ----
   *
   * A fault a reader meets used to be known only if they wrote to say so.
   * On the site the page now tells the write service (reportFault,
   * 01-store.js), which writes it to its log. Driven at the real address,
   * as above, with the service answered from here: what is checked is what
   * leaves the reader's browser, and how often. */
  await scenario("faults on the published site", async () => {
  if(MODE === 'src'){
    check('the site serves the built file, so there is nothing to check from src', true);
    return;
  }
  const config = fs.readFileSync(path.join(ROOT, 'src', 'app', '00-config.js'), 'utf8');
  const SITE_ORIGIN = /^\s*site: '([^']+)'/m.exec(config)[1];
  const SITE_API = /^\s*api: '([^']*)'/m.exec(config)[1];
  const appVersion = /const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'app', '20-about.js'), 'utf8'))[1];
  const SITE_BUILT = path.join(DIR, 'site');
  const html = withFixture(fs.readFileSync(path.join(SITE_BUILT, 'index.html'), 'utf8'));
  const siteFile = name => /^[\w.-]+$/.test(name) && fs.existsSync(path.join(SITE_BUILT, name)) ? fs.readFileSync(path.join(SITE_BUILT, name)) : null;
  const c = await browser.newContext({viewport:{width:1500, height:950}, serviceWorkers: 'block'});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await c.route('https://fonts.googleapis.com/**', quiet);
  await c.route('https://fonts.gstatic.com/**', quiet);
  await c.route(/^https:\/\/github\.com\/[^/]+\.png/, r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  await c.route(SITE_ORIGIN + '/**', r => {
    const u = new URL(r.request().url());
    const beside = /\.(js|css)$/.exec(u.pathname) && siteFile(u.pathname.slice(1));
    if(beside) return r.fulfill({status: 200, contentType: u.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: beside});
    return r.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
  });
  await c.route('https://api.github.com/**', r => r.fulfill({status: 200, headers: {'Access-Control-Allow-Origin': '*'},
    contentType: 'application/json', body: '[]'}));
  const reports = [];
  await c.route(SITE_API + '/**', r => {
    const q = r.request(), u = new URL(q.url());
    if(u.pathname === '/report'){
      reports.push({method: q.method(), headers: q.headers(), body: q.postData()});
      return r.fulfill({status: 204, body: ''});
    }
    return r.fulfill({status: 401, contentType: 'application/json', body: '{"error":"not signed in."}'});
  });
  const site = await c.newPage();
  const errs = [];
  site.on('pageerror', e => errs.push(e.message));
  // Anything the site's policy refuses is the page broken by its own guard.
  site.on('console', m => { if(/Content Security Policy/i.test(m.text())) errs.push(m.text()); });
  await site.goto(SITE_ORIGIN + '/', {waitUntil: 'load'});
  await site.waitForFunction(() => typeof rebuildChart === 'function');
  await wait(200);
  check('a page that met no fault reports none', reports.length === 0, JSON.stringify(reports));
  check('and with no token for the counter, the site has none', !/cloudflareinsights/.test(html));

  /* A fault in the program itself — an entry that is not there, handed
     to the text view — twice over, as a drawing pass would. */
  await site.evaluate(() => {
    setTimeout(textViewItem, 0, null, null, new Set());
    setTimeout(textViewItem, 0, null, null, new Set());
    setTimeout(() => { Promise.reject(new Error('a promise nobody caught')); }, 0);
  });
  await wait(400);
  const got = reports.map(r => { try{ return JSON.parse(r.body); }catch(e){ return {unreadable: r.body}; } });
  const first = got.find(g => g.kind === 'error');
  check('a fault in a reader\'s browser is sent to the write service, once though it happened twice',
        got.filter(g => g.kind === 'error').length === 1, JSON.stringify(got));
  check('with what went wrong, in which file of the program and where',
        !!first && /TypeError/.test(first.message) && /\/app\.[0-9a-f]{16}\.js$/.test(first.file) && first.line > 0
        && /textViewEntryLink/.test(first.stack) && first.version === appVersion && !!first.ua, JSON.stringify(first));
  check('and a promise nobody caught is sent too',
        got.some(g => g.kind === 'rejection' && g.message === 'a promise nobody caught'), JSON.stringify(got));
  check('as a POST with nothing that would make the browser ask first, and no session',
        reports.length > 0 && reports.every(r => r.method === 'POST' && !r.headers['authorization']
          && /^text\/plain/.test(r.headers['content-type'] || '')), JSON.stringify(reports.map(r => r.headers)));

  await site.evaluate(() => {
    for(let i = 0; i < 8; i++) setTimeout(() => { throw new Error('fault number ' + i); }, 0);
  });
  await wait(400);
  check('a page sends a few and then stops, so a fault in every frame of a pan is not a flood',
        reports.length === 5, reports.length);
  check('and a fault still reaches the console as before', errs.filter(m => /fault number/.test(m)).length === 8, errs.join(' | '));
  await c.close();
  });

  await scenario("the site kept on a phone with no signal", async () => {
  if(MODE === 'src'){
    check('the site is the built file and src/site beside it, so there is nothing to keep from src', true);
    return;
  }
  /* The site as CI stages it: dist/site/, the page with its program and
     stylesheet beside it and src/site/ copied in. The page is not ON the
     site here, so the worker is registered by hand — what is tested is the
     worker, and what it keeps. */
  const SITE_DIR = path.join(DIR, 'site');
  const files = {};
  for(const f of fs.readdirSync(SITE_DIR)) files['/' + f] = f === 'index.html' ? Buffer.from(withFixture(fs.readFileSync(path.join(SITE_DIR, f), 'utf8'))) : fs.readFileSync(path.join(SITE_DIR, f));
  files['/'] = files['/index.html'];
  delete files['/index.html'];
  // A picture beside the page, as a Save puts one in src/media.
  const PICTURE = '/media/' + 'b'.repeat(64) + '.png';
  files[PICTURE] = Buffer.from('a picture kept for a day with no signal');
  const TYPES = {'.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};
  let up = true;
  const srv = http.createServer((q, r) => {
    if(!up){ r.destroy(); return; }
    const rel = q.url.split('?')[0];
    const body = files[rel === '/index.html' ? '/' : rel];
    if(!body){ r.writeHead(404, {'Content-Type': 'text/plain'}); r.end('not here'); return; }
    r.writeHead(200, {'Content-Type': rel === '/' || rel === '/index.html' ? 'text/html; charset=utf-8' : (TYPES[path.extname(rel)] || 'application/octet-stream')});
    r.end(body);
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const at = `http://127.0.0.1:${srv.address().port}/`;
  const c = await browser.newContext({viewport:{width:390, height:844}});
  const quiet = r => r.fulfill({status: 200, contentType: 'text/css', body: ''});
  await c.route('https://fonts.googleapis.com/**', quiet);
  await c.route('https://fonts.gstatic.com/**', quiet);
  await c.route(/^https:\/\/github\.com\/[^/]+\.png/, r => r.fulfill({status: 200, contentType: 'image/png', body: TINY_PNG}));
  const errs = [];
  try{
    const manifest = JSON.parse(files['/manifest.webmanifest'].toString('utf8'));
    const icons = (manifest.icons || []).map(i => i.src);
    check('the manifest names the app, opens it without the browser, and has the icons a launcher asks for',
          !!manifest.name && manifest.display === 'standalone' && manifest.start_url === './' &&
          ['192x192', '512x512'].every(sz => (manifest.icons || []).some(i => i.sizes === sz && i.type === 'image/png')) &&
          icons.every(src => !!files['/' + src]), JSON.stringify(icons));

    const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(at, {waitUntil: 'load'});
    await p.waitForFunction(() => typeof rebuildChart === 'function');
    const drawnOnline = await p.evaluate(() => document.querySelectorAll('#nodeLayer .node').length);
    const reg = await p.evaluate(async () => {
      try{ await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return 'ready'; }
      catch(e){ return String(e && e.message || e); }
    });
    await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, {timeout: 5000}).catch(() => {});
    const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
    check('the worker installs, keeping everything it lists, and takes the open page', reg === 'ready' && controlled,
          JSON.stringify({reg, controlled}));
    const seen = await p.evaluate(async src => (await fetch(src)).text(), PICTURE.slice(1));

    up = false;
    await p.reload({waitUntil: 'load'}).catch(e => errs.push('reload: ' + e.message));
    await p.waitForFunction(() => typeof rebuildChart === 'function', null, {timeout: 8000}).catch(() => {});
    const offline = await p.evaluate(() => ({ok: typeof rebuildChart === 'function',
                                             drawn: document.querySelectorAll('#nodeLayer .node').length}))
      .catch(e => ({ok: false, error: e.message}));
    check('with no connection the page still opens, and draws the chart', offline.ok && offline.drawn === drawnOnline,
          JSON.stringify({offline, online: drawnOnline}));
    const kept = await p.evaluate(async src => { try{ return await (await fetch(src)).text(); }catch(e){ return 'failed: ' + e.message; } },
                                  PICTURE.slice(1)).catch(e => 'failed: ' + e.message);
    check('and a picture it has shown before is still there', seen === files[PICTURE].toString() && kept === seen, kept);
    /* A clip is played by Range. Answered from the kept file, a piece is
       a 206 with its bytes — the whole file with a 200 is what Safari
       will not play. */
    const pieces = await p.evaluate(async src => {
      const ask = async range => { const r = await fetch(src, {headers: {Range: range}});
        return {status: r.status, range: r.headers.get('content-range'), text: await r.text()}; };
      try{ return {mid: await ask('bytes=2-8'), open: await ask('bytes=30-'), tail: await ask('bytes=-5'), past: await ask('bytes=999-')}; }
      catch(e){ return {error: e.message}; }
    }, PICTURE.slice(1)).catch(e => ({error: e.message}));
    const whole = files[PICTURE].toString(), size = whole.length;
    check('a piece of a kept picture is answered as a piece, as a clip asks for it',
          pieces.mid && pieces.mid.status === 206 && pieces.mid.text === whole.slice(2, 9) && pieces.mid.range === `bytes 2-8/${size}` &&
          pieces.open.status === 206 && pieces.open.text === whole.slice(30) &&
          pieces.tail.status === 206 && pieces.tail.text === whole.slice(-5) && pieces.past.status === 416,
          JSON.stringify(pieces));

    /* Online again, the network's page is the one shown — a kept copy is
       for when there is nothing else, never in preference. */
    up = true;
    // The newer page's chart names the picture, as a chart that shows it does.
    files['/'] = Buffer.concat([files['/'], Buffer.from('\n<!-- a newer page -->\n<!-- ' + PICTURE.slice(1) + ' -->\n')]);
    await p.reload({waitUntil: 'load'});
    const fresh = await p.evaluate(() => [...document.childNodes, ...document.documentElement.childNodes, ...document.body.childNodes].some(n => n.nodeType === 8 && n.data.includes('a newer page')));
    check('with a connection, the page is fetched afresh rather than taken from the copy', fresh);
    const other = await c.newPage();
    const elsewhere = await other.goto(at + 'not-the-chart.html').then(r => ({status: r.status(), sw: r.fromServiceWorker()}));
    const isChart = await other.evaluate(() => typeof rebuildChart === 'function').catch(() => false);
    await other.close();
    check('another address on the site is the site\'s answer for it, not the chart',
          elsewhere.status === 404 && !elsewhere.sw && !isChart, JSON.stringify({elsewhere, isChart}));
    up = false;
    await p.reload({waitUntil: 'load'}).catch(e => errs.push('reload: ' + e.message));
    const keptNewer = await p.evaluate(() => [...document.childNodes, ...document.documentElement.childNodes, ...document.body.childNodes].some(n => n.nodeType === 8 && n.data.includes('a newer page'))).catch(() => false);
    check('and that is the copy kept for next time', keptNewer);

    /* A release: the program changes, and so does its name. The page that
       names it is fetched with a connection, and what the worker keeps
       follows it — the new program at once, and the old one only as long as
       a page that may still be on screen names it. */
    const appOf = () => /src="(app\.[0-9a-f]{16}\.js)"/.exec(files['/'].toString())[1];
    const release = n => {
      const was = appOf(), now = 'app.' + String(n).repeat(16).slice(0, 16) + '.js';
      files['/' + now] = files['/' + was];
      files['/'] = Buffer.from(files['/'].toString().replace(was, now));
      return now;
    };
    // The worker's cache by the name it is given, which a release of the shell moves on.
    const cacheName = /const CACHE = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'site', 'sw.js'), 'utf8'))[1];
    const keptPrograms = () => p.evaluate(async (name) => (await (await caches.open(name)).keys())
      .map(k => new URL(k.url).pathname.slice(1)).filter(n => /^app\./.test(n)).sort(), cacheName);
    up = true;
    const first = appOf(), second = release(1);
    await p.reload({waitUntil: 'load'});
    await wait(500);
    const afterOne = await keptPrograms();
    const third = release(2);
    await p.reload({waitUntil: 'load'});
    await wait(500);
    const afterTwo = await keptPrograms();
    check('a release keeps the new program, and the one before it for a page still showing',
          afterOne.join() === [first, second].sort().join(), JSON.stringify(afterOne));
    check('and the one before that is let go', afterTwo.join() === [second, third].sort().join(), JSON.stringify(afterTwo));
    /* A picture goes the same way: kept while the page, or the one it
       replaced, names it, and let go after. */
    const keptPicture = () => p.evaluate(async ([name, src]) => !!(await (await caches.open(name)).match(src)),
                                         [cacheName, new URL(PICTURE.slice(1), at).href]);
    const namedStill = await keptPicture();
    files['/'] = Buffer.from(files['/'].toString().split('<!-- ' + PICTURE.slice(1) + ' -->').join(''));
    release(3);
    await p.reload({waitUntil: 'load'});
    await wait(500);
    const sparedOnce = await keptPicture();
    release(4);
    await p.reload({waitUntil: 'load'});
    await wait(500);
    const letGo = !(await keptPicture());
    check('a picture is kept while a page names it, and the page before; then it is let go',
          namedStill && sparedOnce && letGo, JSON.stringify({namedStill, sparedOnce, letGo}));
    up = false;
    await p.reload({waitUntil: 'load'}).catch(e => errs.push('reload: ' + e.message));
    const offlineAfter = await p.waitForFunction(() => typeof rebuildChart === 'function', null, {timeout: 8000}).then(() => true, () => false);
    check('and with no connection the released page opens on the program it names', offlineAfter);
    check('and none of it raised an error', errs.length === 0, errs.join(' | '));
  } finally {
    await c.close();
    await new Promise(res => srv.close(res));
  }
  });
