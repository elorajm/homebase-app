type FieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, name, type = "text", autoComplete, hint, error }: FieldProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint ? (
        <p id={`${name}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ error }: { error?: string }) {
  if (!error) {
    return null;
  }
  return (
    <p role="alert" className="message message--error">
      {error}
    </p>
  );
}
