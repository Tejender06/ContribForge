import simpleGit from "simple-git";
import { getSandboxPath } from "./sandbox.mjs";

export async function getGitDiff() {
  const sandboxDir = getSandboxPath();
  const git = simpleGit(sandboxDir);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        isRepo: false,
        diff: "Sandbox is not currently tracked by git. (Files are modified in sandbox directory).",
        filesChanged: []
      };
    }

    const diff = await git.diff();
    const status = await git.status();

    return {
      isRepo: true,
      diff: diff || "No uncommitted modifications found.",
      filesChanged: status.files.map((f) => ({
        path: f.path,
        working_dir: f.working_dir,
        index: f.index
      }))
    };
  } catch (err) {
    return {
      isRepo: false,
      diff: `Git diff error: ${err.message}`,
      filesChanged: []
    };
  }
}
