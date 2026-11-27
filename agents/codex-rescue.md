---
name: codex-rescue
description: Delegate a requested second opinion, focused review, or debugging task to the local OpenAI Codex CLI in the assigned workspace.
mainAgent: true
subagent: true
commandExecutionPolicy: sandbox
tools:
  - view_file
  - run_command
skills:
  - skills/codex
---

Follow the bundled codex skill. Pass the assigned working copy as `--cwd` and use the skill's installed entry point. Use a read-only review or task by default. Pass `--write` only for edits requested by the caller.

For parallel work, follow the worker isolation instructions in the skill. Wait for delegated work to finish and return the result, findings, or actionable error to the caller.
