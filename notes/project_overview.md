# Overlay Image Server - Project Overview

## Project Context
This is an AI-first Node.js microservice that generates Instagram-style image overlays with customizable text. The server takes an image URL and overlays title and source text with professional styling, optimized for social media content generation.

## Core Functionality
- **Image Processing**: Uses Sharp library for high-performance image manipulation
- **Text Overlay**: Renders SVG-based text overlays with professional typography
- **Smart Text Wrapping**: Automatically wraps long titles across multiple lines (up to 5)
- **Responsive Design**: Text scales appropriately with image dimensions
- **Error Handling**: Graceful handling of invalid URLs and missing parameters

## Technical Architecture

### Server Stack
- **Runtime**: Node.js >= 20.3.0 (Sharp requirement)
- **Framework**: Express.js for HTTP server
- **Image Processing**: Sharp (libvips-based) for high-performance image manipulation
- **HTTP Client**: node-fetch for fetching external images
- **Text Rendering**: Custom SVG generation with precise typography control

### API Endpoint
```
GET /overlay?img=<url>&title=<text>&source=<text>&w=<width>&h=<height>
```

**Parameters**:
- `img` (required): Public URL of source image
- `title` (optional): Overlay text, max 140 chars, supports multi-line wrapping
- `source` (optional): Attribution text, max 80 chars
- `w` (optional): Output width, default 1080
- `h` (optional): Output height, default 1350

**Response**: JPEG image with overlay applied

### Text Rendering System
- **Font**: System fonts (-apple-system, Segoe UI, Roboto, Arial)
- **Typography**: Bold weights (700-800) with stroke outlines for readability
- **Layout**: Centered text with gradient backgrounds for contrast
- **Wrapping**: Intelligent word-based wrapping with ellipsis for overflow
- **Positioning**: Top band for title, bottom-right for source attribution

## Development Environment

### Node.js Version Management
- **Required**: Node.js >= 20.3.0 (Sharp compatibility)
- **Manager**: nvm (Node Version Manager)
- **Configuration**: `.nvmrc` file specifies exact version (20.3.0)
- **Setup**: `./setup-dev.sh` script handles environment initialization

### Package Management
- **Package Manager**: npm
- **Type**: ES Modules (type: "module" in package.json)
- **Dependencies**: Production-only (no dev dependencies in Docker)

### Available Scripts
- `npm run dev`: Development server with auto-reload
- `npm start`: Production server
- `npm test`: Comprehensive test suite
- `npm run example`: Usage examples with sample images
- `npm run docker:build`: Build Docker image
- `npm run docker:run`: Run Docker container

## File Structure
```
overlay_for_Insta/
├── server.js              # Main Express server application
├── test-server.js         # Comprehensive test suite
├── example-usage.js       # Usage examples and demonstrations
├── package.json           # Dependencies and scripts
├── Dockerfile            # Production container configuration
├── .nvmrc                # Node.js version specification
├── setup-dev.sh          # Development environment setup
├── README.md             # Human-readable documentation
├── notes/
│   ├── project_overview.md  # This AI context file
│   └── history.md          # Development history and changes
└── .cursorrules          # AI coding rules and preferences
```

## Code Quality Standards

### Coding Style
- **Variables**: camelCase naming convention
- **Comments**: JSDoc comments for all functions
- **Error Handling**: Comprehensive try-catch blocks with meaningful error messages
- **Security**: Parameterized queries, input validation, and sanitization
- **Type Safety**: Maintained throughout the codebase

### Linter Rules
- Ignore double quotes linter errors (project preference)
- Maintain existing functionality when making changes
- Preserve existing comments and documentation

## Docker Configuration

### Production Image
- **Base**: node:20.3.0-bookworm-slim
- **Dependencies**: libvips for Sharp image processing
- **Security**: Non-root user (appuser) for container security
- **Health Check**: Built-in endpoint testing for container health
- **Optimization**: Multi-stage build with proper layer caching

### Container Features
- **Port**: 8080 (configurable via PORT environment variable)
- **User**: Non-root for security
- **Health Check**: Automatic container health monitoring
- **Dependencies**: Only production packages included

## Testing Strategy

### Test Coverage
- **Health Checks**: Server availability and basic functionality
- **Image Processing**: Various image sizes and formats
- **Text Rendering**: Short titles, long titles, multi-line wrapping
- **Error Handling**: Missing parameters, invalid URLs, network failures
- **Edge Cases**: Small images, large images, special characters

### Test Data
- **Image Source**: picsum.photos for reliable test images
- **Test Cases**: Basic functionality, long text, small images, error conditions
- **Validation**: Content-Type verification, file size validation

## Deployment Considerations

### Local Development
- **Setup**: Run `./setup-dev.sh` for one-time environment setup
- **Development**: `npm run dev` for auto-reload development
- **Testing**: `npm test` for comprehensive testing
- **Examples**: `npm run example` for usage demonstrations

### Production Deployment
- **Container**: Use Docker for consistent deployment
- **Environment**: Node.js 20.3.0+ required
- **Dependencies**: libvips must be available
- **Monitoring**: Health check endpoint available for monitoring

## Known Limitations
- **Image Sources**: Requires publicly accessible image URLs
- **Text Length**: Title limited to 140 characters, source to 80 characters
- **Image Formats**: Input images converted to JPEG output
- **Network**: Depends on external image availability

## Security Considerations
- **Input Validation**: All parameters validated and sanitized
- **URL Safety**: External URLs fetched safely with proper error handling
- **Container Security**: Non-root user in Docker container
- **Error Messages**: Generic error responses to avoid information leakage

## Performance Characteristics
- **Image Processing**: Sharp provides high-performance image manipulation
- **Memory Usage**: Efficient buffer handling for image processing
- **Response Time**: Typically < 2 seconds for standard image sizes
- **Concurrency**: Express.js handles multiple concurrent requests

## Integration Points
- **External Images**: Fetches images from any publicly accessible URL
- **Supabase**: Designed to work with Supabase public image URLs
- **Social Media**: Optimized output for Instagram and other social platforms
- **API Clients**: RESTful API for easy integration with other services

## Development Workflow
1. **Setup**: Run `./setup-dev.sh` for initial environment setup
2. **Development**: Use `npm run dev` for development with auto-reload
3. **Testing**: Run `npm test` to verify functionality
4. **Examples**: Use `npm run example` to generate sample outputs
5. **Docker**: Use `npm run docker:build` and `npm run docker:run` for container testing
6. **Deployment**: Deploy Docker container to production environment

## AI Development Guidelines
- Always read this file first for complete project context
- Maintain existing functionality when making changes
- Follow the established coding style and patterns
- Test all changes with the provided test suite
- Update documentation when adding new features
- Preserve error handling and security measures
- Use the established development workflow and scripts
