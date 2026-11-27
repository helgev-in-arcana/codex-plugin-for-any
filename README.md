# Codex Companion (Universal Agent Skill & Plugin)

Use your local [OpenAI Codex CLI](https://developers.openai.com/codex/cli/) from **Antigravity**, **Claude Code**, **Cursor**, **GitHub Copilot**, **Gemini CLI**, **Codex CLI**, or any other coding agent that supports the open [Agent Skills](https://agentskills.io/specification) standard—or directly from any terminal.

> Adapted from `openai/codex-plugin-cc` by removing Claude Code-specific interfaces (`.claude-plugin`, slash command templates, proprietary hooks, and Claude session transfer) and packaging the companion runtime as a self-contained universal Agent Skill and plugin.

## What You Get

- **Read-only code reviews (`review`)**: Runs Codex's native built-in reviewer against uncommitted changes or a branch diff (`--base <ref>`).
- **Adversarial design reviews (`adversarial-review`)**: Steerable challenge review with structured JSON findings that pressure-tests assumptions, tradeoffs, and failure modes.
- **Task delegation (`task`)**: Delegates investigation, diagnosis, research, or write-capable (`--write`) fixes to a persistent Codex thread with `--resume` / `--fresh`, `--model` (including `spark` -> `gpt-5.3-codex-spark`), and `--effort`.
- **Universal background execution (`--background`)**: Detached background workers for `review`, `adversarial-review`, and `task` with `status`, `status <id> --wait`, `result`, and `cancel` (`turn/interrupt` + process teardown).
- **Shared app-server broker**: Lazily starts and reuses a single local `codex app-server` per workspace, with automatic idle shutdown (default 30 minutes) and an explicit `shutdown` command.

## Requirements

- **Node.js 18.18 or later** (zero external runtime dependencies)
- **Git** (required for `review` and `adversarial-review`)
- **OpenAI Codex CLI** (`npm install -g @openai/codex`) with a ChatGPT subscription or API key (or a custom provider in `~/.codex/config.toml`)

## Installation

### Option 1: Antigravity Plugin (App / CLI / IDE)

Install directly from GitHub or a local clone:

```bash
agy plugin install https://github.com/helgev-in-arcana/codex-plugin-for-any
```

Or copy/clone this repository into `.agents/plugins/codex` (workspace) or `~/.gemini/config/plugins/codex` (global). Once installed, Antigravity exposes the skill automatically and as `/codex`.

### Option 2: Universal Skill Installer (`npx skills` — 75+ Agents)

Works with Antigravity, Claude Code, Cursor, Windsurf, GitHub Copilot, Gemini CLI, OpenCode, and more:

```bash
npx skills add helgev-in-arcana/codex-plugin-for-any
```

Add `-g` to install globally across projects.

### Option 3: Manual Skill Copy (Any Agent Skills Client)

Because `skills/codex/` is completely self-contained, copy or symlink it directly into your agent's skill directory:

```bash
# Workspace-scoped (Antigravity, Codex, Cursor, etc.)
cp -R skills/codex /path/to/your-project/.agents/skills/codex

# Global (Antigravity)
cp -R skills/codex ~/.gemini/config/skills/codex

# Global (Claude Code)
cp -R skills/codex ~/.claude/skills/codex
```

### Option 4: Direct CLI Usage (No Skill Loader Needed)

Run the companion CLI directly or link it globally:

```bash
node skills/codex/scripts/codex-companion.mjs --help
```

## Quick Start

1. Verify Node.js, Codex CLI, and authentication:
   ```bash
   node skills/codex/scripts/codex-companion.mjs setup
   ```
   If Codex is missing: `npm install -g @openai/codex`.
   If not signed in: `codex login` (or `codex login --device-auth` / `codex login --with-api-key`).

2. Run a code review:
   ```bash
   node skills/codex/scripts/codex-companion.mjs review
   node skills/codex/scripts/codex-companion.mjs review --base main --background
   ```

3. Run an adversarial design review:
   ```bash
   node skills/codex/scripts/codex-companion.mjs adversarial-review --base main "challenge retry safety and auth boundaries"
   ```

4. Delegate a task to Codex:
   ```bash
   # Read-only diagnosis
   node skills/codex/scripts/codex-companion.mjs task "diagnose why the integration test is flaky"

   # Write-capable fix
   node skills/codex/scripts/codex-companion.mjs task --write "fix the failing parser test with the smallest safe patch"

   # Continue the previous Codex thread
   node skills/codex/scripts/codex-companion.mjs task --write --resume "add a regression test for the empty-input case"

   # Model / effort overrides (`spark` -> `gpt-5.3-codex-spark`)
   node skills/codex/scripts/codex-companion.mjs task --model spark --effort low "summarize the auth flow"
   ```

5. Manage background jobs and the shared broker:
   ```bash
   node skills/codex/scripts/codex-companion.mjs status
   node skills/codex/scripts/codex-companion.mjs status <job-id> --wait
   node skills/codex/scripts/codex-companion.mjs result [job-id]
   node skills/codex/scripts/codex-companion.mjs cancel [job-id]
   node skills/codex/scripts/codex-companion.mjs shutdown
   ```

All commands accept `-C, --cwd <path>` to target a specific repository and `--json` for machine-readable output.

## Configuration & Environment Variables

Codex Companion delegates to your local `codex` binary and inherits both `~/.codex/config.toml` and trusted project-level `.codex/config.toml` settings (model, reasoning effort, custom providers, `openai_base_url`).

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `CODEX_COMPANION_STATE_DIR` | Override root directory for job state, logs, and broker metadata (defaults to `$PLUGIN_DATA/state`, or `<os.tmpdir()>/codex-companion`) |
| `CODEX_COMPANION_SESSION_ID` | Isolate `status`, `result`, `cancel`, and `--resume` lookup to a specific agent session |
| `CODEX_COMPANION_CLIENT_NAME` | Override `clientInfo.name` reported to `codex app-server` (default: `codex-companion`) |
| `CODEX_COMPANION_BROKER_IDLE_MS` | Idle timeout in milliseconds before the shared broker exits automatically (default: `1800000` / 30 min; `0` disables) |

## Repository Layout

```text
.
├── plugin.json                     # Antigravity / universal plugin manifest
├── skills/
│   └── codex/                      # Self-contained Agent Skill (agentskills.io)
│       ├── SKILL.md                # Skill metadata, decision tree, workflows, gotchas
│       ├── assets/
│       │   ├── prompts/            # Adversarial review prompt template
│       │   └── schemas/            # Structured review output JSON Schema
│       ├── references/             # On-demand prompting & result-handling guides
│       └── scripts/                # Zero-dependency Node.js companion runtime
│           ├── codex-companion.mjs
│           ├── app-server-broker.mjs
│           └── lib/
├── scripts/bump-version.mjs        # Synchronizes version metadata across manifests
└── tests/                          # Unit, runtime, and Agent Skills spec tests
```

## Development & Testing

```bash
npm test
npm run check-version
npm run build   # requires local `codex` binary to generate app-server TS types
```

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
