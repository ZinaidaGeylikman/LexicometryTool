import { useEffect, useState } from "react";
import { fetchTexts, uploadText, updateText, deleteText } from "../api/client";

function TextEditModal({ text, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: text.title || "",
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
            <th>Filename</th>
            <th>Domain</th>
            <th>Genre</th>
            <th>Period</th>
            <th>Format</th>
            <th>Tokens</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {texts.map((t) => (
            <tr key={t.text_id}>
              <td>{t.text_id}</td>
              <td>{t.title}</td>
              <td>{t.filename}</td>
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
              <td>{t.format_type || "-"}</td>
              <td>{t.token_count?.toLocaleString()}</td>
              <td className="actions-cell">
                <button className="btn btn-sm" onClick={() => setEditText(t)}>
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(t.text_id, t.filename)}
                >
                  Delete
                </button>
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
        <TextEditModal
          text={editText}
          onSave={handleSave}
          onCancel={() => setEditText(null)}
        />
      )}
    </div>
  );
}
