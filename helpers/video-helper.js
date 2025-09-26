/**
 * Video Generation Helper Functions
 * 
 * This module contains functions for video generation, FFmpeg command building,
 * and Instagram reel creation with Ken Burns effects.
 */

import sharp from 'sharp';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { downloadImage } from './image-helper.js';
import { generateTextOverlay } from './helper.js';
import { execFFmpeg } from './helper.js';

/**
 * Builds FFmpeg command for 3-slide video generation
 * 
 * @param {Object} params - Command parameters
 * @returns {Array} FFmpeg command arguments
 */
export function build3SlidesFFmpegCommand({ slide1Path, slide2Path, slide3Path, title1Path, title2Path, title3Path, duration1, duration2, duration3, transition, outputPath, requestId, kenBurns }) {
    const command = [
        '-y', // Overwrite output file
        '-loop', '1', '-framerate', '30', '-i', slide1Path,
        '-loop', '1', '-framerate', '30', '-i', slide2Path,
        '-loop', '1', '-framerate', '30', '-i', slide3Path
    ];

    // Add text overlay inputs if they exist
    if (title1Path) {
        command.push('-loop', '1', '-framerate', '30', '-i', title1Path);
    }
    if (title2Path) {
        command.push('-loop', '1', '-framerate', '30', '-i', title2Path);
    }
    if (title3Path) {
        command.push('-loop', '1', '-framerate', '30', '-i', title3Path);
    }

    // Build filter complex
    const filterComplex = build3SlidesFilterComplex({
        hasTitle1: !!title1Path,
        hasTitle2: !!title2Path,
        hasTitle3: !!title3Path,
        duration1,
        duration2,
        duration3,
        transition,
        requestId,
        kenBurns
    });

    command.push('-filter_complex', filterComplex);
    command.push('-map', '[vfinal]');
    const xfadeDur = (kenBurns && kenBurns.xfadeDurationSec) || 1;
    command.push('-t', (duration1 + duration2 + duration3 - 2 * xfadeDur).toString());
    command.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30');
    command.push(outputPath);

    console.log(`🔧 [${requestId}] FFmpeg command: ffmpeg ${command.join(' ')}`);
    return command;
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
 * Builds FFmpeg filter complex for 3-slide video generation with Ken Burns effect
 * 
 * @param {Object} params - Filter parameters
 * @returns {string} Filter complex string
 */
export function build3SlidesFilterComplex({ hasTitle1, hasTitle2, hasTitle3, duration1, duration2, duration3, transition, requestId, kenBurns }) {
    console.log(`🎬 [${requestId}] Building 3-slide filter complex with Ken Burns effect...`);

    // Eingänge: 0=slide1, 1=slide2, 2=slide3, 3=title1?, 4=title2?, 5=title3?
    let idx = 0;
    const s1 = idx++;
    const s2 = idx++;
    const s3 = idx++;
    const t1 = hasTitle1 ? idx++ : -1;
    const t2 = hasTitle2 ? idx++ : -1;
    const t3 = hasTitle3 ? idx++ : -1;

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
    const D3 = kenBurns?.frames3 ?? Math.max(1, Math.round(duration3 * fps));
    const dx = kenBurns?.dxPerFrame ?? 2;
    const xfadeDurationSec = kenBurns?.xfadeDurationSec ?? 1;
    const xfadeOffset1Sec = kenBurns?.xfadeOffset1Sec ?? Math.max(0, duration1 - xfadeDurationSec);
    const xfadeOffset2Sec = kenBurns?.xfadeOffset2Sec ?? Math.max(0, duration1 + duration2 - xfadeDurationSec);

    // Ken Burns effect with reliable panning for all aspect ratios
    let filters = [
        // Slide 1 - LEFT TO RIGHT pan
        `[${s1}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${D1}:x='on*${dx}':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v1]`,

        // Slide 2 - RIGHT TO LEFT pan
        `[${s2}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${D2}:x='max(0,(iw-ow)-on*${dx})':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v2]`,

        // Slide 3 - RIGHT TO LEFT pan (similar to slide 2)
        `[${s3}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${scaleW}:${scaleH},` +
        `zoompan=z='${zStart}+${zStep}*on':d=${D3}:x='max(0,(iw-ow)-on*${dx})':y='(ih-oh)/2':s=${outW}x${outH}:fps=${fps},format=yuv420p[v3]`,
    ].join(";");

    // Text-Overlays
    const v1Final = hasTitle1 ? "v1_txt" : "v1";
    const v2Final = hasTitle2 ? "v2_txt" : "v2";
    const v3Final = hasTitle3 ? "v3_txt" : "v3";

    if (hasTitle1) {
        filters += `;[v1][${t1}:v]overlay=x=(W-w)/2:y=810:eval=init[v1_txt]`;
    }
    if (hasTitle2) {
        filters += `;[v2][${t2}:v]overlay=x=(W-w)/2:y=810:eval=init[v2_txt]`;
    }
    if (hasTitle3) {
        filters += `;[v3][${t3}:v]overlay=x=(W-w)/2:y=810:eval=init[v3_txt]`;
    }

    // First crossfade (slide1 to slide2)
    filters += `;[${v1Final}][${v2Final}]xfade=transition=fade:duration=${xfadeDurationSec}:offset=${xfadeOffset1Sec},format=yuv420p[v12]`;

    // Second crossfade (slide12 to slide3)
    filters += `;[v12][${v3Final}]xfade=transition=fade:duration=${xfadeDurationSec}:offset=${xfadeOffset2Sec},format=yuv420p[vfinal]`;

    console.log(`✅ [${requestId}] 3-slide Ken Burns filter complex built successfully`);
    return filters;
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
        const videoUrl = `https://${DOMAIN}/media/${REELS_SUBDIR}/${path.basename(outputPath)}`;

        console.log(`✅ [${requestId}] Video generated successfully: ${videoUrl}`);
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

/**
 * Generates a 3-slide Instagram reel video with Ken Burns effect
 * 
 * @param {Object} params - Video generation parameters
 * @param {string} params.slide1 - URL of first slide image
 * @param {string} params.slide2 - URL of second slide image
 * @param {string} params.slide3 - URL of third slide image
 * @param {string} params.title1 - Text overlay for first slide
 * @param {string} params.title2 - Text overlay for second slide
 * @param {string} params.title3 - Text overlay for third slide
 * @param {number} params.duration1 - Duration of first slide in seconds
 * @param {number} params.duration2 - Duration of second slide in seconds
 * @param {number} params.duration3 - Duration of third slide in seconds
 * @param {string} params.transition - Transition type between slides
 * @param {string} params.outputPath - Path where to save the video
 * @param {string} params.requestId - Request ID for logging
 * @param {string} params.DOMAIN - Domain for URL generation
 * @param {string} params.MEDIA_DIR - Media directory path
 * @param {string} params.REELS_SUBDIR - Reels subdirectory
 * @param {string} params.TMP_DIR - Temporary directory
 * @returns {Promise<string>} URL of the generated video
 */
export async function generate3SlidesReel({ slide1, slide2, slide3, title1, title2, title3, duration1, duration2, duration3, transition, outputPath, requestId, DOMAIN, MEDIA_DIR, REELS_SUBDIR, TMP_DIR }) {
    console.log(`🎬 [${requestId}] Starting 3slidesReel generation...`);

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
        const slide3Path = path.join(tempDir, 'slide3.jpg');

        await downloadImage(slide1, slide1Path, requestId);
        await downloadImage(slide2, slide2Path, requestId);
        await downloadImage(slide3, slide3Path, requestId);

        // Read image metadata to compute aspect ratios and log Ken Burns params
        const [meta1, meta2, meta3] = await Promise.all([
            sharp(slide1Path).metadata(),
            sharp(slide2Path).metadata(),
            sharp(slide3Path).metadata()
        ]);

        const ar1 = meta1 && meta1.width && meta1.height ? (meta1.width / meta1.height) : null;
        const ar2 = meta2 && meta2.width && meta2.height ? (meta2.width / meta2.height) : null;
        const ar3 = meta3 && meta3.width && meta3.height ? (meta3.width / meta3.height) : null;
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
        const D3 = Math.max(1, Math.round(duration3 * fps));
        const scaleW = 4320; // pre-scale width before zoompan
        const scaleH = 7680; // pre-scale height before zoompan
        const outW = 1080;   // final output width
        const outH = 1920;   // final output height
        const zStep = 0.0008; // zoom increment per frame
        const zStart = 1.0;
        const zEnd1 = zStart + zStep * D1;
        const zEnd2 = zStart + zStep * D2;
        const zEnd3 = zStart + zStep * D3;
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

        const s3StartX = Math.max(0, maxX);
        const s3EndXUnclamped = s3StartX - dxPerFrame * D3;
        const s3EndX = Math.max(0, Math.min(maxX, s3EndXUnclamped));
        const s3DeltaX = s3EndX - s3StartX; // negative or zero
        const s3Y = s1Y;

        // Transition offsets (seconds)
        const xfadeOffset1Sec = Math.max(0, duration1 - 1);
        const xfadeOffset2Sec = Math.max(0, duration1 + duration2 - 1);

        console.log(`🧭 [${requestId}] Ken Burns parameters:`);
        console.log(`   • Slide 1 image: ${meta1?.width || 'n/a'}x${meta1?.height || 'n/a'} (${orient(meta1?.width, meta1?.height)}, AR=${fmtAr(ar1)})`);
        console.log(`   • Slide 2 image: ${meta2?.width || 'n/a'}x${meta2?.height || 'n/a'} (${orient(meta2?.width, meta2?.height)}, AR=${fmtAr(ar2)})`);
        console.log(`   • Slide 3 image: ${meta3?.width || 'n/a'}x${meta3?.height || 'n/a'} (${orient(meta3?.width, meta3?.height)}, AR=${fmtAr(ar3)})`);
        console.log(`   • Output: ${outW}x${outH} @ ${fps}fps (pre-scale ${scaleW}x${scaleH})`);
        console.log(`   • Durations: slide1=${duration1}s (${D1} frames), slide2=${duration2}s (${D2} frames), slide3=${duration3}s (${D3} frames)`);
        console.log(`   • Transitions: xfade1 offset=${xfadeOffset1Sec}s, xfade2 offset=${xfadeOffset2Sec}s, xfade duration=1s`);
        console.log(`   • Zoom: zStart=${zStart.toFixed(4)}, zStep/frame=${zStep.toFixed(4)}, zEnd1=${zEnd1.toFixed(4)}, zEnd2=${zEnd2.toFixed(4)}, zEnd3=${zEnd3.toFixed(4)}`);
        console.log(`   • Slide1 pan: x ${s1StartX} → ${s1EndX} (Δ=${s1DeltaX}), y=${s1Y}, dx/frame=${dxPerFrame}`);
        console.log(`   • Slide2 pan: x ${s2StartX} → ${s2EndX} (Δ=${s2DeltaX}), y=${s2Y}, dx/frame=-${dxPerFrame}`);
        console.log(`   • Slide3 pan: x ${s3StartX} → ${s3EndX} (Δ=${s3DeltaX}), y=${s3Y}, dx/frame=-${dxPerFrame}`);

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
            xfadeOffset1Sec,
            xfadeOffset2Sec,
            frames1: D1,
            frames2: D2,
            frames3: D3
        };

        // Generate text overlays if provided
        let title1Path = null;
        let title2Path = null;
        let title3Path = null;

        if (title1) {
            title1Path = path.join(tempDir, 'title1.png');
            await generateTextOverlay(title1, title1Path, requestId);
        }

        if (title2) {
            title2Path = path.join(tempDir, 'title2.png');
            await generateTextOverlay(title2, title2Path, requestId);
        }

        if (title3) {
            title3Path = path.join(tempDir, 'title3.png');
            await generateTextOverlay(title3, title3Path, requestId);
        }

        // Generate FFmpeg command
        console.log(`🔧 [${requestId}] Building FFmpeg command...`);
        const ffmpegCommand = build3SlidesFFmpegCommand({
            slide1Path,
            slide2Path,
            slide3Path,
            title1Path,
            title2Path,
            title3Path,
            duration1,
            duration2,
            duration3,
            transition,
            outputPath,
            requestId,
            kenBurns
        });

        // Execute FFmpeg
        console.log(`⚙️ [${requestId}] Executing FFmpeg...`);
        await execFFmpeg(ffmpegCommand, requestId);

        // Generate video URL
        const videoUrl = `https://${DOMAIN}/media/${REELS_SUBDIR}/${path.basename(outputPath)}`;

        console.log(`✅ [${requestId}] Video generated successfully: ${videoUrl}`);
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
