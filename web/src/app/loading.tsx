export default function Loading() {
  return (
    <main className="page-shell">
      <section className="hero-card skeleton-card" aria-busy="true" aria-live="polite">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </section>
    </main>
  );
}
