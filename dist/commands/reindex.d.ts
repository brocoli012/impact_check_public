/**
 * @module commands/reindex
 * @description Reindex 명령어 핸들러 - 코드 인덱스를 수동으로 갱신
 */
import { Command, CommandResult } from '../types/common';
/**
 * ReindexCommand - 인덱스 갱신 명령어
 *
 * 사용법: /impact reindex [--full] [--incremental]
 * 기능:
 *   - 증분 인덱스 업데이트 (기본)
 *   - --full 옵션으로 전체 재인덱싱
 *   - --incremental 옵션으로 명시적 증분 인덱싱
 *   - isIndexStale 확인 후 자동 분기
 *   - 변경 비율 30% 초과 시 전체 인덱싱 전환
 *   - 증분 인덱싱 실패 시 전체 인덱싱 폴백
 *   - 인덱싱 진행률 출력
 */
export declare class ReindexCommand implements Command {
    readonly name = "reindex";
    readonly description = "\uCF54\uB4DC \uC778\uB371\uC2A4\uB97C \uC218\uB3D9\uC73C\uB85C \uAC31\uC2E0\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
}
//# sourceMappingURL=reindex.d.ts.map