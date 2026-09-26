# ContribForge ⚡
### *Autonomous Open-Source Issue Resolver with Sandboxed Verification & Human-in-the-Loop Governance*

[![Event: TrueFoundry x Polaris Hackathon](https://img.shields.io/badge/Event-TrueFoundry%20%C3%97%20Polaris%20Hackathon-blue)](https://luma.com/truefo-kb06)
[![Harness: TrueForge](https://img.shields.io/badge/Harness-%40truefoundry%2Ftrueforge-indigo)](https://trueforge.dev)
[![Engine: Serena AST](https://img.shields.io/badge/Engine-Serena%20Symbolic-emerald)](#serena-integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> **"Anything can talk. An agent has to reach your real systems, run the code it writes without breaking anything, and know when to stop and ask."**  
> — TrueFoundry × Polaris Hackathon Mandate

---

## 🌟 Overview

**ContribForge** is an autonomous developer copilot built on the **TrueForge Agent Harness** and **Serena**. Given any GitHub issue, ContribForge:
1. **Reaches real tools:** Interacts with GitHub via Octokit and executes version-controlled workflows with Git CLI.
2. **Practices Test-Driven Agentics (TDA):** Authors an isolated reproduction script in a hermetic sandbox and verifies that it **fails (🔴 RED)** before touching any code.
3. **Applies surgical patches:** Uses Serena's AST-level symbol awareness to patch only affected declarations without blowing context limits.
4. **Verifies zero regressions:** Re-runs the repro test until **green (🟢)**, and executes the entire repository test suite.
5. **Enforces the TrueForge "Pause" Gate:** Halts before irreversible actions (pushing commits or opening a public PR), presenting an interactive diff and requiring explicit developer sign-off.

---

## 📐 Architecture

```
                                ┌──────────────────────────────────────┐
                                │   TrueForge Harness (Port 8790)     │
                                │   - Session State Persistence        │
                                │   - Dynamic Sub-Agents & Compaction  │
                                │   - Human-in-the-Loop Pause Gate     │
                                └──────────────────┬───────────────────┘
                                                   │ MCP Protocol (stdio)
                                                   ▼
                                ┌──────────────────────────────────────┐
                                │       ContribForge MCP Server        │
                                │       (contribforge-mcp)             │
                                └───────┬──────────────────────┬───────┘
                                        │                      │
                         GitHub & Git Connector         Hermetic Execution Sandbox
                         - fetch_github_issue           - run_sandbox_command (Red/Green)
                         - get_git_diff                 - write_file_in_sandbox
                         - [GATED] submit_pull_request  - read_file_in_sandbox
```

---

## 🚀 Quickstart & Live Demo

### 1. Prerequisites
- Node.js 22.14 or newer (`node -v`)
- Git (`git --version`)

### 2. Start the ContribForge Web Dashboard
Run the one-command orchestrator:
```bash
# In the root repository directory
npm start
```
Open your browser to: **[http://localhost:4000](http://localhost:4000)**

### 3. Run the Demo
1. Choose an issue from the **Target Bug** selector in the top bar:
   - **Issue #14:** `PORT` null/empty string crash (`TypeError: Cannot read properties of undefined`).
   - **Issue #12:** `parseHost` scheme prefix (`http://` or `https://` socket binding error).
2. Click **"Run Issue Demo"** (or press `⌘R` / `Ctrl+R`).
3. Watch the live pipeline:
   - **Step 1:** Sandbox initialization & isolation.
   - **Step 2:** GitHub Issue context extraction.
   - **Step 3:** Minimal reproduction authored & failed in sandbox (**🔴 Red Check**).
   - **Step 4:** Surgical defensive patch applied via AST symbol manipulation.
   - **Step 5:** Repro passed (**🟢 Green Check**) & 100% of regression unit tests pass.
   - **Step 6:** **🛡️ PAUSE GATE ACTIVATED:** The TrueForge approval modal slides down with the full diff and test summary.
   - **Step 7:** Click **"Allow & Create Pull Request"** (or press `⌘↵` / `Ctrl+Enter`) to trigger the irreversible submission.

### 4. Running via Terminal CLI
If you prefer a terminal-based workflow:
```bash
# Run interactive CLI on Issue #14 or Issue #12
npm run cli -- 14
npm run cli -- 12
```
Or for automated benchmarking:
```bash
npm run cli:auto -- 14
npm run cli:auto -- 12
```

---

## 🛠️ TrueForge Agent Harness Setup

ContribForge runs directly inside the official TrueForge runtime:

1. **Launch TrueForge:**
   ```bash
   npx @truefoundry/trueforge@latest
   ```
   Open `http://localhost:8790`.

2. **Add the MCP Connector:**
   - Go to **Settings → Connectors** → **Add MCP Server**.
   - **Name:** `contribforge-mcp`
   - **Command:** `node`
   - **Args:** `<path-to-repo>/contribforge-mcp/server.mjs`
   - Click **Save**.

3. **Configure the Agent:**
   - Go to **Build Agent**.
   - Model: Select `anthropic/claude-3-5-sonnet` or `google/gemini-2.0-flash`.
   - MCP Tools: Enable `contribforge-mcp`.
   - **Critical:** Toggle the **Approval Shield** ON next to `submit_pull_request`.
   - Save agent as `ContribForge`.

---

## 🧠 Serena Integration

ContribForge integrates with **Serena** for semantic codebase comprehension:
- **Symbol-level indexing:** Rather than dumping entire repositories into LLM prompts (which blows context limits), the agent uses Serena's AST tools (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) to inspect method signatures and call graphs.
- **Architectural Memory:** Persists project patterns into Serena's project memory under `architecture/contribforge_overview`.

---

## 📋 Evaluation Criteria Mapping

| TrueFoundry Hackathon Criteria | ContribForge Implementation | Verification Proof |
| :--- | :--- | :--- |
| **Real Tool Reached** | Live GitHub API (Octokit), Git CLI (`simple-git`), filesystem I/O | Live Pull Request created & verified |
| **Code Run in Sandbox** | Hermetic sandbox execution with timeouts & path traversal isolation | `node --test test/repro_issue_14.test.js` executed Red then Green |
| **Pause Before Irreversible** | `@destructive` tag on `submit_pull_request` | Interactive approval modal with Allow/Deny controls |
| **Built on TrueForge** | Native `@truefoundry/trueforge` server, MCP stdio protocol, session engine | Port 8790 / Port 4000 live integration |

---

## 📁 Repository Structure

```
├── contribforge-mcp/          # Model Context Protocol (MCP) Server
│   ├── server.mjs             # MCP tool registrations
│   ├── test-mcp.mjs           # Unit test suite for MCP tools
│   └── tools/                 # Sandbox, GitHub, Diff, and PR modules
│
├── demo-target-repo/          # Realistic open-source library for demo
│   ├── src/config-parser.js   # Codebase with the edge-case bug
│   └── test/                  # Existing unit test suite
│
├── orchestrator/              # Agent Execution Engine & Dashboard Server
│   ├── agent-engine.mjs       # Test-Driven Agentics (TDA) execution loop
│   ├── server.mjs             # Express + WebSocket real-time server
│   └── cli.mjs                # Interactive terminal runner
│
├── web-dashboard/             # Dark-mode dashboard for stage presentations
│   ├── index.html             # Stepper, terminal stream, and HITL modal
│   ├── styles.css             # Glassmorphism aesthetic
│   └── app.js                 # WebSocket client
│
├── implementation.md          # Architectural Manifesto & Decision Rationale
├── PITCH_DECK.md              # 3-minute stage presentation script & Q&A
└── trueforge-agent-spec.json  # Exported TrueForge agent definition
```

---

## 🏆 Authors & Hackathon Team
- **B S Tejender Singh** (Builder & Lead Architect)
- **Built for:** Agents That Act — TrueFoundry × Polaris Hackathon (September 26, 2026, Bengaluru)
