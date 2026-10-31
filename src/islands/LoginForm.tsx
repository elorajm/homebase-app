import { useState, type FormEvent } from "react";
import { toFieldErrors, type FieldErrors } from "@/lib/field-errors";
import { VALIDATION_ERROR_MESSAGE } from "@/lib/messages";
import { loginSchema } from "@/lib/validation";
import { postJson } from "@/islands/api-client";
import { FormMessage, TextField } from "@/islands/form-fields";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      setFormError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result = await postJson("/api/auth/login", parsed.data);
    if (result.ok) {
      window.location.assign("/dashboard");
      return;
    }

    setFormError(result.error);
    setFieldErrors(result.fieldErrors);
    setPending(false);
  }

  return (
    <form className="stack" noValidate onSubmit={handleSubmit}>
      <FormMessage error={formError} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={fieldErrors.password}
      />
      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
