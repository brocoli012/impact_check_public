/**
 * jvm-parser-utils 단위 테스트
 */
import {
  parseAnnotationValue,
  resolveSpringHttpMethod,
  combineRoutePaths,
  isSpringComponent,
  mapSpringComponentType,
  isEntityClass,
  isDIAnnotation,
  extractAnnotationName,
  getLineNumber,
  stripStringsAndComments,
} from '../../../src/core/indexing/parsers/jvm-parser-utils';

describe('jvm-parser-utils', () => {
  describe('parseAnnotationValue', () => {
    it('should extract value from @GetMapping("/path")', () => {
      expect(parseAnnotationValue('@GetMapping("/api/orders")')).toBe('/api/orders');
    });

    it('should extract value= attribute', () => {
      expect(parseAnnotationValue('@RequestMapping(value = "/api")')).toBe('/api');
    });

    it('should extract path= attribute', () => {
      expect(parseAnnotationValue('@RequestMapping(path = "/api")')).toBe('/api');
    });

    it('should return empty for annotation without parens', () => {
      expect(parseAnnotationValue('@GetMapping')).toBe('');
    });

    it('should return empty for empty parens', () => {
      expect(parseAnnotationValue('@GetMapping()')).toBe('');
    });
  });

  describe('resolveSpringHttpMethod', () => {
    it('should return GET for GetMapping', () => {
      expect(resolveSpringHttpMethod('GetMapping', '@GetMapping("/test")')).toBe('GET');
    });

    it('should return POST for PostMapping', () => {
      expect(resolveSpringHttpMethod('PostMapping', '@PostMapping("/test")')).toBe('POST');
    });

    it('should return PUT for PutMapping', () => {
      expect(resolveSpringHttpMethod('PutMapping', '@PutMapping("/test")')).toBe('PUT');
    });

    it('should return DELETE for DeleteMapping', () => {
      expect(resolveSpringHttpMethod('DeleteMapping', '@DeleteMapping("/test")')).toBe('DELETE');
    });

    it('should parse method from RequestMapping', () => {
      expect(resolveSpringHttpMethod('RequestMapping', '@RequestMapping(method = RequestMethod.POST)')).toBe('POST');
    });

    it('should default to GET for RequestMapping without method', () => {
      expect(resolveSpringHttpMethod('RequestMapping', '@RequestMapping("/test")')).toBe('GET');
    });
  });

  describe('combineRoutePaths', () => {
    it('should combine base and method paths', () => {
      expect(combineRoutePaths('/api/v1', 'orders')).toBe('/api/v1/orders');
    });

    it('should handle trailing slash on base', () => {
      expect(combineRoutePaths('/api/v1/', '/orders')).toBe('/api/v1/orders');
    });

    it('should return methodPath when basePath is empty', () => {
      expect(combineRoutePaths('', '/orders')).toBe('/orders');
    });

    it('should return basePath when methodPath is empty', () => {
      expect(combineRoutePaths('/api/v1', '')).toBe('/api/v1');
    });

    it('should return empty when both are empty', () => {
      expect(combineRoutePaths('', '')).toBe('');
    });
  });

  describe('isSpringComponent', () => {
    it('should detect RestController', () => {
      expect(isSpringComponent(['RestController'])).toBe(true);
    });

    it('should detect Service', () => {
      expect(isSpringComponent(['Service'])).toBe(true);
    });

    it('should detect Repository', () => {
      expect(isSpringComponent(['Repository'])).toBe(true);
    });

    it('should return false for non-component annotations', () => {
      expect(isSpringComponent(['Entity', 'Table'])).toBe(false);
    });
  });

  describe('mapSpringComponentType', () => {
    it('should map RestController', () => {
      expect(mapSpringComponentType(['RestController'])).toBe('rest-controller');
    });

    it('should map Service', () => {
      expect(mapSpringComponentType(['Service'])).toBe('service');
    });

    it('should map Repository', () => {
      expect(mapSpringComponentType(['Repository'])).toBe('repository');
    });

    it('should prioritize RestController over Component', () => {
      expect(mapSpringComponentType(['Component', 'RestController'])).toBe('rest-controller');
    });

    it('should default to component', () => {
      expect(mapSpringComponentType([])).toBe('component');
    });
  });

  describe('isEntityClass', () => {
    it('should detect Entity annotation', () => {
      expect(isEntityClass(['Entity'])).toBe(true);
    });

    it('should detect Document annotation', () => {
      expect(isEntityClass(['Document'])).toBe(true);
    });

    it('should return false for non-entity annotations', () => {
      expect(isEntityClass(['Service', 'Component'])).toBe(false);
    });
  });

  describe('isDIAnnotation', () => {
    it('should detect Autowired', () => {
      expect(isDIAnnotation('Autowired')).toBe(true);
    });

    it('should detect Inject', () => {
      expect(isDIAnnotation('Inject')).toBe(true);
    });

    it('should return false for non-DI annotations', () => {
      expect(isDIAnnotation('GetMapping')).toBe(false);
    });
  });

  describe('extractAnnotationName', () => {
    it('should extract name from @GetMapping("/path")', () => {
      expect(extractAnnotationName('@GetMapping("/path")')).toBe('GetMapping');
    });

    it('should extract name from @Service', () => {
      expect(extractAnnotationName('@Service')).toBe('Service');
    });

    it('should handle name without @', () => {
      expect(extractAnnotationName('Service')).toBe('Service');
    });
  });

  describe('getLineNumber', () => {
    it('should return 1 for index 0', () => {
      expect(getLineNumber('hello\nworld', 0)).toBe(1);
    });

    it('should return 2 for index after first newline', () => {
      expect(getLineNumber('hello\nworld', 6)).toBe(2);
    });

    it('should handle out of bounds', () => {
      expect(getLineNumber('hello', -1)).toBe(1);
    });
  });

  describe('stripStringsAndComments', () => {
    it('should strip line comments', () => {
      const input = 'code // comment\nmore code';
      const { processed, comments } = stripStringsAndComments(input);
      expect(processed).not.toContain('comment');
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe('line');
    });

    it('should strip block comments', () => {
      const input = 'code /* block\ncomment */ more';
      const { processed, comments } = stripStringsAndComments(input);
      expect(processed).not.toContain('block');
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe('block');
    });

    it('should preserve line structure', () => {
      const input = 'line1\n/* comment */\nline3';
      const { processed } = stripStringsAndComments(input);
      const lines = processed.split('\n');
      expect(lines.length).toBe(3);
    });

    it('should handle string literals', () => {
      const input = 'String s = "hello // not a comment";';
      const { comments } = stripStringsAndComments(input);
      expect(comments).toHaveLength(0);
    });
  });
});
