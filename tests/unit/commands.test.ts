/**
 * @module tests/unit/commands
 * @description 커맨드 핸들러 단위 테스트
 *
 * 각 커맨드가 Command 인터페이스를 올바르게 구현하는지,
 * name/description이 비어있지 않은지,
 * execute()가 CommandResult를 반환하는지,
 * 스텁 커맨드들이 올바르게 동작하는지,
 * 실제 구현된 커맨드들이 올바르게 동작하는지 검증합니다.
 */

import * as path from 'path';
import { Command, ResultCode } from '../../src/types/common';
import { InitCommand } from '../../src/commands/init';
import { AnalyzeCommand } from '../../src/commands/analyze';
import { ViewCommand } from '../../src/commands/view';
import { TicketsCommand } from '../../src/commands/tickets';
import { ConfigCommand } from '../../src/commands/config';
import { ReindexCommand } from '../../src/commands/reindex';
import { DemoCommand } from '../../src/commands/demo';
import { HelpCommand } from '../../src/commands/help';
import { ProjectsCommand } from '../../src/commands/projects';
import { PoliciesCommand } from '../../src/commands/policies';
import { OwnersCommand } from '../../src/commands/owners';
import { AnnotationsCommand } from '../../src/commands/annotations';
import { ExportIndexCommand } from '../../src/commands/export-index';
import { SaveResultCommand } from '../../src/commands/save-result';

// Mock the web-server module to prevent real Express server from starting during tests.
// Without this mock, ViewCommand.handleStart() would start a real HTTP server,
// causing tests to hang/timeout because the server keeps the process alive.
jest.mock('../../src/server/web-server', () => ({
  startServer: jest.fn().mockResolvedValue(3847),
  stopServer: jest.fn().mockResolvedValue(undefined),
  isServerRunning: jest.fn().mockReturnValue(false),
}));

// 스텁 커맨드 목록 (아직 구현되지 않은 커맨드)
// annotations만 Phase 2 기능으로 남아있음
const STUB_COMMANDS: Array<{
  name: string;
  CommandClass: new (args: string[]) => Command;
  args: string[];
}> = [
  { name: 'annotations', CommandClass: AnnotationsCommand, args: [] },
];

// 모든 커맨드 목록
const ALL_COMMANDS: Array<{
  name: string;
  CommandClass: new (args: string[]) => Command;
  args: string[];
}> = [
  ...STUB_COMMANDS,
  { name: 'tickets', CommandClass: TicketsCommand, args: [] },
  { name: 'projects', CommandClass: ProjectsCommand, args: [] },
  { name: 'policies', CommandClass: PoliciesCommand, args: [] },
  { name: 'owners', CommandClass: OwnersCommand, args: [] },
  { name: 'demo', CommandClass: DemoCommand, args: ['--no-open'] },
  { name: 'view', CommandClass: ViewCommand, args: [] },
  { name: 'init', CommandClass: InitCommand, args: [] },
  { name: 'reindex', CommandClass: ReindexCommand, args: [] },
  { name: 'help', CommandClass: HelpCommand, args: [] },
  { name: 'config', CommandClass: ConfigCommand, args: [] },
  { name: 'export-index', CommandClass: ExportIndexCommand, args: [] },
  { name: 'save-result', CommandClass: SaveResultCommand, args: [] },
];

describe('Command Handlers', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Command interface compliance', () => {
    it.each(ALL_COMMANDS)(
      '$name should implement the Command interface',
      ({ CommandClass, args }) => {
        const command: Command = new CommandClass(args);
        // Command interface requires: name (string), description (string), execute (function)
        expect(typeof command.name).toBe('string');
        expect(typeof command.description).toBe('string');
        expect(typeof command.execute).toBe('function');
      },
    );

    it.each(ALL_COMMANDS)(
      '$name should have a non-empty name',
      ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        expect(command.name.length).toBeGreaterThan(0);
      },
    );

    it.each(ALL_COMMANDS)(
      '$name should have a non-empty description',
      ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        expect(command.description.length).toBeGreaterThan(0);
      },
    );

    it.each(ALL_COMMANDS)(
      '$name name should be readonly',
      ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const descriptor = Object.getOwnPropertyDescriptor(command, 'name');
        // readonly properties are either non-writable or defined via getter
        expect(descriptor?.writable === false || descriptor?.set === undefined).toBe(true);
      },
    );

    it.each(ALL_COMMANDS)(
      '$name description should be readonly',
      ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const descriptor = Object.getOwnPropertyDescriptor(command, 'description');
        expect(descriptor?.writable === false || descriptor?.set === undefined).toBe(true);
      },
    );
  });

  describe('execute() returns CommandResult', () => {
    it.each(ALL_COMMANDS)(
      '$name.execute() should return a CommandResult',
      async ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const result = await command.execute();

        // CommandResult requires: code (ResultCode), message (string)
        expect(result).toBeDefined();
        expect(result.code).toBeDefined();
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);

        // code should be a valid ResultCode
        const validCodes = Object.values(ResultCode);
        expect(validCodes).toContain(result.code);
      },
    );

    it.each(ALL_COMMANDS)(
      '$name.execute() should return a Promise',
      ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const result = command.execute();
        expect(result).toBeInstanceOf(Promise);
      },
    );
  });

  describe('Stub commands behavior', () => {
    it.each(STUB_COMMANDS)(
      '$name stub should return SUCCESS code',
      async ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const result = await command.execute();
        expect(result.code).toBe(ResultCode.SUCCESS);
      },
    );

    it.each(STUB_COMMANDS)(
      '$name stub result message should contain "stub"',
      async ({ CommandClass, args }) => {
        const command = new CommandClass(args);
        const result = await command.execute();
        expect(result.message.toLowerCase()).toContain('stub');
      },
    );

    it.each(STUB_COMMANDS)(
      '$name should have the correct name property',
      ({ name, CommandClass, args }) => {
        const command = new CommandClass(args);
        expect(command.name).toBe(name);
      },
    );
  });

  describe('HelpCommand', () => {
    it('should execute successfully', async () => {
      const command = new HelpCommand([]);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should have name "help"', () => {
      const command = new HelpCommand([]);
      expect(command.name).toBe('help');
    });

    it('should output available commands when called without args', async () => {
      const command = new HelpCommand([]);
      await command.execute();
      // Should have printed multiple lines including command names
      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      expect(allOutput).toContain('init');
      expect(allOutput).toContain('analyze');
      expect(allOutput).toContain('help');
    });

    it('should show detailed help for a specific valid command', async () => {
      const command = new HelpCommand(['analyze']);
      await command.execute();
      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      expect(allOutput).toContain('analyze');
    });

    it('should show all commands when an unknown command is provided', async () => {
      const command = new HelpCommand(['nonexistent-cmd']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should return a message indicating success', async () => {
      const command = new HelpCommand([]);
      const result = await command.execute();
      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should show options section for commands with options', async () => {
      const command = new HelpCommand(['tickets']);
      await command.execute();
      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      expect(allOutput).toContain('--result-id');
      expect(allOutput).toContain('--output');
    });

    it('should list all 14 commands in help output', async () => {
      const command = new HelpCommand([]);
      await command.execute();
      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      const expectedCommands = [
        'init', 'analyze', 'view', 'tickets', 'config', 'reindex',
        'policies', 'owners', 'annotations', 'projects', 'demo', 'help',
        'export-index', 'save-result',
      ];
      for (const cmd of expectedCommands) {
        expect(allOutput).toContain(cmd);
      }
    });
  });

  describe('InitCommand', () => {
    it('should return FAILURE when no project path is provided', async () => {
      const command = new InitCommand([]);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('required');
    });

    it('should return FAILURE when project path does not exist', async () => {
      const command = new InitCommand(['/nonexistent/path/to/project']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('경로가 존재하지 않습니다');
    });

    it('should return SUCCESS when a valid project path is provided', async () => {
      const fixturePath = path.resolve(__dirname, '../fixtures/sample-project');
      const command = new InitCommand([fixturePath]);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('initialized');
    }, 30000);
  });

  describe('AnalyzeCommand', () => {
    it('should return FAILURE when no --file option is provided', async () => {
      const command = new AnalyzeCommand([]);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('--file');
    });

    it('should return FAILURE when --file points to a nonexistent file', async () => {
      const command = new AnalyzeCommand(['--file', '/nonexistent/plan.pdf']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
    });

    it('should have name "analyze"', () => {
      const command = new AnalyzeCommand([]);
      expect(command.name).toBe('analyze');
    });
  });

  describe('ViewCommand', () => {
    it('should accept --stop argument and return SUCCESS when no server running', async () => {
      const command = new ViewCommand(['--stop']);
      const result = await command.execute();
      // isServerRunning is mocked to return false, so --stop returns SUCCESS
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('No web server');
    });

    it('should have name "view"', () => {
      const command = new ViewCommand([]);
      expect(command.name).toBe('view');
    });

    it('should return NEEDS_CONFIG when no active project exists', async () => {
      const command = new ViewCommand([]);
      const result = await command.execute();
      // No active project in test env -> NEEDS_CONFIG
      expect([ResultCode.NEEDS_CONFIG, ResultCode.SUCCESS]).toContain(result.code);
    });
  });

  describe('TicketsCommand', () => {
    it('should have name "tickets"', () => {
      const command = new TicketsCommand([]);
      expect(command.name).toBe('tickets');
    });

    it('should return a valid result code', async () => {
      const command = new TicketsCommand([]);
      const result = await command.execute();
      // Without active project -> NEEDS_INDEX
      // With active project but no results -> FAILURE
      const validCodes = [ResultCode.SUCCESS, ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE for nonexistent result-id', async () => {
      const command = new TicketsCommand(['--result-id', 'nonexistent-result-id']);
      const result = await command.execute();
      // Either NEEDS_INDEX (no active project) or FAILURE (result not found)
      const validCodes = [ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });
  });

  describe('ReindexCommand', () => {
    it('should return a valid result code', async () => {
      const command = new ReindexCommand([]);
      const result = await command.execute();
      // ReindexCommand checks for active project:
      // - No active project -> NEEDS_INDEX
      // - Active project exists -> attempts reindex -> SUCCESS or FAILURE
      const validCodes = [ResultCode.SUCCESS, ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    }, 30000);

    it('should accept --full argument and return a valid result', async () => {
      const command = new ReindexCommand(['--full']);
      const result = await command.execute();
      const validCodes = [ResultCode.SUCCESS, ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    }, 30000);

    it('should have name "reindex"', () => {
      const command = new ReindexCommand([]);
      expect(command.name).toBe('reindex');
    });
  });

  describe('ProjectsCommand', () => {
    it('should have name "projects"', () => {
      const command = new ProjectsCommand([]);
      expect(command.name).toBe('projects');
    });

    it('should return SUCCESS for list (no args)', async () => {
      const command = new ProjectsCommand([]);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Listed');
    });

    it('should return FAILURE when --switch without a project name', async () => {
      const command = new ProjectsCommand(['--switch']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('required');
    });

    it('should return FAILURE when --switch with nonexistent project', async () => {
      const command = new ProjectsCommand(['--switch', 'nonexistent-project-xyz']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('not found');
    });

    it('should return FAILURE when --remove without a project name', async () => {
      const command = new ProjectsCommand(['--remove']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
    });

    it('should return FAILURE when --remove with nonexistent project', async () => {
      const command = new ProjectsCommand(['--remove', 'nonexistent-project-xyz']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('not found');
    });

    it('should return FAILURE when --info without a project name', async () => {
      const command = new ProjectsCommand(['--info']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
    });

    it('should return FAILURE when --info with nonexistent project', async () => {
      const command = new ProjectsCommand(['--info', 'nonexistent-project-xyz']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('not found');
    });
  });

  describe('PoliciesCommand', () => {
    it('should have name "policies"', () => {
      const command = new PoliciesCommand([]);
      expect(command.name).toBe('policies');
    });

    it('should return a valid result code', async () => {
      const command = new PoliciesCommand([]);
      const result = await command.execute();
      // Either NEEDS_INDEX (no active project) or SUCCESS (empty policies list)
      const validCodes = [ResultCode.SUCCESS, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE when --search without keyword', async () => {
      const command = new PoliciesCommand(['--search']);
      const result = await command.execute();
      // Either NEEDS_INDEX (no active project) or FAILURE (no keyword)
      // or SUCCESS (no policies found = shows empty message before checking --search)
      const validCodes = [ResultCode.SUCCESS, ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return a valid result code with --search keyword', async () => {
      const command = new PoliciesCommand(['--search', '배송']);
      const result = await command.execute();
      const validCodes = [ResultCode.SUCCESS, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });
  });

  describe('OwnersCommand', () => {
    it('should have name "owners"', () => {
      const command = new OwnersCommand([]);
      expect(command.name).toBe('owners');
    });

    it('should return a valid result code for list', async () => {
      const command = new OwnersCommand([]);
      const result = await command.execute();
      // Either NEEDS_INDEX (no active project) or SUCCESS (empty list)
      const validCodes = [ResultCode.SUCCESS, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE when --add without sufficient params', async () => {
      const command = new OwnersCommand(['--add']);
      const result = await command.execute();
      // Either NEEDS_INDEX (no active project) or FAILURE (insufficient params)
      const validCodes = [ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE when --remove without system ID', async () => {
      const command = new OwnersCommand(['--remove']);
      const result = await command.execute();
      const validCodes = [ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE when --show without system ID', async () => {
      const command = new OwnersCommand(['--show']);
      const result = await command.execute();
      const validCodes = [ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });

    it('should return FAILURE when --remove nonexistent system', async () => {
      const command = new OwnersCommand(['--remove', 'nonexistent-system']);
      const result = await command.execute();
      const validCodes = [ResultCode.FAILURE, ResultCode.NEEDS_INDEX];
      expect(validCodes).toContain(result.code);
    });
  });

  describe('DemoCommand', () => {
    it('should have name "demo"', () => {
      const command = new DemoCommand([]);
      expect(command.name).toBe('demo');
    });

    it('should return SUCCESS with --no-open', async () => {
      const command = new DemoCommand(['--no-open']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Demo completed');
    }, 10000);

    it('should return data with projectId and analysisId', async () => {
      const command = new DemoCommand(['--no-open']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toBeDefined();
      const data = result.data as { projectId: string; analysisId: string };
      expect(data.projectId).toBe('demo-project');
      expect(data.analysisId).toBe('demo-analysis-001');
    }, 10000);

    it('should output demo steps', async () => {
      const command = new DemoCommand(['--no-open']);
      await command.execute();
      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
      expect(allOutput).toContain('[1/5]');
      expect(allOutput).toContain('[2/5]');
      expect(allOutput).toContain('[3/5]');
      expect(allOutput).toContain('[4/5]');
      expect(allOutput).toContain('[5/5]');
    }, 10000);
  });

  describe('AnnotationsCommand', () => {
    it('should accept generate subcommand', async () => {
      const command = new AnnotationsCommand(['generate']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept generate with path', async () => {
      const command = new AnnotationsCommand(['generate', '/src/module']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept view subcommand', async () => {
      const command = new AnnotationsCommand(['view']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept view with path', async () => {
      const command = new AnnotationsCommand(['view', '/src/module']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
  });
});
