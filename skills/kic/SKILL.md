---
name: Kurly Impact Checker
version: 1.0.0
description: >
  기획서 기반 코드 영향도 분석 도구.
  "kic 불러줘", "킥", "임팩트 체커", "영향도 분석", "기획서 분석", "/kic" 등의
  자연어로 대화형 호출 가능
author: Kurly Dev Team
commands:
  - /kic
  - /impact init
  - /impact analyze
  - /impact view
  - /impact tickets
  - /impact config
  - /impact reindex
  - /impact policies
  - /impact owners
  - /impact annotations
  - /impact projects
  - /impact export-index
  - /impact save-result
  - /impact policy-check
  - /impact ask
  - /impact summary
  - /impact cross-analyze
  - /impact demo
  - /impact help
---

# Kurly Impact Checker

기획서를 입력하면 프로젝트 코드베이스를 분석하여 영향 범위,
난이도 점수, 작업 티켓을 자동 생성합니다.

## 명령어

### /impact init <project_path>
프로젝트를 등록하고 코드 인덱싱을 수행합니다.
실행: node {skill_dir}/../../dist/index.js init <project_path>

### /impact analyze [--file <path>]
기획서를 입력받아 영향도를 분석합니다.
실행: node {skill_dir}/../../dist/index.js analyze [--file <path>]

### /impact view [--stop]
분석 결과 시각화 웹을 실행합니다.
실행: node {skill_dir}/../../dist/index.js view [--stop]

### /impact tickets [--create] [--detail <id>]
작업 티켓을 조회하거나 생성합니다.
실행: node {skill_dir}/../../dist/index.js tickets [--create] [--detail <id>]

### /impact config
프로젝트 설정을 확인합니다.
실행: node {skill_dir}/../../dist/index.js config

### /impact reindex [--full]
코드 인덱스를 수동으로 갱신합니다.
실행: node {skill_dir}/../../dist/index.js reindex [--full]

### /impact policies [--search <keyword>] [add <content>]
정책 사전을 조회하거나 새 정책을 등록합니다.
실행: node {skill_dir}/../../dist/index.js policies [--search <keyword>] [add <content>]

### /impact owners [--add] [--edit <system>] [--remove <system>]
시스템별 담당자 및 팀 정보를 관리합니다.
실행: node {skill_dir}/../../dist/index.js owners [--add] [--edit <system>] [--remove <system>]

### /impact annotations [generate [path]] [view [path]]
보강 주석을 생성하거나 기존 보강 주석을 조회합니다.
실행: node {skill_dir}/../../dist/index.js annotations [generate [path]] [view [path]]

### /impact projects [--switch <name>] [--remove <name>] [--archive <name>]
멀티 프로젝트를 관리합니다 (전환, 제거, 아카이브).
실행: node {skill_dir}/../../dist/index.js projects [--switch <name>] [--remove <name>] [--archive <name>]

### /impact export-index [--project <id>] [--summary|--full] [--output <file>]
코드 인덱스를 요약 또는 전체 형태로 내보냅니다. AI 분석 프로토콜의 Step 1에서 사용합니다.
실행: node {skill_dir}/../../dist/index.js export-index [--project <id>] [--summary|--full] [--output <file>]

### /impact save-result --file <path> [--project <id>]
분석 결과 JSON 파일을 프로젝트 저장소에 등록합니다. AI 분석 프로토콜의 Step 4에서 사용합니다.
실행: node {skill_dir}/../../dist/index.js save-result --file <path> [--project <id>]

### /impact policy-check [--policy <name>] [--change <description>]
정책 영향도를 분석합니다. 옵션 없이 실행하면 전체 정책 현황 요약을 표시합니다.
- `--policy <name>`: 특정 정책 상세 조회 (부분 매칭 지원)
- `--change <description>`: 변경 내용이 기존 정책에 미치는 영향 분석
실행: node {skill_dir}/../../dist/index.js policy-check [--policy <name>] [--change <description>]

### /impact ask <질문>
코드베이스에 대한 자유 질의를 수행합니다. 질문에서 키워드를 추출하여 인덱스를 검색하고 관련 파일, 컴포넌트, API, 화면, 정책, 모델을 찾아줍니다.
실행: node {skill_dir}/../../dist/index.js ask <질문>

### /impact summary [--system <name>] [--recent]
프로젝트 요약 정보를 표시합니다. 옵션 없이 실행하면 전체 프로젝트 통계를 출력합니다.
- `--system <name>`: 특정 시스템(모듈) 상세 요약
- `--recent`: Git log 기반 최근 변경 요약
실행: node {skill_dir}/../../dist/index.js summary [--system <name>] [--recent]

### /impact cross-analyze [--source <project-id>] [--group <group-name>]
크로스 프로젝트 영향도 분석을 수행합니다. 소스 프로젝트의 API 변경이 연결된 프로젝트에 미치는 영향을 분석합니다.
- `--source <project-id>`: 소스 프로젝트 지정 (기본: 활성 프로젝트)
- `--group <group-name>`: 특정 그룹 대상으로 분석
실행: node {skill_dir}/../../dist/index.js cross-analyze [--source <project-id>] [--group <group-name>]

### /impact demo
샘플 데이터 기반으로 도구를 체험합니다.
실행: node {skill_dir}/../../dist/index.js demo

### /impact help [command] / /impact faq
도움말을 표시하거나 자주 묻는 질문(FAQ)을 조회합니다.
실행: node {skill_dir}/../../dist/index.js help [command]

---

## AI 분석 프로토콜 (Claude Native Mode)

사용자가 기획서 분석을 요청하면 아래 4단계로 진행한다.
단, 사용자가 "규칙 기반으로", "CLI로 분석" 등을 명시하면 기존 `analyze --file <path>` 명령어를 사용한다.

### Step 1: 코드 인덱스 로드
```bash
node {skill_dir}/../../dist/index.js export-index [--project <id>]
```
- stdout으로 인덱스 요약 JSON을 수신한다.
- 프로젝트의 화면/컴포넌트/API/모델/정책/의존성 구조를 파악한다.
- 대형 프로젝트의 경우 기본값(요약 모드)을 사용하고, 상세 정보가 필요하면 `--full` 옵션을 추가한다.

### Step 2: 기획서 읽기
사용자로부터 기획서를 받는다:
- 파일 경로 제공 시: Read 도구로 직접 읽기 (PDF도 Read 도구가 지원)
- 텍스트 직접 입력 시: 그대로 사용

기획서에서 다음을 추출한다:
- 기능 요구사항 (features)
- 비즈니스 규칙 (businessRules)
- 변경/추가되는 화면 (screens)
- 불명확한 사항 (ambiguities)

### Step 3: 영향도 분석 수행
인덱스 + 기획서 내용을 대조하여 직접 분석한다:
- 영향받는 화면/컴포넌트/API 식별 (인덱스의 화면명, 라우트, 컴포넌트명으로 매칭)
- FE/BE 작업 항목 도출
- 정책 충돌 감지 (인덱스의 policies와 기획서 요구사항 비교)
- 4차원 난이도 점수 산출 (developmentComplexity, impactScope, policyChange, dependencyRisk)
- 등급 결정: Low(0-15), Medium(16-40), High(41-70), Critical(71+)

### Step 4: 결과 저장 및 시각화
분석 결과를 ConfidenceEnrichedResult JSON으로 구조화한다 (하단 "분석 결과 JSON 스키마" 참조).
임시 파일로 저장 후 CLI로 등록:
```bash
node {skill_dir}/../../dist/index.js save-result --file <temp-result.json> [--project <id>]
```

저장 완료 후 대시보드 안내:
```bash
node {skill_dir}/../../dist/index.js view
```
→ http://localhost:3847 에서 결과 확인 가능

---

## 분석 결과 JSON 스키마

AI 분석 결과는 ConfidenceEnrichedResult 타입에 맞는 JSON이어야 한다.
아래 스키마를 준수하여 JSON을 생성하고, `save-result` 명령어로 저장한다.

### 전체 구조

```json
{
  "analysisId": "analysis-1708012800000",
  "analyzedAt": "2026-02-16T12:00:00.000Z",
  "specTitle": "기획서 제목",
  "analysisMethod": "claude-native",
  "affectedScreens": [ ... ],
  "tasks": [ ... ],
  "planningChecks": [ ... ],
  "policyChanges": [ ... ],
  "screenScores": [ ... ],
  "totalScore": 32,
  "grade": "Medium",
  "recommendation": "권장 사항 텍스트",
  "policyWarnings": [ ... ],
  "ownerNotifications": [ ... ],
  "confidenceScores": [ ... ],
  "lowConfidenceWarnings": [ ... ]
}
```

### affectedScreens 항목

```json
{
  "screenId": "screen-cart",
  "screenName": "장바구니",
  "impactLevel": "high",
  "tasks": [
    {
      "id": "task-001",
      "title": "작업 제목",
      "type": "FE",
      "actionType": "modify",
      "description": "작업 설명",
      "affectedFiles": ["src/pages/Cart.tsx"],
      "relatedApis": ["api-cart-items"],
      "planningChecks": ["check-001"],
      "rationale": "분석 근거"
    }
  ]
}
```
- `impactLevel`: `"low"` | `"medium"` | `"high"` | `"critical"`
- `tasks`: 해당 화면에 속하는 작업 목록. 최상위 `tasks` 배열에도 동일하게 포함한다.

### tasks 항목

```json
{
  "id": "task-001",
  "title": "장바구니 쿠폰 적용 UI 구현",
  "type": "FE",
  "actionType": "modify",
  "description": "쿠폰 입력 필드 및 적용 버튼 추가",
  "affectedFiles": ["src/pages/Cart.tsx", "src/components/CouponInput.tsx"],
  "relatedApis": ["api-apply-coupon"],
  "planningChecks": ["check-001"],
  "rationale": "기획서 3.2절 쿠폰 적용 요구사항에 따라 장바구니 화면 수정 필요"
}
```
- `type`: `"FE"` | `"BE"` (프론트엔드/백엔드 구분 필수)
- `actionType`: `"new"` | `"modify"` | `"config"`

### planningChecks 항목

```json
{
  "id": "check-001",
  "content": "쿠폰 중복 적용 가능 여부 확인 필요",
  "relatedFeatureId": "feat-coupon",
  "priority": "high",
  "status": "pending"
}
```
- `priority`: `"high"` | `"medium"` | `"low"`
- `status`: 항상 `"pending"` (생성 시점)

### policyChanges 항목

```json
{
  "id": "policy-change-001",
  "policyName": "쿠폰 사용 정책",
  "description": "1인 1쿠폰 제한 정책을 중복 적용 가능으로 변경",
  "changeType": "modify",
  "affectedFiles": ["src/policies/coupon-policy.ts"],
  "requiresReview": true
}
```
- `changeType`: `"new"` | `"modify"` | `"remove"`

### screenScores 항목

```json
{
  "screenId": "screen-cart",
  "screenName": "장바구니",
  "screenScore": 25,
  "grade": "Medium",
  "taskScores": [
    {
      "taskId": "task-001",
      "scores": {
        "developmentComplexity": { "score": 6, "weight": 0.35, "rationale": "근거" },
        "impactScope": { "score": 7, "weight": 0.30, "rationale": "근거" },
        "policyChange": { "score": 5, "weight": 0.20, "rationale": "근거" },
        "dependencyRisk": { "score": 4, "weight": 0.15, "rationale": "근거" }
      },
      "totalScore": 25,
      "grade": "Medium"
    }
  ]
}
```
- 각 score 차원의 점수는 1~10 범위
- `totalScore` = 각 차원 (score * weight * 10)의 합산
- `grade`: `"Low"` (0-15) | `"Medium"` (16-40) | `"High"` (41-70) | `"Critical"` (71+)

### confidenceScores 항목

```json
{
  "systemId": "screen-cart",
  "systemName": "장바구니",
  "overallScore": 85,
  "grade": "high",
  "layers": {
    "layer1Structure": { "score": 90, "weight": 0.25, "details": "화면 파일 정확히 식별" },
    "layer2Dependency": { "score": 80, "weight": 0.25, "details": "API 의존성 확인됨" },
    "layer3Policy": { "score": 75, "weight": 0.20, "details": "관련 정책 1건 매칭" },
    "layer4Analysis": { "score": 90, "weight": 0.30, "details": "작업 항목 구체적" }
  },
  "warnings": [],
  "recommendations": []
}
```
- `grade`: `"high"` (80+) | `"medium"` (60-79) | `"low"` (40-59) | `"very_low"` (<40)
- 각 영향받는 화면(시스템)마다 1개씩 생성한다.

### lowConfidenceWarnings 항목

```json
{
  "systemId": "screen-cart",
  "systemName": "장바구니",
  "confidenceScore": 35,
  "grade": "very_low",
  "reason": "인덱스에 해당 화면의 컴포넌트 정보 부족",
  "action": "/impact reindex --full 실행 후 재분석 권장"
}
```
- `overallScore`가 60 미만인 시스템에 대해서만 생성한다.

### 필드별 규칙 요약

| 필드 | 규칙 |
|------|------|
| `analysisId` | `"analysis-"` + 타임스탬프 (밀리초) |
| `analyzedAt` | ISO 8601 형식 |
| `analysisMethod` | 반드시 `"claude-native"` 설정 |
| `grade` | totalScore 기준 - Low(0-15), Medium(16-40), High(41-70), Critical(71+) |
| `affectedScreens` | 인덱스의 screens와 매칭하여 screenId 사용 |
| `tasks` | FE/BE 구분 필수, affectedFiles는 인덱스 기반 추정 |
| `policyWarnings` | 정책 충돌이 없으면 빈 배열 |
| `ownerNotifications` | 담당자 정보가 없으면 빈 배열 |
| `confidenceScores` | 각 시스템(화면)별 분석 신뢰도와 근거 |

---

## 대화형 모드 (Conversational Mode)

### 활성화 트리거
다음 키워드/표현이 감지되면 대화형 모드로 동작합니다:
- Slash: `/kic`
- 한국어: "kic", "kic 불러줘", "킥", "임팩트 체커", "영향도 분석", "기획서 분석"
- 영어: "impact checker", "impact analysis"
- 복합: "kic 분석해줘", "킥 결과 보여줘"

### 활성화 시 동작 프로토콜

1. **상태 감지**: 먼저 Bash로 다음을 확인합니다.
   ```
   node {skill_dir}/../../dist/index.js config
   ```
   - 등록된 프로젝트가 있는지
   - 최근 분석 결과가 있는지

2. **상태별 인사 메시지**:

   **프로젝트 미등록 시:**
   ```
   KIC (Kurly Impact Checker) v1.0

   현재 등록된 프로젝트가 없습니다.

   시작하려면 분석 대상 프로젝트의 소스 경로를 알려주세요.

     예) /Users/you/projects/kurly-app

   또는 현재 디렉토리를 사용하려면 "여기"라고 입력하세요.
   ```

   **프로젝트 등록됨 + 분석 결과 없음:**
   ```
   KIC | {프로젝트명}

   등록된 프로젝트: {경로}
   마지막 분석: 없음

   무엇을 하시겠습니까?

     [1] 기획서 분석 시작
     [2] 프로젝트 요약 보기
     [3] 정책 확인
     [4] 코드베이스 질문하기
     [5] 소스 경로 변경
     [6] 프로젝트 설정 보기
   ```

   **프로젝트 등록됨 + 분석 결과 있음:**
   ```
   KIC | {프로젝트명}

   등록된 프로젝트: {경로}
   마지막 분석: {날짜} | {등급} ({점수}점) | 영향 화면 {N}개

   무엇을 하시겠습니까?

     [1] 새 기획서 분석
     [2] 이전 결과 대시보드 열기
     [3] 이전 결과 요약 다시 보기
     [4] 프로젝트 요약 보기
     [5] 정책 확인
     [6] 코드베이스 질문하기
     [7] 프로젝트 설정
   ```

3. **후속 대화**: 사용자가 번호 또는 자연어로 응답하면 해당 동작 수행

### 자연어 → CLI 매핑

사용자의 자연어 입력을 아래 테이블에 따라 CLI 명령어로 매핑하여 실행합니다:

| 사용자 의도 | 실행 방식 | 트리거 예시 |
|------------|----------|-----------|
| 프로젝트 등록 | `node {skill_dir}/../../dist/index.js init <path>` | "이 경로가 분석 대상이야", "프로젝트 등록" |
| 기획서 분석 | AI 분석 프로토콜 (Step 1~4) | "분석해줘", "기획서 분석", "영향도 체크" |
| 기획서 분석 (규칙 기반) | `node {skill_dir}/../../dist/index.js analyze --file <path>` | "규칙 기반으로 분석", "CLI로 분석" |
| AI 분석, 정밀 분석 | AI 분석 프로토콜 (Step 1~4) | "AI로 분석해줘", "정밀 분석", "AI 분석" |
| 인덱스 내보내기 | `node {skill_dir}/../../dist/index.js export-index` | "인덱스 내보내기", "인덱스 확인" |
| 결과 저장 | `node {skill_dir}/../../dist/index.js save-result --file <path>` | "결과 저장", "분석 결과 저장" |
| 결과 보기 | `node {skill_dir}/../../dist/index.js view` | "결과 보여줘", "대시보드 열어줘" |
| 티켓 생성 | `node {skill_dir}/../../dist/index.js tickets` | "티켓 만들어줘", "작업 분배" |
| 데모 | `node {skill_dir}/../../dist/index.js demo` | "데모 보여줘", "샘플" |
| 설정 | `node {skill_dir}/../../dist/index.js config` | "설정", "프로젝트 설정" |
| 인덱스 갱신 | `node {skill_dir}/../../dist/index.js reindex` | "인덱스 갱신", "재스캔" |
| 정책 검색 | `node {skill_dir}/../../dist/index.js policies --search <term>` | "정책 검색" |
| 정책 확인 | `node {skill_dir}/../../dist/index.js policy-check` | "정책 확인", "정책 체크", "policy check" |
| 코드 질의 | `node {skill_dir}/../../dist/index.js ask <질문>` | "질문", "물어볼게", "궁금한게", "ask" |
| 프로젝트 요약 | `node {skill_dir}/../../dist/index.js summary` | "요약", "프로젝트 요약", "통계", "summary" |
| 크로스 분석 | `node {skill_dir}/../../dist/index.js cross-analyze` | "크로스 분석", "프로젝트 간 영향", "cross analyze" |
| 담당자 | `node {skill_dir}/../../dist/index.js owners` | "담당자 확인" |
| 주석 생성 | `node {skill_dir}/../../dist/index.js annotations generate` | "주석 생성", "코드 분석 메모" |
| 프로젝트 전환 | `node {skill_dir}/../../dist/index.js projects --switch <name>` | "다른 프로젝트" |
| 도움말 | `node {skill_dir}/../../dist/index.js help` | "도움말", "뭘 할 수 있어?" |

### 분석 결과 응답 형식

분석 완료 후 다음 형식으로 요약합니다:

```
분석 완료 | 소요 시간: {N}초

  등급: {등급} ({점수}점)
  영향 화면: {N}개
  영향 컴포넌트: {N}개
  작업 항목: {N}개 (높음 {N} / 보통 {N} / 낮음 {N})

  높음 작업 항목:
    1. {항목1}
    2. {항목2}
    ...

대시보드를 브라우저에서 여시겠습니까? [Y/n]
```

### Chrome MCP 대시보드 오픈

대시보드 열기 요청 시:
1. Bash로 웹서버 시작: `node {skill_dir}/../../dist/index.js view`
2. Chrome MCP 도구가 사용 가능한 경우:
   - `mcp__Claude_in_Chrome__tabs_context_mcp`로 탭 컨텍스트 확인
   - `mcp__Claude_in_Chrome__tabs_create_mcp`로 새 탭 생성
   - `mcp__Claude_in_Chrome__navigate`로 `http://localhost:3847` 이동
3. Chrome MCP 미사용 시: CLI의 openBrowser()에 의존 + URL 텍스트 안내

### 응답 규칙

- 한국어 기본
- 간결하고 핵심 위주 (불필요한 기술 디테일 최소화)
- 이모지: 정보 전달 목적만 (등급/상태 표시에 한정)
- 에러 발생 시: 원인 + 해결방법 함께 제시 (사과 없이 바로 본론)
- 매 응답 끝에 가능한 다음 행동 안내
- 번호 선택지 제공 시 자연어 입력도 동일하게 처리
- 기본값이 있는 질문은 [Y/n] 형태 사용

### /kic

대화형 모드의 슬래시 명령어 진입점입니다.

실행: 위의 "활성화 시 동작 프로토콜"을 따릅니다.
