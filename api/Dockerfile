FROM node:22-alpine AS builder

WORKDIR /app

COPY api/package*.json ./
RUN npm ci --ignore-scripts

COPY api/ ./
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY api/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
