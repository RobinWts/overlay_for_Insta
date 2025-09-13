/**
 * Example usage of the overlay image server
 * This demonstrates how to use the server programmatically
 */

import fetch from 'node-fetch';
import fs from 'fs';

const SERVER_URL = 'http://localhost:8080';

/**
 * Generate an overlay image and save it to disk
 * @param {string} imageUrl - URL of the source image
 * @param {string} title - Title text to overlay
 * @param {string} source - Source attribution text
 * @param {number} width - Output width
 * @param {number} height - Output height
 * @param {string} outputPath - Path to save the output image
 */
async function generateOverlayImage(imageUrl, title, source, width, height, outputPath) {
    try {
        console.log(`🖼️  Generating overlay image...`);
        console.log(`   Image: ${imageUrl}`);
        console.log(`   Title: ${title}`);
        console.log(`   Source: ${source}`);
        console.log(`   Dimensions: ${width}x${height}`);

        const url = new URL('/overlay', SERVER_URL);
        url.searchParams.set('img', imageUrl);
        url.searchParams.set('title', title);
        url.searchParams.set('source', source);
        url.searchParams.set('w', width.toString());
        url.searchParams.set('h', height.toString());

        console.log(`   Request URL: ${url.toString()}`);

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Server error: ${response.status} - ${error}`);
        }

        const imageBuffer = await response.buffer();
        fs.writeFileSync(outputPath, imageBuffer);

        console.log(`✅ Image saved to: ${outputPath}`);
        console.log(`   File size: ${imageBuffer.length} bytes`);

        return imageBuffer;
    } catch (error) {
        console.error(`❌ Error generating overlay: ${error.message}`);
        throw error;
    }
}

/**
 * Example usage scenarios
 */
async function runExamples() {
    console.log('🚀 Overlay Image Server - Example Usage\n');

    // Example 1: Instagram-style post
    await generateOverlayImage(
        'https://picsum.photos/1080/1350?random=1',
        'Amazing Sunset View from the Mountains',
        '@photographer',
        1080,
        1350,
        'example-instagram.jpg'
    );

    // Example 2: Square format for other platforms
    await generateOverlayImage(
        'https://picsum.photos/800/800?random=2',
        'Quick Tip: Always use proper lighting for better photos',
        'Photo Tips Daily',
        800,
        800,
        'example-square.jpg'
    );

    // Example 3: Long title that will wrap
    await generateOverlayImage(
        'https://picsum.photos/1200/630?random=3',
        'This is a very long title that demonstrates how the text wrapping system works in our overlay generator',
        'Long Title Example',
        1200,
        630,
        'example-long-title.jpg'
    );

    console.log('\n✨ All examples completed!');
    console.log('Check the generated files:');
    console.log('  - example-instagram.jpg');
    console.log('  - example-square.jpg');
    console.log('  - example-long-title.jpg');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples().catch(console.error);
}

export { generateOverlayImage, runExamples };
