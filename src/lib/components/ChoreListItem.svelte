<script lang="ts">
	import { formatDueDate, isOverdue, parseIsoDate, toIsoDate, todayUtc } from '../shared/dates';
	import type { Chore } from '../shared/types';

	let {
		chore,
		busy = false,
		canToggle = true,
		ontoggle
	}: {
		chore: Chore;
		busy?: boolean;
		canToggle?: boolean;
		ontoggle: (chore: Chore, completed: boolean) => void;
	} = $props();

	const today = todayUtc();
	const todayIso = toIsoDate(today);

	const overdue = $derived(isOverdue(parseIsoDate(chore.dueDate), chore.status, today));
	const dueLabel = $derived.by(() => {
		if (chore.dueDate === todayIso) {
			return 'Due today';
		}
		const due = parseIsoDate(chore.dueDate);
		if (overdue) {
			return `Was due ${formatDueDate(due)}`;
		}
		const tomorrow = new Date(today);
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		if (chore.dueDate === toIsoDate(tomorrow)) {
			return 'Due tomorrow';
		}
		return `Due ${formatDueDate(due)}`;
	});
	const completed = $derived(chore.status === 'completed');
</script>

<li class="chore-item">
	<div>
		<h3 class="chore-item__title">{chore.title}</h3>
		<p class="chore-item__meta">
			{chore.assignee.firstName}
			{chore.assignee.lastName} · {dueLabel}
		</p>
	</div>
	<div class="chore-item__side">
		{#if overdue}
			<span class="badge badge--overdue">Overdue</span>
		{:else if completed}
			<span class="badge badge--completed">Completed</span>
		{:else}
			<span class="badge badge--pending">Pending</span>
		{/if}
		<div class="chore-item__actions">
			{#if canToggle}
				<button
					type="button"
					class="btn btn--secondary"
					disabled={busy}
					onclick={() => ontoggle(chore, !completed)}
				>
					{completed ? 'Mark as pending' : 'Mark as done'}
				</button>
			{/if}
		</div>
	</div>
</li>
