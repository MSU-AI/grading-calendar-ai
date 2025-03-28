const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Cloud Function to calculate current grade based on submitted assignments
 */
exports.calculateCurrentGrade = functions.https.onCall(async (data, context) => {
  try {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    console.log(`Calculating current grade for user ${userId}`);
    
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
    
    // Use the formatted data directly for calculation
    // Extract only the parts needed for grade calculation
    const calculationData = {
      course: structuredData.course,
      gradeWeights: structuredData.gradeWeights,
      completedAssignments: structuredData.completedAssignments,
      remainingAssignments: structuredData.remainingAssignments,
      dueDates: structuredData.dueDates,
      gpa: structuredData.gpa
    };
    
    // Calculate grades using the formatted data
    const gradeStats = calculateExactGradeStatistics(calculationData);
    
    // Optionally store calculation result
    if (data.storeResult === true) {
      await storeCalculationResult(userId, gradeStats, structuredData);
    }
    
    return {
      success: true,
      calculation: gradeStats,
      formatted_data: structuredData
    };
  } catch (error) {
    console.error(`Error in calculateCurrentGrade: ${error}`);
    console.error('Stack trace:', error.stack);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Calculate grade statistics with precision
 * @param {Object} data - Formatted data from formatDataForCalculation
 * @returns {Object} Calculated statistics
 */
function calculateExactGradeStatistics(data) {
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
  
  // Calculate max possible grade (if all remaining is 100%)
  let maxPossibleGrade = currentGradeWeighted;
  let remainingWeight = 0;
  
  Object.values(categoryStats).forEach(stats => {
    // Count weight for categories with remaining assignments
    if (stats.remaining.length > 0) {
      const categoryRemainingWeight = stats.weight * (stats.remaining.length / 
        (stats.completed.length + stats.remaining.length || 1));
      
      remainingWeight += categoryRemainingWeight;
      maxPossibleGrade += categoryRemainingWeight;
    }
  });
  
  // Normalize max grade
  maxPossibleGrade = totalWeightCovered > 0 
    ? (maxPossibleGrade / (totalWeightCovered + remainingWeight)) * 100
    : 100;
  
  // Min grade (if all remaining is 0%)
  const minPossibleGrade = totalWeightCovered > 0 
    ? (currentGradeWeighted / (totalWeightCovered + remainingWeight)) * 100
    : 0;
  
  // Format for return
  return {
    current_grade: currentGrade,
    current_percentage: currentGrade,
    letter_grade: getLetterGrade(currentGrade),
    max_possible_grade: maxPossibleGrade,
    min_possible_grade: minPossibleGrade,
    categorized_grades: categoryStats,
    analysis: generateGradeAnalysis({
      currentGrade,
      maxPossibleGrade,
      minPossibleGrade,
      letterGrade: getLetterGrade(currentGrade),
      categorizedGrades: categoryStats
    })
  };
}

/**
 * Get letter grade from numeric value
 * @param {number} grade - Numeric grade
 * @returns {string} Letter grade
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

/**
 * Generate natural language analysis of grade stats
 * @param {Object} stats - Grade statistics
 * @returns {string} Analysis text
 */
function generateGradeAnalysis(stats) {
  const { currentGrade, maxPossibleGrade, minPossibleGrade, letterGrade } = stats;
  const analysis = [];
  
  analysis.push(`Current grade is ${currentGrade.toFixed(1)}% (${letterGrade})`);
  
  if (maxPossibleGrade > currentGrade) {
    analysis.push(`Maximum possible grade is ${maxPossibleGrade.toFixed(1)}%`);
  }
  
  if (minPossibleGrade < currentGrade) {
    analysis.push(`Minimum possible grade is ${minPossibleGrade.toFixed(1)}%`);
  }
  
  return analysis.join('. ');
}

/**
 * Fetch structured data from Firestore
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

/**
 * Store calculation result in Firestore
 * @param {string} userId - User ID
 * @param {Object} calculation - Calculation result
 * @param {Object} structuredData - Source structured data
 * @returns {Promise<void>}
 */
async function storeCalculationResult(userId, calculation, structuredData) {
  console.log(`Storing calculation result for user ${userId}`);
  const db = admin.firestore();
  
  try {
    const calculationRef = db.collection('users').doc(userId)
      .collection('calculations').doc();
    
    await calculationRef.set({
      calculation,
      structuredData,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Calculation stored with ID: ${calculationRef.id}`);
  } catch (error) {
    console.error(`Error storing calculation: ${error}`);
    // Continue without failing the function
  }
}
