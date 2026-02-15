/**
 * @module commands/policies
 * @description Policies 명령어 핸들러 - 정책 사전 조회 및 검색
 */

import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { PolicyInfo } from '../types/index';
import { ConfigManager } from '../config/config-manager';
import { readJsonFile, getProjectDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * PoliciesCommand - 정책 관리 명령어
 *
 * 사용법:
 *   /impact policies                    - 전체 정책 목록 조회
 *   /impact policies --search <keyword> - 키워드 검색
 *   /impact policies --system <name>    - 시스템별 필터
 */
export class PoliciesCommand implements Command {
  readonly name = 'policies';
  readonly description = '정책 사전을 조회하거나 검색합니다.';
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

      // 정책 파일 로드
      const policiesPath = path.join(getProjectDir(projectId), 'index', 'policies.json');
      const policies = readJsonFile<PolicyInfo[]>(policiesPath);

      if (!policies || policies.length === 0) {
        logger.header('정책 사전');
        console.log('\n등록된 정책이 없습니다.');
        console.log('프로젝트를 인덱싱하면 코드에서 정책이 자동으로 추출됩니다.');
        console.log('인덱싱: /impact reindex');

        return {
          code: ResultCode.SUCCESS,
          message: 'No policies found.',
          data: { policies: [] },
        };
      }

      // --search 처리
      const searchIdx = this.args.indexOf('--search');
      if (searchIdx !== -1) {
        const keyword = this.args[searchIdx + 1];
        if (!keyword) {
          logger.error('검색 키워드를 지정해주세요.');
          return {
            code: ResultCode.FAILURE,
            message: 'Search keyword is required for --search.',
          };
        }
        return this.handleSearch(policies, keyword);
      }

      // --system 처리
      const systemIdx = this.args.indexOf('--system');
      if (systemIdx !== -1) {
        const systemName = this.args[systemIdx + 1];
        if (!systemName) {
          logger.error('시스템 이름을 지정해주세요.');
          return {
            code: ResultCode.FAILURE,
            message: 'System name is required for --system.',
          };
        }
        return this.handleSystemFilter(policies, systemName);
      }

      // 기본: 전체 목록
      return this.handleList(policies);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`정책 조회 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Policies command failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 전체 정책 목록 조회
   */
  private handleList(policies: PolicyInfo[]): CommandResult {
    logger.header('정책 사전');
    console.log(`\n총 ${policies.length}개의 정책이 등록되어 있습니다.\n`);

    this.displayPolicies(policies);

    return {
      code: ResultCode.SUCCESS,
      message: `Listed ${policies.length} policies.`,
      data: { policies },
    };
  }

  /**
   * 키워드 검색
   */
  private handleSearch(policies: PolicyInfo[], keyword: string): CommandResult {
    const lowerKeyword = keyword.toLowerCase();
    const matched = policies.filter(p =>
      p.name.toLowerCase().includes(lowerKeyword) ||
      p.description.toLowerCase().includes(lowerKeyword) ||
      p.sourceText.toLowerCase().includes(lowerKeyword) ||
      p.category.toLowerCase().includes(lowerKeyword),
    );

    logger.header(`정책 검색: "${keyword}"`);

    if (matched.length === 0) {
      console.log(`\n"${keyword}"에 해당하는 정책을 찾을 수 없습니다.`);
    } else {
      console.log(`\n${matched.length}개의 정책이 검색되었습니다.\n`);
      this.displayPolicies(matched);
    }

    return {
      code: ResultCode.SUCCESS,
      message: `Found ${matched.length} policies for "${keyword}".`,
      data: { policies: matched, keyword },
    };
  }

  /**
   * 시스템별 필터
   */
  private handleSystemFilter(policies: PolicyInfo[], systemName: string): CommandResult {
    const lowerSystem = systemName.toLowerCase();
    const matched = policies.filter(p => {
      // 관련 모듈이나 파일 경로에서 시스템명 매칭
      const moduleMatch = p.relatedModules.some(m => m.toLowerCase().includes(lowerSystem));
      const pathMatch = p.filePath.toLowerCase().includes(lowerSystem);
      const categoryMatch = p.category.toLowerCase().includes(lowerSystem);
      return moduleMatch || pathMatch || categoryMatch;
    });

    logger.header(`정책 필터: 시스템 "${systemName}"`);

    if (matched.length === 0) {
      console.log(`\n"${systemName}" 시스템에 해당하는 정책을 찾을 수 없습니다.`);
    } else {
      console.log(`\n${matched.length}개의 정책이 검색되었습니다.\n`);
      this.displayPolicies(matched);
    }

    return {
      code: ResultCode.SUCCESS,
      message: `Found ${matched.length} policies for system "${systemName}".`,
      data: { policies: matched, systemName },
    };
  }

  /**
   * 정책 목록 표시
   */
  private displayPolicies(policies: PolicyInfo[]): void {
    for (const policy of policies) {
      console.log(`  [${policy.id}] ${policy.name}`);
      console.log(`    카테고리: ${policy.category}`);
      console.log(`    파일: ${policy.filePath}:${policy.lineNumber}`);
      console.log(`    설명: ${policy.description}`);
      if (policy.relatedModules.length > 0) {
        console.log(`    관련 모듈: ${policy.relatedModules.join(', ')}`);
      }
      console.log('');
    }
  }
}
