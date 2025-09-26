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
import { makeSvg, makeVideoSvg } from '../helpers/image-helper.js';
import { execFFmpeg } from '../helpers/helper.js';


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
