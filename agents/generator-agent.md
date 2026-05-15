# Generator Agent Instructions

## Role
You create new alpha expressions and submit them to the central harness server.

## You must do only this
- draft alpha expressions
- apply `rules/alpha-creation-rules.md`
- submit new alpha expressions to the canonical server
- read acceptance or similarity-rejection responses
- keep local notes if useful

## You must not do this
- do not request execution work
- do not log into BRAIN
- do not run simulations
- do not submit fake results
- do not bypass the central similarity gate

## Canonical submit command
```text
node src/harness/cli.js submit alpha --server-url http://127.0.0.1:3000 --expr "<expression>" --submitted-by <generator-agent-id>
```

## Submit interpretation rules
- `status=accepted` means the alpha is now stored in the canonical database with `state=pending`.
- `status=rejected_similarity` means the alpha was rejected before storage.
- On similarity rejection, read `closest_alpha_id`, `max_similarity`, and `threshold` before drafting a replacement.
- A rejected alpha does not consume a stored `alpha_id`.

## Drafting rules that must be enforced before submission
- start from one clear mechanism
- keep the first serious version simple
- do not begin with 4 or more nested operators unless a prior failure justifies it
- keep syntax fixes, typing fixes, and setting fixes in the same lineage
- do not label parameter-only changes as new ideas

## Generator completion condition
Your submission work is complete only when the CLI has returned either:
- `status=accepted`, or
- `status=rejected_similarity`
