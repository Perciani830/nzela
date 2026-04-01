FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

COPY backend/ ./backend/

RUN mkdir -p /app/backend/data

EXPOSE 5000

CMD ["node", "backend/server.js"]