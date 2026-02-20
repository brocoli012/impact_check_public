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
    private _nodes;
    private _edges;
    private _nodeMap;
    /**
     * 파싱된 파일들로부터 의존성 그래프 구축
     * @param parsedFiles - 파싱된 파일 목록
     * @returns 의존성 그래프
     */
    build(parsedFiles: ParsedFile[]): DependencyGraph;
    /**
     * 점진적 빌드 초기화 - 내부 상태 리셋
     */
    beginIncremental(): void;
    /**
     * 단일 ParsedFile을 점진적으로 그래프에 추가 (노드 생성만, 엣지는 나중에)
     * import 엣지 해석에는 전체 노드맵이 필요하므로 노드만 먼저 등록
     * @param file - 파싱된 파일
     */
    addNode(file: ParsedFile): void;
    /**
     * 단일 ParsedFile의 엣지를 점진적으로 추가
     * beginIncremental() → addNode() (모든 파일) → addEdges() (모든 파일) → finishIncremental()
     * @param file - 파싱된 파일
     */
    addEdges(file: ParsedFile): void;
    /**
     * 점진적 빌드 완료 - 결과 반환 및 내부 상태 해제
     * @returns 의존성 그래프
     */
    finishIncremental(): DependencyGraph;
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