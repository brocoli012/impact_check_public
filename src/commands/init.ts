/**
 * @module commands/init
 * @description Init 명령어 핸들러 - 프로젝트를 등록하고 코드 인덱싱을 수행
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ProjectsConfig, ProjectEntry } from '../types/index';
import { Indexer } from '../core/indexing/indexer';
import { SupplementScanner } from '../core/cross-project/supplement-scanner';
import { ensureDir, readJsonFile, writeJsonFile, getImpactDir, toKebabCase } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * InitCommand - 프로젝트 초기화 명령어
 *
 * 사용법: /impact init <project_path>
 * 기능:
 *   - 프로젝트 경로 유효성 검증
 *   - 기술 스택 자동 감지 및 표시
 *   - 전체 인덱싱 실행
 *   - 인덱스 결과 요약 출력
 *   - .impact/ 디렉토리에 저장
 */
export class InitCommand implements Command {
  readonly name = 'init';
  readonly description = '프로젝트를 등록하고 코드 인덱싱을 수행합니다.';
  private readonly args: string[];

  /**
   * InitCommand 생성
   * @param args - 명령어 인자
   */
  constructor(args: string[]) {
    this.args = args;
  }

  /**
   * 명령어 실행
   * @returns 실행 결과
   */
  async execute(): Promise<CommandResult> {
    const projectPath = this.args[0];

    if (!projectPath) {
      logger.error('프로젝트 경로를 지정해 주세요.');
      console.log('\n사용법: /impact init <project_path>');
      console.log('예시:   /impact init /path/to/your/project');
      return {
        code: ResultCode.FAILURE,
        message: 'Project path is required.',
      };
    }

    const resolvedPath = path.resolve(projectPath);

    // 경로 유효성 검증
    if (!fs.existsSync(resolvedPath)) {
      logger.error(`경로가 존재하지 않습니다: ${resolvedPath}`);
      return {
        code: ResultCode.FAILURE,
        message: `❌ 경로가 존재하지 않습니다: ${resolvedPath}`,
      };
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      logger.error(`디렉토리가 아닙니다: ${resolvedPath}`);
      return {
        code: ResultCode.FAILURE,
        message: `Not a directory: ${resolvedPath}`,
      };
    }

    try {
      logger.header('Impact Checker - 프로젝트 초기화');

      // 프로젝트 ID 생성
      const projectName = path.basename(resolvedPath);
      const projectId = toKebabCase(projectName);

      console.log(`\n프로젝트: ${projectName}`);
      console.log(`경로: ${resolvedPath}`);
      console.log(`ID: ${projectId}`);

      // 인덱싱 실행
      console.log('\n인덱싱을 시작합니다...\n');
      const indexer = new Indexer();
      const codeIndex = await indexer.fullIndex(resolvedPath);

      // 인덱스 저장
      await indexer.saveIndex(codeIndex, projectId);

      // 프로젝트 등록
      this.registerProject(projectId, projectName, resolvedPath, codeIndex.meta.project.techStack);

      // 결과 요약 출력
      logger.separator();
      console.log('\n인덱싱 결과 요약:');
      console.log(`  파일 수:       ${codeIndex.meta.stats.totalFiles}`);
      console.log(`  화면 수:       ${codeIndex.meta.stats.screens}`);
      console.log(`  컴포넌트 수:   ${codeIndex.meta.stats.components}`);
      console.log(`  API 엔드포인트: ${codeIndex.meta.stats.apiEndpoints}`);
      console.log(`  모듈 수:       ${codeIndex.meta.stats.modules}`);
      console.log(`  정책 수:       ${codeIndex.policies.length}`);

      if (codeIndex.meta.project.techStack.length > 0) {
        console.log(`\n기술 스택: ${codeIndex.meta.project.techStack.join(', ')}`);
      }

      console.log(`\nGit: ${codeIndex.meta.gitBranch} (${codeIndex.meta.gitCommit.substring(0, 7)})`);
      logger.separator();
      logger.success('프로젝트 초기화가 완료되었습니다!');

      // 크로스 프로젝트 탐지 제안: 등록 프로젝트가 2개 이상일 때
      const projectsPath = path.join(getImpactDir(), 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath) || { activeProject: '', projects: [] };
      const projectCount = projectsConfig.projects.length;
      if (projectCount >= 2) {
        console.log(`\n${projectCount}개 프로젝트가 등록되어 있습니다.`);
        console.log('   크로스 프로젝트 영향도를 분석하려면: /impact cross-analyze --auto');

        // 보완 분석 스캔 hook
        await this.runSupplementScan(projectId);
      }

      return {
        code: ResultCode.SUCCESS,
        message: `Project initialized: ${projectId}`,
        data: {
          projectId,
          stats: codeIndex.meta.stats,
          techStack: codeIndex.meta.project.techStack,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`초기화 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Initialization failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 프로젝트를 .impact/projects.json에 등록
   */
  private registerProject(
    projectId: string,
    name: string,
    projectPath: string,
    techStack: string[],
  ): void {
    const impactDir = getImpactDir();
    ensureDir(impactDir);

    const projectsPath = path.join(impactDir, 'projects.json');
    const config = readJsonFile<ProjectsConfig>(projectsPath) || {
      activeProject: '',
      projects: [],
    };

    // 기존 프로젝트 업데이트 또는 신규 등록
    const now = new Date().toISOString();
    const existingIdx = config.projects.findIndex(p => p.id === projectId);

    const entry: ProjectEntry = {
      id: projectId,
      name,
      path: projectPath,
      status: 'active',
      createdAt: existingIdx >= 0 ? config.projects[existingIdx].createdAt : now,
      lastUsedAt: now,
      techStack,
    };

    if (existingIdx >= 0) {
      config.projects[existingIdx] = entry;
    } else {
      config.projects.push(entry);
    }

    config.activeProject = projectId;

    writeJsonFile(projectsPath, config);
    logger.debug(`Project registered: ${projectId}`);
  }

  /**
   * 보완 분석 스캔 hook - init 성공 후 기존 분석 결과 매칭 스캔
   */
  private async runSupplementScan(newProjectId: string): Promise<void> {
    try {
      const scanner = new SupplementScanner();
      const scanResult = await scanner.scan(newProjectId);

      const autoCandidates = scanResult.candidates.filter(c => c.recommendation === 'auto');
      const suggestCandidates = scanResult.candidates.filter(c => c.recommendation === 'suggest');

      // 후보가 없으면 간단 메시지
      if (autoCandidates.length === 0 && suggestCandidates.length === 0) {
        console.log('\n✓ 보완 분석이 필요한 기존 분석이 없습니다.');
      } else {
        // auto 후보 출력
        for (const candidate of autoCandidates) {
          console.log(`\n🔄 보완 분석 자동 포함: ${candidate.title} (매칭도 ${candidate.matchRate}%)`);
        }
        // suggest 후보 출력
        for (const candidate of suggestCandidates) {
          console.log(`\n❓ 보완 분석 확인 필요: ${candidate.title} (매칭도 ${candidate.matchRate}%)`);
        }

        console.log(`\ncross-analyze --supplement --project ${newProjectId} 명령어로 보완 분석을 실행할 수 있습니다.`);
      }

      // excludedByStatus 표시
      const { completed, onHold, archived } = scanResult.excludedByStatus;
      if (completed > 0 || onHold > 0 || archived > 0) {
        const parts: string[] = [];
        if (completed > 0) parts.push(`completed ${completed}건`);
        if (onHold > 0) parts.push(`on-hold ${onHold}건`);
        if (archived > 0) parts.push(`archived ${archived}건`);
        console.log(`ℹ 상태별 제외: ${parts.join(', ')}`);
      }
    } catch (err) {
      // 보완 분석 스캔 실패는 init 전체를 실패시키지 않음
      logger.debug(`보완 분석 스캔 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
