# Rhizome Project

**Version 0.9.31** — see `CHANGELOG.md`, and the version history at the foot of
the chart's own About panel (both are generated from `VERSION_LOG` in
`src/app/20-about.js`, which is the single source of truth).

A hand-drawn continuity map of the Transformers G1 "OG World", redrawn as an
interactive chart and published as a Claude artifact.

> Formerly *Axiom Nexus*. As of 0.9.20 the browser storage keys carry the new
> name as well; each one reads the old key first and never deletes it, so a
> chart saved under the old name opens unaltered and an older copy of the file
> still finds its own work. The `@@EDIT@@` region names are unchanged.

## Layout

```
src/
  index.html   markup — a real standalone document you can open in a browser
  style.css    every rule on the page
  data.js      the chart's contents, in @@EDIT@@ regions (see below)
  app/         the program, 36 files, one per subsystem — see "One scope, many
               files" below; the order is APP_PARTS in build.py
build.py       welds src/ into the single file the artifact host needs
eslint.config.mjs  three rules, all three about bindings that are not what
                   they look like; see the file for why there are only three
tools/lint.py  lints the ASSEMBLED program and reports per part
tools/data_check.py
               is the chart in the repository the chart that is live? see
               "Where the chart's contents actually live" below
tools/shards.js
               the browser suite in parallel shards — see "Tests" below
tools/bench.js what a rebuild costs, and how much of it is text measurement;
               the numbers in CLAUDE.md come from here, so they can be
               re-run rather than believed
worker/        the write service: owner sign-in through GitHub, and Save as a
               commit to src/data.js — see "The published site" below
tests/
  regression.js   the browser suite, run against dist and against src
  build_guard.py  checks the built page against what src/ says it should be
  worker.js       the write service against a GitHub held in memory
package.json   npm run build / test / test:src / test:fast / test:list /
               test:build / lint / check:data / bench
.github/workflows/ci.yml
               data check, build, guard, lint, the write service's tests,
               both suites in four shards each; on main, publishes the page
               to Pages and deploys the write service
.backups/      the last three copies of src/data.js and dist/nexus.html,
               written before either is overwritten; not part of the sources
dist/          GENERATED — not in the repository, see "The repository" below
  nexus.html   the chart, one whole document, for everywhere: the site, a
               disk, claude.ai. Who may edit it is decided when it opens,
               not when it is built — see "The published site" below
```

## One scope, many files

`src/app/` holds 36 files, one per subsystem. They are **not modules**. The
page is a single scope, and the build assembles it by writing those files out
one after another in the order `APP_PARTS` (in `build.py`) declares — exactly
as the single `app.js` used to read top to bottom. Nothing has its own scope,
nothing imports anything, and no name changed meaning by moving; when the
split was made, the built page came out byte for byte identical.

ES modules were considered and rejected, on the program rather than on taste.
Drawing, routing and editing call one another in every direction, so there is
no order in which each part only uses what came before it — one scope is what a
call graph with cycles in it actually is. Modules would also need a bundler,
and a bundler would destroy the `@@EDIT@@` markers the page saves itself
through. The goal was a file you can hold in your head, not a dependency graph.

For the same reason `src/index.html` does not load the parts as a `<script>`
each: it fetches them, joins them, and runs the result as **one** script, which
is exactly what the published page is. A function declaration hoists over the
script it is written in, so as separate scripts the program's start-up reaches
for hundreds of names whose part has not run yet. (It therefore has to be
served over HTTP; for a file you can open by double-clicking, build and use
`dist/nexus.html`.)

Three things could quietly break the order, and the build refuses all three: a
part `APP_PARTS` names that `src/app/` does not have, a part `src/app/` has
that `APP_PARTS` does not name, and `src/index.html` running them in a
different order. A part left out of an assembled program does not fail
loudly — it fails as a function that is simply not there.

For the same reason the linter runs on the assembled program: run
`npm run lint` (which is `tools/lint.py`), never `eslint src/app` — the three
rules ask questions that only have answers about the whole program. Complaints
come back addressed to the part and line they belong to.

## Why there is a build step

A published artifact is served under a Content Security Policy that blocks
every external host: no separate stylesheet, no separate script, no image
files, no `fetch`. The page it serves must be one self-contained file.

That is a fine way to *ship* a page and a poor way to *write* one, so the
sources live apart and `build.py` inlines them. `src/index.html` is a real
document with `<link rel="stylesheet">` and `<script src>` — open it through
a local server and the chart runs exactly as it does when published. Only
the built file is a monolith, and only the built file drops the
doctype/head/body wrapper, because the host supplies its own.

The build is verified to reproduce the previous single-file version byte for
byte, so nothing about the published page changed when the sources were
split.

Fonts are the one exception the CSP allows: three families come from Google
Fonts by `<link>`, each with a local fallback stack, so the page still reads
correctly if those hosts are blocked. Everything else — icons as inline SVG,
portraits and stickers as `data:` URIs — is inside the file.

## Build

```bash
python3 build.py                    # src/ -> dist/
python3 build.py --pull live.html   # take the chart's data from a saved
                                    # copy of the live artifact first
```

## The repository

`dist/` is **not** committed. All three files come to about 7 MB, nearly all
of it the two base64 blobs in `src/data.js`, and every byte is reproducible
from the sources by `python3 build.py` — which `tests/build_guard.py` checks
on every run. Committing them would grow the history by that much per version
and would never be the thing anyone reads. So: clone, then build.

```bash
git clone https://github.com/cccarrrottt/cccarrrottt.github.io
cd cccarrrottt.github.io
npm install          # eslint and playwright; there is no lockfile yet
python3 build.py     # writes dist/
```

CI runs on every push and pull request: the data check (before the build, so
it sees the checkout's own chart rather than one made from it a step
earlier), the build, the build guard, the lint, the write service's tests,
and the regression suite twice — once against `dist`, once against `src`,
because they load the program by different paths and a green run on one says
nothing about the other. Each of those two runs is split across four shards
that run at the same time, so a regression job is about a minute and a half
rather than six. The built files are attached to each run as an artifact, so
a copy is always downloadable without building.

On `main`, and only after everything above is green, `dist/nexus.html` is
published to GitHub Pages as `index.html`. The site is
<https://cccarrrottt.github.io>, which is what naming the repository after
the account buys: a page served at the bare address rather than under a path.
The source of that site must stay **GitHub Actions** (Settings → Pages →
Build and deployment). Set to a branch instead, Pages renders `README.md`
through Jekyll and serves that — a site that builds perfectly and is not the
chart.

## The published site, and who may edit it

There is one page, and on the site it is the same file for everybody. It
opens as a reader; the owner presses **Owner sign-in**, signs in with GitHub,
and the same tab becomes the editor. **Save** then commits the chart's
regions into `src/data.js` on `main`, and CI rebuilds the site from that
commit, so a save is on the site a few minutes after it is made.

What keeps everybody else out is not the hidden controls — every reader
receives the editor's code. It is that a static page cannot be written to,
and the one place a write can go is the write service in `worker/`, which:

- signs people in through a GitHub App and hands out a session only to a
  login listed in `OWNERS`, and only to the site's own address;
- commits with that person's own GitHub token, so GitHub refuses the write
  unless the account can push to the repository *and* the app is installed on
  it with Contents write — nothing on the page can change either answer;
- refuses a save made on top of anything but the `data.js` currently in the
  repository. The page carries the git id of the file it was built from
  (`DATA_SHA`, written in by `build.py`), so a page that is behind — a second
  tab, or this one reloaded before the site caught up — cannot write an older
  chart over a newer one. The owner's page says so when it opens rather than
  when they press Save.

Anywhere other than the site's address — a disk, somebody else's host, the
test server — the page is its holder's own copy and saves into their browser,
as it always has. A copy exported from the site is exactly that: it opens off
a disk as an editor of its own.

There used to be four builds — editable or read-only, fragment or document —
because who could edit was decided when the page was built. Pages once served
the editable one, so every visitor got an editor whose edits survived a
reload in their own browser. None of that can recur: there is one file, and
on the site it is a reader unless the service says otherwise.

### Setting up the write service

Done once. Until it is, `SITE_API` points at nothing and the site is
read-only for everybody, the owner included.

1. **Cloudflare.** Make a free account and open *Workers & Pages* once, which
   gives the account its `*.workers.dev` subdomain. The service will live at
   `https://rhizome-edit.<subdomain>.workers.dev`; if the subdomain is not
   `cccarrrottt`, change `SITE_API` in `src/app/01-store.js` to match.
2. **A GitHub App** (GitHub → Settings → Developer settings → GitHub Apps →
   New). Homepage: the site. Callback URL:
   `https://rhizome-edit.<subdomain>.workers.dev/callback`. Keep *Expire user
   authorization tokens* on. Webhook: off. Repository permissions:
   **Contents — Read and write**, nothing else. Installable only on this
   account. Generate a client secret, then **Install** it on this repository
   only.
3. **Deploying from CI.** A Cloudflare API token from the *Edit Cloudflare
   Workers* template, and the account id, as the repository secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Every push to `main`
   then deploys `worker/`; without them that job says so and does nothing.
4. **The service's own secrets**, in Cloudflare (Worker → Settings →
   Variables and Secrets): `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from
   the app, and `SESSION_SECRET`, any random string of 32 characters or more
   (`openssl rand -hex 32`). They stay in Cloudflare; a deploy does not touch
   them, and nobody else needs to see them.

`worker/wrangler.toml` holds the rest: the repository, the branch, the owner
logins and the site's address.

## Where the chart's contents actually live

Not in `src/data.js`. Pressing **Save** in the published page rewrites the
`@@EDIT@@` regions of the *published* file:

```
/* @@EDIT:NODES:START@@ */      the entries
/* @@EDIT:EDGESTYLES:START@@ */ per-connector styling
/* @@EDIT:STICKERS:START@@ */   the sticker library
/* @@EDIT:MEDIA:START@@ */      pictures and clips embedded in comments
/* @@EDIT:TAGCATS:START@@ */    tag categories
/* @@EDIT:REFS:START@@ */       the reference list
/* @@EDIT:SETTINGS:START@@ */   chart-wide settings
/* @@EDIT:COMMENTS:START@@ */   suggestions (feature currently switched off)
```

On claude.ai, then, the live artifact, not the repository, holds the current
chart. (On the published site it is the other way round: Save there commits
to `src/data.js` itself, so the repository is always current — see above.)
A plain
`build.py` run knows this: it carries those regions over from the existing
`dist/nexus.html` rather than resetting them to the seed data in the
sources. If you have edited the chart in the browser since the last build,
save that page and pass it with `--pull` so your edits come back into the
sources first — otherwise the next publish would overwrite them.

### The half of that which is easy to miss

The plain build carries those regions **in memory**. It writes them into the
page it is building and leaves `src/data.js` alone; only `--pull` writes back.
And `dist/` is generated and not committed, so a clean checkout has no live
page at all — which means CI builds from `src/data.js` and nothing else, and
the site CI publishes is the sources' copy however far behind it has drifted.

Both copies can therefore disagree for months while every local build looks
perfectly correct, because every local build carries the chart across. The
first visible symptom would be a published page that has lost work nobody
deleted.

```bash
python3 tools/data_check.py     # npm run check:data
```

reads both and says so. It exits non-zero when `src/data.js` is behind
`dist/nexus.html`, names the regions, and gives the one command that fixes
it — `python3 build.py --pull dist/nexus.html`. A missing `dist/` is reported
as a fresh clone rather than as a failure, because that is what CI is, and a
check that cried wolf there would be switched off within a week; it prints
the chart's inventory instead, so every CI run's log records what that run
publishes. Regions are compared as text rather than by how many entries they
hold: renaming something changes no count, and that is what most staleness
looks like.

The build now says the same two things itself — that it had nothing to carry
from, or that what it carried differs from the sources — so neither case is
silent.

## The copy published to the artifact host

`dist/nexus.html` can still be published to claude.ai with the `artifact`
runtime capability, which is what lets the page publish new versions of
itself there. It is the same file the site serves; on claude.ai it asks the
host, not the write service, whether it may write. There is no separate
read-only build any more — a public, read-only copy of the chart is the site.

## Working on it locally

```bash
python3 -m http.server 8000 --directory src
```

Everything works offline. Served like this the page is your own copy, so
**Save** keeps the chart in this browser.


## Running it without claude.ai

The chart does not need claude.ai, and does not need any server. `dist/nexus.html`
is a complete document: put it on any web space, or open it straight off a disk, and it works —
the same archetypes, the same routing, the same editing. Nothing loads from a network. (The two
webfonts do, when a network is there; without one the page falls back to system faces and is
otherwise unchanged.)

What changes when there is no host is only where **Save** writes:

| Where the page is open | What Save does |
| --- | --- |
| Published on claude.ai | publishes a new version of the page, as it always has |
| The published site, signed in as the owner | commits the chart to the repository; the site shows it after CI |
| The published site, anyone else | nothing — the page is a reader there |
| Any other host, or `file://` | keeps the chart in that browser, keyed to the page's own address |

The page decides this at load time from the host's runtime and its own address, and the **File**
panel states in words which applies, so the answer is never a guess.

### Export and Import

A browser's storage belongs to one browser on one machine, so it is a place to keep work, not a
way to move it. **Export** is the way to move it: it writes out a full, self-contained copy of
the page with the current chart baked into it. That file is not a data file — it is the chart,
openable anywhere, with nothing to import. **Import** is the other direction, lifting the chart
out of such a file into the page you have open; it validates before it replaces anything, and
refuses a file that holds no chart rather than half-loading it.

One asymmetry worth knowing: what the page **publishes** of itself to the artifact host is tried
as a *fragment* first (no `<!doctype>`, no `<html>`), because an older host wraps it in a
skeleton of its own, and as a document if the host asks for one. What gets **exported** is always
a real document, because a file on disk has no host to wrap it — and so is the build.

### Why Export behaves differently on claude.ai

Off claude.ai, offering a file is trivial: a blob URL on an `<a download>`. Inside the artifact
viewer that link is inert, and inert *silently* — there is no event to catch — which is the worst
possible failure mode for a button whose job is saving your work. The viewer mediates file offers
through a `downloads` capability that asks the person first, so the editable copy declares it and
saves through it.

A copy published there with **no capabilities at all** — the only way a page there can be shared
publicly — cannot hand anyone a file, so it disables its own Export button on open and says why,
rather than presenting a control that fails after the click.

One wrinkle: `.html` sits in the viewer's *extended* download set and is not always enabled. When
it is refused, the same bytes are offered as `.html.txt` with a note to rename it — a file you
have to rename beats no file.

## Tags and categories

Tags live in two places now. An entry's `opts.tags` is still the list it wears, and `TAG_CATS` —
its own `@@EDIT@@` region, so it travels with an export — records how those tags are grouped. A
tag belongs to at most one category; `sanitizeTagCats()` enforces that on import so no tag can
render twice.

The reason categories hold tags rather than the other way round is that it gives a tag somewhere
to exist before any entry carries it. The old list was derived from the chart every rebuild, so a
tag with no entries simply vanished; a category that names it keeps it alive, which is what makes
"set up the vocabulary, then apply it" possible.

Which tags are *hidden* is deliberately NOT part of this. That is a view preference, per browser,
and it stays in `hiddenTags` where it always was.

## Waves

`waveRun()` draws one-sided half-ellipses, not a sine. Two details do all the work:

- The control points sit directly above the arc's two **endpoints**. Inset them and the curve
  leaves the baseline at a slope, which is exactly what makes a sine read as a sine; put them on
  the endpoints and it leaves vertically, so the hump is a half-ellipse.
- Every arc bulges the **same** way. Alternating humps average out to a line and read as wobble;
  one-sided arcs read as the coil of an inductor symbol.

Amplitude is not a parameter — it is `step/2`, so the arcs are true semicircles by construction
and cannot be tuned out of being circular. A run has exactly one dial: how long an arc should be.
One-sided arcs also span `amp` rather than `2×amp`, so the line occupies a *thinner* band than
the old sine did while each arc is rounder.

## References

A citation is the token `{{r:key}}` and nothing else. A bracketed number typed by hand stays
ordinary text — a chart about fiction is full of bracketed numbers that are not citations, and a
system that silently claimed them would be worse than none.

What a text stores is the **key**; the `[n]` a reader sees is rendered from the reference's
position in `REFS` at draw time. Nothing anywhere stores a number, which is what lets the list be
reordered — every mark in the chart renumbers itself at once. Deleting a reference strips its
marks from every text rather than leaving `[?]` scattered about.

The mark is the only clickable thing inside a text. The chart's text layer is inert by design (a
label is dragged, not pressed), so `pointer-events` is turned back on for that one `tspan` — which
is what keeps "click the little number" from becoming "click anywhere in the sentence".

## Leader-line notes

`notePos: 'leader'` plus `noteAt`, a **fraction** along the connector. A fraction rather than a
point because the connector is re-routed whenever anything moves: an absolute point would be left
behind the moment a node was dragged.

The point is chosen by pointing at the connector, not by typing a number — 0.62 means nothing when
you are looking at an elbowed line. Shift restricts the offer to the ends, quarters and middle:
the places such a note usually wants to be, and exactly the places freehand pointing is worst at
hitting.

## Why there are no browser dialogs

`window.prompt` and `window.confirm` are unusable here. The artifact viewer runs the page in a
sandboxed frame without `allow-modals`, where `prompt()` returns `null` and `confirm()` returns
`false` — silently, with nothing to catch. Every dialog built on them therefore looked like a
button that did nothing. `askFields()` / `askConfirm()` in `app.js` replace them with in-page
dialogs that also match the rest of the application.

## Collinear stubs are not corners

A routed connector always carries a short stub at each end, standing the line off the border
before it turns. On a straight run those stubs are collinear with the middle, and treating each as
its own run cost twice: a corner flat was spent at every false join (so a short connector was
mostly bald), and the wave-direction vote read the collinear neighbour as a turn when its dot
product with the normal is exactly zero. Zero is *no opinion*, not a vote for the far side —
counting it as one kept a straight connector from ever reaching its default side, which is why it
hung its arcs below the line. `mergeCollinear()` drops those interior points first; the vote now
abstains below an epsilon.

## Saving must never derive the page from the live DOM

The page reads its own source in order to save an edited copy of itself. Fetching its own URL is
the good way; a host that refuses that leaves only the live DOM — which contains whatever the
**host** also put in the document. Publishing that embedded the host's runtime in the chart and
nested one document inside another; a downloaded copy carried references to things that were not
there. Either way the result was a page that rendered part of a chart and responded to nothing.

`build.py` therefore brackets everything the page is made of between `@@PAGE:BEGIN@@` and
`@@PAGE:END@@`, and `ownContent()` cuts between them. What comes out is this page's content and
nothing else, and it is a **fragment** by construction — which is what the artifact host expects
to be handed back, since it supplies the document wrapper itself.

Two details that are easy to get wrong, and were:

- The opening marker goes **after** the first element, not in the first line. A comment appearing
  before `<html>` is attached to the *document*, and `documentElement.outerHTML` starts at
  `<html>` — so a marker in line one is missing from exactly the serialisation it exists for.
- The marker constants are **assembled from pieces** in the source. Written whole they would
  appear inside the very `<script>` being searched, and `indexOf` would find the declaration
  instead of the real marker.

## Formatting never encloses an atomic token

A sticker or a citation is one token. A colour wrapper around one produces
`{{#c23b22|Word{{r:bw}}}}`, which the colour pattern cannot parse because its body stops at the
first `}` — so the whole run fell through as literal text. `richHtmlToMarkup()` keeps its open
wrappers on a stack: an atomic token closes them, emits itself, and reopens them after. Openers
are written lazily, so a wrapper that ends up containing only a token disappears instead of
leaving `****` behind.

## Text formatting is markup, not entry properties

Bold, italic, ruby, colour, **typeface**, stickers and citations are all tokens in the stored
text. That is what lets one entry mix two faces, and what gives a connector's note and a language
tab the same controls as an entry's label — they share one text engine, so a field either has
every capability or the engine is wrong.

Two consequences worth stating:

- **A wave's pitch is fixed, never fitted.** It used to be `runLen/bumps`, so a run stretched its
  arcs to come out even — and adding an arrowhead, which shortens the run, visibly re-pitched the
  whole pattern. An arc is always `EDGE_WAVE_LEN`; the remainder pads the flats.
- **A hand-placed entry grows about its middle.** The stored position is read as the top of a
  default-height box and the real box is centred on it, so a taller entry keeps its centre — and
  a connector meeting the middle of its side does not develop a jog when the text gains a line.

## Two cascade traps worth remembering

Both cost real bugs in this codebase, and both look fine in the source:

- **A presentation attribute loses to a stylesheet rule.** `setAttribute('text-anchor','start')`
  was silently ignored because `.edge-note-text` sets `text-anchor:middle`, so every `tspan`
  re-centred on its own absolute x and the words printed on top of one another. Use an inline
  style when a rule already targets the property.
- **`[hidden]` loses to any author `display`.** The UA rule is the weakest there is, so
  `.style-row{display:flex}` kept a "hidden" row on screen while `element.hidden` reported
  `true` — invisible to a test that checks the property instead of the computed style. There is
  now a `[hidden]{display:none !important}` rule, and the suite checks computed display.

## Tests

    python3 tools/data_check.py       # is the repository's chart the live one
    python3 tests/build_guard.py      # the built page against what src/ says
    python3 tools/lint.py             # the assembled program, reported per part
    node tests/regression.js          # against dist/nexus.html
    node tests/regression.js src      # against the split sources

The browser suite is 77 named scenarios, and they are independent of one
another — checked rather than assumed, by running it in shards and confirming
the shards print exactly the checks one whole run prints. So it need not be
waited through:

    node tests/regression.js --list           what there is to run
    node tests/regression.js --only=callout   just those — about 20 seconds
    node tools/shards.js                      all of it, four ways, about 90s
    node tools/shards.js src                  the same against the sources

An `--only` that matches nothing exits 2, not 0: a mistyped scenario name
used to look exactly like a run that passed.

A plain run takes about six minutes and wants port 8830; `tools/shards.js`
gives each shard a port of its own, so nothing collides. They pick up Playwright from `node_modules` and let it choose its own
browser; a machine with a pinned copy at `/opt/pw-browsers/chromium` uses that
instead, which is what CI and the original sandbox each do.

77 scenarios and 648 checks — 628 against `src`, where reading its own source
does not apply — driven through a real browser against the real built page. The
two webfont hosts are answered with an empty stylesheet rather than reached, so
every machine runs the same test and it is the one the section above promises
works: the page asks, is given nothing, and draws on system faces. Covered: boot, undo/redo, all
nine archetypes, card layout, connector clearance on a dense chart, every panel, tag filtering,
search, the grid, export/import round-tripping, a full unhosted save-reload-restore cycle with
the host runtime deleted, the semicircle geometry, tag categories, connector-note formatting,
the crop chooser's clamping, stacking and round frame, the outward wave direction, the amalgam
junction bead, leader-line notes, the reference system, and URL-scheme filtering. There are no unit tests, deliberately — nearly everything here is
geometry, layout and event wiring, and a unit test cannot vouch for any of it.
