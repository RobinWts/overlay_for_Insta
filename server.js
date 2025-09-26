/**
 * Overlay Image Server
 * 
 * A Node.js microservice that generates Instagram-style image overlays with customizable text.
 * Takes an image URL and overlays title and source text with professional styling.
 * 
 * Features:
 * - High-performance image processing with Sharp
 * - Smart text wrapping and multi-line support
 * - Professional typography with stroke outlines
 * - Responsive text sizing based on image dimensions
 * - Error handling for invalid URLs and missing parameters
 */

import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Import endpoint handlers
import { healthCheck } from './endpoints/health.js';
import { overlayHandler } from './endpoints/overlay.js';
import { reelHandler } from './endpoints/reel.js';
import { reel3Handler } from './endpoints/3slidesReel.js';
import { uploadHandler, deleteHandler } from './endpoints/storage.js';
import { videoOverlayHandler } from './endpoints/videoOverlay.js';
import { slideWithAudioHandler } from './endpoints/slideWithAudio.js';
import { createReelHandler } from './endpoints/createReel.js';

// Import middleware
import { validateApiKey } from './middleware/auth.js';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();
app.use(express.json({ limit: '2mb' }));

// Set port from environment variable or default to 8080
const PORT = process.env.OVERLAY_PORT || 8080;

// API Security Configuration
const API_KEY = process.env.OVERLAY_API_KEY || 'default-api-key-change-in-production';
const REQUIRE_API_KEY = process.env.OVERLAY_REQUIRE_API_KEY !== 'false'; // Default to true unless explicitly disabled

// Media and Path Configuration
const DOMAIN = process.env.OVERLAY_DOMAIN || 'http://localhost:8080';
const MEDIA_DIR = process.env.OVERLAY_MEDIA_DIR || path.join(process.cwd(), 'media');
const REELS_SUBDIR = process.env.OVERLAY_REELS_SUBDIR || 'reels';
const TMP_SUBDIR = process.env.OVERLAY_TMP_SUBDIR || 'tmp';
const BG_DIR = process.env.OVERLAY_BG_DIR || path.join(process.cwd(), 'assets', 'reels_bg');

// Construct full paths
const REELS_DIR = path.join(MEDIA_DIR, REELS_SUBDIR);
const TMP_DIR = path.join(MEDIA_DIR, TMP_SUBDIR);

// Configuration object to pass to endpoints
const config = {
  API_KEY,
  REQUIRE_API_KEY,
  DOMAIN,
  MEDIA_DIR,
  REELS_SUBDIR,
  TMP_SUBDIR,
  BG_DIR,
  REELS_DIR,
  TMP_DIR
};

// Ensure directories exist
const ensureDirectories = () => {
  const STORAGE_DIR = path.join(MEDIA_DIR, 'storage');
  const directories = [MEDIA_DIR, REELS_DIR, TMP_DIR, BG_DIR, STORAGE_DIR];
  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not create directory ${dir}: ${error.message}`);
    }
  }
};

// Initialize directories on startup
ensureDirectories();

// Serve media files statically
app.use('/media', express.static(MEDIA_DIR, { fallthrough: false }));

// === ENDPOINT DEFINITIONS ===

/**
 * Health check endpoint
 * Simple endpoint to verify server is running
 */
app.get('/healthz', healthCheck);

/**
 * 2 Slides Reel endpoint
 * 
 * This endpoint creates Instagram reels with two slides
 * 
 * GET /2slidesReel?slide1=<url>&slide2=<url>&title1=<text>&title2=<text>&duration1=<seconds>&duration2=<seconds>&transition=<type>
 * 
 * Parameters:
 * - slide1 (required): URL of the first slide image
 * - slide2 (required): URL of the second slide image
 * - title1 (optional): Overlay text for first slide (default: empty)
 * - title2 (optional): Overlay text for second slide (default: empty)
 * - duration1 (optional): Duration of first slide in seconds (default: 4)
 * - duration2 (optional): Duration of second slide in seconds (default: 4)
 * - transition (optional): Transition type between slides (default: 'fade')
 * 
 * Returns:
 * - Video file URL or processing status
 */
app.get('/2slidesReel', validateApiKey(config), (req, res) => reelHandler(req, res, config));

/**
 * 3 Slides Reel endpoint
 * 
 * This endpoint creates Instagram reels with three slides
 * 
 * GET /3slidesReel?slide1=<url>&slide2=<url>&slide3=<url>&title1=<text>&title2=<text>&title3=<text>&duration1=<seconds>&duration2=<seconds>&duration3=<seconds>&transition=<type>
 * 
 * Parameters:
 * - slide1 (required): URL of the first slide image
 * - slide2 (required): URL of the second slide image
 * - slide3 (required): URL of the third slide image
 * - title1 (optional): Overlay text for first slide (default: empty)
 * - title2 (optional): Overlay text for second slide (default: empty)
 * - title3 (optional): Overlay text for third slide (default: empty)
 * - duration1 (optional): Duration of first slide in seconds (default: 4)
 * - duration2 (optional): Duration of second slide in seconds (default: 4)
 * - duration3 (optional): Duration of third slide in seconds (default: 4)
 * - transition (optional): Transition type between slides (default: 'fade')
 * 
 * Returns:
 * - Video file URL or processing status
 */
app.get('/3slidesReel', validateApiKey(config), (req, res) => reel3Handler(req, res, config));

/**
 * Main API endpoint for image overlay generation
 * 
 * GET /overlay?img=<url>&title=<text>&source=<text>&w=<width>&h=<height>&maxLines=<number>&logo=<boolean>
 * 
 * Parameters:
 * - img (required): URL of the source image
 * - title (optional): Text to overlay (no character limit, will wrap and truncate as needed)
 * - source (optional): Source attribution text (no character limit)
 * - w (optional): Output width in pixels (default: 1080)
 * - h (optional): Output height in pixels (default: 1350)
 * - maxLines (optional): Maximum number of lines for title text (default: 5)
 * - logo (optional): Whether to overlay Logo.svg in bottom-left corner (default: false)
 * 
 * Processes an image by:
 * 1. Fetching the source image from the provided URL
 * 2. Generating an SVG overlay with the specified text
 * 3. Compositing the overlay onto the image
 * 4. Adding logo overlay if requested
 * 5. Returning the final image as JPEG
 */
app.get('/overlay', validateApiKey(config), overlayHandler);

/**
 * File upload endpoint for local storage service
 * 
 * POST /store/upload
 * 
 * Accepts audio and video files for storage with the following features:
 * - File size limit: 100MB
 * - Supported formats: MP3, WAV, OGG, AAC, M4A, FLAC (audio) and MP4, AVI, MOV, WMV, FLV, WEBM, MKV, QuickTime (video)
 * - Returns unique file ID and public URL for accessing the file
 * - Files are stored in /media/storage/ directory
 * 
 * Request body: multipart/form-data with 'file' field
 * 
 * Response:
 * - success: boolean indicating upload success
 * - id: unique file identifier (UUID)
 * - filename: generated filename
 * - originalName: original filename from upload
 * - mimeType: detected MIME type
 * - size: file size in bytes
 * - url: public URL for accessing the file
 * - uploadTime: ISO timestamp of upload
 */
app.post('/store/upload', validateApiKey(config), (req, res) => uploadHandler(req, res, config));

/**
 * File deletion endpoint for local storage service
 * 
 * DELETE /store/:id
 * 
 * Deletes a previously uploaded file by its unique ID.
 * 
 * Parameters:
 * - id (required): UUID of the file to delete
 * 
 * Response:
 * - success: boolean indicating deletion success
 * - id: file identifier that was deleted
 * - filename: name of the deleted file
 * - size: size of the deleted file in bytes
 * - deletedAt: ISO timestamp of deletion
 * - message: confirmation message
 */
app.delete('/store/:id', validateApiKey(config), (req, res) => deleteHandler(req, res, config));

/**
 * Video overlay endpoint
 * 
 * This endpoint overlays text on videos stored in the storage directory
 * 
 * GET /videoOverlay?videoID=<filename>&text=<text>&lines=<number>
 * 
 * Parameters:
 * - videoID (required): Filename of the video in storage directory
 * - text (required): Text to overlay on the video
 * - lines (optional): Maximum number of lines for text (default: 5)
 * 
 * Returns:
 * - JSON response with publicURL, filename, and fileID
 * - Uses same text rendering logic as /overlay endpoint
 * - Text positioned at bottom with padding for Instagram previews
 */
app.get('/videoOverlay', validateApiKey(config), (req, res) => videoOverlayHandler(req, res, config));

/**
 * Slide with Audio endpoint
 * 
 * This endpoint creates a video with a single slide image, audio, and optional text overlay.
 * Uses Ken Burns effect and synchronizes audio with video timing.
 * 
 * GET /slideWithAudio?slideID=<filename>&audioID=<filename>&text=<text>&maxlines=<number>
 * 
 * Parameters:
 * - slideID (required): Local filename of image in storage directory
 * - audioID (required): Local filename of audio in storage directory
 * - text (optional): Text to overlay on the video
 * - maxlines (optional): Maximum number of lines for text (default: 5)
 * 
 * Returns:
 * - JSON response with filename and publicURL of the resulting video
 * - Video duration is audio duration + 1 second (0.5s pause at beginning and end)
 * - Uses Ken Burns effect for smooth image animation
 * - Audio starts after 0.5 seconds and ends 0.5 seconds before video end
 * - Video is stored in the storage directory (same as uploaded files)
 */
app.get('/slideWithAudio', validateApiKey(config), (req, res) => slideWithAudioHandler(req, res, config));

/**
 * Create Reel endpoint
 * 
 * This endpoint processes videos from storage and creates reels by either:
 * - Copying/resizing a single video to 1080x1920 format
 * - Stitching multiple videos together with 0.5s fade transitions
 * 
 * GET /createReel?videoID=<filename>&video2ID=<filename>&video3ID=<filename>&video4ID=<filename>
 * 
 * Parameters:
 * - videoID (required): Local filename of video in storage directory
 * - video2ID (optional): Local filename of second video in storage directory
 * - video3ID (optional): Local filename of third video in storage directory
 * - video4ID (optional): Local filename of fourth video in storage directory
 * 
 * Returns:
 * - JSON response with publicURL of the generated video
 * - Single video: copies if 1080x1920, resizes if different resolution
 * - Multiple videos: stitches with 0.5s fade transitions and scales to 1080x1920
 * - Audio is preserved and transferred with fade transitions
 */
app.get('/createReel', validateApiKey(config), (req, res) => createReelHandler(req, res, config));

// === SERVER STARTUP ===

// Start the Express server and log the port
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Overlay Image Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🔐 API Key validation: ${REQUIRE_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  if (REQUIRE_API_KEY) {
    console.log(`🔑 API Key: ${API_KEY.substring(0, 16)}... (use X-API-Key header)`);
  }
  console.log(`🌐 URL: https://${DOMAIN}`);
  console.log(`📁 Media directory: ${MEDIA_DIR}`);
  console.log(`🎬 Reels directory: ${REELS_DIR}`);
  console.log(`📂 Temp directory: ${TMP_DIR}`);
  console.log(`🎨 Background directory: ${BG_DIR}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   GET  /healthz - Health check`);
  console.log(`   GET  /overlay - Image overlay generation`);
  console.log(`   GET  /videoOverlay - Video text overlay generation`);
  console.log(`   GET  /slideWithAudio - Slide with audio and text overlay`);
  console.log(`   GET  /createReel - Video reel creation and stitching`);
  console.log(`   GET  /2slidesReel - Two-slide reel generation`);
  console.log(`   GET  /3slidesReel - Three-slide reel generation`);
  console.log(`   POST /store/upload - File upload service`);
  console.log(`   DELETE /store/:id - File deletion service`);
  console.log(`   GET  /media/* - Static media files`);
  console.log('');
  console.log(`🌐 API endpoint: http://localhost:${PORT}/overlay`);
  console.log(`📝 Example: http://localhost:${PORT}/overlay?img=https://example.com/image.jpg&title=Test&logo=true`);
  console.log(`🎬 Video overlay: http://localhost:${PORT}/videoOverlay?videoID=my-video.mp4&text=Test%20Text`);
  console.log(`🎵 Slide with audio: http://localhost:${PORT}/slideWithAudio?slideID=my-image.jpg&audioID=my-audio.mp3&text=Test%20Text`);
  console.log(`🎬 Create reel: http://localhost:${PORT}/createReel?videoID=my-video.mp4&video2ID=my-video2.mp4`);
  if (REQUIRE_API_KEY) {
    console.log(`🔑 With API key: curl -H "X-API-Key: ${API_KEY}" "http://localhost:${PORT}/overlay?img=https://example.com/image.jpg&title=Test"`);
    console.log(`🔑 Video overlay: curl -H "X-API-Key: ${API_KEY}" "http://localhost:${PORT}/videoOverlay?videoID=my-video.mp4&text=Test%20Text"`);
    console.log(`🔑 Slide with audio: curl -H "X-API-Key: ${API_KEY}" "http://localhost:${PORT}/slideWithAudio?slideID=my-image.jpg&audioID=my-audio.mp3&text=Test%20Text"`);
    console.log(`🔑 Create reel: curl -H "X-API-Key: ${API_KEY}" "http://localhost:${PORT}/createReel?videoID=my-video.mp4&video2ID=my-video2.mp4"`);
  }
  console.log('='.repeat(60));
  console.log('📊 Monitoring enabled - all requests will be logged');
  console.log('⏹️  Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});