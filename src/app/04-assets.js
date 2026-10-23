/* ---------------------------------------------------------------------
   The sticker library.

   A sticker is a small square picture that can be dropped into any text on
   the chart the way an emoji can — inside an entry's label, a note, a
   language tab, a loose text block. The library itself is a flat list of
   {key, name, src}; a text refers to one by key, so the same picture used
   in twenty places is stored once.
   ------------------------------------------------------------------ */
/* ---------------------------------------------------------------------
   Embedded media.

   A comment on an entry is a piece of prose, and prose that describes a
   reality wants to be able to SHOW it — a frame from the episode, a clip
   of the scene. So a comment may carry figures the way a document does:
   they stand in the flow of the text, on lines of their own, at whatever
   width the column gives them.

   The store is a flat list of {key, name, kind, src}, exactly like the
   sticker library, and a comment refers to one by key — so the same
   picture used in three comments is stored once. `src` is normally an
   embedded data: URI, which is what keeps the chart a single file that
   needs nothing from the network; a link is allowed too, for a clip too
   large to embed, and then the chart needs the network to show it.

   Figures are for the COMMENT, not for the chart's own drawing: an entry's
   box holds a name, and a video cannot be drawn into SVG text. So the
   token is parsed everywhere and rendered only where there is a document
   to put it in — see tokenizeLabel, which drops it for every other reader.
   ------------------------------------------------------------------ */
const MEDIA_KINDS = new Set(['image', 'video']);
/* A picture or a clip kept BESIDE the page rather than inside it.
 *
 * Embedded, the chart's pictures were most of the page — 1.2 MB of one
 * clip in a 2.8 MB build — and every Save on the site carried all of
 * them again to change one word. So on the site a picture is a file of its
 * own, `media/<sha256 of its bytes>.<ext>`, and the chart names it by that
 * path. The name is what the bytes ARE, so a file never changes once
 * written, the same picture used twice is one file, and the write service
 * can check that what it is handed is what it is called.
 *
 * The path is relative, and resolved against the page: an <img> or an SVG
 * <image> given it fetches it from beside the page, which is where the
 * build and the site put the folder. Nothing else in the drawing has to
 * know. What does is anything that has to carry the picture somewhere the
 * folder is not — an exported page, a picture of the chart — and that
 * asks inlineMediaRefs for the bytes. */
const MEDIA_EXT = {
  'image/png':'png', 'image/jpeg':'jpg', 'image/gif':'gif', 'image/webp':'webp', 'image/avif':'avif',
  'image/svg+xml':'svg', 'image/bmp':'bmp', 'image/x-icon':'ico', 'image/vnd.microsoft.icon':'ico',
  'video/webm':'webm', 'video/mp4':'mp4', 'video/ogg':'ogv', 'video/quicktime':'mov'
};
/* Its patterns are written inside it rather than kept beside it: the model
   asks mediaSrcOk while it loads the chart, in part 02, before anything
   this part declares has been given a value. */
function mediaRefKind(src){
  const m = typeof src === 'string' && /^media\/[0-9a-f]{64}\.(png|jpg|gif|webp|avif|svg|bmp|ico|webm|mp4|ogv|mov)$/.exec(src);
  return m ? (/^(webm|mp4|ogv|mov)$/.test(m[1]) ? 'video' : 'image') : null;
}
/* Embedded pictures in a region's text, lifted out into the files they
   will be on the site: the text with each data: URI replaced by its path,
   and the files the service has not been sent yet. A tiny one stays where
   it is — a file of its own would cost a request to save a few hundred
   bytes. Matched by what stands before `;base64,`, for the same reason
   mediaSrcOk reads it that way: a recorder's `;codecs=vp9,opus` holds a
   comma. A type with no extension to its name stays embedded. */
const LIFT_MIN = 2048;
const DATA_URI_IN_TEXT = /data:((?:image|video)\/[A-Za-z0-9.+-]+)([^'"\\\s]*?);base64,([A-Za-z0-9+/]+=*)/g;
const MEDIA_REF_IN_TEXT = /media\/[0-9a-f]{64}\.(?:png|jpg|gif|webp|avif|svg|bmp|ico|webm|mp4|ogv|mov)/g;
const liftedRefs = new Map();   // data: URI -> its path, once worked out
const mediaSent = new Set();    // paths the service has taken in this page's life
async function mediaRefOf(uri, mime, b64){
  if(liftedRefs.has(uri)) return liftedRefs.get(uri);
  const ext = MEDIA_EXT[mime.toLowerCase()];
  let ref = null;
  if(ext){
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    ref = 'media/' + Array.from(d, b => b.toString(16).padStart(2, '0')).join('') + '.' + ext;
  }
  liftedRefs.set(uri, ref);
  return ref;
}
async function liftMedia(parts){
  const out = {}, files = {}, uris = {};
  for(const name of Object.keys(parts)){
    const text = parts[name];
    if(typeof text !== 'string'){ out[name] = text; continue; }
    const swap = new Map();
    for(const m of text.matchAll(DATA_URI_IN_TEXT)){
      if(m[0].length < LIFT_MIN || swap.has(m[0])) continue;
      const ref = await mediaRefOf(m[0], m[1], m[3]);
      if(!ref) continue;
      swap.set(m[0], ref);
      uris[ref] = m[0];
      if(!mediaSent.has(ref)) files[ref] = m[3];
    }
    out[name] = swap.size ? text.replace(DATA_URI_IN_TEXT, u => swap.get(u) || u) : text;
  }
  // `uris`: each path and the bytes it stands for, so a chart that comes
  // back from the service with paths in it can be given its bytes again.
  return {parts: out, files, uris};
}
/* And back: every path in a text replaced by the bytes it names, for a copy
   that will be opened where there is no folder beside it. A file that
   cannot be fetched keeps its path — the copy is then short of a
   picture, which is better than no copy. */
const refData = new Map();
function blobDataUrl(blob){
  return new Promise((ok, no)=>{
    const fr = new FileReader();
    fr.onload = ()=> ok(fr.result); fr.onerror = no;
    fr.readAsDataURL(blob);
  });
}
async function mediaRefData(ref){
  if(refData.has(ref)) return refData.get(ref);
  let uri = null;
  try{
    const r = await fetch(ref);
    if(r.ok){
      const ext = ref.slice(ref.lastIndexOf('.') + 1);
      const type = Object.keys(MEDIA_EXT).find(t => MEDIA_EXT[t] === ext);
      uri = await blobDataUrl(new Blob([await r.arrayBuffer()], {type}));
    }
  }catch(e){}
  if(uri) refData.set(ref, uri);
  return uri;
}
async function inlineMediaRefs(text){
  const refs = Array.from(new Set(String(text).match(MEDIA_REF_IN_TEXT) || []));
  if(!refs.length) return text;
  const got = new Map();
  for(const ref of refs){ const uri = await mediaRefData(ref); if(uri) got.set(ref, uri); }
  return String(text).replace(MEDIA_REF_IN_TEXT, r => got.get(r) || r);
}
function sanitizeMedia(list){
  const seen = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(m=>{
    if(!m || typeof m !== 'object') return;
    const key = typeof m.key === 'string' ? m.key.trim() : '';
    if(!key || !/^[A-Za-z0-9_-]+$/.test(key) || seen.has(key)) return;
    const src = typeof m.src === 'string' ? m.src.trim() : '';
    if(!mediaSrcOk(src)) return;
    seen.add(key);
    out.push({key, name: typeof m.name === 'string' ? m.name : key,
              kind: MEDIA_KINDS.has(m.kind) ? m.kind : 'image', src});
  });
  return out;
}
/* A figure is either carried in the file or fetched from the web, and
   nothing else. `data:` is how an embedded one travels; http(s) is how a
   linked one is reached. Everything else — javascript:, blob:, a bare
   file path — is refused, for the same reason an entry's link is: a chart
   can arrive from someone else, and opening it must not run their code. */
function mediaSrcOk(src){
  if(typeof src !== 'string' || !src) return false;
  if(mediaRefKind(src)) return true;
  /* An embedded one, header and all. Split on the marker rather than
     matched in one pattern: a real media type can carry parameters, and a
     browser's own recorder writes `;codecs=vp9,opus` — a comma inside the
     header, which no single expression reads without also swallowing the
     payload. What matters is what stands before `;base64,`. */
  const at = src.indexOf(';base64,');
  if(at > 5 && src.slice(0, 5).toLowerCase() === 'data:'){
    return /^(image|video)\/[a-z0-9.+-]+/i.test(src.slice(5, at));
  }
  return !!safeUrl(src) && /^https?:/i.test(safeUrl(src));
}
/* The same question about a picture that is not a figure.
 *
 * A sticker and an entry's portrait are drawn the same way a figure is, out
 * of bytes that can have come from somebody else's file — and they were not
 * asked it. Import sanitized MEDIA, TAGCATS and REFS and passed STICKERS
 * straight through, while a portrait went in as whatever `opts.image` said;
 * nothing about that ran anyone's code, because an <img> and an SVG <image>
 * do not execute a `javascript:` source, but "it happens not to be an <a>"
 * is not a rule anybody wrote down. A src on a foreign chart could still
 * name a host, and opening the chart would call on it.
 *
 * So the rule the figures already keep is the rule for every picture:
 * carried in the file, or fetched over http(s), and nothing else. Videos
 * are a figure's business alone — a sticker stands in a line of text. */
function pictureSrcOk(src){
  if(!mediaSrcOk(src)) return false;
  if(mediaRefKind(src)) return mediaRefKind(src) === 'image';
  const at = src.indexOf(';base64,');
  if(at > 5 && src.slice(0, 5).toLowerCase() === 'data:'){
    return /^image\//i.test(src.slice(5, at));
  }
  return true;
}
/* A sticker library from somewhere else, admitted on the same terms the
   figures are: a key the markup could actually name, and a source that is
   a picture. An item failing either is dropped rather than refused, so a
   chart with one bad sticker in it still opens — which is what sanitizeMedia
   does, and for the same reason. */
function sanitizeStickers(list){
  const seen = new Set(), out = [];
  (Array.isArray(list) ? list : []).forEach(s=>{
    if(!s || typeof s !== 'object') return;
    const key = typeof s.key === 'string' ? s.key.trim() : '';
    // The same shape the markup's {{s:key}} token will accept. A key outside
    // it could never be written down in a text, so it is not a sticker at
    // all — it is a record nothing can reach.
    if(!key || !/^[A-Za-z0-9_-]+$/.test(key) || seen.has(key)) return;
    const src = typeof s.src === 'string' ? s.src.trim() : '';
    if(!pictureSrcOk(src)) return;
    seen.add(key);
    const kept = {key, name: typeof s.name === 'string' ? s.name : key, src};
    if(pictureAnimOf(s.anim)) kept.anim = s.anim;
    out.push(kept);
  });
  return out;
}
const mediaMap = new Map();
function rebuildMediaMap(){
  mediaMap.clear();
  (typeof MEDIA !== 'undefined' ? MEDIA : []).forEach(m=>{
    if(m && m.key && m.src) mediaMap.set(m.key, m);
  });
}
rebuildMediaMap();
function mediaOf(key){ return mediaMap.get(key) || null; }
function uniqueMediaKey(base){
  let k = String(base || 'fig').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '').slice(0, 24) || 'fig';
  if(!mediaMap.has(k)) return k;
  let i = 2;
  while(mediaMap.has(k + '-' + i)) i++;
  return k + '-' + i;
}
/* One figure as HTML. It is contenteditable="false" so the caret steps
   over the whole thing rather than into it, and it carries its key so the
   writer can read it back out — the same contract a citation chip keeps. */
/* A figure's width, as a percentage of the column. Bounded at both ends:
   below a tenth it is a smudge nobody can see and cannot be grabbed to be
   made bigger again, and past the column there is nothing to gain. */
const FIGURE_MIN_W = 10;
function clampFigureWidth(v){
  const n = Math.round(Number(v));
  if(!Number.isFinite(n)) return null;
  return Math.max(FIGURE_MIN_W, Math.min(100, n));
}
function mediaFigureHtml(key, width){
  const m = mediaOf(key);
  if(!m){
    return `<span class="media-missing" data-media="${escapeHtml(key)}" contenteditable="false"` +
           ` title="This figure is no longer in the chart">\u25a2 figure</span>`;
  }
  const cap = escapeHtml(m.name || key);
  const inner = m.kind === 'video'
    ? `<video src="${escapeHtml(m.src)}" controls preload="metadata" playsinline></video>`
    : `<img src="${escapeHtml(m.src)}" alt="${cap}">`;
  const w = clampFigureWidth(width);
  /* The width is written on the element AND kept on a data attribute. The
     style is what the reader sees; the attribute is what the writer reads
     back, and reading a percentage back out of a style string is exactly
     the kind of round trip that loses a figure's size the first time a
     browser normalises it. */
  const sized = w ? ` data-w="${w}" style="width:${w}%"` : '';
  return `<span class="rich-figure" data-media="${escapeHtml(key)}"${sized} contenteditable="false"` +
         ` title="${cap}">${inner}<i class="fig-grip"></i></span>`;
}
const stickerMap = new Map();
function rebuildStickerMap(){
  stickerMap.clear();
  (typeof STICKERS !== 'undefined' ? STICKERS : []).forEach(s=>{
    if(s && s.key && s.src) stickerMap.set(s.key, s);
  });
}
rebuildStickerMap();
function stickerSrc(key){ const s = stickerMap.get(key); return s ? s.src : null; }
function stickerName(key){ const s = stickerMap.get(key); return s ? (s.name || key) : key; }
function stickerImgHtml(key){
  const src = stickerSrc(key);
  /* A sticker whose picture has been removed still carries its key. The
     placeholder used to be a bare span, so the editor could not tell it
     from a typed character: opening the entry and touching one key wrote
     the placeholder back as the literal ▢ and the citation was gone for
     good — even though deleting a sticker deliberately leaves the token
     behind so re-adding the picture brings it back. */
  if(!src) return `<span class="sticker-missing-inline" data-sticker="${escapeHtml(key)}" title="This sticker is no longer in the library">▢</span>`;
  return `<img class="sticker-inline" data-sticker="${escapeHtml(key)}" src="${escapeHtml(src)}" alt="${escapeHtml(stickerName(key))}">`;
}
/* A citation inside an editing surface is one atomic chip: contenteditable
   false, so the caret steps over it whole and a stray keystroke cannot
   leave "[1" behind. It shows the CURRENT number but carries the key, and
   only the key is read back out — see richHtmlToMarkup. */
function refChipHtml(key){
  const c = refColor();
  const style = c ? ` style="color:${escapeHtml(c)}"` : '';
  return `<span class="ref-chip" data-ref="${escapeHtml(key)}" contenteditable="false"${style} title="${escapeHtml(refTitle(key))}">${escapeHtml(refMarkText(key))}</span>`;
}
function refTitle(key){
  const i = refIndex(key);
  if(i < 0) return 'This reference no longer exists';
  return refBodyText(REFS[i]) || `Reference [${i+1}]`;
}
/* One run list as editor HTML. inlineToHtml is this, applied to a whole
   label; a reading's two halves go through it as well, which is what makes
   what is typed inside a reading look like what will be drawn. */
/* What a reading's half adds to the run it sits in.
 *
 * Both halves inherit that run — a reading inside a bold phrase is bold —
 * and the wrappers around the whole unit already say so. Writing the
 * inherited part again inside them said it twice, and every trip through
 * the editor wrapped it once more: `[[base|anno]]` in a bold phrase came
 * back as `[[**base**|**anno**]]`, then `[[****base****|…]]`, growing
 * without limit for as long as the label was edited. */
function rubyHalfRuns(unit, runs){
  const OWN = ['bold','italic','color','font','size','under','strike'];
  return (runs || []).map(rt=>{
    const c = Object.assign({}, rt);
    OWN.forEach(k=>{ if(unit[k] !== undefined && c[k] === unit[k]) delete c[k]; });
    return c;
  });
}
function runsToHtml(runs){
  return (runs || []).map(runToHtml).join('');
}
/* HTML is the one place a figure can actually be shown, so this is the one
   reader that asks for them. */
function inlineToHtml(label){
  return runsToHtml(tokenizeLabel(label, {media:true}));
}
function runToHtml(t){
  {
    /* Everything the run carries, wrapped from the outside in. A sticker
       and a citation are pictures rather than text, so bold, italic and
       colour are made inert on them by the stylesheet — but the SIZE
       wrapper still has to reach them, because both are drawn in `em` and
       that wrapper is how either of them is enlarged. */
    const inner =
      t.type === 'ref' ? refChipHtml(t.key) :
      t.type === 'media' ? mediaFigureHtml(t.key, t.w) :
      t.type === 'sticker' ? stickerImgHtml(t.key) :
      t.type === 'ruby'
        ? `<ruby>${runsToHtml(rubyHalfRuns(t, t.baseRuns))}` +
          `<rt>${runsToHtml(rubyHalfRuns(t, t.annoRuns))}</rt></ruby>` :
      escapeHtml(t.text);
    /* A figure takes no run dressing at all. Bold, a colour or a face on
       a paragraph says nothing about a picture inside it, and a size
       wrapper — which is how a sticker is enlarged — would fight the
       column width the figure is already sized to. */
    if(t.type === 'media') return inner;
    if(t.type === 'ref' || t.type === 'sticker'){
      return t.size
        ? `<span style="font-size:${t.size}px" data-size="${t.size}">${inner}</span>`
        : inner;
    }
    let html = inner;
    if(t.under || t.strike){
      const lines = [t.under ? 'underline' : '', t.strike ? 'line-through' : ''].filter(Boolean);
      const key = t.under || t.strike;
      const css = (LINE_STYLES[key] || LINE_STYLES.solid).css;
      html = `<span style="text-decoration-line:${lines.join(' ')};text-decoration-style:${css}"` +
             `${t.under ? ` data-under="${escapeHtml(t.under)}"` : ''}` +
             `${t.strike ? ` data-strike="${escapeHtml(t.strike)}"` : ''}>${html}</span>`;
    }
    if(t.italic) html = `<i>${html}</i>`;
    if(t.bold) html = `<b>${html}</b>`;
    if(t.size) html = `<span style="font-size:${t.size}px" data-size="${t.size}">${html}</span>`;
    if(t.font) html = `<span style="font-family:${escapeHtml(fontFamilyFor(t.font))}" data-font="${escapeHtml(t.font)}">${html}</span>`;
    if(t.color) html = `<span style="color:${escapeHtml(t.color)}">${html}</span>`;
    return html;
  }
}


/* How a moving picture moves: always (the absence of the field), never,
 * or only while the pointer is on the thing that wears it. Asked of a
 * picture an entry wears (`anim` among its options) and of a sticker (on
 * its record), and nowhere else — a figure in a note is read, not watched.
 *
 * A function rather than a list beside it for the reason mediaRefKind is
 * one: the model asks it while it loads the chart, in part 02, before
 * anything this part declares has a value. */
function pictureAnimOf(v){ return v === 'still' || v === 'hover' ? v : null; }

/* Whether a picture has more than one frame, from its own bytes: a GIF
 * by being one; a WebP by the animation bit of its VP8X header; a PNG by
 * the acTL chunk an animated one must carry before its first IDAT. Only
 * the head of the picture is decoded — a few kilobytes of a megabyte.
 *
 * A file beside the page is asked once, by fetching it (the service
 * worker usually has it), and the bar is drawn again when the answer is
 * in; until then it is a still picture, which only means the bar does not
 * offer to stop it yet. A picture from another host is a GIF or nothing:
 * its bytes are not ours to read. */
const pictureMovesKnown = new Map();
function animatedBytes(b){
  const at = (i, word)=> [...word].every((ch, k)=> b[i + k] === ch.charCodeAt(0));
  if(at(0, 'GIF8')) return true;
  if(at(0, 'RIFF') && at(8, 'WEBP')) return at(12, 'VP8X') && !!(b[20] & 0x02);
  if(b[0] === 0x89 && at(1, 'PNG')){
    for(let i = 8; i + 4 <= b.length; i++){
      if(at(i, 'acTL')) return true;
      if(at(i, 'IDAT')) return false;
    }
  }
  return false;
}
function pictureMoves(src){
  if(typeof src !== 'string' || !src) return false;
  if(pictureMovesKnown.has(src)) return pictureMovesKnown.get(src);
  let moves = false;
  const at = src.indexOf(';base64,');
  if(at > 5 && /^data:image\//i.test(src)){
    try{
      // A whole number of base64 quads, so the head decodes on its own.
      const head = atob(src.slice(at + 8, at + 8 + 5460));
      moves = animatedBytes(Uint8Array.from(head, ch=> ch.charCodeAt(0)));
    }catch(e){ moves = false; }
  } else if(/\.gif(?:[?#]|$)/i.test(src)){
    moves = true;
  } else if(mediaRefKind(src) === 'image' && /\.(png|webp)$/.test(src)){
    pictureMovesKnown.set(src, false);
    fetch(src).then(r=> r.ok ? r.arrayBuffer() : null).then(buf=>{
      if(!buf || !animatedBytes(new Uint8Array(buf, 0, Math.min(buf.byteLength, 4096)))) return;
      pictureMovesKnown.set(src, true);
      if(styleBarTarget) syncStyleBar();
    }).catch(()=>{});
    return false;
  }
  pictureMovesKnown.set(src, moves);
  return moves;
}

/* The same question of a file being chosen, before anything decides
   whether to redraw it: a picture that moves is kept as it came — a canvas
   keeps one frame — and an animated WebP or PNG (a messenger's sticker,
   most often) is as much a moving picture as a GIF. */
function fileMoves(file){
  if(!file) return Promise.resolve(false);
  if(/gif/i.test(file.type)) return Promise.resolve(true);
  if(!/png|webp/i.test(file.type) || !file.slice) return Promise.resolve(false);
  return file.slice(0, 4096).arrayBuffer()
    .then(buf=> animatedBytes(new Uint8Array(buf)), ()=> false);
}

/* The first frame of a moving picture, drawn once on a canvas and kept by
 * its source, for every place that wears it still. A picture from another
 * host taints the canvas and cannot be read back; it is left moving rather
 * than left blank — the one outcome worse than not stopping. */
const stillFrames = new Map();   // src -> {url, failed, waiting: [fn]}
function stillFrameOf(src, done){
  let f = stillFrames.get(src);
  if(f && (f.url || f.failed)){ done(f.url || null); return; }
  if(f){ f.waiting.push(done); return; }
  f = {url: null, failed: false, waiting: [done]};
  stillFrames.set(src, f);
  const settle = ()=>{ const w = f.waiting; f.waiting = []; w.forEach(fn=> fn(f.url)); };
  const img = new Image();
  img.onload = ()=>{
    try{
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1;
      c.getContext('2d').drawImage(img, 0, 0);
      f.url = c.toDataURL('image/png');
    }catch(e){ f.failed = true; }
    settle();
  };
  img.onerror = ()=>{ f.failed = true; settle(); };
  img.src = src;
}

/* Every <image> on the chart is given its picture here, with the way that
 * picture is to move. Moving is the picture itself; still and on-hover
 * draw its first frame, and on-hover swaps the picture back in while the
 * pointer is over the entry, note or card it belongs to (see the listener
 * below). Still and hover are asked of the canvas whether or not the
 * picture was found to move: what decides is the choice written down, and
 * a still copy of a still picture looks exactly like the picture.
 *
 * The element is hidden until its first frame is ready, so a picture
 * asked to stand still does not play a few frames first. */
function wearPicture(img, src, mode){
  const put = (u)=>{
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u);
    img.setAttribute('href', u);
  };
  mode = pictureAnimOf(mode);
  if(!mode){ put(src); return; }
  img.dataset.anim = mode;
  img.dataset.src = src;
  const known = stillFrames.get(src);
  if(known && (known.url || known.failed)){ put(known.url || src); return; }
  img.style.visibility = 'hidden';
  stillFrameOf(src, (url)=>{
    if(!img.dataset.playing) put(url || src);
    img.style.visibility = '';
  });
}
/* One listener for every picture that moves on hover: what the pointer is
 * over is followed up to the thing it belongs to, and that thing's
 * pictures play until the pointer is somewhere else. On a touch screen
 * the pointer is "over" for as long as the finger is down. */
let animHoverHost = null;
function playHostPictures(host, on){
  if(!host) return;
  host.querySelectorAll('image[data-anim="hover"]').forEach(img=>{
    const f = stillFrames.get(img.dataset.src);
    const u = on ? img.dataset.src : (f && f.url) || img.dataset.src;
    if(on) img.dataset.playing = '1'; else delete img.dataset.playing;
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u);
    img.setAttribute('href', u);
  });
}
document.addEventListener('pointerover', (ev)=>{
  const t = ev.target;
  const host = (t && t.closest) ? t.closest('g.node, g.edge-note, g.bio-card-g') : null;
  if(host === animHoverHost) return;
  playHostPictures(animHoverHost, false);
  animHoverHost = host;
  playHostPictures(host, true);
});
