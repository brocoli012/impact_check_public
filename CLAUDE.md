# Kurly Impact Checker (KIC)

기획서 기반 코드 영향도 분석 도구.

## 대화형 호출

"kic", "킥", "임팩트 체커", "영향도 분석" 등의 키워드나 `/kic` 명령어로 대화형 모드에 진입할 수 있습니다. 상세 프로토콜은 SKILL.md를 참조하세요.

## 프로젝트 구조

- `src/` - TypeScript 소스 (CLI, 분석 엔진, 웹서버)
- `web/` - React SPA 대시보드 (Vite, Tailwind, React Flow)
- `dist/` - 빌드 출력
- `SKILL.md` - Claude Code 스킬 정의

## 기술 스택

- Runtime: Node.js + TypeScript
- CLI: 자체 라우터 (router.ts)
- Web Server: Express.js v5
- Web Frontend: React 19 + Vite 6
- Visualization: @xyflow/react v12, Recharts
- Styling: Tailwind CSS v4
- State: Zustand v5
- Test (root): Jest + ts-jest
- Test (web): Vitest + Testing Library
- Package Manager: npm

## 세션 상태

- 프로젝트 설정: `~/.impact/config.json`
- 분석 결과: `~/.impact/projects/<id>/results/`
- 웹서버: 포트 3847 (기본값)

## 실행 방법

```bash
# 빌드 (root)
npm run build

# 테스트 (root - Jest)
npm test

# CLI 실행
node dist/index.js <command> [args]

# 웹 대시보드 (개발 모드)
cd web && npm run dev

# 웹 테스트 (Vitest)
cd web && npm test
```

## 개발 규칙

- 테스트 우선 개발 (root: Jest, web: Vitest)
- 커밋 전 테스트 통과 필수
- ESLint + TypeScript strict 준수
