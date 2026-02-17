/**
 * @module tests/unit/commands/projects
 * @description ProjectsCommand 크로스 프로젝트 기능 단위 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ResultCode } from '../../../src/types/common';
import { ProjectsCommand } from '../../../src/commands/projects';
import { CrossProjectManager } from '../../../src/core/cross-project/cross-project-manager';

// getImpactDir를 임시 디렉토리로 모킹
let tmpDir: string;

jest.mock('../../../src/utils/file', () => {
  const actual = jest.requireActual('../../../src/utils/file');
  return {
    ...actual,
    getImpactDir: () => tmpDir,
    getProjectDir: (projectId: string) => path.join(tmpDir, 'projects', projectId),
  };
});

// ResultManager mock (handleInfo에서 사용)
jest.mock('../../../src/core/analysis/result-manager', () => ({
  ResultManager: jest.fn().mockImplementation(() => ({
    list: jest.fn().mockResolvedValue([]),
  })),
}));

describe('ProjectsCommand - Cross Project Options', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-projects-cmd-'));

    // 빈 projects.json 생성
    const projectsConfig = { activeProject: '', projects: [] };
    fs.writeFileSync(
      path.join(tmpDir, 'projects.json'),
      JSON.stringify(projectsConfig, null, 2),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ============================================================
  // --link
  // ============================================================

  describe('--link', () => {
    it('의존성 등록 성공', async () => {
      const cmd = new ProjectsCommand([
        '--link', 'frontend', 'backend', '--type', 'api-consumer',
      ]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Link created');

      // 실제로 저장되었는지 확인
      const manager = new CrossProjectManager(tmpDir);
      const links = await manager.getLinks();
      expect(links).toHaveLength(1);
      expect(links[0].source).toBe('frontend');
      expect(links[0].target).toBe('backend');
    });

    it('소스 프로젝트 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--link']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Source and target');
    });

    it('타겟 프로젝트 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--link', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Source and target');
    });

    it('타입 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--link', 'frontend', 'backend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('--type is required');
    });

    it('잘못된 타입 시 실패', async () => {
      const cmd = new ProjectsCommand([
        '--link', 'frontend', 'backend', '--type', 'invalid-type',
      ]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('--type is required');
    });
  });

  // ============================================================
  // --unlink
  // ============================================================

  describe('--unlink', () => {
    it('의존성 해제 성공', async () => {
      // 먼저 링크 생성
      const manager = new CrossProjectManager(tmpDir);
      await manager.link('frontend', 'backend', 'api-consumer');

      const cmd = new ProjectsCommand(['--unlink', 'frontend', 'backend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Link removed');

      // 삭제 확인
      const links = await manager.getLinks();
      expect(links).toHaveLength(0);
    });

    it('소스/타겟 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--unlink']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Source and target');
    });

    it('존재하지 않는 링크 해제 시 실패', async () => {
      const cmd = new ProjectsCommand(['--unlink', 'nonexistent-a', 'nonexistent-b']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Link not found');
    });
  });

  // ============================================================
  // --links
  // ============================================================

  describe('--links', () => {
    it('전체 목록 조회', async () => {
      const manager = new CrossProjectManager(tmpDir);
      await manager.link('frontend', 'backend', 'api-consumer');
      await manager.link('backend', 'database', 'shared-library');

      const cmd = new ProjectsCommand(['--links']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed 2 links');
      expect((result.data as { links: unknown[] }).links).toHaveLength(2);
    });

    it('프로젝트별 필터 조회', async () => {
      const manager = new CrossProjectManager(tmpDir);
      await manager.link('frontend', 'backend', 'api-consumer');
      await manager.link('backend', 'database', 'shared-library');

      const cmd = new ProjectsCommand(['--links', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed 1 links');
      expect((result.data as { links: unknown[] }).links).toHaveLength(1);
    });

    it('링크 없을 때 빈 결과', async () => {
      const cmd = new ProjectsCommand(['--links']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed 0 links');
    });
  });

  // ============================================================
  // --detect-links
  // ============================================================

  describe('--detect-links', () => {
    it('프로젝트가 2개 미만이면 빈 결과', async () => {
      // projects.json에 프로젝트 0개 (기본 상태)
      const cmd = new ProjectsCommand(['--detect-links']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Not enough projects');
      expect((result.data as { detectedLinks: unknown[] }).detectedLinks).toHaveLength(0);
    });

    it('프로젝트가 2개 이상일 때 감지 실행', async () => {
      // 프로젝트 2개 등록
      const projectsConfig = {
        activeProject: 'project-a',
        projects: [
          {
            id: 'project-a',
            name: 'Project A',
            path: '/path/a',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsedAt: '2024-01-01T00:00:00.000Z',
            techStack: ['typescript'],
          },
          {
            id: 'project-b',
            name: 'Project B',
            path: '/path/b',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsedAt: '2024-01-01T00:00:00.000Z',
            techStack: ['typescript'],
          },
        ],
      };
      fs.writeFileSync(
        path.join(tmpDir, 'projects.json'),
        JSON.stringify(projectsConfig, null, 2),
      );

      const cmd = new ProjectsCommand(['--detect-links']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Detected');
      expect(result.data).toHaveProperty('detectedLinks');
    });

    it('감지 결과 없을 때 안내 메시지', async () => {
      // 프로젝트 2개 등록 (인덱스 없음 -> 감지 결과 0)
      const projectsConfig = {
        activeProject: 'project-a',
        projects: [
          {
            id: 'no-index-a',
            name: 'No Index A',
            path: '/path/a',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsedAt: '2024-01-01T00:00:00.000Z',
            techStack: [],
          },
          {
            id: 'no-index-b',
            name: 'No Index B',
            path: '/path/b',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsedAt: '2024-01-01T00:00:00.000Z',
            techStack: [],
          },
        ],
      };
      fs.writeFileSync(
        path.join(tmpDir, 'projects.json'),
        JSON.stringify(projectsConfig, null, 2),
      );

      const cmd = new ProjectsCommand(['--detect-links']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Detected 0 links');
      expect((result.data as { detectedLinks: unknown[] }).detectedLinks).toHaveLength(0);
    });
  });

  // ============================================================
  // --group (추가/제거)
  // ============================================================

  describe('--group --add', () => {
    it('그룹에 프로젝트 추가 성공', async () => {
      const cmd = new ProjectsCommand(['--group', 'commerce', '--add', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Added frontend to group commerce');

      // 실제로 저장되었는지 확인
      const manager = new CrossProjectManager(tmpDir);
      const group = await manager.getGroup('commerce');
      expect(group).not.toBeNull();
      expect(group!.projects).toContain('frontend');
    });

    it('기존 그룹에 프로젝트 추가 (중복 방지)', async () => {
      // 먼저 그룹 생성
      const manager = new CrossProjectManager(tmpDir);
      await manager.addGroup('commerce', ['frontend']);

      const cmd = new ProjectsCommand(['--group', 'commerce', '--add', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      // 중복 추가되지 않음
      const group = await manager.getGroup('commerce');
      expect(group!.projects.filter(p => p === 'frontend')).toHaveLength(1);
    });

    it('기존 그룹에 새 프로젝트 추가', async () => {
      // 먼저 그룹 생성
      const manager = new CrossProjectManager(tmpDir);
      await manager.addGroup('commerce', ['frontend']);

      const cmd = new ProjectsCommand(['--group', 'commerce', '--add', 'backend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Added backend to group commerce');

      const group = await manager.getGroup('commerce');
      expect(group!.projects).toContain('frontend');
      expect(group!.projects).toContain('backend');
    });
  });

  describe('--group --remove', () => {
    it('그룹에서 프로젝트 제거 성공', async () => {
      // 먼저 그룹 생성
      const manager = new CrossProjectManager(tmpDir);
      await manager.addGroup('commerce', ['frontend', 'backend']);

      const cmd = new ProjectsCommand(['--group', 'commerce', '--remove', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Removed frontend from group commerce');

      const group = await manager.getGroup('commerce');
      expect(group!.projects).not.toContain('frontend');
      expect(group!.projects).toContain('backend');
    });

    it('존재하지 않는 그룹에서 제거 시 실패', async () => {
      const cmd = new ProjectsCommand(['--group', 'nonexistent', '--remove', 'frontend']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Group not found');
    });
  });

  describe('--group (에러 케이스)', () => {
    it('그룹 이름 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--group']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Group name is required');
    });

    it('--add와 --remove 모두 없을 때 실패', async () => {
      const cmd = new ProjectsCommand(['--group', 'commerce']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('--add or --remove is required');
    });

    it('--add에 프로젝트 ID 누락 시 실패', async () => {
      const cmd = new ProjectsCommand(['--group', 'commerce', '--add']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Project ID is required');
    });

    it('--remove에 프로젝트 ID 누락 시 실패', async () => {
      // 먼저 그룹 생성
      const manager = new CrossProjectManager(tmpDir);
      await manager.addGroup('commerce', ['frontend']);

      const cmd = new ProjectsCommand(['--group', 'commerce', '--remove']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Project ID is required');
    });
  });

  // ============================================================
  // --groups (목록 조회)
  // ============================================================

  describe('--groups', () => {
    it('그룹 목록 조회', async () => {
      const manager = new CrossProjectManager(tmpDir);
      await manager.addGroup('commerce', ['frontend', 'backend']);
      await manager.addGroup('infra', ['database']);

      const cmd = new ProjectsCommand(['--groups']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed 2 groups');
      expect((result.data as { groups: unknown[] }).groups).toHaveLength(2);
    });

    it('그룹 없을 때 빈 결과', async () => {
      const cmd = new ProjectsCommand(['--groups']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed 0 groups');
    });
  });

  // ============================================================
  // 기존 기능 보존
  // ============================================================

  describe('기존 기능 보존', () => {
    it('인자 없이 실행 시 목록 조회 (기존 동작)', async () => {
      const cmd = new ProjectsCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed');
    });
  });
});
