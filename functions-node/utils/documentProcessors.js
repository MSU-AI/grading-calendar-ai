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
  
  // Create syllabus-specific prompt with improved assignment extraction
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
      "dueDate": "Due date if available, otherwise null",
      "maxPoints": 100, // Maximum possible points if available, otherwise use a reasonable default
      "description": "Brief description of the assignment if available, otherwise null"
    }
  ]
}

Important:
1. Make sure all weights sum to exactly 1.0
2. Use null for missing values, not empty strings
3. Extract ALL assignments mentioned in the syllabus, including:
   - Individual homework assignments
   - Quizzes and exams
   - Projects and presentations
   - Lab assignments
   - Discussion posts or participation tasks
   - Any other graded work
4. Be thorough - look for assignment schedules, course calendars, and grading sections
5. Ensure category names in assignments match exactly with those in gradeWeights
6. For each section of the syllabus, check if it contains assignment information
7. Include recurring assignments (weekly quizzes, homework assignments, etc.)
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
  
  // Create grades-specific prompt with detection of incomplete assignments
  const prompt = `
I need you to extract both completed and incomplete assignment information from a grades document.

Here is the raw text from the grades document:
${gradesText}

${categoryInfo}

Please extract and format this information into the following exact JSON structure:
{
  "completedAssignments": [
    {
      "name": "Assignment name with a grade",
      "grade": 95.5, // Numeric grade as a number, not string
      "maxPoints": 100, // Maximum possible points, usually 100
      "category": "Category this assignment belongs to (must match categories from syllabus if available)"
    }
  ],
  "incompleteAssignments": [
    {
      "name": "Assignment name with NO grade yet",
      "maxPoints": 100, // Maximum possible points if available
      "category": "Category this assignment belongs to",
      "dueDate": "Due date if available, otherwise null"
    }
  ],
  "currentGrade": 92.5 // Overall current numerical grade if available
}

Example of correct output:
{
  "completedAssignments": [
    { "name": "Homework 1", "grade": 95.5, "maxPoints": 100, "category": "Homework" },
    { "name": "Midterm Exam", "grade": 88.0, "maxPoints": 100, "category": "Exams" }
  ],
  "incompleteAssignments": [
    { "name": "Homework 2", "maxPoints": 100, "category": "Homework", "dueDate": "Mar 15, 2025" },
    { "name": "Final Exam", "maxPoints": 200, "category": "Exams", "dueDate": null }
  ],
  "currentGrade": 92.5
}

Important:
1. Convert all percentages to numbers (e.g., 95% becomes 95.0)
2. Look for assignments that appear in the grades document but have:
   - No grade yet
   - "Not Submitted", "Upcoming", "Pending", etc.
   - Empty grade fields
   - Future due dates
   These should all go in the incompleteAssignments array.
3. Match each assignment to the most appropriate category from the syllabus
4. If an assignment doesn't match any syllabus category, use your best judgment
5. Include ALL assignments you can find in the document, both completed and incomplete
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
      incompleteAssignments: [],
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
 * Final combined formatting of all document data with smart assignment categorization
 * @param {string} userId - User ID
 * @param {Object} syllabusData - Formatted syllabus data
 * @param {Object} gradesData - Formatted grades data
 * @param {Object} transcriptData - Formatted transcript data
 * @returns {Promise<Object>} Intelligently combined data
 */
async function finalSmartFormatting(userId, syllabusData, gradesData, transcriptData) {
  console.log(`Performing final smart formatting for user ${userId}`);
  
  // Create consolidated input data for the formatting API call
  const inputData = {
    syllabusData: syllabusData || { 
      course: { name: "Unknown Course", instructor: "Unknown", creditHours: "3", courseType: "Unknown" },
      gradeWeights: [],
      assignments: []
    },
    gradesData: gradesData || { 
      completedAssignments: [], 
      incompleteAssignments: [],
      currentGrade: null
    },
    transcriptData: transcriptData || {
      gpa: "0.0",
      academicHistory: { relevantCourses: [] }
    }
  };
  
  // Extract all assignment data available for intelligent merging
  const allAssignmentSources = {
    fromSyllabus: (syllabusData && syllabusData.assignments) || [],
    completedFromGrades: (gradesData && gradesData.completedAssignments) || [],
    incompleteFromGrades: (gradesData && gradesData.incompleteAssignments) || []
  };
  
  // Get canonical grade weights to ensure consistent categorization
  const canonicalCategories = (syllabusData && syllabusData.gradeWeights) || [];
  
  // Create prompt for final smart formatting
  const prompt = `
I need to intelligently combine data from multiple academic documents to create a unified view.

CANONICAL GRADE CATEGORIES (these should be used for all assignments):
${JSON.stringify(canonicalCategories)}

SYLLABUS DATA:
${JSON.stringify(inputData.syllabusData)}

GRADES DATA:
${JSON.stringify(inputData.gradesData)}

TRANSCRIPT DATA:
${JSON.stringify(inputData.transcriptData)}

ALL ASSIGNMENT SOURCES:
${JSON.stringify(allAssignmentSources)}

Please create a unified data view with the following exact JSON structure:
{
  "course": {
    "name": "Course name",
    "instructor": "Instructor name",
    "creditHours": "Credit hours",
    "courseType": "Course type"
  },
  "gradeWeights": [
    { "name": "Category name", "weight": 0.3 }
  ],
  "completedAssignments": [
    {
      "name": "Assignment name",
      "grade": 95.5,
      "maxPoints": 100,
      "category": "Category name"
    }
  ],
  "remainingAssignments": [
    {
      "name": "Assignment name",
      "category": "Category name"
    }
  ],
  "dueDates": [
    {
      "assignment": "Assignment name",
      "due_date": "Due date"
    }
  ],
  "gpa": "GPA value",
  "academicHistory": {
    "relevantCourses": []
  }
}

Important guidelines:
1. Use the CANONICAL GRADE CATEGORIES for all assignments
2. Reconcile assignments between syllabus and grades:
   - If an assignment appears in both, merge the data (favoring grades for scores)
   - Use fuzzy matching to identify the same assignment with different names
   - For similar assignments, include source information about where it was found
3. Ensure every assignment is placed in one of the canonical categories
4. For assignments that don't clearly match a category:
   - Use naming patterns (e.g., "Quiz 1" belongs to "Quizzes")
   - Consider the points value (e.g., small point assignments might be "Participation")
   - Use keywords in the title to make educated guesses
5. In categoryStats, calculate statistics for each category:
   - Number of completed assignments
   - Number of remaining assignments
   - Total points possible
   - Points earned so far
6. Ensure grade weights sum to exactly 1.0
7. Format dates consistently
8. Include all due dates in the dueDates array
`;

  try {
    // Call OpenAI to perform the final smart formatting
    const smartFormattedData = await callOpenAIForFormatting(prompt);
    
    // Store the unified formatted data
    await storeUnifiedFormattedData(userId, smartFormattedData);
    
    return smartFormattedData;
  } catch (error) {
    console.error("Error in final smart formatting:", error);
    
    // Fall back to basic combining method if smart formatting fails
    return basicCombinedData(userId, syllabusData, gradesData, transcriptData);
  }
}

/**
 * Store the unified formatted data in Firestore
 * @param {string} userId - User ID
 * @param {Object} formattedData - Smart formatted data
 * @returns {Promise<void>}
 */
async function storeUnifiedFormattedData(userId, formattedData) {
  console.log(`Storing unified formatted data for user ${userId}`);
  const db = admin.firestore();
  
  try {
    await db.collection('users').doc(userId).collection('data').doc('formatted_data').set({
      formatted_data: formattedData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Successfully stored unified formatted data`);
  } catch (error) {
    console.error(`Error storing unified formatted data:`, error);
    throw error;
  }
}

/**
 * Basic fallback combining of data when smart formatting fails
 * @param {string} userId - User ID
 * @param {Object} syllabusData - Formatted syllabus data
 * @param {Object} gradesData - Formatted grades data
 * @param {Object} transcriptData - Formatted transcript data
 * @returns {Promise<Object>} Combined data using basic method
 */
async function basicCombinedData(userId, syllabusData, gradesData, transcriptData) {
  console.log(`Falling back to basic data combination for user ${userId}`);
  
  // Create combined data structure
  const combinedData = {
    course: (syllabusData && syllabusData.course) || {
      name: "Unknown Course",
      instructor: "Unknown Instructor",
      creditHours: "3"
    },
    gradeWeights: (syllabusData && syllabusData.gradeWeights) || [],
    completedAssignments: (gradesData && gradesData.completedAssignments) || [],
    remainingAssignments: [],
    dueDates: [],
    gpa: (transcriptData && transcriptData.gpa) || "N/A",
    academicHistory: (transcriptData && transcriptData.academicHistory) || { relevantCourses: [] }
  };
  
  // Add incomplete assignments from grades document to remaining assignments
  if (gradesData && gradesData.incompleteAssignments) {
    combinedData.remainingAssignments.push(...gradesData.incompleteAssignments.map(a => ({
      name: a.name,
      category: a.category,
      maxPoints: a.maxPoints || 100,
      dueDate: a.dueDate || null,
      source: "grades"
    })));
  }
  
  // Add assignments from syllabus that don't appear in completed assignments
  if (syllabusData && syllabusData.assignments) {
    // Create sets of assignment names for quick lookups
    const completedNames = new Set((gradesData && gradesData.completedAssignments || [])
      .map(a => a.name.toLowerCase().trim()));
    
    const incompleteNames = new Set((gradesData && gradesData.incompleteAssignments || [])
      .map(a => a.name.toLowerCase().trim()));
    
    // Add syllabus assignments that aren't in either completed or incomplete
    syllabusData.assignments.forEach(syllabusAssignment => {
      const name = syllabusAssignment.name.toLowerCase().trim();
      
      if (!completedNames.has(name) && !incompleteNames.has(name)) {
        combinedData.remainingAssignments.push({
          name: syllabusAssignment.name,
          category: syllabusAssignment.category,
          maxPoints: syllabusAssignment.maxPoints || 100,
          dueDate: syllabusAssignment.dueDate || null,
          source: "syllabus"
        });
      }
    });
  }
  
  // Add due dates from all sources
  // From syllabus
  if (syllabusData && syllabusData.assignments) {
    const completedNames = new Set((gradesData && gradesData.completedAssignments || [])
      .map(a => a.name.toLowerCase().trim()));
    
    syllabusData.assignments.forEach(assignment => {
      if (assignment.dueDate) {
        combinedData.dueDates.push({
          assignment: assignment.name,
          due_date: assignment.dueDate,
          completed: completedNames.has(assignment.name.toLowerCase().trim())
        });
      }
    });
  }
  
  // From grades (incomplete assignments with due dates)
  if (gradesData && gradesData.incompleteAssignments) {
    gradesData.incompleteAssignments.forEach(assignment => {
      if (assignment.dueDate) {
        // Check if this due date already exists in the array
        const exists = combinedData.dueDates.some(d => 
          d.assignment.toLowerCase().trim() === assignment.name.toLowerCase().trim());
        
        if (!exists) {
          combinedData.dueDates.push({
            assignment: assignment.name,
            due_date: assignment.dueDate,
            completed: false
          });
        }
      }
    });
  }
  
  // Store the basic combined data
  await storeUnifiedFormattedData(userId, combinedData);
  
  return combinedData;
}

/**
 * Combine all formatted data into a unified structure with smart categorization
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Unified formatted data
 */
async function combineFormattedData(userId) {
  console.log(`Combining formatted data for user ${userId}`);
  
  // Get all formatted data
  const syllabusData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.SYLLABUS);
  const gradesData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.GRADES);
  const transcriptData = await getFormattedDocumentData(userId, DOCUMENT_TYPES.TRANSCRIPT);
  
  console.log(`Retrieved formatted data - Syllabus: ${!!syllabusData}, Grades: ${!!gradesData}, Transcript: ${!!transcriptData}`);
  
  // Use the new smart formatting function
  try {
    const smartFormattedData = await finalSmartFormatting(userId, syllabusData, gradesData, transcriptData);
    console.log(`Successfully performed smart formatting of data`);
    return smartFormattedData;
  } catch (error) {
    console.error(`Error during smart formatting: ${error.message}`);
    console.error(`Falling back to basic combination`);
    
    // Fall back to basic combination method
    return basicCombinedData(userId, syllabusData, gradesData, transcriptData);
  }
}

module.exports = {
  formatSyllabusData,
  formatGradesData,
  formatTranscriptData,
  combineFormattedData,
  finalSmartFormatting
};