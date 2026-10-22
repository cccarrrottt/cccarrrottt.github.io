/* ---------------------------------------------------------------------
   The chart as a file.

   Export is what actually frees this page from any host: it writes the
   current chart back into a complete copy of the document and hands it to
   you as a download. That file is the whole thing — drawing, editor,
   contents — and opens with no server, no account and no runtime. Import
   is the way back in: point it at any Rhizome Project page and this one takes
   on that chart.

   Import reads only the four marked regions, and parses them with a JSON
   reader rather than by running them. A chart file is data someone may
   have sent you; it should not be able to run code just because you opened
   it here.
   ------------------------------------------------------------------ */
const filePopover = document.getElementById('filePopover');
const fileStatusEl = document.getElementById('fileStatus');
const fileImportInput = document.getElementById('fileImportInput');

function setFileStatus(kind, msg){
  fileStatusEl.className = 'editor-status show ' + kind;
  fileStatusEl.textContent = msg;
}
function clearFileStatus(){ fileStatusEl.className = 'editor-status'; fileStatusEl.textContent = ''; }

function chartFileName(){
  const stamp = new Date().toISOString().slice(0,10);
  return `rhizome-project-${stamp}.html`;
}

/* Handing the viewer a file takes two entirely different routes.
 *
 * Outside claude.ai the page is just a page: a blob URL on an <a download>
 * saves the file, no permission involved. Inside the artifact viewer that
 * link is inert — and inert SILENTLY, with no event to catch, which is the
 * worst possible failure for a Save-your-work button. The viewer mediates
 * file offers through the downloads capability instead, which asks the
 * person before anything is written.
 *
 * So: use the capability when it is there, the link when it is not, and
 * never report a save that may not have happened. */
const capDownloadsPromise = (async()=>{
  if(!HOSTED) return null;
  try{ return (await claude.use('downloads')) || null; }catch(e){ return null; }
})();

function saveViaLink(text, name){
  const url = URL.createObjectURL(new Blob([text], {type:'text/html'}));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 30000);
}

/* The chart's CONTENTS, without the page around them.
 *
 * A full export is the whole application — six hundred kilobytes of
 * drawing code wrapped around a few kilobytes of entries — which is the
 * right thing to keep, and the wrong thing to hand to somebody who is
 * going to rebuild the page anyway. This writes the seven data regions and
 * nothing else, carrying the same markers, so the build step reads it with
 * exactly the same code it reads a full export with.
 *
 * It is small enough to attach to a message, which is the point: it is how
 * work done in the browser gets back to whoever maintains the sources
 * without anyone having to move six hundred kilobytes around. */
function chartDataOnly(){
  const parts = writeChartParts();
  return [
    '/* Rhizome Project — chart contents only.',
    '   Not a page: the entries, connector styles, stickers, tags,',
    '   references and settings, in the form the page stores them.',
    '   Rebuild with:  python3 build.py --pull <this file>',
    '   Or open the chart and use Import, which reads this too. */',
    ''
  ].join('\n') + '\n' + REGION_NAMES.map(name=>
    `/* @@EDIT:${name}:START@@ */\n${parts[name]}\n/* @@EDIT:${name}:END@@ */`
  ).join('\n\n') + '\n';
}
async function exportChartData(asJson){
  clearFileStatus();
  let out, name;
  try{
    /* A file is opened where the site's media folder is not, so the
       pictures it names go inside it. */
    out = await inlineMediaRefs(chartDataOnly());
    if(asJson) out = chartJsonText(chartJsonOf(out));
    name = chartFileName().replace(/\.html?$/i, '') + (asJson ? '.json' : '-data.js');
  }catch(e){
    setFileStatus('err', 'Export failed: ' + (e && e.message ? e.message : 'unknown error'));
    return;
  }
  const dl = await capDownloadsPromise;
  if(!dl){
    saveViaLink(out, name);
    setFileStatus(HOSTED ? '' : 'ok', HOSTED
      ? 'This copy cannot hand you a file. Open the editable copy and export from there.'
      : 'Exported as ' + name + '.');
    return;
  }
  setFileStatus('', 'Waiting for you to confirm the download\u2026');
  try{
    await dl.save({filename:name, data:out});
    setFileStatus('ok', 'Exported as ' + name + '.');
  }catch(e){
    if(e && e.code === 'declined'){ setFileStatus('', 'Export cancelled.'); return; }
    saveViaLink(out, name);
    setFileStatus('ok', 'Exported as ' + name + '.');
  }
}

async function exportChart(){
  clearFileStatus();
  let out, name;
  try{
    /* The copy is the one file there is. Opened from somebody's disk it is
       their own chart and edits into their own browser — the site is the only
       address where it starts as a reader. */
    out = ensureFullDocument(writeChart(await readOwnSource()));
    // The copy is one file, whatever the page it came from kept beside it.
    out = await inlineMediaRefs(out);
    name = chartFileName();
  }catch(e){
    setFileStatus('err', 'Export failed: ' + (e && e.message ? e.message : 'unknown error'));
    return;
  }

  const dl = await capDownloadsPromise;
  if(!dl){
    /* No capability. Off claude.ai that is normal and the link simply works.
       On claude.ai it means this copy was published without the downloads
       capability — a copy shared publicly has to be, because declaring any
       capability at all is what stops a page being shared that way. The link is then almost certainly inert, and saying
       "Exported" would be a lie. Try it anyway, since it costs nothing and
       may work, but describe it as an attempt. */
    saveViaLink(out, name);
    setFileStatus(HOSTED ? '' : 'ok', HOSTED
      ? 'This copy of the chart cannot hand you a file: it is published without download permission so that it stays publicly shareable. If no download appeared, open the editable copy and export from there.'
      : 'Exported as ' + name + '.');
    return;
  }

  setFileStatus('', 'Waiting for you to confirm the download\u2026');
  try{
    await dl.save({filename:name, data:out});
    setFileStatus('ok', 'Exported as ' + name + '.');
    return;
  }catch(e){
    const code = e && e.code;
    if(code === 'declined'){ setFileStatus('', 'Export cancelled.'); return; }
    if(code === 'rate_limited'){ setFileStatus('err', 'Another download prompt is still open \u2014 finish that one, then try again.'); return; }
    if(code === 'too_large'){ setFileStatus('err', 'This chart is too large for the viewer to hand over. Open it outside claude.ai and export there.'); return; }
    if(code !== 'rejected_extension' && code !== 'extension_not_enabled'){
      setFileStatus('err', 'Export failed: ' + ((e && e.message) || 'the viewer would not save the file') + '.');
      return;
    }
  }

  /* .html is not in every viewer's allowed set. The contents are what
     matter and they are unchanged, so offer the same bytes under .txt and
     say plainly that it needs renaming — a file the person has to rename
     beats no file at all. */
  const alt = name.replace(/\.html$/i, '') + '.html.txt';
  try{
    await capDownloadsPromise.then(d => d.save({filename:alt, data:out}));
    setFileStatus('ok', 'This viewer will not save .html files, so it saved ' + alt +
                        ' instead. Rename it to ' + name + ' and it will open as the chart.');
  }catch(e2){
    if(e2 && e2.code === 'declined'){ setFileStatus('', 'Export cancelled.'); return; }
    setFileStatus('err', 'This viewer would not save the file. Open the chart outside claude.ai and export there.');
  }
}

/* Pull the four regions out of another Rhizome Project page.

   The regions are JavaScript literals in the file, but they are read here
   as JSON — the two overlap for exactly the shapes this chart stores, and
   a JSON reader cannot execute anything. Anything that is not plain data
   is rejected instead of being run. */
function readRegionArray(src, name){
  const body = extractRegion(src, name);
  if(body === null) return null;
  const open = body.indexOf('[');
  const close = body.lastIndexOf(']');
  if(open === -1 || close < open) return null;
  const literal = jsLiteralToJson(body.slice(open, close+1));
  try{
    const val = JSON.parse(literal);
    return Array.isArray(val) ? val : null;
  }catch(e){ return null; }
}

/* The array literal this file writes, read back as JSON.
 *
 * This used to be four regular expressions run over the whole text, and
 * every one of them reached inside string contents it had no business
 * touching. `key:` -> `"key":` turned a label reading `Hello {{s:cat}}`
 * into `Hello {{"s":cat}}`, destroying the sticker; it quoted the `b:` in
 * an ordinary sentence like `Note: a, b: c`. The un-escaper knew `\'` and
 * `\\` but not `\n`, so every multi-line note came back with a visible
 * backslash-n in it. Import is the ONE path that does not need this page's
 * host to work, which makes silently rewriting the text it imports the
 * worst place in the file for a bug like this.
 *
 * So it is a scanner rather than a search-and-replace: it knows when it is
 * inside a string and when it is not, which is precisely the knowledge the
 * regular expressions lacked. It handles the subset this file emits —
 * strings, numbers, booleans, null, undefined, arrays, objects with bare
 * keys, comments and trailing commas — and nothing else, because nothing
 * else is ever written. */
function jsLiteralToJson(src){
  const isIdStart = c=> /[A-Za-z_$]/.test(c);
  const isIdPart  = c=> /[A-Za-z0-9_$]/.test(c);
  // Pieces, so the trailing-comma pass below can tell a comma in the
  // structure from one inside a string.
  const parts = [];                     // {s:string, str:boolean}
  let i = 0;
  const n = src.length;
  while(i < n){
    const ch = src[i];
    if(ch === "'" || ch === '"'){
      const quote = ch;
      let val = '';
      i++;
      while(i < n && src[i] !== quote){
        if(src[i] === '\\'){
          const e = src[i+1];
          i += 2;
          if(e === 'n') val += '\n';
          else if(e === 'r') val += '\r';
          else if(e === 't') val += '\t';
          else if(e === 'b') val += '\b';
          else if(e === 'f') val += '\f';
          else if(e === 'v') val += '\v';
          else if(e === '0') val += '\0';
          else if(e === 'u'){
            if(src[i] === '{'){
              const end = src.indexOf('}', i);
              val += String.fromCodePoint(parseInt(src.slice(i+1, end), 16) || 0);
              i = end + 1;
            } else { val += String.fromCharCode(parseInt(src.substr(i, 4), 16) || 0); i += 4; }
          }
          else if(e === 'x'){ val += String.fromCharCode(parseInt(src.substr(i, 2), 16) || 0); i += 2; }
          else if(e === '\n'){ /* a line continuation contributes nothing */ }
          else val += e;                 // \' \" \\ and anything else stands for itself
        } else { val += src[i]; i++; }
      }
      i++;                               // the closing quote
      parts.push({s: JSON.stringify(val), str: true});
      continue;
    }
    if(ch === '/' && src[i+1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
    if(ch === '/' && src[i+1] === '*'){ const e = src.indexOf('*/', i+2); i = e < 0 ? n : e + 2; continue; }
    if(isIdStart(ch)){
      let j = i;
      while(j < n && isIdPart(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while(k < n && /\s/.test(src[k])) k++;
      if(src[k] === ':'){                // a bare object key, and only there
        parts.push({s: JSON.stringify(word) + ':', str: false});
        i = k + 1;
        continue;
      }
      // The tuple slots that read `undefined` mean "absent"; JSON says null.
      parts.push({s: (word === 'undefined') ? 'null' : word, str: false});
      i = j;
      continue;
    }
    parts.push({s: ch, str: false});
    i++;
  }
  /* Trailing commas, resolved on the pieces rather than on the text: a
     comma inside a string is part of somebody's sentence. */
  for(let a = 0; a < parts.length; a++){
    if(parts[a].str || parts[a].s.trim() !== ',') continue;
    for(let b = a + 1; b < parts.length; b++){
      if(parts[b].str) break;
      const t = parts[b].s.trim();
      if(t === '') continue;
      if(t === ']' || t === '}') parts[a].s = '';
      break;
    }
  }
  return parts.map(x=> x.s).join('');
}

// The same reader, for the one region that holds an object rather than a
// list. Wrapped in brackets so the scanner sees a value in a position it
// understands, then unwrapped.
function readRegionObject(src, name){
  const body = extractRegion(src, name);
  if(body === null) return null;
  const open = body.indexOf('{'), close = body.lastIndexOf('}');
  if(open === -1 || close < open) return null;
  try{
    const val = JSON.parse(jsLiteralToJson('[' + body.slice(open, close+1) + ']'));
    return (Array.isArray(val) && val[0] && typeof val[0] === 'object') ? val[0] : null;
  }catch(e){ return null; }
}
/* The chart in a file, as plain values, whichever form the file is in:
   the regions a page or Export data writes, or the JSON Export as JSON
   writes (chartJsonOf). Everything after this reads the values and does
   not care which. */
function chartOfText(text){
  if(/^\s*\{/.test(text)){
    let d;
    try{ d = JSON.parse(text); }catch(e){ throw new Error('that file is not a chart: it reads as JSON, but not as JSON that parses.'); }
    if(!d || typeof d !== 'object' || !Array.isArray(d.nodes)) throw new Error('that file has no Rhizome Project chart in it.');
    const list = v=> Array.isArray(v) ? v : null;
    /* The form is said once, at the top, rather than inside the settings
       as the regions say it: it is about the whole file. */
    const settings = (d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings)) ? Object.assign({}, d.settings) : {};
    if(typeof d.format === 'number') settings.format = d.format;
    return {nodes: d.nodes, edgeStyles: list(d.edgeStyles), stickers: list(d.stickers), media: list(d.media),
            comments: list(d.comments), tagCats: list(d.tagCats), refs: list(d.refs), settings};
  }
  return {nodes: readRegionArray(text, 'NODES'), edgeStyles: readRegionArray(text, 'EDGESTYLES'),
          stickers: readRegionArray(text, 'STICKERS'), media: readRegionArray(text, 'MEDIA'),
          comments: readRegionArray(text, 'COMMENTS'), tagCats: readRegionArray(text, 'TAGCATS'),
          refs: readRegionArray(text, 'REFS'), settings: readRegionObject(text, 'SETTINGS')};
}
/* And the other way: the chart as JSON with every item a record, which
   is what chart.schema.json (published beside the site) describes. Made
   from the regions as written rather than from the page's working values,
   so it carries exactly what a Save would and nothing the page keeps for
   itself. Pictures are inside it, as they are in every file that leaves
   the site. */
function chartJsonOf(text){
  const c = chartOfText(text);
  const settings = Object.assign({}, c.settings || {});
  delete settings.format;
  return {
    $schema: SITE_ORIGINS[0] + '/chart.schema.json',
    format: DATA_FORMAT,
    nodes: (c.nodes || []).map(it=> recordOfEntry(entryOfRecord(it))),
    edgeStyles: c.edgeStyles || [], stickers: c.stickers || [], media: c.media || [],
    comments: c.comments || [], tagCats: c.tagCats || [], refs: c.refs || [], settings
  };
}
// One item to a line, as data.js is, so two exports compare line by line.
function chartJsonText(d){
  const keys = Object.keys(d);
  return '{\n' + keys.map((k, i)=>{
    const v = d[k], end = i < keys.length - 1 ? ',' : '';
    return Array.isArray(v) && v.length
      ? `  ${JSON.stringify(k)}: [\n${v.map(x=> '    ' + JSON.stringify(x)).join(',\n')}\n  ]${end}`
      : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${end}`;
  }).join('\n') + '\n}\n';
}
function importChartFromText(text){
  const c = chartOfText(text);
  const listed = c.nodes;
  if(!listed || !listed.length){
    throw new Error('that file has no Rhizome Project chart in it.');
  }
  const nodesIn = listed.map(entryOfRecord);
  const stylesIn = c.edgeStyles || [];
  const stickersIn = sanitizeStickers(c.stickers || []);
  const mediaIn = sanitizeMedia(c.media || []);
  const commentsIn = c.comments || [];
  /* Older exports predate categories and simply have no such region. That
     is not a broken file — it is a chart with no categories — so it reads
     as an empty list rather than refusing the import. */
  const catsIn = sanitizeTagCats(c.tagCats || []);
  const refsIn = sanitizeRefs(c.refs || []);
  /* And the chart's own settings, which import used to skip — so a chart
     brought in from a file quietly kept the OPEN chart's citation colour
     and lost its own. */
  const settingsIn = c.settings;
  /* A file written in a form this page does not know yet is a file from a
     newer page; read by this one it would come out partly, and wrongly. */
  if(settingsIn && typeof settingsIn.format === 'number' && settingsIn.format > DATA_FORMAT){
    throw new Error('that chart was saved by a newer version of the page. Open it there, or update this copy.');
  }
  // Validate before replacing anything, so a bad file leaves the open
  // chart untouched rather than half-overwritten.
  validateNodes(nodesIn);
  validateEdgeStyles(stylesIn);
  applyEdit(()=>{
    workingNodes = nodesIn;
    refill(EDGE_STYLES, stylesIn);
    refill(STICKERS, stickersIn);
    refill(MEDIA, mediaIn);
    refill(COMMENTS, commentsIn);
    refill(TAG_CATS, catsIn);
    refill(REFS, refsIn);
    if(settingsIn && typeof settingsIn.refColor === 'string' &&
       /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(settingsIn.refColor)){
      SETTINGS.refColor = settingsIn.refColor;
    } else {
      /* Like the legend below: a file that names no colour for its
         citations has the default one, not whatever the chart it
         replaced had been given. */
      SETTINGS.refColor = DEFAULT_REF_COLOR;
    }
    /* The legend's words belong to the chart they describe: brought in
       with it, and not left over from the chart it replaced. */
    const legendIn = cleanLegend(settingsIn && settingsIn.legend);
    if(Object.keys(legendIn).length) SETTINGS.legend = legendIn; else delete SETTINGS.legend;
    const rowsIn = cleanLegendRows(settingsIn);
    const tagColorsIn = cleanTagColors(settingsIn && settingsIn.tagColors);
    if(Object.keys(tagColorsIn).length) SETTINGS.tagColors = tagColorsIn; else delete SETTINGS.tagColors;
    const groundIn = cleanGroundColors(settingsIn && settingsIn.groundColors);
    if(Object.keys(groundIn).length) SETTINGS.groundColors = groundIn; else delete SETTINGS.groundColors;
    ['legendNames', 'legendHidden', 'legendAdded', 'legendOwn'].forEach(k=>{
      if(rowsIn[k]) SETTINGS[k] = rowsIn[k]; else delete SETTINGS[k];
    });
    // Last, so a step that adds an entry adds it to the chart coming in.
    migrateChart(chartFormatOf(settingsIn));
    rebuildStickerMap();
    rebuildMediaMap();
  });
  return nodesIn.length;
}

fileImportInput.addEventListener('change', ()=>{
  const file = fileImportInput.files && fileImportInput.files[0];
  fileImportInput.value = '';
  if(!file) return;
  const reader = new FileReader();
  reader.onerror = ()=> setFileStatus('err', 'Could not read that file.');
  reader.onload = ()=>{
    try{
      /* A read-only viewer's applyEdit is a no-op, so the import silently
         did nothing while this line congratulated them on it. */
      if(readOnlyView){
        setFileStatus('err', 'This copy is read-only, so nothing was imported.');
        return;
      }
      const n = importChartFromText(String(reader.result));
      setFileStatus('ok', `Imported ${n} ${n === 1 ? 'entry' : 'entries'}. Press Save to keep it.`);
    }catch(e){
      setFileStatus('err', 'Import failed: ' + (e && e.message ? e.message : 'unknown error'));
    }
  };
  reader.readAsText(file);
});

/* Whether Export can deliver anything is knowable before the button is
   pressed, so it is settled before the button is offered. On claude.ai, a
   copy published with no capabilities at all — so that it stays publicly
   shareable — has nothing to hand the viewer a file with, and a button
   that explains its own failure after the click is worse than a button
   that was never live. Resolved once, on first open of the panel. */
let exportGateDone = false;
async function gateExport(){
  if(exportGateDone) return;
  exportGateDone = true;
  if(!HOSTED) return;
  const btn = document.getElementById('fileExport');
  if(!btn) return;
  if(await capDownloadsPromise) return;
  btn.disabled = true;
  btn.title = 'This copy cannot hand you a file.';
  const note = document.getElementById('fileWhere');
  if(note) note.textContent = note.textContent +
    ' This copy cannot save a file to your computer \u2014 it is published without download permission so that it stays publicly shareable.';
}
function describeWhereItSaves(){
  const el = document.getElementById('fileWhere');
  if(!el) return;
  el.textContent = HOSTED
    ? 'Save publishes a new version of this page on claude.ai.'
    : ON_SITE
    ? (readOnlyView
        ? 'Only the chart\u2019s owner can change this page. Export takes a copy of your own that you can edit.'
        : 'Save sends the chart to the repository; the site shows it once it has been rebuilt, in a few minutes.')
    : (STORAGE_OK
        ? 'Save keeps this chart in this browser, for this file. Export to move it anywhere else.'
        : 'This browser will not let the page store anything, so Export is the only way to keep your work.');
}

document.getElementById('fileToggle').onclick = ()=>{
  const willOpen = !filePopover.classList.contains('open');
  closeToolbarMenus('filePopover');
  clearFileStatus();
  describeWhereItSaves();
  gateExport();
  const forget = document.getElementById('fileForget');
  forget.style.display = (!HOSTED && !ON_SITE && STORAGE_OK && readStoredChart()) ? '' : 'none';
  filePopover.classList.toggle('open', willOpen);
};
document.getElementById('fileClose').onclick = ()=> filePopover.classList.remove('open');
filePopover.addEventListener('click', ev=> ev.stopPropagation());
document.getElementById('fileExport').onclick = (ev)=>{ ev.stopPropagation(); exportChart(); };
document.getElementById('fileExportData').onclick = (ev)=>{ ev.stopPropagation(); exportChartData(); };
document.getElementById('fileExportJson').onclick = (ev)=>{ ev.stopPropagation(); exportChartData(true); };
/* ---------------------------------------------------------------------
   The chart as a picture
   ---------------------------------------------------------------------
   What is on the screen is already an SVG, so a picture is that SVG cut
   loose from the page: framed on everything drawn rather than on the
   window, with what the stylesheet gives each element written onto the
   element itself — a lone SVG file has no stylesheet, and without this
   every box would come out black. Only what differs from a bare element
   of the same kind is written, which keeps a large chart's file to a
   fraction of what writing every property would.

   Left out: whatever is there to be pressed or dragged rather than looked
   at (the handles, the bends, the guides), the patches drawn from far
   away, and the marks of suggestions. The entries are drawn as they are
   at full size whatever the zoom, and nothing is picked.

   The faces the chart is set in are carried inside the file, but only the
   pieces of them that hold a character the chart actually uses: a PNG is
   painted from the SVG as an image, and an image may not fetch anything,
   so a face left outside would come out as the system's. If the fonts
   cannot be fetched, the picture is still made, in the system's faces. */
const PICTURE_SKIP = '#lodLayer, #bendLayer, #guideLayer, #leaderPickLayer, #leaderHitLayer, ' +
  '#alignGrid, #suggestionLayer, .node-handles, .marquee, .connector-rubber, title';
const PICTURE_PROPS = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'opacity', 'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'dominant-baseline', 'letter-spacing', 'text-decoration', 'paint-order', 'marker-start', 'marker-mid',
  'marker-end', 'filter', 'mask', 'clip-path', 'mix-blend-mode', 'vector-effect', 'color',
  'transform', 'transform-origin', 'transform-box'];
function pictureBounds(){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  [bgLayer, backLayer, edgeLayer, nodeLayer, arrowLayer, frontLayer, bioCardLayer].forEach(layer=>{
    let b = null;
    try{ b = layer.getBBox(); }catch(e){ b = null; }
    if(!b || !(b.width || b.height)) return;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  });
  if(!Number.isFinite(x0)) return null;
  const pad = 40;
  return {x: Math.floor(x0 - pad), y: Math.floor(y0 - pad),
          w: Math.ceil(x1 - x0 + pad*2), h: Math.ceil(y1 - y0 + pad*2)};
}
function pictureGround(){
  for(let e = svg; e && e.nodeType === 1; e = e.parentElement){
    const c = getComputedStyle(e).backgroundColor;
    if(c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
  }
  return '#ffffff';
}
/* What a bare element of each kind computes to, to compare against. */
function pictureDefaults(probe, tag){
  if(!pictureDefaults.memo) pictureDefaults.memo = new Map();
  let d = pictureDefaults.memo.get(tag);
  if(!d){
    const e = document.createElementNS(NS, tag);
    probe.appendChild(e);
    const cs = getComputedStyle(e);
    d = {};
    PICTURE_PROPS.forEach(p=>{ d[p] = cs.getPropertyValue(p); });
    e.remove();
    pictureDefaults.memo.set(tag, d);
  }
  return d;
}
/* The drawing as it stands, as one self-contained SVG document. Taken in
   one go, with nothing in between that could redraw the chart under it:
   the patches seen from far away are put aside for the moment it takes,
   and put back. */
function chartPictureSvg(){
  const bounds = pictureBounds();
  if(!bounds) throw new Error('there is nothing on the chart to draw.');
  const body = document.body;
  const lod = body.classList.contains('lod');
  if(lod) body.classList.remove('lod');
  /* A site's icon is fetched from elsewhere and cannot go into the
     picture, so the arrow it stands in for is drawn instead. */
  const iconed = Array.from(svg.querySelectorAll('.node-link.has-icon'));
  iconed.forEach(g=> g.classList.remove('has-icon'));
  const probe = document.createElementNS(NS, 'g');
  svg.appendChild(probe);
  let out;
  try{
    const copy = svg.cloneNode(true);
    const live = [svg, ...svg.querySelectorAll('*')];
    const dead = [copy, ...copy.querySelectorAll('*')];
    // Hidden things are dropped rather than carried with display:none.
    for(let i = 0; i < live.length; i++){
      const a = live[i], b = dead[i];
      if(a === probe){ b.remove(); continue; }
      if(i && a.matches && a.matches(PICTURE_SKIP)){ b.remove(); continue; }
      const cs = getComputedStyle(a);
      if(i && cs.display === 'none'){ b.remove(); continue; }
      b.removeAttribute('class');
      /* The chart's own bookkeeping is not part of the picture — and some
         of it is joined with a NUL, which no XML file may contain. */
      Array.from(b.attributes).forEach(at=>{ if(at.name.startsWith('data-')) b.removeAttribute(at.name); });
      if(i === 0) continue;
      const d = pictureDefaults(probe, a.localName);
      const style = [];
      /* An element placed by its transform ATTRIBUTE keeps that, and the
         view's own pan and zoom is not carried at all — computed, it
         comes back as a matrix that would move the whole drawing. */
      const placed = a === viewport || a.hasAttribute('transform');
      PICTURE_PROPS.forEach(p=>{
        if(placed && p.startsWith('transform')) return;
        const v = cs.getPropertyValue(p);
        if(v && v !== d[p]) style.push(p + ':' + v);
      });
      if(style.length) b.setAttribute('style', style.join(';'));
      else b.removeAttribute('style');
    }
    /* Anything fetched from elsewhere: a picture may not fetch. One of the
       chart's own files is kept for now, and carried in by chartPictureText. */
    copy.querySelectorAll('image').forEach(im=>{
      const href = im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      if(!/^data:/i.test(href) && !mediaRefKind(href)) im.remove();
    });
    const vp = copy.querySelector('#viewport');
    if(vp) vp.removeAttribute('transform');
    copy.removeAttribute('id');
    copy.removeAttribute('style');
    copy.setAttribute('xmlns', NS);
    copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    copy.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
    copy.setAttribute('width', bounds.w);
    copy.setAttribute('height', bounds.h);
    const ground = document.createElementNS(NS, 'rect');
    ground.setAttribute('x', bounds.x); ground.setAttribute('y', bounds.y);
    ground.setAttribute('width', bounds.w); ground.setAttribute('height', bounds.h);
    ground.setAttribute('fill', pictureGround());
    copy.insertBefore(ground, copy.firstChild);
    out = {copy, bounds};
  } finally {
    probe.remove();
    iconed.forEach(g=> g.classList.add('has-icon'));
    if(lod) body.classList.add('lod');
  }
  return out;
}
/* Which characters of which faces the picture uses. */
function pictureFaces(copy){
  const used = new Map();
  copy.querySelectorAll('text, tspan').forEach(t=>{
    const fam = ((t.getAttribute('style') || '').match(/font-family:([^;]*)/) || [])[1];
    if(!fam) return;
    fam.split(',').forEach(f=>{
      const name = f.trim().replace(/^["']|["']$/g, '');
      if(!name) return;
      if(!used.has(name)) used.set(name, new Set());
      const set = used.get(name);
      for(const ch of t.textContent) set.add(ch.codePointAt(0));
    });
  });
  return used;
}
function inUnicodeRange(range, cps){
  if(!range) return true;
  const spans = range.split(',').map(r=>{
    const m = r.trim().replace(/^U\+/i, '').split('-');
    const a = parseInt(m[0].replace(/\?/g, '0'), 16), b = parseInt((m[1] || m[0]).replace(/\?/g, 'F'), 16);
    return [a, b];
  });
  for(const cp of cps) if(spans.some(([a, b])=> cp >= a && cp <= b)) return true;
  return false;
}
async function pictureFontCss(copy){
  const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
  if(!link) return '';
  const used = pictureFaces(copy);
  if(!used.size) return '';
  let css;
  try{
    const r = await fetch(link.href);
    if(!r.ok) return '';
    css = await r.text();
  }catch(e){ return ''; }
  const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
  const keep = [];
  for(const block of blocks){
    const fam = ((block.match(/font-family:\s*['"]?([^;'"]+)/) || [])[1] || '').trim();
    const cps = used.get(fam);
    if(!cps || !cps.size) continue;
    if(!inUnicodeRange((block.match(/unicode-range:\s*([^;]+)/) || [])[1], cps)) continue;
    const url = (block.match(/url\(([^)]+)\)/) || [])[1];
    if(!url) continue;
    try{
      const r = await fetch(url.replace(/^['"]|['"]$/g, ''));
      if(!r.ok) continue;
      const data = await blobDataUrl(await r.blob());
      keep.push(block.replace(/url\([^)]+\)/, 'url(' + data + ')'));
    }catch(e){}
  }
  return keep.join('\n');
}
async function chartPictureText(){
  const {copy, bounds} = chartPictureSvg();
  for(const im of copy.querySelectorAll('image')){
    const href = im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    if(!mediaRefKind(href)) continue;
    const uri = await mediaRefData(href);
    if(!uri){ im.remove(); continue; }
    im.setAttribute('href', uri);
    if(im.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', uri);
  }
  const fonts = await pictureFontCss(copy);
  if(fonts){
    const st = document.createElementNS(NS, 'style');
    st.textContent = fonts;
    copy.insertBefore(st, copy.firstChild);
  }
  // Whatever else XML forbids that a text on the chart might hold.
  const xml = new XMLSerializer().serializeToString(copy).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return {text: '<?xml version="1.0" encoding="UTF-8"?>\n' + xml, bounds};
}
/* Twice the chart's own size, unless that is more than a browser will
   paint onto one canvas — then as large as it will. */
function pictureScale(w, h){
  return Math.max(0.1, Math.min(2, 16000 / w, 16000 / h, Math.sqrt(120e6 / (w * h))));
}
async function chartPicturePng(){
  const {text, bounds} = await chartPictureText();
  const url = URL.createObjectURL(new Blob([text], {type:'image/svg+xml'}));
  try{
    const img = new Image();
    await new Promise((ok, no)=>{ img.onload = ok; img.onerror = ()=> no(new Error('the browser could not paint the drawing.')); img.src = url; });
    const k = pictureScale(bounds.w, bounds.h);
    const cv = document.createElement('canvas');
    cv.width = Math.round(bounds.w * k); cv.height = Math.round(bounds.h * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((ok, no)=> cv.toBlob(b=> b ? ok(b) : no(new Error('the picture is too large to paint.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
function saveBlobViaLink(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 30000);
}
async function exportPicture(kind){
  clearFileStatus();
  setFileStatus('', 'Drawing the picture…');
  const name = chartFileName().replace(/\.html$/, '.' + kind);
  try{
    const blob = kind === 'png' ? await chartPicturePng()
      : new Blob([(await chartPictureText()).text], {type:'image/svg+xml'});
    saveBlobViaLink(blob, name);
    setFileStatus(HOSTED ? '' : 'ok', HOSTED
      ? 'If no download appeared, this copy cannot hand you a file; open the chart outside claude.ai and export the picture there.'
      : 'Exported as ' + name + '.');
  }catch(e){
    setFileStatus('err', 'The picture was not made: ' + ((e && e.message) || 'unknown error'));
  }
}
document.getElementById('fileExportPng').onclick = (ev)=>{ ev.stopPropagation(); exportPicture('png'); };
document.getElementById('fileExportSvg').onclick = (ev)=>{ ev.stopPropagation(); exportPicture('svg'); };
document.getElementById('fileImport').onclick = (ev)=>{ ev.stopPropagation(); fileImportInput.click(); };
document.getElementById('fileForget').onclick = (ev)=>{
  ev.stopPropagation();
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  setFileStatus('ok', 'Forgotten. Reload to go back to what is in the file itself.');
};

/* ---------------------------------------------------------------------
   Who may edit.

   Write access is decided by the platform, not by this page: publishing
   runs with the viewer's own authority, and a viewer without write access
   is rejected with not_writer / not_granted no matter what the page does.
   So this is not a lock — it can't be picked, because there is nothing
   here to pick. It is the page telling the truth about a permission it
   does not control: once the platform has refused a write, every control
   that writes is hidden and the chart becomes a reader.

   There is no way to ask in advance without attempting a write (which
   would mint a version), so the first refusal is the signal — exactly
   what the capability's own guidance prescribes. The answer is then
   remembered per artifact, so a reader never sees editing controls again
   after their first visit. The owner is never refused and so never
   notices any of this.
   ------------------------------------------------------------------ */
/* Keyed per document. It used to be one flag for the whole origin, so
   being a reader of one chart could make every other chart on the same
   origin look read-only too. */
const READONLY_KEY = carryOverKey('axiomNexus.readOnly:' + (location.pathname || 'default'),
                                  'rhizome.readOnly:'  + (location.pathname || 'default'));
/* `sticky` is false for refusals that may not be about permission at all.
   The old code remembered EVERY refusal forever, so one transient failure
   — a consent prompt dismissed, a capability that failed to load — locked
   this browser out of editing permanently, with no way back. Only a plain
   "you are not a writer" is worth remembering. */
function markReadOnly(sticky){
  if(readOnlyView) return;
  readOnlyView = true;
  document.body.classList.add('read-only');
  if(sticky){ try{ localStorage.setItem(READONLY_KEY, '1'); }catch(e){} }
  setSaveState(null);
  // This can run during load (from the remembered answer below), before
  // the panels it tidies up have been declared — nothing is open that
  // early anyway, so each one is attempted separately and skipped if it
  // isn't there yet.
  try{ closeEditForm(); }catch(e){}
  try{ closeEdgePopover(); }catch(e){}
  /* …and drawn again, as markEditable does on the way back. Several
     controls are left out by asking readOnlyView while they are built —
     the side tabs' + buttons for a tag, a category and a reference, a
     reference's pencil and ✕, the citation colour — and on claude.ai the
     answer arrives after the first draw, so a reader was handed all of
     them, built for the editor the page had assumed it was. Before the
     first draw there is nothing to redo. */
  try{ if(nodes.size) rebuildChart(); }catch(e){}
}
/* On the published site every visitor starts as a reader, and says so on
   the first frame rather than drawing an editor and taking it away. The
   owner is let back in by markEditable below, once the write service has
   confirmed who they are — see SITE_API in 01-store.js and the sign-in in
   36-site-owner.js. */
if(ON_SITE) markReadOnly(false);
/* The way back, which only the site uses. Everything that hides an editing
   control does it through `body.read-only` or by asking readOnlyView while
   it draws, so lifting the flag and drawing again is the whole of it. */
function markEditable(){
  if(!readOnlyView) return;
  readOnlyView = false;
  document.body.classList.remove('read-only');
  try{ rebuildChart(); }catch(e){}
  try{ refreshSaveUI(); }catch(e){}
  try{ lookForDraft(); }catch(e){}
}
function isReadOnlyError(e){
  const code = e && e.code;
  return code === 'not_writer' || code === 'not_granted' ||
         code === 'not_declared' || code === 'consent_required';
}
// Only these two actually mean "this viewer may not write".
function isPermanentRefusal(e){
  const code = e && e.code;
  return code === 'not_writer' || code === 'not_granted';
}
/* Remembered read-only applies only where a host decides who may write.
   Off-platform there is no such authority — the page saves into this
   browser — so a flag left over from a hosted visit must not follow the
   file onto a disk and make it look frozen. */
if(HOSTED){
  try{ if(localStorage.getItem(READONLY_KEY) === '1') markReadOnly(true); }catch(e){}
}

/* ---------------------------------------------------------------------
   Suggestions.

   A reader who thinks an entry is wrong, missing or not wanted says so here,
   and the suggestion becomes an issue in the chart's repository, written
   under the reader's own GitHub account. It is not stored in the chart:
   kept there, every suggestion would be a commit, a rebuild of the site,
   and an owner's open page suddenly behind the repository and refused at
   Save. The write service (worker/index.js) does the writing; this is the
   form and the list.

   So it exists only on the published site, where the write service is.
   Anywhere else — a disk, claude.ai — there is nobody to carry a
   suggestion, and the button is not shown rather than shown and failing.

   A reader signs in to suggest, with the same GitHub sign-in the owner
   uses, asked for as a reader's (`as=reader`). That session can read and
   write suggestions and nothing else; the service checks it on every
   request, and Save still asks for an owner. The owner sees the same list
   with a way to close each one, and a mark on every entry that has one
   open.

   The COMMENTS region is still carried by Save, Export and Import as it
   always was. It is what the earlier, claude.ai-era suggestions were kept
   in, and a chart that has some keeps them; nothing here writes to it.
   ------------------------------------------------------------------ */
const commentsOverlay = document.getElementById('commentsOverlay');
const commentsToggle = document.getElementById('commentsToggle');
const commentKind = document.getElementById('commentStatus');
const commentText = document.getElementById('commentText');
const commentTitle = document.getElementById('commentTitle');
const commentList = document.getElementById('commentList');
const commentMsgEl = document.getElementById('commentStatusMsg');
const suggestAbout = document.getElementById('suggestAbout');
const suggestSignInBtn = document.getElementById('suggestSignIn');
const suggestSwitchBtn = document.getElementById('suggestSwitch');
const suggestSubmitBtn = document.getElementById('commentSubmit');
const suggestNote = document.getElementById('suggestNote');
const detailSuggest = document.getElementById('detailSuggest');
const COMMENT_KINDS = ['correction','addition','deletion'];
const SUGGESTIONS_ON = ON_SITE && !!SITE_API;
/* The entry the next suggestion is about, or null for the chart as a whole. */
let suggestEntry = null;
let suggestBusy = false;

function setCommentMsg(kind, msg){
  commentMsgEl.className = 'editor-status show ' + kind;
  commentMsgEl.textContent = msg;
}
function clearCommentMsg(){ commentMsgEl.className = 'editor-status'; commentMsgEl.textContent = ''; }
function suggestionsOpen(){ return commentsOverlay.classList.contains('open'); }
function suggestSignedIn(){ return !!(siteSession() && (siteOwner || siteReader)); }
function entryName(id){
  const n = id && nodes.get(id);
  return n ? (stripMarkup(n.label || '').replace(/\s+/g, ' ').trim() || id) : null;
}

/* What the form says it is about, and what can be done from it — signed
   in or not, and whether the service has answered yet. */
function paintSuggestForm(){
  const name = entryName(suggestEntry);
  suggestAbout.textContent = '';
  const lead = document.createElement('span');
  lead.textContent = name ? 'About ' : 'About the chart as a whole';
  suggestAbout.appendChild(lead);
  if(name){
    const b = document.createElement('b');
    b.textContent = name;
    const clear = document.createElement('button');
    clear.type = 'button'; clear.className = 'editor-btn';
    clear.textContent = 'The whole chart instead';
    clear.onclick = ()=>{ suggestEntry = null; paintSuggestForm(); };
    suggestAbout.append(b, clear);
  }
  const signed = suggestSignedIn();
  suggestSignInBtn.hidden = signed;
  if(suggestSwitchBtn) suggestSwitchBtn.hidden = !signed;
  suggestSubmitBtn.hidden = !signed;
  suggestSubmitBtn.disabled = suggestBusy;
  commentKind.disabled = commentText.disabled = !signed;
  if(commentTitle) commentTitle.disabled = !signed;
  suggestNote.textContent = signed
    ? `Posted as ${siteOwner || siteReader}, as an issue in the chart’s repository on GitHub — you can follow it there, and the owner is told.`
    : 'Suggestions are kept as issues in the chart’s repository on GitHub, so posting one takes a GitHub account. Signing in lets you suggest and nothing else.';
}

function openSuggestions(entry){
  if(!SUGGESTIONS_ON) return;
  suggestEntry = entry && nodes.has(entry) ? entry : null;
  clearCommentMsg();
  paintSuggestForm();
  commentsOverlay.classList.add('open');
  loadSuggestions();
}

/* The open suggestions, from the service. Signed out there is nothing to
   ask with — the list is read with the reader's own sign-in — so the panel
   says so instead. */
async function loadSuggestions(){
  if(!SUGGESTIONS_ON) return;
  if(!suggestSignedIn()){ await loadPublicSuggestions(); return; }
  let answer = null;
  try{ answer = await siteRequest('/suggestions'); }catch(e){}
  if(!answer){ renderSuggestions('The suggestions could not be fetched — no connection to the service.'); return; }
  const {res, body} = answer;
  if(res.status === 401){ forgetSiteSession(); paintSuggestForm(); renderSuggestions('Your sign-in has run out. Sign in again to see the suggestions.'); return; }
  if(!res.ok || !body || !Array.isArray(body.suggestions)){
    renderSuggestions((body && body.error) ? 'The service said: ' + body.error : 'The suggestions could not be fetched.');
    return;
  }
  siteSuggestions = body.suggestions;
  renderSuggestions();
  paintSuggestionMarks();
}

/* Signed out, the list is read from GitHub directly. The repository is
   public, and so are its issues; nobody has to sign in to read what the
   site is being asked to change, only to ask. GitHub allows a browser
   sixty such reads an hour, which a reader opening the panel will not
   come near, so nothing is kept between visits.
 *
   An issue is taken for a suggestion by the same rule the write service
   applies (readSuggestion in worker/index.js): the LAST marker in its
   text, naming a kind it knows. Kept in step by hand — the suite feeds
   both the same issues. */
const SUGGESTION_MARK = 'rhizome-suggestion:';
const SUGGESTION_PAGES = 3;
function readSuggestionIssue(issue){
  if(!issue || issue.pull_request || typeof issue.body !== 'string') return null;
  const at = issue.body.lastIndexOf('<!-- ' + SUGGESTION_MARK);
  if(at < 0) return null;
  const end = issue.body.indexOf(' -->', at);
  let mark;
  try{ mark = JSON.parse(decodeURIComponent(issue.body.slice(at + 5 + SUGGESTION_MARK.length, end < 0 ? undefined : end))); }
  catch(e){ return null; }
  if(!mark || COMMENT_KINDS.indexOf(mark.kind) < 0) return null;
  const head = mark.kind[0].toUpperCase() + mark.kind.slice(1) + ': ';
  const t = mark.titled && typeof issue.title === 'string' ? issue.title : '';
  return {number: issue.number, kind: mark.kind, entry: typeof mark.entry === 'string' ? mark.entry : null,
          title: t ? (t.startsWith(head) ? t.slice(head.length) : t).trim() || null : null,
          text: issue.body.slice(0, at).replace(/\s+$/, ''), login: issue.user && issue.user.login,
          at: String(issue.created_at || '').slice(0, 10), url: issue.html_url};
}
async function loadPublicSuggestions(){
  const out = [];
  try{
    for(let n = 1; n <= SUGGESTION_PAGES; n++){
      const res = await fetch(`https://api.github.com/repos/${SITE_REPO}/issues?state=open&per_page=100&page=${n}`,
                              {headers: {'Accept': 'application/vnd.github+json'}});
      if(!res.ok){
        renderSuggestions(res.status === 403 || res.status === 429
          ? 'GitHub is not answering this browser for a while. Sign in to see the suggestions now.'
          : 'The suggestions could not be fetched from GitHub.');
        return;
      }
      const page = await res.json();
      if(!Array.isArray(page)) break;
      page.forEach(i=>{ const s = readSuggestionIssue(i); if(s) out.push(s); });
      if(page.length < 100) break;
    }
  }catch(e){
    renderSuggestions('The suggestions could not be fetched — no connection to GitHub.');
    return;
  }
  // Signed in while this was on its way: the service's answer is the one.
  if(suggestSignedIn()) return;
  siteSuggestions = out;
  renderSuggestions();
  paintSuggestionMarks();
}

/* Every string here came from a GitHub account that is not this page's
   owner, so all of it goes in as text — none of it as markup. */
function renderSuggestions(empty){
  commentList.innerHTML = '';
  const list = siteSuggestions || [];
  if(empty || !list.length){
    const p = document.createElement('div');
    p.className = 'comment-empty';
    p.textContent = empty || 'Nothing open — no suggestions waiting.';
    commentList.appendChild(p);
    return;
  }
  list.forEach(c=>{
    const kind = COMMENT_KINDS.includes(c.kind) ? c.kind : 'correction';
    const item = document.createElement('div');
    item.className = 'comment-item k-' + kind;

    const head = document.createElement('div');
    head.className = 'comment-head';
    const who = document.createElement('span');
    who.className = 'comment-who'; who.textContent = c.login || 'someone';
    const kindEl = document.createElement('span');
    kindEl.className = 'comment-kind'; kindEl.textContent = kind;
    const when = document.createElement('span');
    when.textContent = c.at || '';
    head.append(who, kindEl, when);

    const about = document.createElement('div');
    about.className = 'comment-about';
    const name = entryName(c.entry);
    if(name){
      const go = document.createElement('button');
      go.type = 'button'; go.className = 'comment-entry';
      go.textContent = name;
      go.title = 'Show this entry on the chart';
      go.onclick = ()=>{ commentsOverlay.classList.remove('open'); selectNode(c.entry); flyToNode(c.entry); };
      about.append('About ', go);
    } else {
      // An entry since deleted or renamed out of existence reads as what it was.
      about.textContent = c.entry ? `About an entry no longer on the chart (${c.entry})` : 'About the chart as a whole';
    }

    /* The reader's own title, when they gave one, heads what they wrote. */
    const title = document.createElement('div');
    title.className = 'comment-title';
    title.textContent = c.title || '';
    title.hidden = !c.title;

    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = c.text || '';

    const actions = document.createElement('div');
    actions.className = 'comment-actions';
    if(/^https:\/\/github\.com\//.test(c.url || '')){
      const link = document.createElement('a');
      link.href = c.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'editor-btn'; link.textContent = 'On GitHub';
      actions.appendChild(link);
    }
    if(siteOwner){
      const done = document.createElement('button');
      done.type = 'button'; done.className = 'editor-btn';
      done.textContent = 'Done'; done.title = 'Close it as done';
      done.onclick = ()=> resolveSuggestion(c, 'completed', done);
      const no = document.createElement('button');
      no.type = 'button'; no.className = 'editor-btn';
      no.textContent = 'Decline'; no.title = 'Close it as not planned';
      no.onclick = ()=> resolveSuggestion(c, 'not_planned', no);
      actions.append(done, no);
    }
    item.append(head, about, title, body, actions);
    commentList.appendChild(item);
  });
}

async function resolveSuggestion(c, reason, btn){
  btn.disabled = true;
  let answer = null;
  try{
    answer = await siteRequest('/resolve', {method:'POST', headers:{'Content-Type':'application/json'},
                                            body: JSON.stringify({number: c.number, reason})});
  }catch(e){}
  if(!answer || !answer.res.ok){
    btn.disabled = false;
    setCommentMsg('err', (answer && answer.body && answer.body.error) ? 'Not closed: ' + answer.body.error : 'Not closed — no connection to the service.');
    return;
  }
  siteSuggestions = (siteSuggestions || []).filter(x=> x.number !== c.number);
  renderSuggestions();
  paintSuggestionMarks();
}

/* The same bargain as the rich fields: Enter posts, Shift+Enter breaks the
   line. A plain textarea answers Enter with a newline of its own, so the
   default has to be taken away before the button is pressed. */
/* Enter in the title goes on to the words: a suggestion is not finished
   when its title is. */
if(commentTitle) commentTitle.addEventListener('keydown', ev=>{
  if(ev.key !== 'Enter' || ev.isComposing) return;
  ev.preventDefault();
  commentText.focus();
});
commentText.addEventListener('keydown', ev=>{
  if(ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
  ev.preventDefault();
  if(!suggestSubmitBtn.hidden && !suggestSubmitBtn.disabled) suggestSubmitBtn.click();
});
suggestSubmitBtn.onclick = async ()=>{
  clearCommentMsg();
  const text = commentText.value.trim();
  const kind = COMMENT_KINDS.includes(commentKind.value) ? commentKind.value : 'correction';
  if(!text){ setCommentMsg('err', 'Say what should change.'); return; }
  suggestBusy = true; paintSuggestForm();
  let answer = null;
  try{
    answer = await siteRequest('/suggest', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({kind, text, entry: suggestEntry, label: entryName(suggestEntry) || '',
                            title: commentTitle ? commentTitle.value.trim() : ''})});
  }catch(e){}
  suggestBusy = false;
  if(answer && answer.res.status === 401) forgetSiteSession();
  paintSuggestForm();
  if(!answer){ setCommentMsg('err', 'Not posted — no connection to the service. What you wrote is still here.'); return; }
  const {res, body} = answer;
  if(!res.ok){ setCommentMsg('err', 'Not posted: ' + ((body && body.error) || 'the service refused it.')); return; }
  commentText.value = '';
  if(commentTitle) commentTitle.value = '';
  if(body && body.suggestion && body.suggestion.number) siteSuggestions = [body.suggestion].concat(siteSuggestions || []);
  renderSuggestions();
  paintSuggestionMarks();
  setCommentMsg('ok', 'Posted. Thank you — the owner has been told.');
};
suggestSignInBtn.onclick = ()=> siteSignIn('reader');
/* Whoever is signed in on this page stays signed in until they leave —
   the owner included — so a second account has to be asked for: the
   page lets go of the one it has, and GitHub is asked to offer a choice
   of account rather than quietly use the one the browser is signed in to. */
if(suggestSwitchBtn) suggestSwitchBtn.onclick = ()=>{
  siteSignOut();
  paintSuggestForm();
  siteSignIn('reader');
};

/* A small mark on every entry with something open about it, so the owner
   sees where the suggestions are without opening the list. Drawn into a
   layer of its own over the chart, after every rebuild, since the entries
   it sits on may have moved. Nothing to press: the list is where they are
   read. */
function paintSuggestionMarks(){
  const old = document.getElementById('suggestionLayer');
  if(old) old.remove();
  if(!siteSuggestions || !siteSuggestions.length) return;
  const count = new Map();
  siteSuggestions.forEach(c=>{ if(c.entry && nodes.has(c.entry)) count.set(c.entry, (count.get(c.entry) || 0) + 1); });
  if(!count.size) return;
  const layer = el('g', {id:'suggestionLayer', style:'pointer-events:none;'}, viewport);
  count.forEach((k, id)=>{
    const n = nodes.get(id);
    if(nodeHidden(n)) return;
    const g = el('g', {class:'suggestion-mark', 'data-id': id, transform:`translate(${n.x + n.w},${n.y})`}, layer);
    el('circle', {r: 6}, g);
    const t = el('text', {y: 3, 'text-anchor':'middle'}, g);
    t.textContent = String(k);
  });
}

if(SUGGESTIONS_ON){
  commentsToggle.style.display = '';
  if(detailSuggest) detailSuggest.hidden = false;
}
commentsToggle.onclick = ()=> openSuggestions(null);
if(detailSuggest) detailSuggest.onclick = ()=> openSuggestions(selectedId);
document.getElementById('commentsClose').onclick = ()=> commentsOverlay.classList.remove('open');
commentsOverlay.addEventListener('click', e=>{ if(e.target===commentsOverlay) commentsOverlay.classList.remove('open'); });

// The baseline everything is compared against: whatever the page was
// carrying when it loaded. Set once, and again after each successful save.
savedParts = snapshotParts();
refreshSaveUI();

// Leaving with unsaved work should ask first - everything lives in this
// tab until Save, so a stray refresh would otherwise take it all.
window.addEventListener('beforeunload', e=>{
  if(!isDirty()) return;
  e.preventDefault();
  e.returnValue = '';
});


/* ---------------------------------------------------------------------
   The draft: unsaved work kept against the page closing without asking.

   The question beforeunload asks is only asked when there is someone to
   ask. A power cut, a crash, a laptop whose battery ran out — the page is
   simply gone, and with it everything since the last Save. So while
   there is unsaved work, a copy of it is kept in this browser a moment
   after each edit, and the next time this page opens it offers it back:
   restore it, or throw it away. Nothing is put back without being asked —
   the chart the page opens with is still the published one until the
   reader says otherwise — and a Save, or undoing back to what was saved,
   removes the copy, because there is nothing left for it to protect.

   It is kept in IndexedDB rather than localStorage. A chart carries
   pictures, and a megabyte or two of base64 is past what localStorage
   will hold on some browsers; IndexedDB stores the chart as it is, and
   does it off the main thread, so keeping a copy after every keystroke
   costs the typing nothing. One copy per page, under the same key the
   chart is saved under in this browser.
   ------------------------------------------------------------------ */
const DRAFT_DB_NAME = 'rhizome.drafts', DRAFT_STORE = 'drafts';
/* Long enough for a burst of typing to be one write, short enough that a
   power cut takes no more than the last few keystrokes. */
const DRAFT_DELAY = 700;
let draftDbPromise = null;
function draftDb(){
  if(draftDbPromise) return draftDbPromise;
  draftDbPromise = new Promise(resolve=>{
    try{
      if(typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DRAFT_DB_NAME, 1);
      req.onupgradeneeded = ()=>{ req.result.createObjectStore(DRAFT_STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> resolve(null);
      req.onblocked = ()=> resolve(null);
    }catch(e){ resolve(null); }
  });
  return draftDbPromise;
}
async function draftDo(mode, fn){
  const db = await draftDb();
  if(!db) return null;
  return new Promise(resolve=>{
    try{
      const tx = db.transaction(DRAFT_STORE, mode);
      const req = fn(tx.objectStore(DRAFT_STORE));
      tx.oncomplete = ()=> resolve(req ? req.result : true);
      tx.onerror = tx.onabort = ()=> resolve(null);
    }catch(e){ resolve(null); }
  });
}
function readDraft(){ return draftDo('readonly', st=> st.get(STORE_KEY)); }
function dropDraft(){ return draftDo('readwrite', st=> st.delete(STORE_KEY)); }
/* A fingerprint of a chart, so a draft can say which saved chart it was
   made on top of. Not a security measure — only a way to notice that the
   chart has been saved somewhere else since, which is the one case where
   restoring the draft would quietly undo somebody's later work. */
function chartPrint(data){
  const text = JSON.stringify(data);
  let h = 0x811c9dc5;
  for(let i = 0; i < text.length; i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + text.length;
}
function writeDraftNow(){
  clearTimeout(draftTimer);
  draftTimer = 0;
  if(!draftLooked) return;
  if(readOnlyView || !isDirty()){ dropDraft(); return; }
  /* Handed over as it is: the store takes its own copy at the moment of
     the put, so a later edit cannot reach into the kept one. */
  draftDo('readwrite', st=> st.put({at: Date.now(), base: draftBase, data: chartData()}, STORE_KEY));
}
function scheduleDraft(){
  if(!draftLooked) return;
  if(!isDirty()){
    clearTimeout(draftTimer); draftTimer = 0;
    /* Clean again — just saved, or undone back to what was saved. This
       is the chart a draft written from here on is made on top of. */
    try{ draftBase = chartPrint(chartData()); }catch(e){}
    /* …unless it is the one being offered back, which is the reader's to
       keep or throw away. */
    if(!draftOffer) dropDraft();
    return;
  }
  clearTimeout(draftTimer);
  draftTimer = setTimeout(writeDraftNow, DRAFT_DELAY);
}
/* The last edit before the page goes away is written at once rather than
   left on the timer: a tab being closed or hidden gives the page a moment,
   and the moment is spent here. */
window.addEventListener('pagehide', ()=>{ if(draftTimer) writeDraftNow(); });
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden' && draftTimer) writeDraftNow();
});
/* Putting a kept chart back. One undo step, like an import: the page is
   then simply dirty, and Save publishes it the usual way. */
function restoreChartData(data){
  applyEdit(()=> putChartData(data));
  try{ buildSideTabs(); }catch(e){}
}
/* The putting back itself, with no undo step and no redraw — for the one
   caller that is not an edit: a Save kept on this device and not yet sent
   (36-site-owner), which is what the chart IS on this device until it goes. */
function putChartData(data){
  if(Array.isArray(data.nodes)) workingNodes = data.nodes.map(it=> Array.isArray(it) ? it.slice() : it);
  if(Array.isArray(data.edgeStyles)) refill(EDGE_STYLES, data.edgeStyles);
  if(Array.isArray(data.stickers)) refill(STICKERS, data.stickers);
  if(Array.isArray(data.media)) refill(MEDIA, data.media);
  if(Array.isArray(data.comments)) refill(COMMENTS, data.comments);
  if(Array.isArray(data.tagCats)) refill(TAG_CATS, data.tagCats);
  if(Array.isArray(data.refs)) refill(REFS, data.refs);
  if(data.settings && typeof data.settings === 'object'){
    Object.keys(SETTINGS).forEach(k=> delete SETTINGS[k]);
    Object.assign(SETTINGS, data.settings);
  }
  /* Kept by this page, or by an older one: a draft can outlive an update,
     and was written in the form of the page that kept it. */
  migrateChart(chartFormatOf(data.settings));
  rebuildStickerMap();
  rebuildMediaMap();
}
let draftOffer = null;
function hideDraftBar(){
  const bar = document.getElementById('draftBar');
  if(bar) bar.remove();
  draftOffer = null;
}
function showDraftBar(draft, stale){
  hideDraftBar();
  draftOffer = draft;
  const bar = document.createElement('div');
  bar.id = 'draftBar';
  bar.className = 'draft-bar';
  bar.setAttribute('role', 'alert');
  let when = '';
  try{
    when = new Date(draft.at).toLocaleString(undefined,
      {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
  }catch(e){}
  bar.innerHTML =
    `<div class="draft-words"><b>Unsaved changes were kept</b>` +
    `<span>${escapeHtml(when ? 'from ' + when + ', ' : '')}when this page last closed without saving.` +
    (stale ? ' The chart has been saved since then; restoring will put back the older version.' : '') +
    `</span></div>` +
    `<button type="button" class="draft-restore">Restore</button>` +
    `<button type="button" class="draft-discard">Discard</button>`;
  bar.querySelector('.draft-restore').addEventListener('click', ()=>{
    const d = draftOffer;
    hideDraftBar();
    if(d && d.data) restoreChartData(d.data);
    setSaveState('dirty', 'Restored — not saved yet');
  });
  bar.querySelector('.draft-discard').addEventListener('click', ()=>{
    hideDraftBar();
    if(!isDirty()) dropDraft();
  });
  document.body.appendChild(bar);
}
/* Looked for once the page can edit: at once where it can from the start,
   and when the owner is confirmed on the site, where it starts as a
   reader. A reader never has a draft to be offered. */
async function lookForDraft(){
  if(draftLooked) return;
  if(readOnlyView) return;
  draftLooked = true;
  try{ draftBase = chartPrint(chartData()); }catch(e){}
  const draft = await readDraft();
  if(!draft || !draft.data || !Array.isArray(draft.data.nodes)) return;
  let same = false;
  try{ same = JSON.stringify(draft.data) === JSON.stringify(chartData()); }catch(e){}
  if(same){ if(!isDirty()) dropDraft(); return; }
  if(readOnlyView) return;
  showDraftBar(draft, !!draft.base && draft.base !== draftBase);
}
lookForDraft();
