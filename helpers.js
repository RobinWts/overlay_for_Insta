/**
 * Helper Functions for Overlay Image Server
 * 
 * This module contains shared utility functions used across multiple endpoints
 * for image processing, video generation, and text overlay creation.
 */

import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

// Promisify execFile for async/await usage
const execFileAsync = promisify(execFile);

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
export const makeSvg = (w, h, rawTitle, rawSource, maxLines = 5) => {
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
 * Downloads an image from URL to local path
 * 
 * @param {string} imageUrl - URL of the image to download
 * @param {string} outputPath - Local path to save the image
 * @param {string} requestId - Request ID for logging
 */
export async function downloadImage(imageUrl, outputPath, requestId) {
    console.log(`📥 [${requestId}] Downloading: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fsp.writeFile(outputPath, buffer);

    console.log(`✅ [${requestId}] Downloaded: ${outputPath} (${buffer.length} bytes)`);
}

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
    const svg = makeSvg(1080, 1080, text, '', 7); // 7 lines max for video

    // Convert SVG to PNG using Sharp
    const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();

    await fsp.writeFile(outputPath, pngBuffer);
    console.log(`✅ [${requestId}] Text overlay generated: ${outputPath}`);
}

/**
 * Builds FFmpeg command for video generation
 * 
 * @param {Object} params - Command parameters
 * @returns {Array} FFmpeg command arguments
 */
export function buildFFmpegCommand({ slide1Path, slide2Path, title1Path, title2Path, duration1, duration2, transition, outputPath, requestId, kenBurns }) {
    const command = [
        '-y', // Overwrite output file
        '-loop', '1', '-framerate', '30', '-i', slide1Path,
        '-loop', '1', '-framerate', '30', '-i', slide2Path
    ];

    // Add text overlay inputs if they exist
    if (title1Path) {
        command.push('-loop', '1', '-framerate', '30', '-i', title1Path);
    }
    if (title2Path) {
        command.push('-loop', '1', '-framerate', '30', '-i', title2Path);
    }

    // Build filter complex
    const filterComplex = buildFilterComplex({
        hasTitle1: !!title1Path,
        hasTitle2: !!title2Path,
        duration1,
        duration2,
        transition,
        requestId,
        kenBurns
    });

    command.push('-filter_complex', filterComplex);
    command.push('-map', '[vfinal]');
    const xfadeDur = (kenBurns && kenBurns.xfadeDurationSec) || 1;
    command.push('-t', (duration1 + duration2 - xfadeDur).toString());
    command.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30');
    command.push(outputPath);

    console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${command.join(' ')}`);
    return command;
}

/**
 * Builds FFmpeg filter complex for video generation with Ken Burns effect
 * 
 * @param {Object} params - Filter parameters
 * @returns {string} Filter complex string
 */
export function buildFilterComplex({ hasTitle1, hasTitle2, duration1, duration2, transition, requestId, kenBurns }) {
    console.log(`🎬 [${requestId}] Building filter complex with Ken Burns effect...`);

    // Eingänge: 0=slide1, 1=slide2, 2=title1?, 3=title2?
    let idx = 0;
    const s1 = idx++;
    const s2 = idx++;
    const t1 = hasTitle1 ? idx++ : -1;
    const t2 = hasTitle2 ? idx++ : -1;

    // Use computed Ken Burns parameters
    const fps = kenBurns?.fps ?? 30;
    const scaleW = kenBurns?.scaleW ?? 4320;
    const scaleH = kenBurns?.scaleH ?? 7680;
    const outW = kenBurns?.outW ?? 1080;
    const outH = kenBurns?.outH ?? 1920;
    const zStart = kenBurns?.zStart ?? 1.0;
    const zStep = kenBurns?.zStep ?? 0.0008;
    const D1 = kenBurns?.frames1 ?? Math.max(1, Math.round(duration1 * fps));
    const D2 = kenBurns?.frames2 ?? Math.max(1, Math.round(duration2 * fps));
    const dx = kenBurns?.dxPerFrame ?? 2;
    const xfadeDurationSec = kenBurns?.xfadeDurationSec ?? 1;
    const xfadeOffsetSec = kenBurns?.xfadeOffsetSec ?? Math.max(0, duration1 - xfadeDurationSec);

    // Ken Burns effect with reliable panning for all aspect ratios
    // Use a simpler approach that works consistently across different image types
    // Each slide gets proper scaling and continuous motion for its full duration

    let filters = [
        // Slide 1 - LEFT TO RIGHT pan
        `[${s1}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${D1}:x='on*${dx}':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v1]`,

        // Slide 2 - RIGHT TO LEFT pan
        `[${s2}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${D2}:x='max(0,(iw-ow)-on*${dx})':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v2]`,
    ].join(";");

    // Text-Overlays (PNG/SVG sollten 1080x1920 oder transparenten Canvas haben)
    const v1Final = hasTitle1 ? "v1_txt" : "v1";
    const v2Final = hasTitle2 ? "v2_txt" : "v2";

    if (hasTitle1) {
        // Position: mittlere Safe-Zone (hier Beispiel: y=810). Passe gern an.
        filters += `;[v1][${t1}:v]overlay=x=(W-w)/2:y=810:eval=init[v1_txt]`;
    }
    if (hasTitle2) {
        filters += `;[v2][${t2}:v]overlay=x=(W-w)/2:y=810:eval=init[v2_txt]`;
    }

    // Crossfade using computed timing
    filters += `;[${v1Final}][${v2Final}]xfade=transition=fade:duration=${xfadeDurationSec}:offset=${xfadeOffsetSec},format=yuv420p[vfinal]`;

    console.log(`✅ [${requestId}] Ken Burns filter complex built successfully`);
    return filters;
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

/**
 * Generates a 2-slide Instagram reel video with Ken Burns effect
 * 
 * @param {Object} params - Video generation parameters
 * @param {string} params.slide1 - URL of first slide image
 * @param {string} params.slide2 - URL of second slide image
 * @param {string} params.title1 - Text overlay for first slide
 * @param {string} params.title2 - Text overlay for second slide
 * @param {number} params.duration1 - Duration of first slide in seconds
 * @param {number} params.duration2 - Duration of second slide in seconds
 * @param {string} params.transition - Transition type between slides
 * @param {string} params.outputPath - Path where to save the video
 * @param {string} params.requestId - Request ID for logging
 * @param {string} params.DOMAIN - Domain for URL generation
 * @param {string} params.MEDIA_DIR - Media directory path
 * @param {string} params.REELS_SUBDIR - Reels subdirectory
 * @param {string} params.TMP_DIR - Temporary directory
 * @returns {Promise<string>} URL of the generated video
 */
export async function generate2SlidesReel({ slide1, slide2, title1, title2, duration1, duration2, transition, outputPath, requestId, DOMAIN, MEDIA_DIR, REELS_SUBDIR, TMP_DIR }) {
    console.log(`🎬 [${requestId}] Starting 2slidesReel generation...`);

    // Create temporary files for processing
    const tempDir = path.join(TMP_DIR, requestId);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
        // Download and process images
        console.log(`📥 [${requestId}] Downloading images...`);
        const slide1Path = path.join(tempDir, 'slide1.jpg');
        const slide2Path = path.join(tempDir, 'slide2.jpg');

        await downloadImage(slide1, slide1Path, requestId);
        await downloadImage(slide2, slide2Path, requestId);

        // Read image metadata to compute aspect ratios and log Ken Burns params
        const [meta1, meta2] = await Promise.all([
            sharp(slide1Path).metadata(),
            sharp(slide2Path).metadata()
        ]);

        const ar1 = meta1 && meta1.width && meta1.height ? (meta1.width / meta1.height) : null;
        const ar2 = meta2 && meta2.width && meta2.height ? (meta2.width / meta2.height) : null;
        const fmtAr = (ar) => (ar ? ar.toFixed(3) : 'n/a');
        const orient = (w, h) => {
            if (!w || !h) return 'unknown';
            if (w === h) return 'square';
            return w > h ? 'landscape' : 'portrait';
        };

        // Ken Burns configuration used in filters
        const fps = 30;
        const D1 = Math.max(1, Math.round(duration1 * fps));
        const D2 = Math.max(1, Math.round(duration2 * fps));
        const scaleW = 4320; // pre-scale width before zoompan
        const scaleH = 7680; // pre-scale height before zoompan
        const outW = 1080;   // final output width
        const outH = 1920;   // final output height
        const zStep = 0.0008; // zoom increment per frame
        const zStart = 1.0;
        const zEnd1 = zStart + zStep * D1;
        const zEnd2 = zStart + zStep * D2;
        const dxPerFrame = 2; // pixels/frame horizontal pan

        // Effective pan boundaries (theoretical, ignoring zoom crop interactions)
        const maxX = scaleW - outW; // 4320 - 1080 = 3240
        const s1StartX = 0;
        const s1EndXUnclamped = dxPerFrame * D1;
        const s1EndX = Math.min(maxX, Math.max(0, s1EndXUnclamped));
        const s1DeltaX = s1EndX - s1StartX;
        const s1Y = Math.round((scaleH - outH) / 2); // centered vertically

        const s2StartX = Math.max(0, maxX);
        const s2EndXUnclamped = s2StartX - dxPerFrame * D2;
        const s2EndX = Math.max(0, Math.min(maxX, s2EndXUnclamped));
        const s2DeltaX = s2EndX - s2StartX; // negative or zero
        const s2Y = s1Y;

        // Transition offset (seconds)
        const xfadeOffsetSec = Math.max(0, duration1 - 1);

        console.log(`🧭 [${requestId}] Ken Burns parameters:`);
        console.log(`   • Slide 1 image: ${meta1?.width || 'n/a'}x${meta1?.height || 'n/a'} (${orient(meta1?.width, meta1?.height)}, AR=${fmtAr(ar1)})`);
        console.log(`   • Slide 2 image: ${meta2?.width || 'n/a'}x${meta2?.height || 'n/a'} (${orient(meta2?.width, meta2?.height)}, AR=${fmtAr(ar2)})`);
        console.log(`   • Output: ${outW}x${outH} @ ${fps}fps (pre-scale ${scaleW}x${scaleH})`);
        console.log(`   • Durations: slide1=${duration1}s (${D1} frames), slide2=${duration2}s (${D2} frames), xfade offset=${xfadeOffsetSec}s, xfade duration=1s`);
        console.log(`   • Zoom: zStart=${zStart.toFixed(4)}, zStep/frame=${zStep.toFixed(4)}, zEnd1=${zEnd1.toFixed(4)}, zEnd2=${zEnd2.toFixed(4)}`);
        console.log(`   • Slide1 pan: x ${s1StartX} → ${s1EndX} (Δ=${s1DeltaX}), y=${s1Y}, dx/frame=${dxPerFrame}`);
        console.log(`   • Slide2 pan: x ${s2StartX} → ${s2EndX} (Δ=${s2DeltaX}), y=${s2Y}, dx/frame=-${dxPerFrame}`);

        // Bundle Ken Burns configuration to pass through to filter builder
        const kenBurns = {
            fps,
            scaleW,
            scaleH,
            outW,
            outH,
            zStart,
            zStep,
            dxPerFrame,
            xfadeDurationSec: 1,
            xfadeOffsetSec,
            frames1: D1,
            frames2: D2
        };

        // Generate text overlays if provided
        let title1Path = null;
        let title2Path = null;

        if (title1) {
            title1Path = path.join(tempDir, 'title1.png');
            await generateTextOverlay(title1, title1Path, requestId);
        }

        if (title2) {
            title2Path = path.join(tempDir, 'title2.png');
            await generateTextOverlay(title2, title2Path, requestId);
        }

        // Generate FFmpeg command
        console.log(`🔧 [${requestId}] Building FFmpeg command...`);
        const ffmpegCommand = buildFFmpegCommand({
            slide1Path,
            slide2Path,
            title1Path,
            title2Path,
            duration1,
            duration2,
            transition,
            outputPath,
            requestId,
            kenBurns
        });

        // Execute FFmpeg
        console.log(`⚙️ [${requestId}] Executing FFmpeg...`);
        await execFFmpeg(ffmpegCommand, requestId);

        // Generate video URL
        const videoUrl = `https://${DOMAIN}/${MEDIA_DIR}/${REELS_SUBDIR}/${path.basename(outputPath)}`;

        console.log(`✅ [${requestId}] Video generated successfully: ${videoUrl}`);
        return videoUrl;

    } finally {
        // Clean up temporary files
        console.log(`🧹 [${requestId}] Cleaning up temporary files...`);
        try {
            await fsp.rmdir(tempDir, { recursive: true });
        } catch (cleanupError) {
            console.warn(`⚠️ [${requestId}] Cleanup warning:`, cleanupError.message);
        }
    }
}
