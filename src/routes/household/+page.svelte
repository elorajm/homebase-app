<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { DemoScenario } from '#lib/api/dashboard.js';
	import {
		createHousehold,
		joinHousehold,
		loadHousehold,
		removeMember,
		renameHousehold,
		updateMemberRole,
		type HouseholdView
	} from '#lib/api/household.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { canManageHousehold, canModifyMember, canViewInviteCode } from '#lib/shared/permissions.js';
	import { householdNameSchema, joinHouseholdSchema } from '#lib/shared/validation.js';
	import type { Member } from '#lib/shared/types.js';

	// ?demo=empty|error|loading previews each state design without a backend.
	const demo = $derived((page.url.searchParams.get('demo') as DemoScenario) ?? null);

	let view = $state<HouseholdView | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Create household form
	let createName = $state('');
	let createError = $state<string | null>(null);
	let createPending = $state(false);

	// Join household form
	let joinCode = $state('');
	let joinError = $state<string | null>(null);
	let joinPending = $state(false);

	// Rename form (owner only)
	let renameName = $state('');
	let renameError = $state<string | null>(null);
	let renameSuccess = $state<string | null>(null);
	let renamePending = $state(false);

	// Member management (owner only)
	let actionError = $state<string | null>(null);
	let roleBusyId = $state<string | null>(null);
	let removeTarget = $state<Member | null>(null);
	let removeDialogOpen = $state(false);
	let removePending = $state(false);

	// Invite code copy feedback
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const isOwner = $derived(view !== null && canManageHousehold(view.currentMember.role));
	const showInvite = $derived(view !== null && canViewInviteCode(view.currentMember.role));

	const roleLabels: Record<Member['role'], string> = {
		owner: 'Owner',
		adult: 'Adult',
		member: 'Member'
	};

	async function load(scenario: DemoScenario) {
		loading = true;
		loadError = null;
		actionError = null;
		try {
			view = await loadHousehold(scenario);
			renameName = view?.household.name ?? '';
		} catch (error) {
			loadError =
				error instanceof Error ? error.message : 'Something went wrong loading your household.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load(demo);
	});

	function pendingChoresFor(memberId: string): string[] {
		return (view?.chores ?? [])
			.filter((chore) => chore.assignee.id === memberId && chore.status === 'pending')
			.toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))
			.map((chore) => chore.title);
	}

	async function afterMutation() {
		// Mutations from a demo scenario (e.g. creating a household from the
		// empty state) should land on the real view, so drop the query param.
		if (demo) {
			await goto('/household');
		} else {
			await load(null);
		}
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		const parsed = householdNameSchema.safeParse({ name: createName });
		if (!parsed.success) {
			createError = parsed.error.issues[0]?.message ?? 'Enter a household name.';
			return;
		}
		createError = null;
		createPending = true;
		try {
			await createHousehold(parsed.data.name);
			await afterMutation();
		} catch (error) {
			createError =
				error instanceof Error ? error.message : 'The household could not be created. Try again.';
		} finally {
			createPending = false;
		}
	}

	async function handleJoin(event: SubmitEvent) {
		event.preventDefault();
		const parsed = joinHouseholdSchema.safeParse({ inviteCode: joinCode });
		if (!parsed.success) {
			joinError = parsed.error.issues[0]?.message ?? 'Enter an invite code.';
			return;
		}
		joinError = null;
		joinPending = true;
		try {
			await joinHousehold(parsed.data.inviteCode);
			await afterMutation();
		} catch (error) {
			joinError =
				error instanceof Error ? error.message : 'The household could not be joined. Try again.';
		} finally {
			joinPending = false;
		}
	}

	async function handleRename(event: SubmitEvent) {
		event.preventDefault();
		const parsed = householdNameSchema.safeParse({ name: renameName });
		if (!parsed.success) {
			renameError = parsed.error.issues[0]?.message ?? 'Enter a household name.';
			return;
		}
		renameError = null;
		renameSuccess = null;
		renamePending = true;
		try {
			const household = await renameHousehold(parsed.data.name);
			if (view) {
				view = { ...view, household };
			}
			renameName = household.name;
			renameSuccess = 'Household name updated.';
		} catch (error) {
			renameError =
				error instanceof Error ? error.message : 'The household could not be renamed. Try again.';
		} finally {
			renamePending = false;
		}
	}

	async function handleRoleChange(member: Member, event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const role = select.value as 'adult' | 'member';
		actionError = null;
		roleBusyId = member.id;
		try {
			await updateMemberRole(member.id, role);
			await load(demo);
		} catch (error) {
			select.value = member.role;
			actionError =
				error instanceof Error ? error.message : 'The role could not be changed. Try again.';
		} finally {
			roleBusyId = null;
		}
	}

	function askRemove(member: Member) {
		actionError = null;
		removeTarget = member;
		removeDialogOpen = true;
	}

	async function handleRemoveConfirmed() {
		if (!removeTarget) return;
		removePending = true;
		try {
			await removeMember(removeTarget.id);
			removeDialogOpen = false;
			removeTarget = null;
			await load(demo);
		} catch (error) {
			removeDialogOpen = false;
			actionError =
				error instanceof Error ? error.message : 'The member could not be removed. Try again.';
		} finally {
			removePending = false;
		}
	}

	async function copyInviteCode() {
		if (!view) return;
		try {
			await navigator.clipboard.writeText(view.household.inviteCode);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			actionError = 'The invite code could not be copied. Select and copy it manually.';
		}
	}
</script>

<svelte:head>
	<title>Household | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>Household</h1>
</div>

{#if loading}
	<div class="stack" aria-busy="true">
		<p class="visually-hidden" role="status">Loading your household…</p>
		<div class="skeleton skeleton--section"></div>
		<div class="skeleton skeleton--section"></div>
	</div>
{:else if loadError}
	<section class="card" aria-labelledby="household-error-heading">
		<h2 id="household-error-heading">Something went wrong</h2>
		<p class="message message--error" role="alert">{loadError}</p>
		<button type="button" class="btn btn--primary" onclick={() => load(demo)}>Try again</button>
	</section>
{:else if view === null}
	<section class="empty-state">
		<h2>You're not part of a household yet</h2>
		<p>Create a new household, or join an existing one with an invite code.</p>
	</section>
	<div class="grid grid--two">
		<section class="card" aria-labelledby="create-heading">
			<h2 id="create-heading">Create a household</h2>
			<p class="muted">You'll become the owner and get an invite code to share.</p>
			<form onsubmit={handleCreate} novalidate>
				<div class="field">
					<label for="create-name">Household name</label>
					<input
						id="create-name"
						type="text"
						bind:value={createName}
						maxlength="60"
						aria-invalid={createError ? 'true' : undefined}
						aria-describedby={createError ? 'create-name-error' : undefined}
					/>
					{#if createError}
						<p class="field__error" id="create-name-error" role="alert">{createError}</p>
					{/if}
				</div>
				<button type="submit" class="btn btn--primary" disabled={createPending}>
					{createPending ? 'Creating…' : 'Create household'}
				</button>
			</form>
		</section>
		<section class="card" aria-labelledby="join-heading">
			<h2 id="join-heading">Join a household</h2>
			<p class="muted">Ask a household owner or adult for their 8-character invite code.</p>
			<form onsubmit={handleJoin} novalidate>
				<div class="field">
					<label for="join-code">Invite code</label>
					<input
						id="join-code"
						type="text"
						bind:value={joinCode}
						maxlength="8"
						autocapitalize="characters"
						autocomplete="off"
						spellcheck="false"
						aria-invalid={joinError ? 'true' : undefined}
						aria-describedby="join-code-hint {joinError ? 'join-code-error' : ''}"
					/>
					<p class="field__hint" id="join-code-hint">
						Demo tip: HB7K2MQ4 joins the mock Castillo Family.
					</p>
					{#if joinError}
						<p class="field__error" id="join-code-error" role="alert">{joinError}</p>
					{/if}
				</div>
				<button type="submit" class="btn btn--primary" disabled={joinPending}>
					{joinPending ? 'Joining…' : 'Join household'}
				</button>
			</form>
		</section>
	</div>
{:else}
	<div class="stack">
		{#if actionError}
			<p class="message message--error" role="alert">{actionError}</p>
		{/if}

		<section class="card" aria-labelledby="overview-heading">
			<div class="overview">
				<div>
					<h2 id="overview-heading">{view.household.name}</h2>
					<p class="muted">
						{view.household.members.length} member{view.household.members.length === 1 ? '' : 's'}
						· You're
						{view.currentMember.role === 'owner'
							? 'the owner'
							: view.currentMember.role === 'adult'
								? 'an adult'
								: 'a member'}
					</p>
				</div>
				<span class="badge badge--role">{roleLabels[view.currentMember.role]}</span>
			</div>
			<p class="muted mock-note">
				Mock mode: changes are kept in memory only and reset when you reload the page.
			</p>
		</section>

		<section class="card" aria-labelledby="members-heading">
			<h2 id="members-heading">Members</h2>
			<ul class="member-list">
				{#each view.household.members as member (member.id)}
					{@const pendingTitles = pendingChoresFor(member.id)}
					<li class="member-item">
						<div class="member-item__info">
							<p>
								<strong>{member.firstName} {member.lastName}</strong>
								{#if member.id === view.currentMember.id}
									<span class="muted">(you)</span>
								{/if}
								<span class="badge badge--role">{roleLabels[member.role]}</span>
							</p>
							{#if pendingTitles.length === 0}
								<p class="muted">No pending chores</p>
							{:else}
								<p class="muted">
									{pendingTitles.length} pending chore{pendingTitles.length === 1 ? '' : 's'}:
									{pendingTitles.slice(0, 3).join(', ')}{pendingTitles.length > 3 ? ', …' : ''}
								</p>
							{/if}
						</div>
						{#if isOwner && canModifyMember(view.currentMember.role, member.role)}
							<div class="member-item__controls">
								<label class="visually-hidden" for="role-{member.id}">
									Role for {member.firstName} {member.lastName}
								</label>
								<select
									id="role-{member.id}"
									class="role-select"
									value={member.role}
									disabled={roleBusyId === member.id}
									onchange={(event) => handleRoleChange(member, event)}
								>
									<option value="adult">Adult</option>
									<option value="member">Member</option>
								</select>
								<button
									type="button"
									class="btn btn--danger"
									disabled={removePending && removeTarget?.id === member.id}
									onclick={() => askRemove(member)}
								>
									Remove
								</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		{#if showInvite}
			<section class="card" aria-labelledby="invite-heading">
				<h2 id="invite-heading">Invite a member</h2>
				<p class="muted">
					Share this code with someone you trust. They can join from their Household page.
				</p>
				<div class="invite-row">
					<code class="invite-code">{view.household.inviteCode}</code>
					<button type="button" class="btn btn--secondary" onclick={copyInviteCode}>
						{copied ? 'Copied!' : 'Copy code'}
					</button>
				</div>
			</section>
		{/if}

		<section class="card" aria-labelledby="settings-heading">
			<h2 id="settings-heading">Household settings</h2>
			{#if isOwner}
				<form onsubmit={handleRename} novalidate>
					<div class="field">
						<label for="rename-name">Household name</label>
						<input
							id="rename-name"
							type="text"
							bind:value={renameName}
							maxlength="60"
							aria-invalid={renameError ? 'true' : undefined}
							aria-describedby={renameError ? 'rename-name-error' : undefined}
						/>
						{#if renameError}
							<p class="field__error" id="rename-name-error" role="alert">{renameError}</p>
						{/if}
					</div>
					{#if renameSuccess}
						<p class="message message--success" role="status">{renameSuccess}</p>
					{/if}
					<button type="submit" class="btn btn--primary" disabled={renamePending}>
						{renamePending ? 'Saving…' : 'Save name'}
					</button>
				</form>
			{:else}
				<p class="muted">
					Only the household owner can rename the household, change member roles, or remove
					members. Ask {view.household.members.find((m) => m.role === 'owner')?.firstName ??
						'the owner'} if something needs to change.
				</p>
			{/if}
		</section>
	</div>
{/if}

<ConfirmDialog
	bind:open={removeDialogOpen}
	title="Remove member?"
	message={removeTarget
		? `${removeTarget.firstName} ${removeTarget.lastName} will lose access to this household. Their pending chores will be reassigned to you.`
		: ''}
	confirmLabel="Remove member"
	busy={removePending}
	onconfirm={handleRemoveConfirmed}
/>

<style>
	.overview {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}

	.mock-note {
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}

	.invite-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.invite-code {
		padding: 0.5rem 1rem;
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		background: var(--color-primary-tint);
		border: 1px dashed var(--color-primary);
		border-radius: var(--radius);
	}
</style>
