document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const pipelineStatus = document.getElementById("pipelineStatus");
  const terminalOutput = document.getElementById("terminalOutput");
  const terminalTimer = document.getElementById("terminalTimer");
  const diffView = document.getElementById("diffView");
  const diffBadge = document.getElementById("diffBadge");

  // Modal elements
  const approvalModal = document.getElementById("approvalModal");
  const approveBtn = document.getElementById("approveBtn");
  const denyBtn = document.getElementById("denyBtn");
  const modalTarget = document.getElementById("modalTarget");
  const modalBranch = document.getElementById("modalBranch");
  const modalPrTitle = document.getElementById("modalPrTitle");
  const modalPrBody = document.getElementById("modalPrBody");

  // Success bar
  const prSuccessBar = document.getElementById("prSuccessBar");
  const prSuccessLink = document.getElementById("prSuccessLink");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  let timerInterval = null;
  let startTime = null;

  // Step mapping
  const stepMap = {
    "Sandbox Initialized": 0,
    "Fetching GitHub Issue Context": 1,
    "Issue Context Extracted": 1,
    "Synthesizing Reproduction Test Script": 2,
    "Reproduction Test Authored": 2,
    "Executing Reproduction in Sandbox (Empirical Red Check)": 2,
    "Defect Successfully Confirmed (🔴 RED)": 2,
    "Synthesizing Surgical Patch": 3,
    "Patch Applied in Sandbox": 3,
    "Verifying Reproduction Passes (Empirical Green Check)": 4,
    "Reproduction Test Passed (🟢 GREEN)": 4,
    "Running Full Test Suite (Zero-Regression Check)": 4,
    "Full Test Suite Passed: Zero Regressions": 4,
    "🛡️ PAUSED: Human Approval Required for Irreversible Action": 5,
    "User Approval Granted: Executing submit_pull_request": 6,
    "Pull Request Successfully Created!": 6
  };

  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    terminalTimer.textContent = `${mins}:${secs}`;
  }

  function appendTerminal(text, type = "info") {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = `term-line ${type}`;
    line.textContent = `[${time}] ${text}`;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function setStepActive(stepIndex) {
    for (let i = 0; i <= 6; i++) {
      const el = document.getElementById(`step-${i}`);
      if (!el) continue;
      if (i < stepIndex) {
        el.className = "step-item completed";
      } else if (i === stepIndex) {
        el.className = "step-item active";
      } else {
        el.className = "step-item";
      }
    }
  }

  function renderDiff(diffText) {
    if (!diffText || diffText.includes("No changes detected")) {
      diffView.innerHTML = `<code>// No modifications detected in sandbox.</code>`;
      diffBadge.textContent = "0 changes";
      return;
    }

    const lines = diffText.split("\n");
    const formatted = lines
      .map((line) => {
        const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (line.startsWith("+") && !line.startsWith("+++")) {
          return `<span style="color: #10b981; background: rgba(16,185,129,0.1);">${escaped}</span>`;
        }
        if (line.startsWith("-") && !line.startsWith("---")) {
          return `<span style="color: #ef4444; background: rgba(239,68,68,0.1);">${escaped}</span>`;
        }
        return `<span>${escaped}</span>`;
      })
      .join("\n");

    diffView.innerHTML = `<code>${formatted}</code>`;
    const count = lines.filter((l) => l.startsWith("+") || l.startsWith("-")).length;
    diffBadge.textContent = `${count} diff lines`;
  }

  // WebSocket Connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    appendTerminal("Connected to ContribForge Orchestrator via WebSocket.", "info");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "step_update") {
        const { step } = data;
        const stepIdx = stepMap[step.title];
        if (typeof stepIdx === "number") {
          setStepActive(stepIdx);
        }

        let type = "info";
        if (step.status === "IN_PROGRESS") type = "in-progress";
        if (step.status === "SUCCESS") type = "success";
        if (step.status === "ERROR") type = "error";
        if (step.status === "AWAITING_APPROVAL") type = "gate";

        appendTerminal(`${step.title}`, type);

        if (step.verdict) appendTerminal(`↳ ${step.verdict}`, "success");
        if (step.testsPassed) appendTerminal(`↳ ${step.testsPassed} (${step.summary})`, "success");
        if (step.diff) renderDiff(step.diff);
      }

      if (data.type === "approval_required") {
        pipelineStatus.textContent = "PAUSED (WAITING APPROVAL)";
        pipelineStatus.className = "status-tag status-paused";

        modalTarget.textContent = `${data.payload.owner}/${data.payload.repo}`;
        modalBranch.textContent = data.payload.head_branch;
        modalPrTitle.textContent = data.payload.title;
        modalPrBody.textContent = data.payload.body.slice(0, 300) + "...";

        if (data.diff) renderDiff(data.diff);

        approvalModal.classList.remove("hidden");
        appendTerminal("🛡️ EXECUTION PAUSED: Waiting for operator sign-off.", "gate");
      }

      if (data.type === "workflow_completed") {
        pipelineStatus.textContent = "COMPLETED";
        pipelineStatus.className = "status-tag status-completed";
        runBtn.disabled = false;
        clearInterval(timerInterval);

        setStepActive(6);
        const { result } = data;
        prSuccessLink.href = result.pr_url;
        prSuccessLink.textContent = result.pr_url;
        prSuccessBar.classList.remove("hidden");
        appendTerminal(`🎉 Pull Request created: ${result.pr_url}`, "success");
      }

      if (data.type === "workflow_error") {
        pipelineStatus.textContent = "ERROR";
        pipelineStatus.className = "status-tag status-idle";
        runBtn.disabled = false;
        clearInterval(timerInterval);
        appendTerminal(`✖ Error: ${data.error}`, "error");
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  };

  // Run Workflow Action
  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    prSuccessBar.classList.add("hidden");
    pipelineStatus.textContent = "RUNNING";
    pipelineStatus.className = "status-tag status-running";
    terminalOutput.innerHTML = "";
    diffView.innerHTML = `<code>// Executing sandbox pipeline...</code>`;

    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    setStepActive(0);

    appendTerminal("Initiating ContribForge Test-Driven Resolution Loop for Issue #14...", "info");

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
      appendTerminal(`Failed to start: ${err.message}`, "error");
      runBtn.disabled = false;
    }
  });

  // Approval Handlers
  approveBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User clicked [Allow]: Authorizing submit_pull_request...", "success");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: true })
    });
  });

  denyBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User clicked [Deny]: Pull Request creation rejected.", "error");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: false })
    });
  });

  closeSuccessBtn.addEventListener("click", () => {
    prSuccessBar.classList.add("hidden");
  });
});
