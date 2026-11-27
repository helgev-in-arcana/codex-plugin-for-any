---
name: codex
description: Use the local OpenAI Codex CLI for a second-opinion code review, a focused adversarial review, or a delegated investigation or coding task. Use this skill when the user requests Codex or wants to check, resume, or cancel a delegated Codex job.
license: Apache-2.0
compatibility: Requires Node.js 18.18 or later, the OpenAI Codex CLI, and Git for repository reviews.
---

# Codex Companion

Resolve `scripts/codex-companion.mjs` relative to this SKILL.md. Invoke its absolute path with Node from the user's project. In the examples, `$companion` stands for that absolute path. Pass `--cwd <project>` if the current working directory differs. Run `node "$companion" --help` for the command list.

## Setup

Run `node "$companion" setup --json` to check availability and authentication. If Codex is missing, ask before installing it with `npm install -g @openai/codex`. If the configured provider requires OpenAI authentication, direct the user to `codex login` in their terminal.

## Reviews

- Use `node "$companion" review` for the current changes or add `--base <ref>` for a branch comparison. The native reviewer accepts a target and uses its own review prompt.
- Use `node "$companion" adversarial-review --base <ref> "focus"` for a design challenge or a targeted review with structured findings.
- Run a small review in the foreground. For a long review, add `--background --json`, retain the returned job ID, and use it to retrieve the result.
- Report findings with their locations, severity, and uncertainty. End a review after presenting the findings unless the user has also requested implementation.

## Delegation

Use `node "$companion" task "prompt"` for read-only work. Add `--write` when the user requests edits. Use `--prompt-file <path>` or stdin for multiline prompts. See [prompting guidance](references/prompting.md) and [prompt recipes](references/prompt-recipes.md) when shaping a complex task.

Use `task-resume-candidate --json` to find an earlier thread before a follow-up. Use `task --resume "prompt"` for a continuation or `task --fresh "prompt"` for independent work.

## Parallel workers

Pass the worker’s assigned working copy as `--cwd` on every call. Give each worker invocation a unique `CODEX_COMPANION_SESSION_ID` and its own absolute `CODEX_COMPANION_STATE_DIR` in a writable temporary or data directory outside the reviewed tree. The session ID scopes implicit lookup. The separate directory also isolates writes to the workspace job index when several workers share a checkout.

For example, initialize one worker in a POSIX shell:

```sh
export CODEX_COMPANION_STATE_DIR="$(mktemp -d)"
export CODEX_COMPANION_SESSION_ID="$(basename "$CODEX_COMPANION_STATE_DIR")"
node "$companion" review --cwd "$worker_dir" --background --json
```

Keep the absolute state path, session ID, working copy and returned job ID together. Reuse those values in each new shell, including for `task --resume`, `status`, `result`, and `cancel`. Create the temporary directory only once per worker. A role name like `verifier` can recur in different swarms.

## Background jobs

`review`, `adversarial-review`, and `task` accept `--background`. Each worker runs its own Codex process. Keep the job ID to identify the work across invocations.

```sh
node "$companion" status "$job_id" --wait --timeout-ms 240000 --json
node "$companion" result "$job_id"
node "$companion" cancel "$job_id"
```

The upstream renderer sometimes prints Claude-style command names. For example, run its `/codex:status ID` hint as `node "$companion" status ID`. Use `cancel` when the user requests cancellation. For status without waiting, omit `--wait`. Job records are stored per workspace under the OS temporary directory. Set `CODEX_COMPANION_STATE_DIR` to choose a persistent location. See [result handling](references/result-handling.md) when presenting output or reporting a failed run.
