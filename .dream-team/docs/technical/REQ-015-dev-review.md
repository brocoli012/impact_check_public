# REQ-015 개발자 구현 검토서: 크로스 프로젝트 자동 영향도 분석

> **작성자**: 풀스택 개발자
> **기반 PRD**: REQ-015-cross-project-auto-analysis.md
> **기반 UX**: REQ-015-ux-design.md
> **기반 기술 설계**: REQ-015-technical-review.md
> **상태**: 검토 완료 (Review Complete)
> **최종 갱신**: 2026-02-22

---

## 1. 코드 레벨 구현 가능성 검증

### 1.1 Phase 1: 핵심 자동화 (TASK-152 ~ TASK-157)

#### TASK-152: CrossProjectManager.detectAndSave() 구현

**대상 파일**: `src/core/cross-project/cross-project-manager.ts`
**수정 위치**: 클래스 본문 끝 (line 436 직전), 신규 메서드 추가
**난이도**: 중 (기존 코드 패턴 답습)

**구현 가능성 분석**:
- `detectLinks()` (line 243~363)가 이미 `ProjectLink[]`를 반환하므로, 래핑하여 저장하는 것은 단순한 조합 작업이다.
- `loadConfig()` (line 45~48)와 `saveConfig()` (line 54~56)가 이미 존재하므로 read-modify-write 패턴 즉시 적용 가능하다.
- `ProjectLink` 타입(types.ts line 21~36)에 `autoDetected: boolean` 필드가 이미 존재하여 수동/자동 구분 필터링이 바로 가능하다.

**코드 설계 스케치**:
```typescript
// cross-project-manager.ts, line 436 이전에 추가

interface DetectAndSaveResult {
  newLinks: number;
  preservedManualLinks: number;
  totalLinks: number;
  byType: { api: number; sharedDb: number; event: number };
}

async detectAndSave(indexer: Indexer, projectIds: string[]): Promise<DetectAndSaveResult> {
  const config = await this.loadConfig();

  // 수동 링크 분리 보존
  const manualLinks = config.links.filter(l => !l.autoDetected);

  // 자동 감지 실행 (기존 detectLinks 재사용)
  const detectedLinks = await this.detectLinks(indexer, projectIds);

  // 수동 링크 + 자동 감지 링크 병합 (중복 제거)
  const mergedLinks = [...manualLinks];
  for (const detected of detectedLinks) {
    const isDuplicate = mergedLinks.some(
      m => m.source === detected.source && m.target === detected.target
    );
    if (!isDuplicate) {
      mergedLinks.push({ ...detected, confirmedAt: new Date().toISOString() });
    }
  }

  config.links = mergedLinks;
  await this.saveConfig(config);

  return {
    newLinks: detectedLinks.length,
    preservedManualLinks: manualLinks.length,
    totalLinks: mergedLinks.length,
    byType: {
      api: detectedLinks.filter(l => l.type === 'api-consumer').length,
      sharedDb: detectedLinks.filter(l => l.type === 'shared-db').length,
      event: detectedLinks.filter(l => l.type.startsWith('event-')).length,
    },
  };
}
```

**리스크**: 낮음. 기존 공개 메서드(detectLinks, loadConfig, saveConfig)만 사용하며 내부 상태 변경 없음.

**개발자 의견**: TPO 설계의 `detectAndSave()` 구현이 정확하고 곧바로 사용 가능하다. 다만 `detected.source === m.source && detected.target === m.target` 중복 검사에서 **방향 반전 케이스**(A->B와 B->A)를 같은 의존성으로 볼 것인지는 명확히 해야 한다. 기존 `link()` 메서드(line 66~101)는 단방향 중복만 체크하므로, `detectAndSave()`도 동일 전략을 유지하면 된다.

---

#### TASK-154: projects --detect-links --auto-save 옵션 추가

**대상 파일**: `src/commands/projects.ts`
**수정 위치**: `handleDetectLinks()` 메서드 (line 425~468)
**난이도**: 낮

**구현 가능성 분석**:
- `handleDetectLinks()`는 이미 `config.projects.map(p => p.id)`로 projectIds를 추출하고 `manager.detectLinks(indexer, projectIds)`를 호출한다 (line 440~442).
- `this.args`에서 `--auto-save` 존재 여부를 `this.args.includes('--auto-save')`로 확인하면 된다. 기존 코드에서 동일 패턴이 `--switch`, `--remove` 등에서 이미 사용 중이다.

**정확한 코드 변경**:
```typescript
// projects.ts, handleDetectLinks() 내부, line 442 이후

const autoSave = this.args.includes('--auto-save');

if (autoSave && detectedLinks.length > 0) {
  const saveResult = await manager.detectAndSave(indexer, projectIds);
  logger.success(
    `${saveResult.newLinks}건의 의존성이 cross-project.json에 저장되었습니다. ` +
    `(기존 수동 ${saveResult.preservedManualLinks}건 보존, 총 ${saveResult.totalLinks}건)`
  );
  // 결과 data에 저장 통계도 포함
  return {
    code: ResultCode.SUCCESS,
    message: `Detected and saved ${saveResult.totalLinks} links.`,
    data: { detectedLinks, saveResult },
  };
}
// 기존 --auto-save 없는 경우는 원본 코드 그대로 유지 (line 444~468)
```

**리스크**: 매우 낮음. 기존 분기에 한 블록만 추가.

---

#### TASK-155: save-result 후처리 hook 구현

**대상 파일**: `src/commands/save-result.ts`
**수정 위치**: `execute()` 메서드 (line 32~113), line 99 (`logger.success` 호출 직후)
**난이도**: 중

**구현 가능성 분석**:
- `execute()` 내부에서 `resolvedProjectId`가 이미 결정되어 있으므로 (line 86), 이를 후처리 hook에 전달하면 된다.
- 현재 `save-result.ts`에는 `CrossProjectManager`, `Indexer`, `GapDetector`의 import가 없으므로 추가 필요하다.
- `readJsonFile`, `getImpactDir`는 이미 프로젝트에서 공통 유틸로 사용 중이다.

**정확한 코드 변경**:
```typescript
// save-result.ts, line 97 이후 (savedId 반환 이후)

// [신규] 크로스 프로젝트 후처리 hook
if (!this.args.includes('--skip-cross-detect')) {
  await this.runCrossProjectHook(resolvedProjectId);
}

return {
  code: ResultCode.SUCCESS,
  message: `Result saved: ${savedId}`,
  data: { resultId: savedId, projectId: resolvedProjectId },
};
```

**주요 의존성 추가**:
```typescript
import { CrossProjectManager } from '../core/cross-project/cross-project-manager';
import { Indexer } from '../core/indexing/indexer';
import { readJsonFile, getImpactDir } from '../utils/file';
import type { ProjectsConfig } from '../types/index';
```

**리스크**: 중. 후처리 hook 실패 시 에러가 전체 커맨드 실행을 방해하지 않도록 try-catch 격리가 필수적이다. TPO 설계의 try-catch 패턴이 올바르다.

**개발자 의견**: `runCrossProjectHook()`에서 `new Indexer()` 생성이 basePath를 전달받지 않는다. 현재 `Indexer` 생성자를 확인하면 기본값으로 `~/.impact/`를 사용하므로 문제 없지만, `save-result`에서 `--project`로 커스텀 프로젝트를 지정한 경우에도 동일 basePath를 사용해야 하므로, `Indexer`와 `CrossProjectManager`에 basePath를 전달하는 것이 안전하다.

---

#### TASK-157: --skip-cross-detect 옵션 + 기존 동작 회귀 테스트

**대상 파일**: `save-result.ts`, `projects.ts`
**수정 위치**: TASK-155에서 추가한 조건문
**난이도**: 중 (포인트 5는 주로 회귀 테스트 작성량 때문)

**구현 가능성 분석**:
- `--skip-cross-detect`는 `this.args.includes()`로 간단히 구현 가능하다.
- 회귀 테스트는 기존 `save-result` 동작(저장 성공, 파일 검증, 프로젝트 ID 확인)이 후처리 hook 추가 후에도 동일하게 동작하는지 확인해야 한다.

**리스크**: 낮음. 테스트 작성 분량이 있을 뿐 구현 자체는 단순.

---

### 1.2 Phase 2: Gap Detector + CLI (TASK-158 ~ TASK-162)

#### TASK-158: GapDetector 클래스 구현

**신규 파일**: `src/core/cross-project/gap-detector.ts`
**난이도**: 높음 (4가지 탐지 유형 각각의 로직 구현 필요)

**구현 가능성 분석**:

**1) Stale 링크 탐지 (High)**:
- `cross-project.json`의 링크를 순회하며 `confirmedAt`과 인덱스 `meta.json`의 `updatedAt`을 비교한다.
- 인덱스 meta.json 경로: `~/.impact/projects/{projectId}/index/meta.json` -- `web-server.ts` line 384에서 이 경로를 이미 사용 중이므로 패턴 확인 완료.
- `confirmedAt`은 `ProjectLink` 타입에 optional 필드(`confirmedAt?: string`, types.ts line 35)로 존재. 자동 감지 링크에서는 `detectLinks()`가 `confirmedAt`을 설정하지 않으므로 (line 283~291), `detectAndSave()`에서 반드시 설정해야 한다.

**2) 미분석 프로젝트 탐지 (Medium)**:
- 등록된 프로젝트 중 `cross-project.json` links에 한 번도 등장하지 않는 프로젝트를 찾는다.
- `projects.json`에서 프로젝트 목록을 읽고, links의 `source`/`target`을 Set으로 수집하여 비교하면 O(n)으로 빠르게 처리 가능.

**3) 저신뢰도 분석 탐지 (Medium)**:
- `ResultManager.list()`로 각 프로젝트의 분석 결과를 조회하고, 개별 결과의 `confidenceScores`를 확인해야 한다.
- 문제: 현재 `ResultSummary` 인터페이스(result-manager.ts line 13~28)에는 `confidenceScores` 필드가 없다. `ResultManager.getById()`로 전체 결과를 로드해야 `ConfidenceEnrichedResult`의 상세 데이터에 접근할 수 있다.
- **성능 우려**: 모든 프로젝트의 모든 분석 결과를 전부 로드하면 I/O 부하가 클 수 있다. 최적화 필요.

**4) 인덱스 미갱신 탐지 (Low)**:
- `child_process.execSync`로 `git log -1 --format=%ci`를 실행해야 한다.
- 프로젝트 경로는 `projects.json`의 `ProjectEntry.path`에서 가져온다.
- git 미설치/미초기화 프로젝트 대비 try-catch 필수.

**코드 의존성**:
```typescript
import { CrossProjectManager } from './cross-project-manager';
import { ResultManager } from '../analysis/result-manager';
import { Indexer } from '../indexing/indexer';
import { readJsonFile, getImpactDir, getProjectDir } from '../../utils/file';
import { execSync } from 'child_process';
import type { ProjectsConfig } from '../../types/index';
```

**리스크**: 중-높. 저신뢰도 탐지의 I/O 오버헤드와 git log 실행의 환경 의존성이 주요 리스크.

**개발자 의견**: 저신뢰도 탐지에서 모든 결과를 `getById()`로 전부 로드하는 것은 비효율적이다. **두 가지 대안**을 제안한다:
1. `ResultSummary`에 `overallScore` 필드를 추가하여 인덱스 파일에서만 확인 가능하게 함 (작업량 소, 파급 효과 소)
2. `list()` 결과에서 score 기반 필터링 후 threshold 이하인 것만 `getById()`로 로드 (현재 `totalScore`가 이미 summary에 있으므로 이를 활용)

**권장**: 대안 2. `ResultSummary.totalScore`가 이미 존재하므로 (line 22), `totalScore < 60`인 결과만 `getById()`로 로드하여 세부 `confidenceScores`를 확인하면 I/O를 최소화할 수 있다.

---

#### TASK-160: gap-check CLI 명령어 + router 등록

**신규 파일**: `src/commands/gap-check.ts`
**수정 파일**: `src/router.ts` (line 51~72의 COMMANDS 맵에 1줄 추가)
**난이도**: 낮-중

**구현 가능성 분석**:
- `router.ts`의 COMMANDS 맵에 `'gap-check': GapCheckCommand`를 추가하면 된다 (line 72 직전).
- `GapCheckCommand` 클래스는 기존 `Command` 인터페이스(`types/common.ts`)를 구현하면 된다.
- `--fix`, `--project <id>` 옵션 파싱은 기존 커맨드들의 `this.args.indexOf()` 패턴을 따른다.

**SKILL.md 명령어 등록도 필요**: SKILL.md의 명령어 목록(frontmatter의 commands 배열)에 `/impact gap-check`를 추가해야 한다.

---

### 1.3 Phase 3: 보완 분석 (TASK-163 ~ TASK-167)

#### TASK-163: SupplementScanner 클래스 구현

**신규 파일**: `src/core/cross-project/supplement-scanner.ts`
**난이도**: 중-높

**구현 가능성 분석**:
- `parsedSpec.keywords`, `parsedSpec.targetScreens`, `parsedSpec.features[].keywords`는 `ConfidenceEnrichedResult` 타입에서 접근 가능하다.
- `CodeIndex`의 `screens[].name`, `apis[].path`, `components[].name`과 매칭한다.
- 매칭도 계산 알고리즘이 PRD에 언급되었으나 구체적인 수식이 없다. SKILL.md Step 2.5의 기존 매칭도 기준(50%: 자동, 20~49%: 확인, 20% 미만: 제외)을 참조해야 한다.

**매칭도 계산 알고리즘 제안**:
```typescript
function calculateMatchScore(
  specKeywords: string[],
  specScreens: string[],
  featureKeywords: string[],
  indexScreens: string[],
  indexApis: string[],
  indexComponents: string[],
): number {
  const allKeywords = [...new Set([...specKeywords, ...featureKeywords])];
  const indexTerms = [
    ...indexScreens.map(s => s.toLowerCase()),
    ...indexApis.map(a => a.split('/').filter(Boolean).join(' ').toLowerCase()),
    ...indexComponents.map(c => c.toLowerCase()),
  ];

  let matched = 0;
  for (const kw of allKeywords) {
    if (indexTerms.some(term => term.includes(kw.toLowerCase()))) {
      matched++;
    }
  }
  // 화면 이름 직접 매칭 보너스
  for (const screen of specScreens) {
    if (indexScreens.some(s => s.toLowerCase().includes(screen.toLowerCase()))) {
      matched += 2; // 화면 매칭은 키워드보다 가중치 높음
    }
  }

  const total = allKeywords.length + specScreens.length * 2;
  return total > 0 ? Math.round((matched / total) * 100) : 0;
}
```

**리스크**: 중. 매칭도 계산의 정밀도는 실제 데이터로 튜닝해야 한다. 초기 구현은 단순 키워드 매칭으로 시작하고, 운영 중 개선하는 것이 현실적이다.

**개발자 의견**: Open Item 7.1에서 선택지 3을 채택한 것에 동의한다. `parsedSpec` + `analysisSummary.keyFindings` 조합이 실용적이다. 다만 `analysisSummary`가 모든 분석 결과에 존재하지 않을 수 있으므로 (규칙 기반 분석 결과에는 없음), fallback으로 `parsedSpec`만 사용하는 경로를 반드시 구현해야 한다.

---

#### TASK-164: init 명령어 보완 분석 스캔 hook 추가

**대상 파일**: `src/commands/init.ts`
**수정 위치**: `execute()` 메서드 끝부분 (인덱싱 완료 + 프로젝트 등록 이후)
**난이도**: 중

**구현 가능성 분석**:
- `init.ts`의 `execute()` 끝에서 인덱싱이 완료되고 프로젝트가 `projects.json`에 등록된 상태이다.
- 이 시점에서 `SupplementScanner.scan()`을 호출하여 기존 분석 결과를 스캔할 수 있다.
- 현재 `init.ts`는 `ResultManager`를 import하지 않으므로 추가 필요하다.

**주의사항**: TPO 설계에서는 보완 분석을 자동 실행하는 것이 아니라 CLI 명령어 안내만 제공하도록 설계했다 (line 426~432). 이는 `init` 명령어의 실행 시간을 최소화하는 좋은 결정이다. 사용자 승인(Y/n) 프롬프트는 CLI 도구의 특성상 구현 가능하지만, 비대화형(non-interactive) 실행 시 건너뛸 수 있도록 `--no-supplement` 옵션도 고려해야 한다.

---

#### TASK-166: ResultManager supplement 결과 저장/조회 지원

**대상 파일**: `src/core/analysis/result-manager.ts`, `src/types/analysis.ts`
**수정 위치**:
- `ResultSummary` 인터페이스 (result-manager.ts line 13~28): optional 필드 3개 추가
- `ConfidenceEnrichedResult` 타입 (analysis.ts): optional 필드 2개 추가
- `save()` 메서드 (result-manager.ts line 56~82): supplement 메타데이터 처리
**난이도**: 낮

**구현 가능성 분석**:
- `ResultSummary`에 `isSupplement?: boolean`, `supplementOf?: string`, `triggerProject?: string` 추가는 기존 코드에 영향이 없다. 모든 기존 코드에서 이 필드를 참조하지 않으므로 하위 호환성 보장.
- `save()` 메서드에서 `result.supplementOf`가 존재하면 인덱스에 추가 필드를 기록하면 된다.
- `updateIndex()` (line 148~168)는 `ResultSummary` 타입을 받으므로, 확장된 `ResultSummary`를 자연스럽게 처리한다.

**리스크**: 매우 낮음. optional 필드 추가만으로 완료 가능.

**개발자 의견**: TPO 설계에서 `(result as any).supplementOf` 패턴(line 539)을 사용한 것은 타입 안전성이 낮다. `ConfidenceEnrichedResult`에 `supplementOf?: string`과 `triggerProject?: string`을 직접 추가하는 것이 올바르다. `analysis.ts`의 타입 확장은 TASK-166에 이미 포함되어 있으므로 문제없다.

---

### 1.4 Phase 4: API + 프론트엔드 위젯 (TASK-168 ~ TASK-172)

#### TASK-168: /api/gap-check 엔드포인트 구현

**대상 파일**: `src/server/web-server.ts`
**수정 위치**: 크로스 프로젝트 API 블록 이후, API 404 핸들러(line 1140) 이전
**난이도**: 낮-중

**구현 가능성 분석**:
- web-server.ts의 기존 API 패턴을 그대로 따르면 된다.
- `GapDetector`를 import하고, `basePath`를 전달하여 인스턴스 생성.
- `/api/gap-check?projectId=<id>` 형태로 프로젝트 필터 지원.

**주의사항**: `GapDetector`의 `detect()` 메서드가 git log를 실행하므로, 웹 서버 요청 처리 중에 `execSync`가 블로킹될 수 있다. 웹 서버에서는 `execAsync`(child_process.exec의 Promise 래핑)를 사용하거나, git log 체크를 비동기로 처리해야 한다. 또는 `/api/gap-check` 응답에서 "인덱스 미갱신" 탐지만 별도의 비동기 처리로 분리하는 방법도 있다.

**개발자 의견**: 웹 서버 API에서 `execSync`를 사용하면 요청 처리 중 다른 요청이 블로킹된다. `GapDetector`에서 git log를 `child_process.exec`(Promise 래핑)로 비동기 처리하도록 설계를 변경하는 것을 강력히 권장한다. CLI에서는 `execSync`로도 무방하지만, 웹 서버에서는 반드시 비동기여야 한다.

---

#### TASK-170: GapHealthWidget + GapDetailList 구현

**신규 파일**:
- `web/src/components/projects/GapHealthWidget.tsx`
- `web/src/components/projects/GapDetailList.tsx`
**난이도**: 중

**구현 가능성 분석**:
- UX 설계 문서 Section 2의 와이어프레임과 디자인 토큰이 매우 상세하므로 그대로 구현 가능하다.
- `/api/gap-check`가 404를 반환하면 (미구현 상태) 위젯을 숨기는 로직(UX 5.5)은 `fetch` 응답 status 체크로 간단히 구현 가능.
- `navigator.clipboard.writeText()`는 HTTPS 또는 localhost에서만 동작하므로 개발 환경에서 문제없다.

**리스크**: 낮음. 프론트엔드 컴포넌트는 API 응답 스키마에만 의존하며, 백엔드 독립적으로 개발/테스트 가능.

---

#### TASK-171: ProjectBoard에 GapHealthWidget 통합

**대상 파일**: `web/src/pages/ProjectBoard.tsx`
**수정 위치**: line 205~211 (ProjectStatusBanner) 바로 아래, line 224 (분석 이력 + 점수 추이) 바로 위
**난이도**: 매우 낮

**정확한 코드 변경**:
```tsx
// ProjectBoard.tsx, ProjectStatusBanner 직후에 추가

{/* 영향도 건강 상태 위젯 */}
{projectStatus?.hasIndex && <GapHealthWidget />}
```

`GapHealthWidget` import를 파일 상단에 추가하면 된다.

**리스크**: 매우 낮음. JSX 1줄 추가.

---

### 1.5 Phase 5: 플로우차트 "전체" 모드 개선 (TASK-173 ~ TASK-176)

#### TASK-173: CrossProjectTabs 컴포넌트 구현

**신규 파일**: `web/src/components/cross-project/CrossProjectTabs.tsx`
**난이도**: 중

**구현 가능성 분석**:
- UX 설계 Section 3에서 4개 탭(의존성, 공유엔티티, Pub/Sub, 요약)을 정의했다.
- 기존 컴포넌트를 탭별로 배치하는 컨테이너 역할이므로 구현 난이도는 낮지만, 데이터 로드 및 캐시 전략이 핵심이다.
- `FlowChart.tsx` (line 148~165)에서 이미 크로스 프로젝트 데이터를 로드하는 패턴이 있으므로 이를 재사용한다.

**리스크**: 낮음. 기존 컴포넌트의 재사용이 주요 작업.

---

#### TASK-174: FlowChart에서 CrossProjectTabs 통합

**대상 파일**: `web/src/pages/FlowChart.tsx`
**수정 위치**: line 251~273 (projectMode === 'all' 분기)
**난이도**: 낮

**현재 코드** (line 251~273):
```tsx
if (projectMode === 'all' && currentResult) {
  return (
    <div className="p-6">
      <ProjectSelector ... />
      <div className="mt-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3>전체 프로젝트 영향도 - {currentResult.specTitle}</h3>
          <CrossProjectDiagram links={links} onNodeClick={() => {}} />
          <CrossProjectSummary links={links} groups={groups} />
        </div>
      </div>
    </div>
  );
}
```

**변경 후**:
```tsx
if (projectMode === 'all' && currentResult) {
  return (
    <div className="p-6">
      <ProjectSelector ... />
      <div className="mt-4">
        <CrossProjectTabs
          links={links}
          groups={groups}
          specTitle={currentResult.specTitle}
        />
      </div>
    </div>
  );
}
```

**리스크**: 매우 낮음. 기존 인라인 코드를 `CrossProjectTabs` 컴포넌트로 교체하는 리팩토링.

---

#### TASK-175: CrossProjectDiagram hover 하이라이트 + 노드 클릭

**대상 파일**: `web/src/components/cross-project/CrossProjectDiagram.tsx`
**난이도**: 중

**구현 가능성 분석**:
- 현재 `FlowChart.tsx` line 266에서 `onNodeClick={() => {}}`으로 빈 핸들러를 전달 중이다. 이를 실제 동작으로 교체해야 한다.
- `@xyflow/react`의 `onNodeMouseEnter`, `onNodeMouseLeave` 이벤트를 사용하여 hover 하이라이트 구현 가능.
- 연결된 엣지만 `opacity: 1`, 나머지 `opacity: 0.3`으로 처리하는 패턴은 React Flow의 `setEdges()` 업데이트로 구현.

**리스크**: 중. React Flow의 hover 이벤트 핸들링과 엣지 스타일 동적 변경은 약간의 작업량이 있다.

---

#### TASK-176: 보완 분석 UI (SupplementBanner + ResultCard 라벨)

**신규 파일**: `web/src/components/dashboard/SupplementBanner.tsx`
**수정 파일**: `web/src/components/layout/ResultCard.tsx`, `web/src/components/project-board/AnalysisHistoryTable.tsx`, `web/src/pages/Dashboard.tsx`
**난이도**: 중

**구현 가능성 분석**:
- `ResultCard`에 `[보완]` 라벨을 추가하려면, 결과 목록 API(`/api/results`)가 `isSupplement` 필드를 반환해야 한다.
- 현재 `ResultSummary`에 해당 필드를 추가하면(TASK-166), API 응답에 자동으로 포함된다.
- `SupplementBanner`는 조건부 렌더링 컴포넌트로, 현재 결과가 `isSupplement: true`일 때만 표시하면 된다.

**리스크**: 낮음.

---

### 1.6 Phase 6: SKILL.md + 통합 테스트 (TASK-177 ~ TASK-180)

#### TASK-177: SKILL.md Step 4.5 + Step 2.5 강화 + 자연어 매핑

**대상 파일**: `SKILL.md`
**수정 위치**:
1. Step 4와 Step 5 사이에 Step 4.5 삽입
2. Step 2.5에 기존 링크 참조 로직 추가
3. 자연어 매핑 테이블에 gap-check, 보완 분석 추가
4. frontmatter의 commands에 `/impact gap-check` 추가
**난이도**: 낮

---

## 2. 핵심 구현 상세

### 2.1 `detectAndSave()` 메서드 상세 설계

Section 1.1의 TASK-152에서 이미 상세하게 다루었다. 핵심 포인트를 정리하면:

1. **기존 detectLinks() 무변경**: 반환만 하는 기존 동작을 100% 보존한다.
2. **수동 링크 보존 전략**: `autoDetected === false`인 링크만 분리하여 먼저 병합 배열에 넣는다.
3. **자동 링크 교체 전략**: Open Item 7.3 선택지 1 채택. 매번 `autoDetected === true`인 기존 링크를 전부 제거하고 최신 감지 결과로 대체한다.
4. **중복 판정 기준**: source + target 조합. 동일 source-target이면 타입이 달라도 중복으로 간주한다.
5. **`confirmedAt` 설정**: 자동 감지 링크에도 `confirmedAt: new Date().toISOString()`을 설정하여 Stale 감지 기준점으로 활용한다.

### 2.2 `GapDetector` 클래스 4가지 탐지 유형 알고리즘 상세

#### 유형 1: Stale 링크 탐지 (High)

```
입력: cross-project.json links, 각 프로젝트의 index/meta.json
알고리즘:
  for each link in config.links:
    sourceIndex = loadMeta(link.source)
    targetIndex = loadMeta(link.target)
    if sourceIndex == null OR targetIndex == null:
      -> stale (프로젝트 삭제/미존재)
    if link.confirmedAt:
      if sourceIndex.updatedAt > link.confirmedAt:
        -> stale (소스 인덱스 변경)
      if targetIndex.updatedAt > link.confirmedAt:
        -> stale (타겟 인덱스 변경)
출력: GapItem { severity: 'high', type: 'stale_link', count, details }
```

#### 유형 2: 미분석 프로젝트 탐지 (Medium)

```
입력: projects.json 프로젝트 목록, cross-project.json links
알고리즘:
  linkedProjects = Set(links.flatMap(l => [l.source, l.target]))
  for each project in projects.json:
    if project.id NOT IN linkedProjects:
      -> unanalyzed
출력: GapItem { severity: 'medium', type: 'unanalyzed_project', count, details }
```

#### 유형 3: 저신뢰도 분석 탐지 (Medium)

```
입력: 각 프로젝트의 results/index.json
알고리즘:
  for each project in projects.json:
    summaries = ResultManager.list(project.id)
    for each summary where totalScore < 60:
      result = ResultManager.getById(project.id, summary.id)
      for each system in result.confidenceScores:
        if system.overallScore < 60:
          -> low_confidence (해당 시스템)
출력: GapItem { severity: 'medium', type: 'low_confidence', count, details }
```

**최적화**: `totalScore >= 60`인 결과는 `getById()` 로드를 건너뛴다.

#### 유형 4: 인덱스 미갱신 탐지 (Low)

```
입력: 각 프로젝트의 index/meta.json, git log
알고리즘:
  for each project in projects.json:
    meta = loadMeta(project.id)
    if meta == null: continue  // 인덱스 자체가 없으면 유형 2에서 처리
    try:
      lastCommit = exec('git log -1 --format=%ci', { cwd: project.path })
      if parseDate(lastCommit) > parseDate(meta.updatedAt):
        -> outdated_index
    catch:
      // git 미설치/미초기화: 건너뜀
출력: GapItem { severity: 'low', type: 'outdated_index', count, details }
```

### 2.3 `save-result` 후처리 훅: 기존 save 로직에 끼워넣는 방법

현재 `save-result.ts`의 `execute()` 메서드 흐름:

```
line 33: try {
line 35:   filePath = getOption('--file')     // 1. 파일 경로 파싱
line 44:   existsSync(filePath)               // 2. 파일 존재 확인
line 54:   rawData = JSON.parse(content)       // 3. JSON 파싱
line 68:   validation = validate(rawData)      // 4. 런타임 검증
line 79:   analysisMethod 기본값 설정          // 5. 기본값 설정
line 85:   projectId 결정                      // 6. 프로젝트 ID 결정
line 96:   savedId = resultManager.save(...)   // 7. 저장 실행
line 99:   logger.success(...)                 // 8. 성공 로그
line 100:  return SUCCESS                      // 9. 반환
```

**끼워넣는 위치**: line 99 (성공 로그) 와 line 100 (반환) 사이에 삽입.

```typescript
// line 99 이후
if (!this.args.includes('--skip-cross-detect')) {
  await this.runCrossProjectHook(resolvedProjectId);
}
// line 100: return
```

**핵심 원칙**: 후처리 훅은 `try-catch`로 감싸서, 실패 시에도 이미 저장된 결과를 롤백하지 않는다. `resultManager.save()`가 성공한 이후에만 실행되므로 데이터 무결성에 영향 없다.

### 2.4 `gap-check` API: Express 라우트 설계

```typescript
// web-server.ts, 크로스 프로젝트 API 블록 이후 (line 1134 근처)

app.get('/api/gap-check', async (req: Request, res: Response) => {
  try {
    const projectFilter = req.query.projectId as string | undefined;
    if (projectFilter && !isValidId(projectFilter)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }

    const detector = new GapDetector(
      path.join(basePath || process.env.HOME || '.', '.impact')
    );
    const gaps = await detector.detect(projectFilter);

    const summary = {
      high: gaps.filter(g => g.severity === 'high').reduce((s, g) => s + g.count, 0),
      medium: gaps.filter(g => g.severity === 'medium').reduce((s, g) => s + g.count, 0),
      low: gaps.filter(g => g.severity === 'low').reduce((s, g) => s + g.count, 0),
      total: gaps.reduce((s, g) => s + g.count, 0),
    };

    res.json({ gaps, summary, lastCheckedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to run gap check:', error);
    res.status(500).json({ error: 'Failed to run gap check' });
  }
});
```

**위치 주의**: 반드시 API 404 핸들러(`app.use('/api', ...)`, line 1140) **이전에** 등록해야 한다. 그렇지 않으면 모든 gap-check 요청이 404로 빠진다.

### 2.5 SKILL.md Step 4.5: 프로토콜 텍스트 제안

```markdown
### Step 4.5: 크로스 프로젝트 의존성 자동 갱신

분석 결과 저장(Step 4) 완료 후, 등록된 프로젝트가 2개 이상인 경우 실행한다.
등록 프로젝트가 1개이면 이 단계를 건너뛴다.

1. **크로스 프로젝트 의존성 자동 감지**:
   ```bash
   node {skill_dir}/dist/index.js projects --detect-links --auto-save
   ```

2. **결과를 사용자에게 제시**:
   ```
   크로스 프로젝트 의존성 갱신 완료:
     신규 감지: N건 (API: A건, 공유테이블: B건, 공유이벤트: C건)
     기존 유지: M건
     총 의존성: X건
   ```

3. **확인 안내**:
   - 웹 대시보드가 실행 중이면: "플로우차트 '전체' 모드에서 확인 가능합니다."
   - 실행 중이지 않으면: "`/impact view`로 대시보드를 시작하여 확인할 수 있습니다."

4. **누락 간이 점검** (선택적):
   위 감지 과정에서 누락이 발견되면 경고를 표시한다:
   ```
   [주의] 영향도 누락 N건 감지. `/impact gap-check`로 상세 확인하세요.
   ```
```

---

## 3. 테스트 전략 상세

### 3.1 각 신규 모듈별 테스트 케이스 목록

#### 3.1.1 detectAndSave() (TASK-153)

| # | 테스트 케이스 | 검증 내용 |
|:-:|-------------|----------|
| 1 | 수동 링크 보존 | 수동 링크 1건 등록 -> detectAndSave() 실행 -> 수동 링크 존재 확인 |
| 2 | 자동 감지 저장 | detectAndSave() 실행 -> cross-project.json에 autoDetected: true 링크 존재 |
| 3 | 중복 링크 방지 | 동일 source-target 수동 링크 존재 -> 자동 감지에서 같은 조합 발견 -> 중복 저장 안 됨 |
| 4 | 자동 링크 교체 | 1차 detectAndSave() -> 2차 detectAndSave() -> autoDetected 링크가 최신 결과로 교체됨 |
| 5 | 프로젝트 2개 미만 | projectIds.length === 1 -> 빈 배열 반환, 저장 안 함 |
| 6 | 빈 프로젝트 (인덱스 없음) | 인덱스 없는 프로젝트 포함 -> 해당 프로젝트 건너뛰고 나머지 처리 |
| 7 | 통계 반환값 검증 | newLinks, preservedManualLinks, totalLinks, byType 정확성 |
| 8 | confirmedAt 설정 | 저장된 자동 링크에 confirmedAt이 ISO 날짜 형식으로 설정됨 |

#### 3.1.2 save-result hook (TASK-156)

| # | 테스트 케이스 | 검증 내용 |
|:-:|-------------|----------|
| 1 | 성공 케이스 | save-result 실행 -> cross-project.json에 링크 저장됨 |
| 2 | hook 실패 시 결과 보존 | detectAndSave mock 에러 -> save-result SUCCESS + 경고 로그 |
| 3 | --skip-cross-detect | save-result --skip-cross-detect -> cross-project.json 변경 없음 |
| 4 | 프로젝트 1개 | 등록 프로젝트 1개 -> hook 건너뜀, cross-project.json 변경 없음 |
| 5 | 프로젝트 0개 | 등록 프로젝트 없음 -> hook 건너뜀 |

#### 3.1.3 GapDetector (TASK-159)

| # | 테스트 케이스 | 검증 내용 |
|:-:|-------------|----------|
| 1 | Stale 링크 탐지 | 인덱스 updatedAt > link.confirmedAt -> stale_link 감지 |
| 2 | 삭제된 프로젝트 참조 | links에 존재하지 않는 프로젝트 ID -> stale_link 감지 |
| 3 | 미분석 프로젝트 | 등록은 되었으나 links에 미등장 프로젝트 -> unanalyzed_project |
| 4 | 저신뢰도 분석 | totalScore < 60 결과 -> low_confidence 감지 |
| 5 | 인덱스 미갱신 | git log 날짜 > meta updatedAt -> outdated_index |
| 6 | 빈 상태 | 프로젝트 없음, 링크 없음, 결과 없음 -> 빈 배열 반환 |
| 7 | 프로젝트 1개 | 크로스 프로젝트 항목 건너뜀, 단일 항목(저신뢰도, 미갱신)만 체크 |
| 8 | --project 필터 | 특정 프로젝트 관련 gap만 반환 |
| 9 | --fix 자동 해결 | 해결 가능 항목 해결 + 불가능 항목 안내 |
| 10 | git 미설치 | execSync 에러 -> 해당 프로젝트 건너뜀 |
| 11 | autoFixable 분류 | stale/outdated -> autoFixable: true, low_confidence -> autoFixable: false |

#### 3.1.4 SupplementScanner (TASK-167)

| # | 테스트 케이스 | 검증 내용 |
|:-:|-------------|----------|
| 1 | 매칭도 계산 정확성 | mock parsedSpec + mock index -> 예상 매칭도와 일치 |
| 2 | 기존 결과 없음 | 빈 결과 목록 -> 빈 후보 반환 |
| 3 | 매칭 0% | 전혀 관련 없는 키워드 -> 빈 후보 반환 |
| 4 | 매칭 20~49% | 확인 필요 후보로 분류 |
| 5 | 매칭 50%+ | 자동 포함 후보로 분류 |
| 6 | parsedSpec 없는 결과 | 규칙 기반 분석 결과 (parsedSpec 누락) -> 해당 결과 건너뜀 |
| 7 | supplement 결과 저장 | supplement-{id}.json 파일 생성 + isSupplement: true 인덱스 |

#### 3.1.5 GapHealthWidget (TASK-172)

| # | 테스트 케이스 | 검증 내용 |
|:-:|-------------|----------|
| 1 | 로딩 상태 | API 호출 중 shimmer 효과 표시 |
| 2 | 정상 렌더링 | KPI 카드 3개 정확한 건수, 상세 목록 정확한 항목 |
| 3 | 빈 상태 (0건) | 축소 상태 한 줄 표시 |
| 4 | 에러 상태 | API 실패 시 에러 메시지 + 재시도 버튼 |
| 5 | 404 시 숨김 | API 404 -> 위젯 자체 미렌더링 |
| 6 | CTA 클립보드 복사 | 버튼 클릭 -> navigator.clipboard.writeText 호출 확인 |
| 7 | KPI 카드 클릭 | 클릭 시 해당 심각도 상세 목록 필터링/펼침 |
| 8 | 새로고침 버튼 | API 재호출 + 데이터 갱신 확인 |
| 9 | 접근성 | aria-label, aria-expanded, role 속성 확인 |

### 3.2 통합 테스트 시나리오

#### 시나리오 1: 분석 -> 크로스 프로젝트 갱신 -> 웹 API (TASK-178)

```
1. 테스트 환경 설정: 2개 프로젝트 등록, 인덱스 생성 (mock)
2. save-result 실행 (분석 결과 JSON 파일 제공)
3. 검증:
   a. 분석 결과가 results/ 에 저장됨
   b. cross-project.json에 autoDetected 링크 존재
   c. GET /api/cross-project/links 응답에 링크 데이터 포함
   d. GET /api/gap-check 응답에 적절한 gap 항목 포함 (또는 빈 배열)
```

#### 시나리오 2: init -> 보완 분석 스캔 -> supplement 저장 (TASK-179)

```
1. 테스트 환경 설정: 프로젝트 A 등록 + 분석 완료 상태
2. 프로젝트 B init 실행 (매칭 가능한 인덱스)
3. 검증:
   a. SupplementScanner.scan() 결과에 매칭 항목 포함
   b. cross-analyze --supplement 실행 시 supplement-{id}.json 생성
   c. 기존 분석 결과 파일 무변경 (해시 비교)
   d. detectAndSave() 재실행으로 cross-project.json 갱신
```

### 3.3 기존 테스트에 미치는 영향

| 기존 테스트 | 영향 | 대응 |
|-----------|------|------|
| cross-project-manager.test.ts | detectAndSave() 추가로 기존 테스트에 영향 없음 (신규 메서드) | 없음 |
| save-result 관련 테스트 (있는 경우) | 후처리 hook 추가로 mock 필요 | CrossProjectManager를 jest.mock()으로 격리 |
| projects.ts 테스트 (있는 경우) | --auto-save 분기 추가 | 기존 --detect-links 테스트에 --auto-save 없는 동작 회귀 테스트 추가 |
| web-server.ts API 테스트 (있는 경우) | /api/gap-check 추가 | 기존 API 테스트에 영향 없음 (새 엔드포인트 추가만) |
| 프론트엔드 테스트 | ProjectBoard에 GapHealthWidget 추가 | ProjectBoard 렌더링 테스트에서 /api/gap-check mock 추가 필요 |

---

## 4. 개발자 관점 의견

### 4.1 TPO 설계에서 과도하거나 불필요한 부분

#### 4.1.1 파일 잠금(file-lock.ts) 메커니즘 -- 불필요 (후순위)

TPO 설계 Section 6.3에서 `proper-lockfile` 또는 `.lock` 파일 메커니즘 도입을 제안했다. 그러나:

- **KIC는 단일 사용자 CLI 도구**이다. 병렬 분석 실행 시나리오는 극히 드물다.
- AI 분석 프로토콜은 순차적(Step 1 -> 2 -> 3 -> 4 -> 4.5)으로 실행되므로 동시 쓰기가 발생하지 않는다.
- `writeJsonFile`이 `fs.writeFileSync`를 사용하므로 OS 수준에서 원자적이다.
- 파일 잠금 라이브러리 추가는 의존성 증가와 디버깅 복잡성을 초래한다.

**권장**: Phase 1에서 파일 잠금을 도입하지 않고, 실제 동시 접근 문제가 보고될 때 도입한다.

#### 4.1.2 Step 2.5 강화 -- 범위 축소 제안

TPO 설계 Section 2.2에서 Step 2.5 강화를 제안했다 (기존 링크 참조, 매칭도 보정 +10%, 보완 분석 결과 참조). 그러나:

- Step 2.5는 **AI 프로토콜** 수준의 변경으로, SKILL.md 텍스트만 수정하면 되지만, 실제 효과를 검증하기 어렵다.
- 매칭도 보정 +10%는 임의의 숫자이며 정밀한 근거가 없다.

**권장**: REQ-015 범위에서는 기존 링크 참조(가장 간단한 강화)만 포함하고, 매칭도 보정과 보완 분석 결과 참조는 운영 데이터 축적 후 별도 REQ로 처리한다.

#### 4.1.3 플로우차트 4탭 구조 -- 범위 과다 우려

UX 설계 Section 3에서 플로우차트 "전체" 모드를 4개 탭(의존성, 공유엔티티, Pub/Sub, 요약)으로 설계했다. 그러나:

- 현재 "전체" 모드는 데이터 자체가 비어있어 빈 화면이 표시되는 것이 핵심 문제이다.
- 4탭 구조는 시각적으로 풍부하지만, MVP에서는 **기존 CrossProjectDiagram + CrossProjectSummary에 데이터가 표시되면 충분**하다.
- 공유엔티티와 Pub/Sub 탭은 ProjectBoard에 이미 유사한 섹션이 존재한다 (line 256~271).

**권장**: Phase 5의 TASK-173~174(CrossProjectTabs)를 후순위로 미루고, 먼저 기존 컴포넌트가 데이터를 정상 표시하는지 확인한 후 탭 구조를 도입한다.

### 4.2 더 간단하게 구현할 수 있는 대안

#### 4.2.1 gap-check --fix의 reindex 실행 단순화

TPO 설계에서 `gap-check --fix`가 인덱스 미갱신 프로젝트에 대해 `reindex`를 실행한다고 했으나, `reindex`는 시간이 오래 걸릴 수 있다 (프로젝트 크기에 따라 수십 초~수분).

**대안**: `gap-check --fix`에서는 reindex를 직접 실행하지 않고, reindex 명령어만 안내한다. 자동 해결은 Stale 링크 정리와 크로스 프로젝트 재감지에 한정한다.

```
gap-check --fix 실행 결과:
  해결 완료: 2건 (Stale 링크 정리 1건, 재감지 1건)
  수동 해결 필요: 3건
    - 인덱스 미갱신 2건: /impact reindex --full 실행 필요
    - 저신뢰도 1건: 재분석 필요
```

이렇게 하면 `gap-check --fix` 실행 시간을 예측 가능하게 유지할 수 있다.

#### 4.2.2 보완 분석의 자동 실행 대신 안내만

PRD FR-015-2-3에서 "사용자가 승인하면 매칭도 50% 이상 항목에 대해 자동 실행"이라고 했으나, 보완 분석은 AI 분석(Claude) 호출이 필요할 수 있어 CLI만으로 자동 실행이 어렵다.

**대안**: `init` 완료 후 보완 분석 **안내만** 제공하고, 실제 보완 분석은 사용자가 대화형 모드(/kic)에서 실행하도록 한다. TPO 설계(Section 3.5)에서도 이미 안내만 제공하는 방향으로 설계했으므로 이를 확정한다.

### 4.3 우선순위 조정 제안 (MVP vs 나중)

#### MVP (Phase 1 + Phase 2 + Phase 4 일부)

| TASK | 이유 |
|:----:|------|
| TASK-152~157 | 핵심 문제 해결: cross-project.json 자동 저장 |
| TASK-158~162 | 누락 탐지: 사용자에게 직접적인 가치 제공 |
| TASK-168~169 | API: 프론트엔드 위젯의 전제 조건 |
| TASK-170~172 | 위젯: 대시보드에서 누락 확인 가능 |
| TASK-177 | SKILL.md: AI 프로토콜 연동 |

**예상 총 포인트**: 19 + 18 + 10 + 2 = **49포인트** (전체 92의 53%)

#### 후순위 (별도 이터레이션)

| TASK | 이유 |
|:----:|------|
| TASK-163~167 | 보완 분석: 복잡도 대비 사용 빈도 낮음 |
| TASK-173~176 | 플로우차트 탭 + 보완 UI: MVP 이후 UX 개선 |
| TASK-178~180 | 통합 테스트: MVP 기능 안정화 후 실행 |

**이유**: 보완 분석(Phase 3)은 "신규 프로젝트 등록 후 기존 분석 보완"이라는 특수 시나리오에 해당하며, 현재 4개 프로젝트 환경에서 자주 발생하지 않는다. 반면 Phase 1 (자동 저장)과 Phase 2 (갭 체크)는 매 분석마다 사용되므로 즉각적인 가치가 높다.

### 4.4 Open Items에 대한 개발자 의견

#### 7.1 보완 분석의 정밀도 -- 동의 (선택지 3)

`parsedSpec + analysisSummary.keyFindings` 조합이 적절하다. 다만 `keyFindings`가 없는 경우를 대비한 fallback 로직이 필수적이다.

#### 7.2 cross-project.json 동시 접근 -- 불필요 (Section 4.1.1 참조)

파일 잠금은 현 시점에서 불필요하다. 향후 멀티 사용자 시나리오가 생기면 그때 도입한다.

#### 7.3 stale 자동 감지 링크 생명주기 -- 동의 (선택지 1)

매번 삭제 후 재생성이 가장 단순하고 직관적이다. `detectAndSave()`에서 `autoDetected: true`인 기존 링크를 전부 제거하고 최신 결과로 교체하는 전략이 올바르다.

#### 7.4 대시보드 건강 상태 위젯의 범위 -- 확인 완료

REQ-014가 이미 구현 완료 상태이므로 (`ProjectBoard.tsx`에 `ProjectStatusBanner`가 존재, line 206~211), GapHealthWidget을 바로 삽입할 수 있다. 구현 가능성 확인 완료.

#### 7.5 보완 분석 결과의 대시보드 표시 -- 동의 (선택지 2)

`[보완]` 라벨이 기존 `[예시]` 라벨 패턴과 일관적이며 구현 비용이 최소이다.

#### 7.6 프로젝트 1개일 때 gap-check -- 동의 (단일 프로젝트 내부 항목만 체크)

저신뢰도와 인덱스 미갱신은 단일 프로젝트에서도 유효한 점검 항목이다. 크로스 프로젝트 항목(미분석, stale 링크)만 건너뛰면 된다.

---

## 5. 피드백 R13~R15 검토

### R13: 코드 변경 범위 최소화 원칙 재검토

**기존 코드 수정 파일 수**: 8개 (총 26개 파일 중)
**수정 성격**: 모두 "추가" 패턴 (메서드 추가, 분기 추가, optional 필드 추가)

| 파일 | 수정 라인 수 (예상) | 기존 코드 삭제/변경 |
|------|:------------------:|:-----------------:|
| cross-project-manager.ts | +40 | 없음 |
| projects.ts | +15 | 없음 |
| save-result.ts | +30 | 없음 |
| init.ts | +15 | 없음 |
| cross-analyze.ts | +20 | 없음 |
| router.ts | +2 | 없음 |
| web-server.ts | +25 | 없음 |
| result-manager.ts | +5 (타입 필드) | 없음 |
| analysis.ts | +3 (타입 필드) | 없음 |

**결론**: 모든 수정이 "추가"만으로 이루어지며, 기존 코드의 삭제/변경이 전무하다. 변경 범위 최소화 원칙이 잘 지켜지고 있다.

**개선 제안**: TPO가 제안한 파일 잠금(`file-lock.ts`), Step 2.5 강화(매칭도 보정)는 불필요한 변경이므로 제외하면 변경 범위를 더 줄일 수 있다 (Section 4.1 참조).

### R14: 테스트 커버리지 충분성 검토

| 모듈 | 테스트 TASK | 케이스 수 | 커버리지 평가 |
|------|:----------:|:--------:|:-----------:|
| detectAndSave | TASK-153 | 8 | 충분 |
| save-result hook | TASK-156 | 5 | 충분 |
| --skip-cross-detect | TASK-157 | 회귀 포함 | 충분 |
| GapDetector | TASK-159 | 11 | 충분 |
| gap-check CLI | TASK-162 | 3 | 충분 |
| SupplementScanner | TASK-167 | 7 | 충분 |
| /api/gap-check | TASK-169 | 4 | 충분 |
| GapHealthWidget | TASK-172 | 9 | 충분 |
| 통합 시나리오 | TASK-178~179 | 2 | 적절 |

**누락 우려 테스트 케이스**:
1. **cross-project.json 손상 케이스**: `loadConfig()`가 null을 반환하는 경우 detectAndSave()가 정상 동작하는지 확인하는 테스트 추가 권장.
2. **대량 프로젝트 성능 테스트**: 10+ 프로젝트에서 detectLinks() + gap-check 실행 시간 측정 테스트 추가 권장 (비기능 테스트).
3. **웹 서버 동시 요청**: `/api/gap-check`에 여러 요청이 동시에 들어올 때 git log 블로킹 문제 확인 (비동기 변경 후 테스트).

**총 평가**: 기능적 테스트 커버리지는 충분하다. 비기능(성능, 동시성) 테스트는 MVP 이후 추가를 권장한다.

### R15: 사용자 사용성 최종 검토

| 사용자 시나리오 | 현재(As-Is) | 변경 후(To-Be) | 편리성 개선 |
|---------------|-----------|-------------|:---------:|
| 기획서 분석 후 크로스 프로젝트 확인 | 수동 `--detect-links` 실행 + 수동 `--link` 등록 필요 | 자동 감지 + 자동 저장. 대시보드에서 바로 확인 | 높음 |
| 프로젝트 간 영향도 시각화 | 플로우차트 "전체" 모드 빈 화면 | 데이터가 자동 채워져 프로젝트 간 관계 시각화 | 높음 |
| 누락 파악 | 사용자가 직접 점검해야 함 (방법 없음) | Gap Health Widget에서 0 클릭으로 인지 | 매우 높음 |
| 누락 해결 | 해결 방법을 직접 파악해야 함 | CTA 버튼 클릭 1회로 CLI 명령어 복사 | 높음 |
| 신규 프로젝트 등록 후 기존 분석 보완 | 보완 경로 없음 | 등록 시 자동 스캔 + 보완 분석 안내 | 중간 |

**사용성 우려 사항**:

1. **CLI 명령어 복사 방식의 한계**: CTA 버튼이 CLI 명령어를 클립보드에 복사하는 방식은, 터미널과 브라우저를 오가야 하므로 사용자 경험이 완벽하지 않다. 그러나 KIC가 CLI 기반 도구인 점을 감안하면 현실적인 타협점이다. 향후 웹에서 직접 CLI를 실행하는 기능(웹 터미널 또는 WebSocket 기반 실행)을 고려할 수 있다.

2. **갭 체크 자동 실행 빈도**: `save-result` 후처리 hook으로 매 분석마다 갭 체크가 실행되면, 사용자가 의도치 않은 경고 메시지를 자주 볼 수 있다. `--skip-cross-detect` 옵션이 있으므로 사용자가 필요 시 비활성화할 수 있지만, 기본 동작이 "항상 실행"이므로 초기에는 적절하다.

3. **보완 분석의 실용성**: 현재 4개 프로젝트 환경에서 신규 프로젝트 등록 빈도가 낮으므로, 보완 분석은 후순위가 적절하다. 다만 향후 프로젝트가 10+로 늘어나면 중요도가 높아질 것이다.

**최종 결론**: REQ-015의 핵심 가치는 "분석 후 크로스 프로젝트 데이터가 자동으로 채워져 플로우차트에 바로 표시되는 것"과 "Gap Health Widget으로 누락을 0 클릭으로 인지하는 것"이다. 이 두 가지가 MVP에 포함되므로 사용자 편의성 개선 효과가 크다.

---

## 6. 최종 구현 권장 순서

```
Phase 1 (MVP 핵심) - 3일
  TASK-152: detectAndSave() 구현
  TASK-153: 단위 테스트
  TASK-154: --auto-save 옵션
  TASK-155: save-result 후처리 hook
  TASK-156: hook 단위 테스트
  TASK-157: --skip-cross-detect + 회귀 테스트
  -> 커밋: "feat(REQ-015): 크로스 프로젝트 자동 감지 및 저장"

Phase 2 (MVP 확장) - 3일
  TASK-158: GapDetector 구현
  TASK-159: GapDetector 단위 테스트
  TASK-160: gap-check CLI + router
  TASK-161: --fix 자동 해결
  TASK-162: --project 필터 + 통합 테스트
  -> 커밋: "feat(REQ-015): gap-check 명령어 및 GapDetector"

Phase 4 (MVP 위젯) - 2일
  TASK-168: /api/gap-check 엔드포인트
  TASK-169: API 테스트
  TASK-170: GapHealthWidget + GapDetailList
  TASK-171: ProjectBoard 통합
  TASK-172: 프론트엔드 테스트
  -> 커밋: "feat(REQ-015): Gap Health Widget 대시보드 통합"

Phase 6a (MVP 마무리) - 1일
  TASK-177: SKILL.md Step 4.5 + 자연어 매핑
  TASK-178: 통합 테스트 (분석 -> 크로스 프로젝트)
  -> 커밋: "feat(REQ-015): SKILL.md 프로토콜 + 통합 테스트"

--- MVP 완료 (총 9일, 49포인트) ---

Phase 3 (후순위) - 3일
  TASK-163~167: 보완 분석

Phase 5 (후순위) - 2일
  TASK-173~176: 플로우차트 탭 + 보완 UI

Phase 6b (후순위) - 1일
  TASK-179~180: 추가 통합 테스트 + QA
```

---

## 부록 A: GapDetector 생성자 basePath 전달 패턴

```typescript
// GapDetector는 여러 Manager를 내부에서 생성하므로 basePath를 일관되게 전달해야 한다.

export class GapDetector {
  private readonly basePath: string;
  private readonly crossProjectManager: CrossProjectManager;
  private readonly resultManager: ResultManager;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.impact'
    );
    this.crossProjectManager = new CrossProjectManager(this.basePath);
    this.resultManager = new ResultManager(this.basePath);
  }
}
```

## 부록 B: 비동기 git log 실행 패턴 (웹 서버용)

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getLastCommitDate(projectPath: string): Promise<Date | null> {
  try {
    const { stdout } = await execAsync(
      'git log -1 --format=%ci',
      { cwd: projectPath, timeout: 2000 }
    );
    return new Date(stdout.trim());
  } catch {
    return null; // git 미설치, 미초기화, timeout
  }
}
```
