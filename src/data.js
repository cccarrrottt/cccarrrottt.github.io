/* =========================================================================
   AXIOM NEXUS — data model
   ---------------------------------------------------------------------
   This is a best-effort digitization of a hand-drawn chart, currently
   scoped to the Transformers "OG World" (G1) line only. Positions are
   computed, not traced — the whole graph is auto-laid-out as a ranked
   flow, with unconnected groups of nodes (connected components, not any
   user-declared grouping) spread apart automatically so they never
   overlap. Edit NODES below to correct or extend it.
   ========================================================================= */

// One flat list of entries — no grouping structure above this; organize and
// filter with tags instead (tags below), not by list position.
// Each entry is a record with its fields named (the form SETTINGS.format: 2
// says; a chart written before that used a list by position, [id, label,
// parent, edgeLabel, note, shape, opts], and is still read):
//   {id:'…', label:'…', parent?, edgeLabel?, note?, shape?, …}
// parent: omitted => root (no parent). a string => one parent.
// an array of strings => multiple parents (also how an 'amalgam' node gets
// the 2+ incoming connectors its merge visual needs).
// shape (optional): 'rect' (default) | 'ellipse' (character bio) | 'amalgam'
// (gradient border + text from colors — needs 2+ colors to show a gradient)
// | 'callout' | 'image' | 'textbox'.
// Everything else stands beside those fields, for example:
//   link: 'https://…'          — a small ↗ badge on the box that opens a URL
//   colors: ['#hex', ...]      — the node's own border color(s); one entry is
//                                 a plain single-color outline, more draws
//                                 nested rings and also feeds the amalgam
//                                 gradient above. Blank/omitted = default ink.
//   tags: ['tag', ...]         — free-form, user-defined; filter/organize
//                                 with these from the legend instead of a
//                                 fixed grouping.
//   font: 'serif'|'grotesk'|'orbitron'|'hand'  — omitted = default sans (IBM Plex)
//   fontSize: 13               — px, 6-28; omitted = default size (11.5)
//   pos: [x, y]                — where it stands, once it has been placed
//   image: 'media/<sha256>.png' — a picture, by its path beside the page
// Inside label: **bold**, *italic*, [[base|ruby]] (a small annotation above a word/phrase).
/* @@EDIT:NODES:START@@ */
const NODES = [
  {id:'uprising', label:'{{#cc22cc|{{u:solid|Beast Wars: }}}}{{u:solid|[[Upris|{{z:20|readin}}g]]ing}}{{s:images}}{{u:solid|фыву}}', parent:['uprising-copy', 'asdasd-1-copy'], pos:[-60.02, -21.79], colors:['#20242b'], square:true},
  {id:'uprising-copy', label:'Beast Wars: Uprising', parent:'uprising', pos:[292.98, 62.71], colors:['#20242b'], border:'dashdot'},
  {id:'asdasd', label:'asda{{u:double|sdи}}', note:'{{m:nagahurt}}', pos:[-196.67, 88.55], colors:['#20242b', '#c2c'], tags:['local multiverse', 'fan-fiction', 'multiversal hub'], border:'wavy', size:[50.35, 20.14], decor:'wavy'},
  {id:'asdasd-copy', label:'asdasd', parent:'asdasd', pos:[-122.41, 82.22], colors:['#20242b'], border:'dashdot'},
  {id:'beast-wars-uprising-copy', label:'Beast Wars: Uprising', pos:[-242, 297.28], tags:['fan-fiction'], colors:['#20242b'], square:true},
  {id:'beast-wars-uprising-copy-2', label:'Beast Wars: Uprising', pos:[-111.02, 297.21], colors:['#22cc'], square:true, link:'https://cccarrrottt.github.io/#entry=beast-wars-uprising-copy-3'},
  {id:'beast-wars-uprising-copy-3', label:'Beast Wars: Uprising', pos:[31.99, 297.28], colors:['#20242b'], square:true},
  {id:'beast-wars-uprising-copy-4', label:'Beast Wars: Uprising', parent:'asdasd-copy', pos:[168.98, 297.28], colors:['#2c2'], square:true},
  {id:'beast-wars-uprising-copy-5', label:'Beast Wars: Uprising', parent:['beast-wars-uprising-copy', 'beast-wars-uprising-copy-2', 'beast-wars-uprising-copy-3', 'beast-wars-uprising-copy-4', 'beast-wars-uprising-copy-6'], shape:'amalgam', pos:[31.99, 390.93], colors:['#20242b'], square:true, border:'dotted', bar:{k:'y', after:true, lead:34}},
  {id:'beast-wars-uprising-copy-6', label:'Beast Wars: Uprising', pos:[305.98, 297.28], colors:['#cccc'], square:true},
  {id:'beast-wars-uprising-copy-7', label:'Beast Wars: Uprising', parent:['beast-wars-uprising-copy', 'array'], pos:[-424.54, 297.21], colors:['#20242b'], square:true},
  {id:'callout-2', label:'sdafsdf', shape:'callout', pos:[-128.28, 319.3], leader:{from:'beast-wars-uprising-copy', to:'beast-wars-uprising-copy-5', at:0.6565, line:'dashed', shelf:true}},
  {id:'asdasd-1-copy', label:'Dghdhx', colors:['#20242b'], pos:[-16.16, 53.37], border:'double'},
  {id:'asdasd-1-copy-2', label:'a', colors:['#20242b'], pos:[53.4, 197.07], tags:['local multiverse'], square:true},
  {id:'node', label:'asdsa', shape:'ellipse', pos:[-211.02, -11.79], colors:['#20242b'], image:'media/bad8aa8b4beebd4fcc4f408a73a108030482920fd3ce9b6305f2b1fd66acdc61.png', tags:['unreleased']},
  {id:'node-2', label:'фыв', shape:'textbox', pos:[34.31, 183.69], rot:340},
  {id:'node-3', label:'Прчоао', pos:[-287.93, 106.73]},
  {id:'node-4', label:'Човьлы', parent:'node-3', pos:[-348.4, 106.73]},
  {id:'node-5', label:'{{#cc22cc|П}}рол{{#20242b|л}}', pos:[-299.73, 216.34]},
  {id:'node-6', label:'Гаягкягкч', parent:'node-5', pos:[-220.09, 198.94], size:[54.13, 12.05]},
  {id:'node-7', label:'фывфыв', pos:[-771.29, 106.73], colors:['#22cc']},
  {id:'node-copy', label:'фывфыв', pos:[-771.29, 152.69], colors:['#ccc']},
  {id:'node-copy-2', label:'фывфыв', pos:[-771.29, 198.64], colors:['#cc2c']},
  {id:'node-copy-3', label:'фывфыв', pos:[-771.29, 244.6], colors:['#c2c']},
  {id:'node-8', label:'xzzcxzxc', parent:['node-7', 'node-copy', 'node-copy-2', 'node-copy-3'], shape:'amalgam', pos:[-569.89, 176.06], bar:{k:'x', after:true, lead:107.55}},
  {id:'node-copy-4', label:'фывфыв', colors:['#22cc'], pos:[-882.06, 143.9]},
  {id:'node-copy-5', label:'фывфыв', colors:['#ccc'], pos:[-942.48, 143.9]},
  {id:'node-copy-6', label:'фывфыв', colors:['#cc2c'], pos:[-1012.97, 143.9]},
  {id:'node-copy-7', label:'фывфыв', colors:['#c2c'], pos:[-1073.39, 143.9]},
  {id:'xzzcxzxc-copy', label:'xzzcxzxc', shape:'amalgam', pos:[-977.18, 227.48]},
  {id:'node-9', label:'TNSDM', pos:[-317.06, 519.6]},
  {id:'node-10', label:'SDWaY!', pos:[-379.64, 519.6]},
  {id:'node-11', label:'', shape:'image', pos:[-298, 2.08], size:[30.21, 30.21], image:'media/3cde6e7cda5ca991ff7f3eeaab93f014626c14eff343e37bacbdb835eb59c132.png'},
  {id:'node-copy-8', label:'Човьлы', pos:[-569.89, -17.22], colors:['#20242b'], card:true},
  {id:'node-12', label:'SD', pos:[-336.69, 548.05]},
  {id:'array', label:'', shape:'array', members:['node-9', 'node-10', 'node-12'], bg:['#c2c'], hatch:'diag-r', border:'dotted'},
  {id:'callout-3', label:'', shape:'callout', pos:[-80.59, 47.82], leader:{from:'asdasd-copy', to:'beast-wars-uprising-copy-4', at:0.2581}},
  {id:'rework-github-like-issue-buttons-copy', label:'**Rework:** amalgam connector system', pos:[312.17, 181.26]},
  {id:'adjust-animation-toggler-on-gif-s-copy', label:'**Add:** miscellaneous decorative node shapes', pos:[312.17, 241.68]},
];
/* @@EDIT:NODES:END@@ */


// Per-edge style overrides: [{from, to, routing, dash, arrow, sinusoid,
// color}, ...]. Any edge not listed here uses DEFAULT_EDGE_STYLE below
// (color excepted — there's no single global default color; an edge with
// no override just keeps its natural color, normally the color of the
// node it points into). routing: 'orthogonal' (90° elbows) | 'straight'
// (direct line) — the path SHAPE. sinusoid: true | false (default) — an
// independent wavy-line STYLE that applies on top of either routing.
// dash: 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'double'. arrow: true
// (default, draws an arrowhead) | false (plain connector line, no
// arrowhead). color: '#hex' or omitted (natural color). Click an arrow on
// the chart to set its style — it's saved here as one entry per customized
// edge; deleting a connection also removes its entry here, if any.
/* Suggestions left on the chart: {id, nick, kind, text, at, done}. They
   are stored with the chart itself so they survive every new version of
   it, and are published by the same Save button as everything else. */
/* @@EDIT:COMMENTS:START@@ */
const COMMENTS = [
];
/* @@EDIT:COMMENTS:END@@ */

/* Stickers: small square pictures that sit inline in any text on the
   chart, the way an emoji does. Each one is stored here as {key, name,
   src} with src an embedded data: URI, so a sticker travels with the
   chart and needs nothing from the network. A text carries a sticker as
   the token {{s:key}}. */
/* @@EDIT:STICKERS:START@@ */
const STICKERS = [
  {key:'images', name:'images', src:'media/88dca481176dfc036576689788c3f7d740b50a61cf9f0726bd72ab1a24690603.png'},
];
/* @@EDIT:STICKERS:END@@ */

/* Embedded media: pictures and video clips that stand in the flow of an
   entry's comment, the way a figure stands in a document. Each one is
   {key, name, kind, src} — kind 'image' or 'video', src either an
   embedded data: URI (so the clip travels with the chart) or a link. A
   comment carries one as the token {{m:key}}. */
/* @@EDIT:MEDIA:START@@ */
const MEDIA = [
  {key:'nagahurt', name:'NagaHurt', kind:'video', src:'media/daf23fc6822c84f85fd103a5730f5ec7f74fcf254cc2b80073f52394b37608b5.webm'},
];
/* @@EDIT:MEDIA:END@@ */

/* Tags grouped into categories. A tag appears in at most one category;
   anything not listed here shows under "Ungrouped" in the tag panel.
   `tags` may name a tag no entry currently carries — a category can be
   set up before the entries that will use it exist. */
/* @@EDIT:TAGCATS:START@@ */
const TAG_CATS = [
  {name:'__ungrouped__', tags:['unreleased', 'fan-fiction']},
];
/* @@EDIT:TAGCATS:END@@ */

/* References. Any text on the chart can cite one with the token {{r:key}},
   which draws as a small raised [n] — n being the entry's position in this
   list, so reordering renumbers every mark at once. `title` is the short
   name shown in the list, `detail` the longer note, `url` an optional link.
   A bracketed number typed by hand is ordinary text and is never a
   citation; only this token is. */
/* Chart-wide settings. One place for the handful of choices that belong to
   the whole chart rather than to any one entry. */
/* @@EDIT:SETTINGS:START@@ */
const SETTINGS = {format: 2, refColor: '#c23b22'};
/* @@EDIT:SETTINGS:END@@ */

/* @@EDIT:REFS:START@@ */
const REFS = [
  {key:'ref', title:'', detail:'жэ', url:'https://github.com/cccarrrottt/cccarrrottt.github.io'},
  {key:'ref-2', title:'', detail:'ываыав'},
  {key:'sdfsdf', title:'', detail:'sdfsdf'},
  {key:'zxczcxczx', title:'', detail:'zxczcxczx'},
  {key:'12132', title:'', detail:'12132'},
];
/* @@EDIT:REFS:END@@ */

/* @@EDIT:EDGESTYLES:START@@ */
const EDGE_STYLES = [
  {from:'uprising', to:'uprising-copy', routing:'orthogonal', dash:'solid', arrow:true, note:'гнгн', fromSide:'top', toSide:'top', square:true, noteSquare:true},
  {from:'uprising-copy', to:'uprising', routing:'curve', dash:'solid', arrow:true, bends:[[251.21, -9.9]], fromSide:'left', toSide:'right'},
  {from:'beast-wars-uprising-copy', to:'beast-wars-uprising-copy-5', routing:'orthogonal', dash:'solid', arrow:true, color:'#c2c', colorFixed:true, fromSide:'bottom', toSide:'top'},
  {from:'beast-wars-uprising-copy-2', to:'beast-wars-uprising-copy-5', routing:'straight', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top', square:true},
  {from:'beast-wars-uprising-copy-3', to:'beast-wars-uprising-copy-5', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top'},
  {from:'beast-wars-uprising-copy-4', to:'beast-wars-uprising-copy-5', routing:'straight', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top', square:true},
  {from:'beast-wars-uprising-copy-6', to:'beast-wars-uprising-copy-5', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'top', square:true},
  {from:'asdasd', to:'asdasd-copy', routing:'orthogonal', dash:'solid', arrow:true, arrowIn:true, fromSide:'top', toSide:'top', fromRing:1, square:true},
  {from:'beast-wars-uprising-copy', to:'beast-wars-uprising-copy-7', routing:'orthogonal', dash:'solid', arrow:true, arrowIn:true, teeIn:true, bends:[[-206.14, 350.56]], bendSides:['bottom', 'bottom'], fromSide:'bottom', toSide:'bottom', square:true},
  {from:'asdasd-1-copy', to:'uprising', routing:'orthogonal', dash:'double', arrow:true, fromSide:'right', toSide:'bottom', square:true},
  {from:'node-3', to:'node-4', routing:'orthogonal', dash:'solid', arrow:true, fromSide:'bottom', toSide:'bottom', square:true},
  {from:'node-5', to:'node-6', routing:'orthogonal', dash:'solid', arrow:true, bends:[[-281.66, 203.24], [-257.72, 174.11]], bendSides:['top', 'top'], fromSide:'top', toSide:'top', square:true},
  {from:'node-7', to:'node-8', routing:'orthogonal', dash:'dashed', arrow:true, fromSide:'right', toSide:'right'},
  {from:'node-copy', to:'node-8', routing:'orthogonal', dash:'solid', arrow:true, sinusoid:true, fromSide:'right', toSide:'right'},
  {from:'node-copy-2', to:'node-8', routing:'orthogonal', dash:'double', arrow:true, fromSide:'right', toSide:'right'},
  {from:'node-copy-3', to:'node-8', routing:'orthogonal', dash:'dotted', arrow:true, fromSide:'right', toSide:'bottom'},
  {from:'asdasd-copy', to:'beast-wars-uprising-copy-4', routing:'curve', dash:'solid', arrow:true, note:'фывфы', notePos:'below', noteAt:0.524, gradient:['#2c2', '#22c'], fromSide:'left', toSide:'top', square:true, noteAlong:true},
  {from:'array', to:'beast-wars-uprising-copy-7', routing:'orthogonal', dash:'solid', arrow:true, arrowIn:true, teeOut:true, fromSide:'top', toSide:'bottom', square:true},
];
/* @@EDIT:EDGESTYLES:END@@ */
