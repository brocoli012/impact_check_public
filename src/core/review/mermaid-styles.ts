/**
 * @module core/review/mermaid-styles
 * @description Mermaid diagram style constants and presets (REQ-018-B1)
 *
 * Provides consistent color schemes and style definitions for auto-generated
 * Mermaid diagrams. Based on the reference document (logistics-product-phase1-review.md).
 */

// ============================================================
// Node type color presets
// ============================================================

/**
 * Color presets for different node types in Mermaid diagrams.
 * Each preset defines fill, stroke, and text color.
 */
export const NODE_COLORS = {
  /** Green - existing system / normal flow / user action */
  green: 'fill:#C8E6C9,stroke:#66BB6A,color:#1B5E20',
  /** Blue - core system (e.g., LIP) / API */
  blue: 'fill:#BBDEFB,stroke:#42A5F5,color:#0D47A1',
  /** Purple - read-only consumer / start-end node */
  purple: 'fill:#E1BEE7,stroke:#AB47BC,color:#4A148C',
  /** Orange - changed flow / modified component */
  orange: 'fill:#FFE0B2,stroke:#FFA726,color:#E65100',
  /** Mint - new component / new flow */
  mint: 'fill:#B2DFDB,stroke:#26A69A,color:#004D40',
  /** Yellow - database / storage */
  yellow: 'fill:#FFF9C4,stroke:#FDD835,color:#F57F17',
  /** Pink - completion / result node */
  pink: 'fill:#F8BBD0,stroke:#EC407A,color:#880E4F',
  /** Red - warning / critical path */
  red: 'fill:#FFCDD2,stroke:#EF5350,color:#B71C1C',
} as const;

/** Node color key type */
export type NodeColorKey = keyof typeof NODE_COLORS;

// ============================================================
// Node type to color mapping
// ============================================================

/**
 * Default mapping from logical node types to color presets.
 * Used by MermaidGenerator to auto-assign styles.
 */
export const NODE_TYPE_COLORS: Record<string, NodeColorKey> = {
  // Screens / UI
  screen: 'green',
  frontend: 'green',
  ui: 'green',

  // APIs / Backend
  api: 'blue',
  backend: 'blue',
  service: 'blue',

  // Databases
  database: 'yellow',
  db: 'yellow',
  storage: 'yellow',

  // Messaging / Queue
  queue: 'mint',
  kafka: 'mint',
  messaging: 'mint',

  // External systems
  external: 'purple',
  readonly: 'purple',
  consumer: 'purple',

  // Changed / Modified
  changed: 'orange',
  modified: 'orange',

  // New components
  new: 'mint',

  // Completion / Result
  result: 'pink',
  completion: 'pink',

  // Warning / Critical
  warning: 'red',
  critical: 'red',
};

// ============================================================
// Edge style definitions
// ============================================================

/**
 * Edge (link) style definitions for different flow types.
 */
export const EDGE_STYLES = {
  /** Normal flow arrow */
  normal: '-->',
  /** Bold/thick flow arrow (important path) */
  thick: '==>',
  /** Dotted arrow (optional / read-only) */
  dotted: '-.->',
  /** Normal arrow with label */
  normalLabeled: (label: string): string => `-->|"${label}"|`,
  /** Thick arrow with label */
  thickLabeled: (label: string): string => `==>|"${label}"|`,
  /** Dotted arrow with label */
  dottedLabeled: (label: string): string => `-.->|"${label}"|`,
} as const;

// ============================================================
// Mermaid classDef generation
// ============================================================

/**
 * Generate classDef declarations for Mermaid diagrams.
 * @param colors - Which color presets to include (default: all)
 * @returns Array of classDef lines
 */
export function generateClassDefs(colors?: NodeColorKey[]): string[] {
  const keys = colors || (Object.keys(NODE_COLORS) as NodeColorKey[]);
  return keys.map(key => `    classDef ${key} ${NODE_COLORS[key]}`);
}

/**
 * Generate all classDef declarations as a single string block.
 * @param colors - Which color presets to include (default: all)
 * @returns Multi-line string with classDef declarations
 */
export function generateClassDefBlock(colors?: NodeColorKey[]): string {
  return generateClassDefs(colors).join('\n');
}

// ============================================================
// Mermaid diagram theme configuration
// ============================================================

/**
 * Default Mermaid theme configuration.
 * Can be embedded via %%{init: {...}}%% directive.
 */
export const MERMAID_THEME_CONFIG = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#BBDEFB',
    primaryTextColor: '#0D47A1',
    primaryBorderColor: '#42A5F5',
    lineColor: '#78909C',
    secondaryColor: '#E1BEE7',
    tertiaryColor: '#C8E6C9',
  },
} as const;

// ============================================================
// Subgraph style helpers
// ============================================================

/**
 * Generate subgraph style declarations.
 * @param subgraphId - The subgraph identifier
 * @param color - Color preset to apply
 * @returns style declaration string
 */
export function generateSubgraphStyle(subgraphId: string, color: NodeColorKey): string {
  // Subgraphs use style with fill/stroke for background
  const colorDef = NODE_COLORS[color];
  // Parse fill from the color definition, lighten it for subgraph background
  const fillMatch = colorDef.match(/fill:(#[A-Fa-f0-9]+)/);
  const strokeMatch = colorDef.match(/stroke:(#[A-Fa-f0-9]+)/);
  const textMatch = colorDef.match(/color:(#[A-Fa-f0-9]+)/);

  const fill = fillMatch ? fillMatch[1] : '#F5F5F5';
  const stroke = strokeMatch ? strokeMatch[1] : '#BDBDBD';
  const textColor = textMatch ? textMatch[1] : '#333333';

  return `    style ${subgraphId} fill:${fill},stroke:${stroke},color:${textColor}`;
}

// ============================================================
// Auto-generated diagram notice
// ============================================================

/**
 * Standard notice to prepend to auto-generated Mermaid sections.
 */
export const AUTO_GENERATED_NOTICE =
  '> 이 다이어그램은 분석 데이터에서 자동 생성된 초안입니다.\n' +
  '> 상세도 향상이 필요하면 수동으로 편집하거나 AI 보완을 요청하세요.\n';
