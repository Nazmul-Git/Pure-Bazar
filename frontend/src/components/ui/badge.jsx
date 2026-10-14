export default function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`ui-badge badge-${tone} ${className}`.trim()}>{children}</span>;
}