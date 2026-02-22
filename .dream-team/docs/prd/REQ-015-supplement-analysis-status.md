# REQ-015 보완: 분석 결과 상태(Status) 체계 도입

> **문서 유형**: REQ-015 보완 문서 (Supplement)
> **원본 PRD**: `REQ-015-cross-project-auto-analysis.md`
> **작성 배경**: 사용자 피드백 - "기획서나 요구사항에도 상태값이 있으면 좋겠다. 완료되지 않은 요구사항이나 기획서를 대상으로 보완 분석 필요 제안을 하는 게 좋겠다."

---

## 1. 문제 정의

### 1.1 현재 상태 (As-Is)

| 엔티티 | 상태 관리 | 비고 |
|--------|:---------:|------|
| `ProjectEntry` | `active \| archived` | 프로젝트 수준 상태 존재 |
| `Check` | `pending \| confirmed \| rejected` | 개별 확인 항목 상태 존재 |
| `ResultSummary` | **없음** | id, specTitle, analyzedAt, totalScore, grade, affectedScreenCount, taskCount만 존재 |
| 분석 결과 JSON | **없음** | 분석 완료 후 라이프사이클 관리 없음 |

### 1.2 문제 시나리오

```
1. "장바구니 리뉴얼" 기획서 분석 -> 결과 저장 (아직 개발 진행 중)
2. "결제 로직 개선" 기획서 분석 -> 결과 저장 (이미 배포 완료, 운영 안정화됨)
3. "배송 추적 개선" 기획서 분석 -> 결과 저장 (기획 보류 상태)
4. 신규 프로젝트 "e-scm-batch" 등록

현재(As-Is): 3건 모두에 대해 보완 분석 제안 (비효율)
개선(To-Be): "장바구니 리뉴얼"(active)만 보완 분석 제안
  - "결제 로직 개선": completed -> 제외
  - "배송 추적 개선": on-hold -> 제외
```

### 1.3 영향 범위

이 보완 사항은 REQ-015의 다음 기능에 직접 영향을 준다:

| REQ-015 기능 | 영향 | 변경 내용 |
|-------------|------|----------|
| REQ-015-2 (보완 분석 제안) | **핵심** | active 상태 분석 결과만 대상으로 필터링 |
| REQ-015-3 (GapDetector) | **직접** | completed/archived 분석은 gap 탐지에서 제외 |
| REQ-015-1 (자동 크로스 감지) | 간접 | 상태에 따라 크로스 링크 참조 범위 조정 가능 |

---

## 2. 분석 결과 상태(Status) 체계 설계

### 2.1 상태 정의

4개의 상태를 도입한다. 과도한 복잡도를 피하면서 실질적인 사용 시나리오를 모두 커버하는 최소한의 상태 집합이다.

| 상태 | 값 | 의미 | 보완 분석 대상 | gap 탐지 대상 |
|------|:--:|------|:--------------:|:-------------:|
| **활성** | `active` | 기획/개발 진행 중. 영향도 분석이 유효하며 지속적으로 관리 필요 | O | O |
| **완료** | `completed` | 개발 배포 완료. 분석 결과는 아카이브 참조용으로 보존 | X | X |
| **보류** | `on-hold` | 기획이 일시 보류됨. 재개 시 active로 전환 | X | X |
| **폐기** | `archived` | 기획이 취소/폐기됨. 분석 결과는 이력 보존용 | X | X |

#### 상태를 4개로 제한하는 근거

- `active`: 현재 작업 중인 기획. 보완 분석과 gap 탐지의 유일한 대상
- `completed`: 배포까지 완료된 기획. "끝난 건" 을 명시적으로 표시하는 가장 직관적인 상태
- `on-hold`: "아직 끝나지 않았지만 지금은 아닌" 기획. active와 archived 사이의 과도기 상태
- `archived`: 취소/폐기. completed와의 차이는 "성공적 완료 vs 취소"

`draft`, `reviewing`, `in-development` 같은 세분화된 상태는 도입하지 않는다. 분석 도구의 목적은 프로젝트 관리가 아니라 영향도 파악이므로, "보완 분석 대상인가 아닌가"를 구분할 수 있으면 충분하다.

### 2.2 상태 전환 규칙

```
                  +-----------+
        +-------->| on-hold   |<--------+
        |         +-----------+         |
        |             |                 |
        | hold        | resume          | hold
        |             v                 |
  +-----------+   +-----------+   +-----------+
  | (신규분석) |-->|  active   |-->| completed |
  +-----------+   +-----------+   +-----------+
                      |                 |
                      | archive         | archive
                      v                 v
                  +-----------+
                  | archived  |
                  +-----------+
```

| 전환 | From | To | 트리거 | 비고 |
|------|------|----|--------|------|
| 신규 생성 | (없음) | `active` | `save-result` 실행 | 모든 분석 결과는 active로 생성 |
| 완료 처리 | `active` | `completed` | 사용자 수동 실행 | 배포 완료 후 사용자가 명시적으로 변경 |
| 보류 처리 | `active` | `on-hold` | 사용자 수동 실행 | 기획 보류 시 |
| 재개 | `on-hold` | `active` | 사용자 수동 실행 | 보류 기획 재개 시 |
| 폐기 | `active` / `on-hold` / `completed` | `archived` | 사용자 수동 실행 | 어떤 상태에서든 폐기 가능 |

**금지된 전환**:
- `archived` -> 다른 상태: 폐기는 되돌릴 수 없음 (실수 방지를 위해 단방향)
- `completed` -> `active`: 완료된 건을 다시 활성화하는 것은 보완 분석(`supplement`)으로 대체

### 2.3 상태 전환 권한

모든 상태 전환은 **사용자 명시적 실행**으로만 수행된다. 시스템이 자동으로 상태를 변경하지 않는다.

근거:
- 분석 결과의 라이프사이클은 기획/개발 프로세스와 연동되므로, 기계적 판단보다 사용자 판단이 정확
- 자동 전환 시 오판 위험 (예: 오래된 분석을 자동 archived 처리하면, 장기 프로젝트의 유효한 분석이 제외됨)
- MVP 단계에서는 단순한 수동 전환이 적절. 향후 CI/CD 연동 시 자동 전환 검토 가능

---

## 3. 타입 변경 상세

### 3.1 `ResultSummary` 타입 확장

**파일**: `src/core/analysis/result-manager.ts`

```typescript
/** 분석 결과 상태 */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';

/** 결과 요약 정보 */
export interface ResultSummary {
  /** 결과 ID */
  id: string;
  /** 기획서 제목 */
  specTitle: string;
  /** 분석 시각 */
  analyzedAt: string;
  /** 총점 */
  totalScore: number;
  /** 등급 */
  grade: string;
  /** 영향 화면 수 */
  affectedScreenCount: number;
  /** 작업 수 */
  taskCount: number;
  /** 분석 결과 상태 (신규 필드, 기본값: 'active') */
  status?: AnalysisStatus;
  /** 상태 변경 시각 (상태가 마지막으로 변경된 시각) */
  statusChangedAt?: string;
}
```

`status` 필드를 optional(`?`)로 선언하여 기존 데이터와의 하위 호환성을 보장한다.

### 3.2 분석 결과 JSON 상위 레벨 상태 필드 추가

**파일**: `src/types/analysis.ts`

분석 결과 JSON(ConfidenceEnrichedResult 또는 상위 저장 포맷)에도 status 필드를 추가하여 ResultSummary와 일관성을 유지한다.

```typescript
/** 분석 결과 상태 (재사용 가능한 공통 타입) */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';
```

> 참고: `AnalysisStatus` 타입은 `src/types/analysis.ts`에 정의하고, `ResultSummary`에서 import하여 사용한다. 단일 소스 원칙(Single Source of Truth).

---

## 4. 보완 분석 대상 필터링 로직 개선

### 4.1 REQ-015-2 (보완 분석 제안) 필터링 변경

**기존 로직** (REQ-015 FR-015-2-1):
```
기존 프로젝트들의 분석 결과(results) 목록을 조회
-> 모든 결과의 parsedSpec 키워드와 신규 프로젝트 인덱스 비교
-> 매칭도 20% 이상이면 보완 분석 제안
```

**개선 로직**:
```
기존 프로젝트들의 분석 결과(results) 목록을 조회
-> status === 'active'인 결과만 필터링
-> 필터링된 결과의 parsedSpec 키워드와 신규 프로젝트 인덱스 비교
-> 매칭도 20% 이상이면 보완 분석 제안
```

**의사 코드**:
```typescript
// init 완료 후 기존 분석 스캔 (FR-015-2-1 개선)
async function scanExistingAnalyses(newProjectIndex: ProjectIndex): Promise<SupplementCandidate[]> {
  const allResults = await resultManager.listAll(); // 모든 프로젝트의 분석 결과

  // 핵심 변경: active 상태만 필터링
  const activeResults = allResults.filter(r => getEffectiveStatus(r) === 'active');

  const candidates: SupplementCandidate[] = [];
  for (const result of activeResults) {
    const matchScore = calculateMatchScore(result.parsedSpec, newProjectIndex);
    if (matchScore >= 0.2) {
      candidates.push({ result, matchScore });
    }
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 실효 상태 결정 (하위 호환성 보장)
 * status 필드가 없는 기존 데이터는 'active'로 간주
 */
function getEffectiveStatus(summary: ResultSummary): AnalysisStatus {
  return summary.status ?? 'active';
}
```

### 4.2 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|----------|
| `status` 필드 없음 (기존 데이터) | `'active'`로 간주 (하위 호환, `getEffectiveStatus()` 함수) |
| 상태 전환 중인 건 (사용자가 상태 변경 API 호출 직후) | 상태 변경은 동기적으로 인덱스 파일에 반영되므로 경쟁 조건 없음 |
| 보완 분석 결과(`supplement-*`)의 상태 | 원본 분석과 독립적으로 관리. 보완 분석도 `active`로 생성됨 |
| 원본이 `completed`인데 보완 분석이 `active` | 정상 시나리오. 보완 분석은 신규 프로젝트 관점이므로 독립 라이프사이클 |

### 4.3 사용자 안내 메시지 변경

**기존 (REQ-015 FR-015-2-2)**:
```
기존 분석 중 이 프로젝트에 영향을 줄 수 있는 항목이 발견되었습니다:
  [1] "상품 물리 스펙 수정" (e-scm-front, 2026-02-15) - 매칭도 72%
  [2] "결제 로직 개선" (e-scm-api, 2026-02-10) - 매칭도 35%
```

**개선**:
```
진행 중인 기획 중 이 프로젝트에 영향을 줄 수 있는 항목이 발견되었습니다:
  [1] "상품 물리 스펙 수정" (e-scm-front, 2026-02-15) [active] - 매칭도 72%
  [2] "장바구니 리뉴얼" (e-scm-api, 2026-02-18) [active] - 매칭도 35%

  (완료/보류/폐기 상태인 분석 2건은 제외됨)

보완 분석을 진행하시겠습니까? [Y/n]
```

제외된 건 수를 표시하여 사용자가 필터링이 적용되었음을 인지할 수 있도록 한다.

---

## 5. GapDetector 연동

### 5.1 gap 탐지 대상 필터링

**기존 GapDetector 로직** (REQ-015 FR-015-3-1):
- 모든 분석 결과를 대상으로 4가지 유형의 누락 탐지

**개선**:
- `active` 상태인 분석 결과만 gap 탐지 대상으로 포함
- `completed`, `on-hold`, `archived` 상태는 gap 탐지에서 제외

| 누락 유형 | 상태 필터링 적용 | 근거 |
|----------|:---------------:|------|
| 미분석 프로젝트 | 해당 없음 | 프로젝트 수준 판단이므로 분석 결과 상태와 무관 |
| Stale 링크 | O | completed/archived 분석에서 생성된 링크는 stale 여부 무관 |
| 저신뢰도 분석 | O | completed 분석의 저신뢰도는 이미 종료된 건이므로 경고 불필요 |
| 인덱스 미갱신 | 해당 없음 | 프로젝트 수준 판단이므로 분석 결과 상태와 무관 |

**의사 코드**:
```typescript
// GapDetector 내부
async detectGaps(options?: { projectId?: string }): Promise<GapReport> {
  const gaps: Gap[] = [];

  // 유형 1: 미분석 프로젝트 (상태 필터 없음 - 프로젝트 수준)
  gaps.push(...this.detectUnanalyzedProjects());

  // 유형 2: Stale 링크 (active 분석 관련 링크만)
  gaps.push(...this.detectStaleLinks({ statusFilter: 'active' }));

  // 유형 3: 저신뢰도 분석 (active만)
  const activeResults = allResults.filter(r => getEffectiveStatus(r) === 'active');
  gaps.push(...this.detectLowConfidence(activeResults));

  // 유형 4: 인덱스 미갱신 (상태 필터 없음 - 프로젝트 수준)
  gaps.push(...this.detectStaleIndex());

  return { gaps, checkedAt: new Date().toISOString() };
}
```

### 5.2 gap-check 출력 형식 변경

```
영향도 누락 탐지 결과 (active 분석 기준):

  [HIGH] Stale 링크 1건
    - e-scm-api -> e-scm-front: e-scm-front 인덱스 5일 전 갱신

  [MEDIUM] 저신뢰도 분석 1건
    - "장바구니 리뉴얼" (e-scm-api) [active]: 장바구니 화면 신뢰도 35%

  제외됨: completed 2건, on-hold 1건, archived 0건
```

---

## 6. CLI 명령어 추가

### 6.1 상태 변경 CLI

```bash
# 분석 결과 상태 변경
node {skill_dir}/dist/index.js result-status <analysis-id> --status <status>

# 예시
node {skill_dir}/dist/index.js result-status analysis-1708012800000 --status completed
node {skill_dir}/dist/index.js result-status analysis-1708012800000 --status on-hold
node {skill_dir}/dist/index.js result-status analysis-1708012800000 --status archived

# 프로젝트 내 활성 분석 목록 조회 (상태 필터)
node {skill_dir}/dist/index.js results --project <id> --status active
node {skill_dir}/dist/index.js results --project <id> --status all
```

### 6.2 상태 변경 시 출력

```
분석 결과 상태 변경:
  "상품 물리 스펙 수정" (e-scm-front)
  active -> completed

  이 분석은 더 이상 보완 분석 제안 및 gap 탐지 대상에 포함되지 않습니다.
```

### 6.3 SKILL.md 자연어 매핑 추가

| 사용자 의도 | 실행 방식 | 트리거 예시 |
|------------|----------|-----------|
| 분석 상태 변경 | `node {skill_dir}/dist/index.js result-status <id> --status <status>` | "분석 완료 처리해줘", "이거 보류해줘", "분석 상태 변경" |
| 활성 분석 조회 | `node {skill_dir}/dist/index.js results --project <id> --status active` | "진행 중인 분석 보여줘", "active 분석", "활성 분석" |
| 전체 분석 조회 | `node {skill_dir}/dist/index.js results --project <id> --status all` | "모든 분석 보여줘", "전체 분석 목록" |

### 6.4 일괄 상태 변경

```bash
# 프로젝트 내 모든 active 분석을 completed로 변경
node {skill_dir}/dist/index.js result-status --project <id> --bulk --from active --to completed

# 확인 프롬프트
# '{project}' 프로젝트의 active 분석 5건을 completed로 변경합니다. [Y/n]
```

---

## 7. 웹 대시보드 연동

### 7.1 API 엔드포인트

**기존 API 변경**:

```
GET /api/results?projectId=<id>
  응답에 status 필드 추가 (기존 호환: status 없으면 'active' 간주)

GET /api/results?projectId=<id>&status=active
  상태 필터링 지원 (쿼리 파라미터 추가)
```

**신규 API**:

```
PATCH /api/results/:analysisId/status
  Body: { "status": "completed" | "on-hold" | "archived" }
  응답: { "id": "...", "status": "completed", "statusChangedAt": "..." }

  유효성 검증:
  - archived에서 다른 상태로 전환 시 400 에러
  - completed에서 active로 전환 시 400 에러
```

### 7.2 대시보드 UI 변경

**LNB 기획서 목록**:
- 각 기획서 항목 옆에 상태 배지(badge) 표시
  - `active`: 파란색 점 (기본, 가장 눈에 띄지 않게)
  - `completed`: 초록색 체크 아이콘
  - `on-hold`: 노란색 일시정지 아이콘
  - `archived`: 회색 아카이브 아이콘
- 상태별 필터 드롭다운 (기본: "활성만 표시", 옵션: "전체 표시")

**상세 패널 내 상태 변경**:
- 분석 결과 상세 보기 상단에 상태 변경 드롭다운 추가
- 상태 전환 규칙에 따라 선택 가능한 상태만 드롭다운에 표시
- 변경 시 확인 다이얼로그 표시 (특히 archived 전환 시 "되돌릴 수 없습니다" 경고)

---

## 8. 수용 기준 (Acceptance Criteria) 추가/수정

### 8.1 신규 AC (상태 체계)

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-S-1 | 신규 분석 결과 저장 시 `status: 'active'`가 기본값으로 설정된다 | 단위 테스트: `save-result` 실행 후 인덱스 파일의 status 필드 확인 |
| AC-015-S-2 | `result-status <id> --status completed` 실행 시 인덱스 파일의 해당 항목 status가 `completed`로 변경된다 | 단위 테스트: 상태 변경 전후 인덱스 파일 비교 |
| AC-015-S-3 | `archived` 상태의 분석을 다른 상태로 변경 시도하면 에러가 반환된다 | 단위 테스트: archived 항목에 `--status active` 실행 -> 에러 메시지 확인 |
| AC-015-S-4 | `status` 필드가 없는 기존 분석 결과는 `active`로 간주된다 | 단위 테스트: status 없는 mock 데이터에 대해 `getEffectiveStatus()` -> 'active' 반환 |
| AC-015-S-5 | `PATCH /api/results/:id/status` API가 유효한 상태 전환만 허용한다 | API 테스트: 유효/무효 전환 요청 -> 200/400 응답 확인 |
| AC-015-S-6 | 대시보드 LNB에서 분석 결과의 상태 배지가 표시된다 | 프론트엔드 테스트: mock 데이터 -> 배지 렌더링 확인 |
| AC-015-S-7 | 대시보드 상세 패널에서 상태를 변경할 수 있다 | E2E 테스트: 드롭다운 선택 -> API 호출 -> UI 반영 확인 |

### 8.2 REQ-015-2 AC 수정

| AC ID | 기존 기준 | 수정된 기준 |
|:-----:|----------|-----------|
| AC-015-2-1 | 기존 분석 결과와 매칭도 20% 이상인 항목이 있으면 보완 분석을 제안한다 | **`status === 'active'`인** 기존 분석 결과와 매칭도 20% 이상인 항목이 있으면 보완 분석을 제안한다. completed/on-hold/archived 상태 분석은 제안 대상에서 제외된다 |
| AC-015-2-4 | 기존 분석 결과가 없으면 보완 분석 제안을 건너뛴다 | 기존 분석 결과가 없**거나, 모든 분석 결과가 active 상태가 아니면** 보완 분석 제안을 건너뛴다 |

**신규 AC**:

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-2-6 | `completed` 상태인 분석 결과는 보완 분석 제안 대상에서 제외된다 | 단위 테스트: completed 1건 + active 1건 상태에서 init -> active 건만 제안에 포함 확인 |
| AC-015-2-7 | 보완 분석 제안 시 제외된 건 수가 메시지에 표시된다 | 단위 테스트: completed 2건 제외 시 "(완료/보류/폐기 상태인 분석 2건은 제외됨)" 메시지 확인 |

### 8.3 REQ-015-3 AC 수정

| AC ID | 기존 기준 | 수정된 기준 |
|:-----:|----------|-----------|
| AC-015-3-1 | 4가지 유형의 누락을 탐지한다 | 4가지 유형의 누락을 탐지하되, **저신뢰도/Stale 링크는 active 상태 분석만 대상**으로 한다 |

**신규 AC**:

| AC ID | 기준 | 검증 방법 |
|:-----:|------|----------|
| AC-015-3-7 | `completed` 상태인 분석은 저신뢰도 gap에서 제외된다 | 단위 테스트: completed 상태의 저신뢰도 분석 -> gap 미탐지 확인 |
| AC-015-3-8 | gap-check 출력에 상태별 제외 건수가 표시된다 | 단위 테스트: mixed 상태 데이터 -> "제외됨: completed N건, on-hold M건" 출력 확인 |

---

## 9. 영향받는 파일

| 파일 | 변경 유형 | 상세 |
|------|----------|------|
| `src/types/analysis.ts` | 수정 | `AnalysisStatus` 타입 추가 |
| `src/core/analysis/result-manager.ts` | 수정 | `ResultSummary`에 status/statusChangedAt 필드 추가, 상태 변경 메서드 추가, `getEffectiveStatus()` 유틸 함수 추가 |
| `src/commands/result-status.ts` | 신규 | `result-status` CLI 명령어 |
| `src/router.ts` | 수정 | `result-status` 명령어 등록 |
| `src/commands/init.ts` | 수정 | 기존 분석 스캔 시 active 필터링 적용 (REQ-015-2 연동) |
| `src/core/cross-project/gap-detector.ts` | 수정 | gap 탐지 시 active 필터링 적용 |
| `src/server/web-server.ts` | 수정 | `PATCH /api/results/:id/status` 엔드포인트 추가, 기존 `GET /api/results` 에 status 쿼리 파라미터 지원 |
| `web/src/components/sidebar/` | 수정 | LNB 기획서 목록에 상태 배지 추가, 필터 드롭다운 추가 |
| `web/src/pages/` | 수정 | 분석 상세 패널에 상태 변경 드롭다운 추가 |
| `SKILL.md` | 수정 | 자연어 매핑 테이블에 상태 관련 명령어 추가 |

---

## 10. Open Items 보완

### 10.1 기존 데이터 마이그레이션 방안

**문제**: 이미 저장된 분석 결과에는 `status` 필드가 없다.

**방안: Lazy Migration (지연 마이그레이션)**

명시적 마이그레이션 스크립트를 실행하지 않고, 런타임에서 `status` 필드 부재를 처리한다.

```typescript
// 모든 status 참조 지점에서 사용
function getEffectiveStatus(summary: ResultSummary): AnalysisStatus {
  return summary.status ?? 'active';
}
```

- 장점: 마이그레이션 실행 불필요, 즉시 배포 가능, 기존 파일 수정 없음
- 단점: 런타임 null 체크 비용 (미미함)
- 인덱스 파일 정합성: 사용자가 상태를 변경할 때 비로소 `status` 필드가 기록됨
- 일괄 마이그레이션 CLI 옵션도 제공 (선택적):
  ```bash
  node {skill_dir}/dist/index.js migrate-status --set-default active
  # 모든 기존 분석 결과에 status: 'active'를 명시적으로 기록
  ```

### 10.2 기본 상태값 정책

| 상황 | 기본 상태 | 근거 |
|------|:---------:|------|
| `save-result`로 새 분석 결과 저장 | `active` | 분석 직후 기획은 진행 중 상태 |
| 보완 분석 결과 (`supplement-*`) 저장 | `active` | 보완 분석도 진행 중인 기획에 대한 분석 |
| `status` 필드 없는 기존 데이터 | `active` (런타임 간주) | 하위 호환: 기존 분석은 active로 취급하는 것이 가장 안전 |

### 10.3 REQ-015 원본 PRD Open Item 7.5와의 관계

원본 PRD의 Open Item 7.5는 보완 분석 결과의 대시보드 표시 방법에 대한 것이다. 이 보완 문서의 상태 체계는 보완 분석 결과에도 동일하게 적용되므로, 보완 분석 결과 옆에도 상태 배지가 표시된다. "(보완)" 라벨과 상태 배지는 독립적으로 표시된다.

---

## 부록 A: 자체 검토 이력 (R1~R5)

### R1: 상태 체계 과도성 검토

- [x] 4개 상태(`active`, `completed`, `on-hold`, `archived`)가 최소 충분한지 검토
  - `draft` 상태 불필요: 분석 결과는 `save-result` 시점에 이미 완성됨. 분석 중간 상태는 CLI/AI 프로토콜이 관리
  - `in-review` 상태 불필요: 분석 도구의 목적은 리뷰 프로세스 관리가 아님. Check의 `confirmed/rejected`가 리뷰 역할
  - `in-development` 상태 불필요: 개발 진행 상태는 외부 이슈 트래커(Jira 등)가 관리. KIC는 영향도 분석 도구
- [x] 상태 전환 복잡도 검토: 5개 전환 규칙 (신규, 완료, 보류, 재개, 폐기). 단순하고 직관적
- [x] 결론: 4개 상태는 "보완 분석 대상 여부"를 판단하기에 충분하며, 프로젝트 관리 도구 수준의 복잡도는 불필요

### R2: 실제 사용 시나리오 검증

- [x] 시나리오 1: 기획서 분석 -> 개발 -> 배포 완료 -> `completed` 처리 -> 이후 보완 분석 대상에서 자동 제외
- [x] 시나리오 2: 기획 보류 -> `on-hold` 처리 -> 보완 분석 대상에서 제외 -> 재개 시 `active` 복원 -> 다시 포함
- [x] 시나리오 3: 기획 취소 -> `archived` 처리 -> 영구 제외 (되돌릴 수 없음)
- [x] 시나리오 4: 사용자가 상태를 변경하지 않는 경우 -> 기존과 동일 동작 (모든 분석이 active 간주)
- [x] 상태 변경 타이밍: 사용자가 자연스럽게 변경하는 시점은 "배포 완료 후" 또는 "기획 보류 결정 시". CLI/대시보드 양쪽에서 변경 가능

### R3: 기존 데이터 하위 호환성

- [x] `ResultSummary.status`를 optional(`?`)로 선언하여 기존 데이터 파싱 에러 없음
- [x] `getEffectiveStatus()` 함수로 null/undefined를 `active`로 통일
- [x] 기존 인덱스 파일(`results/index.json`)에 status 필드가 없어도 정상 동작
- [x] 프론트엔드: API 응답에 status가 없으면 `active`로 렌더링 (클라이언트 측 fallback)
- [x] Lazy migration 전략으로 기존 파일 수정 없이 즉시 배포 가능

### R4: 상태 전환 오류 방지

- [x] `archived` -> 다른 상태 전환 차단 (CLI에서 에러 메시지, API에서 400 응답)
- [x] `completed` -> `active` 전환 차단 (완료 건의 재활성화는 보완 분석으로 대체)
- [x] 유효하지 않은 상태값 입력 시 에러 (TypeScript enum/union type + 런타임 검증)
- [x] 대시보드 드롭다운에서 유효한 전환만 옵션으로 표시 (잘못된 전환 선택 자체가 불가능)
- [x] 상태 변경 성공 시 `statusChangedAt` 자동 기록으로 이력 추적 가능

### R5: REQ-015 전체 정합성 최종 검토

- [x] REQ-015-1 (자동 크로스 감지): status 필터링은 적용하지 않음. 모든 상태의 분석에서 크로스 링크를 감지해야 전체 의존성 맵이 완성됨. 단, gap-check에서는 active만 대상
- [x] REQ-015-2 (보완 분석 제안): AC-015-2-1, AC-015-2-4 수정 완료. active만 대상으로 필터링
- [x] REQ-015-3 (GapDetector): 저신뢰도/Stale 링크 탐지에 active 필터 적용. 프로젝트 수준 탐지(미분석, 인덱스 미갱신)는 상태와 무관
- [x] Open Items: 기존 7.1~7.6에 추가하여 10.1~10.3으로 마이그레이션/기본값 정책 수립
- [x] 영향받는 파일 목록이 기존 REQ-015와 중복 없이 정리됨 (신규 파일 1개: `result-status.ts`)
- [x] 성능 영향: 상태 필터링은 인메모리 배열 필터(`Array.filter`)이므로 추가 I/O 없음. 성능 영향 무시 가능
