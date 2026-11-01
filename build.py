#!/usr/bin/env python3
"""Assemble the split sources into the single self-contained page.

    python3 build.py                 build dist/ from src/

WHY A BUILD STEP AT ALL

A copy of the chart has to be one file — Export hands a person exactly one,
and it must open from their disk with nothing beside it — so the page is one
file with the CSS and JavaScript inside it. That is a bad way to WRITE the
thing, so the sources live apart — src/index.html, src/style.css,
src/chart.json, and the ordered parts in src/app/ — and this script welds them
into dist/nexus.html. The site is the same page with its program beside it
(build_site). See APP_PARTS for what "ordered" means and why it is not a
module system.

src/index.html is a real, standalone document: open it through any local
server and the chart runs, with the stylesheet and scripts loaded normally.
Only the built file has them inlined.

ONE OUTPUT

  dist/nexus.html        the chart, as a whole <!doctype html> document.

There used to be four: editable or read-only, fragment or document, because
whether a copy could be edited was decided here, at build time. It is decided
when the page is opened now (see SITE_CONFIG in src/app/00-config.js). On the
published site it is a reader until the owner signs in; opened off a disk or
served from anywhere else it is that person's own copy and saves into their
browser. One file, so there is no second copy to forget to republish.

WHERE THE CHART'S CONTENTS LIVE

In src/chart.json, and only there. Save on the site commits the chart to it
through the write service (worker/), so the repository is current by
construction, and a build is a function of src/ and nothing else.

It goes into the page as JSON in a script element a browser does not run
(chart_script), and the program reads it with JSON.parse. Until 0.23 it was
src/data.js, eight `const` statements written into the program's own script:
the chart was code on every reader's screen, and the write service needed a
parser of its own to be sure a save held nothing that would run.

It used to be otherwise. A copy published on claude.ai saved by rewriting
its own page, so the newest chart lived in a page nobody had committed, a
build carried the chart over from the dist/nexus.html it was replacing, and
`--pull` brought it back into the sources by hand. That copy is gone, and
the carrying, the pull, the backups it needed and tools/data_check.py went
with it: there is no second place for the chart to be ahead.
"""
import base64
import hashlib
import html
import json
import re
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).parent
SRC, DIST = ROOT / 'src', ROOT / 'dist'

# The program, in the order it is assembled.
#
# src/app/ holds one file per subsystem, and they are ORDERED: the page is one
# scope, built by writing these files out one after another, exactly as the
# single app.js used to read top to bottom. So this list is not a directory
# listing that happens to be sorted — it is the program's own order, and the
# only place it is written down. src/index.html loads the same files as
# separate scripts in the same order, and check_index_order below refuses to
# build if the two have drifted apart.
#
# What this split is NOT is a module system. Nothing here has its own scope,
# nothing imports anything, and no name changed meaning by moving. The proof
# is mechanical: the file this produces is byte for byte the file the single
# app.js produced.
APP_PARTS = [
    '00-config.js',
    '01-store.js',
    '02-model.js',
    '03-markup.js',
    '04-assets.js',
    '05-render-text.js',
    '06-edge-geometry.js',
    '07-router-ortho.js',
    '08-router-astar.js',
    '09-bends-ports.js',
    '10-decor.js',
    '11-edge-notes.js',
    '12-ports-draw.js',
    '13-render-nodes.js',
    '14-edges-draw.js',
    '15-amalgam.js',
    '16-tags.js',
    '17-ask-refs.js',
    '18-canvas-gestures.js',
    '19-selection-search.js',
    '20-about.js',
    '21-edit-model.js',
    '22-file-comments.js',
    '23-quick-edit.js',
    '24-rich-fields.js',
    '25-figures.js',
    '26-bio-crop.js',
    '27-sticker-ui.js',
    '28-media-ui.js',
    '29-editors.js',
    '30-node-editor.js',
    '31-free-menu.js',
    '32-guides-bends.js',
    '33-leader.js',
    '34-add-node.js',
    '35-draw-out.js',
    '36-site-owner.js',
    '37-style-bar.js',
    '38-touch.js',
    '39-lod.js',
    '40-arrays.js',
    '41-text-view.js',
]
PAGE_BEGIN = '<!-- @@PAGE:BEGIN@@ -->'
PAGE_END = '<!-- @@PAGE:END@@ -->'


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8')


def read_app():
    """The whole program, its parts written out in order."""
    missing = [n for n in APP_PARTS if not (SRC / 'app' / n).exists()]
    if missing:
        sys.exit(f'build: src/app/ is missing {", ".join(missing)}')
    stray = sorted(x.name for x in (SRC / 'app').glob('*.js')
                   if x.name not in APP_PARTS)
    if stray:
        # A file nobody listed is a file that is not in the program. That is
        # nearly always a new part someone forgot to add to APP_PARTS, and it
        # fails in the worst possible way — silently, as a function that is
        # simply not there — so it stops the build instead.
        sys.exit(f'build: src/app/ has {", ".join(stray)}, which APP_PARTS does not list')

    texts = [read(SRC / 'app' / n) for n in APP_PARTS]
    # The parts are written out with NOTHING between them, here and in the
    # loader in src/index.html, and that is only safe while every one of them
    # ends in a newline. They all do. Nothing made them, and the day one does
    # not, its last line and the next part's first line become one line: a
    # part ending in a `// comment` would comment out the beginning of the
    # part after it, and the program would be missing whatever that line
    # declared — silently, which is the failure this whole file is arranged
    # to prevent everywhere else.
    #
    # A separator would hide the problem rather than fix it, and would change
    # the bytes of a page that is checked against itself. So the invariant is
    # stated instead: end your part with a newline, as every editor does.
    ragged = [n for n, t in zip(APP_PARTS, texts) if t and not t.endswith('\n')]
    if ragged:
        sys.exit(f'build: {", ".join(ragged)} does not end with a newline. The parts\n'
                 '       are concatenated with nothing between them, so its last line\n'
                 "       would be joined to the next part's first one.")
    # The program is written out inside a <script> element, and an HTML
    # parser ends that element at the first closing script tag it meets —
    # in a string, in a regular expression, in a comment. Everything after
    # it would be read as markup and the program would be a syntax error
    # that names no part. A tag the program needs to write is spelled with
    # an escaped slash.
    closing = [n for n, t in zip(APP_PARTS, texts) if re.search(r'</script', t, re.I)]
    if closing:
        sys.exit(f'build: {", ".join(closing)} contains a closing script tag, which ends the\n'
                 '       page\'s <script> wherever it stands; write it with an escaped slash')
    return ''.join(texts)


def check_index_order(index):
    """src/index.html must run the same parts, in the same order.

    index.html is a real document you can open through a local server. It
    fetches the parts, joins them, and runs the result as ONE script — see the
    comment there for why separate <script> tags are not the same program. Its
    list and APP_PARTS have to agree, or the page you develop against and the
    page that gets published are two different programs; that is the one
    failure a split like this can introduce, so it is checked every build.
    """
    listed = re.findall(r"^\s*'([^']+\.js)',\s*$", index, re.M)
    if listed != APP_PARTS:
        extra = [n for n in listed if n not in APP_PARTS]
        absent = [n for n in APP_PARTS if n not in listed]
        why = ('order differs' if not extra and not absent
               else f'index has {extra or "-"}, is missing {absent or "-"}')
        sys.exit(f'build: src/index.html does not load src/app/ in APP_PARTS order ({why})')


def slice_between(text, begin, end, what):
    """The text between two markers, or a clear error naming what is wrong."""
    a = text.find(begin)
    b = text.find(end)
    if a < 0 or b < 0 or b < a:
        sys.exit(f'build: {what} — could not find {begin} … {end}')
    return text[a + len(begin):b]


SHA_META = 'rhizome-data-sha'


def favicon_link():
    """The tab's icon, "R·P" (src/favicon.png), written into the head.

    The owner's own drawing, byte for byte — not a redrawing of it. Inline
    as a data: address rather than a file beside the page, so it is the
    same wherever the page is opened (the site, a copy on disk, an export)
    and is never one more request that can fail."""
    png = (SRC / 'favicon.png').read_bytes()
    return ('<link rel="icon" type="image/png" href="data:image/png;base64,'
            + base64.b64encode(png).decode('ascii') + '">\n')


def wrap(page, head_extra=''):
    """A page's content, inside the document a browser needs around it."""
    return ('<!doctype html>\n<html lang="en">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            + favicon_link()
            + head_extra +
            '</head>\n<body>\n'
            + page +
            '</body>\n</html>\n')


def site_config():
    """The site's addresses — site, api, repo — as src/app/00-config.js says
    them. Read as text, one string to a line, so the build need not run the
    program to learn where it will be published."""
    text = read(SRC / 'app' / '00-config.js')
    found = dict(re.findall(r"^\s*(site|api|repo): '([^']*)',?\s*$", text, re.M))
    if not found.get('site') or 'repo' not in found or 'api' not in found:
        sys.exit('build: src/app/00-config.js does not say site, api and repo '
                 'as one quoted string to a line')
    return found


def site_origin():
    """The published site's address, as the program names it."""
    return site_config()['site']


# The esbuild that minifies the site's program and stylesheet is pinned in
# package.json, so the same sources always give the same bytes and so the
# same file names. ESBUILD names another copy (CI's deploy job installs one
# on its own, without the browsers and linters the tests need, and must pin
# the same version).


def esbuild_path():
    for cand in (os.environ.get('ESBUILD'), ROOT / 'node_modules' / '.bin' / 'esbuild',
                 shutil.which('esbuild')):
        if cand and Path(cand).exists():
            return str(cand)
    return None


def minify_for_site(text, kind):
    """The site's program or stylesheet as a reader's browser needs it.

    Nearly half of the program's text is comments, written for whoever works
    on it next and worth keeping there; a reader's browser downloads them and
    throws them away. Minified, the program goes from ~490 to ~200 KB gzipped
    and the stylesheet from ~60 to ~29. Only whitespace and syntax are
    touched, never names: the program is one script whose top-level names
    every part reads, and the tests call them by name.

    The program gets a source map beside it, so a stack trace from a
    reader's browser can still be read against the source. Without esbuild
    the files go out as they are — locally that is fine, and CI says it must
    have one (RHIZOME_MINIFY=required), so the site is never published
    unminified by accident.

    Returns (text, map_text or None)."""
    exe = esbuild_path()
    if not exe:
        if os.environ.get('RHIZOME_MINIFY') == 'required':
            sys.exit('build: esbuild is required to build the site (npm install)')
        return text, None
    with tempfile.TemporaryDirectory() as d:
        src = Path(d) / f'app.{kind}'
        out = Path(d) / f'out.{kind}'
        src.write_text(text, encoding='utf-8')
        args = [exe, str(src), f'--outfile={out}', '--charset=utf8', '--legal-comments=none', '--log-level=error']
        if kind == 'js':
            args += ['--minify-whitespace', '--minify-syntax', '--sourcemap=external', '--sources-content=true']
        else:
            args += ['--minify']
        r = subprocess.run(args, capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f'build: esbuild could not minify the site\'s {kind}:\n{r.stderr}')
        mini = out.read_text(encoding='utf-8')
        mapped = Path(str(out) + '.map')
        smap = mapped.read_text(encoding='utf-8') if mapped.exists() else None
    # The program is put back inside a <script> when the site exports itself
    # (inlineSiteFiles), and the parser ends that element at the first
    # closing tag it meets, wherever it stands.
    if kind == 'js' and re.search(r'</script', mini, re.I):
        sys.exit('build: the minified program contains a closing script tag')
    return mini, smap


VERSION_LOG_OPEN = 'const VERSION_LOG = ['
VERSION_LOG_CLOSE = '\n];\n'   # the first line that is only a closing bracket


def lift_version_log(app_js):
    """The program with its version log taken out, and the log as a file.

    The log is ~86 KB of the program, 30 KB of it gzipped — a seventh of
    what a reader downloads before the chart can be touched — and it is
    shown only when someone unfolds the history in About. So on the site
    it is a file beside the program, named by its bytes like the program,
    and the program holds that name in its place (renderVersionInfo,
    20-about.js). The file is the literal as JSON (js_literal_json), which
    the page reads as data; an export puts it back where the name stands
    (inlineSiteFiles), where JSON is an expression like the literal was.
    """
    start = app_js.find(VERSION_LOG_OPEN)
    end = app_js.find(VERSION_LOG_CLOSE, start)
    if start < 0 or end < 0 or app_js.find(VERSION_LOG_OPEN, start + 1) >= 0:
        sys.exit('build: 20-about.js has no single `const VERSION_LOG = [` closed by a line '
                 'of its own, so the site cannot carry the log beside the program')
    end += 2
    literal = js_literal_json(app_js[start + len(VERSION_LOG_OPEN) - 1:end])
    name = f'versions.{hashlib.sha256(literal.encode("utf-8")).hexdigest()[:16]}.js'
    return (app_js[:start] + f'const VERSION_LOG = "{name}"' + app_js[end:], name, literal)


def js_literal_json(literal):
    """The version log, which the source writes as a JavaScript literal, as JSON.

    The site's page reads the file with JSON.parse. It used to run it, with
    Function(), and a page that may run text as code cannot have a
    Content-Security-Policy that keeps a stray script from reading the
    owner's session (site_policy). JSON is also an expression, so an export
    still puts the file back where its name stands and has a program.

    Only what the log is written with is read: arrays, objects with bare
    keys, single-quoted strings with \\u escapes. Anything else stops the
    build and says where, rather than being guessed at.
    """
    out, at, n = [], 0, len(literal)
    token = re.compile(r"\s+|[\[\]{},:]|[A-Za-z_]\w*(?=\s*:)|'((?:[^'\\\n]|\\u[0-9a-fA-F]{4}|\\['\\])*)'")
    while at < n:
        m = token.match(literal, at)
        if not m:
            line = literal.count('\n', 0, at) + 1
            sys.exit(f'build: the version log has something at its line {line} that is not '
                     f'an array, an object, a bare key or a single-quoted string: {literal[at:at + 40]!r}')
        text = m.group(0)
        if m.group(1) is not None:
            raw = re.sub(r"\\u([0-9a-fA-F]{4})|\\(['\\])",
                         lambda e: chr(int(e.group(1), 16)) if e.group(1) else e.group(2), m.group(1))
            # An emoji is written as its two halves, \ud83d\ude00; joined here.
            raw = raw.encode('utf-16', 'surrogatepass').decode('utf-16')
            # "<" stays escaped, as in the chart's element (chart_script): an
            # export puts this text back inside a <script>.
            out.append(json.dumps(raw, ensure_ascii=False).replace('<', '\\u003c')
                       .replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'))
        elif text[0].isalpha() or text[0] == '_':
            out.append(json.dumps(text))
        else:
            out.append(text)
        at = m.end()
    # A comma before a closing bracket is allowed in the source, not in JSON.
    for i, t in enumerate(out):
        if t == ',':
            k = next((k for k in range(i + 1, len(out)) if out[k].strip()), None)
            if k is not None and out[k] in (']', '}'):
                out[i] = ''
    text = ''.join(out)
    json.loads(text)   # what was read is what JSON reads
    return text


def chart_script(text):
    """src/chart.json as the page carries it: a JSON script element.

    The file has to be JSON that parses — the page reads it with JSON.parse
    and nothing else, so a file that does not would make a page with no
    chart in it, published. And it has to be an object with its entries in
    `nodes`, which is the least the page reads a chart from. What else it
    holds is the schema's to say (tools/chart_check.js, in CI).

    Inside a script element the HTML parser ends the element at the first
    closing script tag it meets, string or not, and "<!--" changes how the
    rest is read. So every "<" is written \\u003c, which JSON reads back as
    the same character; outside a string a JSON text has no "<" to change.
    The page does the same when it writes the chart into an export
    (chartForScript, src/app/20-about.js). U+2028 and U+2029 are escaped
    with it, as the page escapes them.
    """
    try:
        data = json.loads(text)
    except ValueError as e:
        sys.exit(f'build: src/chart.json is not JSON that parses: {e}')
    if not isinstance(data, dict) or not isinstance(data.get('nodes'), list):
        sys.exit('build: src/chart.json is not a chart: it has no list of entries under "nodes"')
    body = (text.rstrip('\n').replace('<', '\\u003c')
            .replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'))
    return f'<script type="application/json" id="{CHART_ID}">\n{body}\n</script>'


# The id of the chart's element. The program finds it by this name
# (CHART_ELEMENT_ID, src/app/01-store.js), and the build refuses a program
# that does not.
CHART_ID = 'chart-data'


def build_site(head_rest, css, body, chart, app_js, data_sha):
    """dist/site/: the published site, as CI puts it on Pages.

    The same page as dist/nexus.html but for where the program and the
    stylesheet are: beside it, in files named by the hash of their bytes,
    instead of inside it. A Save on the site changes src/chart.json and nothing
    else, and Pages publishes the result at once — so with everything in one
    file, every Save made every reader download the whole program again, a
    megabyte and a half of it, to see a chart of a few kilobytes change.
    Named by their bytes, the program and the stylesheet are the same files
    until the code changes, and a browser that has them keeps them.

    Only here. A copy that leaves the site — Export, the page on claude.ai,
    a file opened from a disk — is one file as before: the page puts the two
    back inside it when it reads its own source (inlineSiteFiles,
    src/app/20-about.js), which is why the tags carry data-inline.
    """
    out = DIST / 'site'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    sizes = {}
    names = {}
    app_js, log_name, log_text = lift_version_log(app_js)
    (out / log_name).write_text(log_text, encoding='utf-8')
    for kind, text in (('app', app_js), ('style', css)):
        ext = 'js' if kind == 'app' else 'css'
        text, smap = minify_for_site(text, ext)
        if smap:
            # Named by the program it maps, before the line naming it is
            # added — that line is part of the bytes the program is named by.
            map_name = f'{kind}.{hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]}.map'
            (out / map_name).write_text(smap, encoding='utf-8')
            text = text.rstrip('\n') + f'\n//# sourceMappingURL={map_name}\n'
        name = f'{kind}.{hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]}.{ext}'
        (out / name).write_text(text, encoding='utf-8')
        names[kind] = name
        sizes[kind] = len(text)
    charset = '<meta charset="utf-8">'
    content = (f'{charset}\n{PAGE_BEGIN}\n{head_rest}\n\n'
               f'<link rel="stylesheet" href="{names["style"]}" data-inline>{body}\n\n'
               f'{chart}\n'
               f'<script src="{names["app"]}" data-inline></script>\n{PAGE_END}\n')
    origin = site_origin()
    # What a link to the site shows when it is pasted into a chat. Only the
    # site's own document says it: an exported copy is cut out between the
    # markers and is nobody's address.
    preview = (
        site_policy(content, bool(analytics_beacon()))
        + f'<meta name="{SHA_META}" content="{data_sha}">\n'
        f'<meta name="description" content="{html_attr(OG_DESCRIPTION)}">\n'
        '<meta property="og:type" content="website">\n'
        f'<meta property="og:site_name" content="{html_attr(OG_TITLE)}">\n'
        f'<meta property="og:title" content="{html_attr(OG_TITLE)}">\n'
        f'<meta property="og:description" content="{html_attr(OG_DESCRIPTION)}">\n'
        f'<meta property="og:url" content="{origin}/">\n'
        f'<meta property="og:image" content="{origin}/{OG_IMAGE}">\n'
        '<meta property="og:image:width" content="1200">\n'
        '<meta property="og:image:height" content="630">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        + analytics_beacon())
    page = wrap(content, preview)
    (out / 'index.html').write_text(page, encoding='utf-8')
    site_files = SRC / 'site'
    for f in sorted(site_files.iterdir()):
        if f.name == 'chart.schema.json':
            # A schema names itself by where it is published, and that is
            # the site's address in 00-config.js, not the one the file was
            # written with — a copy published elsewhere names its own.
            schema = re.sub(r'("\$id":\s*")[^"]*(/chart\.schema\.json")',
                            lambda m: m.group(1) + origin + m.group(2),
                            read(f), count=1)
            (out / f.name).write_text(schema, encoding='utf-8')
        elif f.is_file():
            shutil.copyfile(f, out / f.name)
    if not (out / OG_IMAGE).exists():
        sys.exit(f'build: src/site/{OG_IMAGE} is missing; the preview names it (tools/og-image.js makes it)')
    print(f'  dist/site/index.html   {len(page):>8,} chars, '
          f'{names["app"]} {sizes["app"]:,}, {names["style"]} {sizes["style"]:,}'
          + ('' if esbuild_path() else ' (not minified: no esbuild)'))


def site_policy(content, counted):
    """The site's Content-Security-Policy, as a <meta>: Pages sends no headers.

    The owner's session is in localStorage, and it opens a GitHub token
    that can write to the repository. Any script that runs on the site's
    origin can read it, so the policy is about which scripts may run: the
    site's own files, Cloudflare's counter when there is one, and the few lines the page
    carries inline, each by the hash of its text — the font stylesheet's
    onload, found in the page rather than listed here, and the prerendered
    drawing's placement, which tools/prerender.js adds when it writes it.
    Nothing may be run from a string (no 'unsafe-eval'), nothing embedded,
    no <base>, no form sent anywhere. Requests go to the site, the write
    service, GitHub's API (the suggestions list), the fonts and the counter.

    Styles may be inline: the page sets hundreds of them as it draws, and a
    style cannot read localStorage. Pictures may come from anywhere on
    https, since an entry's picture may be any address.

    Outside the page's markers, like the preview: an exported copy runs its
    program inline and would be refused by it.
    """
    api = site_config()['api'].rstrip('/')
    handlers = sorted(set(re.findall(r'<[^>]*\son[a-z]+=(?:"([^"]*)"|\'([^\']*)\')', content)))
    hashes = ' '.join(f"'sha256-{base64.b64encode(hashlib.sha256(html.unescape(a or b).encode('utf-8')).digest()).decode()}'"
                      for a, b in handlers)
    policy = '; '.join([
        "default-src 'self'",
        "script-src 'self'" + (' https://static.cloudflareinsights.com' if counted else '')
        + (f" 'unsafe-hashes' {hashes}" if hashes else ''),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "media-src 'self' data: blob: https:",
        f"connect-src 'self' {api} https://api.github.com https://fonts.googleapis.com"
        " https://fonts.gstatic.com" + (' https://cloudflareinsights.com' if counted else ''),
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ])
    return f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n'


def analytics_beacon():
    """Cloudflare Web Analytics, when the site has a token for it.

    It counts visits without a cookie and without anything kept in the
    reader's browser, so there is nothing to ask a reader's leave for. The
    token comes from the environment (CI passes the repository variable
    CF_WEB_ANALYTICS_TOKEN) rather than from the sources, so a fork, a local
    build and the tests have no counter; and it sits beside the preview
    tags, outside the page's markers, so an exported copy never counts its
    holder's visits on the owner's account.
    """
    token = os.environ.get('CF_WEB_ANALYTICS_TOKEN', '').strip()
    if not token:
        return ''
    # Cloudflare offers the token inside a whole <script> snippet, and the
    # snippet is what gets pasted. Take the token out of it rather than fail
    # the publish over it: only the token is ever written into the page.
    pasted = re.search(r'"token"\s*:\s*"([^"]*)"', token)
    if pasted:
        token = pasted.group(1).strip()
    if not re.fullmatch(r'[0-9A-Za-z]{16,64}', token):
        sys.exit('build: CF_WEB_ANALYTICS_TOKEN is not a Web Analytics token')
    return ('<script defer src="https://static.cloudflareinsights.com/beacon.min.js"'
            f' data-cf-beacon=\'{{"token": "{token}"}}\'></script>\n')


OG_TITLE = 'Rhizome Project'
OG_DESCRIPTION = 'A cartography of crossed realities: an interactive chart of Transformers continuity.'
OG_IMAGE = 'og-image.png'


def html_attr(text):
    return (text.replace('&', '&amp;').replace('"', '&quot;')
            .replace('<', '&lt;').replace('>', '&gt;'))


def build():
    index = read(SRC / 'index.html')
    check_index_order(index)
    head = slice_between(index, '<!-- @@HEAD:BEGIN@@ -->', '<!-- @@HEAD:END@@ -->',
                         'src/index.html head block').strip('\n')
    body = slice_between(index, '<!-- @@BODY:BEGIN@@ -->', '<!-- @@BODY:END@@ -->',
                         'src/index.html body block').rstrip('\n')
    css = read(SRC / 'style.css')
    chart = chart_script(read(SRC / 'chart.json'))
    app_js = read_app()

    # Markers around everything the page is made of.
    #
    # The page has to be able to read its own source back, to Export an
    # edited copy of itself. Fetching its own URL is the good way, but a
    # page opened from a disk cannot, and the fallback — serialising the
    # live DOM — hands back whatever else is in the document by then (an
    # extension's script, the analytics beacon on the site), not just us.
    #
    # These markers make the fallback exact: the page can cut out its own
    # content and nothing else. The opening marker goes AFTER the charset
    # meta, not before it.
    #
    # A comment that appears before <html> is attached to the document, not
    # to <head>, and documentElement.outerHTML starts at <html> — so a
    # marker in the first line is simply not there when the page serialises
    # itself, which is the one situation it exists for. After the first
    # element the parser is inside <head> and keeps it.
    charset = '<meta charset="utf-8">'
    head_rest = head[len(charset):].lstrip('\n') if head.startswith(charset) else head
    page = (f'{charset}\n{PAGE_BEGIN}\n{head_rest}\n\n<style>{css}</style>{body}\n\n'
            f'{chart}\n<script>\n{app_js}</script>\n{PAGE_END}\n')

    # Which chart.json this page was built from, as git names it: the blob id
    # of the file's bytes. The write service compares it with the file in
    # the repository before it commits a save, so a page that is behind the
    # repository cannot write an older chart over a newer one. In CI — the
    # only place the site is built — the page's data IS this file.
    #
    # It goes in the wrapper's <head>, outside the page's markers, and the
    # program reads it from there (DATA_SHA, src/app/01-store.js). Written
    # into the program it would make the program different after every Save,
    # and on the site the program is a file named by its hash, kept by every
    # reader's browser for exactly as long as it does not change.
    raw = (SRC / 'chart.json').read_bytes()
    data_sha = hashlib.sha1(b'blob %d\0' % len(raw) + raw).hexdigest()
    if f"CHART_ELEMENT_ID = '{CHART_ID}'" not in app_js:
        sys.exit(f'build: the program does not read the chart from #{CHART_ID}; see CHART_ELEMENT_ID in src/app/01-store.js')
    if SHA_META not in app_js:
        sys.exit(f'build: the program does not read <meta name="{SHA_META}">; see DATA_SHA in src/app/01-store.js')

    # The document skeleton a browser needs. The markers stay around exactly
    # the same content they always did, so the page cuts itself out of this
    # document the same way it cut itself out of a fragment. The charset is
    # repeated in the wrapper's own head because one declared from inside
    # <body> is read too late to count.
    page = wrap(page, f'<meta name="{SHA_META}" content="{data_sha}">\n')

    DIST.mkdir(exist_ok=True)
    (DIST / 'nexus.html').write_text(page, encoding='utf-8')
    print(f'  dist/nexus.html        {len(page):>8,} chars')

    build_site(head_rest, css, body, chart, app_js, data_sha)

    # The pictures beside the page. On the site the chart names them by path
    # (media/<sha256>.<ext>, see MEDIA_REF in src/app/04-assets.js) rather
    # than carrying them inside, so the page needs the folder next to it —
    # here for a build opened from disk or the test server, and on Pages,
    # where CI stages it beside index.html. A name is what its bytes are, so
    # a file already there with that name is already right; nothing here is
    # ever deleted, because dist/ is never the only copy of a picture.
    media = SRC / 'media'
    if media.is_dir():
        (DIST / 'media').mkdir(exist_ok=True)
        copied = 0
        for f in sorted(media.iterdir()):
            if f.is_file() and not (DIST / 'media' / f.name).exists():
                shutil.copyfile(f, DIST / 'media' / f.name)
                copied += 1
        count = sum(1 for f in media.iterdir() if f.is_file())
        print(f'  dist/media/            {count:>8,} files' + (f', {copied} new' if copied else ''))

    # The files the other three builds used to be. Left behind by an older
    # build they would still be sitting in dist/, looking current, and one of
    # them is exactly the file somebody would reach for to publish.
    for gone in ('nexus-share.html', 'nexus-standalone.html', 'nexus-share-standalone.html'):
        if (DIST / gone).exists():
            (DIST / gone).unlink()
            print(f'  removed dist/{gone}, which this build no longer makes')


if __name__ == '__main__':
    # It takes no arguments. It used to take --pull, --partial and --force,
    # for carrying the chart out of a copy saved on claude.ai; a script that
    # quietly ignored one of those now would let someone believe it had run.
    if sys.argv[1:]:
        sys.exit(f'build: takes no arguments, and was given {" ".join(sys.argv[1:])}.\n'
                 '       The chart is src/chart.json; there is nothing to pull it from.')
    print('building…')
    build()
    print('done')
