# @actual-app/api must match the running actual-server version exactly or
# downloadBudget fails with out-of-sync-migrations. Pass the server version as a
# build arg to pin the client in lockstep; empty falls back to package.json.
ARG ACTUAL_API_VERSION=""

FROM node:22-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS builder
WORKDIR /app
ARG ACTUAL_API_VERSION
COPY package.json package-lock.json ./
RUN npm ci
RUN if [ -n "$ACTUAL_API_VERSION" ]; then npm install --no-save @actual-app/api@"$ACTUAL_API_VERSION"; fi
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm test && npm run build

FROM node:22-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app
ARG ACTUAL_API_VERSION
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN if [ -n "$ACTUAL_API_VERSION" ]; then npm install --no-save @actual-app/api@"$ACTUAL_API_VERSION"; fi
COPY --from=builder /app/dist/ ./dist/
COPY fonts/ ./fonts/
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "dist/index.js"]
