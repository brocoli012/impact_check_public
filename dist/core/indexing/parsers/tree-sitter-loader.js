"use strict";
/**
 * @module core/indexing/parsers/tree-sitter-loader
 * @description tree-sitter 동적 로딩 유틸리티
 *
 * tree-sitter와 언어 grammar를 동적으로 로드하고 캐싱한다.
 * 로드 실패 시 null을 반환하여 호출측에서 Phase 1 Regex 파서로 폴백할 수 있도록 한다.
 *
 * Jest 모듈 격리 대응:
 * Jest의 node 테스트 환경은 각 테스트 파일마다 독립된 vm context를 생성하며,
 * global/process/require.cache가 파일 간 공유되지 않는다.
 * 그러나 Module._cache는 실제 Node.js 모듈 캐시이며 Jest 격리를 받지 않는다.
 *
 * tree-sitter C++ native addon은 같은 프로세스에서 require.cache 리셋 후
 * 재require되면 기존 Parser 인스턴스가 무효화된다(rootNode → undefined).
 *
 * 해결: Module._load()로 tree-sitter를 로드하여 Module._cache에 저장하고,
 * 파서 인스턴스도 Module._cache 내 커스텀 키에 보관하여 Jest 격리를 우회한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTreeSitterCache = resetTreeSitterCache;
exports.getJavaParser = getJavaParser;
exports.getKotlinParser = getKotlinParser;
exports.isTreeSitterAvailable = isTreeSitterAvailable;
exports.parseJava = parseJava;
exports.parseKotlin = parseKotlin;
const logger_1 = require("../../../utils/logger");
/**
 * Module._cache 내 파서 인스턴스 저장 키.
 * Jest가 global/process/require.cache를 격리해도 Module._cache는 공유되므로,
 * 이 키로 파서 인스턴스를 프로세스 수준에서 유지한다.
 */
const CACHE_KEY = '__kic_tree_sitter_parsers__';
/**
 * Node.js Module._cache에서 파서 캐시를 가져오거나 초기화한다.
 * Module._cache는 Jest의 vm context 격리를 받지 않으며,
 * 같은 프로세스 내 모든 테스트 파일에서 공유된다.
 */
function getParserCache() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    if (!Module._cache[CACHE_KEY]) {
        Module._cache[CACHE_KEY] = {
            exports: {
                treeSitterModule: null,
                javaParser: null,
                kotlinParser: null,
                loadResult: undefined,
            },
        };
    }
    return Module._cache[CACHE_KEY].exports;
}
/**
 * tree-sitter 모듈을 Module._load로 로드한다.
 * Module._load는 Node.js의 실제 require 메커니즘을 직접 호출하므로
 * Jest의 모듈 격리를 우회한다. 한 번 로드되면 Module._cache에 저장되어
 * 이후 호출에서 같은 인스턴스가 반환된다.
 */
function loadTreeSitterSync() {
    const cache = getParserCache();
    if (cache.loadResult !== undefined)
        return cache.loadResult;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Module = require('module');
        const tsPath = require.resolve('tree-sitter');
        cache.treeSitterModule = Module._load(tsPath, module, false);
        cache.loadResult = cache.treeSitterModule;
        return cache.treeSitterModule;
    }
    catch (err) {
        logger_1.logger.debug(`tree-sitter not available: ${err instanceof Error ? err.message : String(err)}`);
        cache.loadResult = null;
        return null;
    }
}
/**
 * tree-sitter 모듈을 로드 (async wrapper)
 */
async function loadTreeSitter() {
    return loadTreeSitterSync();
}
/**
 * 네이티브 모듈을 Module._load로 로드 (Jest 격리 우회)
 */
function nativeLoad(moduleName) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    const resolvedPath = require.resolve(moduleName);
    return Module._load(resolvedPath, module, false);
}
/**
 * tree-sitter 캐시 리셋 (테스트용)
 * global 캐시도 함께 리셋한다.
 */
function resetTreeSitterCache() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    delete Module._cache[CACHE_KEY];
}
/**
 * Java 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Java Parser 또는 null
 */
async function getJavaParser() {
    const cache = getParserCache();
    if (cache.javaParser)
        return cache.javaParser;
    const Parser = await loadTreeSitter();
    if (!Parser)
        return null;
    try {
        const JavaLang = nativeLoad('tree-sitter-java');
        cache.javaParser = new Parser();
        cache.javaParser.setLanguage(JavaLang);
        logger_1.logger.debug('tree-sitter Java parser loaded successfully');
        return cache.javaParser;
    }
    catch (err) {
        logger_1.logger.debug(`tree-sitter-java not available: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
/**
 * Kotlin 파서 인스턴스를 가져오기 (캐싱)
 * @returns tree-sitter Kotlin Parser 또는 null
 */
async function getKotlinParser() {
    const cache = getParserCache();
    if (cache.kotlinParser)
        return cache.kotlinParser;
    const Parser = await loadTreeSitter();
    if (!Parser)
        return null;
    try {
        const KotlinLang = nativeLoad('tree-sitter-kotlin');
        cache.kotlinParser = new Parser();
        cache.kotlinParser.setLanguage(KotlinLang);
        logger_1.logger.debug('tree-sitter Kotlin parser loaded successfully');
        return cache.kotlinParser;
    }
    catch (err) {
        logger_1.logger.debug(`tree-sitter-kotlin not available: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
/**
 * tree-sitter가 사용 가능한지 동기적으로 확인
 * @returns true이면 사용 가능
 */
function isTreeSitterAvailable() {
    return loadTreeSitterSync() !== null;
}
/**
 * Java 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Java 소스 코드
 * @returns AST 트리 또는 null
 */
async function parseJava(content) {
    const parser = await getJavaParser();
    if (!parser)
        return null;
    try {
        return parser.parse(content);
    }
    catch (err) {
        logger_1.logger.debug(`tree-sitter Java parse failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
/**
 * Kotlin 소스 코드를 파싱하여 AST 트리 반환
 * @param content - Kotlin 소스 코드
 * @returns AST 트리 또는 null
 */
async function parseKotlin(content) {
    const parser = await getKotlinParser();
    if (!parser)
        return null;
    try {
        return parser.parse(content);
    }
    catch (err) {
        logger_1.logger.debug(`tree-sitter Kotlin parse failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
//# sourceMappingURL=tree-sitter-loader.js.map