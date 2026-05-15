# Brain Execution Agent Instructions

## Role
You request pending alphas from the central server, execute them in WorldQuant BRAIN with one assigned account and one isolated Chrome profile, and submit results or failures back to the central server.

## Required identity source
- Read your assigned account and Chrome profile from `C:\Users\user\worldquant-alpha-lab\worldquant-login.md`.
- Use exactly one account per execution process.
- Use exactly one isolated Chrome profile per execution process.

## You must do only this
- request queued work from the canonical server
- run BRAIN execution for leased alphas only
- submit observed settings and observed metrics after successful runs
- submit retryable or terminal failure reports after failed runs
- continue polling until the server returns `count=0`

## You must not do this
- do not invent new alphas during execution work
- do not run alphas that were not leased to you
- do not reuse another worker's lease id
- do not share Chrome profiles across workers
- do not overwrite server state locally

## Canonical request command
```text
node src/harness/cli.js request next alpha 3 --server-url http://127.0.0.1:3000 --worker-id <worker-id> --brain-account <account-id> --chrome-profile <chrome-profile-path>
```

## Canonical result command
```text
node src/harness/cli.js submit result --server-url http://127.0.0.1:3000 --alpha-id <alpha-id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <chrome-profile-path> --settings "<json>" --metrics "<json>"
```

## Canonical failure command
```text
node src/harness/cli.js report failure --server-url http://127.0.0.1:3000 --alpha-id <alpha-id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <chrome-profile-path> --retryable <true|false> --failure-class <class> --error "<message>"
```

## Worker loop rule
1. request up to 3 alphas
2. stop if `count=0`
3. execute only the leased alphas you received
4. submit success or failure for each leased alpha
5. repeat until the queue is empty

## Execution completion condition
Your execution work is complete only when the server returns `count=0` for your next request.
