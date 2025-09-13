/**
 * Test script for the overlay image server
 * Tests the /overlay endpoint with various parameters
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

/**
 * Test the overlay endpoint with sample data
 */
async function testOverlayEndpoint() {
    console.log('🧪 Testing overlay endpoint...\n');

    const testCases = [
        {
            name: 'Basic test with random image',
            params: {
                img: 'https://picsum.photos/1080/1350',
                title: 'This is a test title for the overlay',
                source: 'Test Source',
                w: 1080,
                h: 1350
            }
        },
        {
            name: 'Long title test (should wrap to multiple lines)',
            params: {
                img: 'https://picsum.photos/1080/1350?random=1',
                title: 'This is a very long title that should definitely wrap to multiple lines and test the text wrapping functionality of our overlay system',
                source: 'Long Title Source',
                w: 1080,
                h: 1350
            }
        },
        {
            name: 'Small image test',
            params: {
                img: 'https://picsum.photos/300/300?random=2',
                title: 'Small Image Test',
                source: 'Small Test',
                w: 300,
                h: 300
            }
        },
        {
            name: 'Missing parameters test (should return error)',
            params: {
                title: 'This should fail',
                source: 'Error Test'
            }
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}`);

        try {
            const url = new URL('/overlay', BASE_URL);
            Object.entries(testCase.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });

            console.log(`   URL: ${url.toString()}`);

            const response = await fetch(url.toString());

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');

                console.log(`   ✅ Success! Content-Type: ${contentType}, Size: ${contentLength} bytes`);

                // For successful image responses, we could save them for inspection
                if (contentType && contentType.startsWith('image/')) {
                    console.log(`   🖼️  Image generated successfully`);
                }
            } else {
                const errorText = await response.text();
                console.log(`   ❌ Error ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.log(`   💥 Exception: ${error.message}`);
        }

        console.log('');
    }
}

/**
 * Test server health
 */
async function testServerHealth() {
    console.log('🏥 Testing server health...\n');

    try {
        const response = await fetch(`${BASE_URL}/overlay?img=https://picsum.photos/100/100&title=health&source=test`);

        if (response.ok) {
            console.log('✅ Server is healthy and responding');
            return true;
        } else {
            console.log(`❌ Server returned error: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`💥 Server connection failed: ${error.message}`);
        console.log('   Make sure the server is running with: npm run dev');
        return false;
    }
}

/**
 * Main test function
 */
async function runTests() {
    console.log('🚀 Starting overlay server tests\n');
    console.log('='.repeat(50));

    const isHealthy = await testServerHealth();

    if (isHealthy) {
        await testOverlayEndpoint();
    }

    console.log('='.repeat(50));
    console.log('✨ Tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export { testOverlayEndpoint, testServerHealth, runTests };
