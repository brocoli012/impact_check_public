"use strict";
/**
 * @module utils/file
 * @description 파일 시스템 유틸리티 - 파일/디렉토리 관련 헬퍼 함수
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
exports.ensureDir = ensureDir;
exports.fileExists = fileExists;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.calculateFileHash = calculateFileHash;
exports.getImpactDir = getImpactDir;
exports.getProjectDir = getProjectDir;
exports.toKebabCase = toKebabCase;
exports.formatFileSize = formatFileSize;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * 디렉토리가 존재하는지 확인하고, 없으면 생성
 * @param dirPath - 디렉토리 경로
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * 파일이 존재하는지 확인
 * @param filePath - 파일 경로
 * @returns 존재 여부
 */
function fileExists(filePath) {
    return fs.existsSync(filePath);
}
/**
 * JSON 파일을 읽고 파싱
 * @param filePath - JSON 파일 경로
 * @returns 파싱된 객체, 파일이 없으면 null
 */
function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * 객체를 JSON 파일로 저장
 * @param filePath - 저장할 파일 경로
 * @param data - 저장할 데이터
 */
function writeJsonFile(filePath, data) {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
/**
 * 파일의 SHA-256 해시를 계산
 * @param filePath - 파일 경로
 * @returns SHA-256 해시 문자열
 */
function calculateFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}
/**
 * .impact 디렉토리의 기본 경로를 반환
 * @param basePath - 기본 경로 (기본값: HOME 디렉토리)
 * @returns .impact 디렉토리 절대 경로
 */
function getImpactDir(basePath) {
    const base = basePath || process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(base, '.impact');
}
/**
 * 프로젝트별 디렉토리 경로를 반환
 * @param projectId - 프로젝트 ID
 * @param basePath - 기본 경로
 * @returns 프로젝트 디렉토리 경로
 */
function getProjectDir(projectId, basePath) {
    return path.join(getImpactDir(basePath), 'projects', projectId);
}
/**
 * 문자열을 kebab-case로 변환
 * @param str - 변환할 문자열
 * @returns kebab-case 문자열
 */
function toKebabCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}
/**
 * 파일 크기를 사람이 읽을 수 있는 형태로 변환
 * @param bytes - 바이트 크기
 * @returns 포맷팅된 크기 문자열
 */
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
//# sourceMappingURL=file.js.map