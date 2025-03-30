const OpenAI = require('openai');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DOCUMENT_TYPES, normalizeDocumentType } = require('./utils/documentUtils');
const { getOpenAIApiKey } = require('./utils/apiUtils');

/**
 * Store debugging data in Firestore
 * @param {string} userId - User ID 
 * @param {string} prompt - OpenAI prompt
 * @param {string} response - OpenAI response
 */
async function storeDebugData(userId, prompt, response) {
  try {
    const db = admin.firestore();
    const debugRef = db.collection('users').doc(userId).collection('debug').doc();
    
    await debugRef.set({
      prompt,
      response,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Debug data stored with ID: ${debugRef.id}`);
    return debugRef.id;
  } catch (error) {
    console.error("Error storing debug data:", error);
    // Don't throw - this is just for debugging
  }
}

/**
 * Formats all document data using a single OpenAI API call to ensure consistent structure
 * @param {string} userId - The user ID
 * @param {boolean} forceProcess - Whether to force processing regardless of conditions
 * @returns {Promise<Object>} Formatted data for calculations and predictions
 */
exports.formatDocumentsData = async (userId, forceProcess = false) => {
  console.log(`====== FORMAT DOCUMENTS DATA CALLED - USER ID: ${userId}, FORCE: ${forceProcess} ======`);
  
  try {
    // Get all documents with extracted text
    const db = admin.firestore();
    const documentsRef = db.collection('users').doc(userId).collection('documents');
    
    // If forceProcess is true, get all documents regardless of status
    // Otherwise, only get documents with 'extracted' status
    const query = forceProcess 
      ? documentsRef.where('status', 'in', ['extracted', 'uploaded'])
      : documentsRef.where('status', '==', 'extracted');
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No documents found for formatting');
      return null;
    }
    
    console.log(`Found ${snapshot.size} documents with status 'extracted':`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- Doc ID: ${doc.id}, Type: ${data.documentType}, Status: ${data.status}, Text length: ${data.text?.length || 0}`);
    });
    
    // Organize documents by type
    const documentsByType = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.documentType && data.text) {
        // Use normalized document type
        const normalizedType = normalizeDocumentType(data.documentType);
        documentsByType[normalizedType] = {
          id: doc.id,
          text: data.text,
          ...data
        };
      }
    });
    
    console.log(`Found documents by type: ${Object.keys(documentsByType).join(', ')}`);
    
    // Check if we have a syllabus document - case insensitive
    const hasSyllabus = Object.entries(documentsByType).some(([type]) => 
      normalizeDocumentType(type) === DOCUMENT_TYPES.SYLLABUS
    );
    
    // Get the syllabus document if available
    const syllabusDoc = hasSyllabus ? Object.entries(documentsByType).find(([type]) => 
      normalizeDocumentType(type) === DOCUMENT_TYPES.SYLLABUS
    )?.[1] : null;

    // Log available document types
    console.log('Available document types:', Object.keys(documentsByType));
    if (!hasSyllabus) {
      console.log('No syllabus document found - proceeding with limited formatting');
    }
    
    // Get OpenAI API key
    const apiKey = getOpenAIApiKey();
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Create a unified prompt with all document texts
    const prompt = createFormattingPrompt(documentsByType);
    
    // Call OpenAI API
    console.log("===== OPENAI PROMPT =====");
    console.log(prompt);
    console.log('Calling OpenAI for unified data formatting');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    
    // Extract and parse the JSON response
    const responseContent = response.choices[0].message.content;
    console.log("===== OPENAI RESPONSE =====");
    console.log(responseContent);
    
    // Store debug data
    await storeDebugData(userId, prompt, responseContent);
    
    const formattedData = JSON.parse(responseContent);
    console.log("===== PARSED FORMATTED DATA =====");
    console.log(JSON.stringify(formattedData, null, 2));
    
    // Store the formatted data in the user's data document
    await storeFormattedData(userId, formattedData);
    
    // Update the status of all processed documents
    const updateResult = await updateDocumentStatus(userId, snapshot.docs);
    console.log(`Document status update result: ${updateResult}`);
    
    return formattedData;
  } catch (error) {
    console.error('Error formatting data with OpenAI:', error);
    
    // Return a fallback format in case of error
    return createFallbackFormattedData(documentsByType);
  }
};

/**
 * Creates the prompt for OpenAI formatting
 * @param {Object} documentsByType - Documents organized by type
 * @returns {string} Formatted prompt
 */
function createFormattingPrompt(documentsByType) {
  // Extract the document texts
  const syllabusText = documentsByType[DOCUMENT_TYPES.SYLLABUS]?.text || '';
  const gradesText = documentsByType[DOCUMENT_TYPES.GRADES]?.text || '';
  const transcriptText = documentsByType[DOCUMENT_TYPES.TRANSCRIPT]?.text || '';
  
  return `
I need you to format educational document data into a consistent structure for grade calculations and predictions.
Here is the raw text from different document types:

${syllabusText ? `SYLLABUS DATA:
${syllabusText}` : 'SYLLABUS DATA: Not available'}

${gradesText ? `GRADES DATA:
${gradesText}` : 'GRADES DATA: Not available'}

${transcriptText ? `TRANSCRIPT DATA:
${transcriptText}` : 'TRANSCRIPT DATA: Not available'}

Please format this data into the following exact JSON structure. If a syllabus is not available, provide best-effort values based on available data:
{
  "course": {
    "name": "Course name (from syllabus if available, otherwise derive from grades/transcript)",
    "instructor": "Instructor name if available, otherwise 'Unknown'",
    "creditHours": "Credit hours if available, otherwise '3'"
  },
  "gradeWeights": [
    {
      "name": "Category name (from syllabus or inferred from grades)",
      "weight": 0.3 // Decimal weight, ensure all weights sum to 1.0
    }
  ],
  "completedAssignments": [
    {
      "name": "Assignment name from grades",
      "grade": 95, // Numeric grade
      "maxPoints": 100, // Maximum possible points
      "category": "Best matching category based on name"
    }
  ],
  "remainingAssignments": [
    {
      "name": "Assignment name from syllabus if available",
      "category": "Best matching category"
    }
  ],
  "dueDates": [
    {
      "assignment": "Assignment name",
      "due_date": "Due date if available"
    }
  ],
  "gpa": "Overall GPA from transcript, or 'N/A' if not available",
  "academicHistory": {
    "relevantCourses": [
      {
        "course_code": "Course code if available",
        "course_name": "Course name",
        "grade": "Letter grade if available",
        "numerical_grade": "Numerical equivalent if available",
        "relevance": "High/Medium/Low based on available context"
      }
    ]
  }
}

Processing Instructions:
1. If syllabus is available:
   - Use exact grade weights and assignments
   - Match completed assignments to syllabus categories
   - List remaining assignments from syllabus

2. If only grades are available:
   - Infer categories from assignment names
   - Create approximate grade weights based on assignment counts
   - Leave remainingAssignments empty

3. If transcript is available:
   - Include GPA and relevant course history
   - Use course names to determine relevance

For the academicHistory.relevantCourses, analyze the transcript to find courses that are relevant to the current course:
- High relevance: Same department (e.g., PHY for Physics courses), prerequisites, or similar keywords
- Medium relevance: Related departments (e.g., MATH for Physics courses), general science courses
- Low relevance: Other STEM courses or courses that might indirectly impact performance
`;
}

/**
 * Stores the formatted data in Firestore
 * @param {string} userId - The user ID
 * @param {Object} formattedData - The formatted data
 * @returns {Promise<void>}
 */
async function storeFormattedData(userId, formattedData) {
  console.log(`Storing formatted data for user ${userId}`);
  const db = admin.firestore();
  
  try {
    await db.collection('users').doc(userId).collection('data').doc('formatted_data').set({
      formatted_data: formattedData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Successfully stored formatted data');
  } catch (error) {
    console.error('Error storing formatted data:', error);
    throw error;
  }
}

/**
 * Updates the status of processed documents
 * @param {string} userId - The user ID
 * @param {Array} documents - The document snapshots
 * @returns {Promise<boolean>} True if any documents were updated
 */
async function updateDocumentStatus(userId, documents) {
  console.log(`===== UPDATE DOCUMENT STATUS - USER ${userId} =====`);
  console.log(`Documents to process: ${documents.length}`);
  
  const db = admin.firestore();
  const batch = db.batch();
  
  let updateCount = 0;
  
  documents.forEach(doc => {
    const docData = doc.data ? doc.data() : doc;
    console.log(`Processing doc ${doc.id}: Type: ${docData.documentType}, Status: ${docData.status}`);
    
    const docRef = db.collection('users').doc(userId).collection('documents').doc(doc.id);
    
    // Process documents with 'extracted' or 'uploaded' status
    if (docData.status?.toLowerCase() === 'extracted' || docData.status?.toLowerCase() === 'uploaded') {
      batch.update(docRef, { 
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updateCount++;
      console.log(`✓ Marking document ${doc.id} as processed`);
    } else {
      console.log(`✗ Skipping document ${doc.id} with status ${docData.status}`);
    }
  });
  
  if (updateCount > 0) {
    try {
      await batch.commit();
      console.log(`✓ Successfully committed batch update for ${updateCount} documents`);
      return true;
    } catch (error) {
      console.error(`✗ Error committing batch update: ${error}`);
      console.error(error.stack);
      throw error;
    }
  } else {
    console.log('No documents to update');
    return false;
  }
}

/**
 * Creates a fallback formatted data structure if OpenAI fails
 * @param {Object} documentsByType - Documents organized by type
 * @returns {Object} Fallback formatted data
 */
function createFallbackFormattedData(documentsByType) {
  console.log('Creating fallback formatted data');
  
  // Extract basic information using regex patterns
  const syllabusText = documentsByType[DOCUMENT_TYPES.SYLLABUS]?.text || '';
  
  // Extract course name
  const courseNameMatch = syllabusText.match(/course(?:\s+title)?:?\s*([^\n]+)/i);
  const courseName = courseNameMatch ? courseNameMatch[1].trim() : "Unknown Course";
  
  // Extract instructor
  const instructorMatch = syllabusText.match(/instructor:?\s*([^\n]+)/i);
  const instructor = instructorMatch ? instructorMatch[1].trim() : "Unknown Instructor";
  
  // Extract credit hours
  const creditHoursMatch = syllabusText.match(/credit\s+hours:?\s*(\d+)/i);
  const creditHours = creditHoursMatch ? creditHoursMatch[1].trim() : "3";
  
  // Extract grade weights using regex
  const gradeWeights = extractGradeWeights(syllabusText);
  
  // Extract GPA from transcript
  const transcriptText = documentsByType[DOCUMENT_TYPES.TRANSCRIPT]?.text || '';
  const gpaMatch = transcriptText.match(/gpa:?\s*([\d\.]+)/i);
  const gpa = gpaMatch ? gpaMatch[1].trim() : "3.0";
  
  return {
    course: { 
      name: courseName, 
      instructor: instructor, 
      creditHours: creditHours 
    },
    gradeWeights: gradeWeights.length > 0 ? gradeWeights : [
      { name: "Assignments", weight: 0.4 },
      { name: "Exams", weight: 0.6 }
    ],
    completedAssignments: [],
    remainingAssignments: [],
    dueDates: [],
    gpa: gpa,
    academicHistory: {
      relevantCourses: []
    }
  };
}

/**
 * Extract grade weights using regex patterns
 * @param {string} text - Text to extract grade weights from
 * @returns {Array} Array of {name, weight} objects
 */
function extractGradeWeights(text) {
  try {
    // Try different patterns to catch various formatting styles
    const patterns = [
      /([A-Za-z\s&-]+):\s*(\d+(?:\.\d+)?)%/g,
      /([A-Za-z\s&-]+)\s*=\s*(\d+(?:\.\d+)?)%/g,
      /([A-Za-z\s&-]+)\s*\((\d+(?:\.\d+)?)%\)/g
    ];
    
    const results = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const weight = parseFloat(match[2]) / 100;
        
        // Check for duplicates
        if (!results.some(r => r.name === name)) {
          results.push({ name, weight });
        }
      }
    }
    
    // Normalize weights to sum to 1.0
    if (results.length > 0) {
      const totalWeight = results.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight > 0 && totalWeight !== 1.0) {
        results.forEach(item => {
          item.weight = item.weight / totalWeight;
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error extracting grade weights:", error);
    return [];
  }
}
