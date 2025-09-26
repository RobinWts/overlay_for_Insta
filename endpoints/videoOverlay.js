/**
 * Video Overlay Endpoint
 * 
 * This endpoint overlays text on videos stored in the storage directory.
 * Takes a videoID (filename in storage), text to overlay, and optional lines parameter.
 * Uses the same text rendering logic as the image overlay endpoint.
 */

import sharp from 'sharp';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { makeSvg } from '../helpers/image-helper.js';
import { execFFmpeg } from '../helpers/helper.js';

/**
 * Generates SVG overlay for video with bottom-aligned text positioning
 * 
 * This function creates a text overlay specifically for videos, positioning
 * the text at the bottom with proper padding for Instagram previews.
 * 
 * @param {number} w - Width of the video
 * @param {number} h - Height of the video  
 * @param {string} rawText - The text to overlay
 * @param {number} maxLines - Maximum number of lines for text
 * @returns {string} SVG markup as a string
 */
const makeVideoSvg = (w, h, rawText, maxLines = 5) => {
    console.log(`🔍 [makeVideoSvg] Starting with parameters: w=${w}, h=${h}, maxLines=${maxLines}`);
    console.log(`🔍 [makeVideoSvg] Raw text: "${rawText}"`);

    /**
     * HTML entity escape function to prevent XSS and ensure proper XML rendering
     */
    const esc = (s = '') => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Clean and trim input text
    const text = (rawText || '').trim();

    console.log(`🔍 [makeVideoSvg] Cleaned text: "${text}" (${text.length} chars)`);

    // === TYPOGRAPHY AND LAYOUT CALCULATIONS ===

    // Use the smaller dimension as base for proportional sizing
    const base = Math.min(w, h);

    // Calculate font sizes as percentages of the base dimension
    const fsTitle = Math.round(base * 0.055);      // Title font size (5.5% of base dimension)
    const lineH = Math.round(fsTitle * 1.12);     // Line height for proper text spacing
    const sidePad = Math.round(w * 0.08);         // Side padding (8% of image width)

    console.log(`🔍 [makeVideoSvg] Typography calculations:`);
    console.log(`   • Base dimension: ${base} (min of ${w}x${h})`);
    console.log(`   • Title font size: ${fsTitle}px (5.5% of ${base})`);
    console.log(`   • Line height: ${lineH}px (1.12x font size)`);
    console.log(`   • Side padding: ${sidePad}px (8% of ${w})`);

    // === TEXT WRAPPING ALGORITHM (same as image overlay) ===

    // Estimate characters per line based on font size and available width
    const estCharsPerLine = Math.max(10, Math.floor((w - 2 * sidePad) / (fsTitle * 0.60)));

    console.log(`🔍 [makeVideoSvg] Text wrapping calculations:`);
    console.log(`   • Available width: ${w - 2 * sidePad}px (${w} - 2*${sidePad})`);
    console.log(`   • Estimated chars per line: ${estCharsPerLine}`);

    // Split text into words for intelligent wrapping
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';

    console.log(`🔍 [makeVideoSvg] Word splitting: ${words.length} words: [${words.map(w => `"${w}"`).join(', ')}]`);

    // Word-by-word wrapping algorithm
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const test = line ? line + ' ' + word : word;

        console.log(`🔍 [makeVideoSvg] Processing word ${i + 1}/${words.length}: "${word}"`);
        console.log(`   • Current line: "${line}" (${line.length} chars)`);
        console.log(`   • Test line: "${test}" (${test.length} chars, limit: ${estCharsPerLine})`);

        if (test.length > estCharsPerLine) {
            if (line) {
                lines.push(line);
                console.log(`   • ✅ Line ${lines.length} completed: "${line}"`);
            }
            line = word;
            console.log(`   • 🔄 Starting new line with: "${word}"`);

            if (lines.length >= maxLines) {
                console.log(`   • ⚠️  Reached max lines (${maxLines}), stopping word processing`);
                break;
            }
        } else {
            line = test;
            console.log(`   • ✅ Word added to current line: "${line}"`);
        }
    }

    // Add the last line if there's content and we haven't exceeded max lines
    if (lines.length < maxLines && line) {
        lines.push(line);
        console.log(`🔍 [makeVideoSvg] Final line added: "${line}"`);
    }

    console.log(`🔍 [makeVideoSvg] Wrapping complete: ${lines.length} lines`);
    lines.forEach((line, i) => {
        console.log(`   • Line ${i + 1}: "${line}" (${line.length} chars)`);
    });

    // === ELLIPSIS HANDLING FOR TRUNCATED TEXT ===

    const usedAllWords = (lines.join(' ').trim().length >= text.trim().length);

    console.log(`🔍 [makeVideoSvg] Ellipsis analysis:`);
    console.log(`   • Used all words: ${usedAllWords}`);
    console.log(`   • Lines used: ${lines.join(' ').trim().length} chars`);
    console.log(`   • Original text: ${text.trim().length} chars`);
    console.log(`   • Lines count: ${lines.length}, maxLines: ${maxLines}`);

    if (!usedAllWords || lines.length > maxLines) {
        console.log(`🔍 [makeVideoSvg] ⚠️  Ellipsis needed! Reason: ${!usedAllWords ? 'not all words used' : 'exceeded max lines'}`);

        let last = lines[Math.min(lines.length, maxLines) - 1] || '';
        const maxForLast = estCharsPerLine - 1;

        console.log(`   • Last line before ellipsis: "${last}" (${last.length} chars)`);
        console.log(`   • Max chars for last line: ${maxForLast}`);

        if (last.length > maxForLast) {
            const truncated = last.slice(0, Math.max(0, maxForLast));
            last = truncated + '…';
            console.log(`   • 🔄 Truncated last line: "${truncated}" → "${last}"`);
        } else if (!usedAllWords) {
            const cleaned = last.replace(/\.*$/, '');
            last = cleaned + '…';
            console.log(`   • 🔄 Cleaned and added ellipsis: "${last.replace(/\.*$/, '')}" → "${last}"`);
        }

        lines.length = Math.min(lines.length, maxLines);
        lines[lines.length - 1] = last;

        console.log(`   • ✅ Final last line: "${last}"`);
    } else {
        console.log(`🔍 [makeVideoSvg] ✅ No ellipsis needed - all text fits within limits`);
    }

    // === VIDEO-SPECIFIC POSITIONING CALCULATIONS ===

    // Calculate the total height needed for all text lines
    const blockH = lines.length * lineH;

    // Calculate bottom padding (10% of video height for Instagram previews)
    const bottomPadding = Math.round(h * 0.1);

    // Calculate the Y position where the LAST line should be placed
    // This ensures the last line is at the bottom with proper padding
    const lastLineY = h - bottomPadding;

    // Calculate the starting Y position for the first line
    // This positions the entire text block so the last line is at lastLineY
    const startY = lastLineY - blockH + lineH; // +lineH to account for text baseline

    console.log(`🔍 [makeVideoSvg] Video positioning calculations:`);
    console.log(`   • Block height: ${blockH}px (${lines.length} lines × ${lineH}px)`);
    console.log(`   • Bottom padding: ${bottomPadding}px (10% of ${h})`);
    console.log(`   • Last line Y: ${lastLineY}px`);
    console.log(`   • Start Y: ${startY}px`);

    // === STROKE WIDTH CALCULATIONS ===

    const strokeTitle = Math.max(1, Math.round(fsTitle * 0.08));

    console.log(`🔍 [makeVideoSvg] Final positioning:`);
    console.log(`   • Title stroke width: ${strokeTitle}px`);

    // === SVG GENERATION ===

    console.log(`🔍 [makeVideoSvg] Generating SVG with ${lines.length} text lines`);
    lines.forEach((line, i) => {
        console.log(`   • Text line ${i + 1}: "${line}" at y=${startY + i * lineH}`);
    });

    // Return the complete SVG markup with bottom-aligned positioning
    return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <!-- Text group (centered horizontally, positioned at bottom) -->
  <g font-family="Inter, -apple-system, Segoe UI, Roboto, Arial"
     font-weight="800"
     font-size="${fsTitle}"
     text-anchor="middle"
     style="fill:#fff; stroke:#000; stroke-width:${strokeTitle}px; paint-order:stroke fill;">
    ${lines.map((ln, i) =>
        `<text x="${Math.round(w / 2)}" y="${startY + i * lineH}">${esc(ln)}</text>`
    ).join('\n    ')}
  </g>
</svg>`;
};

/**
 * Video overlay endpoint handler
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
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with storage settings
 */
export const videoOverlayHandler = async (req, res, config) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();

    console.log(`🎬 [${requestId}] New video overlay request started`);
    console.log(`📋 [${requestId}] Request parameters:`, {
        videoID: req.query.videoID ? `"${req.query.videoID}"` : 'missing',
        text: req.query.text ? `"${req.query.text.substring(0, 50)}${req.query.text.length > 50 ? '...' : ''}"` : 'missing',
        lines: req.query.lines || 'default (5)'
    });

    try {
        // === PARAMETER EXTRACTION AND VALIDATION ===

        // Extract and validate required parameters
        const videoID = req.query.videoID;
        if (!videoID) {
            console.log(`❌ [${requestId}] Missing required parameter: videoID`);
            return res.status(400).json({ error: 'videoID required' });
        }

        const text = req.query.text;
        if (!text) {
            console.log(`❌ [${requestId}] Missing required parameter: text`);
            return res.status(400).json({ error: 'text required' });
        }

        // Extract lines parameter with default of 5
        const maxLines = Number(req.query.lines || 5);

        // Validate lines parameter
        if (maxLines < 1 || maxLines > 20) {
            console.log(`❌ [${requestId}] Invalid lines: ${maxLines}`);
            return res.status(400).json({ error: 'Invalid lines. Must be between 1 and 20.' });
        }

        console.log(`✅ [${requestId}] Parameters validated successfully`);
        console.log(`📐 [${requestId}] Processing video: ${videoID}, text: "${text.substring(0, 30)}...", maxLines: ${maxLines}`);

        // === VIDEO FILE LOOKUP ===

        console.log(`🔍 [${requestId}] Looking up video file...`);
        const storageDir = path.join(config.MEDIA_DIR, 'storage');

        // Check if storage directory exists
        try {
            await fsp.access(storageDir);
        } catch (error) {
            console.log(`❌ [${requestId}] Storage directory not found: ${storageDir}`);
            return res.status(404).json({ error: 'Storage directory not found' });
        }

        // Find the video file
        const files = await fsp.readdir(storageDir);
        const videoFile = files.find(f => f === videoID || f.startsWith(videoID + '.'));

        if (!videoFile) {
            console.log(`❌ [${requestId}] Video file not found: ${videoID}`);
            return res.status(404).json({ error: 'Video file not found' });
        }

        const videoPath = path.join(storageDir, videoFile);
        console.log(`✅ [${requestId}] Video file found: ${videoPath}`);

        // === VIDEO METADATA EXTRACTION ===

        console.log(`📊 [${requestId}] Extracting video metadata...`);

        // Use FFprobe to get video dimensions
        const ffprobeCommand = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            videoPath
        ];

        let videoMetadata;
        try {
            const { execSync } = await import('child_process');
            const ffprobeOutput = execSync(`ffprobe ${ffprobeCommand.join(' ')}`, { encoding: 'utf8' });
            const metadata = JSON.parse(ffprobeOutput);

            // Find video stream
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                throw new Error('No video stream found');
            }

            videoMetadata = {
                width: videoStream.width,
                height: videoStream.height,
                duration: parseFloat(videoStream.duration) || 0
            };

            console.log(`✅ [${requestId}] Video metadata extracted:`, videoMetadata);
        } catch (error) {
            console.log(`❌ [${requestId}] Failed to extract video metadata: ${error.message}`);
            return res.status(500).json({ error: 'Failed to extract video metadata' });
        }

        // === TEXT OVERLAY GENERATION ===

        console.log(`🎨 [${requestId}] Generating text overlay...`);
        const svgStart = Date.now();

        // Generate SVG overlay with custom positioning for video (bottom-aligned)
        const svg = Buffer.from(makeVideoSvg(videoMetadata.width, videoMetadata.height, text, maxLines));
        const svgTime = Date.now() - svgStart;

        console.log(`✅ [${requestId}] SVG overlay generated (${svg.length} bytes, ${svgTime}ms)`);

        // === TEMPORARY FILE SETUP ===

        console.log(`📁 [${requestId}] Setting up temporary files...`);
        const tempDir = path.join(config.TMP_DIR, requestId);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const textOverlayPath = path.join(tempDir, 'text_overlay.png');
        const outputVideoPath = path.join(config.MEDIA_DIR, 'storage', `${uuidv4()}.mp4`);

        try {
            // Convert SVG to PNG for FFmpeg
            console.log(`🖼️ [${requestId}] Converting SVG to PNG...`);
            await sharp(svg)
                .png()
                .toFile(textOverlayPath);

            console.log(`✅ [${requestId}] Text overlay PNG created: ${textOverlayPath}`);

            // === FFMPEG VIDEO PROCESSING ===

            console.log(`⚙️ [${requestId}] Processing video with FFmpeg...`);
            const ffmpegStart = Date.now();

            // Build FFmpeg command for video overlay
            // The SVG is already positioned correctly, so we just overlay it at the top-left
            const ffmpegCommand = [
                '-i', videoPath,                    // Input video
                '-i', textOverlayPath,             // Text overlay image (already positioned in SVG)
                '-filter_complex',
                `[0:v][1:v]overlay=x=0:y=0:eval=init`, // Overlay text at top-left (SVG handles positioning)
                '-c:v', 'libx264',                 // Video codec
                '-c:a', 'copy',                   // Copy audio without re-encoding
                '-pix_fmt', 'yuv420p',           // Pixel format for compatibility
                '-y',                             // Overwrite output file
                outputVideoPath
            ];

            console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${ffmpegCommand.join(' ')}`);

            // Execute FFmpeg
            await execFFmpeg(ffmpegCommand, requestId);

            const ffmpegTime = Date.now() - ffmpegStart;
            console.log(`✅ [${requestId}] Video processing completed (${ffmpegTime}ms)`);

            // === RESPONSE GENERATION ===

            const outputFilename = path.basename(outputVideoPath);
            const fileID = path.basename(outputVideoPath, path.extname(outputVideoPath));
            const publicURL = `https://${config.DOMAIN}/media/storage/${outputFilename}`;

            console.log(`✅ [${requestId}] Video overlay completed successfully:`);
            console.log(`   • File ID: ${fileID}`);
            console.log(`   • Filename: ${outputFilename}`);
            console.log(`   • Public URL: ${publicURL}`);

            const totalTime = Date.now() - startTime;
            console.log(`🎉 [${requestId}] Request completed successfully (total: ${totalTime}ms)`);

            // Return success response
            res.status(200).json({
                success: true,
                fileID: fileID,
                filename: outputFilename,
                publicURL: publicURL,
                originalVideo: videoID,
                text: text,
                lines: maxLines,
                processingTime: totalTime,
                createdAt: new Date().toISOString()
            });

        } finally {
            // Clean up temporary files
            console.log(`🧹 [${requestId}] Cleaning up temporary files...`);
            try {
                await fsp.rm(tempDir, { recursive: true });
            } catch (cleanupError) {
                console.warn(`⚠️ [${requestId}] Cleanup warning:`, cleanupError.message);
            }
        }

    } catch (error) {
        // Handle any errors gracefully
        const totalTime = Date.now() - startTime;
        console.log(`💥 [${requestId}] Request failed after ${totalTime}ms:`, error.message);
        res.status(500).json({ error: String(error) });
    }
};
