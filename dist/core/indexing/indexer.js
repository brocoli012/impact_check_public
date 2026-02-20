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
const java_parser_1 = require("./parsers/java-parser");
const kotlin_parser_1 = require("./parsers/kotlin-parser");
const java_ast_parser_1 = require("./parsers/java-ast-parser");
const kotlin_ast_parser_1 = require("./parsers/kotlin-ast-parser");
const tree_sitter_loader_1 = require("./parsers/tree-sitter-loader");
const graph_builder_1 = require("./graph-builder");
const policy_extractor_1 = require("./policy-extractor");
const annotation_generator_1 = require("../annotations/annotation-generator");
const annotation_manager_1 = require("../annotations/annotation-manager");
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
const parsed_file_normalizer_1 = require("./parsers/parsed-file-normalizer");
/**
 * Indexer - 전체 인덱싱 파이프라인 실행 및 관리
 *
 * 파이프라인:
 *   1. FileScanner.scan() -> 파일 목록
 *   2. 각 파일에 대해 Parser.parse() -> ParsedFile[]
 *   3. PolicyExtractor -> 정책 추출
 *   4. DependencyGraphBuilder.build() -> 의존성 그래프
 *   5. 결과 조합 -> CodeIndex
 *   6. (optional) 보강 주석 생성 (annotationsEnabled일 때만)
 *   7. JSON 직렬화 -> .impact/projects/{id}/index/ 저장
 */
class Indexer {
    constructor(options) {
        this.scanner = new scanner_1.FileScanner();
        const { primary, regexFallback } = this.initParsers(options?.parserMode ?? 'auto');
        this.parsers = primary;
        this.regexFallbackParsers = regexFallback;
        this.graphBuilder = new graph_builder_1.DependencyGraphBuilder();
        this.policyExtractor = new policy_extractor_1.PolicyExtractor();
        this.annotationsEnabled = options?.annotationsEnabled ?? false;
    }
    /**
     * JVM 파서 초기화 전략
     *
     * - 'ast': tree-sitter AST 파서 강제 (실패 시 에러)
     * - 'regex': Phase 1 Regex 파서 강제
     * - 'auto' (기본): tree-sitter 가용 시 AST 파서, 불가 시 Regex 폴백
     *
     * 환경 변수 PARSER_MODE 로도 설정 가능 (코드 파라미터 우선)
     */
    initParsers(mode) {
        const effectiveMode = mode !== 'auto' ? mode : process.env.PARSER_MODE || 'auto';
        const regexParsers = [new java_parser_1.JavaParser(), new kotlin_parser_1.KotlinParser()];
        if (effectiveMode === 'regex') {
            logger_1.logger.info('Parser mode: regex (Phase 1)');
            return {
                primary: [new typescript_parser_1.TypeScriptParser(), new java_parser_1.JavaParser(), new kotlin_parser_1.KotlinParser()],
                regexFallback: [],
            };
        }
        if (effectiveMode === 'ast') {
            logger_1.logger.info('Parser mode: ast (Phase 2 - tree-sitter)');
            return {
                primary: [new typescript_parser_1.TypeScriptParser(), new java_ast_parser_1.JavaAstParser(), new kotlin_ast_parser_1.KotlinAstParser()],
                regexFallback: regexParsers,
            };
        }
        // auto 모드: tree-sitter 가용 여부에 따라 자동 선택
        const treeSitterOk = (0, tree_sitter_loader_1.isTreeSitterAvailable)();
        if (treeSitterOk) {
            logger_1.logger.info('Parser mode: auto → AST parsers selected (tree-sitter available)');
            return {
                primary: [new typescript_parser_1.TypeScriptParser(), new java_ast_parser_1.JavaAstParser(), new kotlin_ast_parser_1.KotlinAstParser()],
                regexFallback: regexParsers,
            };
        }
        logger_1.logger.info('Parser mode: auto → Regex parsers selected (tree-sitter unavailable, fallback)');
        return {
            primary: [new typescript_parser_1.TypeScriptParser(), new java_parser_1.JavaParser(), new kotlin_parser_1.KotlinParser()],
            regexFallback: [],
        };
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
            lastUpdateType: 'full',
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
        // Step 6 (optional): 보강 주석 생성
        if (this.annotationsEnabled) {
            await this.generateAnnotations(resolvedPath, parsedFiles, path.basename(resolvedPath));
        }
        logger_1.logger.info('Indexing complete!');
        return codeIndex;
    }
    /**
     * 증분 업데이트 - Git diff 기반으로 변경된 파일만 재파싱
     * @param projectPath - 프로젝트 루트 경로
     * @param projectId - 프로젝트 ID (인덱스 로드/저장용)
     * @param basePath - 기본 경로 (인덱스 로드/저장용)
     * @returns 업데이트된 코드 인덱스
     */
    async incrementalUpdate(projectPath, projectId, basePath) {
        const resolvedPath = path.resolve(projectPath);
        const effectiveProjectId = projectId || path.basename(resolvedPath);
        logger_1.logger.info(`Starting incremental update for: ${resolvedPath}`);
        // Step 1: 기존 인덱스 로드
        const existingIndex = await this.loadIndex(effectiveProjectId, basePath);
        if (!existingIndex) {
            logger_1.logger.info('No existing index found, falling back to full index');
            return this.fullIndex(projectPath);
        }
        // Step 2: 변경 파일 감지
        const lastCommit = existingIndex.meta.gitCommit;
        if (!lastCommit || lastCommit === 'unknown') {
            logger_1.logger.info('No valid git commit in existing index, falling back to full index');
            return this.fullIndex(projectPath);
        }
        let changedFiles;
        try {
            changedFiles = await this.getChangedFiles(projectPath, lastCommit);
        }
        catch (err) {
            logger_1.logger.warn(`Failed to get changed files, falling back to full index: ${err instanceof Error ? err.message : String(err)}`);
            return this.fullIndex(projectPath);
        }
        const totalChanged = changedFiles.added.length + changedFiles.modified.length + changedFiles.deleted.length;
        // Step 3: 변경 없음 체크
        if (totalChanged === 0) {
            logger_1.logger.info('이미 최신 상태입니다');
            return existingIndex;
        }
        // Step 4: 변경 비율 체크 (30% 초과 시 fullIndex 전환)
        const totalFiles = existingIndex.files.length;
        if (totalFiles > 0) {
            const changeRatio = totalChanged / totalFiles;
            if (changeRatio > 0.3) {
                logger_1.logger.info(`Change ratio ${(changeRatio * 100).toFixed(1)}% exceeds 30% threshold, switching to full index`);
                return this.fullIndex(projectPath);
            }
        }
        logger_1.logger.info(`Incremental update: +${changedFiles.added.length} ~${changedFiles.modified.length} -${changedFiles.deleted.length}`);
        // Step 5: 증분 처리
        // 5a. 변경/추가 파일만 파싱
        const filesToParse = [];
        const changedPathSet = new Set([...changedFiles.added, ...changedFiles.modified]);
        // 현재 파일 시스템에서 스캔하여 FileInfo 획득
        const scanResult = await this.scanner.scan(resolvedPath);
        const currentFileMap = new Map();
        for (const file of scanResult.files) {
            currentFileMap.set(file.path, file);
        }
        for (const filePath of changedPathSet) {
            const fileInfo = currentFileMap.get(filePath);
            if (fileInfo) {
                filesToParse.push(fileInfo);
            }
        }
        const newParsedFiles = await this.parseFiles(resolvedPath, filesToParse);
        logger_1.logger.info(`  Parsed ${newParsedFiles.length} changed files`);
        // 5b. files 배열 업데이트: deleted 제거, modified 교체, added 추가
        const deletedSet = new Set(changedFiles.deleted);
        const modifiedSet = new Set(changedFiles.modified);
        const addedSet = new Set(changedFiles.added);
        // 삭제/수정 파일 제거 후 수정/추가 파일 반영
        const updatedFiles = existingIndex.files.filter(f => !deletedSet.has(f.path) && !modifiedSet.has(f.path));
        // modified, added 파일의 FileInfo 추가
        for (const filePath of [...modifiedSet, ...addedSet]) {
            const fileInfo = currentFileMap.get(filePath);
            if (fileInfo) {
                updatedFiles.push(fileInfo);
            }
        }
        // 5c. screens, components, apis 업데이트 (변경 파일 관련 항목만)
        const allChangedPaths = new Set([...changedFiles.added, ...changedFiles.modified, ...changedFiles.deleted]);
        // 기존 항목에서 변경 파일 관련 제거
        const updatedScreens = existingIndex.screens.filter(s => !allChangedPaths.has(s.filePath));
        const updatedComponents = existingIndex.components.filter(c => !allChangedPaths.has(c.filePath));
        const updatedApis = existingIndex.apis.filter(a => !allChangedPaths.has(a.filePath));
        // 새로 파싱된 파일에서 추출하여 추가
        const newScreens = this.extractScreens(newParsedFiles);
        const newComponents = this.extractComponents(newParsedFiles);
        const newApis = this.extractApiEndpoints(newParsedFiles);
        updatedScreens.push(...newScreens);
        updatedComponents.push(...newComponents);
        updatedApis.push(...newApis);
        // 5d. policies 재추출 (변경된 파일만 파싱 + 기존 인덱스 policies 병합)
        logger_1.logger.info('  Re-extracting policies from changed files...');
        const commentPolicies = this.policyExtractor.extractFromComments(newParsedFiles);
        const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
        const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
        // 기존 policies 중 변경되지 않은 파일의 정책은 유지하고, 변경 파일 정책만 교체
        const newCommentPolicies = this.policyExtractor.mergeAllPolicies(commentPolicies, docPolicies, manualPolicies);
        // 기존 정책과 새 정책을 병합 (중복 제거)
        const existingPolicies = existingIndex.policies || [];
        const unchangedPolicies = existingPolicies.filter(p => {
            // source 속성이 있는 경우만 파일 경로 기반 필터링
            const policySource = p.source || p.filePath || '';
            return !allChangedPaths.has(policySource);
        });
        const allPolicies = [...unchangedPolicies, ...newCommentPolicies];
        // 5e. dependencyGraph 재빌드 (변경 파일만 파싱한 결과 사용)
        // 의존성 그래프는 전체 파일 정보가 필요하므로, 변경 파일의 ParsedFile만으로는 부족
        // → 기존 인덱스의 dependencies를 기반으로 변경분만 갱신하는 것이 이상적이나,
        //   현재 GraphBuilder API로는 전체 rebuild만 가능하므로 full parse 대신
        //   newParsedFiles만 사용하여 부분 빌드
        logger_1.logger.info('  Rebuilding dependency graph...');
        const dependencyGraph = this.graphBuilder.build(newParsedFiles);
        // 5f. meta 갱신
        const now = new Date().toISOString();
        const gitInfo = await this.getGitInfo(resolvedPath);
        const updatedMeta = {
            ...existingIndex.meta,
            updatedAt: now,
            gitCommit: gitInfo.commit,
            gitBranch: gitInfo.branch,
            lastUpdateType: 'incremental',
            stats: {
                totalFiles: updatedFiles.length,
                screens: updatedScreens.length,
                components: updatedComponents.length,
                apiEndpoints: updatedApis.length,
                models: existingIndex.models.length,
                modules: dependencyGraph.graph.nodes.filter(n => n.type === 'module').length,
            },
        };
        const updatedIndex = {
            meta: updatedMeta,
            files: updatedFiles,
            screens: updatedScreens,
            components: updatedComponents,
            apis: updatedApis,
            models: existingIndex.models,
            policies: allPolicies,
            dependencies: dependencyGraph,
        };
        // Optional: 변경된 파일의 보강 주석 갱신
        if (this.annotationsEnabled && newParsedFiles.length > 0) {
            await this.generateAnnotations(resolvedPath, newParsedFiles, effectiveProjectId);
        }
        logger_1.logger.info('Incremental update complete!');
        return updatedIndex;
    }
    /**
     * 인덱스가 최신인지 확인
     * @param projectPath - 프로젝트 루트 경로
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     * @returns true이면 stale (업데이트 필요)
     */
    async isIndexStale(projectPath, projectId, basePath) {
        const resolvedPath = path.resolve(projectPath);
        const effectiveProjectId = projectId || path.basename(resolvedPath);
        // 기존 인덱스 로드
        const existingIndex = await this.loadIndex(effectiveProjectId, basePath);
        if (!existingIndex) {
            return true;
        }
        // gitCommit 체크
        if (!existingIndex.meta.gitCommit || existingIndex.meta.gitCommit === 'unknown') {
            return true;
        }
        // HEAD commit과 비교
        try {
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(resolvedPath);
            const log = await git.log({ maxCount: 1 });
            const headCommit = log.latest?.hash || '';
            if (!headCommit) {
                return true;
            }
            return headCommit !== existingIndex.meta.gitCommit;
        }
        catch {
            // Git 오류 시 stale로 판단
            return true;
        }
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
     *
     * AST 파서가 빈 결과(imports=0, exports=0, functions=0)를 반환하면,
     * regexFallbackParsers로 해당 파일을 재시도한다 (per-file fallback).
     */
    async parseFiles(projectPath, files) {
        const parsedFiles = [];
        const normalizer = new parsed_file_normalizer_1.ParsedFileNormalizer();
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const PARSE_TIMEOUT_MS = 30000; // 30초
        const CONCURRENCY_LIMIT = 10;
        // 청크 단위 병렬 처리
        const chunks = this.chunkArray(files, CONCURRENCY_LIMIT);
        for (const chunk of chunks) {
            const chunkResults = await Promise.allSettled(chunk.map(async (file) => {
                const parser = this.findParser(file.path);
                if (!parser)
                    return null;
                const absolutePath = path.join(projectPath, file.path);
                // 파일 크기 가드
                const stat = fs.statSync(absolutePath);
                if (stat.size > MAX_FILE_SIZE) {
                    logger_1.logger.warn(`Skipping large file (${(stat.size / 1024 / 1024).toFixed(2)}MB): ${file.path}`);
                    return null;
                }
                const content = fs.readFileSync(absolutePath, 'utf-8');
                // Timeout 기반 파싱
                let parsed = await this.parseWithTimeout(parser, file.path, content, PARSE_TIMEOUT_MS);
                // per-file fallback
                let usedParser = parser;
                if (this.isEmptyParseResult(parsed) && content.trim().length > 0 && this.regexFallbackParsers.length > 0) {
                    const fallbackParser = this.findFallbackParser(file.path);
                    if (fallbackParser) {
                        logger_1.logger.debug(`Per-file fallback: ${file.path} (AST empty → Regex retry)`);
                        parsed = await this.parseWithTimeout(fallbackParser, file.path, content, PARSE_TIMEOUT_MS);
                        usedParser = fallbackParser;
                    }
                }
                // 결과 정규화 (AST vs Regex 차이 제거)
                const parserType = usedParser.name.includes('ast') ? 'ast' : 'regex';
                return normalizer.normalize(parsed, parserType);
            }));
            for (const result of chunkResults) {
                if (result.status === 'fulfilled' && result.value) {
                    parsedFiles.push(result.value);
                }
                else if (result.status === 'rejected') {
                    logger_1.logger.debug(`Parse chunk failed: ${result.reason}`);
                }
            }
        }
        return parsedFiles;
    }
    /**
     * Parser.parse() 호출을 timeout으로 래핑
     */
    async parseWithTimeout(parser, filePath, content, timeoutMs) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                logger_1.logger.warn(`Parse timeout (${timeoutMs}ms) for ${filePath}`);
                resolve({
                    filePath,
                    imports: [],
                    exports: [],
                    functions: [],
                    components: [],
                    apiCalls: [],
                    routeDefinitions: [],
                    comments: [],
                });
            }, timeoutMs);
            parser.parse(filePath, content)
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((err) => {
                clearTimeout(timer);
                logger_1.logger.debug(`Parse failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
                resolve({
                    filePath,
                    imports: [],
                    exports: [],
                    functions: [],
                    components: [],
                    apiCalls: [],
                    routeDefinitions: [],
                    comments: [],
                });
            });
        });
    }
    /**
     * 배열을 청크 단위로 분할
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * ParsedFile이 빈 결과인지 확인 (imports=0, exports=0, functions=0)
     */
    isEmptyParseResult(parsed) {
        return parsed.imports.length === 0 && parsed.exports.length === 0 && parsed.functions.length === 0;
    }
    /**
     * regexFallbackParsers에서 해당 파일에 적합한 파서 찾기
     */
    findFallbackParser(filePath) {
        for (const parser of this.regexFallbackParsers) {
            if (parser.canParse(filePath)) {
                return parser;
            }
        }
        return null;
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
     * Git diff 또는 hash 비교를 통해 변경된 파일 목록을 반환
     * @param projectPath 프로젝트 루트 경로
     * @param lastCommit 이전 인덱싱 시점의 Git commit hash
     * @returns ChangedFileSet
     */
    async getChangedFiles(projectPath, lastCommit) {
        const resolvedPath = path.resolve(projectPath);
        // 지원하는 파일 확장자 (FileScanner의 SUPPORTED_EXTENSIONS와 동일)
        const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.java', '.kt', '.py'];
        const isSupported = (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            return supportedExtensions.includes(ext);
        };
        try {
            // Git diff 방식 시도
            const { simpleGit } = await Promise.resolve().then(() => __importStar(require('simple-git')));
            const git = simpleGit(resolvedPath);
            // Git 저장소인지 확인
            const isRepo = await git.checkIsRepo();
            if (!isRepo) {
                throw new Error('Not a git repository');
            }
            // diff --name-status로 정확한 파일 상태 분류
            const nameStatusRaw = await git.diff(['--name-status', lastCommit, 'HEAD']);
            const addedSet = new Set();
            const modifiedSet = new Set();
            const deletedSet = new Set();
            for (const line of nameStatusRaw.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                const parts = trimmed.split('\t');
                if (parts.length < 2)
                    continue;
                const status = parts[0].charAt(0); // A, M, D, R 등
                // rename의 경우 parts[2]가 새 이름
                const filePath = status === 'R' && parts.length >= 3 ? parts[2] : parts[1];
                if (!isSupported(filePath))
                    continue;
                switch (status) {
                    case 'A':
                        addedSet.add(filePath);
                        break;
                    case 'M':
                        modifiedSet.add(filePath);
                        break;
                    case 'D':
                        deletedSet.add(filePath);
                        break;
                    case 'R':
                        // Rename: 이전 파일은 삭제, 새 파일은 추가
                        if (parts.length >= 3 && isSupported(parts[1])) {
                            deletedSet.add(parts[1]);
                        }
                        addedSet.add(filePath);
                        break;
                    default:
                        // C (copy), T (type change) 등은 modified로 처리
                        modifiedSet.add(filePath);
                        break;
                }
            }
            logger_1.logger.info(`Changed files (git-diff): +${addedSet.size} ~${modifiedSet.size} -${deletedSet.size}`);
            return {
                added: Array.from(addedSet),
                modified: Array.from(modifiedSet),
                deleted: Array.from(deletedSet),
                method: 'git-diff',
            };
        }
        catch (err) {
            // Git 사용 불가 시 hash 비교 폴백
            logger_1.logger.info(`Git diff unavailable, falling back to hash comparison: ${err instanceof Error ? err.message : String(err)}`);
            return this.getChangedFilesByHash(resolvedPath);
        }
    }
    /**
     * 해시 비교 방식으로 변경된 파일 감지 (Git 폴백)
     * @param projectPath 프로젝트 루트 경로 (resolved)
     * @returns ChangedFileSet
     */
    async getChangedFilesByHash(projectPath) {
        // 현재 파일 스캔
        const scanResult = await this.scanner.scan(projectPath);
        const currentFiles = new Map();
        for (const file of scanResult.files) {
            currentFiles.set(file.path, file.hash);
        }
        // 기존 인덱스의 파일 목록 로드 시도
        const projectName = path.basename(projectPath);
        const existingIndex = await this.loadIndex(projectName);
        const previousFiles = new Map();
        if (existingIndex) {
            for (const file of existingIndex.files) {
                previousFiles.set(file.path, file.hash);
            }
        }
        const added = [];
        const modified = [];
        const deleted = [];
        // 현재 파일 순회: 새 파일 / 수정된 파일 감지
        for (const [filePath, hash] of currentFiles) {
            const prevHash = previousFiles.get(filePath);
            if (prevHash === undefined) {
                added.push(filePath);
            }
            else if (prevHash !== hash) {
                modified.push(filePath);
            }
        }
        // 이전 파일 순회: 삭제된 파일 감지
        for (const filePath of previousFiles.keys()) {
            if (!currentFiles.has(filePath)) {
                deleted.push(filePath);
            }
        }
        logger_1.logger.info(`Changed files (hash-compare): +${added.length} ~${modified.length} -${deleted.length}`);
        return {
            added,
            modified,
            deleted,
            method: 'hash-compare',
        };
    }
    /**
     * 보강 주석 생성 (optional step)
     *
     * ParsedFile 목록을 받아 AnnotationGenerator로 보강 주석을 생성하고,
     * AnnotationManager로 저장한다.
     *
     * @param projectPath - 프로젝트 루트 경로
     * @param parsedFiles - 파싱된 파일 목록
     * @param projectId - 프로젝트 ID
     */
    async generateAnnotations(projectPath, parsedFiles, projectId) {
        try {
            logger_1.logger.info(`Generating annotations for ${parsedFiles.length} files...`);
            const generator = new annotation_generator_1.AnnotationGenerator();
            const manager = new annotation_manager_1.AnnotationManager();
            const files = parsedFiles.map((pf) => ({
                filePath: pf.filePath,
                parsedFile: pf,
            }));
            const annotationMap = await generator.generateBatch(files, projectPath);
            for (const [filePath, annotationFile] of annotationMap) {
                // 기존 보강 주석이 있으면 userModified 보존 병합
                const existing = await manager.load(projectId, filePath);
                if (existing) {
                    const merged = await manager.merge(existing, annotationFile);
                    await manager.save(projectId, filePath, merged);
                }
                else {
                    await manager.save(projectId, filePath, annotationFile);
                }
            }
            await manager.updateMeta(projectId);
            logger_1.logger.info(`Annotations generated for ${annotationMap.size} files`);
        }
        catch (err) {
            // 보강 주석 생성 실패는 인덱싱을 중단하지 않음
            logger_1.logger.warn(`Annotation generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        }
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