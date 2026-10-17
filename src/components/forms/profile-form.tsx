"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { FormMessage, TextField } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

export function ProfileForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [state, formAction] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <TextField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        defaultValue={state.values?.firstName ?? firstName}
        error={state.fieldErrors?.firstName}
      />
      <TextField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        defaultValue={state.values?.lastName ?? lastName}
        error={state.fieldErrors?.lastName}
      />
      <SubmitButton pendingLabel="Saving...">Save profile</SubmitButton>
    </form>
  );
}
