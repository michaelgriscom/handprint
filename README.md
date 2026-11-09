# Handprint

Tracks a giving pledge (Giving What We Can's by default): what was given against income, who received it, and a rough estimate of what it did. Donations come live from Actual Budget,
income comes from a yearly table in `config.yaml`, and gifts that never touch
Actual (history, payroll giving, DAF grants) come from `donations.csv`.

## Model

- **Pledge kinds** follow Giving What We Can's: `gwwc` (10%), `trial` (1% or more), `further` (everything above a yearly `allowance`), or `custom` (any `percent`). Earlier years can be excluded with `pledge.start_date`.

- **Income:** one row per year. Keep an `estimate` during the year; at W-2 time
  replace it with Box 5 (Medicare wages) and mark it `final`.
- **Charity registry:** on by default (`presets: none` to disable). Common EA charities get a cause-area category, name aliases ("AMF" and "Against Malaria Foundation" are one recipient) and sourced impact estimates. Your own `categories`, `aliases` and `impact` entries override it per recipient; everything else just works on import.
- **Impact:** per-recipient estimates (`per_dollar` or `cost_per_unit`, with `share` to split a fund across programs), shown on the overview with an icon and a source link.
- **Donations:** Actual transactions matching `actual.rules` (outflows count,
  refunds subtract), named by `actual.recipients`, plus `donations.csv` rows.
- **Per year:** target = gross × percent (pro-rated from `pledge.start_date` in
  the first year), given, gap, running balance. The current year also gets pace
  against the target to date.

`config.yaml` and `donations.csv` are re-read on every page load. The Actual
budget is downloaded every `REFRESH_MINUTES` (default 360) and cached in `/data`.
See `examples/` for both files.

## Pages

`/` overview (impact and pledge), `/history`, `/milestones`, `/recipients`. The browser-only build (`npm run build:web`, output in `web-dist/`) serves the same pages as hash routes and keeps data in localStorage; import an export from `/export`. **Share** builds a read-only link with the data deflated into the URL fragment (no server involved); the recipient can save it to their own browser.

## Endpoints

- `/`, `/history`, `/milestones`, `/recipients`: the pages above
- `/api/summary`: the same as JSON, with every counted donation
- `/health`: 503 if the last Actual refresh failed or is stale (3 intervals)
- `POST /refresh`: download the budget now

## Environment

`ACTUAL_SERVER_URL`, `ACTUAL_SERVER_PASSWORD`, `ACTUAL_SYNC_ID`,
`ACTUAL_BUDGET_PASSWORD` (encrypted budgets only), `BRAND` (top-bar label), `CONFIG_PATH`
(`/config/config.yaml`), `DATA_DIR` (`/data`), `PORT` (8080), `REFRESH_MINUTES`.

## Actual version lockstep

`@actual-app/api` must match actual-server exactly. It is pinned in
`package.json`; build with `--build-arg ACTUAL_API_VERSION=<server version>` after
the server is upgraded. On a mismatch the dashboard keeps showing the last cached
data with an error banner, and `/health` goes red.

## Embedding on a site

Each tagged release publishes `app.js` (the browser build) as a GitHub Release asset. Drop it in your site, give it a `<div id="app" class="viz-root">` and a `<script src=".../app.js">`; if the page defines the `--font-newsreader`/`--font-young-serif` variables and the theme tokens (`--background`, `--foreground`, `--accent`, …) it inherits them, otherwise it ships its own.

## Development

```sh
npm install && npm test && npm run dev
```
