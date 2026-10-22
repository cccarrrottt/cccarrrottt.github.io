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
  const srcTree = tree([{path: 'data.js', type: 'blob', sha: blob(DATA)}]);
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
    return gh.blobs.get(src.find(e => e.path === 'data.js').sha);
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
        const n = Number(u.searchParams.get('page') || 1);
        const open = gh.issues.filter(i => i.state === 'open').slice().reverse();
        return ok(open.slice((n - 1) * 100, n * 100));
      }
      if(p === '/issues' && method === 'POST'){
        const issue = {number: gh.issues.length + 1, state: 'open', title: body.title, body: body.body,
                       user: {login: gh.users[auth]}, created_at: '2026-10-17T12:00:00Z',
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
  check('the owner is told so, with the data.js that is current', r.status === 200 && body.owner && body.sha === gitSha(DATA),
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
                 'Content-Type': 'application/json'}, body: JSON.stringify({base: '0000', parts: {...partsOf(DATA), REFS: partsOf(DATA).REFS + '\n/* behind */'}})});
  body = await r.json();
  check('a save that is refused still hands back the session it renewed, which is all that can renew it now',
        r.status === 409 && !!body.session && !!(await w.unseal(ENV, 'session', body.session)), r.status + ' ' + JSON.stringify(body).slice(0, 120));

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
  body = await r.json();
  check('the page\'s old base, sending the chart it was made on, cannot undo that save',
        r.status === 200 && body.unchanged && gitSha(gh.dataAt(gh.head)) === gitSha(after), r.status + ' ' + JSON.stringify(body).slice(0, 200));
  const headBefore = gh.head;
  r = await post(s, {base: gitSha(DATA), parts: edited});
  body = await r.json();
  check('but that same save sent again on the old base — its answer lost on the way — is not a conflict',
        r.status === 200 && body.unchanged && body.sha === gitSha(after) && gh.head === headBefore, r.status + ' ' + JSON.stringify(body));

  /* Pictures, which go beside the chart as files named by their hash. */
  const picture = Buffer.from('not really a png, but bytes all the same');
  const picHex = nodeCrypto.createHash('sha256').update(picture).digest('hex');
  const picRef = 'media/' + picHex + '.png';
  const withPic = {...edited, MEDIA: edited.MEDIA + `\n/* {src:'${picRef}'} */`};
  let picHead = gh.head;
  r = await post(s, {base: gitSha(after), parts: withPic, media: {[picRef]: Buffer.from('other bytes').toString('base64')}});
  check('a picture whose bytes are not what its name says is refused', r.status === 400 && gh.head === picHead);
  r = await post(s, {base: gitSha(after), parts: withPic, media: {['media/' + picHex + '.exe']: picture.toString('base64')}});
  check('and so is one named as no picture may be', r.status === 400 && gh.head === picHead);
  r = await post(s, {base: gitSha(after), parts: withPic});
  body = await r.json();
  check('a chart naming a picture the repository does not have, and not sending it, is refused',
        r.status === 400 && gh.head === picHead && /does not have/.test(body.error), r.status + ' ' + JSON.stringify(body));
  r = await post(s, {base: gitSha(after), parts: withPic, media: {[picRef]: picture.toString('base64')}});
  body = await r.json();
  const landed = gh.mediaAt(gh.head);
  check('a new picture is committed beside the chart, in the same commit',
        r.status === 200 && gh.head !== picHead && landed.has(picHex + '.png') && Buffer.compare(landed.get(picHex + '.png'), picture) === 0
        && gh.dataAt(gh.head).includes(picRef), r.status + ' ' + JSON.stringify(body));
  const withPicSha = body.sha;
  picHead = gh.head;
  const blobsBefore = gh.pictureBlobs;
  const again = {...withPic, REFS: withPic.REFS + '\n/* and one more edit */'};
  r = await post(s, {base: withPicSha, parts: again, media: {[picRef]: picture.toString('base64')}});
  body = await r.json();
  check('a picture already in the folder is not written again', r.status === 200 && gh.head !== picHead && gh.pictureBlobs === blobsBefore,
        r.status + ' ' + JSON.stringify(body));
  picHead = gh.head;
  r = await post(s, {base: body.sha, parts: {...again, NODES: again.NODES + `\n/* {image:'${picRef}'} */`}});
  check('and a chart may name one that is there without sending it', r.status === 200 && gh.head !== picHead);

  /* Two saves made on one chart: a second device, or a phone's kept Save
     sent days later. What each changed is put together; only what both
     changed is refused. */
  r = await post(s, {base: gitSha(gh.dataAt(gh.head)), parts: partsOf(DATA)});
  const clean = (await r.json()).sha;
  check('(a clean chart to merge on)', r.status === 200 && gitSha(gh.dataAt(gh.head)) === clean);
  const P = partsOf(DATA);
  const line = (region, re) => P[region].split('\n').find(l => re.test(l));
  const refLine = line('REFS', /^  \{key:'ref',/), nodeLine = line('NODES', /^  \{id:'uprising-copy',/);
  const addTo = (parts, region, l) => ({...parts, [region]: parts[region].replace(/\n\];$/, '\n' + l + '\n];')});
  const one = addTo(P, 'REFS', "  {key:'m-one', title:'One'},");
  r = await post(s, {base: clean, parts: one});
  const firstSave = await r.json();
  check('(one device saves a reference)', r.status === 200 && !firstSave.merged);
  const two = addTo(P, 'NODES', "  {id:'m-two', label:'Two'},");
  r = await post(s, {base: clean, parts: two});
  body = await r.json();
  const merged = gh.dataAt(gh.head);
  check('a save made on the older chart is merged with it rather than refused',
        r.status === 200 && body.merged && merged.includes("{key:'m-one', title:'One'}") && merged.includes("{id:'m-two', label:'Two'}"),
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  check('and nothing else in the file moved',
        merged.replace("\n  {id:'m-two', label:'Two'},", '').replace("\n  {key:'m-one', title:'One'},", '') === gh.blobs.get(clean));
  check('the answer carries the chart as merged, and what it was saved over',
        !!body.parts && body.parts.REFS.includes("key:'m-one'") && body.parts.NODES.includes("id:'m-two'") && body.over === firstSave.sha,
        JSON.stringify({over: body.over, first: firstSave.sha}));
  const mergedSha = body.sha;
  // The same entry changed on both: refused, and named.
  const mine = {...P, REFS: P.REFS.replace(refLine, refLine.replace("title:''", "title:'Mine'"))};
  const theirs = {...body.parts, REFS: body.parts.REFS.replace(refLine, refLine.replace("title:''", "title:'Theirs'"))};
  r = await post(s, {base: mergedSha, parts: theirs});
  const theirsSave = await r.json();
  check('(the other device retitles a reference)', r.status === 200);
  const headMine = gh.head;
  r = await post(s, {base: clean, parts: mine});
  body = await r.json();
  check('the same entry changed differently on both is refused, and named',
        r.status === 409 && gh.head === headMine && Array.isArray(body.conflicts) &&
        body.conflicts.length === 1 && body.conflicts[0].region === 'REFS' && body.conflicts[0].item === 'ref',
        r.status + ' ' + JSON.stringify(body));
  // Changed the same way on both: no conflict at all.
  const same = {...P, REFS: P.REFS.replace(refLine, refLine.replace("title:''", "title:'Theirs'"))};
  r = await post(s, {base: clean, parts: same});
  body = await r.json();
  check('the same change made on both is no conflict', r.status === 200 && body.unchanged && body.merged, r.status + ' ' + JSON.stringify(body).slice(0, 160));
  // Taken out on one, changed on the other.
  const gone = {...P, NODES: P.NODES.replace(nodeLine + '\n', '')};
  const changed = {...theirs, NODES: theirs.NODES.replace(nodeLine, nodeLine.replace("label:'Beast Wars: Uprising'", "label:'Renamed'"))};
  r = await post(s, {base: theirsSave.sha, parts: changed});
  check('(the other device renames an entry)', r.status === 200);
  const headThen = gh.head;
  r = await post(s, {base: clean, parts: gone});
  body = await r.json();
  check('an entry taken out on one and changed on the other is refused', r.status === 409 && gh.head === headThen &&
        body.conflicts && body.conflicts[0].item === 'uprising-copy', r.status + ' ' + JSON.stringify(body));
  // And one taken out where the other did not touch it is taken out.
  const goneRef = {...P, REFS: P.REFS.replace(line('REFS', /^  \{key:'ref-2',/) + '\n', '')};
  r = await post(s, {base: clean, parts: goneRef});
  body = await r.json();
  check('an entry taken out on one and left alone on the other is taken out',
        r.status === 200 && body.merged && !gh.dataAt(gh.head).includes("{key:'ref-2',") && gh.dataAt(gh.head).includes("label:'Renamed'"),
        r.status + ' ' + JSON.stringify(body).slice(0, 200));
  // Settings are one line, so both changing them is a conflict.
  const s1 = {...body.parts, SETTINGS: body.parts.SETTINGS.replace("'#c23b22'", "'#112233'")};
  r = await post(s, {base: body.sha, parts: s1});
  const headS = gh.head;
  r = await post(s, {base: clean, parts: {...P, SETTINGS: P.SETTINGS.replace("'#c23b22'", "'#445566'")}});
  body = await r.json();
  check('settings changed on both are refused', r.status === 409 && gh.head === headS && body.conflicts[0].region === 'SETTINGS',
        r.status + ' ' + JSON.stringify(body));
  r = await post(s, {base: 'f'.repeat(40), parts: two});
  check('a base the repository never had is refused, not merged against nothing', r.status === 409);

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
  check('/me tells a reader they are a reader, and nothing about data.js',
        r.status === 200 && body.owner === false && body.login === 'a-reader' && !('sha' in body), JSON.stringify(body));
  const headNow = gh.head;
  r = await post(reader, {base: gitSha(after), parts: {...partsOf(after), REFS: partsOf(after).REFS + '\n/* a reader */'}});
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

  gh.issuesAllowed = false;
  r = await suggest(reader, {kind: 'addition', text: 'More, please.'});
  body = await r.json();
  check('an app without the Issues permission is named as the reason, not reported as a failure',
        r.status === 403 && /Issues permission/.test(body.error), r.status + ' ' + JSON.stringify(body));
  gh.issuesAllowed = true;

  /* The configuration. The three secrets live in Cloudflare; written into
     wrangler.toml they would be public, and would collide with the real
     ones. It happened once, with placeholder values. */
  const toml = fs.readFileSync(path.join(ROOT, 'worker', 'wrangler.toml'), 'utf8');
  const leaked = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'SESSION_SECRET']
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
