/**
 * @module core/review/review-generator
 * @description Review document generator engine (REQ-018-A1)
 *
 * Orchestrates section renderers to produce a complete Markdown review document
 * from a ConfidenceEnrichedResult JSON.
 */

import * as fs from 'fs';
import { ConfidenceEnrichedResult } from '../../types/analysis';
import {
  ReviewGenerateOptions,
  ReviewDocument,
  ReviewMetadata,
  SectionRenderResult,
  ReviewSectionType,
  SECTION_ORDER,
  REQUIRED_SECTIONS,
  PHASE_B_SECTIONS,
  SECTION_NAMES,
} from '../../types/review';
import {
  renderSpecOverview,
  renderImpactSummary,
  renderDataFlowDiagram,
  renderDetailedDataFlow,
  renderUserProcess,
  renderDomainAnalysis,
  renderTaskList,
  renderPlanningChecks,
  renderRiskSection,
  renderResultLocation,
  renderPolicyChanges,
  renderChangelog,
  renderFrontmatter,
} from './section-renderers';
import { readJsonFile } from '../../utils/file';

// ============================================================
// Section renderer map
// ============================================================

type SectionRenderer = (result: ConfidenceEnrichedResult) => string;

const SECTION_RENDERERS: Record<ReviewSectionType, SectionRenderer> = {
  'overview': renderSpecOverview,
  'impact-summary': renderImpactSummary,
  'data-flow': renderDataFlowDiagram,
  'sequence-diagram': renderDetailedDataFlow,
  'user-process': renderUserProcess,
  'domain-analysis': renderDomainAnalysis,
  'task-list': renderTaskList,
  'planning-checks': renderPlanningChecks,
  'risks': renderRiskSection,
  'result-location': renderResultLocation,
  'policy-changes': renderPolicyChanges,
  'changelog': renderChangelog,
};

// ============================================================
// ReviewDocumentGenerator
// ============================================================

/**
 * ReviewDocumentGenerator - generates Markdown review documents
 * from analysis results.
 */
export class ReviewDocumentGenerator {
  private readonly options: Partial<ReviewGenerateOptions>;

  constructor(options?: Partial<ReviewGenerateOptions>) {
    this.options = options || {};
  }

  /**
   * Generate a review document from a ConfidenceEnrichedResult
   * @param result - The analysis result to generate from
   * @returns ReviewDocument with metadata, section results, and full markdown
   */
  generate(result: ConfidenceEnrichedResult): ReviewDocument {
    const sectionsToRender = this.resolveSections();
    const sectionResults = this.renderSections(result, sectionsToRender);
    const renderedSections = sectionResults.filter(s => s.success && s.content.length > 0);
    const sectionTypes = renderedSections.map(s => s.type);

    const metadata = this.buildMetadata(result, sectionTypes);
    const markdown = this.assembleDocument(result, sectionResults, sectionTypes);

    return {
      metadata,
      sections: sectionResults,
      markdown,
    };
  }

  /**
   * Generate a review document from a saved result JSON file
   * @param resultPath - Path to the JSON file
   * @returns ReviewDocument
   * @throws Error if file cannot be loaded or parsed
   */
  generateFromFile(resultPath: string): ReviewDocument {
    if (!fs.existsSync(resultPath)) {
      throw new Error(`\uBD84\uC11D \uACB0\uACFC \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${resultPath}`);
    }

    const result = readJsonFile<ConfidenceEnrichedResult>(resultPath);
    if (!result) {
      throw new Error(`\uBD84\uC11D \uACB0\uACFC JSON \uD30C\uC2F1 \uC2E4\uD328: ${resultPath}`);
    }

    return this.generate(result);
  }

  // ============================================================
  // Private methods
  // ============================================================

  /**
   * Resolve which sections to include based on options
   */
  private resolveSections(): ReviewSectionType[] {
    if (this.options.includeSections && this.options.includeSections.length > 0) {
      return this.options.includeSections;
    }
    // Default: all sections in order
    return [...SECTION_ORDER];
  }

  /**
   * Render all sections and collect results
   */
  private renderSections(
    result: ConfidenceEnrichedResult,
    sections: ReviewSectionType[],
  ): SectionRenderResult[] {
    const results: SectionRenderResult[] = [];

    for (const sectionType of sections) {
      const renderer = SECTION_RENDERERS[sectionType];
      if (!renderer) {
        results.push({
          type: sectionType,
          content: '',
          success: false,
          skipReason: `\uC54C \uC218 \uC5C6\uB294 \uC139\uC158: ${sectionType}`,
        });
        continue;
      }

      try {
        const content = renderer(result);

        if (content.length === 0) {
          // Conditional section with no data
          const isPhaseB = PHASE_B_SECTIONS.includes(sectionType);
          const isRequired = REQUIRED_SECTIONS.includes(sectionType);
          const reason = isPhaseB
            ? 'Phase B\uC5D0\uC11C \uC790\uB3D9 \uC0DD\uC131 \uC608\uC815'
            : isRequired
              ? '\uB370\uC774\uD130 \uC5C6\uC74C'
              : '\uB370\uC774\uD130 \uC5C6\uC74C';

          results.push({
            type: sectionType,
            content: '',
            success: false,
            skipReason: reason,
          });
        } else {
          results.push({
            type: sectionType,
            content,
            success: true,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          type: sectionType,
          content: '',
          success: false,
          skipReason: `\uB80C\uB354\uB9C1 \uC624\uB958: ${msg}`,
        });
      }
    }

    return results;
  }

  /**
   * Build review metadata
   */
  private buildMetadata(
    result: ConfidenceEnrichedResult,
    renderedSections: ReviewSectionType[],
  ): ReviewMetadata {
    return {
      generatedBy: 'KIC (Kurly Impact Checker) v1.0',
      generatedAt: new Date().toISOString(),
      projectId: this.options.projectId || '',
      analysisId: result.analysisId,
      specTitle: result.specTitle,
      totalScore: result.totalScore,
      grade: result.grade,
      taskCount: result.tasks.length,
      sections: renderedSections,
    };
  }

  /**
   * Build table of contents
   */
  private buildToc(sectionResults: SectionRenderResult[]): string {
    const parts: string[] = [];
    parts.push('## \uBAA9\uCC28\n');

    for (const sr of sectionResults) {
      const name = SECTION_NAMES[sr.type];
      if (sr.success && sr.content.length > 0) {
        parts.push(`- [${name}](#${this.slugify(name)})`);
      } else {
        parts.push(`- ~~${name}~~ *(${sr.skipReason || 'SKIP'})*`);
      }
    }
    parts.push('');
    return parts.join('\n');
  }

  /**
   * Assemble the final markdown document
   */
  private assembleDocument(
    result: ConfidenceEnrichedResult,
    sectionResults: SectionRenderResult[],
    renderedSectionTypes: ReviewSectionType[],
  ): string {
    const parts: string[] = [];

    // YAML frontmatter
    parts.push(renderFrontmatter(result, renderedSectionTypes));

    // Title
    parts.push(`# ${result.specTitle} - \uAE30\uD68D \uAC80\uD1A0 \uACB0\uACFC\uC11C\n`);

    // Subtitle with metadata
    parts.push(`> **\uC791\uC131\uC77C**: ${new Date().toISOString().substring(0, 10)}`);
    parts.push(`> **\uBD84\uC11D \uB3C4\uAD6C**: KIC (Kurly Impact Checker) v1.0`);
    parts.push(`> **\uBD84\uC11D \uB300\uC0C1**: ${result.specTitle}\n`);

    parts.push('---\n');

    // Table of contents
    parts.push(this.buildToc(sectionResults));

    parts.push('---\n');

    // Sections
    for (const sr of sectionResults) {
      if (sr.success && sr.content.length > 0) {
        parts.push(sr.content);
        parts.push('---\n');
      }
    }

    return parts.join('\n');
  }

  /**
   * Simple slug generation for TOC links
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u3131-\uD79D-]/g, '');
  }
}
