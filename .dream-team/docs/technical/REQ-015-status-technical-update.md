# REQ-015 기술 설계 보정: 분석 결과 상태(Status) 체계 반영 + 전체 로드맵 재구성

> **작성자**: TPO (Tech Product Owner)
> **기반 문서**:
>   - 기존 기술 설계: `REQ-015-technical-review.md`
>   - 상태값 PRD: `REQ-015-supplement-analysis-status.md`
>   - 상태값 UI 설계: `REQ-015-status-ui-design.md`
>   - 개발자 리뷰: `REQ-015-dev-review.md`
> **상태**: 리뷰 대기 (Review Ready)
> **최종 갱신**: 2026-02-22

---

## 1. 타입 변경 상세

### 1.1 `AnalysisStatus` 타입 정의

**파일**: `src/types/analysis.ts` (Single Source of Truth)

```typescript
/** 분석 결과 상태 */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';
```

모든 상태 참조 지점(백엔드, 프론트엔드)에서 이 타입을 import하거나 동일하게 선언한다.

### 1.2 `ResultSummary` 타입 확장

**파일**: `src/core/analysis/result-manager.ts`

```typescript
import type { AnalysisStatus } from '../../types/analysis';

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
  /** 분석 결과 상태 (신규, 기본값 'active') */
  status?: AnalysisStatus;
  /** 상태 변경 시각 */
  statusChangedAt?: string;
  /** 보완 분석 여부 (기존 REQ-015 설계) */
  isSupplement?: boolean;
  /** 원본 분석 ID (기존 REQ-015 설계) */
  supplementOf?: string;
  /** 보완 트리거 프로젝트 (기존 REQ-015 설계) */
  triggerProject?: string;
}
```

`status`를 optional(`?`)로 선언하여 기존 데이터와의 하위 호환성을 보장한다. `status` 필드가 없는 기존 데이터는 `getEffectiveStatus()`를 통해 `'active'`로 간주된다.

### 1.3 `getEffectiveStatus()` 유틸리티 함수

**파일**: `src/utils/analysis-status.ts` (신규)

```typescript
import type { AnalysisStatus } from '../types/analysis';
import type { ResultSummary } from '../core/analysis/result-manager';

/**
 * 실효 상태를 반환한다 (Lazy Migration 전략).
 * status 필드가 없는 기존 데이터는 'active'로 간주한다.
 */
export function getEffectiveStatus(summary: ResultSummary): AnalysisStatus {
  return summary.status ?? 'active';
}
```

이 함수를 CLI, API, 프론트엔드 등 모든 상태 참조 지점에서 사용한다.

### 1.4 프론트엔드 `ResultSummary` 타입 동기화

**파일**: `web/src/types/index.ts`

```typescript
/** 분석 결과 상태 */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';

export interface ResultSummary {
  id: string;
  specTitle: string;
  analyzedAt: string;
  totalScore: number;
  grade: string;
  affectedScreenCount: number;
  taskCount: number;
  /** 데모/목업 데이터 여부 */
  isDemo?: boolean;
  /** 분석 결과 상태 (신규) */
  status?: AnalysisStatus;
  /** 상태 변경 시각 (신규) */
  statusChangedAt?: string;
}
```

프론트엔드에서도 동일한 fallback을 적용한다:

```typescript
// web/src/utils/status.ts (신규)
import type { AnalysisStatus, ResultSummary } from '../types';

export function getEffectiveStatus(result: ResultSummary): AnalysisStatus {
  return result.status ?? 'active';
}
```

### 1.5 `AnalysisStatus` 전환 규칙 (`VALID_TRANSITIONS` 맵)

**파일**: `src/utils/analysis-status.ts` (1.3절과 동일 파일)

```typescript
/**
 * 유효한 상태 전환 맵.
 * key = 현재 상태, value = 전환 가능한 상태 목록.
 * 이 맵에 없는 전환은 모두 금지된다.
 */
export const VALID_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  'active':    ['completed', 'on-hold', 'archived'],
  'completed': ['archived'],
  'on-hold':   ['active', 'archived'],
  'archived':  [],  // 단방향: 어디로도 전환 불가
};

/**
 * 상태 전환이 유효한지 검증한다.
 * @returns true = 유효, false = 금지된 전환
 */
export function isValidTransition(
  from: AnalysisStatus,
  to: AnalysisStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 상태 전환 금지 사유 메시지를 반환한다.
 */
export function getTransitionError(
  from: AnalysisStatus,
  to: AnalysisStatus
): string {
  if (from === 'archived') {
    return '폐기된 분석은 상태를 변경할 수 없습니다.';
  }
  if (from === 'completed' && to === 'active') {
    return '완료된 분석은 재활성화할 수 없습니다. 보완 분석을 실행해주세요.';
  }
  return `${from}에서 ${to}(으)로의 전환은 허용되지 않습니다.`;
}
```

프론트엔드에도 동일한 전환 맵을 배치한다:

**파일**: `web/src/utils/status.ts`

```typescript
export const VALID_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  'active':    ['completed', 'on-hold', 'archived'],
  'completed': ['archived'],
  'on-hold':   ['active', 'archived'],
  'archived':  [],
};

export function isValidTransition(from: AnalysisStatus, to: AnalysisStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## 2. API 변경

### 2.1 `PATCH /api/results/:id/status` 신규 엔드포인트

**파일**: `src/server/web-server.ts`
**위치**: 기존 results API 블록 이후, API 404 핸들러 이전

```typescript
app.patch('/api/results/:id/status', async (req: Request, res: Response) => {
  try {
    const analysisId = req.params.id;
    const { status: newStatus } = req.body as { status: string };

    // 1. 입력 검증
    const validStatuses: AnalysisStatus[] = ['active', 'completed', 'on-hold', 'archived'];
    if (!validStatuses.includes(newStatus as AnalysisStatus)) {
      res.status(400).json({ error: `Invalid status: ${newStatus}` });
      return;
    }

    // 2. 프로젝트 탐색 (analysisId로 프로젝트 찾기)
    const { projectId, summary } = await resultManager.findByAnalysisId(analysisId);
    if (!summary) {
      res.status(404).json({ error: `Analysis not found: ${analysisId}` });
      return;
    }

    // 3. 전환 규칙 검증
    const currentStatus = getEffectiveStatus(summary);
    if (!isValidTransition(currentStatus, newStatus as AnalysisStatus)) {
      res.status(400).json({
        error: getTransitionError(currentStatus, newStatus as AnalysisStatus),
      });
      return;
    }

    // 4. 상태 업데이트
    const updatedSummary = await resultManager.updateStatus(
      projectId,
      analysisId,
      newStatus as AnalysisStatus
    );

    res.json({
      id: analysisId,
      status: updatedSummary.status,
      statusChangedAt: updatedSummary.statusChangedAt,
    });
  } catch (error) {
    logger.error('Failed to update result status:', error);
    res.status(500).json({ error: 'Failed to update result status' });
  }
});
```

**ResultManager 추가 메서드**:

```typescript
// result-manager.ts 에 추가
async updateStatus(
  projectId: string,
  analysisId: string,
  newStatus: AnalysisStatus
): Promise<ResultSummary> {
  const indexPath = this.getIndexPath(projectId);
  const index = readJsonFile<ResultSummary[]>(indexPath) || [];

  const item = index.find(r => r.id === analysisId);
  if (!item) throw new Error(`Result not found: ${analysisId}`);

  item.status = newStatus;
  item.statusChangedAt = new Date().toISOString();

  writeJsonFile(indexPath, index);
  return item;
}

async findByAnalysisId(
  analysisId: string
): Promise<{ projectId: string; summary: ResultSummary | null }> {
  // 모든 프로젝트의 인덱스를 순회하여 analysisId를 찾는다
  const projectsPath = path.join(this.basePath, 'projects.json');
  const config = readJsonFile<ProjectsConfig>(projectsPath);
  if (!config?.projects) return { projectId: '', summary: null };

  for (const project of config.projects) {
    const summaries = await this.list(project.id);
    const found = summaries.find(s => s.id === analysisId);
    if (found) return { projectId: project.id, summary: found };
  }
  return { projectId: '', summary: null };
}
```

### 2.2 `GET /api/results` 에 `?status=` 쿼리 파라미터 추가

**파일**: `src/server/web-server.ts`
**변경**: 기존 `GET /api/results` 핸들러 내부에 필터링 로직 추가

```typescript
// 기존 GET /api/results 핸들러 내부
const statusFilter = req.query.status as string | undefined;

let summaries = await resultManager.list(projectId);

if (statusFilter && statusFilter !== 'all') {
  summaries = summaries.filter(s => getEffectiveStatus(s) === statusFilter);
}
```

쿼리 파라미터가 없으면 모든 상태를 반환한다 (하위 호환).

### 2.3 `result-status` CLI 명령어

**신규 파일**: `src/commands/result-status.ts`

```typescript
export class ResultStatusCommand implements Command {
  readonly name = 'result-status';
  readonly description = '분석 결과 상태 변경';

  async execute(): Promise<CommandResult> {
    const analysisId = this.args[0];
    const newStatus = this.getOption('--status') as AnalysisStatus;

    if (!analysisId || !newStatus) {
      return {
        code: ResultCode.FAILURE,
        message: 'Usage: result-status <analysis-id> --status <active|completed|on-hold|archived>',
      };
    }

    // 1. 분석 결과 찾기
    const resultManager = new ResultManager();
    const { projectId, summary } = await resultManager.findByAnalysisId(analysisId);
    if (!summary) {
      return { code: ResultCode.FAILURE, message: `Analysis not found: ${analysisId}` };
    }

    // 2. 전환 규칙 검증
    const currentStatus = getEffectiveStatus(summary);
    if (!isValidTransition(currentStatus, newStatus)) {
      return {
        code: ResultCode.FAILURE,
        message: getTransitionError(currentStatus, newStatus),
      };
    }

    // 3. 상태 업데이트
    const updated = await resultManager.updateStatus(projectId, analysisId, newStatus);

    logger.success(`분석 결과 상태 변경:\n` +
      `  "${summary.specTitle}"\n` +
      `  ${currentStatus} -> ${newStatus}`);

    if (newStatus !== 'active') {
      logger.info('이 분석은 더 이상 보완 분석 제안 및 gap 탐지 대상에 포함되지 않습니다.');
    }

    return { code: ResultCode.SUCCESS, data: { updated } };
  }
}
```

**router.ts 변경**: COMMANDS 맵에 1줄 추가

```typescript
'result-status': ResultStatusCommand,
```

---

## 3. 보완 분석 필터링 로직 변경

### 3.1 `SupplementScanner.scan()`에 상태 필터 추가

**파일**: `src/core/cross-project/supplement-scanner.ts` (REQ-015 Phase 3에서 신규 생성)

기존 기술 설계의 `SupplementScanner.scan()` 에 상태 필터를 적용한다:

```typescript
async scan(newProjectId: string, newIndex: CodeIndex): Promise<SupplementCandidate[]> {
  const resultManager = new ResultManager();
  const allResults = await resultManager.listAll();

  // [상태 필터] active 상태만 필터링
  const activeResults = allResults.filter(r => getEffectiveStatus(r) === 'active');

  // 제외 건수 추적
  const excludedCount = allResults.length - activeResults.length;

  const candidates: SupplementCandidate[] = [];
  for (const result of activeResults) {
    const matchScore = this.calculateMatchScore(result, newIndex);
    if (matchScore >= 0.2) {
      candidates.push({ result, matchScore });
    }
  }

  return {
    candidates: candidates.sort((a, b) => b.matchScore - a.matchScore),
    excludedCount,  // 제외 건수를 반환하여 안내 메시지에 활용
  };
}
```

**안내 메시지 변경** (`init.ts`에서 호출 시):

```
진행 중인 기획 중 이 프로젝트에 영향을 줄 수 있는 항목이 발견되었습니다:
  [1] "상품 물리 스펙 수정" (e-scm-front) [active] - 매칭도 72%

  (완료/보류/폐기 상태인 분석 2건은 제외됨)
```

### 3.2 `GapDetector`에 상태 필터 추가

**파일**: `src/core/cross-project/gap-detector.ts` (REQ-015 Phase 2에서 신규 생성)

GapDetector의 Stale 링크 탐지와 저신뢰도 탐지에 상태 필터를 적용한다:

```typescript
async detect(projectFilter?: string): Promise<GapItem[]> {
  const gaps: GapItem[] = [];
  const resultManager = new ResultManager();

  // 유형 1: 미분석 프로젝트 (상태 필터 없음 - 프로젝트 수준)
  gaps.push(...await this.detectUnanalyzedProjects(projectFilter));

  // 유형 2: Stale 링크 (active 분석 관련 링크만 체크)
  gaps.push(...await this.detectStaleLinks(projectFilter, { statusFilter: 'active' }));

  // 유형 3: 저신뢰도 분석 (active만)
  const allResults = await resultManager.listAll(projectFilter);
  const activeResults = allResults.filter(r => getEffectiveStatus(r) === 'active');
  gaps.push(...await this.detectLowConfidence(activeResults));

  // 유형 4: 인덱스 미갱신 (상태 필터 없음 - 프로젝트 수준)
  gaps.push(...await this.detectOutdatedIndex(projectFilter));

  // 제외 통계
  this.excludedCounts = this.calculateExcludedCounts(allResults);

  return gaps;
}

private calculateExcludedCounts(
  allResults: ResultSummary[]
): { completed: number; onHold: number; archived: number } {
  return {
    completed: allResults.filter(r => getEffectiveStatus(r) === 'completed').length,
    onHold: allResults.filter(r => getEffectiveStatus(r) === 'on-hold').length,
    archived: allResults.filter(r => getEffectiveStatus(r) === 'archived').length,
  };
}
```

**API 응답 확장** (`/api/gap-check`):

```typescript
res.json({
  gaps,
  summary,
  lastCheckedAt: new Date().toISOString(),
  statusFilter: {
    appliedFilter: 'active',
    excluded: detector.excludedCounts,
  },
});
```

---

## 4. 프론트엔드 변경

### 4.1 resultStore에 statusFilter 상태 추가

**파일**: `web/src/stores/resultStore.ts`

```typescript
interface ResultState {
  // ... 기존 상태 ...

  /** LNB 상태 필터 (기본: 'active') */
  statusFilter: 'active' | 'active+on-hold' | 'all';
  setStatusFilter: (filter: 'active' | 'active+on-hold' | 'all') => void;

  /** 분석 결과 상태 변경 */
  updateResultStatus: (analysisId: string, newStatus: AnalysisStatus) => Promise<void>;
}
```

```typescript
// store 구현부
statusFilter: 'active',
setStatusFilter: (filter) => set({ statusFilter: filter }),

updateResultStatus: async (analysisId, newStatus) => {
  const response = await fetch(`/api/results/${analysisId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update status');
  }
  // resultList 내 해당 항목의 status 갱신 (로컬 상태 즉시 반영)
  set(state => ({
    resultList: state.resultList.map(r =>
      r.id === analysisId
        ? { ...r, status: newStatus, statusChangedAt: new Date().toISOString() }
        : r
    ),
  }));
},
```

### 4.2 LNB 필터 드롭다운

**파일**: `web/src/components/layout/LNB.tsx`

기존 정렬 드롭다운 옆에 상태 필터 드롭다운을 추가한다.

- 필터 옵션: "진행중만" (기본) | "전체" | "진행중 + 보류"
- 필터 적용: `resultList.filter(r => getEffectiveStatus(r) === statusFilter)`
- 스타일: 기존 정렬 드롭다운과 동일 (`flex-1 text-xs px-2 py-1.5 bg-white border border-gray-300 rounded`)

### 4.3 AnalysisHistoryTable 상태 컬럼 + 필터 칩

**파일**: `web/src/components/project-board/AnalysisHistoryTable.tsx`

변경 사항:
1. **상태 컬럼 추가**: "등급 | 점수" 뒤에 "상태" 컬럼 삽입
2. **필터 칩**: 테이블 헤더 바 우측에 `[전체] [진행중] [완료] [보류] [폐기]` 칩 배치
3. **인라인 상태 변경**: 상태 배지 클릭 시 인라인 드롭다운 (VALID_TRANSITIONS에 따라 옵션 제한)

상태 셀 디자인:
- `active`: "진행중" 텍스트만 (`text-xs text-gray-500`)
- `completed`: "[v] 완료" 배지 (`text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5`)
- `on-hold`: "[||] 보류" 배지 (`text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5`)
- `archived`: "[x] 폐기됨" 정적 배지 (`text-xs text-gray-400 bg-gray-50 rounded px-1.5 py-0.5`, `cursor-not-allowed`)

### 4.4 ScoreHeader 상태 드롭다운

**파일**: `web/src/pages/Dashboard.tsx` (ScoreHeader 영역)

ScoreHeader 우측에 상태 변경 드롭다운을 배치한다:
- 현재 상태를 배지로 표시
- 클릭 시 VALID_TRANSITIONS에 따른 가능한 옵션만 표시
- `archived` 상태일 때는 정적 배지 (드롭다운 비활성)
- 폐기 선택 시 ArchiveConfirmDialog 표시

### 4.5 StatusBadge 공통 컴포넌트

**신규 파일**: `web/src/components/common/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: AnalysisStatus;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onClick?: () => void;
}
```

상태별 스타일:
| 상태 | 배경 | 텍스트 | 아이콘 |
|------|------|--------|--------|
| `active` | (표시 안 함) | - | - |
| `completed` | `bg-gray-100` | `text-gray-600` | 체크 아이콘 (w-3 h-3) |
| `on-hold` | `bg-amber-50` | `text-amber-700` | 일시정지 아이콘 |
| `archived` | `bg-gray-100` | `text-gray-400` | 아카이브 아이콘 |

공통 레이아웃: `inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded`

### 4.6 추가 신규 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `StatusDropdown` | `web/src/components/common/StatusDropdown.tsx` | 상태 변경 드롭다운 (전환 규칙 내장) |
| `ArchiveConfirmDialog` | `web/src/components/common/ArchiveConfirmDialog.tsx` | 폐기 확인 다이얼로그 |

---

## 5. TASK 보정 (전체 로드맵 재구성)

### 5.1 Phase 개요

기존 29 TASK(152~180)에 상태값 관련 신규 TASK를 추가하여 전체 로드맵을 재구성한다.
사용자 요청에 따라 **MVP 이후 Phase도 삭제하지 않고** 전체 일정에 포함한다.

| Phase | 범위 | TASK 수 | 포인트 | 위치 | 비고 |
|:-----:|------|:------:|:-----:|:----:|------|
| Phase 1 | 자동 저장 (기존) | 6 | 19 | TASK-152~157 | 기존 설계 유지 |
| Phase 2 | 상태값 체계 (신규 - 백엔드+프론트엔드) | 9 | 28 | TASK-181~189 | **신규 Phase** |
| Phase 3 | 갭 탐지 (기존 + 상태 필터 연동) | 6 | 20 | TASK-158~162, TASK-190 | TASK-190 추가 |
| Phase 4 | 보완 분석 (기존 + 상태 필터 연동) | 6 | 18 | TASK-163~167, TASK-191 | TASK-191 추가 |
| Phase 5 | 프론트엔드 통합 (기존 GapWidget + 상태 UI) | 5 | 17 | TASK-168~172 | 기존 설계 유지 |
| Phase 6 | 플로우차트 탭 (기존 후순위) | 4 | 12 | TASK-173~176 | 후순위, 삭제하지 않음 |
| Phase 7 | SKILL.md + 테스트 + 정리 | 5 | 13 | TASK-177~180, TASK-192 | TASK-192 추가 |
| **합계** | | **41** | **127** | | |

### 5.2 Phase 1: 자동 저장 (TASK-152 ~ TASK-157) -- 기존 유지

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-152 | CrossProjectManager.detectAndSave() 구현 | 3 | `cross-project-manager.ts` | - | 1 |
| TASK-153 | detectAndSave() 단위 테스트 | 3 | `__tests__/cross-project-manager.test.ts` | TASK-152 | 1 |
| TASK-154 | projects --detect-links --auto-save 옵션 추가 | 2 | `projects.ts` | TASK-152 | 1 |
| TASK-155 | save-result 후처리 hook 구현 | 3 | `save-result.ts` | TASK-152 | 1 |
| TASK-156 | save-result hook 단위 테스트 (성공/실패/skip) | 3 | `__tests__/save-result.test.ts` | TASK-155 | 1 |
| TASK-157 | --skip-cross-detect 옵션 + 기존 동작 회귀 테스트 | 5 | `save-result.ts`, `projects.ts` | TASK-155, TASK-154 | 1 |

**Phase 1 소계**: 6 TASK, 19 포인트

### 5.3 Phase 2: 상태값 체계 (TASK-181 ~ TASK-189) -- 신규

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-181 | AnalysisStatus 타입 + VALID_TRANSITIONS 맵 + getEffectiveStatus() 유틸 | 2 | `src/types/analysis.ts`, `src/utils/analysis-status.ts` | - | 2 |
| TASK-182 | ResultSummary에 status/statusChangedAt 필드 추가 + save-result 기본값 'active' 설정 | 2 | `src/core/analysis/result-manager.ts`, `src/commands/save-result.ts` | TASK-181 | 2 |
| TASK-183 | ResultManager.updateStatus() + findByAnalysisId() 메서드 구현 | 3 | `src/core/analysis/result-manager.ts` | TASK-182 | 2 |
| TASK-184 | result-status CLI 명령어 + router 등록 | 3 | `src/commands/result-status.ts`, `src/router.ts` | TASK-183 | 2 |
| TASK-185 | PATCH /api/results/:id/status 엔드포인트 + GET /api/results ?status= 필터 | 3 | `src/server/web-server.ts` | TASK-183 | 2 |
| TASK-186 | 백엔드 상태 체계 단위 테스트 (전환 규칙, 금지 전환, Lazy Migration) | 5 | `__tests__/analysis-status.test.ts`, `__tests__/result-status.test.ts` | TASK-184, TASK-185 | 2 |
| TASK-187 | 프론트엔드 AnalysisStatus 타입 + getEffectiveStatus() + resultStore statusFilter | 2 | `web/src/types/index.ts`, `web/src/utils/status.ts`, `web/src/stores/resultStore.ts` | TASK-185 | 2 |
| TASK-188 | StatusBadge + StatusDropdown + ArchiveConfirmDialog 공통 컴포넌트 | 5 | `web/src/components/common/StatusBadge.tsx`, `StatusDropdown.tsx`, `ArchiveConfirmDialog.tsx` | TASK-187 | 2 |
| TASK-189 | LNB 상태 필터 드롭다운 + ResultCard 상태별 스타일 | 3 | `web/src/components/layout/LNB.tsx`, `ResultCard.tsx` | TASK-188 | 2 |

**Phase 2 소계**: 9 TASK, 28 포인트

### 5.4 Phase 3: 갭 탐지 + 상태 필터 연동 (TASK-158 ~ TASK-162, TASK-190)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-158 | GapDetector 클래스 구현 (4가지 탐지 유형) | 5 | `gap-detector.ts`, `types.ts` | TASK-152 | 3 |
| TASK-159 | GapDetector 단위 테스트 (유형별 mock) | 5 | `__tests__/gap-detector.test.ts` | TASK-158 | 3 |
| TASK-160 | gap-check CLI 명령어 + router 등록 | 3 | `gap-check.ts`, `router.ts` | TASK-158 | 3 |
| TASK-161 | gap-check --fix 자동 해결 모드 | 3 | `gap-detector.ts`, `gap-check.ts` | TASK-160 | 3 |
| TASK-162 | gap-check --project 필터 + CLI 통합 테스트 | 2 | `__tests__/gap-check.test.ts` | TASK-161 | 3 |
| **TASK-190** | **GapDetector 상태 필터 연동 (active만 탐지 + excludedCounts 통계)** | **2** | `gap-detector.ts` | TASK-158, TASK-181 | 3 |

**Phase 3 소계**: 6 TASK, 20 포인트

### 5.5 Phase 4: 보완 분석 + 상태 필터 연동 (TASK-163 ~ TASK-167, TASK-191)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-163 | SupplementScanner 클래스 구현 | 3 | `supplement-scanner.ts` | - | 4 |
| TASK-164 | init 명령어 보완 분석 스캔 hook 추가 | 3 | `init.ts` | TASK-163 | 4 |
| TASK-165 | cross-analyze --supplement --project 옵션 | 3 | `cross-analyze.ts` | TASK-163 | 4 |
| TASK-166 | ResultManager supplement 결과 저장/조회 지원 | 3 | `result-manager.ts`, `analysis.ts` | - | 4 |
| TASK-167 | 보완 분석 단위 테스트 + 통합 테스트 | 4 | `__tests__/supplement*.test.ts` | TASK-164, TASK-165, TASK-166 | 4 |
| **TASK-191** | **SupplementScanner 상태 필터 연동 (active만 스캔 + 제외 건수 표시)** | **2** | `supplement-scanner.ts`, `init.ts` | TASK-163, TASK-181 | 4 |

**Phase 4 소계**: 6 TASK, 18 포인트

### 5.6 Phase 5: 프론트엔드 통합 (TASK-168 ~ TASK-172) -- 기존 유지

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-168 | /api/gap-check 엔드포인트 구현 | 3 | `web-server.ts` | TASK-158 | 5 |
| TASK-169 | /api/gap-check API 테스트 | 2 | `__tests__/web-server.test.ts` | TASK-168 | 5 |
| TASK-170 | GapHealthWidget + GapDetailList 구현 | 5 | `GapHealthWidget.tsx`, `GapDetailList.tsx` | TASK-168 | 5 |
| TASK-171 | ProjectBoard에 GapHealthWidget 통합 | 2 | `ProjectBoard.tsx` | TASK-170 | 5 |
| TASK-172 | GapHealthWidget 프론트엔드 테스트 (Vitest) | 5 | `__tests__/GapHealthWidget.test.tsx` | TASK-171 | 5 |

**Phase 5 소계**: 5 TASK, 17 포인트

### 5.7 Phase 6: 플로우차트 탭 + 보완 UI (TASK-173 ~ TASK-176) -- 후순위 유지

> 사용자 요청: "MVP 이후도 중요한 과제니까 개발 진행해서 반영되도록 잘 챙겨줘"

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-173 | CrossProjectTabs 컴포넌트 구현 (4탭) | 3 | `CrossProjectTabs.tsx` | - | 6 |
| TASK-174 | FlowChart에서 CrossProjectTabs 통합 | 3 | `FlowChart.tsx` | TASK-173 | 6 |
| TASK-175 | CrossProjectDiagram hover 하이라이트 + 노드 클릭 | 3 | `CrossProjectDiagram.tsx` | TASK-174 | 6 |
| TASK-176 | 보완 분석 UI (SupplementBanner + ResultCard 라벨) | 3 | `SupplementBanner.tsx`, `ResultCard.tsx`, `AnalysisHistoryTable.tsx`, `Dashboard.tsx` | TASK-166 | 6 |

**Phase 6 소계**: 4 TASK, 12 포인트

### 5.8 Phase 7: SKILL.md + 테스트 + 정리 (TASK-177 ~ TASK-180, TASK-192)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 | Phase |
|:----:|------|:-----:|----------|:------:|:-----:|
| TASK-177 | SKILL.md Step 4.5 + Step 2.5 강화 + 자연어 매핑 (상태 명령어 포함) | 2 | `SKILL.md` | TASK-157, TASK-184 | 7 |
| TASK-178 | 통합 테스트: save-result -> cross-project 갱신 -> FlowChart | 3 | `__tests__/integration/cross-project-flow.test.ts` | Phase 1~5 전체 | 7 |
| TASK-179 | 통합 테스트: init -> 보완 분석 스캔 -> supplement 저장 | 3 | `__tests__/integration/supplement-flow.test.ts` | Phase 4 | 7 |
| TASK-180 | 빈 상태/에러 상태 QA + 접근성 최종 점검 | 2 | 전체 프론트엔드 | Phase 5, 6 | 7 |
| **TASK-192** | **상태 체계 E2E 테스트 (상태 전환 -> UI 반영 -> 필터 동작 -> gap-check 연동)** | **3** | `__tests__/integration/status-flow.test.ts` | Phase 2, 3, 5 | 7 |

**Phase 7 소계**: 5 TASK, 13 포인트

### 5.9 전체 포인트 & 로드맵 요약

```
총 TASK:    41개 (기존 29 + 신규 12)
총 포인트:  127포인트 (기존 92 + 신규 35)
총 Phase:   7개 (기존 6 + Phase 2 신규 삽입)
총 커밋:    14회 (Phase당 2회)

신규 TASK 목록 (12개):
  Phase 2: TASK-181~189 (9개, 28pt) - 상태값 체계 전체
  Phase 3: TASK-190 (1개, 2pt) - GapDetector 상태 필터 연동
  Phase 4: TASK-191 (1개, 2pt) - SupplementScanner 상태 필터 연동
  Phase 7: TASK-192 (1개, 3pt) - 상태 E2E 테스트
```

### 5.10 의존성 그래프 (보정 후)

```
Phase 1 (자동 저장) ─────────────────────────────────────────────┐
    │                                                            │
    ├──> Phase 2 (상태값 체계) ──┬──> Phase 3 (갭 탐지+상태)     │
    │                            │                               │
    │                            ├──> Phase 4 (보완 분석+상태)   │
    │                            │                               │
    │                            └──> Phase 5 (FE 통합)          │
    │                                     │                      │
    │                                     ├──> Phase 6 (FlowChart 탭)
    │                                     │                      │
    └─────────────────────────────────────┴──> Phase 7 (테스트 + 정리)

의존성 요약:
  Phase 1 → Phase 2 (detectAndSave 완료 후 상태 체계 도입)
  Phase 1 → Phase 3 (detectAndSave가 GapDetector 전제)
  Phase 2 → Phase 3 (상태 필터가 GapDetector에 필요)
  Phase 2 → Phase 4 (상태 필터가 SupplementScanner에 필요)
  Phase 2 → Phase 5 (상태 UI가 프론트엔드 위젯에 필요)
  Phase 3 → Phase 5 (GapDetector가 API/위젯 전제)
  Phase 4 → Phase 6 (SupplementBanner가 보완 분석 데이터 필요)
  Phase 1~6 → Phase 7 (통합 테스트는 전체 기능 완료 후)
```

### 5.11 병렬화 가능 구간

```
시간축 -->

Week 1:  [Phase 1: 자동 저장 (19pt)] ────────────>
Week 2:  [Phase 2: 상태값 체계 (28pt)] ──────────────────────>
Week 3:  [Phase 3: 갭 탐지 (20pt)] ──> || [Phase 4: 보완 분석 (18pt)] ──>
Week 4:  [Phase 5: FE 통합 (17pt)] ────────────>
Week 5:  [Phase 6: FlowChart 탭 (12pt)] ──>
Week 6:  [Phase 7: 테스트 + 정리 (13pt)] ──>
```

**병렬화 전략**:
1. **Phase 3 || Phase 4**: GapDetector와 SupplementScanner는 서로 독립적. 둘 다 Phase 1과 Phase 2에만 의존하므로 동시 진행 가능.
2. **Phase 5 내부**: TASK-168~169(API)는 Phase 3 완료 후 즉시 시작 가능. TASK-170~172(위젯)는 API 완료 후.
3. **Phase 6**: Phase 4의 TASK-166(supplement 결과 저장)만 의존하므로, Phase 5와 부분 병렬 가능.

---

## 6. 피드백 R9~R12

### R9: 상태값 TASK가 기존 TASK와 의존성 충돌 없는지

| 충돌 지점 | 분석 | 결론 |
|----------|------|:----:|
| TASK-182 vs TASK-166 (ResultSummary 확장) | TASK-182는 `status/statusChangedAt` 추가, TASK-166은 `isSupplement/supplementOf/triggerProject` 추가. 모두 optional 필드이므로 독립적으로 추가 가능. 병합 시 충돌 없음 | 충돌 없음 |
| TASK-185 vs TASK-168 (web-server.ts) | TASK-185는 `PATCH /api/results/:id/status` + `GET /api/results ?status=` 추가, TASK-168은 `GET /api/gap-check` 추가. 서로 다른 엔드포인트이므로 코드 위치 충돌 없음 | 충돌 없음 |
| TASK-184 vs TASK-160 (router.ts) | 둘 다 COMMANDS 맵에 1줄 추가. 서로 다른 key이므로 충돌 없음 | 충돌 없음 |
| TASK-190 vs TASK-158 (gap-detector.ts) | TASK-158에서 GapDetector 기본 구현, TASK-190에서 상태 필터 추가. TASK-190은 TASK-158 완료 후 수행하므로 순서가 보장됨 | 충돌 없음 (순차) |
| TASK-189 vs TASK-176 (ResultCard.tsx) | TASK-189는 상태 배지 추가, TASK-176은 보완 라벨 추가. 배지 표시 순서는 "[상태 배지] [보완] 기획서명"으로 UI 설계에서 정의됨. 코드 위치가 다르므로 병합 가능 | 충돌 없음 |
| TASK-187 vs TASK-170 (프론트엔드 타입) | TASK-187은 타입/스토어 변경, TASK-170은 GapHealthWidget 구현. TASK-187이 먼저 완료되므로 TASK-170은 확장된 타입을 바로 사용 가능 | 충돌 없음 |

**결론**: 상태값 TASK(181~192)와 기존 TASK(152~180) 사이에 의존성 충돌이 없다. 모든 신규 TASK는 "추가" 패턴으로만 기존 코드를 변경하며, Phase 순서에 따라 자연스럽게 의존성이 해소된다.

### R10: Lazy Migration 전략의 기술적 건전성

| 검토 항목 | 분석 | 건전성 |
|----------|------|:------:|
| **하위 호환성** | `status?: AnalysisStatus`로 optional 선언. 기존 인덱스 파일에 status 필드가 없어도 TypeScript 컴파일 + 런타임 모두 정상 | OK |
| **데이터 일관성** | `getEffectiveStatus()`가 모든 참조 지점에서 null/undefined를 `'active'`로 통일. 백엔드/프론트엔드/CLI 3곳에서 동일 함수 사용 | OK |
| **마이그레이션 비용** | 없음. 기존 파일 수정 불필요. 사용자가 상태를 변경할 때 비로소 status 필드가 기록됨 | OK |
| **성능 영향** | `?? 'active'` nullish coalescing은 O(1). 인메모리 배열 필터(`Array.filter`)도 O(n)으로 성능 영향 무시 가능 | OK |
| **명시적 마이그레이션** | 선택적 CLI 제공 (`result-status --project <id> --bulk --from active --to active`로 모든 기존 데이터에 명시적 status 기록 가능). 필수가 아니므로 배포 리스크 없음 | OK |
| **프론트엔드 fallback** | API 응답에 status가 없으면 `getEffectiveStatus()`로 'active' 처리. 구버전 백엔드와의 호환성도 보장 | OK |
| **인덱스 파일 크기** | status(string) + statusChangedAt(string) = 약 40~60 bytes/항목. 100개 분석 결과 기준 약 5KB 증가로 무시 가능 | OK |

**리스크 평가**: Lazy Migration 전략은 KIC의 사용 패턴(단일 사용자, 수십~수백 건의 분석 결과)에 완벽히 적합하다. 대규모 마이그레이션 스크립트가 불필요하고, 기존 사용자 경험에 영향이 없다.

**잠재 리스크**: 사용자가 status를 한 번도 변경하지 않으면 모든 데이터가 영구적으로 status 필드 없이 남을 수 있다. 이 경우에도 `getEffectiveStatus()`가 'active'를 반환하므로 기능적 문제는 없지만, 데이터 정합성 관점에서 AnalysisHistoryTable의 "상태" 컬럼에 "진행중"이 표시되면서 사용자가 상태 체계를 자연스럽게 인지하게 되므로 실질적 리스크는 낮다.

### R11: 전체 포인트가 합리적인지 (너무 크지 않은지)

| Phase | 포인트 | 평가 | 근거 |
|:-----:|:-----:|:----:|------|
| Phase 1 | 19 | 적절 | 기존 설계 유지. 개발자 리뷰에서 3일 예상 |
| Phase 2 | 28 | **주의** | 신규 Phase 중 최대. 다만 백엔드 타입/유틸(7pt) + API(6pt) + 프론트엔드(10pt) + 테스트(5pt)로 분해 시 각 파트가 합리적 |
| Phase 3 | 20 | 적절 | 기존 18pt + 상태 연동 2pt. GapDetector 자체가 5pt로 복잡도 반영 |
| Phase 4 | 18 | 적절 | 기존 16pt + 상태 연동 2pt |
| Phase 5 | 17 | 적절 | 기존 설계 유지 |
| Phase 6 | 12 | 적절 | 후순위. 기존 설계 유지 |
| Phase 7 | 13 | 적절 | 기존 10pt + E2E 테스트 3pt |
| **합계** | **127** | 적절 | 기존 92pt 대비 +35pt (38% 증가). 상태 체계 전체 도입 비용으로 합리적 |

**Phase 2 세부 검토 (28pt)**:

| 영역 | TASK | 포인트 | 과대 여부 |
|------|------|:-----:|:---------:|
| 타입/유틸 | TASK-181 | 2 | 적절 (타입 정의 + 유틸 함수) |
| ResultSummary 확장 | TASK-182 | 2 | 적절 (optional 필드 추가) |
| ResultManager 메서드 | TASK-183 | 3 | 적절 (updateStatus + findByAnalysisId 2개 메서드) |
| CLI 명령어 | TASK-184 | 3 | 적절 (새 Command 클래스) |
| API 엔드포인트 | TASK-185 | 3 | 적절 (PATCH + GET 쿼리 파라미터) |
| 백엔드 테스트 | TASK-186 | 5 | 적절 (전환 규칙 조합 테스트가 많음) |
| 프론트엔드 타입/스토어 | TASK-187 | 2 | 적절 |
| 공통 컴포넌트 3종 | TASK-188 | 5 | 적절 (StatusBadge + StatusDropdown + ArchiveConfirmDialog) |
| LNB + ResultCard | TASK-189 | 3 | 적절 (필터 로직 + 상태별 스타일) |

**결론**: 전체 127pt는 상태 체계라는 횡단 관심사(cross-cutting concern)를 백엔드 타입부터 프론트엔드 UI까지 일관되게 도입하는 비용으로 합리적이다. Phase 2의 28pt가 최대이지만, 세부 TASK별로 과대한 항목은 없다.

### R12: Phase 간 병렬화 가능성 재검토

| 병렬 조합 | 가능 여부 | 근거 |
|----------|:---------:|------|
| Phase 1 \|\| Phase 2 | **불가** | Phase 2는 Phase 1의 ResultSummary 확장에 의존하지 않지만, Phase 2의 TASK-182가 save-result 변경을 포함하므로 Phase 1의 save-result hook(TASK-155)과 동일 파일을 수정한다. 순차 진행이 안전 |
| Phase 3 \|\| Phase 4 | **가능** | GapDetector와 SupplementScanner는 완전 독립. 서로 다른 데이터를 읽기만 한다 |
| Phase 5 \|\| Phase 6 | **부분 가능** | Phase 5의 API(TASK-168~169)와 Phase 6의 CrossProjectTabs(TASK-173~174)는 독립적. 다만 Phase 6의 TASK-176(SupplementBanner)은 Phase 4의 TASK-166에 의존 |
| Phase 2 \|\| Phase 3 | **불가** | Phase 3의 TASK-190(상태 필터 연동)이 Phase 2의 TASK-181(AnalysisStatus 타입)에 의존 |
| Phase 2 내부 병렬화 | **부분 가능** | TASK-181~186(백엔드)과 TASK-187~189(프론트엔드)는 TASK-185(API) 완료 후 프론트엔드 작업 시작. 백엔드 내에서는 순차 |

**최적 실행 계획**:

```
Week 1:  Phase 1 (자동 저장)
Week 2:  Phase 2 (상태값 체계) - 백엔드 먼저 (TASK-181~186)
Week 3:  Phase 2 FE (TASK-187~189)  ||  Phase 3 (갭 탐지, TASK-158~162)
Week 4:  Phase 3 나머지 (TASK-190)  ||  Phase 4 (보완 분석)
Week 5:  Phase 5 (FE 통합)
Week 6:  Phase 6 (FlowChart 탭) + Phase 7 (테스트 + 정리)
```

**병렬화로 단축 가능한 기간**: Phase 3과 4의 병렬화로 약 0.5~1주 단축. Phase 2 FE와 Phase 3의 부분 병렬화로 추가 0.5주 단축. 총 최대 1.5주 단축 가능.

---

## 7. 변경 영향 요약 (Module Impact Map 보정)

기존 기술 설계 Section 1.1의 Module Impact Map에 상태 관련 변경을 추가한다.

```
신규/변경 파일 (상태 체계):

Backend (src/):
  src/types/analysis.ts                            [L] AnalysisStatus 타입 추가
  src/utils/analysis-status.ts                     [M] 신규 유틸 (getEffectiveStatus, VALID_TRANSITIONS, isValidTransition)
  src/core/analysis/result-manager.ts              [M] status/statusChangedAt 필드 + updateStatus() + findByAnalysisId()
  src/commands/result-status.ts                    [H] 신규 CLI 명령어
  src/commands/save-result.ts                      [L] 저장 시 기본 status: 'active' 설정 (1줄)
  src/router.ts                                    [L] result-status 등록 (1줄)
  src/server/web-server.ts                         [M] PATCH /api/results/:id/status + GET ?status= 필터
  src/core/cross-project/gap-detector.ts           [L] 상태 필터 적용 (TASK-190)
  src/core/cross-project/supplement-scanner.ts     [L] 상태 필터 적용 (TASK-191)
  SKILL.md                                         [L] 상태 자연어 매핑 추가

Frontend (web/):
  web/src/types/index.ts                           [L] AnalysisStatus 타입 + ResultSummary 필드 추가
  web/src/utils/status.ts                          [M] 신규 유틸 (getEffectiveStatus, VALID_TRANSITIONS)
  web/src/stores/resultStore.ts                    [M] statusFilter 상태 + updateResultStatus 액션
  web/src/components/common/StatusBadge.tsx         [H] 신규 공통 컴포넌트
  web/src/components/common/StatusDropdown.tsx      [H] 신규 공통 컴포넌트
  web/src/components/common/ArchiveConfirmDialog.tsx [H] 신규 공통 컴포넌트
  web/src/components/layout/LNB.tsx                [M] 상태 필터 드롭다운 추가
  web/src/components/layout/ResultCard.tsx          [M] 상태별 배지/스타일/opacity
  web/src/components/project-board/AnalysisHistoryTable.tsx [M] 상태 컬럼 + 필터 칩 + 인라인 변경
  web/src/pages/Dashboard.tsx                      [M] ScoreHeader 상태 드롭다운 추가
```

---

## 8. AC-TASK 역매핑 (상태 관련 추가분)

| AC ID | 기준 | 검증 TASK |
|:-----:|------|:---------:|
| AC-015-S-1 | 신규 분석 저장 시 status: 'active' 기본값 | TASK-186 |
| AC-015-S-2 | result-status CLI로 상태 변경 | TASK-186 |
| AC-015-S-3 | archived -> 다른 상태 전환 시 에러 | TASK-186 |
| AC-015-S-4 | status 없는 기존 데이터 active 간주 | TASK-186 |
| AC-015-S-5 | PATCH API 유효 전환만 허용 | TASK-186 |
| AC-015-S-6 | LNB 상태 배지 표시 | TASK-192 |
| AC-015-S-7 | 상세 패널 상태 변경 | TASK-192 |
| AC-015-2-6 | completed 분석 보완 제안 제외 | TASK-191 |
| AC-015-2-7 | 보완 제안 시 제외 건수 표시 | TASK-191 |
| AC-015-3-7 | completed 분석 gap 제외 | TASK-190 |
| AC-015-3-8 | gap-check 상태별 제외 건수 표시 | TASK-190 |

---

## 9. Open Items 결정 사항 추가

기존 기술 설계 Section 8의 Open Items에 추가:

| # | 질문 | 결정 | 근거 |
|:-:|------|------|------|
| 10.1 | 기존 데이터 마이그레이션 방안 | **Lazy Migration** | `getEffectiveStatus()`로 런타임 처리. 기존 파일 수정 불필요. R10에서 건전성 확인 완료 |
| 10.2 | 기본 상태값 정책 | **모든 신규 분석 = active** | save-result에서 기본값 설정. 보완 분석도 active로 생성 |
| 10.3 | 상태 전환 중 파일 잠금 | **불필요** | 개발자 리뷰 Section 4.1.1의 의견 채택. 단일 사용자 CLI 도구에서 동시 접근 리스크 극히 낮음 |
| 10.4 | AnalysisHistoryTable 상태 변경 방식 | **인라인 드롭다운** | UI 설계 Section 3.6. 컨텍스트 메뉴 대신 인라인 드롭다운으로 확정 (1클릭 접근) |
| 10.5 | 일괄 상태 변경 (bulk) | **Phase 2에서는 미구현, CLI만 제공** | PRD 6.4절의 `--bulk` 옵션은 Phase 2 범위 외. 필요시 별도 TASK 추가 |

---

## 10. 자체 검토 이력

### R9 상세 (의존성 충돌 검토)

- [x] TASK-182 vs TASK-166: ResultSummary에 서로 다른 optional 필드 추가. 충돌 없음
- [x] TASK-185 vs TASK-168: 서로 다른 API 엔드포인트. 충돌 없음
- [x] TASK-184 vs TASK-160: router.ts에 서로 다른 명령어 등록. 충돌 없음
- [x] TASK-190 vs TASK-158: 순차 관계 (TASK-158 완료 후 TASK-190). 충돌 없음
- [x] TASK-189 vs TASK-176: ResultCard에 서로 다른 배지 추가. UI 설계에서 순서 정의됨
- [x] 결론: 12개 신규 TASK 모두 기존 29개 TASK와 의존성 충돌 없음 확인

### R10 상세 (Lazy Migration)

- [x] 하위 호환성: optional 필드로 기존 데이터 파싱 에러 없음
- [x] 데이터 일관성: getEffectiveStatus()가 백엔드/프론트엔드/CLI 3곳에서 동일 동작
- [x] 마이그레이션 비용: 없음. 즉시 배포 가능
- [x] 성능 영향: 무시 가능 (nullish coalescing O(1))
- [x] 잠재 리스크: 사용자가 상태를 변경하지 않아도 기능적 문제 없음

### R11 상세 (포인트 합리성)

- [x] Phase 2 (28pt): 9개 TASK 세부 검토 완료. 과대 항목 없음
- [x] 전체 127pt: 기존 92pt 대비 38% 증가. 상태 체계 횡단 관심사 도입 비용으로 합리적
- [x] 가장 큰 단일 TASK: TASK-186 (5pt, 백엔드 테스트), TASK-188 (5pt, 공통 컴포넌트 3종). 각각 내용 대비 적절

### R12 상세 (병렬화)

- [x] Phase 3 || Phase 4: 완전 독립 병렬 가능. ~1주 단축
- [x] Phase 2 FE || Phase 3: Phase 2 백엔드 완료 후 부분 병렬. ~0.5주 단축
- [x] Phase 5 || Phase 6: Phase 5의 API 파트와 Phase 6의 CrossProjectTabs 병렬 가능
- [x] 총 단축 가능: ~1.5주
- [x] 크리티컬 패스: Phase 1 -> Phase 2 -> Phase 3 -> Phase 5 -> Phase 7 (가장 긴 경로)
