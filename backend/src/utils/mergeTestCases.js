// Merge AI + rule-based test cases
function normalizeTitle(t = "") {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function mergeTestCases(aiCases, ruleCases, max = 7) {
  const merged = [];
  const seen = new Set();

  // helper to push if not duplicate
  const pushUnique = (tc) => {
    if (!tc || !tc.title) return;
    const key = normalizeTitle(tc.title);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(tc);
    }
  };

  // 1) Prefer AI first (richer/edge cases)
  if (Array.isArray(aiCases)) {
    aiCases.forEach(pushUnique);
  }

  // 2) Ensure baseline coverage from rules
  if (Array.isArray(ruleCases)) {
    ruleCases.forEach(pushUnique);
  }

  // 3) Trim to max count
  return merged.slice(0, max);
}

module.exports = { mergeTestCases };