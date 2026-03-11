/**
 * @module tests/unit/review/mermaid-generator.test
 * @description Unit tests for MermaidGenerator (REQ-018-B1)
 */

import { MermaidGenerator } from '../../../src/core/review/mermaid-generator';
import { DataFlowChange, ProcessChange } from '../../../src/types/analysis';

describe('MermaidGenerator', () => {
  let generator: MermaidGenerator;

  beforeEach(() => {
    generator = new MermaidGenerator();
  });

  // ============================================================
  // sanitizeMermaidId
  // ============================================================

  describe('sanitizeMermaidId', () => {
    it('should replace special characters with underscores', () => {
      const result = generator.sanitizeMermaidId('hello world!');
      expect(result).toBe('hello_world');
    });

    it('should collapse multiple underscores', () => {
      const result = generator.sanitizeMermaidId('a---b___c');
      expect(result).toBe('a_b_c');
    });

    it('should prefix with N_ if starts with number', () => {
      const result = generator.sanitizeMermaidId('123abc');
      expect(result).toBe('N_123abc');
    });

    it('should handle empty string', () => {
      const result = generator.sanitizeMermaidId('');
      expect(result).toBe('N_');
    });

    it('should handle Korean characters (removes them, Korean goes in labels)', () => {
      const result = generator.sanitizeMermaidId('파트너포털');
      // Korean chars are removed since they are not alphanumeric ASCII
      expect(result).toMatch(/^N_/);
    });

    it('should truncate long strings to 40 chars', () => {
      const longStr = 'a'.repeat(60);
      const result = generator.sanitizeMermaidId(longStr);
      expect(result.length).toBeLessThanOrEqual(40);
    });

    it('should handle mixed alphanumeric and special chars', () => {
      const result = generator.sanitizeMermaidId('eSCM-API (Spring Boot)');
      expect(result).toBe('eSCM_API_Spring_Boot');
    });

    it('should strip leading and trailing underscores', () => {
      const result = generator.sanitizeMermaidId('_test_');
      expect(result).toBe('test');
    });
  });

  // ============================================================
  // wrapInMermaidBlock
  // ============================================================

  describe('wrapInMermaidBlock', () => {
    it('should wrap content in mermaid code fence', () => {
      const result = generator.wrapInMermaidBlock('flowchart LR\n    A --> B');
      expect(result).toBe('```mermaid\nflowchart LR\n    A --> B\n```');
    });

    it('should handle empty content', () => {
      const result = generator.wrapInMermaidBlock('');
      expect(result).toBe('```mermaid\n\n```');
    });
  });

  // ============================================================
  // generateDataFlowDiagram
  // ============================================================

  describe('generateDataFlowDiagram', () => {
    const sampleDataFlowChanges: DataFlowChange[] = [
      {
        area: '물류속성 수정 흐름',
        before: '파트너포털 -> Kafka -> LIP',
        after: '컬리옵스 -> LIP -> 역방향 Kafka -> eSCM',
        description: '수정 권한이 파트너포털에서 컬리옵스로 이전',
      },
    ];

    it('should return empty string for empty array', () => {
      const result = generator.generateDataFlowDiagram([]);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = generator.generateDataFlowDiagram(undefined as unknown as DataFlowChange[]);
      expect(result).toBe('');
    });

    it('should contain AS-IS and TO-BE sections', () => {
      const result = generator.generateDataFlowDiagram(sampleDataFlowChanges);
      expect(result).toContain('AS-IS');
      expect(result).toContain('TO-BE');
    });

    it('should contain mermaid code blocks', () => {
      const result = generator.generateDataFlowDiagram(sampleDataFlowChanges);
      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart LR');
    });

    it('should contain summary table', () => {
      const result = generator.generateDataFlowDiagram(sampleDataFlowChanges);
      expect(result).toContain('데이터 흐름 변경 요약');
      expect(result).toContain('물류속성 수정 흐름');
    });

    it('should contain auto-generated notice', () => {
      const result = generator.generateDataFlowDiagram(sampleDataFlowChanges);
      expect(result).toContain('자동 생성된 초안');
    });

    it('should contain classDef declarations', () => {
      const result = generator.generateDataFlowDiagram(sampleDataFlowChanges);
      expect(result).toContain('classDef');
    });

    it('should handle multiple data flow changes', () => {
      const changes: DataFlowChange[] = [
        {
          area: '흐름 A',
          before: 'SystemA -> SystemB',
          after: 'SystemA -> SystemC -> SystemB',
          description: '중간 시스템 추가',
        },
        {
          area: '흐름 B',
          before: 'DB1 -> API',
          after: 'DB1 -> Cache -> API',
          description: '캐시 레이어 추가',
        },
      ];
      const result = generator.generateDataFlowDiagram(changes);
      expect(result).toContain('흐름 A');
      expect(result).toContain('흐름 B');
    });
  });

  // ============================================================
  // generateSequenceDiagram
  // ============================================================

  describe('generateSequenceDiagram', () => {
    const sampleProcessChanges: ProcessChange[] = [
      {
        processName: '컬리옵스에서 20개 컬럼 수정',
        before: [
          '파트너포털 -> eSCM API: 상품 수정 요청',
          'eSCM API -> Kafka: 20개 컬럼 포함 발행',
          'Kafka -> LIP: Consumer 수신',
        ],
        after: [
          '컬리옵스 -> LIP API: 20개 컬럼 수정 요청',
          'LIP API -> LIP DB: 저장',
          'LIP API -> Kafka: 역방향 토픽 발행',
          'Kafka -> eSCM: Consumer 수신 및 DB 반영',
        ],
        changedSteps: [0, 1, 2],
      },
    ];

    it('should return empty string for empty array', () => {
      const result = generator.generateSequenceDiagram([]);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = generator.generateSequenceDiagram(undefined as unknown as ProcessChange[]);
      expect(result).toBe('');
    });

    it('should contain sequenceDiagram keyword', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('sequenceDiagram');
    });

    it('should contain mermaid code blocks', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('```mermaid');
    });

    it('should contain process name as heading', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('컬리옵스에서 20개 컬럼 수정');
    });

    it('should contain before and after flow labels', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('변경 전 흐름');
      expect(result).toContain('변경 후 흐름');
    });

    it('should mark changed steps', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('[CHANGED]');
    });

    it('should contain participant declarations', () => {
      const result = generator.generateSequenceDiagram(sampleProcessChanges);
      expect(result).toContain('participant');
    });

    it('should handle multiple process changes', () => {
      const changes: ProcessChange[] = [
        {
          processName: 'Process A',
          before: ['Step 1', 'Step 2'],
          after: ['Step 1 modified', 'Step 2', 'Step 3 new'],
          changedSteps: [0],
        },
        {
          processName: 'Process B',
          before: ['Action 1'],
          after: ['Action 1', 'Action 2'],
          changedSteps: [1],
        },
      ];
      const result = generator.generateSequenceDiagram(changes);
      expect(result).toContain('Process A');
      expect(result).toContain('Process B');
    });
  });

  // ============================================================
  // generateProcessFlowchart
  // ============================================================

  describe('generateProcessFlowchart', () => {
    const sampleProcessChanges: ProcessChange[] = [
      {
        processName: '물류속성 수정 프로세스',
        before: [
          '상품 상세 진입',
          '20개 컬럼 편집',
          'API 호출',
          'DB 저장',
        ],
        after: [
          '상품 상세 진입',
          '20개 컬럼 편집',
          'LIP API 호출',
          'LIP DB 저장',
          '역방향 Kafka 발행',
          'eSCM DB 동기화',
        ],
        changedSteps: [2, 3, 4, 5],
      },
    ];

    it('should return empty string for empty array', () => {
      const result = generator.generateProcessFlowchart([]);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = generator.generateProcessFlowchart(undefined as unknown as ProcessChange[]);
      expect(result).toBe('');
    });

    it('should contain flowchart TD keyword', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('flowchart TD');
    });

    it('should contain mermaid code blocks', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('```mermaid');
    });

    it('should contain process name as heading', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('물류속성 수정 프로세스');
    });

    it('should contain start and end nodes', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('시작');
      expect(result).toContain('완료');
    });

    it('should mark changed steps with CHANGED', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('CHANGED');
    });

    it('should contain classDef declarations', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain('classDef');
    });

    it('should use orange color for changed steps', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain(':::orange');
    });

    it('should use green color for unchanged steps', () => {
      const result = generator.generateProcessFlowchart(sampleProcessChanges);
      expect(result).toContain(':::green');
    });
  });

  // ============================================================
  // Edge cases and integration
  // ============================================================

  describe('edge cases', () => {
    it('should handle DataFlowChange with no arrows in text', () => {
      const changes: DataFlowChange[] = [
        {
          area: 'Simple',
          before: 'SystemA only',
          after: 'SystemB only',
          description: 'Replacement',
        },
      ];
      const result = generator.generateDataFlowDiagram(changes);
      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart LR');
    });

    it('should handle ProcessChange with empty before array', () => {
      const changes: ProcessChange[] = [
        {
          processName: 'New process',
          before: [],
          after: ['Step 1', 'Step 2'],
          changedSteps: [0, 1],
        },
      ];
      const result = generator.generateSequenceDiagram(changes);
      expect(result).toContain('```mermaid');
      expect(result).toContain('sequenceDiagram');
    });

    it('should handle ProcessChange with empty after array', () => {
      const changes: ProcessChange[] = [
        {
          processName: 'Removed process',
          before: ['Step 1', 'Step 2'],
          after: [],
          changedSteps: [],
        },
      ];
      const result = generator.generateProcessFlowchart(changes);
      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart TD');
    });

    it('should handle special characters in flow text', () => {
      const changes: DataFlowChange[] = [
        {
          area: 'Special chars',
          before: 'System (A) -> System [B]',
          after: 'System {C} -> System #D',
          description: 'Test special chars',
        },
      ];
      // Should not throw
      const result = generator.generateDataFlowDiagram(changes);
      expect(result).toContain('```mermaid');
    });

    it('should handle changedSteps with out-of-range indices', () => {
      const changes: ProcessChange[] = [
        {
          processName: 'Out of range',
          before: ['Step 1'],
          after: ['Step 1', 'Step 2'],
          changedSteps: [0, 5, 10], // 5 and 10 are out of range
        },
      ];
      // Should not throw
      const result = generator.generateProcessFlowchart(changes);
      expect(result).toContain('```mermaid');
    });

    it('should handle single-step processes', () => {
      const changes: ProcessChange[] = [
        {
          processName: 'Single step',
          before: ['Only step'],
          after: ['Only step modified'],
          changedSteps: [0],
        },
      ];
      const seqResult = generator.generateSequenceDiagram(changes);
      expect(seqResult).toContain('sequenceDiagram');

      const flowResult = generator.generateProcessFlowchart(changes);
      expect(flowResult).toContain('flowchart TD');
    });
  });
});
