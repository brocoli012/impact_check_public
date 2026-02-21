/**
 * @module types/index
 * @description 인덱스 관련 타입 정의 - 코드 인덱싱 결과 스키마
 */
import { ISODateString, FilePath, UniqueId } from './common';
/** 프로젝트 목록 설정 (projects.json 스키마) */
export interface ProjectsConfig {
    /** 현재 활성 프로젝트 ID */
    activeProject: string;
    /** 등록된 프로젝트 목록 */
    projects: ProjectEntry[];
}
/** 프로젝트 엔트리 */
export interface ProjectEntry {
    /** 고유 ID (kebab-case 이름) */
    id: string;
    /** 표시 이름 */
    name: string;
    /** Git 레포 절대 경로 */
    path: string;
    /** 프로젝트 상태 */
    status: 'active' | 'archived';
    /** 생성 시각 */
    createdAt: ISODateString;
    /** 마지막 사용 시각 */
    lastUsedAt: ISODateString;
    /** 기술 스택 */
    techStack: string[];
}
/** 인덱스 메타 정보 (meta.json 스키마) */
export interface IndexMeta {
    /** 인덱스 버전 */
    version: number;
    /** 생성 시각 */
    createdAt: ISODateString;
    /** 업데이트 시각 */
    updatedAt: ISODateString;
    /** Git 커밋 해시 */
    gitCommit: string;
    /** Git 브랜치명 */
    gitBranch: string;
    /** 프로젝트 정보 */
    project: {
        /** 프로젝트명 */
        name: string;
        /** 프로젝트 경로 */
        path: string;
        /** 기술 스택 */
        techStack: string[];
        /** 패키지 매니저 */
        packageManager: string;
    };
    /** 마지막 업데이트 유형 */
    lastUpdateType?: 'full' | 'incremental';
    /** 통계 정보 */
    stats: {
        /** 전체 파일 수 */
        totalFiles: number;
        /** 화면 수 */
        screens: number;
        /** 컴포넌트 수 */
        components: number;
        /** API 엔드포인트 수 */
        apiEndpoints: number;
        /** 모델 수 */
        models: number;
        /** 모듈 수 */
        modules: number;
    };
}
/** 화면 정보 (screens.json 항목) */
export interface ScreenInfo {
    /** 화면 고유 ID */
    id: UniqueId;
    /** 화면 이름 */
    name: string;
    /** 라우트 경로 */
    route: string;
    /** 파일 경로 */
    filePath: FilePath;
    /** 포함된 컴포넌트 ID 목록 */
    components: UniqueId[];
    /** 호출하는 API ID 목록 */
    apiCalls: UniqueId[];
    /** 자식 화면 ID 목록 */
    childScreens: UniqueId[];
    /** 메타데이터 */
    metadata: {
        /** 코드 라인 수 */
        linesOfCode: number;
        /** 복잡도 */
        complexity: 'low' | 'medium' | 'high';
    };
}
/** 컴포넌트 정보 (components.json 항목) */
export interface ComponentInfo {
    /** 컴포넌트 고유 ID */
    id: UniqueId;
    /** 컴포넌트 이름 */
    name: string;
    /** 파일 경로 */
    filePath: FilePath;
    /** 컴포넌트 유형 */
    type: string;
    /** import하는 컴포넌트 ID 목록 */
    imports: UniqueId[];
    /** 이 컴포넌트를 import하는 대상 ID 목록 */
    importedBy: UniqueId[];
    /** Props 목록 */
    props: string[];
    /** Emit 이벤트 목록 */
    emits: string[];
    /** 호출하는 API ID 목록 */
    apiCalls: UniqueId[];
    /** 코드 라인 수 */
    linesOfCode: number;
}
/** API 엔드포인트 정보 (apis.json 항목) */
export interface ApiEndpoint {
    /** API 고유 ID */
    id: UniqueId;
    /** HTTP 메서드 */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** API 경로 */
    path: string;
    /** 파일 경로 */
    filePath: FilePath;
    /** 핸들러 함수명 */
    handler: string;
    /** 호출하는 컴포넌트/모듈 ID 목록 */
    calledBy: UniqueId[];
    /** 요청 파라미터 */
    requestParams: string[];
    /** 응답 타입 */
    responseType: string;
    /** 관련 모델 ID 목록 */
    relatedModels: UniqueId[];
}
/** 데이터 모델 정보 (models.json 항목) */
export interface ModelInfo {
    /** 모델 고유 ID */
    id: UniqueId;
    /** 모델 이름 */
    name: string;
    /** 파일 경로 */
    filePath: FilePath;
    /** 모델 유형 (interface, type, ORM model 등) */
    type: string;
    /** 필드 목록 */
    fields: ModelField[];
    /** 관련 API ID 목록 */
    relatedApis: UniqueId[];
}
/** 모델 필드 */
export interface ModelField {
    /** 필드명 */
    name: string;
    /** 필드 타입 */
    type: string;
    /** 필수 여부 */
    required: boolean;
    /** 설명 */
    description?: string;
}
/** 의존 관계 그래프 (dependencies.json 스키마) */
export interface DependencyGraph {
    /** 그래프 정보 */
    graph: {
        /** 노드 목록 */
        nodes: DependencyNode[];
        /** 엣지 목록 */
        edges: DependencyEdge[];
    };
}
/** 의존 관계 노드 */
export interface DependencyNode {
    /** 노드 ID */
    id: UniqueId;
    /** 노드 유형 */
    type: 'screen' | 'component' | 'api' | 'model' | 'module';
    /** 노드 이름 */
    name: string;
}
/** 의존 관계 엣지 */
export interface DependencyEdge {
    /** 출발 노드 ID */
    from: UniqueId;
    /** 도착 노드 ID */
    to: UniqueId;
    /** 관계 유형 */
    type: 'import' | 'api-call' | 'data-reference' | 'route';
}
/** 정책 정보 (policies.json 항목) */
export interface PolicyInfo {
    /** 정책 고유 ID */
    id: UniqueId;
    /** 정책명 */
    name: string;
    /** 정책 설명 */
    description: string;
    /** 출처 */
    source: 'comment' | 'readme' | 'manual' | 'annotation';
    /** 원본 텍스트 */
    sourceText: string;
    /** 신뢰도 (0.0~1.0, AI 추론 등 옵셔널) */
    confidence?: number;
    /** 파일 경로 */
    filePath: FilePath;
    /** 라인 번호 */
    lineNumber: number;
    /** 카테고리 */
    category: string;
    /** 관련 컴포넌트 ID 목록 */
    relatedComponents: UniqueId[];
    /** 관련 API ID 목록 */
    relatedApis: UniqueId[];
    /** 관련 모듈 목록 */
    relatedModules: string[];
    /** 추출 시각 */
    extractedAt: ISODateString;
}
/** 파일 정보 (files.json 항목) */
export interface FileInfo {
    /** 파일 경로 */
    path: FilePath;
    /** 파일 해시 (SHA-256) */
    hash: string;
    /** 파일 크기 (bytes) */
    size: number;
    /** 파일 유형 */
    extension: string;
    /** 마지막 수정 시각 */
    lastModified: ISODateString;
}
/** 변경된 파일 세트 - Git diff 또는 해시 비교 결과 */
export interface ChangedFileSet {
    /** 신규 파일 경로 (프로젝트 루트 상대) */
    added: FilePath[];
    /** 수정 파일 경로 */
    modified: FilePath[];
    /** 삭제 파일 경로 */
    deleted: FilePath[];
    /** 감지 방법 */
    method: 'git-diff' | 'hash-compare';
}
/** 전체 코드 인덱스 */
export interface CodeIndex {
    /** 메타 정보 */
    meta: IndexMeta;
    /** 파일 목록 */
    files: FileInfo[];
    /** 화면 목록 */
    screens: ScreenInfo[];
    /** 컴포넌트 목록 */
    components: ComponentInfo[];
    /** API 엔드포인트 목록 */
    apis: ApiEndpoint[];
    /** 데이터 모델 목록 */
    models: ModelInfo[];
    /** 정책 목록 */
    policies: PolicyInfo[];
    /** 의존 관계 그래프 */
    dependencies: DependencyGraph;
}
//# sourceMappingURL=index.d.ts.map