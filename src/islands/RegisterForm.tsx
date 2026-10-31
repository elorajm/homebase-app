import { useState, type FormEvent } from "react";
import { toFieldErrors, type FieldErrors } from "@/lib/field-errors";
import { VALIDATION_ERROR_MESSAGE } from "@/lib/messages";
import { registerSchema } from "@/lib/validation";
import { postJson } from "@/islands/api-client";
import { FormMessage, TextField } from "@/islands/form-fields";

export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
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

    const result = await postJson("/api/auth/register", parsed.data);
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
        label="First name"
        name="firstName"
        autoComplete="given-name"
        error={fieldErrors.firstName}
      />
      <TextField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        error={fieldErrors.lastName}
      />
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
        autoComplete="new-password"
        hint="Use at least 8 characters."
        error={fieldErrors.password}
      />
      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
