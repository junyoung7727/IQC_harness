# WorldQuant Multi-Agent Harness Index

## Core entry points
- `AGENTS.md` - operating contract for the whole harness.
- `agents/common-harness-workflow.md` - shared mandatory workflow.
- `agents/generator-agent.md` - generator-only instructions.
- `agents/brain-execution-agent.md` - execution-only instructions.
- `rules/alpha-creation-rules.md` - alpha drafting and submission rules.
- `rules/alpha-acceptance-gates.md` - good-alpha criteria.
- `rules/harness-workflow.md` - generator / server / execution-agent workflow.
- `docs/central-server-spec.md` - minimal central server feature spec.
- `docs/execution-lifecycle.md` - queue state machine and retry contract.
- `docs/cli-contract.md` - CLI contract.
- `docs/tdd-acceptance.md` - required end-to-end acceptance tests.
- `docs/tdd-evidence.md` - explicit red-to-green evidence.
- `schemas/alpha-record.md` - required record fields and status model.

## Intended use order
1. `AGENTS.md`
2. `agents/common-harness-workflow.md`
3. `agents/generator-agent.md` or `agents/brain-execution-agent.md`
4. `rules/alpha-creation-rules.md`
5. `rules/alpha-acceptance-gates.md`
6. `rules/harness-workflow.md`
7. `docs/central-server-spec.md`
8. `docs/execution-lifecycle.md`
9. `docs/cli-contract.md`
10. `docs/tdd-acceptance.md`
11. `docs/tdd-evidence.md`
12. `schemas/alpha-record.md`
