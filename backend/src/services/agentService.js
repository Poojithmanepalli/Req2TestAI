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
const TOOLS = [
  {
    type: "function",
    function: {
      name: "extract_and_clean_requirements",
      description: "Extract software requirements from the pre-loaded SRS document, remove noise, and deduplicate. Always call this first.",
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
      name: "reextract_with_finer_chunks",
      description: "Re-extract requirements by splitting the document into finer chunks to recover missed requirements. Call this ONLY ONCE if coverage score comes back below 50%. Do not call if coverage >= 50%.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why coverage was low and what you expect to recover" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_coverage_and_gaps",
      description: "Analyze how well the extracted requirements cover the system and identify missing requirements. Call after extract_and_clean_requirements (or after reextract_with_finer_chunks if used).",
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
      description: "Generate structured test cases for all requirements using RAG-retrieved testing patterns. Call after analyze_coverage_and_gaps.",
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
      name: "retry_weak_test_cases",
      description: "Retry test case generation for requirements that received 1 or fewer test cases. Call this ONLY ONCE if more than 20% of requirements have weak coverage after generate_test_cases. Do not call if most requirements have adequate test cases.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "How many requirements were weak and what you expect to improve" }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compile_final_report",
      description: "Compile all results into the final structured report. Call this last — after generate_test_cases and optionally after retry_weak_test_cases.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-sentence summary of the analysis and any corrective steps taken" }
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

// Split each chunk into smaller pieces for finer extraction
function makeFinerChunks(chunks) {
  const finer = [];
  for (const chunk of chunks) {
    const words = chunk.split(" ");
    if (words.length > 120) {
      const mid = Math.floor(words.length / 2);
      finer.push(words.slice(0, mid).join(" "));
      finer.push(words.slice(mid).join(" "));
    } else {
      finer.push(chunk);
    }
  }
  return finer;
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

  const batchOutputs = await Promise.all(batches.map(batch => generateTestCasesBatchRAG(batch)));

  const results = [];
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const aiMap = batchOutputs[b];

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

// Retry only the weak requirements individually with a focused prompt
async function toolRetryWeakTestCases(results) {
  const weak = results.filter(r => r.testCases.length <= 1);
  if (weak.length === 0) return results;

  const retried = await Promise.all(
    weak.map(async (item) => {
      const newTCs = await generateTestCasesAI(item.requirement);
      if (newTCs && newTCs.length > item.testCases.length) {
        return { ...item, testCases: newTCs.slice(0, 5) };
      }
      return item;
    })
  );

  const improvedMap = {};
  retried.forEach(item => { improvedMap[item.id] = item; });

  return results.map(r => improvedMap[r.id] || r);
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

  const state = {
    chunks,
    requirements:        [],
    coverageScore:       0,
    missingRequirements: [],
    similarRequirements: [],
    results:             [],
    hasReextracted:      false,  // guard: prevent infinite reextract loop
    hasRetriedWeak:      false   // guard: prevent infinite retry loop
  };

  const messages = [
    {
      role: "system",
      content: `You are an expert QA automation agent that analyses Software Requirements Specification (SRS) documents.
The SRS document is pre-loaded (${chunks.length} chunks). All data is server-side — just call tools.

Follow this decision logic:

1. Call extract_and_clean_requirements first.

2. Call analyze_coverage_and_gaps.
   - If coverage score < 50%: call reextract_with_finer_chunks (ONCE only) to recover missed requirements, then call analyze_coverage_and_gaps again.
   - If coverage >= 50%: proceed to the next step directly.

3. Call generate_test_cases.
   - After seeing the result: if more than 20% of requirements have weak test cases (≤1 test case), call retry_weak_test_cases (ONCE only) to improve them.
   - Otherwise: proceed to compile.

4. Call compile_final_report last.

Never call reextract_with_finer_chunks or retry_weak_test_cases more than once each. Always finish with compile_final_report.`
    },
    {
      role: "user",
      content: `Analyse the pre-loaded SRS document (${chunks.length} chunks) and produce a complete test case report with coverage analysis.`
    }
  ];

  for (let iteration = 0; iteration < 15; iteration++) {
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
      let feedback;

      if (name === "extract_and_clean_requirements") {
        sendProgress(25, "Extracting & deduplicating requirements...", "extract");
        state.requirements        = await toolExtractAndClean(state.chunks);
        state.similarRequirements = await findSimilarRequirements(state.requirements);
        feedback = {
          status:            "done",
          total:             state.requirements.length,
          similarPairsFound: state.similarRequirements.length,
          types: {
            functional:    state.requirements.filter(r => r.type === "functional").length,
            nonFunctional: state.requirements.filter(r => r.type === "non-functional").length
          },
          agentNote: state.requirements.length < 5
            ? "Very few requirements found. Consider calling reextract_with_finer_chunks after coverage check."
            : "Extraction complete."
        };

      } else if (name === "reextract_with_finer_chunks") {
        if (state.hasReextracted) {
          feedback = { status: "skipped", reason: "Already reextracted once. Proceed with existing requirements." };
        } else {
          state.hasReextracted  = true;
          sendProgress(38, "Re-extracting with finer document chunks...", "reextract");
          const finerChunks     = makeFinerChunks(state.chunks);
          const newRequirements = await toolExtractAndClean(finerChunks);

          // Merge new requirements with existing, deduplicate by text
          const existingTexts   = new Set(state.requirements.map(r => r.text.toLowerCase()));
          const added           = newRequirements.filter(r => !existingTexts.has(r.text.toLowerCase()));
          const merged          = [...state.requirements, ...added];
          state.requirements    = merged.map((r, i) => ({ ...r, id: `REQ_${i + 1}` }));
          state.similarRequirements = await findSimilarRequirements(state.requirements);

          feedback = {
            status:     "done",
            chunksUsed: finerChunks.length,
            newlyFound: added.length,
            totalNow:   state.requirements.length,
            agentNote:  `Recovered ${added.length} additional requirements. Now call analyze_coverage_and_gaps again.`
          };
        }

      } else if (name === "analyze_coverage_and_gaps") {
        sendProgress(55, "Analyzing coverage & identifying gaps...", "coverage");
        const res                 = await toolAnalyzeCoverageAndGaps(state.requirements);
        state.coverageScore       = res.coverageScore;
        state.missingRequirements = res.missingRequirements;
        feedback = {
          status:        "done",
          coverageScore: state.coverageScore,
          gapsFound:     state.missingRequirements.length,
          agentNote:     state.coverageScore < 50 && !state.hasReextracted
            ? "Coverage is low. Call reextract_with_finer_chunks to recover missed requirements before proceeding."
            : "Coverage acceptable. Proceed to generate_test_cases."
        };

      } else if (name === "generate_test_cases") {
        sendProgress(65, "Generating RAG-enhanced test cases...", "generate");
        state.results        = await toolGenerateTestCases(state.requirements);
        const weakCount      = state.results.filter(r => r.testCases.length <= 1).length;
        const weakPct        = Math.round((weakCount / state.results.length) * 100);
        feedback = {
          status:           "done",
          testCasesCreated: state.results.reduce((s, r) => s + r.testCases.length, 0),
          modulesFound:     [...new Set(state.results.map(r => r.module))].length,
          weakRequirements: weakCount,
          weakPercent:      `${weakPct}%`,
          agentNote:        weakPct > 20 && !state.hasRetriedWeak
            ? `${weakCount} requirements (${weakPct}%) have weak test cases. Call retry_weak_test_cases to improve them.`
            : "Test case quality is acceptable. Proceed to compile_final_report."
        };

      } else if (name === "retry_weak_test_cases") {
        if (state.hasRetriedWeak) {
          feedback = { status: "skipped", reason: "Already retried once. Proceed to compile_final_report." };
        } else {
          state.hasRetriedWeak  = true;
          const weakCount       = state.results.filter(r => r.testCases.length <= 1).length;
          sendProgress(80, `Retrying ${weakCount} weak requirements for better coverage...`, "retry");
          state.results         = await toolRetryWeakTestCases(state.results);
          const stillWeak       = state.results.filter(r => r.testCases.length <= 1).length;
          feedback = {
            status:    "done",
            improved:  weakCount - stillWeak,
            stillWeak,
            agentNote: "Retry complete. Now call compile_final_report."
          };
        }

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

  return compileFinalReport(
    state.results,
    state.coverageScore,
    state.missingRequirements,
    state.similarRequirements,
    processingStart
  );
}

module.exports = { runAgent };
