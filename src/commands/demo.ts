/**
 * @module commands/demo
 * @description Demo 명령어 핸들러 - 샘플 데이터 기반으로 도구를 체험
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { logger } from '../utils/logger';

/**
 * DemoCommand - 데모 체험 명령어
 *
 * 사용법: /impact demo
 * 기능:
 *   - 샘플 프로젝트 인덱스 로드
 *   - 샘플 기획서로 분석 실행
 *   - 결과 시각화 체험
 */
export class DemoCommand implements Command {
  readonly name = 'demo';
  readonly description = '샘플 데이터 기반으로 도구를 체험합니다.';
  constructor(_args: string[]) {
    // Args reserved for future use
  }

  async execute(): Promise<CommandResult> {
    logger.info('[Demo] Not implemented yet.');
    console.log('\n[Phase 1 Stub] demo 명령어는 아직 구현되지 않았습니다.');
    console.log('샘플 데이터 기반 체험 기능은 Phase 2에서 구현됩니다.');

    return {
      code: ResultCode.SUCCESS,
      message: 'Demo command stub executed.',
    };
  }
}
