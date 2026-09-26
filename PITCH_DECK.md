# ContribForge: The 3-Minute Hackathon Winning Pitch Deck
### *TrueFoundry × Polaris Hackathon — Saturday, 26 September 2026*

---

## 🎯 The 30-Second Elevator Pitch
> *"Judges, anything can talk. But open-source maintainers are currently drowning in a flood of unverified, hallucinated AI pull requests that break production. We built **ContribForge** on TrueForge: an agent that acts, scientifically reproduces bugs in an isolated sandbox before touching code, and halts before irreversible actions like submitting a public PR until a human signs off."*

---

## ⏱️ Minute-by-Minute Stage Presentation Script

### [0:00 - 0:45] The Problem & The Mandate
* **Speaker:**
  > *"Every student and junior engineer wants to contribute to open-source or debug complex projects. But modern repos have thousands of files, and reading code manually is intimidating. Worse, naive LLMs produce code that looks syntactically plausible but fails edge cases.*
  > 
  > *The TrueFoundry hackathon asked for an agent that reaches real systems, runs code safely in a sandbox, and knows when to stop and ask. That is the foundational architecture of **ContribForge**."*

### [0:45 - 1:45] The Live Demo: Empirical Red & Green
* **Action:** Click **"Run Issue #14 Demo"** on the ContribForge Web Dashboard (`http://localhost:4000`).
* **Speaker:**
  > *"Watch our dashboard in real time. We give ContribForge Issue #14: an uncaught TypeError in a config parser.
  > 
  > Notice what the agent does first. It does NOT jump to writing a patch. It practices **Test-Driven Agentics**:
  > 1. It synthesizes a reproduction script in the sandbox.
  > 2. It runs the test and confirms it **fails (🔴 RED)**. That gives us empirical proof the bug is real.
  > 3. Now, using symbol-level navigation from **Serena**, it locates `parsePortConfig`, applies a defensive guard, and re-executes the repro script.
  > 4. **Green (🟢)!** The repro passes, and it immediately runs the full test suite—5 out of 5 tests passing with zero regressions."*

### [1:45 - 2:30] The Climax: The TrueForge "PAUSE" Gate
* **Action:** The screen pauses and the **🛡️ Human-in-the-Loop Checkpoint Modal** appears.
* **Speaker:**
  > *"Now, look at the screen right now. The agent wanted to commit and create a public Pull Request on GitHub. But in open source, pushing commits and opening PRs is **irreversible**.
  > 
  > TrueForge's harness detected that `submit_pull_request` is marked as `@destructive`. It **halted execution**.
  > It brings me—the human developer—into the loop. It presents the exact git diff, the reproduction proof, and the PR body.
  > 
  > If I click 'Reject', nothing touches GitHub. When I click **'Allow & Create Pull Request'**..."*
* **Action:** Click **"Allow & Create Pull Request"**.
* **Speaker:**
  > *"...the agent safely creates the Pull Request, verified and ready for maintainer review."*

### [2:30 - 3:00] Business Impact & Future Vision
* **Speaker:**
  > *"For open-source maintainers, ContribForge eliminates AI PR spam by attaching cryptographic sandbox proof that a bug was reproduced and fixed without regression. For students, it turns intimidating codebases into accessible learning environments.
  > 
  > Built with TrueForge, powered by Serena, verified by sandboxing. Thank you!"*

---

## 💡 Anticipated Judges' Questions & Bulletproof Answers

#### Q1: "How is this different from Cursor or GitHub Copilot Workspace?"
* **Answer:** *"Copilot and Cursor are suggestions engines—they suggest diffs in your editor. ContribForge is an **autonomous agent that acts**. It doesn't ask you to test the code; it authors its own reproduction harness, executes it in a hermetic sandbox, verifies that the bug failed first, and verifies the whole test suite passes before ever asking for human sign-off."*

#### Q2: "How does TrueForge fit into the architecture?"
* **Answer:** *"TrueForge serves as our agent harness. It provides the MCP connector layer that exposes our GitHub and sandbox tools, handles context compaction and token efficiency, and critically, enforces the **Human-in-the-Loop approval barrier** on tools annotated with `@destructive`."*

#### Q3: "What prevents the agent from running malicious or runaway code in the sandbox?"
* **Answer:** *"The sandbox directory is strictly bounded with path traversal checks, execution timeouts (45 seconds), and isolated process environments. It cannot touch files outside its sandbox workspace."*

#### Q4: "Why use Serena?"
* **Answer:** *"Serena provides language-server-level AST awareness (`find_symbol`, `get_symbols_overview`). Instead of dumping 50 files into the LLM context and blowing our token budget, the agent queries specific symbol definitions and references on demand, keeping turns fast and cheap."*
