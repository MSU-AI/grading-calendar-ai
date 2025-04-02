const functions = require('firebase-functions/v2');

/**
 * Get OpenAI API key from Firebase secrets
 * @returns {string} API key
 * @throws {Error} If API key is not configured
 */
function getOpenAIApiKey() {
  const apiKey = functions.params.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in Firebase secrets');
    throw new Error('OpenAI API key not configured');
  }
  
  return apiKey;
}

module.exports = {
  getOpenAIApiKey
};