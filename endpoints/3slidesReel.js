/**
 * Three-Slide Reel Endpoint
 * 
 * Endpoint for creating Instagram reels with three slides and Ken Burns effect.
 * Generates 1080x1920 videos with customizable text overlays and transitions.
 */

import fs from 'fs';
import path from 'path';
import { generate3SlidesReel } from '../helpers/video-helper.js';

/**
 * 3 Slides Reel endpoint handler
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
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with paths and settings
 */
export const reel3Handler = async (req, res, config) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();

    console.log(`🎬 [${requestId}] 3slidesReel request started`);
    console.log(`📋 [${requestId}] Request parameters:`, {
        slide1: req.query.slide1 ? 'provided' : 'missing',
        slide2: req.query.slide2 ? 'provided' : 'missing',
        slide3: req.query.slide3 ? 'provided' : 'missing',
        title1: req.query.title1 ? `"${req.query.title1.substring(0, 50)}${req.query.title1.length > 50 ? '...' : ''}"` : 'none',
        title2: req.query.title2 ? `"${req.query.title2.substring(0, 50)}${req.query.title2.length > 50 ? '...' : ''}"` : 'none',
        title3: req.query.title3 ? `"${req.query.title3.substring(0, 50)}${req.query.title3.length > 50 ? '...' : ''}"` : 'none',
        duration1: req.query.duration1 || 'default (4)',
        duration2: req.query.duration2 || 'default (4)',
        duration3: req.query.duration3 || 'default (4)',
        transition: req.query.transition || 'default (fade)'
    });

    try {
        // === PARAMETER EXTRACTION AND VALIDATION ===

        // Extract and validate required image URLs
        const slide1 = req.query.slide1;
        const slide2 = req.query.slide2;
        const slide3 = req.query.slide3;

        if (!slide1) {
            console.log(`❌ [${requestId}] Missing required parameter: slide1`);
            return res.status(400).json({ error: 'slide1 required' });
        }

        if (!slide2) {
            console.log(`❌ [${requestId}] Missing required parameter: slide2`);
            return res.status(400).json({ error: 'slide2 required' });
        }

        if (!slide3) {
            console.log(`❌ [${requestId}] Missing required parameter: slide3`);
            return res.status(400).json({ error: 'slide3 required' });
        }

        // Extract optional parameters with defaults
        const title1 = req.query.title1 || '';
        const title2 = req.query.title2 || '';
        const title3 = req.query.title3 || '';
        const duration1 = Number(req.query.duration1 || 4);
        const duration2 = Number(req.query.duration2 || 4);
        const duration3 = Number(req.query.duration3 || 4);
        const transition = req.query.transition || 'fade';

        // Validate durations are reasonable
        if (duration1 < 1 || duration1 > 30 || duration2 < 1 || duration2 > 30 || duration3 < 1 || duration3 > 30) {
            console.log(`❌ [${requestId}] Invalid durations: ${duration1}s, ${duration2}s, ${duration3}s`);
            return res.status(400).json({
                error: 'Invalid durations. Duration must be between 1 and 30 seconds.'
            });
        }

        // Validate transition type (only fade is reliably supported across FFmpeg versions)
        const validTransitions = ['fade'];
        if (!validTransitions.includes(transition)) {
            console.log(`❌ [${requestId}] Invalid transition: ${transition}`);
            return res.status(400).json({
                error: 'Invalid transition. Must be one of: ' + validTransitions.join(', ')
            });
        }

        console.log(`✅ [${requestId}] Parameters validated successfully`);
        console.log(`📐 [${requestId}] Processing reel: slide1=${duration1}s, slide2=${duration2}s, slide3=${duration3}s, transition=${transition}`);

        // === VIDEO GENERATION IMPLEMENTATION ===

        console.log(`🎬 [${requestId}] Starting video generation...`);

        try {
            // Generate unique filename for this reel
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reelId = `${timestamp}_${requestId}`;
            const outputFilename = `reel_${reelId}.mp4`;
            const outputPath = path.join(config.REELS_DIR, outputFilename);

            // Ensure output directory exists
            if (!fs.existsSync(config.REELS_DIR)) {
                fs.mkdirSync(config.REELS_DIR, { recursive: true });
            }

            // Generate the video
            const videoUrl = await generate3SlidesReel({
                slide1,
                slide2,
                slide3,
                title1,
                title2,
                title3,
                duration1,
                duration2,
                duration3,
                transition,
                outputPath,
                requestId,
                DOMAIN: config.DOMAIN,
                MEDIA_DIR: config.MEDIA_DIR,
                REELS_SUBDIR: config.REELS_SUBDIR,
                TMP_DIR: config.TMP_DIR
            });

            const totalTime = Date.now() - startTime;
            console.log(`🎉 [${requestId}] Video generation completed successfully (${totalTime}ms)`);

            res.json({
                success: true,
                videoUrl,
                requestId,
                processingTime: totalTime,
                parameters: {
                    slide1,
                    slide2,
                    slide3,
                    title1,
                    title2,
                    title3,
                    duration1,
                    duration2,
                    duration3,
                    transition
                }
            });

        } catch (videoError) {
            console.log(`💥 [${requestId}] Video generation failed:`, videoError.message);
            const totalTime = Date.now() - startTime;
            res.status(500).json({
                error: 'Video generation failed',
                message: videoError.message,
                requestId,
                processingTime: totalTime
            });
        }

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.log(`💥 [${requestId}] 3slidesReel request failed after ${totalTime}ms:`, error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            requestId
        });
    }
};
