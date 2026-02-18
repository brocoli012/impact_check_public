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
import { Indexer } from '../core/indexing/indexer';
import { AnnotationLoader } from '../core/annotations/annotation-loader';
import { CrossProjectManager } from '../core/cross-project/cross-project-manager';
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
  // 정책 (Policy) API 엔드포인트
  // ============================================================

  const indexer = new Indexer();
  // AnnotationManager expects basePath to be the .impact directory itself
  const impactBase = basePath || process.env.HOME || process.env.USERPROFILE || '.';
  const annotationLoader = new AnnotationLoader(path.join(impactBase, '.impact'));

  /**
   * GET /api/policies - 정책 목록 조회
   * 쿼리 파라미터: ?category=배송 (카테고리 필터), ?search=무료 (검색)
   */
  app.get('/api/policies', async (req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const index = await indexer.loadIndex(projectId, basePath);

      if (!index) {
        res.status(404).json({ error: 'No index found. Run indexing first.' });
        return;
      }

      // 분석 결과에서 tasks 로드하여 relatedTaskIds 역매핑에 사용
      const latestResult = await resultManager.getLatest(projectId);
      const tasks = latestResult?.tasks || [];

      let policies = index.policies || [];

      // 카테고리 필터
      const category = req.query.category as string | undefined;
      if (category) {
        policies = policies.filter(p => p.category === category);
      }

      // 검색 필터
      const search = req.query.search as string | undefined;
      if (search) {
        const lowerSearch = search.toLowerCase();
        policies = policies.filter(p =>
          p.name.toLowerCase().includes(lowerSearch) ||
          p.description.toLowerCase().includes(lowerSearch),
        );
      }

      // 카테고리 목록 추출 (필터 전 전체 인덱스에서)
      const allPolicies = index.policies || [];
      const categories = [...new Set(allPolicies.map(p => p.category))].sort();

      /**
       * 정책별 relatedTaskIds 역매핑 계산
       * 전략: task의 affectedFiles/relatedApis와 policy의 filePath/relatedComponents/relatedApis를 매칭
       */
      function computeRelatedTaskIds(policy: typeof policies[number]): string[] {
        if (tasks.length === 0) return [];
        const taskIds: string[] = [];
        for (const task of tasks) {
          let matched = false;
          // 1) affectedFiles와 policy.filePath 매칭
          if (policy.filePath && task.affectedFiles) {
            if (task.affectedFiles.some((f: string) =>
              f === policy.filePath || policy.filePath.includes(f) || f.includes(policy.filePath),
            )) {
              matched = true;
            }
          }
          // 2) relatedApis 매칭
          if (!matched && policy.relatedApis && task.relatedApis) {
            if (policy.relatedApis.some((api: string) => task.relatedApis.includes(api))) {
              matched = true;
            }
          }
          // 3) policy.relatedComponents와 task.affectedFiles 매칭
          if (!matched && policy.relatedComponents) {
            for (const comp of policy.relatedComponents) {
              if (task.affectedFiles?.some((f: string) => f.includes(comp))) {
                matched = true;
                break;
              }
            }
          }
          // 4) 정책 이름 키워드와 task 제목/description 키워드 매칭
          if (!matched) {
            const policyKeywords = policy.name.toLowerCase().split(/[\s,/]+/).filter((w: string) => w.length > 1);
            const taskText = `${task.title} ${task.description}`.toLowerCase();
            const matchedKeywords = policyKeywords.filter((kw: string) => taskText.includes(kw));
            if (matchedKeywords.length >= 2 || (matchedKeywords.length >= 1 && policyKeywords.length <= 2)) {
              matched = true;
            }
          }
          if (matched) taskIds.push(task.id);
        }
        return taskIds;
      }

      res.json({
        policies: policies.map((p, idx) => ({
          id: p.id || `policy_${idx}`,
          name: p.name,
          category: p.category,
          description: p.description,
          file: p.filePath,
          confidence: 0,
          affectedFiles: [p.filePath, ...((p as any).relatedComponents || [])].filter(Boolean),
          relatedTaskIds: (p as any).relatedTaskIds?.length > 0
            ? (p as any).relatedTaskIds
            : computeRelatedTaskIds(p),
          source: (p as any).source || 'comment',
        })),
        total: policies.length,
        categories,
      });
    } catch (error) {
      logger.error('Failed to get policies:', error);
      res.status(500).json({ error: 'Failed to get policies' });
    }
  });

  /**
   * GET /api/policies/:id - 특정 정책 상세 정보 반환
   * 보강 주석 데이터 포함
   */
  app.get('/api/policies/:id', async (req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const index = await indexer.loadIndex(projectId, basePath);

      if (!index) {
        res.status(404).json({ error: 'No index found. Run indexing first.' });
        return;
      }

      const policyId = getParam(req.params, 'id');
      const policies = index.policies || [];

      // ID 또는 배열 인덱스로 검색
      let policy = policies.find(p => p.id === policyId);

      if (!policy) {
        // policy_N 형식이면 인덱스로 찾기
        const indexMatch = policyId.match(/^policy_(\d+)$/);
        if (indexMatch) {
          const idx = parseInt(indexMatch[1], 10);
          if (idx >= 0 && idx < policies.length) {
            policy = policies[idx];
          }
        }
      }

      if (!policy) {
        res.status(404).json({ error: 'Policy not found' });
        return;
      }

      // 보강 주석 로드 시도
      let annotation = null;
      try {
        annotation = await annotationLoader.loadForFile(projectId, policy.filePath);
      } catch {
        // 보강 주석 로드 실패는 무시
      }

      // filePath로 annotation 없으면 relatedModules 기반 fallback 시도
      if (!annotation && policy.relatedModules && policy.relatedModules.length > 0) {
        const servicesPaths = [
          `src/services/${policy.relatedModules[0]}.ts`,
          `src/api/${policy.relatedModules[0]}.ts`,
        ];
        for (const fallbackPath of servicesPaths) {
          if (annotation) break;
          try {
            annotation = await annotationLoader.loadForFile(projectId, fallbackPath);
          } catch {
            // 무시
          }
        }
      }

      // 기본 affectedFiles 구성
      const baseAffectedFiles: string[] = [
        policy.filePath,
        ...((policy.relatedComponents || []) as string[]).map((c: string) => `src/components/${c}.tsx`),
        ...((policy.relatedApis || []) as string[]).map((a: string) => `src/api${a}.ts`),
      ].filter(Boolean) as string[];

      // annotation에서 impactScope 기반 파일 경로 수집
      const impactFiles: string[] = [];
      if (annotation) {
        for (const ann of annotation.annotations) {
          for (const pol of ann.policies) {
            const scope = pol.impactScope;
            if (scope) {
              for (const caller of scope.callers || []) {
                if (caller.filePath) impactFiles.push(caller.filePath);
              }
              for (const callee of scope.callees || []) {
                if (callee.filePath) impactFiles.push(callee.filePath);
              }
            }
          }
        }
      }

      // 중복 제거한 affectedFiles
      const affectedFiles = [...new Set([...baseAffectedFiles, ...impactFiles])].filter(Boolean);

      const result: Record<string, unknown> = {
        policy: {
          id: policy.id,
          name: policy.name,
          category: policy.category,
          description: policy.description,
          source: policy.source,
          sourceText: policy.sourceText,
          filePath: policy.filePath,
          lineNumber: policy.lineNumber,
          relatedComponents: policy.relatedComponents,
          relatedApis: policy.relatedApis,
          relatedModules: policy.relatedModules,
          extractedAt: policy.extractedAt,
          affectedFiles,
        },
      };

      if (annotation) {
        result.annotation = {
          file: annotation.file,
          system: annotation.system,
          lastAnalyzed: annotation.lastAnalyzed,
          fileSummary: annotation.fileSummary,
          annotations: annotation.annotations.map(a => ({
            function: a.function,
            signature: a.signature,
            enriched_comment: a.enriched_comment,
            confidence: a.confidence,
            type: a.type,
            policies: a.policies,
            relatedFunctions: a.relatedFunctions,
            relatedApis: a.relatedApis,
          })),
        };
      }

      res.json(result);
    } catch (error) {
      logger.error(`Failed to get policy ${getParam(req.params, 'id')}:`, error);
      res.status(500).json({ error: 'Failed to get policy' });
    }
  });

  /**
   * GET /api/analysis/policy-changes - 분석 결과의 policyChanges 목록 반환
   */
  app.get('/api/analysis/policy-changes', async (_req: Request, res: Response) => {
    try {
      const projectId = await getProjectId();

      if (!projectId) {
        res.json({ policyChanges: [], message: 'No active project' });
        return;
      }

      const latestResult = await resultManager.getLatest(projectId);

      if (!latestResult) {
        res.json({ policyChanges: [], message: 'No analysis results found' });
        return;
      }

      res.json({
        policyChanges: latestResult.policyChanges || [],
        analysisId: latestResult.analysisId,
        analyzedAt: latestResult.analyzedAt,
      });
    } catch (error) {
      logger.error('Failed to get policy changes:', error);
      res.status(500).json({ error: 'Failed to get policy changes' });
    }
  });

  // ============================================================
  // 크로스 프로젝트 (Cross Project) API 엔드포인트
  // ============================================================

  const crossProjectManager = new CrossProjectManager(
    path.join(basePath || process.env.HOME || process.env.USERPROFILE || '.', '.impact'),
  );

  /**
   * GET /api/cross-project/links - 전체 프로젝트 의존성 목록 조회
   */
  app.get('/api/cross-project/links', async (_req: Request, res: Response) => {
    try {
      const links = await crossProjectManager.getLinks();
      res.json({ links, total: links.length });
    } catch (error) {
      logger.error('Failed to get cross-project links:', error);
      res.status(500).json({ error: 'Failed to get cross-project links' });
    }
  });

  /**
   * GET /api/cross-project/links/:projectId - 특정 프로젝트의 의존성 조회
   */
  app.get('/api/cross-project/links/:projectId', async (req: Request, res: Response) => {
    try {
      const projectId = getParam(req.params, 'projectId');
      if (!isValidId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }
      const links = await crossProjectManager.getLinks(projectId);
      res.json({ links, total: links.length });
    } catch (error) {
      logger.error(`Failed to get links for project ${getParam(req.params, 'projectId')}:`, error);
      res.status(500).json({ error: 'Failed to get cross-project links' });
    }
  });

  /**
   * GET /api/cross-project/groups - 프로젝트 그룹 목록 조회
   */
  app.get('/api/cross-project/groups', async (_req: Request, res: Response) => {
    try {
      const groups = await crossProjectManager.getGroups();
      res.json({ groups, total: groups.length });
    } catch (error) {
      logger.error('Failed to get cross-project groups:', error);
      res.status(500).json({ error: 'Failed to get cross-project groups' });
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
