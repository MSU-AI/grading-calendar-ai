import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Document {
  id: string;
  documentType: string;
  status: string;
  uploadedAt: any;
  filePath: string;
}

interface Prediction {
  grade: number | string;
  reasoning: string;
}

const DocumentUploader: React.FC = () => {
  const { currentUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('syllabus');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');

  const functions = getFunctions();
  const db = getFirestore();

  useEffect(() => {
    if (!currentUser) return;

    // Get user's documents
    const getUserDocuments = async () => {
      try {
        const getUserDocumentsFunction = httpsCallable(functions, 'get_user_documents');
        const result = await getUserDocumentsFunction({});
        if (result.data && (result.data as any).success) {
          setDocuments((result.data as any).documents || []);
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
      }
    };

    getUserDocuments();

    // Listen for latest predictions
    const userDocRef = doc(db, 'users', currentUser.uid);
    const predictionsRef = collection(userDocRef, 'predictions');
    const q = query(predictionsRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestPrediction = snapshot.docs[0].data();
        if (latestPrediction.prediction) {
          setPrediction(latestPrediction.prediction);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, functions, db]);

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
    setProcessingStatus('Uploading document...');
    
    try {
      // Convert file to base64
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      
      fileReader.onload = async () => {
        const base64String = fileReader.result as string;
        
        try {
          // Call upload_and_process_document cloud function
          const uploadAndProcessDocument = httpsCallable(functions, 'upload_and_process_document');
          const result = await uploadAndProcessDocument({
            documentType: documentType,
            documentBase64: base64String
          });
          
          const data = result.data as any;
          
          if (data.success) {
            setProcessingStatus('Document uploaded successfully. Extracting text...');
            
            // Call the new Node.js text extraction function
            const extractText = httpsCallable(functions, 'extractPdfText');
            const extractResult = await extractText({
              documentType: documentType
            });
            
            const extractData = extractResult.data as any;
            
            if (extractData.success) {
              setProcessingStatus(`Successfully extracted ${extractData.textLength} characters. Predicting grade...`);
              predictGrade();
            } else {
              setError('Text extraction failed: ' + (extractData.message || 'Unknown error'));
              setProcessingStatus('');
              setIsUploading(false);
            }
          } else {
            setError('Upload failed: ' + (data.message || 'Unknown error'));
            setProcessingStatus('');
            setIsUploading(false);
          }
        } catch (err: any) {
          setError('Error: ' + (err.message || 'Unknown error'));
          setProcessingStatus('');
          setIsUploading(false);
        }
      };
      
      fileReader.onerror = () => {
        setError('Error reading file');
        setProcessingStatus('');
        setIsUploading(false);
      };
    } catch (err: any) {
      setError('Error: ' + (err.message || 'Unknown error'));
      setProcessingStatus('');
      setIsUploading(false);
    }
  };

  const checkDocumentStatus = async (documentId: string) => {
    try {
      const getDocumentStatus = httpsCallable(functions, 'get_document_status');
      const result = await getDocumentStatus({ documentId });
      
      const data = result.data as any;
      
      if (data.success) {
        const status = data.document.status;
        
        if (status === 'processed') {
          setProcessingStatus('Document processed successfully. Predicting grade...');
          predictGrade();
        } else {
          // Check again after a delay
          setProcessingStatus(`Processing document... (${status})`);
          setTimeout(() => checkDocumentStatus(documentId), 3000);
        }
      } else {
        setError('Status check failed: ' + (data.message || 'Unknown error'));
        setProcessingStatus('');
        setIsUploading(false);
      }
    } catch (err: any) {
      setError('Error checking status: ' + (err.message || 'Unknown error'));
      setProcessingStatus('');
      setIsUploading(false);
    }
  };

  const predictGrade = async () => {
    setProcessingStatus('Predicting final grade...');
    
    try {
      // Get latest syllabus and transcript data
      const db = getFirestore();
      const userDocRef = doc(db, 'users', currentUser!.uid);
      
      const syllabiCollection = collection(userDocRef, 'syllabi');
      const syllabusQuery = query(syllabiCollection, orderBy('createdAt', 'desc'), limit(1));
      const syllabusSnapshot = await getDocs(syllabusQuery);
      
      const transcriptsCollection = collection(userDocRef, 'transcripts');
      const transcriptQuery = query(transcriptsCollection, orderBy('createdAt', 'desc'), limit(1));
      const transcriptSnapshot = await getDocs(transcriptQuery);
      
      if (syllabusSnapshot.empty) {
        setError('No syllabus found. Please upload a syllabus.');
        setProcessingStatus('');
        setIsUploading(false);
        return;
      }
      
      // Extract course data from syllabus
      const syllabusData = syllabusSnapshot.docs[0].data().data;
      
      // Extract GPA and final grade from transcript (if available)
      let gpa = '3.5'; // Default value
      let previousFinalGrade = '';
      
      if (!transcriptSnapshot.empty) {
        const transcriptData = transcriptSnapshot.docs[0].data().data;
        gpa = transcriptData.gpa || gpa;
        previousFinalGrade = transcriptData.final_grade || '';
      }
      
      // Construct course data for prediction
      const courseData = {
        course_name: syllabusData.course_name || 'Unknown Course',
        instructor: syllabusData.instructor || 'Unknown Instructor',
        grade_weights: syllabusData.grade_weights || [],
        assignments: syllabusData.assignments || [],
        gpa: gpa,
        final_grade: previousFinalGrade || 'N/A',
        due_dates: syllabusData.due_dates || [],
        credit_hours: syllabusData.credit_hours || '3'
      };
      
      // Call predict_final_grade cloud function
      const predictFinalGrade = httpsCallable(functions, 'predict_final_grade');
      const result = await predictFinalGrade({ courseData });
      
      const data = result.data as any;
      
      if (data.success) {
        setPrediction(data.prediction);
        setProcessingStatus('');
        setIsUploading(false);
        
        // Refresh documents list
        const getUserDocuments = httpsCallable(functions, 'get_user_documents');
        const docsResult = await getUserDocuments({});
        if (docsResult.data && (docsResult.data as any).success) {
          setDocuments((docsResult.data as any).documents || []);
        }
      } else {
        setError('Prediction failed: ' + (data.message || 'Unknown error'));
        setProcessingStatus('');
        setIsUploading(false);
      }
    } catch (err: any) {
      setError('Error predicting grade: ' + (err.message || 'Unknown error'));
      setProcessingStatus('');
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
          {processingStatus && <p style={styles.processing}>{processingStatus}</p>}
          
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
        
        {/* Recent Documents */}
        {documents.length > 0 && (
          <div style={styles.documentsSection}>
            <h2 style={styles.sectionTitle}>Recent Documents</h2>
            <ul style={styles.documentsList}>
              {documents.map((doc) => (
                <li key={doc.id} style={styles.documentItem}>
                  <span style={styles.documentType}>{doc.documentType}</span>
                  <span style={styles.documentStatus}>{doc.status}</span>
                  <span style={styles.documentDate}>
                    {doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'Unknown date'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
    borderBottom: '1px solid #eee',
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
  documentsSection: {
    marginTop: '20px',
  },
  documentsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  documentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #eee',
  },
  documentType: {
    textTransform: 'capitalize' as const,
    fontWeight: 'bold' as const,
    color: '#333',
  },
  documentStatus: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#e0e0e0',
    fontSize: '14px',
  },
  documentDate: {
    color: '#777',
    fontSize: '14px',
  },
};

export default DocumentUploader;
