// Global styles for consistent appearance across components
export const globalStyles = {
  // Color palette
  colors: {
    primary: '#6157FF',
    primaryDark: '#1F0F5C',
    primaryLight: '#9A8BD0',
    accent: '#7063A7',
    lightText: '#AEB9E1',
    darkText: '#333333',
    background: 'linear-gradient(135deg, #130A39 0%, #1F0F5C 50%, #341873 100%)',
    cardBg: 'rgba(255, 255, 255, 0.15)',
    error: '#f44336',
    success: '#4caf50',
    warning: '#ff9800',
    info: '#2196F3'
  },
  
  // Typography
  text: {
    title: {
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
    sectionTitle: {
      color: '#1F0F5C',
      fontSize: '20px',
      margin: '0 0 15px 0',
      fontWeight: 600,
    }
  },
  
  // Button styles
  buttons: {
    primary: {
      backgroundColor: 'rgba(97, 87, 255, 0.8)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      padding: '12px 24px',
      borderRadius: '12px',
      fontSize: '16px',
      cursor: 'pointer',
      fontWeight: 600,
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      boxShadow: '0 4px 12px rgba(97, 87, 255, 0.3)',
      backdropFilter: 'blur(5px)',
    },
    secondary: {
      backgroundColor: 'rgba(174, 185, 225, 0.1)',
      color: '#AEB9E1',
      border: '1px solid rgba(174, 185, 225, 0.3)',
      padding: '12px 24px',
      borderRadius: '12px',
      fontSize: '16px',
      cursor: 'pointer',
      fontWeight: 600,
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(5px)',
    },
    disabled: {
      backgroundColor: 'rgba(204, 204, 204, 0.3)',
      color: 'rgba(102, 102, 102, 0.8)',
      border: '1px solid rgba(204, 204, 204, 0.5)',
      padding: '12px 24px',
      borderRadius: '12px',
      fontSize: '16px',
      cursor: 'not-allowed',
      opacity: 0.7,
      backdropFilter: 'blur(5px)',
    }
  },
  
  // Card styles
  cards: {
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    },
    glassHover: {
      transform: 'translateY(-5px)',
      boxShadow: '0 12px 25px rgba(0, 0, 0, 0.15)'
    },
    glassAccent: {
      backgroundColor: 'rgba(97, 87, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(97, 87, 255, 0.2)',
      border: '1px solid rgba(97, 87, 255, 0.3)',
    },
    glassDark: {
      backgroundColor: 'rgba(31, 15, 92, 0.25)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(97, 87, 255, 0.2)',
    }
  },

  // Form elements
  forms: {
    input: {
      width: '100%',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      fontSize: '16px',
      color: '#f0f0f0',
      transition: 'all 0.3s ease',
      outline: 'none',
    },
    select: {
      width: '100%',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      fontSize: '16px',
      color: '#f0f0f0',
      transition: 'all 0.3s ease',
      outline: 'none',
    }
  },
  
  // New frosted glass styles
  glass: {
    standard: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    },
    light: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
    },
    dark: {
      backgroundColor: 'rgba(19, 10, 57, 0.4)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      border: '1px solid rgba(97, 87, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    },
    accent: {
      backgroundColor: 'rgba(97, 87, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '16px',
      border: '1px solid rgba(97, 87, 255, 0.3)',
      boxShadow: '0 8px 32px rgba(97, 87, 255, 0.15)',
    },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    }
  },
  
  // Common animations (to be added as style tag)
  animations: `
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
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
      0% { opacity: 0; transform: translateY(10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .frosted-glass {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    
    .card-hover {
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .card-hover:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }
  `
};

// Function to add all global styles to the document
export const initializeGlobalStyles = () => {
  // Add CSS for animations
  const styleTag = document.createElement('style');
  styleTag.innerHTML = globalStyles.animations;
  document.head.appendChild(styleTag);
  
  // Add global body styles
  const bodyStyles = `
    body {
      margin: 0;
      padding: 0;
      background: ${globalStyles.colors.background};
      background-size: 200% 200%;
      animation: gradientShift 15s ease infinite;
      min-height: 100vh;
      overflow-x: hidden;
      font-family: 'Sansation', sans-serif;
      color: #f0f0f0;
    }
    
    #dashboard-particles {
      position: fixed;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      z-index: 0;
    }
    
    /* Frosted glass styles for common elements */
    input, select, textarea {
      background-color: rgba(255, 255, 255, 0.1) !important;
      backdrop-filter: blur(5px) !important;
      -webkit-backdrop-filter: blur(5px) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 12px !important;
      color: #f0f0f0 !important;
    }
    
    button {
      backdrop-filter: blur(5px) !important;
      -webkit-backdrop-filter: blur(5px) !important;
      border-radius: 12px !important;
    }
    
    table {
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      background-color: rgba(255, 255, 255, 0.1) !important;
      border-radius: 16px !important;
      overflow: hidden !important;
    }
    
    th, td {
      background-color: rgba(255, 255, 255, 0.05) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
  `;
  
  const bodyStyleTag = document.createElement('style');
  bodyStyleTag.innerHTML = bodyStyles;
  document.head.appendChild(bodyStyleTag);
  
  return () => {
    document.head.removeChild(styleTag);
    document.head.removeChild(bodyStyleTag);
  };
};

// Particle configuration for consistent particle effects
export const particleConfig = {
  "particles": {
    "number": {
      "value": 50,
      "density": {
        "enable": true,
        "value_area": 800
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
};