<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/chores', label: 'Chores' },
		{ href: '/household', label: 'Household' },
		{ href: '/profile', label: 'Profile' }
	];

	const isAuthPage = $derived(page.url.pathname === '/login' || page.url.pathname === '/register');

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<a class="skip-link" href="#main">Skip to main content</a>

{#if isAuthPage}
	<main id="main" class="auth-page">
		{@render children()}
	</main>
{:else}
	<header class="site-header">
		<div class="container site-header__inner">
			<a href="/dashboard" class="brand">HomeBase</a>
			<nav aria-label="Primary">
				<ul class="app-nav__list">
					{#each links as link (link.href)}
						<li>
							<a
								class="app-nav__link"
								href={link.href}
								aria-current={isActive(link.href, page.url.pathname) ? 'page' : undefined}
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
			<div class="user-bar"></div>
		</div>
	</header>
	<main id="main" class="container page">
		{@render children()}
	</main>
{/if}
