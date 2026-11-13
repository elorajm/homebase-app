<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Edit chore | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>Edit chore</h1>
</div>
<section class="card" aria-labelledby="edit-chore-heading">
	<h2 id="edit-chore-heading">Edit chore {page.params.id}</h2>
	<p class="muted">The chore form arrives in Phase 4.</p>
	<p><a href="/chores">Back to chores</a></p>
</section>
