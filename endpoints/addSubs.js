/**
 * AddSubs Endpoint Handler
 * 
 * This endpoint processes a video with audio and text to generate Instagram-style subtitles.
 * It extracts audio, uses aeneas for subtitle timing, and creates styled subtitles with FFmpeg.
 * 
 * GET /addSubs?videoURL=<url>&text=<text>
 * 
 * Parameters:
 * - videoURL (required): Publicly accessible URL of the video
 * - text (required): Text for the subtitles
 * 
 * Returns:
 * - Video file URL with embedded subtitles or processing status
 */

import { generateSubtitledVideo } from '../helpers/subtitles.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

/**
 * AddSubs endpoint handler
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Server configuration object
 */
export async function addSubsHandler(req, res, config) {
    const requestId = uuidv4().substring(0, 8);
    console.log(`🎬 [${requestId}] Starting addSubs request...`);

    try {
        // Extract and validate parameters
        const { videoURL, text } = req.query;

        console.log(`🔍 [${requestId}] Parameters:`);
        console.log(`   • Video URL: ${videoURL}`);
        console.log(`   • Text: "${text}"`);

        // Validate required parameters
        if (!videoURL) {
            console.log(`❌ [${requestId}] Missing required parameter: videoURL`);
            return res.status(400).json({
                error: 'Missing required parameter: videoURL',
                message: 'Please provide a videoURL parameter'
            });
        }

        if (!text) {
            console.log(`❌ [${requestId}] Missing required parameter: text`);
            return res.status(400).json({
                error: 'Missing required parameter: text',
                message: 'Please provide a text parameter'
            });
        }

        // Validate video URL format
        try {
            new URL(videoURL);
        } catch (urlError) {
            console.log(`❌ [${requestId}] Invalid video URL: ${urlError.message}`);
            return res.status(400).json({
                error: 'Invalid video URL',
                message: 'Please provide a valid video URL'
            });
        }

        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFilename = `subs_${timestamp}_${requestId}.mp4`;
        const outputPath = path.join(config.REELS_DIR, outputFilename);

        console.log(`📁 [${requestId}] Output path: ${outputPath}`);

        // Generate subtitled video
        console.log(`🎬 [${requestId}] Starting subtitle generation process...`);
        const videoUrl = await generateSubtitledVideo({
            videoURL,
            text,
            outputPath,
            requestId,
            DOMAIN: config.DOMAIN,
            REELS_SUBDIR: config.REELS_SUBDIR,
            TMP_DIR: config.TMP_DIR
        });

        console.log(`✅ [${requestId}] Subtitle generation completed successfully`);
        console.log(`🔗 [${requestId}] Video URL: ${videoUrl}`);

        // Return success response with video URL
        return res.json({
            success: true,
            message: 'Subtitles generated successfully',
            videoUrl: videoUrl,
            requestId: requestId
        });

    } catch (error) {
        console.error(`💥 [${requestId}] Error in addSubs handler:`, error.message);
        console.error(`   Stack trace:`, error.stack);

        // Return appropriate error response
        if (error.message.includes('FFmpeg')) {
            return res.status(500).json({
                error: 'Video processing failed',
                message: 'FFmpeg error occurred during video processing',
                requestId: requestId
            });
        } else if (error.message.includes('aeneas')) {
            return res.status(500).json({
                error: 'Subtitle timing failed',
                message: 'Aeneas error occurred during subtitle timing',
                requestId: requestId
            });
        } else if (error.message.includes('download')) {
            return res.status(400).json({
                error: 'Video download failed',
                message: 'Could not download the provided video URL',
                requestId: requestId
            });
        } else {
            return res.status(500).json({
                error: 'Internal server error',
                message: 'An unexpected error occurred during subtitle generation',
                requestId: requestId
            });
        }
    }
}
