/**
 * @module core/indexing/indexer
 * @description 인덱서 메인 - 전체 인덱싱 파이프라인 실행 및 인덱스 관리
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeIndex, IndexMeta, FileInfo, ChangedFileSet } from '../../types/index';
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

    // 5d. 전체 파일 대상 policies 재추출
    logger.info('  Re-extracting policies...');
    const allFilesToParse = await this.parseFiles(resolvedPath, updatedFiles);
    const commentPolicies = this.policyExtractor.extractFromComments(allFilesToParse);
    const docPolicies = await this.policyExtractor.extractFromDocs(resolvedPath);
    const manualPolicies = await this.policyExtractor.loadManualPolicies(resolvedPath);
    const allPolicies = this.policyExtractor.mergeAllPolicies(
      commentPolicies,
      docPolicies,
      manualPolicies,
    );

    // 5e. dependencyGraph 전체 재빌드 (안전 전략)
    logger.info('  Rebuilding dependency graph...');
    const dependencyGraph = this.graphBuilder.build(allFilesToParse);

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
      },
    };

    const updatedIndex: CodeIndex = {
      meta: updatedMeta,
      files: updatedFiles,
      screens: updatedScreens,
      components: updatedComponents,
      apis: updatedApis,
      models: existingIndex.models,
      policies: allPolicies,
      dependencies: dependencyGraph,
    };

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
