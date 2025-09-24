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
 * Creates subtitle timing using faster-whisper or fallback method
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

    // First try faster-whisper, if it fails, use a simple fallback
    try {
        await createSubtitleTimingWithWhisper(audioPath, text, srtPath, requestId);
        // Verify the file was created
        try {
            const stats = await fsp.stat(srtPath);
            console.log(`✅ [${requestId}] SRT file created by faster-whisper: ${srtPath} (${stats.size} bytes)`);
        } catch (error) {
            console.error(`❌ [${requestId}] SRT file not found after faster-whisper: ${srtPath}`);
            throw new Error(`SRT file not created by faster-whisper`);
        }
    } catch (whisperError) {
        console.warn(`⚠️ [${requestId}] Faster-whisper failed, using fallback method: ${whisperError.message}`);
        await createSubtitleTimingFallback(text, srtPath, requestId);
        // Verify the fallback file was created
        try {
            const stats = await fsp.stat(srtPath);
            console.log(`✅ [${requestId}] SRT file created by fallback: ${srtPath} (${stats.size} bytes)`);
        } catch (error) {
            console.error(`❌ [${requestId}] SRT file not found after fallback: ${srtPath}`);
            throw new Error(`SRT file not created by fallback method`);
        }
    }
}

/**
 * Creates subtitle timing using faster-whisper
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {string} text - Text to create subtitles for
 * @param {string} srtPath - Path to save the SRT file
 * @param {string} requestId - Request ID for logging
 */
async function createSubtitleTimingWithWhisper(audioPath, text, srtPath, requestId) {
    console.log(`📝 [${requestId}] Trying faster-whisper for subtitle timing...`);

    // Create a Python script to use faster-whisper
    const scriptPath = audioPath.replace('.wav', '_whisper.py');
    const scriptContent = `
import sys
from faster_whisper import WhisperModel
import datetime

def create_srt_from_audio(audio_path, target_text, output_path):
    # Load the model (using base model for speed)
    model = WhisperModel("base", device="cpu", compute_type="int8")
    
    # Transcribe the audio
    segments, info = model.transcribe(audio_path, word_timestamps=True)
    
    # Create SRT content
    srt_content = ""
    subtitle_index = 1
    
           # Convert segments to SRT format
           for segment in segments:
               start_time = datetime.timedelta(seconds=segment.start)
               end_time = datetime.timedelta(seconds=segment.end)
               
               # Format time as SRT requires (HH:MM:SS,mmm)
               start_srt = str(start_time).replace('.', ',')
               if len(start_srt.split(',')[0]) < 8:  # Add leading zeros if needed
                   start_srt = '0' + start_srt
               start_srt = start_srt[:12]  # Ensure proper length
               
               end_srt = str(end_time).replace('.', ',')
               if len(end_srt.split(',')[0]) < 8:  # Add leading zeros if needed
                   end_srt = '0' + end_srt
               end_srt = end_srt[:12]  # Ensure proper length
        
        # Use the target text for the subtitle content
        srt_content += f"{subtitle_index}\\n"
        srt_content += f"{start_srt} --> {end_srt}\\n"
        srt_content += f"{target_text}\\n\\n"
        
        subtitle_index += 1
    
    # Write SRT file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(srt_content)

if __name__ == "__main__":
    audio_path = sys.argv[1]
    target_text = sys.argv[2]
    output_path = sys.argv[3]
    
    create_srt_from_audio(audio_path, target_text, output_path)
    print("SRT file created successfully")
`;

    await fsp.writeFile(scriptPath, scriptContent, 'utf8');

    try {
        // Use faster-whisper to create subtitle timing
        const command = [
            scriptPath,
            audioPath,
            text,
            srtPath
        ];

        console.log(`🔧 [${requestId}] Faster-whisper command: python ${command.join(' ')}`);

        const { stdout, stderr } = await execFileAsync('python', command, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stderr) {
            console.log(`📝 [${requestId}] Faster-whisper stderr:`, stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
        }

        if (stdout) {
            console.log(`📝 [${requestId}] Faster-whisper stdout:`, stdout);
        }

        console.log(`✅ [${requestId}] Faster-whisper subtitle timing completed successfully`);

        // Clean up temporary script file
        try {
            await fsp.unlink(scriptPath);
        } catch (cleanupError) {
            console.warn(`⚠️ [${requestId}] Could not clean up script file: ${cleanupError.message}`);
        }

    } catch (error) {
        // Clean up temporary script file
        try {
            await fsp.unlink(scriptPath);
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
    console.log(`📝 [${requestId}] Writing SRT to: ${srtPath}`);

    // Split text into Instagram-friendly segments (3-5 words each)
    const words = text.split(/\s+/);
    const segmentDuration = 1.5; // Each segment shows for 1.5 seconds
    const maxWordsPerSegment = 4; // Maximum 4 words per segment for Instagram readability

    const segments = [];
    let currentSegment = [];
    let segmentIndex = 1;

    for (let i = 0; i < words.length; i++) {
        currentSegment.push(words[i]);

        // Create segment when we reach max words or end of text
        if (currentSegment.length >= maxWordsPerSegment || i === words.length - 1) {
            const startTime = (segmentIndex - 1) * segmentDuration;
            const endTime = startTime + segmentDuration;

            // Format time as SRT requires (HH:MM:SS,mmm)
            const startFormatted = formatTimeForSRT(startTime);
            const endFormatted = formatTimeForSRT(endTime);

            segments.push({
                index: segmentIndex,
                start: startFormatted,
                end: endFormatted,
                text: currentSegment.join(' ')
            });

            currentSegment = [];
            segmentIndex++;
        }
    }

    // Generate SRT content
    const srtContent = segments.map(segment =>
        `${segment.index}\n${segment.start} --> ${segment.end}\n${segment.text}\n`
    ).join('\n');

    console.log(`📝 [${requestId}] Created ${segments.length} segments for Instagram`);
    console.log(`📝 [${requestId}] SRT content: ${JSON.stringify(srtContent)}`);
    await fsp.writeFile(srtPath, srtContent, 'utf8');
    console.log(`✅ [${requestId}] Fallback subtitle timing completed successfully`);

    // Verify the file was written
    try {
        const stats = await fsp.stat(srtPath);
        console.log(`✅ [${requestId}] Fallback SRT file verified: ${srtPath} (${stats.size} bytes)`);
    } catch (error) {
        console.error(`❌ [${requestId}] Fallback SRT file verification failed: ${error.message}`);
        throw error;
    }
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

    // Check if SRT file exists
    try {
        const srtStats = await fsp.stat(srtPath);
        console.log(`📝 [${requestId}] SRT file exists: ${srtPath} (${srtStats.size} bytes)`);
    } catch (error) {
        console.error(`❌ [${requestId}] SRT file not found: ${srtPath}`);
        throw new Error(`SRT file not found: ${srtPath}`);
    }

    // Check if Inter font is available
    const fontPath = await findInterFont();
    if (!fontPath) {
        console.warn(`⚠️ [${requestId}] Inter font not found, using default font`);
    }

    // Use absolute paths for FFmpeg
    const absVideoPath = path.resolve(videoPath);
    const absSrtPath = path.resolve(srtPath);
    const absOutputPath = path.resolve(outputPath);

    const command = [
        '-i', absVideoPath,
        '-vf', `subtitles=${absSrtPath}:force_style='FontName=${fontPath || 'Arial'},FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2'`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '23',
        '-y', // Overwrite output file
        absOutputPath
    ];

    console.log(`🔧 [${requestId}] FFmpeg subtitle command: ffmpeg ${command.join(' ')}`);
    console.log(`🔧 [${requestId}] Video file exists: ${fs.existsSync(absVideoPath)}`);
    console.log(`🔧 [${requestId}] SRT file exists: ${fs.existsSync(absSrtPath)}`);
    console.log(`🔧 [${requestId}] SRT file size: ${fs.existsSync(absSrtPath) ? fs.statSync(absSrtPath).size : 'N/A'} bytes`);

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
        console.log(`📝 [${requestId}] About to call createSubtitleTiming with:`);
        console.log(`   • audioPath: ${audioPath}`);
        console.log(`   • text: "${text}"`);
        console.log(`   • srtPath: ${srtPath}`);
        await createSubtitleTiming(audioPath, text, srtPath, requestId);
        console.log(`📝 [${requestId}] createSubtitleTiming completed`);

        // Verify SRT file exists before proceeding
        try {
            const srtStats = await fsp.stat(srtPath);
            console.log(`📝 [${requestId}] SRT file verified: ${srtPath} (${srtStats.size} bytes)`);
        } catch (error) {
            console.error(`❌ [${requestId}] SRT file not found: ${srtPath}`);
            throw new Error(`SRT file not found: ${srtPath}`);
        }

        // Generate Instagram-style subtitles
        console.log(`🎨 [${requestId}] Generating styled subtitles...`);
        await generateStyledSubtitles(videoPath, srtPath, outputPath, requestId);

        // Generate video URL
        const videoUrl = `https://${DOMAIN}/media/${REELS_SUBDIR}/${path.basename(outputPath)}`;

        console.log(`✅ [${requestId}] Subtitled video generated successfully: ${videoUrl}`);

        // Clean up temporary files after successful completion
        console.log(`🧹 [${requestId}] SKIPPING cleanup for debugging - temp files preserved`);
        console.log(`🧹 [${requestId}] Temp directory: ${tempDir}`);
        console.log(`🧹 [${requestId}] SRT file: ${srtPath}`);
        console.log(`🧹 [${requestId}] Video file: ${videoPath}`);
        console.log(`🧹 [${requestId}] Output file: ${outputPath}`);

        return videoUrl;

    } catch (error) {
        // Clean up temporary files on error
        console.log(`🧹 [${requestId}] SKIPPING error cleanup for debugging - temp files preserved`);
        console.log(`🧹 [${requestId}] Temp directory: ${tempDir}`);
        console.log(`🧹 [${requestId}] SRT file: ${srtPath}`);
        console.log(`🧹 [${requestId}] Video file: ${videoPath}`);
        console.log(`🧹 [${requestId}] Output file: ${outputPath}`);
        throw error;
    }
}

/**
 * Formats time in seconds to SRT format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeForSRT(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

