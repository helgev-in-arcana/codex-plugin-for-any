#!/usr/bin/env node
import { fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "../runtime/scripts/lib/args.mjs";
import { buildSetupReport, main as runCompanion } from "../runtime/scripts/codex-companion.mjs";

const entrypoint = fileURLToPath(import.meta.url);
const jobCommands = new Set(["review", "adversarial-review", "task"]);
const jobOptionsWithValues = new Set(["--cwd", "-C", "--model", "-m", "--effort", "--prompt-file", "--base", "--scope"]);
const lookupCommands = new Set(["status", "result", "cancel", "task-resume-candidate"]);

// Consume host execution flags and pass the remaining argv to the companion verbatim.
function executionMode(argv) {
  const args = [];
  let background = false;
  let wait = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      args.push(...argv.slice(i));
      break;
    }
    const [flag, value] = arg.split("=", 2);
    if (["--background", "-background", "--wait", "-wait"].includes(flag)) {
      if (value !== undefined && value !== "false" && value !== "true") {
        throw new Error(`Expected true or false for ${flag}.`);
      }
      if (flag.endsWith("background")) background = value !== "false";
      else wait = value !== "false";
    } else {
      if (flag === "--json" || flag === "-json") json = value !== "false";
      args.push(arg);
      if (jobOptionsWithValues.has(arg) && i + 1 < argv.length) args.push(argv[++i]);
    }
  }
  if (wait && background) throw new Error("Choose either --wait or --background.");
  return { args, background, json };
}

async function launchBackground(command, args) {
  // The upstream foreground path records the worker's PID, result and errors.
  // It acknowledges startup only after its job is visible to status and cancel.
  const worker = fork(entrypoint, ["--worker", command, ...args], {
    detached: true,
    stdio: ["inherit", "ignore", "ignore", "ipc"],
    windowsHide: true
  });
  try {
    return await new Promise((resolve, reject) => {
      worker.once("error", reject);
      worker.once("exit", (code, signal) => reject(new Error(`Codex worker exited during startup (${signal ?? code}).`)));
      worker.once("message", (message) => {
        if (message.error) reject(new Error(message.error));
        else resolve(message);
      });
    });
  } finally {
    if (worker.connected) worker.disconnect();
    worker.unref();
  }
}

async function setup(argv) {
  const { options, positionals } = parseArgs(argv, { valueOptions: ["cwd"], booleanOptions: ["json"], aliasMap: { C: "cwd" } });
  if (positionals.length) throw new Error(`Unknown setup argument: ${positionals[0]}`);
  const { ready, node, npm, codex, auth, sessionRuntime } = await buildSetupReport(path.resolve(options.cwd ?? "."));
  const nextSteps = [];
  if (!codex.available) nextSteps.push("Install Codex with npm install -g @openai/codex.");
  else if (!auth.loggedIn && auth.requiresOpenaiAuth) nextSteps.push("Run codex login in your terminal.");
  if (options.json) {
    console.log(JSON.stringify({ ready, node, npm, codex, auth, sessionRuntime, nextSteps }, null, 2));
  } else {
    console.log([`Codex setup: ${ready ? "ready" : "needs attention"}`, node.detail, codex.detail, auth.detail, ...nextSteps].join("\n"));
  }
}

async function run([command, ...argv]) {
  if (!command || ["help", "--help", "-h"].includes(command) ||
      (argv.length === 1 && ["--help", "-h"].includes(argv[0]))) {
    console.log(fs.readFileSync(new URL("./usage.txt", import.meta.url), "utf8").trimEnd());
    return;
  }
  if (command === "--worker" && process.connected && jobCommands.has(argv[0])) {
    return runCompanion(argv);
  }
  if (command === "setup") return setup(argv);
  if (lookupCommands.has(command)) return runCompanion([command, ...argv]);
  if (!jobCommands.has(command)) throw new Error(`Unknown command: ${command}. See --help.`);

  const { args, background, json } = executionMode(argv);
  if (!background) return runCompanion([command, ...args]);
  const launch = await launchBackground(command, args);
  console.log(json ? JSON.stringify(launch) : `${launch.title} started. Check progress with status ${launch.jobId}.`);
}

run(process.argv.slice(2)).catch((error) => {
  if (process.connected) process.send({ error: error.message });
  console.error(error.message);
  process.exitCode = 1;
});
