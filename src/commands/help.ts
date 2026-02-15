/**
 * @module commands/help
 * @description Help 명령어 핸들러 - 도움말 표시 및 명령어 상세 안내
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { logger } from '../utils/logger';

/** 명령어별 도움말 정보 */
const COMMAND_HELP: Record<
  string,
  { usage: string; description: string; options: string[]; examples: string[] }
> = {
  init: {
    usage: '/impact init <project_path>',
    description: '프로젝트를 등록하고 코드 인덱싱을 수행합니다.',
    options: [
      '<project_path>  프로젝트 루트 디렉토리 경로 (필수)',
    ],
    examples: [
      '/impact init /path/to/project',
      '/impact init .',
    ],
  },
  analyze: {
    usage: '/impact analyze [--file <path>] [--project <id>]',
    description: '기획서를 입력받아 영향도를 분석합니다.',
    options: [
      '--file <path>     기획서 파일 경로 (txt, pdf)',
      '--project <id>    분석할 프로젝트 ID (기본: 활성 프로젝트)',
    ],
    examples: [
      '/impact analyze --file plan.txt',
      '/impact analyze --file plan.pdf',
      '/impact analyze --file spec.txt --project my-app',
    ],
  },
  view: {
    usage: '/impact view [--stop]',
    description: '분석 결과 시각화 웹을 실행합니다.',
    options: [
      '--stop  실행 중인 웹 서버 중지',
    ],
    examples: [
      '/impact view',
      '/impact view --stop',
    ],
  },
  tickets: {
    usage: '/impact tickets [--result-id <id>] [--output <dir>]',
    description: '분석 결과에서 작업 티켓 마크다운 파일을 생성합니다.',
    options: [
      '--result-id <id>  특정 분석 결과 ID 사용',
      '--output <dir>    티켓 출력 디렉토리 (기본: .impact/projects/{id}/tickets/)',
    ],
    examples: [
      '/impact tickets',
      '/impact tickets --result-id analysis-1234567890',
      '/impact tickets --output ./my-tickets',
    ],
  },
  config: {
    usage: '/impact config [--provider <name>] [--key <api_key>]',
    description: 'LLM 프로바이더 및 API 키를 설정합니다.',
    options: [
      '--provider <name>  LLM 프로바이더 이름 (anthropic, openai, google)',
      '--key <api_key>    API 키 (암호화되어 저장)',
    ],
    examples: [
      '/impact config',
      '/impact config --provider anthropic --key sk-ant-xxxxx',
    ],
  },
  reindex: {
    usage: '/impact reindex [--full]',
    description: '코드 인덱스를 수동으로 갱신합니다.',
    options: [
      '--full  전체 재인덱싱 (기본: 증분 업데이트)',
    ],
    examples: [
      '/impact reindex',
      '/impact reindex --full',
    ],
  },
  policies: {
    usage: '/impact policies [--search <keyword>] [--system <name>]',
    description: '정책 사전을 조회하거나 검색합니다.',
    options: [
      '--search <keyword>  키워드로 정책 검색',
      '--system <name>     시스템별 필터링',
    ],
    examples: [
      '/impact policies',
      '/impact policies --search 배송',
      '/impact policies --system cart',
    ],
  },
  owners: {
    usage: '/impact owners [--add ...] [--remove <id>] [--show <id>]',
    description: '시스템별 담당자 및 팀 정보를 관리합니다.',
    options: [
      '--add <systemId> <name> <owner> <email> <team> [paths...]  담당자 추가',
      '--remove <systemId>  담당자 삭제',
      '--show <systemId>    담당자 상세 조회',
    ],
    examples: [
      '/impact owners',
      '/impact owners --add cart-system 장바구니 김개발 dev@kurly.com 커머스팀 src/cart/',
      '/impact owners --show cart-system',
      '/impact owners --remove cart-system',
    ],
  },
  annotations: {
    usage: '/impact annotations [generate [path]] [view [path]]',
    description: '보강 주석을 생성하거나 기존 보강 주석을 조회합니다. (Phase 2 기능)',
    options: [
      'generate [path]  보강 주석 생성 (선택: 특정 경로)',
      'view [path]      보강 주석 조회 (선택: 특정 경로)',
    ],
    examples: [
      '/impact annotations generate',
      '/impact annotations view',
      '/impact annotations generate src/components/',
    ],
  },
  projects: {
    usage: '/impact projects [--switch <name>] [--remove <name>] [--info <name>]',
    description: '멀티 프로젝트를 관리합니다.',
    options: [
      '--switch <name>  활성 프로젝트 전환',
      '--remove <name>  프로젝트 등록 해제',
      '--info <name>    프로젝트 상세 조회',
    ],
    examples: [
      '/impact projects',
      '/impact projects --switch my-project',
      '/impact projects --info my-project',
      '/impact projects --remove old-project',
    ],
  },
  demo: {
    usage: '/impact demo [--no-open]',
    description: '샘플 데이터 기반으로 도구를 체험합니다.',
    options: [
      '--no-open  브라우저 열기 생략',
    ],
    examples: [
      '/impact demo',
      '/impact demo --no-open',
    ],
  },
  help: {
    usage: '/impact help [command]',
    description: '도움말을 표시합니다.',
    options: [
      '[command]  특정 명령어의 상세 도움말 표시',
    ],
    examples: [
      '/impact help',
      '/impact help analyze',
      '/impact help tickets',
    ],
  },
};

/**
 * HelpCommand - 도움말 명령어
 *
 * 사용법: /impact help [command]
 * 기능:
 *   - 전체 명령어 목록 표시
 *   - 개별 명령어 상세 도움말 (사용법, 옵션, 예시)
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

    if (info.options.length > 0) {
      console.log('  옵션:');
      for (const opt of info.options) {
        console.log(`    ${opt}`);
      }
      console.log('');
    }

    console.log('  예시:');
    for (const example of info.examples) {
      console.log(`    ${example}`);
    }
    console.log('');
  }
}
