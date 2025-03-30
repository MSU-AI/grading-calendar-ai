const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DOCUMENT_TYPES, normalizeDocumentType } = require('./utils/documentUtils');
const { formatSyllabusData, formatGradesData, formatTranscriptData, combineFormattedData } = require('./utils/documentProcessors');

/**
 * Formats all document data using multiple OpenAI API calls to ensure consistent structure
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
    
    // Process each document type in sequence
    
    // 1. Process syllabus first (if available)
    let syllabusData = null;
    if (documentsByType[DOCUMENT_TYPES.SYLLABUS]) {
      console.log('Processing syllabus document');
      syllabusData = await formatSyllabusData(userId, documentsByType[DOCUMENT_TYPES.SYLLABUS].text);
    } else {
      console.log('No syllabus document found - using default values');
    }
    
    // 2. Process grades next (using syllabus data to improve categorization)
    let gradesData = null;
    if (documentsByType[DOCUMENT_TYPES.GRADES]) {
      console.log('Processing grades document');
      gradesData = await formatGradesData(userId, documentsByType[DOCUMENT_TYPES.GRADES].text);
    } else {
      console.log('No grades document found - using default values');
    }
    
    // 3. Process transcript last
    let transcriptData = null;
    if (documentsByType[DOCUMENT_TYPES.TRANSCRIPT]) {
      console.log('Processing transcript document');
      transcriptData = await formatTranscriptData(userId, documentsByType[DOCUMENT_TYPES.TRANSCRIPT].text);
    } else {
      console.log('No transcript document found - using default values');
    }
    
    // 4. Combine all formatted data
    const formattedData = await combineFormattedData(userId);
    
    // Update the status of all processed documents
    const updateResult = await updateDocumentStatus(userId, snapshot.docs);
    console.log(`Document status update result: ${updateResult}`);
    
    return formattedData;
  } catch (error) {
    console.error('Error formatting documents:', error);
    throw error;
  }
};


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
