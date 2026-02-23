/**
 * @module commands/result-status
 * @description 분석 결과 상태 변경/조회 CLI 명령어
 *
 * 사용법:
 *   result-status set <analysis-id> <status>               # 단일 상태 변경
 *   result-status --list --project <id> [--status <s>]     # 상태별 조회
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { ResultManager } from '../core/analysis/result-manager';
import { ConfigManager } from '../config/config-manager';
import {
  AnalysisStatus,
  isAnalysisStatus,
  getEffectiveStatus,
} from '../utils/analysis-status';
import { logger } from '../utils/logger';

/**
 * ResultStatusCommand - 분석 결과 상태 변경/조회 명령어
 */
export class ResultStatusCommand implements Command {
  readonly name = 'result-status';
  readonly description = '분석 결과의 상태를 변경하거나 조회합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    // --list 모드 처리
    if (this.args.includes('--list')) {
      return this.handleList();
    }

    // set 서브커맨드: result-status set <analysisId> <status>
    if (this.args[0] === 'set') {
      return this.handleSet();
    }

    // 인자 부족 시 사용법 안내
    logger.error('사용법: result-status set <analysisId> <status>');
    logger.error('        result-status --list --project <id> [--status <s>]');
    return {
      code: ResultCode.FAILURE,
      message: 'Invalid arguments. Use: result-status set <analysisId> <status>',
    };
  }

  /**
   * 단일 상태 변경: result-status set <analysisId> <status>
   */
  private async handleSet(): Promise<CommandResult> {
    const analysisId = this.args[1];
    const newStatusArg = this.args[2];

    if (!analysisId || !newStatusArg) {
      logger.error('사용법: result-status set <analysisId> <status>');
      return {
        code: ResultCode.FAILURE,
        message: 'Missing arguments. Usage: result-status set <analysisId> <status>',
      };
    }

    if (!isAnalysisStatus(newStatusArg)) {
      logger.error(`유효하지 않은 상태: ${newStatusArg}`);
      logger.error('유효한 상태: active, completed, on-hold, archived');
      return {
        code: ResultCode.FAILURE,
        message: `Invalid status: ${newStatusArg}. Valid: active, completed, on-hold, archived`,
      };
    }

    const newStatus = newStatusArg as AnalysisStatus;

    try {
      const resultManager = new ResultManager();

      // analysisId로 프로젝트 ID 역매핑
      const found = await resultManager.findByAnalysisId(analysisId);
      if (!found) {
        logger.error(`분석 결과를 찾을 수 없습니다: ${analysisId}`);
        return {
          code: ResultCode.FAILURE,
          message: `Analysis result not found: ${analysisId}`,
        };
      }

      const updated = await resultManager.updateStatus(
        found.projectId,
        analysisId,
        newStatus,
      );

      logger.success(
        `상태 변경 완료: ${analysisId} → ${newStatus} (프로젝트: ${found.projectId})`,
      );

      return {
        code: ResultCode.SUCCESS,
        message: `Status updated: ${analysisId} → ${newStatus}`,
        data: { result: updated, projectId: found.projectId },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`상태 변경 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Status update failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 상태별 분석 결과 목록 조회
   * result-status --list --project <id> [--status <s>]
   */
  private async handleList(): Promise<CommandResult> {
    try {
      const projectId = await this.resolveProjectId();
      if (!projectId) {
        logger.error('프로젝트 ID가 필요합니다. --project <id> 또는 활성 프로젝트를 설정하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No project ID. Use --project <id> or set an active project.',
        };
      }

      const statusFilter = this.getOption('--status');
      const resultManager = new ResultManager();
      let results = await resultManager.list(projectId);

      if (statusFilter && statusFilter !== 'all') {
        if (!isAnalysisStatus(statusFilter)) {
          logger.error(`유효하지 않은 상태 필터: ${statusFilter}`);
          return {
            code: ResultCode.FAILURE,
            message: `Invalid status filter: ${statusFilter}. Valid: active, completed, on-hold, archived`,
          };
        }
        results = results.filter(
          r => getEffectiveStatus(r.status) === statusFilter,
        );
      }

      // 테이블 형식 출력
      logger.header(`분석 결과 목록 (프로젝트: ${projectId})`);
      if (statusFilter && statusFilter !== 'all') {
        console.log(`  상태 필터: ${statusFilter}\n`);
      }

      if (results.length === 0) {
        console.log('  결과가 없습니다.\n');
      } else {
        console.log(
          `  ${'ID'.padEnd(30)} ${'상태'.padEnd(12)} ${'등급'.padEnd(8)} ${'점수'.padEnd(6)} ${'분석일시'}`,
        );
        console.log(`  ${'-'.repeat(80)}`);
        for (const r of results) {
          const status = getEffectiveStatus(r.status);
          console.log(
            `  ${r.id.padEnd(30)} ${status.padEnd(12)} ${r.grade.padEnd(8)} ${String(r.totalScore).padEnd(6)} ${r.analyzedAt}`,
          );
        }
        console.log(`\n  총 ${results.length}건\n`);
      }

      return {
        code: ResultCode.SUCCESS,
        message: `Found ${results.length} results.`,
        data: results,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`조회 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `List failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 프로젝트 ID를 확정
   */
  private async resolveProjectId(): Promise<string | null> {
    const explicit = this.getOption('--project');
    if (explicit) return explicit;

    const configManager = new ConfigManager();
    await configManager.load();
    return configManager.getActiveProject();
  }

  /**
   * 인자에서 옵션 값을 추출
   */
  private getOption(flag: string): string | undefined {
    const idx = this.args.indexOf(flag);
    if (idx >= 0 && idx + 1 < this.args.length) {
      return this.args[idx + 1];
    }
    return undefined;
  }
}
