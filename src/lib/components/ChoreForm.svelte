<script lang="ts">
	import { choreFormSchema } from '../shared/validation';
	import type { ChoreInput } from '../api/chores';
	import type { Member } from '../shared/types';

	let {
		members,
		initial = { title: '', description: '', dueDate: '', assignedUserId: undefined },
		submitLabel,
		pending = false,
		submitError = null,
		onsubmit,
		oncancel
	}: {
		members: Member[];
		initial?: ChoreInput;
		submitLabel: string;
		pending?: boolean;
		/** Error from the save attempt itself, shown above the actions. */
		submitError?: string | null;
		onsubmit: (input: ChoreInput) => void;
		oncancel: () => void;
	} = $props();

	// The form intentionally captures `initial` once; edits live here until saved.
	// svelte-ignore state_referenced_locally
	let title = $state(initial.title);
	// svelte-ignore state_referenced_locally
	let description = $state(initial.description);
	// svelte-ignore state_referenced_locally
	let dueDate = $state(initial.dueDate);
	// svelte-ignore state_referenced_locally
	let assignedUserId = $state(initial.assignedUserId ?? '');

	let fieldErrors = $state<Partial<Record<'title' | 'description' | 'dueDate' | 'assignedUserId', string>>>({});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = choreFormSchema.safeParse({ title, description, dueDate, assignedUserId });
		if (!parsed.success) {
			const errors: typeof fieldErrors = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[0] as keyof typeof fieldErrors;
				errors[key] ??= issue.message;
			}
			fieldErrors = errors;
			return;
		}
		fieldErrors = {};
		onsubmit(parsed.data);
	}
</script>

<form onsubmit={handleSubmit} novalidate>
	<div class="field">
		<label for="chore-title">Chore name</label>
		<input
			id="chore-title"
			type="text"
			bind:value={title}
			maxlength="120"
			aria-invalid={fieldErrors.title ? 'true' : undefined}
			aria-describedby={fieldErrors.title ? 'chore-title-error' : undefined}
		/>
		{#if fieldErrors.title}
			<p class="field__error" id="chore-title-error" role="alert">{fieldErrors.title}</p>
		{/if}
	</div>

	<div class="field">
		<label for="chore-description">Description <span class="muted">(optional)</span></label>
		<textarea
			id="chore-description"
			bind:value={description}
			maxlength="1000"
			aria-invalid={fieldErrors.description ? 'true' : undefined}
			aria-describedby={fieldErrors.description ? 'chore-description-error' : undefined}
		></textarea>
		{#if fieldErrors.description}
			<p class="field__error" id="chore-description-error" role="alert">
				{fieldErrors.description}
			</p>
		{/if}
	</div>

	<div class="field">
		<label for="chore-assignee">Assign to</label>
		<select
			id="chore-assignee"
			bind:value={assignedUserId}
			aria-invalid={fieldErrors.assignedUserId ? 'true' : undefined}
			aria-describedby={fieldErrors.assignedUserId ? 'chore-assignee-error' : undefined}
		>
			{#each members as member (member.id)}
				<option value={member.id}>{member.firstName} {member.lastName}</option>
			{/each}
		</select>
		{#if fieldErrors.assignedUserId}
			<p class="field__error" id="chore-assignee-error" role="alert">
				{fieldErrors.assignedUserId}
			</p>
		{/if}
	</div>

	<div class="field">
		<label for="chore-due-date">Due date</label>
		<input
			id="chore-due-date"
			type="date"
			bind:value={dueDate}
			aria-invalid={fieldErrors.dueDate ? 'true' : undefined}
			aria-describedby={fieldErrors.dueDate ? 'chore-due-date-error' : undefined}
		/>
		{#if fieldErrors.dueDate}
			<p class="field__error" id="chore-due-date-error" role="alert">{fieldErrors.dueDate}</p>
		{/if}
	</div>

	{#if submitError}
		<p class="message message--error" role="alert">{submitError}</p>
	{/if}

	<div class="form-actions">
		<button type="submit" class="btn btn--primary" disabled={pending}>
			{pending ? 'Saving…' : submitLabel}
		</button>
		<button type="button" class="btn btn--secondary" disabled={pending} onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
