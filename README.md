# Rhizome Project

**Version 0.22.0** — see `CHANGELOG.md`, and the version history at the foot of
the chart's own About panel (both are generated from `VERSION_LOG` in
`src/app/20-about.js`, which is the single source of truth).

A hand-drawn continuity map of the Transformers G1 "OG World", redrawn as an
interactive chart and published at <https://cccarrrottt.github.io>. It began
as a Claude artifact; as of 0.22.0 it is not published there any more, and
the repository is the only place the chart lives.

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
  app/         the program, 42 files, one per subsystem — see "One scope, many
               files" below; the order is APP_PARTS in build.py
  site/        published beside the page on the site only: the manifest, the
               icons and the service worker that make it an app a phone keeps
               — see "On the home screen, with no signal" below — and
               chart.schema.json, the chart's contents as JSON (what
               "Export JSON" writes and Import reads)
build.py       welds src/ into the single file a copy of the chart is
eslint.config.mjs  three rules, all three about bindings that are not what
                   they look like; see the file for why there are only three
tools/lint.py  lints the ASSEMBLED program and reports per part, and asks
               tools/tdz.js whether start-up reads a const before its part
               has run
tools/chart_check.js
               is every region of src/data.js data and nothing else, and
               does the chart fit chart.schema.json? what a data-only push
               is published on
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
               chart check, build, guard, lint, the write service's tests,
               both suites in four shards each; on main, publishes the page
               to Pages and deploys the write service
dist/          GENERATED — not in the repository, see "The repository" below
  nexus.html   the chart, one whole document, for everywhere: the site, a
               disk, another host. Who may edit it is decided when it opens,
               not when it is built — see "The published site" below
  site/        the same page as the site serves it: the program and the
               stylesheet beside it in files named by their hash, so a Save
               does not make readers download them again
  media/       the chart's pictures, copied from src/media/
```

## One scope, many files

`src/app/` holds 42 files, one per subsystem. They are **not modules**. The
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

A copy of the chart has to be one file. **Export** hands a person exactly
one, and it must open from their disk with nothing beside it — so the page
inlines its stylesheet and program. (It began as a Claude artifact, whose
host blocks every external file; that is where the single file came from.)

That is a fine way to *ship* a page and a poor way to *write* one, so the
sources live apart and `build.py` inlines them. `src/index.html` is a real
document with `<link rel="stylesheet">` and `<script src>` — open it through
a local server and the chart runs exactly as it does when built. The site is
the same page with its program and stylesheet beside it (see below), and
Export puts them back inside.

Fonts are the one exception: they come from Google Fonts by
`<link>`, each with a local fallback stack, so the page still reads
correctly if those hosts are blocked. The faces the page's own controls use
are asked for without holding up the first drawing (the stylesheet loads as
`media="print"` and switches itself on), and a face an entry can be set in —
Merriweather, Space Grotesk, Orbitron, Caveat — is asked for only when an
entry on the chart uses it (`askForFace`, `05-render-text.js`); when it
lands the chart measures its words again, as it does for any late font. Everything else — icons as inline SVG,
portraits and stickers as `data:` URIs — is inside the file.

## Build

```bash
python3 build.py                    # src/ -> dist/, from src/ and nothing else
```

## The repository

`dist/` is **not** committed. Every byte of it is reproducible from the
sources by `python3 build.py`, which `tests/build_guard.py` checks on every
run. Committing it would grow the history by a page per version and would
never be the thing anyone reads. So: clone, then build.

```bash
git clone https://github.com/cccarrrottt/cccarrrottt.github.io
cd cccarrrottt.github.io
npm ci               # eslint, ajv, esbuild and playwright, as the lockfile says
python3 build.py     # writes dist/
```

CI runs on every push and pull request: the chart check (every region of
`src/data.js` is data and nothing else, and fits the schema), the build, the build guard, the lint, the write service's tests,
and the regression suite twice — once against `dist`, once against `src`,
because they load the program by different paths and a green run on one says
nothing about the other. Each of those two runs is split across four shards
that run at the same time, so a regression job is about a minute and a half
rather than six. The built files are attached to each run as an artifact, so
a copy is always downloadable without building.

On `main`, and only after everything above is green, `dist/site/` is
published to GitHub Pages: `dist/nexus.html` with its program and stylesheet
kept beside it, each named by the hash of its bytes. A Save changes only the
chart, so a reader's browser keeps those two and fetches about 15 KB rather
than 550; Export puts them back inside, so a copy is still one file. Before
it is published, `tools/prerender.js` draws the chart once into the page, so a
reader sees it before the program has arrived — on a slow phone at about 0.6 s
rather than 2.5 — and the program takes that drawing away as it draws its
own; an export leaves it out. The site is
<https://cccarrrottt.github.io>, which is what naming the repository after
the account buys: a page served at the bare address rather than under a path.
The source of that site must stay **GitHub Actions** (Settings → Pages →
Build and deployment). Set to a branch instead, Pages renders `README.md`
through Jekyll and serves that — a site that builds perfectly and is not the
chart.

## The published site, and who may edit it

There is one page, and on the site it is the same file for everybody. It
opens as a reader; anyone may press **Sign in** and sign in with GitHub to
suggest a change, and when it is the owner, the same tab becomes the editor. **Save** then commits the chart's
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
- never writes an older chart over a newer one. The page carries the git id
  of the file it was built from (`DATA_SHA`, written in by `build.py`), and a
  save made on top of anything but the `data.js` currently in the
  repository — a second device, or a phone's kept Save sent days later — is
  merged with what the repository got in between: what only one side
  changed is taken from that side, one entry (one line of `data.js`) at a
  time, and only an entry both changed differently is refused, by name
  (`mergeRegions`). The page then takes the merged chart. A page that is
  behind when it opens says so then, rather than when Save is pressed.

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

Done once. Until it is, `api` in `src/app/00-config.js` points at nothing
and the site is read-only for everybody, the owner included.

The site's three addresses — `site`, the published origin; `api`, this
service; `repo`, the repository — are said once, in `src/app/00-config.js`,
and the build, the program and the suite all read them from there. The
service keeps its own copy in `worker/wrangler.toml` (`REPO`,
`ALLOWED_ORIGINS`), because Cloudflare deploys it from that file;
`tests/build_guard.py` fails if the two disagree. Publishing the chart from
another account or repository is a matter of changing those two files.

1. **Cloudflare.** Make a free account and open *Workers & Pages* once, which
   gives the account its `*.workers.dev` subdomain. The service will live at
   `https://<worker name>.<subdomain>.workers.dev` — here
   `https://rhizome-api.wowwodptr2.workers.dev`, which is what
   `api` in `src/app/00-config.js` names. Another account or Worker name
   means changing it there and `name` in `worker/wrangler.toml`.
2. **A GitHub App** (GitHub → Settings → Developer settings → GitHub Apps →
   New). Homepage: the site. Callback URL:
   `https://rhizome-api.wowwodptr2.workers.dev/callback`. Keep *Expire user
   authorization tokens* on. Webhook: off. Repository permissions:
   **Contents — Read and write** and **Issues — Read and write**, nothing
   else. Installable only on this account. Generate a client secret, then
   **Install** it on this repository only. (An app made before suggestions
   existed has Contents alone: add Issues on the app's Permissions page, and
   GitHub then asks the installation to accept it — until it does, the
   service names the missing permission when somebody posts.)
3. **Deploying.** Either of two ways, not both:
   - *From CI.* A Cloudflare API token from the *Edit Cloudflare Workers*
     template, and the account id, as the repository secrets
     `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Every push to `main`
     then deploys `worker/`; without them that job says so and does nothing.
   - *From Cloudflare*, by importing the repository as a Worker. Its **root
     directory must be `worker`**; the default build (`npm run build`) and
     deploy (`npx wrangler deploy`) commands then work as they are. The
     Worker's name in the dashboard has to be `name` in
     `worker/wrangler.toml`, or the build refuses. Left at the repository's
     root, Cloudflare
     finds no Worker there, decides `src/` is a static site and publishes the
     sources as a second copy of the chart — which deploys successfully and
     is not the write service at all.
4. **The service's own secrets**, in Cloudflare (Worker → Settings →
   Variables and Secrets): `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from
   the app, and `SESSION_SECRET`, any random string of 32 characters or more
   (`openssl rand -hex 32`). They stay in Cloudflare; a deploy does not touch
   them, and nobody else needs to see them.

`worker/wrangler.toml` holds the rest: the repository, the branch, the owner
logins and the site's address.

### What the site counts, and what it is told

**Visitors.** The site can count its visits with Cloudflare Web Analytics,
which sets no cookie and keeps nothing in the reader's browser, so there is
nothing to ask anyone's leave for. In Cloudflare: *Analytics & Logs → Web
Analytics → Add a site*, the site's address, and take the token from the
snippet it offers (pasting the whole snippet works too: the build takes the token out of it). In GitHub: *Settings → Secrets and variables → Actions →
Variables*, a repository **variable** (not a secret: it is printed into every
page) named `CF_WEB_ANALYTICS_TOKEN`. The next publish carries the counter;
without the variable the site has none, and neither does a fork, a local
build or an exported copy — it is written beside the preview tags, outside
the page's markers.

**Faults.** A fault a reader's browser meets on the site — an exception, or
a promise nobody caught — is sent to the write service (`POST /report`),
which writes it to the Worker's log: Cloudflare, the Worker, *Logs*
(`[observability]` in `worker/wrangler.toml` keeps them). Each line is the
message, the program file and the place in it, the stack, the version and
the browser; never the session. A page sends at most five, each once. The
program on the site is minified, so a place reads as line and column of
`app.<hash>.js`; its source map is beside it, `app.<hash>.map`, and the
stack still names the functions, which minification leaves as they are.

## Where the chart's contents actually live

In `src/data.js`, between its `@@EDIT@@` markers:

```
/* @@EDIT:NODES:START@@ */      the entries
/* @@EDIT:EDGESTYLES:START@@ */ per-connector styling
/* @@EDIT:STICKERS:START@@ */   the sticker library
/* @@EDIT:MEDIA:START@@ */      pictures and clips in comments
/* @@EDIT:TAGCATS:START@@ */    tag categories
/* @@EDIT:REFS:START@@ */       the reference list
/* @@EDIT:SETTINGS:START@@ */   chart-wide settings
/* @@EDIT:COMMENTS:START@@ */   suggestions (feature currently switched off)
```

**Save** on the published site commits those regions to the repository
through the write service, so the repository is current by construction, and
a build makes the page from `src/` and nothing else.

It used to be two places. A copy published on claude.ai saved by rewriting
its own page, so the newest chart lived in a page nobody had committed; a
build carried the chart over from the `dist/nexus.html` it replaced,
`build.py --pull` brought it back into the sources by hand, and
`tools/data_check.py` asked whether the two had drifted. As of 0.22.0 that
copy is gone, and all of that with it.

## How an entry is written

Each entry in `src/data.js` is a record with its fields named:

```js
{id:'uprising-copy', label:'Beast Wars: Uprising', parent:'uprising', pos:[450, 90], colors:['#20242b'], border:'dashdot'},
```

`parent` is one id or a list of them, and the entry's options — position,
colours, tags, link, picture — stand beside the fields rather than in a
nested object. `SETTINGS.format` is the number of the form (2; the list by
position that charts were written in before is 1, and is still read). A
file from a page that writes a higher number is refused at import rather
than half-read. Inside the page an entry is still the positional list, so
nothing but reading and writing the file changed.

## Pictures beside the page

On the site a picture or a clip is a file of its own in `src/media/`, named
`<sha256 of its bytes>.<ext>`, and the chart names it by that path
(`media/…`) where it used to carry the bytes as base64. The build copies the
folder to `dist/media/`, and CI stages it beside `index.html`; an `<img>` or
an SVG `<image>` given the path fetches it from there, so the drawing does
not need to know.

- **Nothing has to be converted by hand.** A Save on the site lifts every
  embedded picture larger than 2 KB out of the regions it sends, and sends
  the files with them, once per page. The first Save after this change moves
  what `src/data.js` still embeds into `src/media/`; from then on the page
  and every Save carry paths only. A tiny picture stays embedded, as does a
  type with no file extension the page knows.
- **The write service checks every file.** It refuses one whose bytes are
  not what its name says, and a save whose chart names a path that is in
  neither the repository nor the save. A file already in the folder is not
  written again. The commit is still one commit, chart and pictures together.
- **What leaves the site carries the bytes.** Export, Export data and the
  PNG/SVG picture fetch each path and write the picture back in, so a copy
  opened from a disk needs no folder beside it.
- **With no signal**, the service worker keeps every picture it has served,
  first come, and answers from that copy: a name is what its bytes are, so a
  kept copy is never behind.
- A push that changes only `src/data.js` and `src/media/` is a Save, and is
  published without the checks, as before.

## Working on it locally

```bash
python3 -m http.server 8000 --directory src
```

Everything works offline. Served like this the page is your own copy, so
**Save** keeps the chart in this browser.


## Running it anywhere

The chart does not need any server. `dist/nexus.html`
is a complete document: put it on any web space, or open it straight off a disk, and it works —
the same archetypes, the same routing, the same editing. Nothing loads from a network. (The two
webfonts do, when a network is there; without one the page falls back to system faces and is
otherwise unchanged.)

What changes is only where **Save** writes:

| Where the page is open | What Save does |
| --- | --- |
| The published site, signed in as the owner | commits the chart to the repository; the site shows it after CI |
| The published site, anyone else | nothing — the page is a reader there |
| Any other host, or `file://` | keeps the chart in that browser, keyed to the page's own address |

The page decides this at load time from its own address, and the **File**
panel states in words which applies, so the answer is never a guess.

### Export and Import

A browser's storage belongs to one browser on one machine, so it is a place to keep work, not a
way to move it. **Export** is the way to move it: it writes out a full, self-contained copy of
the page with the current chart baked into it. That file is not a data file — it is the chart,
openable anywhere, with nothing to import. **Import** is the other direction, lifting the chart
out of such a file into the page you have open; it validates before it replaces anything, and
refuses a file that holds no chart rather than half-loading it.

What gets **exported** is always a real document, because a file on disk has no host to wrap it —
and so is the build.

## Suggestions

On the published site a reader can say that an entry is wrong, missing or
not wanted: the speech-bubble button in the top bar, or the same button beside an entry's
title. A suggestion is not kept in the chart. It becomes an **issue in this
repository**, written under the reader's own GitHub account, which is why
posting one asks the reader to sign in with GitHub — the same sign-in the
owner uses, asked for as a reader's.

Kept in the chart, every suggestion would be a commit: a rebuild of the
site, and the owner's open page suddenly behind the repository and refused
at Save. As an issue it disturbs nothing, GitHub tells the owner, and
somebody who misuses it is blocked with GitHub's own button.

- **The GitHub App has to be public** (its settings → Advanced → Make
  public). A private app can be authorized only by its owner; anyone else
  pressing Sign in gets GitHub's 404. Public means anyone may sign in
  through it, not that it reaches more: what it can touch is still decided
  by where it is installed, and that is this repository alone.
- A reader's session opens the suggestions and nothing else. The write
  service checks on every request that Save and closing a suggestion come
  from a login in `OWNERS`. The page's one Sign in asks for a reader's
  session, which the service makes the owner's when the account is one.
- What makes an issue a suggestion is a marker at the end of its text,
  naming the entry and the kind of change — not a label, because GitHub
  drops the labels of anyone who cannot push. An ordinary issue about the
  code is never listed, and never closed from the chart.
- **The open suggestions are public**, and so are their marks. A reader who
  is not signed in gets the list straight from GitHub's API, the same
  issues anyone can open on github.com, without the write service in
  between. GitHub answers an anonymous browser sixty times an hour, and
  past that the panel says so and offers sign-in, which lists them through
  the service instead. Posting still needs a sign-in.
- The owner sees the open suggestions in the same panel, with **Done** (a
  green circle with a tick) and **Decline** (a red square with a cross),
  closed as completed or as not planned, and a small numbered
  mark on every entry that has one open.
- Off the site — a disk, another host — there is no service to carry a
  suggestion, so neither button is shown.

The `COMMENTS` region is what the earlier, claude.ai-era suggestions were
kept in. Save, Export and Import still carry it, so a chart that has some
keeps them, but nothing writes to it any more.

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

## Seen from far away

`src/app/39-lod.js` is the chart's level of detail. The level is decided by
how tall an ordinary entry (the median) is on the screen: under 5 pixels each
cluster of entries sharing a tag is drawn as one patch of the tag's colour,
under 2.4 one patch per category. A cluster is entries of one tag within
`LOD_REACH` of each other (`LOD_CAT_REACH` for a category). The entries'
layers are `display:none` while the patches show, which is the saving; the
patches are drawn again only when the level or the chart changes. A tag's
colour is `SETTINGS.tagColors`, set on its square in the Tags list; scenery
tags have none.

## Arrays

`src/app/40-arrays.js` draws a frame round several entries. An array is an
entry, `[id, '', null, null, null, 'array', {members:[ids], …}]`, with no
position or size of its own: once its members are drawn, `fitArray` sets its
box round their outer rings with `2 * GRID` to spare, innermost array first,
and it is drawn through the same code as an entry's box into `#arrayLayer`,
under the connectors. Its look is `colors` (black by default, frame and
hatching both, half see-through), `border`, `square` and `hatch` (`diag-r`,
`diag-l`, `vert`, `horiz`); it has no ground. It is taken out of the layout,
the router's obstacles and the level of detail; its middle answers nothing,
so it is carried by a band either side of its frame, and a drag redraws it with
`renderNodes({arraysOnly: true})` rather than sliding it. Deleting entries
calls `pruneArrayMembers`, which drops an array left with no members.

## The chart as text

The drawing has no reading order, so the chart is also written out as a
document (`41-text-view.js`): a button in About this chart opens every
entry once, under the entry it comes from, with its tags, its note, what
each line into it says and its link. An entry with several parents is
listed under the first and names the others. Arrays, pictures, captions and
callouts are things drawn on the chart rather than entries, and are left
out, as the search leaves them out. A name opens its entry on the chart.

The list is built from the model at start-up and again after any edit while
it is open, so it is in the page for a screen reader and for a search engine
without anyone opening it. On the drawing itself each entry is one image
named by its words and tags, and the connectors, frames and scenery are
hidden from screen readers, since the list already says all of it in order.
The first Tab reaches a link that opens the list.

## A merge's bar

A merge is not an entry of its own kind. Two or more connectors into one
entry are merged from the connector's menu (press and hold, or a right
click: Merge / Unmerge), and the entry they meet in takes `opts.merge` —
`true` for every lineage it has or is given later, or the list of the ones
merged (`mergeMembersOf`, `isMergeNode`, `02-model.js`). Its border wears
the lineages' colours as a gradient unless it is given colours of its own.
Each stretch is a connector with its own line, paint, gradient and ends;
its end at the bar is `barEnd` ('out', 'oout' — an open head — or
'tout'), drawn at the end of that stretch, clear of the beads. A chart that still has
the old 'amalgam' entries opens with them as merges (`migrateAmalgams`,
form 3).

A bar is the lineages': `opts.bar = {k, after, lead}` on the merge says
which axis it is laid across, which side of the lineages, and how far beyond
them. It is written the first time anything of the merge is carried
(`fixAmalgamBars`) and after that the entry carried about moves only the
merged arrow. Until then `amalgamGeometry` works the place out as before. A
click on the bar picks it out and it is carried along the arrow
(`beginBarDrag`). The merged arrow's style is the `EDGE_STYLES` entry
`{from:'', to:<entry>}` (`isMergedArrow`); its colour, gradient and both
ends are its own, and left alone it carries every lineage's colour. It
bends as any connector does, its start port kept in `mergedArrowPorts`
for the bend handles. A selected lineage lights the way through the
stretches after its own (`.amalgam-through`, drawn only while lit) to the
merged arrow.

## Link nodes

An entry of shape `'link'` is a small round mark, half a portrait across
(`LINK_NODE_SIZE`), with an arrow on it. Its `link` is a copied
`#entry=` link, a link to the site with one, or a bare id
(`linkNodeTarget`, `19-selection-search.js`, which never answers the node
itself); a click goes there once a double click is plainly not coming,
and a double click opens its settings. It is how two entries far apart on
the chart are tied together without a connector across all of it. One
that goes nowhere draws its arrow faint, and the text view names it by
where it goes.

## Splits

A split is an entry of shape `'split'` (`isSplitNode`, `SPLIT_SIZE`): a
coloured dot set on a connector from its menu (`splitEdgeAt`,
`35-draw-out.js`), where the connector was pointed at or at the place on
offer near it (`splitFractionAt`, the same places `connectorSnaps`
offers a remark). The connector becomes two, into the dot and out of it,
each keeping the ends and look it had, and the next entry picked takes a
new line out of the dot (`beginSplitBranch`). Every connector on a side of
a dot meets it at that side's middle, so the lines leave as one line
forking. Read as a lineage a dot is looked through (`lineageParentsOf`,
`lineageChildrenOf`); deleting one hands its children to its parents.

## On a phone

The chart's gestures were all written for a mouse, and they were left that way.
`src/app/38-touch.js` turns a finger on the canvas into the mouse events those
gestures already listen for, so there is one mechanism for both and nothing
behaves differently under a finger. What a finger cannot say is which key is
held, so a **hold** says it: still for a moment and then moved, a finger off
the entries is Shift (the selection box) and on an entry is Ctrl (carried free
of the grid); a held tap on an entry is a Ctrl-click. Two fingers pan and zoom
about the point between them. Rows on the Tags and References tabs are picked
up by holding them, so a finger that just moves scrolls the list.

Handles a hovering pointer would wake are shown on the tapped or selected entry
once the page has been touched (`body.touch-input`). Below 720 pixels the top
bar becomes two rows, an open tab takes the screen and the entry drawer is a
sheet from the bottom. While a finger carries the chart up the top bar slides
away, and it comes back as the chart is carried down (`followWithPhoneBar`,
`18-canvas-gestures.js`); the view is moved by the height the bar gives up or
takes back in the same frame, so the chart does not jump under the finger.
The suite's "a phone" scenario drives all of it with raw touch points.

### On the home screen, with no signal

The site is an installable web app: in the phone's browser, *Add to Home
Screen* (Safari's Share menu, Chrome's ⋮ menu) puts it on the home screen with
its own icon, and it opens without the browser around it. It is the same page
as the site, so it can do exactly what the site can; there is no second
program to keep in step.

`src/site/sw.js` keeps a copy of the page on the phone. The page is always
asked of the network first and the copy used only when the network cannot
answer within a few seconds, because a copy that is behind the repository is
the one thing a Save must not be made from.

With no connection, an owner this phone has already seen signed in stays the
editor, and **Save** keeps the chart on the phone (the *outbox*, beside the
draft in IndexedDB). The page says so for as long as it is true. When the
connection comes back — or the app is brought back to the front — the kept
Save is sent by itself. If the repository moved on in the meantime (a save
from another device), it is refused like any save from a page that is
behind, and stays kept on the phone, where Export can take it as a file.

That needs a sign-in that outlives a day without signal. GitHub expires the
token inside a session after eight hours, so the session also carries
GitHub's refresh token, and the write service trades it for a new pair when
the token has run out, handing the page a new session with its answer. A
session not used for 30 days runs out (`SESSION_DAYS` in `worker/index.js`);
changing `SESSION_SECRET` ends every session at once. This is why the app's
*Expire user authorization tokens* must stay on — without it GitHub hands no
refresh token.

## Why there are no browser dialogs

`window.prompt` and `window.confirm` were unusable where the page began: the artifact viewer ran it
in a sandboxed frame without `allow-modals`, where `prompt()` returns `null` and `confirm()` returns
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

The page reads its own source in order to Export an edited copy of itself. Fetching its own URL is
the good way; a page opened from a disk cannot, which leaves only the live DOM — and that contains
whatever else was put in the document (on claude.ai, the **host's** runtime). Saving that embedded the host's runtime in the chart and
nested one document inside another; a downloaded copy carried references to things that were not
there. Either way the result was a page that rendered part of a chart and responded to nothing.

`build.py` therefore brackets everything the page is made of between `@@PAGE:BEGIN@@` and
`@@PAGE:END@@`, and `ownContent()` cuts between them. What comes out is this page's content and
nothing else, and it is a **fragment** by construction; Export wraps it in a document of its own.

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

    node tools/chart_check.js         # is it data and nothing else, and does it fit the schema
    node tests/worker.js              # the write service, against a GitHub in memory
    python3 tests/build_guard.py      # the built page against what src/ says
    python3 tools/lint.py             # the assembled program, reported per part
    node tests/regression.js          # against dist/nexus.html
    node tests/regression.js src      # against the split sources

The browser suite is 138 named scenarios, and they are independent of one
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
