# Central Server Spec

## Scope
The central server does only four private automation things:
- intake alpha submissions
- reject near-duplicates before storage
- serve queued work to Brain execution agents
- store observed simulation results

The central server also provides one separate read-only viewer surface for public observation.

The central server does not log into WorldQuant BRAIN, does not run browser automation, and does not invent new alphas.

## Alpha submission
Input:
- expression
- optional local lineage metadata
- optional generator-agent metadata

Server behavior:
1. parse the expression
2. extract function tokens and their counts
3. extract datafield tokens and their counts
4. compare the submission against every stored alpha
5. compute one `max_similarity` score in `[0.0, 1.0]`
6. reject before storage if `max_similarity > 0.70`
7. return the closest existing `alpha_id` and score on rejection
8. store the alpha and return a new `alpha_id` on acceptance

## Similarity algorithm
The current first-line algorithm uses parsed function usage, parsed datafield usage, parsed operator usage, and simple structure bigrams.

For each alpha:
- build a function multiset
- build a datafield multiset
- build an operator multiset
- build a structure-bigram multiset from the parsed token sequence

For two alphas A and B:
- compute function overlap score with weighted Jaccard similarity on function-token counts
- compute datafield overlap score with weighted Jaccard similarity on datafield-token counts
- compute operator overlap score with weighted Jaccard similarity on operator-token counts
- compute structure overlap score with weighted Jaccard similarity on structure-bigram counts
- ignore any axis that is empty on both sides
- final similarity = arithmetic mean of the remaining active axis scores

Weighted Jaccard for token-count maps:
- numerator = sum of `min(countA, countB)` across the union of token keys
- denominator = sum of `max(countA, countB)` across the union of token keys
- score = `0.0` if the denominator is `0`, otherwise `numerator / denominator`

This algorithm must satisfy these constraints:
- output range is `[0.0, 1.0]`
- identical parsed function, datafield, operator, and structure usage returns `1.0`
- no overlap returns `0.0`
- more shared token types, more similar token counts, and more similar structure increase the score
- operator-bearing formulas such as `sales/cap` and scalar formulas such as `sales` must not collapse to the same score path just because both have no named functions

## Queue service
The server exposes one pull operation:
- `request next alpha 3`

Server behavior:
- return up to 3 stored alphas that are eligible for execution
- do not return the same alpha to multiple workers at the same time
- mark returned work as leased to the requesting worker and lease id
- if no work remains, return an empty result

## Result intake
Input:
- `alpha_id`
- `lease_id`
- observed BRAIN settings
- observed simulation metrics
- worker metadata

Server behavior:
- accept the result only from the worker that owns the active lease
- persist the observed settings
- persist the observed result metrics
- persist the execution worker identity
- move the alpha to terminal tested state

## Failure intake
Input:
- `alpha_id`
- `lease_id`
- retryable flag
- failure metadata

Server behavior:
- accept the failure only from the worker that owns the active lease
- persist the failure metadata
- move the alpha to `failed_retryable` or `failed_terminal`
- requeue only through an explicit server-side requeue step for retryable failures

## State rules
Stored alpha states:
- `pending` - accepted and waiting for execution
- `leased` - currently assigned to one worker but not started yet
- `running` - actively executing in BRAIN
- `tested` - result recorded
- `failed_retryable` - failed but eligible for explicit requeue
- `failed_terminal` - failed and not eligible for automatic requeue

Unstored outcome:
- `rejected_similarity` - returned to the submitting agent but not saved as a stored alpha

## Viewer surface
The server exposes a separate read-only HTML viewer under `/viewer`.

Viewer rules:
- the viewer is authenticated independently from the private JSON automation APIs
- the viewer is read-only and exposes no database write action
- the viewer must not reuse the full private `getAlpha` payload
- the viewer must use an explicit allowlist of fields for list and detail pages
- the viewer must not expose `lease_id`, `leased_to`, `brain_account_id`, `chrome_profile_id`, or raw `last_error_message`
- viewer HTML responses should send defensive security headers

## Authority rule
The central server database is the source of truth for:
- alpha identity
- current execution state
- similarity rejection outcome
- observed settings
- observed simulation metrics
