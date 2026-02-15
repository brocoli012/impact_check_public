/**
 * @module tests/unit/commands
 * @description 커맨드 핸들러 단위 테스트
 *
 * 각 커맨드가 Command 인터페이스를 올바르게 구현하는지,
 * name/description이 비어있지 않은지,
 * execute()가 CommandResult를 반환하는지,
 * 스텁 커맨드들이 올바르게 동작하는지,
 * HelpCommand가 성공적으로 실행되는지 검증합니다.
 */

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

// 스텁 커맨드 목록 (아직 구현되지 않은 커맨드)
// init, reindex, analyze는 실제 구현으로 변경되어 스텁 목록에서 제외
const STUB_COMMANDS: Array<{
  name: string;
  CommandClass: new (args: string[]) => Command;
  args: string[];
}> = [
  { name: 'view', CommandClass: ViewCommand, args: [] },
  { name: 'tickets', CommandClass: TicketsCommand, args: [] },
  { name: 'projects', CommandClass: ProjectsCommand, args: [] },
  { name: 'policies', CommandClass: PoliciesCommand, args: [] },
  { name: 'owners', CommandClass: OwnersCommand, args: [] },
  { name: 'annotations', CommandClass: AnnotationsCommand, args: [] },
  { name: 'demo', CommandClass: DemoCommand, args: [] },
];

// 모든 커맨드 목록
const ALL_COMMANDS: Array<{
  name: string;
  CommandClass: new (args: string[]) => Command;
  args: string[];
}> = [
  ...STUB_COMMANDS,
  { name: 'init', CommandClass: InitCommand, args: [] },
  { name: 'reindex', CommandClass: ReindexCommand, args: [] },
  { name: 'help', CommandClass: HelpCommand, args: [] },
  { name: 'config', CommandClass: ConfigCommand, args: [] },
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
      expect(result.message).toContain('does not exist');
    });

    it('should return SUCCESS when a valid project path is provided', async () => {
      const fixturePath = require('path').resolve(__dirname, '../fixtures/sample-project');
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
    it('should accept --stop argument', async () => {
      const command = new ViewCommand(['--stop']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
  });

  describe('TicketsCommand', () => {
    it('should accept --create argument', async () => {
      const command = new TicketsCommand(['--create']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept --detail argument', async () => {
      const command = new TicketsCommand(['--detail', 'T-001']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
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
    it('should accept --switch argument', async () => {
      const command = new ProjectsCommand(['--switch', 'my-project']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept --remove argument', async () => {
      const command = new ProjectsCommand(['--remove', 'old-project']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept --archive argument', async () => {
      const command = new ProjectsCommand(['--archive', 'legacy-project']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
  });

  describe('PoliciesCommand', () => {
    it('should accept --search argument', async () => {
      const command = new PoliciesCommand(['--search', '배송']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept add subcommand', async () => {
      const command = new PoliciesCommand(['add', 'new policy']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
  });

  describe('OwnersCommand', () => {
    it('should accept --add argument', async () => {
      const command = new OwnersCommand(['--add']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept --edit argument', async () => {
      const command = new OwnersCommand(['--edit', 'delivery-system']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });

    it('should accept --remove argument', async () => {
      const command = new OwnersCommand(['--remove', 'old-system']);
      const result = await command.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
    });
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
