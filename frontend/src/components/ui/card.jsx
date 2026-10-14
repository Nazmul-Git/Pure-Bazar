export default function Card({ title, description, actions, children, className = '' }) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || actions) && (
        <header className="card-header">
          <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-content">{children}</div>
    </section>
  );
}