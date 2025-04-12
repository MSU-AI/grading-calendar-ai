import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { calculateCurrentGrade, predictFinalGrade } from '../services/gradeService';

interface Prediction {
  grade: number | string;
  current_percentage: number;
  letter_grade: string;
  max_possible_grade: number;
  min_possible_grade: number;
  reasoning: string;
  ai_prediction?: {
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
}

const PredictionPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  const db = getFirestore();

  // Listen for predictions
  useEffect(() => {
    if (!currentUser) return;

    // Listen for the latest prediction
    const userDocRef = doc(db, 'users', currentUser.uid);
    const predictionsRef = collection(userDocRef, 'predictions');
    const q = query(predictionsRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestPrediction = snapshot.docs[0].data();
        if (latestPrediction.prediction) {
          setPredictionResult(latestPrediction.prediction);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, db]);

  const handlePredict = async () => {
    if (!currentUser) {
      setError('You must be logged in to generate predictions');
      return;
    }
    
    // Check if we have formatted data
    try {
      const formattedDataDocRef = doc(db, 'users', currentUser.uid, 'data', 'formatted_data');
      const formattedDataDoc = await getDoc(formattedDataDocRef);
      
      if (!formattedDataDoc.exists()) {
        setError('No formatted data found. Please upload and process documents first.');
        return;
      }
    } catch (err) {
      console.error('Error checking for formatted data:', err);
      // Continue anyway, the calculation function will handle this error
    }

    setIsPredicting(true);
    setError(null);
    setStatus('Generating prediction...');

    try {
      // First get the current grade calculation
      const calculationResult: any = await calculateCurrentGrade({
        useStoredData: true,
        storeResult: true
      });
      
      if (!calculationResult.success) {
        throw new Error(calculationResult.message || 'Failed to calculate current grade');
      }
      
      // Then get the prediction using the calculation
      const predictionResult: any = await predictFinalGrade({
        useStoredData: true,
        currentCalculation: calculationResult.calculation
      });
      
      if (!predictionResult.success) {
        throw new Error(predictionResult.message || 'Failed to generate prediction');
      }
      
      // Make sure we have valid data before setting state
      if (!predictionResult.prediction || 
          !predictionResult.prediction.categorized_grades ||
          typeof predictionResult.prediction.current_percentage !== 'number') {
        throw new Error('Received invalid prediction data format');
      }
      
      setPredictionResult(predictionResult.prediction);
      setStatus('Prediction generated successfully!');
    } catch (error: any) {
      console.error('Prediction error:', error);
      setError(error.message || 'An error occurred during prediction');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Grade Prediction</h2>
        <p style={styles.subtitle}>Get insights into your final grade based on current performance</p>
      </div>
      
      {error && <div style={styles.error}>{error}</div>}
      {status && <div style={styles.status}>{status}</div>}

      <div style={styles.predictSection}>
        <button 
          onClick={handlePredict} 
          disabled={isPredicting}
          style={isPredicting ? styles.predictButtonDisabled : styles.predictButton}
        >
          {isPredicting ? (
            <>
              <span style={styles.spinner}></span>
              Generating Prediction...
            </>
          ) : 'Predict My Grade'}
        </button>
        <p style={styles.predictInfo}>
          Our AI will analyze your uploaded documents and provide a personalized grade prediction
        </p>
      </div>

      {predictionResult && predictionResult.categorized_grades && (
        <div style={styles.predictionResult}>
          <div style={styles.resultHeader}>
            <h3 style={styles.resultTitle}>Your Grade Prediction</h3>
          </div>
          
          <div style={styles.gradeDisplayWrapper}>
            <div style={styles.gradeDisplay}>
              <div style={styles.gradeCircle}>
                {predictionResult.letter_grade || 'N/A'}
              </div>
              <div>
                <div style={styles.gradePercentage}>
                  {typeof predictionResult.current_percentage === 'number' 
                    ? `${predictionResult.current_percentage.toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div style={styles.gradeLabel}>Current Grade</div>
              </div>
            </div>
            
            <div style={styles.gradeRangeSection}>
              <h4 style={styles.rangeTitle}>Possible Range</h4>
              <div style={styles.gradeRange}>
                <div style={styles.rangeItem}>
                  <span style={styles.rangeLabel}>Minimum</span>
                  <span style={styles.rangeValue}>
                    {typeof predictionResult.min_possible_grade === 'number' 
                      ? `${predictionResult.min_possible_grade.toFixed(1)}%` 
                      : 'N/A'}
                  </span>
                </div>
                <div style={styles.rangeMiddle}>to</div>
                <div style={styles.rangeItem}>
                  <span style={styles.rangeLabel}>Maximum</span>
                  <span style={styles.rangeValue}>
                    {typeof predictionResult.max_possible_grade === 'number' 
                      ? `${predictionResult.max_possible_grade.toFixed(1)}%` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div style={styles.reasoningSection}>
            <h4 style={styles.sectionTitle}>Analysis</h4>
            <p style={styles.reasoning}>{predictionResult.reasoning || 'No analysis available'}</p>
          </div>
          
          {predictionResult.ai_prediction && (
            <div style={styles.aiPrediction}>
              <h4 style={styles.sectionTitle}>AI Prediction</h4>
              <p style={styles.aiGrade}>
                Predicted Grade: <span style={styles.aiGradeValue}>{predictionResult.ai_prediction.grade} ({predictionResult.ai_prediction.numerical_grade.toFixed(1)}%)</span>
              </p>
              <p style={styles.aiReasoning}>{predictionResult.ai_prediction.reasoning || 'No AI reasoning available'}</p>
            </div>
          )}
          
          <div style={styles.categoriesSection}>
            <h4 style={styles.sectionTitle}>Grade Breakdown by Category</h4>
            {Object.entries(predictionResult.categorized_grades).map(([category, data]) => (
              <div key={category} style={styles.categoryItem}>
                <h5 style={styles.categoryTitle}>{category}</h5>
                {data && data.average !== null && (
                  <div style={styles.categoryStats}>
                    <span style={styles.categoryAverage}>
                      Average: <span style={styles.categoryValue}>{data.average.toFixed(1)}%</span>
                    </span>
                    <span style={styles.categoryProgress}>
                      <span style={styles.categoryValue}>{data.completed?.length || 0}</span> completed, 
                      <span style={styles.categoryValue}> {data.remaining?.length || 0}</span> remaining
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Show a message if prediction failed but we're not in predicting state */}
      {!predictionResult && !isPredicting && !error && (
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>📊</div>
          <h3 style={styles.emptyStateTitle}>No Predictions Yet</h3>
          <p style={styles.emptyStateText}>
            Click the "Predict My Grade" button above to generate a personalized grade prediction
            based on your uploaded documents.
          </p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px',
    background: 'linear-gradient(135deg, #130A39 0%, #1F0F5C 50%, #341873 100%)',
    color: 'white',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    color: 'white',
    fontSize: '24px',
    fontWeight: 700,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '10px 0 0 0',
    color: '#AEB9E1',
    fontSize: '16px',
  },
  predictSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    margin: '30px 0',
    padding: '0 20px',
  },
  predictButton: {
    backgroundColor: '#6157FF',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 4px 12px rgba(97, 87, 255, 0.3)',
  },
  predictButtonDisabled: {
    backgroundColor: '#9A8BD0',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'not-allowed',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    opacity: 0.7,
  },
  spinner: {
    display: 'inline-block',
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255,255,255,.3)',
    borderRadius: '50%',
    borderTopColor: 'white',
    animation: 'spin 1s ease-in-out infinite',
  },
  predictInfo: {
    color: '#666',
    marginTop: '15px',
    textAlign: 'center' as const,
    maxWidth: '500px',
  },
  predictionResult: {
    padding: '0 20px 20px 20px',
    borderRadius: '8px',
    marginTop: '10px',
  },
  resultHeader: {
    marginBottom: '20px',
  },
  resultTitle: {
    color: '#1F0F5C',
    margin: '0 0 5px 0',
    fontSize: '20px',
  },
  gradeDisplayWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  gradeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '25px',
  },
  gradeCircle: {
    width: '100px',
    height: '100px',
    background: 'linear-gradient(135deg, #7063A7, #6157FF)',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontSize: '36px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(97, 87, 255, 0.3)',
  },
  gradePercentage: {
    fontSize: '24px',
    color: '#1F0F5C',
    fontWeight: 'bold',
  },
  gradeLabel: {
    fontSize: '16px',
    color: '#666',
    marginTop: '5px',
  },
  gradeRangeSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  rangeTitle: {
    color: '#1F0F5C',
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: 600,
  },
  gradeRange: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '10px',
  },
  rangeItem: {
    textAlign: 'center' as const,
    flex: 1,
  },
  rangeMiddle: {
    color: '#666',
    padding: '0 10px',
  },
  rangeLabel: {
    display: 'block',
    color: '#666',
    fontSize: '14px',
    marginBottom: '5px',
  },
  rangeValue: {
    display: 'block',
    color: '#1F0F5C',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  reasoningSection: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    color: '#1F0F5C',
    margin: '0 0 15px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  reasoning: {
    lineHeight: '1.6',
    color: '#333',
    margin: 0,
  },
  aiPrediction: {
    padding: '20px',
    backgroundColor: '#F5F7FF',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid rgba(97, 87, 255, 0.1)',
  },
  aiGrade: {
    fontWeight: 500,
    color: '#333',
    margin: '0 0 10px 0',
  },
  aiGradeValue: {
    color: '#6157FF',
    fontWeight: 'bold',
  },
  aiReasoning: {
    lineHeight: '1.6',
    color: '#333',
    margin: 0,
  },
  categoriesSection: {
    marginTop: '20px',
  },
  categoryItem: {
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    marginBottom: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  categoryTitle: {
    margin: '0 0 10px 0',
    color: '#1F0F5C',
    fontWeight: 600,
  },
  categoryStats: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#666',
    flexWrap: 'wrap' as const,
    gap: '10px',
  },
  categoryAverage: {
    fontWeight: 500,
  },
  categoryValue: {
    color: '#6157FF',
    fontWeight: 'bold',
  },
  categoryProgress: {
    fontSize: '14px',
  },
  error: {
    color: 'white',
    backgroundColor: '#f44336',
    padding: '12px 16px',
    margin: '0 20px 15px 20px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 500,
  },
  status: {
    color: 'white',
    backgroundColor: '#2196F3',
    padding: '12px 16px',
    margin: '0 20px 15px 20px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 500,
  },
  emptyState: {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    margin: '20px',
  },
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '15px',
  },
  emptyStateTitle: {
    margin: '0 0 10px 0',
    color: '#1F0F5C',
    fontSize: '18px',
  },
  emptyStateText: {
    textAlign: 'center' as const,
    maxWidth: '400px',
    lineHeight: 1.5,
  }
};

export default PredictionPanel;