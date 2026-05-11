import { useState, useEffect, useRef } from "react";
import PosSelector from "../components/PosSelector";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie,
} from "recharts";

const BAR_COLORS = [
  "#4a6fa5", "#c17f59", "#5a9a6f", "#9b6ba5",
  "#d4a843", "#6b9ec5", "#c06b6b", "#7a9e7e",
];
import {
  frequencyByGenre, frequencyByDomain, frequencyByPeriod,
  seqFrequencyByGenre, seqFrequencyByDomain, seqFrequencyByPeriod,
  fetchSubcorpora, fetchTexts, fetchDatasets,
} from "../api/client";

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {name}
    </text>
  );
}

/* ---- Shared chart + table display ---- */
function FrequencyResults({ data, view, normalize, perN, filterLabel }) {
  const containerRef = useRef(null);
  const [chartType, setChartType] = useState("bar");

  if (!data) return null;

  const yLabel = normalize ? `per ${Number(perN || 10000).toLocaleString()} words` : "count";
  const colHeader = view === "period" ? "Period" : view.charAt(0).toUpperCase() + view.slice(1);
  const chartTitle = `Frequency of ${filterLabel || "(all)"} by ${view} (${yLabel})`;
  const isPie = chartType === "pie" && view !== "period";

  if (data.length === 0) {
    return <div className="card">No data found for the given filters.</div>;
  }

  const handleExportCsv = () => {
    const header = [colHeader, normalize ? "Relative freq." : "Count"];
    const rows = data.map((d) => [d.name, d.value]);
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `frequency_${view}.csv`;
    a.click();
  };

  const handleExportPng = async () => {
    const container = containerRef.current;
    if (!container) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `frequency_${view}_${chartType}.png`;
      a.click();
    });
  };

  // Pie data needs a fill per slice
  const pieData = data.map((d, i) => ({ ...d, fill: BAR_COLORS[i % BAR_COLORS.length] }));

  return (
    <div className="card chart-container">
      <div ref={containerRef}>
        <h3>{chartTitle}</h3>
        {view !== "period" && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <button
              className={`btn btn-sm${chartType === "bar" ? " btn-primary" : ""}`}
              onClick={() => setChartType("bar")}
            >Bar</button>
            <button
              className={`btn btn-sm${chartType === "pie" ? " btn-primary" : ""}`}
              onClick={() => setChartType("pie")}
            >Pie</button>
          </div>
        )}
        <ResponsiveContainer width="100%" height={400}>
          {view === "period" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" name={yLabel} stroke="#4a6fa5" strokeWidth={2} />
            </LineChart>
          ) : isPie ? (
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={160}
                labelLine={false}
                label={PieLabel}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, yLabel]} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name={yLabel} fill="#4a6fa5">
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", margin: "0.75rem 0" }}>
        <button className="btn btn-sm" onClick={handleExportCsv}>Export CSV</button>
        <button className="btn btn-sm" onClick={handleExportPng}>Export PNG</button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>{colHeader}</th>
            <th>{normalize ? "Relative freq." : "Count"}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Shared view/normalize options ---- */
function ViewOptions({ view, setView, normalize, setNormalize, perN, setPerN, dateSource, setDateSource, lemmaField, setLemmaField }) {
  return (
    <>
      <div className="form-group">
        <label>View</label>
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="genre">By Genre</option>
          <option value="domain">By Domain</option>
          <option value="period">By Period</option>
        </select>
      </div>
      {lemmaField !== null && (
        <div className="form-group">
          <label>Lemma field</label>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" name="lemma_field_freq" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} />{" "}
              DMF
            </label>
            <label className="radio-label">
              <input type="radio" name="lemma_field_freq" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} />{" "}
              Source (TL)
            </label>
          </div>
        </div>
      )}
      {view === "period" && (
        <div className="form-group">
          <label>Date source</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="date_source"
                value="composition"
                checked={dateSource === "composition"}
                onChange={() => setDateSource("composition")}
              />{" "}
              Composition
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="date_source"
                value="manuscript"
                checked={dateSource === "manuscript"}
                onChange={() => setDateSource("manuscript")}
              />{" "}
              Manuscript
            </label>
          </div>
        </div>
      )}
      {view !== "period" && (
        <>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
              />{" "}
              Normalize
            </label>
          </div>
          {normalize && (
            <div className="form-group">
              <label>Per N words</label>
              <input
                type="number"
                value={perN}
                onChange={(e) => setPerN(e.target.value)}
                min={1}
                step={1}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ==== SIMPLE FREQUENCY TAB ==== */
function SimpleFrequency({ subcorpora, texts, datasets }) {
  const [form, setForm] = useState({
    lemma: "", pos: "", not_lemma: "", not_pos: "", form: "", not_form: "",
    period_start: "", period_end: "", subcorpus_id: "", text_id: "", dataset_id: "",
  });
  const [normalize, setNormalize] = useState(false);
  const [perN, setPerN] = useState("10000");
  const [view, setView] = useState("genre");
  const [dateSource, setDateSource] = useState("composition");
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const changeView = (newView) => {
    setView(newView);
    setData(null); // clear stale chart when switching view
  };

  const buildParams = () => {
    const params = {};
    if (form.lemma) params.lemma = form.lemma;
    if (form.pos) params.pos = form.pos;
    if (form.not_lemma) params.not_lemma = form.not_lemma;
    if (form.not_pos) params.not_pos = form.not_pos;
    if (form.form) params.form = form.form;
    if (form.not_form) params.not_form = form.not_form;
    if (form.period_start) params.period_start = parseInt(form.period_start);
    if (form.period_end) params.period_end = parseInt(form.period_end);
    if (form.subcorpus_id) params.subcorpus_id = parseInt(form.subcorpus_id);
    if (form.text_id) params.text_id = parseInt(form.text_id);
    if (form.dataset_id) params.dataset_id = parseInt(form.dataset_id);
    params.lemma_field = lemmaField;
    return params;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;
      const params = buildParams();
      if (view === "genre") {
        result = await frequencyByGenre({ ...params, normalize, per_n_words: parseInt(perN) || 10000 });
      } else if (view === "domain") {
        result = await frequencyByDomain({ ...params, normalize, per_n_words: parseInt(perN) || 10000 });
      } else {
        result = await frequencyByPeriod({ ...params, bin_size: 50, date_source: dateSource });
      }

      const chartData = Object.entries(result.data).map(([key, val]) => ({ name: key, value: val }));
      if (view === "period") chartData.sort((a, b) => parseInt(a.name) - parseInt(b.name));
      setData(chartData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filterLabel = [
    form.lemma && `lemma="${form.lemma}"`,
    form.pos && `POS=${form.pos}`,
    form.not_lemma && `excl. lemma="${form.not_lemma}"`,
    form.not_pos && `excl. POS=${form.not_pos}`,
  ].filter(Boolean).join(", ");

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
                  ? <input name="lemma" value={form.lemma} onChange={handleChange} placeholder="e.g. roi/comte" />
                  : <input name="form" value={form.form} onChange={handleChange} placeholder="e.g. roy/rei" />
                }
                <small>Separate alternatives with /</small>
              </div>
              <div className="form-group">
                <label>Lemma field</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" name="lemma_field_freq" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} /> DMF</label>
                  <label className="radio-label"><input type="radio" name="lemma_field_freq" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} /> Source (TL)</label>
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
                <input name="domain" value={form.domain ?? ""} onChange={handleChange} placeholder="e.g. fiction" />
              </div>
              <div className="form-group">
                <label>Genre</label>
                <input name="genre" value={form.genre ?? ""} onChange={handleChange} placeholder="e.g. romance" />
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

          {/* Row 4 — Display */}
          <div className="form-section">
            <div className="form-section-header">Display</div>
            <div className="form-section-fields">
              <ViewOptions view={view} setView={changeView} normalize={normalize} setNormalize={setNormalize} perN={perN} setPerN={setPerN} dateSource={dateSource} setDateSource={setDateSource} lemmaField={null} setLemmaField={null} />
            </div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Loading..." : "Analyze"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}
      <FrequencyResults data={data} view={view} normalize={normalize} perN={perN} filterLabel={filterLabel} />
    </>
  );
}

/* ==== SEQUENCE FREQUENCY TAB ==== */
const EMPTY_SLOT = { lemma: "", pos: "", not_lemma: "", not_pos: "", form: "", not_form: "" };

function SequenceFrequency({ subcorpora, texts, datasets }) {
  const [slots, setSlots] = useState([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }]);
  const [subcorpus_id, setSubcorpusId] = useState("");
  const [textId, setTextId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [normalize, setNormalize] = useState(false);
  const [perN, setPerN] = useState("10000");
  const [view, setView] = useState("genre");
  const [dateSource, setDateSource] = useState("composition");
  const [lemmaField, setLemmaField] = useState("dmf");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const changeView = (newView) => {
    setView(newView);
    setData(null);
  };

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

  const buildPattern = () => {
    return slots.map((s) => {
      const item = {};
      if (s.lemma) item.lemma = s.lemma;
      if (s.pos) item.pos = s.pos;
      if (s.not_lemma) item.not_lemma = s.not_lemma;
      if (s.not_pos) item.not_pos = s.not_pos;
      if (s.form) item.form = s.form;
      if (s.not_form) item.not_form = s.not_form;
      return item;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;
      const pattern = buildPattern();
      const scId = subcorpus_id ? parseInt(subcorpus_id) : undefined;
      const tId = textId ? parseInt(textId) : undefined;
      const dId = datasetId ? parseInt(datasetId) : undefined;
      const pStart = periodStart ? parseInt(periodStart) : undefined;
      const pEnd = periodEnd ? parseInt(periodEnd) : undefined;
      if (view === "genre") {
        result = await seqFrequencyByGenre({ pattern, normalize, per_n_words: parseInt(perN) || 10000, subcorpus_id: scId, text_id: tId, dataset_id: dId, period_start: pStart, period_end: pEnd, lemma_field: lemmaField });
      } else if (view === "domain") {
        result = await seqFrequencyByDomain({ pattern, normalize, per_n_words: parseInt(perN) || 10000, subcorpus_id: scId, text_id: tId, dataset_id: dId, period_start: pStart, period_end: pEnd, lemma_field: lemmaField });
      } else {
        result = await seqFrequencyByPeriod({ pattern, bin_size: 50, subcorpus_id: scId, text_id: tId, dataset_id: dId, period_start: pStart, period_end: pEnd, date_source: dateSource, lemma_field: lemmaField });
      }

      const chartData = Object.entries(result.data).map(([key, val]) => ({ name: key, value: val }));
      if (view === "period") chartData.sort((a, b) => parseInt(a.name) - parseInt(b.name));
      setData(chartData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filterLabel = slots.map((s, i) => {
    const parts = [
      s.lemma && `"${s.lemma}"`,
      s.pos && s.pos,
    ].filter(Boolean).join("/");
    return parts || `pos${i + 1}`;
  }).join(" + ");

  return (
    <>
      <form onSubmit={handleSubmit} className="query-form card">
        <p className="form-help">
          Define a sequence pattern to count. Each slot matches one token position.
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
          {/* Row 1 — What (lemma field only; per-slot fields are in the slots above) */}
          <div className="form-section">
            <div className="form-section-header">What</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Lemma field</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" name="lemma_field_seqfreq" value="dmf" checked={lemmaField === "dmf"} onChange={() => setLemmaField("dmf")} /> DMF</label>
                  <label className="radio-label"><input type="radio" name="lemma_field_seqfreq" value="source" checked={lemmaField === "source"} onChange={() => setLemmaField("source")} /> Source (TL)</label>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — Where & When */}
          <div className="form-section">
            <div className="form-section-header">Where &amp; When</div>
            <div className="form-section-fields">
              <div className="form-group">
                <label>Period from</label>
                <input type="number" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="e.g. 1100" />
              </div>
              <div className="form-group">
                <label>Period to</label>
                <input type="number" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="e.g. 1200" />
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
                    <select value={textId} onChange={(e) => setTextId(e.target.value)}>
                      <option value="">All texts</option>
                      {texts.map((t) => <option key={t.text_id} value={t.text_id}>{t.title || t.filename}</option>)}
                    </select>
                  </div>
                )}
                {subcorpora.length > 0 && (
                  <div className="form-group">
                    <label>Within subcorpus</label>
                    <select value={subcorpus_id} onChange={(e) => setSubcorpusId(e.target.value)}>
                      <option value="">Entire corpus</option>
                      {subcorpora.map((s) => <option key={s.subcorpus_id} value={s.subcorpus_id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {datasets.length > 0 && (
                  <div className="form-group">
                    <label>Within dataset</label>
                    <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                      <option value="">All contexts</option>
                      {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 4 — Display */}
          <div className="form-section">
            <div className="form-section-header">Display</div>
            <div className="form-section-fields">
              <ViewOptions view={view} setView={changeView} normalize={normalize} setNormalize={setNormalize} perN={perN} setPerN={setPerN} dateSource={dateSource} setDateSource={setDateSource} lemmaField={null} setLemmaField={null} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Loading..." : "Analyze Sequence"}
        </button>
      </form>

      {error && <div className="error-box">Error: {error}</div>}
      <FrequencyResults data={data} view={view} normalize={normalize} perN={perN} filterLabel={filterLabel} />
    </>
  );
}

/* ==== MAIN PAGE WITH TABS ==== */
export default function FrequencyPage() {
  const [tab, setTab] = useState("simple");
  const [subcorpora, setSubcorpora] = useState([]);
  const [texts, setTexts] = useState([]);
  const [datasets, setDatasets] = useState([]);

  useEffect(() => {
    fetchSubcorpora()
      .then((data) => setSubcorpora(data.subcorpora))
      .catch(() => {});
    fetchTexts()
      .then((data) => setTexts(data.texts))
      .catch(() => {});
    fetchDatasets()
      .then((data) => setDatasets(data.datasets))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <h2>Frequency Analysis</h2>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "simple" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("simple")}
        >
          Simple Frequency
        </button>
        <button
          className={`tab-btn ${tab === "sequence" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("sequence")}
        >
          Sequence Frequency
        </button>
      </div>

      {tab === "simple"
        ? <SimpleFrequency subcorpora={subcorpora} texts={texts} datasets={datasets} />
        : <SequenceFrequency subcorpora={subcorpora} texts={texts} datasets={datasets} />
      }
    </div>
  );
}
