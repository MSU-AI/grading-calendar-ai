import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getFirestore, collection, query, onSnapshot, doc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import DOCUMENT_TYPES, { DocumentType } from '../constants/documentTypes';
import { Alert, Button, ProgressBar, StatusBadge } from './common/index';
import FrostedGlass from './common/FrostedGlass';

interface Document {
  id: string;
  documentType: DocumentType;
  status: string;
  name: string;
  error?: string;
}

interface DocumentProcessingStatusProps {
  onProcessingComplete?: () => void;
}

const DocumentProcessingStatus: React.FC<DocumentProcessingStatusProps> = ({ onProcessingComplete }) => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingComplete, setProcessingComplete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  
  const db = getFirestore();
  const functions = getFunctions();

  useEffect(() => {
    // Add animation effects
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .process-fade-in {
        animation: processFadeIn 0.6s ease-out forwards;
      }
      
      @keyframes processFadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .document-type-item {
        transition: all 0.3s ease;
      }
      
      .document-type-item:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
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
    }, 200);

    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  // Listen for document status changes
  useEffect(() => {
    if (!currentUser) return;
    
    const userDocRef = doc(db, 'users', currentUser.uid);
    const documentsRef = collection(userDocRef, 'documents');
    const q = query(documentsRef);
    
    console.log('Setting up document status listener');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Document[] = [];
      
      console.log(`Received ${snapshot.docs.length} documents from Firestore`);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Document ${doc.id}, Type: ${data.documentType}, Status: ${data.status}`);
        
        docs.push({
          id: doc.id,
          ...data as Omit<Document, 'id'>
        });
      });
      
      // Update the documents state
      setDocuments(docs);
      
      if (docs.length > 0) {
        // Force case-insensitive comparison for document status
        const statusCount = {
          uploaded: docs.filter(d => d.status?.toLowerCase() === 'uploaded').length,
          extracted: docs.filter(d => d.status?.toLowerCase() === 'extracted').length,
          processed: docs.filter(d => d.status?.toLowerCase() === 'processed').length,
          error: docs.filter(d => d.status?.toLowerCase() === 'error').length
        };
        
        console.log('Document counts by status:', statusCount);
        
        // Check for processing completion based on any processed document
        const hasProcessedDocuments = docs.some(doc => 
          doc.status?.toLowerCase() === 'processed'
        );
        
        console.log('Has processed documents:', hasProcessedDocuments);
        
        // Trigger completion if we have any processed document
        if (hasProcessedDocuments && onProcessingComplete && !processingComplete) {
          console.log('Processing complete condition met - has processed documents');
          onProcessingComplete();
          setProcessingComplete(true);
        }
      }
    }, (error) => {
      console.error('Error in document snapshot listener:', error);
      setError('Error monitoring document status');
    });
    
    return () => unsubscribe();
  }, [currentUser, db, onProcessingComplete, processingComplete]);

  // Calculate document counts with case-insensitive comparison
  const documentCounts = {
    uploaded: documents.filter(doc => doc.status?.toLowerCase() === 'uploaded').length,
    extracted: documents.filter(doc => doc.status?.toLowerCase() === 'extracted').length,
    processed: documents.filter(doc => doc.status?.toLowerCase() === 'processed').length,
    error: documents.filter(doc => doc.status?.toLowerCase() === 'error').length
  };

  // Count documents by type with case-insensitive comparison
  const documentTypeCount = {
    syllabus: documents.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.SYLLABUS).length,
    transcript: documents.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.TRANSCRIPT).length,
    grades: documents.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.GRADES).length
  };

  // Check if we have the minimum required documents with case-insensitive comparison
  const hasSyllabus = documents.some(doc => 
    doc.documentType?.toLowerCase() === DOCUMENT_TYPES.SYLLABUS &&
    doc.status?.toLowerCase() === 'processed'
  );

  // Handle manual processing
  const handleProcessDocuments = async () => {
    if (!currentUser) return;
    
    setIsProcessing(true);
    setError(null);
    setStatus('Processing documents...');
    
    try {
      const processDocuments = httpsCallable(functions, 'processDocuments');
      const result = await processDocuments({});
      
      if ((result.data as any).success) {
        setStatus('Documents processed successfully');
        if (onProcessingComplete) {
          onProcessingComplete();
          setProcessingComplete(true);
        }
      } else {
        setError((result.data as any).message || 'Failed to process documents');
      }
    } catch (err: any) {
      console.error('Error processing documents:', err);
      setError(`Processing failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle manual formatting
  const handleFormatDocuments = async () => {
    if (!currentUser) return;
    
    setIsFormatting(true);
    setError(null);
    setStatus('Formatting documents...');
    
    try {
      const formatDocumentsData = httpsCallable(functions, 'formatDocumentsData');
      const result = await formatDocumentsData({});
      
      if ((result.data as any).success) {
        setStatus('Documents formatted successfully');
      } else {
        setError((result.data as any).message || 'Failed to format documents');
      }
    } catch (err: any) {
      console.error('Error formatting documents:', err);
      setError(`Formatting failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsFormatting(false);
    }
  };

  // Handle document processing retry
  const handleRetryProcessing = async (documentId: string) => {
    if (!currentUser) return;
    
    setStatus(`Retrying processing for document ${documentId}...`);
    setError(null);
    
    try {
      // Use the processDocuments function to process documents
      const processDocuments = httpsCallable(functions, 'processDocuments');
      const result = await processDocuments({
        documentId: documentId // Pass the specific document ID to process
      });
      
      if ((result.data as any).success) {
        setStatus('Document processing initiated successfully');
      } else {
        setError((result.data as any).message || 'Failed to process document');
      }
    } catch (err: any) {
      console.error('Error processing document:', err);
      setError(`Processing failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Calculate overall progress with case-insensitive comparison and logging
  const calculateProgress = () => {
    if (documents.length === 0) return 0;
    
    console.log('Calculating progress with', documents.length, 'documents');
    
    const totalSteps = documents.length * 2; // Upload + Process for each document
    let completedSteps = 0;
    
    documents.forEach(doc => {
      // Count upload step for all documents
      completedSteps += 1;
      
      // Count processing step for extracted or processed documents
      if (doc.status?.toLowerCase() === 'extracted' || doc.status?.toLowerCase() === 'processed') {
        completedSteps += 1;
      }
    });
    
    const progress = Math.round((completedSteps / totalSteps) * 100);
    console.log(`Progress calculation: ${completedSteps}/${totalSteps} = ${progress}%`);
    return progress;
  };

  const progress = calculateProgress();
  const canFormat = documentCounts.extracted > 0 && !isFormatting;

  return (
    <FrostedGlass 
      variant="dark" 
      opacity={0.15} 
      blur={12}
      background="rgba(19, 10, 57, 0.4)"
      style={{
        ...styles.container,
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(10px)'
      }}
      elevation="medium"
      border="rgba(174, 185, 225, 0.2)"
      className={fadeIn ? 'process-fade-in' : ''}
    >
      <h3 style={styles.sectionTitle}>Document Processing Status</h3>
      
      {error && <Alert type="error">{error}</Alert>}
      {status && <Alert type="info">{status}</Alert>}
      
      <div style={styles.progressContainer}>
        <ProgressBar progress={progress} />
      </div>
      
      <div style={styles.statusSummaryContainer}>
        <FrostedGlass 
          variant="light" 
          opacity={0.15} 
          blur={8}
          style={styles.statusSummary}
          className="footer-card-hover"
          border="rgba(174, 185, 225, 0.2)"
        >
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Uploaded</span>
            <span style={styles.statusCount}>{documentCounts.uploaded}</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Extracted</span>
            <span style={styles.statusCount}>{documentCounts.extracted}</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Processed</span>
            <span style={styles.statusCount}>{documentCounts.processed}</span>
          </div>
          <div style={styles.statusItem}>
            <span style={{
              ...styles.statusLabel,
              color: documentCounts.error > 0 ? theme.colors.error : 'inherit'
            }}>Errors</span>
            <span style={{
              ...styles.statusCount,
              color: documentCounts.error > 0 ? theme.colors.error : 'inherit'
            }}>{documentCounts.error}</span>
          </div>
        </FrostedGlass>
      </div>
      
      <div style={styles.documentTypeInfo}>
        <h3 style={styles.sectionSubtitle}>Document Types</h3>
        <div style={styles.documentTypeList}>
          <FrostedGlass 
            variant="light" 
            opacity={0.15} 
            blur={8}
            style={styles.documentTypeItem}
            className="footer-card-hover"
            border="rgba(174, 185, 225, 0.2)"
          >
            <span style={styles.documentTypeLabel}>Syllabus</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.syllabus}</span>
            {!hasSyllabus && <span style={styles.documentTypeWarning}>Recommended</span>}
          </FrostedGlass>
          <FrostedGlass 
            variant="accent" 
            opacity={0.15} 
            blur={8}
            style={styles.documentTypeItem}
            className="footer-card-hover"
            border="rgba(97, 87, 255, 0.3)"
          >
            <span style={styles.documentTypeLabel}>Transcript</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.transcript}</span>
          </FrostedGlass>
          <FrostedGlass 
            variant="accent" 
            opacity={0.15} 
            blur={8}
            style={styles.documentTypeItem}
            className="footer-card-hover"
            border="rgba(97, 87, 255, 0.3)"
          >
            <span style={styles.documentTypeLabel}>Grades</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.grades}</span>
          </FrostedGlass>
        </div>
        
        {documents.length === 0 && (
          <Alert type="warning" style={styles.warningMessage}>
            Upload documents to begin processing. A syllabus is recommended but not required.
          </Alert>
        )}
      </div>
      
      <div style={styles.actionsContainer}>
        {false && documents.length > 0 && documentCounts.extracted > 0 && (
          <Button 
            onClick={handleProcessDocuments} 
            disabled={isProcessing}
            variant="primary"
          >
            {isProcessing ? 'Processing...' : 'Process Documents'}
          </Button>
        )}
        
        {canFormat && (
          <Button 
            onClick={handleFormatDocuments} 
            disabled={isFormatting}
            variant="secondary"
          >
            {isFormatting ? 'Formatting...' : 'Format Documents'}
          </Button>
        )}
      </div>
      
      {documents.length > 0 && (
        <div style={styles.documentsList}>
          <h3 style={styles.sectionSubtitle}>Document Details</h3>
          
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Name</th>
                  <th style={styles.tableHeader}>Type</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={styles.tableRow} className="document-row">
                    <td style={styles.tableCell}>{doc.name || 'Unnamed document'}</td>
                    <td style={styles.tableCell}>
                      <FrostedGlass 
                        variant="accent"
                        opacity={0.15}
                        blur={8}
                        style={styles.documentTypeBadge}
                        className="footer-card-hover"
                        border="rgba(97, 87, 255, 0.3)"
                      >
                        {doc.documentType}
                      </FrostedGlass>
                    </td>
                    <td style={styles.tableCell}>
                      <StatusBadge status={doc.status}/>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {doc.status?.toLowerCase() === 'uploaded' && (
                          <Button
                            onClick={() => handleRetryProcessing(doc.id)}
                            size="small"
                            variant="primary"
                          >
                            Process Document
                          </Button>
                        )}
                        {doc.status?.toLowerCase() === 'error' && (
                          <Button
                            onClick={() => handleRetryProcessing(doc.id)}
                            size="small"
                            variant="primary"
                          >
                            Retry Processing
                          </Button>
                        )}
                      </div>
                      {doc.error && (
                        <div style={styles.errorMessage}>
                          Error: {doc.error}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
    </FrostedGlass>
  );
};

const styles = {
  container: {
    padding: '25px',
    marginBottom: '20px',
    borderRadius: '12px',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  },
  sectionTitle: {
    color: '#f0f0f0',
    fontSize: '20px',
    margin: '0 0 20px 0',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sectionSubtitle: {
    color: '#f0f0f0',
    fontSize: '18px',
    marginBottom: '15px',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  progressContainer: {
    marginTop: '20px',
    marginBottom: '20px',
  },
  statusSummaryContainer: {
    marginBottom: '20px',
  },
  statusSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    padding: '20px',
    borderRadius: '12px',
  },
  statusItem: {
    flex: '1 1 0',
    textAlign: 'center' as const,
    padding: '10px',
  },
  statusLabel: {
    display: 'block',
    fontSize: '14px',
    color: '#AEB9E1',
    marginBottom: '5px',
  },
  statusCount: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#f0f0f0',
  },
  documentTypeInfo: {
    marginBottom: '20px',
  },
  documentTypeList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '15px',
    marginBottom: '15px',
  },
  documentTypeItem: {
    flex: '1 1 0',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minWidth: '120px',
    borderRadius: '12px',
  },
  documentTypeLabel: {
    fontSize: '14px',
    color: '#AEB9E1',
  },
  documentTypeCount: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#f0f0f0',
    margin: '5px 0',
  },
  documentTypeWarning: {
    fontSize: '12px',
    color: '#ff9800',
    fontWeight: 500,
  },
  warningMessage: {
    marginTop: '10px',
  },
  actionsContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  },
  documentsList: {
    marginTop: '30px',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '10px',
  },
  tableHeader: {
    textAlign: 'left' as const,
    padding: '12px 15px',
    color: '#AEB9E1',
    fontWeight: 600,
    borderBottom: '1px solid rgba(174, 185, 225, 0.2)',
  },
  tableRow: {
    borderBottom: '1px solid rgba(174, 185, 225, 0.1)',
    transition: 'background-color 0.2s',
  },
  tableCell: {
    padding: '12px 15px',
    verticalAlign: 'middle' as const,
    color: '#f0f0f0',
  },
  documentTypeBadge: {
    display: 'inline-block',
    padding: '5px 10px',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  errorMessage: {
    color: '#f44336',
    fontSize: '0.8rem',
    marginTop: '5px',
  }
};

export default DocumentProcessingStatus;
