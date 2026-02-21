/**
 * @module commands/reverse
 * @description 역방향 검색 명령어 - 테이블/이벤트/키워드로 참조하는 프로젝트 조회
 *
 * 사용법:
 *   impact reverse --table orders
 *   impact reverse --event order-created
 *   impact reverse --keyword order
 */
import { Command, CommandResult } from '../types/common';
/**
 * ReverseCommand - 역방향 검색 명령어
 *
 * 등록된 모든 프로젝트의 인덱스에서 지정된 테이블/이벤트/키워드를 검색하여
 * 어떤 프로젝트가 해당 엔티티를 참조하는지 보여줍니다.
 */
export declare class ReverseCommand implements Command {
    readonly name = "reverse";
    readonly description = "\uC5ED\uBC29\uD5A5 \uAC80\uC0C9 - \uD14C\uC774\uBE14/\uC774\uBCA4\uD2B8/\uD0A4\uC6CC\uB4DC\uB85C \uCC38\uC870 \uD504\uB85C\uC81D\uD2B8 \uC870\uD68C";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * CLI 인자 파싱
     */
    private parseArgs;
}
//# sourceMappingURL=reverse.d.ts.map