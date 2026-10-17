"use client";

import { useActionState } from "react";
import {
  changeMemberRole,
  createHousehold,
  joinHousehold,
  removeMember,
  renameHousehold,
} from "@/app/actions/household";
import { FormMessage, TextField } from "@/components/form-fields";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = {};

export function CreateHouseholdForm() {
  const [state, formAction] = useActionState(createHousehold, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} />
      <TextField
        label="Household name"
        name="name"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <SubmitButton pendingLabel="Creating...">Create household</SubmitButton>
    </form>
  );
}

export function JoinHouseholdForm() {
  const [state, formAction] = useActionState(joinHousehold, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} />
      <TextField
        label="Invite code"
        name="inviteCode"
        hint="The 8-character code from your household owner."
        defaultValue={state.values?.inviteCode}
        error={state.fieldErrors?.inviteCode}
      />
      <SubmitButton pendingLabel="Joining...">Join household</SubmitButton>
    </form>
  );
}

export function RenameHouseholdForm({ currentName }: { currentName: string }) {
  const [state, formAction] = useActionState(renameHousehold, initialState);

  return (
    <form action={formAction} className="stack" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <TextField
        label="Household name"
        name="name"
        defaultValue={state.values?.name ?? currentName}
        error={state.fieldErrors?.name}
      />
      <SubmitButton pendingLabel="Saving...">Save name</SubmitButton>
    </form>
  );
}

export function MemberRoleForm({
  memberId,
  currentRole,
  memberName,
}: {
  memberId: string;
  currentRole: "adult" | "member";
  memberName: string;
}) {
  const [state, formAction] = useActionState(changeMemberRole, initialState);

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="memberId" value={memberId} />
      <label className="visually-hidden" htmlFor={`role-${memberId}`}>
        Role for {memberName}
      </label>
      <select id={`role-${memberId}`} name="role" defaultValue={currentRole} className="role-select">
        <option value="adult">Adult</option>
        <option value="member">Member</option>
      </select>
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        Save role
      </SubmitButton>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}

export function RemoveMemberForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [state, formAction] = useActionState(removeMember, initialState);

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="memberId" value={memberId} />
      <SubmitButton
        variant="danger"
        pendingLabel="Removing..."
        confirmMessage={`Remove ${memberName} from the household? Their chores will be reassigned to you.`}
      >
        Remove
      </SubmitButton>
      <FormMessage error={state.error} />
    </form>
  );
}
