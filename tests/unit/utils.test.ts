/**
 * @module tests/unit/utils
 * @description 유틸리티 모듈 단위 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ensureDir,
  fileExists,
  readJsonFile,
  writeJsonFile,
  calculateFileHash,
  getImpactDir,
  getProjectDir,
  toKebabCase,
  formatFileSize,
} from '../../src/utils/file';
import { Logger } from '../../src/utils/logger';
import { LogLevel } from '../../src/types/common';

describe('File Utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-util-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ensureDir()', () => {
    it('should create a directory if it does not exist', () => {
      const dirPath = path.join(tempDir, 'new', 'nested', 'dir');
      ensureDir(dirPath);
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      ensureDir(tempDir);
      expect(fs.existsSync(tempDir)).toBe(true);
    });
  });

  describe('fileExists()', () => {
    it('should return true for existing file', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'test');
      expect(fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existing file', () => {
      expect(fileExists(path.join(tempDir, 'nonexistent.txt'))).toBe(false);
    });
  });

  describe('readJsonFile()', () => {
    it('should read and parse a JSON file', () => {
      const filePath = path.join(tempDir, 'test.json');
      const data = { name: 'test', value: 42 };
      fs.writeFileSync(filePath, JSON.stringify(data));
      const result = readJsonFile<{ name: string; value: number }>(filePath);
      expect(result).toEqual(data);
    });

    it('should return null for non-existing file', () => {
      const result = readJsonFile(path.join(tempDir, 'nonexistent.json'));
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, 'not valid json');
      const result = readJsonFile(filePath);
      expect(result).toBeNull();
    });
  });

  describe('writeJsonFile()', () => {
    it('should write data as JSON file', () => {
      const filePath = path.join(tempDir, 'output.json');
      const data = { key: 'value', num: 123 };
      writeJsonFile(filePath, data);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should create parent directories if they do not exist', () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'output.json');
      writeJsonFile(filePath, { test: true });
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should write with 2-space indentation', () => {
      const filePath = path.join(tempDir, 'formatted.json');
      writeJsonFile(filePath, { a: 1 });
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('  "a"');
    });
  });

  describe('calculateFileHash()', () => {
    it('should calculate SHA-256 hash of a file', () => {
      const filePath = path.join(tempDir, 'hashtest.txt');
      fs.writeFileSync(filePath, 'hello world');
      const hash = calculateFileHash(filePath);
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should return different hashes for different content', () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      fs.writeFileSync(file1, 'content1');
      fs.writeFileSync(file2, 'content2');
      const hash1 = calculateFileHash(file1);
      const hash2 = calculateFileHash(file2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('toKebabCase()', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('myProjectName')).toBe('my-project-name');
    });

    it('should convert spaces to hyphens', () => {
      expect(toKebabCase('my project name')).toBe('my-project-name');
    });

    it('should convert underscores to hyphens', () => {
      expect(toKebabCase('my_project_name')).toBe('my-project-name');
    });

    it('should handle PascalCase', () => {
      expect(toKebabCase('MyProjectName')).toBe('my-project-name');
    });

    it('should handle already kebab-case', () => {
      expect(toKebabCase('already-kebab')).toBe('already-kebab');
    });
  });

  describe('formatFileSize()', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format with decimal', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('getImpactDir()', () => {
    it('should return .impact directory under the given base path', () => {
      const result = getImpactDir('/home/user');
      expect(result).toBe(path.join('/home/user', '.impact'));
    });

    it('should use HOME environment variable when no basePath is provided', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/mock/home';
      const result = getImpactDir();
      expect(result).toBe(path.join('/mock/home', '.impact'));
      process.env.HOME = originalHome;
    });

    it('should fallback to USERPROFILE when HOME is not set', () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;
      delete process.env.HOME;
      process.env.USERPROFILE = '/mock/userprofile';
      const result = getImpactDir();
      expect(result).toBe(path.join('/mock/userprofile', '.impact'));
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
    });

    it('should fallback to "." when neither HOME nor USERPROFILE is set', () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      const result = getImpactDir();
      expect(result).toBe(path.join('.', '.impact'));
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
    });
  });

  describe('getProjectDir()', () => {
    it('should return project directory under .impact/projects/', () => {
      const result = getProjectDir('my-project', '/home/user');
      expect(result).toBe(path.join('/home/user', '.impact', 'projects', 'my-project'));
    });

    it('should use default base path when basePath is not provided', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/mock/home';
      const result = getProjectDir('test-project');
      expect(result).toBe(path.join('/mock/home', '.impact', 'projects', 'test-project'));
      process.env.HOME = originalHome;
    });

    it('should handle kebab-case project IDs', () => {
      const result = getProjectDir('my-awesome-project', '/base');
      expect(result).toBe(path.join('/base', '.impact', 'projects', 'my-awesome-project'));
    });
  });
});

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;
  let logger: Logger;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    logger = new Logger(LogLevel.DEBUG);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log debug messages when level is DEBUG', () => {
    logger.debug('test debug');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should not log debug messages when level is INFO', () => {
    logger.setLevel(LogLevel.INFO);
    logger.debug('test debug');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log info messages when level is INFO', () => {
    logger.setLevel(LogLevel.INFO);
    logger.info('test info');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    logger.warn('test warn');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    logger.error('test error');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log fatal messages', () => {
    logger.fatal('test fatal');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log success messages', () => {
    logger.success('operation completed');
    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0][0] as string;
    expect(call).toContain('[OK]');
  });

  it('should get and set log level', () => {
    logger.setLevel(LogLevel.WARN);
    expect(logger.getLevel()).toBe(LogLevel.WARN);
  });

  it('should output header with separators', () => {
    logger.header('Test Header');
    expect(consoleSpy).toHaveBeenCalledTimes(3); // separator + title + separator
  });

  it('should output separator as a line of dashes', () => {
    logger.separator();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const call = consoleSpy.mock.calls[0][0] as string;
    expect(call).toContain('─');
  });

  it('should log messages with additional arguments', () => {
    logger.info('message with data', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should filter logs by level priority (ERROR level ignores INFO)', () => {
    logger.setLevel(LogLevel.ERROR);
    logger.info('this should not appear');
    logger.warn('this should not appear either');
    expect(consoleSpy).not.toHaveBeenCalled();
    logger.error('this should appear');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
