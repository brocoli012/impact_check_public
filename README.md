# Kurly Impact Checker

> 기획서 한 장으로 코드 영향도를 파악하세요.

기획 문서를 입력하면 코드베이스를 자동 분석하여 영향받는 화면, 작업 항목, 난이도 점수, 정책 경고, 담당자 알림을 생성하는 Claude Code 스킬입니다.

- 별도 API 키 없이 바로 사용 가능 (Zero Config)
- 명령어 또는 자연어 대화로 모든 기능 이용
- 플러그인으로 팀 전체에 간편 배포
- AI 분석 프로토콜 (Claude Native Mode)로 정밀 영향도 분석
- 증분 인덱싱으로 변경 파일만 빠르게 갱신
- 코드 보강 주석(어노테이션)으로 분석 신뢰도 향상
- 자연어 질의, 정책 체크, 프로젝트 요약 등 다중 쿼리 지원
- 웹 대시보드에서 정책 뷰 및 크로스 프로젝트 임팩트 시각화

---

## 빠른 시작

### 1. 설치

**방법 1: Claude Code 플러그인 (권장)**
```bash
claude plugin add https://github.com/brocoli012/impact_checker
```

**방법 2: 수동 설치**
```bash
# 스킬 등록
claude skill add /path/to/kurly-impact-checker

# 의존성 설치
cd /path/to/kurly-impact-checker
npm install
npm run build

cd web
npm install
```

### 2. 프로젝트 초기화

분석 대상 프로젝트를 등록합니다.

```
/impact init /path/to/your/project
```

초기화 시 수행되는 작업:
- TypeScript/JavaScript 파일 AST 파싱
- 의존성 그래프(import/export) 구축
- 비즈니스 정책 자동 추출
- `.gitignore` 패턴 자동 반영

### 3. 기획서 분석

**규칙 기반 분석** -- 기획서 파일을 지정하여 즉시 분석합니다.

```
/impact analyze --file plan.txt
```

**AI 분석 (Claude Native Mode)** -- 대화형 모드에서 기획서를 제공하면 4단계 AI 분석 프로토콜이 자동으로 실행됩니다.

```
사용자: kic 불러줘
  KIC: 메뉴 제시
사용자: 이 기획서 분석해줘 (파일 첨부)
  KIC: AI 분석 프로토콜 실행 -> 결과 저장 -> 대시보드 안내
```

### 4. 결과 확인

시각화 대시보드를 브라우저에서 엽니다.

```
/impact view
```

대시보드 종료:

```
/impact view --stop
```

---

## 사용 흐름

```
기획서 작성
  |
  v
프로젝트 초기화 (/impact init)
  |- TypeScript/JS 파일 AST 파싱
  |- 의존성 그래프 구축
  |- 비즈니스 정책 추출
  |
  v
기획서 분석
  |- 규칙 기반: /impact analyze --file <path>
  |- AI 분석: 대화형 모드에서 4단계 프로토콜 자동 실행
  |   Step 1: 코드 인덱스 로드 (export-index)
  |   Step 2: 기획서 읽기 및 구조화
  |   Step 3: AI 영향도 분석 수행
  |   Step 4: 결과 저장 (save-result) + 대시보드
  |
  v
결과 확인 (/impact view)
  |- 플로우차트 (영향 관계 시각화)
  |- KPI 카드 (점수, 등급, 영향 범위)
  |- 체크리스트 (기획 확인 사항, 정책 경고)
  |- 정책 뷰 (정책 카드, 조건 분기, 영향 범위 그래프)
  |- 크로스 프로젝트 (프로젝트 간 의존성 다이어그램)
  |
  v
티켓 생성 (/impact tickets)
  |- 마크다운 작업 티켓 자동 생성
  |- 담당자 자동 매핑
```

---

## 대화형 모드

명령어를 외울 필요 없이 자연어로 사용할 수 있습니다.

```
/kic
```

"kic 불러줘", "킥", "임팩트 체커", "영향도 분석" 등으로 호출하면 대화형 인터페이스가 시작됩니다.

### 메뉴 구조

프로젝트 상태에 따라 다른 메뉴가 표시됩니다.

**프로젝트 등록 + 분석 결과 있을 때:**
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

### 대화 예시

```
사용자: kic 불러줘
  KIC: 프로젝트 상태 확인 후 메뉴 제시

사용자: 이 기획서 분석해줘 (파일 첨부)
  KIC: AI 분석 완료 | 등급: High (52점) | 영향 화면 4개 | 작업 12개

사용자: 대시보드 열어줘
  KIC: http://localhost:3847 에서 대시보드 오픈

사용자: 장바구니 관련 코드가 어디 있어?
  KIC: /impact ask 실행 -> 관련 파일, 컴포넌트, API 목록 제시

사용자: 최근 변경 사항 요약해줘
  KIC: /impact summary --recent 실행 -> Git 기반 변경 요약

사용자: 배송비 정책 확인해줘
  KIC: /impact policy-check --policy 배송비 실행 -> 정책 상세 표시
```

### 자연어 -> 명령어 매핑

| 사용자 의도 | 실행 명령어 | 트리거 예시 |
|------------|-----------|-----------|
| 프로젝트 등록 | `init <path>` | "프로젝트 등록", "이 경로 분석 대상" |
| 기획서 분석 | AI 분석 프로토콜 (4단계) | "분석해줘", "기획서 분석", "영향도 체크" |
| 기획서 분석 (규칙 기반) | `analyze --file <path>` | "규칙 기반으로 분석", "CLI로 분석" |
| 인덱스 갱신 | `reindex` | "인덱스 갱신", "재스캔" |
| 정책 검색 | `policies --search <term>` | "정책 검색" |
| 정책 체크 | `policy-check` | "정책 확인", "정책 체크" |
| 코드 질의 | `ask <질문>` | "질문", "물어볼게", "궁금한게" |
| 프로젝트 요약 | `summary` | "요약", "통계", "프로젝트 요약" |
| 크로스 분석 | `cross-analyze` | "크로스 분석", "프로젝트 간 영향" |
| 주석 생성 | `annotations generate` | "주석 생성", "코드 분석 메모" |
| 결과 보기 | `view` | "결과 보여줘", "대시보드 열어줘" |
| 티켓 생성 | `tickets` | "티켓 만들어줘", "작업 분배" |
| 담당자 확인 | `owners` | "담당자 확인" |
| 도움말 | `help` | "도움말", "뭘 할 수 있어?" |

---

## AI 분석 프로토콜 (Claude Native Mode)

대화형 모드에서 기획서 분석을 요청하면 아래 4단계가 자동으로 실행됩니다. "규칙 기반으로 분석", "CLI로 분석"을 명시하면 기존 `analyze --file` 명령어를 사용합니다.

### Step 1: 코드 인덱스 로드

```
/impact export-index [--project <id>]
```

프로젝트의 화면/컴포넌트/API/모델/정책/의존성 구조를 인덱스 요약 JSON으로 수신합니다. 대형 프로젝트는 기본 요약 모드를 사용하며, 상세 정보가 필요하면 `--full` 옵션을 추가합니다.

### Step 2: 기획서 읽기

사용자로부터 기획서를 수신하여 다음을 추출합니다:
- 기능 요구사항 (features)
- 비즈니스 규칙 (businessRules)
- 변경/추가되는 화면 (screens)
- 불명확한 사항 (ambiguities)

파일 경로 제공 시 Read 도구로 직접 읽으며, PDF 파일도 지원됩니다.

### Step 3: AI 영향도 분석

인덱스와 기획서 내용을 대조하여 분석합니다:
- 영향받는 화면/컴포넌트/API 식별 (인덱스의 화면명, 라우트, 컴포넌트명으로 매칭)
- FE/BE 작업 항목 도출
- 정책 충돌 감지 (인덱스의 policies와 기획서 요구사항 비교)
- 4차원 난이도 점수 산출
- 등급 결정: Low(0-15), Medium(16-40), High(41-70), Critical(71+)

### Step 4: 결과 저장 + 대시보드

분석 결과를 ConfidenceEnrichedResult JSON으로 구조화하여 임시 파일로 저장 후 등록합니다:

```
/impact save-result --file <temp-result.json> [--project <id>]
```

저장 완료 후 대시보드를 통해 시각적으로 확인할 수 있습니다:

```
/impact view
```

### 분석 결과 포함 항목

| 항목 | 설명 |
|------|------|
| 영향 화면 | 변경이 필요한 화면 목록 및 영향 수준 |
| 작업 항목 | FE/BE별 구체적 작업, 영향 파일, 관련 API |
| 기획 확인 사항 | 불명확하거나 추가 확인이 필요한 항목 |
| 정책 변경 | 기존 비즈니스 정책과의 충돌 가능성 |
| 난이도 점수 | 4차원 점수 (개발 복잡도, 영향 범위, 정책 변경, 의존성 위험도) |
| 신뢰도 점수 | 4 Layer 구조의 분석 신뢰도 평가 |
| 담당자 알림 | 영향받는 시스템별 담당자 매핑 |

---

## 시각화 대시보드

`/impact view` 명령으로 브라우저에서 분석 결과를 시각적으로 확인할 수 있습니다. 기본 포트는 3847입니다.

### 대시보드
전체 난이도 점수, 등급, 영향받는 화면 수, 총 작업 수 등 핵심 지표를 KPI 카드로 한눈에 파악할 수 있습니다. 작업 유형별 분포(FE/BE/공통), 점수 차원별 레이더 차트 등을 Recharts 기반으로 제공합니다.

### 플로우차트
영향받는 화면, 컴포넌트, API 간의 연결 관계를 React Flow 기반 플로우차트로 표시합니다. 노드를 클릭하면 상세 정보를 확인할 수 있으며, 필터바로 특정 유형만 표시할 수 있습니다.

### 체크리스트
기획서에서 추출된 확인 사항과 기존 정책과의 충돌 경고를 자동으로 생성합니다. 카테고리별 그룹핑을 지원합니다.

### 담당자 매핑
영향받는 시스템별 담당자를 자동으로 매핑하여 알림 대상을 식별합니다.

### 정책 뷰

정책 관련 분석 결과를 전용 페이지에서 확인합니다.

- **정책 카드**: 각 정책의 요약 정보를 카드 형태로 표시
- **카테고리 필터**: 정책 유형별 필터링 (가격, 할인, 배송, 결제 등)
- **정책 상세**: 정책 클릭 시 상세 내용, 관련 파일, 영향받는 화면 표시
- **조건 분기 시각화**: 정책 내 조건 로직을 React Flow 기반 플로우차트로 시각화
- **영향 범위 그래프**: 정책이 영향을 미치는 컴포넌트/API 범위를 그래프로 표시

### 크로스 프로젝트 임팩트

프로젝트 간 API 의존성을 시각화합니다.

- **프로젝트 의존성 다이어그램**: 연결된 프로젝트 간 API 호출 관계를 React Flow 기반으로 표시
- **크로스 프로젝트 요약**: 프로젝트 간 영향도 KPI 카드, API 계약 변경 사항 표시

---

## 전체 명령어

| 명령어 | 설명 |
|--------|------|
| `/kic` | 대화형 모드 진입 |
| `/impact init <path>` | 프로젝트 초기화 및 코드 인덱싱 |
| `/impact analyze --file <path>` | 기획서 영향도 분석 (규칙 기반) |
| `/impact view [--stop]` | 시각화 웹 대시보드 열기/종료 |
| `/impact tickets [--create] [--detail <id>]` | 작업 티켓 조회/생성 |
| `/impact config` | 프로젝트 설정 확인 |
| `/impact reindex [--full \| --incremental]` | 코드 인덱스 갱신 (증분/전체) |
| `/impact policies [--search <keyword>] [add <content>]` | 정책 사전 조회/등록 |
| `/impact policy-check [--policy <name>] [--change <desc>]` | 정책 영향도 분석 |
| `/impact ask <질문>` | 코드베이스 자유 질의 |
| `/impact summary [--system <name>] [--recent]` | 프로젝트 요약 정보 |
| `/impact annotations [generate \| view] [path]` | 코드 보강 주석 생성/조회 |
| `/impact export-index [--summary \| --full]` | 코드 인덱스 내보내기 (AI 분석용) |
| `/impact save-result --file <path>` | AI 분석 결과 저장 |
| `/impact cross-analyze [--source <id>] [--group <name>]` | 크로스 프로젝트 영향도 분석 |
| `/impact projects [--switch \| --link \| --unlink \| --detect-links]` | 멀티 프로젝트 관리 |
| `/impact owners [--add \| --edit \| --remove]` | 시스템 담당자 관리 |
| `/impact demo` | 데모 실행 |
| `/impact help [command]` | 도움말 |

### /impact init <path>

프로젝트 소스 코드를 분석하여 검색 가능한 인덱스를 구축합니다.

- TypeScript/JavaScript 파일의 AST를 파싱하여 화면, 컴포넌트, API, 모델을 식별
- import/export 관계를 추적하여 의존성 그래프 구축
- 코드 내 비즈니스 정책(가격, 할인, 배송 규칙 등)을 자동 추출
- `.gitignore` 패턴을 반영하여 불필요한 파일 제외

### /impact analyze --file <path>

기획서를 파싱하고 코드 인덱스와 매칭하여 영향도를 분석합니다 (규칙 기반). PDF 파일도 지원됩니다.

분석 결과에 포함되는 내용:
- **영향 화면**: 변경이 필요한 화면 목록과 영향 수준 (Low/Medium/High/Critical)
- **작업 항목**: FE/BE별 구체적 작업 목록, 영향 파일, 관련 API
- **기획 확인 사항**: 기획서에서 불명확하거나 추가 확인이 필요한 항목
- **정책 변경**: 기존 비즈니스 정책과 충돌 가능성이 있는 변경 사항
- **난이도 점수**: 4차원 점수 (개발 복잡도, 영향 범위, 정책 변경, 의존성 위험도)

### /impact view [--stop]

분석 결과를 React 기반 웹 대시보드로 시각화합니다. 기본 포트 3847에서 실행되며, `--stop` 옵션으로 종료할 수 있습니다.

### /impact tickets [--create] [--detail <id>]

분석 결과를 기반으로 마크다운 형식의 작업 티켓을 자동 생성합니다. 각 티켓에는 작업 설명, 영향 파일, 관련 API, 난이도 점수가 포함됩니다.

### /impact reindex [--full | --incremental]

코드 인덱스를 수동으로 갱신합니다.

- **기본 (증분)**: Git diff 기반으로 변경된 파일만 갱신
- `--full`: 전체 파일을 대상으로 완전 재인덱싱
- `--incremental`: 증분 인덱싱 명시적 지정
- 변경 비율이 30% 임계치를 초과하면 자동으로 전체 재인덱싱 수행

### /impact policies [--search <keyword>] [add <content>]

정책 사전을 조회하거나 새 정책을 등록합니다. `--search` 옵션으로 키워드 기반 검색이 가능합니다.

### /impact policy-check [--policy <name>] [--change <description>]

정책 영향도를 분석합니다.

- **옵션 없이**: 전체 정책 현황 요약 표시
- `--policy <name>`: 특정 정책 상세 조회 (부분 매칭 지원)
- `--change <description>`: 변경 내용이 기존 정책에 미치는 영향 분석

### /impact ask <질문>

코드베이스에 대한 자유 질의를 수행합니다. 질문에서 키워드를 추출하여 인덱스를 검색하고, 관련 파일, 컴포넌트, API, 화면, 정책, 모델을 찾아줍니다.

```
/impact ask "장바구니에서 쿠폰 적용하는 로직이 어디 있어?"
```

### /impact summary [--system <name>] [--recent]

프로젝트 요약 정보를 표시합니다.

- **옵션 없이**: 전체 프로젝트 통계 (파일 수, 화면 수, API 수, 정책 수 등)
- `--system <name>`: 특정 시스템(모듈)의 상세 요약
- `--recent`: Git log 기반 최근 변경 요약

### /impact annotations [generate | view] [path]

코드 보강 주석(어노테이션)을 관리합니다.

- `generate [path]`: 지정 경로의 코드를 분석하여 YAML 기반 보강 주석 생성
- `view [path]`: 기존 보강 주석 조회

어노테이션이 존재하는 파일은 AI 분석 시 Layer 3 신뢰도 보너스를 받습니다.

### /impact export-index [--project <id>] [--summary | --full] [--output <file>]

코드 인덱스를 요약 또는 전체 형태로 내보냅니다. AI 분석 프로토콜의 Step 1에서 사용됩니다.

- `--summary` (기본): 요약 형태로 출력
- `--full`: 전체 인덱스 출력
- `--output <file>`: 파일로 저장

### /impact save-result --file <path> [--project <id>]

AI 분석 결과 JSON 파일을 프로젝트 저장소에 등록합니다. AI 분석 프로토콜의 Step 4에서 사용됩니다.

### /impact cross-analyze [--source <project-id>] [--group <group-name>]

크로스 프로젝트 영향도 분석을 수행합니다. 소스 프로젝트의 API 변경이 연결된 프로젝트에 미치는 영향을 분석합니다.

- `--source <project-id>`: 소스 프로젝트 지정 (기본: 활성 프로젝트)
- `--group <group-name>`: 특정 그룹 대상으로 분석

### /impact projects [--switch | --link | --unlink | --detect-links]

멀티 프로젝트를 관리합니다.

- `--switch <name>`: 활성 프로젝트 전환
- `--link <id>`: 프로젝트 간 연결 설정
- `--unlink <id>`: 프로젝트 연결 해제
- `--detect-links`: 프로젝트 간 API 의존성 자동 탐지

### /impact owners [--add | --edit <system> | --remove <system>]

시스템별 담당자 및 팀 정보를 관리합니다.

---

## 주요 기능 상세

### 증분 인덱싱 (REQ-003)

Git diff 기반으로 변경된 파일만 감지하여 인덱스를 갱신합니다.

- 마지막 인덱싱 시점 이후의 Git 변경 사항을 자동으로 감지
- 변경된 파일만 AST 파싱하여 인덱스 업데이트
- 변경 비율이 전체 파일의 30%를 초과하면 자동으로 전체 재인덱싱 수행
- `--full` 옵션으로 강제 전체 재인덱싱 가능

```
/impact reindex              # 증분 인덱싱 (기본)
/impact reindex --full       # 전체 재인덱싱
/impact reindex --incremental # 증분 인덱싱 명시적 지정
```

### 어노테이션 시스템 (REQ-004)

코드에 YAML 기반 보강 주석을 생성하여 AI 분석의 신뢰도를 높입니다.

- 코드 파일을 분석하여 비즈니스 로직, 정책 연관성, 의존성 정보를 YAML 형태로 생성
- 정책 추론: 코드 패턴에서 관련 비즈니스 정책을 자동으로 식별
- Layer 3 신뢰도 보너스: 어노테이션이 존재하는 시스템은 AI 분석 시 신뢰도 점수에 보너스 부여
- `generate` 명령으로 생성, `view` 명령으로 조회

```
/impact annotations generate src/pages/Cart.tsx
/impact annotations view src/pages/Cart.tsx
```

### 정책 체크 (REQ-005)

정책 검색, 상세 조회, 변경 영향 분석을 수행합니다.

```
/impact policy-check                           # 전체 정책 현황 요약
/impact policy-check --policy "배송비"          # 특정 정책 상세 조회
/impact policy-check --change "무료배송 기준 변경" # 변경 영향 분석
```

### 코드 질의 (REQ-005)

자연어로 코드베이스에 대한 자유 질문을 할 수 있습니다.

```
/impact ask "결제 프로세스는 어떤 순서로 진행돼?"
/impact ask "회원 등급별 할인율을 관리하는 코드가 어디에 있어?"
```

### 크로스 프로젝트 임팩트 (REQ-007)

여러 프로젝트 간 API 의존성을 분석하여 변경 영향을 파악합니다.

- 프로젝트 간 API 호출 관계 자동 탐지
- API 계약(endpoint, request/response) 변경 시 영향받는 프로젝트 식별
- 웹 대시보드에서 프로젝트 의존성 다이어그램으로 시각화

```
/impact projects --detect-links                 # API 의존성 자동 탐지
/impact cross-analyze                           # 크로스 프로젝트 영향 분석
/impact cross-analyze --source my-api-project   # 특정 프로젝트 기준 분석
```

---

## 점수 체계

### 4차원 점수

각 작업 항목은 4가지 차원에서 1~10점으로 평가됩니다.

| 차원 | 가중치 | 설명 |
|------|--------|------|
| 개발 복잡도 | 35% | 신규 개발/수정 난이도, 코드 변경량 |
| 영향 범위 | 30% | 영향받는 화면/모듈 수 |
| 정책 변경 | 20% | 비즈니스 정책 변경 위험도 |
| 의존성 위험도 | 15% | 모듈 간 의존성 및 외부 시스템 영향 |

**총점 산출**: 각 차원 `(score * weight * 10)`의 합산

### 등급

| 등급 | 점수 범위 | 의미 |
|------|----------|------|
| Low | 0 ~ 15 | 소규모 변경, 위험 낮음 |
| Medium | 16 ~ 40 | 중규모 변경, 검토 필요 |
| High | 41 ~ 70 | 대규모 변경, 면밀 검토 필요 |
| Critical | 71+ | 대형 변경, 긴급 리뷰 필요 |

### 신뢰도 점수 (Confidence Score)

AI 분석 결과의 신뢰도를 4개 레이어로 평가합니다.

| 레이어 | 가중치 | 평가 내용 |
|--------|--------|----------|
| Layer 1: 구조 | 25% | 화면/컴포넌트 파일 식별 정확도 |
| Layer 2: 의존성 | 25% | API 의존성, import 관계 확인 여부 |
| Layer 3: 정책 | 20% | 관련 정책 매칭 여부 (어노테이션 보너스 포함) |
| Layer 4: 분석 | 30% | 작업 항목 구체성, 근거 충분성 |

**신뢰도 등급**: high(80+), medium(60-79), low(40-59), very_low(40 미만)

신뢰도가 60 미만인 시스템에 대해서는 lowConfidenceWarnings가 자동 생성되며, `/impact reindex --full` 실행 후 재분석을 권장합니다.

---

## 아키텍처

```
사용자 (PM)
  |
  v
CLI Commands (/impact ...) / 대화형 모드 (/kic)
  |
  v
Core Engine
  |- Spec Parser --------- 기획서 -> 구조화 JSON
  |- Code Indexer --------- AST 파싱, 의존성 그래프
  |- Incremental Indexer -- Git diff 기반 증분 갱신
  |- Impact Analyzer ------ 영향도 매칭 및 분석
  |- Scorer --------------- 4차원 난이도 점수
  |- Ticket Generator ----- 마크다운 티켓 생성
  |- Annotation Manager --- YAML 보강 주석 관리
  |- Cross-Project Manager  프로젝트 간 API 의존성 분석
  |
  v
AI Analysis Protocol (Claude Native Mode)
  |- export-index ---- 인덱스 로드
  |- save-result ----- 분석 결과 저장
  |
  v
Web Visualization
  |- Dashboard -------- KPI 카드, 차트
  |- FlowChart -------- 영향 관계 플로우차트
  |- Checklist -------- 확인 사항 체크리스트
  |- Owners ----------- 담당자 매핑
  |- Policies --------- 정책 카드, 조건 분기, 영향 그래프
  |- Cross-Project ---- 프로젝트 의존성 다이어그램
```

**기술 스택**:
- **백엔드**: TypeScript, Node.js, Express v5, SWC (AST 파싱)
- **프론트엔드**: React 19, @xyflow/react v12, Recharts, Zustand v5, Tailwind CSS v4, Vite 6
- **테스트**: Jest + ts-jest (백엔드), Vitest + Testing Library (프론트엔드)

---

## 프로젝트 구조

```
kurly-impact-checker/
  src/
    commands/            # CLI 명령어 핸들러 (18개)
      init.ts            # 프로젝트 초기화
      analyze.ts         # 기획서 분석 (규칙 기반)
      view.ts            # 대시보드 실행
      tickets.ts         # 티켓 생성
      config.ts          # 설정 확인
      reindex.ts         # 인덱스 갱신 (증분/전체)
      policies.ts        # 정책 사전 조회
      policy-check.ts    # 정책 영향도 분석
      ask.ts             # 코드베이스 질의
      summary.ts         # 프로젝트 요약
      annotations.ts     # 보강 주석 관리
      export-index.ts    # 인덱스 내보내기
      save-result.ts     # AI 분석 결과 저장
      cross-analyze.ts   # 크로스 프로젝트 분석
      projects.ts        # 멀티 프로젝트 관리
      owners.ts          # 담당자 관리
      demo.ts            # 데모
      help.ts            # 도움말
    core/                # 핵심 엔진 모듈
      analysis/          # 영향도 분석
      annotations/       # 어노테이션 시스템 (YAML 보강 주석)
      cross-project/     # 크로스 프로젝트 분석
      indexing/          # 코드 인덱싱 (AST 파싱, 증분 인덱싱)
      scoring/           # 난이도 점수 산출
      session/           # 세션 관리
      spec/              # 기획서 파싱
      tickets/           # 티켓 생성
    config/              # 설정 관리
    server/              # Express API 서버
    types/               # TypeScript 타입 정의
    utils/               # 유틸리티
  web/                   # React SPA (시각화 대시보드)
    src/
      pages/
        Dashboard.tsx    # 대시보드 메인
        FlowChart.tsx    # 플로우차트
        Checklist.tsx    # 체크리스트
        Owners.tsx       # 담당자 매핑
        Tickets.tsx      # 티켓 목록
        Policies.tsx     # 정책 뷰
      components/
        dashboard/       # KPI 카드, 차트 컴포넌트
        flowchart/       # 플로우차트 노드, 엣지
        checklist/       # 체크리스트 아이템
        owners/          # 담당자 카드
        tickets/         # 티켓 카드
        policies/        # 정책 카드, 필터, 상세, 조건분기, 그래프
        cross-project/   # 크로스 프로젝트 다이어그램, 요약
        layout/          # 공통 레이아웃 (LNB, Header, DetailPanel)
      stores/            # Zustand 상태 관리
  .claude-plugin/        # Claude Code 플러그인 설정
  skills/kic/            # 플러그인 스킬 정의
  hooks/                 # 플러그인 훅 (auto npm install)
  tests/                 # 테스트 코드
  SKILL.md               # Claude Code 스킬 정의
```

---

## 성능 참고

| 프로젝트 규모 | 인덱싱 소요 시간 | 분석 소요 시간 |
|--------------|----------------|--------------|
| 소규모 (~100 파일) | 수초 | 수초 |
| 중규모 (~1,000 파일) | 10~30초 | 수초 |
| 대규모 (~5,000 파일) | 1~3분 | 수초 |

- `.gitignore` 패턴 자동 반영, `node_modules`/`dist` 기본 제외
- 증분 인덱싱으로 변경 파일만 빠르게 갱신 (전체 대비 수초 내)
- 변경 비율 30% 초과 시 자동 전체 재인덱싱

---

## 트러블슈팅

### 인덱싱 관련

**문제**: `Project not initialized` 오류
**해결**: `/impact init <path>` 로 프로젝트를 먼저 초기화하세요.

**문제**: 인덱싱 시 특정 파일이 누락됨
**해결**: `.gitignore`에 해당 파일 패턴이 포함되어 있는지 확인하세요. `/impact reindex --full` 로 전체 재인덱싱을 시도할 수 있습니다.

**문제**: 증분 인덱싱이 변경 사항을 감지하지 못함
**해결**: Git 커밋이 되지 않은 변경 사항은 감지되지 않을 수 있습니다. `/impact reindex --full` 로 전체 재인덱싱을 실행하세요.

### 분석 관련

**문제**: 분석 결과가 기대와 다름
**해결**: 기획서의 키워드가 코드 내 명칭과 일치하는지 확인하세요.

**문제**: AI 분석 시 신뢰도가 낮게 나옴
**해결**: `/impact annotations generate` 로 대상 코드에 보강 주석을 생성한 후 재분석하세요. Layer 3 신뢰도 보너스를 받을 수 있습니다.

### 시각화 관련

**문제**: 대시보드가 열리지 않음
**해결**: `web/` 디렉토리에서 `npm install` 이 완료되었는지 확인하세요. 포트 충돌 시 기존 프로세스를 종료하고 다시 시도하세요.

**문제**: 대시보드 종료 방법
**해결**: `/impact view --stop` 명령어로 서버를 종료할 수 있습니다.

**문제**: 정책 뷰 또는 크로스 프로젝트 페이지가 비어 있음
**해결**: 해당 데이터가 포함된 분석 결과가 있어야 합니다. AI 분석 프로토콜로 분석을 수행하거나, `/impact cross-analyze` 를 먼저 실행하세요.

---

## 라이선스

MIT
