/**
 * ParsedFileNormalizer 단위 테스트
 * TASK-065: 중첩 클래스 정규화 정보 보존 (Outer.Inner → Outer$Inner)
 * TASK-067: wildcard import source 통일 ("pkg.*" → "pkg")
 */
import { ParsedFileNormalizer, StringInterner } from '../../../src/core/indexing/parsers/parsed-file-normalizer';
import { ParsedFile } from '../../../src/core/indexing/types';

/** 최소 ParsedFile 헬퍼 생성 */
function createEmptyParsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    filePath: 'test/Foo.java',
    imports: [],
    exports: [],
    functions: [],
    components: [],
    apiCalls: [],
    routeDefinitions: [],
    comments: [],
    ...overrides,
  };
}

describe('ParsedFileNormalizer', () => {
  let normalizer: ParsedFileNormalizer;

  beforeEach(() => {
    normalizer = new ParsedFileNormalizer();
  });

  // ==============================================================
  // TASK-065: 중첩 클래스 정규화 - exports
  // ==============================================================
  describe('TASK-065: nested class normalization (exports)', () => {
    it('should convert Outer.Inner → Outer$Inner for AST parser exports', () => {
      const parsed = createEmptyParsedFile({
        exports: [
          { name: 'OrderController.OrderDTO', type: 'named', kind: 'class', line: 10 },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.exports[0].name).toBe('OrderController$OrderDTO');
    });

    it('should convert deeply nested A.B.C → A$B$C for AST parser exports', () => {
      const parsed = createEmptyParsedFile({
        exports: [
          { name: 'Outer.Middle.Inner', type: 'named', kind: 'class', line: 5 },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.exports[0].name).toBe('Outer$Middle$Inner');
    });

    it('should NOT modify export names without dots for AST parser', () => {
      const parsed = createEmptyParsedFile({
        exports: [
          { name: 'SimpleClass', type: 'named', kind: 'class', line: 1 },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.exports[0].name).toBe('SimpleClass');
    });

    it('should NOT modify export names for regex parser even with dots', () => {
      const parsed = createEmptyParsedFile({
        exports: [
          { name: 'Outer.Inner', type: 'named', kind: 'class', line: 1 },
        ],
      });

      const result = normalizer.normalize(parsed, 'regex');

      // Regex 파서는 중첩 클래스를 dot-separated로 생성하지 않으므로
      // dot이 있어도 변환하지 않아야 함
      expect(result.exports[0].name).toBe('Outer.Inner');
    });
  });

  // ==============================================================
  // TASK-065: 중첩 클래스 정규화 - components
  // ==============================================================
  describe('TASK-065: nested class normalization (components)', () => {
    it('should convert Outer.Inner → Outer$Inner for AST parser components', () => {
      const parsed = createEmptyParsedFile({
        components: [
          {
            name: 'OrderController.InnerService',
            type: 'function-component',
            props: ['Service'],
            filePath: 'test/Foo.java',
            line: 20,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.components[0].name).toBe('OrderController$InnerService');
    });

    it('should NOT modify component names without dots for AST parser', () => {
      const parsed = createEmptyParsedFile({
        components: [
          {
            name: 'OrderService',
            type: 'function-component',
            props: ['Service'],
            filePath: 'test/Foo.java',
            line: 1,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.components[0].name).toBe('OrderService');
    });

    it('should NOT modify component names for regex parser', () => {
      const parsed = createEmptyParsedFile({
        components: [
          {
            name: 'SomeComponent',
            type: 'function-component',
            props: ['Controller'],
            filePath: 'test/Foo.java',
            line: 1,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'regex');

      expect(result.components[0].name).toBe('SomeComponent');
    });
  });

  // ==============================================================
  // TASK-067: wildcard import source 통일
  // ==============================================================
  describe('TASK-067: wildcard import source normalization', () => {
    it('should strip trailing .* from AST parser wildcard import source', () => {
      const parsed = createEmptyParsedFile({
        imports: [
          {
            source: 'org.springframework.web.bind.annotation.*',
            specifiers: ['*'],
            isDefault: false,
            line: 3,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.imports[0].source).toBe('org.springframework.web.bind.annotation');
      expect(result.imports[0].specifiers).toEqual(['*']);
    });

    it('should not modify regex parser wildcard import (already without .*)', () => {
      const parsed = createEmptyParsedFile({
        imports: [
          {
            source: 'org.springframework.web.bind.annotation',
            specifiers: ['*'],
            isDefault: false,
            line: 3,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'regex');

      expect(result.imports[0].source).toBe('org.springframework.web.bind.annotation');
    });

    it('should produce identical source for AST and Regex wildcard imports', () => {
      // AST 파서 출력 형태
      const astParsed = createEmptyParsedFile({
        imports: [
          { source: 'java.util.*', specifiers: ['*'], isDefault: false, line: 1 },
        ],
      });

      // Regex 파서 출력 형태
      const regexParsed = createEmptyParsedFile({
        imports: [
          { source: 'java.util', specifiers: ['*'], isDefault: false, line: 1 },
        ],
      });

      const astResult = normalizer.normalize(astParsed, 'ast');
      const regexResult = normalizer.normalize(regexParsed, 'regex');

      expect(astResult.imports[0].source).toBe(regexResult.imports[0].source);
      expect(astResult.imports[0].source).toBe('java.util');
    });

    it('should not modify non-wildcard import sources', () => {
      const parsed = createEmptyParsedFile({
        imports: [
          {
            source: 'org.springframework.http.ResponseEntity',
            specifiers: ['ResponseEntity'],
            isDefault: false,
            line: 5,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.imports[0].source).toBe('org.springframework.http.ResponseEntity');
    });

    it('should handle static wildcard imports', () => {
      const parsed = createEmptyParsedFile({
        imports: [
          {
            source: 'org.junit.Assert.*',
            specifiers: ['static *'],
            isDefault: false,
            line: 2,
          },
        ],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.imports[0].source).toBe('org.junit.Assert');
      expect(result.imports[0].specifiers).toEqual(['static *']);
    });
  });

  // ==============================================================
  // 기존 정규화 기능 회귀 테스트
  // ==============================================================
  describe('existing normalization (regression)', () => {
    it('should enforce minimum line 1 for exports', () => {
      const parsed = createEmptyParsedFile({
        exports: [{ name: 'Foo', type: 'named', kind: 'class', line: 0 }],
      });

      const result = normalizer.normalize(parsed, 'regex');

      expect(result.exports[0].line).toBe(1);
    });

    it('should enforce minimum line 1 for imports', () => {
      const parsed = createEmptyParsedFile({
        imports: [{ source: 'java.util.List', specifiers: ['List'], isDefault: false, line: -1 }],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.imports[0].line).toBe(1);
    });

    it('should normalize function signature whitespace', () => {
      const parsed = createEmptyParsedFile({
        functions: [{
          name: 'foo',
          signature: 'void   foo(  int  x ,  int   y )',
          startLine: 10,
          endLine: 20,
          params: [],
          isAsync: false,
          isExported: true,
        }],
      });

      const result = normalizer.normalize(parsed, 'regex');

      expect(result.functions[0].signature).toBe('void foo( int x , int y )');
    });

    it('should ensure endLine >= startLine for functions', () => {
      const parsed = createEmptyParsedFile({
        functions: [{
          name: 'bar',
          signature: 'void bar()',
          startLine: 30,
          endLine: 10, // endLine < startLine (invalid)
          params: [],
          isAsync: false,
          isExported: true,
        }],
      });

      const result = normalizer.normalize(parsed, 'ast');

      expect(result.functions[0].endLine).toBeGreaterThanOrEqual(result.functions[0].startLine);
    });
  });

  // ==============================================================
  // StringInterner 테스트
  // ==============================================================
  describe('StringInterner', () => {
    it('should return same reference for identical strings', () => {
      const interner = new StringInterner();
      const s1 = interner.intern('org.springframework.stereotype.Service');
      const s2 = interner.intern('org.springframework.stereotype.Service');

      // 동일 참조
      expect(s1).toBe(s2);
      expect(interner.size).toBe(1);
    });

    it('should track pool size', () => {
      const interner = new StringInterner();
      interner.intern('a');
      interner.intern('b');
      interner.intern('a'); // 중복

      expect(interner.size).toBe(2);
    });

    it('should clear pool', () => {
      const interner = new StringInterner();
      interner.intern('x');
      interner.clear();

      expect(interner.size).toBe(0);
    });
  });
});
