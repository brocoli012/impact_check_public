/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { CodeIndex, IndexMeta, FileInfo, ChangedFileSet, ModelInfo, EventInfo } from '../../types/index';
import { ParsedFile } from './types';
import { FileScanner } from './scanner';
import { TypeScriptParser } from './parsers/typescript-parser';
import { JavaParser } from './parsers/java-parser';
import { KotlinParser } from './parsers/kotlin-parser';
import { JavaAstParser } from './parsers/java-ast-parser';
import { KotlinAstParser } from './parsers/kotlin-ast-parser';
import { VueParser } from './parsers/vue-parser';
import { isTreeSitterAvailable } from './parsers/tree-sitter-loader';
import { BaseParser } from './parsers/base-parser';
import { DependencyGraphBuilder } from './graph-builder';
import { PolicyExtractor } from './policy-extractor';
import { AnnotationGenerator } from '../annotations/annotation-generator';
import { AnnotationManager } from '../annotations/annotation-manager';
import { ensureDir, readJsonFile, writeJsonFile, getProjectDir } from '../../utils/file';
import { logger } from '../../utils/logger';
import { ParsedFileNormalizer } from './parsers/parsed-file-normalizer';

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
// ============================================================
// TASK-042: Circuit Breaker + MemoryGuard
// ============================================================

/**
 * CircuitBreaker - 연속 파싱 실패 감지 및 자동 중단
 *
 * 연속 N개 파일 파싱 실패 시 나머지 파일 파싱을 스킵하여
 * 무의미한 CPU 소비를 방지한다.
 */
class CircuitBreaker {
  private consecutiveFailures = 0;
  private isOpen = false;

  constructor(private readonly maxConsecutiveFailures: number = 10) {}

  /** 성공 시 카운터 리셋 */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isOpen = false;
  }

  /** 실패 기록. 임계치 초과 시 서킷 오픈 */
  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.isOpen = true;
      logger.warn(`CircuitBreaker OPEN: ${this.consecutiveFailures} consecutive parse failures`);
    }
  }

  /** 서킷이 열렸는지 (파싱 중단 필요 여부) */
  get tripped(): boolean {
    return this.isOpen;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}

/**
 * MemoryGuard - 힙 메모리 사용량 감시 및 GC 강제 시도
 *
 * heapUsed가 전체 힙의 85% 초과 시:
 *   1. global.gc() 강제 시도 (--expose-gc 필요)
 *   2. GC 후에도 85% 초과면 파싱 중단 신호 반환
 */
class MemoryGuard {
  private readonly threshold: number;

  constructor(threshold: number = 0.85) {
    this.threshold = threshold;
  }

  /**
   * 메모리 체크. 파싱 계속 가능하면 true, 중단 필요하면 false
   */
  check(): boolean {
    const mem = process.memoryUsage();
    const ratio = mem.heapUsed / mem.heapTotal;

    if (ratio <= this.threshold) {
      return true;
    }

    // GC 강제 시도
    logger.warn(`MemoryGuard: heap at ${(ratio * 100).toFixed(1)}% (${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(0)}MB). Attempting GC...`);

    if (typeof (global as any).gc === 'function') {
      (global as any).gc();

      // GC 후 재확인
      const memAfter = process.memoryUsage();
      const ratioAfter = memAfter.heapUsed / memAfter.heapTotal;
      logger.info(`MemoryGuard: after GC heap at ${(ratioAfter * 100).toFixed(1)}% (${(memAfter.heapUsed / 1024 / 1024).toFixed(0)}MB)`);

      if (ratioAfter > this.threshold) {
        logger.warn(`MemoryGuard: still above ${(this.threshold * 100).toFixed(0)}% after GC. Aborting parse.`);
        return false;
      }
      return true;
    }

    // global.gc 없으면 (--expose-gc 미설정) 경고만
    logger.warn('MemoryGuard: global.gc() not available (run with --expose-gc). Continuing cautiously.');
    return ratio < 0.95; // 95% 초과 시에만 강제 중단
  }
}

// ============================================================
// Parse guard constants (ISSUE-011: single source of truth)
// ============================================================

/** 파일 크기 상한 (500KB). 이보다 큰 파일은 파싱 스킵 */
const MAX_FILE_SIZE = 512 * 1024;

/** 라인 수 상한. 초과 시 regex 파서로 폴백 */
const MAX_LINE_COUNT = 10_000;

/** 단일 파일 파싱 타임아웃 (ms) */
const PARSE_TIMEOUT_MS = 30_000;

export class Indexer {
  private readonly scanner: FileScanner;
  private readonly parsers: BaseParser[];
  private readonly regexFallbackParsers: BaseParser[];
  private readonly graphBuilder: DependencyGraphBuilder;
  private readonly policyExtractor: PolicyExtractor;
  private readonly annotationsEnabled: boolean;

  constructor(options?: { annotationsEnabled?: boolean; parserMode?: 'ast' | 'regex' | 'auto' }) {
    this.scanner = new FileScanner();
    const { primary, regexFallback } = this.initParsers(options?.parserMode ?? 'auto');
    this.parsers = primary;
    this.regexFallbackParsers = regexFallback;
    this.graphBuilder = new DependencyGraphBuilder();
    this.policyExtractor = new PolicyExtractor();
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
  private initParsers(mode: 'ast' | 'regex' | 'auto'): { primary: BaseParser[]; regexFallback: BaseParser[] } {
    const effectiveMode = mode !== 'auto' ? mode : (process.env.PARSER_MODE as 'ast' | 'regex' | 'auto') || 'auto';

    const regexParsers = [new JavaParser(), new KotlinParser()];

    const vueParser = new VueParser();

    if (effectiveMode === 'regex') {
      logger.info('Parser mode: regex (Phase 1)');
      return {
        primary: [new TypeScriptParser(), vueParser, new JavaParser(), new KotlinParser()],
        regexFallback: [],
      };
    }

    if (effectiveMode === 'ast') {
      logger.info('Parser mode: ast (Phase 2 - tree-sitter)');
      return {
        primary: [new TypeScriptParser(), vueParser, new JavaAstParser(), new KotlinAstParser()],
        regexFallback: regexParsers,
      };
    }

    // auto 모드: tree-sitter 가용 여부에 따라 자동 선택
    const treeSitterOk = isTreeSitterAvailable();
    if (treeSitterOk) {
      logger.info('Parser mode: auto → AST parsers selected (tree-sitter available)');
      return {
        primary: [new TypeScriptParser(), vueParser, new JavaAstParser(), new KotlinAstParser()],
        regexFallback: regexParsers,
      };
    }

    logger.info('Parser mode: auto → Regex parsers selected (tree-sitter unavailable, fallback)');
    return {
      primary: [new TypeScriptParser(), vueParser, new JavaParser(), new KotlinParser()],
      regexFallback: [],
    };
  }

  /**
   * 전체 인덱싱 파이프라인 실행
   * @param projectPath - 프로젝트 루트 경로
   * @returns 전체 코드 인덱스
   */
  async fullIndex(projectPath: string): Promise<CodeIndex> {
    const resolvedPath = path.resolve(projectPath);
    logger.info(`Starting full index for: ${resolvedPath}`);

    // Step 1: 파일 스캔
    logger.info('Step 1/5: Scanning files...');
    const scanResult = await this.scanner.scan(resolvedPath);
    logger.info(`  Found ${scanResult.files.length} files`);

    // TASK-039: parse→extract→release 스트리밍 패턴
    // Step 2+3+4: 파싱 + 즉시 추출 + 그래프 노드 등록을 한 패스로 처리
    logger.info('Step 2/5: Parsing and extracting (streaming)...');

    // 스트리밍 accumulator
    const components: CodeIndex['components'] = [];
    const apiEndpoints: CodeIndex['apis'] = [];
    const screens: CodeIndex['screens'] = [];
    const collectedModels: ModelInfo[] = [];
    const collectedEvents: EventInfo[] = [];
    let compCounter = 0;
    let apiCounter = 0;
    let screenCounter = 0;
    const apiSeen = new Set<string>();

    // 정책 추출을 위한 경량 참조 (comments만 보존)
    const parsedFilesForPolicy: ParsedFile[] = [];
    // 보강 주석 생성용 (annotationsEnabled일 때만 유지)
    const parsedFilesForAnnotation: ParsedFile[] = [];

    // 그래프 빌더 점진적 빌드 시작
    this.graphBuilder.beginIncremental();

    // Phase 1: 파싱 + 즉시 추출 + 노드 등록
    const parsedFileRefs: ParsedFile[] = []; // 엣지 빌드용 임시 참조
    const parseResult = await this.parseFilesStreaming(
      resolvedPath,
      scanResult.files,
      scanResult.contentCache,
      (parsed: ParsedFile) => {
        // 즉시 컴포넌트 추출
        for (const comp of parsed.components) {
          compCounter++;
          components.push({
            id: `comp-${compCounter}`,
            name: comp.name,
            filePath: parsed.filePath,
            type: comp.type,
            imports: [],
            importedBy: [],
            props: comp.props,
            emits: [],
            apiCalls: parsed.apiCalls.map((_, i) => `api-call-${i}`),
            linesOfCode: 0,
          });
        }

        // 즉시 API 엔드포인트 추출
        for (const route of parsed.routeDefinitions) {
          const key = `${route.path}`;
          if (!apiSeen.has(key)) {
            apiSeen.add(key);
            apiCounter++;
            const method = route.component.split('.').pop()?.toUpperCase() || 'GET';
            apiEndpoints.push({
              id: `api-${apiCounter}`,
              method: method as CodeIndex['apis'][0]['method'],
              path: route.path,
              filePath: parsed.filePath,
              handler: route.component,
              calledBy: [],
              requestParams: [],
              responseType: 'unknown',
              relatedModels: [],
            });
          }
        }

        // 즉시 화면 추출
        const filePath = parsed.filePath.replace(/\\/g, '/');
        if (filePath.includes('/pages/') || filePath.includes('/screens/') || filePath.includes('/views/')) {
          screenCounter++;
          const name = path.basename(parsed.filePath, path.extname(parsed.filePath));
          const route = parsed.routeDefinitions.length > 0
            ? parsed.routeDefinitions[0].path
            : `/${name.toLowerCase()}`;
          screens.push({
            id: `screen-${screenCounter}`,
            name,
            route,
            filePath: parsed.filePath,
            components: parsed.components.map((_, i) => `comp-${i}`),
            apiCalls: parsed.apiCalls.map((_, i) => `api-call-${i}`),
            childScreens: [],
            metadata: {
              linesOfCode: 0,
              complexity: parsed.functions.length > 5 ? 'high' : parsed.functions.length > 2 ? 'medium' : 'low',
            },
          });
        }

        // 모델 수집
        if (parsed.models && parsed.models.length > 0) {
          collectedModels.push(...parsed.models);
        }

        // 이벤트 수집
        if (parsed.events && parsed.events.length > 0) {
          collectedEvents.push(...parsed.events);
        }

        // 그래프 노드 등록
        this.graphBuilder.addNode(parsed);

        // 정책 추출용 경량 참조 보존 (filePath + comments만)
        parsedFilesForPolicy.push({
          filePath: parsed.filePath,
          imports: [],
          exports: [],
          functions: [],
          components: [],
          apiCalls: [],
          routeDefinitions: [],
          comments: parsed.comments,
        });

        // 보강 주석용 전체 참조 (enabled일 때만)
        if (this.annotationsEnabled) {
          parsedFilesForAnnotation.push(parsed);
        }

        // 엣지 빌드를 위해 임시 참조 유지 (imports, apiCalls, routeDefinitions 필요)
        parsedFileRefs.push(parsed);
      },
    );
    logger.info(`  Parsed ${parseResult} files (streaming)`);

    // TASK-038: 파싱 완료 후 contentCache 해제
    if (scanResult.contentCache) {
      scanResult.contentCache.clear();
    }

    // Phase 2: 전체 노드 맵 완성 후 엣지 빌드
    for (const pf of parsedFileRefs) {
      this.graphBuilder.addEdges(pf);
    }
    // 임시 참조 해제
    parsedFileRefs.length = 0;

    const dependencyGraph = this.graphBuilder.finishIncremental();
    logger.info(`  Graph: ${dependencyGraph.graph.nodes.length} nodes, ${dependencyGraph.graph.edges.length} edges`);

    // Step 3: 정책 추출
    logger.info('Step 3/5: Extracting policies...');
    const commentPolicies = this.policyExtractor.extractFromComments(parsedFilesForPolicy);
    const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
    const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
    const allPolicies = this.policyExtractor.mergeAllPolicies(
      commentPolicies,
      docPolicies,
      manualPolicies,
    );
    logger.info(`  Extracted ${allPolicies.length} policies`);

    // 정책 추출 후 경량 참조 해제
    parsedFilesForPolicy.length = 0;

    // Step 5: 코드 인덱스 조합
    logger.info('Step 5/5: Composing code index...');

    const now = new Date().toISOString();
    const gitInfo = await this.getGitInfo(resolvedPath);

    const meta: IndexMeta = {
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
        models: collectedModels.length,
        modules: dependencyGraph.graph.nodes.filter(n => n.type === 'module').length,
        events: collectedEvents.length,
      },
    };

    const codeIndex: CodeIndex = {
      meta,
      files: scanResult.files,
      screens,
      components,
      apis: apiEndpoints,
      models: collectedModels,
      events: collectedEvents,
      policies: allPolicies,
      dependencies: dependencyGraph,
    };

    // Step 6 (optional): 보강 주석 생성
    if (this.annotationsEnabled && parsedFilesForAnnotation.length > 0) {
      await this.generateAnnotations(resolvedPath, parsedFilesForAnnotation, path.basename(resolvedPath));
      parsedFilesForAnnotation.length = 0;
    }

    logger.info('Indexing complete!');
    return codeIndex;
  }

  /**
   * 증분 업데이트 - Git diff 기반으로 변경된 파일만 재파싱
   * @param projectPath - 프로젝트 루트 경로
   * @param projectId - 프로젝트 ID (인덱스 로드/저장용)
   * @param basePath - 기본 경로 (인덱스 로드/저장용)
   * @returns 업데이트된 코드 인덱스
   */
  async incrementalUpdate(projectPath: string, projectId?: string, basePath?: string): Promise<CodeIndex> {
    const resolvedPath = path.resolve(projectPath);
    const effectiveProjectId = projectId || path.basename(resolvedPath);

    logger.info(`Starting incremental update for: ${resolvedPath}`);

    // Step 1: 기존 인덱스 로드
    const existingIndex = await this.loadIndex(effectiveProjectId, basePath);
    if (!existingIndex) {
      logger.info('No existing index found, falling back to full index');
      return this.fullIndex(projectPath);
    }

    // Step 2: 변경 파일 감지
    const lastCommit = existingIndex.meta.gitCommit;
    if (!lastCommit || lastCommit === 'unknown') {
      logger.info('No valid git commit in existing index, falling back to full index');
      return this.fullIndex(projectPath);
    }

    let changedFiles: ChangedFileSet;
    try {
      changedFiles = await this.getChangedFiles(projectPath, lastCommit);
    } catch (err) {
      logger.warn(`Failed to get changed files, falling back to full index: ${err instanceof Error ? err.message : String(err)}`);
      return this.fullIndex(projectPath);
    }

    const totalChanged = changedFiles.added.length + changedFiles.modified.length + changedFiles.deleted.length;

    // Step 3: 변경 없음 체크
    if (totalChanged === 0) {
      logger.info('이미 최신 상태입니다');
      return existingIndex;
    }

    // Step 4: 변경 비율 체크 (30% 초과 시 fullIndex 전환)
    const totalFiles = existingIndex.files.length;
    if (totalFiles > 0) {
      const changeRatio = totalChanged / totalFiles;
      if (changeRatio > 0.3) {
        logger.info(`Change ratio ${(changeRatio * 100).toFixed(1)}% exceeds 30% threshold, switching to full index`);
        return this.fullIndex(projectPath);
      }
    }

    logger.info(`Incremental update: +${changedFiles.added.length} ~${changedFiles.modified.length} -${changedFiles.deleted.length}`);

    // Step 5: 증분 처리
    // 5a. 변경/추가 파일만 파싱
    const filesToParse: FileInfo[] = [];
    const changedPathSet = new Set([...changedFiles.added, ...changedFiles.modified]);

    // 현재 파일 시스템에서 스캔하여 FileInfo 획득
    const scanResult = await this.scanner.scan(resolvedPath);
    const currentFileMap = new Map<string, FileInfo>();
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
    logger.info(`  Parsed ${newParsedFiles.length} changed files`);

    // 5b. files 배열 업데이트: deleted 제거, modified 교체, added 추가
    const deletedSet = new Set(changedFiles.deleted);
    const modifiedSet = new Set(changedFiles.modified);
    const addedSet = new Set(changedFiles.added);

    // 삭제/수정 파일 제거 후 수정/추가 파일 반영
    const updatedFiles = existingIndex.files.filter(
      f => !deletedSet.has(f.path) && !modifiedSet.has(f.path),
    );
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
    logger.info('  Re-extracting policies from changed files...');
    const commentPolicies = this.policyExtractor.extractFromComments(newParsedFiles);
    const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
    const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
    // 기존 policies 중 변경되지 않은 파일의 정책은 유지하고, 변경 파일 정책만 교체
    const newCommentPolicies = this.policyExtractor.mergeAllPolicies(
      commentPolicies,
      docPolicies,
      manualPolicies,
    );
    // 기존 정책과 새 정책을 병합 (중복 제거)
    const existingPolicies = existingIndex.policies || [];
    const unchangedPolicies = existingPolicies.filter(p => {
      // source 속성이 있는 경우만 파일 경로 기반 필터링
      const policySource = (p as any).source || (p as any).filePath || '';
      return !allChangedPaths.has(policySource);
    });
    const allPolicies = [...unchangedPolicies, ...newCommentPolicies];

    // 5e. dependencyGraph 재빌드 (변경 파일만 파싱한 결과 사용)
    // 의존성 그래프는 전체 파일 정보가 필요하므로, 변경 파일의 ParsedFile만으로는 부족
    // → 기존 인덱스의 dependencies를 기반으로 변경분만 갱신하는 것이 이상적이나,
    //   현재 GraphBuilder API로는 전체 rebuild만 가능하므로 full parse 대신
    //   newParsedFiles만 사용하여 부분 빌드
    logger.info('  Rebuilding dependency graph...');
    const dependencyGraph = this.graphBuilder.build(newParsedFiles);

    // 5f. meta 갱신
    const now = new Date().toISOString();
    const gitInfo = await this.getGitInfo(resolvedPath);

    const updatedMeta: IndexMeta = {
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
        events: (existingIndex.events || []).length,
      },
    };

    const updatedIndex: CodeIndex = {
      meta: updatedMeta,
      files: updatedFiles,
      screens: updatedScreens,
      components: updatedComponents,
      apis: updatedApis,
      models: existingIndex.models,
      events: existingIndex.events || [],
      policies: allPolicies,
      dependencies: dependencyGraph,
    };

    // Optional: 변경된 파일의 보강 주석 갱신
    if (this.annotationsEnabled && newParsedFiles.length > 0) {
      await this.generateAnnotations(resolvedPath, newParsedFiles, effectiveProjectId);
    }

    logger.info('Incremental update complete!');
    return updatedIndex;
  }

  /**
   * 인덱스가 최신인지 확인
   * @param projectPath - 프로젝트 루트 경로
   * @param projectId - 프로젝트 ID
   * @param basePath - 기본 경로
   * @returns true이면 stale (업데이트 필요)
   */
  async isIndexStale(projectPath: string, projectId?: string, basePath?: string): Promise<boolean> {
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
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(resolvedPath);
      const log = await git.log({ maxCount: 1 });
      const headCommit = log.latest?.hash || '';

      if (!headCommit) {
        return true;
      }

      return headCommit !== existingIndex.meta.gitCommit;
    } catch {
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
  async saveIndex(index: CodeIndex, projectId: string, basePath?: string): Promise<void> {
    const projectDir = getProjectDir(projectId, basePath);
    const indexDir = path.join(projectDir, 'index');
    ensureDir(indexDir);

    // 개별 파일로 분할 저장
    writeJsonFile(path.join(indexDir, 'meta.json'), index.meta);
    writeJsonFile(path.join(indexDir, 'files.json'), index.files);
    writeJsonFile(path.join(indexDir, 'screens.json'), index.screens);
    writeJsonFile(path.join(indexDir, 'components.json'), index.components);
    writeJsonFile(path.join(indexDir, 'apis.json'), index.apis);
    writeJsonFile(path.join(indexDir, 'models.json'), index.models);
    writeJsonFile(path.join(indexDir, 'events.json'), index.events);
    writeJsonFile(path.join(indexDir, 'policies.json'), index.policies);
    writeJsonFile(path.join(indexDir, 'dependencies.json'), index.dependencies);

    logger.info(`Index saved to: ${indexDir}`);
  }

  /**
   * 인덱스 로드
   * @param projectId - 프로젝트 ID
   * @param basePath - 기본 경로
   * @returns 코드 인덱스 (없으면 null)
   */
  async loadIndex(projectId: string, basePath?: string): Promise<CodeIndex | null> {
    const projectDir = getProjectDir(projectId, basePath);
    const indexDir = path.join(projectDir, 'index');

    const metaPath = path.join(indexDir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const meta = readJsonFile<CodeIndex['meta']>(metaPath);
      const files = readJsonFile<CodeIndex['files']>(path.join(indexDir, 'files.json'));
      const screens = readJsonFile<CodeIndex['screens']>(path.join(indexDir, 'screens.json'));
      const components = readJsonFile<CodeIndex['components']>(path.join(indexDir, 'components.json'));
      const apis = readJsonFile<CodeIndex['apis']>(path.join(indexDir, 'apis.json'));
      const models = readJsonFile<CodeIndex['models']>(path.join(indexDir, 'models.json'));
      const events = readJsonFile<CodeIndex['events']>(path.join(indexDir, 'events.json'));
      const policies = readJsonFile<CodeIndex['policies']>(path.join(indexDir, 'policies.json'));
      const dependencies = readJsonFile<CodeIndex['dependencies']>(path.join(indexDir, 'dependencies.json'));

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
        events: events || [],
        policies: policies || [],
        dependencies: dependencies || { graph: { nodes: [], edges: [] } },
      };
    } catch (err) {
      logger.error('Failed to load index:', err);
      return null;
    }
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 파일 목록을 파싱 (TASK-063: parseFilesStreaming 래퍼)
   *
   * 내부적으로 parseFilesStreaming()에 위임하여 결과를 배열로 수집한다.
   * CircuitBreaker, MemoryGuard, AST→Regex 폴백 등 모든 파싱 로직은
   * parseFilesStreaming() 단일 지점에서 관리된다.
   */
  private async parseFiles(
    projectPath: string,
    files: FileInfo[],
    contentCache?: Map<string, string>,
  ): Promise<ParsedFile[]> {
    const results: ParsedFile[] = [];
    await this.parseFilesStreaming(projectPath, files, contentCache, (parsed) => {
      results.push(parsed);
    });
    return results;
  }

  /**
   * TASK-039: 스트리밍 파싱 - 각 파일 파싱 직후 visitor 콜백 호출
   * ParsedFile 참조를 caller가 필요한 만큼만 유지할 수 있도록 함
   *
   * @param projectPath - 프로젝트 루트 경로
   * @param files - 파일 목록
   * @param contentCache - TASK-038 콘텐츠 캐시
   * @param visitor - 각 파싱된 파일에 대해 호출되는 콜백
   * @returns 파싱된 파일 수
   */
  private async parseFilesStreaming(
    projectPath: string,
    files: FileInfo[],
    contentCache: Map<string, string> | undefined,
    visitor: (parsed: ParsedFile) => void,
  ): Promise<number> {
    const normalizer = new ParsedFileNormalizer();
    let parsedCount = 0;

    // TASK-042: Circuit Breaker + MemoryGuard
    const circuitBreaker = new CircuitBreaker(10);
    const memoryGuard = new MemoryGuard(0.85);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // TASK-042: CircuitBreaker 체크
      if (circuitBreaker.tripped) {
        logger.warn(`CircuitBreaker: skipping remaining ${files.length - i} files (${circuitBreaker.failures} consecutive failures)`);
        break;
      }

      // TASK-042: MemoryGuard 체크 (50개마다)
      if (i % 50 === 0 && i > 0) {
        if (!memoryGuard.check()) {
          logger.warn(`MemoryGuard: aborting parse at file ${i}/${files.length}. Returning partial results.`);
          break;
        }
      }

      if (i % 100 === 0 && i > 0) {
        logger.info(`  Parse progress: ${i}/${files.length} files`);
      }

      try {
        const parser = this.findParser(file.path);
        if (!parser) continue;

        if (file.size > MAX_FILE_SIZE) {
          logger.warn(`Skipping large file (${(file.size / 1024).toFixed(0)}KB): ${file.path}`);
          continue;
        }

        let content: string;
        if (contentCache && contentCache.has(file.path)) {
          content = contentCache.get(file.path)!;
          contentCache.delete(file.path);
        } else {
          // TASK-041: 비동기 파일 읽기
          const absolutePath = path.join(projectPath, file.path);
          content = await fsp.readFile(absolutePath, 'utf-8');
        }

        const lineCount = this.countLines(content);
        let effectiveParser = parser;
        if (lineCount > MAX_LINE_COUNT) {
          logger.warn(`File exceeds ${MAX_LINE_COUNT} lines (${lineCount}): ${file.path} → regex fallback`);
          const fallback = this.findFallbackParser(file.path);
          if (fallback) {
            effectiveParser = fallback;
          }
        }

        let parsed = await this.parseWithTimeout(effectiveParser, file.path, content, PARSE_TIMEOUT_MS);

        let usedParser: BaseParser = effectiveParser;
        if (this.isEmptyParseResult(parsed) && content.trim().length > 0 && this.regexFallbackParsers.length > 0) {
          const fallbackParser = this.findFallbackParser(file.path);
          if (fallbackParser) {
            parsed = await this.parseWithTimeout(fallbackParser, file.path, content, PARSE_TIMEOUT_MS);
            usedParser = fallbackParser;
          }
        }

        const parserType = usedParser.name.includes('ast') ? 'ast' as const : 'regex' as const;
        const normalized = normalizer.normalize(parsed, parserType);

        // 즉시 visitor 호출
        visitor(normalized);
        parsedCount++;

        // TASK-042: 성공 시 CircuitBreaker 리셋
        circuitBreaker.recordSuccess();

      } catch (err) {
        logger.debug(`Parse failed for ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
        // TASK-042: 실패 기록
        circuitBreaker.recordFailure();
      }
    }

    return parsedCount;
  }

  /**
   * 메모리 할당 없이 라인 수를 카운트
   */
  private countLines(content: string): number {
    let count = 1;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') count++;
    }
    return count;
  }

  /**
   * Parser.parse() 호출을 timeout으로 래핑
   */
  private async parseWithTimeout(
    parser: BaseParser,
    filePath: string,
    content: string,
    timeoutMs: number,
  ): Promise<ParsedFile> {
    return new Promise<ParsedFile>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn(`Parse timeout (${timeoutMs}ms) for ${filePath}`);
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
          logger.debug(`Parse failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
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
   * ParsedFile이 빈 결과인지 확인 (imports=0, exports=0, functions=0)
   */
  private isEmptyParseResult(parsed: ParsedFile): boolean {
    return parsed.imports.length === 0 && parsed.exports.length === 0 && parsed.functions.length === 0;
  }

  /**
   * regexFallbackParsers에서 해당 파일에 적합한 파서 찾기
   */
  private findFallbackParser(filePath: string): BaseParser | null {
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
  private findParser(filePath: string): BaseParser | null {
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
  private extractComponents(parsedFiles: ParsedFile[]): CodeIndex['components'] {
    const components: CodeIndex['components'] = [];
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
  private extractApiEndpoints(parsedFiles: ParsedFile[]): CodeIndex['apis'] {
    const apis: CodeIndex['apis'] = [];
    const seen = new Set<string>();
    let counter = 0;

    for (const file of parsedFiles) {
      // 라우트 정의에서 API 추출
      for (const route of file.routeDefinitions) {
        const key = `${route.path}`;
        if (seen.has(key)) continue;
        seen.add(key);

        counter++;
        const method = route.component.split('.').pop()?.toUpperCase() || 'GET';
        apis.push({
          id: `api-${counter}`,
          method: method as CodeIndex['apis'][0]['method'],
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
  private extractScreens(parsedFiles: ParsedFile[]): CodeIndex['screens'] {
    const screens: CodeIndex['screens'] = [];
    let counter = 0;

    for (const file of parsedFiles) {
      // pages/ 또는 screens/ 디렉토리의 파일을 화면으로 식별
      const filePath = file.filePath.replace(/\\/g, '/');
      if (
        filePath.includes('/pages/') ||
        filePath.includes('/screens/') ||
        filePath.includes('/views/')
      ) {
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
  async getChangedFiles(projectPath: string, lastCommit: string): Promise<ChangedFileSet> {
    const resolvedPath = path.resolve(projectPath);

    // 지원하는 파일 확장자 (FileScanner의 SUPPORTED_EXTENSIONS와 동일)
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.java', '.kt', '.py'];

    const isSupported = (filePath: string): boolean => {
      const ext = path.extname(filePath).toLowerCase();
      return supportedExtensions.includes(ext);
    };

    try {
      // Git diff 방식 시도
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(resolvedPath);

      // Git 저장소인지 확인
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      // diff --name-status로 정확한 파일 상태 분류
      const nameStatusRaw = await git.diff(['--name-status', lastCommit, 'HEAD']);
      const addedSet = new Set<string>();
      const modifiedSet = new Set<string>();
      const deletedSet = new Set<string>();

      for (const line of nameStatusRaw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split('\t');
        if (parts.length < 2) continue;

        const status = parts[0].charAt(0); // A, M, D, R 등
        // rename의 경우 parts[2]가 새 이름
        const filePath = status === 'R' && parts.length >= 3 ? parts[2] : parts[1];

        if (!isSupported(filePath)) continue;

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

      logger.info(`Changed files (git-diff): +${addedSet.size} ~${modifiedSet.size} -${deletedSet.size}`);

      return {
        added: Array.from(addedSet),
        modified: Array.from(modifiedSet),
        deleted: Array.from(deletedSet),
        method: 'git-diff',
      };
    } catch (err) {
      // Git 사용 불가 시 hash 비교 폴백
      logger.info(`Git diff unavailable, falling back to hash comparison: ${err instanceof Error ? err.message : String(err)}`);
      return this.getChangedFilesByHash(resolvedPath);
    }
  }

  /**
   * 해시 비교 방식으로 변경된 파일 감지 (Git 폴백)
   * @param projectPath 프로젝트 루트 경로 (resolved)
   * @returns ChangedFileSet
   */
  private async getChangedFilesByHash(projectPath: string): Promise<ChangedFileSet> {
    // 현재 파일 스캔
    const scanResult = await this.scanner.scan(projectPath);
    const currentFiles = new Map<string, string>();
    for (const file of scanResult.files) {
      currentFiles.set(file.path, file.hash);
    }

    // 기존 인덱스의 파일 목록 로드 시도
    const projectName = path.basename(projectPath);
    const existingIndex = await this.loadIndex(projectName);
    const previousFiles = new Map<string, string>();
    if (existingIndex) {
      for (const file of existingIndex.files) {
        previousFiles.set(file.path, file.hash);
      }
    }

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // 현재 파일 순회: 새 파일 / 수정된 파일 감지
    for (const [filePath, hash] of currentFiles) {
      const prevHash = previousFiles.get(filePath);
      if (prevHash === undefined) {
        added.push(filePath);
      } else if (prevHash !== hash) {
        modified.push(filePath);
      }
    }

    // 이전 파일 순회: 삭제된 파일 감지
    for (const filePath of previousFiles.keys()) {
      if (!currentFiles.has(filePath)) {
        deleted.push(filePath);
      }
    }

    logger.info(`Changed files (hash-compare): +${added.length} ~${modified.length} -${deleted.length}`);

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
  private async generateAnnotations(
    projectPath: string,
    parsedFiles: ParsedFile[],
    projectId: string,
  ): Promise<void> {
    try {
      logger.info(`Generating annotations for ${parsedFiles.length} files...`);
      const generator = new AnnotationGenerator();
      const manager = new AnnotationManager();

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
        } else {
          await manager.save(projectId, filePath, annotationFile);
        }
      }

      await manager.updateMeta(projectId);
      logger.info(`Annotations generated for ${annotationMap.size} files`);
    } catch (err) {
      // 보강 주석 생성 실패는 인덱싱을 중단하지 않음
      logger.warn(
        `Annotation generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Git 정보 가져오기
   */
  private async getGitInfo(projectPath: string): Promise<{ commit: string; branch: string }> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(projectPath);

      const log = await git.log({ maxCount: 1 });
      const branch = await git.branch();

      return {
        commit: log.latest?.hash || 'unknown',
        branch: branch.current || 'unknown',
      };
    } catch {
      return { commit: 'unknown', branch: 'unknown' };
    }
  }

  /**
   * 패키지 매니저 감지
   */
  private detectPackageManager(projectPath: string): string {
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun';
    return 'npm';
  }
}
