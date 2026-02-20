"use strict";
/**
 * @module core/indexing/parsers/kotlin-parser
 * @description Kotlin 파서 - Regex 기반 Kotlin 소스코드 분석 (Phase 1)
 *
 * Spring Boot 프로젝트의 Kotlin 파일을 정규식으로 파싱하여
 * import, export, 함수, 컴포넌트(Spring bean), 라우트 정의,
 * 주석 등 구조화된 정보를 추출한다.
 *
 * Kotlin 특화:
 *   - suspend fun → isAsync: true
 *   - data class → 필드 자동 추출
 *   - top-level function 지원
 *   - primary constructor DI
 *   - companion object 내부 메서드
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KotlinParser = void 0;
const base_parser_1 = require("./base-parser");
const jvm_parser_utils_1 = require("./jvm-parser-utils");
const logger_1 = require("../../../utils/logger");
/**
 * KotlinParser - Regex 기반 Kotlin 소스코드 분석기
 *
 * 지원 범위:
 *   - import 문 (as alias 포함)
 *   - class/object/interface 선언 → export
 *   - fun 정의 (suspend, top-level 포함) → function
 *   - Spring @RestController/@Service/@Repository → component
 *   - @GetMapping/@PostMapping 등 → routeDefinition
 *   - Primary constructor DI / @Autowired property → import (DI)
 *   - data class → model 힌트
 *   - 주석 추출 (line/block, 정책 주석 포함)
 */
class KotlinParser extends base_parser_1.BaseParser {
    constructor() {
        super(...arguments);
        this.name = 'kotlin';
        this.supportedExtensions = ['.kt', '.kts'];
    }
    async parse(filePath, content) {
        const result = this.createEmptyParsedFile(filePath);
        if (!content.trim()) {
            return result;
        }
        try {
            const lineTable = (0, jvm_parser_utils_1.buildLineOffsetTable)(content);
            const { processed, comments } = (0, jvm_parser_utils_1.stripStringsAndComments)(content);
            // 주석 추출
            this.extractComments(comments, result);
            // import 파싱
            this.parseImports(content, lineTable, result);
            // 패키지명 추출
            this.parsePackage(content);
            // 클래스 레벨 어노테이션 수집
            const classAnnotations = this.parseClassAnnotations(processed);
            // 클래스/오브젝트 선언 파싱
            this.parseClassDeclaration(processed, content, lineTable, filePath, classAnnotations, result);
            // 함수 파싱 (top-level + class methods)
            this.parseFunctions(processed, content, lineTable, filePath, classAnnotations, result);
            // Primary constructor DI 파싱
            this.parsePrimaryConstructorDI(processed, content, lineTable, result);
            // Property 주입 파싱
            this.parsePropertyInjection(processed, content, lineTable, result);
            // data class 필드 파싱
            this.parseDataClassFields(processed, content, lineTable, filePath, result);
        }
        catch (err) {
            logger_1.logger.debug(`KotlinParser failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
        return result;
    }
    // ============================================================
    // Import 파싱
    // ============================================================
    parseImports(content, lineTable, result) {
        const importRegex = /^import\s+([\w.]+(?:\.\*)?)(?:\s+as\s+(\w+))?\s*$/gm;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const fullImport = match[1];
            const alias = match[2];
            const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, match.index);
            const lastDot = fullImport.lastIndexOf('.');
            const source = lastDot !== -1 ? fullImport.substring(0, lastDot) : fullImport;
            const specifier = lastDot !== -1 ? fullImport.substring(lastDot + 1) : fullImport;
            result.imports.push({
                source,
                specifiers: alias ? [`${specifier} as ${alias}`] : [specifier],
                isDefault: false,
                line,
            });
        }
    }
    // ============================================================
    // 패키지 파싱
    // ============================================================
    parsePackage(content) {
        const match = content.match(/^package\s+([\w.]+)\s*$/m);
        return match ? match[1] : '';
    }
    // ============================================================
    // 클래스 어노테이션 파싱
    // ============================================================
    parseClassAnnotations(processed) {
        const annotations = [];
        const classMatch = processed.match(/((?:\s*@\w+(?:\([^)]*\))?\s*)*?)\s*(?:open\s+|abstract\s+|sealed\s+|data\s+|internal\s+)*class\s+\w+/);
        if (classMatch && classMatch[1]) {
            const annoBlock = classMatch[1];
            const annoRegex = /@(\w+)/g;
            let m;
            while ((m = annoRegex.exec(annoBlock)) !== null) {
                annotations.push(m[1]);
            }
        }
        return annotations;
    }
    // ============================================================
    // 클래스/오브젝트 선언 파싱
    // ============================================================
    parseClassDeclaration(processed, _content, lineTable, filePath, classAnnotations, result) {
        const classRegex = /(?:open\s+|abstract\s+|sealed\s+|data\s+|internal\s+)*(?:class|interface|object|enum\s+class)\s+(\w+)(?:\s*<[^>]*>)?(?:\s*(?:\([\s\S]*?\)))?(?:\s*:\s*([^{]+))?\s*\{?/g;
        let match;
        while ((match = classRegex.exec(processed)) !== null) {
            const className = match[1];
            const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, match.index);
            // Kotlin에서는 internal이 아닌 한 public (기본)
            const isInternal = processed.substring(Math.max(0, match.index - 20), match.index).includes('internal');
            if (!isInternal) {
                result.exports.push({
                    name: className,
                    type: 'named',
                    kind: 'class',
                    line,
                });
            }
            // Spring 컴포넌트 판별
            if ((0, jvm_parser_utils_1.isSpringComponent)(classAnnotations)) {
                result.components.push({
                    name: className,
                    type: 'function-component',
                    props: classAnnotations,
                    filePath,
                    line,
                });
            }
            // Entity 판별
            if ((0, jvm_parser_utils_1.isEntityClass)(classAnnotations)) {
                result.components.push({
                    name: className,
                    type: 'class-component',
                    props: ['@Entity'],
                    filePath,
                    line,
                });
            }
        }
    }
    // ============================================================
    // 함수 파싱
    // ============================================================
    parseFunctions(processed, _content, lineTable, filePath, _classAnnotations, result) {
        // 클래스 레벨 @RequestMapping 경로 추출
        let classBasePath = '';
        const classAnnoBlock = processed.match(/((?:\s*@\w+(?:\([^)]*\))?\s*)*?)\s*(?:open\s+|abstract\s+)?class/);
        if (classAnnoBlock && classAnnoBlock[1]) {
            const rmMatch = classAnnoBlock[1].match(/@RequestMapping\s*(\([^)]*\))?/);
            if (rmMatch) {
                classBasePath = (0, jvm_parser_utils_1.parseAnnotationValue)(`@RequestMapping${rmMatch[1] || '("/")'}`);
            }
        }
        // TASK-040: 2-pass 방식으로 분리하여 Regex 안전성 강화
        // Pass 1: fun 시그니처 매칭 (단순화된 정규식, lazy quantifier 제거)
        // 어노테이션 블록은 별도 역추적으로 추출
        const funSigRegex = /(?:(?:override|open|internal|private|protected|public|suspend|inline|infix|operator|tailrec)\s+)*fun\s+(?:<[^>]*>\s*)?(?:([\w<>?,.]+)\.)?([\w]+)\s*\(([^)]*)\)(?:\s*:\s*([\w<>?,.* ]+))?\s*(?:\{|=)/g;
        let match;
        while ((match = funSigRegex.exec(processed)) !== null) {
            const funStartOffset = match.index;
            const receiverType = match[1]; // 확장 함수의 receiver
            const funcName = match[2];
            const paramsStr = match[3];
            const returnType = match[4]?.trim();
            const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, funStartOffset);
            // Pass 2: 어노테이션 블록 역추적 추출 (char-by-char)
            const annotationBlock = this.extractAnnotationBlockBefore(processed, funStartOffset);
            // 어노테이션 추출
            const methodAnnotations = [];
            const annoRegex = /@(\w+)/g;
            let annoMatch;
            while ((annoMatch = annoRegex.exec(annotationBlock)) !== null) {
                methodAnnotations.push(annoMatch[1]);
            }
            // suspend 판별
            const isSuspend = processed.substring(Math.max(0, funStartOffset - 100), funStartOffset + match[0].length).includes('suspend');
            const isReactive = returnType ? (returnType.includes('Mono') || returnType.includes('Flux') || returnType.includes('Flow') || returnType.includes('Deferred')) : false;
            // 파라미터 파싱
            const params = this.parseKotlinParams(paramsStr);
            // 메서드 종료 라인 추정
            const endLine = this.estimateMethodEndLine(processed, lineTable, funStartOffset);
            const displayName = receiverType ? `${receiverType}.${funcName}` : funcName;
            const funcInfo = {
                name: displayName,
                signature: `fun ${displayName}(${paramsStr.trim()})${returnType ? `: ${returnType}` : ''}`,
                startLine: line,
                endLine,
                params,
                returnType: returnType || undefined,
                isAsync: isSuspend || isReactive,
                isExported: !processed.substring(Math.max(0, funStartOffset - 30), funStartOffset).includes('private'),
            };
            result.functions.push(funcInfo);
            // Spring 라우트 어노테이션 확인
            for (const anno of methodAnnotations) {
                if (jvm_parser_utils_1.SPRING_ROUTE_ANNOTATIONS.includes(anno)) {
                    const annoText = this.extractAnnotationText(annotationBlock, anno);
                    const methodPath = (0, jvm_parser_utils_1.parseAnnotationValue)(annoText);
                    const fullPath = (0, jvm_parser_utils_1.combineRoutePaths)(classBasePath, methodPath);
                    const httpMethod = (0, jvm_parser_utils_1.resolveSpringHttpMethod)(anno, annoText);
                    result.routeDefinitions.push({
                        path: fullPath || '/',
                        component: `${httpMethod} ${displayName}`,
                        filePath,
                        line,
                    });
                }
            }
        }
    }
    /**
     * TASK-040: fun 시그니처 이전의 어노테이션 블록을 역추적하여 추출
     * lazy quantifier 대신 char-by-char 역방향 탐색으로 안전하게 추출
     */
    extractAnnotationBlockBefore(processed, funStartOffset) {
        let pos = funStartOffset - 1;
        // fun 시그니처 앞의 공백 건너뛰기
        while (pos >= 0 && (processed[pos] === ' ' || processed[pos] === '\t' || processed[pos] === '\n' || processed[pos] === '\r')) {
            pos--;
        }
        const blockEnd = pos + 1;
        // 어노테이션 블록 역추적
        while (pos >= 0) {
            if (processed[pos] === ')') {
                let parenCount = 1;
                pos--;
                while (pos >= 0 && parenCount > 0) {
                    if (processed[pos] === ')')
                        parenCount++;
                    else if (processed[pos] === '(')
                        parenCount--;
                    pos--;
                }
                continue;
            }
            if (/\w/.test(processed[pos])) {
                while (pos >= 0 && /\w/.test(processed[pos])) {
                    pos--;
                }
                if (pos >= 0 && processed[pos] === '@') {
                    pos--;
                    while (pos >= 0 && (processed[pos] === ' ' || processed[pos] === '\t' || processed[pos] === '\n' || processed[pos] === '\r')) {
                        pos--;
                    }
                    continue;
                }
                break;
            }
            break;
        }
        const blockStart = pos + 1;
        if (blockStart >= blockEnd)
            return '';
        return processed.substring(blockStart, blockEnd);
    }
    // ============================================================
    // Primary Constructor DI
    // ============================================================
    parsePrimaryConstructorDI(processed, _content, lineTable, result) {
        // class MyService(private val repo: MyRepository, ...)
        const constructorMatch = processed.match(/class\s+\w+\s*\(([\s\S]*?)\)\s*(?::\s*[^{]+)?\s*\{/);
        if (!constructorMatch)
            return;
        const paramsStr = constructorMatch[1];
        const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, constructorMatch.index || 0);
        // val/var 파라미터에서 타입 추출
        const paramRegex = /(?:(?:private|protected|internal)\s+)?(?:val|var)\s+\w+\s*:\s*([\w<>?.]+)/g;
        let match;
        while ((match = paramRegex.exec(paramsStr)) !== null) {
            const typeName = match[1];
            // 기본 타입 건너뛰기
            if (['Int', 'Long', 'Double', 'Float', 'Boolean', 'String', 'Byte', 'Short', 'Char'].includes(typeName))
                continue;
            result.imports.push({
                source: typeName,
                specifiers: ['constructor-injection'],
                isDefault: false,
                line,
            });
        }
    }
    // ============================================================
    // Property 주입
    // ============================================================
    parsePropertyInjection(processed, _content, lineTable, result) {
        const propDIRegex = /@(?:Autowired|Inject|Resource|Value)\s+(?:(?:lateinit|private|protected|internal)\s+)*(?:var|val)\s+\w+\s*:\s*([\w<>?.]+)/g;
        let match;
        while ((match = propDIRegex.exec(processed)) !== null) {
            const typeName = match[1];
            const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, match.index);
            result.imports.push({
                source: typeName,
                specifiers: ['@Autowired'],
                isDefault: false,
                line,
            });
        }
    }
    // ============================================================
    // Data Class 필드
    // ============================================================
    parseDataClassFields(processed, _content, lineTable, filePath, result) {
        const dataClassRegex = /data\s+class\s+(\w+)\s*\(([\s\S]*?)\)/g;
        let match;
        while ((match = dataClassRegex.exec(processed)) !== null) {
            const className = match[1];
            const fieldsStr = match[2];
            const line = (0, jvm_parser_utils_1.getLineFromTable)(lineTable, match.index);
            const fields = [];
            const fieldRegex = /(?:val|var)\s+(\w+)\s*:\s*([\w<>?,.\s]+)/g;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
                fields.push(`${fieldMatch[1]}: ${fieldMatch[2].trim()}`);
            }
            // data class는 이미 class로 export 됨 → 추가 export 불필요
            // 단 components에 model 힌트 추가
            if (fields.length > 0) {
                // 이미 @Entity로 등록된 경우는 건너뛰기
                const existing = result.components.find(c => c.name === className);
                if (!existing) {
                    result.components.push({
                        name: className,
                        type: 'class-component',
                        props: fields,
                        filePath,
                        line,
                    });
                }
            }
        }
    }
    // ============================================================
    // 주석 추출
    // ============================================================
    extractComments(comments, result) {
        const policyPatterns = [
            /^\/\/\s*정책\s*:/,
            /^\/\/\s*Policy\s*:/i,
            /^\/\*\s*정책\s*:/,
            /^\/\*\s*Policy\s*:/i,
            /^\/\/\s*@policy/i,
            /^\/\*\s*@policy/i,
        ];
        for (const comment of comments) {
            const isPolicy = policyPatterns.some(p => p.test(comment.text.trim()));
            result.comments.push({
                text: comment.text,
                line: comment.line,
                type: comment.type,
                isPolicy,
            });
        }
    }
    // ============================================================
    // 헬퍼 메서드
    // ============================================================
    parseKotlinParams(paramsStr) {
        if (!paramsStr.trim())
            return [];
        const params = [];
        // 어노테이션 제거
        const cleaned = paramsStr.replace(/@\w+(?:\([^)]*\))?\s*/g, '');
        const parts = cleaned.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed)
                continue;
            // Kotlin 파라미터: "name: Type" 또는 "name: Type = default"
            const paramMatch = trimmed.match(/(?:vararg\s+)?(\w+)\s*:\s*([\w<>?,.\s*]+?)(?:\s*=\s*.*)?$/);
            if (paramMatch) {
                params.push({
                    name: paramMatch[1],
                    type: paramMatch[2].trim(),
                });
            }
        }
        return params;
    }
    estimateMethodEndLine(processed, lineTable, methodStartOffset) {
        let braceCount = 0;
        let foundFirst = false;
        let i = methodStartOffset;
        // expression body (= ...) 처리
        const snippet = processed.substring(methodStartOffset, Math.min(methodStartOffset + 500, processed.length));
        const eqBodyMatch = snippet.match(/fun\s+[^{]*=\s*/);
        if (eqBodyMatch && !snippet.substring(0, eqBodyMatch.index + eqBodyMatch[0].length + 50).includes('{')) {
            // expression body → 다음 줄까지
            const eqPos = methodStartOffset + (eqBodyMatch.index || 0) + eqBodyMatch[0].length;
            let endPos = processed.indexOf('\n', eqPos);
            if (endPos === -1)
                endPos = processed.length - 1;
            return (0, jvm_parser_utils_1.getLineFromTable)(lineTable, endPos);
        }
        while (i < processed.length) {
            if (processed[i] === '{') {
                braceCount++;
                foundFirst = true;
            }
            else if (processed[i] === '}') {
                braceCount--;
                if (foundFirst && braceCount === 0) {
                    return (0, jvm_parser_utils_1.getLineFromTable)(lineTable, i);
                }
            }
            i++;
        }
        return (0, jvm_parser_utils_1.getLineFromTable)(lineTable, processed.length - 1);
    }
    extractAnnotationText(annotationBlock, annotationName) {
        const regex = new RegExp(`@${annotationName}(\\([^)]*\\))?`);
        const match = annotationBlock.match(regex);
        if (match) {
            return `@${annotationName}${match[1] || ''}`;
        }
        return `@${annotationName}`;
    }
}
exports.KotlinParser = KotlinParser;
//# sourceMappingURL=kotlin-parser.js.map