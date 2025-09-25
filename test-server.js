/**
 * Test script for the overlay image server
 * Tests the /overlay endpoint with various parameters
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:8080';
const API_KEY = process.env.OVERLAY_API_KEY || 'default-api-key-change-in-production';

/**
 * Test API key validation
 */
async function testApiKeyValidation() {
    console.log('🔐 Testing API key validation...\n');

    const testCases = [
        {
            name: 'Valid API key test',
            headers: { 'X-API-Key': API_KEY },
            shouldSucceed: true
        },
        {
            name: 'Missing API key test',
            headers: {},
            shouldSucceed: false
        },
        {
            name: 'Invalid API key test',
            headers: { 'X-API-Key': 'invalid-key' },
            shouldSucceed: false
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}`);

        try {
            const url = new URL('/overlay', BASE_URL);
            url.searchParams.set('img', 'https://picsum.photos/100/100');
            url.searchParams.set('title', 'API Key Test');

            console.log(`   URL: ${url.toString()}`);

            const response = await fetch(url.toString(), {
                headers: testCase.headers
            });

            if (testCase.shouldSucceed && response.ok) {
                console.log(`   ✅ Success! API key validation passed`);
            } else if (!testCase.shouldSucceed && !response.ok) {
                const errorText = await response.text();
                console.log(`   ✅ Expected error: ${response.status} - ${errorText}`);
            } else {
                console.log(`   ❌ Unexpected result: ${response.status}`);
            }
        } catch (error) {
            console.log(`   💥 Exception: ${error.message}`);
        }

        console.log('');
    }
}

/**
 * Test the 2slidesReel endpoint (placeholder implementation)
 */
async function test2SlidesReelEndpoint() {
    console.log('🎬 Testing 2slidesReel endpoint...\n');

    const testCases = [
        {
            name: 'Valid 2slidesReel request with all parameters',
            params: {
                slide1: 'https://picsum.photos/1080/1350?random=1',
                slide2: 'https://picsum.photos/2160/1080?random=2',
                title1: 'First Slide Title this is the first test video. This is a Instagram image.',
                title2: 'Second Slide Title this is the first test video. This is a landscape image. And much more text to display on the second slide.',
                duration1: 5,
                duration2: 7,
                transition: 'fade'
            },
            shouldSucceed: true // Now implemented!
        },
        {
            name: 'Valid 2slidesReel request with minimal parameters',
            params: {
                slide1: 'https://picsum.photos/1024/1024?random=3',
                slide2: 'https://picsum.photos/3072/1024?random=4'
            },
            shouldSucceed: true // Now implemented!
        },
        {
            name: 'Missing slide1 parameter',
            params: {
                slide2: 'https://picsum.photos/1080/1920?random=5',
                title2: 'Second Slide Only'
            },
            shouldSucceed: false
        },
        {
            name: 'Missing slide2 parameter',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=6',
                title1: 'First Slide Only'
            },
            shouldSucceed: false
        },
        {
            name: 'Invalid duration (too long)',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=7',
                slide2: 'https://picsum.photos/1080/1920?random=8',
                duration1: 60,
                duration2: 4
            },
            shouldSucceed: false
        },
        {
            name: 'Invalid transition type',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=9',
                slide2: 'https://picsum.photos/1080/1920?random=10',
                transition: 'invalid_transition'
            },
            shouldSucceed: false
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}`);

        try {
            const url = new URL('/2slidesReel', BASE_URL);
            Object.entries(testCase.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });

            console.log(`   URL: ${url.toString()}`);

            const response = await fetch(url.toString(), {
                headers: { 'X-API-Key': API_KEY }
            });

            const responseData = await response.json();

            if (testCase.shouldSucceed && response.ok) {
                console.log(`   ✅ Success! Response: ${JSON.stringify(responseData)}`);
            } else if (!testCase.shouldSucceed && !response.ok) {
                console.log(`   ✅ Expected error: ${response.status} - ${responseData.error || responseData.message}`);
            } else if (!testCase.shouldSucceed && response.status === 501) {
                console.log(`   ✅ Expected 501 Not Implemented: ${responseData.message}`);
            } else {
                console.log(`   ❌ Unexpected result: ${response.status} - ${JSON.stringify(responseData)}`);
            }
        } catch (error) {
            console.log(`   💥 Exception: ${error.message}`);
        }

        console.log('');
    }
}

/**
<<<<<<< Updated upstream
 * Test the addSubs endpoint
 */
async function testAddSubsEndpoint() {
    console.log('🎬 Testing addSubs endpoint...\n');

    const testCases = [
        {
            name: 'Valid addSubs request with provided test data',
            params: {
                videoURL: 'https://glavegbr.de/Bibel.mp4',
                text: 'Warum reden nicht mehr Menschen über die Bibel? Sie ist mehr als ein Buch - sie ist eine Quelle der Inspiration, der Weisheit und der Kraft. Entdecke die zeitlosen Geschichten und Werte, die Generationen geprägt haben. Die Bibel - ein Begleiter für alle Lebenslagen.'
=======
 * Test the specialReel endpoint
 */
async function testSpecialReelEndpoint() {
    console.log('🎬 Testing specialReel endpoint...\n');

    const testCases = [
        {
            name: 'Valid specialReel request with all parameters',
            params: {
                introVideo: 'https://glavegbr.de/BibelversDerWoche.mp4',
                introText: 'Welcome to our special reel! This is the introduction part.',
                middleImg: 'https://picsum.photos/1080/1350?random=1',
                middleText: 'This is the middle section with a beautiful image and Ken Burns effect.',
                middleDuration: 8,
                outroVideo: 'https://glavegbr.de/Bibel.mp4'
>>>>>>> Stashed changes
            },
            shouldSucceed: true
        },
        {
<<<<<<< Updated upstream
            name: 'Missing videoURL parameter',
            params: {
                text: 'Test subtitle text'
=======
            name: 'Valid specialReel request with minimal parameters',
            params: {
                introVideo: 'https://glavegbr.de/BibelversDerWoche.mp4',
                middleImg: 'https://picsum.photos/1024/1024?random=2',
                outroVideo: 'https://glavegbr.de/Bibel.mp4'
            },
            shouldSucceed: true
        },
        {
            name: 'Missing introVideo parameter',
            params: {
                middleImg: 'https://picsum.photos/1080/1920?random=3',
                middleText: 'Middle text only',
                outroVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
>>>>>>> Stashed changes
            },
            shouldSucceed: false
        },
        {
<<<<<<< Updated upstream
            name: 'Missing text parameter',
            params: {
                videoURL: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
=======
            name: 'Missing middleImg parameter',
            params: {
                introVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
                introText: 'Intro text only',
                outroVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4'
>>>>>>> Stashed changes
            },
            shouldSucceed: false
        },
        {
<<<<<<< Updated upstream
            name: 'Invalid video URL',
            params: {
                videoURL: 'not-a-valid-url',
                text: 'Test subtitle text'
=======
            name: 'Missing outroVideo parameter',
            params: {
                introVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
                middleImg: 'https://picsum.photos/1080/1920?random=4',
                middleText: 'Middle section'
>>>>>>> Stashed changes
            },
            shouldSucceed: false
        },
        {
<<<<<<< Updated upstream
            name: 'Empty text parameter',
            params: {
                videoURL: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
                text: ''
=======
            name: 'Invalid middleDuration (too long)',
            params: {
                introVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
                middleImg: 'https://picsum.photos/1080/1920?random=5',
                middleDuration: 60,
                outroVideo: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4'
>>>>>>> Stashed changes
            },
            shouldSucceed: false
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}`);

        try {
<<<<<<< Updated upstream
            const url = new URL('/addSubs', BASE_URL);
=======
            const url = new URL('/specialReel', BASE_URL);
>>>>>>> Stashed changes
            Object.entries(testCase.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });

            console.log(`   URL: ${url.toString()}`);

            const response = await fetch(url.toString(), {
                headers: { 'X-API-Key': API_KEY }
            });

            const responseData = await response.json();

            if (testCase.shouldSucceed && response.ok) {
                console.log(`   ✅ Success! Response: ${JSON.stringify(responseData)}`);
            } else if (!testCase.shouldSucceed && !response.ok) {
                console.log(`   ✅ Expected error: ${response.status} - ${responseData.error || responseData.message}`);
            } else {
                console.log(`   ❌ Unexpected result: ${response.status} - ${JSON.stringify(responseData)}`);
            }
        } catch (error) {
            console.log(`   💥 Exception: ${error.message}`);
        }

        console.log('');
    }
}

/**
 * Test the 3slidesReel endpoint
 */
async function test3SlidesReelEndpoint() {
    console.log('🎬 Testing 3slidesReel endpoint...\n');

    const testCases = [
        {
            name: 'Valid 3slidesReel request with all parameters',
            params: {
                slide1: 'https://picsum.photos/1080/1350?random=1',
                slide2: 'https://picsum.photos/2160/1080?random=2',
                slide3: 'https://picsum.photos/1080/1920?random=3',
                title1: 'First Slide Title this is the first test video. This is a Instagram image.',
                title2: 'Second Slide Title this is the first test video. This is a landscape image. And much more text to display on the second slide.',
                title3: 'Third Slide Title this is the final slide with a portrait image and some additional text content.',
                duration1: 4,
                duration2: 5,
                duration3: 6,
                transition: 'fade'
            },
            shouldSucceed: true
        },
        {
            name: 'Valid 3slidesReel request with minimal parameters',
            params: {
                slide1: 'https://picsum.photos/1024/1024?random=4',
                slide2: 'https://picsum.photos/3072/1024?random=5',
                slide3: 'https://picsum.photos/1024/1024?random=6'
            },
            shouldSucceed: true
        },
        {
            name: 'Missing slide1 parameter',
            params: {
                slide2: 'https://picsum.photos/1080/1920?random=7',
                slide3: 'https://picsum.photos/1080/1920?random=8',
                title2: 'Second Slide Only',
                title3: 'Third Slide Only'
            },
            shouldSucceed: false
        },
        {
            name: 'Missing slide2 parameter',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=9',
                slide3: 'https://picsum.photos/1080/1920?random=10',
                title1: 'First Slide Only',
                title3: 'Third Slide Only'
            },
            shouldSucceed: false
        },
        {
            name: 'Missing slide3 parameter',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=11',
                slide2: 'https://picsum.photos/1080/1920?random=12',
                title1: 'First Slide Only',
                title2: 'Second Slide Only'
            },
            shouldSucceed: false
        },
        {
            name: 'Invalid duration (too long)',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=13',
                slide2: 'https://picsum.photos/1080/1920?random=14',
                slide3: 'https://picsum.photos/1080/1920?random=15',
                duration1: 60,
                duration2: 4,
                duration3: 4
            },
            shouldSucceed: false
        },
        {
            name: 'Invalid transition type',
            params: {
                slide1: 'https://picsum.photos/1080/1920?random=16',
                slide2: 'https://picsum.photos/1080/1920?random=17',
                slide3: 'https://picsum.photos/1080/1920?random=18',
                transition: 'invalid_transition'
            },
            shouldSucceed: false
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 ${testCase.name}`);

        try {
            const url = new URL('/3slidesReel', BASE_URL);
            Object.entries(testCase.params).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });

            console.log(`   URL: ${url.toString()}`);

            const response = await fetch(url.toString(), {
                headers: { 'X-API-Key': API_KEY }
            });

            const responseData = await response.json();

            if (testCase.shouldSucceed && response.ok) {
                console.log(`   ✅ Success! Response: ${JSON.stringify(responseData)}`);
            } else if (!testCase.shouldSucceed && !response.ok) {
                console.log(`   ✅ Expected error: ${response.status} - ${responseData.error || responseData.message}`);
            } else {
                console.log(`   ❌ Unexpected result: ${response.status} - ${JSON.stringify(responseData)}`);
            }
        } catch (error) {
            console.log(`   💥 Exception: ${error.message}`);
        }

        console.log('');
    }
}

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

            const response = await fetch(url.toString(), {
                headers: { 'X-API-Key': API_KEY }
            });

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
        // Test health check endpoint first (no API key required)
        const healthResponse = await fetch(`${BASE_URL}/healthz`);

        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('✅ Health check endpoint responding');
            console.log(`   Version: ${healthData.version}`);
            console.log(`   Available endpoints: ${healthData.endpoints.join(', ')}`);
        } else {
            console.log(`❌ Health check failed: ${healthResponse.status}`);
            return false;
        }

        // Test overlay endpoint with API key
        const response = await fetch(`${BASE_URL}/overlay?img=https://picsum.photos/100/100&title=health&source=test`, {
            headers: { 'X-API-Key': API_KEY }
        });

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
        await testApiKeyValidation();
        await testOverlayEndpoint();
        await test2SlidesReelEndpoint();
        await test3SlidesReelEndpoint();
<<<<<<< Updated upstream
        await testAddSubsEndpoint();
=======
        await testSpecialReelEndpoint();
>>>>>>> Stashed changes
    }

    console.log('='.repeat(50));
    console.log('✨ Tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

<<<<<<< Updated upstream
export { testApiKeyValidation, test2SlidesReelEndpoint, test3SlidesReelEndpoint, testAddSubsEndpoint, testOverlayEndpoint, testServerHealth, runTests };
=======
export { testApiKeyValidation, test2SlidesReelEndpoint, test3SlidesReelEndpoint, testSpecialReelEndpoint, testOverlayEndpoint, testServerHealth, runTests };
>>>>>>> Stashed changes
