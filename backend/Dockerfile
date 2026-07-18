FROM node:20-alpine

WORKDIR /app

# install deps first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

COPY . .
RUN npm run build

ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/index.js"]
