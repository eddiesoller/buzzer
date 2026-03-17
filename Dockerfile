FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ ./src/

CMD ["npx", "tsx", "src/index.ts"]
