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
 * 사용법: /impact reindex [--full] [--incremental]
 * 기능:
 *   - 증분 인덱스 업데이트 (기본)
 *   - --full 옵션으로 전체 재인덱싱
 *   - --incremental 옵션으로 명시적 증분 인덱싱
 *   - isIndexStale 확인 후 자동 분기
 *   - 변경 비율 30% 초과 시 전체 인덱싱 전환
 *   - 증분 인덱싱 실패 시 전체 인덱싱 폴백
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
    const isIncremental = this.args.includes('--incremental');

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

      const indexer = new Indexer();
      let codeIndex;
      const startTime = Date.now();

      if (isFull) {
        // --full: 무조건 전체 인덱싱
        console.log(`모드: 전체 재인덱싱\n`);
        logger.info('전체 재인덱싱을 시작합니다...');
        codeIndex = await indexer.fullIndex(project.path);
      } else {
        // 기본 동작 또는 --incremental: isIndexStale 확인 후 분기
        console.log(`모드: ${isIncremental ? '증분 업데이트 (명시적)' : '자동 감지'}\n`);
        logger.info('인덱스 상태 확인 중...');

        const stale = await indexer.isIndexStale(project.path, activeProjectId);

        if (!stale && !isIncremental) {
          logger.success('이미 최신 상태입니다.');
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`\n소요 시간: ${elapsedSec}s`);
          return {
            code: ResultCode.SUCCESS,
            message: 'Index is already up to date.',
            data: {
              projectId: activeProjectId,
              mode: 'none',
              upToDate: true,
            },
          };
        }

        // stale이거나 --incremental인 경우 증분 인덱싱 시도
        logger.info('변경된 파일 감지 중...');

        try {
          codeIndex = await indexer.incrementalUpdate(project.path, activeProjectId);
        } catch (err) {
          // 증분 인덱싱 실패 시 전체 인덱싱 폴백
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn(`증분 인덱싱 실패, 전체 인덱싱으로 전환합니다: ${errMsg}`);
          codeIndex = await indexer.fullIndex(project.path);
        }
      }

      // 인덱스 저장
      await indexer.saveIndex(codeIndex, activeProjectId);

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

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

      const mode = isFull ? 'full' : (codeIndex.meta.lastUpdateType || 'incremental');
      console.log(`인덱싱 완료: ${codeIndex.meta.stats.totalFiles}개 파일 처리 (소요 시간: ${elapsedSec}s)`);
      logger.success('인덱스 갱신이 완료되었습니다!');

      return {
        code: ResultCode.SUCCESS,
        message: `Reindex complete for ${activeProjectId}`,
        data: {
          projectId: activeProjectId,
          mode,
          stats: codeIndex.meta.stats,
          elapsedSeconds: parseFloat(elapsedSec),
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
