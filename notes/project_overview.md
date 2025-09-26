# Overlay Image Server - Project Overview

## Project Context
This is an AI-first Node.js microservice that generates Instagram-style image overlays and video reels with customizable text. Originally developed for vServer-hosted n8n workflows, the server provides both static image processing and dynamic video generation capabilities, optimized for social media content creation and automation.

## Core Functionality
- **Image Processing**: Uses Sharp library for high-performance image manipulation
- **Text Overlay**: Renders SVG-based text overlays with professional typography
- **Smart Text Wrapping**: Automatically wraps long titles across multiple lines (up to 5)
- **Responsive Design**: Text scales appropriately with image dimensions
- **Video Generation**: Two-slide Instagram reel creation with customizable transitions
- **API Security**: API key authentication for secure access control
- **Media Management**: Static file serving and organized directory structure
- **Error Handling**: Graceful handling of invalid URLs and missing parameters

## Technical Architecture

### Modular Architecture
The application follows a clean modular architecture with clear separation of concerns:

- **Server Setup** (`server.js`): Express configuration, middleware setup, and route definitions
- **Endpoint Handlers** (`endpoints/`): Business logic for each API endpoint
- **Helper Modules** (`helpers/`): Organized utility functions by functionality
  - `image-helper.js`: Image processing and text overlay generation
  - `video-helper.js`: Video generation and FFmpeg operations
  - `helper.js`: Core utility functions and shared operations
- **Middleware** (`middleware/`): Express middleware for authentication and other concerns
- **Configuration**: Environment-based configuration with dependency injection

### Server Stack
- **Runtime**: Node.js >= 20.3.0 (Sharp requirement)
- **Framework**: Express.js for HTTP server with JSON body parsing
- **Image Processing**: Sharp (libvips-based) for high-performance image manipulation
- **File Upload**: Multer for handling multipart/form-data file uploads
- **UUID Generation**: uuid package for unique file identifiers
- **HTTP Client**: node-fetch for fetching external images
- **Text Rendering**: Custom SVG generation with precise typography control
- **Environment Management**: dotenv for configuration management
- **File System**: Native fs/promises for async file operations
- **Process Management**: child_process for video generation

### API Endpoints

#### Image Overlay Endpoint
```
GET /overlay?img=<url>&title=<text>&source=<text>&w=<width>&h=<height>&maxLines=<number>&logo=<boolean>
```

**Parameters**:
- `img` (required): Public URL of source image
- `title` (optional): Overlay text, unlimited length, supports multi-line wrapping
- `source` (optional): Attribution text, unlimited length
- `w` (optional): Output width, default 1080
- `h` (optional): Output height, default 1350
- `maxLines` (optional): Maximum lines for title text, default 5
- `logo` (optional): Whether to overlay Logo.svg, default false

**Response**: JPEG image with overlay applied

#### Video Overlay Endpoint
```
GET /videoOverlay?videoID=<filename>&text=<text>&lines=<number>
```

**Parameters**:
- `videoID` (required): Filename of the video in storage directory
- `text` (required): Text to overlay on the video
- `lines` (optional): Maximum number of lines for text, default 5

**Features**:
- Uses the same text rendering logic as the image overlay endpoint
- Text is positioned at the bottom with proper padding for Instagram previews
- Supports intelligent text wrapping and truncation with "..."
- Professional typography with stroke outlines for readability
- Preserves original video quality and audio

**Response**: JSON with publicURL, filename, fileID, and processing metadata

#### Slide with Audio Endpoint
```
GET /slideWithAudio?slideID=<filename>&audioID=<filename>&text=<text>&maxlines=<number>
```

**Parameters**:
- `slideID` (required): Local filename of image in storage directory
- `audioID` (required): Local filename of audio in storage directory
- `text` (optional): Text to overlay on the video
- `maxlines` (optional): Maximum number of lines for text, default 5

**Features**:
- Creates a video with a single slide image, audio, and optional text overlay
- Uses Ken Burns effect for smooth image animation with zoom and pan
- Audio is centered with 0.5s pauses at beginning and end
- Video duration = audio duration + 1 second
- Text overlay uses the same rendering logic as videoOverlay endpoint
- Video is stored in the storage directory (same as uploaded files)

**Response**: JSON with publicURL, filename, fileID, slideID, audioID, text, maxLines, audioDuration, totalDuration, processingTime, and createdAt

#### Create Reel Endpoint
```
GET /createReel?videoID=<filename>&video2ID=<filename>&video3ID=<filename>&video4ID=<filename>
```

**Parameters**:
- `videoID` (required): Local filename of video in storage directory
- `video2ID` (optional): Local filename of second video in storage directory
- `video3ID` (optional): Local filename of third video in storage directory
- `video4ID` (optional): Local filename of fourth video in storage directory

**Features**:
- **Single video processing**: If only `videoID` is provided:
  - If resolution is 1080×1920: copies video to reels directory
  - If different resolution: resizes to 1080×1920 while maintaining aspect ratio
- **Multi-video stitching**: If 2-4 videos are provided:
  - Stitches videos sequentially with 0.5-second fade transitions
  - Scales all videos to 1080×1920 format if needed
  - Preserves and transfers audio with crossfade transitions
  - Uses FFmpeg xfade and acrossfade filters for smooth transitions
  - Normalizes frame rates, pixel formats, and aspect ratios for compatibility

**Response**: JSON with publicURL, filename, processingTime, videoCount, and fadeDuration

#### Two-Slide Reel Endpoint (Under Development)
```
GET /2slidesReel?slide1=<url>&slide2=<url>&title1=<text>&title2=<text>&duration1=<seconds>&duration2=<seconds>&transition=<type>
```

**Parameters**:
- `slide1` (required): URL of first slide image
- `slide2` (required): URL of second slide image
- `title1` (optional): Overlay text for first slide
- `title2` (optional): Overlay text for second slide
- `duration1` (optional): Duration of first slide in seconds, default 4
- `duration2` (optional): Duration of second slide in seconds, default 4
- `transition` (optional): Transition type (fade, slide, dissolve, wipe), default fade

**Response**: This function generates a 1080×1920 video with a central 1080×1080 safe zone. Inside this zone, the overlay displays the texts provided via title1 and title2. Below the text, the corresponding image is shown with an adapted Ken Burns effect:
	•	Square or portrait images: gentle panning with a stronger zoom, adjusted to fit the format.
	•	Landscape images: subtle zoom combined with a smooth pan across the frame.
The resulting video is stored locally and made available for download in the directory defined by REELS_SUBDIR.

#### Health Check Endpoint
```
GET /healthz
```

**Response**: JSON status with server information

#### File Storage Service
```
POST /store/upload
```

**Parameters**:
- Request body: multipart/form-data with 'file' field
- File types: Audio (MP3, WAV, OGG, AAC, M4A, FLAC), Video (MP4, AVI, MOV, WMV, FLV, WEBM, MKV, QuickTime), and Image (JPEG, PNG, GIF, WebP, BMP, TIFF, SVG, AVIF)
- File size limit: 100MB

**Response**: JSON with file information including unique ID and public URL

```
DELETE /store/:id
```

**Parameters**:
- id (required): UUID of the file to delete

**Response**: JSON confirmation of deletion with file details

#### Media Serving
```
GET /media/*
```

**Response**: Static media files from configured directory

### Text Rendering System
- **Font**: System fonts (-apple-system, Segoe UI, Roboto, Arial)
- **Typography**: Bold weights (700-800) with stroke outlines for readability
- **Layout**: Centered text with gradient backgrounds for contrast
- **Wrapping**: Intelligent word-based wrapping with ellipsis for overflow
- **Positioning**: Top band for title, bottom-right for source attribution

### Environment Configuration
- **API Security**: API_KEY for authentication, REQUIRE_API_KEY toggle
- **Server Settings**: PORT, BASE_URL for server configuration
- **Media Paths**: MEDIA_DIR, REELS_SUBDIR, TMP_SUBDIR, BG_DIR for file organization
- **Configuration**: Environment variables loaded via dotenv from .env file
- **Template**: env.example provides configuration template

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
- **Environment**: dotenv for configuration management

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
├── server.js              # Main Express server (configuration & routing only)
├── helpers/               # Organized helper modules
│   ├── image-helper.js    # Image processing and text overlay generation
│   ├── video-helper.js    # Video generation and FFmpeg operations
│   └── helper.js          # Core utility functions and shared operations
├── endpoints/             # Endpoint handlers
│   ├── health.js          # Health check endpoint
│   ├── overlay.js         # Image overlay endpoint
│   ├── videoOverlay.js    # Video text overlay endpoint
│   ├── slideWithAudio.js  # Slide with audio and text overlay endpoint
│   ├── reel.js            # Video reel endpoint
│   ├── 3slidesReel.js      # Three-slide reel endpoint
│   └── storage.js         # File storage service endpoints
├── middleware/            # Express middleware
│   └── auth.js            # API key validation middleware
├── test-server.js         # Comprehensive test suite
├── example-usage.js       # Usage examples and demonstrations
├── package.json           # Dependencies and scripts
├── Dockerfile            # Production container configuration
├── .nvmrc                # Node.js version specification
├── setup-dev.sh          # Development environment setup
├── env.example           # Environment variables template
├── Logo.svg              # Logo file for overlay (optional)
├── README.md             # Human-readable documentation
├── media/                # Media directory (created at runtime)
│   ├── reels/            # Generated reels storage
│   ├── tmp/              # Temporary files
│   └── storage/           # File storage service directory
├── assets/               # Static assets directory
│   └── reels_bg/         # Background assets for reels
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
- **API Key Validation**: Authentication and authorization testing
- **Image Processing**: Various image sizes and formats
- **Text Rendering**: Short titles, long titles, multi-line wrapping
- **Reel Generation**: Parameter validation and endpoint testing
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
- **Text Length**: No character limits (handled by wrapping and truncation)
- **Image Formats**: Input images converted to JPEG output
- **Video Generation**: Currently under development (returns 501 Not Implemented)
- **Network**: Depends on external image availability
- **API Key**: Required for all endpoints except health check

## Security Considerations
- **API Key Authentication**: All endpoints (except health check) require valid API key
- **Input Validation**: All parameters validated and sanitized
- **URL Safety**: External URLs fetched safely with proper error handling
- **Container Security**: Non-root user in Docker container
- **Error Messages**: Generic error responses to avoid information leakage
- **Environment Variables**: Sensitive configuration via environment variables

## Performance Characteristics
- **Image Processing**: Sharp provides high-performance image manipulation
- **Memory Usage**: Efficient buffer handling for image processing
- **Response Time**: Typically < 2 seconds for standard image sizes
- **Concurrency**: Express.js handles multiple concurrent requests

## Integration Points
- **External Images**: Fetches images from any publicly accessible URL
- **n8n Workflows**: Originally designed for vServer-hosted n8n automation
- **Supabase**: Designed to work with Supabase public image URLs
- **Social Media**: Optimized output for Instagram and other social platforms
- **API Clients**: RESTful API for easy integration with other services
- **Docker Compose**: Easy integration into existing containerized environments

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
