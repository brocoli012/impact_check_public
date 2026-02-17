/**
 * @module commands/projects
 * @description Projects 명령어 핸들러 - 멀티 프로젝트 관리
 */
import { Command, CommandResult } from '../types/common';
/**
 * ProjectsCommand - 프로젝트 관리 명령어
 *
 * 사용법:
 *   /impact projects                  - 프로젝트 목록 조회
 *   /impact projects --switch <name>  - 활성 프로젝트 전환
 *   /impact projects --remove <name>  - 프로젝트 등록 해제
 *   /impact projects --info <name>    - 프로젝트 상세 조회
 *   /impact projects --link <source> <target> --type <type>  - 의존성 등록
 *   /impact projects --unlink <source> <target>              - 의존성 해제
 *   /impact projects --links [projectId]                     - 의존성 목록 조회
 *   /impact projects --detect-links                          - API 경로 기반 자동 의존성 감지
 *   /impact projects --group <name> --add <project-id>       - 그룹에 프로젝트 추가
 *   /impact projects --group <name> --remove <project-id>    - 그룹에서 프로젝트 제거
 *   /impact projects --groups                                - 전체 그룹 목록 조회
 */
export declare class ProjectsCommand implements Command {
    readonly name = "projects";
    readonly description = "\uBA40\uD2F0 \uD504\uB85C\uC81D\uD2B8\uB97C \uAD00\uB9AC\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 프로젝트 목록 조회
     */
    private handleList;
    /**
     * 활성 프로젝트 전환
     */
    private handleSwitch;
    /**
     * 프로젝트 등록 해제 (파일은 유지, projects.json에서만 제거)
     */
    private handleRemove;
    /**
     * 프로젝트 상세 조회
     */
    private handleInfo;
    /**
     * 크로스 프로젝트 의존성 등록
     */
    private handleLink;
    /**
     * 크로스 프로젝트 의존성 해제
     */
    private handleUnlink;
    /**
     * 크로스 프로젝트 의존성 목록 조회
     */
    private handleLinks;
    /**
     * API 경로 기반 자동 의존성 감지
     */
    private handleDetectLinks;
    /**
     * 그룹 목록 조회
     */
    private handleGroupsList;
    /**
     * 그룹에 프로젝트 추가/제거
     */
    private handleGroup;
    /**
     * 프로젝트 설정 로드
     */
    private loadProjectsConfig;
}
//# sourceMappingURL=projects.d.ts.map