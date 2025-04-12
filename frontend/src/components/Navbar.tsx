import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import FrostedGlass from './common/FrostedGlass';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .navbar-animation {
        animation: navbarFadeIn 0.5s ease-out forwards;
      }
      
      @keyframes navbarFadeIn {
        0% {
          opacity: 0;
          transform: translateY(-10px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .nav-button {
        transition: all 0.3s ease;
      }
      
      .nav-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(styleTag);
    
    // Trigger fade-in animation
    setTimeout(() => {
      setFadeIn(true);
    }, 100);

    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const navigateToHome = () => {
    navigate('/dashboard');
  };

  return (
    <FrostedGlass
      variant="dark" 
      blur={12} 
      opacity={0.15}
      background="rgba(19, 10, 57, 0.8)"
      elevation="high"
      style={{
        ...styles.navbar,
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(-10px)'
      }}
      className={fadeIn ? 'navbar-animation' : ''}
    >
      <div style={styles.navbarContent}>
        <div 
          style={styles.logoContainer} 
          className="card-hover"
          onClick={navigateToHome}
        >
          <h2 style={styles.logo}>
            GradeScape
          </h2>
        </div>
        
        {currentUser && (
          <div style={styles.userSection}>
            <div style={styles.userInfo}>
              <span style={styles.userEmail}>{currentUser.email}</span>
              <span style={styles.userRole}>Student</span>
            </div>
            <button 
              onClick={handleLogout} 
              style={styles.logoutButton}
              className="nav-button"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </FrostedGlass>
  );
};

const styles = {
  navbar: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 1000,
    transition: 'opacity 0.5s ease, transform 0.5s ease',
  },
  navbarContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 25px',
  },
  logoContainer: {
    cursor: 'pointer',
    transition: 'transform 0.3s ease',
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
  },
  userEmail: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
  },
  userRole: {
    color: '#AEB9E1',
    fontSize: '12px',
  },
  logoutButton: {
    backgroundColor: 'rgba(174, 185, 225, 0.1)',
    color: '#AEB9E1',
    border: '1px solid rgba(174, 185, 225, 0.3)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(5px)',
  },
};

export default Navbar;