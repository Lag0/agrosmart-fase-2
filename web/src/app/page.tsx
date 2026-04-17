export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="eyebrow">AgroSmart Fase 2</span>
        <h1>Dashboard scaffold ready</h1>
        <p>
          This placeholder page confirms the Next.js app is running and ready for the
          production dashboard, upload flow, and analysis features.
        </p>
        <div className="link-row">
          <a href="/upload">Upload</a>
          <a href="/report">Report</a>
          <a href="/admin/audit">Admin audit</a>
        </div>
      </section>
    </main>
  );
}
