import { useEffect, useState } from "react";
import { fetchStats } from "../api/client";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">Error: {error}</div>;
  if (!stats) return <div className="loading">Loading statistics...</div>;

  return (
    <div className="page">
      <h2>Corpus Overview</h2>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.total_tokens?.toLocaleString()}</div>
          <div className="stat-label">Total Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_texts}</div>
          <div className="stat-label">Texts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.unique_lemmas?.toLocaleString()}</div>
          <div className="stat-label">Unique Lemmas</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Tokens by Domain</h3>
          <table className="data-table">
            <thead>
              <tr><th>Domain</th><th>Tokens</th></tr>
            </thead>
            <tbody>
              {Object.entries(stats.tokens_by_domain || {}).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Tokens by Genre</h3>
          <table className="data-table">
            <thead>
              <tr><th>Genre</th><th>Tokens</th></tr>
            </thead>
            <tbody>
              {Object.entries(stats.tokens_by_genre || {}).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Texts by Domain</h3>
          <table className="data-table">
            <thead>
              <tr><th>Domain</th><th>Count</th></tr>
            </thead>
            <tbody>
              {Object.entries(stats.texts_by_domain || {}).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Texts by Genre</h3>
          <table className="data-table">
            <thead>
              <tr><th>Genre</th><th>Count</th></tr>
            </thead>
            <tbody>
              {Object.entries(stats.texts_by_genre || {}).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
