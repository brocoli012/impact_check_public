/**
 * @module core/annotations/annotation-generator
 * @description 규칙 기반 보강 주석 생성기 - 코드 분석을 통한 FunctionAnnotation/AnnotationFile 생성
 *
 * LLM API를 호출하지 않고, 함수명/파라미터/반환타입/코드패턴을 규칙 기반으로 분석하여
 * 보강 주석(enriched_comment)과 추론 정책(InferredPolicy)을 생성한다.
 */
import type { AnnotationFile, FunctionAnnotation, InferredPolicy } from '../../types/annotations';
import type { ParsedFile, FunctionInfo } from '../indexing/types';
/** AnnotationGenerator 옵션 */
export interface AnnotationGeneratorOptions {
    /** 분석 깊이 (basic: 함수 시그니처만, detailed: 코드 내용 분석) */
    depth?: 'basic' | 'detailed';
    /** 우선순위 파일 유형 필터 */
    priorityTypes?: string[];
}
/** 파일 분석 컨텍스트 */
export interface FileContext {
    /** 파일 경로 */
    filePath: string;
    /** 파일명 (확장자 제외) */
    fileName: string;
    /** import 목록 */
    imports: string[];
    /** 기존 주석 목록 */
    existingComments: string[];
    /** 파일 유형 (service, controller, component 등) */
    fileType: string;
}
/**
 * AnnotationGenerator - 규칙 기반 보강 주석 생성기
 *
 * ParsedFile 구조를 입력으로 받아, 각 함수에 대한 FunctionAnnotation을 생성하고
 * AnnotationFile 구조로 조합하여 반환한다.
 * LLM API를 호출하지 않으며, 함수명/파라미터/반환타입/코드 패턴을 규칙 기반으로 분석한다.
 */
export declare class AnnotationGenerator {
    private readonly depth;
    private readonly priorityTypes;
    constructor(options?: AnnotationGeneratorOptions);
    /**
     * 단일 파일 분석 -> AnnotationFile 생성
     *
     * @param filePath - 분석 대상 파일 경로 (프로젝트 루트 상대)
     * @param parsedFile - 파서가 추출한 ParsedFile 정보
     * @param projectPath - 프로젝트 루트 절대 경로
     * @returns 생성된 AnnotationFile
     */
    generateForFile(filePath: string, parsedFile: ParsedFile, projectPath: string): Promise<AnnotationFile>;
    /**
     * 배치 분석 (여러 파일 한번에)
     *
     * @param files - 분석 대상 파일 배열
     * @param projectPath - 프로젝트 루트 경로
     * @param onProgress - 진행 콜백 (current, total, filePath)
     * @returns 파일경로 -> AnnotationFile 맵
     */
    generateBatch(files: Array<{
        filePath: string;
        parsedFile: ParsedFile;
    }>, projectPath: string, onProgress?: (current: number, total: number, filePath: string) => void): Promise<Map<string, AnnotationFile>>;
    /**
     * 단일 함수 분석 -> FunctionAnnotation 생성
     */
    analyzeFunction(func: FunctionInfo, _filePath: string, fileContext: FileContext): FunctionAnnotation;
    /**
     * 함수에서 정책 추론
     */
    inferPolicies(func: FunctionInfo, _fileContext: FileContext): InferredPolicy[];
    /**
     * 함수 유형 판별
     *
     * FunctionAnnotation.type은 'business_logic' | 'utility' | 'data_access' | 'integration' | 'config'
     * 파일 위치와 함수명을 기반으로 유형을 분류한다.
     */
    classifyFunctionType(func: FunctionInfo, fileContext: FileContext): FunctionAnnotation['type'];
    /**
     * enriched_comment 생성
     *
     * 함수의 이름, 파라미터, 반환 타입, 비동기 여부 등을 분석하여
     * 사람이 읽을 수 있는 보강 주석을 생성한다.
     */
    generateEnrichedComment(func: FunctionInfo, fileContext: FileContext): string;
    /**
     * 신뢰도 계산
     *
     * 기본 0.5에서 시작하여, 다양한 조건에 따라 가중치를 더한다.
     * 최대 1.0
     */
    calculateConfidence(func: FunctionInfo, policies: InferredPolicy[], originalComment?: string | null): number;
    /**
     * 콘텐츠의 SHA-256 해시 계산
     */
    calculateSourceHash(content: string): string;
    /**
     * FileContext 생성
     */
    private buildFileContext;
    /**
     * 파일 경로에서 파일 유형 분류
     */
    private classifyFileType;
    /**
     * 시스템 이름 추론 (프로젝트 구조에서)
     */
    private inferSystem;
    /**
     * 함수명에서 비즈니스 의도 추론
     */
    private inferFunctionIntent;
    /**
     * 함수명에서 클래스 접두사 제거 (ClassName.method -> method)
     */
    private getBaseFunctionName;
    /**
     * 함수 바로 위의 원본 주석 찾기
     */
    private findOriginalComment;
    /**
     * 추론 근거 문자열 생성
     */
    private buildInferredFrom;
    /**
     * 정책 신뢰도 계산 (InferredPolicy 용)
     */
    private calculatePolicyConfidence;
    /**
     * 파일 요약 생성
     */
    private generateFileSummary;
    /**
     * 비즈니스 도메인 추론
     */
    private inferBusinessDomain;
    /**
     * 파일에서 키워드 추출
     */
    private extractKeywords;
}
//# sourceMappingURL=annotation-generator.d.ts.map