# CLI Contract

The CLI targets the private JSON automation surface of the harness server. These routes should stay private and should not be exposed on the public internet.

## Submit alpha
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

Validation failure response:
```text
status=validation_failed
error=<error message>
warning=<warning message>
```

Similarity rejection response:
```text
status=rejected_similarity
closest_alpha_id=<server alpha id>
max_similarity=<score>
threshold=0.70
```

## Request work
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
- `count=0` means no eligible work remains
- one leased alpha must not be returned to another worker at the same time

## Submit result
```text
node src/harness/cli.js submit result --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --settings "<json>" --metrics "<json>"
```

Success response:
```text
status=accepted
alpha_id=<server alpha id>
state=tested
```

## Report failure
```text
node src/harness/cli.js report failure --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --retryable <true|false> --failure-class <class> --error "<message>"
```

Success response:
```text
status=accepted
alpha_id=<server alpha id>
state=<failed_retryable|failed_terminal>
```
