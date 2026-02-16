/**
 * @module commands/save-result
 * @description Save Result 명령어 핸들러 - 분석 결과 JSON 파일을 저장소에 등록
 */

import * as fs from 'fs';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfidenceEnrichedResult } from '../types/analysis';
import { ConfigManager } from '../config/config-manager';
import { ResultManager } from '../core/analysis/result-manager';
import { validateImpactResult } from '../utils/validators';
import { logger } from '../utils/logger';

/**
 * SaveResultCommand - 분석 결과 저장 명령어
 *
 * 사용법: /impact save-result --file <path> [--project <id>]
 * 기능:
 *   - JSON 파일을 읽어 검증 후 ResultManager를 통해 저장
 *   - analysisMethod가 없으면 'claude-native' 기본 설정
 *   - --project <id>: 특정 프로젝트 지정
 */
export class SaveResultCommand implements Command {
  readonly name = 'save-result';
  readonly description = '분석 결과 JSON 파일을 프로젝트 저장소에 등록합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // --file 옵션 파싱
      const filePath = this.getOption('--file');
      if (!filePath) {
        logger.error('--file 옵션이 필요합니다.');
        return {
          code: ResultCode.FAILURE,
          message: '--file option is required. Usage: save-result --file <path>',
        };
      }

      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        logger.error(`파일을 찾을 수 없습니다: ${filePath}`);
        return {
          code: ResultCode.FAILURE,
          message: `File not found: ${filePath}`,
        };
      }

      // 파일 읽기 및 JSON 파싱
      let rawData: unknown;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        rawData = JSON.parse(content);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        logger.error(`JSON 파싱 실패: ${msg}`);
        return {
          code: ResultCode.FAILURE,
          message: `Failed to parse JSON: ${msg}`,
        };
      }

      // 런타임 검증
      const validation = validateImpactResult(rawData);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
        logger.error(`검증 실패:\n${errorMessages}`);
        return {
          code: ResultCode.FAILURE,
          message: `Validation failed:\n${errorMessages}`,
        };
      }

      // analysisMethod 기본값 설정
      const result = rawData as ConfidenceEnrichedResult;
      if (!result.analysisMethod) {
        (result as unknown as Record<string, unknown>)['analysisMethod'] = 'claude-native';
      }

      // 프로젝트 ID 결정
      const projectId = this.getOption('--project');
      const resolvedProjectId = await this.resolveProjectId(projectId);
      if (!resolvedProjectId) {
        logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No active project. Run /impact init first.',
        };
      }

      // ResultManager로 저장
      const resultManager = new ResultManager();
      const savedId = await resultManager.save(result, resolvedProjectId);

      logger.success(`분석 결과가 저장되었습니다: ${savedId}`);
      return {
        code: ResultCode.SUCCESS,
        message: `Result saved: ${savedId}`,
        data: { resultId: savedId, projectId: resolvedProjectId },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`결과 저장 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Save failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 프로젝트 ID를 확정
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
