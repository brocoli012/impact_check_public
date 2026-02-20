# REQ-011 / REQ-012 / REQ-013 통합 구현 로드맵

> 작성일: 2026-02-21
> 작성자: Master
> 상태: Ready
> 총 TASK: 53개 (TASK-060 ~ TASK-112)
> 총 포인트: 198pts
> 예상 기간: ~30일 (병렬화 시 ~22일)

---

## 1. 전체 타임라인 요약

```
Week 1-2   : REQ-011 (Phase 1~4)           33pts / 10 TASKs
Week 2-4   : REQ-012 (Phase 1~3)           42pts / 14 TASKs
             REQ-013 Phase A (병렬 시작)     45pts / 13 TASKs  ← Week 2부터 병렬
Week 4-6   : REQ-013 Phase B               30pts / 6 TASKs
Week 6-8   : REQ-013 Phase C               25pts / 5 TASKs   ← REQ-012 완료 필요
Week 8-10  : REQ-013 Phase D               23pts / 5 TASKs
```

### 간트 차트 (주 단위)

```
           W1    W2    W3    W4    W5    W6    W7    W8    W9    W10
REQ-011   [====P1===][=P2=][P3][P4]
REQ-012           [======P1======][==P2==][P3]
REQ-013-A         [========Phase A=========]
REQ-013-B                        [====Phase B====]
REQ-013-C                                   [====Phase C====]
REQ-013-D                                              [====Phase D====]
```

---

## 2. 의존성 그래프

```
REQ-011 Phase 1 (병렬)
  TASK-060 PolicyInfo 타입 ──┐
  TASK-061 비동기 캐시     ──┤
  TASK-062 /api/project/status ──┤
  TASK-063 InfiniteScroll  ──┘
            │
            ▼
REQ-011 Phase 2 (순차)
  TASK-064 InferredPolicy 컨버터 ──→ TASK-065 /api/policies 통합 ──→ TASK-066 소스배지+필터
            │
            ▼
REQ-011 Phase 3 (순차)
  TASK-067 ProjectOverview ──→ TASK-068 currentResult 의존성 제거
            │
            ▼
REQ-011 Phase 4
  TASK-069 테스트
            │
            ▼
  ┌─────────┴─────────────────────────────────┐
  │                                           │
  ▼                                           ▼
REQ-012 Phase 1 (P0)                    REQ-013 Phase A (독립)
  TASK-070 ProjectContext              TASK-084 ModelInfo 타입
  TASK-071 GET /api/projects           TASK-085 ModelField 타입
  TASK-072 POST /switch                TASK-086 EventInfo 타입
  TASK-073 getProjectId 리팩토링         TASK-087 parseAnnotationAttribute
  TASK-074 projectStore                TASK-088 java parseEntityModels
  TASK-075 Header ProjectSelector      TASK-089 kotlin parseEntityModels
  TASK-076 reset() 추가                TASK-090 java-ast parseEntityModels
  TASK-077 테스트                       TASK-091 kotlin-ast parseEntityModels
  │                                    TASK-092 java parseEventPatterns
  ▼                                    TASK-093 kotlin parseEventPatterns
REQ-012 Phase 2                        TASK-094 indexer 수집 파이프라인
  TASK-078 ProjectHub 페이지            TASK-095 TS ORM 감지
  TASK-079 ProjectCard                 TASK-096 Phase A 테스트
  TASK-080 그룹필터+검색                  │
  TASK-081 CrossProjectDiagram 연동      ▼
  │                                  REQ-013 Phase B
  ▼                                    TASK-097 SharedEntityIndex 타입
REQ-012 Phase 3                        TASK-098 테이블 역인덱스
  TASK-082 비교 뷰                      TASK-099 이벤트 역인덱스
  TASK-083 SSE 실시간                   TASK-100 LinkType 'shared-db'
  │                                    TASK-101 ReverseCommand CLI
  │                                    TASK-102 Phase B 테스트
  │                                       │
  └──────────┬────────────────────────────┘
             │ (합류: REQ-012 P1 완료 + REQ-013 Phase B 완료)
             ▼
       REQ-013 Phase C
         TASK-103 /api/reverse/* 엔드포인트
         TASK-104 /api/shared-entities
         TASK-105 CrossProjectManager 통합
         TASK-106 TS/Node.js 이벤트 패턴
         TASK-107 Phase C 테스트
             │
             ▼
       REQ-013 Phase D
         TASK-108 EntityNode + EventNode
         TASK-109 SharedEntityMap 시각화
         TASK-110 노드 인터랙션 + ReverseTrace
         TASK-111 CrossProjectSummary 통계
         TASK-112 Phase D 테스트
```

---

## 3. 병렬화 가능 구간

| 구간 | 병렬 가능 항목 | 조건 | 절약 기간 |
|------|---------------|------|----------|
| **REQ-011 Phase 1** | TASK-060, 061, 062, 063 동시 진행 | 서로 독립적 | ~2일 |
| **REQ-012 P1 + REQ-013 Phase A** | REQ-011 완료 후 동시 시작 | REQ-013 A/B는 REQ-012와 독립 | ~5일 |
| **REQ-013 Phase B** | REQ-012 P2와 병렬 진행 | Phase A 완료만 필요 | ~3일 |
| **REQ-012 Phase 2/3** | REQ-013 Phase B와 병렬 | 서로 독립적 | ~3일 |

### 병렬화 시 크리티컬 패스

```
REQ-011 (5일) → REQ-013 Phase A (8일) → Phase B (7일) → Phase C (7일) → Phase D (8일)
총: ~35일 → 병렬화로 ~22일 (REQ-012가 Phase C 이전에 완료)
```

---

## 4. REQ-011: 대시보드 독립 조회 & 정책 어노테이션 연동

> 10 TASKs, 33 points, 복잡도 7/10, ~5일

### Phase 1: 타입 + 비동기 + API (병렬 가능, 12pts)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-060 | PolicyInfo 타입 확장 | 2 | 없음 | source에 'annotation' 추가 + confidence 옵셔널 필드 |
| TASK-061 | AnnotationManager.loadAll() 비동기 전환 | 4 | 없음 | 비동기 전환 + 5분 TTL 캐시 |
| TASK-062 | GET /api/project/status API | 3 | 없음 | index-meta + annotation-meta 반환 |
| TASK-063 | InfiniteScroll 기반 정책 목록 | 3 | 없음 | 50 initial + 50/scroll |

### Phase 2: 컨버터 + 소스필터 + 소스배지 (순차, 11pts)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-064 | InferredPolicy -> PolicyInfo 컨버터 | 4 | TASK-060 | 타입 변환 로직 |
| TASK-065 | GET /api/policies 통합 | 4 | TASK-061, 064 | 인덱스+어노테이션 병합, 중복 제거 |
| TASK-066 | PolicyCard 소스 배지 + PolicyFilter 소스 필터 탭 | 3 | TASK-065 | UI 컴포넌트 |

### Phase 3: API 병합 + ProjectOverview (순차, 6pts)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-067 | Dashboard ProjectOverview 컴포넌트 | 3 | TASK-062 | 3-stage: 미등록 -> 인덱싱 -> 분석 |
| TASK-068 | Policies.tsx currentResult 의존성 제거 | 3 | TASK-065, 066 | 독립 조회 완성 |

### Phase 4: 테스트 (4pts)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-069 | 백엔드 테스트(Jest) + 프론트엔드 테스트(Vitest) | 4 | TASK-067, 068 | 전체 REQ-011 커버리지 |

### 커밋 포인트
- **Commit 1**: Phase 1 완료 (TASK-060~063) - 타입/API/비동기 기반
- **Commit 2**: Phase 2 완료 (TASK-064~066) - 정책 통합 API + UI
- **Commit 3**: Phase 3+4 완료 (TASK-067~069) - ProjectOverview + 테스트

---

## 5. REQ-012: 멀티프로젝트 대시보드

> 14 TASKs, 42 points, 복잡도 7/10

### Phase 1 (P0): 서버 API 인프라 + projectStore + Header (24pts, ~5일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-070 | cachedProjectPath 제거 -> ProjectContext 클래스 | 3 | REQ-011 | web-server.ts 즉시 처리 |
| TASK-071 | GET /api/projects (프로젝트 목록 + 요약 통계) | 3 | TASK-070 | 프로젝트 목록 API |
| TASK-072 | POST /api/projects/switch (활성 프로젝트 전환) | 2 | TASK-070 | 전환 API |
| TASK-073 | getProjectId() 리팩토링 | 4 | TASK-070 | 쿼리파라미터 우선, 9개 핸들러 수정 |
| TASK-074 | projectStore (Zustand) 신규 생성 | 3 | TASK-071, 072 | 프로젝트 상태 관리 |
| TASK-075 | Header ProjectSelector | 3 | TASK-074 | native select (Phase 1) |
| TASK-076 | resultStore/policyStore/flowStore reset() 추가 | 3 | TASK-074 | 스토어 초기화 |
| TASK-077 | Phase 1 백엔드+프론트엔드 테스트 | 3 | TASK-075, 076 | Phase 1 커버리지 |

### Phase 2: 프로젝트 허브 페이지 (10pts, ~3일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-078 | ProjectHub 페이지 + 라우팅 (/projects) | 3 | TASK-077 | 프로젝트 허브 |
| TASK-079 | ProjectCard 컴포넌트 | 3 | TASK-078 | 등급/태스크/정책 카드 |
| TASK-080 | 그룹 필터링 + 검색 | 2 | TASK-079 | 검색/필터 UX |
| TASK-081 | CrossProjectDiagram onNodeClick 연동 | 2 | TASK-079 | 다이어그램 인터랙션 |

### Phase 3: 비교 뷰 + 실시간 (8pts)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-082 | 프로젝트 비교 뷰 (/projects/compare) | 5 | TASK-081 | 비교 대시보드 |
| TASK-083 | 실시간 갱신 SSE | 3 | TASK-082 | Server-Sent Events |

### 커밋 포인트
- **Commit 1**: TASK-070~073 완료 - 서버 인프라 리팩토링
- **Commit 2**: TASK-074~077 완료 - 프론트엔드 스토어 + 테스트
- **Commit 3**: Phase 2 완료 (TASK-078~081) - ProjectHub
- **Commit 4**: Phase 3 완료 (TASK-082~083) - 비교 뷰 + SSE

---

## 6. REQ-013: 크로스 프로젝트 공유 엔티티 영향 추적

> 29 TASKs, 123 points (XL), 복잡도 8/10

### Phase A: JVM 파서 MVP (13 TASKs, 45pts, ~8일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-084 | ModelInfo 타입 확장 | 2 | 없음 | tableName, schema, annotations 필드 |
| TASK-085 | ModelField 타입 확장 | 2 | TASK-084 | columnName, columnType, isPrimaryKey, isRelation |
| TASK-086 | EventInfo 타입 정의 + CodeIndex.events | 2 | 없음 | 이벤트 타입 시스템 |
| TASK-087 | parseAnnotationAttribute() 유틸 | 5 | 없음 | 2-pass 매칭 (stripStringsAndComments 핵심) |
| TASK-088 | java-parser.ts parseEntityModels() | 5 | TASK-084, 085, 087 | @Table/@Column 추출 |
| TASK-089 | kotlin-parser.ts parseEntityModels() | 4 | TASK-084, 085, 087 | Kotlin 엔티티 파싱 |
| TASK-090 | java-ast-parser.ts parseEntityModels() | 4 | TASK-088 | AST 기반 Java 파싱 |
| TASK-091 | kotlin-ast-parser.ts parseEntityModels() | 4 | TASK-089 | AST 기반 Kotlin 파싱 |
| TASK-092 | java-parser.ts parseEventPatterns() | 4 | TASK-086 | 발행/구독 감지 |
| TASK-093 | kotlin-parser.ts parseEventPatterns() | 3 | TASK-086 | Kotlin 이벤트 감지 |
| TASK-094 | indexer.ts models/events 수집 파이프라인 | 4 | TASK-088~093 | 인덱서 통합 |
| TASK-095 | TypeScript ORM 감지 (TypeORM @Entity) | 3 | TASK-094 | TS 생태계 지원 |
| TASK-096 | Phase A 테스트 | 3 | TASK-094, 095 | JVM 파서 + 인덱서 |

#### Phase A 내부 병렬 구간
```
TASK-084+085 (타입)  ──┐
TASK-086 (이벤트타입) ──┤
TASK-087 (어노테이션) ──┤
                       ▼
        TASK-088 + TASK-089 (병렬: Java/Kotlin regex)
        TASK-092 + TASK-093 (병렬: Java/Kotlin events)
              │            │
              ▼            ▼
        TASK-090       TASK-091 (병렬: AST 파서)
              │            │
              └─────┬──────┘
                    ▼
             TASK-094 (인덱서)
                    │
                    ▼
             TASK-095 (TS ORM)
                    │
                    ▼
             TASK-096 (테스트)
```

### Phase B: 역인덱스 빌더 (6 TASKs, 30pts, ~7일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-097 | SharedEntityIndex 타입 | 3 | TASK-096 | TableReference/EventReference |
| TASK-098 | SharedEntityIndexer (테이블 역인덱스) | 5 | TASK-097 | 테이블명 기반 역매핑 |
| TASK-099 | SharedEntityIndexer (이벤트 역인덱스) | 5 | TASK-097 | 이벤트명 기반 역매핑 |
| TASK-100 | LinkType 'shared-db' + detectLinks() 확장 | 5 | TASK-098, 099 | 링크 타입 시스템 |
| TASK-101 | ReverseCommand CLI | 5 | TASK-100 | reverse --table/--event/--keyword |
| TASK-102 | Phase B 테스트 | 7 | TASK-101 | 역인덱스 + CLI |

#### Phase B 내부 병렬 구간
```
TASK-097 (타입) ──→ TASK-098 + TASK-099 (병렬) ──→ TASK-100 ──→ TASK-101 ──→ TASK-102
```

### Phase C: 크로스 프로젝트 통합 (5 TASKs, 25pts, ~7일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-103 | REST API /api/reverse/* 4개 | 5 | REQ-012 P1, TASK-102 | 엔드포인트 |
| TASK-104 | REST API /api/shared-entities + stats | 5 | TASK-103 | 공유 엔티티 API |
| TASK-105 | CrossProjectManager 통합 | 5 | TASK-104 | 모델/이벤트 자동 링크 |
| TASK-106 | TS/Node.js 이벤트 패턴 감지 | 5 | TASK-094 | emitter.emit/on, NestJS |
| TASK-107 | Phase C 테스트 | 5 | TASK-105, 106 | API + 통합 |

> **주의**: Phase C는 REQ-012 Phase 1 완료 + REQ-013 Phase B 완료 양쪽을 전제

#### Phase C 내부 병렬 구간
```
TASK-103 ──→ TASK-104 ──→ TASK-105 ──┐
                                     ├──→ TASK-107
TASK-106 (독립) ─────────────────────┘
```

### Phase D: 대시보드 시각화 (5 TASKs, 23pts, ~8일)

| TASK | 제목 | pts | 의존성 | 설명 |
|------|------|:---:|--------|------|
| TASK-108 | EntityNode (실린더) + EventNode (팔각형) | 5 | TASK-107 | 커스텀 노드 |
| TASK-109 | SharedEntityMap 3-레이어 시각화 | 5 | TASK-108 | API/DB/Event 토글 |
| TASK-110 | 노드 클릭 인터랙션 + ReverseTrace 사이드패널 | 5 | TASK-109 | 인터랙션 |
| TASK-111 | CrossProjectSummary 공유 엔티티 통계 카드 | 3 | TASK-109 | 통계 UI |
| TASK-112 | Phase D 테스트 | 5 | TASK-110, 111 | 컴포넌트 테스트 |

#### Phase D 내부 병렬 구간
```
TASK-108 ──→ TASK-109 ──→ TASK-110 + TASK-111 (병렬) ──→ TASK-112
```

---

## 7. 주요 기술적 변경 사항 트래킹

### 타입 시스템 변경 (파급 영향 큼)

| 변경 | REQ | TASK | 영향 파일 | 우선순위 |
|------|-----|------|----------|---------|
| PolicyInfo.source += 'annotation' | REQ-011 | TASK-060 | types.ts, PolicyCard, PolicyFilter, policyStore | 1 (최초) |
| PolicyInfo.confidence?: number | REQ-011 | TASK-060 | types.ts, ConfidenceScorer | 1 |
| ParsedFile += models, events | REQ-013 | TASK-084~086 | types.ts, 8+ 파서 파일 | 2 |
| LinkType += 'shared-db' | REQ-013 | TASK-100 | types.ts, CrossProjectManager | 3 |
| Zustand stores += reset() | REQ-012 | TASK-076 | resultStore, policyStore, flowStore | 2 |

### 서버 인프라 변경

| 변경 | REQ | TASK | 설명 |
|------|-----|------|------|
| cachedProjectPath 제거 | REQ-012 | TASK-070 | ProjectContext 클래스로 교체 |
| getProjectId() 리팩토링 | REQ-012 | TASK-073 | 쿼리파라미터 우선, 9개 핸들러 |
| AnnotationManager.loadAll() async | REQ-011 | TASK-061 | 5분 TTL 캐시 |
| stripStringsAndComments() 2-pass | REQ-013 | TASK-087 | 어노테이션 파싱 핵심 |

---

## 8. 리스크 분석 및 완화 전략

### 리스크 1: ParsedFile 타입 확장 파급 (HIGH)
- **설명**: REQ-013에서 models/events 필드 추가 시 8+ 파일 영향
- **완화**: TASK-084~086을 Phase A 최초에 배치, 타입 변경 후 즉시 전 파서 일괄 업데이트
- **모니터링**: 타입 에러 개수 추적 (tsc --noEmit)

### 리스크 2: stripStringsAndComments() 2-pass 매칭 (HIGH)
- **설명**: 문자열/주석 내 어노테이션을 잘못 파싱할 위험
- **완화**: TASK-087에서 충분한 엣지 케이스 테스트, 정규식 + tree-sitter 이중 검증
- **모니터링**: 파싱 정확도 벤치마크

### 리스크 3: REQ-012/013 Phase C 합류 시점 (MEDIUM)
- **설명**: 두 갈래 병렬 스트림이 만나는 지점에서 통합 이슈
- **완화**: REQ-012 Phase 1의 ProjectContext API를 Phase C 착수 전 안정화
- **모니터링**: 인터페이스 계약 (API contract) 문서 사전 합의

### 리스크 4: cachedProjectPath 제거 (MEDIUM)
- **설명**: web-server.ts의 전역 상태 제거 시 기존 핸들러 9개 영향
- **완화**: TASK-070에서 먼저 ProjectContext 래퍼 도입, 한 핸들러씩 전환
- **모니터링**: 기존 API 테스트 전부 통과 확인

### 리스크 5: SSE 실시간 갱신 (LOW)
- **설명**: Express.js SSE + React 클라이언트 연동 복잡도
- **완화**: TASK-083은 Phase 3 마지막에 배치, MVP는 폴링 폴백 준비
- **모니터링**: 연결 안정성 테스트

### 리스크 6: 대규모 프로젝트 메모리 (MEDIUM)
- **설명**: 역인덱스 + 멀티프로젝트 데이터가 메모리 한계 초과 가능
- **완화**: Phase B에서 LRU 캐시 도입, SharedEntityIndexer에 lazy-loading 패턴 적용
- **모니터링**: heap snapshot, --max-old-space-size 테스트

---

## 9. 테스트 전략

### Phase별 테스트 범위

| Phase | 백엔드 (Jest) | 프론트엔드 (Vitest) | E2E |
|-------|:------------:|:------------------:|:---:|
| REQ-011 P1 | PolicyInfo 타입 검증, /api/project/status | - | - |
| REQ-011 P2 | /api/policies 통합, 컨버터 | PolicyCard, PolicyFilter | - |
| REQ-011 P3~4 | 통합 테스트 | ProjectOverview, InfiniteScroll | - |
| REQ-012 P1 | ProjectContext, /api/projects, /api/switch | projectStore, ProjectSelector | 프로젝트 전환 |
| REQ-012 P2 | - | ProjectHub, ProjectCard | 프로젝트 목록 탐색 |
| REQ-012 P3 | SSE 연결/해제 | 비교 뷰 렌더링 | - |
| REQ-013 A | parseEntityModels (4 파서), parseEventPatterns (2 파서), indexer 통합 | - | - |
| REQ-013 B | SharedEntityIndexer, ReverseCommand | - | reverse CLI |
| REQ-013 C | /api/reverse/*, /api/shared-entities, CrossProjectManager | - | - |
| REQ-013 D | - | EntityNode, EventNode, SharedEntityMap, ReverseTrace | 시각화 E2E |

### 테스트 수량 목표

| REQ | 현재 | 목표 증가 | 누적 예상 |
|-----|:----:|:---------:|:---------:|
| REQ-011 | 1,462 | +60~80 | ~1,540 |
| REQ-012 | ~1,540 | +70~90 | ~1,620 |
| REQ-013 | ~1,620 | +150~200 | ~1,800+ |

### 테스트 원칙
1. 각 TASK 완료 시 해당 기능의 단위 테스트 필수
2. 각 Phase 완료 시 통합 테스트 작성
3. REQ 완료 시 전체 회귀 테스트 실행 (npm test + cd web && npm test)
4. 파서 테스트는 실제 Java/Kotlin 코드 샘플 포함

---

## 10. 커밋 전략

### 커밋 메시지 규칙
```
feat(REQ-0XX): Phase N 설명 (TASK-YYY~ZZZ)
```

### 계획된 커밋 포인트

| # | 커밋 | TASKs | 설명 |
|:-:|------|-------|------|
| 1 | feat(REQ-011): Phase 1 타입+비동기+API | TASK-060~063 | PolicyInfo 확장, 비동기 캐시, API |
| 2 | feat(REQ-011): Phase 2 정책 통합 API+UI | TASK-064~066 | 컨버터, /api/policies, 소스배지 |
| 3 | feat(REQ-011): Phase 3-4 ProjectOverview+테스트 | TASK-067~069 | 독립 조회 완성, 테스트 |
| 4 | feat(REQ-012): Phase 1 서버 인프라 리팩토링 | TASK-070~073 | ProjectContext, API |
| 5 | feat(REQ-012): Phase 1 프론트엔드 스토어 | TASK-074~077 | projectStore, 테스트 |
| 6 | feat(REQ-012): Phase 2 ProjectHub | TASK-078~081 | 허브 페이지, 카드 |
| 7 | feat(REQ-012): Phase 3 비교뷰+SSE | TASK-082~083 | 비교, 실시간 |
| 8 | feat(REQ-013): Phase A 타입+유틸 | TASK-084~087 | ModelInfo, EventInfo, 어노테이션 |
| 9 | feat(REQ-013): Phase A JVM 파서 | TASK-088~093 | 4 파서 엔티티+이벤트 |
| 10 | feat(REQ-013): Phase A 인덱서+TS ORM+테스트 | TASK-094~096 | 수집 파이프라인, 테스트 |
| 11 | feat(REQ-013): Phase B 역인덱스 | TASK-097~102 | SharedEntityIndexer, CLI |
| 12 | feat(REQ-013): Phase C 크로스 프로젝트 통합 | TASK-103~107 | API, 매니저, 테스트 |
| 13 | feat(REQ-013): Phase D 대시보드 시각화 | TASK-108~112 | 노드, 맵, 인터랙션 |

---

## 11. 진행 상태 추적

### 마일스톤

| 마일스톤 | 조건 | 예상 완료 |
|---------|------|----------|
| M1: REQ-011 완료 | TASK-069 완료 + QA PASS | Week 2 |
| M2: REQ-012 P1 완료 | TASK-077 완료 + QA PASS | Week 4 |
| M3: REQ-013 Phase A 완료 | TASK-096 완료 + QA PASS | Week 4 |
| M4: REQ-013 Phase B 완료 | TASK-102 완료 + QA PASS | Week 6 |
| M5: REQ-012 완료 | TASK-083 완료 + QA PASS | Week 5 |
| M6: REQ-013 Phase C 완료 | TASK-107 완료 + QA PASS | Week 8 |
| M7: 전체 완료 | TASK-112 완료 + QA PASS | Week 10 |

### 진행률 추적 체크리스트

- [ ] REQ-011 Phase 1 (12pts) - TASK-060~063
- [ ] REQ-011 Phase 2 (11pts) - TASK-064~066
- [ ] REQ-011 Phase 3 (6pts) - TASK-067~068
- [ ] REQ-011 Phase 4 (4pts) - TASK-069
- [ ] REQ-012 Phase 1 (24pts) - TASK-070~077
- [ ] REQ-012 Phase 2 (10pts) - TASK-078~081
- [ ] REQ-012 Phase 3 (8pts) - TASK-082~083
- [ ] REQ-013 Phase A (45pts) - TASK-084~096
- [ ] REQ-013 Phase B (30pts) - TASK-097~102
- [ ] REQ-013 Phase C (25pts) - TASK-103~107
- [ ] REQ-013 Phase D (23pts) - TASK-108~112

---

## 부록: TASK 번호 전체 매핑

| 범위 | REQ | 개수 | 총 포인트 |
|------|-----|:----:|:---------:|
| TASK-001 ~ TASK-059 | REQ-001 ~ REQ-010 (완료) | 59 | - |
| TASK-060 ~ TASK-069 | REQ-011 | 10 | 33 |
| TASK-070 ~ TASK-083 | REQ-012 | 14 | 42 |
| TASK-084 ~ TASK-112 | REQ-013 | 29 | 123 |
| **합계** | **REQ-001 ~ REQ-013** | **112** | **198 (신규)** |
