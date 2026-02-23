/**
 * @module core/cross-project/supplement-scanner
 * @description 보완 분석 후보 스캐너 - 신규 프로젝트 등록 시 기존 분석 결과 매칭
 *
 * 신규 프로젝트 등록 시, 기존 active 상태 분석 결과를 스캔하여
 * 매칭도 20% 이상인 항목을 보완 분석 후보로 제안한다.
 */

import * as path from 'path';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import { CodeIndex, ProjectsConfig } from '../../types/index';
import { getEffectiveStatus } from '../../utils/analysis-status';
import { readJsonFile, getImpactDir } from '../../utils/file';
import { ResultManager } from '../analysis/result-manager';
import { Indexer } from '../indexing/indexer';
import { logger } from '../../utils/logger';

// ============================================================
// 보완 분석 후보 타입
// ============================================================

/** 보완 분석 후보 */
export interface SupplementCandidate {
  /** 분석 ID */
  analysisId: string;
  /** 기존 분석의 프로젝트 ID */
  projectId: string;
  /** 결과 ID */
  resultId: string;
  /** 분석 결과 제목 */
  title: string;
  /** 매칭도 (0~100) */
  matchRate: number;
  /** 매칭된 키워드 */
  matchedKeywords: string[];
  /** 추천 유형 */
  recommendation: 'auto' | 'suggest' | 'excluded';
  /** 분석 결과 상태 */
  status: string;
}

/** 보완 분석 스캔 결과 */
export interface SupplementScanResult {
  /** 신규 프로젝트 ID */
  newProjectId: string;
  /** 보완 분석 후보 목록 */
  candidates: SupplementCandidate[];
  /** 요약 */
  summary: {
    total: number;
    auto: number;
    suggest: number;
    excluded: number;
  };
  /** 상태별 제외 통계 */
  excludedByStatus: {
    completed: number;
    onHold: number;
    archived: number;
  };
  /** 스캔 시각 */
  scannedAt: string;
}

/** 인덱스 데이터 (매칭에 필요한 최소 구조) */
interface IndexKeywords {
  screens: string[];
  apis: string[];
  components: string[];
  models: string[];
}

/**
 * SupplementScanner - 보완 분석 후보 스캐너
 *
 * 신규 프로젝트의 인덱스(screens, apis, components, models)와
 * 기존 분석 결과의 키워드를 비교하여 매칭도를 계산한다.
 */
export class SupplementScanner {
  private readonly basePath?: string;
  private readonly resultManager: ResultManager;

  constructor(basePath?: string) {
    this.basePath = basePath;
    this.resultManager = new ResultManager(basePath);
  }

  /**
   * 신규 프로젝트에 대해 보완 분석 후보 스캔
   *
   * @param newProjectId - 신규 프로젝트 ID
   * @returns 보완 분석 스캔 결과
   */
  async scan(newProjectId: string): Promise<SupplementScanResult> {
    const emptyResult: SupplementScanResult = {
      newProjectId,
      candidates: [],
      summary: { total: 0, auto: 0, suggest: 0, excluded: 0 },
      excludedByStatus: { completed: 0, onHold: 0, archived: 0 },
      scannedAt: new Date().toISOString(),
    };

    // 1. 신규 프로젝트의 인덱스 로드
    const newProjectIndex = await this.loadProjectIndex(newProjectId);
    if (!newProjectIndex) {
      logger.info(`인덱스가 없는 프로젝트입니다: ${newProjectId}. 빈 결과 반환.`);
      return emptyResult;
    }

    // 2. 신규 프로젝트 인덱스에서 키워드 추출
    const newProjectKeywords = this.extractIndexKeywords(newProjectIndex);
    if (this.isEmptyKeywords(newProjectKeywords)) {
      logger.info(`프로젝트 인덱스에 키워드가 없습니다: ${newProjectId}. 빈 결과 반환.`);
      return emptyResult;
    }

    // 3. 모든 프로젝트 목록 로드
    const projects = this.loadProjects();
    if (!projects || projects.length === 0) {
      logger.info('등록된 프로젝트가 없습니다. 빈 결과 반환.');
      return emptyResult;
    }

    // 4. 각 프로젝트의 분석 결과를 순회하며 매칭도 계산
    const candidates: SupplementCandidate[] = [];
    const excludedByStatus = { completed: 0, onHold: 0, archived: 0 };

    for (const project of projects) {
      // 자기 자신 제외
      if (project.id === newProjectId) continue;

      const summaries = await this.resultManager.list(project.id);
      if (summaries.length === 0) continue;

      for (const summary of summaries) {
        const effectiveStatus = getEffectiveStatus(summary.status);

        // active가 아닌 상태는 excludedByStatus에 카운트하고 스킵
        if (effectiveStatus !== 'active') {
          if (effectiveStatus === 'completed') excludedByStatus.completed++;
          else if (effectiveStatus === 'on-hold') excludedByStatus.onHold++;
          else if (effectiveStatus === 'archived') excludedByStatus.archived++;
          continue;
        }

        // 분석 결과 로드
        const analysisResult = await this.resultManager.getById(project.id, summary.id);
        if (!analysisResult) continue;

        // 매칭도 계산
        const { rate, matchedKeywords } = this.calculateMatchRate(
          analysisResult,
          newProjectKeywords,
        );

        // 추천 유형 결정
        let recommendation: 'auto' | 'suggest' | 'excluded';
        if (rate >= 50) {
          recommendation = 'auto';
        } else if (rate >= 20) {
          recommendation = 'suggest';
        } else {
          recommendation = 'excluded';
        }

        candidates.push({
          analysisId: summary.id,
          projectId: project.id,
          resultId: summary.id,
          title: summary.specTitle,
          matchRate: rate,
          matchedKeywords,
          recommendation,
          status: effectiveStatus,
        });
      }
    }

    // 5. 매칭도 내림차순 정렬
    candidates.sort((a, b) => b.matchRate - a.matchRate);

    // 6. 요약 계산
    const summary = {
      total: candidates.length,
      auto: candidates.filter(c => c.recommendation === 'auto').length,
      suggest: candidates.filter(c => c.recommendation === 'suggest').length,
      excluded: candidates.filter(c => c.recommendation === 'excluded').length,
    };

    logger.info(
      `보완 분석 스캔 완료: 총 ${summary.total}건 (auto: ${summary.auto}, suggest: ${summary.suggest}, excluded: ${summary.excluded})`,
    );

    return {
      newProjectId,
      candidates,
      summary,
      excludedByStatus,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * 매칭도 계산 (내부용)
   *
   * 기존 분석 결과에서 추출한 키워드와 신규 프로젝트 인덱스의 키워드를 비교하여
   * 매칭도를 계산한다.
   *
   * 매칭도 = (매칭 키워드 수 / 기존 분석 키워드 수) * 100
   *
   * @param analysisResult - 기존 분석 결과
   * @param newProjectKeywords - 신규 프로젝트 인덱스에서 추출한 키워드
   * @returns 매칭도와 매칭된 키워드 목록
   */
  private calculateMatchRate(
    analysisResult: ConfidenceEnrichedResult,
    newProjectKeywords: IndexKeywords,
  ): { rate: number; matchedKeywords: string[] } {
    // 1. 기존 분석에서 키워드 추출
    const analysisKeywords = this.extractAnalysisKeywords(analysisResult);

    if (analysisKeywords.length === 0) {
      return { rate: 0, matchedKeywords: [] };
    }

    // 2. 신규 프로젝트 인덱스의 모든 키워드를 하나의 배열로 합침 (소문자)
    const indexKeywordsLower = [
      ...newProjectKeywords.screens,
      ...newProjectKeywords.apis,
      ...newProjectKeywords.components,
      ...newProjectKeywords.models,
    ].map(k => k.toLowerCase());

    // 3. 매칭 키워드 찾기 (부분 매칭 포함)
    const matchedKeywords: string[] = [];
    const matchedSet = new Set<string>();

    for (const keyword of analysisKeywords) {
      const keywordLower = keyword.toLowerCase();

      for (const indexKeyword of indexKeywordsLower) {
        // 부분 매칭: 분석 키워드가 인덱스 키워드에 포함되거나, 인덱스 키워드가 분석 키워드에 포함
        if (
          indexKeyword.includes(keywordLower) ||
          keywordLower.includes(indexKeyword)
        ) {
          if (!matchedSet.has(keywordLower)) {
            matchedSet.add(keywordLower);
            matchedKeywords.push(keyword);
          }
          break; // 하나라도 매칭되면 다음 keyword로
        }
      }
    }

    // 4. 매칭도 계산: (매칭 키워드 수 / 기존 분석 키워드 수) * 100
    const rate = Math.round((matchedKeywords.length / analysisKeywords.length) * 100);

    return { rate, matchedKeywords };
  }

  /**
   * 기존 분석 결과에서 키워드 추출
   *
   * 1. parsedSpec.keywords (있으면)
   * 2. analysisSummary.keyFindings에서 명사/키워드 추출
   * 3. impactedFiles(affectedScreens)에서 API 경로, 컴포넌트명 추출
   */
  private extractAnalysisKeywords(result: ConfidenceEnrichedResult): string[] {
    const keywords: string[] = [];
    const seen = new Set<string>();

    const addKeyword = (kw: string): void => {
      const normalized = kw.trim().toLowerCase();
      if (normalized.length >= 2 && !seen.has(normalized)) {
        seen.add(normalized);
        keywords.push(kw.trim());
      }
    };

    // 1. parsedSpec.keywords
    if (result.parsedSpec?.keywords) {
      for (const kw of result.parsedSpec.keywords) {
        addKeyword(kw);
      }
    }

    // 2. analysisSummary.keyFindings에서 키워드 추출
    if (result.analysisSummary?.keyFindings) {
      for (const finding of result.analysisSummary.keyFindings) {
        // 간단한 명사/키워드 추출: 영문은 단어 단위, 한글은 공백 기준
        const words = finding.split(/[\s,.:;()/\-_]+/).filter(w => w.length >= 2);
        for (const word of words) {
          addKeyword(word);
        }
      }
    }

    // 3. affectedScreens에서 컴포넌트명 추출
    if (result.affectedScreens) {
      for (const screen of result.affectedScreens) {
        addKeyword(screen.screenName);
        // 태스크에서 API 경로, 파일명 추출
        if (screen.tasks) {
          for (const task of screen.tasks) {
            if (task.relatedApis) {
              for (const api of task.relatedApis) {
                addKeyword(api);
              }
            }
            if (task.affectedFiles) {
              for (const filePath of task.affectedFiles) {
                // 파일명만 추출 (경로 제외)
                const fileName = path.basename(filePath, path.extname(filePath));
                addKeyword(fileName);
              }
            }
          }
        }
      }
    }

    // 4. 최상위 tasks에서도 추출
    if (result.tasks) {
      for (const task of result.tasks) {
        if (task.relatedApis) {
          for (const api of task.relatedApis) {
            addKeyword(api);
          }
        }
      }
    }

    return keywords;
  }

  /**
   * 프로젝트 인덱스에서 키워드 추출
   */
  private extractIndexKeywords(index: CodeIndex): IndexKeywords {
    return {
      screens: index.screens.map(s => s.name),
      apis: index.apis.map(a => a.path),
      components: index.components.map(c => c.name),
      models: index.models.map(m => m.name),
    };
  }

  /**
   * 키워드가 비어있는지 확인
   */
  private isEmptyKeywords(keywords: IndexKeywords): boolean {
    return (
      keywords.screens.length === 0 &&
      keywords.apis.length === 0 &&
      keywords.components.length === 0 &&
      keywords.models.length === 0
    );
  }

  /**
   * 프로젝트 인덱스 로드
   */
  private async loadProjectIndex(projectId: string): Promise<CodeIndex | null> {
    const indexer = new Indexer();
    return indexer.loadIndex(projectId, this.basePath);
  }

  /**
   * 등록된 프로젝트 목록 로드
   */
  private loadProjects(): { id: string; name: string }[] {
    const projectsPath = path.join(
      getImpactDir(this.basePath),
      'projects.json',
    );
    const config = readJsonFile<ProjectsConfig>(projectsPath);
    if (!config?.projects) return [];
    return config.projects.map(p => ({ id: p.id, name: p.name }));
  }
}
