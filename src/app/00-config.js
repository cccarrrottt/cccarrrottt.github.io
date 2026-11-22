/* =========================================================================
   WHERE THIS CHART LIVES ON THE WEB
   -----------------------------------------------------------------------
   The three addresses that make one copy of this program the owner's site
   rather than anybody's file. They used to be written into the middle of
   01-store.js, and three other places learned them from there by pattern;
   now they are said once, here, and everything else asks.

     site  — the published site's address, with no slash at the end:
             https://<login>.github.io for a repository named that, and
             https://<login>.github.io/<repo> for any other, which is where
             Pages serves it. On this address, or below it, the page starts
             as a reader and becomes the editor once the write service
             confirms the owner (ON_SITE, 01-store.js). Anywhere else it is
             its holder's own copy. The build names it in the site's link
             preview, in the address of the chart's JSON schema and in the
             chart it publishes beside the page.
     api   — the write service (worker/). Empty means there is none: the
             site is read-only for everybody, the owner included, CI deploys
             nothing, and the chart changes by a commit of src/chart.json
             (DISTRIBUTING.md, "Without the service").
     repo  — the repository the site is published from, owner/name, where
             suggestions are kept as issues and read back from GitHub.

   The write service has its own copy of two of these, because Cloudflare
   reads them from worker/wrangler.toml when it deploys it: REPO there is
   `repo` here, and ALLOWED_ORIGINS must hold the origin of `site` (the
   address without its path, which is all a browser tells the service).
   tests/build_guard.py
   refuses the two disagreeing, so changing an address here and forgetting
   the service shows up as a red check rather than as a sign-in that fails.

   A plain object of strings, one to a line, so build.py and the suite can
   read it without running the program; keep it that way.
   ========================================================================= */
const SITE_CONFIG = {
  site: 'https://cccarrrottt.github.io',
  api: 'https://rhizome-api.wowwodptr2.workers.dev',
  repo: 'cccarrrottt/cccarrrottt.github.io',
};
