import fs from "fs";
import path from "path";

/**
 * Intelligent Codebase Indexer & Defect Localizer
 * Analyzes repository structure, parses symbols, and semantically ranks
 * candidate culprit files against issue reports and error stack traces.
 */

// Supported code extensions to index
const CODE_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".go", ".rs", ".java", ".json"
]);

// Ignored folders for performance and hygiene
const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".serena", "dist", "build",
  "coverage", ".next", ".cache", "vendor", "__pycache__"
]);

/**
 * Recursively scans directory and collects indexable source files
 */
export function scanCodebaseFiles(rootDir) {
  const fileList = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
          fileList.push({
            fullPath,
            relPath,
            fileName: entry.name,
            ext,
            sizeBytes: entry.size || fs.statSync(fullPath).size
          });
        }
      }
    }
  }

  walk(rootDir);
  return fileList;
}

/**
 * Extracts key technical tokens, function names, and file paths from an issue
 */
export function extractIssueKeywords(issueTitle = "", issueBody = "") {
  const combined = `${issueTitle}\n${issueBody}`;
  const keywords = new Set();

  // 1. Extract file paths mentioned in stack traces or descriptions (e.g. src/parser.js)
  const pathMatches = combined.match(/[a-zA-Z0-9_\-\.\/]+\.(?:js|ts|py|go|rs|jsx|tsx|json)/g) || [];
  pathMatches.forEach((p) => keywords.add(p.replace(/\\/g, "/").toLowerCase()));

  // 2. Extract function or symbol names (e.g. `parsePortConfig`, `loadConfig`, `function abc()`)
  const symbolMatches = combined.match(/`([a-zA-Z0-9_]+)`/g) || [];
  symbolMatches.forEach((s) => keywords.add(s.replace(/`/g, "").toLowerCase()));

  // 3. Extract camelCase or PascalCase identifiers
  const identMatches = combined.match(/\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g) || [];
  identMatches.forEach((id) => keywords.add(id.toLowerCase()));

  // 4. Extract uppercase environment variable names (e.g. PORT, HOST, DATABASE_URL)
  const envMatches = combined.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [];
  envMatches.forEach((env) => keywords.add(env.toLowerCase()));

  // 5. Extract error class names (e.g. TypeError, ReferenceError, RangeError)
  const errorMatches = combined.match(/\b[A-Z][a-zA-Z]+Error\b/g) || [];
  errorMatches.forEach((err) => keywords.add(err.toLowerCase()));

  // 6. Generic high-value tokens
  const genericTokens = [
    "trim", "host", "port", "scheme", "url", "protocol", "config", "parser",
    "undefined", "null", "socket", "default", "validation", "overflow"
  ];
  genericTokens.forEach((t) => {
    if (combined.toLowerCase().includes(t)) {
      keywords.add(t);
    }
  });

  return Array.from(keywords);
}

/**
 * Scores and ranks candidate culprit files in the codebase
 */
export function rankCulpritFiles(rootDir, issue) {
  const files = scanCodebaseFiles(rootDir);
  if (files.length === 0) return [];

  const keywords = extractIssueKeywords(issue.title, issue.body);
  const scoredFiles = [];

  for (const file of files) {
    // Avoid ranking existing test files as the primary culprit (unless no src exists)
    const isTestFile = file.relPath.includes("test/") || file.relPath.includes("__tests__") || file.fileName.includes(".test.") || file.fileName.includes(".spec.");

    let score = isTestFile ? 5 : 20; // Bias toward source files
    const matches = [];

    // Check filename matches
    const lowerRel = file.relPath.toLowerCase();
    for (const kw of keywords) {
      if (lowerRel.includes(kw)) {
        score += 35;
        matches.push(`path:${kw}`);
      }
    }

    // Read content and check symbol matches
    try {
      const content = fs.readFileSync(file.fullPath, "utf-8");
      const lowerContent = content.toLowerCase();

      for (const kw of keywords) {
        if (lowerContent.includes(kw)) {
          // Weight exact function/symbol occurrences higher
          const occurrences = (lowerContent.match(new RegExp(escapeRegExp(kw), "g")) || []).length;
          const weight = Math.min(occurrences * 8, 40);
          score += weight;
          matches.push(`content:${kw}(x${occurrences})`);
        }
      }

      // Bonus if file is in 'src/' or 'lib/'
      if (lowerRel.startsWith("src/") || lowerRel.startsWith("lib/")) {
        score += 15;
      }

      scoredFiles.push({
        ...file,
        score,
        matches: Array.from(new Set(matches)),
        isTestFile
      });
    } catch {
      // Unreadable file, skip
    }
  }

  // Sort descending by score
  scoredFiles.sort((a, b) => b.score - a.score);

  return scoredFiles;
}

/**
 * Extracts relevant code snippets around matched keywords
 */
export function extractFocalSnippet(filePath, keywords = [], contextLines = 15) {
  if (!fs.existsSync(filePath)) return "";
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    let targetLineIdx = -1;

    // Find first line containing a high-value keyword
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywords.some((kw) => lineLower.includes(kw))) {
        targetLineIdx = i;
        break;
      }
    }

    if (targetLineIdx === -1) {
      return lines.slice(0, 50).join("\n");
    }

    const start = Math.max(0, targetLineIdx - 5);
    const end = Math.min(lines.length, targetLineIdx + contextLines);
    return lines.slice(start, end).join("\n");
  } catch {
    return "";
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
