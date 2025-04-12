import React, { useEffect } from 'react';

// TypeScript type declaration for particlesJS
declare global {
  interface Window {
    particlesJS: (id: string, config: object) => void;
  }
}

// Default particle configuration
export const defaultParticleConfig = {
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

interface ParticleBackgroundProps {
  id?: string;
  config?: object;
  className?: string;
  style?: React.CSSProperties;
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  id = 'particles-js',
  config = defaultParticleConfig,
  className = '',
  style = {},
}) => {
  useEffect(() => {
    // Dynamically load particles.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize particles.js after script is loaded
      window.particlesJS(id, config);
    };
    document.body.appendChild(script);

    // Cleanup
    return () => {
      const scriptElement = document.querySelector('script[src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"]');
      if (scriptElement) document.body.removeChild(scriptElement);
    };
  }, [id, config]);

  return (
    <div 
      id={id} 
      className={className}
      style={{
        position: 'fixed',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: 0,
        ...style
      }}
    ></div>
  );
};

export default ParticleBackground;