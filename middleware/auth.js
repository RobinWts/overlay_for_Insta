/**
 * Authentication Middleware
 * 
 * Handles API key validation for secure access to endpoints.
 */

/**
 * API Key Validation Middleware
 * 
 * Validates the API key from the X-API-Key header if API key validation is enabled.
 * This provides basic security for the overlay service.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 * @param {Object} config - Configuration object with API key settings
 */
export const validateApiKey = (config) => (req, res, next) => {
    // Skip validation if API key requirement is disabled
    if (!config.REQUIRE_API_KEY) {
        return next();
    }

    // Extract API key from X-API-Key header
    const providedKey = req.headers['x-api-key'];

    if (!providedKey) {
        console.log(`❌ [${req.id || 'unknown'}] Missing API key in request headers`);
        return res.status(401).json({
            error: 'API key required',
            message: 'Please provide your API key in the X-API-Key header'
        });
    }

    if (providedKey !== config.API_KEY) {
        console.log(`❌ [${req.id || 'unknown'}] Invalid API key provided`);
        return res.status(403).json({
            error: 'Invalid API key',
            message: 'The provided API key is not valid'
        });
    }

    console.log(`✅ [${req.id || 'unknown'}] API key validated successfully`);
    next();
};
