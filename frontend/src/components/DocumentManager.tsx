import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import DocumentProcessingStatus from './DocumentProcessingStatus';
import DOCUMENT_TYPES, { DocumentType } from '../constants/documentTypes';

interface Document {
  id: string;
  documentType: DocumentType;
  status: string;
  uploadedAt: any;
  filePath: string;
  name: string;
}

const DocumentManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [documentType, setDocumentType] = useState<DocumentType>(DOCUMENT_TYPES.SYLLABUS);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const functions = getFunctions();

  // Fetch user documents
  const fetchUserDocuments = useCallback(async () => {
    try {
      const getUserDocuments = httpsCallable(functions, 'getUserDocuments');
      const result = await getUserDocuments();
      
      if ((result.data as any).success) {
        setDocuments((result.data as any).documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load existing documents');
    }
  }, [functions]);

  // Fetch existing documents on component mount
  useEffect(() => {
    if (!currentUser) return;
    
    fetchUserDocuments();
  }, [currentUser, fetchUserDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDocumentType(e.target.value as DocumentType);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0 || !currentUser) {
      setError('Please select at least one file to upload');
      return;
    }
    
    setIsUploading(true);
    setStatus('Uploading documents...');
    setError('');
    
    try {
      // Upload each file
      for (const file of files) {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(file);
        
        await new Promise<void>((resolve, reject) => {
          fileReader.onload = async () => {
            try {
              const base64String = fileReader.result as string;
              
              // Determine document type based on file name using constants
              const fileName = file.name.toLowerCase();
              let autoDetectedType: DocumentType = documentType;
              
              if (fileName.includes('syllabus')) {
                autoDetectedType = DOCUMENT_TYPES.SYLLABUS;
              } else if (fileName.includes('transcript')) {
                autoDetectedType = DOCUMENT_TYPES.TRANSCRIPT;
              } else if (fileName.includes('grade')) {
                autoDetectedType = DOCUMENT_TYPES.GRADES;
              }
              
              // Upload document
              const uploadDocument = httpsCallable(functions, 'uploadDocument');
              const result = await uploadDocument({
                documentType: autoDetectedType,
                documentName: file.name,
                documentBase64: base64String
              });
              
              setStatus(`Uploaded ${file.name} as ${autoDetectedType}. Processing started.`);
              
              // Store the document ID for reference
              const documentId = (result.data as any).documentId;
              if (documentId) {
                console.log(`Document ID: ${documentId}`);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          
          fileReader.onerror = () => reject(new Error('Error reading file'));
        });
      }
      
      // Refresh document list
      fetchUserDocuments();
      
      setStatus('All documents uploaded successfully');
      setFiles([]);
      
    } catch (err: any) {
      console.error('Error uploading documents:', err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setStatus('Deleting document...');
      
      const deleteDocument = httpsCallable(functions, 'deleteDocument');
      const result = await deleteDocument({ documentId });
      
      if ((result.data as any).success) {
        fetchUserDocuments();
        setStatus('Document deleted successfully');
      } else {
        setError('Failed to delete document');
      }
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError(`Delete failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Document Manager</h2>
        <p style={styles.subtitle}>Upload and manage your academic documents</p>
      </div>
      
      {error && <div style={styles.error}>{error}</div>}
      {status && <div style={styles.status}>{status}</div>}
      
      <DocumentProcessingStatus />
      
      <div style={styles.uploadContainer}>
        <h3 style={styles.sectionTitle}>Upload Documents</h3>
        <form onSubmit={handleUpload} style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label htmlFor="documentType" style={styles.label}>
                Document Type:
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={handleTypeChange}
                style={styles.select}
                disabled={isUploading}
              >
                <option value={DOCUMENT_TYPES.SYLLABUS}>Syllabus</option>
                <option value={DOCUMENT_TYPES.TRANSCRIPT}>Transcript</option>
                <option value={DOCUMENT_TYPES.GRADES}>Grades</option>
                <option value={DOCUMENT_TYPES.OTHER}>Other</option>
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label htmlFor="fileInput" style={styles.label}>
                Select Documents
              </label>
              <div 
                style={isDragging ? styles.fileInputWrapperActive : styles.fileInputWrapper}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div style={styles.uploadIcon}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V16M12 4L8 8M12 4L16 8M6 20H18" stroke={isDragging ? "#6157FF" : "#999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={styles.dropText}>Drag & drop files here or <span style={styles.browseText}>browse</span></p>
                <input
                  id="fileInput"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileChange}
                  style={styles.fileInput}
                  disabled={isUploading}
                />
                <div style={styles.selectedFiles}>
                  {files.length > 0 ? (
                    <>
                      <span style={styles.fileCount}>{files.length} file(s) selected</span>
                      <ul style={styles.fileList}>
                        {files.map((file, index) => (
                          <li key={index} style={styles.fileItem}>
                            <span style={styles.fileName}>{file.name}</span> 
                            <span style={styles.fileSize}>({(file.size / 1024).toFixed(1)} KB)</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <span style={styles.noFiles}>No files selected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            style={isUploading || files.length === 0 ? styles.uploadButtonDisabled : styles.uploadButton}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? (
              <>
                <span style={styles.spinner}></span>
                Uploading...
              </>
            ) : (
              'Upload Documents'
            )}
          </button>
        </form>
        
        <div style={styles.tip}>
          <div style={styles.tipIcon}>💡</div>
          <div style={styles.tipContent}>
            <span style={styles.tipTitle}>Pro Tip:</span> Files will be automatically categorized based on their names. 
            Include "syllabus", "transcript", or "grade" in the filename for automatic detection.
          </div>
        </div>
      </div>
      
      {documents.length > 0 && (
        <div style={styles.documentsListContainer}>
          <h3 style={styles.sectionTitle}>Your Documents</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Name</th>
                  <th style={styles.tableHeader}>Type</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Uploaded</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <div style={styles.documentName}>
                        {doc.name || 'Unnamed document'}
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={styles.documentType}>
                        {doc.documentType}
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: doc.status === 'processed' ? '#4caf50' : 
                                        doc.status === 'processing' ? '#ff9800' : 
                                        doc.status === 'error' ? '#f44336' : '#6157FF'
                      }}>
                        {doc.status}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {doc.uploadedAt ? new Date(doc.uploadedAt.seconds * 1000).toLocaleString() : 'Unknown date'}
                    </td>
                    <td style={styles.tableCell}>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={styles.deleteButton}
                        disabled={isUploading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {documents.length === 0 && !isUploading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyStateIcon}>📄</div>
          <h3 style={styles.emptyStateTitle}>No Documents Yet</h3>
          <p style={styles.emptyStateText}>
            Upload your syllabi, transcripts, and other grade documents to get started.
          </p>
          <div style={styles.emptyStateHighlight}>
            Start by uploading a syllabus for the most accurate grade predictions.
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
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
  sectionTitle: {
    color: '#1F0F5C',
    fontSize: '18px',
    margin: '0 0 15px 0',
    fontWeight: 600,
  },
  uploadContainer: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    marginBottom: '20px',
    borderRadius: '8px',
    margin: '0 20px 20px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  form: {
    marginBottom: '20px',
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    marginBottom: '20px',
  },
  formGroup: {
    flex: 1,
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    color: '#555',
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
  },
  fileInputWrapper: {
    border: '2px dashed #ddd',
    borderRadius: '8px',
    padding: '30px 20px',
    backgroundColor: 'white',
    transition: 'all 0.3s ease',
    textAlign: 'center' as const,
    cursor: 'pointer',
  },
  fileInputWrapperActive: {
    border: '2px dashed #6157FF',
    borderRadius: '8px',
    padding: '30px 20px',
    backgroundColor: 'rgba(97, 87, 255, 0.05)',
    transition: 'all 0.3s ease',
    textAlign: 'center' as const,
    cursor: 'pointer',
  },
  uploadIcon: {
    margin: '0 auto 15px auto',
  },
  dropText: {
    margin: '0 0 15px 0',
    color: '#666',
    fontSize: '16px',
  },
  browseText: {
    color: '#6157FF',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  fileInput: {
    marginBottom: '10px',
    width: '0.1px',
    height: '0.1px',
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute' as const,
    zIndex: -1,
  },
  selectedFiles: {
    marginTop: '20px',
    textAlign: 'left' as const,
  },
  fileCount: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    color: '#6157FF',
  },
  fileList: {
    margin: '10px 0 0 0',
    padding: '0',
    listStyle: 'none',
  },
  fileItem: {
    margin: '10px 0',
    padding: '10px 15px',
    backgroundColor: 'rgba(97, 87, 255, 0.08)',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileName: {
    color: '#333',
    fontWeight: 500,
  },
  fileSize: {
    color: '#999',
    fontSize: '0.9em',
  },
  noFiles: {
    color: '#999',
    fontStyle: 'italic',
    display: 'block',
    textAlign: 'center' as const,
  },
  uploadButton: {
    backgroundColor: '#6157FF',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(97, 87, 255, 0.3)',
  },
  uploadButtonDisabled: {
    backgroundColor: '#cccccc',
    color: '#666666',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontWeight: 600,
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
  tip: {
    backgroundColor: 'rgba(97, 87, 255, 0.08)',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
  },
  tipIcon: {
    fontSize: '20px',
  },
  tipContent: {
    flex: 1,
    lineHeight: 1.5,
  },
  tipTitle: {
    fontWeight: 'bold',
    color: '#6157FF',
  },
  documentsListContainer: {
    padding: '0 20px 20px 20px',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  },
  tableHeader: {
    padding: '15px',
    backgroundColor: '#f2f2f2',
    color: '#333',
    fontWeight: 600,
    borderBottom: '2px solid #ddd',
    position: 'sticky' as const,
    top: 0,
  },
  tableRow: {
    borderBottom: '1px solid #eee',
    transition: 'background-color 0.3s',
  },
  tableCell: {
    padding: '15px',
    verticalAlign: 'middle' as const,
  },
  documentName: {
    fontWeight: 500,
    color: '#333',
  },
  documentType: {
    display: 'inline-block',
    padding: '5px 10px',
    backgroundColor: 'rgba(97, 87, 255, 0.1)',
    color: '#6157FF',
    borderRadius: '4px',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: 500,
    transition: 'background-color 0.3s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
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
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
    marginBottom: '15px',
  },
  emptyStateHighlight: {
    backgroundColor: 'rgba(97, 87, 255, 0.1)',
    color: '#6157FF',
    padding: '12px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    maxWidth: '400px',
    textAlign: 'center' as const,
  }
};

export default DocumentManager