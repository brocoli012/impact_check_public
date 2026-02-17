/**
 * @module commands/ask
 * @description Ask 명령어 핸들러 - 코드베이스에 대한 자유 질의
 */
import { Command, CommandResult } from '../types/common';
import { CodeIndex } from '../types/index';
/** 검색 결과 항목 */
interface SearchHit {
    /** 항목 종류 */
    type: 'file' | 'component' | 'api' | 'screen' | 'policy' | 'model';
    /** 항목 이름 */
    name: string;
    /** 파일 경로 */
    filePath: string;
    /** 매칭 점수 */
    score: number;
    /** 추가 정보 */
    detail?: string;
}
/**
 * 질문 텍스트에서 키워드를 추출한다.
 *
 * - 한글/영어 토큰을 분리
 * - 불용어 제거
 * - 2글자 이상만 유지
 *
 * @param question - 질문 문자열
 * @returns 키워드 배열
 */
export declare function extractKeywords(question: string): string[];
/**
 * 키워드로 인덱스를 검색하여 관련 항목을 찾는다.
 *
 * 검색 대상:
 *   - 파일명
 *   - 컴포넌트/모듈 이름
 *   - API 경로/핸들러
 *   - 화면 이름/라우트
 *   - 정책 이름/카테고리/설명
 *   - 모델 이름/필드
 *
 * @param index - 코드 인덱스
 * @param keywords - 검색 키워드 배열
 * @returns 관련 항목 배열 (점수 순 정렬, 최대 20개)
 */
export declare function searchIndex(index: CodeIndex, keywords: string[]): SearchHit[];
/**
 * AskCommand - 코드베이스 자유 질의 명령어
 *
 * 사용법: /impact ask <질문>
 * 기능:
 *   - 질문에서 키워드 추출
 *   - 인덱스 검색 (파일, 컴포넌트, API, 화면, 정책, 모델)
 *   - 보강 주석 로드 (있을 경우)
 *   - 구조화된 답변 출력
 */
export declare class AskCommand implements Command {
    readonly name = "ask";
    readonly description = "\uCF54\uB4DC\uBCA0\uC774\uC2A4\uC5D0 \uB300\uD55C \uC790\uC720 \uC9C8\uC758";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 검색 결과를 구조화하여 출력한다.
     */
    private printResults;
}
export {};
//# sourceMappingURL=ask.d.ts.map