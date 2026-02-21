/**
 * @module core/indexing/parsers/typescript-parser
 * @description TypeScript/JavaScript 파서 - @swc/core를 사용한 AST 기반 코드 분석
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
import { EventInfo } from '../../../types/index';
/**
 * TypeScriptParser - TypeScript/JavaScript 파일을 SWC로 파싱하여 구조화된 정보 추출
 *
 * 기능:
 *   - import/export 추출
 *   - 함수 정의 추출 (function declaration, arrow function, class method)
 *   - React 컴포넌트 감지 (JSX 반환하는 함수/클래스)
 *   - API 호출 감지 (fetch, axios 패턴)
 *   - 라우트 정의 감지 (react-router Route, express router)
 *   - 정책 주석 추출
 */
export declare class TypeScriptParser extends BaseParser {
    readonly name = "typescript";
    readonly supportedExtensions: string[];
    /** 소스 코드 라인 배열 (라인 번호 계산용) */
    private sourceLines;
    /** 현재 파싱 중인 파일 경로 */
    private currentFilePath;
    /** SWC span 기준 오프셋 (parseSync 호출 간 누적되는 offset 보정용) */
    private spanBaseOffset;
    /**
     * TypeScript/JavaScript 파일을 파싱하여 구조화된 정보 추출
     * @param filePath - 파일 경로
     * @param content - 파일 내용
     * @returns 파싱된 파일 정보
     */
    parse(filePath: string, content: string): Promise<ParsedFile>;
    /**
     * ModuleItem을 처리 (import, export, statement)
     */
    private processModuleItem;
    /**
     * Import 선언 처리
     */
    private processImport;
    /**
     * Export 선언 처리 (export function/class/const)
     */
    private processExportDeclaration;
    /**
     * Export Default 처리
     */
    private processExportDefault;
    /**
     * Export Default Expression 처리
     */
    private processExportDefaultExpression;
    /**
     * Export Named 처리 (export { ... })
     */
    private processExportNamed;
    /**
     * Declaration 처리
     */
    private processDeclaration;
    /**
     * Statement 처리
     */
    private processStatement;
    /**
     * 함수 선언 처리
     */
    private processFunctionDeclaration;
    /**
     * 클래스 선언 처리
     */
    private processClassDeclaration;
    /**
     * 클래스 메서드 처리
     */
    private processClassMethod;
    /**
     * 변수 선언 처리 (arrow function 포함)
     */
    private processVariableDeclaration;
    /**
     * 함수 추출 (arrow function / function expression)
     */
    private extractFunction;
    /**
     * Expression statement 처리 (app.get, router.post 등)
     */
    private processExpressionStatement;
    /**
     * 주석 추출
     */
    private extractComments;
    /**
     * React 컴포넌트 감지
     */
    private detectReactComponents;
    /**
     * 함수 파라미터에서 Props 추출
     */
    private extractPropsFromFunction;
    /**
     * 블록 문장에서 API 호출 감지
     */
    private detectApiCallsInBlock;
    /**
     * Statement에서 API 호출 감지
     */
    private detectApiCallsInStatement;
    /**
     * CallExpression에서 API 호출 감지
     */
    private detectApiCallInExpression;
    /**
     * 라우트 정의 감지 (express router, react-router)
     */
    private detectRouteDefinition;
    /**
     * TypeORM @Entity() 데코레이터를 감지하여 ModelInfo를 생성
     */
    private detectTypeOrmEntity;
    /**
     * TS/Node.js 이벤트 패턴을 감지하여 EventInfo를 추출
     *
     * 감지 패턴:
     *   - EventEmitter: .emit('eventName'), .on('eventName'), .once('eventName'), .addListener('eventName')
     *   - RxJS: new Subject<T>(), subject.next(), observable.subscribe()
     *   - Custom pub/sub: .publish('topic'), .dispatch('action'), .trigger('event')
     */
    parseEventPatterns(filePath: string, content: string): EventInfo[];
    /**
     * 주어진 라인이 속한 함수/메서드 이름을 찾는 간단한 휴리스틱
     */
    private findEnclosingFunctionName;
    /**
     * Span에서 라인 번호 계산
     * SWC의 누적 span offset을 보정하기 위해 spanBaseOffset을 차감
     */
    private getLineNumber;
    /**
     * Span에서 종료 라인 번호 계산
     * SWC의 누적 span offset을 보정하기 위해 spanBaseOffset을 차감
     */
    private getEndLineNumber;
    /**
     * 파라미터 목록 추출
     */
    private extractParams;
    /**
     * 패턴에서 파라미터 정보 추출
     */
    private extractParamFromPattern;
    /**
     * TypeScript 타입을 문자열로 변환
     */
    private tsTypeToString;
    /**
     * 함수 시그니처 빌드
     */
    private buildSignature;
    /**
     * CallExpression 인자에서 URL 추출
     */
    private extractUrlFromArgs;
    /**
     * fetch 옵션에서 HTTP 메서드 추출
     */
    private extractMethodFromFetchOptions;
    /**
     * 식별자 이름 추출
     */
    private getIdentifierName;
    /**
     * MemberExpression에서 속성 이름 추출
     */
    private getPropertyName;
}
//# sourceMappingURL=typescript-parser.d.ts.map