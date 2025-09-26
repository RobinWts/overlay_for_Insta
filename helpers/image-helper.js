/**
 * Image Processing Helper Functions
 * 
 * This module contains functions for image processing, text overlay generation,
 * and image downloading operations used across the overlay image server.
 */

import sharp from 'sharp';
import fetch from 'node-fetch';
import fsp from 'fs/promises';

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
    console.log(`🔍 [makeSvg] Starting with parameters: w=${w}, h=${h}, maxLines=${maxLines}`);
    console.log(`🔍 [makeSvg] Raw title: "${rawTitle}"`);
    console.log(`🔍 [makeSvg] Raw source: "${rawSource}"`);

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

    console.log(`🔍 [makeSvg] Cleaned title: "${title}" (${title.length} chars)`);
    console.log(`🔍 [makeSvg] Cleaned source: "${source}" (${source.length} chars)`);

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

    console.log(`🔍 [makeSvg] Typography calculations:`);
    console.log(`   • Base dimension: ${base} (min of ${w}x${h})`);
    console.log(`   • Title font size: ${fsTitle}px (5.5% of ${base})`);
    console.log(`   • Source font size: ${fsSrc}px (2.8% of ${base})`);
    console.log(`   • Line height: ${lineH}px (1.12x font size)`);
    console.log(`   • Top padding: ${topPad}px (8% of ${h})`);
    console.log(`   • Side padding: ${sidePad}px (8% of ${w})`);

    // Use the provided maxLines parameter (prevents overflow)
    // Default is 5, but can be customized via API parameter

    // === TEXT WRAPPING ALGORITHM ===

    // Estimate characters per line based on font size and available width
    // 0.60 is an empirical ratio for character width to font size
    // Math.max(10, ...) ensures minimum 10 characters per line for readability
    const estCharsPerLine = Math.max(10, Math.floor((w - 2 * sidePad) / (fsTitle * 0.60)));

    console.log(`🔍 [makeSvg] Text wrapping calculations:`);
    console.log(`   • Available width: ${w - 2 * sidePad}px (${w} - 2*${sidePad})`);
    console.log(`   • Character width ratio: 0.60`);
    console.log(`   • Estimated chars per line: ${estCharsPerLine}`);

    // Split title into words for intelligent wrapping
    const words = title.split(/\s+/);
    const lines = [];
    let line = '';

    console.log(`🔍 [makeSvg] Word splitting: ${words.length} words: [${words.map(w => `"${w}"`).join(', ')}]`);

    // Word-by-word wrapping algorithm
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Test if adding this word would exceed the line length
        const test = line ? line + ' ' + word : word;

        console.log(`🔍 [makeSvg] Processing word ${i + 1}/${words.length}: "${word}"`);
        console.log(`   • Current line: "${line}" (${line.length} chars)`);
        console.log(`   • Test line: "${test}" (${test.length} chars, limit: ${estCharsPerLine})`);

        if (test.length > estCharsPerLine) {
            // Current line is full, save it and start a new line
            if (line) {
                lines.push(line);
                console.log(`   • ✅ Line ${lines.length} completed: "${line}"`);
            }
            line = word;
            console.log(`   • 🔄 Starting new line with: "${word}"`);

            // Stop if we've reached the maximum number of lines
            if (lines.length >= maxLines) {
                console.log(`   • ⚠️  Reached max lines (${maxLines}), stopping word processing`);
                break;
            }
        } else {
            // Word fits on current line, add it
            line = test;
            console.log(`   • ✅ Word added to current line: "${line}"`);
        }
    }

    // Add the last line if there's content and we haven't exceeded max lines
    if (lines.length < maxLines && line) {
        lines.push(line);
        console.log(`🔍 [makeSvg] Final line added: "${line}"`);
    }

    console.log(`🔍 [makeSvg] Wrapping complete: ${lines.length} lines`);
    lines.forEach((line, i) => {
        console.log(`   • Line ${i + 1}: "${line}" (${line.length} chars)`);
    });

    // === ELLIPSIS HANDLING FOR TRUNCATED TEXT ===

    // Check if all words from the original title were used
    const usedAllWords = (lines.join(' ').trim().length >= title.trim().length);

    console.log(`🔍 [makeSvg] Ellipsis analysis:`);
    console.log(`   • Used all words: ${usedAllWords}`);
    console.log(`   • Lines used: ${lines.join(' ').trim().length} chars`);
    console.log(`   • Original title: ${title.trim().length} chars`);
    console.log(`   • Lines count: ${lines.length}, maxLines: ${maxLines}`);

    // Add ellipsis if text was truncated or we exceeded max lines
    if (!usedAllWords || lines.length > maxLines) {
        console.log(`🔍 [makeSvg] ⚠️  Ellipsis needed! Reason: ${!usedAllWords ? 'not all words used' : 'exceeded max lines'}`);

        // Get the last line that will be displayed
        let last = lines[Math.min(lines.length, maxLines) - 1] || '';
        const maxForLast = estCharsPerLine - 1; // Reserve space for ellipsis

        console.log(`   • Last line before ellipsis: "${last}" (${last.length} chars)`);
        console.log(`   • Max chars for last line: ${maxForLast}`);

        if (last.length > maxForLast) {
            // Truncate the last line and add ellipsis
            const truncated = last.slice(0, Math.max(0, maxForLast));
            last = truncated + '…';
            console.log(`   • 🔄 Truncated last line: "${truncated}" → "${last}"`);
        } else if (!usedAllWords) {
            // Remove any trailing periods and add ellipsis
            const cleaned = last.replace(/\.*$/, '');
            last = cleaned + '…';
            console.log(`   • 🔄 Cleaned and added ellipsis: "${last.replace(/\.*$/, '')}" → "${last}"`);
        }

        // Ensure we don't exceed max lines and update the last line
        lines.length = Math.min(lines.length, maxLines);
        lines[lines.length - 1] = last;

        console.log(`   • ✅ Final last line: "${last}"`);
    } else {
        console.log(`🔍 [makeSvg] ✅ No ellipsis needed - all text fits within limits`);
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

    console.log(`🔍 [makeSvg] Final positioning:`);
    console.log(`   • Block height: ${blockH}px (${lines.length} lines × ${lineH}px)`);
    console.log(`   • Start Y: ${startY}px`);
    console.log(`   • Bottom band height: ${bottomBandH}px`);
    console.log(`   • Title stroke width: ${strokeTitle}px`);
    console.log(`   • Source stroke width: ${strokeSrc}px`);

    // === SVG GENERATION ===

    console.log(`🔍 [makeSvg] Generating SVG with ${lines.length} text lines`);
    lines.forEach((line, i) => {
        console.log(`   • Text line ${i + 1}: "${line}" at y=${startY + i * lineH}`);
    });

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
export const makeVideoSvg = (w, h, rawText, maxLines = 5) => {
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
