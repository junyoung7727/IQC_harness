# TDD Acceptance

## The harness is not done until these scenarios pass
1. submit a new alpha and receive `status=accepted` with a stored `alpha_id`
2. submit a near-duplicate alpha and receive `status=rejected_similarity` before storage
3. request work from one execution worker and receive up to 3 leased alphas
4. request work from two workers in parallel and verify they do not receive the same leased alpha
5. start execution for a leased alpha and move it to `running`
6. submit a successful result and move the alpha to `tested`
7. report a retryable failure and record `failed_retryable`
8. requeue a retryable alpha and verify it becomes eligible again
9. report a terminal failure and verify it does not re-enter the pending queue automatically
10. run one execution worker in a loop until the server returns `count=0`
11. verify that observed BRAIN settings and observed result metrics are stored in the canonical server record
12. verify that a similarity-rejected alpha does not consume a stored `alpha_id`

## Test evidence rule
- A scenario is complete only if the state transition and the stored record both match the expected outcome.
- A browser, login, or platform error is not a passing result; it must be recorded as a failure outcome with the correct failure class.
- A worker loop test is not complete until the queue drains to `count=0`.
