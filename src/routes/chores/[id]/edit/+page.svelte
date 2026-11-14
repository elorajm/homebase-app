<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		getChore,
		loadChores,
		setFlash,
		updateChore,
		type ChoreInput,
		type ChoresView
	} from '#lib/api/chores.js';
	import ChoreForm from '#lib/components/ChoreForm.svelte';
	import { canManageChores } from '#lib/shared/permissions.js';
	import type { Chore } from '#lib/shared/types.js';

	const choreId = $derived(page.params.id ?? '');

	let view = $state<ChoresView | null>(null);
	let chore = $state<Chore | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let pending = $state(false);
	let submitError = $state<string | null>(null);

	const isManager = $derived(
		view?.currentMember != null && canManageChores(view.currentMember.role)
	);

	async function load(id: string) {
		loading = true;
		loadError = null;
		try {
			[view, chore] = await Promise.all([loadChores(), getChore(id)]);
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Something went wrong loading this chore.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load(choreId);
	});

	async function handleSubmit(input: ChoreInput) {
		if (!chore) return;
		pending = true;
		submitError = null;
		try {
			const updated = await updateChore(chore.id, input);
			setFlash(`“${updated.title}” updated.`);
			await goto('/chores');
		} catch (error) {
			submitError =
				error instanceof Error ? error.message : 'The chore could not be updated. Try again.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Edit chore | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>Edit chore</h1>
</div>

{#if loading}
	<div class="stack" aria-busy="true">
		<p class="visually-hidden" role="status">Loading chore…</p>
		<div class="skeleton skeleton--section"></div>
	</div>
{:else if loadError}
	<section class="card" aria-labelledby="edit-chore-error-heading">
		<h2 id="edit-chore-error-heading">This chore could not be loaded</h2>
		<p class="message message--error" role="alert">{loadError}</p>
		<div class="form-actions">
			<button type="button" class="btn btn--primary" onclick={() => load(choreId)}>
				Try again
			</button>
			<a class="btn btn--secondary" href="/chores">Back to chores</a>
		</div>
	</section>
{:else if view && !isManager}
	<section class="card" aria-labelledby="edit-chore-heading">
		<h2 id="edit-chore-heading">You don't have permission</h2>
		<p class="muted">Only the household owner or an adult can edit chores.</p>
		<p><a href="/chores">Back to chores</a></p>
	</section>
{:else if view && chore}
	<section class="card" aria-labelledby="edit-chore-heading">
		<h2 id="edit-chore-heading">Edit “{chore.title}”</h2>
		<ChoreForm
			members={view.members}
			initial={{
				title: chore.title,
				description: chore.description,
				dueDate: chore.dueDate,
				assignedUserId: chore.assignee.id
			}}
			submitLabel="Save changes"
			{pending}
			{submitError}
			onsubmit={handleSubmit}
			oncancel={() => goto('/chores')}
		/>
	</section>
{/if}
