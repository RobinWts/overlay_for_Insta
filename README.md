# Overlay Image Server

A Node.js server that creates Instagram-style image overlays with customizable title and source text. Perfect for social media content generation and automated image processing.

## Features

- 🖼️ **Image Overlay**: Add text overlays to any image with professional styling
- 📱 **Instagram-Ready**: Optimized dimensions and styling for social media
- 🎨 **Customizable Text**: Support for multi-line titles and source attribution
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
GET /overlay?img=<image_url>&title=<title>&source=<source>&w=<width>&h=<height>
```

#### Parameters

- `img` (required): URL of the source image
- `title` (optional): Text to overlay on the image (max 140 chars)
- `source` (optional): Source attribution text (max 80 chars)
- `w` (optional): Output width (default: 1080)
- `h` (optional): Output height (default: 1350)

#### Example

```bash
curl "http://localhost:8080/overlay?img=https://example.com/image.jpg&title=My%20Awesome%20Post&source=@username&w=1080&h=1350" -o output.jpg
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
- **Professional Styling**: Clean typography with proper contrast
- **Responsive Sizing**: Text scales appropriately with image dimensions
- **Ellipsis Handling**: Truncates text gracefully when needed
- **Multi-line Support**: Up to 5 lines of title text

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
