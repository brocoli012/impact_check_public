/**
 * @module commands/save-result
 * @description Save Result 명령어 핸들러 - 분석 결과 JSON 파일을 저장소에 등록
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfidenceEnrichedResult } from '../types/analysis';
import { ProjectsConfig } from '../types/index';
import { ConfigManager } from '../config/config-manager';
import { ResultManager } from '../core/analysis/result-manager';
import { CrossProjectManager } from '../core/cross-project/cross-project-manager';
import { DetectResult } from '../core/cross-project/types';
import { Indexer } from '../core/indexing/indexer';
import { validateImpactResult } from '../utils/validators';
import { readJsonFile, getImpactDir } from '../utils/file';
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

      // === 후처리 hook: 크로스 프로젝트 자동 감지 ===
      const skipCrossDetect = this.args.includes('--skip-cross-detect');
      if (!skipCrossDetect) {
        try {
          const detectResult = await this.runCrossProjectHook(resolvedProjectId);
          // TASK-056: 탐지 결과를 분석 결과 요약에 기록
          if (detectResult) {
            await resultManager.updateCrossProjectDetection(resolvedProjectId, savedId, {
              detectedAt: new Date().toISOString(),
              linksDetected: detectResult.detected,
              linksNew: detectResult.saved,
              linksTotal: detectResult.total,
            });
          }
        } catch (hookErr) {
          const hookMsg = hookErr instanceof Error ? hookErr.message : String(hookErr);
          logger.warn(`크로스 프로젝트 갱신 실패 (분석 결과는 저장됨): ${hookMsg}`);
        }
      }

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
   * 크로스 프로젝트 자동 감지 후처리 hook
   * - 등록 프로젝트가 2개 이상일 때만 실행
   * - 실패해도 save-result 전체에 영향 없음 (호출자에서 catch)
   * @returns DetectResult 또는 null (프로젝트 부족 시)
   */
  private async runCrossProjectHook(_projectId: string): Promise<DetectResult | null> {
    // projects.json에서 프로젝트 목록 로드
    const projectsPath = path.join(getImpactDir(), 'projects.json');
    const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
    const projectIds = projectsConfig?.projects?.map(p => p.id) || [];

    if (projectIds.length < 2) {
      logger.debug('등록 프로젝트 1개 이하: 크로스 프로젝트 감지 건너뜀');
      return null;
    }

    logger.info(`등록 프로젝트 ${projectIds.length}개 감지, detectAndSave 실행...`);
    const indexer = new Indexer();
    const manager = new CrossProjectManager();
    const result = await manager.detectAndSave(indexer, projectIds);

    if (result.saved > 0) {
      const typeStats = Object.entries(result.byType)
        .map(([type, count]) => `${type} ${count}건`)
        .join(', ');
      logger.success(`크로스 프로젝트 자동 탐지: ${result.detected}건 발견, ${result.saved}건 신규 저장 (${typeStats})`);
    } else if (result.detected > 0) {
      logger.info(`크로스 프로젝트 자동 탐지: ${result.detected}건 발견 (신규 없음)`);
    } else {
      logger.info('신규 크로스 프로젝트 의존성 없음');
    }

    return result;
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
