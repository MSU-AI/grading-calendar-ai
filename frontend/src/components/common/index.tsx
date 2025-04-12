import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Button component definition
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  type = 'button',
  icon,
  size = 'medium',
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  // Determine the button style based on variant
  let buttonStyle: React.CSSProperties = {
    ...theme.buttons.primary,
    ...style,
  };
  
  if (variant === 'secondary') {
    buttonStyle = {
      ...theme.buttons.secondary,
      ...style,
    };
  } else if (variant === 'danger') {
    buttonStyle = {
      ...theme.buttons.primary,
      backgroundColor: theme.colors.error,
      ...style,
    };
  }
  
  // Apply disabled styles
  if (disabled) {
    buttonStyle = {
      ...theme.buttons.disabled,
      ...style,
    };
  }
  
  // Apply size adjustments
  if (size === 'small') {
    buttonStyle = {
      ...buttonStyle,
      padding: '8px 16px',
      fontSize: '14px',
    };
  } else if (size === 'large') {
    buttonStyle = {
      ...buttonStyle,
      padding: '14px 28px',
      fontSize: '18px',
    };
  }
  
  // Apply full width if needed
  if (fullWidth) {
    buttonStyle = {
      ...buttonStyle,
      width: '100%',
    };
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`gs-button ${className}`}
      style={buttonStyle}
    >
      {icon && <span className="button-icon">{icon}</span>}
      {children}
    </button>
  );
};

// Card component
interface CardProps {
  children: React.ReactNode;
  variant?: 'standard' | 'accent' | 'dark' | 'light';
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
  padding?: number | string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'standard',
  hover = false,
  className = '',
  style = {},
  padding,
}) => {
  const { theme } = useTheme();
  
  // Determine the base card style based on variant
  let cardStyle: React.CSSProperties = {
    ...(variant === 'accent' ? theme.cards.glassAccent :
        variant === 'dark' ? theme.cards.glassDark :
        variant === 'light' ? { ...theme.cards.glass, backgroundColor: 'rgba(255, 255, 255, 0.08)' } :
        theme.cards.glass),
    ...style,
  };
  
  // Apply custom padding if provided
  if (padding !== undefined) {
    cardStyle.padding = padding;
  }
  
  return (
    <div
      className={`gs-card ${hover ? 'card-hover' : ''} ${className}`}
      style={cardStyle}
    >
      {children}
    </div>
  );
};

// Input component
interface InputProps {
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
  className = '',
  style = {},
  id,
}) => {
  const { theme } = useTheme();
  
  const inputStyle = {
    ...theme.forms.input,
    ...style,
    ...(error ? { borderColor: theme.colors.error } : {}),
  };
  
  return (
    <div className="gs-input-wrapper" style={{ marginBottom: '16px' }}>
      {label && (
        <label 
          style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 600, 
            color: error ? theme.colors.error : theme.colors.lightText 
          }}
          htmlFor={id}
        >
          {label} {required && <span style={{ color: theme.colors.error }}>*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`gs-input ${className}`}
        style={inputStyle}
        required={required}
      />
      {error && (
        <div style={{ color: theme.colors.error, fontSize: '14px', marginTop: '5px' }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Select component
interface SelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
  className = '',
  style = {},
  id,
}) => {
  const { theme } = useTheme();
  
  const selectStyle = {
    ...theme.forms.select,
    ...style,
    ...(error ? { borderColor: theme.colors.error } : {}),
  };
  
  return (
    <div className="gs-select-wrapper" style={{ marginBottom: '16px' }}>
      {label && (
        <label 
          style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 600, 
            color: error ? theme.colors.error : theme.colors.lightText 
          }}
          htmlFor={id}
        >
          {label} {required && <span style={{ color: theme.colors.error }}>*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`gs-select ${className}`}
        style={selectStyle}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <div style={{ color: theme.colors.error, fontSize: '14px', marginTop: '5px' }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Alert component
interface AlertProps {
  children: React.ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  type = 'info',
  className = '',
  style = {},
  onClose,
}) => {
  const { theme } = useTheme();
  
  // Determine the alert color based on type
  const getAlertColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'error':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      case 'info':
      default:
        return theme.colors.info;
    }
  };
  
  const alertStyle: React.CSSProperties = {
    color: 'white',
    backgroundColor: getAlertColor(),
    padding: '12px 16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 500,
    marginBottom: '15px',
    position: 'relative',
    ...style,
  };
  
  return (
    <div className={`gs-alert gs-alert-${type} ${className}`} style={alertStyle}>
      {children}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            width: '24px',
            height: '24px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

// Loading Spinner component
interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  color,
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  // Determine size in pixels
  const getSizeInPixels = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 32;
      case 'medium':
      default:
        return 24;
    }
  };
  
  // Default color is primary if not provided
  const spinnerColor = color || theme.colors.primary;
  
  const spinnerStyle: React.CSSProperties = {
    display: 'inline-block',
    width: `${getSizeInPixels()}px`,
    height: `${getSizeInPixels()}px`,
    border: `3px solid rgba(${spinnerColor}, 0.3)`,
    borderRadius: '50%',
    borderTopColor: spinnerColor,
    animation: 'spin 1s ease-in-out infinite',
    ...style,
  };
  
  return (
    <div className={`gs-spinner ${className}`} style={spinnerStyle}></div>
  );
};

// Badge component
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  background?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color,
  background,
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: color || 'white',
    backgroundColor: background || theme.colors.primary,
    ...style,
  };
  
  return (
    <span className={`gs-badge ${className}`} style={badgeStyle}>
      {children}
    </span>
  );
};

// Empty State component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  const emptyStateStyle: React.CSSProperties = {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: theme.colors.lightText,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    margin: '20px 0',
    ...style,
  };
  
  return (
    <div className={`gs-empty-state ${className}`} style={emptyStateStyle}>
      <div style={{ fontSize: '48px', marginBottom: '15px' }}>{icon}</div>
      <h3 style={{ margin: '0 0 10px 0', color: theme.colors.primaryDark, fontSize: '18px' }}>
        {title}
      </h3>
      <p style={{ maxWidth: '400px', lineHeight: 1.5, marginBottom: action ? '20px' : '0' }}>
        {description}
      </p>
      {action}
    </div>
  );
};

// Section Title component
interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  children,
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  return (
    <h3 
      className={`gs-section-title ${className}`} 
      style={{
        ...theme.text.sectionTitle,
        ...style,
      }}
    >
      {children}
    </h3>
  );
};

// Tip component
interface TipProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Tip: React.FC<TipProps> = ({
  children,
  icon = "💡",
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  const tipStyle: React.CSSProperties = {
    backgroundColor: theme.colors.primary + '14', // 14 is 0.08 in hex (8% opacity)
    padding: '15px',
    borderRadius: '8px',
    marginTop: '15px',
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    ...style,
  };
  
  return (
    <div className={`gs-tip ${className}`} style={tipStyle}>
      <div style={{ fontSize: '20px' }}>{icon}</div>
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
};

// StatusBadge component for showing status
interface StatusBadgeProps {
  status: string;
  className?: string;
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  style = {},
}) => {
  const { theme } = useTheme();
  
  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '0.9em',
    fontWeight: 500,
    backgroundColor: (() => {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'processed' || lowerStatus === 'completed' || lowerStatus === 'success') {
        return theme.colors.success;
      } else if (lowerStatus === 'processing' || lowerStatus === 'uploaded' || lowerStatus === 'extracted') {
        return theme.colors.warning;
      } else if (lowerStatus === 'error' || lowerStatus === 'failed') {
        return theme.colors.error;
      } else {
        return theme.colors.primary;
      }
    })(),
    ...style,
  };
  
  return (
    <span className={`gs-status-badge ${className}`} style={badgeStyle}>
      {status}
    </span>
  );
};

// ProgressBar component
interface ProgressBarProps {
  progress: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 20,
  className = '',
  style = {},
  showLabel = true,
}) => {
  const { theme } = useTheme();
  
  // Ensure progress is within bounds
  const safeProgress = Math.min(Math.max(progress, 0), 100);
  
  // Determine color based on progress
  const getProgressColor = () => {
    if (safeProgress === 100) return theme.colors.success;
    if (safeProgress > 70) return theme.colors.info;
    if (safeProgress > 30) return theme.colors.primary;
    return theme.colors.warning;
  };
  
  const containerStyle: React.CSSProperties = {
    height: `${height}px`,
    backgroundColor: '#e0e0e0',
    borderRadius: `${height / 2}px`,
    overflow: 'hidden',
    ...style,
  };
  
  const fillStyle: React.CSSProperties = {
    height: '100%',
    width: `${safeProgress}%`,
    backgroundColor: getProgressColor(),
    transition: 'width 0.3s ease',
  };
  
  return (
    <div className="gs-progress-container">
      <div className={`gs-progress-bar ${className}`} style={containerStyle}>
        <div className="gs-progress-fill" style={fillStyle}></div>
      </div>
      {showLabel && (
        <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '14px', color: '#666' }}>
          {safeProgress}% Complete
        </div>
      )}
    </div>
  );
};
