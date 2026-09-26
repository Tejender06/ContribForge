import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

// Embedded fallback issues for seamless offline demos
const MOCK_ISSUES = {
  14: {
    number: 14,
    title: "TypeError: Cannot read properties of undefined (reading 'trim') in parsePortConfig",
    author: "contributor-jane",
    state: "open",
    labels: ["bug", "good first issue", "help wanted"],
    body: `### Description
When running our service in environments where the \`PORT\` environment variable is unset or an empty string, the configuration parser crashes on startup with an unhandled TypeError.

### Stack Trace
\`\`\`
TypeError: Cannot read properties of undefined (reading 'trim')
    at parsePortConfig (src/config-parser.js:28:22)
    at loadConfig (src/config-parser.js:45:16)
    at Object.<anonymous> (test/repro.js:5:1)
\`\`\`

### Steps to Reproduce
1. Run \`loadConfig({ PORT: "" })\` or \`loadConfig({ PORT: undefined })\`.
2. Notice the process throws an unhandled error instead of defaulting to port 3000.

### Expected Behavior
Should default to port \`3000\` when \`PORT\` is unset, null, or empty string.`,
    comments: [
      {
        author: "maintainer-bob",
        body: "Confirmed bug on main. The parser assumes \`rawPort\` is always a non-empty string. We need a unit test covering empty string, null, and non-numeric strings before merging any PR."
      }
    ]
  },
  12: {
    number: 12,
    title: "parseHost does not strip leading 'http://' or 'https://' protocol prefixes",
    author: "sre-dan",
    state: "open",
    labels: ["bug", "networking"],
    body: `### Description
When \`HOST\` is specified with a scheme prefix like \`http://0.0.0.0\` or \`https://127.0.0.1\`, \`parseHost\` preserves the scheme, which causes socket binding errors in Node.js HTTP servers.

### Expected Behavior
\`parseHost('http://localhost')\` should return \`'localhost'\`.`,
    comments: [
      {
        author: "lead-dev",
        body: "Good catch. Let's add regex cleaning to strip schemes before trimming."
      }
    ]
  },
  21: {
    number: 21,
    title: "parsePortConfig fails to reject negative or out-of-range port numbers",
    author: "sec-audit",
    state: "open",
    labels: ["bug", "security", "validation"],
    body: `### Description
Passing a negative port or port > 65535 should throw a descriptive validation error instead of returning invalid integers.

### Expected Behavior
\`parsePortConfig(-1)\` and \`parsePortConfig(70000)\` should throw \`Invalid port\`.`,
    comments: [
      {
        author: "core-maintainer",
        body: "Confirmed. Valid TCP ports must be in the range [1, 65535]."
      }
    ]
  },
  35: {
    number: 35,
    title: "Database URL parsing does not fall back when protocol is omitted",
    author: "backend-tim",
    state: "open",
    labels: ["bug", "database"],
    body: `### Description
When \`DATABASE_URL\` is provided without a scheme or protocol prefix (e.g. \`localhost/mydb\`), \`loadConfig\` should normalize or default gracefully.

### Expected Behavior
Should default to in-memory sqlite when unset, or prefix with sqlite:// when relative.`,
    comments: []
  },
  42: {
    number: 42,
    title: "parseLogLevel rejects uppercase log levels ('INFO', 'DEBUG')",
    author: "devops-alex",
    state: "open",
    labels: ["bug", "enhancement"],
    body: `### Description
Environment variables often use uppercase \`LOG_LEVEL=DEBUG\` or \`LOG_LEVEL=INFO\`. Currently it only checks lowercase, failing to recognize valid levels.

### Expected Behavior
\`parseLogLevel('DEBUG')\` should return \`'debug'\` without falling back to info.`,
    comments: []
  }
};

export function parseGitHubUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/issues\/|#)([0-9]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      issueNumber: parseInt(match[3], 10)
    };
  }
  return null;
}

export async function fetchGitHubIssue(owner, repo, issueNumber, customToken = null) {
  const token = customToken || process.env.GITHUB_TOKEN;

  // 1. Try authenticated Octokit if token is available
  if (token && (token.startsWith("ghp_") || token.startsWith("github_pat_") || token.length > 20)) {
    try {
      const octokit = new Octokit({ auth: token });
      const { data: issue } = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: Number(issueNumber)
      });

      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: Number(issueNumber)
      });

      return {
        source: "live_github_api_auth",
        number: issue.number,
        title: issue.title,
        author: issue.user?.login || "anonymous",
        state: issue.state,
        labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
        body: issue.body || "",
        comments: comments.map((c) => ({
          author: c.user?.login || "anonymous",
          body: c.body || ""
        }))
      };
    } catch (err) {
      console.warn(`[GitHub API Warning] Auth fetch failed (${err.message}). Trying public API.`);
    }
  }

  // 2. Try unauthenticated public GitHub REST API
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        "User-Agent": "ContribForge-Agent/1.0",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (res.ok) {
      const issue = await res.json();
      return {
        source: "live_github_api_public",
        number: issue.number,
        title: issue.title,
        author: issue.user?.login || "anonymous",
        state: issue.state,
        labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
        body: issue.body || "",
        comments: []
      };
    }
  } catch (err) {
    console.warn(`[GitHub Public API Error] ${err.message}`);
  }

  // 3. HTML scrape fallback for public repositories
  try {
    const htmlRes = await fetch(`https://github.com/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const titleMatch = html.match(/<bdi class="js-issue-title[^>]*>([\s\S]*?)<\/bdi>/) ||
                         html.match(/<title>([\s\S]*?)<\/title>/);
      let rawTitle = titleMatch
        ? titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
        : `Issue #${issueNumber}`;
      rawTitle = rawTitle.replace(/ · Issue #\d+ · .*?· GitHub$/, "").trim();

      const bodyMatch = html.match(/<td class="d-block comment-body markdown-body[^>]*>([\s\S]*?)<\/td>/);
      const cleanBody = bodyMatch
        ? bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : `Issue #${issueNumber} from ${owner}/${repo}`;

      return {
        source: "live_github_html_scrape",
        number: Number(issueNumber),
        title: rawTitle,
        author: "github-contributor",
        state: "open",
        labels: ["bug"],
        body: cleanBody,
        comments: []
      };
    }
  } catch (err) {
    console.warn(`[GitHub HTML Scraper Warning] ${err.message}`);
  }

  // 4. Resilient local fallback catalog
  const fallback = MOCK_ISSUES[Number(issueNumber)] || {
    number: Number(issueNumber),
    title: `Issue #${issueNumber}: Unhandled edge case in repository`,
    author: "demo-user",
    state: "open",
    labels: ["bug"],
    body: `Issue #${issueNumber}: Automated bug report for ${owner}/${repo}. Investigate edge cases in configuration parser and verify unit tests.`,
    comments: []
  };

  return {
    source: "demo_mock_catalog",
    ...fallback
  };
}
