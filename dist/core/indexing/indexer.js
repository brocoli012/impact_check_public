"use strict";
/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
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
exports.Indexer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scanner_1 = require("./scanner");
const typescript_parser_1 = require("./parsers/typescript-parser");
const graph_builder_1 = require("./graph-builder");
const policy_extractor_1 = require("./policy-extractor");
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
/**
 * Indexer - 전체 인덱싱 파이프라인 실행 및 관리
 *
 * 파이프라인:
 *   1. FileScanner.scan() -> 파일 목록
 *   2. 각 파일에 대해 Parser.parse() -> ParsedFile[]
 *   3. PolicyExtractor -> 정책 추출
 *   4. DependencyGraphBuilder.build() -> 의존성 그래프
 *   5. 결과 조합 -> CodeIndex
 *   6. JSON 직렬화 -> .impact/projects/{id}/index/ 저장
 */
class Indexer {
    constructor() {
        this.scanner = new scanner_1.FileScanner();
        this.parsers = [new typescript_parser_1.TypeScriptParser()];
        this.graphBuilder = new graph_builder_1.DependencyGraphBuilder();
        this.policyExtractor = new policy_extractor_1.PolicyExtractor();
    }
    /**
     * 전체 인덱싱 파이프라인 실행
     * @param projectPath - 프로젝트 루트 경로
     * @returns 전체 코드 인덱스
     */
    async fullIndex(projectPath) {
        const resolvedPath = path.resolve(projectPath);
        logger_1.logger.info(`Starting full index for: ${resolvedPath}`);
        // Step 1: 파일 스캔
        logger_1.logger.info('Step 1/5: Scanning files...');
        const scanResult = await this.scanner.scan(resolvedPath);
        logger_1.logger.info(`  Found ${scanResult.files.length} files`);
        // Step 2: AST 파싱
        logger_1.logger.info('Step 2/5: Parsing files...');
        const parsedFiles = await this.parseFiles(resolvedPath, scanResult.files);
        logger_1.logger.info(`  Parsed ${parsedFiles.length} files`);
        // Step 3: 정책 추출
        logger_1.logger.info('Step 3/5: Extracting policies...');
        const commentPolicies = this.policyExtractor.extractFromComments(parsedFiles);
        const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
        const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
        const allPolicies = this.policyExtractor.mergeAllPolicies(commentPolicies, docPolicies, manualPolicies);
        logger_1.logger.info(`  Extracted ${allPolicies.length} policies`);
        // Step 4: 의존성 그래프 구축
        logger_1.logger.info('Step 4/5: Building dependency graph...');
        const dependencyGraph = this.graphBuilder.build(parsedFiles);
        logger_1.logger.info(`  Graph: ${dependencyGraph.graph.nodes.length} nodes, ${dependencyGraph.graph.edges.length} edges`);
        // Step 5: 코드 인덱스 조합
        logger_1.logger.info('Step 5/5: Composing code index...');
        const components = this.extractComponents(parsedFiles);
        const apiEndpoints = this.extractApiEndpoints(parsedFiles);
        const screens = this.extractScreens(parsedFiles);
        const now = new Date().toISOString();
        const gitInfo = await this.getGitInfo(resolvedPath);
        const meta = {
            version: 1,
            createdAt: now,
            updatedAt: now,
            gitCommit: gitInfo.commit,
            gitBranch: gitInfo.branch,
            project: {
                name: path.basename(resolvedPath),
                path: resolvedPath,
                techStack: scanResult.techStack,
                packageManager: this.detectPackageManager(resolvedPath),
            },
            stats: {
                totalFiles: scanResult.stats.totalFiles,
                screens: screens.length,
                components: components.length,
                apiEndpoints: apiEndpoints.length,
                models: 0,
                modules: dependencyGraph.graph.nodes.filter(n => n.type === 'module').length,
            },
        };
        const codeIndex = {
            meta,
            files: scanResult.files,
            screens,
            components,
            apis: apiEndpoints,
            models: [],
            policies: allPolicies,
            dependencies: dependencyGraph,
        };
        logger_1.logger.info('Indexing complete!');
        return codeIndex;
    }
    /**
     * 증분 업데이트
     * @param projectPath - 프로젝트 루트 경로
     * @returns 업데이트된 코드 인덱스
     */
    async incrementalUpdate(projectPath) {
        // TODO: Phase 3에서 Git diff 기반 증분 업데이트 구현
        // 현재는 fullIndex()로 폴백 (MVP 동작)
        logger_1.logger.info('Incremental update: falling back to full index (MVP)');
        return this.fullIndex(projectPath);
    }
    /**
     * 인덱스 저장
     * @param index - 코드 인덱스
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     */
    async saveIndex(index, projectId, basePath) {
        const projectDir = (0, file_1.getProjectDir)(projectId, basePath);
        const indexDir = path.join(projectDir, 'index');
        (0, file_1.ensureDir)(indexDir);
        // 개별 파일로 분할 저장
        (0, file_1.writeJsonFile)(path.join(indexDir, 'meta.json'), index.meta);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'files.json'), index.files);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'screens.json'), index.screens);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'components.json'), index.components);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'apis.json'), index.apis);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'models.json'), index.models);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'policies.json'), index.policies);
        (0, file_1.writeJsonFile)(path.join(indexDir, 'dependencies.json'), index.dependencies);
        logger_1.logger.info(`Index saved to: ${indexDir}`);
    }
    /**
     * 인덱스 로드
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     * @returns 코드 인덱스 (없으면 null)
     */
    async loadIndex(projectId, basePath) {
        const projectDir = (0, file_1.getProjectDir)(projectId, basePath);
        const indexDir = path.join(projectDir, 'index');
        const metaPath = path.join(indexDir, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            return null;
        }
        try {
            const meta = (0, file_1.readJsonFile)(metaPath);
            const files = (0, file_1.readJsonFile)(path.join(indexDir, 'files.json'));
            const screens = (0, file_1.readJsonFile)(path.join(indexDir, 'screens.json'));
            const components = (0, file_1.readJsonFile)(path.join(indexDir, 'components.json'));
            const apis = (0, file_1.readJsonFile)(path.join(indexDir, 'apis.json'));
            const models = (0, file_1.readJsonFile)(path.join(indexDir, 'models.json'));
            const policies = (0, file_1.readJsonFile)(path.join(indexDir, 'policies.json'));
            const dependencies = (0, file_1.readJsonFile)(path.join(indexDir, 'dependencies.json'));
            if (!meta) {
                return null;
            }
            return {
                meta,
                files: files || [],
                screens: screens || [],
                components: components || [],
                apis: apis || [],
                models: models || [],
                policies: policies || [],
                dependencies: dependencies || { graph: { nodes: [], edges: [] } },
            };
        }
        catch (err) {
            logger_1.logger.error('Failed to load index:', err);
            return null;
        }
    }
    // ============================================================
    // Private Methods
    // ============================================================
    /**
     * 파일 목록을 파싱
     */
    async parseFiles(projectPath, files) {
        const parsedFiles = [];
        for (const file of files) {
            const parser = this.findParser(file.path);
            if (!parser)
                continue;
            try {
                const absolutePath = path.join(projectPath, file.path);
                const content = fs.readFileSync(absolutePath, 'utf-8');
                const parsed = await parser.parse(file.path, content);
                parsedFiles.push(parsed);
            }
            catch (err) {
                logger_1.logger.debug(`Failed to parse ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return parsedFiles;
    }
    /**
     * 파일에 적합한 파서 찾기
     */
    findParser(filePath) {
        for (const parser of this.parsers) {
            if (parser.canParse(filePath)) {
                return parser;
            }
        }
        return null;
    }
    /**
     * 컴포넌트 정보 추출
     */
    extractComponents(parsedFiles) {
        const components = [];
        let counter = 0;
        for (const file of parsedFiles) {
            for (const comp of file.components) {
                counter++;
                components.push({
                    id: `comp-${counter}`,
                    name: comp.name,
                    filePath: file.filePath,
                    type: comp.type,
                    imports: [],
                    importedBy: [],
                    props: comp.props,
                    emits: [],
                    apiCalls: file.apiCalls.map((_, i) => `api-call-${i}`),
                    linesOfCode: 0,
                });
            }
        }
        return components;
    }
    /**
     * API 엔드포인트 정보 추출
     */
    extractApiEndpoints(parsedFiles) {
        const apis = [];
        const seen = new Set();
        let counter = 0;
        for (const file of parsedFiles) {
            // 라우트 정의에서 API 추출
            for (const route of file.routeDefinitions) {
                const key = `${route.path}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                counter++;
                const method = route.component.split('.').pop()?.toUpperCase() || 'GET';
                apis.push({
                    id: `api-${counter}`,
                    method: method,
                    path: route.path,
                    filePath: file.filePath,
                    handler: route.component,
                    calledBy: [],
                    requestParams: [],
                    responseType: 'unknown',
                    relatedModels: [],
                });
            }
        }
        return apis;
    }
    /**
     * 화면 정보 추출
     */
    extractScreens(parsedFiles) {
        const screens = [];
        let counter = 0;
        for (const file of parsedFiles) {
            // pages/ 또는 screens/ 디렉토리의 파일을 화면으로 식별
            const filePath = file.filePath.replace(/\\/g, '/');
            if (filePath.includes('/pages/') ||
                filePath.includes('/screens/') ||
                filePath.includes('/views/')) {
                counter++;
                const name = path.basename(file.filePath, path.extname(file.filePath));
                // 라우트 정의에서 경로 추출
                const route = file.routeDefinitions.length > 0
                    ? file.routeDefinitions[0].path
                    : `/${name.toLowerCase()}`;
                screens.push({
                    id: `screen-${counter}`,
                    name,
                    route,
                    filePath: file.filePath,
                    components: file.components.map((_, i) => `comp-${i}`),
                    apiCalls: file.apiCalls.map((_, i) => `api-call-${i}`),
                    childScreens: [],
                    metadata: {
                        linesOfCode: 0,
                        complexity: file.functions.length > 5 ? 'high' : file.functions.length > 2 ? 'medium' : 'low',
                    },
                });
            }
        }
        return screens;
    }
    /**
     * Git 정보 가져오기
     */
    async getGitInfo(projectPath) {
        try {
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(projectPath);
            const log = await git.log({ maxCount: 1 });
            const branch = await git.branch();
            return {
                commit: log.latest?.hash || 'unknown',
                branch: branch.current || 'unknown',
            };
        }
        catch {
            return { commit: 'unknown', branch: 'unknown' };
        }
    }
    /**
     * 패키지 매니저 감지
     */
    detectPackageManager(projectPath) {
        if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')))
            return 'pnpm';
        if (fs.existsSync(path.join(projectPath, 'yarn.lock')))
            return 'yarn';
        if (fs.existsSync(path.join(projectPath, 'package-lock.json')))
            return 'npm';
        if (fs.existsSync(path.join(projectPath, 'bun.lockb')))
            return 'bun';
        return 'npm';
    }
}
exports.Indexer = Indexer;
//# sourceMappingURL=indexer.js.map