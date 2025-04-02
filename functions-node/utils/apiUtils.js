const functions = require('firebase-functions');

/**
 * Get OpenAI API key from Firebase config
 * @returns {string} API key
 * @throws {Error} If API key is not configured
 */
function getOpenAIApiKey() {
  // Get API key from Firebase config (v1 style)
  const apiKey = functions.config().openai?.key;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in Firebase config');
    throw new Error('OpenAI API key not configured');
  }
  
  return apiKey;
}

module.exports = {
  getOpenAIApiKey
};