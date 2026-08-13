FROM node:20-bookworm-slim AS client-builder
WORKDIR /app
COPY client/package.json ./client/package.json
RUN npm --prefix client install
COPY client ./client
RUN npm --prefix client run build

FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev
COPY server ./server
COPY --from=client-builder /app/client/dist ./client/dist
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server/index.js"]
