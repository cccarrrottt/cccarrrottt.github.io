/* ---------------------------------------------------------------------
   Layout engine
   ------------------------------------------------------------------ */
const COLW = 210, ROWH = 118, BOXW = 178, ROOTMARGIN = 70;
// Diameter of a character-bio circle — matched to the height of a default
// box so a row of mixed archetypes lines up.
/* Half again the shortest a default entry may be — a portrait beside a
   row of entries, not a medallion twice their height. */
const BIO_SIZE = 36;
/* Archetypes whose drawing already carries a second layer — the echo, the
   stack — take one border colour and no more. A second ring would have to
   thread between the rings of the echo or the edges of the sheets, where it
   reads as a mistake rather than as a second lineage. The extra colours are
   trimmed on the way into the data, not merely hidden, so the entry says
   what it means. */
/* Archetypes that take exactly one border colour however many are set.
 *
 * A multiversal hub and a local multiverse used to be here. They are no
 * longer archetypes at all — they are tags now, and a tag decorates
 * whatever archetype the entry already wears, so it cannot take that
 * entry's second and third borders away from it. */
const SINGLE_BORDER_SHAPES = new Set([]);
/* How far apart the rings of a multi-coloured border sit — and, since they
   step OUTWARD, the amount the entry's silhouette grows per extra colour.
   The first colour in the list is the entry's own outline; every colour
   after it is drawn around the one before, so the list reads from the
   centre out in exactly the order it is written. Drawing them inward, as
   this did first, meant the last colour was the one buried in the middle
   and a long list ate the box from inside. */
const RING_STEP = 4;
/* A pocket reality's rings sit exactly as far apart as any other
   archetype's. What makes that possible is the shallower ripple below: an
   amplitude of half a step means a ring's wave stays inside its own share
   of the gap, so nothing has to be spread out to keep the frames apart. */
const POCKET_RING_STEP = RING_STEP;
/* ---------------------------------------------------------------------
   How an entry's border is DRAWN.
 *
 * This used to be part of the archetype: a "pocket reality" was an entry
 * whose border rippled, and that was the whole of what made it one. But an
 * archetype is a claim about what an entry IS, and "its edge wiggles" is a
 * claim about how it looks — so an entry could not be a pocket reality and
 * anything else at the same time, and the only way to get a dashed border
 * was to not have one. The ripple is a border STYLE now, alongside the
 * four the connectors have always offered, and any entry may wear it.
 *
 * The names and the dash patterns are the connectors' own, so a dashed
 * border and a dashed connector are dashed the same way. `wavy` is the old
 * pocket border, unchanged in every particular — same wavelength, same
 * amplitude, same phase grid, same ports, same clipping of the arrowheads
 * that meet it.
   ------------------------------------------------------------------ */
const BORDER_STYLES = {
  solid:   {label:'Solid',        dash:null},
  dashed:  {label:'Dashed',       dash:'7 5'},
  dotted:  {label:'Dotted',       dash:'1.5 4'},
  dashdot: {label:'Dash-dotted',  dash:'9 4 1.5 4'},
  double:  {label:'Double',       dash:null},
  wavy:    {label:'Wavy',         dash:null}
};
function borderStyleOf(n){
  const k = (n && n.border) || 'solid';
  return BORDER_STYLES[k] ? k : 'solid';
}
/* The look of an entry's scenery. Solid is the default and is stored as
   nothing, exactly as a border's is. */
function decorStyleOf(n){
  const k = (n && n.decor) || 'solid';
  return BORDER_STYLES[k] ? k : 'solid';
}
/* Whether this entry's outline ripples.
 *
 * Asked of the DRAWING, not of the setting. The archetypes that draw an
 * outline of their own cannot ripple: a portrait is a circle, an amalgam
 * entry is drawn with its gradient box, and a picture or a caption has no
 * outline at all. A CARD can, and now does — it is one box with rules
 * across it, so the box it is drawn with is whatever the border style
 * says, exactly as for a plain entry.
 *
 * It mattered because this answer is also what a CONNECTOR is told. A
 * port asks how far the ripple stands off the border at the point it
 * meets it, and which step the rings are spaced by — so a portrait whose
 * border was merely SET to wavy had both answers taken from a rectangle
 * it is not drawn as: every connector into it stopped a ripple's height
 * short of the circle, or cut into it, and on a second ring it missed the
 * circle by the difference between the two ring steps. That is the
 * arrowhead standing off the border of a character bio. */
/* An amalgam used to be on this list, for no reason it carried: its box is
   a rounded rectangle like any entry's, painted with its lineages' sweep
   instead of one ink, and a ripple round it is the same ripple. The owner
   asked for it, so its rippled outline is the plain one with the paint
   swapped (see renderNodes). */
const WAVY_BORDER_SHAPES = ['ellipse', 'image', 'textbox'];
function isWavyBorder(n){
  return !!n && borderStyleOf(n) === 'wavy' &&
         !WAVY_BORDER_SHAPES.includes(n.shape || '');
}
/* Whether this entry's corners are square rather than rounded.
 *
 * A look, like the border style, and asked of the drawing in the same way:
 * only an outline that HAS corners can square them. A ripple's corners are
 * part of the wave — squaring them would mean a wave turning a right angle,
 * which is the thing the ripple is laid along a rounded outline to avoid —
 * so a wavy border ignores the setting rather than half-obeying it; and a
 * portrait, a picture and a caption have no box corners to square.
 *
 * A callout has corners of its own, pinned or not. It used to take its
 * connector's, the way it takes the connector's ink — which meant squaring
 * a line squared every remark hanging off it, and a callout could not be
 * given corners different from the line it is about. Ink says whose remark
 * it is; corners are only a look, and a look is the card's to choose.
 *
 * A portrait's circle has no corners, but the card that opens beside it
 * does; see bioCardSquare. */
const SQUARE_CORNER_SHAPES = ['ellipse', 'image', 'textbox'];
function hasSquareCorners(n){
  if(!n || isWavyBorder(n) || SQUARE_CORNER_SHAPES.includes(n.shape || '')) return false;
  return !!n.square;
}
function bioCardSquare(n){ return !!n && (n.shape || '') === 'ellipse' && !!n.square; }
/* A portrait asked to ripple.
 *
 * Kept apart from isWavyBorder on purpose: everything that asks THAT
 * reasons about a rippled box — its ports, its clip, its ring caps — and a
 * portrait is a circle. So a portrait keeps every circle answer it had and
 * only its outline, its line and its card are drawn rippled; where a
 * connector meets it, borderProfileOf reads the ripple off the circle
 * (rippledRadius). The owner chose this from drawn previews: the circle,
 * the line out to the card and the card's frame all ripple together. */
function isWavyPortrait(n){
  return !!n && (n.shape || '') === 'ellipse' && borderStyleOf(n) === 'wavy';
}
/* How many waves go round a circle of this radius: as near the ripple's
   own wavelength as a whole, EVEN number allows. Even, so the circle is at
   its baseline exactly at the middle of each side, where the line to the
   card leaves it and where a connector meets it head on. */
function rippleCount(r){
  return 2 * Math.max(2, Math.round(Math.PI * r / POCKET_WAVELEN));
}
/* `count` is the portrait's own, taken from its innermost circle and used
   for every ring round it, so the rings ripple in step as a rippled box's
   rings do — each counting its own waves put them out of phase. */
function rippledRadius(r, theta, count){
  return r + POCKET_AMP * Math.sin((count || rippleCount(r)) * theta);
}
function rippledCirclePath(cx, cy, r, count){
  const N = count || rippleCount(r), steps = N * 12;
  let d = '';
  for(let k = 0; k < steps; k++){
    const t = k / steps * 2 * Math.PI, rr = rippledRadius(r, t, N);
    d += (k ? 'L' : 'M') + (cx + rr * Math.cos(t)).toFixed(2) + ',' + (cy + rr * Math.sin(t)).toFixed(2);
  }
  return d + 'Z';
}
function ringStepFor(n){ return isWavyBorder(n) ? POCKET_RING_STEP : RING_STEP; }
/* How many borders an entry is drawn with. Rings step OUTWARD — ring 0 is
   the box itself and every further ring stands a step beyond the last — so
   this is also which ring is the outermost one, and how much of an entry's
   own decoration a connector meeting an inner ring has to get past. The
   archetypes that paint their scenery from the first colour only ever have
   one. */
function ringCountOf(n){
  if(mergePainted(n)) return 1;
  return (n && n.colors && n.colors.length) ? n.colors.length : 1;
}
/* Written the way they are read. A hyphen is how a tag has to be written
   when it is a key in a program; these are neither — they are two words a
   reader types and a reader sees. */
const HUB_TAG = 'multiversal hub';
const LOCAL_TAG = 'local multiverse';
/* What they used to be called, so a chart written under the old spelling
   opens with its scenery intact rather than with two tags that name
   nothing. See migrateTagSpellings. */
const TAG_RENAMES = {'multiversal-hub': HUB_TAG, 'local-multiverse': LOCAL_TAG};
/* The grounds (drawn in 10-decor.js). Declared here rather than beside
   their drawing because the first chart is built while this part runs,
   and building it asks of every tag whether it is one of these. */
const FANFIC_TAG = 'fan-fiction';
/* The second ground.
 *
 * "Unreleased" is the other thing an entry can be that is not a claim
 * about its content: it exists, it is documented, and it never came out.
 * It is drawn the way fan-fiction is — a patch of ruled ground under the
 * entry, fading out past it — because the two say the same KIND of thing
 * about a reality and belong in the same visual language. What separates
 * them is the ruling: fan-fiction is a warm gold lattice, woven, made by
 * hands that were not the owner's; unreleased is a cold grey comb of
 * straight verticals, like a shutter or a barred window, with no weave at
 * all. An entry can carry both. */
const UNRELEASED_TAG = 'unreleased';
/* Tags that DO something.
 *
 * Almost every tag on this chart is a label: it names a thing the reader
 * can filter by and changes nothing about the entry that carries it.
 * A few are not — "fan-fiction" lays a weave on the canvas around every
 * entry that has it — and from the panel the two kinds looked identical,
 * so nothing said why one tag redrew the chart and its neighbour did not.
 *
 * This is the register of the ones that act. Each names what it does, in a
 * sentence the panel shows when the reader asks. Adding a tag with an
 * effect means adding it here in the same change, and the star appears on
 * its own. */
/* Two archetypes that stopped being archetypes.
 *
 * "Multiversal hub" and "local multiverse" were shapes, and being shapes
 * they were exclusive: an entry could be a hub or a pocket reality, never
 * both, and choosing one threw the other's outline away. But neither was
 * ever really an OUTLINE — a hub is a box with an echo spreading out of
 * it, a local multiverse a box with copies of itself stacked behind — and
 * an echo or a stack is something an entry HAS, not something it IS.
 *
 * As tags they compose: a pocket reality can be a hub, a mirror reality
 * can be a local multiverse, a bio can be both, and every one of them
 * keeps its own border, its own colours and its own ports. */
const SPECIAL_TAGS = {
  [FANFIC_TAG]: 'Entries with this tag are drawn standing on a woven ground.',
  [UNRELEASED_TAG]: 'Entries with this tag are drawn standing on a ruled grey ground.',
  [HUB_TAG]: 'Entries with this tag are drawn with an echo spreading out of them.',
  [LOCAL_TAG]: 'Entries with this tag are drawn with a stack of near-identical worlds behind them.'
};

/* Where each connector's crossbar was last drawn; see joinCandidates.
   Declared here rather than beside it because the first buildModel runs
   long before that part of the file. */
const routeBars = new Map();     // edge key -> {axis:'x'|'y', v:number}
/* Where each callout's anchor actually IS, and what each connector looked
   like when it was put there. */
const leaderAnchors = new Map();   // callout id -> {x, y, at}
const leaderRoutes = new Map();    // edge key -> the route as last drawn  (same reason)
// edge key -> {x, y, at, pts}: where a connector's note was last drawn, for
// the same reason a callout's anchor is kept as a point — see drawEdgeNote.
const noteAnchors = new Map();
/* And every connector's route, for the drag that wants to line one up with
   another. Filled in as they are drawn; cleared with the rest. */
const drawnRoutes = new Map();     // edge key -> the route as last drawn

/* A free-standing element — a picture, a bare line of text — is scenery on
   the chart rather than an entry in it: no ports, no connectors, and none
   of the decoration an entry can carry. */
function isFreeShape(shape){ return shape === 'image' || shape === 'textbox'; }
/* Which entries may be stood on their side, and how far they are turned.
 *
 * An entry turns in quarters only: the chart is drawn in right angles, and
 * a box at any other angle has no side for a connector to meet square-on.
 * Every kind of entry turns — a box, a callout, a card, a portrait, a
 * merge — because the whole of what is drawn turns with it, and the box
 * the chart reasons with is the turned one.
 *
 * The free furniture is the exception: a caption and a picture are
 * drawings, not boxes on a lineage, so they turn to any angle by a handle
 * of their own and the upright box underneath them stays upright. A
 * picture used to turn in quarters out of a button in its menu, which gave
 * one piece of furniture two different ways of doing the same thing. */
function quarterTurnable(n){
  if(!n) return false;
  return !isFreeShape(n.shape || 'rect');
}
function quarterTurnOf(n){
  if(!n || !n.rot || !quarterTurnable(n)) return 0;
  return ((Math.round(n.rot / 90) * 90) % 360 + 360) % 360;
}
/* ---------------------------------------------------------------------
   Callouts.

   A callout is a comment card standing off the chart with a line drawn to
   whatever it is talking about. It used to be a PROPERTY of a connector —
   one field on one connector's style — which made it two things it should
   never have been: rationed (a connector could carry exactly one) and
   entangled (it shared the `note` field with the plate a connector wears,
   so writing one erased the other).

   It is an ENTRY now, with an archetype of its own. Everything an entry
   can do it can do: there can be any number of them, they are dragged,
   coloured, tagged, sized, copied, undone and saved like anything else on
   the chart — and connectors attach to them exactly as they attach to a
   reality, because they are attached to an entry and the router cannot
   tell the difference.

   All that remains of the old arrangement is the ANCHOR: which connector
   the card points at, and where along it. That is drawn as a leader line
   in redrawEdges, once the connector's route is known.
   ------------------------------------------------------------------ */
/* The lines a leader may wear besides the solid one — see drawLeaderLine. */
const LEADER_LINES = ['dashed', 'dotted', 'dashdot', 'double', 'sinusoid'];
function calloutAnchorOf(opts){
  const L = opts && opts.leader;
  if(!L || typeof L !== 'object') return null;
  if(typeof L.from !== 'string' || typeof L.to !== 'string') return null;
  const at = (typeof L.at === 'number' && L.at >= 0 && L.at <= 1) ? L.at : 0.5;
  const snap = validSnap(L.snap);
  const out = snap ? {from: L.from, to: L.to, at, snap} : {from: L.from, to: L.to, at};
  if(LEADER_LINES.includes(L.line)) out.line = L.line;
  if(L.shelf === true) out.shelf = true;
  return out;
}
function isCalloutNode(n){ return !!n && (n.shape || '') === 'callout'; }
/* Which face of a box a point outside it is seen through. The same slab
   test rectBorderPoint solves, answered as a side rather than as a point,
   so a card and its leader can never disagree about which edge the line
   arrives at. */
function sideFacing(n, px, py){
  const dx = px - (n.x + n.w/2), dy = py - (n.y + n.h/2);
  const tx = dx ? (n.w/2) / Math.abs(dx) : Infinity;
  const ty = dy ? (n.h/2) / Math.abs(dy) : Infinity;
  if(tx < ty) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}
/* The side a callout's leader arrives at — the one side of it that is
   already spoken for.
 *
 * Read from the last time the leader was actually drawn, because the exact
 * anchor is a fraction of a routed line and the routes are not known while
 * the entries are being drawn. Before there is one — the very first frame,
 * or a callout whose connector is off the chart — the two entries it joins
 * give a good enough bearing, and the drawn answer replaces it a frame
 * later. */
const calloutLeaderSides = new Map();
function calloutLeaderSide(n){
  if(!n || !n.leader) return null;
  const seen = calloutLeaderSides.get(n.id);
  if(seen) return seen;
  const a = nodes.get(n.leader.from), b = nodes.get(n.leader.to);
  if(!a || !b) return null;
  return sideFacing(n, ((a.x + a.w/2) + (b.x + b.w/2)) / 2,
                       ((a.y + a.h/2) + (b.y + b.h/2)) / 2);
}
/* Which callouts hang off which connector, rebuilt with the model. */
const calloutsByEdge = new Map();
function rebuildCalloutIndex(){
  calloutsByEdge.clear();
  nodes.forEach(n=>{
    if(!isCalloutNode(n) || !n.leader) return;
    const key = calloutEdgeKey(n.leader.from, n.leader.to);
    if(!calloutsByEdge.has(key)) calloutsByEdge.set(key, []);
    calloutsByEdge.get(key).push(n);
  });
}
function capColors(list, shape){
  return SINGLE_BORDER_SHAPES.has(shape) ? list.slice(0, 1) : list;
}
// A multiversal hub's echo: how many rings step out of the box, and how far
// apart. Kept small — the rings have to read as an aura around the entry,
// not as a target the entry happens to sit in.
const HUB_ECHOES = 3, HUB_ECHO_STEP = 6;
// A local multiverse's stack: how many sheets sit behind the front one, and
// how far each is offset up and to the right.
const LOCAL_SHEETS = 2, LOCAL_SHEET_STEP = 5;
/* A card's proportions. The picture band is a fixed height so a row of
   cards lines up along its headings rather than stepping about; the two
   text bands grow with what is in them. The body sits at a smaller size
   than the heading, which is what makes the heading read as a heading. */
const CARD_MINW = 132, CARD_MAXW = 210;
const CARD_IMG_H = 66, CARD_BODY_SCALE = 0.82;
/* The card's middle voice. Between the heading and the body in size, for
   the line that says what the thing IS — "collectible card, back" — as
   against the heading, which names it, and the body, which cites it. */
const CARD_MEDIUM_SCALE = 0.9;
/* …that was the whole story while a picture was CROPPED to the band: any
   picture fits a fixed band if enough of it is thrown away. A picture is
   now fitted whole by default, so the band takes the depth the picture
   actually needs — a panorama gets a shallow one, a portrait a deep one —
   between these two, so that a card stays a card and a tall photograph
   does not turn one into a poster. */
const CARD_IMG_MINH = 26, CARD_IMG_MAXH = 200;
const CARD_PAD_Y = 9;
/* Default box for a free-standing picture before anyone resizes it: the
   size a character bio starts at. It was 180 by 120 — five times a
   portrait's width — so a picture put down beside the portraits it was
   meant to sit among arrived as a poster, and the first thing done with
   every one was to shrink it. */
const IMAGE_DEFAULT_W = BIO_SIZE, IMAGE_DEFAULT_H = BIO_SIZE;
// A loose caption may run much wider than a chart entry before it wraps.
const TEXTBOX_MAXW = 420;
// Bounds a text box is allowed to take. MAXW is the old fixed width, so a
// long label looks exactly as it always did; short ones now shrink.
/* Whether this view may edit at all. Declared up here with the rest of the
   module's state rather than beside the code that SETS it: the panels are
   built while the page loads, and a panel that asks "am I read-only?"
   before the answer exists throws — which is exactly what happened the
   moment a section heading started carrying an editing control. */
let readOnlyView = false;
const NODE_MINW = 84, NODE_MAXW = 178, NODE_MINH = 40;
/* How wide a one-line entry may grow before its text is clipped instead.
   Wider than NODE_MAXW, which is the ceiling for a label the measurer is
   allowed to FOLD: a line that cannot be folded needs somewhere to go. */
const NODE_LINE_MAXW = 300;
/* How far the border stands off the text's own ink. Small and fixed: what
   varies is the ink, which is measured (see measureTextBlock), so a bigger
   glyph or a descender moves the border rather than eating into the gap. */
const NODE_PAD_X = 7, NODE_PAD_Y = 5;
/* …and that small fixed distance is now one pixel, from the INSIDE of
   the border to the outermost ink, on every side — the gap is what was
   asked for, so it is the gap that is fixed and the box that gives.
 *
   The border's own reach inward is therefore part of the padding, and
   differs by style: a plain stroke comes half its width inside the box,
   a ripple swings in by its amplitude before its stroke starts, and a
   double border by half its band (see DOUBLE_BAND_W). Those two change an
   entry's size, and it grows about the middle (see growShiftX).
 *
   NODE_PAD_X and NODE_PAD_Y stay for what is NOT a box closed on its
   words: a loose caption, which has no border to stand off, and the wrap
   width a label is folded at before the box closes on it. */
const TEXT_GAP = 1;
const NODE_BORDER_W = 1.6;          // .node > rect in the stylesheet; see DOUBLE_LINE_W
/* A double line is one shape wherever it is drawn: on a connector and as
   an entry's border alike, a band DOUBLE_BAND_W across with a gutter of
   DOUBLE_GAP_W down its middle, leaving two rails of equal weight. A
   connector draws it as a wide stroke with a paper-coloured one over it
   (.dbl-outer and .dbl-inner in the stylesheet carry these same numbers);
   an entry draws the two rails themselves, centred on the box's edge the
   way a plain stroke is.
 *
   An entry's double border was for a while the plain 1.6 band split in
   three, which made it a hairline pair beside the connectors arriving at
   it in the same style. Wider than a plain border, it grows the entry by
   the difference, about the middle (see growShiftX). */
const DOUBLE_BAND_W = 3.8;
const DOUBLE_GAP_W = 1.3;
const DOUBLE_LINE_W = (DOUBLE_BAND_W - DOUBLE_GAP_W) / 2;
/* How far each rail's centre stands from the box's edge, out and in. */
const DOUBLE_LINE_OFF = (DOUBLE_BAND_W - DOUBLE_LINE_W) / 2;
function borderReachIn(n){
  if(isTextboxShape(n)) return TEXTBOX_FRAME_W / 2;
  if(isWavyBorder(n) || isWavyPortrait(n)) return POCKET_AMP + NODE_BORDER_W / 2;
  if(borderStyleOf(n) === 'double') return DOUBLE_BAND_W / 2;
  return NODE_BORDER_W / 2;
}
/* A caption has no border, only the frame that shows while it is pointed
   at or selected — but that frame is where the caption ends, and the words
   keep the same pixel off it that an entry's keep off its border. Whatever
   border style the entry carries is not drawn on a caption, so it does not
   get to move the frame either. */
const TEXTBOX_FRAME_W = 1;
function isTextboxShape(n){ return !!n && (n.shape || '') === 'textbox'; }
function textInsetFor(n){ return TEXT_GAP + borderReachIn(n); }
/* How round a box closed onto its words may be at the corners.
 *
 * The pixel was kept along the sides and not across the corners: a corner
 * of five sweeps a quarter circle through the box, and the corner of the
 * words' own box — where a "P" or a "[" or a capital at the start of a
 * line actually puts ink — was nearer the arc than to either side, and on
 * a one-line entry nearly touching it.
 *
 * The geometry decides how round it may be. Take the innermost line the
 * border draws, of half-width `half`, and the ink's corner standing
 * `half + TEXT_GAP` in from it on both sides. The arc's centre sits `r`
 * in from that line on both sides too, so the ink's corner is (r - half -
 * gap)·√2 from the centre, and the inside of the stroke is r - half from
 * it. Keeping the pixel there means (r - half - gap)·√2 ≤ r - half - gap,
 * which holds only while r is at most half + gap. Rounder than that and
 * the corner has to cost size — which is the other way to do it, and the
 * one not wanted: the corner gives, not the box.
 *
 * For a double border the inner rail is that line, standing DOUBLE_LINE_OFF
 * in from the edge, so the edge's radius is that much larger; each rail is
 * drawn at it moved by its own offset. A ripple's corner is already
 * clear: its arc's centre stands inside the ink's corner. Returned is the
 * radius of the OUTERMOST line of ring 0, which is what every other radius
 * on the entry is measured from. */
function inkCornerR(n){
  if(isTextboxShape(n)) return TEXT_GAP + TEXTBOX_FRAME_W / 2;
  if(borderStyleOf(n) === 'double') return TEXT_GAP + DOUBLE_LINE_W / 2 + DOUBLE_LINE_OFF;
  return TEXT_GAP + NODE_BORDER_W / 2;
}
function round2(v){ return Math.round(v * 100) / 100; }
/* The height of a one-line entry, which is what an entry's stored
   position is the middle of (see NODE_GROW_REF), and the floor for the
   boxes that do not close on their words. */
const NODE_FIT_MINH = 24;
// The smallest a portrait may be dragged to; below this it is a dot.
const BIO_MIN_SIZE = 20;
/* The height a box's GROWTH is measured from — see growShift.
 *
 * It used to be NODE_MINH, which was right while an ordinary one-line entry
 * came out exactly that tall. Closing the borders onto the ink made a
 * one-line entry a good deal shorter than that, and the reference did not
 * follow: every box on the chart was now below it, so growth was measured
 * from a height nothing had and NOTHING was compensated. An entry that
 * gained a line kept its top and dropped its bottom — the very thing the
 * offset exists to prevent, back again by arithmetic rather than by
 * intent.
 *
 * The smallest a box can be IS the height an ordinary entry has, so growth
 * is measured from there. A one-line entry takes no offset, exactly as it
 * took none before, so no stored position moves; only a box that is
 * genuinely taller than the ordinary one is re-centred, which is the case
 * the rule was written for. */
const NODE_GROW_REF = NODE_FIT_MINH;
// How many lines a label is allowed to wrap to before the box is widened
// instead — three keeps entries compact without turning long titles into
// very wide boxes.
const NODE_MAX_LINES = 3;

const DEFAULT_NODE_COLOR = '#20242b';
// An array's frame and hatching, until it is given a colour of its own.
const ARRAY_INK = '#000000';
/* The colour a tag gives the entries wearing it, kept with the chart in
   SETTINGS.tagColors. A tag that acts — the weave, the ruling, the echo,
   the stack — is a kind of drawing rather than a kind of thing, and has
   no colour to give; neither has the Untagged bucket. */
function tagColorOf(tag){
  const map = SETTINGS.tagColors;
  if(!map || typeof map !== 'object' || tagIsSpecial(tag)) return null;
  return isHexColor(map[tag]) ? map[tag] : null;
}
/* Every colour an entry's tags give it, in the order the tags are listed,
   each once — one ring per colour, as with colours of its own. */
function tagColorsOf(tags){
  if(!tags || !tags.length) return null;
  const out = [];
  tags.forEach(t=>{ const c = tagColorOf(t); if(c && !out.includes(c)) out.push(c); });
  return out.length ? out : null;
}
// Kept in step with --emoji in the stylesheet.
const EMOJI_FAMILY = "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
/* The chip standing for an entry's default text.
 *
 * It was the 🇺🇸 emoji, which Windows does not draw: the regional-indicator
 * pair falls back to the two letters "US" in a box, or to nothing. Flags
 * are the one emoji family Windows has never shipped glyphs for, so no
 * font stack rescues it. It is drawn as a few rectangles instead — a
 * dozen bytes of SVG that look the same everywhere. */
const DEFAULT_LANG_CHIP = '\uD83C\uDDFA\uD83C\uDDF8';   // 🇺🇸

/* A language tab named by a country's code wears that country's flag.
 *
 * Typing a flag on a phone is a trip through the emoji keyboard; typing
 * "DE" or "DEU" is two or three keys. So a tab whose name is a country's
 * two- or three-letter ISO 3166 code is shown, and kept, as the flag those
 * letters spell — the regional-indicator pair, which is all a flag emoji
 * is. Every code in the standard, the three-letter ones each paired with
 * the two letters of the flag. A name that is not a country stays words:
 * EN, ENG and JA name languages and no country, so they are left alone. */
const COUNTRY_CODES = (()=>{
  const two = new Map();
  ('ABWAW AFGAF AGOAO AIAAI ALAAX ALBAL ANDAD AREAE ARGAR ARMAM ASMAS ' +
  'ATAAQ ATFTF ATGAG AUSAU AUTAT AZEAZ BDIBI BELBE BENBJ BESBQ BFABF ' +
  'BGDBD BGRBG BHRBH BHSBS BIHBA BLMBL BLRBY BLZBZ BMUBM BOLBO BRABR ' +
  'BRBBB BRNBN BTNBT BVTBV BWABW CAFCF CANCA CCKCC CHECH CHLCL CHNCN ' +
  'CIVCI CMRCM CODCD COGCG COKCK COLCO COMKM CPVCV CRICR CUBCU CUWCW ' +
  'CXRCX CYMKY CYPCY CZECZ DEUDE DJIDJ DMADM DNKDK DOMDO DZADZ ECUEC ' +
  'EGYEG ERIER ESHEH ESPES ESTEE ETHET FINFI FJIFJ FLKFK FRAFR FROFO ' +
  'FSMFM GABGA GBRGB GEOGE GGYGG GHAGH GIBGI GINGN GLPGP GMBGM GNBGW ' +
  'GNQGQ GRCGR GRDGD GRLGL GTMGT GUFGF GUMGU GUYGY HKGHK HMDHM HNDHN ' +
  'HRVHR HTIHT HUNHU IDNID IMNIM INDIN IOTIO IRLIE IRNIR IRQIQ ISLIS ' +
  'ISRIL ITAIT JAMJM JEYJE JORJO JPNJP KAZKZ KENKE KGZKG KHMKH KIRKI ' +
  'KNAKN KORKR KWTKW LAOLA LBNLB LBRLR LBYLY LCALC LIELI LKALK LSOLS ' +
  'LTULT LUXLU LVALV MACMO MAFMF MARMA MCOMC MDAMD MDGMG MDVMV MEXMX ' +
  'MHLMH MKDMK MLIML MLTMT MMRMM MNEME MNGMN MNPMP MOZMZ MRTMR MSRMS ' +
  'MTQMQ MUSMU MWIMW MYSMY MYTYT NAMNA NCLNC NERNE NFKNF NGANG NICNI ' +
  'NIUNU NLDNL NORNO NPLNP NRUNR NZLNZ OMNOM PAKPK PANPA PCNPN PERPE ' +
  'PHLPH PLWPW PNGPG POLPL PRIPR PRKKP PRTPT PRYPY PSEPS PYFPF QATQA ' +
  'REURE ROURO RUSRU RWARW SAUSA SDNSD SENSN SGPSG SGSGS SHNSH SJMSJ ' +
  'SLBSB SLESL SLVSV SMRSM SOMSO SPMPM SRBRS SSDSS STPST SURSR SVKSK ' +
  'SVNSI SWESE SWZSZ SXMSX SYCSC SYRSY TCATC TCDTD TGOTG THATH TJKTJ ' +
  'TKLTK TKMTM TLSTL TONTO TTOTT TUNTN TURTR TUVTV TWNTW TZATZ UGAUG ' +
  'UKRUA UMIUM URYUY USAUS UZBUZ VATVA VCTVC VENVE VGBVG VIRVI VNMVN ' +
  'VUTVU WLFWF WSMWS YEMYE ZAFZA ZMBZM ZWEZW ').trim().split(' ').forEach(p=>{
    two.set(p.slice(3), p.slice(3));
    two.set(p.slice(0, 3), p.slice(3));
  });
  // Not in the standard's list, but flags all the same, and what is typed.
  two.set('UK', 'GB');
  two.set('EU', 'EU');
  return two;
})();
function flagForCode(text){
  const t = String(text || '').trim().toUpperCase();
  if(!/^[A-Z]{2,3}$/.test(t)) return null;
  const two = COUNTRY_CODES.get(t);
  if(!two) return null;
  return String.fromCodePoint(...[...two].map(c=> 0x1F1E6 + c.charCodeAt(0) - 65));
}

const nodes = new Map();   // id -> node record
const structEdges = [];    // {from,to,color,label}
const componentMeta = []; // [{ids, origin:{x,y}, bbox}]


/* ---------------------------------------------------------------------
   The working copy of the chart data.

   NODES is the literal saved in the page; workingNodes is the live,
   editable version of it that everything on screen is built from. Edits
   change workingNodes and rebuild the view immediately — nothing is
   written back to the page until Save. See the save/dirty section for
   why that's the right shape for this platform.
   ------------------------------------------------------------------ */
/* The form an entry is written in, and the number of that form.
 *
 * An entry used to be written as a list by position — [id, label, parent,
 * edgeLabel, note, shape, opts] — and what the fifth place meant was known
 * only to this file. It is written now as a record with its fields named,
 * {id, label, parent, note, shape, pos, colors, …}, the options standing
 * beside the rest rather than in a seventh place: a file anybody can read,
 * or write, without this program to explain it.
 *
 * Inside the page an entry is still the list; every part reads it that way,
 * and changing that would touch every part for nothing a reader can see.
 * So the record is the FILE's form: read into the list here and on import
 * (entryOfRecord), written back out of it by serializeNodes. A list found
 * in a file is still read, so every chart written before this — a saved
 * page, an export, a pull from claude.ai — opens as it did.
 *
 * DATA_FORMAT counts the forms, and is written into the chart's settings
 * with every save. 1 was the list, 2 is the record, 3 the merge as a
 * property of the entry the lineages join rather than a kind of entry (see
 * migrateAmalgams). A file from a page with a higher number is refused at
 * import rather than half-read. */
const DATA_FORMAT = 3;
const ENTRY_FIELDS = ['id', 'label', 'parent', 'edgeLabel', 'note', 'shape'];
function entryOfRecord(rec){
  if(Array.isArray(rec)) return rec.slice();
  if(!rec || typeof rec !== 'object') return rec;
  const it = ENTRY_FIELDS.map(k=> k === 'id' || k === 'label' ? rec[k] : (rec[k] === undefined ? null : rec[k]));
  const opts = {};
  Object.keys(rec).forEach(k=>{ if(ENTRY_FIELDS.indexOf(k) < 0) opts[k] = rec[k]; });
  if(Object.keys(opts).length) it.push(opts);
  return it;
}
function recordOfEntry(it){
  const rec = {id: it[0], label: it[1]};
  for(let i = 2; i < ENTRY_FIELDS.length; i++) if(it[i] !== null && it[i] !== undefined) rec[ENTRY_FIELDS[i]] = it[i];
  const opts = it[6];
  if(opts && typeof opts === 'object'){
    Object.keys(opts).forEach(k=>{ if(opts[k] !== undefined && ENTRY_FIELDS.indexOf(k) < 0) rec[k] = opts[k]; });
  }
  return rec;
}
let workingNodes = NODES.map(entryOfRecord);

/* Charts saved before the hub and the local multiverse became tags.
 *
 * Both were archetypes then, stored in the tuple's shape slot, and an
 * entry that was one could not also be a pocket reality or wear a second
 * border. Reading such a chart now, each becomes what it always described:
 * an ordinary box carrying the tag that draws its scenery. Nothing is lost
 * — the entry keeps its colour, its card, its position and its links — and
 * the tag is filed under a category so the legend can show it.
 *
 * Done on the working copy rather than at render time, so saving the chart
 * writes the new form and the migration happens exactly once per chart. */
/* Charts saved while a fill and a border style were archetypes.
 *
 * A "mirror reality" was an entry filled with its own border colour and a
 * "pocket reality" was an entry whose border rippled — two claims about
 * how an entry LOOKS, standing where a claim about what it IS belongs, and
 * each of them locking out every other archetype for the sake of one
 * visual property. Both are properties now, and any entry may carry them:
 * a mirror becomes an ordinary entry with a background, a pocket becomes
 * an ordinary entry with a wavy border, and both come out looking exactly
 * as they did. Done once, on the working copy, so saving writes the new
 * form. */
function migrateArchetypeLooks(list){
  let moved = 0;
  (list || []).forEach(item=>{
    const shape = item && item[5];
    if(shape !== 'mirror' && shape !== 'pocket') return;
    item[5] = null;
    const opts = (item[6] && typeof item[6] === 'object') ? item[6] : (item[6] = {});
    if(shape === 'mirror'){
      /* Its fill WAS its border colour, so that is the background it keeps
         — and the label, which a mirror drew in contrasting ink, goes on
         being drawn that way because readableOn sees the two are the
         same colour. */
      const c = (Array.isArray(opts.colors) && opts.colors[0]) || DEFAULT_NODE_COLOR;
      if(!Array.isArray(opts.bg) || !opts.bg.length) opts.bg = [c];
    } else {
      if(!opts.border) opts.border = 'wavy';
    }
    moved++;
  });
  return moved;
}
function migrateLegacyArchetypes(list){
  let moved = 0;
  (list || []).forEach(item=>{
    const shape = item && item[5];
    if(shape !== 'hub' && shape !== 'local') return;
    item[5] = null;
    const opts = (item[6] && typeof item[6] === 'object') ? item[6] : (item[6] = {});
    const tag = shape === 'hub' ? HUB_TAG : LOCAL_TAG;
    const tags = Array.isArray(opts.tags) ? opts.tags : (opts.tags = []);
    if(tags.indexOf(tag) < 0) tags.push(tag);
    moved++;
  });
  if(moved && typeof TAG_CATS !== 'undefined'){
    [HUB_TAG, LOCAL_TAG].forEach(tag=>{
      if(TAG_CATS.some(c=> c.tags.indexOf(tag) >= 0)) return;
      let bin = TAG_CATS.find(c=> c.name === '__ungrouped__');
      if(!bin){ bin = {name:'__ungrouped__', tags:[]}; TAG_CATS.push(bin); }
      bin.tags.push(tag);
    });
  }
  return moved;
}

/* Charts written while a leader note was a connector's own property.
 *
 * Each such note becomes a callout entry pointing at the same place on the
 * same connector, and the connector gets its note field back. The card's
 * position is the one it was aimed at — the direction and distance were
 * measured from the anchor, and the anchor is a fraction of a route that
 * is not known until the connector is drawn, so the entry is created with
 * a placeholder position and redrawEdges puts it where it belongs the
 * first time that connector is routed. See placePendingCallouts. */
const pendingCallouts = new Map();   // callout id -> {from, to, at, dir, len}
function migrateLeaderNotes(){
  let moved = 0;
  EDGE_STYLES.forEach(st=>{
    if(!st || st.notePos !== 'leader') return;
    const text = typeof st.note === 'string' ? st.note : '';
    const at = (typeof st.noteAt === 'number' && st.noteAt >= 0 && st.noteAt <= 1) ? st.noteAt : 0.5;
    const dir = typeof st.noteDir === 'number' ? st.noteDir : -90;
    const len = (typeof st.noteLen === 'number' && st.noteLen > 0) ? st.noteLen : 68;
    const ids = new Set(workingNodes.map(it=> it[0]));
    const id = uniqueId('callout', ids);
    workingNodes.push([id, text.trim(), null, null, null, 'callout',
                       {pos:[0, 0], leader:{from: st.from, to: st.to, at}}]);
    pendingCallouts.set(id, {from: st.from, to: st.to, at, dir, len});
    delete st.note; delete st.notePos;
    delete st.noteAt; delete st.noteDir; delete st.noteLen;
    moved++;
  });
  return moved;
}

/* Tags whose spelling changed. Renamed everywhere they can be written
   down: on the entries that carry them and in the categories that file
   them. Runs with the other migrations, so a chart written under the old
   spelling is corrected once and saved in the new form. */
function migrateTagSpellings(list){
  let moved = 0;
  const fix = (tags)=>{
    if(!Array.isArray(tags)) return;
    for(let i = 0; i < tags.length; i++){
      const to = TAG_RENAMES[tags[i]];
      if(!to) continue;
      /* Renaming onto a tag the entry already carries would leave it with
         the same tag twice, which the filter would then count twice. */
      if(tags.indexOf(to) >= 0) tags.splice(i--, 1);
      else tags[i] = to;
      moved++;
    }
  };
  (list || []).forEach(item=>{ if(item && item[6]) fix(item[6].tags); });
  if(typeof TAG_CATS !== 'undefined') TAG_CATS.forEach(c=> fix(c && c.tags));
  return moved;
}

/* An amalgam becomes an ordinary entry whose lineages all merge — the
   same drawing, said the new way (see mergeOf). A colour it carried of its
   own was never shown while two lineages or more fed it (they decided its
   colours), and would now be read as the border colour the owner can set,
   so it goes; with fewer, the colour WAS what it wore, and stays. */
function migrateAmalgams(list){
  let moved = 0;
  (list || []).forEach(item=>{
    if(!Array.isArray(item) || item[5] !== 'amalgam') return;
    const opts = (item[6] && typeof item[6] === 'object') ? item[6] : {};
    const parents = Array.isArray(item[2]) ? item[2].filter(Boolean) : (item[2] ? [item[2]] : []);
    if(parents.length >= 2) delete opts.colors;
    opts.merge = true;
    item[5] = null;
    item[6] = opts;
    moved++;
  });
  return moved;
}

/* Which of those a chart needs is a question of when it was written, and
 * a chart says when: the form number in its settings (DATA_FORMAT). One
 * written before the number existed is form 1.
 *
 * So they run where a chart comes IN — this page opening, an import, a kept
 * draft or Save put back — and only for a chart old enough to need them.
 * They used to run at the top of every buildModel, on every chart, every
 * edit: cheap (0.03 ms at 400 entries), but it meant an old form was never
 * actually gone — anything that wrote one into the working copy, at any
 * time, was quietly turned into the new one, so nothing could tell whether
 * the page still WROTE it somewhere. Now a chart is brought up to this
 * page's form once, and is in that form from then on; SETTINGS.format says
 * so, and the next save writes it.
 *
 * A change to what a chart may hold that an older chart has to be brought
 * through is a new step here, with the form number it ends at, and the
 * number goes up by one. */
const MIGRATIONS = [
  // Everything before entries were records: archetypes that became tags
  // and properties, tags respelled, leader notes that became callouts.
  {upTo: 1, run(){
    return migrateLegacyArchetypes(workingNodes) + migrateArchetypeLooks(workingNodes) +
           migrateTagSpellings(workingNodes) + (typeof EDGE_STYLES !== 'undefined' ? migrateLeaderNotes() : 0);
  }},
  // The amalgam archetype, which became a merge on an ordinary entry.
  {upTo: 2, run(){ return migrateAmalgams(workingNodes); }}
];
function chartFormatOf(settings){
  const f = settings && settings.format;
  return Number.isInteger(f) && f >= 1 ? f : 1;
}
/* The chart now in workingNodes, EDGE_STYLES and the rest, written in form
   `format`, brought to this page's. */
function migrateChart(format){
  let moved = 0;
  MIGRATIONS.forEach(m=>{ if(format <= m.upTo) moved += m.run(); });
  SETTINGS.format = DATA_FORMAT;
  return moved;
}
migrateChart(chartFormatOf(SETTINGS));

/* Where a merge's bar has been put: which axis it is laid ACROSS (`k`),
   which side of the lineages it hangs on (`after` — past their far edge
   on that axis, or short of their near one), and how far beyond them
   (`lead`). Measured from the LINEAGES, never from the entry: the bar is
   theirs, moving a parent takes it along, and moving the amalgam moves
   nothing but the merged arrow. Absent until a drag first fixes it; until
   then amalgamGeometry works the place out as it always has. */
/* The nearest a bar may be put to its lineages: the run-up a lineage needs
   to come down and turn onto it with a full corner (AMALGAM_APPROACH, two
   corner radii and a little) and a hair more. Written out rather than
   derived, because this part runs before the geometry's. */
const AMALGAM_LEAD_MIN = 18;
function amalgamBarOf(opts){
  const v = opts && opts.bar;
  if(!v || typeof v !== 'object' || (v.k !== 'x' && v.k !== 'y')) return null;
  if(typeof v.lead !== 'number' || !Number.isFinite(v.lead)) return null;
  return {k: v.k, after: !!v.after, lead: Math.max(AMALGAM_LEAD_MIN, v.lead)};
}
/* A merge is no longer a kind of entry (the owner's rework, 23.10).
 *
 * It used to be the 'amalgam' archetype: an entry of that kind merged every
 * lineage drawn into it, and an entry of any other kind merged none. But
 * what merges is the CONNECTORS — two lineages running into one bar and one
 * arrow — and the entry they run into is an entry like any other. So the
 * entry now says which of its lineages merge: `merge: true` for all of them,
 * the way an amalgam always had it (and the way a lineage drawn in later
 * joins), or a list naming the ones that do, which is what taking one
 * lineage out of a merge leaves behind. It is set from a connector's menu
 * (Merge, Unmerge); nothing else turns it on. */
function mergeOf(opts){
  const v = opts && opts.merge;
  if(v === true) return true;
  if(!Array.isArray(v)) return null;
  const ids = v.filter(x=> typeof x === 'string' && x);
  return ids.length ? ids : null;
}
/* The lineages of `n` that run into its merge, in the order its parents
   are listed. A merge of fewer than two is not drawn as one. */
function mergeMembersOf(n){
  if(!n || !n.merge) return [];
  const parents = n.parents || [];
  return n.merge === true ? parents.slice() : parents.filter(p=> n.merge.includes(p));
}
/* Only a box takes a merge: the bar and its one arrow are laid out against
   a box's sides, and a portrait, a caption, a picture, a callout or an
   array has none of the kind. One whose kind is changed afterwards keeps
   the field, and draws as a merge again if it is changed back. */
function mergeShapeOk(shape){ return !shape || shape === 'rect'; }
function isMergeNode(n){ return !!n && mergeShapeOk(n.shape) && mergeMembersOf(n).length >= 2; }
/* …and wearing the merge's colours: the lineages', as a gradient round the
   border and through the words, which is what an amalgam always wore. An
   entry given a border colour of its own wears that instead (the one change
   the owner asked for in the move). */
function mergePainted(n){ return isMergeNode(n) && !(n.ownColors && n.ownColors.length); }

function buildModel(){
  // A rebuilt chart is a new chart as far as the routes are concerned.
  routeBars.clear();
  /* Anchors go with them. Everything the memory holds has already been
     written into the entries it came from, so dropping it costs nothing
     and stops an undo or an import being second-guessed by a position
     remembered from the chart that was there before it. */
  leaderAnchors.clear();
  leaderRoutes.clear();
  drawnRoutes.clear();
  nodes.clear();
  structEdges.length = 0;
  componentMeta.length = 0;

const twice = [];
workingNodes.forEach(item=>{
  let [id,label,parent,edgeLabel,note,shape,opts] = item;
  /* An id is the entry's name to everything that points at it, so a second
     entry under the same one cannot be told apart from the first. It used
     to replace it here, half-way — the first one's place in the chart, the
     second one's words — while the editor, which finds an entry by the
     first match (workingEntry), went on editing the one no longer drawn.
     The first is the entry; the second is left out, and said so. The
     editor and import both refuse to make one (validateNodes); this is
     for a file edited by hand. */
  if(nodes.has(id)){ twice.push(id); return; }
  let parents;
  if(parent===undefined || parent===null){
    parents = [];
  } else if(Array.isArray(parent)){
    parents = parent;
  } else {
    parents = [parent];
  }
  /* An array is a frame round other entries (see 40-arrays.js): it wears
     no tags, so a filter or a tag's colour never decides its look, and it
     has no position of its own — its members are where it is. */
  const isArray = shape === 'array';
  const tags = (!isArray && opts && Array.isArray(opts.tags) && opts.tags.length) ? opts.tags : null;
  /* An entry is drawn in its own colours when it has them, and otherwise
     in the colours of its tags (the owner's design, 2026-10-14): a tag
     will name a work, and an entry wears the work it belongs to. With no
     coloured tag it is the default ink, as it always was. ownColors keeps
     which of the two it is, because the form must not write a tag's
     colour back as the entry's own. */
  /* An array made before its colour moved from its ground to its frame
     carries that colour as bg; it is read as the frame's, which is what
     the owner meant by giving it one. */
  const ownColors = opts ? (hexColors(opts.colors) || (isArray ? hexColors(opts.bg) : null)) : null;
  /* An array's frame is black unless it is given a colour (the owner's
     choice): it is drawn round other entries, half see-through, and the
     default ink would read as one more entry's border. */
  const colors = ownColors || (isArray ? [ARRAY_INK] : tagColorsOf(tags));
  nodes.set(id,{
    id, label, note:note||null,
    // A character bio is a small circle rather than a box: it carries a
    // portrait, not a paragraph, so it is sized by BIO_SIZE and its text
    // lives in a card that opens beside it.
    shape:shape||null, parents, edgeLabel: edgeLabel||null, rank:0, col:0, x:0,y:0,
    /* A callout's anchor: the connector it points at and where along it.
       Absent on every other entry, and absent on a callout that has been
       cut loose from its connector — which is still a perfectly good
       comment card, just one that points at nothing. */
    leader: calloutAnchorOf(opts),
    w: (shape==='ellipse' ? BIO_SIZE : BOXW), h:56,
    children:[],
    link: (opts && opts.link) || null,
    colors, ownColors,
    color: (colors && colors[0]) || DEFAULT_NODE_COLOR,
    /* What the entry is filled with. One colour is a flat ground; more
       than one is a gradient across the box, the same way an amalgam's
       border runs through its lineages' colours. Absent is the paper. */
    bg: (opts && !isArray) ? hexColors(opts.bg) : null,
    /* And how its outline is drawn: solid, dashed, dotted, dash-dotted,
       double, or the wavy edge a pocket reality used to be. */
    border: (opts && typeof opts.border === 'string' && BORDER_STYLES[opts.border])
            ? opts.border : null,
    /* And how its SCENERY is drawn — a hub's echo, a local multiverse's
       stack — which is a look of its own and not the box's.
     *
       A sheet copied the entry's outline, dash pattern, second rail and
       ripple and all, on the reasoning that a sheet is the same world
       seen again. What it meant in practice was that nobody could draw a
       dashed entry with a plain stack behind it, or a plain entry with
       the stack dashed: the scenery had no look to choose, only one to
       inherit. It has its own now, solid unless somebody says otherwise,
       and the register of looks is the border styles' — see
       decorStyleOf. */
    decor: (opts && typeof opts.decor === 'string' && BORDER_STYLES[opts.decor])
           ? opts.decor : null,
    /* Square corners instead of rounded ones — see hasSquareCorners. */
    /* Square unless asked otherwise: an entry's default box has square
       corners, and rounding them is the choice that is recorded. */
    square: !(opts && opts.square === false),
    tags,
    font: (opts && opts.font) || null,
    fontSize: (opts && typeof opts.fontSize==='number') ? opts.fontSize : null,
    multiLang: !!(opts && opts.multiLang),
    langTabs: (opts && Array.isArray(opts.langTabs) && opts.langTabs.length) ? opts.langTabs : null,
    // A hand-placed position, set by dragging the node. When present it
    // overrides whatever the auto-layout computed for this node (applied
    // just after the layout pass below); when absent the node keeps
    // flowing with the automatic layout as it always has.
    pos: (!isArray && opts && Array.isArray(opts.pos) && opts.pos.length===2 &&
          Number.isFinite(opts.pos[0]) && Number.isFinite(opts.pos[1])) ? {x:opts.pos[0], y:opts.pos[1]} : null,
    // Portrait for a character bio: any URL the page may load, or an
    // embedded data: URI.
    /* A portrait, if it is a picture at all. Asked here rather than at
       import, because this is the one place every path ends up — a chart
       from a file, a chart out of browser storage, a chart edited by hand.
       A source that is neither embedded nor an http(s) address simply does
       not draw; see pictureSrcOk. */
    image: (opts && typeof opts.image === 'string' && pictureSrcOk(opts.image))
           ? opts.image : null,
    // Stacking order for free-standing images: 0 is the normal node layer,
    // -1 puts the element behind the connectors as a backdrop, +1 puts it
    // over everything else. Only images use it; nothing else needs to be
    // layered by hand.
    z: (opts && typeof opts.z==='number' && Number.isFinite(opts.z)) ? opts.z : 0,
    /* Card layout: this entry is drawn as three stacked bands — a picture,
       the label as a heading, the note as body text — instead of a box with
       its label centred in it. It is a per-entry choice, not a chart-wide
       mode, so a chart can mix plain entries and cards freely. Any archetype
       that is a box can wear it; a character bio and the free-standing
       elements cannot, since they have no box to divide. */
    card: !!(opts && opts.card),
    /* What to do with a picture that is not the shape of its band: fit it
       whole (the default) or fill the band and lose the edges. Cropping
       was once the only answer, which meant a wide picture arrived with
       both its ends cut off and no way to say otherwise. */
    cardCrop: !!(opts && opts.cardCrop),
    /* How its picture moves, if it moves: still, on hover, or (absent)
       always. See wearPicture. */
    anim: pictureAnimOf(opts && opts.anim),
    /* The card's third band of words, drawn under the heading and above
       the note. Only a card has one — every other archetype has one text
       and its note. */
    medium: (opts && typeof opts.medium === 'string') ? opts.medium : '',
    /* A band depth set by hand, overriding the one the picture's own
       proportions ask for. Absent means the picture decides. */
    cardImgH: (opts && typeof opts.cardImgH === 'number' && Number.isFinite(opts.cardImgH))
              ? Math.max(CARD_IMG_MINH, Math.min(CARD_IMG_MAXH, opts.cardImgH)) : null,
    /* …and how wide it is drawn, for a picture pulled in from the sides.
       Absent means the whole width of the card, which is where a picture
       starts and where most of them stay. */
    cardImgW: (opts && typeof opts.cardImgW === 'number' && Number.isFinite(opts.cardImgW))
              ? Math.max(CARD_IMG_MINH, opts.cardImgW) : null,
    /* A portrait's card, asked to stay. Off, the card opens under the
       pointer and while the entry's panel is open on it; on, it is part
       of the drawing and is always there. */
    bioCard: !!(opts && opts.bioCard),
    /* Where an amalgam's bar stands, once it has been put somewhere: see
       amalgamBarOf and amalgamGeometry. */
    bar: amalgamBarOf(opts),
    /* Which of its lineages merge into one bar and one arrow: all of them
       (true), the ones named, or none. See mergeMembersOf. */
    merge: mergeOf(opts),
    /* An array's entries, and the hatching over its ground. Absent on
       everything else. */
    members: isArray ? arrayMembersOf(opts) : null,
    hatch: (isArray && opts && arrayHatches().includes(opts.hatch)) ? opts.hatch : null,
    /* Which side that card stands on: 'auto' works it out from what is in
       the way, 'left' and 'right' are the reader's own answer. */
    bioSide: (opts && (opts.bioSide === 'left' || opts.bioSide === 'right'))
             ? opts.bioSide : null,
    // Degrees clockwise about the element's own centre. Loose furniture —
    // a caption, a picture — takes any angle; an entry takes quarters
    // (see quarterTurnOf).
    rot: (opts && typeof opts.rot==='number' && Number.isFinite(opts.rot))
         ? ((opts.rot % 360) + 360) % 360 : 0,
    // A hand-set box size, from dragging a node's corner. Absent means the
    // box sizes itself to its text.
    size: (opts && Array.isArray(opts.size) && opts.size.length===2 &&
           opts.size.every(v=>typeof v==='number' && Number.isFinite(v)))
          ? {w:opts.size[0], h:opts.size[1]} : null
  });
});
// Once per set of names, not on every redraw.
if(twice.length && buildModel.twice !== twice.join('\n')){
  buildModel.twice = twice.join('\n');
  console.warn('Rhizome: more than one entry is called ' + twice.map(t=> JSON.stringify(t)).join(', ') + '; only the first of each is drawn.');
}
settleArrayMembers();

// Build structEdges only now that every node exists. label/color come from
// the CHILD end's own data, so every parent->this-node edge shares them —
// that's a deliberate simplification (an edgeLabel describes "how this
// entry came to be", which is the same regardless of which of its several
// parents you're looking from).
nodes.forEach(n=>{
  n.parents.forEach(p=>{
    if(nodes.has(p)){
      structEdges.push({from:p, to:n.id, color:n.color, label:n.edgeLabel});
    }
  });
});

// link children arrays
structEdges.forEach(e=>{
  if(nodes.has(e.from) && nodes.has(e.to)){
    nodes.get(e.from).children.push(e.to);
  }
});


/* ---------------------------------------------------------------------
   Connected components — there's no declared grouping any more (tags are
   for filtering, not layout), so unrelated trees are told apart the only
   way that's still meaningful: nodes reachable from each other via ANY
   parent/child edge (direction ignored) are laid out together as one
   auto-detected group, so two unconnected diagrams never get tangled into
   the same rank/column grid, and are then spread apart in pixel space by
   the collision pass below exactly like continuities used to be.
   ------------------------------------------------------------------ */
(function findComponents(){
  /* An array takes no part in the layout: its box is worked out from its
     members once they are drawn, so a slot made for it would only push
     the chart's real trees apart round a place nothing stands in. */
  const adjacency = new Map();
  nodes.forEach((n,id)=>{ if(!isArrayNode(n)) adjacency.set(id, new Set()); });
  structEdges.forEach(e=>{
    if(adjacency.has(e.from) && adjacency.has(e.to)){
      adjacency.get(e.from).add(e.to);
      adjacency.get(e.to).add(e.from);
    }
  });
  const seen = new Set();
  nodes.forEach((n,startId)=>{
    if(seen.has(startId) || !adjacency.has(startId)) return;
    const ids = [];
    const queue = [startId];
    seen.add(startId);
    while(queue.length){
      const id = queue.shift();
      ids.push(id);
      adjacency.get(id).forEach(nb=>{
        if(!seen.has(nb)){ seen.add(nb); queue.push(nb); }
      });
    }
    componentMeta.push({ids, origin:{x:0,y:0}});
  });
})();

// ---- rank computation per component (longest path) ----
componentMeta.forEach(comp=>{
  const ids = comp.ids;
  const idSet = new Set(ids);
  const rankOf = new Map();
  function computeRank(id, seen){
    if(rankOf.has(id)) return rankOf.get(id);
    if(seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const n = nodes.get(id);
    const parentsInComp = n.parents.filter(p=>idSet.has(p));
    let r = 0;
    parentsInComp.forEach(p=>{ r = Math.max(r, computeRank(p,seen)+1); });
    rankOf.set(id,r);
    return r;
  }
  ids.forEach(id=>computeRank(id,new Set()));
  ids.forEach(id=>{ nodes.get(id).rank = rankOf.get(id); });

  // assign columns per rank, preserving order, barycenter pass
  const byRank = {};
  ids.forEach(id=>{
    const r = nodes.get(id).rank;
    (byRank[r] = byRank[r]||[]).push(id);
  });
  const maxRank = Math.max(0,...Object.keys(byRank).map(Number));
  for(let r=0;r<=maxRank;r++){
    const layer = byRank[r]||[];
    layer.forEach((id,i)=>{ nodes.get(id).col = i; });
  }
  // barycenter smoothing (two passes) based on in-component parents
  for(let pass=0; pass<3; pass++){
    for(let r=1;r<=maxRank;r++){
      const layer = byRank[r]||[];
      const scored = layer.map(id=>{
        const n = nodes.get(id);
        const parentsInComp = n.parents.filter(p=>idSet.has(p));
        const avg = parentsInComp.length ?
          parentsInComp.reduce((s,p)=>s+nodes.get(p).col,0)/parentsInComp.length :
          n.col;
        return {id,avg};
      });
      scored.sort((a,b)=>a.avg-b.avg);
      scored.forEach((s,i)=>{ nodes.get(s.id).col = i; });
    }
  }

  // compute pixel positions (left-anchored first pass, ordering only)
  ids.forEach(id=>{
    const n = nodes.get(id);
    n.x = comp.origin.x + n.col*COLW;
    n.y = comp.origin.y + ROOTMARGIN + n.rank*ROWH;
    // Width is decided by the renderer now (text-fitted, or hand-set), so
    // the layout pass only places boxes — it no longer resizes them. It
    // does record the slot it placed each node in, though: boxes are no
    // longer all one width, so the renderer re-centres each one inside its
    // slot rather than leaving narrow entries hugging the left edge of it.
    n.slotX = n.x;
    n.slotW = BOXW;

  });

  // center each rank's siblings under their shared parent, instead of
  // always hugging the left edge - e.g. an 8-way fan-out now spreads
  // evenly left/right of the box it branches from, not off to its right.
  for(let r=1;r<=maxRank;r++){
    const layer = (byRank[r]||[]).slice().sort((a,b)=>nodes.get(a).col-nodes.get(b).col);
    if(!layer.length) continue;
    // split the (already left-to-right ordered) layer into runs that
    // share the same primary in-component parent
    const groups = [];
    let curParent, curGroup;
    layer.forEach(id=>{
      const n = nodes.get(id);
      const parentsInComp = n.parents.filter(p=>idSet.has(p));
      const primary = parentsInComp[0] || null;
      if(!curGroup || primary !== curParent){
        curGroup = {parent:primary, ids:[]};
        groups.push(curGroup);
        curParent = primary;
      }
      curGroup.ids.push(id);
    });
    const GAP = COLW - BOXW;
    let cursorX = -Infinity;
    groups.forEach(g=>{
      const width = (g.ids.length-1)*COLW + BOXW;
      const p = g.parent && nodes.has(g.parent) ? nodes.get(g.parent) : null;
      let startX = p ? (p.x + p.w/2) - width/2 : nodes.get(g.ids[0]).x;
      if(startX < cursorX) startX = cursorX;
      g.ids.forEach((id,i)=>{ nodes.get(id).x = startX + i*COLW; });
      cursorX = startX + width + GAP;
    });
  }

  // A node with 2+ in-component parents (an amalgam merge, most notably)
  // was, up to here, positioned as a child of just its "primary" (first-
  // listed) parent — the grouping pass above only knows how to hang a run
  // of siblings under one shared parent. Re-center any such node under the
  // average of ALL its parents instead, then resolve whatever same-row
  // overlap that shift introduces by nudging siblings apart left-to-right,
  // same spacing (COLW) as everywhere else in the grid.
  for(let r=1;r<=maxRank;r++){
    const layer = byRank[r]||[];
    if(!layer.length) continue;
    layer.forEach(id=>{
      const n = nodes.get(id);
      const parentsInComp = n.parents.filter(p=>idSet.has(p));
      if(parentsInComp.length < 2) return;
      const avgCenterX = parentsInComp.reduce((s,p)=>{
        const pn = nodes.get(p);
        return s + pn.x + pn.w/2;
      }, 0) / parentsInComp.length;
      n.x = avgCenterX - n.w/2;
    });
    const ordered = layer.slice().sort((a,b)=>nodes.get(a).x-nodes.get(b).x);
    for(let i=1;i<ordered.length;i++){
      const prev = nodes.get(ordered[i-1]), cur = nodes.get(ordered[i]);
      const minX = prev.x + COLW;
      if(cur.x < minX) cur.x = minX;
    }
  }

  const xs = ids.map(id=>nodes.get(id).x);
  const minX = Math.min(...xs), maxX = Math.max(...xs.map((x,i)=>x+BOXW));
  comp.bbox = {
    x0: minX - 20, y0: comp.origin.y,
    x1: maxX + 20,
    y1: comp.origin.y + ROOTMARGIN + (maxRank+1)*ROWH
  };
});

/* ---------------------------------------------------------------------
   Collision resolution — nudge whole components apart so their
   auto-computed boxes never overlap.
   ------------------------------------------------------------------ */
(function resolveComponentOverlaps(){
  const PAD = 70;
  const offsets = componentMeta.map(()=> ({dx:0,dy:0}));

  function currentBox(i){
    const cm = componentMeta[i], o = offsets[i];
    return {
      x0: cm.bbox.x0+o.dx, y0: cm.bbox.y0+o.dy,
      x1: cm.bbox.x1+o.dx, y1: cm.bbox.y1+o.dy
    };
  }

  for(let iter=0; iter<400; iter++){
    let moved = false;
    for(let i=0;i<componentMeta.length;i++){
      for(let j=i+1;j<componentMeta.length;j++){
        if(!componentMeta[i].bbox || !componentMeta[j].bbox) continue;
        const a = currentBox(i), b = currentBox(j);
        const ax0=a.x0-PAD, ax1=a.x1+PAD, ay0=a.y0-PAD, ay1=a.y1+PAD;
        const overlapX = Math.min(ax1,b.x1) - Math.max(ax0,b.x0);
        const overlapY = Math.min(ay1,b.y1) - Math.max(ay0,b.y0);
        if(overlapX>0 && overlapY>0){
          moved = true;
          const oa = offsets[i], ob = offsets[j];
          if(overlapX < overlapY){
            const push = overlapX/2 + 1;
            if(a.x0 < b.x0){ oa.dx -= push; ob.dx += push; }
            else { oa.dx += push; ob.dx -= push; }
          } else {
            const push = overlapY/2 + 1;
            if(a.y0 < b.y0){ oa.dy -= push; ob.dy += push; }
            else { oa.dy += push; ob.dy -= push; }
          }
        }
      }
    }
    if(!moved) break;
  }

  componentMeta.forEach((cm,i)=>{
    const o = offsets[i];
    if(o.dx===0 && o.dy===0) return;
    cm.bbox.x0+=o.dx; cm.bbox.x1+=o.dx; cm.bbox.y0+=o.dy; cm.bbox.y1+=o.dy;
    cm.ids.forEach(id=>{
      const n = nodes.get(id);
      n.x += o.dx; n.y += o.dy;
    });
  });
})();

/* ---------------------------------------------------------------------
   Hand-placed positions. Everything above computes an automatic layout;
   this is the last word on where a node actually sits. Dragging a node
   writes opts.pos into its saved entry, and from then on that entry
   ignores the computed slot and stays exactly where it was put. Nodes
   with no opts.pos keep flowing with the auto-layout — so a chart can mix
   both freely, and clearing a node's pos hands it straight back to the
   layout engine. Every hand-placed coordinate is a multiple of GRID (the
   drag snaps to it), which is what keeps a hand-arranged chart aligned
   instead of merely scattered.
   ------------------------------------------------------------------ */
nodes.forEach(n=>{
  if(n.pos){ n.x = n.pos.x; n.y = n.pos.y; }
});
rebuildCalloutIndex();

}  // end buildModel
/* The step of the grid a drag snaps to and the ruled grid draws: the
   smallest box the chart can hold words in.
 *
   That is an entry with square corners and a lowercase "a" in it, in the
   default face at the default size — the ink of the letter, a pixel of
   paper either side, and the border's half-width beyond that (see
   textInsetFor). It used to be a round ten, which matched nothing on the
   chart: the smallest box was neither one step nor two, so lining things
   up on the grid lined up their corners and nothing else.
 *
   The letter's ink is written down rather than measured when the page
   opens. Measuring it would give each machine its own grid — a face
   substituted, a rasteriser that rounds differently — and a position
   snapped on one would sit off the grid on the next. These are Arial's
   "a" at 11.5px as inkBoxOf measures it (see INK_SCALE); the suite checks
   that an entry drawn that way comes out exactly a step tall, so a change
   of face or size cannot quietly leave the grid behind. The box is taller
   than it is wide; the step is the square that holds it — which comes to
   a hair over the round ten the grid used to be. */
const GRID_LETTER_INK_W = 6.11, GRID_LETTER_INK_H = 6.47;
const GRID = round2(Math.max(GRID_LETTER_INK_W, GRID_LETTER_INK_H)
                    + 2 * (TEXT_GAP + NODE_BORDER_W / 2));
/* To two decimals: the step is not a whole number, and a multiple of it
   comes back from the arithmetic as 34.800000000000004. */
function snapToGrid(v){ return round2(Math.round(v/GRID)*GRID); }
buildModel();

