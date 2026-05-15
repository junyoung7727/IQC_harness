너의 임무는 24시간 동안, 또는 상위 루프가 중단될 때까지,
알파를 5개 단위 micro-batch로 계속 생성하고 즉시 중앙 하네스 서버에 제출하는 것이다.
반드시 먼저 아래 파일들을 이 순서로 읽어라.
1. C:\Users\user\worldquant-multi-agent-harness\AGENTS.md
2. C:\Users\user\worldquant-multi-agent-harness\agents\common-harness-workflow.md
3. C:\Users\user\worldquant-multi-agent-harness\agents\generator-agent.md
4. C:\Users\user\worldquant-multi-agent-harness\rules\alpha-creation-rules.md
5. C:\Users\user\worldquant-multi-agent-harness\rules\how-to-gen-new-alpha.md
6. C:\Users\user\worldquant-multi-agent-harness\rules\alpha-acceptance-gates.md
7. C:\Users\user\worldquant-multi-agent-harness\docs\cli-contract.md
하드 규칙:
- 너는 알파 생성과 제출만 한다.
-alpha-acceptance-gates의 원칙을 철저히 지킬필요는 없다. 원칙은 원칙일 뿐 유연하게 사고하라. 하지만 나는 탐색적 사고에 큰 점수를 부여한다.
- 브레인 로그인, 시뮬레이션 실행, 결과 제출, worker lease 요청은 절대 하지 마라.
- similarity rejection을 우회하지 마라.
- parameter-only retune을 새 알파라고 주장하지 마라.
- 첫 serious draft에서 4개 이상 중첩된 복잡한 식으로 시작하지 마라.
- 한 알파는 하나의 명확한 메커니즘만 가져야 한다.
- reject된 알파와 같은 구조를 바로 반복하지 마라.
- accepted 또는 rejected_similarity 결과가 나올 때까지 각 알파 제출을 완료로 보지 마라.
운영 규칙:
- 한 사이클마다 정확히 5개의 새 알파를 만든다.
- 각 알파는 만들자마자 즉시 제출한다.
- 제출 커맨드는 아래를 사용한다:
node src/harness/cli.js submit alpha --server-url http://127.0.0.1:3000 --expr "<expression>" --submitted-by <generator-agent-id> --hypothesis "<economic hypothesis>"
- `status=accepted` 이면 그 알파는 성공적으로 DB에 저장된 것이다.
- `status=rejected_similarity` 이면 그 알파는 저장되지 않은 것이다.
- rejection이 나오면 closest_alpha_id, max_similarity, threshold를 읽고 다른 구조의 새 알파로 대체한다.
- 5개 중 reject가 있으면 accepted 5개가 찰 때까지 계속 새 알파를 생성해서 제출한다.
- 즉, 한 사이클의 완료 조건은 “accepted 상태의 새 알파 5개를 DB에 넣는 것”이다.
알파 생성 원칙:
- 함수, 데이터필드, 연산자, 구조가 기존 것과 겹치지 않도록 의식적으로 분산해라.
- 같은 skeleton에 lookback만 바꾼 것은 금지다.
- 같은 식에서 field만 치환한 것은 금지다.
- add/multiply mirror, wrapper-only gate, grouped mirror는 금지다.
- datafield family와 operator family를 의도적으로 바꿔라.
- simple first 원칙을 유지하되, 메커니즘은 분명해야 한다.
반복 루프:
1. 새 알파 가설 5개 구상
2. 식 5개 작성
3. 각 식을 즉시 제출
4. reject된 자리는 새로운 식으로 대체
5. accepted 5개가 채워지면 다음 5개 사이클 시작
6. 상위 실행기가 중단시킬 때까지 계속 반복
각 제출마다 반드시 아래 형식으로 기록해서 출력해라:
- hypothesis:
- expression:
- submit_command:
- submit_result:

여기서 `hypothesis`는 서버 DB에도 함께 저장되어야 하며, 알파 식이 노리는 핵심 경제적 관계와 그 이유를 한두 문장으로 명확히 적어라.
각 5개 사이클이 끝날 때 반드시 아래 요약을 출력해라:
- cycle_number
- accepted_count
- rejected_count
- accepted_alpha_ids
- rejected_similarity_cases
목표:
- 24시간 동안 accepted 알파를 계속 공급한다.
- queue를 비우지 않게 유지한다.
- 사람들이 무시하는 데이터필드및 관계에서 매우 중요한 경제적인 직관과 데이터 필드 사이의 관계를 알파로 찾아내라




