# Working on this repository

Read this before changing anything. `README.md` explains what the chart *is*;
this file is about how work on it is done, and which arguments have already
been had.

## The one rule that everything else follows from

`src/app/` holds 36 files. **They are not modules.** The page is a single
scope, and `build.py` assembles it by writing those files out one after
another in the order `APP_PARTS` declares. Nothing imports anything. A name
defined in part 32 is visible in part 07.

So:

- Moving a function between parts is free **only** if it is not read during
  boot before the part that now holds it has run. Function *declarations*
  hoist within a script, and the assembled program is one script — but
  `const`/`let`/`var` initialisation does not.
- Adding a part means adding it to `APP_PARTS` in `build.py` **and** to the
  loader array in `src/index.html`. The build refuses a mismatch between the
  two, a missing part, and a part on disk that nothing lists.
- `src/index.html` fetches the parts and runs them as **one** script with
  `//# sourceURL=app.js`. It does not use a `<script>` tag per part: as
  separate scripts, start-up reaches for hundreds of names whose part has not
  run yet. It therefore needs an HTTP server; for double-click use, build
  `dist/nexus.html`.

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
python3 tools/lint.py            # ~seconds
node tests/worker.js             # ~instant, the write service
node tests/regression.js         # ~6 minutes, against dist
node tests/regression.js src     # ~6 minutes, against src
```

`dist` and `src` load the same program by different paths. A green run on one
says nothing about the other; run both.

### Running less than all of it

The suite is 77 named scenarios, and they do not depend on one another —
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

Now `build.py` writes one file, `dist/nexus.html`, a whole document, and the
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
- **A page that is behind the repository may not save.** `build.py` writes
  the git blob id of `src/data.js` into the page (`DATA_SHA`, replacing the
  `/* @@DATA_SHA@@ */ null` marker in `01-store.js`); the service refuses a
  save whose base is not the file on `main`, and the owner's page refuses to
  become an editor when `/me` reports a different id. Moving to the next
  base after a save is what lets two saves in a row work before the site
  has rebuilt.
- **What the page sends for a region is the text between its markers,
  byte for byte.** Otherwise every save would rewrite all of `data.js`.
- **On the site a chart in localStorage is never restored** — it could only
  be a reader's edit from the days the site served an editor.
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
  kilobytes against a megabyte of embedded pictures. Moving media to separate
  files is the size win, and it needs a host that serves more than one file.

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

**The ceiling is `routeEdge`, and it is quadratic twice over.** `scorePath`
(`07-router-ortho.js`) walks every obstacle and every already-routed segment
for each candidate path, and `routedSegments` grows as the chart is drawn.
At 200 entries that is 19.6 ms and at 600 it is 152 ms. The cure is a
spatial index on both, and the bar for attempting it is high: routing is
order-sensitive by design, so the score has to come out identical or every
connector on the chart moves. Nobody should start it without a chart big
enough to need it and an equivalence check over the drawn routes.
- **A two-phase render — measure everything, then build the DOM — was the
  other half of this and is not worth doing.** Its whole gain was collapsing
  those forced layouts into one, and measurement is now 1–2% of a rebuild.
  It would be invasive surgery on 1123 lines for something already spent.

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
  saves itself through.
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
   repository through `worker/`; what remains is moving media out of the
   page, which also shrinks every save by the megabyte of base64 it carries.
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
