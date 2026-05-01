const OpenAI   = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");
const knowledge = require("../data/testingKnowledge.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc     = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const INDEX_NAME     = "testing-knowledge";
const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSION      = 1536;

let pineconeIndex = null;
let initialized   = false;

// ---------- INIT ----------
async function initRAG() {
  if (initialized) return;

  console.log("[RAG] Connecting to Pinecone...");

  // Create index if it doesn't exist yet
  const { indexes } = await pc.listIndexes();
  const exists = indexes?.some(i => i.name === INDEX_NAME);

  if (!exists) {
    console.log("[RAG] Creating Pinecone index...");
    await pc.createIndex({
      name:      INDEX_NAME,
      dimension: DIMENSION,
      metric:    "cosine",
      spec: {
        serverless: { cloud: "aws", region: "us-east-1" }
      }
    });

    // Wait until index is ready
    let ready = false;
    while (!ready) {
      const desc = await pc.describeIndex(INDEX_NAME);
      ready = desc.status?.ready;
      if (!ready) await new Promise(r => setTimeout(r, 1500));
    }
    console.log("[RAG] Pinecone index created and ready");
  }

  pineconeIndex = pc.index(INDEX_NAME);

  // Upsert knowledge base if not already stored
  const stats      = await pineconeIndex.describeIndexStats();
  const storedCount = stats.totalRecordCount ?? 0;

  if (storedCount < knowledge.length) {
    console.log(`[RAG] Upserting ${knowledge.length} entries to Pinecone...`);

    const texts = knowledge.map(k =>
      `${k.pattern}: ${k.description}. Test strategies: ${k.test_strategies.join(". ")}`
    );

    const embRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts
    });

    const vectors = knowledge.map((k, i) => ({
      id:     k.id,
      values: embRes.data[i].embedding,
      metadata: {
        category:       k.category,
        pattern:        k.pattern,
        description:    k.description,
        test_strategies: k.test_strategies.join(" | ")
      }
    }));

    // Upsert in batches of 100 (Pinecone limit)
    for (let i = 0; i < vectors.length; i += 100) {
      await pineconeIndex.upsert(vectors.slice(i, i + 100));
    }

    console.log(`[RAG] ${vectors.length} vectors stored in Pinecone`);
  } else {
    console.log(`[RAG] Pinecone ready — ${storedCount} vectors already stored`);
  }

  initialized = true;
}

// ---------- SINGLE RETRIEVE ----------
async function retrieveTestPatterns(requirementText, topK = 3) {
  if (!initialized) await initRAG();

  const embRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: [requirementText]
  });

  const results = await pineconeIndex.query({
    vector:          embRes.data[0].embedding,
    topK,
    includeMetadata: true
  });

  return results.matches.map(m => ({
    id:             m.id,
    score:          m.score,
    category:       m.metadata.category,
    pattern:        m.metadata.pattern,
    description:    m.metadata.description,
    test_strategies: String(m.metadata.test_strategies).split(" | ")
  }));
}

// ---------- BATCH RETRIEVE ----------
// Embeds all requirements in ONE API call, then queries Pinecone in parallel
async function retrieveTestPatternsBatch(requirements, topK = 2) {
  if (!initialized) await initRAG();

  const embRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: requirements.map(r => r.text)
  });

  const queryResults = await Promise.all(
    embRes.data.map(e =>
      pineconeIndex.query({
        vector:          e.embedding,
        topK,
        includeMetadata: true
      })
    )
  );

  return queryResults.map(r =>
    r.matches.map(m => ({
      id:             m.id,
      score:          m.score,
      category:       m.metadata.category,
      pattern:        m.metadata.pattern,
      description:    m.metadata.description,
      test_strategies: String(m.metadata.test_strategies).split(" | ")
    }))
  );
}

module.exports = { initRAG, retrieveTestPatterns, retrieveTestPatternsBatch };
