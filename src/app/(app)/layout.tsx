import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <AppHeader userName={`${user.firstName} ${user.lastName}`} />
      <main id="main" className="container page">
        {children}
      </main>
    </>
  );
}
