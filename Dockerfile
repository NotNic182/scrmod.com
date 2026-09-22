# syntax=docker/dockerfile:1
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Server only for now; the web plan adds a `build` script that runs both.
RUN npm run build:server

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SCR_WEB_ROOT=/app/dist/web
COPY --from=build /app/dist ./dist
COPY --from=build /app/fixtures ./fixtures
EXPOSE 8080
USER node
CMD ["node", "dist/server/node.js"]
