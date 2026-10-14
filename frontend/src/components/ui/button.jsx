export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button className={`ui-button button-${variant} button-${size} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}