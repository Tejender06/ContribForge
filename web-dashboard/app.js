document.addEventListener("DOMContentLoaded", () => {
  // Action & Status Elements
  const runBtn = document.getElementById("runBtn");
  const runBtnText = document.getElementById("runBtnText");
  const cancelBtn = document.getElementById("cancelBtn");
  const pipelineStatus = document.getElementById("pipelineStatus");
  const terminalOutput = document.getElementById("terminalOutput");
  const termTimer = document.getElementById("termTimer");
  const copyLogsBtn = document.getElementById("copyLogsBtn");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Diff Elements
  const diffView = document.getElementById("diffView");
  const diffStatPill = document.getElementById("diffStatPill");
  const diffFilePath = document.getElementById("diffFilePath");

  // Issue & Topbar Elements
  const topbarRepoBadge = document.getElementById("topbarRepoBadge");
  const issueSelect = document.getElementById("issueSelect");
  const issueUrlInput = document.getElementById("issueUrlInput");
  const loadUrlBtn = document.getElementById("loadUrlBtn");

  // Approval Modal Elements
  const approvalModal = document.getElementById("approvalModal");
  const approveBtn = document.getElementById("approveBtn");
  const denyBtn = document.getElementById("denyBtn");
  const modalTarget = document.getElementById("modalTarget");
  const modalBranch = document.getElementById("modalBranch");
  const modalPrTitle = document.getElementById("modalPrTitle");
  const modalPrBody = document.getElementById("modalPrBody");

  // Settings Modal Elements
  const settingsModal = document.getElementById("settingsModal");
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const settingsNavBtn = document.getElementById("settingsNavBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const geminiKeyInput = document.getElementById("geminiKeyInput");
  const githubTokenInput = document.getElementById("githubTokenInput");
  const modelSelect = document.getElementById("modelSelect");
  const toggleGeminiVis = document.getElementById("toggleGeminiVis");
  const toggleGithubVis = document.getElementById("toggleGithubVis");
  const geminiStatusBadge = document.getElementById("geminiStatusBadge");
  const githubStatusBadge = document.getElementById("githubStatusBadge");
  const keyIndicatorDot = document.getElementById("keyIndicatorDot");

  // Help Modal Elements
  const helpModal = document.getElementById("helpModal");
  const helpNavBtn = document.getElementById("helpNavBtn");
  const closeHelpBtn = document.getElementById("closeHelpBtn");

  // Badges & Nodes
  const badgeRed = document.getElementById("badgeRed");
  const badgeGreen = document.getElementById("badgeGreen");
  const badgeDeployment = document.getElementById("badgeDeployment");
  const node0Desc = document.getElementById("node0Desc");

  // Success Banner Elements
  const prSuccessBar = document.getElementById("prSuccessBar");
  const prSuccessLink = document.getElementById("prSuccessLink");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  let timerInterval = null;
  let startTime = null;
  let currentLogCategory = "all";

  // Step to Node Mapping
  const stepNodeMap = {
    "Sandbox Initialized": 0,
    "Fetching GitHub Issue Context": 0,
    "Issue Context Extracted": 0,
    "Reasoning with gemini-2.5-flash": 1,
    "Reasoning with gemini-1.5-pro": 1,
    "Reasoning with gpt-4o": 1,
    "Gemini Synthesized Reproduction Test": 1,
    "Activating Autonomous Heuristic AST Engine": 1,
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

  // Preset Issue Catalog
  const PRESET_ISSUES = {
    "14": {
      owner: "truefoundry",
      repo: "micro-config",
      number: 14,
      url: "https://github.com/truefoundry/micro-config/issues/14",
      desc: "PORT TypeError crash when unset or empty string"
    },
    "12": {
      owner: "truefoundry",
      repo: "micro-config",
      number: 12,
      url: "https://github.com/truefoundry/micro-config/issues/12",
      desc: "parseHost scheme prefix stripping for socket bind"
    }
  };

  // 1. Settings Synchronization
  function loadLocalSettings() {
    const savedGemini = localStorage.getItem("contribforge_gemini_key") || "";
    const savedGithub = localStorage.getItem("contribforge_github_token") || "";
    const savedModel = localStorage.getItem("contribforge_model") || "gemini-2.5-flash";

    geminiKeyInput.value = savedGemini;
    githubTokenInput.value = savedGithub;
    modelSelect.value = savedModel;

    updateKeyStatusBadges(savedGemini, savedGithub);
  }

  function updateKeyStatusBadges(geminiKey, githubToken) {
    if (geminiKey && geminiKey.trim().startsWith("AIzaSy")) {
      geminiStatusBadge.textContent = "Active (Gemini 2.5 Flash)";
      geminiStatusBadge.className = "setting-badge configured";
      keyIndicatorDot.className = "key-indicator-dot active";
    } else if (geminiKey && geminiKey.trim().length > 0) {
      geminiStatusBadge.textContent = "Autonomous Heuristic (Key requires AIzaSy...)";
      geminiStatusBadge.className = "setting-badge";
      keyIndicatorDot.className = "key-indicator-dot";
    } else {
      geminiStatusBadge.textContent = "Offline (Heuristic AST Mode)";
      geminiStatusBadge.className = "setting-badge";
      keyIndicatorDot.className = "key-indicator-dot";
    }

    if (githubToken && (githubToken.trim().startsWith("ghp_") || githubToken.trim().startsWith("github_pat_") || githubToken.trim().length > 20)) {
      githubStatusBadge.textContent = "Authenticated (Live PR Enabled)";
      githubStatusBadge.className = "setting-badge configured";
    } else {
      githubStatusBadge.textContent = "Public / Staged PR Mode";
      githubStatusBadge.className = "setting-badge";
    }
  }

  loadLocalSettings();

  // Fetch server-level settings on init
  fetch("/api/settings")
    .then((r) => r.json())
    .then((data) => {
      if (data.hasGeminiKey && !geminiKeyInput.value) {
        geminiStatusBadge.textContent = "Active (Server Environment)";
        geminiStatusBadge.className = "setting-badge configured";
        keyIndicatorDot.className = "key-indicator-dot active";
      }
      if (data.hasGithubToken && !githubTokenInput.value) {
        githubStatusBadge.textContent = "Authenticated (Server Token)";
        githubStatusBadge.className = "setting-badge configured";
      }
    })
    .catch(() => {});

  // Settings Modal Handlers
  function openSettings() {
    settingsModal.classList.remove("hidden");
  }
  function closeSettings() {
    settingsModal.classList.add("hidden");
  }

  openSettingsBtn.addEventListener("click", openSettings);
  settingsNavBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);

  saveSettingsBtn.addEventListener("click", async () => {
    const geminiVal = geminiKeyInput.value.trim();
    const githubVal = githubTokenInput.value.trim();
    const modelVal = modelSelect.value;

    localStorage.setItem("contribforge_gemini_key", geminiVal);
    localStorage.setItem("contribforge_github_token", githubVal);
    localStorage.setItem("contribforge_model", modelVal);

    updateKeyStatusBadges(geminiVal, githubVal);

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: geminiVal,
          githubToken: githubVal,
          model: modelVal
        })
      });
      appendTerminal("Configuration updated & saved successfully.", "t-green");
    } catch {}

    closeSettings();
  });

  // Password Visibility Toggles
  toggleGeminiVis.addEventListener("click", () => {
    geminiKeyInput.type = geminiKeyInput.type === "password" ? "text" : "password";
  });
  toggleGithubVis.addEventListener("click", () => {
    githubTokenInput.type = githubTokenInput.type === "password" ? "text" : "password";
  });

  // Help Modal Handlers
  helpNavBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  closeHelpBtn.addEventListener("click", () => helpModal.classList.add("hidden"));

  // 2. Preset & Issue URL Management
  issueSelect.addEventListener("change", () => {
    const val = issueSelect.value;
    if (val === "custom") {
      issueUrlInput.value = "";
      issueUrlInput.focus();
      topbarRepoBadge.textContent = "Custom GitHub Repository";
      node0Desc.textContent = "Paste any GitHub Issue URL above and click Load";
      return;
    }

    const preset = PRESET_ISSUES[val];
    if (preset) {
      issueUrlInput.value = preset.url;
      topbarRepoBadge.textContent = `${preset.owner} / ${preset.repo} > Issue #${preset.number}`;
      runBtnText.textContent = `Solve Issue #${preset.number}`;
      node0Desc.textContent = `Fetch issue #${preset.number}: ${preset.desc}`;
    }
  });

  // Load Issue URL Handler
  async function loadIssueFromUrl() {
    const url = issueUrlInput.value.trim();
    if (!url) return;

    appendTerminal(`Loading GitHub issue from URL: ${url}...`, "t-info");
    try {
      const res = await fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse URL");

      const { parsed, issue } = data;
      topbarRepoBadge.textContent = `${parsed.owner} / ${parsed.repo} > Issue #${parsed.issueNumber}`;
      runBtnText.textContent = `Solve Issue #${parsed.issueNumber}`;
      if (issue && issue.title) {
        node0Desc.textContent = `[${issue.source}] ${issue.title.slice(0, 60)}...`;
        appendTerminal(`✔ Loaded: "${issue.title}" (${issue.labels?.join(", ") || "bug"})`, "t-cmd");
      }
    } catch (err) {
      appendTerminal(`✖ Error loading issue: ${err.message}`, "t-red");
    }
  }

  loadUrlBtn.addEventListener("click", loadIssueFromUrl);
  issueUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadIssueFromUrl();
    }
  });

  // Initialize with Issue #14 URL
  issueUrlInput.value = PRESET_ISSUES["14"].url;

  // 3. Timer & Terminal Logging
  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    termTimer.textContent = `${mins}:${secs}`;
  }

  function appendTerminal(text, type = "t-dim", category = "general") {
    const line = document.createElement("div");
    line.className = `t-line ${type}`;
    line.dataset.cat = category;
    line.textContent = `> ${text}`;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  // Terminal Copy & Clear
  copyLogsBtn.addEventListener("click", () => {
    const logs = Array.from(terminalOutput.querySelectorAll(".t-line"))
      .map((el) => el.textContent)
      .join("\n");
    navigator.clipboard.writeText(logs).then(() => {
      copyLogsBtn.textContent = "Copied!";
      setTimeout(() => (copyLogsBtn.textContent = "Copy"), 1500);
    });
  });

  clearLogsBtn.addEventListener("click", () => {
    terminalOutput.innerHTML = "";
    appendTerminal("Terminal buffer cleared.", "t-dim");
  });

  // Terminal Category Filter Tabs
  document.querySelectorAll(".terminal-tab-group .tab-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".terminal-tab-group .tab-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentLogCategory = btn.dataset.filter || "all";

      terminalOutput.querySelectorAll(".t-line").forEach((line) => {
        if (currentLogCategory === "all" || line.dataset.cat === currentLogCategory) {
          line.style.display = "block";
        } else {
          line.style.display = "none";
        }
      });
    });
  });

  // DAG Node Activator
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

  // Monaco Unified Diff Renderer
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

  // 4. WebSocket Real-Time Connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onopen = () => {
    appendTerminal("Connected to ContribForge runtime engine over WebSocket.", "t-info", "general");
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
        let cat = "general";
        if (step.status === "IN_PROGRESS") type = "t-info";
        if (step.status === "SUCCESS") type = "t-cmd";
        if (step.status === "AWAITING_APPROVAL") {
          type = "t-gate";
          cat = "gate";
        }
        if (step.title.includes("Reasoning") || step.title.includes("Gemini")) {
          cat = "reasoning";
        }
        if (step.title.includes("Sandbox") || step.title.includes("Reproduction")) {
          cat = "sandbox";
        }

        appendTerminal(`${step.title}`, type, cat);

        if (step.title.includes("Defect Successfully Confirmed")) {
          badgeRed.textContent = "FAILING TEST (CONFIRMED 🔴)";
          badgeRed.className = "node-badge badge-red";
          if (step.stderrSnippet) appendTerminal(step.stderrSnippet, "t-red", "sandbox");
        }

        if (step.title.includes("Reproduction Test Passed")) {
          badgeGreen.textContent = "PASSED TEST (VERIFIED 🟢)";
          badgeGreen.className = "node-badge badge-green";
          if (step.stdout) appendTerminal(step.stdout, "t-green", "sandbox");
        }

        if (step.testsPassed) {
          appendTerminal(`↳ Regression Suite: ${step.testsPassed}`, "t-green", "sandbox");
        }

        if (step.diff) renderDiff(step.diff);
      }

      if (data.type === "approval_required") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> PAUSED (HITL GATE)`;
        pipelineStatus.className = "status-indicator-badge gated";

        modalTarget.textContent = `${data.payload.owner}/${data.payload.repo}`;
        modalBranch.textContent = data.payload.head_branch;
        modalPrTitle.textContent = data.payload.title;
        modalPrBody.textContent = (data.payload.body || "").slice(0, 320) + "...";

        if (data.diff) renderDiff(data.diff);

        approvalModal.classList.remove("hidden");
        appendTerminal("🛡️ TRUEFORGE HARNESS: Execution paused at Human-in-the-Loop gate.", "t-gate", "gate");
      }

      if (data.type === "workflow_completed") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> COMPLETED`;
        pipelineStatus.className = "status-indicator-badge completed";
        runBtn.disabled = false;
        cancelBtn.classList.add("hidden");
        clearInterval(timerInterval);

        setNodeActive(5);
        badgeDeployment.textContent = `PR #${data.result?.pr_number || 503} OPENED ✔`;
        badgeDeployment.className = "node-badge badge-green";

        const { result } = data;
        prSuccessLink.href = result.pr_url;
        prSuccessLink.textContent = `View PR #${result.pr_number} on GitHub →`;
        prSuccessBar.classList.remove("hidden");
        appendTerminal(`🎉 Pull Request created: ${result.pr_url}`, "t-green", "general");
      }

      if (data.type === "workflow_error") {
        pipelineStatus.innerHTML = `<span class="pulse-dot"></span> ERROR`;
        pipelineStatus.className = "status-indicator-badge";
        runBtn.disabled = false;
        cancelBtn.classList.add("hidden");
        clearInterval(timerInterval);
        appendTerminal(`✖ Error: ${data.error}`, "t-red", "general");
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  };

  // 5. Workflow Trigger Execution
  async function triggerWorkflow() {
    if (runBtn.disabled) return;
    runBtn.disabled = true;
    cancelBtn.classList.remove("hidden");
    prSuccessBar.classList.add("hidden");
    pipelineStatus.innerHTML = `<span class="pulse-dot"></span> RUNNING`;
    pipelineStatus.className = "status-indicator-badge running";

    terminalOutput.innerHTML = "";
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    setNodeActive(0);

    const issueUrl = issueUrlInput.value.trim();
    const geminiKey = localStorage.getItem("contribforge_gemini_key") || "";
    const githubToken = localStorage.getItem("contribforge_github_token") || "";
    const model = localStorage.getItem("contribforge_model") || "gemini-2.5-flash";

    let payload = {
      issueUrl: issueUrl || null,
      geminiApiKey: geminiKey || null,
      githubToken: githubToken || null,
      model
    };

    if (!issueUrl) {
      const presetNum = Number(issueSelect.value) || 14;
      payload.owner = "truefoundry";
      payload.repo = "micro-config";
      payload.issueNumber = presetNum;
    }

    appendTerminal(`Initiating ContribForge autonomous cycle for: ${issueUrl || "truefoundry/micro-config #14"}...`, "t-info", "general");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || "Failed to start workflow");
      }
    } catch (err) {
      appendTerminal(`Failed to start: ${err.message}`, "t-red", "general");
      runBtn.disabled = false;
      cancelBtn.classList.add("hidden");
    }
  }

  runBtn.addEventListener("click", triggerWorkflow);

  // Cancel Handler
  cancelBtn.addEventListener("click", async () => {
    await fetch("/api/cancel", { method: "POST" });
    cancelBtn.classList.add("hidden");
    runBtn.disabled = false;
    clearInterval(timerInterval);
    pipelineStatus.innerHTML = `<span class="pulse-dot"></span> IDLE`;
    pipelineStatus.className = "status-indicator-badge";
    appendTerminal("Session cancelled by operator.", "t-red", "general");
  });

  // Approval Handlers
  approveBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User approved action: Authorizing submit_pull_request...", "t-green", "gate");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: true })
    });
  });

  denyBtn.addEventListener("click", async () => {
    approvalModal.classList.add("hidden");
    appendTerminal("User denied action: PR creation halted.", "t-red", "gate");
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: false })
    });
  });

  closeSuccessBtn.addEventListener("click", () => {
    prSuccessBar.classList.add("hidden");
  });

  // Global Keyboard Shortcuts
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
    if (e.key === "Escape") {
      if (!approvalModal.classList.contains("hidden")) {
        e.preventDefault();
        denyBtn.click();
      } else if (!settingsModal.classList.contains("hidden")) {
        e.preventDefault();
        closeSettings();
      } else if (!helpModal.classList.contains("hidden")) {
        e.preventDefault();
        helpModal.classList.add("hidden");
      }
    }
  });
});
