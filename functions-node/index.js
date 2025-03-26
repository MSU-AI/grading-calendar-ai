const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');
const OpenAI = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

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
    
    // Ensure user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = context.auth.uid;
    
    // Validate input
    if (!data.documentBase64 || !data.documentType) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing document data or type');
    }

    // Get document name or generate one
    const documentName = data.documentName || `${data.documentType}_${Date.now()}.pdf`;
    
    // Process base64 data
    let base64Data = data.documentBase64;
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    // Create buffer from base64
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Created buffer with ${buffer.length} bytes`);
    
    // Create temp file
    const tempFile = tmp.fileSync({ postfix: '.pdf' });
    fs.writeFileSync(tempFile.name, buffer);
    console.log(`Wrote buffer to temp file: ${tempFile.name}`);
    
    try {
      // Get default bucket
      const bucket = admin.storage().bucket();
      const filePath = `users/${userId}/${data.documentType}/${documentName}`;
      
      console.log(`Uploading to Firebase Storage: ${filePath}`);
      await bucket.upload(tempFile.name, {
        destination: filePath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            originalName: documentName // Store original filename in metadata
          }
        }
      });
      
      console.log(`Successfully uploaded to ${filePath}`);
      
      // The Firestore record will be created by the processPdfUpload function
      
      return {
        success: true,
        message: 'Document uploaded successfully',
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
      console.log(`Invalid path format: ${filePath}, pathParts: ${JSON.stringify(pathParts)}`);
      return null;
    }
    
    const userId = pathParts[1];
    const documentType = pathParts[2]; // "syllabus" or "transcript"
    
    console.log(`Processing uploaded PDF: ${filePath} for user: ${userId}, type: ${documentType}`);
    
    // Get original filename from metadata if available, otherwise use path
    const originalName = object.metadata && object.metadata.originalName 
      ? object.metadata.originalName 
      : pathParts[3]; // Use the filename from the path
    
    // Check if document already exists with same path to avoid duplicates
    const db = admin.firestore();
    const existingDocs = await db.collection('users').doc(userId)
      .collection('documents')
      .where('filePath', '==', filePath)
      .get();
    
    if (!existingDocs.empty) {
      console.log(`Document with path ${filePath} already exists, skipping`);
      return null;
    }
    
    // Store basic information in Firestore with auto-generated ID
    const docRef = db.collection('users').doc(userId).collection('documents').doc();
    
    await docRef.set({
      filePath: filePath,
      documentType: documentType,
      name: originalName,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'uploaded'
    });
    
    console.log(`PDF upload metadata saved to Firestore for ${filePath}`);
    
    // Automatically extract text from the PDF
    try {
      console.log(`Starting automatic text extraction for ${filePath}`);
      await extractTextFromPdf(userId, docRef.id, filePath);
      console.log(`Automatic text extraction completed for ${filePath}`);
    } catch (extractError) {
      console.error(`Error automatically extracting text: ${extractError}`);
      console.error(`Error stack: ${extractError.stack}`);
      // Continue execution even if extraction fails - user can retry later
    }
    
    console.log(`processPdfUpload completed successfully for ${filePath}`);
    return null;
  } catch (error) {
    console.error(`Error in processPdfUpload: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    return null; // Storage triggers must return null on error
  }
});

/**
 * Extracts text content from a previously uploaded PDF document.
 * Uses pdf-parse library to extract text and stores the result in Firestore.
 *
 * @param {Object} data - The extraction request data
 * @param {string} data.documentId - ID of the document to process
 * @param {Object} context - The Firebase function context
 * @param {Object} context.auth - Authentication details of the requesting user
 * @returns {Promise<Object>} Object containing extraction status and text length
 * @throws {functions.https.HttpsError} If extraction fails or document not found
 */
exports.extractPdfText = functions.https.onCall(async (data, context) => {
  try {
    console.log('extractPdfText called with data:', JSON.stringify(data));
    
    // Ensure user is authenticated
    if (!context.auth) {
      console.error('Authentication required for extractPdfText');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    const { documentId } = data;
    
    if (!documentId) {
      throw new functions.https.HttpsError('invalid-argument', 'Document ID is required');
    }
    
    // Get document info from Firestore
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Document not found');
    }
    
    const docData = doc.data();
    const filePath = docData.filePath;
    
    if (!filePath) {
      throw new functions.https.HttpsError('not-found', 'File path not found for document');
    }
    
    console.log(`Starting text extraction for ${filePath}`);
    
    // Extract text from the PDF
    const extractedText = await extractTextFromPdf(userId, documentId, filePath);
    
    console.log(`Text extraction successful, ${extractedText.length} characters extracted`);
    
    return {
      success: true,
      documentId,
      message: `Successfully extracted text from document`,
      textLength: extractedText.length
    };
  } catch (error) {
    console.error(`Error in extractPdfText: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    throw new functions.https.HttpsError(
      'internal',
      `Error extracting text: ${error.message}`,
      { detailedError: error.toString() }
    );
  }
});

/**
 * Generates grade predictions using OpenAI based on processed document data.
 * Analyzes syllabus, transcript, and other documents to predict academic performance.
 *
 * @param {Object} data - Empty object (uses stored document data)
 * @param {Object} context - The Firebase function context
 * @param {Object} context.auth - Authentication details of the requesting user
 * @returns {Promise<Object>} Object containing prediction results
 * @throws {functions.https.HttpsError} If prediction fails or no processed documents found
 */
exports.predictGrades = functions.https.onCall(async (data, context) => {
  try {
    console.log('predictGrades called with data:', JSON.stringify(data));
    
    // Ensure user is authenticated
    if (!context.auth) {
      console.error('Authentication required for predictGrades');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    console.log(`Starting grade prediction for user ${userId}`);
    
    // Get all processed documents
    const db = admin.firestore();
    const documentsRef = db.collection('users').doc(userId).collection('documents');
    const snapshot = await documentsRef.where('status', '==', 'processed').get();
    
    const structuredData = { 
      syllabus: null,
      grades: null,
      transcript: null
    };
    const rawDocs = {};
    const documentIds = [];
    
    // First try to get structured data from documents
    snapshot.forEach(doc => {
      const data = doc.data();
      documentIds.push(doc.id);
      
      if (data.specialized_data && data.documentType) {
        structuredData[data.specialized_data.type] = data.specialized_data.data;
      } else if (data.text) {
        rawDocs[data.documentType] = data.text;
      }
    });
    
    // If we don't have structured data, try to process the raw text
    if (!structuredData.syllabus && !structuredData.grades && !structuredData.transcript) {
      if (Object.keys(rawDocs).length === 0) {
        console.log("No processed documents found for prediction");
        return {
          success: false,
          message: "No processed documents found. Please upload and process at least one document."
        };
      }
      
      // Process the extracted text to structured data
      console.log("Processing extracted text to structured data");
      const processedData = await processExtractedText(rawDocs);
      console.log("Processed data:", JSON.stringify(processedData));
      
      // Update structuredData with processed data
      Object.assign(structuredData, processedData);
    }
    
    // Combine data for calculations (use grades or transcript)
    const calculationData = {
      syllabus: structuredData.syllabus,
      grades: structuredData.grades || structuredData.transcript
    };
    
    // Calculate grade statistics
    console.log("Calculating grade statistics");
    const gradeStats = calculateGradeStatistics(calculationData);
    console.log("Grade statistics:", JSON.stringify(gradeStats));
    
    // Generate prediction based on structured data and calculated stats
    console.log("Generating prediction");
    let aiPrediction = null;
    try {
      aiPrediction = await generatePrediction(structuredData);
      console.log("AI Prediction result:", JSON.stringify(aiPrediction));
    } catch (predictionError) {
      console.error(`Error generating AI prediction: ${predictionError}`);
      console.error(`Error stack: ${predictionError.stack}`);
      // Continue without AI prediction
    }
    
    // Combine stats and AI prediction
    const combinedPrediction = {
      grade: gradeStats.current_grade,
      current_percentage: gradeStats.current_percentage,
      letter_grade: gradeStats.letter_grade,
      max_possible_grade: gradeStats.max_possible_grade,
      min_possible_grade: gradeStats.min_possible_grade,
      reasoning: gradeStats.analysis,
      ai_prediction: aiPrediction,
      categorized_grades: gradeStats.categorized_grades
    };
    
    console.log("Combined prediction:", JSON.stringify(combinedPrediction));
    
    // Store prediction
    const predictionRef = db.collection('users').doc(userId).collection('predictions').doc();
    const predictionData = {
      prediction: combinedPrediction,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      documentIds: documentIds,
      calculatedStats: gradeStats,
      structured_data: structuredData
    };
    
    console.log("Storing prediction in Firestore");
    await predictionRef.set(predictionData);
    
    console.log("Grade prediction completed successfully");
    
    return {
      success: true,
      prediction: combinedPrediction,
      message: "Grade prediction completed successfully"
    };
  } catch (error) {
    console.error(`Error in predictGrades: ${error}`);
    console.error(`Error stack: ${error.stack}`);
    throw new functions.https.HttpsError(
      'internal',
      `Error predicting grade: ${error.message}`,
      { detailedError: error.toString() }
    );
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
  
  // Get a reference to the default bucket
  const bucket = admin.storage().bucket();
  console.log(`Using bucket: ${bucket.name}`);
  
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
    const pdfData = await pdfParse(dataBuffer, {
      // Add options to make parsing more robust
      pagerender: null, // Disable page rendering
      max: 0 // No page limit
    });
    
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
      status: 'extracting',
      pageCount: pdfData.numpages
    }, { merge: true });
    
    // Now process the extracted text into structured data
    console.log(`Processing extracted text into structured data`);
    try {
      // Get the document type from the document
      const docData = await docRef.get();
      const documentType = docData.data().documentType;
      
      // Create a docs object for processing
      const docs = {};
      docs[documentType] = extractedText;
      
      // Process the text
      const structuredData = await processExtractedText(docs);
      
      // Update the document with structured data
      console.log(`Updating document with structured data`);
      await docRef.set({
        structured_data: structuredData[documentType] || null,
        status: 'processed'
      }, { merge: true });
      
      // Store specialized data directly in the main document
      if (documentType === 'syllabus' && structuredData.syllabus) {
        await docRef.set({
          specialized_data: {
            type: 'syllabus',
            data: structuredData.syllabus
          }
        }, { merge: true });
      } else if ((documentType === 'transcript' || documentType === 'grades') && structuredData[documentType]) {
        await docRef.set({
          specialized_data: {
            type: documentType,
            data: structuredData[documentType]
          }
        }, { merge: true });
      }
      
      console.log(`Successfully processed and stored structured data for ${documentType}`);
    } catch (processError) {
      console.error(`Error processing extracted text: ${processError}`);
      console.error(`Error stack: ${processError.stack}`);
      
      // Update status to indicate processing error but text extraction succeeded
      await docRef.set({
        status: 'extract_only',
        processError: processError.message
      }, { merge: true });
    }
    
    console.log(`Firestore document updated successfully`);
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
  
  if (docs.syllabus) {
    console.log('Processing syllabus text');
    try {
      // Process syllabus text with OpenAI
      console.log('Calling OpenAI API for syllabus processing');
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this syllabus in JSON format: course_name, instructor, grade_weights (array of {name, weight}), assignments (array), due_dates (array of {assignment, due_date}), credit_hours"
          },
          { role: "user", content: docs.syllabus.substring(0, 10000) } // Limit length to avoid token limits
        ]
      });
      
      const content = response.choices[0].message.content;
      console.log(`OpenAI response for syllabus: ${content.substring(0, 200)}...`);
      
      const syllabusData = JSON.parse(content);
      structuredData.syllabus = syllabusData;
      console.log('Successfully parsed syllabus data');
    } catch (error) {
      console.error(`Error processing syllabus with OpenAI: ${error}`);
      console.error(`Error stack: ${error.stack}`);
      
      // Provide fallback structured data
      console.log('Using fallback syllabus data');
      structuredData.syllabus = {
        course_name: "Unknown Course",
        instructor: "Unknown Instructor",
        grade_weights: [
          { name: "Assignments", weight: 0.5 },
          { name: "Exams", weight: 0.5 }
        ],
        assignments: ["Unknown Assignments"],
        due_dates: [],
        credit_hours: "3"
      };
    }
  }
  
  if (docs.transcript) {
    console.log('Processing transcript text');
    try {
      // Process transcript text with OpenAI
      console.log('Calling OpenAI API for transcript processing');
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this transcript in JSON format: gpa, final_grade"
          },
          { role: "user", content: docs.transcript.substring(0, 10000) } // Limit length to avoid token limits
        ]
      });
      
      const content = response.choices[0].message.content;
      console.log(`OpenAI response for transcript: ${content.substring(0, 200)}...`);
      
      const transcriptData = JSON.parse(content);
      structuredData.transcript = transcriptData;
      console.log('Successfully parsed transcript data');
    } catch (error) {
      console.error(`Error processing transcript with OpenAI: ${error}`);
      console.error(`Error stack: ${error.stack}`);
      
      // Provide fallback structured data
      console.log('Using fallback transcript data');
      structuredData.transcript = {
        gpa: "3.0",
        final_grade: "B"
      };
    }
  }
  
  if (docs.grades) {
    console.log('Processing grades text');
    try {
      // Process grades text with OpenAI - improved prompt
      console.log('Calling OpenAI API for grades processing');
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract current grades from this document in JSON format. Parse the document carefully, looking for assignment names and their corresponding grades. Return an array of objects, each with 'name' and 'grade' properties. For each assignment that has a score, include it as a numeric value. For assignments with 'Dropped!' status, set the grade property to 'Dropped'. Format example: [{\"name\": \"Week 1 HW\", \"grade\": 100}, {\"name\": \"Week 2 HW\", \"grade\": 95.5}, {\"name\": \"Quiz 1\", \"grade\": \"Dropped\"}]"
          },
          { role: "user", content: docs.grades.substring(0, 10000) } // Limit length to avoid token limits
        ]
      });
      
      const content = response.choices[0].message.content;
      console.log(`OpenAI response for grades: ${content.substring(0, 200)}...`);
      
      // Try to parse JSON response, but handle cases where the response might not be valid JSON
      try {
        const gradesData = JSON.parse(content);
        structuredData.grades = gradesData;
        console.log('Successfully parsed grades data');
      } catch (parseError) {
        console.error(`Failed to parse grades JSON: ${parseError}`);
        // Try to extract JSON from the response (sometimes OpenAI adds explanatory text)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const gradesData = JSON.parse(jsonMatch[0]);
            structuredData.grades = gradesData;
            console.log('Successfully parsed grades data from extracted JSON');
          } catch (nestedError) {
            console.error(`Failed to parse extracted JSON: ${nestedError}`);
            structuredData.grades = [];
          }
        } else {
          structuredData.grades = [];
        }
      }
    } catch (error) {
      console.error(`Error processing grades with OpenAI: ${error}`);
      console.error(`Error stack: ${error.stack}`);
      
      // Provide fallback structured data
      console.log('Using fallback grades data');
      structuredData.grades = [];
    }
  }
  
  console.log('Finished processing extracted text');
  return structuredData;
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
      model: "gpt-4o",
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
