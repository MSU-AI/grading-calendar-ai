const { getOpenAIApiKey } = require('./apiUtils');
const OpenAI = require('openai');
const admin = require('firebase-admin');

/**
 * Store formatted data for a specific document type in Firestore
 * @param {string} userId - User ID
 * @param {string} documentType - Type of document (syllabus, grades, transcript)
 * @param {Object} formattedData - The formatted data to store
 * @returns {Promise<void>}
 */
async function storeFormattedDocumentData(userId, documentType, formattedData) {
  console.log(`Storing formatted ${documentType} data for user ${userId}`);
  const db = admin.firestore();
  
  try {
    await db.collection('users').doc(userId).collection('formatted_data').doc(documentType).set({
      data: formattedData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Successfully stored formatted ${documentType} data`);
  } catch (error) {
    console.error(`Error storing formatted ${documentType} data:`, error);
    throw error;
  }
}

/**
 * Retrieve formatted data for a specific document type from Firestore
 * @param {string} userId - User ID
 * @param {string} documentType - Type of document (syllabus, grades, transcript)
 * @returns {Promise<Object|null>} The formatted data or null if not found
 */
async function getFormattedDocumentData(userId, documentType) {
  console.log(`Retrieving formatted ${documentType} data for user ${userId}`);
  const db = admin.firestore();
  
  try {
    const docRef = db.collection('users').doc(userId).collection('formatted_data').doc(documentType);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`No formatted ${documentType} data found`);
      return null;
    }
    
    return doc.data().data;
  } catch (error) {
    console.error(`Error retrieving formatted ${documentType} data:`, error);
    return null;
  }
}

/**
 * Call OpenAI API with a structured prompt
 * @param {string} prompt - The prompt for OpenAI
 * @returns {Promise<Object>} JSON response from OpenAI
 */
async function callOpenAIForFormatting(prompt) {
  // Get OpenAI API key
  const apiKey = getOpenAIApiKey();
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
  console.log("Calling OpenAI API for formatting");
  try {
    // Call OpenAI with strict instruction for JSON
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a precise data formatting assistant. You MUST respond with ONLY valid JSON that exactly matches the requested structure. Include NO explanatory text outside the JSON object."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: "json_object" } // Enforces JSON response
    });
    
    // Extract the JSON response
    const responseContent = response.choices[0].message.content;
    console.log("OpenAI response received");
    
    try {
      // Parse JSON
      return JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw response:", responseContent);
      throw new Error("Failed to parse OpenAI response");
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

module.exports = {
  storeFormattedDocumentData,
  getFormattedDocumentData,
  callOpenAIForFormatting
};
