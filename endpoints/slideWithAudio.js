/**
 * Slide with Audio Endpoint
 * 
 * This endpoint creates a video with a single slide image, audio, and optional text overlay.
 * Uses Ken Burns effect and synchronizes audio with video timing.
 */

import sharp from 'sharp';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { makeVideoSvg } from '../helpers/image-helper.js';
import { execFFmpeg } from '../helpers/helper.js';

/**
 * Gets audio duration using FFprobe
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<number>} Duration in seconds
 */
const getAudioDuration = async (audioPath, requestId) => {
    console.log(`🔍 [${requestId}] Getting audio duration from: ${audioPath}`);

    try {
        const { execSync } = await import('child_process');
        const ffprobeCommand = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            audioPath
        ];

        const ffprobeOutput = execSync(`ffprobe ${ffprobeCommand.join(' ')}`, { encoding: 'utf8' });
        const metadata = JSON.parse(ffprobeOutput);

        // Find audio stream
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (!audioStream) {
            throw new Error('No audio stream found');
        }

        const duration = parseFloat(audioStream.duration) || 0;
        console.log(`✅ [${requestId}] Audio duration: ${duration} seconds`);
        return duration;

    } catch (error) {
        console.log(`❌ [${requestId}] Failed to get audio duration: ${error.message}`);
        throw new Error(`Failed to get audio duration: ${error.message}`);
    }
};

/**
 * Generates Ken Burns video with audio and optional text overlay
 * 
 * @param {Object} params - Video generation parameters
 * @param {string} params.slidePath - Path to the slide image
 * @param {string} params.audioPath - Path to the audio file
 * @param {string} params.textOverlayPath - Path to text overlay (optional)
 * @param {number} params.duration - Total video duration in seconds
 * @param {string} params.outputPath - Output video path
 * @param {string} params.requestId - Request ID for logging
 * @returns {Promise<void>}
 */
const generateSlideWithAudioVideo = async ({ slidePath, audioPath, textOverlayPath, duration, outputPath, requestId }) => {
    console.log(`🎬 [${requestId}] Generating slide with audio video...`);
    console.log(`📐 [${requestId}] Parameters: duration=${duration}s, hasTextOverlay=${!!textOverlayPath}`);

    // Ken Burns configuration
    const fps = 30;
    const frames = Math.max(1, Math.round(duration * fps));
    const scaleW = 4320; // pre-scale width before zoompan
    const scaleH = 7680; // pre-scale height before zoompan
    const outW = 1080;   // final output width
    const outH = 1920;   // final output height
    const zStep = 0.0008; // zoom increment per frame
    const zStart = 1.0;
    const dxPerFrame = 2; // pixels/frame horizontal pan

    console.log(`🧭 [${requestId}] Ken Burns parameters:`);
    console.log(`   • Duration: ${duration}s (${frames} frames)`);
    console.log(`   • Output: ${outW}x${outH} @ ${fps}fps (pre-scale ${scaleW}x${scaleH})`);
    console.log(`   • Zoom: zStart=${zStart.toFixed(4)}, zStep/frame=${zStep.toFixed(4)}`);
    console.log(`   • Pan: dx/frame=${dxPerFrame}`);

    // Build FFmpeg command
    const command = [
        '-y', // Overwrite output file
        '-loop', '1', '-framerate', '30', '-i', slidePath, // Slide image input
        '-i', audioPath, // Audio input
    ];

    // Add text overlay input if provided
    if (textOverlayPath) {
        command.push('-loop', '1', '-framerate', '30', '-i', textOverlayPath);
    }

    // Build filter complex
    let filterComplex = '';

    // Ken Burns effect for the slide
    filterComplex += `[0:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${frames}:x='on*${dxPerFrame}':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v1]`;

    // Add text overlay if provided
    if (textOverlayPath) {
        filterComplex += `;[v1][2:v]overlay=x=(W-w)/2:y=(H-h)/2:eval=init[vfinal]`;
    } else {
        filterComplex += `;[v1]format=yuv420p[vfinal]`;
    }

    // Add audio delay to center it (0.5s delay, so audio starts at 0.5s and ends at duration-0.5s)
    filterComplex += `;[1:a]adelay=500|500[adelayed]`;

    command.push('-filter_complex', filterComplex);
    command.push('-map', '[vfinal]');
    command.push('-map', '[adelayed]'); // Map delayed audio
    command.push('-t', duration.toString());
    command.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30');
    command.push('-c:a', 'aac', '-b:a', '128k'); // Audio codec and bitrate
    command.push(outputPath);

    console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${command.join(' ')}`);

    // Execute FFmpeg
    await execFFmpeg(command, requestId);

    console.log(`✅ [${requestId}] Video generation completed`);
};

/**
 * Slide with Audio endpoint handler
 * 
 * GET /slideWithAudio?slideID=<filename>&audioID=<filename>&text=<text>&maxlines=<number>
 * 
 * Parameters:
 * - slideID (required): Local filename of image in storage
 * - audioID (required): Local filename of audio in storage
 * - text (optional): Text to overlay on the video
 * - maxlines (optional): Maximum number of lines for text (default: 5)
 * 
 * Returns:
 * - JSON response with filename and publicURL of the resulting video
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with storage settings
 */
export const slideWithAudioHandler = async (req, res, config) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();

    console.log(`🎬 [${requestId}] New slideWithAudio request started`);
    console.log(`📋 [${requestId}] Request parameters:`, {
        slideID: req.query.slideID ? `"${req.query.slideID}"` : 'missing',
        audioID: req.query.audioID ? `"${req.query.audioID}"` : 'missing',
        text: req.query.text ? `"${req.query.text.substring(0, 50)}${req.query.text.length > 50 ? '...' : ''}"` : 'none',
        maxlines: req.query.maxlines || 'default (5)'
    });

    try {
        // === PARAMETER EXTRACTION AND VALIDATION ===

        // Extract and validate required parameters
        const slideID = req.query.slideID;
        const audioID = req.query.audioID;

        if (!slideID) {
            console.log(`❌ [${requestId}] Missing required parameter: slideID`);
            return res.status(400).json({ error: 'slideID required' });
        }

        if (!audioID) {
            console.log(`❌ [${requestId}] Missing required parameter: audioID`);
            return res.status(400).json({ error: 'audioID required' });
        }

        // Extract optional parameters
        const text = req.query.text || '';
        const maxLines = Number(req.query.maxlines || 5);

        // Validate maxLines parameter
        if (maxLines < 1 || maxLines > 20) {
            console.log(`❌ [${requestId}] Invalid maxlines: ${maxLines}`);
            return res.status(400).json({ error: 'Invalid maxlines. Must be between 1 and 20.' });
        }

        console.log(`✅ [${requestId}] Parameters validated successfully`);
        console.log(`📐 [${requestId}] Processing: slideID=${slideID}, audioID=${audioID}, text="${text.substring(0, 30)}...", maxLines=${maxLines}`);

        // === FILE LOOKUP ===

        console.log(`🔍 [${requestId}] Looking up files in storage...`);
        const storageDir = path.join(config.MEDIA_DIR, 'storage');

        // Check if storage directory exists
        try {
            await fsp.access(storageDir);
        } catch (error) {
            console.log(`❌ [${requestId}] Storage directory not found: ${storageDir}`);
            return res.status(404).json({ error: 'Storage directory not found' });
        }

        // Find the slide and audio files
        const files = await fsp.readdir(storageDir);
        const slideFile = files.find(f => f === slideID || f.startsWith(slideID + '.'));
        const audioFile = files.find(f => f === audioID || f.startsWith(audioID + '.'));

        if (!slideFile) {
            console.log(`❌ [${requestId}] Slide file not found: ${slideID}`);
            return res.status(404).json({ error: 'Slide file not found' });
        }

        if (!audioFile) {
            console.log(`❌ [${requestId}] Audio file not found: ${audioID}`);
            return res.status(404).json({ error: 'Audio file not found' });
        }

        const slidePath = path.join(storageDir, slideFile);
        const audioPath = path.join(storageDir, audioFile);

        console.log(`✅ [${requestId}] Files found: slide=${slidePath}, audio=${audioPath}`);

        // === AUDIO DURATION DETECTION ===

        console.log(`📊 [${requestId}] Getting audio duration...`);
        const audioDuration = await getAudioDuration(audioPath, requestId);

        // Add 1 second for pauses (0.5s at beginning and end)
        const totalDuration = audioDuration + 1;
        console.log(`✅ [${requestId}] Total video duration: ${totalDuration}s (audio: ${audioDuration}s + 1s pause)`);

        // === TEXT OVERLAY GENERATION (if text provided) ===

        let textOverlayPath = null;
        if (text) {
            console.log(`🎨 [${requestId}] Generating text overlay...`);
            const svgStart = Date.now();

            // Generate SVG overlay using the same logic as videoOverlay
            const svg = Buffer.from(makeVideoSvg(1080, 1920, text, maxLines));
            const svgTime = Date.now() - svgStart;

            console.log(`✅ [${requestId}] SVG overlay generated (${svg.length} bytes, ${svgTime}ms)`);

            // Convert SVG to PNG for FFmpeg
            const tempDir = path.join(config.TMP_DIR, requestId);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            textOverlayPath = path.join(tempDir, 'text_overlay.png');
            await sharp(svg)
                .png()
                .toFile(textOverlayPath);

            console.log(`✅ [${requestId}] Text overlay PNG created: ${textOverlayPath}`);
        }

        // === VIDEO GENERATION ===

        console.log(`🎬 [${requestId}] Generating video with Ken Burns effect...`);

        // Generate unique filename for the output video
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const videoId = `${timestamp}_${requestId}`;
        const outputFilename = `slideWithAudio_${videoId}.mp4`;
        const outputPath = path.join(config.MEDIA_DIR, 'storage', outputFilename);

        // Ensure output directory exists
        const outputStorageDir = path.join(config.MEDIA_DIR, 'storage');
        if (!fs.existsSync(outputStorageDir)) {
            fs.mkdirSync(outputStorageDir, { recursive: true });
        }

        // Generate the video
        await generateSlideWithAudioVideo({
            slidePath,
            audioPath,
            textOverlayPath,
            duration: totalDuration,
            outputPath,
            requestId
        });

        // === RESPONSE GENERATION ===

        const fileID = path.basename(outputPath, path.extname(outputPath));
        const publicURL = `https://${config.DOMAIN}/media/storage/${outputFilename}`;

        console.log(`✅ [${requestId}] Slide with audio video completed successfully:`);
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
            slideID: slideID,
            audioID: audioID,
            text: text,
            maxLines: maxLines,
            audioDuration: audioDuration,
            totalDuration: totalDuration,
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
