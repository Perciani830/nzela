FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/../data

EXPOSE 5000

CMD ["node", "--experimental-sqlite", "--trace-warnings", "server.js"]