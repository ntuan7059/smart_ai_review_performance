import React, { useState } from "react";
import { adminApi } from "../adminApi.js";

export default function AuthorMappingEditor({ mappings, onChange }) {
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  function draftFor(row) {
    return drafts[row.key] ?? row.email ?? "";
  }

  async function handleSave(row) {
    const email = draftFor(row).trim();
    setSavingKey(row.key);
    try {
      await adminApi.setAuthorEmail(row.key, email);
      onChange();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <details className="mapping-editor">
      <summary>Author → email mapping ({mappings.filter((m) => m.email).length}/{mappings.length} mapped)</summary>
      <p className="muted small">
        Usage is attributed to whichever email is mapped to each Bitbucket author. Unmapped authors' actions show up
        as "unmapped" in the charts above.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Author</th>
            <th>Bitbucket username</th>
            <th>Email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((row) => (
            <tr key={row.key}>
              <td>{row.author}</td>
              <td>{row.authorUsername}</td>
              <td>
                <input
                  className="mapping-row-input"
                  type="email"
                  placeholder="name@company.com"
                  value={draftFor(row)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                />
              </td>
              <td>
                <button type="button" disabled={savingKey === row.key} onClick={() => handleSave(row)}>
                  {savingKey === row.key ? "Saving…" : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
