/**
 * @module tests/unit/indexing/indexer
 * @description Indexer 단위 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Indexer } from '../../../src/core/indexing/indexer';

const FIXTURE_PATH = path.resolve(__dirname, '../../fixtures/sample-project');

describe('Indexer', () => {
  let indexer: Indexer;
  let tempDir: string;

  beforeEach(() => {
    indexer = new Indexer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexer-test-'));
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('fullIndex()', () => {
    it('should produce a complete CodeIndex', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index).toBeDefined();
      expect(index.meta).toBeDefined();
      expect(index.files).toBeInstanceOf(Array);
      expect(index.screens).toBeInstanceOf(Array);
      expect(index.components).toBeInstanceOf(Array);
      expect(index.apis).toBeInstanceOf(Array);
      expect(index.policies).toBeInstanceOf(Array);
      expect(index.dependencies).toBeDefined();
    });

    it('should include meta information', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.meta.version).toBe(1);
      expect(index.meta.project.name).toBe('sample-project');
      expect(index.meta.project.techStack).toBeInstanceOf(Array);
      expect(index.meta.project.techStack.length).toBeGreaterThan(0);
      expect(index.meta.stats.totalFiles).toBeGreaterThan(0);
    });

    it('should set lastUpdateType to full', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.meta.lastUpdateType).toBe('full');
    });

    it('should detect files', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.files.length).toBeGreaterThan(0);
      // Should find all fixture files
      const filePaths = index.files.map(f => f.path);
      expect(filePaths.some(p => p.includes('App.tsx'))).toBe(true);
      expect(filePaths.some(p => p.includes('products.ts'))).toBe(true);
    });

    it('should detect screens from pages/ directory', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.screens.length).toBeGreaterThanOrEqual(1);
      const screenNames = index.screens.map(s => s.name);
      expect(screenNames).toContain('Home');
    });

    it('should detect components', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.components.length).toBeGreaterThan(0);
      const componentNames = index.components.map(c => c.name);
      // Should find components from the fixture files
      expect(componentNames.length).toBeGreaterThan(0);
    });

    it('should extract policies', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      // The fixture files contain policy comments
      expect(index.policies.length).toBeGreaterThan(0);
      // Should find at least the policy comments in fixture files
      const policySources = index.policies.map(p => p.source);
      expect(policySources).toContain('comment');
    });

    it('should build dependency graph', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.dependencies.graph.nodes.length).toBeGreaterThan(0);
      expect(index.dependencies.graph.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect tech stack', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      expect(index.meta.project.techStack).toContain('React');
      expect(index.meta.project.techStack).toContain('TypeScript');
    });
  });

  describe('saveIndex() and loadIndex()', () => {
    it('should save and load index correctly', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      const projectId = 'test-project';
      await indexer.saveIndex(index, projectId, tempDir);

      const loaded = await indexer.loadIndex(projectId, tempDir);

      expect(loaded).toBeDefined();
      expect(loaded!.meta.version).toBe(index.meta.version);
      expect(loaded!.meta.project.name).toBe(index.meta.project.name);
      expect(loaded!.files.length).toBe(index.files.length);
      expect(loaded!.screens.length).toBe(index.screens.length);
      expect(loaded!.components.length).toBe(index.components.length);
      expect(loaded!.policies.length).toBe(index.policies.length);
    });

    it('should save individual JSON files', async () => {
      const index = await indexer.fullIndex(FIXTURE_PATH);

      const projectId = 'test-project';
      await indexer.saveIndex(index, projectId, tempDir);

      const indexDir = path.join(tempDir, '.impact', 'projects', projectId, 'index');
      expect(fs.existsSync(path.join(indexDir, 'meta.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'files.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'screens.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'components.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'apis.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'models.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'policies.json'))).toBe(true);
      expect(fs.existsSync(path.join(indexDir, 'dependencies.json'))).toBe(true);
    });

    it('should return null for non-existent index', async () => {
      const loaded = await indexer.loadIndex('nonexistent-project', tempDir);
      expect(loaded).toBeNull();
    });
  });

  describe('incrementalUpdate()', () => {
    const projectId = 'test-inc-project';

    it('should fall back to fullIndex when no existing index', async () => {
      // No saved index exists at tempDir -> should fall back to fullIndex
      const fullIndexSpy = jest.spyOn(indexer, 'fullIndex');
      const index = await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      expect(index).toBeDefined();
      expect(index.meta).toBeDefined();
      expect(index.files.length).toBeGreaterThan(0);
      expect(fullIndexSpy).toHaveBeenCalledWith(FIXTURE_PATH);

      fullIndexSpy.mockRestore();
    });

    it('should return existing index when no changes detected', async () => {
      // First create a full index and save it
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      // Mock getChangedFiles to return no changes
      const getChangedFilesSpy = jest.spyOn(indexer, 'getChangedFiles').mockResolvedValue({
        added: [],
        modified: [],
        deleted: [],
        method: 'git-diff',
      });

      const result = await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      // Should return the same index without re-indexing
      expect(result.meta.version).toBe(fullIndex.meta.version);
      expect(result.files.length).toBe(fullIndex.files.length);

      getChangedFilesSpy.mockRestore();
    });

    it('should switch to fullIndex when change ratio exceeds 30%', async () => {
      // Create and save a small index with 3 files
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      const totalFiles = fullIndex.files.length;
      // Generate enough "modified" files to exceed 30%
      const modifiedCount = Math.ceil(totalFiles * 0.31);
      const modifiedFiles = fullIndex.files.slice(0, modifiedCount).map(f => f.path);

      const getChangedFilesSpy = jest.spyOn(indexer, 'getChangedFiles').mockResolvedValue({
        added: [],
        modified: modifiedFiles,
        deleted: [],
        method: 'git-diff',
      });

      const fullIndexSpy = jest.spyOn(indexer, 'fullIndex');
      await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      // Should have called fullIndex due to high change ratio
      // fullIndex is called: once directly by incrementalUpdate's fallback logic
      expect(fullIndexSpy).toHaveBeenCalled();

      getChangedFilesSpy.mockRestore();
      fullIndexSpy.mockRestore();
    });

    it('should set meta.lastUpdateType to incremental after incremental update', async () => {
      // Create and save initial index
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      // Mock: only 1 file modified (well under 30%)
      const getChangedFilesSpy = jest.spyOn(indexer, 'getChangedFiles').mockResolvedValue({
        added: [],
        modified: [fullIndex.files[0].path],
        deleted: [],
        method: 'git-diff',
      });

      const result = await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      expect(result.meta.lastUpdateType).toBe('incremental');

      getChangedFilesSpy.mockRestore();
    });

    it('should remove deleted files from the index', async () => {
      // Create and save initial index
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      // Pick a file to "delete"
      const fileToDelete = fullIndex.files[0].path;

      const getChangedFilesSpy = jest.spyOn(indexer, 'getChangedFiles').mockResolvedValue({
        added: [],
        modified: [],
        deleted: [fileToDelete],
        method: 'git-diff',
      });

      const result = await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      // The deleted file should not be in the updated index
      const filePaths = result.files.map(f => f.path);
      expect(filePaths).not.toContain(fileToDelete);
      // But other files should still be there
      expect(result.files.length).toBe(fullIndex.files.length - 1);

      getChangedFilesSpy.mockRestore();
    });

    it('should fall back to fullIndex on git error', async () => {
      // Create and save initial index
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      // Mock getChangedFiles to throw
      const getChangedFilesSpy = jest.spyOn(indexer, 'getChangedFiles').mockRejectedValue(
        new Error('Git error: invalid commit'),
      );

      const fullIndexSpy = jest.spyOn(indexer, 'fullIndex');
      const result = await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      expect(result).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      expect(fullIndexSpy).toHaveBeenCalled();

      getChangedFilesSpy.mockRestore();
      fullIndexSpy.mockRestore();
    });

    it('should fall back to fullIndex when existing index has unknown gitCommit', async () => {
      // Create and save initial index with unknown commit
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      fullIndex.meta.gitCommit = 'unknown';
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      const fullIndexSpy = jest.spyOn(indexer, 'fullIndex');
      await indexer.incrementalUpdate(FIXTURE_PATH, projectId, tempDir);

      expect(fullIndexSpy).toHaveBeenCalled();

      fullIndexSpy.mockRestore();
    });
  });

  describe('annotations option', () => {
    it('should not generate annotations when annotationsEnabled is false (default)', async () => {
      const defaultIndexer = new Indexer();
      const { AnnotationGenerator } = await import('../../../src/core/annotations/annotation-generator');
      const generateBatchSpy = jest.spyOn(AnnotationGenerator.prototype, 'generateBatch');

      await defaultIndexer.fullIndex(FIXTURE_PATH);

      expect(generateBatchSpy).not.toHaveBeenCalled();
      generateBatchSpy.mockRestore();
    });

    it('should not generate annotations when annotationsEnabled is explicitly false', async () => {
      const disabledIndexer = new Indexer({ annotationsEnabled: false });
      const { AnnotationGenerator } = await import('../../../src/core/annotations/annotation-generator');
      const generateBatchSpy = jest.spyOn(AnnotationGenerator.prototype, 'generateBatch');

      await disabledIndexer.fullIndex(FIXTURE_PATH);

      expect(generateBatchSpy).not.toHaveBeenCalled();
      generateBatchSpy.mockRestore();
    });
  });

  describe('isIndexStale()', () => {
    const projectId = 'test-stale-project';

    it('should return true when no index exists', async () => {
      const stale = await indexer.isIndexStale(FIXTURE_PATH, projectId, tempDir);
      expect(stale).toBe(true);
    });

    it('should return true when gitCommit is unknown', async () => {
      // Create index with unknown commit
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      fullIndex.meta.gitCommit = 'unknown';
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      const stale = await indexer.isIndexStale(FIXTURE_PATH, projectId, tempDir);
      expect(stale).toBe(true);
    });

    it('should return true when gitCommit is empty', async () => {
      // Create index with empty commit
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      fullIndex.meta.gitCommit = '';
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      const stale = await indexer.isIndexStale(FIXTURE_PATH, projectId, tempDir);
      expect(stale).toBe(true);
    });

    it('should return false when HEAD matches meta.gitCommit', async () => {
      // Create a full index (which captures current HEAD commit)
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      // Only run this test if we have a real git commit
      if (fullIndex.meta.gitCommit === 'unknown') {
        // Skip: not a git repo or git not available
        return;
      }

      await indexer.saveIndex(fullIndex, projectId, tempDir);

      // Since we just indexed with the current HEAD, it should not be stale
      // (assuming no new commits were made between fullIndex and isIndexStale calls)
      const stale = await indexer.isIndexStale(FIXTURE_PATH, projectId, tempDir);
      expect(stale).toBe(false);
    });

    it('should return true when HEAD differs from meta.gitCommit', async () => {
      // Create index with a fake old commit hash
      const fullIndex = await indexer.fullIndex(FIXTURE_PATH);
      fullIndex.meta.gitCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await indexer.saveIndex(fullIndex, projectId, tempDir);

      const stale = await indexer.isIndexStale(FIXTURE_PATH, projectId, tempDir);
      expect(stale).toBe(true);
    });
  });
});
