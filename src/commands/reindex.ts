/**
 * @module commands/reindex
 * @description Reindex 명령어 핸들러 - 코드 인덱스를 수동으로 갱신
 */

import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ProjectsConfig } from '../types/index';
import { Indexer } from '../core/indexing/indexer';
import { ConfigManager } from '../config/config-manager';
import { readJsonFile, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * ReindexCommand - 인덱스 갱신 명령어
 *
 * 사용법: /impact reindex [--full]
 * 기능:
 *   - 증분 인덱스 업데이트 (기본)
 *   - --full 옵션으로 전체 재인덱싱
 *   - 인덱싱 진행률 출력
 */
export class ReindexCommand implements Command {
  readonly name = 'reindex';
  readonly description = '코드 인덱스를 수동으로 갱신합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const isFull = this.args.includes('--full');

    try {
      // 활성 프로젝트 확인
      const configManager = new ConfigManager();
      await configManager.load();
      const activeProjectId = configManager.getActiveProject();

      if (!activeProjectId) {
        logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No active project. Run /impact init first.',
        };
      }

      // 프로젝트 정보 로드
      const impactDir = getImpactDir();
      const projectsPath = path.join(impactDir, 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);

      if (!projectsConfig) {
        logger.error('프로젝트 설정을 찾을 수 없습니다.');
        return {
          code: ResultCode.FAILURE,
          message: 'Projects config not found.',
        };
      }

      const project = projectsConfig.projects.find(p => p.id === activeProjectId);
      if (!project) {
        logger.error(`프로젝트를 찾을 수 없습니다: ${activeProjectId}`);
        return {
          code: ResultCode.FAILURE,
          message: `Project not found: ${activeProjectId}`,
        };
      }

      logger.header('Impact Checker - 인덱스 갱신');
      console.log(`\n프로젝트: ${project.name}`);
      console.log(`경로: ${project.path}`);
      console.log(`모드: ${isFull ? '전체 재인덱싱' : '증분 업데이트'}\n`);

      const indexer = new Indexer();
      let codeIndex;

      if (isFull) {
        logger.info('전체 재인덱싱을 시작합니다...');
        codeIndex = await indexer.fullIndex(project.path);
      } else {
        logger.info('증분 업데이트를 시작합니다...');
        codeIndex = await indexer.incrementalUpdate(project.path);
      }

      // 인덱스 저장
      await indexer.saveIndex(codeIndex, activeProjectId);

      // 결과 출력
      logger.separator();
      console.log('\n인덱싱 결과 요약:');
      console.log(`  파일 수:       ${codeIndex.meta.stats.totalFiles}`);
      console.log(`  화면 수:       ${codeIndex.meta.stats.screens}`);
      console.log(`  컴포넌트 수:   ${codeIndex.meta.stats.components}`);
      console.log(`  API 엔드포인트: ${codeIndex.meta.stats.apiEndpoints}`);
      console.log(`  모듈 수:       ${codeIndex.meta.stats.modules}`);
      console.log(`  정책 수:       ${codeIndex.policies.length}`);
      logger.separator();
      logger.success('인덱스 갱신이 완료되었습니다!');

      return {
        code: ResultCode.SUCCESS,
        message: `Reindex complete for ${activeProjectId}`,
        data: {
          projectId: activeProjectId,
          mode: isFull ? 'full' : 'incremental',
          stats: codeIndex.meta.stats,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`인덱스 갱신 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Reindex failed: ${errorMsg}`,
      };
    }
  }
}
