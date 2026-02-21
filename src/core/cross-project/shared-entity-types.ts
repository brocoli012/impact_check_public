/**
 * @module core/cross-project/shared-entity-types
 * @description 크로스 프로젝트 공유 엔티티 타입 정의 - 역인덱스 스키마
 */

import { ISODateString } from '../../types/common';

// ============================================================
// 공유 엔티티 인덱스 타입
// ============================================================

/** 공유 엔티티 역인덱스 */
export interface SharedEntityIndex {
  /** 인덱스 버전 */
  version: number;
  /** 업데이트 시각 */
  updatedAt: ISODateString;
  /** 테이블별 참조 역인덱스: tableName → TableReference[] */
  tables: Record<string, TableReference[]>;
  /** 이벤트별 참조 역인덱스: eventName/topic → EventReference[] */
  events: Record<string, EventReference[]>;
}

/** 테이블 참조 정보 */
export interface TableReference {
  /** 프로젝트 ID */
  projectId: string;
  /** 엔티티 클래스명 */
  entityName: string;
  /** 파일 경로 */
  filePath: string;
  /** 참조하는 컬럼명 목록 */
  columns: string[];
  /** 접근 패턴 (read/write/read-write) */
  accessPattern: 'read' | 'write' | 'read-write';
}

/** 이벤트 참조 정보 */
export interface EventReference {
  /** 프로젝트 ID */
  projectId: string;
  /** 발행/구독 역할 */
  role: 'publisher' | 'subscriber';
  /** 핸들러 함수/메서드명 */
  handler: string;
  /** 파일 경로 */
  filePath: string;
  /** 메시지 토픽 */
  topic?: string;
}
