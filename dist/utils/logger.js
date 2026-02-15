"use strict";
/**
 * @module utils/logger
 * @description 로깅 유틸리티 - 레벨별 로깅 및 CLI 출력 포맷팅
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const common_1 = require("../types/common");
/** 로그 레벨 우선순위 */
const LOG_LEVEL_PRIORITY = {
    [common_1.LogLevel.DEBUG]: 0,
    [common_1.LogLevel.INFO]: 1,
    [common_1.LogLevel.WARN]: 2,
    [common_1.LogLevel.ERROR]: 3,
    [common_1.LogLevel.FATAL]: 4,
};
/** ANSI 색상 코드 */
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
};
/** 로그 레벨별 색상 매핑 */
const LEVEL_COLORS = {
    [common_1.LogLevel.DEBUG]: COLORS.gray,
    [common_1.LogLevel.INFO]: COLORS.blue,
    [common_1.LogLevel.WARN]: COLORS.yellow,
    [common_1.LogLevel.ERROR]: COLORS.red,
    [common_1.LogLevel.FATAL]: COLORS.red + COLORS.bold,
};
/**
 * Logger 클래스 - 애플리케이션 로깅을 담당
 */
class Logger {
    /**
     * Logger 인스턴스 생성
     * @param level - 최소 로그 레벨
     */
    constructor(level = common_1.LogLevel.INFO) {
        this.level = level;
    }
    /**
     * 로그 레벨을 설정
     * @param level - 새 로그 레벨
     */
    setLevel(level) {
        this.level = level;
    }
    /**
     * 현재 로그 레벨을 반환
     * @returns 현재 로그 레벨
     */
    getLevel() {
        return this.level;
    }
    /**
     * 디버그 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    debug(message, ...args) {
        this.log(common_1.LogLevel.DEBUG, message, ...args);
    }
    /**
     * 정보 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    info(message, ...args) {
        this.log(common_1.LogLevel.INFO, message, ...args);
    }
    /**
     * 경고 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    warn(message, ...args) {
        this.log(common_1.LogLevel.WARN, message, ...args);
    }
    /**
     * 에러 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    error(message, ...args) {
        this.log(common_1.LogLevel.ERROR, message, ...args);
    }
    /**
     * 치명적 에러 메시지 출력
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    fatal(message, ...args) {
        this.log(common_1.LogLevel.FATAL, message, ...args);
    }
    /**
     * 성공 메시지 출력 (CLI 전용)
     * @param message - 성공 메시지
     */
    success(message) {
        console.log(`${COLORS.green}[OK]${COLORS.reset} ${message}`);
    }
    /**
     * 구분선 출력 (CLI 전용)
     */
    separator() {
        console.log(`${COLORS.gray}${'─'.repeat(60)}${COLORS.reset}`);
    }
    /**
     * 헤더 출력 (CLI 전용)
     * @param title - 헤더 제목
     */
    header(title) {
        this.separator();
        console.log(`${COLORS.bold}${COLORS.cyan} ${title}${COLORS.reset}`);
        this.separator();
    }
    /**
     * 내부 로그 출력
     * @param level - 로그 레벨
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    log(level, message, ...args) {
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
            return;
        }
        const timestamp = new Date().toISOString();
        const color = LEVEL_COLORS[level];
        const levelTag = level.toUpperCase().padEnd(5);
        const prefix = `${COLORS.gray}${timestamp}${COLORS.reset} ${color}[${levelTag}]${COLORS.reset}`;
        if (args.length > 0) {
            console.log(`${prefix} ${message}`, ...args);
        }
        else {
            console.log(`${prefix} ${message}`);
        }
    }
}
exports.Logger = Logger;
/** 전역 Logger 인스턴스 */
exports.logger = new Logger(common_1.LogLevel.INFO);
//# sourceMappingURL=logger.js.map