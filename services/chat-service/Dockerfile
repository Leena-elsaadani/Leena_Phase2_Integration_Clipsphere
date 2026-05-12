FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY cmd ./cmd
COPY internal ./internal
EXPOSE 3002
CMD ["node", "src/server.js"]
