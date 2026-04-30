const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could",
  "should","shall","may","might","must","can","need","to","of",
  "in","on","at","by","for","with","about","as","into","through",
  "and","or","but","if","then","that","this","it","its","their",
  "our","we","they","all","each","every","any","both","either"
]);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeyWords(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

// Jaccard similarity on meaningful words only
function jaccardSimilarity(a, b) {
  const setA = getKeyWords(a);
  const setB = getKeyWords(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function deduplicateRequirements(requirements, threshold = 0.35) {
  const unique = [];

  for (const r of requirements) {
    if (!r || !r.text) continue;

    const isDuplicate = unique.some(
      u => jaccardSimilarity(u.text, r.text) >= threshold
    );

    if (!isDuplicate) unique.push(r);
  }

  return unique;
}

module.exports = { deduplicateRequirements };
