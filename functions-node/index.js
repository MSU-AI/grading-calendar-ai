const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');
const OpenAI = require('openai');
const { calculateCurrentGrade } = require('./calculateGrade');
const { predictFinalGrade } = require('./predictGrade');
const { formatDocumentsData } = require('./formatDocumentsData');
const { DOCUMENT_TYPES, normalizeDocumentType } = require('./utils/documentUtils');

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
    const forceProcess = data?.forceProcess === true;
    
    console.log(`Manual formatting requested for user ${userId}, forceProcess: ${forceProcess}`);
    
    // Call the formatDocumentsData function with the forceProcess flag
    const formattedData = await formatDocumentsData(userId, forceProcess);
    
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

    // Normalize document type
    const normalizedDocType = normalizeDocumentType(data.documentType);
    const documentName = data.documentName || `${normalizedDocType}_${Date.now()}.pdf`;
    
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
      const filePath = `users/${userId}/${normalizedDocType}/${documentName}`;
      
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
        documentType: normalizedDocType,
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

// Import utility functions
const { getOpenAIApiKey } = require('./utils/apiUtils');


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
    
    console.log(`Firestore document updated successfully to extracted status`);
    
    // Only format documents after extraction if explicitly requested
    try {
      console.log('Document extracted successfully, but not triggering automatic format operation');
      const { formatDocumentsData } = require('./formatDocumentsData');
      
      // We no longer automatically format documents after extraction
      // This will be done manually by the user via the "Process Documents" button
      // const formatResult = await formatDocumentsData(userId, false);
      // Instead, just log that extraction is complete
      console.log('Document extraction complete. User can now process documents manually.');
      const formatResult = null;
      
      return extractedText;
    } catch (formatError) {
      console.error('Error during document formatting:', formatError);
      // Non-fatal error, continue with extraction success
      return extractedText;
    }
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
