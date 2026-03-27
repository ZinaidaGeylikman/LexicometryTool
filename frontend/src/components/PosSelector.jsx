import { useState, useEffect } from "react";
import { fetchPosIndex } from "../api/client";

// Module-level cache so all instances share one fetch
let _cache = null;
let _pending = null;

function getPosTags() {
  if (_cache) return Promise.resolve(_cache);
  if (_pending) return _pending;
  _pending = fetchPosIndex({})
    .then((data) => {
      _cache = data.entries.map((e) => e.pos).sort();
      _pending = null;
      return _cache;
    })
    .catch(() => {
      _pending = null;
      return [];
    });
  return _pending;
}

/**
 * PosSelector — standard dropdown of POS tags.
 * value: single POS string (e.g. "NOUN")
 * onChange(newValue): called with selected POS string
 */
export default function PosSelector({ label, value, onChange }) {
  const [tags, setTags] = useState(_cache || []);

  useEffect(() => {
    if (_cache) { setTags(_cache); return; }
    getPosTags().then(setTags);
  }, []);

  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value=""></option>
        {tags.map((pos) => (
          <option key={pos} value={pos}>{pos}</option>
        ))}
      </select>
    </div>
  );
}
