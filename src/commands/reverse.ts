/**
 * @module commands/reverse
 * @description 역방향 검색 명령어 - 테이블/이벤트/키워드로 참조하는 프로젝트 조회
 *
 * 사용법:
 *   impact reverse --table orders
 *   impact reverse --event order-created
 *   impact reverse --keyword order
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { Indexer } from '../core/indexing/indexer';
import { CodeIndex } from '../types/index';
import { SharedEntityIndexer } from '../core/cross-project/shared-entity-indexer';
import { logger } from '../utils/logger';

/**
 * ReverseCommand - 역방향 검색 명령어
 *
 * 등록된 모든 프로젝트의 인덱스에서 지정된 테이블/이벤트/키워드를 검색하여
 * 어떤 프로젝트가 해당 엔티티를 참조하는지 보여줍니다.
 */
export class ReverseCommand implements Command {
  readonly name = 'reverse';
  readonly description = '역방향 검색 - 테이블/이벤트/키워드로 참조 프로젝트 조회';

  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const { mode, query, projectIds } = this.parseArgs();

    if (!query) {
      return {
        code: ResultCode.FAILURE,
        message: '검색어를 지정해주세요.\n사용법: impact reverse --table <name> | --event <name> | --keyword <name> [--projects p1,p2,...]',
      };
    }

    try {
      // 프로젝트 인덱스 로드
      const indexer = new Indexer();
      const projectIndexMap = new Map<string, CodeIndex>();

      if (projectIds.length > 0) {
        for (const pid of projectIds) {
          const index = await indexer.loadIndex(pid);
          if (index) {
            projectIndexMap.set(pid, index);
          } else {
            logger.warn(`프로젝트 '${pid}'의 인덱스를 찾을 수 없습니다.`);
          }
        }
      } else {
        // 프로젝트 목록 없으면 안내
        return {
          code: ResultCode.FAILURE,
          message: '검색할 프로젝트를 지정해주세요: --projects p1,p2,...',
        };
      }

      if (projectIndexMap.size === 0) {
        return {
          code: ResultCode.FAILURE,
          message: '로드된 프로젝트 인덱스가 없습니다.',
        };
      }

      // SharedEntityIndexer로 역인덱스 빌드
      const sharedIndexer = new SharedEntityIndexer();
      const sharedIndex = sharedIndexer.build(projectIndexMap);

      let output = '';

      switch (mode) {
        case 'table': {
          const refs = sharedIndexer.findProjectsByTable(sharedIndex, query);
          if (refs.length === 0) {
            output = `테이블 '${query}'를 참조하는 프로젝트가 없습니다.`;
          } else {
            output = `\n테이블 '${query}' 참조 프로젝트:\n`;
            output += '─'.repeat(60) + '\n';
            for (const ref of refs) {
              output += `  [${ref.projectId}] ${ref.entityName} (${ref.filePath})\n`;
              output += `    컬럼: ${ref.columns.join(', ') || '(없음)'}\n`;
              output += `    패턴: ${ref.accessPattern}\n`;
            }
            const projects = new Set(refs.map(r => r.projectId));
            if (projects.size >= 2) {
              output += `\n  * 공유 DB 테이블: ${projects.size}개 프로젝트가 참조\n`;
            }
          }
          break;
        }

        case 'event': {
          const refs = sharedIndexer.findProjectsByEvent(sharedIndex, query);
          if (refs.length === 0) {
            output = `이벤트 '${query}'를 참조하는 프로젝트가 없습니다.`;
          } else {
            output = `\n이벤트 '${query}' 참조 프로젝트:\n`;
            output += '─'.repeat(60) + '\n';
            const publishers = refs.filter(r => r.role === 'publisher');
            const subscribers = refs.filter(r => r.role === 'subscriber');

            if (publishers.length > 0) {
              output += '  발행자 (Publisher):\n';
              for (const ref of publishers) {
                output += `    [${ref.projectId}] ${ref.handler} (${ref.filePath})\n`;
              }
            }
            if (subscribers.length > 0) {
              output += '  구독자 (Subscriber):\n';
              for (const ref of subscribers) {
                output += `    [${ref.projectId}] ${ref.handler} (${ref.filePath})\n`;
              }
            }
          }
          break;
        }

        case 'keyword': {
          const results = sharedIndexer.search(sharedIndex, query);
          if (results.tables.length === 0 && results.events.length === 0) {
            output = `'${query}' 키워드와 일치하는 테이블/이벤트가 없습니다.`;
          } else {
            output = `\n'${query}' 키워드 검색 결과:\n`;
            output += '─'.repeat(60) + '\n';

            if (results.tables.length > 0) {
              output += `\n  테이블 (${results.tables.length}건):\n`;
              for (const { name, refs } of results.tables) {
                const projects = [...new Set(refs.map(r => r.projectId))];
                output += `    ${name} → ${projects.join(', ')}\n`;
              }
            }

            if (results.events.length > 0) {
              output += `\n  이벤트 (${results.events.length}건):\n`;
              for (const { name, refs } of results.events) {
                const pubs = refs.filter(r => r.role === 'publisher').map(r => r.projectId);
                const subs = refs.filter(r => r.role === 'subscriber').map(r => r.projectId);
                output += `    ${name} → pub: [${pubs.join(', ')}] sub: [${subs.join(', ')}]\n`;
              }
            }
          }
          break;
        }
      }

      console.log(output);

      return {
        code: ResultCode.SUCCESS,
        message: '역방향 검색 완료',
        data: { mode, query },
      };
    } catch (err) {
      return {
        code: ResultCode.FAILURE,
        message: `역방향 검색 실패: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * CLI 인자 파싱
   */
  private parseArgs(): {
    mode: 'table' | 'event' | 'keyword';
    query: string;
    projectIds: string[];
  } {
    let mode: 'table' | 'event' | 'keyword' = 'keyword';
    let query = '';
    const projectIds: string[] = [];

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];

      switch (arg) {
        case '--table':
        case '-t':
          mode = 'table';
          query = this.args[++i] || '';
          break;
        case '--event':
        case '-e':
          mode = 'event';
          query = this.args[++i] || '';
          break;
        case '--keyword':
        case '-k':
          mode = 'keyword';
          query = this.args[++i] || '';
          break;
        case '--projects':
        case '-p':
          projectIds.push(...(this.args[++i] || '').split(',').filter(Boolean));
          break;
        default:
          // 위치 인자: query가 비어있으면 keyword 모드로
          if (!query) {
            query = arg;
          }
          break;
      }
    }

    return { mode, query, projectIds };
  }
}
