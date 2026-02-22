# REQ-015 개발자 최종 검토서: 분석 결과 상태(Status) 체계 보완

> **작성자**: 풀스택 개발자
> **기반 문서**:
>   - 상태값 PRD: `REQ-015-supplement-analysis-status.md`
>   - 상태값 UI 설계: `REQ-015-status-ui-design.md`
>   - TPO 기술 보정: `REQ-015-status-technical-update.md`
>   - 기존 개발자 리뷰: `REQ-015-dev-review.md`
> **상태**: 최종 검토 완료 (Final Review Complete)
> **최종 갱신**: 2026-02-22

---

## 0. 요약

PM/디자이너/TPO가 설계한 상태값(Status) 체계에 대해, 실제 코드 레벨에서 구현 가능성과 영향 범위를 검증하였다. 전체적으로 설계가 정확하고 구현 가능하다. 아래 검토 항목별로 상세 소견을 기술한다.

---

## 1. 상태값 구현 코드 레벨 검증

### 1.1 ResultSummary에 status 필드 추가 시 기존 save/load 영향

**대상 파일**: `src/core/analysis/result-manager.ts` (line 12~28, line 56~82, line 130~143)

**현재 ResultSummary 타입** (line 13~28):

```typescript
export interface ResultSummary {
  id: string;
  specTitle: string;
  analyzedAt: string;
  totalScore: number;
  grade: string;
  affectedScreenCount: number;
  taskCount: number;
}
```

**변경 사항**: `status?: AnalysisStatus`와 `statusChangedAt?: string`을 optional로 추가.

**영향 분석**:

| 메서드 | 위치 (line) | 영향 | 대응 |
|--------|:----------:|------|------|
| `save()` | 56~82 | **직접 영향**. `updateIndex()`에 전달하는 객체 리터럴(line 70~78)에 `status: 'active'` 추가 필요 | TASK-182에서 1줄 추가 |
| `list()` | 130~143 | **영향 없음**. `readJsonFile<ResultSummary[]>`가 JSON을 그대로 반환하므로 optional 필드 부재 시 undefined로 처리됨 | 변경 불필요 |
| `getLatest()` | 89~99 | **영향 없음**. `list()` 결과를 정렬만 함 | 변경 불필요 |
| `getById()` | 107~123 | **영향 없음**. 개별 결과 JSON 파일 읽기만 함 | 변경 불필요 |
| `updateIndex()` | 148~168 | **핵심 검토 대상** (아래 1.2절 상세) | 수정 필요 |

**`save()` 메서드 구체적 변경 (line 70~78)**:

현재 코드:
```typescript
await this.updateIndex(projectId, {
  id: resultId,
  specTitle: title || result.specTitle,
  analyzedAt: result.analyzedAt,
  totalScore: result.totalScore,
  grade: result.grade,
  affectedScreenCount: result.affectedScreens.length,
  taskCount: result.tasks.length,
});
```

변경 후:
```typescript
await this.updateIndex(projectId, {
  id: resultId,
  specTitle: title || result.specTitle,
  analyzedAt: result.analyzedAt,
  totalScore: result.totalScore,
  grade: result.grade,
  affectedScreenCount: result.affectedScreens.length,
  taskCount: result.tasks.length,
  status: 'active',                        // 신규
  statusChangedAt: new Date().toISOString(), // 신규
});
```

**리스크**: 매우 낮음. optional 필드 2개 추가로 기존 JSON 파일 파싱에 영향 없음.

### 1.2 updateIndex()에서 status 필드 보존 로직

**현재 updateIndex() 코드** (line 148~168):

```typescript
private async updateIndex(
  projectId: string,
  summary: ResultSummary,
): Promise<void> {
  const indexPath = this.getIndexPath(projectId);
  let summaries: ResultSummary[] = [];

  if (fs.existsSync(indexPath)) {
    summaries = readJsonFile<ResultSummary[]>(indexPath) || [];
  }

  const existingIndex = summaries.findIndex(s => s.id === summary.id);
  if (existingIndex >= 0) {
    summaries[existingIndex] = summary; // <- 전체 교체
  } else {
    summaries.push(summary);
  }

  writeJsonFile(indexPath, summaries);
}
```

**문제점 발견**: line 162에서 `summaries[existingIndex] = summary`는 기존 항목을 **전체 교체**한다. 이는 현재는 문제가 없지만, status 필드 도입 후에는 **위험**하다.

시나리오:
1. 사용자가 분석 결과의 status를 `completed`로 변경 (인덱스 파일에 `status: 'completed'` 기록)
2. 같은 analysisId로 `save()`가 재실행됨 (예: 재분석)
3. `updateIndex()`에서 전체 교체되면서 `status`가 `save()`에서 전달한 `'active'`로 덮어씌워짐

**대응 방안 (권장)**:

`updateIndex()`에서 기존 항목 업데이트 시 status/statusChangedAt을 보존해야 한다:

```typescript
if (existingIndex >= 0) {
  // 기존 status/statusChangedAt 보존
  const existing = summaries[existingIndex];
  summaries[existingIndex] = {
    ...summary,
    status: summary.status ?? existing.status,
    statusChangedAt: summary.statusChangedAt ?? existing.statusChangedAt,
  };
} else {
  summaries.push(summary);
}
```

이렇게 하면 `save()`에서 명시적으로 status를 전달하지 않으면 기존 status가 유지된다. 신규 저장 시에는 `save()`에서 `status: 'active'`를 명시적으로 전달하므로 기본값도 올바르게 설정된다.

**이 수정은 TASK-182에 포함해야 한다. TPO 설계에서 이 엣지 케이스가 누락되어 있다.**

### 1.3 getEffectiveStatus() 코드 위치와 호출 패턴

TPO 설계에서 `src/utils/analysis-status.ts` (신규 파일)에 배치하기로 했다.

**검증 결과**: 올바른 위치다. 이유:
- `src/utils/` 디렉토리는 이미 `file.ts`, `logger.ts`, `validators.ts` 등 공용 유틸이 위치
- `getEffectiveStatus()`는 result-manager, CLI 명령어, 웹 서버, 프론트엔드에서 모두 사용되므로 공용 유틸이 적절
- `result-manager.ts` 내부에 넣으면 순환 의존 위험이 있음 (result-manager를 import하는 다른 모듈이 많음)

**호출 패턴 매핑**:

| 호출 위치 | 파일 | 용도 |
|----------|------|------|
| save-result 후처리 | `src/commands/save-result.ts` | 기본 status 설정 시에는 불필요 (항상 'active') |
| result-status CLI | `src/commands/result-status.ts` | 현재 상태 판단 -> 전환 규칙 검증 |
| PATCH API | `src/server/web-server.ts` | 현재 상태 판단 -> 전환 규칙 검증 |
| GET API status 필터 | `src/server/web-server.ts` | 목록 필터링 시 실효 상태 비교 |
| GapDetector | `src/core/cross-project/gap-detector.ts` | active 필터링 |
| SupplementScanner | `src/core/cross-project/supplement-scanner.ts` | active 필터링 |
| 프론트엔드 | `web/src/utils/status.ts` | LNB 필터, ResultCard 스타일, StatusBadge 렌더링 |

프론트엔드용은 별도 파일(`web/src/utils/status.ts`)에 동일 구현을 배치한다. 백엔드/프론트엔드 간 타입을 직접 import할 수 없으므로 이는 올바른 접근이다.

---

## 2. API 구현 상세

### 2.1 PATCH /api/results/:id/status 구현 위치

**파일**: `src/server/web-server.ts`
**삽입 위치**: line 264 (`GET /api/results/:id` 핸들러 종료) 이후, line 266 (`GET /api/checklist/:resultId` 시작) 이전

이 위치를 선택하는 이유:
- results 관련 API 그룹에 속함
- Express v5에서 라우트 순서가 중요: `PATCH /api/results/:id/status`가 `GET /api/results/:id` 이후에 등록되어야 충돌 없음
- Express v5 라우팅에서 `PATCH` vs `GET`은 HTTP 메서드가 다르므로 같은 경로여도 충돌하지 않지만, `:id/status`는 더 구체적인 경로이므로 문제 없음

**Express v5 라우트 등록 순서 검증**:

현재 results 관련 라우트:
```
GET  /api/results          (line 192)
GET  /api/results/latest   (line 212)
GET  /api/results/:id      (line 238)
```

추가할 라우트:
```
PATCH /api/results/:id/status  (line 264 이후 삽입)
```

Express v5에서 `GET /api/results/:id`와 `PATCH /api/results/:id/status`는 메서드가 다르고 경로도 다르므로 (/status 접미사) 충돌 없음. 검증 완료.

**주의**: `PATCH` 요청을 받으려면 `express.json()` 미들웨어가 필요한데, 이미 line 183에 `app.use(express.json())`이 등록되어 있으므로 추가 설정 불필요.

### 2.2 GET /api/results에 status 쿼리 파라미터 추가

**파일**: `src/server/web-server.ts`, line 192~207

**현재 코드**:
```typescript
app.get('/api/results', async (req: Request, res: Response) => {
  try {
    const projectId = await ctx.getActiveProjectId(req.query.projectId as string);
    if (!projectId) {
      res.json({ results: [], message: 'No active project' });
      return;
    }
    const results = await resultManager.list(projectId);
    res.json({ results });
  } catch (error) { ... }
});
```

**변경**:
```typescript
const results = await resultManager.list(projectId);

// 상태 필터링 (신규)
const statusFilter = req.query.status as string | undefined;
let filteredResults = results;
if (statusFilter && statusFilter !== 'all') {
  filteredResults = results.filter(s => getEffectiveStatus(s) === statusFilter);
}

res.json({ results: filteredResults });
```

**하위 호환성**: `?status=` 파라미터가 없으면 모든 상태를 반환한다. 기존 프론트엔드(`fetchAllResults()`)에서 `fetch('/api/results')`로 호출하므로 (resultStore.ts line 83), status 파라미터 없이 호출되어 기존 동작이 100% 보존된다.

### 2.3 에러 응답 코드 설계

| 상황 | HTTP 상태 | 응답 body | 근거 |
|------|:---------:|----------|------|
| 유효하지 않은 status 값 (예: "unknown") | `400` | `{ error: "Invalid status: unknown" }` | 클라이언트 입력 오류 |
| 존재하지 않는 analysisId | `404` | `{ error: "Analysis not found: xxx" }` | 리소스 부재 |
| 금지된 전환 (archived -> active) | `400` | `{ error: "폐기된 분석은 상태를 변경할 수 없습니다." }` | 비즈니스 규칙 위반도 400 |
| 금지된 전환 (completed -> active) | `400` | `{ error: "완료된 분석은 재활성화할 수 없습니다. 보완 분석을 실행해주세요." }` | 안내 메시지 포함 |
| 서버 내부 에러 | `500` | `{ error: "Failed to update result status" }` | 일반 서버 에러 |

**설계 의견**: TPO 설계와 동일한 응답 코드 체계이며 적절하다. 다만 **한 가지 추가 제안**이 있다:

- 성공 응답(200)에 `previousStatus` 필드를 추가하면 프론트엔드에서 토스트 메시지("진행중 -> 완료")를 생성할 때 별도 상태 관리 없이 API 응답만으로 구성 가능하다:

```typescript
res.json({
  id: analysisId,
  previousStatus: currentStatus,  // 추가 제안
  status: updatedSummary.status,
  statusChangedAt: updatedSummary.statusChangedAt,
});
```

---

## 3. 프론트엔드 구현 상세

### 3.1 resultStore 변경사항 상세

**파일**: `web/src/stores/resultStore.ts`

**현재 상태**: ResultState 인터페이스에 14개 필드가 있음 (line 14~55).

**추가할 필드 3개**:

```typescript
interface ResultState {
  // ... 기존 필드 ...

  /** LNB 상태 필터 (신규) */
  statusFilter: 'active' | 'active+on-hold' | 'all';
  /** LNB 상태 필터 설정 (신규) */
  setStatusFilter: (filter: 'active' | 'active+on-hold' | 'all') => void;
  /** 분석 결과 상태 변경 API 호출 (신규) */
  updateResultStatus: (analysisId: string, newStatus: AnalysisStatus) => Promise<void>;
}
```

**persist 미들웨어 영향** (line 121~126):

현재 `partialize`에서 `sortBy`만 영속화하고 있다. `statusFilter`도 사용자 선호 설정이므로 영속화 대상에 추가해야 한다:

```typescript
partialize: (state) => ({
  sortBy: state.sortBy,
  statusFilter: state.statusFilter,  // 추가
}),
```

**`fetchAllResults()` 변경** (line 80~92):

현재 `/api/results`를 호출하지만, statusFilter에 따라 서버 사이드 필터링을 적용할지 클라이언트 사이드 필터링을 적용할지 결정해야 한다.

**권장: 클라이언트 사이드 필터링**.
- 이유: 결과 목록 전체를 받아 두고 LNB에서 실시간 필터링하는 것이 UX가 더 좋다 (필터 변경 시 추가 API 호출 불필요)
- `fetchAllResults()`는 기존 그대로 전체 결과를 가져오고, LNB 컴포넌트에서 `getEffectiveStatus()` 필터링을 적용한다

### 3.2 StatusBadge, StatusDropdown, ArchiveConfirmDialog 컴포넌트 설계

#### StatusBadge

**사용 위치**: ResultCard, AnalysisHistoryTable, Dashboard ScoreHeader
**핵심 설계 포인트**:

- `active` 상태일 때 `null`을 반환하여 렌더링하지 않음 (설계 원칙 1: 기본 상태 최소 표현)
- `size` prop으로 LNB용(sm)과 테이블/대시보드용(md) 크기 구분
- 현재 ResultCard의 `[예시]` 배지 패턴(line 86~90)과 동일한 CSS 구조 사용

```typescript
// ResultCard.tsx line 86~90의 기존 배지 패턴:
<span className="inline-flex items-center px-1.5 py-0.5 mr-1 text-xs font-medium
  bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
  예시
</span>
```

StatusBadge는 이 패턴을 그대로 따르되 색상만 변경하므로 시각적 일관성이 보장된다.

**코드에서 확인한 실제 사항**:
- `ResultCard.tsx`에서 `result.isDemo` 체크로 `[예시]` 배지를 조건부 렌더링 (line 86)
- 같은 위치에 `status` 기반 배지를 추가하면 된다 (line 85~91 영역)
- dark mode 지원도 기존 패턴(`dark:bg-purple-900 dark:text-purple-300`)을 참고하여 상태 배지에도 동일 적용

#### StatusDropdown

**핵심 설계 포인트**:

- `VALID_TRANSITIONS` 맵을 프론트엔드에 배치하여 서버 왕복 없이 UI에서 옵션을 제한
- `archived` 상태일 때 드롭다운 대신 정적 배지만 렌더링 (`cursor-not-allowed`)
- 드롭다운 외부 클릭 시 닫힘 처리 필요 (기존 LNB의 select 패턴 참고)

**기존 코드에서 드롭다운 패턴 확인**:
- `LNB.tsx` line 191~201에 `<select>` 기반 정렬 드롭다운이 있음
- StatusDropdown은 커스텀 드롭다운(div 기반)이 더 적합 (옵션별 아이콘, 비활성 옵션, 구분선 필요)
- `useRef` + `useEffect`로 외부 클릭 감지하는 패턴을 사용

#### ArchiveConfirmDialog

**핵심 설계 포인트**:

- 모달 오버레이: `fixed inset-0 bg-black/50 z-50`
- 현재 프로젝트에서 모달 컴포넌트가 없으므로 이것이 첫 모달이 됨
- `role="alertdialog"`, `aria-labelledby`, `aria-describedby`로 접근성 보장
- ESC 키로 닫기 기능 추가
- 폐기 버튼에 `bg-red-600` 사용 (위험한 액션의 시각적 경고)

### 3.3 LNB 필터와 AnalysisHistoryTable 필터의 상태 동기화

**문제**: LNB의 상태 필터(드롭다운)와 AnalysisHistoryTable의 필터(칩)가 독립적으로 동작하면 사용자 혼란이 발생할 수 있다.

**현재 코드 분석**:
- LNB는 `resultStore.statusFilter`를 사용 (신규)
- AnalysisHistoryTable은 `results` prop을 부모(`ProjectBoard`)에서 받음 (line 11~14)
- AnalysisHistoryTable 자체의 필터 칩은 **로컬 상태**로 관리 (UI 설계 Section 4.4)

**동기화 전략 (권장)**:

동기화하지 않는 것이 맞다. 이유:
1. LNB는 **기획 분석 대시보드** 페이지(`/analysis`)에서 사용
2. AnalysisHistoryTable은 **프로젝트 보드** 페이지(`/projects/:id`)에서 사용
3. 두 페이지는 동시에 표시되지 않으므로 필터 동기화가 불필요
4. 각 컴포넌트가 독립적으로 필터를 관리하는 것이 더 직관적

**다만 주의점**: AnalysisHistoryTable의 필터 칩 기본값은 `[전체]` (UI 설계 Section 4.4 line 401)이지만, LNB 필터 기본값은 `[진행중만]` (UI 설계 Section 2.5 line 163)이다. 이 차이는 의도적이다:
- LNB: 기획 분석 시 active만 보는 것이 기본 워크플로
- 프로젝트 보드: 전체 이력을 한눈에 보는 것이 기본 워크플로

---

## 4. 전체 로드맵 의견

### 4.1 41 TASK / 127pt 합리성 평가

**결론**: 합리적이다.

| 기준 | 분석 | 판단 |
|------|------|:----:|
| 총 TASK 수 (41) | 기존 29 + 신규 12. 신규 TASK 평균 2.9pt/TASK로 적절한 세분화 | 적절 |
| 총 포인트 (127pt) | 기존 92pt + 35pt(38% 증가). 상태 체계는 백엔드 타입~프론트엔드 UI 전체를 관통하는 횡단 관심사이므로 35pt 추가는 합리적 | 적절 |
| Phase 2 (28pt) | 9개 TASK. 백엔드 14pt + 프론트엔드 10pt + 테스트 5pt로 분해 시 각각 적절 | 적절 |
| 가장 큰 TASK | TASK-186, TASK-188 각 5pt. 전환 규칙 조합 테스트와 공통 컴포넌트 3종은 5pt 수준의 복잡도 | 적절 |

### 4.2 Phase 순서 최적화 의견

현재 TPO가 설계한 Phase 순서: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

**개발자 관점 최적화 제안**:

Phase 1(자동 저장)과 Phase 2(상태값 체계) 사이에 **의존성이 약하다**. 이유:

- Phase 1의 핵심은 `detectAndSave()`와 `save-result` 후처리 hook
- Phase 2의 핵심은 `ResultSummary.status` 필드와 API/UI
- Phase 2는 Phase 1의 `detectAndSave()`에 의존하지 않음
- 유일한 연결점: TASK-182(ResultSummary 확장)가 `save-result.ts`를 수정하는데, Phase 1의 TASK-155도 `save-result.ts`를 수정

따라서 **Phase 1과 Phase 2를 병렬화할 수는 없지만** (같은 파일 수정), Phase 2를 Phase 1보다 **먼저 시작**하는 것은 가능하다. 상태값 체계가 독립적인 기능이기 때문이다.

**그러나 현재 순서를 유지하는 것을 권장**한다:
1. Phase 1 완료 후 Phase 2를 시작하면 save-result.ts의 병합 충돌을 완전히 피할 수 있음
2. Phase 1 -> 2 -> 3||4 -> 5 -> 6 -> 7 순서가 가장 안전한 크리티컬 패스

### 4.3 개발자 관점 추가 리스크

#### 리스크 1: findByAnalysisId()의 성능

TPO 설계의 `findByAnalysisId()` (Section 2.1)는 **모든 프로젝트의 인덱스를 순회**하여 analysisId를 찾는다.

현재 코드에서 `projects.json` 로드 패턴:
```typescript
const projectsPath = path.join(this.basePath, 'projects.json');
const config = readJsonFile<ProjectsConfig>(projectsPath);
```

프로젝트 수가 10개 이하일 때는 문제 없지만, 확장성 관점에서 **analysisId -> projectId 역매핑 캐시**를 고려할 수 있다. 다만 현재 4개 프로젝트 환경에서는 성능 이슈가 없으므로, 향후 프로젝트 10+ 시 별도 최적화 TASK로 추가하면 된다.

**리스크 수준**: 낮음 (현재), 중간 (향후 확장 시)

#### 리스크 2: isValidId() 함수의 analysisId 검증

현재 `web-server.ts`의 `isValidId()` (line 31~33):
```typescript
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
```

`analysisId`의 형식이 `analysis-1708012800000` (analysis- + timestamp)이므로 이 정규식에 문제 없다. `on-hold`의 하이픈도 허용된다. 검증 완료.

#### 리스크 3: 프론트엔드 타입 동기화

`web/src/types/index.ts`의 `ResultSummary` (line 165~175)에는 현재 `status` 필드가 없다. TASK-187에서 추가해야 한다.

주의: 프론트엔드의 `ResultSummary`에는 `isDemo?: boolean` (line 174)이 있지만 백엔드의 `ResultSummary`에는 없다. 이는 프론트엔드에서 mock 데이터를 위해 추가한 필드이다. 마찬가지로 `status?`도 프론트엔드에서 optional로 추가하면 되므로 기존 패턴과 일관적이다.

#### 리스크 4: LNB의 mock 데이터와 상태 필터 상호작용

`LNB.tsx` line 75~76에서 mock 데이터를 resultList에 추가한다:
```typescript
const mockSummary = useMemo(() => getMockResultSummary(), []);
const allResults = useMemo(() => [...resultList, mockSummary], [resultList, mockSummary]);
```

mock 데이터(`getMockResultSummary()`)에는 `status` 필드가 없을 것이다. `getEffectiveStatus()`가 `'active'`를 반환하므로 "진행중만" 필터에서 mock 데이터가 정상 표시된다. 문제 없음.

---

## 5. 사용자 요청 "MVP 이후도 잘 챙겨줘" 대응

### 5.1 후순위 Phase(4, 6)의 구현 보장 방안

Phase 4 (보완 분석)와 Phase 6 (플로우차트 탭)이 후순위이지만, 사용자가 명시적으로 "삭제하지 말고 반영해줘"라고 요청했다.

**보장 방안 3가지**:

1. **TASK 목록에 명시적으로 유지**: TPO 문서 Section 5.7에 Phase 6이 삭제되지 않고 유지되어 있음. 이 문서가 존재하는 한 Phase 6은 로드맵에서 탈락하지 않는다.

2. **Phase 7(테스트+정리)에 통합 테스트 포함**: TASK-179 (보완 분석 통합 테스트)가 Phase 7에 있으므로, Phase 4가 완료되지 않으면 Phase 7도 완료할 수 없다. 이 의존성이 Phase 4 누락을 방지하는 안전장치가 된다.

3. **session-state.json에 Phase 완료 상태 기록**: 드림팀 세션 상태 파일에 각 Phase의 완료 여부를 기록하면, 세션 복원 시 미완료 Phase를 자동 안내할 수 있다.

### 5.2 후순위 TASK를 놓치지 않기 위한 체크포인트 제안

| 체크포인트 | 시점 | 확인 내용 |
|-----------|------|----------|
| CP-1 | Phase 5 완료 후 | "Phase 4(보완 분석) 시작 준비 완료. Phase 4 진행할까요?" |
| CP-2 | Phase 4 완료 후 | "Phase 6(플로우차트 탭) 시작 준비 완료. Phase 6 진행할까요?" |
| CP-3 | Phase 6 완료 후 | "Phase 7(통합 테스트) 진입. 전체 Phase 1~6 기능 검증 시작" |
| CP-4 | Phase 7 내부 | TASK-179 실행 시: "보완 분석 통합 테스트 - Phase 4 결과 활용" |
| CP-5 | 전체 완료 | 41 TASK 전체 체크리스트 최종 확인 (누락 0건 검증) |

**구현 방법**: 각 Phase 시작 시 사용자에게 명시적으로 보고하고, Phase 전환 시 미완료 TASK가 있으면 경고한다.

---

## 6. 피드백 R13~R15

### R13: 41 TASK 중 불필요한 건은 없는지 (과도한 분리?)

**결론: 불필요한 TASK는 없으나, 1건 병합 제안이 있다.**

| TASK | 평가 | 의견 |
|:----:|:----:|------|
| TASK-181 | 필수 | AnalysisStatus 타입 + VALID_TRANSITIONS. 다른 모든 상태 TASK의 전제 조건 |
| TASK-182 | 필수 | ResultSummary 확장 + save-result 기본값. 데이터 모델 변경의 핵심 |
| TASK-183 | 필수 | updateStatus() + findByAnalysisId(). CLI/API 양쪽에서 사용 |
| TASK-184 | 필수 | result-status CLI. 사용자가 터미널에서 상태 변경 |
| TASK-185 | 필수 | PATCH API + GET 필터. 프론트엔드의 전제 조건 |
| TASK-186 | 필수 | 백엔드 테스트. 전환 규칙 조합이 많으므로 5pt 적절 |
| TASK-187 | 필수 | 프론트엔드 타입/스토어. TASK-188의 전제 조건 |
| TASK-188 | 필수 | 공통 컴포넌트 3종. 여러 페이지에서 재사용 |
| TASK-189 | 필수 | LNB + ResultCard 통합. 최종 사용자 접점 |
| TASK-190 | 필수 | GapDetector 상태 연동. 2pt로 간결. 별도 TASK가 맞음 (Phase 3 의존) |
| TASK-191 | 필수 | SupplementScanner 상태 연동. 2pt로 간결. 별도 TASK가 맞음 (Phase 4 의존) |
| TASK-192 | 필수 | E2E 테스트. 상태 전환 전체 흐름 검증에 3pt 적절 |

**병합 검토**:

- TASK-181 + TASK-182 병합 가능성: 둘 다 타입/인터페이스 변경이므로 하나로 합칠 수 있다. 그러나 TASK-181은 `src/types/analysis.ts`와 `src/utils/analysis-status.ts`를, TASK-182는 `src/core/analysis/result-manager.ts`와 `src/commands/save-result.ts`를 수정하므로 **변경 파일이 완전히 다르다**. 별도 TASK 유지가 올바르다.

- TASK-184 + TASK-185 병합 가능성: CLI 명령어와 API 엔드포인트를 하나로 합칠 수 있으나, CLI는 `src/commands/`, API는 `src/server/`로 레이어가 다르다. 테스트 관점에서도 분리가 유리하다.

**최종**: 41 TASK 전부 유지. 과도한 분리 없음.

### R14: 상태값 관련 테스트가 충분한지

**테스트 커버리지 매핑**:

| AC ID | 테스트 위치 | 케이스 | 충분성 |
|:-----:|-----------|:------:|:------:|
| AC-015-S-1 (신규 분석 active 기본값) | TASK-186 | save-result 후 index.json에 status='active' 확인 | 충분 |
| AC-015-S-2 (CLI 상태 변경) | TASK-186 | result-status 실행 -> 인덱스 파일 변경 확인 | 충분 |
| AC-015-S-3 (archived 전환 차단) | TASK-186 | archived -> active 시도 -> 에러 확인 | 충분 |
| AC-015-S-4 (기존 데이터 active 간주) | TASK-186 | status 없는 mock -> getEffectiveStatus() 반환값 확인 | 충분 |
| AC-015-S-5 (API 유효 전환만) | TASK-186 | PATCH 요청: 유효/무효 전환 -> 200/400 확인 | 충분 |
| AC-015-S-6 (LNB 배지 표시) | TASK-192 | mock 데이터 -> StatusBadge 렌더링 확인 | 충분 |
| AC-015-S-7 (상세 패널 상태 변경) | TASK-192 | StatusDropdown 선택 -> API 호출 -> UI 반영 | 충분 |

**누락 우려 테스트 케이스 (추가 제안)**:

1. **updateIndex() status 보존 테스트**: 1.2절에서 발견한 엣지 케이스. status가 completed인 분석을 재분석(save)해도 status가 유지되는지 검증.
   - TASK-186에 포함 권장

2. **프론트엔드 StatusDropdown 전환 규칙 테스트**: VALID_TRANSITIONS 맵에 따라 불가능한 옵션이 렌더링되지 않는지 검증.
   - TASK-192에 포함 권장 (단위 테스트)

3. **LNB 필터 + mock 데이터 상호작용**: status 필드 없는 mock 데이터가 "진행중만" 필터에서 정상 표시되는지.
   - TASK-189에 포함 권장

4. **동시 상태 변경 (race condition)**: 같은 분석에 대해 두 브라우저 탭에서 동시에 상태를 변경하는 경우. 단일 사용자 도구이므로 실질적 리스크는 낮지만, 테스트 1건 추가로 방어 가능.
   - 후순위 (MVP 이후)

**총평**: 기존 테스트 계획 + 위 추가 3건이면 상태값 체계의 테스트 커버리지는 충분하다.

### R15: 최종 사용자 시나리오 검증

**전체 흐름**: "기획서 분석 -> 상태 관리 -> 신규 프로젝트 -> 보완 분석 -> 플로우차트 전체 확인"

#### 단계별 검증

**1단계: 기획서 분석**
```
사용자: /kic -> 기획서 분석 실행 -> save-result
코드 경로: save-result.ts execute() -> resultManager.save() -> updateIndex()
결과: index.json에 status: 'active' 기록
```
- 끊김 없음. save() 메서드에서 status:'active'를 명시적으로 전달하면 정상 동작.

**2단계: 상태 관리**
```
사용자: 대시보드에서 "완료 처리" 클릭
코드 경로: StatusDropdown onClick -> updateResultStatus() -> PATCH /api/results/:id/status
  -> resultManager.updateStatus() -> writeJsonFile()
프론트엔드: resultStore.resultList 업데이트 -> LNB/테이블 리렌더링
```
- 끊김 없음. PATCH API가 인덱스 파일을 직접 수정하고, 프론트엔드 스토어의 낙관적 업데이트(optimistic update)로 즉시 반영.

**3단계: 신규 프로젝트 등록**
```
사용자: /impact init (신규 프로젝트)
코드 경로: init.ts execute() -> 인덱싱 -> 프로젝트 등록
  -> [Phase 1 완료 후] runCrossProjectHook() -> detectAndSave()
  -> [Phase 4 완료 후] SupplementScanner.scan() -> active 필터링 -> 보완 분석 안내
```
- Phase 4 이전: SupplementScanner가 없으므로 보완 분석 안내 단계가 생략됨 (정상)
- Phase 4 이후: active 상태 분석만 보완 대상으로 필터링됨 (2단계에서 completed로 변경한 분석은 제외)

**4단계: 보완 분석**
```
사용자: 보완 분석 실행 (SupplementScanner가 제안한 항목)
코드 경로: cross-analyze --supplement -> 결과 저장 -> save-result (status: 'active')
결과: 보완 분석 결과가 active로 생성. 원본과 독립 라이프사이클.
```
- 끊김 없음. PRD 4.2절의 엣지 케이스 "원본이 completed인데 보완 분석이 active"가 정상 시나리오로 처리됨.

**5단계: 플로우차트 전체 확인**
```
사용자: 대시보드 -> 플로우차트 "전체" 모드
코드 경로: FlowChart.tsx -> /api/cross-project/links -> CrossProjectDiagram 렌더링
```
- 끊김 없음. 크로스 프로젝트 데이터는 status와 무관하게 전체 링크를 표시 (PRD R5: REQ-015-1은 status 필터 미적용).

#### 잠재적 끊김 지점 (발견 1건)

**5단계에서 GapHealthWidget의 데이터 갱신**:

사용자가 2단계에서 분석을 completed로 변경한 후, 프로젝트 보드의 GapHealthWidget은 **별도 새로고침이 필요**하다 (UI 설계 Section 7.2: "GapHealthWidget: 변경 없음, 별도 새로고침 필요").

이는 상태 변경 직후 프로젝트 보드로 이동했을 때 GapHealthWidget이 이전 데이터를 보여줄 수 있다는 의미이다.

**완화 방안**: GapHealthWidget에 "마지막 확인: X분 전" 표시 + 수동 새로고침 버튼이 이미 설계되어 있으므로 (UI 설계 Section 5.2), 사용자가 인지하고 갱신할 수 있다. 실시간 동기화는 MVP 범위 외.

---

## 7. 결론

### 7.1 전체 평가

| 항목 | 평가 |
|------|:----:|
| 상태값 체계 설계 (PRD) | 합격 |
| UI 설계 (디자이너) | 합격 |
| 기술 설계 보정 (TPO) | 합격 (1건 보완 필요) |
| TASK 분류 및 포인트 | 합격 |
| 테스트 커버리지 | 합격 (3건 추가 권장) |
| 사용자 시나리오 | 합격 (끊김 없음) |

### 7.2 구현 전 필수 보완 사항 (1건)

| # | 내용 | 관련 TASK | 긴급도 |
|:-:|------|:---------:|:------:|
| 1 | `updateIndex()` 에서 기존 status/statusChangedAt 보존 로직 추가 (Section 1.2) | TASK-182 | 높음 |

이 수정 없이 진행하면, 재분석 시 사용자가 변경한 status가 'active'로 덮어씌워지는 버그가 발생한다.

### 7.3 추가 권장 사항 (4건)

| # | 내용 | 관련 TASK | 우선순위 |
|:-:|------|:---------:|:-------:|
| 1 | PATCH 성공 응답에 `previousStatus` 필드 추가 (Section 2.3) | TASK-185 | 낮음 |
| 2 | resultStore persist에 statusFilter 추가 (Section 3.1) | TASK-187 | 중간 |
| 3 | 추가 테스트 케이스 3건 (Section R14) | TASK-186, 189, 192 | 중간 |
| 4 | findByAnalysisId() 성능 모니터링 (프로젝트 10+시 최적화) | 별도 TASK | 낮음 |

### 7.4 구현 승인

위 필수 보완 사항 1건을 TASK-182에 반영하는 것을 전제로, **41 TASK / 127pt 전체 로드맵의 구현을 승인**한다. Phase 1부터 순차 진행하면 된다.
