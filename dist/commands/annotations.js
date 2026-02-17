"use strict";
/**
 * @module commands/annotations
 * @description Annotations 명령어 핸들러 - 보강 주석 생성 및 조회
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
exports.AnnotationsCommand = void 0;
const path = __importStar(require("path"));
const common_1 = require("../types/common");
const annotation_manager_1 = require("../core/annotations/annotation-manager");
const annotation_generator_1 = require("../core/annotations/annotation-generator");
const indexer_1 = require("../core/indexing/indexer");
const config_manager_1 = require("../config/config-manager");
const file_1 = require("../utils/file");
const logger_1 = require("../utils/logger");
/**
 * AnnotationsCommand - 보강 주석 명령어
 *
 * 사용법: /impact annotations [generate [path]] [view [path]]
 * 기능:
 *   - 보강 주석 생성
 *   - 기존 보강 주석 조회
 *   - 보강 주석 상태 요약
 */
class AnnotationsCommand {
    constructor(args) {
        this.name = 'annotations';
        this.description = '보강 주석을 생성하거나 기존 보강 주석을 조회합니다.';
        this.args = args;
    }
    async execute() {
        const subCommand = this.args[0];
        const targetPath = this.args[1];
        if (subCommand === 'generate') {
            return this.handleGenerate(targetPath);
        }
        else if (subCommand === 'view') {
            return this.handleView(targetPath);
        }
        else {
            // 기본: 도움말 또는 요약 표시
            console.log('\n사용법: /impact annotations [generate [path]] [view [path]]');
            console.log('  generate [path]  보강 주석 생성 (선택: 특정 경로)');
            console.log('  view [path]      보강 주석 조회 (선택: 특정 경로)');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: 'Annotations command usage displayed.',
            };
        }
    }
    /**
     * generate 서브커맨드 처리
     */
    async handleGenerate(targetPath) {
        try {
            // 1. 활성 프로젝트 확인
            const { projectId, projectPath } = await this.getActiveProject();
            // 2. 인덱스 로드
            const indexer = new indexer_1.Indexer();
            const codeIndex = await indexer.loadIndex(projectId);
            if (!codeIndex) {
                logger_1.logger.error('인덱스가 없습니다. 먼저 reindex를 실행해주세요.');
                return {
                    code: common_1.ResultCode.NEEDS_INDEX,
                    message: '인덱스가 없습니다. 먼저 reindex를 실행해주세요.',
                };
            }
            // 3. 대상 파일 결정
            let targetFiles = codeIndex.files;
            if (targetPath) {
                const normalizedTarget = targetPath.replace(/\\/g, '/');
                targetFiles = codeIndex.files.filter(f => f.path.replace(/\\/g, '/').startsWith(normalizedTarget));
                if (targetFiles.length === 0) {
                    logger_1.logger.warn(`경로 "${targetPath}"에 해당하는 파일이 없습니다.`);
                    return {
                        code: common_1.ResultCode.SUCCESS,
                        message: `경로 "${targetPath}"에 해당하는 파일이 없습니다.`,
                    };
                }
            }
            logger_1.logger.header('Impact Checker - 보강 주석 생성');
            console.log(`\n프로젝트: ${projectId}`);
            console.log(`대상 파일: ${targetFiles.length}개`);
            if (targetPath) {
                console.log(`필터 경로: ${targetPath}`);
            }
            console.log('');
            const annotationManager = new annotation_manager_1.AnnotationManager();
            const annotationGenerator = new annotation_generator_1.AnnotationGenerator();
            const startTime = Date.now();
            // 4. 파일별 sourceHash로 변경 여부 확인 & 파싱 대상 수집
            const filesToGenerate = [];
            // 파일 파싱을 위해 인덱서의 내부 파싱 기능은 직접 사용 불가
            // 대신 TypeScriptParser를 직접 사용
            const { TypeScriptParser } = await Promise.resolve().then(() => __importStar(require('../core/indexing/parsers/typescript-parser')));
            const parser = new TypeScriptParser();
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            for (let i = 0; i < targetFiles.length; i++) {
                const file = targetFiles[i];
                const absolutePath = path.join(projectPath, file.path);
                // 파일 존재 확인
                if (!fs.existsSync(absolutePath)) {
                    continue;
                }
                // sourceHash로 변경 여부 확인
                const isChanged = await annotationManager.isChanged(projectId, file.path, file.hash);
                if (!isChanged) {
                    continue;
                }
                // 파서가 지원하는 파일인지 확인
                if (!parser.canParse(file.path)) {
                    continue;
                }
                try {
                    const content = fs.readFileSync(absolutePath, 'utf-8');
                    const parsedFile = await parser.parse(file.path, content);
                    if (parsedFile.functions.length > 0) {
                        filesToGenerate.push({ filePath: file.path, parsedFile });
                    }
                }
                catch (_err) {
                    // 파싱 실패 시 건너뛰기
                    logger_1.logger.debug(`파싱 실패: ${file.path}`);
                }
            }
            if (filesToGenerate.length === 0) {
                console.log('변경된 파일이 없거나, 분석 대상 함수가 없습니다.');
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: '분석 대상 파일 없음.',
                };
            }
            console.log(`분석 대상: ${filesToGenerate.length}개 파일\n`);
            // 5. 배치 생성
            let totalFunctions = 0;
            let totalPolicies = 0;
            const generated = await annotationGenerator.generateBatch(filesToGenerate, projectPath, (current, total, filePath) => {
                console.log(`[${current}/${total}] ${filePath} 분석 중...`);
            });
            // 6. 기존 보강 주석과 병합 후 저장
            for (const [filePath, newAnnotation] of generated) {
                const existing = await annotationManager.load(projectId, filePath);
                let toSave = newAnnotation;
                if (existing) {
                    // userModified 보존 병합
                    toSave = await annotationManager.merge(existing, newAnnotation);
                }
                await annotationManager.save(projectId, filePath, toSave);
                totalFunctions += toSave.annotations.length;
                for (const ann of toSave.annotations) {
                    totalPolicies += ann.policies ? ann.policies.length : 0;
                }
            }
            // 7. 메타 갱신
            await annotationManager.updateMeta(projectId);
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            // 8. 완료 요약
            logger_1.logger.separator();
            console.log('\n보강 주석 생성 완료:');
            console.log(`  분석 파일 수:   ${generated.size}`);
            console.log(`  함수 수:        ${totalFunctions}`);
            console.log(`  추론 정책 수:   ${totalPolicies}`);
            console.log(`  소요 시간:      ${elapsedSec}s`);
            logger_1.logger.separator();
            logger_1.logger.success('보강 주석 생성이 완료되었습니다!');
            return {
                code: common_1.ResultCode.SUCCESS,
                message: `Annotations generated for ${generated.size} files.`,
                data: {
                    projectId,
                    filesAnalyzed: generated.size,
                    totalFunctions,
                    totalPolicies,
                    elapsedSeconds: parseFloat(elapsedSec),
                },
            };
        }
        catch (err) {
            if (err instanceof ProjectNotFoundError) {
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: err.message,
                };
            }
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`보강 주석 생성 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Annotations generate failed: ${errorMsg}`,
            };
        }
    }
    /**
     * view 서브커맨드 처리
     */
    async handleView(targetPath) {
        try {
            // 1. 활성 프로젝트 확인
            const { projectId } = await this.getActiveProject();
            const annotationManager = new annotation_manager_1.AnnotationManager();
            if (targetPath) {
                // 특정 파일 보강 주석 조회
                const annotation = await annotationManager.load(projectId, targetPath);
                if (!annotation) {
                    console.log(`\n"${targetPath}"의 보강 주석이 없습니다. generate를 먼저 실행해주세요.`);
                    return {
                        code: common_1.ResultCode.SUCCESS,
                        message: '보강 주석이 없습니다. generate를 먼저 실행해주세요.',
                    };
                }
                logger_1.logger.header(`보강 주석: ${targetPath}`);
                console.log(`\n시스템: ${annotation.system}`);
                console.log(`분석 시각: ${annotation.lastAnalyzed}`);
                console.log(`분석 엔진: ${annotation.analyzerVersion} (${annotation.model})`);
                console.log(`파일 요약: ${annotation.fileSummary.description}`);
                console.log('');
                for (const ann of annotation.annotations) {
                    console.log(`  [${ann.type}] ${ann.function}`);
                    console.log(`    주석: ${ann.enriched_comment}`);
                    console.log(`    신뢰도: ${(ann.confidence * 100).toFixed(0)}%`);
                    if (ann.userModified) {
                        console.log(`    (사용자 수정됨)`);
                    }
                    if (ann.policies && ann.policies.length > 0) {
                        console.log(`    정책:`);
                        for (const policy of ann.policies) {
                            console.log(`      - ${policy.name} (${policy.category}, ${(policy.confidence * 100).toFixed(0)}%)`);
                        }
                    }
                    console.log('');
                }
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: `Annotation view for ${targetPath}`,
                    data: { projectId, file: targetPath, annotation },
                };
            }
            else {
                // 전체 통계 표시
                const meta = await annotationManager.getMeta(projectId);
                if (!meta) {
                    console.log('\n보강 주석이 없습니다. generate를 먼저 실행해주세요.');
                    return {
                        code: common_1.ResultCode.SUCCESS,
                        message: '보강 주석이 없습니다. generate를 먼저 실행해주세요.',
                    };
                }
                logger_1.logger.header('보강 주석 통계');
                console.log(`\n프로젝트: ${projectId}`);
                console.log(`버전: ${meta.version}`);
                console.log(`생성: ${meta.createdAt}`);
                console.log(`업데이트: ${meta.lastUpdatedAt}`);
                console.log('');
                console.log(`  전체 파일 수:       ${meta.totalFiles}`);
                console.log(`  전체 보강 주석 수:  ${meta.totalAnnotations}`);
                console.log(`  전체 정책 수:       ${meta.totalPolicies}`);
                console.log(`  평균 신뢰도:        ${(meta.avgConfidence * 100).toFixed(0)}%`);
                console.log(`  낮은 신뢰도:        ${meta.lowConfidenceCount}건`);
                console.log(`  사용자 수정:        ${meta.userModifiedCount}건`);
                console.log('');
                // 시스템별 통계
                const systemNames = Object.keys(meta.systems);
                if (systemNames.length > 0) {
                    console.log('  시스템별:');
                    for (const sysName of systemNames) {
                        const sys = meta.systems[sysName];
                        console.log(`    ${sysName}: ${sys.files}파일, ${sys.annotations}주석, ${sys.policies}정책`);
                    }
                    console.log('');
                }
                // 최근 보강 주석 파일 목록 (최신 5개)
                const allAnnotations = await annotationManager.loadAll(projectId);
                if (allAnnotations.size > 0) {
                    const sorted = Array.from(allAnnotations.entries())
                        .sort((a, b) => {
                        const dateA = new Date(a[1].lastAnalyzed).getTime();
                        const dateB = new Date(b[1].lastAnalyzed).getTime();
                        return dateB - dateA;
                    })
                        .slice(0, 5);
                    console.log('  최근 분석 파일:');
                    for (const [filePath, ann] of sorted) {
                        console.log(`    ${filePath} (${ann.annotations.length}개 함수, ${ann.lastAnalyzed})`);
                    }
                    console.log('');
                }
                return {
                    code: common_1.ResultCode.SUCCESS,
                    message: 'Annotation statistics displayed.',
                    data: { projectId, meta },
                };
            }
        }
        catch (err) {
            if (err instanceof ProjectNotFoundError) {
                return {
                    code: common_1.ResultCode.NEEDS_CONFIG,
                    message: err.message,
                };
            }
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`보강 주석 조회 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Annotations view failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 활성 프로젝트 정보를 가져온다.
     * @throws {ProjectNotFoundError} 프로젝트가 설정되지 않았거나 찾을 수 없을 때
     */
    async getActiveProject() {
        const configManager = new config_manager_1.ConfigManager();
        await configManager.load();
        const activeProjectId = configManager.getActiveProject();
        if (!activeProjectId) {
            throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
        }
        const impactDir = (0, file_1.getImpactDir)();
        const projectsPath = path.join(impactDir, 'projects.json');
        const projectsConfig = (0, file_1.readJsonFile)(projectsPath);
        if (!projectsConfig) {
            throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
        }
        const project = projectsConfig.projects.find(p => p.id === activeProjectId);
        if (!project) {
            throw new ProjectNotFoundError(`프로젝트를 찾을 수 없습니다: ${activeProjectId}`);
        }
        return { projectId: activeProjectId, projectPath: project.path };
    }
}
exports.AnnotationsCommand = AnnotationsCommand;
/**
 * 프로젝트 미설정/미존재 에러
 */
class ProjectNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProjectNotFoundError';
    }
}
//# sourceMappingURL=annotations.js.map