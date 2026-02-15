# Kurly Impact Checker

> 기획서 한 장으로 코드 영향도를 파악하세요.

기획 문서를 입력하면 코드베이스를 자동 분석하여 영향받는 화면, 작업 항목, 난이도 점수, 정책 경고, 담당자 알림을 생성하는 Claude Code 스킬입니다.

- 별도 API 키 없이 바로 사용 가능 (Zero Config)
- 명령어 또는 자연어 대화로 모든 기능 이용
- 플러그인으로 팀 전체에 간편 배포

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

기획서 파일을 지정하여 영향도를 분석합니다.

```
/impact analyze --file plan.txt
```

PDF 파일도 지원합니다:

```
/impact analyze --file plan.pdf
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
기획서 분석 (/impact analyze)
  |- 기획서 파싱 (키워드 추출, 요구사항 구조화)
  |- 코드 매칭 (화면, API, 모델 연결)
  |- 영향도 분석 (4차원 점수 산출)
  |
  v
결과 확인 (/impact view)
  |- 플로우차트 (영향 관계 시각화)
  |- KPI 카드 (점수, 등급, 영향 범위)
  |- 체크리스트 (기획 확인 사항, 정책 경고)
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

### 대화 예시

```
사용자: kic 불러줘
  KIC: 프로젝트 상태 확인 후 메뉴 제시
       [1] 기획서 분석 시작
       [2] 이전 결과 대시보드 열기
       [3] 프로젝트 설정

사용자: 이 기획서 분석해줘 (파일 첨부)
  KIC: 분석 완료 | 등급: High (6.2점) | 영향 화면 4개 | 작업 12개

사용자: 대시보드 열어줘
  KIC: http://localhost:3847 에서 대시보드 오픈

사용자: 티켓 만들어줘
  KIC: 12개 작업 티켓 생성 완료
```

기획서 분석, 결과 조회, 티켓 생성 등 모든 기능을 대화로 이용할 수 있습니다.

---

## 시각화 대시보드

`/impact view` 명령으로 브라우저에서 분석 결과를 시각적으로 확인할 수 있습니다.

### 플로우차트
영향받는 화면, 컴포넌트, API 간의 연결 관계를 React Flow 기반 플로우차트로 표시합니다. 노드를 클릭하면 상세 정보를 확인할 수 있습니다.

### KPI 카드
전체 난이도 점수, 등급, 영향받는 화면 수, 총 작업 수 등 핵심 지표를 한눈에 파악할 수 있습니다.

### 차트
작업 유형별 분포(FE/BE/공통), 점수 차원별 레이더 차트 등을 Recharts 기반으로 제공합니다.

### 체크리스트
기획서에서 추출된 확인 사항과 기존 정책과의 충돌 경고를 자동으로 생성합니다.

### 담당자 매핑
영향받는 시스템별 담당자를 자동으로 매핑하여 알림 대상을 식별합니다.

---

## 전체 명령어

| 명령어 | 설명 |
|--------|------|
| `/kic` | 대화형 모드 진입 |
| `/impact init <path>` | 프로젝트 초기화 및 코드 인덱싱 |
| `/impact analyze --file <path>` | 기획서 영향도 분석 |
| `/impact view` | 시각화 웹 대시보드 열기 |
| `/impact tickets` | 작업 티켓 생성 |
| `/impact config` | 프로젝트 설정 확인 |
| `/impact reindex` | 코드 인덱스 업데이트 |
| `/impact owners` | 시스템 담당자 관리 |
| `/impact projects` | 프로젝트 관리 |
| `/impact policies` | 정책 사전 조회 |
| `/impact annotations` | 코드 보강 주석 생성/조회 |
| `/impact demo` | 데모 실행 |
| `/impact help` | 도움말 |

### /impact init

프로젝트 소스 코드를 분석하여 검색 가능한 인덱스를 구축합니다.

- TypeScript/JavaScript 파일의 AST를 파싱하여 화면, 컴포넌트, API, 모델을 식별
- import/export 관계를 추적하여 의존성 그래프 구축
- 코드 내 비즈니스 정책(가격, 할인, 배송 규칙 등)을 자동 추출
- `.gitignore` 패턴을 반영하여 불필요한 파일 제외

### /impact analyze

기획서를 파싱하고 코드 인덱스와 매칭하여 영향도를 분석합니다.

분석 결과에 포함되는 내용:
- **영향 화면**: 변경이 필요한 화면 목록과 영향 수준 (Low/Medium/High/Critical)
- **작업 항목**: FE/BE별 구체적 작업 목록, 영향 파일, 관련 API
- **기획 확인 사항**: 기획서에서 불명확하거나 추가 확인이 필요한 항목
- **정책 변경**: 기존 비즈니스 정책과 충돌 가능성이 있는 변경 사항
- **난이도 점수**: 4차원 점수 (개발 복잡도, 영향 범위, 정책 변경, 의존성 위험도)

### /impact view

분석 결과를 React 기반 웹 대시보드로 시각화합니다. 기본 포트 3847에서 실행되며, `--stop` 옵션으로 종료할 수 있습니다.

### /impact tickets

분석 결과를 기반으로 마크다운 형식의 작업 티켓을 자동 생성합니다. 각 티켓에는 작업 설명, 영향 파일, 관련 API, 난이도 점수가 포함됩니다.

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

**총점 산출**: `(개발복잡도 x 0.35) + (영향범위 x 0.30) + (정책변경 x 0.20) + (의존성위험도 x 0.15)`

### 등급

| 등급 | 점수 범위 | 의미 |
|------|----------|------|
| Low | 0 ~ 3.0 | 소규모 변경, 위험 낮음 |
| Medium | 3.1 ~ 5.5 | 중규모 변경, 검토 필요 |
| High | 5.6 ~ 7.5 | 대규모 변경, 면밀 검토 필요 |
| Critical | 7.6 ~ 10.0 | 대형 변경, 긴급 리뷰 필요 |

---

## 아키텍처

```
사용자 (PM)
  |
  v
CLI Commands (/impact ...) / 대화형 모드 (/kic)
  |
  v
Core Engine (규칙 기반 분석)
  |- Spec Parser ---- 기획서 -> 구조화 JSON
  |- Code Indexer --- AST 파싱, 의존성 그래프
  |- Impact Analyzer - 영향도 매칭 및 분석
  |- Scorer --------- 4차원 난이도 점수
  |- Ticket Generator 마크다운 티켓 생성
  |
  v
Web Visualization
  |- React + React Flow + Recharts
  |- Zustand 상태 관리
  |- Tailwind CSS 스타일링
```

**기술 스택**:
- **백엔드**: TypeScript, Node.js, Express, SWC (AST 파싱)
- **프론트엔드**: React 19, React Flow, Recharts, Zustand, Tailwind CSS 4, Vite 6
- **테스트**: Jest (백엔드), Vitest + Testing Library (프론트엔드)

---

## 성능 참고

| 프로젝트 규모 | 인덱싱 소요 시간 | 분석 소요 시간 |
|--------------|----------------|--------------|
| 소규모 (~100 파일) | 수초 | 수초 |
| 중규모 (~1,000 파일) | 10~30초 | 수초 |
| 대규모 (~5,000 파일) | 1~3분 | 수초 |

- `.gitignore` 패턴 자동 반영, `node_modules`/`dist` 기본 제외
- 증분 인덱싱(`/impact reindex`)으로 변경 파일만 빠르게 갱신

---

## 트러블슈팅

### 인덱싱 관련

**문제**: `Project not initialized` 오류
**해결**: `/impact init <path>` 로 프로젝트를 먼저 초기화하세요.

**문제**: 인덱싱 시 특정 파일이 누락됨
**해결**: `.gitignore`에 해당 파일 패턴이 포함되어 있는지 확인하세요. `/impact reindex --full` 로 전체 재인덱싱을 시도할 수 있습니다.

### 분석 관련

**문제**: 분석 결과가 기대와 다름
**해결**: 기획서의 키워드가 코드 내 명칭과 일치하는지 확인하세요.

### 시각화 관련

**문제**: 대시보드가 열리지 않음
**해결**: `web/` 디렉토리에서 `npm install` 이 완료되었는지 확인하세요. 포트 충돌 시 기존 프로세스를 종료하고 다시 시도하세요.

**문제**: 대시보드 종료 방법
**해결**: `/impact view --stop` 명령어로 서버를 종료할 수 있습니다.

---

## 프로젝트 구조

```
kurly-impact-checker/
  src/
    commands/     # CLI 명령어 핸들러
    core/         # 핵심 엔진 모듈
      analysis/   # 영향도 분석
      indexing/   # 코드 인덱싱 (AST 파싱)
      scoring/    # 난이도 점수 산출
      session/    # 세션 관리
      spec/       # 기획서 파싱
      tickets/    # 티켓 생성
    config/       # 설정 관리
    server/       # Express API 서버
    types/        # TypeScript 타입 정의
    utils/        # 유틸리티
  web/            # React SPA (시각화 대시보드)
  .claude-plugin/ # Claude Code 플러그인 설정
  skills/kic/     # 플러그인 스킬 정의
  hooks/          # 플러그인 훅 (auto npm install)
  tests/          # 테스트 코드
  SKILL.md        # Claude Code 스킬 정의
```

---

## 라이선스

MIT
