/**
 * @module tests/unit/indexing/policy-extractor
 * @description PolicyExtractor 단위 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import { PolicyExtractor } from '../../../src/core/indexing/policy-extractor';
import { ParsedFile, CommentInfo } from '../../../src/core/indexing/types';

describe('PolicyExtractor', () => {
  let extractor: PolicyExtractor;

  beforeEach(() => {
    extractor = new PolicyExtractor();
  });

  function createParsedFile(
    filePath: string,
    comments: CommentInfo[],
  ): ParsedFile {
    return {
      filePath,
      imports: [],
      exports: [],
      functions: [],
      components: [],
      apiCalls: [],
      routeDefinitions: [],
      comments,
    };
  }

  describe('extractFromComments()', () => {
    it('should extract Korean policy comments', () => {
      const files = [
        createParsedFile('src/components/Cart.tsx', [
          {
            text: '// 정책: 장바구니는 최대 100개의 상품만 담을 수 있습니다.',
            line: 10,
            type: 'line',
            isPolicy: true,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(1);
      expect(policies[0].source).toBe('comment');
      expect(policies[0].description).toContain('장바구니');
      expect(policies[0].extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should extract English policy comments', () => {
      const files = [
        createParsedFile('src/api/auth.ts', [
          {
            text: '// Policy: Authentication is required for all API endpoints.',
            line: 5,
            type: 'line',
            isPolicy: true,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(1);
      expect(policies[0].description).toContain('Authentication');
      expect(policies[0].extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should extract @policy annotations', () => {
      const files = [
        createParsedFile('src/api/reviews.ts', [
          {
            text: '// @policy Reviews must be moderated before publishing.',
            line: 3,
            type: 'line',
            isPolicy: true,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(1);
    });

    it('should detect category from content', () => {
      const files = [
        createParsedFile('src/auth.ts', [
          {
            text: '// 정책: 보안을 위해 비밀번호는 암호화해야 합니다.',
            line: 1,
            type: 'line',
            isPolicy: true,
          },
        ]),
        createParsedFile('src/cart.ts', [
          {
            text: '// Policy: Payment must be processed within 30 seconds.',
            line: 1,
            type: 'line',
            isPolicy: true,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(2);
      const securityPolicy = policies.find(p => p.category === 'security');
      const businessPolicy = policies.find(p => p.category === 'business');
      expect(securityPolicy).toBeDefined();
      expect(businessPolicy).toBeDefined();
    });

    it('should skip non-policy comments', () => {
      const files = [
        createParsedFile('src/utils.ts', [
          {
            text: '// This is a regular comment',
            line: 1,
            type: 'line',
            isPolicy: false,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(0);
    });

    it('should handle files with no comments', () => {
      const files = [
        createParsedFile('src/empty.ts', []),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies.length).toBe(0);
    });

    it('should include file path and line number', () => {
      const files = [
        createParsedFile('src/components/ProductCard.tsx', [
          {
            text: '// 정책: 상품 카드에는 이미지가 필수입니다.',
            line: 15,
            type: 'line',
            isPolicy: true,
          },
        ]),
      ];

      const policies = extractor.extractFromComments(files);

      expect(policies[0].filePath).toBe('src/components/ProductCard.tsx');
      expect(policies[0].lineNumber).toBe(15);
    });
  });

  describe('extractFromDocs()', () => {
    it('should handle project without policy docs', async () => {
      // Create a temp directory without any policy files
      const tmpDir = path.join(__dirname, '../../fixtures/empty-project-tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const policies = await extractor.extractFromDocs(tmpDir);

      expect(policies).toEqual([]);

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('loadManualPolicies()', () => {
    it('should handle project without policies.yaml', async () => {
      const tmpDir = path.join(__dirname, '../../fixtures/empty-project-tmp2');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const policies = await extractor.loadManualPolicies(tmpDir);

      expect(policies).toEqual([]);

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should load policies from policies.yaml', async () => {
      const tmpDir = path.join(__dirname, '../../fixtures/yaml-test-tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const yamlContent = `policies:
  - name: "Security Policy"
    description: "All endpoints require authentication"
    category: "security"
  - name: "Performance Policy"
    description: "API responses must be under 200ms"
    category: "performance"
`;
      fs.writeFileSync(path.join(tmpDir, 'policies.yaml'), yamlContent);

      const policies = await extractor.loadManualPolicies(tmpDir);

      expect(policies.length).toBe(2);
      expect(policies[0].name).toBe('Security Policy');
      expect(policies[0].source).toBe('manual');
      expect(policies[0].extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(policies[1].name).toBe('Performance Policy');
      expect(policies[1].extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('mergeAllPolicies()', () => {
    it('should merge policies from multiple sources', () => {
      const commentPolicies = [
        {
          id: 'p1',
          name: 'Policy A',
          description: 'Description A',
          source: 'comment' as const,
          sourceText: '// Policy: A',
          filePath: 'src/a.ts',
          lineNumber: 1,
          category: 'general',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: [],
          extractedAt: new Date().toISOString(),
        },
      ];

      const docPolicies = [
        {
          id: 'p2',
          name: 'Policy B',
          description: 'Description B',
          source: 'readme' as const,
          sourceText: '## Policy B',
          filePath: 'POLICY.md',
          lineNumber: 5,
          category: 'security',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: [],
          extractedAt: new Date().toISOString(),
        },
      ];

      const merged = extractor.mergeAllPolicies(commentPolicies, docPolicies);

      expect(merged.length).toBe(2);
      // IDs should be renumbered
      expect(merged[0].id).toBe('policy-1');
      expect(merged[1].id).toBe('policy-2');
    });

    it('should deduplicate by name+description', () => {
      const source1 = [
        {
          id: 'p1',
          name: 'Same Policy',
          description: 'Same Description',
          source: 'comment' as const,
          sourceText: '',
          filePath: 'a.ts',
          lineNumber: 1,
          category: 'general',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: [],
          extractedAt: new Date().toISOString(),
        },
      ];

      const source2 = [
        {
          id: 'p2',
          name: 'Same Policy',
          description: 'Same Description',
          source: 'manual' as const,
          sourceText: '',
          filePath: 'policies.yaml',
          lineNumber: 0,
          category: 'general',
          relatedComponents: [],
          relatedApis: [],
          relatedModules: [],
          extractedAt: new Date().toISOString(),
        },
      ];

      const merged = extractor.mergeAllPolicies(source1, source2);

      expect(merged.length).toBe(1);
    });

    it('should handle empty sources', () => {
      const merged = extractor.mergeAllPolicies([], [], []);

      expect(merged.length).toBe(0);
    });
  });
});
