function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || 
    (process.env.FIREBASE_CONFIG ? 
      JSON.parse(process.env.FIREBASE_CONFIG).openai?.apikey : null);
  
  if (!apiKey) {
    console.error('OpenAI API key not found in environment');
    throw new Error('OpenAI API key not configured');
  }
  
  return apiKey;
}