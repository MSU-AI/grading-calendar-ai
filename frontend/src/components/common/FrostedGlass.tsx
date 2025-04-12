import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export interface FrostedGlassProps {
  children: React.ReactNode;
  variant?: 'standard' | 'light' | 'dark' | 'accent';
  opacity?: number;
  blur?: number;
  background?: string;
  border?: string;
  borderWidth?: number;
  padding?: number | string;
  radius?: number;
  shadow?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hover?: boolean;
  elevation?: 'low' | 'medium' | 'high';
}

/**
 * FrostedGlass Component
 * A reusable component that adds a frosted glass effect to any content
 */
const FrostedGlass: React.FC<FrostedGlassProps> = ({ 
  children, 
  variant = 'standard',
  opacity,
  blur,
  background,
  border,
  borderWidth = 1,
  padding = 20,
  radius,
  shadow,
  className = '',
  style = {},
  onClick,
  hover = false,
  elevation = 'medium',
}) => {
  const { theme } = useTheme();
  
  // Set up base styles based on variant
  let baseStyles: React.CSSProperties = { ...theme.glass.standard };
  if (variant === 'light') {
    baseStyles = { ...theme.glass.light };
  } else if (variant === 'dark') {
    baseStyles = { ...theme.glass.dark };
  } else if (variant === 'accent') {
    baseStyles = { ...theme.glass.accent };
  }
  
  // Apply elevation if specified
  if (elevation === 'low') {
    baseStyles.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
  } else if (elevation === 'high') {
    baseStyles.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.15)';
  }
  
  // Apply hover effect
  const hoverClass = hover ? 'card-hover' : '';
  
  // Override with custom properties if provided
  if (opacity !== undefined) {
    baseStyles.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
  }
  if (blur !== undefined) {
    baseStyles.backdropFilter = `blur(${blur}px)`;
    baseStyles.WebkitBackdropFilter = `blur(${blur}px)`;
  }
  if (background !== undefined) {
    baseStyles.backgroundColor = background;
  }
  if (border !== undefined) {
    baseStyles.borderColor = border;
  }
  if (borderWidth !== undefined) {
    baseStyles.borderWidth = `${borderWidth}px`;
  }
  if (padding !== undefined) {
    baseStyles.padding = padding;
  }
  if (radius !== undefined) {
    baseStyles.borderRadius = `${radius}px`;
  }
  if (shadow !== undefined) {
    baseStyles.boxShadow = shadow;
  }
  
  return (
    <div 
      className={`frosted-glass ${hoverClass} ${className}`}
      style={{
        ...baseStyles,
        ...style,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default FrostedGlass;