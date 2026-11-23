# What has been measured

Moved out of CLAUDE.md in 0.27.1, which is read whole at the start of every
working session and had become half measurements. These are the numbers
behind the rules there, each with the bench in `tools/` that re-runs it, so
it can be re-run rather than believed. A claim here that turns out wrong is
corrected here, with the new measurement.

## The first measurements

Chromium at 1500×950, a synthetic chain of tagged entries:

| | |
| --- | --- |
| boot to first draw | 656 ms |
| `renderNodes` at 50 / 200 / 600 entries | 113 / 244 / 633 ms |
| `rebuildChart` at 50 / 200 / 600 | 78 / 312 / **931 ms** |
| `buildModel` at 600 | 4.1 ms — 0.4% of a rebuild |
| storage migrations at 417 | 0.027 ms |
| built page | 2.46 MB, 1.35 MB gzipped |
| `src/data.js` | 1.30 MB, of which ~1.26 MB is two base64 blobs |

- **Weight is media, not code.** Cutting program out of the page saves
  kilobytes against a megabyte of embedded pictures. That is why media now
  lives beside the page (see above); the figures in this table were taken
  before the first Save moved it. With the pictures gone the page was
  1.72 MB, 549 KB gzipped, nearly all of it program — which is why the
  site now keeps the program in a file of its own.

## What a frame of panning costs

`tools/bench-pan.js` pans a synthetic chain one frame at a time with
Chromium's frame cap off. Medians:

| entries | coordinates laid out with the page (before) | as built | + off-screen culled |
| ---: | ---: | ---: | ---: |
| 50 | 6.8 ms | 2.8 ms | 2.7 ms |
| 200 | 20.9 ms | 2.4 ms | 2.0 ms |
| 600 | 67.1 ms | 3.5 ms | 3.0 ms |

A pan is one transform, and nearly free. What each frame paid for was the
coordinates text in the corner: rewriting it laid out the page, and the
SVG drawing with it — every element, on screen or not. Hiding the whole
drawing did not help; leaving out that one line did. The box is now sized
from its text's length and contained (`showCoord`). Anything else that
writes text or sizes on every frame of a gesture will do the same.

- **Culling off-screen entries is not worth building.** The bench's last
  column does it (display:none past 300px off screen) and saves half a
  millisecond at 600 entries.

## What `rebuildChart` was actually spending its time on

This file used to say the ceiling was `renderNodes` being long, and that
incremental rendering was the one optimisation worth doing. Measurement said
otherwise, and `tools/bench.js` is the measurement, so it can be re-run
rather than believed. A synthetic chain, this machine, median of five:

| entries | rebuild before | of that, `measureTextBlock` | rebuild after |
| ---: | ---: | --- | ---: |
| 50 | 53.6 ms | 100 calls, 33.7 ms — **63%** | **19.1 ms** |
| 200 | 196.2 ms | 400 calls, 115 ms — **59%** | **64.7 ms** |
| 600 | 772.1 ms | 1200 calls, 420 ms — **54%** | **288.2 ms** |

Over half of a rebuild was measuring text, at exactly two calls per entry —
`renderNodes` sizes the box from every text an entry can show, then measures
the active one AGAIN to centre it, with the same `maxChars` and the same
`fit`, both computed above and unchanged in between. Half of every render's
measurements were answers it had already worked out during that same render.

Remembering them (see `blockCache` in `05-render-text.js`) takes measurement
from 54–63% of a rebuild to 1–2%, and the whole rebuild to about a third of
what it was. Even with the cache cold, half the calls are served, because the
duplicate pair lands in the same render: a cold 600-entry rebuild is 651 ms.

Two things follow:

- **Incremental rendering is no longer the obvious next move.** What made
  rebuilds expensive was not that `renderNodes` is long; it was a forced
  synchronous layout per entry, taken while the SVG was being appended to.
  Whatever is proposed next should come with a measurement like the one
  above, not with an argument about the shape of the function.

## Where a rebuild goes now, and what is NOT worth optimising

Same synthetic chain, 600 entries, 277 ms a rebuild:

| | | |
| --- | ---: | ---: |
| `redrawEdges` | 168.9 ms | 61% |
| …of which `routeEdge` | 152.2 ms | 55% |
| `renderNodes` | 96.9 ms | 35% |
| `applyVisibility` | 5.5 ms | 2% |
| `buildModel` | 4.1 ms | 1% |
| `edgeStyleFor`, 1198 calls | 0.8 ms | 0% |
| `latticeRoute` | never called | — |

Three things that look worth doing and are not, so they need not be argued
again:

- **`edgeStyleFor`'s linear `find` and its fresh object per call.** 1198
  calls come to 0.8 ms. A Map would be tidier and would save nothing.
- **The A\* lattice's obstacle fill.** It is `pointInsideAny` over every
  cell for every edge, which is genuinely quadratic — and `latticeRoute` is
  not called at all on an ordinary chart, because the stock orthogonal
  shapes solve it. Optimising it needs a chart that actually reaches it.
- **`applyVisibility` running as a second pass over freshly drawn DOM.** It
  is redundant in principle — `renderNodes` already knows what is hidden —
  and it is 2%.

**The ceiling was `routeEdge`, quadratic twice over.** `scorePath`
(`07-router-ortho.js`) walked every obstacle and every already-routed segment
for each candidate path, and `routedSegments` grows as the chart is drawn.
The routed half now has its index: segments are filed by orientation and by
the line they stand on (`routedNear`), because only collinear segments within
`OVERLAP_TOL` can be charged and the charge is a sum, so the score — and
every route — is identical. The suite draws a 200-entry chart both ways and
compares every route ("the router asks only the lines a segment can share").
A full `redrawEdges` at 600 entries went from 566 ms to 233 ms, at 200 from
77 to 45.

The obstacle half has its index too (`obstaclesNear`, `06-edge-geometry.js`):
a leg is level or upright, so only boxes standing across its one coordinate
can be crossed, and boxes are filed by band of x and of y, sorted along the
other axis. And a band of routed segments turned out to hold most of a
column's connectors, so it is cut along its length into chunks too. Both
keep the score identical ("the router asks only the boxes a leg can
cross"). Moving one entry on a 600-entry chain, `tools/bench-edit.js`:

| | before | after |
| --- | ---: | ---: |
| the move | 440 ms | 120 ms |
| of which `routeEdge` | 333 ms | 20 ms |

- **A two-phase render — measure everything, then build the DOM — was the
  other half of this and is not worth doing.** Its whole gain was collapsing
  those forced layouts into one, and measurement is now 1–2% of a rebuild.
  It would be invasive surgery on 1123 lines for something already spent.

## What is left of an edit is the browser laying out the new drawing

Measured October 23 on the same chain: of ~100 ms an edit costs at 600
entries, ~55 ms was style and layout of the SVG every redraw built afresh,
nearly all of it the entries' TEXT. A profile files it under
`buildSideTabs`, whose own work is 3 ms: it reads `scrollTop`, and that is
where the browser lays out what `renderNodes` just built. Moving the read
does not help — the layout happens before the next paint wherever it is
asked for. Two things took it away:

- **An entry drawn as it was keeps the drawing it had** (`drawOrKeep`,
  `13-render-nodes.js`). Every entry is still drawn, so nothing about what
  a pass works out changes; then the new drawing is compared, as markup,
  with the old one, and where nothing differs the new one is dropped before
  the browser has seen it. Compared as markup because what goes into an
  entry's drawing is spread over the whole program and the markup cannot
  leave anything out: its own gradient ids are compared by where they are
  used, its controls group as empty, the layer it is in counts, and an old
  drawing anything has touched since it was drawn is drawn afresh. Its
  listeners outlive the pass that made them, so every one that hands the
  entry on looks it up live (`liveN`) — the portrait-resize check is the
  one that caught a grip still holding the entry of an older pass. The
  suite checks that one edit keeps every other drawing and that what is
  kept is what a pass that keeps nothing would draw ("an edit redraws only
  the entries it changed").
- **The chart does not take the top bar's text with it.** Even with every
  drawing kept, writing the counts in the top bar (`updateStats`) laid the
  SVG out again — ~33 ms — because the drawing's box depended on the bar.
  `.app > .main` is now `contain:size` (not `layout`, which would make it
  the containing block of the fixed menus inside it).

`tools/bench-edit.js`, 600 entries:

| edit | before | after |
| --- | ---: | ---: |
| recolour, tag, note, rename | ~100–106 ms | ~64–72 ms |
| move an entry | ~141 ms | ~83 ms |
| of which `buildSideTabs` | ~52 ms | ~9 ms |

What is left is `renderNodes` drawing everything to compare it (~33 ms)
and `redrawEdges` (~15). Keeping edges the same way was measured next: on
the chain with a label on every fourth connector, an edit is ~92 ms, and
what drawing the connectors afresh costs beyond routing them is ~15 of it
in script and ~6 in the layout that follows — about a sixth at best, for a
second copy of the mechanism above over code that draws arrowheads,
labels and bends. Left until a chart that needs it.

## What a reader waits for before the chart is drawn

The site's page carries a drawing of the chart, made when it is published
(`tools/prerender.js`, in the Pages job, on the runner's own Chrome). The
program takes it away in the task that draws its own (`dropPrerendered`),
so no frame shows neither, and an export leaves it out. Slow 4G (1.6 Mbit,
150 ms), CPU ×4, 390×844:

| | before | with the drawing |
| --- | ---: | ---: |
| the chart on screen | ~2.5 s | ~0.6 s |
| the program running | ~2.7 s | ~2.8 s |

The program itself is a seventh lighter on the site: `VERSION_LOG` was
~86 KB of it, 30 KB gzipped, for a panel almost nobody unfolds. An export
from the site holds it again (`inlineSiteFiles` puts the file back where
its name stands), and the service worker keeps it once it has been read.

Two things were measured here and are not worth doing:

- **Preloading the pictures** from the head. They share the line with the
  program and it arrived a second later; the pictures finished no sooner.
  The drawing leaves them out for the same reason.
- **Batching `inkBoxOf`'s reads** on the owner's chart (twelve forced
  layouts an edit). It is ~3 ms of ~21, and the cheaper ways to it change
  what an edge note measures by a sub-pixel.


## What a phone waits for on a chart of hundreds

`tools/bench-boot.js` opens a synthetic chart of lineages that merge, with
tags and notes, as a phone does: 390×844, CPU ×4, median of three.

| entries | first entry on screen | start-up done, before | after |
| ---: | ---: | ---: | ---: |
| 41 | ~1.2 s | 1.6 s | 1.3 s |
| 400 | ~3.4 s | 5.5 s | 3.8 s |

Start-up drew the chart twice: once itself, and again when
`document.fonts.ready` settled — every load, for the interface's own faces,
to the same widths. `fontsLanded` now asks each remembered width again
(`widthsMoved`) and redraws only when one comes out different.

What is left before the first entry is `renderNodes` (~1.8 s at 400), and
three quarters of that is measuring text with the cache cold. The side
tabs (~75 ms) and the text view (~30 ms) also run at start-up; putting them
off would save a thirtieth, so they are left where they are.

## What a phone pays to pick many entries and carry them

`tools/` has no bench for it; it was measured on the owner's chart at
390×844, CPU ×4, picking entry after entry and carrying them (22.11):

| | before | after |
| --- | ---: | ---: |
| a connectors' redraw in a carry | ~44 ms | ~30 ms |
| a tap that adds to the pick | ~10 ms | ~4.6 ms |
| a drop, in script | ~282 ms | ~226 ms |
| of which `redrawEdges` | 146 ms, 3 calls | 73 ms, 2 calls |

Three things, none of them drawing:

- **A connector's note asked the layout its face and where its letters
  stand** (`getComputedStyle`, `getStartPositionOfChar`,
  `getComputedTextLength`) while the connectors were being drawn, and each
  question laid out everything drawn so far. The face is now remembered by
  what decides it (`faceOf`, `05-render-text.js`: the element's and its
  ancestors' attributes but those that only place it), a level run's start
  is its own `x`/`y` where nothing can move it, and a note along its line
  remembers its length, which is the words' advance whatever the path
  (`noteAlongMeasure`, `11-edge-notes.js`). `fontsLanded` forgets both.
- **Setting `contentEditable` restyles the page even to the value it has**,
  and every pick set two fields. `setEditable` (`24-rich-fields.js`) sets
  only a change.
- **A drop drew the connectors twice in a row**: the frame the carry still
  owed, then the pass that prunes hand bends. The owed frame is drawn only
  for a carry that came back to where it started.

Moving the connectors inside a carried group by translation instead of
routing them again was looked at and left: their masks and gradients are
named by entry and by pass, and the hops are worked out from every route.

## What one edit costs, and the routes it no longer recomputes

`tools/bench-edit.js` times the edits a person makes all day through
`applyEdit`, split by function. Synthetic chain, 600 entries, medians:

| edit | before | after | routing before → after |
| --- | ---: | ---: | ---: |
| recolour an entry | 943 ms | 385 ms | 571 → 4 ms |
| tag an entry | 874 ms | 374 ms | 527 → 3 ms |
| retype a note | 1055 ms | 399 ms | 635 → 4 ms |
| move an entry | 493 ms | 566 ms* | 169 → 231 ms |

\* within the spread between runs: two runs before the change gave 493
and 932 ms for the same move. A move changes a box, and a changed box
means everything is routed afresh, as before.

Every edit redrew the whole chart, and routing was the larger half of it
even for an edit that cannot move a line. A pass now remembers its calls
to `pathFromPorts` in order (`routePass`, `09-bends-ports.js`), and the
next pass hands them back while the chart the router sees is the same
(`routeWorldKey`: every entry but its words and paint) and every call so
far was asked as before. The first difference ends the reuse for the rest
of the pass, so the routes are exactly a fresh pass's; the suite compares
the two after each kind of edit ("an edit that moves nothing re-routes
nothing"). A test that wants a fresh pass sets `routeLast = null`.

What was left of an edit was the entries' DOM — and most of that DOM was
controls nobody could see. An entry was six elements of drawing and
thirty-four of corner grips and connector strips, all hidden until the
pointer is on it; a 600-entry chart was 24,200 elements, and the style and
layout every redraw forces went over all of them (it lands wherever the
next read of a size is, which is why `buildSideTabs` looked expensive). The
controls are now built the first time something can reach them — the
pointer arriving (`pointerover`, so a finger too), the entry being
selected, a connector dragged onto it (`nodeControlsWanted`,
`13-render-nodes.js`). Same chain, medians, two runs each:

| 600 entries | before | after |
| --- | ---: | ---: |
| recolour, tag, note, rename | ~290–390 ms | ~160–205 ms |
| move an entry | ~520–920 ms | ~305–330 ms |
| `renderNodes` | ~100–160 ms | ~35–65 ms |
| elements per entry | 40 | 6 |

At 200 entries an edit went from ~90–125 ms to ~45–75. Reusing an
unchanged entry's drawing was judged not worth it here, on what
`renderNodes` itself cost; what it saves turned out to be the browser's
layout after it, and it is done now (see above). A test that wants an entry's grips or strips
without moving a pointer calls `nodeControlsOn(id)`.

## What an edit cost before it was even drawn

`takeSnapshot` runs on every edit and `isDirty` on every keystroke, and both
used to serialize entries whole. Stickers and media had been dealt with —
snapshotted as flat records so their base64 was held by reference — and the
third place bytes live was left alone: a portrait hangs off an entry, and an
entry is not a flat record, so that mechanism could not be pointed at it.

| 60 entries | `isDirty` | undo stack |
| --- | ---: | ---: |
| no portraits | 0.01 ms | 0.2 MB |
| with portraits, before | **2.05 ms** | **62.1 MB** |
| with portraits, after | 0.07 ms | 2.6 MB |

A megabyte of garbage per keystroke and sixty copies of the same pictures —
exactly the fault the flat-record form was written to cure, in the region it
could not reach. The lesson is in where it was fixed: `heavy` was a property
of a REGION when what it is about is CONTENT.

So there is one mechanism now, and it asks about content. A region is
serialized with every string past `HEAVY_STRING` lifted out and replaced by
its index, the strings kept beside the text. Nothing assumes a shape, so
nothing falls back to a slower form it might have got wrong, and there is no
counter for a write site to forget. The flat-record code is gone.

Two things worth knowing before touching it: a picture worn by two entries is
listed twice, and that is right — both slots hold the same string object, and
deduplicating them would mean hashing twenty thousand characters to save a
pointer. And a long note is lifted too; the rule is about length, not about
whether something is a picture.
