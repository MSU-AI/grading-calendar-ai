import React, { useState, useEffect } from 'react';
import DocumentManager from './DocumentManager';
import PredictionPanel from './PredictionPanel';
import { useAuth } from '../contexts/AuthContext';
import { globalStyles, initializeGlobalStyles, particleConfig } from './GlobalStyles';
import FrostedGlass from './common/FrostedGlass';

// TypeScript type declaration for particlesJS
declare global {
  interface Window {
    particlesJS: (id: string, config: object) => void;
  }
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('documents');
  const { currentUser } = useAuth();
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const quickTips = [
    "Upload syllabi to get the most accurate grade predictions",
    "The AI analyzes your grade distribution patterns",
    "Check predictions before major assignments to plan your study time",
    "Upload transcript files to include your past course performance"
  ];
  
  // Randomly selects a tip to show
  const randomTip = quickTips[Math.floor(Math.random() * quickTips.length)];

  useEffect(() => {
    // Initialize global styles
    const cleanupStyles = initializeGlobalStyles();
    
    // Dynamically load particles.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize particles.js after script is loaded
      window.particlesJS('dashboard-particles', particleConfig);
    };
    document.body.appendChild(script);

    // Set fade in effect after a short delay
    setTimeout(() => {
      setFadeIn(true);
    }, 100);

    // Cleanup
    return () => {
      cleanupStyles();
      const scriptElement = document.querySelector('script[src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"]');
      if (scriptElement) document.body.removeChild(scriptElement);
    };
  }, []);

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <div id="dashboard-particles"></div>
      
      <div style={{
        ...styles.container,
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(20px)'
      }}>
        <FrostedGlass 
          opacity={0.6} 
          blur={15}
          background="rgba(30, 19, 80, 0.5)"
          style={styles.header}
        >
          <div style={styles.headerContent}>
            <h1 style={styles.title}>
              {getTimeBasedGreeting()}, {currentUser?.email?.split('@')[0] || 'Student'}
            </h1>
            <p style={styles.subtitle}>Track your academic progress and predict your final grades</p>
          </div>
          <div style={styles.headerGlow}></div>
        </FrostedGlass>
        
        {/* Quick Tip Component */}
        <FrostedGlass
          opacity={0.2}
          blur={8}
          background="rgba(97, 87, 255, 0.1)"
          style={styles.quickTip}
        >
          <div style={styles.tipIcon}>💡</div>
          <div style={styles.tipContent}>
            <span style={styles.tipTitle}>Quick Tip:</span> {randomTip}
          </div>
        </FrostedGlass>
        
        <div style={styles.tabs}>
          <button 
            style={activeTab === 'documents' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('documents')}
          >
            <span style={styles.tabIcon}>📄</span>
            Document Manager
          </button>
          <button 
            style={activeTab === 'prediction' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('prediction')}
          >
            <span style={styles.tabIcon}>📊</span>
            Grade Prediction
          </button>
        </div>
        
        <FrostedGlass
          opacity={0.9}
          blur={20}
          background="rgba(255, 255, 255, 0.05)"
          radius={0}
          borderWidth={0}
          style={styles.content}
        >
          {activeTab === 'documents' && <DocumentManager />}
          {activeTab === 'prediction' && <PredictionPanel />}
        </FrostedGlass>
        
        <FrostedGlass
          opacity={0.7}
          blur={10}
          background="rgba(245, 247, 255, 0.1)"
          style={styles.footer}
        >
          <div style={styles.footerContent}>
            <div style={styles.footerSection}>
              <h3 style={styles.footerTitle}>How It Works</h3>
              <FrostedGlass
                opacity={0.4}
                blur={5}
                className="card-hover"
                style={styles.footerCard}
              >
                <ol style={styles.footerList}>
                  <li>Upload your syllabus and grade documents</li>
                  <li>Our AI processes and extracts your grade information</li>
                  <li>Get a personalized prediction of your final grade</li>
                </ol>
              </FrostedGlass>
            </div>
            <div style={styles.footerSection}>
              <h3 style={styles.footerTitle}>Tips</h3>
              <FrostedGlass
                opacity={0.4}
                blur={5}
                className="card-hover"
                style={styles.footerCard}
              >
                <ul style={styles.footerList}>
                  <li>Upload a syllabus for the most accurate predictions</li>
                  <li>Include grading policy documents if available</li>
                  <li>Check back regularly to update your prediction</li>
                </ul>
              </FrostedGlass>
            </div>
          </div>
          <div style={styles.footerCopyright}>
            © {new Date().getFullYear()} GradeScape | All rights reserved
          </div>
        </FrostedGlass>
      </div>
    </>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '30px 20px',
    minHeight: 'calc(100vh - 60px)', // Account for navbar height
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    zIndex: 1,
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  },
  header: {
    marginBottom: '20px',
    padding: '25px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  headerContent: {
    position: 'relative' as const,
    zIndex: 2,
  },
  headerGlow: {
    position: 'absolute' as const,
    top: '-50%',
    right: '-10%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(97, 87, 255, 0.4) 0%, rgba(97, 87, 255, 0) 70%)',
    zIndex: 1,
    pointerEvents: 'none' as const,
    animation: 'float 6s ease-in-out infinite',
  },
  title: {
    ...globalStyles.text.title,
  },
  subtitle: {
    ...globalStyles.text.subtitle,
  },
  quickTip: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    marginBottom: '20px',
    animation: 'fadeIn 0.5s ease-out',
  },
  tipIcon: {
    fontSize: '24px',
  },
  tipContent: {
    flex: 1,
    lineHeight: 1.6,
    color: '#f0f0f0',
  },
  tipTitle: {
    fontWeight: 'bold',
    color: '#AEB9E1',
  },
  tabs: {
    display: 'flex',
    marginBottom: '0',
    borderRadius: '12px 12px 0 0',
    overflow: 'hidden',
    backdropFilter: 'blur(5px)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderBottom: 'none',
  },
  tab: {
    padding: '18px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#f0f0f0',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    flex: 1,
    textAlign: 'center' as const,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(8px)',
  },
  activeTab: {
    padding: '18px 24px',
    backgroundColor: 'rgba(97, 87, 255, 0.2)',
    border: 'none',
    borderBottom: '3px solid #6157FF',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#ffffff',
    fontWeight: 600,
    flex: 1,
    textAlign: 'center' as const,
    boxShadow: '0 4px 6px -6px rgba(97, 87, 255, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(8px)',
  },
  tabIcon: {
    fontSize: '18px',
  },
  content: {
    flex: 1,
    marginBottom: '30px',
    overflow: 'hidden',
    animation: 'fadeIn 0.5s ease-out',
  },
  footer: {
    padding: '25px',
    color: '#f0f0f0',
    marginTop: 'auto',
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '25px',
  },
  footerSection: {
    flex: '1 1 300px',
  },
  footerCard: {
    padding: '15px',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  footerTitle: {
    fontSize: '18px',
    color: '#f0f0f0',
    marginBottom: '15px',
    fontWeight: 600,
  },
  footerList: {
    paddingLeft: '20px',
    lineHeight: '1.8',
    margin: '0',
    color: '#f0f0f0',
  },
  footerCopyright: {
    marginTop: '25px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#AEB9E1',
    borderTop: '1px solid rgba(174, 185, 225, 0.2)',
    paddingTop: '20px',
  },
};

export default Dashboard;
