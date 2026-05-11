import { useState, useEffect } from "react";
import { fetchTexts, fetchSubcorpora, createSubcorpus, updateSubcorpus, deleteSubcorpus } from "../api/client";

function SubcorpusCard({ sc, onEdit, onDelete }) {
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
            <SubcorpusCard key={sc.subcorpus_id} sc={sc} onEdit={openEdit} onDelete={handleDelete} />
          ))}
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
