import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// TypeScript type declaration for particlesJS
declare global {
  interface Window {
    particlesJS: (id: string, config: object) => void;
  }
}

const GradingAILanding = () => {
  const navigate = useNavigate();

  const handleSignIn = async () => {
    try {
      navigate('/Login');
    } catch (error) {
      console.error('Failed to move to log in:', error);
    }
  };

  useEffect(() => {
    // Add global styles
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @font-face {
        font-family: 'Sansation';
        src: url('https://fonts.cdnfonts.com/css/sansation') format('woff2');
        font-weight: 400;
        font-style: normal;
      }
      
      body {
        margin: 0;
        background: linear-gradient(135deg, #130A39 0%, #1F0F5C 50%, #341873 100%);
        overflow-x: hidden;
        font-family: 'Sansation', sans-serif;
      }
      
      #particles-js {
        position: fixed;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 0;
      }
      
      .glow {
        filter: drop-shadow(0 0 8px rgba(174, 185, 225, 0.6));
      }
      
      @keyframes gradientBorder {
        0% { border-color: #7063A7; }
        50% { border-color: #9A8BD0; }
        100% { border-color: #7063A7; }
      }
      
      
      .card-hover {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      
      .card-hover:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(styleTag);

    // Dynamically load particles.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize particles.js after script is loaded
      window.particlesJS('particles-js', {
        "particles": {
          "number": {
            "value": 80,
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
            },
            "polygon": {
              "nb_sides": 5
            }
          },
          "opacity": {
            "value": 0.6,
            "random": true,
            "anim": {
              "enable": true,
              "speed": 1,
              "opacity_min": 0.1,
              "sync": false
            }
          },
          "size": {
            "value": 4,
            "random": true,
            "anim": {
              "enable": false,
              "speed": 40,
              "size_min": 0.1,
              "sync": false
            }
          },
          "line_linked": {
            "enable": true,
            "distance": 150,
            "color": "#AEB9E1",
            "opacity": 0.4,
            "width": 1
          },
          "move": {
            "enable": true,
            "speed": 6,
            "direction": "none",
            "random": false,
            "straight": false,
            "out_mode": "out",
            "bounce": false,
            "attract": {
              "enable": false,
              "rotateX": 600,
              "rotateY": 1200
            }
          }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": {
            "onhover": {
              "enable": true,
              "mode": "repulse"
            },
            "onclick": {
              "enable": true,
              "mode": "push"
            },
            "resize": true
          },
          "modes": {
            "grab": {
              "distance": 400,
              "line_linked": {
                "opacity": 1
              }
            },
            "bubble": {
              "distance": 400,
              "size": 40,
              "duration": 2,
              "opacity": 8,
              "speed": 3
            },
            "repulse": {
              "distance": 200,
              "duration": 0.4
            },
            "push": {
              "particles_nb": 4
            },
            "remove": {
              "particles_nb": 2
            }
          }
        },
        "retina_detect": false
      });
    };
    document.body.appendChild(script);

    // Cleanup
    return () => {
      document.head.removeChild(styleTag);
      const scriptElement = document.querySelector('script[src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"]');
      if (scriptElement) document.body.removeChild(scriptElement);
    };
  }, []);

  return (
    <>
      <div id="particles-js"></div>
      
      
      
      {/* Content container with pointer-events: none to allow particle interaction */}
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '2rem',
        pointerEvents: 'none',
        zIndex: 1
      }}>
        {/* Navigation Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          marginBottom: '4rem',
          pointerEvents: 'none'
        }}>
          {/* Logo Left */}
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
      
            <h2 style={{
              margin: 0,
              color: 'white',
              fontSize: '1.5rem',
              fontWeight: 600,
              background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Grading AI</h2>
          </div>
          
          {/* Buttons Right */}
          <div style={{
            display: 'flex',
            gap: '1rem'
          }}>
            <button style={{
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
            }}
            className="animated-border">
              Log In
            </button>
            <button onClick = {handleSignIn} style={{
              padding: '0.5rem 1.25rem',
              background: 'linear-gradient(90deg, #7063A7, #6157FF)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'Sansation, sans-serif',
              pointerEvents: 'auto',
              boxShadow: '0 4px 12px rgba(97, 87, 255, 0.3)',
              transition: 'all 0.3s ease'
            }}>
              Sign Up
            </button>
          </div>
        </div>
        
        {/* Hero Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'left',
          textAlign: 'left',
          maxWidth: '900px',
          marginBottom: '5rem',
          pointerEvents: 'none'
        }}>
          <h1 style={{
            fontSize: '3.5rem',
            color: 'white',
            marginBottom: '1.5rem',
            fontWeight: 700,
            lineHeight: 1.2,
            fontFamily: 'Sansation, sans-serif',
            textShadow: '0 2px 10px rgba(97, 87, 255, 0.3)',
            background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          className="glow">
            Empower your learning journey with AI-driven insights into your grades.
          </h1>
          <p style={{
            fontSize: '1.4rem',
            color: 'rgba(255, 255, 255, 0.8)',
            maxWidth: '800px',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
            fontFamily: 'Sansation, sans-serif'
          }}>
            Get personalized predictions and actionable tips to improve your performance and achieve your academic goals.
          </p>
          <button style={{
            padding: '0.9rem 2.5rem',
            background: 'linear-gradient(90deg, #7063A7, #6157FF)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: 'Sansation, sans-serif',
            pointerEvents: 'auto',
            boxShadow: '0 4px 15px rgba(97, 87, 255, 0.4)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
          }}>
            Get Started Today
          </button>
        </div>

        {/* Feature Cards */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '2rem',
          maxWidth: '1200px',
          width: '100%',
          marginTop: '1rem',
          pointerEvents: 'none'
        }}>
          {/* Smart Assessment Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(5px)',
            borderRadius: '8px',
            padding: '1.5rem',
            flex: '1 1 300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(97, 87, 255, 0.1)',
            border: '1px solid rgba(174, 185, 225, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            fontFamily: 'Sansation, sans-serif',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(97, 87, 255, 0.05))'
          }}
          className="card-hover">
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#FFACAB,#FF7876)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 10px rgba(97, 87, 255, 0.3)'
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8V16M8 12H16M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '0.5rem',
              background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Smart Assessment</h3>
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.6
            }}>
              AI-powered grading that's fair and effective
            </p>
          </div>
          
          {/* Detailed Feedback Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(5px)',
            borderRadius: '8px',
            padding: '1.5rem',
            flex: '1 1 300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(97, 87, 255, 0.1)',
            border: '1px solid rgba(174, 185, 225, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            fontFamily: 'Sansation, sans-serif',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(154, 139, 208, 0.05))'
          }}
          className="card-hover">
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C1E1C1, #2CD42C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 10px rgba(154, 139, 208, 0.3)'
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12H15M9 16H15M9 8H15M5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '0.5rem',
              background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Detailed Feedback</h3>
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.6
            }}>
              Provides students with actionable insights into their grades
            </p>
          </div>
          
          {/* Customizable Scaling Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(5px)',
            borderRadius: '8px',
            padding: '1.5rem',
            flex: '1 1 300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 20px rgba(97, 87, 255, 0.1)',
            border: '1px solid rgba(174, 185, 225, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            fontFamily: 'Sansation, sans-serif',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(112, 99, 167, 0.05))'
          }}
          className="card-hover">
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #9CA3D6, #2E2EEF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 10px rgba(174, 185, 225, 0.3)'
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 11L12 6L17 11M17 13L12 18L7 13" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: 600,
              color: 'white',
              marginBottom: '0.5rem',
              background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Customizable Scaling</h3>
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.6
            }}>
              Automatically customizes grading criteria to match your courses
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default GradingAILanding;