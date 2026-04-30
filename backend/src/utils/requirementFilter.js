function isValidRequirement(text) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase().trim();

  if (t.length < 15) return false;

  // Reject lines that are clearly not requirements
  const noise = [
    "table of contents", "figure ", "appendix", "glossary",
    "document version", "revision history", "page ", "chapter ",
    "introduction", "purpose of this document", "scope of this document",
    "references", "definitions", "abbreviations"
  ];
  if (noise.some(n => t.startsWith(n))) return false;

  // Accept if it contains any behavioral or constraint signal
  // Covers: web apps, embedded systems, IoT, ERP, healthcare, hardware, AI systems
  const signals = [
    // Modal verbs (universal)
    "must", "shall", "should", "will", "may",
    // Action verbs (functional behavior)
    "allow", "enable", "provide", "support", "handle",
    "process", "generate", "send", "receive", "store",
    "display", "detect", "monitor", "control", "manage",
    "validate", "authenticate", "authorize", "calculate",
    "notify", "trigger", "respond", "enforce", "maintain",
    "ensure", "perform", "execute", "integrate", "import",
    "export", "access", "update", "create", "delete",
    // Constraint signals (non-functional)
    "capable of", "able to", "within", "less than", "more than",
    "at least", "minimum", "maximum", "no more than", "up to",
    "compliant", "compatible", "secure", "encrypted", "fault",
    "recover", "backup", "availability", "latency", "throughput"
  ];

  return signals.some(w => t.includes(w));
}

module.exports = { isValidRequirement };
