/**
 * @module tests/unit/utils/index-summarizer
 * @description index-summarizer 유틸리티 단위 테스트
 */

import { summarizeIndex } from '../../../src/utils/index-summarizer';
import { CodeIndex } from '../../../src/types/index';

/** 테스트용 최소 CodeIndex 생성 */
function createTestCodeIndex(overrides?: Partial<CodeIndex>): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test/path',
        techStack: ['typescript', 'react'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 2,
        components: 3,
        apiEndpoints: 1,
        models: 0,
        modules: 5,
      },
    },
    files: [],
    screens: [
      {
        id: 'screen-1',
        name: 'Home',
        route: '/home',
        filePath: 'src/pages/Home.tsx',
        components: ['comp-1', 'comp-2'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 100, complexity: 'medium' },
      },
      {
        id: 'screen-2',
        name: 'Login',
        route: '/login',
        filePath: 'src/pages/Login.tsx',
        components: ['comp-3'],
        apiCalls: [],
        childScreens: [],
        metadata: { linesOfCode: 50, complexity: 'low' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'Header',
        filePath: 'src/components/Header.tsx',
        type: 'function',
        imports: ['comp-2'],
        importedBy: ['screen-1'],
        props: ['title'],
        emits: [],
        apiCalls: [],
        linesOfCode: 30,
      },
      {
        id: 'comp-2',
        name: 'Nav',
        filePath: 'src/components/Nav.tsx',
        type: 'function',
        imports: [],
        importedBy: ['comp-1', 'screen-1'],
        props: [],
        emits: [],
        apiCalls: [],
        linesOfCode: 20,
      },
      {
        id: 'comp-3',
        name: 'LoginForm',
        filePath: 'src/components/LoginForm.tsx',
        type: 'function',
        imports: [],
        importedBy: ['screen-2'],
        props: ['onSubmit'],
        emits: [],
        apiCalls: ['api-1'],
        linesOfCode: 50,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'POST',
        path: '/api/login',
        filePath: 'src/api/auth.ts',
        handler: 'loginHandler',
        calledBy: ['comp-3', 'screen-1'],
        requestParams: ['username', 'password'],
        responseType: 'AuthResponse',
        relatedModels: [],
      },
    ],
    models: [],
    events: [],
    policies: [
      {
        id: 'policy-1',
        name: 'Auth Policy',
        description: 'Login must require 2FA',
        source: 'comment',
        sourceText: '// @policy: Login must require 2FA',
        filePath: 'src/api/auth.ts',
        lineNumber: 10,
        category: 'security',
        relatedComponents: ['comp-3'],
        relatedApis: ['api-1'],
        relatedModules: [],
        extractedAt: '2025-01-01T00:00:00Z',
      },
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'screen-1', type: 'screen', name: 'Home' },
          { id: 'screen-2', type: 'screen', name: 'Login' },
          { id: 'comp-1', type: 'component', name: 'Header' },
          { id: 'comp-2', type: 'component', name: 'Nav' },
          { id: 'comp-3', type: 'component', name: 'LoginForm' },
          { id: 'api-1', type: 'api', name: 'loginHandler' },
        ],
        edges: [
          { from: 'screen-1', to: 'comp-1', type: 'import' },
          { from: 'screen-1', to: 'comp-2', type: 'import' },
          { from: 'screen-1', to: 'api-1', type: 'api-call' },
          { from: 'comp-1', to: 'comp-2', type: 'import' },
          { from: 'screen-2', to: 'comp-3', type: 'import' },
          { from: 'comp-3', to: 'api-1', type: 'api-call' },
        ],
      },
    },
    ...overrides,
  };
}

describe('index-summarizer', () => {
  describe('summarizeIndex()', () => {
    it('should return an IndexSummary with all expected fields', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary).toHaveProperty('meta');
      expect(summary).toHaveProperty('screens');
      expect(summary).toHaveProperty('components');
      expect(summary).toHaveProperty('apis');
      expect(summary).toHaveProperty('policies');
      expect(summary).toHaveProperty('dependencyOverview');
    });

    it('should preserve meta info', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary.meta).toEqual(index.meta);
    });

    it('should summarize screens correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary.screens).toHaveLength(2);
      expect(summary.screens[0]).toEqual({
        id: 'screen-1',
        name: 'Home',
        route: '/home',
        componentCount: 2,
        apiCallCount: 1,
        complexity: 'medium',
      });
      expect(summary.screens[1]).toEqual({
        id: 'screen-2',
        name: 'Login',
        route: '/login',
        componentCount: 1,
        apiCallCount: 0,
        complexity: 'low',
      });
    });

    it('should summarize components correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary.components).toHaveLength(3);
      expect(summary.components[0]).toEqual({
        id: 'comp-1',
        name: 'Header',
        type: 'function',
        importCount: 1,
        importedByCount: 1,
      });
    });

    it('should summarize APIs correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary.apis).toHaveLength(1);
      expect(summary.apis[0]).toEqual({
        id: 'api-1',
        method: 'POST',
        path: '/api/login',
        calledByCount: 2,
      });
    });

    it('should summarize policies correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);

      expect(summary.policies).toHaveLength(1);
      expect(summary.policies[0]).toEqual({
        id: 'policy-1',
        name: 'Auth Policy',
        category: 'security',
        source: 'comment',
      });
    });

    it('should provide dependency overview with correct counts', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);
      const depOverview = summary.dependencyOverview;

      expect(depOverview.totalNodes).toBe(6);
      expect(depOverview.totalEdges).toBe(6);
    });

    it('should count nodes by type correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);
      const { nodesByType } = summary.dependencyOverview;

      expect(nodesByType['screen']).toBe(2);
      expect(nodesByType['component']).toBe(3);
      expect(nodesByType['api']).toBe(1);
    });

    it('should count edges by type correctly', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);
      const { edgesByType } = summary.dependencyOverview;

      expect(edgesByType['import']).toBe(4);
      expect(edgesByType['api-call']).toBe(2);
    });

    it('should identify top connected nodes sorted by edge count descending', () => {
      const index = createTestCodeIndex();
      const summary = summarizeIndex(index);
      const { topConnected } = summary.dependencyOverview;

      // screen-1 has 3 outgoing edges, so it should be at the top
      expect(topConnected.length).toBeGreaterThan(0);
      expect(topConnected[0].id).toBe('screen-1');
      expect(topConnected[0].edgeCount).toBe(3);

      // All edge counts should be in descending order
      for (let i = 1; i < topConnected.length; i++) {
        expect(topConnected[i].edgeCount).toBeLessThanOrEqual(topConnected[i - 1].edgeCount);
      }
    });

    it('should limit topConnected to 10 entries', () => {
      // Create an index with many nodes
      const nodes = Array.from({ length: 20 }, (_, i) => ({
        id: `node-${i}`,
        type: 'component' as const,
        name: `Component${i}`,
      }));
      const edges = Array.from({ length: 20 }, (_, i) => ({
        from: `node-${i}`,
        to: `node-${(i + 1) % 20}`,
        type: 'import' as const,
      }));

      const index = createTestCodeIndex({
        dependencies: { graph: { nodes, edges } },
      });
      const summary = summarizeIndex(index);

      expect(summary.dependencyOverview.topConnected.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty index', () => {
      const index = createTestCodeIndex({
        screens: [],
        components: [],
        apis: [],
        models: [],
        events: [],
        policies: [],
        dependencies: { graph: { nodes: [], edges: [] } },
      });
      const summary = summarizeIndex(index);

      expect(summary.screens).toHaveLength(0);
      expect(summary.components).toHaveLength(0);
      expect(summary.apis).toHaveLength(0);
      expect(summary.policies).toHaveLength(0);
      expect(summary.dependencyOverview.totalNodes).toBe(0);
      expect(summary.dependencyOverview.totalEdges).toBe(0);
      expect(summary.dependencyOverview.topConnected).toHaveLength(0);
    });
  });
});
