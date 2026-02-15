/**
 * @module commands/analyze
 * @description Analyze 명령어 핸들러 - 기획서를 입력받아 영향도를 분석
 */
import { Command, CommandResult } from '../types/common';
/**
 * AnalyzeCommand - 영향도 분석 명령어
 *
 * 사용법: /impact analyze [--file <path>] [--project <id>]
 * 기능:
 *   - 기획서 파싱
 *   - 인덱스 매칭
 *   - LLM 영향도 분석
 *   - 점수 산출
 *   - 결과 저장
 */
export declare class AnalyzeCommand implements Command {
    readonly name = "analyze";
    readonly description = "\uAE30\uD68D\uC11C\uB97C \uC785\uB825\uBC1B\uC544 \uC601\uD5A5\uB3C4\uB97C \uBD84\uC11D\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 기획서 입력 준비
     */
    private prepareSpecInput;
    /**
     * 옵션 값 가져오기
     */
    private getOption;
    /**
     * 프로바이더 이름으로 LLM 프로바이더 인스턴스 생성
     * @param providerName - 프로바이더 이름 (anthropic, openai, google)
     * @param apiKey - 복호화된 API 키
     * @returns LLM 프로바이더 인스턴스 또는 null
     */
    private createProvider;
}
//# sourceMappingURL=analyze.d.ts.map