"use strict";
/**
 * @module server/web-server
 * @description Express.js 웹 서버 - React SPA 정적 파일 서빙 및 API 엔드포인트
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.isServerRunning = isServerRunning;
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const result_manager_1 = require("../core/analysis/result-manager");
const config_manager_1 = require("../config/config-manager");
const indexer_1 = require("../core/indexing/indexer");
const annotation_loader_1 = require("../core/annotations/annotation-loader");
const annotation_manager_1 = require("../core/annotations/annotation-manager");
const policy_converter_1 = require("../core/annotations/policy-converter");
const cross_project_manager_1 = require("../core/cross-project/cross-project-manager");
const logger_1 = require("../utils/logger");
const file_1 = require("../utils/file");
/** Express 라우트 파라미터에서 안전하게 문자열을 추출 */
function getParam(params, key) {
    const value = params[key];
    if (Array.isArray(value))
        return value[0] || '';
    return value || '';
}
/** ID 파라미터 안전성 검증 (영숫자, 하이픈, 언더스코어만 허용) */
function isValidId(id) {
    return /^[a-zA-Z0-9_-]+$/.test(id);
}
/** 서버 인스턴스 관리를 위한 변수 */
let serverInstance = null;
/** 캐시된 활성 프로젝트 경로 (서버 시작 시 1회 로드) */
let cachedProjectPath = null;
/**
 * 포트가 사용 가능한지 확인
 * @param port - 확인할 포트 번호
 * @returns 사용 가능 여부
 */
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, '127.0.0.1');
    });
}
/**
 * 사용 가능한 포트를 찾기
 * @param startPort - 시작 포트 (기본: 3847)
 * @param maxAttempts - 최대 시도 횟수 (기본: 10)
 * @returns 사용 가능한 포트 번호
 */
async function findAvailablePort(startPort = 3847, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available port found (tried ${startPort}-${startPort + maxAttempts - 1})`);
}
/**
 * 체크리스트 파일 경로를 반환
 */
function getChecklistPath(basePath, projectId, resultId) {
    const impactBase = basePath || process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(impactBase, '.impact', 'projects', projectId, 'checklists', `${resultId}.json`);
}
/**
 * Express 앱을 생성하고 설정
 * @param basePath - 데이터 저장 기본 경로
 * @returns Express Application
 */
function createApp(basePath) {
    const app = (0, express_1.default)();
    const resultManager = new result_manager_1.ResultManager(basePath);
    const configManager = new config_manager_1.ConfigManager(basePath);
    /** 캐시된 프로젝트 ID를 반환하거나, 미로드 시 1회 로드 후 캐시 */
    async function getProjectId() {
        if (cachedProjectPath !== null)
            return cachedProjectPath || null;
        await configManager.load();
        cachedProjectPath = configManager.getActiveProject() || '';
        return cachedProjectPath || null;
    }
    app.use(express_1.default.json());
    // ============================================================
    // API 엔드포인트
    // ============================================================
    /**
     * GET /api/results - 분석 결과 목록 조회
     */
    app.get('/api/results', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({ results: [], message: 'No active project' });
                return;
            }
            const results = await resultManager.list(projectId);
            res.json({ results });
        }
        catch (error) {
            logger_1.logger.error('Failed to list results:', error);
            res.status(500).json({ error: 'Failed to list results' });
        }
    });
    /**
     * GET /api/results/latest - 최신 분석 결과 조회
     */
    app.get('/api/results/latest', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({ result: null, message: 'No active project' });
                return;
            }
            const result = await resultManager.getLatest(projectId);
            if (!result) {
                res.json({ result: null, message: 'No analysis results found' });
                return;
            }
            res.json({ result });
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest result:', error);
            res.status(500).json({ error: 'Failed to get latest result' });
        }
    });
    /**
     * GET /api/results/:id - 특정 분석 결과 조회
     */
    app.get('/api/results/:id', async (req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.status(404).json({ error: 'No active project' });
                return;
            }
            const resultId = getParam(req.params, 'id');
            if (!isValidId(resultId)) {
                res.status(400).json({ error: 'Invalid result ID' });
                return;
            }
            const result = await resultManager.getById(projectId, resultId);
            if (!result) {
                res.status(404).json({ error: 'Result not found' });
                return;
            }
            res.json({ result });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get result ${getParam(req.params, 'id')}:`, error);
            res.status(500).json({ error: 'Failed to get result' });
        }
    });
    /**
     * GET /api/checklist/:resultId - 체크리스트 상태 조회
     */
    app.get('/api/checklist/:resultId', async (req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.status(404).json({ error: 'No active project' });
                return;
            }
            const resultIdParam = getParam(req.params, 'resultId');
            if (!isValidId(resultIdParam)) {
                res.status(400).json({ error: 'Invalid result ID' });
                return;
            }
            const checklistPath = getChecklistPath(basePath, projectId, resultIdParam);
            const checklist = (0, file_1.readJsonFile)(checklistPath);
            res.json({ checklist: checklist || { resultId: resultIdParam, items: [] } });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get checklist for ${getParam(req.params, 'resultId')}:`, error);
            res.status(500).json({ error: 'Failed to get checklist' });
        }
    });
    /**
     * PATCH /api/checklist/:resultId/:itemId - 체크리스트 항목 상태 업데이트
     */
    app.patch('/api/checklist/:resultId/:itemId', async (req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.status(404).json({ error: 'No active project' });
                return;
            }
            const resultId = getParam(req.params, 'resultId');
            const itemId = getParam(req.params, 'itemId');
            if (!isValidId(resultId) || !isValidId(itemId)) {
                res.status(400).json({ error: 'Invalid ID parameter' });
                return;
            }
            const { checked } = req.body;
            if (typeof checked !== 'boolean') {
                res.status(400).json({ error: 'checked field must be a boolean' });
                return;
            }
            const checklistPath = getChecklistPath(basePath, projectId, resultId);
            const existing = (0, file_1.readJsonFile)(checklistPath);
            const checklist = existing || { resultId, items: [] };
            const existingIndex = checklist.items.findIndex(item => item.itemId === itemId);
            const updatedItem = {
                itemId,
                checked,
                updatedAt: new Date().toISOString(),
            };
            if (existingIndex >= 0) {
                checklist.items[existingIndex] = updatedItem;
            }
            else {
                checklist.items.push(updatedItem);
            }
            (0, file_1.ensureDir)(path.dirname(checklistPath));
            (0, file_1.writeJsonFile)(checklistPath, checklist);
            res.json({ item: updatedItem });
        }
        catch (error) {
            logger_1.logger.error(`Failed to update checklist item:`, error);
            res.status(500).json({ error: 'Failed to update checklist item' });
        }
    });
    // ============================================================
    // 프로젝트 현황 (Project Status) API 엔드포인트
    // ============================================================
    const indexer = new indexer_1.Indexer();
    // AnnotationManager expects basePath to be the .impact directory itself
    const impactBase = basePath || process.env.HOME || process.env.USERPROFILE || '.';
    const annotationLoader = new annotation_loader_1.AnnotationLoader(path.join(impactBase, '.impact'));
    const annotationManager = new annotation_manager_1.AnnotationManager(path.join(impactBase, '.impact'));
    /**
     * GET /api/project/status - 프로젝트 현황 조회
     * 인덱스/어노테이션/분석 결과 존재 여부 반환
     */
    app.get('/api/project/status', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({
                    projectId: null,
                    projectPath: null,
                    hasIndex: false,
                    hasAnnotations: false,
                    hasResults: false,
                });
                return;
            }
            // 프로젝트 경로 읽기
            const projectsPath = path.join(impactBase, '.impact', 'projects.json');
            const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
            const projectEntry = projectsConfig?.projects?.find(p => p.id === projectId);
            const projectPath = projectEntry?.path || null;
            // 인덱스 존재 여부
            const projectDir = (0, file_1.getProjectDir)(projectId, basePath);
            const indexMetaPath = path.join(projectDir, 'index', 'meta.json');
            const hasIndex = fs.existsSync(indexMetaPath);
            // 어노테이션 존재 여부
            const annotationMeta = await annotationManager.getMeta(projectId);
            const hasAnnotations = annotationMeta !== null && annotationMeta.totalAnnotations > 0;
            // 분석 결과 존재 여부
            const latestResult = await resultManager.getLatest(projectId);
            const hasResults = latestResult !== null;
            res.json({
                projectId,
                projectPath,
                hasIndex,
                hasAnnotations,
                hasResults,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get project status:', error);
            res.status(500).json({ error: 'Failed to get project status' });
        }
    });
    /**
     * GET /api/project/index-meta - 인덱스 메타 정보 조회
     */
    app.get('/api/project/index-meta', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({ meta: null, message: 'No active project' });
                return;
            }
            const projectDir = (0, file_1.getProjectDir)(projectId, basePath);
            const indexMetaPath = path.join(projectDir, 'index', 'meta.json');
            if (!fs.existsSync(indexMetaPath)) {
                res.json({ meta: null, message: 'No index found' });
                return;
            }
            const meta = (0, file_1.readJsonFile)(indexMetaPath);
            res.json({ meta });
        }
        catch (error) {
            logger_1.logger.error('Failed to get index meta:', error);
            res.status(500).json({ error: 'Failed to get index meta' });
        }
    });
    /**
     * GET /api/project/annotation-meta - 어노테이션 메타 정보 조회
     */
    app.get('/api/project/annotation-meta', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({ meta: null, message: 'No active project' });
                return;
            }
            const meta = await annotationManager.getMeta(projectId);
            if (!meta) {
                res.json({ meta: null, message: 'No annotations found' });
                return;
            }
            res.json({ meta });
        }
        catch (error) {
            logger_1.logger.error('Failed to get annotation meta:', error);
            res.status(500).json({ error: 'Failed to get annotation meta' });
        }
    });
    // ============================================================
    // 정책 (Policy) API 엔드포인트
    // ============================================================
    /**
     * GET /api/policies - 정책 목록 조회
     * 쿼리 파라미터: ?category=배송 (카테고리 필터), ?search=무료 (검색)
     */
    app.get('/api/policies', async (req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.status(404).json({ error: 'No active project' });
                return;
            }
            const index = await indexer.loadIndex(projectId, basePath);
            // 인덱스 없어도 어노테이션만으로 정책 조회 가능
            const indexPolicies = index?.policies || [];
            // 어노테이션에서 추론된 정책 로드 및 변환
            let annotationPolicies = [];
            try {
                const annotations = await annotationManager.loadAll(projectId);
                if (annotations.size > 0) {
                    annotationPolicies = (0, policy_converter_1.convertAnnotationsToPolicies)(annotations);
                }
            }
            catch (err) {
                logger_1.logger.warn('Failed to load annotation policies:', err);
            }
            // 인덱스 + 어노테이션 정책 병합 (중복 제거)
            const allMergedPolicies = (0, policy_converter_1.mergePolicies)(indexPolicies, annotationPolicies);
            if (allMergedPolicies.length === 0 && !index) {
                res.json({ policies: [], total: 0, offset: 0, limit: 0, hasMore: false, categories: [] });
                return;
            }
            // 분석 결과에서 tasks 로드하여 relatedTaskIds 역매핑에 사용
            const latestResult = await resultManager.getLatest(projectId);
            const tasks = latestResult?.tasks || [];
            let policies = allMergedPolicies;
            // 카테고리 필터
            const category = req.query.category;
            if (category) {
                policies = policies.filter(p => p.category === category);
            }
            // 검색 필터
            const search = req.query.search;
            if (search) {
                const lowerSearch = search.toLowerCase();
                policies = policies.filter(p => p.name.toLowerCase().includes(lowerSearch) ||
                    p.description.toLowerCase().includes(lowerSearch));
            }
            // 카테고리 목록 추출 (필터 전 전체 병합 목록에서)
            const categories = [...new Set(allMergedPolicies.map(p => p.category))].sort();
            /**
             * 정책별 relatedTaskIds 역매핑 계산
             * 전략: task의 affectedFiles/relatedApis와 policy의 filePath/relatedComponents/relatedApis를 매칭
             */
            function computeRelatedTaskIds(policy) {
                if (tasks.length === 0)
                    return [];
                const taskIds = [];
                for (const task of tasks) {
                    let matched = false;
                    // 1) affectedFiles와 policy.filePath 매칭
                    if (policy.filePath && task.affectedFiles) {
                        if (task.affectedFiles.some((f) => f === policy.filePath || policy.filePath.includes(f) || f.includes(policy.filePath))) {
                            matched = true;
                        }
                    }
                    // 2) relatedApis 매칭
                    if (!matched && policy.relatedApis && task.relatedApis) {
                        if (policy.relatedApis.some((api) => task.relatedApis.includes(api))) {
                            matched = true;
                        }
                    }
                    // 3) policy.relatedComponents와 task.affectedFiles 매칭
                    if (!matched && policy.relatedComponents) {
                        for (const comp of policy.relatedComponents) {
                            if (task.affectedFiles?.some((f) => f.includes(comp))) {
                                matched = true;
                                break;
                            }
                        }
                    }
                    // 4) 정책 이름 키워드와 task 제목/description 키워드 매칭
                    if (!matched) {
                        const policyKeywords = policy.name.toLowerCase().split(/[\s,/]+/).filter((w) => w.length > 1);
                        const taskText = `${task.title} ${task.description}`.toLowerCase();
                        const matchedKeywords = policyKeywords.filter((kw) => taskText.includes(kw));
                        if (matchedKeywords.length >= 2 || (matchedKeywords.length >= 1 && policyKeywords.length <= 2)) {
                            matched = true;
                        }
                    }
                    if (matched)
                        taskIds.push(task.id);
                }
                return taskIds;
            }
            // 페이지네이션 파라미터
            const offset = parseInt(req.query.offset, 10) || 0;
            const limit = parseInt(req.query.limit, 10) || 0; // 0 = 전체
            const total = policies.length;
            // 전체 매핑 후 슬라이스 (offset/limit)
            const mappedAll = policies.map((p, idx) => ({
                id: p.id || `policy_${idx}`,
                name: p.name,
                category: p.category,
                description: p.description,
                file: p.filePath,
                confidence: p.confidence ?? 0,
                affectedFiles: [p.filePath, ...(p.relatedComponents || [])].filter(Boolean),
                relatedTaskIds: p.relatedTaskIds?.length > 0
                    ? p.relatedTaskIds
                    : computeRelatedTaskIds(p),
                source: p.source || 'comment',
            }));
            const paged = limit > 0 ? mappedAll.slice(offset, offset + limit) : mappedAll;
            res.json({
                policies: paged,
                total,
                offset,
                limit: limit || total,
                hasMore: limit > 0 ? (offset + limit) < total : false,
                categories,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get policies:', error);
            res.status(500).json({ error: 'Failed to get policies' });
        }
    });
    /**
     * GET /api/policies/:id - 특정 정책 상세 정보 반환
     * 보강 주석 데이터 포함
     */
    app.get('/api/policies/:id', async (req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.status(404).json({ error: 'No active project' });
                return;
            }
            const index = await indexer.loadIndex(projectId, basePath);
            if (!index) {
                res.status(404).json({ error: 'No index found. Run indexing first.' });
                return;
            }
            const policyId = getParam(req.params, 'id');
            const policies = index.policies || [];
            // ID 또는 배열 인덱스로 검색
            let policy = policies.find(p => p.id === policyId);
            if (!policy) {
                // policy_N 형식이면 인덱스로 찾기
                const indexMatch = policyId.match(/^policy_(\d+)$/);
                if (indexMatch) {
                    const idx = parseInt(indexMatch[1], 10);
                    if (idx >= 0 && idx < policies.length) {
                        policy = policies[idx];
                    }
                }
            }
            if (!policy) {
                res.status(404).json({ error: 'Policy not found' });
                return;
            }
            // 보강 주석 로드 시도
            let annotation = null;
            try {
                annotation = await annotationLoader.loadForFile(projectId, policy.filePath);
            }
            catch {
                // 보강 주석 로드 실패는 무시
            }
            // filePath로 annotation 없으면 relatedModules 기반 fallback 시도
            if (!annotation && policy.relatedModules && policy.relatedModules.length > 0) {
                const servicesPaths = [
                    `src/services/${policy.relatedModules[0]}.ts`,
                    `src/api/${policy.relatedModules[0]}.ts`,
                ];
                for (const fallbackPath of servicesPaths) {
                    if (annotation)
                        break;
                    try {
                        annotation = await annotationLoader.loadForFile(projectId, fallbackPath);
                    }
                    catch {
                        // 무시
                    }
                }
            }
            // 기본 affectedFiles 구성
            const baseAffectedFiles = [
                policy.filePath,
                ...(policy.relatedComponents || []).map((c) => `src/components/${c}.tsx`),
                ...(policy.relatedApis || []).map((a) => `src/api${a}.ts`),
            ].filter(Boolean);
            // annotation에서 impactScope 기반 파일 경로 수집
            const impactFiles = [];
            if (annotation) {
                for (const ann of annotation.annotations) {
                    for (const pol of ann.policies) {
                        const scope = pol.impactScope;
                        if (scope) {
                            for (const caller of scope.callers || []) {
                                if (caller.filePath)
                                    impactFiles.push(caller.filePath);
                            }
                            for (const callee of scope.callees || []) {
                                if (callee.filePath)
                                    impactFiles.push(callee.filePath);
                            }
                        }
                    }
                }
            }
            // 중복 제거한 affectedFiles
            const affectedFiles = [...new Set([...baseAffectedFiles, ...impactFiles])].filter(Boolean);
            const result = {
                policy: {
                    id: policy.id,
                    name: policy.name,
                    category: policy.category,
                    description: policy.description,
                    source: policy.source,
                    sourceText: policy.sourceText,
                    filePath: policy.filePath,
                    lineNumber: policy.lineNumber,
                    relatedComponents: policy.relatedComponents,
                    relatedApis: policy.relatedApis,
                    relatedModules: policy.relatedModules,
                    extractedAt: policy.extractedAt,
                    affectedFiles,
                },
            };
            if (annotation) {
                result.annotation = {
                    file: annotation.file,
                    system: annotation.system,
                    lastAnalyzed: annotation.lastAnalyzed,
                    fileSummary: annotation.fileSummary,
                    annotations: annotation.annotations.map(a => ({
                        function: a.function,
                        signature: a.signature,
                        enriched_comment: a.enriched_comment,
                        confidence: a.confidence,
                        type: a.type,
                        policies: a.policies,
                        relatedFunctions: a.relatedFunctions,
                        relatedApis: a.relatedApis,
                    })),
                };
            }
            res.json(result);
        }
        catch (error) {
            logger_1.logger.error(`Failed to get policy ${getParam(req.params, 'id')}:`, error);
            res.status(500).json({ error: 'Failed to get policy' });
        }
    });
    /**
     * GET /api/analysis/policy-changes - 분석 결과의 policyChanges 목록 반환
     */
    app.get('/api/analysis/policy-changes', async (_req, res) => {
        try {
            const projectId = await getProjectId();
            if (!projectId) {
                res.json({ policyChanges: [], message: 'No active project' });
                return;
            }
            const latestResult = await resultManager.getLatest(projectId);
            if (!latestResult) {
                res.json({ policyChanges: [], message: 'No analysis results found' });
                return;
            }
            res.json({
                policyChanges: latestResult.policyChanges || [],
                analysisId: latestResult.analysisId,
                analyzedAt: latestResult.analyzedAt,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get policy changes:', error);
            res.status(500).json({ error: 'Failed to get policy changes' });
        }
    });
    // ============================================================
    // 크로스 프로젝트 (Cross Project) API 엔드포인트
    // ============================================================
    const crossProjectManager = new cross_project_manager_1.CrossProjectManager(path.join(basePath || process.env.HOME || process.env.USERPROFILE || '.', '.impact'));
    /**
     * GET /api/cross-project/links - 전체 프로젝트 의존성 목록 조회
     */
    app.get('/api/cross-project/links', async (_req, res) => {
        try {
            const links = await crossProjectManager.getLinks();
            res.json({ links, total: links.length });
        }
        catch (error) {
            logger_1.logger.error('Failed to get cross-project links:', error);
            res.status(500).json({ error: 'Failed to get cross-project links' });
        }
    });
    /**
     * GET /api/cross-project/links/:projectId - 특정 프로젝트의 의존성 조회
     */
    app.get('/api/cross-project/links/:projectId', async (req, res) => {
        try {
            const projectId = getParam(req.params, 'projectId');
            if (!isValidId(projectId)) {
                res.status(400).json({ error: 'Invalid project ID' });
                return;
            }
            const links = await crossProjectManager.getLinks(projectId);
            res.json({ links, total: links.length });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get links for project ${getParam(req.params, 'projectId')}:`, error);
            res.status(500).json({ error: 'Failed to get cross-project links' });
        }
    });
    /**
     * GET /api/cross-project/groups - 프로젝트 그룹 목록 조회
     */
    app.get('/api/cross-project/groups', async (_req, res) => {
        try {
            const groups = await crossProjectManager.getGroups();
            res.json({ groups, total: groups.length });
        }
        catch (error) {
            logger_1.logger.error('Failed to get cross-project groups:', error);
            res.status(500).json({ error: 'Failed to get cross-project groups' });
        }
    });
    // ============================================================
    // API 404 핸들러 (SPA 폴백보다 먼저 등록해야 API 요청이 index.html로 빠지지 않음)
    // ============================================================
    app.use('/api', (_req, res) => {
        res.status(404).json({ error: 'API endpoint not found' });
    });
    // ============================================================
    // 정적 파일 서빙 + SPA 폴백
    // ============================================================
    const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
    if (fs.existsSync(webDistPath)) {
        app.use(express_1.default.static(webDistPath));
        // SPA 폴백: API가 아닌 모든 요청에 index.html 반환
        // Express v5 requires named wildcard params
        app.get('{*splat}', (_req, res) => {
            const indexPath = path.join(webDistPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            }
            else {
                res.status(404).json({ error: 'Web UI not built. Run: cd web && npm run build' });
            }
        });
    }
    else {
        console.warn('⚠️ 웹 대시보드 빌드가 필요합니다. 아래 명령어를 실행해주세요:');
        console.warn('   cd web && npm install && npm run build');
        app.get('{*splat}', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.status(404).json({
                    error: 'Web UI not built',
                    message: 'Run: cd web && npm install && npm run build',
                });
            }
        });
    }
    return app;
}
/**
 * 웹 서버를 시작
 * @param basePath - 데이터 저장 기본 경로
 * @param preferredPort - 선호 포트 (기본: 3847)
 * @returns 실제 사용된 포트 번호
 */
async function startServer(basePath, preferredPort = 3847) {
    if (serverInstance) {
        logger_1.logger.warn('Web server is already running.');
        const addr = serverInstance.address();
        if (addr && typeof addr !== 'string') {
            return addr.port;
        }
        return preferredPort;
    }
    const port = await findAvailablePort(preferredPort);
    // 서버 시작 전 config를 1회 로드하여 캐시
    const configManager = new config_manager_1.ConfigManager(basePath);
    await configManager.load();
    cachedProjectPath = configManager.getActiveProject() || '';
    const app = createApp(basePath);
    return new Promise((resolve, reject) => {
        serverInstance = app.listen(port, '127.0.0.1', () => {
            logger_1.logger.info(`Web server started at http://localhost:${port}`);
            resolve(port);
        });
        serverInstance.on('error', (err) => {
            logger_1.logger.error('Failed to start web server:', err);
            serverInstance = null;
            reject(err);
        });
    });
}
/**
 * 웹 서버를 중지
 */
async function stopServer() {
    if (!serverInstance) {
        logger_1.logger.warn('No web server is running.');
        return;
    }
    return new Promise((resolve, reject) => {
        serverInstance.close((err) => {
            if (err) {
                logger_1.logger.error('Failed to stop web server:', err);
                reject(err);
            }
            else {
                logger_1.logger.info('Web server stopped.');
                serverInstance = null;
                resolve();
            }
        });
    });
}
/**
 * 서버 실행 상태 확인
 */
function isServerRunning() {
    return serverInstance !== null;
}
//# sourceMappingURL=web-server.js.map