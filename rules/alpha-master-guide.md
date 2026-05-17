# Alpha Research Master Guide

## Core Philosophy

**알파는 식이 아니라 오판 구조다.**  
좋은 알파는 수식에서 출발하지 않는다. 시장의 오판 (잘못 반영, 늦은 반영, 과잉 반영, 미정리 정보) 에서 출발한다. Alpha expression 은 그 오판 구조를 관측하기 위한 압축된 표현일 뿐이다.

### Fundamental Questions (모든 알파 전에 필수)
1. 시장이 무엇을 잘못 보고 있는가?
2. 그 오판은 왜 발생하는가?
3. 그 오판은 어떤 데이터에 흔적으로 남는가?
4. 그 흔적은 어떤 시간축에서 수익률로 전이되는가?

---

## I. Alpha Generation Discipline

### A. Starting Points (Both Valid)

#### Top-down
시장 오판 메커니즘 → 관측 필드/연산자 찾기  
**예시:** 기대치 수정 지연 → analyst revision/guidance/surprise → revision acceleration

#### Bottom-up
희귀 필드 발견 → 경제적 상태 변수 해석 → 시장 오판 연결  
**예시:** 옵션 skew → downside fear/tail-risk demand → 현물 가격과 충돌 시 hidden risk repricing

**핵심:** 출발점이 중요한 것이 아니다. 다음 구조로 수렴하는지가 중요하다:
```
데이터 필드 → 숨은 상태 변수 → 시장 오판 메커니즘 → 적절한 operator → horizon → additivity
```

### B. What Counts as Structurally New

A new alpha must introduce at least one of:
1. **New dominant function pattern** - changes information flow
2. **New dominant datafield family** - different causal source
3. **New economic mechanism class**
4. **New portfolio role** - produced by structural change, not parameter retune

### C. What Does NOT Count as New

- Lookback / decay / delay / neutralization / universe-only retuning
- Same skeleton with field substitution only
- Wrapper-only or gating-only variants
- Add-vs-multiply mirrors without mechanism break
- Syntax / typing / platform-setting repairs
- **Numeric hyperparameter 변화만으로는 새로운 알파가 아님**

### D. Generation Rules

✅ **Do:**
- Start from one explicit mechanism hypothesis
- Confirm intended operators and datafields are documented before drafting
- Submit one serious alpha at a time (or small same-hypothesis micro-tranche for comparison)
- Record nearest known relatives before submission when local evidence exists
- Prefer simple formulas and one clear mechanism
- Every alpha must have a one-sentence economic story
- Reject quickly when neighboring variants fail for the same reason
- If starting from reference/prior alpha, document what changed structurally
- **Keep one alpha per expression**
- **Do not treat a local draft as accepted until the server stores it successfully**

❌ **Don't:**
- Relabel syntax fixes, type fixes, setting fixes, or reruns as new alpha ideas
- Start with 4+ operator nesting levels initially
- Begin with stacked time-series wrappers or multi-branch conditional scaffolding
- Use conditional gating unless mechanism requires it
- Create unused intermediate variables
- Let final expression be empty (last line must emit alpha signal)
- Apply vector operators to Matrix fields without documented bridge
- Mix incompatible units without normalization (use rank first)

### E. Expression Drafting Safety

1. **Start simple:** First serious version = simple executable seed
2. **Increase complexity only after specific failure** shows what simpler draft is missing
3. **One primary mechanism**, limited supporting transforms
4. **Shallow cumulative lookback preferred**; nested windows only if justified
5. **Grouping data:** Treat as group-only by default; cite reference if non-group use needed
   - **If a group key may be sparse or negative, densify it before group use instead of rewriting the mechanism**
6. **Vector data:** Incompatible with non-vector operators by default; convert/scalarize first
7. **If a draft needs many wrappers just to become syntactically valid, simplify the expression first and preserve the same mechanism**
8. **End every intermediate assignment with semicolon**
9. **Use only documented operators/datafields** for chosen region/settings
10. **Verify operator arity and argument order** before treating input-count error as idea problem
11. **Use constant or documented string values** for lookback-style attributes

---

## II. Datafield Strategy

### A. Rare Fields Are Clues, Not Justification

희귀 필드가 좋은 알파가 되기 위해선 다음 조건 충족:
1. 기존 price/volume/fundamental alpha 가 보지 못하는 상태를 본다
2. 경제적으로 해석 가능하다
3. 시장 오판과 연결된다
4. 특정 horizon 에서 수익률로 전이될 가능성이 있다
5. 기존 알파 풀과 낮은 상관을 가질 가능성이 있다

**Bad judgment:** "이 필드는 희귀해서 좋다"  
**Good judgment:** "이 필드는 희귀하다. 더 중요한 것은, 이 필드가 기존 알파들이 보지 못한 상태 변수를 관측한다는 점이다. 그 상태 변수는 시장의 특정 오판 메커니즘과 연결된다."

### B. Four Types of Good Rarity

| Type | Description | Example |
|------|-------------|---------|
| **Data Group Rarity** | Less common than price-volume | Options, analyst, guidance, short interest, institutional holdings, supply chain, events, credit stress, management tone |
| **State Variable Rarity** | Field is common, derived state is new | Not just revision level, but `revision disagreement`, `acceleration`, `exhaustion`, `price-conflict` |
| **Conflict Structure Rarity** | Two data groups tell conflicting stories | Price strong + fundamental weak; Analyst up + options fearful; Earnings good + cashflow quality poor; **News positive + no price reaction** |
| **Portfolio Role Rarity** | Survives where existing alphas fail | Stress alpha when momentum breaks; Analyst revision alpha when value is dull |

### C. Field Interpretation Framework (Bottom-up Exploration)

모든 필드는 다음 질문 통과:
- 이 필드는 무엇의 흔적인가?
- 이 필드는 누가 만든 정보인가?
- 이 필드는 가격보다 빠른가, 느린가?
- 이 필드는 기대를 나타내는가, 현실을 나타내는가?
- 이 필드는 리스크를 나타내는가, 성장성을 나타내는가?
- 이 필드는 consensus 를 나타내는가, disagreement 를 나타내는가?
- 이 필드가 이미 가격에 반영되었을 가능성이 높은가?
- 이 필드가 왜 아직 덜 반영되었을 수 있는가?

**Good bottom-up alpha doesn't boast field names. It translates fields into economic state variables.**

### D. Signal Priority

**Level < Change < Conflict**

Simple level signals are likely crowded. Prefer:
- Delta, acceleration, deceleration
- Surprise, dispersion, disagreement
- Conflict, delay, exhaustion
- Transition, regime interaction

**Low-score thinking:** "이 필드 값이 높으면 좋을 것 같다"  
**High-score thinking:** "이 필드의 변화 속도가 가격 반응보다 빠르다. 이 필드와 가격이 서로 반대 방향으로 움직인다. 이 필드는 시장이 아직 반영하지 않은 리스크 재가격을 암시한다."

---

## III. Combination Philosophy

### Purpose of Combination
Not to average weak signals. **Combine signals with different failure regimes.**

**Bad combination:** Weak A + Weak B + Weak C  
**Good combination:** 
- Momentum strong in normal trend, weak in risk reprice
- Stress weak normally, strong in risk reprice
→ Different failure regimes = combination value

### High-Score Alpha Structure
```
Clear market mispricing
+ Less-crowded data observation
+ Hidden state variable interpretation
+ Level ≠ Change/Conflict/Delay structure
+ Logical horizon
+ Robustness
+ Additivity to existing alphas
```

**Example:** Analysts raising earnings outlook, but options market pricing strong downside risk. Surface-level expectation improvement vs hidden risk repricing conflict. Market may not fully resolve this yet. Valuable not because used options data, but because captured conflict between analyst expectations and option risk pricing.

---

## IV. Error Handling Protocol

### Classification & Response

| Error Category | Examples | First Response |
|----------------|----------|----------------|
| **Reference Validation** | Unknown variable, invalid datafield, unavailable field | Check spelling, region availability, source documentation BEFORE mutating mechanism |
| **Structure Failure** | Unexpected end of input, empty-expression, unused-variable, missing-semicolon | Repair expression shape before judging the idea |
| **Operator Signature** | Invalid number of inputs, invalid attribute values, wrong-argument-order, required-attribute, invalid-choice, invalid-date | Verify operator contract before editing economic logic |
| **Group Typing** | Group-index misuse, grouping-data errors | Fix dense-group handling or operator placement before changing idea |
| **Data Type** | Vector/event compatibility errors | Convert data correctly before adding new transforms |
| **Input Stability** | NaN propagation, divide-by-zero, invalid-domain | Stabilize inputs before changing mechanism |
| **Horizon Construction** | Cumulative-lookback, minimum-length errors | Reduce chain depth or adjust construction before treating as economically false |
| **Complexity** | Resource, runtime, oversized-expression | Simplify operators/datasets/nesting before trying more layers |
| **Platform Capacity** | Concurrent-simulation, concurrent-submit, daily-limit, quota | Wait, queue, reschedule. DO NOT treat as alpha evidence |
| **Workflow State** | IS-period mismatch, clone-to-resimulate | Clone or rerun as required, keep same lineage |
| **Configuration Blockers** | Region-setting errors (e.g., required Max Trade) | Correct simulation settings BEFORE modifying formula |
| **SuperAlpha Composition** | component-count, component-datafield, selection-expression errors | Fix portfolio construction wrapper before judging underlying mechanisms |

**Operational blockers do NOT count as positive or negative evidence until valid run exists.**

### Additional Error Handling Rules
- **Sparse Support from Gating:** If conditional gating or missing-data handling leaves the draft with sparse or near-empty support, simplify that construction before changing the mechanism.

### Pre-Simulation Checklist
Check early: Delay, Decay, Truncation, Neutralization, Pasteurization, NaN Handling, Unit Handling, Max Trade (when region requires)

---

## V. Acceptance Criteria

### Good Alpha Bar (Active Bar)
All must be true:
- **Sharpe ≥ 1.0** (inclusive)
- **Fitness ≥ 1.0** (inclusive)
- **Turnover:** 0.05 - 0.60 (inclusive)
- Not blocked by syntax/platform/workflow/missing-evidence
- Not materially same as already stored alpha
- Mechanism remains economically explainable after observed result

### Strong Alpha Bar
All must be true:
- **All Good Alpha Bar criteria must also be met** (including turnover)
- **Sharpe ≥ 1.5** (inclusive)
- **Every yearly Sharpe > 1.0** (when yearly slices available)
- Not carried by one isolated period only
- Does not collapse under nearby checks

### Classification Labels
| Label | Meaning |
|-------|---------|
| `distinct-pass` | Passes active bar AND remains distinct |
| `strong-pass` | Passes strong bar AND remains distinct |
| `near-miss` | Misses exactly one required metric by < 10% (e.g., Sharpe 0.92 vs 1.0 threshold) |
| `duplicate-rejected` | Rejected by central similarity gate before storage |
| `blocked` | Syntax/platform/quota/workflow-state/missing-evidence blocker |
| `dead` | Clearly below bar |

### Promotion Discipline
- ❌ Don't promote only because one headline metric passed
- ❌ Don't promote if mechanism explanation breaks after test result arrives
- ❌ Don't promote if observed result is materially weaker than original story
- ⚠️ Parameter-only descendants may be useful as evidence, but NOT as new qualifying ideas

---

## VI. Submission Protocol

### Non-negotiable Submission Rule
- **Submit new alphas to the central server through the CLI only.**
- Do not treat a local draft as accepted until the server stores it successfully.

### CLI Submission Success Conditions
1. Server stores the alpha
2. Returns an `alpha_id`

### Similarity Gate
- Server rejects if highest similarity against any stored alpha > **0.70** (strictly greater than)
- Similarity computed from **parsed function usage** + **parsed datafield usage** ONLY
- Rejection response includes highest similarity score and closest existing `alpha_id`
- **Similarity rejection = failed submission, NOT stored alpha with rejected status**

### Anti-Patterns to Avoid
- Faking novelty via numeric hyperparameter changes
- Resubmitting syntax/type/setting fixes as new ideas
- Creating wrapper/gating variants without mechanism break
- Submitting large batches without documenting structural differences
- Ignoring nearest known relatives when local evidence exists

---

## VII. Quick Reference: What Gets High Score

✅ **Reward These:**
- Clear market mispricing mechanism
- Less-crowded data observation
- Hidden state variable interpretation
- Change/Conflict/Delay structure (not level)
- Logical horizon justification
- Robustness across parameters
- Additivity to existing alpha pool
- One-sentence economic story

❌ **Reject These:**
- Rare field without state variable translation
- Complex operator stacking without mechanism
- Economic mechanism absent, backtest score only
- Price/volume alpha disguised with rare field
- Single-parameter dependency
- Same mechanism trivial variant
- Cannot explain horizon/neutralization choice

---

## VIII. Workflow Summary

```
1. HYPOTHESIS → One explicit mechanism hypothesis
2. DOCUMENT → Confirm operators/datafields documented
3. DRAFT → Simple executable seed first
4. RECORD → Nearest known relatives before submission
5. SUBMIT → One serious alpha (or small micro-tranche)
6. VERIFY → CLI returns alpha_id (not rejected by similarity gate, i.e., similarity ≤ 0.70)
7. TEST → Run simulation with correct settings
8. EVALUATE → Against Good/Strong Alpha Bar
9. CLASSIFY → Assign appropriate label
10. PROMOTE → Only if all promotion discipline rules met
```

**Key Principle:** Complexity comes later. First find one strong mispricing, one clear state variable, one appropriate operator, one logical horizon. Then consider combinations.

### Reference Documents
All operators and datafields must come exclusively from:
- `docs/datafields-wiki/` (category-index → sub-category → individual field files)
- `docs/operators-wiki/` (category-index → sub-category → individual operator files)

### Wiki Exploration Protocol (MANDATORY - NO GUESSING)
**Before drafting ANY expression, follow this 3-step process:**

1. **Purpose (1 sentence):** Define what economic state you're measuring
2. **Category Scan (max 2 files):** Read `category-index.md` → matching sub-category file → extract candidate names
3. **Field Verification (max 1 file per candidate):** Read individual wiki file to confirm exact name, arity, data type, region

**HARD LIMIT: Maximum 3 files read per alpha draft. NEVER invent field/operator names from memory.**
