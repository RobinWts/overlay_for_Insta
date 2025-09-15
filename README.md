# Overlay Image Server

A Node.js server that creates Instagram-style image overlays with customizable title and source text. Perfect for social media content generation and automated image processing. Originally developed for vServer-hosted n8n workflows.

## Minimalistic Setup

This service can be easily integrated into existing Docker Compose setups by copying the following files to a subdirectory (e.g. /overlay):
- `server.js`
- `package.json` 
- `Logo.svg`
- `Dockerfile`

Then add the overlay service to your `docker-compose.yml` (this is an exmaple config for a basic n8n installation):

```yaml
networks:
  proxy:
    external: false

volumes:
  traefik_data:
  db_data:

services:
  traefik:
    image: traefik:v3.1
    container_name: traefik
    restart: unless-stopped
    command:
      - "--configfile=/traefik/traefik.yml"
      - "--certificatesresolvers.le-http.acme.email=your-email@example.com"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik/traefik.yml:ro
      - ./traefik/dynamic.yml:/traefik/dynamic.yml:ro
      - ./traefik/acme.json:/traefik/acme.json
    networks: [proxy]
    labels:
      # Keep Traefik off auto-updates for stability
      com.centurylinklabs.watchtower.enable: "false"

  postgres:
    image: postgres:16-alpine
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: "${POSTGRES_USER}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
      POSTGRES_DB: "${POSTGRES_DB}"
    volumes:
      - db_data:/var/lib/postgresql/data
    networks: [proxy]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      com.centurylinklabs.watchtower.enable: "true"

  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      N8N_HOST: "${DOMAIN}"
      N8N_PORT: "5678"
      N8N_PROTOCOL: "https"
      WEBHOOK_URL: "https://${DOMAIN}/"
      DB_TYPE: "postgresdb"
      DB_POSTGRESDB_HOST: "n8n-postgres"
      DB_POSTGRESDB_PORT: "5432"
      DB_POSTGRESDB_DATABASE: "${POSTGRES_DB}"
      DB_POSTGRESDB_USER: "${POSTGRES_USER}"
      DB_POSTGRESDB_PASSWORD: "${POSTGRES_PASSWORD}"
      N8N_ENCRYPTION_KEY: "${N8N_ENCRYPTION_KEY}"
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: "${N8N_BASIC_AUTH_USER}"
      N8N_BASIC_AUTH_PASSWORD: "${N8N_BASIC_AUTH_PASSWORD}"
      GENERIC_TIMEZONE: "${GENERIC_TIMEZONE}"
    volumes:
      - ./n8n_data:/home/node/.n8n
    networks: [proxy]
    labels:
      traefik.enable: "true"
      traefik.http.routers.n8n.rule: "Host(`${DOMAIN}`)"
      traefik.http.routers.n8n.entrypoints: "websecure"
      traefik.http.routers.n8n.tls.certresolver: "le-http"
      traefik.http.services.n8n.loadbalancer.server.port: "5678"
      traefik.http.routers.n8n.middlewares: "securityHeaders@file"
      com.centurylinklabs.watchtower.enable: "true"

  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    command: --label-enable --cleanup --interval 86400
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks: [proxy]
    labels:
      com.centurylinklabs.watchtower.enable: "true"
      
  overlay:
    build:
      context: ./overlay
    container_name: overlay
    restart: unless-stopped
    networks:
      - proxy
    labels:
      traefik.enable: "false"
```

## Features

- 🖼️ **Image Overlay**: Add text overlays to any image with professional styling
- 📱 **Instagram-Ready**: Optimized dimensions and styling for social media
- 🎨 **Customizable Text**: Support for unlimited-length titles and source attribution with smart wrapping
- 🏷️ **Logo Overlay**: Optional logo placement in bottom-left corner
- ⚡ **High Performance**: Built with Sharp for fast image processing
- 🐳 **Docker Ready**: Containerized for easy deployment
- 🔄 **Auto-Reload**: Development mode with file watching

## Quick Start

### Prerequisites

- Node.js >= 20.3.0 (required for Sharp compatibility)
- npm or yarn
- Docker (optional, for containerized deployment)

### Development Setup

1. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd overlay_for_Insta
   ./setup-dev.sh
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Test the server** (in another terminal):
   ```bash
   npm test
   ```

### API Usage

The server provides a single endpoint for image overlay generation:

```
GET /overlay?img=<image_url>&title=<title>&source=<source>&w=<width>&h=<height>&maxLines=<number>&logo=<boolean>
```

#### Parameters

- `img` (required): URL of the source image
- `title` (optional): Text to overlay on the image (unlimited length, will wrap and truncate as needed)
- `source` (optional): Source attribution text (unlimited length)
- `w` (optional): Output width (default: 1080)
- `h` (optional): Output height (default: 1350)
- `maxLines` (optional): Maximum number of lines for title text (default: 5, range: 1-20)
- `logo` (optional): Whether to overlay Logo.svg in bottom-left corner (default: false)

#### Examples

**Basic usage (uses all defaults):**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg" -o output.jpg
```

**With custom text and dimensions:**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=My%20Awesome%20Post&source=@username&w=1080&h=1350" -o output.jpg
```

**With custom max lines:**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Very%20long%20title%20text&maxLines=3" -o output.jpg
```

**Single line title:**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Short%20Title&maxLines=1" -o output.jpg
```

**With logo overlay:**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=My%20Post&logo=true" -o output.jpg
```

**Full customization:**
```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Custom%20Title&source=@user&w=800&h=600&maxLines=3&logo=true" -o output.jpg
```

## Development

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm test` - Run server tests
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container

### Project Structure

```
overlay_for_Insta/
├── server.js          # Main server application
├── test-server.js     # Test suite
├── Logo.svg           # Logo file for overlay (optional)
├── package.json       # Dependencies and scripts
├── Dockerfile         # Container configuration
├── .nvmrc            # Node.js version specification
├── setup-dev.sh      # Development setup script
└── README.md         # This file
```

## Docker Deployment

### Build and Run

```bash
# Build the Docker image
npm run docker:build

# Run the container
npm run docker:run
```

### Production Deployment

The Dockerfile is optimized for production with:
- Non-root user for security
- Health checks
- Minimal dependencies
- Proper caching layers

## Text Overlay Features

- **Smart Text Wrapping**: Automatically wraps long titles across multiple lines
- **Unlimited Text Length**: No character limits - text wraps and truncates as needed
- **Configurable Line Limits**: Control maximum number of lines (1-20, default: 5)
- **Professional Styling**: Clean typography with proper contrast
- **Responsive Sizing**: Text scales appropriately with image dimensions
- **Ellipsis Handling**: Truncates text gracefully when needed
- **Multi-line Support**: Flexible line count based on content and settings
- **Logo Branding**: Optional logo overlay in bottom-left corner with automatic sizing

## Logo File

The server supports an optional logo overlay by placing a `Logo.svg` file in the project root. When the `logo=true` parameter is used, this file will be automatically:

- Used at its original size (no resizing)
- Positioned in the bottom-left corner with 20px padding from the image border
- Converted to PNG format for optimal compositing
- Sized by adjusting the SVG file itself

If the `Logo.svg` file is not found, the server will continue processing without the logo and log a warning.

## Requirements

- Node.js >= 20.3.0 (Sharp requirement)
- libvips (installed automatically in Docker)

## Troubleshooting

### Sharp Installation Issues

If you encounter Sharp-related errors:

1. Ensure Node.js version >= 20.3.0:
   ```bash
   node --version
   ```

2. If using nvm, make sure to use the correct version:
   ```bash
   nvm use
   ```

3. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Docker Issues

If Docker build fails:

1. Ensure you have the latest Docker version
2. Check that the base image is available:
   ```bash
   docker pull node:20.3.0-bookworm-slim
   ```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub.
