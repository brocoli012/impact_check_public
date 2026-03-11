/**
 * @module commands/policy-doc
 * @description PolicyDoc 명령어 핸들러 - 정책 문서 저장/조회/검색/삭제 (REQ-018-A3)
 *
 * 사용법:
 *   /impact policy-doc save --title <name> --category <cat> --content <text> [--project <id>] [--tags <t1,t2,...>]
 *   /impact policy-doc list [--category <cat>] [--project <id>]
 *   /impact policy-doc search <query>
 *   /impact policy-doc show <id>
 *   /impact policy-doc remove <id>
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { PolicyDocument } from '../types/review';
import { PolicyDocManager } from '../core/review/policy-doc-manager';
import { logger } from '../utils/logger';

/**
 * PolicyDocCommand - 정책 문서 관리 명령어
 */
export class PolicyDocCommand implements Command {
  readonly name = 'policy-doc';
  readonly description = '정책 문서를 저장, 조회, 검색, 삭제합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      const subcommand = this.args[0];

      switch (subcommand) {
        case 'save':
          return this.handleSave();
        case 'list':
          return this.handleList();
        case 'search':
          return this.handleSearch();
        case 'show':
          return this.handleShow();
        case 'remove':
          return this.handleRemove();
        default:
          return this.handleHelp();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`정책 문서 명령 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Policy-doc command failed: ${errorMsg}`,
      };
    }
  }

  /**
   * save: 정책 문서 저장
   */
  private handleSave(): CommandResult {
    const title = this.getOption('--title');
    const category = this.getOption('--category') || 'general';
    const content = this.getOption('--content');
    const project = this.getOption('--project');
    const tagsStr = this.getOption('--tags');

    if (!title) {
      logger.error('--title 옵션이 필요합니다.');
      return {
        code: ResultCode.FAILURE,
        message: '--title is required for save.',
      };
    }

    if (!content) {
      logger.error('--content 옵션으로 정책 내용을 지정하세요.');
      return {
        code: ResultCode.FAILURE,
        message: '--content is required for save.',
      };
    }

    const tags = tagsStr
      ? tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    const doc: PolicyDocument = {
      id: '',
      title,
      category,
      content,
      source: `CLI policy-doc save (${new Date().toISOString()})`,
      confirmedAt: new Date().toISOString().split('T')[0],
      project: project || undefined,
      tags,
    };

    const manager = new PolicyDocManager();
    const filePath = manager.save(doc);
    const index = manager.getIndex();

    logger.header('KIC - 정책 문서 저장');
    console.log('');
    console.log('  정책 문서 저장 중...');
    console.log(`    > 제목: ${title}`);
    console.log(`    > 카테고리: ${category}`);
    if (project) {
      console.log(`    > 관련 프로젝트: ${project}`);
    }
    if (tags.length > 0) {
      console.log(`    > 태그: ${tags.join(', ')}`);
    }
    console.log('');

    logger.success('정책 문서 저장 완료');
    console.log(`    - 파일: ${filePath}`);
    console.log(`    - 인덱스 갱신 완료 (총 ${index.policies.length}건)`);
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `Policy document saved: ${filePath}`,
      data: { filePath, totalPolicies: index.policies.length },
    };
  }

  /**
   * list: 정책 문서 목록 조회
   */
  private handleList(): CommandResult {
    const category = this.getOption('--category');
    const project = this.getOption('--project');
    const tag = this.getOption('--tag');

    const manager = new PolicyDocManager();
    const filter: { category?: string; project?: string; tag?: string } = {};
    if (category) filter.category = category;
    if (project) filter.project = project;
    if (tag) filter.tag = tag;

    const entries = manager.list(Object.keys(filter).length > 0 ? filter : undefined);

    logger.header('KIC - 문서화된 정책 목록');
    console.log('');

    if (entries.length === 0) {
      console.log('  등록된 정책 문서가 없습니다.');
      console.log('  정책 저장: /impact policy-doc save --title <제목> --content <내용>');
    } else {
      console.log(`  총 ${entries.length}건의 정책 문서가 등록되어 있습니다.`);
      console.log('');

      for (const entry of entries) {
        console.log(`  [${entry.id}] ${entry.title}`);
        console.log(`    카테고리: ${entry.category} | 확인일: ${entry.confirmedAt}`);
        if (entry.project) {
          console.log(`    관련 프로젝트: ${entry.project}`);
        }
        if (entry.tags.length > 0) {
          console.log(`    태그: ${entry.tags.join(', ')}`);
        }
        console.log(`    파일: ${entry.filePath}`);
        console.log('');
      }
    }

    return {
      code: ResultCode.SUCCESS,
      message: `Listed ${entries.length} policy documents.`,
      data: { entries },
    };
  }

  /**
   * search: 키워드 검색
   */
  private handleSearch(): CommandResult {
    const query = this.args[1];

    if (!query) {
      logger.error('검색 키워드를 지정해주세요.');
      return {
        code: ResultCode.FAILURE,
        message: 'Search query is required.',
      };
    }

    const manager = new PolicyDocManager();
    const results = manager.search(query);

    logger.header(`KIC - 정책 문서 검색: "${query}"`);
    console.log('');

    if (results.length === 0) {
      console.log(`  "${query}"에 해당하는 정책 문서를 찾을 수 없습니다.`);
    } else {
      console.log(`  ${results.length}건의 정책 문서가 검색되었습니다.`);
      console.log('');

      for (const entry of results) {
        console.log(`  [${entry.id}] ${entry.title}`);
        console.log(`    카테고리: ${entry.category} | 확인일: ${entry.confirmedAt}`);
        if (entry.tags.length > 0) {
          console.log(`    태그: ${entry.tags.join(', ')}`);
        }
        console.log('');
      }
    }

    return {
      code: ResultCode.SUCCESS,
      message: `Found ${results.length} policy documents for "${query}".`,
      data: { results, query },
    };
  }

  /**
   * show: 개별 정책 문서 상세 조회
   */
  private handleShow(): CommandResult {
    const id = this.args[1];

    if (!id) {
      logger.error('정책 문서 ID를 지정해주세요.');
      return {
        code: ResultCode.FAILURE,
        message: 'Policy document ID is required.',
      };
    }

    const manager = new PolicyDocManager();
    const doc = manager.get(id);

    if (!doc) {
      logger.error(`정책 문서를 찾을 수 없습니다: ${id}`);
      return {
        code: ResultCode.FAILURE,
        message: `Policy document not found: ${id}`,
      };
    }

    logger.header(`KIC - 정책 문서: ${doc.title}`);
    console.log('');
    console.log(`  ID: ${doc.id}`);
    console.log(`  제목: ${doc.title}`);
    console.log(`  카테고리: ${doc.category}`);
    if (doc.project) {
      console.log(`  관련 프로젝트: ${doc.project}`);
    }
    console.log(`  확인일: ${doc.confirmedAt}`);
    if (doc.tags.length > 0) {
      console.log(`  태그: ${doc.tags.join(', ')}`);
    }
    console.log('');
    console.log('  --- 정책 내용 ---');
    console.log('');
    console.log(`  ${doc.content}`);
    console.log('');
    console.log('  --- 확인 맥락 ---');
    console.log('');
    console.log(`  ${doc.source}`);
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `Showing policy document: ${doc.id}`,
      data: { document: doc },
    };
  }

  /**
   * remove: 정책 문서 삭제
   */
  private handleRemove(): CommandResult {
    const id = this.args[1];

    if (!id) {
      logger.error('정책 문서 ID를 지정해주세요.');
      return {
        code: ResultCode.FAILURE,
        message: 'Policy document ID is required.',
      };
    }

    const manager = new PolicyDocManager();
    const success = manager.delete(id);

    if (!success) {
      logger.error(`정책 문서를 찾을 수 없습니다: ${id}`);
      return {
        code: ResultCode.FAILURE,
        message: `Policy document not found: ${id}`,
      };
    }

    logger.header('KIC - 정책 문서 삭제');
    console.log('');
    logger.success(`정책 문서가 삭제되었습니다: ${id}`);
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `Policy document deleted: ${id}`,
      data: { id },
    };
  }

  /**
   * 도움말 표시
   */
  private handleHelp(): CommandResult {
    logger.header('KIC - 정책 문서 관리');
    console.log('');
    console.log('  사용법:');
    console.log('    /impact policy-doc save --title <제목> --category <카테고리> --content <내용> [--project <id>] [--tags <t1,t2>]');
    console.log('    /impact policy-doc list [--category <cat>] [--project <id>]');
    console.log('    /impact policy-doc search <키워드>');
    console.log('    /impact policy-doc show <id>');
    console.log('    /impact policy-doc remove <id>');
    console.log('');
    console.log('  카테고리:');
    console.log('    data-integrity, data-handling, data-governance, operational, error-handling, general');
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: 'Policy-doc help displayed.',
    };
  }

  /**
   * CLI 옵션 값 추출 헬퍼
   */
  private getOption(flag: string): string | undefined {
    const idx = this.args.indexOf(flag);
    if (idx === -1 || idx + 1 >= this.args.length) return undefined;
    return this.args[idx + 1];
  }
}
