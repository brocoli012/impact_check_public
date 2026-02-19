/**
 * @module core/indexing/parsers/tree-sitter-loader
 * @description tree-sitter 동적 로딩 유틸리티
 *
 * tree-sitter와 언어 grammar를 동적으로 로드하고 캐싱한다.
 * 로드 실패 시 null을 반환하여 호출측에서 Phase 1 Regex 파서로 폴백할 수 있도록 한다.
 */

import { logger } from '../../../utils/logger';

/** tree-sitter Parser 타입 (동적 로딩이므로 any 사용) */
type TreeSitterParser = any;
type TreeSitterTree = any;
export type TreeSitterNode = any;

/** 캐시된 파서 인스턴스 */
let javaParser: TreeSitterParser | null = null;
let kotlinParser: TreeSitterParser | null = null;
let treeSitterModule: any = null;
/** undefined = 미시도, null = 실패, 그 외 = 성공 */
let treeSitterLoadResult: any = undefined;

/**
 * tree-sitter 모듈을 동적으로 로드
 * @returns tree-sitter 모듈 또는 null
 */
async function loadTreeSitter(): Promise<any> {
  if (treeSitterLoadResult !== undefined) return treeSitterLoadResult;

  try {
    treeSitterModule = require('tree-sitter');
    treeSitterLoadResult = treeSitterModule;
    return treeSitterModule;
  } catch (err) {
    logger.debug(`tree-sitter not available: ${err instanceof Error ? err.message : String(err)}`);
    treeSitterLoadResult = null;
    return null;
  }
}

/**
 * tree-sitter 캐시 리셋 (테스트용)
 * 전체 테스트 스위트에서 다른 테스트의 모듈 모킹 영향을 피하기 위해 사용
 */
export function resetTreeSitterCache(): void {
  javaParser = null;
  kotlinParser = null;
  treeSitterModule = null;
  treeSitterLoadResult = undefined;
}

/**
 * Java 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Java Parser 또는 null
 */
export async function getJavaParser(): Promise<TreeSitterParser | null> {
  if (javaParser) return javaParser;

  const Parser = await loadTreeSitter();
  if (!Parser) return null;

  try {
    const JavaLang = require('tree-sitter-java');
    javaParser = new Parser();
    javaParser.setLanguage(JavaLang);
    logger.debug('tree-sitter Java parser loaded successfully');
    return javaParser;
  } catch (err) {
    logger.debug(`tree-sitter-java not available: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Kotlin 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Kotlin Parser 또는 null
 */
export async function getKotlinParser(): Promise<TreeSitterParser | null> {
  if (kotlinParser) return kotlinParser;

  const Parser = await loadTreeSitter();
  if (!Parser) return null;

  try {
    const KotlinLang = require('tree-sitter-kotlin');
    kotlinParser = new Parser();
    kotlinParser.setLanguage(KotlinLang);
    logger.debug('tree-sitter Kotlin parser loaded successfully');
    return kotlinParser;
  } catch (err) {
    logger.debug(`tree-sitter-kotlin not available: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * tree-sitter가 사용 가능한지 동기적으로 확인
 * constructor에서 호출 가능하도록 동기 함수로 제공.
 * require()는 동기 호출이므로 안전하다.
 * @returns true이면 사용 가능
 */
export function isTreeSitterAvailable(): boolean {
  if (treeSitterLoadResult !== undefined) return treeSitterLoadResult !== null;

  try {
    treeSitterModule = require('tree-sitter');
    treeSitterLoadResult = treeSitterModule;
    return true;
  } catch {
    treeSitterLoadResult = null;
    return false;
  }
}

/**
 * Java 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Java 소스 코드
 * @returns AST 트리 또는 null
 */
export async function parseJava(content: string): Promise<TreeSitterTree | null> {
  const parser = await getJavaParser();
  if (!parser) return null;

  try {
    return parser.parse(content);
  } catch (err) {
    logger.debug(`tree-sitter Java parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Kotlin 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Kotlin 소스 코드
 * @returns AST 트리 또는 null
 */
export async function parseKotlin(content: string): Promise<TreeSitterTree | null> {
  const parser = await getKotlinParser();
  if (!parser) return null;

  try {
    return parser.parse(content);
  } catch (err) {
    logger.debug(`tree-sitter Kotlin parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
