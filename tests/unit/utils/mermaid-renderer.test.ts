/**
 * @module tests/unit/utils/mermaid-renderer
 * @description renderMermaid 단위 테스트 (TASK-114)
 *
 * 테스트 대상:
 * - 기본 flowchart 렌더링 (노드 + 엣지)
 * - subgraph 블록 생성 (그룹)
 * - 링크 타입별 화살표 스타일
 * - linkTypeFilter 옵션
 * - autoDetected 라벨
 * - 빈 링크 처리
 * - direction 옵션
 */

import { renderMermaid } from '../../../src/utils/mermaid-renderer';
import type { ProjectLink, ProjectGroup } from '../../../src/core/cross-project/types';

describe('renderMermaid', () => {
  // --------------------------------------------------------
  // 1. 기본 flowchart 렌더링
  // --------------------------------------------------------
  it('should render basic flowchart with links', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups);

    // Mermaid 블록 시작/끝
    expect(result).toContain('```mermaid');
    expect(result).toContain('flowchart LR'); // 기본 방향
    expect(result.endsWith('```')).toBe(true);

    // 노드 렌더링 확인
    expect(result).toContain('frontend[frontend]');
    expect(result).toContain('backend[backend]');

    // 엣지 렌더링 확인 (api-consumer → --> 화살표)
    expect(result).toContain('frontend -->|api| backend');
  });

  // --------------------------------------------------------
  // 2. 그룹이 있을 때 subgraph 블록 생성
  // --------------------------------------------------------
  it('should render groups as subgraphs', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [
      { name: 'WebTeam', projects: ['frontend'] },
      { name: 'ServerTeam', projects: ['backend'] },
    ];

    const result = renderMermaid(links, groups);

    expect(result).toContain('subgraph WebTeam');
    expect(result).toContain('frontend[frontend]');
    expect(result).toContain('subgraph ServerTeam');
    expect(result).toContain('backend[backend]');
    // subgraph 블록 닫힘 확인
    expect(result).toContain('end');
  });

  // --------------------------------------------------------
  // 3. 링크 타입별 화살표 스타일
  // --------------------------------------------------------
  it('should handle different link types with correct arrow styles', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'a',
        target: 'b',
        type: 'api-consumer',
        autoDetected: false,
      },
      {
        id: 'link-2',
        source: 'c',
        target: 'd',
        type: 'shared-library',
        autoDetected: false,
      },
      {
        id: 'link-3',
        source: 'e',
        target: 'f',
        type: 'event-publisher',
        autoDetected: false,
      },
      {
        id: 'link-4',
        source: 'g',
        target: 'h',
        type: 'shared-db',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups);

    // api-consumer → "-->"
    expect(result).toContain('a -->|api| b');
    // shared-library → "-.->"
    expect(result).toContain('c -.->|shared| d');
    // event-publisher → "==>"
    expect(result).toContain('e ==>|event| f');
    // shared-db → "-->"
    expect(result).toContain('g -->|shared-db| h');
  });

  // --------------------------------------------------------
  // 4. linkTypeFilter 옵션
  // --------------------------------------------------------
  it('should filter by link type', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
      {
        id: 'link-2',
        source: 'service-a',
        target: 'service-b',
        type: 'shared-library',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups, {
      linkTypeFilter: ['api-consumer'],
    });

    // api-consumer 링크만 포함
    expect(result).toContain('frontend -->|api| backend');
    // shared-library 링크는 제외
    expect(result).not.toContain('service_a');
    expect(result).not.toContain('service_b');
  });

  // --------------------------------------------------------
  // 5. autoDetected 링크 라벨
  // --------------------------------------------------------
  it('should mark autoDetected links', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: true,
      },
      {
        id: 'link-2',
        source: 'backend',
        target: 'database',
        type: 'shared-db',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups);

    // autoDetected → 라벨에 (auto) 표시
    expect(result).toContain('api(auto)');
    // 수동 링크는 (auto) 없음
    expect(result).toContain('|shared-db|');
    expect(result).not.toContain('shared-db(auto)');
  });

  // --------------------------------------------------------
  // 6. 빈 링크 배열 처리
  // --------------------------------------------------------
  it('should handle empty links', () => {
    const links: ProjectLink[] = [];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups);

    // 기본 flowchart 헤더만 포함
    expect(result).toContain('```mermaid');
    expect(result).toContain('flowchart LR');
    expect(result.endsWith('```')).toBe(true);
    // 노드나 엣지 없음
    const lines = result.split('\n');
    // 헤더(```mermaid, flowchart LR) + 닫음(```) 만 존재
    expect(lines.length).toBe(3);
  });

  // --------------------------------------------------------
  // 7. direction 옵션
  // --------------------------------------------------------
  it('should support direction option', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'a',
        target: 'b',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    // TB 방향
    const resultTB = renderMermaid(links, groups, { direction: 'TB' });
    expect(resultTB).toContain('flowchart TB');

    // LR 방향
    const resultLR = renderMermaid(links, groups, { direction: 'LR' });
    expect(resultLR).toContain('flowchart LR');
  });

  // --------------------------------------------------------
  // 8. 노드 ID에 특수문자가 있을 때 sanitize
  // --------------------------------------------------------
  it('should sanitize node IDs with special characters', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'my-frontend',
        target: 'my-backend',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [];

    const result = renderMermaid(links, groups);

    // 하이픈이 언더스코어로 치환됨
    expect(result).toContain('my_frontend[my-frontend]');
    expect(result).toContain('my_backend[my-backend]');
    // 엣지도 sanitized ID 사용
    expect(result).toContain('my_frontend -->|api| my_backend');
  });

  // --------------------------------------------------------
  // 9. includeGroups=false 옵션
  // --------------------------------------------------------
  it('should not render subgraphs when includeGroups is false', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [
      { name: 'WebTeam', projects: ['frontend'] },
    ];

    const result = renderMermaid(links, groups, { includeGroups: false });

    // subgraph 블록 없음
    expect(result).not.toContain('subgraph');
    // 노드는 최상위에 배치
    expect(result).toContain('frontend[frontend]');
    expect(result).toContain('backend[backend]');
  });

  // --------------------------------------------------------
  // 10. 그룹 미소속 프로젝트는 최상위에 배치
  // --------------------------------------------------------
  it('should place ungrouped projects at top level', () => {
    const links: ProjectLink[] = [
      {
        id: 'link-1',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        autoDetected: false,
      },
    ];
    const groups: ProjectGroup[] = [
      { name: 'WebTeam', projects: ['frontend'] },
      // backend은 어떤 그룹에도 속하지 않음
    ];

    const result = renderMermaid(links, groups);

    // frontend은 subgraph 내부
    expect(result).toContain('subgraph WebTeam');
    // backend은 subgraph 외부 최상위에 배치됨
    const lines = result.split('\n');
    const backendLine = lines.find((l) => l.includes('backend[backend]'));
    expect(backendLine).toBeDefined();
    // backend 라인의 인덴트가 subgraph 내부(4칸)가 아닌 최상위(2칸)
    expect(backendLine!.startsWith('  backend')).toBe(true);
  });
});
