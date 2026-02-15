/**
 * @module server/web-server
 * @description Express.js 웹 서버 - React SPA 정적 파일 서빙 및 API 엔드포인트
 */
import express from 'express';
/**
 * Express 앱을 생성하고 설정
 * @param basePath - 데이터 저장 기본 경로
 * @returns Express Application
 */
export declare function createApp(basePath?: string): express.Application;
/**
 * 웹 서버를 시작
 * @param basePath - 데이터 저장 기본 경로
 * @param preferredPort - 선호 포트 (기본: 3847)
 * @returns 실제 사용된 포트 번호
 */
export declare function startServer(basePath?: string, preferredPort?: number): Promise<number>;
/**
 * 웹 서버를 중지
 */
export declare function stopServer(): Promise<void>;
/**
 * 서버 실행 상태 확인
 */
export declare function isServerRunning(): boolean;
//# sourceMappingURL=web-server.d.ts.map