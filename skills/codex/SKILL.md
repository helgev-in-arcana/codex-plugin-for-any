---
name: codex
description: Delegates code reviews, adversarial design challenges, and deep coding or debugging tasks to the local OpenAI Codex CLI via the shared app-server companion runtime. Use when the user asks to run Codex, wants a second-opinion or adversarial review of local git changes, wants to offload a root-cause investigation or implementation task to Codex, or wants to inspect, wait for, or cancel background Codex jobs. Do not use for trivial edits or quick questions the host agent can handle directly.
license: Apache-2.0
compatibility: Requires Node.js 18.18+, Git (for code reviews), and the local OpenAI Codex CLI (@openai/codex).
metadata:
  version: "2.0.0"
---

# Codex Companion

Control the local OpenAI Codex CLI (`codex app-server`) through the bundled helper script `scripts/codex-companion.mjs`. Run `node scripts/codex-companion.mjs --help` or `<command> --help` for full flag details rather than reading script source code.

## Decision Tree

Choose the subcommand that matches the user's intent:

| Goal | Subcommand | Notes |
| --- | --- | --- |
| Check install, auth, and runtime | `setup` | Pass `--json` to inspect structured readiness fields |
| Standard read-only code review | `review` | Native Codex reviewer; no custom focus text |
| Design challenge / focused review | `adversarial-review` | Steerable, read-only, structured findings |
| Investigate, diagnose, plan, or fix | `task` | Persistent Codex thread; add `--write` to allow edits |
| Check for a resumable task thread | `task-resume-candidate` | Run with `--json` before starting follow-up work |
| Inspect running or recent jobs | `status [job-id]` | Supports `--wait` (requires `job-id`) and `--all` |
| Fetch final output of a finished job | `result [job-id]` | Includes `codex resume <session-id>` command |
| Stop an active background job | `cancel [job-id]` | Sends `turn/interrupt` and terminates worker |
| Stop the shared app-server broker | `shutdown` | Optional cleanup; brokers also auto-exit when idle |

Always pass `--cwd <target-repo-path>` whenever the shell's working directory is not the target repository (for example, when invoking `scripts/codex-companion.mjs` from the skill directory).

## Workflows

### 1. Setup and Authentication

```bash
node scripts/codex-companion.mjs setup --cwd <repo-path> --json
```

- If `codex.available` is `false` and `npm.available` is `true`, ask the user before installing with `npm install -g @openai/codex`, then rerun `setup`.
- If `codex.available` is `true` and `auth.loggedIn` is `false`, instruct the user to authenticate in their terminal with `codex login` (or `codex login --device-auth` / `codex login --with-api-key`). Do not improvise alternative authentication flows.

### 2. Code Review (Read-Only)

Use `review` for a standard Codex review of uncommitted changes or a branch diff. Use `adversarial-review` when the user wants to pressure-test architecture, tradeoffs, assumptions, or specific risk areas (auth, concurrency, data loss, rollback).

Before deciding foreground vs. background (unless the user explicitly passed `--wait` or `--background`), check the change scope:
- Working tree: `git status --short --untracked-files=all`, `git diff --shortstat --cached`, and `git diff --shortstat`.
- Branch review: `git diff --shortstat <base>...HEAD`.
- Prefer foreground (`--wait`) only when the diff is clearly small (~1–2 files). Prefer `--background` for larger, multi-file, or unclear scopes.

```bash
# Standard review (uncommitted changes, or branch diff if working tree is clean)
node scripts/codex-companion.mjs review --cwd <repo-path> [--base <ref>] [--scope auto|working-tree|branch] [--wait|--background]

# Adversarial review with optional focus text
node scripts/codex-companion.mjs adversarial-review --cwd <repo-path> [--base <ref>] [--scope auto|working-tree|branch] [--wait|--background] [focus text]
```

**Review-only constraint**: After presenting review findings, STOP. Do not edit files, apply patches, or auto-fix issues—even obvious ones—until the user explicitly confirms which items to fix.

### 3. Delegating Tasks

Use `task` when offloading root-cause debugging, deep investigation, research, or implementation to Codex.

1. **Check thread continuity**: If the user did not explicitly specify `--resume` or `--fresh`, check for a resumable thread:
   ```bash
   node scripts/codex-companion.mjs task-resume-candidate --cwd <repo-path> --json
   ```
   - If `available: true` and the request is clearly a follow-up ("continue", "apply the top fix", "dig deeper"), pass `--resume`.
   - If `available: true` and the request is ambiguous, ask the user whether to continue the existing Codex thread (`--resume`) or start fresh (`--fresh`).
2. **Shape the prompt**: Read [references/prompting.md](references/prompting.md) before writing a non-trivial task prompt for Codex/GPT-5.4. Read [references/prompt-recipes.md](references/prompt-recipes.md) if you want a concrete XML template (diagnosis, narrow fix, root-cause review, research, or prompt-patching).
3. **Choose permissions and execution mode**:
   - Pass `--write` when Codex should modify workspace files. Omit `--write` for read-only diagnosis, planning, or research.
   - Use foreground (`--wait`) for small, bounded requests; use `--background` for complex, multi-step, or long-running work.
   - Leave `--model` and `--effort` unset unless the user explicitly asks for them. If the user asks for `spark`, pass `--model spark` (mapped automatically to `gpt-5.3-codex-spark`). Valid `--effort` values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`.
4. **Invoke the task**:
   ```bash
   node scripts/codex-companion.mjs task --cwd <repo-path> [--write] [--wait|--background] [--resume|--fresh] [--model <model|spark>] [--effort <level>] "<prompt>"
   ```
   For multi-line or structured XML prompts, pass `--prompt-file <path>` or pipe via stdin instead of shell-escaping long strings.

### 4. Managing Background Jobs

When a `review`, `adversarial-review`, or `task` runs with `--background`, the script queues a detached worker and returns a `jobId` immediately.

```bash
# List active and recent jobs
node scripts/codex-companion.mjs status --cwd <repo-path>

# Wait for a specific background job (exits when done or on --timeout-ms)
node scripts/codex-companion.mjs status <job-id> --cwd <repo-path> --wait --timeout-ms 240000

# Retrieve stored output and `codex resume <session-id>` command
node scripts/codex-companion.mjs result [job-id] --cwd <repo-path>

# Cancel an active job
node scripts/codex-companion.mjs cancel [job-id] --cwd <repo-path>
```

## Presenting Results

Read [references/result-handling.md](references/result-handling.md) before presenting Codex outputs, review findings, or failure diagnostics to the user.

## Gotchas

- **Never substitute for a failed Codex run**: If Codex fails, times out, or is unavailable, report the actionable stderr lines and stop. Do not silently generate a host-agent implementation or review as a substitute for Codex's answer.
- **Preserve evidence boundaries**: Keep file paths, line numbers, severities, and `codex resume <session-id>` commands verbatim from the helper output.
- **`review` vs `adversarial-review` flags**: `review` maps directly to Codex's native reviewer and rejects custom focus text. Neither command supports `--scope staged` or `--scope unstaged`; valid scopes are `auto`, `working-tree`, and `branch` (or `--base <ref>`).
- **Untracked files count**: When estimating review size, treat untracked files as reviewable work even when `git diff --shortstat` is empty.
- **State isolation**: Job state defaults to the OS temp directory (or `$CODEX_COMPANION_STATE_DIR` / `$PLUGIN_DATA`). Set `CODEX_COMPANION_SESSION_ID` if you want to isolate job lists per agent session.
- **Shared broker lifecycle**: The first `review` or `task` lazily starts a shared `codex app-server` broker that automatically shuts down after 30 minutes of inactivity (configurable via `CODEX_COMPANION_BROKER_IDLE_MS`). Run `shutdown` if you want to stop it immediately.
