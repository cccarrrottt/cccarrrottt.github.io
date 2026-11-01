/* =========================================================================
   WHERE THIS CHART LIVES ON THE WEB
   -----------------------------------------------------------------------
   The three addresses that make one copy of this program the owner's site
   rather than anybody's file. They used to be written into the middle of
   01-store.js, and three other places learned them from there by pattern;
   now they are said once, here, and everything else asks.

     site  — the published site's origin. On this address the page starts
             as a reader and becomes the editor once the write service
             confirms the owner (ON_SITE, 01-store.js). Anywhere else it is
             its holder's own copy. The build names it in the site's link
             preview and in the address of the chart's JSON schema.
     api   — the write service (worker/). Empty means it is not set up
             yet, and the site is then read-only for everybody, the owner
             included — the safe way for that to be wrong.
     repo  — the repository the site is published from, owner/name, where
             suggestions are kept as issues and read back from GitHub.

   The write service has its own copy of two of these, because Cloudflare
   reads them from worker/wrangler.toml when it deploys it: REPO there is
   `repo` here, and ALLOWED_ORIGINS must hold `site`. tests/build_guard.py
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
