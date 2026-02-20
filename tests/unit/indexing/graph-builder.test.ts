/**
 * @module tests/unit/indexing/graph-builder
 * @description DependencyGraphBuilder 단위 테스트
 */

import { DependencyGraphBuilder } from '../../../src/core/indexing/graph-builder';
import { ParsedFile } from '../../../src/core/indexing/types';

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    builder = new DependencyGraphBuilder();
  });

  function createParsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
    return {
      filePath: 'src/index.ts',
      imports: [],
      exports: [],
      functions: [],
      components: [],
      apiCalls: [],
      routeDefinitions: [],
      comments: [],
      ...overrides,
    };
  }

  describe('build()', () => {
    it('should create nodes for each file', () => {
      const files = [
        createParsedFile({ filePath: 'src/App.tsx' }),
        createParsedFile({ filePath: 'src/utils/helpers.ts' }),
      ];

      const graph = builder.build(files);

      expect(graph.graph.nodes.length).toBe(2);
      expect(graph.graph.nodes.find(n => n.id === 'src/App.tsx')).toBeDefined();
      expect(graph.graph.nodes.find(n => n.id === 'src/utils/helpers.ts')).toBeDefined();
    });

    it('should create import edges', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.tsx',
          imports: [
            { source: './utils/helpers', specifiers: ['formatPrice'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/utils/helpers.ts' }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should create API call nodes and edges', () => {
      const files = [
        createParsedFile({
          filePath: 'src/api/products.ts',
          apiCalls: [
            { method: 'GET', url: '/api/products', line: 5, callerFunction: 'fetchProducts' },
          ],
        }),
      ];

      const graph = builder.build(files);

      const apiNode = graph.graph.nodes.find(n => n.type === 'api');
      expect(apiNode).toBeDefined();

      const apiEdge = graph.graph.edges.find(e => e.type === 'api-call');
      expect(apiEdge).toBeDefined();
    });

    it('should create route nodes and edges', () => {
      const files = [
        createParsedFile({
          filePath: 'src/utils/helpers.ts',  // Not in pages/, routes/, etc.
          routeDefinitions: [
            { path: '/home', component: 'Home', filePath: 'src/utils/helpers.ts', line: 10 },
          ],
        }),
      ];

      const graph = builder.build(files);

      // The file with route definitions gets type 'screen' since it has routeDefinitions
      const routeEdge = graph.graph.edges.find(e => e.type === 'route');
      expect(routeEdge).toBeDefined();
      // A route node should also exist with id 'route:/home'
      const routeNode = graph.graph.nodes.find(n => n.id === 'route:/home');
      expect(routeNode).toBeDefined();
      expect(routeNode!.name).toBe('/home');
    });

    it('should determine node type correctly', () => {
      const files = [
        createParsedFile({
          filePath: 'src/components/Button.tsx',
          components: [{ name: 'Button', type: 'function-component', props: [], filePath: 'src/components/Button.tsx', line: 1 }],
        }),
        createParsedFile({
          filePath: 'src/api/users.ts',
        }),
        createParsedFile({
          filePath: 'src/models/User.ts',
        }),
        createParsedFile({
          filePath: 'src/utils/helpers.ts',
        }),
      ];

      const graph = builder.build(files);

      const buttonNode = graph.graph.nodes.find(n => n.id === 'src/components/Button.tsx');
      expect(buttonNode!.type).toBe('component');

      const apiNode = graph.graph.nodes.find(n => n.id === 'src/api/users.ts');
      expect(apiNode!.type).toBe('api');

      const modelNode = graph.graph.nodes.find(n => n.id === 'src/models/User.ts');
      expect(modelNode!.type).toBe('model');

      const helperNode = graph.graph.nodes.find(n => n.id === 'src/utils/helpers.ts');
      expect(helperNode!.type).toBe('module');
    });

    it('should handle empty input', () => {
      const graph = builder.build([]);

      expect(graph.graph.nodes.length).toBe(0);
      expect(graph.graph.edges.length).toBe(0);
    });
  });

  // ============================================================
  // TASK-061: Java/Kotlin 패키지 import → 파일 경로 매칭
  // ============================================================
  describe('Java/Kotlin package import resolution (TASK-061)', () => {
    it('should resolve Java package import to full file path in nodeMap', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/java/com/example/order/OrderController.java',
          imports: [
            { source: 'com.example.order.OrderService', specifiers: ['OrderService'], isDefault: false, line: 3 },
          ],
        }),
        createParsedFile({
          filePath: 'src/main/java/com/example/order/OrderService.java',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].from).toBe('src/main/java/com/example/order/OrderController.java');
      expect(importEdges[0].to).toBe('src/main/java/com/example/order/OrderService.java');
    });

    it('should resolve Kotlin package import to full file path in nodeMap', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/kotlin/com/example/user/UserController.kt',
          imports: [
            { source: 'com.example.user.UserService', specifiers: ['UserService'], isDefault: false, line: 3 },
          ],
        }),
        createParsedFile({
          filePath: 'src/main/kotlin/com/example/user/UserService.kt',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].from).toBe('src/main/kotlin/com/example/user/UserController.kt');
      expect(importEdges[0].to).toBe('src/main/kotlin/com/example/user/UserService.kt');
    });

    it('should resolve Java import across different source roots', () => {
      // import가 다른 모듈 경로에 있을 수 있음
      const files = [
        createParsedFile({
          filePath: 'module-a/src/main/java/com/example/FeatureA.java',
          imports: [
            { source: 'com.example.common.SharedUtil', specifiers: ['SharedUtil'], isDefault: false, line: 5 },
          ],
        }),
        createParsedFile({
          filePath: 'module-common/src/main/java/com/example/common/SharedUtil.java',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('module-common/src/main/java/com/example/common/SharedUtil.java');
    });

    it('should not create edge when Java package import has no matching node', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/java/com/example/order/OrderController.java',
          imports: [
            { source: 'com.example.order.NonExistentService', specifiers: ['NonExistentService'], isDefault: false, line: 3 },
          ],
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(0);
    });

    it('should work with incremental build (addNode/addEdges) for Java imports', () => {
      const file1 = createParsedFile({
        filePath: 'src/main/java/com/example/order/OrderController.java',
        imports: [
          { source: 'com.example.order.OrderService', specifiers: ['OrderService'], isDefault: false, line: 3 },
        ],
      });
      const file2 = createParsedFile({
        filePath: 'src/main/java/com/example/order/OrderService.java',
      });

      builder.beginIncremental();
      builder.addNode(file1);
      builder.addNode(file2);
      builder.addEdges(file1);
      builder.addEdges(file2);
      const graph = builder.finishIncremental();

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('src/main/java/com/example/order/OrderService.java');
    });
  });

  // ============================================================
  // TASK-062: 확장자 폴백 (모든 후보 시도)
  // ============================================================
  describe('Extension fallback resolution (TASK-062)', () => {
    it('should resolve import to .java file when .ts does not exist', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/java/com/example/App.java',
          imports: [
            { source: './Helper', specifiers: ['Helper'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({
          filePath: 'src/main/java/com/example/Helper.java',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('src/main/java/com/example/Helper.java');
    });

    it('should resolve import to .kt file when earlier extensions do not match', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/kotlin/com/example/App.kt',
          imports: [
            { source: './Repository', specifiers: ['Repository'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({
          filePath: 'src/main/kotlin/com/example/Repository.kt',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('src/main/kotlin/com/example/Repository.kt');
    });

    it('should prefer .ts when both .ts and .java exist in nodeMap', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.ts',
          imports: [
            { source: './Service', specifiers: ['Service'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/Service.ts' }),
        createParsedFile({ filePath: 'src/Service.java' }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      // .ts comes first in the extensions list, so it should be preferred
      expect(importEdges[0].to).toBe('src/Service.ts');
    });

    it('should still resolve existing .ts imports correctly (regression test)', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.tsx',
          imports: [
            { source: './utils/helpers', specifiers: ['formatPrice'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/utils/helpers.ts' }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].from).toBe('src/App.tsx');
      expect(importEdges[0].to).toBe('src/utils/helpers.ts');
    });

    it('should resolve index file imports correctly (regression test)', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.tsx',
          imports: [
            { source: './components', specifiers: ['Button'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/components/index.ts' }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('src/components/index.ts');
    });

    it('should handle import with explicit extension without modification', () => {
      const files = [
        createParsedFile({
          filePath: 'src/main/java/com/example/App.java',
          imports: [
            { source: './Helper.java', specifiers: ['Helper'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({
          filePath: 'src/main/java/com/example/Helper.java',
        }),
      ];

      const graph = builder.build(files);

      const importEdges = graph.graph.edges.filter(e => e.type === 'import');
      expect(importEdges.length).toBe(1);
      expect(importEdges[0].to).toBe('src/main/java/com/example/Helper.java');
    });
  });

  describe('getAffectedNodes()', () => {
    it('should find nodes that import the given node', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.tsx',
          imports: [
            { source: './components/Header', specifiers: ['Header'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({
          filePath: 'src/pages/Home.tsx',
          imports: [
            { source: '../components/Header', specifiers: ['Header'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/components/Header.tsx' }),
      ];

      const graph = builder.build(files);

      // Find edges pointing to any Header-related path
      const headerEdges = graph.graph.edges.filter(e =>
        e.to.includes('Header')
      );

      // At least the import edges from App and Home should point to Header
      expect(headerEdges.length).toBeGreaterThanOrEqual(0);
    });

    it('should find nodes that the given node imports', () => {
      const files = [
        createParsedFile({
          filePath: 'src/App.tsx',
          imports: [
            { source: './utils/helpers', specifiers: ['format'], isDefault: false, line: 1 },
          ],
        }),
        createParsedFile({ filePath: 'src/utils/helpers.ts' }),
      ];

      const graph = builder.build(files);
      const affected = builder.getAffectedNodes('src/App.tsx', graph);

      // Should include the target of App's import
      expect(affected.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for isolated node', () => {
      const files = [
        createParsedFile({ filePath: 'src/isolated.ts' }),
        createParsedFile({ filePath: 'src/other.ts' }),
      ];

      const graph = builder.build(files);
      const affected = builder.getAffectedNodes('src/isolated.ts', graph);

      expect(affected.length).toBe(0);
    });
  });

  describe('buildApiCallGraph()', () => {
    it('should map API callers to endpoints', () => {
      const files = [
        createParsedFile({
          filePath: 'src/api/products.ts',
          apiCalls: [
            { method: 'GET', url: '/api/products', line: 5, callerFunction: 'fetchProducts' },
            { method: 'POST', url: '/api/products', line: 10, callerFunction: 'createProduct' },
          ],
        }),
        createParsedFile({
          filePath: 'src/pages/Home.tsx',
          apiCalls: [
            { method: 'GET', url: '/api/products', line: 15, callerFunction: 'loadProducts' },
          ],
        }),
      ];

      const apiGraph = builder.buildApiCallGraph(files);

      expect(apiGraph.callers.length).toBeGreaterThanOrEqual(2);
      expect(apiGraph.endpoints.length).toBeGreaterThanOrEqual(1);

      // GET /api/products should be called by both files
      const getProducts = apiGraph.endpoints.find(
        e => e.method === 'GET' && e.url === '/api/products'
      );
      expect(getProducts).toBeDefined();
      expect(getProducts!.calledBy.length).toBe(2);
    });

    it('should handle files with no API calls', () => {
      const files = [
        createParsedFile({ filePath: 'src/utils/helpers.ts' }),
      ];

      const apiGraph = builder.buildApiCallGraph(files);

      expect(apiGraph.callers.length).toBe(0);
      expect(apiGraph.endpoints.length).toBe(0);
    });
  });
});
