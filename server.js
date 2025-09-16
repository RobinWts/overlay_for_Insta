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
import sharp from 'sharp';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();
app.use(express.json({ limit: '2mb' }));

// Set port from environment variable or default to 8080
const PORT = process.env.PORT || 8080;

// API Security Configuration
const API_KEY = process.env.API_KEY || 'default-api-key-change-in-production';
const REQUIRE_API_KEY = process.env.REQUIRE_API_KEY !== 'false'; // Default to true unless explicitly disabled

// Media and Path Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'media');

// Ensure directories exist
const ensureDirectories = () => {
  const directories = [MEDIA_DIR];
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

/**
 * API Key Validation Middleware
 * 
 * Validates the API key from the X-API-Key header if API key validation is enabled.
 * This provides basic security for the overlay service.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
const validateApiKey = (req, res, next) => {
  // Skip validation if API key requirement is disabled
  if (!REQUIRE_API_KEY) {
    return next();
  }

  // Extract API key from X-API-Key header
  const providedKey = req.headers['x-api-key'];

  if (!providedKey) {
    console.log(`❌ [${req.id || 'unknown'}] Missing API key in request headers`);
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide your API key in the X-API-Key header'
    });
  }

  if (providedKey !== API_KEY) {
    console.log(`❌ [${req.id || 'unknown'}] Invalid API key provided`);
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  console.log(`✅ [${req.id || 'unknown'}] API key validated successfully`);
  next();
};

/**
 * Health check endpoint
 * Simple endpoint to verify server is running
 */
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: ['/overlay', '/2slidesReel', '/healthz']
  });
});

/**
 * 2 Slides Reel endpoint (placeholder for future implementation)
 * 
 * This endpoint will create Instagram reels with two slides
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
/**
 * 2 Slides Reel endpoint (placeholder implementation)
 * 
 * GET /2slidesReel - Returns not implemented status
 */
app.get('/2slidesReel', validateApiKey, async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🎬 [${requestId}] 2slidesReel request (not implemented)`);

  res.status(501).json({
    error: 'Not Implemented',
    message: '2slidesReel endpoint is not yet implemented',
    requestId
  });
});


/**
 * Generates SVG overlay with centered title text and source attribution
 * 
 * This function creates a professional-looking text overlay that can be composited
 * onto images. It handles text wrapping, sizing, and positioning automatically.
 * 
 * @param {number} w - Width of the target image
 * @param {number} h - Height of the target image  
 * @param {string} rawTitle - The title text to overlay (no character limit)
 * @param {string} rawSource - The source attribution text (no character limit)
 * @param {number} maxLines - Maximum number of lines for title text (default: 5)
 * @returns {string} SVG markup as a string
 */
const makeSvg = (w, h, rawTitle, rawSource, maxLines = 5) => {
  /**
   * HTML entity escape function to prevent XSS and ensure proper XML rendering
   * Escapes common HTML/XML special characters that could break SVG parsing
   */
  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Clean and trim input strings, providing empty string fallbacks
  const title = (rawTitle || '').trim();
  const source = (rawSource || '').trim();

  // === TYPOGRAPHY AND LAYOUT CALCULATIONS ===

  // Use the smaller dimension as base for proportional sizing
  // This ensures text scales appropriately for both portrait and landscape images
  const base = Math.min(w, h);

  // Calculate font sizes as percentages of the base dimension
  // These ratios have been tuned for optimal readability across different image sizes
  const fsTitle = Math.round(base * 0.055);      // Title font size (5.5% of base dimension)
  const fsSrc = Math.round(base * 0.028);     // Source font size (2.8% of base dimension)

  // Calculate line height for proper text spacing
  // 1.12 ratio provides good readability without excessive spacing
  const lineH = Math.round(fsTitle * 1.12);

  // Calculate padding values for proper text positioning
  const topPad = Math.round(h * 0.08);         // Top padding (8% of image height)
  const sidePad = Math.round(w * 0.08);         // Side padding (8% of image width)

  // Use the provided maxLines parameter (prevents overflow)
  // Default is 5, but can be customized via API parameter

  // === TEXT WRAPPING ALGORITHM ===

  // Estimate characters per line based on font size and available width
  // 0.60 is an empirical ratio for character width to font size
  // Math.max(10, ...) ensures minimum 10 characters per line for readability
  const estCharsPerLine = Math.max(10, Math.floor((w - 2 * sidePad) / (fsTitle * 0.60)));

  // Split title into words for intelligent wrapping
  const words = title.split(/\s+/);
  const lines = [];
  let line = '';

  // Word-by-word wrapping algorithm
  for (const word of words) {
    // Test if adding this word would exceed the line length
    const test = line ? line + ' ' + word : word;

    if (test.length > estCharsPerLine) {
      // Current line is full, save it and start a new line
      if (line) lines.push(line);
      line = word;

      // Stop if we've reached the maximum number of lines
      if (lines.length >= maxLines) break;
    } else {
      // Word fits on current line, add it
      line = test;
    }
  }

  // Add the last line if there's content and we haven't exceeded max lines
  if (lines.length < maxLines && line) lines.push(line);

  // === ELLIPSIS HANDLING FOR TRUNCATED TEXT ===

  // Check if all words from the original title were used
  const usedAllWords = (lines.join(' ').trim().length >= title.trim().length);

  // Add ellipsis if text was truncated or we exceeded max lines
  if (!usedAllWords || lines.length > maxLines) {
    // Get the last line that will be displayed
    let last = lines[Math.min(lines.length, maxLines) - 1] || '';
    const maxForLast = estCharsPerLine - 1; // Reserve space for ellipsis

    if (last.length > maxForLast) {
      // Truncate the last line and add ellipsis
      last = last.slice(0, Math.max(0, maxForLast)) + '…';
    } else if (!usedAllWords) {
      // Remove any trailing periods and add ellipsis
      last = last.replace(/\.*$/, '') + '…';
    }

    // Ensure we don't exceed max lines and update the last line
    lines.length = Math.min(lines.length, maxLines);
    lines[lines.length - 1] = last;
  }

  // === POSITIONING CALCULATIONS ===

  // Calculate the total height needed for all text lines
  const blockH = lines.length * lineH;

  // Calculate starting Y position for text, with slight offset for better visual balance
  const startY = Math.max(topPad, Math.round(topPad + fsTitle * 0.2));

  // Calculate bottom band height for source attribution positioning
  const bottomBandH = Math.round(h * 0.22);

  // === STROKE WIDTH CALCULATIONS ===

  // Calculate stroke widths for text outlines (for better readability)
  // Stroke width is proportional to font size for consistent appearance
  const strokeTitle = Math.max(1, Math.round(fsTitle * 0.08));  // 8% of title font size
  const strokeSrc = Math.max(1, Math.round(fsSrc * 0.08));    // 8% of source font size

  // === SVG GENERATION ===

  // Return the complete SVG markup with all calculated values
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <!-- Title text group (centered, with stroke outline) -->
  <g font-family="Inter, -apple-system, Segoe UI, Roboto, Arial"
     font-weight="800"
     font-size="${fsTitle}"
     text-anchor="middle"
     style="fill:#fff; stroke:#000; stroke-width:${strokeTitle}px; paint-order:stroke fill;">
    ${lines.map((ln, i) =>
    `<text x="${Math.round(w / 2)}" y="${startY + i * lineH}">${esc(ln)}</text>`
  ).join('\n    ')}
  </g>

  <!-- Source attribution (bottom right corner) -->
  <text x="${w - sidePad}" y="${h - Math.round(bottomBandH * 0.35)}"
        font-family="Inter, -apple-system, Segoe UI, Roboto, Arial"
        font-weight="600" font-size="${fsSrc}"
        text-anchor="end"
        style="fill:#fff; stroke:#000; stroke-width:${strokeSrc}px; paint-order:stroke fill;">
    ${esc(source)}
  </text>
</svg>`;
};

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
app.get('/overlay', validateApiKey, async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9); // Generate unique request ID
  const startTime = Date.now();

  console.log(`🚀 [${requestId}] New overlay request started`);
  console.log(`📋 [${requestId}] Request parameters:`, {
    img: req.query.img ? 'provided' : 'missing',
    title: req.query.title ? `"${req.query.title.substring(0, 50)}${req.query.title.length > 50 ? '...' : ''}"` : 'none',
    source: req.query.source ? `"${req.query.source}"` : 'none',
    w: req.query.w || 'default (1080)',
    h: req.query.h || 'default (1350)',
    maxLines: req.query.maxLines || 'default (5)',
    logo: req.query.logo || 'default (false)'
  });

  try {
    // === PARAMETER EXTRACTION AND VALIDATION ===

    // Extract and validate required image URL parameter
    const img = req.query.img;                 // Public URL of source image
    if (!img) {
      console.log(`❌ [${requestId}] Missing required parameter: img`);
      return res.status(400).json({ error: 'img required' });
    }

    // Extract text parameters (no character limits - will be handled by wrapping/truncation)
    const title = req.query.title || '';       // Title text (no character limit)
    const source = req.query.source || '';     // Source text (no character limit)

    // Extract dimensions with Instagram-native defaults (optional parameters)
    // Instagram's native post size is 1080x1350 (4:5 aspect ratio)
    const W = Number(req.query.w || 1080);     // Width (optional, default: 1080px)
    const H = Number(req.query.h || 1350);     // Height (optional, default: 1350px)

    // Extract maxLines parameter with default of 5
    const maxLines = Number(req.query.maxLines || 5);  // Max lines for title (optional, default: 5)

    // Extract logo parameter (boolean, default: false)
    const logo = req.query.logo === 'true' || req.query.logo === '1';  // Logo overlay (optional, default: false)

    // Validate dimensions are reasonable (prevent abuse)
    if (W < 100 || W > 4000 || H < 100 || H > 4000) {
      console.log(`❌ [${requestId}] Invalid dimensions: ${W}x${H}`);
      return res.status(400).json({ error: 'Invalid dimensions. Width and height must be between 100 and 4000 pixels.' });
    }

    // Validate maxLines is reasonable
    if (maxLines < 1 || maxLines > 20) {
      console.log(`❌ [${requestId}] Invalid maxLines: ${maxLines}`);
      return res.status(400).json({ error: 'Invalid maxLines. Must be between 1 and 20.' });
    }

    console.log(`✅ [${requestId}] Parameters validated successfully`);
    console.log(`📐 [${requestId}] Processing image: ${W}x${H}, maxLines: ${maxLines}, logo: ${logo}`);

    // === IMAGE FETCHING ===

    console.log(`🌐 [${requestId}] Fetching image from URL...`);
    const fetchStart = Date.now();

    // Fetch the source image from the provided URL
    const resp = await fetch(img);
    if (!resp.ok) {
      console.log(`❌ [${requestId}] Failed to fetch image: ${resp.status} ${resp.statusText}`);
      throw new Error('fetch image failed');
    }

    // Convert response to buffer for Sharp processing
    const buf = Buffer.from(await resp.arrayBuffer());
    const fetchTime = Date.now() - fetchStart;

    console.log(`✅ [${requestId}] Image fetched successfully (${buf.length} bytes, ${fetchTime}ms)`);

    // === OVERLAY GENERATION AND COMPOSITING ===

    console.log(`🎨 [${requestId}] Generating SVG overlay...`);
    const svgStart = Date.now();

    // Generate SVG overlay with calculated text positioning
    const svg = Buffer.from(makeSvg(W, H, title, source, maxLines));
    const svgTime = Date.now() - svgStart;

    console.log(`✅ [${requestId}] SVG overlay generated (${svg.length} bytes, ${svgTime}ms)`);

    // Prepare composite operations array
    const compositeOps = [{ input: svg, top: 0, left: 0 }];

    // Add logo overlay if requested
    if (logo) {
      console.log(`🏷️ [${requestId}] Processing logo overlay...`);
      const logoStart = Date.now();

      try {
        // Read Logo.svg from the project root
        const fs = await import('fs');
        const logoPath = './Logo.svg';
        const logoBuffer = fs.readFileSync(logoPath);

        console.log(`📁 [${requestId}] Logo file read (${logoBuffer.length} bytes)`);

        // Calculate logo position (bottom-left corner)
        // Use logo as-is from SVG file with 20px padding from image border
        const logoPadding = 20;

        // Convert SVG to PNG without resizing (use original dimensions)
        const logoPng = await sharp(logoBuffer)
          .png()
          .toBuffer();

        // Get the actual dimensions of the logo
        const logoMetadata = await sharp(logoPng).metadata();
        const logoHeight = logoMetadata.height;
        const logoWidth = logoMetadata.width;

        console.log(`📏 [${requestId}] Logo dimensions: ${logoWidth}x${logoHeight}`);

        // Add logo to composite operations (bottom-left corner)
        compositeOps.push({
          input: logoPng,
          top: H - logoHeight - logoPadding,
          left: logoPadding
        });

        const logoTime = Date.now() - logoStart;
        console.log(`✅ [${requestId}] Logo processed successfully (${logoTime}ms)`);
      } catch (logoError) {
        // If logo file doesn't exist or can't be read, continue without logo
        console.warn(`⚠️ [${requestId}] Logo.svg not found or could not be read:`, logoError.message);
      }
    }

    // Process image with Sharp:
    // 1. Resize to target dimensions (cover mode maintains aspect ratio)
    // 2. Composite the SVG overlay and logo on top
    // 3. Convert to JPEG with 88% quality (good balance of size/quality)
    console.log(`🖼️ [${requestId}] Processing image with Sharp (${compositeOps.length} overlays)...`);
    const sharpStart = Date.now();

    const out = await sharp(buf).resize(W, H, { fit: 'cover' })
      .composite(compositeOps)
      .jpeg({ quality: 88 })
      .toBuffer();

    const sharpTime = Date.now() - sharpStart;
    console.log(`✅ [${requestId}] Image processing completed (${out.length} bytes, ${sharpTime}ms)`);

    // === RESPONSE ===

    // Set appropriate headers and send the processed image
    res.set('Content-Type', 'image/jpeg');
    res.send(out);

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [${requestId}] Request completed successfully (total: ${totalTime}ms)`);

  } catch (e) {
    // Handle any errors gracefully with appropriate HTTP status
    const totalTime = Date.now() - startTime;
    console.log(`💥 [${requestId}] Request failed after ${totalTime}ms:`, e.message);
    res.status(500).json({ error: String(e) });
  }
});

// === SERVER STARTUP ===

// Start the Express server and log the port
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Overlay Image Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🔐 API Key validation: ${REQUIRE_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  if (REQUIRE_API_KEY) {
    console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}... (use X-API-Key header)`);
  }
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📁 Media directory: ${MEDIA_DIR}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   GET  /healthz - Health check`);
  console.log(`   GET  /overlay - Image overlay generation`);
  console.log(`   GET  /2slidesReel - Not implemented (placeholder)`);
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