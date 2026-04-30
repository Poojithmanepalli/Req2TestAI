require("dotenv").config();

const express = require("express");
const multer  = require("multer");
const cors    = require("cors");
const fs      = require("fs");
const pdfParse = require("pdf-parse");

const { cleanText, smartChunk } = require("./src/utils/textProcessor");
const { runAgent }               = require("./src/services/agentService");
const { initRAG }                = require("./src/services/ragService");

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Pre-warm RAG embeddings when server starts (avoids delay on first request)
initRAG().catch(err => console.error("[RAG init error]", err.message));

// ---------- JOB STORE ----------
const jobs = {};

function sendSSE(jobId, data) {
  const job = jobs[jobId];
  if (!job) return;
  if (job.sse) {
    job.sse.write(`data: ${JSON.stringify(data)}\n\n`);
  } else {
    job.buffer.push(data);
  }
}

// ---------- SSE ----------
app.get("/events/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!jobs[jobId]) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Job not found" })}\n\n`);
    return res.end();
  }

  jobs[jobId].sse = res;

  if (jobs[jobId].buffer.length > 0) {
    jobs[jobId].buffer.forEach(event => res.write(`data: ${JSON.stringify(event)}\n\n`));
    jobs[jobId].buffer = [];
  }

  if (jobs[jobId].status === "done") {
    res.write(`data: ${JSON.stringify({ type: "complete", result: jobs[jobId].result })}\n\n`);
    res.end();
  }

  req.on("close", () => {
    if (jobs[jobId]) delete jobs[jobId].sse;
  });
});

// ---------- MAIN PROCESS (Agentic pipeline) ----------
async function processFile(file, jobId) {
  const start = Date.now();

  try {
    sendSSE(jobId, { type: "progress", percent: 10, message: "Reading PDF..." });

    const data    = await pdfParse(fs.readFileSync(file.path));
    const cleaned = cleanText(data.text);
    const chunks  = smartChunk(cleaned);

    sendSSE(jobId, { type: "progress", percent: 20, message: "Starting AI Agent..." });

    // Hand off to the agentic pipeline — agent calls tools autonomously
    const result = await runAgent(
      chunks,
      (percent, message) => sendSSE(jobId, { type: "progress", percent, message }),
      start
    );

    fs.unlinkSync(file.path);

    jobs[jobId].status = "done";
    jobs[jobId].result = result;

    sendSSE(jobId, { type: "complete", result });

  } catch (err) {
    console.error("Agent pipeline error:", err);
    sendSSE(jobId, { type: "error", message: err.message });
  }
}

// ---------- ROUTE ----------
app.post("/upload", upload.single("file"), (req, res) => {
  const jobId = Date.now().toString();

  jobs[jobId] = { status: "processing", sse: null, result: null, buffer: [] };

  res.json({ jobId });
  processFile(req.file, jobId);
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
