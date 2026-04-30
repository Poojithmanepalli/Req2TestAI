function cleanText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function smartChunk(text) {
  return text
    .split(/\n{2,}/) // paragraph-based split
    .map(s => s.trim())
    .filter(s => s.length > 80); // stronger filtering
}

module.exports = { cleanText, smartChunk };