/**
 * Storage Service Endpoints
 * 
 * Handles file upload and deletion for local storage service.
 * Supports audio, video, and image files with proper validation and error handling.
 */

import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configure multer for file uploads
 * 
 * @param {string} uploadDir - Directory to store uploaded files
 * @returns {Object} Multer configuration object
 */
const configureMulter = (uploadDir) => {
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Configure storage
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            // Generate unique filename with original extension
            const uniqueId = uuidv4();
            const extension = path.extname(file.originalname);
            const filename = `${uniqueId}${extension}`;
            cb(null, filename);
        }
    });

    // File filter for audio, video, and image files
    const fileFilter = (req, file, cb) => {
        const allowedMimeTypes = [
            // Audio formats
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/aac',
            'audio/m4a',
            'audio/flac',
            // Video formats
            'video/mp4',
            'video/avi',
            'video/mov',
            'video/wmv',
            'video/flv',
            'video/webm',
            'video/mkv',
            'video/quicktime',
            // Image formats
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/tiff',
            'image/svg+xml',
            'image/avif'
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Only audio, video, and image files are allowed.`), false);
        }
    };

    return multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 100 * 1024 * 1024, // 100MB limit
            files: 1 // Only one file per upload
        }
    });
};

/**
 * Upload file endpoint handler
 * 
 * POST /store/upload
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with storage settings
 */
export const uploadHandler = async (req, res, config) => {
    const requestId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📤 [${requestId}] Starting file upload...`);

    try {
        // Configure multer for this request with error handling
        const uploadDir = path.join(config.MEDIA_DIR, 'storage');

        // Ensure storage directory exists
        try {
            await fsp.access(uploadDir);
        } catch (error) {
            console.log(`📁 [${requestId}] Creating storage directory: ${uploadDir}`);
            await fsp.mkdir(uploadDir, { recursive: true });
        }

        const upload = configureMulter(uploadDir);

        // Handle single file upload
        upload.single('file')(req, res, async (err) => {
            if (err) {
                console.error(`❌ [${requestId}] Upload error:`, err.message);

                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({
                            error: 'File too large',
                            message: 'File size must be less than 100MB',
                            maxSize: '100MB'
                        });
                    } else if (err.code === 'LIMIT_FILE_COUNT') {
                        return res.status(400).json({
                            error: 'Too many files',
                            message: 'Only one file per upload is allowed'
                        });
                    }
                }

                return res.status(400).json({
                    error: 'Upload failed',
                    message: err.message
                });
            }

            if (!req.file) {
                console.log(`❌ [${requestId}] No file provided`);
                return res.status(400).json({
                    error: 'No file provided',
                    message: 'Please provide a file to upload'
                });
            }

            const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
            const fileUrl = `https://${config.DOMAIN}/media/storage/${req.file.filename}`;
            const fileSize = req.file.size;
            const mimeType = req.file.mimetype;
            const originalName = req.file.originalname;

            console.log(`✅ [${requestId}] File uploaded successfully:`);
            console.log(`   • File ID: ${fileId}`);
            console.log(`   • Original name: ${originalName}`);
            console.log(`   • MIME type: ${mimeType}`);
            console.log(`   • File size: ${fileSize} bytes`);
            console.log(`   • Storage path: ${req.file.path}`);
            console.log(`   • Public URL: ${fileUrl}`);

            // Return success response with file information
            res.status(201).json({
                success: true,
                id: fileId,
                filename: req.file.filename,
                originalName: originalName,
                mimeType: mimeType,
                size: fileSize,
                url: fileUrl,
                uploadTime: new Date().toISOString()
            });
        });

    } catch (error) {
        console.error(`💥 [${requestId}] Unexpected error:`, error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred during file upload'
        });
    }
};

/**
 * Delete file endpoint handler
 * 
 * DELETE /store/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object with storage settings
 */
export const deleteHandler = async (req, res, config) => {
    const requestId = `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileId = req.params.id;

    console.log(`🗑️ [${requestId}] Starting file deletion for ID: ${fileId}`);

    try {
        // Validate file ID format (UUID format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(fileId)) {
            console.log(`❌ [${requestId}] Invalid file ID format: ${fileId}`);
            return res.status(400).json({
                error: 'Invalid file ID',
                message: 'File ID must be a valid UUID format'
            });
        }

        // Find the file in storage directory with exact UUID matching
        const storageDir = path.join(config.MEDIA_DIR, 'storage');
        const files = await fsp.readdir(storageDir);
        const targetFile = files.find(f => f.startsWith(fileId + '.')); // exact UUID + dot

        if (!targetFile) {
            console.log(`❌ [${requestId}] File not found: ${fileId}`);
            return res.status(404).json({
                error: 'File not found',
                message: `No file found with ID: ${fileId}`
            });
        }

        const filePath = path.join(storageDir, targetFile);

        // Get file stats before deletion with error handling
        let fileSize = 0;
        try {
            const stats = await fsp.stat(filePath);
            fileSize = stats.size;
        } catch (statError) {
            console.warn(`⚠️ [${requestId}] Could not get file stats: ${statError.message}`);
            // Continue with deletion even if stats fail
        }

        // Delete the file with robust error handling
        try {
            await fsp.unlink(filePath);
        } catch (unlinkError) {
            console.error(`💥 [${requestId}] Failed to delete file: ${unlinkError.message}`);
            return res.status(500).json({
                error: 'File deletion failed',
                message: 'Could not delete the file from storage'
            });
        }

        console.log(`✅ [${requestId}] File deleted successfully:`);
        console.log(`   • File ID: ${fileId}`);
        console.log(`   • Filename: ${targetFile}`);
        console.log(`   • File size: ${fileSize} bytes`);
        console.log(`   • Deleted at: ${new Date().toISOString()}`);

        // Return success response
        res.status(200).json({
            success: true,
            id: fileId,
            filename: targetFile,
            size: fileSize,
            deletedAt: new Date().toISOString(),
            message: 'File deleted successfully'
        });

    } catch (error) {
        console.error(`💥 [${requestId}] Unexpected delete error:`, error.message);

        // Handle directory read errors
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'Storage directory not found',
                message: 'Storage service is not properly configured'
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred during file deletion'
        });
    }
};
