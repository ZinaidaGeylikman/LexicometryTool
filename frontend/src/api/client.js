/**
 * API client for the Medieval French Corpus backend
 */
const API_BASE = "/api";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Stats ---
export function fetchStats() {
  return request("/stats");
}

// --- Texts ---
export function fetchTexts() {
  return request("/texts");
}

export function fetchText(id) {
  return request(`/texts/${id}`);
}

export function updateText(id, data) {
  return request(`/texts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteText(id) {
  return request(`/texts/${id}`, { method: "DELETE" });
}

export async function uploadText(file, metadata = {}) {
  const form = new FormData();
  form.append("file", file);
  if (metadata.title) form.append("title", metadata.title);
  if (metadata.domain) form.append("domain", metadata.domain);
  if (metadata.genre) form.append("genre", metadata.genre);
  if (metadata.period_start) form.append("period_start", metadata.period_start);
  if (metadata.period_end) form.append("period_end", metadata.period_end);

  const res = await fetch(`${API_BASE}/texts/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// --- Queries ---
export function queryCorpus(params) {
  return request("/query", { method: "POST", body: JSON.stringify(params) });
}

export function queryCount(params) {
  return request("/query/count", { method: "POST", body: JSON.stringify(params) });
}

export function querySequence(params) {
  return request("/query/sequence", { method: "POST", body: JSON.stringify(params) });
}

// --- Frequency ---
export function frequencyByGenre(params) {
  return request("/frequency/by-genre", { method: "POST", body: JSON.stringify(params) });
}

export function frequencyByDomain(params) {
  return request("/frequency/by-domain", { method: "POST", body: JSON.stringify(params) });
}

export function frequencyByPeriod(params) {
  return request("/frequency/by-period", { method: "POST", body: JSON.stringify(params) });
}

// --- Sequence Frequency ---
export function seqFrequencyByGenre(params) {
  return request("/frequency/sequence/by-genre", { method: "POST", body: JSON.stringify(params) });
}

export function seqFrequencyByDomain(params) {
  return request("/frequency/sequence/by-domain", { method: "POST", body: JSON.stringify(params) });
}

export function seqFrequencyByPeriod(params) {
  return request("/frequency/sequence/by-period", { method: "POST", body: JSON.stringify(params) });
}

// --- Datasets ---
export function fetchDatasets() {
  return request("/datasets");
}

export function createDataset(params) {
  return request("/datasets", { method: "POST", body: JSON.stringify(params) });
}

export function deleteDataset(id) {
  return request(`/datasets/${id}`, { method: "DELETE" });
}

// --- Admin ---
export function renormalizeLemmas() {
  return request("/admin/renormalize", { method: "POST" });
}

// --- Lemma Index ---
export function fetchLemmaIndex(params) {
  return request("/frequency/lemma-index", { method: "POST", body: JSON.stringify(params) });
}

// --- POS Index ---
export function fetchPosIndex(params) {
  return request("/frequency/pos-index", { method: "POST", body: JSON.stringify(params) });
}

// --- Subcorpora ---
export function fetchSubcorpora() {
  return request("/subcorpora");
}

export function createSubcorpus(params) {
  return request("/subcorpora", { method: "POST", body: JSON.stringify(params) });
}

export function updateSubcorpus(id, params) {
  return request(`/subcorpora/${id}`, { method: "PUT", body: JSON.stringify(params) });
}

export function deleteSubcorpus(id) {
  return request(`/subcorpora/${id}`, { method: "DELETE" });
}

export function fetchSubcorpusStats(id) {
  return request(`/subcorpora/${id}/stats`);
}
