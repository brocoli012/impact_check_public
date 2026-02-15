/**
 * @module commands/view
 * @description View 명령어 핸들러 - 분석 결과 시각화 웹을 실행
 */

import * as os from 'os';
import { exec } from 'child_process';
import { Command, CommandResult, ResultCode } from '../types/common';
import { startServer, stopServer, isServerRunning } from '../server/web-server';
import { ConfigManager } from '../config/config-manager';
import { ResultManager } from '../core/analysis/result-manager';
import { logger } from '../utils/logger';

/**
 * 브라우저에서 URL을 열기 (OS별 처리)
 * @param url - 열 URL
 */
function openBrowser(url: string): void {
  const platform = os.platform();
  let command: string;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (err) => {
    if (err) {
      logger.warn(`Could not open browser automatically. Please visit: ${url}`);
    }
  });
}

/**
 * ViewCommand - 시각화 웹 서버 명령어
 *
 * 사용법: /impact view [--stop]
 * 기능:
 *   - Express.js 웹 서버 시작
 *   - React SPA 정적 파일 서빙
 *   - 브라우저 자동 열기
 */
export class ViewCommand implements Command {
  readonly name = 'view';
  readonly description = '분석 결과 시각화 웹을 실행합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const isStop = this.args.includes('--stop');

    if (isStop) {
      return this.handleStop();
    }

    return this.handleStart();
  }

  /**
   * 서버 시작 처리
   */
  private async handleStart(): Promise<CommandResult> {
    // 이미 실행 중인지 확인
    if (isServerRunning()) {
      console.log('\n웹 서버가 이미 실행 중입니다.');
      console.log('중지하려면: /impact view --stop');

      return {
        code: ResultCode.SUCCESS,
        message: 'Web server is already running.',
      };
    }

    // 분석 결과가 있는지 확인
    const configManager = new ConfigManager();
    await configManager.load();
    const projectId = configManager.getActiveProject();

    if (!projectId) {
      console.log('\n활성 프로젝트가 없습니다.');
      console.log('먼저 프로젝트를 초기화해주세요: /impact init');

      return {
        code: ResultCode.NEEDS_CONFIG,
        message: 'No active project found.',
      };
    }

    // 결과 존재 여부 확인
    const resultManager = new ResultManager();
    const results = await resultManager.list(projectId);

    if (results.length === 0) {
      console.log('\n분석 결과가 없습니다.');
      console.log('먼저 분석을 실행해주세요: /impact analyze <spec-file>');
      console.log('\n결과 없이 대시보드를 확인하시려면 데모 데이터로 표시합니다.');
    }

    // 설정에서 포트 가져오기
    const config = configManager.getConfig();
    const preferredPort = config.general.webPort || 3847;

    try {
      const port = await startServer(undefined, preferredPort);
      const url = `http://localhost:${port}`;

      console.log(`\n시각화 웹 서버가 시작되었습니다.`);
      console.log(`URL: ${url}`);
      console.log(`\n중지하려면: /impact view --stop`);

      // 브라우저 자동 열기
      openBrowser(url);

      return {
        code: ResultCode.SUCCESS,
        message: `Web server started at ${url}`,
        data: { port, url },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start web server:', error);
      console.log(`\n웹 서버 시작에 실패했습니다: ${errMsg}`);

      return {
        code: ResultCode.FAILURE,
        message: `Failed to start web server: ${errMsg}`,
      };
    }
  }

  /**
   * 서버 중지 처리
   */
  private async handleStop(): Promise<CommandResult> {
    if (!isServerRunning()) {
      console.log('\n실행 중인 웹 서버가 없습니다.');

      return {
        code: ResultCode.SUCCESS,
        message: 'No web server is running.',
      };
    }

    try {
      await stopServer();
      console.log('\n웹 서버가 중지되었습니다.');

      return {
        code: ResultCode.SUCCESS,
        message: 'Web server stopped.',
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to stop web server:', error);

      return {
        code: ResultCode.FAILURE,
        message: `Failed to stop web server: ${errMsg}`,
      };
    }
  }
}
