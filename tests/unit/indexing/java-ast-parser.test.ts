/**
 * JavaAstParser 단위 테스트
 * tree-sitter 기반 Java AST 파서의 정확성 검증
 */
import * as fs from 'fs';
import * as path from 'path';
import { JavaAstParser } from '../../../src/core/indexing/parsers/java-ast-parser';
import { isTreeSitterAvailable } from '../../../src/core/indexing/parsers/tree-sitter-loader';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures/sample-spring-project/src/main/java/com/example/order');

// tree-sitter가 없으면 전체 스킵
const describeIfTreeSitter = isTreeSitterAvailable() ? describe : describe.skip;

describeIfTreeSitter('JavaAstParser (tree-sitter)', () => {
  let parser: JavaAstParser;

  beforeAll(() => {
    parser = new JavaAstParser();
  });

  describe('canParse', () => {
    it('should accept .java files', () => {
      expect(parser.canParse('Foo.java')).toBe(true);
      expect(parser.canParse('com/example/Bar.java')).toBe(true);
    });

    it('should reject non-java files', () => {
      expect(parser.canParse('Foo.kt')).toBe(false);
      expect(parser.canParse('Foo.ts')).toBe(false);
    });
  });

  describe('OrderController.java', () => {
    let result: Awaited<ReturnType<JavaAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'OrderController.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('OrderController.java', content);
    });

    it('should extract imports', () => {
      expect(result.imports.length).toBeGreaterThanOrEqual(3);
      const sources = result.imports.map(i => i.source);
      expect(sources).toContain('org.springframework.web.bind.annotation.*');
      expect(sources).toContain('org.springframework.http.ResponseEntity');
    });

    it('should export the class', () => {
      const classExport = result.exports.find(e => e.name === 'OrderController');
      expect(classExport).toBeDefined();
      expect(classExport?.kind).toBe('class');
    });

    it('should detect Spring component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
      const comp = result.components.find(c => c.name === 'OrderController');
      expect(comp).toBeDefined();
    });

    it('should extract methods', () => {
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('getOrders');
      expect(funcNames).toContain('getOrder');
      expect(funcNames).toContain('createOrder');
      expect(funcNames).toContain('updateOrder');
      expect(funcNames).toContain('deleteOrder');
    });

    it('should detect route definitions', () => {
      expect(result.routeDefinitions.length).toBeGreaterThanOrEqual(3);
      const paths = result.routeDefinitions.map(r => r.path);
      // 클래스 레벨 @RequestMapping("/api/v1/orders") + 메서드 레벨
      expect(paths.some(p => p.includes('/api/v1/orders'))).toBe(true);
    });

    it('should detect constructor DI', () => {
      const diImports = result.imports.filter(i => i.specifiers.includes('constructor-injection'));
      expect(diImports.length).toBeGreaterThanOrEqual(1);
      expect(diImports.some(i => i.source === 'OrderService')).toBe(true);
    });

    it('should extract policy comments', () => {
      const policyComments = result.comments.filter(c => c.isPolicy);
      expect(policyComments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('OrderService.java', () => {
    let result: Awaited<ReturnType<JavaAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'OrderService.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('OrderService.java', content);
    });

    it('should detect @Service component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
    });

    it('should export OrderService class', () => {
      const exp = result.exports.find(e => e.name === 'OrderService');
      expect(exp).toBeDefined();
    });

    it('should extract methods', () => {
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('findAll');
      expect(funcNames).toContain('findById');
      expect(funcNames).toContain('create');
      expect(funcNames).toContain('update');
      expect(funcNames).toContain('delete');
    });

    it('should detect constructor DI for OrderRepository', () => {
      const diImports = result.imports.filter(i => i.specifiers.includes('constructor-injection'));
      expect(diImports.some(i => i.source === 'OrderRepository')).toBe(true);
    });
  });

  describe('Order.java (@Entity)', () => {
    let result: Awaited<ReturnType<JavaAstParser['parse']>>;

    beforeAll(async () => {
      const filePath = path.join(FIXTURES_DIR, 'Order.java');
      const content = fs.readFileSync(filePath, 'utf-8');
      result = await parser.parse('Order.java', content);
    });

    it('should detect @Entity component', () => {
      expect(result.components.length).toBeGreaterThanOrEqual(1);
      const entityComp = result.components.find(c => c.name === 'Order');
      expect(entityComp).toBeDefined();
    });

    it('should extract getter/setter methods', () => {
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('getId');
      expect(funcNames).toContain('setId');
      expect(funcNames).toContain('getProductName');
    });
  });

  describe('empty content', () => {
    it('should return empty ParsedFile for empty content', async () => {
      const result = await parser.parse('Empty.java', '');
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
      expect(result.functions).toHaveLength(0);
    });

    it('should return empty ParsedFile for whitespace-only content', async () => {
      const result = await parser.parse('Whitespace.java', '   \n  \n  ');
      expect(result.imports).toHaveLength(0);
    });
  });

  describe('inline Java snippets', () => {
    it('should parse a simple interface', async () => {
      const content = `
package com.example;

public interface Greeter {
    String greet(String name);
}
`;
      const result = await parser.parse('Greeter.java', content);
      const exp = result.exports.find(e => e.name === 'Greeter');
      expect(exp).toBeDefined();
    });

    it('should parse an enum', async () => {
      const content = `
package com.example;

public enum Status {
    ACTIVE, INACTIVE, DELETED
}
`;
      const result = await parser.parse('Status.java', content);
      const exp = result.exports.find(e => e.name === 'Status');
      expect(exp).toBeDefined();
    });

    it('should handle multiple imports', async () => {
      const content = `
package com.example;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public class Foo {}
`;
      const result = await parser.parse('Foo.java', content);
      expect(result.imports.filter(i => !i.specifiers.includes('constructor-injection')).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('nested / inner class parsing', () => {
    it('should parse inner class declarations with parent prefix', async () => {
      const content = `
package com.example;

public class Outer {
    private String name;

    public String getName() {
        return name;
    }

    public static class Inner {
        private int value;

        public int getValue() {
            return value;
        }
    }

    public class InnerNonStatic {
        public void doSomething() {}
    }
}
`;
      const result = await parser.parse('Outer.java', content);

      // Outer class export
      const outerExp = result.exports.find(e => e.name === 'Outer');
      expect(outerExp).toBeDefined();
      expect(outerExp?.kind).toBe('class');

      // Inner static class export with "Outer.Inner" name
      const innerExp = result.exports.find(e => e.name === 'Outer.Inner');
      expect(innerExp).toBeDefined();
      expect(innerExp?.kind).toBe('class');

      // Inner non-static class export with "Outer.InnerNonStatic" name
      const innerNonStaticExp = result.exports.find(e => e.name === 'Outer.InnerNonStatic');
      expect(innerNonStaticExp).toBeDefined();

      // Methods from both outer and inner classes
      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('getName');
      expect(funcNames).toContain('getValue');
      expect(funcNames).toContain('doSomething');
    });

    it('should parse deeply nested inner classes', async () => {
      const content = `
package com.example;

public class Level1 {
    public static class Level2 {
        public static class Level3 {
            public void deepMethod() {}
        }
    }
}
`;
      const result = await parser.parse('Level1.java', content);

      const l1 = result.exports.find(e => e.name === 'Level1');
      const l2 = result.exports.find(e => e.name === 'Level1.Level2');
      const l3 = result.exports.find(e => e.name === 'Level1.Level2.Level3');

      expect(l1).toBeDefined();
      expect(l2).toBeDefined();
      expect(l3).toBeDefined();

      const funcNames = result.functions.map(f => f.name);
      expect(funcNames).toContain('deepMethod');
    });

    it('should parse inner enum and interface', async () => {
      const content = `
package com.example;

public class Container {
    public enum Status {
        ACTIVE, INACTIVE
    }

    public interface Callback {
        void onComplete(String result);
    }
}
`;
      const result = await parser.parse('Container.java', content);

      const enumExp = result.exports.find(e => e.name === 'Container.Status');
      expect(enumExp).toBeDefined();

      const ifaceExp = result.exports.find(e => e.name === 'Container.Callback');
      expect(ifaceExp).toBeDefined();
    });
  });
});
