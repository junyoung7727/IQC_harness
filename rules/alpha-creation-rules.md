# Alpha Creation Rules

## Non-negotiable rules
- Submit new alphas to the central server through the CLI only.
- Do not treat a local draft as accepted until the server stores it successfully.
- The server rejects a submission before storage if its highest similarity against any stored alpha is greater than `0.70`.
- Similarity is computed from parsed function usage and parsed datafield usage only.
- A new alpha is not new just because a numeric hyperparameter changed.
- Do not relabel syntax fixes, type fixes, setting fixes, or reruns as new alpha ideas.
- Prefer simple formulas and one clear mechanism.
- Every alpha must have a one-sentence economic story.

## What counts as structurally new
A submitted alpha may count as structurally new only if it introduces at least one of these:
1. a new dominant function pattern that changes information flow
2. a new dominant datafield family with a different causal source
3. a new economic mechanism class
4. a new portfolio role produced by a structural change rather than a parameter retune

## What does not count as structurally new
- lookback-only retuning
- decay-only retuning
- delay-only retuning
- neutralization-only retuning
- universe-only retuning
- same skeleton with field substitution only
- wrapper-only or gating-only variants of the same mechanism
- add-vs-multiply mirrors of the same two-leg idea without a mechanism break
- syntax-only repairs
- typing-only repairs
- platform-setting repairs

## Generation discipline
- Start from one explicit mechanism hypothesis.
- Confirm that intended operators and datafields are documented before drafting the formula.
- Submit one serious alpha at a time, or a very small same-hypothesis micro-tranche only when direct comparison is necessary.
- Record nearest known relatives before submission when local evidence exists.
- Reject quickly when neighboring variants fail for the same reason.
- If a formula starts from a known reference or prior local alpha, write down what changed structurally before submission.

## Expression drafting and revision safety
- Start the first serious version as a simple executable seed.
- Do not begin with four-or-more operator nesting levels, stacked time-series wrappers, or multi-branch conditional scaffolding unless a prior failure justifies them.
- Increase expression complexity only after a specific prior failure shows what the simpler draft is missing.
- Use one primary mechanism.
- Keep supporting transforms limited to what is required to express that mechanism.
- Use conditional gating only when the mechanism requires it.
- Every intermediate variable must be used.
- The final expression must not be empty; if variables are defined, the last line must still emit the alpha signal.
- Keep one alpha per expression.
- End every intermediate assignment with a semicolon.
- Use only documented operators and documented datafields for the chosen region and settings.
- Verify operator arity and argument order before treating an input-count or attribute error as an idea problem.
- Use only constant or documented string values for lookback-style attributes.
- Prefer shallow cumulative lookback; do not add nested windows unless a prior failure justifies them.
- Treat grouping data as group-only by default.
- If a non-group use is documented in the reference set, cite that reference before using it.
- If a group key may be sparse or negative, densify it before group use instead of rewriting the mechanism.
- Treat Vector data as incompatible with non-vector operators by default.
- Convert or scalarize Vector data first unless the reference set documents a valid vector-native path.
- Do not apply vector operators to Matrix fields unless the reference set documents a valid bridge.
- If arithmetic mixes incompatible units, normalize first with a unit-removing transform such as rank unless the units already match by construction.
- If a draft needs many wrappers just to become syntactically valid, simplify the expression first and preserve the same mechanism.

## Error-handling defaults
- Unknown variable, invalid datafield, or unavailable field errors are reference-validation failures first; check spelling, region availability, and source documentation before mutating the mechanism.
- Unexpected end of input, empty-expression, unused-variable, or missing-semicolon errors are structure failures; repair the expression shape before judging the idea.
- Invalid number of inputs, invalid attribute values, required-attribute, invalid-choice, invalid-date, or wrong-argument-order errors are operator-signature or attribute-contract failures; verify the operator contract before editing the economic logic.
- Group-index and grouping-data misuse errors are typing or indexing failures; fix dense-group handling or operator placement before changing the idea.
- Vector or event compatibility errors are data-type failures; convert the data correctly before adding new transforms.
- NaN propagation, divide-by-zero risk, or invalid-domain behavior are input-stability failures; stabilize inputs before changing the mechanism.
- Cumulative-lookback and minimum-length errors are horizon-construction failures; reduce chain depth or adjust the construction before treating the candidate as economically false.
- Resource, runtime, and oversized-expression errors are complexity failures; simplify operators, datasets, or nesting before trying to rescue the same draft with more layers.
- Concurrent-simulation, concurrent-submit, daily-limit, and quota errors are platform-capacity blockers; wait, queue, or reschedule them and do not treat them as alpha evidence.
- IS-period mismatch and clone-to-resimulate cases are workflow-state blockers; clone or rerun as required and keep the same lineage.
- Check simulation settings early: Delay, Decay, Truncation, Neutralization, Pasteurization, NaN Handling, Unit Handling, and Max Trade when the region requires it.
- Region-setting errors such as required Max Trade are configuration blockers; correct the simulation setting before modifying the formula.
- SuperAlpha component-count, component-datafield, or selection-expression errors are composition blockers; fix the portfolio construction wrapper before judging the underlying mechanisms.
- If conditional gating or missing-data handling leaves the draft with sparse or near-empty support, simplify that construction before changing the mechanism.
- Operational blockers do not count as positive evidence or negative evidence for the mechanism until a valid run exists.

## Submission rule
- A CLI submission succeeds only if the server stores the alpha and returns an `alpha_id`.
- A similarity rejection is a failed submission, not a stored alpha with rejected status.
- The rejection response must include the highest similarity score and the closest existing `alpha_id`.
