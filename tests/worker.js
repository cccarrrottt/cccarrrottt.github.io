#!/usr/bin/env node
/* The write service, against a GitHub that lives in this process.
 *
 *   node tests/worker.js
 *
 * worker/index.js is the one piece of this project that decides who may
 * change the published chart, so what it REFUSES matters more than what it
 * does: a session it did not seal, a login that is not the owner, a sign-in
 * that would hand the session to another site, a page saving on top of an
 * older chart.json. Each is driven through the service's own fetch handler,
 * exactly as Cloudflare calls it, with GitHub's API answered from memory.
 *
 * And the one thing it does, it has to do exactly as the page and build.py
 * do it: a save of the chart as it already is changes nothing, and a save
 * of an edit changes that item's line and no other line of src/chart.json.
 *
 * Readers sign in too, to suggest — and a reader's session is the newest
 * thing a mistake could turn into a key. So the suggestion checks are
 * mostly what a reader still cannot do.
 */
const fs = require('fs'), path = require('path'), nodeCrypto = require('crypto');

let pass = 0, fail = 0;
function check(name, ok, detail){
  (ok ? pass++ : fail++);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`);
}

const ROOT = path.join(__dirname, '..');
const DATA = fs.readFileSync(path.join(ROOT, 'src', 'chart.json'), 'utf8');
const gitSha = text => { const b = Buffer.from(text, 'utf8');
  return nodeCrypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); };

const ENV = {
  GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'a-test-secret-that-is-long-enough-to-count',
  REPO: 'owner/site', BRANCH: 'main', OWNERS: 'TheOwner',
  ALLOWED_ORIGINS: 'https://owner.github.io'
};
const SITE = 'https://owner.github.io';
const SVC = 'https://rhizome-edit.test.workers.dev';

/* ---- GitHub, in memory ---- */
function fakeGitHub(){
  const gh = {blobs: new Map(), trees: new Map(), commits: new Map(), head: null,
              users: {'tok-owner': 'TheOwner', 'tok-other': 'someone', 'tok-reader': 'a-reader'}, refUpdates: 0, raceNext: false,
              // The repository's issues, and whether the app was given the
              // Issues permission (without it GitHub answers 403).
              issues: [], issuesAllowed: true,
              // Refresh tokens GitHub will still take. Each is good once.
              refresh: new Set(['rt-first']), issued: 0};
  const pair = () => { const rt = 'rt-' + (++gh.issued); gh.refresh.add(rt);
                       return {access_token: 'tok-owner', expires_in: 28800, refresh_token: rt, refresh_token_expires_in: 15897600}; };
  const blob = text => { const sha = gitSha(text); gh.blobs.set(sha, text); return sha; };
  const tree = entries => { const sha = nodeCrypto.createHash('sha1').update(JSON.stringify(entries)).digest('hex');
                            gh.trees.set(sha, entries); return sha; };
  const srcTree = tree([{path: 'chart.json', type: 'blob', sha: blob(DATA)}]);
  const root = tree([{path: 'src', type: 'tree', sha: srcTree}, {path: 'README.md', type: 'blob', sha: blob('readme')}]);
  gh.head = 'c0'; gh.commits.set('c0', {tree: root});
  gh.mediaAt = commit => {
    const top = gh.trees.get(gh.commits.get(commit).tree);
    const src = gh.trees.get(top.find(e => e.path === 'src').sha);
    const dir = src.find(e => e.path === 'media');
    return dir ? new Map(gh.trees.get(dir.sha).map(e => [e.path, gh.blobs.get(e.sha)])) : new Map();
  };
  gh.dataAt = commit => {
    const top = gh.trees.get(gh.commits.get(commit).tree);
    const src = gh.trees.get(top.find(e => e.path === 'src').sha);
    return gh.blobs.get(src.find(e => e.path === 'chart.json').sha);
  };
  gh.fetch = async (url, init) => {
    const u = new URL(url), method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    const auth = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', '');
    const ok = v => new Response(JSON.stringify(v), {status: 200});
    if(u.host === 'github.com' && u.pathname === '/login/oauth/access_token' && body.grant_type === 'refresh_token'){
      if(body.client_secret !== 'secret' || !gh.refresh.has(body.refresh_token)) return ok({error: 'bad_refresh_token'});
      gh.refresh.delete(body.refresh_token);
      return ok(pair());
    }
    if(u.host === 'github.com' && u.pathname === '/login/oauth/access_token'){
      return ok(body.code === 'code-owner' ? pair()
              : body.code === 'code-other' ? {access_token: 'tok-other'}
              : body.code === 'code-reader' ? {access_token: 'tok-reader'}
              // A token GitHub hands out and then will not answer /user for.
              : body.code === 'code-nouser' ? {access_token: 'tok-gone'} : {error: 'bad_verification_code'});
    }
    if(!gh.users[auth]) return new Response('{}', {status: 401});
    const p = u.pathname.replace('/repos/owner/site', '');
    if(p === '/user') return ok({login: gh.users[auth]});
    if(p === '/git/ref/heads/main') return ok({object: {sha: gh.head}});
    let m;
    if(p === '/issues' || /^\/issues\/\d+$/.test(p)){
      if(!gh.issuesAllowed) return new Response('{}', {status: 403});
      if(p === '/issues' && method === 'GET'){
        const n = Number(u.searchParams.get('page') || 1), by = u.searchParams.get('creator');
        const all = u.searchParams.get('state') === 'all';
        const open = gh.issues.filter(i => (all || i.state === 'open') && (!by || (i.user && i.user.login) === by)).slice().reverse();
        return ok(open.slice((n - 1) * 100, n * 100));
      }
      if(p === '/issues' && method === 'POST'){
        const issue = {number: gh.issues.length + 1, state: 'open', title: body.title, body: body.body,
                       user: {login: gh.users[auth]}, created_at: new Date().toISOString(),
                       html_url: 'https://github.com/owner/site/issues/' + (gh.issues.length + 1)};
        gh.issues.push(issue);
        return ok(issue);
      }
      const issue = gh.issues[Number(p.split('/')[2]) - 1];
      if(!issue) return new Response('{}', {status: 404});
      if(method === 'PATCH'){ Object.assign(issue, body); return ok(issue); }
      return ok(issue);
    }
    if((m = /^\/git\/commits\/(.+)$/.exec(p))) return ok({tree: {sha: gh.commits.get(m[1]).tree}});
    if((m = /^\/git\/trees\/(.+)$/.exec(p))) return ok({tree: gh.trees.get(m[1])});
    if((m = /^\/git\/blobs\/(.+)$/.exec(p))){
      const b64 = Buffer.from(gh.blobs.get(m[1]), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
      return ok({content: b64, encoding: 'base64'});
    }
    if(p === '/git/blobs' && method === 'POST'){
      if(body.encoding !== 'base64') return ok({sha: blob(body.content)});
      // A picture: kept as its bytes, so a test can read back what landed.
      gh.pictureBlobs = (gh.pictureBlobs || 0) + 1;
      const bytes = Buffer.from(body.content, 'base64');
      const sha = nodeCrypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
      gh.blobs.set(sha, bytes);
      return ok({sha});
    }
    if(p === '/git/trees' && method === 'POST'){
      const top = gh.trees.get(body.base_tree).map(e => ({...e}));
      const srcEntry = top.find(e => e.path === 'src');
      const src = gh.trees.get(srcEntry.sha).map(e => ({...e}));
      const put = (list, name, sha, type) => {
        const e = list.find(x => x.path === name);
        if(e) e.sha = sha; else list.push({path: name, type, sha});
      };
      for(const t of body.tree){
        const bits = t.path.split('/');
        if(bits[0] !== 'src') return new Response('{}', {status: 422});
        if(bits.length === 2){ put(src, bits[1], t.sha, 'blob'); continue; }
        const dir = src.find(x => x.path === bits[1]);
        const list = dir ? gh.trees.get(dir.sha).map(e => ({...e})) : [];
        put(list, bits[2], t.sha, 'blob');
        put(src, bits[1], tree(list), 'tree');
      }
      srcEntry.sha = tree(src);
      return ok({sha: tree(top)});
    }
    if(p === '/git/commits' && method === 'POST'){
      const sha = 'c' + (gh.commits.size); gh.commits.set(sha, {tree: body.tree, parents: body.parents});
      return ok({sha});
    }
    if(p === '/git/refs/heads/main' && method === 'PATCH'){
      gh.refUpdates++;
      if(gh.raceNext || gh.commits.get(body.sha).parents[0] !== gh.head){
        gh.raceNext = false;
        return new Response('{}', {status: 422});
      }
      gh.head = body.sha;
      return ok({});
    }
    return new Response('{}', {status: 404});
  };
  return gh;
}

/* The chart as the page sends it: the file, with an edit made to it. The
   text is written as the service writes it, which is what the page writes
   too (chartJsonText); the suite holds the page's to the service's. */
let chartText = null;
const edit = (text, fn) => { const c = JSON.parse(text); fn(c); return chartText(c); };
const chartWith = fn => edit(DATA, fn);
// How many lines differ between two texts of nearly one length.
const diffLines = (a, b) => { const A = a.split('\n'), B = new Set(b.split('\n'));
  const gone = A.filter(l => !B.has(l)).length, have = new Set(A);
  return gone + b.split('\n').filter(l => !have.has(l)).length; };

(async () => {
  const w = await import(path.join(ROOT, 'worker', 'index.js'));
  chartText = w.chartText;
  const svc = w.default;
  const gh = fakeGitHub();
  globalThis.fetch = gh.fetch;
  const call = (p, init) => svc.fetch(new Request(SVC + p, init), ENV);
  const session = login => w.seal(ENV, 'session', {login, gh: login === 'TheOwner' ? 'tok-owner' : 'tok-other', exp: Date.now() + 60000});

  /* Sealing. */
  const s = await session('TheOwner');
  check('a sealed session opens with the same secret', (await w.unseal(ENV, 'session', s)).login === 'TheOwner');
  check('and not with another', await w.unseal({...ENV, SESSION_SECRET: ENV.SESSION_SECRET + 'x'}, 'session', s) === null);
  const flipped = s.slice(0, 20) + (s[20] === 'A' ? 'B' : 'A') + s.slice(21);
  check('a session changed by one character is refused', await w.unseal(ENV, 'session', flipped) === null);
  const state = await w.seal(ENV, 'state', {login: 'TheOwner', exp: Date.now() + 60000});
  check('a login state cannot be used as a session', await w.unseal(ENV, 'session', state) === null);
  check('an expired session is refused',
        await w.unseal(ENV, 'session', await w.seal(ENV, 'session', {login: 'TheOwner', exp: Date.now() - 1})) === null);

  /* Signing in. */
  let r = await call('/login?origin=' + encodeURIComponent('https://evil.example'));
  check('sign-in refuses to hand a session to another site', r.status === 400);
  r = await call('/login?origin=' + encodeURIComponent(SITE) + '&return=' + encodeURIComponent('https://owner.github.io.evil.example/'));
  check('or to return anywhere but the site', r.status === 400);
  r = await call('/login?origin=' + encodeURIComponent(SITE));
  const to = r.status === 302 ? new URL(r.headers.get('Location')) : null;
  check('sign-in goes to GitHub with a state', !!to && to.host === 'github.com' && !!to.searchParams.get('state'),
        r.status + ' ' + r.headers.get('Location'));
  const st = to && to.searchParams.get('state');
  r = await call(`/callback?code=code-other&state=${st}`);
  const other = await r.text();
  check('an account that is not the owner gets no session', r.status === 403 && !/rhizomeSession/.test(other), r.status);
  r = await call(`/callback?code=code-nouser&state=${st}`);
  check('a GitHub that will not say who signed in gets a page that says so, not JSON',
        r.status === 502 && /text\/html/.test(r.headers.get('Content-Type') || '') && /would not say who/.test(await r.text()),
        r.status + ' ' + r.headers.get('Content-Type'));
  r = await call(`/callback?code=code-owner&state=${encodeURIComponent('forged')}`);
  check('a forged state is refused', r.status === 400);
  r = await call(`/callback?code=code-owner&state=${st}`);
  const html = await r.text();
  const handed = /"rhizomeSession":"([^"]+)"/.exec(html);
  check('the owner gets a session, handed only to the site',
        r.status === 200 && !!handed && html.includes(`postMessage({"rhizomeSession":"${handed[1]}"}, "${SITE}")`), html.slice(0, 300));
  check('and the page it arrives on cannot run anything else, or be framed',
        /frame-ancestors 'none'/.test(r.headers.get('Content-Security-Policy') || ''));
  const real = handed ? await w.unseal(ENV, 'session', handed[1]) : null;
  check('that session holds the owner\'s GitHub token', !!real && real.login === 'TheOwner' && real.gh === 'tok-owner');
  check('and what renews it, so it outlives the token\'s eight hours',
        !!real && /^rt-/.test(real.rt) && real.exp > Date.now() + 9 * 3600000 && real.exp <= Date.now() + 31 * 86400000,
        real && JSON.stringify({rt: real.rt, days: (real.exp - Date.now()) / 86400000}));

  /* Who is this. */
  const auth = tok => ({headers: {Authorization: 'Bearer ' + tok, Origin: SITE}});
  r = await call('/me', {headers: {Origin: SITE}});
  check('with no session, /me says so', r.status === 401);
  r = await call('/me', auth(s));
  let body = await r.json();
  check('the owner is told so, with the chart.json that is current', r.status === 200 && body.owner && body.sha === gitSha(DATA),
        JSON.stringify(body));
  check('and that it takes pictures as files beside the chart', body.media === true);
  check('and the answer is readable by the site', r.headers.get('Access-Control-Allow-Origin') === SITE);
  r = await call('/me', {headers: {Authorization: 'Bearer ' + s, Origin: 'https://evil.example'}});
  check('but not by any other site', r.headers.get('Access-Control-Allow-Origin') === null);
  r = await call('/me', auth(await session('someone')));
  check('a session for a login that is not an owner is refused', r.status === 403);

  /* Renewing. A phone that was offline for days comes back with a session
     whose GitHub token ran out long ago. */
  const lapsed = rt => w.seal(ENV, 'session', {login: 'TheOwner', gh: 'tok-lapsed', ghExp: Date.now() - 1000,
                                                rt, exp: Date.now() + 86400000});
  const old = await lapsed('rt-first');
  r = await call('/me', auth(old));
  body = await r.json();
  const renewed = body.session ? await w.unseal(ENV, 'session', body.session) : null;
  check('a session whose token ran out is renewed, and the new one handed back',
        r.status === 200 && body.owner && !!renewed && renewed.gh === 'tok-owner' && renewed.rt !== 'rt-first',
        r.status + ' ' + JSON.stringify(renewed));
  r = await call('/me', auth(old));
  check('the refresh token it was renewed with is not good twice', r.status === 401);
  const lapsedReader = await w.seal(ENV, 'session', {login: 'a-reader', as: 'reader', gh: 'tok-lapsed', ghExp: Date.now() - 1000,
                                                     rt: [...gh.refresh][0], exp: Date.now() + 86400000});
  r = await call('/me', auth(lapsedReader));
  body = await r.json();
  const renewedReader = body.session ? await w.unseal(ENV, 'session', body.session) : null;
  check('a reader\'s session renewed is still a reader\'s, and still not an owner\'s',
        r.status === 200 && body.owner === false && !!renewedReader && renewedReader.as === 'reader' && renewedReader.login === 'a-reader',
        r.status + ' ' + JSON.stringify(renewedReader));
  r = await call('/me', auth(s));
  body = await r.json();
  check('a session whose token is good is not renewed', r.status === 200 && !('session' in body));
  const lapsedSave = await lapsed([...gh.refresh][0]);
  r = await call('/save', {method: 'POST', headers: {Authorization: 'Bearer ' + lapsedSave, Origin: SITE,
                 'Content-Type': 'application/json'}, body: JSON.stringify({base: '0000', chart: chartWith(c => c.refs.push({key: 'behind', title: ''}))})});
  body = await r.json();
  check('a save that is refused still hands back the session it renewed, which is all that can renew it now',
        r.status === 409 && !!body.session && !!(await w.unseal(ENV, 'session', body.session)), r.status + ' ' + JSON.stringify(body).slice(0, 120));

  /* Saving. */
  const post = (tok, payload) => call('/save', {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                       'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  check('the repository\'s chart.json is written as the service writes it, one item to a line',
        w.chartText(w.readChart(DATA)) === DATA);
  r = await post(s, {base: gitSha(DATA), chart: DATA});
  body = await r.json();
  check("saving the chart as it is commits nothing", r.status === 200 && body.unchanged && gh.refUpdates === 0, r.status + " " + JSON.stringify(body));
  r = await post(s, {base: gitSha(DATA), chart: JSON.stringify(JSON.parse(DATA))});
  body = await r.json();
  check('nor does the same chart written on one line: what is compared is the chart, written the one way',
        r.status === 200 && body.unchanged && gh.refUpdates === 0, r.status + ' ' + JSON.stringify(body));

  const edited = chartWith(c => c.refs.push({key: 'added', title: 'A reference added in the browser'}));
  r = await post(s, {base: '0000', chart: edited});
  check('a page that is behind the repository cannot save', r.status === 409 && gh.head === 'c0');

  /* A save is published at once, so it has to be the chart and only the
     chart. JSON cannot run, and the page reads it from an element that
     does not; what is left to refuse is a file that is not a chart. */
  const refused = async (what, chart) => {
    const res = await post(s, {base: gitSha(DATA), chart});
    const b = await res.json();
    check(what, res.status === 400 && gh.head === 'c0', res.status + ' ' + JSON.stringify(b));
  };
  await refused('a save that is not JSON is refused', edited.replace(/\}\n$/, ''));
  await refused('and the regions of a page from before the chart was JSON', 'const NODES = [];');
  await refused('and a chart with no entries', chartWith(c => { delete c.nodes; }));
  await refused('and one with a part no chart has', DATA.replace(/\n\}\n$/, ',\n  "script": "alert(1)"\n}\n'));
  await refused('and one whose entries are not records', chartWith(c => { c.nodes.push(['an', 'old', 'list']); }));
  await refused('and one whose connector styles are not a list', chartWith(c => { c.edgeStyles = {}; }));
  await refused('and settings that are not a record', chartWith(c => { c.settings = []; }));
  await refused('and a form that is not a whole number', chartWith(c => { c.format = '4'; }));
  r = await post(s, {base: gitSha(DATA), parts: {NODES: 'const NODES = [];'}});
  body = await r.json();
  check('a page from before 0.23, sending regions, is told to reload', r.status === 400 && /reload/.test(body.error) && gh.head === 'c0',
        r.status + ' ' + JSON.stringify(body));
  r = await post(await session('someone'), {base: gitSha(DATA), chart: edited});
  check('a login that is not an owner cannot save', r.status === 403 && gh.head === 'c0');

  gh.raceNext = true;
  r = await post(s, {base: gitSha(DATA), chart: edited});
  check('a push that lands during a save makes it fail, not overwrite', r.status === 409 && gh.head === 'c0');

  r = await post(s, {base: gitSha(DATA), chart: edited});
  body = await r.json();
  const after = gh.dataAt(gh.head);
  check('an edit becomes a commit on the branch', r.status === 200 && gh.head !== 'c0', JSON.stringify(body));
  check('which answers with the new chart.json, so the next save stacks on it', body.sha === gitSha(after));
  check('the edit is in it', after.includes('A reference added in the browser'));
  /* An item added at the end of a list is its own line and a comma on the
     line before it: three lines of difference, and the file is otherwise
     the one it was. */
  check('and nothing else in the file moved', after === edited && diffLines(DATA, after) === 3, diffLines(DATA, after));

  r = await post(s, {base: gitSha(DATA), chart: DATA});
  body = await r.json();
  check('the page\'s old base, sending the chart it was made on, cannot undo that save',
        r.status === 200 && body.unchanged && gitSha(gh.dataAt(gh.head)) === gitSha(after), r.status + ' ' + JSON.stringify(body).slice(0, 200));
  const headBefore = gh.head;
  r = await post(s, {base: gitSha(DATA), chart: edited});
  body = await r.json();
  check('but that same save sent again on the old base — its answer lost on the way — is not a conflict',
        r.status === 200 && body.unchanged && body.sha === gitSha(after) && gh.head === headBefore, r.status + ' ' + JSON.stringify(body));

  /* Pictures, which go beside the chart as files named by their hash. */
  const picture = Buffer.from('not really a png, but bytes all the same');
  const picHex = nodeCrypto.createHash('sha256').update(picture).digest('hex');
  const picRef = 'media/' + picHex + '.png';
  const withPic = chartWith(c => { c.refs.push({key: 'added', title: 'A reference added in the browser'});
                                   c.media.push({key: 'pic', name: 'pic', kind: 'image', src: picRef}); });
  let picHead = gh.head;
  r = await post(s, {base: gitSha(after), chart: withPic, media: {[picRef]: Buffer.from('other bytes').toString('base64')}});
  check('a picture whose bytes are not what its name says is refused', r.status === 400 && gh.head === picHead);
  r = await post(s, {base: gitSha(after), chart: withPic, media: {['media/' + picHex + '.exe']: picture.toString('base64')}});
  check('and so is one named as no picture may be', r.status === 400 && gh.head === picHead);
  /* An SVG on the site would have an address, and opened there its
     scripts would run beside the owner's session; the page keeps one
     embedded, and the service will not give it a file either. */
  {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const svgRef = 'media/' + nodeCrypto.createHash('sha256').update(svg).digest('hex') + '.svg';
    const withSvg = chartWith(c => { c.media.push({key: 'svg', name: 'svg', kind: 'image', src: svgRef}); });
    r = await post(s, {base: gitSha(after), chart: withSvg, media: {[svgRef]: svg.toString('base64')}});
    check('an SVG is refused as a file, even named for exactly what its bytes are', r.status === 400 && gh.head === picHead);
  }
  /* A face of the chart's own is a file like a picture (0.26.2): opened at
     its address a font runs nothing. */
  {
    const font = Buffer.from('bytes of a font');
    const fontRef = 'media/' + nodeCrypto.createHash('sha256').update(font).digest('hex') + '.woff2';
    const took = await w.checkMedia({[fontRef]: font.toString('base64')}, `{"fonts":[{"src":"${fontRef}"}]}`, '{}', new Set());
    check('a font is taken as a file of the chart, named for its bytes', took.length === 1 && took[0].ref === fontRef);
    let named = null;
    try{ await w.checkMedia({}, `{"fonts":[{"src":"${fontRef}"}]}`, '{}', new Set()); }catch(e){ named = e.message; }
    check('…and a chart naming one nobody sent is refused, as for a picture', /does not have/.test(named || ''), named);
  }
  r = await post(s, {base: gitSha(after), chart: withPic});
  body = await r.json();
  check('a chart naming a picture the repository does not have, and not sending it, is refused',
        r.status === 400 && gh.head === picHead && /does not have/.test(body.error), r.status + ' ' + JSON.stringify(body));
  r = await post(s, {base: gitSha(after), chart: withPic, media: {[picRef]: picture.toString('base64')}});
  body = await r.json();
  const landed = gh.mediaAt(gh.head);
  check('a new picture is committed beside the chart, in the same commit',
        r.status === 200 && gh.head !== picHead && landed.has(picHex + '.png') && Buffer.compare(landed.get(picHex + '.png'), picture) === 0
        && gh.dataAt(gh.head).includes(picRef), r.status + ' ' + JSON.stringify(body));
  const withPicSha = body.sha;
  picHead = gh.head;
  const blobsBefore = gh.pictureBlobs;
  const again = edit(withPic, c => c.refs.push({key: 'more', title: 'and one more edit'}));
  r = await post(s, {base: withPicSha, chart: again, media: {[picRef]: picture.toString('base64')}});
  body = await r.json();
  check('a picture already in the folder is not written again', r.status === 200 && gh.head !== picHead && gh.pictureBlobs === blobsBefore,
        r.status + ' ' + JSON.stringify(body));
  picHead = gh.head;
  r = await post(s, {base: body.sha, chart: edit(again, c => { c.nodes[0].image = picRef; })});
  check('and a chart may name one that is there without sending it', r.status === 200 && gh.head !== picHead);

  /* Two saves made on one chart: a second device, or a phone's kept Save
     sent days later. What each changed is put together; only what both
     changed is refused. */
  r = await post(s, {base: gitSha(gh.dataAt(gh.head)), chart: DATA});
  const clean = (await r.json()).sha;
  check('(a clean chart to merge on)', r.status === 200 && gitSha(gh.dataAt(gh.head)) === clean);
  const one = chartWith(c => c.refs.push({key: 'm-one', title: 'One'}));
  r = await post(s, {base: clean, chart: one});
  const firstSave = await r.json();
  check('(one device saves a reference)', r.status === 200 && !firstSave.merged);
  const two = chartWith(c => c.nodes.push({id: 'm-two', label: 'Two'}));
  r = await post(s, {base: clean, chart: two});
  body = await r.json();
  const merged = gh.dataAt(gh.head);
  check('a save made on the older chart is merged with it rather than refused',
        r.status === 200 && body.merged && merged.includes('{"key":"m-one","title":"One"}') && merged.includes('{"id":"m-two","label":"Two"}'),
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  check('and the file is the two edits and nothing else', diffLines(DATA, merged) === 6 &&
        merged === chartWith(c => { c.refs.push({key: 'm-one', title: 'One'}); c.nodes.push({id: 'm-two', label: 'Two'}); }),
        diffLines(DATA, merged));
  check('the answer carries the chart as merged, and what it was saved over',
        body.chart === merged && body.over === firstSave.sha, JSON.stringify({over: body.over, first: firstSave.sha}));
  const mergedSha = body.sha;
  const retitle = (chart, title) => edit(chart, c => { c.refs.find(x => x.key === 'ref').title = title; });
  // The same entry changed on both: refused, and named.
  const theirs = retitle(body.chart, 'Theirs');
  r = await post(s, {base: mergedSha, chart: theirs});
  const theirsSave = await r.json();
  check('(the other device retitles a reference)', r.status === 200);
  const headMine = gh.head;
  r = await post(s, {base: clean, chart: retitle(DATA, 'Mine')});
  body = await r.json();
  check('the same entry changed differently on both is refused, and named',
        r.status === 409 && gh.head === headMine && Array.isArray(body.conflicts) &&
        body.conflicts.length === 1 && body.conflicts[0].region === 'refs' && body.conflicts[0].item === 'ref',
        r.status + ' ' + JSON.stringify(body));
  // Changed the same way on both: no conflict at all.
  r = await post(s, {base: clean, chart: retitle(DATA, 'Theirs')});
  body = await r.json();
  check('the same change made on both is no conflict', r.status === 200 && body.unchanged && body.merged, r.status + ' ' + JSON.stringify(body).slice(0, 160));
  // Taken out on one, changed on the other.
  const gone = chartWith(c => { c.nodes = c.nodes.filter(n => n.id !== 'uprising-copy'); });
  const changed = edit(theirs, c => { c.nodes.find(n => n.id === 'uprising-copy').label = 'Renamed'; });
  r = await post(s, {base: theirsSave.sha, chart: changed});
  check('(the other device renames an entry)', r.status === 200);
  const headThen = gh.head;
  r = await post(s, {base: clean, chart: gone});
  body = await r.json();
  check('an entry taken out on one and changed on the other is refused', r.status === 409 && gh.head === headThen &&
        body.conflicts && body.conflicts[0].region === 'nodes' && body.conflicts[0].item === 'uprising-copy', r.status + ' ' + JSON.stringify(body));
  // And one taken out where the other did not touch it is taken out.
  r = await post(s, {base: clean, chart: chartWith(c => { c.refs = c.refs.filter(x => x.key !== 'ref-2'); })});
  body = await r.json();
  check('an entry taken out on one and left alone on the other is taken out',
        r.status === 200 && body.merged && !gh.dataAt(gh.head).includes('"key":"ref-2"') && gh.dataAt(gh.head).includes('"label":"Renamed"'),
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  /* Two changes to one field of a connector style are one entry changed
     twice, and collide even when the fields differ — as two edits to one
     entry always have. */
  {
    const style = (chart, k, v) => edit(chart, c => { c.edgeStyles.find(x => x.from === 'node-3' && x.to === 'node-4')[k] = v; });
    const now = gh.dataAt(gh.head);
    r = await post(s, {base: gitSha(now), chart: style(now, 'dash', 'dotted')});
    const headE = gh.head;
    r = await post(s, {base: clean, chart: style(DATA, 'routing', 'curve')});
    body = await r.json();
    check('a connector style changed on both is refused, and named by its two ends',
          r.status === 409 && gh.head === headE && body.conflicts[0].region === 'edgeStyles' && body.conflicts[0].item === 'node-3 \u2192 node-4',
          r.status + ' ' + JSON.stringify(body));
  }
  /* The settings are one record of unrelated choices, so each is merged
     on its own: two devices setting two different ones is no collision. */
  {
    const now = gh.dataAt(gh.head);
    r = await post(s, {base: gitSha(now), chart: edit(now, c => { c.settings.refColor = '#112233'; })});
    check('(one device changes the citation colour)', r.status === 200);
    const headS = gh.head;
    r = await post(s, {base: gitSha(now), chart: edit(now, c => { c.settings.legend = {'tag:x': 'Meaning'}; })});
    body = await r.json();
    const got = JSON.parse(gh.dataAt(gh.head)).settings;
    check('two settings changed on two devices are both kept',
          r.status === 200 && body.merged && got.refColor === '#112233' && got.legend && got.legend['tag:x'] === 'Meaning',
          r.status + ' ' + JSON.stringify(got));
    const headS2 = gh.head;
    r = await post(s, {base: gitSha(now), chart: edit(now, c => { c.settings.refColor = '#445566'; })});
    body = await r.json();
    check('one setting changed differently on both is refused, and named', r.status === 409 && gh.head === headS2 && headS2 !== headS &&
          body.conflicts[0].region === 'settings' && body.conflicts[0].item === 'refColor', r.status + ' ' + JSON.stringify(body));
  }
  r = await post(s, {base: 'f'.repeat(40), chart: two});
  check('a base the repository never had is refused, not merged against nothing', r.status === 409);
  r = await post(s, {base: gitSha(DATA), chart: edit(DATA, c => { c.nodes.push({label: 'no id'}); })});
  body = await r.json();
  check('and a list a merge cannot name the items of is refused as a whole, not guessed at',
        r.status === 409 && body.conflicts && body.conflicts[0].region === 'nodes' && !body.conflicts[0].item, r.status + ' ' + JSON.stringify(body));

  /* A merge whose two halves are each whole can still leave a loose end:
     one device took an entry out while the other hung a new one under it. */
  {
    const now = gh.dataAt(gh.head);
    r = await post(s, {base: gitSha(now), chart: edit(now, c => c.nodes.push({id: 'lone', label: 'Lone'}))});
    const withLone = await r.json();
    const P2 = gh.dataAt(gh.head);
    r = await post(s, {base: withLone.sha, chart: edit(P2, c => { c.nodes = c.nodes.filter(n => n.id !== 'lone'); })});
    check('(one device takes an entry out)', r.status === 200 && !gh.dataAt(gh.head).includes('"id":"lone"'));
    const headGone = gh.head;
    r = await post(s, {base: withLone.sha, chart: edit(P2, c => c.nodes.push({id: 'kid', label: 'Kid', parent: 'lone'}))});
    body = await r.json();
    check('a merge that would leave an entry under one that is gone is refused, and names the one that is gone',
          r.status === 409 && gh.head === headGone && body.conflicts && body.conflicts[0].region === 'nodes' &&
          body.conflicts[0].item === 'lone' && body.conflicts[0].from.item === 'kid',
          r.status + ' ' + JSON.stringify(body));
    r = await post(s, {base: withLone.sha, chart: edit(P2, c => c.edgeStyles.push({from: 'lone', to: 'uprising', routing: 'curve', dash: 'solid', arrow: true}))});
    body = await r.json();
    check('and so is one that would leave a connector style pointing at it', r.status === 409 && gh.head === headGone,
          r.status + ' ' + JSON.stringify(body));
    r = await post(s, {base: withLone.sha, chart: edit(P2, c => c.nodes.push({id: 'kid', label: 'Kid', parent: 'uprising'}))});
    check('while one that hangs it somewhere still there is merged', r.status === 200 && gh.head !== headGone);
  }

  /* Suggestions. A reader signs in by asking to; the same account through
     Owner sign-in is still turned away above. */
  r = await call('/login?as=reader&origin=' + encodeURIComponent(SITE));
  const rto = r.status === 302 ? new URL(r.headers.get('Location')) : null;
  check('a reader is asked which GitHub account to use', !!rto && rto.searchParams.get('prompt') === 'select_account',
        rto && rto.toString());
  check('the owner\'s sign-in is not', !!to && !to.searchParams.has('prompt'), to && to.toString());
  r = await call(`/callback?code=code-reader&state=${rto && rto.searchParams.get('state')}`);
  const rhtml = await r.text();
  const rhanded = /"rhizomeSession":"([^"]+)"/.exec(rhtml);
  const reader = rhanded ? rhanded[1] : '';
  const rreal = reader ? await w.unseal(ENV, 'session', reader) : null;
  check('a reader who asks to sign in gets a session marked as a reader\'s',
        r.status === 200 && !!rreal && rreal.login === 'a-reader' && rreal.as === 'reader', r.status + ' ' + rhtml.slice(0, 200));
  r = await call('/login?as=reader&origin=' + encodeURIComponent(SITE));
  const oto = new URL(r.headers.get('Location'));
  r = await call(`/callback?code=code-owner&state=${oto.searchParams.get('state')}`);
  const ohanded = /"rhizomeSession":"([^"]+)"/.exec(await r.text());
  const oreal = ohanded ? await w.unseal(ENV, 'session', ohanded[1]) : null;
  check('the owner signing in to suggest is signed in as the owner', !!oreal && oreal.login === 'TheOwner' && !oreal.as);

  r = await call('/me', auth(reader));
  body = await r.json();
  check('/me tells a reader they are a reader, and nothing about chart.json',
        r.status === 200 && body.owner === false && body.login === 'a-reader' && !('sha' in body), JSON.stringify(body));
  const headNow = gh.head;
  r = await post(reader, {base: gitSha(after), chart: edit(after, c => c.refs.push({key: 'reader', title: 'a reader'}))});
  check('a reader cannot save', r.status === 403 && gh.head === headNow);

  const suggest = (tok, payload) => call('/suggest', {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                         'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  r = await call('/suggestions', {headers: {Origin: SITE}});
  check('with no session there are no suggestions to read', r.status === 401);
  r = await suggest(await session('someone'), {kind: 'correction', text: 'x'});
  check('nor to write, for a session that was never a reader\'s', r.status === 403 && gh.issues.length === 0);
  r = await suggest(reader, {kind: 'complaint', text: 'x'});
  check('a suggestion of no known kind is refused', r.status === 400 && gh.issues.length === 0);
  r = await suggest(reader, {kind: 'addition', text: '   '});
  check('and one that says nothing', r.status === 400 && gh.issues.length === 0);
  r = await suggest(reader, {kind: 'addition', text: 'x'.repeat(4001)});
  check('and one too long to be a suggestion', r.status === 413 && gh.issues.length === 0);
  /* A body that does not say how long it is: the bytes are what is counted.
     It arrives as a stream, as a chunked upload does, with no header. */
  const streamed = (bytes) => new ReadableStream({start(c){
    const chunk = new TextEncoder().encode(' '.repeat(16384));
    for(let n = 0; n < bytes; n += chunk.length) c.enqueue(chunk);
    c.enqueue(new TextEncoder().encode(JSON.stringify({kind: 'addition', text: 'x'})));
    c.close();
  }});
  r = await call('/suggest', {method: 'POST', duplex: 'half', headers: {Authorization: 'Bearer ' + reader, Origin: SITE,
                 'Content-Type': 'application/json'}, body: streamed(200 * 1024)});
  check('a body past the limit is refused though no header said how long it was',
        r.status === 413 && gh.issues.length === 0, r.status);
  r = await call('/suggest', {method: 'POST', duplex: 'half', headers: {Authorization: 'Bearer ' + reader, Origin: SITE,
                 'Content-Type': 'application/json'}, body: streamed(0)});
  check('and one within it, streamed the same way, is read', r.status === 200 && gh.issues.length === 1, r.status);
  gh.issues.length = 0;

  const oddId = 'odd --> id <!-- with "quotes"';
  r = await suggest(reader, {kind: 'correction', text: 'The year is wrong.\n\nIt came out in 1986.', entry: oddId, label: 'Beast Wars:\n Uprising'});
  body = await r.json();
  const made = gh.issues[0];
  check('a suggestion becomes an issue written by the reader',
        r.status === 200 && !!made && made.user.login === 'a-reader' && made.title === 'Correction: Beast Wars: Uprising',
        r.status + ' ' + JSON.stringify(made && {t: made.title, u: made.user}));
  check('which reads on GitHub as the reader\'s words, the marker hidden after them',
        !!made && made.body.startsWith('The year is wrong.\n\nIt came out in 1986.\n\n<!-- ') && made.body.endsWith(' -->')
        && made.body.indexOf('-->') === made.body.length - 3, made && made.body);
  check('and the page is told what it made, entry and all, however odd the entry\'s id',
        body.suggestion && body.suggestion.entry === oddId && body.suggestion.kind === 'correction' && body.suggestion.mine === true
        && body.suggestion.text === 'The year is wrong.\n\nIt came out in 1986.', JSON.stringify(body));
  r = await suggest(reader, {kind: 'addition', text: 'There is a sequel.', title: '  A  sequel\n is missing '});
  body = await r.json();
  const titled = gh.issues[gh.issues.length - 1];
  check('a title of the reader\'s own heads the issue after its kind, one line, and comes back with it',
        !!titled && titled.title === 'Addition: A sequel is missing' && body.suggestion && body.suggestion.title === 'A sequel is missing',
        JSON.stringify({t: titled && titled.title, s: body.suggestion && body.suggestion.title}));
  check('and one with no title has none, the entry naming the issue as before',
        made.title === 'Correction: Beast Wars: Uprising' && w.readSuggestion(made).title === null);
  gh.issues.pop();
  await suggest(await session('TheOwner'), {kind: 'deletion', text: 'Drop it.'});
  // An issue about the code, and a pull request, are not suggestions.
  gh.issues.push({number: gh.issues.length + 1, state: 'open', title: 'A bug', body: 'The build fails.', user: {login: 'someone'}});
  gh.issues.push({number: gh.issues.length + 1, state: 'open', title: 'A PR', pull_request: {}, user: {login: 'someone'},
                  body: made.body});
  r = await call('/suggestions', auth(reader));
  body = await r.json();
  check('the list holds the suggestions and nothing else, each saying whose it is',
        r.status === 200 && body.suggestions.length === 2 && body.owner === false
        && body.suggestions.map(x => x.number + ':' + x.mine).join(',') === '2:false,1:true', JSON.stringify(body).slice(0, 300));

  const resolveIt = (tok, payload) => call('/resolve', {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                           'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  r = await resolveIt(reader, {number: 1});
  check('a reader cannot close a suggestion, their own included', r.status === 403 && gh.issues[0].state === 'open');
  r = await resolveIt(s, {number: 3});
  check('the owner\'s page cannot close an issue that is not a suggestion', r.status === 400 && gh.issues[2].state === 'open');
  r = await resolveIt(s, {number: 1, reason: 'not_planned'});
  check('the owner closes a suggestion, saying why',
        r.status === 200 && gh.issues[0].state === 'closed' && gh.issues[0].state_reason === 'not_planned');
  r = await call('/suggestions', auth(s));
  body = await r.json();
  check('and it leaves the list', body.owner === true && body.suggestions.map(x => x.number).join() === '2');

  /* Anyone with a GitHub account can suggest, so one account is held to a
     few: ten waiting, five an hour, the owner exempt. */
  {
    const keep = gh.issues.slice();
    const old = new Date(Date.now() - 2 * 3600e3).toISOString();
    gh.issues.length = 0;
    const theirs = (state, at) => gh.issues.push({number: gh.issues.length + 1, state, title: 'Addition: x', created_at: at,
      body: w.suggestionBody('x', null, 'addition', false), user: {login: 'a-reader'}});
    for(let i = 0; i < 9; i++) theirs('open', old);
    gh.issues.push({number: gh.issues.length + 1, state: 'open', title: 'A bug', body: 'not a suggestion', user: {login: 'a-reader'}, created_at: old});
    r = await suggest(reader, {kind: 'addition', text: 'the tenth'});
    check('a reader with nine suggestions waiting may make a tenth (an issue about the code is not counted)', r.status === 200, r.status);
    const n = gh.issues.length;
    r = await suggest(reader, {kind: 'addition', text: 'the eleventh'});
    body = await r.json();
    check('but not an eleventh, and is told why', r.status === 429 && gh.issues.length === n && /waiting/.test(body.error), r.status + ' ' + JSON.stringify(body));
    r = await suggest(s, {kind: 'addition', text: 'the owner is not counted'});
    check('the owner is not held to it', r.status === 200 && gh.issues.length === n + 1, r.status);
    gh.issues.length = 0;
    const now = new Date().toISOString();
    for(let i = 0; i < 5; i++) theirs('closed', now);
    r = await suggest(reader, {kind: 'addition', text: 'a sixth in the hour'});
    body = await r.json();
    check('five in an hour, closed again or not, and the sixth waits', r.status === 429 && gh.issues.length === 5 && /hour/.test(body.error),
          r.status + ' ' + JSON.stringify(body));
    gh.issues.forEach(i => { i.created_at = old; });
    r = await suggest(reader, {kind: 'addition', text: 'later on'});
    check('and is taken once the hour has gone by', r.status === 200 && gh.issues.length === 6, r.status);
    gh.issues.length = 0; keep.forEach(i => gh.issues.push(i));
  }

  gh.issuesAllowed = false;
  r = await suggest(reader, {kind: 'addition', text: 'More, please.'});
  body = await r.json();
  check('an app without the Issues permission is named as the reason, not reported as a failure',
        r.status === 403 && /Issues permission/.test(body.error), r.status + ' ' + JSON.stringify(body));
  gh.issuesAllowed = true;

  /* A fault a reader's browser met. Written to the log, as the page's
     sendBeacon sends it: plain text, no session. */
  const logged = [];
  const consoleError = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  const ghBefore = gh.refUpdates;
  const fault = {kind: 'error', message: 'x is not defined', file: SITE + '/app.0123456789abcdef.js',
                 line: 12, col: 34, stack: 'ReferenceError: x is not defined\n    at f', version: '0.15.0', ua: 'a browser',
                 session: 'Bearer good-session'};
  r = await call('/report', {method: 'POST', headers: {Origin: SITE, 'Content-Type': 'text/plain;charset=UTF-8'}, body: JSON.stringify(fault)});
  console.error = consoleError;
  const faultLine = logged.length === 1 ? JSON.parse(logged[0]) : null;
  check('a fault from the site is taken, and nothing is answered but that', r.status === 204 && (await r.text()) === '', r.status);
  check('it is written to the log as one line, with what went wrong and where',
        !!faultLine && faultLine.report === 'page fault' && faultLine.message === fault.message && faultLine.file === fault.file
        && faultLine.line === 12 && faultLine.col === 34 && faultLine.version === '0.15.0', logged.join('\n'));
  check('and only the report\'s own fields — nothing a sender adds rides along', !!faultLine && !('session' in faultLine), logged.join('\n'));
  check('and no one else is asked anything', gh.refUpdates === ghBefore);
  logged.length = 0;
  console.error = (...a) => logged.push(a.join(' '));
  r = await call('/report', {method: 'POST', headers: {Origin: 'https://evil.example'}, body: JSON.stringify(fault)});
  const fromElsewhere = r.status;
  r = await call('/report', {method: 'POST', body: JSON.stringify(fault)});
  const fromNowhere = r.status;
  r = await call('/report', {method: 'POST', headers: {Origin: SITE}, body: JSON.stringify({...fault, stack: 'x'.repeat(9000)})});
  const tooLarge = r.status;
  r = await call('/report', {method: 'POST', headers: {Origin: SITE}, body: JSON.stringify({kind: 'error', message: 'm'.repeat(5000), line: 'twelve'})});
  console.error = consoleError;
  check('a report from another site is refused', fromElsewhere === 403, fromElsewhere);
  check('and one that says no site at all', fromNowhere === 403, fromNowhere);
  check('a report past a few kilobytes is refused', tooLarge === 413, tooLarge);
  const cut = logged.length === 1 ? JSON.parse(logged[0]) : null;
  check('and what is written is cut to length, and a line that is not a number is none',
        r.status === 204 && !!cut && cut.message.length === 500 && cut.line === 0, logged.join('\n'));

  /* The owner's cloud drives (0.26.2). Google and Yandex, in memory:
     what they answer to the calls the service makes, and what was asked. */
  {
    const CENV = {...ENV, GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret', GOOGLE_API_KEY: 'g-key',
                  YANDEX_CLIENT_ID: 'y-id', YANDEX_CLIENT_SECRET: 'y-secret'};
    const ccall = (p, init) => svc.fetch(new Request(SVC + p, init), CENV);
    const asked = [];
    const drive = {
      root: [{id: 'fold1', name: 'Pictures', mimeType: 'application/vnd.google-apps.folder'},
             {id: 'pic1', name: 'Optimus.png', mimeType: 'image/png', thumbnailLink: 'https://lh3.example/t'},
             {id: 'doc1', name: 'Notes.pdf', mimeType: 'application/pdf'},
             {id: 'vid1', name: 'Clip.mp4', mimeType: 'video/mp4'}],
      shared: new Set()
    };
    const disk = {items: [{type: 'file', name: 'b.jpg', path: 'disk:/b.jpg', mime_type: 'image/jpeg'},
                          {type: 'dir', name: 'Folder', path: 'disk:/Folder'},
                          {type: 'file', name: 'a.txt', path: 'disk:/a.txt', mime_type: 'text/plain'}],
                  published: new Map()};
    let grants = 0;
    const jsonRes = (b, st) => new Response(JSON.stringify(b), {status: st || 200, headers: {'Content-Type': 'application/json'}});
    const ghFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const u = new URL(typeof input === 'string' ? input : input.url);
      const auth = (init && init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
      if(u.host === 'oauth2.googleapis.com' || u.host === 'oauth.yandex.ru'){
        const f = new URLSearchParams(init.body);
        asked.push(u.host + ' ' + f.get('grant_type'));
        const pre = u.host === 'oauth.yandex.ru' ? 'y' : 'g';
        if(f.get('grant_type') === 'authorization_code' && f.get('code') === 'good')
          return jsonRes({access_token: pre + '-at-' + (++grants), expires_in: 3600, refresh_token: pre + '-rt'});
        if(f.get('grant_type') === 'refresh_token' && f.get('refresh_token') === pre + '-rt')
          return jsonRes({access_token: pre + '-at-' + (++grants), expires_in: 3600});
        return jsonRes({error: 'invalid_grant'}, 400);
      }
      if(u.host === 'www.googleapis.com'){
        if(u.searchParams.get('alt') === 'media'){
          asked.push('media ' + u.pathname + ' ' + u.searchParams.get('key') + ' ' + ((init && init.headers && init.headers.Range) || ''));
          const id = u.pathname.split('/').pop();
          if(!drive.shared.has(id)) return new Response('no', {status: 404});
          return new Response('PNGBYTES', {status: 200, headers: {'Content-Type': id === 'pic1' ? 'image/png' : 'text/html', 'Content-Length': '8'}});
        }
        if(!/^Bearer g-at-/.test(auth)) return jsonRes({}, 401);
        if(/\/permissions$/.test(u.pathname)){ drive.shared.add(u.pathname.split('/')[4]); asked.push('share ' + init.body); return jsonRes({id: 'anyone'}); }
        if(u.pathname === '/drive/v3/files'){ asked.push('list ' + u.searchParams.get('q')); return jsonRes({files: drive.root}); }
        const f = drive.root.find(x => x.id === u.pathname.split('/').pop());
        return f ? jsonRes(f) : jsonRes({}, 404);
      }
      if(u.host === 'cloud-api.yandex.net'){
        if(u.pathname === '/v1/disk/public/resources/download'){
          const key = u.searchParams.get('public_key');
          return [...disk.published.values()].includes(key) ? jsonRes({href: 'https://downloader.disk.yandex.ru/x?k=' + key}) : jsonRes({}, 404);
        }
        if(!/^OAuth y-at-/.test(auth)) return jsonRes({}, 401);
        const path = u.searchParams.get('path');
        if(u.pathname === '/v1/disk/resources/publish'){ disk.published.set(path, 'pk-' + path); return jsonRes({href: 'x'}); }
        if(path === 'disk:/') return jsonRes({_embedded: {items: disk.items}});
        const f = disk.items.find(x => x.path === path);
        return f ? jsonRes(Object.assign({}, f, disk.published.has(path) ? {public_key: disk.published.get(path)} : {})) : jsonRes({}, 404);
      }
      return ghFetch(input, init);
    };
    const own = await session('TheOwner');
    const post = (p, tok, b) => ccall(p, {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE, 'Content-Type': 'application/json'},
                                          body: JSON.stringify(b || {})});

    r = await call('/me', auth(own));
    body = await r.json();
    check('a service with no drive set up offers none', body.clouds && body.clouds.ready.length === 0, JSON.stringify(body.clouds));
    r = await ccall('/me', auth(own));
    body = await r.json();
    check('one set up for both offers both, connected to neither yet',
          body.clouds && body.clouds.ready.join() === 'gdrive,yadisk' && body.clouds.connected.length === 0, JSON.stringify(body.clouds));
    r = await call('/cloud/gdrive/ticket', {method: 'POST', headers: {Authorization: 'Bearer ' + own, Origin: SITE}});
    check('a drive that is not set up cannot be connected', r.status === 503);
    r = await ccall('/cloud/gdrive/ticket', {method: 'POST', headers: {Origin: SITE}});
    check('connecting a drive needs the owner\'s session', r.status === 401);
    r = await post('/cloud/gdrive/ticket', await session('someone'));
    check('…and not anyone\'s', r.status === 403);

    const connect = async (name, code) => {
      const t = (await (await post('/cloud/' + name + '/ticket', own)).json()).ticket;
      const go = await ccall('/cloud/' + name + '/connect?ticket=' + encodeURIComponent(t));
      const to = go.status === 302 ? new URL(go.headers.get('Location')) : null;
      const back = await ccall('/cloud/' + name + '/back?code=' + code + '&state=' + encodeURIComponent(to ? to.searchParams.get('state') : ''));
      const html = await back.text();
      const m = /"grant":"([^"]+)"/.exec(html);
      return {to, back, html, grant: m && m[1]};
    };
    const g = await connect('gdrive', 'good');
    check('the popup goes to Google\'s consent, asking for the drive, offline, and back to this service',
          !!g.to && g.to.host === 'accounts.google.com' && g.to.searchParams.get('scope') === 'https://www.googleapis.com/auth/drive' &&
          g.to.searchParams.get('access_type') === 'offline' && g.to.searchParams.get('redirect_uri') === SVC + '/cloud/gdrive/back',
          g.to && g.to.toString());
    check('…and comes back with a grant handed only to the site',
          g.back.status === 200 && !!g.grant && g.html.includes(`, "${SITE}")`) && /frame-ancestors 'none'/.test(g.back.headers.get('Content-Security-Policy') || ''),
          g.html.slice(0, 200));
    const forged = await ccall('/cloud/gdrive/back?code=good&state=forged');
    check('a forged return is refused', forged.status === 400);
    r = await post('/cloud/gdrive/attach', await session('TheOwner'), {grant: 'nonsense'});
    check('a grant that is not one is refused', r.status === 400);
    r = await post('/cloud/gdrive/attach', own, {grant: g.grant});
    body = await r.json();
    const withDrive = body.session ? await w.unseal(ENV, 'session', body.session) : null;
    check('attached, the grant goes into the owner\'s session, beside GitHub\'s',
          r.status === 200 && !!withDrive && withDrive.gh === 'tok-owner' && /^g-at-/.test(withDrive.clouds.gdrive.at) && withDrive.clouds.gdrive.rt === 'g-rt',
          JSON.stringify(body).slice(0, 200));
    let tok = body.session;
    r = await post('/cloud/gdrive/list', tok, {});
    body = await r.json();
    check('a folder of the drive lists its folders, pictures and clips, and nothing else',
          r.status === 200 && body.items.map(i => i.kind + ':' + i.name).join() === 'folder:Pictures,image:Optimus.png,video:Clip.mp4',
          JSON.stringify(body));
    r = await post('/cloud/gdrive/list', tok, {folder: "x' or '1'='1"});
    check('…and a folder that is not an id is the drive\'s top, not a question put to Google',
          r.status === 200 && /^list 'root' in parents/.test(asked.filter(a => /^list/.test(a)).pop()), asked.slice(-1)[0]);
    r = await ccall('/cloud/gdrive/file/pic1');
    check('a file not shared by link is not shown by its address', r.status === 404);
    r = await post('/cloud/gdrive/pick', tok, {id: 'doc1'});
    check('a file that is no picture or clip cannot be picked', r.status === 400 && !drive.shared.has('doc1'));
    r = await post('/cloud/gdrive/pick', tok, {id: 'pic1'});
    body = await r.json();
    check('a picture picked is shared by link, and named by its address on this service',
          r.status === 200 && drive.shared.has('pic1') && body.src.indexOf(SVC + '/cloud/gdrive/file/pic1?mark=') === 0 && body.kind === 'image' &&
          asked.includes('share {"role":"reader","type":"anyone"}'), JSON.stringify(body));
    const picSrc = body.src.slice(SVC.length);
    r = await ccall('/cloud/gdrive/file/pic1');
    check('…which without the mark its address was given is nothing, so the service lends itself to no file it was not asked to show',
          r.status === 404 && !asked.some(a => /^media \/drive\/v3\/files\/pic1/.test(a)), r.status);
    r = await ccall(picSrc.replace(/mark=./, m => 'mark=' + (m.slice(-1) === 'A' ? 'B' : 'A')));
    check('…and nor is it with a mark that is not this service\'s', r.status === 404, r.status);
    r = await ccall('/cloud/gdrive/file/doc1?mark=' + new URL(SVC + picSrc).searchParams.get('mark'));
    check('…nor with another file\'s mark', r.status === 404, r.status);
    r = await ccall(picSrc, {headers: {Range: 'bytes=0-3'}});
    check('…which anyone\'s browser is answered at, with the file, read with the service\'s key, the range passed on',
          r.status === 200 && (await r.text()) === 'PNGBYTES' && r.headers.get('Content-Type') === 'image/png' &&
          r.headers.get('Access-Control-Allow-Origin') === '*' && asked.includes('media /drive/v3/files/pic1 g-key bytes=0-3'),
          asked.filter(a => /^media/.test(a)).join(' | '));
    drive.shared.add('doc1');
    r = await ccall('/cloud/gdrive/file/doc1?mark=' + await w.fileMark(ENV, 'gdrive', 'doc1'));
    check('…and only a picture or a clip: a page shared by link is not passed on', r.status === 404);
    /* The drive's token runs out within the hour; the session carries what
       renews it. */
    const stale = await w.seal(ENV, 'session', Object.assign({}, withDrive, {clouds: {gdrive: {at: 'g-at-old', atExp: Date.now() - 1000, rt: 'g-rt'}}}));
    r = await post('/cloud/gdrive/list', stale, {});
    body = await r.json();
    const fresh = body.session ? await w.unseal(ENV, 'session', body.session) : null;
    check('a drive\'s token that ran out is renewed, and the session that holds the new one handed back',
          r.status === 200 && !!fresh && /^g-at-\d/.test(fresh.clouds.gdrive.at) && fresh.clouds.gdrive.rt === 'g-rt', JSON.stringify(fresh && fresh.clouds));
    const dead = await w.seal(ENV, 'session', Object.assign({}, withDrive, {clouds: {gdrive: {at: 'x', atExp: 0, rt: 'revoked'}}}));
    r = await post('/cloud/gdrive/list', dead, {});
    body = await r.json();
    const dropped = body.session ? await w.unseal(ENV, 'session', body.session) : null;
    check('…and one the drive will not renew is let go, and the owner asked to connect again',
          r.status === 409 && /connect it again/.test(body.error) && !!dropped && !dropped.clouds.gdrive && dropped.gh === 'tok-owner', JSON.stringify(body).slice(0, 160));
    /* GitHub's renewal keeps the drives. */
    const both = await w.seal(ENV, 'session', {login: 'TheOwner', gh: 'tok-lapsed', ghExp: Date.now() - 1000, rt: [...gh.refresh][0],
                                               exp: Date.now() + 86400000, clouds: withDrive.clouds});
    r = await ccall('/me', auth(both));
    body = await r.json();
    const kept = body.session ? await w.unseal(ENV, 'session', body.session) : null;
    check('a session renewed by GitHub keeps the drives connected to it',
          r.status === 200 && !!kept && kept.clouds && !!kept.clouds.gdrive && body.clouds.connected.join() === 'gdrive', JSON.stringify(body.clouds));

    const y = await connect('yadisk', 'good');
    check('Yandex Disk connects the same way, through its own consent',
          !!y.to && y.to.host === 'oauth.yandex.ru' && y.to.searchParams.get('redirect_uri') === SVC + '/cloud/yadisk/back' && !!y.grant);
    r = await post('/cloud/yadisk/attach', tok, {grant: y.grant});
    body = await r.json();
    tok = body.session;
    check('…and joins the drive already connected', r.status === 200 && body.connected.join() === 'gdrive,yadisk', JSON.stringify(body));
    r = await post('/cloud/yadisk/list', tok, {});
    body = await r.json();
    check('a Yandex folder lists its folders first, then its pictures and clips',
          r.status === 200 && body.items.map(i => i.kind + ':' + i.name).join() === 'folder:Folder,image:b.jpg', JSON.stringify(body));
    r = await post('/cloud/yadisk/pick', tok, {id: 'disk:/b.jpg'});
    body = await r.json();
    check('a Yandex file picked is published, and named by its public key',
          r.status === 200 && disk.published.get('disk:/b.jpg') === 'pk-disk:/b.jpg' &&
          body.src.indexOf(SVC + '/cloud/yadisk/file?key=' + encodeURIComponent('pk-disk:/b.jpg') + '&mark=') === 0, JSON.stringify(body));
    r = await ccall('/cloud/yadisk/file?key=' + encodeURIComponent('pk-disk:/b.jpg'));
    check('…which without its mark is nothing', r.status === 404, r.status);
    r = await ccall(body.src.slice(SVC.length));
    check('…and its address sends the browser on to Yandex\'s download', r.status === 302 && /^https:\/\/downloader\.disk\.yandex\.ru\//.test(r.headers.get('Location')));
    r = await ccall('/cloud/yadisk/file?key=nothing-published&mark=' + await w.fileMark(ENV, 'yadisk', 'nothing-published'));
    check('…while a key Yandex does not know is nothing', r.status === 404);
    r = await post('/cloud/yadisk/forget', tok);
    body = await r.json();
    check('a drive let go is out of the session', r.status === 200 && body.connected.join() === 'gdrive' &&
          !(await w.unseal(ENV, 'session', body.session)).clouds.yadisk);
    globalThis.fetch = ghFetch;
  }

  /* Faults, counted. The log keeps them three days; the namespace keeps
     them until the owner has read them. */
  const kv = new Map();
  const FAULTS = {
    get: async k => kv.has(k) ? kv.get(k) : null,
    put: async (k, v) => { if(FAULTS.full) throw new Error('KV put() limit exceeded for the day.'); kv.set(k, v); },
    delete: async k => { kv.delete(k); },
    list: async ({prefix}) => ({keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({name}))})
  };
  const KENV = {...ENV, FAULTS};
  const report = (env, b) => svc.fetch(new Request(SVC + '/report', {method: 'POST', headers: {Origin: SITE}, body: JSON.stringify(b)}), env);
  console.error = () => {};
  for(let i = 0; i < 3; i++) await report(KENV, {...fault, version: '0.26.' + i});
  await report(KENV, {...fault, stack: 'reached another way'});
  await report(KENV, {...fault, message: 'a second fault'});
  FAULTS.full = true;
  r = await report(KENV, {...fault, message: 'a third, on a day the writes ran out'});
  FAULTS.full = false;
  console.error = consoleError;
  check('a fault is still taken when the count cannot be written', r.status === 204, r.status);
  {
    // A flood: the day's tally is full, so a new fault is logged and not counted.
    const today = new Date().toISOString().slice(0, 10);
    kv.set('day:' + today, '200');
    const before = [...kv.keys()].length;
    console.error = () => {};
    r = await report(KENV, {...fault, message: 'one of a thousand sent by a script'});
    console.error = consoleError;
    check('past the day\'s reports a fault is still taken, and not counted, so a flood can neither bury the list nor spend the day\'s writes',
          r.status === 204 && [...kv.keys()].length === before && kv.get('day:' + today) === '200', [...kv.keys()].join());
    kv.delete('day:' + today);
    const fresh = await w.withinFaultBudget(FAULTS, '2000-01-01');
    check('…while a day under its tally counts, one more each report', fresh === true && kv.get('day:2000-01-01') === '1', kv.get('day:2000-01-01'));
    kv.delete('day:2000-01-01');
  }
  const owners = (tok, p, init) => svc.fetch(new Request(SVC + p, Object.assign({headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                              'Content-Type': 'application/json'}}, init || {})), KENV);
  r = await owners(s, '/faults');
  body = await r.json();
  const first = body.faults && body.faults.find(f => f.message === fault.message);
  check('the same fault met four times is one line of the list, counted four times',
        r.status === 200 && body.kept === true && body.faults.length === 2 && !!first && first.count === 4, JSON.stringify(body).slice(0, 300));
  check('and it holds what the newest report of it said, and when it was first and last met',
        !!first && first.version === fault.version && first.stack === 'reached another way' && !!first.first && first.last >= first.first, JSON.stringify(first));
  r = await owners(reader, '/faults');
  check('a reader cannot read the list', r.status === 403, r.status);
  r = await svc.fetch(new Request(SVC + '/faults', {headers: {Origin: SITE}}), KENV);
  check('nor can anyone not signed in', r.status === 401, r.status);
  r = await owners(reader, '/faults/clear', {method: 'POST', body: JSON.stringify({all: true})});
  check('nor clear it', r.status === 403 && kv.size === 2, r.status);
  r = await owners(s, '/faults/clear', {method: 'POST', body: JSON.stringify({key: first.key})});
  body = await r.json();
  check('the owner takes one fault off the list', r.status === 200 && body.cleared === 1 && kv.size === 1, JSON.stringify(body));
  r = await owners(s, '/faults/clear', {method: 'POST', body: JSON.stringify({key: '../../anything'})});
  check('and only by a name a fault can have', r.status === 400 && kv.size === 1, r.status);
  r = await owners(s, '/faults/clear', {method: 'POST', body: JSON.stringify({all: true})});
  check('or all of them', r.status === 200 && kv.size === 0);
  r = await call('/faults', auth(s));
  body = await r.json();
  check('a service with no namespace says it keeps none, and lists none', r.status === 200 && body.kept === false && body.faults.length === 0,
        JSON.stringify(body));

  /* An editor: someone the owner writes the chart with. */
  const EENV = {...ENV, EDITORS: 'someone, TheOwner'};
  const asEditor = (p, init) => svc.fetch(new Request(SVC + p, init), EENV);
  const ed = await session('someone');
  r = await asEditor('/me', auth(ed));
  body = await r.json();
  check('an editor is told so, and is not an owner', r.status === 200 && body.editor === true && body.owner === false && !!body.sha,
        JSON.stringify(body));
  r = await asEditor('/me', auth(s));
  body = await r.json();
  check('an owner listed among the editors is still the owner', body.owner === true && !body.editor, JSON.stringify(body));
  const edReader = await w.seal(ENV, 'session', {login: 'someone', as: 'reader', gh: 'tok-other', exp: Date.now() + 60000});
  r = await asEditor('/me', auth(edReader));
  body = await r.json();
  check('a reader\'s session of a login in EDITORS is an editor\'s', body.editor === true, JSON.stringify(body));
  r = await call('/me', auth(edReader));
  body = await r.json();
  check('and a reader\'s again once the login is taken out', r.status === 200 && !body.editor && body.owner === false, JSON.stringify(body));
  const edHead = gh.dataAt(gh.head);
  const edPost = (tok, payload) => asEditor('/save', {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                             'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  r = await edPost(ed, {base: gitSha(edHead), chart: edit(edHead, c => c.refs.push({key: 'by-editor', title: 'Added by an editor'}))});
  body = await r.json();
  check('an editor\'s edit becomes a commit', r.status === 200 && gh.dataAt(gh.head).includes('Added by an editor') && !body.settingsKept,
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  const before = gh.dataAt(gh.head);
  r = await edPost(ed, {base: gitSha(before), chart: edit(before, c => {
    c.refs.push({key: 'by-editor-2', title: 'And another'});
    c.settings = Object.assign({}, c.settings, {refColor: '#000000'});
  })});
  body = await r.json();
  const saved = gh.dataAt(gh.head);
  check('an editor\'s save keeps the repository\'s settings, and the rest of the edit',
        r.status === 200 && saved.includes('And another') && JSON.stringify(JSON.parse(saved).settings) === JSON.stringify(JSON.parse(before).settings),
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  check('and says so, with the chart as saved, so the page shows the settings that stand',
        body.settingsKept === true && body.merged === true && body.chart === saved, JSON.stringify(body).slice(0, 200));
  const reordered = edit(saved, c => { c.settings = Object.fromEntries(Object.entries(c.settings || {}).reverse()); c.refs.push({key: 'by-editor-3', title: 'Third'}); });
  r = await edPost(ed, {base: gitSha(saved), chart: reordered});
  body = await r.json();
  check('the same settings written in another order are not a change', r.status === 200 && !body.settingsKept, JSON.stringify(body).slice(0, 200));
  r = await edPost(await session('a-stranger'), {base: gitSha(gh.dataAt(gh.head)), chart: gh.dataAt(gh.head)});
  check('a login in neither list still cannot save', r.status === 403);
  r = await asEditor('/resolve', {method: 'POST', headers: {Authorization: 'Bearer ' + ed, Origin: SITE, 'Content-Type': 'application/json'},
                                  body: JSON.stringify({number: 2})});
  check('an editor cannot close a suggestion', r.status === 403, r.status);
  r = await asEditor('/faults', auth(ed));
  check('nor read the faults', r.status === 403, r.status);
  r = await asEditor('/login?origin=' + encodeURIComponent(SITE));
  const st2 = new URL(r.headers.get('Location')).searchParams.get('state');
  r = await asEditor(`/callback?code=code-other&state=${st2}`);
  const edHtml = await r.text();
  const edHanded = /"rhizomeSession":"([^"]+)"/.exec(edHtml);
  const edSealed = edHanded ? await w.unseal(ENV, 'session', edHanded[1]) : null;
  check('an editor signing in gets a session, sealed as a reader\'s so that it is only ever as much as the lists say',
        r.status === 200 && !!edSealed && edSealed.login === 'someone' && edSealed.as === 'reader', r.status + ' ' + edHtml.slice(0, 200));

  /* An editor's save made by the app (0.27.1): an editor with no access to
     the repository, a token for the installation that writes contents and
     nothing else, and the owner's saves still the owner's. The key is the
     PKCS#1 .pem GitHub hands out, which WebCrypto does not read as it is. */
  {
    const {privateKey, publicKey} = nodeCrypto.generateKeyPairSync('rsa', {modulusLength: 2048});
    const pem = privateKey.export({type: 'pkcs1', format: 'pem'});
    check('a PKCS#1 key is read as the PKCS#8 it is wrapped into',
          Buffer.from(w.pkcs8Of(pem)).equals(privateKey.export({type: 'pkcs8', format: 'der'})));
    const AENV = {...EENV, GITHUB_APP_ID: '12345', GITHUB_APP_PRIVATE_KEY: pem.replace(/\n/g, '\\n')};
    const plain = globalThis.fetch;
    const asked = [];
    globalThis.fetch = async (url, init) => {
      const u = new URL(url), auth = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', '');
      if(u.pathname === '/repos/owner/site/installation' || /^\/app\/installations\//.test(u.pathname)){
        const [h, b, sig] = auth.split('.');
        const good = !!sig && nodeCrypto.verify('sha256', Buffer.from(h + '.' + b), publicKey, Buffer.from(sig, 'base64url'));
        const claims = good ? JSON.parse(Buffer.from(b, 'base64url')) : {};
        asked.push({path: u.pathname, good, iss: claims.iss, body: init && init.body ? JSON.parse(init.body) : null});
        if(!good || claims.iss !== '12345' || claims.exp - claims.iat > 600) return new Response('{}', {status: 401});
        if(u.pathname.endsWith('/installation')) return new Response(JSON.stringify({id: 77}), {status: 200});
        return new Response(JSON.stringify({token: 'tok-app'}), {status: 201});
      }
      if(u.pathname === '/repos/owner/site/git/refs/heads/main') asked.push({path: 'ref', by: auth});
      return plain(url, init);
    };
    gh.users['tok-app'] = 'rhizome[bot]';
    const before = gh.dataAt(gh.head);
    r = await svc.fetch(new Request(SVC + '/save', {method: 'POST', headers: {Authorization: 'Bearer ' + ed, Origin: SITE,
      'Content-Type': 'application/json'}, body: JSON.stringify({base: gitSha(before), chart: edit(before, c => c.refs.push({key: 'by-app', title: 'Through the app'}))})}), AENV);
    body = await r.json();
    const tokAsk = asked.find(a => /access_tokens$/.test(a.path));
    check('an editor\'s save is committed with the app\'s installation token',
          r.status === 200 && gh.dataAt(gh.head).includes('Through the app') && asked.some(a => a.path === 'ref' && a.by === 'tok-app'),
          r.status + ' ' + JSON.stringify(body).slice(0, 200) + ' ' + JSON.stringify(asked));
    check('a token for this repository alone, that writes its contents and nothing else',
          !!tokAsk && tokAsk.path === '/app/installations/77/access_tokens' && JSON.stringify(tokAsk.body) === JSON.stringify({repositories: ['site'], permissions: {contents: 'write'}}),
          JSON.stringify(tokAsk));
    asked.length = 0;
    const now2 = gh.dataAt(gh.head);
    r = await svc.fetch(new Request(SVC + '/save', {method: 'POST', headers: {Authorization: 'Bearer ' + s, Origin: SITE,
      'Content-Type': 'application/json'}, body: JSON.stringify({base: gitSha(now2), chart: edit(now2, c => c.refs.push({key: 'by-owner-app', title: 'The owner, as ever'}))})}), AENV);
    check('the owner\'s save is still made with the owner\'s own token',
          r.status === 200 && asked.some(a => a.path === 'ref' && a.by === 'tok-owner') && !asked.some(a => /installation/.test(a.path)),
          r.status + ' ' + JSON.stringify(asked));
    const now3 = gh.dataAt(gh.head);
    r = await svc.fetch(new Request(SVC + '/save', {method: 'POST', headers: {Authorization: 'Bearer ' + ed, Origin: SITE,
      'Content-Type': 'application/json'}, body: JSON.stringify({base: gitSha(now3), chart: now3 + ' '})}), {...AENV, GITHUB_APP_PRIVATE_KEY: 'not a key'});
    body = await r.json();
    check('a key the service cannot read is named, not reported as a failure', r.status === 503 && /GITHUB_APP_PRIVATE_KEY/.test(body.error), JSON.stringify(body));
    globalThis.fetch = plain;
  }

  /* The marks on a drive file's address outlive a change of SESSION_SECRET
     once FILE_MARK_SECRET holds its old value. */
  {
    const old = await w.fileMark(ENV, 'gdrive', 'pic1');
    const moved = {...ENV, SESSION_SECRET: 'a-wholly-new-session-secret-after-a-leak', FILE_MARK_SECRET: ENV.SESSION_SECRET};
    check('a mark made before is still good after SESSION_SECRET changes, with FILE_MARK_SECRET set to the old one',
          await w.fileMarkOk(moved, 'gdrive', 'pic1', old));
    check('and without it, it is not', !(await w.fileMarkOk({...moved, FILE_MARK_SECRET: ''}, 'gdrive', 'pic1', old)));
  }

  /* Notes in the margin, stroke by stroke. */
  {
    const S = n => ({pts: [n, n, n + 1, n + 1]});
    const got = w.mergeStrokes([S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(4)]);
    check('strokes merge one by one: theirs drawn, mine drawn, mine rubbed out',
          JSON.stringify(got) === JSON.stringify([S(2), S(3), S(4)]), JSON.stringify(got));
    check('two strokes exactly alike are two strokes',
          w.mergeStrokes([S(1)], [S(1), S(1)], [S(1)]).length === 2 && w.mergeStrokes([S(1), S(1)], [S(1), S(1)], [S(1)]).length === 1);
    const base = JSON.parse(DATA);
    base.settings = Object.assign({}, base.settings, {ink: [S(1)]});
    const theirs = JSON.parse(JSON.stringify(base)); theirs.settings.ink.push(S(2));
    const mine = JSON.parse(JSON.stringify(base)); mine.settings.ink.push(S(3));
    let merged = null, refused = null;
    try{ merged = w.mergeCharts(base, theirs, mine); }catch(e){ refused = e; }
    check('two devices that each drew a stroke do not collide',
          !refused && JSON.stringify(merged.settings.ink) === JSON.stringify([S(1), S(2), S(3)]), refused ? JSON.stringify(refused.conflicts) : '');
    const mineEd = JSON.parse(JSON.stringify(base)); mineEd.settings.refColor = '#123456'; mineEd.settings.ink.push(S(9));
    const kept = w.keepSettings(mineEd, w.chartText(base));
    check('an editor\'s strokes go on with the save, while the rest of the settings stay the repository\'s',
          kept === true && mineEd.settings.refColor === base.settings.refColor && mineEd.settings.ink.length === 2,
          JSON.stringify(mineEd.settings).slice(0, 200));
    const onlyInk = JSON.parse(JSON.stringify(base)); onlyInk.settings.ink.push(S(9));
    check('and a save that changed only strokes is not told its settings were kept', w.keepSettings(onlyInk, w.chartText(base)) === false);
  }

  /* A save says what it changed, so the history of edits says something. */
  {
    const c = JSON.parse(DATA);
    c.nodes[0] = Object.assign({}, c.nodes[0], {label: 'renamed'});
    c.nodes.push({id: 'new-one', label: 'New'}, {id: 'new-two', label: 'Newer'});
    check('a commit is named by what it changed',
          w.saveTitle(DATA, w.chartText(c), 0) === 'Chart: 2 entries added, 1 entry changed', w.saveTitle(DATA, w.chartText(c), 0));
    check('and a save of only a picture says so', w.saveTitle(DATA, DATA, 1) === 'Chart: a picture');
    check('a file that does not read is named as it always was', w.saveTitle('nonsense', DATA, 0) === 'Save the chart from the site');
  }

  /* The configuration. The three secrets live in Cloudflare; written into
     wrangler.toml they would be public, and would collide with the real
     ones. It happened once, with placeholder values. */
  const toml = fs.readFileSync(path.join(ROOT, 'worker', 'wrangler.toml'), 'utf8');
  const leaked = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET', 'FILE_MARK_SECRET', 'GITHUB_APP_PRIVATE_KEY',
                  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_API_KEY', 'YANDEX_CLIENT_ID', 'YANDEX_CLIENT_SECRET']
    .filter(k => new RegExp('^\\s*' + k + '\\s*=', 'm').test(toml));
  check('wrangler.toml sets none of the service\'s secrets', leaked.length === 0, leaked.join(', '));

  /* A secret missing in Cloudflare is named, not reported as a failure of
     the service — the first sign-in on the real site came back as "the save
     service failed." and said nothing about where to look. */
  const bare = {...ENV}; delete bare.SESSION_SECRET;
  r = await svc.fetch(new Request(SVC + '/login?origin=' + encodeURIComponent(SITE)), bare);
  body = await r.json();
  check('a missing secret is named by the service', r.status === 503 && /SESSION_SECRET/.test(body.error), JSON.stringify(body));
  check('and no configured value is in the answer, only names',
        [bare.GITHUB_CLIENT_ID, bare.GITHUB_CLIENT_SECRET, bare.OWNERS].every(v => !body.error.includes(v)));
  r = await svc.fetch(new Request(SVC + '/me'), {...ENV, SESSION_SECRET: 'short'});
  body = await r.json();
  check('a SESSION_SECRET too short to count is named too', r.status === 503 && /SESSION_SECRET/.test(body.error));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
