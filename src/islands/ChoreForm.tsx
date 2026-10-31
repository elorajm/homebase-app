import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "@nanostores/react";
import { toFieldErrors, type FieldErrors } from "@/lib/field-errors";
import type { ChoreView } from "@/lib/chores";
import { toIsoDate } from "@/lib/dates";
import { VALIDATION_ERROR_MESSAGE } from "@/lib/messages";
import { choreFormSchema } from "@/lib/validation";
import { sendJson } from "@/islands/api-client";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/islands/form-fields";
import { $chores, loadChores } from "@/stores/chores";

type Props = { mode: "create" | "edit" };

type EditState =
  | { status: "loading" }
  | { status: "ready"; chore: ChoreView }
  | { status: "missing" };

export function ChoreForm({ mode }: Props) {
  const state = useStore($chores);
  const [edit, setEdit] = useState<EditState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [choreId, setChoreId] = useState<string>();

  useEffect(() => {
    void loadChores();
    if (mode !== "edit") {
      return;
    }

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setEdit({ status: "missing" });
      return;
    }
    setChoreId(id);
    void sendJson<{ chore: ChoreView }>("GET", `/api/chores/${encodeURIComponent(id)}`).then((result) => {
      setEdit(result.ok ? { status: "ready", chore: result.data.chore } : { status: "missing" });
    });
  }, [mode]);

  if (state.status === "loading" || (mode === "edit" && edit.status === "loading")) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }
  if (state.status === "signedOut") {
    return null;
  }
  if (state.status === "noHousehold") {
    return (
      <p>
        Join or create a household before adding chores. <a href="/household">Go to household</a>
      </p>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p role="alert" className="message message--error">
        We could not load this form. Refresh the page to try again.
      </p>
    );
  }
  if (!state.viewer.canManage) {
    return (
      <p>
        Only household owners and adults can add or edit chores. <a href="/chores">Back to chores</a>
      </p>
    );
  }
  if (mode === "edit" && edit.status === "missing") {
    return (
      <p role="alert" className="message message--error">
        That chore could not be found. <a href="/chores">Back to chores</a>
      </p>
    );
  }

  const members = state.members;
  const current = mode === "edit" && edit.status === "ready" ? edit.chore : undefined;
  const defaultAssignee = current?.assignee.id ?? state.viewer.userId;
  const defaultDueDate = current?.dueDate ?? toIsoDate(new Date());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = choreFormSchema.safeParse({
      title: form.get("title"),
      description: form.get("description") ?? "",
      assignedUserId: form.get("assignedUserId") ?? "",
      dueDate: form.get("dueDate"),
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      setFormError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result =
      mode === "create"
        ? await sendJson("POST", "/api/chores", parsed.data)
        : await sendJson("PATCH", `/api/chores/${encodeURIComponent(choreId ?? "")}`, parsed.data);

    if (result.ok) {
      window.location.assign(`/chores?notice=${mode === "create" ? "created" : "updated"}`);
      return;
    }

    setFormError(result.error);
    setFieldErrors(result.fieldErrors);
    setPending(false);
  }

  return (
    <form className="stack" method="post" noValidate onSubmit={handleSubmit}>
      <FormMessage error={formError} />
      <TextField
        label="Chore name"
        name="title"
        defaultValue={current?.title ?? ""}
        error={fieldErrors.title}
      />
      <TextAreaField
        label="Description (optional)"
        name="description"
        defaultValue={current?.description ?? ""}
        error={fieldErrors.description}
      />
      <SelectField
        label="Assigned to"
        name="assignedUserId"
        defaultValue={defaultAssignee}
        options={members.map((member) => ({ value: member.id, label: `${member.firstName} ${member.lastName}` }))}
        hint="Leave this as it is to assign the chore to yourself, or choose another household member."
        error={fieldErrors.assignedUserId}
      />
      <TextField label="Due date" name="dueDate" type="date" defaultValue={defaultDueDate} error={fieldErrors.dueDate} />
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {mode === "create" ? (pending ? "Adding..." : "Add chore") : pending ? "Saving..." : "Save chore"}
        </button>
        <a className="btn btn--secondary" href="/chores">
          Cancel
        </a>
      </div>
    </form>
  );
}
