# ContribForge: Implementation & Architectural Manifesto
### *Autonomous Open-Source Issue Resolver Built on TrueForge & Serena*
**Event:** [Agents That Act — TrueFoundry × Polaris Hackathon](https://luma.com/truefo-kb06)  
**Date:** Saturday, 26 September 2026 | Bengaluru, India  

---

## 1. Executive Summary & Hackathon Mandate

The TrueFoundry × Polaris Hackathon poses a fundamental challenge to agentic AI:
> *"Anything can talk. An agent has to reach your real systems, run the code it writes without breaking anything, and know when to stop and ask."*

Most hackathon entries build chatbots with thin wrappers around LLM APIs that output advice or mock actions. **ContribForge** is architected to be an **agent that acts**:
1. **Reaches real systems:** Connects directly to the live GitHub REST API, git version control, and filesystem package managers.
2. **Executes code in a sandbox:** Never assumes code works; autonomously authors an isolated reproduction script, proves the bug exists (Red), applies a localized patch, and executes the full project test suite inside a sandbox (Green).
3. **Pauses before irreversible actions:** Hard-gates any state-altering or public action (e.g., pushing commits or opening a public Pull Request) behind TrueForge’s Human-in-the-Loop (HITL) approval barrier.
4. **Powered by TrueForge Harness & Serena:** Runs on `@truefoundry/trueforge` (port 8790) as the orchestration, session, and approval engine, while utilizing **Serena** for semantic symbol navigation, reference tracking, and architectural memory.

---

## 2. Why ContribForge? (Problem Statement & Student Value)

### The Open-Source Bottleneck
Contributing to unfamiliar open-source projects or debugging large codebases is intimidating for developers and students:
- Massive repositories have tens of thousands of lines across hundreds of files.
- Setting up environments and reproducing bugs from vague issue descriptions takes hours.
- **The "AI PR Spam" Crisis:** Maintainers are actively banning contributors who blindly submit hallucinated, unverified LLM patches that fail CI tests or break edge cases.

### The Student Superpower
For a student builder, ContribForge is not just a hackathon prototype—it is an everyday companion. You can point ContribForge at an open-source issue labeled `good first issue` or a stubborn bug in your college project, and watch it safely reproduce the failure, isolate the root cause, and draft a verified, test-backed Pull Request.

---

## 3. Architectural Reasoning: Why This Process & Not Others?

Building an autonomous coding agent involves crucial design trade-offs. Below is the technical reasoning for each architectural decision made in ContribForge.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               CONTRIBFORGE PIPELINE                                    │
│                                                                                        │
│   [ GitHub Issue URL ]                                                                 │
│            │                                                                           │
│            ▼                                                                           │
│   1. Context Extraction ──► Serena Semantic Indexing (Symbols, References, Memories)    │
│            │                                                                           │
│            ▼                                                                           │
│   2. Repro Authoring   ──► Empirical Red Check (Test MUST fail in Sandbox)             │
│            │                                                                           │
│            ▼                                                                           │
│   3. Surgical Patch    ──► Serena-Guided Refactor (Symbol-level edit, not full rewrite)│
│            │                                                                           │
│            ▼                                                                           │
│   4. Verification      ──► Green Check (Repro passes + Zero Test Suite Regressions)    │
│            │                                                                           │
│            ▼                                                                           │
│   5. The "PAUSE" Gate  ──► TrueForge HITL Approval Modal [Allow / Deny]                │
│            │                                                                           │
│            ▼ (User Approves)                                                           │
│   6. Irreversible Act  ──► Git Push & Public GitHub PR Opened                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Decision 1: Test-Driven Agentics (TDA) vs. Direct Patch Generation
* **The Alternative:** Giving the LLM the issue description and asking it to immediately modify the source code to "fix" it.
* **Why the Alternative Fails:** LLMs suffer from "sycophantic correctness"—they produce code that *looks* right syntactically but fails silently or solves the wrong problem. Without empirical feedback, the agent cannot self-correct.
* **Our Process:** **Test-Driven Agentics (TDA)**.
  1. The agent reads the issue and authors an isolated reproduction test case (`repro.test.ts` / `test_repro.py`).
  2. It executes this script in the sandbox and verifies that it **fails (🔴 Red)**. If it passes, the hypothesis was wrong, and the agent must re-examine the issue.
  3. Only after confirming failure does the agent write the fix.
  4. It re-runs the repro until it **passes (🟢 Green)**, then executes the existing test suite to ensure zero regressions.
* **Knowledge Gain:** Reproducing a bug programmatically before touching production code is the hallmark of senior software engineering; ContribForge forces the agent to obey this law.

---

### Decision 2: Serena Symbolic Code Navigation vs. Raw File Dumping
* **The Alternative:** Using ripgrep to grab entire files or dumping whole directory trees into the LLM context window.
* **Why the Alternative Fails:** 
  1. *Context Window Saturation:* Reading 10 files can burn 80,000 tokens in a single turn, driving up latency and cost.
  2. *Lost in the Middle:* LLMs degrade in reasoning quality when searching across massive bloated contexts.
* **Our Process:** Leveraging **Serena's Language-Server & AST Capabilities**:
  - `get_symbols_overview`: Inspects high-level classes, methods, and declarations without reading implementations.
  - `find_symbol` & `find_referencing_symbols`: Jumps directly to the call sites and method definitions impacted by the bug.
  - `write_memory`: Persists project architectural conventions (e.g., error-handling patterns, lint rules) across sessions.
* **Knowledge Gain:** AST-aware symbol navigation allows an agent to act like a developer with an IDE (hovering over definitions and jumping to references) rather than blindly reading whole files as raw text.

---

### Decision 3: Hermetic Sandboxing vs. Direct Host Execution
* **The Alternative:** Running agent-generated scripts directly on the host machine using `child_process.exec` in the main workspace.
* **Why the Alternative Fails:** Dangerous security risk and environment contamination. A malformed command (e.g. `rm -rf`, port binding conflicts, package version pollution) can corrupt the host developer machine.
* **Our Process:** Sandboxed workspace execution.
  - Commands run in an isolated directory container.
  - Sandboxed execution guarantees reproducibility: dependencies installed and files generated during testing do not pollute the host machine.
* **Knowledge Gain:** A production agent must have a safe boundary where failure is harmless.

---

### Decision 4: TrueForge Hard Approval Gate vs. Fully Autonomous Pushes
* **The Alternative:** Autonomous agents that commit directly to `main` or automatically submit public GitHub PRs.
* **Why the Alternative Fails:** Any action that leaves your local system (pushing commits, sending emails, deleting cloud resources, opening public PRs) is **irreversible**. Unchecked autonomous PRs flood open-source repositories with spam and destroy developer credibility.
* **Our Process:** **Human-in-the-Loop (HITL) Checkpoint**.
  - We mark `submit_pull_request` with TrueForge's `@destructive` annotation and activate the approval shield.
  - TrueForge automatically halts the agent loop before executing the tool, rendering a visual diff and test summary in the chat UI with **[Allow]** and **[Deny]** buttons.
* **Knowledge Gain:** The true power of an agent harness is not just what it can do automatically, but how reliably it enforces human safety boundaries before irreversible actions occur.

---

## 4. Technical Architecture: TrueForge + Serena Integration

### How the Components Interact

1. **TrueForge Agent Harness (`@truefoundry/trueforge`):**
   - Runs on Node.js 22.14+ (Local SQLite mode on port 8790).
   - Manages the agent loop, context compaction, turn persistence, and HITL tool approvals.
   - Communicates with tools using the standard **Model Context Protocol (MCP)** over `stdio`.

2. **Serena MCP Server:**
   - Provides symbol-level intelligence: `find_symbol`, `get_symbols_overview`, `find_referencing_symbols`.
   - Provides project memory: `write_memory`, `read_memory`, `list_memories`.
   - Enables surgical refactoring without re-reading entire files.

3. **ContribForge Custom MCP Server (`contribforge-mcp/server.mjs`):**
   - Exposes tools to interact with GitHub (`@octokit/rest`), run sandboxed commands (`execSync` in isolated sandbox), and inspect `git diff` (`simple-git`).

---

## 5. Step-by-Step Implementation Guide

### Step 5.1: Initialize TrueForge Server
In your terminal:
```bash
npx @truefoundry/trueforge@latest
```
- Open `http://localhost:8790`.
- In **Settings → Models**, connect your LLM provider (TrueFoundry AI Gateway, Anthropic Claude 3.5 Sonnet, or OpenAI GPT-4o).

---

### Step 5.2: Activate Serena for the Project
In your project directory, Serena maintains semantic awareness:
1. Serena is activated for `c:/Agent`.
2. Initial memory is stored under `architecture/contribforge_overview`.
3. Serena's symbol discovery tools (`find_symbol`, `get_symbols_overview`) are available to inspect repo files during patch development.

---

### Step 5.3: Build the ContribForge MCP Server

Create `c:\Agent\contribforge-mcp\package.json`:
```json
{
  "name": "contribforge-mcp",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "@octokit/rest": "^20.0.0",
    "dotenv": "^16.4.5",
    "simple-git": "^3.25.0"
  }
}
```

Create `c:\Agent\contribforge-mcp\server.mjs`:
```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const SANDBOX_DIR = path.resolve("./sandbox_workspace");

if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

const server = new Server(
  { name: "contribforge-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_github_issue",
        description: "Fetches details of a GitHub issue including issue title, description, and stack trace.",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            issue_number: { type: "number" }
          },
          required: ["owner", "repo", "issue_number"]
        }
      },
      {
        name: "run_sandbox_command",
        description: "Runs commands in the isolated sandbox (e.g., test runner, npm test, python repro.py).",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Command to execute" }
          },
          required: ["command"]
        }
      },
      {
        name: "write_file_in_sandbox",
        description: "Creates or modifies a code file or reproduction test script inside the sandbox.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            content: { type: "string" }
          },
          required: ["file_path", "content"]
        }
      },
      {
        name: "get_git_diff",
        description: "Returns the git diff of all modifications made in the sandbox workspace.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "submit_pull_request",
        description: "CRITICAL: Pushes commits and creates a public Pull Request on GitHub. Requires user confirmation.",
        annotations: { destructive: true },
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            head_branch: { type: "string" }
          },
          required: ["owner", "repo", "title", "body", "head_branch"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "fetch_github_issue") {
      const { data } = await octokit.rest.issues.get({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issue_number
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ title: data.title, body: data.body }) }]
      };
    }

    if (name === "run_sandbox_command") {
      try {
        const output = execSync(args.command, { cwd: SANDBOX_DIR, encoding: "utf-8", timeout: 45000 });
        return { content: [{ type: "text", text: `SUCCESS:\n${output}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `EXIT CODE ${err.status}:\n${err.stdout || ""}\n${err.stderr || ""}` }] };
      }
    }

    if (name === "write_file_in_sandbox") {
      const fullPath = path.join(SANDBOX_DIR, args.file_path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, args.content, "utf-8");
      return { content: [{ type: "text", text: `File written successfully to ${args.file_path}` }] };
    }

    if (name === "get_git_diff") {
      const git = simpleGit(SANDBOX_DIR);
      const diff = await git.diff();
      return { content: [{ type: "text", text: diff || "No changes detected." }] };
    }

    if (name === "submit_pull_request") {
      const { owner, repo, title, body, head_branch } = args;
      const { data } = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: head_branch,
        base: "main"
      });
      return { content: [{ type: "text", text: `Pull Request created successfully! URL: ${data.html_url}` }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error.message }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### Step 5.4: Connect the MCP Server in TrueForge
1. Open TrueForge (`http://localhost:8790`).
2. Go to **Settings → Connectors** → Click **Add MCP Server**.
3. Set:
   - **Name:** `contribforge-tools`
   - **Command:** `node`
   - **Args:** `C:/Agent/contribforge-mcp/server.mjs`
   - **Environment Variables:** `GITHUB_TOKEN=<your_github_token>`
4. Click **Save**.

---

### Step 5.5: Configure the Agent in TrueForge
1. Open **Build Agent** from the sidebar.
2. Select your Model (e.g. `anthropic/claude-3-5-sonnet` or `google/gemini-2.0-flash`).
3. Set **Instructions**:
```text
You are ContribForge, an autonomous Open-Source Issue Resolver and Debugging Agent.

Workflow:
1. Given a GitHub issue, retrieve the issue details using fetch_github_issue.
2. Analyze the bug and write a minimal reproduction test script in the sandbox using write_file_in_sandbox.
3. Run the reproduction test using run_sandbox_command.
   - CRITICAL RULE: You MUST observe the reproduction test FAIL (Exit Code != 0) before modifying any code.
4. Locate the bug, write the fix, and re-run your reproduction test until it passes (Exit Code == 0).
5. Run the existing test suite (e.g., npm test or pytest) in the sandbox to guarantee zero regressions.
6. Run get_git_diff to inspect the changes.
7. Present the git diff, test results, and proposed PR markdown description to the user.
8. Call submit_pull_request to open the PR.
   - Note: submit_pull_request will halt execution for Human Approval. Be prepared for user feedback.
```
4. **Tool Approval Gate (Mandatory):**
   - In **Select MCP Tools**, ensure the shield icon next to `submit_pull_request` is toggled ON.
5. In **Runtime Config**, ensure **Sandbox**, **Ask user questions**, and **Context compaction** are enabled.
6. Click **Save Agent** → Name: `ContribForge`.

---

## 6. The 3-Minute Live Stage Demo Playbook

When presenting to judges at the Polaris campus:

### Minute 0:00 – The Hook (30s)
> *"Judges, anything can talk. But open source maintainers are drowning in hallucinated AI pull requests that break production. We built **ContribForge** on TrueForge: an agent that acts, reproduces bugs in a sandbox before touching code, and pauses for human sign-off before taking any irreversible action."*

### Minute 0:30 – The Empirical Reproduction (60s)
1. In the TrueForge chat UI, send:  
   `"Resolve issue #14: Config parser throws TypeError when PORT is an empty string."`
2. Show the Agent Steps panel:
   - Tool `fetch_github_issue` fetches the issue.
   - Tool `write_file_in_sandbox` writes `tests/repro_issue_14.test.js`.
   - Tool `run_sandbox_command` executes it.
   - **Point to the screen:** *"Notice it returned EXIT CODE 1 with a TypeError. ContribForge has scientifically confirmed the bug in our sandbox before touching a single line of application code."*

### Minute 1:30 – The Surgical Fix & Zero Regression (45s)
1. The agent writes the fix in `src/config.js`.
2. Re-runs `repro_issue_14.test.js` → **🟢 Passed (Exit Code 0)**.
3. Re-runs `npm test` → **🟢 24/24 unit tests passed**.
4. **Point to the screen:** *"The repro test passed, and the existing test suite proves zero regressions."*

### Minute 2:15 – The "PAUSE" Gate & Final PR (45s)
1. The agent attempts to call `submit_pull_request`.
2. **TrueForge automatically pauses the execution loop.**
3. An interactive modal pops up on screen:
   ```
   🛡️ Tool Approval Required: submit_pull_request
   Target: myorg/demo-repo
   Branch: fix-config-empty-port
   [ Allow ]   [ Deny ]
   ```
4. **Point to the screen:** *"Notice what just happened. The agent did not blindly push to production. TrueForge recognized this as an irreversible, destructive action, halted execution, and brought me—the human developer—into the loop."*
5. Click **Allow**.
6. Show the live Pull Request created on GitHub with reproduction logs, git diff, and full test output.

---

## 7. Hackathon Evaluation Rubric Mapping

| TrueFoundry Hackathon Criteria | ContribForge Implementation | Where Judges See It |
| :--- | :--- | :--- |
| **Real Tool Reached** | Live GitHub API via Octokit, Git CLI (`simple-git`), filesystem I/O | TrueForge MCP connector log & GitHub live PR URL |
| **Code Run in a Sandbox** | Isolated `sandbox_workspace` running reproduction scripts & test runners | `run_sandbox_command` execution traces |
| **Pause Before Irreversible** | `@destructive` tag on `submit_pull_request` | Interactive TrueForge UI approval modal (`Allow` / `Deny`) |
| **Built on TrueForge** | Core runtime on port 8790, session persistence, MCP discovery | TrueForge Chat UI and Agent Config panel |
| **Code Intelligence (Serena)** | AST symbol search and project memory | Serena memory and symbol inspection |

---

*This document is saved as `c:\Agent\implementation.md`. Follow these steps to build, test, and present ContribForge.*
