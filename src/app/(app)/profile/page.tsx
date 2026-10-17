import type { Metadata } from "next";
import { ProfileForm } from "@/components/forms/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <>
      <div className="page-header">
        <h1>Profile</h1>
      </div>
      <section className="card" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Your details</h2>
        <p className="muted">Email: {user.email}</p>
        <ProfileForm firstName={user.firstName} lastName={user.lastName} />
      </section>
    </>
  );
}
