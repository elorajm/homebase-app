<script lang="ts">
	import { goto } from '$app/navigation';
	import { register } from '#lib/api/auth.svelte.js';
	import PasswordField from '#lib/components/PasswordField.svelte';
	import { registerSchema } from '#lib/shared/validation.js';

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');

	type FieldKey = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword';
	let fieldErrors = $state<Partial<Record<FieldKey, string>>>({});
	let submitError = $state<string | null>(null);
	let pending = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = registerSchema.safeParse({ firstName, lastName, email, password });
		const errors: typeof fieldErrors = {};
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issue.path[0] as FieldKey;
				errors[key] ??= issue.message;
			}
		}
		if (password !== confirmPassword) {
			errors.confirmPassword ??= 'Passwords do not match.';
		}
		fieldErrors = errors;
		if (!parsed.success || errors.confirmPassword) {
			return;
		}
		submitError = null;
		pending = true;
		try {
			await register(parsed.data);
			await goto('/dashboard');
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Registration failed. Try again.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head>
	<title>Create account | HomeBase</title>
</svelte:head>

<section class="card" aria-labelledby="register-heading">
	<h1 id="register-heading">Create your HomeBase account</h1>
	<p class="muted">
		Demo mode: your account lives in this browser session only, and the password is discarded —
		never stored or checked.
	</p>
	<form onsubmit={handleSubmit} novalidate>
		<div class="field">
			<label for="register-first-name">First name</label>
			<input
				id="register-first-name"
				type="text"
				bind:value={firstName}
				maxlength="60"
				autocomplete="given-name"
				aria-invalid={fieldErrors.firstName ? 'true' : undefined}
				aria-describedby={fieldErrors.firstName ? 'register-first-name-error' : undefined}
			/>
			{#if fieldErrors.firstName}
				<p class="field__error" id="register-first-name-error" role="alert">
					{fieldErrors.firstName}
				</p>
			{/if}
		</div>
		<div class="field">
			<label for="register-last-name">Last name</label>
			<input
				id="register-last-name"
				type="text"
				bind:value={lastName}
				maxlength="60"
				autocomplete="family-name"
				aria-invalid={fieldErrors.lastName ? 'true' : undefined}
				aria-describedby={fieldErrors.lastName ? 'register-last-name-error' : undefined}
			/>
			{#if fieldErrors.lastName}
				<p class="field__error" id="register-last-name-error" role="alert">
					{fieldErrors.lastName}
				</p>
			{/if}
		</div>
		<div class="field">
			<label for="register-email">Email</label>
			<input
				id="register-email"
				type="email"
				bind:value={email}
				autocomplete="email"
				aria-invalid={fieldErrors.email ? 'true' : undefined}
				aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
			/>
			{#if fieldErrors.email}
				<p class="field__error" id="register-email-error" role="alert">{fieldErrors.email}</p>
			{/if}
		</div>
		<PasswordField
			id="register-password"
			label="Password"
			bind:value={password}
			autocomplete="new-password"
			hint="At least 8 characters."
			error={fieldErrors.password ?? null}
		/>
		<PasswordField
			id="register-confirm-password"
			label="Confirm password"
			bind:value={confirmPassword}
			autocomplete="new-password"
			error={fieldErrors.confirmPassword ?? null}
		/>
		{#if submitError}
			<p class="message message--error" role="alert">{submitError}</p>
		{/if}
		<button type="submit" class="btn btn--primary" disabled={pending}>
			{pending ? 'Creating account…' : 'Create account'}
		</button>
	</form>
	<p>Already have an account? <a href="/login">Log in</a></p>
</section>
