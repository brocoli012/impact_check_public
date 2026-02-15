/**
 * @module core/analysis/pipeline
 * @description 분석 파이프라인 오케스트레이터 - 전체 분석 파이프라인 실행
 */

import { LLMRouter } from '../../llm/router';
import {
  ParsedSpec,
  MatchedEntities,
  ImpactResult,
  ScoredResult,
  EnrichedResult,
  ConfidenceEnrichedResult,
} from '../../types/analysis';
import { CodeIndex } from '../../types/index';
import { OwnersConfig } from '../../types/config';
import { SpecParser, SpecInput } from '../spec/spec-parser';
import { IndexMatcher } from './matcher';
import { ImpactAnalyzer } from './analyzer';
import { Scorer } from './scorer';
import { PolicyMatcher } from './policy-matcher';
import { OwnerMapper } from './owner-mapper';
import { ConfidenceScorer } from './confidence-scorer';
import { ResultManager } from './result-manager';
import { Indexer } from '../indexing/indexer';
import { readJsonFile, getProjectDir } from '../../utils/file';
import { logger } from '../../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

/** 파이프라인 진행 콜백 */
export type ProgressCallback = (step: number, totalSteps: number, message: string) => void;

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
export class AnalysisPipeline {
  private readonly specParser: SpecParser;
  private readonly indexMatcher: IndexMatcher;
  private readonly impactAnalyzer: ImpactAnalyzer;
  private readonly scorer: Scorer;
  private readonly policyMatcher: PolicyMatcher;
  private readonly ownerMapper: OwnerMapper;
  private readonly confidenceScorer: ConfidenceScorer;
  private readonly resultManager: ResultManager;
  private readonly indexer: Indexer;
  private onProgress?: ProgressCallback;

  constructor(llmRouter: LLMRouter, basePath?: string) {
    this.specParser = new SpecParser(llmRouter);
    this.indexMatcher = new IndexMatcher();
    this.impactAnalyzer = new ImpactAnalyzer(llmRouter);
    this.scorer = new Scorer(llmRouter);
    this.policyMatcher = new PolicyMatcher();
    this.ownerMapper = new OwnerMapper();
    this.confidenceScorer = new ConfidenceScorer();
    this.resultManager = new ResultManager(basePath);
    this.indexer = new Indexer();
  }

  /**
   * 진행률 콜백 설정
   */
  setProgressCallback(callback: ProgressCallback): void {
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
  async run(
    input: SpecInput,
    projectId: string,
    basePath?: string,
  ): Promise<ConfidenceEnrichedResult> {
    const totalSteps = 6;

    // Step 1: 기획서 파싱
    this.reportProgress(1, totalSteps, '기획서 파싱 중...');
    logger.info('Step 1/6: Parsing spec...');
    const parsedSpec: ParsedSpec = await this.specParser.parse(input);
    logger.info(`  Title: ${parsedSpec.title}`);
    logger.info(`  Features: ${parsedSpec.features.length}`);
    logger.info(`  Keywords: ${parsedSpec.keywords.length}`);

    // 코드 인덱스 로드
    const index = await this.loadCodeIndex(projectId, basePath);
    if (!index) {
      throw new Error(
        `Code index not found for project "${projectId}". ` +
        `Run "init" or "reindex" first.`
      );
    }

    // Step 2: 인덱스 매칭
    this.reportProgress(2, totalSteps, '코드 인덱스 매칭 중...');
    logger.info('Step 2/6: Matching index...');
    const matched: MatchedEntities = this.indexMatcher.match(parsedSpec, index);

    // Step 3: 영향도 분석
    this.reportProgress(3, totalSteps, '영향도 분석 중...');
    logger.info('Step 3/6: Analyzing impact...');
    const impactResult: ImpactResult = await this.impactAnalyzer.analyze(
      parsedSpec,
      matched,
      index,
    );

    // Step 4: 점수 산출
    this.reportProgress(4, totalSteps, '점수 산출 중...');
    logger.info('Step 4/6: Scoring...');
    const scoredResult: ScoredResult = await this.scorer.score(impactResult);

    // Step 5: 정책 매칭 + 담당자 매핑
    this.reportProgress(5, totalSteps, '정책 매칭 및 담당자 매핑 중...');
    logger.info('Step 5/6: Matching policies and mapping owners...');
    const policyWarnings = this.policyMatcher.match(impactResult, index.policies);
    const ownersConfig = this.loadOwnersConfig(projectId, basePath);
    const ownerNotifications = this.ownerMapper.map(impactResult, ownersConfig);

    const enrichedResult: EnrichedResult = {
      ...scoredResult,
      policyWarnings,
      ownerNotifications,
    };

    // Step 6: 신뢰도 산출
    this.reportProgress(6, totalSteps, '신뢰도 산출 중...');
    logger.info('Step 6/6: Calculating confidence...');
    const confidenceScores = this.confidenceScorer.calculate(enrichedResult, index);

    // 낮은 신뢰도 경고 수집
    const lowConfidenceWarnings = confidenceScores
      .filter(c => c.grade === 'low' || c.grade === 'very_low')
      .map(c => ({
        systemId: c.systemId,
        systemName: c.systemName,
        confidenceScore: c.overallScore,
        grade: c.grade,
        reason: c.warnings.join('; ') || '분석 데이터가 불충분합니다.',
        action: c.recommendations.join('; ') || '인덱스를 갱신하고 LLM을 설정하세요.',
      }));

    const finalResult: ConfidenceEnrichedResult = {
      ...enrichedResult,
      confidenceScores,
      lowConfidenceWarnings,
    };

    logger.info('Analysis pipeline complete!');
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
  async saveResult(
    result: ConfidenceEnrichedResult,
    projectId: string,
  ): Promise<string> {
    return this.resultManager.save(result, projectId, result.specTitle);
  }

  /**
   * 코드 인덱스 로드
   */
  private async loadCodeIndex(
    projectId: string,
    basePath?: string,
  ): Promise<CodeIndex | null> {
    return this.indexer.loadIndex(projectId, basePath);
  }

  /**
   * 담당자 설정 로드
   */
  private loadOwnersConfig(
    projectId: string,
    basePath?: string,
  ): OwnersConfig {
    const projectDir = getProjectDir(projectId, basePath);
    const ownersPath = path.join(projectDir, 'owners.json');

    if (fs.existsSync(ownersPath)) {
      const config = readJsonFile<OwnersConfig>(ownersPath);
      if (config) return config;
    }

    // 기본 빈 설정
    return { systems: [] };
  }

  /**
   * 진행률 보고
   */
  private reportProgress(step: number, totalSteps: number, message: string): void {
    if (this.onProgress) {
      this.onProgress(step, totalSteps, message);
    }
  }
}
