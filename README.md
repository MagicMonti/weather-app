# WeatherApp

A single-page weather app built with [Angular](https://angular.dev/) (v22) and the free
[Open-Meteo](https://open-meteo.com/) API — no API key required.

The default location is **Schruns, Vorarlberg, Austria**, but the app asks the browser for
geolocation and switches to the visitor's coordinates when permission is granted.

![Screenshot placeholder]

## Features

- **Current conditions** — temperature, wind speed (km/h) and a human-readable description,
  decoded from the WMO weather codes returned by Open-Meteo.
- **3-day forecast** — today plus the next two days, with min/max temperatures and relative
  labels such as `Today`, `Tomorrow Mon`, `In 2 days Tue`.
- **Animated sky** — the background reacts to both the weather kind (`clear`, `cloudy`, `fog`,
  `rain`, `snow`, `thunder`) and the time of day (`night`, `dawn`, `day`, `dusk`), including a
  night veil whose opacity follows the sun, plus stars, sun glow, clouds, rain and snow layers.
- **Local clock** — shows the time in the location's timezone (using the API's UTC offset),
  refreshed every 30 s.
- **Geolocation** — follows the visitor's coordinates when available, and gracefully falls back
  to the default location otherwise.
- **Refresh button** — re-fetches on demand, with a request-sequence guard so out-of-order
  responses never overwrite newer data.
- **Signals throughout** — built on Angular signals and `computed()` values rather than RxJS.

## Getting started

```bash
npm install
npm start        # ng serve → http://localhost:4200/
```

The dev server hot-reloads whenever you change a source file.

## Docker

A multi-stage image builds the Angular bundle and serves it as static files with nginx on
port **3001** (gzip, long-lived caching for hashed assets, SPA fallback routing).

```bash
docker compose up -d --build   # → http://localhost:3001/
```

Or without compose:

```bash
docker build -t weather-app .
docker run -p 3001:3001 weather-app
```

The image includes a healthcheck on `http://localhost:3001/`.

## Project structure

```
src/
  main.ts             # bootstrap
  index.html          # document shell
  styles.css          # global styles
  app/
    app.ts            # weather + forecast logic, WMO code map, clock/theme computeds
    app.html          # sky layers and weather card markup
    app.css           # sky themes and animations
    app.spec.ts       # unit tests (Vitest)
    app.config.ts     # application providers
Dockerfile            # build stage (node) + runtime stage (nginx)
docker-compose.yml    # local container orchestration
nginx.conf            # server block for the static bundle
```

## Commands

| Task | Command |
| --- | --- |
| Dev server | `ng serve` |
| Production build | `ng build` (output in `dist/weather-app/browser`) |
| Unit tests | `ng test` (Vitest) |
| Scaffold code | `ng generate component component-name` (`ng generate --help` for all schematics) |
| Watch build | `npm run watch` |

For the full list of CLI commands, see the
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).

## Notes & limitations

- Geolocation requires a secure context (HTTPS or `localhost`) and user permission.
- The location is hardcoded apart from geolocation; there is no search box yet.
- Data is fetched once on load and on manual refresh — there is no automatic polling.

## Resources

- [Open-Meteo API](https://open-meteo.com/) — forecast endpoints and the WMO code list
- [Angular docs](https://angular.dev/) — signals, components, CLI
