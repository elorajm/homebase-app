"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage, TextField } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Logging in...">Log in</SubmitButton>
    </form>
  );
}
