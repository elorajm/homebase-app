import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { GENERIC_ERROR_MESSAGE } from "@/lib/messages";
import { $session, loadSession, logout } from "@/stores/auth";

export function UserMenu() {
  const session = useStore($session);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void loadSession();
  }, []);

  if (session.status !== "authenticated") {
    return null;
  }

  async function handleLogout() {
    setPending(true);
    setError(undefined);
    const result = await logout();
    if (result.ok) {
      window.location.assign("/login");
      return;
    }
    setError(result.error || GENERIC_ERROR_MESSAGE);
    setPending(false);
  }

  return (
    <>
      <span className="user-name">
        {session.user.firstName} {session.user.lastName}
      </span>
      <button type="button" className="btn btn--secondary" onClick={handleLogout} disabled={pending}>
        {pending ? "Logging out..." : "Log out"}
      </button>
      {error ? (
        <p role="alert" className="message message--error">
          {error}
        </p>
      ) : null}
    </>
  );
}
