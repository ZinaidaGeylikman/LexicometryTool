import { useState, useEffect, useRef } from "react";
import { fetchTexts, fetchSubcorpora, createSubcorpus, updateSubcorpus, deleteSubcorpus, fetchSubcorpusStats } from "../api/client";
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

const MAX_SLICES = 8;

function condensed(data) {
  if (data.length <= MAX_SLICES) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SLICES - 1);
  const otherVal = sorted.slice(MAX_SLICES - 1).reduce((s, d) => s + d.value, 0);
  return [...top, { name: "other", value: otherVal }];
}

function StatsPieChart({ title, data, subcorpusName }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const pieData = condensed(data).map((d, i) => ({ ...d, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  const handleExport = async () => {
    if (!ref.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${subcorpusName}_${title.toLowerCase().replace(/\s+/g, "_")}.png`;
      a.click();
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <h4 style={{ margin: 0, fontSize: "0.95rem" }}>{title}</h4>
        <button className="btn btn-sm" onClick={() => setVisible(v => !v)}>
          {visible ? "Hide" : "Show chart"}
        </button>
      </div>
      {visible && (
        <>
          <div ref={ref}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#555" }}>{subcorpusName} — {title}</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} labelLine={false} label={PieLabel}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
                <Legend content={({ payload }) => {
                  if (!payload) return null;
                  const sorted = [...payload].sort((a, b) => {
                    if (a.value === "other") return 1;
                    if (b.value === "other") return -1;
                    return a.value.localeCompare(b.value);
                  });
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.4rem 0.75rem", fontSize: "0.82rem", marginTop: "0.25rem" }}>
                      {sorted.map((e, i) => (
                        <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span style={{ display: "inline-block", width: 11, height: 11, backgroundColor: e.color, borderRadius: 2, flexShrink: 0 }} />
                          {e.value}
                        </span>
                      ))}
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <button className="btn btn-sm" onClick={handleExport}>Export PNG</button>
        </>
      )}
    </div>
  );
}

function SubcorpusCard({ sc, onEdit, onDelete, onStats }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card subcorpus-card">
      <div className="subcorpus-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <strong className="subcorpus-name">{sc.name}</strong>
          <button
            className="btn btn-sm"
            style={{ padding: "0 0.4rem", fontSize: "0.8rem" }}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Hide texts" : "Show texts"}
          >
            {sc.texts.length} text{sc.texts.length !== 1 ? "s" : ""} {expanded ? "▲" : "▼"}
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-sm" onClick={() => onStats(sc)}>Stats</button>
          <button className="btn btn-sm" onClick={() => onEdit(sc)}>Edit</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(sc)}>Delete</button>
        </div>
      </div>
      {sc.description && <p className="subcorpus-desc">{sc.description}</p>}
      {expanded && (
        <div className="subcorpus-texts">
          {sc.texts.map((t) => (
            <span key={t.text_id} className="filter-tag">{t.title || t.filename}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubcorporaPage() {
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state for create/edit
  const [editing, setEditing] = useState(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTextIds, setFormTextIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Filter state for text selection
  const EMPTY_FILTERS = { db: "", domain: "", genre: "", author: "", periodStart: "", periodEnd: "", dateSource: "composition" };
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Stats modal
  const [statsFor, setStatsFor] = useState(null);   // the subcorpus object
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const openStats = async (sc) => {
    setStatsFor(sc);
    setStatsData(null);
    setStatsLoading(true);
    try {
      const data = await fetchSubcorpusStats(sc.subcorpus_id);
      setStatsData(data);
    } finally {
      setStatsLoading(false);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([fetchSubcorpora(), fetchTexts()])
      .then(([scData, textData]) => {
        setSubcorpora(scData.subcorpora);
        setTexts(textData.texts || textData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing({});
    setFormName("");
    setFormDesc("");
    setFormTextIds(new Set());
    setFormError(null);
    setFilters(EMPTY_FILTERS);
  };

  const openEdit = (sc) => {
    setEditing(sc);
    setFormName(sc.name);
    setFormDesc(sc.description || "");
    setFormTextIds(new Set(sc.texts.map((t) => t.text_id)));
    setFormError(null);
    setFilters(EMPTY_FILTERS);
  };

  const closeForm = () => {
    setEditing(null);
    setFormError(null);
  };

  const toggleText = (text_id) => {
    setFormTextIds((prev) => {
      const next = new Set(prev);
      if (next.has(text_id)) next.delete(text_id);
      else next.add(text_id);
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        text_ids: [...formTextIds],
      };
      if (editing.subcorpus_id) {
        await updateSubcorpus(editing.subcorpus_id, payload);
      } else {
        await createSubcorpus(payload);
      }
      closeForm();
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sc) => {
    if (!window.confirm(`Delete subcorpus "${sc.name}"?`)) return;
    try {
      await deleteSubcorpus(sc.subcorpus_id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Subcorpora</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ New Subcorpus</button>
      </div>

      {error && <div className="error-box">Error: {error}</div>}

      {subcorpora.length === 0 ? (
        <div className="card">
          <p>No subcorpora yet. Create one to group texts for targeted queries and frequency analysis.</p>
        </div>
      ) : (
        <div className="subcorpora-list">
          {subcorpora.map((sc) => (
            <SubcorpusCard key={sc.subcorpus_id} sc={sc} onEdit={openEdit} onDelete={handleDelete} onStats={openStats} />
          ))}
        </div>
      )}

      {/* Stats modal */}
      {statsFor && (
        <div className="modal-overlay" onClick={() => setStatsFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h3>Stats — {statsFor.name}</h3>
            {statsLoading && <p>Loading…</p>}
            {statsData && (() => {
              const domainData = Object.entries(statsData.by_domain).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
              const genreData  = Object.entries(statsData.by_genre) .map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                    <div className="card" style={{ textAlign: "center", padding: "0.75rem" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{statsFor.texts.length}</div>
                      <div style={{ color: "#888", fontSize: "0.85rem" }}>texts</div>
                    </div>
                    <div className="card" style={{ textAlign: "center", padding: "0.75rem" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{statsData.token_count.toLocaleString()}</div>
                      <div style={{ color: "#888", fontSize: "0.85rem" }}>tokens</div>
                    </div>
                    <div className="card" style={{ textAlign: "center", padding: "0.75rem" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                        {statsData.period_start ?? "?"}
                        {statsData.period_end && statsData.period_end !== statsData.period_start ? `–${statsData.period_end}` : ""}
                      </div>
                      <div style={{ color: "#888", fontSize: "0.85rem" }}>period</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                    {domainData.length > 0 && <StatsPieChart title="By domain" data={domainData} subcorpusName={statsFor.name} />}
                    {genreData.length > 0  && <StatsPieChart title="By genre"  data={genreData}  subcorpusName={statsFor.name} />}
                  </div>
                </>
              );
            })()}
            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button className="btn" onClick={() => setStatsFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {editing !== null && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.subcorpus_id ? "Edit Subcorpus" : "New Subcorpus"}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Fiction texts"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Short description"
                />
              </div>
              <div className="form-group">
                <label>Texts ({formTextIds.size} selected)</label>

                {/* Filter bar */}
                {(() => {
                  const dbs     = [...new Set(texts.map(t => t.source_db).filter(Boolean))].sort();
                  const domains = [...new Set(texts.map(t => t.domain).filter(Boolean))].sort();
                  const genres  = [...new Set(texts.map(t => t.genre).filter(Boolean))].sort();
                  const setF    = (k, v) => setFilters(f => ({ ...f, [k]: v }));
                  const hasFilter = Object.entries(filters).some(([k, v]) => k !== "dateSource" && v !== "");

                  // Apply filters
                  const filtered = texts.filter(t => {
                    if (filters.db && (t.source_db || "") !== filters.db) return false;
                    if (filters.domain && (t.domain || "") !== filters.domain) return false;
                    if (filters.genre && (t.genre || "") !== filters.genre) return false;
                    if (filters.author && !(t.author || "").toLowerCase().includes(filters.author.toLowerCase())) return false;
                    const start = filters.dateSource === "manuscript" ? t.ms_date_start : t.period_start;
                    const end   = filters.dateSource === "manuscript" ? t.ms_date_end   : t.period_end;
                    if (filters.periodStart && (!end   || end   < parseInt(filters.periodStart))) return false;
                    if (filters.periodEnd   && (!start || start > parseInt(filters.periodEnd)))   return false;
                    return true;
                  });

                  const allFilteredSelected = filtered.length > 0 && filtered.every(t => formTextIds.has(t.text_id));
                  const toggleFiltered = () => setFormTextIds(prev => {
                    const next = new Set(prev);
                    if (allFilteredSelected) filtered.forEach(t => next.delete(t.text_id));
                    else filtered.forEach(t => next.add(t.text_id));
                    return next;
                  });

                  // Group filtered texts by source_db
                  const groups = {};
                  filtered.forEach(t => {
                    const key = t.source_db || "(no database)";
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(t);
                  });
                  const sortedKeys = Object.keys(groups).sort((a, b) =>
                    a === "(no database)" ? 1 : b === "(no database)" ? -1 : a.localeCompare(b)
                  );

                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
                        <select value={filters.db} onChange={e => setF("db", e.target.value)} style={{ fontSize: "0.85rem" }}>
                          <option value="">All databases</option>
                          {dbs.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={filters.domain} onChange={e => setF("domain", e.target.value)} style={{ fontSize: "0.85rem" }}>
                          <option value="">All domains</option>
                          {domains.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={filters.genre} onChange={e => setF("genre", e.target.value)} style={{ fontSize: "0.85rem" }}>
                          <option value="">All genres</option>
                          {genres.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <input value={filters.author} onChange={e => setF("author", e.target.value)} placeholder="Author…" style={{ fontSize: "0.85rem" }} />
                        <input type="number" value={filters.periodStart} onChange={e => setF("periodStart", e.target.value)} placeholder="Period from…" style={{ fontSize: "0.85rem" }} />
                        <input type="number" value={filters.periodEnd}   onChange={e => setF("periodEnd",   e.target.value)} placeholder="Period to…"   style={{ fontSize: "0.85rem" }} />
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
                        <label style={{ fontWeight: "normal" }}>
                          <input type="radio" checked={filters.dateSource === "composition"} onChange={() => setF("dateSource", "composition")} /> Composition
                        </label>
                        <label style={{ fontWeight: "normal" }}>
                          <input type="radio" checked={filters.dateSource === "manuscript"} onChange={() => setF("dateSource", "manuscript")} /> Manuscript
                        </label>
                        {hasFilter && (
                          <button type="button" className="btn btn-sm" onClick={() => setFilters(EMPTY_FILTERS)} style={{ marginLeft: "auto" }}>
                            Clear filters
                          </button>
                        )}
                        <button type="button" className="btn btn-sm" onClick={toggleFiltered} style={{ marginLeft: hasFilter ? "0" : "auto" }}>
                          {allFilteredSelected ? `Deselect ${filtered.length}` : `Select ${filtered.length}`}
                        </button>
                      </div>

                      <div className="text-checklist">
                        {sortedKeys.map(db => (
                          <div key={db}>
                            {!filters.db && (
                              <div className="text-checklist-group-header">
                                <span>{db}</span>
                              </div>
                            )}
                            {groups[db].map(t => (
                              <label key={t.text_id} className="text-check-item">
                                <input type="checkbox" checked={formTextIds.has(t.text_id)} onChange={() => toggleText(t.text_id)} />
                                <span className="text-check-title">{t.title || t.filename}</span>
                                {t.period_start && <span className="text-meta">{t.period_start}{t.period_end && t.period_end !== t.period_start ? `–${t.period_end}` : ""}</span>}
                              </label>
                            ))}
                          </div>
                        ))}
                        {filtered.length === 0 && <div style={{ padding: "0.5rem", color: "#888", fontSize: "0.9rem" }}>No texts match the filters.</div>}
                      </div>
                    </>
                  );
                })()}
              </div>
              {formError && <div className="error-box">{formError}</div>}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
