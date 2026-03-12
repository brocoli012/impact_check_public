/**
 * @module tests/unit/review/release-note-generator
 * @description ReleaseNoteGenerator 단위 테스트
 */

import { ReleaseNoteGenerator } from '../../../src/core/review/release-note-generator';
import { CommitInfo } from '../../../src/types/review';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function createMockCommit(overrides: Partial<CommitInfo> = {}): CommitInfo {
  return {
    hash: 'abc1234',
    message: 'feat: 테스트 기능 추가',
    date: '2026-03-11T10:00:00+09:00',
    files: ['src/test.ts'],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe('ReleaseNoteGenerator', () => {
  let generator: ReleaseNoteGenerator;

  beforeEach(() => {
    // /tmp를 repo dir로 지정하여 실제 git 명령어 실행 방지
    generator = new ReleaseNoteGenerator('/tmp');
  });

  /* ---------------------------------------------------------------- */
  /*  categorizeChanges                                                */
  /* ---------------------------------------------------------------- */

  describe('categorizeChanges()', () => {
    it('should categorize feat: commits as features', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'aaa', message: 'feat: 새로운 기능 추가' }),
        createMockCommit({ hash: 'bbb', message: 'feat(REQ-018): 리뷰 자동 생성' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.features).toHaveLength(2);
      expect(result.improvements).toHaveLength(0);
      expect(result.bugfixes).toHaveLength(0);
      expect(result.others).toHaveLength(0);
    });

    it('should categorize fix: commits as bugfixes', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'ccc', message: 'fix: 버그 수정' }),
        createMockCommit({ hash: 'ddd', message: 'fix(BUG-011): FlowChart 오류 수정' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.features).toHaveLength(0);
      expect(result.bugfixes).toHaveLength(2);
    });

    it('should categorize refactor/improve/enhance commits as improvements', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'eee', message: 'refactor: 코드 구조 개선' }),
        createMockCommit({ hash: 'fff', message: 'improve: 성능 최적화' }),
        createMockCommit({ hash: 'ggg', message: 'enhance: UI 개선' }),
        createMockCommit({ hash: 'hhh', message: 'perf: 렌더링 속도 향상' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.improvements).toHaveLength(4);
    });

    it('should categorize docs/chore/build/ci/test commits as others', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'iii', message: 'docs: README 업데이트' }),
        createMockCommit({ hash: 'jjj', message: 'chore: 의존성 업데이트' }),
        createMockCommit({ hash: 'kkk', message: 'build: 빌드 설정 변경' }),
        createMockCommit({ hash: 'lll', message: 'ci: CI 파이프라인 업데이트' }),
        createMockCommit({ hash: 'mmm', message: 'test: 테스트 추가' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.others).toHaveLength(5);
    });

    it('should handle mixed commit types', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'a1', message: 'feat: 신규 기능' }),
        createMockCommit({ hash: 'b1', message: 'fix: 버그 수정' }),
        createMockCommit({ hash: 'c1', message: 'refactor: 리팩토링' }),
        createMockCommit({ hash: 'd1', message: 'docs: 문서 업데이트' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.features).toHaveLength(1);
      expect(result.bugfixes).toHaveLength(1);
      expect(result.improvements).toHaveLength(1);
      expect(result.others).toHaveLength(1);
    });

    it('should handle commits without conventional prefix by keyword matching', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'x1', message: '새로운 기능 추가 (add feature)' }),
        createMockCommit({ hash: 'x2', message: '버그 수정 완료' }),
        createMockCommit({ hash: 'x3', message: '성능 개선 작업' }),
        createMockCommit({ hash: 'x4', message: '설정 파일 정리' }),
      ];

      const result = generator.categorizeChanges(commits);

      // 'add' → feature, '수정' → bugfix, '개선' → improvement, 나머지 → other
      expect(result.features).toHaveLength(1);
      expect(result.bugfixes).toHaveLength(1);
      expect(result.improvements).toHaveLength(1);
      expect(result.others).toHaveLength(1);
    });

    it('should handle empty commits array', () => {
      const result = generator.categorizeChanges([]);

      expect(result.features).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.bugfixes).toHaveLength(0);
      expect(result.others).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  detectNewCommands                                                */
  /* ---------------------------------------------------------------- */

  describe('detectNewCommands()', () => {
    it('should detect new commands from router.ts diff', () => {
      const diff = [
        "diff --git a/src/router.ts b/src/router.ts",
        "--- a/src/router.ts",
        "+++ b/src/router.ts",
        "@@ -80,6 +82,7 @@",
        "   'policy-doc': PolicyDocCommand,",
        "+  'release-note': ReleaseNoteCommand,",
        " } as const;",
      ].join('\n');

      const result = generator.detectNewCommands(diff);

      expect(result).toContain('release-note');
    });

    it('should not include commands that were also removed (renamed)', () => {
      const diff = [
        "-  'old-cmd': OldCommand,",
        "+  'old-cmd': NewCommand,",
      ].join('\n');

      const result = generator.detectNewCommands(diff);

      // old-cmd was both removed and added, so it should not appear as "new"
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty diff', () => {
      const result = generator.detectNewCommands('');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for diff without command changes', () => {
      const diff = [
        "+// 주석 추가",
        "+import { Something } from './somewhere';",
      ].join('\n');

      const result = generator.detectNewCommands(diff);
      expect(result).toHaveLength(0);
    });

    it('should detect multiple new commands', () => {
      const diff = [
        "+  'release-note': ReleaseNoteCommand,",
        "+  'deploy-check': DeployCheckCommand,",
      ].join('\n');

      const result = generator.detectNewCommands(diff);

      expect(result).toHaveLength(2);
      expect(result).toContain('release-note');
      expect(result).toContain('deploy-check');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  detectBreakingChanges                                            */
  /* ---------------------------------------------------------------- */

  describe('detectBreakingChanges()', () => {
    it('should detect removed commands as breaking changes', () => {
      const diff = [
        "-  'deprecated-cmd': DeprecatedCommand,",
      ].join('\n');

      const result = generator.detectBreakingChanges(diff);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('deprecated-cmd');
    });

    it('should not flag commands that were re-added with same name', () => {
      const diff = [
        "-  'some-cmd': OldCommand,",
        "+  'some-cmd': NewCommand,",
      ].join('\n');

      const result = generator.detectBreakingChanges(diff);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty diff', () => {
      const result = generator.detectBreakingChanges('');
      expect(result).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  generate (with mocked data)                                      */
  /* ---------------------------------------------------------------- */

  describe('generate()', () => {
    it('should generate markdown with all major sections', () => {
      // Mock generateFromGitLog to avoid actual git commands
      const mockInput = {
        categorized: {
          features: [
            createMockCommit({ hash: 'a1a1a1a', message: 'feat(REQ-020): 릴리즈 노트 자동 생성' }),
          ],
          improvements: [
            createMockCommit({ hash: 'b2b2b2b', message: 'improve: 대시보드 성능 개선' }),
          ],
          bugfixes: [
            createMockCommit({ hash: 'c3c3c3c', message: 'fix(BUG-012): 차트 렌더링 오류 수정' }),
          ],
          others: [
            createMockCommit({ hash: 'd4d4d4d', message: 'docs: README 업데이트' }),
          ],
        },
        allCommits: [
          createMockCommit({ hash: 'a1a1a1a', message: 'feat(REQ-020): 릴리즈 노트 자동 생성' }),
          createMockCommit({ hash: 'b2b2b2b', message: 'improve: 대시보드 성능 개선' }),
          createMockCommit({ hash: 'c3c3c3c', message: 'fix(BUG-012): 차트 렌더링 오류 수정' }),
          createMockCommit({ hash: 'd4d4d4d', message: 'docs: README 업데이트' }),
        ],
        fromCommit: 'abc1234',
        toCommit: 'HEAD',
        newCommands: ['release-note'],
        breakingChanges: [],
      };

      // Override generateFromGitLog
      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({
        version: 'REQ-020 릴리스',
        date: '2026-03-11',
        previousCommit: 'abc1234',
      });

      // 헤더 확인
      expect(markdown).toContain('# KIC (Kurly Impact Checker) 업데이트 안내');
      expect(markdown).toContain('**버전**: REQ-020 릴리스');
      expect(markdown).toContain('**배포일**: 2026-03-11');
      expect(markdown).toContain('**이전 버전 커밋**: `abc1234`');

      // 요약 확인
      expect(markdown).toContain('이번 업데이트에서는');

      // 한눈에 보기 확인
      expect(markdown).toContain('## 한눈에 보기');
      expect(markdown).toContain('### 어떻게 사용하면 되나요?');

      // 기능 요약 테이블 확인
      expect(markdown).toContain('## 1. 새로운 기능 요약');
      expect(markdown).toContain('| # | 기능 | 유형 | 핵심 변경 |');

      // 주요 변경 사항 상세 확인
      expect(markdown).toContain('## 2. 주요 변경 사항 상세');
      expect(markdown).toContain('**무엇이 바뀌었나요?**');

      // 하위 호환성 확인
      expect(markdown).toContain('## 3. 하위 호환성');

      // 새로운 명령어 확인
      expect(markdown).toContain('## 4. 새로운 명령어');
      expect(markdown).toContain('`/impact release-note`');

      // 알려진 제한 사항 확인
      expect(markdown).toContain('## 5. 알려진 제한 사항');

      // QA 현황 확인
      expect(markdown).toContain('## QA 현황');

      // 푸터 확인
      expect(markdown).toContain('**문의**');
    });

    it('should skip command table when no new commands', () => {
      const mockInput = {
        categorized: {
          features: [createMockCommit({ hash: 'a1', message: 'feat: 기능 추가' })],
          improvements: [],
          bugfixes: [],
          others: [],
        },
        allCommits: [createMockCommit({ hash: 'a1', message: 'feat: 기능 추가' })],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      expect(markdown).not.toContain('## 4. 새로운 명령어');
    });

    it('should exclude QA section when includeQA is false', () => {
      const mockInput = {
        categorized: { features: [], improvements: [], bugfixes: [], others: [] },
        allCommits: [],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test', includeQA: false });

      expect(markdown).not.toContain('## QA 현황');
    });

    it('should include breaking changes warning when present', () => {
      const mockInput = {
        categorized: { features: [], improvements: [], bugfixes: [], others: [] },
        allCommits: [],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: ["명령어 'old-cmd' 삭제됨"],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      expect(markdown).toContain('파괴 변경');
      expect(markdown).toContain('old-cmd');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  한눈에 보기 (At a Glance)                                        */
  /* ---------------------------------------------------------------- */

  describe('at-a-glance section in generate()', () => {
    it('should include 한눈에 보기 section with all 4 subsections', () => {
      const mockInput = {
        categorized: {
          features: [
            createMockCommit({ hash: 'f1', message: 'feat(REQ-021): 릴리즈 노트 자동 생성' }),
          ],
          improvements: [
            createMockCommit({ hash: 'i1', message: 'improve: 성능 최적화' }),
          ],
          bugfixes: [
            createMockCommit({ hash: 'b1', message: 'fix: 차트 렌더링 오류 수정' }),
          ],
          others: [],
        },
        allCommits: [
          createMockCommit({ hash: 'f1', message: 'feat(REQ-021): 릴리즈 노트 자동 생성' }),
          createMockCommit({ hash: 'i1', message: 'improve: 성능 최적화' }),
          createMockCommit({ hash: 'b1', message: 'fix: 차트 렌더링 오류 수정' }),
        ],
        fromCommit: 'abc1234',
        toCommit: 'HEAD',
        newCommands: ['release-note'],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test', date: '2026-03-11' });

      // 한눈에 보기 섹션 헤더
      expect(markdown).toContain('## 한눈에 보기');

      // 4개 서브섹션 확인
      expect(markdown).toContain('### 어떤 문제가 있었나요?');
      expect(markdown).toContain('### 어떤 기능이 추가되었나요?');
      expect(markdown).toContain('### 어떤 효과가 있나요?');
      expect(markdown).toContain('### 어떻게 사용하면 되나요?');
    });

    it('should use natural language examples instead of CLI commands', () => {
      const mockInput = {
        categorized: {
          features: [createMockCommit({ hash: 'f1', message: 'feat: 기능 추가' })],
          improvements: [],
          bugfixes: [],
          others: [],
        },
        allCommits: [createMockCommit({ hash: 'f1', message: 'feat: 기능 추가' })],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      // 자연어 예시 포함 확인
      expect(markdown).toContain('lip 프로젝트 리뷰 결과서 만들어줘');
      expect(markdown).toContain('릴리즈 노트 만들어줘');
      expect(markdown).toContain('이 정책 문서화해줘');
      expect(markdown).toContain('저장된 정책 보여줘');

      // CLI 명령어 형식이 사용 예시에 없음 확인
      expect(markdown).not.toContain('/impact generate-review -p lip');
    });

    it('should include auto-generation tip', () => {
      const mockInput = {
        categorized: { features: [], improvements: [], bugfixes: [], others: [] },
        allCommits: [],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      expect(markdown).toContain('기존 분석 저장(save-result) 시 리뷰 결과서가 자동 생성됩니다.');
    });

    it('should dynamically add examples for new commands', () => {
      const mockInput = {
        categorized: {
          features: [createMockCommit({ hash: 'f1', message: 'feat: 갭 체크 기능' })],
          improvements: [],
          bugfixes: [],
          others: [],
        },
        allCommits: [createMockCommit({ hash: 'f1', message: 'feat: 갭 체크 기능' })],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: ['gap-check'],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      // gap-check 명령어가 자연어 예시로 표시됨
      expect(markdown).toContain('기획서 누락 항목 찾아줘');
      expect(markdown).toContain('기획-구현 갭 분석');
    });

    it('should handle unmapped new commands with auto-generated examples', () => {
      const mockInput = {
        categorized: {
          features: [createMockCommit({ hash: 'f1', message: 'feat: 새 기능' })],
          improvements: [],
          bugfixes: [],
          others: [],
        },
        allCommits: [createMockCommit({ hash: 'f1', message: 'feat: 새 기능' })],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: ['custom-wizard'],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      // 매핑 안 된 명령어도 자동 생성된 예시로 표시
      expect(markdown).toContain('custom wizard 실행해줘');
      expect(markdown).toContain('custom wizard 기능');
    });

    it('should show fallback messages when no bugs/features exist', () => {
      const mockInput = {
        categorized: { features: [], improvements: [], bugfixes: [], others: [] },
        allCommits: [],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({ version: 'test' });

      expect(markdown).toContain('이번 릴리스에서 해결된 주요 버그는 없습니다.');
      expect(markdown).toContain('이번 릴리스에서는 내부 개선 및 유지보수 작업이 수행되었습니다.');
      expect(markdown).toContain('코드 품질 및 유지보수성이 향상됩니다.');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  renderSection                                                    */
  /* ---------------------------------------------------------------- */

  describe('renderSection()', () => {
    it('should render header section', () => {
      const result = generator.renderSection('header', {
        version: 'v1.0.0',
        date: '2026-03-11',
        previousCommit: 'abc1234',
      });

      expect(result).toContain('# KIC');
      expect(result).toContain('v1.0.0');
      expect(result).toContain('2026-03-11');
    });

    it('should render at-a-glance section', () => {
      const mockInput = {
        categorized: {
          features: [createMockCommit({ hash: 'f1', message: 'feat: 테스트 기능' })],
          improvements: [],
          bugfixes: [],
          others: [],
        },
        allCommits: [createMockCommit({ hash: 'f1', message: 'feat: 테스트 기능' })],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      const result = generator.renderSection('at-a-glance', mockInput);

      expect(result).toContain('한눈에 보기');
      expect(result).toContain('어떻게 사용하면 되나요?');
      expect(result).toContain('lip 프로젝트 리뷰 결과서 만들어줘');
    });

    it('should render limitations section', () => {
      const result = generator.renderSection('limitations', null);

      expect(result).toContain('알려진 제한 사항');
    });

    it('should render qa-status section', () => {
      const result = generator.renderSection('qa-status', null);

      expect(result).toContain('QA 현황');
    });

    it('should render footer section', () => {
      const result = generator.renderSection('footer', null);

      expect(result).toContain('문의');
    });

    it('should return empty string for unknown section', () => {
      const result = generator.renderSection('unknown-section', null);

      expect(result).toBe('');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  describe('edge cases', () => {
    it('should handle generate with minimal options', () => {
      const mockInput = {
        categorized: { features: [], improvements: [], bugfixes: [], others: [] },
        allCommits: [],
        fromCommit: 'abc',
        toCommit: 'HEAD',
        newCommands: [],
        breakingChanges: [],
      };

      jest.spyOn(generator, 'generateFromGitLog').mockReturnValue(mockInput);

      const markdown = generator.generate({});

      // 빈 커밋이어도 기본 구조는 생성
      expect(markdown).toContain('# KIC');
      expect(markdown).toContain('하위 호환성');
      expect(markdown).toContain('내부 개선 및 유지보수');
    });

    it('should handle commits with special characters in messages', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'sp1', message: 'feat: `코드` & <태그> | "따옴표" 처리' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].message).toContain('`코드`');
    });

    it('should handle feat commit with parentheses scope', () => {
      const commits: CommitInfo[] = [
        createMockCommit({ hash: 'sc1', message: 'feat(REQ-020): 릴리즈 노트 생성기' }),
      ];

      const result = generator.categorizeChanges(commits);

      expect(result.features).toHaveLength(1);
    });
  });
});
