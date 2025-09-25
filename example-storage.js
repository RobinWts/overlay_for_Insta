/**
 * Example usage of the storage service endpoints
 * 
 * This script demonstrates how to use the file upload and deletion endpoints
 * for the local storage service.
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:8080';
const API_KEY = process.env.OVERLAY_API_KEY || 'default-api-key-change-in-production';

/**
 * Example: Upload a file to the storage service
 */
async function uploadFileExample() {
    console.log('📤 Example: Uploading a file to storage service...\n');

    try {
        // Create a sample text file for demonstration
        const sampleContent = 'This is a sample audio file content for demonstration purposes.';
        const sampleBuffer = Buffer.from(sampleContent);

        // Create FormData for file upload
        const formData = new FormData();
        const blob = new Blob([sampleBuffer], { type: 'audio/mpeg' });
        formData.append('file', blob, 'sample-audio.mp3');

        const response = await fetch(`${BASE_URL}/store/upload`, {
            method: 'POST',
            headers: { 'X-API-Key': API_KEY },
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Upload successful!');
            console.log(`   File ID: ${result.id}`);
            console.log(`   Filename: ${result.filename}`);
            console.log(`   Original name: ${result.originalName}`);
            console.log(`   MIME type: ${result.mimeType}`);
            console.log(`   File size: ${result.size} bytes`);
            console.log(`   Public URL: ${result.url}`);
            console.log(`   Upload time: ${result.uploadTime}`);

            return result.id; // Return the file ID for deletion example
        } else {
            const error = await response.json();
            console.log('❌ Upload failed:');
            console.log(`   Status: ${response.status}`);
            console.log(`   Error: ${error.error || error.message}`);
        }
    } catch (error) {
        console.log('💥 Upload exception:', error.message);
    }

    return null;
}

/**
 * Example: Delete a file from the storage service
 */
async function deleteFileExample(fileId) {
    console.log('\n🗑️ Example: Deleting a file from storage service...\n');

    if (!fileId) {
        console.log('⚠️ No file ID provided, skipping deletion example');
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/store/${fileId}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': API_KEY }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Deletion successful!');
            console.log(`   File ID: ${result.id}`);
            console.log(`   Filename: ${result.filename}`);
            console.log(`   File size: ${result.size} bytes`);
            console.log(`   Deleted at: ${result.deletedAt}`);
            console.log(`   Message: ${result.message}`);
        } else {
            const error = await response.json();
            console.log('❌ Deletion failed:');
            console.log(`   Status: ${response.status}`);
            console.log(`   Error: ${error.error || error.message}`);
        }
    } catch (error) {
        console.log('💥 Deletion exception:', error.message);
    }
}

/**
 * Example: Test file type validation
 */
async function testFileTypeValidation() {
    console.log('\n🧪 Example: Testing file type validation...\n');

    const testCases = [
        {
            name: 'Valid audio file (MP3)',
            content: 'Mock MP3 content',
            mimeType: 'audio/mpeg',
            fileName: 'test.mp3',
            shouldSucceed: true
        },
        {
            name: 'Valid video file (MP4)',
            content: 'Mock MP4 content',
            mimeType: 'video/mp4',
            fileName: 'test.mp4',
            shouldSucceed: true
        },
        {
            name: 'Invalid text file',
            content: 'Mock text content',
            mimeType: 'text/plain',
            fileName: 'test.txt',
            shouldSucceed: false
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 Testing: ${testCase.name}`);

        try {
            const formData = new FormData();
            const blob = new Blob([testCase.content], { type: testCase.mimeType });
            formData.append('file', blob, testCase.fileName);

            const response = await fetch(`${BASE_URL}/store/upload`, {
                method: 'POST',
                headers: { 'X-API-Key': API_KEY },
                body: formData
            });

            const result = await response.json();

            if (testCase.shouldSucceed && response.ok) {
                console.log(`   ✅ Success! File ID: ${result.id}`);
            } else if (!testCase.shouldSucceed && !response.ok) {
                console.log(`   ✅ Expected error: ${result.error || result.message}`);
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
 * Main example function
 */
async function runStorageExamples() {
    console.log('🚀 Storage Service Examples\n');
    console.log('='.repeat(50));

    // Test server health first
    try {
        const healthResponse = await fetch(`${BASE_URL}/healthz`);
        if (!healthResponse.ok) {
            console.log('❌ Server is not running. Please start the server with: npm run dev');
            return;
        }
        console.log('✅ Server is running\n');
    } catch (error) {
        console.log('❌ Cannot connect to server. Please start the server with: npm run dev');
        return;
    }

    // Run examples
    const fileId = await uploadFileExample();
    await deleteFileExample(fileId);
    await testFileTypeValidation();

    console.log('='.repeat(50));
    console.log('✨ Storage service examples completed!');
    console.log('\n📚 Available endpoints:');
    console.log('   POST /store/upload - Upload audio/video files');
    console.log('   DELETE /store/:id - Delete files by ID');
    console.log('\n🔑 Remember to include the X-API-Key header in your requests!');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runStorageExamples().catch(console.error);
}

export { uploadFileExample, deleteFileExample, testFileTypeValidation, runStorageExamples };
