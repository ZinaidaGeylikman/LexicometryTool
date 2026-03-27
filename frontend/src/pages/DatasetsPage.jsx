import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDatasets, createDataset, deleteDataset } from "../api/client";

export default function DatasetsPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    lemma: "",
    pos: "",
    domain: "",
    genre: "",
    context_before: "5",
    context_after: "5",
  });

  const load = () => {
    setLoading(true);
    fetchDatasets()
      .then((data) => setDatasets(data.datasets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    const query_params = {};
    if (createForm.lemma) query_params.lemma = createForm.lemma;
    if (createForm.pos) query_params.pos = createForm.pos;
    if (createForm.domain) query_params.domain = createForm.domain;
    if (createForm.genre) query_params.genre = createForm.genre;
    query_params.context_before = parseInt(createForm.context_before) || 5;
    query_params.context_after = parseInt(createForm.context_after) || 5;

    try {
      await createDataset({
        name: createForm.name,
        description: createForm.description || undefined,
        query_params,
      });
      setShowCreate(false);
      setCreateForm({ name: "", description: "", lemma: "", pos: "", domain: "", genre: "", context_before: "5", context_after: "5" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete dataset "${name}"?`)) return;
    try {
      await deleteDataset(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleQueryWithin = (datasetId) => {
    navigate(`/query?dataset_id=${datasetId}`);
  };

  if (loading) return <div className="loading">Loading datasets...</div>;

  return (
    <div className="page">
      <h2>Datasets</h2>

      <div className="card">
        <p className="form-help" style={{ marginBottom: "0.75rem" }}>
          A dataset is a sub-corpus created from query results. Once created, you can search <em>within</em> it
          to refine your analysis.
        </p>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "Create Dataset"}
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} className="create-form">
            <div className="form-sections">
              {/* Name & description */}
              <div className="form-section">
                <div className="form-section-header">Dataset</div>
                <div className="form-section-fields">
                  <div className="form-group">
                    <label>Name</label>
                    <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required placeholder='e.g. "NOUN in fiction"' />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Optional note" />
                  </div>
                </div>
              </div>

              {/* Row 1 — What */}
              <div className="form-section">
                <div className="form-section-header">What</div>
                <div className="form-section-fields">
                  <div className="form-group">
                    <label>Lemma filter</label>
                    <input value={createForm.lemma} onChange={(e) => setCreateForm({ ...createForm, lemma: e.target.value })} placeholder="e.g. roi/comte" />
                    <small>Separate alternatives with /</small>
                  </div>
                  <div className="form-group">
                    <label>POS filter</label>
                    <input value={createForm.pos} onChange={(e) => setCreateForm({ ...createForm, pos: e.target.value })} placeholder="e.g. NOUN" />
                  </div>
                </div>
              </div>

              {/* Row 2 — Where & When */}
              <div className="form-section">
                <div className="form-section-header">Where &amp; When</div>
                <div className="form-section-fields">
                  <div className="form-group">
                    <label>Domain</label>
                    <input value={createForm.domain} onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })} placeholder="e.g. fiction" />
                  </div>
                  <div className="form-group">
                    <label>Genre</label>
                    <input value={createForm.genre} onChange={(e) => setCreateForm({ ...createForm, genre: e.target.value })} placeholder="e.g. romance" />
                  </div>
                </div>
              </div>

              {/* Row 3 — Examples */}
              <div className="form-section">
                <div className="form-section-header">Examples</div>
                <div className="form-section-fields">
                  <div className="form-group">
                    <label>Words before pivot</label>
                    <input type="number" min={0} max={50} value={createForm.context_before} onChange={(e) => setCreateForm({ ...createForm, context_before: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Words after pivot</label>
                    <input type="number" min={0} max={50} value={createForm.context_after} onChange={(e) => setCreateForm({ ...createForm, context_after: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        )}
      </div>

      {error && <div className="error-box">Error: {error}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Description</th>
            <th>Tokens</th>
            <th>Filters used</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d) => {
            let params = {};
            try { params = typeof d.query_params === "string" ? JSON.parse(d.query_params) : (d.query_params || {}); } catch {}
            return (
              <tr key={d.dataset_id}>
                <td>{d.dataset_id}</td>
                <td><strong>{d.name}</strong></td>
                <td>{d.description || "-"}</td>
                <td>{d.token_count?.toLocaleString()}</td>
                <td className="cell-query">
                  {Object.entries(params).map(([k, v]) => (
                    <span key={k} className="filter-tag">{k}: {v}</span>
                  ))}
                </td>
                <td className="actions-cell">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleQueryWithin(d.dataset_id)}
                  >
                    Search within
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(d.dataset_id, d.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {datasets.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                No datasets yet. Create one from query parameters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
