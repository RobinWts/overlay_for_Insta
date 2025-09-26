# Overlay Image Server

A Node.js server that creates Instagram-style image overlays with customizable title and source text. Perfect for social media content generation and automated image processing. Originally developed for vServer-hosted n8n workflows.
Additionally it has a local storage that can (if routed to the internet) provide publicURLs to files for other services (like Instagram) and local processing.
Video-Reel creation is available for 2 and 3 slides KenBurns-Videos with text overlay. More is in development.

## Minimalistic Setup

This service can be easily integrated into existing Docker Compose setups by copying the following files to a subdirectory (e.g. /overlay):

**Required Files:**
- `server.js` - Main server application
- `helpers.js` - Shared utility functions
- `endpoints/` - Endpoint handlers directory
  - `health.js` - Health check endpoint
  - `overlay.js` - Image overlay endpoint
  - `reel.js` - Video reel endpoint
  - `3slidesReel.js` - Video reel endpoint for 3 slides
  - `storage.js` - local storage endpoint
- `middleware/` - Middleware directory
  - `auth.js` - API key validation middleware
- `package.json` - Dependencies and scripts
- `package-lock.json` - Dependency lock file
- `Logo.svg` - Logo file for overlay (optional)
- `Dockerfile` - Container configuration
- `entrypoint.sh` - Container entrypoint script

Then add the overlay service to your `docker-compose.yml` (this is an exmaple config for a basic n8n installation):

```yaml
networks:
  proxy:
    external: false

volumes:
  traefik_data:
  db_data:
  overlay_media:

services:
  traefik:
    image: traefik:v3.1
    container_name: traefik
    restart: unless-stopped
    command:
      - "--configfile=/traefik/traefik.yml"
      - "--certificatesresolvers.le-http.acme.email=yourmail@host.tld"
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
    environment:
      - OVERLAY_DOMAIN
      - OVERLAY_API_KEY
      - OVERLAY_REQUIRE_API_KEY
      - OVERLAY_PORT
      - OVERLAY_MEDIA_DIR
      - OVERLAY_REELS_SUBDIR
      - OVERLAY_TMP_SUBDIR
      - OVERLAY_BG_DIR
    volumes:
      - overlay_media:/app/media
    networks:
      - proxy
    labels:
      traefik.enable: "true"
      traefik.http.services.overlay-svc.loadbalancer.server.port: "8080"
      traefik.http.routers.overlay-media.rule: "Host(`${OVERLAY_DOMAIN:-overlay.localhost}`) && PathPrefix(`/media/`)"
      traefik.http.routers.overlay-media.entrypoints: "websecure"
      traefik.http.routers.overlay-media.tls.certresolver: "le-http"
      traefik.http.routers.overlay-media.middlewares: "securityHeaders@file"
      traefik.http.routers.overlay-media.service: "overlay-svc"

      com.centurylinklabs.watchtower.enable: "false"      
```

## Features

- 🖼️ **Image Overlay**: Add text overlays to any image with professional styling
- 📱 **Instagram-Ready**: Optimized dimensions and styling for social media
- 🎨 **Customizable Text**: Support for unlimited-length titles and source attribution with smart wrapping
- 🏷️ **Logo Overlay**: Optional logo placement in bottom-left corner
- ⚡ **High Performance**: Built with Sharp for fast image processing
- 🐳 **Docker Ready**: Containerized for easy deployment
- 🔄 **Auto-Reload**: Development mode with file watching
- 🎬 **Two-Slide Reels**: Generate 1080×1920 videos with Ken Burns and smooth transitions
- 📁 **File Storage Service**: Upload and manage audio/video files with UUID-based naming
- 🔒 **Secure File Management**: API key protected upload and delete operations

## Quick Start

### Prerequisites

- Node.js >= 20.3.0 (required for Sharp compatibility)
- npm or yarn
- Docker (optional, for containerized deployment)
- ffmpeg (required for video reel generation)

### Development Setup

1. **Clone and setup**:
   ```bash
   git clone RobinWts/overlay_for_Insta
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

### API Key Configuration

The server uses API key authentication for security. Copy the example environment file and customize it:

```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your values
nano .env
```

Or create the `.env` file manually:

```bash
# Create .env file
cat > .env << EOF
PORT=8080
API_KEY=your-secure-api-key-here-change-this-in-production
REQUIRE_API_KEY=true
EOF
```

**Environment Variables:**
- `API_KEY`: Your secret API key (required for all requests)
- `REQUIRE_API_KEY`: Set to `false` to disable API key validation (not recommended for production)
- `PORT`: Server port (default: 8080)
- `BASE_URL`: Base URL for the server (default: http://localhost:8080)
- `MEDIA_DIR`: Media directory path (default: ./media)
- `REELS_SUBDIR`: Reels subdirectory (default: reels)
- `TMP_SUBDIR`: Temporary files subdirectory (default: tmp)
- `BG_DIR`: Background assets directory (default: ./assets/reels_bg)

**Security Notes:**
- Generate a strong, random API key for production use:
  ```bash
  # Generate a secure 32-character hex key
  openssl rand -hex 32
  
  # Or generate a 64-character base64 key
  openssl rand -base64 48
  ```
- Never commit your `.env` file to version control
- The API key must be provided in the `X-API-Key` header for all requests

### API Usage

The server provides multiple endpoints for image processing and reel generation with API key security:

#### Available Endpoints

- `GET /healthz` - Health check (no API key required)
- `GET /overlay` - Image overlay generation
- `GET /2slidesReel` - Two-slide Instagram reel generation
- `GET /3slidesReel` - Three-slide Instagram reel generation
- `POST /store/upload` - File upload service (audio/video)
- `DELETE /store/:id` - File deletion service
- `GET /media/*` - Static media file serving

**Security**: All endpoints except `/healthz` require a valid API key in the `X-API-Key` header.

#### Image Overlay Endpoint

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
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg" -o output.jpg
```

**With custom text and dimensions:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=My%20Awesome%20Post&source=@username&w=1080&h=1350" -o output.jpg
```

**With custom max lines:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Very%20long%20title%20text&maxLines=3" -o output.jpg
```

**Single line title:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Short%20Title&maxLines=1" -o output.jpg
```

**With logo overlay:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=My%20Post&logo=true" -o output.jpg
```

**Full customization:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=Custom%20Title&source=@user&w=800&h=600&maxLines=3&logo=true" -o output.jpg
```

#### Two-Slide Reel Endpoint

```
GET /2slidesReel?slide1=<url>&slide2=<url>&title1=<text>&title2=<text>&duration1=<seconds>&duration2=<seconds>&transition=<type>
```

**Parameters:**
- `slide1` (required): URL of the first slide image
- `slide2` (required): URL of the second slide image
- `title1` (optional): Overlay text for first slide (default: empty)
- `title2` (optional): Overlay text for second slide (default: empty)
- `duration1` (optional): Duration of first slide in seconds (default: 4)
- `duration2` (optional): Duration of second slide in seconds (default: 4)
- `transition` (optional): Transition type between slides (default: "fade")

**Valid transition types:**
- `fade` - Fade between slides
- `slide` - Slide transition
- `dissolve` - Dissolve effect
- `wipe` - Wipe transition

**Notes:**
- Titles are rendered in a centered 1080×1080 safe-zone over a 1080×1920 frame.
- Only remote images are supported; provide publicly accessible URLs.
- ffmpeg is required locally (e.g., `brew install ffmpeg`).

**Examples:**

**Basic usage (minimal parameters):**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/2slidesReel?slide1=https://example.com/slide1.jpg&slide2=https://example.com/slide2.jpg"
```

**With titles and custom durations:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/2slidesReel?slide1=https://example.com/slide1.jpg&slide2=https://example.com/slide2.jpg&title1=First%20Slide&title2=Second%20Slide&duration1=3&duration2=5"
```

**With custom transition:**
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:8080/2slidesReel?slide1=https://example.com/slide1.jpg&slide2=https://example.com/slide2.jpg&transition=slide"
```

**Response:** Returns a JSON object with the video URL and processing information.

#### File Storage Service Endpoints

The server includes a local storage service for managing audio and video files with secure upload and deletion capabilities.

##### Upload File Endpoint

```
POST /store/upload
```

**Request:** multipart/form-data with 'file' field

**Supported File Types:**
- **Audio**: MP3, WAV, OGG, AAC, M4A, FLAC
- **Video**: MP4, AVI, MOV, WMV, FLV, WEBM, MKV, QuickTime

**File Size Limit:** 100MB

**Response:**
```json
{
  "success": true,
  "id": "12345678-1234-1234-1234-123456789abc",
  "filename": "12345678-1234-1234-1234-123456789abc.mp3",
  "originalName": "audio-file.mp3",
  "mimeType": "audio/mpeg",
  "size": 1024000,
  "url": "https://localhost:8080/media/storage/12345678-1234-1234-1234-123456789abc.mp3",
  "uploadTime": "2025-09-25T10:30:00.000Z"
}
```

**Examples:**

**Upload audio file:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -F "file=@audio.mp3" \
  http://localhost:8080/store/upload
```

**Upload video file:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -F "file=@video.mp4" \
  http://localhost:8080/store/upload
```

##### Delete File Endpoint

```
DELETE /store/:id
```

**Parameters:**
- `id` (required): UUID of the file to delete

**Response:**
```json
{
  "success": true,
  "id": "12345678-1234-1234-1234-123456789abc",
  "filename": "12345678-1234-1234-1234-123456789abc.mp3",
  "size": 1024000,
  "deletedAt": "2025-09-25T10:35:00.000Z",
  "message": "File deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE \
  -H "X-API-Key: your-api-key" \
  http://localhost:8080/store/12345678-1234-1234-1234-123456789abc
```

#### Health Check Endpoint

```
GET /healthz
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "endpoints": ["/overlay", "/2slidesReel", "/healthz"]
}
```

## Development

### Local Development Fonts

For the best development experience, install the Inter font locally to match the production Docker environment:

#### macOS
```bash
# Install Inter font using Homebrew
brew install --cask font-inter
```

#### Linux (Ubuntu/Debian)
```bash
# Install Inter font
sudo apt-get update
sudo apt-get install fonts-inter
```

#### Windows
1. Download Inter font from [GitHub releases](https://github.com/rsms/inter/releases)
2. Install the font files through Windows Font Manager

#### Other Platforms
- Download Inter font from the [official repository](https://github.com/rsms/inter)
- Install according to your platform's font installation process

**Note**: The server will fall back to system fonts if Inter is not available, but installing Inter locally ensures your development output matches production exactly.

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm test` - Run server tests
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container

### Project Structure

```
overlay_for_Insta/
├── server.js              # Main Express server (configuration & routing only)
├── helpers.js             # Shared utility functions
├── endpoints/             # Endpoint handlers
│   ├── health.js          # Health check endpoint
│   ├── overlay.js         # Image overlay endpoint
│   ├── reel.js            # Video reel endpoint
│   ├── 3slidesReel.js     # Three-slide reel endpoint
│   └── storage.js         # File storage service endpoints
├── middleware/            # Express middleware
│   └── auth.js            # API key validation middleware
├── test-server.js         # Comprehensive test suite
├── example-usage.js       # Usage examples and demonstrations
├── Logo.svg              # Logo file for overlay (optional)
├── package.json          # Dependencies and scripts
├── Dockerfile            # Container configuration
├── .nvmrc                # Node.js version specification
├── setup-dev.sh          # Development setup script
├── env.example           # Environment variables template
├── media/                # Media directory (created at runtime)
│   ├── reels/            # Generated reels storage
│   ├── tmp/              # Temporary files
│   └── storage/           # File storage service directory
├── assets/               # Static assets directory
│   └── reels_bg/         # Background assets for reels
└── README.md             # This file
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

**Environment Variables for Docker:**
```bash
# Run with custom API key
docker run -p 8080:8080 -e API_KEY=your-secure-api-key overlay-image

# Run with API key validation disabled (not recommended)
docker run -p 8080:8080 -e REQUIRE_API_KEY=false overlay-image
```

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
- ffmpeg (for reel generation; install locally on your host machine)

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
