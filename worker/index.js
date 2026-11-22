/* The chart's write service.

   The published site is a static page on GitHub Pages, and a static page
   cannot be written to. This is the one place a write can go. It does three
   things and nothing else: it signs people in, it saves the owner's chart,
   and it carries readers' suggestions to the repository's issues.

     GET  /login        sends the owner (or, with as=reader, a reader) to
                        GitHub to sign in
     GET  /callback     where GitHub sends them back; hands the page a session
     GET  /me           "who is this session, and which chart.json is current?"
     POST /save         commits the chart into src/chart.json, and
                        the new pictures beside it into src/media/
     GET  /suggestions  the open suggestions, read from the issues
     POST /suggest      opens an issue, as the reader who signed in
     POST /resolve      closes one, as the owner
     POST /report       a fault a reader's browser met, written to the log
                        and counted in the list below
     GET  /faults       that list, for the owner: what broke, how often
     POST /faults/clear takes one off it, or all of them, as the owner
     /cloud/…           the owner's cloud drives, Google Drive and Yandex
                        Disk: connecting one, looking through it, and
                        showing what was picked from it (see CLOUDS below)

   The commit is the publish: CI builds the page from it and puts it on the
   site, the same as for any other change to the repository.

   A SUGGESTION is an issue, not part of the chart. Kept in the chart, every
   one would be a commit — a rebuild of the site, and an owner's open page
   suddenly behind the repository and unable to save. As an issue it is
   written under the reader's own GitHub account, GitHub notifies the owner,
   and blocking somebody who misuses it is GitHub's own button. The issue
   carries a marker (suggestionBody) naming the entry and the kind of
   change; it is that marker, not a label, that makes an issue a suggestion
   — GitHub drops the labels of anyone who cannot push, which is every
   reader.

   WHO MAY WRITE is decided twice, and neither time by the page. Here, the
   GitHub account that signed in has to be one of OWNERS. And the commit is
   made with that account's own token, issued to the GitHub App this
   service signs in through — so GitHub itself refuses it unless the account
   can push to the repository AND the app is installed on it with Contents
   write. Nothing the page does or says can change either answer.

   An EDITOR is a login in EDITORS: someone the owner writes the chart
   with. An editor saves the chart as the owner does — the commit made with
   their own token, so GitHub refuses it unless they can push to the
   repository — but the chart's settings (its legend, tag colours, media
   templates, figures) stay the owner's: a save of theirs keeps whatever
   settings the repository holds, and says so. Closing a suggestion is the
   owner's too. Like OWNERS, the list is read on every request.

   A READER who signs in to suggest gets a session too, marked as a
   reader's. It opens /me, /suggestions and /suggest and nothing else:
   /save and /resolve ask for an owner on every request, as they always did,
   and a reader's token could not write the file anyway. A sign-in that
   does not ask for a reader's session, with an account that is not an
   owner, still gets none at all — a reader's session is only handed out
   when it was asked for. The page's one Sign in asks for it.

   A SESSION is the GitHub token, encrypted with SESSION_SECRET (AES-GCM,
   which also makes it tamper-evident) together with the login and an
   expiry. There is no store: the service keeps nothing between requests.
   The token inside is a GitHub App user token, which GitHub expires after
   eight hours. GitHub hands a refresh token with it, and the session
   carries that too, so a session outlives the eight hours: when the token
   inside has run out, the service trades the refresh token for a new pair
   and hands the page a new session alongside its answer. That is what lets
   the owner edit on a phone with no signal for days and still have the
   Save go through when the signal comes back. A session that is not used
   for SESSION_DAYS runs out all the same, and changing SESSION_SECRET
   still ends every session at once.

   Configuration, set in the Cloudflare dashboard or wrangler.toml:
     GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   the GitHub App's, secret
     SESSION_SECRET                           any long random string, secret
     REPO                                     owner/name
     BRANCH                                   the branch the site is built from
     OWNERS                                   GitHub logins, comma-separated
     EDITORS                                  GitHub logins, comma-separated;
                                              may be empty
     ALLOWED_ORIGINS                          the site's origin(s), comma-separated
*/

const DATA_PATH = 'src/chart.json';
/* Pictures and clips live beside the chart as files of their own, named by
   the SHA-256 of their bytes (MEDIA_REF in the page). The name is checked
   against the bytes here, so a file in the folder is always what it says it
   is, and one that is already there is simply not written again.

   An SVG is not among them, and that is the point of the list rather than
   an omission from it. Opened by its own address, an SVG is a document,
   and a script in it runs as the site — where the owner's session sits in
   localStorage. Drawn as an <img> or an <image> it runs nothing, which is
   all the chart ever does with one; so the page keeps an SVG embedded as a
   data: URI, which has no address on the site to be opened at, and this
   refuses a file that would give it one. A font is among them: opened at
   its address it is a font, and runs nothing. */
const MEDIA_DIR = 'src/media';
const MEDIA_REF = /^media\/([0-9a-f]{64})\.(png|jpg|gif|webp|avif|bmp|ico|webm|mp4|ogv|mov|ttf|otf|woff2?)$/;
const MEDIA_REF_IN_TEXT = /media\/[0-9a-f]{64}\.(?:png|jpg|gif|webp|avif|bmp|ico|webm|mp4|ogv|mov|ttf|otf|woff2?)/g;
// A session with nothing to renew itself with lasts as long as its token.
const SESSION_HOURS = 8;
// A renewable one lasts this long from its last renewal, so a phone left in
// a drawer for longer has to sign in again rather than hold a key forever.
const SESSION_DAYS = 30;
// Renewed a little early, so a token does not run out between this
// service reading it and GitHub reading it.
const RENEW_MARGIN = 5 * 60000;
const STATE_MINUTES = 10;
// The page is ~2.5 MB with its pictures inlined; this is room for growth
// without being an invitation to post anything at all.
const MAX_BODY = 25 * 1024 * 1024;
// What a suggestion may say. A paragraph or three is a suggestion; past
// this it is an essay, and the issue is still there to write it in.
// A suggestion or a close: a few kilobytes of text at most.
const MAX_SMALL_BODY = 64 * 1024;
const SUGGESTION_KINDS = ['correction', 'addition', 'deletion'];
const MAX_SUGGESTION = 4000;
const MAX_SUGGESTION_TITLE = 120;
const SUGGESTION_MARK = 'rhizome-suggestion:';
/* How many suggestions one reader may have waiting, and how many they may
   open in an hour. /suggest is open to anyone with a GitHub account, and
   each one is an issue in the owner's repository and a notification on
   the owner's phone; without a limit, one script could bury both. Ten
   waiting is more than anyone writing by hand gets to, and the hour stops
   the open-and-close that would get round it. The owner is not counted. */
const MAX_OPEN_SUGGESTIONS = 10;
const MAX_SUGGESTIONS_AN_HOUR = 5;
// Issues read per /suggestions, a hundred to a page. The open ones come
// newest first, so this is the newest three hundred open issues.
const SUGGESTION_PAGES = 3;

const enc = new TextEncoder(), dec = new TextDecoder();

function list(v){ return String(v || '').split(',').map(s => s.trim()).filter(Boolean); }

/* What the service cannot run without, by NAME. A missing secret used to
   surface as "the save service failed." on the first sign-in, which says
   nothing about where to look; the names say exactly which line in the
   Cloudflare dashboard is wrong, and give nothing away — every one of them
   is already written in this file. */
export function missingConfig(env){
  const out = [];
  for(const k of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'REPO', 'BRANCH', 'OWNERS', 'ALLOWED_ORIGINS']){
    if(!String(env[k] || '').trim()) out.push(k);
  }
  if(String(env.SESSION_SECRET || '').length < 32) out.push('SESSION_SECRET (missing, or shorter than 32 characters)');
  return out;
}

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

/* A drive file's address carries this service's mark, so the address
   answers only for a file the owner picked. Without it any file anyone
   has shared by link could be fetched through here, on this account's
   requests and the owner's Google key: a free proxy for whoever finds
   it. A mark, not a seal, because the address is written into the chart
   for good — it has no time to run out — and an HMAC of what it names
   is all a reader's browser needs to bring back. */
export async function fileMark(env, name, ref){
  if(!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) return null;
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('cloud-file:' + env.SESSION_SECRET));
  const key = await crypto.subtle.importKey('raw', raw, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(name + '\u0000' + ref)));
  return b64url(mac.subarray(0, 18));
}
export async function fileMarkOk(env, name, ref, mark){
  const want = await fileMark(env, name, ref);
  if(!want || typeof mark !== 'string' || mark.length !== want.length) return false;
  let diff = 0;
  for(let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ mark.charCodeAt(i);
  return diff === 0;
}

/* ---- the file -------------------------------------------------------- */

/* src/chart.json: the chart as JSON, the file the page's own chartJsonText
   writes. A save sends that text whole; it is read here with JSON.parse,
   checked to be a chart, and written back by chartText, so what is
   committed is always one item to a line whatever the page sent.

   Until 0.23 the chart was src/data.js, eight `const` statements that the
   page RAN, and a save sent the text of each — so this service carried a
   parser of its own (parseRegion) to make sure nothing in a save could do
   anything when it ran but exist. JSON is data by construction, and the
   page reads it with JSON.parse from an element a browser does not run;
   there is nothing left here to be sure of but the shape. */

/* The parts of a chart, in the order the file is written. Every list is
   one of records, and each record is named by what CHART_LISTS says; that
   name is what a merge goes by. */
const CHART_KEYS = ['$schema', 'format', 'nodes', 'edgeStyles', 'stickers', 'media', 'comments', 'tagCats', 'refs', 'settings'];
const CHART_LISTS = {
  nodes: e => e.id,
  edgeStyles: e => (typeof e.from === 'string' && typeof e.to === 'string') ? e.from + '\u0000' + e.to : null,
  stickers: e => e.key,
  media: e => e.key,
  comments: e => e.id,
  tagCats: e => e.name,
  refs: e => e.key
};
function itemName(part, item){
  const k = CHART_LISTS[part](item);
  return typeof k === 'string' ? k : null;
}
const isRecord = v => !!v && typeof v === 'object' && !Array.isArray(v);

/* The chart in a text, or an Error saying what it is not. Only the shape is
   asked: a record, with only the parts above, each list a list of records,
   the settings a record and the form a whole number. What may stand inside
   a record is the schema's to say (src/site/chart.schema.json, which CI
   holds the repository's chart to); nothing in one can do anything here. */
export function readChart(text){
  if(typeof text !== 'string') throw new Error('it is not text');
  let c;
  try{ c = JSON.parse(text); }catch(e){ throw new Error('it is not JSON that parses'); }
  if(!isRecord(c)) throw new Error('it is not a record');
  for(const k of Object.keys(c)){
    if(CHART_KEYS.indexOf(k) < 0) throw new Error(`it has a part no chart has, "${k}"`);
  }
  if(!Array.isArray(c.nodes)) throw new Error('it has no list of entries');
  for(const part of Object.keys(CHART_LISTS)){
    if(c[part] === undefined) continue;
    if(!Array.isArray(c[part])) throw new Error(`its ${part} are not a list`);
    if(!c[part].every(isRecord)) throw new Error(`its ${part} are not all records`);
  }
  if(c.settings !== undefined && !isRecord(c.settings)) throw new Error('its settings are not a record');
  if(c.format !== undefined && !(Number.isInteger(c.format) && c.format >= 1)) throw new Error('its form is not a whole number');
  if(c.$schema !== undefined && typeof c.$schema !== 'string') throw new Error('its $schema is not text');
  return c;
}

/* The file's text: the parts in their order, a list one record to a line.
   The same text as chartJsonText in the page (22-file-comments.js), which
   the suite holds it to, so a save of an unchanged chart is the same bytes
   and a save of one edit is a commit of one line. */
export function chartText(c){
  const keys = CHART_KEYS.filter(k => c[k] !== undefined);
  return '{\n' + keys.map((k, i) => {
    const v = c[k], end = i < keys.length - 1 ? ',' : '';
    return Array.isArray(v) && v.length
      ? `  ${JSON.stringify(k)}: [\n${v.map(x => '    ' + JSON.stringify(x)).join(',\n')}\n  ]${end}`
      : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${end}`;
  }).join('\n') + '\n}\n';
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

/* ---- two saves made on one chart ------------------------------------- */

/* Three charts: the one a save was made on (base), the one the repository
   has now (theirs), and the save (mine). What only one side changed is
   taken from that side; what both changed the same way is taken once;
   what both changed differently is a conflict, and nothing is merged —
   the save is refused, with the names of what collided.

   A list's unit is its record, named as CHART_LISTS says: two edits to one
   entry collide even when they touch different fields, because an entry
   is one thing to whoever edited it. The settings' unit is a field, since
   the settings are one record holding unrelated choices. It used to be a
   line of data.js, which came to the same for the lists and made the
   settings one unit; reading the values rather than the text, a chart
   written differently (a hand edit, another indentation) merges the same. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function mergeList(part, b, t, m, say){
  const named = list => {
    const out = new Map();
    for(const item of list || []){
      const k = itemName(part, item);
      if(k === null || out.has(k)) return null;
      out.set(k, item);
    }
    return out;
  };
  const B = named(b), T = named(t), M = named(m);
  if(!B || !T || !M){ say({region: part}); return t; }
  const keep = new Map();
  const collide = k => say({region: part, item: k.split('\u0000').join(' → ')});
  for(const [k, ti] of T){
    const bi = B.get(k), mi = M.get(k);
    if(mi === undefined){
      if(bi === undefined) keep.set(k, ti);          // theirs added it
      else if(!same(bi, ti)) collide(k);             // they changed what mine took out
      continue;                                      // else mine took it out
    }
    if(same(mi, ti) || same(mi, bi)) keep.set(k, ti);
    else if(same(ti, bi)) keep.set(k, mi);
    else collide(k);
  }
  // What mine added goes after the item it follows in mine.
  let after = null;
  const order = [...keep.keys()];
  for(const [k, mi] of M){
    if(T.has(k)){ after = k; continue; }
    const bi = B.get(k);
    if(bi === undefined){
      order.splice(after === null ? 0 : order.indexOf(after) + 1, 0, k);
      keep.set(k, mi);
      after = k;
    } else if(!same(bi, mi)) collide(k);             // mine changed what they took out
  }
  return order.filter(k => keep.has(k)).map(k => keep.get(k));
}
function mergeRecord(part, b, t, m, say){
  b = b || {}; t = t || {}; m = m || {};
  const out = {};
  const fields = [...Object.keys(t), ...Object.keys(m).filter(k => !(k in t)), ...Object.keys(b).filter(k => !(k in t) && !(k in m))];
  for(const k of fields){
    const v = mergeOne(b[k], t[k], m[k], () => say({region: part, item: k}));
    if(v !== undefined) out[k] = v;
  }
  return out;
}
function mergeOne(b, t, m, collide){
  if(same(m, b) || same(m, t)) return t;
  if(same(t, b)) return m;
  collide();
  return t;
}
export function mergeCharts(base, theirs, mine){
  const out = {}, conflicts = [];
  const say = c => conflicts.push(c);
  for(const k of CHART_KEYS){
    const b = base[k], t = theirs[k], m = mine[k];
    let v;
    if(same(m, b) || same(m, t)) v = t;
    else if(same(t, b)) v = m;
    else if(CHART_LISTS[k]) v = mergeList(k, b, t, m, say);
    else if(k === 'settings') v = mergeRecord(k, b, t, m, say);
    else { say({region: k}); v = t; }
    if(v !== undefined) out[k] = v;
  }
  if(conflicts.length){
    const e = httpError(409, 'the repository has a newer chart, and it changed ' +
      (conflicts.length === 1 ? 'something' : conflicts.length + ' things') + ' this save changed too.');
    e.conflicts = conflicts;
    throw e;
  }
  return out;
}

/* What an entry or a connector names: an entry's parents, the members of
   an array, a leader's two ends, a connector's two ends. A connector with
   an empty end is a bar's, and names nothing. */
function namesIn(chart){
  const ids = new Set(), refs = [];
  const say = (region, item, to) => { if(typeof to === 'string' && to) refs.push({region, item, to}); };
  for(const e of chart.nodes || []){
    if(!isRecord(e)) continue;
    if(typeof e.id === 'string') ids.add(e.id);
    [].concat(e.parent || []).forEach(p => say('nodes', e.id, p));
    if(Array.isArray(e.members)) e.members.forEach(m => say('nodes', e.id, m));
    if(isRecord(e.leader)){ say('nodes', e.id, e.leader.from); say('nodes', e.id, e.leader.to); }
  }
  for(const s of chart.edgeStyles || []){
    if(!isRecord(s)) continue;
    const item = `${s.from} → ${s.to}`;
    say('edgeStyles', item, s.from); say('edgeStyles', item, s.to);
  }
  return {ids, refs};
}
export function looseEnds(chart){
  const {ids, refs} = namesIn(chart);
  return refs.filter(r => !ids.has(r.to));
}
/* A merge puts together two edits that were each whole on their own, and
   can still leave a name pointing nowhere: one device took an entry out
   while the other drew a line to it. Neither side's records collide, so
   the merge passes it. What is refused is only a loose end the MERGE made
   — one in neither side's chart — so a chart that already had one (a hand
   edit, an older bug) is not held hostage to it. */
export function mergeLeftLooseEnds(merged, theirs, mine){
  const key = r => `${r.region}\u0000${r.item}\u0000${r.to}`;
  const had = new Set();
  for(const side of [theirs, mine]) looseEnds(side).forEach(r => had.add(key(r)));
  return looseEnds(merged).filter(r => !had.has(key(r)));
}

/* ---- GitHub ---------------------------------------------------------- */

function httpError(status, message){ const e = new Error(message); e.status = status; return e; }

/* A request's body as JSON, read no further than `max` bytes. The header
   that says how long a body is was all this used to ask, and a client may
   leave it out or say anything in it — a chunked upload has none — so the
   bytes are counted as they arrive, and the read stops at the limit. */
export async function readJson(request, max, what){
  const said = Number(request.headers.get('Content-Length') || 0);
  if(said > max) throw httpError(413, `${what} is too large.`);
  const parts = [];
  let got = 0;
  if(request.body){
    const reader = request.body.getReader();
    for(;;){
      const {done, value} = await reader.read();
      if(done) break;
      got += value.byteLength;
      if(got > max){ try{ await reader.cancel(); }catch(e){} throw httpError(413, `${what} is too large.`); }
      parts.push(value);
    }
  }
  const all = new Uint8Array(got);
  let at = 0;
  for(const p of parts){ all.set(p, at); at += p.byteLength; }
  try{ return JSON.parse(dec.decode(all)); }catch(e){ throw httpError(400, `${what} is not JSON.`); }
}

async function gh(token, path, init, refused){
  const res = await fetch('https://api.github.com' + path, Object.assign({}, init, {
    headers: Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'rhizome-edit',
      'X-GitHub-Api-Version': '2022-11-28'
    }, init && init.body ? {'Content-Type': 'application/json'} : {})
  }));
  if(res.status === 401) throw httpError(401, 'GitHub no longer accepts this sign-in.');
  if(res.status === 403 || res.status === 404) throw httpError(403, refused || 'GitHub refused: this account or app cannot write to the repository.');
  if(!res.ok) throw httpError(502, `GitHub answered ${res.status} to ${path.split('?')[0]}.`);
  return res.json();
}

/* The current head of the branch, the chart.json inside it, and the names in
   the media folder beside it (none, before the first picture is saved). */
async function currentData(env, token){
  const ref = await gh(token, `/repos/${env.REPO}/git/ref/heads/${env.BRANCH}`);
  const commit = await gh(token, `/repos/${env.REPO}/git/commits/${ref.object.sha}`);
  // Walked down the tree rather than asked of the contents endpoint, which
  // stops describing a file once it passes a megabyte — and this one could.
  const walk = async (sha, path) => {
    for(const name of path.split('/')){
      const tree = await gh(token, `/repos/${env.REPO}/git/trees/${sha}`);
      const entry = (tree.tree || []).find(e => e.path === name);
      if(!entry) return null;
      sha = entry.sha;
    }
    return sha;
  };
  const sha = await walk(commit.tree.sha, DATA_PATH);
  if(!sha) throw httpError(500, `${DATA_PATH} is not in the repository.`);
  const dir = await walk(commit.tree.sha, MEDIA_DIR);
  const media = new Set();
  if(dir){
    const tree = await gh(token, `/repos/${env.REPO}/git/trees/${dir}`);
    (tree.tree || []).forEach(e => media.add('media/' + e.path));
  }
  return {head: ref.object.sha, tree: commit.tree.sha, sha, media};
}

/* The pictures a save brings, checked: each one named for what its bytes
   are, and every path the new chart names that was not in the old one
   either already in the folder or in this save. A save that broke that
   would publish a chart with holes in it, so it is refused instead. */
export async function checkMedia(files, next, file, have){
  const out = [];
  if(files != null && (typeof files !== 'object' || Array.isArray(files))) throw httpError(400, 'the save\'s pictures are not a list of files.');
  for(const ref of Object.keys(files || {})){
    const m = MEDIA_REF.exec(ref);
    if(!m) throw httpError(400, `the save has a picture with a name no picture may have.`);
    if(typeof files[ref] !== 'string') throw httpError(400, `the save has no bytes for ${ref}.`);
    let bytes;
    try{ bytes = unb64(files[ref]); }catch(e){ throw httpError(400, `${ref} is not base64.`); }
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
    if(hex !== m[1]) throw httpError(400, `${ref} is not what its name says it is.`);
    if(!have.has(ref)) out.push({ref, b64: files[ref]});
  }
  const before = new Set(file.match(MEDIA_REF_IN_TEXT) || []);
  const missing = Array.from(new Set(next.match(MEDIA_REF_IN_TEXT) || []))
    .filter(ref => !before.has(ref) && !have.has(ref) && !(files && files[ref]));
  if(missing.length) throw httpError(400, `the chart names ${missing.length === 1 ? 'a picture' : missing.length + ' pictures'} the repository does not have (${missing[0]}).`);
  return out;
}

async function readBlob(env, token, sha){
  const blob = await gh(token, `/repos/${env.REPO}/git/blobs/${sha}`);
  // Plain base64, broken into lines.
  return dec.decode(unb64(String(blob.content).replace(/\s+/g, '')));
}

/* One commit, made with the Git Data API rather than the contents endpoint:
   a chart with its pictures inside could run past a megabyte, which that
   endpoint will not take, and the ref update is a fast-forward only —
   a push that landed in between makes it fail rather than be overwritten. */
async function commitData(env, token, now, text, login, media){
  const blob = await gh(token, `/repos/${env.REPO}/git/blobs`, {method: 'POST', body: JSON.stringify({content: text, encoding: 'utf-8'})});
  const entries = [{path: DATA_PATH, mode: '100644', type: 'blob', sha: blob.sha}];
  for(const f of media || []){
    const b = await gh(token, `/repos/${env.REPO}/git/blobs`, {method: 'POST', body: JSON.stringify({content: f.b64, encoding: 'base64'})});
    entries.push({path: 'src/' + f.ref, mode: '100644', type: 'blob', sha: b.sha});
  }
  const tree = await gh(token, `/repos/${env.REPO}/git/trees`, {method: 'POST', body: JSON.stringify({
    base_tree: now.tree, tree: entries
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
  // `over`: the chart.json this one replaced, so a page that was told of that
  // one a moment ago knows it has been overtaken by its own save.
  return {sha: blob.sha, commit: commit.sha, over: now.sha};
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

/* What a session holds, from what GitHub answered — to a sign-in or to a
   renewal, which answer in the same shape. */
export function sessionValue(login, got, as){
  const now = Date.now();
  const ghExp = now + (Number(got.expires_in) || SESSION_HOURS * 3600) * 1000;
  const who = as === 'reader' ? {login, as} : {login};
  if(!got.refresh_token) return Object.assign(who, {gh: got.access_token, exp: Math.min(ghExp, now + SESSION_HOURS * 3600000)});
  const rtExp = now + (Number(got.refresh_token_expires_in) || SESSION_DAYS * 86400) * 1000;
  return Object.assign(who, {gh: got.access_token, ghExp, rt: got.refresh_token,
          exp: Math.min(rtExp, now + SESSION_DAYS * 86400000)});
}

/* A refresh token is good for one renewal: GitHub hands a new one with the
   new token and forgets the old. So the session sealed from them has to
   reach the page whatever else the request comes to — a refused save
   included — or the page is left holding a session nothing can renew. The
   handler puts ctx.session on every answer for that reason. */
async function renew(env, s, ctx){
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'rhizome-edit'},
    body: JSON.stringify({client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
                          grant_type: 'refresh_token', refresh_token: s.rt})
  });
  const got = res.ok ? await res.json() : null;
  if(!got || !got.access_token) throw httpError(401, 'the sign-in has run out.');
  const next = sessionValue(s.login, got, s.as);
  // The cloud drives connected to it go on with it (see CLOUDS).
  if(s.clouds) next.clouds = s.clouds;
  ctx.session = await seal(env, 'session', next);
  return next;
}

function listed(names, login){
  return list(names).map(x => x.toLowerCase()).indexOf(String(login).toLowerCase()) >= 0;
}
function isOwner(env, login){ return listed(env.OWNERS, login); }
/* An owner listed among the editors as well is an owner. */
export function roleOf(env, login){
  return isOwner(env, login) ? 'owner' : listed(env.EDITORS, login) ? 'editor' : null;
}

/* `who` is what the request needs: 'owner'; 'editor' for a save, which an
   owner or an editor may make; or 'reader' for the three things a reader
   may do. The answer carries `owner` and `editor`, worked out here and
   never taken from the session — the session only says it was a reader's. */
async function session(env, request, ctx, who){
  const m = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '');
  const s = m && await unseal(env, 'session', m[1]);
  if(!s) throw httpError(401, 'not signed in.');
  // Checked again on every request, so taking a login out of OWNERS or
  // EDITORS takes effect at once rather than when its sessions run out.
  const role = roleOf(env, s.login);
  const may = role === 'owner'
    || (who === 'editor' && role === 'editor')
    || (who === 'reader' && (role === 'editor' || s.as === 'reader'));
  if(!may) throw httpError(403, 'this account may not edit the chart.');
  const live = (s.rt && typeof s.ghExp === 'number' && s.ghExp - RENEW_MARGIN < Date.now()) ? await renew(env, s, ctx) : s;
  return Object.assign({}, live, {owner: role === 'owner', editor: role === 'editor'});
}

async function login(env, url){
  const origin = url.searchParams.get('origin') || '';
  const back = url.searchParams.get('return') || '';
  const as = url.searchParams.get('as') === 'reader' ? 'reader' : 'owner';
  // Where the session is going to be handed has to be the site. Anything
  // else would be an open door: a link to /login?origin=elsewhere would
  // deliver the owner's session to whoever wrote the link.
  if(list(env.ALLOWED_ORIGINS).indexOf(origin) < 0) return page('<p>This sign-in is only for the chart\'s own site.</p>', 400);
  if(back && back !== origin && back.indexOf(origin + '/') !== 0) return page('<p>That return address is not the chart\'s site.</p>', 400);
  const state = await seal(env, 'state', {origin, back, as, exp: Date.now() + STATE_MINUTES * 60000});
  const to = new URL('https://github.com/login/oauth/authorize');
  to.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  to.searchParams.set('redirect_uri', url.origin + '/callback');
  to.searchParams.set('state', state);
  /* A reader is asked which account to use. Without this GitHub signs in
     whoever the browser is already signed in to and, once that account
     has allowed the app, does not even stop to show it — so the owner
     testing a second account, or two people sharing a computer, got the
     first account's name on their suggestion with no chance to change it.
     The owner's own sign-in is left as it was: one account, one click. */
  if(as === 'reader') to.searchParams.set('prompt', 'select_account');
  return Response.redirect(to.toString(), 302);
}

async function callback(env, url){
  const state = await unseal(env, 'state', url.searchParams.get('state') || '');
  const code = url.searchParams.get('code');
  if(!state || !code) return page('<p>This sign-in link has expired. Close this window and press Sign in again.</p>', 400);
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'rhizome-edit'},
    body: JSON.stringify({client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
                          code, redirect_uri: url.origin + '/callback'})
  });
  const got = res.ok ? await res.json() : null;
  if(!got || !got.access_token) return page('<p>GitHub did not complete the sign-in. Close this window and try again.</p>', 502);
  /* This answers a browser window, not the page's script: a refusal here
     has to be a page someone can read, not the JSON the catch-all writes. */
  let user;
  try{ user = await gh(got.access_token, '/user'); }
  catch(e){ return page('<p>GitHub would not say who signed in. Close this window and try again.</p>', 502); }
  const role = roleOf(env, user.login);
  if(!role && state.as !== 'reader'){
    return page(`<p>Signed in as ${esc(user.login)}, who is not this chart's owner. Nothing was changed; you can close this window.</p>`, 403);
  }
  // An owner who signs in to suggest is signed in as the owner: there is
  // nothing a reader's session could do that theirs cannot. An editor's is
  // a reader's session, which session() makes an editor's for as long as
  // the login is in EDITORS — and a reader's again once it is not.
  const token = await seal(env, 'session', sessionValue(user.login, got, role === 'owner' ? undefined : 'reader'));
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

async function me(env, request, ctx){
  const s = await session(env, request, ctx, 'reader');
  if(!s.owner && !s.editor) return {owner: false, login: s.login};
  const now = await currentData(env, s.gh);
  // `media`: this service takes pictures as files beside the chart.
  /* `clouds`: the drives this service is set up for, and which of them
     this session is connected to — the owner's alone, as the drives are. */
  return Object.assign({owner: s.owner, login: s.login, sha: now.sha, media: true},
                       s.editor ? {editor: true} : {},
                       s.owner ? {clouds: {ready: cloudsReady(env), connected: Object.keys(s.clouds || {}).filter(k => CLOUDS[k])}} : {});
}

async function save(env, request, ctx){
  const s = await session(env, request, ctx, 'editor');
  const body = await readJson(request, MAX_BODY, 'the save');
  /* A page from before 0.23 sends the chart as data.js's regions. It is
     behind the repository by definition — its data.js is not there any
     more — and its owner sees it as soon as it is reloaded. */
  if(body && body.parts && body.chart === undefined){
    throw httpError(400, 'this page is older than the chart\'s save service; reload it to save.');
  }
  if(!body || typeof body.base !== 'string' || typeof body.chart !== 'string'){
    throw httpError(400, 'the save needs a base and the chart.');
  }
  let mine;
  try{ mine = readChart(body.chart); }
  catch(e){ throw httpError(400, `the save is not the chart: ${e.message}.`); }
  const now = await currentData(env, s.gh);
  const file = await readBlob(env, s.gh, now.sha);
  /* An editor's save takes the settings the repository has, whatever it
     sent: they are the owner's. Taken from the repository's chart rather
     than refused, so the rest of the edit is saved, and the answer carries
     the chart as saved, so the editor's page shows the settings that
     stand — with a word saying why (`settingsKept`). */
  const kept = s.editor ? keepSettings(mine, file) : false;
  const say = done => kept ? Object.assign(done, {settingsKept: true, merged: true, chart: done.chart || chartText(mine)}) : done;
  let next = chartText(mine);
  let media = await checkMedia(body.media, next, file, now.media);
  // A save of exactly what is there changes nothing, whatever it was made
  // on top of. That is not a courtesy: a save kept on a phone with a bad
  // signal can be committed and its answer lost on the way back, and the
  // phone sends it again on an older base. Calling that a conflict would
  // tell the owner their work collides with itself.
  if(next === file && !media.length) return say({sha: now.sha, unchanged: true});
  /* A save made on an older chart — a second device, or a phone's kept
     Save sent days later — is put together with what the repository got
     in between, and refused only where the two changed the same thing.
     Written as it was sent, it would put the older chart back over the
     newer one. The answer carries the chart as merged, because the page
     that sent it has not seen the other half. */
  let merged = null;
  if(now.sha !== body.base){
    const read = async sha => {
      try{ return readChart(await readBlob(env, s.gh, sha)); }catch(e){ return null; }
    };
    const base = /^[0-9a-f]{40}$/.test(body.base) ? await read(body.base) : null;
    let theirs = null;
    try{ theirs = readChart(file); }catch(e){}
    if(!base || !theirs) throw httpError(409, 'the repository has a newer chart.');
    const together = mergeCharts(base, theirs, mine);
    const loose = mergeLeftLooseEnds(together, theirs, mine);
    if(loose.length){
      const e = httpError(409, 'the repository has a newer chart, and put together with this save it would leave ' +
        (loose.length === 1 ? 'a name' : loose.length + ' names') + ' pointing at an entry that is no longer there.');
      // Named by the entry that is gone, which is what the page can show
      // by name; what still points at it rides along.
      e.conflicts = loose.map(r => ({region: 'nodes', item: r.to, from: {region: r.region, item: r.item}}));
      throw e;
    }
    next = chartText(together);
    merged = next;
    media = await checkMedia(body.media, next, file, now.media);
    if(next === file && !media.length) return say({sha: now.sha, unchanged: true, merged: true, chart: merged});
  }
  const done = await commitData(env, s.gh, now, next, s.login, media);
  return say(merged ? Object.assign(done, {merged: true, chart: merged}) : done);
}

/* The repository's settings put into an editor's chart, in place of its
   own. True when that changed anything. A repository chart that does not
   read leaves the save as it was sent: the merge below refuses it anyway. */
export function keepSettings(mine, file){
  let theirs;
  try{ theirs = readChart(file); }catch(e){ return false; }
  // Compared as values, so the same settings written in another order are
  // the same settings, and an editor is not told theirs were left out.
  const canon = v => Array.isArray(v) ? v.map(canon)
    : isRecord(v) ? Object.keys(v).sort().reduce((o, k)=> (o[k] = canon(v[k]), o), {}) : v;
  if(same(canon(mine.settings), canon(theirs.settings))) return false;
  if(theirs.settings === undefined) delete mine.settings;
  else mine.settings = theirs.settings;
  return true;
}

/* ---- suggestions ----------------------------------------------------- */

/* The marker goes last, as an HTML comment, so GitHub shows the issue as
   the words the reader wrote and nothing else. What it names is URI-encoded
   JSON: an entry id comes from the chart's own content and can hold
   anything, and encoded it cannot close the comment it sits in. */
/* `titled` says the issue's title is the reader's own, after the kind; the
   title itself is read from the issue, so one corrected on GitHub reads as
   corrected here too. */
export function suggestionBody(text, entry, kind, titled){
  const mark = {entry: entry || null, kind};
  if(titled) mark.titled = true;
  return text + '\n\n<!-- ' + SUGGESTION_MARK + encodeURIComponent(JSON.stringify(mark)) + ' -->';
}
/* An issue as the page wants it, or null when it is not a suggestion. The
   last marker counts: the one this service wrote is at the end, and one a
   reader typed into their own words could only ever relabel their own. */
export function readSuggestion(issue){
  if(!issue || issue.pull_request || typeof issue.body !== 'string') return null;
  const at = issue.body.lastIndexOf('<!-- ' + SUGGESTION_MARK);
  if(at < 0) return null;
  const end = issue.body.indexOf(' -->', at);
  let mark;
  try{ mark = JSON.parse(decodeURIComponent(issue.body.slice(at + 5 + SUGGESTION_MARK.length, end < 0 ? undefined : end))); }
  catch(e){ return null; }
  if(!mark || SUGGESTION_KINDS.indexOf(mark.kind) < 0) return null;
  const head = mark.kind[0].toUpperCase() + mark.kind.slice(1) + ': ';
  const t = mark.titled && typeof issue.title === 'string' ? issue.title : '';
  return {number: issue.number, kind: mark.kind, entry: typeof mark.entry === 'string' ? mark.entry : null,
          title: t ? (t.startsWith(head) ? t.slice(head.length) : t).trim() || null : null,
          text: issue.body.slice(0, at).replace(/\s+$/, ''), login: issue.user && issue.user.login,
          at: String(issue.created_at || '').slice(0, 10), url: issue.html_url};
}

async function suggestions(env, request, ctx){
  const s = await session(env, request, ctx, 'reader');
  const out = [];
  for(let n = 1; n <= SUGGESTION_PAGES; n++){
    const got = await gh(s.gh, `/repos/${env.REPO}/issues?state=open&per_page=100&page=${n}`, undefined,
                         'GitHub refused: the sign-in app may not read this repository\'s issues.');
    for(const issue of got){
      const one = readSuggestion(issue);
      if(one) out.push(Object.assign(one, {mine: String(one.login).toLowerCase() === String(s.login).toLowerCase()}));
    }
    if(got.length < 100) break;
  }
  return {owner: s.owner, login: s.login, suggestions: out};
}

async function suggest(env, request, ctx){
  const s = await session(env, request, ctx, 'reader');
  const body = await readJson(request, MAX_SMALL_BODY, 'the suggestion');
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if(!body || SUGGESTION_KINDS.indexOf(body.kind) < 0) throw httpError(400, 'a suggestion is a correction, an addition or a deletion.');
  if(!text) throw httpError(400, 'the suggestion says nothing.');
  if(text.length > MAX_SUGGESTION) throw httpError(413, `a suggestion is at most ${MAX_SUGGESTION} characters.`);
  const entry = typeof body.entry === 'string' && body.entry ? body.entry.slice(0, 300) : null;
  // The entry's name is only for the title, so the issue list reads well on
  // GitHub: one line, and short enough to be a title.
  const label = String(typeof body.label === 'string' ? body.label : '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const kind = body.kind[0].toUpperCase() + body.kind.slice(1);
  // A title of the reader's own, when they gave one: one line, as a title is.
  const title = String(typeof body.title === 'string' ? body.title : '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUGGESTION_TITLE);
  if(!s.owner) await withinSuggestionLimits(env, s);
  const issue = await gh(s.gh, `/repos/${env.REPO}/issues`, {method: 'POST', body: JSON.stringify({
    title: `${kind}: ${title || (entry && label ? label : 'the chart')}`,
    body: suggestionBody(text, entry, body.kind, !!title)
  })}, 'GitHub refused: the sign-in app may not open issues here. It needs the Issues permission.');
  return {suggestion: Object.assign(readSuggestion(issue) || {}, {mine: true})};
}

/* This reader's newest hundred issues, open and closed, asked of GitHub
   rather than kept here: the service keeps nothing, and the issues are the
   record. Only suggestions count — an issue about the code is not one. */
async function withinSuggestionLimits(env, s){
  const mine = await gh(s.gh, `/repos/${env.REPO}/issues?state=all&creator=${encodeURIComponent(s.login)}&sort=created&direction=desc&per_page=100`,
                        undefined, 'GitHub refused: the sign-in app may not read this repository\'s issues. It needs the Issues permission.');
  const theirs = (Array.isArray(mine) ? mine : []).filter(i => readSuggestion(i));
  if(theirs.filter(i => i.state === 'open').length >= MAX_OPEN_SUGGESTIONS)
    throw httpError(429, `you have ${MAX_OPEN_SUGGESTIONS} suggestions waiting already; once the owner has read some, there is room for more.`);
  const hourAgo = Date.now() - 3600e3;
  if(theirs.filter(i => Date.parse(i.created_at) > hourAgo).length >= MAX_SUGGESTIONS_AN_HOUR)
    throw httpError(429, `that is ${MAX_SUGGESTIONS_AN_HOUR} suggestions in an hour; the next can be made in a little while.`);
}

async function resolve(env, request, ctx){
  const s = await session(env, request, ctx, 'owner');
  const body = await readJson(request, MAX_SMALL_BODY, 'the request');
  const number = body && Number(body.number);
  if(!Number.isInteger(number) || number < 1) throw httpError(400, 'which suggestion?');
  const reason = body.reason === 'not_planned' ? 'not_planned' : 'completed';
  const path = `/repos/${env.REPO}/issues/${number}`;
  // Looked at first, so a page holding the wrong number closes nothing that
  // is not a suggestion — an issue about the code included.
  if(!readSuggestion(await gh(s.gh, path))) throw httpError(400, 'that issue is not a suggestion.');
  await gh(s.gh, path, {method: 'PATCH', body: JSON.stringify({state: 'closed', state_reason: reason})},
           'GitHub refused: the sign-in app may not close issues here. It needs the Issues permission.');
  return {closed: number, reason};
}

/* ---- what goes wrong in readers' browsers ------------------------------

   The site tells the service about a fault a reader's browser met
   (reportFault, src/app/01-store.js), and the service writes it to its
   log: Cloudflare, the Worker, Logs. Nothing is answered but that it
   arrived.

   The log alone was not enough: on the free plan Cloudflare keeps it three
   days, so a fault nobody went to look for in time was a fault that never
   happened. So the service also COUNTS what it is told, in a KV namespace
   (FAULTS): one record a fault, named by what it is — its message and
   where it was thrown — holding how many times it came, when first and
   last, and the newest browser and version that met it. The owner reads
   the list in About and takes off what has been dealt with; a record no
   reader has met for FAULT_DAYS goes on its own. Without the namespace
   (a fork, or the service before it was deployed with one) the log is all
   there is, as before.

   KV's free plan takes a thousand writes a day, and a fault met by every
   reader would spend them by noon; past that a write fails, the count
   stops there for the day, and the log line is still written. A count
   that stops at a thousand has already said what it needed to.

   Only from the site's own origin — a browser always says which page sent
   a POST — and only a few kilobytes. What is written is the report's own
   fields, each cut to length and nothing else, so a sender cannot make a
   line of the log say whatever it likes about anything but its fault. */
export async function report(env, request){
  const origin = request.headers.get('Origin');
  if(!origin || list(env.ALLOWED_ORIGINS).indexOf(origin) < 0) throw httpError(403, 'reports are taken only from the chart\'s own site.');
  const b = await readJson(request, 8192, 'the report');
  if(!b || typeof b !== 'object' || Array.isArray(b)) throw httpError(400, 'the report is not a report.');
  const text = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const whole = v => Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
  const entry = {report: 'page fault', kind: text(b.kind, 20), message: text(b.message, 500),
    file: text(b.file, 300), line: whole(b.line), col: whole(b.col), stack: text(b.stack, 2000),
    version: text(b.version, 20), ua: text(b.ua, 300)};
  console.error(JSON.stringify(entry));
  if(env.FAULTS){
    try{ if(await withinFaultBudget(env.FAULTS)) await countFault(env.FAULTS, entry); }catch(e){ console.error(JSON.stringify({report: 'fault not counted', why: String(e && e.message || e)})); }
  }
  return entry;
}

/* ---- CLOUDS: the owner's Google Drive and Yandex Disk ----------------
 *
 * A picture or a clip can be kept in the owner's own cloud drive rather
 * than in the repository (the owner's choice of 20.11). The owner connects
 * a drive once, looks through it from My files and picks a file; the file
 * is made viewable by anyone with its link — a reader has to be able to
 * see it, and has no account of the owner's to see it with — and the chart
 * names it by an address on this service, which every reader's browser
 * asks and is answered from the drive:
 *
 *   GET /cloud/gdrive/file/<id>       the file, from Google Drive's API
 *                                     with GOOGLE_API_KEY, which reads a
 *                                     file shared by link and no other
 *   GET /cloud/yadisk/file?key=<k>    sent on to Yandex's download address
 *                                     for the published file <k>
 *
 * Neither needs the owner's account, so nothing of the owner's is kept to
 * answer readers: there is still no store. What a drive answers is the
 * file shared by link, which is all these two addresses can reach.
 *
 * The owner's own grant to the drive lives in the owner's SESSION, beside
 * the GitHub token and sealed the same way: `clouds: {gdrive: {at, atExp,
 * rt}, yadisk: {…}}`. Connecting is a popup like the sign-in, opened on a
 * ticket the page gets with its session, so nobody else can start one:
 *
 *   POST /cloud/<p>/ticket   (owner) a ticket for the popup, ten minutes
 *   GET  /cloud/<p>/connect  the popup: off to the provider's consent
 *   GET  /cloud/<p>/back     where it comes back; hands the page a grant
 *   POST /cloud/<p>/attach   (owner) the grant goes into the session
 *   POST /cloud/<p>/forget   (owner) and out of it again
 *   POST /cloud/<p>/list     (owner) one folder: its folders, pictures, clips
 *   POST /cloud/<p>/pick     (owner) share one file by link; its address
 *
 * A provider whose app is not set up here (no client id or secret) is
 * simply not offered: /me lists the ones that are.
 *
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_API_KEY   secrets
 *   YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET                   secrets
 */
const CLOUDS = {
  gdrive: {
    name: 'Google Drive',
    ready: env => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_API_KEY),
    authorize: (env, back, state) => {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      u.searchParams.set('redirect_uri', back);
      u.searchParams.set('response_type', 'code');
      /* The whole drive: a file is looked through and then shared by
         link, and only this scope may change who can see a file the app
         did not make. */
      u.searchParams.set('scope', 'https://www.googleapis.com/auth/drive');
      u.searchParams.set('access_type', 'offline');
      u.searchParams.set('prompt', 'consent');
      u.searchParams.set('state', state);
      return u.toString();
    },
    token: (env, params) => cloudToken('https://oauth2.googleapis.com/token',
      Object.assign({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET}, params))
  },
  yadisk: {
    name: 'Yandex Disk',
    ready: env => !!(env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET),
    authorize: (env, back, state) => {
      const u = new URL('https://oauth.yandex.ru/authorize');
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('client_id', env.YANDEX_CLIENT_ID);
      u.searchParams.set('redirect_uri', back);
      u.searchParams.set('force_confirm', 'yes');
      u.searchParams.set('state', state);
      return u.toString();
    },
    token: (env, params) => cloudToken('https://oauth.yandex.ru/token',
      Object.assign({client_id: env.YANDEX_CLIENT_ID, client_secret: env.YANDEX_CLIENT_SECRET}, params))
  }
};
const CLOUD_LIST_MAX = 200;
export function cloudsReady(env){ return Object.keys(CLOUDS).filter(k => CLOUDS[k].ready(env)); }
function cloudOf(env, name){
  const c = CLOUDS[name];
  if(!c) throw httpError(404, 'not found');
  if(!c.ready(env)) throw httpError(503, `${c.name} is not set up on the write service.`);
  return c;
}
async function cloudToken(url, params){
  const res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
                                body: new URLSearchParams(params).toString()});
  const got = res.ok ? await res.json() : null;
  if(!got || !got.access_token) return null;
  return got;
}
function cloudGrant(got, old){
  return {at: got.access_token, atExp: Date.now() + (Number(got.expires_in) || 3600) * 1000,
          rt: got.refresh_token || (old && old.rt) || null};
}
/* The session sealed again with other drives in it. `owner` and `editor`
   are what session() worked out for this request, never kept: a session
   says who signed in, and the role is read from OWNERS each time. */
function sealClouds(env, s, clouds){
  const next = Object.assign({}, s, {clouds});
  delete next.owner; delete next.editor;
  return seal(env, 'session', next);
}
/* The owner's grant to a drive, renewed when it is about to run out; a
   renewal goes into the session the answer carries. */
async function cloudAccess(env, s, name, ctx){
  const g = s.clouds && s.clouds[name];
  if(!g) throw httpError(409, `${CLOUDS[name].name} is not connected.`);
  if(g.atExp - RENEW_MARGIN > Date.now()) return g.at;
  const got = g.rt ? await CLOUDS[name].token(env, {grant_type: 'refresh_token', refresh_token: g.rt}) : null;
  if(!got){
    const clouds = Object.assign({}, s.clouds); delete clouds[name];
    ctx.session = await sealClouds(env, s, clouds);
    throw httpError(409, `${CLOUDS[name].name} no longer accepts this connection; connect it again.`);
  }
  ctx.session = await sealClouds(env, s, Object.assign({}, s.clouds, {[name]: cloudGrant(got, g)}));
  return got.access_token;
}
async function cloudApi(url, token, init, scheme){
  const res = await fetch(url, Object.assign({}, init, {headers: Object.assign({'Authorization': (scheme || 'Bearer') + ' ' + token,
    'Accept': 'application/json'}, (init && init.headers) || {})}));
  if(res.status === 401) throw httpError(409, 'the drive no longer accepts this connection; connect it again.');
  if(!res.ok) throw httpError(502, `the drive answered ${res.status}.`);
  return res.status === 204 || res.status === 201 && !(res.headers.get('Content-Type') || '').includes('json') ? null : res.json();
}
const kindOfMime = m => /^image\//.test(m || '') ? 'image' : /^video\//.test(m || '') ? 'video' : null;

async function cloudTicket(env, request, ctx, name){
  cloudOf(env, name);
  const s = await session(env, request, ctx, 'owner');
  const origin = request.headers.get('Origin') || '';
  if(list(env.ALLOWED_ORIGINS).indexOf(origin) < 0) throw httpError(403, 'only the chart\'s own site may connect a drive.');
  return {ticket: await seal(env, 'cloud-state', {cloud: name, login: s.login, origin, exp: Date.now() + STATE_MINUTES * 60000})};
}
async function cloudConnect(env, url, name){
  const c = cloudOf(env, name);
  const t = await unseal(env, 'cloud-state', url.searchParams.get('ticket') || '');
  if(!t || t.cloud !== name) return page('<p>This link has expired. Close this window and press Connect again.</p>', 400);
  return Response.redirect(c.authorize(env, url.origin + '/cloud/' + name + '/back', url.searchParams.get('ticket')), 302);
}
async function cloudBack(env, url, name){
  const c = cloudOf(env, name);
  const t = await unseal(env, 'cloud-state', url.searchParams.get('state') || '');
  const code = url.searchParams.get('code');
  if(!t || t.cloud !== name || !code) return page(`<p>${esc(c.name)} was not connected. Close this window and try again.</p>`, 400);
  const got = await c.token(env, {grant_type: 'authorization_code', code, redirect_uri: url.origin + '/cloud/' + name + '/back'});
  if(!got) return page(`<p>${esc(c.name)} did not complete the connection. Close this window and try again.</p>`, 502);
  /* Sealed for the session it will join: only the page of the owner
     whose ticket this was can attach it. */
  const grant = await seal(env, 'cloud-grant', {cloud: name, login: t.login, g: cloudGrant(got), exp: Date.now() + STATE_MINUTES * 60000});
  const payload = JSON.stringify({rhizomeCloud: {cloud: name, grant}}).replace(/</g, '\\u003c');
  const target = JSON.stringify(t.origin).replace(/</g, '\\u003c');
  return page(`<p>${esc(c.name)} is connected. You can close this window.</p><script>
    if(window.opener){ window.opener.postMessage(${payload}, ${target}); window.close(); }
  </script>`);
}
async function cloudAttach(env, request, ctx, name){
  cloudOf(env, name);
  const s = await session(env, request, ctx, 'owner');
  const body = await readJson(request, MAX_SMALL_BODY, 'the connection');
  const g = await unseal(env, 'cloud-grant', body && body.grant || '');
  if(!g || g.cloud !== name || g.login !== s.login) throw httpError(400, 'that connection has expired; connect again.');
  const clouds = Object.assign({}, s.clouds || {}, {[name]: g.g});
  ctx.session = await sealClouds(env, s, clouds);
  return {connected: Object.keys(clouds)};
}
async function cloudForget(env, request, ctx, name){
  if(!CLOUDS[name]) throw httpError(404, 'not found');
  const s = await session(env, request, ctx, 'owner');
  const clouds = Object.assign({}, s.clouds || {});
  delete clouds[name];
  ctx.session = await sealClouds(env, s, clouds);
  return {connected: Object.keys(clouds)};
}
/* One folder of the drive: its folders, then its pictures and clips, by
   name. Anything else in it is not shown — it could not be picked. */
async function cloudList(env, request, ctx, name){
  cloudOf(env, name);
  const s = await session(env, request, ctx, 'owner');
  const body = await readJson(request, MAX_SMALL_BODY, 'the folder');
  const at = await cloudAccess(env, s, name, ctx);
  const folder = typeof body.folder === 'string' && body.folder ? body.folder : null;
  const items = [];
  if(name === 'gdrive'){
    const parent = folder && /^[A-Za-z0-9_-]{1,200}$/.test(folder) ? folder : 'root';
    const q = `'${parent}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/' or mimeType contains 'video/')`;
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', q);
    u.searchParams.set('fields', 'files(id,name,mimeType,thumbnailLink)');
    u.searchParams.set('pageSize', String(CLOUD_LIST_MAX));
    u.searchParams.set('orderBy', 'folder,name');
    const got = await cloudApi(u.toString(), at);
    for(const f of (got && got.files) || []){
      const kind = f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : kindOfMime(f.mimeType);
      if(kind) items.push({id: f.id, name: String(f.name || ''), kind, mime: f.mimeType, thumb: f.thumbnailLink || null});
    }
  } else {
    const path = folder && /^disk:\//.test(folder) ? folder : 'disk:/';
    const u = new URL('https://cloud-api.yandex.net/v1/disk/resources');
    u.searchParams.set('path', path);
    u.searchParams.set('limit', String(CLOUD_LIST_MAX));
    u.searchParams.set('sort', 'name');
    u.searchParams.set('fields', '_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.mime_type');
    const got = await cloudApi(u.toString(), at, null, 'OAuth');
    const all = ((got && got._embedded && got._embedded.items) || []).map(f => {
      const kind = f.type === 'dir' ? 'folder' : kindOfMime(f.mime_type);
      return kind ? {id: f.path, name: String(f.name || ''), kind, mime: f.mime_type || null, thumb: null} : null;
    }).filter(Boolean);
    items.push(...all.filter(i => i.kind === 'folder'), ...all.filter(i => i.kind !== 'folder'));
  }
  return {items};
}
/* Picked: shared by link, and named by its address on this service. */
async function cloudPick(env, request, ctx, name){
  cloudOf(env, name);
  const s = await session(env, request, ctx, 'owner');
  const body = await readJson(request, MAX_SMALL_BODY, 'the file');
  const at = await cloudAccess(env, s, name, ctx);
  const id = body && typeof body.id === 'string' ? body.id : '';
  const self = new URL(request.url).origin;
  if(name === 'gdrive'){
    if(!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw httpError(400, 'that is not a file of the drive.');
    const f = await cloudApi(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType`, at);
    const kind = kindOfMime(f && f.mimeType);
    if(!kind) throw httpError(400, 'only a picture or a clip can be put on the chart.');
    await cloudApi(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, at,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({role: 'reader', type: 'anyone'})});
    return {src: `${self}/cloud/gdrive/file/${id}?mark=${await fileMark(env, 'gdrive', id)}`, name: String(f.name || id), kind};
  }
  if(!/^disk:\//.test(id)) throw httpError(400, 'that is not a file of the drive.');
  const meta = u => cloudApi(u, at, null, 'OAuth');
  const q = encodeURIComponent(id);
  let f = await meta(`https://cloud-api.yandex.net/v1/disk/resources?path=${q}&fields=name,mime_type,public_key`);
  const kind = kindOfMime(f && f.mime_type);
  if(!kind) throw httpError(400, 'only a picture or a clip can be put on the chart.');
  if(!f.public_key){
    await cloudApi(`https://cloud-api.yandex.net/v1/disk/resources/publish?path=${q}`, at, {method: 'PUT'}, 'OAuth');
    f = await meta(`https://cloud-api.yandex.net/v1/disk/resources?path=${q}&fields=name,mime_type,public_key`);
  }
  if(!f || !f.public_key) throw httpError(502, 'Yandex Disk did not share the file.');
  return {src: `${self}/cloud/yadisk/file?key=${encodeURIComponent(f.public_key)}&mark=${await fileMark(env, 'yadisk', f.public_key)}`, name: String(f.name || ''), kind};
}
/* What a reader's browser asks for. Anyone may: it reaches only files
   the owner picked, by the mark their address carries (fileMark). The range a video asks for is passed on, and so is
   what the drive answers it with. */
async function cloudFile(env, request, url, name){
  const c = CLOUDS[name];
  if(!c || !c.ready(env)) return new Response('not found', {status: 404});
  const open = {'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'};
  if(name === 'gdrive'){
    const id = url.pathname.slice('/cloud/gdrive/file/'.length);
    if(!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return new Response('not found', {status: 404});
    if(!await fileMarkOk(env, 'gdrive', id, url.searchParams.get('mark'))) return new Response('not found', {status: 404, headers: open});
    const headers = {};
    const range = request.headers.get('Range');
    if(range) headers.Range = range;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(env.GOOGLE_API_KEY)}`, {headers});
    if(!res.ok && res.status !== 206) return new Response('not found', {status: res.status === 416 ? 416 : 404, headers: open});
    const type = res.headers.get('Content-Type') || '';
    // Only what the chart can show is passed on: nothing that would run.
    if(!kindOfMime(type)) return new Response('not found', {status: 404, headers: open});
    const out = Object.assign({}, open, {'Content-Type': type});
    for(const k of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']){
      const v = res.headers.get(k);
      if(v) out[k] = v;
    }
    return new Response(res.body, {status: res.status, headers: out});
  }
  const key = url.searchParams.get('key') || '';
  if(!key || key.length > 500) return new Response('not found', {status: 404});
  if(!await fileMarkOk(env, 'yadisk', key, url.searchParams.get('mark'))) return new Response('not found', {status: 404, headers: open});
  const res = await fetch('https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(key));
  const got = res.ok ? await res.json() : null;
  if(!got || typeof got.href !== 'string' || !/^https:\/\//.test(got.href)) return new Response('not found', {status: 404, headers: open});
  // Yandex's download address is good for a while, not for ever.
  return new Response(null, {status: 302, headers: Object.assign({}, open, {'Location': got.href, 'Cache-Control': 'public, max-age=600'})});
}

const FAULT_DAYS = 90;
/* How many reports a day are counted. /report asks who sent it only by
   the Origin header, which a browser cannot lie about and a script can,
   so anyone could send it a thousand different faults: the owner's list
   would be buried and the namespace's writes for the day (1000 on the
   free plan) spent. Past this, a report still goes to the log; it is
   only not counted. Each counted report costs two writes, this tally's
   and its own, so a flood stops at well under the day's writes. */
const MAX_FAULT_COUNTS_A_DAY = 200;
export async function withinFaultBudget(kv, today){
  const key = 'day:' + (today || new Date().toISOString().slice(0, 10));
  const n = Number(await kv.get(key)) || 0;
  if(n >= MAX_FAULT_COUNTS_A_DAY) return false;
  await kv.put(key, String(n + 1), {expirationTtl: 2 * 86400});
  return true;
}
// The most the owner's list holds; the newest come first.
const MAX_FAULTS = 100;
/* One fault, however many readers met it: the same message thrown from
   the same place. The stack is not part of the name — the same fault
   reached two ways is still one fault — and nor is the version, which is
   kept as the newest that met it. */
export async function faultKey(entry){
  const name = [entry.kind, entry.message, entry.file, entry.line, entry.col].join('\u0000');
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(name)));
  return 'fault:' + Array.from(d.subarray(0, 10), b => b.toString(16).padStart(2, '0')).join('');
}
export async function countFault(kv, entry){
  const key = await faultKey(entry);
  const now = new Date().toISOString();
  let had = null;
  try{ had = JSON.parse(await kv.get(key) || 'null'); }catch(e){}
  const rec = Object.assign({}, entry, {count: (had && had.count || 0) + 1, first: had && had.first || now, last: now});
  delete rec.report;
  await kv.put(key, JSON.stringify(rec), {expirationTtl: FAULT_DAYS * 86400});
  return rec;
}

async function faults(env, request, ctx){
  await session(env, request, ctx, 'owner');
  if(!env.FAULTS) return {kept: false, faults: []};
  const listed = await env.FAULTS.list({prefix: 'fault:', limit: 1000});
  const out = [];
  for(const k of listed.keys){
    let rec = null;
    try{ rec = JSON.parse(await env.FAULTS.get(k.name) || 'null'); }catch(e){}
    if(rec) out.push(Object.assign(rec, {key: k.name}));
  }
  out.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  return {kept: true, faults: out.slice(0, MAX_FAULTS)};
}

async function clearFaults(env, request, ctx){
  await session(env, request, ctx, 'owner');
  const body = await readJson(request, MAX_SMALL_BODY, 'the request');
  if(!env.FAULTS) return {cleared: 0};
  let keys;
  if(body && body.all === true) keys = (await env.FAULTS.list({prefix: 'fault:', limit: 1000})).keys.map(k => k.name);
  else if(body && typeof body.key === 'string' && /^fault:[0-9a-f]{20}$/.test(body.key)) keys = [body.key];
  else throw httpError(400, 'which fault?');
  for(const k of keys) await env.FAULTS.delete(k);
  return {cleared: keys.length};
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const h = cors(env, request);
    const ctx = {};
    const withSession = body => ctx.session ? Object.assign({}, body, {session: ctx.session}) : body;
    try{
      if(request.method === 'OPTIONS') return new Response(null, {status: 204, headers: h});
      const missing = missingConfig(env);
      if(missing.length) return json({error: 'the save service is not set up: ' + missing.join(', ') + '. Set it in Cloudflare, Worker → Settings → Variables and Secrets, as a Secret.'}, 503, h);
      if(request.method === 'GET' && url.pathname === '/login') return await login(env, url);
      if(request.method === 'GET' && url.pathname === '/callback') return await callback(env, url);
      if(request.method === 'GET' && url.pathname === '/me') return json(withSession(await me(env, request, ctx)), 200, h);
      if(request.method === 'POST' && url.pathname === '/save') return json(withSession(await save(env, request, ctx)), 200, h);
      if(request.method === 'GET' && url.pathname === '/suggestions') return json(withSession(await suggestions(env, request, ctx)), 200, h);
      if(request.method === 'POST' && url.pathname === '/suggest') return json(withSession(await suggest(env, request, ctx)), 200, h);
      if(request.method === 'POST' && url.pathname === '/report'){ await report(env, request); return new Response(null, {status: 204, headers: h}); }
      if(request.method === 'POST' && url.pathname === '/resolve') return json(withSession(await resolve(env, request, ctx)), 200, h);
      if(request.method === 'GET' && url.pathname === '/faults') return json(withSession(await faults(env, request, ctx)), 200, h);
      if(request.method === 'POST' && url.pathname === '/faults/clear') return json(withSession(await clearFaults(env, request, ctx)), 200, h);
      const cl = /^\/cloud\/(gdrive|yadisk)\/(ticket|connect|back|attach|forget|list|pick|file)(?:\/|$)/.exec(url.pathname);
      if(cl){
        const [, name, what] = cl;
        if(request.method === 'GET' && what === 'file') return await cloudFile(env, request, url, name);
        if(request.method === 'GET' && what === 'connect') return await cloudConnect(env, url, name);
        if(request.method === 'GET' && what === 'back') return await cloudBack(env, url, name);
        const act = {ticket: cloudTicket, attach: cloudAttach, forget: cloudForget, list: cloudList, pick: cloudPick}[what];
        if(request.method === 'POST' && act) return json(withSession(await act(env, request, ctx, name)), 200, h);
      }
      return json({error: 'not found'}, 404, h);
    }catch(e){
      const status = e.status || 500;
      return json(withSession(Object.assign({error: status === 500 ? 'the save service failed.' : e.message},
                                            e.conflicts ? {conflicts: e.conflicts} : {})), status, h);
    }
  }
};
