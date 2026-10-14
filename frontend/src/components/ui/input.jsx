export default function Input({ label, error, id, className = '', ...props }) {
  const inputId = id ?? props.name;
  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={inputId}>
      {label && <span className="field-label">{label}</span>}
      <input id={inputId} className={`ui-input${error ? ' field-invalid' : ''}`} aria-invalid={Boolean(error)} {...props} />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}