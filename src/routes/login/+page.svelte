<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '#lib/api/auth.svelte.js';
	import PasswordField from '#lib/components/PasswordField.svelte';
	import { mockDemoAccounts } from '#lib/mock-data.js';
	import { loginSchema } from '#lib/shared/validation.js';

	let email = $state('');
	let password = $state('');
	let fieldErrors = $state<{ email?: string; password?: string }>({});
	let submitError = $state<string | null>(null);
	let pending = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = loginSchema.safeParse({ email, password });
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
		submitError = null;
		pending = true;
		try {
			await login(parsed.data.email, parsed.data.password);
			await goto('/dashboard');
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Login failed. Try again.';
		} finally {
			pending = false;
		}
	}

	function useDemoAccount(demoEmail: string) {
		email = demoEmail;
		password = 'demo-mode';
		fieldErrors = {};
	}
</script>

<svelte:head>
	<title>Log in | HomeBase</title>
</svelte:head>

<div class="stack">
	<section class="card" aria-labelledby="login-heading">
		<h1 id="login-heading">Log in to HomeBase</h1>
		<p class="muted">Enter the email and password you registered with.</p>
		<form onsubmit={handleSubmit} novalidate>
			<div class="field">
				<label for="login-email">Email</label>
				<input
					id="login-email"
					type="email"
					bind:value={email}
					autocomplete="email"
					aria-invalid={fieldErrors.email ? 'true' : undefined}
					aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
				/>
				{#if fieldErrors.email}
					<p class="field__error" id="login-email-error" role="alert">{fieldErrors.email}</p>
				{/if}
			</div>
			<PasswordField
				id="login-password"
				label="Password"
				bind:value={password}
				autocomplete="current-password"
				error={fieldErrors.password ?? null}
			/>
			{#if submitError}
				<p class="message message--error" role="alert">{submitError}</p>
			{/if}
			<button type="submit" class="btn btn--primary" disabled={pending}>
				{pending ? 'Logging in…' : 'Log in'}
			</button>
		</form>
		<p>New to HomeBase? <a href="/register">Create an account</a></p>
	</section>

	<section class="card demo-card" aria-labelledby="demo-heading">
		<h2 id="demo-heading">Demo mode accounts</h2>
		<p class="muted">
			Authentication is mocked for UI testing: pick an account and use any password. No real
			passwords exist or are checked.
		</p>
		<ul class="demo-card__list">
			{#each mockDemoAccounts as account (account.email)}
				<li>
					<button
						type="button"
						class="link-button"
						onclick={() => useDemoAccount(account.email)}
					>
						{account.email}
					</button>
					<span class="muted">— {account.description}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.demo-card {
		border-style: dashed;
	}

	.demo-card__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.5rem;
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
</style>
