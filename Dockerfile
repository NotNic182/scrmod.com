# syntax=docker/dockerfile:1
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The `build` script runs both the web (Vite) and server (esbuild) builds.
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SCR_WEB_ROOT=/app/dist/web
COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures
EXPOSE 8080
USER node
CMD ["node", "dist/server/node.js"]
