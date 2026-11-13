<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Error'} | HomeBase</title>
</svelte:head>

<div class="page-header">
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
</div>
<section class="card">
	<p class="muted">
		{page.status === 404
			? 'The page you are looking for does not exist.'
			: 'Something went wrong. Please try again.'}
	</p>
	<p><a href="/dashboard">Back to the dashboard</a></p>
</section>
