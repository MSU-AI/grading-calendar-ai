import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { calculateCurrentGrade, predictFinalGrade } from '../services/gradeService';
import DocumentProcessingStatus from './DocumentProcessingStatus';

interface Document {
  id: string;
  documentType: string;
  status: string;
}

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
  const [documents] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [processingComplete, setProcessingComplete] = useState<boolean>(false);
  
  const db = getFirestore();

  // Listen for documents and predictions
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

  // Determine if we can make a prediction based on document status or processing completion
  const canPredict = documents.some(doc => doc.status === 'processed') || processingComplete;
  
  // We'll keep this comment to document what we're calculating, but remove the unused variable
  // Get count of documents by type
  // const docCounts = documents.reduce((acc: Record<string, number>, doc) => {
  //   acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
  //   return acc;
  // }, {});

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Grade Prediction</h2>
      
      <DocumentProcessingStatus onProcessingComplete={() => setProcessingComplete(true)} />
      
      {error && <p style={styles.error}>{error}</p>}
      {status && <p style={styles.status}>{status}</p>}

      <div style={styles.predictSection}>
        <button 
          onClick={handlePredict} 
          disabled={isPredicting || !canPredict}
          style={canPredict ? styles.predictButton : styles.predictButtonDisabled}
        >
          {isPredicting ? 'Generating Prediction...' : 'Predict Grade'}
        </button>
      </div>

      {predictionResult && predictionResult.categorized_grades && (
        <div style={styles.predictionResult}>
          <h3>Prediction Result</h3>
          <div style={styles.gradeDisplay}>
            <div style={styles.gradeCircle}>
              {predictionResult.letter_grade || 'N/A'}
            </div>
            <div style={styles.gradePercentage}>
              {typeof predictionResult.current_percentage === 'number' 
                ? `${predictionResult.current_percentage.toFixed(1)}%`
                : 'N/A'}
            </div>
            <div style={styles.gradeLabel}>Current Grade</div>
          </div>
          
          <div style={styles.gradeRangeSection}>
            <h4>Grade Range</h4>
            <div style={styles.gradeRange}>
              <div style={styles.rangeItem}>
                <span style={styles.rangeLabel}>Minimum:</span>
                <span style={styles.rangeValue}>
                  {typeof predictionResult.min_possible_grade === 'number' 
                    ? `${predictionResult.min_possible_grade.toFixed(1)}%` 
                    : 'N/A'}
                </span>
              </div>
              <div style={styles.rangeItem}>
                <span style={styles.rangeLabel}>Maximum:</span>
                <span style={styles.rangeValue}>
                  {typeof predictionResult.max_possible_grade === 'number' 
                    ? `${predictionResult.max_possible_grade.toFixed(1)}%` 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          <div style={styles.reasoningSection}>
            <h4>Analysis</h4>
            <p style={styles.reasoning}>{predictionResult.reasoning || 'No analysis available'}</p>
            {predictionResult.ai_prediction && (
              <div style={styles.aiPrediction}>
                <h4>AI Prediction</h4>
                <p><strong>Predicted Grade: {predictionResult.ai_prediction.grade} ({predictionResult.ai_prediction.numerical_grade.toFixed(1)}%)</strong></p>
                <p>{predictionResult.ai_prediction.reasoning || 'No AI reasoning available'}</p>
              </div>
            )}
          </div>
          
          <div style={styles.categoriesSection}>
            <h4>Grade Breakdown by Category</h4>
            {Object.entries(predictionResult.categorized_grades).map(([category, data]) => (
              <div key={category} style={styles.categoryItem}>
                <h5 style={styles.categoryTitle}>{category}</h5>
                {data && data.average !== null && (
                  <div style={styles.categoryStats}>
                    <span style={styles.categoryAverage}>
                      Average: {data.average.toFixed(1)}%
                    </span>
                    <span style={styles.categoryProgress}>
                      Progress: {data.completed?.length || 0} completed, {data.remaining?.length || 0} remaining
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
        <p style={styles.noDocumentsMessage}>No prediction data available. Try generating a prediction.</p>
      )}
    </div>
  );
};

const baseStyles = {
  container: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    marginTop: 0,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  documentSummary: {
    marginBottom: '20px',
  },
  documentStats: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '15px',
    marginTop: '10px',
  },
  statItem: {
    backgroundColor: '#f5f5f5',
    padding: '10px 15px',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minWidth: '100px',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '5px',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#333',
  },
  predictSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    margin: '20px 0',
  },
  predictButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
  },
  predictButtonDisabled: {
    backgroundColor: '#cccccc',
    color: '#666666',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'not-allowed',
    fontWeight: 'bold',
  },
  waitingMessage: {
    color: '#ff9800',
    marginTop: '10px',
    fontStyle: 'italic',
  },
  noDocumentsMessage: {
    color: '#666',
    marginTop: '10px',
    fontStyle: 'italic',
  },
  predictionResult: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    marginTop: '20px',
  },
  gradeDisplay: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginBottom: '20px',
  },
  gradeCircle: {
    width: '120px',
    height: '120px',
    backgroundColor: '#4CAF50',
    borderRadius: '60px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontSize: '38px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  gradeLabel: {
    fontSize: '16px',
    color: '#555',
  },
  reasoningSection: {
    marginBottom: '20px',
  },
  reasoning: {
    lineHeight: '1.6',
    color: '#333',
  },
  error: {
    color: '#f44336',
    backgroundColor: '#ffebee',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  status: {
    color: '#2196F3',
    backgroundColor: '#e3f2fd',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
};

const styles = {
  ...baseStyles,
  gradePercentage: {
    fontSize: '24px',
    color: '#666',
    marginTop: '5px',
  },
  gradeRangeSection: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  gradeRange: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: '10px',
  },
  rangeItem: {
    textAlign: 'center' as const,
  },
  rangeLabel: {
    display: 'block',
    color: '#666',
    fontSize: '14px',
    marginBottom: '5px',
  },
  rangeValue: {
    display: 'block',
    color: '#333',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  aiPrediction: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
  },
  categoriesSection: {
    marginTop: '20px',
  },
  categoryItem: {
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    marginBottom: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  categoryTitle: {
    margin: '0 0 10px 0',
    color: '#333',
  },
  categoryStats: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#666',
  },
  categoryAverage: {
    fontWeight: 'bold',
  },
  categoryProgress: {
    fontSize: '14px',
  }
};

export default PredictionPanel;
