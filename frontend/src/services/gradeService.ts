import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Define types for the calculation result
export interface GradeCalculationResult {
  success: boolean;
  calculation: {
    current_grade: number;
    current_percentage: number;
    letter_grade: string;
    max_possible_grade: number;
    min_possible_grade: number;
    categorized_grades: {
      [category: string]: {
        completed: Array<{ name: string; grade: number }>;
        remaining: string[];
        average: number | null;
        totalPoints: number;
        maxPoints: number;
        weight: number;
      };
    };
    analysis: string;
  };
  formatted_data?: any;
  message?: string;
}

// Define types for the prediction result
export interface GradePredictionResult {
  success: boolean;
  prediction: {
    grade: number;
    numerical_grade: number;
    letter_grade: string;
    current_percentage: number;
    max_possible_grade: number;
    min_possible_grade: number;
    reasoning: string;
    ai_prediction: {
      grade: string;
      numerical_grade: number;
      reasoning: string;
    };
    categorized_grades: {
      [category: string]: {
        completed: Array<{ name: string; grade: number }>;
        remaining: string[];
        average: number | null;
      };
    };
  };
  calculation?: any;
  predictionId?: string;
  message?: string;
}

// Calculate current grade
export const calculateCurrentGrade = async (options = {}): Promise<GradeCalculationResult> => {
  try {
    const calculateFunction = httpsCallable(functions, 'calculateCurrentGrade');
    const result = await calculateFunction(options);
    return result.data as GradeCalculationResult;
  } catch (error) {
    console.error('Error calculating grade:', error);
    throw error;
  }
};

// Predict final grade
export const predictFinalGrade = async (options = {}): Promise<GradePredictionResult> => {
  try {
    const predictFunction = httpsCallable(functions, 'predictFinalGrade');
    const result = await predictFunction(options);
    return result.data as GradePredictionResult;
  } catch (error) {
    console.error('Error predicting grade:', error);
    throw error;
  }
};
