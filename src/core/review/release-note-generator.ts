/**
 * @module core/review/release-note-generator
 * @description 릴리즈 노트 자동 생성기 - git log 기반으로 구조화된 릴리즈 노트 Markdown 생성
 */

import { execSync } from 'child_process';
import * as path from 'path';
import {
  ReleaseNoteOptions,
  CommitInfo,
  CategorizedChanges,
  ReleaseNoteInput,
  ReleaseNoteChangeItem,
} from '../../types/review';

/**
 * ReleaseNoteGenerator - git log 기반 릴리즈 노트 자동 생성
 *
 * 주요 기능:
 * - git log 파싱하여 커밋 정보 추출
 * - 커밋 메시지 prefix 기반 분류 (feat/fix/refactor 등)
 * - router.ts 변경 감지로 신규 명령어 탐지
 * - 구조화된 Markdown 릴리즈 노트 생성
 */
export class ReleaseNoteGenerator {
  /** 스킬 루트 디렉토리 (git repo) */
  private readonly repoDir: string;

  /**
   * ReleaseNoteGenerator 인스턴스 생성
   * @param repoDir - git 저장소 루트 디렉토리 경로
   */
  constructor(repoDir?: string) {
    this.repoDir = repoDir || path.resolve(__dirname, '..', '..', '..');
  }

  /**
   * 릴리즈 노트를 생성하는 메인 메서드
   * @param options - 릴리즈 노트 생성 옵션
   * @returns Markdown 형식의 릴리즈 노트 문자열
   */
  generate(options: ReleaseNoteOptions): string {
    const fromCommit = options.previousCommit || this.getLastTag();
    const toCommit = options.currentCommit || 'HEAD';
    const input = this.generateFromGitLog(fromCommit, toCommit);
    const date = options.date || new Date().toISOString().substring(0, 10);
    const version = options.version || this.inferVersion(input);

    const sections: string[] = [];

    // 1. 헤더
    sections.push(this.renderHeader(version, date, options.previousCommit || fromCommit));

    // 2. 요약
    sections.push(this.renderSummary(input));

    // 2.5. 한눈에 보기 (At a Glance)
    sections.push(this.renderAtAGlance(input));

    // 3. 새로운 기능 요약 테이블
    const changeItems = this.buildChangeItems(input);
    if (changeItems.length > 0) {
      sections.push(this.renderFeatureTable(changeItems));
    }

    // 4. 주요 변경 사항 상세
    if (changeItems.length > 0) {
      sections.push(this.renderDetailedChanges(input, changeItems));
    }

    // 5. 하위 호환성
    sections.push(this.renderCompatibility(input));

    // 6. 새로운/변경된 명령어 테이블
    if (input.newCommands.length > 0) {
      sections.push(this.renderCommandTable(input.newCommands));
    }

    // 7. 알려진 제한 사항
    sections.push(this.renderLimitations());

    // 8. QA 현황
    if (options.includeQA !== false) {
      sections.push(this.renderQAStatus());
    }

    // 9. 푸터
    sections.push(this.renderFooter());

    return sections.join('\n');
  }

  /**
   * git log를 파싱하여 ReleaseNoteInput 생성
   * @param fromCommit - 시작 커밋 (exclusive)
   * @param toCommit - 종료 커밋 (inclusive, 기본값: HEAD)
   * @returns ReleaseNoteInput
   */
  generateFromGitLog(fromCommit: string, toCommit: string = 'HEAD'): ReleaseNoteInput {
    const allCommits = this.getCommits(fromCommit, toCommit);
    const categorized = this.categorizeChanges(allCommits);

    // router.ts diff에서 신규 명령어 감지
    let diff = '';
    try {
      diff = this.execGit(`diff ${fromCommit}..${toCommit} -- src/router.ts`);
    } catch {
      // diff 실패 시 빈 문자열
    }

    const newCommands = this.detectNewCommands(diff);
    const breakingChanges = this.detectBreakingChanges(diff);

    return {
      categorized,
      allCommits,
      fromCommit,
      toCommit,
      newCommands,
      breakingChanges,
    };
  }

  /**
   * 커밋 메시지를 prefix 기반으로 분류
   * @param commits - 커밋 정보 배열
   * @returns CategorizedChanges
   */
  categorizeChanges(commits: CommitInfo[]): CategorizedChanges {
    const result: CategorizedChanges = {
      features: [],
      improvements: [],
      bugfixes: [],
      others: [],
    };

    for (const commit of commits) {
      const msg = commit.message.toLowerCase();

      if (/^feat[\s(:]/.test(msg)) {
        result.features.push(commit);
      } else if (/^(fix|bug)[\s(:]/.test(msg)) {
        result.bugfixes.push(commit);
      } else if (/^(improve|enhance|refactor|perf|style)[\s(:]/.test(msg)) {
        result.improvements.push(commit);
      } else if (/^(docs|chore|build|ci|test)[\s(:]/.test(msg)) {
        result.others.push(commit);
      } else {
        // 메시지에 키워드 포함 여부로 재분류
        if (msg.includes('feat') || msg.includes('add') || msg.includes('신규')) {
          result.features.push(commit);
        } else if (msg.includes('fix') || msg.includes('수정') || msg.includes('bug')) {
          result.bugfixes.push(commit);
        } else if (msg.includes('improve') || msg.includes('개선') || msg.includes('refactor')) {
          result.improvements.push(commit);
        } else {
          result.others.push(commit);
        }
      }
    }

    return result;
  }

  /**
   * 개별 섹션 렌더링
   * @param section - 섹션 이름
   * @param data - 섹션 데이터
   * @returns 렌더링된 Markdown 문자열
   */
  renderSection(section: string, data: unknown): string {
    switch (section) {
      case 'header':
        return this.renderHeader(
          (data as { version: string }).version,
          (data as { date: string }).date,
          (data as { previousCommit: string }).previousCommit,
        );
      case 'summary':
        return this.renderSummary(data as ReleaseNoteInput);
      case 'at-a-glance':
        return this.renderAtAGlance(data as ReleaseNoteInput);
      case 'feature-table':
        return this.renderFeatureTable(data as ReleaseNoteChangeItem[]);
      case 'compatibility':
        return this.renderCompatibility(data as ReleaseNoteInput);
      case 'command-table':
        return this.renderCommandTable(data as string[]);
      case 'limitations':
        return this.renderLimitations();
      case 'qa-status':
        return this.renderQAStatus();
      case 'footer':
        return this.renderFooter();
      default:
        return '';
    }
  }

  /**
   * router.ts diff에서 신규 CLI 명령어를 감지
   * @param diff - git diff 출력 문자열
   * @returns 신규 명령어 이름 배열
   */
  detectNewCommands(diff: string): string[] {
    if (!diff) return [];

    const commands: string[] = [];
    const lines = diff.split('\n');

    for (const line of lines) {
      // 추가된 라인에서 명령어 매핑 패턴 감지
      // 패턴: + 'command-name': SomeCommand,
      const addedMatch = line.match(/^\+\s*'([a-z][\w-]*)'\s*:\s*\w+Command/);
      if (addedMatch) {
        commands.push(addedMatch[1]);
      }
    }

    // 삭제된 라인에서 동일한 명령어가 있으면 제거 (이름 변경이 아닌 신규만)
    const removed = new Set<string>();
    for (const line of lines) {
      const removedMatch = line.match(/^-\s*'([a-z][\w-]*)'\s*:\s*\w+Command/);
      if (removedMatch) {
        removed.add(removedMatch[1]);
      }
    }

    return commands.filter(cmd => !removed.has(cmd));
  }

  /**
   * diff에서 잠재적 파괴 변경을 감지
   * @param diff - git diff 출력 문자열
   * @returns 파괴 변경 설명 배열
   */
  detectBreakingChanges(diff: string): string[] {
    if (!diff) return [];

    const breaking: string[] = [];
    const lines = diff.split('\n');

    for (const line of lines) {
      // 명령어 삭제 감지
      const removedCmd = line.match(/^-\s*'([a-z][\w-]*)'\s*:\s*\w+Command/);
      if (removedCmd) {
        // 해당 명령어가 다른 이름으로 다시 추가되지 않았는지 확인
        const cmdName = removedCmd[1];
        const reAdded = lines.some(l => l.match(new RegExp(`^\\+\\s*'${cmdName}'`)));
        if (!reAdded) {
          breaking.push(`명령어 '${cmdName}' 삭제됨`);
        }
      }
    }

    return breaking;
  }

  // ======================================================================
  // Private 메서드 - Git 명령어 실행
  // ======================================================================

  /**
   * git 명령어 실행
   */
  private execGit(cmd: string): string {
    return execSync(`git ${cmd}`, {
      cwd: this.repoDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  }

  /**
   * fromCommit..toCommit 사이의 커밋 목록 조회
   */
  private getCommits(fromCommit: string, toCommit: string): CommitInfo[] {
    let logOutput: string;
    try {
      // --format: hash|message|date 형태
      logOutput = this.execGit(
        `log ${fromCommit}..${toCommit} --format="%h|%s|%aI" --no-merges`,
      );
    } catch {
      // fromCommit이 유효하지 않은 경우 전체 로그에서 최근 50건
      try {
        logOutput = this.execGit(
          `log ${toCommit} -50 --format="%h|%s|%aI" --no-merges`,
        );
      } catch {
        return [];
      }
    }

    if (!logOutput) return [];

    const commits: CommitInfo[] = [];

    for (const line of logOutput.split('\n')) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 3) continue;

      const hash = parts[0];
      const message = parts[1];
      const date = parts.slice(2).join('|'); // ISO date may contain |

      // 각 커밋의 변경 파일 목록
      let files: string[] = [];
      try {
        const filesOutput = this.execGit(
          `diff-tree --no-commit-id --name-only -r ${hash}`,
        );
        files = filesOutput.split('\n').filter(f => f.trim().length > 0);
      } catch {
        // 파일 목록 조회 실패 시 빈 배열
      }

      commits.push({ hash, message, date, files });
    }

    return commits;
  }

  /**
   * 최근 태그 조회 (없으면 최초 커밋)
   */
  private getLastTag(): string {
    try {
      return this.execGit('describe --tags --abbrev=0');
    } catch {
      // 태그가 없는 경우 최초 커밋
      try {
        return this.execGit('rev-list --max-parents=0 HEAD');
      } catch {
        return 'HEAD~10';
      }
    }
  }

  /**
   * 커밋 메시지에서 버전 추론
   */
  private inferVersion(input: ReleaseNoteInput): string {
    // feat 커밋에서 REQ-XXX 패턴 추출
    for (const commit of input.categorized.features) {
      const match = commit.message.match(/(REQ-\d+)/i);
      if (match) {
        return `${match[1]} 릴리스`;
      }
    }

    // 모든 커밋에서 시도
    for (const commit of input.allCommits) {
      const match = commit.message.match(/(REQ-\d+)/i);
      if (match) {
        return `${match[1]} 릴리스`;
      }
    }

    // 날짜 기반 폴백
    return `${new Date().toISOString().substring(0, 10)} 릴리스`;
  }

  // ======================================================================
  // Private 메서드 - 섹션 렌더링
  // ======================================================================

  /**
   * "한눈에 보기" 요약 섹션 렌더링
   * - 어떤 문제가 있었나요?
   * - 어떤 기능이 추가되었나요?
   * - 어떤 효과가 있나요?
   * - 어떻게 사용하면 되나요? (대화형 예시)
   */
  private renderAtAGlance(input: ReleaseNoteInput): string {
    const lines: string[] = [
      '## 한눈에 보기',
      '',
    ];

    // 1) 어떤 문제가 있었나요?
    lines.push('### 어떤 문제가 있었나요?');
    lines.push('');
    if (input.categorized.bugfixes.length > 0) {
      for (const fix of input.categorized.bugfixes) {
        lines.push(`- ${this.cleanCommitMessage(fix.message)}`);
      }
    } else {
      lines.push('- 이번 릴리스에서 해결된 주요 버그는 없습니다.');
    }
    lines.push('');

    // 2) 어떤 기능이 추가되었나요?
    lines.push('### 어떤 기능이 추가되었나요?');
    lines.push('');
    if (input.categorized.features.length > 0) {
      for (const feat of input.categorized.features) {
        lines.push(`- ${this.cleanCommitMessage(feat.message)}`);
      }
    } else {
      lines.push('- 이번 릴리스에서는 내부 개선 및 유지보수 작업이 수행되었습니다.');
    }
    lines.push('');

    // 3) 어떤 효과가 있나요?
    lines.push('### 어떤 효과가 있나요?');
    lines.push('');
    const effects: string[] = [];
    if (input.categorized.features.length > 0) {
      effects.push(`${input.categorized.features.length}개의 신규 기능으로 분석 범위가 확대됩니다.`);
    }
    if (input.categorized.improvements.length > 0) {
      effects.push(`${input.categorized.improvements.length}건의 개선으로 사용 편의성과 안정성이 향상됩니다.`);
    }
    if (input.categorized.bugfixes.length > 0) {
      effects.push(`${input.categorized.bugfixes.length}건의 버그 수정으로 신뢰성이 높아집니다.`);
    }
    if (effects.length > 0) {
      for (const effect of effects) {
        lines.push(`- ${effect}`);
      }
    } else {
      lines.push('- 코드 품질 및 유지보수성이 향상됩니다.');
    }
    lines.push('');

    // 4) 어떻게 사용하면 되나요? (대화형 자연어 예시)
    lines.push('### 어떻게 사용하면 되나요?');
    lines.push('');
    lines.push('Claude에게 자연어로 요청하세요:');
    lines.push('');
    lines.push('```');

    // 새 명령어가 감지되면 동적으로 예시 생성
    const dynamicExamples = this.getCommandNaturalLanguageExamples(input.newCommands);

    // 기본 예시 + 동적 예시 결합
    const defaultExamples = [
      ['"lip 프로젝트 리뷰 결과서 만들어줘"', '리뷰 결과서 자동 생성'],
      ['"lip, escm 통합 리뷰 만들어줘"', '멀티프로젝트 통합 리뷰'],
      ['"이 정책 문서화해줘"', '정책 문서 저장'],
      ['"kafka 관련 저장된 정책 찾아줘"', '정책 문서 검색'],
      ['"저장된 정책 보여줘"', '정책 문서 목록 조회'],
      ['"릴리즈 노트 만들어줘"', '배포용 릴리즈 노트 생성'],
    ];

    // 동적 예시를 기본 예시 앞에 배치 (새 기능 강조)
    const allExamples = [...dynamicExamples, ...defaultExamples];

    // 중복 제거 (설명 기준)
    const seen = new Set<string>();
    const uniqueExamples: string[][] = [];
    for (const example of allExamples) {
      if (!seen.has(example[1])) {
        seen.add(example[1]);
        uniqueExamples.push(example);
      }
    }

    // 최대 폭 계산으로 정렬
    const maxPromptLen = Math.max(...uniqueExamples.map(e => e[0].length));
    for (const [prompt, desc] of uniqueExamples) {
      lines.push(`${prompt.padEnd(maxPromptLen)}  → ${desc}`);
    }

    lines.push('```');
    lines.push('');
    lines.push('> 기존 분석 저장(save-result) 시 리뷰 결과서가 자동 생성됩니다.');
    lines.push('');
    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 새로 감지된 명령어를 자연어 사용 예시로 변환
   * @param newCommands - detectNewCommands()에서 감지된 명령어 이름 배열
   * @returns [대화형 요청 예시, 설명] 쌍의 배열
   */
  private getCommandNaturalLanguageExamples(newCommands: string[]): string[][] {
    if (newCommands.length === 0) return [];

    // 명령어 이름 → 자연어 예시 매핑
    const commandExampleMap: Record<string, [string, string]> = {
      'generate-review': ['"lip 프로젝트 리뷰 결과서 만들어줘"', '리뷰 결과서 자동 생성'],
      'release-note': ['"릴리즈 노트 만들어줘"', '배포용 릴리즈 노트 생성'],
      'policy-doc': ['"이 정책 문서화해줘"', '정책 문서 저장'],
      'policy-check': ['"정책 위반 사항 체크해줘"', '정책 준수 여부 검사'],
      'cross-analyze': ['"lip, escm 크로스 분석해줘"', '멀티프로젝트 교차 분석'],
      'gap-check': ['"기획서 누락 항목 찾아줘"', '기획-구현 갭 분석'],
      'reverse': ['"코드에서 기획 역추적해줘"', '코드 기반 역방향 분석'],
      'summary': ['"분석 결과 요약해줘"', '분석 결과 요약 리포트'],
      'save-result': ['"분석 결과 저장해줘"', '분석 결과 로컬 저장'],
      'result-status': ['"저장된 결과 상태 보여줘"', '저장된 분석 결과 현황 조회'],
      'analyze': ['"lip 프로젝트 영향도 분석해줘"', '프로젝트 영향도 분석'],
      'view': ['"분석 결과 대시보드 열어줘"', '분석 결과 시각화 대시보드'],
      'policies': ['"저장된 정책 보여줘"', '정책 문서 목록 조회'],
      'status': ['"현재 상태 보여줘"', '시스템 상태 확인'],
      'update': ['"KIC 업데이트해줘"', 'KIC 최신 버전 업데이트'],
    };

    const examples: string[][] = [];
    for (const cmd of newCommands) {
      const mapped = commandExampleMap[cmd];
      if (mapped) {
        examples.push(mapped);
      } else {
        // 매핑되지 않은 새 명령어는 명령어 이름 기반으로 자동 생성
        const humanName = cmd.replace(/-/g, ' ');
        examples.push([`"${humanName} 실행해줘"`, `${humanName} 기능`]);
      }
    }

    return examples;
  }

  /**
   * 헤더 렌더링
   */
  private renderHeader(version: string, date: string, previousCommit?: string): string {
    const lines = [
      '# KIC (Kurly Impact Checker) 업데이트 안내',
      '',
      `**버전**: ${version}`,
      `**배포일**: ${date}`,
    ];

    if (previousCommit) {
      lines.push(`**이전 버전 커밋**: \`${previousCommit.substring(0, 7)}\``);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * 요약 렌더링
   */
  private renderSummary(input: ReleaseNoteInput): string {
    const { features, improvements, bugfixes } = input.categorized;
    const parts: string[] = [];

    if (features.length > 0) {
      const featureNames = features.map(f => this.extractFeatureName(f.message));
      parts.push(`${featureNames.join(', ')} 기능이 추가`);
    }

    if (improvements.length > 0) {
      parts.push(`${improvements.length}건의 개선`);
    }

    if (bugfixes.length > 0) {
      parts.push(`${bugfixes.length}건의 버그 수정`);
    }

    const summaryText = parts.length > 0
      ? `이번 업데이트에서는 ${parts.join(', ')}되었습니다.`
      : '이번 업데이트에서는 내부 개선 및 유지보수 작업이 수행되었습니다.';

    return [
      `> ${summaryText}`,
      '',
      '---',
      '',
    ].join('\n');
  }

  /**
   * 새로운 기능 요약 테이블 렌더링
   */
  private renderFeatureTable(items: ReleaseNoteChangeItem[]): string {
    const lines = [
      '## 1. 새로운 기능 요약',
      '',
      '| # | 기능 | 유형 | 핵심 변경 |',
      '|:-:|:-----|:----:|:---------|',
    ];

    for (const item of items) {
      lines.push(`| ${item.index} | ${item.name} | ${item.type} | ${item.description} |`);
    }

    lines.push('', '---', '');
    return lines.join('\n');
  }

  /**
   * 주요 변경 사항 상세 렌더링
   */
  private renderDetailedChanges(input: ReleaseNoteInput, items: ReleaseNoteChangeItem[]): string {
    const lines = ['## 2. 주요 변경 사항 상세', ''];

    let sectionNum = 1;
    for (const item of items) {
      lines.push(`### 2.${sectionNum} ${item.name}`);
      lines.push('');
      lines.push('**무엇이 바뀌었나요?**');
      lines.push('');
      lines.push(item.description);
      lines.push('');

      // 관련 커밋 해시 나열
      if (item.commits.length > 0) {
        lines.push(`**관련 커밋**: ${item.commits.map(c => `\`${c}\``).join(', ')}`);
        lines.push('');
      }

      // 관련 파일 변경 나열
      const relatedCommits = input.allCommits.filter(c => item.commits.includes(c.hash));
      const allFiles = new Set<string>();
      for (const c of relatedCommits) {
        for (const f of c.files) {
          allFiles.add(f);
        }
      }

      if (allFiles.size > 0) {
        lines.push('**변경 파일**:');
        const displayFiles = Array.from(allFiles).slice(0, 10);
        for (const f of displayFiles) {
          lines.push(`- \`${f}\``);
        }
        if (allFiles.size > 10) {
          lines.push(`- ... 외 ${allFiles.size - 10}개 파일`);
        }
        lines.push('');
      }

      lines.push('---', '');
      sectionNum++;
    }

    return lines.join('\n');
  }

  /**
   * 하위 호환성 렌더링
   */
  private renderCompatibility(input: ReleaseNoteInput): string {
    const lines = [
      '## 3. 하위 호환성',
      '',
    ];

    if (input.breakingChanges.length > 0) {
      lines.push('> **주의**: 이번 업데이트에는 파괴 변경이 포함되어 있습니다.');
      lines.push('');
      lines.push('| 항목 | 호환 여부 | 상세 |');
      lines.push('|:-----|:--------:|:-----|');

      for (const bc of input.breakingChanges) {
        lines.push(`| ${bc} | 비호환 | 마이그레이션 필요 |`);
      }
    } else {
      lines.push('이번 업데이트는 기존 기능에 영향을 주지 않도록 설계되었습니다.');
      lines.push('');
      lines.push('| 항목 | 호환 여부 | 상세 |');
      lines.push('|:-----|:--------:|:-----|');
      lines.push('| 기존 CLI 명령어 | 변경 없음 | 기존 명령어 모두 동작 변경 없음 |');
      lines.push('| 기존 분석 결과 | 호환 | 기존 저장된 결과 정상 처리 |');
    }

    lines.push('', '---', '');
    return lines.join('\n');
  }

  /**
   * 새로운/변경된 명령어 테이블 렌더링
   */
  private renderCommandTable(commands: string[]): string {
    const lines = [
      '## 4. 새로운 명령어',
      '',
      '| 명령어 | 설명 |',
      '|:------|:-----|',
    ];

    for (const cmd of commands) {
      lines.push(`| \`/impact ${cmd}\` | \`${cmd}\` 명령어 추가 |`);
    }

    lines.push('', '---', '');
    return lines.join('\n');
  }

  /**
   * 알려진 제한 사항 렌더링
   */
  private renderLimitations(): string {
    return [
      '## 5. 알려진 제한 사항',
      '',
      '- **자동 생성 릴리즈 노트**: git log 기반으로 자동 생성된 문서이므로, 상세 설명은 수동 보완이 필요할 수 있습니다.',
      '- **커밋 메시지 의존성**: 커밋 메시지가 Conventional Commits 형식(`feat:`, `fix:` 등)을 따를 때 가장 정확한 분류가 이루어집니다.',
      '',
      '---',
      '',
    ].join('\n');
  }

  /**
   * QA 현황 렌더링
   */
  private renderQAStatus(): string {
    return [
      '## QA 현황',
      '',
      '| 항목 | 결과 |',
      '|:-----|:-----|',
      '| TypeScript 컴파일 | 확인 필요 |',
      '| 테스트 (Jest) | 확인 필요 |',
      '',
      '> QA 현황은 배포 전 `npx tsc --noEmit` 및 `npx jest` 실행 결과로 업데이트해 주세요.',
      '',
      '---',
      '',
    ].join('\n');
  }

  /**
   * 푸터 렌더링
   */
  private renderFooter(): string {
    return [
      '**문의**: KIC 관련 질문이나 피드백은 개발팀 채널로 공유해 주세요.',
      '**전체 문서**: 상세한 명령어 옵션 및 프로토콜은 SKILL.md (`~/.claude/skills/impact_checker/SKILL.md`)를 참조하세요.',
      '',
    ].join('\n');
  }

  // ======================================================================
  // Private 메서드 - 유틸리티
  // ======================================================================

  /**
   * 변경 항목 빌드
   */
  private buildChangeItems(input: ReleaseNoteInput): ReleaseNoteChangeItem[] {
    const items: ReleaseNoteChangeItem[] = [];
    let idx = 1;

    // feat 커밋 → 신규
    for (const commit of input.categorized.features) {
      items.push({
        index: idx++,
        name: this.extractFeatureName(commit.message),
        type: '신규',
        description: this.cleanCommitMessage(commit.message),
        commits: [commit.hash],
      });
    }

    // 개선 커밋 → 개선 (유사한 것끼리 그루핑)
    const improvementGroups = this.groupSimilarCommits(input.categorized.improvements);
    for (const group of improvementGroups) {
      items.push({
        index: idx++,
        name: this.extractFeatureName(group[0].message),
        type: '개선',
        description: group.map(c => this.cleanCommitMessage(c.message)).join(', '),
        commits: group.map(c => c.hash),
      });
    }

    // fix 커밋 → 수정 (유사한 것끼리 그루핑)
    const bugfixGroups = this.groupSimilarCommits(input.categorized.bugfixes);
    for (const group of bugfixGroups) {
      items.push({
        index: idx++,
        name: this.extractFeatureName(group[0].message),
        type: '수정',
        description: group.map(c => this.cleanCommitMessage(c.message)).join(', '),
        commits: group.map(c => c.hash),
      });
    }

    return items;
  }

  /**
   * 커밋 메시지에서 기능명 추출
   * 예: "feat(REQ-018): 기획 검토 결과서 자동 생성" → "기획 검토 결과서 자동 생성"
   */
  private extractFeatureName(message: string): string {
    // prefix 및 scope 제거
    const cleaned = message
      .replace(/^(feat|fix|bug|improve|enhance|refactor|perf|style|docs|chore|build|ci|test)\s*/i, '')
      .replace(/^\([^)]*\)\s*:\s*/, '')
      .replace(/^:\s*/, '')
      .trim();

    // 첫 문장만 (마침표 또는 + 앞까지)
    const firstSentence = cleaned.split(/[.+]/)[0].trim();
    return firstSentence || cleaned;
  }

  /**
   * 커밋 메시지에서 prefix 제거 후 정리
   */
  private cleanCommitMessage(message: string): string {
    return message
      .replace(/^(feat|fix|bug|improve|enhance|refactor|perf|style|docs|chore|build|ci|test)\s*/i, '')
      .replace(/^\([^)]*\)\s*:\s*/, '')
      .replace(/^:\s*/, '')
      .trim();
  }

  /**
   * 유사한 커밋끼리 그루핑 (같은 scope끼리)
   */
  private groupSimilarCommits(commits: CommitInfo[]): CommitInfo[][] {
    if (commits.length === 0) return [];

    const groups: Map<string, CommitInfo[]> = new Map();

    for (const commit of commits) {
      // scope 추출 (예: fix(BUG-011) → BUG-011)
      const scopeMatch = commit.message.match(/\(([^)]+)\)/);
      const key = scopeMatch ? scopeMatch[1] : commit.hash;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(commit);
    }

    return Array.from(groups.values());
  }
}
