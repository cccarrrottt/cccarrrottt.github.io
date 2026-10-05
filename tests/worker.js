#!/usr/bin/env node
/* The write service, against a GitHub that lives in this process.
 *
 *   node tests/worker.js
 *
 * worker/index.js is the one piece of this project that decides who may
 * change the published chart, so what it REFUSES matters more than what it
 * does: a session it did not seal, a login that is not the owner, a sign-in
 * that would hand the session to another site, a page saving on top of an
 * older data.js. Each is driven through the service's own fetch handler,
 * exactly as Cloudflare calls it, with GitHub's API answered from memory.
 *
 * And the one thing it does, it has to do exactly as the page and build.py
 * do it: a save of the chart as it already is changes nothing, and a save
 * of an edit changes that region and no other byte of src/data.js.
 */
const fs = require('fs'), path = require('path'), nodeCrypto = require('crypto');

let pass = 0, fail = 0;
function check(name, ok, detail){
  (ok ? pass++ : fail++);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`);
}

const ROOT = path.join(__dirname, '..');
const DATA = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
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
              users: {'tok-owner': 'TheOwner', 'tok-other': 'someone'}, refUpdates: 0, raceNext: false};
  const blob = text => { const sha = gitSha(text); gh.blobs.set(sha, text); return sha; };
  const tree = entries => { const sha = nodeCrypto.createHash('sha1').update(JSON.stringify(entries)).digest('hex');
                            gh.trees.set(sha, entries); return sha; };
  const srcTree = tree([{path: 'data.js', type: 'blob', sha: blob(DATA)}]);
  const root = tree([{path: 'src', type: 'tree', sha: srcTree}, {path: 'README.md', type: 'blob', sha: blob('readme')}]);
  gh.head = 'c0'; gh.commits.set('c0', {tree: root});
  gh.dataAt = commit => {
    const top = gh.trees.get(gh.commits.get(commit).tree);
    const src = gh.trees.get(top.find(e => e.path === 'src').sha);
    return gh.blobs.get(src.find(e => e.path === 'data.js').sha);
  };
  gh.fetch = async (url, init) => {
    const u = new URL(url), method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    const auth = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', '');
    const ok = v => new Response(JSON.stringify(v), {status: 200});
    if(u.host === 'github.com' && u.pathname === '/login/oauth/access_token'){
      return ok(body.code === 'code-owner' ? {access_token: 'tok-owner', expires_in: 28800}
              : body.code === 'code-other' ? {access_token: 'tok-other'} : {error: 'bad_verification_code'});
    }
    if(!gh.users[auth]) return new Response('{}', {status: 401});
    const p = u.pathname.replace('/repos/owner/site', '');
    if(p === '/user') return ok({login: gh.users[auth]});
    if(p === '/git/ref/heads/main') return ok({object: {sha: gh.head}});
    let m;
    if((m = /^\/git\/commits\/(.+)$/.exec(p))) return ok({tree: {sha: gh.commits.get(m[1]).tree}});
    if((m = /^\/git\/trees\/(.+)$/.exec(p))) return ok({tree: gh.trees.get(m[1])});
    if((m = /^\/git\/blobs\/(.+)$/.exec(p))){
      const b64 = Buffer.from(gh.blobs.get(m[1]), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
      return ok({content: b64, encoding: 'base64'});
    }
    if(p === '/git/blobs' && method === 'POST') return ok({sha: blob(body.content)});
    if(p === '/git/trees' && method === 'POST'){
      const top = gh.trees.get(body.base_tree).map(e => ({...e}));
      const src = top.find(e => e.path === 'src');
      src.sha = tree([{path: 'data.js', type: 'blob', sha: body.tree[0].sha}]);
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

/* The regions as the page sends them: the text between each pair of markers. */
function partsOf(text){
  const out = {};
  for(const name of ['NODES', 'COMMENTS', 'STICKERS', 'MEDIA', 'EDGESTYLES', 'TAGCATS', 'REFS', 'SETTINGS']){
    const a = `/* @@EDIT:${name}:START@@ */`, b = `/* @@EDIT:${name}:END@@ */`;
    out[name] = text.slice(text.indexOf(a) + a.length, text.indexOf(b)).replace(/^\n/, '').replace(/\n$/, '');
  }
  return out;
}

(async () => {
  const w = await import(path.join(ROOT, 'worker', 'index.js'));
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

  /* Who is this. */
  const auth = tok => ({headers: {Authorization: 'Bearer ' + tok, Origin: SITE}});
  r = await call('/me', {headers: {Origin: SITE}});
  check('with no session, /me says so', r.status === 401);
  r = await call('/me', auth(s));
  let body = await r.json();
  check('the owner is told so, with the data.js that is current', r.status === 200 && body.owner && body.sha === gitSha(DATA),
        JSON.stringify(body));
  check('and the answer is readable by the site', r.headers.get('Access-Control-Allow-Origin') === SITE);
  r = await call('/me', {headers: {Authorization: 'Bearer ' + s, Origin: 'https://evil.example'}});
  check('but not by any other site', r.headers.get('Access-Control-Allow-Origin') === null);
  r = await call('/me', auth(await session('someone')));
  check('a session for a login that is not an owner is refused', r.status === 403);

  /* Saving. */
  const post = (tok, payload) => call('/save', {method: 'POST', headers: {Authorization: 'Bearer ' + tok, Origin: SITE,
                                       'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  const parts = partsOf(DATA);
  r = await post(s, {base: gitSha(DATA), parts});
  body = await r.json();
  check("saving the chart as it is commits nothing", r.status === 200 && body.unchanged && gh.refUpdates === 0, r.status + " " + JSON.stringify(body));

  const edited = {...parts, REFS: parts.REFS + '\n/* a reference added in the browser */'};
  r = await post(s, {base: '0000', parts: edited});
  check('a page that is behind the repository cannot save', r.status === 409 && gh.head === 'c0');

  r = await post(s, {base: gitSha(DATA), parts: {...edited, MEDIA: undefined}});
  check('a save missing a region is refused', r.status === 400 && gh.head === 'c0');
  r = await post(s, {base: gitSha(DATA), parts: {...edited, NODES: parts.NODES + '/* @@EDIT:NODES:END@@ */'}});
  check('and so is one that carries a region marker in its text', r.status === 400 && gh.head === 'c0');
  r = await post(await session('someone'), {base: gitSha(DATA), parts: edited});
  check('a login that is not an owner cannot save', r.status === 403 && gh.head === 'c0');

  gh.raceNext = true;
  r = await post(s, {base: gitSha(DATA), parts: edited});
  check('a push that lands during a save makes it fail, not overwrite', r.status === 409 && gh.head === 'c0');

  r = await post(s, {base: gitSha(DATA), parts: edited});
  body = await r.json();
  const after = gh.dataAt(gh.head);
  check('an edit becomes a commit on the branch', r.status === 200 && gh.head !== 'c0', JSON.stringify(body));
  check('which answers with the new data.js, so the next save stacks on it', body.sha === gitSha(after));
  check('the edit is in it', after.includes('/* a reference added in the browser */'));
  check('and nothing else in the file moved',
        after.replace('\n/* a reference added in the browser */', '') === DATA);

  r = await post(s, {base: gitSha(DATA), parts});
  check('the page\'s old base is now refused, so it cannot undo that save', r.status === 409);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
