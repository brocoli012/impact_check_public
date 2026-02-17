# 티켓 대시보드 - Kurly Impact Checker

## 진행 현황

| 상태 | 개수 |
|------|------|
| Done | 9 (MVP 5 Phase + Post-MVP + REQ-002 + REQ-003 + REQ-004) |
| In Progress | 0 |
| Ready | 3 (REQ-005~007) |

## 활성 EPIC

| EPIC | 제목 | REQ 수 | 상태 |
|------|------|--------|------|
| EPIC-001 | Kurly Impact Checker | 7 | in_progress |

## 티켓 목록

| 티켓 | 유형 | 제목 | 상태 | 우선순위 |
|------|------|------|------|----------|
| EPIC-001 | EPIC | Kurly Impact Checker | in_progress | - |
| REQ-001 | REQ | Kurly Impact Checker MVP 개발 | done | CRITICAL |
| REQ-002 | REQ | Claude Native Analysis - AI 직접 분석 전환 | done | CRITICAL |
| REQ-003 | REQ | 증분 인덱스 & 자동 갱신 | done | CRITICAL |
| REQ-004 | REQ | 어노테이션 시스템 | done | HIGH |
| REQ-005 | REQ | 다중 쿼리 모드 | ready | HIGH |
| REQ-006 | REQ | 웹 대시보드 확장 - 정책 뷰 | ready | MEDIUM |
| REQ-007 | REQ | 크로스 프로젝트 임팩트 | ready | MEDIUM |

## MVP 개발 Phase 현황

| Phase | 내용 | 상태 | 테스트 | TPO 복잡도 | QA |
|-------|------|------|--------|-----------|-----|
| Phase 1 | Foundation (프로젝트 구조, 타입, CLI, Config) | Done | 267 pass | 4/10 (R1-R2) | PASS |
| Phase 2 | Code Indexing (스캐너, 파서, 그래프, 정책, 인덱서) | Done | 353 pass | 7/10 (R1-R5) | PASS |
| Phase 3 | Impact Analysis Engine (파싱, 매칭, 분석, 점수, 신뢰도) | Done | 472 pass | 7/10 (R1-R5) | PASS |
| Phase 4 | Visualization Web (React SPA, React Flow, Dashboard) | Done | 529 pass | 7/10 (R1-R2) | PASS |
| Phase 5 | Ticket Generation & Polish (커맨드, E2E, 에러핸들링, 문서화) | Done | 588 pass | 6/10 (R1) | PASS |

## Post-MVP 작업

| 작업 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 대화형 모드 (Conversational Mode) | Done | - | SKILL.md 확장, CLAUDE.md 생성 |
| 플러그인 배포 (GitHub) | Done | - | .claude-plugin/, skills/kic/, hooks/ |
| LLM 아키텍처 제거 + 규칙 기반 전환 | Done | 580 pass | 122파일, -4684줄, QA R1-R5 PASS |
| README 전면 개선 | Done | - | 사용흐름, 대화형 예시, 대시보드 설명 |

## REQ-002: Claude Native Analysis (NEXT)

**목표**: Claude Code/Antigravity 자체를 LLM으로 활용한 AI 직접 분석 구현

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-002 | export-index CLI 명령어 | done | - |
| TASK-003 | save-result CLI 명령어 | done | - |
| TASK-004 | 분석 결과 JSON 스키마 문서화 | done | - |
| TASK-001 | SKILL.md AI 분석 프로토콜 설계 | done | TASK-002, 003, 004 |
| TASK-005 | 대화형 모드 분석 흐름 업데이트 | done | TASK-001 |
| TASK-006 | 테스트 + QA | done | TASK-005 |

**실행 순서**: TASK-002 + 003 (병렬) -> TASK-004 -> TASK-001 -> TASK-005 -> TASK-006

**복잡도**: TPO 5/10, 피드백 3회, 영향 파일 ~10개

**티켓 상세**: `.dream-team/docs/tickets/REQ-002-claude-native-analysis.md`

## REQ-003: 증분 인덱스 & 자동 갱신 (DONE)

**목표**: Git diff 기반 증분 인덱싱, isIndexStale() 감지, 분석 전 자동 갱신

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-007 | Git diff 변경 파일 감지 | done | - |
| TASK-008 | 증분 인덱싱 엔진 | done | TASK-007 |
| TASK-009 | isIndexStale() 판정 로직 | done | TASK-007 |
| TASK-010 | 분석 전 자동 갱신 통합 | done | TASK-008, 009 |
| TASK-011 | 증분 인덱스 테스트 + QA | done | TASK-010 |

**복잡도**: CRITICAL, TASK 5개, QA PASS (661 테스트)

## REQ-004: 어노테이션 시스템 (DONE)

**목표**: YAML 보강 주석 생성, AnnotationManager/Generator, CLI generate/view, 파이프라인 통합

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-012 | AnnotationManager (YAML CRUD, sourceHash, userModified 병합) | done | - |
| TASK-013 | AnnotationGenerator (규칙 기반 코드 분석) | done | - |
| TASK-014 | AnnotationsCommand 실체 + AnnotationLoader | done | TASK-012, 013 |
| TASK-015 | 파이프라인 통합 + Layer 3 보너스 | done | TASK-014 |
| TASK-016 | QA PASS (AC 11/11, matchRate 100%) | done | TASK-015 |

**복잡도**: HIGH (8/10), TASK 5개, QA PASS (772 테스트)

## REQ-005: 다중 쿼리 모드 (READY)

**목표**: PolicyCheckCommand, AskCommand, SummaryCommand 3개 신규 CLI 명령어

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-017 | 다중 쿼리 CLI 인터페이스 | ready | - |
| TASK-018 | 병렬 분석 파이프라인 | ready | TASK-017 |
| TASK-019 | 교차 영향도 비교 엔진 | ready | TASK-018 |
| TASK-020 | 다중 쿼리 테스트 + QA | ready | TASK-019 |

**복잡도**: HIGH, TASK 4개

## REQ-006: 웹 대시보드 확장 - 정책 뷰 (READY)

**목표**: 정책 매칭 결과 시각화 및 정책 관리 UI

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-021 | 정책 목록 뷰 컴포넌트 | ready | - |
| TASK-022 | 정책-코드 매핑 시각화 | ready | TASK-021 |
| TASK-023 | 정책 필터 및 검색 | ready | TASK-021 |
| TASK-024 | 정책 뷰 테스트 + QA | ready | TASK-022, 023 |

**복잡도**: MEDIUM, TASK 4개

## REQ-007: 크로스 프로젝트 임팩트 (READY)

**목표**: 여러 프로젝트 간 의존성 분석 및 영향도 추적

| TASK | 내용 | 상태 | 의존성 |
|------|------|------|--------|
| TASK-025 | 프로젝트 간 의존성 스캐너 | ready | - |
| TASK-026 | 크로스 프로젝트 그래프 빌더 | ready | TASK-025 |
| TASK-027 | 크로스 임팩트 분석 엔진 | ready | TASK-026 |
| TASK-028 | 크로스 프로젝트 대시보드 뷰 | ready | TASK-027 |
| TASK-029 | 크로스 프로젝트 테스트 + QA | ready | TASK-028 |

**복잡도**: MEDIUM, TASK 5개

## 문서 승인 현황

| 문서 ID | 유형 | 상태 | 파일 수 | 최종 승인일 |
|---------|------|------|---------|------------|
| PLAN-001 | 기획서 | Approved | 8 | 2026-02-13 |
| DESIGN-001 | 디자인 | Approved | 4 | 2026-02-13 |
| TECH-DESIGN-001 | 기술설계 | Approved | 1 | 2026-02-13 |
| DECISIONS | 의사결정 | Recorded | 5 | 2026-02-15 |
| DESIGN-REVIEW-002 | 디자인 리뷰 | Approved (조건부) | 1 | 2026-02-17 |
| TECH-DESIGN-002 | 기술설계 | Draft | 1 | 2026-02-17 |

---

## 현재 상태 요약

- **MVP**: 완료 (588 -> 580 테스트, LLM 테스트 39건 삭제 + 웹 31건 추가)
- **Post-MVP**: 4건 완료 (대화형, 플러그인, LLM 제거, README)
- **REQ-002**: 완료 (601 테스트, QA PASS)
- **REQ-003**: 완료 (661 테스트, QA PASS, 5/5 TASK done)
- **REQ-004**: 완료 (772 테스트, QA PASS, 5/5 TASK done)
- **현재 작업**: REQ-005 TASK-017~020 대기 (다중 쿼리 모드)
- **대기 중**: REQ-005~007 (Ready, 개발 대기)
- **전체 TASK**: 23개 (REQ-003: 5 done, REQ-004: 5 done, REQ-005: 4, REQ-006: 4, REQ-007: 5)
- **GitHub**: https://github.com/brocoli012/impact_checker

---
*최종 업데이트: 2026-02-17*
