import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";

export function AppHeader({ userName }: { userName: string }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/dashboard" className="brand">
          HomeBase
        </Link>
        <AppNav />
        <div className="user-bar">
          <span className="user-name">{userName}</span>
          <form action={logout}>
            <button type="submit" className="btn btn--secondary">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
