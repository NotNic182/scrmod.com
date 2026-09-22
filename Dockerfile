# syntax=docker/dockerfile:1
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `build` = build:web + build:server once the web plan lands; until then build:server alone.
RUN npm run build 2>/dev/null || npm run build:server
RUN mkdir -p dist/web && [ -f dist/web/index.html ] || echo '<!doctype html><title>SCR Hub</title><p>Frontend not built.</p>' > dist/web/index.html

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SCR_WEB_ROOT=/app/dist/web
COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures
EXPOSE 8080
USER node
CMD ["node", "dist/server/node.js"]
