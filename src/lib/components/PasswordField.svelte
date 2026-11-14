<script lang="ts">
	let {
		id,
		label,
		value = $bindable(''),
		autocomplete,
		error = null,
		hint = null
	}: {
		id: string;
		label: string;
		value?: string;
		autocomplete: 'current-password' | 'new-password';
		error?: string | null;
		hint?: string | null;
	} = $props();

	let visible = $state(false);

	const describedBy = $derived(
		[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div class="field">
	<label for={id}>{label}</label>
	<div class="password-field">
		<input
			{id}
			type={visible ? 'text' : 'password'}
			bind:value
			{autocomplete}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
		<button
			type="button"
			class="btn btn--secondary password-field__toggle"
			onclick={() => (visible = !visible)}
			aria-pressed={visible}
		>
			{visible ? 'Hide' : 'Show'}
		</button>
	</div>
	{#if hint}
		<p class="field__hint" id="{id}-hint">{hint}</p>
	{/if}
	{#if error}
		<p class="field__error" id="{id}-error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.password-field {
		display: flex;
		gap: 0.5rem;
	}

	.password-field input {
		flex: 1;
		min-width: 0;
	}

	.password-field__toggle {
		flex-shrink: 0;
	}
</style>
