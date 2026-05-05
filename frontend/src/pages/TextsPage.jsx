import { useEffect, useState } from "react";
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
    const data = {};
    if (form.title) data.title = form.title;
    if (form.author) data.author = form.author;
    if (form.source_db) data.source_db = form.source_db;
    if (form.source_db_url) data.source_db_url = form.source_db_url;
    if (form.domain) data.domain = form.domain;
    if (form.genre) data.genre = form.genre;
    if (form.period_start !== "") data.period_start = parseInt(form.period_start);
    if (form.period_end !== "") data.period_end = parseInt(form.period_end);
    if (form.ms_date_start !== "") data.ms_date_start = parseInt(form.ms_date_start);
    if (form.ms_date_end !== "") data.ms_date_end = parseInt(form.ms_date_end);
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

export default function TextsPage() {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editText, setEditText] = useState(null);
  const [headerText, setHeaderText] = useState(null);
  const [uploading, setUploading] = useState(false);

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
          {texts.map((t, idx) => (
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
          {texts.length === 0 && (
            <tr>
              <td colSpan={9} className="empty-row">
                No texts loaded. Upload an XML-TEI file to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editText && (
        <TextEditModal text={editText} onSave={handleSave} onCancel={() => setEditText(null)} />
      )}
      {headerText && (
        <HeaderMetaModal text={headerText} onClose={() => setHeaderText(null)} />
      )}
    </div>
  );
}
