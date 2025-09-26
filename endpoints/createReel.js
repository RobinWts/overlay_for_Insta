/**
 * Create Reel Endpoint
 * 
 * This endpoint processes videos from storage and creates reels by either:
 * - Copying/resizing a single video to 1080x1920 format
 * - Stitching multiple videos together with 0.5s fade transitions
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFFmpeg } from '../helpers/helper.js';

/**
 * Gets video metadata using FFprobe
 * 
 * @param {string} videoPath - Path to the video file
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<Object>} Video metadata including duration, width, height
 */
const getVideoMetadata = async (videoPath, requestId) => {
    console.log(`🔍 [${requestId}] Getting video metadata from: ${videoPath}`);

    try {
        const { execSync } = await import('child_process');
        const ffprobeCommand = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            videoPath
        ];

        const ffprobeOutput = execSync(`ffprobe ${ffprobeCommand.join(' ')}`, { encoding: 'utf8' });
        const metadata = JSON.parse(ffprobeOutput);

        // Find video stream
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
            throw new Error('No video stream found');
        }

        const duration = parseFloat(videoStream.duration) || 0;
        const width = parseInt(videoStream.width) || 0;
        const height = parseInt(videoStream.height) || 0;

        console.log(`✅ [${requestId}] Video metadata: ${width}x${height}, duration: ${duration}s`);
        return { duration, width, height };

    } catch (error) {
        console.log(`❌ [${requestId}] Failed to get video metadata: ${error.message}`);
        throw new Error(`Failed to get video metadata: ${error.message}`);
    }
};

/**
 * Processes a single video by copying or resizing to 1080x1920
 * 
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path to output video
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<void>}
 */
const processSingleVideo = async (inputPath, outputPath, requestId) => {
    console.log(`🎬 [${requestId}] Processing single video...`);

    // Get video metadata to check if resizing is needed
    const metadata = await getVideoMetadata(inputPath, requestId);
    const { width, height } = metadata;

    // Check if video is already 1080x1920
    if (width === 1080 && height === 1920) {
        console.log(`📋 [${requestId}] Video is already 1080x1920, copying...`);
        // Just copy the file
        await fsp.copyFile(inputPath, outputPath);
        console.log(`✅ [${requestId}] Video copied successfully`);
    } else {
        console.log(`📐 [${requestId}] Resizing video from ${width}x${height} to 1080x1920...`);

        // Build FFmpeg command for resizing
        const command = [
            '-y', // Overwrite output file
            '-i', inputPath,
            '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1:1',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            outputPath
        ];

        console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${command.join(' ')}`);
        await execFFmpeg(command, requestId);
        console.log(`✅ [${requestId}] Video resized successfully`);
    }
};

/**
 * Processes multiple videos by stitching them together with fade transitions
 * 
 * @param {Array<string>} inputPaths - Array of input video paths
 * @param {string} outputPath - Path to output video
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<void>}
 */
const processMultipleVideos = async (inputPaths, outputPath, requestId) => {
    console.log(`🎬 [${requestId}] Processing ${inputPaths.length} videos with stitching...`);

    // Get metadata for all videos
    const metadata = await Promise.all(
        inputPaths.map(path => getVideoMetadata(path, requestId))
    );

    console.log(`📊 [${requestId}] Video metadata:`, metadata.map((m, i) =>
        `Video ${i + 1}: ${m.width}x${m.height}, ${m.duration}s`
    ));

    // Build FFmpeg command for stitching
    const command = ['-y']; // Overwrite output file

    // Add all input videos
    inputPaths.forEach(inputPath => {
        command.push('-i', inputPath);
    });

    // Build filter complex for stitching with fade transitions
    let filterComplex = '';
    const fadeDuration = 0.5; // 0.5 seconds fade

    // Scale all videos to 1080x1920 and normalize frame rates first
    for (let i = 0; i < inputPaths.length; i++) {
        filterComplex += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p,setsar=1:1[v${i}];`;
        filterComplex += `[${i}:a]volume=1.0[a${i}];`;
    }

    // Create fade transitions between videos
    if (inputPaths.length === 2) {
        // Two videos: simple crossfade
        const offset1 = Math.max(0, metadata[0].duration - fadeDuration);
        filterComplex += `[v0][v1]xfade=transition=fade:duration=${fadeDuration}:offset=${offset1}[vout];`;
        filterComplex += `[a0][a1]acrossfade=d=${fadeDuration}[aout]`;
    } else if (inputPaths.length === 3) {
        // Three videos: create overlapping segments for fade transitions
        const offset1 = Math.max(0, metadata[0].duration - fadeDuration);
        const offset2 = Math.max(0, metadata[0].duration + metadata[1].duration - 2 * fadeDuration);

        // Apply xfade transitions directly without trim (to preserve frame rates)
        filterComplex += `[v0][v1]xfade=transition=fade:duration=${fadeDuration}:offset=${offset1}[v01];`;
        filterComplex += `[v01][v2]xfade=transition=fade:duration=${fadeDuration}:offset=${offset2}[vout];`;

        // Audio crossfades
        filterComplex += `[a0][a1]acrossfade=d=${fadeDuration}[a01];`;
        filterComplex += `[a01][a2]acrossfade=d=${fadeDuration}[aout]`;
    } else if (inputPaths.length === 4) {
        // Four videos: create overlapping segments for fade transitions
        const offset1 = Math.max(0, metadata[0].duration - fadeDuration);
        const offset2 = Math.max(0, metadata[0].duration + metadata[1].duration - 2 * fadeDuration);
        const offset3 = Math.max(0, metadata[0].duration + metadata[1].duration + metadata[2].duration - 3 * fadeDuration);

        // Apply xfade transitions directly without trim (to preserve frame rates)
        filterComplex += `[v0][v1]xfade=transition=fade:duration=${fadeDuration}:offset=${offset1}[v01];`;
        filterComplex += `[v01][v2]xfade=transition=fade:duration=${fadeDuration}:offset=${offset2}[v012];`;
        filterComplex += `[v012][v3]xfade=transition=fade:duration=${fadeDuration}:offset=${offset3}[vout];`;

        // Audio crossfades
        filterComplex += `[a0][a1]acrossfade=d=${fadeDuration}[a01];`;
        filterComplex += `[a01][a2]acrossfade=d=${fadeDuration}[a012];`;
        filterComplex += `[a012][a3]acrossfade=d=${fadeDuration}[aout]`;
    }

    // Calculate total duration
    const totalDuration = metadata.reduce((sum, meta) => sum + meta.duration, 0) - (inputPaths.length - 1) * fadeDuration;

    command.push('-filter_complex', filterComplex);
    command.push('-map', '[vout]');
    command.push('-map', '[aout]');
    command.push('-t', totalDuration.toString());
    command.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
    command.push('-c:a', 'aac', '-b:a', '128k');
    command.push(outputPath);

    console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${command.join(' ')}`);
    await execFFmpeg(command, requestId);
    console.log(`✅ [${requestId}] Videos stitched successfully`);
};

/**
 * Create Reel endpoint handler
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
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with storage settings
 */
export const createReelHandler = async (req, res, config) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();

    console.log(`🎬 [${requestId}] New createReel request started`);
    console.log(`📋 [${requestId}] Request parameters:`, {
        videoID: req.query.videoID ? `"${req.query.videoID}"` : 'missing',
        video2ID: req.query.video2ID ? `"${req.query.video2ID}"` : 'none',
        video3ID: req.query.video3ID ? `"${req.query.video3ID}"` : 'none',
        video4ID: req.query.video4ID ? `"${req.query.video4ID}"` : 'none'
    });

    try {
        // === PARAMETER EXTRACTION AND VALIDATION ===

        // Extract video IDs
        const videoIDs = [
            req.query.videoID,
            req.query.video2ID,
            req.query.video3ID,
            req.query.video4ID
        ].filter(Boolean); // Remove empty/undefined values

        if (videoIDs.length === 0) {
            console.log(`❌ [${requestId}] No video IDs provided`);
            return res.status(400).json({ error: 'At least one videoID is required' });
        }

        if (videoIDs.length > 4) {
            console.log(`❌ [${requestId}] Too many video IDs provided: ${videoIDs.length}`);
            return res.status(400).json({ error: 'Maximum 4 videos allowed' });
        }

        console.log(`✅ [${requestId}] Processing ${videoIDs.length} video(s): ${videoIDs.join(', ')}`);

        // === FILE LOOKUP ===

        console.log(`🔍 [${requestId}] Looking up video files in storage...`);
        const storageDir = path.join(config.MEDIA_DIR, 'storage');

        // Check if storage directory exists
        try {
            await fsp.access(storageDir);
        } catch (error) {
            console.log(`❌ [${requestId}] Storage directory not found: ${storageDir}`);
            return res.status(404).json({ error: 'Storage directory not found' });
        }

        // Find video files
        const files = await fsp.readdir(storageDir);
        const videoPaths = [];
        const foundFiles = [];

        for (const videoID of videoIDs) {
            const videoFile = files.find(f => f === videoID || f.startsWith(videoID + '.'));
            if (!videoFile) {
                console.log(`❌ [${requestId}] Video file not found: ${videoID}`);
                return res.status(404).json({ error: `Video file not found: ${videoID}` });
            }
            videoPaths.push(path.join(storageDir, videoFile));
            foundFiles.push(videoFile);
        }

        console.log(`✅ [${requestId}] All video files found: ${foundFiles.join(', ')}`);

        // === VIDEO PROCESSING ===

        // Generate unique filename for the output video
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const videoId = `${timestamp}_${requestId}`;
        const outputFilename = `reel_${videoId}.mp4`;
        const outputPath = path.join(config.REELS_DIR, outputFilename);

        // Ensure reels directory exists
        if (!fs.existsSync(config.REELS_DIR)) {
            fs.mkdirSync(config.REELS_DIR, { recursive: true });
        }

        console.log(`🎬 [${requestId}] Processing ${videoIDs.length} video(s)...`);

        if (videoIDs.length === 1) {
            // Single video: copy or resize
            await processSingleVideo(videoPaths[0], outputPath, requestId);
        } else {
            // Multiple videos: stitch with fade transitions
            await processMultipleVideos(videoPaths, outputPath, requestId);
        }

        // === RESPONSE GENERATION ===

        const fileID = path.basename(outputPath, path.extname(outputPath));
        const publicURL = `https://${config.DOMAIN}/media/${config.REELS_SUBDIR}/${outputFilename}`;

        console.log(`✅ [${requestId}] Reel created successfully:`);
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
            videoCount: videoIDs.length,
            videoIDs: videoIDs,
            processingTime: totalTime,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        // Handle any errors gracefully
        const totalTime = Date.now() - startTime;
        console.log(`💥 [${requestId}] Request failed after ${totalTime}ms:`, error.message);
        res.status(500).json({ error: String(error) });
    }
};
