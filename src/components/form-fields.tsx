type FieldMessages = {
  error?: string;
  hint?: string;
};

type FieldBaseProps = FieldMessages & {
  label: string;
  name: string;
  defaultValue?: string;
};

function describedBy(name: string, { error, hint }: FieldMessages): string | undefined {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldHelp({ name, error, hint }: FieldMessages & { name: string }) {
  return (
    <>
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
    </>
  );
}

type TextFieldProps = FieldBaseProps & {
  type?: "text" | "email" | "password" | "date";
  autoComplete?: string;
  maxLength?: number;
};

export function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  autoComplete,
  maxLength,
  error,
  hint,
}: TextFieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, { error, hint })}
      />
      <FieldHelp name={name} error={error} hint={hint} />
    </div>
  );
}

type TextAreaFieldProps = FieldBaseProps & {
  maxLength?: number;
};

export function TextAreaField({ label, name, defaultValue, maxLength, error, hint }: TextAreaFieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, { error, hint })}
      />
      <FieldHelp name={name} error={error} hint={hint} />
    </div>
  );
}

type SelectFieldProps = FieldBaseProps & {
  options: { value: string; label: string }[];
};

export function SelectField({ label, name, defaultValue, options, error, hint }: SelectFieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, { error, hint })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldHelp name={name} error={error} hint={hint} />
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="message message--error">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="message message--success">
        {success}
      </p>
    );
  }
  return null;
}
