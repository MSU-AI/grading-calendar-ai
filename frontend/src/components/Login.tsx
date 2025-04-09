import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    particlesJS: (id: string, config: object) => void;
  }
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to ' + (isSignUp ? 'sign up' : 'sign in'));
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to sign in with Google');
      console.error(err);
    }
  };

  // Google G logo SVG
  const GoogleLogo = () => (
    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );

  return (
    <>
      <div id="particles-js"></div>
      
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>{isSignUp ? 'Sign Up' : 'Login'}</h2>
          
          {error && <p style={styles.error}>{error}</p>}
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.button}>
              {isSignUp ? 'Sign Up' : 'Login'}
            </button>
          </form>

          <button onClick={handleGoogleSignIn} style={styles.googleButton}>
            <div style={styles.googleButtonContent}>
              <GoogleLogo />
              <span style={styles.googleButtonText}>Sign in with Google</span>
            </div>
          </button>

          <p style={styles.toggle}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span
              onClick={() => setIsSignUp(!isSignUp)}
              style={styles.toggleLink}
            >
              {isSignUp ? 'Login' : 'Sign Up'}
            </span>
          </p>
        </div>
      </div>
    </>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
  },
  card: {
    padding: '2rem',
    backgroundColor: '#1E1350',
    borderRadius: '8px',
    boxShadow: '0px 0px 20px 8px  #3E28A2',
    width: '100%',
    maxWidth: '400px',
    zIndex: 1,
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
    color: '#AEB9E1',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  input: {
    padding: '0.75rem',
    backgroundColor: '#130A39',
    borderRadius: '4px',
    border: '1px solid rgba(174, 185, 225, 0.4)',
    fontSize: '1rem',
    color: '#AEB9E1',
  },
  button: {
    padding: '0.75rem',
    backgroundColor: '#7063A7',
    color: '#AEB9E1',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    marginTop: '1rem',
    padding: '0.75rem',
    backgroundColor: 'white',
    color: '#444',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  },
  googleButtonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  googleButtonText: {
    marginLeft: '10px',
    fontWeight: '500' as const,
  },
  error: {
    color: '#dc3545',
    textAlign: 'center' as const,
    marginBottom: '1rem',
  },
  toggle: {
    marginTop: '1rem',
    textAlign: 'center' as const,
    color: '#AEB9E1',
  },
  toggleLink: {
    color: 'rgb(159, 139, 247)',
    cursor: 'pointer',
  },
};

export default Login;