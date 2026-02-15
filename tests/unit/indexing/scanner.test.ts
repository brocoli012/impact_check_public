/**
 * @module tests/unit/indexing/scanner
 * @description FileScanner 단위 테스트
 */

import * as path from 'path';
import { FileScanner } from '../../../src/core/indexing/scanner';

const FIXTURE_PATH = path.resolve(__dirname, '../../fixtures/sample-project');

describe('FileScanner', () => {
  let scanner: FileScanner;

  beforeEach(() => {
    scanner = new FileScanner();
  });

  describe('scan()', () => {
    it('should scan project files and return ScanResult', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      expect(result).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.techStack).toBeInstanceOf(Array);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalFiles).toBe(result.files.length);
      expect(result.stats.totalLines).toBeGreaterThan(0);
    });

    it('should detect supported file extensions', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      const extensions = result.files.map(f => f.extension);
      // sample-project has .ts and .tsx files
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.ts');
    });

    it('should include file hashes', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      for (const file of result.files) {
        expect(file.hash).toBeDefined();
        expect(file.hash.length).toBe(64); // SHA-256 hex
      }
    });

    it('should include file size and lastModified', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      for (const file of result.files) {
        expect(file.size).toBeGreaterThan(0);
        expect(file.lastModified).toBeDefined();
      }
    });

    it('should produce consistent hashes for same file content', async () => {
      const result1 = await scanner.scan(FIXTURE_PATH);
      const result2 = await scanner.scan(FIXTURE_PATH);

      const file1 = result1.files.find(f => f.path.includes('helpers'));
      const file2 = result2.files.find(f => f.path.includes('helpers'));

      expect(file1).toBeDefined();
      expect(file2).toBeDefined();
      expect(file1!.hash).toBe(file2!.hash);
    });

    it('should count language statistics', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      expect(Object.keys(result.stats.languages).length).toBeGreaterThan(0);
      // Should have TypeScript and TypeScript (JSX)
      const totalFromLanguages = Object.values(result.stats.languages).reduce((a, b) => a + b, 0);
      expect(totalFromLanguages).toBe(result.stats.totalFiles);
    });

    it('should throw error for non-existent path', async () => {
      await expect(scanner.scan('/nonexistent/path')).rejects.toThrow('does not exist');
    });

    it('should throw error for non-directory path', async () => {
      const filePath = path.join(FIXTURE_PATH, 'package.json');
      await expect(scanner.scan(filePath)).rejects.toThrow('not a directory');
    });
  });

  describe('.gitignore patterns', () => {
    it('should exclude node_modules by default', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      const hasNodeModules = result.files.some(f =>
        f.path.includes('node_modules')
      );
      expect(hasNodeModules).toBe(false);
    });

    it('should exclude dist/build by default', async () => {
      const result = await scanner.scan(FIXTURE_PATH);

      const hasDist = result.files.some(f =>
        f.path.includes('dist/') || f.path.includes('build/')
      );
      expect(hasDist).toBe(false);
    });
  });

  describe('tech stack detection', () => {
    it('should detect React from package.json', async () => {
      const result = await scanner.scan(FIXTURE_PATH);
      expect(result.techStack).toContain('React');
    });

    it('should detect TypeScript from package.json', async () => {
      const result = await scanner.scan(FIXTURE_PATH);
      expect(result.techStack).toContain('TypeScript');
    });

    it('should detect Axios from package.json', async () => {
      const result = await scanner.scan(FIXTURE_PATH);
      expect(result.techStack).toContain('Axios');
    });

    it('should detect React Router from package.json', async () => {
      const result = await scanner.scan(FIXTURE_PATH);
      expect(result.techStack).toContain('React Router');
    });

    it('should detect Jest from package.json', async () => {
      const result = await scanner.scan(FIXTURE_PATH);
      expect(result.techStack).toContain('Jest');
    });
  });
});
