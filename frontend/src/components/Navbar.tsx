import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div style={styles.navbar}>
      <div style={styles.logo}>
        GradeScape
      </div>
      {currentUser && (
        <div style={styles.userSection}>
          <span style={styles.userEmail}>{currentUser.email}</span>
          <button onClick={handleLogout} style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: 'rgba(174, 185, 225, 0.05)',
                color: '#AEB9E1',
                border: '1px solid #7063A7',
                borderRadius: '4px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'Sansation, sans-serif',
                pointerEvents: 'auto',
                transition: 'all 0.3s ease',
              }}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #130A39 0%, #1F0F5C 50%, #341873 100%)',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  logo: {
    margin: 0,
    color: 'white',
    fontSize: '1.5rem',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userEmail: {
    color: '#AEB9E1',
    fontSize: '0.9rem',
  },
};

export default Navbar;
