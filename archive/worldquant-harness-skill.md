# WorldQuant Multi-Agent Harness 통합 스킬

## 1) 사용 목적
이 문서는 `AGENTS.md`, `agents/common-harness-workflow.md`, `agents/generator-agent.md`,
`rules/alpha-creation-rules.md`, `rules/how-to-gen-new-alpha.md`,
`rules/alpha-acceptance-gates.md`, `docs/cli-contract.md`의 핵심 규칙을
하나의 실행 기준으로 압축한 스킬 파일이다.

## 2) 시스템 정체성(절대 규칙)
- 중앙 서버가 권한의 최종 원천이다.
  - 제출 저장, 유사도 판별, 큐 상태, 결과 저장은 전부 중앙 서버 기준.
- 로컬 노트/임시 기록은 보조 자료일 뿐이며, 서버 상태와 충돌하면 서버 기준으로 정합성 재확인 후 진행.
- canonical DB 경로: `C:\Users\user\worldquant-multi-agent-harness\data\harness.db`
- 역할 분리: 제너레이터는 알파 생성/제출만, 실행기는 시뮬레이션/결과 제출만.

## 3) 작업 전 필수 읽기 순서
1. `AGENTS.md`
2. `agents/common-harness-workflow.md`
3. 역할 파일
   - 제너레이터: `agents/generator-agent.md`
4. `rules/alpha-creation-rules.md`
5. `rules/alpha-acceptance-gates.md`
6. `docs/cli-contract.md`
7. (필요 시) `rules/how-to-gen-new-alpha.md`

## 4) 공통 하드 규칙
- CLI는 문서에 적힌 형태 그대로 사용.
- 서버 상태를 CLI/API 이외의 수단으로 임의 변경하지 않음.
- 로컬 메모보다 canonical DB를 우선.
- 같은 alpha 히스토리에 대한 덮어쓰기 금지, 상태 전이 기반으로 처리.
- 한 작업자(worker)는 **하나의 worker-id, 하나의 BRAIN 계정, 하나의 Chrome 프로필**을 일대일로 고정.
- 실 실행(제너레이터)은 불가: 로그인·시뮬레이션·결과 제출·작업 요청은 실행기만 수행.

## 5) 제너레이터 운영 규칙
- 역할: 새 알파 식 생성 + 제출 + 서버 응답 판독.
- 금지: BRAIN 로그인/실행, fake 결과 제출, 유사도 게이트 우회.
- 제안은 하나의 명확한 메커니즘에서 시작.
- 1차 초안은 단순하고 얕은 구조 우선.
- `status=accepted` 또는 `status=rejected_similarity`가 나올 때까지 제출 완료로 간주하지 않음.

### 제너레이터 제출 명령
```text
node src/harness/cli.js submit alpha --server-url http://127.0.0.1:3000 --expr "<expression>" --submitted-by <generator-agent-id> --hypothesis "<economic hypothesis>"
```

### 응답 해석
- `status=accepted`
  - 반환: `alpha_id`, `state=pending`, `max_similarity`
  - 의의: 서버에 저장된 신규 알파
- `status=rejected_similarity`
  - 반환: `closest_alpha_id`, `max_similarity`, `threshold`
  - 의의: 저장되지 않음(미저장), 대체 구조로 재작성 필요

## 6) 알파 구조/작성 규칙 (기계적 생성 제약)
- 오직 문서에 명시된 연산자/데이터필드만 사용.
- 하나의 알파는 하나의 핵심 메커니즘.
- 파라미터만 변경한 변형은 새 아이디어로 간주 금지.
- 시그니처/구문 오류는 아이디어 취약성 이전의 검증 오류로 먼저 점검.
- 빈번한 래핑/복잡화 대신 구조 단순화.
- 각 알파는 경제적 설명이 있어야 하며(1문장 가설 포함), 변수를 정의했다면 마지막 행에서 신호 출력이 필요.
- 동일한 틀의 단순 치환, lookback/decay/setting retune만으로는 신규성 없음.
- 재현력 있는 근거가 되지 않으면 표면적 희귀성(드문 필드 사용)만으로 점수화 금지.

## 7) 유사도/식별성 게이트
- 유사도 임계는 문서 간 일관성으로 `0.70`을 중심으로 동작:
  - `docs/cli-contract.md`는 rejection 응답에서 `threshold=0.70`을 명시.
  - `AGENTS.md` 일부 조항은 `0.80`을 언급하나, 실제 CLI/스펙 동작에 맞춰 **실행 시 `0.70` 기준으로 처리**.
- 유사도 판정은 파싱된 함수/데이터필드(및 스펙상 필요 시 연산자/구조) 사용 관점의 중첩으로 판단.
- 유사도 거부는 저장 이전 실패이므로 `alpha_id` 미발급.

## 8) 채택 및 강도 기준
### Good alpha
- Sharpe ≥ 1.0
- Fitness ≥ 1.0
- Turnover 0.05~0.60
- syntax/platform/workflow/evidence blocker 없음
- 기존 저장 알파와 실질적으로 중복되지 않을 것
- 관측 결과 이후에도 경제적 메커니즘 설명 유지

### Strong alpha
- Sharpe ≥ 1.5
- Fitness ≥ 1.0
- 가능 시 연도별 Sharpe 모두 1.0 초과
- 특정 시점 단독 성과에 의존하지 않음
- 인접 점검에서 붕괴하지 않음

### 라벨
- `distinct-pass`, `strong-pass`, `near-miss`, `duplicate-rejected`, `blocked`, `dead`

## 9) 아이디어 질적 원칙 (`how-to-gen-new-alpha.md` 요약)
- 오판 구조(시장 mispricing)에서 시작하고, 식은 그 구조를 반영하는 최소 표현으로 작성.
- 희귀 필드는 출발점이지 증명 자체가 아님.
- 단기적으로는 `변화/충돌/지연/전환` 같은 dynamic 신호가 crowded level signal보다 우선.
- 서로 다른 실패 구간을 보완하는 조합만 정당화 가능.
- 표면적 참신함(복잡한 래핑, 드문 필드 나열)보다 기전의 경제적 설명력 우선.

## 10) CLI 계약(요약)
### Work request (실행기만 사용)
```text
node src/harness/cli.js request next alpha 3 --server-url http://127.0.0.1:3000 --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id>
```
- 최대 3개 반환, 부족하면 그만큼만.
- `count=0`이면 더 이상 처리할 일 없음.
- leased 항목은 중복 반환 불가.

### 결과 제출 (실행기)
```text
node src/harness/cli.js submit result --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --settings "<json>" --metrics "<json>"
```
- 최소: Sharpe, Fitness가 포함된 observed metrics를 전송.

### 실패 보고 (실행기)
```text
node src/harness/cli.js report failure --server-url http://127.0.0.1:3000 --alpha-id <id> --lease-id <lease-id> --worker-id <worker-id> --brain-account <account-id> --chrome-profile <profile-id> --retryable <true|false> --failure-class <class> --error "<message>"
```
- 실패 종류는 재시도 가능/불가능을 구분해 보고.

## 11) 실행 루프(실행기)
1) `request next alpha 3` 요청
2) `count=0`이면 중단
3) BRAIN 실행
4) 성공 시 `submit result`, 실패 시 `report failure`
5) 반복

## 12) 참고 경로
- `docs/datafields-reference.md`, `docs/operators-reference.md`에서 연산자/데이터필드 유효성 확인
- 로그인/프로필 출처: `C:\Users\user\worldquant-alpha-lab\worldquant-login.md`
