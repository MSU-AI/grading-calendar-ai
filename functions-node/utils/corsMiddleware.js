const cors = require('cors')({ origin: true });

/**
 * Middleware to handle CORS for Firebase Cloud Functions
 * @param {Function} handler - The function handler to wrap with CORS support
 * @returns {Function} A function that handles CORS and then calls the handler
 */
const corsMiddleware = (handler) => {
  return (req, res) => {
    return cors(req, res, () => {
      return handler(req, res);
    });
  };
};

module.exports = corsMiddleware;
