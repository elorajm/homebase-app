import type { Cookies } from "@/lib/server/session";

// Minimal stand-in for Astro's cookie store. It records every set and delete so tests can inspect them.
export function fakeCookies(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const sets: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const deletes: { name: string; options?: Record<string, unknown> }[] = [];

  const store = {
    get: (name: string) => (values.has(name) ? { value: values.get(name) as string } : undefined),
    has: (name: string) => values.has(name),
    set: (name: string, value: string | number | boolean | Record<string, unknown>, options = {}) => {
      values.set(name, String(value));
      sets.push({ name, value: String(value), options: options as Record<string, unknown> });
    },
    delete: (name: string, options?: Record<string, unknown>) => {
      values.delete(name);
      deletes.push({ name, options });
    },
    sets,
    deletes,
  };

  return store as unknown as Cookies & { sets: typeof sets; deletes: typeof deletes };
}
