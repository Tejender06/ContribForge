import fs from "fs";
import path from "path";

/**
 * Universal Dynamic Stack & Test Runner Detector
 * Inspects repository files and determines language, test runner, and execution commands.
 */

export function detectRepositoryStack(rootDir) {
  // 1. Check Node.js / JavaScript / TypeScript
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      const devDeps = { ...pkg.devDependencies, ...pkg.dependencies };

      let runner = "node:test";
      let fullSuiteCmd = "node --test test/*.test.js 2>nul || npm test";
      let reproRunnerCmd = (file) => `node --test ${file}`;

      if (scripts.test) {
        if (scripts.test.includes("vitest")) {
          runner = "vitest";
          fullSuiteCmd = "npx vitest run";
          reproRunnerCmd = (file) => `npx vitest run ${file}`;
        } else if (scripts.test.includes("jest")) {
          runner = "jest";
          fullSuiteCmd = "npx jest";
          reproRunnerCmd = (file) => `npx jest ${file}`;
        } else if (scripts.test.includes("mocha")) {
          runner = "mocha";
          fullSuiteCmd = "npx mocha";
          reproRunnerCmd = (file) => `npx mocha ${file}`;
        } else {
          runner = "npm test";
          fullSuiteCmd = "npm test";
        }
      }

      return {
        stack: "Node.js",
        language: devDeps.typescript || fs.existsSync(path.join(rootDir, "tsconfig.json")) ? "TypeScript" : "JavaScript",
        runner,
        fullSuiteCmd,
        reproRunnerCmd,
        packageManager: fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))
          ? "pnpm"
          : fs.existsSync(path.join(rootDir, "yarn.lock"))
          ? "yarn"
          : "npm"
      };
    } catch {
      // Fallback
    }
  }

  // 2. Check Python
  if (
    fs.existsSync(path.join(rootDir, "requirements.txt")) ||
    fs.existsSync(path.join(rootDir, "pyproject.toml")) ||
    fs.existsSync(path.join(rootDir, "setup.py"))
  ) {
    return {
      stack: "Python",
      language: "Python",
      runner: "pytest",
      fullSuiteCmd: "pytest || python -m unittest discover",
      reproRunnerCmd: (file) => `pytest ${file} || python -m unittest ${file}`,
      packageManager: fs.existsSync(path.join(rootDir, "Pipfile")) ? "pipenv" : "pip"
    };
  }

  // 3. Check Go
  if (fs.existsSync(path.join(rootDir, "go.mod"))) {
    return {
      stack: "Go",
      language: "Go",
      runner: "go test",
      fullSuiteCmd: "go test ./...",
      reproRunnerCmd: (file) => `go test ${file}`,
      packageManager: "go modules"
    };
  }

  // 4. Check Rust
  if (fs.existsSync(path.join(rootDir, "Cargo.toml"))) {
    return {
      stack: "Rust",
      language: "Rust",
      runner: "cargo test",
      fullSuiteCmd: "cargo test",
      reproRunnerCmd: (file) => `cargo test --test ${path.basename(file, path.extname(file))}`,
      packageManager: "cargo"
    };
  }

  // Default fallback to Node.js / Node test runner
  return {
    stack: "Node.js / Universal",
    language: "JavaScript",
    runner: "node:test",
    fullSuiteCmd: "node --test test/*.test.js",
    reproRunnerCmd: (file) => `node --test ${file}`,
    packageManager: "npm"
  };
}
