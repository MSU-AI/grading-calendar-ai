/**
 * Calculate grade statistics with precision
 * @param {Object} data - Formatted data for calculation
 * @returns {Object} Calculated statistics
 */
function calculateExactGradeStatistics(data) {
  const { gradeWeights, completedAssignments, remainingAssignments } = data;
  
  // Initialize tracking variables
  const categoryStats = {};
  let totalWeightCovered = 0;
  
  // Calculate stats for each category
  gradeWeights.forEach(category => {
    const categoryAssignments = completedAssignments.filter(
      a => a.category === category.name
    );
    
    const categoryRemaining = remainingAssignments.filter(
      a => a.category === category.name
    );
    
    // Calculate total points and max possible in this category
    let totalPoints = 0;
    let maxPoints = 0;
    
    categoryAssignments.forEach(assignment => {
      // Handle numeric grades and special cases like "Dropped"
      if (typeof assignment.grade === 'number') {
        totalPoints += assignment.grade;
        maxPoints += assignment.maxPoints || 100;
      } else if (assignment.grade !== 'Dropped') {
        const numericGrade = parseFloat(assignment.grade);
        if (!isNaN(numericGrade)) {
          totalPoints += numericGrade;
          maxPoints += assignment.maxPoints || 100;
        }
      }
    });
    
    // Calculate category average
    const categoryAverage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : null;
    
    // Store stats
    categoryStats[category.name] = {
      completed: categoryAssignments,
      remaining: categoryRemaining,
      totalPoints,
      maxPoints,
      average: categoryAverage,
      weight: category.weight
    };
    
    // Add to total weight if we have assignments in this category
    if (maxPoints > 0) {
      totalWeightCovered += category.weight;
    }
  });
  
  // Calculate overall current grade
  let currentGradeWeighted = 0;
  
  Object.values(categoryStats).forEach(stats => {
    if (stats.average !== null) {
      // Scale by weight
      currentGradeWeighted += (stats.average / 100) * stats.weight;
    }
  });
  
  // Normalize by covered weight if needed
  const currentGrade = totalWeightCovered > 0 
    ? (currentGradeWeighted / totalWeightCovered) * 100
    : 0;
  
  // Calculate max possible grade (if all remaining is 100%)
  let maxPossibleGrade = currentGradeWeighted;
  let remainingWeight = 0;
  
  Object.values(categoryStats).forEach(stats => {
    // Count weight for categories with remaining assignments
    if (stats.remaining.length > 0) {
      const categoryRemainingWeight = stats.weight * (stats.remaining.length / 
        (stats.completed.length + stats.remaining.length || 1));
      
      remainingWeight += categoryRemainingWeight;
      maxPossibleGrade += categoryRemainingWeight;
    }
  });
  
  // Normalize max grade
  maxPossibleGrade = totalWeightCovered > 0 
    ? (maxPossibleGrade / (totalWeightCovered + remainingWeight)) * 100
    : 100;
  
  // Min grade (if all remaining is 0%)
  const minPossibleGrade = totalWeightCovered > 0 
    ? (currentGradeWeighted / (totalWeightCovered + remainingWeight)) * 100
    : 0;
  
  return {
    current_grade: currentGrade,
    current_percentage: currentGrade,
    max_possible_grade: maxPossibleGrade,
    min_possible_grade: minPossibleGrade,
    categorized_grades: categoryStats
  };
}

/**
 * Generate natural language analysis of grade stats
 * @param {Object} stats - Grade statistics
 * @returns {string} Analysis text
 */
function generateGradeAnalysis(stats) {
  const { currentGrade, maxPossibleGrade, minPossibleGrade, letterGrade } = stats;
  const analysis = [];
  
  analysis.push(`Current grade is ${currentGrade.toFixed(1)}% (${letterGrade})`);
  
  if (maxPossibleGrade > currentGrade) {
    analysis.push(`Maximum possible grade is ${maxPossibleGrade.toFixed(1)}%`);
  }
  
  if (minPossibleGrade < currentGrade) {
    analysis.push(`Minimum possible grade is ${minPossibleGrade.toFixed(1)}%`);
  }
  
  return analysis.join('. ');
}

/**
 * Format data specifically for AI prediction prompt
 * @param {Object} structuredData - Raw structured data
 * @param {Object} currentCalculation - Current grade calculation
 * @returns {Object} Formatted data for AI prompt
 */
function formatDataForAIPrediction(structuredData, currentCalculation) {
  return {
    // Course information
    course: structuredData.course || {
      name: "Unknown Course",
      instructor: "Unknown Instructor",
      creditHours: "3"
    },
    
    // Grade weights
    gradeWeights: structuredData.gradeWeights || [],
    
    // Current performance
    currentPerformance: {
      current_grade: currentCalculation.current_grade,
      letter_grade: currentCalculation.letter_grade,
      max_possible_grade: currentCalculation.max_possible_grade,
      min_possible_grade: currentCalculation.min_possible_grade
    },
    
    // Categorized grades with details
    categories: currentCalculation.categorized_grades,
    
    // Previous academic history
    academicHistory: structuredData.academicHistory || {
      overall_gpa: structuredData.gpa || "Unknown",
      relevantCourses: []
    },
    
    // Due dates and upcoming assignments
    dueDates: structuredData.dueDates || [],
    
    // Request format version (for future compatibility)
    formatVersion: "1.0"
  };
}

module.exports = {
  calculateExactGradeStatistics,
  generateGradeAnalysis,
  formatDataForAIPrediction
};
