const functions = require('firebase-functions');
const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const tmp = require('tmp');
const fs = require('fs');
const OpenAI = require('openai');

admin.initializeApp();

/**
 * Triggered when a PDF is uploaded to Firebase Storage
 * Path format: users/{userId}/{documentType}/{filename}.pdf
 */
exports.processPdfUpload = functions.storage.object().onFinalize(async (object) => {
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
    
    // Automatically extract text from the PDF
    try {
      await extractTextFromPdf(userId, documentType, filePath);
    } catch (extractError) {
      console.error(`Error automatically extracting text: ${extractError}`);
      // Continue execution even if extraction fails - user can retry later
    }
    
    return null;
  } catch (error) {
    console.error(`Error processing uploaded PDF: ${error}`);
    return null;
  }
});

/**
 * Callable function to extract text from a PDF
 */
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
  
  if (!documentType || !['syllabus', 'transcript', 'grades'].includes(documentType)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Valid document type (syllabus, transcript, or grades) is required'
    );
  }
  
  try {
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
    
    // Extract text from the PDF
    const extractedText = await extractTextFromPdf(userId, documentType, filePath);
    
    return {
      success: true,
      documentType,
      message: `Successfully extracted text from ${documentType}`,
      textLength: extractedText.length
    };
  } catch (error) {
    console.error(`Error extracting text from PDF: ${error}`);
    throw new functions.https.HttpsError(
      'internal',
      `Error extracting text from ${documentType}: ${error.message}`
    );
  }
});

/**
 * Callable function to predict grades based on extracted document data
 */
exports.predictGrades = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }
  
  const userId = context.auth.uid;
  
  try {
    console.log(`Starting grade prediction for user ${userId}`);
    
    // Get all documents for the user
    const db = admin.firestore();
    const docs = {};
    
    // Try to get syllabus, transcript, and grades
    const docTypes = ["syllabus", "transcript", "grades"];
    for (const docType of docTypes) {
      const docRef = db.collection('users').doc(userId).collection('documents').doc(docType);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const docData = doc.data();
        const text = docData.text || "";
        
        // If text is not extracted yet, skip this document
        if (!text && docData.filePath) {
          console.log(`Text not found for ${docType}, skipping`);
        }
        
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
    let structuredData = await processExtractedText(docs);
    
    // Generate prediction based on structured data
    const prediction = await generatePrediction(structuredData);
    
    // Store prediction in Firestore
    const predictionRef = db.collection('users').doc(userId).collection('predictions').doc();
    const predictionData = {
      prediction: prediction,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      documents: Object.keys(docs)
    };
    
    await predictionRef.set(predictionData);
    
    console.log("Grade prediction completed successfully");
    
    return {
      success: true,
      prediction: prediction,
      message: "Grade prediction completed successfully"
    };
  } catch (error) {
    console.error(`Error predicting grade: ${error}`);
    throw new functions.https.HttpsError(
      'internal',
      `Error predicting grade: ${error.message}`
    );
  }
});

/**
 * Helper function to extract text from a PDF
 */
async function extractTextFromPdf(userId, documentType, filePath) {
  console.log(`Extracting text from ${documentType} PDF: ${filePath}`);
  
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
  const extractedText = pdfData.text;
  
  console.log(`Successfully extracted ${extractedText.length} characters of text`);
  
  // Clean up the temp file
  tempFile.removeCallback();
  
  // Update document in Firestore with extracted text
  const db = admin.firestore();
  const docRef = db.collection('users').doc(userId).collection('documents').doc(documentType);
  
  await docRef.update({
    text: extractedText,
    lastExtracted: admin.firestore.FieldValue.serverTimestamp(),
    status: 'processed'
  });
  
  return extractedText;
}

/**
 * Process extracted text into structured data
 */
async function processExtractedText(docs) {
  const structuredData = {};
  
  if (docs.syllabus) {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    try {
      // Process syllabus text with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this syllabus in JSON format: course_name, instructor, grade_weights (array of {name, weight}), assignments (array), due_dates (array of {assignment, due_date}), credit_hours"
          },
          { role: "user", content: docs.syllabus }
        ]
      });
      
      const syllabusData = JSON.parse(response.choices[0].message.content);
      structuredData.syllabus = syllabusData;
    } catch (error) {
      console.error("Error processing syllabus with OpenAI:", error);
      // Provide fallback structured data
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
    // Initialize OpenAI client if not already initialized
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    try {
      // Process transcript text with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract the following information from this transcript in JSON format: gpa, final_grade"
          },
          { role: "user", content: docs.transcript }
        ]
      });
      
      const transcriptData = JSON.parse(response.choices[0].message.content);
      structuredData.transcript = transcriptData;
    } catch (error) {
      console.error("Error processing transcript with OpenAI:", error);
      // Provide fallback structured data
      structuredData.transcript = {
        gpa: "3.0",
        final_grade: "B"
      };
    }
  }
  
  if (docs.grades) {
    // Initialize OpenAI client if not already initialized
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    try {
      // Process grades text with OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Extract current grades from this document in JSON format as an array of {name, grade}"
          },
          { role: "user", content: docs.grades }
        ]
      });
      
      const gradesData = JSON.parse(response.choices[0].message.content);
      structuredData.grades = gradesData;
    } catch (error) {
      console.error("Error processing grades with OpenAI:", error);
      // Provide fallback structured data
      structuredData.grades = [];
    }
  }
  
  return structuredData;
}

/**
 * Generate prediction using OpenAI API
 */
async function generatePrediction(structuredData) {
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  // Construct the prompt using the same structure as the Python code
  const prompt = constructPrompt(structuredData);
  
  try {
    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a concise academic advisor." },
        { role: "user", content: prompt }
      ]
    });
    
    // Extract and parse the prediction
    const predictionText = response.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const prediction = JSON.parse(predictionText);
      return prediction;
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      // Return a fallback prediction if parsing fails
      return {
        grade: "B",
        reasoning: "Prediction based on limited data. OpenAI response could not be parsed as JSON."
      };
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
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
  const promptLines = [];
  
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
  promptLines.push(`GPA: ${data.transcript?.gpa || "N/A"}`);
  promptLines.push(`Current/Previous Final Grade: ${data.transcript?.final_grade || "N/A"}`);
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
}
