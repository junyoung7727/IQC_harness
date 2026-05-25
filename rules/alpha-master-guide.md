# Alpha Master Guide

Use this file as a short research heuristic guide. The operational contract lives in `agents/generator-agent.md`, `rules/how-to-find-wirght-field.md`, and `docs/cli-contract.md`.

## Start from mechanism
Before drafting, answer in one sentence:
1. What is the market mispricing?
2. Why does it exist?
3. Which field shows it?
4. Why should it transfer to returns on this horizon?

## What strong exploratory ideas usually have
- one clear mechanism
- less-crowded data or a less-crowded interpretation
- change, conflict, delay, or acceleration rather than raw level only
- a believable horizon
- a story that remains explainable after results arrive

## What usually does not count as new
- lookback-only or decay-only tuning
- same skeleton with field substitution only
- add-vs-multiply mirrors
- wrapper-only gate variants
- syntax, typing, platform-setting, or rerun fixes

## Drafting heuristics
- Start simple, then add complexity only after a specific failure teaches you what is missing.
- Prefer shallow construction over stacked wrappers.
- Use one expression for one mechanism.
- If the idea needs many wrappers just to compile, simplify the idea before tuning it.
- If two nearby variants fail for the same reason, change mechanism, not cosmetics.
- Make distance of alpha idea clusters to generate more diversified alpha pool.

## Field choice heuristics
A rare field is useful only if it reveals a state that common price-volume signals miss.
Good questions:
- What hidden state does this field observe?
- Is it expectation, reality, disagreement, risk, exhaustion, or conflict?
- Why might the market underreact or misread it?

## Acceptance thinking
Use `alpha-acceptance-gates` as guidance, not as the only source of ideas.
Still avoid calling an alpha good when it is:
- not distinct
- not explainable
- blocked by workflow or validation problems
- carried by one cosmetic variant only

## Bottom line
Simple first, one mechanism, structural novelty, and field choices grounded in economic meaning.
use more unpopular data field to generate new idea.
