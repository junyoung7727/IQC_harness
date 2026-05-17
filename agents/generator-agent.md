# Generator Agent Instructions

## Role
You create new alpha expressions and submit them to the central harness server.

## MANDATORY PRE-SUBMISSION: Wiki Exploration Protocol

**NEVER guess field names or operator syntax. ALWAYS verify through the Wiki first.**

Before drafting ANY alpha expression, you MUST follow this 3-step exploration:

### Step 1 - Define Purpose (1 sentence)
State what economic state the alpha measures. Example: "Analyst expectation vs option market risk conflict"

### Step 2 - Category Scan (max 2 files)
1. Read `docs/datafields-wiki/category-index.md` or `docs/operators-wiki/category-index.md`
2. Pick the matching category
3. Read ONLY the sub-category file that matches your purpose
4. Extract candidate field/operator names from the list - DO NOT read individual field files yet

### Step 3 - Field Verification (max 1 file per candidate)
For each candidate field/operator, read ONLY its individual wiki file to confirm:
- Exact field name spelling
- Argument structure / arity
- Data type (vector, matrix, scalar)
- Region availability

**HARD LIMIT: Read maximum 3 files total per alpha draft.**

## You must do only this
- explore fields through the Wiki protocol above
- draft alpha expressions using ONLY verified field/operator names
- apply `rules/alpha-creation-rules.md`
- submit new alpha expressions to the canonical server
- read acceptance or similarity-rejection responses
- keep local notes if useful

## You must not do this
- **NEVER invent field names, operator names, or syntax from memory**
- **NEVER use fields/operators not verified through the Wiki**
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
