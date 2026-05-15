# Common Harness Workflow

## Canonical database path
- Use `C:\Users\user\worldquant-multi-agent-harness\data\harness.db` unless the user explicitly overrides it.
- Do not create ad-hoc temporary operating databases for normal harness use.
- Treat the canonical database as the only source of truth for stored alpha state.

## Shared read order
1. `AGENTS.md`
2. this file
3. your role-specific file in `agents/`
4. `rules/alpha-creation-rules.md`
5. `rules/alpha-acceptance-gates.md`
6. `rules/harness-workflow.md`
7. `docs/central-server-spec.md`
8. `docs/execution-lifecycle.md`
9. `docs/cli-contract.md`
10. `schemas/alpha-record.md`

## Shared hard rules
- Use the CLI exactly as documented.
- Do not mutate server state except through the CLI or server API.
- Do not treat a local note as stronger evidence than the canonical database record.
- Reject or retry by state transition; do not silently overwrite alpha history.
- Keep one worker lease tied to exactly one worker identity, one BRAIN account, and one Chrome profile.

## Login source rule
- For real BRAIN execution, read account id, password, and Chrome profile path from `C:\Users\user\worldquant-alpha-lab\worldquant-login.md`.
- Do not invent account aliases or profile paths that are not present there.
- Do not share one Chrome profile across multiple execution agents.

## Canonical server start command
```text
node src/harness/cli.js server start --db-path C:\Users\user\worldquant-multi-agent-harness\data\harness.db --port 3000
```
