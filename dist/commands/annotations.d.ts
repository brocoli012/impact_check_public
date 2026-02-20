/**
 * @module commands/annotations
 * @description Annotations 명령어 핸들러 - 보강 주석 생성 및 조회
 */
import { Command, CommandResult } from '../types/common';
/**
 * AnnotationsCommand - 보강 주석 명령어
 *
 * 사용법: /impact annotations [generate [path]] [view [path]]
 * 기능:
 *   - 보강 주석 생성
 *   - 기존 보강 주석 조회
 *   - 보강 주석 상태 요약
 */
export declare class AnnotationsCommand implements Command {
    readonly name = "annotations";
    readonly description = "\uBCF4\uAC15 \uC8FC\uC11D\uC744 \uC0DD\uC131\uD558\uAC70\uB098 \uAE30\uC874 \uBCF4\uAC15 \uC8FC\uC11D\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * generate 서브커맨드 처리
     */
    private handleGenerate;
    /**
     * view 서브커맨드 처리
     */
    private handleView;
    /**
     * 단일 파일 보강 주석의 마크다운 문자열을 생성
     */
    private generateSingleFileMd;
    /**
     * 단일 파일 보강 주석을 마크다운 형식으로 출력
     */
    private printSingleFileMd;
    /**
     * 통계 마크다운 문자열을 생성
     */
    private generateStatsMd;
    /**
     * 통계를 마크다운 형식으로 출력
     */
    private printStatsMd;
    /**
     * view 서브커맨드의 인자를 파싱한다.
     * --format md|yaml 옵션, --output <dir> 옵션, targetPath를 추출한다.
     */
    private parseViewArgs;
    /**
     * 활성 프로젝트 정보를 가져온다.
     * @throws {ProjectNotFoundError} 프로젝트가 설정되지 않았거나 찾을 수 없을 때
     */
    private getActiveProject;
}
//# sourceMappingURL=annotations.d.ts.map