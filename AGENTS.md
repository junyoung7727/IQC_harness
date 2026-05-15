# WorldQuant Multi-Agent Harness

## Purpose
This project defines a standalone harness for centralized alpha intake, duplicate screening, queue assignment, and independent WorldQuant BRAIN execution by multiple agents.

## Core operating model
- Generator agents create alphas and submit them to the central server through the CLI.
- The central server is the source of truth for alpha storage, similarity rejection, queue state, and result storage.
- Brain execution agents do not invent alphas during execution work. They request pending work from the server, run simulations in BRAIN with their assigned account and isolated browser profile, and submit results back to the server.
- Local markdown files may be kept by workers, but any conflict resolves in favor of the central server state.
- The canonical local database path for this harness is `C:\Users\user\worldquant-multi-agent-harness\data\harness.db`.

## Required workflow
1. Read `INDEX.md` first.
2. Read `agents/common-harness-workflow.md` before any generator or execution work.
3. Read `agents/generator-agent.md` before drafting or submitting a new alpha.
4. Read `agents/brain-execution-agent.md` before requesting work or running BRAIN execution.
5. Read `rules/alpha-creation-rules.md` before drafting or submitting a new alpha.
6. Read `rules/alpha-acceptance-gates.md` before calling an alpha good, strong, or promotable.
7. Read `rules/harness-workflow.md` before using the CLI or running BRAIN execution work.
8. Use the CLI contract in `docs/cli-contract.md` exactly as written.
9. Treat `docs/central-server-spec.md` as the source of truth for server responsibilities.
10. Treat `docs/execution-lifecycle.md` as the source of truth for queue state, worker reservation, retry handling, and queue drain behavior.
11. Use `C:\Users\user\worldquant-alpha-lab\worldquant-login.md` as the credential and Chrome-profile source for real BRAIN execution.

## Hard boundaries
- The central server decides whether a submitted alpha is stored.
- A submitted alpha is rejected before storage if its highest similarity against any alpha already in the database is greater than `0.80`.
- Similarity is computed from parsed function usage and parsed datafield usage only.
- Generator agents must not bypass similarity screening.
- Brain execution agents must only request work in batches of 3 through the CLI.
- Brain execution agents must only work on alphas that arrived from `request next alpha 3`.
- Brain execution agents must submit observed settings and observed simulation outputs back to the server after each run.
- A syntax fix, typing fix, platform setting fix, or workflow rerun does not create a new alpha lineage by itself.

## Worker model
- Each Brain execution agent is tied to one BRAIN account.
- Each Brain execution agent uses one isolated Chrome profile.
- Execution agents are independent from each other and may run in parallel.
- The central server does not log into BRAIN and does not run simulations.

## Minimum project files
- `INDEX.md` - top-level navigation.
- `agents/common-harness-workflow.md` - shared mandatory workflow.
- `agents/generator-agent.md` - generator-only instructions.
- `agents/brain-execution-agent.md` - execution-only instructions.
- `rules/alpha-creation-rules.md` - drafting, anti-duplication, and error-handling defaults.
- `rules/alpha-acceptance-gates.md` - good-alpha bar.
- `rules/harness-workflow.md` - CLI workflow and role boundaries.
- `docs/central-server-spec.md` - minimal server behavior.
- `docs/execution-lifecycle.md` - queue and worker lifecycle.
- `docs/cli-contract.md` - CLI commands and payload rules.
- `docs/tdd-acceptance.md` - required end-to-end test scenarios.
- `docs/tdd-evidence.md` - explicit red-to-green development evidence.
- `schemas/alpha-record.md` - canonical alpha record shape.

## Fail-closed rule
If there is any disagreement between local notes and the server state, stop and reconcile against the server state before continuing.
