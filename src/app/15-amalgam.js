/* AMALGAM_PITCH is the least room between two lineages' landings. It was
   thirty, which is far more than the bar needs — the turn onto the bar is
   a corner of EDGE_CORNER_R and each lineage owns half the gap either side
   of it — and it showed as an invisible wall a whole box-width short of a
   neighbour whenever a parent was slid along the bar. Two radii and a
   little air is enough for both corners to keep their shape. */
/* AMALGAM_GAP is the closest the bar may come to the entry it feeds: the
   merged arrow's head (9.5), the bead it leaves from (3.6) and a little
   shaft between them, so it still reads as an arrow. It was 24, which
   gave way a whole step before it had to; see amalgamGeometry. */
const AMALGAM_GAP = 18, AMALGAM_LEAD = 34, AMALGAM_PITCH = 2 * 6 + 3;
/* Where each merge's bar last ran, along its own axis and in chart
   coordinates. Filled in by drawAmalgam; read by a drag that offers to
   centre the entry on its own bar. */
const amalgamBars = new Map();
/* The bar a click has taken hold of, by its amalgam's id, and the drag
   carrying one. Up here rather than with the code that uses them, because
   the first drawing below already asks. */
let amalgamBarFocus = null;
let amalgamBarDrag = null;
/* How far a lineage runs straight down before it touches the bar. Two
   corner radii and a little over, so the bend onto the bar always has a
   full radius of leg to sit in and can never square off. */
const AMALGAM_APPROACH = EDGE_CORNER_R * 2 + 4;
/* …and the least it can be squeezed to while the bar is still giving way
   in whole steps (see amalgamGeometry): one corner and a little straight.
   Only closer than that does the bar leave the step and settle between
   the lineages and the entry. */
const AMALGAM_SQUEEZE = EDGE_CORNER_R + 2;
/* The joint beads between neighbouring stretches of the bar, and the
   junction the merged arrow leaves from: both the size of a callout's
   point and a split's dot (the owner's list of 28.10). They were 3.1 and
   3.6, the junction a shade bigger to read as the principal one — and
   beside the other points on the chart they read as a different kind of
   mark. The junction is told apart by the arrow leaving it. */
const AMALGAM_JOINT_R = LEADER_DOT_R;
const AMALGAM_BEAD_R = LEADER_DOT_R;
/* Closer than this, a bar held where it was put leaves no room in front of
   the entry for the merged arrow: its head and the bead it leaves from,
   and nothing between (see drawAmalgam, where the foot steps aside). */
const AMALGAM_CROWDED = ARROW_LEN + AMALGAM_BEAD_R + 0.5;
/* How close two beads may come before they stop reading as two marks.
   A little more than the pair's own widths: touching is one mark, and a
   sliver of bar between two dots reads as a mistake rather than as two
   things worth telling apart. */
const AMALGAM_BEAD_CLEAR = 13;

/* Which connectors are currently drawn as part of a merge. Rebuilt on every
   redraw and read by the style popover, which greys out the arrowhead
   toggles for them: a lineage feeding an amalgam has no arrowhead of its
   own — it runs into the shared bar, and the one arrow into the entry
   belongs to the merge. Offering a switch that does nothing is worse than
   offering none. */
const amalgamMemberKeys = new Set();
// One place builds the key, so the two ends can never drift apart.
function edgePairKey(from, to){ return from + '\u0000' + to; }
function isAmalgamMember(from, to){ return amalgamMemberKeys.has(edgePairKey(from, to)); }
/* The merged arrow out of a bar into its amalgam. It has no source entry —
   it belongs to the merge, not to a lineage — so it is named by an empty
   `from` and the amalgam it feeds, here, in the style it is given and on
   the page alike. */
function isMergedArrow(from, to){
  if(from !== '') return false;
  return isMergeNode(nodes.get(to));
}
/* Either piece of a merge: the arrow, or a lineage running into it. What
   both share is that the merge decides where they run and what they end
   in, so neither has bends of its own or an arrowhead to switch. */
function isMergePart(from, to){ return isAmalgamMember(from, to) || isMergedArrow(from, to); }

/* The colour of one border ring of an entry — what the port on that ring
   is drawn in, and so what a connector leaving it inherits. */
function portRingColor(node, ring){
  if(!node) return null;
  if(node.colors && node.colors.length) return node.colors[ring || 0] || node.colors[0];
  return node.color || null;
}
/* The colours an amalgam wears: one per lineage feeding it, in the order
   they lie along its bar. Falls back to whatever the entry itself carries
   while it has fewer than two lineages and is not yet a merge at all. */
function amalgamInheritedColors(n){
  const parents = mergeMembersOf(n).map(id=> nodes.get(id)).filter(Boolean);
  if(parents.length < 2) return (n.colors && n.colors.length) ? n.colors : [n.color];
  return parents
    .slice()
    .sort((p, q)=> (p.x + p.w/2) - (q.x + q.w/2) || (p.y + p.h/2) - (q.y + q.h/2))
    .map(p=> amalgamMemberColor({from: p.id, to: n.id}));
}
function amalgamMemberColor(e){
  const style = edgeStyleFor(e.from, e.to);
  /* A lineage painted as a gradient brings the colour it ARRIVES in: that
     is the end that runs along the bar and into the merge. */
  if(style.gradient && style.gradient.length) return style.gradient[style.gradient.length - 1];
  if(style.colorFixed && style.color) return style.color;
  // The ring the connector was pulled from is the lineage it represents,
  // so a two-coloured parent contributes the colour of that ring — the
  // same rule every other connector follows.
  return portRingColor(nodes.get(e.from), style.fromRing) || style.color || '#20242b';
}

/* Where a merge's bar hangs, and which way it runs — worked out from the
   entry and the lineages alone, so it can be asked BEFORE the ports are
   assigned as well as while the thing is being drawn. */
function amalgamGeometry(list, ports){
  const b = nodes.get(list[0].to);
  if(!b) return null;
  const rec0 = ports.get(list[0]);
  if(!rec0) return null;
  const ring = rec0.toRing || 0;
  /* One side for the whole merge — whichever most of the lineages already
     chose, so the bar lands where the group naturally wants it and the
     odd one out is routed round to join it. */
  const sideVotes = new Map();
  list.forEach(e=>{
    const r = ports.get(e);
    if(!r || !r.toSide) return;
    sideVotes.set(r.toSide, (sideVotes.get(r.toSide) || 0) + 1);
  });
  let side = rec0.toSide;
  let best = -1;
  SIDES.forEach(sName=>{
    const v = sideVotes.get(sName) || 0;
    if(v > best){ best = v; side = sName; }
  });
  /* …unless the entry and its lineages say plainly which way the bar
   * runs and which side of the entry it is on.
   *
     The vote is what the lineages would have done each on its own, and
     that is the wrong question once the entry is close to them: an entry
     standing just beside a column of parents got a vote for its bottom
     edge, and the bar was laid ACROSS the column with every lineage
     looping round to reach it. And an entry carried across the level the
     bar hangs at pushed the bar ahead of it, so the entry could never be
     put on the other side of its own bar.
   *
     So the bar is laid along whichever axis the entry stands clear of its
     lineages on, at its resting place LEAD beyond the lineages on the
     entry's side — a place that belongs to the lineages and not to the
     entry — and the merged arrow comes off it into whichever side of the
     entry faces it. Carry the entry across that line and the arrow simply
     comes in from the other side. Only where the entry overlaps its
     lineages on both axes, or a lineage was given a side by hand, does
     the vote still decide. */
  const pnodes = list.map(e=> nodes.get(e.from)).filter(Boolean);
  const byHand = list.some(e=> SIDES.includes(edgeStyleFor(e.from, e.to).toSide));
  /* A bar somebody has put somewhere — by carrying it, or by carrying the
     entry or a lineage, which fixes it where it stood (see fixAmalgamBars).
     It says the axis and the side itself, and how far beyond the lineages
     it hangs; nothing about the entry enters into it. */
  const fixed = b.bar || null;
  let resting = null;
  const span = (k, len)=> ({lo: Math.min(...pnodes.map(p=> p[k])),
                            hi: Math.max(...pnodes.map(p=> p[k] + p[len])),
                            mid: pnodes.reduce((t, p)=> t + p[k] + p[len]/2, 0) / pnodes.length});
  const sx = pnodes.length ? span('x', 'w') : null, sy = pnodes.length ? span('y', 'h') : null;
  /* A bar somebody has carried is honoured even where a lineage was given
     its side by hand. The hand-set side decides which way a LINEAGE
     leaves its own entry; where the bar hangs is a separate answer, and
     the only one a carry is giving. Read as one question, a merge with a
     single hand-set side could not be carried at all: there was no
     resting place to measure from, so the bar had nothing to be moved
     from and the drag did nothing. */
  if(pnodes.length && (!byHand || fixed)){
    const gapX = Math.max(b.x - sx.hi, sx.lo - (b.x + b.w));
    const gapY = Math.max(b.y - sy.hi, sy.lo - (b.y + b.h));
    /* Clear on one axis only: the bar crosses that one. Clear on both — an
       entry off on the diagonal — the bar runs the way the lineages are
       spread, as it would with the entry straight below them. */
    const spreadX = Math.max(...pnodes.map(p=> p.x + p.w/2)) - Math.min(...pnodes.map(p=> p.x + p.w/2));
    const spreadY = Math.max(...pnodes.map(p=> p.y + p.h/2)) - Math.min(...pnodes.map(p=> p.y + p.h/2));
    let k = null;
    if(gapX > 0 && gapY > 0) k = spreadX >= spreadY ? 'y' : 'x';
    else if(gapX > 0) k = 'x';
    else if(gapY > 0) k = 'y';
    /* …and never a bar the lineages would have to reach THROUGH one
       another. A bar runs across the axis it is laid on, and each lineage
       drops onto it straight from its own entry — which only works while
       the entries stand side by side along the bar. Lined up the other
       way, one behind another towards it (a row with the amalgam level
       at its end, a column with it straight below), every lineage but the
       nearest had to go round the ones in front of it, and they knotted
       round each other to get there. Laid along the row instead, the bar
       takes each one straight down, and the merged arrow goes from it to
       wherever the entry stands.
       The same question settles an entry standing in among its lineages
       on both axes, where there is no clear side to go by and the vote
       used to decide alone: it still does, unless what it chose is a bar
       the lineages are queued up behind. */
    const queued = (kk)=>{
      const lo = kk === 'x' ? 'y' : 'x', len = kk === 'x' ? 'h' : 'w';
      const iv = pnodes.map(p=> [p[lo], p[lo] + p[len]]).sort((u, v)=> u[0] - v[0]);
      return iv.some((u, i)=> i && u[0] < iv[i-1][1]);
    };
    if(!k && gapX <= 0 && gapY <= 0){
      const kv = sideIsVertical(side) ? 'y' : 'x';
      if(queued(kv) && !queued(kv === 'x' ? 'y' : 'x')) k = kv === 'x' ? 'y' : 'x';
    } else if(k && queued(k) && !queued(k === 'x' ? 'y' : 'x')) k = k === 'x' ? 'y' : 'x';
    if(fixed) k = fixed.k;
    if(k){
      const sp = k === 'x' ? sx : sy, len = k === 'x' ? 'w' : 'h';
      const centre = b[k] + b[len]/2;
      const after = fixed ? fixed.after : centre >= sp.mid;
      const lead = fixed ? fixed.lead : AMALGAM_LEAD;
      const at = after ? sp.hi + lead : sp.lo - lead;
      /* Short of its resting place, the entry is across the bar's line
         from where it normally stands, and the bar is laid beyond it —
         which is what lets an entry be put on either side of its own bar.
         But only where the lineages can get past it: a lineage straight
         behind the entry would have to go round it to reach a bar on the
         far side, and its landing would be exactly where the merged arrow
         turns back into the entry. There the bar stays on the lineages'
         side and gives way to the entry as it would to one carried up
         under them. */
      const o = k === 'x' ? 'y' : 'x', olen = k === 'x' ? 'h' : 'w';
      const behind = pnodes.some(p=> p[o] < b[o] + b[olen] && p[o] + p[olen] > b[o]);
      /* A bar nobody has put anywhere is not somewhere the entry can be
         carried across. It rests a LEAD beyond the lineages only while
         there is room for that, and gives way to an entry nearer than
         that (below) — so an entry standing clear of its lineages, by
         however little, is past the bar, and the bar squeezes in between
         them. Asking about `at` instead turned the merge inside out the
         moment an entry was closer than the resting place: the bar went
         round to the far side of it and the arrow pointed back up, where
         the same two lines unmerged were a short arrow down. Only a bar
         put somewhere by hand stands still for the entry to cross; and an
         entry in among its lineages is not clear of them, so it is asked
         about as before. */
      const nearEdge = after ? b[k] : b[k] + b[len];
      const clear = after ? nearEdge > sp.hi : nearEdge < sp.lo;
      const past = (!fixed && clear) || (after ? centre >= at : centre < at);
      /* A bar put somewhere by hand does not move for anything, so the
         entry simply faces it from whichever side it is on — a lineage
         behind the entry included. Turned to the lineages regardless, it
         came in by a side face while the entry stood above a held bar and
         beside the lineage at its end (the owner's list of 28.10). */
      const facing = (behind && !fixed) ? after : (past === after);
      side = k === 'x' ? (facing ? 'left' : 'right')
                       : (facing ? 'top' : 'bottom');
      resting = {at, k, after, lead, fixed: !!fixed, spLo: sp.lo, spHi: sp.hi, clear,
                 towards: (SIDE_NORMAL[side][k] < 0) === after};
    }
  }
  const nrm = SIDE_NORMAL[side] || {x:0, y:-1};
  // The bar runs along the side, so its axis is the side's own direction.
  const ux = sideIsVertical(side) ? 1 : 0;
  const uy = sideIsVertical(side) ? 0 : 1;
  // The single port everything funnels into: the middle of that edge.
  const port = portOnSide(b, side, 0, 1, ring);
  let nearest = Infinity;
  let towards = true;
  if(resting){
    /* The distance to the resting place, and to the lineages beyond it.
       When the entry has been carried past the bar the lineages are on
       the far side of the entry rather than in front of it, so a bar
       giving way moves AWAY from them and there is nothing to squeeze. */
    nearest = (resting.at - port[resting.k]) * nrm[resting.k] + AMALGAM_LEAD;
    towards = resting.towards;
  } else list.forEach(e=>{
    const sN = nodes.get(e.from);
    if(!sN) return;
    [[sN.x, sN.y], [sN.x+sN.w, sN.y], [sN.x, sN.y+sN.h], [sN.x+sN.w, sN.y+sN.h]]
      .forEach(([px, py])=>{
        const d = (px - port.x) * nrm.x + (py - port.y) * nrm.y;
        if(d < nearest) nearest = d;
      });
  });
  /* The bar hangs from the LINEAGES, not from the entry.
   *
   * It is the level they arrive at and hand over on, so its distance is
   * measured from the lowest of them — AMALGAM_LEAD clear of it — and the
   * entry's own position has nothing to say about it. There used to be a
   * ceiling on that distance as well, and a ceiling measured from the
   * ENTRY is the entry deciding where the bar goes after all: past it the
   * bar simply sat a fixed distance above the amalgam and travelled with
   * it, so dragging the entry dragged the whole merge — the bar, the
   * lineages' drops onto it, the sides they left by, and any callout
   * hanging off one of those connectors. The only floor left is the one
   * the shape itself imposes: the bar may not be inside the entry it
   * feeds. */
  /* …and when the entry comes close enough that the floor takes over, the
   * bar gives way in whole GRID steps from where it rests, never by the
   * odd few pixels the floor happens to be short by.
   *
   * It used to be put exactly AMALGAM_GAP in front of the entry. An entry
   * is carried in grid steps and the bar rests a lineage's LEAD below the
   * parents, which is on no particular step — so the first step that
   * crossed the floor moved the bar by whatever the remainder was, two
   * pixels or three, and only then did it start travelling with the entry
   * in whole steps. That first nudge is the extra shift seen when an
   * amalgam is carried up under its lineages: the bar moved when the room
   * left was perfectly good. Stepping from the resting place instead
   * means the bar either stays exactly where it was or moves exactly as
   * far as the entry did. The floor itself was lowered to what the merged
   * arrow actually needs — its head, the bead it leaves from, and a sliver
   * of shaft — so the bar no longer gives way while there is room. Where
   * stepping would take the bar closer than a turn's run-up to the
   * lineages (a merge squeezed tight), it settles between the two as it
   * always did. */
  const rest = Number.isFinite(nearest) ? nearest - AMALGAM_LEAD : AMALGAM_GAP;
  let barDist = rest;
  /* A bar that has been put somewhere stays exactly there. Giving way to
     the entry is the entry deciding where the bar goes, and carried up
     under its lineages that was a push the reader could watch: the bar
     stepped ahead of the box a grid square at a time. A fixed bar is
     where it was left, and if the entry is taken across it the merged
     arrow simply comes in from the other side (see amalgamStem). */
  if(resting && resting.fixed) barDist = (resting.at - port[resting.k]) * nrm[resting.k];
  else if(barDist < AMALGAM_GAP){
    barDist = rest + Math.ceil((AMALGAM_GAP - rest) / GRID - 1e-9) * GRID;
    if(towards && Number.isFinite(nearest) && barDist > nearest - AMALGAM_SQUEEZE){
      barDist = Math.max(AMALGAM_GAP, nearest - AMALGAM_APPROACH);
      /* Closer still, the merge shrinks to what the two lines unmerged
         would need, and no further (the owner's list of 24.10, evening:
         a merge could not be brought back to the length it had before).
         The floor above was the arrow's comfortable length, and past it
         the bar went behind the lineages. Now the lineage's drop goes
         down to one corner (AMALGAM_SQUEEZE) and the arrow to its head
         and bead (AMALGAM_CROWDED); with less room than both, they share
         it in that proportion, so the bar never leaves the gap. Only for
         an entry clear of its lineages by at least the arrow's length: one
         in among them has no gap, and in less than that there is no merge
         to draw, as there would be no arrow unmerged. */
      if(resting && resting.clear && nearest >= AMALGAM_CROWDED && barDist > nearest - AMALGAM_SQUEEZE){
        const share = AMALGAM_CROWDED / (AMALGAM_CROWDED + AMALGAM_SQUEEZE);
        barDist = Math.max(Math.min(AMALGAM_CROWDED, nearest * share), nearest - AMALGAM_SQUEEZE);
      }
    }
  }
  return {b, ring, side, nrm, ux, uy, port, nearest, barDist,
          rest: restingNow(side, port, nrm, barDist, sx, sy),
          cx: port.x + nrm.x * barDist, cy: port.y + nrm.y * barDist};
}
/* Where the bar stands NOW, said the way a fixed bar is stored: the axis,
   the side of the lineages, and how far beyond them — read off where it
   was actually drawn, so writing it down moves nothing.
 *
   Answered for every merge that has lineages, not only for the ones with
   a resting place worked out above. A bar is carried by being moved from
   where it stands, and a merge whose lineages were given their sides by
   hand had nothing written down to move from: the carry found no spec
   and did nothing at all. Where it stands is a question the drawing can
   always answer. */
function restingNow(side, port, nrm, barDist, sx, sy){
  if(!sx || !sy) return null;
  const k = sideIsVertical(side) ? 'y' : 'x';
  const sp = k === 'x' ? sx : sy;
  const at = port[k] + nrm[k] * barDist;
  const after = at >= (sp.lo + sp.hi) / 2;
  return {k, after, lead: Math.max(AMALGAM_LEAD_MIN, after ? at - sp.hi : sp.lo - at)};
}
/* Which side of its own entry a lineage leaves by.
 *
 * Three cases, not two. An entry BEYOND the bar comes back towards the
 * merge and leaves by the side facing it; one SHORT of the bar goes out to
 * it and leaves by the side facing away. The third is the one that used to
 * be missing: an entry standing LEVEL with the bar — its box spanning the
 * height the bar runs at, which happens the moment one is dragged
 * alongside the merge. Neither of the first two is available there, and
 * picking one anyway sent the line out of the box and straight back over
 * itself: the loop around the outside that the lineages at the ends of a
 * bar kept drawing while the ones in the middle came down cleanly. Level
 * with the bar, a lineage leaves SIDEWAYS, by the side facing the merge,
 * and runs onto the bar end-on. A side set by hand still wins over all
 * three. */
function amalgamFromSide(a, geo, style){
  if(SIDES.includes(style && style.fromSide)) return style.fromSide;
  const {cx, cy, nrm, ux, uy, side} = geo;
  const normOf = (px, py)=> (px - cx)*nrm.x + (py - cy)*nrm.y;
  const corners = [[a.x, a.y], [a.x+a.w, a.y], [a.x, a.y+a.h], [a.x+a.w, a.y+a.h]];
  const ns = corners.map(([px, py])=> normOf(px, py));
  const lo = Math.min(...ns), hi = Math.max(...ns);
  if(lo < 0 && hi > 0){
    // Level with the bar: leave by the side pointing back at the merge.
    const along = (a.x + a.w/2 - cx)*ux + (a.y + a.h/2 - cy)*uy;
    if(sideIsVertical(side)) return along > 0 ? 'left' : 'right';
    return along > 0 ? 'top' : 'bottom';
  }
  const pc = {x: a.x + a.w/2, y: a.y + a.h/2};
  return normOf(pc.x, pc.y) >= 0 ? OPPOSITE_SIDE[side] : side;
}

/* Where the lineages land on the bar, given where each one wants to.
 *
 * Each lands straight under its own port; only lineages closer than a
 * pitch to one another are spread, and only among THEMSELVES.
 *
 * This used to be one forward pass over the whole row followed by one
 * shift of the whole row back onto its mean. The pass is right; the shift
 * was not local. The moment any two lineages came within a pitch — which
 * is what happens every time a parent is slid along the bar past another —
 * every landing on the bar moved by the same few pixels, so every OTHER
 * parent's line stepped sideways at the top, and a callout hanging off one
 * of them went with it. Parents that nothing had touched appeared to dodge
 * the one being carried.
 *
 * So the row is broken into clusters — runs of lineages that actually
 * crowd one another — and each cluster is re-centred on its own. And
 * within a cluster, the lineages whose entry is NOT in the hand (`pinned`)
 * decide where it sits: the shift is the one that leaves them, on
 * average, where they wanted to be, so a parent carried into a neighbour
 * is the one that gives way. With nothing in the hand every member counts,
 * which is the old centring, applied only where it is needed. A cluster
 * pushed into its neighbour merges with it and the pair is placed again. */
function spreadLandings(wanted, pinned, pitch){
  const n = wanted.length;
  if(n < 2) return wanted.slice();
  const place = (s, t)=>{
    const out = [wanted[s]];
    for(let i = s + 1; i <= t; i++) out.push(Math.max(wanted[i], out[out.length-1] + pitch));
    let sum = 0, cnt = 0;
    for(let i = s; i <= t; i++){
      if(!pinned[i]) continue;
      sum += out[i - s] - wanted[i]; cnt++;
    }
    if(!cnt){
      for(let i = s; i <= t; i++) sum += out[i - s] - wanted[i];
      cnt = t - s + 1;
    }
    const shift = sum / cnt;
    return out.map(v=> v - shift);
  };
  // First guess at the clusters: a lineage starts a new one when it is
  // clear of where the previous one was pushed to.
  let clusters = [];
  let pushed = -Infinity;
  for(let i = 0; i < n; i++){
    if(!clusters.length || wanted[i] >= pushed + pitch) clusters.push({s:i, t:i});
    else clusters[clusters.length-1].t = i;
    pushed = Math.max(wanted[i], pushed + pitch);
  }
  let placed = clusters.map(c=> place(c.s, c.t));
  for(let guard = 0; guard < n; guard++){
    let merged = false;
    for(let k = 1; k < clusters.length; k++){
      const prevLast = placed[k-1][placed[k-1].length - 1];
      if(placed[k][0] < prevLast + pitch - 1e-6){
        clusters.splice(k - 1, 2, {s: clusters[k-1].s, t: clusters[k].t});
        placed.splice(k - 1, 2, place(clusters[k-1].s, clusters[k-1].t));
        merged = true;
        break;
      }
    }
    if(!merged) break;
  }
  return [].concat(...placed);
}
/* The merged arrow's path, from where it leaves the bar to the port it
 * enters by — square, like every other connector on the chart.
 *
 * It used to be one straight line from the junction to the middle of the
 * entry's facing side, which is right only while the entry stands in
 * front of the bar. Put it anywhere else — off past the end of the bar,
 * or level with its own lineages — and that line ran across the chart at
 * whatever angle the two points made: the one slanted line in a drawing
 * of right angles. The owner's rule is that a merge has none.
 *
 * So, in order:
 *  - the entry stands in front of the junction: straight across, into
 *    the facing side at the junction's own place along it;
 *  - the entry is out past the end of the bar, on the far side of it from
 *    the lineages: straight on from the bar to the entry's level, and one
 *    turn into the side of it that faces back;
 *  - it is on the lineages' own side of the bar: along the bar's line
 *    past its end, and one turn into the side that faces the bar, the
 *    lineages being in the way of anything else;
 *  - and wherever a single turn has no room, two, through the middle of
 *    the gap. */
function amalgamStem(geo, from, pnodes){
  const {b, side, nrm, ux, uy, ring} = geo;
  const R = EDGE_CORNER_R, M = R + 2;
  const along = q=> q.x*ux + q.y*uy, perp = q=> q.x*nrm.x + q.y*nrm.y;
  const pt = (a, p)=> ({x: ux*a + nrm.x*p, y: uy*a + nrm.y*p});
  const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y])=> ({x, y}));
  const aLo = Math.min(...corners.map(along)), aHi = Math.max(...corners.map(along));
  const pLo = Math.min(...corners.map(perp)), pHi = Math.max(...corners.map(perp));
  const jA = along(from), jP = perp(from);
  const cA = (aLo + aHi)/2, cP = (pLo + pHi)/2;
  /* How far in from a corner the arrow may meet a side — never more than
     a quarter of that side. A flat margin of a corner's radius and a bit
     was MORE than half the height of an ordinary one-line entry, so the
     window for a straight run in front of it was empty: a merged arrow
     level with its entry still took two turns, and showed a step of under
     a unit in the middle — a break in the line, more visible the more
     colours it carried. */
  const mA = Math.min(M, (aHi - aLo) / 4), mP = Math.min(M, (pHi - pLo) / 4);
  // A port at a given place along a given side.
  const portAt = (s, coord)=>{
    const lo = sideIsVertical(s) ? b.x : b.y, len = sideIsVertical(s) ? b.w : b.h;
    const t = Math.max(0.05, Math.min(0.95, (coord - lo) / len));
    return portOnSide(b, s, 2*t - 1, 1, ring);
  };
  const toward = (dir)=> ux ? (dir > 0 ? 'left' : 'right') : (dir > 0 ? 'top' : 'bottom');
  /* Where the crossing between the bar and the entry turns. Halfway was
     right while the gap was wide; in a narrow one the last leg came out
     shorter than the arrowhead it carries, and the head sat on the corner
     with the crossing running into its back (the owner's list of 31.10).
     The last leg gets the head and a corner first, and the first leg what
     is left — at least a corner's worth while there is that much. */
  const knee = (j, f)=>{
    const g = f - j, sg = Math.sign(g) || 1, need = ARROW_LEN + R + 2;
    if(Math.abs(g) / 2 >= need) return (j + f) / 2;
    return f - sg * Math.max(Math.abs(g) / 2, Math.min(need, Math.abs(g) - R));
  };
  /* The entry wholly on one side of the bar: in by the side facing it, at
     its MIDDLE, wherever the foot is (the owner's list of 24.10, evening).
   *
     It used to come in straight at the foot's own place along that side,
     anywhere in the side's middle half — which is right while the foot
     stands in front of the entry's middle, as it does until the entry is
     carried past the end of the bar. Then the foot stays at the end, and
     the arrow slid along the side under it until a quarter in from the
     corner, where a knee appeared at last; carried further, it gave the
     side up for the end face. A step off the middle is a knee at once,
     and the face is the one towards the bar however far along the entry
     goes. Carried across the bar, `side` is the face on the other side,
     so it is that one. */
  const facing = portOnSide(b, side, 0, 1, ring);
  if(jP > pHi + 0.5){
    const fA = along(facing), fP = perp(facing);
    if(Math.abs(jA - fA) < 0.5) return {pts: [from, {x: facing.x, y: facing.y}], port: facing};
    /* …unless the foot is less than two corners off it, where the knee
       would be a kink, not a step: straight in, a little off the middle
       (the owner's list of 31.10; see flattenFacingStep). */
    if(Math.abs(jA - fA) < 2*R && jA >= aLo + M && jA <= aHi - M){
      const port = portAt(side, ux ? from.x : from.y);
      return {pts: [from, {x: port.x, y: port.y}], port};
    }
    const mid = knee(jP, fP);
    return {pts: [from, pt(jA, mid), pt(fA, mid), {x: facing.x, y: facing.y}], port: facing};
  }
  const dir = cA >= jA ? 1 : -1;
  const lineagesBeyond = pnodes.length &&
    pnodes.reduce((t, p)=> t + perp({x: p.x + p.w/2, y: p.y + p.h/2}), 0) / pnodes.length > jP;
  // Level with the bar: straight along its line into the near side.
  /* …and so does a bar that runs through the entry nearer its edge than
     that, which only a bar held where it was put, with the entry carried
     onto it, can do: two turns there had no room at all. */
  const level = jP >= pLo + mP && jP <= pHi - mP || (geo.barDist < AMALGAM_CROWDED && jP > pLo + 1 && jP < pHi - 1);
  if(level && (dir > 0 ? jA < aLo : jA > aHi)){
    const port = portAt(toward(dir), ux ? from.y : from.x);
    return {pts: [from, {x: port.x, y: port.y}], port};
  }
  const clear = dir > 0 ? jA <= aLo - 2*R : jA >= aHi + 2*R;
  const crowded = geo.barDist < AMALGAM_CROWDED;
  if(clear && ((lineagesBeyond && Math.abs(jP - cP) >= 2*R) || (crowded && Math.abs(jP - cP) > 1))){
    // Straight on from the bar to the entry's level, then in by its side.
    const port = portOnSide(b, toward(dir), 0, 1, ring);
    return {pts: [from, pt(jA, perp(port)), {x: port.x, y: port.y}], port};
  }
  if(!lineagesBeyond && Math.abs(jP - pHi) >= 2*R && jP > pHi){
    // Along the bar's line past its end, then in by the facing side.
    const port = geo.port;
    return {pts: [from, pt(along(port), jP), {x: port.x, y: port.y}], port};
  }
  // Two turns, through the middle of the gap, into the facing side.
  const port = portAt(side, ux ? Math.max(aLo + mA, Math.min(aHi - mA, from.x))
                               : Math.max(aLo + mA, Math.min(aHi - mA, from.y)));
  const mid = knee(jP, perp(port));
  return {pts: [from, pt(jA, mid), pt(along(port), mid), {x: port.x, y: port.y}], port};
}
function drawAmalgam(list, ports){
  const geo = amalgamGeometry(list, ports);
  if(!geo) return;
  const {b, ring, side, nrm, ux, uy} = geo;

  // Members read along the bar in the order their sources actually lie, so
  // the lines fan in without crossing each other.
  let members = list.slice().sort((m1,m2)=>{
    const s1 = nodes.get(m1.from), s2 = nodes.get(m2.from);
    if(!s1 || !s2) return 0;
    return sideIsVertical(side)
      ? (s1.x + s1.w/2) - (s2.x + s2.w/2)
      : (s1.y + s1.h/2) - (s2.y + s2.h/2);
  });
  /* A straight lineage keeps its PLACE on the bar and gives up only its
     elbows: it lands exactly where it would have landed with corners —
     its own stretch of the bar, between its neighbours' — and simply runs
     to that landing in one line instead of coming down onto it and
     turning. Leaving it out of the bar's arithmetic, which is what this
     did first, moved it onto the nearest handover BEAD instead: a point
     that belongs to a neighbour's turn, not to this lineage at all.
   *
     That holds with EVERY lineage straight as well. Such a merge used to
     take another form entirely — no bar, every line running to one point
     — which meant a reader who asked for straight segments lost the
     super-line they were asking about. The owner's word is that the bar
     stays and its lineages may be straight on it. */
  const allMembers = members;
  let n = members.length;
  /* Where the bar hangs — see amalgamGeometry, which works it out from the
     entry and its lineages alone so that the answer is available before
     the ports are assigned as well as here. */
  const {cx, cy} = geo;
  /* The junction, where the bar hands over to the merged arrow.
   *
   * This used to be pulled a little towards the entry, and the innermost
   * members curved down into it, so the bar sagged where the arrow left
   * it. The intent was to make the junction read as lineages POURING into
   * the arrow rather than three lines that happen to touch — but it only
   * ever worked from one side, and against a straight bar the sag showed
   * as a hook on the left of the joint and nothing on the right.
   *
   * The bead does that job now, and does it symmetrically. So the members
   * run straight onto the bar, the arrow leaves from the bar's own centre,
   * and the bead covers the meeting. One decoration instead of two that
   * disagreed. */
  // Filled in once the landings are known: the junction has to sit ON the
  // bar, and where the bar is depends on where the lineages come from.
  let dimple = {x: cx, y: cy};


  /* The bar runs from the first parent's line to the last and no further —
     it is the span the lineages actually cover, not a row of equal tiles
     with half a tile sticking out at either end. Landing offsets are
     symmetric about the entry's centre, so the merged arrow leaves from the
     bar's true middle. Each member owns the stretch from the midpoint with
     its previous neighbour to the midpoint with the next. */
  /* Where each lineage lands on the bar: under the PORT it leaves by, not
     under the middle of the entry it leaves.
   *
     These are two different points whenever an entry carries more than one
     connector on that edge — the ports share the edge out evenly, and only
     the middle one of an odd fan is at the centre. Landing every lineage
     under the entry's centre therefore asked it to come down, step
     sideways by the difference, and turn: a small jog at the top of the
     line, on the very connectors that should be the tidiest on the chart.
   *
     The obvious fix — slide the port to meet the landing — is the wrong
     one, because the even share along an edge is itself information and
     must not be spent (see portSlack). The landing is ours to place and
     the port is not, so the landing moves. Both properties then hold at
     once: the fan leaves evenly spaced AND every lineage drops straight
     onto the bar. */
  /* A lineage that leaves ALONG the bar — by the bottom of its entry, say,
     towards a bar that stands upright beside it — cannot land level with
     its port: it has to run out of the entry first, and only then turn
     towards the bar. Landing it level with the port asked it to run out,
     come back, turn, and turn again — the S at the top of the line,
     wherever a single corner would have done. So its landing is where its
     run-out ends, and the run-out is pinned to that length, so the router
     and this arithmetic agree on where the corner is. */
  const runOutAlong = (p)=>{
    const pn = p && SIDE_NORMAL[p.side];
    if(!pn) return 0;
    const alongBar = pn.x * ux + pn.y * uy;
    if(Math.abs(alongBar) < 0.5) return 0;
    return alongBar * stubLength(Object.assign({}, p, {head: true}), null);
  };
  const alongOf = (e)=>{
    const rec = ports.get(e);
    const p = rec && rec.p1;
    const src = nodes.get(e.from);
    let c;
    if(p) c = (sideIsVertical(side) ? p.x : p.y) + runOutAlong(p);
    else if(src) c = sideIsVertical(side) ? src.x + src.w/2 : src.y + src.h/2;
    else return 0;
    const base = sideIsVertical(side) ? cx : cy;
    /* Straight under the lineage, and nothing else.
     *
     * There used to be a cap here holding every landing within a fixed
     * distance of the ENTRY, meant to stop the bar chasing an amalgam
     * dragged away from its lineages. It could not do that — the bar
     * spans its landings, and the landings are where the lineages are —
     * and it did something else instead: because the cap was measured
     * from the entry, sliding the entry ALONG its own bar moved every
     * landing that was near the limit, so the parents' connectors
     * shuffled sideways in step with an entry that has nothing to do with
     * where they come down. The bar's length is already bounded by the
     * ground the lineages cover, and how far the entry may be dragged from
     * them is not this arithmetic's business, and is no longer
     * anybody's: an entry goes where it is put. */
    return c - base;
  };
  const wantedAll = members.map(alongOf);
  const landingsAll = spreadLandings(wantedAll,
    members.map(e=> !entryBeingCarried(e.from)), AMALGAM_PITCH);
  /* Which straight lineages leave the bar (the owner's rule, 22.10).
   *
     A lineage routed straight that stays on the bar comes straight DOWN
     onto its own landing — exactly the line it would have with elbows, so
     asking for straight changed nothing a reader could see. It now runs
     on a slant where that says something and crosses nothing:
   *
      - at either END of the bar it gives up its stretch, the bar is built
        from the others, and it runs to the end of that bar on its side.
        Running on to the junction instead would cross every lineage
        standing between it and the middle;
      - in the MIDDLE it runs straight into the junction bead, unless that
        line would cross another lineage on the way, when it stays on the
        bar as before. The one standing over the junction already drops
        into it, and stays as it is;
      - one lineage always keeps the bar, so there is a bar for the merged
        arrow to leave from and for the others to land on.
   *
     A middle lineage that the edges' leaving made the outermost one on the
     bar stays, so the bar's ends — and the junction clamped between them —
     are settled before any middle one is asked about. */
  const leaves = new Map();
  const straightAt = (i)=> edgeStyleFor(members[i].from, members[i].to).routing === 'straight' &&
                           !!(ports.get(members[i]) && ports.get(members[i]).p1);
  if(n >= 2){
    if(straightAt(0)) leaves.set(0, 'end');
    if(straightAt(n-1)) leaves.set(n-1, 'end');
    if(leaves.size === n){
      // Two lineages, both straight: the one nearer the entry keeps the bar.
      leaves.delete(Math.abs(landingsAll[0]) <= Math.abs(landingsAll[n-1]) ? 0 : n-1);
    }
  }
  const keptIdx = members.map((_, i)=> i).filter(i=> !leaves.has(i));
  const kLo = landingsAll[keptIdx[0]], kHi = landingsAll[keptIdx[keptIdx.length - 1]];
  const junctionK = Math.max(kLo, Math.min(kHi, 0));
  const ptOn = (off)=> ({x: cx + ux*off, y: cy + uy*off});
  const startOf = (i)=>{ const p = ports.get(members[i]).p1; return {x: p.x, y: p.y}; };
  const endOf = (i)=> leaves.get(i) === 'end' ? ptOn(i === 0 ? kLo : kHi)
                    : leaves.get(i) === 'junction' ? ptOn(junctionK) : ptOn(landingsAll[i]);
  const crosses = (a, b, c, d)=>{
    const den = (b.x - a.x)*(d.y - c.y) - (b.y - a.y)*(d.x - c.x);
    if(Math.abs(den) < 1e-9) return false;
    const t = ((c.x - a.x)*(d.y - c.y) - (c.y - a.y)*(d.x - c.x)) / den;
    const u = ((c.x - a.x)*(b.y - a.y) - (c.y - a.y)*(b.x - a.x)) / den;
    // Meeting at an end — the bead, a landing — is not crossing.
    const e = 0.02;
    return t > e && t < 1 - e && u > e && u < 1 - e;
  };
  for(let i = 1; i < n - 1; i++){
    if(leaves.has(i) || !straightAt(i)) continue;
    if(i === keptIdx[0] || i === keptIdx[keptIdx.length - 1]) continue;
    if(Math.abs(landingsAll[i] - junctionK) < 0.5) continue;
    const a = startOf(i), b2 = ptOn(junctionK);
    let blocked = false;
    for(let j = 0; j < n && !blocked; j++){
      if(j === i || !(ports.get(members[j]) && ports.get(members[j]).p1)) continue;
      blocked = crosses(a, b2, startOf(j), endOf(j));
    }
    if(!blocked) leaves.set(i, 'junction');
  }
  /* The bar itself is laid out from the lineages that stay on it. Their
     landings are the ones worked out for everybody, so a lineage leaving
     moves none of the others. */
  const departed = [];
  leaves.forEach((how, i)=> departed.push({e: members[i], how, start: startOf(i)}));
  const keep = members.map((_, i)=> !leaves.has(i));
  members = members.filter((_, i)=> keep[i]);
  const landings = landingsAll.filter((_, i)=> keep[i]);
  n = members.length;
  /* The junction, where the bar hands over to the merged arrow: the
     MIDDLE of the ground the lineages cover.
   *
     It used to want to be straight in front of the entry — offset 0,
     clamped into the span — which reads well and made the stem vertical,
     but it is one more thing about the merge that the entry decides. The
     junction is where the colours hand over, so it sets how much bar each
     lineage owns; sliding the entry sideways therefore lengthened one
     lineage's stretch and shortened another's, and a callout anchored on
     one of those stretches was carried along with it. Nothing about a
     merge should move because the entry it feeds was put somewhere else.
     The stem leans instead, which is what a connector does. */
  /* Two points, not one — which is what the last two rounds kept getting
     wrong by insisting they were the same thing.
   *
     The SEAM is where the lineages hand the bar over to one another and
     where the colours change: it belongs to the merge, so it is the middle
     of the ground the lineages cover and it does not move when the entry
     does. That is what keeps a callout anchored on a lineage's stretch of
     bar exactly where it was put.
   *
     The JUNCTION is where the merged arrow leaves the bar. That is the
     stem of the connector into the entry, and a connector's job is to
     reach the thing it feeds — so it stands in front of the entry,
     clamped to the bar it has to leave from, and travels along the bar as
     the entry is dragged. Nothing else on the merge depends on it. */
  /* Taken from EVERY lineage, those that left the bar included, and only
     then held on the bar that is drawn: a straight lineage leaving moves
     no colour's hand-over and no callout anchored on a stretch. */
  const seam = Math.max(landings[0], Math.min(landings[n-1],
    (landingsAll[0] + landingsAll[landingsAll.length - 1]) / 2));
  /* Where the merged arrow leaves the bar — in front of the entry, and on
     a LANDING when it is nearly on one.
   *
     What the entry hangs from is the bar in front of it, so the stem
     leaves from in front of the entry and from nowhere else. An attempt to
     have it settle onto the nearest lineage's landing — so that the two
     would share one bead — is reverted: it moved the foot of the merged
     arrow away from the entry it belongs to, which is a worse thing than
     the doubled mark it was chasing. */
  /* …unless the merged arrow has been bent by hand. Then its route is the
     corners somebody set, and the first of them stands straight out from
     where it leaves the bar — so that is where it leaves, wherever the
     entry is put. Travelling with the entry, the foot slid along the bar
     under corners that stayed where they were, and the route between them
     folded back on itself (the owner's list of 24.10). */
  const outStyle = edgeStyleFor('', b.id);
  const footBend = outStyle.routing !== 'straight' && outStyle.bends && outStyle.bends.length
    ? outStyle.bends[0] : null;
  let foot = footBend ? (ux ? footBend[0] - cx : footBend[1] - cy) : 0;
  /* A bar that has been put somewhere stays put however close the entry
     is carried to it, or onto it — but in front of an entry closer to it
     than the arrow's own head there is no room to leave from, and the
     arrow was drawn shorter than its head, pointing back at the bar, and
     then from inside the box (the owner's video of 24.10). So the foot
     steps along the bar to just past the entry's end, and the arrow comes
     in by its side (see amalgamStem). Only where the bar reaches that far;
     otherwise it stays in front, as it always did. */
  /* …and only while the bar runs THROUGH the entry. An entry wholly on
     one side of it, however close, is fed by the face towards the bar
     (the owner's list of 24.10, evening: the face it had, or the one
     opposite once it is carried across), with as much arrow as there is
     room for; the side was the wrong port for it. */
  const across = [[b.x, b.y], [b.x + b.w, b.y + b.h]].map(([x, y])=> (x - cx) * nrm.x + (y - cy) * nrm.y);
  const straddles = Math.min(...across) < 0.5 && Math.max(...across) > -0.5;
  if(!footBend && straddles){
    const lo = ux ? b.x - cx : b.y - cy, hi = lo + (ux ? b.w : b.h);
    const clear = 2 * EDGE_CORNER_R + AMALGAM_JOINT_R + 2;
    const room = [lo - clear, hi + clear].filter(v=> v >= landings[0] && v <= landings[n-1]);
    if(room.length) foot = room.sort((u, v)=> Math.abs(u) - Math.abs(v))[0];
  }
  const junction = Math.max(landings[0], Math.min(landings[n-1], foot));
  /* Where the bar is, kept for the drag that wants to centre the entry on
     it — see alignGuides. In chart coordinates, along the bar's own axis. */
  amalgamBars.set(b.id, {
    axis: ux ? 'x' : 'y',
    lo: (ux ? cx : cy) + landings[0],
    hi: (ux ? cx : cy) + landings[n-1],
    /* Where the bar lies on the OTHER axis, so the guide can put a mark on
       the middle of it. The middle is not drawn on the chart at rest — it
       is not a seam and marking it says nothing — but it is exactly what
       the hand is aiming at while the entry is being centred, and a line
       crossing the bar does not say WHICH point on the bar it means. */
    cross: ux ? cy : cx,
    /* Where the bar stands, in the form a fixed bar is kept in — what a
       drag writes down when it first takes hold of it (fixAmalgamBars). */
    rest: geo.rest,
    /* Where each lineage lands, and where it would land if nothing were
       crowding it — its port. The first is what the bar's guides are laid
       out from; the second is how far a parent's port stands from its
       own middle, which is what a parent being carried along the bar is
       really positioning. */
    landings: allMembers.map((e, i)=> ({from: e.from,
                                        at: (ux ? cx : cy) + landingsAll[i],
                                        port: (ux ? cx : cy) + wantedAll[i]}))
  });
  /* The bar is STRAIGHT. It was straight before two rounds of trying to
     give it a shape, and neither shape was ever the point: a bow away from
     the entry and a sag towards it are both a bend in a line that is meant
     to be the level the lineages arrive at. The lineages come down, they
     turn onto it, they run along it, and the merged arrow leaves from the
     middle. The only thing that has to be right is the TURN — see the
     corner guarantee below. */
  const barPt = (off)=> ({x: cx + ux*off, y: cy + uy*off});
  dimple = barPt(junction);
  /* Each lineage's stretch of the bar: from the midpoint with its previous
     neighbour to the midpoint with the next.

     The turn onto the bar is a rounded corner, and a rounded corner needs
     LEG to hold its radius on both sides of the bend. Both legs are
     guaranteed: the run-up is a stub of AMALGAM_APPROACH, and the run
     along the bar is half the gap to the nearest neighbour, which the
     spacing passes above keep at AMALGAM_PITCH or more however the entry
     is dragged. Neither can collapse, so the corner cannot square off. */
  /* Where each lineage's colour runs to.
   *
   * A colour travels along the bar from where its lineage lands TOWARDS
   * the junction, and it keeps the bar until the next lineage joins and
   * takes over. So a lineage owns the stretch between its own landing and
   * its neighbour's on the junction side — not the two half-stretches
   * either side of it, which is what this did first. The difference shows
   * wherever the lineages are unevenly spaced: the seams sat at the
   * midpoints, in open bar, instead of at the landings where one lineage
   * actually hands over to the next.
   *
   * The pair straddling the junction hand over AT the junction, since past
   * it a colour would be travelling away from the arrow it feeds. The
   * lineage sitting on the junction itself owns no bar at all — it lands
   * exactly where the merged arrow leaves. */
  const bounds = landings.map((o, i)=>{
    if(o < seam){
      const nxt = (i+1 < n) ? landings[i+1] : o;
      return {lo: o, hi: Math.min(nxt, seam)};
    }
    if(o > seam){
      const prv = (i > 0) ? landings[i-1] : o;
      return {lo: Math.max(prv, seam), hi: o};
    }
    return {lo: o, hi: o};
  });
  // Whose stretch is where, in chart coordinates — what a click on the
  // bar asks to find the lineage it landed on.
  amalgamBars.get(b.id).stretches = members.map((e, i)=> ({from: e.from,
    lo: (ux ? cx : cy) + bounds[i].lo, hi: (ux ? cx : cy) + bounds[i].hi}));

  /* A note on a lineage of a merge is a note like any other.
   *
     There used to be a whole apparatus here for placing them: the fan's
     ground as a box to stay out of, every line of the construction
     collected so a card could be tested against all of them, a direction
     worked out per lineage from which end of the bar it sat on, and the
     notes drawn last so they could be judged against the finished shape.
     All of it existed to GUESS a good spot, and guessing is no longer what
     happens — a leader is aimed by hand, and keeps the angle and distance
     it was given (see noteAimOf). The apparatus had become an elaborate
     way of computing an answer nobody reads. */

  /* Where the beads will stand — worked out before anything is drawn,
     because a lineage's own end at the bar has to stop at the edge of the
     bead it runs into rather than under it (see barEndOf). The beads
     themselves are still painted last. */
  const joints = [];
  for(let i = 0; i < n - 1; i++){
    const jAt = bounds[i].hi;                       // == bounds[i+1].lo
    if(Math.abs(jAt - junction) < AMALGAM_BEAD_CLEAR) continue;
    /* Never the same point twice. Evenly spaced lineages hand the bar over
       at one and the same place — the middle — so every seam between them
       resolved to that one point and the bar carried two or three beads
       stacked on the same pixel, each drawn over the last. */
    if(joints.some(j=> Math.abs(j.at - jAt) < 0.75)) continue;
    const pairAt = [amalgamMemberColor(members[i]), amalgamMemberColor(members[i+1])];
    /* And nothing at all at the MIDDLE of the bar unless something really
       changes there. The middle is where the arithmetic puts every seam of
       an evenly spaced merge, so a bead there was not marking a hand-over
       the reader could see — it was a dot in the centre of a plain line.
       The middle is worth knowing when you are lining the entry up on it,
       and that is a guide: it is drawn while the entry is carried with
       Shift held, and at no other time. */
    if(Math.abs(jAt - seam) < 0.75 && pairAt[0] === pairAt[1]) continue;
    joints.push({at: jAt, pair: pairAt, i});
  }
  const junctionBead = !edgeStyleFor('', b.id).arrowIn;
  /* The lineage next to the junction runs on into it — see the reach
     below — so that is where its line, and its end, are. */
  const reachK = Math.abs(junction - seam) <= 0.5 ? -1
    : junction > seam ? bounds.findIndex(r=> Math.abs(r.hi - seam) < 1e-6 && r.lo < seam)
                      : bounds.findIndex(r=> Math.abs(r.lo - seam) < 1e-6 && r.hi > seam);
  /* What a lineage's end at the bar is, given where along the bar its line
     ends and which way it was going: the tip of its head, which way the
     head points, and where the line under it stops.
   *
     The head used to be drawn where the lineage LANDS, pointing down into
     the bar — at the first bead it passes, while its colour ran on along
     the bar past the head to where it really hands over (the owner's list
     of 24.10). A lineage's end is where its line ends: the far end of its
     stretch, or the junction for the one that runs on into it. The tip
     stops at the edge of the bead standing there, and the line stops under
     the head, as everywhere else on the chart — run on under it, a colour
     with any transparency showed the line through the head, and the head
     read as washed out. */
  const beadAround = (off)=>{
    if(junctionBead && Math.abs(off - junction) < AMALGAM_BEAD_R + 1) return {c: junction, r: AMALGAM_BEAD_R};
    const j = joints.find(j=> Math.abs(j.at - off) < 0.75);
    return j ? {c: j.at, r: AMALGAM_JOINT_R} : {c: off, r: 0};
  };
  const barEndCut = (style)=> style.barEnd === 'tout' ? TEE_CUT : style.barEnd === 'oout' ? OPEN_CUT : ARROW_TRIM;
  const barEndOf = (style, from, endOff)=>{
    if(!style.barEnd) return null;
    const s = Math.sign(endOff - from);
    if(!s) return null;
    const {c, r} = beadAround(endOff);
    let tipOff = c - s*r;
    // A stretch too short to hold the head before the bead: at its end.
    if(s * (tipOff - from) < ARROW_LEN) tipOff = endOff;
    const tip = barPt(tipOff);
    return {x: tip.x, y: tip.y, ang: Math.atan2(uy*s, ux*s) * 180 / Math.PI,
            line: barPt(tipOff - s*barEndCut(style)), cut: s*(endOff - tipOff) + barEndCut(style)};
  };
  /* …and one arriving at a point rather than along the bar: the end of a
     route, or a straight line to the bar's end or the junction. */
  const pointEndOf = (style, prev, at, off)=>{
    if(!style.barEnd) return null;
    const len = Math.hypot(at.x - prev.x, at.y - prev.y);
    if(len < 0.5) return null;
    const dx = (at.x - prev.x) / len, dy = (at.y - prev.y) / len;
    const {r} = typeof off === 'number' ? beadAround(off) : {r: 0};
    const back = len - r > ARROW_LEN ? r : 0;
    return {x: at.x - dx*back, y: at.y - dy*back, ang: Math.atan2(dy, dx) * 180 / Math.PI,
            cut: back + barEndCut(style)};
  };
  const lastBefore = (pts, at)=>{
    let k = pts.length - 1;
    while(k > 0 && Math.hypot(pts[k].x - at.x, pts[k].y - at.y) < 0.5) k--;
    return pts[k];
  };
  const barEnds = new Map();
  /* Each piece of the bar as drawn, and where along the bar each lineage
     sets off from — what the way through below is laid from. */
  const spans = [], starts = [];

  /* Each middle lineage's run along the bar, as drawn — the reach below
     has to lie on exactly the same line where it crosses one. */
  const stretches = [];
  /* Each lineage's part of the bar on its own, as drawn — what a picked
     bar is lit along (see paintBarFocus). */
  const barPieces = [];
  members.forEach((e, i)=>{
    const a = nodes.get(e.from);
    const recM = ports.get(e);
    if(!a || !recM || !recM.p1) return;
    /* …and it keeps no hand-set bends.
     *
       A bend is a route somebody drew by hand, and a merged lineage has no
       route of its own to draw: where it leaves, where it comes down and
       where it turns onto the bar are all decided by the merge, and the
       bar moves with the parents every time one of them is touched. A
       point pinned in chart coordinates through that has nothing to hold
       on to — it dragged the line out of the fan and put a kink in it a
       stub away from the bar. The bends stay in the file, so breaking the
       merge brings back the route that was drawn; while the merge stands
       they are simply not part of it (see drawBendHandles, which offers
       no handles here either). */
    const style = Object.assign({}, edgeStyleFor(e.from, e.to), {bends: undefined});
    const color = amalgamMemberColor(e);
    const dash = DASH_PATTERNS[style.dash];
    const o = landings[i];
    const {lo, hi} = bounds[i];

    /* Where this lineage meets the bar, and where its colour runs to.

       It comes STRAIGHT DOWN onto its own landing and turns once, inward
       along the bar — one 90° bend with a full radius on either side of
       it, exactly the corner every other connector on the chart turns.

       It used to arrive along the bar instead, from beyond its landing,
       which meant the router had to bring it to bar level a stub's length
       PAST the landing and walk it back: down, a jog outward, then a
       180° reversal into the bar. There is no radius that can round a
       reversal — which is why the turn onto the bar stayed a hard corner
       however the bar itself was shaped, and why it broke completely when
       dragging an entry left the jog nothing to happen in.

       The stretch of bar OUTSIDE the landing — the half it shares with
       its outer neighbour — is drawn as its own straight run in the same
       colour, collinear with the turn, so the colours still tile the bar
       end to end with nothing left uncovered and nothing overlapping. */
    /* Its whole stretch lies on the junction side of its landing, so the
       line comes down, turns once, and runs to the end of it. There is no
       second half on the far side to cover any more — the neighbour out
       there owns the bar right up to this landing. */
    const inward = (o < seam) ? hi : lo;
    const land = barPt(o);

    /* It leaves its entry by the MIDDLE of the side amalgamFromSide chose
       — see resolvePorts, which seats a merged lineage at the centre of
       its side and moves the ordinary connectors sharing that side out of
       its way. The port is therefore already where it belongs, and the
       landing is placed under it (see alongOf) rather than the other way
       round: the lineage comes down in one straight run, and nothing of
       the merge depends on which slot of a fan it happened to be given. */
    const p1raw = recM.p1 || portOnSide(a, amalgamFromSide(a, geo, style), 0, 1, style.fromRing || 0);
    const run = Math.abs(runOutAlong(p1raw));
    const p1 = run ? Object.assign({}, p1raw, {stub: run}) : p1raw;
    // Approached head-on, from the side the lineages are on.
    /* …from whichever side of the bar the lineage is on. That is the far
       side, from the entry, whenever the entry stands clear of its
       lineages; carried past the bar, the entry has them on its own side,
       and approaching from beyond the bar there sent the line past it, back
       round and onto it again — the hooked corner at either end. */
    const beyond = (p1raw.x - land.x) * nrm.x + (p1raw.y - land.y) * nrm.y >= 0;
    const target = {x: land.x, y: land.y, side: beyond ? side : OPPOSITE_SIDE[side],
                    ring: 0, stub: AMALGAM_APPROACH};
    const { pts } = pathFromPorts(p1, target, style, new Set([a.id, b.id]), recM.lane || 0);
    /* Only the two lineages at the ENDS of the bar round their turn onto
       it. For them the bar starts where they land, and a rounded corner is
       what any connector turning a corner does. For every lineage between
       them the bar runs straight THROUGH the landing — its own colour one
       way, its neighbour's the other — so the join is a T, and rounding a
       T bends the upright away from the crossbar as though the line went
       somewhere it does not. */
    const onEnd = (i === 0 || i === n-1);
    const bar = Math.abs(inward - o) > 0.5 ? barPt(inward) : null;
    /* Its own ends, as any connector has (the owner's ask, 23.10): an
       arrowhead or a T where it leaves its entry, cut back from the line
       as everywhere else, and one where it meets the bar. */
    const cutIn = mergeMemberCutIn(style, p1, e.from);
    /* Its end at the bar: along its stretch, at the junction for the one
       that runs on into it (which is drawn with the reach, below), or at
       its landing for one that owns no bar. */
    const tail = i === reachK ? barEndOf(style, o, junction)
      : bar ? barEndOf(style, o, inward)
      : pointEndOf(style, lastBefore(pts, land), land, o);
    if(tail) barEnds.set(i, tail);
    const own = i === reachK ? null : tail;
    let ptsD = (cutIn && !style.sinusoid) ? trimForHeads(pts, true, false, p1, null, cutIn) : pts;
    if(own && !bar && !style.sinusoid) ptsD = trimForHeads(ptsD, false, true, null, null, null, own.cut);
    const joined = (bar && onEnd) ? ptsD.concat([own && !style.sinusoid ? own.line : bar]) : ptsD;
    let d = style.sinusoid ? wavyPath(joined, cutIn, own && (onEnd || !bar) ? own.cut : 0)
                           : roundedPath(joined, edgeCornerR(style));
    /* A wavy lineage waves along its stretch of the bar too. The stretch
       is its own run, started afresh at the landing, so the T stays a T:
       the upright arrives at the bar and the ripple sets off along it,
       rather than one wave laid round the corner as though the line turned
       there. It was always drawn straight, so a lineage set to wavy came
       down rippling and then ran the whole of its colour along the bar as
       a plain line. A wave fits whole lengths into its run and so ends on
       the bar's own line, where the next colour picks up. */
    if(bar && !onEnd){
      const stop = own ? own.line : bar;
      d += style.sinusoid ? ' ' + wavyPath([land, bar], 0, own ? own.cut : 0, true)
                          : ` L${stop.x.toFixed(2)},${stop.y.toFixed(2)}`;
      stretches[i] = {land, bar, wavy: !!style.sinusoid};
    }
    /* What the reader sees, whichever way the corner was drawn. `joined`
       carries the bar leg only for the two end lineages, so anchoring a
       note on it put a note on a MIDDLE lineage back on the short routed
       line — the very bug the anchor was changed to fix, still there for
       every lineage that was not at one end of the bar. */
    const notePts = bar ? pts.concat([bar]) : pts;
    // A gradient runs the length of the lineage, bar stretch and all.
    const paint = style.gradient ? makeEdgeGradient(style.gradient, notePts) : color;
    if(bar){
      const piece = style.sinusoid ? wavyPath([land, bar], 0, 0, true)
        : `M${land.x.toFixed(2)},${land.y.toFixed(2)} L${bar.x.toFixed(2)},${bar.y.toFixed(2)}`;
      barPieces.push({from: e.from, d: piece});
      spans.push({lo: Math.min(o, inward), hi: Math.max(o, inward), d: piece, stroke: paint, style, from: e.from});
    }
    starts.push({from: e.from, at: o});
    const attrs = {class:'edge struct amalgam-member', d, stroke: paint,
                   'data-from':e.from, 'data-to':e.to};
    if(dash){
      attrs['stroke-dasharray'] = dash;
      if(cutIn) attrs['stroke-dashoffset'] = cutIn.toFixed(2);
    }
    edgePath(attrs, style, edgeLayer);
    drawRingCap(pts[0], paint, dash, e.from, e.to, isDoubleDash(style), d);
    drawMergeMemberEnds(e, style, pts, p1, paint, tail);
    /* The note is anchored on the line the reader actually sees, bar leg
       and all. It used to be anchored on the routed part alone, so a point
       picked halfway along a merged lineage landed halfway along a shorter
       line — the note appeared somewhere the reader had not pointed at. */
    /* Asked unconditionally: whether there is anything to draw is one
       question with one answer, and drawEdgeNote is where it lives — an
       empty note is still drawn while it is being started. */
    drawEdgeNote(style.note, notePts, style.notePos, e.from, e.to,
                                style.noteAt, color, style.noteBg);
    drawCalloutLeaders(e.from, e.to, notePts, color);
    edgeHit(d, e.from, e.to);
  });

  /* And the one arrow out of the middle of the bar into the entry, carrying
     every contributing colour.

     It is deliberately left with no source entry of its own. This stretch
     belongs to the merge, not to any single lineage: filtering away one
     parent should take that parent's line and its stretch of the bar and
     nothing else, leaving the merged arrow to carry whatever is still
     there. Naming a source here — it used to name the first member — meant
     hiding one tag could delete the arrow the whole amalgam hangs from. */
  /* The lineage next to the junction runs on INTO it.
   *
   * The colours hand over at the seam, the middle of the ground the
   * lineages cover, and that point stands still whatever the entry does
   * (see the seam above). The merged arrow leaves from in front of the
   * entry, and the two are rarely the same point. Between them lay a few
   * units of bar that belonged to the lineage on the far side — which no
   * one sees while the merge is all one ink, and which every reader sees
   * the moment one lineage is lit: its line came down, turned, ran a
   * stub's length and stopped just short of the dot it was plainly
   * feeding, the bar between dimmed with the rest. So the lineage on the
   * near side of the junction carries its own line on to it. Its stretch,
   * and so the seam and anything anchored on the stretch, is unchanged;
   * this is only the last few units of line, drawn over its neighbour's. */
  if(reachK >= 0){
    const k = reachK;
    const e = members[k];
    if(e){
      const style = edgeStyleFor(e.from, e.to);
      /* Its end, if it has one, is at the junction, and the line stops
         under it. */
      const tail = barEnds.get(k);
      const from = barPt(seam), to = tail ? tail.line : barPt(junction);
      /* Drawn over its neighbour's stretch, so it takes that stretch's
         shape: where the neighbour ripples, this is the same ripple cut
         to the few units between the seam and the junction — a straight
         piece laid over a wave stood out as a flat bar across its crests. */
      const j = junction > seam ? bounds.findIndex(r=> Math.abs(r.lo - seam) < 1e-6 && r.hi > seam)
                                : bounds.findIndex(r=> Math.abs(r.hi - seam) < 1e-6 && r.lo < seam);
      const under = j >= 0 ? stretches[j] : null;
      /* …unless the lineage carrying it on is wavy itself, when it is its
         OWN ripple that runs on: the line is that lineage's, and laying it
         as a straight piece (or as the neighbour's ripple) between the last
         of its waves and the dot it feeds is the style giving out a few
         units short of where the line ends. */
      const d = style.sinusoid
        ? wavyPath([from, barPt(junction)], 0, tail ? tail.cut : 0, true)
        : (under && under.wavy)
        ? wavyPath([under.land, under.bar], Math.hypot(under.land.x - to.x, under.land.y - to.y), 0, true)
        : `M${from.x.toFixed(2)},${from.y.toFixed(2)} L${to.x.toFixed(2)},${to.y.toFixed(2)}`;
      const attrs = {class:'edge struct amalgam-reach',
                     d,
                     stroke: amalgamMemberColor(e), 'data-from':e.from, 'data-to':e.to};
      const dash = DASH_PATTERNS[style.dash];
      if(dash) attrs['stroke-dasharray'] = dash;
      edgePath(attrs, Object.assign({}, style, {sinusoid: false}), edgeLayer);
      barPieces.push({from: e.from, d});
      spans.push({lo: Math.min(seam, junction), hi: Math.max(seam, junction), d,
                  stroke: amalgamMemberColor(e), style, from: e.from});
    }
  }
  /* The lineages that left the bar: one straight line each, from the port
     to the end of the bar on its side or into the junction (see `leaves`
     above). Everything a lineage carries — the ring cap, its note and
     callouts, the hit line, its part of a lit bar — goes with it. */
  const departedEnds = [];
  departed.forEach(({e, how, start})=>{
    const style = Object.assign({}, edgeStyleFor(e.from, e.to), {bends: undefined});
    const color = amalgamMemberColor(e);
    const dash = DASH_PATTERNS[style.dash];
    const end = how === 'end'
      ? barPt(landings[allMembers.indexOf(e) === 0 ? 0 : n - 1])
      : dimple;
    const pts = [start, end];
    const p1 = ports.get(e).p1;
    const cutIn = mergeMemberCutIn(style, p1, e.from);
    /* Its end where it meets the bar: off the bead standing there, which
       for one running to the bar's end is that end's own (drawn below)
       unless the junction's is already on it. */
    const nearJunction = Math.hypot(end.x - dimple.x, end.y - dimple.y) < AMALGAM_BEAD_CLEAR;
    const tail = pointEndOf(style, start, end, nearJunction ? junction : null);
    if(tail && how === 'end' && !nearJunction){
      const len = Math.hypot(end.x - start.x, end.y - start.y);
      if(len - AMALGAM_JOINT_R > ARROW_LEN){
        tail.x -= (end.x - start.x) / len * AMALGAM_JOINT_R;
        tail.y -= (end.y - start.y) / len * AMALGAM_JOINT_R;
        tail.cut += AMALGAM_JOINT_R;
      }
    }
    const s0 = cutIn && !style.sinusoid ? arrowTrimmed(end, start, cutIn) : start;
    const e0 = tail && !style.sinusoid ? arrowTrimmed(start, end, tail.cut) : end;
    const d = style.sinusoid ? wavyPath(pts, cutIn, tail ? tail.cut : 0)
                             : `M${s0.x.toFixed(2)},${s0.y.toFixed(2)} L${e0.x.toFixed(2)},${e0.y.toFixed(2)}`;
    const paint = style.gradient ? makeEdgeGradient(style.gradient, pts) : color;
    const attrs = {class:'edge struct amalgam-member amalgam-direct', d, stroke: paint,
                   'data-from':e.from, 'data-to':e.to};
    if(dash){
      attrs['stroke-dasharray'] = dash;
      if(cutIn) attrs['stroke-dashoffset'] = cutIn.toFixed(2);
    }
    edgePath(attrs, style, edgeLayer);
    drawRingCap(p1, paint, dash, e.from, e.to, isDoubleDash(style), d);
    drawMergeMemberEnds(e, style, pts, p1, paint, tail);
    drawEdgeNote(style.note, pts, style.notePos, e.from, e.to, style.noteAt, color, style.noteBg);
    drawCalloutLeaders(e.from, e.to, pts, color);
    edgeHit(d, e.from, e.to);
    barPieces.push({from: e.from, d});
    if(how === 'end') starts.push({from: e.from, at: landings[allMembers.indexOf(e) === 0 ? 0 : n - 1]});
    if(how === 'end') departedEnds.push({at: end, pair: [color,
      amalgamMemberColor(allMembers.indexOf(e) === 0 ? members[0] : members[n - 1])],
      from: e.from, to: (allMembers.indexOf(e) === 0 ? members[0] : members[n - 1]).from});
  });
  amalgamBars.get(b.id).pieces = barPieces;
  /* The way through.
   *
     A lineage's colour runs along the bar only as far as its neighbour's
     landing; from there to the junction the bar is other lineages'. So
     picking an outer parent lit its line, its own stretch, the merged
     arrow — and between them, on the very path it was picked to show,
     stretches of bar stepped back with the rest of the chart: the lit way
     broke at the seam (the owner's list of 24.10). Each lineage therefore
     carries a tracing of every piece of bar between it and the junction,
     in that piece's own colour and line, unseen unless the lineage is lit
     — and lit, it is the path. The joints it passes say so too (data-via),
     so a dimmed bead does not stand in the middle of a lit way. */
  starts.forEach(({from, at})=>{
    const lo = Math.min(at, junction) - 0.5, hi = Math.max(at, junction) + 0.5;
    spans.forEach(sp=>{
      if(sp.from === from || sp.lo < lo || sp.hi > hi) return;
      const attrs = {class:'edge struct amalgam-through', d: sp.d, stroke: sp.stroke,
                     'data-from': from, 'data-to': b.id};
      const dash = DASH_PATTERNS[sp.style.dash];
      if(dash) attrs['stroke-dasharray'] = dash;
      edgePath(attrs, Object.assign({}, sp.style, {sinusoid: false}), edgeLayer);
    });
  });
  const viaOf = (off)=> starts.filter(s=> (s.at - off) * (junction - off) < 0).map(s=> s.from);
  const colors = allMembers.map(amalgamMemberColor);
  // It leaves from a point ON the bar, so the bar and the arrow are one
  // continuous shape rather than a line crossing another line.
  const stem = amalgamStem(geo, dimple, allMembers.map(e=> nodes.get(e.from)).filter(Boolean));
  drawMergedArrow(b, stem, colors, ring, geo.side);

  /* The bead over the junction.
   *
   * Where the members' curves, the bar and the merged arrow all meet, three
   * strokes of three different colours end at very nearly the same point.
   * However carefully the tangents are matched, the meeting shows: a nick
   * where two curves part by a fraction of a pixel, a corner of one colour
   * poking past another. Rather than keep chasing the geometry, the joint
   * is covered by something that belongs there — a bead carrying every
   * lineage's colour, which is exactly what the junction MEANS.
   *
   * Its gradient runs across the bead along the bar, not along the arrow,
   * so all the colours appear in it. Painted last, so it covers whatever
   * it is hiding, and given the merged arrow's own from/to so the tag
   * filter treats it as part of the merge. */
  /* A bead at every joint, not only at the middle.
   *
   * Where two lineages' stretches of the bar meet, one colour ends and the
   * next begins — a hard seam in the middle of what reads as one line. The
   * junction has always been covered by a bead carrying every colour;
   * these do the same job at the same scale for the two colours that
   * actually meet there, so the bar reads as a chain of lineages joined at
   * marked points rather than a line that changes colour for no reason.
   * Drawn before the junction's own bead, which stays the one carrying the
   * whole gradient and sits on top wherever the two coincide. */
  /* Every joint except one the junction bead is already standing on.
   *
   * The junction moves along the bar with the entry, so sooner or later it
   * passes a joint — and two beads a few pixels apart, one of them carrying
   * every colour and the other two of them, read as one dot that has been
   * drawn twice. That is the doubled mark on the merged connector. The
   * junction's bead is the larger of the two and carries the whole
   * gradient, so where they land together it is the one that stays. */
  /* The MIDDLE of the bar is not a seam anybody needs marked.
   *
   * It is where the two outermost lineages meet in the arithmetic, so on
   * an evenly spaced merge every hand-over lands on it at once and the bar
   * carries a dot in its centre for no reason a reader could name — and
   * two or three dots stacked on the same pixel, at that. The middle is
   * useful for exactly one thing, which is lining the entry up with it,
   * and that is a GUIDE: it is drawn while the entry is being carried with
   * Shift held, in the guide layer, and at no other time. */
  /* The grip on the bar goes in before the beads, which stay the last
     thing painted — they cover the seams — and take no pointer. */
  drawBarGrip(b.id, barPt(landings[0]), barPt(landings[n-1]), ux);
  joints.forEach(({at: jAt, pair, i})=>{
    const jp = barPt(jAt);
    const r = AMALGAM_JOINT_R;
    /* A seam is marked whether or not the colour changes across it.
     *
       0.9.17 skipped the ones where the two lineages meeting are the same
       colour, on the reasoning that a bead there marks nothing. It marks
       the JOIN — which lineage hands the bar over to which — and on a
       chart whose entries mostly share the default ink that reasoning took
       every bead off every bar and left the construction unreadable. The
       doubled dot was never this; it was the seam the junction bead is
       already standing on, and the clearance above is what deals with it. */
    const jointPaint = makeEdgeGradient(pair, [
      {x: jp.x - ux*r, y: jp.y - uy*r},
      {x: jp.x + ux*r, y: jp.y + uy*r}
    ]);
    beadGround(jp, r);
    el('circle', {class:'amalgam-bead amalgam-joint', cx:jp.x.toFixed(2), cy:jp.y.toFixed(2),
                  r, fill:jointPaint, 'data-from':'', 'data-to':b.id,
                  'data-pair': members[i].from + '\u0000' + members[i+1].from,
                  'data-via': viaOf(jAt).join('\u0000')}, edgeLayer);
  });

  /* A lineage that runs to the end of the bar joins it there, and the join
     is marked like every other hand-over on the bar — unless the junction's
     own bead is already standing on it. */
  departedEnds.forEach(({at, pair, from, to})=>{
    if(Math.hypot(at.x - dimple.x, at.y - dimple.y) < AMALGAM_BEAD_CLEAR) return;
    const r = AMALGAM_JOINT_R;
    const paint = makeEdgeGradient(pair, [{x: at.x - ux*r, y: at.y - uy*r}, {x: at.x + ux*r, y: at.y + uy*r}]);
    beadGround(at, r);
    el('circle', {class:'amalgam-bead amalgam-joint', cx:at.x.toFixed(2), cy:at.y.toFixed(2),
                  r, fill:paint, 'data-from':'', 'data-to':b.id, 'data-pair': from + '\u0000' + to}, edgeLayer);
  });

  drawJunctionGrip(b.id, dimple, ux);
  /* The merged arrow given an end of its own at the bar marks the joint
     itself, and a bead laid over it would hide it. */
  if(edgeStyleFor('', b.id).arrowIn) return;
  const beadR = AMALGAM_BEAD_R;
  const beadPaint = makeEdgeGradient(colors, [
    {x: dimple.x - ux*beadR, y: dimple.y - uy*beadR},
    {x: dimple.x + ux*beadR, y: dimple.y + uy*beadR}
  ]);
  beadGround(dimple, beadR);
  el('circle', {class:'amalgam-bead amalgam-junction', cx:dimple.x.toFixed(2), cy:dimple.y.toFixed(2),
                r:beadR, fill:beadPaint, 'data-from':'', 'data-to':b.id}, edgeLayer);
}
/* How much of a lineage's start its own end gives up: an arrowhead's or a
   T's worth, as on any connector (see redrawEdges), or nothing. */
function mergeMemberCutIn(style, port, fromId){
  if(!style.arrowIn) return 0;
  return endCutFor(style.teeIn, style.openIn, port, fromId);
}
/* A lineage's two ends: the one at its entry, which is an ordinary end,
   and the one at the bar — barEnd, an arrowhead, an open one or a T,
   pointing the way the line was going where it ends (see barEndOf). A T
   at the bar stands its gap off the bead, the way a T at an entry stands
   off the border. */
function drawMergeMemberEnds(e, style, pts, port, paint, tail){
  if(style.arrowIn && pts.length >= 2 && port){
    const tip = portTip(Object.assign({}, port, {x: pts[0].x, y: pts[0].y}));
    if(style.teeIn) drawTeeHead(arrowLayer, tip.x, tip.y, startAngleDeg(pts), paint, e.from, e.to,
                                teeBack(port, e.from));
    else drawArrowHead(arrowLayerFor(port.ring, port), tip.x, tip.y, startAngleDeg(pts), paint,
                       e.from, e.to, port.wavy ? e.from : null, port.ring || 0, style.openIn);
  }
  if(tail){
    if(style.barEnd === 'tout') drawTeeHead(arrowLayer, tail.x, tail.y, tail.ang, paint, e.from, e.to, 0);
    else drawArrowHead(arrowLayer, tail.x, tail.y, tail.ang, paint, e.from, e.to, null, 0, style.barEnd === 'oout');
  }
}
/* The merged arrow, in whatever look it has been given.
 *
 * It used to be drawn bare: a fixed weight, a fixed corner and nothing to
 * take hold of, so it was the one line on the chart that could not be
 * dashed, waved, given a note or lit when pointed at. It is a connector,
 * and it takes a connector's look from the style stored for it under an
 * empty source (see isMergedArrow) — the pattern, the wave, the corners,
 * and the route: square with turns by default, as the owner asked, or
 * straight or curved where somebody chose that for it. Only its paint is
 * not its own: it carries every lineage's colour, which is what it means. */
/* Where the merged arrow's two ends are, by the entry it feeds — what a
   bend dragged on it is laid between (see beginBendDrag), since it is no
   connector of structEdges for resolvePorts to answer for. */
const mergedArrowPorts = new Map();
function drawMergedArrow(b, stem, colors, ring, side){
  const os = edgeStyleFor('', b.id);
  /* It may be bent by hand like any connector (the owner's list of 24.10):
     its corners are the route, from the bar — leaving it away from the
     lineages, square, as the stem does — to the port the stem chose. A
     route the corners cannot make is drawn without them, as anywhere.
   *
     …and, like any connector, a route pinned by hand is pinned at both
     ends: it leaves the bar and arrives at the entry by the sides it had
     when its corners were set (bendSides; see resolvePorts). Asked of the
     stem instead, the sides turned over the moment the entry was carried
     across the bar, the corners could no longer be reached from either
     end, and the line fell back to the stem — its bends seemingly gone,
     arriving at a face nobody had chosen. */
  /* …but only while the entry is on the side of the bar they were set
     on. Carried across, its face towards the bar is the other one, and
     the arrow goes to that face like an unbent one (the owner's list of
     28.10: perpendicular across the bar is the opposite port, along it no
     change). Pinned to the old faces it wandered from side to side as it
     went, wherever the corners could still be reached from, or looped
     back through corners left behind on the other side. The corners are
     kept, unused, and taken up again on the side they were set on. */
  const set = os.routing !== 'straight' && os.bends && os.bends.length && os.bendSides ? os.bendSides : null;
  /* Its end carried onto another port of the entry (drawEndGrips) is a
     side set by hand, as on any connector, and outranks the face the
     stem would choose. It used to give way to the faces its corners were
     pinned to, so on a bent arrow the drag was taken and nothing moved
     (the owner's list of 31.10); a drag now writes the new face into the
     pin as well (movePortTo), and a pin that disagrees with the face set
     by hand is one from before that, which the corners give way to. */
  const handSide = SIDES.includes(os.toSide) ? os.toSide : null;
  const pinned = set && set[1] === (handSide || stem.port.side) ? set : null;
  /* Bent, it arrives at the middle of its side, as any connector does: the
     stem's own port stands in front of the foot, and with the foot under
     the first corner that put the head wherever the corner was — a stretch
     dragged across the entry pulled the head along the border after it,
     and the drag was refused as a shape it had not asked for. */
  const hasBends = os.routing !== 'straight' && os.bends && os.bends.length && !(set && !pinned);
  let head = hasBends ? portOnSide(b, pinned ? pinned[1] : (handSide || stem.port.side), 0, 1, ring)
    : handSide && handSide !== stem.port.side ? portOnSide(b, handSide, 0, 1, ring) : stem.port;
  /* `slides`: the one end of any connector that is not a fixed point. It
     stands on the bar, and a bend drag that moves the stretch out of it
     carries it along the bar instead of stepping off it (see shiftArm). */
  const start = {x: stem.pts[0].x, y: stem.pts[0].y, side: pinned ? pinned[0] : (OPPOSITE_SIDE[side] || side), ring: 0,
                 stub: AMALGAM_APPROACH, slides: true};
  let route = os.routing === 'straight' ? [stem.pts[0], head === stem.port ? stem.pts[stem.pts.length - 1] : head] : stem.pts;
  if(hasBends || (head !== stem.port && os.routing !== 'straight')){
    const bent = pathFromPorts(start, head, os, new Set([b.id]), 0);
    if(!bent.ignored && bent.pts.length >= 2) route = bent.pts;
    else head = stem.port;
  }
  /* The route may land a little along the side from the head's port, to
     run straight rather than step (flattenFacingStep); the head goes
     where the line arrives. */
  if(route !== stem.pts && route.length >= 2 && SIDES.includes(head.side)){
    const last = route[route.length - 1], key = sideIsVertical(head.side) ? 'x' : 'y';
    if(Math.abs(last[key] - head[key]) > 0.01) head = Object.assign({}, head, {[key]: last[key]});
  }
  mergedArrowPorts.set(b.id, {p1: start, p2: head});
  /* Every lineage's colour unless it has been given its own: a colour or a
     gradient set on it, as on any connector (the owner's ask, 23.10). */
  const paint = os.gradient ? makeEdgeGradient(os.gradient, route)
    : (os.colorFixed && os.color) ? os.color
    : makeEdgeGradient(colors, route);
  const ink = os.gradient ? os.gradient[0] : (os.colorFixed && os.color) ? os.color : colors[0];
  /* Its ends are its own too: an arrowhead into the entry by default, a T,
     or nothing; and at the bar, where it starts, an arrowhead or a T
     pointing back at the bar, or nothing as it always was. */
  const headOut = os.arrow !== false, teeOut = headOut && os.teeOut;
  const cutOut = !headOut ? 0 : teeOut ? TEE_CUT + teeBack(head, b.id) : os.openOut ? OPEN_CUT : ARROW_TRIM;
  const cutIn = !os.arrowIn ? 0 : os.teeIn ? TEE_CUT : os.openIn ? OPEN_CUT : ARROW_TRIM;
  let d, from;
  if(os.sinusoid){
    d = wavyPath(route, cutIn, cutOut, false, edgeCornerR(os));
    from = route[route.length - 2];
  } else if(os.routing === 'curve' && route.length > 2){
    const cut = cutAlong(curveThrough(route, CURVE_STEP, {start: cutIn > 0, end: cutOut > 0}), cutIn, cutOut);
    d = polylinePath(cut);
    from = cut[cut.length - 2] || route[route.length - 2];
  } else {
    from = route[route.length - 2];
    const tip = arrowTrimmed(from, {x: head.x, y: head.y}, cutOut);
    const start = cutIn ? arrowTrimmed(route[1], route[0], cutIn) : route[0];
    const shaft = [start].concat(route.slice(1, -1)).concat([tip]);
    d = shaft.length > 2 ? roundedPath(shaft, edgeCornerR(os))
      : `M${shaft[0].x.toFixed(2)},${shaft[0].y.toFixed(2)} L${tip.x.toFixed(2)},${tip.y.toFixed(2)}`;
  }
  const dash = DASH_PATTERNS[os.dash];
  const attrs = {class:'edge struct amalgam-out', d, stroke: paint, 'data-from':'', 'data-to':b.id};
  if(dash){
    attrs['stroke-dasharray'] = dash;
    if(cutIn) attrs['stroke-dashoffset'] = cutIn.toFixed(2);
  }
  edgePath(attrs, os, edgeLayer);
  drawRingCap(head, paint, dash, '', b.id, isDoubleDash(os), d);
  if(teeOut){
    const tip = portTip(head);
    drawTeeHead(arrowLayer, tip.x, tip.y, Math.atan2(head.y - from.y, head.x - from.x) * 180/Math.PI,
                paint, '', b.id, teeBack(head, b.id));
  } else if(headOut) drawAmalgamArrow(head, from.x, from.y, ring, paint, b.id, os.openOut);
  if(os.arrowIn){
    const at = route[0];
    if(os.teeIn) drawTeeHead(arrowLayer, at.x, at.y, startAngleDeg(route), paint, '', b.id, 0);
    else drawArrowHead(arrowLayer, at.x, at.y, startAngleDeg(route), paint, '', b.id, null, 0, os.openIn);
  }
  drawEdgeNote(os.note, route, os.notePos, '', b.id, os.noteAt, ink, os.noteBg);
  drawCalloutLeaders('', b.id, route, ink);
  edgeHit(d, '', b.id);
}
/* A disc of paper under a bead, the bead's own size.
 *
 * A bead is drawn ON the bar, and a bead stepped back with the rest of an
 * unrelated merge is drawn at a twentieth of its ink — so the bar and the
 * merged arrow underneath showed straight through it, and a dot read as a
 * ring with lines crossing it. The ground is never dimmed: whatever the
 * bead is doing, nothing beneath it is seen through it. */
function beadGround(at, r){
  el('circle', {class:'amalgam-bead-ground', cx:at.x.toFixed(2), cy:at.y.toFixed(2), r}, edgeLayer);
}
redrawEdges();


/* ---------------------------------------------------------------------
   The places on a merge's bar.

   Held Shift while carrying an amalgam or one of its parents shows where
   on the bar the thing in the hand can go, the way it does along a
   connector: the middle of the bar, drawn so it cannot be mistaken, and
   the places halfway between the lineages already on it. The amalgam can
   also stand under any lineage. Every parent added to the merge adds its
   own places.
   ------------------------------------------------------------------ */
function amalgamsFedBy(id){
  const out = [];
  nodes.forEach(b=>{
    if(!isMergeNode(b) || !mergeMembersOf(b).includes(id)) return;
    if(amalgamBars.get(b.id)) out.push(b);
  });
  return out;
}
/* The places are the bar divided evenly, from its middle outward.
 *
 * A merge of n lineages has n even slots across its bar — the positions
 * the lineages would stand at if they were spaced out evenly — and they
 * are laid out symmetrically about the middle, so the division is the
 * same on both sides. With an odd number of lineages one slot IS the
 * middle; with an even number the middle falls between two, and is
 * offered as a place of its own. The amalgam, which stands under the bar
 * rather than on it, is also offered each lineage where it actually lands.
 *
 * `span` fixes the ends the division is made between; a parent carried
 * along its bar measures from where the bar was when it was picked up,
 * since the bar grows and shrinks under it as it goes. */
function barPlacesFor(barRec, _carried, withLandings, span){
  const all = (barRec.landings || []).map(l=> l.at).sort((a, b)=> a - b);
  const n = all.length;
  if(n < 2) return [];
  const lo = span ? span.lo : all[0], hi = span ? span.hi : all[n - 1];
  const mid = (lo + hi) / 2, step = (hi - lo) / (n - 1);
  const places = [];
  const put = (at, kind)=>{
    const same = places.find(p=> Math.abs(p.at - at) < 1);
    if(same){ if(kind === 'mid') same.kind = 'mid'; return; }
    places.push({at, kind});
  };
  put(mid, 'mid');
  for(let i = 0; i < n; i++){
    const off = (i - (n - 1) / 2) * step;
    put(mid + off, Math.abs(off) < 1e-6 ? 'mid' : 'slot');
  }
  if(withLandings) all.forEach(at=> put(at, 'lineage'));
  // `_carried` names the parent in the hand. It is not left out: every
  // slot, its own included, is somewhere it may be put.
  return places.sort((a, b)=> a.at - b.at);
}
/* What a single carried entry can line up with on a bar, if anything:
   the bar, the places on it, and which point of the entry is being placed
   — its middle for the amalgam, its port for a parent. */
function barTargetsFor(st){
  if(!st || !st.members || st.members.length !== 1) return [];
  const m = st.members[0], n = m.node;
  if(!n) return [];
  const out = [];
  const own = amalgamBars.get(m.id);
  if(own && isMergeNode(n)){
    out.push({bar: own, places: barPlacesFor(own, null, true), portOff: 0});
  }
  amalgamsFedBy(m.id).forEach(b=>{
    const bar = amalgamBars.get(b.id);
    const mine = (bar.landings || []).find(l=> l.from === m.id);
    if(!mine) return;
    const leash = st.barLeash && st.barLeash.find(l=> l.amalgam === b.id);
    out.push({bar, places: barPlacesFor(bar, m.id, false, leash ? leash.span : null),
              portOff: leash ? leash.portOff : 0});
  });
  return out;
}
/* The parent's leash along its bar, taken when the drag starts.
 *
 * A parent carried along the bar stays between the lineages either side of
 * it: past a neighbour the lineages would cross and the colours the bar is
 * divided into would change hands. The two at the ends are free outward —
 * they are what sets the bar's length. Two
 * parents that really are meant to change places are swapped with the
 * button that appears when both are selected (see the swap below). The
 * junction the merged arrow leaves from is not a neighbour; a lineage may
 * pass over it. */
function barLeashFor(id, originCentre){
  const out = [];
  amalgamsFedBy(id).forEach(b=>{
    const bar = amalgamBars.get(b.id);
    const list = (bar.landings || []).slice().sort((a, c)=> a.at - c.at);
    const i = list.findIndex(l=> l.from === id);
    if(i < 0) return;
    const centre = bar.axis === 'x' ? originCentre.x : originCentre.y;
    /* The lineages at the two ends are what the bar's length IS, so they
       may go outward as far as they like; only a neighbour stops a
       lineage, and only at the least room two landings need. */
    const lo = i > 0 ? list[i-1].at + AMALGAM_PITCH : -Infinity;
    const hi = i < list.length - 1 ? list[i+1].at - AMALGAM_PITCH : Infinity;
    out.push({amalgam: b.id, axis: bar.axis, portOff: list[i].port - centre,
              span: {lo: bar.lo, hi: bar.hi},
              lo: Math.min(lo, list[i].at), hi: Math.max(hi, list[i].at)});
  });
  return out;
}
function applyBarLeash(st, offX, offY){
  if(!st || !st.barLeash || !st.barLeash.length || st.members.length !== 1) return null;
  const m = st.members[0], n = m.node;
  let x = offX, y = offY, held = false;
  st.barLeash.forEach(l=>{
    const along = l.axis === 'x';
    const centre = along ? m.originX + x + n.w/2 : m.originY + y + n.h/2;
    const port = centre + l.portOff;
    const kept = Math.max(l.lo, Math.min(l.hi, port));
    if(Math.abs(kept - port) < 1e-6) return;
    held = true;
    if(along) x += kept - port; else y += kept - port;
  });
  return held ? {x, y} : null;
}
/* Two parents swap places.
 *
 * Offered only when exactly two entries are selected and each of them
 * feeds a merge — the same merge or two different ones. Each takes the
 * other's MIDDLE, so two boxes of different sizes still trade the places
 * their lineages came down from. */
function swappableParents(){
  if(readOnlyView || multiSelection.size !== 2) return null;
  const ids = [...multiSelection];
  if(!ids.every(id=> nodes.has(id) && amalgamsFedBy(id).length)) return null;
  return ids;
}
function swapParents(ids){
  if(!ids || ids.length !== 2) return;
  const [a, b] = ids.map(id=> nodes.get(id));
  if(!a || !b) return;
  const ca = {x: a.x + a.w/2, y: a.y + a.h/2}, cb = {x: b.x + b.w/2, y: b.y + b.h/2};
  applyEdit(()=>{
    [[a, cb], [b, ca]].forEach(([n, c])=>{
      const found = workingEntry(n.id);
      if(!found) return;
      const opts = entryOpts(found.entry);
      const x = c.x - n.w/2, y = c.y - n.h/2;
      opts.pos = [+(x + (n.growShiftX || 0)).toFixed(2), +(y + (n.growShift || 0)).toFixed(2)];
      putEntry(found.index, found.entry, opts);
    });
  });
  setSelection(ids, ids[0]);
}
const swapParentsBtn = (()=>{
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swap-parents-btn';
  b.title = 'Swap these two lineages on their bar';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.6 2.6 7.9 8.3l5.7 5.7V10.6c3.4.2 5.9 2 7.4 5.2.3-4.8-2.6-8.7-7.4-9.1z"/><path d="M10.4 21.4l5.7-5.7-5.7-5.7v3.4c-3.4-.2-5.9-2-7.4-5.2-.3 4.8 2.6 8.7 7.4 9.1z"/></svg>';
  b.hidden = true;
  b.addEventListener('mousedown', ev=> ev.stopPropagation());
  b.addEventListener('click', ev=>{
    ev.stopPropagation();
    const ids = swappableParents();
    if(ids) swapParents(ids);
  });
  const host = document.querySelector('.app > .main');
  if(host) host.appendChild(b);
  return b;
})();
function positionSwapButton(){
  const ids = swappableParents();
  if(!ids || (typeof nodeDragState !== 'undefined' && nodeDragState && nodeDragState.moved)){
    swapParentsBtn.hidden = true;
    return;
  }
  const [a, b] = ids.map(id=> nodes.get(id));
  const host = document.querySelector('.app > .main').getBoundingClientRect();
  const sr = svg.getBoundingClientRect();
  const top = Math.min(a.y, b.y);
  const cx = ((a.x + a.w/2) + (b.x + b.w/2)) / 2;
  swapParentsBtn.hidden = false;
  swapParentsBtn.style.left = (sr.left - host.left + cx * vs + vx) + 'px';
  swapParentsBtn.style.top = (sr.top - host.top + top * vs + vy - 34) + 'px';
}


/* ---------------------------------------------------------------------
   Taking hold of a merge's bar.

   The bar is the lineages' — it hangs a lead beyond them and travels with
   them — and the entry it feeds has no say in where it goes. So it has to
   be possible to put it somewhere by hand, and the owner's gesture for
   that is a click anywhere on it: the bar is picked out, and carried
   along the merged arrow's axis, nearer the lineages or further from
   them. Nothing else moves but the lineages' drops and the arrow.

   A double click on one stretch of the bar (a long press, on glass) is
   what a click on the lineage itself does everywhere else: that lineage's
   panel, to style that stretch.
   ------------------------------------------------------------------ */
function drawBarGrip(id, a, z, ux){
  if(Math.hypot(z.x - a.x, z.y - a.y) < 1) return;
  const d = `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${z.x.toFixed(2)},${z.y.toFixed(2)}`;
  if(amalgamBarFocus === id) paintBarFocus(id);
  const hit = el('path', {class:'amalgam-bar-hit' + (ux ? ' across-y' : ' across-x'), d,
                          'data-amalgam': id}, edgeLayer);
  hit.addEventListener('mousedown', ev=>{
    /* Whether the lineage under the press is the one already picked is
       asked HERE, at the first press: the click that follows lets its
       panel go, as a click anywhere does, so by the double click there is
       nothing left to ask. */
    const s = barStretchAt(id, ev.clientX, ev.clientY);
    if(s && edgeIsPicked(s.from, id)) barPressedPicked = {id, from: s.from, at: performance.now()};
    beginBarDrag(ev, id);
  });
  hit.addEventListener('click', ev=>{
    ev.stopPropagation();
    if(amalgamBarDrag && amalgamBarDrag.swallow) return;
    /* A held tap on glass arrives as a click with a key down (see
       touchModsFor), and a held tap is the phone's double click here. */
    if(ev.shiftKey || ev.ctrlKey || ev.metaKey){ openBarStretch(id, ev); return; }
    setBarFocus(id);
  });
  hit.addEventListener('dblclick', ev=>{
    ev.stopPropagation();
    ev.preventDefault();
    /* On a lineage that is already picked, a double click on its stretch
       of the bar is what it is on the rest of that line: its note. The
       stretch is that lineage's as much as the line coming down is, and a
       double click that meant "note" on one half and "panel" on the other
       half of a line already lit as one was a line of two minds. */
    const s = barStretchAt(id, ev.clientX, ev.clientY);
    const was = barPressedPicked;
    barPressedPicked = null;
    if(s && !readOnlyView && was && was.id === id && was.from === s.from
       && performance.now() - was.at < 1000){
      setBarFocus(null);
      startEdgeNote(s.from, id, ev);
      return;
    }
    openBarStretch(id, ev);
  });
}
/* The junction is taken hold of like a callout's point (the owner's list
   of 24.10, evening): carried along the bar, and the entry and its arrow
   go with it. It is the entry that moves — the junction stands in front
   of it by construction — so this is a carry of the entry held to the
   bar's own axis (see `alongBar` in beginNodeDrag's mousemove), and an
   arrow bent by hand has its corners carried the same way, since its
   first corner is what the foot stands under. The beads take no pointer,
   so this lies over them; without it a press there took the bar. */
function drawJunctionGrip(id, at, ux){
  if(readOnlyView) return;
  const hit = el('circle', {class:'amalgam-junction-hit ' + (ux ? 'along-x' : 'along-y'),
                            cx: at.x.toFixed(2), cy: at.y.toFixed(2), r: 7, 'data-amalgam': id}, edgeLayer);
  hit.addEventListener('mousedown', ev=>{
    const n = nodes.get(id), g = qNode(`.node[data-id="${CSS.escape(id)}"]`);
    if(!n || !g) return;
    beginNodeDrag(ev, n, g);
    const st = nodeDragState;
    if(!st || st.node !== n) return;
    ev.stopPropagation();
    st.alongBar = ux ? 'x' : 'y';
    const out = EDGE_STYLES.find(o=> o.from === '' && o.to === id);
    if(out && Array.isArray(out.bends) && out.bends.length && !st.bendCarry.some(c=> c.style === out))
      st.bendCarry.push({style: out, bends: out.bends.map(q=> [q[0], q[1]])});
  });
  hit.addEventListener('click', ev=>{ ev.stopPropagation(); setBarFocus(id); });
}
var barPressedPicked = null;
// Which lineage's stretch of the bar a point on the screen is on.
function barStretchAt(id, clientX, clientY){
  const rec = amalgamBars.get(id);
  if(!rec || !rec.stretches || !rec.stretches.length) return null;
  const p = clientToWorld(clientX, clientY);
  const at = rec.axis === 'x' ? p.x : p.y;
  let best = null, bestD = Infinity;
  rec.stretches.forEach(s=>{
    const d = at < s.lo ? s.lo - at : at > s.hi ? at - s.hi : 0;
    if(d < bestD){ bestD = d; best = s; }
  });
  return best;
}
function openBarStretch(id, ev){
  const s = barStretchAt(id, ev.clientX, ev.clientY);
  if(!s || readOnlyView) return;
  setBarFocus(null);
  openEdgeStylePopover(s.from, id, ev);
}
function setBarFocus(id){
  const next = (id && !readOnlyView) ? id : null;
  if(next === amalgamBarFocus) return;
  amalgamBarFocus = next;
  edgeLayer.querySelectorAll('.amalgam-bar-focus').forEach(p=> p.remove());
  if(!next) return;
  paintBarFocus(next);
}
/* A picked bar is lit the way a picked connector is — the same glow
   (.edge-picked), round the bar and nothing else. It used to wear a halo
   of its own, a wide band of accent under the line, which read as some
   other kind of picked from every line beside it.

   The glow cannot go on the lineages' own paths: each one is the line
   coming down AND its stretch of the bar, so lighting it lit the whole
   lineage. Each stretch is traced again under the chart in paper, the
   lineage's own weight, and the glow is that tracing's shadow: the paper
   is lost against the page, the stretch drawn over it hides the rest,
   and what shows is the glow — along waves and through dashes as the
   stretch itself goes. */
function paintBarFocus(id){
  const rec = amalgamBars.get(id);
  (rec && rec.pieces || []).forEach(p=>{
    const sel = `.edge.amalgam-member[data-from="${CSS.escape(p.from)}"][data-to="${CSS.escape(id)}"]:not(.dbl-inner)`;
    const line = edgeLayer.querySelector(sel);
    const w = line ? getComputedStyle(line).strokeWidth : '';
    const glow = el('path', {class:'amalgam-bar-focus', d: p.d, 'data-amalgam': id}, edgeLayer);
    if(w) glow.style.strokeWidth = w;
    edgeLayer.insertBefore(glow, edgeLayer.firstChild);
  });
}
/* The place a bar stands, fixed: what it is told to keep from now on. A
   bar no drag has touched is worked out afresh from where the entry is,
   which is how it came to give way to the entry and flip across the
   lineages with it — so the first time anything belonging to a merge is
   picked up, its bar is written down where it stands and stays there. */
function barSpecFor(id){
  const b = nodes.get(id);
  if(b && b.bar) return Object.assign({}, b.bar);
  const rec = amalgamBars.get(id);
  return rec && rec.rest ? Object.assign({}, rec.rest) : null;
}
function writeBarSpec(id, spec){
  const found = workingEntry(id);
  if(!found) return;
  const opts = entryOpts(found.entry);
  if(spec) opts.bar = {k: spec.k, after: !!spec.after, lead: +(+spec.lead).toFixed(2)};
  else delete opts.bar;
  putEntry(found.index, found.entry, opts);
}
/* Every merge a carried set touches — its amalgam or any of its lineages
   — has its bar fixed in the working data, inside the same step of undo
   as the move. Answers what was fixed, so a drag that comes back to where
   it started can take it out again. */
function fixAmalgamBars(ids){
  const carried = new Set(ids);
  const fixed = [];
  nodes.forEach(b=>{
    if(!isMergeNode(b) || b.bar) return;
    if(!carried.has(b.id) && !mergeMembersOf(b).some(p=> carried.has(p))) return;
    const spec = barSpecFor(b.id);
    if(!spec) return;
    b.bar = spec;
    writeBarSpec(b.id, spec);
    fixed.push(b.id);
  });
  return fixed;
}
function unfixAmalgamBars(list){
  (list || []).forEach(id=>{
    const b = nodes.get(id);
    if(b) b.bar = null;
    writeBarSpec(id, null);
  });
}
function beginBarDrag(ev, id){
  if(ev.button !== 0 || readOnlyView) return;
  ev.stopPropagation();
  ev.preventDefault();
  closeStyleBar();
  const spec = barSpecFor(id);
  if(!spec) return;
  const b = nodes.get(id);
  const rec = amalgamBars.get(id);
  amalgamBarDrag = {id, spec, had: !!(b && b.bar), x0: ev.clientX, y0: ev.clientY,
                    grab: clientToWorld(ev.clientX, ev.clientY),
                    moved: false, before: null, lead: spec.lead,
                    cross0: rec ? rec.cross : null};
}
/* The levels a bar being carried can be lined up with, and the line that
 * says so.
 *
   Every other thing the hand carries — an entry, a corner — shows a guide
   when it comes level with something, and the bar was the one that showed
   nothing: it could only be put on the grid, and lining it up with the
   bottom of a row of entries or with the run of another merge's bar was a
   matter of squinting. It is offered the same three places an entry offers
   on the bar's own level — near edge, middle, far edge of every entry — and
   the level of every connector run and every other bar lying the same way.
   The bar's lineages and its own merged arrow are left out: they move with
   it. The level is a straight function of `lead` (the bar stands `lead`
   beyond its lineages), so a level found is turned back into a lead. */
function barGuide(st, lead){
  clearGuides();
  const rec = amalgamBars.get(st.id);
  if(!rec || typeof st.cross0 !== 'number') return null;
  const k = st.spec.k, sgn = st.spec.after ? 1 : -1;
  const at = st.cross0 + (lead - st.spec.lead) * sgn;
  const tol = GUIDE_SNAP_PX / (vs || 1);
  const len = k === 'x' ? 'w' : 'h', o = k === 'x' ? 'y' : 'x', olen = k === 'x' ? 'h' : 'w';
  let best = null;
  const offer = (v, lo, hi)=>{
    const d = v - at;
    if(Math.abs(d) > tol || (best && Math.abs(best.d) <= Math.abs(d))) return;
    const next = st.spec.lead + (v - st.cross0) * sgn;
    if(next < AMALGAM_LEAD_MIN) return;
    best = {d, v, lo, hi, lead: next};
  };
  nodes.forEach(n=>{
    if(n.id === st.id || nodeHidden(n)) return;
    [n[k], n[k] + n[len] / 2, n[k] + n[len]].forEach(v=> offer(v, n[o], n[o] + n[olen]));
  });
  amalgamBars.forEach((r, id)=>{
    if(id !== st.id && r.axis === rec.axis) offer(r.cross, r.lo, r.hi);
  });
  drawnRoutes.forEach(r=>{
    if(!r || !r.pts || r.to === st.id || r.from === st.id) return;
    routeRuns(r.pts).forEach(run=>{ if(run.axis === k) offer(run.v, run.lo, run.hi); });
  });
  if(!best) return null;
  const lo = Math.min(rec.lo, best.lo), hi = Math.max(rec.hi, best.hi);
  const flat = k === 'y';
  el('line', {class:'align-guide align-guide-line',
              x1: flat ? (lo - GUIDE_OVERHANG).toFixed(2) : best.v.toFixed(2),
              x2: flat ? (hi + GUIDE_OVERHANG).toFixed(2) : best.v.toFixed(2),
              y1: flat ? best.v.toFixed(2) : (lo - GUIDE_OVERHANG).toFixed(2),
              y2: flat ? best.v.toFixed(2) : (hi + GUIDE_OVERHANG).toFixed(2)}, guideLayer);
  return best;
}
let barDragFrame = 0;
window.addEventListener('mousemove', ev=>{
  const st = amalgamBarDrag;
  if(!st || st.swallow) return;
  const dx = ev.clientX - st.x0, dy = ev.clientY - st.y0;
  if(!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  if(!st.moved){
    st.moved = true;
    st.before = takeSnapshot();
    setBarFocus(st.id);
    document.body.classList.add('bar-carrying');
  }
  // Along the merged arrow's axis only: the bar is laid across `k`.
  // On the chart, not the screen — see the wheel in 18-canvas-gestures.
  const hand = clientToWorld(ev.clientX, ev.clientY);
  const along = st.spec.k === 'y' ? hand.y - st.grab.y : hand.x - st.grab.x;
  const step = dragIsFree(ev) ? Math.round(along) : snapToGrid(along);
  st.lead = Math.max(AMALGAM_LEAD_MIN, st.spec.lead + (st.spec.after ? step : -step));
  /* Asked for with Shift, as an entry's and a corner's are (see the
     entry drag in 18-canvas-gestures): offered unasked, they took the bar
     a few units off where the hand put it whenever anything was near. */
  if(dragIsFree(ev) || !ev.shiftKey) clearGuides();
  else {
    /* Measured from where the hand is, not from the grid step it was
       rounded to: a level a few units off the grid could otherwise never
       be reached. */
    const raw = Math.max(AMALGAM_LEAD_MIN, st.spec.lead + (st.spec.after ? along : -along));
    const g = barGuide(st, raw);
    if(g) st.lead = g.lead;
  }
  const b = nodes.get(st.id);
  if(b) b.bar = Object.assign({}, st.spec, {lead: st.lead});
  if(barDragFrame) return;
  barDragFrame = requestAnimationFrame(()=>{
    barDragFrame = 0;
    redrawEdges();
    applyVisibility();
    if(selectedId && nodes.has(selectedId)) paintSelectionHighlight(selectedId);
    paintMultiSelection();
  });
});
window.addEventListener('mouseup', ()=>{
  const st = amalgamBarDrag;
  if(!st || st.swallow) return;
  if(barDragFrame){ cancelAnimationFrame(barDragFrame); barDragFrame = 0; }
  document.body.classList.remove('bar-carrying');
  clearGuides();
  if(!st.moved){ amalgamBarDrag = null; return; }
  // The click the browser sends after a carry is not a click on the bar.
  st.swallow = true;
  setTimeout(()=>{ if(amalgamBarDrag === st) amalgamBarDrag = null; }, 0);
  const b = nodes.get(st.id);
  if(Math.abs(st.lead - st.spec.lead) < 1e-6){
    if(b) b.bar = st.had ? st.spec : null;
    redrawEdges();
    return;
  }
  applyEdit(()=> writeBarSpec(st.id, Object.assign({}, st.spec, {lead: st.lead})), st.before);
  setBarFocus(st.id);
});
/* A press anywhere else lets the bar go, as it lets anything picked go;
   so does Escape. */
svg.addEventListener('mousedown', ()=> setBarFocus(null));
document.addEventListener('keydown', ev=>{ if(ev.key === 'Escape') setBarFocus(null); });
