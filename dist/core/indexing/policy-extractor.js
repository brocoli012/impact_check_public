"use strict";
/**
 * @module core/indexing/policy-extractor
 * @description 정책 추출기 - 코드 주석, 문서, YAML에서 정책 정보 추출
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
exports.PolicyExtractor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const logger_1 = require("../../utils/logger");
/** 정책 카테고리 키워드 매핑 */
const CATEGORY_KEYWORDS = {
    'security': ['보안', 'security', '인증', 'auth', '권한', 'permission', '암호화', 'encrypt'],
    'performance': ['성능', 'performance', '캐시', 'cache', '최적화', 'optimize'],
    'business': ['비즈니스', 'business', '결제', 'payment', '정산'],
    'data': ['데이터', 'data', '개인정보', 'privacy', 'PII', 'GDPR'],
    'ui': ['UI', 'UX', '디자인', 'design', '레이아웃', 'layout'],
    'api': ['API', '엔드포인트', 'endpoint', 'REST', 'GraphQL'],
    'delivery': ['배송', 'delivery', '택배', '새벽배송', '당일배송', '마감'],
    'pricing': ['가격', 'pricing', 'price', '단가', '원가', '정가'],
    'discount': ['할인', 'discount', '쿠폰', 'coupon', '프로모션', 'promotion'],
    'membership': ['회원', 'membership', 'member', '등급', 'grade', '멤버십'],
    'reward': ['적립', 'reward', '포인트', 'point', '마일리지', 'mileage'],
    'quality': ['품질', 'quality', '검수', '신선', 'fresh'],
    'return': ['반품', 'return', '교환', 'exchange', '환불', '반환'],
    'general': [],
};
/**
 * PolicyExtractor - 코드 주석, 문서, YAML에서 정책 정보를 추출
 *
 * 기능:
 *   - 코드 주석에서 정책 추출 (// 정책:, /* Policy: * / 패턴)
 *   - README/POLICY.md 문서에서 정책 추출
 *   - policies.yaml에서 수동 정책 로드
 *   - 모든 소스 병합 및 중복 제거
 */
class PolicyExtractor {
    /**
     * 코드 주석에서 정책 추출
     * @param parsedFiles - 파싱된 파일 목록
     * @returns 추출된 정책 목록
     */
    extractFromComments(parsedFiles) {
        const policies = [];
        let counter = 0;
        for (const file of parsedFiles) {
            const policyComments = file.comments.filter(c => c.isPolicy);
            for (const comment of policyComments) {
                counter++;
                const policyText = this.cleanPolicyText(comment.text);
                const category = this.detectCategory(policyText);
                policies.push({
                    id: `policy-comment-${counter}`,
                    name: this.extractPolicyName(policyText),
                    description: policyText,
                    source: 'comment',
                    sourceText: comment.text,
                    filePath: file.filePath,
                    lineNumber: comment.line,
                    category,
                    relatedComponents: [],
                    relatedApis: [],
                    relatedModules: [path.basename(file.filePath, path.extname(file.filePath))],
                    extractedAt: new Date().toISOString(),
                });
            }
        }
        logger_1.logger.debug(`Extracted ${policies.length} policies from comments`);
        return policies;
    }
    /**
     * README/POLICY.md에서 정책 추출
     * @param projectPath - 프로젝트 루트 경로
     * @returns 추출된 정책 목록
     */
    async extractFromDocs(projectPath) {
        const policies = [];
        const docFiles = ['POLICY.md', 'POLICIES.md', 'policies.md', 'README.md'];
        let counter = 0;
        for (const docFile of docFiles) {
            const docPath = path.join(projectPath, docFile);
            if (!fs.existsSync(docPath))
                continue;
            try {
                const content = fs.readFileSync(docPath, 'utf-8');
                const sections = this.parseMarkdownPolicySections(content);
                for (const section of sections) {
                    counter++;
                    policies.push({
                        id: `policy-doc-${counter}`,
                        name: section.title,
                        description: section.content,
                        source: 'readme',
                        sourceText: section.raw,
                        filePath: docFile,
                        lineNumber: section.line,
                        category: this.detectCategory(section.content),
                        relatedComponents: [],
                        relatedApis: [],
                        relatedModules: [],
                        extractedAt: new Date().toISOString(),
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn(`Failed to read ${docFile}:`, err);
            }
        }
        logger_1.logger.debug(`Extracted ${policies.length} policies from docs`);
        return policies;
    }
    /**
     * policies.yaml에서 수동 정책 로드
     * @param projectPath - 프로젝트 루트 경로
     * @returns 로드된 정책 목록
     */
    async loadManualPolicies(projectPath) {
        const policies = [];
        const yamlPaths = [
            path.join(projectPath, 'policies.yaml'),
            path.join(projectPath, 'policies.yml'),
            path.join(projectPath, '.impact', 'policies.yaml'),
            path.join(projectPath, '.impact', 'policies.yml'),
        ];
        for (const yamlPath of yamlPaths) {
            if (!fs.existsSync(yamlPath))
                continue;
            try {
                const content = fs.readFileSync(yamlPath, 'utf-8');
                const parsed = yaml.load(content);
                if (parsed && parsed.policies) {
                    let counter = 0;
                    for (const p of parsed.policies) {
                        counter++;
                        policies.push({
                            id: `policy-manual-${counter}`,
                            name: p.name || `Manual Policy ${counter}`,
                            description: p.description || '',
                            source: 'manual',
                            sourceText: yaml.dump(p),
                            filePath: p.filePath || path.relative(projectPath, yamlPath),
                            lineNumber: 0,
                            category: p.category || this.detectCategory(p.description || ''),
                            relatedComponents: p.relatedComponents || [],
                            relatedApis: p.relatedApis || [],
                            relatedModules: p.relatedModules || [],
                            extractedAt: new Date().toISOString(),
                        });
                    }
                }
            }
            catch (err) {
                logger_1.logger.warn(`Failed to parse ${yamlPath}:`, err);
            }
        }
        logger_1.logger.debug(`Loaded ${policies.length} manual policies`);
        return policies;
    }
    /**
     * 모든 소스의 정책 병합
     * @param sources - 정책 소스 배열
     * @returns 병합된 정책 목록
     */
    mergeAllPolicies(...sources) {
        const allPolicies = [];
        const seen = new Set();
        let globalCounter = 0;
        for (const source of sources) {
            for (const policy of source) {
                // 중복 체크 (이름 + 설명으로)
                const key = `${policy.name}:${policy.description}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                globalCounter++;
                allPolicies.push({
                    ...policy,
                    id: `policy-${globalCounter}`,
                });
            }
        }
        logger_1.logger.info(`Merged ${allPolicies.length} policies from ${sources.length} sources`);
        return allPolicies;
    }
    /**
     * 정책 주석 텍스트 정리
     */
    cleanPolicyText(text) {
        return text
            .replace(/^\/\/\s*(정책|Policy|POLICY|@policy)\s*:\s*/i, '')
            .replace(/^\/\*\s*(정책|Policy|POLICY|@policy)\s*:\s*/i, '')
            .replace(/\*\/\s*$/, '')
            .trim();
    }
    /**
     * 정책 이름 추출
     */
    extractPolicyName(text) {
        // 첫 번째 문장이나 20자 이내를 이름으로 사용
        const firstSentence = text.split(/[.。!！?？\n]/)[0].trim();
        if (firstSentence.length <= 50) {
            return firstSentence;
        }
        return firstSentence.substring(0, 47) + '...';
    }
    /**
     * 정책 카테고리 감지
     */
    detectCategory(text) {
        const lowerText = text.toLowerCase();
        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            if (category === 'general')
                continue;
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }
        return 'general';
    }
    /**
     * 마크다운에서 정책 섹션 파싱
     */
    parseMarkdownPolicySections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;
        let inPolicyArea = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
            if (headingMatch) {
                const title = headingMatch[2].trim();
                const titleLower = title.toLowerCase();
                // 정책 관련 섹션 감지
                if (titleLower.includes('정책') ||
                    titleLower.includes('policy') ||
                    titleLower.includes('규칙') ||
                    titleLower.includes('rule') ||
                    titleLower.includes('제약') ||
                    titleLower.includes('constraint')) {
                    inPolicyArea = true;
                    if (currentSection) {
                        sections.push(currentSection);
                    }
                    currentSection = {
                        title,
                        content: '',
                        raw: line,
                        line: i + 1,
                    };
                }
                else if (inPolicyArea && headingMatch[1].length <= 2) {
                    // 상위 레벨 헤딩이 나오면 정책 영역 종료
                    inPolicyArea = false;
                    if (currentSection) {
                        sections.push(currentSection);
                        currentSection = null;
                    }
                }
                else if (inPolicyArea) {
                    // 하위 정책 섹션
                    if (currentSection) {
                        sections.push(currentSection);
                    }
                    currentSection = {
                        title,
                        content: '',
                        raw: line,
                        line: i + 1,
                    };
                }
            }
            else if (currentSection && line.trim()) {
                currentSection.content += (currentSection.content ? '\n' : '') + line.trim();
                currentSection.raw += '\n' + line;
            }
        }
        if (currentSection) {
            sections.push(currentSection);
        }
        return sections;
    }
}
exports.PolicyExtractor = PolicyExtractor;
//# sourceMappingURL=policy-extractor.js.map