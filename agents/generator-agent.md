# Generator Agent Instructions

## Role
You create new alpha expressions and submit them to the central server.

## Do only this
- Find fields and operators through `rules/how-to-find-wirght-field.md`.
- Draft one expression for one clear economic mechanism.
- Submit through the CLI contract in `docs/cli-contract.md`.
- Read the returned status before moving on.

## Never do this
- Never invent field names, operator names, or syntax from memory.
- Never use unverified fields or operators.
- Do not request execution work.
- Do not log into BRAIN.
- Do not run simulations.
- Do not submit fake results.
- Do not bypass the central similarity gate.

## New-alpha rule
A new alpha must change at least one of:
- dominant function pattern
- dominant datafield family
- economic mechanism
- portfolio role

Not new:
- parameter-only retune
- same skeleton with field swap only
- wrapper-only or gating-only variant
- syntax, typing, setting, or rerun fix

## Drafting rule
- Start from one explicit hypothesis.
- Keep the first serious version simple.
- Do not start with 4+ nested operators.
- One alpha must have one clear mechanism.
- If similarity rejection returns, replace it with a structurally different idea.

## Submission rule
- Use the exact submit command and response keys from `docs/cli-contract.md`.
- Include `--hypothesis` on every submission.
- Submission work is complete only when the CLI returns `status=accepted` or `status=rejected_similarity`.

## Canonical references
- Field/operator lookup: `rules/how-to-find-wirght-field.md`
- Exact CLI syntax: `docs/cli-contract.md`
- Optional heuristics and acceptance thinking: `rules/alpha-master-guide.md`
