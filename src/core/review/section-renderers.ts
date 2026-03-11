/**
 * @module core/review/section-renderers
 * @description Section renderer functions for review document generation (REQ-018-A1)
 *
 * Each function takes a ConfidenceEnrichedResult and returns a markdown string.
 * Returns empty string if the section has no data to render.
 */

import { ConfidenceEnrichedResult } from '../../types/analysis';
import { renderRisksSection } from './risk-renderer';
import { MermaidGenerator } from './mermaid-generator';

// ============================================================
// Helper utilities
// ============================================================

/**
 * Generate ASCII bar chart for impact scores
 */
function renderScoreBar(label: string, score: number, grade: string, width: number = 50): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const paddedLabel = label.padEnd(12);
  return `${paddedLabel}${bar}  ${score}\uC810 (${grade})`;
}

// ============================================================
// 1. renderSpecOverview - \uAE30\uD68D \uAC1C\uC694
// ============================================================

/**
 * Render spec overview section from parsedSpec
 */
export function renderSpecOverview(result: ConfidenceEnrichedResult): string {
  const parts: string[] = [];
  parts.push('## 1. \uAE30\uD68D \uAC1C\uC694\n');

  const spec = result.parsedSpec;
  if (!spec) {
    parts.push('> \uAE30\uD68D\uC11C \uC815\uBCF4\uAC00 \uBD84\uC11D \uACB0\uACFC\uC5D0 \uD3EC\uD568\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.\n');
    parts.push(`### 1.1 \uBAA9\uC801\n\n${result.specTitle}\n`);
    return parts.join('\n');
  }

  // 1.1 Purpose
  parts.push(`### 1.1 \uBAA9\uC801\n\n${spec.title}\n`);

  // 1.2 Requirements
  if (spec.requirements.length > 0) {
    parts.push('### 1.2 \uC694\uAD6C\uC0AC\uD56D\n');
    parts.push('| ID | \uC694\uAD6C\uC0AC\uD56D | \uC6B0\uC120\uC21C\uC704 | \uC124\uBA85 |');
    parts.push('|:---|:------|:------:|:-----|');
    for (const req of spec.requirements) {
      parts.push(`| ${req.id} | ${req.name} | ${req.priority} | ${req.description} |`);
    }
    parts.push('');
  }

  // 1.3 Features
  if (spec.features.length > 0) {
    parts.push('### 1.3 \uAE30\uB2A5 \uBAA9\uB85D\n');
    parts.push('| ID | \uAE30\uB2A5\uBA85 | \uB300\uC0C1 \uD654\uBA74 | \uC791\uC5C5 \uC720\uD615 |');
    parts.push('|:---|:------|:---------|:------:|');
    for (const feat of spec.features) {
      parts.push(`| ${feat.id} | ${feat.name} | ${feat.targetScreen} | ${feat.actionType} |`);
    }
    parts.push('');
  }

  // 1.4 Target screens
  if (spec.targetScreens.length > 0) {
    parts.push('### 1.4 \uB300\uC0C1 \uBC94\uC704\n');
    for (const screen of spec.targetScreens) {
      parts.push(`- ${screen}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 2. renderImpactSummary - \uC601\uD5A5 \uBC94\uC704 \uC694\uC57D
// ============================================================

/**
 * Render impact summary section from screenScores/totalScore/grade
 */
export function renderImpactSummary(result: ConfidenceEnrichedResult): string {
  const parts: string[] = [];
  parts.push('## 2. \uC601\uD5A5 \uBC94\uC704 \uBD84\uC11D \uC694\uC57D\n');

  // Summary table
  parts.push('| \uD56D\uBAA9 | \uAC12 |');
  parts.push('|:-----|:---|');
  parts.push(`| \uC601\uD5A5\uB3C4 \uC810\uC218 | **${result.totalScore}** |`);
  parts.push(`| \uB4F1\uAE09 | ${result.grade} |`);
  parts.push(`| \uD0DC\uC2A4\uD06C \uC218 | ${result.tasks.length}\uAC74 |`);
  parts.push(`| \uC601\uD5A5 \uD654\uBA74 \uC218 | ${result.affectedScreens.length}\uAC1C |`);
  parts.push('');

  // Score distribution chart
  if (result.screenScores && result.screenScores.length > 0) {
    parts.push('### \uC601\uD5A5\uB3C4 \uC810\uC218 \uBD84\uD3EC\n');
    parts.push('```');
    for (const ss of result.screenScores) {
      parts.push(renderScoreBar(ss.screenName, ss.screenScore, ss.grade));
    }
    parts.push('            0        20        40        60        80       100');
    parts.push('```');
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 3. renderDataFlowDiagram - \uB370\uC774\uD130 \uD750\uB984\uB3C4
// ============================================================

/**
 * Render data flow diagram section with Mermaid flowcharts (REQ-018-B1)
 */
export function renderDataFlowDiagram(result: ConfidenceEnrichedResult): string {
  const dataFlowChanges = result.analysisSummary?.dataFlowChanges;
  if (!dataFlowChanges || dataFlowChanges.length === 0) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## 3. \uB370\uC774\uD130 \uD750\uB984\uB3C4\n');

  // Generate Mermaid diagrams from data flow changes
  const mermaid = new MermaidGenerator();
  const diagramContent = mermaid.generateDataFlowDiagram(dataFlowChanges);
  if (diagramContent) {
    parts.push(diagramContent);
  } else {
    // Fallback: text-based summary if generation fails
    parts.push('### \uB370\uC774\uD130 \uD750\uB984 \uBCC0\uACBD \uC694\uC57D\n');
    parts.push('| \uC601\uC5ED | \uBCC0\uACBD \uC804 | \uBCC0\uACBD \uD6C4 | \uC124\uBA85 |');
    parts.push('|:-----|:-------|:-------|:-----|');
    for (const change of dataFlowChanges) {
      parts.push(`| ${change.area} | ${change.before} | ${change.after} | ${change.description} |`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 4. renderDetailedDataFlow - \uC0C1\uC138 \uB370\uC774\uD130 \uD750\uB984
// ============================================================

/**
 * Render detailed data flow with Mermaid sequence diagrams (REQ-018-B1)
 */
export function renderDetailedDataFlow(result: ConfidenceEnrichedResult): string {
  const processChanges = result.analysisSummary?.processChanges;
  if (!processChanges || processChanges.length === 0) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## 4. \uC0C1\uC138 \uB370\uC774\uD130 \uD750\uB984 (\uC2DC\uD000\uC2A4)\n');

  // Generate Mermaid sequence diagrams
  const mermaid = new MermaidGenerator();
  const diagramContent = mermaid.generateSequenceDiagram(processChanges);
  if (diagramContent) {
    parts.push(diagramContent);
  }

  // Always include text-based before/after listing as supplementary reference
  parts.push('### \uD504\uB85C\uC138\uC2A4 \uBCC0\uACBD \uC0C1\uC138\n');
  for (const proc of processChanges) {
    parts.push(`#### ${proc.processName}\n`);

    parts.push('**\uBCC0\uACBD \uC804:**');
    for (let i = 0; i < proc.before.length; i++) {
      const marker = proc.changedSteps.includes(i) ? ' [CHANGED]' : '';
      parts.push(`${i + 1}. ${proc.before[i]}${marker}`);
    }
    parts.push('');

    parts.push('**\uBCC0\uACBD \uD6C4:**');
    for (let i = 0; i < proc.after.length; i++) {
      const marker = proc.changedSteps.includes(i) ? ' [CHANGED]' : '';
      parts.push(`${i + 1}. ${proc.after[i]}${marker}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 5. renderUserProcess - \uC0AC\uC6A9\uC790 \uD504\uB85C\uC138\uC2A4
// ============================================================

/**
 * Render user process section with Mermaid process flowcharts (REQ-018-B1)
 */
export function renderUserProcess(result: ConfidenceEnrichedResult): string {
  const processChanges = result.analysisSummary?.processChanges;
  if (!processChanges || processChanges.length === 0) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## 5. \uC0AC\uC6A9\uC790 \uC774\uC6A9 \uD504\uB85C\uC138\uC2A4\n');

  // Generate Mermaid process flowcharts
  const mermaid = new MermaidGenerator();
  const diagramContent = mermaid.generateProcessFlowchart(processChanges);
  if (diagramContent) {
    parts.push(diagramContent);
  }

  // Text summary as supplementary reference
  parts.push(`\uCD1D ${processChanges.length}\uAC74\uC758 \uD504\uB85C\uC138\uC2A4 \uBCC0\uACBD:\n`);
  for (const proc of processChanges) {
    parts.push(`- **${proc.processName}**: ${proc.changedSteps.length}\uAC1C \uB2E8\uACC4 \uBCC0\uACBD`);
  }
  parts.push('');

  return parts.join('\n');
}

// ============================================================
// 6. renderDomainAnalysis - \uB3C4\uBA54\uC778 \uD2B9\uD654 \uBD84\uC11D (\uC870\uAC74\uBD80)
// ============================================================

/**
 * Render domain-specific analysis section (conditional: only if keyFindings >= 2)
 */
export function renderDomainAnalysis(result: ConfidenceEnrichedResult): string {
  const summary = result.analysisSummary;
  if (!summary) return '';

  const keyFindings = summary.keyFindings || [];
  if (keyFindings.length < 2) return '';

  const parts: string[] = [];
  parts.push('## 6. \uB3C4\uBA54\uC778 \uD2B9\uD654 \uBD84\uC11D\n');

  if (summary.overview) {
    parts.push(`${summary.overview}\n`);
  }

  parts.push('### \uC8FC\uC694 \uBC1C\uACAC \uC0AC\uD56D\n');
  for (const finding of keyFindings) {
    parts.push(`- ${finding}`);
  }
  parts.push('');

  if (summary.currentProblems && summary.currentProblems.length > 0) {
    parts.push('### \uD604\uC7AC \uC2DC\uC2A4\uD15C \uBB38\uC81C\uC810\n');
    for (const problem of summary.currentProblems) {
      parts.push(`- ${problem}`);
    }
    parts.push('');
  }

  parts.push('> *\uC774 \uC139\uC158\uC740 \uBD84\uC11D \uB370\uC774\uD130\uC5D0\uC11C \uC790\uB3D9 \uC0DD\uC131\uB41C \uCD08\uC548\uC785\uB2C8\uB2E4. AI \uBCF4\uC644\uC774 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.*\n');

  return parts.join('\n');
}

// ============================================================
// 7. renderTaskList - \uD0DC\uC2A4\uD06C \uBAA9\uB85D
// ============================================================

/**
 * Render task list as markdown table
 */
export function renderTaskList(result: ConfidenceEnrichedResult): string {
  const parts: string[] = [];
  parts.push('## 7. \uC804\uCCB4 \uD0DC\uC2A4\uD06C \uBAA9\uB85D\n');

  if (result.tasks.length === 0) {
    parts.push('\uBD84\uC11D\uB41C \uD0DC\uC2A4\uD06C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.\n');
    return parts.join('\n');
  }

  parts.push('| # | ID | \uD0DC\uC2A4\uD06C | \uC720\uD615 | \uC791\uC5C5 \uBD84\uB958 |');
  parts.push('|:-:|:---|:------|:---:|:------:|');

  for (let i = 0; i < result.tasks.length; i++) {
    const task = result.tasks[i];
    parts.push(`| ${i + 1} | ${task.id} | ${task.title} | ${task.type} | ${task.actionType} |`);
  }
  parts.push('');

  return parts.join('\n');
}

// ============================================================
// 8. renderPlanningChecks - \uAE30\uD68D \uD655\uC778 \uC0AC\uD56D
// ============================================================

/**
 * Render planning checks section (conditional: only if planningChecks exist)
 */
export function renderPlanningChecks(result: ConfidenceEnrichedResult): string {
  if (!result.planningChecks || result.planningChecks.length === 0) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## 8. \uAE30\uD68D \uD655\uC778 \uD544\uC694 \uC0AC\uD56D\n');

  // Group by priority
  const highPriority = result.planningChecks.filter(c => c.priority === 'high');
  const mediumPriority = result.planningChecks.filter(c => c.priority === 'medium');
  const lowPriority = result.planningChecks.filter(c => c.priority === 'low');

  if (highPriority.length > 0) {
    parts.push('### \uC6B0\uC120\uC21C\uC704 High (\uC989\uC2DC \uD655\uC778 \uD544\uC694)\n');
    parts.push('| # | ID | \uB0B4\uC6A9 | \uC0C1\uD0DC |');
    parts.push('|:-:|:---|:-----|:----:|');
    for (let i = 0; i < highPriority.length; i++) {
      const check = highPriority[i];
      parts.push(`| ${i + 1} | ${check.id} | ${check.content} | ${check.status} |`);
    }
    parts.push('');
  }

  if (mediumPriority.length > 0) {
    parts.push('### \uC6B0\uC120\uC21C\uC704 Medium (\uAC1C\uBC1C \uC804 \uD655\uC778)\n');
    parts.push('| # | ID | \uB0B4\uC6A9 | \uC0C1\uD0DC |');
    parts.push('|:-:|:---|:-----|:----:|');
    for (let i = 0; i < mediumPriority.length; i++) {
      const check = mediumPriority[i];
      parts.push(`| ${i + 1} | ${check.id} | ${check.content} | ${check.status} |`);
    }
    parts.push('');
  }

  if (lowPriority.length > 0) {
    parts.push('### \uC6B0\uC120\uC21C\uC704 Low\n');
    parts.push('| # | ID | \uB0B4\uC6A9 | \uC0C1\uD0DC |');
    parts.push('|:-:|:---|:-----|:----:|');
    for (let i = 0; i < lowPriority.length; i++) {
      const check = lowPriority[i];
      parts.push(`| ${i + 1} | ${check.id} | ${check.content} | ${check.status} |`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 9. renderRiskSection - \uB9AC\uC2A4\uD06C (delegates to risk-renderer)
// ============================================================

/**
 * Render risks section using the risk-renderer module
 */
export function renderRiskSection(result: ConfidenceEnrichedResult): string {
  const riskAreas = result.analysisSummary?.riskAreas || [];
  return renderRisksSection(riskAreas, 9);
}

// ============================================================
// 10. renderResultLocation - \uBD84\uC11D \uACB0\uACFC \uC800\uC7A5 \uC704\uCE58
// ============================================================

/**
 * Render result location section
 */
export function renderResultLocation(result: ConfidenceEnrichedResult): string {
  const parts: string[] = [];
  parts.push('## 10. \uBD84\uC11D \uACB0\uACFC \uC800\uC7A5 \uC704\uCE58\n');

  parts.push('| \uD56D\uBAA9 | \uAC12 |');
  parts.push('|:-----|:---|');
  parts.push(`| \uBD84\uC11D ID | \`${result.analysisId}\` |`);
  parts.push(`| \uBD84\uC11D \uC2DC\uAC01 | ${result.analyzedAt} |`);
  parts.push(`| \uBD84\uC11D \uBC29\uBC95 | ${result.analysisMethod} |`);
  parts.push('');

  return parts.join('\n');
}

// ============================================================
// 11. renderPolicyChanges - \uC815\uCC45 \uBCC0\uACBD \uC0AC\uD56D (\uC870\uAC74\uBD80)
// ============================================================

/**
 * Render policy changes section (conditional: only if policyChanges or policyWarnings exist)
 */
export function renderPolicyChanges(result: ConfidenceEnrichedResult): string {
  const hasChanges = result.policyChanges && result.policyChanges.length > 0;
  const hasWarnings = result.policyWarnings && result.policyWarnings.length > 0;

  if (!hasChanges && !hasWarnings) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## 11. \uC815\uCC45 \uBCC0\uACBD \uC0AC\uD56D\n');

  if (hasChanges) {
    parts.push('### \uC815\uCC45 \uBCC0\uACBD\n');
    parts.push('| ID | \uC815\uCC45\uBA85 | \uBCC0\uACBD \uC720\uD615 | \uC124\uBA85 | \uB9AC\uBDF0 \uD544\uC694 |');
    parts.push('|:---|:------|:------:|:-----|:------:|');
    for (const change of result.policyChanges) {
      const review = change.requiresReview ? '\uC608' : '\uC544\uB2C8\uC624';
      parts.push(`| ${change.id} | ${change.policyName} | ${change.changeType} | ${change.description} | ${review} |`);
    }
    parts.push('');
  }

  if (hasWarnings) {
    parts.push('### \uC815\uCC45 \uACBD\uACE0\n');
    parts.push('| ID | \uC815\uCC45\uBA85 | \uC2EC\uAC01\uB3C4 | \uBA54\uC2DC\uC9C0 |');
    parts.push('|:---|:------|:------:|:------|');
    for (const warning of result.policyWarnings) {
      parts.push(`| ${warning.id} | ${warning.policyName} | ${warning.severity} | ${warning.message} |`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 12. renderChangelog - \uBCC0\uACBD \uC774\uB825
// ============================================================

/**
 * Render changelog / metadata section
 */
export function renderChangelog(result: ConfidenceEnrichedResult): string {
  const parts: string[] = [];
  parts.push('## 12. \uBCC0\uACBD \uC774\uB825\n');

  parts.push('| \uB0A0\uC9DC | \uBCC0\uACBD \uB0B4\uC6A9 |');
  parts.push('|:-----|:---------|');

  const date = result.analyzedAt
    ? result.analyzedAt.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  parts.push(`| ${date} | \uCD5C\uCD08 \uBD84\uC11D (\uC790\uB3D9 \uC0DD\uC131) - ${result.tasks.length}\uD0DC\uC2A4\uD06C, ${result.totalScore}\uC810 ${result.grade} |`);

  if (result.statusChangedAt) {
    const statusDate = result.statusChangedAt.substring(0, 10);
    parts.push(`| ${statusDate} | \uC0C1\uD0DC \uBCC0\uACBD: ${result.status || 'active'} |`);
  }

  parts.push('');

  return parts.join('\n');
}

// ============================================================
// Metadata renderer (YAML frontmatter)
// ============================================================

/**
 * Render YAML frontmatter metadata for the review document
 */
export function renderFrontmatter(result: ConfidenceEnrichedResult, sections: string[]): string {
  const parts: string[] = [];
  parts.push('---');
  parts.push('generatedBy: KIC (Kurly Impact Checker) v1.0');
  parts.push(`generatedAt: ${new Date().toISOString()}`);
  parts.push(`analysisId: ${result.analysisId}`);
  parts.push(`specTitle: ${result.specTitle}`);
  parts.push(`totalScore: ${result.totalScore}`);
  parts.push(`grade: ${result.grade}`);
  parts.push(`taskCount: ${result.tasks.length}`);
  parts.push(`sections: [${sections.join(', ')}]`);
  parts.push('---');
  parts.push('');
  return parts.join('\n');
}
