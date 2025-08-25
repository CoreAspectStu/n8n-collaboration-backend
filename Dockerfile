# ---- deps ----
FROM node:20-bookworm-slim AS deps
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
# system deps for occasional native packages
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# Prefer CI, but fall back to install; always print npm logs on error
RUN (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund); \
    exit_code=$?; \
    if [ $exit_code -ne 0 ]; then \
      echo "---- NPM DEBUG LOGS ----"; \
      find /root/.npm/_logs -type f -name '*-debug-*.log' -maxdepth 1 -print -exec sed -n '1,200p' {} \; || true; \
      exit $exit_code; \
    fi

# ---- runtime ----
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
# simple healthcheck for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r=>process.exit(r.statusCode===200?0:1))"
EXPOSE 3000 3001
CMD ["node","src/server.js"]
