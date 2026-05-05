import { useState, useEffect } from "react";
import { fetchTexts, fetchSubcorpora, createSubcorpus, updateSubcorpus, deleteSubcorpus } from "../api/client";

export default function SubcorporaPage() {
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state for create/edit
  const [editing, setEditing] = useState(null); // null = closed, {} = create, {subcorpus_id, ...} = edit
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTextIds, setFormTextIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

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
  };

  const openEdit = (sc) => {
    setEditing(sc);
    setFormName(sc.name);
    setFormDesc(sc.description || "");
    setFormTextIds(new Set(sc.texts.map((t) => t.text_id)));
    setFormError(null);
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
            <div key={sc.subcorpus_id} className="card subcorpus-card">
              <div className="subcorpus-header">
                <div>
                  <strong className="subcorpus-name">{sc.name}</strong>
                  <span className="subcorpus-count">{sc.texts.length} text{sc.texts.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-sm" onClick={() => openEdit(sc)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sc)}>Delete</button>
                </div>
              </div>
              {sc.description && <p className="subcorpus-desc">{sc.description}</p>}
              <div className="subcorpus-texts">
                {sc.texts.map((t) => (
                  <span key={t.text_id} className="filter-tag">{t.title || t.filename}</span>
                ))}
              </div>
            </div>
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
                <div className="text-checklist">
                  {(() => {
                    // Group texts by source_db, with ungrouped last
                    const groups = {};
                    texts.forEach((t) => {
                      const key = t.source_db || "(no database)";
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(t);
                    });
                    const sortedKeys = Object.keys(groups).sort((a, b) =>
                      a === "(no database)" ? 1 : b === "(no database)" ? -1 : a.localeCompare(b)
                    );
                    return sortedKeys.map((db) => {
                      const dbTexts = groups[db];
                      const allSelected = dbTexts.every((t) => formTextIds.has(t.text_id));
                      const toggleAll = () => {
                        setFormTextIds((prev) => {
                          const next = new Set(prev);
                          if (allSelected) dbTexts.forEach((t) => next.delete(t.text_id));
                          else dbTexts.forEach((t) => next.add(t.text_id));
                          return next;
                        });
                      };
                      return (
                        <div key={db}>
                          <div className="text-checklist-group-header">
                            <span>{db}</span>
                            <button type="button" className="btn btn-sm" onClick={toggleAll}>
                              {allSelected ? "Deselect all" : "Select all"}
                            </button>
                          </div>
                          {dbTexts.map((t) => (
                            <label key={t.text_id} className="text-check-item">
                              <input
                                type="checkbox"
                                checked={formTextIds.has(t.text_id)}
                                onChange={() => toggleText(t.text_id)}
                              />
                              <span className="text-check-title">{t.title || t.filename}</span>
                              {t.period_start && <span className="text-meta">{t.period_start}{t.period_end && t.period_end !== t.period_start ? `–${t.period_end}` : ""}</span>}
                            </label>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
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
