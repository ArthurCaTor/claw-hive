// Card component
// Container with border and padding

export function Card({ 
  children, 
  title,
  subtitle,
  actions,
  padding = 'md',
  className = '',
  style = {},
  ...props 
}) {
  const paddingSizes = {
    sm: '8px',
    md: '16px',
    lg: '24px',
    none: '0',
  };

  const baseStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: paddingSizes[padding],
    color: '#e2e8f0',
  };

  return (
    <div style={{ ...baseStyle, ...style }} className={className} {...props}>
      {(title || subtitle || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: children ? '12px' : '0' }}>
          <div>
            {title && <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{title}</h3>}
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;
