/**
 * @module tests/unit/router
 * @description 명령어 라우터 단위 테스트
 */

import { route, UnknownCommandError, getAvailableCommands } from '../../src/router';
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

describe('Router', () => {
  describe('route()', () => {
    it('should route "init" to InitCommand', () => {
      const command = route(['init', '/path/to/project']);
      expect(command).toBeInstanceOf(InitCommand);
      expect(command.name).toBe('init');
    });

    it('should route "analyze" to AnalyzeCommand', () => {
      const command = route(['analyze', '--file', 'plan.pdf']);
      expect(command).toBeInstanceOf(AnalyzeCommand);
      expect(command.name).toBe('analyze');
    });

    it('should route "view" to ViewCommand', () => {
      const command = route(['view']);
      expect(command).toBeInstanceOf(ViewCommand);
      expect(command.name).toBe('view');
    });

    it('should route "tickets" to TicketsCommand', () => {
      const command = route(['tickets', '--create']);
      expect(command).toBeInstanceOf(TicketsCommand);
      expect(command.name).toBe('tickets');
    });

    it('should route "config" to ConfigCommand', () => {
      const command = route(['config', '--provider', 'anthropic']);
      expect(command).toBeInstanceOf(ConfigCommand);
      expect(command.name).toBe('config');
    });

    it('should route "reindex" to ReindexCommand', () => {
      const command = route(['reindex', '--full']);
      expect(command).toBeInstanceOf(ReindexCommand);
      expect(command.name).toBe('reindex');
    });

    it('should route "demo" to DemoCommand', () => {
      const command = route(['demo']);
      expect(command).toBeInstanceOf(DemoCommand);
      expect(command.name).toBe('demo');
    });

    it('should route "help" to HelpCommand', () => {
      const command = route(['help']);
      expect(command).toBeInstanceOf(HelpCommand);
      expect(command.name).toBe('help');
    });

    it('should route "faq" to HelpCommand', () => {
      const command = route(['faq']);
      expect(command).toBeInstanceOf(HelpCommand);
      expect(command.name).toBe('help');
    });

    it('should route "projects" to ProjectsCommand', () => {
      const command = route(['projects', '--switch', 'my-project']);
      expect(command).toBeInstanceOf(ProjectsCommand);
      expect(command.name).toBe('projects');
    });

    it('should route "policies" to PoliciesCommand', () => {
      const command = route(['policies', '--search', '배송']);
      expect(command).toBeInstanceOf(PoliciesCommand);
      expect(command.name).toBe('policies');
    });

    it('should route "owners" to OwnersCommand', () => {
      const command = route(['owners', '--add']);
      expect(command).toBeInstanceOf(OwnersCommand);
      expect(command.name).toBe('owners');
    });

    it('should route "annotations" to AnnotationsCommand', () => {
      const command = route(['annotations', 'generate']);
      expect(command).toBeInstanceOf(AnnotationsCommand);
      expect(command.name).toBe('annotations');
    });

    it('should default to HelpCommand when no command is provided', () => {
      const command = route([]);
      expect(command).toBeInstanceOf(HelpCommand);
    });

    it('should throw UnknownCommandError for unknown commands', () => {
      expect(() => route(['unknown-command'])).toThrow(UnknownCommandError);
    });

    it('should include command name in UnknownCommandError', () => {
      try {
        route(['nonexistent']);
        fail('Expected UnknownCommandError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnknownCommandError);
        if (error instanceof UnknownCommandError) {
          expect(error.command).toBe('nonexistent');
          expect(error.availableCommands).toContain('init');
          expect(error.availableCommands).toContain('analyze');
          expect(error.availableCommands).toContain('help');
        }
      }
    });

    it('should pass remaining args to the command', async () => {
      const command = route(['init', '/my/project/path']);
      expect(command).toBeInstanceOf(InitCommand);
      // Verify command can execute without errors
      const result = await command.execute();
      expect(result.code).toBeDefined();
    });
  });

  describe('getAvailableCommands()', () => {
    it('should return all registered command names', () => {
      const commands = getAvailableCommands();
      expect(commands).toContain('init');
      expect(commands).toContain('analyze');
      expect(commands).toContain('view');
      expect(commands).toContain('tickets');
      expect(commands).toContain('config');
      expect(commands).toContain('reindex');
      expect(commands).toContain('demo');
      expect(commands).toContain('help');
      expect(commands).toContain('faq');
      expect(commands).toContain('projects');
      expect(commands).toContain('policies');
      expect(commands).toContain('owners');
      expect(commands).toContain('annotations');
    });

    it('should return at least 13 commands', () => {
      const commands = getAvailableCommands();
      expect(commands.length).toBeGreaterThanOrEqual(13);
    });
  });
});
