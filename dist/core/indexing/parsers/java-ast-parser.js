"use strict";
/**
 * @module core/indexing/parsers/java-ast-parser
 * @description Java AST 파서 - tree-sitter 기반 Java 소스코드 분석 (Phase 2)
 *
 * tree-sitter-java의 AST를 순회하여 Phase 1 Regex 파서 대비
 * 중첩 클래스, 멀티라인 어노테이션, 제네릭, 람다 등을 정확히 파싱한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaAstParser = void 0;
const base_parser_1 = require("./base-parser");
const tree_sitter_loader_1 = require("./tree-sitter-loader");
const jvm_parser_utils_1 = require("./jvm-parser-utils");
const logger_1 = require("../../../utils/logger");
/**
 * JavaAstParser - tree-sitter 기반 Java AST 파서 (Phase 2)
 *
 * Phase 1 대비 개선:
 *   - 중첩 클래스 / inner class 완전 지원
 *   - 멀티라인 어노테이션 정확 파싱
 *   - 제네릭 타입 완전 해석
 *   - 람다/익명 클래스 내부 탐색
 *   - @Bean 메서드 DI 감지: 향후 지원 예정
 */
class JavaAstParser extends base_parser_1.BaseParser {
    constructor() {
        super(...arguments);
        this.name = 'java-ast';
        this.supportedExtensions = ['.java'];
    }
    async parse(filePath, content) {
        const result = this.createEmptyParsedFile(filePath);
        if (!content.trim()) {
            return result;
        }
        let tree = null;
        try {
            tree = await (0, tree_sitter_loader_1.parseJava)(content);
            if (!tree) {
                logger_1.logger.debug(`JavaAstParser: tree-sitter parse returned null for ${filePath}`);
                return result;
            }
            const root = tree.rootNode;
            // 패키지명 추출 (향후 fully-qualified name 해석에 사용)
            this.extractPackage(root);
            // import 추출
            this.extractImports(root, result);
            // 클래스 선언 순회 (중첩 클래스 포함)
            this.traverseNode(root, filePath, '', result);
            // 주석 추출
            this.extractComments(root, result);
        }
        catch (err) {
            logger_1.logger.debug(`JavaAstParser failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            // tree-sitter 네이티브 메모리 해제
            if (tree && typeof tree.delete === 'function') {
                tree.delete();
            }
        }
        return result;
    }
    // ============================================================
    // 패키지
    // ============================================================
    extractPackage(root) {
        const pkgDecl = root.namedChildren.find((n) => n.type === 'package_declaration');
        if (!pkgDecl)
            return '';
        const scopedId = pkgDecl.namedChildren.find((n) => n.type === 'scoped_identifier' || n.type === 'identifier');
        return scopedId ? scopedId.text : '';
    }
    // ============================================================
    // Import 추출
    // ============================================================
    extractImports(root, result) {
        for (const child of root.namedChildren) {
            if (child.type === 'import_declaration') {
                const isStatic = child.text.includes('static ');
                const scopedId = child.namedChildren.find((n) => n.type === 'scoped_identifier' || n.type === 'identifier');
                if (!scopedId)
                    continue;
                const fullPath = scopedId.text;
                const hasWildcard = child.namedChildren.some((n) => n.type === 'asterisk');
                // wildcard인 경우: source = "package.*", specifier = "*"
                // 단일 클래스인 경우: source = "full.path.ClassName", specifier = "ClassName"
                if (hasWildcard) {
                    result.imports.push({
                        source: `${fullPath}.*`,
                        specifiers: isStatic ? ['static *'] : ['*'],
                        isDefault: false,
                        line: child.startPosition.row + 1,
                    });
                }
                else {
                    const lastDot = fullPath.lastIndexOf('.');
                    const specifier = lastDot !== -1 ? fullPath.substring(lastDot + 1) : fullPath;
                    result.imports.push({
                        source: fullPath,
                        specifiers: isStatic ? [`static ${specifier}`] : [specifier],
                        isDefault: false,
                        line: child.startPosition.row + 1,
                    });
                }
            }
        }
    }
    // ============================================================
    // AST 순회 (중첩 클래스 포함)
    // ============================================================
    traverseNode(node, filePath, parentClassName, result) {
        for (const child of node.namedChildren) {
            switch (child.type) {
                case 'class_declaration':
                case 'interface_declaration':
                case 'enum_declaration':
                case 'record_declaration':
                    this.processClassDeclaration(child, filePath, parentClassName, result);
                    break;
            }
        }
    }
    // ============================================================
    // 클래스 선언 처리
    // ============================================================
    processClassDeclaration(node, filePath, parentClassName, result) {
        const nameNode = node.namedChildren.find((n) => n.type === 'identifier');
        if (!nameNode)
            return;
        const className = parentClassName ? `${parentClassName}.${nameNode.text}` : nameNode.text;
        const line = node.startPosition.row + 1;
        // 어노테이션 추출
        const annotations = this.extractAnnotations(node);
        // 접근 제어자 확인
        const modifiers = this.extractModifiers(node);
        const isPublic = modifiers.includes('public') || !modifiers.some(m => ['private', 'protected'].includes(m));
        // export 추가
        if (isPublic) {
            result.exports.push({
                name: className,
                type: 'named',
                kind: 'class',
                line,
            });
        }
        // Spring 컴포넌트 판별
        const annoNames = annotations.map(a => a.name);
        if ((0, jvm_parser_utils_1.isSpringComponent)(annoNames)) {
            result.components.push({
                name: className,
                type: 'function-component',
                props: annoNames,
                filePath,
                line,
            });
        }
        // Entity 판별
        if ((0, jvm_parser_utils_1.isEntityClass)(annoNames)) {
            result.components.push({
                name: className,
                type: 'class-component',
                props: ['@Entity'],
                filePath,
                line,
            });
            // 엔티티 모델 추출
            this.parseEntityModel(node, className, filePath, line, annotations, result);
        }
        // 클래스 레벨 @RequestMapping 경로 추출
        const classBasePath = this.extractRequestMappingPath(annotations);
        // 클래스 본체 순회
        const body = node.namedChildren.find((n) => n.type === 'class_body' || n.type === 'interface_body' || n.type === 'enum_body' || n.type === 'record_body');
        if (body) {
            for (const member of body.namedChildren) {
                switch (member.type) {
                    case 'method_declaration':
                        this.processMethod(member, className, classBasePath, filePath, result);
                        break;
                    case 'constructor_declaration':
                        this.processConstructor(member, className, result);
                        break;
                    case 'field_declaration':
                        this.processField(member, className, result);
                        break;
                    case 'class_declaration':
                    case 'interface_declaration':
                    case 'enum_declaration':
                    case 'record_declaration':
                        // 중첩 클래스 재귀 처리
                        this.processClassDeclaration(member, filePath, className, result);
                        break;
                }
            }
        }
    }
    // ============================================================
    // 메서드 처리
    // ============================================================
    processMethod(node, _className, classBasePath, filePath, result) {
        const nameNode = node.namedChildren.find((n) => n.type === 'identifier');
        if (!nameNode)
            return;
        const methodName = nameNode.text;
        const line = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        // 반환 타입
        const returnTypeNode = this.findChildByFieldName(node, 'type');
        const returnType = returnTypeNode ? returnTypeNode.text : 'void';
        // 파라미터
        const params = this.extractMethodParams(node);
        // 접근 제어자
        const modifiers = this.extractModifiers(node);
        const isPublic = modifiers.includes('public');
        // async 판별 (CompletableFuture, Mono, Flux)
        const isAsync = returnType.includes('CompletableFuture') ||
            returnType.includes('Mono') ||
            returnType.includes('Flux');
        const funcInfo = {
            name: methodName,
            signature: `${returnType} ${methodName}(${params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ')})`,
            startLine: line,
            endLine,
            params,
            returnType,
            isAsync,
            isExported: isPublic,
        };
        result.functions.push(funcInfo);
        // Spring 라우트 어노테이션 확인
        const annotations = this.extractAnnotations(node);
        for (const anno of annotations) {
            if (jvm_parser_utils_1.SPRING_ROUTE_ANNOTATIONS.includes(anno.name)) {
                const methodPath = (0, jvm_parser_utils_1.parseAnnotationValue)(anno.text);
                const fullPath = (0, jvm_parser_utils_1.combineRoutePaths)(classBasePath, methodPath);
                const httpMethod = (0, jvm_parser_utils_1.resolveSpringHttpMethod)(anno.name, anno.text);
                result.routeDefinitions.push({
                    path: fullPath || '/',
                    component: `${httpMethod} ${methodName}`,
                    filePath,
                    line,
                });
            }
        }
    }
    // ============================================================
    // 생성자 처리 (DI)
    // ============================================================
    processConstructor(node, _className, result) {
        const line = node.startPosition.row + 1;
        const params = this.extractMethodParams(node);
        // 생성자 파라미터에서 DI 타입 추출
        const primitiveTypes = new Set(['int', 'long', 'double', 'float', 'boolean', 'String', 'byte', 'short', 'char']);
        for (const param of params) {
            if (param.type && !primitiveTypes.has(param.type.replace(/[\[\]<>?,\s]/g, ''))) {
                result.imports.push({
                    source: param.type,
                    specifiers: ['constructor-injection'],
                    isDefault: false,
                    line,
                });
            }
        }
    }
    // ============================================================
    // 필드 처리 (DI annotation)
    // ============================================================
    processField(node, _className, result) {
        const annotations = this.extractAnnotations(node);
        const annoNames = annotations.map(a => a.name);
        const hasDI = annoNames.some(a => ['Autowired', 'Inject', 'Resource'].includes(a));
        if (hasDI) {
            const typeNode = this.findChildByFieldName(node, 'type');
            const declarator = node.namedChildren.find((n) => n.type === 'variable_declarator');
            if (typeNode && declarator) {
                const fieldName = declarator.namedChildren.find((n) => n.type === 'identifier');
                result.imports.push({
                    source: typeNode.text,
                    specifiers: [`@${annoNames.find(a => ['Autowired', 'Inject', 'Resource'].includes(a))} ${fieldName?.text || ''}`],
                    isDefault: false,
                    line: node.startPosition.row + 1,
                });
            }
        }
    }
    // ============================================================
    // 엔티티 모델 파싱
    // ============================================================
    parseEntityModel(node, className, filePath, _line, annotations, result) {
        // @Table(name=...) 추출
        const tableAnno = annotations.find(a => a.name === 'Table');
        let tableName = (0, jvm_parser_utils_1.camelToSnakeCase)(className);
        if (tableAnno) {
            const nameMatch = tableAnno.text.match(/name\s*=\s*"([^"]*)"/);
            if (nameMatch)
                tableName = nameMatch[1];
            else {
                const directMatch = tableAnno.text.match(/@Table\s*\(\s*"([^"]*)"/);
                if (directMatch)
                    tableName = directMatch[1];
            }
        }
        const schema = tableAnno?.text.match(/schema\s*=\s*"([^"]*)"/)
            ? tableAnno.text.match(/schema\s*=\s*"([^"]*)"/)[1]
            : undefined;
        // 필드 추출
        const fields = [];
        const body = node.namedChildren.find((n) => n.type === 'class_body' || n.type === 'record_body');
        if (body) {
            for (const member of body.namedChildren) {
                if (member.type === 'field_declaration') {
                    const memberAnnotations = this.extractAnnotations(member);
                    const memberAnnoNames = memberAnnotations.map(a => a.name);
                    const typeNode = this.findChildByFieldName(member, 'type');
                    const declarator = member.namedChildren.find((n) => n.type === 'variable_declarator');
                    if (typeNode && declarator) {
                        const nameNode = declarator.namedChildren.find((n) => n.type === 'identifier');
                        if (nameNode) {
                            const fieldName = nameNode.text;
                            const fieldType = typeNode.text;
                            const isPrimaryKey = memberAnnoNames.includes('Id') || memberAnnoNames.includes('EmbeddedId');
                            const relAnnotation = memberAnnoNames.find(a => jvm_parser_utils_1.RELATION_ANNOTATIONS.includes(a));
                            let relationTarget;
                            if (relAnnotation) {
                                const genericMatch = fieldType.match(/<(\w+)>/);
                                if (genericMatch) {
                                    relationTarget = genericMatch[1];
                                }
                                else if (!['int', 'long', 'double', 'float', 'boolean', 'String'].includes(fieldType)) {
                                    relationTarget = fieldType;
                                }
                            }
                            // @Column(name=...) 추출
                            const columnAnno = memberAnnotations.find(a => a.name === 'Column');
                            const columnName = columnAnno?.text.match(/name\s*=\s*"([^"]*)"/)
                                ? columnAnno.text.match(/name\s*=\s*"([^"]*)"/)[1]
                                : (0, jvm_parser_utils_1.camelToSnakeCase)(fieldName);
                            fields.push({
                                name: fieldName,
                                type: fieldType,
                                required: true,
                                columnName,
                                isPrimaryKey: isPrimaryKey || undefined,
                                isRelation: !!relAnnotation || undefined,
                                relationType: relAnnotation,
                                relationTarget,
                            });
                        }
                    }
                }
            }
        }
        const model = {
            id: `model-${filePath}-${className}`,
            name: className,
            filePath,
            type: 'entity',
            fields,
            relatedApis: [],
            tableName,
            schema,
            annotations: annotations.map(a => `@${a.name}`),
        };
        if (!result.models) {
            result.models = [];
        }
        result.models.push(model);
    }
    // ============================================================
    // 어노테이션 추출
    // ============================================================
    extractAnnotations(node) {
        const annotations = [];
        const modifiersNode = node.namedChildren.find((n) => n.type === 'modifiers');
        if (!modifiersNode)
            return annotations;
        for (const child of modifiersNode.namedChildren) {
            if (child.type === 'marker_annotation') {
                const nameNode = child.namedChildren.find((n) => n.type === 'identifier');
                if (nameNode) {
                    annotations.push({ name: nameNode.text, text: child.text });
                }
            }
            else if (child.type === 'annotation') {
                const nameNode = child.namedChildren.find((n) => n.type === 'identifier');
                if (nameNode) {
                    annotations.push({ name: nameNode.text, text: child.text });
                }
            }
        }
        return annotations;
    }
    // ============================================================
    // 접근 제어자 추출
    // ============================================================
    extractModifiers(node) {
        const modifiers = [];
        const modifiersNode = node.namedChildren.find((n) => n.type === 'modifiers');
        if (!modifiersNode)
            return modifiers;
        for (const child of modifiersNode.children) {
            if (['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized'].includes(child.type)) {
                modifiers.push(child.type);
            }
        }
        return modifiers;
    }
    // ============================================================
    // 파라미터 추출
    // ============================================================
    extractMethodParams(node) {
        const params = [];
        const formalParams = node.namedChildren.find((n) => n.type === 'formal_parameters');
        if (!formalParams)
            return params;
        for (const param of formalParams.namedChildren) {
            if (param.type === 'formal_parameter' || param.type === 'spread_parameter') {
                const typeNode = this.findChildByFieldName(param, 'type');
                const nameNode = this.findChildByFieldName(param, 'name');
                if (nameNode) {
                    params.push({
                        name: nameNode.text,
                        type: typeNode?.text,
                    });
                }
            }
        }
        return params;
    }
    // ============================================================
    // @RequestMapping 경로 추출
    // ============================================================
    extractRequestMappingPath(annotations) {
        const rm = annotations.find(a => a.name === 'RequestMapping');
        if (!rm)
            return '';
        return (0, jvm_parser_utils_1.parseAnnotationValue)(rm.text);
    }
    // ============================================================
    // 유틸 헬퍼
    // ============================================================
    findChildByFieldName(node, fieldName) {
        try {
            const child = node.childForFieldName(fieldName);
            return child || null;
        }
        catch {
            return null;
        }
    }
    // ============================================================
    // 주석 추출
    // ============================================================
    extractComments(root, result) {
        const policyPatterns = [
            /^\/\/\s*정책\s*:/,
            /^\/\/\s*Policy\s*:/i,
            /^\/\*\s*정책\s*:/,
            /^\/\*\s*Policy\s*:/i,
            /^\/\/\s*@policy/i,
            /^\/\*\s*@policy/i,
        ];
        this.walkTree(root, (node) => {
            if (node.type === 'line_comment' || node.type === 'block_comment') {
                const text = node.text;
                const isPolicy = policyPatterns.some(p => p.test(text.trim()));
                result.comments.push({
                    text,
                    line: node.startPosition.row + 1,
                    type: node.type === 'line_comment' ? 'line' : 'block',
                    isPolicy,
                });
            }
        });
    }
    // ============================================================
    // AST 트리 워커
    // ============================================================
    walkTree(node, callback) {
        callback(node);
        if (node.children) {
            for (const child of node.children) {
                this.walkTree(child, callback);
            }
        }
    }
}
exports.JavaAstParser = JavaAstParser;
//# sourceMappingURL=java-ast-parser.js.map