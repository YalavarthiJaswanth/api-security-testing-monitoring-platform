# Production Dockerfile for Vulnerable Simulation Lab API
FROM node:20-alpine

WORKDIR /app

ENV PORT=5050
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 5050

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5050/health || exit 1

CMD ["node", "src/index.js"]
