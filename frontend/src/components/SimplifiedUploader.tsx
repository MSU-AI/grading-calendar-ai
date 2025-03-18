import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface Prediction {
  grade: number | string;
  reasoning: string;
}

const SimplifiedUploader: React.FC = () => {
  const { currentUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('syllabus');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const functions = getFunctions();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDocumentType(e.target.value);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !currentUser) return;
    
    setIsUploading(true);
    setError('');
    setStatus('Uploading document...');
    
    try {
      // Convert file to base64
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      
      fileReader.onload = async () => {
        const base64String = fileReader.result as string;
        
        try {
          // Use predictGrades function for both upload and prediction
          const predictGrades = httpsCallable(functions, 'predictGrades');
          const result = await predictGrades({
            documentType: documentType,
            documentBase64: base64String
          });
          
          const data = result.data as any;
          
          if (data.success) {
            setStatus('Document uploaded successfully. Processing...');
            
            if (data.prediction) {
              setPrediction({
                grade: data.prediction.grade,
                reasoning: data.prediction.reasoning
              });
            }
            setStatus('');
            setIsUploading(false);
          } else {
            setError('Upload failed: ' + (data.message || 'Unknown error'));
            setStatus('');
            setIsUploading(false);
          }
        } catch (err: any) {
          setError('Error: ' + (err.message || 'Unknown error'));
          setStatus('');
          setIsUploading(false);
        }
      };
      
      fileReader.onerror = () => {
        setError('Error reading file');
        setStatus('');
        setIsUploading(false);
      };
    } catch (err: any) {
      setError('Error: ' + (err.message || 'Unknown error'));
      setStatus('');
      setIsUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Academic Performance Predictor</h1>
        
        {/* Prediction Display */}
        <div style={styles.predictionSection}>
          <h2 style={styles.sectionTitle}>Predicted Grade</h2>
          
          {prediction ? (
            <div style={styles.predictionResult}>
              <div style={styles.gradeCircle}>
                {typeof prediction.grade === 'number' 
                  ? prediction.grade.toFixed(1) 
                  : prediction.grade}
              </div>
              <p style={styles.reasoning}><strong>Analysis:</strong> {prediction.reasoning}</p>
            </div>
          ) : (
            <p style={styles.noPrediction}>
              Upload a syllabus to get your predicted grade
            </p>
          )}
        </div>
        
        {/* Document Upload */}
        <div style={styles.uploadSection}>
          <h2 style={styles.sectionTitle}>Upload Document</h2>
          
          {error && <p style={styles.error}>{error}</p>}
          {status && <p style={styles.processing}>{status}</p>}
          
          <form onSubmit={handleUpload} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="documentType" style={styles.label}>Document Type:</label>
              <select 
                id="documentType"
                value={documentType}
                onChange={handleTypeChange}
                style={styles.select}
                disabled={isUploading}
              >
                <option value="syllabus">Syllabus</option>
                <option value="transcript">Transcript</option>
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label htmlFor="fileInput" style={styles.label}>Select PDF:</label>
              <input
                id="fileInput"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={styles.fileInput}
                disabled={isUploading}
              />
            </div>
            
            <button 
              type="submit" 
              style={styles.button}
              disabled={!file || isUploading}
            >
              {isUploading ? 'Processing...' : 'Upload Document'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    padding: '30px',
    width: '100%',
    maxWidth: '800px',
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: '30px',
    color: '#333',
    fontSize: '28px',
  },
  predictionSection: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  sectionTitle: {
    fontSize: '20px',
    marginBottom: '15px',
    color: '#444',
  },
  predictionResult: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '60px',
    backgroundColor: '#4CAF50',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 'bold' as const,
    marginBottom: '15px',
  },
  reasoning: {
    fontSize: '16px',
    lineHeight: '1.5',
    color: '#555',
    maxWidth: '600px',
    margin: '0 auto',
  },
  noPrediction: {
    fontSize: '16px',
    color: '#777',
    fontStyle: 'italic',
  },
  uploadSection: {
    marginBottom: '30px',
    padding: '20px',
    borderTop: '1px solid #eee',
  },
  error: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  processing: {
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#555',
  },
  select: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
  },
  fileInput: {
    padding: '10px 0',
  },
  button: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    marginTop: '10px',
    fontWeight: 'bold' as const,
  },
};

export default SimplifiedUploader;
