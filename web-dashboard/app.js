/**
 * ContribForge — Web Client Architecture & Autonomous Agent Controller
 * Multi-model support (Gemini 2.5 Flash / Heuristic AST Engine)
 * Test-Driven Agentics (TDA) streaming with Monaco Diff and Lucide Icons
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

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
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
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
  const mobileHelpBtn = document.getElementById("mobileHelpBtn");
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

  // Mobile Tabs
  const tabPipelineBtn = document.getElementById("tabPipelineBtn");
  const tabDiffBtn = document.getElementById("tabDiffBtn");
  const pipelineSection = document.getElementById("pipelineSection");
  const diffSection = document.getElementById("diffSection");

  let timerInterval = null;
  let startTime = null;
  let currentLogCategory = "all";

  // Step to Node Mapping
  const stepNodeMap = {
    "Sandbox Initialized": 0,
    "Fetching GitHub Issue Context": 0,
    "Issue Context Extracted": 0,
    "Indexing Codebase & Localizing Culprit Files": 1,
    "Codebase Indexed & Culprit Localized": 1,
    "Reasoning with gemini-2.5-flash": 1,
    "Reasoning with gemini-2.5-pro": 1,
    "Gemini Synthesized Reproduction Test": 1,
    "Activating Autonomous Heuristic AST Engine": 1,
    "Synthesizing Reproduction Test Script": 1,
    "Reproduction Test Authored": 1,
    "Executing Reproduction in Sandbox (Empirical Red Check)": 1,
    "Defect Successfully Confirmed (🔴 RED)": 1,
    "Synthesizing Surgical Patch": 2,
    "Synthesizing Surgical Patch (Turn 1/3)": 2,
    "Synthesizing Surgical Patch (Turn 2/3)": 2,
    "Synthesizing Surgical Patch (Turn 3/3)": 2,
    "Patch Applied in Sandbox": 2,
    "Verifying Reproduction Passes (Empirical Green Check)": 3,
    "Verifying Reproduction Passes (Green Check Turn 1)": 3,
    "Verifying Reproduction Passes (Green Check Turn 2)": 3,
    "Verifying Reproduction Passes (Green Check Turn 3)": 3,
    "Reproduction Test Passed (🟢 GREEN)": 3,
    "Self-Healing AST Converged (🟢 GREEN)": 3,
    "Running Full Test Suite (Zero-Regression Check)": 3,
    "Full Test Suite Passed: Zero Regressions": 3,
    "Git Diff Generated": 3,
    "Unified Git Diff & Confidence Scored": 3,
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
    },
    "21": {
      owner: "truefoundry",
      repo: "micro-config",
      number: 21,
      url: "https://github.com/truefoundry/micro-config/issues/21",
      desc: "Boundary validation guard rejecting negative and overflow ports"
    },
    "42": {
      owner: "truefoundry",
      repo: "micro-config",
      number: 42,
      url: "https://github.com/truefoundry/micro-config/issues/42",
      desc: "parseLogLevel case-insensitive log level normalization"
    },
    "36216": {
      owner: "bitcoin",
      repo: "bitcoin",
      number: 36216,
      url: "https://github.com/bitcoin/bitcoin/issues/36216",
      desc: "qa: Intermittent failure in interface_http.py socket timeout"
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
      geminiStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      if (keyIndicatorDot) keyIndicatorDot.className = "w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400";
    } else if (geminiKey && geminiKey.trim().length > 0) {
      geminiStatusBadge.textContent = "Autonomous Heuristic (Needs AIzaSy...)";
      geminiStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30";
      if (keyIndicatorDot) keyIndicatorDot.className = "w-2 h-2 rounded-full bg-amber-400";
    } else {
      geminiStatusBadge.textContent = "Offline (Heuristic AST Mode)";
      geminiStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400";
      if (keyIndicatorDot) keyIndicatorDot.className = "w-2 h-2 rounded-full bg-slate-500";
    }

    if (githubToken && (githubToken.trim().startsWith("ghp_") || githubToken.trim().startsWith("github_pat_") || githubToken.trim().length > 20)) {
      githubStatusBadge.textContent = "Authenticated (Live PR Enabled)";
      githubStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    } else {
      githubStatusBadge.textContent = "Public / Staged PR Mode";
      githubStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400";
    }
  }

  loadLocalSettings();

  // Fetch server-level settings on init
  fetch("/api/settings")
    .then((r) => r.json())
    .then((data) => {
      if (data.hasGeminiKey && !geminiKeyInput.value) {
        geminiStatusBadge.textContent = "Active (Server Environment)";
        geminiStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        if (keyIndicatorDot) keyIndicatorDot.className = "w-2 h-2 rounded-full bg-emerald-400";
      }
      if (data.hasGithubToken && !githubTokenInput.value) {
        githubStatusBadge.textContent = "Authenticated (Server Token)";
        githubStatusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      }
    })
    .catch(() => {});

  // Settings Modal Handlers
  function openSettings() {
    settingsModal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }
  function closeSettings() {
    settingsModal.classList.add("hidden");
  }

  if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettings);
  if (mobileSettingsBtn) mobileSettingsBtn.addEventListener("click", openSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettings);

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
  if (mobileHelpBtn) mobileHelpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  if (closeHelpBtn) closeHelpBtn.addEventListener("click", () => helpModal.classList.add("hidden"));

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
      
      // Update quick chips
      document.querySelectorAll(".quick-chip").forEach((chip) => {
        if (chip.dataset.url === preset.url) {
          chip.classList.add("active");
        } else {
          chip.classList.remove("active");
        }
      });
    }
  });

  function sanitizeGitHubUrl(raw) {
    if (!raw) return "";
    const str = String(raw).trim();
    const match = str.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/issues\/|#)[0-9]+/);
    if (match) return match[0];
    return str;
  }

  // Quick Chips Handler
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".quick-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const url = sanitizeGitHubUrl(chip.dataset.url);
      if (url) {
        issueUrlInput.value = url;
        loadIssueFromUrl();
      }
    });
  });

  // Load Issue URL Handler
  async function loadIssueFromUrl() {
    const rawUrl = issueUrlInput.value.trim();
    const url = sanitizeGitHubUrl(rawUrl);
    if (!url) return;
    issueUrlInput.value = url;

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

  issueUrlInput.addEventListener("focus", () => {
    issueUrlInput.select();
  });

  issueUrlInput.addEventListener("paste", () => {
    setTimeout(() => {
      issueUrlInput.value = sanitizeGitHubUrl(issueUrlInput.value);
    }, 0);
  });

  // Initialize with Issue #14 URL
  issueUrlInput.value = PRESET_ISSUES["14"].url;

  // 3. Mobile Tab Switcher
  if (tabPipelineBtn && tabDiffBtn && pipelineSection && diffSection) {
    tabPipelineBtn.addEventListener("click", () => {
      tabPipelineBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white shadow-sm transition-all flex items-center justify-center gap-1.5";
      tabDiffBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5";
      pipelineSection.classList.remove("hidden");
      diffSection.classList.add("hidden");
      diffSection.classList.remove("flex");
    });

    tabDiffBtn.addEventListener("click", () => {
      tabDiffBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white shadow-sm transition-all flex items-center justify-center gap-1.5";
      tabPipelineBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5";
      diffSection.classList.remove("hidden");
      diffSection.classList.add("flex");
      pipelineSection.classList.add("hidden");
    });
  }

  // 4. Timer & Terminal Logging
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
      appendTerminal("Terminal logs copied to clipboard.", "t-green");
    });
  });

  clearLogsBtn.addEventListener("click", () => {
    terminalOutput.innerHTML = "";
    appendTerminal("Terminal buffer cleared.", "t-dim");
  });

  // Terminal Category Filter Tabs
  document.querySelectorAll(".terminal-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".terminal-tab").forEach((b) => {
        b.className = "terminal-tab px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all";
      });
      btn.className = "terminal-tab active px-2.5 py-1 rounded-lg bg-violet-600 text-white transition-all";
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
        el.className = "dag-node-item rounded-xl p-3.5 bg-slate-950/60 border border-emerald-500/40 completed transition-all";
      } else if (i === nodeIndex) {
        el.className = "dag-node-item rounded-xl p-3.5 active transition-all";
      } else {
        el.className = "dag-node-item rounded-xl p-3.5 bg-slate-950/60 border border-white/10 transition-all";
      }
    }
    if (window.lucide) lucide.createIcons();
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

  // 5. WebSocket Real-Time Connection
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
          badgeRed.className = "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40";
          if (step.stderrSnippet) appendTerminal(step.stderrSnippet, "t-red", "sandbox");
        }

        if (step.title.includes("Reproduction Test Passed")) {
          badgeGreen.textContent = "PASSED TEST (VERIFIED 🟢)";
          badgeGreen.className = "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
          if (step.stdout) appendTerminal(step.stdout, "t-green", "sandbox");
        }

        if (step.testsPassed) {
          appendTerminal(`↳ Regression Suite: ${step.testsPassed}`, "t-green", "sandbox");
        }

        if (step.diff) renderDiff(step.diff);
      }

      if (data.type === "codebase_indexed") {
        const topbarStackBadge = document.getElementById("topbarStackBadge");
        if (topbarStackBadge && data.stackInfo) {
          topbarStackBadge.textContent = `${data.stackInfo.language} (${data.stackInfo.runner})`;
        }
        if (data.topCandidate) {
          appendTerminal(`🔍 Codebase Indexer: Localized culprit file '${data.topCandidate.relPath}' (${data.topCandidate.score}% match)`, "t-cmd", "reasoning");
        }
      }

      if (data.type === "approval_required") {
        pipelineStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> <span>PAUSED (HITL GATE)</span>`;
        pipelineStatus.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300";

        if (data.confidenceScore) {
          const topbarConfidenceBadge = document.getElementById("topbarConfidenceBadge");
          if (topbarConfidenceBadge) topbarConfidenceBadge.textContent = `${data.confidenceScore}% Guaranteed`;
        }

        modalTarget.textContent = `${data.payload.owner}/${data.payload.repo}`;
        modalBranch.textContent = data.payload.head_branch;
        modalPrTitle.textContent = data.payload.title;
        modalPrBody.textContent = (data.payload.body || "").slice(0, 320) + "...";

        if (data.diff) renderDiff(data.diff);

        approvalModal.classList.remove("hidden");
        appendTerminal("🛡️ TRUEFORGE HARNESS: Execution paused at Human-in-the-Loop gate.", "t-gate", "gate");
        if (window.lucide) lucide.createIcons();
      }

      if (data.type === "workflow_completed") {
        pipelineStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> <span>COMPLETED</span>`;
        pipelineStatus.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300";
        runBtn.disabled = false;
        cancelBtn.classList.add("hidden");
        clearInterval(timerInterval);

        setNodeActive(5);
        const { result } = data;
        const isLivePR = result && (result.mode === "live_github_pr" || (result.pr_url && result.pr_url.includes("github.com")));

        if (isLivePR) {
          badgeDeployment.textContent = `LIVE PR #${result.pr_number} CREATED ON GITHUB ✔`;
          badgeDeployment.className = "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
          prSuccessLink.href = result.pr_url;
          prSuccessLink.innerHTML = `<span>View Live PR #${result.pr_number} on GitHub</span> <i data-lucide="external-link" class="w-3 h-3"></i>`;
          prSuccessBar.classList.remove("hidden");
          appendTerminal(`🎉 LIVE GitHub Pull Request Published: ${result.pr_url}`, "t-green", "general");
        } else {
          badgeDeployment.textContent = "PATCH STAGED (LOCAL) ✔";
          badgeDeployment.className = "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40";
          if (result && result.patch_file) {
            appendTerminal(`📄 Patch verified & staged locally: ${result.patch_file}`, "t-cmd", "general");
          }
        }
        if (window.lucide) lucide.createIcons();
      }

      if (data.type === "workflow_error") {
        pipelineStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> <span>ERROR</span>`;
        pipelineStatus.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-300";
        runBtn.disabled = false;
        cancelBtn.classList.add("hidden");
        clearInterval(timerInterval);
        appendTerminal(`✖ Error: ${data.error}`, "t-red", "general");
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  };

  // 6. Workflow Trigger Execution
  async function triggerWorkflow() {
    if (runBtn.disabled) return;
    runBtn.disabled = true;
    cancelBtn.classList.remove("hidden");
    cancelBtn.classList.add("inline-flex");
    prSuccessBar.classList.add("hidden");
    pipelineStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-violet-400 animate-ping"></span> <span>RUNNING</span>`;
    pipelineStatus.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-violet-500/20 border border-violet-500/40 text-violet-300";

    terminalOutput.innerHTML = "";
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    setNodeActive(0);

    const issueUrl = sanitizeGitHubUrl(issueUrlInput.value.trim());
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
      cancelBtn.classList.remove("inline-flex");
    }
  }

  runBtn.addEventListener("click", triggerWorkflow);

  // Cancel Handler
  cancelBtn.addEventListener("click", async () => {
    await fetch("/api/cancel", { method: "POST" });
    cancelBtn.classList.add("hidden");
    cancelBtn.classList.remove("inline-flex");
    runBtn.disabled = false;
    clearInterval(timerInterval);
    pipelineStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> <span>IDLE</span>`;
    pipelineStatus.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800/80 border border-white/10 text-slate-300";
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

  // Keyboard Shortcuts: Cmd+R or Ctrl+R to run
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "r") {
      e.preventDefault();
      triggerWorkflow();
    }
  });
});
