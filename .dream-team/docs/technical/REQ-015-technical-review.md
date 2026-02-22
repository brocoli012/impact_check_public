# REQ-015 기술 설계서: 크로스 프로젝트 자동 영향도 분석

> **작성자**: TPO (Tech Product Owner)
> **기반 PRD**: REQ-015-cross-project-auto-analysis.md
> **기반 UX**: REQ-015-ux-design.md
> **상태**: 리뷰 대기 (Review Ready)
> **최종 갱신**: 2026-02-22

---

## 1. 아키텍처 변경 분석

### 1.1 변경 영향 범위 (Module Impact Map)

```
변경 수준:
  [H] = Heavy (핵심 로직 추가/변경)
  [M] = Moderate (메서드/옵션 추가)
  [L] = Light (import 추가, 호출 1~2줄)

Backend (src/):
  src/core/cross-project/cross-project-manager.ts  [M] detectAndSave() 신규
  src/core/cross-project/gap-detector.ts           [H] 신규 모듈
  src/commands/projects.ts                         [M] --auto-save 분기
  src/commands/save-result.ts                      [M] 후처리 hook
  src/commands/init.ts                             [M] 보완 분석 스캔
  src/commands/cross-analyze.ts                    [M] --supplement 옵션
  src/commands/gap-check.ts                        [H] 신규 명령어
  src/router.ts                                    [L] gap-check 등록
  src/server/web-server.ts                         [M] /api/gap-check 엔드포인트
  src/core/analysis/result-manager.ts              [M] supplement 결과 지원
  src/types/analysis.ts                            [L] supplement 필드 추가
  src/core/cross-project/types.ts                  [L] GapItem 타입 추가
  SKILL.md                                         [M] Step 4.5 + 자연어 매핑

Frontend (web/):
  web/src/components/projects/GapHealthWidget.tsx   [H] 신규
  web/src/components/projects/GapDetailList.tsx     [H] 신규
  web/src/components/cross-project/CrossProjectTabs.tsx [H] 신규
  web/src/components/dashboard/SupplementBanner.tsx [M] 신규
  web/src/pages/ProjectBoard.tsx                   [M] GapHealthWidget 삽입
  web/src/pages/FlowChart.tsx                      [M] CrossProjectTabs 사용
  web/src/components/layout/ResultCard.tsx          [L] [보완] 라벨
  web/src/components/project-board/AnalysisHistoryTable.tsx [L] [보완] 배지
  web/src/pages/Dashboard.tsx                      [L] SupplementBanner 조건부 표시
  web/src/components/cross-project/CrossProjectDiagram.tsx [L] hover 하이라이트
```

### 1.2 신규 모듈

| 모듈 | 경로 | 역할 | 주요 의존성 |
|------|------|------|------------|
| GapDetector | `src/core/cross-project/gap-detector.ts` | 4가지 유형의 영향도 누락 탐지 엔진 | CrossProjectManager, ResultManager, Indexer, ConfigManager |
| GapCheckCommand | `src/commands/gap-check.ts` | `gap-check` CLI 명령어 핸들러 | GapDetector |
| GapHealthWidget | `web/src/components/projects/GapHealthWidget.tsx` | 프로젝트 보드 건강 상태 위젯 | `/api/gap-check` |
| GapDetailList | `web/src/components/projects/GapDetailList.tsx` | Gap 상세 목록 (Widget 하위) | GapHealthWidget props |
| CrossProjectTabs | `web/src/components/cross-project/CrossProjectTabs.tsx` | 플로우차트 "전체" 모드 4탭 컨테이너 | CrossProjectDiagram, SharedEntityMap, CrossProjectSummary, ReverseSearch |
| SupplementBanner | `web/src/components/dashboard/SupplementBanner.tsx` | 보완 분석 원본 참조 배너 | resultStore |

### 1.3 데이터 흐름 변경

#### 1.3.1 기존 흐름 (As-Is)

```
분석 실행 → save-result → ResultManager.save() → 끝
                                                     (cross-project.json 비어있음)
                                                     (플로우차트 "전체" 모드 빈 화면)
```

#### 1.3.2 변경 후 흐름 (To-Be)

```
분석 실행 → save-result → ResultManager.save()
                ↓
            [후처리 hook]
                ↓
            등록 프로젝트 >= 2?
                ↓ Yes
            CrossProjectManager.detectAndSave()
                ↓
            cross-project.json 갱신 (autoDetected 링크)
                ↓
            경량 gap-check (Stale + 미분석만)
                ↓
            결과 사용자에게 보고

신규 프로젝트 등록:
  init → 인덱싱 → registerProject()
                       ↓
                  기존 분석 결과 스캔
                       ↓
                  매칭도 계산 (parsedSpec vs 신규 인덱스)
                       ↓
                  매칭 >= 20%인 항목 제안
                       ↓
                  사용자 승인 → 보완 분석 실행
                       ↓
                  supplement-{id}.json 저장
                       ↓
                  detectAndSave() 재실행
```

#### 1.3.3 API 데이터 흐름

```
GET /api/gap-check
  ← GapDetector.detect()
    ← CrossProjectManager.loadConfig()
    ← ResultManager.list() (각 프로젝트)
    ← Indexer.loadIndex() (각 프로젝트)
    ← git log (인덱스 갱신 체크)
  → { gaps[], summary, lastCheckedAt }
```

---

## 2. SKILL.md 프로토콜 변경

### 2.1 Step 4.5 추가 설계

**위치**: Step 4 (결과 저장) 직후, Step 5 (보고) 직전

```markdown
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

**구현 메커니즘**: Step 4.5는 AI 프로토콜 수준에서 실행하되, `save-result` 명령어 내부 후처리 hook으로도 동일 로직을 트리거한다. 이로써 CLI 직접 실행(`save-result`)과 AI 분석 프로토콜 양쪽 모두에서 자동 갱신이 보장된다.

### 2.2 Step 2.5 강화 포인트

현재 Step 2.5는 연관 프로젝트 식별 프로토콜이 정의되어 있으나, `cross-project.json`의 기존 링크를 활용하지 않는다. 강화 포인트:

1. **기존 링크 참조**: `cross-project.json`에 이미 감지된 링크가 있으면, 해당 프로젝트는 매칭도 계산 이전에 후보군에 자동 포함
2. **매칭도 보정**: 기존 링크가 있는 프로젝트는 매칭도에 +10% 보너스 (이미 의존성이 확인된 프로젝트이므로)
3. **보완 분석 결과 참조**: `supplement-` 접두사 결과가 있으면 "이전에 보완 분석된 프로젝트" 표시

### 2.3 기존 분석 흐름에 미치는 영향

| Step | 변경 | 영향 |
|------|------|------|
| Step 1 (인덱스 로드) | 변경 없음 | - |
| Step 2 (기획서 파싱) | 변경 없음 | - |
| Step 2.5 (멀티프로젝트) | 강화 (기존 링크 참조) | cross-project.json 읽기 추가 (0.1초 미만) |
| Step 3 (영향도 분석) | 변경 없음 | - |
| Step 4 (결과 저장) | 변경 없음 | - |
| **Step 4.5** (신규) | **신규 추가** | detectLinks 실행 (1~3초), gap-check 경량 (0.5초) |
| Step 5 (보고) | 변경 없음 | - |

**총 추가 시간**: 1.5~3.5초 (4개 프로젝트 기준)
**기존 흐름 롤백 리스크**: 없음. Step 4.5 실패 시 분석 결과는 이미 저장 완료.

### 2.4 자연어 매핑 테이블 추가

```markdown
| 사용자 의도 | 실행 방식 | 트리거 예시 |
|------------|----------|-----------|
| 누락 탐지 | `node {skill_dir}/dist/index.js gap-check` | "누락 확인", "갭 체크", "빠진 거 없나", "gap check" |
| 누락 자동 해결 | `node {skill_dir}/dist/index.js gap-check --fix` | "누락 자동 해결", "갭 수정", "gap fix" |
| 보완 분석 | `node {skill_dir}/dist/index.js cross-analyze --supplement --project <id>` | "보완 분석", "신규 프로젝트 반영" |
```

---

## 3. 백엔드 구현 계획

### 3.1 `detectLinks --auto-save` 옵션 추가 (projects.ts)

**변경 파일**: `src/commands/projects.ts` - `handleDetectLinks()` 메서드

**변경 내용**:
```typescript
// 기존 handleDetectLinks 시그니처 변경
private async handleDetectLinks(config: ProjectsConfig): Promise<CommandResult> {
  const autoSave = this.args.includes('--auto-save');
  // ... 기존 detectLinks() 호출 ...

  if (autoSave && detectedLinks.length > 0) {
    await manager.detectAndSave(indexer, projectIds);
    logger.success(`${detectedLinks.length}건의 의존성이 cross-project.json에 저장되었습니다.`);
  } else {
    // 기존 동작: 결과 표시만
  }
}
```

**호환성**: `--auto-save` 없이 실행 시 100% 기존 동작 유지.

### 3.2 `CrossProjectManager.detectAndSave()` 신규 메서드

**변경 파일**: `src/core/cross-project/cross-project-manager.ts`

```typescript
interface DetectAndSaveResult {
  newLinks: number;
  preservedManualLinks: number;
  totalLinks: number;
  byType: { api: number; sharedDb: number; event: number };
}

async detectAndSave(indexer: Indexer, projectIds: string[]): Promise<DetectAndSaveResult> {
  // 1. 기존 설정 로드
  const config = await this.loadConfig();

  // 2. 수동 링크(autoDetected: false) 분리 보존
  const manualLinks = config.links.filter(l => !l.autoDetected);

  // 3. 자동 감지 실행
  const detectedLinks = await this.detectLinks(indexer, projectIds);

  // 4. 수동 링크 + 자동 감지 링크 병합 (중복 제거)
  const mergedLinks = [...manualLinks];
  for (const detected of detectedLinks) {
    const isDuplicate = mergedLinks.some(
      m => m.source === detected.source && m.target === detected.target
    );
    if (!isDuplicate) {
      mergedLinks.push({
        ...detected,
        confirmedAt: new Date().toISOString(),
      });
    }
  }

  // 5. 저장
  config.links = mergedLinks;
  await this.saveConfig(config);

  // 6. 통계 반환
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

**설계 결정**: Open Item 7.3에서 선택지 1 채택 -- 자동 감지 링크(`autoDetected: true`)는 매번 전부 삭제 후 최신 감지 결과로 교체. 수동 링크(`autoDetected: false`)는 항상 보존.

### 3.3 `save-result` 후처리 hook

**변경 파일**: `src/commands/save-result.ts`

```typescript
async execute(): Promise<CommandResult> {
  // ... 기존 저장 로직 ...

  const savedId = await resultManager.save(result, resolvedProjectId);
  logger.success(`분석 결과가 저장되었습니다: ${savedId}`);

  // [신규] 크로스 프로젝트 후처리 hook
  const skipCrossDetect = this.args.includes('--skip-cross-detect');
  if (!skipCrossDetect) {
    await this.runCrossProjectHook(resolvedProjectId);
  }

  return { code: ResultCode.SUCCESS, ... };
}

private async runCrossProjectHook(projectId: string): Promise<void> {
  try {
    // 프로젝트 목록 로드
    const projectsPath = path.join(getImpactDir(), 'projects.json');
    const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
    const projectIds = projectsConfig?.projects?.map(p => p.id) || [];

    if (projectIds.length < 2) return;

    // detectAndSave 실행
    const manager = new CrossProjectManager();
    const indexer = new Indexer();
    const result = await manager.detectAndSave(indexer, projectIds);

    logger.info(
      `크로스 프로젝트 갱신: 신규 ${result.newLinks}건, ` +
      `기존 유지 ${result.preservedManualLinks}건, ` +
      `총 ${result.totalLinks}건`
    );

    // 경량 gap-check (Stale + 미분석만)
    const gapDetector = new GapDetector();
    const gaps = await gapDetector.detectLight(projectIds);
    if (gaps.length > 0) {
      logger.warn(`영향도 누락 ${gaps.length}건 감지. gap-check 명령어로 확인하세요.`);
    }
  } catch (err) {
    // 후처리 실패 시 경고만 출력, 분석 결과 저장은 롤백하지 않음
    logger.warn(`크로스 프로젝트 갱신 실패 (결과 저장은 완료됨): ${err}`);
  }
}
```

### 3.4 `gap-check` 신규 명령어

**신규 파일**: `src/commands/gap-check.ts`

```typescript
export class GapCheckCommand implements Command {
  readonly name = 'gap-check';
  readonly description = '영향도 누락 탐지 및 해결';

  async execute(): Promise<CommandResult> {
    const projectFilter = this.getOption('--project');
    const autoFix = this.args.includes('--fix');

    const detector = new GapDetector();

    if (autoFix) {
      const result = await detector.fix(projectFilter);
      this.printFixResult(result);
    } else {
      const gaps = await detector.detect(projectFilter);
      this.printGaps(gaps);
    }
  }
}
```

**신규 파일**: `src/core/cross-project/gap-detector.ts`

```typescript
export interface GapItem {
  severity: 'high' | 'medium' | 'low';
  type: 'stale_link' | 'unanalyzed_project' | 'low_confidence' | 'outdated_index';
  title: string;
  description: string;
  fixCommand: string;
  count: number;
  details: GapDetail[];
  autoFixable: boolean;
}

export interface GapDetail {
  subject: string;
  info: string;
  lastUpdated?: string;
}

export class GapDetector {
  /**
   * 전체 누락 탐지 (4가지 유형)
   */
  async detect(projectFilter?: string): Promise<GapItem[]> {
    const gaps: GapItem[] = [];

    // 1. Stale 링크 탐지 (High)
    gaps.push(...await this.detectStaleLinks(projectFilter));

    // 2. 미분석 프로젝트 탐지 (Medium)
    gaps.push(...await this.detectUnanalyzedProjects(projectFilter));

    // 3. 저신뢰도 분석 탐지 (Medium)
    gaps.push(...await this.detectLowConfidence(projectFilter));

    // 4. 인덱스 미갱신 탐지 (Low)
    gaps.push(...await this.detectOutdatedIndex(projectFilter));

    return gaps;
  }

  /**
   * 경량 탐지 (Stale + 미분석만, save-result 후처리용)
   */
  async detectLight(projectIds: string[]): Promise<GapItem[]> {
    const gaps: GapItem[] = [];
    gaps.push(...await this.detectStaleLinks());
    gaps.push(...await this.detectUnanalyzedProjects());
    return gaps;
  }

  /**
   * 자동 해결
   */
  async fix(projectFilter?: string): Promise<FixResult> {
    // 1. 인덱스 미갱신 → reindex
    // 2. 크로스 프로젝트 재감지 → detectAndSave
    // 3. Stale 링크 정리
    // 4. 해결 불가 항목(저신뢰도) → 안내만
  }
}
```

**Stale 링크 탐지 알고리즘**:
1. `cross-project.json`의 각 링크에 대해 source/target 프로젝트의 인덱스 `meta.json`의 `updatedAt` 확인
2. 링크의 `confirmedAt`보다 인덱스 `updatedAt`이 최신이면 Stale로 판정
3. 프로젝트가 삭제/아카이브 상태이면 Stale로 판정

**인덱스 미갱신 탐지 알고리즘**:
1. 프로젝트 경로에서 `git log -1 --format=%ci` 실행하여 마지막 커밋 날짜 획득
2. 인덱스 `meta.json`의 `updatedAt`과 비교
3. 커밋이 인덱스보다 최신이면 "미갱신"으로 판정

### 3.5 보완 분석 흐름

**변경 파일**: `src/commands/init.ts`

`registerProject()` 이후 보완 분석 스캔 로직 추가:

```typescript
// init.ts execute() 끝부분에 추가
const supplementScanner = new SupplementScanner();
const candidates = await supplementScanner.scan(projectId, codeIndex);

if (candidates.length > 0) {
  console.log(`\n기존 분석 중 이 프로젝트에 영향을 줄 수 있는 항목:`);
  for (const [i, c] of candidates.entries()) {
    console.log(`  [${i+1}] "${c.specTitle}" (${c.sourceProject}) - 매칭도 ${c.matchScore}%`);
  }
  console.log(`\n보완 분석은 CLI에서 수동 실행할 수 있습니다:`);
  console.log(`  /impact cross-analyze --supplement --project ${projectId}`);
}
```

**SupplementScanner 클래스** (신규, `src/core/cross-project/supplement-scanner.ts`):

```typescript
export class SupplementScanner {
  async scan(newProjectId: string, newIndex: CodeIndex): Promise<SupplementCandidate[]> {
    // 1. 다른 프로젝트의 분석 결과 순회
    // 2. parsedSpec.keywords + analysisSummary.keyFindings와 신규 인덱스 비교
    // 3. 매칭도 20% 이상 후보 반환
  }
}
```

**Open Item 7.1 결정**: 선택지 3 채택 -- `parsedSpec` + `analysisSummary.keyFindings` 조합 사용. 원본 기획서 파일 경로 의존 없이 중간 정밀도 확보.

**보완 분석 결과 저장 형식**:
- 경로: `~/.impact/projects/{newProjectId}/results/supplement-{originalAnalysisId}.json`
- 추가 필드: `analysisMethod: "claude-native-supplement"`, `supplementOf: string`, `triggerProject: string`

### 3.6 `cross-analyze --supplement` 옵션

**변경 파일**: `src/commands/cross-analyze.ts`

```typescript
// 기존 execute() 상단에 --supplement 분기 추가
const supplementIdx = this.args.indexOf('--supplement');
if (supplementIdx !== -1) {
  const projectId = this.getOption('--project');
  return await this.handleSupplement(projectId);
}

private async handleSupplement(projectId?: string): Promise<CommandResult> {
  if (!projectId) {
    return { code: ResultCode.FAILURE, message: '--project is required for --supplement' };
  }

  const scanner = new SupplementScanner();
  const indexer = new Indexer();
  const newIndex = await indexer.loadIndex(projectId);

  if (!newIndex) {
    return { code: ResultCode.FAILURE, message: `Index not found for ${projectId}` };
  }

  const candidates = await scanner.scan(projectId, newIndex);
  // 매칭도 50% 이상 자동 실행, 나머지 안내
  // 보완 결과 저장 → detectAndSave 재실행
}
```

### 3.7 API 엔드포인트 추가

**변경 파일**: `src/server/web-server.ts`

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/gap-check` | GET | 영향도 누락 탐지 결과 반환 |
| `/api/gap-check?projectId=<id>` | GET | 특정 프로젝트 필터 |

```typescript
app.get('/api/gap-check', async (req: Request, res: Response) => {
  try {
    const projectFilter = req.query.projectId as string | undefined;
    const detector = new GapDetector(basePath);
    const gaps = await detector.detect(projectFilter);

    const summary = {
      high: gaps.filter(g => g.severity === 'high').reduce((s, g) => s + g.count, 0),
      medium: gaps.filter(g => g.severity === 'medium').reduce((s, g) => s + g.count, 0),
      low: gaps.filter(g => g.severity === 'low').reduce((s, g) => s + g.count, 0),
      total: gaps.reduce((s, g) => s + g.count, 0),
    };

    res.json({
      gaps,
      summary,
      lastCheckedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to run gap check:', error);
    res.status(500).json({ error: 'Failed to run gap check' });
  }
});
```

**기존 API 영향**: 없음. `/api/cross-project/links`는 `cross-project.json`을 직접 읽으므로 데이터만 채워지면 자동으로 작동한다.

### 3.8 ResultManager 보완 분석 지원

**변경 파일**: `src/core/analysis/result-manager.ts`

```typescript
// ResultSummary 인터페이스 확장
export interface ResultSummary {
  // ... 기존 필드 ...
  isSupplement?: boolean;
  supplementOf?: string;
  triggerProject?: string;
}

// save() 메서드에서 supplement 메타데이터 처리
async save(result: ConfidenceEnrichedResult, projectId: string, title?: string): Promise<string> {
  // ... 기존 로직 ...

  // supplement 결과인 경우 인덱스에 추가 메타데이터 기록
  const supplementOf = (result as any).supplementOf;
  const triggerProject = (result as any).triggerProject;

  await this.updateIndex(projectId, {
    ...summary,
    isSupplement: !!supplementOf,
    supplementOf,
    triggerProject,
  });
}
```

### 3.9 타입 확장

**변경 파일**: `src/types/analysis.ts`

```typescript
// ConfidenceEnrichedResult에 선택적 보완 분석 필드 추가
export interface ConfidenceEnrichedResult {
  // ... 기존 필드 ...
  supplementOf?: string;       // 원본 분석 ID
  triggerProject?: string;     // 보완 트리거 프로젝트
  analysisMethod?: string;     // 'claude-native' | 'claude-native-supplement' | 'rule-based'
}
```

**변경 파일**: `src/core/cross-project/types.ts`

```typescript
// GapItem, GapDetail 타입 추가 (gap-detector.ts와 web-server.ts에서 공유)
export interface GapItem { ... }  // 3.4절 참조
export interface GapDetail { ... }

export interface GapCheckResponse {
  gaps: GapItem[];
  summary: { high: number; medium: number; low: number; total: number };
  lastCheckedAt: string;
}
```

---

## 4. 프론트엔드 구현 계획

### 4.1 GapHealthWidget 컴포넌트

**파일**: `web/src/components/projects/GapHealthWidget.tsx`

**구현 내용**:
- `/api/gap-check` API 호출 (프로젝트 보드 마운트 시)
- KPI 카드 3개 (HIGH/MEDIUM/LOW) -- UX 설계 2.7 스타일 토큰 적용
- 상세 목록 펼침/접힘 -- `isExpanded` 상태 토글
- CTA 버튼 클릭 시 클립보드 복사 + 토스트 -- `navigator.clipboard.writeText()`
- 누락 0건 시 한 줄 축소 상태
- 로딩/에러/빈 상태 처리
- `/api/gap-check` 404 시 위젯 숨김 (점진적 배포 대응)

**위치**: `ProjectBoard.tsx`의 `ProjectStatusBanner` 아래, `AnalysisHistoryTable` 위

### 4.2 GapDetailList 컴포넌트

**파일**: `web/src/components/projects/GapDetailList.tsx`

**Props**:
```typescript
interface GapDetailListProps {
  gaps: GapItem[];
  onCopyCommand: (command: string) => void;
}
```

- 심각도별 그룹핑 (HIGH -> MEDIUM -> LOW 순)
- 각 항목: 심각도 배지 + 유형 + 건수 + 설명 + CTA 버튼
- CTA 버튼 동작: `onCopyCommand(gap.fixCommand)` 호출

### 4.3 플로우차트 "전체" 모드 탭 기반 4뷰

**파일**: `web/src/components/cross-project/CrossProjectTabs.tsx`

**탭 구조**:
| 탭 | 컴포넌트 | 데이터 소스 |
|----|---------|-----------|
| 의존성 | `CrossProjectDiagram` | `/api/cross-project/links` |
| 공유 엔티티 | `SharedEntityMap` (tables 파트) | `/api/shared-entities` |
| Pub/Sub | `SharedEntityMap` (events 파트) | `/api/shared-entities` |
| 요약 | `CrossProjectSummary` + `ReverseSearch` | `/api/cross-project/links`, `/api/cross-project/groups` |

**구현 내용**:
- `FlowChart.tsx`에서 `projectMode === 'all'`일 때 기존 `CrossProjectDiagram` + `CrossProjectSummary` 대신 `CrossProjectTabs` 렌더링
- 탭 전환 시 데이터 재호출 없음 (최초 진입 시 3개 API 병렬 호출, 메모리 캐시)
- 활성 탭 스타일: UX 설계 3.9 토큰 적용

**`CrossProjectDiagram` 개선**:
- `onNodeClick`: 프로젝트 보드로 이동 (`switchProject` + `navigate('/')`)
- hover 하이라이트: 연결된 엣지만 `opacity: 1`, 나머지 `opacity: 0.3`
- 엣지 클릭: 하단 토스트에 링크 상세 (타입, API 목록, autoDetected 여부)
- 범례 추가: API(blue), Shared Table(purple), Event(red dashed), auto/manual 구분

### 4.4 보완 분석 UI

**SupplementBanner** (`web/src/components/dashboard/SupplementBanner.tsx`):
- 보완 분석 결과 선택 시 `/analysis` 상단에 표시
- 원본 분석 참조 링크: 클릭 시 LNB에서 원본 결과 선택
- 스타일: `bg-violet-50 border border-violet-200` (UX 설계 4.5)

**ResultCard 수정** (`web/src/components/layout/ResultCard.tsx`):
- `isSupplement` prop 추가
- `[보완]` 라벨: `bg-violet-100 text-violet-700 rounded text-xs`
- 좌측 보더: `border-violet-400`
- 기획서명 포맷: `{원본 기획서명} -> {triggerProject}`

**AnalysisHistoryTable 수정**:
- 보완 분석 행에 `[보완]` 배지 추가
- 기획서명 포맷 동일

---

## 5. TASK 분해 & 로드맵

### 5.1 Phase 개요

| Phase | 범위 | TASK 수 | 포인트 | 커밋 기준 |
|:-----:|------|:------:|:-----:|----------|
| Phase 1 | 핵심 자동화 (detectAndSave + save-result hook) | 6 | 19 | 기능 단위 커밋 |
| Phase 2 | Gap Detector + CLI | 5 | 18 | GapDetector 완성 + CLI |
| Phase 3 | 보완 분석 (Supplement) | 5 | 16 | init hook + cross-analyze --supplement |
| Phase 4 | API + 프론트엔드 위젯 | 5 | 17 | API + GapHealthWidget |
| Phase 5 | 플로우차트 "전체" 모드 개선 | 4 | 12 | CrossProjectTabs + 인터랙션 |
| Phase 6 | SKILL.md + 통합 테스트 + 마무리 | 4 | 10 | 프로토콜 + E2E |
| **합계** | | **29** | **92** | |

### 5.2 Phase 1: 핵심 자동화 (TASK-152 ~ TASK-157)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-152 | CrossProjectManager.detectAndSave() 구현 | 3 | `cross-project-manager.ts` | - |
| TASK-153 | detectAndSave() 단위 테스트 | 3 | `__tests__/cross-project-manager.test.ts` | TASK-152 |
| TASK-154 | projects --detect-links --auto-save 옵션 추가 | 2 | `projects.ts` | TASK-152 |
| TASK-155 | save-result 후처리 hook 구현 | 3 | `save-result.ts` | TASK-152 |
| TASK-156 | save-result hook 단위 테스트 (성공/실패/skip) | 3 | `__tests__/save-result.test.ts` | TASK-155 |
| TASK-157 | --skip-cross-detect 옵션 + 기존 동작 회귀 테스트 | 5 | `save-result.ts`, `projects.ts` | TASK-155, TASK-154 |

**Phase 1 커밋 포인트**: TASK-153 완료 후 1회, TASK-157 완료 후 1회 (총 2 커밋)

### 5.3 Phase 2: Gap Detector + CLI (TASK-158 ~ TASK-162)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-158 | GapDetector 클래스 구현 (4가지 탐지 유형) | 5 | `gap-detector.ts`, `types.ts` | TASK-152 |
| TASK-159 | GapDetector 단위 테스트 (유형별 mock) | 5 | `__tests__/gap-detector.test.ts` | TASK-158 |
| TASK-160 | gap-check CLI 명령어 + router 등록 | 3 | `gap-check.ts`, `router.ts` | TASK-158 |
| TASK-161 | gap-check --fix 자동 해결 모드 | 3 | `gap-detector.ts`, `gap-check.ts` | TASK-160 |
| TASK-162 | gap-check --project 필터 + CLI 통합 테스트 | 2 | `__tests__/gap-check.test.ts` | TASK-161 |

**Phase 2 커밋 포인트**: TASK-159 완료 후 1회, TASK-162 완료 후 1회 (총 2 커밋)

### 5.4 Phase 3: 보완 분석 (TASK-163 ~ TASK-167)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-163 | SupplementScanner 클래스 구현 | 3 | `supplement-scanner.ts` | - |
| TASK-164 | init 명령어 보완 분석 스캔 hook 추가 | 3 | `init.ts` | TASK-163 |
| TASK-165 | cross-analyze --supplement --project 옵션 | 3 | `cross-analyze.ts` | TASK-163 |
| TASK-166 | ResultManager supplement 결과 저장/조회 지원 | 3 | `result-manager.ts`, `analysis.ts` | - |
| TASK-167 | 보완 분석 단위 테스트 + 통합 테스트 | 4 | `__tests__/supplement*.test.ts` | TASK-164, TASK-165, TASK-166 |

**Phase 3 커밋 포인트**: TASK-166 완료 후 1회, TASK-167 완료 후 1회 (총 2 커밋)

### 5.5 Phase 4: API + 프론트엔드 위젯 (TASK-168 ~ TASK-172)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-168 | /api/gap-check 엔드포인트 구현 | 3 | `web-server.ts` | TASK-158 |
| TASK-169 | /api/gap-check API 테스트 | 2 | `__tests__/web-server.test.ts` | TASK-168 |
| TASK-170 | GapHealthWidget + GapDetailList 구현 | 5 | `GapHealthWidget.tsx`, `GapDetailList.tsx` | TASK-168 |
| TASK-171 | ProjectBoard에 GapHealthWidget 통합 | 2 | `ProjectBoard.tsx` | TASK-170 |
| TASK-172 | GapHealthWidget 프론트엔드 테스트 (Vitest) | 5 | `__tests__/GapHealthWidget.test.tsx` | TASK-171 |

**Phase 4 커밋 포인트**: TASK-169 완료 후 1회, TASK-172 완료 후 1회 (총 2 커밋)

### 5.6 Phase 5: 플로우차트 "전체" 모드 개선 (TASK-173 ~ TASK-176)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-173 | CrossProjectTabs 컴포넌트 구현 (4탭) | 3 | `CrossProjectTabs.tsx` | - |
| TASK-174 | FlowChart에서 CrossProjectTabs 통합 | 3 | `FlowChart.tsx` | TASK-173 |
| TASK-175 | CrossProjectDiagram hover 하이라이트 + 노드 클릭 | 3 | `CrossProjectDiagram.tsx` | TASK-174 |
| TASK-176 | 보완 분석 UI (SupplementBanner + ResultCard 라벨) | 3 | `SupplementBanner.tsx`, `ResultCard.tsx`, `AnalysisHistoryTable.tsx`, `Dashboard.tsx` | TASK-166 |

**Phase 5 커밋 포인트**: TASK-175 완료 후 1회, TASK-176 완료 후 1회 (총 2 커밋)

### 5.7 Phase 6: SKILL.md + 통합 테스트 + 마무리 (TASK-177 ~ TASK-180)

| TASK | 제목 | 포인트 | 영향 파일 | 의존성 |
|:----:|------|:-----:|----------|:------:|
| TASK-177 | SKILL.md Step 4.5 + Step 2.5 강화 + 자연어 매핑 | 2 | `SKILL.md` | TASK-157 |
| TASK-178 | 통합 테스트: save-result -> cross-project 갱신 -> FlowChart | 3 | `__tests__/integration/cross-project-flow.test.ts` | Phase 1~5 전체 |
| TASK-179 | 통합 테스트: init -> 보완 분석 스캔 -> supplement 저장 | 3 | `__tests__/integration/supplement-flow.test.ts` | Phase 3 |
| TASK-180 | 빈 상태/에러 상태 QA + 접근성 최종 점검 | 2 | 전체 프론트엔드 | Phase 4, 5 |

**Phase 6 커밋 포인트**: TASK-178 완료 후 1회, TASK-180 완료 후 1회 (총 2 커밋)

### 5.8 총 포인트 & 로드맵 요약

```
총 TASK:    29개
총 포인트:  92포인트
총 Phase:   6개
총 커밋:    12회 (Phase당 2회)

의존성 그래프 요약:
  Phase 1 (기반) ─┬──> Phase 2 (GapDetector)
                  ├──> Phase 3 (보완 분석)     ──> Phase 5 (프론트엔드 개선)
                  └──> Phase 4 (API + 위젯) ──> Phase 5
  Phase 1~5 ──────────────────────────────────> Phase 6 (통합 + 마무리)

병렬화 가능:
  Phase 2 ∥ Phase 3  (서로 독립적)
  Phase 4 ∥ Phase 5  (TASK-176만 Phase 3 의존, 나머지 독립)
```

---

## 6. 리스크 & 성능 고려사항

### 6.1 detectLinks() 실행 시간

| 항목 | 상세 |
|------|------|
| **현재 동작** | 4개 프로젝트의 인덱스를 모두 로드 + API 매칭(O(n^2)) + SharedEntityIndexer.build() |
| **예상 시간** | 4개 프로젝트 기준 1~3초 (인덱스 파일 I/O가 지배적) |
| **최악 케이스** | 10+ 프로젝트, 각각 1000+ API 엔드포인트: 5~10초 |
| **완화 전략** | (1) `--skip-cross-detect`로 비활성화 가능, (2) 인덱스 메타만 캐시하여 불필요한 full-load 회피, (3) 향후 증분 감지(변경된 프로젝트만) 도입 가능 |

### 6.2 대규모 프로젝트 인덱스 로드 성능

| 항목 | 상세 |
|------|------|
| **현재 동작** | `Indexer.loadIndex()`가 전체 CodeIndex JSON을 메모리 로드 |
| **병목** | 프로젝트당 인덱스 크기 100KB~5MB (API, 모델, 컴포넌트 수에 비례) |
| **완화 전략** | (1) detectLinks에서 필요한 데이터만 파싱 (apis 필드만), (2) GapDetector의 stale 체크는 meta.json만 읽음 (수 KB), (3) SharedEntityIndexer는 기존 코드 재사용으로 추가 오버헤드 없음 |

### 6.3 cross-project.json 동시 접근 문제

| 항목 | 상세 |
|------|------|
| **리스크** | 여러 분석이 병렬 실행 시 read-modify-write 경쟁 조건 |
| **현재 상태** | `writeJsonFile`이 `fs.writeFileSync` 사용 -- OS 수준 원자적이나 RMW 패턴에서 손실 가능 |
| **발생 확률** | 낮음 (KIC는 단일 사용자 CLI 도구, 병렬 분석 시나리오 드뭄) |
| **완화 전략** | Phase 1에서 `proper-lockfile` 또는 간단한 `.lock` 파일 메커니즘 도입. `detectAndSave()`에서 lock 획득 -> 작업 -> release 패턴 적용 |
| **구현 방식** | `src/utils/file-lock.ts` 신규 -- `lockFile()`, `unlockFile()` 유틸리티. timeout 3초, retry 3회 |

### 6.4 git log 실행 성능

| 항목 | 상세 |
|------|------|
| **리스크** | GapDetector의 "인덱스 미갱신" 탐지에서 `git log -1` 실행 |
| **예상 시간** | 프로젝트당 0.1~0.5초 (로컬 git) |
| **완화 전략** | (1) `child_process.execSync`로 동기 실행 (async 불필요), (2) timeout 2초 설정, (3) git 미설치/미초기화 프로젝트는 건너뜀 |

### 6.5 프론트엔드 API 호출 최적화

| 항목 | 상세 |
|------|------|
| **리스크** | ProjectBoard 마운트 시 기존 API + `/api/gap-check` 추가 호출 |
| **완화 전략** | (1) gap-check API는 병렬 호출 (`Promise.all`), (2) 탭 전환 시 데이터 재호출 없음 (메모리 캐시), (3) gap-check 응답 캐시 (5분 TTL, 새로고침 버튼으로 강제 갱신) |

---

## 7. 피드백 검토 (R9~R12)

### R9: PRD AC와 기술 설계의 1:1 매핑 검증

| AC ID | PRD 기준 | 기술 설계 커버리지 | 검증 |
|:-----:|----------|------------------|:----:|
| AC-015-1-1 | save-result 후 cross-project.json 자동 저장 | TASK-155 (save-result hook) + TASK-152 (detectAndSave) | OK |
| AC-015-1-2 | 수동 링크 보존 | TASK-152 detectAndSave()에서 manualLinks 분리 로직 | OK |
| AC-015-1-3 | --detect-links 단독 실행 시 기존 동작 유지 | TASK-154 --auto-save 없이는 기존 동작 | OK |
| AC-015-1-4 | --detect-links --auto-save 정상 동작 | TASK-154 | OK |
| AC-015-1-5 | 플로우차트 "전체" 모드 데이터 표시 | TASK-174 (CrossProjectTabs 통합) -- 기존 API 자동 동작 | OK |
| AC-015-1-6 | 갱신 실패 시 결과 저장 롤백 안 됨 | TASK-155 try-catch에서 경고만 출력 | OK |
| AC-015-1-7 | --skip-cross-detect 옵션 | TASK-157 | OK |
| AC-015-2-1 | init 후 보완 분석 제안 | TASK-164 (init hook) | OK |
| AC-015-2-2 | supplement 결과 저장 형식 | TASK-166 (ResultManager supplement 지원) | OK |
| AC-015-2-3 | 기존 결과 미수정 | TASK-166 별도 파일 저장 설계 | OK |
| AC-015-2-4 | 기존 결과 없으면 제안 건너뜀 | TASK-164 조건 분기 | OK |
| AC-015-2-5 | cross-analyze --supplement CLI | TASK-165 | OK |
| AC-015-3-1 | 4가지 유형 누락 탐지 | TASK-158 (GapDetector 4유형) | OK |
| AC-015-3-2 | --fix 자동 해결 | TASK-161 | OK |
| AC-015-3-3 | --project 필터 | TASK-162 | OK |
| AC-015-3-4 | /api/gap-check JSON 응답 | TASK-168 + TASK-169 | OK |
| AC-015-3-5 | 프로젝트 보드 위젯 | TASK-170 + TASK-171 | OK |
| AC-015-3-6 | 저신뢰도 자동 해결 불가 | TASK-161 autoFixable: false 설계 | OK |

**결과**: 18개 AC 전체 커버 완료. 누락 없음.

### R10: 기존 코드 변경 최소화 원칙 준수 검토

| 기존 코드 | 변경 수준 | 최소화 방법 |
|----------|:---------:|-----------|
| `cross-project-manager.ts` | 메서드 1개 추가 | 기존 `detectLinks()` 변경 없음, `detectAndSave()`는 신규 메서드로 분리 |
| `projects.ts` | 분기 1개 추가 | `handleDetectLinks()` 내부에 `--auto-save` 조건 분기만 추가 |
| `save-result.ts` | private 메서드 1개 추가 | 기존 `execute()` 끝에 hook 호출 1줄 추가, 실패 시 기존 흐름 영향 없음 |
| `init.ts` | 함수 호출 블록 추가 | `registerProject()` 이후 보완 스캔 블록 추가, 기존 인덱싱 로직 변경 없음 |
| `cross-analyze.ts` | 분기 1개 추가 | `execute()` 상단에 `--supplement` 분기, 기존 분석 로직 변경 없음 |
| `router.ts` | 1줄 추가 | `COMMANDS` 맵에 `'gap-check': GapCheckCommand` 추가 |
| `web-server.ts` | API 핸들러 1개 추가 | 기존 엔드포인트 변경 없음, 새 `/api/gap-check` 추가만 |
| `result-manager.ts` | 인터페이스 필드 3개 추가 | `ResultSummary`에 optional 필드 추가, 기존 save/load 로직 변경 없음 |
| `analysis.ts` | 필드 2개 추가 | optional 필드 추가, 기존 타입 호환성 유지 |

**원칙 준수 평가**: 모든 기존 코드 변경은 "추가" 패턴(새 메서드, 새 분기, 새 필드)으로만 수행. 기존 로직의 삭제/수정은 없음. optional 필드 추가로 타입 하위 호환성 보장. `--skip-cross-detect` 옵션으로 후처리 비활성화 가능하여 안전 장치 확보.

### R11: 테스트 전략 검토

#### 단위 테스트 (Jest, root)

| 테스트 대상 | TASK | 주요 케이스 |
|-----------|:----:|-----------|
| detectAndSave() | TASK-153 | 수동 링크 보존, 중복 제거, 빈 프로젝트, 2개 미만 프로젝트 |
| save-result hook | TASK-156 | 성공 케이스, hook 실패 시 결과 보존, --skip-cross-detect |
| GapDetector.detect() | TASK-159 | 4유형 각각 mock, 빈 상태, 프로젝트 1개, 필터링 |
| GapDetector.fix() | TASK-159 | 해결 가능/불가능 분류, reindex mock, stale 정리 |
| gap-check CLI | TASK-162 | --fix, --project, 기본 실행 |
| SupplementScanner | TASK-167 | 매칭도 계산, 기존 결과 없음, 매칭 0% |
| ResultManager supplement | TASK-167 | supplement 저장/조회, isSupplement 인덱스 |

#### API 테스트 (Jest, root)

| 엔드포인트 | TASK | 주요 케이스 |
|-----------|:----:|-----------|
| GET /api/gap-check | TASK-169 | 정상 응답 스키마, 빈 상태, 에러 500, projectId 필터 |

#### 프론트엔드 테스트 (Vitest, web)

| 컴포넌트 | TASK | 주요 케이스 |
|---------|:----:|-----------|
| GapHealthWidget | TASK-172 | 로딩/에러/빈/정상 렌더링, KPI 카드 클릭, CTA 클립보드 복사, 축소 상태 |
| CrossProjectTabs | Phase 5 | 탭 전환, 빈 상태, 데이터 로딩 |
| SupplementBanner | Phase 5 | 표시/숨김 조건, 원본 링크 클릭 |
| ResultCard [보완] | Phase 5 | 라벨 표시/미표시, 스타일 |

#### 통합 테스트 (Jest, root)

| 시나리오 | TASK | 흐름 |
|---------|:----:|------|
| 분석 -> 크로스 프로젝트 | TASK-178 | save-result -> detectAndSave -> cross-project.json 검증 -> API 응답 확인 |
| init -> 보완 분석 | TASK-179 | init -> SupplementScanner -> supplement 저장 -> detectAndSave 재실행 |

#### E2E 테스트 (필요 시)

| 시나리오 | 검증 내용 |
|---------|----------|
| 분석 후 플로우차트 "전체" 모드 | cross-project 데이터 표시 확인 |
| Gap Health Widget 인터랙션 | CTA 클릭 -> 클립보드 복사 -> 토스트 |

### R12: 구현 순서 최적화 (의존성 기반 병렬화)

#### 병렬화 가능한 조합

```
시간축 -->

Week 1:  [Phase 1: 핵심 자동화] ─────────────>
Week 2:  [Phase 2: GapDetector] ──> ∥ [Phase 3: 보완 분석] ──>
Week 3:  [Phase 4: API + 위젯] ──> ∥ [Phase 5: FlowChart 개선] ──>
Week 4:  [Phase 6: 통합 테스트 + 마무리] ──>
```

**병렬화 전략**:

1. **Phase 2 ∥ Phase 3**: 완전 독립. GapDetector는 cross-project.json을 읽기만 하고, SupplementScanner는 결과 JSON을 읽기만 한다. 서로 다른 데이터를 다루므로 충돌 없음.

2. **Phase 4 ∥ Phase 5**: 대부분 독립. TASK-176(SupplementBanner/ResultCard)만 Phase 3의 TASK-166에 의존. 나머지 TASK는 독립적으로 진행 가능.

3. **순차 필수**: Phase 1 -> Phase 2/3 (detectAndSave가 GapDetector와 SupplementScanner의 전제)

**최적 순서**:
1. TASK-152 (detectAndSave) -- 모든 후속 TASK의 기반
2. TASK-153 (테스트) + TASK-154 (--auto-save) + TASK-155 (save-result hook) -- 병렬 가능
3. TASK-156, TASK-157 (회귀 테스트) -- Phase 1 마무리
4. TASK-158~162 (GapDetector) ∥ TASK-163~167 (보완 분석)
5. TASK-168~172 (API + 위젯) ∥ TASK-173~176 (FlowChart + 보완 UI)
6. TASK-177~180 (SKILL.md + 통합 테스트)

---

## 8. Open Items 결정 사항

| # | 질문 | 결정 | 근거 |
|:-:|------|------|------|
| 7.1 | 보완 분석 정밀도 | **선택지 3** (parsedSpec + analysisSummary) | 파일 경로 의존 제거, 중간 정밀도로 실용적 |
| 7.2 | cross-project.json 동시 접근 | **파일 잠금 도입** | `file-lock.ts` 유틸리티로 RMW 경쟁 조건 방지 |
| 7.3 | stale 자동 감지 링크 생명주기 | **선택지 1** (자동 삭제) | 매번 최신 상태 반영이 직관적, Gap Health Widget에서 stale 별도 경고 |
| 7.4 | 위젯 위치 | ProjectStatusBanner 아래 | REQ-014 이미 구현 완료, 바로 삽입 가능 |
| 7.5 | 보완 분석 대시보드 표시 | **선택지 2** ([보완] 라벨) | 기존 [예시] 라벨 패턴 재사용, 구현/학습 비용 최소 |
| 7.6 | 프로젝트 1개일 때 gap-check | 단일 프로젝트 내부 항목만 체크 | 저신뢰도/인덱스 미갱신은 단일 프로젝트에서도 유효 |

---

## 부록 A: AC-TASK 역매핑

각 AC를 검증하는 TASK의 테스트 코드에서 해당 AC가 커버됨을 확인할 수 있다.

| AC ID | 검증 TASK |
|:-----:|:---------:|
| AC-015-1-1 | TASK-156 |
| AC-015-1-2 | TASK-153 |
| AC-015-1-3 | TASK-157 |
| AC-015-1-4 | TASK-154, TASK-157 |
| AC-015-1-5 | TASK-178 |
| AC-015-1-6 | TASK-156 |
| AC-015-1-7 | TASK-157 |
| AC-015-2-1 | TASK-167 |
| AC-015-2-2 | TASK-167 |
| AC-015-2-3 | TASK-167 |
| AC-015-2-4 | TASK-167 |
| AC-015-2-5 | TASK-167 |
| AC-015-3-1 | TASK-159 |
| AC-015-3-2 | TASK-159 |
| AC-015-3-3 | TASK-162 |
| AC-015-3-4 | TASK-169 |
| AC-015-3-5 | TASK-172 |
| AC-015-3-6 | TASK-159 |

## 부록 B: 자체 검토 이력

### R9 상세 (PRD AC 1:1 매핑)

- [x] 18개 AC 전체에 대해 해당 TASK 식별 완료
- [x] 각 AC의 검증 방법(PRD에 명시된 테스트 유형)이 TASK의 테스트 전략과 일치
- [x] AC-015-1-6 (실패 시 롤백 안 됨) - try-catch 설계로 명확히 보장

### R10 상세 (기존 코드 변경 최소화)

- [x] 모든 변경이 "추가" 패턴 (메서드 추가, 분기 추가, 필드 추가)
- [x] 기존 메서드 시그니처 변경 없음
- [x] optional 필드로 타입 하위 호환성 보장
- [x] --skip-cross-detect로 후처리 비활성화 가능

### R11 상세 (테스트 전략)

- [x] 단위 테스트: 핵심 비즈니스 로직 (detectAndSave, GapDetector, SupplementScanner) 완전 커버
- [x] API 테스트: 신규 엔드포인트 스키마 검증
- [x] 프론트엔드 테스트: 신규 컴포넌트 4가지 상태(로딩/에러/빈/정상) 커버
- [x] 통합 테스트: 핵심 시나리오 2개 (분석 후 크로스, init 후 보완)
- [x] 총 테스트 TASK: 8개 (29개 중 28%)

### R12 상세 (구현 순서 최적화)

- [x] Phase 2 ∥ Phase 3 병렬화로 1주 단축 가능
- [x] Phase 4 ∥ Phase 5 병렬화로 추가 0.5주 단축 가능
- [x] 순차 의존성: Phase 1 -> (Phase 2, 3) -> (Phase 4, 5) -> Phase 6
- [x] 크리티컬 패스: Phase 1 -> Phase 2 -> Phase 4 -> Phase 6 (가장 긴 경로)
