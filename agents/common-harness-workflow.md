# Common Harness Workflow

## Canonical paths
- DB: `C:\Users\user\worldquant-multi-agent-harness\data\harness.db`
- Login source for real BRAIN execution: `C:\Users\user\worldquant-alpha-lab\worldquant-login.md`

## Shared read order
1. `AGENTS.md`
2. this file
3. role file in `agents/`
4. `docs/cli-contract.md`

## Shared hard rules
- Use the CLI exactly as documented in `docs/cli-contract.md`.
- Do not mutate harness state outside the CLI or server API.
- Server state and canonical DB beat local notes.
- Reject or retry through explicit state transitions; do not overwrite history.
- Keep one worker identity tied to exactly one BRAIN account and one Chrome profile.

## Generator boundary
- Create and submit alphas only.
- Do not request leases, log into BRAIN, run simulations, or submit execution results.

## Execution boundary
- Request work only through `request next alpha 3`.
- Work only on leased alphas returned by the server.
- Submit observed settings and observed metrics after each run.

## Canonical server start command
```text
node src/harness/cli.js server start --db-path C:\Users\user\worldquant-multi-agent-harness\data\harness.db --port 3000
```
