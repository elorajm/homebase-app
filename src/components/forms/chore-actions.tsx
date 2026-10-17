"use client";

import { useActionState } from "react";
import { deleteChore, setChoreStatus } from "@/app/actions/chores";
import { FormMessage } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

export function ChoreStatusForm({
  choreId,
  status,
}: {
  choreId: string;
  status: "pending" | "completed";
}) {
  const [state, formAction] = useActionState(setChoreStatus, initialState);
  const nextStatus = status === "completed" ? "pending" : "completed";

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="choreId" value={choreId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        {status === "completed" ? "Mark as pending" : "Mark as complete"}
      </SubmitButton>
      <FormMessage error={state.error} />
    </form>
  );
}

export function DeleteChoreForm({ choreId, title }: { choreId: string; title: string }) {
  const [state, formAction] = useActionState(deleteChore, initialState);

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="choreId" value={choreId} />
      <SubmitButton
        variant="danger"
        pendingLabel="Deleting..."
        confirmMessage={`Delete "${title}"? This cannot be undone.`}
      >
        Delete
      </SubmitButton>
      <FormMessage error={state.error} />
    </form>
  );
}
