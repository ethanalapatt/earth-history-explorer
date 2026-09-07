# Earth history explorer

A locally deployable version of the cinematic Earth civilization experience, with country and city selection on the opening globe and a history panel on the left.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The original `/civilization.html` route also works.

For a production build:

```sh
npm run build
npm start
```

The production server runs on http://localhost:5173. Set `PORT` to change the port. It binds to loopback by default; use `HOST=0.0.0.0` to expose it on your LAN or run it in a container.

```sh
docker build -t earth-history .
docker run --rm -p 5173:5173 earth-history
```

## Explore

- Drag the globe to rotate; scroll, pinch, or use + / − to zoom.
- Click a country shape or name to open its history on the left.
- Zoom closer to reveal city markers; smaller cities appear at closer zoom levels.
- Click a city marker to read that city's history.
- Use **Explore places** to find a country or city by name, including places outside the current view. This also provides keyboard access to the full catalog.
- Use Escape or the panel's close button to dismiss history. The ↺ globe control restores the opening view.
- The original 18-chapter journey, playback, day/night lighting, chapter selector, and fullscreen controls remain available.

## History coverage

The bundled catalog contains 258 countries and territories and 7,342 populated places. It is a geographic gazetteer, not every settlement on Earth. Borders show contemporary map geometry.

The local server resolves a place's canonical article using its geographic identity, then loads the dedicated history article where available. Otherwise it extracts the history section from the main place article. All available narrative sections from that article are shown as expandable sections; this is not a claim to contain every historical event. The full-article link opens the underlying record.

Internet access is needed for live history. Globe textures, fonts, geography, city locations, and the 18 original chapters are bundled locally. Matching chapters remain available in the history panel if the live service fails. Successful history responses are cached in memory for 24 hours, with a maximum of 250 places. Refreshing or restarting the server clears the cache.

The other Earth experiences in the navigation link to the existing live site. This app locally implements the requested Civilization experience.

## Project structure

- `src/civilization.js` and the original styles preserve the reference experience.
- `vendor/layout.js` retains the globe renderer, with deeper zoom and composable map layers.
- `src/explorer.js` adds country boundaries, progressive city labels, selection, and the history panel.
- `src/geo.js` contains geographic hit testing, zoom thresholds, and great-circle distance calculations.
- `server/history.js` resolves places and returns plain-text history sections. Upstream HTML is never inserted into the interface.
- `public/` contains all map assets and the local gazetteer.

No API keys, database, account system, analytics, or paid map service is needed. No promotional credits or credits panel are shown in the interface. Dependency and content licensing details are retained in `THIRD_PARTY_NOTICES.md`.

## Checks

```sh
npm test
npm run build
```

Automated checks cover geographic selection, date-line polygons and holes, city zoom thresholds, drag/pinch filtering, history extraction, and API request validation. Live history is also checked during development. Automated browser interaction testing has not been performed. Optional WebMCP tools are registered when supported by the browser; that browser integration has not been verified in a supported WebMCP context.

## Publish the milestone commits

From an authenticated terminal, run:

```sh
bash scripts/publish-github.sh
```

This creates the private `ethanalapatt/earth-history-explorer` repository, pushes each local milestone in chronological order, and verifies that GitHub's final commit matches the local commit. It uses the existing GitHub CLI login, never force-pushes, and does not write credentials into the repository. Re-running it pushes only new commits. If you edit server code during development, restart `npm run dev`; browser code and styles reload automatically.
