<script lang="ts">
	import { page } from '$app/state';
	import {
		deleteChore,
		loadChores,
		setChoreStatus,
		takeFlash,
		type ChoresView
	} from '#lib/api/chores.js';
	import type { DemoScenario } from '#lib/api/mock-db.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { formatDueDate, isOverdue, parseIsoDate, todayUtc } from '#lib/shared/dates.js';
	import { canCompleteChore, canManageChores } from '#lib/shared/permissions.js';
	import type { Chore } from '#lib/shared/types.js';

	// ?demo=empty|error|loading previews each state design without a backend.
	const demo = $derived((page.url.searchParams.get('demo') as DemoScenario) ?? null);

	let view = $state<ChoresView | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let search = $state('');
	let statusFilter = $state<'all' | 'pending' | 'overdue' | 'completed'>('all');
	let assigneeFilter = $state('all');
	let sortOrder = $state<'asc' | 'desc'>('asc');

	let successMessage = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	let deleteTarget = $state<Chore | null>(null);
	let deleteDialogOpen = $state(false);
	let deletePending = $state(false);

	const today = todayUtc();

	const isManager = $derived(
		view?.currentMember != null && canManageChores(view.currentMember.role)
	);

	async function load(scenario: DemoScenario) {
		loading = true;
		loadError = null;
		try {
			view = await loadChores(scenario);
			successMessage = takeFlash();
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Something went wrong loading your chores.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load(demo);
	});

	function choreIsOverdue(chore: Chore): boolean {
		return isOverdue(parseIsoDate(chore.dueDate), chore.status, today);
	}

	function canToggle(chore: Chore): boolean {
		const member = view?.currentMember;
		return member != null && canCompleteChore(member.role, member.id, chore.assignee.id);
	}

	const filteredChores = $derived.by(() => {
		let result = view?.chores ?? [];
		const query = search.trim().toLowerCase();
		if (query) {
			result = result.filter((c) => c.title.toLowerCase().includes(query));
		}
		if (statusFilter === 'pending') {
			result = result.filter((c) => c.status === 'pending' && !choreIsOverdue(c));
		} else if (statusFilter === 'overdue') {
			result = result.filter(choreIsOverdue);
		} else if (statusFilter === 'completed') {
			result = result.filter((c) => c.status === 'completed');
		}
		if (assigneeFilter !== 'all') {
			result = result.filter((c) => c.assignee.id === assigneeFilter);
		}
		return result.toSorted((a, b) => {
			const byDate = a.dueDate.localeCompare(b.dueDate);
			return (sortOrder === 'asc' ? byDate : -byDate) || a.title.localeCompare(b.title);
		});
	});

	const hasActiveFilters = $derived(
		search.trim() !== '' || statusFilter !== 'all' || assigneeFilter !== 'all'
	);

	function clearFilters() {
		search = '';
		statusFilter = 'all';
		assigneeFilter = 'all';
	}

	async function handleToggle(chore: Chore, completed: boolean) {
		busyId = chore.id;
		actionError = null;
		successMessage = null;
		try {
			await setChoreStatus(chore.id, completed);
			view = await loadChores(demo);
			successMessage = completed
				? `“${chore.title}” marked as completed.`
				: `“${chore.title}” reopened.`;
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'The chore could not be updated. Try again.';
		} finally {
			busyId = null;
		}
	}

	function askDelete(chore: Chore) {
		actionError = null;
		successMessage = null;
		deleteTarget = chore;
		deleteDialogOpen = true;
	}

	async function handleDeleteConfirmed() {
		if (!deleteTarget) return;
		deletePending = true;
		try {
			await deleteChore(deleteTarget.id);
			successMessage = `“${deleteTarget.title}” deleted.`;
			deleteDialogOpen = false;
			deleteTarget = null;
			view = await loadChores(demo);
		} catch (error) {
			deleteDialogOpen = false;
			actionError =
				error instanceof Error ? error.message : 'The chore could not be deleted. Try again.';
		} finally {
			deletePending = false;
		}
	}
</script>

<svelte:head>
	<title>Chores | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>Chores</h1>
	{#if isManager}
		<a class="btn btn--primary" href="/chores/new">New chore</a>
	{/if}
</div>

{#if loading}
	<div class="stack" aria-busy="true">
		<p class="visually-hidden" role="status">Loading your chores…</p>
		<div class="skeleton skeleton--stat"></div>
		<div class="skeleton skeleton--section"></div>
	</div>
{:else if loadError}
	<section class="card" aria-labelledby="chores-error-heading">
		<h2 id="chores-error-heading">Something went wrong</h2>
		<p class="message message--error" role="alert">{loadError}</p>
		<button type="button" class="btn btn--primary" onclick={() => load(demo)}>Try again</button>
	</section>
{:else if view}
	<div class="stack">
		{#if successMessage}
			<p class="message message--success" role="status">{successMessage}</p>
		{/if}
		{#if actionError}
			<p class="message message--error" role="alert">{actionError}</p>
		{/if}

		{#if view.chores.length === 0}
			<section class="empty-state">
				<h2>No chores yet</h2>
				<p>Chores you add will appear here for the whole household.</p>
				{#if isManager}
					<a class="btn btn--primary" href="/chores/new">Create your first chore</a>
				{:else}
					<p class="muted">Ask the household owner or an adult to add chores.</p>
				{/if}
			</section>
		{:else}
			<section class="card" aria-label="Filter and sort chores">
				<div class="toolbar">
					<div class="field toolbar__search">
						<label for="chore-search">Search by name</label>
						<input
							id="chore-search"
							type="search"
							bind:value={search}
							placeholder="e.g. dishes"
						/>
					</div>
					<div class="field">
						<label for="status-filter">Status</label>
						<select id="status-filter" bind:value={statusFilter}>
							<option value="all">All statuses</option>
							<option value="pending">Pending</option>
							<option value="overdue">Overdue</option>
							<option value="completed">Completed</option>
						</select>
					</div>
					<div class="field">
						<label for="assignee-filter">Assigned to</label>
						<select id="assignee-filter" bind:value={assigneeFilter}>
							<option value="all">Everyone</option>
							{#each view.members as member (member.id)}
								<option value={member.id}>{member.firstName} {member.lastName}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="sort-order">Sort</label>
						<select id="sort-order" bind:value={sortOrder}>
							<option value="asc">Due date (soonest first)</option>
							<option value="desc">Due date (latest first)</option>
						</select>
					</div>
				</div>
				<p class="muted toolbar__summary" role="status">
					Showing {filteredChores.length} of {view.chores.length} chore{view.chores.length === 1
						? ''
						: 's'}
					{#if hasActiveFilters}
						·
						<button type="button" class="link-button" onclick={clearFilters}>Clear filters</button>
					{/if}
				</p>
			</section>

			{#if filteredChores.length === 0}
				<section class="empty-state">
					<h2>No chores match</h2>
					<p>Try a different search or filter combination.</p>
					<button type="button" class="btn btn--secondary" onclick={clearFilters}>
						Clear filters
					</button>
				</section>
			{:else}
				<ul class="chore-list">
					{#each filteredChores as chore (chore.id)}
						<li class="chore-item">
							<div>
								<h3 class="chore-item__title">{chore.title}</h3>
								{#if chore.description}
									<p class="chore-item__meta">{chore.description}</p>
								{/if}
								<p class="chore-item__meta">
									{chore.assignee.firstName}
									{chore.assignee.lastName} · Due {formatDueDate(parseIsoDate(chore.dueDate))}
								</p>
							</div>
							<div class="chore-item__side">
								{#if choreIsOverdue(chore)}
									<span class="badge badge--overdue">Overdue</span>
								{:else if chore.status === 'completed'}
									<span class="badge badge--completed">Completed</span>
								{:else}
									<span class="badge badge--pending">Pending</span>
								{/if}
								<div class="chore-item__actions">
									{#if canToggle(chore)}
										<button
											type="button"
											class="btn btn--secondary"
											disabled={busyId === chore.id}
											onclick={() => handleToggle(chore, chore.status !== 'completed')}
										>
											{chore.status === 'completed' ? 'Reopen' : 'Mark as done'}
										</button>
									{/if}
									{#if isManager}
										<a class="btn btn--secondary" href="/chores/{chore.id}/edit">Edit</a>
										<button
											type="button"
											class="btn btn--danger"
											disabled={deletePending && deleteTarget?.id === chore.id}
											onclick={() => askDelete(chore)}
										>
											Delete
										</button>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
{/if}

<ConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete chore?"
	message={deleteTarget
		? `“${deleteTarget.title}” will be removed for the whole household. This cannot be undone.`
		: ''}
	confirmLabel="Delete chore"
	busy={deletePending}
	onconfirm={handleDeleteConfirmed}
/>

<style>
	.toolbar {
		display: grid;
		gap: 0.75rem;
	}

	.toolbar .field {
		margin-bottom: 0;
	}

	.toolbar__summary {
		margin-top: 0.75rem;
	}

	.link-button {
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		color: var(--color-primary);
		text-decoration: underline;
		cursor: pointer;
	}

	@media (min-width: 720px) {
		.toolbar {
			grid-template-columns: 2fr 1fr 1fr 1fr;
			align-items: end;
		}
	}
</style>
