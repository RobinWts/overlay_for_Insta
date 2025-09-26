# Development History

## 2025-09-26 - Video Overlay Endpoint Implementation

### New Feature: Video Text Overlay
- **New Endpoint**: Added `/videoOverlay` endpoint for overlaying text on videos
- **Video Processing**: Uses FFmpeg to overlay text on videos stored in storage directory
- **Text Positioning**: Bottom-aligned text with proper padding for Instagram previews
- **Consistent Typography**: Uses same font, stroke, and line break logic as image overlay

### Technical Implementation
1. **New Endpoint Handler**: `endpoints/videoOverlay.js`
   - Parameter validation for videoID, text, and lines
   - Video file lookup in storage directory
   - Video metadata extraction using FFprobe
   - Custom SVG generation with bottom-aligned positioning
   - FFmpeg video processing with text overlay

2. **Custom Video SVG Function**: `makeVideoSvg()`
   - Replicates text wrapping and truncation logic from image overlay
   - Calculates actual number of lines after text processing
   - Positions text at bottom with 10% padding for Instagram previews
   - Maintains professional typography with stroke outlines

3. **Server Integration**:
   - Added endpoint registration in `server.js`
   - Updated server startup logging to include new endpoint
   - Added comprehensive test cases in `test-server.js`

### API Specification
- **Endpoint**: `GET /videoOverlay?videoID=<filename>&text=<text>&lines=<number>`
- **Parameters**:
  - `videoID` (required): Filename of video in storage directory
  - `text` (required): Text to overlay on video
  - `lines` (optional): Maximum lines for text (default: 5, range: 1-20)
- **Response**: JSON with publicURL, filename, fileID, and processing metadata

### Documentation Updates
- **README.md**: Added comprehensive documentation with examples
- **project_overview.md**: Updated API endpoints and file structure
- **Test Coverage**: Added test cases for parameter validation and error handling

### Key Features
- **Instagram-Optimized**: Text positioned at bottom with proper padding
- **Intelligent Text Wrapping**: Same logic as image overlay with truncation
- **Video Quality Preservation**: Maintains original video quality and audio
- **Error Handling**: Comprehensive validation and error responses
- **API Security**: Protected with same API key validation as other endpoints

## 2025-09-26 - Helper Module Refactoring

### Major Improvements
- **Modular Architecture**: Refactored monolithic `helpers.js` into organized helper modules
- **Improved Maintainability**: Functions now grouped by functionality for better code organization
- **Enhanced Developer Experience**: Easier to locate and modify specific functionality
- **Preserved Functionality**: All existing features maintained with comprehensive testing

### Technical Changes
1. **New Helper Module Structure**:
   - `helpers/image-helper.js`: Image processing and text overlay generation
     - `makeSvg()`: SVG overlay generation with intelligent text wrapping
     - `downloadImage()`: Image downloading functionality
   - `helpers/video-helper.js`: Video generation and FFmpeg operations
     - `buildFFmpegCommand()`: FFmpeg command building for 2-slide videos
     - `build3SlidesFFmpegCommand()`: FFmpeg command building for 3-slide videos
     - `buildFilterComplex()`: Filter complex generation for Ken Burns effects
     - `build3SlidesFilterComplex()`: 3-slide filter complex generation
     - `generate2SlidesReel()`: Complete 2-slide reel generation
     - `generate3SlidesReel()`: Complete 3-slide reel generation
   - `helpers/helper.js`: Core utility functions and shared operations
     - `generateTextOverlay()`: Text overlay PNG generation for videos
     - `execFFmpeg()`: FFmpeg execution wrapper

2. **Import Statement Updates**:
   - `endpoints/overlay.js`: Updated to import from `helpers/image-helper.js`
   - `endpoints/reel.js`: Updated to import from `helpers/video-helper.js`
   - `endpoints/3slidesReel.js`: Updated to import from `helpers/video-helper.js`

3. **Dockerfile Updates**:
   - Updated to copy `helpers/` directory instead of single `helpers.js` file
   - Maintained proper file ownership and permissions

4. **Documentation Updates**:
   - **README.md**: Updated file structure to reflect new helper organization
   - **notes/project_overview.md**: Updated architecture description and file structure
   - **File Structure**: Now shows organized `/helpers` directory with three focused modules

### Code Quality Improvements
- **Better Separation of Concerns**: Image processing, video generation, and core utilities are now clearly separated
- **Reduced File Size**: Each helper file is focused and manageable
- **Improved Readability**: Functions are easier to locate and understand
- **Maintained Type Safety**: All existing type safety measures preserved
- **Preserved Error Handling**: All error handling and security measures maintained

### Testing Results
- **Comprehensive Testing**: All functionality verified through complete test suite
- **No Breaking Changes**: All existing endpoints continue to work exactly as before
- **Performance Maintained**: No performance impact from refactoring
- **Linting Clean**: No linting errors in any of the new helper modules

### Benefits Achieved
- **Enhanced Maintainability**: Easier to modify specific functionality without affecting other areas
- **Improved Code Organization**: Clear structure makes the codebase more professional
- **Better Developer Experience**: Easier to understand and work with the codebase
- **Future-Proof Architecture**: Modular structure supports easier feature additions
- **Preserved Functionality**: Zero impact on existing API endpoints and functionality

## 2025-09-25 - Local Storage Service Implementation

### Major Improvements
- **File Upload Service**: Implemented `POST /store/upload` endpoint for audio and video file uploads
- **File Deletion Service**: Implemented `DELETE /store/:id` endpoint for file management
- **File Type Validation**: Comprehensive validation for audio and video file types
- **Unique File Naming**: UUID-based file naming system to prevent conflicts
- **File Size Limits**: 100MB maximum file size with proper error handling
- **Storage Management**: Organized file storage in dedicated `/media/storage/` directory

### Technical Changes
1. **New Dependencies Added**:
   - `multer`: For handling multipart/form-data file uploads
   - `uuid`: For generating unique file identifiers
   - Both dependencies properly documented and included in Dockerfile

2. **Storage Endpoint Implementation**:
   - `endpoints/storage.js`: Complete storage service with upload and delete handlers
   - File type validation for audio (MP3, WAV, OGG, AAC, M4A, FLAC) and video (MP4, AVI, MOV, WMV, FLV, WEBM, MKV, QuickTime)
   - UUID-based file naming with original file extension preservation
   - Comprehensive error handling for all failure scenarios

3. **Server Integration**:
   - Added storage routes to `server.js` with proper API key authentication
   - Updated directory creation to include storage directory
   - Enhanced server startup logging to include new endpoints

4. **Testing & Documentation**:
   - Added comprehensive test cases to `test-server.js` for upload and delete operations
   - Created `example-storage.js` with practical usage demonstrations
   - Updated project documentation with storage service details

5. **Docker Support**:
   - Updated Dockerfile to include storage directory creation
   - All new dependencies automatically included via package.json

### API Endpoints Added

#### POST /store/upload
- **Purpose**: Upload audio and video files for storage
- **Request**: multipart/form-data with 'file' field
- **Supported Types**: Audio (MP3, WAV, OGG, AAC, M4A, FLAC) and Video (MP4, AVI, MOV, WMV, FLV, WEBM, MKV, QuickTime)
- **File Size Limit**: 100MB
- **Response**: JSON with file ID, filename, original name, MIME type, size, public URL, and upload timestamp

#### DELETE /store/:id
- **Purpose**: Delete previously uploaded files by UUID
- **Parameters**: id (required) - UUID of the file to delete
- **Response**: JSON confirmation with file details and deletion timestamp
- **Validation**: Ensures UUID format is valid before attempting deletion

### Key Features
- **Security**: API key authentication required for all operations
- **File Validation**: Only allows audio and video files, rejects other types
- **Unique Naming**: UUID-based filenames prevent naming conflicts
- **Error Handling**: Comprehensive error responses for all failure scenarios
- **Logging**: Detailed request logging with unique request IDs
- **Storage Organization**: Files stored in organized `/media/storage/` directory
- **Public Access**: Files accessible via `/media/storage/` URL path

### Files Created
- `endpoints/storage.js` - Storage service endpoint handlers (248 lines)
- `example-storage.js` - Usage examples and demonstrations (202 lines)

### Files Modified
- `server.js` - Added storage routes and directory management
- `package.json` - Added multer and uuid dependencies, new example script
- `Dockerfile` - Added storage directory creation
- `test-server.js` - Added comprehensive storage endpoint tests
- `notes/project_overview.md` - Updated with storage service documentation

### Testing Results
- ✅ File upload functionality working correctly
- ✅ File deletion functionality working correctly
- ✅ File type validation working properly
- ✅ Error handling for invalid files and missing parameters
- ✅ UUID generation and file naming working correctly
- ✅ API key authentication working for all endpoints
- ✅ All tests pass successfully
- ✅ No linting errors introduced

### Usage Examples
```bash
# Upload a file
curl -X POST -H "X-API-Key: your-api-key" \
  -F "file=@audio.mp3" \
  http://localhost:8080/store/upload

# Delete a file
curl -X DELETE -H "X-API-Key: your-api-key" \
  http://localhost:8080/store/12345678-1234-1234-1234-123456789abc

# Run tests
npm test

# Run storage examples
npm run example:storage
```

## 2025-09-21 - Major Code Refactoring: Modular Architecture

### Major Improvements
- **3SlidesReel**: new endpoint for 3 slides reel generation
- **deprecation fix**: fixed deprecation warning due to rmkd NODE call
- **Debug output**: added debug output to svg creation
- **documentation**: documentation and notes updated

## 2025-09-18 - Major Code Refactoring: Modular Architecture

### Major Improvements
- **Modular Architecture**: Refactored monolithic server.js into clean, maintainable modules
- **Separation of Concerns**: Each endpoint now has its own dedicated file
- **Reusable Helpers**: Centralized utility functions in dedicated helpers.js file
- **Clean Server Setup**: Main server.js now focuses only on configuration and routing
- **Improved Maintainability**: 81% reduction in main server file size (972 → 172 lines)
- **Better Testability**: Individual components can now be tested in isolation

### Technical Changes
1. **File Structure Reorganization**:
   - `server.js` - Now only contains server setup, configuration, and endpoint definitions
   - `helpers.js` - All shared utility functions (makeSvg, downloadImage, generateTextOverlay, etc.)
   - `endpoints/health.js` - Health check endpoint handler
   - `endpoints/overlay.js` - Image overlay endpoint handler  
   - `endpoints/reel.js` - Video reel endpoint handler
   - `middleware/auth.js` - API key validation middleware

2. **Helper Functions Extracted**:
   - `makeSvg()` - SVG generation for text overlays
   - `downloadImage()` - Image downloading utility
   - `generateTextOverlay()` - Text overlay generation for videos
   - `buildFFmpegCommand()` - FFmpeg command building
   - `buildFilterComplex()` - FFmpeg filter complex building
   - `execFFmpeg()` - FFmpeg execution
   - `generate2SlidesReel()` - Main video generation function

3. **Endpoint Modularization**:
   - Each endpoint is now self-contained with its own file
   - Clean separation between business logic and server setup
   - Configuration object passed to endpoints for dependency injection
   - Middleware functions properly separated and reusable

4. **Import/Export Structure**:
   - All modules use ES6 import/export syntax
   - Clean dependency management between modules
   - Proper separation of concerns maintained

### Benefits
- **Maintainability**: Much easier to find and modify specific functionality
- **Scalability**: New endpoints can be added without touching existing code
- **Reusability**: Helper functions can be easily reused across different endpoints
- **Testing**: Individual components can be unit tested in isolation
- **Code Organization**: Clear structure makes the codebase more professional
- **Team Development**: Multiple developers can work on different endpoints simultaneously
- **Debugging**: Issues can be isolated to specific modules more easily

### Files Created
- `helpers.js` - Centralized utility functions (502 lines)
- `endpoints/health.js` - Health check handler (21 lines)
- `endpoints/overlay.js` - Overlay endpoint handler (198 lines)
- `endpoints/reel.js` - Reel endpoint handler (167 lines)
- `middleware/auth.js` - Authentication middleware (46 lines)

### Files Modified
- `server.js` - Refactored to modular structure (172 lines, down from 972)
- `notes/history.md` - This entry

### Testing Results
- ✅ All existing functionality preserved
- ✅ All tests pass successfully
- ✅ API key validation works correctly
- ✅ Image overlay generation works correctly
- ✅ Video reel generation works correctly
- ✅ Error handling preserved
- ✅ No linting errors introduced

## 2025-09-17 - Two-Slide Reel Endpoint (ffmpeg Ken Burns + text overlays)

### Major Improvements
- **Two-Slide Reels**: Implemented `GET /2slidesReel` to generate 1080×1920 videos.
- **Ken Burns Effect**: Smooth zoom/pan per slide using ffmpeg `zoompan`.
- **Text Overlays**: Reused `makeSvg` to render titles centered in a 1080×1080 safe-zone.
- **Transitions**: Added cross-fade via `xfade` with support for `fade`, `slide`, `dissolve`, `wipe`.
- **Media Management**: Ensured `media/reels` and `media/tmp` directories exist.

### Technical Changes
1. **Endpoint**: Added `/2slidesReel` with validation: `slide1`, `slide2` (required), `title1`, `title2` (optional), `duration1`, `duration2` (1–30s), `transition` (fade|slide|dissolve|wipe), `maxLines` (1–20).
2. **Helpers**:
   - `downloadToFile(url, destPath)`: Fetches remote images using `node-fetch` and saves to disk.
   - `generateVideoOverlayPng(title, maxLines)`: Builds safe-zone overlay PNG via `makeSvg` + Sharp.
   - `runFfmpeg(args)`: Spawns ffmpeg with robust error capture.
   - `mapTransition(name)`: Maps friendly names to `xfade` transitions.
3. **ffmpeg Pipeline**:
   - Inputs: two looped images + two overlay PNGs.
   - Filters: `scale` → `zoompan` (Ken Burns), `overlay` (text), `xfade` for transition, `format=yuv420p`.
   - Encoding: `libx264`, `-preset veryfast`, `-crf 20`, `+faststart`.
4. **Directories**: Created and used `MEDIA_DIR/reels` and `MEDIA_DIR/tmp` for outputs and temp files.
5. **Logging & Errors**: Request-scoped IDs, parameter logs, and graceful 4xx/5xx responses.

### Files Modified
- `server.js` — Added helpers, directory setup, ffmpeg integration, and `/2slidesReel` endpoint.
- `notes/history.md` — This entry.

## 2025-09-15 - Comprehensive Console Logging and Monitoring

### Major Improvements
- **Request Tracking**: Added unique request IDs for tracking individual requests
- **Performance Monitoring**: Detailed timing information for each processing step
- **Progress Logging**: Step-by-step console output showing processing progress
- **Error Tracking**: Enhanced error logging with request context
- **Startup Information**: Comprehensive server startup information display
- **Inter Font Support**: Added Inter font family to Docker container for professional typography
- **Font Dependencies**: Installed complete font rendering stack (Pango, HarfBuzz, Cairo, RSVG)
- **Font Cache Management**: Added font cache rebuilding for proper font registration
- **Fallback Fonts**: Added Liberation and DejaVu fonts as reliable fallbacks
- **Development Font Guidance**: Added README section for local font installation during development

### Technical Changes
1. **Request ID System**:
   - Generated unique 9-character request IDs for each request
   - All log messages include request ID for easy tracking
   - Enables monitoring multiple concurrent requests

2. **Performance Metrics**:
   - Image fetch timing (network performance)
   - SVG generation timing (text processing performance)
   - Logo processing timing (file I/O performance)
   - Sharp processing timing (image manipulation performance)
   - Total request timing (end-to-end performance)

3. **Detailed Logging**:
   - Parameter validation logging with sanitized values
   - Image fetch status and size information
   - Logo processing details (dimensions, file size)
   - Composite operations count
   - Final output size and processing time

4. **Enhanced Startup**:
   - Professional startup banner
   - API endpoint information
   - Usage examples
   - Monitoring status indication

5. **Bug fix**:
   - fixed some Dockerfile issues and included package-lock.json

6. **Dockerfile Enhancements**:
   - Added `fonts-inter` package for Inter font family
   - Added `librsvg2-2` for SVG rendering support
   - Added `libpango-1.0-0` for text layout and rendering
   - Added `libharfbuzz0b` for OpenType text shaping
   - Added `libcairo2` for 2D graphics and text rendering
   - Added `fontconfig` for font configuration management
   - Added `fonts-liberation` and `fonts-dejavu-core` as fallback fonts
   - Added `fc-cache -f -v` to rebuild font cache after installation

### Benefits
- **Debugging**: Easy to track down issues with specific requests
- **Performance**: Identify bottlenecks in the processing pipeline
- **Monitoring**: Real-time visibility into server operations
- **Development**: Better understanding of request flow and timing
- **Production**: Professional logging for production monitoring
- **Professional Typography**: Inter font provides superior text rendering quality
- **Consistent Output**: Same fonts across all environments (local, Docker, production)
- **Better Readability**: Inter is specifically designed for digital interfaces
- **Robust Fallbacks**: Multiple font families ensure text always renders properly
- **Development Parity**: Local development can match production font rendering

### Files Modified
- `server.js` - Added comprehensive logging throughout
- `Dockerfile` - fixed install
- `notes/history.md` - This file

## 2025-09-14 - Enhanced Text Handling and Logo Overlay Feature

### Major Improvements
- **Removed Character Limits**: Eliminated arbitrary 140-character limit for titles and 80-character limit for source text
- **Added maxLines Parameter**: New optional parameter to control maximum number of lines for title text (default: 5, range: 1-20)
- **Added Logo Overlay**: New optional boolean parameter to overlay Logo.svg in bottom-left corner (default: false)
- **Enhanced Text Wrapping**: Improved text wrapping algorithm to handle unlimited text length with smart truncation
- **Better API Documentation**: Updated all documentation to reflect new parameter structure and capabilities

### Technical Changes
1. **API Parameters**:
   - Removed character limits from `title` and `source` parameters
   - Added `maxLines` parameter with validation (1-20 range)
   - Added `logo` boolean parameter for logo overlay
   - Updated parameter extraction and validation logic

2. **makeSvg Function**:
   - Added `maxLines` parameter to function signature
   - Updated JSDoc documentation
   - Removed hardcoded maxLines value

3. **Logo Overlay System**:
   - Added logo file reading and processing logic
   - Uses logo at original size (no resizing - adjust SVG file for sizing)
   - Added bottom-left positioning with 20px padding from image border
   - Graceful error handling when logo file is missing
   - Logo conversion to PNG for optimal compositing

4. **Text Processing**:
   - Enhanced text wrapping algorithm to work with unlimited text
   - Improved ellipsis handling for better user experience
   - Better validation and error handling

5. **Documentation Updates**:
   - Updated README.md with new parameter information
   - Added multiple usage examples including logo overlay
   - Enhanced feature descriptions
   - Added logo file requirements section

### Benefits
- **More Flexible**: Users can now use any length of text
- **Better Control**: maxLines parameter allows fine-tuning of text layout
- **Brand Consistency**: Logo overlay ensures consistent branding across images
- **Cleaner API**: Removed arbitrary limitations that didn't serve a purpose
- **Better UX**: Smart wrapping and truncation provide better user experience
- **Professional Look**: Logo overlay adds professional branding to generated images

### Files Modified
- `server.js` - Core functionality updates with logo overlay
- `README.md` - Documentation updates with logo parameter
- `Logo.svg` - Sample logo file for testing
- `notes/history.md` - This file

## 2025-09-13 - Enhanced Development Environment

### Issues Resolved
- **Node.js Version Compatibility**: Fixed Sharp dependency issue by upgrading from Node.js v20.2.0 to v20.3.0
- **Development Setup**: Created comprehensive development environment with nvm for version management
- **Docker Optimization**: Updated Dockerfile with proper Node.js version, security improvements, and health checks

### Enhancements Added
1. **Package.json Improvements**:
   - Added proper metadata (name, description, author, license)
   - Specified Node.js engine requirements (>=20.3.0)
   - Added comprehensive npm scripts for development and deployment
   - Added keywords for better discoverability

2. **Development Tools**:
   - Created `setup-dev.sh` script for easy environment setup
   - Added `.nvmrc` file for consistent Node.js version across environments
   - Created comprehensive test suite (`test-server.js`)
   - Added example usage script (`example-usage.js`)

3. **Docker Improvements**:
   - Updated to use Node.js 20.3.0 specifically
   - Added non-root user for security
   - Implemented health checks
   - Optimized layer caching
   - Added proper error handling

4. **Documentation**:
   - Created comprehensive README.md with usage examples
   - Added troubleshooting section
   - Documented all available scripts and commands

### Testing Results
- ✅ All server functionality working correctly
- ✅ Image overlay generation successful
- ✅ Text wrapping and multi-line support working
- ✅ Error handling for missing parameters
- ✅ Docker container builds and runs successfully
- ✅ Health checks functioning properly

### Files Created/Modified
- `package.json` - Enhanced with metadata and scripts
- `Dockerfile` - Updated for production readiness
- `test-server.js` - Comprehensive test suite
- `example-usage.js` - Usage examples
- `setup-dev.sh` - Development setup script
- `.nvmrc` - Node.js version specification
- `README.md` - Complete documentation
- `notes/history.md` - This file

### Next Steps for Production
1. Deploy to server using Docker
2. Set up proper logging and monitoring
3. Consider adding rate limiting for production use
4. Add environment variable configuration for different environments
