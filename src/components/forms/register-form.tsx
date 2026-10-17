"use client";

import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { FormMessage, TextField } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(register, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} />
      <TextField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        defaultValue={state.values?.firstName}
        error={state.fieldErrors?.firstName}
      />
      <TextField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        defaultValue={state.values?.lastName}
        error={state.fieldErrors?.lastName}
      />
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
        autoComplete="new-password"
        hint="Use at least 8 characters."
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Creating account...">Create account</SubmitButton>
    </form>
  );
}
