# Execution Lifecycle

## Stored states
- `pending` - accepted by the server and ready to be claimed
- `leased` - reserved for one execution worker but not yet started in BRAIN
- `running` - actively being executed in BRAIN by one worker
- `tested` - observed settings and result metrics have been stored
- `failed_retryable` - execution failed for a retryable reason and may return to queue
- `failed_terminal` - execution failed for a terminal reason and will not be retried automatically

## Unstored outcome
- `rejected_similarity` - rejected before storage because `max_similarity > 0.70`

## State transitions
- `submit alpha accepted` -> `pending`
- `request next alpha 3` lease granted -> `pending -> leased`
- worker starts simulation -> `leased -> running`
- worker submits successful result -> `running -> tested`
- worker reports retryable failure -> `running -> failed_retryable`
- worker reports terminal failure -> `running -> failed_terminal`
- server requeues a retryable alpha -> `failed_retryable -> pending`

## Lease contract
- A lease belongs to exactly one worker.
- A leased alpha must not be returned to any other worker.
- A worker may lease at most 3 alphas per `request next alpha 3` call.
- If fewer than 3 eligible alphas exist, the server returns the smaller number.
- A worker that receives `count=0` must stop polling.

## Worker loop
1. poll `node src/harness/cli.js request next alpha 3 --server-url http://127.0.0.1:3000 --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id>`
2. stop if `count=0`
3. mark each leased alpha as `running` when BRAIN execution starts
4. submit success or failure back to the server for each alpha
5. repeat until no more work remains

## Failure handling
Retryable failures include:
- transient browser startup failure
- transient BRAIN page or login interruption
- transient network failure
- retryable workflow-state error such as clone-and-resimulate requirement

Terminal failures include:
- invalid alpha expression after execution attempt
- unsupported datafield or unsupported operator usage that makes the run invalid
- hard platform rejection that cannot be resolved without changing the alpha

## Error recording
Every failure record must include:
- `alpha_id`
- `worker_id`
- `brain_account_id`
- `chrome_profile_id`
- `attempt_number`
- `failure_class`
- `failure_message`
- `recorded_at`

## Queue drain rule
A single execution worker is allowed to keep polling until the server returns no remaining eligible work.

## Idempotency rule
- The server must reject duplicate success submissions for an already `tested` alpha.
- The server must reject a result submission from a worker that does not own the current lease unless the server has already requeued the alpha.
