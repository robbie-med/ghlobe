# TrueSize Globe 🌍

An interactive 3D globe for **accurately comparing the real-world sizes** of countries and their first-level subdivisions (US states, French regions, Canadian provinces, Korean *do* and special cities, and every other admin-1 region on Earth).

Pick any country or state, then **drag it anywhere on the sphere**. Because the drag is a rigid rotation of the globe — not a flat pan — the shape keeps its exact real-world area and proportions wherever you drop it. Slide Greenland down to the equator and watch it shrink to its true size next to Africa; drag Texas over Europe to see how it really compares.

## Why

Flat maps lie. The Mercator projection inflates everything far from the equator — Greenland looks as big as Africa when it's actually ~14× smaller. This tool lets you *feel* the real sizes by moving regions around a true sphere and reading off their actual area in km².

## Features

- **Real 3D globe** (MapLibre GL globe projection) with atmosphere, free rotation, zoom, and tilt.
- **Two levels of selection**: whole countries (admin-0) or states/provinces/regions (admin-1) worldwide.
- **Select mode**: Auto (state if present, else country), Country-only, or State/Province-only.
- **Drag-to-compare**: rigid spherical rotation preserves true area and shape — the honest way to compare sizes.
- **Live area readout** in km² for the selected region.
- **Multiple basemaps**: Atlas (colored fills), Satellite (Esri World Imagery), and Satellite + Borders.
- **Optional overlays**: major roads and rivers (CARTO/OSM vector tiles).
- **Mercator toggle** to contrast the distorted flat projection with the globe.
- **6 UI languages** (English, 한국어, 中文, Français, العربية with RTL, Русский) plus localized region names.
- Touch support for drag-to-compare on mobile.

## Running locally

The app fetches two local GeoJSON files, so it must be served over HTTP (opening `index.html` directly via `file://` will not work).

```bash
# from the repo root
python3 -m http.server 8123
# then open http://localhost:8123
```

Any static file server works (`npx serve`, `caddy file-server`, nginx, etc.).

## How it works

- **Rendering**: [MapLibre GL JS](https://maplibre.org/) v5 with the built-in `globe` projection.
- **Boundary data**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m admin-0 (countries) and admin-1 (states/provinces), simplified with [mapshaper](https://mapshaper.org/) to an ~800 m tolerance for a good balance of accuracy and file size.
- **Size comparison**: when you drag a region, its geometry is rotated on the unit sphere via an axis–angle rotation matrix (spin about the pole by ΔLng, then tilt along the target meridian by ΔLat), keeping north up. Longitudes are unwrapped per-ring so shapes never tear at the antimeridian. Area is computed with the spherical excess formula, so it is invariant under the drag — the number you read is the region's true area no matter where it sits.

All geometry and math live in [`app.js`](app.js); there is no build step.

## Data & attribution

- Country and state/province boundaries: **Natural Earth** (public domain).
- Satellite imagery: **Esri World Imagery**.
- Roads & rivers: **CARTO** basemaps, data © **OpenStreetMap** contributors.
- Map rendering: **MapLibre GL JS** (BSD-3-Clause).

## License

Released under the [MIT License](LICENSE). Boundary data from Natural Earth is public domain; third-party tiles and imagery are subject to their respective providers' terms.
