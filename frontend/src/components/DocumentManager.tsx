import React, { useState, useEffect } from 'react';
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
  
  const functions = getFunctions();

  // Fetch user documents
  const fetchUserDocuments = async () => {
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
  };

  // Fetch existing documents on component mount
  useEffect(() => {
    if (!currentUser) return;
    
    fetchUserDocuments();
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDocumentType(e.target.value as DocumentType);
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
              let documentType: DocumentType = DOCUMENT_TYPES.OTHER;
              
              if (fileName.includes('syllabus')) {
                documentType = DOCUMENT_TYPES.SYLLABUS as DocumentType;
              } else if (fileName.includes('transcript')) {
                documentType = DOCUMENT_TYPES.TRANSCRIPT as DocumentType;
              } else if (fileName.includes('grade')) {
                documentType = DOCUMENT_TYPES.GRADES as DocumentType;
              }
              
              // Upload document
              const uploadDocument = httpsCallable(functions, 'uploadDocument');
              const result = await uploadDocument({
                documentType,
                documentName: file.name,
                documentBase64: base64String
              });
              
              setStatus(`Uploaded ${file.name} as ${documentType}. Processing started.`);
              
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
      <h2 style={styles.title}>Document Manager</h2>
      
      {error && <p style={styles.error}>{error}</p>}
      {status && <p style={styles.status}>{status}</p>}
      
      <DocumentProcessingStatus />
      
      <form onSubmit={handleUpload} style={styles.form}>
        <div style={styles.fileInputContainer}>
          <label htmlFor="documentType" style={styles.fileInputLabel}>
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
          
          <label htmlFor="fileInput" style={styles.fileInputLabel}>
            Select Documents
          </label>
          <input
            id="fileInput"
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            style={styles.fileInput}
            disabled={isUploading}
          />
          <span style={styles.selectedFiles}>
            {files.length > 0 ? `${files.length} file(s) selected` : 'No files selected'}
          </span>
        </div>
        
        <button
          type="submit"
          style={styles.uploadButton}
          disabled={isUploading || files.length === 0}
        >
          {isUploading ? 'Uploading...' : 'Upload Documents'}
        </button>
        
        <p style={styles.note}>
          Note: Files will be automatically categorized based on their names. Include "syllabus", "transcript", or "grade" in the filename.
        </p>
      </form>
      
      {documents.length > 0 && (
        <div style={styles.documentsList}>
          <h3>Your Documents</h3>
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
                  <td style={styles.tableCell}>{doc.name || 'Unnamed document'}</td>
                  <td style={styles.tableCell}>{doc.documentType}</td>
                  <td style={styles.tableCell}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: doc.status === 'processed' ? '#4caf50' : 
                                      doc.status === 'processing' ? '#ff9800' : '#2196f3'
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
  form: {
    marginBottom: '20px',
  },
  fileInputContainer: {
    marginBottom: '15px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  fileInputLabel: {
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#555',
  },
  select: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
    marginBottom: '15px',
  },
  fileInput: {
    padding: '10px 0',
  },
  selectedFiles: {
    fontSize: '0.9rem',
    color: '#666',
  },
  uploadButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  note: {
    fontSize: '0.9rem',
    color: '#666',
    marginTop: '10px',
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
  deleteButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
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

export default DocumentManager;
