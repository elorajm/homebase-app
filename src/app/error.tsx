"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container page">
      <section className="card" aria-labelledby="error-heading">
        <h1 id="error-heading">Something went wrong</h1>
        <p>The page could not be loaded. Try again, and if the problem continues, reload the page.</p>
        <button type="button" className="btn btn--primary" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
