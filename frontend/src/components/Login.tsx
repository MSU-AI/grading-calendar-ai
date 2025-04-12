import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from './common/ParticleBackground';
import FrostedGlass from './common/FrostedGlass';
import { Input, Button, Alert } from './common/index';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Add animation effects
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .login-card-animation {
        animation: cardFadeIn 0.6s ease-out forwards;
      }
      
      @keyframes cardFadeIn {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .separator {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 20px 0;
        color: #AEB9E1;
      }
      
      .separator::before,
      .separator::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid rgba(174, 185, 225, 0.3);
      }
      
      .separator::before {
        margin-right: 10px;
      }
      
      .separator::after {
        margin-left: 10px;
      }
      
      .logo-glow {
        filter: drop-shadow(0 0 8px rgba(97, 87, 255, 0.6));
        transition: filter 0.3s ease;
      }
      
      .logo-glow:hover {
        filter: drop-shadow(0 0 12px rgba(97, 87, 255, 0.8));
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

  const navigateToHome = () => {
    navigate('/');
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
      {/* Custom particle background matching landing page */}
      <ParticleBackground 
        id="login-particles" 
        config={{
          particles: {
            number: {
              value: 80,
              density: { enable: true, value_area: 800 }
            },
            color: {
              value: ["#AEB9E1", "#9A8BD0", "#7063A7", "#6157FF"]
            },
            opacity: {
              value: 0.6,
              random: true,
              anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false }
            },
            size: {
              value: 4,
              random: true
            },
            line_linked: {
              enable: true,
              distance: 150,
              color: "#AEB9E1",
              opacity: 0.4,
              width: 1
            },
            move: {
              enable: true,
              speed: 6,
              direction: "none",
              random: false,
              straight: false,
              out_mode: "out",
              bounce: false
            }
          },
          interactivity: {
            detect_on: "canvas",
            events: {
              onhover: {
                enable: true,
                mode: "repulse"
              },
              onclick: {
                enable: true,
                mode: "push"
              },
              resize: true
            }
          }
        }}
      />
      
      <div style={styles.pageContainer}>
        {/* Navigation Bar */}
        <FrostedGlass
          variant="dark" 
          blur={8} 
          elevation="high"
          style={styles.navbar}
          className={fadeIn ? 'login-card-animation' : ''}
        >
          <div style={styles.navbarContent}>
            {/* Logo */}
            <div 
              style={styles.logoContainer} 
              className="card-hover"
              onClick={navigateToHome}
            >
              <h2 style={{
              margin: 0,
              color: 'white',
              fontSize: '1.5rem',
              fontWeight: 600,
              background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>GradeScape</h2>
            </div>
          </div>
        </FrostedGlass>
      
        <FrostedGlass 
          variant="dark"
          blur={12}
          elevation="high"
          radius={12}
          style={styles.card}
          className={fadeIn ? 'login-card-animation' : ''}
        >
        
          <h2 style={styles.title}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={styles.subtitle}>
            {isSignUp 
              ? 'Sign up to start tracking your academic progress' 
              : 'Sign in to access your grade predictions'}
          </p>
          
          {error && (
            <Alert type="error" style={styles.alert}>{error}</Alert>
          )}
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="input-field">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                label="Email Address"
                id="email"
                style={styles.input}
              />
            </div>
            
            <div className="input-field">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                label="Password"
                id="password"
                style={styles.input}
              />
            </div>
            
            <Button 
              type="submit" 
              variant="primary" 
              fullWidth 
              style={styles.submitButton}
            >
              {isSignUp ? 'Sign Up' : 'Login'}
            </Button>
          </form>

          <div className="separator">OR</div>

          <Button 
            onClick={handleGoogleSignIn} 
            variant="secondary"
            fullWidth
            icon={<GoogleLogo />}
            style={styles.googleButton}
          >
            Continue with Google
          </Button>

          <p style={styles.toggle}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span
              onClick={() => setIsSignUp(!isSignUp)}
              style={styles.toggleLink}
            >
              {isSignUp ? 'Login' : 'Sign Up'}
            </span>
          </p>
        </FrostedGlass>
      </div>
    </>
  );
};

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  navbar: {
    width: '100%',
    position: 'fixed' as const,
    top: 0,
    zIndex: 100,
  },
  navbarContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1rem 2rem',
  },
  logoContainer: {
    cursor: 'pointer',
    transition: 'transform 0.3s ease',
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    height: '40px',
    width: 'auto',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  cardLogoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  cardLogo: {
    height: '60px',
    width: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    zIndex: 1,
    padding: '32px',
    opacity: 0, 
    border: '1px solid rgba(174, 185, 225, 0.2)',
  },
  title: {
    textAlign: 'center' as const,
    marginBottom: '0.5rem',
    color: 'white',
    fontSize: '28px',
    fontWeight: 600,
    background: 'linear-gradient(90deg, #FFFFFF, #AEB9E1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
    color: '#AEB9E1',
    fontSize: '16px',
  },
  alert: {
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  submitButton: {
    marginTop: '10px',
    background: 'linear-gradient(90deg, #7063A7, #6157FF)',
    boxShadow: '0 4px 15px rgba(97, 87, 255, 0.4)',
  },
  googleButton: {
    fontWeight: 500,
    padding: '12px',
  },
  toggle: {
    marginTop: '1.5rem',
    textAlign: 'center' as const,
    color: '#AEB9E1',
    fontSize: '14px',
  },
  toggleLink: {
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500,
    textDecoration: 'underline',
  },
};

export default Login;
