"use strict";
/**
 * @module core/indexing/parsers/typescript-parser
 * @description TypeScript/JavaScript 파서 - @swc/core를 사용한 AST 기반 코드 분석
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptParser = void 0;
const core_1 = require("@swc/core");
const base_parser_1 = require("./base-parser");
const jvm_parser_utils_1 = require("./jvm-parser-utils");
const logger_1 = require("../../../utils/logger");
/** 정책 주석 패턴 */
const POLICY_COMMENT_PATTERNS = [
    /^\/\/\s*정책\s*:/,
    /^\/\/\s*Policy\s*:/i,
    /^\/\*\s*정책\s*:/,
    /^\/\*\s*Policy\s*:/i,
    /^\/\/\s*@policy/i,
    /^\/\*\s*@policy/i,
    /^\/\/\s*POLICY\s*:/,
    /^\/\*\s*POLICY\s*:/,
];
/** API 호출 메서드 패턴 */
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
/**
 * TypeScriptParser - TypeScript/JavaScript 파일을 SWC로 파싱하여 구조화된 정보 추출
 *
 * 기능:
 *   - import/export 추출
 *   - 함수 정의 추출 (function declaration, arrow function, class method)
 *   - React 컴포넌트 감지 (JSX 반환하는 함수/클래스)
 *   - API 호출 감지 (fetch, axios 패턴)
 *   - 라우트 정의 감지 (react-router Route, express router)
 *   - 정책 주석 추출
 */
class TypeScriptParser extends base_parser_1.BaseParser {
    constructor() {
        super(...arguments);
        this.name = 'typescript';
        this.supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
        /** 소스 코드 라인 배열 (라인 번호 계산용) */
        this.sourceLines = [];
        /** 현재 파싱 중인 파일 경로 */
        this.currentFilePath = '';
        /** SWC span 기준 오프셋 (parseSync 호출 간 누적되는 offset 보정용) */
        this.spanBaseOffset = 0;
    }
    /**
     * TypeScript/JavaScript 파일을 파싱하여 구조화된 정보 추출
     * @param filePath - 파일 경로
     * @param content - 파일 내용
     * @returns 파싱된 파일 정보
     */
    async parse(filePath, content) {
        const result = this.createEmptyParsedFile(filePath);
        this.currentFilePath = filePath;
        this.sourceLines = content.split('\n');
        if (!content.trim()) {
            return result;
        }
        try {
            const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
            const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
            const ast = (0, core_1.parseSync)(content, {
                syntax: isTs ? 'typescript' : 'ecmascript',
                tsx: isTsx,
                jsx: !isTs && isTsx,
                comments: true,
                target: 'es2020',
            });
            // SWC parseSync는 호출 간 span offset이 누적됨 (버그/사양)
            // Module span.start를 기준 오프셋으로 저장하여 라인 계산 시 보정
            this.spanBaseOffset = ast.span.start;
            // AST 모듈 body 순회
            for (const item of ast.body) {
                this.processModuleItem(item, result);
            }
            // 주석 추출 (소스 코드에서 직접)
            this.extractComments(content, result);
            // React 컴포넌트 판별 (함수 중 JSX를 반환하는 것)
            this.detectReactComponents(ast, result);
            // TS/Node.js 이벤트 패턴 감지
            const detectedEvents = this.parseEventPatterns(filePath, content);
            if (detectedEvents.length > 0) {
                if (!result.events)
                    result.events = [];
                result.events.push(...detectedEvents);
            }
        }
        catch (err) {
            logger_1.logger.debug(`Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            // 파싱 실패해도 빈 결과 반환 (fail-safe)
        }
        return result;
    }
    /**
     * ModuleItem을 처리 (import, export, statement)
     */
    processModuleItem(item, result) {
        switch (item.type) {
            case 'ImportDeclaration':
                this.processImport(item, result);
                break;
            case 'ExportDeclaration':
                this.processExportDeclaration(item, result);
                break;
            case 'ExportDefaultDeclaration':
                this.processExportDefault(item, result);
                break;
            case 'ExportDefaultExpression':
                this.processExportDefaultExpression(item, result);
                break;
            case 'ExportNamedDeclaration':
                this.processExportNamed(item, result);
                break;
            default:
                // 일반 statement 처리
                this.processStatement(item, result, false);
                break;
        }
    }
    /**
     * Import 선언 처리
     */
    processImport(node, result) {
        const importInfo = {
            source: node.source.value,
            specifiers: [],
            isDefault: false,
            line: this.getLineNumber(node.span),
        };
        for (const spec of node.specifiers) {
            switch (spec.type) {
                case 'ImportDefaultSpecifier':
                    importInfo.isDefault = true;
                    importInfo.specifiers.push(spec.local.value);
                    break;
                case 'ImportSpecifier':
                    importInfo.specifiers.push(spec.imported
                        ? (spec.imported.type === 'Identifier' ? spec.imported.value : spec.imported.value)
                        : spec.local.value);
                    break;
                case 'ImportNamespaceSpecifier':
                    importInfo.specifiers.push(`* as ${spec.local.value}`);
                    break;
            }
        }
        result.imports.push(importInfo);
    }
    /**
     * Export 선언 처리 (export function/class/const)
     */
    processExportDeclaration(node, result) {
        const decl = node.declaration;
        this.processDeclaration(decl, result, true);
    }
    /**
     * Export Default 처리
     */
    processExportDefault(node, result) {
        const decl = node.decl;
        const line = this.getLineNumber(node.span);
        if (decl.type === 'FunctionExpression') {
            const funcExpr = decl;
            const name = funcExpr.identifier?.value || 'default';
            result.exports.push({
                name,
                type: 'default',
                kind: 'function',
                line,
            });
            this.extractFunction(name, funcExpr, line, result, true);
        }
        else if (decl.type === 'ClassExpression') {
            const name = decl.identifier?.value || 'default';
            result.exports.push({
                name,
                type: 'default',
                kind: 'class',
                line,
            });
        }
        else {
            result.exports.push({
                name: 'default',
                type: 'default',
                kind: 'variable',
                line,
            });
        }
    }
    /**
     * Export Default Expression 처리
     */
    processExportDefaultExpression(node, result) {
        const line = this.getLineNumber(node.span);
        result.exports.push({
            name: 'default',
            type: 'default',
            kind: 'variable',
            line,
        });
    }
    /**
     * Export Named 처리 (export { ... })
     */
    processExportNamed(node, result) {
        const line = this.getLineNumber(node.span);
        for (const spec of node.specifiers) {
            if (spec.type === 'ExportSpecifier') {
                const name = spec.exported
                    ? (spec.exported.type === 'Identifier' ? spec.exported.value : spec.exported.value)
                    : (spec.orig.type === 'Identifier' ? spec.orig.value : spec.orig.value);
                result.exports.push({
                    name,
                    type: 'named',
                    kind: 'variable',
                    line,
                });
            }
        }
    }
    /**
     * Declaration 처리
     */
    processDeclaration(decl, result, isExported) {
        switch (decl.type) {
            case 'FunctionDeclaration':
                this.processFunctionDeclaration(decl, result, isExported);
                break;
            case 'ClassDeclaration':
                this.processClassDeclaration(decl, result, isExported);
                break;
            case 'VariableDeclaration':
                this.processVariableDeclaration(decl, result, isExported);
                break;
            case 'TsInterfaceDeclaration':
            case 'TsTypeAliasDeclaration': {
                if (isExported) {
                    const line = this.getLineNumber(decl.span);
                    result.exports.push({
                        name: decl.id.value,
                        type: 'named',
                        kind: 'type',
                        line,
                    });
                }
                break;
            }
        }
    }
    /**
     * Statement 처리
     */
    processStatement(stmt, result, isExported) {
        if (!stmt || !stmt.type)
            return;
        switch (stmt.type) {
            case 'FunctionDeclaration':
                this.processFunctionDeclaration(stmt, result, isExported);
                break;
            case 'ClassDeclaration':
                this.processClassDeclaration(stmt, result, isExported);
                break;
            case 'VariableDeclaration':
                this.processVariableDeclaration(stmt, result, isExported);
                break;
            case 'ExpressionStatement':
                this.processExpressionStatement(stmt, result);
                break;
        }
    }
    /**
     * 함수 선언 처리
     */
    processFunctionDeclaration(node, result, isExported) {
        const name = node.identifier.value;
        const line = this.getLineNumber(node.span);
        const endLine = this.getEndLineNumber(node.span);
        const params = this.extractParams(node.params);
        const returnType = node.returnType
            ? this.tsTypeToString(node.returnType.typeAnnotation)
            : undefined;
        const funcInfo = {
            name,
            signature: this.buildSignature(name, params, returnType, node.async),
            startLine: line,
            endLine,
            params,
            returnType,
            isAsync: node.async,
            isExported,
        };
        result.functions.push(funcInfo);
        if (isExported) {
            result.exports.push({
                name,
                type: 'named',
                kind: 'function',
                line,
            });
        }
        // 함수 본문에서 API 호출 감지
        if (node.body) {
            this.detectApiCallsInBlock(node.body, name, result);
        }
    }
    /**
     * 클래스 선언 처리
     */
    processClassDeclaration(node, result, isExported) {
        const name = node.identifier.value;
        const line = this.getLineNumber(node.span);
        if (isExported) {
            result.exports.push({
                name,
                type: 'named',
                kind: 'class',
                line,
            });
        }
        // TypeORM @Entity() 데코레이터 감지
        this.detectTypeOrmEntity(node, name, this.currentFilePath, line, result);
        // 클래스 메서드 추출
        for (const member of node.body) {
            if (member.type === 'ClassMethod') {
                this.processClassMethod(member, name, result);
            }
        }
    }
    /**
     * 클래스 메서드 처리
     */
    processClassMethod(method, className, result) {
        let methodName = '';
        if (method.key.type === 'Identifier') {
            methodName = method.key.value;
        }
        else if (method.key.type === 'Computed') {
            methodName = '[computed]';
        }
        const fullName = `${className}.${methodName}`;
        const line = this.getLineNumber(method.span);
        const endLine = this.getEndLineNumber(method.span);
        const params = this.extractParams(method.function.params);
        result.functions.push({
            name: fullName,
            signature: this.buildSignature(fullName, params, undefined, method.function.async),
            startLine: line,
            endLine,
            params,
            isAsync: method.function.async,
            isExported: false,
        });
        // API 호출 감지
        if (method.function.body) {
            this.detectApiCallsInBlock(method.function.body, fullName, result);
        }
    }
    /**
     * 변수 선언 처리 (arrow function 포함)
     */
    processVariableDeclaration(node, result, isExported) {
        for (const decl of node.declarations) {
            if (decl.id.type === 'Identifier' && decl.init) {
                const name = decl.id.value;
                const line = this.getLineNumber(decl.span);
                if (decl.init.type === 'ArrowFunctionExpression' ||
                    decl.init.type === 'FunctionExpression') {
                    this.extractFunction(name, decl.init, line, result, isExported);
                }
                else if (isExported) {
                    result.exports.push({
                        name,
                        type: 'named',
                        kind: 'variable',
                        line,
                    });
                }
                // 변수에 할당된 값에서 API 호출 감지
                if (decl.init.type === 'CallExpression') {
                    this.detectApiCallInExpression(decl.init, name, result);
                }
            }
        }
    }
    /**
     * 함수 추출 (arrow function / function expression)
     */
    extractFunction(name, node, line, result, isExported) {
        const endLine = this.getEndLineNumber(node.span);
        // ArrowFunctionExpression.params는 Pattern[] 타입
        // FunctionExpression.params는 Param[] 타입
        let params;
        if (node.type === 'FunctionExpression') {
            params = this.extractParams(node.params);
        }
        else {
            // ArrowFunctionExpression: params is Pattern[]
            params = node.params.map(p => this.extractParamFromPattern(p));
        }
        const returnType = node.returnType
            ? this.tsTypeToString(node.returnType.typeAnnotation)
            : undefined;
        const funcInfo = {
            name,
            signature: this.buildSignature(name, params, returnType, node.async),
            startLine: line,
            endLine,
            params,
            returnType,
            isAsync: node.async,
            isExported,
        };
        result.functions.push(funcInfo);
        if (isExported) {
            result.exports.push({
                name,
                type: 'named',
                kind: 'function',
                line,
            });
        }
        // 함수 본문에서 API 호출 감지
        if (node.body && node.body.type === 'BlockStatement') {
            this.detectApiCallsInBlock(node.body, name, result);
        }
        else if (node.body && node.body.type === 'CallExpression') {
            // Expression body (e.g., () => fetch(...))
            this.detectApiCallInExpression(node.body, name, result);
        }
    }
    /**
     * Expression statement 처리 (app.get, router.post 등)
     */
    processExpressionStatement(stmt, result) {
        if (stmt.expression.type === 'CallExpression') {
            this.detectRouteDefinition(stmt.expression, result);
            this.detectApiCallInExpression(stmt.expression, '<module>', result);
        }
    }
    /**
     * 주석 추출
     */
    extractComments(content, result) {
        const lines = content.split('\n');
        let inBlockComment = false;
        let blockCommentStart = 0;
        let blockCommentText = '';
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (inBlockComment) {
                blockCommentText += '\n' + lines[i];
                if (trimmed.includes('*/')) {
                    inBlockComment = false;
                    const isPolicy = POLICY_COMMENT_PATTERNS.some(p => p.test(blockCommentText.trim()));
                    result.comments.push({
                        text: blockCommentText.trim(),
                        line: blockCommentStart + 1,
                        type: 'block',
                        isPolicy,
                    });
                    blockCommentText = '';
                }
                continue;
            }
            // 한 줄 주석
            const singleLineMatch = trimmed.match(/^\/\/(.*)/);
            if (singleLineMatch) {
                const commentText = `//${singleLineMatch[1]}`;
                const isPolicy = POLICY_COMMENT_PATTERNS.some(p => p.test(commentText.trim()));
                result.comments.push({
                    text: commentText.trim(),
                    line: i + 1,
                    type: 'line',
                    isPolicy,
                });
                continue;
            }
            // 블록 주석 시작
            const blockStart = trimmed.match(/^\/\*/);
            if (blockStart) {
                if (trimmed.includes('*/')) {
                    // 한 줄 블록 주석
                    const commentText = trimmed;
                    const isPolicy = POLICY_COMMENT_PATTERNS.some(p => p.test(commentText.trim()));
                    result.comments.push({
                        text: commentText.trim(),
                        line: i + 1,
                        type: 'block',
                        isPolicy,
                    });
                }
                else {
                    inBlockComment = true;
                    blockCommentStart = i;
                    blockCommentText = lines[i];
                }
            }
        }
    }
    /**
     * React 컴포넌트 감지
     */
    detectReactComponents(_ast, result) {
        // 함수 중에서 JSX를 반환하는 것을 컴포넌트로 감지
        // PascalCase 이름 + JSX 반환 패턴을 기반으로 판별
        for (const func of result.functions) {
            // PascalCase 이름인지 확인 (첫 글자 대문자)
            const baseName = func.name.includes('.') ? func.name.split('.').pop() : func.name;
            if (!/^[A-Z]/.test(baseName))
                continue;
            // 함수 본문에서 JSX 패턴 확인
            const funcBody = this.sourceLines
                .slice(func.startLine - 1, func.endLine)
                .join('\n');
            const hasJSX = /<[A-Z][a-zA-Z]*/.test(funcBody) ||
                /<[a-z]+/.test(funcBody) ||
                /React\.createElement/.test(funcBody) ||
                /<>/.test(funcBody);
            if (hasJSX) {
                // Props 추출
                const props = this.extractPropsFromFunction(func);
                result.components.push({
                    name: baseName,
                    type: 'function-component',
                    props,
                    filePath: this.currentFilePath,
                    line: func.startLine,
                });
            }
        }
    }
    /**
     * 함수 파라미터에서 Props 추출
     */
    extractPropsFromFunction(func) {
        if (func.params.length === 0)
            return [];
        const firstParam = func.params[0];
        if (firstParam.type) {
            // 타입 어노테이션이 있으면 타입 이름 반환
            return [firstParam.type];
        }
        return [firstParam.name];
    }
    /**
     * 블록 문장에서 API 호출 감지
     */
    detectApiCallsInBlock(block, callerFunction, result) {
        for (const stmt of block.stmts) {
            this.detectApiCallsInStatement(stmt, callerFunction, result);
        }
    }
    /**
     * Statement에서 API 호출 감지
     */
    detectApiCallsInStatement(stmt, callerFunction, result) {
        if (!stmt)
            return;
        switch (stmt.type) {
            case 'ExpressionStatement':
                if (stmt.expression.type === 'CallExpression') {
                    this.detectApiCallInExpression(stmt.expression, callerFunction, result);
                }
                else if (stmt.expression.type === 'AwaitExpression' && stmt.expression.argument.type === 'CallExpression') {
                    this.detectApiCallInExpression(stmt.expression.argument, callerFunction, result);
                }
                break;
            case 'VariableDeclaration':
                for (const decl of stmt.declarations) {
                    if (decl.init?.type === 'CallExpression') {
                        this.detectApiCallInExpression(decl.init, callerFunction, result);
                    }
                    else if (decl.init?.type === 'AwaitExpression' && decl.init.argument.type === 'CallExpression') {
                        this.detectApiCallInExpression(decl.init.argument, callerFunction, result);
                    }
                }
                break;
            case 'ReturnStatement':
                if (stmt.argument?.type === 'CallExpression') {
                    this.detectApiCallInExpression(stmt.argument, callerFunction, result);
                }
                break;
            case 'IfStatement':
                if (stmt.consequent.type === 'BlockStatement') {
                    this.detectApiCallsInBlock(stmt.consequent, callerFunction, result);
                }
                if (stmt.alternate) {
                    if (stmt.alternate.type === 'BlockStatement') {
                        this.detectApiCallsInBlock(stmt.alternate, callerFunction, result);
                    }
                }
                break;
            case 'TryStatement':
                this.detectApiCallsInBlock(stmt.block, callerFunction, result);
                if (stmt.handler?.body) {
                    this.detectApiCallsInBlock(stmt.handler.body, callerFunction, result);
                }
                break;
        }
    }
    /**
     * CallExpression에서 API 호출 감지
     */
    detectApiCallInExpression(expr, callerFunction, result) {
        const line = this.getLineNumber(expr.span);
        // fetch() 호출 감지
        if (expr.callee.type === 'Identifier' && expr.callee.value === 'fetch') {
            const url = this.extractUrlFromArgs(expr.arguments);
            const method = this.extractMethodFromFetchOptions(expr.arguments);
            if (url) {
                result.apiCalls.push({
                    method: method || 'GET',
                    url,
                    line,
                    callerFunction,
                });
            }
            return;
        }
        // axios.get(), axios.post() 등
        if (expr.callee.type === 'MemberExpression') {
            const memberExpr = expr.callee;
            const objName = this.getIdentifierName(memberExpr.object);
            const propName = this.getPropertyName(memberExpr);
            if (objName && propName) {
                // axios.get('/api/...'), api.get('/...') 등
                if ((objName === 'axios' || objName === 'api' || objName === 'http' || objName === 'client') &&
                    HTTP_METHODS.includes(propName.toLowerCase())) {
                    const url = this.extractUrlFromArgs(expr.arguments);
                    if (url) {
                        result.apiCalls.push({
                            method: propName.toUpperCase(),
                            url,
                            line,
                            callerFunction,
                        });
                    }
                    return;
                }
            }
        }
        // axios('/api/...') 직접 호출
        if (expr.callee.type === 'Identifier' && expr.callee.value === 'axios') {
            const url = this.extractUrlFromArgs(expr.arguments);
            if (url) {
                result.apiCalls.push({
                    method: 'GET',
                    url,
                    line,
                    callerFunction,
                });
            }
        }
    }
    /**
     * 라우트 정의 감지 (express router, react-router)
     */
    detectRouteDefinition(expr, result) {
        const line = this.getLineNumber(expr.span);
        // express: app.get('/path', handler), router.post('/path', handler)
        if (expr.callee.type === 'MemberExpression') {
            const objName = this.getIdentifierName(expr.callee.object);
            const methodName = this.getPropertyName(expr.callee);
            if (objName &&
                (objName === 'app' || objName === 'router') &&
                methodName &&
                HTTP_METHODS.includes(methodName.toLowerCase())) {
                const routePath = this.extractUrlFromArgs(expr.arguments);
                if (routePath) {
                    result.routeDefinitions.push({
                        path: routePath,
                        component: `${objName}.${methodName}`,
                        filePath: this.currentFilePath,
                        line,
                    });
                }
            }
        }
    }
    // ============================================================
    // TypeORM Entity Detection
    // ============================================================
    /**
     * TypeORM @Entity() 데코레이터를 감지하여 ModelInfo를 생성
     */
    detectTypeOrmEntity(node, className, filePath, _line, result) {
        // SWC AST의 decorators 필드 확인
        const decorators = node.decorators;
        if (!decorators || !Array.isArray(decorators))
            return;
        // @Entity() 데코레이터 찾기
        let entityDecorator = null;
        for (const dec of decorators) {
            if (!dec.expression)
                continue;
            let name;
            if (dec.expression.type === 'CallExpression') {
                const callee = dec.expression.callee;
                if (callee?.type === 'Identifier') {
                    name = callee.value;
                }
            }
            else if (dec.expression.type === 'Identifier') {
                name = dec.expression.value;
            }
            if (name === 'Entity') {
                entityDecorator = dec;
                break;
            }
        }
        if (!entityDecorator)
            return;
        // 테이블명 추출 (@Entity("tableName") 또는 @Entity({ name: "tableName" }))
        let tableName = (0, jvm_parser_utils_1.camelToSnakeCase)(className);
        if (entityDecorator.expression?.type === 'CallExpression') {
            const args = entityDecorator.expression.arguments;
            if (args && args.length > 0) {
                const firstArg = args[0]?.expression;
                if (firstArg?.type === 'StringLiteral') {
                    tableName = firstArg.value;
                }
                else if (firstArg?.type === 'ObjectExpression') {
                    for (const prop of firstArg.properties || []) {
                        if (prop.type === 'KeyValueProperty' &&
                            prop.key?.type === 'Identifier' &&
                            prop.key.value === 'name' &&
                            prop.value?.type === 'StringLiteral') {
                            tableName = prop.value.value;
                        }
                    }
                }
            }
        }
        // 클래스 필드에서 @Column() 데코레이터 파싱
        const fields = [];
        for (const member of node.body) {
            if (member.type === 'ClassProperty' || member.type === 'ClassMethod') {
                const memberDecorators = member.decorators;
                if (!memberDecorators || !Array.isArray(memberDecorators))
                    continue;
                const memberDecoNames = [];
                for (const dec of memberDecorators) {
                    let decName;
                    if (dec.expression?.type === 'CallExpression' && dec.expression.callee?.type === 'Identifier') {
                        decName = dec.expression.callee.value;
                    }
                    else if (dec.expression?.type === 'Identifier') {
                        decName = dec.expression.value;
                    }
                    if (decName)
                        memberDecoNames.push(decName);
                }
                if (member.type === 'ClassProperty') {
                    const keyNode = member.key;
                    if (keyNode?.type === 'Identifier') {
                        const fieldName = keyNode.value;
                        const typeAnno = member.typeAnnotation;
                        const fieldType = typeAnno?.typeAnnotation
                            ? this.tsTypeToString(typeAnno.typeAnnotation)
                            : 'unknown';
                        const isPrimaryKey = memberDecoNames.includes('PrimaryGeneratedColumn') || memberDecoNames.includes('PrimaryColumn');
                        const isRelation = memberDecoNames.some(d => ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne'].includes(d));
                        const relAnnotation = memberDecoNames.find(d => ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne'].includes(d));
                        fields.push({
                            name: fieldName,
                            type: fieldType,
                            required: true,
                            columnName: (0, jvm_parser_utils_1.camelToSnakeCase)(fieldName),
                            isPrimaryKey: isPrimaryKey || undefined,
                            isRelation: isRelation || undefined,
                            relationType: relAnnotation,
                        });
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
            annotations: ['@Entity'],
        };
        if (!result.models) {
            result.models = [];
        }
        result.models.push(model);
    }
    // ============================================================
    // TS/Node.js Event Pattern Detection
    // ============================================================
    /**
     * TS/Node.js 이벤트 패턴을 감지하여 EventInfo를 추출
     *
     * 감지 패턴:
     *   - EventEmitter: .emit('eventName'), .on('eventName'), .once('eventName'), .addListener('eventName')
     *   - RxJS: new Subject<T>(), subject.next(), observable.subscribe()
     *   - Custom pub/sub: .publish('topic'), .dispatch('action'), .trigger('event')
     */
    parseEventPatterns(filePath, content) {
        const events = [];
        const lines = content.split('\n');
        let eventCounter = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Skip comments and empty lines
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || !trimmed)
                continue;
            // 1. EventEmitter patterns: .emit('eventName')
            const emitMatch = trimmed.match(/\.emit\(\s*['"`]([^'"`]+)['"`]/);
            if (emitMatch) {
                eventCounter++;
                events.push({
                    id: `event-${filePath}-emit-${eventCounter}`,
                    name: emitMatch[1],
                    type: 'node-event',
                    role: 'publisher',
                    filePath,
                    handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                    line: i + 1,
                });
            }
            // 2. EventEmitter subscriber: .on('eventName'), .once('eventName'), .addListener('eventName')
            const onMatch = trimmed.match(/\.(on|once|addListener)\(\s*['"`]([^'"`]+)['"`]/);
            if (onMatch) {
                eventCounter++;
                events.push({
                    id: `event-${filePath}-on-${eventCounter}`,
                    name: onMatch[2],
                    type: 'node-event',
                    role: 'subscriber',
                    filePath,
                    handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                    line: i + 1,
                });
            }
            // 3. RxJS Subject.next() - publisher
            const nextMatch = trimmed.match(/(\w+)\.(next)\(/);
            if (nextMatch && !trimmed.includes('// ignore-event')) {
                // Heuristic: check if the variable was declared as a Subject
                const varName = nextMatch[1];
                const subjectPattern = new RegExp(`(new\\s+(?:Subject|BehaviorSubject|ReplaySubject|AsyncSubject))|${varName}\\s*[:=].*Subject`);
                const isSubject = lines.slice(Math.max(0, i - 50), i).some(l => subjectPattern.test(l));
                if (isSubject) {
                    eventCounter++;
                    events.push({
                        id: `event-${filePath}-rxjs-pub-${eventCounter}`,
                        name: varName,
                        type: 'custom',
                        role: 'publisher',
                        filePath,
                        handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                        line: i + 1,
                    });
                }
            }
            // 4. Custom pub/sub patterns: .publish(), .dispatch(), .trigger()
            const customPubMatch = trimmed.match(/\.(publish|dispatch|trigger)\(\s*['"`]([^'"`]+)['"`]/);
            if (customPubMatch) {
                eventCounter++;
                events.push({
                    id: `event-${filePath}-custom-pub-${eventCounter}`,
                    name: customPubMatch[2],
                    topic: customPubMatch[2],
                    type: 'custom',
                    role: 'publisher',
                    filePath,
                    handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                    line: i + 1,
                });
            }
            // 5. Custom subscribe patterns: .subscribe('topic'), .listen('topic')
            // Check BEFORE RxJS subscribe since string-arg subscribe is custom pub/sub
            const customSubMatch = trimmed.match(/\.(subscribe|listen)\(\s*['"`]([^'"`]+)['"`]/);
            if (customSubMatch) {
                eventCounter++;
                events.push({
                    id: `event-${filePath}-custom-sub-${eventCounter}`,
                    name: customSubMatch[2],
                    topic: customSubMatch[2],
                    type: 'custom',
                    role: 'subscriber',
                    filePath,
                    handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                    line: i + 1,
                });
            }
            // 6. RxJS .subscribe() without string arg - subscriber
            if (!customSubMatch) {
                const subscribeMatch = trimmed.match(/(\w+)\.(subscribe)\(/);
                if (subscribeMatch) {
                    const varName = subscribeMatch[1];
                    // Heuristic: check if it's an Observable/Subject
                    const observablePattern = new RegExp(`(Observable|Subject|BehaviorSubject|ReplaySubject|pipe|from|of)|(${varName}\\s*[:=])`);
                    const isObservable = lines.slice(Math.max(0, i - 50), i + 1).some(l => observablePattern.test(l));
                    if (isObservable) {
                        eventCounter++;
                        events.push({
                            id: `event-${filePath}-rxjs-sub-${eventCounter}`,
                            name: varName,
                            type: 'custom',
                            role: 'subscriber',
                            filePath,
                            handler: this.findEnclosingFunctionName(lines, i) || '<module>',
                            line: i + 1,
                        });
                    }
                }
            }
        }
        return events;
    }
    /**
     * 주어진 라인이 속한 함수/메서드 이름을 찾는 간단한 휴리스틱
     */
    findEnclosingFunctionName(lines, lineIndex) {
        // 위로 올라가며 function/method 선언 찾기
        for (let i = lineIndex; i >= Math.max(0, lineIndex - 30); i--) {
            const line = lines[i].trim();
            // function declaration
            const funcMatch = line.match(/(?:async\s+)?function\s+(\w+)/);
            if (funcMatch)
                return funcMatch[1];
            // arrow function / const assignment
            const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
            if (arrowMatch)
                return arrowMatch[1];
            // class method
            const methodMatch = line.match(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
            if (methodMatch && !['if', 'for', 'while', 'switch', 'catch', 'else'].includes(methodMatch[1])) {
                return methodMatch[1];
            }
        }
        return null;
    }
    // ============================================================
    // Helper Methods
    // ============================================================
    /**
     * Span에서 라인 번호 계산
     * SWC의 누적 span offset을 보정하기 위해 spanBaseOffset을 차감
     */
    getLineNumber(span) {
        let offset = span.start - this.spanBaseOffset;
        let line = 1;
        for (let i = 0; i < this.sourceLines.length && offset > 0; i++) {
            const lineLength = this.sourceLines[i].length + 1; // +1 for newline
            if (offset <= lineLength) {
                return i + 1;
            }
            offset -= lineLength;
            line = i + 2;
        }
        return line;
    }
    /**
     * Span에서 종료 라인 번호 계산
     * SWC의 누적 span offset을 보정하기 위해 spanBaseOffset을 차감
     */
    getEndLineNumber(span) {
        let offset = span.end - this.spanBaseOffset;
        let line = 1;
        for (let i = 0; i < this.sourceLines.length && offset > 0; i++) {
            const lineLength = this.sourceLines[i].length + 1;
            if (offset <= lineLength) {
                return i + 1;
            }
            offset -= lineLength;
            line = i + 2;
        }
        return line;
    }
    /**
     * 파라미터 목록 추출
     */
    extractParams(params) {
        return params.map(param => {
            const pattern = param.pat;
            return this.extractParamFromPattern(pattern);
        });
    }
    /**
     * 패턴에서 파라미터 정보 추출
     */
    extractParamFromPattern(pattern) {
        switch (pattern.type) {
            case 'Identifier': {
                const ident = pattern;
                return {
                    name: ident.value,
                    type: ident.typeAnnotation
                        ? this.tsTypeToString(ident.typeAnnotation.typeAnnotation)
                        : undefined,
                };
            }
            case 'AssignmentPattern':
                return this.extractParamFromPattern(pattern.left);
            case 'ObjectPattern':
                return { name: '{ ... }', type: undefined };
            case 'ArrayPattern':
                return { name: '[ ... ]', type: undefined };
            case 'RestElement':
                return { name: `...${this.extractParamFromPattern(pattern.argument).name}` };
            default:
                return { name: 'unknown' };
        }
    }
    /**
     * TypeScript 타입을 문자열로 변환
     */
    tsTypeToString(tsType) {
        switch (tsType.type) {
            case 'TsKeywordType':
                return tsType.kind;
            case 'TsTypeReference':
                return tsType.typeName.type === 'Identifier'
                    ? tsType.typeName.value
                    : 'unknown';
            case 'TsArrayType':
                return `${this.tsTypeToString(tsType.elemType)}[]`;
            case 'TsUnionType':
                return tsType.types.map(t => this.tsTypeToString(t)).join(' | ');
            case 'TsLiteralType':
                return String(tsType.literal.value || 'literal');
            default:
                return 'unknown';
        }
    }
    /**
     * 함수 시그니처 빌드
     */
    buildSignature(name, params, returnType, isAsync) {
        const paramStr = params
            .map(p => (p.type ? `${p.name}: ${p.type}` : p.name))
            .join(', ');
        const asyncPrefix = isAsync ? 'async ' : '';
        const returnSuffix = returnType ? `: ${returnType}` : '';
        return `${asyncPrefix}function ${name}(${paramStr})${returnSuffix}`;
    }
    /**
     * CallExpression 인자에서 URL 추출
     */
    extractUrlFromArgs(args) {
        if (args.length === 0)
            return null;
        const firstArg = args[0];
        if (firstArg.expression.type === 'StringLiteral') {
            return firstArg.expression.value;
        }
        if (firstArg.expression.type === 'TemplateLiteral') {
            const quasi = firstArg.expression;
            return quasi.quasis.map(q => q.raw).join('${...}');
        }
        return null;
    }
    /**
     * fetch 옵션에서 HTTP 메서드 추출
     */
    extractMethodFromFetchOptions(args) {
        if (args.length < 2)
            return null;
        const options = args[1].expression;
        if (options.type === 'ObjectExpression') {
            for (const prop of options.properties) {
                if (prop.type === 'KeyValueProperty' &&
                    prop.key.type === 'Identifier' &&
                    prop.key.value === 'method' &&
                    prop.value.type === 'StringLiteral') {
                    return prop.value.value.toUpperCase();
                }
            }
        }
        return null;
    }
    /**
     * 식별자 이름 추출
     */
    getIdentifierName(expr) {
        if (expr.type === 'Identifier') {
            return expr.value;
        }
        return null;
    }
    /**
     * MemberExpression에서 속성 이름 추출
     */
    getPropertyName(expr) {
        if (expr.property.type === 'Identifier') {
            return expr.property.value;
        }
        if (expr.property.type === 'Computed') {
            const computedExpr = expr.property.expression;
            if (computedExpr.type === 'StringLiteral') {
                return computedExpr.value;
            }
        }
        return null;
    }
}
exports.TypeScriptParser = TypeScriptParser;
//# sourceMappingURL=typescript-parser.js.map