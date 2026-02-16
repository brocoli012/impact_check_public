/**
 * @module commands/export-index
 * @description Export Index 명령어 핸들러 - 코드 인덱스를 요약/전체 형태로 내보내기
 */

import * as fs from 'fs';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfigManager } from '../config/config-manager';
import { Indexer } from '../core/indexing/indexer';
import { summarizeIndex } from '../utils/index-summarizer';
import { logger } from '../utils/logger';

/**
 * ExportIndexCommand - 인덱스 내보내기 명령어
 *
 * 사용법: /impact export-index [--project <id>] [--summary|--full] [--output <file>]
 * 기능:
 *   - --summary (기본): 요약 형태로 출력
 *   - --full: 전체 인덱스 출력
 *   - --output <file>: 파일로 저장
 *   - --project <id>: 특정 프로젝트 지정
 */
export class ExportIndexCommand implements Command {
  readonly name = 'export-index';
  readonly description = '코드 인덱스를 요약 또는 전체 형태로 내보냅니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // 옵션 파싱
      const projectId = this.getOption('--project');
      const isFull = this.args.includes('--full');
      const outputPath = this.getOption('--output');

      // 프로젝트 ID 결정
      const resolvedProjectId = await this.resolveProjectId(projectId);
      if (!resolvedProjectId) {
        logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No active project. Run /impact init first.',
        };
      }

      // 인덱스 로드
      const indexer = new Indexer();
      const codeIndex = await indexer.loadIndex(resolvedProjectId);

      if (!codeIndex) {
        logger.error('인덱스를 찾을 수 없습니다. /impact reindex를 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: `Index not found for project '${resolvedProjectId}'. Run /impact reindex first.`,
        };
      }

      // 요약 또는 전체
      const output = isFull ? codeIndex : summarizeIndex(codeIndex);
      const jsonStr = JSON.stringify(output, null, 2);

      // 출력
      if (outputPath) {
        fs.writeFileSync(outputPath, jsonStr, 'utf-8');
        logger.success(`인덱스를 파일로 저장했습니다: ${outputPath}`);
        return {
          code: ResultCode.SUCCESS,
          message: `Index exported to ${outputPath}`,
          data: { projectId: resolvedProjectId, outputPath, mode: isFull ? 'full' : 'summary' },
        };
      } else {
        console.log(jsonStr);
        return {
          code: ResultCode.SUCCESS,
          message: `Index exported (${isFull ? 'full' : 'summary'}) for project '${resolvedProjectId}'`,
          data: { projectId: resolvedProjectId, mode: isFull ? 'full' : 'summary' },
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`인덱스 내보내기 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Export failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 프로젝트 ID를 확정 (명시적 지정 또는 활성 프로젝트)
   */
  private async resolveProjectId(explicitId?: string): Promise<string | null> {
    if (explicitId) {
      return explicitId;
    }

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
