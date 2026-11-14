<script lang="ts">
	import { goto } from '$app/navigation';
	import { createChore, loadChores, setFlash, type ChoreInput, type ChoresView } from '#lib/api/chores.js';
	import ChoreForm from '#lib/components/ChoreForm.svelte';
	import { canManageChores } from '#lib/shared/permissions.js';

	let view = $state<ChoresView | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let pending = $state(false);
	let submitError = $state<string | null>(null);

	const isManager = $derived(
		view?.currentMember != null && canManageChores(view.currentMember.role)
	);

	async function load() {
		loading = true;
		loadError = null;
		try {
			view = await loadChores();
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Something went wrong. Try again.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function handleSubmit(input: ChoreInput) {
		pending = true;
		submitError = null;
		try {
			const chore = await createChore(input);
			setFlash(`“${chore.title}” created.`);
			await goto('/chores');
		} catch (error) {
			submitError =
				error instanceof Error ? error.message : 'The chore could not be created. Try again.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>New chore | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>New chore</h1>
</div>

{#if loading}
	<div class="stack" aria-busy="true">
		<p class="visually-hidden" role="status">Loading…</p>
		<div class="skeleton skeleton--section"></div>
	</div>
{:else if loadError}
	<section class="card" aria-labelledby="new-chore-error-heading">
		<h2 id="new-chore-error-heading">Something went wrong</h2>
		<p class="message message--error" role="alert">{loadError}</p>
		<button type="button" class="btn btn--primary" onclick={load}>Try again</button>
	</section>
{:else if view && !isManager}
	<section class="card" aria-labelledby="new-chore-heading">
		<h2 id="new-chore-heading">You don't have permission</h2>
		<p class="muted">Only the household owner or an adult can create chores.</p>
		<p><a href="/chores">Back to chores</a></p>
	</section>
{:else if view}
	<section class="card" aria-labelledby="new-chore-heading">
		<h2 id="new-chore-heading">Create a chore</h2>
		<ChoreForm
			members={view.members}
			initial={{
				title: '',
				description: '',
				dueDate: '',
				assignedUserId: view.currentMember?.id
			}}
			submitLabel="Create chore"
			{pending}
			{submitError}
			onsubmit={handleSubmit}
			oncancel={() => goto('/chores')}
		/>
	</section>
{/if}
