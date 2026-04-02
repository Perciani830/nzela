FROM node:22-alpine

# cache-bust: 2026-04-02-v2
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

RUN mkdir -p /app/backend/data

EXPOSE 5000

CMD ["node", "server.js"]