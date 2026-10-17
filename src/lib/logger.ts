export function logServerError(context: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(`[homebase] ${context} failed (${name})`);
}
