"use strict";
/**
 * @module core/cross-project/shared-entity-indexer
 * @description 공유 엔티티 역인덱스 빌더 - 테이블/이벤트 기반 크로스 프로젝트 매핑
 *
 * 각 프로젝트의 CodeIndex에서 models[].tableName과 events[].name/topic을 키로
 * 역인덱스를 구축하여, 2개+ 프로젝트가 같은 테이블/이벤트를 참조하는 경우를 탐지한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedEntityIndexer = void 0;
const logger_1 = require("../../utils/logger");
/**
 * SharedEntityIndexer - 크로스 프로젝트 공유 엔티티 역인덱스 빌더
 *
 * 사용법:
 *   const indexer = new SharedEntityIndexer();
 *   const sharedIndex = indexer.build(projectIndexMap);
 */
class SharedEntityIndexer {
    /**
     * 공유 엔티티 역인덱스 빌드
     *
     * @param projectIndexMap - 프로젝트 ID → CodeIndex 매핑
     * @returns SharedEntityIndex (테이블/이벤트 역인덱스)
     */
    build(projectIndexMap) {
        const tables = {};
        const events = {};
        // 각 프로젝트의 models/events를 순회하여 역인덱스 구축
        for (const [projectId, index] of projectIndexMap) {
            // 테이블 역인덱스
            this.buildTableIndex(projectId, index, tables);
            // 이벤트 역인덱스
            this.buildEventIndex(projectId, index, events);
        }
        // 단일 프로젝트만 참조하는 항목 제거 (공유 엔티티만 유지)
        // 설계 변경: 모든 엔티티를 유지하되, 공유 여부는 호출자가 판단
        // 이유: reverse 명령어에서 단일 프로젝트 엔티티도 조회 가능
        const result = {
            version: 1,
            updatedAt: new Date().toISOString(),
            tables,
            events,
        };
        const tableCount = Object.keys(tables).length;
        const eventCount = Object.keys(events).length;
        const sharedTableCount = Object.values(tables).filter(refs => {
            const projects = new Set(refs.map(r => r.projectId));
            return projects.size >= 2;
        }).length;
        const sharedEventCount = Object.values(events).filter(refs => {
            const projects = new Set(refs.map(r => r.projectId));
            return projects.size >= 2;
        }).length;
        logger_1.logger.info(`SharedEntityIndex: ${tableCount} tables (${sharedTableCount} shared), ` +
            `${eventCount} events (${sharedEventCount} shared)`);
        return result;
    }
    /**
     * 공유 테이블 목록 반환 (2+ 프로젝트가 참조하는 테이블만)
     */
    getSharedTables(index) {
        const shared = {};
        for (const [table, refs] of Object.entries(index.tables)) {
            const projects = new Set(refs.map(r => r.projectId));
            if (projects.size >= 2) {
                shared[table] = refs;
            }
        }
        return shared;
    }
    /**
     * 공유 이벤트 목록 반환 (pub/sub 매칭이 있는 이벤트만)
     */
    getSharedEvents(index) {
        const shared = {};
        for (const [event, refs] of Object.entries(index.events)) {
            const hasPub = refs.some(r => r.role === 'publisher');
            const hasSub = refs.some(r => r.role === 'subscriber');
            // pub/sub 모두 있거나, 2+ 프로젝트가 참조하는 경우
            if ((hasPub && hasSub) || new Set(refs.map(r => r.projectId)).size >= 2) {
                shared[event] = refs;
            }
        }
        return shared;
    }
    /**
     * 특정 테이블을 참조하는 프로젝트 조회
     */
    findProjectsByTable(index, tableName) {
        return index.tables[tableName] || [];
    }
    /**
     * 특정 이벤트를 참조하는 프로젝트 조회
     */
    findProjectsByEvent(index, eventName) {
        return index.events[eventName] || [];
    }
    /**
     * 키워드로 테이블/이벤트 검색
     */
    search(index, keyword) {
        const lowerKeyword = keyword.toLowerCase();
        const tables = Object.entries(index.tables)
            .filter(([name]) => name.toLowerCase().includes(lowerKeyword))
            .map(([name, refs]) => ({ name, refs }));
        const events = Object.entries(index.events)
            .filter(([name]) => name.toLowerCase().includes(lowerKeyword))
            .map(([name, refs]) => ({ name, refs }));
        return { tables, events };
    }
    // ============================================================
    // Private Methods
    // ============================================================
    /**
     * 테이블 역인덱스 구축
     */
    buildTableIndex(projectId, index, tables) {
        if (!index.models || index.models.length === 0)
            return;
        for (const model of index.models) {
            const tableName = model.tableName;
            if (!tableName)
                continue;
            const columns = model.fields
                .filter(f => !f.isRelation)
                .map(f => f.columnName || f.name);
            // accessPattern 추정: 엔티티가 있으면 기본적으로 read-write
            const accessPattern = 'read-write';
            const ref = {
                projectId,
                entityName: model.name,
                filePath: model.filePath,
                columns,
                accessPattern,
            };
            if (!tables[tableName]) {
                tables[tableName] = [];
            }
            tables[tableName].push(ref);
        }
    }
    /**
     * 이벤트 역인덱스 구축
     */
    buildEventIndex(projectId, index, events) {
        if (!index.events || index.events.length === 0)
            return;
        for (const event of index.events) {
            // 키: topic이 있으면 topic, 없으면 name
            const key = event.topic || event.name;
            if (!key)
                continue;
            const ref = {
                projectId,
                role: event.role,
                handler: event.handler,
                filePath: event.filePath,
                topic: event.topic,
            };
            if (!events[key]) {
                events[key] = [];
            }
            events[key].push(ref);
        }
    }
}
exports.SharedEntityIndexer = SharedEntityIndexer;
//# sourceMappingURL=shared-entity-indexer.js.map