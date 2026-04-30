const OpenAI = require("openai");
const { retrieveTestPatternsBatch } = require("./ragService");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function safeParse(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// ---------- SEMANTIC DEDUPLICATION ----------
async function semanticDeduplicateAI(requirements) {
  try {
    const list = requirements.map((r, i) => `${i + 1}. ${r.text}`).join("\n");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a requirements analyst. Your job is to identify and remove semantically duplicate requirements."
        },
        {
          role: "user",
          content: `Below are requirements extracted from an SRS document. Many may be duplicates or near-duplicates.

Your job: Aggressively deduplicate. Keep ONLY requirements that introduce CLEARLY DISTINCT functionality or constraints not already covered by another kept requirement.

Two requirements are duplicates if ANY of the following apply — regardless of domain or technology:
1. They describe the same system behavior or feature, even if the wording is completely different
2. They specify the same quality attribute (performance, security, reliability, usability, compatibility) for the same system aspect
3. One is a vague/general version of a more specific requirement — remove the vague one, keep the specific one
4. They set the same type of limit or threshold (time, count, size, percentage) for the same thing — keep the stricter/more specific value
5. They describe the same constraint or compliance rule from different angles
6. The same feature is described for different scopes (e.g. "students get notified" AND "all users get notified" AND "system sends notifications") — these are the SAME feature, keep only the broadest one
7. One requirement is fully implied by or contained within another
8. Multiple requirements all describe variations of the same notification/alert for the same event — keep ONE

From each duplicate group: keep the ONE that is most complete, covers the widest scope, and is most specific.
If in doubt — remove one. Prefer 1 strong requirement over 3 weak overlapping ones.

Requirements:
${list}

Return ONLY a JSON array of 1-based index numbers to KEEP:
[1, 4, 7, ...]`
        }
      ],
      temperature: 0
    });

    const indices = safeParse(res.choices[0].message.content);
    if (!Array.isArray(indices)) return requirements;

    return indices
      .filter(i => typeof i === "number" && i >= 1 && i <= requirements.length)
      .map(i => requirements[i - 1]);

  } catch {
    return requirements;
  }
}

// ---------- RAG EXTRACTION ----------
async function extractRequirementsAI(text) {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a senior software analyst reviewing a chunk of an SRS document. The system may be any type: web app, mobile app, embedded system, IoT, ERP, healthcare, banking, e-commerce, AI system, or any other domain.

Extract the most important, clearly distinct, high-level system requirements from this chunk. Typically 2–5 per chunk — fewer is better than more.

Classification:
- "functional": WHAT the system does — features, behaviors, user interactions, data operations, integrations
- "non-functional": HOW WELL — performance, scalability, security, reliability, availability, usability, compliance, compatibility

Quality rules for NON-FUNCTIONAL requirements (strict):
- Every non-functional requirement MUST contain at least one of: a specific number/metric (e.g. 99.9%, 2 seconds, 5000 users), a named standard (e.g. AES-256, GDPR, WCAG 2.1, TLS 1.2, PCI-DSS), or a specific platform/protocol
- REJECT vague NFRs like "the system shall be secure", "shall ensure high availability", "shall be scalable", "shall be reliable" — these have NO measurable criterion
- REJECT NFRs that just restate a feature as a quality (e.g. "the system shall maintain real-time accuracy" without specifying what accuracy means)
- ACCEPT: "must support 5,000 concurrent users", "response time under 2 seconds", "99.9% uptime", "AES-256 encryption", "WCAG 2.1 compliance"

DO NOT extract:
- Development process requirements (coding standards, documentation, CI/CD, sprint planning)
- Environment assumptions (user must have internet — assumption, not system requirement)
- Design/implementation details (which framework, database, language)
- Any NFR without a measurable criterion (see above)
- Anything already covered by a requirement extracted earlier in this chunk

Rules:
- Typically 2–4 requirements per chunk — fewer is better
- Prefer ONE broad requirement over multiple narrow sub-requirements for the same feature
- If the same action applies to multiple user roles, write ONE requirement covering all roles
- Each requirement must describe what the SYSTEM does or guarantees, not what the development team does

Return ONLY valid JSON:
[{"text":"...","type":"functional" or "non-functional"}]`
        },
        { role: "user", content: text }
      ],
      temperature: 0.2
    });

    return safeParse(res.choices[0].message.content);

  } catch {
    return null;
  }
}

// ---------- VALIDATION ----------
async function validateRequirementAI(text) {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Is this a real requirement? Answer YES or NO only."
        },
        { role: "user", content: text }
      ]
    });

    return res.choices[0].message.content.trim() === "YES";
  } catch {
    return true;
  }
}

// ---------- COVERAGE ----------
async function coverageAI(requirements) {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a requirements analyst. Respond with a single integer only — no words, no symbols, no explanation."
        },
        {
          role: "user",
          content: `Rate how well these requirements cover the typical needs of this type of system.
Score from 40 to 95 based on: breadth of features covered, presence of key non-functional requirements, and overall completeness.

Requirements:
${requirements.map(r => "- " + r.text).join("\n")}

Reply with a single integer between 40 and 95. Nothing else.`
        }
      ],
      temperature: 0
    });

    const raw = res.choices[0].message.content.trim();
    const match = raw.match(/\d+/);
    if (match) {
      const num = parseInt(match[0]);
      return Math.min(95, Math.max(40, num));
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- MISSING ----------
async function missingRequirementsAI(requirements) {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a senior software analyst. Identify important requirements that are missing from an SRS."
        },
        {
          role: "user",
          content: `Below are requirements already extracted from an SRS document:
${requirements.map(r => "- " + r.text).join("\n")}

Identify up to 8 important requirements that are MISSING — things a system like this would typically need but that are not covered above.
Only suggest requirements that are clearly absent, not variations of existing ones.

Return ONLY a valid JSON array of objects:
[{"text":"..."},{"text":"..."}]`
        }
      ],
      temperature: 0.3
    });

    const parsed = safeParse(res.choices[0].message.content);
    if (!Array.isArray(parsed)) return [];

    // Normalise — handle both string arrays and object arrays
    return parsed
      .map(r => typeof r === "string" ? { text: r } : r)
      .filter(r => r && r.text && r.text.trim().length > 10)
      .slice(0, 8);

  } catch {
    return [];
  }
}

// ---------- TEST CASE GENERATION (single) ----------
async function generateTestCasesAI(requirement) {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a software testing expert. Generate structured test cases as JSON only."
        },
        {
          role: "user",
          content: `Generate 3-4 test cases for this requirement.
Requirement: ${requirement}
Return ONLY valid JSON array:
[{"title":"...","steps":["..."],"expected":"..."}]`
        }
      ],
      temperature: 0.3
    });
    return safeParse(res.choices[0].message.content);
  } catch {
    return null;
  }
}

// ---------- TEST CASE GENERATION (batch — 5 requirements in 1 API call) ----------
// Also returns a module name per requirement so classification is AI-driven
// and works for any domain (not just campus apps)
async function generateTestCasesBatch(requirements) {
  try {
    const numbered = requirements
      .map((r, i) => `${i + 1}. ${r.text}`)
      .join("\n");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a software testing expert. Generate test cases and classify requirements into modules as JSON only."
        },
        {
          role: "user",
          content: `For each requirement below:
1. Assign a short module name (2-3 words max) that best describes the feature area. Use consistent names across requirements that belong to the same feature. Common examples: "Authentication", "User Management", "Payment", "Order Management", "Notifications", "Security", "Performance", "Dashboard", "Data Management", "UI & Compatibility" — but use whatever fits this specific system.
2. Generate 3-4 test cases.

${numbered}

Return ONLY valid JSON object where keys are requirement numbers:
{
  "1": {"module":"...","testCases":[{"title":"...","steps":["..."],"expected":"..."}]},
  "2": {"module":"...","testCases":[...]},
  ...
}`
        }
      ],
      temperature: 0.2
    });

    return safeParse(res.choices[0].message.content);
  } catch {
    return null;
  }
}

// ---------- MODULE CONSOLIDATION ----------
async function consolidateModulesAI(results) {
  try {
    const list = results.map((r, i) => `${i + 1}. [${r.module}] ${r.requirement}`).join("\n");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a software architect. Your job is to organize requirements into a clean, minimal set of modules."
        },
        {
          role: "user",
          content: `Below are requirements with AI-assigned module names. Consolidate them into a SMALL, clean set of modules.

${list}

Rules:
- Target between 5 and 10 modules — proportional to how many requirements there are
- Any module with only 1 requirement should be merged into the closest related module UNLESS it represents a genuinely unique feature area
- Merge overlapping module names into one (e.g. "User Auth", "Login Management", "Authentication" → "Authentication")
- Merge monitoring/reporting modules into the broader module they monitor (e.g. "Performance Monitoring" → "Performance")
- Merge access control/RBAC into "Security" unless it is the primary feature of the system
- Merge scheduling/timetable/appointment into one scheduling module if they are related
- Keep module names short (1-3 words), professional, consistent, and meaningful for this specific system
- Do NOT force merges that would lose meaningful distinction (e.g. "Payment" and "Authentication" must stay separate)

Return ONLY a JSON object mapping requirement numbers (1-based) to consolidated module name:
{"1":"Authentication","2":"Classroom Management","3":"Security",...}`
        }
      ],
      temperature: 0
    });

    const mapping = safeParse(res.choices[0].message.content);
    if (!mapping || typeof mapping !== "object") return results;

    return results.map((r, i) => ({
      ...r,
      module: mapping[String(i + 1)] || r.module
    }));

  } catch {
    return results;
  }
}

// ---------- RAG-ENHANCED BATCH TEST GENERATION ----------
async function generateTestCasesBatchRAG(requirements) {
  try {
    // Retrieve top-2 relevant testing patterns per requirement in one API call
    const patternSets = await retrieveTestPatternsBatch(requirements, 2);

    const numbered = requirements.map((r, i) => {
      const patterns = patternSets[i];
      const patternContext = patterns.map(p =>
        `   [${p.pattern}]: ${p.test_strategies.slice(0, 3).join(" | ")}`
      ).join("\n");

      return `${i + 1}. ${r.text}\n   Relevant testing patterns to apply:\n${patternContext}`;
    }).join("\n\n");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a software testing expert. Use the provided testing patterns as guidance to generate comprehensive, specific test cases. Return JSON only."
        },
        {
          role: "user",
          content: `For each requirement below, apply the suggested testing patterns to generate 3-4 targeted test cases. Also assign a short module name (2-3 words).

${numbered}

Return ONLY valid JSON:
{
  "1": {"module":"...","testCases":[{"title":"...","steps":["..."],"expected":"..."}]},
  "2": {"module":"...","testCases":[...]},
  ...
}`
        }
      ],
      temperature: 0.2
    });

    return safeParse(res.choices[0].message.content);
  } catch {
    return null;
  }
}

module.exports = {
  extractRequirementsAI,
  semanticDeduplicateAI,
  generateTestCasesAI,
  generateTestCasesBatch,
  generateTestCasesBatchRAG,
  consolidateModulesAI,
  validateRequirementAI,
  coverageAI,
  missingRequirementsAI
};