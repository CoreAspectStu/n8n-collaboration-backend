# ---- deps (install with lockfile, build native deps if needed) ----
FROM node:18-alpine AS deps
WORKDIR /app
# toolchain for node-gyp & friends (only in build stage)
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime (slim) ----
FROM node:18-alpine
WORKDIR /app
# add runtime compat (helps some binaries)
RUN apk add --no-cache libc6-compat
# copy installed modules only
COPY --from=deps /app/node_modules ./node_modules
# app source
COPY src ./src
ENV NODE_ENV=production
# healthcheck for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r=>process.exit(r.statusCode===200?0:1))"
EXPOSE 3000 3001
CMD ["node","src/server.js"]
