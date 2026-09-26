/* The chart's write service.

   The published site is a static page on GitHub Pages, and a static page
   cannot be written to. This is the one place a write can go. It does three
   things and nothing else:

     GET  /login     sends the owner to GitHub to sign in
     GET  /callback  where GitHub sends them back; hands the page a session
     GET  /me        "who is this session, and which data.js is current?"
     POST /save      commits the chart's regions into src/data.js

   The commit is the publish: CI builds the page from it and puts it on the
   site, the same as for any other change to the repository.

   WHO MAY WRITE is decided twice, and neither time by the page. Here, the
   GitHub account that signed in has to be one of OWNERS. And the commit is
   made with that account's own token, issued to the GitHub App this
   service signs in through — so GitHub itself refuses it unless the account
   can push to the repository AND the app is installed on it with Contents
   write. Nothing the page does or says can change either answer.

   A SESSION is the GitHub token, encrypted with SESSION_SECRET (AES-GCM,
   which also makes it tamper-evident) together with the login and an
   expiry. There is no store: the service keeps nothing between requests.
   The token inside is a GitHub App user token, which GitHub expires after
   eight hours regardless, and a session never outlives that.

   Configuration, set in the Cloudflare dashboard or wrangler.toml:
     GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   the GitHub App's, secret
     SESSION_SECRET                           any long random string, secret
     REPO                                     owner/name
     BRANCH                                   the branch the site is built from
     OWNERS                                   GitHub logins, comma-separated
     ALLOWED_ORIGINS                          the site's origin(s), comma-separated
*/

const DATA_PATH = 'src/data.js';
const REGIONS = ['NODES', 'COMMENTS', 'STICKERS', 'MEDIA', 'EDGESTYLES', 'TAGCATS', 'REFS', 'SETTINGS'];
const SESSION_HOURS = 8;
const STATE_MINUTES = 10;
// The page is ~2.5 MB with its pictures inlined; this is room for growth
// without being an invitation to post anything at all.
const MAX_BODY = 25 * 1024 * 1024;

const enc = new TextEncoder(), dec = new TextDecoder();

function list(v){ return String(v || '').split(',').map(s => s.trim()).filter(Boolean); }

/* ---- sealing: the session and the login state ------------------------ */

function b64url(bytes){
  let s = '';
  for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s){ return unb64(String(s).replace(/-/g, '+').replace(/_/g, '/')); }
function unb64(s){
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function sealKey(env, purpose){
  if(!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32){
    throw new Error('SESSION_SECRET is not set, or is shorter than 32 characters.');
  }
  // One secret, two keys: a login state can never be replayed as a session.
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(purpose + ':' + env.SESSION_SECRET));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(env, purpose, value){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sealKey(env, purpose);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64url(out);
}
/* Anything wrong — malformed, forged, sealed for the other purpose, or
   expired — is simply "no". Which one it was is nobody's business. */
export async function unseal(env, purpose, token){
  try{
    const bytes = unb64url(token);
    const key = await sealKey(env, purpose);
    const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes.subarray(0, 12)}, key, bytes.subarray(12));
    const value = JSON.parse(dec.decode(pt));
    if(!value || typeof value.exp !== 'number' || value.exp < Date.now()) return null;
    return value;
  }catch(e){ return null; }
}

/* ---- the file -------------------------------------------------------- */

/* The same operation as patchRegion in the page and carry_data in
   build.py: everything between a region's two markers is replaced, the
   markers themselves are not. Every region has to be there, in the file and
   in the save — a save that leaves one out is not a save of this chart. */
export function applyRegions(file, parts){
  let out = file;
  for(const name of REGIONS){
    const text = parts[name];
    if(typeof text !== 'string') throw httpError(400, `the save has no ${name} region.`);
    // A region's text that contained a marker would split the file wrongly
    // on the next read, and there is no chart content that needs one.
    if(text.indexOf('@@EDIT:') >= 0) throw httpError(400, `the ${name} region contains a region marker.`);
    const start = `/* @@EDIT:${name}:START@@ */`, end = `/* @@EDIT:${name}:END@@ */`;
    const i = out.indexOf(start), j = out.indexOf(end);
    if(i < 0 || j < 0 || j < i) throw httpError(500, `${DATA_PATH} has no ${name} region.`);
    out = out.slice(0, i + start.length) + '\n' + text + '\n' + out.slice(j);
  }
  return out;
}
// What git calls a file's contents, so it can be compared with the id the
// page was built with (build.py computes the same thing).
export async function blobSha(text){
  const body = enc.encode(text);
  const head = enc.encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head); all.set(body, head.length);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

/* ---- GitHub ---------------------------------------------------------- */

function httpError(status, message){ const e = new Error(message); e.status = status; return e; }

async function gh(token, path, init){
  const res = await fetch('https://api.github.com' + path, Object.assign({}, init, {
    headers: Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'rhizome-edit',
      'X-GitHub-Api-Version': '2022-11-28'
    }, init && init.body ? {'Content-Type': 'application/json'} : {})
  }));
  if(res.status === 401) throw httpError(401, 'GitHub no longer accepts this sign-in.');
  if(res.status === 403 || res.status === 404) throw httpError(403, 'GitHub refused: this account or app cannot write to the repository.');
  if(!res.ok) throw httpError(502, `GitHub answered ${res.status} to ${path.split('?')[0]}.`);
  return res.json();
}

/* The current head of the branch, and the data.js inside it. */
async function currentData(env, token){
  const ref = await gh(token, `/repos/${env.REPO}/git/ref/heads/${env.BRANCH}`);
  const commit = await gh(token, `/repos/${env.REPO}/git/commits/${ref.object.sha}`);
  // Walked down the tree rather than asked of the contents endpoint, which
  // stops describing a file once it passes a megabyte — and this one does.
  let sha = commit.tree.sha;
  for(const name of DATA_PATH.split('/')){
    const tree = await gh(token, `/repos/${env.REPO}/git/trees/${sha}`);
    const entry = (tree.tree || []).find(e => e.path === name);
    if(!entry) throw httpError(500, `${DATA_PATH} is not in the repository.`);
    sha = entry.sha;
  }
  return {head: ref.object.sha, tree: commit.tree.sha, sha};
}

async function readBlob(env, token, sha){
  const blob = await gh(token, `/repos/${env.REPO}/git/blobs/${sha}`);
  // Plain base64, broken into lines.
  return dec.decode(unb64(String(blob.content).replace(/\s+/g, '')));
}

/* One commit, made with the Git Data API rather than the contents endpoint:
   data.js runs past a megabyte, and the ref update is a fast-forward only —
   a push that landed in between makes it fail rather than be overwritten. */
async function commitData(env, token, now, text, login){
  const blob = await gh(token, `/repos/${env.REPO}/git/blobs`, {method: 'POST', body: JSON.stringify({content: text, encoding: 'utf-8'})});
  const tree = await gh(token, `/repos/${env.REPO}/git/trees`, {method: 'POST', body: JSON.stringify({
    base_tree: now.tree, tree: [{path: DATA_PATH, mode: '100644', type: 'blob', sha: blob.sha}]
  })});
  const commit = await gh(token, `/repos/${env.REPO}/git/commits`, {method: 'POST', body: JSON.stringify({
    message: `Save the chart from the site\n\nSaved by ${login} through the chart's own Save button.`,
    tree: tree.sha, parents: [now.head]
  })});
  const res = await fetch(`https://api.github.com/repos/${env.REPO}/git/refs/heads/${env.BRANCH}`, {
    method: 'PATCH',
    headers: {'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token,
              'User-Agent': 'rhizome-edit', 'Content-Type': 'application/json'},
    body: JSON.stringify({sha: commit.sha, force: false})
  });
  if(res.status === 422) throw httpError(409, 'the branch moved while this save was being made.');
  if(!res.ok) throw httpError(res.status === 403 ? 403 : 502, `GitHub answered ${res.status} to the branch update.`);
  return {sha: blob.sha, commit: commit.sha};
}

/* ---- HTTP ------------------------------------------------------------ */

function json(body, status, headers){
  return new Response(JSON.stringify(body), {status: status || 200,
    headers: Object.assign({'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, headers || {})});
}
function cors(env, request){
  const origin = request.headers.get('Origin');
  if(!origin || list(env.ALLOWED_ORIGINS).indexOf(origin) < 0) return {};
  return {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600'};
}
/* A page that only ever runs our own script, and that no one can frame. */
function page(html, status){
  return new Response('<!doctype html><meta charset="utf-8"><title>Rhizome sign-in</title>' + html,
    {status: status || 200, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer'}});
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

async function session(env, request){
  const m = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '');
  const s = m && await unseal(env, 'session', m[1]);
  if(!s) throw httpError(401, 'not signed in.');
  // Checked again on every request, so taking a login out of OWNERS takes
  // effect at once rather than when its sessions run out.
  if(list(env.OWNERS).map(x => x.toLowerCase()).indexOf(String(s.login).toLowerCase()) < 0){
    throw httpError(403, 'this account may not edit the chart.');
  }
  return s;
}

async function login(env, url){
  const origin = url.searchParams.get('origin') || '';
  const back = url.searchParams.get('return') || '';
  // Where the session is going to be handed has to be the site. Anything
  // else would be an open door: a link to /login?origin=elsewhere would
  // deliver the owner's session to whoever wrote the link.
  if(list(env.ALLOWED_ORIGINS).indexOf(origin) < 0) return page('<p>This sign-in is only for the chart\'s own site.</p>', 400);
  if(back && back !== origin && back.indexOf(origin + '/') !== 0) return page('<p>That return address is not the chart\'s site.</p>', 400);
  const state = await seal(env, 'state', {origin, back, exp: Date.now() + STATE_MINUTES * 60000});
  const to = new URL('https://github.com/login/oauth/authorize');
  to.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  to.searchParams.set('redirect_uri', url.origin + '/callback');
  to.searchParams.set('state', state);
  return Response.redirect(to.toString(), 302);
}

async function callback(env, url){
  const state = await unseal(env, 'state', url.searchParams.get('state') || '');
  const code = url.searchParams.get('code');
  if(!state || !code) return page('<p>This sign-in link has expired. Close this window and press Owner sign-in again.</p>', 400);
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'rhizome-edit'},
    body: JSON.stringify({client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
                          code, redirect_uri: url.origin + '/callback'})
  });
  const got = res.ok ? await res.json() : null;
  if(!got || !got.access_token) return page('<p>GitHub did not complete the sign-in. Close this window and try again.</p>', 502);
  const user = await gh(got.access_token, '/user');
  if(list(env.OWNERS).map(x => x.toLowerCase()).indexOf(String(user.login).toLowerCase()) < 0){
    return page(`<p>Signed in as ${esc(user.login)}, who is not this chart's owner. Nothing was changed; you can close this window.</p>`, 403);
  }
  const lifetime = Math.min(SESSION_HOURS * 3600, Number(got.expires_in) || SESSION_HOURS * 3600) * 1000;
  const token = await seal(env, 'session', {login: user.login, gh: got.access_token, exp: Date.now() + lifetime});
  // Opened as a popup: hand the session to the page that opened it, and
  // only if that page is the site. Opened as a redirect: go back to the
  // site with the session in the fragment, which never reaches a server.
  const payload = JSON.stringify({rhizomeSession: token}).replace(/</g, '\\u003c');
  const target = JSON.stringify(state.origin).replace(/</g, '\\u003c');
  const back = JSON.stringify((state.back || state.origin) + '#rhizome-session=' + encodeURIComponent(token)).replace(/</g, '\\u003c');
  return page(`<p>Signed in. You can close this window.</p><script>
    if(window.opener){ window.opener.postMessage(${payload}, ${target}); window.close(); }
    else { location.replace(${back}); }
  </script>`);
}

async function me(env, request){
  const s = await session(env, request);
  const now = await currentData(env, s.gh);
  return {owner: true, login: s.login, sha: now.sha};
}

async function save(env, request){
  const s = await session(env, request);
  const size = Number(request.headers.get('Content-Length') || 0);
  if(size > MAX_BODY) throw httpError(413, 'the chart is too large to save.');
  let body;
  try{ body = await request.json(); }catch(e){ throw httpError(400, 'the save is not JSON.'); }
  if(!body || typeof body.base !== 'string' || !body.parts || typeof body.parts !== 'object'){
    throw httpError(400, 'the save needs a base and the chart\'s regions.');
  }
  const now = await currentData(env, s.gh);
  // The page must be saving on top of the file that is actually there.
  // Anything else is a page that is behind, and saving it would write an
  // older chart over a newer one.
  if(now.sha !== body.base) throw httpError(409, 'the repository has a newer chart.');
  const file = await readBlob(env, s.gh, now.sha);
  const next = applyRegions(file, body.parts);
  if(next === file) return {sha: now.sha, unchanged: true};
  return commitData(env, s.gh, now, next, s.login);
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const h = cors(env, request);
    try{
      if(request.method === 'OPTIONS') return new Response(null, {status: 204, headers: h});
      if(request.method === 'GET' && url.pathname === '/login') return await login(env, url);
      if(request.method === 'GET' && url.pathname === '/callback') return await callback(env, url);
      if(request.method === 'GET' && url.pathname === '/me') return json(await me(env, request), 200, h);
      if(request.method === 'POST' && url.pathname === '/save') return json(await save(env, request), 200, h);
      return json({error: 'not found'}, 404, h);
    }catch(e){
      const status = e.status || 500;
      return json({error: status === 500 ? 'the save service failed.' : e.message}, status, h);
    }
  }
};
