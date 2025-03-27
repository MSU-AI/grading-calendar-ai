const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { formatDataForCalculation } = require('./formatDocumentData');

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
      // Format data and calculate - Now await the async formatting
      const formattedData = await formatDataForCalculation(structuredData);
      currentCalculation = calculateExactGradeStatistics(formattedData);
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
 * Format data specifically for AI prediction prompt
 * @param {Object} structuredData - Raw structured data
 * @param {Object} currentCalculation - Current grade calculation
 * @returns {Object} Formatted data for AI prompt
 */
function formatDataForAIPrediction(structuredData, currentCalculation) {
  const syllabus = structuredData.syllabus || {};
  const transcript = structuredData.transcript || {};
  const grades = structuredData.grades || {};
  
  return {
    // Course information
    course: {
      name: syllabus.course_name || "Unknown Course",
      instructor: syllabus.instructor || "Unknown Instructor",
      creditHours: syllabus.credit_hours || "3"
    },
    
    // Grade weights
    gradeWeights: syllabus.grade_weights || [],
    
    // Current performance
    currentPerformance: {
      current_grade: currentCalculation.current_grade,
      letter_grade: currentCalculation.letter_grade,
      max_possible_grade: currentCalculation.max_possible_grade,
      min_possible_grade: currentCalculation.min_possible_grade
    },
    
    // Categorized grades with details
    categories: currentCalculation.categorized_grades,
    
    // Previous academic history
    academicHistory: {
      overall_gpa: transcript.overall_gpa || grades.overall_gpa || "Unknown",
      term_gpa: transcript.term_gpa || grades.term_gpa || "Unknown",
      previous_courses: transcript.courses || []
    },
    
    // Due dates and upcoming assignments
    dueDates: syllabus.due_dates || [],
    
    // Request format version (for future compatibility)
    formatVersion: "1.0"
  };
}

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
${(data.academicHistory.previous_courses || []).map(c => 
  `- ${c.course_code}: ${c.grade}`
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
 * Get OpenAI API key from environment
 * @returns {string} API key
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

/**
 * Fetch structured data from Firestore (duplicated from calculateGrade.js)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Structured data
 */
async function fetchStructuredDataFromFirestore(userId) {
  // Same implementation as in calculateGrade.js
  // Duplicated here to avoid circular dependencies
  console.log(`Fetching structured data for user ${userId}`);
  const db = admin.firestore();
  const structuredData = {};
  
  try {
    // Fetch latest syllabus
    const syllabusQuery = db.collection('users').doc(userId)
      .collection('documents')
      .where('documentType', '==', 'syllabus')
      .where('status', '==', 'processed')
      .orderBy('uploadedAt', 'desc')
      .limit(1);
    
    const syllabusSnapshot = await syllabusQuery.get();
    
    if (!syllabusSnapshot.empty) {
      const syllabusDoc = syllabusSnapshot.docs[0];
      const syllabusData = syllabusDoc.data();
      
      if (syllabusData.specialized_data && syllabusData.specialized_data.data) {
        structuredData.syllabus = syllabusData.specialized_data.data;
      } else if (syllabusData.structured_data) {
        structuredData.syllabus = syllabusData.structured_data;
      }
    }
    
    // Fetch latest grades
    const gradesQuery = db.collection('users').doc(userId)
      .collection('documents')
      .where('documentType', 'in', ['grades', 'transcript'])
      .where('status', '==', 'processed')
      .orderBy('uploadedAt', 'desc')
      .limit(1);
    
    const gradesSnapshot = await gradesQuery.get();
    
    if (!gradesSnapshot.empty) {
      const gradesDoc = gradesSnapshot.docs[0];
      const gradesData = gradesDoc.data();
      
      if (gradesData.specialized_data && gradesData.specialized_data.data) {
        structuredData[gradesData.documentType] = gradesData.specialized_data.data;
      } else if (gradesData.structured_data) {
        structuredData[gradesData.documentType] = gradesData.structured_data;
      }
    }
    
    return structuredData;
  } catch (error) {
    console.error(`Error fetching structured data: ${error}`);
    throw error;
  }
}

/**
 * Calculate grade statistics (simplified duplicate from calculateGrade.js)
 * @param {Object} data - Formatted data
 * @returns {Object} Grade statistics
 */
function calculateExactGradeStatistics(data) {
  // Simplified implementation to avoid code duplication
  // In production, consider importing from a shared module
  const { gradeWeights, completedAssignments, remainingAssignments } = data;
  
  // Initialize tracking variables
  const categoryStats = {};
  let totalWeightCovered = 0;
  
  // Calculate stats for each category
  gradeWeights.forEach(category => {
    const categoryAssignments = completedAssignments.filter(
      a => a.category === category.name
    );
    
    const categoryRemaining = remainingAssignments.filter(
      a => a.category === category.name
    );
    
    // Calculate total points and max possible in this category
    let totalPoints = 0;
    let maxPoints = 0;
    
    categoryAssignments.forEach(assignment => {
      // Handle numeric grades and special cases like "Dropped"
      if (typeof assignment.grade === 'number') {
        totalPoints += assignment.grade;
        maxPoints += assignment.maxPoints || 100;
      } else if (assignment.grade !== 'Dropped') {
        const numericGrade = parseFloat(assignment.grade);
        if (!isNaN(numericGrade)) {
          totalPoints += numericGrade;
          maxPoints += assignment.maxPoints || 100;
        }
      }
    });
    
    // Calculate category average
    const categoryAverage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : null;
    
    // Store stats
    categoryStats[category.name] = {
      completed: categoryAssignments,
      remaining: categoryRemaining,
      totalPoints,
      maxPoints,
      average: categoryAverage,
      weight: category.weight
    };
    
    // Add to total weight if we have assignments in this category
    if (maxPoints > 0) {
      totalWeightCovered += category.weight;
    }
  });
  
  // Calculate overall current grade
  let currentGradeWeighted = 0;
  
  Object.values(categoryStats).forEach(stats => {
    if (stats.average !== null) {
      // Scale by weight
      currentGradeWeighted += (stats.average / 100) * stats.weight;
    }
  });
  
  // Normalize by covered weight if needed
  const currentGrade = totalWeightCovered > 0 
    ? (currentGradeWeighted / totalWeightCovered) * 100
    : 0;
  
  // Return simplified calculation
  return {
    current_grade: currentGrade,
    current_percentage: currentGrade,
    letter_grade: getLetterGrade(currentGrade),
    max_possible_grade: 100,
    min_possible_grade: currentGrade,
    categorized_grades: categoryStats
  };
}

/**
 * Get letter grade from numeric value (duplicate)
 */
function getLetterGrade(grade) {
  if (grade >= 93) return 'A';
  if (grade >= 90) return 'A-';
  if (grade >= 87) return 'B+';
  if (grade >= 83) return 'B';
  if (grade >= 80) return 'B-';
  if (grade >= 77) return 'C+';
  if (grade >= 73) return 'C';
  if (grade >= 70) return 'C-';
  if (grade >= 67) return 'D+';
  if (grade >= 63) return 'D';
  if (grade >= 60) return 'D-';
  return 'F';
}
