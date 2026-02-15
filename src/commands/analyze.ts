/**
 * @module commands/analyze
 * @description Analyze 명령어 핸들러 - 기획서를 입력받아 영향도를 분석
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { LLMRouter, ProviderRegistry } from '../llm/router';
import { AnalysisPipeline } from '../core/analysis/pipeline';
import { SpecInput } from '../core/spec/spec-parser';
import { readJsonFile } from '../utils/file';
import { ProjectsConfig } from '../types/index';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/config-manager';
import { AnthropicProvider } from '../llm/anthropic';
import { OpenAIProvider } from '../llm/openai';
import { GoogleProvider } from '../llm/google';

/**
 * AnalyzeCommand - 영향도 분석 명령어
 *
 * 사용법: /impact analyze [--file <path>] [--project <id>]
 * 기능:
 *   - 기획서 파싱
 *   - 인덱스 매칭
 *   - LLM 영향도 분석
 *   - 점수 산출
 *   - 결과 저장
 */
export class AnalyzeCommand implements Command {
  readonly name = 'analyze';
  readonly description = '기획서를 입력받아 영향도를 분석합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // 옵션 파싱
      const filePath = this.getOption('--file');
      const projectId = this.getOption('--project');

      // 기획서 입력 준비
      const specInput = await this.prepareSpecInput(filePath);
      if (!specInput) {
        return {
          code: ResultCode.FAILURE,
          message: '기획서 입력을 준비할 수 없습니다. --file 옵션으로 파일을 지정하세요.',
        };
      }

      // 활성 프로젝트 결정
      const activeProjectId = projectId || this.getActiveProjectId();
      if (!activeProjectId) {
        return {
          code: ResultCode.NEEDS_CONFIG,
          message: '활성 프로젝트가 없습니다. "init" 명령어로 프로젝트를 등록하세요.',
        };
      }

      // LLM 라우터 설정 (저장된 설정에서 프로바이더 로드)
      const registry = new ProviderRegistry();
      const configManager = new ConfigManager();
      await configManager.load();
      const appConfig = configManager.getConfig();

      // 설정된 프로바이더 등록
      for (const [providerName, providerConfig] of Object.entries(appConfig.llm.providers)) {
        if (providerConfig.enabled && providerConfig.apiKey) {
          const apiKey = configManager.getApiKey(providerName);
          if (apiKey) {
            const provider = this.createProvider(providerName, apiKey);
            if (provider) {
              registry.register(provider);
              logger.debug(`Loaded LLM provider from config: ${providerName}`);
            }
          }
        }
      }

      const llmRouter = new LLMRouter(registry);

      // 설정된 라우팅 테이블 적용
      if (appConfig.llm.routing) {
        for (const [task, provider] of Object.entries(appConfig.llm.routing)) {
          llmRouter.setRoute(task as any, provider);
        }
      }

      // 파이프라인 실행
      const pipeline = new AnalysisPipeline(llmRouter);
      pipeline.setProgressCallback((step, total, message) => {
        const percent = Math.round((step / total) * 100);
        console.log(`  [${step}/${total}] (${percent}%) ${message}`);
      });

      logger.header('영향도 분석 시작');
      console.log(`  프로젝트: ${activeProjectId}`);
      console.log(`  입력 유형: ${specInput.type}`);
      console.log('');

      const result = await pipeline.run(specInput, activeProjectId);

      // 결과 저장
      const resultId = await pipeline.saveResult(result, activeProjectId);

      // 결과 요약 출력
      logger.separator();
      console.log('');
      console.log(`  분석 완료!`);
      console.log(`  ─────────────────────────────────`);
      console.log(`  기획서: ${result.specTitle}`);
      console.log(`  총점: ${result.totalScore.toFixed(1)}`);
      console.log(`  등급: ${result.grade}`);
      console.log(`  영향 화면: ${result.affectedScreens.length}개`);
      console.log(`  작업 수: ${result.tasks.length}개`);
      console.log(`  정책 경고: ${result.policyWarnings.length}개`);
      console.log(`  담당자 알림: ${result.ownerNotifications.length}명`);
      console.log(`  ─────────────────────────────────`);
      console.log(`  권고: ${result.recommendation}`);
      console.log('');

      // 낮은 신뢰도 경고
      if (result.lowConfidenceWarnings.length > 0) {
        console.log(`  [주의] 낮은 신뢰도 항목:`);
        for (const w of result.lowConfidenceWarnings) {
          console.log(`    - ${w.systemName}: ${w.reason}`);
        }
        console.log('');
      }

      console.log(`  결과 저장: ${resultId}`);
      console.log(`  상세 확인: /impact view --result ${resultId}`);

      return {
        code: ResultCode.SUCCESS,
        message: `분석 완료. 등급: ${result.grade}, 총점: ${result.totalScore.toFixed(1)}`,
        data: result,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Analysis failed: ${errMsg}`);

      return {
        code: ResultCode.FAILURE,
        message: `분석 실패: ${errMsg}`,
      };
    }
  }

  /**
   * 기획서 입력 준비
   */
  private async prepareSpecInput(filePath?: string): Promise<SpecInput | null> {
    if (filePath) {
      const absPath = path.resolve(filePath);
      if (!fs.existsSync(absPath)) {
        console.log(`  파일을 찾을 수 없습니다: ${absPath}`);
        return null;
      }

      const ext = path.extname(absPath).toLowerCase();
      if (ext === '.pdf') {
        return { type: 'pdf', filePath: absPath };
      }

      // 텍스트 파일로 읽기
      const content = fs.readFileSync(absPath, 'utf-8');
      return { type: 'text', content };
    }

    // 인자에서 텍스트 가져오기
    const textArgs = this.args.filter(a => !a.startsWith('--'));
    if (textArgs.length > 0) {
      return { type: 'text', content: textArgs.join(' ') };
    }

    // stdin 안내
    console.log('');
    console.log('  사용법:');
    console.log('    /impact analyze --file <기획서.txt>');
    console.log('    /impact analyze --file <기획서.pdf>');
    console.log('');
    return null;
  }

  /**
   * 활성 프로젝트 ID 가져오기
   */
  private getActiveProjectId(): string | null {
    const home = process.env.HOME || process.env.USERPROFILE || '.';
    const projectsPath = path.join(home, '.impact', 'projects.json');

    if (!fs.existsSync(projectsPath)) {
      return null;
    }

    const config = readJsonFile<ProjectsConfig>(projectsPath);
    return config?.activeProject || null;
  }

  /**
   * 옵션 값 가져오기
   */
  private getOption(name: string): string | undefined {
    const idx = this.args.indexOf(name);
    if (idx !== -1 && this.args[idx + 1]) {
      return this.args[idx + 1];
    }
    return undefined;
  }

  /**
   * 프로바이더 이름으로 LLM 프로바이더 인스턴스 생성
   * @param providerName - 프로바이더 이름 (anthropic, openai, google)
   * @param apiKey - 복호화된 API 키
   * @returns LLM 프로바이더 인스턴스 또는 null
   */
  private createProvider(providerName: string, apiKey: string): AnthropicProvider | OpenAIProvider | GoogleProvider | null {
    switch (providerName) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'google':
        return new GoogleProvider(apiKey);
      default:
        logger.warn(`Unknown LLM provider: ${providerName}`);
        return null;
    }
  }
}
