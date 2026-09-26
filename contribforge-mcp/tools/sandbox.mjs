import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SANDBOX_DIR = path.resolve(process.env.SANDBOX_DIR || "../sandbox_workspace");

export function initSandbox(source = null) {
  if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  }

  if (source) {
    const isUrl = typeof source === "string" && (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@"));
    if (isUrl) {
      try {
        const files = fs.readdirSync(SANDBOX_DIR);
        if (files.length === 0 || (files.length === 1 && files[0] === ".git")) {
          execSync(`git clone --depth 1 ${source} .`, { cwd: SANDBOX_DIR, timeout: 60000, stdio: "ignore" });
        }
      } catch (err) {
        console.warn(`[Sandbox Git Clone Warning] Could not clone ${source}: ${err.message}`);
      }
    } else if (fs.existsSync(source)) {
      const files = fs.readdirSync(SANDBOX_DIR);
      if (files.length === 0 || (files.length === 1 && files[0] === ".git")) {
        copyRecursiveSync(source, SANDBOX_DIR);
      }
    }
  }

  // Ensure git repo initialized in sandbox so git diff works
  if (!fs.existsSync(path.join(SANDBOX_DIR, ".git"))) {
    try {
      execSync("git init && git config user.name 'ContribForge Agent' && git config user.email 'agent@contribforge.dev'", {
        cwd: SANDBOX_DIR,
        stdio: "ignore"
      });
    } catch {}
  }

  return SANDBOX_DIR;
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      if (childItemName === "node_modules" || childItemName === ".git") return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

export function runSandboxCommand(command, timeoutMs = 45000) {
  initSandbox();
  const startTime = Date.now();
  try {
    const stdout = execSync(command, {
      cwd: SANDBOX_DIR,
      encoding: "utf-8",
      timeout: timeoutMs,
      env: { ...process.env, NODE_ENV: "test", CI: "true" }
    });
    const durationMs = Date.now() - startTime;
    return {
      success: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: "",
      durationMs
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      exitCode: err.status || 1,
      stdout: (err.stdout || "").trim(),
      stderr: (err.stderr || err.message || "").trim(),
      durationMs
    };
  }
}

export function writeSandboxFile(filePath, content) {
  initSandbox();
  const targetPath = path.resolve(SANDBOX_DIR, filePath);
  // Prevent directory traversal attacks outside sandbox
  if (!targetPath.startsWith(SANDBOX_DIR)) {
    throw new Error(`Security Violation: Target path ${filePath} escapes the sandbox root.`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf-8");
  return { success: true, path: filePath, bytesWritten: Buffer.byteLength(content, "utf-8") };
}

export function readSandboxFile(filePath) {
  initSandbox();
  const targetPath = path.resolve(SANDBOX_DIR, filePath);
  if (!targetPath.startsWith(SANDBOX_DIR)) {
    throw new Error(`Security Violation: Target path ${filePath} escapes the sandbox root.`);
  }
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(targetPath, "utf-8");
}

export function listSandboxFiles(subPath = "") {
  initSandbox();
  const targetDir = path.resolve(SANDBOX_DIR, subPath);
  if (!targetDir.startsWith(SANDBOX_DIR)) {
    throw new Error(`Security Violation: Path escapes sandbox root.`);
  }
  if (!fs.existsSync(targetDir)) return [];

  function walk(dir, base = "") {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      if (file === "node_modules" || file === ".git") return;
      const fullPath = path.join(dir, file);
      const relPath = path.join(base, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push({ path: relPath.replace(/\\/g, "/"), type: "directory" });
        results = results.concat(walk(fullPath, relPath));
      } else {
        results.push({ path: relPath.replace(/\\/g, "/"), type: "file", sizeBytes: stat.size });
      }
    });
    return results;
  }

  return walk(targetDir);
}

export function getSandboxPath() {
  return SANDBOX_DIR;
}
