/**
 * Image Overlay Endpoint
 * 
 * Main API endpoint for image overlay generation with customizable text.
 * Takes an image URL and overlays title and source text with professional styling.
 */

import sharp from 'sharp';
import fetch from 'node-fetch';
import { makeSvg } from '../helpers.js';

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
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const overlayHandler = async (req, res) => {
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
};
