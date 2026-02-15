/**
 * @module core/spec/spec-parser
 * @description 기획서 파서 - 기획서를 파싱하여 구조화된 결과 반환
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMRouter, NoProviderConfiguredError } from '../../llm/router';
import { ParsedSpec, Feature, Requirement, BusinessRule } from '../../types/analysis';
import { Message } from '../../types/llm';
import { logger } from '../../utils/logger';

/** 기획서 입력 타입 */
export interface SpecInput {
  /** 입력 유형 */
  type: 'text' | 'pdf';
  /** 텍스트 직접 입력 */
  content?: string;
  /** PDF 파일 경로 */
  filePath?: string;
}

/**
 * SpecParser - 기획서를 파싱하여 구조화된 결과 반환
 *
 * LLM을 사용하여 기획서를 ParsedSpec 타입으로 구조화.
 * LLM 미설정 시 키워드 기반 폴백 모드로 동작.
 */
export class SpecParser {
  private readonly llmRouter: LLMRouter;

  /**
   * SpecParser 생성
   * @param llmRouter - LLM 라우터 인스턴스
   */
  constructor(llmRouter: LLMRouter) {
    this.llmRouter = llmRouter;
  }

  /**
   * 기획서를 파싱하여 구조화된 결과 반환
   * @param input - 기획서 입력
   * @returns 파싱된 기획서
   */
  async parse(input: SpecInput): Promise<ParsedSpec> {
    if (input.type === 'pdf') {
      return this.parsePdf(input.filePath!);
    }
    return this.parseText(input.content!);
  }

  /**
   * 텍스트 입력 처리
   * @param text - 기획서 텍스트
   * @returns 파싱된 기획서
   */
  private async parseText(text: string): Promise<ParsedSpec> {
    try {
      return await this.parseWithLLM(text);
    } catch (err) {
      if (err instanceof NoProviderConfiguredError) {
        logger.warn('LLM not configured. Using fallback keyword-based parsing.');
        return this.fallbackParse(text);
      }
      throw err;
    }
  }

  /**
   * PDF 입력 처리
   * @param filePath - PDF 파일 경로
   * @returns 파싱된 기획서
   */
  private async parsePdf(filePath: string): Promise<ParsedSpec> {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`PDF file not found: ${absolutePath}`);
    }

    const text = await this.extractTextFromPdf(absolutePath);
    return this.parseText(text);
  }

  /**
   * PDF에서 텍스트 추출
   * @param filePath - PDF 파일 절대 경로
   * @returns 추출된 텍스트
   */
  private async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const result = await pdfParse(buffer);
      return result.text;
    } catch (err) {
      throw new Error(
        `Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * LLM을 사용한 기획서 파싱
   * @param text - 기획서 텍스트
   * @returns 파싱된 기획서
   */
  private async parseWithLLM(text: string): Promise<ParsedSpec> {
    const provider = this.llmRouter.route('spec-parsing');
    const promptTemplate = this.loadPromptTemplate();
    const prompt = promptTemplate.replace('{기획서 원문}', text);

    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    logger.info('Parsing spec with LLM...');
    const response = await provider.chat(messages, {
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 4096,
    });

    const parsed = this.parseLLMResponse(response.content);
    return this.enrichParsedSpec(parsed, text);
  }

  /**
   * LLM 응답을 파싱하여 구조화된 결과로 변환
   * @param content - LLM 응답 내용
   * @returns 파싱된 결과 (ParsedSpec 부분)
   */
  private parseLLMResponse(content: string): Partial<ParsedSpec> {
    // JSON 코드 블록이 있으면 추출
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error(
        'LLM response is not valid JSON. Please check the LLM configuration and prompt template.'
      );
    }
  }

  /**
   * LLM 파싱 결과를 완전한 ParsedSpec으로 보강
   * @param partial - 부분 파싱 결과
   * @param originalText - 원본 텍스트
   * @returns 완전한 ParsedSpec
   */
  private enrichParsedSpec(partial: Partial<ParsedSpec>, originalText: string): ParsedSpec {
    const features: Feature[] = (partial.features || []).map((f, i) => ({
      id: f.id || `F-${String(i + 1).padStart(3, '0')}`,
      name: f.name || '',
      description: f.description || '',
      targetScreen: f.targetScreen || '',
      actionType: f.actionType || 'modify',
      keywords: f.keywords || [],
    }));

    const requirements: Requirement[] = (partial.requirements || []).map((r, i) => ({
      id: r.id || `R-${String(i + 1).padStart(3, '0')}`,
      name: r.name || '',
      description: r.description || '',
      priority: r.priority || 'should',
      relatedFeatures: r.relatedFeatures || [],
    }));

    const businessRules: BusinessRule[] = (partial.businessRules || []).map((b, i) => ({
      id: b.id || `BR-${String(i + 1).padStart(3, '0')}`,
      description: b.description || '',
      relatedFeatures: b.relatedFeatures || [],
    }));

    // 모든 기능의 키워드를 수집
    const allKeywords = new Set<string>();
    features.forEach(f => f.keywords.forEach(k => allKeywords.add(k)));
    if (partial.keywords) {
      partial.keywords.forEach(k => allKeywords.add(k));
    }

    // 대상 화면 수집
    const targetScreens = new Set<string>();
    features.forEach(f => {
      if (f.targetScreen) targetScreens.add(f.targetScreen);
    });
    if (partial.targetScreens) {
      partial.targetScreens.forEach(s => targetScreens.add(s));
    }

    return {
      title: partial.title || this.extractTitle(originalText),
      requirements,
      features,
      businessRules,
      targetScreens: Array.from(targetScreens),
      keywords: Array.from(allKeywords),
      ambiguities: partial.ambiguities || [],
    };
  }

  /**
   * 텍스트에서 제목 추출 (폴백)
   * @param text - 기획서 텍스트
   * @returns 추출된 제목
   */
  private extractTitle(text: string): string {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return '제목 없음';

    // 첫 번째 비어있지 않은 줄을 제목으로 사용
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  }

  /**
   * 프롬프트 템플릿 로드
   * @returns 프롬프트 템플릿 문자열
   */
  private loadPromptTemplate(): string {
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prompts',
      'parse-spec.prompt.md'
    );

    try {
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf-8');
      }
    } catch {
      logger.debug('Failed to load prompt template, using default.');
    }

    // 기본 프롬프트
    return `당신은 소프트웨어 기획서 분석 전문가입니다.
주어진 기획서를 분석하여 JSON으로 변환하세요.

<spec>
{기획서 원문}
</spec>

다음 JSON 형식으로 출력하세요:
{
  "title": "기획 제목",
  "features": [{ "id": "F-001", "name": "", "description": "", "targetScreen": "", "actionType": "new|modify|config", "keywords": [] }],
  "businessRules": [{ "id": "BR-001", "description": "", "relatedFeatures": [] }],
  "ambiguities": []
}`;
  }

  /**
   * LLM 없이 키워드 기반 간단 파싱 (폴백 모드)
   * @param text - 기획서 텍스트
   * @returns 폴백 파싱 결과
   */
  fallbackParse(text: string): ParsedSpec {
    logger.info('Using fallback keyword-based parsing...');

    const title = this.extractTitle(text);

    // 키워드 추출: 한글/영문 의미 있는 단어 추출
    const keywords = this.extractKeywords(text);

    // 간단한 기능 추출: 번호가 매겨진 항목이나 '기능', 'feature' 등의 키워드 근처
    const features = this.extractFeaturesFromText(text);

    // 비즈니스 규칙 추출
    const businessRules = this.extractBusinessRulesFromText(text);

    // 대상 화면 추출
    const targetScreens = this.extractTargetScreensFromText(text);

    // 불명확한 사항
    const ambiguities: string[] = [];
    if (features.length === 0) {
      ambiguities.push('기획서에서 구체적인 기능 요구사항을 식별하지 못했습니다. LLM을 설정하면 더 정확한 분석이 가능합니다.');
    }

    return {
      title,
      requirements: features.map((f, i) => ({
        id: `R-${String(i + 1).padStart(3, '0')}`,
        name: f.name,
        description: f.description,
        priority: 'should' as const,
        relatedFeatures: [f.id],
      })),
      features,
      businessRules,
      targetScreens,
      keywords,
      ambiguities,
    };
  }

  /**
   * 텍스트에서 키워드 추출
   */
  private extractKeywords(text: string): string[] {
    const keywords = new Set<string>();

    // 기술 용어 패턴 매칭
    const techPatterns = [
      /(?:API|api)\s*[\/:]\s*([a-zA-Z0-9/\-_]+)/g,
      /(?:컴포넌트|component)\s*[:=]\s*([a-zA-Z0-9_]+)/gi,
      /(?:화면|screen|page)\s*[:=]\s*([^\s,]+)/gi,
    ];

    for (const pattern of techPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) keywords.add(match[1]);
      }
    }

    // camelCase/PascalCase 단어 추출
    const camelCaseMatches = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g) || [];
    camelCaseMatches.forEach(m => keywords.add(m));

    // 한글 주요 키워드 추출 (2글자 이상 명사 패턴)
    const koreanPatterns = [
      /(?:주문|배송|결제|회원|상품|쿠폰|포인트|장바구니|검색|필터|정렬|목록|상세|등록|수정|삭제|로그인|회원가입)/g,
    ];
    for (const pattern of koreanPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        keywords.add(match[0]);
      }
    }

    return Array.from(keywords);
  }

  /**
   * 텍스트에서 기능 추출
   */
  private extractFeaturesFromText(text: string): Feature[] {
    const features: Feature[] = [];
    const lines = text.split('\n');
    let featureCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 번호 매긴 항목 또는 마크다운 헤더를 기능으로 인식
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
      const headerMatch = line.match(/^#{2,3}\s+(.+)/);
      const bulletMatch = line.match(/^[-*]\s+(.+)/);

      let featureName: string | null = null;

      if (numberedMatch) {
        featureName = numberedMatch[2];
      } else if (headerMatch) {
        featureName = headerMatch[1];
      } else if (bulletMatch && this.looksLikeFeature(bulletMatch[1])) {
        featureName = bulletMatch[1];
      }

      if (featureName && featureName.length > 2) {
        featureCounter++;
        const description = this.getDescriptionForLine(lines, i);
        const actionType = this.inferActionType(featureName + ' ' + description);

        features.push({
          id: `F-${String(featureCounter).padStart(3, '0')}`,
          name: featureName,
          description: description || featureName,
          targetScreen: this.inferTargetScreen(featureName),
          actionType,
          keywords: this.extractKeywordsFromLine(featureName + ' ' + description),
        });
      }
    }

    return features;
  }

  /**
   * 줄이 기능 설명인지 판단
   */
  private looksLikeFeature(text: string): boolean {
    const featureIndicators = [
      '기능', '추가', '수정', '변경', '개선', '구현', '개발',
      '화면', '페이지', 'API', '버튼', '필터',
    ];
    return featureIndicators.some(indicator =>
      text.includes(indicator)
    );
  }

  /**
   * 라인의 다음 줄들에서 설명 추출
   */
  private getDescriptionForLine(lines: string[], lineIndex: number): string {
    const descriptions: string[] = [];
    for (let j = lineIndex + 1; j < lines.length && j < lineIndex + 4; j++) {
      const nextLine = lines[j].trim();
      if (nextLine.length === 0) break;
      if (/^(\d+\.|#{2,3}|[-*]\s)/.test(nextLine)) break;
      descriptions.push(nextLine);
    }
    return descriptions.join(' ');
  }

  /**
   * 작업 유형 추론
   */
  private inferActionType(text: string): 'new' | 'modify' | 'config' {
    if (/신규|새로운|추가|생성|new|create/i.test(text)) return 'new';
    if (/설정|config|환경|옵션|파라미터/i.test(text)) return 'config';
    return 'modify';
  }

  /**
   * 대상 화면 추론
   */
  private inferTargetScreen(text: string): string {
    const screenPatterns: [RegExp, string][] = [
      [/주문/, '주문 화면'],
      [/결제/, '결제 화면'],
      [/장바구니|카트/, '장바구니 화면'],
      [/상품\s*(목록|리스트)/, '상품 목록 화면'],
      [/상품\s*(상세|디테일)/, '상품 상세 화면'],
      [/로그인/, '로그인 화면'],
      [/회원가입/, '회원가입 화면'],
      [/마이페이지|내\s*정보/, '마이페이지'],
      [/검색/, '검색 화면'],
      [/배송/, '배송 화면'],
    ];

    for (const [pattern, screen] of screenPatterns) {
      if (pattern.test(text)) return screen;
    }
    return '';
  }

  /**
   * 줄에서 키워드 추출
   */
  private extractKeywordsFromLine(text: string): string[] {
    const keywords: string[] = [];
    const camelCase = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g) || [];
    keywords.push(...camelCase);

    const korean = text.match(/[가-힣]{2,}/g) || [];
    keywords.push(...korean.filter(k => k.length >= 2));

    return [...new Set(keywords)].slice(0, 10);
  }

  /**
   * 텍스트에서 비즈니스 규칙 추출
   */
  private extractBusinessRulesFromText(text: string): BusinessRule[] {
    const rules: BusinessRule[] = [];
    const rulePatterns = [
      /(?:규칙|rule|정책|policy|조건|condition)\s*[:：]\s*(.+)/gi,
      /(?:반드시|필수|must|항상|always)\s+(.+)/gi,
    ];

    let ruleCounter = 0;
    for (const pattern of rulePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        ruleCounter++;
        rules.push({
          id: `BR-${String(ruleCounter).padStart(3, '0')}`,
          description: match[1].trim(),
          relatedFeatures: [],
        });
      }
    }

    return rules;
  }

  /**
   * 텍스트에서 대상 화면 추출
   */
  private extractTargetScreensFromText(text: string): string[] {
    const screens = new Set<string>();
    const screenPatterns = [
      /(?:화면|screen|page|페이지)\s*[:：]\s*([^\n,]+)/gi,
      /(주문|결제|장바구니|상품|검색|마이페이지|로그인|회원가입|배송)\s*(화면|페이지)/g,
    ];

    for (const pattern of screenPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        screens.add(match[0].trim());
      }
    }

    return Array.from(screens);
  }
}
