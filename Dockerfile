FROM node:22-alpine
# cache-bust: 2026-04-19-v3
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
RUN rm -f .env
RUN mkdir -p /app/backend/data
EXPOSE 5000
CMD ["node", "server.js"]