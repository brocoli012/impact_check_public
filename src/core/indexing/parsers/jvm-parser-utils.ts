/**
 * @module core/indexing/parsers/jvm-parser-utils
 * @description JVM 파서 공통 유틸리티 - JavaParser와 KotlinParser가 공유하는 Spring Boot 관련 상수 및 헬퍼 함수
 */

import { logger } from '../../../utils/logger';

// ============================================================
// Spring Boot 어노테이션 상수
// ============================================================

/** Spring 라우트 관련 어노테이션 */
export const SPRING_ROUTE_ANNOTATIONS = [
  'RequestMapping',
  'GetMapping',
  'PostMapping',
  'PutMapping',
  'PatchMapping',
  'DeleteMapping',
];

/** Spring 컴포넌트 어노테이션 */
export const SPRING_COMPONENT_ANNOTATIONS = [
  'Controller',
  'RestController',
  'Service',
  'Repository',
  'Component',
  'Configuration',
];

/** 의존성 주입(DI) 어노테이션 */
export const DI_ANNOTATIONS = ['Autowired', 'Inject', 'Resource', 'Value'];

/** JPA/데이터 엔티티 어노테이션 */
export const ENTITY_ANNOTATIONS = ['Entity', 'Table', 'Document', 'MappedSuperclass'];

/** 어노테이션 이름 → HTTP 메서드 매핑 */
export const ANNOTATION_HTTP_METHOD_MAP: Record<string, string> = {
  'GetMapping': 'GET',
  'PostMapping': 'POST',
  'PutMapping': 'PUT',
  'PatchMapping': 'PATCH',
  'DeleteMapping': 'DELETE',
  'RequestMapping': 'GET',
};

// ============================================================
// 어노테이션 파싱 함수
// ============================================================

/**
 * 어노테이션 텍스트에서 경로 값을 추출
 * @param annotationText - 어노테이션 전체 텍스트
 * @returns 추출된 경로 문자열, 없으면 빈 문자열
 */
export function parseAnnotationValue(annotationText: string): string {
  try {
    const parenStart = annotationText.indexOf('(');
    if (parenStart === -1) {
      return '';
    }

    const parenEnd = annotationText.lastIndexOf(')');
    if (parenEnd === -1 || parenEnd <= parenStart) {
      return '';
    }

    const inner = annotationText.substring(parenStart + 1, parenEnd).trim();
    if (!inner) {
      return '';
    }

    // value= 또는 path= 속성에서 추출
    const valueMatch = inner.match(/(?:value|path)\s*=\s*"([^"]*)"/) ;
    if (valueMatch) {
      return valueMatch[1];
    }

    // 단일 문자열 값
    const directStringMatch = inner.match(/^"([^"]*)"$/);
    if (directStringMatch) {
      return directStringMatch[1];
    }

    // 첫 번째 인자가 문자열인 경우
    const firstArgMatch = inner.match(/^"([^"]*)"/);
    if (firstArgMatch) {
      return firstArgMatch[1];
    }

    return '';
  } catch (err) {
    logger.debug(`Failed to parse annotation value: ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
}

/**
 * 어노테이션 이름과 텍스트로부터 Spring HTTP 메서드를 결정
 * @param annotationName - 어노테이션 이름
 * @param annotationText - 어노테이션 전체 텍스트
 * @returns HTTP 메서드 문자열
 */
export function resolveSpringHttpMethod(annotationName: string, annotationText: string): string {
  try {
    if (annotationName !== 'RequestMapping') {
      return ANNOTATION_HTTP_METHOD_MAP[annotationName] || 'GET';
    }

    const methodMatch = annotationText.match(/method\s*=\s*RequestMethod\.(\w+)/);
    if (methodMatch) {
      return methodMatch[1].toUpperCase();
    }

    return 'GET';
  } catch (err) {
    logger.debug(`Failed to resolve HTTP method: ${err instanceof Error ? err.message : String(err)}`);
    return 'GET';
  }
}

// ============================================================
// 경로 조합 함수
// ============================================================

/**
 * 클래스 레벨 경로와 메서드 레벨 경로를 결합
 * @param basePath - 클래스 레벨 경로
 * @param methodPath - 메서드 레벨 경로
 * @returns 결합된 경로
 */
export function combineRoutePaths(basePath: string, methodPath: string): string {
  try {
    if (!basePath && !methodPath) {
      return '';
    }
    if (!basePath) {
      return methodPath;
    }
    if (!methodPath) {
      return basePath;
    }

    const normalizedBase = basePath.replace(/\/+$/, '');
    const normalizedMethod = methodPath.replace(/^\/+/, '');

    return `${normalizedBase}/${normalizedMethod}`;
  } catch (err) {
    logger.debug(`Failed to combine route paths: ${err instanceof Error ? err.message : String(err)}`);
    return basePath || methodPath || '';
  }
}

// ============================================================
// 컴포넌트/엔티티 판별 함수
// ============================================================

/**
 * 어노테이션 목록에 Spring 컴포넌트 어노테이션이 포함되어 있는지 확인
 * @param annotations - 어노테이션 이름 목록
 * @returns Spring 컴포넌트이면 true
 */
export function isSpringComponent(annotations: string[]): boolean {
  return annotations.some(ann => SPRING_COMPONENT_ANNOTATIONS.includes(ann));
}

/**
 * 어노테이션 목록으로부터 Spring 컴포넌트 타입을 결정
 * @param annotations - 어노테이션 이름 목록
 * @returns 컴포넌트 타입 문자열
 */
export function mapSpringComponentType(annotations: string[]): string {
  const typeMap: Record<string, string> = {
    'RestController': 'rest-controller',
    'Controller': 'controller',
    'Service': 'service',
    'Repository': 'repository',
    'Configuration': 'configuration',
    'Component': 'component',
  };

  const priority = ['RestController', 'Controller', 'Service', 'Repository', 'Configuration', 'Component'];
  for (const key of priority) {
    if (annotations.includes(key)) {
      return typeMap[key];
    }
  }

  return 'component';
}

/**
 * 어노테이션 목록에 엔티티 관련 어노테이션이 포함되어 있는지 확인
 * @param annotations - 어노테이션 이름 목록
 * @returns 엔티티 클래스이면 true
 */
export function isEntityClass(annotations: string[]): boolean {
  return annotations.some(ann => ENTITY_ANNOTATIONS.includes(ann));
}

/**
 * 주어진 어노테이션 이름이 DI 어노테이션인지 확인
 * @param annotationName - 어노테이션 이름
 * @returns DI 어노테이션이면 true
 */
export function isDIAnnotation(annotationName: string): boolean {
  return DI_ANNOTATIONS.includes(annotationName);
}

// ============================================================
// 텍스트 파싱 헬퍼
// ============================================================

/**
 * raw 어노테이션 문자열에서 어노테이션 이름만 추출
 * @param rawAnnotation - raw 어노테이션 문자열
 * @returns 어노테이션 이름
 */
export function extractAnnotationName(rawAnnotation: string): string {
  try {
    const withoutAt = rawAnnotation.replace(/^@/, '');
    const parenIndex = withoutAt.indexOf('(');
    if (parenIndex !== -1) {
      return withoutAt.substring(0, parenIndex).trim();
    }
    return withoutAt.trim();
  } catch (err) {
    logger.debug(`Failed to extract annotation name: ${err instanceof Error ? err.message : String(err)}`);
    return rawAnnotation;
  }
}

/**
 * 문자열에서 특정 문자 인덱스의 라인 번호를 계산 (1-based)
 * @param content - 전체 문자열
 * @param charIndex - 문자 인덱스 (0-based)
 * @returns 라인 번호 (1-based)
 */
export function getLineNumber(content: string, charIndex: number): number {
  try {
    if (charIndex < 0 || charIndex > content.length) {
      return 1;
    }

    let line = 1;
    for (let i = 0; i < charIndex && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
      }
    }
    return line;
  } catch (err) {
    logger.debug(`Failed to get line number: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

// ============================================================
// 전처리 함수
// ============================================================

/**
 * 소스 코드에서 문자열 리터럴과 주석을 제거하여 구조 파싱을 안전하게 수행할 수 있도록 전처리
 * @param content - 원본 소스 코드
 * @returns 전처리된 문자열과 수집된 주석 목록
 */
export function stripStringsAndComments(content: string): {
  processed: string;
  comments: Array<{ text: string; line: number; type: 'line' | 'block' }>;
} {
  const comments: Array<{ text: string; line: number; type: 'line' | 'block' }> = [];
  const result: string[] = [];
  let i = 0;
  let currentLine = 1;

  try {
    while (i < content.length) {
      if (content[i] === '\n') {
        result.push(content[i]);
        currentLine++;
        i++;
        continue;
      }

      // 블록 주석: /* ... */
      if (content[i] === '/' && i + 1 < content.length && content[i + 1] === '*') {
        const commentStartLine = currentLine;
        const commentStart = i;
        i += 2;
        while (i < content.length) {
          if (content[i] === '*' && i + 1 < content.length && content[i + 1] === '/') {
            i += 2;
            break;
          }
          if (content[i] === '\n') {
            currentLine++;
          }
          i++;
        }
        const commentText = content.substring(commentStart, i);
        comments.push({ text: commentText, line: commentStartLine, type: 'block' });

        for (let j = commentStart; j < i && j < content.length; j++) {
          if (content[j] === '\n') {
            result.push('\n');
          } else {
            result.push(' ');
          }
        }
        continue;
      }

      // 라인 주석: // ...
      if (content[i] === '/' && i + 1 < content.length && content[i + 1] === '/') {
        const commentStartLine = currentLine;
        const commentStart = i;
        i += 2;
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        const commentText = content.substring(commentStart, i);
        comments.push({ text: commentText, line: commentStartLine, type: 'line' });

        for (let j = commentStart; j < i; j++) {
          result.push(' ');
        }
        continue;
      }

      // 문자열 리터럴: "..." 또는 '...'
      if (content[i] === '"' || content[i] === "'") {
        const quote = content[i];
        result.push(quote);
        i++;

        while (i < content.length && content[i] !== quote) {
          if (content[i] === '\\' && i + 1 < content.length) {
            i += 2;
            continue;
          }
          if (content[i] === '\n') {
            result.push('\n');
            currentLine++;
            i++;
            continue;
          }
          i++;
        }

        if (i < content.length) {
          result.push(quote);
          i++;
        }
        continue;
      }

      result.push(content[i]);
      i++;
    }

    return { processed: result.join(''), comments };
  } catch (err) {
    logger.debug(`Failed to strip strings and comments: ${err instanceof Error ? err.message : String(err)}`);
    return { processed: content, comments: [] };
  }
}
