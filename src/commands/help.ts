/**
 * @module commands/help
 * @description Help 명령어 핸들러 - 도움말 표시 및 FAQ 조회
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { logger } from '../utils/logger';

/** 명령어별 도움말 정보 */
const COMMAND_HELP: Record<string, { usage: string; description: string; examples: string[] }> = {
  init: {
    usage: '/impact init <project_path>',
    description: '프로젝트를 등록하고 코드 인덱싱을 수행합니다.',
    examples: ['/impact init /path/to/project', '/impact init .'],
  },
  analyze: {
    usage: '/impact analyze [--file <path>]',
    description: '기획서를 입력받아 영향도를 분석합니다.',
    examples: ['/impact analyze --file plan.pdf', '/impact analyze'],
  },
  view: {
    usage: '/impact view [--stop]',
    description: '분석 결과 시각화 웹을 실행합니다.',
    examples: ['/impact view', '/impact view --stop'],
  },
  tickets: {
    usage: '/impact tickets [--create] [--detail <id>]',
    description: '작업 티켓을 조회하거나 생성합니다.',
    examples: ['/impact tickets', '/impact tickets --create', '/impact tickets --detail T-001'],
  },
  config: {
    usage: '/impact config [--provider <name>] [--key <api_key>]',
    description: 'LLM 프로바이더 및 API 키를 설정합니다.',
    examples: ['/impact config', '/impact config --provider anthropic --key sk-ant-xxxxx'],
  },
  reindex: {
    usage: '/impact reindex [--full]',
    description: '코드 인덱스를 수동으로 갱신합니다.',
    examples: ['/impact reindex', '/impact reindex --full'],
  },
  policies: {
    usage: '/impact policies [--search <keyword>] [add <content>]',
    description: '정책 사전을 조회하거나 새 정책을 등록합니다.',
    examples: ['/impact policies', '/impact policies --search 배송'],
  },
  owners: {
    usage: '/impact owners [--add] [--edit <system>] [--remove <system>]',
    description: '시스템별 담당자 및 팀 정보를 관리합니다.',
    examples: ['/impact owners', '/impact owners --add'],
  },
  annotations: {
    usage: '/impact annotations [generate [path]] [view [path]]',
    description: '보강 주석을 생성하거나 기존 보강 주석을 조회합니다.',
    examples: ['/impact annotations generate', '/impact annotations view'],
  },
  projects: {
    usage: '/impact projects [--switch <name>] [--remove <name>] [--archive <name>]',
    description: '멀티 프로젝트를 관리합니다.',
    examples: ['/impact projects', '/impact projects --switch my-project'],
  },
  demo: {
    usage: '/impact demo',
    description: '샘플 데이터 기반으로 도구를 체험합니다.',
    examples: ['/impact demo'],
  },
  help: {
    usage: '/impact help [command]',
    description: '도움말을 표시합니다.',
    examples: ['/impact help', '/impact help analyze'],
  },
};

/**
 * HelpCommand - 도움말 명령어
 *
 * 사용법: /impact help [command]
 * 기능:
 *   - 전체 명령어 목록 표시
 *   - 개별 명령어 상세 도움말
 *   - FAQ 조회
 */
export class HelpCommand implements Command {
  readonly name = 'help';
  readonly description = '도움말을 표시합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const targetCommand = this.args[0];

    if (targetCommand && COMMAND_HELP[targetCommand]) {
      this.showCommandHelp(targetCommand);
    } else if (targetCommand) {
      logger.warn(`'${targetCommand}' 명령어를 찾을 수 없습니다.`);
      this.showAllCommands();
    } else {
      this.showAllCommands();
    }

    return {
      code: ResultCode.SUCCESS,
      message: 'Help command executed.',
    };
  }

  /**
   * 전체 명령어 목록 표시
   */
  private showAllCommands(): void {
    logger.header('Kurly Impact Checker v1.0.0');
    console.log('\n  기획서 기반 코드 영향도 분석 도구\n');
    console.log('  사용 가능한 명령어:\n');

    for (const [name, info] of Object.entries(COMMAND_HELP)) {
      console.log(`    ${name.padEnd(14)} ${info.description}`);
    }

    console.log('\n  상세 도움말: /impact help <command>');
    console.log('');
  }

  /**
   * 개별 명령어 도움말 표시
   * @param command - 명령어 이름
   */
  private showCommandHelp(command: string): void {
    const info = COMMAND_HELP[command];
    if (!info) return;

    logger.header(`/impact ${command}`);
    console.log(`\n  ${info.description}\n`);
    console.log(`  사용법: ${info.usage}\n`);
    console.log('  예시:');
    for (const example of info.examples) {
      console.log(`    ${example}`);
    }
    console.log('');
  }
}
