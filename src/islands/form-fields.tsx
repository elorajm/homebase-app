type FieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "date";
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, name, type = "text", autoComplete, defaultValue, hint, error }: FieldProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
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

type TextAreaProps = {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
};

export function TextAreaField({ label, name, defaultValue, hint, error }: TextAreaProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
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

type SelectProps = {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  error?: string;
};

export function SelectField({ label, name, options, defaultValue, hint, error }: SelectProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
