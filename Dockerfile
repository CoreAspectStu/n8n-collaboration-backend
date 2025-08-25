# ---- deps ----
FROM node:18-alpine AS deps
WORKDIR /app
# toolchain for any native deps
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package*.json ./
# switch to npm install (less strict than npm ci)
RUN npm install --omit=dev && npm cache clean --force

# ---- runtime ----
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r=>process.exit(r.statusCode===200?0:1))"
EXPOSE 3000 3001
CMD ["node","src/server.js"]
