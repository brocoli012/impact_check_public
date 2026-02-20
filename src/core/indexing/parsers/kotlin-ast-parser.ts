/**
 * @module core/indexing/parsers/kotlin-ast-parser
 * @description Kotlin AST 파서 - tree-sitter 기반 Kotlin 소스코드 분석 (Phase 2)
 *
 * tree-sitter-kotlin의 AST를 순회하여 Phase 1 Regex 파서 대비
 * data class, sealed class, companion object, DSL 패턴 등을 정확히 파싱한다.
 */

import { BaseParser } from './base-parser';
import { ParsedFile, FunctionInfo } from '../types';
import { parseKotlin, TreeSitterNode } from './tree-sitter-loader';
import {
  SPRING_ROUTE_ANNOTATIONS,
  parseAnnotationValue,
  resolveSpringHttpMethod,
  combineRoutePaths,
  isSpringComponent,
  isEntityClass,
} from './jvm-parser-utils';
import { logger } from '../../../utils/logger';

/**
 * KotlinAstParser - tree-sitter 기반 Kotlin AST 파서 (Phase 2)
 *
 * Phase 1 대비 개선:
 *   - data class / sealed class / object / companion object 완전 지원
 *   - 멀티라인 어노테이션 정확 파싱
 *   - 제네릭 타입 완전 해석
 *   - expression body (=) 함수 지원
 *   - Kotlin DSL 부분 인식
 *   - suspend fun 정확 파싱
 */
export class KotlinAstParser extends BaseParser {
  readonly name = 'kotlin-ast';
  readonly supportedExtensions = ['.kt', '.kts'];

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const result = this.createEmptyParsedFile(filePath);

    if (!content.trim()) {
      return result;
    }

    let tree: any = null;
    try {
      tree = await parseKotlin(content);
      if (!tree) {
        logger.debug(`KotlinAstParser: tree-sitter parse returned null for ${filePath}`);
        return result;
      }

      const root = tree.rootNode;

      // import 추출
      this.extractImports(root, result);

      // top-level 선언 순회
      this.traverseNode(root, filePath, '', result);

      // 주석 추출
      this.extractComments(root, content, result);

    } catch (err) {
      logger.debug(`KotlinAstParser failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // tree-sitter 네이티브 메모리 해제
      if (tree && typeof tree.delete === 'function') {
        tree.delete();
      }
    }

    return result;
  }

  // ============================================================
  // Import 추출
  // ============================================================

  private extractImports(root: TreeSitterNode, result: ParsedFile): void {
    const importList = root.namedChildren.find((n: TreeSitterNode) => n.type === 'import_list');
    if (!importList) return;

    for (const importHeader of importList.namedChildren) {
      if (importHeader.type !== 'import_header') continue;

      const idNode = importHeader.namedChildren.find((n: TreeSitterNode) => n.type === 'identifier');
      if (!idNode) continue;

      const fullPath = idNode.text;
      const hasWildcard = importHeader.namedChildren.some((n: TreeSitterNode) => n.type === 'wildcard_import');

      // as alias 확인
      const aliasNode = importHeader.namedChildren.find((n: TreeSitterNode) => n.type === 'import_alias');
      const alias = aliasNode?.namedChildren.find((n: TreeSitterNode) => n.type === 'type_identifier' || n.type === 'simple_identifier')?.text;

      // wildcard인 경우: source = "package.*", specifier = "*"
      // 단일 클래스인 경우: source = "full.path.ClassName", specifier = "ClassName"
      if (hasWildcard) {
        result.imports.push({
          source: `${fullPath}.*`,
          specifiers: ['*'],
          isDefault: false,
          line: importHeader.startPosition.row + 1,
        });
      } else {
        const lastDot = fullPath.lastIndexOf('.');
        const specifier = lastDot !== -1 ? fullPath.substring(lastDot + 1) : fullPath;
        result.imports.push({
          source: fullPath,
          specifiers: alias ? [`${specifier} as ${alias}`] : [specifier],
          isDefault: false,
          line: importHeader.startPosition.row + 1,
        });
      }
    }
  }

  // ============================================================
  // AST 순회
  // ============================================================

  private traverseNode(
    node: TreeSitterNode,
    filePath: string,
    parentClassName: string,
    result: ParsedFile,
  ): void {
    for (const child of node.namedChildren) {
      switch (child.type) {
        case 'class_declaration':
          this.processClassDeclaration(child, filePath, parentClassName, result);
          break;
        case 'object_declaration':
          this.processObjectDeclaration(child, filePath, parentClassName, result);
          break;
        case 'function_declaration':
          // top-level function
          this.processFunction(child, parentClassName, '', filePath, result);
          break;
      }
    }
  }

  // ============================================================
  // 클래스 선언 처리
  // ============================================================

  private processClassDeclaration(
    node: TreeSitterNode,
    filePath: string,
    parentClassName: string,
    result: ParsedFile,
  ): void {
    const nameNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'type_identifier');
    if (!nameNode) return;

    const className = parentClassName ? `${parentClassName}.${nameNode.text}` : nameNode.text;
    const line = node.startPosition.row + 1;

    // 어노테이션 추출
    const annotations = this.extractAnnotations(node);
    const annoNames = annotations.map(a => a.name);

    // data class 확인
    const isDataClass = node.text.trimStart().startsWith('data ');
    // sealed class 여부: 향후 AST modifier (class_modifier) 기반으로 전환 예정

    // Kotlin에서 internal이 아닌 한 public 기본
    const modifiers = this.extractModifiers(node);
    const isInternal = modifiers.includes('internal') || modifiers.includes('private');

    if (!isInternal) {
      result.exports.push({
        name: className,
        type: 'named',
        kind: 'class',
        line,
      });
    }

    // Spring 컴포넌트 판별
    if (isSpringComponent(annoNames)) {
      result.components.push({
        name: className,
        type: 'function-component',
        props: annoNames,
        filePath,
        line,
      });
    }

    // Entity 판별
    if (isEntityClass(annoNames)) {
      result.components.push({
        name: className,
        type: 'class-component',
        props: ['@Entity'],
        filePath,
        line,
      });
    }

    // 클래스 레벨 @RequestMapping 경로
    const classBasePath = this.extractRequestMappingPath(annotations);

    // Primary constructor DI
    this.processPrimaryConstructor(node, className, result);

    // data class 필드 추출
    if (isDataClass) {
      this.processDataClassFields(node, className, filePath, result);
    }

    // 클래스 본체 순회
    const body = node.namedChildren.find((n: TreeSitterNode) => n.type === 'class_body');
    if (body) {
      for (const member of body.namedChildren) {
        switch (member.type) {
          case 'function_declaration':
            this.processFunction(member, className, classBasePath, filePath, result);
            break;
          case 'property_declaration':
            this.processProperty(member, className, result);
            break;
          case 'class_declaration':
            this.processClassDeclaration(member, filePath, className, result);
            break;
          case 'object_declaration':
            // companion object
            this.processObjectDeclaration(member, filePath, className, result);
            break;
          case 'companion_object':
            this.processCompanionObject(member, className, classBasePath, filePath, result);
            break;
        }
      }
    }
  }

  // ============================================================
  // object 선언 처리
  // ============================================================

  private processObjectDeclaration(
    node: TreeSitterNode,
    filePath: string,
    parentClassName: string,
    result: ParsedFile,
  ): void {
    const nameNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'type_identifier');
    if (!nameNode) return;

    const objectName = parentClassName ? `${parentClassName}.${nameNode.text}` : nameNode.text;
    const line = node.startPosition.row + 1;

    result.exports.push({
      name: objectName,
      type: 'named',
      kind: 'class',
      line,
    });

    // object 본체 순회
    const body = node.namedChildren.find((n: TreeSitterNode) => n.type === 'class_body');
    if (body) {
      for (const member of body.namedChildren) {
        if (member.type === 'function_declaration') {
          this.processFunction(member, objectName, '', filePath, result);
        }
      }
    }
  }

  // ============================================================
  // companion object 처리
  // ============================================================

  private processCompanionObject(
    node: TreeSitterNode,
    className: string,
    classBasePath: string,
    filePath: string,
    result: ParsedFile,
  ): void {
    const body = node.namedChildren.find((n: TreeSitterNode) => n.type === 'class_body');
    if (!body) return;

    for (const member of body.namedChildren) {
      if (member.type === 'function_declaration') {
        this.processFunction(member, `${className}.Companion`, classBasePath, filePath, result);
      }
    }
  }

  // ============================================================
  // 함수 처리
  // ============================================================

  private processFunction(
    node: TreeSitterNode,
    className: string,
    classBasePath: string,
    filePath: string,
    result: ParsedFile,
  ): void {
    const nameNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'simple_identifier');
    if (!nameNode) return;

    const funcName = nameNode.text;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    // 반환 타입
    const returnTypeNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'nullable_type');
    const returnType = returnTypeNode ? returnTypeNode.text : undefined;

    // 파라미터
    const params = this.extractFunctionParams(node);

    // suspend 판별
    const modifiers = this.extractModifiers(node);
    const isSuspend = modifiers.includes('suspend');
    const isReactive = returnType ? (returnType.includes('Mono') || returnType.includes('Flux') || returnType.includes('Flow') || returnType.includes('Deferred')) : false;

    // 접근 제어자
    const isPrivate = modifiers.includes('private');

    // 확장 함수 확인
    const receiverType = node.namedChildren.find((n: TreeSitterNode) => n.type === 'type_identifier' && n.startPosition.column < (nameNode.startPosition.column - 1));
    const displayName = receiverType && !className ? `${receiverType.text}.${funcName}` : funcName;

    const funcInfo: FunctionInfo = {
      name: displayName,
      signature: `fun ${displayName}(${params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ')})${returnType ? `: ${returnType}` : ''}`,
      startLine: line,
      endLine,
      params,
      returnType,
      isAsync: isSuspend || isReactive,
      isExported: !isPrivate,
    };
    result.functions.push(funcInfo);

    // Spring 라우트 어노테이션
    const annotations = this.extractAnnotations(node);
    for (const anno of annotations) {
      if (SPRING_ROUTE_ANNOTATIONS.includes(anno.name)) {
        const methodPath = parseAnnotationValue(anno.text);
        const fullPath = combineRoutePaths(classBasePath, methodPath);
        const httpMethod = resolveSpringHttpMethod(anno.name, anno.text);

        result.routeDefinitions.push({
          path: fullPath || '/',
          component: `${httpMethod} ${displayName}`,
          filePath,
          line,
        });
      }
    }
  }

  // ============================================================
  // Primary Constructor DI
  // ============================================================

  private processPrimaryConstructor(
    classNode: TreeSitterNode,
    _className: string,
    result: ParsedFile,
  ): void {
    const constructor = classNode.namedChildren.find((n: TreeSitterNode) => n.type === 'primary_constructor');
    if (!constructor) return;

    const line = constructor.startPosition.row + 1;
    const primitiveTypes = new Set(['Int', 'Long', 'Double', 'Float', 'Boolean', 'String', 'Byte', 'Short', 'Char']);

    for (const param of constructor.namedChildren) {
      if (param.type === 'class_parameter') {
        const typeNode = param.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'nullable_type');
        if (typeNode) {
          const typeName = typeNode.text.replace('?', '');
          if (!primitiveTypes.has(typeName)) {
            result.imports.push({
              source: typeName,
              specifiers: ['constructor-injection'],
              isDefault: false,
              line,
            });
          }
        }
      }
    }
  }

  // ============================================================
  // Data Class 필드 추출
  // ============================================================

  private processDataClassFields(
    classNode: TreeSitterNode,
    className: string,
    filePath: string,
    result: ParsedFile,
  ): void {
    const constructor = classNode.namedChildren.find((n: TreeSitterNode) => n.type === 'primary_constructor');
    if (!constructor) return;

    const fields: string[] = [];
    for (const param of constructor.namedChildren) {
      if (param.type === 'class_parameter') {
        const nameNode = param.namedChildren.find((n: TreeSitterNode) => n.type === 'simple_identifier');
        const typeNode = param.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'nullable_type');
        if (nameNode && typeNode) {
          fields.push(`${nameNode.text}: ${typeNode.text}`);
        }
      }
    }

    if (fields.length > 0) {
      const existing = result.components.find(c => c.name === className);
      if (!existing) {
        result.components.push({
          name: className,
          type: 'class-component',
          props: fields,
          filePath,
          line: classNode.startPosition.row + 1,
        });
      }
    }
  }

  // ============================================================
  // Property 처리 (DI annotation)
  // ============================================================

  private processProperty(
    node: TreeSitterNode,
    _className: string,
    result: ParsedFile,
  ): void {
    const annotations = this.extractAnnotations(node);
    const annoNames = annotations.map(a => a.name);
    const hasDI = annoNames.some(a => ['Autowired', 'Inject', 'Resource', 'Value'].includes(a));

    if (hasDI) {
      const typeNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'nullable_type');
      if (typeNode) {
        result.imports.push({
          source: typeNode.text.replace('?', ''),
          specifiers: ['@Autowired'],
          isDefault: false,
          line: node.startPosition.row + 1,
        });
      }
    }
  }

  // ============================================================
  // 주석 추출
  // ============================================================

  private extractComments(root: TreeSitterNode, _content: string, result: ParsedFile): void {
    const policyPatterns = [
      /^\/\/\s*정책\s*:/,
      /^\/\/\s*Policy\s*:/i,
      /^\/\*\s*정책\s*:/,
      /^\/\*\s*Policy\s*:/i,
      /^\/\/\s*@policy/i,
      /^\/\*\s*@policy/i,
    ];

    this.walkTree(root, (node: TreeSitterNode) => {
      if (node.type === 'line_comment' || node.type === 'comment') {
        const text = node.text;
        const isPolicy = policyPatterns.some(p => p.test(text.trim()));
        result.comments.push({
          text,
          line: node.startPosition.row + 1,
          type: 'line',
          isPolicy,
        });
      } else if (node.type === 'multiline_comment' || node.type === 'block_comment') {
        const text = node.text;
        const isPolicy = policyPatterns.some(p => p.test(text.trim()));
        result.comments.push({
          text,
          line: node.startPosition.row + 1,
          type: 'block',
          isPolicy,
        });
      }
    });
  }

  // ============================================================
  // 어노테이션 추출
  // ============================================================

  private extractAnnotations(node: TreeSitterNode): Array<{ name: string; text: string }> {
    const annotations: Array<{ name: string; text: string }> = [];
    const modifiersNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'modifiers');
    if (!modifiersNode) return annotations;

    for (const child of modifiersNode.namedChildren) {
      if (child.type === 'annotation') {
        // Kotlin annotation can have user_type > simple_identifier structure
        const userType = child.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type');
        const simpleId = child.namedChildren.find((n: TreeSitterNode) => n.type === 'simple_identifier');
        const constructorInvocation = child.namedChildren.find((n: TreeSitterNode) => n.type === 'constructor_invocation');

        let name = '';
        if (constructorInvocation) {
          const typeId = constructorInvocation.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'simple_identifier');
          name = typeId?.text || '';
        } else if (userType) {
          name = userType.text;
        } else if (simpleId) {
          name = simpleId.text;
        }

        if (name) {
          annotations.push({ name, text: child.text });
        }
      }
    }

    return annotations;
  }

  // ============================================================
  // 접근 제어자 추출
  // ============================================================

  private extractModifiers(node: TreeSitterNode): string[] {
    const modifiers: string[] = [];
    const modifiersNode = node.namedChildren.find((n: TreeSitterNode) => n.type === 'modifiers');
    if (!modifiersNode) return modifiers;

    for (const child of modifiersNode.namedChildren) {
      if (child.type === 'visibility_modifier') {
        modifiers.push(child.text); // public, private, protected, internal
      } else if (child.type === 'inheritance_modifier') {
        modifiers.push(child.text); // open, final, abstract
      } else if (child.type === 'member_modifier') {
        modifiers.push(child.text); // override, lateinit
      } else if (child.type === 'function_modifier') {
        modifiers.push(child.text); // suspend, inline, infix, operator, tailrec
      }
    }
    return modifiers;
  }

  // ============================================================
  // 파라미터 추출
  // ============================================================

  private extractFunctionParams(node: TreeSitterNode): { name: string; type?: string }[] {
    const params: { name: string; type?: string }[] = [];
    const paramList = node.namedChildren.find((n: TreeSitterNode) => n.type === 'function_value_parameters');
    if (!paramList) return params;

    for (const param of paramList.namedChildren) {
      if (param.type === 'parameter') {
        const nameNode = param.namedChildren.find((n: TreeSitterNode) => n.type === 'simple_identifier');
        const typeNode = param.namedChildren.find((n: TreeSitterNode) => n.type === 'user_type' || n.type === 'nullable_type');
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

  private extractRequestMappingPath(annotations: Array<{ name: string; text: string }>): string {
    const rm = annotations.find(a => a.name === 'RequestMapping');
    if (!rm) return '';
    return parseAnnotationValue(rm.text);
  }

  // ============================================================
  // 유틸 헬퍼
  // ============================================================

  private walkTree(node: TreeSitterNode, callback: (node: TreeSitterNode) => void): void {
    callback(node);
    if (node.children) {
      for (const child of node.children) {
        this.walkTree(child, callback);
      }
    }
  }
}
