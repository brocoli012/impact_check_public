/**
 * @module commands/status
 * @description Status 명령어 핸들러 - 등록된 프로젝트 상태 요약 표시
 */

import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ProjectsConfig } from '../types/index';
import { ResultManager, ResultSummary } from '../core/analysis/result-manager';
import { readJsonFile, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';

/** 프로젝트별 요약 정보 */
interface ProjectStatusInfo {
  /** 프로젝트 ID */
  id: string;
  /** 프로젝트 이름 */
  name: string;
  /** 프로젝트 경로 */
  projectPath: string;
  /** 분석 건수 */
  analysisCount: number;
  /** 최근 분석 정보 */
  latestAnalysis?: {
    grade: string;
    totalScore: number;
    analyzedAt: string;
  };
  /** 활성 프로젝트 여부 */
  isActive: boolean;
}

/** 최근 분석 정보 (전체 프로젝트 합산) */
interface RecentAnalysis {
  /** 프로젝트 ID */
  projectId: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** 분석 요약 */
  summary: ResultSummary;
}

/**
 * StatusCommand - 프로젝트 상태 요약 명령어
 *
 * 사용법: /impact status
 * 기능:
 *   - 등록된 프로젝트 목록 및 상태 요약
 *   - 프로젝트별 분석 건수, 최근 분석 등급/점수/날짜
 *   - 최근 분석 5건 (전체 프로젝트 합산)
 *   - 프로젝트 수에 따른 출력 형식 분기
 */
export class StatusCommand implements Command {
  readonly name = 'status';
  readonly description = '등록된 프로젝트 상태 요약을 표시합니다.';

  constructor(_args: string[]) {
  }

  async execute(): Promise<CommandResult> {
    try {
      // 1. projects.json 읽기
      const impactDir = getImpactDir();
      const projectsPath = path.join(impactDir, 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);

      if (!projectsConfig || !projectsConfig.projects || projectsConfig.projects.length === 0) {
        const message = '등록된 프로젝트가 없습니다.';
        logger.info(message);
        console.log(`\n${message}`);
        console.log('프로젝트를 등록하려면: /impact init <project_path>\n');
        return {
          code: ResultCode.SUCCESS,
          message,
          data: { projectCount: 0 },
        };
      }

      const activeProjectId = projectsConfig.activeProject;
      const resultManager = new ResultManager();

      // 2. 각 프로젝트별 요약 수집
      const projectStatuses: ProjectStatusInfo[] = [];
      const allRecentAnalyses: RecentAnalysis[] = [];

      for (const project of projectsConfig.projects) {
        const summaries = await resultManager.list(project.id);

        // 최신순 정렬
        const sorted = [...summaries].sort(
          (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime(),
        );

        const statusInfo: ProjectStatusInfo = {
          id: project.id,
          name: project.name,
          projectPath: project.path,
          analysisCount: summaries.length,
          isActive: project.id === activeProjectId,
        };

        if (sorted.length > 0) {
          statusInfo.latestAnalysis = {
            grade: sorted[0].grade,
            totalScore: sorted[0].totalScore,
            analyzedAt: sorted[0].analyzedAt,
          };
        }

        projectStatuses.push(statusInfo);

        // 전체 합산을 위해 모든 분석 결과 수집
        for (const summary of summaries) {
          allRecentAnalyses.push({
            projectId: project.id,
            projectName: project.name,
            summary,
          });
        }
      }

      // 3. 출력
      logger.header('Impact Checker - 프로젝트 상태');

      const projectCount = projectStatuses.length;

      if (projectCount < 7) {
        this.renderList(projectStatuses);
      } else {
        this.renderTable(projectStatuses);
      }

      // 4. 최근 분석 5건 (전체 프로젝트 합산, analyzedAt 내림차순)
      if (allRecentAnalyses.length > 0) {
        const recent = allRecentAnalyses
          .sort(
            (a, b) =>
              new Date(b.summary.analyzedAt).getTime() -
              new Date(a.summary.analyzedAt).getTime(),
          )
          .slice(0, 5);

        console.log('\n최근 분석 (최대 5건):');
        logger.separator();
        for (const item of recent) {
          const date = new Date(item.summary.analyzedAt).toLocaleDateString('ko-KR');
          console.log(
            `  [${item.summary.grade}] ${item.summary.specTitle} ` +
            `(${item.projectName}, ${item.summary.totalScore}점, ${date})`,
          );
        }
        console.log('');
      }

      return {
        code: ResultCode.SUCCESS,
        message: `${projectCount}개 프로젝트 상태 조회 완료.`,
        data: {
          projectCount,
          projects: projectStatuses,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`상태 조회 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Status command failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 리스트 형식 출력 (1~6개 프로젝트)
   */
  private renderList(projects: ProjectStatusInfo[]): void {
    console.log(`\n등록된 프로젝트 (${projects.length}개):\n`);

    for (const p of projects) {
      const activeMarker = p.isActive ? ' *' : '';
      const analysisInfo = p.latestAnalysis
        ? `최근: [${p.latestAnalysis.grade}] ${p.latestAnalysis.totalScore}점 ` +
          `(${new Date(p.latestAnalysis.analyzedAt).toLocaleDateString('ko-KR')})`
        : '분석 없음';

      console.log(`  ${p.name}${activeMarker} (${p.id})`);
      console.log(`    경로: ${p.projectPath}`);
      console.log(`    분석: ${p.analysisCount}건 | ${analysisInfo}`);
      console.log('');
    }
  }

  /**
   * 테이블 형식 출력 (7개+ 프로젝트)
   */
  private renderTable(projects: ProjectStatusInfo[]): void {
    console.log(`\n등록된 프로젝트 (${projects.length}개):\n`);

    // 헤더
    const header = [
      ''.padEnd(2),
      '프로젝트'.padEnd(20),
      '분석'.padEnd(6),
      '등급'.padEnd(6),
      '점수'.padEnd(8),
      '최근 분석일',
    ].join(' ');

    console.log(header);
    logger.separator();

    for (const p of projects) {
      const activeMarker = p.isActive ? '* ' : '  ';
      const name = p.name.length > 18 ? p.name.substring(0, 17) + '...' : p.name.padEnd(20);
      const count = String(p.analysisCount).padEnd(6);
      const grade = (p.latestAnalysis?.grade || '-').padEnd(6);
      const score = (p.latestAnalysis ? String(p.latestAnalysis.totalScore) : '-').padEnd(8);
      const date = p.latestAnalysis
        ? new Date(p.latestAnalysis.analyzedAt).toLocaleDateString('ko-KR')
        : '-';

      console.log(`${activeMarker}${name} ${count} ${grade} ${score} ${date}`);
    }

    console.log('');
    console.log('  * = 활성 프로젝트');
    console.log('');
  }
}
