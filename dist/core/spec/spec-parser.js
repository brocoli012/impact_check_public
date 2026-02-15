"use strict";
/**
 * @module core/spec/spec-parser
 * @description 기획서 파서 - 기획서를 파싱하여 구조화된 결과 반환
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
exports.SpecParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
/**
 * SpecParser - 기획서를 파싱하여 구조화된 결과 반환
 *
 * 키워드 기반 규칙 파싱으로 기획서를 ParsedSpec 타입으로 구조화.
 * 외부에서 제공된 구조화 데이터도 parseFromStructuredInput()으로 수용 가능.
 */
class SpecParser {
    /**
     * 기획서를 파싱하여 구조화된 결과 반환
     * @param input - 기획서 입력
     * @returns 파싱된 기획서
     */
    async parse(input) {
        if (input.type === 'pdf') {
            return this.parsePdf(input.filePath);
        }
        return this.parseText(input.content);
    }
    /**
     * 텍스트 입력 처리 (키워드 기반 규칙 파싱)
     * @param text - 기획서 텍스트
     * @returns 파싱된 기획서
     */
    async parseText(text) {
        return this.parseKeywordBased(text);
    }
    /**
     * PDF 입력 처리
     * @param filePath - PDF 파일 경로
     * @returns 파싱된 기획서
     */
    async parsePdf(filePath) {
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
    async extractTextFromPdf(filePath) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pdfParse = require('pdf-parse');
            const buffer = fs.readFileSync(filePath);
            const result = await pdfParse(buffer);
            return result.text;
        }
        catch (err) {
            throw new Error(`Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    /**
     * 외부에서 제공된 구조화된 데이터를 검증하여 ParsedSpec으로 변환
     *
     * Claude 등 외부 시스템이 생성한 JSON 데이터를 수용합니다.
     * 필수 필드 검증 및 기본값 적용을 통해 안전한 ParsedSpec을 생성합니다.
     *
     * @param data - 외부에서 제공된 구조화된 데이터
     * @returns 검증된 ParsedSpec
     */
    parseFromStructuredInput(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid structured input: expected an object');
        }
        const input = data;
        const features = (Array.isArray(input.features) ? input.features : []).map((f, i) => ({
            id: String(f.id || `F-${String(i + 1).padStart(3, '0')}`),
            name: String(f.name || ''),
            description: String(f.description || ''),
            targetScreen: String(f.targetScreen || ''),
            actionType: (['new', 'modify', 'config'].includes(String(f.actionType)) ? String(f.actionType) : 'modify'),
            keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
        }));
        const requirements = (Array.isArray(input.requirements) ? input.requirements : []).map((r, i) => ({
            id: String(r.id || `R-${String(i + 1).padStart(3, '0')}`),
            name: String(r.name || ''),
            description: String(r.description || ''),
            priority: (['must', 'should', 'could', 'wont'].includes(String(r.priority)) ? String(r.priority) : 'should'),
            relatedFeatures: Array.isArray(r.relatedFeatures) ? r.relatedFeatures.map(String) : [],
        }));
        const businessRules = (Array.isArray(input.businessRules) ? input.businessRules : []).map((b, i) => ({
            id: String(b.id || `BR-${String(i + 1).padStart(3, '0')}`),
            description: String(b.description || ''),
            relatedFeatures: Array.isArray(b.relatedFeatures) ? b.relatedFeatures.map(String) : [],
        }));
        // 모든 기능의 키워드를 수집
        const allKeywords = new Set();
        features.forEach(f => f.keywords.forEach(k => allKeywords.add(k)));
        if (Array.isArray(input.keywords)) {
            input.keywords.forEach((k) => allKeywords.add(String(k)));
        }
        // 대상 화면 수집
        const targetScreens = new Set();
        features.forEach(f => {
            if (f.targetScreen)
                targetScreens.add(f.targetScreen);
        });
        if (Array.isArray(input.targetScreens)) {
            input.targetScreens.forEach((s) => targetScreens.add(String(s)));
        }
        return {
            title: String(input.title || '제목 없음'),
            requirements,
            features,
            businessRules,
            targetScreens: Array.from(targetScreens),
            keywords: Array.from(allKeywords),
            ambiguities: Array.isArray(input.ambiguities) ? input.ambiguities.map(String) : [],
        };
    }
    /**
     * 키워드 기반 규칙 파싱
     * @param text - 기획서 텍스트
     * @returns 파싱 결과
     */
    parseKeywordBased(text) {
        logger_1.logger.info('Using keyword-based parsing...');
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
        const ambiguities = [];
        if (features.length === 0) {
            ambiguities.push('기획서에서 구체적인 기능 요구사항을 식별하지 못했습니다.');
        }
        return {
            title,
            requirements: features.map((f, i) => ({
                id: `R-${String(i + 1).padStart(3, '0')}`,
                name: f.name,
                description: f.description,
                priority: 'should',
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
     * 텍스트에서 제목 추출
     * @param text - 기획서 텍스트
     * @returns 추출된 제목
     */
    extractTitle(text) {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length === 0)
            return '제목 없음';
        // 첫 번째 비어있지 않은 줄을 제목으로 사용
        const firstLine = lines[0].replace(/^#+\s*/, '').trim();
        return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
    }
    /**
     * 텍스트에서 키워드 추출
     */
    extractKeywords(text) {
        const keywords = new Set();
        // 기술 용어 패턴 매칭
        const techPatterns = [
            /(?:API|api)\s*[\/:]\s*([a-zA-Z0-9/\-_]+)/g,
            /(?:컴포넌트|component)\s*[:=]\s*([a-zA-Z0-9_]+)/gi,
            /(?:화면|screen|page)\s*[:=]\s*([^\s,]+)/gi,
        ];
        for (const pattern of techPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1])
                    keywords.add(match[1]);
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
    extractFeaturesFromText(text) {
        const features = [];
        const lines = text.split('\n');
        let featureCounter = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 번호 매긴 항목 또는 마크다운 헤더를 기능으로 인식
            const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
            const headerMatch = line.match(/^#{2,3}\s+(.+)/);
            const bulletMatch = line.match(/^[-*]\s+(.+)/);
            let featureName = null;
            if (numberedMatch) {
                featureName = numberedMatch[2];
            }
            else if (headerMatch) {
                featureName = headerMatch[1];
            }
            else if (bulletMatch && this.looksLikeFeature(bulletMatch[1])) {
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
    looksLikeFeature(text) {
        const featureIndicators = [
            '기능', '추가', '수정', '변경', '개선', '구현', '개발',
            '화면', '페이지', 'API', '버튼', '필터',
        ];
        return featureIndicators.some(indicator => text.includes(indicator));
    }
    /**
     * 라인의 다음 줄들에서 설명 추출
     */
    getDescriptionForLine(lines, lineIndex) {
        const descriptions = [];
        for (let j = lineIndex + 1; j < lines.length && j < lineIndex + 4; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.length === 0)
                break;
            if (/^(\d+\.|#{2,3}|[-*]\s)/.test(nextLine))
                break;
            descriptions.push(nextLine);
        }
        return descriptions.join(' ');
    }
    /**
     * 작업 유형 추론
     */
    inferActionType(text) {
        if (/신규|새로운|추가|생성|new|create/i.test(text))
            return 'new';
        if (/설정|config|환경|옵션|파라미터/i.test(text))
            return 'config';
        return 'modify';
    }
    /**
     * 대상 화면 추론
     */
    inferTargetScreen(text) {
        const screenPatterns = [
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
            if (pattern.test(text))
                return screen;
        }
        return '';
    }
    /**
     * 줄에서 키워드 추출
     */
    extractKeywordsFromLine(text) {
        const keywords = [];
        const camelCase = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g) || [];
        keywords.push(...camelCase);
        const korean = text.match(/[가-힣]{2,}/g) || [];
        keywords.push(...korean.filter(k => k.length >= 2));
        return [...new Set(keywords)].slice(0, 10);
    }
    /**
     * 텍스트에서 비즈니스 규칙 추출
     */
    extractBusinessRulesFromText(text) {
        const rules = [];
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
    extractTargetScreensFromText(text) {
        const screens = new Set();
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
exports.SpecParser = SpecParser;
//# sourceMappingURL=spec-parser.js.map