FROM node:24-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server.js"]
