import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SimplifiedUploader from './SimplifiedUploader';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PredictionResult {
  predictedGrade: string;
  confidence: number;
  factors: string[];
}

const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setIsPredicting(true);
    setError(null);
    setPredictionResult(null);

    try {
      const functions = getFunctions();
      // Use the predictGrades function
      const predictGrades = httpsCallable(functions, 'predictGrades');
      
      const result = await predictGrades({});
      const data = result.data as any;
      
      if (data.success && data.prediction) {
        setPredictionResult({
          predictedGrade: data.prediction.grade,
          confidence: 0.85, // Default confidence level
          factors: [
            "Previous academic performance",
            "Course difficulty level",
            "Assignment completion rate",
            "Engagement with course materials"
          ]
        });
      } else {
        setError(data.message || 'Failed to generate prediction');
      }
    } catch (error: any) {
      console.error('Prediction error:', error);
      setError(error.message || 'An error occurred during prediction');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.welcomeText}>Welcome, {currentUser?.displayName || currentUser?.email}</h2>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </div>
      
      <SimplifiedUploader />

      <div style={styles.predictionSection}>
        <button 
          onClick={handlePredict} 
          disabled={isPredicting}
          style={styles.predictButton}
        >
          {isPredicting ? 'Generating Prediction...' : 'Predict Grade'}
        </button>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {predictionResult && (
          <div style={styles.predictionResult}>
            <h3>Prediction Result</h3>
            <p style={styles.grade}>Predicted Grade: {predictionResult.predictedGrade}</p>
            <p>Confidence: {(predictionResult.confidence * 100).toFixed(1)}%</p>
            <div style={styles.factors}>
              <h4>Contributing Factors:</h4>
              <ul>
                {predictionResult.factors.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#2196F3',
    color: 'white',
  },
  welcomeText: {
    margin: 0,
    fontSize: '1.2rem',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'white',
    color: '#2196F3',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
  },
  predictionSection: {
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
  },
  predictButton: {
    padding: '1rem 2rem',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: 'bold' as const,
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#45a049',
    },
    ':disabled': {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    },
  },
  error: {
    color: '#f44336',
    padding: '1rem',
    backgroundColor: '#ffebee',
    borderRadius: '4px',
    width: '100%',
    maxWidth: '600px',
    textAlign: 'center' as const,
  },
  predictionResult: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '600px',
  },
  grade: {
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
    color: '#2196F3',
    marginBottom: '1rem',
  },
  factors: {
    marginTop: '1rem',
  },
};

export default Dashboard;
