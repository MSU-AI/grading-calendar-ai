const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getLetterGrade } = require('./utils/gradeUtils');
const { calculateExactGradeStatistics, generateGradeAnalysis } = require('./utils/calculationUtils');

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
