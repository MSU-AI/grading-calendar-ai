const { DOCUMENT_TYPES } = require('./documentUtils');
const { callOpenAIForFormatting, storeFormattedDocumentData, getFormattedDocumentData } = require('./documentFormatUtils');
const admin = require('firebase-admin');

/**
 * Format syllabus data from raw text
 * @param {string} userId - User ID
 * @param {string} syllabusText - Raw text from syllabus
 * @returns {Promise<Object>} Formatted syllabus data
 */
async function formatSyllabusData(userId, syllabusText) {
  console.log(`Formatting syllabus data for user ${userId}`);
  
  // Create syllabus-specific prompt
  const prompt = `
I need you to extract key information from a course syllabus.

Here is the raw text from the syllabus:
${syllabusText}

Please extract and format this information into the following exact JSON structure:
{
  "course": {
    "name": "Full course name from syllabus",
    "instructor": "Instructor name(s) from syllabus",
    "creditHours": "Credit hours (as a string)",
    "courseType": "The type/department of the course (e.g., Physics, Mathematics, etc.)"
  },
  "gradeWeights": [
    {
      "name": "Category name from syllabus (e.g., Exams, Homework, etc.)",
      "weight": 0.3 // Decimal weight, not percentage
    }
  ],
  "assignments": [
    {
      "name": "Assignment name from syllabus",
      "category": "Category this assignment belongs to",
      "dueDate": "Due date if available, otherwise null"
    }
  ]
}

Example of correct output:
{
  "course": {
    "name": "PHY 184 - Physics for Scientists & Engineers II",
    "instructor": "Dr. Jane Smith",
    "creditHours": "4",
    "courseType": "Physics"
  },
  "gradeWeights": [
    { "name": "Exams", "weight": 0.30 },
    { "name": "Homework", "weight": 0.25 },
    { "name": "Labs", "weight": 0.25 },
    { "name": "Final Project", "weight": 0.20 }
  ],
  "assignments": [
    { "name": "Homework 1", "category": "Homework", "dueDate": "Jan 15, 2025" },
    { "name": "Midterm Exam", "category": "Exams", "dueDate": "Feb 28, 2025" }
  ]
}

Important:
1. Make sure all weights sum to exactly 1.0
2. Use null for missing dates, not empty strings
3. Extract as many assignments as possible
4. Ensure category names in assignments match exactly with those in gradeWeights
`;

  try {
    // Call OpenAI to format syllabus
    const formattedData = await callOpenAIForFormatting(prompt);
    
    // Store formatted data
    await storeFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error("Error formatting syllabus data:", error);
    
    // Return a basic fallback structure
    const fallbackData = {
      course: {
        name: "Unknown Course",
        instructor: "Unknown Instructor",
        creditHours: "3",
        courseType: "Unknown"
      },
      gradeWeights: [
        { name: "Homework", weight: 0.3 },
        { name: "Exams", weight: 0.4 },
        { name: "Projects", weight: 0.3 }
      ],
      assignments: []
    };
    
    // Still try to store the fallback data
    try {
      await storeFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS, fallbackData);
    } catch (storeError) {
      console.error("Error storing fallback syllabus data:", storeError);
    }
    
    return fallbackData;
  }
}

/**
 * Format grades data using raw text and syllabus data
 * @param {string} userId - User ID
 * @param {string} gradesText - Raw text from grades document
 * @returns {Promise<Object>} Formatted grades data
 */
async function formatGradesData(userId, gradesText) {
  console.log(`Formatting grades data for user ${userId}`);
  
  // Get previously formatted syllabus data to improve categorization
  const syllabusData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS);
  
  // Prepare category information from syllabus if available
  let categoryInfo = "No syllabus data available";
  if (syllabusData && syllabusData.gradeWeights) {
    categoryInfo = "Categories from syllabus:\n" + 
      syllabusData.gradeWeights.map(w => `- ${w.name} (${(w.weight * 100).toFixed(0)}%)`).join("\n");
  }
  
  // Create grades-specific prompt
  const prompt = `
I need you to extract completed assignment information from a grades document.

Here is the raw text from the grades document:
${gradesText}

${categoryInfo}

Please extract and format this information into the following exact JSON structure:
{
  "completedAssignments": [
    {
      "name": "Assignment name from grades",
      "grade": 95.5, // Numeric grade as a number, not string
      "maxPoints": 100, // Maximum possible points, usually 100
      "category": "Category this assignment belongs to (must match categories from syllabus if available)"
    }
  ],
  "currentGrade": 92.5 // Overall current numerical grade if available
}

Example of correct output:
{
  "completedAssignments": [
    { "name": "Homework 1", "grade": 95.5, "maxPoints": 100, "category": "Homework" },
    { "name": "Midterm Exam", "grade": 88.0, "maxPoints": 100, "category": "Exams" },
    { "name": "Lab 1", "grade": 20, "maxPoints": 20, "category": "Labs" }
  ],
  "currentGrade": 92.5
}

Important:
1. Convert all percentages to numbers (e.g., 95% becomes 95.0)
2. If an assignment is "dropped" or has no grade, exclude it
3. Match each assignment to the most appropriate category from the syllabus
4. If an assignment doesn't match any syllabus category, use your best judgment
5. Include ALL completed assignments you can find in the document
`;

  try {
    // Call OpenAI to format grades
    const formattedData = await callOpenAIForFormatting(prompt);
    
    // Store formatted data
    await storeFormattedDocumentData(userId, DOCUMENT_TYPES.GRADES, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error("Error formatting grades data:", error);
    
    // Return a basic fallback structure
    const fallbackData = {
      completedAssignments: [],
      currentGrade: null
    };
    
    // Still try to store the fallback data
    try {
      await storeFormattedDocumentData(userId, DOCUMENT_TYPES.GRADES, fallbackData);
    } catch (storeError) {
      console.error("Error storing fallback grades data:", storeError);
    }
    
    return fallbackData;
  }
}

/**
 * Format transcript data using raw text and syllabus data
 * @param {string} userId - User ID
 * @param {string} transcriptText - Raw text from transcript
 * @returns {Promise<Object>} Formatted transcript data
 */
async function formatTranscriptData(userId, transcriptText) {
  console.log(`Formatting transcript data for user ${userId}`);
  
  // Get previously formatted syllabus data to improve relevance determination
  const syllabusData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS);
  
  // Extract course type to help determine relevance
  let courseType = "Unknown";
  if (syllabusData && syllabusData.course && syllabusData.course.courseType) {
    courseType = syllabusData.course.courseType;
  }
  
  // Create transcript-specific prompt
  const prompt = `
I need you to extract academic history information from a transcript.

Current course type: ${courseType}

Here is the raw text from the transcript:
${transcriptText}

Please extract and format this information into the following exact JSON structure:
{
  "gpa": "Overall GPA from transcript",
  "academicHistory": {
    "relevantCourses": [
      {
        "course_code": "Course code (e.g., PHY 183)",
        "course_name": "Full course name",
        "grade": "Letter grade or numerical grade as found in transcript",
        "numerical_grade": 3.5, // Numerical equivalent as a number, not string
        "relevance": "High/Medium/Low based on relevance to ${courseType}"
      }
    ]
  }
}

Example of correct output:
{
  "gpa": "3.52",
  "academicHistory": {
    "relevantCourses": [
      {
        "course_code": "PHY 183",
        "course_name": "Physics for Scientists & Engineers I",
        "grade": "3.5",
        "numerical_grade": 3.5,
        "relevance": "High"
      },
      {
        "course_code": "MTH 132",
        "course_name": "Calculus I",
        "grade": "4.0",
        "numerical_grade": 4.0,
        "relevance": "Medium"
      }
    ]
  }
}

Determine relevance using these guidelines:
- High relevance: Same department (matching prefix), prerequisites, or similar content
- Medium relevance: Related fields (e.g., Math for Physics, Programming for Engineering)
- Low relevance: General STEM courses that might indirectly impact performance
`;

  try {
    // Call OpenAI to format transcript
    const formattedData = await callOpenAIForFormatting(prompt);
    
    // Store formatted data
    await storeFormattedDocumentData(userId, DOCUMENT_TYPES.TRANSCRIPT, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error("Error formatting transcript data:", error);
    
    // Return a basic fallback structure
    const fallbackData = {
      gpa: "0.0",
      academicHistory: {
        relevantCourses: []
      }
    };
    
    // Still try to store the fallback data
    try {
      await storeFormattedDocumentData(userId, DOCUMENT_TYPES.TRANSCRIPT, fallbackData);
    } catch (storeError) {
      console.error("Error storing fallback transcript data:", storeError);
    }
    
    return fallbackData;
  }
}

/**
 * Combine all formatted data into a unified structure
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Unified formatted data
 */
async function combineFormattedData(userId) {
  console.log(`Combining formatted data for user ${userId}`);
  
  // Get all formatted data
  const syllabusData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS) || {};
  const gradesData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.GRADES) || {};
  const transcriptData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.TRANSCRIPT) || {};
  
  // Combine into unified format
  const combinedData = {
    course: syllabusData.course || {
      name: "Unknown Course",
      instructor: "Unknown Instructor",
      creditHours: "3"
    },
    gradeWeights: syllabusData.gradeWeights || [],
    completedAssignments: gradesData.completedAssignments || [],
    remainingAssignments: [],
    dueDates: [],
    gpa: transcriptData.gpa || "N/A",
    academicHistory: transcriptData.academicHistory || { relevantCourses: [] }
  };
  
  // Generate remaining assignments by comparing syllabus assignments with completed assignments
  if (syllabusData.assignments && Array.isArray(syllabusData.assignments)) {
    const completedNames = new Set((gradesData.completedAssignments || []).map(a => a.name.toLowerCase()));
    
    // Add assignments from syllabus that don't appear in completed assignments
    combinedData.remainingAssignments = syllabusData.assignments
      .filter(a => !completedNames.has(a.name.toLowerCase()))
      .map(a => ({
        name: a.name,
        category: a.category
      }));
    
    // Add due dates
    combinedData.dueDates = syllabusData.assignments
      .filter(a => a.dueDate)
      .map(a => ({
        assignment: a.name,
        due_date: a.dueDate
      }));
  }
  
  // Store the unified data for calculations and predictions
  const db = admin.firestore();
  await db.collection('users').doc(userId).collection('data').doc('formatted_data').set({
    formatted_data: combinedData,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return combinedData;
}

module.exports = {
  formatSyllabusData,
  formatGradesData,
  formatTranscriptData,
  combineFormattedData
};
