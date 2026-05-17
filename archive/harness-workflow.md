# Harness Workflow

## Roles
- `generator-agent` creates and submits new alpha expressions.
- `central-server` stores accepted alphas, rejects near-duplicates before storage, serves queued work, and stores results.
- `brain-execution-agent` requests queued work, runs BRAIN simulations with its assigned account and isolated Chrome profile, and submits results.

## Generator-agent workflow
1. Draft an alpha under `rules/alpha-creation-rules.md`.
2. Submit it with the CLI.
3. If the server returns `accepted`, record the returned `alpha_id` locally if needed.
4. If the server returns `rejected_similarity`, do not treat it as a stored alpha.
5. If the server returns a syntax or contract error, fix the draft and resubmit in the same lineage.

## Central-server workflow
1. Accept `submit alpha` requests.
2. Parse the expression into function usage and datafield usage.
3. Compare the submission against every alpha already stored in the database.
4. Compute the highest similarity score in the database.
5. Reject the submission before storage if the highest similarity is greater than `0.70`.
6. Store the submission with status `pending` if the similarity gate passes.
7. Serve `request next alpha 3` by returning up to 3 alphas that are not already leased to another worker.
8. Accept `submit result` and update the stored alpha with observed settings and observed metrics.
9. Accept `report failure` and classify the outcome as retryable or terminal.

## Brain-execution-agent workflow
1. Use one assigned BRAIN account.
2. Use one isolated Chrome profile.
3. Request work through `alp request next alpha 3`.
4. If the server returns 0 alphas, stop polling.
5. If the server returns 1 to 3 alphas, run each alpha in BRAIN with the assigned account and profile.
6. Submit the observed settings and observed metrics back to the server after each successful run.
7. Report retryable or terminal failures back to the server after each failed run.
8. Continue polling until the server returns no more work.

## Parallel execution rule
- Multiple Brain execution agents may run at the same time.
- The server must not give the same alpha to two workers at the same time.
- A worker owns only the alphas it received in its current lease.
- A worker result or failure report is valid only for its own active lease.

## Local markdown rule
- A worker may maintain local markdown notes.
- Local markdown is advisory only.
- The central server record is authoritative for status, settings, and observed results.

## Test-driven development target
The harness is complete only if all of the following behaviors are testable:
- a new alpha can be submitted through the CLI
- a near-duplicate alpha is rejected before storage
- a worker can request the next 3 alphas
- parallel workers do not receive the same alpha at the same time
- one worker can keep polling until no queued alpha remains
- a worker can submit observed BRAIN settings and result metrics back to the server
- a worker can report retryable and terminal failures back to the server
