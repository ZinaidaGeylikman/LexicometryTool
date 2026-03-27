import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPosIndex, fetchSubcorpora, fetchTexts, fetchDatasets } from "../api/client";
import PosSelector from "../components/PosSelector";

export default function PosIndexPage() {
  const navigate = useNavigate();
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [form, setForm] = useState({
    pos: "", not_pos: "",
    domain: "", genre: "", period_start: "", period_end: "",
    subcorpus_id: "", text_id: "", dataset_id: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubcorpora().then((d) => setSubcorpora(d.subcorpora)).catch(() => {});
    fetchTexts().then((d) => setTexts(d.texts)).catch(() => {});
    fetchDatasets().then((d) => setDatasets(d.datasets)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const params = {};
    if (form.pos) params.pos = form.pos;
    if (form.not_pos) params.not_pos = form.not_pos;
    if (form.domain) params.domain = form.domain;
    if (form.genre) params.genre = form.genre;
    if (form.period_start) params.period_start = parseInt(form.period_start);
    if (form.period_end) params.period_end = parseInt(form.period_end);
    if (form.subcorpus_id) params.subcorpus_id = parseInt(form.subcorpus_id);
    if (form.text_id) params.text_id = parseInt(form.text_id);
    if (form.dataset_id) params.dataset_id = parseInt(form.dataset_id);

    try {
      const result = await fetchPosIndex(params);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePosClick = (pos) => {
    navigate("/lemma-index", {
      state: {
        pos,
        autoSubmit: true,
        domain: form.domain,
        genre: form.genre,
        period_start: form.period_start,
        period_end: form.period_end,
        subcorpus_id: form.subcorpus_id,
        text_id: form.text_id,
        dataset_id: form.dataset_id,
      },
    });
  };

  return (
    <div className="page">
      <h2>POS Index</h2>

      <form onSubmit={handleSubmit} className="query-form card">
        <div className="form-sections">
          {/* Row 1 — What */}
          <div className="form-section">
            <div className="form-section-header">What</div>
            <div className="form-section-fields">
              <PosSelector label="POS" value={form.pos} onChange={(v) => setForm((p) => ({ ...p, pos: v }))} />
              <PosSelector label="Exclude POS" value={form.not_pos} onChange={(v) => setForm((p) => ({ ...p, not_pos: v }))} />
            </div>
          </div>

          {/* Row 2 — Where & When */}
          <div className="form-section">
            <div className="form-section-header">Where &amp; When</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Domain</label>
                <input name="domain" value={form.domain} onChange={handleChange} placeholder="e.g. fiction" />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <input name="genre" value={form.genre} onChange={handleChange} placeholder="e.g. romance" />
              </div>
              <div className="form-group">
                <label>Period from</label>
                <input name="period_start" type="number" value={form.period_start} onChange={handleChange} placeholder="e.g. 1100" />
              </div>
              <div className="form-group">
                <label>Period to</label>
                <input name="period_end" type="number" value={form.period_end} onChange={handleChange} placeholder="e.g. 1200" />
              </div>
            </div>
          </div>

          {/* Row 3 — Corpus */}
          {(texts.length > 0 || subcorpora.length > 0 || datasets.length > 0) && (
            <div className="form-section">
              <div className="form-section-header">Corpus</div>
              <div className="form-section-fields">
                {texts.length > 0 && (
                  <div className="form-group">
                    <label>Within text</label>
                    <select name="text_id" value={form.text_id} onChange={handleChange}>
                      <option value="">All texts</option>
                      {texts.map((t) => <option key={t.text_id} value={t.text_id}>{t.title || t.filename}</option>)}
                    </select>
                  </div>
                )}
                {subcorpora.length > 0 && (
                  <div className="form-group">
                    <label>Within subcorpus</label>
                    <select name="subcorpus_id" value={form.subcorpus_id} onChange={handleChange}>
                      <option value="">Entire corpus</option>
                      {subcorpora.map((s) => <option key={s.subcorpus_id} value={s.subcorpus_id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {datasets.length > 0 && (
                  <div className="form-group">
                    <label>Within dataset</label>
                    <select name="dataset_id" value={form.dataset_id} onChange={handleChange}>
                      <option value="">All contexts</option>
                      {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Loading…" : "Browse POS index"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}

      {data && (
        <div className="card">
          <p className="form-help" style={{ marginBottom: "0.75rem" }}>
            {data.total} POS tag{data.total !== 1 ? "s" : ""} — click any row to browse lemmas with that POS
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>POS</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, i) => (
                <tr
                  key={i}
                  style={{ cursor: "pointer" }}
                  onClick={() => handlePosClick(entry.pos)}
                  title={`Browse lemmas with POS = ${entry.pos}`}
                >
                  <td className="text-meta">{i + 1}</td>
                  <td><strong>{entry.pos}</strong></td>
                  <td>{entry.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
