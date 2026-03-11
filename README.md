# Kurly Impact Checker

> 기획서 한 장이면 코드 영향도를 알 수 있습니다.

기획 문서를 전달하면 코드베이스를 분석하여 영향받는 화면, 작업 항목, 난이도 점수, 정책 경고를 자동 생성하는 Claude Code 스킬입니다.

**모든 기능은 대화형으로 사용할 수 있습니다.** 명령어를 외울 필요 없이 자연어로 말하면 됩니다.

---

## 설치

### Claude Code에서 설치

Claude Code 터미널에서 아래 명령어를 입력하세요:

```bash
claude install-skill https://github.com/brocoli012/impact_check_public
```

또는 Claude Code 대화창에서 직접 요청해도 됩니다:

> "https://github.com/brocoli012/impact_check_public 이 스킬 설치해줘"

### Google Antigravity에서 설치

[Antigravity](https://idx.google.com/antigravity)는 Google의 AI 코딩 IDE로, Claude Code의 SKILL.md 포맷과 호환됩니다.

Antigravity 대화창에서 GitHub 링크를 주고 설치를 요청하세요:

> "https://github.com/brocoli012/impact_check_public 이 스킬 설치해줘"

또는 터미널에서 직접 clone할 수도 있습니다:

```bash
# Antigravity 프로젝트의 스킬 폴더에 clone
git clone https://github.com/brocoli012/impact_check_public .agent/skills/impact-checker

# 의존성 설치 및 빌드
cd .agent/skills/impact-checker && npm install && npm run build
```

### 설치 확인

설치가 완료되면 대화창에서 다음과 같이 호출할 수 있습니다:

```
kic 불러줘
```

또는

```
/kic
```

> 💡 **참고**: 설치 후 최초 실행 시 의존성 설치(`npm install`)와 빌드(`npm run build`)가 자동으로 진행됩니다. 약 1~2분 소요될 수 있습니다.

### Mermaid MCP (다이어그램 시각화)

차트/다이어그램 시각화를 위해 claude-mermaid MCP 설치가 필요합니다:

```bash
npm install -g claude-mermaid
```

설치 후 `~/.claude/settings.json`에 MCP 설정을 추가하세요:

```json
{
  "mcpServers": {
    "claude-mermaid": {
      "command": "claude-mermaid",
      "args": []
    }
  }
}
```

> 💡 Mermaid MCP가 설치되면 영향도 다이어그램, 의존성 그래프, 변경 범위 시각화 등을 브라우저에서 실시간 렌더링하고 SVG/PNG로 내보낼 수 있습니다.

---

## 사용 방법

### Step 1. KIC 호출

Claude Code에서 아래와 같이 말하면 KIC가 시작됩니다.

```
사용자: kic 불러줘
```

"킥", "임팩트 체커", "영향도 분석", `/kic` 등 다양한 표현으로 호출할 수 있습니다.

> 💡 **명령어 대체**: `/kic` 또는 `/impact help`

### Step 2. 프로젝트 등록

처음 사용할 때는 분석 대상 프로젝트를 등록해야 합니다.

```
KIC: 등록된 프로젝트가 없습니다. 분석할 프로젝트 경로를 알려주세요.
사용자: 이 프로젝트 등록해줘 (현재 경로)
```

등록하면 코드베이스를 자동으로 스캔합니다.
- TypeScript/JavaScript 파일 파싱
- 의존성 그래프 구축
- 비즈니스 정책 자동 추출

> 💡 **명령어 대체**: `/impact init /path/to/project`

### Step 3. 기획서 분석

기획서를 전달하면 AI가 영향도를 분석합니다.

```
사용자: 이 기획서 분석해줘
       (기획서 파일 첨부 또는 내용 붙여넣기)
```

KIC가 자동으로 4단계 분석을 수행합니다:
1. 코드 인덱스 로드
2. 기획서 구조화 (요구사항, 비즈니스 규칙, 화면 변경 추출)
3. AI 영향도 분석 (영향 화면, 작업 항목, 정책 충돌, 난이도 점수)
4. 결과 저장

분석이 완료되면 결과 요약을 보여줍니다:
```
KIC: 분석 완료!
     등급: High (52점) | 영향 화면 4개 | 작업 항목 12개
     대시보드를 열어볼까요?
```

> 💡 **명령어 대체**: `/impact analyze --file 기획서.md` (규칙 기반 분석)

### Step 4. 대시보드에서 결과 확인

```
사용자: 대시보드 열어줘
```

브라우저에서 시각화 대시보드가 열립니다 (http://localhost:3847).

**대시보드 주요 화면:**

| 화면 | 내용 |
|------|------|
| 대시보드 | 난이도 점수, 등급, 작업 분포 차트 |
| 플로우차트 | 화면 → 컴포넌트 → API 영향 관계도 |
| 체크리스트 | 기획 확인 사항, 정책 경고 |
| 티켓 | 작업 항목별 상세 (담당자, 영향 파일) |
| 정책 뷰 | 정책 카드, 조건 분기 시각화 |
| 담당자 | 시스템별 담당자 매핑 |

```
사용자: 대시보드 꺼줘
```

> 💡 **명령어 대체**: `/impact view` (열기), `/impact view --stop` (종료)
>
> ⚠️ **최초 1회**: 대시보드 빌드가 필요할 수 있습니다.
> `cd [스킬경로]/web && npm install && npm run build`

### Step 5. 추가 활용

분석 결과를 기반으로 다양한 후속 작업을 할 수 있습니다.

**작업 티켓 확인**
```
사용자: 작업 티켓 보여줘
```
> 💡 명령어: `/impact tickets`

**코드베이스 질문**
```
사용자: 장바구니에서 쿠폰 적용하는 로직이 어디 있어?
```
> 💡 명령어: `/impact ask "쿠폰 적용 로직"`

**정책 확인**
```
사용자: 배송비 정책 확인해줘
```
> 💡 명령어: `/impact policy-check --policy 배송비`

**프로젝트 요약**
```
사용자: 프로젝트 요약 보여줘
```
> 💡 명령어: `/impact summary`

**코드 보강 주석 (어노테이션)**
```
사용자: 보강 주석 생성해줘
```
분석 신뢰도를 높이는 YAML 기반 코드 주석을 생성합니다.
> 💡 명령어: `/impact annotations generate`

**어노테이션 md 파일로 내보내기**
```
사용자: 어노테이션 md로 저장해줘
```
> 💡 명령어: `/impact annotations view --output ./docs`

**크로스 프로젝트 영향 분석**
```
사용자: 다른 프로젝트에 미치는 영향 분석해줘
```
프로젝트 간 API 의존성을 분석하고 대시보드에서 시각화합니다.
> 💡 명령어: `/impact cross-analyze`

---

## 작동 원리

### 프로젝트 등록 (init)

"이 프로젝트 등록해줘" 또는 `/impact init .`을 실행하면:

```
프로젝트 소스 코드
       │
       ▼
┌─────────────────────┐
│  1. 파일 스캔        │  TypeScript/JavaScript 파일 탐색
│     (.gitignore 반영) │  node_modules, dist 자동 제외
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. AST 파싱         │  각 파일의 구조를 분석
│                     │  → 화면, 컴포넌트, API, 모델 식별
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. 의존성 그래프     │  import/export 관계 추적
│                     │  → 파일 간 연결 관계 구축
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. 정책 추출        │  코드 내 비즈니스 규칙 자동 감지
│                     │  (가격, 할인, 배송 조건 등)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  📦 코드 인덱스 생성  │  ~/.impact/projects/{id}/
│                     │  → 화면, API, 컴포넌트, 정책, 의존성
└─────────────────────┘
```

인덱스에 저장되는 항목:

| 항목 | 설명 | 예시 |
|------|------|------|
| 화면 (Screens) | 라우트에 연결된 페이지 컴포넌트 | `CartPage`, `CheckoutPage` |
| 컴포넌트 (Components) | React 컴포넌트 | `CouponInput`, `PriceDisplay` |
| API (APIs) | REST/GraphQL 엔드포인트 | `POST /api/cart/apply-coupon` |
| 모델 (Models) | 데이터 타입/인터페이스 | `CartItem`, `CouponPolicy` |
| 정책 (Policies) | 비즈니스 규칙 | `할인율 최대 30%`, `무료배송 3만원 이상` |
| 의존성 (Dependencies) | 파일 간 import 관계 | `CartPage → useCart → cartAPI` |

### 기획서 분석 프로세스

"이 기획서 분석해줘"를 실행하면 4단계 AI 분석이 자동 수행됩니다.

```
기획서 (파일 또는 텍스트)
       │
       ▼
┌──────────────────────────────────┐
│  Step 1. 코드 인덱스 로드         │
│  등록된 프로젝트의 인덱스 요약을    │
│  메모리에 로드                    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Step 2. 기획서 구조화             │
│  기획서에서 추출:                  │
│    • 기능 요구사항 (features)      │
│    • 비즈니스 규칙 (businessRules) │
│    • 변경 화면 (targetScreens)    │
│    • 키워드 (keywords)            │
│    • 불명확 사항 (ambiguities)     │
└──────────────┬───────────────────┘
               │
               ▼  프로젝트 2개 이상?
              ╱ ╲
           Yes   No
            │     │
            ▼     │
┌────────────────────────┐  │
│  Step 2.5              │  │
│  연관 프로젝트 자동 식별  │  │
│  (키워드 ↔ 인덱스 매칭)  │  │
│                        │  │
│  ✅ 매칭 50%↑ 자동 포함  │  │
│  ❓ 매칭 20~49% 확인    │  │
│  ✖ 매칭 20%↓ 제외      │  │
└───────────┬────────────┘  │
            │               │
            ▼               ▼
┌──────────────────────────────────┐
│  Step 3. AI 영향도 분석           │
│  인덱스 × 기획서 대조 분석:        │
│    • 영향 화면/컴포넌트/API 식별   │
│    • FE/BE 작업 항목 도출         │
│    • 요구사항 → 작업(Task) 매핑    │
│    • 정책 충돌 감지               │
│    • 4차원 난이도 점수 산출        │
│    • 분석 요약 생성               │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Step 4. 결과 저장               │
│  JSON → ~/.impact/projects/results/ │
│  → 대시보드에서 시각화 가능         │
└──────────────────────────────────┘
```

### 멀티프로젝트 자동 식별

프로젝트가 2개 이상 등록된 경우, 기획서가 어떤 프로젝트와 관련있는지 자동으로 파악합니다.

**매칭 방식:**

```
기획서 키워드 셋 (K)                  프로젝트 인덱스 (P)
┌─────────────────────┐        ┌─────────────────────┐
│ targetScreens       │        │ screens[].name      │
│ features.keywords   │ ──비교──│ apis[].path         │
│ keywords            │        │ components[].name   │
└─────────────────────┘        └─────────────────────┘
                                         │
                               매칭도 = |K ∩ P| / |K| × 100
```

**예시:**

```
사용자: 이 기획서 분석해줘 (장바구니 쿠폰 기획서)

KIC: 연관 프로젝트 식별 결과:
  ✅ kurly-app (매칭 85%) - 장바구니, 쿠폰 화면 포함
  ✅ kurly-api (매칭 72%) - 쿠폰 API 엔드포인트 포함
  ❓ kurly-admin (매칭 35%) - 포함하시겠습니까?
  ✖ kurly-docs (매칭 8%) - 제외

사용자: admin도 포함해줘

KIC: 3개 프로젝트 분석 완료!
  kurly-app:   High (52점) | 영향 화면 4개
  kurly-api:   Medium (38점) | 영향 화면 2개
  kurly-admin: Low (12점) | 영향 화면 1개
```

---

## 대화형 메뉴

KIC를 호출하면 프로젝트 상태에 따라 메뉴가 표시됩니다.

**분석 결과가 있을 때:**
```
KIC | my-project

등록된 프로젝트: /Users/me/my-project
마지막 분석: 2026-02-18 | High (52점) | 영향 화면 4개

무엇을 하시겠습니까?

  [1] 새 기획서 분석
  [2] 이전 결과 대시보드 열기
  [3] 이전 결과 요약 다시 보기
  [4] 프로젝트 요약 보기
  [5] 정책 확인
  [6] 코드베이스 질문하기
  [7] 프로젝트 설정
```

번호를 선택하거나 자연어로 원하는 기능을 말하면 됩니다.

---

## 점수 체계

### 난이도 점수

4가지 차원을 종합하여 총점을 산출합니다.

| 차원 | 가중치 | 설명 |
|------|:------:|------|
| 개발 복잡도 | 35% | 코드 변경 난이도 |
| 영향 범위 | 30% | 영향받는 화면/모듈 수 |
| 정책 변경 | 20% | 비즈니스 정책 변경 위험도 |
| 의존성 위험도 | 15% | 모듈 간 의존성 영향 |

### 등급

| 등급 | 점수 | 의미 |
|------|:----:|------|
| Low | 0~15 | 소규모 변경 |
| Medium | 16~40 | 중규모, 검토 필요 |
| High | 41~70 | 대규모, 면밀 검토 |
| Critical | 71+ | 대형 변경, 긴급 리뷰 |

---

## 명령어 레퍼런스

대화형으로 안 될 경우 아래 명령어를 직접 사용할 수 있습니다.

| 명령어 | 설명 |
|--------|------|
| `/kic` | 대화형 모드 진입 |
| `/impact init <path>` | 프로젝트 등록 |
| `/impact analyze --file <path>` | 기획서 분석 (규칙 기반) |
| `/impact view [--stop]` | 대시보드 열기/종료 |
| `/impact tickets [--detail <id>]` | 작업 티켓 조회 |
| `/impact reindex [--full]` | 인덱스 갱신 |
| `/impact policies [--search <keyword>]` | 정책 검색 |
| `/impact policy-check [--policy <name>]` | 정책 영향 분석 |
| `/impact ask <질문>` | 코드베이스 질의 |
| `/impact summary [--recent]` | 프로젝트 요약 |
| `/impact annotations generate [path]` | 보강 주석 생성 |
| `/impact annotations view [path] [--format md] [--output <dir>]` | 보강 주석 조회/저장 |
| `/impact export-index [--full]` | 인덱스 내보내기 |
| `/impact save-result --file <path>` | AI 분석 결과 저장 |
| `/impact cross-analyze` | 크로스 프로젝트 분석 |
| `/impact projects [--switch \| --link]` | 프로젝트 관리 |
| `/impact owners` | 담당자 관리 |
| `/impact help [command]` | 도움말 |

---

## 트러블슈팅

**"Project not initialized" 오류**
→ 프로젝트를 먼저 등록하세요: "이 프로젝트 등록해줘" 또는 `/impact init .`

**대시보드가 안 열림**
→ 웹 빌드가 필요합니다: `cd [스킬경로]/web && npm install && npm run build`
→ 포트 충돌 시: `/impact view --stop` 후 다시 시도

**분석 신뢰도가 낮음**
→ 보강 주석을 생성하면 신뢰도가 올라갑니다: "보강 주석 생성해줘"

**인덱싱이 변경 사항을 못 잡음**
→ 전체 재인덱싱: "전체 재인덱싱 해줘" 또는 `/impact reindex --full`

---

## 라이선스

MIT
