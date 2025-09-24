/**
 * Subtitle Generation Helper Functions
 * 
 * This module contains functions for generating subtitles with aeneas and FFmpeg
 */

import fetch from 'node-fetch';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Downloads a video from URL to local path
 * 
 * @param {string} videoUrl - URL of the video to download
 * @param {string} outputPath - Local path to save the video
 * @param {string} requestId - Request ID for logging
 */
export async function downloadVideo(videoUrl, outputPath, requestId) {
    console.log(`📥 [${requestId}] Downloading video: ${videoUrl}`);

    const response = await fetch(videoUrl);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fsp.writeFile(outputPath, buffer);

    console.log(`✅ [${requestId}] Downloaded video: ${outputPath} (${buffer.length} bytes)`);
}

/**
 * Extracts audio from video using FFmpeg
 * 
 * @param {string} videoPath - Path to the input video
 * @param {string} audioPath - Path to save the extracted audio
 * @param {string} requestId - Request ID for logging
 */
export async function extractAudio(videoPath, audioPath, requestId) {
    console.log(`🎵 [${requestId}] Extracting audio from video...`);

    const command = [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // 16-bit PCM audio
        '-ar', '16000', // 16kHz sample rate (required by aeneas)
        '-ac', '1', // Mono audio
        '-y', // Overwrite output file
        audioPath
    ];

    console.log(`🔧 [${requestId}] FFmpeg audio extraction command: ffmpeg ${command.join(' ')}`);

    try {
        const { stdout, stderr } = await execFileAsync('ffmpeg', command, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr) {
            console.log(`📝 [${requestId}] FFmpeg stderr:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
        }

        console.log(`✅ [${requestId}] Audio extraction completed successfully`);
    } catch (error) {
        console.error(`💥 [${requestId}] Audio extraction error:`, error.message);
        throw new Error(`Audio extraction failed: ${error.message}`);
    }
}

/**
 * Creates subtitle timing using aeneas or fallback method
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {string} text - Text to create subtitles for
 * @param {string} srtPath - Path to save the SRT file
 * @param {string} requestId - Request ID for logging
 */
export async function createSubtitleTiming(audioPath, text, srtPath, requestId) {
    console.log(`📝 [${requestId}] Creating subtitle timing...`);
    console.log(`   • Audio: ${audioPath}`);
    console.log(`   • Text: "${text}"`);
    console.log(`   • Output: ${srtPath}`);

    // First try aeneas, if it fails, use a simple fallback
    try {
        await createSubtitleTimingWithAeneas(audioPath, text, srtPath, requestId);
    } catch (aeneasError) {
        console.warn(`⚠️ [${requestId}] Aeneas failed, using fallback method: ${aeneasError.message}`);
        await createSubtitleTimingFallback(text, srtPath, requestId);
    }
}

/**
 * Creates subtitle timing using aeneas
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {string} text - Text to create subtitles for
 * @param {string} srtPath - Path to save the SRT file
 * @param {string} requestId - Request ID for logging
 */
async function createSubtitleTimingWithAeneas(audioPath, text, srtPath, requestId) {
    console.log(`📝 [${requestId}] Trying aeneas for subtitle timing...`);

    // Create a temporary text file for aeneas
    const textPath = audioPath.replace('.wav', '.txt');
    await fsp.writeFile(textPath, text, 'utf8');

    try {
        // Use aeneas to create subtitle timing
        const command = [
            '-m', 'aeneas.tools.execute_task',
            '--audio', audioPath,
            '--text', textPath,
            '--output', srtPath
        ];

        console.log(`🔧 [${requestId}] Aeneas command: python ${command.join(' ')}`);

        const { stdout, stderr } = await execFileAsync('python', command, {
            maxBuffer: 1024 * 1024 * 5 // 5MB buffer
        });

        if (stderr) {
            console.log(`📝 [${requestId}] Aeneas stderr:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
        }

        console.log(`✅ [${requestId}] Aeneas subtitle timing completed successfully`);

        // Clean up temporary text file
        try {
            await fsp.unlink(textPath);
        } catch (cleanupError) {
            console.warn(`⚠️ [${requestId}] Could not clean up text file: ${cleanupError.message}`);
        }

    } catch (error) {
        // Clean up temporary text file
        try {
            await fsp.unlink(textPath);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Creates a simple subtitle timing fallback when aeneas is not available
 * 
 * @param {string} text - Text to create subtitles for
 * @param {string} srtPath - Path to save the SRT file
 * @param {string} requestId - Request ID for logging
 */
async function createSubtitleTimingFallback(text, srtPath, requestId) {
    console.log(`📝 [${requestId}] Using fallback subtitle timing method...`);

    // Create a simple SRT file with the text displayed for the entire duration
    // This is a basic fallback that shows the text for 10 seconds
    const srtContent = `1
00:00:00,000 --> 00:00:10,000
${text}

`;

    await fsp.writeFile(srtPath, srtContent, 'utf8');
    console.log(`✅ [${requestId}] Fallback subtitle timing completed successfully`);
}

/**
 * Generates Instagram-style subtitles using FFmpeg
 * 
 * @param {string} videoPath - Path to the input video
 * @param {string} srtPath - Path to the SRT subtitle file
 * @param {string} outputPath - Path to save the output video
 * @param {string} requestId - Request ID for logging
 */
export async function generateStyledSubtitles(videoPath, srtPath, outputPath, requestId) {
    console.log(`🎨 [${requestId}] Generating Instagram-style subtitles...`);

    // Check if Inter font is available
    const fontPath = await findInterFont();
    if (!fontPath) {
        console.warn(`⚠️ [${requestId}] Inter font not found, using default font`);
    }

    const command = [
        '-i', videoPath,
        '-vf', `subtitles=${srtPath}:force_style='FontName=${fontPath || 'Arial'},FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2'`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '23',
        '-y', // Overwrite output file
        outputPath
    ];

    console.log(`🔧 [${requestId}] FFmpeg subtitle command: ffmpeg ${command.join(' ')}`);

    try {
        const { stdout, stderr } = await execFileAsync('ffmpeg', command, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr) {
            console.log(`📝 [${requestId}] FFmpeg stderr:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
        }

        console.log(`✅ [${requestId}] Instagram-style subtitles generated successfully`);
    } catch (error) {
        console.error(`💥 [${requestId}] Subtitle generation error:`, error.message);
        throw new Error(`Subtitle generation failed: ${error.message}`);
    }
}

/**
 * Finds the Inter font on the system
 * 
 * @returns {Promise<string|null>} Path to Inter font or null if not found
 */
async function findInterFont() {
    const possiblePaths = [
        '/System/Library/Fonts/Inter.ttc', // macOS
        '/System/Library/Fonts/Inter-Regular.ttf', // macOS
        '/usr/share/fonts/truetype/inter/Inter-Regular.ttf', // Linux
        '/usr/share/fonts/Inter-Regular.ttf', // Linux
        '/usr/local/share/fonts/Inter-Regular.ttf', // Linux
        'C:\\Windows\\Fonts\\Inter-Regular.ttf', // Windows
        'C:\\Windows\\Fonts\\Inter.ttc' // Windows
    ];

    for (const fontPath of possiblePaths) {
        try {
            await fsp.access(fontPath);
            return fontPath;
        } catch (error) {
            // Font not found at this path, continue
        }
    }

    return null;
}

/**
 * Generates a complete subtitled video with Instagram-style subtitles
 * 
 * @param {Object} params - Video generation parameters
 * @param {string} params.videoURL - URL of the source video
 * @param {string} params.text - Text for the subtitles
 * @param {string} params.outputPath - Path where to save the video
 * @param {string} params.requestId - Request ID for logging
 * @param {string} params.DOMAIN - Domain for URL generation
 * @param {string} params.REELS_SUBDIR - Reels subdirectory
 * @param {string} params.TMP_DIR - Temporary directory
 * @returns {Promise<string>} URL of the generated video
 */
export async function generateSubtitledVideo({ videoURL, text, outputPath, requestId, DOMAIN, REELS_SUBDIR, TMP_DIR }) {
    console.log(`🎬 [${requestId}] Starting subtitled video generation...`);

    // Create temporary files for processing
    const tempDir = path.join(TMP_DIR, requestId);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
        // Download video
        console.log(`📥 [${requestId}] Downloading video...`);
        const videoPath = path.join(tempDir, 'input.mp4');
        await downloadVideo(videoURL, videoPath, requestId);

        // Extract audio
        console.log(`🎵 [${requestId}] Extracting audio...`);
        const audioPath = path.join(tempDir, 'audio.wav');
        await extractAudio(videoPath, audioPath, requestId);

        // Create subtitle timing with aeneas
        console.log(`📝 [${requestId}] Creating subtitle timing...`);
        const srtPath = path.join(tempDir, 'subtitles.srt');
        await createSubtitleTiming(audioPath, text, srtPath, requestId);

        // Generate Instagram-style subtitles
        console.log(`🎨 [${requestId}] Generating styled subtitles...`);
        await generateStyledSubtitles(videoPath, srtPath, outputPath, requestId);

        // Generate video URL
        const videoUrl = `https://${DOMAIN}/media/${REELS_SUBDIR}/${path.basename(outputPath)}`;

        console.log(`✅ [${requestId}] Subtitled video generated successfully: ${videoUrl}`);
        return videoUrl;

    } finally {
        // Clean up temporary files
        console.log(`🧹 [${requestId}] Cleaning up temporary files...`);
        try {
            await fsp.rm(tempDir, { recursive: true });
        } catch (cleanupError) {
            console.warn(`⚠️ [${requestId}] Cleanup warning:`, cleanupError.message);
        }
    }
}
