"use strict";
/**
 * @module core/indexing/parsers/base-parser
 * @description AST 파서 베이스 클래스 - 모든 언어별 파서의 공통 인터페이스
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseParser = void 0;
const path = __importStar(require("path"));
/**
 * BaseParser - 모든 언어별 파서의 추상 베이스 클래스
 *
 * 각 파서는 이 클래스를 상속하여 특정 언어의 AST 파싱을 구현합니다.
 */
class BaseParser {
    /**
     * 주어진 파일을 파싱할 수 있는지 확인
     * @param filePath - 파일 경로
     * @returns 파싱 가능 여부
     */
    canParse(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }
    /**
     * 빈 ParsedFile 객체 생성
     * @param filePath - 파일 경로
     * @returns 빈 ParsedFile 객체
     */
    createEmptyParsedFile(filePath) {
        return {
            filePath,
            imports: [],
            exports: [],
            functions: [],
            components: [],
            apiCalls: [],
            routeDefinitions: [],
            comments: [],
        };
    }
}
exports.BaseParser = BaseParser;
//# sourceMappingURL=base-parser.js.map