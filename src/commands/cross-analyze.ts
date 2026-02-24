/**
 * @module commands/cross-analyze
 * @description CrossAnalyze 명령어 핸들러 - 크로스 프로젝트 영향도 분석
 *
 * 기능:
 *   - 소스 프로젝트 기준으로 연결된 프로젝트 간 영향도 분석
 *   - --source <project-id>: 소스 프로젝트 지정 (기본: 활성 프로젝트)
 *   - --group <group-name>: 특정 그룹 대상으로 분석
 */

import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfidenceEnrichedResult } from '../types/analysis';
import { ProjectsConfig } from '../types/index';
import { CrossProjectManager } from '../core/cross-project/cross-project-manager';
import { ApiContractChecker } from '../core/cross-project/api-contract-checker';
import { CrossAnalyzer } from '../core/cross-project/cross-analyzer';
import { SupplementScanner } from '../core/cross-project/supplement-scanner';
import { ResultManager } from '../core/analysis/result-manager';
import { Indexer } from '../core/indexing/indexer';
import { ConfigManager } from '../config/config-manager';
import { readJsonFile, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';
import { renderMermaid } from '../utils/mermaid-renderer';

/** ANSI 색상 코드 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
} as const;

/** 영향 수준별 색상 매핑 */
const IMPACT_COLORS: Record<string, string> = {
  critical: COLORS.red,
  high: COLORS.yellow,
  medium: COLORS.blue,
  low: COLORS.green,
};

/** 심각도별 색상 매핑 */
const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.red,
  warning: COLORS.yellow,
  info: COLORS.cyan,
};

/**
 * CrossAnalyzeCommand - 크로스 프로젝트 영향도 분석 명령어
 *
 * 사용법:
 *   /impact cross-analyze                          - 활성 프로젝트 기준 분석
 *   /impact cross-analyze --source <project-id>   - 특정 소스 프로젝트 기준 분석
 *   /impact cross-analyze --group <group-name>    - 특정 그룹 대상으로 분석
 */
export class CrossAnalyzeCommand implements Command {
  readonly name = 'cross-analyze';
  readonly description = '크로스 프로젝트 영향도 분석';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // --auto 옵션 처리: 모든 등록 프로젝트에 대해 자동 탐지 수행
      if (this.args.includes('--auto')) {
        return await this.handleAutoDetect();
      }

      // --supplement 옵션 처리: 보완 분석 스캔 및 저장
      if (this.args.includes('--supplement')) {
        return await this.handleSupplement();
      }

      // --mermaid 옵션 처리: Mermaid 다이어그램 출력
      if (this.args.includes('--mermaid')) {
        return await this.handleMermaid();
      }

      // 1. 옵션 파싱
      const sourceIdx = this.args.indexOf('--source');
      const groupIdx = this.args.indexOf('--group');

      let sourceProjectId: string | undefined;
      let groupName: string | undefined;

      if (sourceIdx !== -1 && this.args[sourceIdx + 1]) {
        sourceProjectId = this.args[sourceIdx + 1];
      }

      if (groupIdx !== -1 && this.args[groupIdx + 1]) {
        groupName = this.args[groupIdx + 1];
      }

      // 2. 소스 프로젝트 확인
      if (!sourceProjectId) {
        sourceProjectId = (await this.getActiveProjectId()) || undefined;
      }

      if (!sourceProjectId) {
        logger.error('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_CONFIG,
          message: '프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.',
        };
      }

      // 3. CrossAnalyzer 생성 및 실행
      const manager = new CrossProjectManager();
      const contractChecker = new ApiContractChecker();
      const analyzer = new CrossAnalyzer(manager, contractChecker);
      const indexer = new Indexer();

      // 4. 링크 존재 여부 확인
      const links = await manager.getLinks(sourceProjectId);
      if (links.length === 0) {
        logger.header('크로스 프로젝트 영향도 분석');
        console.log('');
        console.log('  등록된 크로스 프로젝트 의존성이 없습니다.');
        console.log('');
        console.log('  의존성을 등록하려면:');
        console.log('    /impact projects --link <source> <target> --type api-consumer');
        console.log('');
        console.log('  자동 감지를 실행하려면:');
        console.log('    /impact projects --detect-links');
        console.log('');

        return {
          code: ResultCode.SUCCESS,
          message: '등록된 크로스 프로젝트 의존성이 없습니다.',
          data: { affectedProjects: [], apiContractChanges: [] },
        };
      }

      // 5. 분석 실행
      const result = await analyzer.analyze(sourceProjectId, indexer, {
        groupName,
      });

      // 6. 결과 출력
      this.printResult(sourceProjectId, result, groupName);

      return {
        code: ResultCode.SUCCESS,
        message: `크로스 프로젝트 분석 완료: ${result.affectedProjects.length}개 프로젝트 영향`,
        data: result,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`크로스 프로젝트 분석 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Cross-analyze failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 분석 결과 출력
   */
  private printResult(
    sourceProjectId: string,
    result: { affectedProjects: Array<{ projectId: string; projectName: string; impactLevel: string; affectedApis: string[]; affectedComponents: number; summary: string }>; apiContractChanges: Array<{ apiPath: string; changeType: string; consumers: string[]; severity: string }> },
    groupName?: string,
  ): void {
    logger.header('크로스 프로젝트 영향도 분석');

    console.log(`\n  소스 프로젝트: ${sourceProjectId}`);
    if (groupName) {
      console.log(`  그룹 필터: ${groupName}`);
    }
    console.log('');

    // 영향받는 프로젝트 목록
    if (result.affectedProjects.length === 0) {
      console.log('  영향받는 프로젝트가 없습니다.');
      console.log('');
      return;
    }

    console.log('  [영향받는 프로젝트]');
    for (const proj of result.affectedProjects) {
      const color = IMPACT_COLORS[proj.impactLevel] || COLORS.reset;
      console.log(
        `    ${color}[${proj.impactLevel.toUpperCase()}]${COLORS.reset} ${proj.projectName} (${proj.projectId})`,
      );
      console.log(`           API: ${proj.affectedApis.length}개, 컴포넌트: ${proj.affectedComponents}개`);
      console.log(`           ${proj.summary}`);
    }
    console.log('');

    // API 계약 변경 목록
    if (result.apiContractChanges.length > 0) {
      console.log('  [API 계약 변경]');
      for (const change of result.apiContractChanges) {
        const color = SEVERITY_COLORS[change.severity] || COLORS.reset;
        const changeLabel = this.getChangeLabel(change.changeType);
        console.log(
          `    ${color}[${change.severity.toUpperCase()}]${COLORS.reset} ${changeLabel} ${change.apiPath}`,
        );
        if (change.consumers.length > 0) {
          console.log(`           영향 받는 프로젝트: ${change.consumers.join(', ')}`);
        }
      }
      console.log('');
    }

    // 요약 통계
    console.log('  [요약]');
    console.log(`    영향 프로젝트: ${result.affectedProjects.length}개`);
    console.log(`    API 계약 변경: ${result.apiContractChanges.length}건`);

    const criticalCount = result.apiContractChanges.filter(
      (c) => c.severity === 'critical',
    ).length;
    const warningCount = result.apiContractChanges.filter(
      (c) => c.severity === 'warning',
    ).length;
    const infoCount = result.apiContractChanges.filter(
      (c) => c.severity === 'info',
    ).length;

    if (criticalCount > 0) {
      console.log(`    ${COLORS.red}Critical: ${criticalCount}건${COLORS.reset}`);
    }
    if (warningCount > 0) {
      console.log(`    ${COLORS.yellow}Warning: ${warningCount}건${COLORS.reset}`);
    }
    if (infoCount > 0) {
      console.log(`    ${COLORS.cyan}Info: ${infoCount}건${COLORS.reset}`);
    }
    console.log('');
  }

  /**
   * 변경 유형 라벨
   */
  private getChangeLabel(changeType: string): string {
    switch (changeType) {
      case 'add':
        return '[추가]';
      case 'modify':
        return '[수정]';
      case 'remove':
        return '[삭제]';
      default:
        return `[${changeType}]`;
    }
  }

  /**
   * --auto 옵션: 등록된 모든 프로젝트에 대해 자동 탐지 수행
   */
  private async handleAutoDetect(): Promise<CommandResult> {
    const projectsPath = path.join(getImpactDir(), 'projects.json');
    const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
    const projectIds = projectsConfig?.projects?.map(p => p.id) || [];

    if (projectIds.length < 2) {
      logger.header('크로스 프로젝트 자동 탐지');
      console.log('\n  등록된 프로젝트가 2개 미만입니다.');
      console.log('  프로젝트 등록: /impact init <project_path>');
      console.log('');
      return {
        code: ResultCode.SUCCESS,
        message: 'Not enough projects for auto-detect (minimum 2 required).',
        data: { detected: 0, saved: 0, total: 0, byType: {} },
      };
    }

    const indexer = new Indexer();
    const manager = new CrossProjectManager();
    const result = await manager.detectAndSave(indexer, projectIds);

    logger.header('크로스 프로젝트 자동 탐지 결과');
    console.log('');
    console.log(`  대상 프로젝트: ${projectIds.join(', ')}`);
    console.log(`  감지된 의존성: ${result.detected}건`);
    console.log(`  신규 저장:     ${result.saved}건`);
    console.log(`  총 의존성:     ${result.total}건`);

    if (Object.keys(result.byType).length > 0) {
      console.log('');
      console.log('  [타입별 통계]');
      for (const [type, count] of Object.entries(result.byType)) {
        console.log(`    ${type}: ${count}건`);
      }
    }
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `Auto-detect complete: ${result.detected} detected, ${result.saved} new saved.`,
      data: result,
    };
  }

  /**
   * --supplement 옵션: 보완 분석 스캔 및 결과 저장
   */
  private async handleSupplement(): Promise<CommandResult> {
    // --project 옵션으로 대상 프로젝트 ID 파싱
    const projectIdx = this.args.indexOf('--project');
    let projectId: string | undefined;

    if (projectIdx !== -1 && this.args[projectIdx + 1]) {
      projectId = this.args[projectIdx + 1];
    }

    if (!projectId) {
      projectId = (await this.getActiveProjectId()) || undefined;
    }

    if (!projectId) {
      logger.error('프로젝트를 지정해주세요. --project <id> 또는 /impact init을 먼저 실행하세요.');
      return {
        code: ResultCode.NEEDS_CONFIG,
        message: '프로젝트를 지정해주세요.',
      };
    }

    logger.header('보완 분석 스캔');
    console.log(`\n  대상 프로젝트: ${projectId}`);

    // 1. SupplementScanner.scan() 실행
    const scanner = new SupplementScanner();
    const scanResult = await scanner.scan(projectId);

    // auto + suggest 후보 필터
    const targetCandidates = scanResult.candidates.filter(
      c => c.recommendation === 'auto' || c.recommendation === 'suggest',
    );

    if (targetCandidates.length === 0) {
      console.log('\n  보완 분석이 필요한 기존 분석이 없습니다.');
      console.log('');
      return {
        code: ResultCode.SUCCESS,
        message: '보완 분석 대상 없음.',
        data: scanResult,
      };
    }

    // 2. 보완 분석 결과 저장
    const resultManager = new ResultManager();
    const savedPaths: string[] = [];

    for (const candidate of targetCandidates) {
      // 원본 분석 결과 로드
      const originalResult = await resultManager.getById(candidate.projectId, candidate.resultId);
      if (!originalResult) {
        logger.debug(`원본 분석 로드 실패: ${candidate.projectId}/${candidate.resultId}`);
        continue;
      }

      // 보완 분석 결과 생성 (메타데이터 기반, 실제 재분석 없음)
      const supplementResult: ConfidenceEnrichedResult = {
        ...originalResult,
        analysisId: `supplement-${originalResult.analysisId}`,
        supplementOf: originalResult.analysisId,
        triggerProject: projectId,
        specTitle: `[보완] ${originalResult.specTitle}`,
        analyzedAt: new Date().toISOString(),
      };

      const filePath = await resultManager.saveSupplementResult(
        candidate.projectId,
        candidate.resultId,
        supplementResult,
      );
      savedPaths.push(filePath);
    }

    // 3. cross-project.json 갱신을 위해 detectAndSave 재실행
    if (savedPaths.length > 0) {
      try {
        const projectsPath = path.join(getImpactDir(), 'projects.json');
        const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
        const projectIds = projectsConfig?.projects?.map(p => p.id) || [];

        if (projectIds.length >= 2) {
          const indexer = new Indexer();
          const manager = new CrossProjectManager();
          await manager.detectAndSave(indexer, projectIds);
        }
      } catch (err) {
        logger.debug(`cross-project.json 갱신 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 4. 결과 출력
    console.log(`\n  ✓ 보완 분석 ${savedPaths.length}건 저장 완료`);
    for (const filePath of savedPaths) {
      console.log(`    → ${filePath}`);
    }

    // excludedByStatus 출력
    const { completed, onHold, archived } = scanResult.excludedByStatus;
    if (completed > 0 || onHold > 0 || archived > 0) {
      const parts: string[] = [];
      if (completed > 0) parts.push(`completed ${completed}건`);
      if (onHold > 0) parts.push(`on-hold ${onHold}건`);
      if (archived > 0) parts.push(`archived ${archived}건`);
      console.log(`\n  ℹ 상태별 제외: ${parts.join(', ')}`);
    }
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `보완 분석 ${savedPaths.length}건 저장 완료.`,
      data: {
        scanResult,
        savedCount: savedPaths.length,
        savedPaths,
      },
    };
  }

  /**
   * --mermaid 옵션: 크로스 프로젝트 의존성을 Mermaid 다이어그램으로 출력
   */
  private async handleMermaid(): Promise<CommandResult> {
    const manager = new CrossProjectManager();
    const config = await manager.loadConfig();

    const direction = this.args.includes('--tb') ? 'TB' as const : 'LR' as const;
    const output = renderMermaid(config.links, config.groups, { direction });

    // --output <path> 옵션이 있으면 파일로 저장
    const outputIdx = this.args.indexOf('--output');
    if (outputIdx !== -1 && this.args[outputIdx + 1]) {
      const fs = await import('fs');
      const outputPath = this.args[outputIdx + 1];
      fs.writeFileSync(outputPath, output, 'utf-8');
      console.log(`Mermaid 다이어그램이 ${outputPath}에 저장되었습니다.`);
    } else {
      console.log(output);
    }

    return {
      code: ResultCode.SUCCESS,
      message: 'Mermaid 다이어그램 출력 완료.',
      data: { output },
    };
  }

  /**
   * 활성 프로젝트 ID 가져오기
   */
  private async getActiveProjectId(): Promise<string | null> {
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      return configManager.getActiveProject();
    } catch {
      return null;
    }
  }
}
