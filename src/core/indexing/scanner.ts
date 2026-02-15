/**
 * @module core/indexing/scanner
 * @description 파일 스캐너 - 프로젝트 디렉토리를 스캔하여 파일 목록 생성
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fg from 'fast-glob';
import ignore, { Ignore } from 'ignore';
import { FileInfo } from '../../types/index';
import { ScanResult } from './types';
import { logger } from '../../utils/logger';

/** 지원하는 파일 확장자 */
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.java', '.kt', '.py'];

/** 기본 무시 패턴 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.next/**',
  '.nuxt/**',
  '__pycache__/**',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.d.ts',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/** 확장자별 언어 매핑 */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (JSX)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (JSX)',
  '.vue': 'Vue',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.py': 'Python',
};

/**
 * FileScanner - 프로젝트 디렉토리를 스캔하여 파일 목록 생성
 *
 * 기능:
 *   - fast-glob을 사용한 파일 탐색
 *   - .gitignore 패턴 적용
 *   - 기술 스택 자동 감지
 *   - 파일별 SHA-256 해시 생성
 */
export class FileScanner {
  /**
   * 프로젝트 디렉토리를 스캔하여 파일 목록 생성
   * @param projectPath - 프로젝트 루트 경로
   * @returns 스캔 결과
   */
  async scan(projectPath: string): Promise<ScanResult> {
    const resolvedPath = path.resolve(projectPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Project path does not exist: ${resolvedPath}`);
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${resolvedPath}`);
    }

    logger.info(`Scanning project: ${resolvedPath}`);

    // .gitignore 패턴 로드
    const ig = this.loadIgnorePatterns(resolvedPath);

    // 지원하는 확장자의 glob 패턴 생성
    const extensionPatterns = SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);

    // fast-glob으로 파일 탐색
    const filePaths = await fg(extensionPatterns, {
      cwd: resolvedPath,
      absolute: false,
      dot: false,
      onlyFiles: true,
      ignore: DEFAULT_IGNORE_PATTERNS,
    });

    // .gitignore 필터 적용
    const filteredPaths = filePaths.filter(fp => !ig.ignores(fp));

    // 파일 정보 수집
    const files: FileInfo[] = [];
    let totalLines = 0;
    const languages: Record<string, number> = {};

    for (const relativePath of filteredPaths) {
      const absolutePath = path.join(resolvedPath, relativePath);
      try {
        const stat = fs.statSync(absolutePath);
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const lineCount = content.split('\n').length;
        totalLines += lineCount;

        const ext = path.extname(relativePath);
        const lang = EXTENSION_LANGUAGE_MAP[ext] || ext;
        languages[lang] = (languages[lang] || 0) + 1;

        const hash = await this.computeFileHash(absolutePath);

        files.push({
          path: relativePath,
          hash,
          size: stat.size,
          extension: ext,
          lastModified: stat.mtime.toISOString(),
        });
      } catch (err) {
        logger.warn(`Failed to process file: ${relativePath}`, err);
      }
    }

    // 기술 스택 감지
    const techStack = await this.detectTechStack(resolvedPath);

    logger.info(`Scan complete: ${files.length} files, ${totalLines} lines`);

    return {
      files,
      techStack,
      stats: {
        totalFiles: files.length,
        totalLines,
        languages,
      },
    };
  }

  /**
   * .gitignore 패턴 로드 및 적용
   * @param projectPath - 프로젝트 루트 경로
   * @returns ignore 인스턴스
   */
  private loadIgnorePatterns(projectPath: string): Ignore {
    const ig = ignore();
    const gitignorePath = path.join(projectPath, '.gitignore');

    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        const patterns = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        ig.add(patterns);
        logger.debug(`Loaded ${patterns.length} .gitignore patterns`);
      } catch (err) {
        logger.warn('Failed to read .gitignore', err);
      }
    }

    return ig;
  }

  /**
   * 기술 스택 자동 감지
   * @param projectPath - 프로젝트 루트 경로
   * @returns 감지된 기술 스택 목록
   */
  private async detectTechStack(projectPath: string): Promise<string[]> {
    const techStack: string[] = [];

    // package.json 분석
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        // 프레임워크/라이브러리 감지
        if (allDeps['react']) techStack.push('React');
        if (allDeps['react-dom']) techStack.push('React DOM');
        if (allDeps['next']) techStack.push('Next.js');
        if (allDeps['vue']) techStack.push('Vue.js');
        if (allDeps['nuxt']) techStack.push('Nuxt.js');
        if (allDeps['@angular/core']) techStack.push('Angular');
        if (allDeps['express']) techStack.push('Express');
        if (allDeps['fastify']) techStack.push('Fastify');
        if (allDeps['nestjs'] || allDeps['@nestjs/core']) techStack.push('NestJS');
        if (allDeps['typescript']) techStack.push('TypeScript');
        if (allDeps['tailwindcss']) techStack.push('Tailwind CSS');
        if (allDeps['axios']) techStack.push('Axios');
        if (allDeps['react-router'] || allDeps['react-router-dom']) techStack.push('React Router');
        if (allDeps['redux'] || allDeps['@reduxjs/toolkit']) techStack.push('Redux');
        if (allDeps['zustand']) techStack.push('Zustand');
        if (allDeps['prisma'] || allDeps['@prisma/client']) techStack.push('Prisma');
        if (allDeps['typeorm']) techStack.push('TypeORM');
        if (allDeps['jest']) techStack.push('Jest');
        if (allDeps['vitest']) techStack.push('Vitest');
      } catch (err) {
        logger.warn('Failed to parse package.json', err);
      }
    }

    // build.gradle 분석 (Java/Kotlin)
    const gradlePath = path.join(projectPath, 'build.gradle');
    const gradleKtsPath = path.join(projectPath, 'build.gradle.kts');
    if (fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath)) {
      techStack.push('Gradle');
      const gradleFile = fs.existsSync(gradleKtsPath) ? gradleKtsPath : gradlePath;
      try {
        const content = fs.readFileSync(gradleFile, 'utf-8');
        if (content.includes('spring-boot')) techStack.push('Spring Boot');
        if (content.includes('kotlin')) techStack.push('Kotlin');
      } catch {
        // ignore
      }
    }

    // pom.xml 분석 (Java)
    if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
      techStack.push('Maven');
    }

    // requirements.txt / pyproject.toml (Python)
    if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
      techStack.push('Python');
    }
    if (fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
      techStack.push('Python');
    }

    // tsconfig.json
    if (fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      if (!techStack.includes('TypeScript')) {
        techStack.push('TypeScript');
      }
    }

    return [...new Set(techStack)];
  }

  /**
   * 파일의 SHA-256 해시 생성
   * @param filePath - 파일 절대 경로
   * @returns SHA-256 해시 문자열
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }
}
