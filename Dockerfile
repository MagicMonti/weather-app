# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the Angular app
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so this layer is cached unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the sources and produce the production bundle.
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — serve the static bundle with nginx on port 3001
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Our server block listens on 3001 and handles SPA fallback routing.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular's application builder emits the browser assets under dist/<project>/browser.
COPY --from=build /app/dist/weather-app/browser /usr/share/nginx/html

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3001/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
