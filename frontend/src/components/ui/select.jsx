export default function Select({ label, error, id, options = [], className = '', children, ...props }) {
  const selectId = id ?? props.name;
  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={selectId}>
      {label && <span className="field-label">{label}</span>}
      <select id={selectId} className={`ui-select${error ? ' field-invalid' : ''}`} aria-invalid={Boolean(error)} {...props}>
        {children ?? options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}