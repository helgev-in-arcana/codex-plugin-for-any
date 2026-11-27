import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const plugin = path.join(root, "plugins", "codex");
const output = path.join(root, "skills", "codex", "runtime");
const check = process.argv[2] === "--check";
if (process.argv.length !== (check ? 3 : 2)) {
  throw new Error("Usage: node scripts/build-universal-skill.mjs [--check]");
}

const scratch = fs.mkdtempSync(path.join(check ? os.tmpdir() : path.dirname(output), ".codex-skill-build-"));
const staging = path.join(scratch, "runtime");
try {
  // Match the companion's relative imports and runtime asset paths.
  for (const relative of [
    "scripts/codex-companion.mjs", "scripts/lib", "prompts/adversarial-review.md",
    "schemas/review-output.schema.json", "LICENSE", "NOTICE"
  ]) {
    fs.cpSync(path.join(plugin, relative), path.join(staging, relative), {
      recursive: true,
      filter: (source) => !source.endsWith(".d.ts")
    });
  }
  fs.copyFileSync(path.join(root, "plugin.json"), path.join(staging, "plugin.json"));

  // Use an isolated repository so git apply always uses the staging root,
  // including when TMPDIR is inside the checkout.
  const gitEnv = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete gitEnv[key];
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: staging, env: gitEnv, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status;
  };
  if (git(["init", "--quiet"]) !== 0 ||
      git(["apply", path.join(root, "universal", "runtime.patch")]) !== 0) {
    throw new Error("Update universal/runtime.patch against plugins/codex and rebuild.");
  }
  fs.rmSync(path.join(staging, ".git"), { recursive: true });

  if (check) {
    if (!fs.existsSync(output) || git(["diff", "--no-index", "--exit-code", "--no-ext-diff", "--stat", output, staging]) !== 0) {
      throw new Error("The checked-in runtime is stale. Run node scripts/build-universal-skill.mjs.");
    }
  } else {
    // Stage on the destination filesystem; restore the last complete runtime if publication fails.
    const previous = path.join(scratch, "previous");
    if (fs.existsSync(output)) fs.renameSync(output, previous);
    try {
      fs.renameSync(staging, output);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, output);
      throw error;
    }
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
