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
  }
};

export async function fetchGitHubIssue(owner, repo, issueNumber) {
  const token = process.env.GITHUB_TOKEN;

  if (token && (token.startsWith("ghp_") || token.startsWith("github_pat_"))) {
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
        source: "live_github_api",
        number: issue.number,
        title: issue.title,
        author: issue.user?.login || "anonymous",
        state: issue.state,
        labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
        body: issue.body,
        comments: comments.map((c) => ({
          author: c.user?.login || "anonymous",
          body: c.body
        }))
      };
    } catch (err) {
      console.warn(`[GitHub API Warning] Could not fetch live issue (${err.message}). Falling back to local catalog.`);
    }
  }

  // Fallback to mock / demo catalog
  const fallback = MOCK_ISSUES[Number(issueNumber)] || {
    number: Number(issueNumber),
    title: `Issue #${issueNumber}: Unhandled edge case in repository`,
    author: "demo-user",
    state: "open",
    labels: ["bug"],
    body: `Issue #${issueNumber}: Automated bug report. Investigate edge cases in configuration parser and verify unit tests.`,
    comments: []
  };

  return {
    source: "demo_mock_catalog",
    ...fallback
  };
}
