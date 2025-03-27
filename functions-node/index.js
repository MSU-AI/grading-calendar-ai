const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');
const OpenAI = require('openai');
const { calculateCurrentGrade } = require('./calculateGrade');
const { predictFinalGrade } = require('./predictGrade');
const { formatDocumentsData } = require('./formatDocumentsData');

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
exports.calculateCurrentGrade = calculateCurrentGrade;
exports.predictFinalGrade = predictFinalGrade;
exports.formatDocumentsData = functions.https.onCall(async (data, context) => {
  try {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    console.log(`Manual formatting requested for user ${userId}`);
    
    // Call the formatDocumentsData function
    const formattedData = await formatDocumentsData(userId);
    
    if (!formattedData) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No documents available for formatting or formatting failed'
      );
    }
    
    return {
      success: true,
      message: 'Documents formatted successfully'
    };
  } catch (error) {
    console.error('Error in formatDocumentsData:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Handles the upload of PDF documents to Firebase Storage and creates corresponding Firestore records.
 * This function processes the uploaded document, stores it in the appropriate location based on document type,
 * and initiates automatic text extraction.
 *
 * @param {Object} data - The upload request data
 * @param {string} data.documentBase64 - Base64 encoded PDF document
 * @param {string} data.documentType - Type of document ('syllabus', 'transcript', 'grades', etc.)
 * @param {string} [data.documentName] - Optional custom name for the document
 * @param {Object} context - The Firebase function context
 * @param {Object} context.auth - Authentication details of the requesting user
 * @returns {Promise<Object>} Object containing upload status and file path
 * @throws {functions.https.HttpsError} If authentication or upload fails
 */
exports.uploadDocument = functions.https.onCall(async (data, context) => {
  try {
    console.log('uploadDocument called with document type:', data.documentType);
    
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    
    if (!data.documentBase64 || !data.documentType) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing document data or type');
    }

    const documentName = data.documentName || `${data.documentType}_${Date.now()}.pdf`;
    
    let base64Data = data.documentBase64;
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Created buffer with ${buffer.length} bytes`);
    
    const tempFile = tmp.fileSync({ postfix: '.pdf' });
    fs.writeFileSync(tempFile.name, buffer);
    console.log(`Wrote buffer to temp file: ${tempFile.name}`);
    
    try {
      // Get default bucket
      const bucket = admin.storage().bucket();
      // Use consistent path format for the trigger to work properly
      const filePath = `users/${userId}/${data.documentType}/${documentName}`;
      
      console.log(`Uploading to Firebase Storage: ${filePath}`);
      await bucket.upload(tempFile.name, {
        destination: filePath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            originalName: documentName
          }
        }
      });
      
      console.log(`Successfully uploaded to ${filePath}`);
      
      // Create document record in consistent format
      const db = admin.firestore();
      const docRef = db.collection('users').doc(userId).collection('documents').doc();
      const documentId = docRef.id;
      
      await docRef.set({
        filePath: filePath,
        documentType: data.documentType,
        name: documentName,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'uploaded'
      });
      
      console.log(`Created document record with ID: ${documentId}`);
      
      // IMPORTANT: Directly process the file instead of waiting for trigger
      // This is a reliable fallback in case the Storage trigger doesn't fire
      try {
        console.log('Processing document immediately after upload');
        // Extract text from the PDF
        const extractedText = await extractTextFromPdf(userId, documentId, filePath);
        console.log(`Successfully extracted ${extractedText.length} characters of text`);
      } catch (processError) {
        console.error('Error processing document after upload:', processError);
        // Update the document status to error
        await docRef.update({
          status: 'error',
          error: processError.message
        });
      }
      
      return {
        success: true,
        message: 'Document uploaded and processing started',
        documentId: documentId,
        filePath: filePath
      };
    } catch (uploadError) {
      console.error('Error during upload:', uploadError);
      throw new functions.https.HttpsError('internal', `Storage upload failed: ${uploadError.message}`);
    } finally {
      // Clean up temp file
      tempFile.removeCallback();
    }
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    throw new functions.https.HttpsError('internal', `Upload failed: ${error.message}`);
  }
});

/**
 * Retrieves all documents associated with the authenticated user from Firestore.
 * Returns a list of documents with their metadata including upload status and processing state.
 *
 * @param {Object} data - Empty object (no parameters required)
 * @param {Object} context - The Firebase function context
 * @param {Object} context.auth - Authentication details of the requesting user
 * @returns {Promise<Object>} Object containing array of user documents
 * @throws {functions.https.HttpsError} If authentication fails or documents cannot be retrieved
 */
exports.getUserDocuments = functions.https.onCall(async (data, context) => {
  try {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    
    // Get documents from Firestore
    const db = admin.firestore();
    const documentsRef = db.collection('users').doc(userId).collection('documents');
    const snapshot = await documentsRef.get();
    
    const documents = [];
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      success: true,
      documents: documents
    };
  } catch (error) {
    console.error('Error getting user documents:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Deletes a specific document from both Firebase Storage and Firestore.
 * Removes both the physical file and its metadata record.
 *
 * @param {Object} data - The deletion request data
 * @param {string} data.documentId - ID of the document to delete
 * @param {Object} context - The Firebase function context
 * @param {Object} context.auth - Authentication details of the requesting user
 * @returns {Promise<Object>} Object indicating deletion success
 * @throws {functions.https.HttpsError} If authentication fails or document cannot be deleted
 */
exports.deleteDocument = functions.https.onCall(async (data, context) => {
  try {
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    const { documentId } = data;
    
    if (!documentId) {
      throw new functions.https.HttpsError('invalid-argument', 'Document ID is required');
    }
    
    // Get document info
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Document not found');
    }
    
    const docData = doc.data();
    
    // Delete from Firestore
    await docRef.delete();
    
    // Delete from Storage if filePath exists
    if (docData.filePath) {
      const bucket = admin.storage().bucket();
      await bucket.file(docData.filePath).delete();
    }
    
    return {
      success: true,
      message: 'Document deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Get OpenAI API key from Firebase configuration or environment variable
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
 * Background function triggered when a PDF is uploaded to Firebase Storage.
 * Automatically processes newly uploaded PDFs by extracting text and updating document status.
 * Path format: users/{userId}/{documentType}/{filename}.pdf
 *
 * @param {Object} object - The Storage object metadata
 * @param {string} object.name - Full path of the uploaded file
 * @param {string} object.contentType - MIME type of the uploaded file
 * @returns {Promise<null>} Returns null on completion
 */
exports.processPdfUpload = functions.storage.object().onFinalize(async (object) => {
  try {
    console.log('processPdfUpload triggered with object:', JSON.stringify(object));
    
    const filePath = object.name;
    
    // Only process PDFs in the user's directory
    if (!filePath || !filePath.startsWith('users/') || !filePath.endsWith('.pdf')) {
      console.log(`Skipping non-PDF file or invalid path: ${filePath}`);
      return null;
    }
    
    // Extract user ID and document type from path
    // Expected format: users/{userId}/{documentType}/{filename}.pdf
    const pathParts = filePath.split('/');
    if (pathParts.length < 4) {
      console.log(`Invalid path format: ${filePath}`);
      return null;
    }
    
    const userId = pathParts[1];
    const documentType = pathParts[2];
    
    console.log(`Processing uploaded PDF: ${filePath} for user: ${userId}, type: ${documentType}`);
    
    // Find the document in Firestore with matching filePath
    const db = admin.firestore();
    const documentsRef = db.collection('users').doc(userId).collection('documents');
    const snapshot = await documentsRef.where('filePath', '==', filePath).limit(1).get();
    
    if (snapshot.empty) {
      console.log(`No document found with filePath: ${filePath}, creating one`);
      // Create a document if one doesn't exist
      const docRef = documentsRef.doc();
      await docRef.set({
        filePath: filePath,
        documentType: documentType,
        name: pathParts[3],
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'uploaded'
      });
      
      // Extract text and update the document
      try {
        await extractTextFromPdf(userId, docRef.id, filePath);
      } catch (err) {
        console.error(`Error extracting text: ${err}`);
        await docRef.update({
          status: 'error',
          error: err.message
        });
      }
    } else {
      // Document exists, extract text and update it
      const docId = snapshot.docs[0].id;
      try {
        await extractTextFromPdf(userId, docId, filePath);
      } catch (err) {
        console.error(`Error extracting text: ${err}`);
        await db.collection('users').doc(userId).collection('documents').doc(docId).update({
          status: 'error',
          error: err.message
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error in processPdfUpload: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    return null; // Storage triggers must return null on error
  }
});


/**
 * Internal helper function to extract text content from a PDF file.
 * Downloads the file from Storage, processes it, and updates Firestore with results.
 *
 * @param {string} userId - ID of the user who owns the document
 * @param {string} documentId - ID of the document in Firestore
 * @param {string} filePath - Storage path to the PDF file
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If text extraction fails
 */
async function extractTextFromPdf(userId, documentId, filePath) {
  console.log(`Extracting text from PDF: ${filePath} for user ${userId}, document ${documentId}`);
  
  const bucket = admin.storage().bucket();
  let tempFile = null;
  
  try {
    // Create a temporary file
    tempFile = tmp.fileSync({ postfix: '.pdf' });
    console.log(`Created temporary file: ${tempFile.name}`);
    
    // Download file from Firebase Storage
    console.log(`Downloading file from path: ${filePath}`);
    await bucket.file(filePath).download({
      destination: tempFile.name
    });
    
    console.log(`PDF downloaded to temporary file: ${tempFile.name}`);
    
    // Extract text using pdf-parse
    const dataBuffer = fs.readFileSync(tempFile.name);
    console.log(`Read ${dataBuffer.length} bytes from temporary file`);
    
    console.log('Starting PDF parsing');
    const pdfData = await pdfParse(dataBuffer);
    
    const extractedText = pdfData.text;
    console.log(`Successfully extracted ${extractedText.length} characters of text from ${pdfData.numpages} pages`);
    
    // Update document in Firestore with extracted text
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
    
    // Use set with merge to ensure we don't overwrite existing data
    console.log(`Updating Firestore document with extracted text`);
    await docRef.set({
      text: extractedText,
      lastExtracted: admin.firestore.FieldValue.serverTimestamp(),
      status: 'extracted',
      pageCount: pdfData.numpages
    }, { merge: true });
    
    console.log(`Firestore document updated successfully`);
    
    // Try to trigger document formatting if multiple documents are extracted
    try {
      const documentsRef = db.collection('users').doc(userId).collection('documents');
      const extractedDocs = await documentsRef.where('status', '==', 'extracted').get();
      
      if (!extractedDocs.empty && extractedDocs.size >= 1) {
        console.log('Multiple extracted documents found, attempting to format');
        const formatDocumentsData = require('./formatDocumentsData').formatDocumentsData;
        await formatDocumentsData(userId);
      }
    } catch (formatError) {
      console.warn('Non-fatal error during document formatting:', formatError);
      // This is non-fatal, continue without failing
    }
    
    return extractedText;
  } catch (error) {
    console.error(`Error extracting text from PDF: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Update document to indicate error
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
    await docRef.set({
      status: 'error',
      error: error.message
    }, { merge: true });
    
    throw error; // Re-throw to be handled by the calling function
  } finally {
    // Clean up the temp file
    if (tempFile) {
      console.log(`Cleaning up temporary file: ${tempFile.name}`);
      tempFile.removeCallback();
    }
  }
}

/**
 * Internal helper function to process extracted text into structured data.
 * Uses OpenAI to analyze and structure the raw text from different document types.
 *
 * @param {Object} docs - Object containing extracted text from different documents
 * @param {string} [docs.syllabus] - Extracted text from syllabus
 * @param {string} [docs.transcript] - Extracted text from transcript
 * @param {string} [docs.grades] - Extracted text from grade documents
 * @returns {Promise<Object>} Structured data extracted from documents
 * @throws {Error} If processing fails
 */
async function processExtractedText(docs) {
  console.log('Processing extracted text into structured data');
  const structuredData = {};
  
  // Get API key
  let apiKey;
  try {
    apiKey = getOpenAIApiKey();
  } catch (error) {
    console.error(`Error getting OpenAI API key: ${error}`);
    throw error;
  }
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
  // Process syllabus
  if (docs.syllabus) {
    structuredData.syllabus = await processSyllabusText(docs.syllabus, openai);
  }
  
  // Process transcript
  if (docs.transcript) {
    structuredData.transcript = await processTranscriptText(
      docs.transcript, 
      openai, 
      structuredData.syllabus
    );
  }
  
  // Process grades
  if (docs.grades) {
    structuredData.grades = await processGradesText(
      docs.grades, 
      openai, 
      structuredData.syllabus
    );
  }
  
  console.log('Finished processing extracted text');
  return structuredData;
}

/**
 * Process syllabus text into structured data with improved prompts and fallbacks.
 * 
 * @param {string} syllabusText - Raw text extracted from syllabus PDF
 * @param {OpenAI} openai - Initialized OpenAI client
 * @returns {Promise<Object>} Structured syllabus data
 */
async function processSyllabusText(syllabusText, openai) {
  console.log('Processing syllabus text');
  try {
    // Find and prioritize the grading section
    const gradingSection = findGradingSection(syllabusText);
    let processText = syllabusText;
    
    if (gradingSection) {
      console.log('Found grading section, prioritizing it in the prompt');
      // Put the grading section at the beginning of the text
      processText = gradingSection + "\n\n" + 
                  syllabusText.replace(gradingSection, "");
    }
    
    // Improved prompt for syllabus
    const syllabusPrompt = `Carefully analyze this syllabus document and extract ONLY the following information in valid JSON format:
{
  "course_name": "The full course name and number, e.g. PHY 184 - Electricity and Magnetism",
  "instructor": "The primary instructor's name",
  "grade_weights": [
    {"name": "The exact category name, e.g. 'Weekly Homework'", "weight": 0.28},
    {"name": "Another category, e.g. 'Exams'", "weight": 0.30}
  ],
  "assignments": ["List of all assignments mentioned"],
  "due_dates": [
    {"assignment": "Assignment name", "due_date": "Date mentioned"}
  ],
  "credit_hours": "The number of credit hours as a string"
}

First search for sections labeled "Grading", "Grade Breakdown", "Assessment", "Evaluation", or similar. Look for percentages next to categories. Convert all percentages to decimal values (e.g., 30% becomes 0.30). Ensure all weights add up to exactly 1.0.`;
    
    // Call OpenAI with improved prompt and larger token limit
    console.log('Calling OpenAI API for syllabus processing');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Keep the same model as before
      messages: [
        { role: "system", content: syllabusPrompt },
        { role: "user", content: processText.substring(0, 16000) } // Increased token limit
      ],
      temperature: 0.3 // Lower temperature for more deterministic results
    });
    
    const content = response.choices[0].message.content;
    console.log(`OpenAI response for syllabus: ${content.substring(0, 200)}...`);
    
    // Parse JSON response
    let syllabusData;
    try {
      syllabusData = JSON.parse(content);
    } catch (jsonError) {
      // Try to extract JSON from possible text response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          syllabusData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          throw nestedError;
        }
      } else {
        throw jsonError;
      }
    }
    
    // Convert any percentage weights to decimals
    if (syllabusData.grade_weights) {
      syllabusData.grade_weights = syllabusData.grade_weights.map(item => {
        if (typeof item.weight === 'string' && item.weight.includes('%')) {
          const numericWeight = parseFloat(item.weight.replace('%', '')) / 100;
          return { ...item, weight: numericWeight };
        }
        return item;
      });
    }
    
    console.log('Successfully parsed syllabus data');
    return syllabusData;
  } catch (error) {
    console.error(`Error processing syllabus with OpenAI: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Try regex-based extraction for fallback
    const extractedWeights = extractGradeWeights(syllabusText);
    
    // Provide fallback structured data with any successfully extracted weights
    console.log('Using fallback syllabus data');
    return {
      course_name: extractCourseNameFromText(syllabusText) || "Unknown Course",
      instructor: extractInstructorFromText(syllabusText) || "Unknown Instructor",
      grade_weights: extractedWeights || [
        { name: "Assignments", weight: 0.5 },
        { name: "Exams", weight: 0.5 }
      ],
      assignments: [],
      due_dates: [],
      credit_hours: extractCreditHoursFromText(syllabusText) || "3"
    };
  }
}

/**
 * Process transcript text into structured data with improved prompts and fallbacks.
 * 
 * @param {string} transcriptText - Raw text extracted from transcript PDF
 * @param {OpenAI} openai - Initialized OpenAI client
 * @param {Object} syllabusData - Optional structured syllabus data for context
 * @returns {Promise<Object>} Structured transcript data
 */
async function processTranscriptText(transcriptText, openai, syllabusData) {
  console.log('Processing transcript text');
  try {
    // Include syllabus course info in prompt if available
    const courseContext = syllabusData ? 
      `The current course is ${syllabusData.course_name}. Look for similar courses (same subject) in the transcript.` : 
      '';
    
    // Improved prompt for transcript
    const transcriptPrompt = `Carefully analyze this academic transcript and extract ONLY the following information in valid JSON format:
{
  "overall_gpa": "The overall GPA as listed, e.g. '3.75'",
  "term_gpa": "The most recent term GPA if available",
  "courses": [
    {
      "course_code": "Complete course code, e.g. 'PHY 184'",
      "course_name": "Full course name, e.g. 'Electricity and Magnetism'",
      "semester": "Term/semester taken",
      "credits": "Number of credits",
      "grade": "Letter grade received, e.g. 'A'",
      "numerical_grade": "Numerical grade if available"
    }
  ]
}

${courseContext}

Focus especially on science, math, and physics courses as these are most relevant for prediction. If the transcript has multiple semesters, prioritize the most recent ones first.`;
    
    // Call OpenAI with improved prompt and larger token limit
    console.log('Calling OpenAI API for transcript processing');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Keep the same model as before
      messages: [
        { role: "system", content: transcriptPrompt },
        { role: "user", content: transcriptText.substring(0, 16000) } // Increased token limit
      ],
      temperature: 0.3 // Lower temperature for more deterministic results
    });
    
    const content = response.choices[0].message.content;
    console.log(`OpenAI response for transcript: ${content.substring(0, 200)}...`);
    
    // Parse JSON response
    let transcriptData;
    try {
      transcriptData = JSON.parse(content);
    } catch (jsonError) {
      // Try to extract JSON from possible text response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          transcriptData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          throw nestedError;
        }
      } else {
        throw jsonError;
      }
    }
    
    console.log('Successfully parsed transcript data');
    return transcriptData;
  } catch (error) {
    console.error(`Error processing transcript with OpenAI: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Provide fallback structured data
    console.log('Using fallback transcript data');
    return {
      overall_gpa: extractGpaFromText(transcriptText) || "3.0",
      term_gpa: null,
      courses: []
    };
  }
}

/**
 * Process grades text into structured data with improved prompts and fallbacks.
 * 
 * @param {string} gradesText - Raw text extracted from grades PDF
 * @param {OpenAI} openai - Initialized OpenAI client
 * @param {Object} syllabusData - Optional structured syllabus data for context
 * @returns {Promise<Array>} Array of grade objects
 */
async function processGradesText(gradesText, openai, syllabusData) {
  console.log('Processing grades text');
  try {
    // Include grade categories from syllabus in prompt if available
    const categoriesContext = syllabusData && syllabusData.grade_weights ? 
      `The grade categories for this course are: ${syllabusData.grade_weights.map(w => w.name).join(', ')}.` : 
      '';
    
    // Improved prompt for grades
    const gradesPrompt = `Carefully analyze this grade report and extract ONLY the following information as a valid JSON array:
[
  {"name": "Assignment name, e.g. Week 1 HW", "grade": 95.5, "category": "Assignment category if known"},
  {"name": "Another assignment", "grade": 87, "category": "Assignment category if known"},
  {"name": "Special case assignment", "grade": "Dropped", "category": "Assignment category if known"}
]

${categoriesContext}

For each assignment, include the exact name and numerical grade. If a grade is marked as dropped, exempted, or excused, use the string "Dropped" instead of a number. Parse ALL grades mentioned in the document, including quizzes, exams, homework, labs, and projects.`;
    
    // Call OpenAI with improved prompt and larger token limit
    console.log('Calling OpenAI API for grades processing');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Keep the same model as before
      messages: [
        { role: "system", content: gradesPrompt },
        { role: "user", content: gradesText.substring(0, 16000) } // Increased token limit
      ],
      temperature: 0.3 // Lower temperature for more deterministic results
    });
    
    const content = response.choices[0].message.content;
    console.log(`OpenAI response for grades: ${content.substring(0, 200)}...`);
    
    // Parse JSON response
    let gradesData;
    try {
      gradesData = JSON.parse(content);
    } catch (jsonError) {
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          gradesData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          throw nestedError;
        }
      } else {
        throw jsonError;
      }
    }
    
    console.log('Successfully parsed grades data');
    return gradesData;
  } catch (error) {
    console.error(`Error processing grades with OpenAI: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Provide fallback empty array
    console.log('Using fallback grades data (empty array)');
    return [];
  }
}

/**
 * Find grading section in syllabus text.
 * 
 * @param {string} text - Syllabus text to search
 * @returns {string|null} Extracted grading section or null if not found
 */
function findGradingSection(text) {
  const gradingPatterns = [
    /grad(e|ing)[^]*?total[^]*?100\s*%/i,
    /assessment[^]*?total[^]*?100\s*%/i,
    /evaluation[^]*?total[^]*?100\s*%/i,
    /course grade[^]*?contribut[^]*?percentage/i
  ];
  
  for (const pattern of gradingPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  
  return null;
}

/**
 * Extract grade weights using regex patterns.
 * 
 * @param {string} text - Text to extract grade weights from
 * @returns {Array|null} Array of {name, weight} objects or null if none found
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
    
    return results.length > 0 ? results : null;
  } catch (error) {
    console.error("Error extracting grade weights:", error);
    return null;
  }
}

/**
 * Extract course name using regex patterns.
 * 
 * @param {string} text - Text to extract course name from
 * @returns {string|null} Course name or null if not found
 */
function extractCourseNameFromText(text) {
  // Try common patterns for course names
  const coursePatterns = [
    /Syllabus:?\s+([A-Z]{2,4}\s+\d{3}[A-Z]?)\s+–\s+(.+?)(?=\s+Class Meetings|\n)/i,
    /Course:?\s+([A-Z]{2,4}\s+\d{3}[A-Z]?)\s*(?:–|:)\s*(.+?)(?=\n)/i,
    /([A-Z]{2,4}\s+\d{3}[A-Z]?)\s*(?:–|:)\s*(.+?)(?=\n)/i
  ];
  
  for (const pattern of coursePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] + " - " + match[2].trim();
    }
  }
  
  return null;
}

/**
 * Extract instructor name using regex patterns.
 * 
 * @param {string} text - Text to extract instructor name from
 * @returns {string|null} Instructor name or null if not found
 */
function extractInstructorFromText(text) {
  // Try common patterns for instructor information
  const instructorPatterns = [
    /[Ii]nstructor:?\s+(?:Dr\.|Prof\.|Professor)?\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /[Pp]rof(?:\.|\s|essor)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/
  ];
  
  for (const pattern of instructorPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract credit hours using regex patterns.
 * 
 * @param {string} text - Text to extract credit hours from
 * @returns {string|null} Credit hours or null if not found
 */
function extractCreditHoursFromText(text) {
  // Try common patterns for credit hours
  const creditPatterns = [
    /[Cc]redit\s+[Hh]ours:?\s+(\d+\.?\d*)/,
    /(\d+\.?\d*)\s+[Cc]redit\s+[Hh]ours/
  ];
  
  for (const pattern of creditPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract GPA using regex patterns.
 * 
 * @param {string} text - Text to extract GPA from
 * @returns {string|null} GPA or null if not found
 */
function extractGpaFromText(text) {
  // Try common patterns for GPA
  const gpaPatterns = [
    /[Oo]verall\s+GPA:?\s+(\d+\.\d+)/,
    /GPA:?\s+(\d+\.\d+)/,
    /Grade Point Average:?\s+(\d+\.\d+)/
  ];
  
  for (const pattern of gpaPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Internal helper function to generate grade predictions using OpenAI API.
 * Constructs prompts and processes API responses to generate final predictions.
 *
 * @param {Object} structuredData - Processed data from documents
 * @param {Object} structuredData.syllabus - Structured syllabus data
 * @param {Object} structuredData.transcript - Structured transcript data
 * @param {Object} [structuredData.grades] - Optional structured grades data
 * @returns {Promise<Object>} Prediction results with grade and reasoning
 * @throws {Error} If prediction generation fails
 */
async function generatePrediction(structuredData) {
  console.log('Generating prediction using OpenAI API');
  
  // Get API key
  let apiKey;
  try {
    apiKey = getOpenAIApiKey();
  } catch (error) {
    console.error(`Error getting OpenAI API key: ${error}`);
    throw error;
  }
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
  // Construct the prompt using the same structure as the Python code
  const prompt = constructPrompt(structuredData);
  console.log(`Constructed prompt: ${prompt.substring(0, 200)}...`);
  
  try {
    // Call the OpenAI API
    console.log('Calling OpenAI API for prediction');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a concise academic advisor." },
        { role: "user", content: prompt }
      ]
    });
    
    // Extract and parse the prediction
    const predictionText = response.choices[0].message.content;
    console.log(`OpenAI prediction response: ${predictionText}`);
    
    try {
      // Parse the JSON response
      const prediction = JSON.parse(predictionText);
      console.log('Successfully parsed prediction JSON');
      return prediction;
    } catch (parseError) {
      console.error(`Failed to parse OpenAI response as JSON: ${parseError}`);
      console.error(`Raw response was: ${predictionText}`);
      
      // Return a fallback prediction if parsing fails
      return {
        grade: "B",
        reasoning: "Prediction based on limited data. OpenAI response could not be parsed as JSON."
      };
    }
  } catch (error) {
    console.error(`Error calling OpenAI API: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    
    // Return a fallback prediction if the API call fails
    return {
      grade: "C+",
      reasoning: "Fallback prediction due to error in API call. Please try again later."
    };
  }
}

/**
 * Internal helper function to calculate grade statistics based on structured data.
 * Calculates current grade, maximum possible grade, minimum possible grade, and other statistics.
 *
 * @param {Object} data - The structured data to analyze
 * @param {Object} data.syllabus - Syllabus information with grade weights and assignments
 * @param {Object} data.grades - Current grades information
 * @returns {Object} Calculated grade statistics
 */
function calculateGradeStatistics(data) {
  console.log('Calculating grade statistics');
  
  try {
    const gradeWeights = data.syllabus.grade_weights || [];
    const assignments = data.syllabus.assignments || [];
    const currentGrades = data.grades || [];
    
    // Initialize category totals
    const categoryTotals = {};
    const categoryMaxPoints = {};
    const categoryCompletedAssignments = {};
    const categoryRemainingAssignments = {};
    
    // Initialize each category from grade weights
    gradeWeights.forEach(({ name, weight }) => {
      categoryTotals[name] = 0;
      categoryMaxPoints[name] = 0;
      categoryCompletedAssignments[name] = [];
      categoryRemainingAssignments[name] = [];
    });
    
    // Process current grades
    currentGrades.forEach(grade => {
      const category = gradeWeights.find(w => 
        grade.name.toLowerCase().includes(w.name.toLowerCase())
      )?.name || 'Other';
      
      if (categoryTotals[category] !== undefined) {
        categoryTotals[category] += parseFloat(grade.grade) || 0;
        categoryMaxPoints[category] += 100; // Assuming grades are out of 100
        categoryCompletedAssignments[category].push(grade);
      }
    });
    
    // Identify remaining assignments
    assignments.forEach(assignment => {
      const category = gradeWeights.find(w => 
        assignment.toLowerCase().includes(w.name.toLowerCase())
      )?.name || 'Other';
      
      if (categoryTotals[category] !== undefined && 
          !categoryCompletedAssignments[category].some(g => 
            g.name.toLowerCase() === assignment.toLowerCase()
          )) {
        categoryRemainingAssignments[category].push(assignment);
      }
    });
    
    // Calculate current grade
    let currentGradeTotal = 0;
    let weightTotal = 0;
    
    gradeWeights.forEach(({ name, weight }) => {
      if (categoryMaxPoints[name] > 0) {
        const categoryPercentage = categoryTotals[name] / categoryMaxPoints[name];
        currentGradeTotal += categoryPercentage * weight;
        weightTotal += weight;
      }
    });
    
    const currentGrade = weightTotal > 0 ? (currentGradeTotal / weightTotal) * 100 : 0;
    
    // Calculate maximum possible grade
    let maxGradeTotal = currentGradeTotal;
    gradeWeights.forEach(({ name, weight }) => {
      const remainingPoints = categoryRemainingAssignments[name].length * 100;
      if (remainingPoints > 0) {
        maxGradeTotal += (weight * remainingPoints) / 100;
      }
    });
    
    const maxPossibleGrade = weightTotal > 0 ? (maxGradeTotal / weightTotal) * 100 : 100;
    
    // Calculate minimum possible grade
    const minPossibleGrade = weightTotal > 0 ? (currentGradeTotal / weightTotal) * 100 : 0;
    
    // Generate letter grade
    const letterGrade = getLetterGrade(currentGrade);
    
    // Create categorized grades breakdown
    const categorizedGrades = {};
    gradeWeights.forEach(({ name }) => {
      categorizedGrades[name] = {
        completed: categoryCompletedAssignments[name],
        remaining: categoryRemainingAssignments[name],
        average: categoryMaxPoints[name] > 0 
          ? (categoryTotals[name] / categoryMaxPoints[name]) * 100 
          : null
      };
    });
    
    // Generate analysis text
    const analysis = generateGradeAnalysis({
      currentGrade,
      maxPossibleGrade,
      minPossibleGrade,
      letterGrade,
      categorizedGrades
    });
    
    return {
      current_grade: currentGrade,
      current_percentage: currentGrade,
      letter_grade: letterGrade,
      max_possible_grade: maxPossibleGrade,
      min_possible_grade: minPossibleGrade,
      categorized_grades: categorizedGrades,
      analysis
    };
  } catch (error) {
    console.error('Error calculating grade statistics:', error);
    return {
      current_grade: 0,
      current_percentage: 0,
      letter_grade: 'N/A',
      max_possible_grade: 100,
      min_possible_grade: 0,
      categorized_grades: {},
      analysis: 'Unable to calculate grade statistics due to an error.'
    };
  }
}

/**
 * Helper function to convert numeric grade to letter grade
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
 * Helper function to generate natural language analysis of grade statistics
 * @param {Object} stats - Grade statistics
 * @returns {string} Natural language analysis
 */
function generateGradeAnalysis(stats) {
  const {
    currentGrade,
    maxPossibleGrade,
    minPossibleGrade,
    letterGrade,
    categorizedGrades
  } = stats;
  
  const analysis = [];
  
  analysis.push(`Current grade is ${currentGrade.toFixed(1)}% (${letterGrade})`);
  
  if (maxPossibleGrade > currentGrade) {
    analysis.push(`Maximum possible grade is ${maxPossibleGrade.toFixed(1)}%`);
  }
  
  if (minPossibleGrade < currentGrade) {
    analysis.push(`Minimum possible grade is ${minPossibleGrade.toFixed(1)}%`);
  }
  
  // Add category-specific analysis
  Object.entries(categorizedGrades).forEach(([category, data]) => {
    if (data.average !== null) {
      analysis.push(
        `${category}: ${data.average.toFixed(1)}% average ` +
        `(${data.completed.length} completed, ${data.remaining.length} remaining)`
      );
    }
  });
  
  return analysis.join('. ');
}

/**
 * Internal helper function to construct the prompt for OpenAI API.
 * Formats structured data into a standardized prompt format.
 *
 * @param {Object} data - Structured data to include in the prompt
 * @param {Object} data.syllabus - Syllabus information
 * @param {Object} [data.transcript] - Optional transcript information
 * @returns {string} Formatted prompt string
 */
function constructPrompt(data) {
  console.log('Constructing prompt for OpenAI');
  const promptLines = [];
  
  try {
    // Basic information
    promptLines.push(`Course Name: ${data.syllabus.course_name}`);
    promptLines.push(`Instructor: ${data.syllabus.instructor}`);
    
    // Grade weights
    promptLines.push("Grade Weights:");
    for (const gw of data.syllabus.grade_weights) {
      promptLines.push(`  - ${gw.name}: ${gw.weight}`);
    }
    
    // Assignments
    const assignmentsStr = data.syllabus.assignments.join(", ");
    promptLines.push(`Assignments: ${assignmentsStr}`);
    
    // GPA, final grade, and credit hours
    const gpa = data.transcript?.gpa || "N/A";
    const finalGrade = data.transcript?.final_grade || "N/A";
    promptLines.push(`GPA: ${gpa}`);
    promptLines.push(`Current/Previous Final Grade: ${finalGrade}`);
    promptLines.push(`Credit Hours: ${data.syllabus.credit_hours}`);
    
    // Due dates
    promptLines.push("Due Dates:");
    for (const dd of data.syllabus.due_dates) {
      promptLines.push(`  - ${dd.assignment} due on ${dd.due_date}`);
    }
    
    // Final instruction
    promptLines.push(
      "Based on these details, predict the student's final grade. " +
      "Output exactly in JSON format with two keys: 'grade' (a numeric value) " +
      "and 'reasoning' (a short explanation). Do not include extra text."
    );
    
    return promptLines.join("\n");
  } catch (error) {
    console.error(`Error constructing prompt: ${error}`);
    console.error(`Data structure: ${JSON.stringify(data)}`);
    
    // Return a simplified prompt if there was an error
    return "Based on the available student data, predict the student's final grade. Output exactly in JSON format with two keys: 'grade' (a numeric value) and 'reasoning' (a short explanation). Do not include extra text.";
  }
}

// Add to exports
exports.processExtractedText = processExtractedText;
exports.processSyllabusText = processSyllabusText;
exports.processTranscriptText = processTranscriptText;
exports.processGradesText = processGradesText;
