/**
 * Health Check Endpoint
 * 
 * Simple endpoint to verify server is running and provide basic status information.
 */

/**
 * Health check endpoint handler
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const healthCheck = (req, res) => {
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: ['/overlay', '/2slidesReel', '/healthz']
    });
};
