#!/usr/bin/env python3
"""Where this copy of the platform lives, worked out from where it runs.

    python3 tools/where.py          prints key=value, one to a line

CI runs it before it publishes anything (the `where` job in ci.yml), and
everything that publishes — the site's build, the chart it draws, the write
service and what the service is told — takes its answers from here.

WHY

The platform is meant to be forked: somebody forks the repository, gives it
their keys, and gets a site of their own. Until 0.28.0 the fork also had to
write its own addresses into src/app/00-config.js and worker/wrangler.toml,
and every "Sync fork" afterwards met our lines in both. Nearly everything in
those two files can be known from where the copy runs, so it is worked out
here instead, and a fork changes no file of ours:

  repo     the repository this runs in (GITHUB_REPOSITORY)
  site     where Pages serves it: https://<owner>.github.io for a repository
           named <owner>.github.io, https://<owner>.github.io/<name> for any
           other — or the variable RHIZOME_SITE, for a domain of one's own
  api      the write service on the copy's own Cloudflare account,
           https://<worker>.<subdomain>.workers.dev, the subdomain asked of
           Cloudflare with the copy's own token — or RHIZOME_API. With no
           Cloudflare secrets there is no service: '' (read-only for all)
  data     where the chart is kept, owner/name/path/chart.json@branch — the
           variable RHIZOME_DATA, or data/chart.json in this repository (in
           the original, src/chart.json, as 00-config.js says). Not there
           yet, it is an empty chart, and the first Save makes it
  owners   who may edit: RHIZOME_OWNERS, or the repository's owner
  editors  RHIZOME_EDITORS, or nobody

Repository variables, not files, because a fork does not copy variables: a
fork can never inherit where our chart is kept, or who may edit ours.

THIS REPOSITORY

The repository 00-config.js names is the one whose values those files hold,
and for it the files are the answer (with any variable it sets on top) —
so this changes nothing about how the original is published.
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RE = re.compile(r'([\w.-]+/[\w.-]+)/((?:[^@\s/]+/)*[^@\s/]+\.json)(?:@([^@\s]+))?')


def config_file():
    text = (ROOT / 'src' / 'app' / '00-config.js').read_text(encoding='utf-8')
    return dict(re.findall(r"^\s*(site|api|repo|data): '([^']*)',?\s*$", text, re.M))


def toml_var(name):
    text = (ROOT / 'worker' / 'wrangler.toml').read_text(encoding='utf-8')
    m = re.search(r'^\s*' + name + r'\s*=\s*"([^"]*)"', text, re.M)
    return m.group(1) if m else ''


def pages_address(repo):
    owner, name = repo.split('/', 1)
    host = owner.lower() + '.github.io'
    return 'https://' + host if name.lower() == host else f'https://{host}/{name}'


def workers_subdomain(token, account):
    """The account's *.workers.dev subdomain, as Cloudflare says it. None when
    it cannot be asked or will not say — then there is no service to name."""
    req = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/accounts/{account}/workers/subdomain',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            got = json.load(res)
        return (got.get('result') or {}).get('subdomain') or None
    except Exception as e:  # noqa: BLE001 — any failure means "not known"
        print(f'::warning::Cloudflare did not say the account\'s workers.dev subdomain ({e}); '
              'set the variable RHIZOME_API to the write service\'s address', file=sys.stderr)
        return None


def where(env):
    var = lambda name: (env.get(name) or '').strip()
    repo = var('GITHUB_REPOSITORY')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
        sys.exit('where: GITHUB_REPOSITORY does not name a repository')
    branch = var('DEFAULT_BRANCH') or 'main'
    cf = bool(var('CLOUDFLARE_API_TOKEN') and var('CLOUDFLARE_ACCOUNT_ID'))
    file = config_file()
    upstream = file.get('repo', '').lower() == repo.lower()

    if upstream:
        site, api = file['site'], file['api']
        data = file.get('data') or f'{repo}/src/chart.json@{branch}'
        owners, editors = toml_var('OWNERS'), toml_var('EDITORS')
    else:
        site = pages_address(repo)
        api = ''
        if cf:
            sub = workers_subdomain(var('CLOUDFLARE_API_TOKEN'), var('CLOUDFLARE_ACCOUNT_ID'))
            if sub:
                api = f"https://{toml_var_name()}.{sub}.workers.dev"
        # Not src/chart.json, which is the chart of the repository forked:
        # a fork's own chart starts as no file at all, an empty chart, and
        # its first Save makes data/chart.json.
        data = f'{repo}/data/chart.json@{branch}'
        owners, editors = var('GITHUB_REPOSITORY_OWNER') or repo.split('/')[0], ''
    # A variable the repository sets wins over all of the above, here too.
    site = (var('RHIZOME_SITE') or site).rstrip('/')
    api = (var('RHIZOME_API') or api).rstrip('/')
    data = var('RHIZOME_DATA') or data
    owners = var('RHIZOME_OWNERS') or owners
    editors = var('RHIZOME_EDITORS') or editors

    m = DATA_RE.fullmatch(data)
    if not m:
        sys.exit(f'where: RHIZOME_DATA must say owner/name/path/chart.json@branch, not {data!r}')
    data_repo, data_path, data_branch = m.group(1), m.group(2), m.group(3) or branch
    data = f'{data_repo}/{data_path}@{data_branch}'
    origin = re.match(r'https?://[^/]+', site)
    if not origin:
        sys.exit(f'where: the site\'s address is not one: {site!r}')
    here = data_repo.lower() == repo.lower()
    return {
        'repo': repo, 'site': site, 'api': api, 'data': data,
        'owners': owners, 'editors': editors, 'origins': origin.group(0),
        'upstream': str(upstream).lower(),
        'data_repo': data_repo, 'data_path': data_path, 'data_branch': data_branch,
        'data_here': str(here).lower(),
        # The pictures sit in media/ beside the chart.
        'media_dir': (data_path.rsplit('/', 1)[0] + '/' if '/' in data_path else '') + 'media',
        'deploy': str(bool(api) and cf).lower(),
    }


def toml_var_name():
    text = (ROOT / 'worker' / 'wrangler.toml').read_text(encoding='utf-8')
    m = re.search(r'^name\s*=\s*"([^"]+)"', text, re.M)
    return m.group(1) if m else 'rhizome-api'


if __name__ == '__main__':
    found = where(os.environ)
    lines = ''.join(f'{k}={v}\n' for k, v in found.items())
    sys.stdout.write(lines)
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a', encoding='utf-8') as f:
            f.write(lines)
