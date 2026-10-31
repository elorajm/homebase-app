// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

// Static output is the default: every page is prerendered to HTML at build time.
// The Node adapter serves those files and runs any route that sets `prerender = false`.
// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  // Sessions live in PostgreSQL (src/lib/server/session.ts), so Astro's built-in session store stays off.
  session: false,
});
