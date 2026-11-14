<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth, logout, updateProfile } from '#lib/api/auth.svelte.js';
	import { loadHousehold, type HouseholdView } from '#lib/api/household.js';
	import { profileSchema } from '#lib/shared/validation.js';

	let householdView = $state<HouseholdView | null>(null);
	let loadingHousehold = $state(true);

	let firstName = $state('');
	let lastName = $state('');
	let editing = $state(false);
	let fieldErrors = $state<{ firstName?: string; lastName?: string }>({});
	let submitError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let pending = $state(false);
	let loggingOut = $state(false);

	$effect(() => {
		loadHousehold()
			.then((view) => (householdView = view))
			.catch(() => (householdView = null))
			.finally(() => (loadingHousehold = false));
	});

	const roleLabels = { owner: 'Owner', adult: 'Adult', member: 'Member' } as const;

	function startEditing() {
		firstName = auth.user?.firstName ?? '';
		lastName = auth.user?.lastName ?? '';
		fieldErrors = {};
		submitError = null;
		successMessage = null;
		editing = true;
	}

	function cancelEditing() {
		editing = false;
		fieldErrors = {};
		submitError = null;
	}

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		const parsed = profileSchema.safeParse({ firstName, lastName });
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
			await updateProfile(parsed.data.firstName, parsed.data.lastName);
			editing = false;
			successMessage = 'Profile updated.';
		} catch (error) {
			submitError =
				error instanceof Error ? error.message : 'Your profile could not be saved. Try again.';
		} finally {
			pending = false;
		}
	}

	async function handleLogout() {
		loggingOut = true;
		try {
			await logout();
			await goto('/login');
		} finally {
			loggingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Profile | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>Profile</h1>
</div>

{#if auth.user}
	<div class="stack">
		{#if successMessage}
			<p class="message message--success" role="status">{successMessage}</p>
		{/if}

		<section class="card" aria-labelledby="profile-heading">
			<h2 id="profile-heading">Your details</h2>
			{#if editing}
				<form onsubmit={handleSave} novalidate>
					<div class="field">
						<label for="profile-first-name">First name</label>
						<input
							id="profile-first-name"
							type="text"
							bind:value={firstName}
							maxlength="60"
							autocomplete="given-name"
							aria-invalid={fieldErrors.firstName ? 'true' : undefined}
							aria-describedby={fieldErrors.firstName ? 'profile-first-name-error' : undefined}
						/>
						{#if fieldErrors.firstName}
							<p class="field__error" id="profile-first-name-error" role="alert">
								{fieldErrors.firstName}
							</p>
						{/if}
					</div>
					<div class="field">
						<label for="profile-last-name">Last name</label>
						<input
							id="profile-last-name"
							type="text"
							bind:value={lastName}
							maxlength="60"
							autocomplete="family-name"
							aria-invalid={fieldErrors.lastName ? 'true' : undefined}
							aria-describedby={fieldErrors.lastName ? 'profile-last-name-error' : undefined}
						/>
						{#if fieldErrors.lastName}
							<p class="field__error" id="profile-last-name-error" role="alert">
								{fieldErrors.lastName}
							</p>
						{/if}
					</div>
					{#if submitError}
						<p class="message message--error" role="alert">{submitError}</p>
					{/if}
					<div class="form-actions">
						<button type="submit" class="btn btn--primary" disabled={pending}>
							{pending ? 'Saving…' : 'Save changes'}
						</button>
						<button
							type="button"
							class="btn btn--secondary"
							disabled={pending}
							onclick={cancelEditing}
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<p><strong>Name:</strong> {auth.user.firstName} {auth.user.lastName}</p>
				<p><strong>Email:</strong> {auth.user.email}</p>
				<p>
					<strong>Household:</strong>
					{#if loadingHousehold}
						<span class="muted">Loading…</span>
					{:else if householdView}
						{householdView.household.name} · {roleLabels[householdView.currentMember.role]}
					{:else}
						<span class="muted">No household yet — <a href="/household">create or join one</a></span>
					{/if}
				</p>
				<button type="button" class="btn btn--secondary" onclick={startEditing}>
					Edit profile
				</button>
			{/if}
		</section>

		<section class="card" aria-labelledby="session-heading">
			<h2 id="session-heading">Session</h2>
			<p class="muted">
				Demo mode: you're signed in with a mock session kept in this browser tab. Logging out
				returns you to the login screen.
			</p>
			<button type="button" class="btn btn--danger" disabled={loggingOut} onclick={handleLogout}>
				{loggingOut ? 'Logging out…' : 'Log out'}
			</button>
		</section>
	</div>
{/if}
