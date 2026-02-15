/**
 * @module commands/tickets
 * @description Tickets 명령어 핸들러 - 분석 결과에서 작업 티켓 마크다운 파일 생성
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfidenceEnrichedResult, Task } from '../types/analysis';
import { ResultManager } from '../core/analysis/result-manager';
import { ConfigManager } from '../config/config-manager';
import { ensureDir, getProjectDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * TicketsCommand - 티켓 생성 명령어
 *
 * 사용법: /impact tickets [--result-id <id>] [--output <dir>]
 * 기능:
 *   - 분석 결과 기반 작업 티켓 Markdown 파일 생성
 *   - 각 티켓에 유형, 점수, 영향 파일, 의존성 포함
 */
export class TicketsCommand implements Command {
  readonly name = 'tickets';
  readonly description = '분석 결과에서 작업 티켓을 생성합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // 활성 프로젝트 확인
      const configManager = new ConfigManager();
      await configManager.load();
      const projectId = configManager.getActiveProject();

      if (!projectId) {
        logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No active project. Run /impact init first.',
        };
      }

      // 분석 결과 로드
      const resultManager = new ResultManager();
      const resultId = this.getOption('--result-id');
      let result: ConfidenceEnrichedResult | null;

      if (resultId) {
        result = await resultManager.getById(projectId, resultId);
        if (!result) {
          logger.error(`분석 결과를 찾을 수 없습니다: ${resultId}`);
          return {
            code: ResultCode.FAILURE,
            message: `Result not found: ${resultId}`,
          };
        }
      } else {
        result = await resultManager.getLatest(projectId);
        if (!result) {
          logger.error('분석 결과가 없습니다. 먼저 /impact analyze를 실행하세요.');
          return {
            code: ResultCode.FAILURE,
            message: 'No analysis results found. Run /impact analyze first.',
          };
        }
      }

      // 출력 디렉토리 결정
      const customOutput = this.getOption('--output');
      const outputDir = customOutput || path.join(getProjectDir(projectId), 'tickets');
      ensureDir(outputDir);

      // 화면-작업 매핑 생성
      const screenMap = new Map<string, string>();
      for (const screen of result.affectedScreens) {
        for (const task of screen.tasks) {
          screenMap.set(task.id, screen.screenName);
        }
      }

      // 티켓 생성
      const ticketPaths: string[] = [];
      for (const task of result.tasks) {
        const parentScreen = screenMap.get(task.id) || '(미지정)';
        const ticketContent = this.generateTicketMarkdown(task, parentScreen, result);
        const ticketFileName = `${task.id}.md`;
        const ticketPath = path.join(outputDir, ticketFileName);
        fs.writeFileSync(ticketPath, ticketContent, 'utf-8');
        ticketPaths.push(ticketPath);
      }

      // 결과 출력
      logger.header('Impact Checker - 티켓 생성');
      console.log(`\n프로젝트: ${projectId}`);
      console.log(`기획서: ${result.specTitle}`);
      console.log(`생성된 티켓: ${ticketPaths.length}개`);
      console.log(`출력 경로: ${outputDir}`);

      if (ticketPaths.length > 0) {
        console.log('\n생성된 티켓 목록:');
        for (const tp of ticketPaths) {
          console.log(`  - ${path.basename(tp)}`);
        }
      }

      logger.success('티켓 생성이 완료되었습니다!');

      return {
        code: ResultCode.SUCCESS,
        message: `Generated ${ticketPaths.length} tickets.`,
        data: { ticketPaths, outputDir },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`티켓 생성 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Ticket generation failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 작업에서 티켓 마크다운 생성
   */
  private generateTicketMarkdown(
    task: Task,
    parentScreen: string,
    result: ConfidenceEnrichedResult,
  ): string {
    const typeLabel = task.type === 'FE' ? 'FE (프론트엔드)' : 'BE (백엔드)';
    const actionLabel = this.getActionLabel(task.actionType);

    // 해당 작업의 점수 정보 찾기
    const taskScore = this.findTaskScore(task.id, result);
    const scoreDisplay = taskScore ? `${taskScore.toFixed(1)}/10` : '(미산출)';
    const gradeDisplay = this.getGradeFromScore(taskScore);

    // 의존성 추출
    const dependencies = this.findDependencies(task, result);

    let md = `# [${task.type}] ${task.title}\n\n`;
    md += `## 기본 정보\n`;
    md += `- **유형**: ${typeLabel}\n`;
    md += `- **작업**: ${actionLabel}\n`;
    md += `- **점수**: ${scoreDisplay} (${gradeDisplay})\n`;
    md += `- **상위 화면**: ${parentScreen}\n`;
    md += `\n`;

    md += `## 작업 설명\n`;
    md += `${task.rationale}\n`;
    md += `\n`;

    if (task.affectedFiles.length > 0) {
      md += `## 영향 받는 파일\n`;
      for (const file of task.affectedFiles) {
        md += `- ${file}\n`;
      }
      md += `\n`;
    }

    if (taskScore !== null) {
      md += `## 점수 산출 근거\n`;
      md += `- 종합 점수: ${scoreDisplay}\n`;
      md += `\n`;
    }

    if (task.planningChecks.length > 0) {
      md += `## 기획 확인 사항\n`;
      for (const check of task.planningChecks) {
        md += `- [ ] ${check}\n`;
      }
      md += `\n`;
    }

    if (dependencies.length > 0) {
      md += `## 의존성\n`;
      for (const dep of dependencies) {
        md += `- ${dep}\n`;
      }
      md += `\n`;
    }

    return md;
  }

  /**
   * 작업 유형 라벨
   */
  private getActionLabel(actionType: string): string {
    switch (actionType) {
      case 'new':
        return '신규 개발';
      case 'modify':
        return '수정';
      case 'config':
        return '설정 변경';
      default:
        return actionType;
    }
  }

  /**
   * 작업 점수 조회
   */
  private findTaskScore(taskId: string, result: ConfidenceEnrichedResult): number | null {
    if (!result.screenScores) return null;

    for (const screenScore of result.screenScores) {
      for (const ts of screenScore.taskScores) {
        if (ts.taskId === taskId) {
          return ts.totalScore;
        }
      }
    }
    return null;
  }

  /**
   * 점수 기반 등급 결정
   */
  private getGradeFromScore(score: number | null): string {
    if (score === null) return '미정';
    if (score <= 3) return 'Low';
    if (score <= 5) return 'Medium';
    if (score <= 7) return 'High';
    return 'Critical';
  }

  /**
   * 작업의 의존성 추출
   */
  private findDependencies(task: Task, result: ConfidenceEnrichedResult): string[] {
    const deps: string[] = [];

    if (task.relatedApis && task.relatedApis.length > 0) {
      for (const apiId of task.relatedApis) {
        deps.push(`${apiId} (API 의존)`);
      }
    }

    // 같은 화면의 다른 작업에 대한 의존성 (BE 작업이 FE보다 선행)
    for (const screen of result.affectedScreens) {
      const screenTasks = screen.tasks;
      const thisTaskInScreen = screenTasks.find(t => t.id === task.id);
      if (thisTaskInScreen && task.type === 'FE') {
        const beTasks = screenTasks.filter(t => t.type === 'BE' && t.id !== task.id);
        for (const beTask of beTasks) {
          deps.push(`${beTask.id}: ${beTask.title} (BE 작업 선행 필요)`);
        }
      }
    }

    return deps;
  }

  /**
   * 옵션 값 가져오기
   */
  private getOption(name: string): string | undefined {
    const idx = this.args.indexOf(name);
    if (idx !== -1 && this.args[idx + 1]) {
      return this.args[idx + 1];
    }
    return undefined;
  }
}
