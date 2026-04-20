function cleanText(text) {
  return text
    .replace(/\r\n/g, "\n")         // normalize line breaks
    .replace(/\n+/g, "\n")         // remove extra newlines
    .replace(/\s+/g, " ")          // collapse multiple spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2") // fix merged words
    .trim();
}

module.exports = { cleanText };

function chunkText(text, chunkSize = 500) {
  const words = text.split(" ");
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  return chunks;
}

module.exports = { cleanText, chunkText };

function smartChunk(text) {
  // Split based on numbered sections like 1., 2., 3.
  const sections = text.split(/\n?\d+\.\s+/);

  return sections.filter(section => section.trim().length > 50);
}

module.exports = { cleanText, chunkText, smartChunk };