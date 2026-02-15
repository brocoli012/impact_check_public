"use strict";
/**
 * @module types/config
 * @description 설정 타입 정의 - 애플리케이션 설정 및 API 키 관리
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
// ============================================================
// 기본 설정 상수
// ============================================================
/** 기본 애플리케이션 설정 */
exports.DEFAULT_CONFIG = {
    version: 1,
    llm: {
        defaultProvider: 'anthropic',
        providers: {},
        routing: {
            'spec-parsing': 'openai',
            'impact-analysis': 'anthropic',
            'score-calculation': 'anthropic',
            'multimodal-parsing': 'google',
            'general': 'openai',
        },
    },
    general: {
        autoReindex: true,
        webPort: 3847,
        logLevel: 'info',
        llmDataConsent: false,
    },
};
//# sourceMappingURL=config.js.map