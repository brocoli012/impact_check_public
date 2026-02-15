/**
 * @module commands/owners
 * @description Owners 명령어 핸들러 - 시스템별 담당자 관리
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { logger } from '../utils/logger';

/**
 * OwnersCommand - 담당자 관리 명령어
 *
 * 사용법: /impact owners [--add] [--edit <system>] [--remove <system>]
 * 기능:
 *   - 시스템별 담당자 목록 조회
 *   - 담당자 추가 / 수정 / 삭제
 */
export class OwnersCommand implements Command {
  readonly name = 'owners';
  readonly description = '시스템별 담당자 및 팀 정보를 관리합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    logger.info('[Owners] Not implemented yet.');
    console.log('\n[Phase 1 Stub] owners 명령어는 아직 구현되지 않았습니다.');

    if (this.args.includes('--add')) {
      console.log('담당자 추가 기능이 요청되었습니다.');
    }

    const editIndex = this.args.indexOf('--edit');
    if (editIndex !== -1 && this.args[editIndex + 1]) {
      console.log(`담당자 수정 요청: ${this.args[editIndex + 1]}`);
    }

    const removeIndex = this.args.indexOf('--remove');
    if (removeIndex !== -1 && this.args[removeIndex + 1]) {
      console.log(`담당자 삭제 요청: ${this.args[removeIndex + 1]}`);
    }

    return {
      code: ResultCode.SUCCESS,
      message: 'Owners command stub executed.',
    };
  }
}
