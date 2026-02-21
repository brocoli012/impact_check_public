/**
 * @module core/cross-project/shared-entity-indexer
 * @description 공유 엔티티 역인덱스 빌더 - 테이블/이벤트 기반 크로스 프로젝트 매핑
 *
 * 각 프로젝트의 CodeIndex에서 models[].tableName과 events[].name/topic을 키로
 * 역인덱스를 구축하여, 2개+ 프로젝트가 같은 테이블/이벤트를 참조하는 경우를 탐지한다.
 */
import { CodeIndex } from '../../types/index';
import { SharedEntityIndex, TableReference, EventReference } from './shared-entity-types';
/**
 * SharedEntityIndexer - 크로스 프로젝트 공유 엔티티 역인덱스 빌더
 *
 * 사용법:
 *   const indexer = new SharedEntityIndexer();
 *   const sharedIndex = indexer.build(projectIndexMap);
 */
export declare class SharedEntityIndexer {
    /**
     * 공유 엔티티 역인덱스 빌드
     *
     * @param projectIndexMap - 프로젝트 ID → CodeIndex 매핑
     * @returns SharedEntityIndex (테이블/이벤트 역인덱스)
     */
    build(projectIndexMap: Map<string, CodeIndex>): SharedEntityIndex;
    /**
     * 공유 테이블 목록 반환 (2+ 프로젝트가 참조하는 테이블만)
     */
    getSharedTables(index: SharedEntityIndex): Record<string, TableReference[]>;
    /**
     * 공유 이벤트 목록 반환 (pub/sub 매칭이 있는 이벤트만)
     */
    getSharedEvents(index: SharedEntityIndex): Record<string, EventReference[]>;
    /**
     * 특정 테이블을 참조하는 프로젝트 조회
     */
    findProjectsByTable(index: SharedEntityIndex, tableName: string): TableReference[];
    /**
     * 특정 이벤트를 참조하는 프로젝트 조회
     */
    findProjectsByEvent(index: SharedEntityIndex, eventName: string): EventReference[];
    /**
     * 키워드로 테이블/이벤트 검색
     */
    search(index: SharedEntityIndex, keyword: string): {
        tables: Array<{
            name: string;
            refs: TableReference[];
        }>;
        events: Array<{
            name: string;
            refs: EventReference[];
        }>;
    };
    /**
     * 테이블 역인덱스 구축
     */
    private buildTableIndex;
    /**
     * 이벤트 역인덱스 구축
     */
    private buildEventIndex;
}
//# sourceMappingURL=shared-entity-indexer.d.ts.map