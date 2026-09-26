document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const pipelineStatus = document.getElementById("pipelineStatus");
  const terminalOutput = document.getElementById("terminalOutput");
  const termTimer = document.getElementById("termTimer");
  const diffView = document.getElementById("diffView");
  const diffStatPill = document.getElementById("diffStatPill");

  // Modal elements
  const approvalModal = document.getElementById("approvalModal");
  const approveBtn = document.getElementById("approveBtn");
  const denyBtn = document.getElementById("denyBtn");
  const modalTarget = document.getElementById("modalTarget");
  const modalBranch = document.getElementById("modalBranch");
  const modalPrTitle = document.getElementById("modalPrTitle");
  const modalPrBody = document.getElementById("modalPrBody");

  // Badges & Nodes
  const badgeRed = document.getElementById("badgeRed");
  const badgeGreen = document.getElementById("badgeGreen");
  const badgeDeployment = document.getElementById("badgeDeployment");

  // Success bar
  const prSuccessBar = document.getElementById("prSuccessBar");
  const prSuccessLink = document.getElementById("prSuccessLink");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  let timerInterval = null;
  let startTime = null;

  // Step to Node mapping
  const stepNodeMap = {
    "Sandbox Initialized": 0,
    "Fetching GitHub Issue Context": 0,
    "Issue Context Extracted": 0,
    "Synthesizing Reproduction Test Script": 1,
    "Reproduction Test Authored": 1,
    "Executing Reproduction in Sandbox (Empirical Red Check)": 1,
    "Defect Successfully Confirmed (🔴 RED)": 1,
    "Synthesizing Surgical Patch": 2,
    "Patch Applied in Sandbox": 2,
    "Verifying Reproduction Passes (Empirical Green Check)": 3,
    "Reproduction Test Passed (🟢 GREEN)": 3,
    "Running Full Test Suite (Zero-Regression Check)": 3,
    "Full Test Suite Passed: Zero Regressions": 3,
    "🛡️ PAUSED: Human Approval Required for Irreversible Action": 4,
    "User Approval Granted: Executing submit_pull_request": 5,
    "Pull Request Successfully Created!": 5
  };

  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    termTimer.textContent = `${mins}:${secs}`;
  }

  function appendTerminal(text, type = "t-dim") {
    const line = document.createElement("div");
    line.className = `t-line ${type}`;
    line.textContent = `> ${text}`;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function setNodeActive(nodeIndex) {
    for (let i = 0; i <= 5; i++) {
      const el = document.getElementById(`node-${i}`);
      if (!el) continue;
      if (i < nodeIndex) {
        el.className = "dag-node completed";
      } else if (i === nodeIndex) {
        el.className = "dag-node active" + (i === 4 ? " dag-node-gated" : "");
      } else {
        el.className = "dag-node" + (i === 4 ? " dag-node-gated" : "");
      }
    }
  }

  function renderDiff(diffText) {
    if (!diffText || diffText.includes("No changes detected")) {
      return;
    }

    const lines = diffText.split("\n");
    const formatted = lines
      .map((line) => {
        const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (line.startsWith("+") && !line.startsWith("+++")) {
          return `<span class="diff-line diff-add">${escaped}</span>`;
        }
        if (line.startsWith("-") && !line.startsWith("---")) {
          return `<span class="diff-line diff-del">${escaped}</span>`;
        }
        return `<span class="diff-line diff-ctx">${escaped}</span>`;
      })
      .join("\n");

    diffView.innerHTML = `<code>${formatted}</code>`;
    const addCount = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const delCount = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    diffStatPill.textContent = `+${addCount} -${delCount}`;
  }

  // WebSocket Connection to Orchestrator
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    appendTerminal("Connected to ContribForge runtime engine over WebSocket.", "t-info");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "step_update") {
        const { step } = data;
        const nodeIdx = stepNodeMap[step.title];
        if (typeof nodeIdx === "number") {
          setNodeActive(nodeIdx);
        }

        let type = "t-dim";
        if (step.status === "IN_PROGRESS") type = "t-info";
        if (step.status === "SUCCESS") type = "t-cmd";
        if (step.status === "AWAITING_APPROVAL") type = "t-gate";

        appendTerminal(`${step.title}`, type);

        if (step.title.includes("Defect Successfully Confirmed")) {
          badgeRed.textContent = "FAILING TEST (CONFIRMED 🔴)";
          badgeRed.className = "node-badge badge-red";
          if (step.stderrSnippet) appendTerminal(step.stderrSnippet, "t-red");
        }

        if (step.title.includes("Reproduction Test Passed")) {
          badgeGreen.textContent = "PASSED TEST (VERIFIED 🟢)";
          badgeGreen.className = "node-badge badge-green";
          if (step.stdout) appendTerminal(step.stdout, "t-green");
        }

        if (step.testsPassed) {
          appendTerminal(`↳ Regression Suite: ${step.testsPassed}`, "t-green");
        }

        if (step.diff) renderDiff(step.diff);
      }

      if (data.type === "approval_required") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> PAUSED (HITL GATE)`;
        pipelineStatus.className = "status-indicator-badge gated";

        modalTarget.textContent = `${data.payload.owner}/${data.payload.repo}`;
        modalBranch.textContent = data.payload.head_branch;
        modalPrTitle.textContent = data.payload.title;
        modalPrBody.textContent = data.payload.body.slice(0, 320) + "...";

        if (data.diff) renderDiff(data.diff);

        approvalModal.classList.remove("hidden");
        appendTerminal("🛡️ TRUEFORGE HARNESS: Execution paused at Human-in-the-Loop gate.", "t-gate");
      }

      if (data.type === "workflow_completed") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> COMPLETED`;
        pipelineStatus.className = "status-indicator-badge completed";
        runBtn.disabled = false;
        clearInterval(timerInterval);

        setNodeActive(5);
        badgeDeployment.textContent = "PR #503 OPENED ✔";
        badgeDeployment.className = "node-badge badge-green";

        const { result } = data;
        prSuccessLink.href = result.pr_url;
        prSuccessLink.textContent = `View PR #${result.pr_number} on GitHub →`;
        prSuccessBar.classList.remove("hidden");
        appendTerminal(`🎉 Pull Request created: ${result.pr_url}`, "t-green");
      }

      if (data.type === "workflow_error") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> ERROR`;
        pipelineStatus.className = "status-indicator-badge";
        runBtn.disabled = false;
        clearInterval(timerInterval);
        appendTerminal(`✖ Error: ${data.error}`, "t-red");
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  };

  // Run Workflow Function
  async function triggerWorkflow() {
    if (runBtn.disabled) return;
    runBtn.disabled = true;
    prSuccessBar.classList.add("hidden");
    pipelineStatus.innerHTML = `<span class="pulse-dot"></span> RUNNING`;
    pipelineStatus.className = "status-indicator-badge running";

    terminalOutput.innerHTML = "";
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    setNodeActive(0);

    appendTerminal("Initiating Test-Driven Agentics (TDA) resolution loop for Issue #14...", "t-info");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "truefoundry", repo: "micro-config", issueNumber: 14 })
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || "Failed to start workflow");
      }
    } catch (err) {
      appendTerminal(`Failed to start: ${err.message}`, "t-red");
      runBtn.disabled = false;
    }
  }

  runBtn.addEventListener("click", triggerWorkflow);

  // Approval Handlers
  approveBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User approved action: Authorizing submit_pull_request...", "t-green");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: true })
    });
  });

  denyBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User denied action: PR creation halted.", "t-red");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: false })
    });
  });

  closeSuccessBtn.addEventListener("click", () => {
    prSuccessBar.classList.add("hidden");
  });

  // Global Keyboard Shortcuts (⌘R / Ctrl+R to run, ⌘↵ / Ctrl+Enter to approve)
  window.addEventListener("keydown", (e) => {
    const isCmd = e.metaKey || e.ctrlKey;
    if (isCmd && e.key === "r" && !runBtn.disabled) {
      e.preventDefault();
      triggerWorkflow();
    }
    if (isCmd && e.key === "Enter" && !approvalModal.classList.contains("hidden")) {
      e.preventDefault();
      approveBtn.click();
    }
    if (e.key === "Escape" && !approvalModal.classList.contains("hidden")) {
      e.preventDefault();
      denyBtn.click();
    }
  });
});
