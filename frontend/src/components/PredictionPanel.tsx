import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { calculateCurrentGrade, predictFinalGrade } from '../services/gradeService';
import { Alert, Button } from './common/index';
import FrostedGlass from './common/FrostedGlass';

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
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  
  const db = getFirestore();

  useEffect(() => {
    // Add animation effects
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .prediction-fade-in {
        animation: predictionFadeIn 0.6s ease-out forwards;
      }
      
      @keyframes predictionFadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .prediction-button {
        transition: all 0.3s ease;
      }
      
      .prediction-button:hover:not(:disabled) {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(97, 87, 255, 0.3);
      }
      
      .grade-circle {
        animation: pulse 2s infinite ease-in-out;
      }
      
      @keyframes glow {
        0% { box-shadow: 0 0 10px rgba(97, 87, 255, 0.5); }
        50% { box-shadow: 0 0 20px rgba(97, 87, 255, 0.8); }
        100% { box-shadow: 0 0 10px rgba(97, 87, 255, 0.5); }
      }
      
      .category-item {
        transition: all 0.3s ease;
      }
      
      .category-item:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      }
      
      .footer-card-hover {
        transition: all 0.3s ease;
      }
      
      .footer-card-hover:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 25px rgba(0, 0, 0, 0.15);
        background-color: rgba(97, 87, 255, 0.15);
      }
    `;
    document.head.appendChild(styleTag);
    
    // Trigger fade-in animation
    setTimeout(() => {
      setFadeIn(true);
    }, 300);

    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

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
    <div 
      className={fadeIn ? 'prediction-fade-in' : ''}
      style={{
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease'
      }}
    >
      <FrostedGlass 
        variant="dark" 
        opacity={0.15} 
        blur={12}
        background="rgba(19, 10, 57, 0.4)"
        style={styles.header}
        elevation="medium"
        border="rgba(174, 185, 225, 0.2)"
      >
        <h2 style={styles.title}>Grade Prediction</h2>
        <p style={styles.subtitle}>Get insights into your final grade based on current performance</p>
      </FrostedGlass>
      
      {error && <Alert type="error" style={styles.alert}>{error}</Alert>}
      {status && <Alert type="info" style={styles.alert}>{status}</Alert>}

      <FrostedGlass
        variant="dark"
        opacity={0.15} 
        blur={12}
        background="rgba(19, 10, 57, 0.4)"
        style={styles.predictSection}
        elevation="medium"
        border="rgba(174, 185, 225, 0.2)"
      >
        <Button 
          onClick={handlePredict} 
          disabled={isPredicting}
          variant="primary"
          style={styles.predictButton}
          className="prediction-button"
        >
          {isPredicting ? (
            <>
              <span className="spinner"></span>
              Generating Prediction...
            </>
          ) : 'Predict My Grade'}
        </Button>
        <p style={styles.predictInfo}>
          Our AI will analyze your uploaded documents and provide a personalized grade prediction
        </p>
      </FrostedGlass>

      {predictionResult && predictionResult.categorized_grades && (
        <FrostedGlass
          variant="dark"
          opacity={0.15}
          blur={12}
          background="rgba(19, 10, 57, 0.4)"
          style={styles.predictionResult}
          elevation="medium"
          border="rgba(174, 185, 225, 0.2)"
        >
          <div style={styles.resultHeader}>
            <h3 style={styles.resultTitle}>Your Grade Prediction</h3>
          </div>
          
          <div style={styles.gradeDisplayWrapper}>
            <div style={styles.gradeDisplay}>
              <div style={styles.gradeCircle} className="grade-circle">
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
            
            <FrostedGlass
              variant="dark"
              opacity={0.15}
              blur={8}
              style={styles.gradeRangeSection}
              className="footer-card-hover"
              border="rgba(174, 185, 225, 0.2)"
            >
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
            </FrostedGlass>
          </div>
          
          <FrostedGlass
            variant="dark"
            opacity={0.15}
            blur={8}
            style={styles.reasoningSection}
            className="footer-card-hover"
            border="rgba(174, 185, 225, 0.2)"
          >
            <h4 style={styles.sectionTitle}>Analysis</h4>
            <p style={styles.reasoning}>{predictionResult.reasoning || 'No analysis available'}</p>
          </FrostedGlass>
          
          {predictionResult.ai_prediction && (
            <FrostedGlass
              variant="accent"
              opacity={0.15}
              blur={8}
              style={styles.aiPrediction}
              className="footer-card-hover"
              border="rgba(97, 87, 255, 0.3)"
            >
              <h4 style={styles.sectionTitle}>AI Prediction</h4>
              <p style={styles.aiGrade}>
                Predicted Grade: <span style={styles.aiGradeValue}>{predictionResult.ai_prediction.grade} ({predictionResult.ai_prediction.numerical_grade.toFixed(1)}%)</span>
              </p>
              <p style={styles.aiReasoning}>{predictionResult.ai_prediction.reasoning || 'No AI reasoning available'}</p>
            </FrostedGlass>
          )}
          
          <div style={styles.categoriesSection}>
            <h4 style={styles.sectionTitle}>Grade Breakdown by Category</h4>
            {Object.entries(predictionResult.categorized_grades).map(([category, data]) => (
              <FrostedGlass
                key={category}
                variant="dark"
                opacity={0.15}
                blur={8}
                style={styles.categoryItem}
                className="footer-card-hover category-item"
                border="rgba(174, 185, 225, 0.2)"
              >
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
              </FrostedGlass>
            ))}
          </div>
        </FrostedGlass>
      )}
      
      {/* Show a message if prediction failed but we're not in predicting state */}
      {!predictionResult && !isPredicting && !error && (
        <FrostedGlass
          variant="dark"
          opacity={0.15}
          blur={12}
          background="rgba(19, 10, 57, 0.4)"
          style={styles.emptyState}
          elevation="medium"
          border="rgba(174, 185, 225, 0.2)"
        >
          <div style={styles.emptyStateIcon}>📊</div>
          <h3 style={styles.emptyStateTitle}>No Predictions Yet</h3>
          <p style={styles.emptyStateText}>
            Click the "Predict My Grade" button above to generate a personalized grade prediction
            based on your uploaded documents.
          </p>
        </FrostedGlass>
      )}
    </div>
  );
};

const styles = {
  header: {
    padding: '25px',
    marginBottom: '20px',
    borderRadius: '12px',
  },
  title: {
    margin: 0,
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
  alert: {
    marginBottom: '20px',
  },
  predictSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '30px 20px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  predictButton: {
    padding: '15px 30px',
    fontSize: '18px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  predictInfo: {
    color: '#AEB9E1',
    marginTop: '15px',
    textAlign: 'center' as const,
    maxWidth: '500px',
  },
  predictionResult: {
    padding: '25px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  resultHeader: {
    marginBottom: '20px',
  },
  resultTitle: {
    color: '#f0f0f0',
    margin: '0 0 5px 0',
    fontSize: '20px',
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  gradeDisplayWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    marginBottom: '20px',
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
    boxShadow: '0 0 15px rgba(97, 87, 255, 0.5)',
  },
  gradePercentage: {
    fontSize: '24px',
    color: '#f0f0f0',
    fontWeight: 'bold',
  },
  gradeLabel: {
    fontSize: '16px',
    color: '#AEB9E1',
    marginTop: '5px',
  },
  gradeRangeSection: {
    padding: '15px',
    borderRadius: '12px',
  },
  rangeTitle: {
    color: '#f0f0f0',
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
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
    color: '#AEB9E1',
    padding: '0 10px',
  },
  rangeLabel: {
    display: 'block',
    color: '#AEB9E1',
    fontSize: '14px',
    marginBottom: '5px',
  },
  rangeValue: {
    display: 'block',
    color: '#f0f0f0',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  reasoningSection: {
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  sectionTitle: {
    color: '#f0f0f0',
    margin: '0 0 15px 0',
    fontSize: '18px',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  reasoning: {
    lineHeight: '1.6',
    color: '#f0f0f0',
    margin: 0,
  },
  aiPrediction: {
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  aiGrade: {
    fontWeight: 500,
    color: '#f0f0f0',
    margin: '0 0 10px 0',
  },
  aiGradeValue: {
    color: '#6157FF',
    fontWeight: 'bold',
  },
  aiReasoning: {
    lineHeight: '1.6',
    color: '#f0f0f0',
    margin: 0,
  },
  categoriesSection: {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  categoryItem: {
    padding: '15px',
    borderRadius: '12px',
  },
  categoryTitle: {
    margin: '0 0 10px 0',
    color: '#f0f0f0',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  categoryStats: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#AEB9E1',
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
  emptyState: {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
  },
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '15px',
  },
  emptyStateTitle: {
    margin: '0 0 10px 0',
    color: '#f0f0f0',
    fontSize: '18px',
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  emptyStateText: {
    textAlign: 'center' as const,
    maxWidth: '400px',
    lineHeight: 1.5,
    color: '#AEB9E1',
  }
};

export default PredictionPanel;