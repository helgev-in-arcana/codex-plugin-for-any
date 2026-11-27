import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildEnv, installFakeCodex } from "./fake-codex-fixture.mjs";
import { initGitRepo, run } from "./helpers.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("the distributable matches the upstream runtime and universal adapter", () => {
  const result = run(process.execPath, ["scripts/build-universal-skill.mjs", "--check"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("a copied skill runs reviews and tasks independently of the plugin checkout", (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "installed-codex-skill-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const skill = path.join(tmp, "installed skill");
  const repo = path.join(tmp, "target project");
  const bin = path.join(tmp, "bin");
  const state = path.join(tmp, "job state");
  fs.cpSync(path.join(root, "skills", "codex"), skill, { recursive: true });
  fs.mkdirSync(repo);
  fs.mkdirSync(bin);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "sample.txt"), "review me\n");
  installFakeCodex(bin);
  const env = {
    ...buildEnv(bin),
    CODEX_COMPANION_STATE_DIR: state,
    CODEX_COMPANION_SESSION_ID: "installed-skill-test",
    CODEX_COMPANION_APP_SERVER_ENDPOINT: "unix:/unused-host-broker"
  };
  for (const key of Object.keys(env).filter((name) => name.startsWith("CLAUDE_"))) delete env[key];

  const script = path.join(skill, "scripts", "codex-companion.mjs");
  const call = (command, ...args) => {
    const result = run(process.execPath, [script, command, "--cwd", repo, "--json", ...args], { cwd: tmp, env });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  const setup = call("setup");
  assert.equal(setup.ready, true);
  assert.equal(setup.sessionRuntime.mode, "direct");
  assert.match(call("review").codex.stdout, /No material issues found/);
  for (const command of ["adversarial-review", "task"]) {
    const { jobId } = call(command, "--background", "inspect the change");
    assert.ok(jobId);
    const status = call("status", jobId, "--wait", "--timeout-ms", "20000", "--poll-interval-ms", "50");
    assert.equal(status.job.status, "completed");
    const result = call("result", jobId);
    assert.equal(result.job.id, jobId);
    if (command === "adversarial-review") assert.match(JSON.stringify(result), /Missing empty-state guard/);
  }
  installFakeCodex(bin, "interruptible-slow-task");
  const { jobId } = call("task", "--background", "wait for cancellation");
  assert.equal(call("cancel", jobId).status, "cancelled");
  assert.equal(call("status", jobId).job.status, "cancelled");
  const invalid = run(process.execPath, [script, "review", "--background", "--wait"], { cwd: repo, env });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Choose either/);
  assert.equal(call("setup").ready, true);
  const [workspace] = fs.readdirSync(state);
  assert.equal(fs.existsSync(path.join(state, workspace, "broker.json")), false);
  for (const name of ["LICENSE", "NOTICE"]) {
    assert.deepEqual(fs.readFileSync(path.join(skill, "runtime", name)), fs.readFileSync(path.join(root, name)));
  }
});
