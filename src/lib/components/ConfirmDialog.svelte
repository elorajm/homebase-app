<script lang="ts">
	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		busy = false,
		onconfirm
	}: {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		busy?: boolean;
		onconfirm: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="confirm-dialog"
	aria-labelledby="confirm-dialog-title"
	onclose={() => (open = false)}
>
	<h2 id="confirm-dialog-title">{title}</h2>
	<p>{message}</p>
	<div class="confirm-dialog__actions">
		<button type="button" class="btn btn--secondary" disabled={busy} onclick={() => (open = false)}>
			{cancelLabel}
		</button>
		<button type="button" class="btn btn--danger" disabled={busy} onclick={onconfirm}>
			{busy ? 'Working…' : confirmLabel}
		</button>
	</div>
</dialog>

<style>
	.confirm-dialog {
		width: min(100% - 2rem, 26rem);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background: var(--color-surface);
		color: var(--color-text);
	}

	.confirm-dialog::backdrop {
		background: rgba(28, 36, 48, 0.5);
	}

	.confirm-dialog h2 {
		margin-top: 0;
	}

	.confirm-dialog__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>
