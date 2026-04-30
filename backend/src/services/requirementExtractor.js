const SKIP_PATTERNS = [
  "introduction", "objective", "team", "purpose",
  "student id", "date:", "version:", "lab worksheet",
  "amrita", "prepared by", "approved by", "table of content"
];

const FUNCTIONAL_KEYWORDS = [
  "shall", "must", "should", "allows", "enables",
  "will", "provide", "support", "can", "permit"
];

const NON_FUNCTIONAL_KEYWORDS = [
  "performance", "security", "reliability", "scalability",
  "response time", "availability", "compatible", "usability",
  "maintainability", "fast", "secure", "stable", "accessible"
];


function extractRequirements(chunks) {
  const requirements = [];
  const seen = new Set();

  chunks.forEach((chunk) => {
    const sentences = chunk.split(/(?<=\.)\s+/);

    sentences.forEach((sentence) => {
      const clean = sentence.trim();
      if (clean.length < 50) return;

      const lower = clean.toLowerCase();

      // Skip document metadata and intro sections
      if (SKIP_PATTERNS.some(pattern => lower.includes(pattern))) return;

      const isFunctional = FUNCTIONAL_KEYWORDS.some(kw => lower.includes(kw));
      const isNonFunctional = NON_FUNCTIONAL_KEYWORDS.some(kw => lower.includes(kw));

      if (isFunctional || isNonFunctional) {
        const normalized = lower.replace(/\s+/g, " ").trim();

        if (!seen.has(normalized)) {
          seen.add(normalized);
          requirements.push({
            id: `REQ_${requirements.length + 1}`,
            text: clean,
            type: isNonFunctional && !isFunctional ? "non-functional" : "functional"
          });
        }
      }
    });
  });

  return requirements;
}

module.exports = { extractRequirements };
