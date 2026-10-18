FROM node:22-alpine AS builder

WORKDIR /app

COPY client/package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.base.json /tsconfig.base.json
COPY client/ ./

RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
