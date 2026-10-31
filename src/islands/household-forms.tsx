import { useState, type FormEvent } from "react";
import { toFieldErrors, type FieldErrors } from "@/lib/field-errors";
import type { HouseholdDetails } from "@/lib/household-details";
import { ALREADY_IN_HOUSEHOLD_MESSAGE, VALIDATION_ERROR_MESSAGE } from "@/lib/messages";
import { householdNameSchema, joinHouseholdSchema } from "@/lib/validation";
import { postJson } from "@/islands/api-client";
import { FormMessage, TextField } from "@/islands/form-fields";
import { loadHousehold, setHousehold } from "@/stores/household";

type FormProps = {
  onSuccess: (message: string) => void;
  onAlreadyMember: () => void;
};

type CreatedResponse = { household: HouseholdDetails };

export function CreateHouseholdForm({ onSuccess, onAlreadyMember }: FormProps) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = householdNameSchema.safeParse({ name: form.get("name") });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      setFormError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result = await postJson<CreatedResponse>("/api/households", parsed.data);
    if (result.ok) {
      setHousehold(result.data.household);
      onSuccess(`Created ${result.data.household.name}. Share the invite code with the people you live with.`);
      return;
    }

    setPending(false);
    if (result.error === ALREADY_IN_HOUSEHOLD_MESSAGE) {
      onAlreadyMember();
      void loadHousehold();
      return;
    }
    setFormError(result.error);
    setFieldErrors(result.fieldErrors);
  }

  return (
    <form className="stack" method="post" noValidate onSubmit={handleSubmit}>
      <FormMessage error={formError} />
      <TextField
        label="Household name"
        name="name"
        hint="Two to 60 characters, such as your street or family name."
        error={fieldErrors.name}
      />
      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? "Creating..." : "Create household"}
      </button>
    </form>
  );
}

export function JoinHouseholdForm({ onSuccess, onAlreadyMember }: FormProps) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = joinHouseholdSchema.safeParse({ inviteCode: form.get("inviteCode") });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      setFormError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result = await postJson<CreatedResponse>("/api/households/join", parsed.data);
    if (result.ok) {
      setHousehold(result.data.household);
      onSuccess(`You joined ${result.data.household.name}.`);
      return;
    }

    setPending(false);
    if (result.error === ALREADY_IN_HOUSEHOLD_MESSAGE) {
      onAlreadyMember();
      void loadHousehold();
      return;
    }
    setFormError(result.error);
    setFieldErrors(result.fieldErrors);
  }

  return (
    <form className="stack" method="post" noValidate onSubmit={handleSubmit}>
      <FormMessage error={formError} />
      <TextField
        label="Invite code"
        name="inviteCode"
        hint="The 8-character code from your household owner."
        error={fieldErrors.inviteCode}
      />
      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? "Joining..." : "Join household"}
      </button>
    </form>
  );
}
