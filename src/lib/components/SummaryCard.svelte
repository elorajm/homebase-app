<script lang="ts">
	let {
		label,
		value,
		tone = 'neutral',
		href
	}: {
		label: string;
		value: number;
		tone?: 'neutral' | 'pending' | 'completed' | 'overdue';
		href?: string;
	} = $props();
</script>

{#if href}
	<a class="stat stat--{tone}" {href}>
		<span class="stat__value">{value}</span>
		<span class="stat__label">{label}</span>
	</a>
{:else}
	<div class="stat stat--{tone}">
		<span class="stat__value">{value}</span>
		<span class="stat__label">{label}</span>
	</div>
{/if}

<style>
	.stat {
		display: grid;
		gap: 0.15rem;
		padding: 1rem 1.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-left: 5px solid var(--color-border);
		border-radius: 12px;
		text-decoration: none;
		color: var(--color-text);
	}

	a.stat:hover {
		border-color: var(--color-primary);
	}

	.stat__value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.stat__label {
		color: var(--color-muted);
		font-size: 0.95rem;
		font-weight: 600;
	}

	.stat--pending {
		border-left-color: var(--color-primary);
	}

	.stat--pending .stat__value {
		color: var(--color-primary);
	}

	.stat--completed {
		border-left-color: var(--color-success);
	}

	.stat--completed .stat__value {
		color: var(--color-success);
	}

	.stat--overdue {
		border-left-color: var(--color-warning);
	}

	.stat--overdue .stat__value {
		color: var(--color-warning);
	}
</style>
