const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');
const OpenAI = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Dedicated function for handling PDF document uploads
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
    
    // Process base64 data - handle different formats of base64 strings
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
      const filePath = `users/${userId}/${data.documentType}/${Date.now()}.pdf`;
      
      console.log(`Uploading to Firebase Storage: ${filePath}`);
      await bucket.upload(tempFile.name, {
        destination: filePath,
        metadata: {
          contentType: 'application/pdf'
        }
      });
      
      console.log(`Successfully uploaded to ${filePath}`);
      
      // Store reference in Firestore
      const db = admin.firestore();
      const docRef = db.collection('users').doc(userId).collection('documents').doc(data.documentType);
      
      await docRef.set({
        filePath: filePath,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'uploaded'
      });
      
      console.log(`Firestore document updated for ${filePath}`);
      
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
 * Triggered when a PDF is uploaded to Firebase Storage
 * Path format: users/{userId}/{documentType}/{filename}.pdf
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
    
    // Store basic information in Firestore
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
    
    await docRef.set({
      filePath: filePath,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'uploaded'
    });
    
    console.log(`PDF upload metadata saved to Firestore for ${filePath}`);
    
    // Automatically extract text from the PDF
    try {
      console.log(`Starting automatic text extraction for ${filePath}`);
      await extractTextFromPdf(userId, documentType, filePath);
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
 * Callable function to extract text from a PDF
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
    const { documentType } = data;
    
    console.log(`extractPdfText for user: ${userId}, documentType: ${documentType}`);
    
    if (!documentType || !['syllabus', 'transcript', 'grades'].includes(documentType)) {
      console.error(`Invalid document type: ${documentType}`);
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid document type (syllabus, transcript, or grades) is required'
      );
    }
    
    // Get document info from Firestore
    const db = admin.firestore();
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.error(`Document not found: users/${userId}/documents/${documentType}`);
      throw new functions.https.HttpsError(
        'not-found',
        `${documentType} not found`
      );
    }
    
    const docData = doc.data();
    const filePath = docData.filePath;
    
    if (!filePath) {
      console.error(`File path not found for ${documentType}`);
      throw new functions.https.HttpsError(
        'not-found',
        `File path not found for ${documentType}`
      );
    }
    
    console.log(`Starting text extraction for ${filePath}`);
    
    // Extract text from the PDF
    const extractedText = await extractTextFromPdf(userId, documentType, filePath);
    
    console.log(`Text extraction successful, ${extractedText.length} characters extracted`);
    
    return {
      success: true,
      documentType,
      message: `Successfully extracted text from ${documentType}`,
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
 * Callable function to predict grades based on extracted document data
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
    
    // Check if this is a document upload request
    if (data.documentBase64 && data.documentType) {
      console.log(`Processing document upload for type: ${data.documentType}`);
      
      // Convert base64 to buffer
      const base64Data = data.documentBase64.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create a temporary file
      const tempFile = tmp.fileSync({ postfix: '.pdf' });
      fs.writeFileSync(tempFile.name, buffer);
      
      // Upload to Firebase Storage
      const bucket = admin.storage().bucket();
      const filePath = `users/${userId}/${data.documentType}/${Date.now()}.pdf`;
      
      await bucket.upload(tempFile.name, {
        destination: filePath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            documentType: data.documentType,
            uploadedBy: userId
          }
        }
      });
      
      // Store document info in Firestore
      const db = admin.firestore();
      const docRef = db.collection('users').doc(userId).collection('documents').doc(data.documentType);
      
      await docRef.set({
        filePath: filePath,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'uploaded'
      });
      
      // Clean up temp file
      tempFile.removeCallback();
      
      // Extract text from the uploaded PDF
      const extractedText = await extractTextFromPdf(userId, data.documentType, filePath);
      
      // Process the extracted text and generate prediction
      const docs = { [data.documentType]: extractedText };
      const structuredData = await processExtractedText(docs);
      const prediction = await generatePrediction(structuredData);
      
      // Store prediction in Firestore
      const predictionRef = db.collection('users').doc(userId).collection('predictions').doc();
      await predictionRef.set({
        prediction: prediction,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        documents: [data.documentType]
      });
      
      return {
        success: true,
        message: `Document uploaded and processed successfully`,
        prediction: prediction
      };
    }
    
    // If no document upload, proceed with prediction based on existing documents
    const db = admin.firestore();
    const docs = {};
    
    // Try to get syllabus, transcript, and grades
    const docTypes = ["syllabus", "transcript", "grades"];
    for (const docType of docTypes) {
      console.log(`Checking for ${docType} document`);
      
      const docRef = db.collection('users').doc(userId).collection('documents').doc(docType);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const docData = doc.data();
        console.log(`Found ${docType} document: ${JSON.stringify(docData)}`);
        
        const text = docData.text || "";
        
        if (text) {
          docs[docType] = text;
          console.log(`Found ${text.length} characters of text for ${docType}`);
        }
      }
    }
    
    if (Object.keys(docs).length === 0) {
      console.log("No document text found for prediction");
      return {
        success: false,
        message: "No document text found. Please upload at least a syllabus or transcript."
      };
    }
    
    // Process the extracted text to structured data
    console.log("Processing extracted text to structured data");
    let structuredData = await processExtractedText(docs);
    console.log("Structured data:", JSON.stringify(structuredData));
    
    // Generate prediction based on structured data
    console.log("Generating prediction");
    const prediction = await generatePrediction(structuredData);
    console.log("Prediction result:", JSON.stringify(prediction));
    
    // Store prediction in Firestore
    const predictionRef = db.collection('users').doc(userId).collection('predictions').doc();
    const predictionData = {
      prediction: prediction,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      documents: Object.keys(docs)
    };
    
    console.log("Storing prediction in Firestore");
    await predictionRef.set(predictionData);
    
    console.log("Grade prediction completed successfully");
    
    return {
      success: true,
      prediction: prediction,
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
 * Helper function to extract text from a PDF
 */
async function extractTextFromPdf(userId, documentType, filePath) {
  console.log(`Extracting text from ${documentType} PDF: ${filePath} for user ${userId}`);
  
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
    const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
    
    // Use set with merge to ensure we don't overwrite existing data
    console.log(`Updating Firestore document with extracted text`);
    await docRef.set({
      text: extractedText,
      lastExtracted: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed',
      pageCount: pdfData.numpages
    }, { merge: true });
    
    console.log(`Firestore document updated successfully`);
    return extractedText;
  } catch (error) {
    console.error(`Error extracting text from PDF: ${error}`);
    console.error(`Error stack: ${error.stack}`);
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
 * Process extracted text into structured data
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
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this syllabus in JSON format: course_name, instructor, grade_weights (array of {name, weight}), assignments (array), due_dates (array of {assignment, due_date}), credit_hours"
          },
          { role: "user", content: docs.syllabus.substring(0, 4000) } // Limit length to avoid token limits
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
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this transcript in JSON format: gpa, final_grade"
          },
          { role: "user", content: docs.transcript.substring(0, 4000) } // Limit length to avoid token limits
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
      // Process grades text with OpenAI
      console.log('Calling OpenAI API for grades processing');
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract current grades from this document in JSON format as an array of {name, grade}"
          },
          { role: "user", content: docs.grades.substring(0, 4000) } // Limit length to avoid token limits
        ]
      });
      
      const content = response.choices[0].message.content;
      console.log(`OpenAI response for grades: ${content.substring(0, 200)}...`);
      
      const gradesData = JSON.parse(content);
      structuredData.grades = gradesData;
      console.log('Successfully parsed grades data');
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
 * Generate prediction using OpenAI API
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
      model: "gpt-3.5-turbo",
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
 * Construct the prompt for OpenAI - identical to the Python implementation
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
