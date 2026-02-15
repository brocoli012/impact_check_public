/**
 * @module server/web-server
 * @description Express.js 웹 서버 - React SPA 정적 파일 서빙 및 API 엔드포인트
 */

import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as http from 'http';
import { ResultManager } from '../core/analysis/result-manager';
import { ConfigManager } from '../config/config-manager';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, ensureDir } from '../utils/file';

/** Express 라우트 파라미터에서 안전하게 문자열을 추출 */
function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

/** ID 파라미터 안전성 검증 (영숫자, 하이픈, 언더스코어만 허용) */
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/** 체크리스트 항목 상태 */
interface ChecklistItem {
  /** 항목 ID */
  itemId: string;
  /** 체크 여부 */
  checked: boolean;
  /** 마지막 업데이트 시각 */
  updatedAt: string;
}

/** 체크리스트 데이터 */
interface ChecklistData {
  /** 결과 ID */
  resultId: string;
  /** 항목 목록 */
  items: ChecklistItem[];
}

/** 서버 인스턴스 관리를 위한 변수 */
let serverInstance: http.Server | null = null;

/** 캐시된 활성 프로젝트 경로 (서버 시작 시 1회 로드) */
let cachedProjectPath: string | null = null;

/**
 * 포트가 사용 가능한지 확인
 * @param port - 확인할 포트 번호
 * @returns 사용 가능 여부
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 사용 가능한 포트를 찾기
 * @param startPort - 시작 포트 (기본: 3847)
 * @param maxAttempts - 최대 시도 횟수 (기본: 10)
 * @returns 사용 가능한 포트 번호
 */
async function findAvailablePort(startPort: number = 3847, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found (tried ${startPort}-${startPort + maxAttempts - 1})`);
}

/**
 * 체크리스트 파일 경로를 반환
 */
function getChecklistPath(basePath: string | undefined, projectId: string, resultId: string): string {
  const impactBase = basePath || process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(impactBase, '.impact', 'projects', projectId, 'checklists', `${resultId}.json`);
}

/**
 * Express 앱을 생성하고 설정
 * @param basePath - 데이터 저장 기본 경로
 * @returns Express Application
 */
export function createApp(basePath?: string): express.Application {
  const app = express();
  const resultManager = new ResultManager(basePath);
  const configManager = new ConfigManager(basePath);

  /** 캐시된 프로젝트 ID를 반환하거나, 미로드 시 1회 로드 후 캐시 */
  async function getProjectId(): Promise<string | null> {
    if (cachedProjectPath !== null) return cachedProjectPath || null;
    await configManager.load();
    cachedProjectPath = configManager.getActiveProject() || '';
    return cachedProjectPath || null;
  }

  app.use(express.json());

  // ============================================================
  // API 엔드포인트
  // ============================================================

  /**
   * GET /api/results - 분석 결과 목록 조회
   */
  app.get('/api/results', async (_req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.json({ results: [], message: 'No active project' });
        return;
      }

      const results = await resultManager.list(projectId);
      res.json({ results });
    } catch (error) {
      logger.error('Failed to list results:', error);
      res.status(500).json({ error: 'Failed to list results' });
    }
  });

  /**
   * GET /api/results/latest - 최신 분석 결과 조회
   */
  app.get('/api/results/latest', async (_req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.json({ result: null, message: 'No active project' });
        return;
      }

      const result = await resultManager.getLatest(projectId);

      if (!result) {
        res.json({ result: null, message: 'No analysis results found' });
        return;
      }

      res.json({ result });
    } catch (error) {
      logger.error('Failed to get latest result:', error);
      res.status(500).json({ error: 'Failed to get latest result' });
    }
  });

  /**
   * GET /api/results/:id - 특정 분석 결과 조회
   */
  app.get('/api/results/:id', async (req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const resultId = getParam(req.params, 'id');
      if (!isValidId(resultId)) {
        res.status(400).json({ error: 'Invalid result ID' });
        return;
      }
      const result = await resultManager.getById(projectId, resultId);

      if (!result) {
        res.status(404).json({ error: 'Result not found' });
        return;
      }

      res.json({ result });
    } catch (error) {
      logger.error(`Failed to get result ${getParam(req.params, 'id')}:`, error);
      res.status(500).json({ error: 'Failed to get result' });
    }
  });

  /**
   * GET /api/checklist/:resultId - 체크리스트 상태 조회
   */
  app.get('/api/checklist/:resultId', async (req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const resultIdParam = getParam(req.params, 'resultId');
      if (!isValidId(resultIdParam)) {
        res.status(400).json({ error: 'Invalid result ID' });
        return;
      }
      const checklistPath = getChecklistPath(basePath, projectId, resultIdParam);
      const checklist = readJsonFile<ChecklistData>(checklistPath);

      res.json({ checklist: checklist || { resultId: resultIdParam, items: [] } });
    } catch (error) {
      logger.error(`Failed to get checklist for ${getParam(req.params, 'resultId')}:`, error);
      res.status(500).json({ error: 'Failed to get checklist' });
    }
  });

  /**
   * PATCH /api/checklist/:resultId/:itemId - 체크리스트 항목 상태 업데이트
   */
  app.patch('/api/checklist/:resultId/:itemId', async (req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const resultId = getParam(req.params, 'resultId');
      const itemId = getParam(req.params, 'itemId');

      if (!isValidId(resultId) || !isValidId(itemId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

      const { checked } = req.body as { checked: boolean };

      if (typeof checked !== 'boolean') {
        res.status(400).json({ error: 'checked field must be a boolean' });
        return;
      }

      const checklistPath = getChecklistPath(basePath, projectId, resultId);
      const existing = readJsonFile<ChecklistData>(checklistPath);
      const checklist: ChecklistData = existing || { resultId, items: [] };

      const existingIndex = checklist.items.findIndex(item => item.itemId === itemId);
      const updatedItem: ChecklistItem = {
        itemId,
        checked,
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        checklist.items[existingIndex] = updatedItem;
      } else {
        checklist.items.push(updatedItem);
      }

      ensureDir(path.dirname(checklistPath));
      writeJsonFile(checklistPath, checklist);

      res.json({ item: updatedItem });
    } catch (error) {
      logger.error(`Failed to update checklist item:`, error);
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  });

  // ============================================================
  // API 404 핸들러 (SPA 폴백보다 먼저 등록해야 API 요청이 index.html로 빠지지 않음)
  // ============================================================

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // ============================================================
  // 정적 파일 서빙 + SPA 폴백
  // ============================================================

  const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');

  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));

    // SPA 폴백: API가 아닌 모든 요청에 index.html 반환
    // Express v5 requires named wildcard params
    app.get('{*splat}', (_req: Request, res: Response) => {
      const indexPath = path.join(webDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Web UI not built. Run: cd web && npm run build' });
      }
    });
  } else {
    app.get('{*splat}', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.status(404).json({
          error: 'Web UI not built',
          message: 'Run: cd web && npm run build',
        });
      }
    });
  }

  return app;
}

/**
 * 웹 서버를 시작
 * @param basePath - 데이터 저장 기본 경로
 * @param preferredPort - 선호 포트 (기본: 3847)
 * @returns 실제 사용된 포트 번호
 */
export async function startServer(basePath?: string, preferredPort: number = 3847): Promise<number> {
  if (serverInstance) {
    logger.warn('Web server is already running.');
    const addr = serverInstance.address();
    if (addr && typeof addr !== 'string') {
      return addr.port;
    }
    return preferredPort;
  }

  const port = await findAvailablePort(preferredPort);

  // 서버 시작 전 config를 1회 로드하여 캐시
  const configManager = new ConfigManager(basePath);
  await configManager.load();
  cachedProjectPath = configManager.getActiveProject() || '';

  const app = createApp(basePath);

  return new Promise((resolve, reject) => {
    serverInstance = app.listen(port, '127.0.0.1', () => {
      logger.info(`Web server started at http://localhost:${port}`);
      resolve(port);
    });

    serverInstance.on('error', (err) => {
      logger.error('Failed to start web server:', err);
      serverInstance = null;
      reject(err);
    });
  });
}

/**
 * 웹 서버를 중지
 */
export async function stopServer(): Promise<void> {
  if (!serverInstance) {
    logger.warn('No web server is running.');
    return;
  }

  return new Promise((resolve, reject) => {
    serverInstance!.close((err) => {
      if (err) {
        logger.error('Failed to stop web server:', err);
        reject(err);
      } else {
        logger.info('Web server stopped.');
        serverInstance = null;
        resolve();
      }
    });
  });
}

/**
 * 서버 실행 상태 확인
 */
export function isServerRunning(): boolean {
  return serverInstance !== null;
}
