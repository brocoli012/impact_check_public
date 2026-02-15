---
name: Kurly Impact Checker
version: 1.0.0
description: 기획서 기반 코드 영향도 분석 도구
author: Kurly Dev Team
commands:
  - /impact init
  - /impact analyze
  - /impact view
  - /impact tickets
  - /impact config
  - /impact reindex
  - /impact policies
  - /impact owners
  - /impact annotations
  - /impact projects
  - /impact demo
  - /impact help
---

# Kurly Impact Checker

기획서를 입력하면 프로젝트 코드베이스를 분석하여 영향 범위,
난이도 점수, 작업 티켓을 자동 생성합니다.

## 명령어

### /impact init <project_path>
프로젝트를 등록하고 코드 인덱싱을 수행합니다.
실행: node {skill_dir}/dist/index.js init <project_path>

### /impact analyze [--file <path>]
기획서를 입력받아 영향도를 분석합니다.
실행: node {skill_dir}/dist/index.js analyze [--file <path>]

### /impact view [--stop]
분석 결과 시각화 웹을 실행합니다.
실행: node {skill_dir}/dist/index.js view [--stop]

### /impact tickets [--create] [--detail <id>]
작업 티켓을 조회하거나 생성합니다.
실행: node {skill_dir}/dist/index.js tickets [--create] [--detail <id>]

### /impact config [--provider <name>] [--key <api_key>]
LLM 프로바이더 및 API 키를 설정합니다.
실행: node {skill_dir}/dist/index.js config [--provider <name>] [--key <api_key>]

### /impact reindex [--full]
코드 인덱스를 수동으로 갱신합니다.
실행: node {skill_dir}/dist/index.js reindex [--full]

### /impact policies [--search <keyword>] [add <content>]
정책 사전을 조회하거나 새 정책을 등록합니다.
실행: node {skill_dir}/dist/index.js policies [--search <keyword>] [add <content>]

### /impact owners [--add] [--edit <system>] [--remove <system>]
시스템별 담당자 및 팀 정보를 관리합니다.
실행: node {skill_dir}/dist/index.js owners [--add] [--edit <system>] [--remove <system>]

### /impact annotations [generate [path]] [view [path]]
보강 주석을 생성하거나 기존 보강 주석을 조회합니다.
실행: node {skill_dir}/dist/index.js annotations [generate [path]] [view [path]]

### /impact projects [--switch <name>] [--remove <name>] [--archive <name>]
멀티 프로젝트를 관리합니다 (전환, 제거, 아카이브).
실행: node {skill_dir}/dist/index.js projects [--switch <name>] [--remove <name>] [--archive <name>]

### /impact demo
샘플 데이터 기반으로 도구를 체험합니다.
실행: node {skill_dir}/dist/index.js demo

### /impact help [command] / /impact faq
도움말을 표시하거나 자주 묻는 질문(FAQ)을 조회합니다.
실행: node {skill_dir}/dist/index.js help [command]
