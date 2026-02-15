/**
 * @module router
 * @description 명령어 라우터 - 커맨드 문자열을 해당 핸들러로 분기
 */

import { Command } from './types/common';
import { InitCommand } from './commands/init';
import { AnalyzeCommand } from './commands/analyze';
import { ViewCommand } from './commands/view';
import { TicketsCommand } from './commands/tickets';
import { ConfigCommand } from './commands/config';
import { ReindexCommand } from './commands/reindex';
import { DemoCommand } from './commands/demo';
import { HelpCommand } from './commands/help';
import { ProjectsCommand } from './commands/projects';
import { PoliciesCommand } from './commands/policies';
import { OwnersCommand } from './commands/owners';
import { AnnotationsCommand } from './commands/annotations';

/** 알 수 없는 명령어 에러 */
export class UnknownCommandError extends Error {
  /** 입력된 명령어 */
  public readonly command: string;
  /** 사용 가능한 명령어 목록 */
  public readonly availableCommands: string[];

  /**
   * UnknownCommandError 생성
   * @param command - 입력된 명령어
   * @param availableCommands - 사용 가능한 명령어 목록
   */
  constructor(command: string, availableCommands: string[]) {
    super(`Unknown command: '${command}'. Available commands: ${availableCommands.join(', ')}`);
    this.name = 'UnknownCommandError';
    this.command = command;
    this.availableCommands = availableCommands;
  }
}

/** 명령어 생성자 타입 */
type CommandConstructor = new (args: string[]) => Command;

/** 명령어 맵 - 커맨드 이름과 핸들러 클래스의 매핑 */
const COMMANDS: Record<string, CommandConstructor> = {
  'init': InitCommand,
  'analyze': AnalyzeCommand,
  'view': ViewCommand,
  'tickets': TicketsCommand,
  'config': ConfigCommand,
  'reindex': ReindexCommand,
  'demo': DemoCommand,
  'help': HelpCommand,
  'faq': HelpCommand,        // FAQ는 HelpCommand로 처리
  'projects': ProjectsCommand,
  'policies': PoliciesCommand,
  'owners': OwnersCommand,
  'annotations': AnnotationsCommand,
} as const;

/**
 * 명령어를 라우팅하여 적절한 Command 인스턴스를 반환
 * @param args - CLI 인자 배열 (첫 번째 요소가 명령어 이름)
 * @returns Command 인스턴스
 * @throws {UnknownCommandError} 알 수 없는 명령어인 경우
 */
export function route(args: string[]): Command {
  const commandName = args[0];

  if (!commandName) {
    return new HelpCommand([]);
  }

  const CommandClass = COMMANDS[commandName];
  if (!CommandClass) {
    throw new UnknownCommandError(commandName, Object.keys(COMMANDS));
  }

  return new CommandClass(args.slice(1));
}

/**
 * 사용 가능한 명령어 목록을 반환
 * @returns 명령어 이름 배열
 */
export function getAvailableCommands(): string[] {
  return Object.keys(COMMANDS);
}
