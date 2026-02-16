/**
 * @module tests/unit/indexing/changed-files
 * @description Indexer.getChangedFiles() 단위 테스트
 */

import * as path from 'path';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ChangedFileSet } from '../../../src/types/index';

// simple-git 모킹
jest.mock('simple-git', () => {
  const mockGit = {
    checkIsRepo: jest.fn(),
    diff: jest.fn(),
    diffSummary: jest.fn(),
    log: jest.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
    branch: jest.fn().mockResolvedValue({ current: 'main' }),
  };

  return {
    simpleGit: jest.fn(() => mockGit),
    __mockGit: mockGit,
  };
});

// simple-git 모킹 인스턴스 가져오기
const { __mockGit: mockGit } = jest.requireMock('simple-git') as {
  __mockGit: {
    checkIsRepo: jest.Mock;
    diff: jest.Mock;
    diffSummary: jest.Mock;
    log: jest.Mock;
    branch: jest.Mock;
  };
};

const FIXTURE_PATH = path.resolve(__dirname, '../../fixtures/sample-project');

describe('Indexer.getChangedFiles()', () => {
  let indexer: Indexer;

  beforeEach(() => {
    indexer = new Indexer();
    jest.clearAllMocks();
  });

  describe('Git diff 방식 (정상 동작)', () => {
    beforeEach(() => {
      mockGit.checkIsRepo.mockResolvedValue(true);
    });

    it('should return ChangedFileSet with git-diff method on success', async () => {
      mockGit.diff.mockResolvedValue(
        'A\tsrc/new-file.ts\nM\tsrc/modified-file.ts\nD\tsrc/deleted-file.ts\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result).toBeDefined();
      expect(result.method).toBe('git-diff');
      expect(result.added).toContain('src/new-file.ts');
      expect(result.modified).toContain('src/modified-file.ts');
      expect(result.deleted).toContain('src/deleted-file.ts');
    });

    it('should correctly classify added files', async () => {
      mockGit.diff.mockResolvedValue(
        'A\tsrc/feature/new-component.tsx\nA\tsrc/utils/helper.ts\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.added).toHaveLength(2);
      expect(result.added).toContain('src/feature/new-component.tsx');
      expect(result.added).toContain('src/utils/helper.ts');
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should correctly classify modified files', async () => {
      mockGit.diff.mockResolvedValue(
        'M\tsrc/app.ts\nM\tsrc/index.tsx\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.modified).toHaveLength(2);
      expect(result.modified).toContain('src/app.ts');
      expect(result.modified).toContain('src/index.tsx');
      expect(result.added).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should correctly classify deleted files', async () => {
      mockGit.diff.mockResolvedValue(
        'D\tsrc/old-module.ts\nD\tsrc/deprecated.jsx\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.deleted).toHaveLength(2);
      expect(result.deleted).toContain('src/old-module.ts');
      expect(result.deleted).toContain('src/deprecated.jsx');
      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
    });

    it('should filter only TypeScript/JavaScript files', async () => {
      mockGit.diff.mockResolvedValue(
        [
          'M\tsrc/component.tsx',
          'M\tsrc/utils.ts',
          'M\tsrc/script.js',
          'M\tsrc/module.jsx',
          'M\tREADME.md',
          'M\tpackage.json',
          'M\tstyles/main.css',
          'M\tassets/logo.png',
          'M\tDockerfile',
          'M\t.env',
        ].join('\n') + '\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.modified).toHaveLength(4);
      expect(result.modified).toContain('src/component.tsx');
      expect(result.modified).toContain('src/utils.ts');
      expect(result.modified).toContain('src/script.js');
      expect(result.modified).toContain('src/module.jsx');
      // Non-supported files should be excluded
      expect(result.modified).not.toContain('README.md');
      expect(result.modified).not.toContain('package.json');
      expect(result.modified).not.toContain('styles/main.css');
    });

    it('should also support Vue, Java, Kotlin, Python files', async () => {
      mockGit.diff.mockResolvedValue(
        [
          'A\tsrc/Component.vue',
          'M\tsrc/Main.java',
          'M\tsrc/Service.kt',
          'A\tsrc/script.py',
        ].join('\n') + '\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.added).toContain('src/Component.vue');
      expect(result.added).toContain('src/script.py');
      expect(result.modified).toContain('src/Main.java');
      expect(result.modified).toContain('src/Service.kt');
    });

    it('should handle empty diff (no changes)', async () => {
      mockGit.diff.mockResolvedValue('');

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.method).toBe('git-diff');
    });

    it('should handle renamed files', async () => {
      mockGit.diff.mockResolvedValue(
        'R100\tsrc/old-name.ts\tsrc/new-name.ts\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      // Renamed: old file treated as deleted, new file as added
      expect(result.deleted).toContain('src/old-name.ts');
      expect(result.added).toContain('src/new-name.ts');
    });

    it('should handle mixed status changes correctly', async () => {
      mockGit.diff.mockResolvedValue(
        [
          'A\tsrc/new.ts',
          'M\tsrc/changed.tsx',
          'D\tsrc/removed.js',
          'A\tsrc/another-new.jsx',
          'M\tsrc/also-changed.ts',
        ].join('\n') + '\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.added).toHaveLength(2);
      expect(result.modified).toHaveLength(2);
      expect(result.deleted).toHaveLength(1);
    });
  });

  describe('Hash 비교 폴백', () => {
    let loadIndexSpy: jest.SpyInstance;

    beforeEach(() => {
      // loadIndex를 모킹하여 이전 인덱스가 없는 상태를 시뮬레이션
      loadIndexSpy = jest.spyOn(indexer, 'loadIndex').mockResolvedValue(null);
    });

    afterEach(() => {
      loadIndexSpy.mockRestore();
    });

    it('should fall back to hash-compare when not a git repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result).toBeDefined();
      expect(result.method).toBe('hash-compare');
      // In fallback mode with no previous index, all files are "added"
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should fall back to hash-compare when git command fails', async () => {
      mockGit.checkIsRepo.mockRejectedValue(new Error('git not found'));

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result).toBeDefined();
      expect(result.method).toBe('hash-compare');
    });

    it('should detect all current files as added when no previous index exists', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'nonexistent');

      expect(result.method).toBe('hash-compare');
      // All scanned files should appear as "added" since there's no previous index
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });

    it('should detect modified files when previous index has different hashes', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      // Mock a previous index with a file that has a different hash
      loadIndexSpy.mockResolvedValue({
        meta: {} as any,
        files: [
          { path: 'src/pages/Home.tsx', hash: 'old-hash-different', size: 100, extension: '.tsx', lastModified: '' },
        ],
        screens: [],
        components: [],
        apis: [],
        models: [],
        policies: [],
        dependencies: { graph: { nodes: [], edges: [] } },
      });

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.method).toBe('hash-compare');
      expect(result.modified).toContain('src/pages/Home.tsx');
    });

    it('should detect deleted files when previous index has files not in current scan', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      // Mock a previous index with a file that no longer exists
      loadIndexSpy.mockResolvedValue({
        meta: {} as any,
        files: [
          { path: 'src/deleted-component.ts', hash: 'some-hash', size: 100, extension: '.ts', lastModified: '' },
        ],
        screens: [],
        components: [],
        apis: [],
        models: [],
        policies: [],
        dependencies: { graph: { nodes: [], edges: [] } },
      });

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result.method).toBe('hash-compare');
      expect(result.deleted).toContain('src/deleted-component.ts');
    });
  });

  describe('ChangedFileSet 타입 구조', () => {
    it('should have correct structure with all required fields', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.diff.mockResolvedValue('M\tsrc/file.ts\n');

      const result: ChangedFileSet = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('modified');
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('method');
      expect(Array.isArray(result.added)).toBe(true);
      expect(Array.isArray(result.modified)).toBe(true);
      expect(Array.isArray(result.deleted)).toBe(true);
      expect(['git-diff', 'hash-compare']).toContain(result.method);
    });

    it('should return string arrays for file paths', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.diff.mockResolvedValue(
        'A\tsrc/new.ts\nM\tsrc/mod.ts\nD\tsrc/del.ts\n'
      );

      const result = await indexer.getChangedFiles(FIXTURE_PATH, 'abc123');

      for (const filePath of [...result.added, ...result.modified, ...result.deleted]) {
        expect(typeof filePath).toBe('string');
      }
    });
  });
});
