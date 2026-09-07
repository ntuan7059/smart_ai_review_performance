export function buildPrReviewPrompt({ evidence, prDiff }) {
  const system = [
    "You are a principal engineer scoring one pull request.",
    "Be brief and evidence-based. Never invent files, comments, ticket facts, or code that are not in the evidence or the attached PR diff.",
    "Use the unified PR diff as the primary evidence for code completeness. Cite file paths from that diff.",
    "Reply with a single JSON object only — no markdown fences, no commentary.",
  ].join(" ");

  const coverage = prDiff
    ? {
        source: prDiff.source,
        included: (prDiff.filesIncluded || []).map((f) => f.path),
        skipped: (prDiff.filesSkipped || []).slice(0, 30).map((f) => `${f.path} (${f.reason})`),
        truncated: Boolean(prDiff.truncated),
        includedBytes: prDiff.includedBytes || 0,
        error: prDiff.error || null,
      }
    : null;

  const hasDiff = Boolean(prDiff?.text?.trim());
  const diffSection = hasDiff
    ? `## PR diff coverage
${JSON.stringify(coverage, null, 2)}

Lockfiles, binaries, minified assets, and generated directories were omitted on purpose.
If truncated is true, judge only the remaining hunks and say so when completeness is uncertain.

## PR diff (Bitbucket, destination...source)
${prDiff.text}`
    : `## PR diff
No PR diff was attached${prDiff?.error ? ` (${prDiff.error})` : ""}. Score from metadata only and state that you did not read the code.`;

  const prompt = `Score this pull request.

## Evidence
${JSON.stringify(evidence, null, 2)}

${diffSection}

Return JSON with exactly these keys:
{
  "strengths": ["≤12 words", "…"],
  "weaknesses": ["≤12 words", "…"],
  "score": 1,
  "scoreRationale": "one short sentence",
  "ticketComplexity": "low" | "medium" | "high",
  "codeCompleteness": "incomplete" | "adequate" | "solid" | "excellent",
  "summary": "one sentence"
}

Scoring (integer or one decimal, 1–10) must weigh ticket complexity against what the PR delivered, and code completeness from the attached diff.
Keep it short: 2–3 strengths, 1–3 weaknesses, no restating the ticket. If there is no linked ticket, say so in scoreRationale and infer complexity from the diff.
JSON only.`;

  return { system, prompt };
}
