# Alpha Acceptance Gates

## Good alpha bar
A tested alpha clears the active bar only if all of the following are true:
- Sharpe >= 1.0
- Fitness >= 1.0
- Turnover between 0.05 and 0.60
- the result is not blocked by syntax, platform, workflow, or missing evidence
- the alpha is not materially the same as an already stored alpha
- the mechanism remains economically explainable after the observed result

## Strong alpha bar
A tested alpha is strong only if all of the following are true:
- Sharpe >= 1.5
- Fitness >= 1.0
- every yearly Sharpe > 1.0 when yearly slices are available
- the result is not carried by one isolated period only
- the alpha does not collapse under nearby checks

## Classification labels
- `distinct-pass` - passes the active bar and remains distinct
- `strong-pass` - passes the strong bar and remains distinct
- `near-miss` - misses one required metric narrowly
- `duplicate-rejected` - rejected by central similarity gate before storage
- `blocked` - syntax, platform, quota, workflow-state, or missing-evidence blocker
- `dead` - clearly below bar

## Promotion discipline
- Do not promote a candidate only because one headline metric passed.
- Do not promote a candidate if the mechanism explanation breaks after the test result arrives.
- Do not promote a candidate if the observed result is materially weaker than the original story.
- Parameter-only descendants may still be useful as evidence, but not as new qualifying ideas.
