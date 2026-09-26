import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { fetchGitHubIssue } from "./tools/github.mjs";
import {
  initSandbox,
  runSandboxCommand,
  writeSandboxFile,
  readSandboxFile,
  listSandboxFiles,
  getSandboxPath
} from "./tools/sandbox.mjs";
import { getGitDiff } from "./tools/diff.mjs";
import { submitPullRequest } from "./tools/pr.mjs";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_REPO_DIR = path.resolve(__dirname, "../demo-target-repo");

// Initialize sandbox with demo repo files if empty
initSandbox(DEMO_REPO_DIR);

const server = new Server(
  {
    name: "contribforge-mcp",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define tool manifest
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_github_issue",
        description: "Retrieves title, description, stack trace, and discussion comments for any GitHub issue.",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "GitHub organization or user (e.g. 'truefoundry')" },
            repo: { type: "string", description: "Repository name (e.g. 'trueforge')" },
            issue_number: { type: "number", description: "Issue number (e.g. 14)" }
          },
          required: ["owner", "repo", "issue_number"]
        }
      },
      {
        name: "run_sandbox_command",
        description: "Executes a shell command inside the hermetic sandbox directory (e.g., 'npm test', 'node test/repro.js'). Returns stdout, stderr, and exitCode.",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Bash / PowerShell command to execute inside sandbox" },
            timeoutMs: { type: "number", description: "Optional execution timeout in milliseconds (default 45000)" }
          },
          required: ["command"]
        }
      },
      {
        name: "write_file_in_sandbox",
        description: "Creates or updates a file (source code or test script) inside the sandbox workspace.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Relative file path inside the sandbox (e.g. 'src/config.js')" },
            content: { type: "string", description: "Complete text content to write" }
          },
          required: ["file_path", "content"]
        }
      },
      {
        name: "read_file_in_sandbox",
        description: "Reads the content of an existing file from the sandbox workspace.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Relative file path inside the sandbox" }
          },
          required: ["file_path"]
        }
      },
      {
        name: "list_sandbox_files",
        description: "Lists all files and directories in the sandbox workspace to understand project layout.",
        inputSchema: {
          type: "object",
          properties: {
            sub_path: { type: "string", description: "Optional relative subfolder path (defaults to root)" }
          }
        }
      },
      {
        name: "get_git_diff",
        description: "Computes the active git diff of all modifications made inside the sandbox.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "submit_pull_request",
        description: "CRITICAL IRREVERSIBLE ACTION: Commits changes, pushes branch to remote repository, and opens a public GitHub Pull Request. This tool MUST be paused for user approval before execution.",
        annotations: {
          destructive: true
        },
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Target repository owner" },
            repo: { type: "string", description: "Target repository name" },
            title: { type: "string", description: "PR Title following conventional commits (e.g., 'fix(config): handle empty port')" },
            body: { type: "string", description: "Comprehensive PR markdown description with root cause, reproduction proof, and test verification" },
            head_branch: { type: "string", description: "Branch name to commit to" },
            base_branch: { type: "string", description: "Base branch to merge into (default 'main')" }
          },
          required: ["owner", "repo", "title", "body"]
        }
      }
    ]
  };
});

// Handle tool execution calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "fetch_github_issue": {
        const result = await fetchGitHubIssue(args.owner, args.repo, args.issue_number);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      case "run_sandbox_command": {
        const result = runSandboxCommand(args.command, args.timeoutMs);
        const formatted = [
          `[Exit Code]: ${result.exitCode}`,
          `[Duration]: ${result.durationMs}ms`,
          `[Status]: ${result.success ? "SUCCESS" : "FAILED"}`,
          result.stdout ? `\n--- STDOUT ---\n${result.stdout}` : "",
          result.stderr ? `\n--- STDERR ---\n${result.stderr}` : ""
        ]
          .filter(Boolean)
          .join("\n");

        return {
          isError: !result.success,
          content: [{ type: "text", text: formatted }]
        };
      }

      case "write_file_in_sandbox": {
        const result = writeSandboxFile(args.file_path, args.content);
        return {
          content: [{ type: "text", text: `Successfully wrote ${result.bytesWritten} bytes to ${result.path}` }]
        };
      }

      case "read_file_in_sandbox": {
        const content = readSandboxFile(args.file_path);
        return {
          content: [{ type: "text", text: content }]
        };
      }

      case "list_sandbox_files": {
        const files = listSandboxFiles(args.sub_path || "");
        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }]
        };
      }

      case "get_git_diff": {
        const diffResult = await getGitDiff();
        return {
          content: [{ type: "text", text: JSON.stringify(diffResult, null, 2) }]
        };
      }

      case "submit_pull_request": {
        const prResult = await submitPullRequest(args);
        return {
          content: [{ type: "text", text: JSON.stringify(prResult, null, 2) }]
        };
      }

      default:
        throw new Error(`Unrecognized MCP tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Tool Execution Error: ${err.message}` }]
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ContribForge MCP Server running on stdio transport.");
