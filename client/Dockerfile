FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY api/package*.json ./api/
COPY client/package*.json ./client/
RUN npm ci

COPY . .
RUN npm run build --workspace=client

FROM nginx:alpine AS runner
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY --from=builder /app/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
