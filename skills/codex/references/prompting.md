# Codex & GPT-5.4 Prompting Guide

Use this reference when composing non-trivial `task` prompts for Codex (`scripts/codex-companion.mjs task`).

Prompt Codex like an operator, not a collaborator. Keep prompts compact and structured with XML tags. State the task, the output contract, the follow-through defaults, and only the extra constraints that matter.

## Core Rules

- Prefer one clear task per Codex run. Split unrelated asks into separate runs.
- State explicitly what "done" looks like; do not assume Codex will infer the end state.
- Add explicit grounding and verification rules whenever unsupported guesses would hurt quality.
- Prefer tighter prompt contracts over raising `--effort` or writing long prose.
- Use `task --resume` for follow-up turns on the same thread; send only the delta instruction unless the direction changed materially.
- Do not inspect the repository or solve the task yourself before delegating when the user asked Codex to handle it—limit host-side work to shaping a clean prompt.

## Default Prompt Assembly Checklist

1. Define the concrete task, relevant repository/failure context, and expected end state in `<task>`.
2. Choose the smallest output contract (`<structured_output_contract>` or `<compact_output_contract>`) that makes the answer directly usable.
3. Add `<default_follow_through_policy>` so Codex acts without asking routine clarifying questions.
4. Selectively add task-specific blocks:
   - **Debugging or implementation**: `<completeness_contract>`, `<verification_loop>`, `<missing_context_gating>`.
   - **Write-capable tasks (`--write`)**: `<action_safety>` so edits stay tightly scoped.
   - **Review or root-cause analysis**: `<grounding_rules>`, `<dig_deeper_nudge>`.
   - **Research or recommendations**: `<research_mode>`, `<citation_rules>`.
   - **Long-running or tool-heavy tasks**: `<tool_persistence_rules>`, `<progress_updates>`.
5. Trim redundant instructions before invoking Codex.

## Reusable XML Prompt Blocks

### Core Wrapper

```xml
<task>
Describe the concrete job, the relevant repository or failure context, and the expected end state.
</task>
```

### Output and Format

```xml
<structured_output_contract>
Return exactly the requested output shape and nothing else.
Keep the answer compact.
Put the highest-value findings or decisions first.
</structured_output_contract>
```

```xml
<compact_output_contract>
Keep the final answer compact and structured.
Do not include long scene-setting or repeated recap.
</compact_output_contract>
```

### Follow-Through and Completion

```xml
<default_follow_through_policy>
Default to the most reasonable low-risk interpretation and keep going.
Only stop to ask questions when a missing detail changes correctness, safety, or an irreversible action.
</default_follow_through_policy>
```

```xml
<completeness_contract>
Resolve the task fully before stopping.
Do not stop at the first plausible answer.
Check whether there are follow-on fixes, edge cases, or cleanup needed for a correct result.
</completeness_contract>
```

```xml
<verification_loop>
Before finalizing, verify the result against the task requirements and the changed files or tool outputs.
If a check fails, revise the answer instead of reporting the first draft.
</verification_loop>
```

### Grounding and Missing Context

```xml
<missing_context_gating>
Do not guess missing repository facts.
If required context is absent, retrieve it with tools or state exactly what remains unknown.
</missing_context_gating>
```

```xml
<grounding_rules>
Ground every claim in the provided context or your tool outputs.
Do not present inferences as facts.
If a point is a hypothesis, label it clearly.
</grounding_rules>
```

```xml
<citation_rules>
Back important claims with citations or explicit references to the source material you inspected.
Prefer primary sources.
</citation_rules>
```

### Safety, Scope, and Depth

```xml
<action_safety>
Keep changes tightly scoped to the stated task.
Avoid unrelated refactors, renames, or cleanup unless they are required for correctness.
Call out any risky or irreversible action before taking it.
</action_safety>
```

```xml
<tool_persistence_rules>
Keep using tools until you have enough evidence to finish the task confidently.
Do not abandon the workflow after a partial read when another targeted check would change the answer.
</tool_persistence_rules>
```

```xml
<research_mode>
Separate observed facts, reasoned inferences, and open questions.
Prefer breadth first, then go deeper only where the evidence changes the recommendation.
</research_mode>
```

```xml
<dig_deeper_nudge>
After you find the first plausible issue, check for second-order failures, empty-state behavior, retries, stale state, and rollback paths before you finalize.
</dig_deeper_nudge>
```

```xml
<progress_updates>
If you provide progress updates, keep them brief and outcome-based.
Mention only major phase changes or blockers.
</progress_updates>
```
