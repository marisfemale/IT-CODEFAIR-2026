# Community Connectivity Atlas

Local source-code recreation of [Community Connectivity Atlas](https://community-connectivity-atlas.duongtrghieu.chatgpt.site/), retrieved on 30 September 2026.

This project preserves the original site's HTML, CSS, datasets, maps, filters, dialogs, exports, and priority calculations. It uses **Vite and native JavaScript modules**. The original application did not use React; retaining its implementation avoids introducing visual or behavioral differences. No backend, API key, paid map service, or connection to the original host is required.

## Run locally

Install Node.js 24 LTS, then run these commands from this folder:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (normally http://127.0.0.1:5173). Use the local server rather than opening `index.html` directly, because the app loads its bundled JSON datasets over HTTP.

## Production build

```sh
npm test
npm run build
npm run preview
```

The production site is written to `dist/`. Preview normally runs at http://127.0.0.1:4173. `npm run format` formats the source; `npm run format:check` checks formatting.

## GitHub and Vercel

1. Create an empty GitHub repository.
2. From this folder, run `git init`, `git add .`, and `git commit -m "Add Community Connectivity Atlas"`.
3. Add your GitHub repository as the `origin` remote, then push your main branch.
4. In Vercel, import that GitHub repository. Select **Vite**, use `npm run build` as the build command, and `dist` as the output directory. Use Node.js 24.
5. Deploy. No environment variables are needed. `vercel.json` includes the build settings.

Keep `package-lock.json` in Git for reproducible installations. `.gitignore` excludes dependencies, build output, local environment files, Vercel settings, logs, and the working/outputs folders. Never commit credentials. Hosting account secrets, if added in the future, belong in your hosting provider's settings, not in browser code or public assets.

## Project layout

```text
index.html                   Original page structure and both dashboard views
src/app/
  main.js                    Application entry point
  styles.css                 Original visual design and responsive layouts
  overview.js                Filters, metrics, map, community profiles, CSV export
  priority-engine.js         Normalisation, weight rebalancing and ranking logic
  rankings.js                Ranking controls, comparisons, dialogs and export
public/
  favicon.svg                Original atlas icon
  data.json                  792 community records
  rankings.json              Both original ranking datasets, weights and ranges
tests/
  atlas.test.js              Dataset integrity and ranking parity checks
vite.config.js               Local development and production build configuration
vercel.json                  Vercel deployment configuration
```

## Preserved functionality

- Connectivity overview and Priority rankings tabs, including keyboard navigation.
- Community search, community type, nine coverage layers, coverage status, reset, table sorting and pagination.
- Metrics, provider coverage bars, mobile-site distance histogram, and dataset notes.
- Geographic point map with original coordinates, coverage colors, hover labels, point selection, zoom buttons, wheel/pinch zoom, drag panning, keyboard navigation and reset.
- Community profiles with coverage flags, population and nearby infrastructure.
- Two priority models: 792 communities without population weighting, and 468 communities with recorded population.
- Editable factor sliders and percentages, proportional rebalancing, original EWM reset, equal weights, live top-ten charts, ranking movement, breakdown dialogs, filtering and CSV scenario exports.
- Optional browser WebMCP tools from the original site. The dashboard works without WebMCP support.

## Data and fidelity

The original site consists of one page with two tabbed views, rather than separate page URLs. This project keeps that navigation. The map is the original SVG geographic point plot, not a tiled street map; it needs no external map service.

The two JSON files are exact copies of the publicly served source datasets. All data is static and is not refreshed from the original host. Replace these files deliberately when updating the dataset, keeping IDs, column names, model rows, normalisation ranges and baseline weights consistent. Rerun the tests after updates, and update snapshot assertions when the underlying dataset intentionally changes.

The source reports 792 records, 350 with any-network outdoor coverage, 52,602 known population, and 324 records without population. Missing population is not treated as zero in the population ranking model. Coverage flags do not measure speed, affordability, reliability, or indoor reception. The source states that mobile-site records use year 2025 but supplies no overall observation date. Consult the data owner regarding source licensing and redistribution rights; this project does not invent a data license.

Only packaging changed: scripts are now local ES modules, styles are bundled by Vite, and the original favicon is a local file. Hosting-injected Cloudflare challenge code was removed because it is not part of the dashboard. No hosted authentication, analytics, or credentials were copied.
