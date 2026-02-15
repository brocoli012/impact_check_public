/**
 * @module router
 * @description 명령어 라우터 - 커맨드 문자열을 해당 핸들러로 분기
 */
import { Command } from './types/common';
/** 알 수 없는 명령어 에러 */
export declare class UnknownCommandError extends Error {
    /** 입력된 명령어 */
    readonly command: string;
    /** 사용 가능한 명령어 목록 */
    readonly availableCommands: string[];
    /**
     * UnknownCommandError 생성
     * @param command - 입력된 명령어
     * @param availableCommands - 사용 가능한 명령어 목록
     */
    constructor(command: string, availableCommands: string[]);
}
/**
 * 명령어를 라우팅하여 적절한 Command 인스턴스를 반환
 * @param args - CLI 인자 배열 (첫 번째 요소가 명령어 이름)
 * @returns Command 인스턴스
 * @throws {UnknownCommandError} 알 수 없는 명령어인 경우
 */
export declare function route(args: string[]): Command;
/**
 * 사용 가능한 명령어 목록을 반환
 * @returns 명령어 이름 배열
 */
export declare function getAvailableCommands(): string[];
//# sourceMappingURL=router.d.ts.map