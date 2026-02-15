# Kurly Impact Checker

> 기획서 -> 코드 영향도 분석 -> 시각화 -> 작업 티켓 생성

기획 문서를 입력하면 코드베이스를 분석하여 영향받는 화면, 작업 항목, 정책 경고, 담당자 알림을 자동으로 생성하는 Claude Code / Antigravity 스킬입니다.

---

## 주요 기능

- **코드 인덱싱**: TypeScript/JavaScript AST 파싱, 의존성 그래프 구축, 정책 자동 추출
- **기획서 파싱**: PDF/텍스트 기획서를 구조화된 요구사항(JSON)으로 변환
- **영향도 분석**: 기획 변경이 코드에 미치는 영향을 4차원 점수로 정량 평가
- **시각화 대시보드**: React Flow 기반 플로우차트, KPI 카드, Recharts 차트
- **체크리스트**: 기획 확인 사항, 정책 경고 자동 생성
- **담당자 알림**: 영향받는 시스템 담당자 자동 매핑
- **작업 티켓**: 마크다운 형식 티켓 자동 생성

---

## 빠른 시작 (5분)

### 1. 설치

Claude Code 또는 Antigravity에서 스킬로 등록합니다.

```bash
# Claude Code
claude skill add /path/to/kurly-impact-checker

# 또는 Antigravity에서 직접 스킬 디렉토리 지정
```

스킬 디렉토리에서 의존성을 설치합니다:

```bash
cd /path/to/kurly-impact-checker
npm install
npm run build

cd web
npm install
```

### 2. API 키 설정

LLM을 활용한 고급 분석을 사용하려면 API 키를 설정합니다.

```
/impact config --provider anthropic --key sk-ant-xxxxx
```

지원 프로바이더: `anthropic`, `openai`, `google`

> API 키 없이도 규칙 기반 분석(Fallback 모드)으로 기본 기능을 사용할 수 있습니다.

### 3. 프로젝트 초기화

분석할 프로젝트를 등록하고 코드 인덱싱을 수행합니다.

```
/impact init /path/to/your/project
```

초기화 시 다음 작업이 수행됩니다:
- TypeScript/JavaScript 파일 AST 파싱
- 의존성 그래프(import/export) 구축
- 비즈니스 정책 자동 추출
- `.gitignore` 패턴 자동 반영

### 4. 기획서 분석

기획서 파일을 지정하여 영향도를 분석합니다.

```
/impact analyze --file plan.txt
```

PDF 파일도 지원합니다:

```
/impact analyze --file plan.pdf
```

### 5. 결과 확인

시각화 대시보드를 브라우저에서 엽니다.

```
/impact view
```

대시보드 종료:

```
/impact view --stop
```

---

## 전체 명령어

| 명령어 | 설명 |
|--------|------|
| `/impact init <path>` | 프로젝트 초기화 및 코드 인덱싱 |
| `/impact analyze --file <path>` | 기획서 영향도 분석 |
| `/impact view` | 시각화 웹 대시보드 열기 |
| `/impact tickets` | 작업 티켓 생성 |
| `/impact config` | API 키 및 설정 관리 |
| `/impact reindex` | 코드 인덱스 업데이트 |
| `/impact owners` | 시스템 담당자 관리 |
| `/impact projects` | 프로젝트 관리 |
| `/impact policies` | 정책 사전 조회 |
| `/impact annotations` | 코드 보강 주석 생성/조회 |
| `/impact demo` | 데모 실행 |
| `/impact help` | 도움말 |

---

## 아키텍처

```
사용자 (PM)
  |
  v
CLI Commands (/impact ...)
  |
  v
Core Engine
  |- Spec Parser ---- 기획서 -> 구조화 JSON
  |- Code Indexer --- AST 파싱, 의존성 그래프
  |- Impact Analyzer - 영향도 매칭 및 분석
  |- Scorer --------- 4차원 난이도 점수
  |- Ticket Generator 마크다운 티켓 생성
  |
  v
LLM Layer (선택)
  |- Anthropic / OpenAI / Google
  |- Fallback: 규칙 기반 분석
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

## LLM 설정

### 지원 프로바이더

| 프로바이더 | 설정값 | 비고 |
|-----------|--------|------|
| Anthropic | `anthropic` | Claude 모델 사용 (권장) |
| OpenAI | `openai` | GPT 모델 사용 |
| Google | `google` | Gemini 모델 사용 |

### 설정 방법

```
# 프로바이더와 키 동시 설정
/impact config --provider anthropic --key sk-ant-xxxxx

# 현재 설정 확인
/impact config
```

### Fallback 모드

API 키 없이도 규칙 기반 분석이 동작합니다.

- 기획서 파싱: 키워드 매칭 기반 요구사항 추출
- 영향도 분석: 인덱스 기반 파일 매칭
- 난이도 점수: 휴리스틱 기반 자동 산출

LLM을 사용하면 자연어 이해력이 높아져 더 정확한 분석 결과를 얻을 수 있습니다.

---

## 성능 참고

### 인덱싱 성능

| 프로젝트 규모 | 예상 소요 시간 |
|--------------|--------------|
| 소규모 (~100 파일) | 수초 |
| 중규모 (~1,000 파일) | 10~30초 |
| 대규모 (~5,000 파일) | 1~3분 |

- `.gitignore` 패턴이 자동 반영되어 불필요한 파일은 제외됩니다.
- `node_modules`, `dist` 등 빌드 산출물은 기본 제외됩니다.
- 증분 인덱싱(`/impact reindex`)으로 변경된 파일만 빠르게 갱신할 수 있습니다.

### 분석 성능

- LLM 모드: 기획서 크기와 인덱스 규모에 따라 10초~2분 소요
- Fallback 모드: 규칙 기반으로 수초 내 완료

### 시각화 성능

- React Flow의 LOD(Level of Detail) 렌더링으로 대규모 그래프도 부드럽게 표시됩니다.
- 데이터가 많은 경우 가상화를 통해 초기 로딩 시간을 최소화합니다.

---

## 트러블슈팅

### API 키 관련

**문제**: `LLM provider not configured` 오류
**해결**: `/impact config --provider anthropic --key <your-key>` 로 API 키를 설정하세요. 또는 Fallback 모드로 사용할 수 있습니다.

### 인덱싱 관련

**문제**: `Project not initialized` 오류
**해결**: `/impact init <path>` 로 프로젝트를 먼저 초기화하세요.

**문제**: 인덱싱 시 특정 파일이 누락됨
**해결**: `.gitignore`에 해당 파일 패턴이 포함되어 있는지 확인하세요. `/impact reindex --full` 로 전체 재인덱싱을 시도할 수 있습니다.

### 분석 관련

**문제**: 분석 결과가 기대와 다름
**해결**: 기획서의 키워드가 코드 내 명칭과 일치하는지 확인하세요. LLM 모드를 사용하면 자연어 매칭이 개선됩니다.

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
    llm/          # LLM 프로바이더 (Anthropic, OpenAI, Google)
    config/       # 설정 관리
    server/       # Express API 서버
    types/        # TypeScript 타입 정의
    utils/        # 유틸리티
  web/            # React SPA (시각화 대시보드)
  prompts/        # LLM 프롬프트 템플릿
  tests/          # 테스트 코드
  SKILL.md        # Claude Code 스킬 정의
```

---

## 라이선스

MIT
