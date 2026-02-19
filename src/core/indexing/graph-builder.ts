/**
 * @module core/indexing/graph-builder
 * @description 의존성 그래프 빌더 - 파싱된 파일들로부터 의존성 그래프 구축
 */

import * as path from 'path';
import { DependencyGraph, DependencyNode, DependencyEdge } from '../../types/index';
import { ParsedFile, ApiCallGraph, ApiCallerNode, ApiEndpointNode } from './types';
import { logger } from '../../utils/logger';

/**
 * DependencyGraphBuilder - 파싱된 파일들의 의존성 관계를 그래프로 구축
 *
 * 기능:
 *   - import 기반 의존성 그래프 생성
 *   - 영향 받는 노드 탐색 (1-hop)
 *   - API 호출 관계 매핑 (FE -> BE)
 */
export class DependencyGraphBuilder {
  /**
   * 파싱된 파일들로부터 의존성 그래프 구축
   * @param parsedFiles - 파싱된 파일 목록
   * @returns 의존성 그래프
   */
  build(parsedFiles: ParsedFile[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // 1. 노드 생성 (파일 단위)
    for (const file of parsedFiles) {
      const nodeId = this.normalizeFilePath(file.filePath);
      const nodeType = this.determineNodeType(file);

      const node: DependencyNode = {
        id: nodeId,
        type: nodeType,
        name: path.basename(file.filePath, path.extname(file.filePath)),
      };

      nodes.push(node);
      nodeMap.set(nodeId, node);
    }

    // 2. 엣지 생성 (import 관계)
    for (const file of parsedFiles) {
      const sourceId = this.normalizeFilePath(file.filePath);

      for (const imp of file.imports) {
        const resolvedTarget = this.resolveImportPath(file.filePath, imp.source);
        if (resolvedTarget && nodeMap.has(resolvedTarget)) {
          edges.push({
            from: sourceId,
            to: resolvedTarget,
            type: 'import',
          });
        }
      }

      // API 호출 엣지
      for (const apiCall of file.apiCalls) {
        const apiNodeId = `api:${apiCall.method}:${apiCall.url}`;
        if (!nodeMap.has(apiNodeId)) {
          const apiNode: DependencyNode = {
            id: apiNodeId,
            type: 'api',
            name: `${apiCall.method} ${apiCall.url}`,
          };
          nodes.push(apiNode);
          nodeMap.set(apiNodeId, apiNode);
        }
        edges.push({
          from: sourceId,
          to: apiNodeId,
          type: 'api-call',
        });
      }

      // 라우트 정의 엣지
      for (const route of file.routeDefinitions) {
        const routeNodeId = `route:${route.path}`;
        if (!nodeMap.has(routeNodeId)) {
          const routeNode: DependencyNode = {
            id: routeNodeId,
            type: 'screen',
            name: route.path,
          };
          nodes.push(routeNode);
          nodeMap.set(routeNodeId, routeNode);
        }
        edges.push({
          from: sourceId,
          to: routeNodeId,
          type: 'route',
        });
      }
    }

    logger.debug(`Graph built: ${nodes.length} nodes, ${edges.length} edges`);

    return {
      graph: { nodes, edges },
    };
  }

  /**
   * 특정 노드의 영향 받는 노드 탐색 (1-hop)
   * @param nodeId - 대상 노드 ID
   * @param graph - 의존성 그래프
   * @returns 영향 받는 노드 ID 목록
   */
  getAffectedNodes(nodeId: string, graph: DependencyGraph): string[] {
    const affected = new Set<string>();

    // 이 노드를 import하는 파일 (역방향 탐색)
    for (const edge of graph.graph.edges) {
      if (edge.to === nodeId) {
        affected.add(edge.from);
      }
    }

    // 이 노드가 import하는 파일 (순방향 탐색)
    for (const edge of graph.graph.edges) {
      if (edge.from === nodeId) {
        affected.add(edge.to);
      }
    }

    return [...affected];
  }

  /**
   * API 호출 관계 매핑 (FE -> BE)
   * @param parsedFiles - 파싱된 파일 목록
   * @returns API 호출 그래프
   */
  buildApiCallGraph(parsedFiles: ParsedFile[]): ApiCallGraph {
    const callers: ApiCallerNode[] = [];
    const endpointMap = new Map<string, ApiEndpointNode>();

    for (const file of parsedFiles) {
      if (file.apiCalls.length === 0) continue;

      // 함수별 API 호출 그룹핑
      const functionCalls = new Map<string, typeof file.apiCalls>();
      for (const call of file.apiCalls) {
        const existing = functionCalls.get(call.callerFunction) || [];
        existing.push(call);
        functionCalls.set(call.callerFunction, existing);
      }

      for (const [funcName, calls] of functionCalls) {
        callers.push({
          filePath: file.filePath,
          functionName: funcName,
          calls,
        });

        // 엔드포인트 매핑
        for (const call of calls) {
          const key = `${call.method}:${call.url}`;
          const existing = endpointMap.get(key);
          if (existing) {
            if (!existing.calledBy.includes(file.filePath)) {
              existing.calledBy.push(file.filePath);
            }
          } else {
            endpointMap.set(key, {
              method: call.method,
              url: call.url,
              calledBy: [file.filePath],
            });
          }
        }
      }
    }

    return {
      callers,
      endpoints: [...endpointMap.values()],
    };
  }

  /**
   * 파일 경로 정규화
   */
  private normalizeFilePath(filePath: string): string {
    // 확장자 제거 및 정규화
    return filePath.replace(/\\/g, '/');
  }

  /**
   * import 경로를 실제 파일 경로로 해석
   */
  private resolveImportPath(sourceFile: string, importSource: string): string | null {
    // node_modules 패키지는 건너뛰기 (단, Java 패키지 import는 예외)
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      // Java/Kotlin 패키지 경로 해석 시도 (예: com.example.order → com/example/order)
      if (importSource.match(/^[a-z]+\.[a-z]/)) {
        const javaPath = importSource.replace(/\./g, '/');
        return this.normalizeFilePath(javaPath);
      }
      return null;
    }

    const sourceDir = path.dirname(sourceFile);
    let resolvedPath = path.join(sourceDir, importSource);

    // 확장자 자동 추가 시도
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.java', '.kt', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    for (const ext of extensions) {
      const candidate = resolvedPath + ext;
      // 실제 파일 시스템을 확인하지 않고 경로만 정규화
      if (!resolvedPath.match(/\.\w+$/)) {
        return this.normalizeFilePath(candidate);
      }
    }

    return this.normalizeFilePath(resolvedPath);
  }

  /**
   * 파일의 노드 유형 판별
   */
  private determineNodeType(file: ParsedFile): DependencyNode['type'] {
    // 컴포넌트가 있으면 component
    if (file.components.length > 0) {
      return 'component';
    }

    // 라우트 정의가 있으면 screen
    if (file.routeDefinitions.length > 0) {
      return 'screen';
    }

    // API 관련 패턴이 있으면 api
    const filePath = file.filePath.toLowerCase();
    if (
      filePath.includes('/api/') ||
      filePath.includes('/routes/') ||
      filePath.includes('/controllers/') ||
      filePath.includes('/handlers/') ||
      filePath.includes('/controller/')
    ) {
      return 'api';
    }

    // Spring 서비스/리포지토리 패턴
    if (
      filePath.includes('/service/') ||
      filePath.includes('/services/') ||
      filePath.includes('/repository/') ||
      filePath.includes('/repositories/')
    ) {
      return 'module';
    }

    // model 패턴
    if (
      filePath.includes('/models/') ||
      filePath.includes('/entities/') ||
      filePath.includes('/entity/') ||
      filePath.includes('/schemas/') ||
      filePath.includes('/domain/') ||
      filePath.includes('/dto/')
    ) {
      return 'model';
    }

    return 'module';
  }
}
