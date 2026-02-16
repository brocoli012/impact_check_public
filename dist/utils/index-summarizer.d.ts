/**
 * @module utils/index-summarizer
 * @description CodeIndex 요약 유틸리티 - 인덱스를 사람이 읽기 쉬운 요약 형태로 변환
 */
import { CodeIndex, IndexMeta } from '../types/index';
/** 화면 요약 정보 */
export interface ScreenSummary {
    /** 화면 ID */
    id: string;
    /** 화면 이름 */
    name: string;
    /** 라우트 경로 */
    route: string;
    /** 포함 컴포넌트 수 */
    componentCount: number;
    /** 호출 API 수 */
    apiCallCount: number;
    /** 복잡도 */
    complexity: string;
}
/** 컴포넌트 요약 정보 */
export interface ComponentSummary {
    /** 컴포넌트 ID */
    id: string;
    /** 컴포넌트 이름 */
    name: string;
    /** 컴포넌트 유형 */
    type: string;
    /** import 수 */
    importCount: number;
    /** importedBy 수 */
    importedByCount: number;
}
/** API 요약 정보 */
export interface ApiSummary {
    /** API ID */
    id: string;
    /** HTTP 메서드 */
    method: string;
    /** API 경로 */
    path: string;
    /** 호출자 수 */
    calledByCount: number;
}
/** 정책 요약 정보 */
export interface PolicySummaryItem {
    /** 정책 ID */
    id: string;
    /** 정책명 */
    name: string;
    /** 카테고리 */
    category: string;
    /** 출처 */
    source: string;
}
/** 의존성 그래프 요약 */
export interface DependencyOverview {
    /** 총 노드 수 */
    totalNodes: number;
    /** 총 엣지 수 */
    totalEdges: number;
    /** 노드 유형별 수 */
    nodesByType: Record<string, number>;
    /** 엣지 유형별 수 */
    edgesByType: Record<string, number>;
    /** 의존성 간선이 가장 많은 상위 10개 노드 */
    topConnected: Array<{
        id: string;
        name: string;
        type: string;
        edgeCount: number;
    }>;
}
/** 인덱스 전체 요약 */
export interface IndexSummary {
    /** 메타 정보 */
    meta: IndexMeta;
    /** 화면 요약 목록 */
    screens: ScreenSummary[];
    /** 컴포넌트 요약 목록 */
    components: ComponentSummary[];
    /** API 요약 목록 */
    apis: ApiSummary[];
    /** 정책 요약 목록 */
    policies: PolicySummaryItem[];
    /** 의존성 그래프 요약 */
    dependencyOverview: DependencyOverview;
}
/**
 * CodeIndex를 요약 형태로 변환
 * @param index - 전체 코드 인덱스
 * @returns 인덱스 요약
 */
export declare function summarizeIndex(index: CodeIndex): IndexSummary;
//# sourceMappingURL=index-summarizer.d.ts.map