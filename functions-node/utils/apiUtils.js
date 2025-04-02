function getOpenAIApiKey() {
  // First check normal environment variable
  let apiKey = process.env.OPENAI_API_KEY;
  
  // If not found, try to get it from Firebase config
  if (!apiKey && process.env.FIREBASE_CONFIG) {
    try {
      const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      apiKey = firebaseConfig.openai?.apikey;
    } catch (e) {
      console.error('Error parsing Firebase config:', e);
    }
  }
  
  if (!apiKey) {
    console.error('OpenAI API key not found in environment');
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable');
  }
  
  return apiKey;
}