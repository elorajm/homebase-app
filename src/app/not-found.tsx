import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container page">
      <section className="card">
        <h1>Page not found</h1>
        <p>The page does not exist, or you do not have access to it.</p>
        <Link className="btn btn--primary" href="/dashboard">
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
