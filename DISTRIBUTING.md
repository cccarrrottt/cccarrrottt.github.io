# Your own copy

This is how to run the chart for yourself: your own site, your own chart,
your own sign-in, saving into your own repository. Everything below is set
up with **your** accounts and **your** keys. Nothing of the original's is
shared: not its write service, not its Cloudflare quota, not its Google or
Yandex apps.

What you end up with is what the original has:

| | |
| --- | --- |
| the site | `https://<you>.github.io`, or `https://<you>.github.io/<repo>`, published by GitHub Pages from your repository |
| the write service | a Cloudflare Worker on your account, `https://rhizome-api.<your subdomain>.workers.dev` |
| who edits | the GitHub logins you list in `OWNERS` (and `EDITORS`) |
| where the chart lives | `src/chart.json` in your repository; Save on the site commits to it |
| cloud drives | optional; your own Google and Yandex apps |

The README explains each part; this file is the order to do them in. It
takes an evening, most of it waiting for pages in other people's dashboards.

**Or the short way:** a site that everybody reads and nobody edits on it,
with no Cloudflare and no GitHub App, the chart changed by committing a
file. Steps 1, 2 and 6, about ten minutes; see "Without the service" below.

## 1. The repository

1. **Fork** the repository. Named **`<your login>.github.io`**, it is
   served at `https://<you>.github.io`; named anything else, under a path,
   `https://<you>.github.io/<repo>`. Both work: the page is the site at the
   address `site` names (step 2) or below it. A second chart is a second
   repository under the same account.

   Charts under one account share an origin, and with it a browser's
   storage: a script on one of them could read a session kept by another.
   They are all yours, so this is your own code reading your own session;
   just do not publish anybody else's pages from the same account.
2. **Actions.** A fork starts with them switched off: open the *Actions* tab
   and enable them.
3. **Pages.** *Settings → Pages → Build and deployment → Source*:
   **GitHub Actions**. Not a branch: from a branch, Pages publishes the
   README through Jekyll, succeeds, and the site is not the chart.

## 2. The addresses: nothing to write

Your site's address, your write service's, your repository and who may
edit are **worked out by CI** from where it runs (`tools/where.py`, since
0.28.0), and written into the page it publishes; you change no file for
them, and "Sync fork" never meets a line of ours you changed:

| | worked out as | or, if you set this repository **variable** |
| --- | --- | --- |
| the site | `https://<you>.github.io`, or `https://<you>.github.io/<repo>` | `RHIZOME_SITE` (a domain of your own) |
| the service | `https://rhizome-api.<subdomain>.workers.dev` on your Cloudflare account (step 3); none without Cloudflare | `RHIZOME_API` |
| who edits | you, the repository's owner | `RHIZOME_OWNERS`, and `RHIZOME_EDITORS` beside them |
| the chart | `src/chart.json` in your repository | `RHIZOME_DATA` (see "Where the chart is kept") |

Variables are under *Settings → Secrets and variables → Actions →
Variables*. A fork does not copy them, so a fork of yours never inherits
your chart or your owner either. What CI worked out is printed at the top
of every run, in *Where this copy lives*.

`src/app/00-config.js` and `worker/wrangler.toml` hold the original's
values, and are used only by the repository they name.

**The About panel** carries the original author's contacts (`about-contact`
links in `src/index.html`). Put yours there, or take them out, then run
`node tools/i18n.js` so the translation files follow. What the chart is
called and what it is about are not in that file: they are the chart's (step
6).

**The preview picture** a link to your site shows is `src/site/og-image.png`,
the original's card, with its wordmark and tagline. Put any 1200×630 PNG of
your own in its place (`tools/og-image.js` is how the original drew its
card, and can be edited to draw yours).

## 3. Cloudflare: the write service

1. Make a free Cloudflare account and open *Workers & Pages* once. That
   gives the account its `*.workers.dev` subdomain; your service will be
   `https://rhizome-api.<subdomain>.workers.dev`, which CI asks Cloudflare
   for itself (step 2).
2. Let CI deploy it: a Cloudflare API token made from the *Edit Cloudflare
   Workers* template, and your account id, as the repository's Actions
   secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (*Settings →
   Secrets and variables → Actions*). Without them there is no service:
   the site is published read-only for everybody (see "Without the
   service").

   (The README's "Setting up the write service" describes the other way,
   importing the repository into Cloudflare. Use one, not both.)

Your free plan allows 100,000 requests a day. They are yours: readers of
your site never touch anyone else's service.

## 4. GitHub: who may sign in

1. *GitHub → Settings → Developer settings → GitHub Apps → New*.
   - Homepage: your site.
   - Callback URL: `https://rhizome-api.<subdomain>.workers.dev/callback`.
   - Keep *Expire user authorization tokens* on. Webhook off.
   - Repository permissions: **Contents — Read and write** and
     **Issues — Read and write**, nothing else.
   - Installable only on your account.
2. Generate a client secret, then **Install** the app on your repository
   only.
3. Give the service the app's client id and secret, in either place:
   - in GitHub, as Actions **secrets** `RHIZOME_GITHUB_CLIENT_ID` and
     `RHIZOME_GITHUB_CLIENT_SECRET` (GitHub refuses secret names that begin
     `GITHUB_`, hence the prefix): CI hands them to the service on every
     deploy. Every secret below can be kept this way, as `RHIZOME_` and its
     name;
   - or in Cloudflare, *your Worker → Settings → Variables and Secrets*, as
     **Secrets** `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (not plain
     text, which a deploy wipes).

   `SESSION_SECRET`, the key sessions are sealed with, is made by the first
   deploy, at random, if neither place has one; never again after that.

Never write any of these into `worker/wrangler.toml`: that file is public,
and `tests/worker.js` refuses it if one appears there.

4. Only if you will have editors (`EDITORS`): on the app's page, note the
   *App ID* and *Generate a private key*, and add `GITHUB_APP_ID` and
   `GITHUB_APP_PRIVATE_KEY` (the whole `.pem`) as two more Secrets. Editors'
   saves are then the app's commits, and editors need no access to the
   repository. Without them an editor must be a collaborator with *Write*,
   which lets them change your code and workflows as well.

### Keep `main` for reviewed code

*Settings → Rules → Rulesets → New branch ruleset*, target the default
branch, and turn on *Require a pull request before merging* and *Require
status checks to pass* (pick the checks CI runs: *Build, guard and lint*,
the *Regression* shards, *Snapshots*). Under *Bypass list* add yourself
(Repository admin) and the GitHub App, so that Save from the site, which
commits straight to `main`, goes on working. A one-line edit in GitHub's
web editor then becomes a pull request whose checks run before it lands,
rather than a red `main` that the site cannot publish.

## 5. Push, and sign in

Commit steps 2–4 and push to `main`. CI builds, runs the checks, deploys the
service and publishes the site. Open your site, press **Sign in**, and the
page becomes the editor for the login in `OWNERS`.

## 6. Your own chart

The fork carries the original's chart. Start yours **from the site**, once
you are signed in: take out what you do not want (select, Delete), add your
own, and press **Save**. That commit changes only `src/chart.json`, so it is
published at once without waiting for the checks.

You may also replace `src/chart.json` in a commit of code: the browser
suite draws a chart of its own, `tests/fixtures/chart.json` with its
pictures in `tests/fixtures/media/`, and never reads yours. That is why
a code push comes out green whatever your chart holds, and why bringing
in the original's code later does not depend on it either.

Then give it its own name: *About → The chart's name and description*.
The name is the tab's title and what a link to your site shows, with the
sentence under it; the text below is the top of About. They are saved with
the chart (`settings.title`, `settings.description`, `settings.about` in
`src/chart.json`), and a link's preview follows them at the next publish.

The original's chart brings a font of its own (`settings.fonts`, Autobot
Characters). Remove it under *My files → Fonts* once nothing is set in it,
unless you have checked that you may use it.

## 7. Optional: cloud drives

Google Drive and Yandex Disk in *My files* need apps of **your own**, on
your service. Follow the README's "The owner's cloud drives" with your
service's address in each redirect URI:

- Google: `https://rhizome-api.<subdomain>.workers.dev/cloud/gdrive/back`;
  Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`;
  and, for Google's Picker (the service then reaches only the files
  picked), `GOOGLE_PICKER_KEY` restricted to
  `https://rhizome-api.<subdomain>.workers.dev/*` and `GOOGLE_APP_ID`, the
  project's number.
- Yandex: `https://rhizome-api.<subdomain>.workers.dev/cloud/yadisk/back`;
  Secrets `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.

A drive whose Secrets are missing is simply not offered. Pictures picked
from a drive are shown to your readers by your service, from your quota.

## 8. Optional: counting visitors

A Cloudflare Web Analytics token as the repository **variable**
`CF_WEB_ANALYTICS_TOKEN` (README, "What the site counts"). Without it your
site counts nothing.

## Without the service

A site everybody reads, with no Cloudflare account, no GitHub App and no
secrets. Nobody signs in on it, the owner included, and there are no
suggestions; the chart changes by a commit of `src/chart.json`.

1. Step 1 as above.
2. Add no Cloudflare secrets. With none, CI names no service and deploys
   none.
3. Push. The site is published as a reader for everybody.

To change the chart, open your copy anywhere but the site and edit it
there: *Export/Import → the page* on the site saves a copy of it that
opens from a disk and edits into that browser. When it is as you want it,
*Export the contents* gives a `chart.json`; put it in place of
`src/chart.json` (on GitHub, *Add file → Upload files* into `src/`). A
commit that changes only the chart is published without waiting for the
checks. To add the service later, follow steps 3–5.

## Where the chart is kept

In your repository, as `src/chart.json` with its pictures in `src/media/`,
unless the variable `RHIZOME_DATA` says otherwise:
`<owner>/<repo>/<path>/chart.json@<branch>` — for instance
`you/my-charts/chart.json@main`, a repository of its own holding only the
chart and a `media/` folder beside it. Save then commits there, About's
history of edits is that file's, and suggestions are that repository's
issues. Install your GitHub App on that repository too. If it is private,
add an Actions secret `DATA_TOKEN`, a token that may read it, for CI to
fetch the chart with; the chart is public all the same once published.

A chart kept elsewhere is published when this repository's CI runs: a
Save does not start it yet, so run the workflow (*Actions → CI → Run
workflow*) after saving.

## The chart as data

Every copy publishes its chart beside the page, at `<site>/chart.json`:
the file Save commits, described by `<site>/chart.schema.json`. GitHub
Pages answers it to any origin, so another page or a script can read your
chart without scraping it; the site's `<head>` names it as the page's data
(`<link rel="alternate" type="application/json">`).

## The licence

The platform is MIT (`LICENSE`): keep that file, with its copyright line,
in your copy. `NOTICE` says what the licence does not cover, the original's
chart and everything it names or carries; rewrite it for your own chart.

## Checklist

- [ ] fork (any name), Actions on, Pages from GitHub Actions
- [ ] (only if they differ from what CI works out) variables `RHIZOME_SITE`, `RHIZOME_API`, `RHIZOME_OWNERS`, `RHIZOME_EDITORS`, `RHIZOME_DATA`
- [ ] About contacts changed, `node tools/i18n.js` run
- [ ] Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] GitHub App, installed on your repository
- [ ] the app's id and secret: Actions secrets `RHIZOME_GITHUB_CLIENT_ID`, `RHIZOME_GITHUB_CLIENT_SECRET`, or Worker Secrets without the prefix (and, with editors, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`)
- [ ] pushed, signed in, chart made your own with Save, named in About
- [ ] your own `src/site/og-image.png`
- [ ] (optional) drives' Secrets, analytics variable
