/**
 * @module core/annotations/annotation-generator
 * @description 규칙 기반 보강 주석 생성기 - 코드 분석을 통한 FunctionAnnotation/AnnotationFile 생성
 *
 * LLM API를 호출하지 않고, 함수명/파라미터/반환타입/코드패턴을 규칙 기반으로 분석하여
 * 보강 주석(enriched_comment)과 추론 정책(InferredPolicy)을 생성한다.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import type {
  AnnotationFile,
  FunctionAnnotation,
  InferredPolicy,
  PolicyVariable,
} from '../../types/annotations';
import type { ParsedFile, FunctionInfo } from '../indexing/types';

// ============================================================
// 옵션 및 컨텍스트 타입
// ============================================================

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

// ============================================================
// 정책 추론 패턴 정의
// ============================================================

/** 함수명 패턴 → 정책 카테고리 매핑 */
const POLICY_PATTERNS: Array<{
  patterns: RegExp[];
  category: string;
  namePrefix: string;
  descriptionTemplate: (funcName: string) => string;
}> = [
  {
    patterns: [/calculate/i, /compute/i, /calc/i],
    category: '계산',
    namePrefix: '계산 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 계산 로직 정책`,
  },
  {
    patterns: [/validate/i, /check/i, /verify/i, /assert/i],
    category: '검증',
    namePrefix: '검증 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 입력값 검증 정책`,
  },
  {
    patterns: [/discount/i, /price/i, /fee/i, /cost/i, /amount/i, /payment/i, /charge/i],
    category: '가격',
    namePrefix: '가격 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 가격/결제 관련 정책`,
  },
  {
    patterns: [/ship/i, /deliver/i, /logistics/i, /dispatch/i],
    category: '배송',
    namePrefix: '배송 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 배송/물류 관련 정책`,
  },
  {
    patterns: [/auth/i, /login/i, /permission/i, /access/i, /token/i, /session/i],
    category: '보안',
    namePrefix: '보안 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 인증/권한 관련 정책`,
  },
  {
    patterns: [/sort/i, /filter/i, /search/i, /query/i, /find/i],
    category: '데이터 처리',
    namePrefix: '데이터 처리 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 데이터 검색/필터 정책`,
  },
  {
    patterns: [/format/i, /transform/i, /convert/i, /parse/i, /serialize/i, /map/i],
    category: '변환',
    namePrefix: '데이터 변환 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 데이터 변환 정책`,
  },
  {
    patterns: [/create/i, /insert/i, /add/i, /save/i, /store/i, /register/i],
    category: '생성',
    namePrefix: '데이터 생성 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 데이터 생성/저장 정책`,
  },
  {
    patterns: [/update/i, /modify/i, /edit/i, /patch/i, /change/i],
    category: '수정',
    namePrefix: '데이터 수정 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 데이터 수정/업데이트 정책`,
  },
  {
    patterns: [/delete/i, /remove/i, /destroy/i, /clear/i],
    category: '삭제',
    namePrefix: '데이터 삭제 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 데이터 삭제 정책`,
  },
  {
    patterns: [/apply/i, /execute/i, /process/i, /run/i, /perform/i],
    category: '실행',
    namePrefix: '비즈니스 실행 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 비즈니스 실행 로직 정책`,
  },
  {
    patterns: [/schedule/i, /cron/i, /batch/i, /job/i, /task/i],
    category: '스케줄링',
    namePrefix: '스케줄링 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 스케줄링/배치 관련 정책`,
  },
  {
    patterns: [/notify/i, /alert/i, /publish/i, /emit/i, /broadcast/i],
    category: '알림',
    namePrefix: '알림 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 알림/이벤트 발행 정책`,
  },
  {
    patterns: [/expire/i, /timeout/i, /ttl/i, /deadline/i],
    category: '만료',
    namePrefix: '만료 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 만료/타임아웃 관련 정책`,
  },
  {
    patterns: [/limit/i, /throttle/i, /quota/i, /restrict/i, /cap/i],
    category: '제한',
    namePrefix: '제한 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 제한/쿼터 관련 정책`,
  },
  {
    patterns: [/retry/i, /fallback/i, /recover/i, /circuit/i, /resilience/i],
    category: '복원',
    namePrefix: '복원 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 복원/재시도 관련 정책`,
  },
  {
    patterns: [/aggregate/i, /reconcile/i, /settle/i, /summarize/i, /total/i],
    category: '정산',
    namePrefix: '정산 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 정산/집계 관련 정책`,
  },
  {
    patterns: [/reserve/i, /allocate/i, /lock/i, /stock/i, /inventory/i],
    category: '재고',
    namePrefix: '재고 정책',
    descriptionTemplate: (fn) => `${fn} 함수의 재고/자원 관리 정책`,
  },
];

/** Spring/Java 메서드 어노테이션 → 정책 매핑 */
const ANNOTATION_POLICY_PATTERNS: Array<{
  annotation: RegExp;
  category: string;
  namePrefix: string;
  descriptionTemplate: (annotationStr: string, funcName: string) => string;
}> = [
  {
    annotation: /^@Transactional/i,
    category: '트랜잭션',
    namePrefix: '트랜잭션 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 트랜잭션 관리 정책`,
  },
  {
    annotation: /^@Cacheable/i,
    category: '캐싱',
    namePrefix: '캐싱 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 캐시 정책`,
  },
  {
    annotation: /^@CacheEvict/i,
    category: '캐싱',
    namePrefix: '캐시 무효화 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 캐시 무효화 정책`,
  },
  {
    annotation: /^@CachePut/i,
    category: '캐싱',
    namePrefix: '캐시 갱신 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 캐시 갱신 정책`,
  },
  {
    annotation: /^@Scheduled/i,
    category: '스케줄링',
    namePrefix: '스케줄링 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 스케줄링 정책`,
  },
  {
    annotation: /^@Async/i,
    category: '비동기',
    namePrefix: '비동기 실행 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 비동기 처리 정책`,
  },
  {
    annotation: /^@PreAuthorize/i,
    category: '보안',
    namePrefix: '접근 권한 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 사전 인가 정책`,
  },
  {
    annotation: /^@Secured/i,
    category: '보안',
    namePrefix: '보안 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 보안 정책`,
  },
  {
    annotation: /^@RolesAllowed/i,
    category: '보안',
    namePrefix: '역할 기반 접근 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 역할 접근 정책`,
  },
  {
    annotation: /^@Retryable/i,
    category: '복원',
    namePrefix: '재시도 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 재시도 정책`,
  },
  {
    annotation: /^@Recover/i,
    category: '복원',
    namePrefix: '복구 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 복구 정책`,
  },
  {
    annotation: /^@CircuitBreaker/i,
    category: '복원',
    namePrefix: '서킷브레이커 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 서킷브레이커 정책`,
  },
  {
    annotation: /^@EventListener/i,
    category: '이벤트',
    namePrefix: '이벤트 리스너 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 이벤트 처리 정책`,
  },
  {
    annotation: /^@TransactionalEventListener/i,
    category: '이벤트',
    namePrefix: '트랜잭션 이벤트 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 트랜잭션 이벤트 정책`,
  },
  {
    annotation: /^@RabbitListener/i,
    category: '메시징',
    namePrefix: '메시지 수신 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 RabbitMQ 메시지 수신 정책`,
  },
  {
    annotation: /^@KafkaListener/i,
    category: '메시징',
    namePrefix: '메시지 수신 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 Kafka 메시지 수신 정책`,
  },
  {
    annotation: /^@RateLimiter/i,
    category: '제한',
    namePrefix: '요청 제한 정책',
    descriptionTemplate: (ann, fn) => `${fn}: ${ann} 기반 요청 제한 정책`,
  },
];

/** 파일 경로 패턴 → 파일 유형 매핑 */
const FILE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /service/i, type: 'service' },
  { pattern: /controller/i, type: 'controller' },
  { pattern: /handler/i, type: 'handler' },
  { pattern: /middleware/i, type: 'middleware' },
  { pattern: /component/i, type: 'component' },
  { pattern: /hook/i, type: 'hook' },
  { pattern: /util/i, type: 'util' },
  { pattern: /helper/i, type: 'helper' },
  { pattern: /model/i, type: 'model' },
  { pattern: /repository/i, type: 'repository' },
  { pattern: /store/i, type: 'store' },
  { pattern: /config/i, type: 'config' },
  { pattern: /constant/i, type: 'constant' },
  { pattern: /route/i, type: 'route' },
  { pattern: /test/i, type: 'test' },
  { pattern: /spec/i, type: 'spec' },
  { pattern: /mapper/i, type: 'mapper' },
  { pattern: /entity/i, type: 'entity' },
  { pattern: /dto/i, type: 'dto' },
  { pattern: /vo/i, type: 'vo' },
  { pattern: /enum/i, type: 'enum' },
  { pattern: /aspect/i, type: 'aspect' },
  { pattern: /listener/i, type: 'listener' },
  { pattern: /interceptor/i, type: 'interceptor' },
  { pattern: /filter(?!\.)/i, type: 'filter' },
  { pattern: /converter/i, type: 'converter' },
  { pattern: /adapter/i, type: 'adapter' },
  { pattern: /facade/i, type: 'facade' },
  { pattern: /gateway/i, type: 'gateway' },
  { pattern: /client/i, type: 'client' },
  { pattern: /producer/i, type: 'producer' },
  { pattern: /consumer/i, type: 'consumer' },
  { pattern: /scheduler/i, type: 'scheduler' },
  { pattern: /batch/i, type: 'batch' },
  { pattern: /impl/i, type: 'implementation' },
  { pattern: /validator/i, type: 'validator' },
];

// ============================================================
// 분석기 버전
// ============================================================

const ANALYZER_VERSION = '1.0.0';
const ANALYZER_MODEL = 'rule-based-v1';

// ============================================================
// AnnotationGenerator
// ============================================================

/**
 * AnnotationGenerator - 규칙 기반 보강 주석 생성기
 *
 * ParsedFile 구조를 입력으로 받아, 각 함수에 대한 FunctionAnnotation을 생성하고
 * AnnotationFile 구조로 조합하여 반환한다.
 * LLM API를 호출하지 않으며, 함수명/파라미터/반환타입/코드 패턴을 규칙 기반으로 분석한다.
 */
export class AnnotationGenerator {
  private readonly depth: 'basic' | 'detailed';
  private readonly priorityTypes: string[];

  constructor(options?: AnnotationGeneratorOptions) {
    this.depth = options?.depth ?? 'detailed';
    this.priorityTypes = options?.priorityTypes ?? [];
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * 단일 파일 분석 -> AnnotationFile 생성
   *
   * @param filePath - 분석 대상 파일 경로 (프로젝트 루트 상대)
   * @param parsedFile - 파서가 추출한 ParsedFile 정보
   * @param projectPath - 프로젝트 루트 절대 경로
   * @returns 생성된 AnnotationFile
   */
  async generateForFile(
    filePath: string,
    parsedFile: ParsedFile,
    projectPath: string,
  ): Promise<AnnotationFile> {
    const fileContext = this.buildFileContext(filePath, parsedFile);
    const system = this.inferSystem(filePath, projectPath);

    const annotations: FunctionAnnotation[] = parsedFile.functions.map((func) =>
      this.analyzeFunction(func, filePath, fileContext),
    );

    // 파일 내용을 시뮬레이션하여 sourceHash 계산 (함수 시그니처 기반)
    const contentForHash = parsedFile.functions
      .map((f) => f.signature)
      .join('\n');
    const sourceHash = this.calculateSourceHash(contentForHash);

    // 파일 요약 생성
    const fileSummary = this.generateFileSummary(
      filePath,
      parsedFile,
      annotations,
      fileContext,
    );

    const annotationFile: AnnotationFile = {
      file: filePath,
      system,
      lastAnalyzed: new Date().toISOString(),
      sourceHash,
      analyzerVersion: ANALYZER_VERSION,
      model: ANALYZER_MODEL,
      fileSummary,
      annotations,
    };

    return annotationFile;
  }

  /**
   * 배치 분석 (여러 파일 한번에)
   *
   * @param files - 분석 대상 파일 배열
   * @param projectPath - 프로젝트 루트 경로
   * @param onProgress - 진행 콜백 (current, total, filePath)
   * @returns 파일경로 -> AnnotationFile 맵
   */
  async generateBatch(
    files: Array<{ filePath: string; parsedFile: ParsedFile }>,
    projectPath: string,
    onProgress?: (current: number, total: number, filePath: string) => void,
  ): Promise<Map<string, AnnotationFile>> {
    const results = new Map<string, AnnotationFile>();

    // priorityTypes 필터 적용: 지정된 경우 해당 유형 파일만 처리
    const filteredFiles = this.priorityTypes.length > 0
      ? files.filter(({ filePath: fp }) => {
          const normalizedPath = fp.replace(/\\/g, '/').toLowerCase();
          return this.priorityTypes.some((t) => normalizedPath.includes(t.toLowerCase()));
        })
      : files;

    const total = filteredFiles.length;

    for (let i = 0; i < filteredFiles.length; i++) {
      const { filePath, parsedFile } = filteredFiles[i];
      onProgress?.(i + 1, total, filePath);

      const annotationFile = await this.generateForFile(
        filePath,
        parsedFile,
        projectPath,
      );
      results.set(filePath, annotationFile);
    }

    return results;
  }

  // ----------------------------------------------------------
  // 함수 분석 (Private)
  // ----------------------------------------------------------

  /**
   * 단일 함수 분석 -> FunctionAnnotation 생성
   */
  analyzeFunction(
    func: FunctionInfo,
    _filePath: string,
    fileContext: FileContext,
  ): FunctionAnnotation {
    const funcType = this.classifyFunctionType(func, fileContext);
    const policies = this.inferPolicies(func, fileContext);
    const originalComment = this.findOriginalComment();
    const enrichedComment = this.generateEnrichedComment(func, fileContext);
    const confidence = this.calculateConfidence(func, policies, originalComment);
    const inferredFrom = this.buildInferredFrom(func, fileContext);

    const annotation: FunctionAnnotation = {
      line: func.startLine,
      endLine: func.endLine,
      function: func.name,
      signature: func.signature,
      original_comment: originalComment,
      enriched_comment: enrichedComment,
      confidence,
      type: funcType,
      userModified: false,
      lastModifiedBy: null,
      inferred_from: inferredFrom,
      policies,
      relatedFunctions: [],
      relatedApis: [],
    };

    return annotation;
  }

  // ----------------------------------------------------------
  // 정책 추론 (Private)
  // ----------------------------------------------------------

  /**
   * 함수에서 정책 추론
   */
  inferPolicies(
    func: FunctionInfo,
    _fileContext: FileContext,
  ): InferredPolicy[] {
    // basic 모드에서는 정책 추론 건너뜀
    if (this.depth === 'basic') {
      return [];
    }

    const policies: InferredPolicy[] = [];
    const funcName = this.getBaseFunctionName(func.name);

    for (const policyPattern of POLICY_PATTERNS) {
      const matched = policyPattern.patterns.some((p) => p.test(funcName));
      if (!matched) continue;

      const inputVariables: PolicyVariable[] = func.params.map((p) => ({
        name: p.name,
        type: p.type ?? 'unknown',
        description: `${p.name} 파라미터`,
      }));

      const outputVariables: PolicyVariable[] = func.returnType
        ? [
            {
              name: 'result',
              type: func.returnType,
              description: `${funcName} 반환값`,
            },
          ]
        : [];

      const policy: InferredPolicy = {
        name: `${policyPattern.namePrefix}: ${funcName}`,
        description: policyPattern.descriptionTemplate(funcName),
        confidence: this.calculatePolicyConfidence(func),
        category: policyPattern.category,
        inferred_from: `함수명 패턴 매칭: ${funcName}`,
        conditions: [],
        inputVariables,
        outputVariables,
        constants: [],
        constraints: [],
      };

      policies.push(policy);
    }

    // 2. 메서드 어노테이션 기반 정책 추론
    if (func.annotations && func.annotations.length > 0) {
      for (const ann of func.annotations) {
        for (const annPattern of ANNOTATION_POLICY_PATTERNS) {
          if (annPattern.annotation.test(ann)) {
            const annPolicy: InferredPolicy = {
              name: `${annPattern.namePrefix}: ${funcName}`,
              description: annPattern.descriptionTemplate(ann, funcName),
              confidence: this.calculateAnnotationPolicyConfidence(ann),
              category: annPattern.category,
              inferred_from: `메서드 어노테이션: ${ann}`,
              conditions: [],
              inputVariables: func.params.map((p) => ({
                name: p.name,
                type: p.type ?? 'unknown',
                description: `${p.name} 파라미터`,
              })),
              outputVariables: func.returnType
                ? [{ name: 'result', type: func.returnType, description: `${funcName} 반환값` }]
                : [],
              constants: [],
              constraints: [],
            };
            policies.push(annPolicy);
            break; // 하나의 어노테이션당 하나의 패턴만 매칭
          }
        }
      }
    }

    return policies;
  }

  // ----------------------------------------------------------
  // 함수 유형 분류 (Private)
  // ----------------------------------------------------------

  /**
   * 함수 유형 판별
   *
   * FunctionAnnotation.type은 'business_logic' | 'utility' | 'data_access' | 'integration' | 'config'
   * 파일 위치와 함수명을 기반으로 유형을 분류한다.
   */
  classifyFunctionType(
    func: FunctionInfo,
    fileContext: FileContext,
  ): FunctionAnnotation['type'] {
    const { fileType } = fileContext;
    const funcName = this.getBaseFunctionName(func.name).toLowerCase();

    // 파일 유형 기반 분류
    if (fileType === 'service' || fileType === 'handler') {
      return 'business_logic';
    }
    if (fileType === 'controller' || fileType === 'route') {
      return 'integration';
    }
    if (
      fileType === 'util' ||
      fileType === 'helper' ||
      fileType === 'hook'
    ) {
      return 'utility';
    }
    if (
      fileType === 'model' ||
      fileType === 'repository' ||
      fileType === 'store'
    ) {
      return 'data_access';
    }
    if (fileType === 'config' || fileType === 'constant') {
      return 'config';
    }
    if (fileType === 'component') {
      return 'integration';
    }
    if (fileType === 'middleware') {
      return 'integration';
    }
    if (fileType === 'mapper' || fileType === 'entity' || fileType === 'dto' || fileType === 'vo') {
      return 'data_access';
    }
    if (fileType === 'aspect' || fileType === 'interceptor' || fileType === 'filter') {
      return 'integration';
    }
    if (fileType === 'listener' || fileType === 'consumer' || fileType === 'producer') {
      return 'integration';
    }
    if (fileType === 'validator') {
      return 'business_logic';
    }
    if (fileType === 'converter' || fileType === 'adapter') {
      return 'utility';
    }
    if (fileType === 'facade' || fileType === 'gateway' || fileType === 'client') {
      return 'integration';
    }
    if (fileType === 'scheduler' || fileType === 'batch') {
      return 'business_logic';
    }
    if (fileType === 'implementation') {
      return 'business_logic';
    }
    if (fileType === 'enum') {
      return 'config';
    }

    // 함수명 패턴 기반 분류
    if (/^(get|fetch|find|query|load|read|select)/i.test(funcName)) {
      return 'data_access';
    }
    if (/^(create|insert|save|update|delete|remove|patch)/i.test(funcName)) {
      return 'data_access';
    }
    if (/^(format|convert|transform|parse|serialize|map|reduce)/i.test(funcName)) {
      return 'utility';
    }
    if (/^(handle|on[A-Z]|process|dispatch)/i.test(funcName)) {
      return 'integration';
    }
    if (/^(calculate|compute|validate|check|verify)/i.test(funcName)) {
      return 'business_logic';
    }
    if (/^(init|setup|configure|register)/i.test(funcName)) {
      return 'config';
    }

    // 기본값
    return 'business_logic';
  }

  // ----------------------------------------------------------
  // enriched_comment 생성 (Private)
  // ----------------------------------------------------------

  /**
   * enriched_comment 생성
   *
   * 함수의 이름, 파라미터, 반환 타입, 비동기 여부 등을 분석하여
   * 사람이 읽을 수 있는 보강 주석을 생성한다.
   */
  generateEnrichedComment(
    func: FunctionInfo,
    fileContext: FileContext,
  ): string {
    const funcName = this.getBaseFunctionName(func.name);
    const parts: string[] = [];

    // 함수 의도 추론
    const intent = this.inferFunctionIntent(funcName);
    parts.push(intent);

    // 파라미터 설명
    if (func.params.length > 0) {
      const paramDesc = func.params
        .map((p) => {
          const typeStr = p.type ? ` (${p.type})` : '';
          return `${p.name}${typeStr}`;
        })
        .join(', ');
      parts.push(`입력: ${paramDesc}`);
    }

    // 반환 타입 설명
    if (func.returnType) {
      parts.push(`반환: ${func.returnType}`);
    }

    // 비동기 여부
    if (func.isAsync) {
      parts.push('비동기 처리');
    }

    // 파일 유형 컨텍스트
    if (fileContext.fileType && fileContext.fileType !== 'unknown') {
      parts.push(`위치: ${fileContext.fileType}`);
    }

    return parts.join('. ') + '.';
  }

  // ----------------------------------------------------------
  // 신뢰도 계산 (Private)
  // ----------------------------------------------------------

  /**
   * 신뢰도 계산
   *
   * 기본 0.5에서 시작하여, 다양한 조건에 따라 가중치를 더한다.
   * 최대 1.0
   */
  calculateConfidence(
    func: FunctionInfo,
    policies: InferredPolicy[],
    originalComment?: string | null,
  ): number {
    let confidence = 0.5;

    // 기존 주석(JSDoc) 있으면 +0.1
    if (originalComment) {
      confidence += 0.1;
    }

    // 파라미터 타입이 명시되어 있으면 +0.1
    const hasTypedParams = func.params.some((p) => p.type !== undefined);
    if (hasTypedParams) {
      confidence += 0.1;
    }

    // 반환 타입이 명시되어 있으면 +0.1
    if (func.returnType) {
      confidence += 0.1;
    }

    // 추론된 정책이 있으면 +0.1
    if (policies.length > 0) {
      confidence += 0.1;
    }

    // 함수 본문이 충분히 길면 (10줄 이상) +0.1
    const bodyLines = func.endLine - func.startLine + 1;
    if (bodyLines >= 10) {
      confidence += 0.1;
    }

    // FunctionInfo에 어노테이션이 있으면 +0.05 (정보가 더 풍부하므로)
    if (func.annotations && func.annotations.length > 0) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  // ----------------------------------------------------------
  // sourceHash 계산 (Private)
  // ----------------------------------------------------------

  /**
   * 콘텐츠의 SHA-256 해시 계산
   */
  calculateSourceHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  // ----------------------------------------------------------
  // Helper Methods (Private)
  // ----------------------------------------------------------

  /**
   * FileContext 생성
   */
  private buildFileContext(
    filePath: string,
    parsedFile: ParsedFile,
  ): FileContext {
    const fileName = path.basename(filePath, path.extname(filePath));
    const imports = parsedFile.imports.map((imp) => imp.source);
    const existingComments = parsedFile.comments.map((c) => c.text);
    const fileType = this.classifyFileType(filePath);

    return {
      filePath,
      fileName,
      imports,
      existingComments,
      fileType,
    };
  }

  /**
   * 파일 경로에서 파일 유형 분류
   */
  private classifyFileType(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    for (const { pattern, type } of FILE_TYPE_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * 시스템 이름 추론 (프로젝트 구조에서)
   */
  private inferSystem(filePath: string, _projectPath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    // src/modules/xxx 또는 src/xxx 에서 시스템명 추출
    const srcIdx = parts.indexOf('src');
    if (srcIdx >= 0 && srcIdx + 1 < parts.length) {
      return parts[srcIdx + 1];
    }
    return 'default';
  }

  /**
   * 함수명에서 비즈니스 의도 추론
   */
  private inferFunctionIntent(funcName: string): string {
    // camelCase/PascalCase를 단어로 분리
    const words = funcName
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .split(/\s+/);

    if (words.length === 0) {
      return `${funcName} 함수`;
    }

    const verb = words[0];
    const rest = words.slice(1).join(' ');

    const verbMap: Record<string, string> = {
      get: '조회',
      fetch: '조회',
      find: '검색',
      search: '검색',
      query: '쿼리',
      load: '로드',
      read: '읽기',
      create: '생성',
      add: '추가',
      insert: '삽입',
      save: '저장',
      store: '저장',
      register: '등록',
      update: '수정',
      modify: '변경',
      edit: '편집',
      patch: '패치',
      change: '변경',
      delete: '삭제',
      remove: '제거',
      destroy: '파괴',
      clear: '초기화',
      calculate: '계산',
      compute: '계산',
      calc: '계산',
      validate: '검증',
      check: '확인',
      verify: '검증',
      assert: '확인',
      format: '포맷',
      transform: '변환',
      convert: '변환',
      parse: '파싱',
      serialize: '직렬화',
      handle: '처리',
      process: '처리',
      dispatch: '디스패치',
      send: '전송',
      submit: '제출',
      publish: '발행',
      emit: '이벤트 발행',
      init: '초기화',
      setup: '설정',
      configure: '설정',
      render: '렌더링',
      display: '표시',
      show: '표시',
      hide: '숨기기',
      toggle: '토글',
      sort: '정렬',
      filter: '필터',
      map: '매핑',
      reduce: '리듀스',
      merge: '병합',
      split: '분리',
      set: '설정',
      reset: '리셋',
      is: '여부 판단',
      has: '존재 확인',
      can: '가능 여부 확인',
      should: '조건 판단',
    };

    const koreanVerb = verbMap[verb] ?? verb;
    const objectDesc = rest ? ` ${rest}` : '';

    return `${objectDesc}${objectDesc ? ' ' : ''}${koreanVerb} 로직`;
  }

  /**
   * 함수명에서 클래스 접두사 제거 (ClassName.method -> method)
   */
  private getBaseFunctionName(name: string): string {
    const dotIdx = name.lastIndexOf('.');
    return dotIdx >= 0 ? name.substring(dotIdx + 1) : name;
  }

  /**
   * 함수 바로 위의 원본 주석 찾기
   */
  private findOriginalComment(): string | null {
    // 함수 시작 라인 바로 위 1-3줄 범위에서 주석 찾기
    // fileContext.existingComments에는 텍스트만 있으므로, 간접적으로 매칭
    // 여기서는 간단히 null 반환 (detailed 모드에서 확장 가능)
    // 실제 매칭은 CommentInfo의 line 정보가 필요하지만 FileContext에는 없음
    // 이 부분은 향후 개선
    return null;
  }

  /**
   * 추론 근거 문자열 생성
   */
  private buildInferredFrom(
    func: FunctionInfo,
    fileContext: FileContext,
  ): string {
    const sources: string[] = [];
    sources.push(`함수명: ${func.name}`);
    if (func.params.length > 0) {
      sources.push(`파라미터: ${func.params.map((p) => p.name).join(', ')}`);
    }
    if (func.returnType) {
      sources.push(`반환타입: ${func.returnType}`);
    }
    sources.push(`파일유형: ${fileContext.fileType}`);
    return sources.join('; ');
  }

  /**
   * 정책 신뢰도 계산 (InferredPolicy 용)
   */
  private calculatePolicyConfidence(func: FunctionInfo): number {
    let conf = 0.4;
    if (func.params.some((p) => p.type !== undefined)) conf += 0.1;
    if (func.returnType) conf += 0.1;
    const bodyLines = func.endLine - func.startLine + 1;
    if (bodyLines >= 5) conf += 0.1;
    if (bodyLines >= 10) conf += 0.1;
    return Math.min(conf, 1.0);
  }

  /**
   * 어노테이션 기반 정책 신뢰도 계산
   *
   * 어노테이션은 명시적 선언이므로 함수명 기반(0.4)보다 높은 기본값(0.7)을 사용한다.
   * 파라미터가 있거나 상세 설정이 있으면 추가 가점.
   */
  private calculateAnnotationPolicyConfidence(annotation: string): number {
    let conf = 0.7;
    // 어노테이션에 파라미터가 있으면 더 구체적이므로 +0.1
    if (annotation.includes('(')) conf += 0.1;
    // 어노테이션에 value나 key 같은 상세 설정이 있으면 +0.1
    if (/value\s*=|key\s*=|cron\s*=|maxAttempts/i.test(annotation)) conf += 0.1;
    return Math.min(conf, 1.0);
  }

  /**
   * 파일 요약 생성
   */
  private generateFileSummary(
    _filePath: string,
    parsedFile: ParsedFile,
    annotations: FunctionAnnotation[],
    fileContext: FileContext,
  ): AnnotationFile['fileSummary'] {
    const funcCount = parsedFile.functions.length;
    const typeDesc = fileContext.fileType !== 'unknown'
      ? `${fileContext.fileType} 파일`
      : '소스 파일';
    const description = `${fileContext.fileName}: ${funcCount}개 함수를 포함하는 ${typeDesc}`;

    // 평균 신뢰도
    const avgConfidence =
      annotations.length > 0
        ? annotations.reduce((sum, a) => sum + a.confidence, 0) / annotations.length
        : 0;

    // 비즈니스 도메인 추론
    const businessDomain = this.inferBusinessDomain(parsedFile, fileContext);

    // 키워드 추출
    const keywords = this.extractKeywords(parsedFile, fileContext);

    return {
      description,
      confidence: Math.round(avgConfidence * 100) / 100,
      businessDomain,
      keywords,
    };
  }

  /**
   * 비즈니스 도메인 추론
   */
  private inferBusinessDomain(
    parsedFile: ParsedFile,
    fileContext: FileContext,
  ): string {
    const allNames = parsedFile.functions.map((f) => f.name.toLowerCase());
    const combined = [...allNames, fileContext.fileName.toLowerCase()].join(' ');

    if (/order|cart|checkout|purchase/.test(combined)) return '주문';
    if (/product|item|catalog|goods/.test(combined)) return '상품';
    if (/user|member|profile|account/.test(combined)) return '회원';
    if (/payment|billing|invoice/.test(combined)) return '결제';
    if (/ship|deliver|logistics/.test(combined)) return '배송';
    if (/auth|login|token|session/.test(combined)) return '인증';
    if (/discount|coupon|promotion/.test(combined)) return '프로모션';
    if (/review|rating|comment/.test(combined)) return '리뷰';
    if (/notification|alert|message/.test(combined)) return '알림';
    if (/search|filter|sort/.test(combined)) return '검색';

    return '일반';
  }

  /**
   * 파일에서 키워드 추출
   */
  private extractKeywords(
    parsedFile: ParsedFile,
    fileContext: FileContext,
  ): string[] {
    const keywords = new Set<string>();

    // 파일 유형
    if (fileContext.fileType !== 'unknown') {
      keywords.add(fileContext.fileType);
    }

    // 함수명에서 주요 단어 추출
    for (const func of parsedFile.functions) {
      const baseName = this.getBaseFunctionName(func.name);
      const words = baseName
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      for (const word of words) {
        keywords.add(word);
      }
    }

    // import에서 주요 패키지 추출
    for (const imp of fileContext.imports) {
      if (!imp.startsWith('.') && !imp.startsWith('@/')) {
        const pkg = imp.split('/')[0].replace('@', '');
        if (pkg.length > 1) {
          keywords.add(pkg);
        }
      }
    }

    return Array.from(keywords).slice(0, 10);
  }
}
