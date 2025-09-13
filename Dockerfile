FROM node:20.3.0-bookworm-slim

# Install libvips for Sharp image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# Copy application code
COPY server.js ./

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/overlay?img=https://picsum.photos/300x300&title=test&source=test || exit 1

# Start the application
CMD ["node", "server.js"]