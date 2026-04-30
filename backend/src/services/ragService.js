const OpenAI = require("openai");
const knowledge = require("../data/testingKnowledge.json");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory vector store — embedded once at startup
let embeddedKnowledge = null;

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function initRAG() {
  if (embeddedKnowledge) return;

  console.log("[RAG] Initializing knowledge base embeddings...");

  const texts = knowledge.map(k =>
    `${k.pattern}: ${k.description}. Test strategies: ${k.test_strategies.join(". ")}`
  );

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });

  embeddedKnowledge = knowledge.map((k, i) => ({
    ...k,
    embedding: response.data[i].embedding
  }));

  console.log(`[RAG] Loaded ${embeddedKnowledge.length} knowledge entries`);
}

async function retrieveTestPatterns(requirementText, topK = 3) {
  if (!embeddedKnowledge) await initRAG();

  const embRes = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: [requirementText]
  });

  const reqEmbedding = embRes.data[0].embedding;

  return embeddedKnowledge
    .map(k => ({ ...k, score: cosineSimilarity(reqEmbedding, k.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Batch retrieval — runs all embeddings in one API call for efficiency
async function retrieveTestPatternsBatch(requirements, topK = 2) {
  if (!embeddedKnowledge) await initRAG();

  const texts = requirements.map(r => r.text);

  const embRes = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });

  return requirements.map((_, i) => {
    const reqEmbedding = embRes.data[i].embedding;
    return embeddedKnowledge
      .map(k => ({ ...k, score: cosineSimilarity(reqEmbedding, k.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  });
}

module.exports = { initRAG, retrieveTestPatterns, retrieveTestPatternsBatch };
