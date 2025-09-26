/**
 * Core Helper Functions
 * 
 * This module contains core utility functions used across the overlay image server
 * for text overlay generation, FFmpeg execution, and other shared operations.
 */

import sharp from 'sharp';
import fsp from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { makeSvg } from './image-helper.js';

// Promisify execFile for async/await usage
const execFileAsync = promisify(execFile);

/**
 * Generates a text overlay PNG file for video reels
 * Uses the same professional styling as the overlay endpoint but optimized for video
 * 
 * @param {string} text - Text to overlay
 * @param {string} outputPath - Path to save the PNG file
 * @param {string} requestId - Request ID for logging
 */
export async function generateTextOverlay(text, outputPath, requestId) {
    console.log(`🎨 [${requestId}] Generating text overlay: "${text}"`);

    // Use the same makeSvg function but with video-optimized dimensions for safe zone
    // 1080x300 for center safe zone of 1080x1920 video (positioned in center 1080x1080 area)
    const svg = makeSvg(1080, 1080, text, '', 9); // 9 lines max for video

    // Convert SVG to PNG using Sharp
    const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();

    await fsp.writeFile(outputPath, pngBuffer);
    console.log(`✅ [${requestId}] Text overlay generated: ${outputPath}`);
}

/**
 * Executes FFmpeg command
 * 
 * @param {Array} command - FFmpeg command arguments
 * @param {string} requestId - Request ID for logging
 */
export async function execFFmpeg(command, requestId) {
    console.log(`⚙️ [${requestId}] Executing FFmpeg...`);

    try {
        const { stdout, stderr } = await execFileAsync('ffmpeg', command, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr) {
            console.log(`📝 [${requestId}] FFmpeg stderr:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
        }

        console.log(`✅ [${requestId}] FFmpeg completed successfully`);
    } catch (error) {
        console.error(`💥 [${requestId}] FFmpeg error:`, error.message);
        throw new Error(`FFmpeg execution failed: ${error.message}`);
    }
}
