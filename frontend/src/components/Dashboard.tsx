import React, { useState, useEffect } from 'react';
import DocumentManager from './DocumentManager';
import PredictionPanel from './PredictionPanel';
import { useAuth } from '../contexts/AuthContext';

// TypeScript type declaration for particlesJS
declare global {
  interface Window {
    particlesJS: (id: string, config: object) => void;
  }
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('documents');
  const { currentUser } = useAuth();

  useEffect(() => {
    // Dynamically load particles.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize particles.js after script is loaded
      window.particlesJS('dashboard-particles', {
        "particles": {
          "number": {
            "value": 40,
            "density": {
              "enable": true,
              "value_area": 1000
            }
          },
          "color": {
            "value": ["#AEB9E1", "#9A8BD0", "#7063A7", "#6157FF"]
          },
          "shape": {
            "type": "circle",
            "stroke": {
              "width": 0,
              "color": "#000000"
            }
          },
          "opacity": {
            "value": 0.3,
            "random": true,
            "anim": {
              "enable": true,
              "speed": 0.5,
              "opacity_min": 0.1,
              "sync": false
            }
          },
          "size": {
            "value": 3,
            "random": true
          },
          "line_linked": {
            "enable": true,
            "distance": 150,
            "color": "#AEB9E1",
            "opacity": 0.2,
            "width": 1
          },
          "move": {
            "enable": true,
            "speed": 2,
            "direction": "none",
            "random": false,
            "straight": false,
            "out_mode": "out",
            "bounce": false
          }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": {
            "onhover": {
              "enable": true,
              "mode": "grab"
            },
            "onclick": {
              "enable": false
            },
            "resize": true
          },
          "modes": {
            "grab": {
              "distance": 140,
              "line_linked": {
                "opacity": 0.4
              }
            }
          }
        },
        "retina_detect": false
      });
    };
    document.body.appendChild(script);

    // Add CSS for animation
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
      
      @keyframes glow {
        0% { box-shadow: 0 0 10px rgba(97, 87, 255, 0.5); }
        50% { box-shadow: 0 0 20px rgba(97, 87, 255, 0.8); }
        100% { box-shadow: 0 0 10px rgba(97, 87, 255, 0.5); }
      }
    `;
    document.head.appendChild(styleTag);

    // Cleanup
    return () => {
      document.body.removeChild(script);
      document.head.removeChild(styleTag);
    };
  }, []);

  return (
    <div style={styles.backgroundContainer}>
      <div id="dashboard-particles" style={styles.particles}></div>
      
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.title}>Welcome, {currentUser?.email?.split('@')[0] || 'Student'}</h1>
            <p style={styles.subtitle}>Track your academic progress and predict your final grades</p>
          </div>
          <div style={styles.headerGlow}></div>
        </div>
        
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
          <div style={styles.footerContent}>
            <div style={styles.footerSection}>
              <h3 style={styles.footerTitle}>How It Works</h3>
              <div style={styles.footerCard}>
                <ol style={styles.footerList}>
                  <li>Upload your syllabus and grade documents</li>
                  <li>Our AI processes and extracts your grade information</li>
                  <li>Get a personalized prediction of your final grade</li>
                </ol>
              </div>
            </div>
            <div style={styles.footerSection}>
              <h3 style={styles.footerTitle}>Tips</h3>
              <div style={styles.footerCard}>
                <ul style={styles.footerList}>
                  <li>Upload a syllabus for the most accurate predictions</li>
                  <li>Include grading policy documents if available</li>
                  <li>Check back regularly to update your prediction</li>
                </ul>
              </div>
            </div>
          </div>
          <div style={styles.footerCopyright}>
            © {new Date().getFullYear()} GradeScape | All rights reserved
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  backgroundContainer: {
    backgroundColor: '#150C40',
    backgroundImage: 'linear-gradient(135deg, #130A39 0%, #1F0F5C 50%, #341873 100%)',
    backgroundSize: '200% 200%',
    animation: 'gradientShift 15s ease infinite',
    minHeight: 'calc(100vh - 60px)',
    position: 'relative' as const,
    width: '100%',
    overflow: 'hidden',
  },
  particles: {
    position: 'absolute' as const,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '30px 20px',
    minHeight: 'calc(100vh - 60px)', // Account for navbar height
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    zIndex: 1,
  },
  header: {
    marginBottom: '30px',
    padding: '25px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(30, 19, 80, 0.8) 0%, rgba(52, 24, 115, 0.8) 100%)',
    color: 'white',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)',
    position: 'relative' as const,
    overflow: 'hidden',
    border: '1px solid rgba(174, 185, 225, 0.2)',
    backdropFilter: 'blur(5px)',
    animation: 'glow 5s infinite',
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
    margin: 0,
    fontSize: '32px',
    fontWeight: 700,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 2px 10px rgba(97, 87, 255, 0.2)',
  },
  subtitle: {
    margin: '10px 0 0 0',
    color: '#AEB9E1',
    fontSize: '18px',
  },
  tabs: {
    display: 'flex',
    marginBottom: '20px',
    borderRadius: '12px 12px 0 0',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    backdropFilter: 'blur(5px)',
  },
  tab: {
    padding: '18px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#666',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    flex: 1,
    textAlign: 'center' as const,
  },
  activeTab: {
    padding: '18px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: 'none',
    borderBottom: '3px solid #6157FF',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#6157FF',
    fontWeight: 600,
    flex: 1,
    textAlign: 'center' as const,
    boxShadow: '0 4px 6px -6px rgba(97, 87, 255, 0.5)',
  },
  content: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '0 0 12px 12px',
    boxShadow: '0 2px 15px rgba(0, 0, 0, 0.15)',
    marginBottom: '30px',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  },
  footer: {
    backgroundColor: 'rgba(245, 247, 255, 0.9)',
    borderRadius: '12px',
    padding: '25px',
    color: '#666',
    marginTop: 'auto',
    boxShadow: '0 2px 15px rgba(0, 0, 0, 0.15)',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(174, 185, 225, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    backdropFilter: 'blur(5px)',
  },
  footerTitle: {
    fontSize: '18px',
    color: '#341873',
    marginBottom: '15px',
    fontWeight: 600,
  },
  footerList: {
    paddingLeft: '20px',
    lineHeight: '1.8',
    margin: '0',
  },
  footerCopyright: {
    marginTop: '25px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#999',
    borderTop: '1px solid rgba(238, 238, 238, 0.5)',
    paddingTop: '20px',
  },
};

export default Dashboard;