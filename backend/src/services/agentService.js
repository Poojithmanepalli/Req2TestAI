const OpenAI = require("openai");
const {
  extractRequirementsAI,
  semanticDeduplicateAI,
  generateTestCasesBatchRAG,
  generateTestCasesAI,
  coverageAI,
  missingRequirementsAI
} = require("./llmService");
const { deduplicateRequirements } = require("../utils/deduplicate");
const { isValidRequirement }      = require("../utils/requirementFilter");
const { classifyModule }          = require("./moduleClassifier");
const { initRAG, findSimilarRequirements } = require("./ragService");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- TOOL DEFINITIONS ----------
// All document data lives in server-side state — agent only orchestrates (decides what to call next).
// Tools take only a "reason" string so the agent never needs to carry large data payloads.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "extract_and_clean_requirements",
      description: "Extract software requirements from the pre-loaded SRS document, remove noise, and deduplicate semantically. Always call this first.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why you are calling this step now" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_coverage_and_gaps",
      description: "Analyze how well the extracted requirements cover the system and identify commonly missing requirements. Call after extract_and_clean_requirements.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why you are calling this step now" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_test_cases",
      description: "Generate structured test cases for all extracted requirements using RAG-retrieved testing patterns. Call after analyze_coverage_and_gaps.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why you are calling this step now" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compile_final_report",
      description: "Compile all results into the final structured report. Call this last after generate_test_cases.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-sentence summary of the overall analysis" }
        },
        required: ["summary"]
      }
    }
  }
];

// ---------- HELPER ----------
function assignPriority(text) {
  const t = text.toLowerCase();
  if (t.includes("must") || t.includes("critical")) return "HIGH";
  if (t.includes("should")) return "MEDIUM";
  return "LOW";
}

// ---------- TOOL IMPLEMENTATIONS ----------
async function toolExtractAndClean(chunks) {
  const chunkResults = await Promise.all(chunks.map(chunk => extractRequirementsAI(chunk)));

  let requirements = [];
  chunkResults.forEach(ai => {
    if (Array.isArray(ai)) {
      requirements.push(...ai.map(r => ({ text: r.text.trim(), type: r.type || "functional" })));
    }
  });

  requirements = requirements.filter(r => isValidRequirement(r.text));
  requirements = deduplicateRequirements(requirements);
  requirements = await semanticDeduplicateAI(requirements);
  requirements = requirements.map((r, i) => ({ id: `REQ_${i + 1}`, text: r.text, type: r.type }));

  return requirements;
}

async function toolAnalyzeCoverageAndGaps(requirements) {
  const [coverageScore, rawMissing] = await Promise.all([
    coverageAI(requirements),
    missingRequirementsAI(requirements)
  ]);

  const safeScore = coverageScore || (() => {
    const f  = requirements.filter(r => r.type === "functional").length;
    const nf = requirements.filter(r => r.type === "non-functional").length;
    return Math.min(90, Math.min(50, f * 4) + Math.min(30, nf * 5) + (requirements.length >= 20 ? 10 : 5));
  })();

  const missingRequirements = (Array.isArray(rawMissing) ? rawMissing : [])
    .map(r => typeof r === "string" ? { text: r } : r)
    .filter(r => r && r.text && r.text.trim().length > 0)
    .slice(0, 8);

  return { coverageScore: safeScore, missingRequirements };
}

async function toolGenerateTestCases(requirements) {
  const batchSize = 8;
  const batches   = [];
  for (let i = 0; i < requirements.length; i += batchSize) {
    batches.push(requirements.slice(i, i + batchSize));
  }

  // All batches use RAG-enhanced generation, run in parallel
  const batchOutputs = await Promise.all(batches.map(batch => generateTestCasesBatchRAG(batch)));

  const results = [];
  for (let b = 0; b < batches.length; b++) {
    const batch  = batches[b];
    const aiMap  = batchOutputs[b];

    const items = await Promise.all(batch.map(async (req, j) => {
      const ai = aiMap?.[String(j + 1)];
      let testCases = ai?.testCases;

      if (!testCases || testCases.length === 0) {
        testCases = await generateTestCasesAI(req.text);
      }
      if (!testCases || testCases.length === 0) {
        testCases = [
          { title: "Happy Path",    steps: ["Execute the feature with valid input"], expected: "Feature executes successfully" },
          { title: "Invalid Input", steps: ["Provide invalid or missing input"],     expected: "Appropriate error message displayed" }
        ];
      }

      return {
        id:          req.id,
        module:      ai?.module || classifyModule(req.text),
        requirement: req.text,
        type:        req.type,
        priority:    assignPriority(req.text),
        testCases:   testCases.slice(0, 5)
      };
    }));

    results.push(...items);
  }
  return results;
}

function compileFinalReport(results, coverageScore, missingRequirements, similarRequirements, processingStart) {
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.module]) grouped[r.module] = [];
    grouped[r.module].push(r);
  });

  const modules = Object.keys(grouped).map(m => ({
    module: m,
    count:  grouped[m].length,
    items:  grouped[m]
  }));

  // Requirement Traceability Matrix
  const rtm = results.map(r => ({
    reqId:         r.id,
    module:        r.module,
    priority:      r.priority,
    type:          r.type,
    requirement:   r.requirement,
    testCaseCount: r.testCases.length,
    tcIds:         r.testCases.map((_, i) => `${r.id}_TC${i + 1}`)
  }));

  return {
    message:             "Agentic AI pipeline complete",
    processingTime:      `${Date.now() - processingStart} ms`,
    stats: {
      total:         results.length,
      functional:    results.filter(r => r.type === "functional").length,
      nonFunctional: results.filter(r => r.type === "non-functional").length
    },
    modules,
    coverageScore,
    missingRequirements,
    similarRequirements: similarRequirements || [],
    rtm
  };
}

// ---------- AGENT LOOP ----------
async function runAgent(chunks, sendProgress, processingStart) {
  await initRAG();

  // All document data lives here — agent NEVER carries data in tool arguments
  const state = {
    chunks,                   // pre-loaded before agent starts
    requirements:         [],
    coverageScore:        0,
    missingRequirements:  [],
    similarRequirements:  [],
    results:              []
  };

  const messages = [
    {
      role: "system",
      content: `You are an expert QA automation agent that analyses Software Requirements Specification (SRS) documents.
The SRS document has already been parsed and pre-loaded (${chunks.length} text chunks). You do NOT need to pass any document data — just call the tools in order.

Call tools in this exact order:
1. extract_and_clean_requirements
2. analyze_coverage_and_gaps
3. generate_test_cases
4. compile_final_report

Do not skip or repeat any step. Each tool uses the output of the previous step automatically.`
    },
    {
      role: "user",
      content: `Analyse the pre-loaded SRS document (${chunks.length} chunks) and produce a complete test case report with coverage analysis.`
    }
  ];

  for (let iteration = 0; iteration < 10; iteration++) {
    const response = await client.chat.completions.create({
      model:       "gpt-4o-mini",
      messages,
      tools:       TOOLS,
      tool_choice: "auto"
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (response.choices[0].finish_reason === "stop") break;
    if (!message.tool_calls?.length) break;

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      let feedback; // only lightweight summaries go back to agent

      if (name === "extract_and_clean_requirements") {
        sendProgress(30, "Extracting & deduplicating requirements...", "extract");
        state.requirements = await toolExtractAndClean(state.chunks);
        // Run similarity check in parallel after extraction
        state.similarRequirements = await findSimilarRequirements(state.requirements);
        feedback = {
          status: "done",
          total:  state.requirements.length,
          similarPairsFound: state.similarRequirements.length,
          types: {
            functional:    state.requirements.filter(r => r.type === "functional").length,
            nonFunctional: state.requirements.filter(r => r.type === "non-functional").length
          }
        };

      } else if (name === "analyze_coverage_and_gaps") {
        sendProgress(55, "Analyzing coverage & identifying gaps...", "coverage");
        const res = await toolAnalyzeCoverageAndGaps(state.requirements);
        state.coverageScore       = res.coverageScore;
        state.missingRequirements = res.missingRequirements;
        feedback = {
          status:        "done",
          coverageScore: state.coverageScore,
          gapsFound:     state.missingRequirements.length
        };

      } else if (name === "generate_test_cases") {
        sendProgress(65, "Generating RAG-enhanced test cases...", "generate");
        state.results = await toolGenerateTestCases(state.requirements);
        feedback = {
          status:           "done",
          testCasesCreated: state.results.reduce((s, r) => s + r.testCases.length, 0),
          modulesFound:     [...new Set(state.results.map(r => r.module))].length
        };

      } else if (name === "compile_final_report") {
        sendProgress(90, "Compiling final report...", "compile");
        const report = compileFinalReport(
          state.results,
          state.coverageScore,
          state.missingRequirements,
          state.similarRequirements,
          processingStart
        );
        messages.push({
          role:         "tool",
          tool_call_id: toolCall.id,
          content:      JSON.stringify({ status: "report compiled successfully" })
        });
        return report;
      }

      messages.push({
        role:         "tool",
        tool_call_id: toolCall.id,
        content:      JSON.stringify(feedback)
      });
    }
  }

  // Fallback: compile with whatever state we have
  return compileFinalReport(
    state.results,
    state.coverageScore,
    state.missingRequirements,
    state.similarRequirements,
    processingStart
  );
}

module.exports = { runAgent };
