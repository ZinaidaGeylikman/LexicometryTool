import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTexts, uploadText, updateText, deleteText } from "../api/client";

function HeaderMetaModal({ text, onClose }) {
  const m = text.tei_header_meta || {};
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h3>Header info — {text.title || text.filename}</h3>
        {m.citation && (
          <div style={{ marginBottom: "1rem" }}>
            <strong>Citation</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{m.citation}</p>
          </div>
        )}
        {m.editor && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Editor</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{m.editor}</p>
          </div>
        )}
        {m.funder && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Funder</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{m.funder}</p>
          </div>
        )}
        {m.publisher && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Publisher</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{m.publisher}</p>
          </div>
        )}
        {m.contributors && m.contributors.length > 0 && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Contributors</strong>
            <table style={{ marginTop: "0.25rem", fontSize: "0.9rem", width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {m.contributors.map((c, i) => (
                  <tr key={i}>
                    <td style={{ padding: "0.15rem 0.5rem 0.15rem 0", color: "#666", verticalAlign: "top", whiteSpace: "nowrap" }}>{c.role}</td>
                    <td style={{ padding: "0.15rem 0" }}>{c.names.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {m.source && (
          <div style={{ marginBottom: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
            <strong>Source edition</strong>
            <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
              {m.source.title && <div style={{ fontStyle: "italic" }}>{m.source.title}</div>}
              {m.source.author && <div>Author: {m.source.author}</div>}
              {m.source.editors && <div>Ed.: {m.source.editors.join(", ")}</div>}
              {(m.source.publisher || m.source.pub_place || m.source.pub_date) && (
                <div style={{ color: "#666" }}>
                  {[m.source.publisher, m.source.pub_place, m.source.pub_date].filter(Boolean).join(", ")}
                </div>
              )}
              {m.source.note && <div style={{ marginTop: "0.25rem", color: "#555" }}>{m.source.note}</div>}
              {m.source.digital_source && (
                <div>Digital source: <a href={m.source.digital_source.url} target="_blank" rel="noreferrer">{m.source.digital_source.label}</a></div>
              )}
            </div>
          </div>
        )}
        {(m.idno_bfm || m.idno_doi) && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Identifiers</strong>
            <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
              {m.idno_bfm && <div><a href={m.idno_bfm} target="_blank" rel="noreferrer">{m.idno_bfm}</a></div>}
              {m.idno_doi && <div>DOI: <a href={`https://doi.org/${m.idno_doi}`} target="_blank" rel="noreferrer">{m.idno_doi}</a></div>}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TextEditModal({ text, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: text.title || "",
    author: text.author || "",
    source_db: text.source_db || "",
    source_db_url: text.source_db_url || "",
    domain: text.domain || "",
    genre: text.genre || "",
    period_start: text.period_start ?? "",
    period_end: text.period_end ?? "",
    ms_date_start: text.ms_date_start ?? "",
    ms_date_end: text.ms_date_end ?? "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      title: form.title || null,
      author: form.author || null,
      source_db: form.source_db || null,
      source_db_url: form.source_db_url || null,
      domain: form.domain || null,
      genre: form.genre || null,
      period_start: form.period_start !== "" ? parseInt(form.period_start) : null,
      period_end: form.period_end !== "" ? parseInt(form.period_end) : null,
      ms_date_start: form.ms_date_start !== "" ? parseInt(form.ms_date_start) : null,
      ms_date_end: form.ms_date_end !== "" ? parseInt(form.ms_date_end) : null,
    };
    onSave(data);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit: {text.filename}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Author</label>
            <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="e.g. Chrétien de Troyes" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Source database</label>
              <input value={form.source_db} onChange={(e) => setForm({ ...form, source_db: e.target.value })} placeholder="e.g. BFM22" />
            </div>
            <div className="form-group">
              <label>Source URL</label>
              <input value={form.source_db_url} onChange={(e) => setForm({ ...form, source_db_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="form-group">
            <label>Domain</label>
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="e.g. fiction, law, religious" />
          </div>
          <div className="form-group">
            <label>Genre</label>
            <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="e.g. romance, epic, coutumier" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Composition from</label>
              <input type="number" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Composition to</label>
              <input type="number" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Manuscript from</label>
              <input type="number" value={form.ms_date_start} onChange={(e) => setForm({ ...form, ms_date_start: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Manuscript to</label>
              <input type="number" value={form.ms_date_end} onChange={(e) => setForm({ ...form, ms_date_end: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const EMPTY_FILTERS = { search: "", author: "", source: "", domain: "", genre: "", periodStart: "", periodEnd: "", dateSource: "composition" };

export default function TextsPage() {
  const [searchParams] = useSearchParams();
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editText, setEditText] = useState(null);
  const [headerText, setHeaderText] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    domain: searchParams.get("domain") || "",
    genre:  searchParams.get("genre")  || "",
  });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const load = () => {
    setLoading(true);
    fetchTexts()
      .then((data) => setTexts(data.texts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadText(file);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async (data) => {
    try {
      await updateText(editText.text_id, data);
      setEditText(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Delete "${filename}" and all its tokens?`)) return;
    try {
      await deleteText(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div className="loading">Loading texts...</div>;

  return (
    <div className="page">
      <h2>Texts</h2>

      <div className="card">
        <label className="btn btn-primary upload-btn">
          {uploading ? "Uploading..." : "Upload XML-TEI file"}
          <input type="file" accept=".xml" onChange={handleUpload} hidden disabled={uploading} />
        </label>
      </div>

      {error && <div className="error-box">Error: {error}</div>}

      {/* Search + filter bar */}
      {texts.length > 0 && (() => {
        const sources = [...new Set(texts.map(t => t.source_db).filter(Boolean))].sort();
        const domains = [...new Set(texts.map(t => t.domain).filter(Boolean))].sort();
        const genres  = [...new Set(texts.map(t => t.genre).filter(Boolean))].sort();
        const authors = [...new Set(texts.map(t => t.author).filter(Boolean))].sort();
        const hasFilter = Object.entries(filters).some(([k, v]) => k !== "dateSource" && v !== "");
        return (
          <div className="card" style={{ marginBottom: "0.5rem" }}>
            <input
              value={filters.search}
              onChange={e => setF("search", e.target.value)}
              placeholder="Search title or author…"
              style={{ width: "100%", marginBottom: "0.5rem" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <select value={filters.source} onChange={e => setF("source", e.target.value)}>
                <option value="">All databases</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filters.domain} onChange={e => setF("domain", e.target.value)}>
                <option value="">All domains</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filters.genre} onChange={e => setF("genre", e.target.value)}>
                <option value="">All genres</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={filters.author} onChange={e => setF("author", e.target.value)}>
                <option value="">All authors</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem" }}>
              <input type="number" value={filters.periodStart} onChange={e => setF("periodStart", e.target.value)} placeholder="Period from…" style={{ width: 110 }} />
              <input type="number" value={filters.periodEnd}   onChange={e => setF("periodEnd",   e.target.value)} placeholder="Period to…"   style={{ width: 110 }} />
              <label style={{ fontWeight: "normal" }}><input type="radio" checked={filters.dateSource === "composition"} onChange={() => setF("dateSource", "composition")} /> Composition</label>
              <label style={{ fontWeight: "normal" }}><input type="radio" checked={filters.dateSource === "manuscript"}  onChange={() => setF("dateSource", "manuscript")}  /> Manuscript</label>
              {hasFilter && <button className="btn btn-sm" onClick={() => setFilters(EMPTY_FILTERS)} style={{ marginLeft: "auto" }}>Clear filters</button>}
            </div>
          </div>
        );
      })()}

      {(() => {
        const q = filters.search.toLowerCase();
        const filtered = texts.filter(t => {
          if (q && !(t.title || "").toLowerCase().includes(q) && !(t.author || "").toLowerCase().includes(q)) return false;
          if (filters.author && (t.author || "") !== filters.author) return false;
          if (filters.source && (t.source_db || "") !== filters.source) return false;
          if (filters.domain && (t.domain || "") !== filters.domain) return false;
          if (filters.genre  && (t.genre  || "") !== filters.genre)  return false;
          const start = filters.dateSource === "manuscript" ? t.ms_date_start : t.period_start;
          const end   = filters.dateSource === "manuscript" ? t.ms_date_end   : t.period_end;
          if (filters.periodStart && (!end   || end   < parseInt(filters.periodStart))) return false;
          if (filters.periodEnd   && (!start || start > parseInt(filters.periodEnd)))   return false;
          return true;
        });

        return (
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Author</th>
            <th>Source</th>
            <th>Domain</th>
            <th>Genre</th>
            <th>Period</th>
            <th>Tokens</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t, idx) => (
            <tr key={t.text_id}>
              <td>{idx + 1}</td>
              <td>{t.title}</td>
              <td>{t.author || "-"}</td>
              <td>
                {t.source_db
                  ? (t.source_db_url
                      ? <a href={t.source_db_url} target="_blank" rel="noreferrer">{t.source_db}</a>
                      : t.source_db)
                  : "-"}
                {t.tei_header_meta && Object.keys(t.tei_header_meta).length > 0 && (
                  <button
                    className="btn btn-sm"
                    title="View header info"
                    onClick={() => setHeaderText(t)}
                    style={{ marginLeft: "0.4rem", padding: "0 0.35rem", fontSize: "0.8rem" }}
                  >
                    ⓘ
                  </button>
                )}
              </td>
              <td>{t.domain || "-"}</td>
              <td>{t.genre || "-"}</td>
              <td>
                {t.period_start
                  ? (t.period_end && t.period_end !== t.period_start
                      ? `Comp. ${t.period_start}–${t.period_end}`
                      : `Comp. ${t.period_start}`)
                  : "-"}
                {t.ms_date_start && (
                  <><br /><em style={{ color: "var(--text-muted, #888)", fontSize: "0.85em" }}>
                    {t.ms_date_end && t.ms_date_end !== t.ms_date_start
                      ? `Ms. ${t.ms_date_start}–${t.ms_date_end}`
                      : `Ms. ${t.ms_date_start}`}
                  </em></>
                )}
              </td>
              <td>{t.token_count?.toLocaleString()}</td>
              <td className="actions-cell">
                <button className="btn btn-sm" onClick={() => setEditText(t)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.text_id, t.filename)}>Delete</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={9} className="empty-row">
                {texts.length === 0 ? "No texts loaded. Upload an XML-TEI file to get started." : "No texts match the filters."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
        );
      })()}

      {editText && (
        <TextEditModal text={editText} onSave={handleSave} onCancel={() => setEditText(null)} />
      )}
      {headerText && (
        <HeaderMetaModal text={headerText} onClose={() => setHeaderText(null)} />
      )}
    </div>
  );
}
