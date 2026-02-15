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
    it('should return a CodeIndex (MVP falls back to full index)', async () => {
      const index = await indexer.incrementalUpdate(FIXTURE_PATH);

      expect(index).toBeDefined();
      expect(index.meta).toBeDefined();
      expect(index.files.length).toBeGreaterThan(0);
    });
  });
});
