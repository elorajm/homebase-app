<script lang="ts">
	import { page } from '$app/state';
	import {
		loadDashboard,
		type DashboardData,
		type DemoScenario
	} from '#lib/api/dashboard.js';
	import { setChoreStatus } from '#lib/api/chores.js';
	import ChoreListItem from '#lib/components/ChoreListItem.svelte';
	import SummaryCard from '#lib/components/SummaryCard.svelte';
	import { formatRelativeTime, isOverdue, parseIsoDate, toIsoDate, todayUtc } from '#lib/shared/dates.js';
	import { canCompleteChore } from '#lib/shared/permissions.js';
	import type { ActivityEvent, Chore } from '#lib/shared/types.js';

	let data = $state<DashboardData | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let togglingId = $state<string | null>(null);
	let toggleError = $state<string | null>(null);

	// ?demo=empty|error|loading previews each state design without a backend.
	const demo = $derived((page.url.searchParams.get('demo') as DemoScenario) ?? null);

	const today = todayUtc();
	const todayIso = toIsoDate(today);

	async function load(scenario: DemoScenario) {
		loading = true;
		loadError = null;
		try {
			data = await loadDashboard(scenario);
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Something went wrong loading the dashboard.';
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

	function canToggleChore(chore: Chore): boolean {
		const member = data?.currentMember;
		return member != null && canCompleteChore(member.role, member.id, chore.assignee.id);
	}

	function compareChores(a: Chore, b: Chore): number {
		if (a.status !== b.status) {
			return a.status === 'pending' ? -1 : 1;
		}
		return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title);
	}

	const chores = $derived(data?.chores ?? []);
	const totalCount = $derived(chores.length);
	const pendingCount = $derived(chores.filter((c) => c.status === 'pending').length);
	const completedCount = $derived(chores.filter((c) => c.status === 'completed').length);
	const overdueCount = $derived(chores.filter(choreIsOverdue).length);

	// Today's list covers everything that needs attention now: chores due today
	// plus anything overdue.
	const todaysChores = $derived(
		chores.filter((c) => c.dueDate === todayIso || choreIsOverdue(c)).toSorted(compareChores)
	);
	const upcomingChores = $derived(
		chores
			.filter((c) => c.status === 'pending' && c.dueDate > todayIso)
			.toSorted(compareChores)
			.slice(0, 5)
	);
	const recentActivity = $derived(
		(data?.activity ?? [])
			.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt))
			.slice(0, 6)
	);

	const greeting = $derived.by(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		return 'Good evening';
	});

	const attentionSummary = $derived.by(() => {
		if (totalCount === 0) return 'Your household has no chores yet.';
		const dueCount = todaysChores.filter((c) => c.status === 'pending').length;
		if (dueCount === 0) return 'Nothing needs attention today. Nice work!';
		const overduePart = overdueCount > 0 ? `, including ${overdueCount} overdue` : '';
		return `${dueCount} chore${dueCount === 1 ? '' : 's'} need${dueCount === 1 ? 's' : ''} attention today${overduePart}.`;
	});

	function activitySentence(event: ActivityEvent): string {
		switch (event.type) {
			case 'chore_completed':
				return `${event.actorName} completed “${event.subject}”`;
			case 'chore_created':
				return `${event.actorName} added “${event.subject}”`;
			case 'chore_reopened':
				return `${event.actorName} reopened “${event.subject}”`;
			case 'chore_deleted':
				return `${event.actorName} deleted “${event.subject}”`;
			case 'member_joined':
				return `${event.actorName} joined ${event.subject}`;
			case 'member_removed':
				return `${event.actorName} removed ${event.subject} from the household`;
			case 'household_created':
				return `${event.actorName} created ${event.subject}`;
			case 'household_renamed':
				return `${event.actorName} renamed the household to “${event.subject}”`;
		}
	}

	async function handleToggle(chore: Chore, completed: boolean) {
		togglingId = chore.id;
		toggleError = null;
		try {
			await setChoreStatus(chore.id, completed);
			data = await loadDashboard(demo);
		} catch (error) {
			toggleError =
				error instanceof Error ? error.message : 'That chore could not be updated. Try again.';
		} finally {
			togglingId = null;
		}
	}
</script>

<svelte:head>
	<title>Dashboard | HomeBase</title>
</svelte:head>

{#if loading}
	<div class="dashboard" aria-busy="true">
		<p class="visually-hidden" role="status">Loading your dashboard…</p>
		<div class="skeleton skeleton--welcome"></div>
		<div class="stats-grid">
			{#each { length: 4 }, i (i)}
				<div class="skeleton skeleton--stat"></div>
			{/each}
		</div>
		<div class="dashboard-grid">
			<div class="stack">
				<div class="skeleton skeleton--section"></div>
				<div class="skeleton skeleton--section"></div>
			</div>
			<div class="stack">
				<div class="skeleton skeleton--section"></div>
			</div>
		</div>
	</div>
{:else if loadError}
	<div class="page-header">
		<h1>Dashboard</h1>
	</div>
	<section class="card" aria-labelledby="dashboard-error-heading">
		<h2 id="dashboard-error-heading">Something went wrong</h2>
		<p class="message message--error" role="alert">{loadError}</p>
		<button type="button" class="btn btn--primary" onclick={() => load(demo)}>Try again</button>
	</section>
{:else if data}
	<div class="dashboard">
		<header class="welcome">
			<div>
				<h1>{greeting}, {data.household.name}</h1>
				<p class="muted">{attentionSummary}</p>
			</div>
			<div class="welcome__actions">
				<a class="btn btn--primary" href="/chores/new">Add a chore</a>
				<a class="btn btn--secondary" href="/chores">View all chores</a>
				<a class="btn btn--secondary" href="/household">Manage household</a>
			</div>
		</header>

		<section class="stats-grid" aria-label="Chore summary">
			<SummaryCard label="Total chores" value={totalCount} href="/chores" />
			<SummaryCard label="Pending" value={pendingCount} tone="pending" href="/chores" />
			<SummaryCard label="Completed" value={completedCount} tone="completed" href="/chores" />
			<SummaryCard label="Overdue" value={overdueCount} tone="overdue" href="/chores" />
		</section>

		{#if toggleError}
			<p class="message message--error" role="alert">{toggleError}</p>
		{/if}

		{#if totalCount === 0}
			<section class="empty-state" aria-labelledby="no-chores-heading">
				<h2 id="no-chores-heading">No chores yet</h2>
				<p>
					Chores you add will show up here with due dates, assignees, and overdue reminders for the
					whole household.
				</p>
				<a class="btn btn--primary" href="/chores/new">Create your first chore</a>
			</section>
		{:else}
			<div class="dashboard-grid">
				<div class="stack">
					<section class="card" aria-labelledby="today-heading">
						<h2 id="today-heading">Today's chores</h2>
						{#if todaysChores.length === 0}
							<p class="muted">Nothing is due today. Enjoy the breather!</p>
						{:else}
							<ul class="chore-list">
								{#each todaysChores as chore (chore.id)}
									<ChoreListItem
										{chore}
										busy={togglingId === chore.id}
										canToggle={canToggleChore(chore)}
										ontoggle={handleToggle}
									/>
								{/each}
							</ul>
						{/if}
					</section>

					<section class="card" aria-labelledby="upcoming-heading">
						<h2 id="upcoming-heading">Upcoming chores</h2>
						{#if upcomingChores.length === 0}
							<p class="muted">No upcoming chores are scheduled.</p>
						{:else}
							<ul class="chore-list">
								{#each upcomingChores as chore (chore.id)}
									<ChoreListItem
										{chore}
										busy={togglingId === chore.id}
										canToggle={canToggleChore(chore)}
										ontoggle={handleToggle}
									/>
								{/each}
							</ul>
						{/if}
						<p class="section-footer"><a href="/chores">View all chores</a></p>
					</section>
				</div>

				<div class="stack">
					<section class="card" aria-labelledby="activity-heading">
						<h2 id="activity-heading">Recent activity</h2>
						{#if recentActivity.length === 0}
							<p class="muted">No recent activity yet.</p>
						{:else}
							<ul class="activity-list">
								{#each recentActivity as event (event.id)}
									<li class="activity-item">
										<p class="activity-item__text">{activitySentence(event)}</p>
										<p class="activity-item__time">{formatRelativeTime(event.occurredAt)}</p>
									</li>
								{/each}
							</ul>
						{/if}
					</section>

					<section class="card" aria-labelledby="household-heading">
						<h2 id="household-heading">Your household</h2>
						<p class="muted">
							{data.household.name} · {data.household.members.length} member{data.household.members
								.length === 1
								? ''
								: 's'}
						</p>
						<p class="section-footer"><a href="/household">Manage household</a></p>
					</section>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.dashboard {
		display: grid;
		gap: 1.25rem;
		padding-top: 1rem;
	}

	.welcome {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.welcome__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.stats-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(2, 1fr);
	}

	.section-footer {
		margin: 0.75rem 0 0;
	}

	.activity-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}

	.activity-item {
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.activity-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.activity-item:first-child {
		padding-top: 0;
	}

	.activity-item__text {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.activity-item__time {
		margin: 0.1rem 0 0;
		color: var(--color-muted);
		font-size: 0.85rem;
	}

	@media (min-width: 720px) {
		.stats-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
