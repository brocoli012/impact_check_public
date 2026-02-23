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
import { AnnotationManager } from '../core/annotations/annotation-manager';
import { convertAnnotationsToPolicies, mergePolicies } from '../core/annotations/policy-converter';
import { CrossProjectManager } from '../core/cross-project/cross-project-manager';
import { SharedEntityIndexer } from '../core/cross-project/shared-entity-indexer';
import { GapDetector } from '../core/cross-project/gap-detector';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, ensureDir, getProjectDir } from '../utils/file';
import { AnalysisStatus, isAnalysisStatus, getEffectiveStatus } from '../utils/analysis-status';
import type { ProjectsConfig } from '../types';

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

/**
 * ProjectContext - 활성 프로젝트 관리 (cachedProjectPath 대체)
 * 인메모리 캐시 + invalidate() 메서드로 안전한 프로젝트 전환 지원
 */
class ProjectContext {
  private cachedId: string | null = null;
  private readonly configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * 활성 프로젝트 ID 반환
   * @param requestProjectId - 요청별 프로젝트 ID (쿼리 파라미터)
   * @returns 프로젝트 ID 또는 null
   */
  async getActiveProjectId(requestProjectId?: string): Promise<string | null> {
    // 쿼리 파라미터 우선: 유효한 requestProjectId가 있으면 즉시 반환
    if (requestProjectId && isValidId(requestProjectId)) {
      return requestProjectId;
    }
    // 캐시된 값이 없으면 configManager에서 로드
    if (this.cachedId === null) {
      await this.configManager.load();
      this.cachedId = this.configManager.getActiveProject() || '';
    }
    return this.cachedId || null;
  }

  /** 캐시 무효화 (설정 변경 시) */
  invalidate(): void {
    this.cachedId = null;
  }

  /**
   * 활성 프로젝트 전환
   * @param projectId - 전환할 프로젝트 ID
   */
  switchProject(projectId: string): void {
    this.configManager.setActiveProject(projectId);
    this.cachedId = projectId;
  }

  /** 현재 캐시된 프로젝트 ID (SSE 이벤트용) */
  getCachedId(): string | null {
    return this.cachedId || null;
  }

  /** 초기 로드 (서버 시작 시 1회) */
  async initialize(): Promise<void> {
    await this.configManager.load();
    this.cachedId = this.configManager.getActiveProject() || '';
  }
}

/** 전역 ProjectContext 인스턴스 */
let projectContext: ProjectContext | null = null;

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

  // ProjectContext 초기화 (전역 인스턴스가 없으면 생성)
  if (!projectContext) {
    projectContext = new ProjectContext(configManager);
  }
  const ctx = projectContext;

  /** SSE 클라이언트 목록 */
  const sseClients: Set<Response> = new Set();

  /** SSE 이벤트 브로드캐스트 */
  function broadcastSSE(event: string, data: Record<string, unknown>): void {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      client.write(msg);
    }
  }

  app.use(express.json());

  // ============================================================
  // API 엔드포인트
  // ============================================================

  /**
   * GET /api/results - 분석 결과 목록 조회
   * 쿼리 파라미터: ?status=active (상태 필터), ?projectId=<id>
   */
  app.get('/api/results', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.json({ results: [], message: 'No active project' });
        return;
      }

      let results = await resultManager.list(projectId);

      // status 필터 적용
      const statusFilter = req.query.status as string | undefined;
      if (statusFilter && statusFilter !== 'all') {
        results = results.filter(r => getEffectiveStatus(r.status) === statusFilter);
      }

      res.json({ results });
    } catch (error) {
      logger.error('Failed to list results:', error);
      res.status(500).json({ error: 'Failed to list results' });
    }
  });

  /**
   * GET /api/results/latest - 최신 분석 결과 조회
   */
  app.get('/api/results/latest', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

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
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

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
   * PATCH /api/results/:id/status - 분석 결과 상태 변경
   */
  app.patch('/api/results/:id/status', async (req: Request, res: Response) => {
    try {
      const resultId = getParam(req.params, 'id');
      if (!isValidId(resultId)) {
        res.status(400).json({ error: 'Invalid result ID' });
        return;
      }

      // [R3-API-05] req.body undefined 방어 (Content-Type 미설정 대비)
      if (!req.body || typeof req.body.status !== 'string') {
        res.status(400).json({ error: 'Request body must contain a valid "status" string field' });
        return;
      }

      const { status: newStatus } = req.body as { status: string };

      // [R4-05] isAnalysisStatus() 런타임 가드로 검증
      if (!isAnalysisStatus(newStatus)) {
        const validStatuses = ['active', 'completed', 'on-hold', 'archived'];
        res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
        return;
      }

      // findByAnalysisId로 프로젝트 ID 역매핑
      const found = await resultManager.findByAnalysisId(resultId);
      if (!found) {
        res.status(404).json({ error: 'Analysis result not found' });
        return;
      }

      try {
        const updated = await resultManager.updateStatus(
          found.projectId,
          resultId,
          newStatus as AnalysisStatus,
        );
        // [R3-API-03] 기존 API 패턴과 통일
        res.json({ result: updated });
      } catch (err) {
        // [R4-03] transition 에러 vs I/O 에러 구분
        const errMsg = err instanceof Error ? err.message : 'Invalid transition';
        const isTransitionError =
          errMsg.includes('전환') ||
          errMsg.includes('폐기') ||
          errMsg.includes('찾을 수 없습니다');
        res.status(isTransitionError ? 400 : 500).json({ error: errMsg });
      }
    } catch (error) {
      logger.error('Failed to update result status:', error);
      res.status(500).json({ error: 'Failed to update result status' });
    }
  });

  /**
   * GET /api/checklist/:resultId - 체크리스트 상태 조회
   */
  app.get('/api/checklist/:resultId', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

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
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

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
  // 프로젝트 현황 (Project Status) API 엔드포인트
  // ============================================================

  const indexer = new Indexer();
  // AnnotationManager expects basePath to be the .impact directory itself
  const impactBase = basePath || process.env.HOME || process.env.USERPROFILE || '.';
  const annotationLoader = new AnnotationLoader(path.join(impactBase, '.impact'));
  const annotationManager = new AnnotationManager(path.join(impactBase, '.impact'));

  /**
   * GET /api/project/status - 프로젝트 현황 조회
   * 인덱스/어노테이션/분석 결과 존재 여부 반환
   */
  app.get('/api/project/status', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.json({
          projectId: null,
          projectPath: null,
          hasIndex: false,
          hasAnnotations: false,
          hasResults: false,
        });
        return;
      }

      // 프로젝트 경로 읽기
      const projectsPath = path.join(impactBase, '.impact', 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
      const projectEntry = projectsConfig?.projects?.find(p => p.id === projectId);
      const projectPath = projectEntry?.path || null;

      // 인덱스 존재 여부
      const projectDir = getProjectDir(projectId, basePath);
      const indexMetaPath = path.join(projectDir, 'index', 'meta.json');
      const hasIndex = fs.existsSync(indexMetaPath);

      // 어노테이션 존재 여부
      const annotationMeta = await annotationManager.getMeta(projectId);
      const hasAnnotations = annotationMeta !== null && annotationMeta.totalAnnotations > 0;

      // 분석 결과 존재 여부
      const latestResult = await resultManager.getLatest(projectId);
      const hasResults = latestResult !== null;

      res.json({
        projectId,
        projectPath,
        hasIndex,
        hasAnnotations,
        hasResults,
      });
    } catch (error) {
      logger.error('Failed to get project status:', error);
      res.status(500).json({ error: 'Failed to get project status' });
    }
  });

  /**
   * GET /api/project/index-meta - 인덱스 메타 정보 조회
   */
  app.get('/api/project/index-meta', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.json({ meta: null, message: 'No active project' });
        return;
      }

      const projectDir = getProjectDir(projectId, basePath);
      const indexMetaPath = path.join(projectDir, 'index', 'meta.json');

      if (!fs.existsSync(indexMetaPath)) {
        res.json({ meta: null, message: 'No index found' });
        return;
      }

      const meta = readJsonFile<Record<string, unknown>>(indexMetaPath);
      res.json({ meta });
    } catch (error) {
      logger.error('Failed to get index meta:', error);
      res.status(500).json({ error: 'Failed to get index meta' });
    }
  });

  /**
   * GET /api/project/annotation-meta - 어노테이션 메타 정보 조회
   */
  app.get('/api/project/annotation-meta', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.json({ meta: null, message: 'No active project' });
        return;
      }

      const meta = await annotationManager.getMeta(projectId);

      if (!meta) {
        res.json({ meta: null, message: 'No annotations found' });
        return;
      }

      res.json({ meta });
    } catch (error) {
      logger.error('Failed to get annotation meta:', error);
      res.status(500).json({ error: 'Failed to get annotation meta' });
    }
  });

  // ============================================================
  // 정책 (Policy) API 엔드포인트
  // ============================================================

  /**
   * GET /api/policies - 정책 목록 조회
   * 쿼리 파라미터: ?category=배송 (카테고리 필터), ?search=무료 (검색)
   */
  app.get('/api/policies', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const index = await indexer.loadIndex(projectId, basePath);

      // 인덱스 없어도 어노테이션만으로 정책 조회 가능
      const indexPolicies = index?.policies || [];

      // 어노테이션에서 추론된 정책 로드 및 변환
      let annotationPolicies: typeof indexPolicies = [];
      try {
        const annotations = await annotationManager.loadAll(projectId);
        if (annotations.size > 0) {
          annotationPolicies = convertAnnotationsToPolicies(annotations);
        }
      } catch (err) {
        logger.warn('Failed to load annotation policies:', err);
      }

      // 인덱스 + 어노테이션 정책 병합 (중복 제거)
      const allMergedPolicies = mergePolicies(indexPolicies, annotationPolicies);

      if (allMergedPolicies.length === 0 && !index) {
        res.json({ policies: [], total: 0, offset: 0, limit: 0, hasMore: false, categories: [] });
        return;
      }

      // 분석 결과에서 tasks 로드하여 relatedTaskIds 역매핑에 사용
      const latestResult = await resultManager.getLatest(projectId);
      const tasks = latestResult?.tasks || [];

      let policies = allMergedPolicies;

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

      // 카테고리 목록 추출 (필터 전 전체 병합 목록에서)
      const categories = [...new Set(allMergedPolicies.map(p => p.category))].sort();

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

      // 페이지네이션 파라미터
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const limit = parseInt(req.query.limit as string, 10) || 0; // 0 = 전체
      const total = policies.length;

      // 전체 매핑 후 슬라이스 (offset/limit)
      const mappedAll = policies.map((p, idx) => ({
        id: p.id || `policy_${idx}`,
        name: p.name,
        category: p.category,
        description: p.description,
        file: p.filePath,
        confidence: (p as any).confidence ?? 0,
        affectedFiles: [p.filePath, ...((p as any).relatedComponents || [])].filter(Boolean),
        relatedTaskIds: (p as any).relatedTaskIds?.length > 0
          ? (p as any).relatedTaskIds
          : computeRelatedTaskIds(p),
        source: (p as any).source || 'comment',
      }));

      const paged = limit > 0 ? mappedAll.slice(offset, offset + limit) : mappedAll;

      res.json({
        policies: paged,
        total,
        offset,
        limit: limit || total,
        hasMore: limit > 0 ? (offset + limit) < total : false,
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
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

      if (!projectId) {
        res.status(404).json({ error: 'No active project' });
        return;
      }

      const index = await indexer.loadIndex(projectId, basePath);

      // 인덱스 + 어노테이션 병합 정책 (목록 API와 동일한 로직)
      const indexPolicies = index?.policies || [];
      let detailAnnotationPolicies: typeof indexPolicies = [];
      try {
        const annotations = await annotationManager.loadAll(projectId);
        if (annotations.size > 0) {
          detailAnnotationPolicies = convertAnnotationsToPolicies(annotations);
        }
      } catch (err) {
        logger.warn('Failed to load annotation policies for detail:', err);
      }
      const allPolicies = mergePolicies(indexPolicies, detailAnnotationPolicies);

      if (allPolicies.length === 0) {
        res.status(404).json({ error: 'No policies found. Run indexing first.' });
        return;
      }

      const policyId = getParam(req.params, 'id');

      // ID 또는 배열 인덱스로 검색 (병합된 전체 목록에서)
      let policy = allPolicies.find(p => p.id === policyId);

      if (!policy) {
        // policy_N 형식이면 인덱스로 찾기
        const indexMatch = policyId.match(/^policy_(\d+)$/);
        if (indexMatch) {
          const idx = parseInt(indexMatch[1], 10);
          if (idx >= 0 && idx < allPolicies.length) {
            policy = allPolicies[idx];
          }
        }
      }

      if (!policy) {
        // ann_policy_N 형식이면 인덱스로 찾기
        const annIndexMatch = policyId.match(/^ann_policy_(\d+)$/);
        if (annIndexMatch) {
          const idx = parseInt(annIndexMatch[1], 10);
          // ann_policy_N은 병합 목록에서 annotation 정책의 순서에 해당
          // 병합 목록 전체에서 해당 ID를 가진 정책을 재검색 (ID가 부여된 상태)
          // 또는 단순히 allPolicies 배열에서 idx로 찾기 (목록 API에서 부여한 인덱스)
          if (idx >= 0 && idx < allPolicies.length) {
            policy = allPolicies[idx];
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
  app.get('/api/analysis/policy-changes', async (req: Request, res: Response) => {
    try {
      const projectId = await ctx.getActiveProjectId(req.query.projectId as string);

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
  // 멀티 프로젝트 (Multi Project) API 엔드포인트
  // ============================================================

  /**
   * GET /api/projects - 프로젝트 목록 + 요약 통계
   */
  app.get('/api/projects', async (_req: Request, res: Response) => {
    try {
      const projectsPath = path.join(impactBase, '.impact', 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);

      if (!projectsConfig || !projectsConfig.projects) {
        res.json({ projects: [], activeProject: null, total: 0 });
        return;
      }

      const activeProject = projectsConfig.activeProject || null;

      // 각 프로젝트의 분석 결과 요약 수집
      const projects = await Promise.all(
        projectsConfig.projects.map(async (entry) => {
          const summaries = await resultManager.list(entry.id);
          const latestResult = summaries.length > 0
            ? await resultManager.getLatest(entry.id)
            : null;

          return {
            id: entry.id,
            name: entry.name,
            path: entry.path,
            status: entry.status,
            createdAt: entry.createdAt,
            lastUsedAt: entry.lastUsedAt,
            techStack: entry.techStack || [],
            resultCount: summaries.length,
            latestGrade: latestResult?.grade || null,
            latestScore: latestResult?.totalScore ?? null,
            latestAnalyzedAt: latestResult?.analyzedAt || null,
            taskCount: latestResult?.tasks?.length ?? 0,
            policyWarningCount: latestResult?.policyWarnings?.length ?? 0,
          };
        }),
      );

      res.json({
        projects,
        activeProject,
        total: projects.length,
      });
    } catch (error) {
      logger.error('Failed to get projects:', error);
      res.status(500).json({ error: 'Failed to get projects' });
    }
  });

  /**
   * POST /api/projects/switch - 활성 프로젝트 전환
   */
  app.post('/api/projects/switch', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body as { projectId: string };

      if (!projectId || !isValidId(projectId)) {
        res.status(400).json({ error: 'Invalid projectId' });
        return;
      }

      // 프로젝트 존재 확인
      const projectsPath = path.join(impactBase, '.impact', 'projects.json');
      const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
      const projectEntry = projectsConfig?.projects?.find(p => p.id === projectId);

      if (!projectEntry) {
        res.status(404).json({ error: `Project '${projectId}' not found` });
        return;
      }

      // ProjectContext를 통한 전환
      ctx.switchProject(projectId);

      // SSE 이벤트 브로드캐스트
      broadcastSSE('project-switched', {
        projectId,
        projectName: projectEntry.name,
        switchedAt: new Date().toISOString(),
      });

      res.json({
        activeProject: projectId,
        message: `Switched to ${projectEntry.name}`,
      });
    } catch (error) {
      logger.error('Failed to switch project:', error);
      res.status(500).json({ error: 'Failed to switch project' });
    }
  });

  /**
   * GET /api/events - Server-Sent Events (SSE) 스트림
   */
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 연결 시 현재 활성 프로젝트 정보 전송
    const currentId = ctx.getCachedId();
    res.write(`event: connected\ndata: ${JSON.stringify({ activeProject: currentId })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
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
  // 공유 엔티티 역추적 (Reverse Tracking) API 엔드포인트
  // ============================================================

  const sharedEntityIndexer = new SharedEntityIndexer();

  /**
   * 프로젝트 인덱스 맵 로드 (역추적 API용)
   * projects.json에 등록된 모든 프로젝트의 CodeIndex를 로드
   */
  async function loadProjectIndexMap(): Promise<Map<string, import('../types/index').CodeIndex>> {
    const projectsPath = path.join(impactBase, '.impact', 'projects.json');
    const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);
    const projectIndexMap = new Map<string, import('../types/index').CodeIndex>();

    if (!projectsConfig?.projects) return projectIndexMap;

    for (const project of projectsConfig.projects) {
      try {
        const index = await indexer.loadIndex(project.id, basePath);
        if (index) {
          projectIndexMap.set(project.id, index);
        }
      } catch {
        // 인덱스 로드 실패는 무시
      }
    }

    return projectIndexMap;
  }

  /**
   * GET /api/reverse/table/:name - 특정 테이블을 참조하는 프로젝트 조회
   */
  app.get('/api/reverse/table/:name', async (req: Request, res: Response) => {
    try {
      const tableName = getParam(req.params, 'name');
      if (!tableName) {
        res.status(400).json({ error: 'Table name is required' });
        return;
      }

      const projectIndexMap = await loadProjectIndexMap();
      const sharedIndex = sharedEntityIndexer.build(projectIndexMap);
      const refs = sharedEntityIndexer.findProjectsByTable(sharedIndex, tableName);

      const isShared = new Set(refs.map(r => r.projectId)).size >= 2;

      res.json({
        tableName,
        references: refs,
        total: refs.length,
        isShared,
      });
    } catch (error) {
      logger.error(`Failed to reverse lookup table:`, error);
      res.status(500).json({ error: 'Failed to reverse lookup table' });
    }
  });

  /**
   * GET /api/reverse/event/:name - 특정 이벤트를 참조하는 프로젝트 조회
   */
  app.get('/api/reverse/event/:name', async (req: Request, res: Response) => {
    try {
      const eventName = getParam(req.params, 'name');
      if (!eventName) {
        res.status(400).json({ error: 'Event name is required' });
        return;
      }

      const projectIndexMap = await loadProjectIndexMap();
      const sharedIndex = sharedEntityIndexer.build(projectIndexMap);
      const refs = sharedEntityIndexer.findProjectsByEvent(sharedIndex, eventName);

      const publishers = refs.filter(r => r.role === 'publisher');
      const subscribers = refs.filter(r => r.role === 'subscriber');

      res.json({
        eventName,
        references: refs,
        publishers,
        subscribers,
        total: refs.length,
      });
    } catch (error) {
      logger.error(`Failed to reverse lookup event:`, error);
      res.status(500).json({ error: 'Failed to reverse lookup event' });
    }
  });

  /**
   * GET /api/reverse/search?q= - 키워드로 테이블/이벤트 검색
   */
  app.get('/api/reverse/search', async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      if (!query.trim()) {
        res.status(400).json({ error: 'Search query (q) is required' });
        return;
      }

      const projectIndexMap = await loadProjectIndexMap();
      const sharedIndex = sharedEntityIndexer.build(projectIndexMap);
      const results = sharedEntityIndexer.search(sharedIndex, query.trim());

      res.json({
        query: query.trim(),
        tables: results.tables,
        events: results.events,
        totalTables: results.tables.length,
        totalEvents: results.events.length,
      });
    } catch (error) {
      logger.error(`Failed to search reverse index:`, error);
      res.status(500).json({ error: 'Failed to search reverse index' });
    }
  });

  /**
   * GET /api/shared-entities - 공유 테이블/이벤트 요약 정보
   */
  app.get('/api/shared-entities', async (_req: Request, res: Response) => {
    try {
      const projectIndexMap = await loadProjectIndexMap();
      const sharedIndex = sharedEntityIndexer.build(projectIndexMap);

      const sharedTables = sharedEntityIndexer.getSharedTables(sharedIndex);
      const sharedEvents = sharedEntityIndexer.getSharedEvents(sharedIndex);

      // 테이블 요약
      const tables = Object.entries(sharedTables).map(([name, refs]) => ({
        name,
        projects: [...new Set(refs.map(r => r.projectId))],
        referenceCount: refs.length,
      }));

      // 이벤트 요약
      const events = Object.entries(sharedEvents).map(([name, refs]) => ({
        name,
        publishers: refs.filter(r => r.role === 'publisher').map(r => r.projectId),
        subscribers: refs.filter(r => r.role === 'subscriber').map(r => r.projectId),
        referenceCount: refs.length,
      }));

      res.json({
        tables,
        events,
        stats: {
          totalTables: Object.keys(sharedIndex.tables).length,
          sharedTables: tables.length,
          totalEvents: Object.keys(sharedIndex.events).length,
          sharedEvents: events.length,
          projectCount: projectIndexMap.size,
        },
      });
    } catch (error) {
      logger.error('Failed to get shared entities:', error);
      res.status(500).json({ error: 'Failed to get shared entities' });
    }
  });

  // ============================================================
  // 갭 탐지 (Gap Check) API 엔드포인트
  // ============================================================

  /**
   * GET /api/gap-check - 갭 탐지 실행
   * 쿼리 파라미터: ?project=<id> (프로젝트 필터)
   */
  app.get('/api/gap-check', async (req: Request, res: Response) => {
    try {
      const projectId = req.query.project as string | undefined;
      const detector = new GapDetector(basePath);
      const result = await detector.detect({ projectId });
      res.json(result);
    } catch (err) {
      logger.error('Failed to run gap check:', err);
      res.status(500).json({ error: String(err) });
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
    console.warn('⚠️ 웹 대시보드 빌드가 필요합니다. 아래 명령어를 실행해주세요:');
    console.warn('   cd web && npm install && npm run build');
    app.get('{*splat}', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.status(404).json({
          error: 'Web UI not built',
          message: 'Run: cd web && npm install && npm run build',
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

  // ProjectContext 초기화 (서버 시작 전 1회 로드)
  const configManager = new ConfigManager(basePath);
  projectContext = new ProjectContext(configManager);
  await projectContext.initialize();

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
