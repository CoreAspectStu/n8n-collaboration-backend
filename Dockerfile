# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false
# Only needed if you have native deps. Remove if not required.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# If lockfile exists, prefer ci.
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runner ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 WS_PORT=3001 HOST=0.0.0.0 WS_HOST=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# set ownership so the 'node' user can read everything
RUN chown -R node:node /app
USER node

EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT||3000) + '/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

