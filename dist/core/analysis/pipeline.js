"use strict";
/**
 * @module core/analysis/pipeline
 * @description 분석 파이프라인 오케스트레이터 - 전체 분석 파이프라인 실행
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
exports.AnalysisPipeline = void 0;
const spec_parser_1 = require("../spec/spec-parser");
const matcher_1 = require("./matcher");
const analyzer_1 = require("./analyzer");
const scorer_1 = require("./scorer");
const policy_matcher_1 = require("./policy-matcher");
const owner_mapper_1 = require("./owner-mapper");
const confidence_scorer_1 = require("./confidence-scorer");
const result_manager_1 = require("./result-manager");
const indexer_1 = require("../indexing/indexer");
const annotation_loader_1 = require("../annotations/annotation-loader");
const file_1 = require("../../utils/file");
const logger_1 = require("../../utils/logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * AnalysisPipeline - 전체 분석 파이프라인 오케스트레이터
 *
 * Step 1: 기획서 파싱 (SpecParser)
 * Step 2: 인덱스 매칭 (IndexMatcher)
 * Step 3: 영향도 분석 (ImpactAnalyzer)
 * Step 4: 점수 산출 (Scorer)
 * Step 5: 정책 매칭 + 담당자 매핑 (PolicyMatcher + OwnerMapper)
 * Step 6: 신뢰도 산출 (ConfidenceScorer)
 */
class AnalysisPipeline {
    constructor(basePath) {
        this.specParser = new spec_parser_1.SpecParser();
        this.indexMatcher = new matcher_1.IndexMatcher();
        this.impactAnalyzer = new analyzer_1.ImpactAnalyzer();
        this.scorer = new scorer_1.Scorer();
        this.policyMatcher = new policy_matcher_1.PolicyMatcher();
        this.ownerMapper = new owner_mapper_1.OwnerMapper();
        this.confidenceScorer = new confidence_scorer_1.ConfidenceScorer();
        this.resultManager = new result_manager_1.ResultManager(basePath);
        this.indexer = new indexer_1.Indexer();
    }
    /**
     * 진행률 콜백 설정
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }
    /**
     * 전체 분석 파이프라인 실행
     *
     * Tech design에서는 7단계 파이프라인을 정의하지만, run()은 6단계로 구현됩니다.
     * 7번째 단계(결과 직렬화/저장)는 별도의 saveResult() 메서드로 분리되어 있습니다.
     * 이는 호출자가 분석 결과를 저장 전에 검사하거나 수정할 수 있도록
     * 의도적으로 설계된 구조입니다.
     *
     * Design-to-implementation step mapping:
     *   Design Step 1 → run() Step 1: 기획서 파싱 (SpecParser)
     *   Design Step 2 → run() Step 2: 인덱스 매칭 (IndexMatcher)
     *   Design Step 3 → run() Step 3: 영향도 분석 (ImpactAnalyzer)
     *   Design Step 4 → run() Step 4: 점수 산출 (Scorer)
     *   Design Step 5 → run() Step 5: 정책 매칭 + 담당자 매핑 (PolicyMatcher + OwnerMapper)
     *   Design Step 6 → run() Step 6: 신뢰도 산출 (ConfidenceScorer)
     *   Design Step 7 → saveResult(): 결과 직렬화/저장 (ResultManager)
     *
     * @param input - 기획서 입력
     * @param projectId - 프로젝트 ID
     * @param basePath - Base path for loading the code index and owners config.
     *   Note: This is separate from the constructor's `basePath` which is used
     *   for result storage (via ResultManager). If the caller wants both to
     *   refer to the same directory, pass the same value to both the
     *   constructor and this method.
     * @returns 신뢰도 보강 결과
     */
    async run(input, projectId, basePath) {
        const totalSteps = 6;
        // Step 1: 기획서 파싱
        this.reportProgress(1, totalSteps, '기획서 파싱 중...');
        logger_1.logger.info('Step 1/6: Parsing spec...');
        const parsedSpec = await this.specParser.parse(input);
        logger_1.logger.info(`  Title: ${parsedSpec.title}`);
        logger_1.logger.info(`  Features: ${parsedSpec.features.length}`);
        logger_1.logger.info(`  Keywords: ${parsedSpec.keywords.length}`);
        // 코드 인덱스 로드
        let index = await this.loadCodeIndex(projectId, basePath);
        if (!index) {
            throw new Error(`Code index not found for project "${projectId}". ` +
                `Run "init" or "reindex" first.`);
        }
        // 인덱스 자동 갱신: stale 체크 후 증분 업데이트
        index = await this.autoRefreshIndex(index, projectId, basePath);
        // Step 2: 인덱스 매칭
        this.reportProgress(2, totalSteps, '코드 인덱스 매칭 중...');
        logger_1.logger.info('Step 2/6: Matching index...');
        const matched = this.indexMatcher.match(parsedSpec, index);
        // Step 3: 영향도 분석
        this.reportProgress(3, totalSteps, '영향도 분석 중...');
        logger_1.logger.info('Step 3/6: Analyzing impact...');
        const impactResult = await this.impactAnalyzer.analyze(parsedSpec, matched, index);
        // Step 4: 점수 산출
        this.reportProgress(4, totalSteps, '점수 산출 중...');
        logger_1.logger.info('Step 4/6: Scoring...');
        const scoredResult = await this.scorer.score(impactResult);
        // Step 5: 정책 매칭 + 담당자 매핑
        this.reportProgress(5, totalSteps, '정책 매칭 및 담당자 매핑 중...');
        logger_1.logger.info('Step 5/6: Matching policies and mapping owners...');
        const policyWarnings = this.policyMatcher.match(impactResult, index.policies);
        const ownersConfig = this.loadOwnersConfig(projectId, basePath);
        const ownerNotifications = this.ownerMapper.map(impactResult, ownersConfig);
        const enrichedResult = {
            ...scoredResult,
            policyWarnings,
            ownerNotifications,
        };
        // 보강 주석 로드 (선택적)
        let annotations;
        try {
            const annotationLoader = new annotation_loader_1.AnnotationLoader(basePath);
            annotations = await annotationLoader.loadForProject(projectId);
            if (annotations.size > 0) {
                logger_1.logger.info(`보강 주석 ${annotations.size}개 파일 로드됨`);
            }
        }
        catch (err) {
            logger_1.logger.debug(`보강 주석 로드 실패 (분석 계속): ${err instanceof Error ? err.message : String(err)}`);
        }
        // Step 6: 신뢰도 산출
        this.reportProgress(6, totalSteps, '신뢰도 산출 중...');
        logger_1.logger.info('Step 6/6: Calculating confidence...');
        const confidenceScores = this.confidenceScorer.calculate(enrichedResult, index, annotations);
        // 낮은 신뢰도 경고 수집
        const lowConfidenceWarnings = confidenceScores
            .filter(c => c.grade === 'low' || c.grade === 'very_low')
            .map(c => ({
            systemId: c.systemId,
            systemName: c.systemName,
            confidenceScore: c.overallScore,
            grade: c.grade,
            reason: c.warnings.join('; ') || '분석 데이터가 불충분합니다.',
            action: c.recommendations.join('; ') || '인덱스를 갱신하세요.',
        }));
        const finalResult = {
            ...enrichedResult,
            confidenceScores,
            lowConfidenceWarnings,
        };
        logger_1.logger.info('Analysis pipeline complete!');
        return finalResult;
    }
    /**
     * 결과 직렬화 및 저장 (Design Step 7)
     *
     * run()과 분리된 이유: 호출자가 분석 결과를 저장 전에 검사하거나
     * 수정(예: 필터링, 추가 보강)할 수 있도록 하기 위함입니다.
     *
     * @param result - 분석 결과
     * @param projectId - 프로젝트 ID
     * @returns 결과 ID
     */
    async saveResult(result, projectId) {
        return this.resultManager.save(result, projectId, result.specTitle);
    }
    /**
     * 코드 인덱스 로드
     */
    async loadCodeIndex(projectId, basePath) {
        return this.indexer.loadIndex(projectId, basePath);
    }
    /**
     * 담당자 설정 로드
     */
    loadOwnersConfig(projectId, basePath) {
        const projectDir = (0, file_1.getProjectDir)(projectId, basePath);
        const ownersPath = path.join(projectDir, 'owners.json');
        if (fs.existsSync(ownersPath)) {
            const config = (0, file_1.readJsonFile)(ownersPath);
            if (config)
                return config;
        }
        // 기본 빈 설정
        return { systems: [] };
    }
    /**
     * 인덱스 자동 갱신
     *
     * 인덱스가 stale(최신이 아닌) 상태인지 확인하고,
     * stale이면 증분 업데이트를 수행한다.
     * 에러 발생 시 기존 인덱스로 폴백하여 분석을 중단하지 않는다.
     *
     * @param currentIndex - 현재 로드된 코드 인덱스
     * @param projectId - 프로젝트 ID
     * @param basePath - 기본 경로
     * @returns 갱신된 인덱스 또는 기존 인덱스
     */
    async autoRefreshIndex(currentIndex, projectId, basePath) {
        const projectPath = currentIndex.meta.project.path;
        if (!projectPath) {
            logger_1.logger.debug('No project path in index meta, skipping auto-refresh');
            return currentIndex;
        }
        try {
            const isStale = await this.indexer.isIndexStale(projectPath, projectId, basePath);
            if (!isStale) {
                return currentIndex;
            }
            // 변경 감지됨 - 증분 업데이트 실행
            logger_1.logger.info('변경 감지: 증분 업데이트 중...');
            const updatedIndex = await this.indexer.incrementalUpdate(projectPath, projectId, basePath);
            // 업데이트된 인덱스 저장
            await this.indexer.saveIndex(updatedIndex, projectId, basePath);
            logger_1.logger.info('인덱스 자동 갱신 완료');
            return updatedIndex;
        }
        catch (err) {
            // 에러 발생 시 기존 인덱스로 폴백
            logger_1.logger.warn(`인덱스 자동 갱신 실패, 기존 인덱스 사용: ${err instanceof Error ? err.message : String(err)}`);
            return currentIndex;
        }
    }
    /**
     * 진행률 보고
     */
    reportProgress(step, totalSteps, message) {
        if (this.onProgress) {
            this.onProgress(step, totalSteps, message);
        }
    }
}
exports.AnalysisPipeline = AnalysisPipeline;
//# sourceMappingURL=pipeline.js.map