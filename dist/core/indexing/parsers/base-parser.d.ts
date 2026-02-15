/**
 * @module core/indexing/parsers/base-parser
 * @description AST 파서 베이스 클래스 - 모든 언어별 파서의 공통 인터페이스
 */
import { ParsedFile } from '../types';
/**
 * BaseParser - 모든 언어별 파서의 추상 베이스 클래스
 *
 * 각 파서는 이 클래스를 상속하여 특정 언어의 AST 파싱을 구현합니다.
 */
export declare abstract class BaseParser {
    /** 파서 이름 */
    abstract readonly name: string;
    /** 지원하는 파일 확장자 목록 */
    abstract readonly supportedExtensions: string[];
    /**
     * 주어진 파일을 파싱할 수 있는지 확인
     * @param filePath - 파일 경로
     * @returns 파싱 가능 여부
     */
    canParse(filePath: string): boolean;
    /**
     * 파일 내용을 파싱하여 구조화된 정보 추출
     * @param filePath - 파일 경로
     * @param content - 파일 내용
     * @returns 파싱된 파일 정보
     */
    abstract parse(filePath: string, content: string): Promise<ParsedFile>;
    /**
     * 빈 ParsedFile 객체 생성
     * @param filePath - 파일 경로
     * @returns 빈 ParsedFile 객체
     */
    protected createEmptyParsedFile(filePath: string): ParsedFile;
}
//# sourceMappingURL=base-parser.d.ts.map