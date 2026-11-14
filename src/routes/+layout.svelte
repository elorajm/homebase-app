<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/api/auth.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/chores', label: 'Chores' },
		{ href: '/household', label: 'Household' },
		{ href: '/profile', label: 'Profile' }
	];

	const isAuthPage = $derived(page.url.pathname === '/login' || page.url.pathname === '/register');

	// Mock route guard: logged-out users see only the auth pages, logged-in
	// users skip them. Real auth will do the same with a server session check.
	$effect(() => {
		if (!auth.user && !isAuthPage) {
			goto('/login');
		} else if (auth.user && isAuthPage) {
			goto('/dashboard');
		}
	});

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<a class="skip-link" href="#main">Skip to main content</a>

<div class="demo-banner" role="note">
	<strong>Demo mode</strong> — mock sign-in for UI testing. No real accounts, passwords, or server;
	everything resets when the tab closes.
</div>

{#if isAuthPage}
	<main id="main" class="auth-page">
		{@render children()}
	</main>
{:else if auth.user}
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
			<div class="user-bar">
				<span class="user-name">{auth.user.firstName} {auth.user.lastName}</span>
			</div>
		</div>
	</header>
	<main id="main" class="container page">
		{@render children()}
	</main>
{:else}
	<main id="main" class="container page">
		<p class="muted" role="status">Redirecting to login…</p>
	</main>
{/if}
