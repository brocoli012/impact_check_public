/**
 * @module core/indexing/parsers/jvm-parser-utils
 * @description JVM 파서 공통 유틸리티 - JavaParser와 KotlinParser가 공유하는 Spring Boot 관련 상수 및 헬퍼 함수
 */
/** Spring 라우트 관련 어노테이션 */
export declare const SPRING_ROUTE_ANNOTATIONS: string[];
/** Spring 컴포넌트 어노테이션 */
export declare const SPRING_COMPONENT_ANNOTATIONS: string[];
/** 의존성 주입(DI) 어노테이션 */
export declare const DI_ANNOTATIONS: string[];
/** JPA/데이터 엔티티 어노테이션 */
export declare const ENTITY_ANNOTATIONS: string[];
/** 어노테이션 이름 → HTTP 메서드 매핑 */
export declare const ANNOTATION_HTTP_METHOD_MAP: Record<string, string>;
/**
 * 매칭되는 닫는 괄호 위치 찾기 (중첩 괄호 지원)
 * @param text - 전체 텍스트
 * @param openIndex - 여는 괄호 위치
 * @returns 닫는 괄호 위치 (못 찾으면 -1)
 */
export declare function findMatchingParen(text: string, openIndex: number): number;
/**
 * 어노테이션 텍스트에서 경로 값을 추출
 * @param annotationText - 어노테이션 전체 텍스트
 * @returns 추출된 경로 문자열, 없으면 빈 문자열
 */
export declare function parseAnnotationValue(annotationText: string): string;
/**
 * 어노테이션 이름과 텍스트로부터 Spring HTTP 메서드를 결정
 * @param annotationName - 어노테이션 이름
 * @param annotationText - 어노테이션 전체 텍스트
 * @returns HTTP 메서드 문자열
 */
export declare function resolveSpringHttpMethod(annotationName: string, annotationText: string): string;
/**
 * 클래스 레벨 경로와 메서드 레벨 경로를 결합
 * @param basePath - 클래스 레벨 경로
 * @param methodPath - 메서드 레벨 경로
 * @returns 결합된 경로
 */
export declare function combineRoutePaths(basePath: string, methodPath: string): string;
/**
 * 어노테이션 목록에 Spring 컴포넌트 어노테이션이 포함되어 있는지 확인
 * @param annotations - 어노테이션 이름 목록
 * @returns Spring 컴포넌트이면 true
 */
export declare function isSpringComponent(annotations: string[]): boolean;
/**
 * 어노테이션 목록으로부터 Spring 컴포넌트 타입을 결정
 * @param annotations - 어노테이션 이름 목록
 * @returns 컴포넌트 타입 문자열
 */
export declare function mapSpringComponentType(annotations: string[]): string;
/**
 * 어노테이션 목록에 엔티티 관련 어노테이션이 포함되어 있는지 확인
 * @param annotations - 어노테이션 이름 목록
 * @returns 엔티티 클래스이면 true
 */
export declare function isEntityClass(annotations: string[]): boolean;
/**
 * 주어진 어노테이션 이름이 DI 어노테이션인지 확인
 * @param annotationName - 어노테이션 이름
 * @returns DI 어노테이션이면 true
 */
export declare function isDIAnnotation(annotationName: string): boolean;
/**
 * raw 어노테이션 문자열에서 어노테이션 이름만 추출
 * @param rawAnnotation - raw 어노테이션 문자열
 * @returns 어노테이션 이름
 */
export declare function extractAnnotationName(rawAnnotation: string): string;
/**
 * 소스 코드의 각 라인 시작 오프셋 테이블을 생성 (O(n) 1회)
 * 이후 getLineFromTable()과 함께 사용하면 O(log n)으로 라인 번호 조회 가능
 * @param content - 전체 소스 코드 문자열
 * @returns 각 라인의 시작 오프셋 배열 (0-indexed line → offset). offsets[0] = 0 (1번째 줄), offsets[1] = 첫 번째 '\n' + 1 위치 (2번째 줄)
 */
export declare function buildLineOffsetTable(content: string): number[];
/**
 * 라인 오프셋 테이블을 사용하여 문자 인덱스의 라인 번호를 Binary Search로 조회 (O(log n))
 * @param offsets - buildLineOffsetTable()로 생성한 오프셋 배열
 * @param charIndex - 문자 인덱스 (0-based)
 * @returns 라인 번호 (1-based)
 */
export declare function getLineFromTable(offsets: number[], charIndex: number): number;
/**
 * 문자열에서 특정 문자 인덱스의 라인 번호를 계산 (1-based)
 * @deprecated buildLineOffsetTable() + getLineFromTable() 사용을 권장. 이 함수는 매 호출마다 O(n) 순회하므로 대형 파일에서 성능 저하 발생.
 * @param content - 전체 문자열
 * @param charIndex - 문자 인덱스 (0-based)
 * @returns 라인 번호 (1-based)
 */
export declare function getLineNumber(content: string, charIndex: number): number;
/**
 * 소스 코드에서 문자열 리터럴과 주석을 제거하여 구조 파싱을 안전하게 수행할 수 있도록 전처리
 *
 * TASK-035: char array 방식으로 최적화
 * - 원본과 동일 길이의 char array를 생성하여 직접 인덱스 접근으로 마스킹
 * - segments 배열/문자열 연결 대신 단일 배열 사용으로 메모리 절감
 *
 * @param content - 원본 소스 코드
 * @returns 전처리된 문자열과 수집된 주석 목록
 */
export declare function stripStringsAndComments(content: string): {
    processed: string;
    comments: Array<{
        text: string;
        line: number;
        type: 'line' | 'block';
    }>;
};
//# sourceMappingURL=jvm-parser-utils.d.ts.map