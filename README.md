# Hyperliquid funding

Full funding history for any Hyperliquid perp, including the HIP-3 dexs: cumulative and annualized funding, rolling and trailing windows, realized funding against what the premium implies, the rate distribution, persistence, calendar months and the heaviest days.

Use it at [justinalick.com/projects/hl-funding](https://justinalick.com/projects/hl-funding/), or open `index.html` in a browser.

Rates are hourly. Positive means longs pay shorts. Annualized figures use wall-clock hours, linear (Σr × 8760/T) or compounded.

## How data flows

On the site, the page asks `/projects/hl-funding/api/info`, a small Worker (`src/worker.js`) that forwards four read-only queries to `api.hyperliquid.xyz/info` and caches the answers at the edge. Your browser only ever talks to justinalick.com; Hyperliquid sees Cloudflare, not you. Opened as a local file, the page calls Hyperliquid directly.

Chart.js and the fonts are vendored in `vendor/`, so the page makes no third-party requests.

By [@justinalick](https://x.com/justinalick).

## Deploy

`scripts/build.mjs` copies the page into `dist/` and writes a CSP that allows the inline scripts by hash; `wrangler deploy` then publishes it to a Worker routed on that path. This repo only builds in CI. Deploys run from the site's private repository, so no Cloudflare token is stored here.

## License

Code: [MIT](LICENSE). Branding (name, @justinalick handle, CryptoPunk image, visual identity) is excluded and all rights are reserved; see [NOTICE](NOTICE). Forks must remove it.
