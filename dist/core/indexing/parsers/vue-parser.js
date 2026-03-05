"use strict";
/**
 * @module core/indexing/parsers/vue-parser
 * @description Vue SFC (.vue) 파서 - <script> 블록 추출 후 TypeScript 파서에 위임
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VueParser = void 0;
const base_parser_1 = require("./base-parser");
const typescript_parser_1 = require("./typescript-parser");
const logger_1 = require("../../../utils/logger");
/** <script> 또는 <script setup> 블록 매칭 정규식 */
const SCRIPT_BLOCK_RE = /<script(?:\s+([^>]*))?>([^]*?)<\/script>/gi;
/** <template> 블록 매칭 정규식 */
const TEMPLATE_BLOCK_RE = /<template(?:\s+[^>]*)?>([^]*?)<\/template>/i;
/** Vue Composition API 패턴 */
const VUE_COMPOSITION_PATTERNS = [
    /\bdefineComponent\s*\(/,
    /\bdefineProps\s*[<(]/,
    /\bdefineEmits\s*[<(]/,
    /\bdefineExpose\s*\(/,
    /\bref\s*[<(]/,
    /\breactive\s*[<(]/,
    /\bcomputed\s*[<(]/,
    /\bwatch\s*\(/,
    /\bwatchEffect\s*\(/,
    /\bprovide\s*\(/,
    /\binject\s*[<(]/,
];
/** Vue 생태계 패턴 (Pinia, Vue Router) */
const VUE_ECOSYSTEM_PATTERNS = [
    /\bdefineStore\s*\(/,
    /\bcreateRouter\s*\(/,
    /\buseRouter\s*\(/,
    /\buseRoute\s*\(/,
    /\bcreateApp\s*\(/,
];
/** 커스텀 컴포넌트 태그 매칭 (PascalCase or kebab-case with hyphen) */
const CUSTOM_COMPONENT_RE = /<\/?([A-Z][a-zA-Z0-9]*|[a-z]+-[a-z][a-z0-9-]*)/g;
/** HTML 내장 태그 (감지에서 제외) */
const HTML_TAGS = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base',
    'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
    'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
    'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
    'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
    'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
    'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
    'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
    'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q',
    'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'slot',
    'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead',
    'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
]);
/** SVG 태그 (감지에서 제외) */
const SVG_TAGS = new Set([
    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
    'g', 'text', 'tspan', 'defs', 'use', 'symbol', 'clipPath', 'mask',
    'linearGradient', 'radialGradient', 'stop', 'filter', 'feBlend',
]);
/**
 * VueParser - Vue SFC(.vue) 파일 파서
 *
 * <script> / <script setup> 블록을 추출하여 TypeScriptParser에 위임하고,
 * <template> 내 커스텀 컴포넌트 참조 및 Vue 특유 패턴을 추가 감지한다.
 */
class VueParser extends base_parser_1.BaseParser {
    constructor() {
        super(...arguments);
        this.name = 'vue';
        this.supportedExtensions = ['.vue'];
        this.tsParser = new typescript_parser_1.TypeScriptParser();
    }
    async parse(filePath, content) {
        const result = this.createEmptyParsedFile(filePath);
        if (!content.trim()) {
            return result;
        }
        try {
            // 1. <script> 블록 추출 및 파싱
            const scriptBlocks = this.extractScriptBlocks(content);
            for (const block of scriptBlocks) {
                const ext = block.lang === 'ts' || block.lang === 'tsx' ? '.ts' : '.js';
                const virtualPath = filePath.replace('.vue', ext);
                const parsed = await this.tsParser.parse(virtualPath, block.content);
                // 결과 병합
                result.imports.push(...parsed.imports);
                result.exports.push(...parsed.exports);
                result.functions.push(...parsed.functions);
                result.components.push(...parsed.components);
                result.apiCalls.push(...parsed.apiCalls);
                result.routeDefinitions.push(...parsed.routeDefinitions);
                result.comments.push(...parsed.comments);
                if (parsed.models && parsed.models.length > 0) {
                    if (!result.models)
                        result.models = [];
                    result.models.push(...parsed.models);
                }
                if (parsed.events && parsed.events.length > 0) {
                    if (!result.events)
                        result.events = [];
                    result.events.push(...parsed.events);
                }
            }
            // 2. Vue 특유 패턴 감지 (script 블록 내)
            const allScriptContent = scriptBlocks.map(b => b.content).join('\n');
            this.detectVuePatterns(allScriptContent, filePath, result);
            // 3. <template> 내 커스텀 컴포넌트 참조 감지
            this.detectTemplateComponents(content, filePath, result);
        }
        catch (err) {
            logger_1.logger.debug(`Failed to parse Vue SFC ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
        return result;
    }
    /**
     * <script> 블록 추출
     */
    extractScriptBlocks(content) {
        const blocks = [];
        let match;
        // Reset lastIndex
        SCRIPT_BLOCK_RE.lastIndex = 0;
        while ((match = SCRIPT_BLOCK_RE.exec(content)) !== null) {
            const attrs = match[1] || '';
            const scriptContent = match[2] || '';
            const isSetup = /\bsetup\b/.test(attrs);
            let lang = 'js';
            const langMatch = attrs.match(/\blang\s*=\s*["'](\w+)["']/);
            if (langMatch) {
                lang = langMatch[1];
            }
            blocks.push({
                content: scriptContent,
                lang,
                isSetup,
            });
        }
        return blocks;
    }
    /**
     * Vue 특유 패턴 감지 → functions에 추가
     */
    detectVuePatterns(scriptContent, _filePath, result) {
        const lines = scriptContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Composition API 패턴
            for (const pattern of VUE_COMPOSITION_PATTERNS) {
                if (pattern.test(line)) {
                    const funcMatch = line.match(/\b(defineComponent|defineProps|defineEmits|defineExpose|ref|reactive|computed|watch|watchEffect|provide|inject)\s*[<(]/);
                    if (funcMatch) {
                        const existing = result.functions.find(f => f.name === funcMatch[1] && f.startLine === i + 1);
                        if (!existing) {
                            result.functions.push({
                                name: funcMatch[1],
                                signature: `${funcMatch[1]}(...)`,
                                startLine: i + 1,
                                endLine: i + 1,
                                params: [],
                                isAsync: false,
                                isExported: false,
                            });
                        }
                    }
                    break;
                }
            }
            // 생태계 패턴
            for (const pattern of VUE_ECOSYSTEM_PATTERNS) {
                if (pattern.test(line)) {
                    const funcMatch = line.match(/\b(defineStore|createRouter|useRouter|useRoute|createApp)\s*\(/);
                    if (funcMatch) {
                        const existing = result.functions.find(f => f.name === funcMatch[1] && f.startLine === i + 1);
                        if (!existing) {
                            result.functions.push({
                                name: funcMatch[1],
                                signature: `${funcMatch[1]}(...)`,
                                startLine: i + 1,
                                endLine: i + 1,
                                params: [],
                                isAsync: false,
                                isExported: false,
                            });
                        }
                    }
                    break;
                }
            }
        }
    }
    /**
     * <template> 내 커스텀 컴포넌트 참조 감지
     */
    detectTemplateComponents(content, filePath, result) {
        const templateMatch = TEMPLATE_BLOCK_RE.exec(content);
        if (!templateMatch)
            return;
        const templateContent = templateMatch[1];
        const componentNames = new Set();
        let tagMatch;
        CUSTOM_COMPONENT_RE.lastIndex = 0;
        while ((tagMatch = CUSTOM_COMPONENT_RE.exec(templateContent)) !== null) {
            const tagName = tagMatch[1];
            // HTML/SVG 태그 제외
            if (HTML_TAGS.has(tagName.toLowerCase()) || SVG_TAGS.has(tagName))
                continue;
            // Vue 내장 컴포넌트 제외
            if (['component', 'transition', 'keep-alive', 'teleport', 'suspense', 'slot'].includes(tagName.toLowerCase()))
                continue;
            componentNames.add(tagName);
        }
        // 감지된 컴포넌트를 components에 추가 (import와 매칭)
        for (const name of componentNames) {
            const existing = result.components.find(c => c.name === name);
            if (!existing) {
                // PascalCase로 변환 (kebab-case인 경우)
                const pascalName = name.includes('-')
                    ? name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
                    : name;
                // import에서 해당 컴포넌트가 있는지 확인
                const hasImport = result.imports.some(imp => imp.specifiers.includes(pascalName) || imp.specifiers.includes(name));
                if (hasImport) {
                    result.components.push({
                        name: pascalName,
                        type: 'function-component',
                        props: [],
                        filePath,
                        line: 0,
                    });
                }
            }
        }
    }
}
exports.VueParser = VueParser;
//# sourceMappingURL=vue-parser.js.map