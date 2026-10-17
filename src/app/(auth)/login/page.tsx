import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <section className="card" aria-labelledby="login-heading">
      <h1 id="login-heading">Log in to HomeBase</h1>
      <p className="muted">Enter the email and password you registered with.</p>
      <LoginForm />
      <p>
        New here? <Link href="/register">Create an account</Link>.
      </p>
    </section>
  );
}
