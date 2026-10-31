import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { guardRedirect, type GuardMode } from "@/lib/redirects";
import { $session, loadSession } from "@/stores/auth";

// Renders nothing. It redirects on the client, after the static shell has loaded.
// The API still enforces access on the server, so this only improves navigation.
export function AuthGuard({ mode = "user" }: { mode?: GuardMode }) {
  const session = useStore($session);

  useEffect(() => {
    void loadSession();

    // Browsers can restore this page from the back-forward cache after logout, with the old session still in memory.
    // Checking again on restore makes the guard see the real state.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void loadSession();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated" && session.status !== "anonymous") {
      return;
    }
    const currentPath = window.location.pathname + window.location.search;
    const target = guardRedirect(mode, session.status === "authenticated", currentPath);
    if (target) {
      window.location.replace(target);
    }
  }, [mode, session]);

  return null;
}
