/**
 * @module commands/update
 * @description Update 명령어 핸들러 - KIC 도구를 최신 버전으로 업데이트
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { Command, CommandResult, ResultCode } from '../types/common';
import { logger } from '../utils/logger';

/** 업데이트 확인 결과 */
interface UpdateCheckResult {
  /** 업데이트 가능 여부 */
  available: boolean;
  /** 확인 건너뛰기 여부 (네트워크 오류 등) */
  skipped?: boolean;
  /** 건너뛴 사유 */
  reason?: string;
  /** 뒤처진 커밋 수 */
  behind?: number;
  /** 로컬 커밋 해시 */
  localCommit?: string;
  /** 원격 커밋 해시 */
  remoteCommit?: string;
}

/** 업데이트 수행 결과 */
interface UpdatePerformResult {
  /** 성공 여부 */
  success: boolean;
  /** 결과 메시지 */
  message: string;
  /** 업데이트 후 커밋 해시 */
  newCommit?: string;
}

/**
 * UpdateCommand - KIC 업데이트 명령어
 *
 * 사용법: /impact update [--check] [--force]
 * 기능:
 *   - 최신 버전 확인 (기본)
 *   - --check: 업데이트 확인만 수행
 *   - --force: 즉시 업데이트 수행
 */
export class UpdateCommand implements Command {
  readonly name = 'update';
  readonly description = 'KIC 도구를 최신 버전으로 업데이트합니다.';
  private readonly args: string[];

  /** 패키지 루트 디렉토리 */
  private readonly skillDir: string;

  constructor(args: string[]) {
    this.args = args;
    this.skillDir = path.resolve(__dirname, '..', '..');
  }

  async execute(): Promise<CommandResult> {
    const isCheckOnly = this.args.includes('--check');
    const isForce = this.args.includes('--force');

    try {
      logger.header('Impact Checker - 업데이트');

      // 업데이트 확인
      const checkResult = await this.checkForUpdate();

      if (checkResult.skipped) {
        const message = `업데이트 확인을 건너뜁니다: ${checkResult.reason}`;
        logger.warn(message);
        return {
          code: ResultCode.SUCCESS,
          message,
          data: { skipped: true, reason: checkResult.reason },
        };
      }

      if (!checkResult.available) {
        const message = `KIC가 최신 상태입니다. (${checkResult.localCommit?.substring(0, 7)})`;
        logger.success(message);
        return {
          code: ResultCode.SUCCESS,
          message,
          data: { upToDate: true, commit: checkResult.localCommit },
        };
      }

      // 업데이트 가능 상태
      const statusMessage =
        `KIC 업데이트 가능: ${checkResult.behind}개 커밋 뒤처짐\n` +
        `현재: ${checkResult.localCommit?.substring(0, 7)}\n` +
        `최신: ${checkResult.remoteCommit?.substring(0, 7)}`;

      if (isCheckOnly) {
        logger.info(statusMessage);
        return {
          code: ResultCode.SUCCESS,
          message: statusMessage,
          data: {
            available: true,
            behind: checkResult.behind,
            localCommit: checkResult.localCommit,
            remoteCommit: checkResult.remoteCommit,
          },
        };
      }

      if (!isForce) {
        // 기본 모드: 업데이트 가능 여부만 표시
        logger.info(statusMessage);
        console.log('\n업데이트를 수행하려면 --force 옵션을 사용하세요:');
        console.log('  /impact update --force\n');
        return {
          code: ResultCode.SUCCESS,
          message: statusMessage,
          data: {
            available: true,
            behind: checkResult.behind,
            localCommit: checkResult.localCommit,
            remoteCommit: checkResult.remoteCommit,
          },
        };
      }

      // --force: 즉시 업데이트 수행
      logger.info('업데이트를 시작합니다...');
      const updateResult = await this.performUpdate();

      if (updateResult.success) {
        const message = `KIC 업데이트 완료. (${updateResult.newCommit?.substring(0, 7)})`;
        logger.success(message);
        return {
          code: ResultCode.SUCCESS,
          message,
          data: { updated: true, newCommit: updateResult.newCommit },
        };
      } else {
        logger.error(`업데이트 실패: ${updateResult.message}`);
        return {
          code: ResultCode.FAILURE,
          message: updateResult.message,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`업데이트 중 오류 발생: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `업데이트 실패: ${errorMsg}`,
      };
    }
  }

  /**
   * 업데이트 가능 여부 확인
   * Git fetch 후 로컬과 원격 브랜치 비교
   */
  private async checkForUpdate(): Promise<UpdateCheckResult> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(this.skillDir);

      // 타임아웃 5초로 fetch
      await Promise.race([
        git.fetch('origin'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('fetch timeout (5s)')), 5000),
        ),
      ]);

      const status = await git.status();
      const behind = status.behind;

      // 로컬 커밋 해시
      const localLog = await git.log({ maxCount: 1 });
      const localCommit = localLog.latest?.hash || 'unknown';

      if (behind === 0) {
        return {
          available: false,
          localCommit,
        };
      }

      // 원격 최신 커밋 해시
      const remoteLog = await git.log({ maxCount: 1, from: 'origin/main' });
      const remoteCommit = remoteLog.latest?.hash || 'unknown';

      return {
        available: true,
        behind,
        localCommit,
        remoteCommit,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        skipped: true,
        reason,
      };
    }
  }

  /**
   * 업데이트 수행
   * git pull → npm install → npm run build
   */
  private async performUpdate(): Promise<UpdatePerformResult> {
    try {
      // Step 1: git pull
      logger.info('1/3 소스 코드 업데이트 중...');
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(this.skillDir);
      await git.pull('origin', 'main');

      // Step 2: npm install
      logger.info('2/3 의존성 설치 중...');
      execSync('npm install --production', {
        cwd: this.skillDir,
        timeout: 60000,
        stdio: 'pipe',
      });

      // Step 3: npm run build
      logger.info('3/3 빌드 중...');
      execSync('npm run build', {
        cwd: this.skillDir,
        timeout: 60000,
        stdio: 'pipe',
      });

      // 업데이트 후 커밋 해시 조회
      const log = await git.log({ maxCount: 1 });
      const newCommit = log.latest?.hash || 'unknown';

      return {
        success: true,
        message: `KIC 업데이트 완료. (${newCommit.substring(0, 7)})`,
        newCommit,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `업데이트 수행 실패: ${errorMsg}`,
      };
    }
  }
}
