import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { AtlassianApiError } from "../lib/httpClient.js";

const DEFAULT_MODELS = {
  claude: "claude-opus-5",
  codex: "gpt-5-codex",
};

const CURSOR_BASE_URL = "https://api.cursor.com";
const CURSOR_POLL_INTERVAL_MS = 3000;
const CURSOR_CREATE_TIMEOUT_MS = 150000; // provisioning a cloud agent can be slow to even acknowledge
const CURSOR_POLL_REQUEST_TIMEOUT_MS = 20000; // a single status check should be quick
const CURSOR_MAX_CONSECUTIVE_POLL_FAILURES = 5;
const CURSOR_OVERALL_TIMEOUT_MS = 300000; // hard ceiling on the whole create+poll operation

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askClaude({ apiKey, model, system, prompt, useClaudeSubscription }) {
  // With no apiKey, the SDK falls back to ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an
  // `ant auth login` OAuth profile on this machine — i.e. a logged-in Claude Pro/Max seat,
  // billed as subscription usage instead of metered API tokens.
  const client = useClaudeSubscription ? new Anthropic() : new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model || DEFAULT_MODELS.claude,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function askCodex({ apiKey, model, system, prompt }) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: model || DEFAULT_MODELS.codex,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60000 }
  );
  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new AtlassianApiError("Codex returned an empty response.", 502, "AI_EMPTY_RESPONSE");
  return content;
}

async function askCursor({ apiKey, model, system, prompt }) {
  const client = axios.create({
    baseURL: CURSOR_BASE_URL,
    auth: { username: apiKey, password: "" },
  });
  const overallDeadline = Date.now() + CURSOR_OVERALL_TIMEOUT_MS;

  // Provisioning a cloud agent (even a no-repo one) can take a while to even
  // acknowledge the request, especially with a large evidence-packed prompt —
  // give this one call most of the budget rather than the same short timeout as
  // a simple status poll.
  const createRes = await client.post(
    "/v1/agents",
    { prompt: { text: `${system}\n\n${prompt}` }, ...(model ? { model } : {}) },
    { timeout: CURSOR_CREATE_TIMEOUT_MS }
  );

  const agentId = createRes.data?.agent?.id;
  const runId = createRes.data?.run?.id;
  if (!agentId || !runId) {
    throw new AtlassianApiError("Cursor did not return an agent/run id.", 502, "AI_BAD_RESPONSE");
  }

  let consecutiveFailures = 0;
  while (Date.now() < overallDeadline) {
    let runRes;
    try {
      runRes = await client.get(`/v1/agents/${agentId}/runs/${runId}`, {
        timeout: CURSOR_POLL_REQUEST_TIMEOUT_MS,
      });
      consecutiveFailures = 0;
    } catch (err) {
      // A single slow/flaky status check shouldn't abort an otherwise-healthy agent
      // run — retry until either it recovers or too many polls fail in a row.
      consecutiveFailures += 1;
      if (consecutiveFailures >= CURSOR_MAX_CONSECUTIVE_POLL_FAILURES) throw err;
      await sleep(CURSOR_POLL_INTERVAL_MS);
      continue;
    }

    const status = runRes.data?.status;
    if (status === "FINISHED") return runRes.data?.result || "";
    if (status === "ERROR" || status === "CANCELLED" || status === "EXPIRED") {
      throw new AtlassianApiError(`Cursor agent run ended with status ${status}.`, 502, "AI_RUN_FAILED");
    }
    await sleep(CURSOR_POLL_INTERVAL_MS);
  }
  throw new AtlassianApiError("Cursor agent run timed out.", 504, "AI_TIMEOUT");
}

const PROVIDERS = { claude: askClaude, codex: askCodex, cursor: askCursor };

export async function askAi({ provider, apiKey, model, system, prompt, useClaudeSubscription }) {
  const handler = PROVIDERS[provider];
  if (!handler) {
    throw new AtlassianApiError(
      `Unsupported AI provider "${provider}". Choose claude, codex, or cursor.`,
      400,
      "AI_UNSUPPORTED_PROVIDER"
    );
  }
  const needsApiKey = !(provider === "claude" && useClaudeSubscription);
  if (needsApiKey && !apiKey) {
    throw new AtlassianApiError("AI agent is not configured. Fill in Settings first.", 400, "AI_NOT_CONFIGURED");
  }

  try {
    return await handler({ apiKey, model, system, prompt, useClaudeSubscription });
  } catch (err) {
    if (err instanceof AtlassianApiError) throw err;
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    throw new AtlassianApiError(`${provider} request failed: ${message}`, status || 502, "AI_PROVIDER_ERROR");
  }
}
