# Working on this repository

Read this before changing anything. `README.md` explains what the chart *is*;
this file is about how work on it is done, and which arguments have already
been had.

## The one rule that everything else follows from

`src/app/` holds 41 files. **They are not modules.** The page is a single
scope, and `build.py` assembles it by writing those files out one after
another in the order `APP_PARTS` declares. Nothing imports anything. A name
defined in part 32 is visible in part 07.

So:

- Moving a function between parts is free **only** if it is not read during
  boot before the part that now holds it has run. Function *declarations*
  hoist within a script, and the assembled program is one script — but
  `const`/`let`/`var` initialisation does not. `tools/tdz.js` (run by
  `tools/lint.py`) walks start-up and every call it makes and reports a
  const, let or class reached before its statement; the first chart is
  built in part 02, so anything `buildModel` asks is read then. Its
  `KNOWN` list is for a function that returns before such a read, with
  the reason — not for silencing a finding.
- Adding a part means adding it to `APP_PARTS` in `build.py` **and** to the
  loader array in `src/index.html`. The build refuses a mismatch between the
  two, a missing part, and a part on disk that nothing lists.
- `src/index.html` fetches the parts and runs them as **one** script with
  `//# sourceURL=app.js`. It does not use a `<script>` tag per part: as
  separate scripts, start-up reaches for hundreds of names whose part has not
  run yet. It therefore needs an HTTP server; for double-click use, build
  `dist/nexus.html`.

## How an entry is written

In `src/data.js` an entry is a record with its fields named —
`{id, label, parent, edgeLabel, note, shape, …}`, every option beside them —
and `SETTINGS.format` says so (`DATA_FORMAT`, `02-model.js`). Inside the page
it is still the list it always was, `[id, label, parent, edgeLabel, note,
shape, opts]`, because every part reads it that way; `entryOfRecord` and
`recordOfEntry` are the only two places that know both. A list found in a
file is still read, so older saves, exports and pulls open as before; a
file whose `format` is higher than the page's is refused at import.

The number also says which `MIGRATIONS` (`02-model.js`) a chart still
needs. They run once, where a chart comes in — boot, `importChartFromText`,
`putChartData` — never in `buildModel`, so drawing never rewrites the
chart. A kept chart's number is its own: one kept without a number is form
1, not the file's. Something an older chart must be brought through is a
new step with the number it ends at, and `DATA_FORMAT` goes up by one.
Tests write entries in the current form; one that means an old chart says
so with `migrateChart(1)`.

The same contents as JSON — `{format, nodes: [records], edgeStyles, …}` —
are what "Export the contents as JSON" writes and Import reads, and
`src/site/chart.schema.json` (published at the site's root) describes
them. A field added to an entry or a connector belongs in the schema too;
the suite validates the owner's chart and a chart of every kind against it.

## Where the chart's contents actually live

**On the published site, in `src/data.js`** — Save there commits the regions
to the repository through the write service (`worker/`), so the repository is
current by construction. **On claude.ai, not in `src/data.js`.** The artifact
rewrites its own `@@EDIT@@` regions when someone presses Save, so the live
artifact holds the current chart and the repository holds a seed. Everything
below is about that second case.

Before doing anything that will be published, pull the live copy back:

```bash
python3 build.py --pull saved-live-page.html
```

A plain `python3 build.py` already carries the regions over from the existing
`dist/nexus.html`; `--pull` is for when the browser has edits that no local
build has seen. The pull refuses a region that is missing, emptied, or has
lost most of its contents (`--partial`, `--force` to override), and keeps
three generations of `src/data.js` and `dist/nexus.html` in `.backups/`.

**The plain build carries them in memory only.** It writes the chart into the
page it is building and leaves `src/data.js` exactly as stale as it was; only
`--pull` writes back. That is the right split — a build should not quietly
rewrite a source file, and `--pull` is the guarded version of that write — but
it has a consequence worth stating plainly:

> `dist/` is generated and ignored, so a clean checkout has no live page at
> all. CI is a clean checkout. **What CI builds, and therefore what the
> published site becomes, is `src/data.js` and nothing else** — however far
> behind the artifact it has drifted.

So the two copies can disagree indefinitely while every local build looks
correct, because every local build carries the data across. Nothing about
that is visible until a publish loses work nobody deleted.

`python3 tools/data_check.py` asks the question directly. It reads only,
compares the regions of `src/data.js` against `dist/nexus.html`, and exits
non-zero when the sources are behind. A missing `dist/` is reported as a
fresh clone rather than as a failure — otherwise it would cry wolf on every
CI run, which is where it runs unattended. The comparison is on region
TEXT, not on item counts: renaming an entry changes no count, and most
staleness looks like that.

The build says the same two things itself — that it had nothing to carry
from, or that what it carried differs from the sources — so neither case
can happen in silence any more.

## Before you say anything is done

Six checks, and all six have to be green:

```bash
python3 build.py
python3 tools/data_check.py      # ~instant, and run it AFTER the build
python3 tests/build_guard.py     # ~seconds
python3 tools/lint.py            # ~seconds, and tools/tdz.js with it
node tests/worker.js             # ~instant, the write service
node tests/regression.js         # ~6 minutes, against dist
node tests/regression.js src     # ~6 minutes, against src
```

`dist` and `src` load the same program by different paths. A green run on one
says nothing about the other; run both.

### Running less than all of it

The suite is 130 named scenarios, and they do not depend on one another —
which is checked rather than assumed: four shards print exactly the checks
one whole run prints, by name, and the wrapping that introduced them added
two lines per scenario and moved no bodies.

```bash
node tests/regression.js --list           what there is to run
node tests/regression.js --only=callout   just those, ~20s rather than ~5min
node tools/shards.js                      the whole thing, four ways, ~90s
node tools/shards.js src                  the same against the sources
```

`--only` that matches nothing exits 2 rather than 0: a mistyped name used to
read exactly like a run that passed.

The suite answers both webfont hosts with an empty stylesheet rather than
letting the request out. It used to leave them to the network and filter the
resulting console error by matching the message against the host name —
which does not work, because Chromium reports a blocked stylesheet as
"Failed to load resource: net::ERR_…" without the URL in it. Every run on a
machine with no route to Google Fonts therefore came out red on a check
called "no uncaught page errors". A suite that goes red because a third
party is unreachable is testing the network; now every machine runs the same
test, and that test is the case README promises works. Each run names its three slowest
scenarios, so which ones are worth a quick set is answered by the suite
rather than guessed. A scenario that throws is caught and counted instead of
ending the run — one broken scenario used to take the sixty after it with it.

A plain `node tests/regression.js` still runs everything in order and still
takes about six minutes; the shards are for when you want the answer now. CI
runs the shards.

Adding behaviour means adding a named check to `tests/regression.js`, inside
the scenario it belongs to. When a claim turns out to be wrong — including
one this file makes — the fix is a check that would have caught it, not a
note.

## One build, and who may edit it

There used to be four builds — editable or read-only, fragment or document —
because who could edit was decided when the page was built. For a while the
one Pages needed (read-only AND a document) did not exist, so the site served
the editor; later an exported copy carried the read-only declaration onto
readers' disks and froze it there. Both were consequences of deciding at
build time.

Now `build.py` writes one page, `dist/nexus.html`, a whole document, and the
page decides when it opens:

| where it is opened | what it is |
| --- | --- |
| claude.ai | asks the artifact host, as it always did |
| `SITE_ORIGINS` (the published site) | a reader; the editor once the write service confirms the owner |
| anywhere else (disk, other hosts, the test server) | its holder's own copy, saving into their browser |

Things that follow, and are pinned in the suite ("the page on the published
site") and `build_guard`:

- **The hidden controls are not the security.** Every reader gets the
  editor's code. The write service (`worker/index.js`) is what refuses:
  session sealed with `SESSION_SECRET`, login in `OWNERS`, session handed
  only to `ALLOWED_ORIGINS`, and the commit made with the owner's own GitHub
  App user token so GitHub checks it again. `tests/worker.js` is mostly
  about what it refuses.
- **The site is that page with its program beside it.** `build.py` also
  writes `dist/site/` (`build_site`), which CI publishes: the same page,
  but with the program and stylesheet in `app.<hash>.js` and
  `style.<hash>.css`, named by the sha-256 of their bytes, and minified
  by esbuild (pinned in `package.json`; whitespace and syntax only, so
  every name — and every stack trace — stays readable), with
  `app.<hash>.map` beside the program — and without its version log,
  which is `versions.<hash>.js` beside it, fetched the first time the
  history in About is unfolded (`lift_version_log`; 207 KB gzipped
  became 177). A build without esbuild writes
  them unminified and says so; CI sets `RHIZOME_MINIFY=required`, so a
  publish cannot. 491 KB gzipped became 200, and the first drawing on a
  cold load 588 ms → 269 together with the fonts below. A Save changes
  only the chart, so readers keep both and fetch ~15 KB instead of ~200.
  Their tags carry `data-inline`, and `readOwnSource` puts both back inside
  (`inlineSiteFiles`, `20-about.js`), so Export is still one file. The
  service worker keeps them cache-first, like pictures, and lets go of a
  pair once neither the newest page nor the one before it names them. The
  site's `<head>` also says what a link to it is (og/twitter tags, and
  `src/site/og-image.png`, drawn by `tools/og-image.js`). `build_guard`
  checks that the site, with the files put back unminified, is
  `nexus.html` byte for byte but for the one seam between the chart's
  script and the program's, and that the files ARE the program and the
  stylesheet minified — so an export from the site carries the minified
  program, which the suite drives as it drives any other.
- **Fonts do not hold up the first drawing.** The UI faces' stylesheet
  loads as `media="print"` and switches itself on; an entry face
  (`FONT_OPTIONS[].web`) is asked for the first time an entry is drawn in
  it (`askForFace`), and `fontsLanded` measures again when it arrives.
- **The site counts and reports, and only the site.** A Cloudflare Web
  Analytics beacon, when CI passes `CF_WEB_ANALYTICS_TOKEN` (a repository
  variable), outside the markers so no export carries it; and faults a
  reader's browser meets go to `POST /report` (`reportFault`,
  `01-store.js`), at most five a load, never with the session, which the
  service writes to its log and nowhere else.
- **No part may contain a closing script tag**, in a string or a comment:
  the program is inside a `<script>` in every build but the site's, and the
  parser ends it there. The build refuses it and names the part.
- **A save made on an older chart is merged, not refused.** The service
  reads the `data.js` the save was made on (its base, by blob id) and
  merges region by region, item by item — an item is a line, named by
  what opens it (`ITEM_KEY`, `worker/index.js`), which is why every
  serializer writes one item to a line and must keep doing so. Only what
  both changed differently is a 409, with the colliding items named. The
  answer carries the merged regions and `over`, the file it replaced.
- **A page that is behind the repository may not save.** `build.py` writes
  the git blob id of `src/data.js` into the page — as a
  `<meta name="rhizome-data-sha">` in the wrapper's head, outside the
  page's markers, which `DATA_SHA` (`01-store.js`) reads. Not into the
  program, which would then change with every Save and the site's program
  file with it. An exported copy carries none. The service refuses a
  save whose base is not the file on `main`, and the owner's page refuses to
  become an editor when `/me` reports a different id. Moving to the next
  base after a save is what lets two saves in a row work before the site
  has rebuilt.
- **What the page sends for a region is the text between its markers,
  byte for byte** — but for each embedded picture past 2 KB, which goes as
  its path, `media/<sha256>.<ext>`, with the file beside it (`liftMedia`,
  `04-assets.js`). Otherwise every save would rewrite all of `data.js`.
- **Pictures live in `src/media/`, named by the hash of their bytes**, and
  the build copies them to `dist/media/`. The service refuses a file whose
  bytes are not its name and a chart naming a path nobody sent. Anything
  that leaves the site (Export, Export data, the PNG/SVG picture) inlines
  them again with `inlineMediaRefs`.
- **A push that changes only `src/data.js` and `src/media/` skips CI's checks** and is
  published at once — that is what a Save on the site is, and the owner
  asked not to wait for the suite. The `changes` job decides from the
  pushed trees, so any other file in the push runs everything.
- **On the site a chart in localStorage is never restored** — it could only
  be a reader's edit from the days the site served an editor.
- **With no connection the owner still edits, and Save goes to an outbox**
  (IndexedDB, beside the draft; `36-site-owner.js`), sent when the
  connection returns. The service worker (`src/site/sw.js`) is network-first
  for the page on purpose: a cached page that is behind must not become the
  page the owner saves from. Sessions renew through GitHub's refresh token,
  which is good once — so the page's requests to the service go one at a
  time (`siteRequest`), and every answer, a refusal included, may carry the
  new session.
- Read-only is still a flag (`body.read-only`, `readOnlyView`), and
  `markEditable` is its way back; lifting it means drawing again, because
  some parts ask `readOnlyView` while they draw.

## What has been measured, so it need not be argued

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

### What a frame of panning costs

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

### What `rebuildChart` was actually spending its time on

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

### Where a rebuild goes now, and what is NOT worth optimising

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

### What is left of an edit is the browser laying out the new drawing

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

### What a reader waits for before the chart is drawn

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

### What one edit costs, and the routes it no longer recomputes

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

### What an edit cost before it was even drawn

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

### The cache, and why it may exist

The cache is only allowed to exist because nothing can tell it is there, and
that is checked rather than asserted: see the named checks in
`tests/regression.js`. The one piece of state its arguments do not carry is
the order of `REFS` — a citation draws as the number its reference has in the
list, so moving one changes `[1]` to `[11]` and the width of every text that
cites it. The key carries that order, and only for texts that cite anything.

## Directions already rejected, with the reason

Do not re-propose these without new evidence:

- **ES modules / a bundler.** The call graph has 348 boot-reachable forward
  references with cycles; there is no order in which each part only uses what
  came before it. A bundler would also destroy the `@@EDIT@@` markers the page
  saves itself through. Looked at again in October 2026: the cycles alone
  would not forbid modules — a module may take part in a cycle as long as it
  does not read the other side's names while it runs — but the markers stand,
  and the owner's answer was to keep one scope. The door is not shut: if the
  chart's data ever leaves the page, the strong reason goes with it.
- **A full TypeScript migration**, and a **Model/View split as an end in
  itself**. Cost without a measured problem behind it.
- **Splitting the editor and the viewer into two builds.** Editing and drawing
  are threaded through the same functions, so "not calling" the editor does
  not separate it; and two builds create a class of "looks different in the
  viewer" bugs that one program with a flag cannot have. If this is ever
  wanted, do it as lazy loading of the editing parts from one codebase, not as
  a second build.
- **An `[A-Za-z0-9_-]+` whitelist for entry ids.** Ids come from the chart's
  own content.

## Priorities

1. **Independence from the claude.ai runtime.** This is the standing top
   priority. Pages serves the page and Save on the site commits to the
   repository through `worker/`, and pictures are files beside the page.
   What a copy on claude.ai cannot do now is show those pictures.
2. **Bughunting**, and removing behaviour that is unwanted or surprising, over
   new features.

A third priority stood here: splitting the suites so a small change did not
cost twelve minutes. It is done, and differently from how it was posed — not
a quick set and a full set, which would have meant deciding by hand which
checks matter, but named scenarios that can be selected (`--only`) and run in
parallel (`tools/shards.js`). Twelve minutes of waiting is now about three,
and one scenario is twenty seconds.

## House style

- Comments explain **why**, in prose, and are expected to be worth reading.
  Match the existing voice rather than adding `// set x to 1`.
- Review work is not delegated to subagents.
- A message containing **"код 1"** means: run a full review → critique →
  optimise cycle over the codebase.
- Deliverable archives keep the split-source layout (`src/`, `dist/`, `tests/`,
  `tools/`, `build.py`, `README.md`, `CHANGELOG.md`, `package.json`,
  `eslint.config.mjs`).
- Every version bump touches four places: `APP_VERSION` and `VERSION_LOG` in
  `src/app/20-about.js`, `CHANGELOG.md`, `README.md`, `package.json`. The
  About panel and the changelog are generated from the same `VERSION_LOG`, so
  they cannot disagree.
- Replies to the repository owner are written in Russian.
