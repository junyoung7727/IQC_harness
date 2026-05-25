# WorldQuant Multi-Agent Harness

## Purpose
This harness centralizes alpha intake, duplicate rejection, execution queueing, and result storage.

## Source of truth
- Canonical DB: `C:\Users\user\worldquant-multi-agent-harness\data\harness.db`
- Server state beats local notes.
- Mutate harness state only through the CLI or server API.

## Roles
- Generator agent: creates and submits new alphas only.
- Execution agent: requests leased work, runs BRAIN, and submits observed results.
- Server: stores alphas, rejects near-duplicates, manages queue state, stores execution outputs.

## Generator hard rules
- Do not log into BRAIN.
- Do not run simulations.
- Do not request worker leases.
- Do not submit results or failures.
- Do not bypass similarity screening.
- A draft is complete only when the CLI returns `status=accepted` or `status=rejected_similarity`.
- Similarity rejection happens when `max_similarity > 0.70`.
- Syntax fixes, typing fixes, setting fixes, and reruns do not create a new alpha lineage.

## Execution hard rules
- Request work only through `request next alpha 3`.
- One lease belongs to one worker, one BRAIN account, and one Chrome profile.
- Submit observed settings and observed metrics back to the server after each run.

## Pointers
- Exact CLI commands and response keys: `docs/cli-contract.md`
- Generator-only operating rules: `agents/generator-agent.md`
- Shared workflow and canonical paths: `agents/common-harness-workflow.md`
- Field/operator lookup protocol: `rules/how-to-find-wirght-field.md`

## Fail-closed rule
If local notes disagree with the server state, stop and reconcile against the server first.
