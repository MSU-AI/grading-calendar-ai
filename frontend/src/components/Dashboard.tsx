import React, { useState } from 'react';
import DocumentManager from './DocumentManager';
import PredictionPanel from './PredictionPanel';
const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('documents');

  return (
    <div style={styles.container}>
      
      <div style={styles.tabs}>
        <button 
          style={activeTab === 'documents' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('documents')}
        >
          Document Manager
        </button>
        <button 
          style={activeTab === 'prediction' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('prediction')}
        >
          Grade Prediction
        </button>
      </div>
      
      <div style={styles.content}>
        {activeTab === 'documents' && <DocumentManager />}
        {activeTab === 'prediction' && <PredictionPanel />}
      </div>
      
      <div style={styles.footer}>
        <p>Upload your academic documents and get a prediction of your final grade.</p>
        <p><strong>How it works:</strong> First upload your documents in the Document Manager tab, then switch to the Grade Prediction tab to get your prediction.</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    minHeight: 'calc(100vh - 40px)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '1px solid #eee',
  },
  title: {
    margin: 0,
    color: '#2196F3',
    fontSize: '28px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  userEmail: {
    color: '#666',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  tabs: {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '1px solid #eee',
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#666',
    fontWeight: 'bold',
  },
  activeTab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid #2196F3',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#2196F3',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: '40px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    textAlign: 'center' as const,
    color: '#666',
  },
};

export default Dashboard;
