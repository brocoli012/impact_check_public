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

### /impact demo
샘플 데이터 기반으로 도구를 체험합니다.
실행: node {skill_dir}/../../dist/index.js demo

### /impact help [command] / /impact faq
도움말을 표시하거나 자주 묻는 질문(FAQ)을 조회합니다.
실행: node {skill_dir}/../../dist/index.js help [command]

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
     [2] 소스 경로 변경
     [3] 프로젝트 설정 보기
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
     [4] 프로젝트 설정
   ```

3. **후속 대화**: 사용자가 번호 또는 자연어로 응답하면 해당 동작 수행

### 자연어 → CLI 매핑

사용자의 자연어 입력을 아래 테이블에 따라 CLI 명령어로 매핑하여 실행합니다:

| 사용자 의도 | 실행 명령어 | 트리거 예시 |
|------------|-----------|-----------|
| 프로젝트 등록 | `node {skill_dir}/../../dist/index.js init <path>` | "이 경로가 분석 대상이야", "프로젝트 등록" |
| 기획서 분석 | `node {skill_dir}/../../dist/index.js analyze --file <path>` | "분석해줘", "기획서 분석", "영향도 체크" |
| 결과 보기 | `node {skill_dir}/../../dist/index.js view` | "결과 보여줘", "대시보드 열어줘" |
| 티켓 생성 | `node {skill_dir}/../../dist/index.js tickets` | "티켓 만들어줘", "작업 분배" |
| 데모 | `node {skill_dir}/../../dist/index.js demo` | "데모 보여줘", "샘플" |
| 설정 | `node {skill_dir}/../../dist/index.js config` | "설정", "프로젝트 설정" |
| 인덱스 갱신 | `node {skill_dir}/../../dist/index.js reindex` | "인덱스 갱신", "재스캔" |
| 정책 검색 | `node {skill_dir}/../../dist/index.js policies --search <term>` | "정책 검색" |
| 담당자 | `node {skill_dir}/../../dist/index.js owners` | "담당자 확인" |
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
