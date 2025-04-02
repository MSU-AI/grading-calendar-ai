const functions = require('firebase-functions');

/**
 * Get OpenAI API key from Firebase configuration or environment variable
 * @returns {string} API key
 * @throws {Error} If API key is not configured
 */
function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || 
                (functions.config().openai && functions.config().openai.apikey);
  
  if (!apiKey) {
    console.error('OpenAI API key not found in environment or Firebase config');
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY or firebase config openai.apikey');
  }
  
  return apiKey;
}

module.exports = {
  getOpenAIApiKey
};
