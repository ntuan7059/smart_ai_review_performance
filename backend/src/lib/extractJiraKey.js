const JIRA_KEY_RE = /([A-Za-z][A-Za-z0-9]+-\d+)/g;

function findKeys(text) {
  if (!text) return [];
  const matches = text.match(JIRA_KEY_RE) || [];
  return matches.map((k) => k.toUpperCase());
}

function dedupe(arr) {
  return [...new Set(arr)];
}

/**
 * Extracts a Jira issue key (e.g. PROJ-123) from a branch name and/or PR title.
 * Branch name is checked first and preferred; falls back to the title.
 *
 * @param {string|null|undefined} branchName
 * @param {string|null|undefined} title
 * @returns {{ key: string|null, allKeys: string[], multiple: boolean, source: 'branch'|'title'|null }}
 */
export function extractJiraKey(branchName, title) {
  const branchKeys = dedupe(findKeys(branchName));
  const titleKeys = dedupe(findKeys(title));

  if (branchKeys.length > 0) {
    return {
      key: branchKeys[0],
      allKeys: branchKeys,
      multiple: branchKeys.length > 1,
      source: "branch",
    };
  }

  if (titleKeys.length > 0) {
    return {
      key: titleKeys[0],
      allKeys: titleKeys,
      multiple: titleKeys.length > 1,
      source: "title",
    };
  }

  return { key: null, allKeys: [], multiple: false, source: null };
}

/**
 * Backwards-compatible single-string convenience wrapper matching the
 * original spec signature: extractJiraKey(text) -> string | null.
 * Prefer the two-argument form above when both a branch and a title exist.
 */
export function extractJiraKeyFromText(text) {
  const keys = dedupe(findKeys(text));
  return keys.length > 0 ? keys[0] : null;
}
