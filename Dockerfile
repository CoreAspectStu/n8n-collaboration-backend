# ---- build/runtime (single stage, simplest) ----
FROM node:20
WORKDIR /app

# Show tool versions in build logs (sanity)
RUN node -v && npm -v && which node && which npm

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# App code
COPY src ./src

# Health + ports
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r=>process.exit(r.statusCode===200?0:1))"

CMD ["node","src/server.js"]
