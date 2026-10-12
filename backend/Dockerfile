# Образ сервиса анкет для Cloud.ru Container Apps (нужна платформа linux/amd64).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js handler.js rsvp.js file-store.js s3-bucket.js ./

# Container Apps запускает контейнер от непривилегированного пользователя с UID 1000 — это node.
USER node
CMD ["node", "server.js"]
