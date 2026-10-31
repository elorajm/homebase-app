export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const DASHBOARD_PATH = "/dashboard";

export type GuardMode = "user" | "guest";

// Signed-in users skip the auth pages. Signed-out users are sent to log in and then back to where they were.
export function guardRedirect(mode: GuardMode, isAuthenticated: boolean, currentPath: string): string | null {
  if (mode === "user") {
    return isAuthenticated ? null : `${LOGIN_PATH}?next=${encodeURIComponent(currentPath)}`;
  }
  return isAuthenticated ? DASHBOARD_PATH : null;
}

// Only same-site paths are accepted, so ?next= cannot send a user to another website.
// Backslashes and control characters are rejected because browsers may normalize them into "//".
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) {
    return DASHBOARD_PATH;
  }
  const isAuthPage = [LOGIN_PATH, REGISTER_PATH].some(
    (path) => value === path || value.startsWith(`${path}?`) || value.startsWith(`${path}/`),
  );
  return isAuthPage ? DASHBOARD_PATH : value;
}
