/**
 * @module core/indexing/types
 * @description 코드 인덱싱 시스템 내부 타입 정의
 */
import { FileInfo } from '../../types/index';
/**
 * 파일 스캔 결과
 *
 * FileScanner.scan()의 반환 타입으로, 프로젝트 내 모든 대상 파일 목록과
 * 감지된 기술 스택, 통계 정보를 포함한다.
 */
export interface ScanResult {
    /** 스캔된 파일 목록 */
    files: FileInfo[];
    /** 감지된 기술 스택 */
    techStack: string[];
    /** 통계 정보 */
    stats: {
        /** 전체 파일 수 */
        totalFiles: number;
        /** 전체 라인 수 */
        totalLines: number;
        /** 언어별 파일 수 */
        languages: Record<string, number>;
    };
    /**
     * TASK-038: 파일 콘텐츠 캐시 (상대경로 → 콘텐츠)
     * Scanner에서 이미 읽은 파일 콘텐츠를 Indexer가 재사용하여 이중 파일 읽기 제거
     */
    contentCache?: Map<string, string>;
}
/**
 * 파싱된 파일 정보
 *
 * TypeScriptParser 등의 파서가 AST 분석 후 반환하는 구조체.
 * 하나의 소스 파일에서 추출된 import, export, 함수, 컴포넌트,
 * API 호출, 라우트 정의, 주석 정보를 모두 포함한다.
 */
export interface ParsedFile {
    /** 파일 경로 */
    filePath: string;
    /** import 목록 */
    imports: ImportInfo[];
    /** export 목록 */
    exports: ExportInfo[];
    /** 함수 목록 */
    functions: FunctionInfo[];
    /** 컴포넌트 목록 */
    components: ParsedComponentInfo[];
    /** API 호출 목록 */
    apiCalls: ApiCallInfo[];
    /** 라우트 정의 목록 */
    routeDefinitions: RouteInfo[];
    /** 주석 목록 */
    comments: CommentInfo[];
}
/**
 * Import 정보
 *
 * 소스 파일의 import 문을 분석한 결과.
 * 의존성 그래프 구축 시 엣지 생성에 사용된다.
 */
export interface ImportInfo {
    /** import 경로 */
    source: string;
    /** named imports */
    specifiers: string[];
    /** default import 여부 */
    isDefault: boolean;
    /** 라인 번호 */
    line: number;
}
/** Export 정보 */
export interface ExportInfo {
    /** export 이름 */
    name: string;
    /** export 유형 */
    type: 'default' | 'named';
    /** export 종류 */
    kind: 'function' | 'class' | 'variable' | 'type';
    /** 라인 번호 */
    line: number;
}
/** 함수 정보 */
export interface FunctionInfo {
    /** 함수 이름 */
    name: string;
    /** 함수 시그니처 */
    signature: string;
    /** 시작 라인 */
    startLine: number;
    /** 종료 라인 */
    endLine: number;
    /** 파라미터 목록 */
    params: {
        name: string;
        type?: string;
    }[];
    /** 반환 타입 */
    returnType?: string;
    /** async 함수 여부 */
    isAsync: boolean;
    /** export 여부 */
    isExported: boolean;
    /** Java/Kotlin 메서드 어노테이션 목록 (예: @Transactional, @Cacheable) */
    annotations?: string[];
}
/** 파싱된 컴포넌트 정보 (내부 타입) */
export interface ParsedComponentInfo {
    /** 컴포넌트 이름 */
    name: string;
    /** 컴포넌트 유형 */
    type: 'function-component' | 'class-component';
    /** Props 목록 */
    props: string[];
    /** 파일 경로 */
    filePath: string;
    /** 라인 번호 */
    line: number;
}
/** API 호출 정보 */
export interface ApiCallInfo {
    /** HTTP 메서드 */
    method: string;
    /** API URL */
    url: string;
    /** 라인 번호 */
    line: number;
    /** 호출하는 함수명 */
    callerFunction: string;
}
/** 라우트 정보 */
export interface RouteInfo {
    /** 라우트 경로 */
    path: string;
    /** 대상 컴포넌트 */
    component: string;
    /** 파일 경로 */
    filePath: string;
    /** 라인 번호 */
    line: number;
}
/** 주석 정보 */
export interface CommentInfo {
    /** 주석 내용 */
    text: string;
    /** 라인 번호 */
    line: number;
    /** 주석 유형 */
    type: 'line' | 'block';
    /** 정책 주석 여부 */
    isPolicy: boolean;
}
/** API 호출 그래프 */
export interface ApiCallGraph {
    /** 노드 (파일) 목록 */
    callers: ApiCallerNode[];
    /** 엣지 (호출 관계) 목록 */
    endpoints: ApiEndpointNode[];
}
/** API 호출자 노드 */
export interface ApiCallerNode {
    /** 파일 경로 */
    filePath: string;
    /** 함수 이름 */
    functionName: string;
    /** 호출하는 API 목록 */
    calls: ApiCallInfo[];
}
/** API 엔드포인트 노드 */
export interface ApiEndpointNode {
    /** HTTP 메서드 */
    method: string;
    /** API URL */
    url: string;
    /** 호출하는 파일 목록 */
    calledBy: string[];
}
//# sourceMappingURL=types.d.ts.map