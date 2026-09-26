import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { fetchGitHubIssue } from "../contribforge-mcp/tools/github.mjs";
import {
  initSandbox,
  runSandboxCommand,
  writeSandboxFile,
  readSandboxFile,
  getSandboxPath
} from "../contribforge-mcp/tools/sandbox.mjs";
import { getGitDiff } from "../contribforge-mcp/tools/diff.mjs";
import { submitPullRequest } from "../contribforge-mcp/tools/pr.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_REPO_DIR = path.resolve(__dirname, "../demo-target-repo");

export class ContribForgeEngine {
  constructor(eventCallback = () => {}) {
    this.emit = eventCallback;
    this.state = "IDLE";
    this.currentSession = null;
    this.pendingApprovalResolve = null;
    this.pendingApprovalReject = null;
  }

  resetSandbox() {
    const sandboxDir = getSandboxPath();
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    initSandbox(DEMO_REPO_DIR);
  }

  async runWorkflow({ owner = "truefoundry", repo = "micro-config", issueNumber = 14 }) {
    this.state = "RUNNING";
    const sessionId = `turn_${Date.now()}`;
    this.currentSession = {
      id: sessionId,
      owner,
      repo,
      issueNumber,
      startTime: Date.now(),
      steps: []
    };

    const addStep = (title, status, details = {}) => {
      const step = { title, status, timestamp: new Date().toISOString(), ...details };
      this.currentSession.steps.push(step);
      this.emit({ type: "step_update", sessionId, step });
      return step;
    };

    try {
      // Step 0: Ensure fresh sandbox
      this.resetSandbox();
      addStep("Sandbox Initialized", "SUCCESS", {
        message: "Clean workspace isolated from host environment."
      });

      // Step 1: Issue Reconnaissance
      addStep("Fetching GitHub Issue Context", "IN_PROGRESS");
      const issue = await fetchGitHubIssue(owner, repo, issueNumber);
      addStep("Issue Context Extracted", "SUCCESS", {
        issueTitle: issue.title,
        author: issue.author,
        labels: issue.labels,
        descriptionPreview: issue.body.slice(0, 250) + "..."
      });

      // Step 2: Author Minimal Reproduction Test (TDA Step 1)
      addStep("Synthesizing Reproduction Test Script", "IN_PROGRESS");
      const reproTestCode = `import test from "node:test";
import assert from "node:assert/strict";
import { parsePortConfig, loadConfig } from "../src/config-parser.js";

// Reproduction Test for Issue #${issueNumber}
test("Issue #${issueNumber} REPRO: parsePortConfig handles undefined gracefully", () => {
  assert.equal(parsePortConfig(undefined), 3000, "Should default to 3000 when PORT is undefined");
});

test("Issue #${issueNumber} REPRO: parsePortConfig handles empty string gracefully", () => {
  assert.equal(parsePortConfig(""), 3000, "Should default to 3000 when PORT is empty string");
});
`;

      writeSandboxFile("test/repro_issue_14.test.js", reproTestCode);
      addStep("Reproduction Test Authored", "SUCCESS", {
        file: "test/repro_issue_14.test.js",
        lines: reproTestCode.split("\n").length
      });

      // Step 3: Run Reproduction in Sandbox (Must Fail!)
      addStep("Executing Reproduction in Sandbox (Empirical Red Check)", "IN_PROGRESS");
      const reproResultRed = runSandboxCommand("node --test test/repro_issue_14.test.js");

      if (reproResultRed.success) {
        throw new Error("Sanity check failed: Reproduction test unexpectedly passed on unmodified code!");
      }

      addStep("Defect Successfully Confirmed (🔴 RED)", "SUCCESS", {
        exitCode: reproResultRed.exitCode,
        stderrSnippet: reproResultRed.stderr.split("\n").slice(0, 5).join("\n"),
        stdoutSnippet: reproResultRed.stdout.split("\n").slice(0, 6).join("\n"),
        verdict: "Bug reproduced exactly as described in Issue #" + issueNumber
      });

      // Step 4: Apply Surgical Fix to Source Code
      addStep("Synthesizing Surgical Patch", "IN_PROGRESS");
      const fixedConfigParserCode = `/**
 * micro-config: Configuration Loader
 * Handles parsing environment variables and configuration objects.
 */

export function parseHost(rawHost) {
  if (!rawHost || typeof rawHost !== "string" || rawHost.trim() === "") {
    return "127.0.0.1";
  }
  return rawHost.trim().toLowerCase();
}

export function parseLogLevel(rawLevel) {
  const allowed = ["debug", "info", "warn", "error"];
  const level = (rawLevel || "info").toLowerCase();
  return allowed.includes(level) ? level : "info";
}

/**
 * Parses and validates port configurations.
 * Fixed: Handles undefined, null, and empty strings gracefully, defaulting to 3000.
 */
export function parsePortConfig(rawPort) {
  if (rawPort === undefined || rawPort === null || (typeof rawPort === "string" && rawPort.trim() === "")) {
    return 3000;
  }
  const trimmed = typeof rawPort === "string" ? rawPort.trim() : String(rawPort);
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(\`Invalid port: "\${rawPort}"\`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    host: parseHost(env.HOST),
    port: parsePortConfig(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    dbUrl: env.DATABASE_URL || "sqlite://:memory:"
  };
}
`;

      writeSandboxFile("src/config-parser.js", fixedConfigParserCode);
      addStep("Patch Applied in Sandbox", "SUCCESS", {
        file: "src/config-parser.js"
      });

      // Step 5: Verify Reproduction Test Now Passes (🟢 GREEN)
      addStep("Verifying Reproduction Passes (Empirical Green Check)", "IN_PROGRESS");
      const reproResultGreen = runSandboxCommand("node --test test/repro_issue_14.test.js");

      if (!reproResultGreen.success) {
        throw new Error(`Patch verification failed: ${reproResultGreen.stderr}`);
      }

      addStep("Reproduction Test Passed (🟢 GREEN)", "SUCCESS", {
        exitCode: reproResultGreen.exitCode,
        duration: `${reproResultGreen.durationMs}ms`,
        stdout: reproResultGreen.stdout
      });

      // Step 6: Full Regression Test Suite
      addStep("Running Full Test Suite (Zero-Regression Check)", "IN_PROGRESS");
      const fullSuiteResult = runSandboxCommand("node --test test/*.test.js");

      if (!fullSuiteResult.success) {
        throw new Error(`Regression detected! Full test suite failed: ${fullSuiteResult.stderr}`);
      }

      addStep("Full Test Suite Passed: Zero Regressions", "SUCCESS", {
        testsPassed: "5/5 tests passing",
        duration: `${fullSuiteResult.durationMs}ms`,
        summary: "Both original functionality and edge cases verified."
      });

      // Step 7: Inspect Git Diff
      const diffOutput = await getGitDiff();
      addStep("Git Diff Generated", "SUCCESS", {
        diff: diffOutput.diff,
        filesChanged: diffOutput.filesChanged
      });

      // Step 8: THE PAUSE GATE (Human-in-the-Loop Approval Required)
      this.state = "PAUSED_FOR_APPROVAL";
      const prPayload = {
        owner,
        repo,
        title: `fix(config): default port to 3000 when PORT is unset or empty string (resolves #${issueNumber})`,
        body: `### Summary of Changes
Resolves #${issueNumber} where \`parsePortConfig\` threw \`TypeError: Cannot read properties of undefined (reading 'trim')\` when \`PORT\` was unset or empty string.

### Root Cause
\`rawPort.trim()\` assumed the input was always a non-empty string. When passed \`undefined\`, the process crashed.

### Solution
Added defensive guard checking for \`undefined\`, \`null\`, and \`""\` to return default port \`3000\`.

### Test Verification (Hermetic Sandbox)
- Authored \`test/repro_issue_14.test.js\` confirming reproduction failure (Exit Code 1).
- Applied surgical fix in \`src/config-parser.js\`.
- Re-tested reproduction script: 🟢 Passed.
- Executed full test suite: 🟢 5/5 tests passing (0 regressions).`,
        head_branch: `fix/issue-${issueNumber}-empty-port`
      };

      addStep("🛡️ PAUSED: Human Approval Required for Irreversible Action", "AWAITING_APPROVAL", {
        tool: "submit_pull_request",
        reason: "Pushing commits and opening a public GitHub PR modifies upstream state.",
        payload: prPayload
      });

      this.emit({
        type: "approval_required",
        sessionId,
        payload: prPayload,
        diff: diffOutput.diff
      });

      // Wait for human approval signal!
      const approved = await new Promise((resolve, reject) => {
        this.pendingApprovalResolve = resolve;
        this.pendingApprovalReject = reject;
      });

      if (!approved) {
        addStep("Action Denied by User", "REJECTED", {
          message: "Human operator rejected the Pull Request. State preserved in sandbox."
        });
        this.state = "REJECTED";
        return { status: "REJECTED", session: this.currentSession };
      }

      // Step 9: Action Approved - Execute Irreversible PR Creation
      addStep("User Approval Granted: Executing submit_pull_request", "IN_PROGRESS");
      const prResult = await submitPullRequest(prPayload);

      addStep("Pull Request Successfully Created!", "COMPLETED", {
        prUrl: prResult.pr_url,
        prNumber: prResult.pr_number,
        mode: prResult.mode,
        message: prResult.message
      });

      this.state = "COMPLETED";
      this.emit({
        type: "workflow_completed",
        sessionId,
        result: prResult
      });

      return { status: "COMPLETED", session: this.currentSession, result: prResult };
    } catch (err) {
      addStep("Execution Halted on Error", "ERROR", {
        error: err.message,
        stack: err.stack
      });
      this.state = "ERROR";
      this.emit({ type: "workflow_error", sessionId, error: err.message });
      throw err;
    }
  }

  handleApprovalDecision(allow) {
    if (this.pendingApprovalResolve) {
      this.pendingApprovalResolve(Boolean(allow));
      this.pendingApprovalResolve = null;
      this.pendingApprovalReject = null;
    }
  }
}
