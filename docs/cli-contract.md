# CLI Contract

## Commands

### Submit alpha
```text
node src/harness/cli.js submit alpha --server-url http://127.0.0.1:3000 --expr "<expression>" --submitted-by <generator-agent-id> --hypothesis "<economic hypothesis>"
```

Success response:
```text
status=accepted
alpha_id=<server alpha id>
state=pending
max_similarity=<score>
```

Similarity rejection response:
```text
status=rejected_similarity
closest_alpha_id=<server alpha id>
max_similarity=<score>
threshold=0.70
```

### Request work
```text
node src/harness/cli.js request next alpha 3 --server-url http://127.0.0.1:3000 --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id>
```

Response:
```text
status=ok
count=<0..3>
lease_id=<lease id>
items=[...]
```

Rules:
- the server returns at most 3 alphas
- the server may return fewer than 3 alphas
- `count=0` means no eligible work remains
- returned items are leased to the requesting worker
- one leased alpha must not be returned to another worker at the same time

### Submit result
```text
node src/harness/cli.js submit result --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --settings "<json>" --metrics "<json>"
```

Success response:
```text
status=accepted
alpha_id=<server alpha id>
state=tested
```

### Report failure
```text
node src/harness/cli.js report failure --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --retryable <true|false> --failure-class <class> --error "<message>"
```

Success response:
```text
status=accepted
alpha_id=<server alpha id>
state=<failed_retryable|failed_terminal>
```

## Worker loop contract
A Brain execution agent runs this loop:
1. call `node src/harness/cli.js request next alpha 3 ...`
2. stop if `count=0`
3. simulate each returned alpha in BRAIN with the assigned account and Chrome profile
4. call `alp submit result` for each completed run
5. call `alp report failure` for each failed run
6. repeat

### Continuous worker (credentials-first, npm script)
```bash
npm run worker:continuous -- --brain-id <account-id> --brain-password <password>
```

This runs in an infinite loop:
- resolves login profile by `id + ps` from `worldquant-login.md`
- requests work in batch (`count=3` by default)
- executes each batch via existing `runWorkerLoop` logic
- records success/failure back to server (`submitResult`, `reportFailure`)
- sleeps and retries when queue is empty or transiently failing

Optional flags:
- `--server-url` (default: `http://127.0.0.1:3000`)
- `--brain-url` (default: `https://platform.worldquantbrain.com`)
- `--worker-id` (default: `worker-<safe brain-id>`)
- `--concurrency` (default: `3`)
- `--poll-interval-ms` (default: `5000`)
- `--error-retry-ms` (default: `30000`)
- `--headed true|false` (default: `false`)
- `--requeue-retryable true|false` (default: `false`)

## Minimal payload expectations
- `settings` must include the observed BRAIN run settings used for the simulation
- `metrics` must include the observed simulation outputs returned by BRAIN
- the exact metric set may expand, but Sharpe and Fitness must be supported
- a failure report must state whether the failure is retryable or terminal
