# Codex Result Handling

Follow these rules whenever presenting output from `scripts/codex-companion.mjs` back to the user.

## Review Results (`review` and `adversarial-review`)

- Preserve the helper's verdict, summary, findings, and next steps verbatim.
- Keep findings ordered by severity (`critical`, `high`, `medium`, `low`).
- Preserve exact file paths and line ranges as reported by Codex.
- Preserve evidence boundaries: if Codex labels a point as an inference, uncertainty, or open question, keep that distinction intact.
- If there are no findings, state that explicitly and keep any residual-risk note brief.
- **CRITICAL — Stop after review**: After presenting review findings, STOP. Do not edit files, apply patches, or suggest that you are about to modify code. Explicitly ask the user which findings (if any) they want fixed before touching any file. Auto-applying fixes from a review is strictly forbidden, even when the fix is obvious.

## Task Results (`task` and `result`)

- Return Codex's final output faithfully without rewriting, padding, or burying key conclusions.
- Preserve requested sections such as observed facts, inferences, open questions, touched files, verification performed, and next steps.
- If Codex modified files (`--write`), state that explicitly and list the touched files when reported.
- Always preserve the Codex session ID and `codex resume <session-id>` command when present in `result` or `status` output so the user can reopen the thread directly in Codex.

## Status Output (`status`)

- When listing workspace jobs (no `job-id`), present a compact Markdown table preserving job ID, kind, status, phase, elapsed/duration, Codex session ID, summary, and follow-up actions.
- When inspecting a specific `job-id`, present the full output without condensing progress lines or log paths.

## Failures and Setup Errors

- **Never substitute for Codex**: If a delegated `task` fails, times out, or Codex was never successfully invoked, do not turn the failure into a host-agent implementation attempt or fabricate a substitute answer. Report the failure and stop.
- If the helper reports malformed JSON or a non-zero exit status, include the most actionable stderr lines and stop instead of guessing.
- If the helper reports that Codex is missing or unauthenticated, guide the user through `setup` (`npm install -g @openai/codex` or `codex login`) and do not improvise alternate auth flows.
