/**
 * @module utils/file
 * @description 파일 시스템 유틸리티 - 파일/디렉토리 관련 헬퍼 함수
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 디렉토리가 존재하는지 확인하고, 없으면 생성
 * @param dirPath - 디렉토리 경로
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 파일이 존재하는지 확인
 * @param filePath - 파일 경로
 * @returns 존재 여부
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * JSON 파일을 읽고 파싱
 * @param filePath - JSON 파일 경로
 * @returns 파싱된 객체, 파일이 없으면 null
 */
export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 객체를 JSON 파일로 저장 (atomic write: write-rename 패턴)
 *
 * 임시 파일에 먼저 쓰고 rename하여 크래시 시 파일 손실을 방지합니다.
 * rename은 같은 파일시스템 내에서 원자적(atomic)으로 동작합니다.
 *
 * @param filePath - 저장할 파일 경로
 * @param data - 저장할 데이터
 */
export function writeJsonFile<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * 파일 잠금을 통한 동시 접근 보호 (async 버전)
 *
 * CLI와 Web Server가 별도 프로세스에서 동일 JSON 파일을 read-modify-write할 때
 * 데이터 유실을 방지합니다. 'wx' 플래그로 원자적 lock 파일을 생성하고,
 * 작업 완료 후 lock을 해제합니다.
 *
 * @param filePath - 잠금 대상 파일 경로
 * @param fn - 잠금 내에서 실행할 콜백 함수
 * @param options - 잠금 옵션 (maxRetries, retryDelay)
 * @returns 콜백 함수의 반환값
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
  options?: { maxRetries?: number; retryDelay?: number },
): Promise<T> {
  const lockPath = filePath + '.lock';
  const maxRetries = options?.maxRetries ?? 10;
  const retryDelay = options?.retryDelay ?? 100;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // 원자적 lock 파일 생성 (이미 있으면 EEXIST 에러)
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      try {
        const result = await fn();
        return result;
      } finally {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // lock 파일 삭제 실패는 무시 (이미 삭제된 경우 등)
        }
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        // lock이 이미 있으면 대기 후 재시도
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }
      throw err;
    }
  }

  // maxRetries 초과 시 stale lock으로 간주하여 제거 후 진행
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // stale lock 제거 실패는 무시
  }
  return fn();
}

/**
 * 파일 잠금을 통한 동시 접근 보호 (sync 버전)
 *
 * 동기 코드에서 사용할 수 있는 파일 잠금입니다.
 * 재시도 시 busy-wait를 사용하므로 짧은 작업에만 사용하세요.
 *
 * @param filePath - 잠금 대상 파일 경로
 * @param fn - 잠금 내에서 실행할 콜백 함수
 * @param options - 잠금 옵션 (maxRetries, retryDelay)
 * @returns 콜백 함수의 반환값
 */
export function withFileLockSync<T>(
  filePath: string,
  fn: () => T,
  options?: { maxRetries?: number; retryDelay?: number },
): T {
  const lockPath = filePath + '.lock';
  const maxRetries = options?.maxRetries ?? 10;
  const retryDelay = options?.retryDelay ?? 100;

  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      try {
        const result = fn();
        return result;
      } finally {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // lock 파일 삭제 실패는 무시
        }
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        // busy-wait: 동기적으로 대기
        const start = Date.now();
        while (Date.now() - start < retryDelay) {
          // spin
        }
        continue;
      }
      throw err;
    }
  }

  // maxRetries 초과 시 stale lock으로 간주하여 제거 후 진행
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // stale lock 제거 실패는 무시
  }
  return fn();
}

/**
 * 파일의 SHA-256 해시를 계산
 * @param filePath - 파일 경로
 * @returns SHA-256 해시 문자열
 */
export function calculateFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * .impact 디렉토리의 기본 경로를 반환
 * @param basePath - 기본 경로 (기본값: HOME 디렉토리)
 * @returns .impact 디렉토리 절대 경로
 */
export function getImpactDir(basePath?: string): string {
  const base = basePath || process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(base, '.impact');
}

/**
 * 프로젝트별 디렉토리 경로를 반환
 * @param projectId - 프로젝트 ID
 * @param basePath - 기본 경로
 * @returns 프로젝트 디렉토리 경로
 */
export function getProjectDir(projectId: string, basePath?: string): string {
  return path.join(getImpactDir(basePath), 'projects', projectId);
}

/**
 * 문자열을 kebab-case로 변환
 * @param str - 변환할 문자열
 * @returns kebab-case 문자열
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * 파일 크기를 사람이 읽을 수 있는 형태로 변환
 * @param bytes - 바이트 크기
 * @returns 포맷팅된 크기 문자열
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
