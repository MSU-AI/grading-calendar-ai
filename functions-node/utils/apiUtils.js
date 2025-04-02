/**
 * Get OpenAI API key from environment variable
 * @returns {string} API key
 * @throws {Error} If API key is not configured
 */
function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in environment');
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable');
  }
  
  return apiKey;
}

module.exports = {
  getOpenAIApiKey
};
