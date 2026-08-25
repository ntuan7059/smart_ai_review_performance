const SECRET_KEYS = new Set([
  "atlassianApiToken",
  "bitbucketApiToken",
  "aiApiKey",
  "authorization",
  "Authorization",
]);

function redact(value) {
  if (value && typeof value === "object") {
    const clone = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value)) {
      clone[k] = SECRET_KEYS.has(k) ? "***redacted***" : redact(v);
    }
    return clone;
  }
  return value;
}

export function log(...args) {
  console.log(new Date().toISOString(), "-", ...args.map(redact));
}

export function logError(...args) {
  console.error(new Date().toISOString(), "-", ...args.map(redact));
}
