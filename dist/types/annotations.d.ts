/**
 * @module types/annotations
 * @description 보강 주석 타입 정의 - LLM 기반 코드 보강 주석 시스템
 */
import { ISODateString } from './common';
/** 보강 주석 파일 인터페이스 */
export interface AnnotationFile {
    /** 원본 파일 경로 */
    file: string;
    /** 소속 시스템 */
    system: string;
    /** 마지막 분석 시각 */
    lastAnalyzed: ISODateString;
    /** 원본 파일 SHA-256 해시 (변경 감지용) */
    sourceHash: string;
    /** 분석 엔진 버전 */
    analyzerVersion: string;
    /** 분석에 사용된 LLM 모델 */
    llmModel: string;
    /** 파일 요약 */
    fileSummary: {
        /** 파일 전체 요약 */
        description: string;
        /** 신뢰도 (0.0~1.0) */
        confidence: number;
        /** 비즈니스 도메인 */
        businessDomain: string;
        /** 키워드 */
        keywords: string[];
    };
    /** 함수별 보강 주석 목록 */
    annotations: FunctionAnnotation[];
}
/** 함수별 보강 주석 */
export interface FunctionAnnotation {
    /** 시작 라인 */
    line: number;
    /** 종료 라인 */
    endLine: number;
    /** 함수/메서드명 */
    function: string;
    /** 함수 시그니처 */
    signature: string;
    /** 원본 주석 (없으면 null) */
    original_comment: string | null;
    /** LLM이 생성한 보강 주석 */
    enriched_comment: string;
    /** 신뢰도 (0.0~1.0) */
    confidence: number;
    /** 함수 유형 */
    type: 'business_logic' | 'utility' | 'data_access' | 'integration' | 'config';
    /** 사용자 수동 수정 여부 */
    userModified: boolean;
    /** 수동 수정 시 수정자 */
    lastModifiedBy: string | null;
    /** 추론 근거 */
    inferred_from: string;
    /** 추론된 정책 목록 */
    policies: InferredPolicy[];
    /** 관련 함수 목록 */
    relatedFunctions: string[];
    /** 관련 API 목록 */
    relatedApis: string[];
}
/** 추론된 정책 */
export interface InferredPolicy {
    /** 정책명 */
    name: string;
    /** 정책 설명 (1~2문장 요약) */
    description: string;
    /** 신뢰도 (0.0~1.0) */
    confidence: number;
    /** 카테고리 (배송, 결제, 프로모션 등) */
    category: string;
    /** 추론 근거 */
    inferred_from: string;
    /** 조건 분기 목록 */
    conditions?: PolicyCondition[];
    /** ELSE (기본) 결과 설명 */
    defaultResult?: string;
    /** 예외 처리 로직 설명 */
    exceptionHandling?: string | null;
    /** 입력 파라미터 */
    inputVariables?: PolicyVariable[];
    /** 출력(반환) 값 */
    outputVariables?: PolicyVariable[];
    /** 사용 상수값 (하드코딩 여부 포함) */
    constants?: PolicyConstant[];
    /** 내부 핵심 변수 */
    internalVariables?: PolicyVariable[];
    /** 현재 제약사항 목록 */
    constraints?: PolicyConstraint[];
    /** 데이터 출처 목록 */
    dataSources?: PolicyDataSource[];
    /** 정책 간 의존 관계 (Phase 2) */
    dependencies?: PolicyDependency[];
    /** 변경 시 영향 범위 (Phase 2) */
    impactScope?: PolicyImpactScope;
    /** 기획자 확인 체크리스트 */
    reviewItems?: PolicyReviewItem[];
}
/** 조건 분기 항목 */
export interface PolicyCondition {
    /** 분기 순서 (1, 2, 3...) */
    order: number;
    /** 분기 유형 */
    type: 'if' | 'else_if' | 'else';
    /** 조건 설명 (자연어) */
    condition: string;
    /** 원본 조건 코드 */
    conditionCode: string;
    /** 결과 설명 (자연어) */
    result: string;
    /** 결과값 */
    resultValue: string;
}
/** 변수 정보 */
export interface PolicyVariable {
    /** 변수명 */
    name: string;
    /** 타입 */
    type: string;
    /** 역할 설명 (자연어) */
    description: string;
}
/** 상수값 정보 */
export interface PolicyConstant {
    /** 상수명 또는 변수명 */
    name: string;
    /** 현재 설정된 값 */
    value: string;
    /** 타입 */
    type: string;
    /** 역할 설명 */
    description: string;
    /** 값의 출처 */
    source: 'hardcoded' | 'config_file' | 'env_variable' | 'db_query' | 'api_call';
    /** 값이 정의된 코드 위치 (파일:라인) */
    codeLocation: string;
}
/** 제약사항 */
export interface PolicyConstraint {
    /** 심각도 */
    severity: 'warning' | 'info' | 'critical';
    /** 제약 유형 */
    type: 'hardcoded_value' | 'unsupported_case' | 'no_exception_handling' | 'tech_debt' | 'extension_limit';
    /** 제약사항 설명 (자연어) */
    description: string;
    /** 개선 권장사항 */
    recommendation: string;
    /** 관련 코드 위치 */
    relatedCode: string;
}
/** 데이터 출처 */
export interface PolicyDataSource {
    /** 사용하는 변수명 */
    variableName: string;
    /** 출처 유형 */
    sourceType: 'db' | 'api' | 'user_input' | 'session' | 'config' | 'constant';
    /** 상세 출처 (테이블명, API 경로 등) */
    sourceDetail: string;
    /** 설명 */
    description: string;
}
/** 정책 간 의존 관계 (Phase 2) */
export interface PolicyDependency {
    /** 관계 유형 */
    relationType: 'prerequisite' | 'dependent' | 'conflict' | 'related';
    /** 관련 정책명 */
    policyName: string;
    /** 관계 설명 */
    description: string;
    /** 관련 함수명 */
    functionName: string | null;
    /** 관련 파일 경로 */
    filePath: string | null;
}
/** 변경 영향 범위 (Phase 2) */
export interface PolicyImpactScope {
    /** 이 정책을 호출하는 상위 함수/화면 */
    callers: PolicyReference[];
    /** 이 정책이 호출하는 하위 함수 */
    callees: PolicyReference[];
    /** 관련 API 엔드포인트 */
    relatedApis: string[];
    /** 영향 받는 화면 목록 */
    affectedScreens: string[];
    /** 변경 시 영향 요약 (1문장) */
    impactSummary: string;
}
/** 정책 참조 */
export interface PolicyReference {
    /** 참조 대상 이름 */
    name: string;
    /** 파일 경로 */
    filePath: string;
    /** 설명 */
    description: string;
}
/** 기획자 확인 항목 */
export interface PolicyReviewItem {
    /** 우선순위 */
    priority: 'high' | 'medium' | 'low';
    /** 카테고리 */
    category: 'logic_check' | 'value_check' | 'scope_check' | 'conflict_check' | 'missing_case';
    /** 확인 질문 (자연어) */
    question: string;
    /** 확인 필요 사유 */
    context: string;
    /** 관련 제약사항 */
    relatedConstraint: string | null;
}
/** 보강 주석 메타 정보 */
export interface AnnotationMeta {
    /** 버전 */
    version: string;
    /** 생성 시각 */
    createdAt: ISODateString;
    /** 마지막 업데이트 시각 */
    lastUpdatedAt: ISODateString;
    /** 전체 파일 수 */
    totalFiles: number;
    /** 전체 보강 주석 수 */
    totalAnnotations: number;
    /** 전체 정책 수 */
    totalPolicies: number;
    /** 시스템별 통계 */
    systems: Record<string, {
        files: number;
        annotations: number;
        policies: number;
    }>;
    /** 평균 신뢰도 */
    avgConfidence: number;
    /** 낮은 신뢰도 항목 수 (confidence < 0.5) */
    lowConfidenceCount: number;
    /** 사용자 수정 항목 수 */
    userModifiedCount: number;
}
//# sourceMappingURL=annotations.d.ts.map