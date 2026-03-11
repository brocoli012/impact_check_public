/**
 * @module commands/generate-review
 * @description Generate Review 명령어 핸들러 - 분석 결과에서 Markdown 리뷰 결과서 생성 (REQ-018-A1, B2)
 *
 * 사용법: /impact generate-review [--project <id>] [--analysis <analysisId>] [--output <path>]
 *                                  [--sections <s1,s2,...>] [--force]
 *                                  [--multi] [--projects <id1,id2,...>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import {
  ReviewSectionType,
  ALL_SECTION_TYPES,
  GeneratedReview,
  ProjectReviewInput,
} from '../types/review';
import { ConfigManager } from '../config/config-manager';
import { ResultManager } from '../core/analysis/result-manager';
import { ReviewDocumentGenerator } from '../core/review/review-generator';
import { MultiProjectReviewGenerator } from '../core/review/multi-project-review-generator';
import { ensureDir, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * GenerateReviewCommand - 리뷰 결과서 생성 명령어
 */
export class GenerateReviewCommand implements Command {
  readonly name = 'generate-review';
  readonly description = '분석 결과에서 Markdown 리뷰 결과서를 생성합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // Check for multi-project mode
      const isMulti = this.args.includes('--multi') || this.args.includes('-m');
      if (isMulti) {
        return this.executeMultiProject();
      }

      return this.executeSingleProject();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`리뷰 결과서 생성 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Generate review failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Execute single-project review generation (existing behavior)
   */
  private async executeSingleProject(): Promise<CommandResult> {
    logger.header('KIC - 리뷰 결과서 생성기');

    // 1. Resolve project ID
    const projectId = await this.resolveProjectId();
    if (!projectId) {
      logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
      return {
        code: ResultCode.NEEDS_INDEX,
        message: 'No active project. Run /impact init first.',
      };
    }

    // 2. Load analysis result
    const resultManager = new ResultManager();
    const analysisId = this.getOption('--analysis') || this.getOption('-a');

    logger.info(`[1/3] 분석 결과 로드 중...`);
    logger.info(`       > 프로젝트: ${projectId}`);

    const result = analysisId
      ? await resultManager.getById(projectId, analysisId)
      : await resultManager.getLatest(projectId);

    if (!result) {
      const msg = analysisId
        ? `분석 ID '${analysisId}'를 찾을 수 없습니다.`
        : `프로젝트 '${projectId}'에 저장된 분석 결과가 없습니다. 먼저 /impact save-result를 실행하세요.`;
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    logger.info(`       > 분석 ID: ${result.analysisId}`);
    logger.info(`       > 기획서: ${result.specTitle}`);

    // 3. Parse sections option
    const sectionsOpt = this.getOption('--sections') || this.getOption('-s');
    let includeSections: ReviewSectionType[] | undefined;
    if (sectionsOpt) {
      const requested = sectionsOpt.split(',').map(s => s.trim()) as ReviewSectionType[];
      const invalid = requested.filter(s => !ALL_SECTION_TYPES.includes(s));
      if (invalid.length > 0) {
        const msg = `알 수 없는 섹션: '${invalid.join(', ')}'. 사용 가능한 섹션: ${ALL_SECTION_TYPES.join(', ')}`;
        logger.error(msg);
        return { code: ResultCode.FAILURE, message: msg };
      }
      includeSections = requested;
    }

    // 4. Determine output path
    const outputOpt = this.getOption('--output') || this.getOption('-o');
    const outputPath = outputOpt || this.getDefaultOutputPath(projectId);
    const force = this.args.includes('--force') || this.args.includes('-f');

    // Check if file already exists
    if (fs.existsSync(outputPath) && !force) {
      const msg = `파일이 이미 존재합니다: ${outputPath}. 덮어쓰려면 --force 옵션을 사용하세요.`;
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    // 5. Generate review
    logger.info(`[2/3] 섹션 생성 중...`);

    const generator = new ReviewDocumentGenerator({
      projectId,
      analysisId: result.analysisId,
      includeSections,
    });

    const reviewDoc = generator.generate(result);

    // Log section results
    for (const sr of reviewDoc.sections) {
      const status = sr.success ? 'OK' : `SKIP (${sr.skipReason || '데이터 없음'})`;
      const itemInfo = sr.itemCount ? ` (${sr.itemCount}건)` : '';
      const sectionName = (sr.type as string).padEnd(25, '.');
      logger.info(`       > ${sectionName} ${status}${itemInfo}`);
    }

    // 6. Write output file
    logger.info(`[3/3] 파일 저장 중...`);
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, reviewDoc.markdown, 'utf-8');

    const lineCount = reviewDoc.markdown.split('\n').length;
    const renderedCount = reviewDoc.sections.filter(s => s.success).length;
    const skippedCount = reviewDoc.sections.filter(s => !s.success).length;

    logger.info(`       > 경로: ${outputPath}`);
    logger.success(`리뷰 결과서 생성 완료`);
    console.log(`  - 파일: ${outputPath}`);
    console.log(`  - 섹션: ${renderedCount}개 (${skippedCount}개 조건부 스킵)`);
    console.log(`  - 라인: 약 ${lineCount}줄`);

    const generatedReview: GeneratedReview = {
      filePath: outputPath,
      generatedAt: new Date().toISOString(),
      sourceAnalysisId: result.analysisId,
      sourceProjectIds: [projectId],
      sections: reviewDoc.metadata.sections,
      skippedSections: reviewDoc.sections
        .filter(s => !s.success)
        .map(s => ({ section: s.type, reason: s.skipReason || '데이터 없음' })),
      totalLines: lineCount,
    };

    return {
      code: ResultCode.SUCCESS,
      message: `Review generated: ${outputPath}`,
      data: generatedReview,
    };
  }

  /**
   * Execute multi-project unified review generation (REQ-018-B2)
   */
  private async executeMultiProject(): Promise<CommandResult> {
    logger.header('KIC - 통합 리뷰 결과서 생성기');

    // 1. Resolve project IDs
    const projectsOpt = this.getOption('--projects');
    if (!projectsOpt) {
      const msg = '통합 리뷰 대상 프로젝트를 지정해주세요: --projects <id1,id2,...>';
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    const projectIds = projectsOpt.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (projectIds.length === 0) {
      const msg = '통합 리뷰 대상 프로젝트를 지정해주세요: --projects <id1,id2,...>';
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    // 2. Load analysis results for each project
    const resultManager = new ResultManager();
    const inputs: ProjectReviewInput[] = [];
    const failedProjects: string[] = [];

    logger.info(`[1/4] 프로젝트별 분석 결과 로드 중...`);

    for (const pid of projectIds) {
      const result = await resultManager.getLatest(pid);
      if (result) {
        inputs.push({ projectId: pid, result });
        logger.info(`       > ${pid.padEnd(25, '.')} OK (${result.analysisId})`);
      } else {
        failedProjects.push(pid);
        logger.info(`       > ${pid.padEnd(25, '.')} SKIP (분석 결과 없음)`);
      }
    }

    if (inputs.length === 0) {
      const msg = `지정된 프로젝트에 저장된 분석 결과가 없습니다: ${projectIds.join(', ')}`;
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    if (failedProjects.length > 0) {
      logger.info(`       > ${failedProjects.length}개 프로젝트 스킵됨: ${failedProjects.join(', ')}`);
    }

    // 3. Calculate totals
    const totalTasks = inputs.reduce((sum, i) => sum + i.result.tasks.length, 0);
    logger.info(`[2/4] 통합 영향도 산출 중...`);
    logger.info(`       > 총 프로젝트: ${inputs.length}개`);
    logger.info(`       > 총 태스크: ${totalTasks}건`);

    // 4. Generate unified review
    logger.info(`[3/4] 섹션 생성 중...`);

    const specTitle = inputs[0].result.specTitle;
    const generator = new MultiProjectReviewGenerator(specTitle);
    const reviewDoc = generator.generate(inputs);

    // 5. Determine output path
    const outputOpt = this.getOption('--output') || this.getOption('-o');
    const outputPath = outputOpt || this.getMultiOutputPath();
    const force = this.args.includes('--force') || this.args.includes('-f');

    if (fs.existsSync(outputPath) && !force) {
      const msg = `파일이 이미 존재합니다: ${outputPath}. 덮어쓰려면 --force 옵션을 사용하세요.`;
      logger.error(msg);
      return { code: ResultCode.FAILURE, message: msg };
    }

    // 6. Write output file
    logger.info(`[4/4] 파일 저장 중...`);
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, reviewDoc.markdown, 'utf-8');

    const lineCount = reviewDoc.markdown.split('\n').length;

    logger.info(`       > 경로: ${outputPath}`);
    logger.success(`통합 리뷰 결과서 생성 완료`);
    console.log(`  - 파일: ${outputPath}`);
    console.log(`  - 프로젝트: ${inputs.length}개`);
    console.log(`  - 라인: 약 ${lineCount}줄`);

    const generatedReview: GeneratedReview = {
      filePath: outputPath,
      generatedAt: new Date().toISOString(),
      sourceAnalysisId: inputs.map(i => i.result.analysisId).join(','),
      sourceProjectIds: inputs.map(i => i.projectId),
      sections: reviewDoc.metadata.sections,
      skippedSections: [],
      totalLines: lineCount,
    };

    return {
      code: ResultCode.SUCCESS,
      message: `Multi-project review generated: ${outputPath}`,
      data: generatedReview,
    };
  }

  /**
   * Resolve project ID from --project flag or active project
   */
  private async resolveProjectId(): Promise<string | null> {
    const explicit = this.getOption('--project') || this.getOption('-p');
    if (explicit) return explicit;

    const configManager = new ConfigManager();
    await configManager.load();
    return configManager.getActiveProject();
  }

  /**
   * Get default output path based on project and timestamp
   */
  private getDefaultOutputPath(projectId: string): string {
    const docsDir = path.join(getImpactDir(), 'docs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return path.join(docsDir, `${projectId}-review-${timestamp}.md`);
  }

  /**
   * Get default output path for multi-project review
   */
  private getMultiOutputPath(): string {
    const docsDir = path.join(getImpactDir(), 'docs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return path.join(docsDir, `multi-review-${timestamp}.md`);
  }

  /**
   * Extract option value from args
   */
  private getOption(flag: string): string | undefined {
    const idx = this.args.indexOf(flag);
    if (idx >= 0 && idx + 1 < this.args.length) {
      return this.args[idx + 1];
    }
    return undefined;
  }
}
