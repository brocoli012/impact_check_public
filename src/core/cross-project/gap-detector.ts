/**
 * @module core/cross-project/gap-detector
 * @description 크로스 프로젝트 갭 탐지기 - 프로젝트 간 의존성/분석 상태 점검
 *
 * 4가지 탐지 유형:
 * 1. Stale 링크 (High): confirmedAt이 인덱스 meta.updatedAt보다 오래되었거나, 프로젝트 미존재
 * 2. 미분석 프로젝트 (Medium): cross-project.json links에 등장하지 않는 등록 프로젝트
 * 3. 저신뢰도 분석 (Medium): totalScore < 60인 분석 결과 (active 상태만)
 * 4. 인덱스 미갱신 (Low): git 커밋 시각 > 인덱스 meta.updatedAt
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { CrossProjectManager } from './cross-project-manager';
import { ResultManager } from '../analysis/result-manager';
import { getEffectiveStatus } from '../../utils/analysis-status';
import { readJsonFile, writeJsonFile, getImpactDir } from '../../utils/file';
import type {
  GapItem,
  GapCheckResult,
  FixResult,
  CrossProjectConfig,
} from './types';
import type { ProjectsConfig, ProjectEntry, IndexMeta } from '../../types/index';

/** 저신뢰도 기준 점수 */
const LOW_CONFIDENCE_THRESHOLD = 60;

/**
 * GapDetector - 크로스 프로젝트 갭 탐지기
 *
 * 등록된 프로젝트와 cross-project.json의 링크 상태를 점검하여
 * 관리가 필요한 갭(Gap)을 식별합니다.
 */
export class GapDetector {
  private readonly crossManager: CrossProjectManager;
  private readonly resultManager: ResultManager;
  /** .impact 디렉토리 경로 (예: ~/.impact) */
  private readonly impactDir: string;

  /**
   * GapDetector 생성
   * @param basePath - HOME 경로 (기본값: process.env.HOME)
   *                   .impact 하위에 projects.json, cross-project.json 등이 위치
   */
  constructor(basePath?: string) {
    this.impactDir = getImpactDir(basePath);
    this.crossManager = new CrossProjectManager(this.impactDir);
    this.resultManager = new ResultManager(basePath);
  }

  /**
   * 갭 탐지 실행
   * @param options - 탐지 옵션 (projectId로 필터 가능)
   * @returns 갭 탐지 결과
   */
  async detect(options?: { projectId?: string }): Promise<GapCheckResult> {
    // 1. 등록 프로젝트 목록 가져오기
    const projects = this.loadProjects();
    if (projects.length === 0) {
      return this.emptyResult();
    }

    // 2. cross-project.json 로드
    const config = await this.crossManager.loadConfig();

    // 3. 4가지 유형별 탐지 실행
    const staleLinks = this.detectStaleLinks(config, projects);
    const unanalyzed = this.detectUnanalyzedProjects(config, projects);
    const lowConfidenceResult = await this.detectLowConfidence(projects);
    const staleIndex = this.detectStaleIndex(projects);

    let allGaps: GapItem[] = [
      ...staleLinks,
      ...unanalyzed,
      ...lowConfidenceResult.gaps,
      ...staleIndex,
    ];

    // 4. projectId 필터 적용 (옵션)
    if (options?.projectId) {
      allGaps = allGaps.filter(g => g.projectId === options.projectId);
    }

    // 5. 결과 집계
    const summary = {
      total: allGaps.length,
      high: allGaps.filter(g => g.severity === 'high').length,
      medium: allGaps.filter(g => g.severity === 'medium').length,
      low: allGaps.filter(g => g.severity === 'low').length,
      fixable: allGaps.filter(g => g.fixable).length,
    };

    return {
      gaps: allGaps,
      summary,
      excludedCounts: lowConfidenceResult.excludedCounts,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 갭 자동 수정
   *
   * 수정 가능한 갭 유형:
   * - stale-link (프로젝트 삭제): cross-project.json에서 해당 링크 제거
   * - stale-link (오래된 confirmedAt): 안내 메시지 (detectAndSave 재실행 필요)
   * - unanalyzed-project: 안내 메시지 (cross-analyze --auto 실행 필요)
   * - stale-index: 안내 메시지 (reindex 실행 필요)
   * - low-confidence: fixable=false이므로 skip
   *
   * @param gaps - 수정할 갭 목록
   * @returns 수정 결과
   */
  async fix(gaps: GapItem[]): Promise<FixResult> {
    const details: FixResult['details'] = [];
    let fixed = 0;
    let failed = 0;

    // cross-project.json을 한 번만 로드/저장하기 위한 최적화
    const config = await this.crossManager.loadConfig();
    let configModified = false;

    for (const gap of gaps) {
      if (!gap.fixable) {
        // fixable=false인 항목은 skip
        details.push({
          gap,
          success: false,
          message: `not fixable (${gap.type})`,
        });
        failed++;
        continue;
      }

      try {
        switch (gap.type) {
          case 'stale-link': {
            // 프로젝트 삭제로 인한 stale-link: 링크 제거
            const linkId = gap.detail.linkId;
            if (linkId && this.isDeletedProjectLink(gap, config)) {
              const initialLen = config.links.length;
              config.links = config.links.filter(l => l.id !== linkId);
              if (config.links.length < initialLen) {
                configModified = true;
                details.push({
                  gap,
                  success: true,
                  message: `removed link ${gap.detail.sourceProject}\u2192${gap.detail.targetProject}`,
                });
                fixed++;
              } else {
                details.push({
                  gap,
                  success: false,
                  message: `link ${linkId} not found in config`,
                });
                failed++;
              }
            } else {
              // 오래된 confirmedAt: detectAndSave 재실행이 필요
              details.push({
                gap,
                success: false,
                message: `run 'impact cross-analyze --auto' to refresh link`,
              });
              failed++;
            }
            break;
          }

          case 'unanalyzed-project': {
            // cross-analyze --auto 실행이 필요
            details.push({
              gap,
              success: false,
              message: `run 'impact cross-analyze --auto' to include ${gap.projectId}`,
            });
            failed++;
            break;
          }

          case 'stale-index': {
            // reindex가 필요
            details.push({
              gap,
              success: false,
              message: `run 'impact reindex --project ${gap.projectId}'`,
            });
            failed++;
            break;
          }

          default: {
            details.push({
              gap,
              success: false,
              message: `unknown gap type: ${gap.type}`,
            });
            failed++;
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        details.push({
          gap,
          success: false,
          message: `fix error: ${errorMsg}`,
        });
        failed++;
      }
    }

    // 변경사항이 있으면 cross-project.json 저장
    if (configModified) {
      const configPath = path.join(this.impactDir, 'cross-project.json');
      writeJsonFile(configPath, config);
    }

    return { fixed, failed, details };
  }

  /**
   * stale-link가 프로젝트 삭제로 인한 것인지 판별
   * (프로젝트가 등록되지 않은 경우)
   */
  private isDeletedProjectLink(gap: GapItem, config: CrossProjectConfig): boolean {
    const projects = this.loadProjects();
    const projectIds = new Set(projects.map(p => p.id));
    const link = config.links.find(l => l.id === gap.detail.linkId);
    if (!link) return false;
    return !projectIds.has(link.source) || !projectIds.has(link.target);
  }

  // ============================================================
  // Private: 탐지 메서드
  // ============================================================

  /**
   * Stale 링크 탐지 (High)
   *
   * - confirmedAt이 인덱스 meta.updatedAt보다 오래된 링크
   * - 프로젝트가 삭제/미존재하는 링크
   */
  private detectStaleLinks(config: CrossProjectConfig, projects: ProjectEntry[]): GapItem[] {
    const gaps: GapItem[] = [];
    const projectIds = new Set(projects.map(p => p.id));

    for (const link of config.links) {
      // 프로젝트 삭제/미존재 확인
      if (!projectIds.has(link.source) || !projectIds.has(link.target)) {
        const missingId = !projectIds.has(link.source) ? link.source : link.target;
        gaps.push({
          type: 'stale-link',
          severity: 'high',
          projectId: missingId,
          description: `링크 ${link.id}의 프로젝트 '${missingId}'가 등록되지 않았거나 삭제되었습니다.`,
          detail: {
            linkId: link.id,
            sourceProject: link.source,
            targetProject: link.target,
            confirmedAt: link.confirmedAt,
          },
          fixable: true,
          fixCommand: `cross-analyze unlink ${link.source} ${link.target}`,
        });
        continue;
      }

      // confirmedAt 기반 stale 체크
      if (link.confirmedAt) {
        const confirmedTime = new Date(link.confirmedAt).getTime();

        // source 프로젝트 인덱스의 meta.updatedAt과 비교
        const sourceIndexUpdatedAt = this.getIndexUpdatedAt(link.source);
        const targetIndexUpdatedAt = this.getIndexUpdatedAt(link.target);

        // source 또는 target 중 하나라도 인덱스가 confirmedAt보다 새로운 경우 stale
        const latestUpdatedAt = Math.max(
          sourceIndexUpdatedAt ? new Date(sourceIndexUpdatedAt).getTime() : 0,
          targetIndexUpdatedAt ? new Date(targetIndexUpdatedAt).getTime() : 0,
        );

        if (latestUpdatedAt > 0 && confirmedTime < latestUpdatedAt) {
          gaps.push({
            type: 'stale-link',
            severity: 'high',
            projectId: link.source,
            description: `링크 ${link.id}의 확인 시각이 인덱스 업데이트보다 오래되었습니다.`,
            detail: {
              linkId: link.id,
              sourceProject: link.source,
              targetProject: link.target,
              confirmedAt: link.confirmedAt,
              indexUpdatedAt: sourceIndexUpdatedAt || targetIndexUpdatedAt || undefined,
            },
            fixable: true,
            fixCommand: `cross-analyze --auto`,
          });
        }
      }
    }

    return gaps;
  }

  /**
   * 미분석 프로젝트 탐지 (Medium)
   *
   * cross-project.json links에 한 번도 등장하지 않는 등록 프로젝트
   */
  private detectUnanalyzedProjects(config: CrossProjectConfig, projects: ProjectEntry[]): GapItem[] {
    const gaps: GapItem[] = [];

    // links에 등장하는 프로젝트 ID 수집
    const linkedProjectIds = new Set<string>();
    for (const link of config.links) {
      linkedProjectIds.add(link.source);
      linkedProjectIds.add(link.target);
    }

    // links에 없는 등록 프로젝트 탐지
    for (const project of projects) {
      if (!linkedProjectIds.has(project.id)) {
        gaps.push({
          type: 'unanalyzed-project',
          severity: 'medium',
          projectId: project.id,
          description: `프로젝트 '${project.name}'(${project.id})이 크로스 프로젝트 분석에 포함되지 않았습니다.`,
          detail: {},
          fixable: true,
          fixCommand: `cross-analyze --auto`,
        });
      }
    }

    return gaps;
  }

  /**
   * 저신뢰도 분석 탐지 (Medium)
   *
   * totalScore < 60인 분석 결과 (active 상태만 대상)
   * completed, on-hold, archived 상태는 제외
   */
  private async detectLowConfidence(
    projects: ProjectEntry[],
  ): Promise<{ gaps: GapItem[]; excludedCounts: { completed: number; onHold: number; archived: number } }> {
    const gaps: GapItem[] = [];
    const excludedCounts = { completed: 0, onHold: 0, archived: 0 };

    for (const project of projects) {
      const summaries = await this.resultManager.list(project.id);

      for (const summary of summaries) {
        const effectiveStatus = getEffectiveStatus(summary.status);

        // 비활성 상태 제외 (excludedCounts 집계)
        if (effectiveStatus === 'completed') {
          if (summary.totalScore < LOW_CONFIDENCE_THRESHOLD) {
            excludedCounts.completed++;
          }
          continue;
        }
        if (effectiveStatus === 'on-hold') {
          if (summary.totalScore < LOW_CONFIDENCE_THRESHOLD) {
            excludedCounts.onHold++;
          }
          continue;
        }
        if (effectiveStatus === 'archived') {
          if (summary.totalScore < LOW_CONFIDENCE_THRESHOLD) {
            excludedCounts.archived++;
          }
          continue;
        }

        // active 상태만 대상
        if (summary.totalScore < LOW_CONFIDENCE_THRESHOLD) {
          gaps.push({
            type: 'low-confidence',
            severity: 'medium',
            projectId: project.id,
            description: `분석 '${summary.specTitle}'(${summary.id})의 총점이 ${summary.totalScore}점으로 기준(${LOW_CONFIDENCE_THRESHOLD}점) 미만입니다.`,
            detail: {
              analysisId: summary.id,
              totalScore: summary.totalScore,
            },
            fixable: false,
          });
        }
      }
    }

    return { gaps, excludedCounts };
  }

  /**
   * 인덱스 미갱신 탐지 (Low)
   *
   * git log -1 --format=%ci 날짜 > 인덱스 meta.updatedAt
   */
  private detectStaleIndex(projects: ProjectEntry[]): GapItem[] {
    const gaps: GapItem[] = [];

    for (const project of projects) {
      const indexUpdatedAt = this.getIndexUpdatedAt(project.id);
      if (!indexUpdatedAt) {
        // 인덱스 자체가 없으면 skip (인덱싱 안 된 프로젝트)
        continue;
      }

      const lastGitCommit = this.getLastGitCommitDate(project.path);
      if (!lastGitCommit) {
        // git 미설치/미초기화 → skip
        continue;
      }

      const indexTime = new Date(indexUpdatedAt).getTime();
      const gitTime = new Date(lastGitCommit).getTime();

      if (gitTime > indexTime) {
        gaps.push({
          type: 'stale-index',
          severity: 'low',
          projectId: project.id,
          description: `프로젝트 '${project.name}'(${project.id})의 인덱스가 최신 커밋보다 오래되었습니다.`,
          detail: {
            indexUpdatedAt,
            lastGitCommit,
          },
          fixable: true,
          fixCommand: `reindex --project ${project.id}`,
        });
      }
    }

    return gaps;
  }

  // ============================================================
  // Private: 유틸리티 메서드
  // ============================================================

  /**
   * 등록 프로젝트 목록 로드
   */
  private loadProjects(): ProjectEntry[] {
    const projectsPath = path.join(this.impactDir, 'projects.json');
    const config = readJsonFile<ProjectsConfig>(projectsPath);
    if (!config?.projects) {
      return [];
    }
    return config.projects;
  }

  /**
   * 프로젝트 인덱스의 meta.updatedAt 조회
   */
  private getIndexUpdatedAt(projectId: string): string | null {
    // basePath가 .impact 디렉토리를 가리키므로, getProjectDir 대신 직접 경로 구성
    const metaPath = path.join(this.impactDir, 'projects', projectId, 'index', 'meta.json');
    const meta = readJsonFile<IndexMeta>(metaPath);
    return meta?.updatedAt || null;
  }

  /**
   * 프로젝트의 마지막 git 커밋 날짜 조회
   * @param projectPath - 프로젝트 Git 레포 경로
   * @returns ISO 형식 날짜 문자열 또는 null
   */
  private getLastGitCommitDate(projectPath: string): string | null {
    try {
      const result = execSync('git log -1 --format=%ci', {
        cwd: projectPath,
        timeout: 2000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim() || null;
    } catch {
      // git 미설치, 미초기화, timeout 등 모두 null 반환
      return null;
    }
  }

  /**
   * 빈 결과 생성 (프로젝트가 0개이거나 cross-project.json이 없을 때)
   */
  private emptyResult(): GapCheckResult {
    return {
      gaps: [],
      summary: { total: 0, high: 0, medium: 0, low: 0, fixable: 0 },
      excludedCounts: { completed: 0, onHold: 0, archived: 0 },
      checkedAt: new Date().toISOString(),
    };
  }
}
