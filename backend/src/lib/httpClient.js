import axios from "axios";
import { logError } from "./logger.js";

export class AtlassianApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = "AtlassianApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an axios instance pre-configured with Basic Auth and
 * exponential-backoff retry on 429 (and transient 5xx) responses.
 */
export function createAtlassianClient({ baseURL, email, token }) {
  const basicAuth = Buffer.from(`${email}:${token}`).toString("base64");

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    validateStatus: () => true, // handle status codes ourselves
  });

  async function requestWithRetry(config, attempt = 0) {
    const response = await client.request(config);

    const shouldRetry =
      (response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES;

    if (shouldRetry) {
      const retryAfterHeader = response.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : BASE_DELAY_MS * 2 ** attempt;
      logError(
        `Atlassian API ${response.status} on ${config.method?.toUpperCase()} ${config.url} — retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(retryAfterMs);
      return requestWithRetry(config, attempt + 1);
    }

    if (response.status >= 400) {
      throw new AtlassianApiError(
        `Atlassian API error ${response.status} on ${config.method?.toUpperCase()} ${config.url}`,
        response.status,
        response.status === 404 ? "NOT_FOUND" : response.status === 403 ? "FORBIDDEN" : "API_ERROR",
        response.data
      );
    }

    return response;
  }

  return {
    get: (url, config) => requestWithRetry({ ...config, method: "get", url }),
    post: (url, data, config) => requestWithRetry({ ...config, method: "post", url, data }),
  };
}
