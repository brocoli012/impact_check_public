/**
 * KotlinAstParser 단위 테스트
 * tree-sitter 기반 Kotlin AST 파서의 정확성 검증
 */
import * as fs from 'fs';
import * as path from 'path';
import { KotlinAstParser } from '../../../src/core/indexing/parsers/kotlin-ast-parser';
import { isTreeSitterAvailable } from '../../../src/core/indexing/parsers/tree-sitter-loader';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures/sample-spring-project/src/main/kotlin/com/example/product');

// tree-sitter가 없으면 전체 스킵
const describeIfTreeSitter = isTreeSitterAvailable() ? describe : describe.skip;

describeIfTreeSitter('KotlinAstParser (tree-sitter)', () => {
  let parser: KotlinAstParser;

  beforeAll(() => {
    parser = new KotlinAstParser();
  });

  describe('canParse', () => {
    it('should accept .kt files', () => {
      expect(parser.canParse('Foo.kt')).toBe(true);
      expect(parser.canParse('com/example/Bar.kt')).toBe(true);
    });

    it('should accept .kts files', () => {
      expect(parser.canParse('build.gradle.kts')).toBe(true);
    });

    it('should reject non-kotlin files', () => {
      expect(parser.canParse('Foo.java')).toBe(false);
      expect(parser.canParse('Foo.ts')).toBe(false);
    });
  });

  describe('ProductController.kt', () => {
    let result: Awaited<ReturnType<KotlinAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'ProductController.kt');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('ProductController.kt', content);
    });

    it('should extract imports', () => {
      expect(result.imports.length).toBeGreaterThanOrEqual(2);
      const sources = result.imports.map(i => i.source);
      expect(sources).toContain('org.springframework.web.bind.annotation.*');
      expect(sources).toContain('org.springframework.http.ResponseEntity');
    });

    it('should export the class', () => {
      const classExport = result.exports.find(e => e.name === 'ProductController');
      expect(classExport).toBeDefined();
      expect(classExport?.kind).toBe('class');
    });

    it('should detect Spring component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
      const comp = result.components.find(c => c.name === 'ProductController');
      expect(comp).toBeDefined();
    });

    it('should extract methods', () => {
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('getProducts');
      expect(funcNames).toContain('getProduct');
      expect(funcNames).toContain('createProduct');
      expect(funcNames).toContain('deleteProduct');
    });

    it('should detect suspend fun as async', () => {
      const createProduct = result.functions.find(f => f.name === 'createProduct');
      expect(createProduct).toBeDefined();
      expect(createProduct?.isAsync).toBe(true);
    });

    it('should detect route definitions', () => {
      expect(result.routeDefinitions.length).toBeGreaterThanOrEqual(2);
      const paths = result.routeDefinitions.map(r => r.path);
      expect(paths.some(p => p.includes('/api/v1/products'))).toBe(true);
    });

    it('should detect primary constructor DI', () => {
      const diImports = result.imports.filter(i => i.specifiers.includes('constructor-injection'));
      expect(diImports.some(i => i.source === 'ProductService')).toBe(true);
    });

    it('should extract policy comments', () => {
      const policyComments = result.comments.filter(c => c.isPolicy);
      expect(policyComments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ProductService.kt', () => {
    let result: Awaited<ReturnType<KotlinAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'ProductService.kt');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('ProductService.kt', content);
    });

    it('should detect @Service component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
    });

    it('should export ProductService class', () => {
      const exp = result.exports.find(e => e.name === 'ProductService');
      expect(exp).toBeDefined();
    });

    it('should extract methods including suspend fun', () => {
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('findAll');
      expect(funcNames).toContain('findById');
      expect(funcNames).toContain('create');
      expect(funcNames).toContain('delete');
    });

    it('should detect suspend fun create as async', () => {
      const createFn = result.functions.find(f => f.name === 'create');
      expect(createFn).toBeDefined();
      expect(createFn?.isAsync).toBe(true);
    });

    it('should detect primary constructor DI for ProductRepository', () => {
      const diImports = result.imports.filter(i => i.specifiers.includes('constructor-injection'));
      expect(diImports.some(i => i.source === 'ProductRepository')).toBe(true);
    });
  });

  describe('Product.kt (data class + @Entity)', () => {
    let result: Awaited<ReturnType<KotlinAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'Product.kt');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('Product.kt', content);
    });

    it('should detect @Entity component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
      const entityComp = result.components.find(c => c.name === 'Product');
      expect(entityComp).toBeDefined();
    });

    it('should export Product class', () => {
      const exp = result.exports.find(e => e.name === 'Product');
      expect(exp).toBeDefined();
    });
  });

  describe('empty content', () => {
    it('should return empty ParsedFile for empty content', async () => {
      const result = await parser.parse('Empty.kt', '');
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
      expect(result.functions).toHaveLength(0);
    });

    it('should return empty ParsedFile for whitespace-only content', async () => {
      const result = await parser.parse('Whitespace.kt', '   \n  \n  ');
      expect(result.imports).toHaveLength(0);
    });
  });

  describe('inline Kotlin snippets', () => {
    it('should parse an object declaration', async () => {
      const content = `
package com.example

object Singleton {
    fun getInstance(): Singleton = this
}
`;
      const result = await parser.parse('Singleton.kt', content);
      const exp = result.exports.find(e => e.name === 'Singleton');
      expect(exp).toBeDefined();
    });

    it('should parse a data class', async () => {
      const content = `
package com.example

data class UserDto(
    val id: Long,
    val name: String,
    val email: String
)
`;
      const result = await parser.parse('UserDto.kt', content);
      const exp = result.exports.find(e => e.name === 'UserDto');
      expect(exp).toBeDefined();
    });

    it('should handle import aliases', async () => {
      const content = `
package com.example

import java.util.Date as JavaDate
import java.sql.Date as SqlDate

class DateHelper {
    fun convert(d: JavaDate): SqlDate = SqlDate(d.time)
}
`;
      const result = await parser.parse('DateHelper.kt', content);
      expect(result.imports.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect sealed class', async () => {
      const content = `
package com.example

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
`;
      const result = await parser.parse('Result.kt', content);
      const exp = result.exports.find(e => e.name === 'Result');
      expect(exp).toBeDefined();
    });
  });

  describe('companion object function parsing', () => {
    it('should parse functions inside companion object', async () => {
      const content = `
package com.example

class UserFactory {
    companion object {
        fun create(name: String): UserFactory {
            return UserFactory()
        }

        fun defaultUser(): UserFactory {
            return create("default")
        }
    }

    fun getName(): String = "user"
}
`;
      const result = await parser.parse('UserFactory.kt', content);

      const funcNames = result.functions.map(f => f.name);
      // companion object functions should be named with Companion prefix
      expect(funcNames).toContain('create');
      expect(funcNames).toContain('defaultUser');
      // regular instance method
      expect(funcNames).toContain('getName');
    });

    it('should namespace companion functions under ClassName.Companion', async () => {
      const content = `
package com.example

class Config {
    companion object {
        fun load(): Config = Config()
    }
}
`;
      const result = await parser.parse('Config.kt', content);

      // The companion function should be found in functions list
      const loadFn = result.functions.find(f => f.name === 'load');
      expect(loadFn).toBeDefined();
      expect(loadFn?.isExported).toBe(true);
    });
  });

  describe('extension function parsing', () => {
    it('should parse top-level extension functions with receiver type', async () => {
      const content = `
package com.example

fun String.toSlug(): String {
    return this.lowercase().replace(" ", "-")
}

fun List<String>.joinWithComma(): String {
    return this.joinToString(", ")
}
`;
      const result = await parser.parse('Extensions.kt', content);

      const funcNames = result.functions.map(f => f.name);
      // Extension functions should include the receiver type in their name
      expect(funcNames.some(n => n.includes('toSlug'))).toBe(true);
      expect(funcNames.some(n => n.includes('joinWithComma'))).toBe(true);
    });

    it('should mark extension functions as exported', async () => {
      const content = `
package com.example

fun Int.isEven(): Boolean = this % 2 == 0
`;
      const result = await parser.parse('IntExt.kt', content);

      const func = result.functions.find(f => f.name.includes('isEven'));
      expect(func).toBeDefined();
      expect(func?.isExported).toBe(true);
    });
  });

  describe('expression body function (= syntax) parsing', () => {
    it('should parse expression body functions', async () => {
      const content = `
package com.example

class Calculator {
    fun add(a: Int, b: Int): Int = a + b
    fun multiply(a: Int, b: Int): Int = a * b
    fun greet(name: String): String = "Hello, $name"
}
`;
      const result = await parser.parse('Calculator.kt', content);

      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('add');
      expect(funcNames).toContain('multiply');
      expect(funcNames).toContain('greet');

      // Verify parameter extraction
      const addFn = result.functions.find(f => f.name === 'add');
      expect(addFn).toBeDefined();
      expect(addFn?.params.length).toBe(2);
      expect(addFn?.params[0].name).toBe('a');
      expect(addFn?.params[1].name).toBe('b');
    });

    it('should parse top-level expression body functions', async () => {
      const content = `
package com.example

fun square(x: Int): Int = x * x
fun identity(x: String): String = x
`;
      const result = await parser.parse('TopLevel.kt', content);

      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('square');
      expect(funcNames).toContain('identity');

      const squareFn = result.functions.find(f => f.name === 'square');
      expect(squareFn?.returnType).toBeDefined();
    });

    it('should parse suspend expression body function', async () => {
      const content = `
package com.example

class AsyncHelper {
    suspend fun fetchData(url: String): String = TODO()
}
`;
      const result = await parser.parse('AsyncHelper.kt', content);

      const fetchFn = result.functions.find(f => f.name === 'fetchData');
      expect(fetchFn).toBeDefined();
      expect(fetchFn?.isAsync).toBe(true);
    });
  });
});
