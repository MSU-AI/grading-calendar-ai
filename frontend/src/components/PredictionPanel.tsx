import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';

interface Document {
  id: string;
  documentType: string;
  status: string;
}

interface Prediction {
  grade: number | string;
  reasoning: string;
  confidence?: number;
}

const PredictionPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<Prediction | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  const functions = getFunctions();
  const db = getFirestore();

  // Listen for documents and predictions
  useEffect(() => {
    if (!currentUser) return;

    // Fetch user documents
    const fetchDocuments = async () => {
      try {
        const getUserDocuments = httpsCallable(functions, 'getUserDocuments');
        const result = await getUserDocuments();
        
        if ((result.data as any).success) {
          setDocuments((result.data as any).documents || []);
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
      }
    };

    fetchDocuments();

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
  }, [currentUser, functions, db]);

  const handlePredict = async () => {
    // Check if we have enough documents
    const processedDocs = documents.filter(doc => doc.status === 'processed');
    if (processedDocs.length === 0) {
      setError('No processed documents found. Please upload at least one document first.');
      return;
    }

    setIsPredicting(true);
    setError(null);
    setStatus('Generating prediction...');

    try {
      // Call the predictGrades function
      const predictGrades = httpsCallable(functions, 'predictGrades');
      const result = await predictGrades({});
      
      const data = result.data as any;
      
      if (data.success && data.prediction) {
        setPredictionResult(data.prediction);
        setStatus('Prediction generated successfully!');
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

  // Determine if we can make a prediction based on document status
  const canPredict = documents.some(doc => doc.status === 'processed');
  
  // Get count of documents by type
  const docCounts = documents.reduce((acc: Record<string, number>, doc) => {
    acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Grade Prediction</h2>
      
      <div style={styles.documentSummary}>
        <h3>Available Documents</h3>
        <div style={styles.documentStats}>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Syllabus:</span>
            <span style={styles.statValue}>{docCounts.syllabus || 0}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Transcript:</span>
            <span style={styles.statValue}>{docCounts.transcript || 0}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Grades:</span>
            <span style={styles.statValue}>{docCounts.grades || 0}</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statLabel}>Other:</span>
            <span style={styles.statValue}>{docCounts.other || 0}</span>
          </div>
        </div>
      </div>
      
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
        
        {!canPredict && documents.length > 0 && (
          <p style={styles.waitingMessage}>
            Waiting for document processing to complete...
          </p>
        )}
        
        {documents.length === 0 && (
          <p style={styles.noDocumentsMessage}>
            Please upload documents first to enable prediction
          </p>
        )}
      </div>

      {predictionResult && (
        <div style={styles.predictionResult}>
          <h3>Prediction Result</h3>
          <div style={styles.gradeDisplay}>
            <div style={styles.gradeCircle}>
              {typeof predictionResult.grade === 'number' 
                ? predictionResult.grade.toFixed(1) 
                : predictionResult.grade}
            </div>
            <div style={styles.gradeLabel}>Predicted Grade</div>
          </div>
          
          <div style={styles.reasoningSection}>
            <h4>Analysis</h4>
            <p style={styles.reasoning}>{predictionResult.reasoning}</p>
          </div>
          
          {predictionResult.confidence && (
            <div style={styles.confidenceBar}>
              <div style={styles.confidenceLabel}>
                Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
              </div>
              <div style={styles.confidenceBarOuter}>
                <div 
                  style={{
                    ...styles.confidenceBarInner,
                    width: `${predictionResult.confidence * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
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
  confidenceBar: {
    marginTop: '15px',
  },
  confidenceLabel: {
    marginBottom: '5px',
    color: '#555',
  },
  confidenceBarOuter: {
    width: '100%',
    height: '10px',
    backgroundColor: '#e0e0e0',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  confidenceBarInner: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '5px',
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

export default PredictionPanel;
