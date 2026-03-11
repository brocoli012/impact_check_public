/**
 * @module core/review/multi-project-review-generator
 * @description Multi-project unified review document generator (REQ-018-B2)
 *
 * Takes multiple ConfidenceEnrichedResult objects from different projects
 * and generates a single unified review document with:
 * - Cross-project summary table
 * - Combined impact overview
 * - Per-project sections
 * - Cross-project data flow (combined Mermaid diagrams)
 * - Unified task list grouped by project
 * - Combined risk matrix
 * - Combined planning checks
 */

import { ConfidenceEnrichedResult, RiskArea } from '../../types/analysis';
import {
  ProjectReviewInput,
  MultiProjectReviewMetadata,
  MultiProjectReviewDocument,
  ReviewSectionType,
} from '../../types/review';
import { MermaidGenerator } from './mermaid-generator';
import { partitionRiskAreas, renderRiskTable, sortByImpact } from './risk-renderer';

// ============================================================
// Grade helpers
// ============================================================

/** Grade display order (for sorting) */
const GRADE_ORDER: Record<string, number> = {
  'Critical': 0,
  'High': 1,
  'Medium': 2,
  'Low': 3,
};

function gradeRank(grade: string): number {
  return GRADE_ORDER[grade] ?? 99;
}

// ============================================================
// MultiProjectReviewGenerator
// ============================================================

/**
 * MultiProjectReviewGenerator - generates a unified Markdown review document
 * from multiple project analysis results.
 */
export class MultiProjectReviewGenerator {
  private readonly specTitle: string;

  constructor(specTitle?: string) {
    this.specTitle = specTitle || '통합 기획 검토 결과서';
  }

  /**
   * Generate a unified multi-project review document.
   *
   * @param inputs - Array of project review inputs (projectId + result)
   * @returns MultiProjectReviewDocument with metadata and full markdown
   */
  generate(inputs: ProjectReviewInput[]): MultiProjectReviewDocument {
    if (inputs.length === 0) {
      return this.generateEmpty();
    }

    // Sort by score descending for consistent presentation
    const sorted = [...inputs].sort(
      (a, b) => b.result.totalScore - a.result.totalScore,
    );

    const metadata = this.buildMetadata(sorted);
    const markdown = this.assembleDocument(sorted, metadata);

    return { metadata, markdown };
  }

  // ============================================================
  // Private: metadata
  // ============================================================

  private buildMetadata(inputs: ProjectReviewInput[]): MultiProjectReviewMetadata {
    const totalTasks = inputs.reduce((sum, i) => sum + i.result.tasks.length, 0);
    const projectSummaries = inputs.map(i => ({
      projectId: i.projectId,
      totalScore: i.result.totalScore,
      grade: i.result.grade,
      taskCount: i.result.tasks.length,
    }));

    // Derive spec title from first result or use configured one
    const derivedTitle = inputs[0]?.result.specTitle || this.specTitle;

    const sections: ReviewSectionType[] = [
      'overview',
      'impact-summary',
      'data-flow',
      'task-list',
      'planning-checks',
      'risks',
      'result-location',
      'changelog',
    ];

    return {
      generatedBy: 'KIC (Kurly Impact Checker) v1.0',
      generatedAt: new Date().toISOString(),
      projectIds: inputs.map(i => i.projectId),
      specTitle: derivedTitle,
      totalProjects: inputs.length,
      totalTasks,
      projectSummaries,
      sections,
    };
  }

  // ============================================================
  // Private: document assembly
  // ============================================================

  private assembleDocument(
    inputs: ProjectReviewInput[],
    metadata: MultiProjectReviewMetadata,
  ): string {
    const parts: string[] = [];

    // YAML frontmatter
    parts.push(this.renderFrontmatter(metadata));

    // Title
    parts.push(`# ${metadata.specTitle} - 통합 기획 검토 결과서\n`);

    // Subtitle with metadata
    parts.push(`> **작성일**: ${new Date().toISOString().substring(0, 10)}`);
    parts.push(`> **분석 도구**: KIC (Kurly Impact Checker) v1.0`);
    parts.push(`> **분석 모드**: 멀티프로젝트 통합 리뷰`);
    parts.push(`> **대상 프로젝트**: ${metadata.projectIds.join(', ')}\n`);

    parts.push('---\n');

    // Table of contents
    parts.push(this.renderToc());
    parts.push('---\n');

    // 1. Cross-project summary
    parts.push(this.renderCrossProjectSummary(inputs));
    parts.push('---\n');

    // 2. Combined impact overview
    parts.push(this.renderCombinedImpactOverview(inputs));
    parts.push('---\n');

    // 3. Combined data flow
    const dataFlow = this.renderCombinedDataFlow(inputs);
    if (dataFlow) {
      parts.push(dataFlow);
      parts.push('---\n');
    }

    // 4. Per-project sections
    parts.push(this.renderPerProjectSections(inputs));
    parts.push('---\n');

    // 5. Combined tasks
    parts.push(this.renderCombinedTasks(inputs));
    parts.push('---\n');

    // 6. Combined planning checks
    const planningChecks = this.renderCombinedPlanningChecks(inputs);
    if (planningChecks) {
      parts.push(planningChecks);
      parts.push('---\n');
    }

    // 7. Combined risks
    parts.push(this.renderCombinedRisks(inputs));
    parts.push('---\n');

    // 8. Result locations
    parts.push(this.renderResultLocations(inputs));
    parts.push('---\n');

    // 9. Changelog
    parts.push(this.renderChangelog(inputs, metadata));

    return parts.join('\n');
  }

  // ============================================================
  // Private: frontmatter
  // ============================================================

  private renderFrontmatter(metadata: MultiProjectReviewMetadata): string {
    const lines: string[] = [];
    lines.push('---');
    lines.push('generatedBy: KIC (Kurly Impact Checker) v1.0');
    lines.push(`generatedAt: ${metadata.generatedAt}`);
    lines.push('mode: multi-project');
    lines.push(`projectIds: [${metadata.projectIds.join(', ')}]`);
    lines.push(`specTitle: ${metadata.specTitle}`);
    lines.push(`totalProjects: ${metadata.totalProjects}`);
    lines.push(`totalTasks: ${metadata.totalTasks}`);
    lines.push(`sections: [${metadata.sections.join(', ')}]`);
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }

  // ============================================================
  // Private: table of contents
  // ============================================================

  private renderToc(): string {
    const lines: string[] = [];
    lines.push('## 목차\n');
    lines.push('- [프로젝트별 영향도 비교](#프로젝트별-영향도-비교)');
    lines.push('- [통합 영향도 개요](#통합-영향도-개요)');
    lines.push('- [통합 데이터 흐름도](#통합-데이터-흐름도)');
    lines.push('- [프로젝트별 상세 분석](#프로젝트별-상세-분석)');
    lines.push('- [통합 태스크 목록](#통합-태스크-목록)');
    lines.push('- [통합 기획 확인 사항](#통합-기획-확인-사항)');
    lines.push('- [통합 리스크 매트릭스](#통합-리스크-매트릭스)');
    lines.push('- [분석 결과 저장 위치](#분석-결과-저장-위치)');
    lines.push('- [변경 이력](#변경-이력)');
    lines.push('');
    return lines.join('\n');
  }

  // ============================================================
  // 1. Cross-project summary table
  // ============================================================

  renderCrossProjectSummary(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 프로젝트별 영향도 비교\n');

    // Summary table
    lines.push('| 프로젝트 | 영향도 점수 | 등급 | 태스크 수 | 핵심 변경 |');
    lines.push('|:---------|:---:|:----:|:---:|:---------|');

    for (const input of inputs) {
      const r = input.result;
      const keyChange = this.extractKeyChange(r);
      lines.push(
        `| **${input.projectId}** | **${r.totalScore}** | ${r.grade} | ${r.tasks.length} | ${keyChange} |`,
      );
    }
    lines.push('');

    // Total stats
    const totalTasks = inputs.reduce((sum, i) => sum + i.result.tasks.length, 0);
    lines.push(`**총 프로젝트: ${inputs.length}개 | 총 태스크: ${totalTasks}건**\n`);

    // Score distribution chart
    lines.push('### 영향도 점수 분포\n');
    lines.push('```');
    for (const input of inputs) {
      const r = input.result;
      lines.push(this.renderScoreBar(input.projectId, r.totalScore, r.grade));
    }
    lines.push('            0        20        40        60        80       100');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  // ============================================================
  // 2. Combined impact overview
  // ============================================================

  private renderCombinedImpactOverview(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 통합 영향도 개요\n');

    const totalTasks = inputs.reduce((sum, i) => sum + i.result.tasks.length, 0);
    const totalScreens = inputs.reduce((sum, i) => sum + i.result.affectedScreens.length, 0);
    const avgScore = Math.round(
      inputs.reduce((sum, i) => sum + i.result.totalScore, 0) / inputs.length,
    );

    // Grade distribution
    const gradeGroups: Record<string, string[]> = {};
    for (const input of inputs) {
      const grade = input.result.grade;
      if (!gradeGroups[grade]) gradeGroups[grade] = [];
      gradeGroups[grade].push(input.projectId);
    }

    lines.push('| 항목 | 값 |');
    lines.push('|:-----|:---|');
    lines.push(`| 총 프로젝트 수 | ${inputs.length}개 |`);
    lines.push(`| 총 태스크 수 | ${totalTasks}건 |`);
    lines.push(`| 총 영향 화면 수 | ${totalScreens}개 |`);
    lines.push(`| 평균 영향도 점수 | ${avgScore}점 |`);
    lines.push('');

    // Grade breakdown
    lines.push('### 등급별 프로젝트 분포\n');
    const sortedGrades = Object.entries(gradeGroups).sort(
      (a, b) => gradeRank(a[0]) - gradeRank(b[0]),
    );
    for (const [grade, projects] of sortedGrades) {
      lines.push(`- **${grade}**: ${projects.join(', ')}`);
    }
    lines.push('');

    return lines.join('\n');
  }

  // ============================================================
  // 3. Combined data flow
  // ============================================================

  renderCombinedDataFlow(inputs: ProjectReviewInput[]): string {
    // Collect all data flow changes from all projects
    const allDataFlowChanges: Array<{ projectId: string; area: string; before: string; after: string; description: string }> = [];

    for (const input of inputs) {
      const changes = input.result.analysisSummary?.dataFlowChanges;
      if (changes && changes.length > 0) {
        for (const change of changes) {
          allDataFlowChanges.push({
            projectId: input.projectId,
            ...change,
          });
        }
      }
    }

    if (allDataFlowChanges.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('## 통합 데이터 흐름도\n');

    // Generate combined Mermaid diagrams if possible
    const mermaid = new MermaidGenerator();
    const dataFlowChanges = allDataFlowChanges.map(c => ({
      area: `[${c.projectId}] ${c.area}`,
      before: c.before,
      after: c.after,
      description: c.description,
    }));

    const diagramContent = mermaid.generateDataFlowDiagram(dataFlowChanges);
    if (diagramContent) {
      lines.push(diagramContent);
    }

    // Summary table
    lines.push('### 프로젝트별 데이터 흐름 변경 요약\n');
    lines.push('| 프로젝트 | 영역 | 변경 전 | 변경 후 | 설명 |');
    lines.push('|:---------|:-----|:-------|:-------|:-----|');
    for (const change of allDataFlowChanges) {
      lines.push(`| ${change.projectId} | ${change.area} | ${change.before} | ${change.after} | ${change.description} |`);
    }
    lines.push('');

    return lines.join('\n');
  }

  // ============================================================
  // 4. Per-project sections
  // ============================================================

  renderPerProjectSections(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 프로젝트별 상세 분석\n');

    for (const input of inputs) {
      const r = input.result;
      lines.push(`### ${input.projectId}\n`);

      // Basic info table
      lines.push('| 항목 | 값 |');
      lines.push('|:-----|:---|');
      lines.push(`| 기획서 | ${r.specTitle} |`);
      lines.push(`| 영향도 점수 | **${r.totalScore}** |`);
      lines.push(`| 등급 | ${r.grade} |`);
      lines.push(`| 태스크 수 | ${r.tasks.length}건 |`);
      lines.push(`| 영향 화면 수 | ${r.affectedScreens.length}개 |`);
      lines.push(`| 분석 ID | \`${r.analysisId}\` |`);
      lines.push('');

      // Key findings (if any)
      const keyFindings = r.analysisSummary?.keyFindings;
      if (keyFindings && keyFindings.length > 0) {
        lines.push('**주요 발견 사항:**\n');
        for (const finding of keyFindings) {
          lines.push(`- ${finding}`);
        }
        lines.push('');
      }

      // Screen scores
      if (r.screenScores && r.screenScores.length > 0) {
        lines.push('**화면별 점수:**\n');
        lines.push('```');
        for (const ss of r.screenScores) {
          lines.push(this.renderScoreBar(ss.screenName, ss.screenScore, ss.grade));
        }
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ============================================================
  // 5. Combined tasks
  // ============================================================

  renderCombinedTasks(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 통합 태스크 목록\n');

    const totalTasks = inputs.reduce((sum, i) => sum + i.result.tasks.length, 0);
    if (totalTasks === 0) {
      lines.push('분석된 태스크가 없습니다.\n');
      return lines.join('\n');
    }

    lines.push(`총 ${totalTasks}건의 태스크:\n`);

    for (const input of inputs) {
      const r = input.result;
      if (r.tasks.length === 0) continue;

      lines.push(`### ${input.projectId} (${r.tasks.length}건)\n`);
      lines.push('| # | ID | 태스크 | 유형 | 작업 분류 |');
      lines.push('|:-:|:---|:------|:---:|:------:|');

      for (let i = 0; i < r.tasks.length; i++) {
        const task = r.tasks[i];
        lines.push(`| ${i + 1} | ${task.id} | ${task.title} | ${task.type} | ${task.actionType} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================
  // 6. Combined planning checks
  // ============================================================

  renderCombinedPlanningChecks(inputs: ProjectReviewInput[]): string {
    const allChecks: Array<{ projectId: string; id: string; content: string; priority: string; status: string }> = [];

    for (const input of inputs) {
      if (input.result.planningChecks && input.result.planningChecks.length > 0) {
        for (const check of input.result.planningChecks) {
          allChecks.push({
            projectId: input.projectId,
            id: check.id,
            content: check.content,
            priority: check.priority,
            status: check.status,
          });
        }
      }
    }

    if (allChecks.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('## 통합 기획 확인 사항\n');

    lines.push(`총 ${allChecks.length}건의 기획 확인 사항:\n`);

    // Group by priority
    const high = allChecks.filter(c => c.priority === 'high');
    const medium = allChecks.filter(c => c.priority === 'medium');
    const low = allChecks.filter(c => c.priority === 'low');

    if (high.length > 0) {
      lines.push('### 우선순위 High (즉시 확인 필요)\n');
      lines.push('| # | 프로젝트 | ID | 내용 | 상태 |');
      lines.push('|:-:|:---------|:---|:-----|:----:|');
      for (let i = 0; i < high.length; i++) {
        const c = high[i];
        lines.push(`| ${i + 1} | ${c.projectId} | ${c.id} | ${c.content} | ${c.status} |`);
      }
      lines.push('');
    }

    if (medium.length > 0) {
      lines.push('### 우선순위 Medium (개발 전 확인)\n');
      lines.push('| # | 프로젝트 | ID | 내용 | 상태 |');
      lines.push('|:-:|:---------|:---|:-----|:----:|');
      for (let i = 0; i < medium.length; i++) {
        const c = medium[i];
        lines.push(`| ${i + 1} | ${c.projectId} | ${c.id} | ${c.content} | ${c.status} |`);
      }
      lines.push('');
    }

    if (low.length > 0) {
      lines.push('### 우선순위 Low\n');
      lines.push('| # | 프로젝트 | ID | 내용 | 상태 |');
      lines.push('|:-:|:---------|:---|:-----|:----:|');
      for (let i = 0; i < low.length; i++) {
        const c = low[i];
        lines.push(`| ${i + 1} | ${c.projectId} | ${c.id} | ${c.content} | ${c.status} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================
  // 7. Combined risks
  // ============================================================

  renderCombinedRisks(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 통합 리스크 매트릭스\n');

    // Collect all risks from all projects
    const allStringRisks: Array<{ projectId: string; risk: string }> = [];
    const allStructuredRisks: RiskArea[] = [];

    for (const input of inputs) {
      const riskAreas = input.result.analysisSummary?.riskAreas || [];
      const { stringRisks, structuredRisks } = partitionRiskAreas(riskAreas);

      for (const risk of stringRisks) {
        allStringRisks.push({ projectId: input.projectId, risk });
      }

      // Add project info to structured risks if not already present
      for (const risk of structuredRisks) {
        const enriched = { ...risk };
        if (!enriched.relatedProjects.includes(input.projectId)) {
          enriched.relatedProjects = [...enriched.relatedProjects, input.projectId];
        }
        allStructuredRisks.push(enriched);
      }
    }

    if (allStructuredRisks.length === 0 && allStringRisks.length === 0) {
      lines.push('분석된 리스크가 없습니다.\n');
      return lines.join('\n');
    }

    // Render structured risks as a table
    if (allStructuredRisks.length > 0) {
      const sorted = sortByImpact(allStructuredRisks);
      lines.push(renderRiskTable(sorted));
      lines.push('');
    }

    // Render string risks as bullet list, grouped by project
    if (allStringRisks.length > 0) {
      if (allStructuredRisks.length > 0) {
        lines.push('### 추가 주의사항\n');
      }
      for (const { projectId, risk } of allStringRisks) {
        lines.push(`- [${projectId}] ${risk}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================
  // 8. Result locations
  // ============================================================

  private renderResultLocations(inputs: ProjectReviewInput[]): string {
    const lines: string[] = [];
    lines.push('## 분석 결과 저장 위치\n');

    lines.push('| 프로젝트 | 분석 ID | 분석 시각 | 분석 방법 |');
    lines.push('|:---------|:--------|:---------|:---------|');

    for (const input of inputs) {
      const r = input.result;
      lines.push(
        `| ${input.projectId} | \`${r.analysisId}\` | ${r.analyzedAt} | ${r.analysisMethod} |`,
      );
    }
    lines.push('');

    return lines.join('\n');
  }

  // ============================================================
  // 9. Changelog
  // ============================================================

  private renderChangelog(
    _inputs: ProjectReviewInput[],
    metadata: MultiProjectReviewMetadata,
  ): string {
    const lines: string[] = [];
    lines.push('## 변경 이력\n');

    lines.push('| 날짜 | 변경 내용 |');
    lines.push('|:-----|:---------|');

    const date = new Date().toISOString().substring(0, 10);
    const totalTasks = metadata.totalTasks;
    const projectList = metadata.projectIds.join(', ');
    lines.push(
      `| ${date} | 통합 리뷰 최초 생성 (자동) - ${metadata.totalProjects}개 프로젝트, ${totalTasks}태스크 [${projectList}] |`,
    );
    lines.push('');

    return lines.join('\n');
  }

  // ============================================================
  // Private: empty document
  // ============================================================

  private generateEmpty(): MultiProjectReviewDocument {
    const metadata: MultiProjectReviewMetadata = {
      generatedBy: 'KIC (Kurly Impact Checker) v1.0',
      generatedAt: new Date().toISOString(),
      projectIds: [],
      specTitle: this.specTitle,
      totalProjects: 0,
      totalTasks: 0,
      projectSummaries: [],
      sections: [],
    };

    const markdown = [
      '---',
      'generatedBy: KIC (Kurly Impact Checker) v1.0',
      `generatedAt: ${metadata.generatedAt}`,
      'mode: multi-project',
      'projectIds: []',
      `specTitle: ${this.specTitle}`,
      'totalProjects: 0',
      'totalTasks: 0',
      '---',
      '',
      `# ${this.specTitle} - 통합 기획 검토 결과서\n`,
      '> 통합할 프로젝트 분석 결과가 없습니다.\n',
    ].join('\n');

    return { metadata, markdown };
  }

  // ============================================================
  // Private: utility helpers
  // ============================================================

  /**
   * Render an ASCII score bar for the score distribution chart.
   */
  private renderScoreBar(label: string, score: number, grade: string, width: number = 50): string {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    const paddedLabel = label.padEnd(12);
    return `${paddedLabel}${bar}  ${score}점 (${grade})`;
  }

  /**
   * Extract a short key change description from an analysis result.
   */
  private extractKeyChange(result: ConfidenceEnrichedResult): string {
    const summary = result.analysisSummary;
    if (summary?.keyFindings && summary.keyFindings.length > 0) {
      // Return the first key finding, truncated
      const first = summary.keyFindings[0];
      return first.length > 60 ? first.substring(0, 57) + '...' : first;
    }

    // Fallback: use spec title or task count info
    if (result.tasks.length > 0) {
      const feCount = result.tasks.filter(t => t.type === 'FE').length;
      const beCount = result.tasks.filter(t => t.type === 'BE').length;
      const parts: string[] = [];
      if (beCount > 0) parts.push(`BE ${beCount}건`);
      if (feCount > 0) parts.push(`FE ${feCount}건`);
      return parts.join(' + ');
    }

    return '-';
  }
}
