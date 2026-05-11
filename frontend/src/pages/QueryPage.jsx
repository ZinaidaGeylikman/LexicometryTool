import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { queryCorpus, querySequence, fetchDatasets, fetchSubcorpora, fetchTexts } from "../api/client";
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

function ContextDisplay({ tokens }) {
  return tokens.map((t, i) => (
    <span key={i} className="token-context">
      {t.token}{" "}
    </span>
  ));
}

/* ---- Shared results display ---- */
function ResultsDisplay({ results, form, goToPage, onExport }) {
  const [exporting, setExporting] = useState(false);
  if (!results) return null;

  const limit = parseInt(form.limit);
  const offset = parseInt(form.offset);
  const totalPages = Math.ceil(results.total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handleExport = async () => {
    setExporting(true);
    try { await onExport(); } finally { setExporting(false); }
  };

  return (
    <div className="results-section">
      <div className="results-header">
        <strong>{results.total.toLocaleString()}</strong> results found
        {totalPages > 1 && (
          <span className="page-info">
            {" "}&mdash; Page {currentPage} of {totalPages}
          </span>
        )}
        {onExport && (
          <button className="btn btn-sm" onClick={handleExport} disabled={exporting} style={{ marginLeft: "1rem" }}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        )}
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
          {results.results.map((r, idx) => {
            // sequence results have r.tokens (array), simple results are flat
            const tokens = r.tokens || [r];
            const first = tokens[0];
            return (
              <tr key={idx}>
                <td className="cell-text">
                  <div className="text-title">{first.text_title}</div>
                  <div className="text-meta">{first.domain}/{first.genre}</div>
                </td>
                <td className="cell-citation">{first.citation || `pos ${first.position}`}</td>
                <td className="cell-context">
                  <ContextDisplay tokens={first.context_before} />
                  {tokens.map((t, ti) => (
                    <strong key={ti} className="token-match">{t.token} </strong>
                  ))}
                  <ContextDisplay tokens={tokens[tokens.length - 1].context_after} />
                  <div className="result-info">
                    {tokens.map((t, ti) => (
                      <span key={ti}>
                        {ti > 0 && " + "}
                        <em>{t.lemma}</em>/{t.pos}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn" disabled={currentPage <= 1} onClick={() => goToPage(0)}>
            First
          </button>
          <button className="btn" disabled={currentPage <= 1} onClick={() => goToPage(Math.max(0, offset - limit))}>
            Previous
          </button>
          <span className="page-info">Page {currentPage} / {totalPages}</span>
          <button className="btn" disabled={currentPage >= totalPages} onClick={() => goToPage(offset + limit)}>
            Next
          </button>
          <button className="btn" disabled={currentPage >= totalPages} onClick={() => goToPage((totalPages - 1) * limit)}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}

/* ==== SIMPLE QUERY TAB ==== */
function SimpleQuery({ datasets, subcorpora, texts, initialDatasetId, initialState = {} }) {
  const [form, setForm] = useState({
    lemma: initialState.lemma || "", pos: initialState.pos || "",
    not_lemma: "", not_pos: "",
    form: initialState.form || "", not_form: "",
    domain: initialState.domain || "", genre: initialState.genre || "",
    period_start: initialState.period_start || "", period_end: initialState.period_end || "",
    dataset_id: initialState.dataset_id || initialDatasetId || "",
    subcorpus_id: initialState.subcorpus_id || "", text_id: "",
    context_before: 5, context_after: 5, limit: 50, offset: 0,
  });
  const [lemmaField, setLemmaField] = useState("dmf");
  const [searchType, setSearchType] = useState(initialState.form ? "form" : "lemma");

  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    if (type === "lemma") setForm((prev) => ({ ...prev, form: "" }));
    else setForm((prev) => ({ ...prev, lemma: "" }));
  };
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-submit when navigated from a chart click
  useEffect(() => {
    if (initialState.autosubmit) {
      const hasFilter = initialState.lemma || initialState.domain || initialState.genre ||
                        initialState.period_start || initialState.subcorpus_id || initialState.form;
      if (hasFilter) {
        setLoading(true);
        const params = {};
        if (initialState.lemma) params.lemma = initialState.lemma;
        if (initialState.form) params.form = initialState.form;
        if (initialState.pos) params.pos = initialState.pos;
        if (initialState.domain) params.domain = initialState.domain;
        if (initialState.genre) params.genre = initialState.genre;
        if (initialState.period_start) params.period_start = parseInt(initialState.period_start);
        if (initialState.period_end) params.period_end = parseInt(initialState.period_end);
        if (initialState.subcorpus_id) params.subcorpus_id = parseInt(initialState.subcorpus_id);
        if (initialState.dataset_id) params.dataset_id = parseInt(initialState.dataset_id);
        params.context_before = 5; params.context_after = 5;
        params.limit = 50; params.offset = 0; params.lemma_field = "dmf";
        queryCorpus(params)
          .then(setResults)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false));
      }
    }
  }, []);  // eslint-disable-line

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildParams = (overrideOffset) => {
    const params = {};
    if (form.lemma) params.lemma = form.lemma;
    if (form.pos) params.pos = form.pos;
    if (form.not_lemma) params.not_lemma = form.not_lemma;
    if (form.not_pos) params.not_pos = form.not_pos;
    if (form.form) params.form = form.form;
    if (form.not_form) params.not_form = form.not_form;
    if (form.domain) params.domain = form.domain;
    if (form.genre) params.genre = form.genre;
    if (form.period_start) params.period_start = parseInt(form.period_start);
    if (form.period_end) params.period_end = parseInt(form.period_end);
    if (form.dataset_id) params.dataset_id = parseInt(form.dataset_id);
    if (form.subcorpus_id) params.subcorpus_id = parseInt(form.subcorpus_id);
    if (form.text_id) params.text_id = parseInt(form.text_id);
    params.context_before = parseInt(form.context_before);
    params.context_after = parseInt(form.context_after);
    params.limit = parseInt(form.limit);
    params.offset = overrideOffset !== undefined ? overrideOffset : parseInt(form.offset);
    params.lemma_field = lemmaField;
    return params;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setForm((prev) => ({ ...prev, offset: 0 }));
    try {
      const data = await queryCorpus(buildParams(0));
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (newOffset) => {
    setForm((prev) => ({ ...prev, offset: newOffset }));
    setLoading(true);
    queryCorpus(buildParams(newOffset))
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const handleExport = async () => {
    const params = { ...buildParams(0), limit: results.total };
    const data = await queryCorpus(params);
    const header = ["Text", "Domain", "Genre", "Period start", "Period end", "Citation", "Context before", "Match", "Lemma", "POS", "Context after"];
    const rows = data.results.map((r) => [
      r.text_title, r.domain, r.genre, r.period_start, r.period_end, r.citation,
      r.context_before.map((t) => t.token).join(" "),
      r.token,
      r.lemma, r.pos,
      r.context_after.map((t) => t.token).join(" "),
    ]);
    downloadCsv(toCsv([header, ...rows]), "query_results.csv");
  };

  return (
    <>
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
                  ? <input name="lemma" value={form.lemma} onChange={handleChange} placeholder="e.g. roi/comte/baron" />
                  : <input name="form" value={form.form} onChange={handleChange} placeholder="e.g. roy/rei" />
                }
                <small>Separate alternatives with /</small>
              </div>
              <div className="form-group">
                <label>Lemma field</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" name="lemma_field_sq" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} /> DMF</label>
                  <label className="radio-label"><input type="radio" name="lemma_field_sq" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} /> Source (TL)</label>
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
                      <option value="">Entire corpus</option>
                      {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4 — Examples */}
          <div className="form-section">
            <div className="form-section-header">Examples</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Context before</label>
                <input name="context_before" type="number" value={form.context_before} onChange={handleChange} min={0} max={50} />
              </div>
              <div className="form-group">
                <label>Context after</label>
                <input name="context_after" type="number" value={form.context_after} onChange={handleChange} min={0} max={50} />
              </div>
              <div className="form-group">
                <label>Results per page</label>
                <select name="limit" value={form.limit} onChange={handleChange}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}
      <ResultsDisplay results={results} form={form} goToPage={goToPage} onExport={results ? handleExport : undefined} />
    </>
  );
}

/* ==== SEQUENCE QUERY TAB ==== */
const EMPTY_SLOT = { lemma: "", pos: "", not_lemma: "", not_pos: "", form: "", not_form: "" };

function SequenceQuery({ datasets, subcorpora, texts, initialDatasetId }) {
  const [slots, setSlots] = useState([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }]);
  const [options, setOptions] = useState({
    domain: "", genre: "", period_start: "", period_end: "",
    dataset_id: initialDatasetId || "", subcorpus_id: "", text_id: "",
    context_before: 5, context_after: 5, limit: 50, offset: 0,
  });
  const [lemmaField, setLemmaField] = useState("dmf");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateSlot = (idx, field, value) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const addSlot = () => setSlots((prev) => [...prev, { ...EMPTY_SLOT }]);
  const removeSlot = (idx) => {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildParams = (overrideOffset) => {
    const pattern = slots.map((s) => {
      const item = {};
      if (s.lemma) item.lemma = s.lemma;
      if (s.pos) item.pos = s.pos;
      if (s.not_lemma) item.not_lemma = s.not_lemma;
      if (s.not_pos) item.not_pos = s.not_pos;
      if (s.form) item.form = s.form;
      if (s.not_form) item.not_form = s.not_form;
      return item;
    });
    const params = { pattern };
    if (options.domain) params.domain = options.domain;
    if (options.genre) params.genre = options.genre;
    if (options.period_start) params.period_start = parseInt(options.period_start);
    if (options.period_end) params.period_end = parseInt(options.period_end);
    if (options.dataset_id) params.dataset_id = parseInt(options.dataset_id);
    if (options.subcorpus_id) params.subcorpus_id = parseInt(options.subcorpus_id);
    if (options.text_id) params.text_id = parseInt(options.text_id);
    params.context_before = parseInt(options.context_before);
    params.context_after = parseInt(options.context_after);
    params.limit = parseInt(options.limit);
    params.offset = overrideOffset !== undefined ? overrideOffset : parseInt(options.offset);
    params.lemma_field = lemmaField;
    return params;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOptions((prev) => ({ ...prev, offset: 0 }));
    try {
      const data = await querySequence(buildParams(0));
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (newOffset) => {
    setOptions((prev) => ({ ...prev, offset: newOffset }));
    setLoading(true);
    querySequence(buildParams(newOffset))
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const handleExport = async () => {
    const params = { ...buildParams(0), limit: results.total };
    const data = await querySequence(params);
    const header = ["Text", "Domain", "Genre", "Period start", "Period end", "Citation", "Context before", "Match", "Lemmas", "POS tags", "Context after"];
    const rows = data.results.map(({ tokens }) => {
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      return [
        first.text_title, first.domain, first.genre, first.period_start, first.period_end, first.citation,
        first.context_before.map((t) => t.token).join(" "),
        tokens.map((t) => t.token).join(" "),
        tokens.map((t) => t.lemma).join(" + "),
        tokens.map((t) => t.pos).join(" + "),
        last.context_after.map((t) => t.token).join(" "),
      ];
    });
    downloadCsv(toCsv([header, ...rows]), "query_results.csv");
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="query-form card">
        <p className="form-help">
          Define a sequence of tokens to search for. Each slot matches one token position.
          Use / to separate alternatives (e.g. roi/comte).
        </p>

        <div className="sequence-slots">
          {slots.map((slot, idx) => (
            <div key={idx} className="sequence-slot">
              <div className="slot-header">
                <strong>Position {idx + 1}</strong>
                {slots.length > 2 && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSlot(idx)}>Remove</button>
                )}
              </div>
              <div className="slot-fields">
                <div className="form-group">
                  <label>Lemma</label>
                  <input value={slot.lemma} onChange={(e) => updateSlot(idx, "lemma", e.target.value)} placeholder="e.g. personne" />
                </div>
                <PosSelector label="POS" value={slot.pos} onChange={(v) => updateSlot(idx, "pos", v)} />
                <div className="form-group">
                  <label>Exclude lemma</label>
                  <input value={slot.not_lemma} onChange={(e) => updateSlot(idx, "not_lemma", e.target.value)} placeholder="e.g. avoir/estre" />
                </div>
                <PosSelector label="Exclude POS" value={slot.not_pos} onChange={(v) => updateSlot(idx, "not_pos", v)} />
                <div className="form-group">
                  <label>Graphic form</label>
                  <input value={slot.form} onChange={(e) => updateSlot(idx, "form", e.target.value)} placeholder="e.g. roy/rei" />
                </div>
                <div className="form-group">
                  <label>Exclude form</label>
                  <input value={slot.not_form} onChange={(e) => updateSlot(idx, "not_form", e.target.value)} placeholder="e.g. li/le" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn" onClick={addSlot} style={{ marginBottom: "1rem" }}>
          + Add position
        </button>

        <div className="form-sections">
          {/* Row 1 — Lemma field (per-slot "what" is handled above) */}
          <div className="form-section">
            <div className="form-section-header">What</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Lemma field</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" name="lemma_field_seqq" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} /> DMF</label>
                  <label className="radio-label"><input type="radio" name="lemma_field_seqq" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} /> Source (TL)</label>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — Where & When */}
          <div className="form-section">
            <div className="form-section-header">Where &amp; When</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Domain</label>
                <input value={options.domain} onChange={(e) => setOptions({ ...options, domain: e.target.value })} placeholder="e.g. fiction" />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <input value={options.genre} onChange={(e) => setOptions({ ...options, genre: e.target.value })} placeholder="e.g. romance" />
              </div>
              <div className="form-group">
                <label>Period from</label>
                <input type="number" value={options.period_start} onChange={(e) => setOptions({ ...options, period_start: e.target.value })} placeholder="e.g. 1100" />
              </div>
              <div className="form-group">
                <label>Period to</label>
                <input type="number" value={options.period_end} onChange={(e) => setOptions({ ...options, period_end: e.target.value })} placeholder="e.g. 1200" />
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
                    <select value={options.text_id} onChange={(e) => setOptions({ ...options, text_id: e.target.value })}>
                      <option value="">All texts</option>
                      {texts.map((t) => <option key={t.text_id} value={t.text_id}>{t.title || t.filename}</option>)}
                    </select>
                  </div>
                )}
                {subcorpora.length > 0 && (
                  <div className="form-group">
                    <label>Within subcorpus</label>
                    <select value={options.subcorpus_id} onChange={(e) => setOptions({ ...options, subcorpus_id: e.target.value })}>
                      <option value="">Entire corpus</option>
                      {subcorpora.map((s) => <option key={s.subcorpus_id} value={s.subcorpus_id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {datasets.length > 0 && (
                  <div className="form-group">
                    <label>Within dataset</label>
                    <select value={options.dataset_id} onChange={(e) => setOptions({ ...options, dataset_id: e.target.value })}>
                      <option value="">Entire corpus</option>
                      {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4 — Examples */}
          <div className="form-section">
            <div className="form-section-header">Examples</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Context before</label>
                <input type="number" value={options.context_before} onChange={(e) => setOptions({ ...options, context_before: e.target.value })} min={0} max={50} />
              </div>
              <div className="form-group">
                <label>Context after</label>
                <input type="number" value={options.context_after} onChange={(e) => setOptions({ ...options, context_after: e.target.value })} min={0} max={50} />
              </div>
              <div className="form-group">
                <label>Results per page</label>
                <select value={options.limit} onChange={(e) => setOptions({ ...options, limit: e.target.value })}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Searching..." : "Search Sequence"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}
      <ResultsDisplay results={results} form={options} goToPage={goToPage} onExport={results ? handleExport : undefined} />
    </>
  );
}

/* ==== MAIN PAGE WITH TABS ==== */
export default function QueryPage() {
  const [searchParams] = useSearchParams();
  const initialDatasetId = searchParams.get("dataset_id") || "";
  const initialState = {
    lemma:        searchParams.get("lemma")        || "",
    form:         searchParams.get("form")         || "",
    pos:          searchParams.get("pos")          || "",
    domain:       searchParams.get("domain")       || "",
    genre:        searchParams.get("genre")        || "",
    period_start: searchParams.get("period_start") || "",
    period_end:   searchParams.get("period_end")   || "",
    subcorpus_id: searchParams.get("subcorpus_id") || "",
    dataset_id:   initialDatasetId,
    autosubmit:   searchParams.get("autosubmit")   === "1",
  };
  const [tab, setTab] = useState("simple");
  const [datasets, setDatasets] = useState([]);
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);

  useEffect(() => {
    fetchDatasets()
      .then((data) => setDatasets(data.datasets))
      .catch(() => {});
    fetchSubcorpora()
      .then((data) => setSubcorpora(data.subcorpora))
      .catch(() => {});
    fetchTexts()
      .then((data) => setTexts(data.texts))
      .catch(() => {});
  }, []);

  const activeDataset = initialDatasetId
    ? datasets.find((d) => String(d.dataset_id) === initialDatasetId)
    : null;

  let datasetParams = {};
  if (activeDataset?.query_params) {
    try {
      datasetParams = typeof activeDataset.query_params === "string"
        ? JSON.parse(activeDataset.query_params)
        : activeDataset.query_params;
    } catch {}
  }

  return (
    <div className="page">
      <h2>Query Corpus</h2>
      {activeDataset && (
        <div className="dataset-banner card">
          <strong>Searching within dataset: {activeDataset.name}</strong>
          <span className="dataset-banner-count">({activeDataset.token_count?.toLocaleString()} tokens)</span>
          <div className="dataset-banner-info">
            This dataset only contains tokens matching:
            {Object.entries(datasetParams)
              .filter(([k]) => !["context_before", "context_after"].includes(k))
              .map(([k, v]) => (
                <span key={k} className="filter-tag">{k}: {v}</span>
              ))}
          </div>
          <div className="dataset-banner-info">
            Queries here search <em>within</em> those tokens only.
          </div>
        </div>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "simple" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("simple")}
        >
          Simple Query
        </button>
        <button
          className={`tab-btn ${tab === "sequence" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("sequence")}
        >
          Sequence Query
        </button>
      </div>

      {tab === "simple" ? (
        <SimpleQuery datasets={datasets} subcorpora={subcorpora} texts={texts} initialDatasetId={initialDatasetId} initialState={initialState} />
      ) : (
        <SequenceQuery datasets={datasets} subcorpora={subcorpora} texts={texts} initialDatasetId={initialDatasetId} />
      )}
    </div>
  );
}
