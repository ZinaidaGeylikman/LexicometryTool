import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStats } from "../api/client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PIE_COLORS = ["#4a6fa5","#c17f59","#5a9a6f","#9b6ba5","#d4a843","#6b9ec5","#c06b6b","#7a9e7e","#a67c52","#6baed6"];

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>{name}</text>;
}

function toCsv(rows, headers) {
  return "﻿" + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function downloadCsv(content, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  a.download = filename;
  a.click();
}

function DomainPieCard({ title, data, csvHeaders, csvFilename }) {
  const [visible, setVisible] = useState(true);
  const ref = useRef(null);
  const navigate = useNavigate();
  const handleSliceClick = (entry) => {
    if (!entry?.name) return;
    navigate(`/texts?domain=${encodeURIComponent(entry.name)}`);
  };

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const pieData = sorted.map(([name, value], i) => ({ name, value, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  const handleExportPng = async () => {
    if (!ref.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${csvFilename.replace(".csv", "")}.png`;
      a.click();
    });
  };

  const handleExportCsv = () => {
    downloadCsv(toCsv(sorted, csvHeaders), csvFilename);
  };

  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button className="btn btn-sm" onClick={() => setVisible(v => !v)}>
            {visible ? "Hide chart" : "Show chart"}
          </button>
          <button className="btn btn-sm" onClick={handleExportCsv}>CSV</button>
          {visible && <button className="btn btn-sm" onClick={handleExportPng}>PNG</button>}
        </div>
      </div>
      {visible && (
        <div ref={ref}>
          <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#555" }}>{title}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} labelLine={false} label={PieLabel}
                onClick={handleSliceClick} style={{ cursor: "pointer" }}>
                {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip />
              <Legend content={({ payload }) => {
                if (!payload) return null;
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.4rem 0.75rem", fontSize: "0.82rem", marginTop: "0.25rem" }}>
                    {[...payload].sort((a, b) => a.value.localeCompare(b.value)).map((e, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span style={{ display: "inline-block", width: 11, height: 11, backgroundColor: e.color, borderRadius: 2 }} />
                        {e.value}
                      </span>
                    ))}
                  </div>
                );
              }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CsvOnlyCard({ title, data, csvHeaders, csvFilename }) {
  const handleExportCsv = () => {
    const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
    downloadCsv(toCsv(rows, csvHeaders), csvFilename);
  };
  return (
    <section className="card">
      <h3 style={{ margin: "0 0 0.5rem" }}>{title}</h3>
      <button className="btn btn-sm" onClick={handleExportCsv}>Export CSV</button>
    </section>
  );
}

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

      {/* Summary tiles */}
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
        <div className="stat-card">
          <div className="stat-value">{stats.total_domains}</div>
          <div className="stat-label">Domains</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_genres}</div>
          <div className="stat-label">Genres</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {stats.period_start ?? "?"}
            {stats.period_end && stats.period_end !== stats.period_start ? `–${stats.period_end}` : ""}
          </div>
          <div className="stat-label">Period</div>
        </div>
      </div>

      {/* Charts and exports */}
      <div className="dashboard-grid">
        <DomainPieCard
          title="Tokens by Domain"
          data={stats.tokens_by_domain || {}}
          csvHeaders={["Domain", "Tokens"]}
          csvFilename="tokens_by_domain.csv"
        />
        <DomainPieCard
          title="Texts by Domain"
          data={stats.texts_by_domain || {}}
          csvHeaders={["Domain", "Texts"]}
          csvFilename="texts_by_domain.csv"
        />
      </div>
      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <CsvOnlyCard
          title="Tokens by Genre"
          data={stats.tokens_by_genre || {}}
          csvHeaders={["Genre", "Tokens"]}
          csvFilename="tokens_by_genre.csv"
        />
        <CsvOnlyCard
          title="Texts by Genre"
          data={stats.texts_by_genre || {}}
          csvHeaders={["Genre", "Texts"]}
          csvFilename="texts_by_genre.csv"
        />
      </div>
    </div>
  );
}
