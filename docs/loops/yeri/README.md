# 예리의 Loop 설계

battery 프로그램의 **버그를 고칠 때** 쓰는 Loop(버그수정용)입니다.
Dynamic Workflow(`/ih`)와 Subagent(prepare, implement, verify)로 만들며, 이 문서에는 **설계 설명**을 적습니다.

## 1. 한 줄 설명

"이런 버그를 고쳐 주세요"라는 요청을 받으면 **먼저 점검**(재현·원인 확인)하고, 문제가 없으면 **수정**한 뒤, 보유한 **테스트를 모두 돌려 검증**해서 결과를 HTML 두 장으로 남깁니다. 검증에 실패하면 그 실패를 들고 **점검 단계로 되돌아갑니다.**

## 2. 범위

- **다루는 일:** 동작이 PRD·INTENT에 정한 것과 다르거나 오류가 나는 문제를 고치는 일
  (예: 취소 직후 삭제된 주문 상세로 이동해 HTTP 500이 나는 것, 없는 주문 번호로 접속하면 안내 없이 HTTP 500이 나는 것)
- **다루지 않는 일:** 새 기능 추가, 구조만 바꾸는 리팩토링. 점검과 검증 방법이 달라서 따로 둡니다.
- 버그수정용이라는 표시는 산출물 HTML의 `<body data-loop="bugfix">`입니다. HTML 틀은 팀 공용 템플릿(`docs/templates/`)을 씁니다.

## 3. 흐름

```
 /ih 버그 설명
  ▼
[prepare]   배경·목적을 이해했나? 큰 변경·높은 위험을 사용자가 아나?
  │         재현·원인 확인, 구현 후 확인할 체크리스트 3개
  │         ──► 점검 로그 + precheck.html
  ├─ status HITL ─► Loop 종료 (사람에게 질문·경고를 돌려줌, 수정하지 않음)
  ▼ GO
[implement] Plan → 수정 → 자가검증
  ▼
[verify]    체크리스트 3개 확인 + 보유한 Regression Test 전부 실행
  │         ──► 검증 로그
  ├─ FAIL ─► 실패 내용과 피드백을 들고 prepare 로 되돌아감 (최대 3회차)
  ▼ PASS
 Report 작성 (report_*.HTML) ─► Loop 종료  (commit·PR은 사람이 직접)
```

각 단계는 Subagent라서 **새 대화로 시작**합니다. 앞 단계의 생각에 끌려가지 않아 오작동이 줄어듭니다.

## 4. 단계별로 하는 일

**prepare (구현 전 점검)**

| 점검 | 내용 |
|---|---|
| 배경 이해 | 사용자가 어떤 상황인지 근거를 들어 말할 수 있나. 추측이 필요하면 이해하지 못한 것 → HITL |
| 목적 이해 | 왜 고쳐야 하고, 고치면 무엇이 달라져야 하나 |
| 규모·위험 | 변경이 너무 크거나 위험이 높은데 사용자가 모르면 경고하며 HITL |
| 재현·원인 (버그수정) | 재현 방법(단계·입력·기대와 실제), 원인 코드 위치, 같은 증상이 다른 곳에 있는지 |
| 영향 범위·기존 테스트 | 바꿀 파일, 관련 JUnit·E2E, 테스트 공백 |
| 체크리스트 3개 | 수정 후 가장 중요하게 확인할 3가지와 확인 방법 |

**implement (수정)**
- Plan을 세우고, 계획에 있는 것만 최소한으로 고치고, 빌드·테스트로 스스로 확인한 뒤 보고합니다.

**verify (구현 후 검증)**

| 검증 | 내용 |
|---|---|
| 체크리스트 3개 | prepare가 정한 항목을 하나씩 확인 (충족 / 미충족 / 확인 못 함) |
| Regression Test 전부 | JUnit(`./gradlew test`)과 E2E(`src/test/e2e` 전체)를 하나도 빼지 않고 실행 |
| 버그수정에서 특히 | 재현 절차가 이제 통과하는지, 알려진 결함 테스트(`test.fail()`)가 고쳐져서 `test.fail()` 제거가 필요한지 |

**사람이 확인하는 곳 (HITL)**
- prepare가 이해하지 못했거나, 큰 변경·높은 위험을 사용자가 모를 때만 멈춥니다.
- 평소에는 사람이 중간에 끼지 않고 Loop가 끝까지 돕니다.

## 5. 끝나는 조건

| 종료 | 조건 |
|---|---|
| `done` | 체크리스트 3개 충족 + Regression Test 모두 기대한 결과. Report를 만들고 종료 |
| `hitl` | prepare가 사람 확인을 요청. 질문·경고를 돌려주고 수정하지 않음 |
| `max_rounds` | 3회차까지 돌았는데도 검증이 통과하지 못함. 실패 내용과 피드백을 돌려줌 |
| `failed` | prepare·implement·verify 중 하나가 결과를 내지 못함 |

## 6. 산출물

```
docs/evidence/yeri/{작업번호+작업명}/     예: BUG-001-cancel-redirect
├─ precheck.html   구현 전 점검 내용 (요청 요약, 배경·목적 이해, 규모·위험, 재현·원인, 영향 범위, 계획, 체크리스트 3개)
└─ report.html     구현 요약, 바뀐 파일, 빌드·테스트 결과, 반복 횟수, 남은 문제

docs/logs/
├─ prepare/inspection_날짜_시간_초.log   점검 기록 (HITL로 끝나도 남음)
├─ verify/review_날짜_시간_초.log        검증 기록 (PASS·FAIL 모두 남음)
└─ reports/report_날짜_시간_초.HTML      PASS일 때만 만드는 Report (세 단계가 한 일을 짧게 정리)
```

- **작업 폴더 이름:** `작업번호-작업명`. 작업번호는 버그 순서대로 `BUG-001`, `BUG-002`처럼 붙이고, 작업명은 고칠 내용을 알 수 있는 짧은 영어 소문자와 하이픈으로 씁니다. (예: `BUG-001-cancel-redirect`, `BUG-002-order-not-found`) 버그마다 폴더가 따로라 이전 버그의 점검·보고가 덮어써지지 않습니다.
- precheck.html과 report.html은 공용 템플릿(`docs/templates/precheck.template.html`, `report.template.html`)의 틀을 따릅니다.
- `report.html`은 verify가 **PASS일 때만** 만듭니다. FAIL이면 폴더에는 `precheck.html`만 있고, 검증 로그만 남깁니다. (`docs/logs/reports/`의 Report와 같은 내용입니다.)
- 같은 버그를 prepare로 되돌아가 다시 돌면(Feedback Loop) 같은 작업 폴더의 `precheck.html`을 그 회차 점검 내용으로 갱신하고, 이전 실패와 원인을 함께 적습니다.

## 7. 지키는 규칙

- 개발 앱(8080)과 개발 DB(`./data/battery`)는 건드리지 않습니다. E2E는 별도 포트·별도 DB로 띄운 앱에 돌립니다.
- commit, push, PR은 자동으로 하지 않습니다. 사람이 요청할 때만 합니다.
- 확인하지 못한 것은 "확인하지 못함"이라고 적고, 통과했다고 쓰지 않습니다.
- 일부 테스트만 골라 돌리지 않습니다. 검증에 실패했다고 테스트나 `test.fail()`을 마음대로 바꾸지 않습니다.
- 범위 밖으로 확정된 것(PRD 10장)은 고치지 않습니다. (예: 중복 확정 방지)

## 8. 구현 위치와 현재 상태

| 구성 | 위치 | 상태 |
|---|---|---|
| 워크플로 | `.claude/workflows/ih.js` | 있음. 에이전트 없이 흐름만 시험(통과, 실패 후 재시도, HITL, 횟수 초과)했고, 실제 에이전트로는 아직 돌리지 않음 |
| Subagent | `.claude/agents/prepare.md`, `implement.md`, `verify.md` | 있음. 아직 Loop 종류 구분 없이 공통 지침 |
| 공용 템플릿 | `docs/templates/precheck.template.html`, `report.template.html` | 있음 (PR #15) |

**아직 하지 않은 것**
- prepare·verify가 공용 템플릿을 실제로 쓰도록 지침 연결
- 버그수정 전용 지침(재현·원인·재발 방지)을 에이전트에 반영. 지금은 위 4장에 설계로만 적어 둠
- 작업번호+작업명 폴더(`docs/evidence/yeri/{작업번호+작업명}/`)에 저장하도록 `ih.js`와 prepare·verify 지침 반영 (지금은 `docs/evidence/yeri/` 바로 아래에 `precheck.html`, `report.html`을 쓰고 다음 작업 때 덮어씀)
- 실제 에이전트로 한 번 돌려 보는 것

## 9. 테스트 계획

확인용 버그로 Loop를 한 번 돌려 봅니다.

> 주문을 취소한 직후 삭제된 주문의 상세로 이동해 HTTP 500 오류 화면이 뜬다. 취소 직후 **주문 목록으로 이동**하게 고친다. (INTENT 9장 1번, E2E-033)

- 기대: prepare가 PRD 7장("취소 직후에는 이전 페이지로 이동")을 근거로 GO를 반환하고, 수정 뒤 E2E-033의 `test.fail()` 제거 필요를 verify가 알려 줍니다.
- 작업 폴더: `docs/evidence/yeri/BUG-001-cancel-redirect/`
- 확인할 것: 점검 로그·검증 로그와 작업 폴더의 `precheck.html`·`report.html`, `report_*.HTML`이 위 위치에 제대로 만들어지는지, FAIL일 때 prepare로 되돌아가는지
- 이 테스트로 바뀐 코드는 **commit하지 않습니다.**
