/**
 * @module core/indexing/parsers/vue-parser
 * @description Vue SFC (.vue) 파서 - <script> 블록 추출 후 TypeScript 파서에 위임
 */
import { BaseParser } from './base-parser';
import { ParsedFile } from '../types';
/**
 * VueParser - Vue SFC(.vue) 파일 파서
 *
 * <script> / <script setup> 블록을 추출하여 TypeScriptParser에 위임하고,
 * <template> 내 커스텀 컴포넌트 참조 및 Vue 특유 패턴을 추가 감지한다.
 */
export declare class VueParser extends BaseParser {
    readonly name = "vue";
    readonly supportedExtensions: string[];
    private tsParser;
    parse(filePath: string, content: string): Promise<ParsedFile>;
    /**
     * <script> 블록 추출
     */
    private extractScriptBlocks;
    /**
     * Vue 특유 패턴 감지 → functions에 추가
     */
    private detectVuePatterns;
    /**
     * <template> 내 커스텀 컴포넌트 참조 감지
     */
    private detectTemplateComponents;
}
//# sourceMappingURL=vue-parser.d.ts.map