/**
 * @module commands/init
 * @description Init 명령어 핸들러 - 프로젝트를 등록하고 코드 인덱싱을 수행
 */
import { Command, CommandResult } from '../types/common';
/**
 * InitCommand - 프로젝트 초기화 명령어
 *
 * 사용법: /impact init <project_path>
 * 기능:
 *   - 프로젝트 경로 유효성 검증
 *   - 기술 스택 자동 감지 및 표시
 *   - 전체 인덱싱 실행
 *   - 인덱스 결과 요약 출력
 *   - .impact/ 디렉토리에 저장
 */
export declare class InitCommand implements Command {
    readonly name = "init";
    readonly description = "\uD504\uB85C\uC81D\uD2B8\uB97C \uB4F1\uB85D\uD558\uACE0 \uCF54\uB4DC \uC778\uB371\uC2F1\uC744 \uC218\uD589\uD569\uB2C8\uB2E4.";
    private readonly args;
    /**
     * InitCommand 생성
     * @param args - 명령어 인자
     */
    constructor(args: string[]);
    /**
     * 명령어 실행
     * @returns 실행 결과
     */
    execute(): Promise<CommandResult>;
    /**
     * 프로젝트를 .impact/projects.json에 등록
     */
    private registerProject;
    /**
     * 보완 분석 스캔 hook - init 성공 후 기존 분석 결과 매칭 스캔
     */
    private runSupplementScan;
}
//# sourceMappingURL=init.d.ts.map