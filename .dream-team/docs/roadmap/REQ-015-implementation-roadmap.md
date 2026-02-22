# REQ-015: 크로스 프로젝트 자동 영향도 분석 + 상태값 체계 -- 구현 로드맵

> **작성 기준일**: 2026-02-22
> **총 TASK**: 41개 (TASK-152 ~ TASK-192)
> **총 포인트**: 127pt
> **총 Phase**: 7개

---

## 1. 개요

### 1.1 목적

기획서 분석 시 등록된 모든 프로젝트를 자동으로 검토하여 크로스 프로젝트 영향도를 파악하고, 신규 프로젝트 추가 시 기존 분석의 누락을 보완하며, 영향도 파악 누락을 빠르게 탐지하고 해결하는 자동화 체계를 구축한다. 추가로, 분석 결과에 상태값(active/completed/on-hold/archived)을 도입하여 보완 분석 대상 필터링과 gap 탐지 정밀도를 향상시킨다.

### 1.2 배경

현재 KIC에는 4개 프로젝트가 등록되어 있고, `CrossProjectManager.detectLinks()` 메서드가 3가지 감지(API 경로/공유 테이블/공유 이벤트)를 구현하고 있다. 그러나:

- 분석 결과가 `cross-project.json`에 자동 저장되지 않아 플로우차트 "전체" 모드가 빈 화면을 표시
- 신규 프로젝트 추가 시 기존 분석 결과에 대한 보완 경로가 없음
- 분석 결과의 라이프사이클(진행 중/완료/보류/폐기) 관리가 없어 보완 분석 제안이 비효율적

### 1.3 핵심 요구사항 요약

| # | 요구사항 | 핵심 |
|:-:|---------|------|
| 1 | 분석 시 전체 프로젝트 자동 검토 + 플로우차트 전체 모드 연동 | `detectAndSave()` + `save-result` 후처리 hook |
| 2 | 신규 프로젝트 등록 시 보완 분석 (active 상태만) | `SupplementScanner` + 상태 필터링 |
| 3 | 영향도 누락 탐지 & 해결 + 대시보드 위젯 | `GapDetector` + `GapHealthWidget` |
| 4 | 분석 결과 상태값 체계 도입 | `AnalysisStatus` 타입 + CLI/API/UI |

---

## 2. 요구사항 요약

### REQ-015-1: 분석 시 전체 프로젝트 자동 검토

- `save-result` 명령어 실행 후, 등록 프로젝트가 2개 이상이면 `detectLinks()`를 자동 실행하여 `cross-project.json`에 저장
- `--detect-links --auto-save` CLI 옵션 추가 (기존 `--detect-links` 동작 유지)
- `--skip-cross-detect` 옵션으로 후처리 비활성화 가능
- 기존 수동 등록 링크(`autoDetected: false`)는 보존, 자동 감지 링크는 매번 최신 결과로 교체
- SKILL.md에 Step 4.5 추가 (크로스 프로젝트 의존성 자동 갱신)

### REQ-015-2: 신규 프로젝트 등록 시 보완 분석 (active 상태만)

- `init` 명령어 완료 후 기존 분석 결과를 스캔하여 매칭도 20% 이상인 항목에 대해 보완 분석 제안
- **active 상태인 분석 결과만** 보완 분석 대상으로 필터링 (completed/on-hold/archived 제외)
- 보완 분석 결과는 `supplement-{originalAnalysisId}.json` 형식으로 별도 저장
- `cross-analyze --supplement --project <id>` CLI 명령어 추가

### REQ-015-3: 영향도 누락 탐지 & 해결

- `GapDetector` 클래스로 4가지 유형의 누락 탐지: Stale 링크(High), 미분석 프로젝트(Medium), 저신뢰도 분석(Medium), 인덱스 미갱신(Low)
- `gap-check` CLI 명령어 + `--fix` 자동 해결 + `--project <id>` 필터
- `/api/gap-check` API 엔드포인트 + 프로젝트 보드 `GapHealthWidget`
- 저신뢰도/Stale 링크 탐지는 **active 상태 분석만** 대상

### REQ-015-4: 분석 결과 상태값 체계 (active/completed/on-hold/archived)

- 4가지 상태: active(진행 중), completed(완료), on-hold(보류), archived(폐기)
- 상태 전환 규칙: `VALID_TRANSITIONS` 맵으로 관리. archived는 단방향(되돌릴 수 없음)
- `result-status` CLI 명령어 + `PATCH /api/results/:id/status` API
- LNB 상태 필터 드롭다운, ResultCard 상태 배지, AnalysisHistoryTable 상태 컬럼/필터 칩
- Lazy Migration 전략: `getEffectiveStatus()` 함수로 status 필드 없는 기존 데이터를 'active'로 간주

---

## 3. 아키텍처 변경 요약

### 3.1 수정 모듈 목록

| 모듈 | 변경 수준 | 상세 |
|------|:---------:|------|
| `src/core/cross-project/cross-project-manager.ts` | M | `detectAndSave()` 신규 메서드 추가 |
| `src/commands/projects.ts` | M | `--auto-save` 분기 추가 |
| `src/commands/save-result.ts` | M | 후처리 hook + 기본 status:'active' 설정 |
| `src/commands/init.ts` | M | 보완 분석 스캔 hook + active 필터링 |
| `src/commands/cross-analyze.ts` | M | `--supplement` 옵션 추가 |
| `src/router.ts` | L | `gap-check`, `result-status` 명령어 등록 |
| `src/server/web-server.ts` | M | `/api/gap-check`, `PATCH /api/results/:id/status`, `GET /api/results?status=` |
| `src/core/analysis/result-manager.ts` | M | status/statusChangedAt 필드 + `updateStatus()` + `findByAnalysisId()` + updateIndex() status 보존 |
| `src/types/analysis.ts` | L | `AnalysisStatus` 타입 + supplement 필드 추가 |
| `src/core/cross-project/types.ts` | L | `GapItem`, `GapDetail` 타입 추가 |
| `SKILL.md` | M | Step 4.5 + 자연어 매핑 테이블 + 상태 관련 명령어 |
| `web/src/types/index.ts` | L | `AnalysisStatus` 타입 + `ResultSummary` 필드 추가 |
| `web/src/stores/resultStore.ts` | M | `statusFilter` 상태 + `updateResultStatus` 액션 |
| `web/src/components/layout/LNB.tsx` | M | 상태 필터 드롭다운 추가 |
| `web/src/components/layout/ResultCard.tsx` | M | 상태별 배지/스타일 + `[보완]` 라벨 |
| `web/src/components/project-board/AnalysisHistoryTable.tsx` | M | 상태 컬럼 + 필터 칩 + 인라인 상태 변경 + `[보완]` 배지 |
| `web/src/pages/Dashboard.tsx` | M | ScoreHeader 상태 드롭다운 + SupplementBanner |
| `web/src/pages/ProjectBoard.tsx` | M | GapHealthWidget 삽입 |
| `web/src/pages/FlowChart.tsx` | M | CrossProjectTabs 사용 |
| `web/src/components/cross-project/CrossProjectDiagram.tsx` | L | hover 하이라이트 + onNodeClick |

### 3.2 신규 모듈 목록

| 모듈 | 경로 | 역할 |
|------|------|------|
| GapDetector | `src/core/cross-project/gap-detector.ts` | 4가지 유형의 영향도 누락 탐지 엔진 |
| GapCheckCommand | `src/commands/gap-check.ts` | `gap-check` CLI 명령어 핸들러 |
| ResultStatusCommand | `src/commands/result-status.ts` | `result-status` CLI 명령어 핸들러 |
| SupplementScanner | `src/core/cross-project/supplement-scanner.ts` | 보완 분석 후보 스캔 |
| analysis-status 유틸 | `src/utils/analysis-status.ts` | `getEffectiveStatus()`, `VALID_TRANSITIONS`, `isValidTransition()` |
| 프론트엔드 status 유틸 | `web/src/utils/status.ts` | 프론트엔드용 `getEffectiveStatus()`, `VALID_TRANSITIONS` |
| GapHealthWidget | `web/src/components/projects/GapHealthWidget.tsx` | 프로젝트 보드 건강 상태 위젯 |
| GapDetailList | `web/src/components/projects/GapDetailList.tsx` | Gap 상세 목록 (Widget 하위) |
| CrossProjectTabs | `web/src/components/cross-project/CrossProjectTabs.tsx` | 플로우차트 "전체" 모드 4탭 컨테이너 |
| SupplementBanner | `web/src/components/dashboard/SupplementBanner.tsx` | 보완 분석 원본 참조 배너 |
| StatusBadge | `web/src/components/common/StatusBadge.tsx` | 재사용 가능한 상태 배지 |
| StatusDropdown | `web/src/components/common/StatusDropdown.tsx` | 상태 변경 드롭다운 (전환 규칙 내장) |
| ArchiveConfirmDialog | `web/src/components/common/ArchiveConfirmDialog.tsx` | 폐기 확인 다이얼로그 |

### 3.3 데이터 흐름 변경

**기존 (As-Is)**:
```
분석 실행 -> save-result -> ResultManager.save() -> 끝
                                                     (cross-project.json 비어있음)
                                                     (플로우차트 "전체" 모드 빈 화면)
```

**변경 후 (To-Be)**:
```
분석 실행 -> save-result -> ResultManager.save() [status: 'active' 기본값]
                |
            [후처리 hook]
                |
            등록 프로젝트 >= 2?
                | Yes
            CrossProjectManager.detectAndSave()
                |
            cross-project.json 갱신 (autoDetected 링크)
                |
            경량 gap-check (Stale + 미분석만)
                |
            결과 사용자에게 보고

신규 프로젝트 등록:
  init -> 인덱싱 -> registerProject()
                       |
                  기존 분석 결과 스캔 (active만 필터링)
                       |
                  매칭도 계산 (parsedSpec + analysisSummary vs 신규 인덱스)
                       |
                  매칭 >= 20%인 항목 제안
                       |
                  사용자 승인 -> 보완 분석 실행
                       |
                  supplement-{id}.json 저장 [status: 'active']
                       |
                  detectAndSave() 재실행
```

---

## 4. 상태 체계 상세

### 4.1 4가지 상태 정의

| 상태 | 값 | 의미 | 보완 분석 대상 | gap 탐지 대상 |
|------|:--:|------|:--------------:|:-------------:|
| 활성 | `active` | 기획/개발 진행 중. 영향도 분석이 유효하며 지속적으로 관리 필요 | O | O |
| 완료 | `completed` | 개발 배포 완료. 분석 결과는 아카이브 참조용으로 보존 | X | X |
| 보류 | `on-hold` | 기획이 일시 보류됨. 재개 시 active로 전환 | X | X |
| 폐기 | `archived` | 기획이 취소/폐기됨. 분석 결과는 이력 보존용 | X | X |

### 4.2 전환 규칙 (VALID_TRANSITIONS)

```typescript
export const VALID_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  'active':    ['completed', 'on-hold', 'archived'],
  'completed': ['archived'],
  'on-hold':   ['active', 'archived'],
  'archived':  [],  // 단방향: 어디로도 전환 불가
};
```

**금지된 전환**:
- `archived` -> 다른 상태: 폐기는 되돌릴 수 없음 (단방향)
- `completed` -> `active`: 완료된 건의 재활성화는 보완 분석(`supplement`)으로 대체

### 4.3 Lazy Migration 전략

- `ResultSummary.status`를 optional(`?`)로 선언하여 기존 데이터와의 하위 호환성 보장
- `getEffectiveStatus()` 함수로 status 필드 부재를 `'active'`로 통일 처리
- 기존 파일 수정 불필요, 즉시 배포 가능
- 사용자가 상태를 변경할 때 비로소 `status` 필드가 인덱스 파일에 기록됨

```typescript
export function getEffectiveStatus(summary: ResultSummary): AnalysisStatus {
  return summary.status ?? 'active';
}
```

---

## 5. 전체 TASK 목록

### 5.1 TASK 일람 테이블 (TASK-152 ~ TASK-192)

| TASK | 제목 | Phase | PT | 영향 파일 | 의존 TASK | AC 매핑 |
|:----:|------|:-----:|:--:|----------|:---------:|---------|
| TASK-152 | CrossProjectManager.detectAndSave() 구현 | 1 | 3 | `cross-project-manager.ts` | - | AC-015-1-1, AC-015-1-2 |
| TASK-153 | detectAndSave() 단위 테스트 | 1 | 3 | `__tests__/cross-project-manager.test.ts` | TASK-152 | AC-015-1-2 |
| TASK-154 | projects --detect-links --auto-save 옵션 추가 | 1 | 2 | `projects.ts` | TASK-152 | AC-015-1-3, AC-015-1-4 |
| TASK-155 | save-result 후처리 hook 구현 | 1 | 3 | `save-result.ts` | TASK-152 | AC-015-1-1 |
| TASK-156 | save-result hook 단위 테스트 (성공/실패/skip) | 1 | 3 | `__tests__/save-result.test.ts` | TASK-155 | AC-015-1-1, AC-015-1-6 |
| TASK-157 | --skip-cross-detect 옵션 + 기존 동작 회귀 테스트 | 1 | 5 | `save-result.ts`, `projects.ts` | TASK-155, TASK-154 | AC-015-1-3, AC-015-1-7 |
| TASK-158 | GapDetector 클래스 구현 (4가지 탐지 유형) | 3 | 5 | `gap-detector.ts`, `types.ts` | TASK-152 | AC-015-3-1 |
| TASK-159 | GapDetector 단위 테스트 (유형별 mock) | 3 | 5 | `__tests__/gap-detector.test.ts` | TASK-158 | AC-015-3-1, AC-015-3-2, AC-015-3-6 |
| TASK-160 | gap-check CLI 명령어 + router 등록 | 3 | 3 | `gap-check.ts`, `router.ts` | TASK-158 | - |
| TASK-161 | gap-check --fix 자동 해결 모드 | 3 | 3 | `gap-detector.ts`, `gap-check.ts` | TASK-160 | AC-015-3-2 |
| TASK-162 | gap-check --project 필터 + CLI 통합 테스트 | 3 | 2 | `__tests__/gap-check.test.ts` | TASK-161 | AC-015-3-3 |
| TASK-163 | SupplementScanner 클래스 구현 | 4 | 3 | `supplement-scanner.ts` | - | - |
| TASK-164 | init 명령어 보완 분석 스캔 hook 추가 | 4 | 3 | `init.ts` | TASK-163 | AC-015-2-1, AC-015-2-4 |
| TASK-165 | cross-analyze --supplement --project 옵션 | 4 | 3 | `cross-analyze.ts` | TASK-163 | AC-015-2-5 |
| TASK-166 | ResultManager supplement 결과 저장/조회 지원 | 4 | 3 | `result-manager.ts`, `analysis.ts` | - | AC-015-2-2, AC-015-2-3 |
| TASK-167 | 보완 분석 단위 테스트 + 통합 테스트 | 4 | 4 | `__tests__/supplement*.test.ts` | TASK-164, TASK-165, TASK-166 | AC-015-2-1~2-5 |
| TASK-168 | /api/gap-check 엔드포인트 구현 | 5 | 3 | `web-server.ts` | TASK-158 | AC-015-3-4 |
| TASK-169 | /api/gap-check API 테스트 | 5 | 2 | `__tests__/web-server.test.ts` | TASK-168 | AC-015-3-4 |
| TASK-170 | GapHealthWidget + GapDetailList 구현 | 5 | 5 | `GapHealthWidget.tsx`, `GapDetailList.tsx` | TASK-168 | AC-015-3-5 |
| TASK-171 | ProjectBoard에 GapHealthWidget 통합 | 5 | 2 | `ProjectBoard.tsx` | TASK-170 | AC-015-3-5 |
| TASK-172 | GapHealthWidget 프론트엔드 테스트 (Vitest) | 5 | 5 | `__tests__/GapHealthWidget.test.tsx` | TASK-171 | AC-015-3-5 |
| TASK-173 | CrossProjectTabs 컴포넌트 구현 (4탭) | 6 | 3 | `CrossProjectTabs.tsx` | - | AC-015-1-5 |
| TASK-174 | FlowChart에서 CrossProjectTabs 통합 | 6 | 3 | `FlowChart.tsx` | TASK-173 | AC-015-1-5 |
| TASK-175 | CrossProjectDiagram hover 하이라이트 + 노드 클릭 | 6 | 3 | `CrossProjectDiagram.tsx` | TASK-174 | - |
| TASK-176 | 보완 분석 UI (SupplementBanner + ResultCard 라벨) | 6 | 3 | `SupplementBanner.tsx`, `ResultCard.tsx`, `AnalysisHistoryTable.tsx`, `Dashboard.tsx` | TASK-166 | - |
| TASK-177 | SKILL.md Step 4.5 + Step 2.5 강화 + 자연어 매핑 (상태 명령어 포함) | 7 | 2 | `SKILL.md` | TASK-157, TASK-184 | - |
| TASK-178 | 통합 테스트: save-result -> cross-project 갱신 -> FlowChart | 7 | 3 | `__tests__/integration/cross-project-flow.test.ts` | Phase 1~5 전체 | AC-015-1-5 |
| TASK-179 | 통합 테스트: init -> 보완 분석 스캔 -> supplement 저장 | 7 | 3 | `__tests__/integration/supplement-flow.test.ts` | Phase 4 | - |
| TASK-180 | 빈 상태/에러 상태 QA + 접근성 최종 점검 | 7 | 2 | 전체 프론트엔드 | Phase 5, 6 | - |
| TASK-181 | AnalysisStatus 타입 + VALID_TRANSITIONS 맵 + getEffectiveStatus() 유틸 | 2 | 2 | `src/types/analysis.ts`, `src/utils/analysis-status.ts` | - | AC-015-S-4 |
| TASK-182 | ResultSummary에 status/statusChangedAt 필드 추가 + save-result 기본값 'active' + updateIndex() status 보존 | 2 | 2 | `src/core/analysis/result-manager.ts`, `src/commands/save-result.ts` | TASK-181 | AC-015-S-1 |
| TASK-183 | ResultManager.updateStatus() + findByAnalysisId() 메서드 구현 | 2 | 3 | `src/core/analysis/result-manager.ts` | TASK-182 | AC-015-S-2 |
| TASK-184 | result-status CLI 명령어 + router 등록 | 2 | 3 | `src/commands/result-status.ts`, `src/router.ts` | TASK-183 | AC-015-S-2, AC-015-S-3 |
| TASK-185 | PATCH /api/results/:id/status 엔드포인트 + GET /api/results ?status= 필터 | 2 | 3 | `src/server/web-server.ts` | TASK-183 | AC-015-S-5 |
| TASK-186 | 백엔드 상태 체계 단위 테스트 (전환 규칙, 금지 전환, Lazy Migration, updateIndex status 보존) | 2 | 5 | `__tests__/analysis-status.test.ts`, `__tests__/result-status.test.ts` | TASK-184, TASK-185 | AC-015-S-1~S-5 |
| TASK-187 | 프론트엔드 AnalysisStatus 타입 + getEffectiveStatus() + resultStore statusFilter | 2 | 2 | `web/src/types/index.ts`, `web/src/utils/status.ts`, `web/src/stores/resultStore.ts` | TASK-185 | - |
| TASK-188 | StatusBadge + StatusDropdown + ArchiveConfirmDialog 공통 컴포넌트 | 2 | 5 | `web/src/components/common/StatusBadge.tsx`, `StatusDropdown.tsx`, `ArchiveConfirmDialog.tsx` | TASK-187 | AC-015-S-6, AC-015-S-7 |
| TASK-189 | LNB 상태 필터 드롭다운 + ResultCard 상태별 스타일 | 2 | 3 | `web/src/components/layout/LNB.tsx`, `ResultCard.tsx` | TASK-188 | AC-015-S-6 |
| TASK-190 | GapDetector 상태 필터 연동 (active만 탐지 + excludedCounts 통계) | 3 | 2 | `gap-detector.ts` | TASK-158, TASK-181 | AC-015-3-7, AC-015-3-8 |
| TASK-191 | SupplementScanner 상태 필터 연동 (active만 스캔 + 제외 건수 표시) | 4 | 2 | `supplement-scanner.ts`, `init.ts` | TASK-163, TASK-181 | AC-015-2-6, AC-015-2-7 |
| TASK-192 | 상태 체계 E2E 테스트 (상태 전환 -> UI 반영 -> 필터 동작 -> gap-check 연동) | 7 | 3 | `__tests__/integration/status-flow.test.ts` | Phase 2, 3, 5 | AC-015-S-6, AC-015-S-7 |

---

## 6. Phase별 구현 계획

### 6.1 Phase 1: 자동 저장 (TASK-152~157, 19pt)

**목표**: `cross-project.json`에 크로스 프로젝트 의존성을 자동으로 감지/저장하여 플로우차트 "전체" 모드에 데이터를 제공한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-152 | CrossProjectManager.detectAndSave() 구현 | 3 | - |
| TASK-153 | detectAndSave() 단위 테스트 | 3 | 152 |
| TASK-154 | projects --detect-links --auto-save 옵션 추가 | 2 | 152 |
| TASK-155 | save-result 후처리 hook 구현 | 3 | 152 |
| TASK-156 | save-result hook 단위 테스트 (성공/실패/skip) | 3 | 155 |
| TASK-157 | --skip-cross-detect 옵션 + 기존 동작 회귀 테스트 | 5 | 154, 155 |

**커밋 포인트**:
1. TASK-153 완료 후: `feat(REQ-015): detectAndSave() 구현 및 테스트`
2. TASK-157 완료 후: `feat(REQ-015): save-result 후처리 hook + CLI 옵션`

**예상 소요**: 3일

**체크포인트**:
- `save-result` 실행 후 `cross-project.json`에 autoDetected 링크가 저장되는지 확인
- `--skip-cross-detect` 옵션으로 후처리를 비활성화할 수 있는지 확인
- 기존 `--detect-links` (without `--auto-save`) 동작이 변경되지 않았는지 회귀 확인

---

### 6.2 Phase 2: 상태값 체계 (TASK-181~189, 28pt)

**목표**: 분석 결과에 상태(active/completed/on-hold/archived)를 부여하여 라이프사이클을 관리하고, CLI/API/대시보드에서 상태를 변경 및 필터링할 수 있게 한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-181 | AnalysisStatus 타입 + VALID_TRANSITIONS 맵 + getEffectiveStatus() 유틸 | 2 | - |
| TASK-182 | ResultSummary에 status/statusChangedAt 필드 추가 + save-result 기본값 + updateIndex() status 보존 | 2 | 181 |
| TASK-183 | ResultManager.updateStatus() + findByAnalysisId() 메서드 구현 | 3 | 182 |
| TASK-184 | result-status CLI 명령어 + router 등록 | 3 | 183 |
| TASK-185 | PATCH /api/results/:id/status + GET /api/results ?status= 필터 | 3 | 183 |
| TASK-186 | 백엔드 상태 체계 단위 테스트 | 5 | 184, 185 |
| TASK-187 | 프론트엔드 AnalysisStatus 타입 + getEffectiveStatus() + resultStore statusFilter | 2 | 185 |
| TASK-188 | StatusBadge + StatusDropdown + ArchiveConfirmDialog 공통 컴포넌트 | 5 | 187 |
| TASK-189 | LNB 상태 필터 드롭다운 + ResultCard 상태별 스타일 | 3 | 188 |

**커밋 포인트**:
1. TASK-186 완료 후: `feat(REQ-015): 분석 결과 상태값 체계 백엔드 구현`
2. TASK-189 완료 후: `feat(REQ-015): 상태값 체계 프론트엔드 통합`

**예상 소요**: 5일 (백엔드 3일 + 프론트엔드 2일)

**핵심 주의사항**:
- TASK-182에서 `updateIndex()`의 기존 status/statusChangedAt 보존 로직을 반드시 포함해야 한다. 미포함 시 재분석 시 사용자가 변경한 status가 'active'로 덮어씌워지는 버그 발생 (개발자 리뷰 Section 1.2에서 발견)

**체크포인트**:
- 신규 분석 결과에 `status: 'active'`가 기본값으로 설정되는지 확인
- `archived` -> 다른 상태 전환 시도 시 에러 반환 확인
- status 필드 없는 기존 데이터가 'active'로 정상 간주되는지 확인
- LNB에서 상태별 필터링이 동작하는지 확인

---

### 6.3 Phase 3: 갭 탐지 + 상태 연동 (TASK-158~162, TASK-190, 20pt)

**목표**: `GapDetector`로 4가지 유형의 영향도 누락을 탐지하고, active 상태 분석만을 대상으로 필터링한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-158 | GapDetector 클래스 구현 (4가지 탐지 유형) | 5 | 152 |
| TASK-159 | GapDetector 단위 테스트 (유형별 mock) | 5 | 158 |
| TASK-160 | gap-check CLI 명령어 + router 등록 | 3 | 158 |
| TASK-161 | gap-check --fix 자동 해결 모드 | 3 | 160 |
| TASK-162 | gap-check --project 필터 + CLI 통합 테스트 | 2 | 161 |
| TASK-190 | GapDetector 상태 필터 연동 (active만 탐지 + excludedCounts 통계) | 2 | 158, 181 |

**커밋 포인트**:
1. TASK-159 완료 후: `feat(REQ-015): GapDetector 4유형 누락 탐지 구현`
2. TASK-162 + TASK-190 완료 후: `feat(REQ-015): gap-check CLI + 상태 필터 연동`

**예상 소요**: 3일

**탐지 알고리즘 요약**:
- **Stale 링크 (High)**: link.confirmedAt < 인덱스 meta.updatedAt, 또는 프로젝트 삭제/미존재
- **미분석 프로젝트 (Medium)**: cross-project.json links에 한 번도 등장하지 않는 프로젝트
- **저신뢰도 분석 (Medium)**: totalScore < 60인 결과 (active만 대상)
- **인덱스 미갱신 (Low)**: git log -1 날짜 > meta.updatedAt

**체크포인트**:
- 4가지 유형의 누락이 정확히 탐지되는지 확인
- `--fix` 모드에서 해결 가능한 항목(Stale 링크, 재감지)이 자동 해결되는지 확인
- completed/on-hold/archived 분석이 저신뢰도/Stale 링크 탐지에서 제외되는지 확인

---

### 6.4 Phase 4: 보완 분석 + 상태 연동 (TASK-163~167, TASK-191, 18pt)

**목표**: 신규 프로젝트 등록 시 기존 active 분석과의 매칭을 스캔하고, 보완 분석 결과를 별도 저장한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-163 | SupplementScanner 클래스 구현 | 3 | - |
| TASK-164 | init 명령어 보완 분석 스캔 hook 추가 | 3 | 163 |
| TASK-165 | cross-analyze --supplement --project 옵션 | 3 | 163 |
| TASK-166 | ResultManager supplement 결과 저장/조회 지원 | 3 | - |
| TASK-167 | 보완 분석 단위 테스트 + 통합 테스트 | 4 | 164, 165, 166 |
| TASK-191 | SupplementScanner 상태 필터 연동 (active만 스캔 + 제외 건수 표시) | 2 | 163, 181 |

**커밋 포인트**:
1. TASK-166 완료 후: `feat(REQ-015): SupplementScanner + ResultManager supplement 지원`
2. TASK-167 + TASK-191 완료 후: `feat(REQ-015): 보완 분석 CLI + 상태 필터 연동`

**예상 소요**: 3일

**매칭도 계산**: `parsedSpec.keywords` + `analysisSummary.keyFindings`와 신규 프로젝트 인덱스(screens, apis, components)를 비교. 50% 이상 자동 포함, 20~49% 확인 필요, 20% 미만 제외.

**체크포인트**:
- active 상태 분석만 보완 분석 대상으로 필터링되는지 확인
- 보완 분석 결과가 `supplement-{id}.json`으로 별도 저장되는지 확인
- 기존 분석 결과 파일이 보완 분석에 의해 수정되지 않는지 확인

---

### 6.5 Phase 5: FE 통합 (TASK-168~172, 17pt)

**목표**: `/api/gap-check` API와 GapHealthWidget을 프로젝트 보드에 통합하여 누락 현황을 대시보드에서 확인할 수 있게 한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-168 | /api/gap-check 엔드포인트 구현 | 3 | 158 |
| TASK-169 | /api/gap-check API 테스트 | 2 | 168 |
| TASK-170 | GapHealthWidget + GapDetailList 구현 | 5 | 168 |
| TASK-171 | ProjectBoard에 GapHealthWidget 통합 | 2 | 170 |
| TASK-172 | GapHealthWidget 프론트엔드 테스트 (Vitest) | 5 | 171 |

**커밋 포인트**:
1. TASK-169 완료 후: `feat(REQ-015): /api/gap-check 엔드포인트`
2. TASK-172 완료 후: `feat(REQ-015): GapHealthWidget 대시보드 통합`

**예상 소요**: 3일

**위젯 위치**: ProjectBoard의 `ProjectStatusBanner` 아래, `AnalysisHistoryTable` 위

**주의사항**: GapDetector에서 git log를 `execSync`로 실행하면 웹 서버 요청을 블로킹할 수 있다. 웹 서버에서는 `child_process.exec`(Promise 래핑)로 비동기 처리해야 한다.

**체크포인트**:
- `/api/gap-check` API가 JSON 형식으로 누락 목록을 반환하는지 확인
- GapHealthWidget의 KPI 카드(HIGH/MEDIUM/LOW)에 정확한 건수가 표시되는지 확인
- CTA 버튼 클릭 시 CLI 명령어가 클립보드에 복사되는지 확인
- 누락 0건 시 위젯이 축소 상태로 표시되는지 확인

---

### 6.6 Phase 6: 플로우차트 탭 (TASK-173~176, 12pt)

**목표**: 플로우차트 "전체" 모드를 4개 탭(의존성, 공유엔티티, Pub/Sub, 요약)으로 개선하고, 보완 분석 UI를 구현한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-173 | CrossProjectTabs 컴포넌트 구현 (4탭) | 3 | - |
| TASK-174 | FlowChart에서 CrossProjectTabs 통합 | 3 | 173 |
| TASK-175 | CrossProjectDiagram hover 하이라이트 + 노드 클릭 | 3 | 174 |
| TASK-176 | 보완 분석 UI (SupplementBanner + ResultCard 라벨) | 3 | 166 |

**커밋 포인트**:
1. TASK-175 완료 후: `feat(REQ-015): 플로우차트 "전체" 모드 CrossProjectTabs`
2. TASK-176 완료 후: `feat(REQ-015): 보완 분석 UI (SupplementBanner + 라벨)`

**예상 소요**: 2일

**컴포넌트 재사용 매핑**:
- 의존성 탭: `CrossProjectDiagram` (hover 하이라이트 + onNodeClick 개선)
- 공유 엔티티 탭: `SharedEntityMap` (그대로 재사용)
- Pub/Sub 탭: `SharedEntityMap` (events 파트 필터링)
- 요약 탭: `CrossProjectSummary` + `ReverseSearch` (레이아웃 변경)

**체크포인트**:
- 4개 탭이 정상 전환되고 데이터가 표시되는지 확인
- 프로젝트 노드 hover 시 연결된 엣지만 하이라이트되는지 확인
- 보완 분석 결과에 `[보완]` 라벨이 표시되는지 확인

---

### 6.7 Phase 7: 테스트 + SKILL.md 정리 (TASK-177~180, TASK-192, 13pt)

**목표**: SKILL.md 프로토콜 업데이트, 통합 테스트 실행, 접근성 점검을 완료하고 전체 기능을 검증한다.

| TASK | 제목 | PT | 의존 |
|:----:|------|:--:|:----:|
| TASK-177 | SKILL.md Step 4.5 + Step 2.5 강화 + 자연어 매핑 (상태 명령어 포함) | 2 | 157, 184 |
| TASK-178 | 통합 테스트: save-result -> cross-project 갱신 -> FlowChart | 3 | Phase 1~5 |
| TASK-179 | 통합 테스트: init -> 보완 분석 스캔 -> supplement 저장 | 3 | Phase 4 |
| TASK-180 | 빈 상태/에러 상태 QA + 접근성 최종 점검 | 2 | Phase 5, 6 |
| TASK-192 | 상태 체계 E2E 테스트 (상태 전환 -> UI 반영 -> 필터 동작 -> gap-check 연동) | 3 | Phase 2, 3, 5 |

**커밋 포인트**:
1. TASK-178 완료 후: `feat(REQ-015): SKILL.md 프로토콜 + 크로스 프로젝트 통합 테스트`
2. TASK-192 완료 후: `feat(REQ-015): 상태 체계 E2E 테스트 + 접근성 점검 완료`

**예상 소요**: 2일

**체크포인트**:
- 통합 테스트: save-result -> cross-project.json 갱신 -> API 응답 검증
- 통합 테스트: init -> SupplementScanner -> supplement 저장 -> detectAndSave 재실행
- 상태 전환 E2E: 상태 변경 -> UI 배지 반영 -> 필터 동작 -> gap-check 제외 확인
- 접근성: aria-label, aria-expanded, role 속성 확인

---

## 7. 커밋 전략

### 7.1 Phase별 커밋 메시지 템플릿

| Phase | 커밋 1 | 커밋 2 |
|:-----:|--------|--------|
| 1 | `feat(REQ-015): detectAndSave() 구현 및 테스트 (TASK-152~153)` | `feat(REQ-015): save-result 후처리 hook + CLI 옵션 (TASK-154~157)` |
| 2 | `feat(REQ-015): 분석 결과 상태값 체계 백엔드 구현 (TASK-181~186)` | `feat(REQ-015): 상태값 체계 프론트엔드 통합 (TASK-187~189)` |
| 3 | `feat(REQ-015): GapDetector 4유형 누락 탐지 구현 (TASK-158~159)` | `feat(REQ-015): gap-check CLI + 상태 필터 연동 (TASK-160~162,190)` |
| 4 | `feat(REQ-015): SupplementScanner + ResultManager supplement 지원 (TASK-163,166)` | `feat(REQ-015): 보완 분석 CLI + 상태 필터 연동 (TASK-164~165,167,191)` |
| 5 | `feat(REQ-015): /api/gap-check 엔드포인트 (TASK-168~169)` | `feat(REQ-015): GapHealthWidget 대시보드 통합 (TASK-170~172)` |
| 6 | `feat(REQ-015): 플로우차트 "전체" 모드 CrossProjectTabs (TASK-173~175)` | `feat(REQ-015): 보완 분석 UI (TASK-176)` |
| 7 | `feat(REQ-015): SKILL.md 프로토콜 + 통합 테스트 (TASK-177~179)` | `feat(REQ-015): 상태 체계 E2E 테스트 + 접근성 점검 (TASK-180,192)` |

### 7.2 테스트 통과 기준

- 모든 커밋 전 root Jest 테스트(`npm test`) 통과 필수
- 프론트엔드 관련 커밋 전 web Vitest(`cd web && npm test`) 추가 통과 필수
- 커밋 후 빌드 확인: `npm run build` 성공

---

## 8. 병렬화 전략

### 8.1 병렬화 가능 구간

```
시간축 -->

Week 1:  [Phase 1: 자동 저장 (19pt)] ────────────>
Week 2:  [Phase 2: 상태값 체계 BE (14pt)] ────────>
Week 3:  [Phase 2: 상태값 체계 FE (14pt)] -> || [Phase 3: 갭 탐지 (20pt)] ->
Week 4:  [Phase 3 나머지 (TASK-190)] -> || [Phase 4: 보완 분석 (18pt)] ->
Week 5:  [Phase 5: FE 통합 (17pt)] ──────────────>
Week 6:  [Phase 6: 플로우차트 탭 (12pt)] -> [Phase 7: 테스트 + 정리 (13pt)] ->
```

### 8.2 병렬화 상세

| 병렬 조합 | 가능 여부 | 근거 |
|----------|:---------:|------|
| Phase 1 \|\| Phase 2 | 불가 | Phase 2의 TASK-182가 save-result.ts를 수정하므로 Phase 1의 TASK-155와 동일 파일 충돌 |
| Phase 3 \|\| Phase 4 | **가능** | GapDetector와 SupplementScanner는 완전 독립. 서로 다른 데이터를 읽기만 함 |
| Phase 2 FE \|\| Phase 3 | **부분 가능** | Phase 2 백엔드(TASK-181~186) 완료 후, Phase 2 FE(TASK-187~189)와 Phase 3(TASK-158~162) 동시 진행 |
| Phase 5 \|\| Phase 6 | **부분 가능** | Phase 5의 API(TASK-168~169)와 Phase 6의 CrossProjectTabs(TASK-173~174)는 독립적. TASK-176만 Phase 4의 TASK-166에 의존 |
| Phase 1 \|\| Phase 2 내부 | 불가 | save-result.ts 파일 병합 충돌 회피를 위해 순차 진행 권장 |

### 8.3 병렬화 효과

- Phase 3 || Phase 4 병렬화로 약 1주 단축
- Phase 2 FE || Phase 3 부분 병렬화로 약 0.5주 단축
- **총 최대 1.5주 단축 가능**

### 8.4 의존성 그래프

```
Phase 1 (자동 저장) ────────────────────────────────────────┐
    |                                                       |
    +---> Phase 2 (상태값 체계) --+--> Phase 3 (갭 탐지+상태) |
    |                             |                          |
    |                             +--> Phase 4 (보완 분석+상태)|
    |                             |                          |
    |                             +--> Phase 5 (FE 통합)     |
    |                                    |                   |
    |                                    +--> Phase 6 (FlowChart 탭)
    |                                    |                   |
    +------------------------------------+---> Phase 7 (테스트 + 정리)

크리티컬 패스: Phase 1 -> Phase 2 -> Phase 3 -> Phase 5 -> Phase 7
```

---

## 9. 리스크 & 주의사항

### 9.1 updateIndex() status 보존 이슈 (긴급도: 높음)

**문제**: 현재 `updateIndex()`에서 기존 항목을 전체 교체(`summaries[existingIndex] = summary`)하므로, 재분석 시 사용자가 변경한 status가 'active'로 덮어씌워질 수 있다.

**대응**: TASK-182에서 기존 status/statusChangedAt을 보존하는 로직을 반드시 포함해야 한다.

```typescript
if (existingIndex >= 0) {
  const existing = summaries[existingIndex];
  summaries[existingIndex] = {
    ...summary,
    status: summary.status ?? existing.status,
    statusChangedAt: summary.statusChangedAt ?? existing.statusChangedAt,
  };
}
```

### 9.2 detectLinks() 실행 시간

| 항목 | 상세 |
|------|------|
| 예상 시간 | 4개 프로젝트 기준 1~3초 |
| 최악 케이스 | 10+ 프로젝트, 각 1000+ API: 5~10초 |
| 완화 전략 | `--skip-cross-detect`로 비활성화, 인덱스 메타만 캐시 |

### 9.3 비동기 처리 (git log)

- GapDetector의 인덱스 미갱신 탐지에서 `git log -1 --format=%ci` 실행
- CLI: `execSync` 사용 가능 (단일 사용자, 순차 실행)
- 웹 서버: `child_process.exec` Promise 래핑으로 반드시 비동기 처리 필요 (요청 블로킹 방지)
- git 미설치/미초기화 프로젝트 대비 try-catch + timeout 2초 설정

### 9.4 cross-project.json 동시 접근

- 발생 확률 낮음 (KIC는 단일 사용자 CLI 도구)
- `writeJsonFile`이 `fs.writeFileSync` 사용하므로 OS 수준 원자적
- 파일 잠금 메커니즘은 현 시점에서 불필요. 실제 동시 접근 문제 보고 시 도입 (개발자 리뷰 권장)

### 9.5 findByAnalysisId() 성능

- 모든 프로젝트의 인덱스를 순회하여 analysisId 검색
- 4개 프로젝트에서는 문제 없으나, 10+ 프로젝트 확장 시 역매핑 캐시 고려 필요
- 현재는 별도 최적화 불필요 (향후 별도 TASK로 추가)

### 9.6 프론트엔드 API 호출 최적화

- ProjectBoard 마운트 시 기존 API + `/api/gap-check` 추가 호출
- gap-check API는 병렬 호출(`Promise.all`)
- 탭 전환 시 데이터 재호출 없음 (메모리 캐시)
- gap-check 응답 캐시 5분 TTL, 새로고침 버튼으로 강제 갱신

---

## 10. 체크포인트

### CP-1: Phase 1 + Phase 2 완료 후

- [ ] `save-result` 실행 후 `cross-project.json`에 autoDetected 링크 저장 확인
- [ ] `--skip-cross-detect` 옵션으로 후처리 비활성화 확인
- [ ] 기존 `--detect-links` 동작 회귀 테스트 통과
- [ ] 신규 분석 결과에 `status: 'active'` 기본값 설정 확인
- [ ] `result-status` CLI로 상태 변경 가능 확인
- [ ] archived -> 다른 상태 전환 차단 확인
- [ ] PATCH API 유효 전환만 허용 확인
- [ ] LNB 상태 배지 및 필터 동작 확인

### CP-2: Phase 3 + Phase 4 완료 후

- [ ] `gap-check` CLI: 4가지 유형 누락 탐지 확인
- [ ] `gap-check --fix`: 해결 가능 항목 자동 해결 확인
- [ ] completed 상태 분석이 gap 탐지에서 제외 확인
- [ ] active 상태 분석만 보완 분석 대상으로 필터링 확인
- [ ] supplement 결과 별도 저장 + 기존 결과 무변경 확인
- [ ] 제외된 건 수가 안내 메시지에 표시되는 확인

### CP-3: Phase 5 완료 후

- [ ] `/api/gap-check` API JSON 응답 스키마 검증
- [ ] GapHealthWidget KPI 카드 정확한 건수 표시
- [ ] CTA 버튼 클립보드 복사 동작 확인
- [ ] 누락 0건 시 위젯 축소 상태 확인
- [ ] API 404 시 위젯 숨김 처리 확인

### CP-4: Phase 6 완료 후

- [ ] 플로우차트 "전체" 모드 4탭 정상 전환 확인
- [ ] 프로젝트 노드 hover 하이라이트 동작 확인
- [ ] 보완 분석 결과에 `[보완]` 라벨 표시 확인
- [ ] SupplementBanner에서 원본 분석 참조 링크 동작 확인

### CP-5: Phase 7 완료 후 (전체 검증)

- [ ] 통합 테스트: save-result -> cross-project 갱신 -> API 응답 확인
- [ ] 통합 테스트: init -> 보완 스캔 -> supplement 저장 확인
- [ ] E2E 테스트: 상태 전환 -> UI 반영 -> 필터 -> gap-check 연동
- [ ] 접근성: aria-label, aria-expanded, role 속성 전체 점검
- [ ] SKILL.md Step 4.5 프로토콜 + 자연어 매핑 테이블 확인
- [ ] 41 TASK 전체 체크리스트 최종 확인 (누락 0건)

---

## 11. 참조 문서

| # | 문서 | 경로 |
|:-:|------|------|
| 1 | PRD: 크로스 프로젝트 자동 영향도 분석 | `.dream-team/docs/prd/REQ-015-cross-project-auto-analysis.md` |
| 2 | PRD 보완: 분석 결과 상태 체계 도입 | `.dream-team/docs/prd/REQ-015-supplement-analysis-status.md` |
| 3 | UX 설계: 크로스 프로젝트 자동 영향도 분석 | `.dream-team/docs/design/REQ-015-ux-design.md` |
| 4 | UI 설계: 분석 결과 상태 UI | `.dream-team/docs/design/REQ-015-status-ui-design.md` |
| 5 | 기술 설계서: 크로스 프로젝트 자동 영향도 분석 | `.dream-team/docs/technical/REQ-015-technical-review.md` |
| 6 | 기술 설계 보정: 상태값 체계 + 로드맵 재구성 | `.dream-team/docs/technical/REQ-015-status-technical-update.md` |
| 7 | 개발자 구현 검토서: 크로스 프로젝트 자동 영향도 분석 | `.dream-team/docs/technical/REQ-015-dev-review.md` |
| 8 | 개발자 최종 검토서: 상태값 체계 보완 | `.dream-team/docs/technical/REQ-015-dev-review-status-supplement.md` |
