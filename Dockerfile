FROM node:20.3.0-bookworm-slim

# install libvips and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# only needed for production
COPY package.json package-lock.json ./

# install production dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# copy app files and assets
COPY --chown=node:node server.js Logo.svg ./

# run as non-root
USER node

EXPOSE 8080

# Healthcheck: simple GET on Overlay
HEALTHCHECK --interval=120s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS "http://localhost:8080/overlay?img=https://picsum.photos/300/300&title=test&source=test" >/dev/null || exit 1

CMD ["node", "server.js"]