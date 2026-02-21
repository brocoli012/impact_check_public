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
  'FeignClient',
  'Mapper',
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
 * 매칭되는 닫는 괄호 위치 찾기 (중첩 괄호 지원)
 * @param text - 전체 텍스트
 * @param openIndex - 여는 괄호 위치
 * @returns 닫는 괄호 위치 (못 찾으면 -1)
 */
export function findMatchingParen(text: string, openIndex: number): number {
  let count = 1;
  let i = openIndex + 1;

  while (i < text.length && count > 0) {
    if (text[i] === '(') {
      count++;
    } else if (text[i] === ')') {
      count--;
    }
    i++;
  }

  return count === 0 ? i - 1 : -1;
}

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

    const parenEnd = findMatchingParen(annotationText, parenStart);
    if (parenEnd === -1 || parenEnd <= parenStart) {
      return '';
    }

    const inner = annotationText.substring(parenStart + 1, parenEnd).trim();
    if (!inner) {
      return '';
    }

    // 배열 형태: value = {"/api", "/v2"} → 첫 번째 값 추출
    const arrayValueMatch = inner.match(/(?:value|path)\s*=\s*\{\s*"([^"]*)"/);
    if (arrayValueMatch) {
      return arrayValueMatch[1];
    }

    // value= 또는 path= 속성에서 추출 (단일 값)
    const valueMatch = inner.match(/(?:value|path)\s*=\s*"([^"]*)"/);
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
    'FeignClient': 'api-client',
    'Mapper': 'mapper',
    'Component': 'component',
  };

  const priority = ['RestController', 'Controller', 'Service', 'Repository', 'Configuration', 'FeignClient', 'Mapper', 'Component'];
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
// 어노테이션 속성 추출 (2-pass)
// ============================================================

/** JPA 관계 매핑 어노테이션 */
export const RELATION_ANNOTATIONS = ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne'];

/** 이벤트 발행 관련 패턴 상수 */
export const EVENT_PUBLISHER_PATTERNS = [
  { regex: /[aA]pplicationEventPublisher\s*\.\s*publishEvent\s*\(\s*new\s+(\w+)\s*\(/, type: 'spring-event' as const },
  { regex: /[kK]afkaTemplate[^.]*\.\s*send\s*\(\s*"([^"]*)"/, type: 'kafka' as const },
  { regex: /[rR]abbitTemplate[^.]*\.\s*convertAndSend\s*\(/, type: 'rabbitmq' as const },
];

/** 이벤트 구독 관련 어노테이션 패턴 */
export const EVENT_SUBSCRIBER_ANNOTATIONS = [
  { name: 'EventListener', type: 'spring-event' as const },
  { name: 'KafkaListener', type: 'kafka' as const, topicAttr: 'topics' },
  { name: 'RabbitListener', type: 'rabbitmq' as const, topicAttr: 'queues' },
];

/**
 * camelCase/PascalCase를 snake_case로 변환
 * @param str - 입력 문자열
 * @returns snake_case 문자열
 *
 * @example
 * camelToSnakeCase('OrderItem') → 'order_item'
 * camelToSnakeCase('deliveryFee') → 'delivery_fee'
 * camelToSnakeCase('HTMLParser') → 'html_parser'
 */
export function camelToSnakeCase(str: string): string {
  if (!str) return '';
  return str
    // 대문자 연속 다음에 대문자+소문자가 오는 경우 분리 (HTMLParser → HTML_Parser)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // 소문자/숫자 다음에 대문자가 오는 경우 분리 (orderItem → order_Item)
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * 어노테이션 속성 값을 추출 (2-pass 매칭)
 *
 * stripStringsAndComments()가 문자열 내부를 마스킹하므로,
 * processed 텍스트에서 어노테이션 위치를 찾고 content 원본에서 실제 문자열 값을 추출
 *
 * @param processed - stripStringsAndComments() 처리된 텍스트
 * @param content - 원본 소스 코드
 * @param annotationName - 어노테이션 이름 (@ 제외)
 * @param attributeName - 속성 이름 (예: 'name', 'topics', 'queues')
 * @returns 추출된 문자열 값, 없으면 null
 *
 * @example
 * // @Table(name = "orders") → "orders"
 * parseAnnotationAttribute(processed, content, 'Table', 'name')
 *
 * // @Table("orders") → "orders" (value 속성으로 간주)
 * parseAnnotationAttribute(processed, content, 'Table', 'name')
 */
export function parseAnnotationAttribute(
  processed: string,
  content: string,
  annotationName: string,
  attributeName: string,
): string | null {
  try {
    // Pass 1: processed 텍스트에서 어노테이션 위치를 찾음
    const annoRegex = new RegExp(`@${annotationName}\\s*\\(`);
    const annoMatch = annoRegex.exec(processed);
    if (!annoMatch) return null;

    const parenStart = processed.indexOf('(', annoMatch.index);
    if (parenStart === -1) return null;

    const parenEnd = findMatchingParen(processed, parenStart);
    if (parenEnd === -1) return null;

    // Pass 2: content 원본에서 해당 위치의 실제 값을 추출
    const originalInner = content.substring(parenStart + 1, parenEnd).trim();
    if (!originalInner) return null;

    // "attributeName = "value"" 패턴
    const attrRegex = new RegExp(`${attributeName}\\s*=\\s*"([^"]*)"`, 'i');
    const attrMatch = originalInner.match(attrRegex);
    if (attrMatch) return attrMatch[1];

    // 배열 형태: attributeName = {"value1", "value2"} → 첫 번째 값
    const arrayAttrRegex = new RegExp(`${attributeName}\\s*=\\s*\\{\\s*"([^"]*)"`, 'i');
    const arrayAttrMatch = originalInner.match(arrayAttrRegex);
    if (arrayAttrMatch) return arrayAttrMatch[1];

    // name 속성이 유일한 경우 value로 간주: @Table("orders")
    if (attributeName === 'name' || attributeName === 'value') {
      // 직접 문자열 값만 있는 경우: @Table("orders")
      const directMatch = originalInner.match(/^"([^"]*)"$/);
      if (directMatch) return directMatch[1];

      // value = "xxx" 패턴
      const valueMatch = originalInner.match(/value\s*=\s*"([^"]*)"/);
      if (valueMatch) return valueMatch[1];

      // 첫 번째 인자가 문자열인 경우 (다른 속성이 없을 때)
      if (!originalInner.includes('=')) {
        const firstArgMatch = originalInner.match(/^"([^"]*)"/);
        if (firstArgMatch) return firstArgMatch[1];
      }
    }

    return null;
  } catch (err) {
    logger.debug(`Failed to parse annotation attribute: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
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
 * 소스 코드의 각 라인 시작 오프셋 테이블을 생성 (O(n) 1회)
 * 이후 getLineFromTable()과 함께 사용하면 O(log n)으로 라인 번호 조회 가능
 * @param content - 전체 소스 코드 문자열
 * @returns 각 라인의 시작 오프셋 배열 (0-indexed line → offset). offsets[0] = 0 (1번째 줄), offsets[1] = 첫 번째 '\n' + 1 위치 (2번째 줄)
 */
export function buildLineOffsetTable(content: string): number[] {
  const offsets = [0]; // 1번째 줄은 항상 offset 0에서 시작
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * 라인 오프셋 테이블을 사용하여 문자 인덱스의 라인 번호를 Binary Search로 조회 (O(log n))
 * @param offsets - buildLineOffsetTable()로 생성한 오프셋 배열
 * @param charIndex - 문자 인덱스 (0-based)
 * @returns 라인 번호 (1-based)
 */
export function getLineFromTable(offsets: number[], charIndex: number): number {
  if (charIndex < 0 || offsets.length === 0) {
    return 1;
  }

  // Binary search: charIndex가 포함되는 라인을 찾음
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (offsets[mid] <= charIndex) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // high는 charIndex를 포함하는 마지막 라인의 인덱스 (0-based)
  return high + 1; // 1-based line number
}

/**
 * 문자열에서 특정 문자 인덱스의 라인 번호를 계산 (1-based)
 * @deprecated buildLineOffsetTable() + getLineFromTable() 사용을 권장. 이 함수는 매 호출마다 O(n) 순회하므로 대형 파일에서 성능 저하 발생.
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
 *
 * TASK-035: char array 방식으로 최적화
 * - 원본과 동일 길이의 char array를 생성하여 직접 인덱스 접근으로 마스킹
 * - segments 배열/문자열 연결 대신 단일 배열 사용으로 메모리 절감
 *
 * @param content - 원본 소스 코드
 * @returns 전처리된 문자열과 수집된 주석 목록
 */
export function stripStringsAndComments(content: string): {
  processed: string;
  comments: Array<{ text: string; line: number; type: 'line' | 'block' }>;
} {
  const comments: Array<{ text: string; line: number; type: 'line' | 'block' }> = [];
  const len = content.length;

  // TASK-035: 원본과 동일 길이의 char array 생성 (원본 복사)
  const chars = new Array<string>(len);
  for (let k = 0; k < len; k++) {
    chars[k] = content[k];
  }

  let i = 0;
  let currentLine = 1;

  /**
   * Helper: 범위 [start, end)의 chars를 공백으로 마스킹 (개행 보존)
   */
  function maskRange(start: number, end: number): void {
    for (let j = start; j < end && j < len; j++) {
      if (chars[j] !== '\n') {
        chars[j] = ' ';
      }
    }
  }

  try {
    while (i < len) {
      // 블록 주석: /* ... */
      if (content[i] === '/' && i + 1 < len && content[i + 1] === '*') {
        const commentStartLine = currentLine;
        const commentStart = i;
        i += 2;
        while (i < len) {
          if (content[i] === '*' && i + 1 < len && content[i + 1] === '/') {
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
        maskRange(commentStart, i);
        continue;
      }

      // 라인 주석: // ...
      if (content[i] === '/' && i + 1 < len && content[i + 1] === '/') {
        const commentStartLine = currentLine;
        const commentStart = i;
        i += 2;
        while (i < len && content[i] !== '\n') {
          i++;
        }
        const commentText = content.substring(commentStart, i);
        comments.push({ text: commentText, line: commentStartLine, type: 'line' });
        maskRange(commentStart, i);
        continue;
      }

      // Text Block 처리: """...""" (Java 15+, Kotlin raw string)
      if (content[i] === '"' && i + 2 < len &&
        content[i + 1] === '"' && content[i + 2] === '"') {
        const textBlockStart = i;
        i += 3;

        while (i + 2 < len) {
          if (content[i] === '"' && content[i + 1] === '"' && content[i + 2] === '"') {
            i += 3;
            break;
          }
          if (content[i] === '\n') {
            currentLine++;
          }
          i++;
        }

        // 파일 끝까지 """ 없으면 끝까지 처리
        if (i + 2 >= len && !(i >= 3 && content[i - 3] === '"' && content[i - 2] === '"' && content[i - 1] === '"')) {
          while (i < len) {
            if (content[i] === '\n') {
              currentLine++;
            }
            i++;
          }
        }

        maskRange(textBlockStart, i);
        continue;
      }

      // 문자열 리터럴: "..." 또는 '...'
      if (content[i] === '"' || content[i] === "'") {
        const stringStart = i;
        const quote = content[i];
        i++;

        while (i < len && content[i] !== quote) {
          if (content[i] === '\\' && i + 1 < len) {
            i += 2;
            continue;
          }
          if (content[i] === '\n') {
            currentLine++;
          }
          i++;
        }

        if (i < len) {
          i++; // skip closing quote
        }

        // 문자열 내부만 마스킹 (따옴표는 보존)
        maskRange(stringStart + 1, i > stringStart + 1 ? i - 1 : stringStart + 1);
        continue;
      }

      // Track line numbers for regular characters
      if (content[i] === '\n') {
        currentLine++;
      }
      i++;
    }

    return { processed: chars.join(''), comments };
  } catch (err) {
    logger.debug(`Failed to strip strings and comments: ${err instanceof Error ? err.message : String(err)}`);
    return { processed: content, comments: [] };
  }
}
