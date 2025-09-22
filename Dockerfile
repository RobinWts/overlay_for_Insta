FROM node:20.3.0-bookworm-slim

# libs für sharp/svg + fonts + ffmpeg + curl + gosu (Privilege-Drop)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    librsvg2-2 libpango-1.0-0 libharfbuzz0b libcairo2 \
    fontconfig fonts-inter fonts-liberation fonts-dejavu-core \
    ffmpeg curl gosu \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

WORKDIR /app
ENV NODE_ENV=production

# deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# app & assets
COPY --chown=node:node server.js helpers.js Logo.svg ./
COPY --chown=node:node endpoints/ ./endpoints/
COPY --chown=node:node middleware/ ./middleware/

# Verzeichnisse (Image-seitig) + Ownership
RUN mkdir -p /app/media/reels /app/media/tmp /app/assets/reels_bg \
    && chown -R node:node /app/media /app/assets

# Entrypoint-Skript
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

# Healthcheck bleibt wie gehabt
HEALTHCHECK --interval=120s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS "http://localhost:8080/healthz" >/dev/null || exit 1

# Wichtig: kein USER node hier – das Skript muss chown können
ENTRYPOINT ["/app/entrypoint.sh"]