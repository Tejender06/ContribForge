import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { ContribForgeEngine } from "./agent-engine.mjs";
import { parseGitHubUrl, fetchGitHubIssue } from "../contribforge-mcp/tools/github.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../web-dashboard")));

// Global engine instance & configuration
let engine = null;
let globalSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  githubToken: process.env.GITHUB_TOKEN || "",
  model: "gemini-2.5-flash"
};

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function initEngine() {
  engine = new ContribForgeEngine((event) => {
    broadcast(event);
  });
}

initEngine();

// REST API Endpoints

// Run Workflow
app.post("/api/run", async (req, res) => {
  const {
    owner = "truefoundry",
    repo = "micro-config",
    issueNumber = 14,
    issueUrl = null,
    geminiApiKey = globalSettings.geminiApiKey,
    githubToken = globalSettings.githubToken,
    model = globalSettings.model
  } = req.body || {};

  if (engine.state === "RUNNING" || engine.state === "PAUSED_FOR_APPROVAL") {
    return res.status(409).json({ error: "A workflow is already active in session." });
  }

  initEngine();
  res.json({ status: "started", issue: { owner, repo, issueNumber, issueUrl } });

  // Run in background and stream events via WebSockets
  engine
    .runWorkflow({
      owner,
      repo,
      issueNumber,
      issueUrl,
      apiKey: geminiApiKey,
      githubToken,
      model
    })
    .catch((err) => console.error("Workflow error:", err.message));
});

// HITL Approval Decision
app.post("/api/approve", (req, res) => {
  const { allow = true } = req.body;
  if (!engine || engine.state !== "PAUSED_FOR_APPROVAL") {
    return res.status(400).json({ error: "No action pending approval." });
  }

  engine.handleApprovalDecision(allow);
  res.json({ status: allow ? "approved" : "denied" });
});

// Cancel Running Workflow
app.post("/api/cancel", (req, res) => {
  if (engine) {
    engine.cancelWorkflow();
  }
  initEngine();
  res.json({ status: "cancelled" });
});

// Get Settings & Key Status
app.get("/api/settings", (req, res) => {
  res.json({
    hasGeminiKey: !!globalSettings.geminiApiKey,
    hasGithubToken: !!globalSettings.githubToken,
    geminiKeyMasked: globalSettings.geminiApiKey ? globalSettings.geminiApiKey.slice(0, 4) + "..." + globalSettings.geminiApiKey.slice(-4) : "",
    githubTokenMasked: globalSettings.githubToken ? globalSettings.githubToken.slice(0, 4) + "..." + globalSettings.githubToken.slice(-4) : "",
    model: globalSettings.model
  });
});

// Update Settings
app.post("/api/settings", (req, res) => {
  const { geminiApiKey, githubToken, model } = req.body || {};
  if (typeof geminiApiKey === "string") {
    globalSettings.geminiApiKey = geminiApiKey.trim();
    if (globalSettings.geminiApiKey) process.env.GEMINI_API_KEY = globalSettings.geminiApiKey;
  }
  if (typeof githubToken === "string") {
    globalSettings.githubToken = githubToken.trim();
    if (globalSettings.githubToken) process.env.GITHUB_TOKEN = globalSettings.githubToken;
  }
  if (model) {
    globalSettings.model = model;
  }
  res.json({
    success: true,
    hasGeminiKey: !!globalSettings.geminiApiKey,
    hasGithubToken: !!globalSettings.githubToken,
    model: globalSettings.model
  });
});

// Parse GitHub Issue URL Endpoint
app.post("/api/parse-url", async (req, res) => {
  const { url } = req.body || {};
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid GitHub Issue URL. Expected format: https://github.com/:owner/:repo/issues/:id" });
  }
  try {
    const issue = await fetchGitHubIssue(parsed.owner, parsed.repo, parsed.issueNumber, globalSettings.githubToken);
    res.json({ parsed, issue });
  } catch (err) {
    res.json({ parsed, error: err.message });
  }
});

// Engine Status
app.get("/api/status", (req, res) => {
  res.json({
    state: engine ? engine.state : "IDLE",
    session: engine ? engine.currentSession : null
  });
});

wss.on("connection", (ws) => {
  ws.send(
    JSON.stringify({
      type: "connected",
      state: engine ? engine.state : "IDLE",
      session: engine ? engine.currentSession : null,
      settings: {
        hasGeminiKey: !!globalSettings.geminiApiKey,
        hasGithubToken: !!globalSettings.githubToken,
        model: globalSettings.model
      }
    })
  );
});

server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 ContribForge Web Dashboard running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`========================================================\n`);
});
