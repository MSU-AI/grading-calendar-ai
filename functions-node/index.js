const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');

admin.initializeApp();

exports.extractPdfText = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }
  
  const userId = context.auth.uid;
  const { documentType } = data;
  
  if (!documentType || !['syllabus', 'transcript'].includes(documentType)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Valid document type (syllabus or transcript) is required'
    );
  }
  
  try {
    console.log(`Starting text extraction for ${documentType} from user ${userId}`);
    
    // Get document info from Firestore
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `${documentType} not found`
      );
    }
    
    const docData = doc.data();
    const filePath = docData.filePath;
    
    if (!filePath) {
      throw new functions.https.HttpsError(
        'not-found',
        `File path not found for ${documentType}`
      );
    }
    
    console.log(`Downloading PDF from Firebase Storage: ${filePath}`);
    
    // Download file from Firebase Storage
    const bucket = admin.storage().bucket();
    const tempFile = tmp.fileSync({ postfix: '.pdf' });
    
    await bucket.file(filePath).download({
      destination: tempFile.name
    });
    
    console.log(`PDF downloaded to temporary file: ${tempFile.name}`);
    
    // Extract text using pdf-parse
    const dataBuffer = fs.readFileSync(tempFile.name);
    const pdfData = await pdfParse(dataBuffer);
    
    console.log(`Successfully extracted ${pdfData.text.length} characters of text`);
    
    // Clean up the temp file
    tempFile.removeCallback();
    
    // Update document in Firestore with extracted text
    await docRef.update({
      text: pdfData.text,
      lastExtracted: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed'
    });
    
    return {
      success: true,
      documentType,
      message: `Successfully extracted text from ${documentType}`,
      textLength: pdfData.text.length
    };
  } catch (error) {
    console.error(`Error extracting text from PDF: ${error}`);
    throw new functions.https.HttpsError(
      'internal',
      `Error extracting text from ${documentType}: ${error.message}`
    );
  }
});

// Add a function that works with the PDF upload trigger
exports.processPdfUpload = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  
  // Only process PDFs in the user's directory
  if (!filePath || !filePath.startsWith('users/') || !filePath.endsWith('.pdf')) {
    return null;
  }
  
  // Extract user ID and document type from path
  // Expected format: users/{userId}/{documentType}/{filename}.pdf
  const pathParts = filePath.split('/');
  if (pathParts.length < 4) {
    return null;
  }
  
  const userId = pathParts[1];
  const documentType = pathParts[2]; // "syllabus" or "transcript"
  
  try {
    console.log(`Processing uploaded PDF: ${filePath}`);
    
    // Store basic information in Firestore
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
    
    await docRef.set({
      filePath: filePath,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'uploaded'
    });
    
    console.log(`PDF upload metadata saved to Firestore for ${filePath}`);
    return null;
  } catch (error) {
    console.error(`Error processing uploaded PDF: ${error}`);
    return null;
  }
});
