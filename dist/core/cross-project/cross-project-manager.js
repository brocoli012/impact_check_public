"use strict";
/**
 * @module core/cross-project/cross-project-manager
 * @description 크로스 프로젝트 매니저 - 프로젝트 간 의존성 관리
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossProjectManager = void 0;
const path = __importStar(require("path"));
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
const shared_entity_indexer_1 = require("./shared-entity-indexer");
/** 기본 설정 (파일 없을 때 반환) */
function createDefaultConfig() {
    return {
        version: 1,
        links: [],
        groups: [],
    };
}
/**
 * CrossProjectManager - 프로젝트 간 의존성 관리
 *
 * 기본 경로: ~/.impact/cross-project.json
 * 글로벌 설정 파일로, 모든 프로젝트의 크로스 프로젝트 의존성을 관리합니다.
 */
class CrossProjectManager {
    /**
     * CrossProjectManager 생성
     * @param basePath - 기본 경로 (기본값: ~/.impact/)
     */
    constructor(basePath) {
        const base = basePath || (0, file_1.getImpactDir)();
        this.configPath = path.join(base, 'cross-project.json');
    }
    /**
     * 설정 파일 로드 (없으면 빈 설정 반환)
     * @returns 크로스 프로젝트 설정
     */
    async loadConfig() {
        const config = (0, file_1.readJsonFile)(this.configPath);
        return config || createDefaultConfig();
    }
    /**
     * 설정 파일 저장
     * @param config - 저장할 크로스 프로젝트 설정
     */
    async saveConfig(config) {
        (0, file_1.writeJsonFile)(this.configPath, config);
    }
    /**
     * 프로젝트 간 의존성 등록 (파일 잠금으로 동시 접근 보호)
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @param type - 의존성 유형
     * @param apis - 관련 API 경로 목록
     * @returns 생성된 프로젝트 링크
     */
    async link(source, target, type, apis) {
        return (0, file_1.withFileLock)(this.configPath, async () => {
            const config = await this.loadConfig();
            // 중복 체크: 동일 source-target 링크가 이미 존재하면 기존 링크 반환
            const existing = config.links.find(l => l.source === source && l.target === target);
            if (existing) {
                logger_1.logger.info(`이미 존재하는 링크입니다: ${source} -> ${target}`);
                return existing;
            }
            const link = {
                id: `${source}-${target}`,
                source,
                target,
                type,
                autoDetected: false,
                confirmedAt: new Date().toISOString(),
            };
            if (apis && apis.length > 0) {
                link.apis = apis;
            }
            config.links.push(link);
            await this.saveConfig(config);
            logger_1.logger.info(`의존성 등록 완료: ${source} -> ${target} (${type})`);
            return link;
        });
    }
    /**
     * 프로젝트 간 의존성 해제 (파일 잠금으로 동시 접근 보호)
     * 양방향 삭제: A->B, B->A 모두 확인하여 삭제
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @returns 삭제 성공 여부
     */
    async unlink(source, target) {
        return (0, file_1.withFileLock)(this.configPath, async () => {
            const config = await this.loadConfig();
            const initialLength = config.links.length;
            // 양방향 삭제: source->target 또는 target->source 모두 삭제
            config.links = config.links.filter(l => !((l.source === source && l.target === target) ||
                (l.source === target && l.target === source)));
            if (config.links.length === initialLength) {
                logger_1.logger.warn(`해제할 링크가 없습니다: ${source} <-> ${target}`);
                return false;
            }
            await this.saveConfig(config);
            logger_1.logger.info(`의존성 해제 완료: ${source} <-> ${target}`);
            return true;
        });
    }
    /**
     * 의존성 조회 (특정 프로젝트 또는 전체)
     * @param projectId - 프로젝트 ID (생략 시 전체 조회)
     * @returns 프로젝트 링크 목록
     */
    async getLinks(projectId) {
        const config = await this.loadConfig();
        if (!projectId) {
            return config.links;
        }
        return config.links.filter(l => l.source === projectId || l.target === projectId);
    }
    /**
     * 특정 링크 조회
     * @param source - 소스 프로젝트 ID
     * @param target - 대상 프로젝트 ID
     * @returns 프로젝트 링크 또는 null
     */
    async getLink(source, target) {
        const config = await this.loadConfig();
        const link = config.links.find(l => l.source === source && l.target === target);
        return link || null;
    }
    /**
     * 그룹 추가 (파일 잠금으로 동시 접근 보호)
     * @param name - 그룹 이름
     * @param projectIds - 포함할 프로젝트 ID 목록
     * @returns 생성된 프로젝트 그룹
     */
    async addGroup(name, projectIds) {
        return (0, file_1.withFileLock)(this.configPath, async () => {
            const config = await this.loadConfig();
            // 동일 이름의 그룹이 있으면 덮어쓰기
            const existingIdx = config.groups.findIndex(g => g.name === name);
            const group = { name, projects: projectIds };
            if (existingIdx !== -1) {
                config.groups[existingIdx] = group;
                logger_1.logger.info(`그룹 업데이트 완료: ${name}`);
            }
            else {
                config.groups.push(group);
                logger_1.logger.info(`그룹 추가 완료: ${name}`);
            }
            await this.saveConfig(config);
            return group;
        });
    }
    /**
     * 그룹 조회
     * @param name - 그룹 이름
     * @returns 프로젝트 그룹 또는 null
     */
    async getGroup(name) {
        const config = await this.loadConfig();
        const group = config.groups.find(g => g.name === name);
        return group || null;
    }
    /**
     * 그룹 목록 조회
     * @returns 프로젝트 그룹 목록
     */
    async getGroups() {
        const config = await this.loadConfig();
        return config.groups;
    }
    /**
     * 그룹 삭제 (파일 잠금으로 동시 접근 보호)
     * @param name - 삭제할 그룹 이름
     * @returns 삭제 성공 여부
     */
    async removeGroup(name) {
        return (0, file_1.withFileLock)(this.configPath, async () => {
            const config = await this.loadConfig();
            const initialLength = config.groups.length;
            config.groups = config.groups.filter(g => g.name !== name);
            if (config.groups.length === initialLength) {
                logger_1.logger.warn(`삭제할 그룹이 없습니다: ${name}`);
                return false;
            }
            await this.saveConfig(config);
            logger_1.logger.info(`그룹 삭제 완료: ${name}`);
            return true;
        });
    }
    /**
     * API 경로 매칭 기반 자동 의존성 감지
     *
     * 각 프로젝트의 인덱스를 로드하고, 프로젝트 간 API 경로 매칭을 통해
     * 자동으로 의존성 링크를 탐지합니다.
     *
     * @param indexer - 인덱서 인스턴스 (loadIndex 사용)
     * @param projectIds - 감지 대상 프로젝트 ID 목록
     * @returns 감지된 ProjectLink 배열 (autoDetected: true, 저장하지 않음)
     */
    async detectLinks(indexer, projectIds) {
        if (projectIds.length < 2) {
            logger_1.logger.info('의존성 감지에는 최소 2개 프로젝트가 필요합니다.');
            return [];
        }
        // 1. 각 프로젝트의 인덱스 로드
        const projectApis = new Map();
        for (const projectId of projectIds) {
            const index = await indexer.loadIndex(projectId);
            if (index && index.apis && index.apis.length > 0) {
                projectApis.set(projectId, index.apis);
            }
            else {
                logger_1.logger.debug(`프로젝트 ${projectId}의 인덱스 또는 API가 없습니다.`);
            }
        }
        // 2. 프로젝트 간 API 경로 매칭
        const detectedLinks = [];
        const projectIdsWithApis = Array.from(projectApis.keys());
        for (let i = 0; i < projectIdsWithApis.length; i++) {
            for (let j = 0; j < projectIdsWithApis.length; j++) {
                if (i === j)
                    continue;
                const providerId = projectIdsWithApis[i];
                const consumerId = projectIdsWithApis[j];
                const providerApis = projectApis.get(providerId);
                const consumerApis = projectApis.get(consumerId);
                // provider의 API 경로와 consumer의 API 경로 매칭
                const matchedPaths = this.matchApiPaths(providerApis, consumerApis);
                if (matchedPaths.length > 0) {
                    // 중복 링크 방지 (source-target 순서 기준)
                    const existingLink = detectedLinks.find(l => l.source === consumerId && l.target === providerId);
                    if (!existingLink) {
                        detectedLinks.push({
                            id: `${consumerId}-${providerId}`,
                            source: consumerId,
                            target: providerId,
                            type: 'api-consumer',
                            apis: matchedPaths,
                            autoDetected: true,
                        });
                    }
                }
            }
        }
        // 3. 테이블/이벤트 기반 공유 엔티티 감지
        const projectIndexMap = new Map();
        for (const projectId of projectIds) {
            const index = await indexer.loadIndex(projectId);
            if (index) {
                projectIndexMap.set(projectId, index);
            }
        }
        if (projectIndexMap.size >= 2) {
            const sharedIndexer = new shared_entity_indexer_1.SharedEntityIndexer();
            const sharedIndex = sharedIndexer.build(projectIndexMap);
            // 공유 테이블 기반 링크 생성
            const sharedTables = sharedIndexer.getSharedTables(sharedIndex);
            for (const [tableName, refs] of Object.entries(sharedTables)) {
                const projects = [...new Set(refs.map(r => r.projectId))];
                for (let i = 0; i < projects.length; i++) {
                    for (let j = i + 1; j < projects.length; j++) {
                        const linkId = `${projects[i]}-${projects[j]}-shared-db`;
                        const existingLink = detectedLinks.find(l => l.id === linkId);
                        if (!existingLink) {
                            detectedLinks.push({
                                id: linkId,
                                source: projects[i],
                                target: projects[j],
                                type: 'shared-db',
                                apis: [tableName],
                                autoDetected: true,
                            });
                        }
                        else if (existingLink.apis) {
                            if (!existingLink.apis.includes(tableName)) {
                                existingLink.apis.push(tableName);
                            }
                        }
                    }
                }
            }
            // 공유 이벤트 기반 링크 생성
            const sharedEvents = sharedIndexer.getSharedEvents(sharedIndex);
            for (const [eventKey, refs] of Object.entries(sharedEvents)) {
                const publishers = refs.filter(r => r.role === 'publisher');
                const subscribers = refs.filter(r => r.role === 'subscriber');
                for (const pub of publishers) {
                    for (const sub of subscribers) {
                        if (pub.projectId === sub.projectId)
                            continue;
                        const pubLinkId = `${pub.projectId}-${sub.projectId}-event-pub`;
                        if (!detectedLinks.find(l => l.id === pubLinkId)) {
                            detectedLinks.push({
                                id: pubLinkId,
                                source: pub.projectId,
                                target: sub.projectId,
                                type: 'event-publisher',
                                apis: [eventKey],
                                autoDetected: true,
                            });
                        }
                    }
                }
            }
        }
        logger_1.logger.info(`자동 감지된 의존성: ${detectedLinks.length}건`);
        return detectedLinks;
    }
    /**
     * API 경로 매칭 기반 자동 의존성 감지 + 저장 (원자적)
     *
     * detectLinks()를 호출한 후, 결과를 cross-project.json에 저장합니다.
     * - 기존 수동 링크(autoDetected: false)는 보존
     * - 기존 자동 링크(autoDetected: true)는 최신 결과로 교체
     * - 수동 링크와 동일 source-target 조합이면 건너뜀
     *
     * @param indexer - 인덱서 인스턴스
     * @param projectIds - 감지 대상 프로젝트 ID 목록
     * @returns DetectResult (감지/저장 통계)
     */
    async detectAndSave(indexer, projectIds) {
        // 1. detectLinks() 호출
        const detected = await this.detectLinks(indexer, projectIds);
        if (detected.length === 0) {
            return { detected: 0, saved: 0, total: 0, byType: {} };
        }
        // 2. withFileLock으로 감싸서 cross-project.json에 저장
        return (0, file_1.withFileLock)(this.configPath, async () => {
            const config = await this.loadConfig();
            // 3. 수동 링크 보존, 기존 자동 링크 제거
            const manualLinks = config.links.filter(l => !l.autoDetected);
            // 4. 신규 자동 링크 추가 (중복 방지: 수동 링크와 동일 source-target이면 건너뜀)
            let savedCount = 0;
            const autoLinks = [];
            for (const link of detected) {
                const existsManual = manualLinks.find(m => m.source === link.source && m.target === link.target);
                if (!existsManual) {
                    // R3-CODE-02: spread로 새 객체 생성 (detectLinks 반환 객체 직접 mutate 방지)
                    const linkWithTimestamp = { ...link, confirmedAt: new Date().toISOString() };
                    autoLinks.push(linkWithTimestamp);
                    savedCount++;
                }
            }
            // 5. 병합 및 저장
            config.links = [...manualLinks, ...autoLinks];
            await this.saveConfig(config);
            // 6. 통계 반환
            const byType = {};
            for (const link of autoLinks) {
                byType[link.type] = (byType[link.type] || 0) + 1;
            }
            logger_1.logger.info(`detectAndSave 완료: 감지 ${detected.length}건, 신규 저장 ${savedCount}건, 총 ${config.links.length}건`);
            return {
                detected: detected.length,
                saved: savedCount,
                total: config.links.length,
                byType,
            };
        });
    }
    /**
     * 두 프로젝트의 API 경로 매칭
     * - 정확 매칭 (exact match) 우선
     * - 패턴 매칭 (path parameter 치환) 2차
     *
     * @param providerApis - 제공자 프로젝트의 API 목록
     * @param consumerApis - 소비자 프로젝트의 API 목록
     * @returns 매칭된 API 경로 목록
     */
    matchApiPaths(providerApis, consumerApis) {
        const matchedPaths = [];
        const seen = new Set();
        for (const provider of providerApis) {
            for (const consumer of consumerApis) {
                if (seen.has(provider.path))
                    continue;
                // 1. 정확 매칭
                if (provider.path === consumer.path) {
                    seen.add(provider.path);
                    matchedPaths.push(provider.path);
                    continue;
                }
                // 2. 패턴 매칭 (path parameter 치환)
                if (this.matchPathPattern(provider.path, consumer.path)) {
                    seen.add(provider.path);
                    matchedPaths.push(provider.path);
                }
            }
        }
        return matchedPaths;
    }
    /**
     * 두 경로가 패턴 매칭으로 동일한지 확인
     * 예: `/api/users/:id` ↔ `/api/users/123`
     *
     * @param pathA - 경로 A (path parameter 포함 가능)
     * @param pathB - 경로 B (path parameter 포함 가능)
     * @returns 매칭 여부
     */
    matchPathPattern(pathA, pathB) {
        const segmentsA = pathA.split('/').filter(Boolean);
        const segmentsB = pathB.split('/').filter(Boolean);
        if (segmentsA.length !== segmentsB.length)
            return false;
        for (let k = 0; k < segmentsA.length; k++) {
            const a = segmentsA[k];
            const b = segmentsB[k];
            // path parameter (:xxx, {xxx}) 또는 숫자는 와일드카드로 취급
            const isParamA = a.startsWith(':') || a.startsWith('{');
            const isParamB = b.startsWith(':') || b.startsWith('{');
            const isNumericA = /^\d+$/.test(a);
            const isNumericB = /^\d+$/.test(b);
            if (isParamA || isParamB || isNumericA || isNumericB) {
                continue; // 와일드카드: 매칭으로 간주
            }
            if (a !== b)
                return false;
        }
        return true;
    }
}
exports.CrossProjectManager = CrossProjectManager;
//# sourceMappingURL=cross-project-manager.js.map