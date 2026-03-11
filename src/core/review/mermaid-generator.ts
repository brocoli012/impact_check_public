/**
 * @module core/review/mermaid-generator
 * @description Mermaid diagram auto-generator from analysis data (REQ-018-B1)
 *
 * Converts DataFlowChange[] and ProcessChange[] from analysis results
 * into Mermaid flowchart and sequence diagram code blocks.
 *
 * Reference format: ~/.impact/docs/logistics-product-phase1-review.md
 */

import { DataFlowChange, ProcessChange } from '../../types/analysis';
import {
  NodeColorKey,
  generateClassDefBlock,
  AUTO_GENERATED_NOTICE,
} from './mermaid-styles';

// ============================================================
// MermaidGenerator
// ============================================================

/**
 * MermaidGenerator - generates Mermaid diagram code from analysis data.
 *
 * Supports:
 * - Data flow diagrams (flowchart LR) from DataFlowChange[]
 * - Sequence diagrams from ProcessChange[]
 * - Process flowcharts (flowchart TD) from ProcessChange[]
 */
export class MermaidGenerator {
  private nodeCounter: number = 0;

  /**
   * Generate a data flow diagram (flowchart LR) from DataFlowChange[].
   *
   * Creates AS-IS and TO-BE flowcharts showing how data flow changes
   * between systems before and after the spec is applied.
   *
   * @param dataFlowChanges - Array of data flow changes
   * @returns Markdown string containing Mermaid flowchart code blocks
   */
  generateDataFlowDiagram(dataFlowChanges: DataFlowChange[]): string {
    if (!dataFlowChanges || dataFlowChanges.length === 0) {
      return '';
    }

    this.nodeCounter = 0;
    const parts: string[] = [];

    parts.push(AUTO_GENERATED_NOTICE);

    // AS-IS diagram
    parts.push('### AS-IS: 현재 데이터 흐름\n');
    parts.push(this.buildDataFlowChart(dataFlowChanges, 'before'));
    parts.push('');

    // TO-BE diagram
    parts.push('### TO-BE: 변경 후 데이터 흐름\n');
    parts.push(this.buildDataFlowChart(dataFlowChanges, 'after'));
    parts.push('');

    // Summary table
    parts.push('### 데이터 흐름 변경 요약\n');
    parts.push('| 영역 | 변경 전 | 변경 후 | 설명 |');
    parts.push('|:-----|:-------|:-------|:-----|');
    for (const change of dataFlowChanges) {
      parts.push(`| ${change.area} | ${change.before} | ${change.after} | ${change.description} |`);
    }
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Generate a sequence diagram from ProcessChange[].
   *
   * Shows the before/after process steps as a sequence diagram,
   * highlighting changed steps.
   *
   * @param processChanges - Array of process changes
   * @returns Markdown string containing Mermaid sequence diagram code blocks
   */
  generateSequenceDiagram(processChanges: ProcessChange[]): string {
    if (!processChanges || processChanges.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push(AUTO_GENERATED_NOTICE);

    for (const proc of processChanges) {
      parts.push(`### ${proc.processName}\n`);
      parts.push(this.buildSequenceDiagram(proc));
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Generate a process flowchart (flowchart TD) from ProcessChange[].
   *
   * Creates a user-perspective flow diagram showing the process steps
   * and highlighting which steps have changed.
   *
   * @param processChanges - Array of process changes
   * @returns Markdown string containing Mermaid flowchart TD code blocks
   */
  generateProcessFlowchart(processChanges: ProcessChange[]): string {
    if (!processChanges || processChanges.length === 0) {
      return '';
    }

    this.nodeCounter = 0;
    const parts: string[] = [];
    parts.push(AUTO_GENERATED_NOTICE);

    for (const proc of processChanges) {
      parts.push(`### ${proc.processName}\n`);
      parts.push(this.buildProcessFlowchart(proc));
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Sanitize text for use as a Mermaid node ID.
   *
   * - Replaces spaces and special characters with underscores
   * - Korean characters are allowed in labels (wrapped in quotes) but IDs use only safe chars
   * - Ensures the ID starts with a letter
   *
   * @param text - Raw text to sanitize
   * @returns Safe Mermaid node ID string
   */
  sanitizeMermaidId(text: string): string {
    // Replace non-alphanumeric, non-underscore with underscore
    let id = text
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Ensure starts with a letter
    if (!id || !/^[a-zA-Z]/.test(id)) {
      id = 'N_' + id;
    }

    // Limit length
    if (id.length > 40) {
      id = id.substring(0, 40);
    }

    return id;
  }

  /**
   * Wrap content in a Mermaid code block.
   *
   * @param content - Mermaid diagram content (without the code fence)
   * @returns Content wrapped in ```mermaid ... ``` code block
   */
  wrapInMermaidBlock(content: string): string {
    return '```mermaid\n' + content + '\n```';
  }

  // ============================================================
  // Private: Data Flow Diagram builders
  // ============================================================

  /**
   * Build a single data flow flowchart (AS-IS or TO-BE).
   */
  private buildDataFlowChart(
    changes: DataFlowChange[],
    mode: 'before' | 'after',
  ): string {
    const lines: string[] = [];
    lines.push('flowchart LR');

    const nodeIds = new Map<string, string>();
    const edges: string[] = [];
    const usedColors = new Set<NodeColorKey>();

    for (const change of changes) {
      const flowText = mode === 'before' ? change.before : change.after;
      const flowParts = this.parseFlowText(flowText);

      // Create nodes and edges from the parsed flow
      let prevNodeId: string | null = null;
      for (let i = 0; i < flowParts.length; i++) {
        const part = flowParts[i];
        const nodeId = this.getOrCreateNodeId(part.name, nodeIds);
        const colorKey = this.inferNodeColor(part.name, mode === 'after' && i > 0);
        usedColors.add(colorKey);

        // Node declaration with label
        const label = this.escapeLabel(part.name);
        if (!lines.some(l => l.includes(`${nodeId}["`))) {
          lines.push(`    ${nodeId}["${label}"]:::${colorKey}`);
        }

        // Edge from previous node
        if (prevNodeId) {
          const edgeLabel = part.label ? `|"${this.escapeLabel(part.label)}"|` : '';
          if (mode === 'after') {
            edges.push(`    ${prevNodeId} ==${edgeLabel}> ${nodeId}`);
          } else {
            edges.push(`    ${prevNodeId} --${edgeLabel}> ${nodeId}`);
          }
        }

        prevNodeId = nodeId;
      }
    }

    // Add edges
    lines.push('');
    for (const edge of edges) {
      if (!lines.includes(edge)) {
        lines.push(edge);
      }
    }

    // Add classDef declarations
    lines.push('');
    const colorKeys = Array.from(usedColors);
    lines.push(generateClassDefBlock(colorKeys));

    return this.wrapInMermaidBlock(lines.join('\n'));
  }

  /**
   * Parse flow text description into structured parts.
   * Handles formats like "A -> B -> C" or "System1 -> (Kafka) -> System2"
   */
  private parseFlowText(text: string): Array<{ name: string; label?: string }> {
    // Split by arrow patterns (-> or →)
    const segments = text.split(/\s*(?:->|→|-->)\s*/);
    const parts: Array<{ name: string; label?: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) continue;

      // Check if this segment looks like a label in parentheses
      const parenMatch = segment.match(/^\((.+)\)$/);
      if (parenMatch && parts.length > 0) {
        // This is a label for the next edge, attach to previous node
        parts[parts.length - 1].label = parenMatch[1];
      } else {
        parts.push({ name: segment });
      }
    }

    // If no arrows found, treat the whole text as a single node
    if (parts.length === 0 && text.trim()) {
      parts.push({ name: text.trim() });
    }

    return parts;
  }

  /**
   * Get or create a unique node ID for a given name.
   */
  private getOrCreateNodeId(name: string, nodeIds: Map<string, string>): string {
    const key = name.toLowerCase().trim();
    if (nodeIds.has(key)) {
      return nodeIds.get(key)!;
    }
    const id = this.sanitizeMermaidId(name) + '_' + (this.nodeCounter++);
    nodeIds.set(key, id);
    return id;
  }

  /**
   * Infer node color based on the node name.
   */
  private inferNodeColor(name: string, isChanged: boolean): NodeColorKey {
    const lower = name.toLowerCase();

    if (lower.includes('db') || lower.includes('database') || lower.includes('저장')) {
      return 'yellow';
    }
    if (lower.includes('kafka') || lower.includes('topic') || lower.includes('queue') || lower.includes('토픽')) {
      return 'mint';
    }
    if (lower.includes('api') || lower.includes('서버') || lower.includes('service') || lower.includes('controller')) {
      return 'blue';
    }
    if (lower.includes('front') || lower.includes('ui') || lower.includes('화면') || lower.includes('포털')) {
      return isChanged ? 'orange' : 'green';
    }
    if (lower.includes('완료') || lower.includes('결과') || lower.includes('complete')) {
      return 'pink';
    }
    if (lower.includes('new') || lower.includes('신규') || lower.includes('추가')) {
      return 'mint';
    }
    if (lower.includes('readonly') || lower.includes('읽기')) {
      return 'purple';
    }

    return isChanged ? 'orange' : 'green';
  }

  // ============================================================
  // Private: Sequence Diagram builders
  // ============================================================

  /**
   * Build a sequence diagram for a single ProcessChange.
   */
  private buildSequenceDiagram(proc: ProcessChange): string {
    const lines: string[] = [];
    lines.push('sequenceDiagram');

    // Extract unique actors/participants from process steps
    const beforeActors = this.extractActorsFromSteps(proc.before);
    const afterActors = this.extractActorsFromSteps(proc.after);
    const allActors = this.mergeActors(beforeActors, afterActors);

    // Declare participants
    for (const actor of allActors) {
      const sanitized = this.escapeLabel(actor);
      lines.push(`    participant ${this.sanitizeMermaidId(actor)} as ${sanitized}`);
    }

    // Before flow
    if (proc.before.length > 0) {
      lines.push('');
      lines.push('    rect rgb(240, 248, 255)');
      lines.push('    Note over ' + this.sanitizeMermaidId(allActors[0]) + ': 변경 전 흐름');

      for (let i = 0; i < proc.before.length; i++) {
        const step = proc.before[i];
        const isChanged = proc.changedSteps.includes(i);
        const parsedStep = this.parseSequenceStep(step, allActors);

        if (parsedStep.from && parsedStep.to) {
          const fromId = this.sanitizeMermaidId(parsedStep.from);
          const toId = this.sanitizeMermaidId(parsedStep.to);
          const label = this.escapeLabel(parsedStep.action);
          const marker = isChanged ? ' [CHANGED]' : '';
          lines.push(`    ${fromId}->>` + `${toId}: ${label}${marker}`);
        } else {
          // Note if we cannot parse the step
          const actorId = this.sanitizeMermaidId(allActors[0]);
          const marker = isChanged ? ' [CHANGED]' : '';
          lines.push(`    Note over ${actorId}: ${this.escapeLabel(step)}${marker}`);
        }
      }
      lines.push('    end');
    }

    // After flow
    if (proc.after.length > 0) {
      lines.push('');
      lines.push('    rect rgb(255, 248, 240)');
      lines.push('    Note over ' + this.sanitizeMermaidId(allActors[0]) + ': 변경 후 흐름');

      for (let i = 0; i < proc.after.length; i++) {
        const step = proc.after[i];
        const isChanged = proc.changedSteps.includes(i);
        const parsedStep = this.parseSequenceStep(step, allActors);

        if (parsedStep.from && parsedStep.to) {
          const fromId = this.sanitizeMermaidId(parsedStep.from);
          const toId = this.sanitizeMermaidId(parsedStep.to);
          const label = this.escapeLabel(parsedStep.action);
          const marker = isChanged ? ' [CHANGED]' : '';
          lines.push(`    ${fromId}->>${toId}: ${label}${marker}`);
        } else {
          const actorId = this.sanitizeMermaidId(allActors[0]);
          const marker = isChanged ? ' [CHANGED]' : '';
          lines.push(`    Note over ${actorId}: ${this.escapeLabel(step)}${marker}`);
        }
      }
      lines.push('    end');
    }

    return this.wrapInMermaidBlock(lines.join('\n'));
  }

  /**
   * Extract actor/system names from process step descriptions.
   * Looks for patterns like "SystemA에서 SystemB로" or "SystemA -> SystemB"
   */
  private extractActorsFromSteps(steps: string[]): string[] {
    const actors = new Set<string>();

    for (const step of steps) {
      // Pattern: "A에서 B로" (Korean)
      const koreanMatch = step.match(/(.+?)(?:에서|로부터)\s+(.+?)(?:로|에|으로)\s/);
      if (koreanMatch) {
        actors.add(koreanMatch[1].trim());
        actors.add(koreanMatch[2].trim());
        continue;
      }

      // Pattern: "A -> B" or "A --> B"
      const arrowMatch = step.match(/(.+?)\s*(?:->|-->|→)\s*(.+?)(?:\s|$)/);
      if (arrowMatch) {
        actors.add(arrowMatch[1].trim());
        actors.add(arrowMatch[2].trim());
        continue;
      }

      // Fallback: extract first meaningful noun-like segment
      const words = step.split(/\s+/);
      if (words.length > 0) {
        actors.add(words[0]);
      }
    }

    return Array.from(actors).filter(a => a.length > 0);
  }

  /**
   * Merge two actor lists, preserving order and removing duplicates.
   */
  private mergeActors(before: string[], after: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const actor of [...before, ...after]) {
      const key = actor.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(actor);
      }
    }

    // Ensure at least 2 actors for a meaningful diagram
    if (result.length === 0) {
      result.push('System');
    }
    if (result.length === 1) {
      result.push('Target');
    }

    return result;
  }

  /**
   * Parse a single process step into sequence diagram parts.
   */
  private parseSequenceStep(
    step: string,
    knownActors: string[],
  ): { from?: string; to?: string; action: string } {
    // Try to match "A -> B: action" pattern
    const arrowMatch = step.match(/(.+?)\s*(?:->|-->|→)\s*(.+?)(?::\s*(.+))?$/);
    if (arrowMatch) {
      return {
        from: this.findClosestActor(arrowMatch[1].trim(), knownActors),
        to: this.findClosestActor(arrowMatch[2].trim(), knownActors),
        action: arrowMatch[3]?.trim() || step,
      };
    }

    // Try to match "A에서 B로 action" pattern
    const koreanMatch = step.match(/(.+?)(?:에서|로부터)\s+(.+?)(?:로|에|으로)\s+(.+)/);
    if (koreanMatch) {
      return {
        from: this.findClosestActor(koreanMatch[1].trim(), knownActors),
        to: this.findClosestActor(koreanMatch[2].trim(), knownActors),
        action: koreanMatch[3]?.trim() || step,
      };
    }

    // Fallback: use the step text as-is with first two actors
    if (knownActors.length >= 2) {
      return {
        from: knownActors[0],
        to: knownActors[1],
        action: step,
      };
    }

    return { action: step };
  }

  /**
   * Find the closest matching actor from known actors.
   */
  private findClosestActor(text: string, knownActors: string[]): string {
    const lower = text.toLowerCase();
    // Exact match
    for (const actor of knownActors) {
      if (actor.toLowerCase() === lower) return actor;
    }
    // Partial match
    for (const actor of knownActors) {
      if (lower.includes(actor.toLowerCase()) || actor.toLowerCase().includes(lower)) {
        return actor;
      }
    }
    return text;
  }

  // ============================================================
  // Private: Process Flowchart builders
  // ============================================================

  /**
   * Build a process flowchart (flowchart TD) for a single ProcessChange.
   */
  private buildProcessFlowchart(proc: ProcessChange): string {
    const lines: string[] = [];
    lines.push('flowchart TD');

    const usedColors = new Set<NodeColorKey>();

    // Start node
    const startId = `start_${this.nodeCounter++}`;
    lines.push(`    ${startId}(["시작: ${this.escapeLabel(proc.processName)}"]):::purple`);
    usedColors.add('purple');

    // After steps (TO-BE flow)
    let prevId = startId;
    const stepIds: string[] = [];

    for (let i = 0; i < proc.after.length; i++) {
      const step = proc.after[i];
      const isChanged = proc.changedSteps.includes(i);
      const nodeId = `step_${this.nodeCounter++}`;
      const color: NodeColorKey = isChanged ? 'orange' : 'green';
      usedColors.add(color);

      const label = this.escapeLabel(step);
      const changeMarker = isChanged ? '<br/>CHANGED' : '';
      lines.push(`    ${nodeId}["${label}${changeMarker}"]:::${color}`);
      lines.push(`    ${prevId} --> ${nodeId}`);

      prevId = nodeId;
      stepIds.push(nodeId);
    }

    // End node
    const endId = `end_${this.nodeCounter++}`;
    lines.push(`    ${endId}(["완료"]):::pink`);
    lines.push(`    ${prevId} --> ${endId}`);
    usedColors.add('pink');

    // classDef
    lines.push('');
    lines.push(generateClassDefBlock(Array.from(usedColors)));

    return this.wrapInMermaidBlock(lines.join('\n'));
  }

  // ============================================================
  // Private: Utilities
  // ============================================================

  /**
   * Escape text for safe use in Mermaid labels.
   * Replaces characters that could break Mermaid syntax.
   */
  private escapeLabel(text: string): string {
    return text
      .replace(/"/g, "'")
      .replace(/\n/g, '<br/>')
      .replace(/[[\]{}]/g, '')
      .replace(/#/g, '')
      .trim();
  }
}
