/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeIndex, IndexMeta, FileInfo } from '../../types/index';
import { ParsedFile } from './types';
import { FileScanner } from './scanner';
import { TypeScriptParser } from './parsers/typescript-parser';
import { BaseParser } from './parsers/base-parser';
import { DependencyGraphBuilder } from './graph-builder';
import { PolicyExtractor } from './policy-extractor';
import { ensureDir, readJsonFile, writeJsonFile, getProjectDir } from '../../utils/file';
import { logger } from '../../utils/logger';

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
export class Indexer {
  private readonly scanner: FileScanner;
  private readonly parsers: BaseParser[];
  private readonly graphBuilder: DependencyGraphBuilder;
  private readonly policyExtractor: PolicyExtractor;

  constructor() {
    this.scanner = new FileScanner();
    this.parsers = [new TypeScriptParser()];
    this.graphBuilder = new DependencyGraphBuilder();
    this.policyExtractor = new PolicyExtractor();
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

    // Step 2: AST 파싱
    logger.info('Step 2/5: Parsing files...');
    const parsedFiles = await this.parseFiles(resolvedPath, scanResult.files);
    logger.info(`  Parsed ${parsedFiles.length} files`);

    // Step 3: 정책 추출
    logger.info('Step 3/5: Extracting policies...');
    const commentPolicies = this.policyExtractor.extractFromComments(parsedFiles);
    const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
    const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
    const allPolicies = this.policyExtractor.mergeAllPolicies(
      commentPolicies,
      docPolicies,
      manualPolicies,
    );
    logger.info(`  Extracted ${allPolicies.length} policies`);

    // Step 4: 의존성 그래프 구축
    logger.info('Step 4/5: Building dependency graph...');
    const dependencyGraph = this.graphBuilder.build(parsedFiles);
    logger.info(`  Graph: ${dependencyGraph.graph.nodes.length} nodes, ${dependencyGraph.graph.edges.length} edges`);

    // Step 5: 코드 인덱스 조합
    logger.info('Step 5/5: Composing code index...');
    const components = this.extractComponents(parsedFiles);
    const apiEndpoints = this.extractApiEndpoints(parsedFiles);
    const screens = this.extractScreens(parsedFiles);

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
      stats: {
        totalFiles: scanResult.stats.totalFiles,
        screens: screens.length,
        components: components.length,
        apiEndpoints: apiEndpoints.length,
        models: 0,
        modules: dependencyGraph.graph.nodes.filter(n => n.type === 'module').length,
      },
    };

    const codeIndex: CodeIndex = {
      meta,
      files: scanResult.files,
      screens,
      components,
      apis: apiEndpoints,
      models: [],
      policies: allPolicies,
      dependencies: dependencyGraph,
    };

    logger.info('Indexing complete!');
    return codeIndex;
  }

  /**
   * 증분 업데이트
   * @param projectPath - 프로젝트 루트 경로
   * @returns 업데이트된 코드 인덱스
   */
  async incrementalUpdate(projectPath: string): Promise<CodeIndex> {
    // TODO: Phase 3에서 Git diff 기반 증분 업데이트 구현
    // 현재는 fullIndex()로 폴백 (MVP 동작)
    logger.info('Incremental update: falling back to full index (MVP)');
    return this.fullIndex(projectPath);
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
   * 파일 목록을 파싱
   */
  private async parseFiles(
    projectPath: string,
    files: FileInfo[],
  ): Promise<ParsedFile[]> {
    const parsedFiles: ParsedFile[] = [];

    for (const file of files) {
      const parser = this.findParser(file.path);
      if (!parser) continue;

      try {
        const absolutePath = path.join(projectPath, file.path);
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const parsed = await parser.parse(file.path, content);
        parsedFiles.push(parsed);
      } catch (err) {
        logger.debug(`Failed to parse ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return parsedFiles;
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
