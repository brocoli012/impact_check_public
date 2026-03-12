/**
 * @module commands/release-note
 * @description Release Note 명령어 핸들러 - git log 기반 릴리즈 노트 자동 생성
 *
 * 사용법: /impact release-note [--from <commit>] [--to <commit>] [--version <ver>]
 *                                [--output <path>] [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ReleaseNoteOptions } from '../types/review';
import { ReleaseNoteGenerator } from '../core/review/release-note-generator';
import { ensureDir, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * ReleaseNoteCommand - 릴리즈 노트 자동 생성 명령어
 *
 * 사용법: /impact release-note
 * 옵션:
 *   --from <commit>   시작 커밋 (기본: 마지막 태그 또는 마지막 릴리즈 노트 기준)
 *   --to <commit>     종료 커밋 (기본: HEAD)
 *   --version <ver>   버전 문자열 (예: "REQ-020 릴리스")
 *   --output <path>   출력 파일 경로 (기본: ~/.impact/docs/release-notes/kic-update-{date}.md)
 *   --dry-run         미리보기만 (파일 저장 안 함)
 *   --no-qa           QA 현황 섹션 제외
 */
export class ReleaseNoteCommand implements Command {
  readonly name = 'release-note';
  readonly description = 'git log 기반으로 릴리즈 노트를 자동 생성합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      logger.header('KIC - 릴리즈 노트 생성기');

      // 1. 옵션 파싱
      const options = this.parseOptions();

      logger.info(`[1/3] git log 분석 중...`);
      if (options.previousCommit) {
        logger.info(`       > from: ${options.previousCommit}`);
      }
      logger.info(`       > to: ${options.currentCommit || 'HEAD'}`);

      // 2. 릴리즈 노트 생성
      const generator = new ReleaseNoteGenerator();
      const markdown = generator.generate(options);

      const lineCount = markdown.split('\n').length;
      logger.info(`[2/3] 릴리즈 노트 생성 완료`);
      logger.info(`       > 라인: 약 ${lineCount}줄`);

      // 3. dry-run 또는 파일 저장
      if (options.dryRun) {
        logger.info(`[3/3] dry-run 모드 - 미리보기:`);
        console.log('\n' + '='.repeat(60));
        console.log(markdown);
        console.log('='.repeat(60) + '\n');

        return {
          code: ResultCode.SUCCESS,
          message: 'Release note preview generated (dry-run mode).',
          data: { lineCount, dryRun: true, markdown },
        };
      }

      // 출력 경로 결정
      const outputPath = options.outputPath || this.getDefaultOutputPath();

      logger.info(`[3/3] 파일 저장 중...`);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, markdown, 'utf-8');

      logger.info(`       > 경로: ${outputPath}`);
      logger.success('릴리즈 노트 생성 완료');
      console.log(`  - 파일: ${outputPath}`);
      console.log(`  - 라인: 약 ${lineCount}줄`);

      return {
        code: ResultCode.SUCCESS,
        message: `Release note generated: ${outputPath}`,
        data: { outputPath, lineCount, dryRun: false },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`릴리즈 노트 생성 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Release note generation failed: ${errorMsg}`,
      };
    }
  }

  /**
   * CLI 인자를 ReleaseNoteOptions로 파싱
   */
  private parseOptions(): ReleaseNoteOptions {
    const options: ReleaseNoteOptions = {};

    options.previousCommit = this.getOption('--from');
    options.currentCommit = this.getOption('--to');
    options.version = this.getOption('--version');
    options.outputPath = this.getOption('--output') || this.getOption('-o');
    options.date = this.getOption('--date');
    options.dryRun = this.args.includes('--dry-run');
    options.includeQA = !this.args.includes('--no-qa');

    return options;
  }

  /**
   * 기본 출력 경로 생성
   */
  private getDefaultOutputPath(): string {
    const docsDir = path.join(getImpactDir(), 'docs', 'release-notes');
    const date = new Date().toISOString().substring(0, 10);
    return path.join(docsDir, `kic-update-${date}.md`);
  }

  /**
   * CLI 인자에서 옵션 값 추출
   */
  private getOption(flag: string): string | undefined {
    const idx = this.args.indexOf(flag);
    if (idx >= 0 && idx + 1 < this.args.length) {
      return this.args[idx + 1];
    }
    return undefined;
  }
}
