import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { fetchLemmaIndex, fetchSubcorpora, renormalizeLemmas, fetchTexts, fetchDatasets, queryCorpus } from "../api/client";
import PosSelector from "../components/PosSelector";

function toCsv(rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(",")).join("\n");
}

function downloadCsv(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onExport }) {
  const [exporting, setExporting] = useState(false);
  const handle = async () => {
    setExporting(true);
    try { await onExport(); } finally { setExporting(false); }
  };
  return (
    <button className="btn btn-sm" onClick={handle} disabled={exporting} type="button">
      {exporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}

function ContextDisplay({ tokens }) {
  return tokens.map((t, i) => (
    <span key={i} className="token-context">{t.token}{" "}</span>
  ));
}

export default function LemmaIndexPage() {
  const location = useLocation();
  const resultsRef = useRef(null);
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [form, setForm] = useState({
    lemma: "", pos: "", not_lemma: "", not_pos: "",
    form: "", not_form: "",
    domain: "", genre: "", period_start: "", period_end: "", subcorpus_id: "", text_id: "", dataset_id: "",
  });
  const [lemmaField, setLemmaField] = useState("dmf");
  const [searchType, setSearchType] = useState("lemma");

  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    if (type === "lemma") setForm((prev) => ({ ...prev, form: "" }));
    else setForm((prev) => ({ ...prev, lemma: "" }));
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [renormalizing, setRenormalizing] = useState(false);
  const [renormMsg, setRenormMsg] = useState(null);

  // Inline query state
  const [inlineQuery, setInlineQuery] = useState(null); // {lemma, pos}
  const [inlineResults, setInlineResults] = useState(null);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState(null);
  const [inlineOffset, setInlineOffset] = useState(0);
  const INLINE_LIMIT = 50;

  const handleRenormalize = async () => {
    setRenormalizing(true);
    setRenormMsg(null);
    try {
      const r = await renormalizeLemmas();
      setRenormMsg(`Done — ${r.updated_tokens} tokens updated.`);
    } catch (e) {
      setRenormMsg(`Error: ${e.message}`);
    } finally {
      setRenormalizing(false);
    }
  };

  useEffect(() => {
    fetchSubcorpora().then((d) => setSubcorpora(d.subcorpora)).catch(() => {});
    fetchTexts().then((d) => setTexts(d.texts)).catch(() => {});
    fetchDatasets().then((d) => setDatasets(d.datasets)).catch(() => {});
  }, []);

  // Handle navigation from POS index (pre-fill filters and auto-submit)
  useEffect(() => {
    if (location.state?.autoSubmit) {
      const s = location.state;
      setForm((prev) => ({
        ...prev,
        pos: s.pos ?? prev.pos,
        domain: s.domain ?? prev.domain,
        genre: s.genre ?? prev.genre,
        period_start: s.period_start ?? prev.period_start,
        period_end: s.period_end ?? prev.period_end,
        subcorpus_id: s.subcorpus_id ?? prev.subcorpus_id,
        text_id: s.text_id ?? prev.text_id,
        dataset_id: s.dataset_id ?? prev.dataset_id,
      }));
      setTimeout(() => {
        document.getElementById("lemma-index-submit")?.click();
      }, 50);
    }
  }, [location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildIndexParams = (overrides = {}) => {
    const f = { ...form, ...overrides };
    const params = {};
    if (f.lemma) params.lemma = f.lemma;
    if (f.pos) params.pos = f.pos;
    if (f.not_lemma) params.not_lemma = f.not_lemma;
    if (f.not_pos) params.not_pos = f.not_pos;
    if (f.form) params.form = f.form;
    if (f.not_form) params.not_form = f.not_form;
    if (f.domain) params.domain = f.domain;
    if (f.genre) params.genre = f.genre;
    if (f.period_start) params.period_start = parseInt(f.period_start);
    if (f.period_end) params.period_end = parseInt(f.period_end);
    if (f.subcorpus_id) params.subcorpus_id = parseInt(f.subcorpus_id);
    if (f.text_id) params.text_id = parseInt(f.text_id);
    if (f.dataset_id) params.dataset_id = parseInt(f.dataset_id);
    params.lemma_field = lemmaField;
    return params;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLemmaIndex(buildIndexParams());
      setData(result);
      setInlineQuery(null);
      setInlineResults(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInlineResults = async (lemma, pos, offset = 0) => {
    setInlineLoading(true);
    setInlineError(null);
    try {
      const params = {
        lemma,
        pos,
        lemma_field: lemmaField,
        context_before: 10,
        context_after: 10,
        limit: INLINE_LIMIT,
        offset,
      };
      if (form.subcorpus_id) params.subcorpus_id = parseInt(form.subcorpus_id);
      if (form.text_id) params.text_id = parseInt(form.text_id);
      const result = await queryCorpus(params);
      setInlineResults(result);
      setInlineOffset(offset);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setInlineError(e.message);
    } finally {
      setInlineLoading(false);
    }
  };

  const handleInlineExport = async () => {
    const { lemma, pos } = inlineQuery;
    const params = {
      lemma, pos,
      lemma_field: lemmaField,
      context_before: 10,
      context_after: 10,
      limit: inlineResults.total,
      offset: 0,
    };
    if (form.subcorpus_id) params.subcorpus_id = parseInt(form.subcorpus_id);
    if (form.text_id) params.text_id = parseInt(form.text_id);
    const data = await queryCorpus(params);
    const header = ["Text", "Domain", "Genre", "Period start", "Period end", "Citation", "Context before", "Match", "Lemma", "POS", "Context after"];
    const rows = data.results.map((r) => [
      r.text_title, r.domain, r.genre, r.period_start, r.period_end, r.citation,
      r.context_before.map((t) => t.token).join(" "),
      r.token,
      r.lemma, r.pos,
      r.context_after.map((t) => t.token).join(" "),
    ]);
    const filename = `${lemma}${pos ? "_" + pos : ""}_examples.csv`;
    downloadCsv(toCsv([header, ...rows]), filename);
  };

  const handleLemmaClick = (lemma, pos) => {
    if (inlineQuery?.lemma === lemma && inlineQuery?.pos === pos) {
      // clicking same lemma again closes the panel
      setInlineQuery(null);
      setInlineResults(null);
    } else {
      setInlineQuery({ lemma, pos });
      fetchInlineResults(lemma, pos, 0);
    }
  };

  const totalInlinePages = inlineResults ? Math.ceil(inlineResults.total / INLINE_LIMIT) : 0;
  const currentInlinePage = Math.floor(inlineOffset / INLINE_LIMIT) + 1;

  return (
    <div className="page">
      <h2>Lemma Index</h2>

      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button className="btn btn-secondary" onClick={handleRenormalize} disabled={renormalizing} type="button">
          {renormalizing ? "Re-normalizing…" : "Re-normalize lemmas"}
        </button>
        {renormMsg && <span className="text-meta">{renormMsg}</span>}
      </div>

      <form onSubmit={handleSubmit} className="query-form card">
        <div className="form-sections">
          {/* Row 1 — What */}
          <div className="form-section">
            <div className="form-section-header">What</div>
            <div className="form-section-fields">
              <div className="search-type-field">
                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  <span className="search-type-toggle">
                    <label><input type="radio" checked={searchType === "lemma"} onChange={() => handleSearchTypeChange("lemma")} /> Lemma</label>
                    <label><input type="radio" checked={searchType === "form"} onChange={() => handleSearchTypeChange("form")} /> Graphic form</label>
                  </span>
                </label>
                {searchType === "lemma"
                  ? <input name="lemma" value={form.lemma} onChange={handleChange} placeholder="e.g. roi/baron/comte" />
                  : <input name="form" value={form.form} onChange={handleChange} placeholder="e.g. roy/rei" />
                }
                <small>Separate alternatives with /</small>
              </div>
              <div className="form-group">
                <label>Lemma field</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" name="lemma_field_li" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} /> DMF</label>
                  <label className="radio-label"><input type="radio" name="lemma_field_li" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} /> Source (TL)</label>
                </div>
              </div>
              <PosSelector label="POS" value={form.pos} onChange={(v) => setForm((p) => ({ ...p, pos: v }))} />
              <div className="form-group">
                <label>Exclude lemma</label>
                <input name="not_lemma" value={form.not_lemma} onChange={handleChange} placeholder="e.g. le/la/les" />
              </div>
              <PosSelector label="Exclude POS" value={form.not_pos} onChange={(v) => setForm((p) => ({ ...p, not_pos: v }))} />
              <div className="form-group">
                <label>Exclude form</label>
                <input name="not_form" value={form.not_form} onChange={handleChange} placeholder="e.g. li/le" />
              </div>
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
        <button id="lemma-index-submit" type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Loading…" : "Browse index"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}

      {data && (
        <div className="card">
          <p className="form-help" style={{ marginBottom: "0.75rem" }}>
            {data.total} entr{data.total === 1 ? "y" : "ies"} — sorted by frequency (most frequent first) — click a lemma to see examples
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Lemma</th>
                <th>POS</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, i) => {
                const isActive = inlineQuery?.lemma === entry.lemma && inlineQuery?.pos === entry.pos;
                return (
                  <tr
                    key={i}
                    style={{ cursor: "pointer", background: isActive ? "var(--color-bg-alt, #f0f4ff)" : undefined }}
                    onClick={() => handleLemmaClick(entry.lemma, entry.pos)}
                    title="Click to see examples"
                  >
                    <td className="text-meta">{i + 1}</td>
                    <td><strong style={{ color: "var(--color-primary, #1a6bbd)" }}>{entry.lemma}</strong></td>
                    <td className="text-meta">{entry.pos || "—"}</td>
                    <td>{entry.count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline query results */}
      {inlineQuery && (
        <div className="card" ref={resultsRef} style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong>
              Examples for <em>{inlineQuery.lemma}</em>
              {inlineQuery.pos ? ` (${inlineQuery.pos})` : ""}
            </strong>
            <button
              className="btn"
              onClick={() => { setInlineQuery(null); setInlineResults(null); }}
              type="button"
            >
              Close
            </button>
          </div>

          {inlineLoading && <p className="text-meta">Loading…</p>}
          {inlineError && <div className="error-box">Error: {inlineError}</div>}

          {inlineResults && !inlineLoading && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                <p className="form-help" style={{ margin: 0 }}>
                  <strong>{inlineResults.total.toLocaleString()}</strong> result{inlineResults.total !== 1 ? "s" : ""}
                  {totalInlinePages > 1 && ` — Page ${currentInlinePage} of ${totalInlinePages}`}
                </p>
                <ExportButton onExport={handleInlineExport} />
              </div>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Text</th>
                    <th>Citation</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {inlineResults.results.map((r, idx) => (
                    <tr key={idx}>
                      <td className="cell-text">
                        <div className="text-title">{r.text_title}</div>
                        <div className="text-meta">{r.domain}/{r.genre}</div>
                      </td>
                      <td className="cell-citation">{r.citation || `pos ${r.position}`}</td>
                      <td className="cell-context">
                        <ContextDisplay tokens={r.context_before} />
                        <strong className="token-match">{r.token} </strong>
                        <ContextDisplay tokens={r.context_after} />
                        <div className="result-info">
                          <em>{r.lemma}</em>/{r.pos}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalInlinePages > 1 && (
                <div className="pagination" style={{ marginTop: "0.75rem" }}>
                  <button className="btn" disabled={currentInlinePage <= 1}
                    onClick={() => fetchInlineResults(inlineQuery.lemma, inlineQuery.pos, 0)}>
                    First
                  </button>
                  <button className="btn" disabled={currentInlinePage <= 1}
                    onClick={() => fetchInlineResults(inlineQuery.lemma, inlineQuery.pos, Math.max(0, inlineOffset - INLINE_LIMIT))}>
                    Previous
                  </button>
                  <button className="btn" disabled={currentInlinePage >= totalInlinePages}
                    onClick={() => fetchInlineResults(inlineQuery.lemma, inlineQuery.pos, inlineOffset + INLINE_LIMIT)}>
                    Next
                  </button>
                  <button className="btn" disabled={currentInlinePage >= totalInlinePages}
                    onClick={() => fetchInlineResults(inlineQuery.lemma, inlineQuery.pos, (totalInlinePages - 1) * INLINE_LIMIT)}>
                    Last
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
