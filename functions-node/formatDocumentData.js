const OpenAI = require('openai');

/**
 * Formats document data using OpenAI API to ensure consistent structure
 * @param {Object} structuredData - Raw structured data from documents
 * @returns {Promise<Object>} Formatted data for calculations
 */
exports.formatDataForCalculation = async (structuredData) => {
  console.log('Formatting document data for calculation using OpenAI');
  
  try {
    // Get OpenAI API key
    const apiKey = getOpenAIApiKey();
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Extract the syllabus and grades data (if available)
    const syllabus = structuredData.syllabus || {};
    const grades = structuredData.grades || {};
    const transcript = structuredData.transcript || {};
    
    // Create a prompt with the raw data
    const prompt = `
I need you to format educational document data into a consistent structure for grade calculations.
Here is the raw data:

SYLLABUS DATA:
${JSON.stringify(syllabus, null, 2)}

GRADES DATA:
${JSON.stringify(grades, null, 2)}

TRANSCRIPT DATA:
${JSON.stringify(transcript, null, 2)}

Please format this data into the following exact JSON structure:
{
  "course": {
    "name": "Course name from syllabus",
    "instructor": "Instructor name from syllabus",
    "creditHours": "Credit hours as string"
  },
  "gradeWeights": [
    {
      "name": "Category name (e.g., 'Exams', 'Homework')",
      "weight": 0.3 // Decimal weight, ensure all weights sum to 1.0
    }
  ],
  "completedAssignments": [
    {
      "name": "Assignment name",
      "grade": 95, // Numeric grade
      "maxPoints": 100, // Maximum possible points
      "category": "Category name matching a gradeWeight name"
    }
  ],
  "remainingAssignments": [
    {
      "name": "Assignment name",
      "category": "Category name matching a gradeWeight name"
    }
  ],
  "dueDates": [
    {
      "assignment": "Assignment name",
      "due_date": "Due date string"
    }
  ],
  "gpa": "Overall GPA as string"
}

Only include assignments in "remainingAssignments" if they appear in the syllabus but not in the completed grades.
Ensure that all assignments have a matching category from the grade weights.
All weights should sum to exactly 1.0.
`;

    // Call OpenAI API
    console.log('Calling OpenAI for data formatting');
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
    const formattedData = JSON.parse(response.choices[0].message.content);
    console.log('Successfully formatted data with OpenAI');
    
    return formattedData;
  } catch (error) {
    console.error('Error formatting data with OpenAI:', error);
    
    // Return a fallback format in case of error
    return {
      course: { 
        name: structuredData.syllabus?.course_name || "Unknown Course", 
        instructor: structuredData.syllabus?.instructor || "Unknown Instructor", 
        creditHours: structuredData.syllabus?.credit_hours || "3" 
      },
      gradeWeights: structuredData.syllabus?.grade_weights?.map(w => ({
        name: w.name,
        weight: typeof w.weight === 'number' ? w.weight : parseFloat(w.weight) / 100
      })) || [{ name: "Assignments", weight: 1.0 }],
      completedAssignments: [],
      remainingAssignments: [],
      dueDates: [],
      gpa: structuredData.transcript?.overall_gpa || structuredData.grades?.overall_gpa || "3.0"
    };
  }
};

/**
 * Helper function to get OpenAI API key
 */
function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || 
                (functions.config && functions.config().openai && functions.config().openai.apikey);
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY or firebase config openai.apikey');
  }
  
  return apiKey;
}

/**
 * Find the best matching category for an assignment name
 * @param {string} assignmentName - The name of the assignment
 * @param {Array} categories - Array of category objects with name property
 * @returns {string} Best matching category name
 */
function findBestCategory(assignmentName, categories) {
  if (!assignmentName || !categories || categories.length === 0) {
    return "Other";
  }
  
  const nameLower = assignmentName.toLowerCase();
  
  // Try exact match first
  for (const category of categories) {
    if (nameLower.includes(category.name.toLowerCase())) {
      return category.name;
    }
  }
  
  // Try keyword matching
  const keywordMap = {
    'exam': 'Exams',
    'test': 'Exams',
    'quiz': 'Quizzes',
    'homework': 'Homework',
    'hw': 'Homework',
    'assignment': 'Assignments',
    'lab': 'Labs',
    'project': 'Projects',
    'paper': 'Papers',
    'essay': 'Papers',
    'participation': 'Participation',
    'attendance': 'Participation',
    'final': 'Final Exam',
    'midterm': 'Midterm Exam'
  };
  
  for (const [keyword, categoryName] of Object.entries(keywordMap)) {
    if (nameLower.includes(keyword)) {
      // Check if this category exists in our list
      const matchingCategory = categories.find(c => 
        c.name.toLowerCase().includes(categoryName.toLowerCase())
      );
      
      if (matchingCategory) {
        return matchingCategory.name;
      }
    }
  }
  
  // Default to first category or "Other"
  return categories.length > 0 ? categories[0].name : "Other";
}

/**
 * Convert letter grade to numerical value
 * @param {string} letterGrade - The letter grade
 * @returns {number} Numerical grade
 */
function convertLetterGradeToNumber(letterGrade) {
  if (!letterGrade || typeof letterGrade !== 'string') {
    return 0;
  }
  
  const gradeMap = {
    'A+': 100, 'A': 95, 'A-': 90,
    'B+': 87, 'B': 85, 'B-': 80,
    'C+': 77, 'C': 75, 'C-': 70,
    'D+': 67, 'D': 65, 'D-': 60,
    'F': 50
  };
  
  const trimmedGrade = letterGrade.trim().toUpperCase();
  return gradeMap[trimmedGrade] || 0;
}
