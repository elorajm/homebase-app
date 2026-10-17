"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createChore, updateChore } from "@/app/actions/chores";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

type ChoreFormProps = {
  members: { id: string; name: string }[];
  chore?: {
    id: string;
    title: string;
    description: string;
    assignedUserId: string;
    dueDate: string;
  };
};

export function ChoreForm({ members, chore }: ChoreFormProps) {
  const action = chore ? updateChore : createChore;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      {chore ? <input type="hidden" name="choreId" value={chore.id} /> : null}
      <FormMessage error={state.error} />
      <TextField
        label="Chore name"
        name="title"
        maxLength={120}
        defaultValue={state.values?.title ?? chore?.title}
        error={state.fieldErrors?.title}
      />
      <TextAreaField
        label="Description (optional)"
        name="description"
        maxLength={1000}
        defaultValue={state.values?.description ?? chore?.description}
        error={state.fieldErrors?.description}
      />
      <SelectField
        label="Assigned to"
        name="assignedUserId"
        options={[
          { value: "", label: "Choose a member" },
          ...members.map((member) => ({ value: member.id, label: member.name })),
        ]}
        defaultValue={state.values?.assignedUserId ?? chore?.assignedUserId ?? ""}
        error={state.fieldErrors?.assignedUserId}
      />
      <TextField
        label="Due date"
        name="dueDate"
        type="date"
        defaultValue={state.values?.dueDate ?? chore?.dueDate}
        error={state.fieldErrors?.dueDate}
      />
      <div className="form-actions">
        <SubmitButton pendingLabel="Saving...">{chore ? "Save chore" : "Add chore"}</SubmitButton>
        <Link className="btn btn--secondary" href="/chores">
          Cancel
        </Link>
      </div>
    </form>
  );
}
