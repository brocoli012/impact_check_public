/**
 * @module core/indexing/graph-builder
 * @description 의존성 그래프 빌더 - 파싱된 파일들로부터 의존성 그래프 구축
 */
import { DependencyGraph } from '../../types/index';
import { ParsedFile, ApiCallGraph } from './types';
/**
 * DependencyGraphBuilder - 파싱된 파일들의 의존성 관계를 그래프로 구축
 *
 * 기능:
 *   - import 기반 의존성 그래프 생성
 *   - 영향 받는 노드 탐색 (1-hop)
 *   - API 호출 관계 매핑 (FE -> BE)
 */
export declare class DependencyGraphBuilder {
    /**
     * 파싱된 파일들로부터 의존성 그래프 구축
     * @param parsedFiles - 파싱된 파일 목록
     * @returns 의존성 그래프
     */
    build(parsedFiles: ParsedFile[]): DependencyGraph;
    /**
     * 특정 노드의 영향 받는 노드 탐색 (1-hop)
     * @param nodeId - 대상 노드 ID
     * @param graph - 의존성 그래프
     * @returns 영향 받는 노드 ID 목록
     */
    getAffectedNodes(nodeId: string, graph: DependencyGraph): string[];
    /**
     * API 호출 관계 매핑 (FE -> BE)
     * @param parsedFiles - 파싱된 파일 목록
     * @returns API 호출 그래프
     */
    buildApiCallGraph(parsedFiles: ParsedFile[]): ApiCallGraph;
    /**
     * 파일 경로 정규화
     */
    private normalizeFilePath;
    /**
     * import 경로를 실제 파일 경로로 해석
     */
    private resolveImportPath;
    /**
     * 파일의 노드 유형 판별
     */
    private determineNodeType;
}
//# sourceMappingURL=graph-builder.d.ts.map