import React from 'react';
// Button component
// Reusable button with variants

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props 
}) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    opacity: disabled ? 0.5 : 1,
  };

  const sizes = {
    sm: { padding: '4px 8px', fontSize: '12px' },
    md: { padding: '8px 16px', fontSize: '14px' },
    lg: { padding: '12px 24px', fontSize: '16px' },
  };

  const variants = {
    primary: { background: '#3b82f6', color: '#fff' },
    secondary: { background: '#6b7280', color: '#fff' },
    success: { background: '#22c55e', color: '#fff' },
    danger: { background: '#ef4444', color: '#fff' },
    ghost: { background: 'transparent', color: '#9ca3af', border: '1px solid #374151' },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...baseStyles, ...sizes[size], ...variants[variant] }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
