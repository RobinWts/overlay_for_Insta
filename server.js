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
  const directories = [MEDIA_DIR, REELS_DIR, TMP_DIR, BG_DIR];
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
  console.log(`   GET  /2slidesReel - Two-slide reel generation`);
  console.log(`   GET  /3slidesReel - Three-slide reel generation`);
  console.log(`   GET  /media/* - Static media files`);
  console.log('');
  console.log(`🌐 API endpoint: http://localhost:${PORT}/overlay`);
  console.log(`📝 Example: http://localhost:${PORT}/overlay?img=https://example.com/image.jpg&title=Test&logo=true`);
  if (REQUIRE_API_KEY) {
    console.log(`🔑 With API key: curl -H "X-API-Key: ${API_KEY}" "http://localhost:${PORT}/overlay?img=https://example.com/image.jpg&title=Test"`);
  }
  console.log('='.repeat(60));
  console.log('📊 Monitoring enabled - all requests will be logged');
  console.log('⏹️  Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});