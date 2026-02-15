/**
 * @module commands/owners
 * @description Owners 명령어 핸들러 - 시스템별 담당자 관리 (CRUD)
 */
import { Command, CommandResult } from '../types/common';
/** 시스템 담당자 정보 */
export interface OwnerEntry {
    /** 시스템 고유 ID */
    systemId: string;
    /** 시스템 이름 */
    systemName: string;
    /** 담당자 이름 */
    ownerName: string;
    /** 담당자 이메일 */
    email: string;
    /** 소속 팀 */
    team: string;
    /** 담당 경로 패턴 목록 */
    paths: string[];
}
/**
 * OwnersCommand - 담당자 관리 명령어
 *
 * 사용법:
 *   /impact owners                   - 담당자 목록 조회
 *   /impact owners --show <systemId> - 담당자 상세 조회
 *   /impact owners --add <systemId> <systemName> <ownerName> <email> <team> <paths...>
 *   /impact owners --remove <systemId> - 담당자 삭제
 */
export declare class OwnersCommand implements Command {
    readonly name = "owners";
    readonly description = "\uC2DC\uC2A4\uD15C\uBCC4 \uB2F4\uB2F9\uC790 \uBC0F \uD300 \uC815\uBCF4\uB97C \uAD00\uB9AC\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 담당자 목록 조회
     */
    private handleList;
    /**
     * 담당자 상세 조회
     */
    private handleShow;
    /**
     * 담당자 추가
     * --add <systemId> <systemName> <ownerName> <email> <team> [paths...]
     */
    private handleAdd;
    /**
     * 담당자 삭제
     */
    private handleRemove;
    /**
     * 담당자 설정 파일 로드
     */
    private loadOwners;
    /**
     * 담당자 설정 파일 저장
     */
    private saveOwners;
}
//# sourceMappingURL=owners.d.ts.map