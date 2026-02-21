"use strict";
/**
 * @module router
 * @description 명령어 라우터 - 커맨드 문자열을 해당 핸들러로 분기
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownCommandError = void 0;
exports.route = route;
exports.getAvailableCommands = getAvailableCommands;
const init_1 = require("./commands/init");
const analyze_1 = require("./commands/analyze");
const view_1 = require("./commands/view");
const tickets_1 = require("./commands/tickets");
const config_1 = require("./commands/config");
const reindex_1 = require("./commands/reindex");
const demo_1 = require("./commands/demo");
const help_1 = require("./commands/help");
const projects_1 = require("./commands/projects");
const policies_1 = require("./commands/policies");
const owners_1 = require("./commands/owners");
const annotations_1 = require("./commands/annotations");
const export_index_1 = require("./commands/export-index");
const save_result_1 = require("./commands/save-result");
const ask_1 = require("./commands/ask");
const policy_check_1 = require("./commands/policy-check");
const summary_1 = require("./commands/summary");
const cross_analyze_1 = require("./commands/cross-analyze");
const reverse_1 = require("./commands/reverse");
/** 알 수 없는 명령어 에러 */
class UnknownCommandError extends Error {
    /**
     * UnknownCommandError 생성
     * @param command - 입력된 명령어
     * @param availableCommands - 사용 가능한 명령어 목록
     */
    constructor(command, availableCommands) {
        super(`Unknown command: '${command}'. Available commands: ${availableCommands.join(', ')}`);
        this.name = 'UnknownCommandError';
        this.command = command;
        this.availableCommands = availableCommands;
    }
}
exports.UnknownCommandError = UnknownCommandError;
/** 명령어 맵 - 커맨드 이름과 핸들러 클래스의 매핑 */
const COMMANDS = {
    'init': init_1.InitCommand,
    'analyze': analyze_1.AnalyzeCommand,
    'view': view_1.ViewCommand,
    'tickets': tickets_1.TicketsCommand,
    'config': config_1.ConfigCommand,
    'reindex': reindex_1.ReindexCommand,
    'demo': demo_1.DemoCommand,
    'help': help_1.HelpCommand,
    'faq': help_1.HelpCommand, // FAQ는 HelpCommand로 처리
    'projects': projects_1.ProjectsCommand,
    'policies': policies_1.PoliciesCommand,
    'owners': owners_1.OwnersCommand,
    'annotations': annotations_1.AnnotationsCommand,
    'export-index': export_index_1.ExportIndexCommand,
    'save-result': save_result_1.SaveResultCommand,
    'ask': ask_1.AskCommand,
    'policy-check': policy_check_1.PolicyCheckCommand,
    'summary': summary_1.SummaryCommand,
    'cross-analyze': cross_analyze_1.CrossAnalyzeCommand,
    'reverse': reverse_1.ReverseCommand,
};
/**
 * 명령어를 라우팅하여 적절한 Command 인스턴스를 반환
 * @param args - CLI 인자 배열 (첫 번째 요소가 명령어 이름)
 * @returns Command 인스턴스
 * @throws {UnknownCommandError} 알 수 없는 명령어인 경우
 */
function route(args) {
    const commandName = args[0];
    if (!commandName) {
        return new help_1.HelpCommand([]);
    }
    const CommandClass = COMMANDS[commandName];
    if (!CommandClass) {
        throw new UnknownCommandError(commandName, Object.keys(COMMANDS));
    }
    return new CommandClass(args.slice(1));
}
/**
 * 사용 가능한 명령어 목록을 반환
 * @returns 명령어 이름 배열
 */
function getAvailableCommands() {
    return Object.keys(COMMANDS);
}
//# sourceMappingURL=router.js.map