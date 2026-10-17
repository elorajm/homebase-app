import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/register-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <section className="card" aria-labelledby="register-heading">
      <h1 id="register-heading">Create your account</h1>
      <RegisterForm />
      <p>
        Already registered? <Link href="/login">Log in</Link>.
      </p>
    </section>
  );
}
