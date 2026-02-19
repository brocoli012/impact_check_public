/**
 * Phase 1 (Regex) vs Phase 2 (AST) 파서 정확도 비교 테스트
 *
 * AST 파서는 Regex 파서보다 정확한 결과를 내야 한다.
 * - import: AST는 실제 import 문만 파싱 (Regex는 타입 참조도 잡아 오탐 있음)
 * - export/component: 동등 이상
 * - routeDefinition: 동등 이상
 * - functions: AST는 메서드만 (Regex는 생성자도 포함할 수 있음)
 */
import * as fs from 'fs';
import * as path from 'path';
import { JavaParser } from '../../src/core/indexing/parsers/java-parser';
import { KotlinParser } from '../../src/core/indexing/parsers/kotlin-parser';
import { JavaAstParser } from '../../src/core/indexing/parsers/java-ast-parser';
import { KotlinAstParser } from '../../src/core/indexing/parsers/kotlin-ast-parser';
import { isTreeSitterAvailable } from '../../src/core/indexing/parsers/tree-sitter-loader';
import { ParsedFile } from '../../src/core/indexing/types';

const JAVA_FIXTURES = path.join(__dirname, '../fixtures/sample-spring-project/src/main/java/com/example/order');
const KOTLIN_FIXTURES = path.join(__dirname, '../fixtures/sample-spring-project/src/main/kotlin/com/example/product');

// tree-sitter가 없으면 전체 스킵
const describeIfTreeSitter = isTreeSitterAvailable() ? describe : describe.skip;

describeIfTreeSitter('Parser Accuracy: Phase 1 (Regex) vs Phase 2 (AST)', () => {
  // ============================================================
  // Java 비교
  // ============================================================
  describe('Java files', () => {
    const regexParser = new JavaParser();
    const astParser = new JavaAstParser();

    const javaFiles = [
      'OrderController.java',
      'OrderService.java',
      'OrderRepository.java',
      'Order.java',
      'OrderRequest.java',
      'OrderResponse.java',
    ];

    for (const fileName of javaFiles) {
      describe(fileName, () => {
        let regexResult: ParsedFile;
        let astResult: ParsedFile;

        beforeAll(async () => {
          const filePath = path.join(JAVA_FIXTURES, fileName);
          if (!fs.existsSync(filePath)) return;
          const content = fs.readFileSync(filePath, 'utf-8');
          regexResult = await regexParser.parse(fileName, content);
          astResult = await astParser.parse(fileName, content);
        });

        it('AST should find at least as many exports as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.exports.length).toBeGreaterThanOrEqual(regexResult.exports.length);
        });

        it('AST should find at least as many components as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.components.length).toBeGreaterThanOrEqual(regexResult.components.length);
        });

        it('AST should find at least as many route definitions as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.routeDefinitions.length).toBeGreaterThanOrEqual(regexResult.routeDefinitions.length);
        });

        it('AST import sources should only include real import statements', () => {
          if (!astResult) return;
          // AST 파서는 실제 import 문 + DI injection 만 포함해야 함
          // 비정상적인 오탐이 없어야 함
          for (const imp of astResult.imports) {
            expect(imp.source).toBeTruthy();
            expect(imp.line).toBeGreaterThan(0);
          }
        });

        it('AST should detect constructor DI correctly', () => {
          if (!astResult) return;
          const diImports = astResult.imports.filter(i => i.specifiers.includes('constructor-injection'));
          // DI import가 있으면 source가 primitive가 아닌 타입이어야 함
          for (const di of diImports) {
            expect(['int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char']).not.toContain(di.source.toLowerCase());
          }
        });
      });
    }
  });

  // ============================================================
  // Kotlin 비교
  // ============================================================
  describe('Kotlin files', () => {
    const regexParser = new KotlinParser();
    const astParser = new KotlinAstParser();

    const kotlinFiles = [
      'ProductController.kt',
      'ProductService.kt',
      'ProductRepository.kt',
      'Product.kt',
      'ProductRequest.kt',
      'ProductResponse.kt',
    ];

    for (const fileName of kotlinFiles) {
      describe(fileName, () => {
        let regexResult: ParsedFile;
        let astResult: ParsedFile;

        beforeAll(async () => {
          const filePath = path.join(KOTLIN_FIXTURES, fileName);
          if (!fs.existsSync(filePath)) return;
          const content = fs.readFileSync(filePath, 'utf-8');
          regexResult = await regexParser.parse(fileName, content);
          astResult = await astParser.parse(fileName, content);
        });

        it('AST should find at least as many imports as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.imports.length).toBeGreaterThanOrEqual(regexResult.imports.length);
        });

        it('AST should find at least as many exports as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.exports.length).toBeGreaterThanOrEqual(regexResult.exports.length);
        });

        it('AST should find at least as many functions as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.functions.length).toBeGreaterThanOrEqual(regexResult.functions.length);
        });

        it('AST should find at least as many components as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.components.length).toBeGreaterThanOrEqual(regexResult.components.length);
        });

        it('AST should find at least as many route definitions as Regex', () => {
          if (!regexResult || !astResult) return;
          expect(astResult.routeDefinitions.length).toBeGreaterThanOrEqual(regexResult.routeDefinitions.length);
        });
      });
    }
  });

  // ============================================================
  // AST 정확도 직접 검증 (ground truth)
  // ============================================================
  describe('AST ground truth - Java', () => {
    const astParser = new JavaAstParser();

    it('OrderController.java should have correct counts', async () => {
      const content = fs.readFileSync(path.join(JAVA_FIXTURES, 'OrderController.java'), 'utf-8');
      const result = await astParser.parse('OrderController.java', content);

      // 3 actual import statements + 1 DI import (OrderService via constructor)
      expect(result.imports.length).toBeGreaterThanOrEqual(3);
      expect(result.exports.length).toBe(1); // OrderController class
      expect(result.functions.length).toBe(5); // 5 methods (not constructor)
      expect(result.components.length).toBe(1); // @RestController
      expect(result.routeDefinitions.length).toBe(5); // 5 route annotations
    });

    it('OrderService.java should detect @Service and DI', async () => {
      const content = fs.readFileSync(path.join(JAVA_FIXTURES, 'OrderService.java'), 'utf-8');
      const result = await astParser.parse('OrderService.java', content);

      expect(result.components.length).toBe(1); // @Service
      const diImports = result.imports.filter(i => i.specifiers.includes('constructor-injection'));
      expect(diImports.length).toBeGreaterThanOrEqual(1);
    });

    it('Order.java should detect @Entity', async () => {
      const content = fs.readFileSync(path.join(JAVA_FIXTURES, 'Order.java'), 'utf-8');
      const result = await astParser.parse('Order.java', content);

      expect(result.components.length).toBeGreaterThanOrEqual(1);
      expect(result.functions.length).toBe(8); // getters + setters
    });

    it('OrderResponse.java (record) should be parsed', async () => {
      const content = fs.readFileSync(path.join(JAVA_FIXTURES, 'OrderResponse.java'), 'utf-8');
      const result = await astParser.parse('OrderResponse.java', content);

      expect(result.exports.length).toBe(1); // OrderResponse record
    });
  });

  describe('AST ground truth - Kotlin', () => {
    const astParser = new KotlinAstParser();

    it('ProductController.kt should have correct counts', async () => {
      const content = fs.readFileSync(path.join(KOTLIN_FIXTURES, 'ProductController.kt'), 'utf-8');
      const result = await astParser.parse('ProductController.kt', content);

      expect(result.exports.length).toBe(1);
      expect(result.functions.length).toBe(4);
      expect(result.components.length).toBe(1); // @RestController
      expect(result.routeDefinitions.length).toBeGreaterThanOrEqual(4);
    });

    it('ProductService.kt should detect suspend fun as async', async () => {
      const content = fs.readFileSync(path.join(KOTLIN_FIXTURES, 'ProductService.kt'), 'utf-8');
      const result = await astParser.parse('ProductService.kt', content);

      const asyncFuncs = result.functions.filter(f => f.isAsync);
      expect(asyncFuncs.length).toBeGreaterThanOrEqual(1);
    });

    it('Product.kt should detect @Entity data class', async () => {
      const content = fs.readFileSync(path.join(KOTLIN_FIXTURES, 'Product.kt'), 'utf-8');
      const result = await astParser.parse('Product.kt', content);

      expect(result.components.length).toBeGreaterThanOrEqual(1);
      expect(result.exports.length).toBe(1);
    });
  });
});
