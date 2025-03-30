const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { getLetterGrade } = require('./utils/gradeUtils');
const { getOpenAIApiKey } = require('./utils/apiUtils');
const { calculateExactGradeStatistics, formatDataForAIPrediction } = require('./utils/calculationUtils');

/**
 * Cloud Function to predict final grade using AI
 */
exports.predictFinalGrade = functions.https.onCall(async (data, context) => {
  try {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    console.log(`Predicting final grade for user ${userId}`);
    
    // Get structured data (either from request or from database)
    let structuredData;
    if (data.useStoredData === true) {
      // Fetch from database
      structuredData = await fetchStructuredDataFromFirestore(userId);
    } else if (data.structuredData) {
      // Use provided data
      structuredData = data.structuredData;
    } else {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Must provide structuredData or set useStoredData to true'
      );
    }
    
    // Get current calculation (either from request or calculate fresh)
    let currentCalculation;
    if (data.currentCalculation) {
      currentCalculation = data.currentCalculation;
    } else {
      // Calculate using the formatted data directly
      currentCalculation = calculateExactGradeStatistics(structuredData);
    }
    
    // Format data for AI prediction
    const aiPromptData = formatDataForAIPrediction(structuredData, currentCalculation);
    
    // Get prediction from OpenAI
    const prediction = await getAIPrediction(aiPromptData);
    
    // Store prediction in Firestore
    const predictionId = await storePrediction(userId, structuredData, currentCalculation, prediction);
    
    return {
      success: true,
      prediction: prediction,
      calculation: currentCalculation,
      predictionId: predictionId
    };
  } catch (error) {
    console.error(`Error in predictFinalGrade: ${error}`);
    console.error('Stack trace:', error.stack);
    throw new functions.https.HttpsError('internal', error.message);
  }
});


/**
 * Get AI prediction using OpenAI
 * @param {Object} data - Formatted prediction data
 * @returns {Promise<Object>} Prediction result
 */
async function getAIPrediction(data) {
  // Get API key
  const apiKey = getOpenAIApiKey();
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
  // Create a highly structured prompt with clear JSON instructions
  const prompt = `
You are an academic performance prediction system analyzing the following student data:

Course: ${data.course.name}
Instructor: ${data.course.instructor}
Credit Hours: ${data.course.creditHours}

Current Grade: ${data.currentPerformance.current_grade.toFixed(1)}%
Current Letter Grade: ${data.currentPerformance.letter_grade}
Maximum Possible Grade: ${data.currentPerformance.max_possible_grade.toFixed(1)}%
Minimum Possible Grade: ${data.currentPerformance.min_possible_grade.toFixed(1)}%

Grade Weights:
${data.gradeWeights.map(w => `- ${w.name}: ${(w.weight * 100).toFixed(0)}%`).join('\n')}

Category Performance:
${Object.entries(data.categories || {}).map(([name, cat]) => 
  `- ${name}: ${cat.average !== null ? cat.average.toFixed(1) + '%' : 'No data'} 
   (${cat.completed.length} completed, ${cat.remaining.length} remaining)`
).join('\n')}

Overall GPA: ${data.academicHistory.overall_gpa}
Term GPA: ${data.academicHistory.term_gpa}

Previous Related Courses:
${(data.academicHistory.relevantCourses || []).map(c => 
  `- ${c.course_code}: ${c.grade} (${c.relevance} relevance)`
).join('\n') || "None available"}

RESPOND ONLY WITH VALID JSON IN THIS EXACT FORMAT:
{
  "grade": "B+",
  "numerical_grade": 87.5,
  "reasoning": "Concise explanation of your prediction"
}
`;

  try {
    console.log('Calling OpenAI API for prediction');
    // Call OpenAI with strict instruction for JSON
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a precise academic prediction system. You MUST respond with ONLY valid JSON. The JSON MUST contain exactly three fields: 'grade' (a letter grade), 'numerical_grade' (a number), and 'reasoning' (a string). Include NO other text outside the JSON object."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" } // Enforces JSON response
    });
    
    // Extract the JSON response
    const responseText = response.choices[0].message.content;
    console.log(`OpenAI response: ${responseText}`);
    
    try {
      // Parse JSON
      const prediction = JSON.parse(responseText);
      
      // Validate required fields
      if (!prediction.grade || !prediction.numerical_grade || !prediction.reasoning) {
        throw new Error("Missing required fields in prediction");
      }
      
      return prediction;
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw response:", responseText);
      
      // Return fallback prediction
      return {
        grade: data.currentPerformance.letter_grade,
        numerical_grade: data.currentPerformance.current_grade,
        reasoning: "Prediction based on current performance (AI response error)."
      };
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    
    // Return fallback prediction
    return {
      grade: data.currentPerformance.letter_grade,
      numerical_grade: data.currentPerformance.current_grade,
      reasoning: "Prediction based on current performance (API error)."
    };
  }
}

/**
 * Store prediction in Firestore
 * @param {string} userId - User ID
 * @param {Object} structuredData - Source structured data
 * @param {Object} calculation - Current grade calculation
 * @param {Object} prediction - AI prediction
 * @returns {Promise<string>} Prediction document ID
 */
async function storePrediction(userId, structuredData, calculation, prediction) {
  console.log(`Storing prediction for user ${userId}`);
  const db = admin.firestore();
  
  try {
    const predictionRef = db.collection('users').doc(userId)
      .collection('predictions').doc();
    
    const predictionData = {
      prediction: {
        grade: prediction.numerical_grade,
        letter_grade: prediction.grade,
        current_percentage: calculation.current_grade,
        max_possible_grade: calculation.max_possible_grade,
        min_possible_grade: calculation.min_possible_grade,
        reasoning: prediction.reasoning,
        ai_prediction: prediction,
        categorized_grades: calculation.categorized_grades
      },
      calculation: calculation,
      structuredData: structuredData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await predictionRef.set(predictionData);
    console.log(`Prediction stored with ID: ${predictionRef.id}`);
    
    return predictionRef.id;
  } catch (error) {
    console.error(`Error storing prediction: ${error}`);
    // Continue without failing the function
    return null;
  }
}


/**
 * Fetch structured data from Firestore (duplicated from calculateGrade.js)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Structured data
 */
async function fetchStructuredDataFromFirestore(userId) {
  console.log(`Fetching formatted data for user ${userId}`);
  const db = admin.firestore();
  
  try {
    // Fetch the unified formatted data
    const formattedDataDoc = await db.collection('users').doc(userId)
      .collection('data').doc('formatted_data').get();
    
    if (!formattedDataDoc.exists) {
      console.log('No formatted data found, checking for documents that need formatting');
      
      // Check if we have documents that need formatting
      const documentsRef = db.collection('users').doc(userId).collection('documents');
      const extractedDocs = await documentsRef.where('status', '==', 'extracted').get();
      
      if (!extractedDocs.empty) {
        console.log('Found extracted documents, triggering formatting');
        // Import the formatDocumentsData function dynamically to avoid circular dependencies
        const { formatDocumentsData } = require('./formatDocumentsData');
        
        // Format the documents
        const formattedData = await formatDocumentsData(userId);
        
        if (formattedData) {
          console.log('Successfully formatted documents');
          return formattedData;
        }
      }
      
      throw new Error('No formatted data available. Please upload and process documents first.');
    }
    
    // Return the formatted data
    const data = formattedDataDoc.data();
    return data.formatted_data;
  } catch (error) {
    console.error(`Error fetching structured data: ${error}`);
    throw error;
  }
}
