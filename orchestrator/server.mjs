import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { ContribForgeEngine } from "./agent-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../web-dashboard")));

// Global engine instance
let engine = null;

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
app.post("/api/run", async (req, res) => {
  const { owner = "truefoundry", repo = "micro-config", issueNumber = 14 } = req.body || {};
  if (engine.state === "RUNNING" || engine.state === "PAUSED_FOR_APPROVAL") {
    return res.status(409).json({ error: "A workflow is already active in session." });
  }

  initEngine();
  res.json({ status: "started", issue: { owner, repo, issueNumber } });

  // Run in background and stream events via WebSockets
  engine
    .runWorkflow({ owner, repo, issueNumber })
    .catch((err) => console.error("Workflow error:", err.message));
});

app.post("/api/approve", (req, res) => {
  const { allow = true } = req.body;
  if (!engine || engine.state !== "PAUSED_FOR_APPROVAL") {
    return res.status(400).json({ error: "No action pending approval." });
  }

  engine.handleApprovalDecision(allow);
  res.json({ status: allow ? "approved" : "denied" });
});

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
      session: engine ? engine.currentSession : null
    })
  );
});

server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 ContribForge Web Dashboard running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`========================================================\n`);
});
