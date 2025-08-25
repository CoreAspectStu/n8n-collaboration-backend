# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false
# Install build tools for native deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./

RUN node -v && which node && npm -v && which npm
RUN ls -la /app && cat /app/package.json | head -40
RUN npm install --omit=dev --no-audit --no-fund

# ---- runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r=>process.exit(r.statusCode===200?0:1))"
CMD ["node","src/server.js"]
