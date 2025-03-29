import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore, collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import DOCUMENT_TYPES, { DocumentType } from '../constants/documentTypes';

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [processingComplete, setProcessingComplete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  const db = getFirestore();
  const functions = getFunctions();

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
        // Force case-insensitive comparison for document types
        const documentTypeCount = {
          syllabus: docs.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.SYLLABUS).length,
          transcript: docs.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.TRANSCRIPT).length,
          grades: docs.filter(doc => doc.documentType?.toLowerCase() === DOCUMENT_TYPES.GRADES).length
        };
        
        // Force case-insensitive comparison for document status
        const statusCount = {
          uploaded: docs.filter(d => d.status?.toLowerCase() === 'uploaded').length,
          extracted: docs.filter(d => d.status?.toLowerCase() === 'extracted').length,
          processed: docs.filter(d => d.status?.toLowerCase() === 'processed').length,
          error: docs.filter(d => d.status?.toLowerCase() === 'error').length
        };
        
        console.log('Document counts by type:', documentTypeCount);
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
  const hasMinimumDocuments = hasSyllabus;

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
      // We'll use the formatDocumentsData function to process all documents
      const formatDocumentsData = httpsCallable(functions, 'formatDocumentsData');
      const result = await formatDocumentsData({});
      
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

  // Function to inspect document data
  const inspectDocumentData = async (documentId: string) => {
    if (!currentUser) return;
    
    setStatus(`Inspecting document ${documentId}...`);
    
    try {
      // Get document from Firestore
      const db = getFirestore();
      const docRef = doc(db, 'users', currentUser.uid, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("===== DOCUMENT DATA =====");
        console.log(`Document ID: ${documentId}`);
        console.log(`Type: ${data.documentType}`);
        console.log(`Status: ${data.status}`);
        console.log(`Name: ${data.name}`);
        
        // Log text data if available (limited to first 500 chars for readability)
        if (data.text) {
          console.log(`Text length: ${data.text.length} characters`);
          console.log("First 500 characters:");
          console.log(data.text.substring(0, 500) + "...");
        }
        
        setStatus(`Document data logged to console for ${documentId}`);
      } else {
        setError(`Document not found: ${documentId}`);
      }
    } catch (err: any) {
      console.error('Error inspecting document:', err);
      setError(`Inspection failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Function to inspect formatted data
  const inspectFormattedData = async () => {
    if (!currentUser) return;
    
    setStatus('Fetching formatted data...');
    
    try {
      const db = getFirestore();
      const formattedDataRef = doc(db, 'users', currentUser.uid, 'data', 'formatted_data');
      const docSnap = await getDoc(formattedDataRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("===== FORMATTED DATA =====");
        console.log(JSON.stringify(data.formatted_data, null, 2));
        setStatus('Formatted data logged to console');
      } else {
        console.log("No formatted data document found");
        setError('No formatted data available');
      }
    } catch (err: any) {
      console.error('Error fetching formatted data:', err);
      setError(`Failed to fetch formatted data: ${err.message || 'Unknown error'}`);
    }
  };

  const progress = calculateProgress();
  const canFormat = documentCounts.extracted > 0 && !isFormatting;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Document Processing Status</h2>
      
      {error && <p style={styles.error}>{error}</p>}
      {status && <p style={styles.status}>{status}</p>}
      
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div 
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#4caf50' : '#2196f3'
            }}
          />
        </div>
        <div style={styles.progressLabel}>{progress}% Complete</div>
      </div>
      
      <div style={styles.statusSummary}>
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
          <span style={styles.statusLabel}>Errors</span>
          <span style={{
            ...styles.statusCount,
            color: documentCounts.error > 0 ? '#f44336' : 'inherit'
          }}>{documentCounts.error}</span>
        </div>
      </div>
      
      <div style={styles.documentTypeInfo}>
        <h3>Document Types</h3>
        <div style={styles.documentTypeList}>
          <div style={styles.documentTypeItem}>
            <span style={styles.documentTypeLabel}>Syllabus</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.syllabus}</span>
            {!hasSyllabus && <span style={{...styles.documentTypeWarning, color: '#ff9800'}}>Recommended</span>}
          </div>
          <div style={styles.documentTypeItem}>
            <span style={styles.documentTypeLabel}>Transcript</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.transcript}</span>
          </div>
          <div style={styles.documentTypeItem}>
            <span style={styles.documentTypeLabel}>Grades</span>
            <span style={styles.documentTypeCount}>{documentTypeCount.grades}</span>
          </div>
        </div>
        
        {documents.length === 0 && (
          <p style={styles.warningMessage}>
            Upload documents to begin processing. A syllabus is recommended but not required.
          </p>
        )}
      </div>
      
      {canFormat && (
        <div>
          <button 
            onClick={handleFormatDocuments} 
            style={styles.formatButton}
            disabled={isFormatting}
          >
            {isFormatting ? 'Formatting...' : 'Format Documents'}
          </button>
          <button 
            onClick={inspectFormattedData}
            style={{...styles.formatButton, backgroundColor: '#666', marginLeft: '10px'}}
          >
            Inspect Formatted Data
          </button>
        </div>
      )}
      
      {documents.length > 0 && (
        <div style={styles.documentsList}>
          <h3>Document Details</h3>
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
                <tr key={doc.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>{doc.name || 'Unnamed document'}</td>
                  <td style={styles.tableCell}>{doc.documentType}</td>
                  <td style={styles.tableCell}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: doc.status?.toLowerCase() === 'processed' ? '#4caf50' : 
                                      doc.status?.toLowerCase() === 'extracted' ? '#ff9800' :
                                      doc.status?.toLowerCase() === 'error' ? '#f44336' : '#2196f3'
                    }}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {doc.status?.toLowerCase() === 'uploaded' && (
                        <button
                          onClick={() => handleRetryProcessing(doc.id)}
                          style={styles.actionButton}
                        >
                          Process Document
                        </button>
                      )}
                      {doc.status?.toLowerCase() === 'error' && (
                        <button
                          onClick={() => handleRetryProcessing(doc.id)}
                          style={styles.actionButton}
                        >
                          Retry Processing
                        </button>
                      )}
                      <button
                        onClick={() => inspectDocumentData(doc.id)}
                        style={{...styles.actionButton, backgroundColor: '#666'}}
                      >
                        Inspect
                      </button>
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
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  title: {
    marginTop: 0,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  progressContainer: {
    marginTop: '20px',
    marginBottom: '20px',
  },
  progressBar: {
    height: '20px',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    textAlign: 'center' as const,
    marginTop: '5px',
    fontSize: '14px',
    color: '#666',
  },
  statusSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  statusItem: {
    flex: '1 1 0',
    textAlign: 'center' as const,
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    margin: '5px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  statusLabel: {
    display: 'block',
    fontSize: '14px',
    color: '#666',
    marginBottom: '5px',
  },
  statusCount: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  documentTypeInfo: {
    marginBottom: '20px',
  },
  documentTypeList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
  },
  documentTypeItem: {
    flex: '1 1 0',
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  documentTypeLabel: {
    fontSize: '14px',
    color: '#666',
  },
  documentTypeCount: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  documentTypeWarning: {
    fontSize: '12px',
    color: '#f44336',
    marginTop: '5px',
  },
  warningMessage: {
    color: '#f44336',
    backgroundColor: '#ffebee',
    padding: '10px',
    borderRadius: '4px',
    marginTop: '10px',
  },
  formatButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    marginBottom: '20px',
  },
  documentsList: {
    marginTop: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '10px',
  },
  tableHeader: {
    textAlign: 'left' as const,
    padding: '10px',
    backgroundColor: '#f2f2f2',
    borderBottom: '1px solid #ddd',
  },
  tableRow: {
    borderBottom: '1px solid #eee',
  },
  tableCell: {
    padding: '10px',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.8rem',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  errorMessage: {
    color: '#f44336',
    fontSize: '0.8rem',
    marginTop: '5px',
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

export default DocumentProcessingStatus;
