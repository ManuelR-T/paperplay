FROM node:24.14.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PAPERPLAY_STANDALONE=1
COPY . .
RUN npm ci && npm run notices && npm run build

FROM node:24.14.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 USAGE_SQLITE_PATH=/data/usage.sqlite SHORT_LINKS_SQLITE_PATH=/data/short-links.sqlite
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/LICENSE /app/THIRD_PARTY_NOTICES.txt ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
