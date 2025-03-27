/**
 * Formats extracted data from documents into a standardized structure for grade calculations
 * @param {Object} structuredData - Raw structured data from documents
 * @returns {Object} Formatted data for calculations
 */
exports.formatDataForCalculation = (structuredData) => {
  console.log('Formatting document data for calculation');
  
  try {
    // Extract data from inputs
    const syllabus = structuredData.syllabus || {};
    const gradesData = structuredData.grades || structuredData.transcript || {};
    
    // Format grade weights
    const gradeWeights = (syllabus.grade_weights || []).map(weight => ({
      name: weight.name,
      weight: typeof weight.weight === 'number' ? weight.weight : parseFloat(weight.weight) / 100
    }));
    
    // Normalize weights to ensure they sum to 1
    const totalWeight = gradeWeights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.01) {
      gradeWeights.forEach(w => {
        w.weight = w.weight / totalWeight;
      });
    }
    
    // Format completed assignments
    let completedAssignments = [];
    
    // Handle different data structures
    if (Array.isArray(gradesData)) {
      // Direct array of grades
      completedAssignments = gradesData.map(grade => ({
        name: grade.name || 'Unknown Assignment',
        grade: grade.grade,
        maxPoints: 100, // Default
        category: grade.category || findBestCategory(grade.name, gradeWeights)
      }));
    } else if (gradesData.courses) {
      // Transcript format
      completedAssignments = (gradesData.courses || [])
        .filter(course => course.grade && course.course_code)
        .map(course => ({
          name: course.course_name || course.course_code,
          grade: convertLetterGradeToNumber(course.grade),
          maxPoints: 100,
          category: 'Transcript'
        }));
    }
    
    // Format remaining assignments
    const assignmentNames = new Set(completedAssignments.map(a => a.name.toLowerCase()));
    const remainingAssignments = (syllabus.assignments || [])
      .filter(name => !assignmentNames.has(name.toLowerCase()))
      .map(name => ({
        name: name,
        category: findBestCategory(name, gradeWeights)
      }));
    
    // Format due dates
    const dueDates = (syllabus.due_dates || []).map(dd => ({
      assignment: dd.assignment,
      due_date: dd.due_date
    }));
    
    // Return the formatted data
    return {
      course: {
        name: syllabus.course_name || "Unknown Course",
        instructor: syllabus.instructor || "Unknown Instructor",
        creditHours: syllabus.credit_hours || "3"
      },
      gradeWeights,
      completedAssignments,
      remainingAssignments,
      dueDates,
      gpa: gradesData.overall_gpa || gradesData.gpa || "3.0"
    };
  } catch (error) {
    console.error('Error formatting document data:', error);
    // Return a default structure
    return {
      course: { name: "Unknown Course", instructor: "Unknown", creditHours: "3" },
      gradeWeights: [{ name: "Assignments", weight: 1.0 }],
      completedAssignments: [],
      remainingAssignments: [],
      dueDates: [],
      gpa: "3.0"
    };
  }
};

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
