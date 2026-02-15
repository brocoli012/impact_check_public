"use strict";
/**
 * @module types/common
 * @description 공통 타입 정의 - 프로젝트 전반에서 사용되는 기본 타입
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.ResultCode = void 0;
/** 결과 코드 - 명령어 실행 결과를 나타내는 열거형 */
var ResultCode;
(function (ResultCode) {
    /** 성공 */
    ResultCode["SUCCESS"] = "SUCCESS";
    /** 실패 */
    ResultCode["FAILURE"] = "FAILURE";
    /** 부분 성공 */
    ResultCode["PARTIAL"] = "PARTIAL";
    /** 취소됨 */
    ResultCode["CANCELLED"] = "CANCELLED";
    /** 설정 필요 */
    ResultCode["NEEDS_CONFIG"] = "NEEDS_CONFIG";
    /** 인덱스 필요 */
    ResultCode["NEEDS_INDEX"] = "NEEDS_INDEX";
})(ResultCode || (exports.ResultCode = ResultCode = {}));
/** 로그 레벨 */
var LogLevel;
(function (LogLevel) {
    /** 디버그 */
    LogLevel["DEBUG"] = "debug";
    /** 정보 */
    LogLevel["INFO"] = "info";
    /** 경고 */
    LogLevel["WARN"] = "warn";
    /** 에러 */
    LogLevel["ERROR"] = "error";
    /** 치명적 에러 */
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
//# sourceMappingURL=common.js.map