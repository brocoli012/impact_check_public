# REQ-015: 크로스 프로젝트 자동 영향도 분석

## 1. 개요

### 1.1 목적

기획서 분석 시 등록된 모든 프로젝트를 자동으로 검토하여 크로스 프로젝트 영향도를 파악하고, 신규 프로젝트 추가 시 기존 분석의 누락을 보완하며, 영향도 파악 누락을 빠르게 탐지하고 해결하는 자동화 체계를 구축한다.

### 1.2 배경

현재 KIC(Kurly Impact Checker)에는 4개 프로젝트가 등록되어 있고(sample-project, e-scm-api, e-scm-front, lip), SKILL.md Step 2.5에 멀티프로젝트 자동 감지 프로토콜이 정의되어 있다. 또한 `CrossProjectManager.detectLinks()` 메서드가 API 경로/공유 테이블/공유 이벤트 기반 3가지 감지를 구현하고 있다.

그러나 분석 결과가 `cross-project.json`에 자동 저장되지 않고, 감지 결과가 CLI `--detect-links` 수동 실행으로만 접근 가능하며, 웹 대시보드 플로우차트 "전체" 모드는 `cross-project.json` 데이터에 의존하여 빈 화면을 표시하는 상태이다. 이로 인해 사용자는 크로스 프로젝트 영향도를 파악할 수 없고, 신규 프로젝트 추가 시 기존 분석 결과에 대한 보완 경로도 없다.

### 1.3 요청자

사용자 REQ-015 요청

### 1.4 선행 요구사항

- REQ-014 (UI/UX 프로젝트 중심 구조 개편) - 플로우차트 "전체" 모드 UI, 프로젝트 선택 방식 변경이 선행되어야 본 요구사항의 시각화 연동이 완성됨

---

## 2. 핵심 문제 정의 (As-Is Gap 분석)

### Gap 1: 분석 후 크로스 프로젝트 의존성 미저장

| 항목 | 상세 |
|------|------|
| **현상** | `detectLinks()`가 `ProjectLink[]`를 반환하지만 `cross-project.json`에 저장하지 않음 |
| **영향받는 코드** | `CrossProjectManager.detectLinks()` (line 243) - 반환만, `saveConfig()` 미호출 |
| **결과** | `/api/cross-project/links` API가 빈 배열 반환 -> 플로우차트 "전체" 모드 빈 화면 |
| **근본 원인** | `detectLinks()`가 의도적으로 저장하지 않는 설계 (주석: "저장하지 않음") + CLI `--detect-links`가 사용자에게 수동 등록을 안내하는 구조 |

### Gap 2: 기획서 분석 시 크로스 프로젝트 자동 검토 미수행

| 항목 | 상세 |
|------|------|
| **현상** | SKILL.md Step 2.5에 멀티프로젝트 프로토콜이 정의되어 있으나, 분석 완료 후 크로스 프로젝트 의존성을 자동 감지/저장하는 Step이 없음 |
| **영향받는 코드** | SKILL.md Step 4 (결과 저장 및 시각화) - `save-result` 후 크로스 프로젝트 갱신 미수행 |
| **결과** | 기획서 분석을 완료해도 프로젝트 간 영향 관계가 시각화에 반영되지 않음 |
| **근본 원인** | 분석 파이프라인에 크로스 프로젝트 후처리 단계가 설계되지 않음 |

### Gap 3: 신규 프로젝트 등록 시 기존 분석 보완 경로 부재

| 항목 | 상세 |
|------|------|
| **현상** | 프로젝트 A/B 분석 완료 후 프로젝트 C를 등록하면, A/B 분석 결과에 C와의 영향도가 반영되지 않음 |
| **영향받는 코드** | `InitCommand` - 프로젝트 등록만 수행, 기존 분석 재검토 미수행. `ProjectsCommand` - 프로젝트 목록 관리만 수행 |
| **결과** | 신규 프로젝트와 기존 프로젝트 간의 영향도 누락 |
| **근본 원인** | 프로젝트 등록(init)과 분석(analyze)이 완전히 분리된 파이프라인으로 동작 |

---

## 3. 요구사항 상세

### 3.1 REQ-015-1: 분석 시 전체 프로젝트 자동 검토 + 플로우차트 전체 모드 연동

#### 3.1.1 개요

기획서 분석(SKILL.md AI 분석 프로토콜) 완료 시, 등록된 모든 프로젝트의 인덱스를 대상으로 크로스 프로젝트 의존성을 자동 감지하고 `cross-project.json`에 저장한다. 이를 통해 플로우차트 "전체" 모드에서 프로젝트 간 영향 관계를 즉시 시각화할 수 있도록 한다.

#### 3.1.2 상세 요구사항

**FR-015-1-1: 분석 후 자동 크로스 프로젝트 감지**

`save-result` 명령어 실행 후(또는 AI 분석 프로토콜 Step 4 완료 후), 등록된 프로젝트가 2개 이상이면 `detectLinks()`를 자동 실행한다.

- 트리거 조건: `save-result` 성공 + 등록 프로젝트 >= 2
- 감지 범위: API 경로 매칭, 공유 테이블, 공유 이벤트 (기존 `detectLinks()` 3가지 감지 로직)
- 감지 결과 저장: `cross-project.json`에 `autoDetected: true`로 저장
- 기존 수동 등록 링크(`autoDetected: false`)는 보존 (덮어쓰지 않음)
- 중복 링크 방지: 동일 source-target 조합의 기존 링크가 있으면 건너뜀

**FR-015-1-2: SKILL.md 프로토콜 확장 - Step 4.5 추가**

AI 분석 프로토콜에 Step 4.5를 추가한다:

```
### Step 4.5: 크로스 프로젝트 의존성 자동 갱신

분석 결과 저장(Step 4) 완료 후, 등록된 프로젝트가 2개 이상인 경우 실행한다.

1. 크로스 프로젝트 의존성 자동 감지:
   ```bash
   node {skill_dir}/dist/index.js projects --detect-links --auto-save
   ```

2. 결과를 사용자에게 제시:
   ```
   크로스 프로젝트 의존성 갱신 완료:
     신규 감지: N건 (API: A건, 공유테이블: B건, 공유이벤트: C건)
     기존 유지: M건
     총 의존성: X건
   ```

3. 플로우차트 "전체" 모드에서 확인 가능 안내
```

**FR-015-1-3: `--detect-links --auto-save` CLI 옵션 추가**

`projects --detect-links` 명령어에 `--auto-save` 플래그를 추가한다.

- `--auto-save` 없이 실행: 기존 동작 유지 (감지 결과 표시만, 저장 안 함)
- `--auto-save` 와 함께 실행: 감지 결과를 `cross-project.json`에 자동 저장
- 저장 시 기존 수동 링크(`autoDetected: false`)는 보존
- 저장 시 기존 자동 링크(`autoDetected: true`)는 최신 감지 결과로 교체 (stale link 제거)

**FR-015-1-4: `save-result` 후처리 hook**

`save-result` 명령어 내부 또는 `ResultManager`에 후처리 hook을 추가하여, 결과 저장 성공 시 `detectLinks --auto-save`를 자동 트리거한다.

- 실패 시 분석 결과 저장 자체는 롤백하지 않음 (크로스 프로젝트 갱신 실패는 경고만 출력)
- `--skip-cross-detect` 옵션으로 후처리 비활성화 가능 (성능 최적화 필요 시)

**FR-015-1-5: 플로우차트 "전체" 모드 데이터 연동 확인**

- `cross-project.json`에 데이터가 저장되면, 기존 `/api/cross-project/links` API가 자동으로 해당 데이터를 반환
- 플로우차트 "전체" 모드(`projectMode === 'all'`)에서 `CrossProjectDiagram`과 `CrossProjectSummary`에 데이터가 정상 표시됨
- 추가 프론트엔드 변경 불필요 (기존 컴포넌트가 데이터만 있으면 정상 동작)

#### 3.1.3 영향받는 파일

| 파일 | 변경 유형 | 상세 |
|------|----------|------|
| `src/commands/projects.ts` | 수정 | `handleDetectLinks()`에 `--auto-save` 분기 추가 |
| `src/core/cross-project/cross-project-manager.ts` | 수정 | `detectAndSave()` 메서드 신규 추가 (detectLinks + saveConfig 결합) |
| `src/commands/save-result.ts` | 수정 | 저장 성공 후 크로스 프로젝트 갱신 hook 호출 |
| `SKILL.md` | 수정 | Step 4.5 추가 |

---

### 3.2 REQ-015-2: 신규 프로젝트 등록 시 기존 분석 보완

#### 3.2.1 개요

신규 프로젝트 등록(`/impact init`) 시, 기존에 분석 완료된 기획서/요구사항과 신규 프로젝트의 인덱스를 비교하여 추가 영향도를 파악하고, 사용자에게 보완 분석 여부를 제안한다.

#### 3.2.2 상세 요구사항

**FR-015-2-1: 프로젝트 등록 완료 시 기존 분석 스캔**

`init` 명령어가 신규 프로젝트 인덱싱을 완료한 후, 다음을 수행한다:

1. 기존 프로젝트들의 분석 결과(results) 목록을 조회
2. 각 분석 결과의 `parsedSpec.keywords`, `parsedSpec.targetScreens`, `parsedSpec.features[].keywords`를 수집
3. 신규 프로젝트 인덱스의 `screens[].name`, `apis[].path`, `components[].name`과 비교
4. SKILL.md Step 2.5와 동일한 매칭도 기준 적용 (50% 이상: 자동 포함, 20~49%: 확인, 20% 미만: 제외)

**FR-015-2-2: 보완 분석 제안 (사용자 확인)**

매칭도 20% 이상인 기존 분석 결과가 있으면, 사용자에게 보완 분석을 제안한다:

```
신규 프로젝트 '{name}' 등록 완료.

기존 분석 중 이 프로젝트에 영향을 줄 수 있는 항목이 발견되었습니다:
  [1] "상품 물리 스펙 수정" (e-scm-front, 2026-02-15) - 매칭도 72%
  [2] "결제 로직 개선" (e-scm-api, 2026-02-10) - 매칭도 35%

보완 분석을 진행하시겠습니까? [Y/n]
  - Y: 매칭도 50% 이상 항목에 대해 자동 보완 분석 실행
  - n: 건너뛰기 (나중에 /impact cross-analyze로 수동 실행 가능)
```

**FR-015-2-3: 보완 분석 실행**

사용자가 승인하면 매칭도 50% 이상 항목에 대해 다음을 수행한다:

1. 해당 기획서의 `parsedSpec`을 사용하여 신규 프로젝트 인덱스와 대조
2. 신규 프로젝트에 대한 영향도 분석 결과를 생성 (기존 분석 결과 JSON에 `crossProjectImpact` 필드 추가 또는 별도 보완 결과 저장)
3. 크로스 프로젝트 의존성 갱신 (`detectLinks --auto-save` 자동 실행)

**FR-015-2-4: 보완 분석 결과 저장**

보완 분석 결과는 기존 분석 결과를 수정하지 않고, 별도의 보완 분석 결과로 저장한다:

- 저장 경로: `~/.impact/projects/{newProjectId}/results/supplement-{originalAnalysisId}.json`
- `analysisMethod`: `"claude-native-supplement"`
- `supplementOf`: 원본 분석 ID 참조
- `triggerProject`: 보완 분석을 트리거한 신규 프로젝트 ID

**FR-015-2-5: CLI 명령어 추가 - `/impact cross-analyze --supplement`**

수동으로 보완 분석을 실행할 수 있는 CLI 옵션을 추가한다:

```bash
# 신규 프로젝트 기준으로 기존 분석 보완
node {skill_dir}/dist/index.js cross-analyze --supplement --project <new-project-id>
```

#### 3.2.3 영향받는 파일

| 파일 | 변경 유형 | 상세 |
|------|----------|------|
| `src/commands/init.ts` | 수정 | 인덱싱 완료 후 기존 분석 스캔 + 보완 제안 로직 추가 |
| `src/core/analysis/result-manager.ts` | 수정 | 보완 분석 결과 저장 지원 (`supplement-` 접두사) |
| `src/commands/cross-analyze.ts` | 수정 | `--supplement` 옵션 추가 |
| `src/types/analysis.ts` | 수정 | 보완 분석 관련 타입 추가 (`supplementOf`, `triggerProject`) |
| `SKILL.md` | 수정 | 보완 분석 프로토콜 추가 |

---

### 3.3 REQ-015-3: 영향도 누락 탐지 및 해결

#### 3.3.1 개요

영향도 분석 결과에서 누락 가능성이 높은 항목을 자동으로 탐지하고, 사용자에게 재분석 또는 수동 보완을 안내한다.

#### 3.3.2 상세 요구사항

**FR-015-3-1: 누락 탐지 엔진 (Gap Detector)**

새로운 `GapDetector` 클래스를 추가하여 다음 4가지 유형의 누락을 탐지한다:

| # | 누락 유형 | 탐지 기준 | 심각도 |
|:-:|----------|----------|:------:|
| 1 | 미분석 프로젝트 | 등록된 프로젝트 중 크로스 프로젝트 링크에 한 번도 등장하지 않는 프로젝트 | Medium |
| 2 | Stale 링크 | `cross-project.json`의 링크가 참조하는 프로젝트가 삭제/아카이브되었거나, 인덱스가 마지막 감지 이후 변경된 경우 | High |
| 3 | 저신뢰도 분석 | 분석 결과의 `confidenceScores`에서 `overallScore < 60`인 시스템이 있는 경우 | Medium |
| 4 | 인덱스 미갱신 | 프로젝트 소스 코드 변경(git log 기준) 후 인덱스가 갱신되지 않은 경우 | Low |

**FR-015-3-2: CLI 명령어 - `/impact gap-check`**

```bash
# 전체 갭 체크
node {skill_dir}/dist/index.js gap-check

# 특정 프로젝트 대상
node {skill_dir}/dist/index.js gap-check --project <id>

# 자동 해결 모드 (재분석 + 인덱스 갱신)
node {skill_dir}/dist/index.js gap-check --fix
```

출력 형식:
```
영향도 누락 탐지 결과:

  [HIGH] Stale 링크 2건
    - e-scm-api -> sample-project: sample-project 인덱스 변경됨 (2일 전)
    - lip -> e-scm-front: e-scm-front API 변경 감지

  [MEDIUM] 미분석 프로젝트 1건
    - sample-project: 크로스 프로젝트 분석 미수행

  [MEDIUM] 저신뢰도 분석 1건
    - "결제 로직 개선" (e-scm-api): 장바구니 화면 신뢰도 35%

  [LOW] 인덱스 미갱신 1건
    - lip: 마지막 인덱스 2026-02-15, 마지막 커밋 2026-02-20

해결 방법:
  [1] 전체 자동 해결: /impact gap-check --fix
  [2] 인덱스 갱신: /impact reindex --full
  [3] 크로스 프로젝트 재감지: /impact projects --detect-links --auto-save
  [4] 특정 분석 재실행: /impact analyze --file <path>
```

**FR-015-3-3: `--fix` 자동 해결 모드**

`gap-check --fix` 실행 시 다음 순서로 자동 해결을 시도한다:

1. 인덱스 미갱신 프로젝트에 대해 `reindex` 실행
2. 크로스 프로젝트 의존성 재감지 (`detectLinks --auto-save`)
3. Stale 링크 정리 (삭제된/아카이브된 프로젝트 참조 링크 제거)
4. 결과 보고

자동 해결이 불가능한 항목(저신뢰도 분석 등)은 수동 해결 안내만 제공한다.

**FR-015-3-4: 분석 완료 시 자동 갭 체크 (선택적)**

`save-result` 후처리 hook(FR-015-1-4)에서 크로스 프로젝트 갱신 후, 간이 갭 체크를 수행하여 새로운 누락이 발생했는지 확인한다.

- 전체 갭 체크가 아닌 경량 체크 (Stale 링크 + 미분석 프로젝트만)
- 누락 발견 시 경고 메시지와 `gap-check` 명령어 안내

**FR-015-3-5: 대시보드 알림 위젯**

웹 대시보드 프로젝트 보드(REQ-014에서 신규 추가된 `/` 페이지)에 "영향도 건강 상태" 위젯을 추가한다:

- `/api/gap-check` API 엔드포인트 신규 추가
- 위젯에 누락 건수 표시 (High: 빨강, Medium: 노랑, Low: 회색)
- 클릭 시 상세 목록 모달 표시
- 각 항목에 "해결" 버튼 (해당 CLI 명령어 안내)

**FR-015-3-6: SKILL.md 대화형 모드 연동**

자연어 -> CLI 매핑 테이블에 추가:

| 사용자 의도 | 실행 방식 | 트리거 예시 |
|------------|----------|-----------|
| 누락 탐지 | `node {skill_dir}/dist/index.js gap-check` | "누락 확인", "갭 체크", "빠진 거 없나", "gap check" |
| 누락 자동 해결 | `node {skill_dir}/dist/index.js gap-check --fix` | "누락 자동 해결", "갭 수정", "gap fix" |

#### 3.3.3 영향받는 파일

| 파일 | 변경 유형 | 상세 |
|------|----------|------|
| `src/core/cross-project/gap-detector.ts` | 신규 | GapDetector 클래스 |
| `src/commands/gap-check.ts` | 신규 | gap-check CLI 명령어 |
| `src/router.ts` | 수정 | gap-check 명령어 등록 |
| `src/server/web-server.ts` | 수정 | `/api/gap-check` 엔드포인트 추가 |
| `web/src/components/projects/GapHealthWidget.tsx` | 신규 | 대시보드 건강 상태 위젯 |
| `SKILL.md` | 수정 | 자연어 매핑 테이블 추가 |

---

## 4. 수용 기준 (Acceptance Criteria)

### 4.1 REQ-015-1 수용 기준

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-1-1 | 분석 결과 저장(`save-result`) 성공 후, 등록 프로젝트가 2개 이상이면 `cross-project.json`에 자동 감지 링크가 저장된다 | 단위 테스트: `save-result` 실행 후 `cross-project.json` 읽어서 `links.length > 0` 확인 |
| AC-015-1-2 | 기존 수동 등록 링크(`autoDetected: false`)는 자동 감지 실행 후에도 보존된다 | 단위 테스트: 수동 링크 1건 등록 -> `detectAndSave()` 실행 -> 수동 링크 존재 확인 |
| AC-015-1-3 | `--detect-links` 단독 실행 시 기존 동작 유지 (저장 안 함) | 단위 테스트: `--detect-links` (without `--auto-save`) 실행 후 `cross-project.json` 변경 없음 확인 |
| AC-015-1-4 | `--detect-links --auto-save` 실행 시 감지 결과가 `cross-project.json`에 저장된다 | 단위 테스트: 명령어 실행 후 파일 검증 |
| AC-015-1-5 | 플로우차트 "전체" 모드에서 `cross-project.json` 데이터가 `CrossProjectDiagram`에 표시된다 | 통합 테스트: 분석 -> save-result -> 웹서버 시작 -> `/api/cross-project/links` 응답에 데이터 존재 확인 |
| AC-015-1-6 | 크로스 프로젝트 갱신 실패 시 분석 결과 저장은 롤백되지 않는다 | 단위 테스트: `detectLinks` mock 에러 시 `save-result` 성공 확인 |
| AC-015-1-7 | `--skip-cross-detect` 옵션으로 후처리를 비활성화할 수 있다 | 단위 테스트: `save-result --skip-cross-detect` 실행 후 `cross-project.json` 변경 없음 확인 |

### 4.2 REQ-015-2 수용 기준

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-2-1 | 신규 프로젝트 `init` 완료 후, 기존 분석 결과와 매칭도 20% 이상인 항목이 있으면 보완 분석을 제안한다 | 단위 테스트: mock 기존 분석 + 신규 프로젝트 인덱스 -> 제안 메시지 출력 확인 |
| AC-015-2-2 | 보완 분석 결과가 `supplement-{originalAnalysisId}.json` 형식으로 저장된다 | 단위 테스트: 보완 분석 실행 후 파일 존재 + `supplementOf` 필드 확인 |
| AC-015-2-3 | 기존 분석 결과 파일은 보완 분석에 의해 수정되지 않는다 | 단위 테스트: 보완 분석 전후 원본 파일 해시 비교 |
| AC-015-2-4 | 기존 분석 결과가 없으면 보완 분석 제안을 건너뛴다 | 단위 테스트: 빈 결과 디렉토리에서 `init` 실행 -> 제안 없음 확인 |
| AC-015-2-5 | `/impact cross-analyze --supplement --project <id>` CLI가 정상 동작한다 | 단위 테스트: 명령어 실행 + 결과 저장 확인 |

### 4.3 REQ-015-3 수용 기준

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-3-1 | `gap-check` 실행 시 4가지 유형(미분석, Stale, 저신뢰도, 미갱신)의 누락을 탐지한다 | 단위 테스트: 각 유형별 mock 데이터 -> 탐지 결과 검증 |
| AC-015-3-2 | `gap-check --fix` 실행 시 해결 가능한 누락(인덱스 미갱신, Stale 링크)을 자동 해결한다 | 통합 테스트: mock 누락 상태 -> `--fix` 실행 -> 해결 확인 |
| AC-015-3-3 | `gap-check --project <id>` 실행 시 특정 프로젝트 관련 누락만 표시한다 | 단위 테스트: 다중 프로젝트 mock -> 필터링 결과 확인 |
| AC-015-3-4 | `/api/gap-check` API가 JSON 형식으로 누락 목록을 반환한다 | API 테스트: GET 요청 -> 응답 스키마 검증 |
| AC-015-3-5 | 프로젝트 보드에 "영향도 건강 상태" 위젯이 표시되고 누락 건수가 정확하다 | 프론트엔드 테스트: mock API -> 위젯 렌더링 + 건수 확인 |
| AC-015-3-6 | 자동 해결 불가능한 항목(저신뢰도)은 수동 해결 안내만 제공하고 자동 조치하지 않는다 | 단위 테스트: 저신뢰도 누락에 `--fix` -> 변경 없음 + 안내 메시지 확인 |

---

## 5. To-Be 사용자 시나리오

### 5.1 시나리오 1: 기획서 분석 시 크로스 프로젝트 자동 연동

**전제**: e-scm-api, e-scm-front, lip 3개 프로젝트 등록됨. 사용자가 "상품 물리 스펙 수정 주체 변경" 기획서를 분석.

```
사용자: "기획서 분석해줘" (기획서 제공)

[Step 1] 코드 인덱스 로드 (lip - 활성 프로젝트)
[Step 2] 기획서 읽기 및 구조화
[Step 2.5] 연관 프로젝트 식별:
  -> e-scm-front (매칭 72%) - 자동 포함
  -> e-scm-api (매칭 45%) - 사용자 확인
  -> sample-project (매칭 5%) - 제외

사용자: "e-scm-api도 포함"

[Step 3] 영향도 분석 (lip, e-scm-front, e-scm-api 순차)
[Step 4] 결과 저장

[Step 4.5] 크로스 프로젝트 의존성 자동 갱신
  -> 신규 감지: 3건 (API: 2건, 공유테이블: 1건)
  -> 기존 유지: 0건
  -> 총 의존성: 3건

  대시보드에서 플로우차트 "전체" 모드로 확인하세요.
```

### 5.2 시나리오 2: 신규 프로젝트 등록 시 기존 분석 보완

**전제**: e-scm-api와 e-scm-front에 대해 2건의 기획서 분석이 완료된 상태. 사용자가 신규 프로젝트 "e-scm-batch"를 등록.

```
사용자: /impact init /Users/dev/e-scm-batch

[인덱싱 수행]
  파일 스캔: 150개
  API: 12개
  화면: 0개
  모델: 8개

신규 프로젝트 'e-scm-batch' 등록 완료.

기존 분석 중 이 프로젝트에 영향을 줄 수 있는 항목이 발견되었습니다:
  [1] "상품 물리 스펙 수정 주체 변경" (e-scm-front) - 매칭도 55%
      -> 공유 테이블: product_spec, product_master
  [2] "결제 로직 개선" (e-scm-api) - 매칭도 28%
      -> 공유 API: /api/v1/orders

보완 분석을 진행하시겠습니까? [Y/n]

사용자: Y

[보완 분석 실행]
  "상품 물리 스펙 수정 주체 변경" -> e-scm-batch 영향도:
    영향 수준: Medium
    공유 테이블 2개 (product_spec, product_master)
    영향 받는 배치 작업 3개

  보완 결과 저장: supplement-analysis-1708012800000.json
  크로스 프로젝트 의존성 갱신: 신규 2건

대시보드에서 확인하세요.
```

### 5.3 시나리오 3: 영향도 누락 탐지 및 해결

**전제**: 4개 프로젝트 등록, 2건 분석 완료, 일부 프로젝트 인덱스가 오래된 상태.

```
사용자: "누락된 거 없나 확인해줘"

/impact gap-check 실행:

영향도 누락 탐지 결과:

  [HIGH] Stale 링크 1건
    - e-scm-api -> e-scm-front: e-scm-front 인덱스 5일 전 갱신,
      이후 커밋 3건 감지

  [MEDIUM] 미분석 프로젝트 1건
    - sample-project: 등록만 되고 크로스 프로젝트 분석 미수행

  [LOW] 인덱스 미갱신 2건
    - lip: 마지막 인덱스 2026-02-15, 마지막 커밋 2026-02-20
    - e-scm-front: 마지막 인덱스 2026-02-17, 마지막 커밋 2026-02-22

자동 해결하시겠습니까? [Y/n]

사용자: Y

/impact gap-check --fix 실행:
  [1/3] 인덱스 갱신 중... lip, e-scm-front
  [2/3] 크로스 프로젝트 재감지 중...
  [3/3] Stale 링크 정리 중...

해결 완료:
  해결됨: 4건 (인덱스 갱신 2건, 재감지 1건, Stale 정리 1건)
  수동 해결 필요: 0건
```

---

## 6. 충돌/영향 분석

### 6.1 기존 REQ와의 충돌

| 관련 REQ | 충돌 여부 | 상세 |
|----------|:---------:|------|
| REQ-014 | **호환** | 플로우차트 "전체" 모드 UI는 REQ-014에서 구현. REQ-015는 데이터 파이프라인만 담당하므로 충돌 없음. REQ-014의 프로젝트 보드(`/`)에 건강 상태 위젯 추가가 필요하므로 순서 의존성 있음 |

### 6.2 기존 기능과의 호환성

| 기존 기능 | 영향 | 호환성 보장 방법 |
|----------|------|-----------------|
| `detectLinks()` (저장 안 함) | `--auto-save` 없이 기존 동작 유지 | 기존 CLI `--detect-links` 동작 변경 없음, 새 옵션 추가만 |
| `save-result` 명령어 | 후처리 hook 추가 | `--skip-cross-detect`로 비활성화 가능, 실패 시 롤백 없음 |
| `init` 명령어 | 보완 분석 제안 추가 | 사용자 확인 필수 (자동 실행 아님), 기존 인덱싱 로직 변경 없음 |
| 단일 프로젝트 분석 흐름 | 영향 없음 | 등록 프로젝트 1개면 크로스 프로젝트 로직 전부 건너뜀 |
| `cross-project.json` (기존에 없음) | 신규 생성 | 파일 없으면 빈 설정 반환하는 기존 로직(`createDefaultConfig()`) 유지 |
| AI 분석 프로토콜 (Step 1~4) | Step 4.5 추가 | 기존 Step 1~4는 변경 없음, 순수 추가 |

### 6.3 성능 영향

| 작업 | 예상 추가 시간 | 허용 기준 | 최적화 방안 |
|------|:------------:|:---------:|------------|
| `save-result` 후 detectLinks | 1~3초 (4프로젝트 기준) | 5초 이내 | `--skip-cross-detect`로 비활성화 가능 |
| `init` 후 기존 분석 스캔 | 0.5~2초 | 3초 이내 | `parsedSpec` 키워드만 비교 (전체 인덱스 로드 불필요) |
| `gap-check` 전체 스캔 | 2~5초 | 10초 이내 | 경량 체크(파일 메타만)와 전체 체크 분리 |
| `gap-check --fix` | 10~60초 (reindex 포함) | 120초 이내 | 진행 상태 표시 |

---

## 7. Open Items (미결 사항)

### 7.1 보완 분석의 정밀도

- **질문**: 보완 분석(FR-015-2-3)에서 기존 `parsedSpec`만으로 신규 프로젝트 영향도를 분석할 때, 원본 기획서 텍스트 없이 키워드/요구사항만으로 충분한 정밀도를 달성할 수 있는가?
- **선택지**:
  1. `parsedSpec`만 사용 (빠르지만 정밀도 낮음)
  2. 원본 기획서 파일 경로를 분석 결과에 저장하여 재분석 시 활용 (정밀도 높지만 파일 이동/삭제 위험)
  3. `parsedSpec` + `analysisSummary` 조합 사용 (중간 정밀도)
- **권장**: 선택지 3. `parsedSpec`에서 키워드/요구사항 + `analysisSummary`의 `keyFindings`를 결합하여 분석
- **결정 필요**: 팀 리뷰 후 결정

### 7.2 cross-project.json 동시 접근

- **질문**: 여러 분석이 병렬 실행될 때 `cross-project.json`에 대한 동시 쓰기 충돌이 발생할 수 있는가?
- **현재 상태**: `writeJsonFile`이 동기 쓰기(`fs.writeFileSync`)를 사용하므로 OS 레벨에서 원자적이나, read-modify-write 패턴에서 경쟁 조건 가능
- **권장**: 파일 잠금(lock) 메커니즘 추가 또는 retry with backoff 전략
- **결정 필요**: 구현 단계에서 TPO와 협의

### 7.3 stale 자동 감지 링크의 생명주기

- **질문**: `autoDetected: true`인 링크가 다음 감지에서 더 이상 매칭되지 않으면 자동 삭제해야 하는가?
- **선택지**:
  1. 자동 삭제: 매번 감지 시 `autoDetected: true` 링크를 전부 삭제 후 재생성 (깔끔하지만 이력 손실)
  2. 유지 + stale 마킹: `staleAt` 타임스탬프 추가, gap-check에서 경고 (이력 보존)
  3. N회 연속 미매칭 시 삭제 (안정적이지만 복잡)
- **권장**: 선택지 1. 자동 감지 링크는 매번 최신 상태를 반영하는 것이 직관적. 수동 링크(`autoDetected: false`)는 항상 보존
- **결정 필요**: 팀 리뷰 후 결정

### 7.4 대시보드 건강 상태 위젯의 범위

- **질문**: 건강 상태 위젯(FR-015-3-5)이 REQ-014의 프로젝트 보드(`/`)에 포함되어야 하는데, REQ-014 구현이 선행되어야 하는가?
- **현재 상태**: REQ-014에서 프로젝트 보드 페이지를 신규 생성할 예정
- **권장**: REQ-014 구현 시 위젯 영역을 placeholder로 확보하고, REQ-015 구현 시 실제 위젯 삽입
- **결정**: REQ-014와 REQ-015를 순차 구현 (REQ-014 -> REQ-015)

### 7.5 보완 분석 결과의 대시보드 표시

- **질문**: `supplement-` 접두사 분석 결과를 대시보드 LNB의 기획서 목록에서 어떻게 표시할 것인가?
- **선택지**:
  1. 일반 분석 결과와 동일하게 표시 (별도 표시 없음)
  2. "(보완)" 라벨 추가하여 구분
  3. 원본 분석 결과 하위에 인덴트하여 계층 표시
- **권장**: 선택지 2. "(보완)" 라벨 추가로 간결하게 구분
- **결정 필요**: 디자인 리뷰 후 결정

### 7.6 프로젝트 0개/1개일 때의 gap-check 동작

- **현재 설계**: 프로젝트 1개면 크로스 프로젝트 로직 건너뜀
- **질문**: `gap-check`도 프로젝트 1개면 완전히 건너뛸 것인가, 아니면 단일 프로젝트 내부의 저신뢰도/인덱스 미갱신은 체크할 것인가?
- **권장**: 단일 프로젝트 내부 항목(저신뢰도, 인덱스 미갱신)은 체크. 크로스 프로젝트 항목(미분석, stale 링크)만 건너뜀
- **결정 필요**: 구현 시 확정

---

## 부록 A: 자체 검토 이력 (R1~R5)

### R1: 요구사항 완전성 검토

- [x] 기획서 없이 `cross-analyze` 수동 실행하는 시나리오 추가 확인 -> FR-015-2-5에서 `--supplement` 옵션으로 커버
- [x] 분석 도중 신규 프로젝트 등록되는 경쟁 조건 -> Open Item 7.2에서 동시 접근 이슈로 다룸
- [x] 여러 기획서에 대해 보완 분석 실행 시 bulk 처리 필요 -> FR-015-2-3에서 매칭도 50% 이상 항목에 대해 순차 처리로 커버
- [x] `cross-project.json` 초기화 시나리오 (프로젝트 삭제 후 재등록) -> Gap 3 + FR-015-3-2(Stale 링크 탐지)로 커버

### R2: AC 검증 가능성 검토

- [x] 모든 AC에 구체적 검증 방법(단위 테스트/통합 테스트/API 테스트) 명시
- [x] "자동" 이라는 표현에 구체적 트리거 조건 명시 (등록 프로젝트 >= 2, save-result 성공 등)
- [x] 성능 관련 AC 추가 검토 -> 충돌/영향 분석 6.3에서 허용 기준 정의
- [x] 실패 시나리오 AC 추가 (AC-015-1-6: 크로스 갱신 실패 시 롤백 안 됨)

### R3: 기존 기능과의 호환성 검토

- [x] `detectLinks()` 기존 동작(반환만) 보존 확인 -> `--auto-save` 옵션으로 분리
- [x] `save-result` 기존 동작 보존 -> `--skip-cross-detect`로 비활성화 가능
- [x] SKILL.md Step 1~4 변경 없음 확인 -> Step 4.5 순수 추가
- [x] REQ-014 프로젝트 보드와 위젯 호환 확인 -> 순차 구현 전략 수립

### R4: 엣지 케이스 검토

- [x] 프로젝트 0개: `save-result` 후처리에서 조건문으로 건너뜀 (FR-015-1-1 트리거 조건)
- [x] 프로젝트 1개: 크로스 프로젝트 로직 전부 건너뜀 (기존 `detectLinks()` 조건: `projectIds.length < 2`)
- [x] 인덱스 없는 프로젝트: `detectLinks()`가 이미 `index === null` 처리 (line 252-256). gap-check에서 "인덱스 미갱신"으로 탐지
- [x] API 없는 프로젝트: API 매칭 건너뜀, 공유 테이블/이벤트는 별도 체크 (기존 로직 유지)
- [x] 삭제/아카이브 프로젝트: Stale 링크 탐지(FR-015-3-1)로 커버
- [x] `cross-project.json` 손상: `loadConfig()`가 `null` 반환 시 기본 설정 사용 (기존 방어 로직)
- [x] 분석 결과에 `parsedSpec` 없음 (규칙 기반 분석): 보완 분석 스캔에서 해당 결과 건너뜀 (매칭도 계산 불가)

### R5: 사용자 관점 최종 검토

- [x] 사용자가 수동으로 `detect-links`를 실행할 필요가 없는가? -> `save-result` 후 자동 실행으로 해결
- [x] gap-check 결과가 액션 가능한가? -> 각 항목에 구체적 해결 명령어 안내 + `--fix` 자동 해결
- [x] 신규 프로젝트 등록 시 보완 분석이 강제가 아닌 제안인가? -> 사용자 확인 필수 (`[Y/n]`)
- [x] 플로우차트 "전체" 모드가 사전 설정 없이 동작하는가? -> 분석만 하면 `cross-project.json` 자동 생성/갱신
- [x] 성능 오버헤드가 사용자 체감 가능한가? -> 4프로젝트 기준 1~3초, `--skip-cross-detect`로 비활성화 가능
- [x] 대시보드에서 건강 상태를 한눈에 파악할 수 있는가? -> 위젯에 색상 코드(빨강/노랑/회색) + 건수 표시
